// TEMPORARY: a decision's rule as the specs redesign's mockups draw it
// (`specs/2026-10-17-redesign-specs/`): its strength as an icon, MUST as two chevrons up, SHOULD as
// one, SHOULD NOT as one down, MUST NOT as two down, MAY as a dot, then its text, then how it is
// checked on a muted line of its own. The icons are Lucide's, drawn here: the implementation
// registers them in the theme's icons.
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  icon: {
    flexShrink: 0,
    height: spacingVars["--spacing-5"],
    marginBlockStart: spacingVars["--spacing-0-5"],
    width: spacingVars["--spacing-5"],
  },
  may: { color: colorVars["--color-text-secondary"] },
  must: { color: colorVars["--color-accent"] },
  mustNot: { color: colorVars["--color-error"] },
  should: { color: colorVars["--color-text-blue"] },
  shouldNot: { color: colorVars["--color-warning"] },
  text: {
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    margin: 0,
  },
});

/** How strongly a rule binds, from its first keyword. */
export type Strength = "must" | "mustNot" | "should" | "shouldNot" | "may";

/** A rule's strength: its first RFC 2119 keyword, MAY when it has none. */
export function strengthOf(text: string): Strength {
  const word = /MUST NOT|MUST|SHOULD NOT|SHOULD|MAY/.exec(text)?.[0];
  const strengths: Record<string, Strength> = {
    MAY: "may",
    MUST: "must",
    "MUST NOT": "mustNot",
    SHOULD: "should",
    "SHOULD NOT": "shouldNot",
  };
  return strengths[word ?? "MAY"] ?? "may";
}

/** The label a screen reader reads for each strength. */
const LABELS: Record<Strength, string> = {
  may: "May",
  must: "Must",
  mustNot: "Must not",
  should: "Should",
  shouldNot: "Should not",
};

/** The chevrons of each strength: Lucide's `chevrons-up`, `chevron-up`, and their downs. */
const PATHS: Record<Strength, ReadonlyArray<string>> = {
  may: [],
  must: ["m17 11-5-5-5 5", "m17 18-5-5-5 5"],
  mustNot: ["m7 6 5 5 5-5", "m7 13 5 5 5-5"],
  should: ["m18 15-6-6-6 6"],
  shouldNot: ["m6 9 6 6 6-6"],
};

/** A rule's strength as its icon, named for screen readers. */
export function StrengthIcon({ strength }: { strength: Strength }) {
  return (
    <svg
      aria-label={LABELS[strength]}
      fill="none"
      role="img"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      {...stylex.props(styles.icon, styles[strength])}
    >
      {strength === "may" ? (
        <circle cx={12} cy={12} fill="currentColor" r={3} />
      ) : (
        PATHS[strength].map((d) => <path d={d} key={d} />)
      )}
    </svg>
  );
}

/** A rule's text and its "Checked by" sentence, split apart. */
export function splitCheck(text: string): { check?: string; rule: string } {
  const at = text.indexOf(" Checked by ");
  return at < 0 ? { rule: text } : { check: text.slice(at + 1), rule: text.slice(0, at) };
}

/** A rule: its strength's icon, its text, and how it is checked on a muted line. */
export function RuleLine({
  check,
  children,
  strength,
}: {
  check?: ReactNode;
  children: ReactNode;
  strength: Strength;
}) {
  return (
    <HStack align="start" gap={2}>
      <StrengthIcon strength={strength} />
      <VStack gap={0.5}>
        <p {...stylex.props(styles.text)}>{children}</p>
        {check !== undefined && check !== null && check !== "" && (
          <Text color="secondary" type="supporting">
            {check}
          </Text>
        )}
      </VStack>
    </HStack>
  );
}
