import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingChatButton } from "@/components/domains/chat/FloatingChatButton";
import { MotionProvider } from "./MotionProvider";
import { AnchorHighlight } from "@/components/ui/AnchorHighlight";

export function PageLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // MotionProvider는 reducedMotion 설정만 담당한다 — children(Server Component
    // 트리)은 그대로 통과하므로 페이지가 클라이언트 렌더링으로 바뀌지 않는다.
    <MotionProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <FloatingChatButton />
        {/* 렌더링 결과가 없는 동작 전용 컴포넌트 — 앵커 착지 하이라이트. */}
        <AnchorHighlight />
      </div>
    </MotionProvider>
  );
}
