"""apps/ai-server/app/pipeline/generate.py

[Generate] 선택된 근거(Section.body + 연결된 Case 필드 + path/anchor/project 정보)를
바탕으로 근거 기반 답변을 생성한다. 01_설계.md 2장 [Generate]의 system prompt 제약
4가지를 그대로 반영한다:
  1. 제공된 Section.body 범위 밖의 사실을 추론하지 않는다(Case 필드는 참고 정보일 뿐).
  2. Project-USES/Overview는 팀 사용의 근거일 뿐 개인 기여의 근거가 아니다.
  3. 근거가 부족하면 부족하다고 답하고 citations를 비운다.
  4. 답변은 짧게 요약하고, 상세 확인은 Section 링크로 유도한다(AI는 탐색 수단).

`run_generate`는 파싱된 `GenerateResult`와 함께 OpenAI 응답의 토큰 사용량
(`CompletionUsage`)도 함께 반환한다 — 파이프라인 알고리즘 자체는 그대로이고, 8.2가
`generate` span에 요구하는 "토큰 사용량"을 기록하려면 `client.beta.chat.completions.parse`
호출이 반환하는 raw completion에서만 얻을 수 있는 값이라 이 최소한의 반환값 추가가
필요하다(api/chat.py가 이 값을 span attribute로 기록한다).

**citation 무결성 방어(2장 [Generate] "citations는 실제로 답변에 사용한 근거 후보에서만
만든다")**: 이 제약은 프롬프트 지시만으로는 보장되지 않으므로(모델이 존재하지 않는
sectionId/path/anchor를 지어낼 수 있다), extract.py의 refers_to_previous_citations
후처리와 동일한 원칙으로 서버가 사후 검증한다 — sectionId가 실제 후보(Candidate)에
있는지 확인하고, caseId가 그 Section에 연결된 Case인지 확인한 뒤,
projectSlug/path/anchor/quotedTitle은 모델 출력값을 신뢰하지 않고 후보의 실제 값으로
서버가 재구성한다. FE는 citation.path#citation.anchor로 바로 이동하므로(5.4), 이
검증 없이는 모델의 단 한 번의 오출력으로 존재하지 않는 링크가 만들어질 수 있다.
"""
from __future__ import annotations

from openai import OpenAI
from openai.types.completion_usage import CompletionUsage

from app.config import settings
from app.pipeline.retrieve import Candidate
from app.schemas.structured_outputs import Citation, ExtractResult, GenerateResult

# app/security/output_scan.py의 system_prompt_verbatim 규칙이 이 문자열을 그대로
# import해서 사용한다 — _SYSTEM_PROMPT 문구가 바뀌어도 탐지 규칙이 따로 노는 일이
# 없도록, 두 곳에 같은 문자열을 중복 유지하지 않는다. 따옴표 등 특수문자가 없는
# 안전한 부분 문자열이어야 한다(정규식 리터럴이므로).
SYSTEM_PROMPT_VERBATIM_MARKER = "목록만을 근거로 답한다"

_SYSTEM_PROMPT = """당신은 포트폴리오 웹사이트에 내장된 Graph RAG 챗봇의 답변 생성 단계다.
아래 제공되는 "근거 후보" 목록만을 근거로 답한다. 다음 제약을 반드시 지킨다:

1. 각 후보의 body(Section 원문) 범위 밖의 사실을 추론하지 않는다. 함께 제공되는 Case
   필드(problem/judgment/action/result/learning)는 검색·요약을 돕는 참고 정보일 뿐이며,
   최종 근거는 반드시 Section.body로 뒷받침되어야 한다.
2. caseId 없이 projectSlug만 있는 후보(Overview, 또는 Project 단위 기술 매칭으로 들어온
   근거)는 "그 프로젝트에서 그 기술이 사용됐다"는 근거일 뿐, 지원자 개인이 직접
   구현·사용했다는 근거가 아니다. 개인의 직접 기여를 주장하려면 Case 또는 Section
   원문에서 본인의 행동·판단이 명시적으로 확인되어야 한다. 이 구분을 답변에서 흐리지 않는다.
3. 근거 후보 중 질문에 실제로 답할 만한 것이 없거나 부족하면, 부족하다고 솔직히 답하고
   is_evidence_sufficient=false, citations는 빈 배열로 둔다. 근거가 부족한 후보를
   억지로 끌어와 채우지 않는다.
4. 답변은 관련 경험을 짧게 요약해 탐색을 돕는 수준으로 제한한다. 당신은 포트폴리오를
   대신 설명하는 주체가 아니라, 사용자가 포트폴리오 원문의 근거를 더 빠르게 찾도록 돕는
   탐색 수단이다 — 상세 내용을 answer에서 길게 풀어 쓰지 말고, 자세한 내용은 인용된
   Section 링크에서 확인하라고 안내한다.

citations는 실제로 답변에 사용한 근거 후보에서만 만든다 — sectionId/path/anchor/projectSlug
값은 그 후보에 주어진 값을 그대로 사용하고 새로 지어내지 않는다. quotedTitle은 caseId가
있으면 그 Case의 title을, caseId가 없으면 그 Section의 title을 그대로 사용한다.
사용자 질문과 같은 언어로 답하되, 특별한 근거가 없으면 한국어로 답한다."""


