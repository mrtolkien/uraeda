// A StyleX value that is not a token: refused by `stylex/valid-styles`.
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  text: { color: "#d00" },
});

export function RawColor() {
  return <p {...stylex.props(styles.text)}>Red</p>;
}
