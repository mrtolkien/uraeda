// A decision's card, on the spec page and on the decision's own page on a feature's branch: its
// title, its kind's pill, its intent in large text, then its sections' parts as the core compared
// them, the default branch's version with the branch's: words changed marked in place, unchanged
// parts folded behind their count, removed ones behind "N removed". A tap on a part, while the spec
// waits for review, starts a comment on its lines in the decision's file.
import { Badge } from "@astryxdesign/core/Badge";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { CommentItem, DecisionChange } from "uraeda-binding";
import type { PartSelection } from "../Selection.tsx";
import { KindBadge } from "./ledger/KindBadge.tsx";
import { Section, shownSections } from "./ledger/Section.tsx";
import { Panel } from "./Panel.tsx";

const styles = stylex.create({
  measure: {
    // A card's text, at the reading size, holds 75 characters a line, as a round's does.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    maxWidth: "var(--size-round-measure)",
  },
  title: {
    // The title's link, a control's height under a touch pointer, as a crumb's is.
    alignItems: "center",
    display: "inline-flex",
    minHeight: sizeVars["--size-element-md"],
  },
});

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
  const verdict = change.fields.length > 0 ? "No part changed" : "No change";
  const none = <Text color="secondary">{`${verdict} against the default branch`}</Text>;
  const fields = change.fields.length > 0 && (
    <VStack gap={0.5}>
      {change.fields.map((field) => (
        <Text color="secondary" display="block" key={field.name} type="supporting">
          {`${field.name}: ${field.before ?? "none"} → ${field.after ?? "none"}`}
        </Text>
      ))}
    </VStack>
  );
  if (same && !full) {
    return (
      <>
        {none}
        {fields}
      </>
    );
  }
  const whole = !change.compared || change.kind !== "changed";
  const context = { comments, full, name, parts, title, whole };
  return (
    <>
      {same && none}
      {fields}
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
