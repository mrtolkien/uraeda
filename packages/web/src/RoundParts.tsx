// The round's own parts, in titled panes: its block, titled by its first line, with the verdict's
// badge before its sentence; its context, a pane per part, Today folded; the "Check these" pane;
// and a settled point's actions. Round-only parts, as the plan's Complexity tracking names them.
import { Badge, type BadgeVariant } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useMemo, useRef, useState } from "react";
import type { Block, ContextPart, Document, RoundItems, VerdictKind } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { type Folds, useHashFold } from "./Folds.tsx";
import { Pane } from "./layout/Pane.tsx";
import { useAtLeast } from "./layout/useWidthOf.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { proseStyles } from "./Prose.tsx";
import { PART_IDS } from "./roundPartIds.ts";
import { plain, Spans } from "./Spans.tsx";

const styles = stylex.create({
  badge: { flexShrink: 0 },
  // On the phone, above its sentence, as wide as its words.
  badgeNarrow: { alignSelf: "flex-start" },
  lead: { marginBlock: spacingVars["--spacing-1"] },
  verdict: { paddingBlock: spacingVars["--spacing-2"] },
});

/** The verdict's badge, by the kind the core reads: its words and its colour. */
const VERDICTS: Record<VerdictKind, { label: string; variant: BadgeVariant }> = {
  "as-proposed": { label: "As proposed", variant: "success" },
  "not-as-proposed": { label: "Not as proposed", variant: "error" },
  "with-changes": { label: "With changes", variant: "warning" },
};

/** A context part's icon, by its heading's anchor. */
const CONTEXT_ICONS: Record<string, string> = {
  goal: "uraeda:target",
  scope: "uraeda:crop",
  sources: "uraeda:book-open",
  today: "uraeda:history",
};

/**
 * The block's title and what it holds under it: its callout's own title if it has one, else its
 * first paragraph, which the rest follows.
 */
function blockParts(document: Document, block: Block) {
  const children = document.blocks.filter((b) => b.parent === block.id);
  const [first, ...rest] = children;
  if (block.spans.length > 0 || first?.kind !== "paragraph") {
    return { body: children, title: block.spans.length > 0 ? plain(block.spans) : "Summary" };
  }
  return { body: rest, title: plain(first.spans) };
}

/**
 * The document with the verdict's item out of its list, as the badge and its sentence draw it: the
 * item keeps its index, but no longer has the list as its parent.
 */
function withoutItem(document: Document, item: number | undefined): Document {
  if (item === undefined) {
    return document;
  }
  return {
    ...document,
    blocks: document.blocks.map((b) => (b.id === item ? { ...b, parent: undefined } : b)),
  };
}

/**
 * The verdict: its badge, then its sentence, beside it, under it on the phone, within the reading
 * measure.
 */
function Verdict({ verdict }: { verdict: NonNullable<RoundItems["verdict"]> }) {
  const isNarrowScreen = isNarrow(useWidthClass());
  const look = VERDICTS[verdict.kind];
  return (
    <Stack
      direction={isNarrowScreen ? "vertical" : "horizontal"}
      gap={isNarrowScreen ? 1 : 3}
      vAlign={isNarrowScreen ? undefined : "baseline"}
      // Reading text, its badge and its sentence held to the measure as one line.
      xstyle={[styles.verdict, proseStyles.reading, proseStyles.measure]}
    >
      <Badge
        label={look.label}
        variant={look.variant}
        xstyle={[styles.badge, isNarrowScreen && styles.badgeNarrow]}
      />
      <div {...stylex.props(proseStyles.reading)}>
        <Spans spans={verdict.text} />
      </div>
    </Stack>
  );
}

/**
 * The round's block, a pane titled by its first line, `id="summary"`: the verdict's badge then its
 * sentence, then the rest of the block's items.
 */
export function RoundBlock({ document, round }: { document: Document; round: RoundItems }) {
  const drawn = useMemo(
    () => withoutItem(document, round.verdict?.item),
    [document, round.verdict?.item],
  );
  const block = round.block === undefined ? undefined : document.blocks[round.block];
  if (!block) {
    return null;
  }
  const { body, title } = blockParts(document, block);
  // A list that held the verdict alone has nothing left to draw.
  const ids = body
    .filter((b) => b.kind !== "list" || drawn.blocks.some((item) => item.parent === b.id))
    .map((b) => b.id);
  return (
    <Pane icon="uraeda:triangle-alert" id={PART_IDS.summary} isOpenOnPhone title={title}>
      {round.verdict && <Verdict verdict={round.verdict} />}
      <Blocks document={drawn} ids={ids} />
    </Pane>
  );
}

