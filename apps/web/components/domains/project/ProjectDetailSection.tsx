import type { ProjectImage, ProjectSectionData } from "@/types/portfolio";
import { RichText } from "@/lib/rich-text";
import { SectionEvidenceList } from "@/components/domains/project/SectionEvidence";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { highlightCode } from "@/lib/highlight";

/**
 * Project Detail 우측 "서술" 컬럼의 H2 Section. 01_설계.md 3.2의 anchor 렌더링
 * 규칙에 따라 <section id={section.anchor}>로 렌더링한다 — 이후 Phase의 citation
 * 링크가 `path#anchor`로 이 id를 찾아간다.
 *
 * 제목 hover 시 나타나는 `#`는 그 anchor로의 직접 링크다 — AI 답변의 citation이
 * 실제로 이 지점으로 연결된다는 구조를 화면에서도 드러낸다(장식이 아니라
 * 실제 동작하는 앵커).
 */
export async function ProjectDetailSection({
  section,
  images,
  isFirst = false,
}: Readonly<{
  section: ProjectSectionData;
  /** 갤러리 이미지 — 증거가 src로 이 목록을 가리킨다. */
  images: ProjectImage[];
  isFirst?: boolean;
}>) {
  const evidence = section.evidence ?? [];
  // 문법 강조는 서버에서 끝낸다 — Shiki를 클라이언트로 내려보내면 문법 파일까지
  // 번들에 실린다(lib/highlight.ts). 이미지 증거 자리는 null로 비워 인덱스를 맞춘다.
  const highlighted = await Promise.all(
    evidence.map((item) =>
      item.kind === "code" ? highlightCode(item.code, item.language) : null,
    ),
  );

  return (
    <section
      id={section.anchor}
      className={
        isFirst
          ? "scroll-mt-24 pb-12"
          : "scroll-mt-24 border-t border-zinc-200 py-12 dark:border-zinc-800"
      }
    >
      <h2 className="group text-[1.2rem] font-bold leading-snug tracking-[-0.015em] text-zinc-900 dark:text-zinc-100">
        {section.title}
        <a
          href={`#${section.anchor}`}
          aria-label={`"${section.title}" 섹션 링크`}
          className="ml-2 font-mono text-base font-normal text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 dark:text-zinc-400"
        >
          #
        </a>
      </h2>
      <RichText
        text={section.body}
        className="mt-4 max-w-xl text-[0.9375rem] leading-[1.9] text-zinc-600 dark:text-zinc-400"
      />
      {/* 증거는 있을 때만 붙는다 — 없는 문단이 기본이다. 근거(오버레이)를 먼저,
          외부 링크를 그다음에 둔다: 이 사이트 안에서 확인할 수 있는 것을 먼저
          보여주고, 밖으로 나가는 길은 뒤에 놓는다. */}
      {evidence.length > 0 ? (
        <SectionEvidenceList
          evidence={evidence}
          highlighted={highlighted}
          images={images}
          sectionTitle={section.title}
          sectionBody={section.body}
        />
      ) : null}

      {/* 근거 링크는 본문 끝에 별도 줄로 둔다 — 문장 안에 섞으면 링크임이 눈에
          걸리지 않는다. 여럿이면 한 줄에 나란히 놓고 좁은 폭에서 접힌다. */}
      {section.links?.length ? (
        <div className="mt-4 flex max-w-xl flex-wrap items-center gap-x-4 gap-y-1">
          {section.links.map((link) => (
            <ExternalLink key={link.url} href={link.url}>
              {link.label}
            </ExternalLink>
          ))}
        </div>
      ) : null}
    </section>
  );
}
