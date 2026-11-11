// A pane: the standard surface, with its title standing on its top edge and its border going
// around it, as a folder's tab. At rest nothing glows. With the focus it is the one thing on
// screen that emits light, and its title fills with it. A pane that waits on the human has its
// title in `needs-you`, and no light: a colour, not a lamp.
//
// It clips what it holds, so a main action's glow stays in its pane, and never reaches the glass
// of a bar, which would draw again with each of its frames.
import { type JSX, type StyleProp, Text, View, type ViewStyle } from "nsh";
import { Surface } from "./Surface";
import { alpha, tokens } from "../tokens";

export type PaneProps = {
  /** The style of the box the children are in: its padding, its direction. */
  body?: StyleProp<ViewStyle>;
  children?: JSX.Element;
  /** Whether the keys go here: the pane then emits light. */
  focused?: boolean;
  /** `raised` for a pane in a pane, a card with a title: panes nest two levels deep at most. */
  height?: "standard" | "raised";
  /** The title's icon, drawn in the colour the title has now. */
  icon?: (colour: string) => JSX.Element;
  /** What follows the title, dimmer: a count, a place, "· 3". */
  more?: string;
  /** It waits on the human: its title is in `needs-you`. */
  needs?: boolean;
  /** A run is on in it: `true` and `false` both say it can run, and the line moves between. */
  running?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
  /** The title's colour at rest: the pane's role colour, the quiet ink without one. */
  tone?: string;
};

/** The title's words, in the interface's font at the reading size. */
const words = (weight: "400" | "700") =>
  ({
    fontFamily: tokens.type.body,
    fontSize: tokens.type.size,
    fontWeight: weight,
    lineHeight: tokens.type.line,
  }) as const;

export function Pane(props: PaneProps) {
  const lit = () => props.focused === true;
  const colour = () => {
    if (lit()) {
      return tokens.role.onAction;
    }
    return props.needs === true ? tokens.light.needs : (props.tone ?? tokens.role.inkQuiet);
  };
  const title = (
    <>
      <View
        style={{
          backgroundColor: props.needs === true ? tokens.light.needs : tokens.light.focus,
          height: tokens.pane.titleHeight - 1,
          left: 0,
          // The light glides: the title's fill fades with it, and its words answer at once.
          opacity: lit() ? 1 : 0,
          position: "absolute",
          right: 0,
          top: 0,
          transitionDuration: tokens.light.glide,
          transitionProperty: "opacity",
        }}
      />
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: 6,
          height: tokens.pane.titleHeight - 1,
          paddingLeft: tokens.pane.titlePadding[0] - 1,
          paddingRight: tokens.pane.titlePadding[1] - 1,
        }}
      >
        <If when={props.icon}>{(icon) => <>{icon()(colour())}</>}</If>
        <Text style={{ ...words("700"), color: colour() }}>{props.title}</Text>
        <If when={props.more}>
          {(more) => (
            <Text
              style={{
                ...words("400"),
                color: lit() ? alpha(tokens.role.onAction, 0.72) : tokens.role.inkFaint,
              }}
            >
              {more()}
            </Text>
          )}
        </If>
      </View>
    </>
  );
  return (
    <Surface
      focused={props.focused}
      height={props.height ?? "standard"}
      running={props.running}
      style={[{ marginTop: tokens.pane.titleRise }, props.style]}
      tab={title}
      testID={props.testID}
    >
      <View
        style={[
          {
            // It fills a pane that has a height, and is as high as its content in one that has none.
            flexBasis: "auto",
            flexGrow: 1,
            flexShrink: 1,
            overflow: "hidden",
            // Counted from the pane's outer edge: its border is one of them.
            paddingBottom: tokens.space.panePadding - 1,
            paddingHorizontal: tokens.space.panePadding - 1,
            // The title's lower part, and 6 px of air under it, less the border.
            paddingTop: tokens.pane.titleHeight - tokens.pane.titleRise + 5,
          },
          props.body,
        ]}
      >
        {props.children}
      </View>
    </Surface>
  );
}
