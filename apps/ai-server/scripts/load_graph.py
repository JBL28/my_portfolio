#!/usr/bin/env python3
"""apps/ai-server/scripts/load_graph.py

`data/`(Phase 00 산출물)를 유일한 입력으로 삼아 Neo4j 그래프를 전체 재생성한다.

설계 근거:
- 01_설계.md 3장 — Neo4j 스키마 확정
- 01_설계.md 4장 — Neo4j 데이터 적재 파이프라인 (특히 6번: 생성해야 할 노드·관계 전체 목록,
  7번: 재적재는 멱등해야 함, 8번: 동기화 규칙)
- 02_구현계획.md 0장 — 임베딩 모델(OpenAI text-embedding-3-small), 재적재 방식(전체 삭제 후
  재생성), ID 생성 방식(UUID v4, 단 Portfolio/Competency/Technology처럼 data/에 id 필드
  자체가 없는 노드는 이름으로부터 결정론적 UUID를 파생한다 — 아래 stable_id 참고)

재적재 순서:
  1) 환경변수·데이터 파일을 전부 읽고 검증한다(Neo4j에 아무 것도 손대지 않는다 — 실패하면
     기존 그래프가 그대로 보존된다).
  2) OpenAI 임베딩을 생성한다(이 역시 Neo4j를 손대기 전에 수행 — 임베딩 실패 시 그래프를
     비운 채로 남기지 않기 위함).
  3) Neo4j에 연결해 schema.cypher(제약조건 + 벡터 인덱스)를 적용한다(멱등, IF NOT EXISTS).
  4) `MATCH (n) DETACH DELETE n`으로 전체 삭제한다(0장 확정 사항).
  5) Portfolio, Project, Section(H2 + Overview + Home Profile), Competency, Technology,
     Case 노드와 4장 6번이 명시한 관계를 전부 다시 생성한다.

이 스크립트는 Docker/Neo4j/OpenAI API 키가 없는 환경에서는 실행할 수 없다 — 실제 실행/검증은
사용자의 홈서버 환경에서 이뤄진다(01_설계.md 0장).
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any

from neo4j import Driver, GraphDatabase, ManagedTransaction, Session
from openai import OpenAI

try:
    # python-dotenv가 설치돼 있으면 apps/ai-server/.env를 읽어 환경변수로 반영한다.
    # 없어도 스크립트는 동작한다 — 이 경우 실제 환경변수(NEO4J_*, OPENAI_API_KEY)가
    # 이미 셸/systemd/Docker 환경에 설정돼 있어야 한다.
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - 선택적 의존성
    pass


# ---------------------------------------------------------------------------
# 경로
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
AI_SERVER_DIR = SCRIPT_DIR.parent
REPO_ROOT = AI_SERVER_DIR.parent.parent
DATA_DIR = REPO_ROOT / "data"

PROFILE_PATH = DATA_DIR / "profile.json"
PROJECTS_DIR = DATA_DIR / "projects"
CASES_DIR = DATA_DIR / "rag" / "cases"
TECH_ALIASES_PATH = DATA_DIR / "rag" / "technology-aliases.json"
SCHEMA_CYPHER_PATH = AI_SERVER_DIR / "db" / "schema.cypher"


# ---------------------------------------------------------------------------
# 상수
# ---------------------------------------------------------------------------

# 02_구현계획.md 0장에서 확정한 임베딩 모델(3.3 — "OpenAI API 확정"은 판별/추출/생성에
# 한정되고 임베딩은 별도 결정 사항이었으나, 구현계획에서 이 모델로 확정됐다).
# app/config.py의 settings.embedding_model(Retrieve 질의 임베딩)과 반드시 같은 값이어야
# 한다 — 모델을 바꾸려면 두 곳을 함께 고치고 전체 재적재해야 한다(환경변수 override 없음).
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
# OpenAI embeddings API는 한 요청에 여러 입력을 배치로 보낼 수 있다. 이 포트폴리오
# 데이터 규모(Section 20개 내외)에서는 사실상 배치 1회로 끝나지만, 데이터가 늘어나도
# 안전하도록 상한을 둔다.
EMBEDDING_BATCH_SIZE = 100

# "00_GraphRAG 스키마 설계.md"의 "## Competency" 목록 — data/ 어디에도 파일로 존재하지
# 않는 고정 7개다(02_구현계획.md가 별도 파일을 두지 않기로 확정). 이 스크립트 안의
# 상수가 유일한 원본이다. 임의로 추가/삭제하지 않는다(3.4 재검증 완료 사항).
COMPETENCIES: list[str] = [
    "협업",
    "기술적 판단",
    "문제 해결",
    "운영",
    "DevOps",
    "AI 활용",
    "학습 및 성장",
]

# Portfolio/Competency/Technology는 data/에 id 필드가 없다(Portfolio는 싱글턴이라 파일
# 자체가 없고, Competency는 위 상수가 원본, Technology는 technology-aliases.json에 canonical
# 이름만 있고 id가 없다). 이 노드들은 이름 문자열로부터 결정론적 UUID(uuid5)를 파생해
# id로 쓴다 — 재적재할 때마다 같은 이름이면 같은 id가 나오므로 3.2의 "ID 안정성" 취지에
# 맞고, 별도로 id를 파일에 저장/관리할 필요가 없다.
_ID_NAMESPACE = uuid.UUID("6f6a6e1e-6e35-4c2e-9c1a-9e6f6f4a6b1a")


def stable_id(*parts: str) -> str:
    return str(uuid.uuid5(_ID_NAMESPACE, ":".join(parts)))


PORTFOLIO_ID = stable_id("portfolio")
PORTFOLIO_NAME = "Portfolio"


# ---------------------------------------------------------------------------
# 환경변수
# ---------------------------------------------------------------------------


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"환경변수 {name}가 설정되지 않았습니다. Neo4j 연결 정보(NEO4J_URI/NEO4J_USER/"
            "NEO4J_PASSWORD)와 OPENAI_API_KEY가 모두 필요합니다 — 임베딩 없는 Section이 "
            "그래프에 올라가면 안 되므로(01_설계.md 3.3) 키가 없으면 조용히 건너뛰지 않고 "
            "여기서 즉시 실패합니다."
        )
    return value


# ---------------------------------------------------------------------------
# 데이터 로딩
# ---------------------------------------------------------------------------


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_profile() -> dict:
    return load_json(PROFILE_PATH)


def load_projects() -> list[dict]:
    """data/projects/*.json 전부를 읽어 order 필드 기준으로 정렬한다."""
    paths = sorted(PROJECTS_DIR.glob("*.json"))
    if not paths:
        raise RuntimeError(f"{PROJECTS_DIR}에 프로젝트 JSON 파일이 없습니다.")
    projects = [load_json(p) for p in paths]
    projects.sort(key=lambda p: p["order"])
    return projects


def load_cases_for_slug(slug: str) -> list[dict]:
    """data/rag/cases/{slug}.json — 해당 프로젝트에 Case가 하나도 없으면 파일이 없을 수
    있으므로(3.2 — Case가 없는 Section도 존재 가능) 빈 리스트로 취급한다."""
    path = CASES_DIR / f"{slug}.json"
    if not path.exists():
        return []
    return load_json(path)


def load_technology_aliases() -> list[dict]:
    return load_json(TECH_ALIASES_PATH)


# ---------------------------------------------------------------------------
# 기술명 정규화 (4장 4번)
# ---------------------------------------------------------------------------


def build_technology_lookup(aliases: list[dict]) -> dict[str, tuple[str, str]]:
    """소문자 정규화된 이름(canonical 및 모든 alias) → (canonical, category)."""
    lookup: dict[str, tuple[str, str]] = {}
    for entry in aliases:
        canonical = entry["canonical"]
        category = entry["category"]
        names = [canonical, *entry.get("aliases", [])]
        for name in names:
            key = name.strip().lower()
            if key in lookup and lookup[key][0] != canonical:
                raise ValueError(
                    f"data/rag/technology-aliases.json에서 '{name}'이 서로 다른 canonical에 "
                    f"중복 매핑됩니다: '{lookup[key][0]}' vs '{canonical}'."
                )
            lookup[key] = (canonical, category)
    return lookup


def normalize_technology(
    raw_name: str, lookup: dict[str, tuple[str, str]]
) -> tuple[str, str]:
    key = raw_name.strip().lower()
    if key not in lookup:
        raise ValueError(
            f"'{raw_name}'을 data/rag/technology-aliases.json에서 찾을 수 없습니다. "
            "alias 테이블에 canonical 또는 alias로 등록한 뒤 다시 실행하세요(4장 4번)."
        )
    return lookup[key]


# ---------------------------------------------------------------------------
# Overview Section body 조합 (3.2, 4장 3번)
#
# apps/web/components/domains/project/ProjectOverview.tsx가 화면에서 조합하는 것과 같은
# 필드·순서를 그대로 따른다: summary → 기간/팀 구성/담당/기술 스택/결과 → (있을 때만)
# repositoryNotice. project.name은 Section.title로 이미 표현되므로(3.2 — "Overview
# Section의 title은 프로젝트 이름을 그대로 쓴다") body 안에서 다시 반복하지 않는다.
# ---------------------------------------------------------------------------


def build_overview_body(project: dict) -> str:
    lines = [
        project["summary"],
        "",
        f"기간: {project['period']}",
        f"팀 구성: {project['teamSize']}",
        f"담당: {', '.join(project['roles'])}",
        f"기술 스택: {', '.join(project['technologies'])}",
        f"결과: {project['result']}",
    ]
    body = "\n".join(lines)

    repository_notice = project.get("repositoryNotice")
    if repository_notice:
        body = f"{body}\n\n{repository_notice}"

    return body


def build_overview_section(project: dict) -> dict:
    slug = project["slug"]
    return {
        "id": stable_id("overview", slug),
        "title": project["name"],
        "body": build_overview_body(project),
        "path": f"/projects/{slug}",
        "anchor": "overview",
        "order": 0,
        "searchable": False,
    }


# ---------------------------------------------------------------------------
# 검증 (Neo4j에 손대기 전에 전부 수행 — 실패 시 기존 그래프를 그대로 보존한다)
# ---------------------------------------------------------------------------


def validate_and_assemble(
    profile: dict,
    projects: list[dict],
    cases_by_slug: dict[str, list[dict]],
    tech_lookup: dict[str, tuple[str, str]],
) -> dict:
    """data/ 전체를 순회하며 참조 무결성을 검증하고, DB에 쓸 형태로 조립한다."""

    project_slugs = {p["slug"] for p in projects}

    # 1) Section 전체 목록 (Home Profile Section + 프로젝트별 Overview + H2)
    all_sections: list[dict] = [dict(profile)]
    project_overview_by_slug: dict[str, dict] = {}
    for project in projects:
        slug = project["slug"]
        overview = build_overview_section(project)
        project_overview_by_slug[slug] = overview
        all_sections.append(overview)
        for section in project["sections"]:
            all_sections.append({**section, "path": f"/projects/{slug}"})

    section_ids = {s["id"] for s in all_sections}
    if len(section_ids) != len(all_sections):
        raise ValueError("Section id가 중복됩니다 — data/ 전체에서 id가 유일해야 합니다.")

    # 2) BUILDS_ON 검증: buildsOnProjectSlug가 실제 존재하는 프로젝트인지,
    #    buildsOnEvidenceSectionIds가 실제 존재하는 Section인지 (3.1, 4장 3번)
    for project in projects:
        target_slug = project.get("buildsOnProjectSlug")
        if target_slug is not None and target_slug not in project_slugs:
            raise ValueError(
                f"{project['slug']}.buildsOnProjectSlug='{target_slug}'가 가리키는 "
                "프로젝트가 data/projects/에 없습니다."
            )
        for section_id in project.get("buildsOnEvidenceSectionIds", []):
            if section_id not in section_ids:
                raise ValueError(
                    f"{project['slug']}.buildsOnEvidenceSectionIds에 존재하지 않는 "
                    f"Section id '{section_id}'가 있습니다."
                )
        if target_slug is None and project.get("buildsOnEvidenceSectionIds"):
            raise ValueError(
                f"{project['slug']}는 buildsOnProjectSlug가 없는데 "
                "buildsOnEvidenceSectionIds만 채워져 있습니다(3.1 근거 불일치)."
            )

    # 3) Case 검증: competencies는 정의된 7개 안에서만, sectionIds는 실제 Section,
    #    influencedByCaseIds는 실제(다른 프로젝트 포함 가능) Case id (3.1, 4장 2번)
    all_case_ids: set[str] = set()
    for slug, cases in cases_by_slug.items():
        for case in cases:
            if case["id"] in all_case_ids:
                raise ValueError(f"Case id가 중복됩니다: {case['id']}")
            all_case_ids.add(case["id"])

    for slug, cases in cases_by_slug.items():
        for case in cases:
            if not case.get("sectionIds"):
                raise ValueError(
                    f"{slug}/{case['id']}({case['title']})는 sectionIds가 비어 있습니다 — "
                    "모든 Case는 최소 하나의 Section을 가져야 합니다(00_기획.md 제약)."
                )
            for section_id in case["sectionIds"]:
                if section_id not in section_ids:
                    raise ValueError(
                        f"{slug}/{case['id']}.sectionIds에 존재하지 않는 Section id "
                        f"'{section_id}'가 있습니다."
                    )
            unknown_competencies = [
                c for c in case.get("competencies", []) if c not in COMPETENCIES
            ]
            if unknown_competencies:
                raise ValueError(
                    f"{slug}/{case['id']}가 정의되지 않은 Competency를 참조합니다: "
                    f"{unknown_competencies} (허용 목록: {COMPETENCIES})"
                )
            for tech in case.get("usedTechnologies", []):
                normalize_technology(tech, tech_lookup)  # 존재하지 않으면 여기서 예외 발생
            for tech in case.get("consideredTechnologies", []):
                normalize_technology(tech, tech_lookup)
            for prev_id in case.get("influencedByCaseIds", []):
                if prev_id not in all_case_ids:
                    raise ValueError(
                        f"{slug}/{case['id']}.influencedByCaseIds가 존재하지 않는 Case id "
                        f"'{prev_id}'를 참조합니다."
                    )

    # 4) Technology 검증: Project.technologies도 alias 테이블에 있어야 함
    canonical_technologies: dict[str, str] = {}
    for project in projects:
        for tech in project["technologies"]:
            canonical, category = normalize_technology(tech, tech_lookup)
            canonical_technologies[canonical] = category
    for cases in cases_by_slug.values():
        for case in cases:
            for tech in [
                *case.get("usedTechnologies", []),
                *case.get("consideredTechnologies", []),
            ]:
                canonical, category = normalize_technology(tech, tech_lookup)
                canonical_technologies[canonical] = category

    return {
        "all_sections": all_sections,
        "project_overview_by_slug": project_overview_by_slug,
        "canonical_technologies": canonical_technologies,
    }


# ---------------------------------------------------------------------------
# 임베딩 (3.3 — searchable=true인 Section.body만 대상)
# ---------------------------------------------------------------------------


def fetch_embeddings(client: OpenAI, texts: list[str]) -> list[list[float]]:
    embeddings: list[list[float]] = []
    for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch = texts[start : start + EMBEDDING_BATCH_SIZE]
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
        # OpenAI는 입력 순서대로 응답한다고 문서화돼 있지만, index로 한 번 더 정렬해
        # batch 안에서의 순서 보장을 스크립트 쪽에서도 명시적으로 강제한다.
        for item in sorted(response.data, key=lambda d: d.index):
            if len(item.embedding) != EMBEDDING_DIMENSIONS:
                raise RuntimeError(
                    f"OpenAI가 반환한 임베딩 차원이 {len(item.embedding)}로, "
                    f"schema.cypher의 벡터 인덱스 차원({EMBEDDING_DIMENSIONS})과 다릅니다."
                )
            embeddings.append(item.embedding)
    return embeddings


def compute_section_embeddings(
    client: OpenAI, all_sections: list[dict]
) -> dict[str, list[float]]:
    searchable_sections = [s for s in all_sections if s["searchable"]]
    if not searchable_sections:
        return {}
    texts = [s["body"] for s in searchable_sections]
    embeddings = fetch_embeddings(client, texts)
    return {
        section["id"]: embedding
        for section, embedding in zip(searchable_sections, embeddings)
    }


# ---------------------------------------------------------------------------
# Neo4j 적재
# ---------------------------------------------------------------------------


def apply_schema(session: Session) -> None:
    text = SCHEMA_CYPHER_PATH.read_text(encoding="utf-8")
    for raw_statement in text.split(";"):
        cleaned = "\n".join(
            line
            for line in raw_statement.splitlines()
            if not line.strip().startswith("//")
        ).strip()
        if cleaned:
            session.run(cleaned)


# 아래 create_*/wipe_graph 함수는 모두 _rebuild_graph 트랜잭션 함수 안에서만 호출된다
# (ManagedTransaction도 Session과 동일한 .run() 인터페이스를 가지므로 그대로 재사용한다) —
# wipe부터 마지막 관계 생성까지 전체를 하나의 명시적 쓰기 트랜잭션으로 묶어, 도중에 예외가
# 나면 아무 것도 커밋되지 않고 기존 그래프가 그대로 보존되게 한다(전체 삭제만 되고 재생성은
# 되지 않은 반쪽 상태를 방지). 스키마(제약조건/벡터 인덱스)는 Neo4j 규칙상 데이터 쓰기와
# 같은 트랜잭션에 섞을 수 없어 apply_schema()에서 별도로(각 statement별 auto-commit) 처리한다.


