"use client";

import { useState, type FormEvent } from "react";

/**
 * 채팅 입력창(01_설계.md 5.3). 입력값 자체는 이 컴포넌트 로컬 상태로만 관리하고,
 * 전송은 상위(ChatModal)에 위임한다 — 대화 이력은 ChatModal의 useState에서만
 * 관리한다는 원칙(5.3)과 맞물린다.
 */
export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSend(trimmed);
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
    >
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="지원자에 대해 질문해보세요"
        disabled={disabled}
        aria-label="채팅 입력"
        className="h-10 flex-1 border border-zinc-300 bg-transparent px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="inline-flex h-10 shrink-0 items-center bg-zinc-900 px-4 text-sm text-zinc-50 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        전송
      </button>
    </form>
  );
}
