// The window's width class, for what the library draws otherwise on a narrow window: a sheet in
// place of a dialog, a target a finger can hit.
//
// TASK 33: `isNarrow` becomes the layout shell's `width`.
import { windowSize } from "nsh";

/** Whether the window is a phone's: under the semi-wide class's 768 points. */
export const isNarrow = () => windowSize().width < 768;
