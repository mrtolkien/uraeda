// A `mermaid` code block drawn as a diagram (`specs/decisions/diagrams.md`): `pele` is imported only
// when a page holds one, into chunks of their own, and returns an SVG with no script, which the
// page shows with its own colours and fonts, since a diagram's text comes from files an agent
// writes.
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type MouseEvent, useEffect, useId, useRef, useState } from "react";
import { useWidthOf } from "./layout/useWidthOf.ts";

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

/** The largest a diagram shows, in px: a bigger one is scaled down, keeping its proportions. */
const MAX_WIDTH = 4000;
const MAX_HEIGHT = 3000;
/**
 * How much wider than its room a diagram may be and still be scaled down to fit it, its text a few
 * percent smaller, rather than scroll for a sliver of itself: Pele's fitted layout often ends a few
 * px past its room.
 */
const NEAR_FIT = 1.1;

/** A diagram drawn: Pele's SVG, its size in pixels, and its type, "flowchart" or "git graph". */
type Drawn = { height: number; kind: string; svg: string; width: number };

/** The fonts a diagram is drawn in: the theme's, as `styles.theme` sets them on `element`. */
type Fonts = { family: string; mono: string };

/** The fonts `element` draws a diagram in, from its `--pele-font` and `--pele-font-mono`. */
function fontsOf(element: Element): Fonts {
  const style = getComputedStyle(element);
  return {
    family: style.getPropertyValue("--pele-font").trim(),
    mono: style.getPropertyValue("--pele-font-mono").trim(),
  };
}

/**
 * Loads `fonts`, so Pele measures their own glyphs rather than a fallback's; a font that does not
 * load leaves the fallback, which the page draws too.
 */
async function loaded({ family, mono }: Fonts) {
  const faces = typeof document === "undefined" ? undefined : document.fonts;
  if (!faces) {
    return;
  }
  await Promise.all(
    [family, mono].filter(Boolean).map((font) => faces.load(`1em ${font}`).catch(() => [])),
  );
}

/**
 * Draws `source` with Pele, imported on demand, its ids starting with `idPrefix`, its labels
 * measured in `fonts`, the ones the page draws them in: with Pele's own metrics, a label in the
 * theme's wider monospace font ran into the next one and past the diagram's edge. With `maxWidth`,
 * laid out to fit it where Pele can, as a flowchart's long labels wrapping.
 */
async function draw(
  source: string,
  idPrefix: string,
  fonts: Fonts,
  maxWidth?: number,
): Promise<Drawn> {
  const [{ renderAsync }] = await Promise.all([import("pele/lazy"), loaded(fonts)]);
  const { height, svg, type, width } = await renderAsync(source, {
    idPrefix,
    ...(maxWidth === undefined ? {} : { maxWidth }),
    ...(fonts.family ? { fontFamily: fonts.family } : {}),
    ...(fonts.mono ? { fontFamilyMono: fonts.mono } : {}),
  });
  // A source that does not parse throws above, rather than drawing an error picture.
  return {
    height,
    kind: type.replaceAll(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`),
    svg,
    width,
  };
}

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
  const [natural, setNatural] = useState<Drawn | "failed" | undefined>(undefined);
  // Drawn again to fit its room, while it is narrower than the natural one: the room it fits.
  const [fitted, setFitted] = useState<{ drawn: Drawn; room: number }>();
  // The same element for the diagram's life, drawn or not, so its width is followed throughout.
  const scroller = useRef<HTMLDivElement>(null);
  const fonts = useRef<Fonts>({ family: "", mono: "" });
  const room = Math.floor(useWidthOf(scroller));
  useEffect(() => {
    let live = true;
    const element = scroller.current;
    fonts.current = element ? fontsOf(element) : { family: "", mono: "" };
    draw(source, idPrefix, fonts.current).then(
      (result) => live && setNatural(result),
      () => live && setNatural("failed"),
    );
    return () => {
      live = false;
    };
  }, [idPrefix, source]);
  const wider = typeof natural === "object" && room > 0 && natural.width > room;
  useEffect(() => {
    if (!wider) {
      return;
    }
    let live = true;
    // Pele cannot always fit: a layout no narrower than the natural one is not kept.
    draw(source, idPrefix, fonts.current, room).then(
      (result) => live && setFitted({ drawn: result, room }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [idPrefix, room, source, wider]);
  const drawn =
    wider && fitted?.room === room && fitted.drawn.width < natural.width ? fitted.drawn : natural;
  const drawnNow = typeof drawn === "object" ? drawn : undefined;
  const near = drawnNow && room > 0 && drawnNow.width <= room * NEAR_FIT;
  const scale = drawnNow
    ? Math.min(
        1,
        near ? room / drawnNow.width : 1,
        MAX_WIDTH / drawnNow.width,
        MAX_HEIGHT / drawnNow.height,
      )
    : 1;
  const width = drawnNow ? drawnNow.width * scale : 0;
  const title = drawnNow ? titleOf(drawnNow.kind, place) : undefined;
  // Wider than its card, it scrolls: the keyboard reaches it, as a region named for what it holds.
  const scrolls = drawnNow !== undefined && room > 0 && width > room;
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