def wipe_graph(tx: ManagedTransaction) -> None:
    # 02_구현계획.md 0장 확정: 재적재는 전체 삭제 후 재생성.
    tx.run("MATCH (n) DETACH DELETE n")


def create_portfolio(tx: ManagedTransaction) -> None:
    tx.run(
        "MERGE (p:Portfolio {id: $id}) SET p.name = $name",
        id=PORTFOLIO_ID,
        name=PORTFOLIO_NAME,
    )


def create_competencies(tx: ManagedTransaction) -> dict[str, str]:
    ids: dict[str, str] = {}
    for name in COMPETENCIES:
        competency_id = stable_id("competency", name)
        tx.run(
            "MERGE (c:Competency {id: $id}) SET c.name = $name",
            id=competency_id,
            name=name,
        )
        ids[name] = competency_id
    return ids


def create_technologies(
    tx: ManagedTransaction, canonical_technologies: dict[str, str]
) -> dict[str, str]:
    ids: dict[str, str] = {}
    for canonical, category in canonical_technologies.items():
        technology_id = stable_id("technology", canonical)
        tx.run(
            "MERGE (t:Technology {id: $id}) SET t.name = $name, t.category = $category",
            id=technology_id,
            name=canonical,
            category=category,
        )
        ids[canonical] = technology_id
    return ids


