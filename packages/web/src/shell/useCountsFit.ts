// Whether the status line's counts fit beside the page's controls: the line's room, less the
// controls and the gap after them, against the widest count, as the counts wrap one under the other
// at their narrowest. Measured again whenever the line, the controls, or a count changes size.
import { type RefObject, useLayoutEffect, useState } from "react";

/** The room left in `line` for the counts once `slot` and the gap after it are drawn. */
function roomFor(line: HTMLElement, slot: HTMLElement) {
  const style = getComputedStyle(line);
  const padding =
    Number.parseFloat(style.paddingInlineStart) + Number.parseFloat(style.paddingInlineEnd);
  const gap = Number.parseFloat(style.columnGap) || 0;
  return line.clientWidth - padding - slot.offsetWidth - gap;
}

/** The widest count: each is whole, never cut, so the counts are at least this wide. */
function widest(counts: HTMLElement) {
  return Math.max(0, ...[...counts.children].map((count) => (count as HTMLElement).offsetWidth));
}

/**
 * Whether the counts fit beside the controls in `slot`: true without controls. The counts are
 * measured where they are, drawn or hidden, so hiding them changes nothing measured.
 */
export function useCountsFit(
  line: RefObject<HTMLElement | null>,
  slot: RefObject<HTMLElement | null>,
  counts: RefObject<HTMLElement | null>,
  hasSlot: boolean,
) {
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const [lineBox, slotBox, countsBox] = [line.current, slot.current, counts.current];
    if (!hasSlot || !lineBox || !slotBox || !countsBox) {
      return;
    }
    const measure = () => setFits(widest(countsBox) <= roomFor(lineBox, slotBox) + 0.5);
    // Each box observed is measured once at once, then at each change of its size.
    const sizes = new ResizeObserver(measure);
    const observe = () => {
      sizes.disconnect();
      for (const box of [lineBox, slotBox, ...countsBox.children]) {
        sizes.observe(box);
      }
    };
    // A count shown or left out, or its number changed: its width with it.
    const texts = new MutationObserver(observe);
    texts.observe(countsBox, { characterData: true, childList: true, subtree: true });
    observe();
    return () => {
      sizes.disconnect();
      texts.disconnect();
    };
  }, [counts, hasSlot, line, slot]);
  return !hasSlot || fits;
}
