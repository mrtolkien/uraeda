import { Collapsible } from "@astryxdesign/core/Collapsible";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import type { Block, Document, SpecItems } from "uraeda-binding";
import { currentEntry, useEntryId, useHash } from "./routes.tsx";

const styles = stylex.create({
  fold: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  foldBody: {
    // What a fold holds, at the reading size, which Astryx's content area sets to the body's.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    paddingBlockStart: spacingVars["--spacing-2"],
  },
  foldLabel: {
    // A fold's label, at the reading size, its row a control's height for a finger.
    alignItems: "center",
    display: "flex",
    fontSize: "var(--text-reading-size)",
    minHeight: sizeVars["--size-element-md"],
  },
});

/** Top-level blocks drawn folded, behind a toggle named by `label`, open when `key` is. */
export type Fold = { ids: ReadonlyArray<number>; key: string; label: string };

/** A document's folds, the open ones' keys, and how to open or close one. */
export type Folds = {
  list: ReadonlyArray<Fold>;
  onOpenChange: (key: string, isOpen: boolean) => void;
  open: ReadonlyArray<string>;
};

/**
 * A spec's folds, as the core finds them: each story's more scenarios, keyed by the story's id,
 * their paragraph "More scenarios:" and their list.
 */
export function specFolds(spec: Pick<SpecItems, "stories">): Array<Fold> {
  return spec.stories.flatMap((story) =>
    story.moreBlocks.length === 0
      ? []
      : [
          {
            ids: story.moreBlocks,
            key: story.id,
            label: `More scenarios (${story.more.length})`,
          },
        ],
  );
}

/** The top-level block a block lies in, itself when it is one. */
export function topBlock(document: Document, block: Block | undefined) {
  let top = block;
  while (top?.parent !== undefined) {
    top = document.blocks[top.parent];
  }
  return top;
}

/** The fold holding a block, at any depth, if any. */
export function foldOf(document: Document, folds: ReadonlyArray<Fold>, block: Block | undefined) {
  const id = topBlock(document, block)?.id;
  return id === undefined ? undefined : folds.find((fold) => fold.ids.includes(id));
}

/** The anchor a location's hash names, as it is written when it is not a valid escape. */
function anchorOf(hash: string): string {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

/**
 * Opens the fold holding the block the location's hash names, and scrolls to it once open: once
 * per visit of the address, so the fold can be closed again. With `anywhere`, the element the hash
 * names outside any fold is scrolled to as well, once it is drawn, and kept in place while what is
 * above it settles. Not where Back, or a reload, returns to an entry with a saved position: its
 * folds are as the human left them, the hash's own closed again maybe.
 */
export function useHashFold(document: Document, folds: Folds | undefined, anywhere = false) {
  const hash = anchorOf(useHash());
  // Handled per visit: a link to the same address is a new one, with a new history entry.
  const visit = `${useEntryId()}${hash}`;
  const handled = useRef<string>(undefined);
  const list = folds?.list;
  const target = useMemo(
    () =>
      hash && list
        ? foldOf(
            document,
            list,
            document.blocks.find((b) => b.anchor === hash),
          )
        : undefined,
    [document, list, hash],
  );
  const settling = useRef<() => void>(undefined);
  useLayoutEffect(() => () => settling.current?.(), []);
  useLayoutEffect(() => {
    if (!hash || handled.current === visit) {
      return;
    }
    if (!folds || !target) {
      const element = anywhere ? window.document.getElementById(hash) : null;
      if (element && typeof currentEntry().scroll !== "number") {
        settling.current = revealBelowBar(element);
      }
      handled.current = element ? visit : handled.current;
      return;
    }
    if (typeof currentEntry().scroll === "number") {
      handled.current = visit;
      return;
    }
    if (!folds.open.includes(target.key)) {
      folds.onOpenChange(target.key, true);
      return;
    }
    handled.current = visit;
    const element = window.document.getElementById(hash);
    if (element) {
      scrollBelowBar(element);
    }
    // Again once the page draws what the hash names: `document` changes as it loads.
  }, [anywhere, document, folds, hash, target, visit]);
}

/** Scrolls to an element, a little below the top, or the top bar, where it stays on the phone. */
function scrollBelowBar(element: HTMLElement) {
  element.scrollIntoView({ block: "start" });
  const bar = window.document.querySelector('[role="banner"]')?.getBoundingClientRect();
  window.scrollBy(0, -Math.max(bar?.bottom ?? 0, 0) - 16);
}

/** How long a revealed element is kept in place while what is above it settles, as embeds load. */
const SETTLE_MS = 3000;

/** What the human does to scroll: any of it ends the keeping in place. */
const OWN_SCROLL = ["keydown", "pointerdown", "touchstart", "wheel"] as const;

/**
 * Scrolls to an element below the top bar, and again each time the page's size changes for a few
 * seconds, as the embeds above it draw their stories, until the human scrolls. Returns what stops
 * it early.
 */
function revealBelowBar(element: HTMLElement): () => void {
  scrollBelowBar(element);
  if (typeof ResizeObserver === "undefined") {
    return () => {};
  }
  const observer = new ResizeObserver(() => scrollBelowBar(element));
  observer.observe(window.document.body);
  const stop = () => {
    observer.disconnect();
    clearTimeout(timer);
    for (const type of OWN_SCROLL) {
      window.removeEventListener(type, stop);
    }
  };
  const timer = setTimeout(stop, SETTLE_MS);
  for (const type of OWN_SCROLL) {
    window.addEventListener(type, stop, { passive: true });
  }
  return stop;
}

/**
 * Scrolls to the element of a block, by its id, a little below the top bar, and keeps it there
 * while what is above it settles: when the block is in a closed fold, once the fold it opens shows
 * it.
 */
export function useRevealBlock(document: Document, folds: Folds | undefined) {
  // The element to scroll to once its fold opened, written by the click that opens it: read by the
  // next drawing alone, so a fold that did not show it never scrolls the page later.
  const pending = useRef<string>(undefined);
  const settling = useRef<() => void>(undefined);
  const reveal = (element: HTMLElement) => {
    settling.current?.();
    settling.current = revealBelowBar(element);
  };
  useLayoutEffect(() => {
    const id = pending.current;
    pending.current = undefined;
    const element = id && window.document.getElementById(id);
    if (element) {
      reveal(element);
    }
  });
  useLayoutEffect(() => () => settling.current?.(), []);
  return (block: Block | undefined, id: string) => {
    const fold = folds && foldOf(document, folds.list, block);
    if (fold && !folds.open.includes(fold.key)) {
      pending.current = id;
      folds.onOpenChange(fold.key, true);
      return;
    }
    const element = window.document.getElementById(id);
    if (element) {
      reveal(element);
    }
  };
}

/**
 * A fold: its toggle, named by its label, in place of its first block, its `title`, like the
 * paragraph "More scenarios:", whose anchor it takes; then what it holds, drawn while it is open.
 */
export function FoldNode({
  children,
  fold,
  folds,
  title,
}: {
  children: ReactNode;
  fold: Fold;
  folds: Folds;
  title: Block | undefined;
}) {
  return (
    <div id={title?.anchor} {...stylex.props(styles.fold)}>
      <Collapsible
        chevronPosition="start"
        isOpen={folds.open.includes(fold.key)}
        onOpenChange={(isOpen: boolean) => folds.onOpenChange(fold.key, isOpen)}
        trigger={<span {...stylex.props(styles.foldLabel)}>{fold.label}</span>}
      >
        <div {...stylex.props(styles.foldBody)}>{children}</div>
      </Collapsible>
    </div>
  );
}
