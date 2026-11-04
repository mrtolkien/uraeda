// What a diagram shows (`Diagram.tsx`), drawn by Pele in the fonts the page draws it in, and fitted
// to its room: the natural layout, or, when it is much wider than its room, Pele's layout for that
// room, as Pele's own `mount()` does; then the width it shows at, and whether it still scrolls.
import { type RefObject, useEffect, useRef, useState } from "react";

/** The largest a diagram shows, in px: a bigger one is scaled down, keeping its proportions. */
const MAX_WIDTH = 4000;
const MAX_HEIGHT = 3000;
/**
 * How much wider than its room a diagram may be and still be scaled down to fit it, its text a few
 * percent smaller, rather than scroll for a sliver of itself or be laid out again: Pele's fitted
 * layout often ends a few px past its room.
 */
const NEAR_FIT = 1.1;
/** The steps a room is fitted in, in px: a resize draws again every few px, not at each. */
const FIT_STEP = 8;
/** How long a font may take to load before the diagram is drawn in its fallback, in ms. */
const FONT_WAIT = 2000;

/** A diagram drawn: Pele's SVG, its size in pixels, and its type, "flowchart" or "git graph". */
export type Drawn = { height: number; kind: string; svg: string; width: number };

/** The fonts a diagram is drawn in: the theme's, as `Diagram`'s theme sets them on its box. */
type Fonts = { family: string; mono: string };

const NO_FONTS: Fonts = { family: "", mono: "" };

/** The fonts `element` draws a diagram in, from its `--pele-font` and `--pele-font-mono`. */
function fontsOf(element: Element): Fonts {
  const style = getComputedStyle(element);
  return {
    family: style.getPropertyValue("--pele-font").trim(),
    mono: style.getPropertyValue("--pele-font-mono").trim(),
  };
}

/**
 * Loads `fonts` for the characters of `text`, so Pele measures their own glyphs rather than a
 * fallback's, each subset of a font loading apart. A font that fails, or takes longer than
 * `FONT_WAIT`, leaves the fallback, which the page draws too until it arrives.
 */
async function loaded({ family, mono }: Fonts, text: string) {
  const faces = typeof document === "undefined" ? undefined : document.fonts;
  if (!faces) {
    return;
  }
  const loads = Promise.all(
    [family, mono].filter(Boolean).map((font) => faces.load(`1em ${font}`, text).catch(() => [])),
  );
  await Promise.race([loads, new Promise((resolve) => setTimeout(resolve, FONT_WAIT))]);
}

/**
 * Draws `source` with Pele, imported on demand, its ids starting with `idPrefix`, its labels
 * measured in `fonts`, the ones the page draws them in: with Pele's own metrics, a label in the
 * theme's wider monospace font ran into the next one and past the diagram's edge. With `maxWidth`,
 * laid out to fit it where Pele can, as a flowchart turning top-down, its labels wrapping.
 */
async function draw(
  source: string,
  idPrefix: string,
  fonts: Fonts,
  maxWidth?: number,
): Promise<Drawn> {
  const [{ renderAsync }] = await Promise.all([import("pele/lazy"), loaded(fonts, source)]);
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

/** A draw of one source: what it drew, or that it failed. */
type Draw = { drawn: Drawn | "failed"; source: string };

/**
 * The room a diagram is fitted to, in steps of `FIT_STEP`: none while its natural layout is within a
 * tenth of `room`, where scaling it down reads better than a layout of another shape.
 */
function fitRoom(natural: Drawn | "failed" | undefined, room: number) {
  return typeof natural === "object" && room > 0 && natural.width > room * NEAR_FIT
    ? Math.max(FIT_STEP, Math.floor(room / FIT_STEP) * FIT_STEP)
    : undefined;
}

/**
 * What `source`'s diagram shows in `element`, `room` px wide: undefined while drawing, "failed"
 * once it cannot draw, or what it drew, with the width it shows at and whether it scrolls past its
 * room. A fitted layout replaces the natural one only when narrower; the last one fitted to the
 * same source stays while the next is drawn, so a resize never flips between the two.
 */
export function useDiagramDraw(
  source: string,
  idPrefix: string,
  element: RefObject<HTMLElement | null>,
  room: number,
) {
  const [natural, setNatural] = useState<Draw>();
  const [fitted, setFitted] = useState<Draw>();
  const fonts = useRef(NO_FONTS);
  useEffect(() => {
    let live = true;
    fonts.current = element.current ? fontsOf(element.current) : NO_FONTS;
    draw(source, idPrefix, fonts.current).then(
      (drawn) => live && setNatural({ drawn, source }),
      () => live && setNatural({ drawn: "failed", source }),
    );
    return () => {
      live = false;
    };
  }, [element, idPrefix, source]);
  const own = natural?.source === source ? natural.drawn : undefined;
  const fits = fitRoom(own, room);
  useEffect(() => {
    if (fits === undefined) {
      return;
    }
    let live = true;
    draw(source, idPrefix, fonts.current, fits).then(
      (drawn) => live && setFitted({ drawn, source }),
      () => live && setFitted({ drawn: "failed", source }),
    );
    return () => {
      live = false;
    };
  }, [fits, idPrefix, source]);
  const fit = fitted?.source === source ? fitted.drawn : undefined;
  // Until its first fit is in, nothing shows, rather than one layout, then another of a new height.
  const waits = fits !== undefined && fit === undefined;
  const drawn =
    fits !== undefined &&
    typeof fit === "object" &&
    typeof own === "object" &&
    fit.width < own.width
      ? fit
      : waits
        ? undefined
        : own;
  if (typeof drawn !== "object") {
    return { drawn, scrolls: false, width: 0 };
  }
  const near = room > 0 && drawn.width <= room * NEAR_FIT;
  const scale = Math.min(
    1,
    near ? room / drawn.width : 1,
    MAX_WIDTH / drawn.width,
    MAX_HEIGHT / drawn.height,
  );
  const width = drawn.width * scale;
  // Half a px of tolerance: `room / width * width` may end a hair past `room`.
  return { drawn, scrolls: room > 0 && width > room + 0.5, width };
}
