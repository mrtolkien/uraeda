// Whether the app runs on Apple's phone or tablet, where the system draws some of what the app
// draws itself elsewhere: the places' tab bar, a confirmation's alert, and the taps felt in the
// hand. The system's own surfaces keep the system's look, rounded corners included: the design
// language's square corners are for what Uraeda draws itself.
import { platform } from "nsh";
import { Haptics } from "nsh/mobile";

/**
 * iOS and iPadOS, and Mac Catalyst in a development run. `nsh test` runs headless as iOS on every
 * machine, with none of the system's parts: the program's own platform, the machine's there, tells
 * a test from an iPhone, so a test draws the phone every other platform draws.
 */
export const ios = platform.os === "ios" && process.platform === "ios";

/** A choice made, felt: a tab picked, a switch flipped. Nothing off iOS. */
export function feltChoice() {
  if (ios) Haptics.selection();
}

/** An act that landed, was refused, or needs care, felt. Nothing off iOS. */
export function feltOutcome(kind: "success" | "warning" | "error") {
  if (ios) Haptics.notification(kind);
}
