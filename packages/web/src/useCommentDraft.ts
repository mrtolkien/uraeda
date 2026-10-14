import { type RefObject, useEffect, useRef, useState } from "react";
import type { Block } from "uraeda-binding";

/** Lines of the reviewed file, and the heading above them. */
export type Range = { end: number; heading: string; start: number };

/** The comment being written: on the selected lines, on the whole file, or an edit of one. */
export type CommentDraft =
  | { kind: "lines" }
  | { kind: "general" }
  | { kind: "edit"; number: number };

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/**
 * The top of the comment sheet once it has stopped moving, or after 5 seconds on a device too
 * slow to tell: the sheet slides in with a transition, which a read of its style starts.
 */
async function restingTop(sheet: RefObject<HTMLElement | null>) {
  const deadline = performance.now() + 5000;
  while (!sheet.current && performance.now() < deadline) {
    await frame();
  }
  const element = sheet.current;
  if (!element) {
    return undefined;
  }
  void getComputedStyle(element).transform;
  const moving = (document.getAnimations?.() ?? [])
    .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise(
    (resolve) => (timer = setTimeout(resolve, deadline - performance.now())),
  );
  await Promise.race([Promise.all(moving), late]);
  clearTimeout(timer);
  return element.getBoundingClientRect().top;
}

/**
 * Brings a selected block into the space between the top bar and the comment sheet, once the sheet
 * has stopped moving: its bottom just above the sheet, or its top under the bar when it is taller
 * than that space.
 */
async function placeAboveSheet(element: HTMLElement, sheet: RefObject<HTMLElement | null>) {
  const top = await restingTop(sheet);
  if (top === undefined || !element.isConnected) {
    return;
  }
  const bar = document.querySelector('[role="banner"]')?.getBoundingClientRect().bottom ?? 0;
  const box = element.getBoundingClientRect();
  const by = box.height > top - bar ? box.top - bar : box.bottom - top;
  window.scrollBy({ behavior: reducedMotion() ? "auto" : "smooth", top: by });
}

/**
 * The comment being written on a review: the lines selected by tapping blocks, and the last block
 * tapped, under which the field opens on wide screens. Its text is the field's, in the unsaved
 * store: `onSelect` says where it goes as the lines change, for the store to keep them with it.
 * `restored` is the comment the page opens as it is drawn; `writing` says which comment is written,
 * a new one at each close and each edit started. On the phone, the last tapped block goes
 * above the comment sheet, as it opens and at each tap.
 */
export function useCommentDraft(
  wide: boolean,
  onSelect: (selection: Range | undefined) => void,
  restored?: { draft: CommentDraft; last?: number; selection?: Range },
) {
  const [selection, setSelection] = useState<Range | undefined>(restored?.selection);
  const [draft, setDraft] = useState<CommentDraft | undefined>(restored?.draft);
  const [last, setLast] = useState<number | undefined>(restored?.last);
  // Which comment is written: a new one with each close and each edit started (R71).
  const [writing, setWriting] = useState(0);
  const lastElement = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = lastElement.current;
    if (wide || draft?.kind !== "lines" || !element) {
      return;
    }
    void placeAboveSheet(element, sheet);
  }, [wide, draft?.kind, selection]);

  /** Adds a tapped block to the selection, or starts one with it. */
  const tap = (block: Block, element: HTMLElement) => {
    const next = selection
      ? {
          end: Math.max(selection.end, block.endLine),
          heading: block.startLine < selection.start ? (block.heading ?? "") : selection.heading,
          start: Math.min(selection.start, block.startLine),
        }
      : { end: block.endLine, heading: block.heading ?? "", start: block.startLine };
    setSelection(next);
    setLast(block.id);
    lastElement.current = element;
    if (draft?.kind !== "lines") {
      setDraft({ kind: "lines" });
    }
    onSelect(next);
  };

  /** Starts a comment on the whole file, or an edit of a pending comment. */
  const start = (next: Exclude<CommentDraft, { kind: "lines" }>) => {
    setSelection(undefined);
    setLast(undefined);
    setDraft(next);
    if (next.kind === "general") {
      onSelect(undefined);
    } else {
      setWriting((was) => was + 1);
    }
  };

  const close = () => {
    setWriting((was) => was + 1);
    setDraft(undefined);
    setSelection(undefined);
    setLast(undefined);
    lastElement.current = null;
  };

  return { close, draft, last, selection, sheet, start, tap, writing };
}
