"""apps/ai-server/app/api/chat.py

POST /chat — 01_설계.md 2장 "Graph RAG 파이프라인 설계"를 그대로 오케스트레이션한다:

    Gate 1 → (false면 고정 안내 문구 반환 후 종료)
    Gate 2 → (true면 GitHub 링크 안내 반환 후 종료)
    Extract → Retrieve → Generate

서버는 stateless다(2장 "대화 맥락 처리 방식") — 세션을 저장하지 않고 클라이언트가 매
요청마다 함께 보내는 `messages`만 사용한다. `messages`의 마지막 항목을 이번 질문으로,
그 이전을 대화 이력으로 삼는다. 이력은 최근 N턴(02_구현계획.md 0장에서 N=3으로 확정 —
`settings.context_window_turns`)으로 잘라 Gate 1/2/Extract에 넘긴다.

Gate 1/2에서 조기 종료되는 경우에도 `ChatResponse`와 같은 모양을 유지한다
(`isEvidenceSufficient=False`, `citations=[]`) — `schemas/chat.py`의 `ChatResponse`
주석이 이미 이 규칙을 명시하고 있다.

Gate1/Gate2/Extract/Generate는 모두 OpenAI structured output 호출이라 다음 두 경우에
예외를 던질 수 있다: (1) 모델 응답이 스키마를 만족하지 못하거나 refusal/length로
잘려 `parsed`가 None인 경우 각 파이프라인 함수가 `RuntimeError`를 던진다, (2)
`GenerateResult`의 citation 제약(`is_evidence_sufficient=true`면 citations 최소
1개)을 모델이 어기면 pydantic 검증 단계에서 `ValueError`(`pydantic.ValidationError`는
`ValueError`의 하위 클래스)가 발생한다. 두 경우 모두 발생 빈도는 낮지만(모델이 프롬프트
지시를 어길 때만) 처리되지 않은 500으로 새면 FE가 별도 에러 분기를 둬야 하므로,
`ChatResponse`가 Gate1/2 조기 종료에 적용한 것과 같은 원칙(FE는 항상 같은 응답 모양만
본다)을 파이프라인 내부 예외에도 적용해 안전한 `ChatResponse`로 흡수한다. Gate1/Gate2
결과에 따른 정상 조기 종료는 예외가 아니라 정상 흐름이므로 이 예외 처리와 섞이지 않는다.

**계측(01_설계.md 8장, Phase 05)**: 이 파일이 파이프라인 전체를 오케스트레이션하는
유일한 지점이므로, root span("request")과 security.input/gate.portfolio/gate.site/
extract/generate/security.output span을 모두 여기서 만든다(retrieve.graph/vector/rank
는 pipeline/retrieve.py의 `retrieve()` 오케스트레이터 안에서 만든다). 8.1: "requestId
발급은 BFF(Next.js)에서 이루어져야" 하므로 FastAPI는 새 requestId를 만들지 않고
Next.js BFF가 보낸 `X-Request-ID` 헤더를 그대로 attribute로 기록한다. 8.3: security.input
/output 스캔은 규칙 기반 관측 신호일 뿐 차단 로직이 아니므로, 기존 try/except 흐름과
Gate1/2 조기 종료 흐름은 전혀 바꾸지 않는다.
"""
from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException, Request
from openai import OpenAIError

from app.config import settings
from app.llm.provider import get_openai_client
from app.observability.tracing import get_tracer
from app.pipeline.dispatch import (
    run_extract,
    run_gate_portfolio,
    run_gate_site,
    run_generate,
)
from app.pipeline.retrieve import retrieve
from app.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from app.security.input_scan import scan_input
from app.security.output_scan import scan_output

router = APIRouter()

# 00_기획.md: "포트폴리오와 관련된 내용이 아니라면 정해진 안내 문구를 답변합니다.
# (예시: 지원자에 대한 질문을 해주세요. 를 예의바르게)" — 그 취지를 그대로 옮긴 고정 문구.
_GATE1_REJECTION_MESSAGE = (
    "죄송하지만 저는 이 포트폴리오 지원자의 프로젝트 경험과 역량에 관한 질문에만 "
    "답변드릴 수 있어요. 지원자에 대해 궁금하신 점을 질문해 주시면 도와드리겠습니다."
)

# Gate1/Gate2/Extract/Generate 중 어디서든 처리되지 않은 파이프라인 예외(RuntimeError,
# ValueError)가 발생했을 때 반환하는 안전한 문구. 내부 스택트레이스나 구현 세부사항은
# 절대 노출하지 않는다.
_PIPELINE_ERROR_MESSAGE = "일시적인 오류로 답변을 생성하지 못했습니다. 다시 시도해 주세요."


