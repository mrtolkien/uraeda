import { type RefObject, useEffect, useRef, useState } from "react";
import type { Block } from "uraeda-binding";
import { frame, keepPlace, topOf } from "./keepPlace.ts";

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
 * Keeps a selected block where it was read, `top` px from the window's top, once the comment sheet
 * has stopped moving, and brings it into the space between the top bar and the sheet when the
 * sheet hides it: its bottom just above the sheet, or its top under the bar when it is taller than
 * that space.
 */
async function placeAboveSheet(
  element: HTMLElement,
  sheet: RefObject<HTMLElement | null>,
  top: number,
) {
  const sheetTop = await restingTop(sheet);
  if (sheetTop === undefined || !element.isConnected) {
    return;
  }
  const moved = element.getBoundingClientRect().top - top;
  if (Math.abs(moved) >= 0.5) {
    window.scrollBy({ behavior: "instant", top: moved });
  }
  const bar = document.querySelector('[role="banner"]')?.getBoundingClientRect().bottom ?? 0;
  const box = element.getBoundingClientRect();
  if (box.top >= bar && box.bottom <= sheetTop) {
    return;
  }
  const by = box.height > sheetTop - bar ? box.top - bar : box.bottom - sheetTop;
  window.scrollBy({ behavior: reducedMotion() ? "auto" : "smooth", top: by });
}

/**
 * The comment being written on a review: the lines selected by tapping blocks, and the last block
 * tapped, under which the field opens on wide screens. Its text is the field's, in the unsaved
 * store: `onSelect` says where it goes as the lines change, for the store to keep them with it.
 * `restored` is the comment the page opens as it is drawn; `writing` says which comment is written,
 * a new one at each close and each edit started. The last tapped block keeps its place on screen
 * as the form opens under it, moves, or closes (US7 1 of the spec redesign); on the phone, it goes
 * above the comment sheet when the sheet would hide it, as it opens and at each tap.
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
  // Where the last tapped block was on screen as it was tapped, px from the window's top.
  const tappedTop = useRef(0);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = lastElement.current;
    if (wide || draft?.kind !== "lines" || !element) {
      return;
    }
    void placeAboveSheet(element, sheet, tappedTop.current);
  }, [wide, draft?.kind, selection]);

  /** Keeps the last tapped block in place as the form leaves it, then forgets it. */
  const leave = () => {
    const element = lastElement.current;
    if (element) {
      void keepPlace(topOf(element));
    }
    lastElement.current = null;
  };

  /** Adds a tapped block to the selection, or starts one with it. */
  const tap = (block: Block, element: HTMLElement) => {
    const next = selection
      ? {
          end: Math.max(selection.end, block.endLine),
          heading: block.startLine < selection.start ? (block.heading ?? "") : selection.heading,
          start: Math.min(selection.start, block.startLine),
        }
      : { end: block.endLine, heading: block.heading ?? "", start: block.startLine };
    // On a wide screen, the form opens under the block, or moves to it from a block above it.
    if (wide) {
      void keepPlace(topOf(element));
    }
    tappedTop.current = element.getBoundingClientRect().top;
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
    leave();
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
    leave();
  };

  /** Once comment `number` is removed: its edit closes, and an edit of one after it follows it. */
  const removed = (number: number) => {
    if (draft?.kind !== "edit" || draft.number < number) {
      return;
    }
    if (draft.number === number) {
      close();
    } else {
      setDraft({ kind: "edit", number: draft.number - 1 });
    }
  };

  return { close, draft, last, removed, selection, sheet, start, tap, writing };
}
