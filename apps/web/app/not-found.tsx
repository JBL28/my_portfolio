import Link from "next/link";
import { Container } from "@/components/ui/Container";

/**
 * 404 페이지. Next.js 기본 not-found 화면은 컴포넌트에 인라인 `style`로 시스템
 * 폰트 스택을 직접 박아 넣기 때문에 layout의 `font-sans`(Pretendard)를 우회한다 —
 * 실제로 이 사이트에서 유일하게 Pretendard가 아닌 서체(Malgun Gothic)로 렌더링되던
 * 화면이었다. 기본 화면을 그대로 두면 서체 통일이 깨지므로 직접 정의한다.
 *
 * PageLayout(Header/Footer/플로팅 버튼) 안에서 렌더링되므로 여기서는 본문만 담는다.
 * 페이지 폭·여백은 Home과 같은 Container 규칙을 따른다.
 */
export default function NotFound() {
  return (
    <Container className="py-14 sm:py-20" size="narrow">
      <p className="font-mono text-xs tracking-[0.22em] text-zinc-500 uppercase dark:text-zinc-400">
        404
      </p>

      <h1 className="mt-6 text-[1.75rem] leading-snug font-bold tracking-[-0.015em] text-zinc-900 sm:text-[2rem] dark:text-zinc-100">
        요청하신 페이지를 찾을 수 없습니다
      </h1>

      <p className="mt-4 text-[0.9375rem] leading-relaxed text-zinc-600 dark:text-zinc-400">
        주소가 바뀌었거나 삭제된 페이지일 수 있습니다. 홈에서 프로젝트 목록을
        확인해 주세요.
      </p>

      <Link
        href="/"
        className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-950 hover:decoration-zinc-900 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-50 dark:hover:decoration-zinc-100"
      >
        홈으로 돌아가기
      </Link>
    </Container>
  );
}
