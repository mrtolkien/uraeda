// The transcript of the samples' session: a few turns of an agent at work, drawn as blocks, each
// its own row. The long one repeats them, to scroll under the glass bar.
import { type JSX, Text, type TextStyle, View } from "nsh";
import { icon, type IconName, mono, prose } from "./parts";
import { alpha, type Values } from "./values";

function message(
  v: Values,
  who: string,
  more: string,
  mark: IconName,
  hue: string,
  body: JSX.Element,
) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 8 }}>
      <View style={{ width: 22, paddingTop: 3 }}>{icon(mark, hue)}</View>
      <View style={{ flex: 1 }}>
        {mono(
          v,
          <>
            <Text style={{ color: v.role.text, fontWeight: "700" }}>{who}</Text>
            {more}
          </>,
          { color: v.role.text3 },
        )}
        {body}
      </View>
    </View>
  );
}

function tool(v: Values, mark: IconName, hue: string, path: string, result: string) {
  return (
    <View style={{ minHeight: v.space.row, flexDirection: "row", alignItems: "center", gap: 8 }}>
      {icon(mark, hue)}
      {mono(v, path, { flex: 1, color: v.role.text2 })}
      {mono(v, result, { color: v.role.text3 })}
    </View>
  );
}

const s = (text: string, color: string) => <Text style={{ color }}>{text}</Text>;

/** A code block: a well, with its words in the syntax's hues. */
function code(v: Values) {
  const r = v.role;
  return (
    <View
      style={{
        marginVertical: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: v.height.recessed.fill,
        borderWidth: 1,
        borderColor: v.height.recessed.edge,
        boxShadow: v.height.recessed.lip,
      }}
    >
      {mono(
        v,
        <>
          {s("type", r.accent)} {s("Height", r.accent2)} = {s('"recessed"', r.added)} |{" "}
          {s('"standard"', r.added)} | {s('"raised"', r.added)} | {s('"overlay"', r.added)};{"\n\n"}
          {s("export function", r.accent)} {s("Surface", r.accent2)}(props: {"{"} height:{" "}
          {s("Height", r.accent2)}; children: {s("Node", r.accent2)} {"}"}) {"{\n  "}
          {s("const", r.accent)} t = tokens.height[props.height];{" "}
          {s("// fill, edge, shadow, blur, tint, glow", r.text3)}
          {"\n  "}
          {s("return", r.accent)} {s("draw", r.accent2)}(t, props.children);{"\n}"}
        </>,
      )}
    </View>
  );
}

function diff(v: Values) {
  const r = v.role;
  const line = (sign: string, text: string, color: string, style?: TextStyle) => (
    <View style={[{ flexDirection: "row", paddingHorizontal: 12 }, style]}>
      {mono(v, sign, { width: 20, color })}
      {mono(v, text, { color: sign === " " ? r.text3 : r.text })}
    </View>
  );
  return (
    <View
      style={{
        marginVertical: 6,
        paddingVertical: 6,
        backgroundColor: v.height.recessed.fill,
        borderWidth: 1,
        borderColor: v.height.recessed.edge,
        boxShadow: v.height.recessed.lip,
      }}
    >
      {line(" ", "export const tokens = {", r.text3)}
      {line("-", '  shadow: { card: "0 1px 2px #0003", dialog: "0 8px 24px #0006" },', r.removed, {
        backgroundColor: alpha(r.removed, 0.14),
      })}
      {line("+", "  height: { recessed, standard, raised, overlay },", r.added, {
        backgroundColor: alpha(r.added, 0.14),
      })}
      {line(" ", "  colour: roles,", r.text3)}
      {line(" ", "};", r.text3)}
    </View>
  );
}

const inline = (v: Values, text: string) => (
  <Text style={{ fontFamily: v.type.mono, fontSize: v.type.size, backgroundColor: v.role.well }}>
    {" "}
    {text}{" "}
  </Text>
);

/** The blocks of one exchange, in the order they happened: each makes its row. */
export const BLOCKS: ((v: Values) => JSX.Element)[] = [
  (v) =>
    message(
      v,
      "you",
      " · 14:02",
      "user",
      v.role.accent2,
      prose(
        v,
        "Components should have a concept of height: recessed, standard, overlays at least. It will help draw shadows and glass.",
      ),
    ),
  (v) =>
    message(
      v,
      "claude",
      " · 14:02 · read 6 files",
      "bot",
      v.role.running,
      <>
        {tool(v, "file", v.role.accent2, "specs/ui/design-language.md", "read")}
        {tool(v, "file", v.role.accent2, "app/ui/surfaces/Surface.tsx", "write · 84 lines")}
        {tool(v, "term", v.role.added, "just app-check", "0.8 s · pass")}
      </>,
    ),
  (v) =>
    message(
      v,
      "claude",
      " · 14:03",
      "bot",
      v.role.running,
      <>
        {prose(
          v,
          <>
            A surface now takes one of four heights, and everything else follows from it: its fill,
            its edge, its shadow, and whether it is glass. {inline(v, "Surface")} is the only
            component that draws a shadow, so depth reads the same on every page.
          </>,
        )}
        {mono(v, "The four heights", { color: v.role.h2, fontWeight: "700", marginTop: 10 })}
        {code(v)}
      </>,
    ),
  (v) =>
    message(
      v,
      "claude",
      " · 14:04",
      "bot",
      v.role.running,
      <>
        {prose(
          v,
          "A field inside a dialog is still a well: it takes the dialog's own fill, darkened by the same step. I changed the tokens to carry one set per height.",
        )}
        {diff(v)}
        {tool(v, "term", v.role.added, "just app-test", "running…")}
      </>,
    ),
  (v) =>
    message(
      v,
      "claude",
      " · 14:05",
      "bot",
      v.role.running,
      prose(v, "Now measuring the glass bar over a scrolling transcript of 20,000 messages."),
    ),
];
