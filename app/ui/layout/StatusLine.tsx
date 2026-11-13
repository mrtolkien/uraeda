// The status line, at the window's foot on a wide and a semi-wide window, in LazyVim's shape: a
// block in the editing mode's colour at each end, the mode at the left and the place at the right,
// and between them what the app's shell puts there (the branch, the counts, the connection), with
// the hints of the keys that work where the focus is, each a button that does what its key does.
// It is raised glass, as the design language has it.
import { type JSX, View } from "nsh";
import { Kbd, Text } from "../controls";
import { keyHints, missedKeys, pressKeys, type StatusHint } from "../keys/registry";
import { Surface } from "../surfaces";
import { tokens } from "../tokens";

/** What the app's shell puts in the status line: its slots. */
export type StatusSlots = {
  /** After the hints, at the right: the connection's state, the counts. */
  end?: JSX.Element;
  /** The editing mode's word, "NAV", "NORMAL", "INSERT", and its colour, the accent's unless given. */
  mode?: { colour?: string; label: string };
  /** The right end's block: where the human is, "27:61". */
  place?: string;
  /** After the mode, at the left: the branch a page names, its place. */
  start?: JSX.Element;
};

/** A block at one end, in the mode's colour, its word in the dark ink on it. */
function End(props: { colour: string; label: string }) {
  return (
    <View
      style={{
        backgroundColor: props.colour,
        justifyContent: "center",
        paddingHorizontal: tokens.status.padding,
      }}
    >
      <Text bold colour={tokens.role.onAction} lines={1}>
        {props.label}
      </Text>
    </View>
  );
}

/** A hint's row: a key's block, 22 points, with a point of room over and under it. */
const HINT_ROW = 24;

/**
 * The hints of the keys that work now: each a key and its word, pressed as the key is. They wrap
 * inside one line's height, so a hint the line cannot hold is hidden whole, from the end, never cut
 * through its word.
 */
function Hints() {
  return (
    <View
      style={{
        alignContent: "flex-start",
        alignItems: "center",
        columnGap: 14,
        flexDirection: "row",
        flexShrink: 1,
        flexWrap: "wrap",
        height: HINT_ROW,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* A key the leader's menu did not have closed it: said for a moment, before the hints. */}
      <If when={missedKeys()}>
        {(keys) => (
          <View style={{ alignItems: "center", flexDirection: "row", flexShrink: 0, gap: 6 }}>
            <Kbd keys={keys()} />
            <Text lines={1} tone="caution">
              is no key here
            </Text>
          </View>
        )}
      </If>
      <Each key={(hint: StatusHint) => `${hint.keys} ${hint.label}`} of={keyHints()}>
        {(hint) => (
          <View
            accessibilityLabel={`${hint().label}: ${hint().keys}`}
            hoverStyle={{ backgroundColor: tokens.row.selected }}
            onPress={() => pressKeys(hint().press)}
            role="button"
            style={{
              alignItems: "center",
              flexDirection: "row",
              flexShrink: 0,
              gap: 6,
              height: HINT_ROW,
            }}
          >
            <Kbd keys={hint().keys} />
            <Text lines={1} tone="quiet">
              {hint().label}
            </Text>
          </View>
        )}
      </Each>
    </View>
  );
}

export function StatusLine(props: StatusSlots) {
  const colour = () => props.mode?.colour ?? tokens.light.mode.normal;
  return (
    <Surface
      glass
      height="raised"
      style={{ flexDirection: "row", height: tokens.status.height }}
      testID="status-line"
    >
      <End colour={colour()} label={props.mode?.label ?? "NAV"} />
      <If when={props.start}>
        {(start) => (
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              paddingHorizontal: tokens.status.padding,
            }}
          >
            {start()}
          </View>
        )}
      </If>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          minWidth: 0,
          paddingHorizontal: tokens.status.padding,
        }}
      >
        <Hints />
      </View>
      <If when={props.end}>
        {(end) => (
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              paddingHorizontal: tokens.status.padding,
            }}
          >
            {end()}
          </View>
        )}
      </If>
      <If when={props.place}>{(place) => <End colour={colour()} label={place()} />}</If>
    </Surface>
  );
}
