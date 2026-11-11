// What the controls' gallery pages share: a pane per kind of control, and a line per variant with
// its name, then the variant in each state, side by side, since a picture cannot hover or press.
import { type JSX, View } from "nsh";
import { Text } from "../../ui/controls";
import type { PressState } from "../../ui/controls";
import { Pane } from "../../ui/surfaces";

/** The states drawn still, as `state` asks, then disabled, which is a prop. */
export const STATES: ReadonlyArray<PressState | "disabled"> = [
  "rest",
  "hover",
  "focus",
  "pressed",
  "disabled",
];

/** `state` as a control takes it: rest is its own. */
export const asked = (state: PressState | "disabled") =>
  state === "rest" || state === "disabled" ? undefined : state;

/** A pane of the page, as wide as a column, or the window on a narrow one. */
export function Part(props: {
  children?: JSX.Element;
  /** In a column of parts: as high as it holds. */
  inColumn?: boolean;
  narrow: boolean;
  title: string;
  wide?: boolean;
}) {
  return (
    <Pane
      body={{ gap: 6 }}
      style={
        props.inColumn === true
          ? undefined
          : { flexBasis: props.narrow ? "100%" : props.wide === true ? "62%" : "30%", flexGrow: 1 }
      }
      title={props.title}
    >
      {props.children}
    </Pane>
  );
}

/** A line: its name, then what it shows, wrapping on a narrow window. */
export function Line(props: { children?: JSX.Element; name: string; narrow: boolean }) {
  return (
    <View
      style={{
        alignItems: props.narrow ? "flex-start" : "center",
        flexDirection: props.narrow ? "column" : "row",
        gap: props.narrow ? 2 : 12,
      }}
    >
      <View style={{ width: props.narrow ? undefined : 96 }}>
        <Text size="under" tone="faint">
          {props.name}
        </Text>
      </View>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          flexShrink: 1,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {props.children}
      </View>
    </View>
  );
}

/** A page: its parts in columns that wrap. */
export function Page(props: { children?: JSX.Element; narrow: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: props.narrow ? 12 : 20,
        padding: props.narrow ? 8 : 24,
        paddingTop: props.narrow ? 22 : 34,
        rowGap: props.narrow ? 26 : 34,
      }}
    >
      {props.children}
    </View>
  );
}
