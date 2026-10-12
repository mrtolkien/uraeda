import { useMediaQuery } from "@astryxdesign/core/hooks";
import { uraedaTheme } from "../theme/built/uraeda.js";

/** Where the wide layout starts: the theme's `md` breakpoint, 768 px. */
const WIDE = uraedaTheme.__adaptations?.widthBreakpoints.md ?? 768;

/**
 * The width class of the UI layout decision: narrow under the theme's `md` breakpoint, wide from
 * it, updated as the window crosses it. The one place a component learns the width.
 */
export function useWidthClass(): "narrow" | "wide" {
  return useMediaQuery(`(min-width: ${WIDE}px)`) ? "wide" : "narrow";
}
