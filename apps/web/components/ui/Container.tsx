import { cn } from "@/lib/cn";

const MAX_WIDTH = {
  /* 단일 컬럼 텍스트용 */
  narrow: "max-w-3xl",
  /* 2단 셸(좌측 명세 레일 + 우측 서술 컬럼)용 — Header/Footer도 같은 폭을 써서
     페이지 전체의 좌우 기준선이 일치한다. */
  wide: "max-w-6xl",
} as const;

export function Container({
  children,
  className,
  size = "wide",
}: {
  children: React.ReactNode;
  className?: string;
  size?: keyof typeof MAX_WIDTH;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8 lg:px-10",
        MAX_WIDTH[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
