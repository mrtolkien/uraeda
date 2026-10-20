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
  return createMarkdownPlugin({
    apiVersion: 1,
    name,
    renderers: {
      fence: {
        render: ({ node }: { node: MarkdownExtensionNode }) => render(node.data as Data),
        toText: (node: MarkdownExtensionNode) => Object.values(node.data as Data).join("\n"),
      },
    },
    transform: createMarkdownFenceTransform({
      createNode: ({ code, meta }: MarkdownFenceContext<string>) => {
        const data = read({ code, meta: meta ?? "" });
        return data === undefined
          ? undefined
          : ({ data, display: "block", name: "fence", plugin: name, type: "extension" } as const);
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
      >
        {children}
      </Markdown>
    </div>
  );
}
