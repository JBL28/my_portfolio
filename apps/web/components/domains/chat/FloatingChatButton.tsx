"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE, ORBIT_DURATION } from "@/lib/motion";
import { readCookie, subscribeCookies, writeCookie } from "@/lib/cookie";
import { CometOutline } from "@/components/domains/chat/CometOutline";
// 타입만 가져온다 — 값 import를 걸면 ChatModal 쪽 코드가 초기 번들로 딸려 와
// next/dynamic으로 떼어낸 의미가 사라진다(01_설계.md 5.2).
import type { ConversationTurn } from "@/components/domains/chat/MessageList";
import type { ChatConversation } from "@/components/domains/chat/conversation";

/**
 * ChatModal은 여기서만, 그것도 `next/dynamic`으로 동적 import한다(01_설계.md 5.2) —
 * 이 파일이 ChatModal을 정적으로 import하면 모달 코드(axios 요청, Motion 애니메이션
 * 등)가 초기 클라이언트 번들에 함께 실린다. `ssr:false`로 서버 렌더 대상에서도 제외한다
 * — 이 컴포넌트가 Client Component라 옵션 사용이 허용된다(Server Component에서는
 * 지원되지 않음).
 */
const ChatModal = dynamic(() => import("@/components/domains/chat/ChatModal"), {
  ssr: false,
});

// 버튼의 aria-controls와 패널의 id를 잇는 고정 식별자. 페이지당 플로팅 버튼은
// 하나뿐이므로 useId로 만들 필요가 없고, 상수여야 SSR/CSR 간에 값이 흔들리지 않는다.
const CHAT_PANEL_ID = "portfolio-ai-chat-panel";

/**
 * 첫 방문 안내를 이미 보여줬는지 표시하는 쿠키. 값 자체는 의미가 없고 존재 여부만 본다.
 * 이름에 목적을 적어 둬야 개발자 도구에서 본 사람이 무슨 쿠키인지 알 수 있다.
 */
const CHAT_HINT_COOKIE = "portfolio-chat-hint-seen";

/**
 * 안내를 다시 띄우지 않을 기간(초). 3일이 지나면 쿠키가 만료돼 처음 온 것처럼 다시
 * 뜬다 — 며칠 만에 다시 들른 사람은 채팅이 있다는 사실을 잊었을 가능성이 크고, 안내는
 * 한 줄짜리라 다시 봐도 방해가 크지 않다. 영구히 눌러 두면 그 사람은 이 사이트에
 * 챗봇이 있다는 것을 영영 모르고 지나갈 수 있다.
 */
const CHAT_HINT_MAX_AGE = 60 * 60 * 24 * 3;

/**
 * 전역 고정 플로팅 버튼(00_기획.md "AI가 그려져있는 플로팅 버튼"). 클릭 시
 * ChatModal을 토글한다.
 *
 * ChatModal은 화면을 덮지 않는 비모달 팝오버라 열려 있는 동안에도 버튼이 그대로
 * 보인다. 그래서 열기 전용이 아니라 **토글**로 둔다 — 열려 있는데 다시 눌렀을 때
 * 아무 일도 일어나지 않으면 버튼이 고장난 것처럼 보인다.
 *
 * 이 컴포넌트는 PageLayout(RootLayout 하위)에 있으므로 클라이언트 사이드
 * 내비게이션에서 unmount되지 않는다. 그래서 `isOpen`뿐 아니라 **대화 상태도 여기서
 * 든다** — 모달은 닫힐 때 사라지지만 이 컴포넌트는 남으므로, 대화가 닫기와 페이지
 * 이동을 견디고 새로고침에서만 초기화된다.
 */
