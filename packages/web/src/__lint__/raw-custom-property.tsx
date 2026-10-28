// A raw length in a custom property read back with `var()`, which `valid-styles` takes for any
// `--*` key: refused by `stylex/custom-property-tokens`.
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  line: { "--line": "5px", height: "var(--line)" },
});

export function RawCustomProperty() {
  return <p {...stylex.props(styles.line)}>Line</p>;
}
