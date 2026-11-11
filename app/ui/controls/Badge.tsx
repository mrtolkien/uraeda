// A badge: a count or a word about what it sits beside, "10", "draft". Its words in its tone,
// on a faint block of it, as high as a key, so it never makes its line taller.
import { View } from "nsh";
import { Text } from "./Text";
import { type Tone, tokens } from "../tokens";

export type BadgeProps = {
  children: string | number;
  /** `needs` for what waits on the human, `quiet` for a plain count: the accent unless given. */
  tone?: Tone;
  testID?: string;
};

export function Badge(props: BadgeProps) {
  const colour = () => tokens.control.tone(props.tone ?? "accent");
  return (
    <View
      style={{
        alignItems: "center",
        alignSelf: "center",
        backgroundColor: tokens.control.tint(colour()),
        flexShrink: 0,
        height: tokens.control.badge.height,
        justifyContent: "center",
        minWidth: tokens.control.badge.height,
        paddingHorizontal: tokens.control.badge.padding,
      }}
      testID={props.testID}
    >
      <Text bold colour={colour()} size="under" style={{ lineHeight: tokens.control.badge.height }}>
        {String(props.children)}
      </Text>
    </View>
  );
}
