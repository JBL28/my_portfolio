"""apps/ai-server/app/pipeline/retrieve.py

[Retrieve] Graph RAG 검색 — 01_설계.md 2장 [Retrieve] 0)~7)을 그대로 구현한다.
이 단계는 LLM을 호출하지 않는 순수 코드 단계다(Neo4j 검색/스코어링).

0) project_hints를 seed로, wants_project_overview에 따라 Overview Section을 후보에 포함
1) competencies로 DEMONSTRATES, technologies(정규화 후) 로 Case-USES/Project-USES 탐색
2) wants_alternatives_considered=true면 CONSIDERED 관계 탐색
3) wants_growth_connection=true면 INFLUENCED/BUILDS_ON 1-hop 확장
4) search_intent를 임베딩해 벡터 유사도 검색
5) is_followup / wants_similar_cases
6) 0~5의 합집합 구성 (Case 있는 Section은 Case 필드까지, 없으면 body만)
7) 스코어링 후 Top-K 선정 (mandatory 후보는 항상 포함)

**계측(01_설계.md 8.1/8.2, Phase 05)**: `retrieve()` 오케스트레이터를 세 span으로
감싼다 — 각 단계 함수(`_step0_overview` 등)의 내부 로직·시그니처는 그대로 두고,
오케스트레이터 안에서 실행 구간만 span으로 나눈다.
  - `retrieve.graph`  : 0)~3) + 5) — LLM 호출 없는 Cypher 기반 단계들.
    5)는 원래 코드 순서상 4)(벡터 검색) 뒤에 있었으나, 4)와 데이터 의존성이 없고
    (extract만 참조) `_merge()`가 hits 리스트 순서와 무관하게 section_id 기준으로
    합집합을 구성하므로, 5)를 4) 앞으로 옮겨 실행해도 최종 candidates 집합은
    동일하다 — 이 재배치만으로 "0)~3)+5)"를 하나의 연속된 span으로 감쌀 수 있다.
  - `retrieve.vector` : 4) 임베딩 + 벡터 검색.
  - `retrieve.rank`   : 6) 합집합 구성 + 7) 스코어링/Top-K 선정.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from openai import OpenAI

from app.config import settings
from app.graph import client as graph
from app.graph.project_hints import normalize_project_hints
from app.graph.technology_aliases import normalize_technologies
from app.observability.tracing import get_tracer
from app.schemas.structured_outputs import ExtractResult

# _Hit.source → Neo4j 관계 타입(또는 명시적 경로)의 근사 매핑. retrieve.graph span의
# "매칭 경로(DEMONSTRATES/USES/CONSIDERED/BUILDS_ON/INFLUENCED 중 어떤 관계로
# 매칭됐는지, 8.2)" 기록에 쓰인다 — 관측 전용이며 매칭 로직 자체에는 쓰이지 않는다.
_SOURCE_TO_RELATION: dict[str, str] = {
    "overview": "explicit:project_hints+wants_project_overview",  # 2장 0) 명시적 경로
    "graph_competency": "DEMONSTRATES",
    "graph_technology_case": "USES",
    "graph_technology_project": "USES",
    "considered": "CONSIDERED",
    "growth_case": "INFLUENCED",
    "growth_project": "BUILDS_ON",
    "followup": "explicit:refers_to_previous_citations",  # 2장 5) 이전 턴 citation
    "similar_case": "DEMONSTRATES|USES|CONSIDERED",  # 2장 5) 유사 사례 확장 검색
    "vector": "vector_similarity",
}


# ---------------------------------------------------------------------------
# Candidate / 내부 Hit 자료구조
# ---------------------------------------------------------------------------


@dataclass
class Candidate:
    """[Retrieve]가 최종적으로 골라 [Generate]에 넘기는 근거 후보 하나(Section 단위)."""

    section_id: str
    title: str
    body: str
    path: str
    anchor: str
    searchable: bool
    project_slug: str | None
    cases: list[dict] = field(default_factory=list)
    sources: set[str] = field(default_factory=set)
    mandatory: bool = False
    vector_score: float | None = None
    # is_followup 경로로 이 Section이 후보가 됐고, 그 근거가 특정 caseId를 가리키고
    # 있었다면(2장 [Retrieve] 5) 그 caseId를 기록해 Generate에 힌트로 전달한다.
    followup_case_id: str | None = None


@dataclass
class _Hit:
    section_id: str
    source: str
    mandatory: bool = False
    vector_score: float | None = None
    followup_case_id: str | None = None


# ---------------------------------------------------------------------------
# 0) Overview 후보
# ---------------------------------------------------------------------------


def _step0_overview(project_hints: list[str]) -> list[_Hit]:
    """wants_project_overview=true일 때만 호출된다.
    project_hints가 있으면 해당 Project(들)의 Overview만, 비어 있으면 전체 Project의
    Overview를 후보로 포함한다. 이 경로로 들어온 Overview는 항상 mandatory다(2장 7))."""
    rows = graph.overview_sections(project_hints)
    return [
        _Hit(section_id=row["sectionId"], source="overview", mandatory=True) for row in rows
    ]


# ---------------------------------------------------------------------------
# 1) 그래프 매칭 (역량/기술)
# ---------------------------------------------------------------------------


def _step1_graph_matching(
    competencies: list[str], canonical_technologies: list[str]
) -> tuple[list[_Hit], set[str], set[str]]:
    """반환값: (hits, matched_case_ids, matched_project_slugs_from_project_uses)

    matched_case_ids/matched_project_slugs_from_project_uses는 3)의 seed 판단과,
    project_hints가 비어 있었을 때의 보강(이 함수 밖, retrieve()에서 처리)에 쓰인다.
    """
    hits: list[_Hit] = []
    matched_case_ids: set[str] = set()
    matched_project_slugs: set[str] = set()

    for row in graph.cases_by_competencies(competencies):
        hits.append(_Hit(section_id=row["sectionId"], source="graph_competency"))
        matched_case_ids.add(row["caseId"])

    for row in graph.cases_by_technologies_uses(canonical_technologies):
        hits.append(_Hit(section_id=row["sectionId"], source="graph_technology_case"))
        matched_case_ids.add(row["caseId"])

    for row in graph.projects_by_technologies_uses(canonical_technologies):
        # wants_project_overview 값과 무관하게 후보에 추가한다(2장 [Retrieve] 1)).
        hits.append(_Hit(section_id=row["sectionId"], source="graph_technology_project"))
        matched_project_slugs.add(row["projectSlug"])

    return hits, matched_case_ids, matched_project_slugs


# ---------------------------------------------------------------------------
# 2) 대안 비교 매칭
# ---------------------------------------------------------------------------


def _step2_considered(
    canonical_technologies: list[str], project_hints: list[str]
) -> list[_Hit]:
    if canonical_technologies:
        rows = graph.cases_by_technologies_considered(canonical_technologies)
    else:
        rows = graph.cases_with_any_considered(project_hints)
    return [_Hit(section_id=row["sectionId"], source="considered") for row in rows]


# ---------------------------------------------------------------------------
# 3) 성장/연결 매칭
# ---------------------------------------------------------------------------


def _step3_growth(
    seed_case_ids: set[str], seed_project_slugs: set[str], project_hints: list[str]
) -> list[_Hit]:
    hits: list[_Hit] = []
    has_seed = bool(seed_case_ids) or bool(seed_project_slugs)

    if has_seed:
        for row in graph.growth_influenced_from_seed_cases(list(seed_case_ids)):
            hits.append(_Hit(section_id=row["sectionId"], source="growth_case"))

        for row in graph.growth_builds_on_from_seed_projects(list(seed_project_slugs)):
            for section_id in row.get("evidenceSectionIds") or []:
                hits.append(_Hit(section_id=section_id, source="growth_project"))
    else:
        for row in graph.growth_influenced_all(project_hints):
            hits.append(_Hit(section_id=row["prevSectionId"], source="growth_case"))
            hits.append(_Hit(section_id=row["currSectionId"], source="growth_case"))

        for row in graph.growth_builds_on_all(project_hints):
            for section_id in row.get("evidenceSectionIds") or []:
                hits.append(_Hit(section_id=section_id, source="growth_project"))

    return hits


# ---------------------------------------------------------------------------
# 4) 벡터 매칭
# ---------------------------------------------------------------------------


def _embed_query(openai_client: OpenAI, text: str) -> list[float]:
    response = openai_client.embeddings.create(model=settings.embedding_model, input=[text])
    return response.data[0].embedding


def _step4_vector(openai_client: OpenAI, search_intent: str) -> list[_Hit]:
    embedding = _embed_query(openai_client, search_intent)
    rows = graph.vector_search(embedding, settings.vector_search_k)
    return [
        _Hit(section_id=row["sectionId"], source="vector", vector_score=row["score"])
        for row in rows
    ]


# ---------------------------------------------------------------------------
# 5) is_followup / wants_similar_cases
# ---------------------------------------------------------------------------


def _step5_followup_and_similar(extract: ExtractResult) -> list[_Hit]:
    hits: list[_Hit] = []

    if extract.is_followup:
        for ref in extract.refers_to_previous_citations:
            hits.append(
                _Hit(
                    section_id=ref.sectionId,
                    source="followup",
                    mandatory=True,
                    followup_case_id=ref.caseId,
                )
            )

    if extract.wants_similar_cases:
        seed_case_ids = {
            ref.caseId for ref in extract.refers_to_previous_citations if ref.caseId
        }
        for case_id in seed_case_ids:
            for row in graph.similar_cases_by_competency(case_id):
                hits.append(_Hit(section_id=row["sectionId"], source="similar_case"))
            for row in graph.similar_cases_by_technology(case_id):
                hits.append(_Hit(section_id=row["sectionId"], source="similar_case"))

    return hits


# ---------------------------------------------------------------------------
# 6) 합집합 구성
# ---------------------------------------------------------------------------


def _merge(hits: list[_Hit]) -> dict[str, Candidate]:
    section_ids = list({hit.section_id for hit in hits})
    rows = graph.fetch_sections_with_cases(section_ids)
    section_by_id = {row["sectionId"]: row for row in rows}

    candidates: dict[str, Candidate] = {}
    for hit in hits:
        row = section_by_id.get(hit.section_id)
        if row is None:
            # 존재하지 않는 sectionId(예: 필터링을 통과했지만 실제로 그래프에 없는 id).
            # 방어적으로 건너뛴다 — Retrieve는 이미 발견된 근거만 다룬다.
            continue

        candidate = candidates.get(hit.section_id)
        if candidate is None:
            candidate = Candidate(
                section_id=row["sectionId"],
                title=row["title"],
                body=row["body"],
                path=row["path"],
                anchor=row["anchor"],
                searchable=row["searchable"],
                project_slug=row["projectSlug"],
                cases=row["cases"],
            )
            candidates[hit.section_id] = candidate

        candidate.sources.add(hit.source)
        candidate.mandatory = candidate.mandatory or hit.mandatory
        if hit.vector_score is not None:
            candidate.vector_score = max(candidate.vector_score or 0.0, hit.vector_score)
        if hit.followup_case_id is not None:
            candidate.followup_case_id = hit.followup_case_id

    return candidates


# ---------------------------------------------------------------------------
# 7) 스코어링 및 Top-K 선정
#
# 가중치는 01_설계.md 7장이 "실제 데이터로 튜닝 필요, 구조만 정의"라고 명시한 영역이다.
# 아래 값은 그 구조 위에 얹은 합리적 기본값이며, 근거는 다음과 같다:
#   - graph_competency / graph_technology_case = 1.0
#     Extract가 명시적으로 추출한 역량·기술이 Case 수준에서 직접 매칭된 것 — 가장 신뢰도
#     높은 신호이므로 최고 가중치를 준다.
#   - considered = 0.9
#     CONSIDERED도 명시적 그래프 매칭이지만, "채택하지 않은" 기술이라 질문의 핵심 의도
#     (실제 사용 사례)에서는 한 단계 약한 신호로 본다.
#   - graph_technology_project = 0.6
#     Project 전체가 그 기술을 썼다는 근거는 있지만, Case 수준의 구체적 행동 근거가
#     아니라 Overview 요약 수준이므로 개별 Case 매칭보다 약하게 둔다.
#   - growth_case / growth_project = 0.7 / 0.6
#     INFLUENCED/BUILDS_ON로 1-hop 확장된 근거는 원래 질문의 핵심 개념과 직접 매칭된
#     것이 아니라 "그로부터 파생된 연결"이므로 그래프 직접 매칭보다 한 단계 낮춘다.
#     Case 쌍(INFLUENCED)이 Project 쌍의 evidenceSection(BUILDS_ON)보다 더 구체적인
#     서술이라고 보아 근소하게 더 높였다.
#   - similar_case = 0.5
#     "비슷한 사례 확장 검색"은 질문이 명시적으로 지목한 개념이 아니라 파생 질의이므로
#     가장 낮은 그래프 가중치를 준다.
#   - vector: 원시 cosine 유사도(0~1 근방)에 VECTOR_SIMILARITY_WEIGHT=1.0을 곱해 그대로
#     더한다 — 강한 의미적 일치(유사도 0.8+)가 명시적 그래프 매칭 1건과 맞먹도록,
#     약한 일치(0.3 이하)는 어떤 그래프 매칭보다도 낮게 가라앉도록 graph_competency와
#     같은 스케일(1.0)에 맞췄다.
#   - overview/followup은 이미 mandatory로 처리되어 스코어링 대상이 아니므로 가중치가
#     없다(테이블에 없으면 0으로 취급되지만 애초에 비교 대상이 아니다).
# ---------------------------------------------------------------------------

_SOURCE_WEIGHT: dict[str, float] = {
    "graph_competency": 1.0,
    "graph_technology_case": 1.0,
    "considered": 0.9,
    "graph_technology_project": 0.6,
    "growth_case": 0.7,
    "growth_project": 0.6,
    "similar_case": 0.5,
}
_VECTOR_SIMILARITY_WEIGHT = 1.0


def _score(candidate: Candidate) -> float:
    graph_score = sum(_SOURCE_WEIGHT.get(source, 0.0) for source in candidate.sources)
    vector_component = _VECTOR_SIMILARITY_WEIGHT * (candidate.vector_score or 0.0)
    return graph_score + vector_component


def _select_top_k(candidates: dict[str, Candidate], top_k: int) -> list[Candidate]:
    mandatory = sorted(
        (c for c in candidates.values() if c.mandatory), key=lambda c: c.section_id
    )
    rest = sorted(
        (c for c in candidates.values() if not c.mandatory),
        key=lambda c: (-_score(c), c.section_id),
    )
    remaining_slots = max(0, top_k - len(mandatory))
    return mandatory + rest[:remaining_slots]


# ---------------------------------------------------------------------------
# 오케스트레이터
# ---------------------------------------------------------------------------


def retrieve(openai_client: OpenAI, extract: ExtractResult) -> list[Candidate]:
    tracer = get_tracer()
    project_hints = list(dict.fromkeys(extract.project_hints))  # 순서 유지 dedup
    # Extract가 뽑은 project_hints는 화면 표시용 프로젝트명(예: "Home Server")이라
    # Cypher의 proj.slug(예: "home-server")와 정확 일치하지 않는다. technologies와
    # 동일한 패턴으로 Project.slug로 정규화해야 이후 0)/2)/3) 단계의 project_hints
    # 매칭이 실제로 좁혀진다.
    project_hints = normalize_project_hints(project_hints)
    hits: list[_Hit] = []

    # retrieve.graph: 0)~3) + 5) — LLM 호출 없는 Cypher 기반 단계들(모듈 docstring의
    # 재배치 근거 참고).
    with tracer.start_as_current_span("retrieve.graph") as span:
        # 0) Overview 후보
        if extract.wants_project_overview:
            hits.extend(_step0_overview(project_hints))

        # 1) 그래프 매칭 (역량/기술)
        competencies = [c.value for c in extract.competencies]
        canonical_technologies = normalize_technologies(extract.technologies)
        step1_hits, seed_case_ids, seed_project_slugs = _step1_graph_matching(
            competencies, canonical_technologies
        )
        hits.extend(step1_hits)

        # project_hints가 비어 있었다면 Project-USES 매칭 결과로 보강한다
        # (2장 [Retrieve] 1)).
        if not project_hints and seed_project_slugs:
            project_hints = list(seed_project_slugs)

        # 2) 대안 비교 매칭
        if extract.wants_alternatives_considered:
            hits.extend(_step2_considered(canonical_technologies, project_hints))

        # 3) 성장/연결 매칭
        if extract.wants_growth_connection:
            hits.extend(_step3_growth(seed_case_ids, seed_project_slugs, project_hints))

        # 5) is_followup / wants_similar_cases — 4)(벡터)와 데이터 의존성이 없어
        # 이 span 안에서 먼저 실행한다(모듈 docstring 참고).
        hits.extend(_step5_followup_and_similar(extract))

        # 8.2: "매칭된 Case/Section/Project id, 매칭 경로(... 어떤 관계로 매칭됐는지)".
        span.set_attribute("matched_section_ids", [h.section_id for h in hits])
        span.set_attribute("matched_case_ids", sorted(seed_case_ids))
        span.set_attribute("matched_project_slugs", sorted(seed_project_slugs))
        span.set_attribute(
            "matched_relations",
            sorted({_SOURCE_TO_RELATION.get(h.source, h.source) for h in hits}),
        )

    # retrieve.vector: 4) 임베딩 + 벡터 유사도 검색.
    with tracer.start_as_current_span("retrieve.vector") as span:
        vector_hits = _step4_vector(openai_client, extract.search_intent)
        hits.extend(vector_hits)

        # 8.2: "후보 Section id, 유사도 점수".
        span.set_attribute("candidate_section_ids", [h.section_id for h in vector_hits])
        span.set_attribute(
            "similarity_scores", [h.vector_score or 0.0 for h in vector_hits]
        )

    # retrieve.rank: 6) 합집합 구성 + 7) 스코어링/Top-K 선정.
    with tracer.start_as_current_span("retrieve.rank") as span:
        # 6) 합집합 구성
        candidates = _merge(hits)

        # 7) Top-K 선정 (mandatory 항상 포함)
        selected = _select_top_k(candidates, settings.retrieve_top_k)
        selected_ids = {c.section_id for c in selected}

        # 8.2: "최종 후보 목록 — sectionId별 sources(...), finalScore, rank, Top-K
        # 선정(selected) 여부". 순위(rank)가 매겨지는 순서(=mandatory 먼저, 그 다음
        # score 내림차순)와 동일한 정렬로 기록한다.
        ranked = sorted(
            candidates.values(),
            key=lambda c: (not c.mandatory, -_score(c), c.section_id),
        )
        span.set_attribute(
            "candidates",
            [
                f"rank={i + 1} sectionId={c.section_id} sources={','.join(sorted(c.sources))} "
                f"finalScore={_score(c):.3f} selected={c.section_id in selected_ids}"
                for i, c in enumerate(ranked)
            ],
        )
        span.set_attribute("selected_section_ids", [c.section_id for c in selected])

        return selected
