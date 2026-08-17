import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <Container
        size="wide"
        className="py-6 text-xs text-zinc-500 dark:text-zinc-500"
      >
        <p>Graph RAG Portfolio</p>
      </Container>
    </footer>
  );
}
