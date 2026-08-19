"""apps/ai-server/app/graph/client.py

Neo4j driver 연결과 [Retrieve] 파이프라인(01_설계.md 2장 [Retrieve] 0)~7))이 사용하는
모든 Cypher 쿼리를 모아둔 모듈. scripts/load_graph.py(Phase 02)와 동일한 환경변수
(NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD)로 연결하며, 그 스크립트가 실제로 적재하는
노드/관계 스키마(01_설계.md 3장, 4장 6번)를 그대로 전제한다 — 새 라벨·속성을 여기서
발명하지 않는다.

노드/관계 요약(load_graph.py 기준):
- Section {id, title, body, path, anchor, order, searchable, embedding}
- Case {id, title, summary, order, problem?, judgment?, action?, result?, learning?}
- Project {id, name, slug, summary, period, teamSize, roles, result,
  repositoryVisibility, order}
- Competency {id, name} / Technology {id, name, category}
- (Portfolio)-[:HAS_PROJECT]->(Project)
- (Portfolio|Project)-[:HAS_SECTION]->(Section)
- (Project)-[:HAS_CASE]->(Case)
- (Case)-[:DESCRIBED_IN]->(Section)
- (Case)-[:DEMONSTRATES]->(Competency)
- (Case)-[:USES]->(Technology), (Project)-[:USES]->(Technology)
- (Case)-[:CONSIDERED]->(Technology)
- (later Project)-[:BUILDS_ON {evidenceSectionIds}]->(earlier Project)
- (previous Case)-[:INFLUENCED]->(current Case)
- 벡터 인덱스: section_embedding_index (Section.embedding, cosine, 1536차원)
"""
from __future__ import annotations

from typing import Any

from neo4j import Driver, GraphDatabase

from app.config import settings

_driver: Driver | None = None


def get_driver() -> Driver:
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
        )
    return _driver


def close_driver() -> None:
    """FastAPI shutdown 훅에서 호출한다 — 커넥션을 명시적으로 정리한다."""
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def _run(query: str, **params: Any) -> list[dict[str, Any]]:
    with get_driver().session() as session:
        result = session.run(query, **params)
        return [record.data() for record in result]


# ---------------------------------------------------------------------------
# 공통: Section(+연결된 Case들 +소속 Project slug) 일괄 조회
# [Retrieve] 6): "Case가 있는 Section은 Case 필드까지 ... 스코어링 근거로 함께 사용하고,
# Case가 없는 Section은 body만 사용한다" — 이 조회 하나로 두 경우를 모두 커버한다.
# ---------------------------------------------------------------------------


def fetch_sections_with_cases(section_ids: list[str]) -> list[dict[str, Any]]:
    if not section_ids:
        return []
    return _run(
        """
        MATCH (s:Section)
        WHERE s.id IN $sectionIds
        OPTIONAL MATCH (c:Case)-[:DESCRIBED_IN]->(s)
        OPTIONAL MATCH (proj:Project)-[:HAS_SECTION]->(s)
        WITH s, proj, collect(DISTINCT c) AS caseNodes
        RETURN s.id AS sectionId,
               s.title AS title,
               s.body AS body,
               s.path AS path,
               s.anchor AS anchor,
               s.searchable AS searchable,
               proj.slug AS projectSlug,
               [c IN caseNodes WHERE c IS NOT NULL |
                 c { .id, .title, .summary, .problem, .judgment, .action, .result, .learning }
               ] AS cases
        """,
        sectionIds=section_ids,
    )


# ---------------------------------------------------------------------------
# 0) Overview 후보 (project_hints 유무에 따라 특정/전체 Project의 Overview Section)
# ---------------------------------------------------------------------------


def overview_sections(project_slugs: list[str]) -> list[dict[str, Any]]:
    """project_slugs가 비어 있으면 전체 Project의 Overview Section을 반환한다."""
    return _run(
        """
        MATCH (proj:Project)-[:HAS_SECTION]->(s:Section {anchor: 'overview'})
        WHERE $slugs = [] OR proj.slug IN $slugs
        RETURN s.id AS sectionId, proj.id AS projectId, proj.slug AS projectSlug
        """,
        slugs=project_slugs,
    )