/** The anchor of a context part's heading, if it has one. */
const anchorOf = (document: Document, part: ContextPart | undefined) =>
  part?.heading === undefined ? undefined : document.blocks[part.heading]?.anchor;

/** Today folded until opened, by a tap on its title or a link to `#today`, for the page's life. */
function useTodayFold(document: Document, today: ContextPart | undefined): Folds {
  const [isOpen, setOpen] = useState(false);
  const list = useMemo(
    () =>
      today?.heading === undefined
        ? []
        : [{ ids: [today.heading, ...today.blocks], key: PART_IDS.today, label: today.title }],
    [today],
  );
  const folds: Folds = {
    list,
    onOpenChange: (_, open) => setOpen(open),
    open: isOpen ? [PART_IDS.today] : [],
  };
  useHashFold(document, folds);
  return folds;
}

/**
 * A context part's pane, by its heading's anchor; a triage's free context, or the blocks before a
 * round's first `###`, is "Context", `id="context"`.
 */
function ContextPane({
  document,
  folds,
  part,
}: {
  document: Document;
  folds: Folds;
  part: ContextPart;
}) {
  const anchor = anchorOf(document, part);
  return (
    <Pane
      fold={
        anchor === PART_IDS.today
          ? {
              isOpen: folds.open.includes(PART_IDS.today),
              onOpenChange: (isOpen) => folds.onOpenChange(PART_IDS.today, isOpen),
            }
          : undefined
      }
      icon={anchor === undefined ? undefined : CONTEXT_ICONS[anchor]}
      id={anchor ?? PART_IDS.context}
      isOpenOnPhone
      title={part.title || "Context"}
    >
      {/* Prose given air, and the goal's and the scope's first sentence leading: what each says first. */}
      <Blocks
        document={document}
        hasLead={anchor === "goal" || anchor === "scope"}
        ids={part.blocks}
        isAiry
      />
    </Pane>
  );
}

/**
 * The round's context, a pane per part, Today folded, Scope and Sources side by side when the
 * round is at least `--size-round-pair` wide; then `check`, the "Check these" pane.
 */
export function RoundContext({
  check,
  document,
  round,
}: {
  check?: ReactNode;
  document: Document;
  round: RoundItems;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isRoomy = useAtLeast(ref, "--size-round-pair");
  const parts = round.context;
  const folds = useTodayFold(
    document,
    parts.find((part) => anchorOf(document, part) === PART_IDS.today),
  );
  const scope = parts.findIndex((part) => anchorOf(document, part) === "scope");
  const sources = parts[scope + 1];
  const isPaired = scope >= 0 && anchorOf(document, sources) === "sources";
  const pane = (part: ContextPart) => (
    <ContextPane document={document} folds={folds} key={part.heading ?? -1} part={part} />
  );
  return (
    <div ref={ref}>
      {parts.map((part, index) => {
        if (!isPaired || (index !== scope && index !== scope + 1)) {
          return pane(part);
        }
        return (
          index === scope && (
            <Grid columns={isRoomy ? 2 : 1} gap={4} key="scope-sources">
              {pane(part)}
              {sources && pane(sources)}
            </Grid>
          )
        );
      })}
      {check}
    </div>
  );
}

/** The peach "Check these · N" pane, `id="check-these"`: its lead, then its points. */
export function CheckPane({ children, count }: { children: ReactNode; count: number }) {
  return (
    <Pane
      count={count}
      icon="uraeda:flag"
      id={PART_IDS.check}
      isOpenOnPhone
      title="Check these"
      tone="attention"
    >
      <Text color="secondary" display="block" type="supporting" xstyle={styles.lead}>
        Settled without you. Object here before answering, if one is wrong.
      </Text>
      {children}
    </Pane>
  );
}

/**
 * A settled point's actions: "Ask", named `Ask about "<subject>"`, with `onAsk`, and its comment
 * button.
 */
export function PointActions({
  onAsk,
  onComment,
  subject,
}: {
  onAsk?: (subject: string) => void;
  onComment: () => void;
  subject: string;
}) {
  return (
    <HStack gap={1} justify="end">
      {onAsk && (
        <Button
          icon={<Icon icon="uraeda:comment" />}
          label={`Ask about "${subject}"`}
          onClick={() => onAsk(subject)}
          size="sm"
          variant="ghost"
        >
          Ask
        </Button>
      )}
      <Button
        icon={<Icon icon="uraeda:pencil" />}
        isIconOnly
        label={`Comment on "${subject}"`}
        onClick={onComment}
        size="sm"
        variant="ghost"
      />
    </HStack>
  );
}
