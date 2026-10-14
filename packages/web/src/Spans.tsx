import { Code } from "@astryxdesign/core/Code";
import { Link } from "@astryxdesign/core/Link";
import type { Span } from "uraeda-binding";
import { pathLink, useRepository } from "./routes.tsx";

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

/** A link of the document: a workflow file or a draft in the UI, other files and the web in a new tab. */
function SpanLink({ span }: { span: Span }) {
  const link = span.link!;
  const repo = useRepository();
  const text = <Marked span={span} />;
  if (link.path) {
    const { href, inApp } = pathLink(link.path, repo);
    return inApp ? (
      <Link type="inherit" hasUnderline href={href}>
        {text}
      </Link>
    ) : (
      <Link type="inherit" hasUnderline href={href} target="_blank" rel="noreferrer">
        {text}
      </Link>
    );
  }
  if (link.target.startsWith("#")) {
    return (
      <Link type="inherit" hasUnderline href={link.target}>
        {text}
      </Link>
    );
  }
  if (link.wiki) {
    return text;
  }
  return (
    <Link type="inherit" hasUnderline href={link.target} target="_blank" rel="noreferrer">
      {text}
    </Link>
  );
}

/** The spans of a block's text, with their marks and links. */
export function Spans({ spans }: { spans: ReadonlyArray<Span> }) {
  return spans.map((span, index) =>
    span.link ? <SpanLink key={index} span={span} /> : <Marked key={index} span={span} />,
  );
}

export function plain(spans: ReadonlyArray<Span>): string {
  return spans.map((span) => span.text).join("");
}
