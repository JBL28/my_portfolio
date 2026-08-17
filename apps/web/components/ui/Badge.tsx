import { cn } from "@/lib/cn";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-zinc-300 px-2 py-0.5 font-mono text-xs text-zinc-700",
        "dark:border-zinc-700 dark:text-zinc-300",
        className,
      )}
    >
      {children}
    </span>
  );
}
