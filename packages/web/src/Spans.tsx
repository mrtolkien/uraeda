import { Code } from "@astryxdesign/core/Code";
import { Link } from "@astryxdesign/core/Link";
import { type ReactNode, useContext } from "react";
import type { Span } from "uraeda-binding";
import { MAIN_CHECKOUT } from "./data.ts";
import { ImageView } from "./ImageView.tsx";
import { pathLink } from "./links.tsx";
import { repoPath, useRepository } from "./routes.tsx";
import { StoryContext, storybookHref } from "./stories.tsx";

function Marked({ span }: { span: Span }) {
  let node: React.ReactNode = span.text;
  if (span.code) {
    node = <Code size="inherit">{node}</Code>;
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
 * A link of the document: a workflow file or a draft in the UI, a story in its checkout's Storybook
 * page when the checkout has a preview decision, other files and the web in a new tab. It shows its
 * text, or `children`, like an image it holds.
 */
function SpanLink({ children, span }: { children?: ReactNode; span: Span }) {
  const link = span.link!;
  const repo = useRepository();
  const stories = useContext(StoryContext);
  const text = children ?? <Marked span={span} />;
  if (link.story && stories?.preview) {
    return (
      <Link
        hasUnderline
        href={repoPath(repo, storybookHref(stories.folder, link.story))}
        type="inherit"
      >
        {text}
      </Link>
    );
  }
  if (link.path) {
    // From an item's file, a decision opens as the item's branch has it; not from a draft.
    const from =
      stories && stories.folder !== MAIN_CHECKOUT ? { folder: stories.folder } : undefined;
    const { href, inApp } = pathLink(link.path, repo, link.anchor, from);
    return inApp ? (
      <Link hasUnderline href={href} type="inherit">
        {text}
      </Link>
    ) : (
      <Link hasUnderline href={href} rel="noreferrer" target="_blank" type="inherit">
        {text}
      </Link>
    );
  }
  if (link.target.startsWith("#")) {
    return (
      <Link hasUnderline href={link.target} type="inherit">
        {text}
      </Link>
    );
  }
  if (link.wiki) {
    return text;
  }
  return (
    <Link hasUnderline href={link.target} rel="noreferrer" target="_blank" type="inherit">
      {text}
    </Link>
  );
}

/**
 * The path, within its repository, an image of the document is drawn from: a file under `specs/`,
 * from `/images/`, else none.
 */
function imageSource(span: Span): string | undefined {
  const path = span.image?.path;
  return path?.startsWith("specs/")
    ? `/images/${path.split("/").map(encodeURIComponent).join("/")}`
    : undefined;
}

/** Whether a span draws an image that opens in a lightbox, a dialog drawn beside it. */
export function opensImage(span: Span): boolean {
  return imageSource(span) !== undefined && !span.link;
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

/** The spans of a block's text, with their marks, links, and images. */
export function Spans({ spans }: { spans: ReadonlyArray<Span> }) {
  return spans.map((span, index) =>
    span.image ? (
      <SpanImage key={index} span={span} />
    ) : span.link ? (
      <SpanLink key={index} span={span} />
    ) : (
      <Marked key={index} span={span} />
    ),
  );
}

export function plain(spans: ReadonlyArray<Span>): string {
  return spans.map((span) => span.text).join("");
}
