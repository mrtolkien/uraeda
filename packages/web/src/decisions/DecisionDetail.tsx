import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { Paragraph } from "../layout/Paragraph.tsx";
import type { DecisionDocument, DecisionSection, DecisionSummary, Principle } from "./model.ts";
import { statusLabel } from "./model.ts";

const styles = stylex.create({
  item: {
    // A bullet's text at the reading size, as `Blocks` draws a document's lists.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    textWrap: "pretty",
    whiteSpace: "normal",
  },
  row: {
    // As tall as its text: a touch screen's 44 px rows are for controls.
    minHeight: 0,
    paddingBlock: spacingVars["--spacing-1"],
  },
});

/** A list of rules or points, drawn as `Blocks` draws a document's bullets. */
function Bullets({ items }: { items: Array<string> }) {
  return (
    <List density="compact" edgeCompensation="inline" listStyle="disc">
      {items.map((item) => (
        <ListItem
          key={item}
          label={<span {...stylex.props(styles.item)}>{item}</span>}
          xstyle={styles.row}
        />
      ))}
    </List>
  );
}

/** A principle, read-only: its rules, its rationale, and the constitution's version line. */
export function PrincipleDetail({ principle, version }: { principle: Principle; version: string }) {
  return (
    <article aria-label={`Principle ${principle.numeral}`}>
      <VStack gap={4}>
        <VStack gap={1}>
          <Text color="secondary" type="supporting">
            Principle {principle.numeral}
          </Text>
          <Heading level={2}>{principle.title}</Heading>
        </VStack>
        <Bullets items={principle.rules} />
        <VStack gap={1}>
          <Heading level={3}>Rationale</Heading>
          <Paragraph>{principle.rationale}</Paragraph>
        </VStack>
        <Text color="secondary" type="supporting">
          {version}
        </Text>
      </VStack>
    </article>
  );
}

/** A section of a decision: its heading, then its paragraphs and bullets. */
function Section({ section }: { section: DecisionSection }) {
  return (
    <section aria-label={section.heading}>
      <VStack gap={2}>
        <Heading level={3}>{section.heading}</Heading>
        {section.paragraphs?.map((paragraph) => (
          <Paragraph key={paragraph}>{paragraph}</Paragraph>
        ))}
        {section.bullets && <Bullets items={section.bullets} />}
      </VStack>
    </section>
  );
}

/**
 * A decision, read-only: its title, status, approver, summary, then its sections.
 *
 * TEMPORARY: the sections come as plain props for the mockup; the real view draws the core's
 * document tree of the decision's file with `Blocks`, its links and code marks included.
 */
export function DecisionDetail({
  decision,
  document,
}: {
  decision: DecisionSummary;
  document: DecisionDocument | undefined;
}) {
  return (
    <article aria-label={decision.title}>
      <VStack gap={4}>
        <VStack gap={2}>
          <Heading level={2}>{decision.title}</Heading>
          <HStack align="center" gap={2} wrap="wrap">
            <Badge
              label={statusLabel(decision.status)}
              variant={decision.status === "active" ? "green" : "yellow"}
            />
            <Text color="secondary" type="supporting">
              Approved by {decision.approvedBy}
            </Text>
          </HStack>
        </VStack>
        <Paragraph>{document?.summary ?? decision.subtitle}</Paragraph>
        {document?.sections.map((section) => (
          <Section key={section.heading} section={section} />
        ))}
      </VStack>
    </article>
  );
}
