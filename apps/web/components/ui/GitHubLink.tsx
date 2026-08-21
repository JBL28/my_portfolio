/**
 * 이 포트폴리오 사이트 자체의 저장소로 가는 링크. 헤더에서 ThemeToggle 왼쪽에
 * 나란히 놓이므로 크기·테두리·hover를 그 버튼과 같은 값으로 맞춘다 — 둘이 한 쌍의
 * 아이콘 버튼으로 읽혀야 한다.
 *
 * 저장소 주소를 data/에 두지 않은 이유: data/는 포트폴리오 "내용"(프로필·프로젝트)의
 * 단일 원본이고 이 링크는 내용이 아니라 사이트 chrome이다. AI 서버도 같은 주소를
 * 쓰지만(GITHUB_REPO_URL — Gate 2가 "사이트 구현 자체"를 묻는 질문에 안내하는 값)
 * 그쪽은 서버 환경변수라 브라우저로 내려오지 않는다.
 *
 * 상호작용이 없어 Client Component로 만들지 않는다(01_설계.md 5.2 원칙).
 */
const REPOSITORY_URL = "https://github.com/JBL28/my_portfolio";

export function GitHubLink() {
  return (
    <a
      href={REPOSITORY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="이 포트폴리오의 GitHub 저장소 (새 창에서 열기)"
      className="inline-flex h-8 w-8 items-center justify-center border border-zinc-300 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <GitHubIcon />
    </a>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12.02c0 5.03 3.29 9.29 7.86 10.79.58.11.79-.25.79-.55v-1.93c-3.2.7-3.88-1.55-3.88-1.55-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.23 2.75.12 3.04.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.26 5.69.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.55 4.56-1.51 7.85-5.77 7.85-10.79C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
