// A decision's card, on the spec page and on the decision's own page on a feature's branch: its
// title, its kind's pill, its intent in large text, then its sections' parts as the core compared
// them, the default branch's version with the branch's: words changed marked in place, unchanged
// parts folded behind their count, removed ones behind "N removed". A tap on a part, while the spec
// waits for review, starts a comment on its lines in the decision's file.
import { Badge } from "@astryxdesign/core/Badge";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  radiusVars,
  sizeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId, useState } from "react";
import type { CommentItem, DecisionChange, PartChange, SectionChange } from "uraeda-binding";
import { type DecisionRange, type PartSelection, Tappable } from "../Selection.tsx";
import { Panel } from "./Panel.tsx";
import { PartText } from "./RuleLine.tsx";

const styles = stylex.create({
  measure: {
    // A card's text, at the reading size, holds 75 characters a line, as a round's does.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    maxWidth: "var(--size-round-measure)",
  },
  removed: {
    // A part removed whole: a red tint over it, its words readable, never struck.
    backgroundColor: colorVars["--color-background-red"],
    borderRadius: radiusVars["--radius-element"],
    padding: spacingVars["--spacing-2"],
  },
  title: {
    // The title's link, a control's height under a touch pointer, as a crumb's is.
    alignItems: "center",
    display: "inline-flex",
    minHeight: sizeVars["--size-element-md"],
  },
});

/** Each kind's pill, a card's or a part's. */
const KINDS: Record<string, { label: string; variant: "error" | "success" | "warning" }> = {
  added: { label: "New", variant: "success" },
  changed: { label: "Changed", variant: "warning" },
  new: { label: "New", variant: "success" },
  removed: { label: "Removed", variant: "error" },
};

/** A kind's pill. */
export function KindBadge({ kind }: { kind: string }) {
  const { label, variant } = KINDS[kind] ?? { label: kind, variant: "warning" };
  return <Badge label={label} variant={variant} />;
}

export type DecisionCardProps = {
  /** The change the core compared, none for a decision found on neither side. */
  change: DecisionChange | undefined;
  /** The review's pending comments: a fold holding one of the decision's opens. */
  comments: ReadonlyArray<CommentItem>;
  crumbs: ReadonlyArray<string>;
  /** Whether it shows every section, its unchanged parts unfolded, as on its own page. */
  full?: boolean;
  /** The page of the decision as the branch has it, which its title links; none once removed. */
  href: string | undefined;
  id: string;
  /** The kind its pill says: `new`, `changed`, or `removed`. */
  kind: string;
  /** The decision's name, its file's stem. */
  name: string;
  /** What the spec says of it, its item's sentence, after the pills. */
  note?: ReactNode;
  /** How a review selects its parts, while the spec waits for one. */
  parts: PartSelection | undefined;
  /** The element id of a section's heading, by its title, for a link to the decision's anchors. */
  sectionId?: (title: string) => string | undefined;
  title: string;
  /** Whether the spec's `## Decisions` leaves it out. */
  unlisted?: boolean;
};

/** The lines a part points to: the merge base's for a removed part, the branch's otherwise. */
function rangeOf(name: string, heading: string, part: PartChange): DecisionRange | undefined {
  const removed = part.kind === "removed";
  const lines = removed ? part.before : part.after;
  return lines && { decision: { name, removed }, end: lines.end, heading, start: lines.start };
}

/** Whether a pending comment is on a part: the part holds its last line, on the same side. */
function holds(comments: ReadonlyArray<CommentItem>, range: DecisionRange | undefined) {
  return comments.some(
    (c) =>
      !!range &&
      c.decision === range.decision.name &&
      c.removed === range.decision.removed &&
      range.start <= c.endLine &&
      c.endLine <= range.end,
  );
}

/** What a section draws its parts with: the card's decision, its section, and the review. */
type Context = {
  comments: ReadonlyArray<CommentItem>;
  /** Whether unchanged parts show unfolded. */
  full: boolean;
  /** The heading a comment's lines are under: the section's, or the decision's title. */
  heading: string;
  /** Whether the section is the intent, before the first `##`. */
  intent: boolean;
  name: string;
  parts: PartSelection | undefined;
  title: string;
  /** Whether the decision is new or removed whole: its parts take no pill of their own. */
  whole: boolean;
};

/** A part: its pill when changed or added, its text, tappable while the spec waits for review. */
function Part({ context, part }: { context: Context; part: PartChange }) {
  const { heading, intent, name, parts, whole } = context;
  const range = rangeOf(name, heading, part);
  const removed = part.kind === "removed";
  const pill = !whole && (part.kind === "changed" || part.kind === "added");
  const text = (
    <VStack gap={1} xstyle={removed && styles.removed}>
      {pill && (
        <HStack>
          <KindBadge kind={part.kind} />
        </HStack>
      )}
      <PartText
        intent={intent}
        runs={part.runs}
        strength={part.strength}
        whole={part.kind === "added" || removed}
      />
    </VStack>
  );
  if (!parts || !range) {
    return text;
  }
  return (
    <Tappable
      after={parts.after(range)}
      lines={`${range.start}-${range.end}`}
      onTap={(element) => parts.onTap(range, element)}
      pressed={parts.isSelected(range)}
    >
      {text}
    </Tappable>
  );
}

