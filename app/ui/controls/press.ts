// What every control that takes a press shares, in one place: its states, its focus, and its
// disabled manners.
//
// - **States**: rest, hover, pressed, focus, disabled. Hover and pressed are the platform's own,
//   through `hoverStyle` and `activeStyle` of `nsh/base`'s parts, so the pointer costs no render.
//   A press moves the control at once; it comes back in `motion.press`.
// - **Focus**: a stop of the focus ledger (`app/ui/surfaces/focus.ts`), which is the focus the app
//   draws on every platform: Tab in the focused pane, a dialog, or a sheet reaches the control,
//   Enter presses it (Space too in a layer; on a page Space is the leader's), and its ring is drawn
//   from it. Where the platform focuses
//   views (macOS, the web), `focusStyle` draws the same ring. The focus is always visible.
// - **Disabled**: no press, no focus, Tab passes it, and it says so by its dashed edge and faint
//   words, never by opacity alone.
// - **Drawn as asked**: `state` draws one state still, for the gallery's pictures. Such a control
//   takes no press and declares no key.
import { Keyboard, type ViewRef, type ViewStyle } from "nsh";
import { RevealContext } from "../layout/here";
import { focusStop } from "../surfaces/focus";
import { tokens } from "../tokens";

export type PressState = "rest" | "hover" | "pressed" | "focus";

/** A control's look in each state, each over its rest. */
export type Looks = {
  rest: ViewStyle;
  hover?: ViewStyle;
  pressed?: ViewStyle;
  focus?: ViewStyle;
  disabled?: ViewStyle;
};

export type PressProps = {
  disabled?: boolean;
  /** In an overlay, it takes the focus as the overlay opens. */
  first?: boolean;
  onPress?: () => void;
  /** Drawn in one state, still: the gallery's. It then takes no press. */
  state?: PressState;
};

/** The ring of a control with the focus, outside its edge, in `tone` lightened. */
export const ring = (tone: string = tokens.role.action): ViewStyle => ({
  outlineColor: tokens.button.focusRing(tone),
  outlineOffset: tokens.control.ring.offset,
  outlineStyle: "solid",
  outlineWidth: tokens.control.ring.width,
});

/** What a pressed control does: it moves down a point, at once. */
export const sink: ViewStyle = { translate: [0, 1] };

/** How a control comes back from a press. */
export const settle = (): ViewStyle => ({
  transitionDuration: tokens.motion.press,
  transitionProperty: "translate",
});

/** A state's look over the rest. */
const over = (looks: Looks, part: ViewStyle | undefined): ViewStyle => ({ ...looks.rest, ...part });

/**
 * Makes a control that takes presses and the focus, from its props, read as they change, and what
 * a press does, `props.onPress` unless given. Called as it renders; spread what it answers
 * on the `nsh/base` part that takes the presses:
 *
 *     const press = pressable(props);
 *     <Button ref={press.ref} onPress={press.press} disabled={press.isOff()}
 *       style={press.style(looks)} hoverStyle={press.hover(looks)} activeStyle={press.active(looks)}
 *       focusStyle={press.focusStyle(looks)} />
 */
export function pressable(props: PressProps, onPress: () => void = () => props.onPress?.()) {
  let node: ViewRef | undefined;
  /** Whether it takes no press: disabled, or a picture of a state. */
  const isOff = () => props.disabled === true || props.state !== undefined;
  const press = () => {
    if (!isOff()) {
      onPress();
    }
  };
  // In a pane that scrolls, Tab brings the control it reaches into sight.
  const reveal = RevealContext();
  const stop = focusStop(
    () => ({
      blur: () => node?.blur(),
      focus: () => {
        // A field typed in stops taking the keys, and the ledger holds the control.
        Keyboard.dismiss();
        node?.focus();
        stop.onFocus();
        if (node !== undefined) reveal?.(node);
      },
    }),
    { disabled: isOff, first: props.first, press },
  );
  const state = (): PressState | "disabled" => {
    if (props.disabled === true) {
      return "disabled";
    }
    return props.state ?? (stop.focused() ? "focus" : "rest");
  };
  return {
    /** Takes the focus, as Tab would: the ledger then draws its ring. */
    focus: () => stop.onFocus(),
    focused: stop.focused,
    isOff,
    press,
    ref: (next: ViewRef) => {
      node = next;
    },
    /** Its state now: the one asked for, else the ledger's focus, or rest. */
    state,
    /** Its style now: rest, with its state's look over it. */
    style: (looks: Looks): ViewStyle => {
      const now = state();
      const part =
        now === "disabled"
          ? looks.disabled
          : now === "focus"
            ? { ...looks.focus, ...ring() }
            : now === "rest"
              ? undefined
              : now === "pressed"
                ? { ...looks.pressed, ...sink }
                : looks[now];
      return { ...settle(), ...over(looks, part) };
    },
    hover: (looks: Looks): ViewStyle | undefined =>
      isOff() ? undefined : over(looks, looks.hover),
    active: (looks: Looks): ViewStyle | undefined =>
      isOff() ? undefined : { ...over(looks, looks.pressed), ...sink },
    focusStyle: (looks: Looks): ViewStyle | undefined =>
      isOff() ? undefined : { ...over(looks, looks.focus), ...ring() },
  };
}

export type Pressable = ReturnType<typeof pressable>;
