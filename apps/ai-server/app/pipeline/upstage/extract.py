"""apps/ai-server/app/pipeline/upstage/extract.py

[Extract]의 Upstage Solar 구현. 추출 기준(시스템 프롬프트)과 "이전 턴 citations 후보
목록"을 만드는 방식은 OpenAI 구현과 완전히 동일하고, 클라이언트·모델·temperature·재시도
정책만 다르다(패키지 docstring 참고).

**temperature가 이 단계에서 특히 중요하다.** Extract 결과는 사용자에게 보이지 않고
Retrieve의 입력 전체로 쓰인다(project_hints=검색 범위, competencies=DEMONSTRATES 탐색,
technologies=USES 탐색, search_intent=벡터 검색 질의). 오염되면 답변이 아니라 **근거가**
틀리므로 조용히 품질만 깎인다. 실측에서 기본 temperature의 solar-pro4-260806이
competencies에 무관한 값을 덧붙이고 technologies에 프로젝트명을 오분류했으나,
temperature=0에서는 6개 모델 x 3회 전부 정상이었다.
"""
from __future__ import annotations

import json

from openai import OpenAI

from app.config import settings
from app.pipeline.common import build_messages

# gate_portfolio.py와 같은 이유로 OpenAI 구현의 프롬프트를 공유한다. _collect_previous_citations
# 도 LLM 호출이 아니라 대화 이력에서 후보를 모으는 순수 함수라 프로바이더와 무관하다 —
# 복제하면 두 구현이 서로 다른 후보 목록을 만들게 된다.
from app.pipeline.extract import _SYSTEM_PROMPT, _collect_previous_citations
from app.pipeline.upstage.common import parse_structured, parsed_or_raise
from app.schemas.chat import ChatMessage
from app.schemas.structured_outputs import ExtractResult

_STAGE_LABEL = "Extract"


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
    # 바로 앞(=history 뒤)에 system 메시지로 끼워 넣는다(OpenAI 구현과 동일한 배치 —
    # 메시지 순서가 달라지면 두 프로바이더의 결과를 비교할 수 없다).
    messages.insert(len(messages) - 1, {"role": "system", "content": context_note})

    completion = parse_structured(
        client, settings.upstage_extract_model, messages, ExtractResult, _STAGE_LABEL
    )
    result = parsed_or_raise(completion, _STAGE_LABEL)

    # 방어적 후처리: OpenAI 구현과 동일하다. refers_to_previous_citations는 자유 문자열
    # 필드라 스키마 레벨에서 "후보 목록 안의 값만 허용"을 강제할 수 없으므로, 실제
    # 목록에 있는 것만 남긴다. (원본은 run_extract() 안에 인라인으로 있어 import로
    # 공유할 수 없다 — 기존 모듈을 수정하지 않는다는 제약 때문에 이 6줄만 복제한다.)
    allowed = {(c.sectionId, c.caseId) for c in available_previous_citations}
    filtered_refs = [
        ref
        for ref in result.refers_to_previous_citations
        if (ref.sectionId, ref.caseId) in allowed
    ]
    return result.model_copy(update={"refers_to_previous_citations": filtered_refs})