def _format_case(case: dict) -> str:
    lines = [f"  - caseId: {case['id']}", f"    title: {case['title']}"]
    for field_name in ("problem", "judgment", "action", "result", "learning"):
        value = case.get(field_name)
        if value:
            lines.append(f"    {field_name}: {value}")
    return "\n".join(lines)


def _format_candidate(index: int, candidate: Candidate) -> str:
    lines = [
        f"[근거 후보 {index}]",
        f"sectionId: {candidate.section_id}",
        f"projectSlug: {candidate.project_slug if candidate.project_slug is not None else 'null'}",
        f"path: {candidate.path}",
        f"anchor: {candidate.anchor}",
        f"title: {candidate.title}",
        "body:",
        candidate.body,
    ]
    if candidate.cases:
        lines.append("관련 Case:")
        for case in candidate.cases:
            lines.append(_format_case(case))
    else:
        lines.append("관련 Case 없음")
    if candidate.followup_case_id is not None:
        lines.append(
            "참고: 사용자가 이전 답변의 이 근거(sectionId="
            f"{candidate.section_id}, caseId={candidate.followup_case_id})를 "
            "구체적으로 가리키며 후속 질문을 하고 있다."
        )
    return "\n".join(lines)


def build_context(candidates: list[Candidate]) -> str:
    if not candidates:
        return "근거 후보 없음."
    return "\n\n".join(
        _format_candidate(i + 1, candidate) for i, candidate in enumerate(candidates)
    )


def _validate_and_rebuild_citations(
    result: GenerateResult, candidates: list[Candidate]
) -> GenerateResult:
    """모듈 docstring의 citation 무결성 방어. 스키마 레벨에서는 "후보 안의 값만 허용"을
    강제할 수 없으므로(자유 문자열 필드) 서버가 사후 검증한다:

    - sectionId가 실제 후보에 없는 citation은 버린다(지어낸 근거).
    - caseId가 있으면 그 Section에 연결된 Case인지 확인하고, 아니면 caseId를 null로
      되돌린다 — Section 자체는 실제 사용된 후보이므로 Section 인용으로 유지한다.
    - projectSlug/path/anchor/quotedTitle은 모델 출력값을 쓰지 않고 후보의 실제 값으로
      재구성한다(quotedTitle 규칙은 2장 [Generate] 스키마 주석 그대로 — caseId가 있으면
      Case.title, 없으면 Section.title).
    - is_evidence_sufficient=true인데 검증을 통과한 citation이 하나도 없으면, structured
      output 파싱 실패와 동일하게 RuntimeError를 던진다 — api/chat.py가 안전한
      ChatResponse로 흡수한다(2장 Generate schema의 "true면 citations 최소 1개" 제약).
    """
    candidate_by_section_id = {c.section_id: c for c in candidates}
    seen: set[tuple[str, str | None]] = set()
    rebuilt: list[Citation] = []

    for citation in result.citations:
        candidate = candidate_by_section_id.get(citation.sectionId)
        if candidate is None:
            continue

        case = None
        if citation.caseId is not None:
            case = next(
                (c for c in candidate.cases if c["id"] == citation.caseId), None
            )

        key = (candidate.section_id, case["id"] if case else None)
        if key in seen:
            continue
        seen.add(key)

        rebuilt.append(
            Citation(
                sectionId=candidate.section_id,
                caseId=case["id"] if case else None,
                projectSlug=candidate.project_slug,
                path=candidate.path,
                anchor=candidate.anchor,
                quotedTitle=case["title"] if case else candidate.title,
            )
        )

    if result.is_evidence_sufficient and not rebuilt:
        raise RuntimeError(
            "Generate가 실제 근거 후보에 존재하지 않는 citation만 반환했습니다."
        )
    return result.model_copy(update={"citations": rebuilt})


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

    completion = client.beta.chat.completions.parse(
        model=settings.generate_model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format=GenerateResult,
    )
    result = completion.choices[0].message.parsed
    if result is None:
        raise RuntimeError("Generate structured output 파싱에 실패했습니다.")
    return _validate_and_rebuild_citations(result, candidates), completion.usage
