/**
 * 사이트 밖으로 나가는 링크. 저장소·기술 문서·운영 중인 서비스처럼 "여기서
 * 직접 확인할 수 있다"를 가리키는 자리에 쓴다.
 *
 * 색은 링크 악센트(globals.css의 --accent)를 쓴다. 카드의 "자세히 보기", 상세의
 * "← About Me"와 같은 색이다 — 셋 다 "여기서 다음으로 넘어간다"는 같은 역할이라,
 * 색이 곧 그 역할의 표시가 된다.
 *
 * 링크임이 훑어봐도 드러나야 하는 자리라 밑줄과 화살표를 항상 함께 둔다 —
 * 본문 안에 섞여 들어가는 인라인 링크가 아니라, 문단 끝에서 다음 행동을
 * 제시하는 요소이기 때문이다. 화살표는 ProjectCard의 "자세히 보기 →"와 같은
 * 글리프를 쓴다.
 */
export function ExternalLink({
  href,
  children,
}: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1 font-mono text-[0.8125rem] text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:text-accent-hover hover:decoration-accent-hover/60"
    >
      {children}
      <span
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </a>
  );
}
