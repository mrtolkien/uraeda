// A story drawn as at most a given window's width, as the width classes read it: a story frame is a
// phone's or a desktop's, so a semi-wide state needs the desktop's frame to answer as 1205 px. Only
// the width queries the code asks through `matchMedia` answer as that width, `useWidthClass`'s among
// them; the real components draw, over the real server's data, and CSS keeps the frame's width.
import type { StoryContext } from "@storybook/react-vite";

/** A query of a least or a most width in px, as `useWidthClass` asks: `(min-width: 768px)`. */
const WIDTH_QUERY = /^\(\s*(min|max)-width:\s*(\d+(?:\.\d+)?)px\s*\)$/;

/** A media query's list whose answer is `matches`, its change events the real list's. */
function answered(list: MediaQueryList, matches: boolean): MediaQueryList {
  return {
    addEventListener: list.addEventListener.bind(list),
    addListener: list.addListener.bind(list),
    dispatchEvent: list.dispatchEvent.bind(list),
    matches,
    media: list.media,
    onchange: null,
    removeEventListener: list.removeEventListener.bind(list),
    removeListener: list.removeListener.bind(list),
  };
}

/**
 * A story's `beforeEach` that answers the width queries as a window `width` px wide, while the frame
 * is wider, and puts `matchMedia` back after the story.
 */
export function atMostWidth(width: number) {
  return (_context: StoryContext) => {
    const real = window.matchMedia;
    window.matchMedia = (query: string) => {
      const list = real.call(window, query);
      const match = WIDTH_QUERY.exec(query.trim());
      if (!match || window.innerWidth <= width) {
        return list;
      }
      const edge = Number(match[2]);
      return answered(list, match[1] === "min" ? width >= edge : width <= edge);
    };
    return () => {
      window.matchMedia = real;
    };
  };
}

/** A semi-wide window, the spec's: 1205 px, its column a rail. */
export const SEMI_WIDE = 1205;

/** A phone's window, the story frame's: 402 px. */
export const PHONE = 402;
