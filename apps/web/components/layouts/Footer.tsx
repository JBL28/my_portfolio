import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <Container className="flex items-baseline justify-between py-10 text-xs text-zinc-500 dark:text-zinc-400">
        <p>© 2026 이정복</p>
        <p className="font-mono">Backend Developer</p>
      </Container>
    </footer>
  );
}
