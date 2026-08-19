"""apps/ai-server/app/pipeline/upstage/gate_site.py

[Gate 2]의 Upstage Solar 구현. 구분 기준(시스템 프롬프트)은 OpenAI 구현과 완전히 동일하고
클라이언트·모델·temperature·재시도 정책만 다르다(패키지 docstring 참고).

실측: 6개 모델 x 4케이스("이 챗봇은 어떻게 만들어졌나요?"/"이 사이트 프론트엔드는
무엇으로 만들었나요?" → true, "DailyBand에서 어떤 역할을 맡았나요?"/"협업은 어떻게
하시나요?" → false) 전부 정답이었다.
"""
from __future__ import annotations

from openai import OpenAI

from app.config import settings
from app.pipeline.common import build_messages

# gate_portfolio.py와 같은 이유로 OpenAI 구현의 프롬프트를 공유한다.
from app.pipeline.gate_site import _SYSTEM_PROMPT
from app.pipeline.upstage.common import parse_structured, parsed_or_raise
from app.schemas.chat import ChatMessage
from app.schemas.structured_outputs import Gate2Result

_STAGE_LABEL = "Gate 2(is_about_site_itself)"


def run_gate_site(
    client: OpenAI, latest_message: str, history: list[ChatMessage]
) -> Gate2Result:
    messages = build_messages(_SYSTEM_PROMPT, history, latest_message)
    completion = parse_structured(
        client, settings.upstage_gate_model, messages, Gate2Result, _STAGE_LABEL
    )
    return parsed_or_raise(completion, _STAGE_LABEL)
