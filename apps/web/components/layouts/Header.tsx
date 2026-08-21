import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { GitHubLink } from "@/components/ui/GitHubLink";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Header() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100"
        >
          이정복 포트폴리오
        </Link>
        <div className="flex items-center gap-2">
          <GitHubLink />
          <ThemeToggle />
        </div>
      </Container>
    </header>
  );
}
