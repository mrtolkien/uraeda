// The controls: switches, boxes, segments, badges, banners, and what every control shares, its
// focus ring and its disabled look. Colours are the theme's roles; what is tinted is tinted here.
import { alpha } from "./mix";
import type { Source } from "./source";

/** What a status, a badge, or a banner says, each drawn in one role. */
export type Tone = "accent" | "needs" | "done" | "danger" | "caution" | "live" | "info" | "quiet";

export function control({ dark, role }: Source) {
  const tones: Record<Tone, string> = {
    accent: role.action,
    caution: role.caution,
    danger: role.removed,
    done: role.added,
    info: role.context,
    live: role.live,
    needs: role.needsYou,
    quiet: role.inkQuiet,
  };
  return {
    /** A tone's colour: a text colour, so it reads on every fill. */
    tone: (tone: Tone) => tones[tone],
    /** A faint block of a tone, under its own text: a badge's, a banner's. */
    tint: (colour: string) => alpha(colour, dark ? 0.14 : 0.1),
    /**
     * The fainter wash of a tone over a whole block of words, a banner's: at a badge's share, a
     * warm tone over a raised fill turned brown.
     */
    wash: (colour: string) => alpha(colour, dark ? 0.07 : 0.06),
    /** A control's edge at rest, and under the pointer. */
    edge: role.rule,
    hotEdge: role.action,
    /** What a box, a track, or a field is filled with: the well's colour. */
    well: role.well,
    /** A control that is on: its fill, and the mark on it. */
    on: role.action,
    onMark: role.onAction,
    /** The thumb of a switch that is off. */
    off: role.inkFaint,
    disabledEdge: role.ruleQuiet,
    disabledInk: role.inkFaint,
    /** The focus: a 1 px ring, outside the control, in the accent lightened. */
    ring: { offset: 2, width: 1 },
    /** A switch: a square track with a square thumb. */
    switch: { width: 34, height: 18, thumb: 12, inset: 2 },
    /** A checkbox's and a radio's box, and the radio's mark. */
    box: 16,
    dot: 8,
    /** A status's square. */
    status: 8,
    /** A badge and a key share a height, so neither makes its line taller. */
    badge: { height: 22, padding: 6 },
    /** What a finger needs on a narrow window. */
    touch: 44,
    icon: 16,
  };
}
