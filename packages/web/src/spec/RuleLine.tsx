// A decision's part as its ledger draws it: its words, as the core compared them, added ones in an
// `ins`, green with a wavy underline, removed ones in a `del`, red and struck, so a change never
// rests on colour alone; and a rule, its strength's icon first, coloured by strength, then its
// words, then how it is checked on a muted line of its own.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { Run } from "uraeda-binding";
import { Paragraph } from "../layout/Paragraph.tsx";
import { isStrength, type Strength, strengthIcon } from "../theme/icons.ts";

const styles = stylex.create({
  added: {
    // Added words: a green tint and a wavy underline, so the change does not rest on colour alone.
    backgroundColor: colorVars["--color-background-green"],
    textDecorationColor: colorVars["--color-icon-green"],
    textDecorationLine: "underline",
    textDecorationStyle: "wavy",
    textUnderlineOffset: "0.2em",
  },
  icon: {
    flexShrink: 0,
    // The icon on the first line of the rule, beside its first words.
    marginBlockStart: spacingVars["--spacing-0-5"],
  },
  intent: {
    // A decision's intent, the first thing read: its largest text after its title, as the
    // spec's lead is.
    fontSize: typeScaleVars["--text-heading-3-size"],
    lineHeight: typeScaleVars["--text-heading-3-leading"],
  },
  removed: {
    // Removed words: a red tint and a strike, so the change does not rest on colour alone.
    backgroundColor: colorVars["--color-background-red"],
    textDecorationColor: colorVars["--color-icon-red"],
    textDecorationLine: "line-through",
  },
  text: {
    margin: 0,
    // A long path or name breaks rather than push the ledger past a phone's screen.
    overflowWrap: "anywhere",
  },
  whole: {
    // A part removed whole: struck, its sign saying the rest, without a tint of its own.
    textDecorationColor: colorVars["--color-icon-red"],
    textDecorationLine: "line-through",
  },
});

/**
 * Each strength's colour (review comment C1 of the spec): MUST hard green, SHOULD soft green,
 * SHOULD NOT soft red, MUST NOT hard red, MAY neutral. A soft colour is the hard one four fifths
 * over the surface the rule sits on, its pane's (`--pane-surface`, the page's on the phone, where
 * the pane has no background) else the body's: so it keeps 3:1 over it in both schemes, a row's
 * tint included (`ledger/Rows.tsx`), where three quarters fell under it.
 */
const colours = stylex.create({
  may: { color: colorVars["--color-icon-secondary"] },
  must: { color: colorVars["--color-icon-green"] },
  "must-not": { color: colorVars["--color-icon-red"] },
  should: {
    color: `color-mix(in srgb, ${colorVars["--color-icon-green"]} 80%, var(--pane-surface, ${colorVars["--color-background-body"]}))`,
  },
  "should-not": {
    color: `color-mix(in srgb, ${colorVars["--color-icon-red"]} 80%, var(--pane-surface, ${colorVars["--color-background-body"]}))`,
  },
});

/** The name a screen reader reads for each strength. */
const LABELS: Record<Strength, string> = {
  may: "May",
  must: "Must",
  "must-not": "Must not",
  should: "Should",
  "should-not": "Should not",
};

/**
 * The words of a part, as the core compared them: added ones in an `ins`, removed ones in a `del`.
 * `whole` for a part added or removed whole: an added one reads plain, its sign saying so, a removed
 * one struck in one `del`.
 */
export function Runs({ runs, whole = false }: { runs: ReadonlyArray<Run>; whole?: boolean }) {
  if (whole) {
    const text = runs.map((run) => run.text).join(" ");
    const removed = runs.length > 0 && runs.every((run) => run.kind === "removed");
    return removed ? <del {...stylex.props(styles.whole)}>{text}</del> : text;
  }
  return runs.map((run, index) => {
    const space = index > 0 ? " " : "";
    if (run.kind === "kept") {
      return `${space}${run.text}`;
    }
    const Mark = run.kind === "added" ? "ins" : "del";
    return (
      <span key={index}>
        {space}
        <Mark {...stylex.props(run.kind === "added" ? styles.added : styles.removed)}>
          {run.text}
        </Mark>
      </span>
    );
  });
}

/** A strength's icon, coloured by strength, named for screen readers. */
export function StrengthIcon({ strength }: { strength: Strength }) {
  return (
    <Icon
      icon={strengthIcon(strength)}
      label={LABELS[strength]}
      size="md"
      xstyle={[styles.icon, colours[strength]]}
    />
  );
}

/**
 * A part's text: a rule, with the core's `strength`, draws its icon, then its words, then its
 * check on a muted line; the intent's, `intent`, its words in large text; any other part, its
 * words as a paragraph. `whole` for a part added or removed whole.
 */
export function PartText({
  check,
  intent,
  runs,
  strength,
  whole,
}: {
  /** A rule's check, from the core: its words after "Checked by". */
  check: ReadonlyArray<Run>;
  intent: boolean;
  runs: ReadonlyArray<Run>;
  strength: string | undefined;
  whole: boolean;
}) {
  if (intent) {
    return (
      <Text as="div" display="block" type="inherit" xstyle={styles.intent}>
        <Runs runs={runs} whole={whole} />
      </Text>
    );
  }
  if (!isStrength(strength)) {
    return (
      <Paragraph xstyle={styles.text}>
        <Runs runs={runs} whole={whole} />
      </Paragraph>
    );
  }
  return (
    <HStack align="start" gap={2}>
      <StrengthIcon strength={strength} />
      <VStack gap={0.5}>
        <Paragraph xstyle={styles.text}>
          <Runs runs={runs} whole={whole} />
        </Paragraph>
        {check.length > 0 && (
          <Text color="secondary" display="block" type="supporting">
            <Runs runs={check} whole={whole} />
          </Text>
        )}
      </VStack>
    </HStack>
  );
}
