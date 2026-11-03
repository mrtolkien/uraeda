// Where a pane's title goes with its actions in the top border (`Pane.tsx`): beside them, or under
// them where it would not hold on one line beside them.
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** The least room, in px, a title keeps beside the actions: less, and it goes under them. */
const TITLE_ROOM = 160;

const styles = stylex.create({
  // The title moves under the actions or back beside them, never jumps; at once with reduced
  // motion.
  moves: {
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "200ms" },
    transitionProperty: "margin-block-start",
    transitionTimingFunction: "ease-out",
  },
  // Beside the actions, the title wraps before them: their width, and the gap, kept free.
  reserve: (room: string) => ({ "--pane-actions-room": room }),
  // Under the actions, the title is inside the pane, from below the actions' lower half.
  under: (below: string) => ({
    marginBlockStart: below,
  }),
});

/** The room the title keeps free beside actions `width` px wide: their width, and the gap. */
const reserveOf = (width: number) => `calc(${width}px + ${spacingVars["--spacing-2"]})`;

/**
 * The heading's widths, in px, with its own insets: its title on one line, the most it may take
 * beside actions `width` px wide, and the most under them. Each is read with the heading's own
 * styles set for a moment, then put back, before anything is painted.
 */
function headingWidths(heading: HTMLElement, width: number) {
  const own = heading.style.cssText;
  const read = (styles: string) => {
    heading.style.cssText = `${own};${styles}`;
    return heading.getBoundingClientRect().width;
  };
  const oneLine = read("width: max-content; max-width: none");
  const beside = read(`width: 100000px; --pane-actions-room: ${reserveOf(width)}`);
  const under = read("width: 100000px; --pane-actions-room: 0px");
  heading.style.cssText = own;
  return { beside, oneLine, under };
}

/** The title's place by the actions, their size, and whether a change of place is animated. */
type Room = { height: number; moves: boolean; under: boolean; width: number };

/** The title's styles in `room`: the width it keeps free beside the actions, or its place under them. */
function titleStyles(room: Room | undefined) {
  if (!room) {
    return null;
  }
  return [
    room.under
      ? styles.under(`calc(${room.height / 2}px + ${spacingVars["--spacing-1"]})`)
      : styles.reserve(reserveOf(room.width)),
    room.moves && styles.moves,
  ];
}

/**
 * Where the title goes with the actions in the top border: beside them, wrapping before them, or
 * under them, where they leave it less than `TITLE_ROOM`, or where it wraps beside them but holds
 * on one line under them; animated, but at the pane's first draw, where nothing moves. It gives the
 * refs of the pane, its heading, and its actions' box, and the title's styles: none without
 * actions, or until measured.
 */
export function useActionsRoom(hasActions: boolean) {
  const paneRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<Room>();
  // Whether the pane was painted: a place found before it is no move.
  const painted = useRef(false);
  useEffect(() => {
    painted.current = true;
  }, []);
  useLayoutEffect(() => {
    const own = paneRef.current;
    const title = headingRef.current;
    const box = actionsRef.current;
    if (!hasActions || !own || !title || !box) {
      return;
    }
    const measure = () => {
      const width = Math.ceil(box.getBoundingClientRect().width);
      const height = Math.ceil(box.getBoundingClientRect().height);
      const widths = headingWidths(title, width);
      // A pixel of slack, as fractions round.
      const wraps = widths.oneLine > widths.beside + 1 && widths.oneLine <= widths.under + 1;
      const under = own.clientWidth - width < TITLE_ROOM || wraps;
      const moves = painted.current;
      setRoom((known) =>
        known?.width === width && known.height === height && known.under === under
          ? known
          : { height, moves, under, width },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(own);
    observer.observe(box);
    // Its words change its width, as a count grows.
    observer.observe(title);
    return () => observer.disconnect();
  }, [hasActions]);
  return { actionsRef, headingRef, paneRef, title: titleStyles(hasActions ? room : undefined) };
}
