import { useMediaQuery } from "@astryxdesign/core/hooks";
import { uraedaTheme } from "../theme/built/uraeda.js";

/**
 * The width classes of the UI layout decision: narrow, semi-wide, and wide. Pages lay out alike at
 * semi-wide and wide, so most read `isNarrow` only; the shell changes at wide.
 */
export type WidthClass = "narrow" | "semi" | "wide";

const breakpoints = uraedaTheme.__adaptations?.widthBreakpoints;

/** Where semi-wide starts: the theme's `md` breakpoint, 768 px. */
const SEMI = breakpoints?.md ?? 768;

/** Where wide starts: the theme's `xl` breakpoint, 1280 px. */
const WIDE = breakpoints?.xl ?? 1280;

const SEMI_QUERY = `(min-width: ${SEMI}px)`;
const WIDE_QUERY = `(min-width: ${WIDE}px)`;

function widthClass(semi: boolean, wide: boolean): WidthClass {
  if (wide) {
    return "wide";
  }
  return semi ? "semi" : "narrow";
}

/** Whether a width class is narrow: what a page's layout follows, the same at semi-wide and wide. */
export function isNarrow(width: WidthClass): boolean {
  return width === "narrow";
}

/**
 * The width class of the UI layout decision: narrow under the theme's `md` breakpoint, semi-wide
 * from it, and wide from its `xl`, updated as the window crosses either. The one place a component
 * learns the width.
 */
export function useWidthClass(): WidthClass {
  const semi = useMediaQuery(SEMI_QUERY);
  const wide = useMediaQuery(WIDE_QUERY);
  return widthClass(semi, wide);
}

/**
 * The window's width class at this moment, which the drawn layout follows a moment later: what
 * tells a layout drawn for another width class, as the window crosses a breakpoint.
 */
export function widthClassNow(): WidthClass {
  return widthClass(window.matchMedia(SEMI_QUERY).matches, window.matchMedia(WIDE_QUERY).matches);
}
