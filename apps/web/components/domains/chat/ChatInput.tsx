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
}: Readonly<{
  onSend: (content: string) => void;
  disabled?: boolean;
}>) {
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
        // max-sm:min-w-0 — 좁은 화면에서 입력·전송이 패널 밖으로 밀려나는 것을 막는다.
        // input은 size 속성에서 오는 고유 너비(약 20자)를 갖고, flex 항목의 기본
        // min-width가 auto라 flex-1이어도 그 아래로는 줄어들지 않는다. 패널 폭이
        // min(24rem, 100vw-3rem)이므로 뷰포트가 좁아지면 입력 최소 너비 + 여백 +
        // 전송 버튼의 합이 패널을 넘어서고, 남는 만큼이 오른쪽으로 삐져나간다.
        // 넓은 화면은 패널이 24rem으로 고정돼 이 조건에 걸리지 않으므로 건드리지
        // 않는다 — min-width만 풀어주는 것이라 보이는 모습도 달라지지 않는다.
        className="h-10 flex-1 border border-zinc-300 bg-transparent px-3 text-sm text-zinc-900 outline-none max-sm:min-w-0 placeholder:text-zinc-400 focus:border-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
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
