import { useLightbox } from "@astryxdesign/core/Lightbox";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type MouseEvent, useState } from "react";
import { useBackCloses } from "./layout/useBackCloses.ts";

const styles = stylex.create({
  // The link holds the image alone, on a line of its own.
  link: {
    display: "block",
    inlineSize: "fit-content",
    maxInlineSize: "100%",
  },
  // At most the column's width, framed so a white screenshot keeps its edge on a white page.
  image: {
    display: "block",
    maxInlineSize: "100%",
    blockSize: "auto",
    borderWidth: borderVars["--border-width"],
    borderStyle: "solid",
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-element"],
    cursor: "zoom-in",
  },
  missing: {
    display: "block",
    inlineSize: "fit-content",
    maxInlineSize: "100%",
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
    borderWidth: borderVars["--border-width"],
    borderStyle: "dashed",
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-element"],
    color: colorVars["--color-text-secondary"],
  },
});

/**
 * An image of a document or a chat message, at most the column's width, with its alt text. A
 * click opens it full screen in a lightbox, which Back closes; an image that fails to load shows
 * "Image missing" in its place.
 */
export function ImageView({ src, alt }: { src: string; alt: string }) {
  const [missing, setMissing] = useState(false);
  const lightbox = useLightbox({ media: { src, alt } });
  useBackCloses(`Image ${src}`, lightbox.isOpen, lightbox.close);

  if (missing) {
    return (
      <span {...stylex.props(styles.missing)}>
        <Text type="supporting" color="inherit">
          Image missing
        </Text>
      </span>
    );
  }
  const onClick = (event: MouseEvent) => {
    // A new tab or window still opens the image's own address.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    lightbox.open();
  };
  return (
    <>
      <Link href={src} onClick={onClick} aria-haspopup="dialog" xstyle={styles.link}>
        <img src={src} alt={alt} onError={() => setMissing(true)} {...stylex.props(styles.image)} />
      </Link>
      {lightbox.element}
    </>
  );
}
