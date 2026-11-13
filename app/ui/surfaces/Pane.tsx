// A pane: the standard surface, with its title standing on its top edge and its border going
// around it, as a folder's tab. At rest nothing glows. With the focus it is the one thing on
// screen that emits light, and its title fills with it. A pane that waits on the human has its
// title in `needs-you`, and no light: a colour, not a lamp.
//
// A stack of panes shown as tabs is one pane whose title is a row of tabs (`tabs`): the border goes
// around the whole row, and the tab shown is the one that fills with light. So a pane alone and a
// stack of tabs are drawn by this one component, and look the same everywhere.
//
// It clips what it holds, so a main action's glow stays in its pane, and never reaches the glass
// of a bar, which would draw again with each of its frames.
import { type JSX, type StyleProp, Text, View, type ViewStyle } from "nsh";
import { drawIcon, type SurfaceIcon } from "./mark";
import { Surface } from "./Surface";
import { Tooltip } from "./Tooltip";
import { alpha, tokens } from "../tokens";

/** One title on a pane's edge: the pane's own, or one tab of a stack. */
export type PaneTab = {
  /** Its icon alone, its title in its tip and to screen readers: a tab that does not fit beside the others. */
  compact?: boolean;
  /** The tab shown: it fills with light while the pane has the focus. */
  current: boolean;
  /** The title's icon, drawn in the colour the title has now. */
  icon?: SurfaceIcon;
  /** What follows the title, dimmer: a count, a place, "· 3". */
  more?: string;
  /** It waits on the human: its title is in `needs-you`. */
  needs?: boolean;
  /** A press on the tab: shows it. */
  onPress?: () => void;
  /** A long press on the tab: its pane's menu, the touch's way to it. */
  onLongPress?: () => void;
  /**
   * The pointer carrying the tab, from a press that moves: where it went, in the window's
   * points, and whether it was let go (`true`) or taken away (`false`).
   */
  drag?: {
    grant: (x: number, y: number) => void;
    move: (x: number, y: number) => void;
    end: (dropped: boolean) => void;
  };
  /** A run is on in it: a small mark of the running light follows its title. */
  running?: boolean;
  testID?: string;
  title: string;
};

