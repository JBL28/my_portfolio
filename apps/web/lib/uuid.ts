/**
 * 브라우저에서 쓸 UUID v4 생성기.
 *
 * `crypto.randomUUID()`는 **보안 컨텍스트(HTTPS 또는 localhost)에서만 존재한다.**
 * 실제 배포는 Cloudflare Tunnel이 TLS를 종단하므로(01_설계.md 1장) 문제가 없지만,
 * 같은 네트워크의 다른 PC에 `http://<사설IP>:8080`으로 공유하는 경우처럼 평문 HTTP로
 * 접근하면 함수 자체가 없어 `TypeError: crypto.randomUUID is not a function`으로
 * 채팅 모달이 통째로 죽는다. 호스트에서는 localhost라 재현되지 않아 놓치기 쉽다.
 *
 * `crypto.getRandomValues()`는 보안 컨텍스트가 아니어도 쓸 수 있으므로, 그것으로
 * RFC 4122 v4를 직접 만든다. 마지막 `Math.random` 경로는 crypto가 아예 없는 극히
 * 오래된 환경용 보루다 — 이 값은 trace를 같은 대화로 묶는 상관관계 키일 뿐이고
 * 사용자를 식별하거나 보안 판단에 쓰이지 않으므로(01_설계.md 8.2), 예측 가능성이
 * 문제가 되지 않는다.
 */
export function randomUUID(): string {
  const c = globalThis.crypto;

  if (typeof c?.randomUUID === "function") {
    return c.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122: version 4, variant 10xx.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}
