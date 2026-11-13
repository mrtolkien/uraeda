// The height a component sits on. `Surface` sets it for what it holds, so a control picks its
// contrast from it, and a surface inside another its look: a field in a dialog is still a well,
// whose fill is the dialog's own, darkened.
import { type Accessor, context } from "nsh";
import type { HeightName } from "../tokens";

/** What a component sits on: a surface's height, and whether that surface is glass. */
export type Ground = { height: HeightName; glass: boolean };

/** Outside every surface a component sits on the page's own content: `standard`. */
const PAGE: Accessor<Ground> = () => ({ height: "standard", glass: false });

export const GroundContext = context<Accessor<Ground>>(PAGE);

/** The height the caller sits on, read as a signal: the nearest `Surface`'s around it. */
export function useHeight(): Accessor<HeightName> {
  const ground = GroundContext();
  return () => ground().height;
}

/**
 * Whether the caller sits on glass, read as a signal: on glass nothing is a filled block, so a
 * button there is a tube.
 */
export function useGlass(): Accessor<boolean> {
  const ground = GroundContext();
  return () => ground().glass;
}
