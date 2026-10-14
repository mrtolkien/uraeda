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
import { createContext, type MouseEvent, type ReactNode, useContext, useState } from "react";
import { useBackCloses } from "./layout/useBackCloses.ts";

const styles = stylex.create({
  // The link holds the image alone, on a line of its own.
  link: {
    display: "block",
    inlineSize: "fit-content",
    maxInlineSize: "100%",
  },
  // At most the column's width and most of the window's height, framed so a white screenshot
  // keeps its edge on a white page.
  image: {
    display: "block",
    maxInlineSize: "100%",
    maxBlockSize: "var(--size-image-max-height)",
    blockSize: "auto",
    inlineSize: "auto",
    objectFit: "contain",
    borderWidth: borderVars["--border-width"],
    borderStyle: "solid",
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-element"],
  },
  // In a chat message: a preview, which opens full size.
  message: {
    maxBlockSize: "var(--size-message-image)",
  },
  zoom: {
    cursor: "zoom-in",
  },
  // Inside a line of text, like a link's: the image keeps to the text's flow.
  inline: {
    display: "inline-block",
    verticalAlign: "middle",
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

/** Whether the images drawn here sit inside a control, like an option's toggle. */
const Static = createContext(false);

/**
 * Draws the images of its content without their link and lightbox: inside a control, like a
 * button, a link is invalid and a click belongs to the control.
 */
export function StaticImages({ children }: { children: ReactNode }) {
  return <Static.Provider value>{children}</Static.Provider>;
}

/** Whether images drawn here are static, inside a control or a link. */
export function useStaticImages() {
  return useContext(Static);
}

/** "Image missing", with the alt text when there is one, in the image's place. */
function Missing({ alt }: { alt: string }) {
  return (
    <span {...stylex.props(styles.missing)}>
      <Text type="supporting" color="inherit">
        {alt ? `Image missing: ${alt}` : "Image missing"}
      </Text>
    </span>
  );
}

/**
 * An image of a document or a chat message, at most the column's width, with its alt text. A
 * click opens it full screen in a lightbox, which Back closes; an image that fails to load shows
 * "Image missing" in its place. `isStatic`, or a `StaticImages` around it, draws the image alone,
 * as inside a link or a control. `size="message"` draws a chat message's image as a preview.
 */
export function ImageView({
  src,
  alt,
  isStatic = false,
  size = "column",
}: {
  src: string;
  alt: string;
  isStatic?: boolean;
  size?: "column" | "message";
}) {
  // The address that failed: an image whose address changes, as in a preview while its link is
  // typed, loads again.
  const [failed, setFailed] = useState<string>();
  const inControl = useStaticImages();
  const lightbox = useLightbox({
    media: { src, alt },
    // The lightbox is drawn where the image is: in a review's block, a click in it would select
    // the block. Its keys are left to bubble: Astryx closes it on an Escape the document hears.
    onClick: (event: MouseEvent) => event.stopPropagation(),
  });
  useBackCloses(`Image ${src}`, lightbox.isOpen, lightbox.close);

  if (failed === src) {
    return <Missing alt={alt} />;
  }
  const image = (zoom: boolean, inline: boolean) => (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(src)}
      {...stylex.props(
        styles.image,
        size === "message" && styles.message,
        zoom && styles.zoom,
        inline && styles.inline,
      )}
    />
  );
  if (isStatic || inControl) {
    return image(false, isStatic);
  }
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window still opens the image's own address.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    // Safari does not focus a clicked link: the lightbox gives the focus back to what had it.
    event.currentTarget.focus();
    lightbox.open();
  };
  return (
    <>
      <Link
        href={src}
        onClick={onClick}
        aria-haspopup="dialog"
        // An image without alt text is not named by it.
        {...(alt ? {} : { "aria-label": "Image" })}
        xstyle={styles.link}
      >
        {image(true, false)}
      </Link>
      {lightbox.element}
    </>
  );
}
