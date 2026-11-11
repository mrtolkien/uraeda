// The leader menu: the keys pressed so far as its title, then what each next key does, a group
// marked by an arrow, in alphabetical order of their keys. It floats at the window's bottom right,
// above the status line, and on a narrow window spans its width, as a sheet does. Each row is
// pressed as its key is, and so are the keys that go back and close. `LeaderMenuHost` draws it for
// the registry's pending sequence, once it is shown.
import { computed, View } from "nsh";
import { isNarrow, look } from "./look";
import { KeyCap, Words } from "./parts";
import { keysOn, pendingKeys, pressKeys } from "./registry";
import { entriesAt, type MenuEntry, sortedEntries } from "./sequence";
import { LEADER } from "./token";
import { Overlay } from "../surfaces";

/** A key of the path as the title writes it: Space is `Space`, any other as typed. */
const said = (key: string) => (key === LEADER ? "Space" : key);

/** How many rows a column holds before the next begins. */
const ROWS = 12;

/** A key and what it does, pressed as the key is: the focus stays where it was. */
function Press(props: { keys: string; word: string }) {
  return (
    <View
      focusable={false}
      onPress={() => pressKeys(props.keys)}
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
        // A finger's target on a narrow window, a row's height elsewhere.
        minHeight: isNarrow() ? 44 : look().row,
      }}
    >
      <KeyCap token={props.keys} />
      <Words>{props.word}</Words>
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
      <View
        style={{
          columnGap: 24,
          flexDirection: "column",
          flexWrap: isNarrow() ? "nowrap" : "wrap",
          maxHeight: isNarrow() ? undefined : ROWS * look().row,
          minWidth: isNarrow() ? undefined : 240,
        }}
      >
        <Each
          key={(entry: MenuEntry) => `${entry.key} ${entry.label}`}
          of={sortedEntries(props.entries)}
        >
          {(entry: () => MenuEntry) => (
            <Press
              keys={entry().key}
              word={entry().isGroup === true ? `${entry().label} →` : entry().label}
            />
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
