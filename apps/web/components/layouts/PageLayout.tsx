import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingChatButton } from "@/components/domains/chat/FloatingChatButton";
import { MotionProvider } from "./MotionProvider";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    // MotionProvider는 reducedMotion 설정만 담당한다 — children(Server Component
    // 트리)은 그대로 통과하므로 페이지가 클라이언트 렌더링으로 바뀌지 않는다.
    <MotionProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <FloatingChatButton />
      </div>
    </MotionProvider>
  );
}
