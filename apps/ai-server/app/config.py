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

    # 02_구현계획.md 0장에서 확정: text-embedding-3-small(1536차원). scripts/load_graph.py의
    # EMBEDDING_MODEL 상수가 같은 값으로 Section.embedding을 만들므로, Retrieve의 질의
    # 임베딩도 반드시 같은 모델을 써야 벡터 공간이 일치한다. 환경변수 override는 두지
    # 않는다 — 적재 스크립트는 그 환경변수를 읽지 않으므로, runtime에서만 모델이 바뀌면
    # DB의 임베딩과 질의 임베딩이 서로 다른 벡터 공간에 놓이는 사고가 생긴다(차원이
    # 다르면 쿼리 실패, 같아도 비교 불가). 모델을 바꾸려면 이 상수와 load_graph.py의
    # EMBEDDING_MODEL을 함께 고치고 전체 재적재해야 한다.
    embedding_model: str = "text-embedding-3-small"

    # --- Upstage Solar (OpenAI 호환 엔드포인트) ---
    # Gate1/Gate2/Extract/Generate 4단계는 Upstage Solar에서도 동작하는 것이 실측으로
    # 확인됐다(structured output의 $defs/$ref/enum/anyOf까지 전부 통과). 다만 임베딩은
    # 예외다 — Upstage는 text-embedding-3-small을 400으로 거부하고 자체 모델은 4096차원
    # 이라 db/schema.cypher의 1536차원 인덱스와 맞지 않는다. 따라서 **임베딩은 항상
    # OpenAI를 쓴다**(embedding_model 주석의 "모델을 바꾸려면 전체 재적재" 제약 그대로).
    @property
    def upstage_api_key(self) -> str:
        return _require_env("UPSTAGE_API_KEY")

    # base_url을 상수로 박지 않는 이유: 키와 달리 엔드포인트는 리전/프록시 구성에 따라
    # 달라질 수 있고, 바뀌어도 데이터 정합성에 영향이 없다(embedding_model과 대비된다).
    upstage_base_url: str = os.environ.get(
        "UPSTAGE_BASE_URL", "https://api.upstage.ai/v1"
    )

    # alias(solar-pro2)가 아니라 날짜 pin 버전을 기본값으로 둔다 — 실측에서 alias와 pin의
    # 판별 정확도 차이는 없었지만, alias는 언제든 새 모델을 가리킬 수 있어 배포 재현성이
    # 깨진다. solar-pro3-260323 / solar-pro4-260806도 동일하게 검증을 통과했으므로
    # 환경변수로 교체 가능하게 둔다. OPENAI_MODEL_* 와 같은 이유로 단계별 override.
    upstage_gate_model: str = os.environ.get("UPSTAGE_MODEL_GATE", "solar-pro2-251215")
    upstage_extract_model: str = os.environ.get(
        "UPSTAGE_MODEL_EXTRACT", "solar-pro2-251215"
    )
    upstage_generate_model: str = os.environ.get(
        "UPSTAGE_MODEL_GENERATE", "solar-pro2-251215"
    )

    # 실측에서 유일하게 확인된 품질 이슈(기본 temperature에서 Extract의 competencies/
    # technologies가 흔들림)가 temperature=0에서 완전히 사라졌다. OpenAI 쪽 파이프라인은
    # 이 값을 쓰지 않는다(기존 모듈을 수정하지 않는다는 제약).
    upstage_temperature: float = float(os.environ.get("UPSTAGE_TEMPERATURE", "0"))

    # --- LLM 프로바이더 선택 ---
    # "auto": 키가 있는 프로바이더를 자동으로 고른다(둘 다 있으면 Upstage 우선 + OpenAI
    # 폴백, 하나만 있으면 그것만). "upstage"/"openai": 해당 프로바이더로 고정하고 폴백을
    # 쓰지 않는다 — 장애 원인을 격리해야 할 때 쓴다.
    llm_provider: str = os.environ.get("LLM_PROVIDER", "auto").strip().lower()

    @property
    def has_openai_api_key(self) -> bool:
        return bool(os.environ.get("OPENAI_API_KEY"))

    @property
    def has_upstage_api_key(self) -> bool:
        return bool(os.environ.get("UPSTAGE_API_KEY"))

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
