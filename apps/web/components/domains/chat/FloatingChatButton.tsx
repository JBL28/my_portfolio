"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "motion/react";

/**
 * ChatModal은 여기서만, 그것도 `next/dynamic`으로 동적 import한다(01_설계.md 5.2) —
 * 이 파일이 ChatModal을 정적으로 import하면 모달 코드(axios 요청, Motion 애니메이션
 * 등)가 초기 클라이언트 번들에 함께 실린다. `ssr:false`로 서버 렌더 대상에서도 제외한다
 * — 이 컴포넌트가 Client Component라 옵션 사용이 허용된다(Server Component에서는
 * 지원되지 않음).
 */
const ChatModal = dynamic(() => import("@/components/domains/chat/ChatModal"), {
  ssr: false,
});

/**
 * 전역 고정 플로팅 버튼(00_기획.md "AI가 그려져있는 플로팅 버튼"). 클릭 시
 * ChatModal을 연다.
 */
export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="AI에게 포트폴리오에 대해 질문하기"
        className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <AiIcon />
      </button>

      <AnimatePresence>
        {isOpen ? <ChatModal onClose={() => setIsOpen(false)} /> : null}
      </AnimatePresence>
    </>
  );
}

function AiIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <rect x="6" y="8" width="12" height="10" rx="2" />
      <path d="M9 8V5a3 3 0 0 1 6 0v3" />
      <path d="M4 13H2M22 13h-2" />
      <circle cx="9.5" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
