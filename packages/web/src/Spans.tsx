import { Code } from "@astryxdesign/core/Code";
import { Link } from "@astryxdesign/core/Link";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useContext } from "react";
import type { Span } from "uraeda-binding";
import { MAIN_CHECKOUT } from "./data.ts";
import { ImageView } from "./ImageView.tsx";
import { inMockups, pathLink } from "./links.tsx";
import { repoPath, useRepository } from "./routes.tsx";
import { StoryContext, storyHref } from "./stories.tsx";

const styles = stylex.create({
  alone: {
    // A link alone on its line, set apart from text: a control's height, for a finger.
    alignItems: "center",
    display: "inline-flex",
    minHeight: sizeVars["--size-element-md"],
  },
  // Inline code, in a font of other heights than the text's: its line height, the text's, would
  // make its line taller than the others, so it takes its own size's, and its line keeps the text's.
  code: { lineHeight: "100%" },
});

function Marked({ span }: { span: Span }) {
  let node: React.ReactNode = span.text;
  if (span.code) {
    node = (
      <Code size="inherit" xstyle={styles.code}>
        {node}
      </Code>
    );
  }
  if (span.strike) {
    node = <s>{node}</s>;
  }
  if (span.emphasis) {
    node = <em>{node}</em>;
  }
  if (span.strong) {
    node = <strong>{node}</strong>;
  }
  return node;
}

/**
 * A link of the document: a workflow file or a proposal file in the UI, a story in its checkout's
 * Storybook page when the checkout has a preview decision, other files and the web in a new tab. It
 * shows its text, or `children`, like an image it holds; `isAlone` when alone on its line.
 */
function SpanLink({
  children,
  isAlone = false,
  span,
}: {
  children?: ReactNode;
  isAlone?: boolean;
  span: Span;
}) {
  const xstyle = isAlone ? styles.alone : undefined;
  const link = span.link!;
  const repo = useRepository();
  const stories = useContext(StoryContext);
  const text = children ?? <Marked span={span} />;
  if (link.story && stories?.preview) {
    return (
      <Link
        hasUnderline
        href={repoPath(repo, storyHref(stories.folder, link.story))}
        type="inherit"
        xstyle={xstyle}
      >
        {text}
      </Link>
    );
  }
  if (link.path) {
    // From an item's file, a decision opens as the item's branch has it; not from a proposal file.
    const from =
      stories && stories.folder !== MAIN_CHECKOUT ? { folder: stories.folder } : undefined;
    const { href, inApp } = pathLink(link.path, repo, link.anchor, from);
    return inApp ? (
      <Link hasUnderline href={href} type="inherit" xstyle={xstyle}>
        {text}
      </Link>
    ) : (
      <Link
        hasUnderline
        href={href}
        rel="noreferrer"
        target="_blank"
        type="inherit"
        xstyle={xstyle}
      >
        {text}
      </Link>
    );
  }
  if (link.target.startsWith("#")) {
    return (
      <Link hasUnderline href={link.target} type="inherit" xstyle={xstyle}>
        {text}
      </Link>
    );
  }
  if (link.wiki) {
    return text;
  }
  return (
    <Link
      hasUnderline
      href={link.target}
      rel="noreferrer"
      target="_blank"
      type="inherit"
      xstyle={xstyle}
    >
      {text}
    </Link>
  );
}

/**
 * The path, within its repository, an image of the document is drawn from: a file under `specs/`,
 * from `/images/`, else none.
 */
function imageSource(span: Span): string | undefined {
  return imagePath(span.image?.path);
}

/** The path, within its repository, an image under `specs/` is drawn from, else none. */
export function imagePath(path: string | undefined): string | undefined {
  return path?.startsWith("specs/")
    ? `/images/${path.split("/").map(encodeURIComponent).join("/")}`
    : undefined;
}

/** Whether a span draws an image that opens in a lightbox, a dialog drawn beside it. */
function opensImage(span: Span): boolean {
  return imageSource(span) !== undefined && !span.link;
}

/** The files a link alone in its paragraph draws as an image, by their extension. */
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg)$/i;

/**
 * The path, within its repository, the image a link alone in its paragraph names is drawn from: an
 * image file in a `mockups` folder under `specs/`, like a discovery's prototype, as an HTML page
 * there is drawn live; else none.
 */
export function prototypePath(path: string | undefined): string | undefined {
  return path && inMockups(path) && IMAGE_FILE.test(path) ? imagePath(path) : undefined;
}

/**
 * The spans of the one link a block holds, whitespace around it aside, as the core's embeds read
 * it: a link whose text has several marks is several spans. None when the block holds anything else.
 */
function linkAlone(spans: ReadonlyArray<Span>): Array<Span> | undefined {
  const links = spans.filter((span) => span.link);
  const target = links[0]?.link?.target;
  const alone =
    target !== undefined &&
    spans.every((span) =>
      span.link ? span.link.target === target && !span.image : span.text.trim() === "",
    );
  return alone ? links : undefined;
}

/** Whether a block's spans are a link alone to a prototype's image, which draws in its place. */
function drawsPrototype(spans: ReadonlyArray<Span>): boolean {
  return prototypePath(linkAlone(spans)?.[0]?.link?.path) !== undefined;
}

/** Whether a paragraph's spans draw an image that opens in a lightbox: its own, or a prototype's. */
export function holdsImage(spans: ReadonlyArray<Span>): boolean {
  return spans.some(opensImage) || drawsPrototype(spans);
}

/** A link alone in its paragraph to a prototype's image: the image, its text as its alt text. */
function SpanPrototype({ spans }: { spans: ReadonlyArray<Span> }) {
  const repo = useRepository();
  const link = linkAlone(spans)!;
  return <ImageView alt={plain(link)} src={repoPath(repo, prototypePath(link[0]!.link!.path)!)} />;
}

/**
 * An image of the document: a file under `specs/` draws in place, from the repository's
 * `/r/<name>/images/`; any other file, or the web, is a link to it with the alt text, never loaded
 * in the page. An image inside a link, like a badge, is drawn in that link, which keeps its own
 * target: the image alone, or its alt text.
 */
function SpanImage({ span }: { span: Span }) {
  const image = span.image!;
  const repo = useRepository();
  const path = imageSource(span);
  const src = path === undefined ? undefined : repoPath(repo, path);
  if (span.link) {
    return (
      <SpanLink span={span}>
        {src ? <ImageView alt={span.text} isStatic src={src} /> : <Marked span={span} />}
      </SpanLink>
    );
  }
  if (src) {
    return <ImageView alt={span.text} src={src} />;
  }
  return <SpanLink span={{ ...span, image: undefined, link: { ...image, wiki: false } }} />;
}

/**
 * The spans of a block's text, with their marks, links, and images; `isAlone` for a block whose
 * one link is all its text, a control's height, or the image it names, a prototype's.
 */
export function Spans({
  isAlone = false,
  spans,
}: {
  isAlone?: boolean;
  spans: ReadonlyArray<Span>;
}) {
  if (isAlone && drawsPrototype(spans)) {
    return <SpanPrototype spans={spans} />;
  }
  return spans.map((span, index) =>
    span.image ? (
      <SpanImage key={index} span={span} />
    ) : span.link ? (
      <SpanLink isAlone={isAlone && spans.length === 1} key={index} span={span} />
    ) : (
      <Marked key={index} span={span} />
    ),
  );
}

export function plain(spans: ReadonlyArray<Span>): string {
  return spans.map((span) => span.text).join("");
}
