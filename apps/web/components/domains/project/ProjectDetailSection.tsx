import type { ProjectSectionData } from "@/types/portfolio";
import { RichText } from "@/lib/rich-text";
import { ExternalLink } from "@/components/ui/ExternalLink";

/**
 * Project Detail 우측 "서술" 컬럼의 H2 Section. 01_설계.md 3.2의 anchor 렌더링
 * 규칙에 따라 <section id={section.anchor}>로 렌더링한다 — 이후 Phase의 citation
 * 링크가 `path#anchor`로 이 id를 찾아간다.
 *
 * 제목 hover 시 나타나는 `#`는 그 anchor로의 직접 링크다 — AI 답변의 citation이
 * 실제로 이 지점으로 연결된다는 구조를 화면에서도 드러낸다(장식이 아니라
 * 실제 동작하는 앵커).
 */
export function ProjectDetailSection({
  section,
  isFirst = false,
}: Readonly<{
  section: ProjectSectionData;
  isFirst?: boolean;
}>) {
  return (
    <section
      id={section.anchor}
      className={
        isFirst
          ? "scroll-mt-24 pb-12"
          : "scroll-mt-24 border-t border-zinc-200 py-12 dark:border-zinc-800"
      }
    >
      <h2 className="group text-[1.2rem] font-bold leading-snug tracking-[-0.015em] text-zinc-900 dark:text-zinc-100">
        {section.title}
        <a
          href={`#${section.anchor}`}
          aria-label={`"${section.title}" 섹션 링크`}
          className="ml-2 font-mono text-base font-normal text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 dark:text-zinc-600"
        >
          #
        </a>
      </h2>
      <RichText
        text={section.body}
        className="mt-4 max-w-xl text-[0.9375rem] leading-[1.9] text-zinc-600 dark:text-zinc-400"
      />
      {/* 근거 링크는 본문 끝에 별도 줄로 둔다 — 문장 안에 섞으면 링크임이 눈에
          걸리지 않는다. 여럿이면 한 줄에 나란히 놓고 좁은 폭에서 접힌다. */}
      {section.links?.length ? (
        <div className="mt-4 flex max-w-xl flex-wrap items-center gap-x-4 gap-y-1">
          {section.links.map((link) => (
            <ExternalLink key={link.url} href={link.url}>
              {link.label}
            </ExternalLink>
          ))}
        </div>
      ) : null}
    </section>
  );
}
