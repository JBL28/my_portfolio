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
 * 생성한 requestId는 응답 헤더 `X-Request-ID`로도 되돌려준다 — 8.4: "Nginx/BFF 쪽
 * 로그에 8.1의 requestId를 함께 남겨 나중에 조회할 수 있게 한다". 홈서버 내부 배포
 * (1장 경로 B)에서는 Nginx가 이 BFF **앞**의 공개 진입점이라 요청 헤더로는 requestId를
 * 알 수 없으므로, 응답 헤더를 `$sent_http_x_request_id`로 access log에 남긴다
 * (deploy/nginx/default.conf 참고 — 8.6이 구현 단계 결정으로 위임한 항목).
 *
 * 이 파일은 그 외에는 여전히 단순 프록시다 — rate limiting(8.4) 등 실제 인프라 설정은
 * Nginx(deploy/) 계층의 책임이므로 여기서 구현하지 않는다.
 */

const AI_SERVER_URL = process.env.AI_SERVER_URL;

export async function POST(request: Request) {
  // 8.1: BFF가 요청을 받은 시점에 requestId를 생성한다. 클라이언트가 보낸
  // X-Request-ID는 무시하고 항상 새로 생성한다.
  const requestId = crypto.randomUUID();
  const responseHeaders = { "X-Request-ID": requestId };

  if (!AI_SERVER_URL) {
    return Response.json(
      { error: "AI_SERVER_URL이 서버에 설정되어 있지 않습니다." },
      { status: 500, headers: responseHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "요청 본문을 JSON으로 해석할 수 없습니다." },
      { status: 400, headers: responseHeaders },
    );
  }

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
      { status: 502, headers: responseHeaders },
    );
  }

  // FastAPI가 예기치 못한 오류로 JSON이 아닌 본문(예: 프레임워크 기본 500 텍스트)을
  // 반환하더라도 BFF는 항상 같은 모양({ error })의 JSON과 X-Request-ID 헤더를
  // 유지한다 — 여기서 파싱 예외가 새면 requestId 없는 형태 불명의 500이 나간다.
  let data: unknown;
  try {
    data = await upstreamResponse.json();
  } catch {
    return Response.json(
      { error: "AI 서버가 올바르지 않은 응답을 반환했습니다." },
      { status: 502, headers: responseHeaders },
    );
  }

  return Response.json(data, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
