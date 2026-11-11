// What the keys' views are drawn with until the component library has it: a key, and a line of
// words. Plain Native Shell elements, with the colours of `look.ts`. What floats over the page is
// an `Overlay` (`app/ui/surfaces/`).
//
// TASK 28: `KeyCap` is the one key, `Kbd`; `Words` is `Text`.
import { type JSX, Text, View } from "nsh";
import { look } from "./look";
import { written } from "./token";

/** A key as it is typed: "j", "↓", "Ctrl+K". Space is written "space". */
export function KeyCap(props: { token: string }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: look().key.fill,
        height: look().key.size,
        justifyContent: "center",
        minWidth: look().key.size,
        paddingHorizontal: look().key.padding,
      }}
    >
      <Text
        style={{
          color: look().key.text,
          fontFamily: look().type.mono,
          fontSize: look().type.small,
          fontWeight: "700",
          lineHeight: look().key.size,
        }}
      >
        {written(props.token)}
      </Text>
    </View>
  );
}

/** A line of the views' words: the text's colour, or `tone` "quiet" or "accent". */
export function Words(props: { children?: JSX.Element; tone?: "accent" | "quiet" }) {
  return (
    <Text
      style={{
        color:
          props.tone === "accent"
            ? look().accent
            : props.tone === "quiet"
              ? look().quiet
              : look().text,
        fontFamily: look().type.mono,
        fontSize: look().type.size,
        fontWeight: props.tone === "accent" ? "700" : "400",
        lineHeight: look().type.line,
      }}
    >
      {props.children}
    </Text>
  );
}
