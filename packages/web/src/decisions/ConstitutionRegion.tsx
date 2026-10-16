import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import type { Ledger } from "uraeda-server/fate";
import { Paragraph } from "../layout/Paragraph.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";

/** The constitution, as the ledger sends it. */
export type LedgerConstitution = NonNullable<Ledger["constitution"]>;

/** A principle of the constitution. */
export type LedgerPrinciple = LedgerConstitution["principles"][number];

const styles = stylex.create({
  cards: {
    // Three cards a row, wrapping to a second: all six in view at once, nothing scrolls sideways.
    display: "grid",
    gap: spacingVars["--spacing-3"],
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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

/** A principle's first rule, as plain text: the first item of its first list. */
function firstRule(constitution: LedgerConstitution, principle: LedgerPrinciple): string {
  const { blocks } = constitution.document;
  const list = principle.blocks.map((id) => blocks[id]).find((block) => block?.kind === "list");
  const item = list && blocks.find((block) => block.parent === list.id);
  return item ? plain(item.spans) : "";
}

/**
 * The constitution, first: its version line, then its principles as cards, each with its first
 * rule as a gist, each a link to its pane. "No constitution yet." without `CONSTITUTION.md`.
 */
export function ConstitutionRegion({
  constitution,
  selected,
}: {
  constitution: LedgerConstitution | null;
  /** The slug of the principle open beside the list. */
  selected: string | undefined;
}) {
  const here = useRepoPath();
  const narrow = useWidthClass() === "narrow";
  const version = constitution ? versionLine(constitution) : "";
  const href = (principle: LedgerPrinciple) => here(`/decisions/constitution/${principle.slug}`);
  return (
    <section aria-label="Constitution">
      <VStack gap={3}>
        <VStack gap={1}>
          <Heading level={2}>Constitution</Heading>
          {version && (
            <Text color="secondary" type="supporting">
              {version}
            </Text>
          )}
        </VStack>
        {constitution && !narrow && (
          <div {...stylex.props(styles.cards)}>
            {constitution.principles.map((principle) => (
              // What the list's keys move between: see `useListKeys`.
              <div data-row="" key={principle.slug}>
                <ClickableCard
                  height="100%"
                  href={href(principle)}
                  label={principleName(principle)}
                  padding={3}
                  // The open principle has the grey fill of a selected row.
                  variant={selected === principle.slug ? "gray" : "default"}
                >
                  <VStack gap={1}>
                    <Text weight="semibold">{principleName(principle)}</Text>
                    <Text color="secondary" type="supporting">
                      {firstRule(constitution, principle)}
                    </Text>
                  </VStack>
                </ClickableCard>
              </div>
            ))}
          </div>
        )}
        {constitution && narrow && (
          // On a phone, a compact list: six cards would push the decisions down a whole screen.
          <List aria-label="Principles" hasDividers>
            {constitution.principles.map((principle) => (
              <ListItem
                data-row=""
                description={<Text color="secondary">{firstRule(constitution, principle)}</Text>}
                href={href(principle)}
                isSelected={selected === principle.slug}
                key={principle.slug}
                label={<Text weight="medium">{principleName(principle)}</Text>}
              />
            ))}
          </List>
        )}
        {!constitution && <Paragraph>No constitution yet.</Paragraph>}
      </VStack>
    </section>
  );
}
