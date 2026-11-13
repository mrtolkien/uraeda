// A title: the heading font, bold, in its level's role colour, at a step over the reading size.
// Colour says the level before size does.
import type { JSX, StyleProp, TextStyle } from "nsh";
import { Text } from "./Text";
import { tokens } from "../tokens";

export type HeadingProps = {
  children?: JSX.Element;
  /** 1 for a page's title, 2 for a part of it, 3 for a group. */
  level?: 1 | 2 | 3;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

export function Heading(props: HeadingProps) {
  const level = () => props.level ?? 2;
  return (
    <Text
      bold
      colour={tokens.role[`heading${level()}`]}
      font="heading"
      size={level() === 1 ? "over2" : level() === 2 ? "over" : "size"}
      style={props.style}
      testID={props.testID}
    >
      {props.children}
    </Text>
  );
}
