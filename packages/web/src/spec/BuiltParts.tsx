// "How it is built, and its limits": the parts after the stories, each drawn for what it holds. The
// architecture's units as small cards, then each tradeoff with a "Cost" pill; the edge cases by
// importance, the niche ones folded; each criterion's id and measure as pills before its sentence;
// the assumptions as their blocks. The core finds each part's items: the page draws them, and every
// item, row, and other block takes a comment as the spec's other blocks do.
import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import type { Block, Span } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Selectable } from "../Selection.tsx";
import { plain, Spans } from "../Spans.tsx";
import { Panel } from "./Panel.tsx";
import { BUILT_PARTS, GROUPS, type PartProps, partOf, type SpecItems } from "./parts.ts";

const styles = stylex.create({
  fold: {
    // The niche cases' toggle, at the reading size, its row a control's height for a finger.
    alignItems: "center",
    display: "flex",
    fontSize: "var(--text-reading-size)",
    minHeight: sizeVars["--size-element-md"],
  },
  list: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
  },
  pill: {
    // A pill keeps its width beside text of several lines.
    flexShrink: 0,
  },
  reading: {
    // The part's text at the reading size, as the spec's other blocks.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
  },
  row: {
    // A row of the part, set apart from the one before by a hairline.
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: spacingVars["--spacing-0-5"],
    paddingBlockStart: spacingVars["--spacing-3"],
  },
  unit: {
    // A unit's card fills its cell of the row, as tall as the tallest beside it.
    height: "100%",
  },
});

/** What the parts after the stories draw: the page's context, and the spec's items. */
export type BuiltPartsProps = PartProps & { items: SpecItems };

/** A part's section, as the core cuts it. */
type Part = SpecItems["parts"][number];

/** What a part's drawing takes: the spec's items, its section, and the page's context. */
type DrawingProps = { items: SpecItems; part: Part; props: PartProps };

/**
 * A part's blocks in their order: those `own` draws, its own way or as nothing for `null`, the
 * others as the spec's blocks, each run of them in one `Blocks`.
 */
function inOrder(
  part: Part,
  props: PartProps,
  own: (block: Block) => ReactNode | undefined,
): Array<ReactNode> {
  const nodes: Array<ReactNode> = [];
  let run: Array<number> = [];
  const flush = () => {
    if (run.length > 0) {
      nodes.push(
        <Blocks
          document={props.document}
          folds={props.folds}
          ids={run}
          key={`blocks-${run[0]}`}
          selection={props.selection}
        />,
      );
      run = [];
    }
  };
  for (const id of part.blocks) {
    const block = props.document.blocks[id];
    const drawn = block && own(block);
    if (drawn === undefined) {
      run.push(id);
    } else {
      flush();
      nodes.push(drawn);
    }
  }
  flush();
  return nodes;
}

/** The blocks among `ids` whose parent is `parent`, in their order. */
function childrenIn(props: PartProps, ids: ReadonlyArray<number>, parent: number) {
  return ids.flatMap((id) => {
    const block = props.document.blocks[id];
    return block && block.parent === parent ? [block] : [];
  });
}

/** The parents of the blocks `ids`. */
function parentsOf(props: PartProps, ids: ReadonlyArray<number>) {
  return new Set(ids.map((id) => props.document.blocks[id]?.parent));
}

/** Spans without the blanks they start with. */
function trimmed(spans: ReadonlyArray<Span>): Array<Span> {
  const [first, ...rest] = spans;
  if (!first) {
    return [];
  }
  const text = first.text.trimStart();
  return text === "" ? trimmed(rest) : [{ ...first, text }, ...rest];
}

/** The blocks nested in an item, like its sub-bullets, drawn as the spec's blocks. */
function Nested({ item, props }: { item: Block; props: PartProps }) {
  const ids = props.document.blocks.filter((b) => b.parent === item.id).map((b) => b.id);
  return (
    ids.length > 0 && <Blocks document={props.document} ids={ids} selection={props.selection} />
  );
}

/**
 * An item of a part's list the core does not classify, like one without a unit's bold name or a
 * criterion's id: drawn as the spec's other items, its text then its blocks, tappable.
 */