/** Parts folded behind a label, open while one holds a pending comment or the selection. */
function Fold({
  context,
  label,
  parts,
}: {
  context: Context;
  label: ReactNode;
  parts: ReadonlyArray<PartChange>;
}) {
  const [open, setOpen] = useState(false);
  const held = parts.some((part) => {
    const range = rangeOf(context.name, context.heading, part);
    return holds(context.comments, range) || (!!range && !!context.parts?.isSelected(range));
  });
  return (
    <Collapsible
      chevronPosition="start"
      isOpen={open || held}
      onOpenChange={setOpen}
      trigger={label}
    >
      <VStack gap={2}>
        {parts.map((part, index) => (
          <Part context={context} key={index} part={part} />
        ))}
      </VStack>
    </Collapsible>
  );
}

/**
 * A section's parts in order: a run of unchanged ones folded behind "N unchanged", but in the
 * intent, which shows whole; the removed ones last, behind "N removed".
 */
function sectionRows(section: SectionChange, context: Context) {
  const rows: Array<ReactNode> = [];
  let kept: Array<PartChange> = [];
  const flush = () => {
    if (kept.length > 0) {
      const label = `${kept.length} unchanged`;
      rows.push(<Fold context={context} key={`kept-${rows.length}`} label={label} parts={kept} />);
    }
    kept = [];
  };
  section.parts.forEach((part, index) => {
    if (context.whole || (part.kind === "kept" && (context.full || context.intent))) {
      rows.push(<Part context={context} key={index} part={part} />);
    } else if (part.kind === "kept") {
      kept.push(part);
    } else if (part.kind !== "removed") {
      flush();
      rows.push(<Part context={context} key={index} part={part} />);
    }
  });
  flush();
  const removed = context.whole ? [] : section.parts.filter((part) => part.kind === "removed");
  if (removed.length > 0) {
    const label = <Badge label={`${removed.length} removed`} variant="error" />;
    rows.push(<Fold context={context} key="removed" label={label} parts={removed} />);
  }
  return rows;
}

/** A section: its heading, but the intent's, then its parts, as a group named by the heading. */
function Section({
  context,
  id,
  section,
}: {
  context: Omit<Context, "heading" | "intent">;
  id: string | undefined;
  section: SectionChange;
}) {
  const headingId = useId();
  const intent = section.title === "";
  const rows = sectionRows(section, {
    ...context,
    heading: section.title || context.title,
    intent,
  });
  if (intent) {
    return <VStack gap={2}>{rows}</VStack>;
  }
  return (
    <div aria-labelledby={headingId} role="group">
      <VStack gap={2}>
        <Heading id={id ?? headingId} level={4}>
          <span id={headingId}>{section.title}</span>
        </Heading>
        {rows}
      </VStack>
    </div>
  );
}

/**
 * The sections a card shows: every one when `full`; else, for a decision new or removed whole, or
 * not compared, its intent and its rules; for a changed one, its intent and each section with a
 * part not kept.
 */
function shownSections(change: DecisionChange, whole: boolean, full: boolean) {
  return change.sections.filter(
    (section) =>
      full ||
      section.title === "" ||
      (whole ? section.title === "Rules" : section.parts.some((p) => p.kind !== "kept")),
  );
}

/** What a card says of its change: none, no change, or its sections. */
function ChangeBody({
  change,
  comments,
  full = false,
  name,
  parts,
  sectionId,
  title,
}: Pick<DecisionCardProps, "comments" | "full" | "name" | "parts" | "sectionId" | "title"> & {
  change: DecisionChange;
}) {
  const kept = change.sections.every((s) => s.parts.every((p) => p.kind === "kept"));
  const same = change.compared && change.kind === "changed" && kept;
  const none = <Text color="secondary">No change against the default branch</Text>;
  if (same && !full) {
    return none;
  }
  const whole = !change.compared || change.kind !== "changed";
  const context = { comments, full, name, parts, title, whole };
  return (
    <>
      {same && none}
      {!change.compared && (
        <Text color="secondary">Could not compare with the default branch.</Text>
      )}
      {shownSections(change, whole, full).map((section) => (
        <Section
          context={context}
          id={sectionId?.(section.title)}
          key={section.title}
          section={section}
        />
      ))}
    </>
  );
}

/** A decision's card: its title, its pills, what the spec says of it, then its change. */
export function DecisionCard(props: DecisionCardProps) {
  const { change, crumbs, href, id, kind, note, title, unlisted = false } = props;
  return (
    <Panel
      badges={
        <>
          <KindBadge kind={kind} />
          {unlisted && <Badge label="Not listed in the spec" variant="error" />}
        </>
      }
      crumbs={crumbs}
      id={id}
      title={
        href ? (
          <Link hasUnderline href={href} type="inherit" xstyle={styles.title}>
            {title}
          </Link>
        ) : (
          title
        )
      }
    >
      <VStack gap={4} xstyle={styles.measure}>
        {note}
        {change && <ChangeBody {...props} change={change} />}
      </VStack>
    </Panel>
  );
}
