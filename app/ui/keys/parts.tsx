// What the keys' views are drawn with until the component library has it: a key, a line of words,
// and the box of what floats over the page. Plain Native Shell elements, with the colours of
// `look.ts`.
//
// TASK 28: `KeyCap` is the one key, `Kbd`; `Words` is `Text`; `Panel` is `Overlay`, or `Sheet` on
// a narrow window (task 27's surfaces), which bring the glass, the shadow, and the motion.
import { createMotion, type JSX, Overlay, Text, View, type ViewStyle } from "nsh";
import { isNarrow, look } from "./look";
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

/** A sheet's place on a narrow window, which has no status line. */
const sheet = (): ViewStyle => ({ bottom: 8, left: 8, right: 8 });

/**
 * The box of what floats over the page, rising as it comes. `place` "corner" puts it at the
 * window's bottom right, above the status line, the page still pressed around it; "middle" in the
 * window's middle, over the page dimmed, a press on which calls `onClose`, as the phone's back
 * button does. On a narrow window either is a sheet, across the width, at the bottom. Escape is a
 * key, which the box's owner declares.
 */
export function Panel(props: {
  children?: JSX.Element;
  onClose?: () => void;
  place: "corner" | "middle";
  testID: string;
  width?: number;
}) {
  const motion = createMotion({
    duration: look().motion.in.duration,
    enter: { keyframes: { opacity: [0, 1], translateY: [look().motion.rise, 0] } },
  });
  const box = (): ViewStyle => ({
    backgroundColor: look().panel,
    borderColor: look().edge,
    borderWidth: 1,
    gap: 8,
    padding: look().pad,
    ...motion.style,
  });
  // Where it floats is fixed for as long as it is shown.
  const { place } = props;
  if (place === "corner") {
    return (
      <Overlay
        testID={props.testID}
        style={{
          ...box(),
          position: "absolute",
          ...(isNarrow() ? sheet() : { bottom: look().statusLine + 8, right: 12 }),
        }}
      >
        {props.children}
      </Overlay>
    );
  }
  return (
    <Overlay
      onCancel={props.onClose}
      style={{
        alignItems: "center",
        bottom: 0,
        justifyContent: isNarrow() ? "flex-end" : "center",
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
      }}
    >
      <View
        focusable={false}
        onPress={props.onClose}
        style={{
          backgroundColor: look().dim,
          bottom: 0,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />
      <View
        testID={props.testID}
        style={{
          ...box(),
          maxHeight: "80%",
          ...(isNarrow() ? { alignSelf: "stretch", margin: 8 } : { width: props.width }),
        }}
      >
        {props.children}
      </View>
    </Overlay>
  );
}
