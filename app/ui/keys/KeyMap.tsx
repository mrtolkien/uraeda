// The key map, `?`: every key that works where the human is, as the registry declares them
// (`keyMap.ts`), with a search over them. A reference, not a palette: its rows run nothing, for a
// page's key acts on the selection the map covers, and the leader menu already runs the sequences.
// It floats in the window's middle over the page dimmed, a sheet on a narrow window, and owns the
// keys while it is open: Escape, a press outside, and the phone's Back close it.
//
// TASK 30: the search is Native Shell's plain `Input` until the shared text field exists.
import { Icon, isIconName, Kbd, Text } from "../controls";
import { tokens } from "../tokens";
import { type InputRef, Scroll, signal, View } from "nsh";
import { Input } from "nsh/base";
import { type KeyRow, type KeySection, searchKeyMap } from "./keyMap";
import { focusStop, Overlay } from "../surfaces";

/** What the key map is called: its layer, and the keys that open it. */
export const KEY_MAP_TITLE = "Keyboard shortcuts";

/** A row: its keys, each sequence as typed, then what they do. */
function Row(props: { row: KeyRow }) {
  return (
    <View
      style={{ alignItems: "center", flexDirection: "row", gap: 8, minHeight: tokens.space.row }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, minWidth: 112 }}>
        <Each key={(keys: Array<string>) => keys.join(" ")} of={props.row.keys}>
          {(keys: () => Array<string>) => (
            <View style={{ flexDirection: "row", gap: 2 }}>
              <Each of={keys()}>{(token: () => string) => <Kbd keys={token()} />}</Each>
            </View>
          )}
        </Each>
      </View>
      <If when={props.row.icon !== undefined && isIconName(props.row.icon) ? props.row.icon : null}>
        {(name) => <Icon name={name()} />}
      </If>
      <Text>{props.row.label}</Text>
    </View>
  );
}

/** The search over the rows, and the rows it finds. */
function Rows(props: { sections: ReadonlyArray<KeySection> }) {
  const query = signal("");
  const found = () => searchKeyMap(props.sections, query());
  // The layer takes the focus where typing goes, as it opens.
  let search: InputRef | undefined;
  const stop = focusStop(() => search, { first: true });
  return (
    <>
      <Input
        accessibilityLabel="Search the keys"
        autoFocus
        onBlur={stop.onBlur}
        onChange={({ value }) => query.set(value)}
        onFocus={stop.onFocus}
        placeholder="Search…"
        ref={(node: InputRef) => (search = node)}
        style={{
          borderColor: tokens.role.rule,
          borderWidth: 1,
          color: tokens.role.ink,
          fontFamily: tokens.type.body,
          fontSize: tokens.type.size,
          height: tokens.space.row + 8,
          paddingHorizontal: 8,
          placeholderColor: tokens.role.inkQuiet,
        }}
        testID="key-map-search"
      />
      <Scroll style={{ flexShrink: 1 }}>
        <If when={found().length > 0} else={<Text tone="quiet">No key matches.</Text>}>
          <View style={{ columnGap: 32, flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
            <Each key={(section: KeySection) => section.title} of={found()}>
              {(section: () => KeySection) => (
                <View style={{ minWidth: 320 }}>
                  <Text tone="quiet">{section().title}</Text>
                  <Each key={(row: KeyRow) => row.label} of={section().rows}>
                    {(row: () => KeyRow) => <Row row={row()} />}
                  </Each>
                </View>
              )}
            </Each>
          </View>
        </If>
      </Scroll>
    </>
  );
}

/**
 * The key map over `sections`, while `open`: `onClose` once Escape, Back, or a press outside asks
 * to close it. Its search starts empty at each opening.
 */
export function KeyMap(props: {
  onClose: () => void;
  open?: boolean;
  sections: ReadonlyArray<KeySection>;
}) {
  return (
    <Overlay
      name={KEY_MAP_TITLE}
      onClose={() => props.onClose()}
      open={props.open}
      testID="key-map"
      title={KEY_MAP_TITLE}
      width={760}
    >
      <Rows sections={props.sections} />
    </Overlay>
  );
}
