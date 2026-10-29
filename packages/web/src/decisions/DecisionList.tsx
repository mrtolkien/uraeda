import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { useRepoPath } from "../routes.tsx";
import { decisionIcon } from "../theme/icons.ts";
import { ruleCount } from "./ConstitutionRegion.tsx";
import { statusLabel } from "./DecisionDetail.tsx";
import { type DecisionSort, type LedgerDecision, SORTS, shortDate } from "./model.ts";
import { Empty } from "../layout/Empty.tsx";
import { GroupTitle } from "../layout/GroupTitle.tsx";

const styles = stylex.create({
  icon: {
    color: colorVars["--color-text-secondary"],
    display: "inline-flex",
  },
  // The head line's facts at its end, whole: past the title's room, on a line of their own.
  facts: { flexShrink: 0, marginInlineStart: "auto", whiteSpace: "nowrap" },
});

/**
 * A decision's row, its text the list's whole width: a head line of its icon, its title, its status
 * unless active, its count of rules, and its last change; then its first sentence, or "Can't read
 * this file" when it cannot be parsed.
 */
function DecisionRow({ decision, isSelected }: { decision: LedgerDecision; isSelected: boolean }) {
  const here = useRepoPath();
  const subtitle = decision.unreadable ? "Can't read this file" : decision.summary;
  return (
    <ListItem
      // What the list's keys move between: see `useListKeys`.
      data-row=""
      description={subtitle && <Text color="secondary">{subtitle}</Text>}
      href={here(`/decisions/${decision.name}`)}
      isSelected={isSelected}
      label={
        <HStack align="center" gap={2} wrap="wrap">
          <span {...stylex.props(styles.icon)}>
            <Icon icon={decisionIcon(decision.icon)} />
          </span>
          <Text weight="medium">{decision.title}</Text>
          <DecisionFacts decision={decision} />
        </HStack>
      }
    />
  );
}

/** A decision's status unless active, its count of rules, and its last change, at its line's end. */
function DecisionFacts({ decision }: { decision: LedgerDecision }) {
  return (
    <HStack align="center" gap={1} xstyle={styles.facts}>
      {decision.status !== null && decision.status !== "active" && (
        <Badge label={statusLabel(decision.status)} variant="yellow" />
      )}
      {decision.rules.length > 0 && (
        <Text color="secondary" hasTabularNumbers type="supporting">
          {ruleCount(decision.rules.length)}
        </Text>
      )}
      {decision.rules.length > 0 && decision.changed && (
        <Text color="secondary" type="supporting">
          ·
        </Text>
      )}
      {decision.changed && (
        <Text color="secondary" hasTabularNumbers type="supporting">
          {shortDate(decision.changed)}
        </Text>
      )}
    </HStack>
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
        <GroupTitle
          actions={
            <Selector
              isLabelHidden
              label="Sort decisions"
              onChange={(value: string) => onSort(value as DecisionSort)}
              options={SORTS}
              presentation="popover"
              size="sm"
              value={sort}
            />
          }
          count={decisions.length}
          level={2}
        >
          Decisions
        </GroupTitle>
        {decisions.length === 0 ? (
          <Empty>No decisions yet.</Empty>
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
