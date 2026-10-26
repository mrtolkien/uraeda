// Lines a change added and removed, "+120 −4", in the success and error colours, with tabular
// figures: the same on a sidebar's card and a feature's column (UI coherence).
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  // In a row, it keeps its width: the two counts never part.
  added: { color: colorVars["--color-success"] },
  counts: { flexShrink: 0 },
  removed: { color: colorVars["--color-error"] },
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
