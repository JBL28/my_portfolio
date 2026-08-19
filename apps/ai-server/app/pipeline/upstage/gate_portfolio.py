"""apps/ai-server/app/pipeline/upstage/gate_portfolio.py

[Gate 1]의 Upstage Solar 구현. 판별 기준(시스템 프롬프트)은 OpenAI 구현과 완전히 동일하고
클라이언트·모델·temperature·재시도 정책만 다르다(패키지 docstring 참고).

실측: solar-pro2 / pro2-251215 / pro3 / pro3-260323 / pro4 / pro4-260806 6개 모델에서
각 3회 시행 모두 정답(is_portfolio_related=true)이었다.
"""
from __future__ import annotations

from openai import OpenAI

from app.config import settings

# 프롬프트를 복제하지 않고 OpenAI 구현의 것을 그대로 쓴다 — 판별 기준이 두 프로바이더
# 사이에서 갈라지면 안 된다(패키지 docstring). private 이름을 참조하는 이유는 기존
# 모듈을 수정할 수 없다는 제약 때문이며, 이 import는 "같은 프롬프트를 공유한다"는
# 의도를 드러내는 유일한 방법이다.
from app.pipeline.gate_portfolio import _SYSTEM_PROMPT
from app.pipeline.common import build_messages
from app.pipeline.upstage.common import parse_structured, parsed_or_raise
from app.schemas.chat import ChatMessage
from app.schemas.structured_outputs import Gate1Result

_STAGE_LABEL = "Gate 1(is_portfolio_related)"


def run_gate_portfolio(
    client: OpenAI, latest_message: str, history: list[ChatMessage]
) -> Gate1Result:
    messages = build_messages(_SYSTEM_PROMPT, history, latest_message)
    completion = parse_structured(
        client, settings.upstage_gate_model, messages, Gate1Result, _STAGE_LABEL
    )
    return parsed_or_raise(completion, _STAGE_LABEL)
