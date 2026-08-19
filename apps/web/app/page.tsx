import { getProfile, getAllProjects } from "@/lib/portfolio-data";
import { Container } from "@/components/ui/Container";
import { ProjectCard } from "@/components/domains/project/ProjectCard";
import { RichText, parseInlineRichText, splitParagraphs } from "@/lib/rich-text";
import { cn } from "@/lib/cn";

/**
 * Home — 2단 구조: 좌측은 고정된 "명세"(identity·소개·연락처, sticky 레일),
 * 우측은 흐르는 "서술"(프로젝트 연대기). 계약/명세를 먼저 세우고 그 위에 구현을
 * 쌓는다는 이 포트폴리오의 논지를 레이아웃 뼈대로 옮긴 것이다(설계 5.5의 무채색·
 * 컴팩트 원칙 안에서). 모바일에서는 레일이 위로 자연스럽게 쌓인다.
 */
export default function HomePage() {
  const profile = getProfile();
  const projects = getAllProjects();

  // profile.body 첫 문단은 소개 헤드라인, 나머지는 부연 설명으로 자연스럽게 읽히는
  // 원문 구조라(data/profile.json 참고) 첫 문단만 페이지의 유일한 h1로 승격한다.
  // 텍스트 내용 자체는 바꾸지 않고 시맨틱 태그만 나눈다.
  const [headline, ...rest] = splitParagraphs(profile.body);

  return (
    <Container className="py-14 sm:py-20 lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-x-20">
      {/* 좌측 레일 — 원문 v1.3 Home 상단(identity + 논지 헤드라인 + 소개)과 하단
          Contact를 담는다. lg 이상에서는 스크롤해도 고정된다. */}
      <section
        id={profile.anchor}
        className="lg:sticky lg:top-20 lg:self-start"
      >
        <p className="font-mono text-xs tracking-[0.22em] text-zinc-500 uppercase dark:text-zinc-400">
          {profile.name} · {profile.role}
        </p>
        <h1 className="mt-6 text-[1.75rem] font-bold leading-[1.32] tracking-[-0.02em] text-zinc-900 sm:text-[2rem] dark:text-zinc-100">
          {parseInlineRichText(headline)}
        </h1>
        {rest.length > 0 ? (
          <RichText
            text={rest.join("\n\n")}
            className="mt-6 text-[0.9375rem] leading-[1.85] text-zinc-600 dark:text-zinc-400"
          />
        ) : null}

        {/* 원문 v1.3 Home 하단 Contact([GitHub] [Email] [Resume]) — 실제 URL은 원문에
            존재하지 않으므로 data/profile.json의 contacts에 확정된 링크가 있을 때만
            렌더링한다(존재하지 않는 링크를 지어내지 않는다). */}
        {profile.contacts.length > 0 ? (
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            {profile.contacts.map((contact) => (
              <li key={contact.label}>
                <a
                  href={contact.url}
                  target={contact.url.startsWith("http") ? "_blank" : undefined}
                  rel={contact.url.startsWith("http") ? "noreferrer" : undefined}
                  className="font-mono text-sm text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 hover:decoration-zinc-900 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-100 dark:hover:decoration-zinc-100"
                >
                  {contact.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* 우측 서술 — 시간순 프로젝트 레코드. 이 순서 자체가 정보다: 각 프로젝트는
          이전 프로젝트의 남은 문제 위에 세워졌고(data/의 buildsOn 관계), 레코드
          사이의 인용구(bridgeNote — 원문 v1.3 Home의 카드 연결 문장 그대로)가 그
          연결을 잇는다. 왼쪽 스레드는 그 성장 그래프의 시각화이며, 첫 마커에서
          시작해 마지막(최신) 마커에서 열린 채 끝난다. */}
      <section className="mt-20 lg:mt-0">
        <div className="flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <h2 className="font-mono text-xs tracking-[0.22em] text-zinc-500 uppercase dark:text-zinc-400">
            Projects
          </h2>
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
            {projects.length}
          </span>
        </div>

        <ol>
          {projects.map((project, index) => {
            const isFirst = index === 0;
            const isLast = index === projects.length - 1;
            return (
              <li key={project.slug} className="relative pt-12 pl-7 sm:pl-9">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[3px] w-px bg-zinc-200 dark:bg-zinc-800",
                    isFirst ? "top-[3.75rem]" : "top-0",
                    isLast ? "bottom-auto h-[3.75rem]" : "bottom-0",
                    isFirst && isLast && "hidden",
                  )}
                />
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[3.5rem] h-[7px] w-[7px] bg-zinc-900 dark:bg-zinc-100"
                />
                <ProjectCard project={project} />
              </li>
            );
          })}
        </ol>
      </section>
    </Container>
  );
}
