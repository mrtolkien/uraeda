// The leader menu: the keys pressed so far in the title of a bordered pane, then what each next key
// does, each with its icon, a group marked by an arrow, in alphabetical order of their keys. It sits
// at the window's bottom right, above the status line, and on narrow screens spans the window's
// width, as the UI layout decision's sheets do. `LeaderMenuHost` feeds it the registry's step.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { Pane } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { KeyCap } from "./KeyCap.tsx";

/** What a key does at this step: a group opens the next step, anything else runs. */
export type MenuEntry = {
  icon: ComponentProps<typeof Icon>["icon"];
  isGroup?: boolean;
  key: string;
  label: string;
};

const styles = stylex.create({
  entries: {
    columnGap: spacingVars["--spacing-6"],
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: "repeat(12, auto)",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  entry: {
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-2"],
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

/** Whether a key is a letter or a digit: the keys that are not come first. */
const isLetter = (key: string) => /^[\p{L}\p{N}]$/u.test(key);

/** The entries in alphabetical order of their keys, Space and the symbols first. */
export function sortedEntries(entries: ReadonlyArray<MenuEntry>): Array<MenuEntry> {
  return entries.toSorted((a, b) => {
    if (a.key === "space" || b.key === "space") {
      return a.key === b.key ? 0 : a.key === "space" ? -1 : 1;
    }
    if (isLetter(a.key) !== isLetter(b.key)) {
      return isLetter(a.key) ? 1 : -1;
    }
    return a.key.localeCompare(b.key, "en", { sensitivity: "base" }) || (a.key < b.key ? 1 : -1);
  });
}

/** A key as the menu draws it: Space is its icon, any other the key as typed. */
function Key({ name }: { name: string }) {
  return <KeyCap>{name === "space" ? <Icon icon="uraeda:space" label="Space" /> : name}</KeyCap>;
}

/** A key of the path as the title writes it: Space is `Space`, any other as typed. */
const written = (key: string) => (key === "space" ? "Space" : key);

/** The menu at a step: `path` is the keys pressed, the first included, `entries` the next keys. */
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
      <Pane isActive isGroup title={path.map(written).join(" ")}>
        <ul {...stylex.props(styles.entries, narrow && styles.oneColumn)}>
          {sortedEntries(entries).map((entry) => (
            <li key={entry.key}>
              <Text type="supporting" xstyle={styles.entry}>
                <Key name={entry.key} />
                <Icon icon={entry.icon} size="sm" />
                {entry.isGroup === true ? `${entry.label} →` : entry.label}
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
