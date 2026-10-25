import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { proseStyles } from "../Prose.tsx";

/**
 * A paragraph of a page's text, in the reading font, size, and line: every paragraph of reading text
 * is drawn here. Without them, the theme's base styles set a `<p>` in the UI's monospace font, at
 * its body size, and a paragraph drawn its own way reads apart from its list items. `as` is `div`
 * for a paragraph that holds a box, as an image's lightbox, which a `<p>` cannot.
 */
export function Paragraph({
  as = "p",
  children,
  color,
  xstyle,
}: {
  as?: "div" | "p";
  children: ReactNode;
  color?: "secondary";
  xstyle?: stylex.StyleXStyles;
}) {
  return (
    <Text
      as={as}
      color={color}
      display="block"
      type="inherit"
      xstyle={[proseStyles.reading, xstyle]}
    >
      {children}
    </Text>
  );
}
