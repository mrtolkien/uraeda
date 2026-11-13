// Toasts: overlays that say what just happened, each with its icon and its title on its edge,
// stacked from the window's top, the most important first. A toast never takes the focus or the
// keys: what it offers is pressed, or has a key its owner declares. It is for an undo, a
// confirmation from another page, and the writes still landing, never for an error alone, which
// stays next to what it concerns. How long one stays is its owner's. A screen reader hears its
// title as it shows.
import {
  effect,
  type JSX,
  Overlay as Layer,
  type StyleProp,
  Text,
  untracked,
  View,
  type ViewStyle,
} from "nsh";
import { say } from "../announce";
import { presence } from "./presence";
import { drawIcon, type SurfaceIcon } from "./mark";
import { safe } from "./safe";
import { Surface } from "./Surface";
import { apple, feltOutcome } from "../native";
import { isNarrow } from "../width";
import { type Tone, tokens } from "../tokens";

/** Where the stack starts under the top of the window, or of the phone's bar of places. */
const top = () => tokens.space.row + tokens.pane.titleHeight;

/**
 * The stack: at the window's top right, and across its top on a narrow window, under the phone's
 * bar of places, which stays in reach.
 */
export function Toasts(props: { children?: JSX.Element }) {
  return (
    <Layer
      style={[
        // A toast's plate stands over its top edge: the gap leaves it room.
        { gap: tokens.type.line / 2 + 10, position: "absolute" },
        // Under the panes' titles, which stay in reach: the stack's top pane's title, its tabs.
        isNarrow()
          ? { left: 8, marginTop: safe.top, right: 8, top: tokens.control.touch + top() }
          : { right: 12, top: top(), width: 360 },
      ]}
    >
      {props.children}
    </Layer>
  );
}

export type ToastProps = {
  children?: JSX.Element;
  /** Before its title, on the plate. */
  icon?: SurfaceIcon;
  /** Shown while true, and for its way out after: true unless given. */
  open?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** What happened, as its button would say it: on the plate. */
  title: string;
  /** The plate's colour, for what went wrong and waits: the action's colour unless given. */
  tone?: Tone;
};

/** One toast of the stack: it drops in from above, and fades out. */
export function Toast(props: ToastProps) {
  const plate = () =>
    props.tone === undefined ? tokens.role.action : tokens.control.tone(props.tone);
  const there = presence(
    () => props.open !== false,
    () => ({ y: -tokens.motion.rise }),
  );
  // A screen reader hears its title as it shows, and as its title changes.
  effect(() => {
    if (props.open !== false) say(props.title);
  });
  // On iOS it is felt as it shows: what went wrong as an error, what waits as a warning.
  effect(() => {
    if (props.open === false) return;
    untracked(() =>
      feltOutcome(
        props.tone === "danger"
          ? "error"
          : props.tone === "needs" || props.tone === "caution"
            ? "warning"
            : "success",
      ),
    );
  });
  return (
    <If when={there.shown()}>
      <View style={there.style}>
        <Surface
          height="overlay"
          // On iOS and on a Mac as the system draws a banner: rounded, its title inside it.
          rounded={apple ? 18 : undefined}
          testID={props.testID}
          style={[
            {
              gap: 8,
              padding: tokens.space.panePadding - 1,
              paddingTop: apple ? tokens.space.panePadding - 1 : tokens.type.line / 2 + 7,
            },
            props.style,
          ]}
          tab={
            <>
              {props.icon === undefined ? null : drawIcon(props.icon, plate())}
              <Text
                style={{
                  color: plate(),
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
