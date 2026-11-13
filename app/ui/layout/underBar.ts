// What scrolls under the bar that floats at the screen's foot, on iOS: the system's tab bar is
// glass over the page, and the page's content goes on beneath it, to the screen's edge.
//
// - The frame says how much of the screen's foot the bar covers (`setBarRoom`): nothing off iOS,
//   and nothing while the keyboard is up, when the bar is gone.
// - A pane's scroller that reaches the pane's foot (`underBar`) scrolls beneath the bar, with that
//   much room after its content, so its end still shows above the bar. It is measured, never
//   declared: a transcript that ends above a composer reaches no bar.
// - A pane no scroller of which reaches its foot keeps its content above the bar (`reachesBar`):
//   nothing is ever left under it.
import { type Accessor, cleanup, signal, windowSize } from "nsh";

const room = signal(0);

/** How much of the screen's foot the floating bar covers, in points: 0 where none floats. */
export const barRoom: Accessor<number> = room;

/** The frame's, as its bar is laid out. */
export function setBarRoom(points: number) {
  const next = Math.max(0, Math.round(points));
  if (room() !== next) room.set(next);
}

/** How many scrollers of each pane reach its foot, by the pane's key. */
const reaching = signal<Readonly<Record<string, number>>>({});

/** Whether a scroller of the pane `key` goes on beneath the bar: its body then needs no room. */
export const reachesBar = (key: string): boolean => (reaching()[key] ?? 0) > 0;

type Measured = { bounds: { size: { height: number } }; pagePosition: { y: number } };

/** How near the bar's top a scroller's foot is, to count as reaching the pane's foot, in points. */
const NEAR = 16;

/**
 * A scroller of the pane `pane`: `check` measures it, as it is laid out, and `inset` is the room
 * its content keeps at its end, the bar's while it reaches the pane's foot. Outside a pane, in a
 * sheet or a popover, it never does.
 */
export function underBar(
  pane: string | undefined,
  measure: () => Promise<Measured | null | undefined> | undefined,
) {
  const mine = signal(false);
  const set = (now: boolean) => {
    if (pane === undefined || mine() === now) return;
    mine.set(now);
    const before = reaching();
    reaching.set({ ...before, [pane]: Math.max(0, (before[pane] ?? 0) + (now ? 1 : -1)) });
  };
  cleanup(() => set(false));
  return {
    check: () => {
      if (room() === 0) return set(false);
      void measure()?.then((box) => {
        if (box == null || room() === 0) return;
        const foot = box.pagePosition.y + box.bounds.size.height;
        set(foot >= windowSize().height - room() - NEAR);
      });
    },
    inset: (): number => (mine() ? room() : 0),
  };
}
