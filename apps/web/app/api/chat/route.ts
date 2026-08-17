/**
 * BFF Route Handler(01_설계.md 5.1, 5.4). 브라우저는 이 경로(`/api/chat`, 같은
 * origin)로만 요청하고, 이 서버 프로세스만 FastAPI 주소(AI_SERVER_URL)를 안다
 * (1장 핵심 원칙) — `NEXT_PUBLIC_` 접두사를 쓰지 않아 클라이언트 번들에 절대
 * 노출되지 않는다.
 *
 * 01_설계.md 8.1(관측성/AISecOps, Phase 05): 요청마다 UUID v4로 requestId를 생성해
 * `X-Request-ID` 헤더에 실어 FastAPI로 전달한다 — "requestId 발급은 BFF에서 이루어져야"
 * 하기 때문이다(8.1). 브라우저가 이미 `X-Request-ID`를 보냈더라도 그 값을 신뢰하지
 * 않고 항상 새로 생성한 값으로 덮어쓴다 — "외부에서 들어온 요청에 이미 X-Request-ID가
 * 실려 있어도 이를 신뢰하지 않고 BFF가 항상 새 값을 생성해 덮어쓴다. 그렇지 않으면
 * 임의의 값을 보내 서로 다른 요청의 로그를 같은 요청처럼 보이게 만들 수 있다"(8.1).
 * 이 파일은 그 외에는 여전히 단순 프록시다 — rate limiting(8.4) 등 실제 인프라 설정은
 * Phase 06(배포) 범위이므로 여기서 구현하지 않는다.
 */

const AI_SERVER_URL = process.env.AI_SERVER_URL;

export async function POST(request: Request) {
  if (!AI_SERVER_URL) {
    return Response.json(
      { error: "AI_SERVER_URL이 서버에 설정되어 있지 않습니다." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "요청 본문을 JSON으로 해석할 수 없습니다." },
      { status: 400 },
    );
  }

  // 8.1: 클라이언트가 보낸 X-Request-ID는 무시하고 BFF가 항상 새로 생성한다.
  const requestId = crypto.randomUUID();

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(`${AI_SERVER_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return Response.json(
      { error: "AI 서버에 연결하지 못했습니다." },
      { status: 502 },
    );
  }

  const data = await upstreamResponse.json();
  return Response.json(data, { status: upstreamResponse.status });
}
