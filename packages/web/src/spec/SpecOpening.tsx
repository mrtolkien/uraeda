// "What you approve", the spec page's first part: a pane titled by the block's first line, its
// record or request, the "You approve" item as the page's lead, the block's other items as a list,
// each its label first, as a round's first pane reads, the text before the first section, then, at the pane's foot under a separator (C1), the time and the risk
// tier as pills, the constitution's principles as a strip of pills, and the risk tier's reason.
// Each item and paragraph takes a comment as the spec's other blocks do, and the strip as its
// table's row of checks, marked Δ as it when it changed since your review.
import { Badge } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { markVars } from "../marks.stylex.ts";
import type { Block, Document, Span } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Pane } from "../layout/Pane.tsx";
import { proseStyles } from "../Prose.tsx";
import { After, Selectable, type Selection } from "../Selection.tsx";
import { cellRuns, type SinceMark, SinceMarked, SinceSign, useSinceMark } from "../sinceMarks.tsx";
import { plain, Spans } from "../Spans.tsx";
import { GROUPS, type PartProps, partOf, type SpecItems } from "./parts.ts";

const styles = stylex.create({
  item: {
    // An item of the block's list: its marker in the secondary colour, room under it but the last.
    "::marker": { color: colorVars["--color-text-secondary"] },
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-2"] },
  },
  // An item's label, up to its colon, as "New decision:": heavier, read first.
  label: { fontWeight: fontWeightVars["--font-weight-medium"] },
  lead: {
    // What you approve, in one sentence: the pane's lead, heavier and a little larger than the
    // items, in the reading font as they are.
    // Its size, a custom property, as the token lint takes a `var()` only whole, not in a calc.
    "--opening-lead-size": "calc(1.1 * var(--text-reading-size))",
    fontSize: "var(--opening-lead-size)",
    fontWeight: fontWeightVars["--font-weight-semibold"],
    margin: 0,
  },
  list: {
    listStylePosition: "outside",
    listStyleType: "disc",
    margin: 0,
    // The markers' room.
    paddingInlineStart: markVars["--mark-list-room"],
  },
  section: {
    // A section of the spec drawn in this part, its anchor's element, its pieces spaced as the
    // part's.
    display: "flex",
    flexDirection: "column",
    rowGap: spacingVars["--spacing-3"],
  },
});

/** The tiers' badges, from the least risk to the most. */
const TIERS: Record<string, "error" | "neutral" | "warning"> = {
  high: "error",
  low: "neutral",
  medium: "warning",
};

/** The children of a block, in order; the top-level blocks for `null`, none for `undefined`. */
function childrenOf(document: Document, id: number | null | undefined): Array<Block> {
  // The server sends a top-level block's absent parent as `null`.
  return id === undefined ? [] : document.blocks.filter((b) => (b.parent ?? null) === id);
}

/** How far into an item its label's colon may be, in characters: further, it is a sentence's. */
const LABEL_CHARS = 40;

/**
 * An item's spans split after its label, the words up to its first colon, as "New decision:" or
 * "Risk tier `medium`:": none when it has no colon near its start, or one in a link or code.
 */
function labelled(spans: ReadonlyArray<Span>): [Array<Span>, Array<Span>] | undefined {
  let length = 0;
  for (const [index, span] of spans.entries()) {
    const colon = span.link || span.code || span.image ? -1 : span.text.indexOf(":");
    if (colon >= 0) {
      if (length + colon > LABEL_CHARS) {
        return undefined;
      }
      const at = colon + 1;
      const rest = [{ ...span, text: span.text.slice(at) }, ...spans.slice(index + 1)];
      return rest.some((one) => one.text.trim() !== "" || one.image)
        ? [[...spans.slice(0, index), { ...span, text: span.text.slice(0, at) }], rest]
        : undefined;
    }
    length += span.text.length;
    if (length > LABEL_CHARS) {
      return undefined;
    }
  }
  return undefined;
}

/** An item of the block's list, its label first, heavier. */
function Item({ item, selection }: { item: Block; selection: Selection | undefined }) {
  const split = labelled(item.spans);
  return (
    <li {...stylex.props(styles.item)}>
      <Selectable block={item} isInList selection={selection}>
        <div>
          {split ? (
            <>
              <span {...stylex.props(styles.label)}>
                <Spans spans={split[0]} />
              </span>
              <Spans spans={split[1]} />
            </>
          ) : (
            <Spans spans={item.spans} />
          )}
        </div>
      </Selectable>
    </li>
  );
}

/** The time and the risk tier, as pills. */
function Pills({ items }: { items: SpecItems }) {
  const tier = items.riskTier;
  return (
    <HStack gap={2} wrap="wrap">
      {items.minutes != null && (
        <Badge
          icon={<Icon icon="clock" />}
          label={`About ${items.minutes} minutes`}
          variant="neutral"
        />
      )}
      {tier && (
        <Badge
          label={`${tier.charAt(0).toUpperCase()}${tier.slice(1)} risk`}
          variant={TIERS[tier] ?? "neutral"}
        />
      )}
    </HStack>
  );
}

/**
 * The cells a row's change touched, by index, from its runs cell by cell: none when the cells do
 * not match, the row's mark then showing alone.
 */
function changedCells(mark: SinceMark | undefined): Set<number> {
  const cells = mark?.change.kind === "changed" ? cellRuns(mark.change.runs) : undefined;
  return new Set(
    (cells ?? []).flatMap((runs, index) =>
      runs.some((run) => run.kind !== "kept") ? [index] : [],
    ),
  );
}

