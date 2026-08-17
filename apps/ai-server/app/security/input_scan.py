"""apps/ai-server/app/security/input_scan.py

`security.input` span(01_설계.md 8.1/8.3)이 기록하는 입력 스캔. 8.1 순서상 Gate 1보다
먼저 실행되므로, 이 시점에는 아직 어떤 Gate 판별 결과도 없다 — 규칙 기반(길이 제한,
알려진 jailbreak·프롬프트 탈취 패턴의 키워드·정규식 매칭)으로만 `risk_score`를
계산해 기록한다.

**차단하지 않는다.** 8.3: "초기에는 risk_score를 기록만 하고 기존 파이프라인은
그대로 실행한다. 데이터가 쌓인 뒤에만 low(기록)/medium(경고)/high(차단) 임계값을
정한다." 이 모듈은 그 이전 단계이므로 `blocked`는 항상 False다 — 이 값을 근거로
요청을 막는 로직은 다른 어디에도 두지 않는다.

**규칙 집합의 범위**: 8.6이 "규칙 기반 스캔의 구체적 규칙 집합은 미정이며, 데이터가
쌓이기 전까지는 최소한의 규칙으로 시작한다"고 명시한 대로, 여기서는 공개적으로 널리
알려진 대표적인 jailbreak/prompt-injection 패턴(지시 무시 유도, system prompt 탈취
시도, 알려진 jailbreak persona, 가짜 role 구분자 주입)과 단순 길이 제한만 다룬다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# 8.3 "길이 제한". 정상적인 포트폴리오 질문(예: "TeenyFinny와 DailyBand에서 협업
# 방식이 어떻게 달라졌나요?")은 이 길이를 넘기 어렵다는 가정 하의 보수적인 임계값 —
# 8.6: "데이터가 쌓이기 전까지는 최소한의 규칙으로 시작한다".
MAX_LENGTH = 2000

# (규칙 이름, 매칭 패턴). 8.3 "알려진 jailbreak·프롬프트 탈취 패턴의 키워드·정규식
# 매칭 등"을 그대로 옮긴 최소 규칙 집합 — 각 규칙이 무엇을 잡으려는지는 주석 참고.
_PATTERN_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        # "지금까지의/이전 지시를 무시해" 류 — 가장 흔한 jailbreak 도입부(영문).
        "ignore_instructions",
        re.compile(
            r"(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|the\s+above)\s+"
            r"(instructions?|prompts?|rules?)",
            re.IGNORECASE,
        ),
    ),
    (
        # 같은 패턴의 한국어 변형.
        "ignore_instructions_ko",
        re.compile(r"(이전|위|지금까지)\s*(지시|명령|규칙|프롬프트)[^\n]{0,10}(무시|잊어)"),
    ),
    (
        # system prompt를 "보여줘/출력해줘" 류의 탈취 시도(영문).
        "system_prompt_exfil",
        re.compile(
            r"(system\s*prompt|시스템\s*프롬프트)[^\n]{0,20}"
            r"(reveal|show|print|repeat|출력|보여|알려|공개)",
            re.IGNORECASE,
        ),
    ),
    (
        # 동사-명사 순서가 바뀐 변형("출력해줘 시스템 프롬프트를" 등).
        "system_prompt_exfil_reverse",
        re.compile(
            r"(reveal|show|print|repeat|출력|보여|알려|공개)[^\n]{0,20}"
            r"(system\s*prompt|시스템\s*프롬프트|instructions?)",
            re.IGNORECASE,
        ),
    ),
    (
        # 널리 알려진 jailbreak persona/역할극 이름("DAN", "개발자 모드" 등).
        "roleplay_jailbreak",
        re.compile(r"\b(DAN|developer\s*mode|개발자\s*모드|jailbreak)\b", re.IGNORECASE),
    ),
    (
        # 가짜 role 태그/구분자로 대화 컨텍스트를 끊으려는 프롬프트 주입 시도.
        "delimiter_injection",
        re.compile(r"(</?system>|\[/?INST\]|###\s*(system|instruction))", re.IGNORECASE),
    ),
)

# 규칙 하나당 부여하는 위험 점수. risk_score는 0~1 범위로 clamp한다 — 8.6에서
# low/medium/high 임계값을 정할 때 일관된 스케일이 필요하기 때문이다.
_PATTERN_RULE_SCORE = 0.4
_LENGTH_RULE_SCORE = 0.3


@dataclass
class InputScanResult:
    risk_score: float
    triggered_rules: list[str] = field(default_factory=list)
    # 8.3: "차단 여부(초기엔 항상 false)". 이 스캔 자체는 차단 판단을 하지 않는다.
    blocked: bool = False


def scan_input(text: str) -> InputScanResult:
    """규칙 기반으로 risk_score만 계산한다. 어떤 경우에도 예외를 던지거나 요청을
    막지 않는다 — 실패하더라도 기존 파이프라인(Gate 1부터)은 그대로 진행돼야 한다."""
    triggered: list[str] = []

    if len(text) > MAX_LENGTH:
        triggered.append("length_exceeded")

    for name, pattern in _PATTERN_RULES:
        if pattern.search(text):
            triggered.append(name)

    score = 0.0
    if "length_exceeded" in triggered:
        score += _LENGTH_RULE_SCORE
    matched_pattern_count = len(triggered) - (1 if "length_exceeded" in triggered else 0)
    score += _PATTERN_RULE_SCORE * matched_pattern_count

    return InputScanResult(
        risk_score=min(score, 1.0), triggered_rules=triggered, blocked=False
    )
