import Link from "next/link";
import type { ProjectData } from "@/types/portfolio";
import { Badge } from "@/components/ui/Badge";
import { RichText, parseInlineRichText } from "@/lib/rich-text";

/**
 * Home 화면의 프로젝트 레코드. data/projects/{slug}.json의
 * summary/period/teamSize/roles/result/technologies를 그대로 표시한다
 * (01_설계.md 5.1 — Home 카드와 Detail 페이지는 같은 원본 파일을 공유).
 *
 * 카드 그리드가 아니라 시간축 위의 레코드다 — 기간(mono)이 첫 줄에 오고 스레드
 * 마커(app/page.tsx)가 그 줄에 정렬된다. bridgeNote(원문 v1.3 Home의 카드 연결
 * 인용구)가 있으면 레코드 하단에서 다음 레코드로의 연결을 잇는다.
 */
export function ProjectCard({ project }: { project: ProjectData }) {
  return (
    <article>
      <p className="font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-400">
        {project.period}
        <span className="text-zinc-300 dark:text-zinc-600"> — </span>
        {project.teamSize}
      </p>

      <h3 className="mt-2 text-[1.35rem] font-bold leading-snug tracking-[-0.015em] text-zinc-900 dark:text-zinc-100">
        <Link
          href={`/projects/${project.slug}`}
          className="decoration-zinc-300 underline-offset-[6px] hover:underline dark:decoration-zinc-600"
        >
          {project.name}
        </Link>
      </h3>

      <RichText
        text={project.summary}
        className="mt-3 max-w-xl text-[0.9375rem] leading-[1.8] text-zinc-600 dark:text-zinc-400"
      />

      <dl className="mt-5 space-y-1.5 text-[0.8125rem]">
        <div className="flex gap-4">
          <dt className="w-8 shrink-0 pt-px text-xs leading-5 text-zinc-400 dark:text-zinc-500">
            담당
          </dt>
          <dd className="leading-5 text-zinc-600 dark:text-zinc-400">
            {project.roles.map((role, index) => (
              <span key={role}>
                {index > 0 ? " · " : null}
                {parseInlineRichText(role)}
              </span>
            ))}
          </dd>
        </div>
        <div className="flex gap-4">
          <dt className="w-8 shrink-0 pt-px text-xs leading-5 text-zinc-400 dark:text-zinc-500">
            결과
          </dt>
          <dd className="leading-5 text-zinc-600 dark:text-zinc-400">{project.result}</dd>
        </div>
      </dl>

      <ul className="mt-5 flex flex-wrap gap-1.5">
        {project.technologies.map((tech) => (
          <li key={tech}>
            <Badge>{tech}</Badge>
          </li>
        ))}
      </ul>

      <Link
        href={`/projects/${project.slug}`}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
      >
        자세히 보기
        <span aria-hidden="true" className="font-mono text-xs">
          →
        </span>
      </Link>

      {project.bridgeNote ? (
        <p className="mt-10 text-[0.8125rem] leading-relaxed text-zinc-400 dark:text-zinc-500">
          <span aria-hidden="true" className="font-mono">
            ↳{" "}
          </span>
          {project.bridgeNote}
        </p>
      ) : null}
    </article>
  );
}
