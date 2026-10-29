// The one place reading text is drawn: its size, its line, its measure, and the markdown that holds
// prose. A page draws text through these, so a change here changes every page (the UI coherence
// decision). Nothing else reads `--text-reading-*` or `--size-reading-measure`.
import { Markdown } from "@astryxdesign/core/Markdown";
import {
  createMarkdownFenceTransform,
  createMarkdownPlugin,
  type MarkdownExtensionNode,
  type MarkdownFenceContext,
  type MarkdownPluginEntry,
} from "@astryxdesign/core/Markdown/plugins";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

export const proseStyles = stylex.create({
  // Body text at the UI layout decision's size, from the theme, 19 px at every width, in the
  // reading font, the UI look decision's proportional one. Its text inherits the font, while
  // headings, code, and controls keep the monospace font: the body font stays the UI's, and the
  // theme sets buttons and badges in it. Astryx's own body text is the UI's smaller size, for rows
  // and labels.
  reading: {
    fontFamily: "var(--font-family-reading)",
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    textWrap: "pretty",
  },
  // The reading size alone, for a control that reads as text, such as a fold's toggle: its font
  // stays the UI's.
  size: { fontSize: "var(--text-reading-size)" },
  // About 80 characters of prose a line, the theme's reading measure.
  measure: { maxWidth: "var(--size-reading-measure)" },
  // Astryx's markdown sets its text in the body font: its text takes the reading font instead.
  markdown: { fontFamily: "var(--font-family-reading)" },
  // Prose as wide as its pane, past the measure: for a pane whose width sets its line, as a reading
  // page's pane of prose does, its text ending at its border.
  paneWide: { "--size-reading-measure": "none" },
  // A document's text: reading text at the measure, left-aligned.
  doc: {
    fontFamily: "var(--font-family-reading)",
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    maxWidth: "var(--size-reading-measure)",
    textAlign: "start",
    textWrap: "pretty",
  },
});

/** A fenced block of a language `fencePlugin` draws: its code, and the rest of its info string. */
export type Fence = { code: string; meta: string };

/** What `ProseMarkdown` draws some of its parts with, as `fencePlugin` makes. */
export type ProsePlugin = MarkdownPluginEntry;

/**
 * Draws the fenced blocks of `language` with `render`, given the block and what `read` made of it,
 * like ` ```uraeda-offer change ` as a card. A block `read` gives `undefined` for stays a code block.
 * Astryx's `components.code` cuts the language at its first non-word character, and loses the
 * rest of the info string: this keeps both.
 */
export function fencePlugin<Data extends Record<string, string>>({
  language,
  read,
  render,
}: {
  language: string;
  read: (fence: Fence) => Data | undefined;
  render: (data: Data) => ReactNode;
}): ProsePlugin {
  const name = `fence-${language}`;
  // The node keeps the block's own text beside what `read` made of it: its text is the block's.
  const of = (node: MarkdownExtensionNode) => node.data as { code: string; read: Data };
  return createMarkdownPlugin({
    apiVersion: 1,
    name,
    renderers: {
      fence: {
        render: ({ node }: { node: MarkdownExtensionNode }) => render(of(node).read),
        toText: (node: MarkdownExtensionNode) => of(node).code,
      },
    },
    transform: createMarkdownFenceTransform({
      createNode: ({ code, meta }: MarkdownFenceContext<string>) => {
        const data = read({ code, meta: meta ?? "" });
        return data === undefined
          ? undefined
          : ({
              data: { code, read: data },
              display: "block",
              name: "fence",
              plugin: name,
              type: "extension",
            } as const);
      },
      languages: [language],
    }),
  });
}

/**
 * Markdown as prose: at the reading size and line, as wide as its column, which the page sets (a
 * wider default of Astryx's would cap lists and headings and leave a replaced paragraph alone).
 * `components` replaces how some of its parts draw, and `plugins` draws some fenced blocks.
 */
export function ProseMarkdown({
  children,
  components,
  plugins,
}: {
  children: string;
  components?: ComponentProps<typeof Markdown>["components"];
  plugins?: ReadonlyArray<ProsePlugin>;
}): ReactNode {
  return (
    <div {...stylex.props(proseStyles.reading)}>
      <Markdown
        autolink="gfm"
        components={components}
        contentWidth="100%"
        headingLevelStart={4}
        plugins={plugins}
        xstyle={proseStyles.markdown}
      >
        {children}
      </Markdown>
    </div>
  );
}
