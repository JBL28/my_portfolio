"""apps/ai-server/app/pipeline/dispatch.py

프로바이더 체인 실행 + 폴백. api/chat.py는 이 모듈의 함수만 호출하고 어떤 프로바이더가
실제로 응답을 만들었는지는 신경 쓰지 않는다.

**노출하는 함수 이름과 반환 타입은 OpenAI 구현과 동일하다**(run_gate_portfolio /
run_gate_site / run_extract / run_generate). 차이는 `client` 인자가 없다는 것뿐이다 —
어떤 클라이언트를 쓸지가 바로 이 모듈이 정하는 값이라, 호출부가 넘기면 모순이 된다.
Retrieve는 이 모듈을 거치지 않는다(임베딩이 OpenAI 전용이라 선택의 여지가 없다 —
llm/provider.py docstring 참고).

**폴백 조건**은 "감지 가능한 실패"로 한정한다:
  - OpenAIError      : API 호출 자체 실패(인증·rate limit·네트워크)
  - RuntimeError     : structured output 파싱 실패(parsed=None), citation 무결성 검증 실패
  - ValueError       : GenerateResult의 citation 제약 위반(pydantic ValidationError 포함)
이 셋은 api/chat.py가 안전한 ChatResponse로 흡수하는 예외와 정확히 같은 집합이다 —
"폴백으로도 못 살린 실패"가 기존 예외 흐름에 그대로 얹히게 하려는 것이다.

스키마는 통과했지만 판단이 틀린 경우(예: Gate 1 오판)는 폴백 대상이 아니다. 서버가
그것을 감지할 방법이 없기 때문이다. 실측에서 Gate1/Gate2/Extract 모두 기존 프롬프트로
정답률 100%였으므로 이 한계는 현재 문제되지 않는다.

**계측**: span 생성은 api/chat.py가 단일하게 담당한다는 원칙(그 파일 docstring)을 지키기
위해, 이 모듈은 새 span을 만들지 않고 **현재 활성 span에 attribute만 추가**한다.
"""
from __future__ import annotations

from typing import Callable, TypeVar

from openai import OpenAI, OpenAIError
from openai.types.completion_usage import CompletionUsage
from opentelemetry import trace

from app.config import settings
from app.llm.provider import LlmProvider, get_client, resolve_chain
from app.pipeline import extract as openai_extract
from app.pipeline import gate_portfolio as openai_gate_portfolio
from app.pipeline import gate_site as openai_gate_site
from app.pipeline import generate as openai_generate
from app.pipeline.retrieve import Candidate
from app.pipeline.upstage import extract as upstage_extract
from app.pipeline.upstage import gate_portfolio as upstage_gate_portfolio
from app.pipeline.upstage import gate_site as upstage_gate_site
from app.pipeline.upstage import generate as upstage_generate
from app.schemas.chat import ChatMessage
from app.schemas.structured_outputs import (
    ExtractResult,
    Gate1Result,
    Gate2Result,
    GenerateResult,
)

_T = TypeVar("_T")

# 위 docstring "폴백 조건" 참고. api/chat.py의 except 절과 같은 집합으로 유지해야 한다.
_FALLBACK_ERRORS = (OpenAIError, RuntimeError, ValueError)

# 단계별 모델명. 프로바이더가 늘어나도 호출부가 아니라 이 표만 고치면 되게 모아둔다.
_MODELS: dict[tuple[LlmProvider, str], Callable[[], str]] = {
    (LlmProvider.UPSTAGE, "gate"): lambda: settings.upstage_gate_model,
    (LlmProvider.UPSTAGE, "extract"): lambda: settings.upstage_extract_model,
    (LlmProvider.UPSTAGE, "generate"): lambda: settings.upstage_generate_model,
    (LlmProvider.OPENAI, "gate"): lambda: settings.gate_model,
    (LlmProvider.OPENAI, "extract"): lambda: settings.extract_model,
    (LlmProvider.OPENAI, "generate"): lambda: settings.generate_model,
}


def _record(provider: LlmProvider, stage: str, fallback_used: bool) -> None:
    """현재 활성 span(api/chat.py가 연 gate.portfolio / gate.site / extract / generate)에
    실제로 응답을 만든 프로바이더를 기록한다. 폴백이 일어났는지는 로그가 아니라 trace로
    남아야 운영 중에 "왜 이 답변만 다른가"를 추적할 수 있다."""
    span = trace.get_current_span()
    span.set_attribute("llm_provider", provider.value)
    span.set_attribute("llm_fallback_used", fallback_used)
    span.set_attribute("model", _MODELS[(provider, stage)]())


def _dispatch(
    stage: str,
    impls: dict[LlmProvider, Callable[[OpenAI], _T]],
) -> _T:
    """프로바이더 체인을 앞에서부터 시도하고, 폴백 가능한 예외면 다음 프로바이더로
    넘어간다. 마지막 프로바이더까지 실패하면 그 예외를 그대로 다시 던진다 —
    api/chat.py가 흡수해 안전한 ChatResponse를 만든다."""
    chain = resolve_chain()
    for index, provider in enumerate(chain):
        try:
            result = impls[provider](get_client(provider))
        except _FALLBACK_ERRORS:
            # 마지막 프로바이더였다면 더 시도할 곳이 없다 — 원래 예외를 그대로 올린다.
            if index == len(chain) - 1:
                raise
            # 아직 폴백할 곳이 남아 있다. 실패한 프로바이더도 trace에 남겨야 "폴백이
            # 몇 번 일어났는지"를 셀 수 있으므로 attribute로 기록해 둔다.
            trace.get_current_span().set_attribute(
                f"llm_failed_{provider.value}", True
            )
            continue
        _record(provider, stage, fallback_used=index > 0)
        return result

    # resolve_chain()이 빈 리스트를 반환하지 않으므로 도달하지 않는다.
    raise RuntimeError("사용 가능한 LLM 프로바이더가 없습니다.")  # pragma: no cover


def run_gate_portfolio(
    latest_message: str, history: list[ChatMessage]
) -> Gate1Result:
    return _dispatch(
        "gate",
        {
            LlmProvider.UPSTAGE: lambda client: upstage_gate_portfolio.run_gate_portfolio(
                client, latest_message, history
            ),
            LlmProvider.OPENAI: lambda client: openai_gate_portfolio.run_gate_portfolio(
                client, latest_message, history
            ),
        },
    )


def run_gate_site(latest_message: str, history: list[ChatMessage]) -> Gate2Result:
    return _dispatch(
        "gate",
        {
            LlmProvider.UPSTAGE: lambda client: upstage_gate_site.run_gate_site(
                client, latest_message, history
            ),
            LlmProvider.OPENAI: lambda client: openai_gate_site.run_gate_site(
                client, latest_message, history
            ),
        },
    )


def run_extract(latest_message: str, history: list[ChatMessage]) -> ExtractResult:
    return _dispatch(
        "extract",
        {
            LlmProvider.UPSTAGE: lambda client: upstage_extract.run_extract(
                client, latest_message, history
            ),
            LlmProvider.OPENAI: lambda client: openai_extract.run_extract(
                client, latest_message, history
            ),
        },
    )


def run_generate(
    latest_message: str, extract: ExtractResult, candidates: list[Candidate]
) -> tuple[GenerateResult, CompletionUsage | None]:
    return _dispatch(
        "generate",
        {
            LlmProvider.UPSTAGE: lambda client: upstage_generate.run_generate(
                client, latest_message, extract, candidates
            ),
            LlmProvider.OPENAI: lambda client: openai_generate.run_generate(
                client, latest_message, extract, candidates
            ),
        },
    )
