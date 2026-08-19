import axios, { AxiosError } from "axios";

/**
 * axios 인스턴스 중앙화(01_설계.md 5.4). baseURL은 항상 같은 origin의 `/api`이며,
 * 실제 FastAPI 주소(AI_SERVER_URL)는 Next.js 서버(app/api/chat/route.ts)만 알고
 * 있다 — 브라우저 번들에는 이 값이 등장하지 않는다(1장 핵심 원칙).
 */
export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * 5.4가 이 파일의 책임으로 명시한 "공통 인터셉터".
 *
 * BFF(app/api/chat/route.ts)는 실패 시 `{ error: string }` 형태로 응답한다 —
 * AI_SERVER_URL 미설정(500), 본문 파싱 실패(400), AI 서버 연결 실패(502). 이
 * 인터셉터가 없으면 각 호출부가 `error.response.data.error`를 직접 파헤쳐야 하고,
 * 그 순간 "모든 API 호출은 이 계층을 통해서만 이루어진다"는 5.4의 중앙화 원칙이
 * 호출부로 새어 나간다. 여기서 서버가 준 메시지를 Error.message로 승격시켜,
 * 호출부(chat.ts → ChatModal)는 항상 같은 모양의 Error 하나만 다루면 된다.
 *
 * 응답을 가공하거나 재시도하지는 않는다 — 설계에 없는 동작을 인터셉터에서
 * 임의로 추가하지 않는다.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (error instanceof AxiosError) {
      const serverMessage = (error.response?.data as { error?: string } | undefined)
        ?.error;
      if (serverMessage) {
        return Promise.reject(new Error(serverMessage, { cause: error }));
      }
    }
    return Promise.reject(error);
  },
);
