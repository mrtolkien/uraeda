// The samples' controls: keys, buttons, fields, rows, and the status line, each drawn in the state
// it is asked for, since a picture cannot hover or press.
import {
  Animated,
  cleanup,
  createAnimatedValue,
  Easing,
  type JSX,
  Text,
  View,
  type ViewStyle,
} from "nsh";
import { glass, icon, type IconName, mono } from "./parts";
import { alpha, choices, type Tokens } from "../../ui/tokens";

export type State = "rest" | "hover" | "focus" | "pressed" | "disabled";
export type Mode = "normal" | "insert" | "visual" | "replace";

/** A key: a chip, the key in the accent on a small dark block. */
export function key(v: Tokens, name: string, state: State = "rest", onMain = false) {
  const k = v.key;
  const fill = onMain
    ? k.onMain
    : state === "hover"
      ? k.hot
      : state === "pressed"
        ? k.pressed
        : k.fill;
  return (
    <View
      style={{
        minWidth: k.size,
        height: k.size,
        paddingHorizontal: k.padding,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: fill,
        opacity: onMain ? 0.8 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: v.type.body,
          fontSize: v.type.under,
          lineHeight: k.size,
          fontWeight: "700",
          color: onMain ? v.role.onAction : k.text,
        }}
      >
        {name}
      </Text>
    </View>
  );
}

/** A row's action: a chip and a word, with no frame. */
export function act(v: Tokens, name: string, word: string, state: State = "rest") {
  return (
    <View
      style={{
        height: v.space.row,
        paddingLeft: 2,
        paddingRight: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      {key(v, name, state)}
      {mono(v, word, { color: state === "hover" ? v.role.ink : v.role.inkQuiet })}
    </View>
  );
}

/** A hint: a chip and a word, on a bar or under a field. */
export function hint(v: Tokens, name: string, word: string, color?: string) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {key(v, name)}
      {mono(v, word, { color: color ?? v.role.inkFaint })}
    </View>
  );
}

export interface ButtonOptions {
  label: string;
  kind?: "main" | "tube" | "danger";
  state?: State;
  key?: string;
  icon?: IconName;
  /** The view's one main action: its glow swells and settles. */
  breathes?: boolean;
  testID?: string;
}

/** The glow of a view's main action, which swells and settles over a breath. */
function breath(v: Tokens, tone: string) {
  const swell = createAnimatedValue(0);
  const half = v.motion.breath / 2;
  const curve = Easing.inOut(Easing.sin);
  const loop = Animated.loop(
    Animated.sequence([
      Animated.timing(swell, { toValue: 1, duration: half, easing: curve }),
      Animated.timing(swell, { toValue: 0, duration: half, easing: curve }),
    ]),
  );
  void loop.start();
  cleanup(() => loop.stop());
  return (
    <View
      style={{
        position: "absolute",
        left: -1,
        top: -1,
        right: -1,
        bottom: -1,
        opacity: swell,
        boxShadow: v.button.main.breathHigh(tone),
      }}
    />
  );
}

