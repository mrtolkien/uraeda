// The window's width class, as the UI layout decision names three: narrow below 768 points,
// semi-wide from 768, wide from 1280. What the library draws otherwise on a narrow window, a sheet
// in place of a dialog, a target a finger can hit, reads `isNarrow`; a pane reads its own stack's
// class, from the layout shell.
//
// The window's size is 0 at the first render, which chose the phone's layout in the spike: the
// layout shell writes the width its frame was laid out at (`measured`), and until a frame did, the
// window's size is read.
//
// A phone's browser is narrow at every width: a phone turned on its side is still held in the
// hands, a thumb on its glass and no keyboard under it, so it keeps the phone's frame, its targets,
// and its sheets, never a desktop's status line of keys and its 32-point controls (ruling T86.1).
// The browser says it is a phone by its idiom: a coarse pointer on a screen under 600 points both
// ways. The native app on a phone would too; `nsh test` runs headless as one at any width, so this
// asks the browser alone.
import { platform, signal, windowSize } from "nsh";

export type WidthClass = "narrow" | "semi-wide" | "wide";

/** Where each class starts, in points. */
export const WIDTHS = { semiWide: 768, wide: 1280 } as const;

/** Whether the app runs in a phone's browser, which is narrow held either way. */
const phoneBrowser = platform.os === "web" && platform.idiom === "phone";

/** The class of a width in points: a phone's browser's is narrow at every width. */
export const widthClass = (points: number): WidthClass =>
  phoneBrowser
    ? "narrow"
    : points >= WIDTHS.wide
      ? "wide"
      : points >= WIDTHS.semiWide
        ? "semi-wide"
        : "narrow";

/** The width the layout shell's frame was last laid out at, `0` before its first layout. */
const laidOut = signal(0);

/** Called by the layout shell's frame as it is laid out: the one writer. */
export function measured(points: number) {
  if (points > 0) {
    laidOut.set(points);
  }
}

/** The window's width in points: the frame's once laid out, else the platform's. */
export const windowWidth = () => laidOut() || windowSize().width;

/** The window's width class, read as a signal. */
export const width = (): WidthClass => widthClass(windowWidth());

/** Whether the window is a phone's: under the semi-wide class's 768 points. */
export const isNarrow = () => width() === "narrow";
