import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProjectBySlug,
  getProjectSlugsForStaticParams,
} from "@/lib/portfolio-data";
import { Container } from "@/components/ui/Container";
import { ProjectOverview } from "@/components/domains/project/ProjectOverview";
import { ProjectGallery } from "@/components/domains/project/ProjectGallery";
import { Reveal } from "@/components/ui/Reveal";
import { ProjectDetailSection } from "@/components/domains/project/ProjectDetailSection";
import { stripInlineRichText } from "@/lib/rich-text";

export function generateStaticParams() {
  return getProjectSlugsForStaticParams().map((slug) => ({ slug }));
}

// 01_설계.md 5.1: `/projects/[slug]`는 SSG 전용이다 — generateStaticParams가 반환한
// slug 밖의 경로는 런타임 렌더 없이 곧바로 404 처리해, 배포 환경에서 서버가 data/를
// 런타임에 읽는 경로 자체를 만들지 않는다.
export const dynamicParams = false;

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) {
    return { title: "Portfolio" };
  }
  return {
    title: `${project.name} · 이정복`,
    description: stripInlineRichText(project.summary),
  };
}

/**
 * Project Detail — Home과 같은 2단 뼈대를 유지한다: 좌측은 고정된 "명세"(프로젝트
 * 메타데이터 spec sheet, sticky), 우측은 흐르는 "서술"(H2 Section 원문). AI 답변의
 * citation은 우측 서술의 anchor로 착지한다.
 */
export default async function ProjectDetailPage({
  params,
}: Readonly<ProjectPageProps>) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) {
    notFound();
  }

  const sections = [...project.sections].sort((a, b) => a.order - b.order);
  // 갤러리에 거는 것과 Section 증거가 찾아 쓰는 것은 같은 목록이다(types/portfolio.ts의
  // ProjectImage). 증거 전용 이미지는 갤러리에서만 빼고 목록에서는 빼지 않는다 —
  // 증거가 src로 이 목록을 뒤져 alt·caption을 가져오기 때문이다.
  const galleryImages = (project.images ?? []).filter(
    (image) => !image.evidenceOnly,
  );
  const hasGallery = galleryImages.length > 0;

  return (
    <Container className="py-14 sm:py-20 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-x-20">
      <ProjectOverview project={project} />
      {/* overflow-x: clip - app/page.tsx와 같은 이유(Reveal from="right"). */}
      <div className="mt-16 overflow-x-clip lg:mt-0">
        {/* 갤러리는 이미지가 확정된 프로젝트(data/projects의 images 필드)에서만
            서술 컬럼 상단에 나타난다 — 없는 자리를 지어내지 않는다. */}
        {hasGallery ? (
          <Reveal from="right">
            <ProjectGallery
              images={galleryImages}
              projectName={project.name}
            />
          </Reveal>
        ) : null}
        {/* stagger를 주지 않는다 - 섹션 하나하나가 길어서 순차 지연이 쌓이면
            스크롤을 따라 내려가는 읽기 속도를 애니메이션이 앞지르지 못한다. */}
        {sections.map((section, index) => (
          <Reveal key={section.id} from="right">
            <ProjectDetailSection
              section={section}
              images={project.images ?? []}
              isFirst={index === 0 && !hasGallery}
            />
          </Reveal>
        ))}
      </div>
    </Container>
  );
}
