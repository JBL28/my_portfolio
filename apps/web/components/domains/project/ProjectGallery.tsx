"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { ProjectImage } from "@/types/portfolio";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";

/** 이 거리(px)를 넘게 움직였으면 "넘기려던 손짓"으로 보고 클릭으로 치지 않는다.
 *  손가락 탭도 완전히 정지하지는 않으므로 0으로 두면 확대가 열리지 않고, 너무 크게
 *  잡으면 짧은 스와이프가 확대로 오인된다. 8px는 브라우저가 탭/드래그를 가르는
 *  기준과 비슷한 값이다. */
const CLICK_SLOP = 8;

/**
 * Project Detail 우측 컬럼 상단의 이미지 갤러리. CSS scroll-snap 기반의 가로
 * 페이징이라 모바일에서는 손가락 스와이프가 네이티브로 동작하고(관성·바운스까지
 * 브라우저가 처리한다), 데스크탑에서는 좌우 버튼·가로 휠에 더해 **마우스 드래그**로도
 * 넘길 수 있다. 어느 쪽으로 넘겨도 mono 카운터("01 / 03")가 현재 위치를 따라간다.
 *
 * 드래그는 `pointerType === "touch"`를 제외하고 마우스/펜에만 건다 — 터치까지
 * 가로채면 브라우저가 주는 관성 스크롤과 세로 스크롤 판정을 직접 다시 만들어야 하고,
 * 그 순간 손가락 조작이 지금보다 나빠진다. 이미 잘 되는 것을 대체하지 않는다.
 *
 * 이미지를 누르면 확대(라이트박스)가 열린다. 넘기기와 누르기가 같은 포인터를 쓰므로
 * **눌렀다 뗄 때까지의 이동량**으로 둘을 가른다(CLICK_SLOP). 드래그로 넘긴 뒤 손을
 * 떼면 브라우저가 click을 마저 발생시키는데, 이 판정이 없으면 넘길 때마다 확대가
 * 열려버린다. 터치 스크롤은 click 자체가 잘 발생하지 않지만 브라우저마다 다르므로
 * 포인터 종류를 가리지 않고 같은 기준으로 막는다.
 *
 * 스크롤 위치 상태가 필요한 상호작용 컴포넌트이므로 Client Component로 분리한다
 * (01_설계.md 5.2 원칙 — 상호작용이 있는 요소만 클라이언트로 내려보낸다).
 * 다이어그램·스크린샷이 잘리면 안 되므로 잘라내기(cover) 대신 여백을 두고
 * 전체를 보여준다(contain).
 */
