"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { CLICK_SLOP } from "@/lib/interaction";
import { DURATION, EASE } from "@/lib/motion";

/**
 * 화면을 덮는 모달 껍데기. 갤러리의 이미지 확대와 섹션의 증거 보기가 **같은 닫기
 * 동작**을 쓰도록 공통으로 뺐다 — 한 페이지 안에서 어떤 오버레이는 Escape로 닫히고
 * 어떤 것은 안 닫히면 그때부터 사용자는 매번 시도해봐야 한다.
 *
 * 껍데기가 책임지는 것:
 *   - 배경을 덮고(진짜 모달이므로 `aria-modal`) 뒤 페이지 스크롤을 잠근다
 *   - Escape, 닫기 버튼, 배경 클릭으로 닫는다
 *   - 열리면 포커스를 안으로 들여 Tab이 뒤 페이지로 새지 않게 한다
 *   - **끌고 나서 뗀 포인터는 클릭으로 치지 않는다**(CLICK_SLOP) — 이게 없으면
 *     안에서 스와이프할 때마다 오버레이가 닫힌다
 *
 * 안의 내용(넘기기·카운터·본문)은 호출부가 채운다. `header`는 닫기 버튼 왼쪽에
 * 놓이는 자리이고, `footer`는 아래 가운데 자리다.
 *
 * 열고 닫는 전환은 호출부의 AnimatePresence가 맡는다 — 이 컴포넌트는 자기 자신의
 * initial/animate/exit만 갖는다.
 */
export function Overlay({
  label,
  onClose,
  header,
  footer,
  children,
  contentClassName,
}: Readonly<{
  /** 스크린리더에 읽히는 이 오버레이의 이름. */
  label: string;
  onClose: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const pressRef = useRef({ x: 0, y: 0, moved: 0 });

  // 키 조작은 창 전체에서 받는다. 오버레이 안의 특정 요소에 포커스가 있어야만
  // 닫히면, 배경을 눌러 포커스가 빠진 뒤에 Escape가 먹지 않는다.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 뒤 페이지가 같이 스크롤되면 "덮여 있다"는 감각이 깨진다.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /** 어디를 눌러도 닫힌다(cursor-zoom-out이 그렇게 약속한다). 단 끌고 나서 뗀
   *  포인터와 버튼 클릭은 제외한다. */
  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (pressRef.current.moved > CLICK_SLOP) {
      return;
    }
    if ((event.target as HTMLElement).closest("button, a")) {
      return;
    }
    onClose();
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onPointerDown={(event) => {
        pressRef.current = { x: event.clientX, y: event.clientY, moved: 0 };
      }}
      onPointerMove={(event) => {
        pressRef.current.moved = Math.max(
          pressRef.current.moved,
          Math.hypot(
            event.clientX - pressRef.current.x,
            event.clientY - pressRef.current.y,
          ),
        );
      }}
      onClick={handleClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      /* `dark` 클래스를 직접 단다. 이 오버레이는 사이트 테마와 무관하게 **항상 검은
         배경**이므로, 라이트 모드에서 열면 안쪽 내용이 밝은 배경을 전제로 칠해진다 —
         RichText의 <strong>은 text-foreground(라이트에서 거의 검정)라 아예 사라지고,
         인라인 코드는 흰 칩으로 튄다. 여기서 dark 컨텍스트를 선언하면 --foreground가
         밝은 값으로 바뀌고 안쪽의 dark: 변형도 함께 켜진다
         (globals.css의 `@custom-variant dark (&:where(.dark, .dark *))`). */
      className="dark fixed inset-0 z-50 flex cursor-zoom-out flex-col bg-black/90 p-4 backdrop-blur-sm sm:p-8"
    >
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div className="min-w-0">{header}</div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-zinc-600 font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100"
        >
          ✕
        </button>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center overflow-hidden py-4",
          contentClassName,
        )}
      >
        {children}
      </div>

      {footer ? (
        <div className="flex shrink-0 items-center justify-center gap-3">
          {footer}
        </div>
      ) : null}
    </motion.div>
  );
}

/** 검은 배경 위에서만 쓰는 버튼. 오버레이는 항상 어두우므로 다크모드 분기 없이
 *  밝은 색 하나로 고정한다. */
export function OverlayButton({
  label,
  disabled = false,
  onClick,
  children,
}: Readonly<{
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-zinc-600 font-mono text-sm text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-zinc-300"
    >
      {children}
    </button>
  );
}