# ---------------------------------------------------------------------------
# 1) 그래프 매칭 (역량/기술)
#
# [Retrieve] 0): "project_hints는 기본 검색 seed·우선 범위로 사용한다(빈 배열이면 특정
# 프로젝트로 좁히지 않음)" — 아래 세 쿼리는 정규화된 project_hints(slug 목록)를 받아
# 기본 검색 범위를 좁힌다. 3)의 성장 관계 탐색만 설계상 이 범위 밖으로 확장될 수 있다.
# ---------------------------------------------------------------------------


def cases_by_competencies(
    names: list[str], project_slugs: list[str]
) -> list[dict[str, Any]]:
    if not names:
        return []
    return _run(
        """
        MATCH (c:Case)-[:DEMONSTRATES]->(comp:Competency)
        WHERE comp.name IN $names
        MATCH (c)-[:DESCRIBED_IN]->(s:Section)
        MATCH (proj:Project)-[:HAS_CASE]->(c)
        WHERE $slugs = [] OR proj.slug IN $slugs
        RETURN DISTINCT s.id AS sectionId, proj.id AS projectId,
               proj.slug AS projectSlug, c.id AS caseId
        """,
        names=names,
        slugs=project_slugs,
    )


def cases_by_technologies_uses(
    canonical_names: list[str], project_slugs: list[str]
) -> list[dict[str, Any]]:
    if not canonical_names:
        return []
    return _run(
        """
        MATCH (c:Case)-[:USES]->(t:Technology)
        WHERE t.name IN $names
        MATCH (c)-[:DESCRIBED_IN]->(s:Section)
        MATCH (proj:Project)-[:HAS_CASE]->(c)
        WHERE $slugs = [] OR proj.slug IN $slugs
        RETURN DISTINCT s.id AS sectionId, proj.id AS projectId,
               proj.slug AS projectSlug, c.id AS caseId
        """,
        names=canonical_names,
        slugs=project_slugs,
    )


def projects_by_technologies_uses(
    canonical_names: list[str], project_slugs: list[str]
) -> list[dict[str, Any]]:
    """(Project)-[:USES]->(Technology)로 매칭된 Project의 Overview Section을 반환한다."""
    if not canonical_names:
        return []
    return _run(
        """
        MATCH (proj:Project)-[:USES]->(t:Technology)
        WHERE t.name IN $names AND ($slugs = [] OR proj.slug IN $slugs)
        MATCH (proj)-[:HAS_SECTION]->(s:Section {anchor: 'overview'})
        RETURN DISTINCT s.id AS sectionId, proj.id AS projectId, proj.slug AS projectSlug
        """,
        names=canonical_names,
        slugs=project_slugs,
    )


# ---------------------------------------------------------------------------
# 2) 대안 비교 매칭 (CONSIDERED)
# ---------------------------------------------------------------------------


def cases_by_technologies_considered(
    canonical_names: list[str], project_slugs: list[str]
) -> list[dict[str, Any]]:
    """[Retrieve] 0)의 기본 검색 우선 범위(project_hints)를 여기에도 동일하게 적용한다."""
    if not canonical_names:
        return []
    return _run(
        """
        MATCH (c:Case)-[:CONSIDERED]->(t:Technology)
        WHERE t.name IN $names
        MATCH (c)-[:DESCRIBED_IN]->(s:Section)
        MATCH (proj:Project)-[:HAS_CASE]->(c)
        WHERE $slugs = [] OR proj.slug IN $slugs
        RETURN DISTINCT s.id AS sectionId, proj.id AS projectId,
               proj.slug AS projectSlug, c.id AS caseId
        """,
        names=canonical_names,
        slugs=project_slugs,
    )


