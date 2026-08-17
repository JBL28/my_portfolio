"""apps/ai-server/app/config.py

환경변수 로드. Neo4j 연결 정보는 scripts/load_graph.py(Phase 02)와 동일한 이름
(NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD)을 그대로 재사용한다 — Phase 02와 Phase 03이
서로 다른 이름을 쓰면 배포 환경변수를 이중 관리해야 하므로 통일한다.

이 모듈은 값이 실제로 필요해지는 시점까지 필수 환경변수 검증을 지연한다(OpenAI API
키·Neo4j 자격 증명). load_graph.py의 require_env()와 동일하게 "조용히 건너뛰지 않고
즉시 실패한다"는 원칙을 따르되, import 시점이 아니라 실제 접근 시점에 실패하게 해
스키마 정의만 읽는 코드(예: 유닛 테스트)가 환경변수 부재만으로 깨지지 않게 한다.
"""
from __future__ import annotations

import os
from pathlib import Path

try:
    # python-dotenv가 설치돼 있으면 apps/ai-server/.env를 읽어 환경변수로 반영한다.
    # scripts/load_graph.py와 동일한 선택적 의존성 처리.
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - 선택적 의존성
    pass


# ---------------------------------------------------------------------------
# 경로 — scripts/load_graph.py와 동일한 계산 방식(이 파일 위치 기준 4단계 상위가
# 저장소 루트: app/ -> ai-server/ -> apps/ -> repo root).
# ---------------------------------------------------------------------------

APP_DIR = Path(__file__).resolve().parent
AI_SERVER_DIR = APP_DIR.parent
REPO_ROOT = AI_SERVER_DIR.parent.parent
DATA_DIR = REPO_ROOT / "data"


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"환경변수 {name}가 설정되지 않았습니다. NEO4J_URI/NEO4J_USER/NEO4J_PASSWORD와 "
            "OPENAI_API_KEY가 모두 필요합니다."
        )
    return value


class Settings:
    """앱 전역에서 공유하는 설정 객체. 모듈 하단의 `settings` 싱글턴을 통해 사용한다."""

    # --- OpenAI ---
    @property
    def openai_api_key(self) -> str:
        return _require_env("OPENAI_API_KEY")

    # 01_설계.md 0장: "LLM / Structured Output: OpenAI API · 저비용 모델 우선(구체 모델명은
    # 미정)". gpt-4o-mini를 기본값으로 두되, Gate/Extract/Generate가 서로 다른 모델을 써야
    #할 이유가 생길 수 있어 하나의 변수로 묶지 않고 단계별로 override 가능하게 한다.
    gate_model: str = os.environ.get("OPENAI_MODEL_GATE", "gpt-4o-mini")
    extract_model: str = os.environ.get("OPENAI_MODEL_EXTRACT", "gpt-4o-mini")
    generate_model: str = os.environ.get("OPENAI_MODEL_GENERATE", "gpt-4o-mini")

    # 02_구현계획.md 0장에서 확정: text-embedding-3-small(1536차원). scripts/load_graph.py가
    # 이미 이 모델로 Section.embedding을 만들어뒀으므로, Retrieve의 질의 임베딩도 반드시
    # 같은 모델을 써야 벡터 공간이 일치한다 — 환경변수로 override 가능하게 두더라도 바꾸는
    # 즉시 전체 재적재가 필요하다.
    embedding_model: str = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

    # --- Neo4j (scripts/load_graph.py와 동일한 환경변수명) ---
    @property
    def neo4j_uri(self) -> str:
        return _require_env("NEO4J_URI")

    @property
    def neo4j_user(self) -> str:
        return _require_env("NEO4J_USER")

    @property
    def neo4j_password(self) -> str:
        return _require_env("NEO4J_PASSWORD")

    # --- Retrieve ---
    # 02_구현계획.md 0장에서 N=3(최근 3턴)으로 확정. 대화 이력이 길어질수록 Extract
    # 프롬프트가 커져 비용·지연시간이 늘어난다는 7장의 트레이드오프에 따라 고정값으로
    # 둔다(이미 확정된 설계 값이므로 배포 시점에 바꿀 이유가 없어 환경변수로 노출하지 않음).
    context_window_turns: int = 3

    # 01_설계.md 2장 [Retrieve] 7): "Top-K(예: 3~5개)". 실제 데이터로 튜닝이 필요한
    # 영역(7장)이므로 범위의 상한인 5를 기본값으로 두고 환경변수로 조정 가능하게 한다.
    retrieve_top_k: int = int(os.environ.get("RETRIEVE_TOP_K", "5"))

    # Neo4j 벡터 인덱스에서 1차로 끌어올 후보 개수. Top-K(최대 5)보다 넉넉히 가져와야
    # [Retrieve] 6)/7)에서 다른 경로의 후보와 합친 뒤 스코어링으로 걸러낼 여지가 생긴다.
    vector_search_k: int = int(os.environ.get("VECTOR_SEARCH_K", "10"))

    # --- Gate 2 안내 문구용 ---
    # 실제 저장소 공개 URL은 01_설계.md 어디에도 명시돼 있지 않다 — 임의로 지어내지 않고
    # 환경변수로 주입받는다(설정 안 돼 있으면 링크 없이 안내 문구만 반환, api/chat.py 참고).
    github_repo_url: str | None = os.environ.get("GITHUB_REPO_URL")


settings = Settings()
