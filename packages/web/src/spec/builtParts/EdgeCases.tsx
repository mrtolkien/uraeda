// The edge cases: their table drawn as rows by importance, the niche ones folded behind their
// count, not mounted while folded, the part's other blocks as written.
import { Badge } from "@astryxdesign/core/Badge";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { Block } from "uraeda-binding";
import { Selectable } from "../../Selection.tsx";
import { plain, Spans } from "../../Spans.tsx";
import type { PartProps, SpecItems } from "../parts.ts";
import { builtStyles, type DrawingProps, inOrder, parentsOf } from "./shared.tsx";

/** Each importance the format knows: its pill, and its rank, the most important first. */
const IMPORTANCE: Record<string, { label: string; rank: number; variant: "neutral" | "warning" }> =
  {
    high: { label: "High", rank: 0, variant: "warning" },
    niche: { label: "Niche", rank: 3, variant: "neutral" },
    normal: { label: "Normal", rank: 1, variant: "neutral" },
  };

/** An edge case of the core, its row and its importance. */
type Edge = SpecItems["edges"][number];

/** An edge case: its importance as a pill, its situation, then what happens. */
function EdgeRow({ edge, props }: { edge: Edge; props: PartProps }) {
  const row = props.document.blocks[edge.row]!;
  const [importance, situation, ...outcome] = props.document.blocks.filter(
    (b) => b.parent === row.id,
  );
  const known = IMPORTANCE[edge.importance];
  return (
    <li {...stylex.props(builtStyles.row)}>
      <Selectable block={row} selection={props.selection}>
        <VStack gap={1} xstyle={builtStyles.reading}>
          <HStack align="start" gap={2}>
            <span {...stylex.props(builtStyles.pill)}>
              <Badge
                label={known?.label ?? plain(importance?.spans ?? [])}
                variant={known?.variant ?? "neutral"}
              />
            </span>
            <Text type="inherit" weight="semibold">
              <Spans spans={situation?.spans ?? []} />
            </Text>
          </HStack>
          {outcome.map((cell) => (
            <Text display="block" key={cell.id} type="inherit">
              <Spans spans={cell.spans} />
            </Text>
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
        <Collapsible
          chevronPosition="start"
          isOpen={isOpen}
          onOpenChange={setChosen}
          trigger={
            <span {...stylex.props(builtStyles.fold)}>
              {niche.length === 1 ? "1 niche case" : `${niche.length} niche cases`}
            </span>
          }
        >
          {isOpen && (
            <VStack as="ul" gap={3} xstyle={builtStyles.list}>
              {niche.map((edge) => (
                <EdgeRow edge={edge} key={edge.row} props={props} />
              ))}
            </VStack>
          )}
        </Collapsible>
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