def _build_gate2_notice() -> str:
    """00_기획.md: "포트폴리오 그 자체에 대한 내용이라면 깃허브 링크를 안내합니다."

    실제 저장소 공개 URL은 01_설계.md 어디에도 확정돼 있지 않으므로 지어내지 않고
    환경변수(settings.github_repo_url)로만 받는다. 값이 없으면 링크 없이 안내 문구만
    반환한다(config.py 주석 참고)."""
    if settings.github_repo_url:
        return (
            "이 포트폴리오 웹사이트 자체의 구현 방식이나 소스코드가 궁금하시군요! "
            f"아래 GitHub 저장소에서 확인하실 수 있습니다: {settings.github_repo_url}"
        )
    return (
        "이 포트폴리오 웹사이트 자체의 구현 방식이나 소스코드가 궁금하시군요! "
        "다만 지금은 저장소 링크를 안내해드리기 어렵습니다."
    )


def _truncate_history(history: list[ChatMessage]) -> list[ChatMessage]:
    """02_구현계획.md 0장: "대화 맥락 N값 | 최근 3턴". 사용자 3개+어시스턴트 3개,
    최대 메시지 6개로 자른다. history는 이미 시간순(오래된 것 먼저)이므로 뒤에서부터
    최대 `context_window_turns * 2`개만 남긴다."""
    max_messages = settings.context_window_turns * 2
    if max_messages <= 0:
        return []
    return history[-max_messages:]


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, http_request: Request) -> ChatResponse:
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages는 최소 1개 이상이어야 합니다.")

    latest_message = request.messages[-1].content
    history = _truncate_history(request.messages[:-1])

    # Gate1/Gate2/Extract/Generate는 pipeline/dispatch.py가 프로바이더를 골라 클라이언트를
    # 직접 만든다. 여기서 만드는 클라이언트는 **Retrieve의 질의 임베딩 전용**이다 —
    # 임베딩은 프로바이더 선택과 무관하게 항상 OpenAI를 쓴다(llm/provider.py docstring).
    embedding_client = get_openai_client()
    tracer = get_tracer()

    # 8.1: "requestId 발급은 BFF(Next.js)에서 이루어져야" 한다 — FastAPI는 새 값을
    # 만들지 않고 Next.js BFF가 보낸 헤더를 그대로 받는다. 헤더가 없으면(BFF를 거치지
    # 않은 직접 호출 등) 빈 문자열로 기록한다 — 값을 지어내지 않는다.
    request_id = http_request.headers.get("x-request-id", "")

    request_start = time.perf_counter()
    with tracer.start_as_current_span("request") as root_span:
        span_context = root_span.get_span_context()
        # 8.2 root span: traceId, requestId, chatSessionId, 총 처리 시간.
        root_span.set_attribute("trace_id", format(span_context.trace_id, "032x"))
        root_span.set_attribute("request_id", request_id)
        root_span.set_attribute("chat_session_id", request.chatSessionId)
        # 02_구현계획.md 0장 "자유 텍스트 trace 저장 정책"에서 확정: 질문·답변 원문과
        # 파생 자유 텍스트(gate reason, search_intent)를 **마스킹 없이 그대로 저장**한다
        # (저장소가 홈서버 내부에만 있고 접근 권한이 관리자 1인으로 한정되므로).
        # 01_설계.md 8.6이 미결로 남기며 예로 든 배치 — "request span에 raw 입력,
        # generate span에 answer 전문" — 을 그대로 따른다.
        root_span.set_attribute("question", latest_message)

        try:
            # security.input — 8.1 순서상 Gate 1보다 먼저 실행되는 규칙 기반 스캔.
            # 8.3: risk_score만 계산해 기록하고 차단하지 않는다(blocked는 항상 False).
            with tracer.start_as_current_span("security.input") as span:
                input_scan_result = scan_input(latest_message)
                span.set_attribute("risk_score", input_scan_result.risk_score)
                span.set_attribute("blocked", input_scan_result.blocked)
                span.set_attribute(
                    "triggered_rules", input_scan_result.triggered_rules
                )

            # Gate1/Gate2/Extract/Generate 호출 전체를 하나의 try로 감싼다. 이 안에서의
            # return은(조기 종료 포함) 전부 정상 흐름이고, except는 그 정상 흐름 어디서도
            # 처리되지 않은 파이프라인 예외(RuntimeError/ValueError)만 잡는다 — 위 모듈
            # docstring 참고. span으로 감싸는 것은 이 예외 처리 흐름을 바꾸지 않는다 —
            # span context manager는 예외를 기록한 뒤 그대로 다시 던진다.

            # [Gate 1] 포트폴리오 관련 질문인가?
            with tracer.start_as_current_span("gate.portfolio") as span:
                gate1_result = run_gate_portfolio(latest_message, history)
                span.set_attribute(
                    "is_portfolio_related", gate1_result.is_portfolio_related
                )
                span.set_attribute("reason", gate1_result.reason)
            if not gate1_result.is_portfolio_related:
                return ChatResponse(
                    answer=_GATE1_REJECTION_MESSAGE,
                    isEvidenceSufficient=False,
                    citations=[],
                )

            # [Gate 2] 포트폴리오 "웹사이트 자체"에 대한 질문인가?
            with tracer.start_as_current_span("gate.site") as span:
                gate2_result = run_gate_site(latest_message, history)
                span.set_attribute(
                    "is_about_site_itself", gate2_result.is_about_site_itself
                )
                span.set_attribute("reason", gate2_result.reason)
            if gate2_result.is_about_site_itself:
                return ChatResponse(
                    answer=_build_gate2_notice(),
                    isEvidenceSufficient=False,
                    citations=[],
                )

            # [Extract] 의도 및 핵심 개념 추출
            with tracer.start_as_current_span("extract") as span:
                extract_result = run_extract(latest_message, history)
                span.set_attribute("search_intent", extract_result.search_intent)
                span.set_attribute(
                    "competencies", [c.value for c in extract_result.competencies]
                )
                span.set_attribute("technologies", extract_result.technologies)
                span.set_attribute("project_hints", extract_result.project_hints)
                span.set_attribute(
                    "wants_project_overview", extract_result.wants_project_overview
                )
                span.set_attribute(
                    "wants_alternatives_considered",
                    extract_result.wants_alternatives_considered,
                )
                span.set_attribute(
                    "wants_growth_connection", extract_result.wants_growth_connection
                )
                span.set_attribute(
                    "wants_similar_cases", extract_result.wants_similar_cases
                )
                span.set_attribute("is_followup", extract_result.is_followup)

            # [Retrieve] Graph RAG 검색 (LLM 호출 없는 코드 단계) — retrieve.graph/
            # retrieve.vector/retrieve.rank span은 retrieve() 내부에서 만든다.
            candidates = retrieve(embedding_client, extract_result)

            # [Generate] 근거 기반 답변 생성
            with tracer.start_as_current_span("generate") as span:
                generate_result, usage = run_generate(
                    latest_message, extract_result, candidates
                )
                # `model`/`llm_provider`/`llm_fallback_used` attribute는 어떤 프로바이더가
                # 실제로 응답했는지 아는 pipeline/dispatch.py가 기록한다.
                if usage is not None:
                    span.set_attribute("prompt_tokens", usage.prompt_tokens)
                    span.set_attribute("completion_tokens", usage.completion_tokens)
                    span.set_attribute("total_tokens", usage.total_tokens)
                span.set_attribute(
                    "is_evidence_sufficient", generate_result.is_evidence_sufficient
                )
                span.set_attribute(
                    "citations_count", len(generate_result.citations)
                )
                # 02_구현계획.md 0장 확정 정책(위 root span 주석 참고) — answer 전문을
                # 마스킹 없이 그대로 기록한다.
                span.set_attribute("answer", generate_result.answer)

            # security.output — Generate 이후, 실제 LLM 생성 답변만 스캔한다(Gate1/2
            # 조기 종료·파이프라인 예외 fallback은 고정 템플릿이라 스캔 대상이 아니다).
            with tracer.start_as_current_span("security.output") as span:
                output_scan_result = scan_output(generate_result.answer)
                span.set_attribute(
                    "system_prompt_exposed", output_scan_result.system_prompt_exposed
                )
                span.set_attribute(
                    "internal_info_exposed", output_scan_result.internal_info_exposed
                )
                span.set_attribute(
                    "triggered_rules", output_scan_result.triggered_rules
                )

            return ChatResponse(
                answer=generate_result.answer,
                isEvidenceSufficient=generate_result.is_evidence_sufficient,
                citations=generate_result.citations,
            )
        except (RuntimeError, ValueError, OpenAIError):
            # RuntimeError: Gate1/Gate2/Extract/Generate 중 하나가 structured output
            # 파싱에 실패(parsed is None)했거나 citation 검증을 전부 통과하지 못한 경우.
            # ValueError: GenerateResult의 citation 제약을 모델이 어겨 pydantic 검증에서
            # 예외가 난 경우(ValidationError는 ValueError의 하위 클래스).
            # OpenAIError: OpenAI API 호출 자체가 실패한 경우(인증 오류, rate limit,
            # 네트워크 오류 등) — 모델의 지시 위반과 마찬가지로 FE가 별도 에러 분기를
            # 두게 만들면 안 되는 파이프라인 내부 실패다.
            # 셋 다 Gate1/2 조기 종료와 같은 응답 모양으로 흡수한다 — span은 각 단계
            # 안에서 이미 예외를 기록했으므로 여기서는 응답만 만든다.
            return ChatResponse(
                answer=_PIPELINE_ERROR_MESSAGE,
                isEvidenceSufficient=False,
                citations=[],
            )
        finally:
            root_span.set_attribute(
                "total_duration_ms", (time.perf_counter() - request_start) * 1000
            )
