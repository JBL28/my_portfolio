import {
  PROJECT_SECTION_CATEGORIES,
  type ProjectSectionCategory,
} from "@/lib/project-section-categories";
import type { ProjectSectionData } from "@/types/portfolio";

export interface ProjectSectionGroupData {
  category: ProjectSectionCategory;
  label: string;
  sections: ProjectSectionData[];
}

/**
 * 표시 정책은 공통 설정에, 소속은 data/에 둔다(01_설계.md 5.7).
 * JSON은 TypeScript 타입 검사 밖에 있으므로 잘못된 분류를 조용히 누락시키지 않고
 * 빌드에서 해당 Section id를 알린다. 원본 배열과 order는 변경하지 않는다.
 */
export function groupProjectSections(
  sections: readonly ProjectSectionData[],
): ProjectSectionGroupData[] {
  for (const section of sections) {
    if (
      !PROJECT_SECTION_CATEGORIES.some(
        ({ key }) => key === section.category,
      )
    ) {
      throw new Error(
        `Invalid project section category "${section.category}" (section ${section.id}).`,
      );
    }
  }

  const ordered = [...sections].sort((a, b) => a.order - b.order);

  return PROJECT_SECTION_CATEGORIES.map(({ key, label }) => ({
    category: key,
    label,
    sections: ordered.filter((section) => section.category === key),
  })).filter((group) => group.sections.length > 0);
}
