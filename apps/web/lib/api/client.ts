import axios from "axios";

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
