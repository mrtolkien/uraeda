// What the samples share: text, icons, the busiest page, and the surfaces, which are the
// component library's (`app/ui/surfaces/`), drawn in the theme the page shows. The text and the
// icons are plain Native Shell elements until the controls exist.
import { Image, type JSX, signal, Text, type TextStyle, View, type ViewStyle } from "nsh";
import { Pane, Surface } from "../../ui/surfaces";
import { alpha, type Tokens } from "../../ui/tokens";

export type Height = "recessed" | "standard" | "raised" | "overlay";

/**
 * Whether what sits on glass is hidden. The pictures' driver takes each glass sample with and
 * without it: the pixels that differ are the text's, and the second picture has what is under them.
 */
export const bare = signal(false);

/** A line of monospace text at the reading size. */
export function mono(v: Tokens, text: JSX.Element, style?: TextStyle) {
  return (
    <Text
      style={[
        {
          fontFamily: v.type.body,
          fontSize: v.type.size,
          lineHeight: v.type.line,
          color: v.role.ink,
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
}

/** A small label, one step under the reading size. */
export function tag(v: Tokens, text: string, style?: TextStyle) {
  return mono(v, text, { fontSize: v.type.under, color: v.role.inkFaint, ...style });
}

/** Long prose, in the reading font. */
export function prose(v: Tokens, text: JSX.Element, style?: TextStyle) {
  return (
    <Text
      style={[
        {
          fontFamily: v.type.reading,
          fontSize: v.type.prose,
          lineHeight: v.type.proseLine,
          color: v.role.ink,
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
}

const ICONS = {
  home: "M3 11 12 3l9 8v10H3z M9 21v-7h6v7",
  inbox: "M3 13h5l1 3h6l1-3h5 M3 13 6 4h12l3 9v7H3z",
  flag: "M5 22V3h14l-3 5 3 5H5",
  layers: "m12 3 9 5-9 5-9-5z M3 13l9 5 9-5 M3 17.5l9 5 9-5",
  chat: "M3 4h18v13H9l-6 4z",
  scale: "M12 3v18 M6 21h12 M4 7h16 M4 7l-2 7h6z M20 7l-2 7h6z",
  git: "M6 3v12 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9c0 6-12 3-12 9",
  gear: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2",
  file: "M6 2h9l4 4v16H6z M15 2v4h4",
  term: "M3 4h18v16H3z M7 9l3 3-3 3 M12 15h5",
  bot: "M5 9h14v11H5z M12 9V4 M9 14v2 M15 14v2 M2 14h3 M19 14h3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-5 4-7 8-7s8 2 8 7",
  check: "m4 12 5 5L20 6",
  dot: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  ring: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M16 16l5 5",
  send: "M3 12 21 4l-6 17-3-8z",
  alert: "M12 3 2 20h20z M12 10v5 M12 17.5v.5",
  plug: "M9 2v6 M15 2v6 M6 8h12v4a6 6 0 0 1-12 0z M12 18v4",
};

export type IconName = keyof typeof ICONS;

/** A line icon in one colour: an `<Image>` draws an SVG's shapes, so the colour is in the picture. */
export function icon(name: IconName, color: string, size = 16) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
    `stroke="${color}" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="${ICONS[name]}"/></svg>`;
  return (
    <Image
      src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Glass, as `Surface` draws it: an overlay's, or with `bar` a raised surface over what scrolls.
 * `tab` is the plate an overlay's title sits on.
 */
export function glass(
  _v: Tokens,
  options: {
    bar?: boolean;
    style?: ViewStyle;
    content?: ViewStyle;
    tab?: JSX.Element;
    testID?: string;
  },
  children?: JSX.Element,
) {
  return (
    <Surface
      glass
      height={options.bar === true ? "raised" : "overlay"}
      style={options.style}
      tab={options.tab}
      testID={options.testID}
    >
      <View style={[options.content, { opacity: bare() ? 0 : 1 }]}>{children}</View>
    </Surface>
  );
}

/** A surface at a height: inside another it keeps its recipe, which `Surface` reads itself. */
export function surface(
  _v: Tokens,
  height: Height,
  options: { style?: ViewStyle },
  children?: JSX.Element,
) {
  return (
    <Surface height={height} style={options.style}>
      {children}
    </Surface>
  );
}

const span = (text: string, style: TextStyle) => <Text style={style}>{text}</Text>;

/** Words and blocks of every colour: the busiest page glass sits over. */
export function busy(v: Tokens, times: number) {
  const r = v.role;
  const once = () => (
    <Text>
      {span("fn", { color: r.action, fontWeight: "700" })} draw(surface) {"{ "}
      {span("blur", { color: r.added })}(14); tint(0.46); {span("bend", { color: r.needsYou })}(22){" "}
      {"}"} ─ features » nsh-migration » plan · 61 tasks ─{" "}
      {span("+ height: { recessed, standard, raised, overlay }", { color: r.added })}{" "}
      {span("- shadow: { card, dialog }", { color: r.needsYou })}{" "}
      {span("Session", { color: r.action, fontWeight: "700" })} · task 27 · Surfaces{" "}
      {span(" Approve ", { backgroundColor: r.action, color: r.onAction })}{" "}
      {span("+ tokens.height", { backgroundColor: alpha(r.added, 0.14) })}{" "}
      {span(" 10 ", { backgroundColor: r.needsYou, color: r.onAction })}{" "}
      {span("- tokens.shadow", { backgroundColor: alpha(r.removed, 0.14) })}{" "}
    </Text>
  );
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      {mono(
        v,
        Array.from({ length: times }, () => once()),
      )}
    </View>
  );
}

export interface PaneOptions {
  title: string;
  /** What follows the title, dimmer: a count, a place. */
  more?: string;
  icon?: IconName;
  /** The title's colour at rest: the pane's role colour. */
  color?: string;
  focused?: boolean;
  running?: boolean;
  needs?: boolean;
  /** A pane in a pane: a card with a title. */
  raised?: boolean;
  style?: ViewStyle;
  /** The style of the box the children are in. */
  body?: ViewStyle;
}

/** A pane, as `Pane` draws it: its border goes round its title, and with the focus it emits light. */
export function pane(_v: Tokens, options: PaneOptions, children?: JSX.Element) {
  const name = options.icon;
  return (
    <Pane
      body={options.body}
      focused={options.focused}
      height={options.raised === true ? "raised" : "standard"}
      icon={name === undefined ? undefined : (colour) => icon(name, colour)}
      more={options.more}
      needs={options.needs}
      running={options.running === true ? true : undefined}
      style={options.style}
      title={options.title}
      tone={options.color}
    >
      {children}
    </Pane>
  );
}
