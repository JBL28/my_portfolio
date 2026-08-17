import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProjectBySlug,
  getProjectSlugsForStaticParams,
} from "@/lib/portfolio-data";
import { Container } from "@/components/ui/Container";
import { ProjectOverview } from "@/components/domains/project/ProjectOverview";
import { ProjectDetailSection } from "@/components/domains/project/ProjectDetailSection";
import { stripInlineRichText } from "@/lib/rich-text";

export function generateStaticParams() {
  return getProjectSlugsForStaticParams().map((slug) => ({ slug }));
}

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
    title: `${project.name} · Portfolio`,
    description: stripInlineRichText(project.summary),
  };
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) {
    notFound();
  }

  const sections = [...project.sections].sort((a, b) => a.order - b.order);

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <ProjectOverview project={project} />
      <div>
        {sections.map((section) => (
          <ProjectDetailSection key={section.id} section={section} />
        ))}
      </div>
    </Container>
  );
}