def create_section(
    tx: ManagedTransaction, section: dict, embedding: list[float] | None
) -> None:
    tx.run(
        """
        MERGE (s:Section {id: $id})
        SET s.title = $title,
            s.body = $body,
            s.path = $path,
            s.anchor = $anchor,
            s.order = $order,
            s.searchable = $searchable,
            s.embedding = $embedding
        """,
        id=section["id"],
        title=section["title"],
        body=section["body"],
        path=section["path"],
        anchor=section["anchor"],
        order=section["order"],
        searchable=section["searchable"],
        embedding=embedding,
    )


def create_profile_relationships(tx: ManagedTransaction, profile_section_id: str) -> None:
    # (Portfolio)-[:HAS_SECTION]->(Home Profile Section) — 3.2
    tx.run(
        """
        MATCH (p:Portfolio {id: $portfolio_id}), (s:Section {id: $section_id})
        MERGE (p)-[:HAS_SECTION]->(s)
        """,
        portfolio_id=PORTFOLIO_ID,
        section_id=profile_section_id,
    )


def create_project(tx: ManagedTransaction, project: dict) -> None:
    tx.run(
        """
        MERGE (proj:Project {id: $id})
        SET proj.name = $name,
            proj.slug = $slug,
            proj.summary = $summary,
            proj.period = $period,
            proj.teamSize = $teamSize,
            proj.roles = $roles,
            proj.result = $result,
            proj.repositoryVisibility = $repositoryVisibility,
            proj.order = $order
        """,
        id=project["id"],
        name=project["name"],
        slug=project["slug"],
        summary=project["summary"],
        period=project["period"],
        teamSize=project["teamSize"],
        roles=project["roles"],
        result=project["result"],
        repositoryVisibility=project["repositoryVisibility"],
        order=project["order"],
    )
    # (Portfolio)-[:HAS_PROJECT]->(Project)
    tx.run(
        """
        MATCH (p:Portfolio {id: $portfolio_id}), (proj:Project {id: $project_id})
        MERGE (p)-[:HAS_PROJECT]->(proj)
        """,
        portfolio_id=PORTFOLIO_ID,
        project_id=project["id"],
    )


