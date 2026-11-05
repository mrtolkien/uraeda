import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useMemo } from "react";
import type { ChatImage } from "uraeda-server/fate";
import { ImageView } from "./ImageView.tsx";
import { useRepository } from "./routes.tsx";
import { fontRuns } from "./fields/editor/markdown.ts";
import { chatImageSrc } from "./sessions.ts";

const styles = stylex.create({
  // Markdown's code and headings, in the fonts the editor wrote them in
  // (`fields/editor/markdown.ts`), at a line height that leaves the message's lines as tall.
  code: { fontFamily: "var(--font-family-code)", lineHeight: "100%" },
  heading: { fontFamily: "var(--font-family-heading)", lineHeight: "100%" },
  images: {
    // A message's images, above its text, side by side while they fit.
    display: "flex",
    flexWrap: "wrap",
    gap: spacingVars["--spacing-2"],
  },
  imagesAbove: {
    // Images before text keep the bubble's spacing between them.
    marginBlockEnd: spacingVars["--spacing-2"],
  },
  message: {
    // A message keeps its line breaks, and a long path wraps instead of running off screen.
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },
  opening: {
    // The chat's opening line, muted above the human's text.
    color: colorVars["--color-text-secondary"],
    display: "block",
    marginBlockEnd: spacingVars["--spacing-2"],
    whiteSpace: "pre-wrap",
  },
  pending: {
    // A message the agent has not read yet.
    color: colorVars["--color-text-secondary"],
  },
  pendingImages: {
    // The images of a message the agent has not read yet, dimmed as its text is.
    opacity: 0.6,
  },
});

/** A message's text, its code and headings in their fonts, as the editor drew it. */
function MessageText({ text }: { text: string }) {
  const runs = useMemo(() => fontRuns(text), [text]);
  return runs.map(({ font, text: part }, index) =>
    font ? (
      // The runs never move: their place is their key.
      <span data-font={font} key={index} {...stylex.props(styles[font])}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * A chat message's images, each a preview that opens full screen, told apart by their place: one
 * alone is "Image".
 */
function MessageImages({ images }: { images: ReadonlyArray<ChatImage> }) {
  const repo = useRepository();
  return images.map((image, index, all) => (
    <ImageView
      alt=""
      height={image.height}
      key={image.id}
      label={all.length > 1 ? `Image ${index + 1} of ${all.length}` : "Image"}
      size="message"
      src={chatImageSrc(repo, image)}
      width={image.width}
    />
  ));
}

/**
 * What a message sent to the agent says, in its bubble: its opening line, muted, its images, then
 * its text; greyed and dimmed until the agent reads it.
 */
export function MessageBody({
  item,
  pending,
}: {
  item: { images?: ReadonlyArray<ChatImage>; opening?: string; text: string };
  pending: boolean;
}) {
  const images = item.images ?? [];
  return (
    <>
      {item.opening && <span {...stylex.props(styles.opening)}>{item.opening}</span>}
      {images.length > 0 && (
        <div
          {...stylex.props(
            styles.images,
            item.text !== "" && styles.imagesAbove,
            pending && styles.pendingImages,
          )}
        >
          <MessageImages images={images} />
        </div>
      )}
      {item.text !== "" && (
        <span {...stylex.props(styles.message, pending && styles.pending)}>
          <MessageText text={item.text} />
        </span>
      )}
    </>
  );
}
