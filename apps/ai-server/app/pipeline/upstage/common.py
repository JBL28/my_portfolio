"""apps/ai-server/app/pipeline/upstage/common.py

Upstage 구현 4개가 공통으로 쓰는 structured output 호출 헬퍼.

OpenAI 쪽 pipeline/common.py는 "메시지 배열 조립"을 담당하고 그건 프로바이더와 무관해
그대로 재사용한다(build_messages). 이 파일은 그와 겹치지 않는 **호출 정책**만 담는다 —
temperature 고정과 재시도.
"""
from __future__ import annotations

from typing import Any

from openai import OpenAI
from openai.types.chat import ParsedChatCompletion
from pydantic import BaseModel

from app.config import settings

# parsed=None(스키마 불만족·refusal·length 절단)일 때 같은 프로바이더로 한 번 더
# 시도한다. 실측 시행에서는 한 번도 발생하지 않았지만, 발생 시 곧바로 OpenAI로 폴백해
# 비용을 두 배로 쓰기 전에 같은 값싼 경로를 한 번 더 밟는 편이 낫다. 2회로 제한하는
# 이유는 재시도가 길어질수록 폴백까지의 지연시간이 사용자에게 그대로 노출되기 때문이다.
_MAX_ATTEMPTS = 2


def parse_structured[T: BaseModel](
    client: OpenAI,
    model: str,
    messages: list[dict[str, str]],
    response_format: type[T],
    stage_label: str,
) -> ParsedChatCompletion[T]:
    """Upstage로 structured output을 호출하고 파싱된 completion을 반환한다.

    반환값을 `.parsed`가 아니라 completion 자체로 두는 이유: Generate가 span에 기록할
    토큰 사용량(`completion.usage`)을 필요로 한다(pipeline/generate.py와 동일).

    `_MAX_ATTEMPTS`회 모두 parsed=None이면 OpenAI 구현과 **같은 종류의 예외**
    (RuntimeError)를 던진다 — dispatch.py의 폴백 조건과 api/chat.py의 예외 흡수가
    프로바이더에 따라 달라지지 않게 하기 위해서다.
    """
    completion: ParsedChatCompletion[T] | None = None
    for _ in range(_MAX_ATTEMPTS):
        completion = client.beta.chat.completions.parse(
            model=model,
            messages=messages,
            response_format=response_format,
            # 실측: 기본 temperature에서 solar-pro4-260806의 Extract가 competencies에
            # 무관한 값을 덧붙이고 technologies에 프로젝트명을 오분류했으나, 0에서는
            # 6개 모델 x 3회 전부 정상이었다.
            temperature=settings.upstage_temperature,
        )
        if completion.choices[0].message.parsed is not None:
            return completion

    finish_reason = completion.choices[0].finish_reason if completion else "unknown"
    raise RuntimeError(
        f"{stage_label} structured output 파싱에 실패했습니다"
        f"(Upstage, {_MAX_ATTEMPTS}회 시도, finish_reason={finish_reason})."
    )


def parsed_or_raise[T: BaseModel](completion: ParsedChatCompletion[T], stage_label: str) -> T:
    """`parse_structured`가 이미 None을 걸러내지만, 타입 검사기에는 여전히 Optional이다.
    호출부마다 assert를 흩뿌리지 않도록 한 곳에서 좁힌다."""
    result: Any = completion.choices[0].message.parsed
    if result is None:  # pragma: no cover - parse_structured가 이미 보장한다
        raise RuntimeError(f"{stage_label} structured output 파싱에 실패했습니다(Upstage).")
    return result
