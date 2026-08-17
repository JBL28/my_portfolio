import Link from "next/link";
import type { ProjectData } from "@/types/portfolio";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RichText, parseInlineRichText } from "@/lib/rich-text";

/**
 * Home 화면의 프로젝트 카드. data/projects/{slug}.json의
 * summary/period/teamSize/roles/result/technologies를 그대로 표시한다
 * (01_설계.md 5.1 — Home 카드와 Detail 페이지는 같은 원본 파일을 공유).
 */
export function ProjectCard({ project }: { project: ProjectData }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
          {project.name}
        </h3>
        <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {project.period}
        </span>
      </div>

      <RichText
        text={project.summary}
        className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
      />

      <dl className="mt-4 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex gap-2">
          <dt className="shrink-0 text-zinc-400 dark:text-zinc-500">팀 구성</dt>
          <dd>{project.teamSize}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-zinc-400 dark:text-zinc-500">담당</dt>
          <dd>
            {project.roles.map((role, index) => (
              <span key={role}>
                {index > 0 ? " · " : null}
                {parseInlineRichText(role)}
              </span>
            ))}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-zinc-400 dark:text-zinc-500">결과</dt>
          <dd>{project.result}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {project.technologies.map((tech) => (
          <Badge key={tech}>{tech}</Badge>
        ))}
      </div>

      <Link
        href={`/projects/${project.slug}`}
        className="mt-5 inline-flex items-center text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
      >
        자세히 보기 →
      </Link>
    </Card>
  );
}
