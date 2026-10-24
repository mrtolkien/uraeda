// The Δ marks of a spec's blocks changed since your review: the page provides which blocks hold a
// change (`spec/SinceReview.tsx`), and every selectable block, wherever it is drawn, reads its own
// here. A marked block reads "Δ Changed since your review" above it, with a bar down its side; a
// changed one's words are drawn by the ledger's runs, added ones underlined, removed ones struck.
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { createContext, type ReactNode, use, useId } from "react";
import type { Block, Document, Run, SinceChange } from "uraeda-binding";
import { Paragraph } from "./layout/Paragraph.tsx";
import { useScrollMargin } from "./layout/scrollMargin.ts";
import { Runs } from "./spec/RuleLine.tsx";

/** A block's mark: its change, and its element's id when a place's jump lands on it. */
export type SinceMark = { change: SinceChange; id?: string };

/**
 * The marks of a document's blocks, by block id: a block id is an index in its own document, so
 * only the blocks of `document` are marked, not those of another drawn under the same page, like
 * the spec's data model.
 */
export type SinceScope = {
  document: Document | undefined;
  marks: ReadonlyMap<number, SinceMark>;
  /** The element ids of the panes and groups whose title, their heading, changed. */
  titles: ReadonlySet<string>;
};

/** No block marked: outside a revised spec, or under another document than its. */
export const NO_SINCE: SinceScope = { document: undefined, marks: new Map(), titles: new Set() };

/** The marks of the page's document, the revised spec's. */
export const SinceMarks = createContext<SinceScope>(NO_SINCE);

const styles = stylex.create({
  label: {
    color: colorVars["--color-text-yellow"],
    display: "block",
    fontWeight: fontWeightVars["--font-weight-bold"],
    // Focused by a jump from "Since your review", without a ring: the jump shows where it went.
    outlineStyle: { ":focus:not(:focus-visible)": "none", default: null },
  },
  // A row's sign, focused by a jump, without a ring.
  focus: { outlineStyle: { ":focus:not(:focus-visible)": "none", default: null } },
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
  return use(SinceMarks).marks.get(block);
}

/** Whether the title of the pane or group `id`, its heading, changed since your review. */
export function useSinceTitle(id: string | undefined): boolean {
  const { titles } = use(SinceMarks);
  return id !== undefined && titles.has(id);
}

/** `children`, drawing `document`'s blocks: without marks, when the marks are another's. */
export function SinceScoped({ children, document }: { children: ReactNode; document: Document }) {
  const scope = use(SinceMarks);
  return scope.document === undefined || scope.document === document ? (
    children
  ) : (
    <SinceMarks value={NO_SINCE}>{children}</SinceMarks>
  );
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

/** A block's drawing, `children`, marked when it changed since your review. */
export function SinceBlock({ block, children }: { block: Block; children: ReactNode }) {
  const mark = useSinceMark(block.id);
  return mark ? <SinceMarked mark={mark}>{children}</SinceMarked> : children;
}

/**
 * The mark of a table's row, before its first cell's words: a row cannot hold the label above it.
 * A jump to the mark's id lands on it, and focuses it.
 */
export function SinceRowSign({ mark }: { mark: SinceMark }) {
  return (
    <span id={mark.id} {...stylex.props(styles.sign, useScrollMargin())}>
      <span
        id={mark.id && `${mark.id}-title`}
        tabIndex={mark.id ? -1 : undefined}
        {...stylex.props(styles.focus)}
      >
        <span aria-hidden="true">Δ</span>
        <VisuallyHidden>Changed since your review</VisuallyHidden>
      </span>{" "}
    </span>
  );
}

/**
 * The runs of a table row's change, cell by cell: the core joins the cells' words with "|". None
 * when a "|" was added or removed, the cells then not matching the row's.
 */
export function cellRuns(runs: ReadonlyArray<Run>): Array<Array<Run>> | undefined {
  const cells: Array<Array<Run>> = [[]];
  for (const run of runs) {
    let words: Array<string> = [];
    const flush = () => {
      if (words.length > 0) {
        cells.at(-1)!.push({ kind: run.kind, text: words.join(" ") });
        words = [];
      }
    };
    for (const word of run.text.split(" ")) {
      if (word !== "|") {
        words.push(word);
      } else if (run.kind === "kept") {
        flush();
        cells.push([]);
      } else {
        return undefined;
      }
    }
    flush();
  }
  return cells;
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
