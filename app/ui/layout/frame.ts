// The frame's layout, where it is kept, and how it changes. A visit keeps its own (`Kept.layout`),
// so Back returns to a page as it was left; the device keeps an arrangement per kind of place
// (`DeviceKeys.layouts`), so a new visit of a session opens as the last session was left; and the
// side stack's width and fold are the device's (`DeviceKeys.frame`), for every place.
import { computed, effect, untracked } from "nsh";
import {
  arranged,
  type Arrangement,
  arrangementOf,
  placeKind,
  sameArrangement,
} from "./arrangement";
import { arrive } from "./arrival";
import { besideWanted, zoomWanted } from "./here";
import { focus, type Layout, layoutOf, type Place, stackOf, sync, zoom } from "./layout";
import type { Mover } from "./moveKeys";
import { placeBeside } from "./moves";
import { device, type DeviceKeys } from "../../store/device";
import { entry, keep } from "../../store/history";

/** Two values equal as data: what the layout and the place are compared by. */
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The frame's choices on this device, and their writer. */
export const choices = {
  kept: () => device.get("frame") ?? {},
  set: (values: DeviceKeys["frame"]) => device.set("frame", { ...choices.kept(), ...values }),
};

/** Every kind of place's arrangement this device keeps. */
const arrangements = (): Readonly<Record<string, Arrangement>> => device.get("layouts") ?? {};

/**
 * Keeps `next` as its kind of place's arrangement: nothing for a layout the place's default
 * arranges the same, so a place whose default changes later follows it.
 */
function keepArrangement(place: Place, next: Layout) {
  const kind = placeKind(place);
  if (kind === null) return;
  const all = arrangements();
  const mine = arrangementOf(next);
  const { [kind]: kept, ...others } = all;
  if (sameArrangement(mine, arrangementOf(layoutOf(place, next.folded)))) {
    if (kept !== undefined) device.set("layouts", others);
  } else if (!sameArrangement(kept, mine)) {
    device.set("layouts", { ...all, [kind]: mine });
  }
}

/** The layout of `place` the frame draws, its writer, and the moves' `Mover`. */
export function frameState(place: () => Place, narrow: () => boolean) {
  const stored = () => {
    const kind = placeKind(place());
    return kind === null ? undefined : arrangements()[kind];
  };
  // The layout the visit keeps, else the arrangement of its kind of place, else the place's
  // default, always made to hold the place's panes.
  const layout = computed(
    () =>
      sync(
        entry().kept.layout ?? arranged(place(), stored(), choices.kept().side === true),
        place(),
      ),
    { equals: same },
  );
  const set = (next: Layout) => {
    if (next.folded !== layout().folded) {
      choices.set({ side: next.folded });
    }
    keep({ layout: next });
    keepArrangement(untracked(place), next);
  };
  const mover: Mover = {
    forget: (all) => {
      const kind = placeKind(place());
      if (all) {
        device.set("layouts", undefined);
      } else if (kind !== null) {
        const { [kind]: _, ...others } = arrangements();
        device.set("layouts", others);
      }
      mover.move(layoutOf(place(), layout().folded));
    },
    layout,
    move: (next) => {
      const now = layout();
      if (next === null || next === now || same(next, now)) {
        return false;
      }
      arrive(now, next);
      set(next);
      return undefined;
    },
    narrow,
    place,
  };
  // A view asked to open a pane beside it: it opens, once.
  effect(() => {
    const wanted = besideWanted();
    if (wanted === null) return;
    untracked(() => {
      besideWanted.set(null);
      mover.move(placeBeside(layout(), wanted.pane, wanted.from ?? undefined));
    });
  });
  // A pane asked to be zoomed, or back: it takes the focus as it zooms.
  effect(() => {
    const wanted = zoomWanted();
    if (wanted === null) return;
    untracked(() => {
      zoomWanted.set(null);
      const now = layout();
      if (stackOf(now, wanted.key) === null) return;
      mover.move(zoom(focus(now, wanted.key), wanted.on));
    });
  });
  return { layout, mover, set };
}
