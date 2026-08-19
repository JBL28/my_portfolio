"""apps/ai-server/app/llm/provider.py

LLM 프로바이더 열거·선택과 OpenAI 호환 클라이언트 싱글턴.

**Upstage 기본 + OpenAI 폴백**: Gate1/Gate2/Extract/Generate 4단계는 Upstage Solar에서
동작하는 것이 실측으로 확인됐으므로 기본 프로바이더로 쓰고, 호출 실패나 스키마 파싱
실패 시 OpenAI로 폴백한다(실제 폴백 실행은 pipeline/dispatch.py).

**임베딩은 항상 OpenAI**: Upstage는 text-embedding-3-small을 400으로 거부하고, 자체
임베딩 모델은 4096차원이라 db/schema.cypher의 1536차원 벡터 인덱스와 맞지 않는다.
따라서 Retrieve의 질의 임베딩(pipeline/retrieve.py)은 프로바이더 선택과 무관하게
`get_openai_client()`를 쓴다. 이 때문에 **UPSTAGE_API_KEY만 있는 구성에서는 Gate 1/2는
동작하지만 Retrieve→Generate 경로가 반드시 실패한다** — 런타임에 정체불명의 오류로
새지 않도록 `warn_if_incomplete()`가 기동 시점에 경고를 남긴다(config.py의 "조용히
건너뛰지 않는다" 원칙을, 서버 기동 자체는 막지 않는 선에서 적용).

클라이언트 싱글턴 패턴은 graph/client.py의 get_driver()/close_driver()와 동일하다 —
요청마다 새 클라이언트를 만들지 않는다.
"""
from __future__ import annotations

import logging
from enum import Enum

from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class LlmProvider(str, Enum):
    """structured output 호출에 쓸 수 있는 프로바이더. 값은 LLM_PROVIDER 환경변수에
    그대로 쓰는 문자열이자 span attribute(`llm_provider`)에 기록되는 값이다."""

    UPSTAGE = "upstage"
    OPENAI = "openai"


_clients: dict[LlmProvider, OpenAI] = {}


def get_client(provider: LlmProvider) -> OpenAI:
    """프로바이더별 OpenAI 호환 클라이언트를 반환한다(프로세스 싱글턴).

    Upstage는 OpenAI SDK를 그대로 쓰되 base_url만 다르다 — 별도 SDK가 필요하지 않다는
    점이 이 설계의 전제다(실측 확인)."""
    client = _clients.get(provider)
    if client is not None:
        return client

    if provider is LlmProvider.UPSTAGE:
        client = OpenAI(
            api_key=settings.upstage_api_key, base_url=settings.upstage_base_url
        )
    else:
        client = OpenAI(api_key=settings.openai_api_key)

    _clients[provider] = client
    return client


def get_openai_client() -> OpenAI:
    """임베딩 전용 진입점. Retrieve는 프로바이더 선택과 무관하게 항상 OpenAI를 쓴다 —
    호출부가 `get_client(...)`를 쓰다 실수로 Upstage를 넘기는 일이 없도록 별도 이름으로
    노출한다(위 모듈 docstring의 "임베딩은 항상 OpenAI" 참고)."""
    return get_client(LlmProvider.OPENAI)


def resolve_chain() -> list[LlmProvider]:
    """이번 프로세스에서 쓸 프로바이더 체인. 앞에서부터 시도하고 실패하면 다음으로
    넘어간다(pipeline/dispatch.py). 길이가 1이면 폴백이 없다는 뜻이다.

    | LLM_PROVIDER | 키 상태          | 체인                  |
    |--------------|------------------|-----------------------|
    | auto(기본)   | 둘 다 있음       | [UPSTAGE, OPENAI]     |
    | auto         | Upstage만        | [UPSTAGE]             |
    | auto         | OpenAI만         | [OPENAI]              |
    | upstage      | -                | [UPSTAGE] (폴백 없음) |
    | openai       | -                | [OPENAI] (폴백 없음)  |

    키가 하나도 없거나 명시한 프로바이더의 키가 없으면 즉시 RuntimeError를 던진다 —
    scripts/load_graph.py의 require_env()와 같은 "조용히 건너뛰지 않고 즉시 실패한다"
    원칙이다. 다만 config.py와 마찬가지로 import 시점이 아니라 호출 시점에 실패한다.
    """
    configured = settings.llm_provider

    if configured == LlmProvider.UPSTAGE.value:
        if not settings.has_upstage_api_key:
            raise RuntimeError(
                "LLM_PROVIDER=upstage로 고정했지만 UPSTAGE_API_KEY가 없습니다."
            )
        return [LlmProvider.UPSTAGE]

    if configured == LlmProvider.OPENAI.value:
        if not settings.has_openai_api_key:
            raise RuntimeError(
                "LLM_PROVIDER=openai로 고정했지만 OPENAI_API_KEY가 없습니다."
            )
        return [LlmProvider.OPENAI]

    if configured != "auto":
        raise RuntimeError(
            f"LLM_PROVIDER 값이 올바르지 않습니다: {configured!r} "
            '(허용: "auto", "upstage", "openai")'
        )

    chain = [
        provider
        for provider, available in (
            (LlmProvider.UPSTAGE, settings.has_upstage_api_key),
            (LlmProvider.OPENAI, settings.has_openai_api_key),
        )
        if available
    ]
    if not chain:
        raise RuntimeError(
            "UPSTAGE_API_KEY와 OPENAI_API_KEY 중 최소 하나는 설정돼야 합니다."
        )
    return chain


def warn_if_incomplete() -> None:
    """기동 시점(main.py lifespan)에 한 번 호출해 구성 한계를 로그로 남긴다.

    서버 기동을 막지는 않는다 — observability/tracing.py의 configure_tracing()이
    실패해도 기동을 막지 않는 것과 같은 판단이다. 다만 "임베딩이 없어 Retrieve가
    반드시 실패하는 구성"은 첫 요청이 들어오기 전에 드러나야 한다."""
    try:
        chain = resolve_chain()
    except RuntimeError as exc:
        logger.error("LLM 프로바이더 구성 오류: %s", exc)
        return

    logger.info(
        "LLM 프로바이더 체인: %s (폴백 %s)",
        " -> ".join(p.value for p in chain),
        "있음" if len(chain) > 1 else "없음",
    )
    if not settings.has_openai_api_key:
        logger.warning(
            "OPENAI_API_KEY가 없습니다 — 질의 임베딩은 OpenAI 전용이므로 Gate 1/2는 "
            "동작하지만 Retrieve→Generate 경로는 항상 실패합니다."
        )
