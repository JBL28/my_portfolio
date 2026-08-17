"""apps/ai-server/app — Phase 03: FastAPI Graph RAG AI 서버.

01_설계.md 2장(Graph RAG 파이프라인 설계)을 코드로 옮긴 패키지다. 하위 모듈:

- config.py            환경변수 로드
- schemas/              pydantic 모델 (OpenAI Structured Outputs 스키마 + /chat 계약)
- graph/                Neo4j driver 연결 + Retrieve가 쓰는 Cypher 쿼리
- pipeline/             Gate1 / Gate2 / Extract / Retrieve / Generate 각 단계
- api/                  FastAPI 라우터 (POST /chat)
- main.py               FastAPI 앱 진입점
"""
