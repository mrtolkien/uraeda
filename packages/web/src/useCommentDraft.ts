import { type RefObject, useEffect, useRef, useState } from "react";
import type { Block } from "uraeda-binding";
import { merged, type Range } from "./commentRange.ts";
import { frame, keepPlace, scrollInstantly, scrollMark, topOf } from "./keepPlace.ts";
import { topBarBottom } from "./layout/topBar.ts";

/**
 * The last tapped element, under which the form opens: a block of the reviewed file, by its id, or
 * a part of a decision, by the decision and the part's last line.
 */
export type Last = number | { decision: string; line: number; removed: boolean };

/** Where the form opens once a part of a decision is tapped: under that part. */
const partLast = ({ decision, end }: Range & { decision: NonNullable<Range["decision"]> }) => ({
  decision: decision.name,
  line: end,
  removed: decision.removed,
});

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
  scrolled: () => number,
) {
  const sheetTop = await restingTop(sheet);
  if (sheetTop === undefined || !element.isConnected) {
    return;
  }
  // The reader's own scroll while the sheet settled is theirs: only the page's shift is put back.
  const moved = element.getBoundingClientRect().top - top + scrolled();
  if (Math.abs(moved) >= 0.5) {
    scrollInstantly(moved);
  }
  const bar = topBarBottom();
  const box = element.getBoundingClientRect();
  if (box.top >= bar && box.bottom <= sheetTop) {
    return;
  }
  const by = box.height > sheetTop - bar ? box.top - bar : box.bottom - sheetTop;
  window.scrollBy({ behavior: reducedMotion() ? "auto" : "smooth", top: by });
}

/** The text field of the first comment form after `element` in the page, if any. */
function fieldAfter(element: HTMLElement) {
  return [
    ...document.querySelectorAll<HTMLElement>('form[aria-label="Comment"] [role="textbox"]'),
  ].find((field) => element.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/**
 * On a wide screen, a tap, or Enter on a block's toggle, gives the comment field under the tapped
 * block, `tapped`, the focus once drawn, so typing goes to it and never to the page's keys: each new
 * `last`, but the one the page opened on, restored. On the phone the sheet opens without raising
 * the keyboard.
 */
function useFieldAfterTap(
  wide: boolean,
  tapped: RefObject<HTMLElement | null>,
  last: Last | undefined,
) {
  const [restored] = useState(last);
  useEffect(() => {
    const element = tapped.current;
    if (!wide || last === undefined || last === restored || !element) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => fieldAfter(element)?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [wide, last, restored, tapped]);
}

/**
 * The last tapped block, under which the form opens: kept in place on screen as the form opens under
 * it, moves, or closes, and on the phone brought above the comment sheet when the sheet would hide
 * it; and on a wide screen, the field under it focused. `mark` notes a tap on `element`, and `leave`
 * keeps the block in place as the form leaves it, then forgets it.
 */
function useTappedBlock(
  wide: boolean,
  lines: boolean,
  selection: Range | undefined,
  last: Last | undefined,
) {
  const lastElement = useRef<HTMLElement>(null);
  // Where the last tapped block was on screen as it was tapped, px from the window's top.
  const tappedTop = useRef(0);
  // The reader's scroll since that tap: theirs, never put back.
  const tappedScroll = useRef<() => number>(() => 0);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = lastElement.current;
    if (wide || !lines || !element) {
      return;
    }
    void placeAboveSheet(element, sheet, tappedTop.current, tappedScroll.current);
  }, [wide, lines, selection]);
  useFieldAfterTap(wide, lastElement, last);

  const mark = (element: HTMLElement) => {
    // On a wide screen, the form opens under the block, or moves to it from a block above it.
    if (wide) {
      void keepPlace(topOf(element));
    }
    tappedTop.current = element.getBoundingClientRect().top;
    tappedScroll.current = scrollMark();
    lastElement.current = element;
  };

  const leave = () => {
    const element = lastElement.current;
    if (element) {
      void keepPlace(topOf(element));
    }
    lastElement.current = null;
  };

  return { leave, mark, sheet };
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
  restored?: { draft: CommentDraft; last?: Last; selection?: Range },
) {
  const [selection, setSelection] = useState<Range | undefined>(restored?.selection);
  const [draft, setDraft] = useState<CommentDraft | undefined>(restored?.draft);
  const [last, setLast] = useState<Last | undefined>(restored?.last);
  // Which comment is written: a new one with each close and each edit started (R71).
  const [writing, setWriting] = useState(0);
  const { leave, mark, sheet } = useTappedBlock(wide, draft?.kind === "lines", selection, last);

  /** Adds tapped lines to the selection, or starts one with them. */
  const select = (range: Range, tapped: Last, element: HTMLElement) => {
    const next = merged(selection, range);
    mark(element);
    setSelection(next);
    setLast(tapped);
    if (draft?.kind !== "lines") {
      setDraft({ kind: "lines" });
    }
    onSelect(next);
  };

  /** Adds a tapped block to the selection, or starts one with it. */
  const tap = (block: Block, element: HTMLElement) =>
    select(
      { end: block.endLine, heading: block.heading ?? "", start: block.startLine },
      block.id,
      element,
    );

  /** Adds a tapped part of a decision to the selection, or starts one with it. */
  const tapPart = (range: Parameters<typeof partLast>[0], element: HTMLElement) =>
    select(range, partLast(range), element);

  /**
   * Sets the selection the keys stretch, the review's yellow, without opening or closing the form;
   * `undefined` drops it, and the selection before the keys stretched it comes back so, a form's.
   */
  const stretch = (range: Range | undefined) => {
    setSelection(range);
    onSelect(range);
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

  return {
    close,
    draft,
    last,
    removed,
    selection,
    sheet,
    start,
    stretch,
    tap,
    tapPart,
    writing,
  };
}
