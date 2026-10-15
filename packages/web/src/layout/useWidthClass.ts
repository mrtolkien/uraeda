import { useMediaQuery } from "@astryxdesign/core/hooks";
import { uraedaTheme } from "../theme/built/uraeda.js";

/** Where the wide layout starts: the theme's `md` breakpoint, 768 px. */
const WIDE = uraedaTheme.__adaptations?.widthBreakpoints.md ?? 768;

/** The media query of the wide layout. */
const WIDE_QUERY = `(min-width: ${WIDE}px)`;

/**
 * The width class of the UI layout decision: narrow under the theme's `md` breakpoint, wide from
 * it, updated as the window crosses it. The one place a component learns the width.
 */
export function useWidthClass(): "narrow" | "wide" {
  return useMediaQuery(WIDE_QUERY) ? "wide" : "narrow";
}

/**
 * The window's width class at this moment, which the drawn layout follows a moment later: what
 * tells a layout drawn for the other width class, as the window crosses the breakpoint.
 */
export function widthClassNow(): "narrow" | "wide" {
  return window.matchMedia(WIDE_QUERY).matches ? "wide" : "narrow";
}