def cases_with_any_considered(project_slugs: list[str]) -> list[dict[str, Any]]:
    """technologies가 없을 때: CONSIDERED 관계를 가진 Case 전체(project_hints로 범위 좁힘)."""
    return _run(
        """
        MATCH (c:Case)-[:CONSIDERED]->(:Technology)
        MATCH (c)-[:DESCRIBED_IN]->(s:Section)
        MATCH (proj:Project)-[:HAS_CASE]->(c)
        WHERE $slugs = [] OR proj.slug IN $slugs
        RETURN DISTINCT s.id AS sectionId, proj.id AS projectId,
               proj.slug AS projectSlug, c.id AS caseId
        """,
        slugs=project_slugs,
    )


# ---------------------------------------------------------------------------
# 3) 성장/연결 매칭 (INFLUENCED / BUILDS_ON)
# ---------------------------------------------------------------------------


def growth_influenced_from_seed_cases(case_ids: list[str]) -> list[dict[str, Any]]:
    """seed Case에서 INFLUENCED를 양방향 1-hop 확장한다(이전→이후 어느 쪽 seed든 확장)."""
    if not case_ids:
        return []
    return _run(
        """
        MATCH (seed:Case) WHERE seed.id IN $caseIds
        MATCH (seed)-[:INFLUENCED]-(other:Case)
        MATCH (other)-[:DESCRIBED_IN]->(s:Section)
        MATCH (proj:Project)-[:HAS_CASE]->(other)
        RETURN DISTINCT s.id AS sectionId, proj.id AS projectId,
               proj.slug AS projectSlug, other.id AS caseId
        """,
        caseIds=case_ids,
    )


def growth_builds_on_from_seed_projects(project_slugs: list[str]) -> list[dict[str, Any]]:
    """seed Project에서 BUILDS_ON을 양방향 1-hop 확장하고, 관계의 evidenceSectionIds를
    근거 Section id 목록으로 반환한다(Project 노드 자체는 근거가 아니므로, 3.1/4장 3번
    에 따라 이 property를 거쳐야 Generate가 받을 수 있는 근거로 이어진다)."""
    if not project_slugs:
        return []
    return _run(
        """
        MATCH (seed:Project) WHERE seed.slug IN $slugs
        MATCH (seed)-[r:BUILDS_ON]-(other:Project)
        RETURN DISTINCT other.id AS projectId, other.slug AS projectSlug,
               r.evidenceSectionIds AS evidenceSectionIds
        """,
        slugs=project_slugs,
    )


def growth_influenced_all(project_slugs: list[str]) -> list[dict[str, Any]]:
    """seed가 없을 때: INFLUENCED 관계 자체를 순회한다(project_hints로 범위 좁힘)."""
    return _run(
        """
        MATCH (prev:Case)-[:INFLUENCED]->(curr:Case)
        MATCH (prev)-[:DESCRIBED_IN]->(ps:Section)
        MATCH (curr)-[:DESCRIBED_IN]->(cs:Section)
        MATCH (pproj:Project)-[:HAS_CASE]->(prev)
        MATCH (cproj:Project)-[:HAS_CASE]->(curr)
        WHERE $slugs = [] OR pproj.slug IN $slugs OR cproj.slug IN $slugs
        RETURN DISTINCT
          ps.id AS prevSectionId, pproj.id AS prevProjectId,
          pproj.slug AS prevProjectSlug, prev.id AS prevCaseId,
          cs.id AS currSectionId, cproj.id AS currProjectId,
          cproj.slug AS currProjectSlug, curr.id AS currCaseId
        """,
        slugs=project_slugs,
    )


def growth_builds_on_all(project_slugs: list[str]) -> list[dict[str, Any]]:
    """seed가 없을 때: BUILDS_ON 관계 자체를 순회한다(project_hints로 범위 좁힘)."""
    return _run(
        """
        MATCH (later:Project)-[r:BUILDS_ON]->(earlier:Project)
        WHERE $slugs = [] OR later.slug IN $slugs OR earlier.slug IN $slugs
        RETURN DISTINCT later.id AS laterId, later.slug AS laterSlug,
               earlier.id AS earlierId, earlier.slug AS earlierSlug,
               r.evidenceSectionIds AS evidenceSectionIds
        """,
        slugs=project_slugs,
    )


# ---------------------------------------------------------------------------
# 4) 벡터 매칭
# ---------------------------------------------------------------------------


