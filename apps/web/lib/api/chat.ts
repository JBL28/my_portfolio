import { apiClient } from "@/lib/api/client";

/**
 * apps/ai-server/app/schemas/chat.py, structured_outputs.py(Citation)를 그대로
 * 옮긴 타입. 필드명(camelCase)까지 1:1로 맞춘다 — 이 파일이 FE 쪽 계약이다.
 */

/**
 * 클라이언트가 대화 이력에 들고 있는 citation 참조(축소형).
 * ChatMessageCitation(chat.py)과 동일 — Generate가 응답한 전체 Citation
 * (path/anchor/quotedTitle 포함)이 아니라 sectionId/caseId만 다음 요청에
 * 재전송하면 된다(2장 "대화 맥락 처리 방식").
 */
export interface ChatMessageCitation {
  sectionId: string;
  caseId: string | null;
}

/** ChatMessage(chat.py)와 동일. user 턴은 citations가 없다(undefined/null 허용). */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: ChatMessageCitation[] | null;
}

/**
 * ChatRequest(chat.py) = 5.4의 `type ChatRequest`.
 * requestId는 BFF가 요청을 받은 시점에 생성하므로(8.1, Phase 05 범위) 이 바디에는
 * 포함하지 않는다.
 */
export interface ChatRequest {
  chatSessionId: string;
  messages: ChatMessage[];
}

/** Citation(structured_outputs.py)과 동일 — 링크 렌더링에 필요한 전체 필드. */
export interface Citation {
  sectionId: string;
  caseId: string | null;
  projectSlug: string | null;
  path: string;
  anchor: string;
  quotedTitle: string;
}

/** ChatResponse(chat.py)와 동일. */
export interface ChatResponse {
  answer: string;
  isEvidenceSufficient: boolean;
  citations: Citation[];
}

export async function postChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>("/chat", request);
  return data;
}