export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  // ChatModal과 같은 이유로 컨텍스트가 아니라 이 자리에서 직접 읽는다.
  const prefersReducedMotion = useReducedMotion();

  /**
   * 첫 방문 안내를 이미 본 적 있는가. 쿠키를 React 상태로 복사하지 않고 외부 스토어로
   * 그대로 구독한다 — 쿠키가 곧 원본이므로 복사본을 두면 둘을 맞춰야 할 지점이 생긴다.
   *
   * 세 번째 인자(getServerSnapshot)가 `true`인 것이 핵심이다. 이 페이지는 SSG라 서버가
   * 만든 HTML에는 쿠키가 반영될 수 없으므로, 서버와 hydration 시점에는 **항상 "봤음"**
   * 으로 두어 안내가 없는 상태로 마크업을 맞추고, hydration이 끝난 뒤 실제 쿠키 값으로
   * 다시 그린다. 반대로 두면 재방문자에게 안내가 한 프레임 번쩍인다.
   */
  const hasSeenHint = useSyncExternalStore(
    subscribeCookies,
    () => readCookie(CHAT_HINT_COOKIE) !== null,
    () => true,
  );

  /**
   * 안내를 닫고 "봤다"를 쿠키에 남긴다. 쓰기가 곧 구독자에게 전파되므로 따로 상태를
   * 내릴 필요가 없다. X를 눌렀을 때뿐 아니라 버튼을 눌러 채팅을 열 때도 부른다 —
   * 채팅을 연 사람에게 "물어보세요"를 다시 띄울 이유가 없다.
   */
  const dismissHint = () => {
    writeCookie(CHAT_HINT_COOKIE, "1", CHAT_HINT_MAX_AGE);
  };

  /**
   * 대화 상태를 ChatModal이 아니라 여기서 든다.
   *
   * 모달은 닫힐 때 unmount되므로 상태를 거기 두면 닫는 순간 대화가 사라진다. 모바일
   * 에서는 패널이 화면을 거의 덮어서 citation을 읽으려면 일단 닫아야 하는데, 그때마다
   * 이력이 날아가면 읽고 돌아오는 흐름 자체가 성립하지 않는다.
   *
   * 이 컴포넌트는 PageLayout(RootLayout 하위)에 있어 클라이언트 사이드 내비게이션에서
   * unmount되지 않으므로, 여기 둔 값은 **닫기와 페이지 이동을 견디고 새로고침에서만**
   * 사라진다 — 정확히 우리가 원하는 수명이다. 그래서 localStorage 같은 저장소를 쓰지
   * 않는다. 하나라도 쓰면 새로고침에도 살아남아 "저장하지 않는다"는 약속이 깨진다.
   */
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 첫 전송 때 ChatModal이 만들어 넣는다. 생성을 여기서 하지 않는 이유는 두 가지다 —
  // 이 컴포넌트는 SSG로 서버에서도 렌더되고, UUID 생성기를 값으로 import하면 그 코드가
  // 초기 번들에 들어간다.
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);

  const conversation: ChatConversation = {
    turns,
    setTurns,
    isLoading,
    setIsLoading,
    error,
    setError,
    chatSessionId,
    setChatSessionId,
  };

  return (
    <>
      {/* AnimatePresence로 감싸지 않는다 — 닫으면 애니메이션 없이 그 자리에서
          사라져야 한다. 퇴장 연출을 두면 X를 눌러도 잠깐 남아 버튼이 안 먹은 것처럼
          보인다. */}
      {!hasSeenHint && !isOpen ? (
        <ChatHint
          reducedMotion={Boolean(prefersReducedMotion)}
          onDismiss={dismissHint}
        />
      ) : null}

      <button
        type="button"
        onClick={() => {
          dismissHint();
          setIsOpen((prev) => !prev);
        }}
        aria-label={
          isOpen ? "AI 채팅 닫기" : "AI에게 포트폴리오에 대해 질문하기"
        }
        aria-expanded={isOpen}
        aria-controls={CHAT_PANEL_ID}
        // 패널(z-50)과 같은 층에 둔다 — 비모달이라 패널이 열려 있는 동안에도 버튼이
        // 계속 눌려야 하고, 뒤로 밀려 가려지면 토글이 막힌다.
        className="fixed bottom-6 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-zinc-50 shadow-md transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        <CometRing spinning={!prefersReducedMotion} />

        {/* 열림/닫힘이 아이콘에도 드러나야 토글이라는 것이 읽힌다. 회전은 12도로
            억제한다 — 버튼은 본문 위에 항상 떠 있으므로 큰 움직임은 시선을 계속
            끌어 읽기를 방해한다. 링이 absolute라 아이콘이 그 아래로 깔리므로
            relative로 쌓임 순서를 되돌린다(z-index를 새로 만들지 않는다). */}
        <motion.span
          className="relative inline-flex"
          animate={{ rotate: prefersReducedMotion || !isOpen ? 0 : 12 }}
          transition={{ duration: DURATION.fast, ease: EASE }}
        >
          <AiIcon />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <ChatModal
            panelId={CHAT_PANEL_ID}
            onClose={() => setIsOpen(false)}
            conversation={conversation}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

/**
 * 처음 온 방문자에게만 한 번 뜨는 안내 말풍선.
 *
 * 버튼 **위**에 붙고 오른쪽 모서리를 버튼의 오른쪽 끝에 맞춘다 — 버튼과 같은
 * `right-6`을 쓰면 두 요소의 오른쪽 변이 그대로 정렬된다. 아래쪽 `bottom-[5.25rem]`은
 * 버튼 위치(1.5rem) + 버튼 높이(3rem) + 여백(0.75rem)이다.
 *
 * `aria-live`를 쓰지 않는다 — 화면을 읽는 사용자에게는 버튼의 aria-label("AI에게
 * 포트폴리오에 대해 질문하기")이 이미 같은 내용을 더 정확하게 알려주므로, 여기서 또
 * 읽어주면 같은 말을 두 번 하는 셈이 된다.
 */
function ChatHint({
  reducedMotion,
  onDismiss,
}: {
  reducedMotion: boolean;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      // 좁은 화면에서 글이 화면 밖으로 나가지 않도록 최대 폭을 뷰포트에 묶어 둔다.
      className="fixed bottom-[5.25rem] right-6 z-50 flex max-w-[calc(100vw-3rem)] items-center gap-2 rounded-lg bg-zinc-900 py-2 pl-3 pr-2 text-sm text-zinc-50 shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: DURATION.base,
        ease: EASE,
        // 페이지가 자리를 잡고 방문자가 화면을 한 번 훑은 뒤에 나타나야 안내로
        // 읽힌다. 첫 페인트와 같이 뜨면 레이아웃의 일부처럼 보여 오히려 눈에 걸리지
        // 않는다. 이 지연은 움직임이 아니라 "언제 말을 거는가"의 문제이므로
        // reduced-motion에서도 그대로 둔다 — 그쪽에서 뺄 것은 y 이동뿐이다.
        delay: HINT_DELAY,
      }}
    >
      <span className="whitespace-nowrap">AI에게 궁금한 것을 물어보세요.</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="안내 닫기"
        className="-mr-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50 dark:text-zinc-500 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
      {/* 버튼과 같은 색·같은 주기로 도는 혜성. 다만 원이 아니라 둥근 사각형이라
          구현이 달라 별도 컴포넌트다(회전이 아니라 경로 추적). 아래 꼬리(삼각형)에는
          걸리지 않는다 — 본체 밖으로 나간 꼭지까지 경로를 이으려면 말풍선 전체를
          SVG로 그려야 한다. */}
      <CometOutline spinning={!reducedMotion} />

      {/* 말풍선 꼬리. 사각형을 45도 돌려 아래 변 밖으로 절반만 내민다. 오른쪽에서
          20px 지점이라 꼭짓점이 버튼의 중심(오른쪽에서 24px)을 가리킨다 — 가리키는
          방향이 있어야 이 문구가 저 버튼에 대한 안내로 읽힌다. */}
      <span
        aria-hidden="true"
        className="absolute bottom-[-3px] right-5 h-2 w-2 rotate-45 bg-zinc-900 dark:bg-zinc-100"
      />
    </motion.div>
  );
}

