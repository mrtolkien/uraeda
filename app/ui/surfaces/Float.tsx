// What every overlay is made of: a box of glass at the `overlay` height that floats over the
// page, comes in and goes out with the language's motion, and, when it takes the keys, owns them
// as a layer of the key registry, with the focus. `Overlay`, `Dialog`, `Sheet`, `Popover`,
// `Toast`, and `Tooltip` are this one, each with its place and its manners.
//
// - It rises and fades in as it opens, and fades out as it closes: it stays drawn for its way
//   out, while its keys and the focus go back at once.
// - Escape, the phone's Back, and a press outside it ask to close: closing is its owner's. A
//   field of its own with the focus has Escape first: Vim's insert mode leaves before it closes.
// - The focus goes into it as it opens, on its first stop (`focus.ts`), and back where it was as
//   it closes. One that traps keeps Tab among its own stops.
import {
  type Bounds,
  cleanup,
  effect,
  type JSX,
  Overlay as Layer,
  type Point,
  type StyleProp,
  Text,
  untracked,
  View,
  type ViewRef,
  type ViewStyle,
} from "nsh";
import {
  escapeHeld,
  focusFirst,
  focusNext,
  pressHeld,
  type Stops,
  StopsContext,
  takeFocus,
} from "./focus";
import { backCloses } from "./backCloses";
import { aboveHome, keyboardUp } from "./safe";
import { swipeDown } from "./swipeDown";
import { onChange, presence } from "./presence";
import { drawIcon, type SurfaceIcon } from "./mark";
import { Surface } from "./Surface";
import { InScope, keyScope, registerKey } from "../keys/registry";
import type { Scope } from "../keys/store";
import { ios } from "../native";
import { tokens } from "../tokens";
import { isNarrow } from "../width";

/** Where a float is: a fixed place of the window, and what it travels as it comes. */
export type Place = {
  /** With a scrim, how the window lays the box out: where it sits. */
  window?: ViewStyle;
  /** The box's own place: its offsets from the window's edges without a scrim, its size with one. */
  box?: ViewStyle;
  /** How far it rises as it comes, in points. */
  rise: number;
};

export type FloatProps = {
  /** What it is placed against, in place of a fixed place: a view, a point, or a box. */
  anchor?: ViewRef | Point | Bounds | null;
  align?: "start" | "center" | "end";
  children?: JSX.Element;
  /** Before its title, on the plate. */
  icon?: SurfaceIcon;
  /**
   * Whether it takes the keys and the focus: it is then a layer of the key registry, which owns
   * the keys while it is open. Fixed for as long as it is drawn.
   */
  keys: boolean;
  /** Its layer's name in the key map. */
  name: string;
  /** Asked to close: Escape, the phone's Back, a press outside it. */
  onClose?: () => void;
  open?: boolean;
  place: () => Place;
  placement?: "top" | "bottom" | "left" | "right";
  /** Whether the page dims behind it, and takes no press but the one that closes. */
  scrim: boolean;
  /** The style of the glass box: its padding, its gap. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** On a small plate on its top edge, so it reads over any page. */
  title?: string;
  /** Whether Tab stays among its own stops: a dialog's and a sheet's does. */
  trap: boolean;
  /**
   * Its layer's key scope, made by its caller with `keyScope`, for the content the caller writes
   * to declare its keys in (`Options`): one is made here otherwise.
   */
  scope?: Scope;
};

const WHOLE = { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 } as const;

/** On iOS, a sheet's corners, as the system's sheets have them, and a menu's. */
const SHEET_RADIUS = 34;
const MENU_RADIUS = 18;

/** The keys every layer has: Escape closes it, and with a trap Tab stays in it. */
function LayerKeys(props: { onClose: () => void; scope: Scope; stops: Stops; trap: boolean }) {
  registerKey(
    {
      hint: "esc",
      hintLabel: "close",
      inField: true,
      keys: "Escape",
      label: "Close",
      run: props.onClose,
    },
    props.scope,
  );
  if (props.trap) {
    const here = { inField: true, repeat: true } as const;
    registerKey(
      [
        { ...here, keys: "Tab", label: "Next field", run: () => focusNext(props.stops, false) },
        {
          ...here,
          keys: "shift+Tab",
          label: "Previous field",
          run: () => focusNext(props.stops, true),
        },
      ],
      props.scope,
    );
    // Enter and Space press the control Tab reached, where nothing of the layer's own took them.
    const press = () => (pressHeld(props.stops) ? undefined : false);
    registerKey(
      [
        { fallback: true, keys: "Enter", label: "Press", run: press },
        { fallback: true, keys: "space", label: "Press", run: press },
      ],
      props.scope,
    );
  }
  // Once what it holds is there, the focus goes to its first stop.
  effect(() => untracked(() => focusFirst(props.stops)));
  return null;
}

