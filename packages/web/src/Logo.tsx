// Uraeda's logo: a tree drawn in an 8 × 8 grid of dots, in the text's colour, which its container
// sets. `public/favicon.svg` draws the same tree in Catppuccin's green.
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

/** The tree's rows, top to bottom: `x` is a dot. */
const ROWS = [
  "..xxxx..",
  ".xxxxxx.",
  "xxxxxxxx",
  ".xxxxxx.",
  "...xx...",
  "..xx....",
  "...xx...",
  "..xxxx..",
];

/** The dots' centres, in the grid's units. */
const DOTS = ROWS.flatMap((row, y) =>
  [...row].flatMap((cell, x) => (cell === "x" ? [{ x: x + 0.5, y: y + 0.5 }] : [])),
);

const styles = stylex.create({
  lg: { height: spacingVars["--spacing-8"], width: spacingVars["--spacing-8"] },
  logo: { flexShrink: 0 },
  md: { height: spacingVars["--spacing-6"], width: spacingVars["--spacing-6"] },
  sm: { height: spacingVars["--spacing-4"], width: spacingVars["--spacing-4"] },
});

/** The logo, named "Uraeda", at a size of the theme's spacing. */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <svg
      aria-label="Uraeda"
      fill="currentColor"
      role="img"
      viewBox="0 0 8 8"
      {...stylex.props(styles.logo, styles[size])}
    >
      {DOTS.map(({ x, y }) => (
        <circle cx={x} cy={y} key={`${x},${y}`} r={0.4} />
      ))}
    </svg>
  );
}
