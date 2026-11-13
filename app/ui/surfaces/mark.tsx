// A surface's icon: an icon's name, drawn in the colour of the words it stands before, or a view of
// the caller's own. One shape for a pane's title, a tab, an overlay's plate, and a toast's.
import type { JSX } from "nsh";
import { Icon, type IconName } from "../controls/Icon";

/** An icon by its name, or drawn by the caller: for a mark no name has, as a harness's logo. */
export type SurfaceIcon = IconName | ((colour: string) => JSX.Element);

/** Draws `icon` in `colour`. */
export const drawIcon = (icon: SurfaceIcon, colour: string): JSX.Element =>
  typeof icon === "string" ? <Icon colour={colour} name={icon} /> : icon(colour);
