"""apps/ai-server/app/pipeline/extract.py

[Extract] 사용자의 최신 질문 + 최근 대화 이력에서 검색에 필요한 의도·핵심 개념을
추출한다. 01_설계.md 2장 [Extract] 스키마를 그대로 구현한다(스키마 정의 자체는
app/schemas/structured_outputs.py의 ExtractResult).
"""
from __future__ import annotations

import json

from openai import OpenAI

from app.config import settings
from app.pipeline.common import build_messages
from app.schemas.chat import ChatMessage
from app.schemas.structured_outputs import ExtractResult, PreviousCitationRef

_SYSTEM_PROMPT = """당신은 포트폴리오 Graph RAG 파이프라인의 의도 추출 단계다.
사용자의 최신 질문과 최근 대화 이력을 보고 검색에 필요한 의도·핵심 개념을 추출한다.

- competencies는 반드시 정의된 7개 값 중에서만 고른다: 협업, 기술적 판단, 문제 해결,
  운영, DevOps, AI 활용, 학습 및 성장. 질문이 이 중 어느 것과도 명확히 관련 없으면
  빈 배열로 둔다.
- technologies는 질문에서 언급되거나 명확히 함의된 기술명을 원문 표기 그대로 추출한다
  (정규화는 이후 Retrieve 단계에서 별도로 수행하므로 여기서는 자유 텍스트로 둔다).
- project_hints는 질문에서 명시적으로 언급된 프로젝트명만 담는다(TeenyFinny, Home Server,
  DailyBand 등). 언급이 없으면 빈 배열로 둔다 — 임의로 추측해 채우지 않는다.
- is_followup=true인 경우에만 refers_to_previous_citations를 채운다. 이 필드에는 아래
  "이전 턴 citations 목록"에 실제로 존재하는 항목만 그대로 복사해서 넣는다 — 목록에
  없는 sectionId/caseId를 새로 만들어내지 않는다. 이 질문이 어떤 근거를 가리키는지
  애매하면 이전 턴의 citations 전체를 넣는다.
- wants_similar_cases=true로 판단했다면, 그 판단이 의미가 있으려면 refers_to_previous_citations
  중 caseId가 있는 항목이 최소 하나는 있어야 한다(Retrieve가 그 caseId를 기준으로
  다른 프로젝트의 유사 Case를 확장 검색한다) — caseId가 있는 이전 근거가 전혀 없다면
  wants_similar_cases를 true로 판단하지 않는다."""


def _collect_previous_citations(history: list[ChatMessage]) -> list[PreviousCitationRef]:
    """최근 대화 이력의 assistant 턴에서 실제로 사용된 citations를 sectionId/caseId만
    남겨 모은다. Extract가 refers_to_previous_citations를 채울 때 참조할 수 있는
    "실제 존재하는 후보 목록"이다. 2장 "대화 맥락 처리 방식": 클라이언트가 들고 있는
    이전 턴 citations를 그대로 재사용하며, 서버가 별도 Case ID 체계를 요구하지 않는다."""
    seen: set[tuple[str, str | None]] = set()
    refs: list[PreviousCitationRef] = []
    for turn in history:
        if turn.role != "assistant" or not turn.citations:
            continue
        for citation in turn.citations:
            key = (citation.sectionId, citation.caseId)
            if key in seen:
                continue
            seen.add(key)
            refs.append(PreviousCitationRef(sectionId=citation.sectionId, caseId=citation.caseId))
    return refs


def run_extract(
    client: OpenAI, latest_message: str, history: list[ChatMessage]
) -> ExtractResult:
    available_previous_citations = _collect_previous_citations(history)

    context_note = (
        "이전 턴 citations 목록(refers_to_previous_citations로 참조할 수 있는 후보 — "
        "이 목록에 있는 것만 그대로 복사해서 쓸 것): "
        + json.dumps(
            [c.model_dump() for c in available_previous_citations], ensure_ascii=False
        )
    )

    messages = build_messages(_SYSTEM_PROMPT, history, latest_message)
    # build_messages가 이미 마지막에 이번 질문(user)을 넣으므로, 후보 목록 노트는 그
    # 바로 앞(=history 뒤)에 system 메시지로 끼워 넣는다.
    messages.insert(len(messages) - 1, {"role": "system", "content": context_note})

    completion = client.beta.chat.completions.parse(
        model=settings.extract_model,
        messages=messages,
        response_format=ExtractResult,
    )
    result = completion.choices[0].message.parsed
    if result is None:
        raise RuntimeError("Extract structured output 파싱에 실패했습니다.")

    # 방어적 후처리: refers_to_previous_citations는 스키마 레벨에서 "후보 목록 안의 값만
    # 허용"을 강제할 수 없으므로(자유 문자열 필드), 실제 이전 턴 citations 목록에 있는
    # 것만 남긴다 — LLM이 목록 밖 sectionId/caseId를 지어내는 경우를 방어한다.
    allowed = {(c.sectionId, c.caseId) for c in available_previous_citations}
    filtered_refs = [
        ref
        for ref in result.refers_to_previous_citations
        if (ref.sectionId, ref.caseId) in allowed
    ]
    return result.model_copy(update={"refers_to_previous_citations": filtered_refs})
