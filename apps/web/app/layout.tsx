import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { PageLayout } from "@/components/layouts/PageLayout";
// Pretendard Variable — npm 패키지에서 self-host로 로드한다(외부 CDN 요청 없음).
// dynamic-subset: 한국어 글리프를 사용 범위 단위로 쪼개 필요한 것만 내려받는다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "이정복 · Backend Developer",
  description:
    "팀이 함께 쓸 기준을 만드는 백엔드 개발자 이정복의 포트폴리오 — TeenyFinny, Home Server, DailyBand.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PageLayout>{children}</PageLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
