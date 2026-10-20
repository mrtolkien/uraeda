// The one place reading text is drawn: its size, its line, its measure, and the markdown that holds
// prose. A page draws text through these, so a change here changes every page (the UI coherence
// decision). Nothing else reads `--text-reading-*` or `--size-reading-measure`.
import { Markdown } from "@astryxdesign/core/Markdown";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

export const proseStyles = stylex.create({
  // Body text at the UI layout decision's size, from the theme: 17 px on the phone, 19 px from
  // 1024 px wide. Astryx's own body text is the UI's smaller size, for rows and labels.
  reading: {
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    textWrap: "pretty",
  },
  // About 120 characters of text a line: `ch` is the width of a "0", wider than most letters, so
  // 90ch holds about 110 of them.
  measure: { maxWidth: "var(--size-reading-measure)" },
  // A document's text: reading text at the measure, left-aligned.
  doc: {
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    maxWidth: "var(--size-reading-measure)",
    textAlign: "start",
    textWrap: "pretty",
  },
});

/**
 * Markdown as prose: at the reading size and line, as wide as its column, which the page sets (a
 * wider default of Astryx's would cap lists and headings and leave a replaced paragraph alone).
 * `components` replaces how some of its parts draw.
 */
export function ProseMarkdown({
  children,
  components,
}: {
  children: string;
  components?: ComponentProps<typeof Markdown>["components"];
}): ReactNode {
  return (
    <div {...stylex.props(proseStyles.reading)}>
      <Markdown autolink="gfm" components={components} contentWidth="100%" headingLevelStart={4}>
        {children}
      </Markdown>
    </div>
  );
}
