"""apps/ai-server/app/pipeline/common.py

gate_portfolio.py / gate_site.py / extract.py가 공통으로 쓰는 "system prompt +
최근 대화 이력 + 이번 질문"을 OpenAI Chat Completions 메시지 배열로 조립하는 헬퍼.
"""
from __future__ import annotations

from app.schemas.chat import ChatMessage


def build_messages(
    system_prompt: str, history: list[ChatMessage], latest_message: str
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for turn in history:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": latest_message})
    return messages
