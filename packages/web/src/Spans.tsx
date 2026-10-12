import type { Span } from "uraeda-binding";
import { Link, pathLink } from "./routes.tsx";

function Marked({ span }: { span: Span }) {
  let node: React.ReactNode = span.text;
  if (span.code) {
    node = <code>{node}</code>;
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
  const text = <Marked span={span} />;
  if (link.path) {
    const { href, inApp } = pathLink(link.path);
    return inApp ? (
      <Link to={href}>{text}</Link>
    ) : (
      <a href={href} target="_blank" rel="noreferrer">
        {text}
      </a>
    );
  }
  if (link.target.startsWith("#")) {
    return <a href={link.target}>{text}</a>;
  }
  if (link.wiki) {
    return text;
  }
  return (
    <a href={link.target} target="_blank" rel="noreferrer">
      {text}
    </a>
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
