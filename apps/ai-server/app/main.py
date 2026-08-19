"""apps/ai-server/app/main.py

FastAPI 앱 진입점. `api/chat.py`의 라우터(POST /chat)를 등록하고, 앱 시작 시
OpenTelemetry 계측(01_설계.md 8장)을 초기화하며, 앱 종료 시 `graph/client.py`의
Neo4j driver와 tracer provider를 정리한다.

01_설계.md 1장: "브라우저는 오직 Next.js(같은 origin)와만 통신한다"·"Next.js에서만
내부망으로 호출"되는 내부 서버이므로, CORS 등 브라우저 직접 접근을 전제한 미들웨어는
이 파일에서 추가하지 않는다(1장에 없는 요소를 임의로 넣지 않는다는 과업 지시에 따름).
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.graph.client import close_driver
from app.llm.provider import warn_if_incomplete
from app.observability.tracing import configure_tracing, shutdown_tracing


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # 8.1: FastAPI가 요청 1개당 Trace 1개를 시작하는 지점이므로, 앱 기동 시점에
    # TracerProvider/OTLP exporter를 한 번 설정한다. 엔드포인트 미설정 등으로 실패해도
    # 서버 기동 자체는 막지 않는다(tracing.py 주석 참고).
    configure_tracing()
    # 어떤 LLM 프로바이더 체인으로 뜨는지 기동 시 한 번 남긴다. 특히 OPENAI_API_KEY가
    # 없는 구성은 Gate 1/2만 동작하고 Retrieve->Generate가 반드시 실패하므로, 첫 요청이
    # 들어오기 전에 드러나야 한다(llm/provider.py docstring). 기동은 막지 않는다.
    warn_if_incomplete()
    yield
    # 앱 종료 시 Neo4j driver 커넥션을 명시적으로 정리한다(graph/client.py 주석 참고).
    close_driver()
    # 큐에 남아 있던 span을 flush한다.
    shutdown_tracing()


app = FastAPI(
    title="Portfolio Graph RAG AI Server",
    description=(
        "01_설계.md 2장의 Graph RAG 파이프라인(Gate1 -> Gate2 -> Extract -> Retrieve -> "
        "Generate)을 노출하는 내부 전용 FastAPI 서버. Next.js BFF(Phase 04)에서만 호출된다."
    ),
    lifespan=lifespan,
)

app.include_router(chat_router)