export function Float(props: FloatProps) {
  const open = () => props.open !== false;
  const close = () => props.onClose?.();
  // Escape and the phone's Back, which Native Shell gives the overlay before any view: a field of
  // its own with the focus takes them first, and closes it from its own Escape when it is done.
  const cancel = () => {
    if (!escapeHeld(stops)) {
      close();
    }
  };
  const there = presence(open, () => ({ y: props.place().rise }));
  // A sheet, what a dialog is on a phone, is a visit of its own there: Back closes it.
  if (props.scrim) backCloses(open, isNarrow, close);
  // On a phone, a swipe down on its top row closes it.
  const swipe = swipeDown(isNarrow, close);
  const stops: Stops = [];
  const takesKeys = props.keys;
  // Made here, in the float's own body, and given explicitly: see `InScope`.
  const layer = takesKeys
    ? (props.scope ?? keyScope({ kind: "layer", name: props.name, on: open }))
    : undefined;
  if (takesKeys) {
    let giveBack: (() => void) | null = null;
    const change = (now: boolean) => {
      if (now) {
        giveBack = takeFocus(stops);
      } else {
        giveBack?.();
        giveBack = null;
      }
    };
    if (open()) {
      change(true);
    }
    onChange(open, change);
    cleanup(() => change(false));
  }

  // On iOS an overlay is drawn as the system's: a sheet's corners as round as the screen's, a
  // popover's as a menu's, and its title inside it.
  const rounded = () =>
    ios ? (props.scrim && isNarrow() ? SHEET_RADIUS : MENU_RADIUS) : undefined;
  const box = () => (
    <Surface
      height="overlay"
      rounded={rounded()}
      testID={props.testID}
      style={[
        { flexShrink: 1, gap: 8, padding: tokens.space.panePadding - 1 },
        // Its title's plate stands half over its top edge: what it holds starts under it.
        props.title === undefined || rounded() !== undefined
          ? null
          : { paddingTop: tokens.type.line / 2 + 7 },
        // Under a sheet's grabber.
        rounded() === SHEET_RADIUS ? { paddingHorizontal: 16, paddingTop: 18 } : null,
        props.style,
        // On iOS a sheet stands on the screen's foot: what it holds ends above the home indicator.
        ios && props.scrim && isNarrow() && !keyboardUp()
          ? { paddingBottom: aboveHome(tokens.space.panePadding - 1) }
          : null,
      ]}
      tab={
        props.title === undefined ? undefined : (
          <>
            {props.icon === undefined ? null : drawIcon(props.icon, tokens.role.action)}
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
        )
      }
    >
      {props.children}
    </Surface>
  );
  const floating = () =>
    props.scrim ? (
      <Layer onCancel={cancel} style={[WHOLE, props.place().window]}>
        <View
          focusable={false}
          onPress={close}
          style={{ ...WHOLE, backgroundColor: tokens.backdrop.dim, opacity: there.style.opacity }}
        />
        <View {...swipe.props} style={[props.place().box, there.style]}>
          <View style={{ flexShrink: 1, transform: [{ translateY: swipe.by() }] }}>
            {box()}
            {/* On iOS a sheet shows where a finger takes it, as the system's sheets do. */}
            <If when={ios && isNarrow()}>
              <View
                focusable={false}
                style={{
                  alignSelf: "center",
                  backgroundColor: tokens.role.inkFaint,
                  height: 4,
                  position: "absolute",
                  top: 5,
                  width: 36,
                }}
              />
            </If>
          </View>
        </View>
      </Layer>
    ) : (
      <Layer
        align={props.align}
        anchor={props.anchor}
        margin={8}
        offset={4}
        onCancel={takesKeys ? cancel : undefined}
        onPressOutside={takesKeys ? close : undefined}
        placement={props.placement}
        style={[
          props.anchor === undefined ? { position: "absolute" } : null,
          props.place().box,
          there.style,
        ]}
      >
        {box()}
      </Layer>
    );
  // Its key scope is made in its body and given explicitly, never by a provider inside the layer:
  // in a browser, Native Shell runs a component under the owner where its element was written, so
  // what a layer holds saw the page's scope; a menu's rows declared Space there, the page's leader
  // clashed, and the menu drew nothing. Content its caller writes takes the scope its caller made
  // (`scope`). Whether it takes the keys is fixed for as long as it is drawn.
  return (
    <If when={there.shown()}>
      <StopsContext.Provider value={stops}>
        {layer === undefined ? (
          floating()
        ) : (
          <InScope scope={layer}>
            <LayerKeys onClose={close} scope={layer} stops={stops} trap={props.trap} />
            {floating()}
          </InScope>
        )}
      </StopsContext.Provider>
    </If>
  );
}
