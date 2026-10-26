// The leader menu: the keys pressed so far in the title of a bordered pane, then what each next key
// does, a group marked by an arrow. It sits at the window's bottom right, above the status line,
// and on narrow screens spans the window's width, as the UI layout decision's sheets do. A mockup
// of the leader-key spec: the registry (a later task) feeds it its entries.
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Pane } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { KeyCap } from "./KeyCap.tsx";

/** What a key does at this step: a group opens the next step, anything else runs. */
export type MenuEntry = { isGroup?: boolean; key: string; label: string };

const styles = stylex.create({
  entries: {
    columnGap: spacingVars["--spacing-6"],
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: "repeat(10, auto)",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  oneColumn: {
    gridAutoFlow: "row",
    gridTemplateRows: "none",
  },
  place: {
    insetBlockEnd: `calc(var(--size-status-line, 0px) + ${spacingVars["--spacing-2"]})`,
    insetInlineEnd: spacingVars["--spacing-3"],
    minWidth: "var(--size-leader-menu, 16rem)",
    position: "fixed",
    zIndex: 3,
  },
  sheet: {
    insetInline: spacingVars["--spacing-2"],
    minWidth: 0,
  },
});

/** The menu at a step: `path` is the keys pressed, `entries` the next keys. */
export function LeaderMenu({
  entries,
  path,
}: {
  entries: ReadonlyArray<MenuEntry>;
  path: ReadonlyArray<string>;
}) {
  const narrow = isNarrow(useWidthClass());
  return (
    <div {...stylex.props(styles.place, narrow && styles.sheet)}>
      <Pane isActive isGroup title={["Space", ...path].join(" ")}>
        <ul {...stylex.props(styles.entries, narrow && styles.oneColumn)}>
          {entries.map((entry) => (
            <li key={entry.key}>
              <Text type="supporting">
                <KeyCap>{entry.key}</KeyCap>{" "}
                {entry.isGroup === true ? `→ ${entry.label}` : entry.label}
              </Text>
            </li>
          ))}
        </ul>
        <Text color="secondary" type="supporting">
          <KeyCap>⌫</KeyCap> back <KeyCap>esc</KeyCap> close
        </Text>
      </Pane>
    </div>
  );
}
