// A surface: a box at one of the four heights. Its height fixes its fill, its border, its lip,
// its shadow, whether it is glass, and the light it emits with the focus, all from
// `tokens.height`. It is the only component that draws a shadow, glass, or a glow: every other
// one is built on it, and none sets its own.
//
// - `recessed`: a field, a code block, the composer. A well: shaded under its top edge.
// - `standard`: a pane, the page's own content. Flat.
// - `raised`: a card, a bar that stays. Lit on its top edge, and glass once content scrolls under.
// - `overlay`: a menu, a dialog, a sheet, a toast, a tip. Glass, with a deep, soft shadow.
//
// A height inside another keeps its own recipe: a well in a card takes the page's fill, and a
// well in a well or in glass darkens what it is cut in.
import {
  type Accessor,
  type JSX,
  signal,
  type StyleProp,
  View,
  type ViewProps,
  type ViewRef,
  type ViewStyle,
} from "nsh";
import { Glass } from "./Glass";
import { type Ground, GroundContext } from "./height";
import { Lit, RunLine } from "./light";
import { alpha, type HeightName, mix, tokens } from "../tokens";

export type SurfaceProps = {
  accessibilityLabel?: string;
  children?: JSX.Element;
  /**
   * It has the focus. A pane, at `standard`, then emits light: its outline becomes the two
   * lights and their glow follows it. A field, at `recessed`, takes `tone` on its edge, with a
   * short glow. The other heights emit none.
   */
  focused?: boolean;
  /**
   * Content scrolls under it: a raised surface is then glass, with a short shadow, as the status
   * line, a header once stuck, the phone's bars. An overlay is always glass, and the two lower
   * heights never are.
   */
  glass?: boolean;
  height: HeightName;
  onLayout?: ViewProps["onLayout"];
  onPress?: ViewProps["onPress"];
  ref?: (node: ViewRef) => void;
  /** A run is on in it: its top edge is a steady line of `light.running`. */
  running?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * What stands on its top edge, at its left: a pane's title, which its border goes around, or
   * an overlay's title, on a small plate so it reads over any page.
   */
  tab?: JSX.Element;
  testID?: string;
  /** The colour of a focused field's edge and glow: the editing mode's, the accent without one. */
  tone?: string;
};

/** Every shadow of a box as one `boxShadow`, less those that are none. */
const shadows = (...parts: Array<string | undefined>) => {
  const drawn = parts.filter((part) => part !== undefined && part !== "none");
  return drawn.length === 0 ? undefined : drawn.join(", ");
};

/** How far a pane's title stands above its top edge. */
const rise = () => tokens.pane.titleRise;

export function Surface(props: SurfaceProps) {
  const around = GroundContext();
  const at = () => tokens.height[props.height];
  const isGlass = () => at().glass || (props.height === "raised" && props.glass === true);
  const here: Accessor<Ground> = () => ({ glass: isGlass(), height: props.height });
  const lit = () => props.focused === true;
  const emits = () => props.height === "standard";

  const fill = () => {
    if (isGlass()) {
      return undefined;
    }
    if (props.height === "recessed") {
      const on = around();
      if (on.glass || on.height === "recessed" || on.height === "overlay") {
        return tokens.height.recessed.fillIn.deeper;
      }
      if (on.height === "raised") {
        return tokens.height.recessed.fillIn.raised;
      }
    }
    return at().fill;
  };
  const tone = () => props.tone ?? tokens.light.mode.normal;
  // GTK paints a view's border over what it holds. So where something stands on the edge, a
  // title's tab, the focus's light, a run's line, the edge is a layer of its own, under them.
  const isLayered = () =>
    emits() || props.running !== undefined || (props.tab !== undefined && !isGlass());
  const edge = () => (props.height === "recessed" && lit() ? tone() : at().border);
  // On glass the shader draws the rim, and the line under it.
  const border = () => (isGlass() || isLayered() ? "transparent" : edge());
  const lip = () => {
    if (isGlass()) {
      return undefined;
    }
    // A focused field in a light theme has its tone's shadow in place of its shade.
    return props.height === "recessed" && lit() && tokens.mode === "light" ? undefined : at().lip;
  };
  const shadow = () => {
    if (props.height === "raised" && isGlass()) {
      return tokens.height.raised.glassShadow;
    }
    if (props.height === "recessed" && lit()) {
      const glow = tokens.height.recessed.glow;
      return `0 ${glow.offset}px ${glow.blur}px ${alpha(tone(), glow.strength)}`;
    }
    return at().shadow;
  };

  // The tab's width, which the glow's shape needs: known once the tab is laid out.
  const tabWidth = signal(0);
  const tabShape = () =>
    props.tab === undefined || props.height === "overlay"
      ? undefined
      : ([tabWidth(), rise()] as const);
  const tabStyle = (): ViewStyle =>
    props.height === "overlay"
      ? {
          alignItems: "center",
          backgroundColor: tokens.glass.plate,
          boxShadow: tokens.glass.plateLip,
          flexDirection: "row",
          gap: 6,
          height: tokens.type.line,
          left: 10,
          paddingHorizontal: 8,
          position: "absolute",
          // Half over the top edge, counted from inside the border.
          top: -1 - tokens.type.line / 2,
        }
      : {
          backgroundColor: fill(),
          borderColor:
            lit() && emits() ? mix(tokens.light.focus, tokens.light.focus2, 0.5) : at().border,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderTopWidth: 1,
          height: rise() + 1,
          left: -1,
          position: "absolute",
          top: -1 - rise(),
        };

  return (
    <View
      accessibilityLabel={props.accessibilityLabel}
      onLayout={props.onLayout}
      onPress={props.onPress}
      ref={props.ref}
      testID={props.testID}
      style={[
        {
          backgroundColor: fill(),
          borderColor: border(),
          borderWidth: 1,
          boxShadow: shadows(lip(), shadow()),
        },
        props.style,
      ]}
    >
      <If when={isLayered()}>
        <View
          style={{
            borderColor: edge(),
            borderWidth: 1,
            bottom: -1,
            left: -1,
            pointerEvents: "none",
            position: "absolute",
            right: -1,
            top: -1,
          }}
        />
      </If>
      <If when={emits()}>
        <Lit fill={fill()} height={props.height} lip={lip()} on={lit()} tab={tabShape()} />
      </If>
      <If when={isGlass()}>
        <Glass
          edge={props.height === "raised" ? tokens.role.ruleQuiet : undefined}
          style={{
            bottom: -1,
            left: -1,
            pointerEvents: "none",
            position: "absolute",
            right: -1,
            top: -1,
          }}
        />
      </If>
      <If when={props.running !== undefined}>
        <RunLine on={props.running === true} start={tabShape()?.[0]} />
      </If>
      <If when={props.tab !== undefined}>
        <View onLayout={(event) => tabWidth.set(event.bounds.size.width)} style={tabStyle()}>
          {props.tab}
        </View>
      </If>
      <GroundContext.Provider value={here}>{props.children}</GroundContext.Provider>
    </View>
  );
}
