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
import { useMenuPresentation } from "../layout/useWidthClass.ts";
import { Empty } from "../layout/Empty.tsx";
import { GroupTitle } from "../layout/GroupTitle.tsx";

const styles = stylex.create({
  icon: {
    color: colorVars["--color-text-secondary"],
    display: "inline-flex",
  },
});

/**
 * A decision's row: its icon, its title, its first sentence, or "Can't read this file" when it
 * cannot be parsed, its count of rules, its last change, and its status unless active.
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
        <HStack align="center" gap={1}>
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
      }
      href={here(`/decisions/${decision.name}`)}
      isSelected={isSelected}
      label={<Text weight="medium">{decision.title}</Text>}
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
  const presentation = useMenuPresentation();
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
              presentation={presentation}
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
