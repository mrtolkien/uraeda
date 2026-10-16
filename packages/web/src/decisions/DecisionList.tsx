import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { type DecisionSort, type DecisionSummary, SORTS, shortDate, statusLabel } from "./model.ts";

const styles = stylex.create({
  count: {
    color: colorVars["--color-text-secondary"],
    fontWeight: "normal",
  },
});

/** A decision's row: its title, its first sentence, its last change, and a status unless active. */
function DecisionRow({
  decision,
  isSelected,
  onOpen,
}: {
  decision: DecisionSummary;
  isSelected: boolean;
  onOpen: () => void;
}) {
  return (
    <ListItem
      data-item={`decision:${decision.slug}`}
      description={
        <Text color="secondary" maxLines={1}>
          {decision.subtitle}
        </Text>
      }
      endContent={
        <HStack align="center" gap={2}>
          {decision.status !== "active" && (
            <Badge label={statusLabel(decision.status)} variant="yellow" />
          )}
          <Text color="secondary" hasTabularNumbers type="supporting">
            {shortDate(decision.changed)}
          </Text>
        </HStack>
      }
      isSelected={isSelected}
      label={<Text weight="medium">{decision.title}</Text>}
      onClick={onOpen}
    />
  );
}

/** The decisions, under their count and a sort control, one row each. */
export function DecisionList({
  decisions,
  onOpen,
  onSort,
  selected,
  sort,
}: {
  /** Already in the sort's order. */
  decisions: Array<DecisionSummary>;
  onOpen: (slug: string) => void;
  onSort: (sort: DecisionSort) => void;
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
        <List aria-label="Decisions" hasDividers>
          {decisions.map((decision) => (
            <DecisionRow
              decision={decision}
              isSelected={selected === decision.slug}
              key={decision.slug}
              onOpen={() => onOpen(decision.slug)}
            />
          ))}
        </List>
      </VStack>
    </section>
  );
}
