// A `mermaid` code block drawn as a diagram (`specs/decisions/diagrams.md`): `pele` is imported only
// when a page holds one, into chunks of their own, and returns an SVG with no script, which the
// page shows with its own colours and fonts, since a diagram's text comes from files an agent
// writes.
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type MouseEvent, useId, useRef } from "react";
import { useWidthOf } from "./layout/useWidthOf.ts";
import { useDiagramDraw } from "./useDiagramDraw.ts";

const styles = stylex.create({
  block: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  failed: {
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: 0,
  },
  scroller: {
    // A diagram wider than its card scrolls sideways inside it.
    maxWidth: "100%",
    overflowX: "auto",
  },
  // The diagram's size, as wide as it draws, and never more than the card's room when it fits;
  // narrower than its room, in its middle, as a figure, rather than at its left edge.
  sized: (width: string) => ({ marginInline: "auto", width }),
  // Pele's colours and fonts, from the theme's own, so a diagram follows the colour mode.
  theme: {
    "--pele-accent": colorVars["--color-accent"],
    "--pele-bg": colorVars["--color-background-surface"],
    "--pele-border": colorVars["--color-border-emphasized"],
    "--pele-fg": colorVars["--color-text-primary"],
    "--pele-font": typographyVars["--font-family-body"],
    "--pele-font-mono": typographyVars["--font-family-code"],
    "--pele-line": colorVars["--color-text-secondary"],
    "--pele-muted": colorVars["--color-text-secondary"],
    "--pele-surface": colorVars["--color-background-muted"],
    "--pele-surface-alt": colorVars["--color-background-card"],
  },
});

/**
 * Opens a click on a diagram's link in a new tab: the diagram is part of the page, so the browser
 * would replace the app, and the reader's place and unsaved work, with the link.
 */
function openLinkInNewTab(event: MouseEvent<HTMLElement>) {
  const link = (event.target as Element).closest("a");
  const href = link?.getAttribute("href");
  if (href) {
    event.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
  }
}

/** What a diagram is called: its type, and its place among the document's diagrams. */
function titleOf(kind: string, place: Place | undefined): string {
  const name = `${kind[0]?.toUpperCase() ?? ""}${kind.slice(1)} diagram`;
  return place && place.total > 1 ? `${name}, ${place.index} of ${place.total}` : name;
}

/** A diagram's place among the diagrams of its document, counted from 1. */
export type Place = { index: number; total: number };

/**
 * A Mermaid diagram, drawn in the page. Wider than its card, it is drawn again to fit, as Pele's own
 * `mount` does, and scrolls sideways inside the card for what still does not fit. It says "Drawing
 * the diagram…" until drawn. A source that does not parse, or a `pele` that does not
 * load, shows the source as code under "This diagram could not be drawn."
 */
export function Diagram({ place, source }: { place?: Place; source: string }) {
  // Letters, digits, and dashes, unique on the page: Pele names the diagram's title and
  // description by it.
  const idPrefix = `pele-${useId().replaceAll(/[^\w-]/g, "")}`;
  // The same element for the diagram's life, drawn or not, so its width is followed throughout.
  const scroller = useRef<HTMLDivElement>(null);
  const room = Math.floor(useWidthOf(scroller));
  const { drawn, scrolls, width } = useDiagramDraw(source, idPrefix, scroller, room);
  const drawnNow = typeof drawn === "object" ? drawn : undefined;
  const title = drawnNow ? titleOf(drawnNow.kind, place) : undefined;
  // Wider than its card, it scrolls: the keyboard reaches it, as a region named for what it holds.
  return (
    <div
      ref={scroller}
      {...(scrolls
        ? { "aria-label": `${title}, scrolls sideways`, role: "region", tabIndex: 0 }
        : {})}
      {...stylex.props(styles.block, styles.scroller, styles.theme)}
    >
      {drawn === "failed" && (
        <>
          <Text as="p" display="block" type="inherit" xstyle={styles.failed}>
            This diagram could not be drawn.
          </Text>
          <CodeBlock code={source} language="mermaid" width="100%" />
        </>
      )}
      {drawn === undefined && (
        <Text as="p" display="block" role="status" type="inherit" xstyle={styles.failed}>
          Drawing the diagram…
        </Text>
      )}
      {drawnNow && (
        <div
          aria-label={scrolls ? undefined : title}
          dangerouslySetInnerHTML={{ __html: drawnNow.svg }}
          onClick={openLinkInNewTab}
          role={scrolls ? undefined : "group"}
          {...stylex.props(styles.sized(`${width}px`))}
        />
      )}
    </div>
  );
}
