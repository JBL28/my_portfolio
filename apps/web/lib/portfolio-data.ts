import fs from "node:fs";
import path from "node:path";
import type { ProfileData, ProjectData } from "@/types/portfolio";

/**
 * apps/web은 저장소 루트의 data/ 를 유일한 원본으로 삼는다(01_설계.md 5.1).
 * apps/web에서 "../../data" 상대 참조 — process.cwd()는 `next build`/`next dev`가
 * 실행되는 apps/web 디렉터리이므로 두 단계 위가 저장소 루트다.
 * 빌드 타임(SSG)에만 읽고 런타임에 DB를 조회하지 않는다는 설계 원칙에 따라
 * 이 모듈은 Server Component/생성 함수에서만 사용한다.
 */
const DATA_ROOT = path.join(process.cwd(), "..", "..", "data");

function readJson<T>(relativePath: string): T {
  const filePath = path.join(DATA_ROOT, relativePath);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function getProfile(): ProfileData {
  return readJson<ProfileData>("profile.json");
}

function getProjectSlugs(): string[] {
  const projectsDir = path.join(DATA_ROOT, "projects");
  return fs
    .readdirSync(projectsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));
}

export function getAllProjects(): ProjectData[] {
  return getProjectSlugs()
    .map((slug) => readJson<ProjectData>(`projects/${slug}.json`))
    .sort((a, b) => a.order - b.order);
}

export function getProjectSlugsForStaticParams(): string[] {
  return getProjectSlugs();
}

export function getProjectBySlug(slug: string): ProjectData | null {
  try {
    return readJson<ProjectData>(`projects/${slug}.json`);
  } catch {
    return null;
  }
}
