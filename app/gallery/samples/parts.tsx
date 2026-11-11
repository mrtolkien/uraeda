// What the samples share: text, icons, the four heights, glass, and the pane with its border round
// its title. Plain NSH elements, with every value from `values.ts`: the component library replaces
// all of this.
import { Image, type JSX, Shader, signal, Text, type TextStyle, View, type ViewStyle } from "nsh";
import { GLASS, GLOW } from "./shaders";
import { alpha, mix, type Values } from "./values";

export type Height = "recessed" | "standard" | "raised" | "overlay";

/**
 * Whether what sits on glass is hidden. The pictures' driver takes each glass sample with and
 * without it: the pixels that differ are the text's, and the second picture has what is under them.
 */
export const bare = signal(false);

/** A line of monospace text at the reading size. */
export function mono(v: Values, text: JSX.Element, style?: TextStyle) {
  return (
    <Text
      style={[
        {
          fontFamily: v.type.mono,
          fontSize: v.type.size,
          lineHeight: v.type.line,
          color: v.role.text,
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
}

/** A small label, one step under the reading size. */
export function tag(v: Values, text: string, style?: TextStyle) {
  return mono(v, text, { fontSize: v.type.under, color: v.role.text3, ...style });
}

/** Long prose, in the reading font. */
export function prose(v: Values, text: JSX.Element, style?: TextStyle) {
  return (
    <Text
      style={[
        {
          fontFamily: v.type.reading,
          fontSize: v.type.prose,
          lineHeight: v.type.proseLine,
          color: v.role.text,
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
export function icon(name: IconName, color: string, size = 14) {
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

/** Glass: the shader, with the theme's recipe. `edge` is the line under its rim. */
export function glass(
  v: Values,
  options: {
    style?: ViewStyle;
    content?: ViewStyle;
    edge?: string;
    shadow?: string;
    testID?: string;
  },
  children?: JSX.Element,
) {
  const g = v.glass;
  return (
    <Shader
      testID={options.testID}
      source={GLASS}
      uniforms={{
        tint: alpha(g.tint, g.strength),
        rim: alpha(g.rim, g.rimCorner),
        edge: options.edge ?? v.height.overlay.edge,
        shadow: alpha(v.black, g.shade),
        frost: g.frost,
        edge_frost: g.edgeFrost,
        saturate: g.saturate,
        brightness: g.brightness,
        band: g.band,
        pull: g.pull,
        fringe: g.fringe,
        rim_between: g.rimBetween,
        thicken: g.thicken,
        line: g.line,
        sheen: g.sheen,
        glow: g.glow,
        grain: g.grain,
        light: v.mode === "light" ? 1 : 0,
      }}
      style={[{ boxShadow: options.shadow ?? v.height.overlay.shadow }, options.style]}
    >
      <View style={[options.content, { opacity: bare() ? 0 : 1 }]}>{children}</View>
    </Shader>
  );
}

/** A surface at a height, inside a surface at `inside`: a height keeps its recipe wherever it is. */
export function surface(
  v: Values,
  height: Height,
  options: { inside?: Height; style?: ViewStyle },
  children?: JSX.Element,
) {
  if (height === "overlay") {
    const { padding, paddingHorizontal, paddingVertical, ...box } = options.style ?? {};
    return glass(
      v,
      { style: box, content: { padding, paddingHorizontal, paddingVertical } },
      children,
    );
  }
  const h = v.height[height];
  let fill = h.fill;
  if (height === "recessed" && options.inside === "raised") fill = v.height.recessed.fillIn.raised;
  if (height === "recessed" && (options.inside === "recessed" || options.inside === "overlay"))
    fill = v.height.recessed.fillIn.deeper;
  return (
    <View
      style={[
        { backgroundColor: fill, borderWidth: 1, borderColor: h.edge, boxShadow: h.lip },
        options.style,
      ]}
    >
      {children}
    </View>
  );
}

const span = (text: string, style: TextStyle) => <Text style={style}>{text}</Text>;

/** Words and blocks of every colour: the busiest page glass sits over. */
export function busy(v: Values, times: number) {
  const r = v.role;
  const once = () => (
    <Text>
      {span("fn", { color: r.accent, fontWeight: "700" })} draw(surface) {"{ "}
      {span("blur", { color: r.added })}(14); tint(0.46); {span("bend", { color: r.needs })}(22){" "}
      {"}"} ─ features » nsh-migration » plan · 61 tasks ─{" "}
      {span("+ height: { recessed, standard, raised, overlay }", { color: r.added })}{" "}
      {span("- shadow: { card, dialog }", { color: r.needs })}{" "}
      {span("Session", { color: r.accent, fontWeight: "700" })} · task 27 · Surfaces{" "}
      {span(" Approve ", { backgroundColor: r.accent, color: r.onAccent })}{" "}
      {span("+ tokens.height", { backgroundColor: alpha(r.added, 0.14) })}{" "}
      {span(" 10 ", { backgroundColor: r.needs, color: r.onAccent })}{" "}
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
  fill?: string;
  style?: ViewStyle;
  /** The style of the box the children are in. */
  body?: ViewStyle;
}

/**
 * A pane, with its border round its title: the title stands 12 px above the pane's top edge, and
 * the outline steps up and over it. Focused, the outline is the two lights, mauve at the bottom
 * left and blue at the top right, its glow follows the same shape, and the title fills.
 */
export function pane(v: Values, options: PaneOptions, children?: JSX.Element) {
  const p = v.pane;
  const lit = options.focused === true;
  const fill = options.fill ?? p.fill;
  const [from, to] = [v.light.focus, v.light.focus2];
  const mid = mix(from, to, 0.5);
  const titleColor = lit
    ? v.role.onAccent
    : options.needs
      ? v.light.needs
      : (options.color ?? v.role.text2);
  const moreColor = lit ? alpha(v.role.onAccent, 0.72) : v.role.text3;
  const title = (color: string, more: string) => (
    <View
      style={{
        height: p.titleHeight - 1,
        paddingLeft: p.titlePadding[0] - 1,
        paddingRight: p.titlePadding[1] - 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      {options.icon ? icon(options.icon, color) : null}
      {mono(v, options.title, { color, fontWeight: "700" })}
      {options.more ? mono(v, options.more, { color: more }) : null}
    </View>
  );
  const whole: ViewStyle = { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 };
  const glow = v.light.glow;
  // The title's width, which the glow's shape needs: known once the title is laid out.
  const titleWidth = signal(0);
  return (
    <View style={[{ marginTop: p.titleRise }, options.style]}>
      {lit ? (
        <Shader
          source={GLOW}
          uniforms={{
            first: alpha(from, glow.strength),
            second: alpha(to, glow.strength),
            title: [titleWidth(), p.titleRise],
            reach: glow.reach,
            blur: glow.blur,
            offset: glow.offset,
            single: v.mode === "light" ? 1 : 0,
          }}
          style={{
            position: "absolute",
            left: -glow.reach,
            right: -glow.reach,
            top: -p.titleRise - glow.reach,
            bottom: -glow.reach,
          }}
        />
      ) : null}
      <View style={[whole, { backgroundColor: fill }]} />
      {lit ? (
        <View style={whole}>
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundImage: `linear-gradient(0deg, ${from}, ${mid})`,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              height: 1,
              backgroundImage: `linear-gradient(90deg, ${mid}, ${to})`,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundImage: `linear-gradient(0deg, ${mid}, ${to})`,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              right: 0,
              height: 1,
              backgroundImage: `linear-gradient(90deg, ${from}, ${mid})`,
            }}
          />
        </View>
      ) : (
        <View style={[whole, { borderWidth: 1, borderColor: p.edge }]} />
      )}
      {options.running ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: v.light.runningWidth,
            backgroundColor: v.light.running,
            boxShadow: v.light.runningGlow,
          }}
        />
      ) : null}
      <View
        onLayout={(event) => titleWidth.set(event.bounds.size.width)}
        style={{
          position: "absolute",
          left: 0,
          top: -p.titleRise,
          height: p.titleRise + 1,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: lit ? mid : p.edge,
          backgroundColor: fill,
        }}
      >
        {lit ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              height: p.titleHeight - 1,
              backgroundColor: options.needs ? v.light.needs : from,
            }}
          />
        ) : null}
        {title(titleColor, moreColor)}
      </View>
      <View
        style={[
          {
            // It fills a pane that has a height, and is as high as its content in one that has none.
            // It clips what it holds, a glow included: a main action's breath stays in its pane,
            // and never reaches the glass of the status line, which would redraw with each frame.
            overflow: "hidden",
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: "auto",
            paddingTop: 16,
            paddingHorizontal: v.space.panePadding,
            paddingBottom: v.space.panePadding,
          },
          options.body,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