function Leftover({ item, props }: { item: Block; props: PartProps }) {
  return (
    <Selectable block={item} selection={props.selection}>
      <Blocks document={props.document} ids={[item.id]} selection={props.selection} />
    </Selectable>
  );
}

/** A list's items in runs, in their order: each run of those among `ours`, or of the others. */
function runsOf(props: PartProps, list: number, ours: ReadonlySet<number>) {
  const runs: Array<{ items: Array<Block>; ours: boolean }> = [];
  for (const item of props.document.blocks.filter((b) => b.parent === list)) {
    const mine = ours.has(item.id);
    const last = runs.at(-1);
    if (last?.ours === mine) {
      last.items.push(item);
    } else {
      runs.push({ items: [item], ours: mine });
    }
  }
  return runs;
}

/**
 * A unit of the architecture, a small card: its name, the bold spans it starts with, then what it
 * does, and the blocks nested in it.
 */
function Unit({ item, props }: { item: Block; props: PartProps }) {
  const at = item.spans.findIndex((span) => !span.strong);
  const name = at < 0 ? item.spans : item.spans.slice(0, at);
  const rest = at < 0 ? [] : item.spans.slice(at);
  return (
    <Card padding={3} role="listitem" variant="muted" xstyle={styles.unit}>
      <Selectable block={item} selection={props.selection}>
        <VStack gap={1}>
          <Text weight="semibold">
            <Spans spans={name} />
          </Text>
          <Text color="secondary" type="supporting">
            <Spans spans={trimmed(rest)} />
          </Text>
          <Nested item={item} props={props} />
        </VStack>
      </Selectable>
    </Card>
  );
}

/** A tradeoff of the architecture, after its "Cost" pill, then the blocks nested in it. */
function Cost({ item, props }: { item: Block; props: PartProps }) {
  return (
    <li>
      <HStack align="start" gap={2}>
        <Badge label="Cost" variant="warning" xstyle={styles.pill} />
        <Selectable block={item} selection={props.selection}>
          <Text display="block" type="inherit" xstyle={styles.reading}>
            <Spans spans={item.spans} />
          </Text>
          <Nested item={item} props={props} />
        </Selectable>
      </HStack>
    </li>
  );
}

/** A run of units, small cards in a row on a wide screen. */
function UnitGrid({ cards, props }: { cards: ReadonlyArray<Block>; props: PartProps }) {
  return (
    <Grid
      aria-label="Units"
      columns={props.wide ? Math.min(cards.length, 3) : 1}
      gap={3}
      role="list"
    >
      {cards.map((item) => (
        <Unit item={item} key={item.id} props={props} />
      ))}
    </Grid>
  );
}

/**
 * The architecture: its blocks in order, the units of its list drawn as small cards and its other
 * items as written, the paragraph "Tradeoffs:" giving way to each tradeoff with a "Cost" pill.
 */
function Architecture({ items, part, props }: DrawingProps) {
  const units = parentsOf(props, items.units);
  const tradeoffs = parentsOf(props, items.tradeoffs);
  // The paragraph "Tradeoffs:", right before their list, where the core cuts the units from them.
  const title = part.blocks[part.blocks.findIndex((id) => tradeoffs.has(id)) - 1];
  const ours = new Set(items.units);
  return inOrder(part, props, (block) => {
    if (units.has(block.id)) {
      return (
        <VStack gap={3} key={block.id}>
          {runsOf(props, block.id, ours).map((run) =>
            run.ours ? (
              <UnitGrid cards={run.items} key={run.items[0]!.id} props={props} />
            ) : (
              run.items.map((item) => <Leftover item={item} key={item.id} props={props} />)
            ),
          )}
        </VStack>
      );
    }
    if (tradeoffs.has(block.id)) {
      return (
        <VStack aria-label="Tradeoffs" as="ul" gap={2} key={block.id} xstyle={styles.list}>
          {childrenIn(props, items.tradeoffs, block.id).map((item) => (
            <Cost item={item} key={item.id} props={props} />
          ))}
        </VStack>
      );
    }
    return block.id === title ? null : undefined;
  });
}

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
    <li {...stylex.props(styles.row)}>
      <Selectable block={row} selection={props.selection}>
        <VStack gap={1} xstyle={styles.reading}>
          <HStack align="start" gap={2}>
            <Badge
              label={known?.label ?? plain(importance?.spans ?? [])}
              variant={known?.variant ?? "neutral"}
              xstyle={styles.pill}
            />
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
 * niche ones folded behind their count, open while the review shows something on one of them.
 */