def create_project_has_section(
    tx: ManagedTransaction, project_id: str, section_id: str
) -> None:
    tx.run(
        """
        MATCH (proj:Project {id: $project_id}), (s:Section {id: $section_id})
        MERGE (proj)-[:HAS_SECTION]->(s)
        """,
        project_id=project_id,
        section_id=section_id,
    )


def create_project_uses_technology(
    tx: ManagedTransaction,
    project_id: str,
    raw_tech: str,
    tech_lookup: dict[str, tuple[str, str]],
    technology_ids: dict[str, str],
) -> None:
    canonical, _category = normalize_technology(raw_tech, tech_lookup)
    tx.run(
        """
        MATCH (proj:Project {id: $project_id}), (t:Technology {id: $technology_id})
        MERGE (proj)-[:USES]->(t)
        """,
        project_id=project_id,
        technology_id=technology_ids[canonical],
    )


def create_builds_on(
    tx: ManagedTransaction,
    project: dict,
    project_id_by_slug: dict[str, str],
) -> None:
    target_slug = project.get("buildsOnProjectSlug")
    if target_slug is None:
        return
    # 3.1: (이후 프로젝트)-[:BUILDS_ON]->(이전 프로젝트). evidenceSectionIds property는
    # data/의 buildsOnEvidenceSectionIds 원본으로부터 재적재 때마다 채워지는 복제본이다(3번).
    tx.run(
        """
        MATCH (later:Project {id: $later_id}), (earlier:Project {id: $earlier_id})
        MERGE (later)-[r:BUILDS_ON]->(earlier)
        SET r.evidenceSectionIds = $evidence_section_ids
        """,
        later_id=project["id"],
        earlier_id=project_id_by_slug[target_slug],
        evidence_section_ids=project.get("buildsOnEvidenceSectionIds", []),
    )


