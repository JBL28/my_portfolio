/**
 * data/ 아래 JSON 파일의 실제 필드 구조를 그대로 반영하는 타입 정의.
 * 01_설계.md 3.2, 02_구현계획.md 0장(데이터 파일 포맷 = JSON) 기준.
 */

export type RepositoryVisibility = "public" | "private" | "unknown";

export interface ProfileData {
  id: string;
  title: string;
  body: string;
  path: string;
  anchor: string;
  order: number;
  searchable: boolean;
}

export interface ProjectSectionData {
  id: string;
  title: string;
  body: string;
  anchor: string;
  order: number;
  searchable: boolean;
}

export interface ProjectData {
  id: string;
  name: string;
  slug: string;
  summary: string;
  period: string;
  teamSize: string;
  roles: string[];
  result: string;
  repositoryVisibility: RepositoryVisibility;
  /** repositoryVisibility=unknown 등 원문에 안내 문장이 없는 경우 필드 자체가 없다. */
  repositoryNotice?: string;
  technologies: string[];
  order: number;
  buildsOnProjectSlug: string | null;
  buildsOnEvidenceSectionIds: string[];
  sections: ProjectSectionData[];
}
