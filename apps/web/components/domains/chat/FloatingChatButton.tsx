"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";

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

// 버튼의 aria-controls와 패널의 id를 잇는 고정 식별자. 페이지당 플로팅 버튼은
// 하나뿐이므로 useId로 만들 필요가 없고, 상수여야 SSR/CSR 간에 값이 흔들리지 않는다.
const CHAT_PANEL_ID = "portfolio-ai-chat-panel";

/**
 * 전역 고정 플로팅 버튼(00_기획.md "AI가 그려져있는 플로팅 버튼"). 클릭 시
 * ChatModal을 토글한다.
 *
 * ChatModal은 화면을 덮지 않는 비모달 팝오버라 열려 있는 동안에도 버튼이 그대로
 * 보인다. 그래서 열기 전용이 아니라 **토글**로 둔다 — 열려 있는데 다시 눌렀을 때
 * 아무 일도 일어나지 않으면 버튼이 고장난 것처럼 보인다.
 *
 * 이 컴포넌트는 PageLayout(RootLayout 하위)에 있으므로 클라이언트 사이드
 * 내비게이션에서 unmount되지 않는다 — 답변의 citation 링크를 눌러 다른 페이지로
 * 이동해도 `isOpen`과 ChatModal의 대화 이력이 그대로 유지된다.
 */
export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  // ChatModal과 같은 이유로 컨텍스트가 아니라 이 자리에서 직접 읽는다.
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={
          isOpen ? "AI 채팅 닫기" : "AI에게 포트폴리오에 대해 질문하기"
        }
        aria-expanded={isOpen}
        aria-controls={CHAT_PANEL_ID}
        // 패널(z-50)과 같은 층에 둔다 — 비모달이라 패널이 열려 있는 동안에도 버튼이
        // 계속 눌려야 하고, 뒤로 밀려 가려지면 토글이 막힌다.
        className="fixed bottom-6 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-zinc-50 shadow-md transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {/* 열림/닫힘이 아이콘에도 드러나야 토글이라는 것이 읽힌다. 회전은 12도로
            억제한다 — 버튼은 본문 위에 항상 떠 있으므로 큰 움직임은 시선을 계속
            끌어 읽기를 방해한다. */}
        <motion.span
          className="inline-flex"
          animate={{ rotate: prefersReducedMotion || !isOpen ? 0 : 12 }}
          transition={{ duration: DURATION.fast, ease: EASE }}
        >
          <AiIcon />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <ChatModal panelId={CHAT_PANEL_ID} onClose={() => setIsOpen(false)} />
        ) : null}
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
