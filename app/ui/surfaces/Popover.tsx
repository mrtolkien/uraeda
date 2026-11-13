// A popover: an overlay placed against what opened it, for a menu or a selector, never for
// content to read. It stays a popover at every width, on a narrow window too. It takes the keys
// and the focus while it is open, the page is not dimmed, and Escape, the phone's Back, or a
// press outside it asks to close: that press goes on to what is under it.
import type { Bounds, JSX, Point, StyleProp, ViewRef, ViewStyle } from "nsh";
import type { Scope } from "../keys/store";
import { Float } from "./Float";
import { tokens } from "../tokens";

export type PopoverProps = {
  /** How it lines up with its anchor along that side: `start` unless given. */
  align?: "start" | "center" | "end";
  /** What it is placed against: the view that opened it, a point, or a box of the window. */
  anchor: ViewRef | Point | Bounds | null | undefined;
  children?: JSX.Element;
  /** What the key map calls its layer. */
  name: string;
  onClose?: () => void;
  /** Shown while true, and for its way out after: true unless given. */
  open?: boolean;
  /** The side of its anchor it goes on, the other one where only that has room: `bottom`. */
  placement?: "top" | "bottom" | "left" | "right";
  /** Its layer's key scope, for content that declares keys (`Float`'s `scope`). */
  scope?: Scope;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  width?: number;
};

export function Popover(props: PopoverProps) {
  return (
    <Float
      align={props.align ?? "start"}
      anchor={props.anchor ?? null}
      keys
      name={props.name}
      onClose={props.onClose}
      open={props.open}
      place={() => ({ box: { width: props.width }, rise: tokens.motion.rise })}
      placement={props.placement}
      scrim={false}
      scope={props.scope}
      style={props.style}
      testID={props.testID}
      trap={false}
    >
      {props.children}
    </Float>
  );
}
