/**
 * 프로젝트 상세 분류의 이름과 공통 표시 순서.
 *
 * 목표는 분류 기능 자체보다 유지보수다(01_설계.md 5.7). 프로젝트마다 순서나
 * 라벨을 복사하지 않고, 이 목록에서 분류 타입까지 파생해 변경 지점을 하나로 둔다.
 */
export const PROJECT_SECTION_CATEGORIES = [
  { key: "backend", label: "Backend" },
  { key: "ai", label: "AI" },
  { key: "infra", label: "Infra" },
  { key: "devops", label: "DevOps" },
  { key: "communication", label: "Communication" },
] as const;

export type ProjectSectionCategory =
  (typeof PROJECT_SECTION_CATEGORIES)[number]["key"];
