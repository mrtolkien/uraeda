// A tab dragged to the other stack, by the pointer: a second way to send a pane there, never the
// only one (`Space w H`, `L`, and the pane's menu do the same). While a tab is carried, each stack it
// may land in shows itself as a target; let go over the other stack, the pane moves there, at the
// end of its tabs, as `send` puts it. Let go anywhere else, nothing moves.
import { signal, untracked, type ViewRef } from "nsh";
import { type Layout, type StackName, stackOf } from "./layout";
import { moveTo } from "./moves";

/** How far the pointer goes before a press on a tab is a drag, in points. */
const SLOP = 6;

type Box = { x: number; y: number; width: number; height: number };

/** What a tab's view calls as the pointer carries it. */
export type TabDrag = {
  grant: (x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (dropped: boolean) => void;
};

/**
 * The drag of the frame's tabs: `views` are where each stack is drawn, measured as a drag starts;
 * `move` makes the change a move, as the keys do.
 */
export function tabDrags(
  layout: () => Layout,
  move: (next: Layout) => void,
  views: Partial<Record<StackName, ViewRef>>,
) {
  /** The pane carried, once the pointer went past the slop. */
  const carried = signal<string | null>(null);
  /** The stack under the pointer while a tab is carried. */
  const over = signal<StackName | null>(null);
  let pressed: { key: string; x: number; y: number } | null = null;
  let boxes: Partial<Record<StackName, Box>> = {};

  const measure = () => {
    boxes = {};
    for (const name of ["main", "side"] as const) {
      void views[name]?.measure().then((found) => {
        if (found !== null) {
          const { size } = found.bounds;
          boxes[name] = { height: size.height, width: size.width, ...found.pagePosition };
        }
      });
    }
  };
  const under = (x: number, y: number): StackName | null =>
    (["main", "side"] as const).find((name) => {
      const box = boxes[name];
      return (
        box !== undefined &&
        x >= box.x &&
        x < box.x + box.width &&
        y >= box.y &&
        y < box.y + box.height
      );
    }) ?? null;

  const of = (key: string): TabDrag => ({
    end: (dropped) => {
      const from = untracked(carried);
      const to = untracked(over);
      pressed = null;
      carried.set(null);
      over.set(null);
      const now = untracked(layout);
      if (dropped && from !== null && to !== null && stackOf(now, from) !== to) {
        move(moveTo(now, from, to));
      }
    },
    grant: (x, y) => {
      pressed = { key, x, y };
      measure();
    },
    move: (x, y) => {
      if (pressed === null) return;
      if (untracked(carried) === null) {
        if (Math.hypot(x - pressed.x, y - pressed.y) < SLOP) return;
        carried.set(pressed.key);
        // The side stack shows while a tab is carried: measured again once it is drawn.
        requestAnimationFrame(measure);
      }
      over.set(under(x, y));
    },
  });

  return {
    /** The pane carried now. */
    carried,
    of,
    /** Whether `name` would take the pane carried: a stack it is not in. */
    takes: (name: StackName) => {
      const key = carried();
      return key !== null && stackOf(layout(), key) !== name;
    },
    /** The stack under the pointer. */
    over,
  };
}