function EdgeList({ edges, props }: { edges: ReadonlyArray<Edge>; props: PartProps }) {
  const [chosen, setChosen] = useState<boolean>();
  const rank = (edge: Edge) => IMPORTANCE[edge.importance]?.rank ?? 2;
  const sorted = [...edges].sort((a, b) => rank(a) - rank(b));
  const niche = sorted.filter((edge) => edge.importance === "niche");
  const isOpen = chosen ?? niche.some((edge) => isShown(props, props.document.blocks[edge.row]));
  return (
    <VStack gap={3}>
      <VStack as="ul" gap={3} xstyle={styles.list}>
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
            <span {...stylex.props(styles.fold)}>
              {niche.length === 1 ? "1 niche case" : `${niche.length} niche cases`}
            </span>
          }
        >
          <VStack as="ul" gap={3} xstyle={styles.list}>
            {niche.map((edge) => (
              <EdgeRow edge={edge} key={edge.row} props={props} />
            ))}
          </VStack>
        </Collapsible>
      )}
    </VStack>
  );
}

/** The edge cases: their table drawn as rows by importance, the part's other blocks as written. */
function EdgeCases({ items, part, props }: DrawingProps) {
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

/** A criterion: its id and measure as pills, then its sentence, as the core cuts it (R75). */
function Criterion({
  criterion,
  props,
}: {
  criterion: SpecItems["criteria"][number];
  props: PartProps;
}) {
  const item = props.document.blocks[criterion.block]!;
  return (
    <li {...stylex.props(styles.row)}>
      <Selectable block={item} selection={props.selection}>
        <HStack align="start" gap={2}>
          <Icon color="success" icon="check" size="md" />
          <VStack gap={1}>
            <HStack align="center" gap={2} wrap="wrap">
              <Badge label={criterion.id} variant="neutral" />
              {criterion.measure != null && <Badge label={criterion.measure} variant="info" />}
            </HStack>
            <Text display="block" type="inherit" xstyle={styles.reading}>
              <Spans spans={criterion.sentence} />
            </Text>
            <Nested item={item} props={props} />
          </VStack>
        </HStack>
      </Selectable>
    </li>
  );
}

/**
 * The success criteria: their list drawn as rows, its items without an id as written, and the
 * part's other blocks as written.
 */
function Criteria({ items, part, props }: DrawingProps) {
  const byBlock = new Map(items.criteria.map((c) => [c.block, c]));
  const lists = parentsOf(props, [...byBlock.keys()]);
  return inOrder(part, props, (block) =>
    lists.has(block.id) ? (
      <VStack as="ul" gap={3} key={block.id} xstyle={styles.list}>
        {props.document.blocks
          .filter((item) => item.parent === block.id)
          .map((item) => {
            const criterion = byBlock.get(item.id);
            return criterion ? (
              <Criterion criterion={criterion} key={item.id} props={props} />
            ) : (
              <li key={item.id} {...stylex.props(styles.row)}>
                <Leftover item={item} props={props} />
              </li>
            );
          })}
      </VStack>
    ) : undefined,
  );
}

/** Each part after the stories, by its section's title, drawn its own way. */
const DRAWINGS: Record<string, (args: DrawingProps) => ReactNode> = {
  Architecture,
  Assumptions: ({ part, props }) => inOrder(part, props, () => undefined),
  "Edge cases": EdgeCases,
  "Success criteria": Criteria,
};

/**
 * The architecture, the edge cases, the success criteria, and the assumptions, in this order, each
 * a card whose id is its section's anchor; a section the spec lacks has none.
 */
export function BuiltParts({ items, ...props }: BuiltPartsProps) {
  return BUILT_PARTS.map((title) => {
    const part = partOf(items, title);
    const Drawing = DRAWINGS[title];
    return (
      part &&
      Drawing && (
        <Panel crumbs={[GROUPS.built.title]} id={part.anchor} key={part.anchor} title={part.title}>
          <Drawing items={items} part={part} props={props} />
        </Panel>
      )
    );
  });
}
