"""apps/ai-server/app/schemas/chat.py

FastAPI가 노출하는 POST /chat의 요청/응답 계약. 01_설계.md 5.4(axios 계약)와 2장
("대화 맥락 처리 방식")에서 정의한 필드를 그대로 따른다. Next.js BFF(Phase 04)가
camelCase로 주고받는 것을 전제하므로 이 파일의 필드명도 camelCase를 그대로 쓴다 —
pydantic alias 변환에 의존하지 않고 Python 속성명 자체를 camelCase로 둬서, Phase 04에서
FE 타입과 1:1로 대조하기 쉽게 한다.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.structured_outputs import Citation


class ChatMessageCitation(BaseModel):
    """클라이언트가 대화 이력에 들고 있는 citation 참조.

    2장 "대화 맥락 처리 방식": "각 assistant 턴에는 실제 사용된 citations(sectionId +
    caseId)를 함께 저장"한다고 명시했으므로, Generate가 응답한 Citation 전체
    (path/anchor/quotedTitle 포함)가 아니라 이 축소된 형태만 다음 요청에 재전송하면 된다.
    """

    sectionId: str
    caseId: str | None = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    # assistant 턴에서 실제로 사용된 근거. user 턴은 항상 None(또는 생략)이다.
    citations: list[ChatMessageCitation] | None = None


class ChatRequest(BaseModel):
    """5.4: `type ChatRequest = { chatSessionId: string; messages: ChatMessage[] }`

    requestId는 BFF(Next.js 서버)가 요청을 받은 시점에 생성하므로(8.1, Phase 05 범위)
    이 요청 바디에는 포함하지 않는다.
    """

    chatSessionId: str
    messages: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """Generate([Generate] schema)의 answer/is_evidence_sufficient/citations를 그대로
    camelCase로 노출한다. Gate 1/2에서 조기 종료된 경우에도 같은 모양을 유지해 FE가
    응답 형태를 분기하지 않아도 되게 한다 — 그 경우 isEvidenceSufficient=false,
    citations=[]로 채운다(api/chat.py 참고)."""

    answer: str
    isEvidenceSufficient: bool
    citations: list[Citation] = Field(default_factory=list)