/**
 * The constitution's principles as a strip of pills, a check for each kept, else a warning: the
 * `## Constitution check` table, `table`, drawn so. The strip is its row of checks for a review,
 * a tap starting a comment on it; it is marked Δ when that row or the principles' changed since
 * your review, a Δ after each principle whose cell changed.
 */
function Principles({
  document,
  items,
  selection,
  table,
}: Pick<PartProps, "document" | "selection"> & { items: SpecItems; table: Block | undefined }) {
  const rows = childrenOf(document, table?.id);
  const header = rows.find((row) => row.header);
  const checks = rows.find((row) => !row.header);
  const headerMark = useSinceMark(header?.id ?? -1);
  const changed = new Set([
    ...changedCells(headerMark),
    ...changedCells(useSinceMark(checks?.id ?? -1)),
  ]);
  if (items.principles.length === 0) {
    return null;
  }
  const strip = (
    <VStack gap={1}>
      <Text color="secondary" type="supporting">
        Constitution
      </Text>
      <HStack gap={2} wrap="wrap">
        {items.principles.map(({ label, ok }, index) => (
          <Badge
            icon={<Icon icon={ok ? "check" : "warning"} label={ok ? "Kept" : "Warning"} />}
            key={label}
            label={
              changed.has(index) ? (
                <>
                  {label}
                  <SinceSign />
                </>
              ) : (
                label
              )
            }
            variant={ok ? "success" : "warning"}
          />
        ))}
      </HStack>
    </VStack>
  );
  const drawn = checks ? (
    <Selectable block={checks} selection={selection}>
      {strip}
    </Selectable>
  ) : (
    strip
  );
  return (
    <>
      {headerMark ? <SinceMarked mark={headerMark}>{drawn}</SinceMarked> : drawn}
      {header && selection?.after && <After>{selection.after(header)}</After>}
    </>
  );
}

/**
 * The block's foot, after a separator (C1): the pills, the principles, and the risk's reason;
 * nothing, not even the separator, when it has none of them.
 */
function Foot({
  document,
  items,
  selection,
}: Pick<PartProps, "document" | "selection"> & { items: SpecItems }) {
  const constitution = partOf(items, "Constitution check");
  const risk = partOf(items, "Risk tier");
  const table = constitution?.blocks
    .map((id) => document.blocks[id])
    .find((block) => block?.kind === "table");
  const constitutionBlocks = constitution?.blocks.filter((id) => id !== table?.id) ?? [];
  const hasPills = items.minutes != null || Boolean(items.riskTier);
  const hasReason = (risk?.blocks.length ?? 0) > 0;
  if (!hasPills && !constitution && !hasReason) {
    // Nothing to draw: no separator under the block's items. A constitution's part, even empty,
    // keeps its anchor.
    return null;
  }
  return (
    <>
      <Divider />
      {hasPills && <Pills items={items} />}
      {constitution && (
        <div id={constitution.anchor} {...stylex.props(styles.section)}>
          <Principles document={document} items={items} selection={selection} table={table} />
          {constitutionBlocks.length > 0 && (
            <Blocks document={document} ids={constitutionBlocks} selection={selection} />
          )}
        </div>
      )}
      {risk && hasReason && (
        <div id={risk.anchor} {...stylex.props(styles.section)}>
          <Blocks document={document} ids={risk.blocks} selection={selection} />
        </div>
      )}
    </>
  );
}

/**
 * What you approve, a pane in the accent titled by the block's first paragraph, its record or its
 * request ("Spec to review, revision 2, about 10 minutes."): the "You approve" item as its lead,
 * then the block's other items, a list; the text between the block and the first section; then its
 * foot. Its prose reads as a round's first pane: the reading font, at its measure, given air.
 */
export function SpecOpening({
  document,
  items,
  selection,
}: Pick<PartProps, "document" | "selection"> & { items: SpecItems }) {
  const block = items.block == null ? undefined : document.blocks[items.block];
  const inBlock = childrenOf(document, block?.id);
  const record = inBlock.find((b) => b.kind === "paragraph");
  const bullets = inBlock
    .filter((b) => b.kind === "list")
    .flatMap((list) => childrenOf(document, list.id));
  const lead = bullets.find((b) => b.id === items.approve);
  const others = bullets.filter((b) => b !== lead);
  const first = items.parts[0]?.heading ?? document.blocks.length;
  const intro = childrenOf(document, null)
    .filter((b) => b.id < first && b.id !== items.block && !(b.kind === "heading" && b.level === 1))
    .map((b) => b.id);
  const title = record ? plain(record.spans).trim() : "";
  return (
    <Pane
      icon="uraeda:badge-check"
      id={GROUPS.approve.id}
      isActive
      isOpenOnPhone
      title={title || GROUPS.approve.title}
    >
      <VStack gap={3}>
        {/* The record is the title, which takes no comment: one saved on it, or elsewhere on the
            block's lines outside its items, draws here (R13). */}
        {block && selection?.after && <After>{selection.after(block)}</After>}
        {lead && (
          <Selectable block={lead} selection={selection}>
            <p {...stylex.props(proseStyles.reading, proseStyles.measure, styles.lead)}>
              <Spans spans={lead.spans} />
            </p>
          </Selectable>
        )}
        {others.length > 0 && (
          <ul {...stylex.props(proseStyles.reading, proseStyles.measure, styles.list)}>
            {others.map((item) => (
              <Item item={item} key={item.id} selection={selection} />
            ))}
          </ul>
        )}
        {intro.length > 0 && (
          <Blocks document={document} ids={intro} isAiry selection={selection} />
        )}
        <Foot document={document} items={items} selection={selection} />
      </VStack>
    </Pane>
  );
}
