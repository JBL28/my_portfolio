import type { ProjectData } from "@/types/portfolio";
import { Badge } from "@/components/ui/Badge";
import { RichText, parseInlineRichText } from "@/lib/rich-text";
import { Reveal } from "@/components/ui/Reveal";
import { STAGGER } from "@/lib/motion";

/**
 * Project Detail 좌측의 "명세" 레일. data/에는 Overview의 body 원문이 없으므로
 * (01_설계.md 3.2) Project 메타데이터(summary/period/teamSize/roles/
 * technologies/result)를 조합해 렌더링한다. anchor="overview"인 하나의
 * Section으로 취급해 <section id="overview">로 감싼다 — citation이 이 id로 착지한다.
 *
 * 메타데이터는 hairline으로 구분된 spec sheet 행이다 — "계약/명세를 만드는
 * 백엔드"라는 인물의 재료를 형식으로 옮긴 것. lg 이상에서는 스크롤해도 고정되어,
 * 우측 서술을 읽는 내내 명세가 곁에 남는다.
 *
 * repositoryNotice가 있을 때만 그 문장을 그대로 보여준다. repositoryVisibility가
 * "unknown"인 프로젝트(Home Server)는 repositoryNotice 필드 자체가 없으므로
 * 공개 여부에 대해 어떤 문구도 만들어내지 않는다 — 원문에 없는 주장을 임의로
 * 추가하지 않는다는 원칙(00_기획.md)을 그대로 따른다.
 */
export function ProjectOverview({
  project,
}: Readonly<{ project: ProjectData }>) {
  return (
    <section id="overview" className="lg:sticky lg:top-20 lg:self-start">
      <Reveal>
        <p className="font-mono text-xs tracking-[0.22em] text-zinc-400 uppercase dark:text-zinc-500">
          Project
        </p>
        <h1 className="mt-4 text-[1.9rem] font-bold leading-tight tracking-[-0.02em] text-zinc-900 dark:text-zinc-100">
          {project.name}
        </h1>
      </Reveal>

      <Reveal delay={STAGGER}>
        <RichText
          text={project.summary}
          className="mt-5 text-[0.9375rem] leading-[1.85] text-zinc-600 dark:text-zinc-400"
        />
      </Reveal>

      <dl className="mt-8 border-t border-zinc-200 text-sm dark:border-zinc-800">
        <OverviewRow label="기간">
          <span className="font-mono text-[0.8125rem]">{project.period}</span>
        </OverviewRow>
        <OverviewRow label="팀 구성">{project.teamSize}</OverviewRow>
        <OverviewRow label="담당">
          {project.roles.map((role, index) => (
            <span key={role}>
              {index > 0 ? " · " : null}
              {parseInlineRichText(role)}
            </span>
          ))}
        </OverviewRow>
        <OverviewRow label="기술 스택">
          <span className="flex flex-wrap gap-1.5">
            {project.technologies.map((tech) => (
              <Badge key={tech}>{tech}</Badge>
            ))}
          </span>
        </OverviewRow>
        <OverviewRow label="결과">{project.result}</OverviewRow>
      </dl>

      {project.repositoryNotice ? (
        <p className="mt-6 text-[0.8125rem] leading-relaxed text-zinc-400 dark:text-zinc-500">
          {project.repositoryNotice}
        </p>
      ) : null}
    </section>
  );
}

function OverviewRow({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-5 border-b border-zinc-200 py-3.5 dark:border-zinc-800">
      <dt className="pt-px text-xs leading-6 text-zinc-400 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="text-[0.875rem] leading-6 text-zinc-700 dark:text-zinc-300">
        {children}
      </dd>
    </div>
  );
}
