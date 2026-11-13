// A well: the recessed surface, for what is typed or shown as it was written, a field, a code
// block, a diff, the composer. It is shaded under its top edge, and wherever it is cut it keeps
// its recipe: in a card it takes the page's fill, in a well or in glass it darkens what it is in.
// With the focus its edge and its glow take the editing mode's colour.
import type { JSX, StyleProp, ViewRef, ViewStyle } from "nsh";
import { Surface } from "./Surface";

export type WellProps = {
  children?: JSX.Element;
  /** Whether the keys go here: a field that is typed in. */
  focused?: boolean;
  /** A press on it: a field's focus, from anywhere in its frame. */
  onPress?: () => void;
  ref?: (node: ViewRef) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** The editing mode's colour, `tokens.light.mode.insert`: the accent without one. */
  tone?: string;
};

export function Well(props: WellProps) {
  return (
    <Surface
      focused={props.focused}
      height="recessed"
      onPress={props.onPress}
      ref={props.ref}
      style={props.style}
      testID={props.testID}
      tone={props.tone}
    >
      {props.children}
    </Surface>
  );
}
