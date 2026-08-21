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
 * 마커(app/page.tsx)가 그 줄에 정렬된다.
 *
 * `inherited`는 **이전 레코드의 bridgeNote**다. 원래는 그 카드 하단에 매달려 있었는데,
 * 회색 13px로 카드 끝에 떠 있으니 각주처럼 읽히고 잘 보이지도 않았다. 제목 바로 아래로
 * 옮겨 이 레코드가 무엇을 받아서 시작했는지를 먼저 말하게 한다.
 *
 * 카드 위(레코드 첫 줄)가 아니라 **제목 아래**인 이유는, 위에 두면 스레드 마커가 그
 * 줄을 가리켜 어느 프로젝트 이야기인지 흐려지기 때문이다. 제목 다음이면 이 레코드에
 * 속한다는 것이 분명하다.
 */
export function ProjectCard({
  project,
  inherited,
}: Readonly<{
  project: ProjectData;
  /** 이전 레코드가 남긴 문제(= 이전 프로젝트의 bridgeNote). 첫 레코드에는 없다. */
  inherited?: string;
}>) {
  return (
    <article>
      <p className="font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-400">
        {/* 구분자를 본문보다 흐리게 두려 했으나, zinc 계단에서 라이트 모드 3:1을
            넘기는 단계가 곧바로 본문 색이라 중간값이 없다. 안 보이는 장식보다
            같은 색이 낫다. */}
        {project.period} — {project.teamSize}
      </p>

      <h3 className="mt-2 text-[1.35rem] font-bold leading-snug tracking-[-0.015em] text-zinc-900 dark:text-zinc-100">
        <Link
          href={`/projects/${project.slug}`}
          className="decoration-zinc-300 underline-offset-[6px] hover:underline dark:decoration-zinc-600"
        >
          {project.name}
        </Link>
      </h3>

      {inherited ? (
        /* 다른 레코드에서 넘어온 문장이라는 것을 왼쪽 hairline으로만 표시한다.
           화살표 기호(↳)는 뺐다 — 방향을 가리키던 기호인데 이제 위치가 방향을
           말하므로 남겨두면 같은 말을 두 번 한다. */
        <p className="mt-3 max-w-xl border-l border-zinc-200 pl-3 text-[0.8125rem] leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {inherited}
        </p>
      ) : null}

      <RichText
        text={project.summary}
        className="mt-3 max-w-xl text-[0.9375rem] leading-[1.8] text-zinc-600 dark:text-zinc-400"
      />

      <dl className="mt-5 space-y-1.5 text-[0.8125rem]">
        <div className="flex gap-4">
          <dt className="w-8 shrink-0 pt-px text-xs leading-5 text-zinc-500 dark:text-zinc-400">
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
          <dt className="w-8 shrink-0 pt-px text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            결과
          </dt>
          <dd className="leading-5 text-zinc-600 dark:text-zinc-400">
            {project.result}
          </dd>
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
        자세히 보기{" "}
        <span aria-hidden="true" className="font-mono text-xs">
          →
        </span>
      </Link>
    </article>
  );
}
