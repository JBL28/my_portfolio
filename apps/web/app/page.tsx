import { getProfile, getAllProjects } from "@/lib/portfolio-data";
import { Container } from "@/components/ui/Container";
import { ProjectCard } from "@/components/domains/project/ProjectCard";
import { RichText, parseInlineRichText, splitParagraphs } from "@/lib/rich-text";

export default function HomePage() {
  const profile = getProfile();
  const projects = getAllProjects();

  // profile.body 첫 문단은 소개 헤드라인, 나머지는 부연 설명으로 자연스럽게 읽히는
  // 원문 구조라(data/profile.json 참고) 첫 문단만 페이지의 유일한 h1로 승격한다.
  // 텍스트 내용 자체는 바꾸지 않고 시맨틱 태그만 나눈다.
  const [headline, ...rest] = splitParagraphs(profile.body);

  return (
    <Container size="wide">
      <section id={profile.anchor} className="py-12 sm:py-16">
        <h1 className="max-w-2xl text-2xl font-semibold leading-snug text-zinc-900 sm:text-3xl dark:text-zinc-100">
          {parseInlineRichText(headline)}
        </h1>
        {rest.length > 0 ? (
          <RichText
            text={rest.join("\n\n")}
            className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400"
          />
        ) : null}
      </section>

      <section className="pb-16">
        <h2 className="font-mono text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Projects
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      </section>
    </Container>
  );
}
