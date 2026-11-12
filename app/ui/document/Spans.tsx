// The spans of a block's text: runs of one paragraph, each a span of the `Text` around it, with
// its marks, its link, or its image. A link reads pressable, in the link's colour and underlined;
// a link that stays in the app goes to the screen's `onLink`, a web address to the system.
import { Image, openUrl, signal, Text, type TextStyle } from "nsh";
import type { Span, SpanImage } from "../../store/protocol";
import { Icon, type IconName } from "../controls/Icon";
import { tokens } from "../tokens";
import { DocumentContext } from "./context";
import { prose } from "./look";

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

/**
 * The workflow's marks, as icons of the app's own family: the bundled fonts hold no emoji, and
 * a spec's constitution check, `✅`, drew as boxes of a missing glyph.
 */
const MARK_ICONS: Record<string, { colour: () => string; name: IconName }> = {
  "✅": { colour: () => tokens.role.added, name: "circle-check" },
  "✔": { colour: () => tokens.role.added, name: "check" },
  "❌": { colour: () => tokens.role.removed, name: "circle-x" },
  "⚠": { colour: () => tokens.role.caution, name: "triangle-alert" },
};
const MARKS = /(✅|✔️?|❌|⚠️?)/u;

/** A mark among words: its icon, the size of a letter, on the line. */
function MarkIcon(props: { mark: string }) {
  const icon = MARK_ICONS[props.mark.replace("\uFE0F", "")]!;
  return (
    <Icon
      colour={icon.colour()}
      name={icon.name}
      size={tokens.control.icon}
      style={{ verticalAlign: "middle" }}
    />
  );
}

/** Plain words, with the workflow's marks drawn as icons. */
function Words(props: { span: Span }) {
  const parts = props.span.text.split(MARKS);
  if (parts.length === 1) return <Text style={marked(props.span)}>{props.span.text}</Text>;
  return (
    <Text style={marked(props.span)}>
      {parts.map((part, at) =>
        at % 2 === 1 ? <MarkIcon mark={part} /> : part === "" ? null : part,
      )}
    </Text>
  );
}

/** One span, drawn as its kind. */
export function SpanView(props: { span: Span }) {
  const span = props.span;
  if (span.image !== null) return <SpanPicture image={span.image} span={span} />;
  if (span.link !== null) return <Linked span={span} text={span.text} />;
  return <Words span={span} />;
}

/** The spans of a block, as the runs of the `Text` that holds them. */
export function Spans(props: { spans: ReadonlyArray<Span> }) {
  return props.spans.map((span) => <SpanView span={span} />);
}

/**
 * Spans read as prose outside a document: an option's sentence, its pros and cons, a question's
 * "Why it matters". `bold` for a title; `colour` for what reads second.
 */
export function Phrase(props: { bold?: boolean; colour?: string; spans: ReadonlyArray<Span> }) {
  return (
    <Text style={[prose(props.colour), props.bold === true ? { fontWeight: "700" } : {}]}>
      <Spans spans={props.spans} />
    </Text>
  );
}