export function ProjectGallery({
  images,
  projectName,
}: {
  images: ProjectImage[];
  projectName: string;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  /** 라이트박스로 보고 있는 이미지의 인덱스. null이면 닫혀 있다. */
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  /**
   * 드래그 상태. `active`는 pointermove 안에서 **즉시** 읽어야 하므로 state가 아닌
   * ref에 둔다 — setState는 다음 렌더까지 반영되지 않아 드래그 시작 프레임을 놓친다.
   * isDragging state는 커서 클래스에만 쓴다.
   */
  const dragRef = useRef({
    pending: false,
    active: false,
    startX: 0,
    startScrollLeft: 0,
  });
  // 넘기기/누르기 판정용 이동량. 포인터 종류와 무관하게 항상 기록한다.
  const pressRef = useRef({ x: 0, y: 0, moved: 0 });

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  /** 드래그 중에는 스냅을 꺼야 손가락(커서)을 따라 자연스럽게 끌린다. 켜둔 채로
   *  scrollLeft를 만지면 mandatory 스냅이 매 프레임 되돌려 끊겨 보인다. */
  function setSnapEnabled(track: HTMLUListElement, enabled: boolean) {
    track.style.scrollSnapType = enabled ? "" : "none";
  }

  function handlePointerDown(event: React.PointerEvent<HTMLUListElement>) {
    // 누르기/넘기기 판정의 기준점. 터치를 포함한 모든 포인터에서 기록한다.
    pressRef.current = { x: event.clientX, y: event.clientY, moved: 0 };

    // 드래그 스크롤은 터치를 제외한다(위 docstring 참고).
    if (event.pointerType === "touch") {
      return;
    }
    const track = trackRef.current;
    if (!track) {
      return;
    }
    // 여기서는 "드래그가 될 수도 있다"까지만 기록한다. 아직 스냅을 끄지도,
    // 포인터를 캡처하지도 않는다 — 아래 handlePointerMove 주석 참고.
    dragRef.current = {
      pending: true,
      active: false,
      startX: event.clientX,
      startScrollLeft: track.scrollLeft,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLUListElement>) {
    const distance = Math.hypot(
      event.clientX - pressRef.current.x,
      event.clientY - pressRef.current.y,
    );
    pressRef.current.moved = Math.max(pressRef.current.moved, distance);

    const track = trackRef.current;
    if (!track) {
      return;
    }

    /**
     * 드래그는 **CLICK_SLOP을 넘게 움직인 뒤에야** 시작한다. pointerdown에서 곧바로
     * `setPointerCapture`를 걸면 캡처가 살아 있는 동안 마우스 이벤트가 캡처 요소(ul)로
     * 리타깃되어, 안쪽 이미지 버튼의 click이 **아예 발생하지 않는다** — 확대가 열리지
     * 않던 원인이다. 캡처를 실제 드래그에만 걸어 단순 클릭 경로를 건드리지 않는다.
     */
    if (dragRef.current.pending && !dragRef.current.active) {
      if (distance <= CLICK_SLOP) {
        return;
      }
      dragRef.current.active = true;
      setIsDragging(true);
      setSnapEnabled(track, false);
      // 커서가 트랙 밖으로 나가도 이동을 계속 받는다.
      track.setPointerCapture(event.pointerId);
    }

    if (!dragRef.current.active) {
      return;
    }
    track.scrollLeft =
      dragRef.current.startScrollLeft -
      (event.clientX - dragRef.current.startX);
  }

  function endDrag(event: React.PointerEvent<HTMLUListElement>) {
    // pointercancel은 브라우저가 제스처를 가져갔다는 뜻(터치 스크롤 시작 등)이라
    // 뒤이어 click이 오더라도 그것은 "누르기"가 아니다.
    if (event.type === "pointercancel") {
      pressRef.current.moved = Number.POSITIVE_INFINITY;
    }

    const wasActive = dragRef.current.active;
    dragRef.current.pending = false;
    dragRef.current.active = false;

    const track = trackRef.current;
    if (!wasActive || !track) {
      return;
    }
    setIsDragging(false);
    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }

    // 놓은 위치에서 가장 가까운 장으로 부드럽게 붙인다. 스냅을 곧바로 켜면
    // mandatory 스냅이 애니메이션 없이 순간이동시키므로, 이동이 끝난 뒤에 켠다.
    const page = Math.round(track.scrollLeft / track.clientWidth);
    track.scrollTo({ left: page * track.clientWidth, behavior: "smooth" });
    const restore = () => setSnapEnabled(track, true);
    if ("onscrollend" in track) {
      track.addEventListener("scrollend", restore, { once: true });
    } else {
      window.setTimeout(restore, 400);
    }
  }

  /** 넘기려던 손짓이 아니었을 때만 확대를 연다. 키보드 Enter/Space로 온 click은
   *  포인터 이동이 없어(직전 값이 0) 그대로 통과한다. */
  function handleImageClick(imageIndex: number) {
    if (pressRef.current.moved > CLICK_SLOP) {
      return;
    }
    setZoomedIndex(imageIndex);
  }

  function scrollToPage(page: number, behavior: ScrollBehavior = "smooth") {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    track.scrollTo({ left: page * track.clientWidth, behavior });
  }

  /** 라이트박스에서 넘긴 위치를 트랙에도 반영한다 — 닫았을 때 방금 보던 이미지가
   *  아닌 다른 장이 떠 있으면 어디로 돌아온 건지 알 수 없다. */
  function closeZoom() {
    if (zoomedIndex !== null) {
      scrollToPage(zoomedIndex, "auto");
    }
    setZoomedIndex(null);
  }

  const counter = `${String(index + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")}`;

  return (
    <section aria-label={`${projectName} 이미지 갤러리`} className="pb-12">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <h2 className="font-mono text-xs tracking-[0.22em] text-zinc-500 uppercase dark:text-zinc-400">
          Gallery
        </h2>
        <div className="flex items-center gap-4">
          {/* 스와이프로 넘겼을 때 카운터만 소리 없이 바뀌면 변화를 놓치기 쉽다.
              숫자를 교체 페이드로 바꿔 "넘어갔다"는 사실을 알린다. 위치 이동 없이
              opacity만 쓰므로 옆 문구를 밀지 않는다(=읽는 흐름을 건드리지 않는다).
              aria-live는 바깥 span에 남겨 DOM 교체와 무관하게 안정적으로 읽히게 한다. */}
          <span
            aria-live="polite"
            className="font-mono text-xs text-zinc-400 tabular-nums dark:text-zinc-500"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={counter}
                className="inline-block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE }}
              >
                {counter}
              </motion.span>
            </AnimatePresence>
          </span>
          {images.length > 1 ? (
            <span className="flex gap-1.5">
              <GalleryButton
                label="이전 이미지"
                disabled={index === 0}
                onClick={() => scrollToPage(index - 1)}
              >
                ←
              </GalleryButton>
              <GalleryButton
                label="다음 이미지"
                disabled={index >= images.length - 1}
                onClick={() => scrollToPage(index + 1)}
              >
                →
              </GalleryButton>
            </span>
          ) : null}
        </div>
      </div>

      <ul
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "mt-5 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // 드래그 가능하다는 것을 커서로 알린다. 드래그 중에는 이미지·캡션이
          // 선택되어 파랗게 드래그되는 것을 막는다.
          images.length > 1 && "cursor-grab",
          isDragging && "cursor-grabbing select-none",
        )}
      >
        {images.map((image, imageIndex) => (
          <li key={image.src} className="w-full shrink-0 snap-center">
            <figure className="pr-px">
              {/* 이미지 자체가 확대 버튼이다. div + onClick으로 두면 키보드로는
                  확대를 열 수 없다. */}
              <button
                type="button"
                onClick={() => handleImageClick(imageIndex)}
                aria-label={`${image.alt} 확대해서 보기`}
                className={cn(
                  "group relative block aspect-[16/10] w-full border border-zinc-200 bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-visible:outline-zinc-100",
                  // 드래그 중에는 확대 커서를 내줘 "지금은 넘기는 중"임을 유지한다.
                  isDragging ? "cursor-grabbing" : "cursor-zoom-in",
                )}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  // 브라우저 기본 이미지 드래그(고스트 이미지)가 뜨면 스와이프가
                  // 중간에 끊긴다.
                  draggable={false}
                  className="object-contain"
                  sizes="(min-width: 1024px) 42rem, 100vw"
                />
                {/* 누르면 커진다는 것을 알리는 최소한의 표식. 평소에는 보이지
                    않다가 hover에서만 떠서 이미지를 가리지 않는다. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-2 bottom-2 border border-zinc-300/80 bg-white/85 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 dark:border-zinc-700/80 dark:bg-zinc-900/85 dark:text-zinc-300"
                >
                  ZOOM
                </span>
              </button>
              {image.caption ? (
                <figcaption className="mt-2.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {image.caption}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>

      {/**
       * 라이트박스는 body 직속으로 내보낸다(portal). 이 갤러리는 Reveal(motion) 안에
       * 있고 그 조상에는 `overflow-x-clip`이 걸려 있는데, 둘 다 `position: fixed`를
       * 무력화한다 — transform이 있는 조상은 fixed의 기준 박스가 되고, clip은 그
       * 바깥으로 나간 부분을 잘라낸다. 제자리에 두면 오버레이가 화면 전체가 아니라
       * 갤러리 박스 안에 갇힌 채 잘려 나온다.
       */}
      {/* SSR에는 document가 없다. 닫혀 있을 때 portal이 그리는 DOM은 어차피
          없으므로, 이 분기가 서버/클라이언트 첫 렌더의 결과를 어긋나게 하지 않는다. */}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {zoomedIndex !== null ? (
                <GalleryLightbox
                  images={images}
                  index={zoomedIndex}
                  projectName={projectName}
                  onIndexChange={setZoomedIndex}
                  onClose={closeZoom}
                />
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </section>
  );
}

/** 라이트박스에서 장을 넘기는 기준(px, px/s). 거리를 못 채워도 충분히 빠르게
 *  튕기면 넘어간다 — 좁은 화면에서 짧고 빠른 스와이프가 무시되면 "안 먹는다"고 느낀다. */
const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 400;

/** 더 넘길 곳이 없을 때 남기는 저항. 아예 안 움직이면 "고장"으로 읽히고, 그대로
 *  따라오면 넘어갈 것처럼 보인다. 조금만 끌리다 되돌아오는 것이 정확한 신호다. */
const EDGE_RESISTANCE = 0.25;

/**
 * 이미지 확대 오버레이. 화면을 검게 덮어 페이지를 가리므로 채팅 패널과 달리
 * **진짜 모달**이다 — `aria-modal`을 붙이고, Escape와 바깥 클릭으로 닫고,
 * 열려 있는 동안 뒤 페이지의 스크롤을 막는다.
 *
 * 넘기는 방법은 네 가지 — 스와이프/드래그, 좌우 버튼, ←/→ 키. 갤러리 트랙과 달리
 * 여기서는 스크롤 컨테이너를 쓰지 않고 **한 장만 렌더**한 뒤 motion의 `drag="x"`로
 * 끈다. 확대 보기에서는 이미지 하나가 화면을 가득 채우는 것이 핵심이라, 옆 장을
 * 미리 붙여 놓는 scroll-snap 구조를 쓰면 전체 화면 크기의 이미지를 장 수만큼
 * 깔아야 한다. 끝 장에서 더 끌면 `dragElastic`이 고무줄처럼 되돌려, 넘길 곳이
 * 없다는 것을 막힘이 아니라 촉감으로 알린다.
 *
 * 닫기 판정은 트랙과 같은 원리다 — 눌렀다 뗄 때까지의 이동량이 CLICK_SLOP 이내일
 * 때만 클릭으로 친다. 이게 없으면 스와이프로 넘길 때마다 모달이 닫힌다.
 */
function GalleryLightbox({
  images,
  index,
  projectName,
  onIndexChange,
  onClose,
}: {
  images: ProjectImage[];
  index: number;
  projectName: string;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // MotionProvider의 reducedMotion 설정에 기대지 않고 이 자리에서 직접 읽는다
  // (ChatModal과 같은 이유 — 확대 애니메이션은 이 컴포넌트가 스스로 정한다).
  const prefersReducedMotion = useReducedMotion();
  // 방금 어느 쪽으로 넘겼는지. 새로 들어오는 이미지가 어느 쪽에서 나타날지를
  // 정하는 값이라 렌더 중에 읽는다 — 그래서 ref가 아니라 state다.
  const [direction, setDirection] = useState<1 | -1>(1);
  // 닫기/넘기기 판정용 이동량(트랙의 pressRef와 같은 역할).
  const pressRef = useRef({ x: 0, y: 0, moved: 0 });
  // 손가락(커서)을 따라 이미지가 끌린 거리. motion value라 값이 바뀌어도 리렌더가
  // 일어나지 않는다 — 매 pointermove마다 렌더를 돌리면 큰 이미지에서 끊긴다.
  const dragX = useMotionValue(0);
  const swipeRef = useRef({
    pending: false,
    active: false,
    startX: 0,
    startY: 0,
    startTime: 0,
  });
  const image = images[index];

  const canGo = useCallback(
    (delta: 1 | -1) => {
      const next = index + delta;
      return next >= 0 && next < images.length;
    },
    [index, images.length],
  );

  const go = useCallback(
    (delta: 1 | -1) => {
      if (!canGo(delta)) {
        return;
      }
      setDirection(delta);
      onIndexChange(index + delta);
    },
    [canGo, index, onIndexChange],
  );

  // 키 조작은 창 전체에서 받는다. 오버레이 안의 특정 요소에 포커스가 있어야만
  // 닫히면, 배경을 눌러 포커스가 빠진 뒤에 Escape가 먹지 않는다.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        go(1);
      } else if (event.key === "ArrowLeft") {
        go(-1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [go, onClose]);

  // 뒤 페이지가 같이 스크롤되면 "덮여 있다"는 감각이 깨진다.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // 열리자마자 포커스를 오버레이 안으로 들여야 Tab이 뒤 페이지로 새지 않고,
  // 스크린리더도 지금 무엇이 열렸는지 읽는다.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /**
   * 스와이프는 motion의 `drag` 대신 포인터를 직접 받아 처리한다. `drag="x"`는 x를
   * 자기 것으로 삼는데, 진입 모션(`animate`)도 같은 x를 쓰기 때문에 둘을 한 요소에
   * 걸면 애니메이션이 x를 0으로 되돌려 드래그가 먹지 않는다. 그래서 **끌린 거리(x)를
   * 담는 층과 진입 모션을 하는 층을 나누고**, 끌기 판정은 트랙과 같은 방식으로
   * 여기서 계산한다.
   */
  function handleSwipeDown(event: React.PointerEvent<HTMLDivElement>) {
    swipeRef.current = {
      pending: images.length > 1,
      active: false,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
    };
  }

  function handleSwipeMove(event: React.PointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current;
    if (!swipe.pending) {
      return;
    }
    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;

    if (!swipe.active) {
      if (Math.hypot(dx, dy) <= CLICK_SLOP) {
        return;
      }
      // 축을 여기서 한 번 확정한다. 세로가 우세한 손짓이면 가로로 끌지 않는다.
      if (Math.abs(dy) > Math.abs(dx)) {
        swipe.pending = false;
        return;
      }
      swipe.active = true;
      // 커서가 이미지 밖으로 나가도 끝까지 따라온다. 트랙과 마찬가지로 slop을
      // 넘긴 뒤에 캡처해야 단순 클릭 경로를 건드리지 않는다.
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const blocked = (dx > 0 && !canGo(-1)) || (dx < 0 && !canGo(1));
    dragX.set(blocked ? dx * EDGE_RESISTANCE : dx);
  }

  function handleSwipeEnd(event: React.PointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current;
    swipe.pending = false;
    if (!swipe.active) {
      return;
    }
    swipe.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const snapBack = () =>
      animate(dragX, 0, { duration: DURATION.base, ease: [...EASE] });

    // 브라우저가 제스처를 가져갔으면(pointercancel) 넘기지 않고 되돌린다.
    if (event.type === "pointercancel") {
      snapBack();
      return;
    }

    const dx = event.clientX - swipe.startX;
    const elapsed = Math.max(event.timeStamp - swipe.startTime, 1);
    const velocity = (Math.abs(dx) / elapsed) * 1000;
    // 왼쪽으로 끌면 다음 장이 따라온다(손가락이 미는 방향 = 콘텐츠가 가는 방향).
    const delta: 1 | -1 = dx < 0 ? 1 : -1;

    if (
      (Math.abs(dx) > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) &&
      canGo(delta)
    ) {
      // 되돌리는 애니메이션 없이 0으로 놓는다 — 이어서 새 이미지가 자기 진입
      // 모션으로 들어오므로, 되돌아왔다가 다시 나가면 두 번 움직이는 꼴이 된다.
      dragX.set(0);
      go(delta);
      return;
    }
    snapBack();
  }

  /** 오버레이 어디를 눌러도 닫힌다(cursor-zoom-out이 그렇게 약속한다). 단
   *  스와이프로 끝난 포인터와 버튼 클릭은 제외한다. */
  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (pressRef.current.moved > CLICK_SLOP) {
      return;
    }
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    onClose();
  }

  const counter = `${String(index + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")}`;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${projectName} 이미지 확대 보기`}
      onPointerDown={(event) => {
        pressRef.current = { x: event.clientX, y: event.clientY, moved: 0 };
      }}
      onPointerMove={(event) => {
        pressRef.current.moved = Math.max(
          pressRef.current.moved,
          Math.hypot(
            event.clientX - pressRef.current.x,
            event.clientY - pressRef.current.y,
          ),
        );
      }}
      onClick={handleOverlayClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      className="fixed inset-0 z-50 flex cursor-zoom-out flex-col bg-black/90 p-4 backdrop-blur-sm sm:p-8"
    >
      <div className="flex shrink-0 items-center justify-between gap-4">
        <span
          aria-live="polite"
          className="font-mono text-xs text-zinc-400 tabular-nums"
        >
          {counter}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="확대 닫기"
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center border border-zinc-600 font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100"
        >
          ✕
        </button>
      </div>

      <div
        onPointerDown={handleSwipeDown}
        onPointerMove={handleSwipeMove}
        onPointerUp={handleSwipeEnd}
        onPointerCancel={handleSwipeEnd}
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center overflow-hidden py-4",
          // 넘길 곳이 있을 때만 끌 수 있다고 커서로 알린다. touch-pan-y는 가로
          // 손짓만 이쪽으로 넘기고 세로는 브라우저에 맡긴다는 뜻이다 — 모바일에서
          // 이걸 빼면 브라우저가 가로 제스처를 먼저 가져가 스와이프가 먹지 않는다.
          images.length > 1 && "cursor-grab touch-pan-y active:cursor-grabbing",
        )}
      >
        {/* 끌린 거리를 담는 층. 아래 figure의 진입 모션과 층을 나눠야 둘 다 x를
            쓰면서 서로를 덮어쓰지 않는다(handleSwipeDown 주석 참고). */}
        <motion.div style={{ x: dragX }} className="h-full w-full">
          <motion.figure
            // key를 src로 두면 넘길 때마다 새로 mount되어 진입 모션이 다시 돈다 —
            // "다른 이미지로 바뀌었다"는 사실이 눈에 남는다.
            key={image.src}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, x: direction * 28 }
            }
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="flex h-full w-full flex-col items-center justify-center gap-4"
          >
            <div className="relative min-h-0 w-full flex-1">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                draggable={false}
                className="object-contain select-none"
                sizes="100vw"
                priority
              />
            </div>
            {image.caption ? (
              <figcaption className="max-w-2xl shrink-0 text-center text-xs leading-relaxed text-zinc-400">
                {image.caption}
              </figcaption>
            ) : null}
          </motion.figure>
        </motion.div>
      </div>

      {images.length > 1 ? (
        <div className="flex shrink-0 items-center justify-center gap-3">
          <LightboxButton
            label="이전 이미지"
            disabled={!canGo(-1)}
            onClick={() => go(-1)}
          >
            ←
          </LightboxButton>
          <LightboxButton
            label="다음 이미지"
            disabled={!canGo(1)}
            onClick={() => go(1)}
          >
            →
          </LightboxButton>
        </div>
      ) : null}
    </motion.div>
  );
}

function GalleryButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center border border-zinc-300 font-mono text-xs text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-100 dark:hover:text-zinc-900 dark:disabled:hover:bg-transparent dark:disabled:hover:text-zinc-300"
    >
      {children}
    </button>
  );
}

/** 검은 배경 위에서만 쓰는 좌우 버튼. 라이트박스는 항상 어두우므로 다크모드
 *  분기 없이 밝은 색 하나로 고정한다. */
function LightboxButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-zinc-600 font-mono text-sm text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-100 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-zinc-300"
    >
      {children}
    </button>
  );
}
