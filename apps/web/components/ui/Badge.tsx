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
        "inline-flex items-center bg-zinc-100 px-2 py-1 font-mono text-[11px] leading-none text-zinc-600",
        "dark:bg-zinc-900 dark:text-zinc-400",
        className,
      )}
    >
      {children}
    </span>
  );
}
