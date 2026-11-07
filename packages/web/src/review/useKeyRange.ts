// The comment's range as the keys stretch it: `J` and `K` on a held block move the cursor to the
// next or previous block of the same file and stretch the review's yellow from the block they
// started on, the anchor, to the one they reached, the head. A tap has no anchor, so the keys keep
// their own here; how a range grows and shrinks is `commentRange.ts`'s.
import { useEffect, useRef } from "react";
import type { DecisionChange, Document } from "uraeda-binding";
import { type Range, sameFile, spanned } from "../commentRange.ts";
import { isFocusLost, isKeyInput, markByKey } from "../cursor/held.ts";
import type { StopKey } from "../cursor/StopKeys.tsx";
import { focusStop } from "../cursor/useCursor.ts";
import { stopsOf } from "../cursor/stops.ts";
import { selectable } from "../Selection.tsx";
import { rangeOf } from "../spec/ledger/context.ts";
import type { useCommentDraft } from "../useCommentDraft.ts";

/** A selectable element's mark, `linesMark`'s: a decision's side, if any, then its lines. */
const MARK = /^(?:(.+?)( removed)?:)?(\d+)-(\d+)$/;

/**
 * The lines a block's toggle stands for, read from its element's mark: a block of the reviewed
 * file, under its heading, or a part of a decision's side, under its section's title.
 */
function rangeAt(
  toggle: HTMLElement,
  tree: Document,
  changes: ReadonlyArray<DecisionChange>,
): Range | undefined {
  const match = MARK.exec(toggle.closest("[data-lines]")?.getAttribute("data-lines") ?? "");
  if (!match) {
    return undefined;
  }
  const [, name, removed, first, last] = match;
  const start = Number(first);
  const end = Number(last);
  if (name === undefined) {
    const block = tree.blocks.find(
      (b) => selectable(b) && b.startLine === start && b.endLine === end,
    );
    return block && { end, heading: block.heading ?? "", start };
  }
  const isRemoved = removed !== undefined;
  return changes
    .filter((change) => change.name === name)
    .flatMap((change) => change.sections)
    .flatMap((section) => section.parts.map((part) => rangeOf(name, section.title, part)))
    .find(
      (range) =>
        range?.decision.removed === isRemoved && range.start === start && range.end === end,
    );
}

/**
 * The keys' range: where it started, the toggle it reached, the lines between, and the selection
 * before the keys stretched it, as a tap's with a form open on it, which dropping the range brings
 * back.
 */
type Stretched = { anchor: Range; before: Range | undefined; head: HTMLElement; range: Range };

/**
 * The keys' anchor and head over the comment being written, `draft`, among the blocks of `tree` and
 * the parts of the decisions it changes, `changes`. `stretch` moves the cursor to the next block
 * stop, 1, or the previous, -1, and sets the draft's range from the anchor to it, doing nothing past
 * the last or first block of the file: a range never spans two files. `drop` forgets the range and
 * gives the selection back what it was before the keys stretched it, none or a form's, saying
 * whether there was one. `rangeOf` is the range a held toggle asks about: the keys' it heads, else
 * the selection holding the toggle's lines, `own`, as a tap's.
 */
