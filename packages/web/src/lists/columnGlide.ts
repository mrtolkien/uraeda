// The row of columns gliding sideways to the selection's column, brought into view whole (see
// `WorkList`).
import { type UIEvent, useLayoutEffect, useRef } from "react";

/** How long the row of columns takes to glide sideways to the selection's column. */
const GLIDE_MS = 200;

/**
 * Glides `scroller` sideways from `glide.rest`, where it rested, to where it is now, over
 * `GLIDE_MS`, easing out; at once for a human who asked for less motion. A scroll by anything else,
 * a wheel or a drag, ends the glide.
 */
function glideAcross(scroller: HTMLElement, glide: { frame: number; rest: number }) {
  const from = glide.rest;
  const to = scroller.scrollLeft;
  cancelAnimationFrame(glide.frame);
  glide.frame = 0;
  if (to === from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    glide.rest = to;
    return;
  }
  scroller.scrollLeft = from;
  const start = performance.now();
  const tick = (now: number) => {
    // Moved by something else since the last frame: it takes over.
    if (Math.abs(scroller.scrollLeft - glide.rest) > 2) {
      glide.frame = 0;
      glide.rest = scroller.scrollLeft;
      return;
    }
    const done = Math.min((now - start) / GLIDE_MS, 1);
    scroller.scrollLeft = from + (to - from) * (1 - (1 - done) ** 3);
    glide.rest = scroller.scrollLeft;
    glide.frame = done < 1 ? requestAnimationFrame(tick) : 0;
  };
  glide.frame = requestAnimationFrame(tick);
}

/**
 * Moves the row of columns, scrolled to bring `column` into view from `rest`, to whole columns: the
 * first one it shows starts at the row's inset. Brought in from the end, `column` is the last whole
 * one, the most that fit with it shown; from the start, the first. Columns wider than the row show
 * one at a time.
 */
function alignColumns(scroller: HTMLElement, column: HTMLElement, rest: number) {
  if (scroller.scrollLeft === rest) {
    return;
  }
  const inset = Number.parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart) || 0;
  const view = scroller.clientWidth - 2 * inset;
  const origin = scroller.getBoundingClientRect().left - scroller.scrollLeft;
  const columns = [...scroller.querySelectorAll<HTMLElement>("[data-column]")];
  const spans = columns.map((one) => {
    const box = one.getBoundingClientRect();
    return { left: box.left - origin, right: box.right - origin };
  });
  const at = columns.indexOf(column);
  const target = spans[at];
  if (!target) {
    return;
  }
  const first =
    scroller.scrollLeft > rest
      ? (spans.slice(0, at).find((span) => target.right - span.left <= view) ?? target)
      : target;
  scroller.scrollLeft = first.left - inset;
}

/**
 * The selection's column comes into view whole, any part of it outside the window moves the page
 * or the row: a key that changes column may land beyond the edge. The row glides there sideways
 * from where it rested, which the focus moved to the new column has already jumped from. Returns
 * the row's scroll handler, which notes where it rests.
 */
export function useColumnGlide(asColumns: boolean, selected: string | undefined) {
  const sideways = useRef({ frame: 0, rest: 0 });
  useLayoutEffect(() => {
    const glide = sideways.current;
    if (!asColumns || selected === undefined) {
      glide.rest = 0;
      return;
    }
    const row = document.querySelector(`[data-row-key="${CSS.escape(selected)}"]`);
    const scroller = row?.closest<HTMLElement>("[data-list-page]");
    const column = row?.closest<HTMLElement>("[data-column]");
    column?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (scroller && column) {
      alignColumns(scroller, column, glide.rest);
      glideAcross(scroller, glide);
    }
  }, [asColumns, selected]);
  // A wheel, a drag, or a jump with no glide: where the row rests now.
  return (event: UIEvent<HTMLElement>) => {
    if (sideways.current.frame === 0) {
      sideways.current.rest = event.currentTarget.scrollLeft;
    }
  };
}
