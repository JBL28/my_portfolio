"""apps/ai-server/app/observability — 01_설계.md 8장(관측성/AISecOps) 계측 모음.

- tracing.py   OpenTelemetry SDK 초기화(TracerProvider, OTLP exporter) + get_tracer()

Phase 05(8장) 범위: FastAPI 파이프라인(Gate1/Gate2/Extract/Retrieve/Generate)의 각
단계를 span으로 계측한다(8.1/8.2). 실제 관측성 backend 배포(Phoenix, 8.5)는 Phase 06
범위이므로 여기서는 OpenTelemetry 표준 환경변수로 OTLP endpoint를 받기만 하고,
endpoint가 없어도 서버 기동이 죽지 않도록 방어적으로 초기화한다.
"""
