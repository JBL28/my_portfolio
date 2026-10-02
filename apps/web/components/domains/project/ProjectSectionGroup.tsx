import type { ProjectSectionGroupData } from "@/lib/project-section-groups";
import type { ProjectImage } from "@/types/portfolio";
import { ProjectDetailSection } from "@/components/domains/project/ProjectDetailSection";
import { Reveal } from "@/components/ui/Reveal";

/**
 * 분류 제목(H2) 아래에 기존 Section(H3)을 배치한다(01_설계.md 5.7).
 * 증거·링크·본문 렌더링은 ProjectDetailSection을 그대로 사용한다 — 분류가 생겼다고
 * 같은 서술을 두 컴포넌트에서 관리하면 수정할 때 서로 어긋날 수 있기 때문이다.
 */
export function ProjectSectionGroup({
  group,
  images,
}: Readonly<{
  group: ProjectSectionGroupData;
  images: ProjectImage[];
}>) {
  const headingId = `category-${group.category}`;

  return (
    <section aria-labelledby={headingId}>
      <Reveal from="right">
        <div className="mb-8 flex items-center gap-5">
          <h2
            id={headingId}
            className="text-[1.7rem] font-bold leading-tight tracking-[-0.02em] text-zinc-900 dark:text-zinc-100"
          >
            {group.label}
          </h2>
          <span
            aria-hidden="true"
            className="h-px min-w-5 flex-1 bg-zinc-200 dark:bg-zinc-800"
          />
        </div>
      </Reveal>
      {/* 긴 글에 순차 지연을 쌓지 않는다 — 기존 Section 단위의 Reveal을 유지한다. */}
      {group.sections.map((section, index) => (
        <Reveal key={section.id} from="right">
          <ProjectDetailSection
            section={section}
            images={images}
            isFirst={index === 0}
          />
        </Reveal>
      ))}
    </section>
  );
}
