"use client";

import { useEffect } from "react";

/**
 * 앵커로 착지한 문단을 잠깐 하이라이트한다.
 *
 * AI 답변의 citation은 `/projects/{slug}#{anchor}`로 이동하는데(5.3), 도착하면
 * 브라우저가 스크롤만 시킬 뿐 "어느 문단이 그 근거인지"는 표시하지 않는다. 긴 본문
 * 중간에 떨어지면 어디를 읽어야 할지 한 박자 헤매게 되므로, 대상 섹션을 1초간
 * 사각형 블록으로 밝혔다가 지운다.
 *
 * **주소를 보지 않고 클릭을 본다.** 처음에는 `hashchange`와 pathname 변화를
 * 신호로 삼았는데, App Router의 이동에서는 둘 다 오지 않거나 늦게 온다:
 *   - `next/link`는 클릭을 가로채 `history.pushState`로 주소를 바꾼다. pushState는
 *     `hashchange`를 발생시키지 않으므로, 같은 페이지 안의 문단을 가리키는 citation은
 *     effect를 다시 돌릴 pathname 변화도 없어 하이라이트가 아예 켜지지 않았다.
 *   - pathname이 바뀌어 effect가 다시 돌 때 주소창은 아직 떠나온 URL이다. 그 순간
 *     읽은 `location.hash`는 이전 페이지의 것(대개 빈 문자열)이라 그냥 끝나거나,
 *     재시도가 뒤늦게 성공해 엉뚱한 때에 켜졌다. 뒤로/앞으로 가기처럼 사용자가
 *     앵커를 누르지 않은 이동에도 pathname은 바뀌므로 하이라이트가 대뜸 켜졌다.
 * 그래서 신호를 **앵커 링크 클릭**으로 바꿨다. 클릭에는 "어디로 가려는지"가 이미
 * 들어 있어(`link.pathname` + `link.hash`) 라우터가 주소를 언제 쓰든 상관이 없고,
 * 같은 페이지·다른 페이지·같은 해시 재클릭이 한 경로로 합쳐진다.
 *
 * 켜지는 경우는 둘뿐이다:
 *   1) 사이트 안의 앵커 링크를 눌렀고 목적지 문단이 실제로 나타났을 때. 다른
 *      라우트로 가는 링크라면 그 페이지가 그려질 때까지 기다린다(WAIT_MS).
 *   2) 앵커가 붙은 주소로 문서를 처음 열었을 때 — 공유받은 citation 링크가 이 경우다.
 * 뒤로/앞으로 가기에는 켜지 않는다. 읽던 자리로 돌아가는 동작이지 근거를 찾아가는
 * 동작이 아니라서, 여기에 표시를 더하면 "이게 그 근거다"라는 신호가 값싸진다.
 *
 * 실제 색과 지속시간은 app/globals.css의 `.anchor-flash`에 있다.
 */
const CLASS = "anchor-flash";
const DURATION_MS = 1000;
/**
 * 다른 라우트로 가는 링크를 눌렀을 때 목적지 문단이 나타나기를 기다리는 한도와 간격.
 *
 * 프레임이 아니라 시간으로 센다. 전에는 `requestAnimationFrame`을 40번 돌려 약
 * 600ms로 쳤는데, 같은 프레임 수라도 120Hz 화면에서는 절반의 시간밖에 기다리지
 * 못한다. 더 나쁜 것은 **보이지 않는 탭에서는 rAF가 아예 돌지 않는다**는 점이다 —
 * 배경 탭으로 연 citation 링크는 그 탭을 꺼내 볼 때쯤 한 번도 확인해보지 못한
 * 채로 끝난다. 타이머는 배경 탭에서 1초로 묶이기는 해도 돌기는 하므로, 한도를
 * 그 묶임보다 넉넉하게 잡는다.
 */
const WAIT_MS = 3000;
const STEP_MS = 50;

