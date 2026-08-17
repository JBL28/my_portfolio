"""apps/ai-server/app/graph/project_hints.py

Retrieve가 Extract의 자유 텍스트 project_hints를 Project.slug로 정규화할 때 쓰는
조회 테이블이다. technology_aliases.py와 동일한 패턴(01_설계.md 4장 4번의 정규화
방식)을 따르되, 별도 데이터 파일을 새로 만들지 않고 이미 존재하는
data/projects/*.json의 name/slug 필드에서 직접 조회 테이블을 구성한다 — project_hints
전용 alias 테이블이 data/에 없으므로, 있는 데이터(Project.name/slug)만으로 매칭한다.
"""
from __future__ import annotations

import json
from functools import lru_cache

from app.config import DATA_DIR

PROJECTS_DIR = DATA_DIR / "projects"


@lru_cache(maxsize=1)
def _lookup() -> dict[str, str]:
    """소문자 정규화된 이름(name 및 slug) → slug.

    각 data/projects/*.json의 name/slug를 각각 strip + lower해 이 값을 가리키는 slug로
    등록한다 — technology_aliases.py의 _lookup()과 동일한 규칙이다.
    """
    lookup: dict[str, str] = {}
    for path in PROJECTS_DIR.glob("*.json"):
        with path.open("r", encoding="utf-8") as f:
            entry = json.load(f)
        slug = entry["slug"]
        for name in [entry["name"], slug]:
            lookup[name.strip().lower()] = slug
    return lookup


def normalize_project_hints(raw_hints: list[str]) -> list[str]:
    """Extract가 추출한 자유 텍스트 프로젝트명을 Project.slug 목록으로 정규화한다.

    normalize_technologies()와 동일하게, 조회 테이블에 없는 이름(사용자가 채팅창에
    입력한 자유 텍스트라 실제 프로젝트명이 아닐 수 있다)을 만나도 예외를 던지지
    않고 조용히 그 힌트만 후보에서 제외한다.
    """
    lookup = _lookup()
    slugs: list[str] = []
    for raw in raw_hints:
        slug = lookup.get(raw.strip().lower())
        if slug and slug not in slugs:
            slugs.append(slug)
    return slugs
