import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  // Body text at the UI layout decision's size, from the theme: 17 px on the phone, 19 px from
  // 1024 px wide. Astryx's own body text is the UI's smaller size, for rows and labels.
  reading: {
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    textWrap: "pretty",
  },
});

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
    <Text as="p" type="inherit" display="block" color={color} xstyle={[styles.reading, xstyle]}>
      {children}
    </Text>
  );
}
