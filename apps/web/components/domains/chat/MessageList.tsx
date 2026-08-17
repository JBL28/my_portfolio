"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { Citation } from "@/lib/api/chat";
import { CitationLink } from "@/components/domains/chat/CitationLink";

/**
 * ChatModal이 화면에 그리는 대화 턴. lib/api/chat.ts의 ChatMessage(전송용, citations는
 * sectionId/caseId만 담는 축소형)와는 별개다 — 렌더링에는 CitationLink가 필요로
 * 하는 path/anchor/quotedTitle까지 포함한 전체 Citation이 필요하기 때문이다.
 * ChatModal이 요청을 보낼 때는 이 turn을 축소형으로 다시 변환한다.
 */
export type ConversationTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; citations: Citation[] };

/**
 * 채팅 화면. 스크롤 위치를 새 메시지에 맞춰 유지해야 하므로 Client Component로
 * 분리한다(01_설계.md 5.2).
 */
export function MessageList({
  turns,
  isLoading,
}: {
  turns: ConversationTurn[];
  isLoading: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns, isLoading]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {turns.length === 0 && !isLoading ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          지원자의 경험, 역량, 프로젝트에 대해 질문해보세요.
        </p>
      ) : null}

      {turns.map((turn, index) => (
        <div
          key={index}
          className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "max-w-[85%] border px-3 py-2 text-sm leading-relaxed",
              turn.role === "user"
                ? "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300",
            )}
          >
            <p className="whitespace-pre-wrap">{turn.content}</p>
            {turn.role === "assistant" && turn.citations.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-900">
                {turn.citations.map((citation, citationIndex) => (
                  <li key={`${citation.sectionId}-${citation.caseId ?? "none"}-${citationIndex}`}>
                    <CitationLink citation={citation} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ))}

      {isLoading ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">답변을 생성하는 중...</p>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
