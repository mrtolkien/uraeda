// The rows of a page's outline, the one drawing of the parts a document holds, in the round's
// Outline and in the spec's and the plan's Contents: each row's text wrapping, nested rows indented,
// a done or open state as ✓ or ○, a mark for its kind of part, its pending comments, and Δ for a
// part changed since your review; the part at the top marked; runs of rows apart by a divider.
import { Badge } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { MouseEvent } from "react";
import { SinceSign } from "../sinceMarks.tsx";
import { CommentCount } from "../spec/CommentCount.tsx";

const styles = stylex.create({
  label: {
    // A row's text wraps: no title is cut.
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
  mark: {
    // The marks line up in one column, whatever their glyph's width.
    display: "inline-block",
    textAlign: "center",
    width: spacingVars["--spacing-3"],
  },
  nested: { paddingInlineStart: spacingVars["--spacing-4"] },
});

/** A row of an outline: the part it brings to the top, by its id on the page, and how it reads. */
export type OutlineRow = {
  /** The pending comments on its part, a badge after its text when any. */
  count?: number;
  id: string;
  label: string;
  /** Before the label: what kind of part it is, like "⚑" for the points to check. */
  mark?: string;
  /** Under the row before it, indented: a decision under its group, a follow-up under its question. */
  nested: boolean;
  /** Whether its part holds a change since your review, marked Δ. */
  since?: boolean;
  /** A question answered or a task's steps all checked, `done`, ✓; else `open`, ○. */
  state?: "done" | "open";
  /** The mark's colour, secondary otherwise. */
  tone?: "warning";
};

/** The words a screen reader hears after a row's state: "answered", or "unanswered". */
export type StateNames = Record<NonNullable<OutlineRow["state"]>, string>;

/** A row's text: its state's glyph, its label, its Δ, and its comments' count. */
function Label({ row, stateNames }: { row: OutlineRow; stateNames: StateNames }) {
  return (
    <span {...stylex.props(styles.label)}>
      {row.state && <span aria-hidden>{row.state === "done" ? "✓ " : "○ "}</span>}
      {row.label}
      {row.state && <VisuallyHidden> ({stateNames[row.state]})</VisuallyHidden>}
      {row.since && <SinceSign />}
      {(row.count ?? 0) > 0 && (
        <>
          {" "}
          <Badge label={<CommentCount count={row.count!} />} variant="warning" />
        </>
      )}
    </span>
  );
}

/**
 * A plain click on a row's link, `#<id>`, brings its part to the top through `onPick`, rather than
 * the hash: an Astryx list item's link never calls the item's `onClick`. A link opened in a new tab
 * or window, or with another button, is the browser's.
 */
function pickLink(event: MouseEvent, onPick: (id: string) => void) {
  const link = (event.target as Element).closest("a[href^='#']");
  const plain =
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  if (link && plain) {
    event.preventDefault();
    onPick(link.getAttribute("href")!.slice(1));
  }
}

/**
 * The outline's runs of rows, `current`'s marked, a divider between runs. A row brings its part to
 * the top through `onPick`. With `asLinks`, each row is a link to its part's `#id`, which a
 * modifier click opens as the browser does; else a button. `label` names the lists.
 */
export function OutlineRows({
  asLinks = false,
  current,
  label,
  onPick,
  runs,
  stateNames = { done: "done", open: "not done" },
}: {
  asLinks?: boolean;
  current: string | undefined;
  label?: string;
  onPick: (id: string) => void;
  runs: ReadonlyArray<ReadonlyArray<OutlineRow>>;
  stateNames?: StateNames;
}) {
  const lists = runs.map((run, index) => (
    <VStack gap={2} key={run[0]?.id ?? index}>
      {index > 0 && <Divider />}
      <List aria-label={label} density="compact">
        {run.map((row) => (
          <ListItem
            {...(asLinks ? { href: `#${row.id}` } : { onClick: () => onPick(row.id) })}
            isSelected={row.id === current}
            key={row.id}
            label={<Label row={row} stateNames={stateNames} />}
            {...(row.mark
              ? {
                  startContent: (
                    <Text aria-hidden color={row.tone ?? "secondary"} xstyle={styles.mark}>
                      {row.mark}
                    </Text>
                  ),
                }
              : {})}
            xstyle={row.nested ? styles.nested : undefined}
          />
        ))}
      </List>
    </VStack>
  ));
  return asLinks ? (
    <div onClickCapture={(event) => pickLink(event, onPick)}>{lists}</div>
  ) : (
    <>{lists}</>
  );
}
