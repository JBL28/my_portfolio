"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { postChatMessage } from "@/lib/api/chat";
import type { ChatMessage } from "@/lib/api/chat";
import { ChatInput } from "@/components/domains/chat/ChatInput";
import { MessageList, type ConversationTurn } from "@/components/domains/chat/MessageList";

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
 */
export default function ChatModal({ onClose }: { onClose: () => void }) {
  const [chatSessionId] = useState(() => crypto.randomUUID());
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSend(content: string) {
    if (isLoading) {
      return;
    }

    const nextTurns: ConversationTurn[] = [...turns, { role: "user", content }];
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="포트폴리오 AI 채팅"
    >
      <motion.div
        className="absolute inset-0 bg-zinc-950/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        className="relative flex h-[32rem] max-h-[80vh] w-full max-w-sm flex-col border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
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
          이 대화는 저장되지 않습니다. 새로고침하거나 창을 닫으면 대화 내용이 사라집니다.
        </p>

        <MessageList turns={turns} isLoading={isLoading} />

        {error ? (
          <p className="px-4 py-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <ChatInput onSend={handleSend} disabled={isLoading} />
      </motion.div>
    </div>
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
