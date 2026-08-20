/**
 * data/ 아래 JSON 파일의 실제 필드 구조를 그대로 반영하는 타입 정의.
 * 01_설계.md 3.2, 02_구현계획.md 0장(데이터 파일 포맷 = JSON) 기준.
 */

export type RepositoryVisibility = "public" | "private" | "unknown";

/**
 * Home Contact 영역의 링크 하나 (원문 v1.3 Home: [GitHub] [Email] [Resume]).
 * 실제 URL은 원문에 존재하지 않아 데이터로 확정된 뒤에만 채운다 — 빈 배열이면
 * Contact 영역을 렌더링하지 않는다(존재하지 않는 링크를 지어내지 않는다).
 */
export interface ProfileContactLink {
  label: string;
  url: string;
}

/**
 * Home 좌측 레일에서 소개 문단 다음에 오는 신원 항목. 역량(skills)과 성격이 다르므로
 * (한쪽은 사무적 확인 정보, 다른 쪽은 직무 능력의 근거) 한 덩어리로 섞지 않고
 * 나눠 둔다.
 */
export interface ProfileAbout {
  birthDate: string;
  location: string;
  email: string;
  education: string;
  github: string;
}

/**
 * 기술 스택 한 묶음. 이름만 20개 늘어놓으면 첫 화면에서 노이즈가 되므로 역할별로
 * 묶는다. 숙련도 별점·퍼센트는 근거 없는 자기평가라 두지 않는다.
 */
export interface SkillGroup {
  label: string;
  items: string[];
}

/**
 * data/profile.json — 01_설계.md 5.1: "Home의 지원자 소개, 연락처 등 어떤 프로젝트에도
 * 속하지 않는 정보". id~searchable은 Neo4j Home Profile Section(3.2)과 공유하는 Graph용
 * 필드이고, name/role/about/skills/contacts는 FE(Home) 전용 필드다 — 적재 스크립트는
 * 자신이 아는 Section 필드만 읽으므로 FE 전용 필드가 있어도 영향이 없다.
 */
export interface ProfileData {
  id: string;
  /** Home 상단 identity: "이정복 · Backend Developer"의 이름 부분. */
  name: string;
  /** Home 상단 identity의 직무 부분. */
  role: string;
  title: string;
  body: string;
  path: string;
  anchor: string;
  order: number;
  searchable: boolean;
  about: ProfileAbout;
  skills: SkillGroup[];
  contacts: ProfileContactLink[];
}

/**
 * Project Detail 갤러리의 이미지 하나. 파일은 apps/web/public/projects/{slug}/ 아래에
 * 두고 src는 "/projects/{slug}/파일명" 형태의 public 경로를 쓴다.
 */
export interface ProjectImage {
  src: string;
  /** 스크린리더용 대체 텍스트 — 이미지가 보여주는 내용을 서술한다. */
  alt: string;
  /** 갤러리 하단에 표시할 짧은 설명(선택). */
  caption?: string;
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
  /**
   * 클릭 가능한 저장소 링크. 이 프로젝트 자체의 저장소가 아닐 수 있다 — 예를 들어
   * 서버 인프라 프로젝트는 보안상 원본 설정 저장소를 공개하지 않는 대신, 그 서버가
   * 실제로 운영 중인 다른 공개 저장소를 링크할 수 있다. repositoryNotice와 함께 쓰여
   * 그 관계를 설명한다.
   */
  repositoryUrl?: string;
  /**
   * 원문 v1.3 Home에서 이 프로젝트 카드 바로 뒤에 붙는 인용구(다음 프로젝트로의
   * 연결 문장, 예: "> 운영 도구의 Public 노출 문제를 다음 환경에서 다시
   * 설계했습니다."). repositoryNotice와 같은 규칙 — 원문에 없으면 필드 자체가 없다.
   */
  bridgeNote?: string;
  technologies: string[];
  order: number;
  buildsOnProjectSlug: string | null;
  buildsOnEvidenceSectionIds: string[];
  /**
   * Detail 페이지 갤러리에 표시할 이미지 목록(선택) — repositoryNotice/bridgeNote와
   * 같은 규칙으로, 실제 이미지가 확정된 프로젝트에만 필드를 둔다. 비어 있거나 없으면
   * 갤러리 영역 자체가 렌더링되지 않는다(자리를 지어내지 않는다).
   */
  images?: ProjectImage[];
  sections: ProjectSectionData[];
}
