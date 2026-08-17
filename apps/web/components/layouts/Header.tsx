import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Header() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <Container size="wide" className="flex h-14 items-center justify-between">
        <Link
          href="/"
          className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Portfolio
        </Link>
        <ThemeToggle />
      </Container>
    </header>
  );
}
