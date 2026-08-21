import Link from "next/link";
import type { Citation } from "@/lib/api/chat";

/**
 * citation을 클릭 가능한 링크로 렌더링(01_설계.md 5.3, 3.2).
 * 백엔드가 채워 보내는 `citation.path`를 그대로 신뢰해 `citation.path + '#' + citation.anchor`로
 * 조합한다(5.3 원문 그대로) — Home Profile Section이면 path가 `/`라 `/#profile`이 되고,
 * 프로젝트 Section이면 path가 `/projects/{slug}`라 `/projects/{slug}#{anchor}`가 된다.
 * 같은 탭 내 라우팅이므로 Next.js `Link`를 사용한다.
 */
export function CitationLink({ citation }: Readonly<{ citation: Citation }>) {
  const href = `${citation.path}#${citation.anchor}`;

  return (
    <Link
      href={href}
      className="inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {citation.quotedTitle}
    </Link>
  );
}
