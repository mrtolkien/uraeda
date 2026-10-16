import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { useWidthClass } from "../layout/useWidthClass.ts";
import type { Constitution, Principle } from "./model.ts";

const styles = stylex.create({
  cards: {
    // Three cards a row, wrapping to a second: all six in view at once, nothing scrolls sideways.
    display: "grid",
    gap: spacingVars["--spacing-3"],
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
});

/** "I. Humans stay in control". */
export function principleName(principle: Principle): string {
  return `${principle.numeral}. ${principle.title}`;
}

/**
 * The constitution, first: its version line, then its principles, as cards on wide screens and a
 * compact list on narrow ones, each with its first rule as a one-line gist.
 */
export function ConstitutionRegion({
  constitution,
  onOpen,
  selected,
}: {
  constitution: Constitution;
  onOpen: (numeral: string) => void;
  selected: string | undefined;
}) {
  const wide = useWidthClass() === "wide";
  return (
    <section aria-label="Constitution">
      <VStack gap={3}>
        <VStack gap={1}>
          <Heading level={2}>Constitution</Heading>
          <Text color="secondary" type="supporting">
            {constitution.version}
          </Text>
        </VStack>
        {wide ? (
          <div {...stylex.props(styles.cards)}>
            {constitution.principles.map((principle) => (
              <div data-item={`principle:${principle.numeral}`} key={principle.numeral}>
                <ClickableCard
                  height="100%"
                  label={principleName(principle)}
                  onClick={() => onOpen(principle.numeral)}
                  padding={3}
                  // The open principle has the grey fill of a selected row.
                  variant={selected === principle.numeral ? "gray" : "default"}
                >
                  <VStack gap={1}>
                    <Text weight="semibold">{principleName(principle)}</Text>
                    <Text color="secondary" maxLines={2} type="supporting">
                      {principle.rules[0]}
                    </Text>
                  </VStack>
                </ClickableCard>
              </div>
            ))}
          </div>
        ) : (
          <List aria-label="Principles" hasDividers>
            {constitution.principles.map((principle) => (
              <ListItem
                data-item={`principle:${principle.numeral}`}
                description={
                  <Text color="secondary" maxLines={1}>
                    {principle.rules[0]}
                  </Text>
                }
                isSelected={selected === principle.numeral}
                key={principle.numeral}
                label={<Text weight="medium">{principleName(principle)}</Text>}
                onClick={() => onOpen(principle.numeral)}
              />
            ))}
          </List>
        )}
      </VStack>
    </section>
  );
}
