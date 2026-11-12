// A pane that moves travels to where it lands: a stack a pane just came into slides in from the side
// it came from, fading up, in a glide, while the rest of the frame glides to its new sizes. A pane
// is a view of its thing, drawn anew where it lands (`Stack.tsx`): what moves is where it is drawn,
// never what it holds. With reduced motion asked for, it lands at once.
import { effect, type JSX, reduceMotion, signal, untracked, View } from "nsh";
import { type Layout, stackOf } from "./layout";
import { glide } from "../lists/glide";
import { tokens } from "../tokens";

/** Where a pane may land: a stack. A zoom only glides: the zoomed pane stays where it is drawn. */
export type Landing = "main" | "side";

/** How far a pane comes from, in points: from the left into the side stack, the right into main. */
const FROM = 48;

/** The stacks panes just landed in, and the side each came from, with when. */
const landed = signal<{ at: number; by: Partial<Record<Landing, number>> }>({ at: 0, by: {} });

/** Where the panes of `after` landed that were elsewhere, or nowhere, in `before`. */
export function landings(before: Layout, after: Layout): Partial<Record<Landing, number>> {
  const by: Partial<Record<Landing, number>> = {};
  for (const name of ["main", "side"] as const) {
    for (const pane of after[name].panes) {
      const was = stackOf(before, pane.key);
      if (was !== name) by[name] = name === "main" ? FROM : -FROM;
    }
  }
  return by;
}

/** Says the next change of the frame is a move: what it moves glides, and what lands slides in. */
export function arrive(before: Layout, after: Layout) {
  glide();
  const by = landings(before, after);
  if (Object.keys(by).length > 0) landed.set({ at: Date.now(), by });
}

/** A landing told this long ago is the one a view mounting now was made for. */
const FRESH = 150;

/** What a stack's panes are drawn in, sliding in when a pane just landed there. */
export function Arriving(props: { children?: JSX.Element; name: Landing }) {
  const offset = signal(0);
  const faded = signal(false);
  const moving = signal(false);
  let seen = 0;
  effect(() => {
    const now = landed();
    const by = now.by[props.name];
    if (now.at === seen || by === undefined || Date.now() - now.at > FRESH) return;
    seen = now.at;
    if (untracked(reduceMotion)) return;
    untracked(() => {
      moving.set(false);
      offset.set(by);
      faded.set(true);
      requestAnimationFrame(() => {
        moving.set(true);
        offset.set(0);
        faded.set(false);
      });
    });
  });
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        opacity: faded() ? 0.4 : 1,
        transitionDuration: moving() ? tokens.motion.glide : 0,
        transitionProperty: "opacity, transform",
        translate: [offset(), 0],
      }}
    >
      {props.children}
    </View>
  );
}
