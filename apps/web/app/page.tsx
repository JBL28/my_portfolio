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
 * Home — 위에서 아래로 읽는 한 줄 구조: identity·헤드라인 → About(신원·역량) →
 * Projects(연대기).
 *
 * 원래는 좌측 "명세"(sticky) + 우측 "서술" 2단이었다. 계약을 먼저 세우고 그 위에
 * 구현을 쌓는다는 논지를 레이아웃으로 옮긴 것이었는데, **읽는 사람에게 그 대비가
 * 전달되지 않았다** — 리뷰에서 두 사람이 각각 "왜 2단인가", "두 영역을 배경색으로
 * 갈라달라"고 물었다. 의미를 알려면 이 주석을 읽어야 하는 장치라면 전달되고 있지
 * 않은 것이므로, Home에서는 접었다.
 *
 * Project Detail의 2단은 그대로 둔다. 그쪽 레일은 프로젝트 명세(기간·팀·담당·스택)라
 * 우측 서술을 읽는 내내 옆에 남을 **기능적 이유**가 있다. Home의 레일에 있던 것은
 * 신원과 연락처였고, 스크롤하는 동안 계속 볼 이유가 약했다.
 *
 * 바깥 Container는 wide(6xl)를 유지하고 안쪽 읽기 열만 3xl로 묶는다 — Header·Footer와
 * 왼쪽 기준선을 맞추기 위해서다. 폭을 좁히면 정렬이 어긋난다.
 */
