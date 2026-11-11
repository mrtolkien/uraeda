// A tip: a few words beside what the pointer rests on, as what an icon does. It adds to what is
// already reachable, and never holds the only way to anything: nothing is reached by hovering
// alone. It takes neither the keys nor the focus, and a press or the pointer leaving puts it away.
import {
  cleanup,
  type JSX,
  signal,
  type StyleProp,
  Text,
  View,
  type ViewRef,
  type ViewStyle,
} from "nsh";
import { Float } from "./Float";
import { tokens } from "../tokens";

/** How long the pointer rests before the tip shows, in milliseconds. */
const REST = 600;

export type TooltipProps = {
  /** What the tip is about: the pointer resting on it shows the tip. */
  children?: JSX.Element;
  /** The side of its trigger it goes on, the other one where only that has room: `top`. */
  placement?: "top" | "bottom" | "left" | "right";
  /** The style of the box around what it is about. */
  style?: StyleProp<ViewStyle>;
  /** The tip's words. */
  text: string;
};

export function Tooltip(props: TooltipProps) {
  const open = signal(false);
  let trigger: ViewRef | undefined;
  let resting: ReturnType<typeof setTimeout> | undefined;
  const hide = () => {
    clearTimeout(resting);
    open.set(false);
  };
  cleanup(hide);
  return (
    <View
      onMouseEnter={() => {
        clearTimeout(resting);
        resting = setTimeout(() => open.set(true), REST);
      }}
      onMouseLeave={hide}
      onPressDown={hide}
      ref={(node: ViewRef) => (trigger = node)}
      style={props.style}
    >
      {props.children}
      <Float
        align="center"
        anchor={trigger ?? null}
        keys={false}
        name={props.text}
        open={open()}
        place={() => ({ rise: tokens.motion.rise / 2 })}
        placement={props.placement ?? "top"}
        scrim={false}
        style={{ paddingHorizontal: 8, paddingVertical: 3 }}
        trap={false}
      >
        <Text
          style={{
            color: tokens.role.ink,
            fontFamily: tokens.type.body,
            fontSize: tokens.type.under,
            lineHeight: tokens.type.line,
          }}
        >
          {props.text}
        </Text>
      </Float>
    </View>
  );
}
