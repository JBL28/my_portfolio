"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ProjectImage, SectionEvidence } from "@/types/portfolio";
import { Overlay } from "@/components/ui/Overlay";
import { DURATION, EASE } from "@/lib/motion";

/**
 * 문단의 주장 아래에 붙는 증거 버튼 — hover하면 내용만 미리 보이고, 누르면 크게 열린다.
 *
 * **증거는 자리를 차지하지 않는다.** 다이어그램이나 코드를 문단마다 펼쳐 두면 서술이
 * 끊기고, 열을 하나 더 만들면 본문·명세·증거 셋 다 좁아져 아무것도 못 읽는다. 그래서
 * 평소에는 한 줄짜리 버튼만 두고 필요할 때만 꺼낸다.
 *
 * 두 단계로 나눈 이유는 **열어볼지 정하는 비용**을 없애기 위해서다. 미리보기는 설명
 * 없이 내용만 보여준다 — 캡션까지 붙이면 그게 또 하나의 읽을거리가 되어, 훑어보려던
 * 사람을 붙잡는다. 캡션은 실제로 열었을 때 읽으면 된다.
 *
 * 미리보기는 마우스와 키보드 포커스에만 반응한다(터치에는 hover가 없다). 어느
 * 경우에도 클릭으로 여는 경로가 그대로 있으므로 미리보기가 없어도 기능은 온전하다 —
 * 그래서 `aria-hidden`으로 두고 보조기술에는 중복해서 읽히지 않게 한다.
 *
 * 문법 강조는 서버에서 만들어진 HTML(`highlighted`)을 그대로 받는다(lib/highlight.ts).
 */
export function SectionEvidenceList({
  evidence,
  highlighted,
  images,
  sectionTitle,
}: {
  evidence: SectionEvidence[];
  /** 서버에서 미리 강조한 코드 HTML. 이미지 증거 자리는 null이다. */
  highlighted: (string | null)[];
  /** 갤러리 이미지 목록 — `kind: "image"`가 src로 가리키는 대상이다. */
  images: ProjectImage[];
  sectionTitle: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const open = openIndex === null ? null : evidence[openIndex];

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {evidence.map((item, index) => (
        <span
          key={item.label}
          className="relative"
          onMouseEnter={() => setHoverIndex(index)}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(index)}
            onFocus={() => setHoverIndex(index)}
            onBlur={() => setHoverIndex(null)}
            className="inline-flex cursor-pointer items-center gap-2 border border-zinc-200 px-2.5 py-1.5 font-mono text-[11px] text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
          >
            {/* 무엇이 열릴지 종류를 먼저 알린다 — 이미지와 코드는 여는 마음가짐이 다르다. */}
            <span aria-hidden className="text-zinc-500 dark:text-zinc-400">
              {item.kind === "image" ? "▣" : "⟨⟩"}
            </span>
            {item.label}
          </button>

          <AnimatePresence>
            {hoverIndex === index && openIndex === null ? (
              <motion.span
                aria-hidden
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 4, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE }}
                /* 버튼 위에 띄운다 — 아래로 열면 다음 문단을 가려 읽던 자리를 잃는다.
                   폭은 좁게 잡는다. 우측 컬럼에 overflow-x-clip이 걸려 있어 넓게
                   잡으면 오른쪽이 잘린다. */
                className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 block w-72 origin-bottom-left overflow-hidden border border-zinc-300 shadow-lg sm:w-80 dark:border-zinc-700"
              >
                {item.kind === "image" ? (
                  <PreviewImage item={item} images={images} />
                ) : (
                  <PreviewCode
                    html={highlighted[index]}
                    lineCount={item.code.split("\n").length}
                  />
                )}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      ))}

      {/* 오버레이는 body 직속으로 내보낸다 — 이 컴포넌트는 Reveal(transform)과
          overflow-x-clip 안에 있고, 둘 다 position:fixed를 무력화한다. */}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <Overlay
                  label={`${sectionTitle} — ${open.label}`}
                  onClose={() => setOpenIndex(null)}
                  header={
                    <span className="truncate font-mono text-xs text-zinc-400">
                      {open.label}
                    </span>
                  }
                >
                  {open.kind === "image" ? (
                    <FullImage item={open} images={images} />
                  ) : (
                    <FullCode item={open} html={highlighted[openIndex!]} />
                  )}
                </Overlay>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   미리보기 — 설명 없이 내용만
   -------------------------------------------------------------------------- */

function PreviewImage({
  item,
  images,
}: {
  item: Extract<SectionEvidence, { kind: "image" }>;
  images: ProjectImage[];
}) {
  const image = images.find((candidate) => candidate.src === item.src);
  if (!image) {
    return null;
  }
  return (
    <span className="relative block aspect-[16/10] bg-zinc-100 dark:bg-zinc-900">
      <Image
        src={image.src}
        alt=""
        fill
        className="object-contain"
        sizes="20rem"
      />
    </span>
  );
}

/** 코드는 앞부분만 보여주고 아래를 흐린다 — 잘린 자리를 선으로 자르면 "여기서 끝"으로
 *  읽히지만, 흐려지면 "더 있다"로 읽힌다. */
function PreviewCode({
  html,
  lineCount,
}: {
  html: string | null;
  lineCount: number;
}) {
  if (!html) {
    return null;
  }
  // max-h-40(10rem)에 11px·1.7 줄간격이면 여덟 줄 남짓 들어간다. 그보다 짧으면 잘릴
  // 것이 없으므로 페이드를 그리지 않는다 — 다 보이는 코드 위에 그림자가 얹히면
  // 없는 내용이 더 있는 것처럼 읽힌다.
  const isTruncated = lineCount > 8;
  return (
    <span className="relative block max-h-40 overflow-hidden">
      <span
        className="code-block block [&_pre]:overflow-hidden [&_pre]:py-3 [&_pre]:pr-3 [&_pre]:font-mono [&_pre]:text-[11px] [&_pre]:leading-[1.7]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {/* 테마 배경 위에 얹는 페이드. 배경색은 테마가 인라인으로 넣으므로 여기서
          고정값을 쓰면 테마를 바꿀 때마다 어긋난다 — 대신 아래쪽만 어둡게 덮는다. */}
      {isTruncated ? (
        <span className="absolute inset-x-0 bottom-0 block h-10 bg-gradient-to-t from-black/85 to-transparent" />
      ) : null}
    </span>
  );
}

