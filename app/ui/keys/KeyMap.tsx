// The key map, `?`: every key that works where the human is, as the registry declares them
// (`keyMap.ts`), with a search over them. A reference, not a palette: its rows run nothing, for a
// page's key acts on the selection the map covers, and the leader menu already runs the sequences.
// It floats in the window's middle over the page dimmed, a sheet on a narrow window, and owns the
// keys while it is open: Escape, a press outside, and the phone's Back close it.
//
// TASK 30: the search is Native Shell's plain `Input` until the shared text field exists.
import { effect, type InputRef, Scroll, signal, View } from "nsh";
import { Input } from "nsh/base";
import { type KeyRow, type KeySection, searchKeyMap } from "./keyMap";
import { look } from "./look";
import { KeyCap, Panel, Words } from "./parts";
import { keyScope, registerKey } from "./registry";

/** What the key map is called: its layer, and the keys that open it. */
export const KEY_MAP_TITLE = "Keyboard shortcuts";

/** A row: its keys, each sequence as typed, then what they do. */
function Row(props: { row: KeyRow }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, minHeight: look().row }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, minWidth: 112 }}>
        <Each key={(keys: Array<string>) => keys.join(" ")} of={props.row.keys}>
          {(keys: () => Array<string>) => (
            <View style={{ flexDirection: "row", gap: 2 }}>
              <Each of={keys()}>{(token: () => string) => <KeyCap token={token()} />}</Each>
            </View>
          )}
        </Each>
      </View>
      <Words>{props.row.label}</Words>
    </View>
  );
}

/** The key map over `sections`; `onClose` once Escape, Back, or a press outside closes it. */
export function KeyMap(props: { onClose: () => void; sections: ReadonlyArray<KeySection> }) {
  const query = signal("");
  const found = () => searchKeyMap(props.sections, query());
  const layer = keyScope({ kind: "layer", name: KEY_MAP_TITLE });
  // Heard in the search too, which has the focus.
  registerKey(
    {
      hint: "esc",
      hintLabel: "close",
      inField: true,
      keys: "Escape",
      label: "Close",
      run: () => props.onClose(),
    },
    layer,
  );
  // The layer takes the focus where typing goes: a window on GTK gives a new field none.
  let search: InputRef | undefined;
  effect(() => search?.focus());
  return (
    <Panel onClose={() => props.onClose()} place="middle" testID="key-map" width={760}>
      <Words tone="accent">{KEY_MAP_TITLE}</Words>
      <Input
        accessibilityLabel="Search the keys"
        autoFocus
        ref={(node: InputRef) => (search = node)}
        onChange={({ value }) => query.set(value)}
        placeholder="Search…"
        style={{
          borderColor: look().edge,
          borderWidth: 1,
          color: look().text,
          fontFamily: look().type.mono,
          fontSize: look().type.size,
          height: look().row + 8,
          paddingHorizontal: 8,
          placeholderColor: look().quiet,
        }}
        testID="key-map-search"
      />
      <Scroll style={{ flexShrink: 1 }}>
        <If when={found().length > 0} else={<Words tone="quiet">No key matches.</Words>}>
          <View style={{ columnGap: 32, flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
            <Each key={(section: KeySection) => section.title} of={found()}>
              {(section: () => KeySection) => (
                <View style={{ minWidth: 320 }}>
                  <Words tone="quiet">{section().title}</Words>
                  <Each key={(row: KeyRow) => row.label} of={section().rows}>
                    {(row: () => KeyRow) => <Row row={row()} />}
                  </Each>
                </View>
              )}
            </Each>
          </View>
        </If>
      </Scroll>
    </Panel>
  );
}
