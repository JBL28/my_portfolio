"""apps/ai-server/app/pipeline/gate_site.py

[Gate 2] 사용자의 질문이 포트폴리오 "웹사이트 자체"(구현 방식·소스코드)에 대한 질문인지
판별한다 — 지원자의 경험이 아니라 이 챗봇/웹사이트가 어떻게 만들어졌는지를 묻는 경우.
00_기획.md: "사용자의 질문이 포트폴리오 그 자체와 관련된 내용인지 structured outputs를
활용해 판별합니다.(지원자의 경험이 아니라 현재 포트폴리오 웹사이트의 구현 방식이나
소스코드 자체를 묻는 경우)" / 01_설계.md 2장 [Gate 2]를 그대로 구현한다.

Gate 1에서 이미 "포트폴리오 관련"으로 판별된 질문에 대해서만 호출된다(api/chat.py).
"""
from __future__ import annotations

from openai import OpenAI

from app.config import settings
from app.pipeline.common import build_messages
from app.schemas.chat import ChatMessage
from app.schemas.structured_outputs import Gate2Result

_SYSTEM_PROMPT = """당신은 한 지원자의 포트폴리오 웹사이트에 내장된 챗봇의 두 번째 판별 단계다.
이 단계에 들어온 질문은 이미 "포트폴리오 관련 질문"으로 판별된 것이다. 이제 그 질문이
다음 중 어느 쪽인지 구분한다:

(A) 지원자의 프로젝트 경험·역량·판단에 대한 질문 (예: "DailyBand에서 어떤 역할을 맡았나요?",
    "협업은 어떻게 하나요?") → is_about_site_itself = false
(B) 이 포트폴리오 웹사이트/챗봇 자체의 구현 방식이나 소스코드에 대한 질문
    (예: "이 챗봇은 어떻게 만들어졌나요?", "이 사이트 프론트엔드는 무엇으로 만들었나요?",
    "Graph RAG는 어떻게 구현했나요?", "이 Neo4j 스키마는 어떻게 설계했나요?")
    → is_about_site_itself = true

핵심 구분 기준: 질문의 대상이 "지원자가 과거에 만든 프로젝트/경험"이면 (A), "지금 이
채팅을 하고 있는 이 포트폴리오 웹사이트 자체"이면 (B)다.
reason에는 판단 근거를 한 문장으로 간단히 남긴다."""


def run_gate_site(
    client: OpenAI, latest_message: str, history: list[ChatMessage]
) -> Gate2Result:
    messages = build_messages(_SYSTEM_PROMPT, history, latest_message)
    completion = client.beta.chat.completions.parse(
        model=settings.gate_model,
        messages=messages,
        response_format=Gate2Result,
    )
    result = completion.choices[0].message.parsed
    if result is None:
        raise RuntimeError("Gate 2(is_about_site_itself) structured output 파싱에 실패했습니다.")
    return result
