"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const emptySubscribe = () => () => {};

/**
 * 마운트(hydration 완료) 여부를 판별한다. useEffect + setState 조합 대신
 * useSyncExternalStore를 쓰면 "서버에서는 false, 클라이언트에서는 true"를
 * cascading render 없이 표현할 수 있다(React 공식 권장 패턴).
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * 다크모드 수동 토글. 상호작용이 있는 유일한 요소라 Client Component로 분리한다
 * (01_설계.md 5.2 원칙). 마운트 전에는 서버/클라이언트 렌더 결과가 다를 수 있어
 * (next-themes가 localStorage/시스템 설정을 읽기 전) hydration mismatch를 막기
 * 위해 마운트 여부를 확인한 뒤에만 실제 아이콘을 표시한다.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="inline-flex h-8 w-8 items-center justify-center border border-zinc-300 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {mounted ? (
        isDark ? (
          <SunIcon />
        ) : (
          <MoonIcon />
        )
      ) : (
        <span className="block h-4 w-4" />
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
