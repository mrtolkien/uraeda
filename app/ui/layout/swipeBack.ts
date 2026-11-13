// The swipe back, on iOS: a finger that starts on the screen's left edge and moves right goes back
// to the visit before, as it does in every app there. The page follows the finger a little, so
// the swipe is seen as it is made, and let go past `GOES` it goes back; short of it, the page
// returns. A visit the app did not open from a page of its own has nothing to go back to: the
// page still follows, and returns.
import { type Accessor, signal } from "nsh";
import { back } from "../../store/history";
import { feltChoice } from "../native";

/** How far from the left edge a swipe back starts, in points. */
const EDGE = 24;
/** How far right a finger moves before a release goes back, in points. */
export const GOES = 72;
/** How much of the finger's way the page follows. */
const FOLLOWS = 0.35;

type Gesture = { dx: number; dy: number; x0: number };
type Touch = { pageX: number };

export type SwipeBack = {
  /** How far right the page is drawn now, for its `translateX`. */
  by: Accessor<number>;
  /** The props of the view that holds the page. */
  props: {
    onMoveShouldSetResponderCapture: (event: unknown, gesture: Gesture) => boolean;
    onResponderGrant: (event: Touch) => boolean;
    onResponderMove: (event: Touch) => void;
    onResponderRelease: () => void;
    onResponderTerminate: () => void;
  };
};

/** The swipe back of the page, on while `on` says so. */
export function swipeBack(on: () => boolean): SwipeBack {
  const moved = signal(0);
  let from = 0;
  return {
    by: () => Math.round(moved() * FOLLOWS),
    props: {
      onMoveShouldSetResponderCapture: (_, gesture) =>
        on() && gesture.x0 <= EDGE && gesture.dx > 10 && gesture.dx > 2 * Math.abs(gesture.dy),
      onResponderGrant: (event) => {
        from = event.pageX - 10;
        return true;
      },
      onResponderMove: (event) => moved.set(Math.max(0, event.pageX - from)),
      onResponderRelease: () => {
        const far = moved();
        moved.set(0);
        if (far >= GOES && back()) feltChoice();
      },
      onResponderTerminate: () => moved.set(0),
    },
  };
}