/** offsetWidth를 읽으면 브라우저가 리플로를 강제한다 — remove/add 사이에 끼워야
 *  두 클래스 변경이 하나로 배치되지 않고 애니메이션이 실제로 재시작된다. */
function forceReflow(element: HTMLElement): number {
  return element.offsetWidth;
}

export function AnchorHighlight() {
  // 의존성이 없다. 이 컴포넌트는 RootLayout 아래에 있어 클라이언트 내비게이션
  // 동안 마운트된 채로 남고, 리스너는 document에 붙으므로 페이지를 옮겨 다녀도
  // 그대로 산다 — pathname을 의존성에 두면 "앵커를 누르지 않은 이동"에도 effect가
  // 다시 돌아 하이라이트가 켜진다.
  useEffect(() => {
    let removeTimer: ReturnType<typeof setTimeout> | undefined;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    let painted: HTMLElement | null = null;

    function paint(element: HTMLElement) {
      // 1초가 지나기 전에 다른 문단으로 또 이동할 수 있다. 아래에서 타이머를
      // 새로 걸므로, 먼저 밝혀둔 문단은 여기서 직접 꺼야 켜진 채로 남지 않는다.
      if (painted && painted !== element) {
        painted.classList.remove(CLASS);
      }
      clearTimeout(removeTimer);
      // 같은 요소를 연속으로 가리킬 때도 다시 재생되도록 클래스를 떼고 리플로를
      // 강제한 뒤 다시 붙인다(클래스만 다시 붙이면 애니메이션이 재시작되지 않는다).
      element.classList.remove(CLASS);
      forceReflow(element);
      element.classList.add(CLASS);
      painted = element;
      removeTimer = setTimeout(() => {
        element.classList.remove(CLASS);
        painted = null;
      }, DURATION_MS);
    }

    /**
     * 목적지(`pathname`의 `id`)가 나타나면 칠한다. 라우터가 주소를 쓰기 전까지는
     * 아직 떠나온 페이지이므로, 경로가 목적지와 같아진 뒤에만 요소를 찾는다 —
     * 이 확인이 없으면 떠나온 페이지에서 같은 id를 찾아 엉뚱하게 칠할 수 있다.
     *
     * 같은 페이지 안의 문단이면 첫 시도에서 바로 끝난다. 기다림은 다른 라우트로
     * 넘어가는 경우에만 필요하다 — 그 페이지가 아직 그려지지 않았을 뿐이다.
     */
    function flashWhenReady(pathname: string, id: string) {
      clearTimeout(waitTimer);
      const deadline = Date.now() + WAIT_MS;

      function attempt() {
        if (decodeURIComponent(globalThis.location.pathname) === pathname) {
          const element = document.getElementById(id);
          if (element) {
            paint(element);
            return;
          }
        }
        if (Date.now() < deadline) {
          waitTimer = setTimeout(attempt, STEP_MS);
        }
      }

      attempt();
    }

    function onClick(event: MouseEvent) {
      // 새 탭·새 창으로 여는 클릭은 지금 보고 있는 페이지를 건드리지 않는다.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      // 사이트 밖으로 나가는 링크의 해시는 이 문서의 문단이 아니다.
      if (link.origin !== globalThis.location.origin || !link.hash) return;

      flashWhenReady(
        decodeURIComponent(link.pathname),
        decodeURIComponent(link.hash.slice(1)),
      );
    }

    // 앵커가 붙은 주소로 문서를 처음 열었을 때(공유받은 citation 링크·새로고침).
    // 하이드레이션 직후라 대상이 아직 없을 수 있어 같은 대기를 그대로 쓴다.
    const initialId = decodeURIComponent(globalThis.location.hash.slice(1));
    if (initialId) {
      flashWhenReady(
        decodeURIComponent(globalThis.location.pathname),
        initialId,
      );
    }

    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      clearTimeout(waitTimer);
      clearTimeout(removeTimer);
      painted?.classList.remove(CLASS);
    };
  }, []);

  return null;
}
