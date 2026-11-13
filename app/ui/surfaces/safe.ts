// What a phone's system takes of the screen: its status bar and rounded corners, its home
// indicator, and its keyboard. The phone's bars pad by them (the phone guide's "the home-screen
// app"): the places' bar below the status bar, the bottom bar's tiles and a sheet's end above the
// home indicator, while the bar's glass goes on under it. A bar's bottom room is the inset alone.
//
// Native Shell reads them from the platform: in a browser, `env(safe-area-inset-*)` of a page with
// `viewport-fit=cover`, which NSH's page has, and the keyboard from the visual viewport, which a
// phone's browser shrinks under it without moving the layout. They are `env()` terms of a padding
// or a margin, never of a size or an offset: 0 on a desktop, and on GTK.
import { keyboardFrame } from "nsh";

export const safe = {
  top: "env(safe-area-inset-top)",
  right: "env(safe-area-inset-right)",
  bottom: "env(safe-area-inset-bottom)",
  left: "env(safe-area-inset-left)",
  /** The keyboard's height over the window, 0 while it is down. */
  keyboard: "env(keyboard-inset-height)",
} as const;

/** The home indicator's inset and `room` points more, for the end of what reaches the bottom. */
export const aboveHome = (room: number) => `calc(env(safe-area-inset-bottom) + ${room}px)` as const;

/** The status bar's inset and `room` points more, for what stands at the top. */
export const belowStatus = (room: number) => `calc(env(safe-area-inset-top) + ${room}px)` as const;

/** Whether a phone's keyboard is up over the window, read as a signal. */
export const keyboardUp = () => keyboardFrame().height > 0;
