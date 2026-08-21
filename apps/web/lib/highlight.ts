import { codeToHtml } from "shiki";

/**
 * 증거 코드블록의 문법 강조. **빌드 타임(서버)에서만 돈다** — Shiki를 클라이언트로
 * 내려보내면 문법 파일까지 번들에 실린다. 서버 컴포넌트가 여기서 HTML을 만들어
 * 문자열로 넘기면, 브라우저는 이미 색이 입혀진 마크업만 받는다.
 *
 * 테마를 상수 하나로 뽑아둔 이유는 갈아끼우기 위해서다. Shiki에 dark 테마만 44개가
 * 있으니 마음에 안 들면 이 문자열만 바꾸면 된다 —
 * `github-dark-default` · `one-dark-pro` · `night-owl` · `tokyo-night` ·
 * `vitesse-dark` · `material-theme-palenight` 등.
 *
 * 줄 번호는 여기서 붙이지 않는다. Shiki가 각 줄을 `<span class="line">`으로 내보내므로
 * app/globals.css의 CSS 카운터가 번호를 그린다 — 마크업에 숫자를 박아 넣으면 코드를
 * 복사할 때 번호까지 딸려온다.
 */
const THEME = "github-dark-default";

/**
 * Shiki가 아는 언어만 강조한다. 모르는 언어를 넘기면 예외를 던지므로, 데이터에 오타가
 * 있어도 페이지가 죽지 않게 평문으로 떨어뜨린다(`text`).
 */
export async function highlightCode(code: string, language: string) {
  try {
    return await codeToHtml(code, { lang: language, theme: THEME });
  } catch {
    return await codeToHtml(code, { lang: "text", theme: THEME });
  }
}
