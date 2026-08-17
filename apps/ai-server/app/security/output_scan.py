"""apps/ai-server/app/security/output_scan.py

`security.output` span(01_설계.md 8.1/8.3)이 기록하는 출력 스캔. Generate 이후,
LLM이 실제로 생성한 답변(`GenerateResult.answer`)에 시스템 프롬프트나 내부 인프라
정보(FastAPI 엔드포인트, Neo4j 스키마 세부사항 등)가 그대로 노출됐는지 규칙 기반으로
점검해 "기록만" 한다 — 8.3: "관측과 차단을 분리한다", 이 모듈은 차단 로직을 갖지 않는다.

Gate 1/2 조기 종료 응답이나 파이프라인 예외 fallback 문구는 고정 템플릿(LLM이 생성한
텍스트가 아님)이라 이 스캔의 대상이 아니다 — api/chat.py가 Generate의 answer에만
이 스캔을 적용한다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.pipeline.generate import SYSTEM_PROMPT_VERBATIM_MARKER

# 8.2 표: "시스템 프롬프트·내부 정보 노출 검사 결과" — 두 갈래로 나눠 규칙을 둔다.
#   1) 시스템 프롬프트 원문/존재를 노출하는 패턴
#   2) 내부 인프라(Neo4j 스키마, FastAPI 엔드포인트, 자격 증명) 노출 패턴
_SYSTEM_PROMPT_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "system_prompt_leak",
        re.compile(
            r"(system\s*prompt|시스템\s*프롬프트)[^\n]{0,20}"
            r"(is|says|말합니다|다음과\s*같습니다|:)",
            re.IGNORECASE,
        ),
    ),
    (
        # generate.py의 system prompt 문구가 그대로(또는 상당 부분) 재출력된 경우.
        # generate.py의 SYSTEM_PROMPT_VERBATIM_MARKER를 그대로 import해서 쓴다 —
        # 이 파일에 문자열을 따로 복사해두면 system prompt가 바뀔 때 다시 어긋날 수
        # 있다(과거에 따옴표 하나 차이로 이 규칙이 전혀 매치되지 않는 버그가 있었다).
        "system_prompt_verbatim",
        re.compile(re.escape(SYSTEM_PROMPT_VERBATIM_MARKER)),
    ),
)

_INTERNAL_INFO_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        # Neo4j 스키마 세부사항(라벨/관계명/Cypher 키워드)이 그대로 노출된 경우.
        "neo4j_schema_or_cypher",
        re.compile(
            r"\b(MATCH\s*\(|CREATE\s+VECTOR\s+INDEX|DEMONSTRATES|DESCRIBED_IN|"
            r"BUILDS_ON|INFLUENCED|CONSIDERED|Cypher|Neo4j)\b",
            re.IGNORECASE,
        ),
    ),
    (
        # FastAPI 엔드포인트/내부 호스트 정보 노출.
        "internal_endpoint",
        re.compile(r"(/chat\b|POST\s+/|FastAPI|localhost:\d+|AI_SERVER_URL)", re.IGNORECASE),
    ),
    (
        # API 키/비밀번호 등 자격 증명이 그대로 노출된 경우.
        "credentials_or_keys",
        re.compile(r"(OPENAI_API_KEY|NEO4J_PASSWORD|sk-[A-Za-z0-9]{10,})"),
    ),
)


@dataclass
class OutputScanResult:
    system_prompt_exposed: bool
    internal_info_exposed: bool
    triggered_rules: list[str] = field(default_factory=list)


def scan_output(answer: str) -> OutputScanResult:
    """규칙 기반으로 노출 여부만 계산한다. 실패해도 예외를 던지지 않고, 이 결과로
    응답을 수정하거나 막지 않는다 — Generate가 이미 반환한 answer는 그대로 FE에
    전달된다(8.3: 관측과 차단을 분리한다)."""
    system_prompt_hits = [
        name for name, pattern in _SYSTEM_PROMPT_RULES if pattern.search(answer)
    ]
    internal_info_hits = [
        name for name, pattern in _INTERNAL_INFO_RULES if pattern.search(answer)
    ]
    return OutputScanResult(
        system_prompt_exposed=bool(system_prompt_hits),
        internal_info_exposed=bool(internal_info_hits),
        triggered_rules=system_prompt_hits + internal_info_hits,
    )
