# Portfolio

이 저장소는 백엔드 개발자 이정복의 포트폴리오 사이트입니다. 만드는 동안 코드는 한 줄도 직접 쓰지 않았습니다. 그러나, 

들인 노력은 적지 않았습니다. **조사부터 기획, 설계, 구현, 검증까지 전 과정을 [research/](research/)에 남겼습니다.**

## 사이트가 하는 일

채용 담당자는 짧은 시간에 지원자를 파악해야 합니다. 프로젝트가 늘어날수록 근거가 되는 사례는 본문 곳곳에 흩어집니다. 그래서 Graph RAG 챗봇을 붙였습니다. 자연어로 질문하면 관련 사례를 찾아 **포트폴리오 원문을 근거로** 답하고 그 문단으로 가는 링크를 함께 줍니다. 포트폴리오를 대신 설명하는 AI가 아니라, 근거를 더 빨리 찾게 돕는 탐색 수단입니다.

원문에 없는 사실은 추론하지 않고 근거가 부족하면 부족하다고 답합니다.

## 파이프라인

```
질문 ──> Gate 1 ──> Gate 2 ──> Extract ──> Retrieve ──> Generate ──> 답변 + 인용 링크
       포트폴리오   사이트 자체에    의도·역량·      Neo4j 그래프 탐색
       관련 질문?   대한 질문?      기술 추출       + 벡터 유사도
          │            │
          └ 안내 문구   └ GitHub 링크
```

Gate 1·2와 Extract, Generate는 structured outputs로 스키마를 강제합니다. Retrieve는 LLM 없이 Cypher와 벡터 검색만 씁니다. 그래프 노드는 `Section`(원문 문단 + path/anchor), `Case`(문제-판단-행동-결과), `Competency`, `Technology`, `Project`이며 모두 원문에서 확인되는 내용만 담습니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| Web | Next.js 16 (App Router, SSG + API Route BFF), React 19, TypeScript, Tailwind CSS 4, Motion, next-themes |
| AI Server | FastAPI, Python 3.12, Upstage Solar(기본) + OpenAI(폴백), OpenAI Embeddings |
| Graph DB | Neo4j 5 (그래프 + 1536차원 벡터 인덱스) |
| 관측성 | OpenTelemetry → Arize Phoenix |
| 배포 | Docker Compose, nginx, Cloudflare Tunnel, 홈서버 (Portainer) |
| CI/CD | GitHub Actions, SonarQube Quality Gate, Docker Hub, Tailscale |

## 구조

```
apps/web/         Next.js — 정적 포트폴리오 페이지 + /api/chat BFF
apps/ai-server/   FastAPI — Graph RAG 파이프라인, Neo4j 적재 스크립트
data/             단일 원본 (프로필·프로젝트·RAG 케이스 JSON)
deploy/           docker compose, nginx 설정
research/         이 프로젝트가 만들어진 전 과정
```

`data/`는 단일 원본입니다. 웹(SSG 빌드)과 Neo4j(그래프 적재)가 이 원본을 함께 씁니다. 수정하면 양쪽을 각각 재생성해야 합니다.

## 실행

```bash
cd deploy
cp .env.example .env          # NEO4J_PASSWORD, OPENAI_API_KEY 등 입력
docker compose up -d --build
docker compose exec ai-server python scripts/load_graph.py   # 그래프 적재
```

브라우저는 nginx까지만 닿습니다. `ai-server`·`neo4j`·`phoenix`는 internal 네트워크에만 있고 AI 서버 주소는 서버 컴포넌트 안에만 둡니다. 배포 형상과 관리용 접근 경로는 [deploy/README.md](deploy/README.md)에 있습니다.

웹만 따로 띄우려면:

```bash
cd apps/web && npm ci && npm run dev
```

## CI/CD

`main` 푸시 시 [.github/workflows/ci.yml](.github/workflows/ci.yml)이 두 앱을 각각 검사합니다. 빌드·타입체크·린트 → SonarQube 분석 → Quality Gate → 이미지 빌드/푸시 → Tailscale로 홈서버 내부망에 붙어 Portainer 스택 재배포. 앱마다 프로젝트를 나눈 이유는 게이트가 깨졌을 때 어느 쪽인지 바로 보이게 하려는 것입니다. 한쪽이 실패해도 다른 쪽 이미지 빌드는 막히지 않습니다.
