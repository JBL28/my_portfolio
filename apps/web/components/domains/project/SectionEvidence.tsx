"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ProjectImage, SectionEvidence } from "@/types/portfolio";
import { Overlay } from "@/components/ui/Overlay";
import { RichText } from "@/lib/rich-text";
import { DURATION, EASE, STAGGER } from "@/lib/motion";

/** 가장 큰 미리보기의 대략적인 높이(px). 화면 아래쪽 버튼에서 미리보기를 얼마나
 *  끌어올릴지 정하는 데만 쓰는 값이라 정확할 필요는 없다. */
const PREVIEW_RESERVE = 360;

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
  sectionBody,
}: Readonly<{
  evidence: SectionEvidence[];
  /** 서버에서 미리 강조한 코드 HTML. 이미지 증거 자리는 null이다. */
  highlighted: (string | null)[];
  /** 갤러리 이미지 목록 — `kind: "image"`가 src로 가리키는 대상이다. */
  images: ProjectImage[];
  sectionTitle: string;
  /** 이 증거가 받치는 문단의 본문. 확대해서 볼 때 옆에 함께 띄운다. */
  sectionBody: string;
}>) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  /** 미리보기 대상과 그 버튼의 세로 위치(슬롯 기준 px). 위치를 같이 들고 있어야
   *  레일 맨 위가 아니라 **누르려는 버튼 옆**에 뜬다. */
  const [hover, setHover] = useState<{
    index: number;
    top: number;
    slot: HTMLElement;
  } | null>(null);

  const open = openIndex === null ? null : evidence[openIndex];
  // 확대해서 보는 중이면 미리보기는 접는다 — 같은 내용을 두 겹으로 띄울 이유가 없다.
  const preview = openIndex === null ? hover : null;

  /**
   * 버튼의 화면상 세로 위치를 슬롯 기준 오프셋으로 바꾼다. 슬롯은 sticky 레일 안의
   * 높이 0짜리 기준점이라, 이 값을 그대로 `top`에 주면 미리보기 윗변이 버튼 윗변과
   * 나란히 선다.
   *
   * 아래쪽 버튼에서는 그대로 두면 미리보기가 화면 밖으로 나가므로, 뷰포트 안에
   * 들어오도록 위로 끌어올린다(PREVIEW_RESERVE는 가장 큰 미리보기의 대략적인 높이).
   */
  function openPreview(index: number, button: HTMLElement) {
    // 슬롯은 **이 순간** 찾는다. 렌더 중에 찾아 두면 그때 아직 DOM에 커밋되지 않은
    // 경우(클라이언트 내비게이션으로 들어온 첫 렌더 등) null이 핸들러에 붙박이고,
    // 그러면 hover해도 상태가 안 바뀌어 리렌더가 없으니 영영 복구되지 않는다.
    const slot = document.getElementById("evidence-preview-slot");
    if (!slot) {
      return;
    }
    const buttonTop = button.getBoundingClientRect().top;
    const slotTop = slot.getBoundingClientRect().top;
    const maxTop = globalThis.innerHeight - slotTop - PREVIEW_RESERVE;
    const top = Math.max(0, Math.min(buttonTop - slotTop, Math.max(0, maxTop)));
    setHover({ index, top, slot });
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {/* 마우스·포커스 핸들러를 버튼에 직접 단다. 예전에는 바깥 span이 hover를
          받았는데, 네이티브 상호작용 요소가 아닌 것에 상호작용을 얹으면 키보드·터치
          경로가 따라오지 않는다. 버튼은 그 전부를 이미 갖고 있다. */}
      {evidence.map((item, index) => (
        <button
          key={item.label}
          type="button"
          onClick={() => setOpenIndex(index)}
          onMouseEnter={(event) => openPreview(index, event.currentTarget)}
          onMouseLeave={() => setHover(null)}
          onFocus={(event) => openPreview(index, event.currentTarget)}
          onBlur={() => setHover(null)}
          className="inline-flex cursor-pointer items-center gap-2 border border-zinc-200 px-2.5 py-1.5 font-mono text-[11px] text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
        >
          {/* 무엇이 열릴지 종류를 먼저 알린다 — 이미지와 코드는 여는 마음가짐이 다르다. */}
          <span aria-hidden className="text-zinc-500 dark:text-zinc-400">
            {item.kind === "image" ? "▣" : "⟨⟩"}
          </span>
          {item.label}
        </button>
      ))}

      {preview ? (
        <EvidencePreview
          item={evidence[preview.index]}
          html={highlighted[preview.index]}
          images={images}
          top={preview.top}
          slot={preview.slot}
        />
      ) : null}

      <EvidenceOverlay
        item={open}
        html={openIndex === null ? null : highlighted[openIndex]}
        images={images}
        sectionTitle={sectionTitle}
        sectionBody={sectionBody}
        onClose={() => setOpenIndex(null)}
      />
    </div>
  );
}

/**
 * 좌측 명세 레일의 슬롯으로 보내는 미리보기. 버튼 위에 띄우면 읽던 문단을 가리고
 * 폭이 좁아 다이어그램을 알아볼 수 없었다 — 레일 폭을 쓰면 스크린샷도 구성도도 읽힌다.
 */
