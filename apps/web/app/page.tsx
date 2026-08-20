import { getProfile, getAllProjects } from "@/lib/portfolio-data";
import { Container } from "@/components/ui/Container";
import { ProjectCard } from "@/components/domains/project/ProjectCard";
import { Badge } from "@/components/ui/Badge";
import {
  RichText,
  parseInlineRichText,
  splitParagraphs,
} from "@/lib/rich-text";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/ui/Reveal";
import { STAGGER } from "@/lib/motion";

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
        <Reveal>
          <p className="font-mono text-xs tracking-[0.22em] text-zinc-500 uppercase dark:text-zinc-400">
            {profile.name} · {profile.role}
          </p>
          <h1 className="mt-6 text-[1.75rem] font-bold leading-[1.32] tracking-[-0.02em] text-zinc-900 sm:text-[2rem] dark:text-zinc-100">
            {parseInlineRichText(headline)}
          </h1>
        </Reveal>
        <Reveal delay={STAGGER}>
          {rest.length > 0 ? (
            <RichText
              text={rest.join("\n\n")}
              className="mt-6 text-[0.9375rem] leading-[1.85] text-zinc-600 dark:text-zinc-400"
            />
          ) : null}
        </Reveal>

        {/* 소개 문단에 이어지는 신원·역량 항목. Project Detail의 명세 레일
            (ProjectOverview)과 같은 hairline dt/dd 문법을 그대로 써서, 별도의
            섹션을 만들지 않고 이 레일의 연장으로 읽히게 한다. */}
        <Reveal delay={STAGGER * 2}>
          <dl className="mt-9 border-t border-zinc-200 dark:border-zinc-800">
            <ProfileRow label="생년월일">
              <span className="font-mono text-[0.8125rem] tabular-nums">
                {profile.about.birthDate}
              </span>
            </ProfileRow>
            <ProfileRow label="위치">{profile.about.location}</ProfileRow>
            <ProfileRow label="이메일">
              {/* 메일 주소는 읽고 끝나는 정보가 아니라 누르는 동선이다. */}
              <a
                href={`mailto:${profile.about.email}`}
                className="font-mono text-[0.8125rem] break-all underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 hover:decoration-zinc-900 dark:decoration-zinc-600 dark:hover:text-zinc-100 dark:hover:decoration-zinc-100"
              >
                {profile.about.email}
              </a>
            </ProfileRow>
            <ProfileRow label="학력">{profile.about.education}</ProfileRow>
            {profile.skills.map((group) => (
              <ProfileRow key={group.label} label={group.label}>
                <span className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </span>
              </ProfileRow>
            ))}
            <ProfileRow label="GitHub">
              {/* 스택을 읽고 나서 바로 코드를 확인하러 가는 동선이라 스택 뒤에 둔다.
                  주소는 스킴을 떼고 보여준다 — 좁은 레일에서 "https://"는 읽는 데
                  보탬이 없으면서 자리만 차지한다. */}
              <a
                href={profile.about.github}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[0.8125rem] break-all underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 hover:decoration-zinc-900 dark:decoration-zinc-600 dark:hover:text-zinc-100 dark:hover:decoration-zinc-100"
              >
                {profile.about.github.replace(/^https?:\/\//, "")}
              </a>
            </ProfileRow>
          </dl>
        </Reveal>

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
                  rel={
                    contact.url.startsWith("http") ? "noreferrer" : undefined
                  }
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
      {/* overflow-x: clip - Reveal from="right"가 오른쪽 바깥에서 들어오므로
          잘라내지 않으면 문서 폭이 늘어 가로 스크롤바가 생긴다. hidden이 아니라
          clip인 것은 hidden이 스크롤 컨테이너를 만들어 좌측 레일의 sticky를
          깨뜨리기 때문이다. */}
      <section className="mt-20 overflow-x-clip lg:mt-0">
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
                {/* 타임라인 선/점은 정지시키고 카드 본문만 떠오르게 한다. */}
                <Reveal from="right">
                  <ProjectCard project={project} />
                </Reveal>
              </li>
            );
          })}
        </ol>
      </section>
    </Container>
  );
}

/** 좌측 레일의 명세 행. ProjectOverview의 OverviewRow와 같은 문법이고, 레일
 *  폭(24rem)에 맞춰 라벨 열만 좁혔다. */
function ProfileRow({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 border-b border-zinc-200 py-3 dark:border-zinc-800">
      <dt className="pt-px text-xs leading-6 text-zinc-400 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="text-[0.875rem] leading-6 text-zinc-700 dark:text-zinc-300">
        {children}
      </dd>
    </div>
  );
}
