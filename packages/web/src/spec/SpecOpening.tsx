// "What you approve", the spec page's first part: the block's record or request, the time and the
// risk tier as pills, the "You approve" item as the page's lead, the block's other items, the text
// before the first section, then the constitution's principles as a strip of pills and the risk
// tier's reason. Each item and paragraph takes a comment as the spec's other blocks do.
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { fontWeightVars, spacingVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { Block, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Selectable, type Selection } from "../Selection.tsx";
import { Spans } from "../Spans.tsx";
import { Panel } from "./Panel.tsx";
import { GROUPS, type PartProps, partOf, type SpecItems } from "./parts.ts";

const styles = stylex.create({
  bullet: {
    // An item of the block: its chevron on its first line, next to its text, the text wrapping
    // under itself.
    alignItems: "baseline",
    columnGap: spacingVars["--spacing-1"],
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    margin: 0,
  },
  chevron: {
    // The chevron, centred on the first line's letters (C2).
    verticalAlign: "middle",
  },
  lead: {
    // What you approve, in one sentence: the largest text of the page after its titles.
    fontSize: typeScaleVars["--text-heading-3-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-heading-3-leading"],
  },
  reading: {
    // The block's other items at the reading size, as the spec's other blocks.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
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

/** An item of the block, behind its chevron: the lead in large text, the others as the page's. */
function Bullet({
  isLead,
  item,
  selection,
}: {
  isLead: boolean;
  item: Block;
  selection: Selection | undefined;
}) {
  return (
    <Selectable block={item} selection={selection}>
      <Text
        as="div"
        display="block"
        type="inherit"
        xstyle={[styles.bullet, isLead ? styles.lead : styles.reading]}
      >
        <span aria-hidden="true">
          <Icon
            color="secondary"
            icon="chevronRight"
            size={isLead ? "md" : "sm"}
            xstyle={styles.chevron}
          />
        </span>
        <span>
          <Spans spans={item.spans} />
        </span>
      </Text>
    </Selectable>
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

/** The constitution's principles as a strip of pills: a check for each kept, a warning otherwise. */
function Principles({ items }: { items: SpecItems }) {
  if (items.principles.length === 0) {
    return null;
  }
  return (
    <VStack gap={1}>
      <Text color="secondary" type="supporting">
        Constitution
      </Text>
      <HStack gap={2} wrap="wrap">
        {items.principles.map(({ label, ok }) => (
          <Badge
            icon={<Icon icon={ok ? "check" : "warning"} label={ok ? "Kept" : "Warning"} />}
            key={label}
            label={label}
            variant={ok ? "success" : "warning"}
          />
        ))}
      </HStack>
    </VStack>
  );
}

/**
 * What you approve: the block's first paragraph, its record or its request; the time and the risk
 * tier; the "You approve" item large, then the block's other items; the text between the block and
 * the first section; the constitution's principles, and the text under their table; the risk
 * tier's reason.
 */
export function SpecOpening({
  document,
  items,
  selection,
}: Pick<PartProps, "document" | "selection"> & { items: SpecItems }) {
  const inBlock = childrenOf(document, items.block ?? undefined);
  const record = inBlock.find((b) => b.kind === "paragraph");
  const bullets = inBlock
    .filter((b) => b.kind === "list")
    .flatMap((list) => childrenOf(document, list.id));
  const lead = bullets.find((b) => b.id === items.approve);
  const first = items.parts[0]?.heading ?? document.blocks.length;
  const intro = childrenOf(document, null)
    .filter((b) => b.id < first && b.id !== items.block && !(b.kind === "heading" && b.level === 1))
    .map((b) => b.id);
  const constitution = partOf(items, "Constitution check");
  const risk = partOf(items, "Risk tier");
  const constitutionBlocks = constitution?.blocks.filter(
    (id) => document.blocks[id]?.kind !== "table",
  );
  return (
    <Panel crumbs={[]} id={GROUPS.approve.id} title={GROUPS.approve.title}>
      {record && (
        <Selectable block={record} selection={selection}>
          <Text color="secondary" display="block" type="supporting">
            <Spans spans={record.spans} />
          </Text>
        </Selectable>
      )}
      <Pills items={items} />
      {lead && <Bullet isLead item={lead} selection={selection} />}
      {bullets
        .filter((b) => b !== lead)
        .map((item) => (
          <Bullet isLead={false} item={item} key={item.id} selection={selection} />
        ))}
      {intro.length > 0 && <Blocks document={document} ids={intro} selection={selection} />}
      {constitution && (
        <div id={constitution.anchor} {...stylex.props(styles.section)}>
          <Principles items={items} />
          {constitutionBlocks && constitutionBlocks.length > 0 && (
            <Blocks document={document} ids={constitutionBlocks} selection={selection} />
          )}
        </div>
      )}
      {risk && (
        <div id={risk.anchor} {...stylex.props(styles.section)}>
          {risk.blocks.length > 0 && (
            <Blocks document={document} ids={risk.blocks} selection={selection} />
          )}
        </div>
      )}
    </Panel>
  );
}
