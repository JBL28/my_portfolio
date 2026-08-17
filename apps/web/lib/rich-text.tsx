import { Fragment, type ReactNode } from "react";

/**
 * data/의 body/roles 필드는 "**강조**" 형태의 굵게 표기와 "`코드`" 형태의
 * 인라인 코드 표기, 문단 구분용 빈 줄("\n\n")만 사용한다(실제 JSON 원문
 * 확인 결과 — 예: data/projects/dailyband.json의 "`files`", "`Build → ...`").
 * 별도 마크다운 라이브러리를 도입하는 대신, 이 규칙만 처리하는 최소한의
 * 파서로 원문 텍스트를 그대로 렌더링한다 — 텍스트 내용 자체는 절대 바꾸지
 * 않고 <strong>/<code>/문단 태그만 씌운다.
 */

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** meta description 등 마크업 없이 텍스트만 필요한 곳에서 강조 표기를 제거한다. */
export function stripInlineRichText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

export function parseInlineRichText(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded-sm bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function RichText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const paragraphs = splitParagraphs(text);
  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={index > 0 ? "mt-3" : undefined}>
          {parseInlineRichText(paragraph)}
        </p>
      ))}
    </div>
  );
}