/** 페이지가 뜬 뒤 안내가 나타나기까지의 지연(초). 등장 자체는 DURATION.base를 쓴다. */
const HINT_DELAY = 2;

/**
 * 혜성 머리의 색. 보라→파랑→청록으로 건너뛰는 다색 그라데이션은 "여기부터 AI"를
 * 가리키는 관용구다. 다만 이 사이트는 전면 무채색(zinc)이므로 **링에만** 쓰고 버튼
 * 본체는 무채색으로 둔다 — 버튼 전체를 물들이면 톤이 이 하나 때문에 깨진다.
 */
const COMET_HEAD = "rgba(167,139,250,1)";
const COMET_MID = "rgba(59,130,246,0.5)";
/** 꼬리 끝. 알파 0이라 색은 보이지 않지만, 중간 stop의 보간 색을 청록 쪽으로 끌어준다. */
const COMET_TAIL = "rgba(34,211,238,0)";

/**
 * 혜성 두 개를 한 장의 conic-gradient로 그린다.
 *
 * 각도를 따라 알파가 0→1로 차오르다 머리에서 뚝 끊기는 구간이 곧 "머리 뒤로 끌리는
 * 꼬리"다(회전이 시계방향이므로 각도가 큰 쪽이 진행 방향 = 머리). 꼬리는 90°만
 * 쓰고 나머지는 transparent로 비워, 링 전체가 빛나는 대신 **빈 테두리 위를 도는 빛
 * 두 덩어리**가 되게 한다. 머리를 180°와 360°에 두면 두 혜성이 정확히 반대편에서
 * 돈다. 한 장에 같이 그리므로 둘의 위상이 어긋날 여지가 없다.
 */
