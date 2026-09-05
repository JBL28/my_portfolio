import Link from "next/link";

/**
 * 사이트 안의 다른 문단으로 넘기는 링크. ExternalLink와 같은 자리(문단 끝 별도 줄)에
 * 같은 모양으로 서지만, 새 탭을 열지 않고 Next의 클라이언트 내비게이션을 탄다 —
 * 같은 사이트 안에서 이동하는데 탭이 늘어나면 읽던 자리로 돌아올 길이 사라진다.
 *
 * 쓰는 자리는 **프로젝트 사이의 인과**다. data/의 `buildsOnProjectSlug`·
 * `buildsOnEvidenceSectionIds`가 "이 프로젝트는 저 문단에서 남은 문제 위에 세워졌다"는
 * 관계를 이미 들고 있는데, 그 관계를 Home 카드 밖에서는 눌러서 따라갈 수 없었다.
 *
 * 화살표를 ExternalLink의 `→`와 같은 글리프로 두되 밑줄 규격과 **색**도 그대로
 * 맞춘다(globals.css의 --accent) — 두 링크가 한 문단 아래에 나란히 설 수 있어서,
 * 모양이나 색이 갈리면 "밖으로 나가는 것"과 "안에서 옮겨가는 것"의 차이가 아니라
 * 그냥 스타일이 어긋난 것으로 읽힌다. 새 탭 여부는 색이 아니라 화살표 뒤 동작으로
 * 갈린다.
 */
export function InternalLink({
  href,
  children,
}: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 font-mono text-[0.8125rem] text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:text-accent-hover hover:decoration-accent-hover/60"
    >
      {children}
      <span
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}
