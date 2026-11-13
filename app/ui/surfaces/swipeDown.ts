// A sheet's swipe down, on a phone (the phone guide: "A swipe on its top, its handle and title row,
// moves it: down closes it"): a finger that starts on the sheet's top row and moves down takes the
// sheet with it, and let go past `CLOSES` closes it; short of it, the sheet goes back up.
import { type Accessor, signal } from "nsh";

/** How far down the top row is, from the sheet's top edge, in points: the title's plate and its row. */
const TOP_ROW = 56;
/** How far down a sheet is dragged before a release closes it, in points. */
export const CLOSES = 80;

type Gesture = { dx: number; dy: number; y0: number };
type Touch = { pageY: number };

export type SwipeDown = {
  /** How far down the sheet is dragged now, for its `translateY`. */
  by: Accessor<number>;
  /** The props of the view that holds the sheet. */
  props: {
    onLayout: (event: { bounds: { origin: { y: number } } }) => void;
    onMoveShouldSetResponderCapture: (event: unknown, gesture: Gesture) => boolean;
    onResponderGrant: (event: Touch) => boolean;
    onResponderMove: (event: Touch) => void;
    onResponderRelease: () => void;
    onResponderTerminate: () => void;
  };
};

/** The swipe of a sheet: on while `on` says so, `close` once let go far enough down. */
export function swipeDown(on: () => boolean, close: () => void): SwipeDown {
  const by = signal(0);
  let top = 0;
  // Where the finger was as the sheet took it, in the window's points.
  let from = 0;
  return {
    by,
    props: {
      onLayout: (event) => {
        top = event.bounds.origin.y;
      },
      onMoveShouldSetResponderCapture: (_, gesture) =>
        on() &&
        gesture.y0 >= top &&
        gesture.y0 <= top + TOP_ROW &&
        gesture.dy > 8 &&
        gesture.dy > Math.abs(gesture.dx),
      // Taken some points down already: the sheet starts where the finger is.
      onResponderGrant: (event) => {
        from = event.pageY - 8;
        return true;
      },
      onResponderMove: (event) => by.set(Math.max(0, event.pageY - from)),
      onResponderRelease: () => {
        const far = by();
        by.set(0);
        if (far >= CLOSES) close();
      },
      onResponderTerminate: () => by.set(0),
    },
  };
}
