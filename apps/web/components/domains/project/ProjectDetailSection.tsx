import type { ProjectSectionData } from "@/types/portfolio";
import { RichText } from "@/lib/rich-text";

/**
 * Project Detail의 H2 Section. 01_설계.md 3.2의 anchor 렌더링 규칙에 따라
 * <section id={section.anchor}>로 렌더링한다 — 이후 Phase의 citation 링크가
 * `path#anchor`로 이 id를 찾아간다.
 */
export function ProjectDetailSection({
  section,
}: {
  section: ProjectSectionData;
}) {
  return (
    <section id={section.anchor} className="scroll-mt-20 border-t border-zinc-200 py-8 first:border-t-0 dark:border-zinc-800">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        {section.title}
      </h2>
      <RichText
        text={section.body}
        className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
      />
    </section>
  );
}
