// Toasts: overlays that say what just happened, each with its icon and its title on its edge,
// stacked from the window's top, the most important first. A toast never takes the focus or the
// keys: what it offers is pressed, or has a key its owner declares. It is for an undo, a
// confirmation from another page, and the writes still landing, never for an error alone, which
// stays next to what it concerns. How long one stays is its owner's.
import { type JSX, Overlay as Layer, type StyleProp, Text, View, type ViewStyle } from "nsh";
import { presence } from "./presence";
import { Surface } from "./Surface";
import { isNarrow } from "../width";
import { tokens } from "../tokens";

/** The stack: at the window's top right, and across its top on a narrow window. */
export function Toasts(props: { children?: JSX.Element }) {
  return (
    <Layer
      style={[
        // A toast's plate stands over its top edge: the gap leaves it room.
        { gap: tokens.type.line / 2 + 10, position: "absolute", top: tokens.space.row },
        isNarrow() ? { left: 8, right: 8 } : { right: 12, width: 360 },
      ]}
    >
      {props.children}
    </Layer>
  );
}

export type ToastProps = {
  children?: JSX.Element;
  /** Before its title, on the plate. */
  icon?: JSX.Element;
  /** Shown while true, and for its way out after: true unless given. */
  open?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** What happened, as its button would say it: on the plate. */
  title: string;
};

/** One toast of the stack: it drops in from above, and fades out. */
export function Toast(props: ToastProps) {
  const there = presence(
    () => props.open !== false,
    () => ({ y: -tokens.motion.rise }),
  );
  return (
    <If when={there.shown()}>
      <View style={there.style}>
        <Surface
          height="overlay"
          testID={props.testID}
          style={[
            {
              gap: 8,
              padding: tokens.space.panePadding - 1,
              paddingTop: tokens.type.line / 2 + 7,
            },
            props.style,
          ]}
          tab={
            <>
              {props.icon}
              <Text
                style={{
                  color: tokens.role.action,
                  fontFamily: tokens.type.body,
                  fontSize: tokens.type.size,
                  fontWeight: "700",
                  lineHeight: tokens.type.line,
                }}
              >
                {props.title}
              </Text>
            </>
          }
        >
          {props.children}
        </Surface>
      </View>
    </If>
  );
}