/** A button. The main one is a lamp; every other is a tube, dark until it is hot. */
export function button(v: Tokens, options: ButtonOptions) {
  const b = v.button;
  const kind = options.kind ?? "main";
  const state = options.state ?? "rest";
  const hot = state === "hover" || state === "focus";
  const tone = kind === "danger" ? v.role.removed : v.role.action;
  const breathes = options.breathes === true && choices["button.main.motion"] === "breathe";
  let box: ViewStyle;
  let text = v.role.ink;
  if (state === "disabled") {
    box = { borderColor: b.disabledBorder, borderStyle: "dashed" };
    text = v.role.inkFaint;
  } else if (kind === "main") {
    text = v.role.onAction;
    box = {
      borderColor: tone,
      backgroundImage: b.main.fill(tone),
      boxShadow: breathes ? b.main.breathLow(tone) : b.main.rest(tone),
    };
    if (hot)
      box = { ...box, boxShadow: b.main.hot(tone), filter: `brightness(${b.main.hotBrightness})` };
    if (state === "pressed")
      box = {
        ...box,
        boxShadow: b.main.pressed,
        filter: `brightness(${b.main.pressedBrightness})`,
      };
  } else {
    box = { borderColor: b.tube.border, backgroundColor: b.tube.fill };
    if (kind === "danger") {
      box = { ...box, borderColor: b.tube.dangerBorder, backgroundImage: b.tube.dangerLight };
      text = v.role.removed;
    }
    if (hot) {
      box = {
        borderColor: tone,
        backgroundColor: b.tube.hotFill(tone),
        backgroundImage: b.tube.hotLight(tone),
        boxShadow: b.tube.hot(tone),
      };
      text = b.tube.hotText(tone);
    }
    if (state === "pressed") {
      box = {
        ...box,
        backgroundColor: b.tube.pressedFill,
        backgroundImage: undefined,
        boxShadow: b.tube.pressed,
      };
    }
  }
  if (state === "focus")
    box = {
      ...box,
      outlineWidth: 1,
      outlineColor: b.focusRing(tone),
      outlineOffset: b.focusOffset,
    };
  if (state === "pressed") box = { ...box, translate: [0, 1] };
  return (
    <View
      testID={options.testID}
      style={[
        {
          height: b.height,
          paddingHorizontal: b.padding - 1,
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 7,
          borderWidth: 1,
        },
        box,
      ]}
    >
      {breathes ? breath(v, tone) : null}
      {options.key ? key(v, options.key, "rest", kind === "main" && state !== "disabled") : null}
      {options.icon ? icon(options.icon, text) : null}
      {mono(v, options.label, {
        color: text,
        fontWeight: kind === "main" ? "700" : "400",
        letterSpacing: 0.26,
      })}
    </View>
  );
}

/** The caret, a block in the mode's colour. */
export function caret(v: Tokens, color: string, width = 8) {
  return (
    <View
      style={{
        width,
        height: v.type.line - 2,
        backgroundColor: color,
        opacity: 0.85,
        boxShadow: `0 0 10px ${alpha(color, 0.6)}`,
      }}
    />
  );
}

/** A field: a well with a border. Focused, its edge and its glow take the mode's colour. */
export function field(
  v: Tokens,
  options: {
    text?: string;
    placeholder?: string;
    active?: Mode;
    inside?: "overlay";
    style?: ViewStyle;
  },
) {
  const color = options.active ? v.light.mode[options.active] : undefined;
  const f = v.light.field;
  const lip = v.mode === "dark" || !color ? v.height.recessed.lip : undefined;
  const glow = color ? `0 ${f.y}px ${f.blur}px ${alpha(color, f.strength)}` : undefined;
  return (
    <View
      style={[
        {
          minHeight: v.type.line + 12,
          paddingHorizontal: 9,
          paddingVertical: 5,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: options.inside === "overlay" ? v.glass.well : v.height.recessed.fill,
          borderWidth: 1,
          borderColor: color ?? v.height.recessed.border,
          boxShadow: [lip, glow].filter(Boolean).join(", "),
        },
        options.style,
      ]}
    >
      {options.text ? mono(v, options.text) : null}
      {color ? caret(v, color) : null}
      {options.placeholder ? mono(v, options.placeholder, { color: v.role.inkFaint }) : null}
    </View>
  );
}

export interface RowOptions {
  icon?: IconName;
  /** The icon's hue: its kind's, one of six. */
  hue?: string;
  text: string;
  meta?: string;
  metaColor?: string;
  badge?: string;
  selected?: boolean;
  /** Done, or not there yet: its words step back. */
  quiet?: boolean;
}

