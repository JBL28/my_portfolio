/**
 * 브라우저 쿠키 읽기/쓰기.
 *
 * 이 사이트는 SSG라 서버가 요청마다 쿠키를 볼 일이 없고, 쿠키를 쓰는 곳도 "이 브라우저가
 * 전에 온 적 있는가" 같은 표시용 플래그뿐이다. 그래서 라이브러리를 들이지 않고
 * `document.cookie`를 직접 다룬다.
 *
 * 값은 서버로도 전송되므로(같은 오리진의 /api/chat 요청에 자동으로 실린다) 개인정보나
 * 식별자를 담지 않는다 — 담기는 것은 플래그 하나뿐이다.
 */

/**
 * 쿠키 하나를 읽는다. 브라우저가 아니거나(SSR·빌드 시점) 값이 없으면 null.
 *
 * 호출부에서 SSR 분기를 매번 쓰지 않도록 여기서 `document` 유무를 확인한다. 이 값을
 * 렌더에 바로 쓰면 서버 HTML과 어긋나므로(서버는 항상 null) `useSyncExternalStore`의
 * getSnapshot으로 넘겨 쓴다 — getServerSnapshot이 서버/hydration 시점을 따로 맡아
 * 불일치를 막아 준다.
 */
export function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  for (const entry of document.cookie.split("; ")) {
    const separator = entry.indexOf("=");
    if (separator === -1) {
      continue;
    }
    if (entry.slice(0, separator) === name) {
      return decodeURIComponent(entry.slice(separator + 1));
    }
  }
  return null;
}

/** 1년. 재방문 표시용 플래그의 기본 수명 — 이보다 짧으면 안내가 주기적으로 되살아난다. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * 쿠키 하나를 쓴다.
 *
 * `SameSite=Lax`는 다른 사이트에서 넘어온 요청에 이 쿠키가 실리지 않게 한다(CSRF 표면
 * 축소). `Secure`는 HTTPS일 때만 붙인다 — 평문 HTTP(사내망 IP 접근 등)에서 무조건
 * 붙이면 브라우저가 쿠키를 통째로 버려서 안내가 매번 다시 뜬다.
 */
/**
 * `writeCookie` 구독자. `document.cookie`는 값이 바뀌어도 아무 이벤트를 쏘지 않으므로,
 * React가 쿠키를 외부 스토어로 구독하려면(useSyncExternalStore) 변경을 알릴 통로를
 * 이쪽에서 직접 만들어야 한다. 같은 탭에서 우리가 쓴 변경만 전파한다 — 다른 탭의
 * 쿠키 변경까지 따라가야 할 만큼 중요한 값을 여기 담지 않는다.
 */
const listeners = new Set<() => void>();

/** useSyncExternalStore의 subscribe 인자로 그대로 넘길 수 있는 형태. */
export function subscribeCookies(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function writeCookie(
  name: string,
  value: string,
  maxAgeSeconds: number = ONE_YEAR_SECONDS,
): void {
  if (typeof document === "undefined") {
    return;
  }

  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${name}=${encodeURIComponent(value)}` +
    `; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;

  for (const listener of listeners) {
    listener();
  }
}
