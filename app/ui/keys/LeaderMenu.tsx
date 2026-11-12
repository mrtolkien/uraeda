// The leader menu: the keys pressed so far as its title, then what each next key does, each a
// chip, a `➜`, then its action, a group named after a `+`, in alphabetical order of their keys. It
// floats at the window's bottom right, above the status line, and on a narrow window spans its
// width, as a sheet does. Each row is pressed as its key is, and so are the keys that go back and
// close. `LeaderMenuHost` draws it for the registry's pending sequence, once it is shown.
import { computed, View } from "nsh";
import { isNarrow } from "../width";
import { Kbd, Text } from "../controls";
import { tokens } from "../tokens";
import { keysOn, pendingKeys, pressKeys } from "./registry";
import { entriesAt, type MenuEntry, sortedEntries } from "./sequence";
import { LEADER } from "./token";
import { Overlay } from "../surfaces";

/** A key of the path as the title writes it: Space is `Space`, any other as typed. */
const said = (key: string) => (key === LEADER ? "Space" : key);

/** How many rows a column holds before the next begins. */
const ROWS = 12;

type Column = { key: string; entries: ReadonlyArray<MenuEntry> };

/** The entries in columns of `ROWS`, one column on a narrow window, which scrolls as a sheet. */
function columnsOf(entries: ReadonlyArray<MenuEntry>): Column[] {
  if (isNarrow()) return [{ entries, key: "all" }];
  const columns: Column[] = [];
  for (let at = 0; at < entries.length; at += ROWS) {
    columns.push({ entries: entries.slice(at, at + ROWS), key: String(at) });
  }
  return columns;
}

/** A key and what it does, pressed as the key is: the focus stays where it was. */
function Press(props: { arrow?: boolean; keys: string; word: string }) {
  return (
    <View
      focusable={false}
      onPress={() => pressKeys(props.keys)}
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
        // A finger's target on a narrow window, a row's height elsewhere.
        minHeight: isNarrow() ? 44 : tokens.space.row,
      }}
    >
      <Kbd keys={props.keys} />
      <If when={props.arrow === true}>
        <Text tone="faint">➜</Text>
      </If>
      <Text>{props.word}</Text>
    </View>
  );
}

/** The menu at a step: `path` is the keys pressed, the first included, `entries` the next keys. */
export function LeaderMenu(props: {
  entries: ReadonlyArray<MenuEntry>;
  path: ReadonlyArray<string>;
}) {
  return (
    <Overlay
      name="Leader menu"
      place="corner"
      testID="leader-menu"
      title={props.path.map(said).join(" ")}
    >
      {/* Its columns made here: a wrapping column of rows does not widen its box in Native
          Shell's layout, which cut the second column off at the window's edge. */}
      <View style={{ columnGap: 24, flexDirection: isNarrow() ? "column" : "row" }}>
        <Each key={(column: Column) => column.key} of={columnsOf(sortedEntries(props.entries))}>
          {(column: () => Column) => (
            <View style={{ minWidth: isNarrow() ? undefined : 240 }}>
              <Each key={(entry: MenuEntry) => `${entry.key} ${entry.label}`} of={column().entries}>
                {(entry: () => MenuEntry) => (
                  <Press
                    arrow
                    keys={entry().key}
                    word={entry().isGroup === true ? `+${entry().label}` : entry().label}
                  />
                )}
              </Each>
            </View>
          )}
        </Each>
      </View>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Press keys="Backspace" word="back" />
        <Press keys="Escape" word="close" />
      </View>
    </Overlay>
  );
}

/** The leader's menu, while a sequence that is shown waits for its next key. */
export function LeaderMenuHost() {
  const shown = computed(() => {
    const step = pendingKeys();
    if (step === null || !step.isShown) {
      return null;
    }
    const specs = keysOn().map(({ spec }) => spec);
    return { entries: entriesAt(specs, step.path), path: step.path };
  });
  return (
    <If when={shown()}>{(menu) => <LeaderMenu entries={menu().entries} path={menu().path} />}</If>
  );
}
