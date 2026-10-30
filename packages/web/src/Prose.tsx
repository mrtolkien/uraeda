// The one place reading text is drawn: its size, its line, its measure, its rhythm, and the
// markdown that holds prose. A page draws text through these, so a change here changes every page
// (the UI components decision). Nothing else reads `--text-reading-*`, `--prose-*`, or
// `--size-reading-measure`, but the theme's rule for markdown lists, which StyleX cannot reach.
import { Markdown } from "@astryxdesign/core/Markdown";
import {
  createMarkdownFenceTransform,
  createMarkdownPlugin,
  type MarkdownExtensionNode,
  type MarkdownFenceContext,
  type MarkdownPluginEntry,
} from "@astryxdesign/core/Markdown/plugins";
import { typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, type ReactNode, useMemo } from "react";

/**
 * Prose's rhythm, from the theme's `--prose-*` tokens: a paragraph's room under it, a list's, and a
 * list item's, but the last's of what holds it. A document's blocks (`Blocks.tsx`,
 * `BlockList.tsx`) and every markdown text's paragraphs (`ProseParagraph`) take it; the theme's
 * `markdown` rule gives Astryx's markdown lists the same, so a bullet looks alike everywhere.
 */
export const proseRhythm = stylex.create({
  item: { marginBlockEnd: { ":last-child": 0, default: "var(--prose-item-gap)" } },
  list: { marginBlockEnd: { ":last-child": 0, default: "var(--prose-paragraph-gap)" } },
  paragraph: {
    marginBlockEnd: { ":last-child": 0, default: "var(--prose-paragraph-gap)" },
    marginBlockStart: 0,
  },
});

/** A markdown paragraph in prose's rhythm: what `ProseMarkdown` draws a paragraph as. */
export function ProseParagraph({ children }: { children: ReactNode }) {
  return (
    <div role="paragraph" {...stylex.props(proseRhythm.paragraph)}>
      {children}
    </div>
  );
}

/**
 * The reading measure, about 80 characters of prose a line, for a layout that sizes itself by it, as
 * the decisions page's columns and a session's reply do: read from here, never written in a view.
 */
export const READING_MEASURE = "var(--size-reading-measure)";

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
  // Astryx's markdown sets its text in the body font, at the body's size and line, its list items
  // too: its text takes the reading font, and the body's size and line are the reading ones inside.
  markdown: {
    fontFamily: "var(--font-family-reading)",
    [typeScaleVars["--text-body-leading"]]: "var(--text-reading-line)",
    [typeScaleVars["--text-body-size"]]: "var(--text-reading-size)",
  },
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
/** The markdown's parts as prose draws them, when the caller gives none of its own. */
const PROSE_COMPONENTS = { paragraph: ProseParagraph };

export function ProseMarkdown({
  children,
  components,
  plugins,
}: {
  children: string;
  components?: ComponentProps<typeof Markdown>["components"];
  plugins?: ReadonlyArray<ProsePlugin>;
}): ReactNode {
  // One object while `components` stays: Astryx's markdown keeps its blocks while it does.
  const drawn = useMemo(
    () => (components ? { paragraph: ProseParagraph, ...components } : PROSE_COMPONENTS),
    [components],
  );
  return (
    <div {...stylex.props(proseStyles.reading)}>
      <Markdown
        autolink="gfm"
        components={drawn}
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