export function useKeyRange(
  draft: Pick<ReturnType<typeof useCommentDraft>, "draft" | "selection" | "stretch">,
  tree: Document,
  changes: ReadonlyArray<DecisionChange>,
) {
  const stretched = useRef<Stretched | null>(null);
  const opener = useHandBack(draft.draft !== undefined);
  // A range is the keys' while the yellow they set stays: a tap, a close, or a sent comment may
  // have changed it since.
  const current = () =>
    draft.selection !== undefined && stretched.current?.range === draft.selection
      ? stretched.current
      : null;

  const stretch = (direction: 1 | -1, toggle: HTMLElement) => {
    const held = current();
    const anchor = held?.head === toggle ? held.anchor : rangeAt(toggle, tree, changes);
    const blocks = stopsOf().filter((stop) => stop.dataset["stop"] === "block");
    const next = blocks[blocks.indexOf(toggle) + direction];
    const head = next && rangeAt(next, tree, changes);
    if (!anchor || !next || !head || !sameFile(anchor, head)) {
      return;
    }
    const range = spanned(anchor, head);
    const before = held === null ? draft.selection : held.before;
    stretched.current = { anchor, before, head: next, range };
    draft.stretch(range);
    focusStop(next, toggle);
  };

  const drop = () => {
    const held = current();
    stretched.current = null;
    if (held === null) {
      return false;
    }
    draft.stretch(held.before);
    return true;
  };

  const rangeOfToggle = (toggle: HTMLElement, own: Range) => {
    const held = current();
    if (held?.head === toggle) {
      return held.range;
    }
    const { selection } = draft;
    return selection !== undefined &&
      sameFile(selection, own) &&
      selection.start <= own.start &&
      own.end <= selection.end
      ? selection
      : undefined;
  };

  return { drop, opened: opener, rangeOf: rangeOfToggle, stretch };
}

/**
 * The block whose Enter opened the comment form, held, given the focus back, held, once the form
 * closes, by Ctrl+Enter, Add comment, or Cancel, so `j` goes on from it. Only while the last input
 * is a key and the focus fell to the page's body as the form went: a click elsewhere keeps its
 * focus, and a form a tap opened gives none back. `isOpen` says whether a form is open; the
 * returned function names the block as its Enter opens one.
 */
function useHandBack(isOpen: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    const closed = wasOpen.current && !isOpen;
    wasOpen.current = isOpen;
    const block = opener.current;
    if (!closed || block === null) {
      return;
    }
    opener.current = null;
    if (block.isConnected && isKeyInput() && isFocusLost()) {
      markByKey();
      block.focus({ preventScroll: true });
    }
  }, [isOpen]);
  return (block: HTMLElement) => {
    opener.current = block;
  };
}

/**
 * The keys of a held block or decision part, `toggle`, whose own lines are `own`: Enter taps it, so
 * the form opens under it on the range; `J` `K` and Shift with the arrows stretch the range; `s`
 * asks the agent about the range, or the selection holding the block, else the block, where the
 * page has `ask`; Escape drops a range,
 * and is the cursor's with none; `j` `k` and the arrows drop it and go on to move the cursor.
 */
export function blockKeys(
  keyRange: ReturnType<typeof useKeyRange>,
  toggle: HTMLElement,
  own: Range,
  ask: ((range: Range) => void) | undefined,
): ReadonlyArray<StopKey> {
  const down = () => keyRange.stretch(1, toggle);
  const up = () => keyRange.stretch(-1, toggle);
  const moveOn = (): false => {
    keyRange.drop();
    return false;
  };
  return [
    // The toggle's own click: a tap, merged into the range already selected.
    {
      bar: "⏎",
      keys: "Enter",
      label: "comment",
      run: () => {
        keyRange.opened(toggle);
        toggle.click();
      },
    },
    { bar: "J K", keys: "J", label: "range", run: down },
    { keys: "shift+ArrowDown", label: "range", run: down },
    { keys: "K", label: "range", run: up },
    { keys: "shift+ArrowUp", label: "range", run: up },
    ...(ask
      ? [
          {
            bar: "s",
            keys: "s",
            label: "ask",
            run: () => ask(keyRange.rangeOf(toggle, own) ?? own),
          },
        ]
      : []),
    { keys: "Escape", label: "drop the range", run: () => (keyRange.drop() ? undefined : false) },
    { keys: "j", label: "next stop", run: moveOn },
    { keys: "ArrowDown", label: "next stop", run: moveOn },
    { keys: "k", label: "previous stop", run: moveOn },
    { keys: "ArrowUp", label: "previous stop", run: moveOn },
  ];
}
