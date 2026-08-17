"""apps/ai-server/app/graph/technology_aliases.py

Retrieve가 Extract의 자유 텍스트 technologies를 canonical Technology 이름으로 정규화할
때 쓰는 alias→canonical 조회 테이블이다. scripts/load_graph.py가 적재 시점에 쓰는
data/rag/technology-aliases.json을 그대로 재사용한다 — 01_설계.md 4장 4번: "[Retrieve]의
technologies 매칭도 이 테이블을 동일하게 거친다". 새 매핑 로직을 여기서 다시
발명하지 않는다.
"""
from __future__ import annotations

import json
from functools import lru_cache

from app.config import DATA_DIR

TECH_ALIASES_PATH = DATA_DIR / "rag" / "technology-aliases.json"


@lru_cache(maxsize=1)
def _lookup() -> dict[str, str]:
    """소문자 정규화된 이름(canonical 및 모든 alias) → canonical.

    scripts/load_graph.py의 build_technology_lookup()과 동일한 규칙(strip + lower
    비교)을 쓴다 — 여기서 규칙이 달라지면 적재 시점 매칭과 조회 시점 매칭이 어긋난다.
    """
    with TECH_ALIASES_PATH.open("r", encoding="utf-8") as f:
        entries = json.load(f)

    lookup: dict[str, str] = {}
    for entry in entries:
        canonical = entry["canonical"]
        for name in [canonical, *entry.get("aliases", [])]:
            lookup[name.strip().lower()] = canonical
    return lookup


def normalize_technologies(raw_names: list[str]) -> list[str]:
    """Extract가 추출한 자유 텍스트 기술명을 canonical Technology 이름 목록으로 정규화한다.

    scripts/load_graph.py의 normalize_technology()는 alias 테이블에 없는 이름을 만나면
    즉시 예외를 던진다(적재 시점 데이터는 사람이 검수하므로 실패해야 맞다). 반면 여기서
    다루는 입력은 사용자가 채팅창에 입력한 자유 텍스트라 alias 테이블에 없는 임의의
    표현일 수 있다 — 이 경우 예외를 던지지 않고 조용히 그 기술명만 후보에서 제외한다.
    (해당 이름의 Technology 노드 자체가 존재하지 않으므로, 어차피 그래프 매칭 결과는
    0건이 되는 것과 동일한 효과다.)
    """
    lookup = _lookup()
    canonical_names: list[str] = []
    for raw in raw_names:
        canonical = lookup.get(raw.strip().lower())
        if canonical and canonical not in canonical_names:
            canonical_names.append(canonical)
    return canonical_names