def create_case(tx: ManagedTransaction, case: dict) -> None:
    props: dict[str, Any] = {
        "id": case["id"],
        "title": case["title"],
        "summary": case["summary"],
        "order": case["order"],
    }
    for optional_field in ("problem", "judgment", "action", "result", "learning"):
        value = case.get(optional_field)
        if value is not None:
            props[optional_field] = value
    tx.run(
        "MERGE (c:Case {id: $id}) SET c += $props",
        id=case["id"],
        props=props,
    )


def create_case_relationships(
    tx: ManagedTransaction,
    case: dict,
    project_id: str,
    tech_lookup: dict[str, tuple[str, str]],
    technology_ids: dict[str, str],
    competency_ids: dict[str, str],
) -> None:
    # (Project)-[:HAS_CASE]->(Case)
    tx.run(
        """
        MATCH (proj:Project {id: $project_id}), (c:Case {id: $case_id})
        MERGE (proj)-[:HAS_CASE]->(c)
        """,
        project_id=project_id,
        case_id=case["id"],
    )

    # (Case)-[:DESCRIBED_IN]->(Section) — 최소 1개 이상(validate_and_assemble에서 이미 보장)
    for section_id in case["sectionIds"]:
        tx.run(
            """
            MATCH (c:Case {id: $case_id}), (s:Section {id: $section_id})
            MERGE (c)-[:DESCRIBED_IN]->(s)
            """,
            case_id=case["id"],
            section_id=section_id,
        )

    # (Case)-[:DEMONSTRATES]->(Competency)
    for competency_name in case.get("competencies", []):
        tx.run(
            """
            MATCH (c:Case {id: $case_id}), (comp:Competency {id: $competency_id})
            MERGE (c)-[:DEMONSTRATES]->(comp)
            """,
            case_id=case["id"],
            competency_id=competency_ids[competency_name],
        )

    # (Case)-[:USES]->(Technology) — 지원자 본인의 직접 기여로 확인된 기술만(4장 2번)
    for raw_tech in case.get("usedTechnologies", []):
        canonical, _category = normalize_technology(raw_tech, tech_lookup)
        tx.run(
            """
            MATCH (c:Case {id: $case_id}), (t:Technology {id: $technology_id})
            MERGE (c)-[:USES]->(t)
            """,
            case_id=case["id"],
            technology_id=technology_ids[canonical],
        )

    # (Case)-[:CONSIDERED]->(Technology) — 검토했지만 채택하지 않은 기술
    for raw_tech in case.get("consideredTechnologies", []):
        canonical, _category = normalize_technology(raw_tech, tech_lookup)
        tx.run(
            """
            MATCH (c:Case {id: $case_id}), (t:Technology {id: $technology_id})
            MERGE (c)-[:CONSIDERED]->(t)
            """,
            case_id=case["id"],
            technology_id=technology_ids[canonical],
        )


