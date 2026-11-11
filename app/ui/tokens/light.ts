// Light: where the keys go. Only the focused pane emits it, a running pane has a steady line, and
// a selected row's bar is lit, never the row.
import { choices } from "./choices";
import { alpha } from "./mix";
import type { Source } from "./source";

export function light({ dark, role }: Source) {
  return {
    /** The two ends of the focused pane's outline and glow. */
    focus: role.lightFocus,
    focus2: role.lightFocus2,
    /**
     * The glow that follows the focused pane's outline: two lights, each moved by `offset` toward
     * its own end, of `blur` px, drawn within `reach` of the pane. A light theme has one, under
     * the pane, as a tinted shadow.
     */
    glow: dark
      ? { blur: 15, offset: 4, strength: 0.42, reach: 30 }
      : { blur: 9, offset: 5, strength: 0.24, reach: 24 },
    /** How long the light takes from one pane to the next. */
    glide: 300,
    running: role.lightRunning,
    runningGlow: dark
      ? `0 0 10px ${alpha(role.lightRunning, 0.6)}, 0 0 2px ${role.lightRunning}`
      : `0 2px 8px ${alpha(role.lightRunning, 0.4)}`,
    runningWidth: dark ? 1 : 2,
    runningMotion: choices["light.running.motion"],
    /** A pane that waits on the human: a colour, never a lamp. */
    needs: role.needsYou,
    /** The editing mode's colour, on the focused field and the status line's ends. */
    mode: {
      normal: role.modeNormal,
      insert: role.modeInsert,
      visual: role.modeVisual,
      replace: role.modeReplace,
      command: role.modeCommand,
    },
    /** Whether the mode colours them: without it, they take `mode.normal`. */
    modeColours: choices["light.mode"],
    /** The glow of the focused field, in the mode's colour. */
    field: dark ? { blur: 14, y: 0, strength: 0.32 } : { blur: 10, y: 3, strength: 0.22 },
    caretTrail: choices["caret.trail"],
  };
}

export function row({ dark, role }: Source) {
  return {
    selected: role.raised,
    /** The bar on a selected row's left edge, in `light.focus`. */
    bar: 2,
    /** The bar is lit; the row is not. */
    barGlow: dark ? `0 0 8px ${alpha(role.lightFocus, 0.6)}` : "none",
    /** The line between two rows. */
    rule: role.ruleQuiet,
  };
}
