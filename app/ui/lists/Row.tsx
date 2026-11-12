// A row of a list: one line of the grid, 28 points high, or a finger's 44 on a narrow window, and
// taller where what it holds wraps. The cursor's row has a fill one step up and a 2 px bar on its
// left edge: lit, in `light.focus`, while the list's keys work (its pane has the focus), and unlit,
// in the edge's colour, while they do not, so a pane at rest still shows where its cursor is and
// only the focused pane emits light. A list never glows. A row being moved takes the same look,
// and its list draws it over the others. What is open now, the "current" row, is not the cursor:
// its words are in the accent (`Line`'s `current`).
//
// The pointer moving onto a row hears `onPoint`, which moves a list's cursor there; a row that
// slides under a resting pointer, as the list scrolls, hears nothing, so the keys' cursor is never
// taken from under them.
import { type JSX, type StyleProp, View, type ViewRef, type ViewStyle } from "nsh";
import { RevealContext } from "../layout/here";
import { keysWorkHere } from "../keys/registry";
import { useHeight } from "../surfaces/height";
import { tokens } from "../tokens";
import { isNarrow } from "../width";

export type RowProps = {
  accessibilityLabel?: string;
  children?: JSX.Element;
  /** Being moved: drawn as selected, while its list carries it. */
  lifted?: boolean;
  onLongPress?: () => void;
  /** The pointer moved onto it. */
  onPoint?: () => void;
  onPress?: () => void;
  /** A quiet line under it, between it and the next row. */
  rule?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A row's least height: the grid's line, or what a finger needs on a narrow window. */
export const rowHeight = () => (isNarrow() ? tokens.control.touch : tokens.space.row);

/**
 * The bar on the cursor's left edge: lit while the keys work where it is drawn, unless `lit` says
 * otherwise, as a list whose keys a section of its pane holds.
 */
export function Bar(props: { lit?: boolean }) {
  const works = keysWorkHere();
  const lit = () => props.lit ?? works();
  // The cursor the keys moved here comes into view: its pane scrolls to it.
  const reveal = RevealContext();
  const shown = (view: ViewRef) => {
    if (reveal !== null && works()) queueMicrotask(() => reveal(view));
  };
  return (
    <View
      ref={shown}
      style={{
        backgroundColor: lit() ? tokens.light.focus : tokens.row.barRest,
        bottom: 0,
        boxShadow: lit() ? tokens.row.barGlow : "none",
        left: 0,
        position: "absolute",
        top: 0,
        width: tokens.row.bar,
      }}
    />
  );
}

export function Row(props: RowProps) {
  const ground = useHeight();
  // One step up from what it sits on: the raised fill on a pane, a wash over a card.
  const fill = () => (ground() === "raised" ? tokens.row.selectedUp : tokens.row.selected);
  return (
    <View
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ selected: props.selected === true }}
      onLongPress={props.onLongPress}
      onMouseMove={props.onPoint === undefined ? undefined : () => props.onPoint?.()}
      onPress={props.onPress}
      role={props.onPress === undefined ? undefined : "button"}
      style={[
        {
          alignItems: "center",
          backgroundColor: props.selected === true || props.lifted === true ? fill() : undefined,
          borderBottomColor: tokens.row.rule,
          borderBottomWidth: props.rule === true ? 1 : 0,
          flexDirection: "row",
          gap: 8,
          minHeight: rowHeight(),
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
        props.style,
      ]}
      testID={props.testID}
    >
      <If when={props.selected === true || props.lifted === true}>
        <Bar lit={props.lifted === true ? true : undefined} />
      </If>
      {props.children}
    </View>
  );
}
