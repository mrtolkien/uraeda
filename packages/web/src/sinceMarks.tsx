// The Δ marks of a spec's blocks changed since your review: the page provides which blocks hold a
// change (`spec/SinceReview.tsx`), and every selectable block, wherever it is drawn, reads its own
// here. A marked block reads "Δ Changed since your review" above it, with a bar down its side; a
// changed one's words are drawn by the ledger's runs, added ones underlined, removed ones struck.
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { createContext, type ReactNode, use, useId } from "react";
import type { Block, SinceChange } from "uraeda-binding";
import { Paragraph } from "./layout/Paragraph.tsx";
import { useScrollMargin } from "./layout/scrollMargin.ts";
import { Runs } from "./spec/RuleLine.tsx";

/** A block's mark: its change, and its element's id when a place's jump lands on it. */
export type SinceMark = { change: SinceChange; id?: string };

/** The marks of the page's blocks, by block id: none outside a revised spec. */
export const SinceMarks = createContext<ReadonlyMap<number, SinceMark>>(new Map());

const styles = stylex.create({
  label: {
    color: colorVars["--color-text-yellow"],
    display: "block",
    fontWeight: fontWeightVars["--font-weight-bold"],
    // Focused by a jump from "Since your review", without a ring: the jump shows where it went.
    outlineStyle: { ":focus:not(:focus-visible)": "none", default: null },
  },
  marked: {
    borderInlineStartColor: colorVars["--color-border-yellow"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-0-5"],
    paddingInlineStart: spacingVars["--spacing-2"],
  },
  sign: {
    color: colorVars["--color-text-yellow"],
    fontWeight: fontWeightVars["--font-weight-bold"],
  },
  words: { margin: 0 },
});

/** The mark of a block, by its id, if it changed since your review. */
export function useSinceMark(block: number): SinceMark | undefined {
  return use(SinceMarks).get(block);
}

/**
 * A marked block: "Δ Changed since your review" above its drawing, a group named so. A jump to the
 * mark's id focuses its label, `<id>-title`.
 */
export function SinceMarked({ children, mark }: { children: ReactNode; mark: SinceMark }) {
  const own = useId();
  const labelId = mark.id ? `${mark.id}-title` : own;
  const margin = useScrollMargin();
  return (
    <div
      aria-labelledby={labelId}
      id={mark.id}
      role="group"
      {...stylex.props(styles.marked, margin)}
    >
      <span {...stylex.props(styles.label)}>
        <span aria-hidden="true">Δ </span>
        <span id={labelId} tabIndex={mark.id ? -1 : undefined}>
          Changed since your review
        </span>
      </span>
      {children}
    </div>
  );
}

/**
 * A block's words: its change's runs when it changed since your review, else `children`; in a
 * paragraph of their own, `isParagraph`, where `children` are not words but a layout of them.
 */
export function SinceWords({
  block,
  children,
  isParagraph = false,
}: {
  block: Block;
  children: ReactNode;
  isParagraph?: boolean;
}) {
  const mark = useSinceMark(block.id);
  if (mark?.change.kind !== "changed") {
    return children;
  }
  const runs = <Runs runs={mark.change.runs} />;
  return isParagraph ? <Paragraph xstyle={styles.words}>{runs}</Paragraph> : runs;
}

/**
 * The Δ after the name of what holds a part changed since your review, like a row of "Contents" or
 * a story renamed, read "changed since your review".
 */
export function SinceSign() {
  return (
    <>
      {" "}
      <span aria-hidden="true" {...stylex.props(styles.sign)}>
        Δ
      </span>
      <VisuallyHidden>, changed since your review</VisuallyHidden>
    </>
  );
}