export type PaneProps = {
  /** The style of the box the children are in: its padding, its direction. */
  body?: StyleProp<ViewStyle>;
  children?: JSX.Element;
  /** Whether the keys go here: the pane then emits light. */
  focused?: boolean;
  /** `raised` for a pane in a pane, a card with a title: panes nest two levels deep at most. */
  height?: "standard" | "raised";
  /** The title's icon, drawn in the colour the title has now. */
  icon?: SurfaceIcon;
  /** What follows the title, dimmer: a count, a place, "· 3". */
  more?: string;
  /** It waits on the human: its title is in `needs-you`. */
  needs?: boolean;
  /** A press anywhere in the pane that nothing inside it took: the layout gives it the focus. */
  onPress?: () => void;
  /** A run is on in it: `true` and `false` both say it can run, and the line moves between. */
  running?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Several titles on its edge, as a stack's tabs, in place of `title`, `icon`, and `more`. */
  tabs?: ReadonlyArray<PaneTab>;
  /** Drawn after the tabs, on the edge: what the keys do on them now. */
  tabsEnd?: JSX.Element;
  testID?: string;
  title?: string;
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

/** One title on the edge, its fill of light under it while it is lit. */
function Title(props: { lit: boolean; many: boolean; tab: PaneTab; tone?: string }) {
  const colour = () => {
    if (props.lit) {
      return tokens.role.onAction;
    }
    if (props.tab.needs === true) {
      return tokens.light.needs;
    }
    if (props.many && !props.tab.current) {
      return tokens.role.inkFaint;
    }
    return props.tone ?? tokens.role.inkQuiet;
  };
  const title = (
    <View
      accessibilityLabel={props.many || props.tab.compact === true ? props.tab.title : undefined}
      onLongPress={props.tab.onLongPress}
      onMoveShouldSetResponder={props.tab.drag === undefined ? undefined : () => true}
      onPress={props.tab.onPress}
      onResponderGrant={(event: { pageX: number; pageY: number }) => {
        props.tab.drag?.grant(event.pageX, event.pageY);
        return true;
      }}
      onResponderMove={(event: { pageX: number; pageY: number }) =>
        props.tab.drag?.move(event.pageX, event.pageY)
      }
      onResponderRelease={() => props.tab.drag?.end(true)}
      onResponderTerminate={() => props.tab.drag?.end(false)}
      accessibilityState={props.many ? { selected: props.tab.current } : undefined}
      role={props.many ? "tab" : undefined}
      style={{ flexShrink: 1, height: tokens.pane.titleHeight - 1, minWidth: 0 }}
      testID={props.tab.testID}
    >
      <View
        style={{
          backgroundColor: props.tab.needs === true ? tokens.light.needs : tokens.light.focus,
          bottom: 0,
          left: 0,
          // The light glides: the title's fill fades with it, and its words answer at once.
          opacity: props.lit ? 1 : 0,
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
          minWidth: 0,
          paddingLeft: tokens.pane.titlePadding[0] - 1,
          paddingRight: tokens.pane.titlePadding[1] - 1,
        }}
      >
        <If when={props.tab.icon}>{(icon) => drawIcon(icon(), colour())}</If>
        <If when={props.tab.compact !== true}>
          <Text
            style={{
              ...words(props.many && !props.tab.current ? "400" : "700"),
              color: colour(),
              flexShrink: 1,
              numberOfLines: 1,
            }}
          >
            {props.tab.title}
          </Text>
        </If>
        <If when={props.tab.compact !== true && props.tab.more}>
          {(more) => (
            <Text
              style={{
                ...words("400"),
                color: props.lit ? alpha(tokens.role.onAction, 0.72) : tokens.role.inkFaint,
              }}
            >
              {more()}
            </Text>
          )}
        </If>
        <If when={props.tab.running === true}>
          <View
            style={{
              backgroundColor: props.lit ? tokens.role.onAction : tokens.light.running,
              height: 6,
              width: 6,
            }}
          />
        </If>
      </View>
    </View>
  );
  // A tab drawn as its icon alone says its title in a tip, beside what screen readers hear.
  return props.tab.compact === true ? <Tooltip text={props.tab.title}>{title}</Tooltip> : title;
}

export function Pane(props: PaneProps) {
  const tabs = (): ReadonlyArray<PaneTab> =>
    props.tabs ?? [
      {
        current: true,
        icon: props.icon,
        more: props.more,
        needs: props.needs,
        title: props.title ?? "",
      },
    ];
  const many = () => props.tabs !== undefined && props.tabs.length > 1;
  const title = (
    <View style={{ flexDirection: "row", minWidth: 0 }}>
      <Each of={tabs()}>
        {(tab, index) => (
          <>
            <If when={index() > 0}>
              <View
                style={{
                  backgroundColor: tokens.role.ruleQuiet,
                  height: tokens.pane.titleHeight - 1,
                  width: 1,
                }}
              />
            </If>
            <Title
              lit={props.focused === true && tab().current}
              many={many()}
              tab={tab()}
              tone={props.tone}
            />
          </>
        )}
      </Each>
      {/*
        Centred on the titles' row, where a control's target is taller than the row, as on touch:
        a column centres the row of controls, whatever each of them asks of its own alignment.
      */}
      <View style={{ height: tokens.pane.titleHeight - 1, justifyContent: "center" }}>
        <View style={{ alignItems: "center", flexDirection: "row" }}>{props.tabsEnd}</View>
      </View>
    </View>
  );
  return (
    <Surface
      focused={props.focused}
      height={props.height ?? "standard"}
      onPress={props.onPress}
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
