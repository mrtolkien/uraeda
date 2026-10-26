// Lines a change added and removed, "+120 −4", in green and red, the theme's text colours that read
// at 4.5:1, with tabular figures: the same on a sidebar's card, a feature's column, and a session's
// changed files (UI coherence).
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  added: { color: colorVars["--color-text-green"] },
  // In a row, it keeps its width: the two counts never part.
  counts: { flexShrink: 0 },
  removed: { color: colorVars["--color-text-red"] },
});

/** "1,204": a count with its thousands grouped. */
const COUNT = new Intl.NumberFormat("en-US");

/** "+120 −4", as one line of text, as a link's accessible name reads it. */
export function diffLine(added: number, removed: number) {
  return `+${COUNT.format(added)} −${COUNT.format(removed)}`;
}

/**
 * Lines added and removed, each kept whole on its line, at the `type` of the text around them.
 * `isHidden` leaves them to the eye, when the row's name already reads them in words.
 */
export function DiffCount({
  added,
  isHidden = false,
  removed,
  type,
}: {
  added: number;
  isHidden?: boolean;
  removed: number;
  type?: "supporting";
}) {
  return (
    <span aria-hidden={isHidden || undefined} {...stylex.props(styles.counts)}>
      <Text hasTabularNumbers type={type} wrap="nowrap" xstyle={styles.added}>
        +{COUNT.format(added)}
      </Text>{" "}
      <Text hasTabularNumbers type={type} wrap="nowrap" xstyle={styles.removed}>
        −{COUNT.format(removed)}
      </Text>
    </span>
  );
}
