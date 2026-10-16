import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { Paragraph } from "../layout/Paragraph.tsx";
import { useRepoPath } from "../routes.tsx";
import { decisionIcon } from "../theme/icons.ts";
import { statusLabel } from "./DecisionDetail.tsx";
import { type DecisionSort, type LedgerDecision, SORTS, shortDate } from "./model.ts";

const styles = stylex.create({
  count: {
    color: colorVars["--color-text-secondary"],
    fontWeight: "normal",
  },
  icon: {
    color: colorVars["--color-text-secondary"],
    display: "inline-flex",
  },
});

/**
 * A decision's row: its icon, its title, its first sentence, or "Can't read this file" when it
 * cannot be parsed, its last change, and its status unless active.
 */
function DecisionRow({ decision, isSelected }: { decision: LedgerDecision; isSelected: boolean }) {
  const here = useRepoPath();
  const subtitle = decision.unreadable ? "Can't read this file" : decision.summary;
  return (
    <ListItem
      // What the list's keys move between: see `useListKeys`.
      data-row=""
      description={subtitle && <Text color="secondary">{subtitle}</Text>}
      endContent={
        <HStack align="center" gap={2}>
          {decision.status !== null && decision.status !== "active" && (
            <Badge label={statusLabel(decision.status)} variant="yellow" />
          )}
          {decision.changed && (
            <Text color="secondary" hasTabularNumbers type="supporting">
              {shortDate(decision.changed)}
            </Text>
          )}
        </HStack>
      }
      href={here(`/decisions/${decision.name}`)}
      isSelected={isSelected}
      label={
        <Text data-title="" weight="medium">
          {decision.title}
        </Text>
      }
      startContent={
        <span {...stylex.props(styles.icon)}>
          <Icon icon={decisionIcon(decision.icon)} />
        </span>
      }
    />
  );
}

/** The decisions, under their count and a sort control, one row each. */
export function DecisionList({
  decisions,
  onSort,
  selected,
  sort,
}: {
  /** Already in the sort's order. */
  decisions: ReadonlyArray<LedgerDecision>;
  onSort: (sort: DecisionSort) => void;
  /** The name of the decision open beside the list. */
  selected: string | undefined;
  sort: DecisionSort;
}) {
  return (
    <section aria-label="Decisions">
      <VStack gap={2}>
        <HStack align="center" gap={3} justify="between" wrap="wrap">
          <Heading level={2}>
            Decisions <span {...stylex.props(styles.count)}>· {decisions.length}</span>
          </Heading>
          <Selector
            isLabelHidden
            label="Sort decisions"
            onChange={(value: string) => onSort(value as DecisionSort)}
            options={SORTS}
            presentation="adaptive"
            size="sm"
            value={sort}
          />
        </HStack>
        {decisions.length === 0 ? (
          <Paragraph>No decisions yet.</Paragraph>
        ) : (
          <List aria-label="Decisions" hasDividers>
            {decisions.map((decision) => (
              <DecisionRow
                decision={decision}
                isSelected={selected === decision.name}
                key={decision.name}
              />
            ))}
          </List>
        )}
      </VStack>
    </section>
  );
}
