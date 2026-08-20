"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { DURATION, EASE, RISE } from "@/lib/motion";
import type { Citation } from "@/lib/api/chat";
import { CitationLink } from "@/components/domains/chat/CitationLink";

/**
 * ChatModal이 화면에 그리는 대화 턴. lib/api/chat.ts의 ChatMessage(전송용, citations는
 * sectionId/caseId만 담는 축소형)와는 별개다 — 렌더링에는 CitationLink가 필요로
 * 하는 path/anchor/quotedTitle까지 포함한 전체 Citation이 필요하기 때문이다.
 * ChatModal이 요청을 보낼 때는 이 turn을 축소형으로 다시 변환한다.
 */
export type ConversationTurn =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; citations: Citation[] };

/**
 * 채팅 화면. 스크롤 위치를 새 메시지에 맞춰 유지해야 하므로 Client Component로
 * 분리한다(01_설계.md 5.2).
 */
export function MessageList({
  turns,
  isLoading,
}: Readonly<{
  turns: ConversationTurn[];
  isLoading: boolean;
}>) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

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

      {turns.map((turn) => (
        // 새 턴이 어디에 생겼는지 시선을 유도한다. `initial`은 mount 시 1회만
        // 실행되므로 이미 읽고 있던 메시지가 다시 움직이는 일은 없다 — 읽는 중에
        // 글이 흔들리지 않아야 한다는 원칙 때문에 y 이동도 6px로 묶는다.
        <motion.div
          key={turn.id}
          initial={RISE.initial}
          animate={RISE.animate}
          transition={{ duration: DURATION.fast, ease: EASE }}
          className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed",
              turn.role === "user"
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300",
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
        </motion.div>
      ))}

      {isLoading ? (
        <p className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          답변을 생성하는 중
          {/* 유일하게 반복되는 애니메이션이다. 문구 옆 3px 점이라 시야에서 차지하는
              면적이 작고, 답변이 도착하면 사라진다. 모션 감소 설정에서는 반복 자체가
              부담이 될 수 있으므로 정적인 말줄임표로 대체한다. */}
          {prefersReducedMotion ? (
            <span>...</span>
          ) : (
            <span className="flex items-center gap-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="inline-block h-[3px] w-[3px] rounded-full bg-current"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{
                    duration: 1.1,
                    ease: "easeInOut",
                    repeat: Infinity,
                    delay: i * 0.16,
                  }}
                />
              ))}
            </span>
          )}
        </p>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