def vector_search(
    embedding: list[float], k: int, project_slugs: list[str]
) -> list[dict[str, Any]]:
    """Overview는 embedding이 없으므로(searchable=false) 벡터 인덱스에 애초에
    잡히지 않는다 — 별도 필터 없이도 3.2/3.3의 "Overview는 벡터 검색 대상 아님"이
    자동으로 보장된다.

    [Retrieve] 0): project_slugs(정규화된 project_hints)가 있으면 벡터 후보도 그
    Project 소속 Section으로 좁힌다 — 기본 검색의 우선 범위. 벡터 인덱스 자체는
    Project를 모르는 전역 인덱스이므로, 범위를 좁힐 때는 후보를 넉넉히 끌어온 뒤
    (fetchK) 소속 Project로 필터링하고 상위 k개만 남긴다.

    Home Profile Section(3.2)은 어떤 Project에도 속하지 않으므로(proj IS NULL) 이
    범위 좁히기의 대상이 아니다 — project_hints는 "어느 프로젝트 이야기인가"를 좁히는
    값이지 "지원자 자신에 대한 근거를 빼라"는 값이 아니고, 3.2가 이 Section을
    searchable=true로 둔 이유 자체가 "이 지원자는 어떤 개발자인가요?" 같은 질문에
    직접 답할 근거를 벡터 검색으로 확보하기 위함이다. 따라서 proj IS NULL인 Section은
    project_hints 유무와 무관하게 벡터 후보로 남긴다(설계 4)에 이 Section을 제외하라는
    규칙은 없다)."""
    fetch_k = k if not project_slugs else k * 4
    return _run(
        """
        CALL db.index.vector.queryNodes('section_embedding_index', $fetchK, $embedding)
        YIELD node, score
        OPTIONAL MATCH (proj:Project)-[:HAS_SECTION]->(node)
        WITH node, score, proj
        WHERE $slugs = [] OR proj IS NULL OR proj.slug IN $slugs
        RETURN node.id AS sectionId, score AS score
        ORDER BY score DESC
        LIMIT $k
        """,
        fetchK=fetch_k,
        k=k,
        embedding=embedding,
        slugs=project_slugs,
    )


# ---------------------------------------------------------------------------
# 5) is_followup / wants_similar_cases
# ---------------------------------------------------------------------------


def similar_cases_by_competency(case_id: str) -> list[dict[str, Any]]:
    """seed Case와 같은 Competency를 가지면서 **다른 Project**에 속한 Case를 찾는다."""
    return _run(
        """
        MATCH (seed:Case {id: $caseId})-[:DEMONSTRATES]->(comp:Competency)
              <-[:DEMONSTRATES]-(other:Case)
        MATCH (seedProj:Project)-[:HAS_CASE]->(seed)
        MATCH (otherProj:Project)-[:HAS_CASE]->(other)
        WHERE otherProj.slug <> seedProj.slug
        MATCH (other)-[:DESCRIBED_IN]->(s:Section)
        RETURN DISTINCT s.id AS sectionId, otherProj.id AS projectId,
               otherProj.slug AS projectSlug, other.id AS caseId
        """,
        caseId=case_id,
    )


def similar_cases_by_technology(case_id: str) -> list[dict[str, Any]]:
    """seed Case와 같은 Technology를 USES 또는 CONSIDERED로 가지면서 **다른 Project**에
    속한 Case를 찾는다."""
    return _run(
        """
        MATCH (seed:Case {id: $caseId})-[:USES|CONSIDERED]->(t:Technology)
              <-[:USES|CONSIDERED]-(other:Case)
        MATCH (seedProj:Project)-[:HAS_CASE]->(seed)
        MATCH (otherProj:Project)-[:HAS_CASE]->(other)
        WHERE otherProj.slug <> seedProj.slug
        MATCH (other)-[:DESCRIBED_IN]->(s:Section)
        RETURN DISTINCT s.id AS sectionId, otherProj.id AS projectId,
               otherProj.slug AS projectSlug, other.id AS caseId
        """,
        caseId=case_id,
    )