/* --------------------------------------------------------------------------
   전체 보기 — 설명까지
   -------------------------------------------------------------------------- */

/** 갤러리와 같은 이미지를 가리키므로 alt·caption도 그쪽 것을 그대로 쓴다. */
function FullImage({
  item,
  images,
}: {
  item: Extract<SectionEvidence, { kind: "image" }>;
  images: ProjectImage[];
}) {
  const image = images.find((candidate) => candidate.src === item.src);
  if (!image) {
    return null;
  }
  return (
    <figure className="flex h-full w-full flex-col items-center justify-center gap-4">
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
    </figure>
  );
}

function FullCode({
  item,
  html,
}: {
  item: Extract<SectionEvidence, { kind: "code" }>;
  html: string | null;
}) {
  return (
    /* 크기를 내용에 맡긴다 — 예전에는 h-full/flex-1이라 네 줄짜리 코드도 화면 높이를
       다 차지해 아래가 텅 빈 검은 상자로 보였다. max-h/max-w로 상한만 두고, 넘칠 때만
       스크롤한다. 가로도 마찬가지로 짧은 코드는 그만큼만 차지한다. */
    <figure className="flex max-h-full w-fit max-w-full flex-col gap-3">
      <div
        className="code-block min-h-0 overflow-auto border border-zinc-700 [&_pre]:py-4 [&_pre]:pr-4 [&_pre]:font-mono [&_pre]:text-[12.5px] [&_pre]:leading-[1.75]"
        dangerouslySetInnerHTML={{ __html: html ?? "" }}
      />
      <figcaption className="shrink-0 font-mono text-[11px] text-zinc-500">
        {item.language}
        {item.caption ? (
          <span className="ml-2 font-sans text-zinc-400">{item.caption}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}
