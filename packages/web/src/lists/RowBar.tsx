// What a row can do, under its text, each with its key as the status line writes it: "i edit",
// "o add", "d delete". It shows under the row the keys or a click picked, and under a row's field
// while it is edited, so a mouse and a finger reach what the keys do. A press keeps the focus where
// it is, in the row or in its field.
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { KeyCap } from "../keys/KeyCap.tsx";
import { keepFocus } from "../keys/press.ts";

/** One thing a row can do: its key as written, what it does, and doing it. */
export type BarAction = { keys: string; label: string; run: () => void };

const appear = stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const styles = stylex.create({
  // A line of its own under the text, over the row's stretched link so a press reaches it.
  bar: {
    animationDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "200ms" },
    animationName: appear,
    animationTimingFunction: "ease-out",
    columnGap: spacingVars["--spacing-3"],
    display: "flex",
    flexWrap: "wrap",
    paddingBlock: "0.125rem",
    position: "relative",
    zIndex: 2,
  },
  press: {
    background: "none",
    border: "none",
    color: { ":hover": colorVars["--color-text-primary"], default: "inherit" },
    cursor: "pointer",
    font: "inherit",
    padding: 0,
  },
});

/** The row's actions, in the order given. */
export function RowBar({ actions }: { actions: ReadonlyArray<BarAction> }) {
  return (
    // A press between its buttons keeps the focus too.
    <div onMouseDown={keepFocus} {...stylex.props(styles.bar)}>
      {actions.map((action) => (
        <Text color="secondary" key={action.label} type="supporting">
          <button
            onClick={(event) => {
              // Not the row's own click, which edits it or opens it.
              event.stopPropagation();
              action.run();
            }}
            type="button"
            {...stylex.props(styles.press)}
          >
            <KeyCap>{action.keys}</KeyCap> {action.label}
          </button>
        </Text>
      ))}
    </div>
  );
}
