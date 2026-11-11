// The spans of a block's text: runs of one paragraph, each a span of the `Text` around it, with
// its marks, its link, or its image. A link reads pressable, in the link's colour and underlined;
// a link that stays in the app goes to the screen's `onLink`, a web address to the system.
import { Image, openUrl, signal, Text, type TextStyle } from "nsh";
import type { Span, SpanImage } from "../../store/protocol";
import { tokens } from "../tokens";
import { DocumentContext } from "./context";

/** A target the system opens: a web address, or another scheme's. */
const outside = (target: string) => /^[a-z][a-z0-9+.-]*:/i.test(target);

/** A span's marks as a style: bold, italic, struck, or code. */
function marked(span: Span): TextStyle {
  return {
    ...(span.strong ? { fontWeight: "700" } : {}),
    ...(span.emphasis ? { fontStyle: "italic" } : {}),
    ...(span.strike ? { textDecorationLine: "line-through" } : {}),
    ...(span.code
      ? {
          backgroundColor: tokens.control.tint(tokens.role.codeInline),
          color: tokens.role.codeInline,
          fontFamily: tokens.type.code,
          // A step under the prose: the code font is wider, and keeps the line's height.
          fontSize: tokens.type.size,
        }
      : {}),
  };
}

/** An image among words, on the line: as high as a line of text, as wide as its shape. */
function InlineImage(props: { alt: string; src: string }) {
  const ratio = signal(1);
  return (
    <Image
      accessibilityLabel={props.alt}
      onLoad={(event) => ratio.set(event.size.width / Math.max(1, event.size.height))}
      src={props.src}
      style={{
        height: tokens.type.line,
        verticalAlign: "middle",
        width: tokens.type.line * ratio(),
      }}
    />
  );
}

/** Whether a link names a place the app shows, rather than one the system opens. */
function stays(span: Span): boolean {
  const link = span.link!;
  return link.path !== null || link.story !== null || link.target.startsWith("#") || link.wiki;
}

/** A link's words: pressable where it leads somewhere. */
export function Linked(props: { span: Span; text: string }) {
  const hands = DocumentContext();
  const link = props.span.link!;
  // A wikilink to no file is its words: there is nowhere to go.
  const goes = !(link.wiki && link.path === null);
  const press = () => {
    if (stays(props.span)) hands.onLink?.(link);
    else if (outside(link.target)) void openUrl(link.target);
  };
  return (
    <Text
      role={goes ? "link" : undefined}
      onPress={goes ? press : undefined}
      style={[
        marked(props.span),
        goes ? { color: tokens.role.link, textDecorationLine: "underline" } : {},
      ]}
    >
      {props.text}
    </Text>
  );
}

function SpanPicture(props: { image: SpanImage; span: Span }) {
  const hands = DocumentContext();
  const src = hands.image?.(props.image);
  if (src !== undefined) {
    return <InlineImage alt={props.span.text} src={src} />;
  }
  // An image the app does not load is a link to it, its alt text the words.
  const span: Span = {
    ...props.span,
    image: null,
    link: props.span.link ?? {
      anchor: null,
      path: props.image.path,
      story: null,
      target: props.image.target,
      wiki: false,
    },
  };
  return <Linked span={span} text={props.span.text || props.image.target} />;
}

/** One span, drawn as its kind. */
export function SpanView(props: { span: Span }) {
  const span = props.span;
  if (span.image !== null) return <SpanPicture image={span.image} span={span} />;
  if (span.link !== null) return <Linked span={span} text={span.text} />;
  return <Text style={marked(span)}>{span.text}</Text>;
}

/** The spans of a block, as the runs of the `Text` that holds them. */
export function Spans(props: { spans: ReadonlyArray<Span> }) {
  return props.spans.map((span) => <SpanView span={span} />);
}
