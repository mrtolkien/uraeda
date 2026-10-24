import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import type { Ledger } from "uraeda-server/fate";
import { Paragraph } from "../layout/Paragraph.tsx";
import { useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";

/** The constitution, as the ledger sends it. */
export type LedgerConstitution = NonNullable<Ledger["constitution"]>;

/** A principle of the constitution. */
export type LedgerPrinciple = LedgerConstitution["principles"][number];

const styles = stylex.create({
  count: {
    color: colorVars["--color-text-secondary"],
    fontWeight: fontWeightVars["--font-weight-normal"],
  },
  numeral: {
    // The numerals in one column, as the decisions' icons are.
    color: colorVars["--color-text-secondary"],
    display: "inline-block",
    fontWeight: fontWeightVars["--font-weight-semibold"],
    minWidth: spacingVars["--spacing-6"],
  },
});

/** "I. Humans stay in control". */
export function principleName(principle: Pick<LedgerPrinciple, "number" | "title">): string {
  return `${principle.number}. ${principle.title}`;
}

/** "Version 1.3.1 · Ratified 2026-10-07 · Last amended 2026-10-14", of the fields it has. */
export function versionLine(
  constitution: Pick<LedgerConstitution, "amended" | "ratified" | "version">,
): string {
  return [
    constitution.version && `Version ${constitution.version}`,
    constitution.ratified && `Ratified ${constitution.ratified}`,
    constitution.amended && `Last amended ${constitution.amended}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "1 rule", "3 rules". */
export function ruleCount(count: number): string {
  return count === 1 ? "1 rule" : `${count} rules`;
}

/** A principle's rules: the items of the lists under its heading. */
export function rulesOf(constitution: LedgerConstitution, principle: LedgerPrinciple) {
  const { blocks } = constitution.document;
  const lists = new Set(principle.blocks.filter((id) => blocks[id]?.kind === "list"));
  return blocks.filter((block) => block.parent !== undefined && lists.has(block.parent));
}

/**
 * The constitution, first: its principles, highest first, each a row of its numeral, its title,
 * its first rule, and its count of rules, a link to the whole constitution in the reader, at it.
 * "No constitution yet." without `CONSTITUTION.md`.
 */
export function ConstitutionRegion({
  constitution,
  selected,
}: {
  constitution: LedgerConstitution | null;
  /** The slug of the principle the reader is at. */
  selected: string | undefined;
}) {
  const here = useRepoPath();
  return (
    <section aria-label="Constitution">
      <VStack gap={2}>
        {/* A list's heading, as small as the decisions': the list is a narrow column. */}
        <VStack gap={1}>
          <Heading accessibilityLevel={2} level={4}>
            Constitution{" "}
            {constitution && (
              <span {...stylex.props(styles.count)}>· {constitution.principles.length}</span>
            )}
          </Heading>
          {constitution && (
            <Text color="secondary" type="supporting">
              In one file, highest first.
            </Text>
          )}
        </VStack>
        {constitution ? (
          <List aria-label="Principles" hasDividers>
            {constitution.principles.map((principle) => {
              const rules = rulesOf(constitution, principle);
              return (
                <ListItem
                  // What the list's keys move between: see `useListKeys`.
                  data-row=""
                  description={rules[0] && <Text color="secondary">{plain(rules[0].spans)}</Text>}
                  endContent={
                    <Text color="secondary" hasTabularNumbers type="supporting">
                      {ruleCount(rules.length)}
                    </Text>
                  }
                  href={here(`/decisions/constitution/${principle.slug}`)}
                  isSelected={selected === principle.slug}
                  key={principle.slug}
                  label={<Text weight="medium">{principle.title}</Text>}
                  startContent={<span {...stylex.props(styles.numeral)}>{principle.number}</span>}
                />
              );
            })}
          </List>
        ) : (
          <Paragraph>No constitution yet.</Paragraph>
        )}
      </VStack>
    </section>
  );
}
