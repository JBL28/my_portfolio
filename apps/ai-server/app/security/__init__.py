"""apps/ai-server/app/security — 01_설계.md 8.3 규칙 기반 보안 스캔.

- input_scan.py    security.input span이 기록하는 입력 스캔(Gate 1보다 먼저 실행)
- output_scan.py   security.output span이 기록하는 출력 스캔(Generate 이후 실행)

8.3의 핵심 원칙: **이 규칙 기반 스캔은 보안 경계가 아니라 관측을 위한 휴리스틱
신호다.** 정규식·키워드 매칭은 우회하기 쉽고 오탐도 발생한다. 실제 보안은 AI 서버
주소 비공개(1장), 요청 인증, RAG 근거를 원문 범위로 제한하는 구조적 제약(2장)에
의존하며, 이 모듈들은 그 통제를 보완하는 모니터링 수단일 뿐이다 — 이 모듈의 결과로
요청을 차단하지 않는다(risk_score는 항상 기록만 한다).
"""
