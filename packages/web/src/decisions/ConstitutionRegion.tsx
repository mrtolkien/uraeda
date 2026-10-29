import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { colorVars, fontWeightVars } from "@astryxdesign/core/theme/tokens.stylex";
import type { Ledger } from "uraeda-server/fate";
import { useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { plural } from "../labels.ts";
import { GroupTitle } from "../layout/GroupTitle.tsx";
import { Empty } from "../layout/Empty.tsx";

/** The constitution, as the ledger sends it. */
export type LedgerConstitution = NonNullable<Ledger["constitution"]>;

/** A principle of the constitution. */
export type LedgerPrinciple = LedgerConstitution["principles"][number];

const styles = stylex.create({
  numeral: {
    color: colorVars["--color-text-secondary"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
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
  return plural(count, "rule");
}

/** A principle's rules: the items of the lists under its heading. */
export function rulesOf(constitution: LedgerConstitution, principle: LedgerPrinciple) {
  const { blocks } = constitution.document;
  const lists = new Set(principle.blocks.filter((id) => blocks[id]?.kind === "list"));
  return blocks.filter((block) => block.parent !== undefined && lists.has(block.parent));
}

/**
 * The constitution, first: its principles, highest first, each a row of its numeral and count of
 * rules, its title, and its first rule, each a link to the whole constitution, one page.
 * "No constitution yet." without `CONSTITUTION.md`.
 */
export function ConstitutionRegion({ constitution }: { constitution: LedgerConstitution | null }) {
  const here = useRepoPath();
  return (
    <section aria-label="Constitution">
      <VStack gap={2}>
        {/* A list's heading, as small as the decisions': the list is a narrow column. */}
        <VStack gap={1}>
          <GroupTitle count={constitution?.principles.length} level={2}>
            Constitution
          </GroupTitle>
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
                  href={here("/decisions/constitution")}
                  key={principle.slug}
                  label={
                    // Its numeral and count of rules, then its title in bold, its first rule
                    // under them: each the list's whole width.
                    <VStack gap={0}>
                      <Text color="secondary" hasTabularNumbers type="supporting">
                        <span {...stylex.props(styles.numeral)}>{principle.number}</span>
                        {` · ${ruleCount(rules.length)}`}
                      </Text>
                      <Text weight="bold">{principle.title}</Text>
                    </VStack>
                  }
                />
              );
            })}
          </List>
        ) : (
          <Empty>No constitution yet.</Empty>
        )}
      </VStack>
    </section>
  );
}
