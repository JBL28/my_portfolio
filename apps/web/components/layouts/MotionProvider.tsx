"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Motion 전역 설정. `reducedMotion="user"` 하나를 위해 존재한다.
 *
 * globals.css의 `@media (prefers-reduced-motion: reduce)` 블록은 CSS `animation-*`·
 * `transition-*`만 무력화한다. Motion은 JS로 인라인 스타일을 프레임마다 갱신하므로
 * 그 CSS가 닿지 않는다 — 실제로 모션 감소를 켠 채로 측정해도 모달이 그대로
 * 애니메이션됐다. 컴포넌트마다 `useReducedMotion()`을 흩뿌리면 새 애니메이션을
 * 추가할 때 빠뜨리기 쉬우므로, 트리 최상단에서 한 번 선언해 이후 추가되는 모든
 * Motion 컴포넌트가 자동으로 규칙을 따르게 한다.
 *
 * `"user"`는 이동(transform)·레이아웃 애니메이션만 끄고 opacity 전환은 남긴다 —
 * 화면이 갑자기 튀지 않으면서도 "무언가 나타났다"는 신호는 유지되므로, 가독성을
 * 해치지 않는다는 이 프로젝트의 원칙과도 맞는다.
 *
 * children은 Server Component 트리를 그대로 통과시킨다(props로 받은 노드는
 * 클라이언트 경계를 넘어도 서버 렌더링 결과를 유지한다).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
