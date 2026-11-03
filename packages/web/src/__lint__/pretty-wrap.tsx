// Prose wrapped `pretty`: refused by `stylex/valid-styles`, since Safari shortens every line of it.
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  text: { textWrap: "pretty" },
});

export function PrettyWrap() {
  return <p {...stylex.props(styles.text)}>A paragraph</p>;
}
