import type { ProjectData } from "@/types/portfolio";
import { Badge } from "@/components/ui/Badge";
import { RichText, parseInlineRichText } from "@/lib/rich-text";

/**
 * Project Detail 상단 개요 블록. data/에는 Overview의 body 원문이 없으므로
 * (01_설계.md 3.2) Project 메타데이터(summary/period/teamSize/roles/
 * technologies/result)를 조합해 렌더링한다. anchor="overview"인 하나의
 * Section으로 취급해 <section id="overview">로 감싼다.
 *
 * repositoryNotice가 있을 때만 그 문장을 그대로 보여준다. repositoryVisibility가
 * "unknown"인 프로젝트(Home Server)는 repositoryNotice 필드 자체가 없으므로
 * 공개 여부에 대해 어떤 문구도 만들어내지 않는다 — 원문에 없는 주장을 임의로
 * 추가하지 않는다는 원칙(00_기획.md)을 그대로 따른다.
 */
export function ProjectOverview({ project }: { project: ProjectData }) {
  return (
    <section id="overview" className="pb-2">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {project.name}
      </h1>

      <RichText
        text={project.summary}
        className="mt-3 text-base leading-relaxed text-zinc-700 dark:text-zinc-300"
      />

      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 border-y border-zinc-200 py-5 text-sm sm:grid-cols-2 dark:border-zinc-800">
        <OverviewField label="기간">{project.period}</OverviewField>
        <OverviewField label="팀 구성">{project.teamSize}</OverviewField>
        <OverviewField label="담당">
          <ul className="space-y-0.5">
            {project.roles.map((role) => (
              <li key={role}>{parseInlineRichText(role)}</li>
            ))}
          </ul>
        </OverviewField>
        <OverviewField label="기술 스택" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {project.technologies.map((tech) => (
              <Badge key={tech}>{tech}</Badge>
            ))}
          </div>
        </OverviewField>
        <OverviewField label="결과" className="sm:col-span-2">
          {project.result}
        </OverviewField>
      </dl>

      {project.repositoryNotice ? (
        <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
          {project.repositoryNotice}
        </p>
      ) : null}
    </section>
  );
}

function OverviewField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-zinc-700 dark:text-zinc-300">{children}</dd>
    </div>
  );
}
