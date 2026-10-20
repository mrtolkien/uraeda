import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { proseStyles } from "../Prose.tsx";

/** A paragraph of a page's text. */
export function Paragraph({
  children,
  color,
  xstyle,
}: {
  children: ReactNode;
  color?: "secondary";
  xstyle?: stylex.StyleXStyles;
}) {
  return (
    <Text
      as="p"
      color={color}
      display="block"
      type="inherit"
      xstyle={[proseStyles.reading, xstyle]}
    >
      {children}
    </Text>
  );
}
