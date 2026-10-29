// Custom properties set to tokens: a theme's `var()`, a calc of them, an imported token, a keyword,
// `0`, and a unit of the layout, one line. Allowed by `stylex/custom-property-tokens`.
import { borderVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  line: {
    "--bleed": `calc(-1 * ${spacingVars["--spacing-3"]})`,
    "--edge": `calc(var(--size-rail-inset) + ${borderVars["--border-width"]})`,
    "--inset": "var(--page-inset, 0px)",
    "--line": "1lh",
    "--measure": "none",
    "--reach": 0,
    "--tall": "calc(2 * var(--size-label-line))",
    height: "var(--line)",
  },
});

export function TokenCustomProperty() {
  return <p {...stylex.props(styles.line)}>Line</p>;
}
