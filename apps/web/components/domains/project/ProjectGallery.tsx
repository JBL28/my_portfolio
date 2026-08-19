"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import type { ProjectImage } from "@/types/portfolio";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";

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
  // 드래그 중 누적 이동량. 리렌더가 필요 없는 값이라 ref로 둔다.
  const dragRef = useRef({ startX: 0, startScrollLeft: 0, moved: 0 });

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
    // 터치는 네이티브 스크롤에 맡긴다(위 docstring 참고).
    if (event.pointerType === "touch") {
      return;
    }
    const track = trackRef.current;
    if (!track) {
      return;
    }
    dragRef.current = {
      startX: event.clientX,
      startScrollLeft: track.scrollLeft,
      moved: 0,
    };
    setIsDragging(true);
    setSnapEnabled(track, false);
    // 커서가 트랙 밖으로 나가도 이동을 계속 받는다.
    track.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLUListElement>) {
    const track = trackRef.current;
    if (!isDragging || !track) {
      return;
    }
    const delta = event.clientX - dragRef.current.startX;
    dragRef.current.moved = Math.max(dragRef.current.moved, Math.abs(delta));
    track.scrollLeft = dragRef.current.startScrollLeft - delta;
  }

  function endDrag(event: React.PointerEvent<HTMLUListElement>) {
    const track = trackRef.current;
    if (!isDragging || !track) {
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

  function scrollByPage(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
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
                onClick={() => scrollByPage(-1)}
              >
                ←
              </GalleryButton>
              <GalleryButton
                label="다음 이미지"
                disabled={index >= images.length - 1}
                onClick={() => scrollByPage(1)}
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
        {images.map((image) => (
          <li key={image.src} className="w-full shrink-0 snap-center">
            <figure className="pr-px">
              <div className="relative aspect-[16/10] border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
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
              </div>
              {image.caption ? (
                <figcaption className="mt-2.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {image.caption}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>
    </section>
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