function EvidencePreview({
  item,
  html,
  images,
  top,
  slot,
}: Readonly<{
  item: SectionEvidence;
  html: string | null;
  images: ProjectImage[];
  top: number;
  slot: HTMLElement;
}>) {
  const prefersReducedMotion = useReducedMotion();

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={item.label}
        aria-hidden
        initial={
          prefersReducedMotion
            ? { opacity: 0 }
            : { opacity: 0, y: -6, scale: 0.99 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.fast, ease: EASE }}
        style={{ top }}
        /* 오른쪽 변을 레일 오른쪽에 붙이고 **왼쪽으로** 자란다. left-0으로 두면
           레일보다 넓어진 만큼 우측 서술 위로 넘어가 읽던 문단을 덮는데, 그건
           미리보기를 이 레일로 옮긴 이유 자체를 무르는 일이다. 대신 페이지 좌측
           여백을 쓴다 — 거기에는 덮을 것이 없다. */
        className="absolute right-0 w-[25rem] origin-top-right overflow-hidden border border-zinc-300 bg-white shadow-xl xl:w-[28rem] dark:border-zinc-700 dark:bg-zinc-950"
      >
        {item.kind === "image" ? (
          <PreviewImage item={item} images={images} />
        ) : (
          <PreviewCode html={html} lineCount={item.code.split("\n").length} />
        )}
      </motion.div>
    </AnimatePresence>,
    slot,
  );
}

/**
 * 확대 보기. **콘텐츠와 그 문단의 본문을 한 화면에 둔다** — 그림만 크게 띄우면 무엇을
 * 보고 있는 것인지 알려고 오버레이를 닫고 뒤 페이지의 글을 다시 읽어야 한다. 근거와
 * 주장이 갈라져 있으면 그 근거가 무엇을 받치는지 알 수 없다.
 *
 * body 직속으로 내보낸다 — 호출부는 Reveal(transform)과 overflow-x-clip 안에 있고,
 * 둘 다 position:fixed를 무력화한다.
 */
function EvidenceOverlay({
  item,
  html,
  images,
  sectionTitle,
  sectionBody,
  onClose,
}: Readonly<{
  item: SectionEvidence | null;
  html: string | null;
  images: ProjectImage[];
  sectionTitle: string;
  sectionBody: string;
  onClose: () => void;
}>) {
  const prefersReducedMotion = useReducedMotion();

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {item ? (
        <Overlay
          label={`${sectionTitle} — ${item.label}`}
          onClose={onClose}
          header={
            <span className="truncate font-mono text-xs text-zinc-400">
              {item.label}
            </span>
          }
          contentClassName="items-stretch"
        >
          <div className="flex h-full w-full flex-col gap-6 lg:flex-row lg:gap-10">
            {/* 둘이 놓일 자리에서 각자 바깥쪽에서 모여든다 — 콘텐츠는 왼쪽에서,
                본문은 오른쪽에서. 본문을 한 박자 늦춰 "근거를 보고 나서 설명을
                읽는다"는 순서를 움직임으로도 만든다. */}
            <motion.div
              initial={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -28 }
              }
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: DURATION.base,
                ease: EASE,
                delay: STAGGER,
              }}
              className="flex min-h-0 flex-1 items-center justify-center lg:min-w-0"
            >
              {item.kind === "image" ? (
                <FullImage item={item} images={images} />
              ) : (
                <FullCode item={item} html={html} />
              )}
            </motion.div>

            <motion.div
              initial={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 28 }
              }
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: DURATION.base,
                ease: EASE,
                delay: STAGGER * 2,
              }}
              className="min-h-0 shrink-0 overflow-y-auto lg:w-[22rem] xl:w-[26rem]"
            >
              <h2 className="text-[1.05rem] leading-snug font-bold text-zinc-100">
                {sectionTitle}
              </h2>
              <RichText
                text={sectionBody}
                className="mt-3 text-[0.875rem] leading-[1.85] text-zinc-400"
              />
            </motion.div>
          </div>
        </Overlay>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* --------------------------------------------------------------------------
   미리보기 — 설명 없이 내용만
   -------------------------------------------------------------------------- */

function PreviewImage({
  item,
  images,
}: Readonly<{
  item: Extract<SectionEvidence, { kind: "image" }>;
  images: ProjectImage[];
}>) {
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
        sizes="30rem"
      />
    </span>
  );
}

/** 코드는 앞부분만 보여주고 아래를 흐린다 — 잘린 자리를 선으로 자르면 "여기서 끝"으로
 *  읽히지만, 흐려지면 "더 있다"로 읽힌다. */
function PreviewCode({
  html,
  lineCount,
}: Readonly<{
  html: string | null;
  lineCount: number;
}>) {
  if (!html) {
    return null;
  }
  // max-h-72(18rem)에 12px·1.7 줄간격이면 열네 줄 남짓 들어간다. 그보다 짧으면 잘릴
  // 것이 없으므로 페이드를 그리지 않는다 — 다 보이는 코드 위에 그림자가 얹히면
  // 없는 내용이 더 있는 것처럼 읽힌다.
  const isTruncated = lineCount > 14;
  return (
    <span className="relative block max-h-72 overflow-hidden">
      <span
        className="code-block block [&_pre]:overflow-hidden [&_pre]:py-3 [&_pre]:pr-3 [&_pre]:font-mono [&_pre]:text-[12px] [&_pre]:leading-[1.7]"
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
}: Readonly<{
  item: Extract<SectionEvidence, { kind: "image" }>;
  images: ProjectImage[];
}>) {
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
}: Readonly<{
  item: Extract<SectionEvidence, { kind: "code" }>;
  html: string | null;
}>) {
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
