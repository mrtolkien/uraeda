// The edge cases: their table drawn as rows by importance, each its situation, then what happens
// after an arrow, the niche ones folded behind their count, not mounted while folded, the part's
// other blocks as written.
import { Icon } from "@astryxdesign/core/Icon";
import { fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { Block } from "uraeda-binding";
import { Selectable } from "../../Selection.tsx";
import { cellRuns, keepsSpans, useSinceMark } from "../../sinceMarks.tsx";
import { proseStyles } from "../../Prose.tsx";
import { Spans } from "../../Spans.tsx";
import type { PartProps, SpecItems } from "../parts.ts";
import { Runs } from "../RuleLine.tsx";
import { builtStyles, type DrawingProps, inOrder, parentsOf } from "./shared.tsx";
import { plural } from "../../labels.ts";
import { Foldable } from "../../layout/Foldable.tsx";
import { ruleStyles } from "../../layout/rules.ts";

/** Each importance the format knows, by its rank, the most important first. */
const IMPORTANCE: Record<string, { rank: number }> = {
  high: { rank: 0 },
  niche: { rank: 3 },
  normal: { rank: 1 },
};

const styles = stylex.create({
  // A line of the case: its sign in a column of its own, centred on its first line, then its text.
  line: {
    columnGap: spacingVars["--spacing-2"],
    display: "grid",
    gridTemplateColumns: "1.25em minmax(0, 1fr)",
  },
  // The sign, one line tall, centred on it: one line's height, a unit of the layout, not a token,
  // which the token lint takes in a custom property.
  sign: { "--edge-line": "1lh", alignItems: "center", display: "flex", height: "var(--edge-line)" },
  situation: { fontWeight: fontWeightVars["--font-weight-semibold"] },
});

/** An edge case of the core, its row and its importance. */
type Edge = SpecItems["edges"][number];

/**
 * An edge case: its situation, a warning before it when it matters most, then each thing that
 * happens after an arrow, under it, so it reads "this, then that".
 */
function EdgeRow({ edge, props }: { edge: Edge; props: PartProps }) {
  const row = props.document.blocks[edge.row]!;
  const [, situation, ...outcome] = props.document.blocks.filter((b) => b.parent === row.id);
  // Changed since your review: each cell's words as runs, if the cells match the row's.
  const mark = useSinceMark(row.id);
  const runs = mark?.change.kind === "changed" ? cellRuns(mark.change.runs) : undefined;
  const words = runs?.length === outcome.length + 2 ? runs : undefined;
  const cell = (index: number, spans: Block["spans"]) =>
    words && !keepsSpans(spans) ? <Runs runs={words[index]!} /> : <Spans spans={spans} />;
  return (
    <li {...stylex.props(ruleStyles.between, builtStyles.row)}>
      <Selectable block={row} selection={props.selection}>
        <VStack gap={1} xstyle={proseStyles.reading}>
          <div {...stylex.props(styles.line, styles.situation)}>
            <span {...stylex.props(styles.sign)}>
              {edge.importance === "high" && (
                <Icon color="warning" icon="uraeda:triangle-alert" label="High" size="sm" />
              )}
            </span>
            <span>{cell(1, situation?.spans ?? [])}</span>
          </div>
          {outcome.map((block, index) => (
            <div key={block.id} {...stylex.props(styles.line)}>
              <span aria-hidden="true" {...stylex.props(styles.sign)}>
                <Icon color="secondary" icon="uraeda:arrow-right" size="sm" />
              </span>
              <span>{cell(index + 2, block.spans)}</span>
            </div>
          ))}
        </VStack>
      </Selectable>
    </li>
  );
}

/**
 * Whether the review shows something on a row: a pending comment under it, or the selection, so
 * its fold opens.
 */
function isShown(props: PartProps, row: Block | undefined) {
  return (
    !!row &&
    (props.selection?.isSelected(row) === true ||
      props.comments.some(
        (c) =>
          !c.general &&
          c.decision == null &&
          c.endLine >= row.startLine &&
          c.endLine <= row.endLine,
      ))
  );
}

/**
 * The edge cases, high first, then normal, then any other, in the file's order within each; the
 * niche ones folded behind their count, open by hand or while the review shows something on one
 * of them, and not mounted while folded.
 */
function EdgeList({ edges, props }: { edges: ReadonlyArray<Edge>; props: PartProps }) {
  const [chosen, setChosen] = useState(false);
  const rank = (edge: Edge) => IMPORTANCE[edge.importance]?.rank ?? 2;
  const sorted = [...edges].sort((a, b) => rank(a) - rank(b));
  const niche = sorted.filter((edge) => edge.importance === "niche");
  // Open by hand, or while the review shows something in it: a comment, new or old, keeps it open.
  const isOpen = chosen || niche.some((edge) => isShown(props, props.document.blocks[edge.row]));
  return (
    <VStack gap={3}>
      <VStack as="ul" gap={3} xstyle={builtStyles.list}>
        {sorted
          .filter((edge) => edge.importance !== "niche")
          .map((edge) => (
            <EdgeRow edge={edge} key={edge.row} props={props} />
          ))}
      </VStack>
      {niche.length > 0 && (
        <Foldable
          isOpen={isOpen}
          label={plural(niche.length, "niche case")}
          onOpenChange={setChosen}
        >
          <VStack as="ul" gap={3} xstyle={builtStyles.list}>
            {niche.map((edge) => (
              <EdgeRow edge={edge} key={edge.row} props={props} />
            ))}
          </VStack>
        </Foldable>
      )}
    </VStack>
  );
}

/** The edge cases: their table drawn as rows by importance, the part's other blocks as written. */
export function EdgeCases({ items, part, props }: DrawingProps) {
  const tables = parentsOf(
    props,
    items.edges.map((edge) => edge.row),
  );
  return inOrder(part, props, (block) =>
    tables.has(block.id) ? (
      <EdgeList
        edges={items.edges.filter((edge) => props.document.blocks[edge.row]?.parent === block.id)}
        key={block.id}
        props={props}
      />
    ) : undefined,
  );
}
