"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useTime, useTransform, type MotionValue } from "motion/react";
import { ORBIT_DURATION } from "@/lib/motion";

/**
 * 둥근 사각형 테두리를 따라 도는 혜성. 말풍선(ChatHint) 전용이다.
 *
 * 플로팅 버튼의 CometRing과 **의도적으로 별개**다. 원은 요소를 통째로 돌리는 것만으로
 * 테두리 추적이 되지만, 사각형은 돌리면 궤도가 테두리를 벗어난다. 그래서 여기서는
 * 회전 대신 **경로 추적**을 쓴다 — 실제 테두리 모양 그대로의 path를 만들고 점들이 그
 * 위를 `offset-distance`로 이동하므로 모서리에서도 선을 벗어나지 않는다.
 *
 * 속도는 버튼과 같다. 여기서 "같다"는 **초당 이동 거리(px/s)**를 말한다 — 한 바퀴
 * 시간을 버튼과 똑같이 두면 둘레가 긴 말풍선에서는 점이 그만큼 빨리 달려 둘이 따로
 * 논다. 그래서 측정한 둘레를 버튼과 같은 속도로 나눠 주기를 구한다. 꼬리 길이도 같은
 * 이유로 둘레 비율이 아니라 픽셀로 고정한다.
 */
export function CometOutline({ spinning }: { spinning: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  // 경로는 실제 렌더된 크기에서 나온다 — 말풍선 폭이 글꼴 로딩·화면 폭에 따라
  // 달라지므로 상수로 박을 수 없다.
  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  /**
   * 진행도 0~1. Motion의 시간축에서 파생시키므로 effect도 상태도 필요 없고, 매 프레임
   * React가 다시 렌더되지도 않는다(MotionValue가 DOM 스타일을 직접 갱신한다).
   */
  const perimeter =
    size === null ? 0 : roundedRectPerimeter(size.width, size.height, CORNER);
  // 버튼과 같은 px/s로 이 둘레를 한 바퀴 도는 데 걸리는 시간(초).
  const duration = perimeter === 0 ? ORBIT_DURATION : perimeter / COMET_SPEED;

  const time = useTime();
  const progress = useTransform(
    time,
    (elapsed) => (spinning ? (elapsed / 1000 / duration) % 1 : 0),
  );

  // 점 사이 간격도 둘레 비율이 아니라 픽셀에서 환산한다 — 비율로 두면 말풍선이
  // 길어질수록 꼬리만 같이 늘어나 버튼의 혜성과 다른 물건이 된다.
  const gap =
    perimeter === 0 ? 0 : TAIL_LENGTH / perimeter / (TRAIL_LENGTH - 1);

  const path =
    size === null ? null : roundedRectPath(size.width, size.height, CORNER);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      {path === null
        ? null
        : COMET_PHASES.map((phase) =>
            Array.from({ length: TRAIL_LENGTH }, (_, index) => (
              <CometDot
                key={`${phase}-${index}`}
                path={path}
                progress={progress}
                phase={phase}
                index={index}
                gap={gap}
              />
            )),
          )}
    </span>
  );
}

/**
 * 꼬리를 이루는 점 하나. `index`가 0이면 머리이고, 커질수록 뒤처져 작고 흐려진다.
 * 위치를 각자 계산하지 않고 부모의 진행도 하나에서 파생시키므로 머리와 꼬리가
 * 어긋날 수 없다.
 *
 * 점마다 컴포넌트를 나눈 것은 훅 규칙 때문이다 — 반복문 안에서는 useTransform을
 * 부를 수 없다.
 */
