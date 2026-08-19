"""apps/ai-server/app/pipeline/upstage/generate.py

[Generate]의 Upstage Solar 구현. 시스템 프롬프트·근거 컨텍스트 조립·citation 무결성
검증은 OpenAI 구현과 완전히 동일하고, 클라이언트·모델·temperature·재시도 정책만
다르다(패키지 docstring 참고).

citation 검증(`_validate_and_rebuild_citations`)은 LLM 호출이 아니라 모델 출력을 실제
후보와 대조하는 **결정적 후처리**다. 프로바이더에 따라 달라질 여지가 없고, 복제하면
"지어낸 근거를 버린다"는 보안 성격의 규칙이 한쪽에서만 갱신될 위험이 있으므로 반드시
공유한다.

OpenAI 구현과 마찬가지로 `(GenerateResult, CompletionUsage | None)` 튜플을 반환한다 —
api/chat.py의 generate span이 토큰 사용량을 기록해야 하기 때문이다(01_설계.md 8장).
"""
from __future__ import annotations

from openai import OpenAI
from openai.types.completion_usage import CompletionUsage

from app.config import settings

# gate_portfolio.py와 같은 이유로 OpenAI 구현의 프롬프트를 공유한다. build_context는
# public이고, _validate_and_rebuild_citations는 위 docstring의 이유로 공유한다.
from app.pipeline.generate import (
    _SYSTEM_PROMPT,
    _validate_and_rebuild_citations,
    build_context,
)
from app.pipeline.retrieve import Candidate
from app.pipeline.upstage.common import parse_structured, parsed_or_raise
from app.schemas.structured_outputs import ExtractResult, GenerateResult

_STAGE_LABEL = "Generate"


def run_generate(
    client: OpenAI,
    latest_message: str,
    extract: ExtractResult,
    candidates: list[Candidate],
) -> tuple[GenerateResult, CompletionUsage | None]:
    context = build_context(candidates)
    user_content = (
        f"사용자 질문: {latest_message}\n"
        f"추출된 검색 의도: {extract.search_intent}\n\n"
        f"{context}"
    )

    completion = parse_structured(
        client,
        settings.upstage_generate_model,
        [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        GenerateResult,
        _STAGE_LABEL,
    )
    result = parsed_or_raise(completion, _STAGE_LABEL)
    return _validate_and_rebuild_citations(result, candidates), completion.usage
