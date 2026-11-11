// An image that is a paragraph of its own: an image alone, or a link alone to a prototype's
// picture in a `mockups` folder, drawn in place at the width it has, up to its own.
import { Image, signal, Text } from "nsh";
import type { Span, SpanImage } from "../../store/protocol";
import { Linked } from "./Spans";
import { DocumentContext } from "./context";
import { prose } from "./look";

/** The files a link alone in its paragraph draws as a picture, by their extension. */
const PICTURE = /\.(png|jpe?g|gif|webp|svg)$/i;

/** Whether `path` is in a `mockups` folder under `specs/`, where prototypes keep their pictures. */
const inMockups = (path: string) =>
  path.startsWith("specs/") && path.split("/").includes("mockups");

/**
 * The image a paragraph is alone made of: an image, or a link alone to a prototype's picture,
 * its words around it only spaces. None for a paragraph that holds anything else.
 */
export function pictureAlone(
  spans: ReadonlyArray<Span>,
): { alt: string; image: SpanImage } | undefined {
  const shown = spans.filter((span) => span.text.trim() !== "" || span.image !== null);
  const first = shown[0];
  if (first === undefined) return undefined;
  if (shown.length === 1 && first.image !== null && first.link === null) {
    return { alt: first.text, image: first.image };
  }
  const target = first.link?.target;
  const path = first.link?.path ?? null;
  const alone = shown.every((span) => span.link?.target === target && span.image === null);
  if (!alone || path === null || !inMockups(path) || !PICTURE.test(path)) return undefined;
  return {
    alt: shown.map((span) => span.text).join(""),
    image: { path, target: target! },
  };
}

/** An image as a block: as wide as the document, up to its own width, at its own shape. */
export function Pictured(props: { alt: string; image: SpanImage }) {
  const hands = DocumentContext();
  const size = signal({ height: 9, width: 16 });
  // As wide as the document's room, up to its own width, at its own shape.
  const width = () =>
    Math.min(size().width, Math.max(0, hands.width() - hands.inset()) || size().width);
  const src = hands.image?.(props.image);
  if (src === undefined) {
    const span: Span = {
      code: false,
      emphasis: false,
      image: null,
      link: {
        anchor: null,
        path: props.image.path,
        story: null,
        target: props.image.target,
        wiki: false,
      },
      strike: false,
      strong: false,
      text: props.alt || props.image.target,
    };
    return (
      <Text style={prose()}>
        <Linked span={span} text={span.text} />
      </Text>
    );
  }
  return (
    <Image
      accessibilityLabel={props.alt}
      onLoad={(event) => size.set(event.size)}
      src={src}
      style={{ height: (width() * size().height) / Math.max(1, size().width), width: width() }}
    />
  );
}