/** A row of a list. Selected, it has a 2 px bar of light on its left edge and a fill one step up. */
export function row(v: Tokens, options: RowOptions) {
  return (
    <View
      style={{
        minHeight: v.space.row,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginHorizontal: -8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: options.selected ? v.row.selected : undefined,
      }}
    >
      {options.selected ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: v.row.bar,
            backgroundColor: v.light.focus,
            boxShadow: v.row.barGlow,
          }}
        />
      ) : null}
      {options.icon ? icon(options.icon, options.hue ?? v.role.ink) : null}
      {mono(v, options.text, { flex: 1, color: options.quiet ? v.role.inkFaint : v.role.ink })}
      {options.meta ? mono(v, options.meta, { color: options.metaColor ?? v.role.inkFaint }) : null}
      {options.badge ? (
        <View
          style={{
            height: v.type.line - 2,
            paddingHorizontal: 6,
            justifyContent: "center",
            backgroundColor: v.role.needsYou,
          }}
        >
          {mono(v, options.badge, {
            color: v.role.onAction,
            fontWeight: "700",
            lineHeight: v.type.line - 2,
          })}
        </View>
      ) : null}
    </View>
  );
}

/** The bar of a selected row's actions: raised, under the row, with the same bar of light. */
export function rowBar(v: Tokens, actions: [string, string][]) {
  return (
    <View
      style={{
        marginHorizontal: -8,
        paddingHorizontal: 8,
        paddingTop: 4,
        paddingBottom: 6,
        flexDirection: "row",
        gap: 2,
        backgroundColor: v.row.selected,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: v.row.bar,
          backgroundColor: v.light.focus,
        }}
      />
      {actions.map(([name, word]) => act(v, name, word))}
    </View>
  );
}

/** A line between the groups of a list, dimmer than an edge. */
export function separator(v: Tokens) {
  return (
    <View
      style={{
        height: 1,
        marginHorizontal: -v.space.panePadding,
        marginVertical: 10,
        backgroundColor: v.role.ruleQuiet,
      }}
    />
  );
}

export interface Segment {
  text: string;
  icon?: IconName;
  color?: string;
  /** In the mode's colour, as the segment beside an end is. */
  mode?: boolean;
  key?: string;
}

/**
 * The status line: glass at the raised height, with a solid block in the mode's colour at each
 * end, and counts and hints on the glass between them.
 */
export function statusLine(
  v: Tokens,
  options: {
    mode: Mode;
    left: Segment[];
    right: Segment[];
    place: string;
    style?: ViewStyle;
    testID?: string;
  },
) {
  const color = v.light.mode[options.mode];
  const end = (text: string) => (
    <View
      style={{
        paddingHorizontal: v.status.padding,
        justifyContent: "center",
        backgroundColor: color,
      }}
    >
      {mono(v, text, { color: v.role.onAction, fontWeight: "700" })}
    </View>
  );
  const segment = (s: Segment, first: boolean): JSX.Element => {
    const tone = s.mode ? color : (s.color ?? v.role.inkQuiet);
    return (
      <View
        style={{
          paddingHorizontal: v.status.padding,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderLeftWidth: first ? 0 : 1,
          borderColor: v.role.ruleQuiet,
        }}
      >
        {s.icon ? icon(s.icon, tone) : null}
        {s.key ? key(v, s.key) : null}
        {mono(v, s.text, { color: tone })}
      </View>
    );
  };
  return glass(
    v,
    {
      testID: options.testID,
      edge: v.role.rule,
      shadow: v.height.raised.glassShadow,
      style: { height: v.status.height, padding: 1, ...options.style },
      content: { flex: 1, flexDirection: "row", alignItems: "stretch" },
    },
    <>
      {end(options.mode.toUpperCase())}
      {options.left.map((s, at) => segment(s, at === 0))}
      <View style={{ flex: 1 }} />
      {options.right.map((s, at) => segment(s, at === 0))}
      {end(options.place)}
    </>,
  );
}
