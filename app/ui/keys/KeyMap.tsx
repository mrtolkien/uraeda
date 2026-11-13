// The key map, `?`: every key that works where the human is, as the registry declares them
// (`keyMap.ts`), with a search over them. A reference, not a palette: its rows run nothing, for a
// page's key acts on the selection the map covers, and the leader menu already runs the sequences.
// It floats in the window's middle over the page dimmed, a sheet on a narrow window, and owns the
// keys while it is open: Escape, a press outside, and the phone's Back close it.
import { Icon, isIconName, Kbd, Text } from "../controls";
import { tokens } from "../tokens";
import { Scroll, signal, View } from "nsh";
import { type KeyRow, type KeySection, searchKeyMap } from "./keyMap";
import { Overlay } from "../surfaces";
import { TextField } from "../text/TextField";

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
      {/* The icon's place is kept on every row, so the actions' words start on one column. */}
      <View style={{ width: tokens.control.icon }}>
        <If
          when={props.row.icon !== undefined && isIconName(props.row.icon) ? props.row.icon : null}
        >
          {(name) => <Icon name={name()} />}
        </If>
      </View>
      <Text>{props.row.label}</Text>
    </View>
  );
}

/** The search over the rows, and the rows it finds. */
function Rows(props: { sections: ReadonlyArray<KeySection> }) {
  const query = signal("");
  const found = () => searchKeyMap(props.sections, query());
  return (
    <>
      <TextField
        first
        label="Search the keys"
        lines="one"
        onChange={(value) => query.set(value)}
        placeholder="Search…"
        // Its whole height, over a list taller than the map: shrunk, it was drawn over the titles.
        style={{ flexShrink: 0 }}
        testID="key-map-search"
        value={query()}
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