def create_influenced_relationships(tx: ManagedTransaction, all_cases: list[dict]) -> None:
    # (이전 Case)-[:INFLUENCED]->(이후 Case) — 3.1에서 확정한 방향. 다른 프로젝트의 Case를
    # 참조할 수 있으므로(예: DailyBand Case가 Home Server Case를 참조) 모든 Case 노드가
    # 이미 생성된 뒤 마지막 단계에서 한 번에 처리한다.
    for case in all_cases:
        for previous_case_id in case.get("influencedByCaseIds", []):
            tx.run(
                """
                MATCH (previous:Case {id: $previous_id}), (current:Case {id: $current_id})
                MERGE (previous)-[:INFLUENCED]->(current)
                """,
                previous_id=previous_case_id,
                current_id=case["id"],
            )


def _rebuild_graph(
    tx: ManagedTransaction,
    *,
    profile: dict,
    projects: list[dict],
    cases_by_slug: dict[str, list[dict]],
    all_cases: list[dict],
    project_overview_by_slug: dict[str, dict],
    canonical_technologies: dict[str, str],
    tech_lookup: dict[str, tuple[str, str]],
    embedding_by_section_id: dict[str, list[float]],
) -> None:
    """전체 삭제 후 재생성 전체를 단일 트랜잭션으로 실행하는 함수(session.execute_write 대상)."""

    wipe_graph(tx)

    create_portfolio(tx)
    competency_ids = create_competencies(tx)
    technology_ids = create_technologies(tx, canonical_technologies)

    # Home Profile Section
    profile_embedding = embedding_by_section_id.get(profile["id"])
    create_section(tx, profile, profile_embedding)
    create_profile_relationships(tx, profile["id"])

    project_id_by_slug = {project["slug"]: project["id"] for project in projects}

    for project in projects:
        slug = project["slug"]
        create_project(tx, project)

        # Overview Section (자동 생성, embedding 없음 — searchable=false)
        overview = project_overview_by_slug[slug]
        create_section(tx, overview, embedding=None)
        create_project_has_section(tx, project["id"], overview["id"])

        # H2 Section들
        for section in project["sections"]:
            section_with_path = {**section, "path": f"/projects/{slug}"}
            embedding = embedding_by_section_id.get(section["id"])
            create_section(tx, section_with_path, embedding)
            create_project_has_section(tx, project["id"], section["id"])

        # (Project)-[:USES]->(Technology)
        for raw_tech in project["technologies"]:
            create_project_uses_technology(
                tx, project["id"], raw_tech, tech_lookup, technology_ids
            )

    # (Project)-[:BUILDS_ON]->(Project) — 모든 Project 노드가 생성된 뒤에 연결
    for project in projects:
        create_builds_on(tx, project, project_id_by_slug)

    # Case 노드 생성
    for project in projects:
        for case in cases_by_slug[project["slug"]]:
            create_case(tx, case)

    # Case 관계 생성 (HAS_CASE/DESCRIBED_IN/DEMONSTRATES/USES/CONSIDERED)
    for project in projects:
        for case in cases_by_slug[project["slug"]]:
            create_case_relationships(
                tx,
                case,
                project["id"],
                tech_lookup,
                technology_ids,
                competency_ids,
            )

    # (이전 Case)-[:INFLUENCED]->(이후 Case) — 프로젝트 경계를 넘나들 수 있으므로
    # 모든 Case 노드가 생성된 뒤 마지막에 처리
    create_influenced_relationships(tx, all_cases)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main() -> None:
    # 1) 환경변수 — 조용히 건너뛰지 않고 즉시 실패(3.3 요구사항)
    neo4j_uri = require_env("NEO4J_URI")
    neo4j_user = require_env("NEO4J_USER")
    neo4j_password = require_env("NEO4J_PASSWORD")
    openai_api_key = require_env("OPENAI_API_KEY")

    # 2) 데이터 로딩 + 검증 (Neo4j 연결 전에 전부 수행)
    print("[1/6] data/ 로딩 및 검증 중...")
    profile = load_profile()
    projects = load_projects()
    tech_aliases = load_technology_aliases()
    tech_lookup = build_technology_lookup(tech_aliases)

    cases_by_slug: dict[str, list[dict]] = {
        project["slug"]: load_cases_for_slug(project["slug"]) for project in projects
    }

    assembled = validate_and_assemble(profile, projects, cases_by_slug, tech_lookup)
    all_sections: list[dict] = assembled["all_sections"]
    project_overview_by_slug: dict[str, dict] = assembled["project_overview_by_slug"]
    canonical_technologies: dict[str, str] = assembled["canonical_technologies"]

    all_cases: list[dict] = [case for cases in cases_by_slug.values() for case in cases]

    print(
        f"  - Project {len(projects)}개, Section {len(all_sections)}개"
        f"(Overview {len(project_overview_by_slug)}개 포함), Case {len(all_cases)}개, "
        f"Technology {len(canonical_technologies)}개"
    )

    # 3) 임베딩 생성 (searchable=true인 Section.body만) — 역시 Neo4j를 건드리기 전에 수행
    searchable_count = sum(1 for s in all_sections if s["searchable"])
    print(f"[2/6] OpenAI 임베딩 생성 중... (searchable Section {searchable_count}개)")
    openai_client = OpenAI(api_key=openai_api_key)
    embedding_by_section_id = compute_section_embeddings(openai_client, all_sections)
    if len(embedding_by_section_id) != searchable_count:
        raise RuntimeError(
            "임베딩 생성 개수가 searchable Section 개수와 다릅니다 — "
            f"기대 {searchable_count}, 실제 {len(embedding_by_section_id)}."
        )

    # 4) Neo4j 연결
    print(f"[3/6] Neo4j 연결 중... ({neo4j_uri})")
    driver: Driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))
    driver.verify_connectivity()

    try:
        with driver.session() as session:
            # 5) 스키마(제약조건 + 벡터 인덱스) 적용 — Neo4j는 스키마 변경을 데이터 쓰기와
            # 같은 트랜잭션에 섞을 수 없으므로 아래 execute_write와 별도로, 각 statement가
            # 개별 auto-commit 트랜잭션으로 실행된다(멱등 — IF NOT EXISTS).
            print("[4/6] schema.cypher 적용 중...")
            apply_schema(session)

            # 6) 전체 삭제 후 재생성 (0장 확정 사항)을 하나의 명시적 쓰기 트랜잭션으로 실행한다.
            # 중간에 예외가 발생하면 전체가 롤백되어 이전 그래프가 그대로 보존된다 — wipe만
            # 커밋되고 재생성은 안 된 반쪽 상태를 방지하기 위함이다.
            print("[5/6]~[6/6] 기존 그래프 삭제 후 전체 재생성 중 (단일 트랜잭션)...")
            session.execute_write(
                _rebuild_graph,
                profile=profile,
                projects=projects,
                cases_by_slug=cases_by_slug,
                all_cases=all_cases,
                project_overview_by_slug=project_overview_by_slug,
                canonical_technologies=canonical_technologies,
                tech_lookup=tech_lookup,
                embedding_by_section_id=embedding_by_section_id,
            )

    finally:
        driver.close()

    print("완료: Neo4j 그래프를 data/로부터 전체 재생성했습니다.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - 스크립트 최상위에서 원인을 그대로 노출
        print(f"적재 실패: {exc}", file=sys.stderr)
        sys.exit(1)
