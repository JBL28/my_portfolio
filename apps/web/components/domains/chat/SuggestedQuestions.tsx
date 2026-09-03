"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";
import { CometOutline } from "@/components/domains/chat/CometOutline";

/**
 * 대화가 비어 있을 때 입력창 위에 제시하는 예상 질문.
 *
 * data/가 아니라 이 파일에 둔다 — data/는 Neo4j 적재와 SSG가 함께 쓰는 콘텐츠
 * 원본이고, 이 목록은 위젯이 스스로 거는 말이라 성격이 다르다. ChatModal은
 * `ssr: false`로 분리된 클라이언트 청크라 서버 전용인 lib/portfolio-data.ts를
 * 쓸 수도 없다.
 */
const QUESTIONS = [
  "이 지원자는 AI를 어떻게 사용하나요?",
  "이 지원자는 어떻게 협업하나요?",
  "프로젝트 경험에 대해 설명해주세요.",
  "이 지원자의 경험을 설명해주세요.",
] as const;

/** 질문 하나가 머무는 시간(ms). */
const ROTATION_INTERVAL = 3000;

/** 슬라이드 이동량(px). lib/motion.ts가 정한 6~12px 상한을 지킨다. */
const SLIDE = 12;

/**
 * 3초마다 오른쪽에서 왼쪽으로 넘어가는 예상 질문. 누르면 그 질문이 그대로 전송된다.
 *
 * 자동으로 도는 대상을 눌러야 하므로 **포인터가 올라가 있거나 포커스가 잡혀 있는
 * 동안에는 멈춘다** — 누르려는 순간 질문이 바뀌면 의도하지 않은 질문이 전송된다.
 *
 * 표시 조건은 ChatModal이 정한다(대화가 비어 있을 때만). 첫 질문이 들어가면 그쪽에서
 * 통째로 unmount되므로 이 컴포넌트는 자신이 언제 사라지는지 알 필요가 없다.
 */
export function SuggestedQuestions({
  onSelect,
}: Readonly<{
  onSelect: (question: string) => void;
}>) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (isPaused) {
      return;
    }
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % QUESTIONS.length);
    }, ROTATION_INTERVAL);
    return () => {
      clearInterval(timer);
    };
  }, [isPaused]);

  const question = QUESTIONS[index];

  return (
    <div className="px-3 py-2">
      {/* 버튼(테두리·혜성)은 계속 떠 있고 **글자만** 바뀐다. 버튼째 교체하면 3초마다
          혜성이 처음부터 다시 돌고 테두리가 깜빡여, 누를 대상이 사라졌다 나타나는
          것처럼 보인다.

          회전을 멈추는 핸들러도 바깥 div가 아니라 버튼에 직접 단다 — 상호작용은
          네이티브 상호작용 요소가 받아야 키보드·터치 경로가 함께 따라온다. 멈추는
          범위가 버튼 안으로 좁아지는데, 어차피 누를 대상이 버튼이라 그게 맞다. */}
      <button
        type="button"
        onClick={() => onSelect(question)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
        className="relative flex h-9 w-full items-center rounded-lg border border-zinc-200 px-3 text-left text-sm text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
      >
        {/* 말풍선 테두리를 돌던 것과 같은 혜성 — 둘 다 둥근 사각형이라 그대로 쓴다. */}
        <CometOutline spinning={!prefersReducedMotion} />

        {/* 넘어가는 질문이 테두리 밖으로 삐져나가지 않게 가둔다. 높이를 한 줄로
            고정하는 것도 같은 이유다 — 질문마다 길이가 달라 줄바꿈이 생기면 입력창이
            위아래로 흔들린다. */}
        <span className="block w-full overflow-hidden">
          {/* 한 번에 하나만 두고 교차시킨다. mode="wait"라 나가는 질문이 완전히 빠진
              뒤 다음 질문이 들어와, 두 문장이 겹쳐 읽히는 순간이 없다. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={question}
              initial={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: SLIDE }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -SLIDE }
              }
              transition={{ duration: DURATION.fast, ease: EASE }}
              className="block truncate"
            >
              {question}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
    </div>
  );
}
