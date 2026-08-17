"""apps/ai-server/app/observability/tracing.py

OpenTelemetry SDK 초기화. 01_설계.md 8.1:

    [ FastAPI ]  ── 요청 1개당 Trace 1개 시작, requestId를 trace attribute로 기록
        ├─ security.input span
        ├─ gate.portfolio  span
        ├─ gate.site       span
        ├─ extract         span
        ├─ retrieve.graph  span
        ├─ retrieve.vector span
        ├─ retrieve.rank   span
        ├─ generate        span
        └─ security.output span
        ▼ OTLP export
    [ Observability Backend ]  (candidate: Phoenix — 확정 아님, 8.6)

8.5: "FastAPI는 OTLP로 trace를 export하기만 하면 되고 Next.js·Neo4j 쪽 구조 변경은
필요 없다." 실제 backend 배포(Docker, SQLite 등)는 Phase 06 범위이므로 이 모듈은
OpenTelemetry 표준 환경변수(OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS 등,
OTLPSpanExporter가 인자 없이 생성될 때 자동으로 읽는다)로만 export 대상을 받는다.

**방어적으로 짠다**: 엔드포인트 미설정이거나 exporter 초기화가 실패해도 서버 기동을
막지 않는다 — 이 계측은 부가 기능이지 파이프라인의 필수 경로가 아니다. 초기화가
실패하면 아무 exporter도 붙지 않은 TracerProvider로 계속 진행한다(span 생성 자체는
계속 동작하지만 어디로도 export되지 않을 뿐이다 — 애플리케이션 코드 입장에서는
차이가 없다. get_tracer()가 반환하는 tracer로 span을 만드는 코드는 항상 안전하다).
"""
from __future__ import annotations

import logging

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

logger = logging.getLogger(__name__)

# Phoenix 등 OTLP backend에서 이 서버의 trace를 다른 서비스와 구분하기 위한 이름.
_SERVICE_NAME = "portfolio-ai-server"

_configured = False


def configure_tracing() -> None:
    """앱 시작 시(main.py lifespan) 한 번 호출한다. 이미 설정돼 있으면 아무 것도 하지
    않는다(테스트 등에서 여러 번 호출돼도 TracerProvider를 중복 등록하지 않기 위함)."""
    global _configured
    if _configured:
        return

    provider = TracerProvider(resource=Resource.create({"service.name": _SERVICE_NAME}))

    try:
        # opentelemetry-exporter-otlp(HTTP/protobuf variant). 인자 없이 생성하면
        # OTEL_EXPORTER_OTLP_ENDPOINT/OTEL_EXPORTER_OTLP_HEADERS 등 OpenTelemetry
        # 표준 환경변수를 그대로 읽는다 — 이 서버가 직접 endpoint를 지어내지 않는다
        # (8.5: 실제 backend 주소는 Phase 06 배포 설정 몫).
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )

        exporter = OTLPSpanExporter()
        provider.add_span_processor(BatchSpanProcessor(exporter))
    except Exception:  # noqa: BLE001 - 계측 초기화 실패가 서버 기동을 막으면 안 된다.
        logger.warning(
            "OTLP exporter를 초기화하지 못했습니다(OTEL_EXPORTER_OTLP_ENDPOINT 등 "
            "환경변수를 확인하세요). span은 계속 생성되지만 어디로도 export되지 "
            "않습니다.",
            exc_info=True,
        )

    trace.set_tracer_provider(provider)
    _configured = True


def shutdown_tracing() -> None:
    """앱 종료 시(main.py lifespan) 호출한다. 큐에 남은 span을 flush한다. 실패해도
    앱 종료를 막지 않는다."""
    try:
        provider = trace.get_tracer_provider()
        shutdown = getattr(provider, "shutdown", None)
        if callable(shutdown):
            shutdown()
    except Exception:  # noqa: BLE001 - 종료 경로에서도 예외를 삼킨다.
        logger.warning("TracerProvider 종료 중 오류가 발생했습니다.", exc_info=True)


def get_tracer() -> trace.Tracer:
    """파이프라인 코드(api/chat.py, pipeline/retrieve.py)가 span을 생성할 때 쓰는
    tracer. configure_tracing()을 호출하기 전에 불러도 동작한다 — OpenTelemetry API는
    global TracerProvider가 아직 no-op이어도 안전하게 tracer를 반환한다."""
    return trace.get_tracer(_SERVICE_NAME)
