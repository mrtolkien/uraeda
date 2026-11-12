// A button: few, so each is a small object. The main action is a lamp, every other a tube, a
// dangerous one a red tube, lit a little at rest. On glass nothing is a filled block: a main
// action there is a tube. A view's ONE main action breathes, never inside an overlay; nothing
// else moves unless its state just changed.
//
// `keys` shows the button's key as a `Kbd` and declares it in the key registry, with the
// button's label: the key shown is the key that works, and the key map and the status line list
// it. It is declared where the button is mounted, so a page shows each such key once.
import {
  Animated,
  cleanup,
  createAnimatedValue,
  Easing,
  type JSX,
  reduceMotion,
  type StyleProp,
  View,
  type ViewStyle,
} from "nsh";
import { Button as Base } from "nsh/base";
import { type IconName, Icon } from "./Icon";
import { Kbd } from "./Kbd";
import { buttonLooks, inkOfButton, isLamp, toneOf, type Variant } from "./look";
import { type PressProps, pressable } from "./press";
import { Spinner } from "./Spinner";
import { Text } from "./Text";
import { layerOpen, registerKey } from "../keys/registry";
import type { Scope } from "../keys/store";
import { Tooltip, useGlass, useHeight } from "../surfaces";
import { tokens } from "../tokens";
import { isNarrow } from "../width";

export type ButtonProps = PressProps & {
  /** The view's one main action breathes: at most one per view, and none in an overlay. */
  breathes?: boolean;
  /**
   * Its key and its icon alone, its label in its tip and to screen readers: a pane's header in a
   * narrow pane, whose controls stay on one row. Without an icon, it keeps its label.
   */
  compact?: boolean;
  icon?: IconName;
  /** Its key, declared in the registry and shown: "Enter", "mod+Enter", "d". */
  keys?: string;
  /**
   * The key scope its key is declared in, where it is not where it is drawn: a button in a
   * layer's content takes the layer's (`Float`'s `scope`), which a browser does not give it.
   */
  scope?: Scope;
  label: string;
  /** A write on its way: a spinner in place of its icon. It still takes presses. */
  pending?: boolean;
  /** A toggle that is on: lit as under the pointer, and said to be selected. */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: Variant;
};

/** The glow of a view's main action, which swells and settles over a breath. */
function Breath(props: { tone: string }) {
  const swell = createAnimatedValue(0);
  const half = tokens.motion.breath / 2;
  const curve = Easing.inOut(Easing.sin);
  const loop = Animated.loop(
    Animated.sequence([
      Animated.timing(swell, { duration: half, easing: curve, toValue: 1 }),
      Animated.timing(swell, { duration: half, easing: curve, toValue: 0 }),
    ]),
  );
  void loop.start();
  cleanup(() => loop.stop());
  return (
    <View
      style={{
        bottom: -1,
        boxShadow: tokens.button.main.breathHigh(props.tone),
        left: -1,
        opacity: swell,
        pointerEvents: "none",
        position: "absolute",
        right: -1,
        top: -1,
      }}
    />
  );
}

/** The height of a control a finger presses: a line and its room, or a thumb's on a phone. */
export const pressHeight = () => (isNarrow() ? tokens.control.touch : tokens.button.height);

export function Button(props: ButtonProps) {
  const onGlass = useGlass();
  const height = useHeight();
  const press = pressable(props);
  const variant = () => props.variant ?? "tube";
  const looks = () => {
    const base = buttonLooks(variant(), onGlass());
    const rest: ViewStyle = {
      ...base.rest,
      alignItems: "center",
      borderWidth: 1,
      flexDirection: "row",
      gap: 7,
      height: pressHeight(),
      justifyContent: "center",
      paddingHorizontal: tokens.button.padding - 1,
    };
    return props.selected === true
      ? { ...base, rest: { ...rest, ...base.hover } }
      : { ...base, rest };
  };
  const ink = () => inkOfButton(variant(), onGlass(), props.disabled === true);
  const breathes = () =>
    props.breathes === true &&
    variant() === "main" &&
    props.disabled !== true &&
    tokens.button.main.motion === "breathe" &&
    !reduceMotion() &&
    !onGlass() &&
    height() !== "overlay" &&
    // Under an open layer it rests: each frame of its breath redrew the glass sampling it, a
    // dialog of the run map's size starved the app of frames and keys (ruling R512).
    !layerOpen();
  if (props.keys !== undefined && props.state === undefined) {
    registerKey(
      {
        keys: props.keys,
        label: props.label,
        run: press.press,
        when: () => !press.isOff(),
      },
      props.scope,
    );
  }
  const mark = (): JSX.Element => {
    if (props.pending === true) {
      return <Spinner tone={isLamp(variant(), onGlass()) ? undefined : "accent"} />;
    }
    return props.icon === undefined ? null : <Icon colour={ink()} name={props.icon} />;
  };
  const button = (
    <Base
      accessibilityLabel={props.label}
      activeStyle={press.active(looks())}
      disabled={press.isOff()}
      focusStyle={press.focusStyle(looks())}
      hoverStyle={press.hover(looks())}
      onPress={press.press}
      ref={press.ref}
      selected={props.selected === true}
      // Never wider than where it stands: a label with no room left is cut at its end.
      style={[{ alignSelf: "flex-start", maxWidth: "100%" }, press.style(looks()), props.style]}
      testID={props.testID}
    >
      <If when={breathes()}>
        <Breath tone={toneOf(variant())} />
      </If>
      {/* Its key works with a keyboard attached, and is not shown on a phone: keys are no help
          to a finger, and the chip took a button's room (the phone guide). */}
      <If when={isNarrow() ? undefined : props.keys}>
        {(keys) => (
          <Kbd keys={keys()} onMain={isLamp(variant(), onGlass()) && props.disabled !== true} />
        )}
      </If>
      {mark()}
      <If when={props.compact !== true || props.icon === undefined}>
        <Text
          bold={variant() === "main"}
          colour={ink()}
          lines={1}
          style={{ flexShrink: 1, letterSpacing: 0.26 }}
        >
          {props.label}
        </Text>
      </If>
    </Base>
  );
  return props.compact === true && props.icon !== undefined ? (
    <Tooltip text={props.label}>{button}</Tooltip>
  ) : (
    button
  );
}
