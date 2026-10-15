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
 * A spec's folds, as the core finds them: each story's scenarios, keyed by the story's id, then
 * the Details section.
 */
export function specFolds(spec: Pick<SpecItems, "details" | "stories">): Array<Fold> {
  const folds: Array<Fold> = spec.stories
    .filter((story) => story.details.length > 0)
    .map((story) => ({
      ids: story.details,
      key: story.id,
      label: `Scenarios (${story.scenarios.length})`,
    }));
  if (spec.details.length > 0) {
    folds.push({ ids: spec.details, key: "details", label: "Details" });
  }
  return folds;
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
 * per visit of the address, so the fold can be closed again. Not where Back, or a reload, returns
 * to an entry with a saved position: its folds are as the human left them, the hash's own closed
 * again maybe.
 */
export function useHashFold(document: Document, folds: Folds | undefined) {
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
  useLayoutEffect(() => {
    if (!folds || !target || handled.current === visit) {
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
  }, [folds, hash, target, visit]);
}

/** Scrolls to an element, a little below the top, or the top bar, where it stays on the phone. */
function scrollBelowBar(element: HTMLElement) {
  element.scrollIntoView({ block: "start" });
  const bar = window.document.querySelector('[role="banner"]')?.getBoundingClientRect();
  window.scrollBy(0, -Math.max(bar?.bottom ?? 0, 0) - 16);
}

/**
 * Scrolls to the element of a block, by its id, a little below the top bar: when the block is in a
 * closed fold, once the fold it opens shows it.
 */
export function useRevealBlock(document: Document, folds: Folds | undefined) {
  // The element to scroll to once its fold opened, written by the click that opens it.
  const pending = useRef<string>(undefined);
  useLayoutEffect(() => {
    const element = pending.current && window.document.getElementById(pending.current);
    if (element) {
      pending.current = undefined;
      scrollBelowBar(element);
    }
  });
  return (block: Block | undefined, id: string) => {
    const fold = folds && foldOf(document, folds.list, block);
    if (fold && !folds.open.includes(fold.key)) {
      pending.current = id;
      folds.onOpenChange(fold.key, true);
      return;
    }
    const element = window.document.getElementById(id);
    if (element) {
      scrollBelowBar(element);
    }
  };
}

/**
 * A fold: its toggle, named by its label, in place of its first block, its `title`, like the
 * scenarios' intro or the Details heading, whose anchor it takes; then what it holds, drawn while
 * it is open.
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
