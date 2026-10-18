// A decision's part as the spec page draws it: its words, as the core compared them, added ones
// green and underlined, removed ones red with a dotted underline, never struck; and a rule, its
// strength's icon first, coloured by strength, then its words, then how it is checked on a muted
// line of its own.
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
    // Added words: a green tint and an underline, so the change does not rest on colour alone.
    backgroundColor: colorVars["--color-background-green"],
    textDecorationColor: colorVars["--color-icon-green"],
    textDecorationLine: "underline",
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
    // Removed words: a red tint and a dotted underline, never struck, so they stay readable.
    backgroundColor: colorVars["--color-background-red"],
    textDecorationColor: colorVars["--color-icon-red"],
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
  },
  text: {
    margin: 0,
  },
  whole: {
    // A part added or removed whole: its tint, or its pill, says so, its words left unmarked.
    textDecorationLine: "none",
  },
});

/**
 * Each strength's colour (review comment C1 of the spec): MUST hard green, SHOULD soft green,
 * SHOULD NOT soft red, MUST NOT hard red, MAY neutral. A soft colour is the hard one three quarters
 * over the card's background.
 */
const colours = stylex.create({
  may: { color: colorVars["--color-icon-secondary"] },
  must: { color: colorVars["--color-icon-green"] },
  "must-not": { color: colorVars["--color-icon-red"] },
  should: {
    color: `color-mix(in srgb, ${colorVars["--color-icon-green"]} 75%, ${colorVars["--color-background-card"]})`,
  },
  "should-not": {
    color: `color-mix(in srgb, ${colorVars["--color-icon-red"]} 75%, ${colorVars["--color-background-card"]})`,
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

/** The words of a part, as the core compared them: `whole` for a part added or removed whole. */
export function Runs({ runs, whole = false }: { runs: ReadonlyArray<Run>; whole?: boolean }) {
  return runs.map((run, index) => {
    const space = index > 0 ? " " : "";
    if (run.kind === "kept") {
      return `${space}${run.text}`;
    }
    const role = run.kind === "added" ? "insertion" : "deletion";
    const style = whole ? styles.whole : run.kind === "added" ? styles.added : styles.removed;
    return (
      <span key={index}>
        {space}
        <span role={role} {...stylex.props(style)}>
          {run.text}
        </span>
      </span>
    );
  });
}

/** The words that start a rule's check, as decisions write it (R5 of the specs redesign). */
const CHECK = /(^|\s)Checked by\b/;

/**
 * A rule's runs, split where its check starts, "Checked by": the runs before, and the check's. A
 * run holding both is cut in two of its kind.
 */
export function splitCheck(runs: ReadonlyArray<Run>): { check: Array<Run>; rule: Array<Run> } {
  const at = runs.findIndex((run) => CHECK.test(run.text));
  if (at < 0) {
    return { check: [], rule: [...runs] };
  }
  const run = runs[at]!;
  const match = CHECK.exec(run.text)!;
  const cut = match.index + match[1]!.length;
  const before = run.text.slice(0, cut).trimEnd();
  const rule = [...runs.slice(0, at), ...(before ? [{ ...run, text: before }] : [])];
  return { check: [{ ...run, text: run.text.slice(cut) }, ...runs.slice(at + 1)], rule };
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
  intent,
  runs,
  strength,
  whole,
}: {
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
  const { check, rule } = splitCheck(runs);
  return (
    <HStack align="start" gap={2}>
      <StrengthIcon strength={strength} />
      <VStack gap={0.5}>
        <Paragraph xstyle={styles.text}>
          <Runs runs={rule} whole={whole} />
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
