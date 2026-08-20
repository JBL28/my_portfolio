"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { DURATION, EASE } from "@/lib/motion";

/**
 * 본문 콘텐츠의 스크롤 등장 효과(01_설계.md 5.3의 Motion 적용, 5.5의 절제된 톤).
 * 요소가 뷰포트에 들어올 때 한 번만 제자리로 들어온다.
 *
 * `from`으로 들어오는 방향을 고른다:
 *
 * - `"bottom"`(기본) — 아래에서 살짝 떠오른다. 이동량 10px. 좌측 "명세" 레일처럼
 *   화면 상단에 바로 놓이는 짧은 블록에 쓴다.
 * - `"right"` — 화면 오른쪽 가장자리 방향에서 제자리로 들어온다. 우측 "서술"
 *   컬럼(프로젝트 카드·본문 섹션)에 써서, 좌측 명세는 고정돼 있고 우측 서술이
 *   흘러 들어온다는 레이아웃의 논지를 움직임으로도 드러낸다.
 *
 * **가독성을 해치지 않기 위한 제약**:
 *
 * - `once: true` — 한 번 나타난 콘텐츠는 다시 스크롤해도 재생되지 않는다. 위아래로
 *   오가며 읽을 때 글이 매번 사라졌다 나타나면 읽기가 불가능해진다.
 * - `margin: "0px 0px -80px 0px"` — 요소가 화면 하단에 닿기 전에 미리 시작한다.
 *   눈이 도착했을 때 이미 떠 있어야지, 그때부터 나타나면 읽기가 지연된다.
 * - 이동량은 방향별로 묶어둔다(아래 `OFFSET`). 가로 이동은 세로보다 크게 잡아
 *   "가장자리에서 들어온다"가 읽히게 하되, 글줄이 흔들려 보이지 않는 선에서 멈춘다.
 *
 * **가로 이동은 반드시 잘라내는 조상이 있어야 한다.** 오른쪽 바깥에서 시작하므로
 * 그대로 두면 문서 폭이 늘어 가로 스크롤바가 생긴다. 호출부(우측 컬럼)에
 * `overflow-x: clip`을 두는 이유다 — `hidden`이 아니라 `clip`인 것은, `hidden`은
 * 스크롤 컨테이너를 만들어 좌측 레일의 `position: sticky`를 깨뜨리기 때문이다.
 *
 * 모션 감소 설정은 PageLayout의 MotionConfig(`reducedMotion="user"`)가 처리한다 —
 * transform은 꺼지고 opacity 전환만 남으므로 화면이 튀지 않는다.
 *
 * children은 props로 통과하므로 ProjectCard·ProjectDetailSection 등은 Server
 * Component로 남는다(5.2).
 */
// 방향별 이동량과 지속시간. 가로는 "화면 가장자리에서 제자리로 들어온다"가 읽혀야
// 하므로 세로보다 훨씬 크게 잡고, 그만큼 시간도 늘린다(같은 시간에 먼 거리를 가면
// 튕기듯 빨라져 눈이 따라가지 못한다). 이징도 가로는 감속을 완만하게 써서 이동
// 자체가 보이게 한다 — EASE(expo-out)는 초반에 거의 다 끝나버려 "이동"이 아니라
// "깜빡임"으로 읽혔다(실측 중간 프레임에서 90ms 시점에 이미 2.8px까지 도달).
const MOTION = {
  bottom: { offset: { y: 10 }, duration: DURATION.reveal, ease: EASE },
  right: { offset: { x: 140 }, duration: 0.45, ease: [0.33, 1, 0.68, 1] },
} as const;

export function Reveal({
  children,
  delay = 0,
  from = "bottom",
  className,
}: Readonly<{
  children: ReactNode;
  /** 목록을 순차로 띄울 때 쓰는 지연(초). */
  delay?: number;
  /** 들어오는 방향. 기본은 아래에서 떠오르기. */
  from?: keyof typeof MOTION;
  className?: string;
}>) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...MOTION[from].offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{
        duration: MOTION[from].duration,
        ease: MOTION[from].ease,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