const COMET_RING = `conic-gradient(from 0deg,
  transparent 0deg,
  transparent 90deg,
  ${COMET_TAIL} 90deg,
  ${COMET_MID} 145deg,
  ${COMET_HEAD} 180deg,
  transparent 180deg,
  transparent 270deg,
  ${COMET_TAIL} 270deg,
  ${COMET_MID} 325deg,
  ${COMET_HEAD} 360deg)`;

/** 가운데를 뚫어 바깥 2px만 남긴다 — 원판이 아니라 테두리로 보이게 하는 부분. */
const RING_MASK =
  "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))";

/**
 * 버튼 테두리를 도는 혜성 링.
 *
 * 회전은 CSS 애니메이션이 아니라 Motion이 맡는다(이 저장소의 애니메이션은 모두
 * Motion을 통한다) — CSS는 "무엇이 그려지는가"만 담당하고, 그라데이션과 점을 한
 * 요소에 담아 통째로 돌리므로 점이 꼬리에서 떨어져 나갈 수 없다.
 *
 * `spinning`이 false면(prefers-reduced-motion) 회전 없이 정지한 그라데이션 링만
 * 남는다 — 장식을 통째로 걷어내는 대신 움직임만 뺀다.
 */
function CometRing({ spinning }: { spinning: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={
        spinning
          ? { duration: ORBIT_DURATION, ease: "linear", repeat: Infinity }
          : { duration: 0 }
      }
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: COMET_RING,
          WebkitMaskImage: RING_MASK,
          maskImage: RING_MASK,
        }}
      />
      {/* 그라데이션의 머리 끝(180°·360°)에 얹는 점. 그라데이션만으로도 밝은 끝은
          생기지만, 점이 있어야 "선이 흐르는" 것이 아니라 "점이 지나간 자리에 꼬리가
          남는" 것으로 읽힌다. */}
      <CometHead className="left-1/2 top-0" />
      <CometHead className="left-1/2 top-full" />
    </motion.span>
  );
}

function CometHead({ className }: { className: string }) {
  return (
    <span
      className={`absolute h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-200 shadow-[0_0_6px_1px_rgba(167,139,250,0.8)] ${className}`}
    />
  );
}

function AiIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <rect x="6" y="8" width="12" height="10" rx="2" />
      <path d="M9 8V5a3 3 0 0 1 6 0v3" />
      <path d="M4 13H2M22 13h-2" />
      <circle cx="9.5" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
