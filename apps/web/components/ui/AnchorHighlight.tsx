"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 앵커로 착지한 문단을 잠깐 하이라이트한다.
 *
 * AI 답변의 citation은 `/projects/{slug}#{anchor}`로 이동하는데(5.3), 도착하면
 * 브라우저가 스크롤만 시킬 뿐 "어느 문단이 그 근거인지"는 표시하지 않는다. 긴 본문
 * 중간에 떨어지면 어디를 읽어야 할지 한 박자 헤매게 되므로, 대상 섹션을 1초간
 * 사각형 블록으로 밝혔다가 지운다.
 *
 * 다루는 진입 경로는 셋이다:
 *   1) 다른 페이지에서 앵커로 이동 — pathname이 바뀌므로 effect가 다시 돈다.
 *      단 이동 직후에는 대상 요소가 아직 렌더링되지 않았을 수 있어 잠깐 재시도한다.
 *   2) 같은 페이지 안에서 앵커 이동 — `hashchange`.
 *   3) 이미 그 해시에 있는 링크를 다시 클릭 — hashchange가 발생하지 않으므로
 *      클릭을 직접 받아 다시 재생한다(섹션 제목 옆 `#` 링크가 이 경우다).
 *
 * 실제 색과 지속시간은 app/globals.css의 `.anchor-flash`에 있다.
 */
const CLASS = "anchor-flash";
const DURATION_MS = 1000;
/** 라우트 이동 직후 대상 요소가 나타날 때까지의 재시도(약 600ms). */
const RETRY_FRAMES = 40;

/** offsetWidth를 읽으면 브라우저가 리플로를 강제한다 — remove/add 사이에 끼워야
 *  두 클래스 변경이 하나로 배치되지 않고 애니메이션이 실제로 재시작된다. */
function forceReflow(element: HTMLElement): number {
  return element.offsetWidth;
}

export function AnchorHighlight() {
  const pathname = usePathname();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let cancelled = false;

    function paint(el: HTMLElement) {
      // 같은 요소를 연속으로 가리킬 때도 다시 재생되도록 클래스를 떼고 리플로를
      // 강제한 뒤 다시 붙인다(클래스만 다시 붙이면 애니메이션이 재시작되지 않는다).
      el.classList.remove(CLASS);
      forceReflow(el);
      el.classList.add(CLASS);
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove(CLASS), DURATION_MS);
    }

    function flash(attempt = 0) {
      if (cancelled) return;
      const id = decodeURIComponent(globalThis.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el) {
        paint(el);
      } else if (attempt < RETRY_FRAMES) {
        raf = requestAnimationFrame(() => flash(attempt + 1));
      }
    }

    function onHashChange() {
      flash();
    }

    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      // 이미 같은 해시에 있으면 hashchange가 오지 않으므로 여기서 직접 재생한다.
      if (
        link.hash &&
        link.pathname === globalThis.location.pathname &&
        link.hash === globalThis.location.hash
      ) {
        flash();
      }
    }

    raf = requestAnimationFrame(() => flash());
    globalThis.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onClick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      globalThis.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onClick);
    };
  }, [pathname]);

  return null;
}
