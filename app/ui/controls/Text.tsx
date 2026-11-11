// Text: every word the library draws, in the interface's monospace by default, on the 24 px line.
// Hierarchy comes from colour and weight before size: a tone, then `bold`, then a step of the
// scale. Long prose is the document renderer's (task 31), never this.
import { type JSX, type StyleProp, Text as Words, type TextStyle } from "nsh";
import { type Tone, tokens } from "../tokens";

/** A text colour: a tone, or the ink and its two quieter steps. */
export type Ink = "ink" | "quiet" | "faint" | "link" | Tone;

/** The scale's four steps: `under` for what reads second, `over` and `over2` for titles. */
export type Size = "under" | "size" | "over" | "over2";

export type TextProps = {
  bold?: boolean;
  children?: JSX.Element;
  /** Any colour of the tokens, over `tone`: a heading's role, a kind's hue. */
  colour?: string;
  /** `code` for paths and code, `heading` for titles: the interface's otherwise. */
  font?: "body" | "code" | "heading";
  italic?: boolean;
  /** At most this many lines, the last cut with an ellipsis. */
  lines?: number;
  size?: Size;
  style?: StyleProp<TextStyle>;
  testID?: string;
  tone?: Ink;
};

/** A colour by its name in `Ink`. */
export function inkOf(tone: Ink): string {
  switch (tone) {
    case "ink":
      return tokens.role.ink;
    case "quiet":
      return tokens.role.inkQuiet;
    case "faint":
      return tokens.role.inkFaint;
    case "link":
      return tokens.role.link;
    default:
      return tokens.control.tone(tone);
  }
}

/** The style of a text: what `Text` draws, for a part that draws its own (an input's). */
export function textStyle(props: Pick<TextProps, "bold" | "colour" | "font" | "size" | "tone">) {
  const size = props.size ?? "size";
  return {
    color: props.colour ?? inkOf(props.tone ?? "ink"),
    fontFamily: tokens.type[props.font ?? "body"],
    fontSize: tokens.type[size],
    fontWeight: props.bold === true ? "700" : "400",
    // Every step sits on the 24 px line but the largest, which takes prose's.
    lineHeight: size === "over2" ? tokens.type.proseLine : tokens.type.line,
  } as const;
}

export function Text(props: TextProps) {
  return (
    <Words
      style={[
        textStyle(props),
        props.lines === undefined ? null : { numberOfLines: props.lines },
        props.italic === true ? { fontStyle: "italic" } : null,
        props.style,
      ]}
      testID={props.testID}
    >
      {props.children}
    </Words>
  );
}