function CometDot({
  path,
  progress,
  phase,
  index,
  gap,
}: {
  path: string;
  progress: MotionValue<number>;
  phase: number;
  index: number;
  /** 앞 점과의 간격(둘레 대비). 픽셀 길이에서 환산되어 내려온다. */
  gap: number;
}) {
  // 0(머리) ~ 1(꼬리 끝).
  const decay = index / (TRAIL_LENGTH - 1);
  const size = 3.5 - 2.5 * decay;
  // 제곱으로 떨어뜨려 끝에서 완전히 사라지게 한다 — 선형이면 꼬리 끝이 뚝 끊긴다.
  const opacity = (1 - decay) ** 2;

  const offsetDistance = useTransform(progress, (value) => {
    // 진행 방향의 뒤쪽이므로 뺀다. 음수는 한 바퀴를 더해 0~1로 되돌린다.
    const position = (((value - phase - index * gap) % 1) + 1) % 1;
    return `${position * 100}%`;
  });

  return (
    <motion.span
      className="absolute rounded-full"
      style={{
        offsetPath: `path("${path}")`,
        offsetDistance,
        width: size,
        height: size,
        background: cometColor(decay, opacity),
        // 머리에만 번짐을 준다 — 꼬리 전부에 주면 뿌옇게 뭉쳐 점의 이동이 안 읽힌다.
        boxShadow: index === 0 ? `0 0 6px 1px ${cometColor(0, 0.8)}` : undefined,
      }}
    />
  );
}

/** 말풍선의 모서리 반경(px). Tailwind `rounded-lg`와 같은 값이어야 선이 뜨지 않는다. */
const CORNER = 8;

/**
 * 꼬리를 이루는 점의 개수. 이 점들이 촘촘히 이어져 하나의 꼬리로 보인다 — 줄이면
 * 점선처럼 끊겨 보이고, 늘리면 그만큼 DOM 노드가 늘어난다.
 */
const TRAIL_LENGTH = 16;

/**
 * 꼬리 전체 길이(px). 버튼의 혜성 꼬리(지름 48px 원의 90° ≒ 38px)와 맞춰, 말풍선이
 * 아무리 길어져도 꼬리는 같은 크기로 보이게 한다.
 */
const TAIL_LENGTH = 38;

/**
 * 점의 이동 속도(px/s). 버튼의 링(지름 48px)이 ORBIT_DURATION에 한 바퀴 도는 속도를
 * 그대로 옮긴 값이다 — 버튼 크기가 바뀌면 이 상수도 같이 봐야 한다.
 */
const BUTTON_DIAMETER = 48;
const COMET_SPEED = (Math.PI * BUTTON_DIAMETER) / ORBIT_DURATION;

/** 혜성 두 개를 정확히 반대편에 둔다. */
const COMET_PHASES = [0, 0.5];

/**
 * 머리(0)에서 꼬리 끝(1)까지의 색. 보라→파랑→청록은 버튼의 혜성과 같은 색이다 —
 * 둘이 같은 표시를 달고 있어야 말풍선이 저 버튼에 딸린 안내로 읽힌다.
 */
const COMET_STOPS = [
  [167, 139, 250], // violet-400 — 머리
  [59, 130, 246], // blue-500
  [34, 211, 238], // cyan-400 — 꼬리 끝
] as const;

function cometColor(t: number, alpha: number): string {
  const scaled = t * (COMET_STOPS.length - 1);
  const index = Math.min(Math.floor(scaled), COMET_STOPS.length - 2);
  const ratio = scaled - index;
  const from = COMET_STOPS[index];
  const to = COMET_STOPS[index + 1];
  const channel = (i: number) => Math.round(from[i] + (to[i] - from[i]) * ratio);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${alpha})`;
}

/** 둥근 사각형의 둘레: 직선 네 변 + 모서리 네 개가 이루는 원 하나. */
function roundedRectPerimeter(
  width: number,
  height: number,
  radius: number,
): number {
  const r = Math.min(radius, width / 2, height / 2);
  return 2 * (width - 2 * r) + 2 * (height - 2 * r) + 2 * Math.PI * r;
}

/** 둥근 사각형 테두리를 그대로 따라가는 path(시계 방향, 좌상단 모서리에서 시작). */
function roundedRectPath(
  width: number,
  height: number,
  radius: number,
): string {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M ${r} 0`,
    `H ${width - r}`,
    `A ${r} ${r} 0 0 1 ${width} ${r}`,
    `V ${height - r}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${height - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}
