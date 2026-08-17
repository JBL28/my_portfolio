"""apps/ai-server/app/schemas/structured_outputs.py

OpenAI Structured Outputs로 강제할 4개 스키마(Gate1, Gate2, Extract, Generate)를
01_설계.md 2장 "Graph RAG 파이프라인 설계"에 정의된 문장 그대로 pydantic 모델로 옮긴다.
필드를 임의로 줄이거나 추가하지 않는다 — 이 문서 안의 필드 하나하나가 2장의 스키마
정의 문장과 1:1로 대응해야 한다.

**표기 규칙**: 이 파일의 필드명 대소문자 표기(snake_case vs camelCase)는 01_설계.md
원문의 표기를 그대로 따른다. Gate1/Gate2/Extract/Generate의 최상위 필드는 원문이
snake_case로 적어둔 그대로(예: is_portfolio_related, search_intent, is_evidence_sufficient)
이고, citations·refers_to_previous_citations 안의 객체 필드(sectionId, caseId, projectSlug,
path, anchor, quotedTitle)는 원문이 camelCase로 적어둔 그대로다 — 이 객체들은 그대로
FE(클라이언트)로 전달되는 계약 객체이기 때문이다. 같은 파일 안에서 두 표기가 섞여
있는 것은 설계 문서 자체가 그렇게 표기하고 있어서이며, 임의로 통일하지 않는다.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, model_validator


class Competency(str, Enum):
    """3.4에서 정의한 7개 Competency 고정값(scripts/load_graph.py의 COMPETENCIES 상수와
    동일). Extract의 competencies는 이 enum으로만 제한된다 — OpenAI Structured Outputs의
    strict JSON Schema가 이 enum을 그대로 강제하므로, 모델이 이 목록 밖 값을 반환하는
    것 자체가 스키마 단에서 원천 차단된다(후처리로 걸러내는 로직이 아니다)."""

    COLLABORATION = "협업"
    TECHNICAL_JUDGMENT = "기술적 판단"
    PROBLEM_SOLVING = "문제 해결"
    OPERATIONS = "운영"
    DEVOPS = "DevOps"
    AI_UTILIZATION = "AI 활용"
    GROWTH_AND_LEARNING = "학습 및 성장"


# ---------------------------------------------------------------------------
# [Gate 1] 포트폴리오 관련 질문인가?
# schema: { is_portfolio_related: bool, reason: string }
# ---------------------------------------------------------------------------


class Gate1Result(BaseModel):
    is_portfolio_related: bool
    reason: str


# ---------------------------------------------------------------------------
# [Gate 2] 포트폴리오 "웹사이트 자체"(구현/소스코드)에 대한 질문인가?
# schema: { is_about_site_itself: bool, reason: string }
# ---------------------------------------------------------------------------


class Gate2Result(BaseModel):
    is_about_site_itself: bool
    reason: str


# ---------------------------------------------------------------------------
# [Extract] 의도 및 핵심 개념 추출 (대화 맥락 포함)
# ---------------------------------------------------------------------------


class PreviousCitationRef(BaseModel):
    """refers_to_previous_citations의 원소:
    { sectionId: string, caseId: string | null }
    is_followup=true일 때, 클라이언트가 함께 보낸 이전 턴 citations 중 이 질문이
    가리키는 것."""

    sectionId: str
    caseId: str | None


class ExtractResult(BaseModel):
    search_intent: str = Field(description="정규화된 검색 의도")
    competencies: list[Competency] = Field(
        default_factory=list,
        description=(
            "3.4에서 정의한 7개로 제한된 enum — strict JSON Schema가 이 목록 밖 값을 "
            "원천 차단한다(후처리로 거르지 않는다)"
        ),
    )
    technologies: list[str] = Field(
        default_factory=list,
        description=(
            "자유 텍스트 추출. Retrieve에서 alias→canonical 정규화 후 Technology와 "
            "매칭(4장 참고)"
        ),
    )
    project_hints: list[str] = Field(
        default_factory=list,
        description=(
            "언급된 프로젝트 0개/1개/여러 개 모두 가능"
            '(예: "TeenyFinny와 DailyBand에서 협업 방식이 어떻게 달라졌나요?")'
        ),
    )
    wants_project_overview: bool = Field(
        description="기간/팀 구성/담당 역할/기술 스택/결과 등 프로젝트 메타데이터를 묻는 질문인지"
    )
    wants_alternatives_considered: bool = Field(
        description=(
            '"여러 대안 중 하나를 선택한 사례가 있나요?" 같이 CONSIDERED 관계가 '
            "필요한 질문인지"
        )
    )
    wants_growth_connection: bool = Field(
        description=(
            '"이전 경험이 다음 프로젝트에 어떻게 반영/영향을 줬나요?" 같이 '
            "BUILDS_ON/INFLUENCED 관계가 필요한 질문인지"
        )
    )
    wants_similar_cases: bool = Field(
        description=(
            '"비슷한 경험이 다른 프로젝트에도 있나요?" 같이, 직전 답변의 근거 Case와 '
            "유사한 Case를 다른 프로젝트에서 확장 검색해야 하는 후속 질문인지"
        )
    )
    is_followup: bool = Field(description='"그 근거가 뭔가요?" 같은 후속 질문 여부')
    refers_to_previous_citations: list[PreviousCitationRef] = Field(
        default_factory=list,
        description=(
            "is_followup=true일 때, 클라이언트가 함께 보낸 이전 턴 citations 중 "
            "이 질문이 가리키는 것"
        ),
    )


# ---------------------------------------------------------------------------
# [Generate] 근거 기반 답변 생성
# ---------------------------------------------------------------------------


class Citation(BaseModel):
    """citations의 원소:
    { sectionId, caseId: string | null, projectSlug: string | null, path, anchor, quotedTitle }
    """

    sectionId: str
    caseId: str | None = Field(
        description=(
            "Case 없는 Section(배경 설명 등)·Overview·Home Profile Section을 인용할 "
            "때는 null"
        )
    )
    projectSlug: str | None = Field(
        description=(
            "nullable — Home Profile Section(3.2)은 특정 프로젝트에 속하지 않으므로 null"
        )
    )
    path: str
    anchor: str
    quotedTitle: str = Field(
        description=(
            "caseId가 있으면 그 Case.title(4장 2번), caseId가 없으면(Case 없는 "
            "Section·Overview·Home Profile Section) Section.title을 사용한다. "
            "어느 쪽이든 Section.body 자체가 아니라 인용 링크에 표시할 짧은 제목이다."
        )
    )


class GenerateResult(BaseModel):
    answer: str
    is_evidence_sufficient: bool
    citations: list[Citation] = Field(default_factory=list)

    @model_validator(mode="after")
    def _check_citation_constraint(self) -> "GenerateResult":
        """is_evidence_sufficient=true일 때만 citations 최소 1개 이상.
        false면 citations=[] 허용한다 — "근거 없음"과 "인용 강제"가 충돌하지
        않도록 분리한다(2장 Generate schema 주석, 6장 대응표)."""
        if self.is_evidence_sufficient and not self.citations:
            raise ValueError(
                "is_evidence_sufficient=true이면 citations가 최소 1개 이상이어야 합니다."
            )
        return self
