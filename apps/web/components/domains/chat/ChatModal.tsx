"use client";

import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";
import { postChatMessage } from "@/lib/api/chat";
import { randomUUID } from "@/lib/uuid";
import type { ChatMessage } from "@/lib/api/chat";
import { ChatInput } from "@/components/domains/chat/ChatInput";
import {
  MessageList,
  type ConversationTurn,
} from "@/components/domains/chat/MessageList";

/**
 * 플로팅 모달(01_설계.md 5.2, 5.3). FloatingChatButton이 `next/dynamic`으로
 * 동적 import하므로 default export로 둔다 — 버튼을 누르기 전까지 이 파일과
 * 여기서 참조하는 lib/api/chat, motion 등은 초기 클라이언트 번들에 포함되지
 * 않는다.
 *
 * 대화 이력·로딩 상태는 이 컴포넌트 로컬 useState로만 관리한다(Context·전역
 * 상태관리 라이브러리 금지, 5.3) — 모달이 unmount되면(닫힘) 상태도 함께
 * 사라져야 "모달을 닫으면 대화가 사라진다"는 정책과 구현이 어긋나지 않는다.
 * chatSessionId도 매번 새로 열릴 때(=매번 새로 mount될 때) 생성한다(5.4, 8.2).
 *
 * **비모달(non-modal) 팝오버다.** 답변의 citation 링크를 눌러 본문을 읽고, 다시
 * 다른 링크를 눌러보는 흐름이 성립하려면 채팅이 열려 있는 동안에도 페이지와
 * 상호작용할 수 있어야 한다. 그래서 다음 세 가지를 의도적으로 두지 않는다:
 *   - 화면을 덮는 backdrop(어두운 배경) — 시각적으로 "뒤는 못 만진다"고 말하게 된다
 *   - `fixed inset-0` 래퍼 — 투명해도 뷰포트 전체의 클릭을 가로챈다
 *   - `aria-modal="true"` — 보조기술에 "뒤 콘텐츠는 비활성"이라고 잘못 알린다
 * 대신 플로팅 버튼 바로 위에 고정 배치하고, 닫기는 헤더의 닫기 버튼과 (패널 안에
 * 포커스가 있을 때의) Escape로만 한다. 바깥 클릭으로 닫지 않는 것도 같은 이유다 —
 * 본문을 읽으려고 누른 클릭에 대화가 통째로 사라지면 안 된다.
 *
 * 이 패널은 PageLayout(RootLayout 하위)에 있는 FloatingChatButton이 렌더링하므로
 * App Router의 클라이언트 사이드 내비게이션에서 layout이 유지되는 한 unmount되지
 * 않는다 — citation 링크로 페이지를 옮겨 다녀도 대화 이력이 그대로 남는다.
 */
export default function ChatModal({
  onClose,
  panelId,
}: Readonly<{
  onClose: () => void;
  panelId: string;
}>) {
  // crypto.randomUUID()를 직접 쓰지 않는다 - 보안 컨텍스트(HTTPS/localhost)에서만
  // 존재해서 평문 HTTP로 접근하면 함수가 없어 모달이 통째로 죽는다(lib/uuid.ts).
  const [chatSessionId] = useState(() => randomUUID());
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // MotionConfig(components/layouts/MotionProvider.tsx)의 reducedMotion 설정은 이
  // 컴포넌트까지 닿지 않는다 — next/dynamic으로 분리된 청크라 Motion 컨텍스트를
  // 공유하지 못한다(실측: 모션 감소를 켜도 scale 8%, y 12px가 그대로 실행됐다).
  // 컨텍스트에 기대지 않고 이 자리에서 직접 읽는다.
  const prefersReducedMotion = useReducedMotion();

  async function handleSend(content: string) {
    if (isLoading) {
      return;
    }

    const nextTurns: ConversationTurn[] = [
      ...turns,
      { id: randomUUID(), role: "user", content },
    ];
    setTurns(nextTurns);
    setIsLoading(true);
    setError(null);

    // 2장 "대화 맥락 처리 방식": assistant 턴은 실제 사용된 citations(sectionId
    // + caseId)만 재전송한다 — 렌더링용 전체 Citation(path/anchor/quotedTitle
    // 포함)은 화면 상태(turns)에만 남기고, 요청 바디에는 축소형으로 변환해 담는다.
    const messages: ChatMessage[] = nextTurns.map((turn) =>
      turn.role === "user"
        ? { role: "user", content: turn.content }
        : {
            role: "assistant",
            content: turn.content,
            citations: turn.citations.map(({ sectionId, caseId }) => ({
              sectionId,
              caseId,
            })),
          },
    );

    try {
      const response = await postChatMessage({ chatSessionId, messages });
      setTurns((prev) => [
        ...prev,
        {
          id: randomUUID(),
          role: "assistant",
          content: response.answer,
          citations: response.citations,
        },
      ]);
    } catch {
      setError("답변을 받아오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  // 패널 안에 포커스가 있을 때만 Escape로 닫는다. window 리스너를 쓰면 본문을 읽는
  // 도중 누른 Escape에도 대화가 통째로 사라진다 — 비모달이라 "지금 포커스가 어디
  // 있는지"가 곧 사용자가 무엇을 닫으려는지에 대한 답이다.
  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    // 뷰포트 전체를 덮는 래퍼를 두지 않는다(컴포넌트 docstring 참고) — 패널 자체를
    // 플로팅 버튼 바로 위(bottom-24 = 버튼 높이 3rem + 여백)에 고정한다. 너비는
    // 좁은 화면에서 좌우 여백 1.5rem을 남기도록 clamp한다.
    <motion.div
      className="fixed bottom-24 right-6 z-50 flex h-[32rem] max-h-[calc(100dvh-9rem)] w-[min(24rem,calc(100vw-3rem))] flex-col border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      // 버튼에서 펼쳐지는 것처럼 보이도록 확대 기준점을 우하단(=버튼 쪽)에 둔다.
      style={{ transformOrigin: "bottom right" }}
      // scale 0.95는 변화폭이 4.9%뿐이라 페이드에 묻혀 "툭 나타났다"로 읽혔다(실측).
      // 0.92로 키우고 y를 12px 더해 버튼에서 올라오는 방향을 만든다. 이 패널은 본문이
      // 아니라 위젯이므로 12px 이동이 읽기를 방해하지 않는다 — 반대로 본문 텍스트에는
      // 이런 이동을 걸지 않는다(lib/motion.ts 참고).
      // 모션 감소 설정에서는 이동을 빼고 페이드만 남긴다 — 화면이 튀지 않으면서도
      // "패널이 열렸다"는 상태 변화는 전달된다.
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.92, y: 12 }
      }
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.96, y: 8 }
      }
      transition={{ duration: DURATION.base, ease: EASE }}
      onKeyDown={handlePanelKeyDown}
      // aria-modal은 두지 않는다 — 뒤 콘텐츠가 계속 활성이라는 것이 이 UI의 요점이다.
      role="dialog"
      aria-label="포트폴리오 AI 채팅"
      id={panelId}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="font-mono text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Portfolio AI
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="채팅 닫기"
          className="inline-flex h-6 w-6 items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <CloseIcon />
        </button>
      </div>

      <p className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400">
        이 대화는 저장되지 않습니다. 새로고침하거나 창을 닫으면 대화 내용이
        사라집니다.
      </p>

      <MessageList turns={turns} isLoading={isLoading} />

      {error ? (
        <p className="px-4 py-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </motion.div>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
