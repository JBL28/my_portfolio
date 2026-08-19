# 배포 (Phase 06 — 02_구현계획.md 1장 7번)

01_설계.md 0장(홈서버 Docker)·1장 **경로 B(홈서버 내부 배포 — 02_구현계획.md 0장 확정)**·8장(관측성/AISecOps)을 그대로 구현한 배포 계층이다.

## 형상

```
Browser ── HTTPS ──> Cloudflare Tunnel ──> nginx ──> web(Next.js)
                                                        │ (internal 네트워크, AI_SERVER_URL은 서버 전용)
                                                        ▼
                                                   ai-server(FastAPI) ──> neo4j
                                                        │                (그래프 + 벡터 인덱스)
                                                        ▼ OTLP
                                                     phoenix (SQLite)
```

- 브라우저는 nginx(같은 origin)까지만 도달한다. ai-server/neo4j/phoenix는 `internal` 네트워크에만 있어 외부에서 접근할 수 없다 — 1장 핵심 원칙("브라우저는 FastAPI 주소를 알 수 없다").
- 경로 B(내부망 직접 호출)이므로 1장의 공유 시크릿 헤더(`X-Internal-Token`) 인증 계층은 설계상 **선택 사항**이며 두지 않았다.
- TLS는 Cloudflare Tunnel이 종단한다(Home Server 프로젝트 인프라 재사용 — "공개 서비스는 Cloudflare Tunnel → Nginx"). `cloudflared`가 이 호스트의 `NGINX_HTTP_PORT`(기본 8080)를 가리키게 한다.

## 실행

```bash
cd deploy
cp .env.example .env   # 실제 값 입력 (NEO4J_PASSWORD, OPENAI_API_KEY, GITHUB_REPO_URL)
docker compose up -d --build
```

첫 기동 후(또는 data/ 수정 후) 그래프 적재:

```bash
docker compose exec ai-server python scripts/load_graph.py
```

- `data/`는 ai-server 컨테이너에 읽기 전용 바인드 마운트되어 있어 재적재에 이미지 리빌드가 필요 없다.
- 단, 웹 화면은 SSG 산출물이므로 `data/` 수정 시 `docker compose up -d --build web`으로 web 이미지를 다시 빌드해야 화면에 반영된다 — 01_설계.md 4장 8번 동기화 규칙(FE와 Neo4j가 같은 원본을 공유하되 각자 재생성).

## 관리용 접근 (홈서버 내부 한정 — 8.6)

localhost에만 바인드되어 있으므로 SSH 포트포워딩 또는 Tailscale 경유로 접근한다.

| 도구 | 주소 |
|---|---|
| Phoenix UI (trace 조회) | http://127.0.0.1:6006 |
| Neo4j Browser | http://127.0.0.1:7474 (bolt: 127.0.0.1:7687) |

## 구현 단계에서 확정한 값 (설계가 위임한 항목)

| 항목 | 값 | 설계 근거 |
|---|---|---|
| rate limiting | `/api/chat` IP당 10r/m + burst 5 (429) | 8.4 — 임계값은 8.6 원칙대로 보수적 초기값, 실측 후 재조정 |
| requestId 형식 | BFF가 UUID v4 생성 (`crypto.randomUUID()`) | 8.1/8.6 |
| requestId Nginx 로그 | BFF가 응답 헤더 `X-Request-ID`로 되돌려주고 access log에 `$sent_http_x_request_id`로 기록. 여기서 차단된(429) 요청은 BFF 미도달로 requestId가 없음(8.4의 "차단된 요청은 trace가 없다"와 동일 원리) | 8.4/8.6 |
| Phoenix 저장소 | SQLite (`phoenix-data` 볼륨) — 필요 시 PostgreSQL 전환 | 8.5 |
| OTLP 전송 | HTTP/protobuf, `OTEL_EXPORTER_OTLP_ENDPOINT=http://phoenix:6006` | 8.5 |
| Neo4j 메모리 | heap 512m / pagecache 256m (N100급 기준 보수값) | 0장 홈서버 전제 |
