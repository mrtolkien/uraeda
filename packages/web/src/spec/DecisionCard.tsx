// A decision's change, on every page that draws one: a pane toned by its kind, green when new,
// mauve when changed, red when removed, titled by the decision with its kind's pill and its fields'
// change after it, then what the spec says of it, then the ledger (`ledger/`): its intent, its rules
// not kept first, each with its sign and its words marked inside, the rest folded with its count. A
// tap on a part, while the spec waits for review, starts a comment on its lines in the decision's
// file.
import { Badge } from "@astryxdesign/core/Badge";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { CommentItem, DecisionChange } from "uraeda-binding";
import { Pane, type PaneTone } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { PartSelection } from "../Selection.tsx";
import { KindBadge } from "./ledger/KindBadge.tsx";
import { Ledger } from "./ledger/Section.tsx";

const styles = stylex.create({
  link: {
    // The link to the decision's page, a control's height under a touch pointer, as a crumb's is.
    alignItems: "center",
    display: "inline-flex",
    minHeight: sizeVars["--size-element-md"],
  },
  measure: {
    // A pane's text, at the reading size, holds 75 characters a line, as a round's does.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    maxWidth: "var(--size-round-measure)",
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
  // On the phone, the pane keeps only its titled top border: its text takes the page's width.
  open: { paddingInline: 0 },
  suffix: {
    // The pills and the fields' change after the title, wrapping as the title does.
    alignItems: "center",
    columnGap: spacingVars["--spacing-2"],
    display: "inline-flex",
    flexWrap: "wrap",
  },
});

export type DecisionCardProps = {
  /** The change the core compared, none for a decision found on neither side. */
  change: DecisionChange | undefined;
  /** The review's pending comments: a fold holding one of the decision's opens. */
  comments: ReadonlyArray<CommentItem>;
  /** The groups it sits in: none for a pane at the page's top level, a level-2 heading. */
  crumbs: ReadonlyArray<string>;
  /** Whether it shows every section, nothing folded, as on its own page. */
  full?: boolean;
  /** The page of the decision as the branch has it, which its foot links; none once removed. */
  href: string | undefined;
  id: string;
  /** The kind its pill and its tone say: `new`, `changed`, or `removed`. */
  kind: string;
  /** The decision's name, its file's stem. */
  name: string;
  /** What the spec says of it, its item's sentence, before the ledger. */
  note?: ReactNode;
  /** How a review selects its parts, while the spec waits for one. */
  parts: PartSelection | undefined;
  /** The element id of a section's heading, by its title, for a link to the decision's anchors. */
  sectionId?: (title: string) => string | undefined;
  title: string;
  /** Whether the spec's `## Decisions` leaves it out. */
  unlisted?: boolean;
};

/** Each kind's pane tone. */
const TONES: Record<string, PaneTone> = { changed: "changed", new: "new", removed: "removed" };

/** The fields' change, "status: active → proposed", joined. */
function fieldsOf(change: DecisionChange | undefined) {
  return (change?.fields ?? [])
    .map((field) => `${field.name}: ${field.before || "none"} → ${field.after || "none"}`)
    .join(" · ");
}

/** What a card says of its change: no change, or its ledger. */
function ChangeBody({
  change,
  comments,
  full = false,
  id,
  name,
  parts,
  sectionId,
  title,
}: Pick<
  DecisionCardProps,
  "comments" | "full" | "id" | "name" | "parts" | "sectionId" | "title"
> & {
  change: DecisionChange;
}) {
  const kept = change.sections.every((s) => s.parts.every((p) => p.kind === "kept"));
  const same = change.compared && change.kind === "changed" && kept;
  const verdict = change.fields.length > 0 ? "No part changed" : "No change";
  const none = <Text color="secondary">{`${verdict} against the default branch`}</Text>;
  if (same && !full) {
    return none;
  }
  const whole = !change.compared || change.kind !== "changed";
  return (
    <>
      {same && none}
      {!change.compared && (
        <Text color="secondary">Could not compare with the default branch.</Text>
      )}
      <Ledger
        change={change}
        context={{ comments, full, id, name, parts, title, whole }}
        sectionId={sectionId}
      />
    </>
  );
}

/** A decision's pane: its title and pills, what the spec says of it, its ledger, its page's link. */
export function DecisionCard(props: DecisionCardProps) {
  const { change, crumbs, href, id, kind, note, title, unlisted = false } = props;
  const fields = fieldsOf(change);
  const isOpen = isNarrow(useWidthClass());
  return (
    <Pane
      id={id}
      // On the phone, its titled top border alone, as every pane's (R13).
      isOpenOnPhone
      level={crumbs.length === 0 ? 2 : 3}
      title={title}
      titleSuffix={
        <span {...stylex.props(styles.suffix)}>
          <KindBadge kind={kind} />
          {unlisted && <Badge label="Not listed in the spec" variant="error" />}
          {fields && <span>{fields}</span>}
        </span>
      }
      tone={TONES[kind]}
    >
      <VStack gap={3} xstyle={[styles.measure, isOpen && styles.open]}>
        {note}
        {change && <ChangeBody {...props} change={change} />}
        {href && (
          <Link hasUnderline href={href} xstyle={styles.link}>
            The whole decision, on its page
          </Link>
        )}
      </VStack>
    </Pane>
  );
}