export default function HomePage() {
  const profile = getProfile();
  const projects = getAllProjects();

  // profile.body 첫 문단은 소개 헤드라인, 나머지는 부연 설명으로 자연스럽게 읽히는
  // 원문 구조라(data/profile.json 참고) 첫 문단만 페이지의 유일한 h1로 승격한다.
  // 텍스트 내용 자체는 바꾸지 않고 시맨틱 태그만 나눈다.
  const [headline, ...rest] = splitParagraphs(profile.body);

  return (
    <Container className="py-14 sm:py-20">
      <div className="max-w-3xl">
        {/* identity + 논지 헤드라인 + 소개. 헤드라인이 24rem 레일에 갇혀 있던 것이
          이번 변경의 실질적인 이득이다 — 첫 화면에서 가장 먼저 읽혀야 할 문장에
          제 폭을 준다. */}
        <section id={profile.anchor}>
          <Reveal>
            <p className="font-mono text-xs tracking-[0.22em] text-zinc-500 uppercase dark:text-zinc-400">
              {profile.role}
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
        </section>

        {/*
          About — 신원과 역량.

          두 종류가 섞여 있어서 기하를 반대로 갈랐다.

          - 생년월일·위치·학력·이메일·GitHub는 **짧은 스칼라 값**이다. 한 행에 하나씩
            놓으면 넓어진 열에서 오른쪽이 통째로 비므로, 여러 열로 접는다.
          - Backend·Data·Infra는 **집합**이다. 이건 넓은 폭이 실제로 필요하니 한 행을
            다 쓴다.

          그래서 위는 괘선 없는 격자, 아래는 괘선 있는 행이다. 두 구역의 생김새 차이가
          곧 정보의 차이라 장식이 아니다.

          라벨의 서체도 갈린다 — 위는 한글 라벨이라 Pretendard, 아래는 영문 레이어명이라
          mono다. 페이지의 다른 eyebrow(Gallery/Projects/About)가 전부 mono 영문이므로
          스택 라벨이 그 계열에 붙고, 한글 사실 라벨은 본문 계열에 붙는다.
        */}
        <section id="about" className="mt-16">
          <Reveal delay={STAGGER * 2}>
            <div className="flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <h2 className="font-mono text-xs tracking-[0.22em] text-zinc-500 uppercase dark:text-zinc-400">
                About
              </h2>
            </div>

            <dl>
              {/* 사실 — 좁은 화면 2열, 넓어지면 3열. 괘선을 두지 않아 아래 스택과
                  성격이 갈린다. */}
              <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-3">
                <Fact label="학력">{profile.about.education}</Fact>
                <Fact label="자격·어학" mono>
                  {/* 여러 줄이라 한 칸 안에서 세로로 쌓는다. 격자의 다른 칸은
                      한 줄짜리이므로 이 칸만 높아지는데, 행 높이가 아니라 칸 높이만
                      늘어나므로 옆 칸을 밀지 않는다. */}
                  <span className="flex flex-col gap-1">
                    {profile.about.certifications.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </span>
                </Fact>
                <Fact label="이메일" mono>
                  {/* 메일 주소는 읽고 끝나는 정보가 아니라 누르는 동선이다. */}
                  <FactLink href={`mailto:${profile.about.email}`}>
                    {profile.about.email}
                  </FactLink>
                </Fact>
                <Fact label="GitHub" mono>
                  {/* 주소는 스킴을 떼고 보여준다 — "https://"는 읽는 데 보탬이 없다. */}
                  <FactLink href={profile.about.github} external>
                    {profile.about.github.replace(/^https?:\/\//, "")}
                  </FactLink>
                </Fact>
              </div>

              {/* 스택 — 위에서 아래로 앱·상태·운영 순이다. 데이터(profile.skills)의
                  순서가 곧 그 층위이므로 따로 표시하지 않는다. */}
              <div className="mt-12 border-t border-zinc-200 dark:border-zinc-800">
                {profile.skills.map((group) => (
                  <div
                    key={group.label}
                    className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-5 border-b border-zinc-200 py-4 sm:grid-cols-[6rem_minmax(0,1fr)] dark:border-zinc-800"
                  >
                    <dt className="pt-1 font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase dark:text-zinc-400">
                      {group.label}
                    </dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {group.items.map((item) => (
                        <Badge key={item}>{item}</Badge>
                      ))}
                    </dd>
                  </div>
                ))}
              </div>
            </dl>
          </Reveal>
        </section>

        {/* Projects — 시간순 레코드. 이 순서 자체가 정보다: 각 프로젝트는
          이전 프로젝트의 남은 문제 위에 세워졌고(data/의 buildsOn 관계), 레코드
          사이의 인용구(bridgeNote — 원문 v1.3 Home의 카드 연결 문장 그대로)가 그
          연결을 잇는다. 왼쪽 스레드는 그 성장 그래프의 시각화이며, 첫 마커에서
          시작해 마지막(최신) 마커에서 열린 채 끝난다. */}
        {/* overflow-x: clip - Reveal from="right"가 오른쪽 바깥에서 들어오므로
          잘라내지 않으면 문서 폭이 늘어 가로 스크롤바가 생긴다. */}
        <section className="mt-20 overflow-x-clip">
          <div className="flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <h2 className="font-mono text-xs tracking-[0.22em] text-zinc-500 uppercase dark:text-zinc-400">
              Projects
            </h2>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
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
                    <ProjectCard
                      project={project}
                      inherited={projects[index - 1]?.bridgeNote}
                    />
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </Container>
  );
}

/**
 * 사실 한 칸 — 라벨 위, 값 아래. 값이 짧아서 라벨을 옆에 두면 폭이 남는다.
 * `mono`는 값이 식별자(날짜·주소·핸들)일 때만 쓴다 — 한글 값은 mono에서 대체 서체로
 * 떨어져 오히려 읽기 나빠진다.
 */
function Fact({
  label,
  mono = false,
  children,
}: Readonly<{
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <div>
      <dt className="text-[11px] leading-none text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-2 leading-snug text-zinc-700 dark:text-zinc-300",
          mono
            ? "font-mono text-[0.8125rem] break-all tabular-nums"
            : "text-[0.9375rem]",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** 사실 칸 안의 링크. 밑줄은 hover에서만 진해진다. */
function FactLink({
  href,
  external = false,
  children,
}: Readonly<{
  href: string;
  external?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 hover:decoration-zinc-900 dark:decoration-zinc-600 dark:hover:text-zinc-100 dark:hover:decoration-zinc-100"
    >
      {children}
    </a>
  );
}
