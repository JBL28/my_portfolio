"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import type { ProjectImage } from "@/types/portfolio";
import { DURATION, EASE } from "@/lib/motion";

/**
 * Project Detail 우측 컬럼 상단의 이미지 갤러리. CSS scroll-snap 기반의 가로
 * 페이징이라 모바일에서는 손가락 스와이프로, 데스크탑에서는 좌우 버튼으로 넘긴다.
 * 스크롤/버튼 어느 쪽으로 넘겨도 mono 카운터("01 / 03")가 현재 위치를 따라간다.
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
        className="mt-5 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image) => (
          <li key={image.src} className="w-full shrink-0 snap-center">
            <figure className="pr-px">
              <div className="relative aspect-[16/10] border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
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
