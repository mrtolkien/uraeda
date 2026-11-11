// The transcript of the samples' session: a few turns of an agent at work, drawn as blocks, each
// its own row. The long one repeats them, to scroll under the glass bar.
import { type JSX, Text, type TextStyle, View } from "nsh";
import { icon, type IconName, mono, prose } from "./parts";
import { alpha, type Tokens } from "../../ui/tokens";

function message(
  v: Tokens,
  who: string,
  more: string,
  mark: IconName,
  hue: string,
  body: JSX.Element,
) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 8 }}>
      <View style={{ width: 22, paddingTop: 4 }}>{icon(mark, hue)}</View>
      <View style={{ flex: 1 }}>
        {mono(
          v,
          <>
            <Text style={{ color: v.role.ink, fontWeight: "700" }}>{who}</Text>
            {more}
          </>,
          { color: v.role.inkFaint },
        )}
        {body}
      </View>
    </View>
  );
}

function tool(v: Tokens, mark: IconName, hue: string, path: string, result: string) {
  return (
    <View style={{ minHeight: v.space.row, flexDirection: "row", alignItems: "center", gap: 8 }}>
      {icon(mark, hue)}
      {mono(v, path, { flex: 1, color: v.role.inkQuiet })}
      {mono(v, result, { color: v.role.inkFaint })}
    </View>
  );
}

const s = (text: string, color: string) => <Text style={{ color }}>{text}</Text>;

/** A code block: a well, with its words in the syntax's hues. */
function code(v: Tokens) {
  const r = v.role;
  return (
    <View
      style={{
        marginVertical: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: v.height.recessed.fill,
        borderWidth: 1,
        borderColor: v.height.recessed.border,
        boxShadow: v.height.recessed.lip,
      }}
    >
      {mono(
        v,
        <>
          {s("type", r.action)} {s("Height", r.context)} = {s('"recessed"', r.added)} |{" "}
          {s('"standard"', r.added)} | {s('"raised"', r.added)} | {s('"overlay"', r.added)};{"\n\n"}
          {s("export function", r.action)} {s("Surface", r.context)}({"{"} height, children {"}"}:{" "}
          {s("Props", r.context)}) {"{\n  "}
          {s("// Its fill, edge, shadow, blur, tint, and glow.", r.inkFaint)}
          {"\n  "}
          {s("const", r.action)} t = tokens.height[height];{"\n  "}
          {s("return", r.action)} {s("draw", r.context)}(t, children);{"\n}"}
        </>,
      )}
    </View>
  );
}

function diff(v: Tokens) {
  const r = v.role;
  const line = (sign: string, text: string, color: string, style?: TextStyle) => (
    <View style={[{ flexDirection: "row", paddingHorizontal: 12 }, style]}>
      {mono(v, sign, { width: 20, color })}
      {mono(v, text, { color: sign === " " ? r.inkFaint : r.ink })}
    </View>
  );
  return (
    <View
      style={{
        marginVertical: 6,
        paddingVertical: 6,
        backgroundColor: v.height.recessed.fill,
        borderWidth: 1,
        borderColor: v.height.recessed.border,
        boxShadow: v.height.recessed.lip,
      }}
    >
      {line(" ", "export const tokens = {", r.inkFaint)}
      {line("-", '  shadow: { card: "0 1px 2px", dialog: "0 8px 24px" },', r.removed, {
        backgroundColor: alpha(r.removed, 0.14),
      })}
      {line("+", "  height: { recessed, standard, raised, overlay },", r.added, {
        backgroundColor: alpha(r.added, 0.14),
      })}
      {line(" ", "  colour: roles,", r.inkFaint)}
      {line(" ", "};", r.inkFaint)}
    </View>
  );
}

const inline = (v: Tokens, text: string) => (
  <Text style={{ fontFamily: v.type.body, fontSize: v.type.size, backgroundColor: v.role.well }}>
    {" "}
    {text}{" "}
  </Text>
);

/** The blocks of one exchange, in the order they happened: each makes its row. */
export const BLOCKS: ((v: Tokens) => JSX.Element)[] = [
  (v) =>
    message(
      v,
      "you",
      " · 14:02",
      "user",
      v.role.context,
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
      v.role.lightRunning,
      <>
        {tool(v, "file", v.role.context, "specs/ui/design-language.md", "read")}
        {tool(v, "file", v.role.context, "app/ui/surfaces/Surface.tsx", "write · 84 lines")}
        {tool(v, "term", v.role.added, "just app-check", "0.8 s · pass")}
      </>,
    ),
  (v) =>
    message(
      v,
      "claude",
      " · 14:03",
      "bot",
      v.role.lightRunning,
      <>
        {prose(
          v,
          <>
            A surface now takes one of four heights, and everything else follows from it: its fill,
            its edge, its shadow, and whether it is glass. {inline(v, "Surface")} is the only
            component that draws a shadow, so depth reads the same on every page.
          </>,
        )}
        {mono(v, "The four heights", { color: v.role.heading2, fontWeight: "700", marginTop: 10 })}
        {code(v)}
      </>,
    ),
  (v) =>
    message(
      v,
      "claude",
      " · 14:04",
      "bot",
      v.role.lightRunning,
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
      v.role.lightRunning,
      prose(v, "Now measuring the glass bar over a scrolling transcript of 20,000 messages."),
    ),
];
