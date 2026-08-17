import { cn } from "@/lib/cn";

const MAX_WIDTH = {
  narrow: "max-w-3xl",
  wide: "max-w-5xl",
} as const;

export function Container({
  children,
  className,
  size = "narrow",
}: {
  children: React.ReactNode;
  className?: string;
  size?: keyof typeof MAX_WIDTH;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", MAX_WIDTH[size], className)}>
      {children}
    </div>
  );
}
