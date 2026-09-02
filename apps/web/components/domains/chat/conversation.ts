import type { Dispatch, SetStateAction } from "react";
import type { ConversationTurn } from "@/components/domains/chat/MessageList";

/**
 * ChatModal이 그리고 갱신하지만 **소유하지는 않는** 대화 상태.
 *
 * 이력이 모달보다 오래 살아야 하기 때문이다(01_설계.md 5.3의 "모달을 닫으면 대화가
 * 사라진다"에서 정책이 바뀌었다). 모바일에서는 패널이 화면을 거의 덮어서, 답변의
 * citation을 읽으려면 일단 닫아야 하는데 그때마다 대화가 날아가면 읽고 돌아올 수가
 * 없다. 그래서 상태는 닫아도 unmount되지 않는 FloatingChatButton이 들고,
 * ChatModal은 받아 쓴다.
 *
 * 이 파일은 타입만 담는다 — 컴파일 후 아무것도 남지 않으므로, 초기 번들에서
 * ChatModal을 떼어낸 `next/dynamic` 구성(5.2)에 영향을 주지 않는다.
 */
export interface ChatConversation {
  turns: ConversationTurn[];
  setTurns: Dispatch<SetStateAction<ConversationTurn[]>>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  /**
   * trace를 같은 대화로 묶는 상관관계 키(8.2). 첫 전송 때 만들어지므로 그전에는
   * null이다 — 열어만 보고 닫은 경우까지 값을 만들 이유가 없고, SSG로 서버에서도
   * 렌더되는 곳에 생성을 두지 않기 위해서이기도 하다.
   */
  chatSessionId: string | null;
  setChatSessionId: Dispatch<SetStateAction<string | null>>;
}
