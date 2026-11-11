// The four heights. A component picks one, and takes everything else from it: its fill, its
// border, its lip, its shadow, and, where it is glass, its blur and its tint. Nothing else draws
// a shadow, glass, or a glow.
import { choices } from "./choices";
import { alpha } from "./mix";
import type { Source } from "./source";

/** The light a focused surface emits: `blur` px wide, moved by `offset`, within `reach`. */
export type Glow = { blur: number; offset: number; strength: number; reach: number };

/** What a height fixes. */
export type Height = {
  /** The fill: for glass, the tint's colour, which a platform without glass draws opaque. */
  fill: string;
  /** The 1 px line round it. */
  border: string;
  /** The 1 px of light or shade inside its top edge, as a `boxShadow`, or `none`. */
  lip: string;
  /** Its `boxShadow`, or `none`. */
  shadow: string;
  /** Whether it is glass wherever it is. A raised surface is glass only over what scrolls. */
  glass: boolean;
  /** The frost of its glass: a blur's deviation in px, so twice that across. */
  blur: number;
  /** What its glass is tinted with, at the tint's share: `rgba(r, g, b, a)`. */
  tint: string;
  /** The light it emits when it has the focus, or none: only a pane and a field do. */
  glow: Glow | null;
  /** A well's fill inside a raised surface, and what darkens it inside a well or glass. */
  fillIn?: { raised: string; deeper: string };
  /** The `boxShadow` of a raised surface once content scrolls under it, and it is glass. */
  glassShadow?: string;
};

/** The name of a height: what a surface sits at. */
export type HeightName = "recessed" | "standard" | "raised" | "overlay";

/** The four heights, by name. */
export function height({ dark, role, mixed, black }: Source) {
  const depth = choices["height.depth"];
  const lip = (colour: string) => (depth === "tone" ? "none" : `inset 0 1px 0 ${colour}`);
  const tint = alpha(mixed.glassTint, mixed.glassStrength);
  const frost = 7;
  const soft = depth === "soft" ? `0 2px 8px -2px ${alpha(black, dark ? 0.5 : 0.2)}` : "none";
  const field = dark
    ? { blur: 14, offset: 0, strength: 0.32 }
    : { blur: 10, offset: 3, strength: 0.22 };
  return {
    recessed: {
      fill: role.well,
      /** A well inside a raised surface, and inside a well or glass. */
      fillIn: { raised: role.page, deeper: mixed.deeper },
      border: role.rule,
      lip: lip(role.shade),
      shadow: "none",
      glass: false,
      blur: 0,
      tint,
      /** A focused field's, in the editing mode's colour. */
      glow: { ...field, reach: field.blur * 2 },
    },
    standard: {
      fill: role.page,
      border: role.rule,
      lip: "none",
      shadow: "none",
      glass: false,
      blur: 0,
      tint,
      /** The focused pane's, in `light.focus` and `light.focus2`. */
      glow: dark
        ? { blur: 15, offset: 4, strength: 0.42, reach: 30 }
        : { blur: 9, offset: 5, strength: 0.24, reach: 24 },
    },
    raised: {
      fill: role.raised,
      border: role.rule,
      lip: lip(role.lip),
      shadow: soft,
      glass: false,
      /** What a raised surface takes once content scrolls under it: glass, with a short shadow. */
      blur: frost,
      tint,
      glassShadow: `0 9px 16px -10px ${alpha(black, dark ? 0.6 : 0.3)}`,
      glow: null,
    },
    overlay: {
      fill: mixed.glassTint,
      /** The line under the rim. */
      border: alpha(role.rule, 0.45),
      lip: "none",
      shadow: `0 1px 0 ${alpha(black, dark ? 0.5 : 0.15)}, 0 22px 50px -12px ${alpha(black, dark ? 0.65 : 0.3)}`,
      glass: true,
      blur: frost,
      tint,
      glow: null,
    },
  } satisfies Record<HeightName, Height>;
}

/** A pane: its fill and border are the standard height's, and its title rises over its top edge. */
export function pane({ role }: Source) {
  return {
    fill: role.page,
    border: role.rule,
    /** Where the title sits: round it goes the pane's border. */
    title: choices["pane.title"],
    /** How far the title stands above the pane's top edge, and its whole height. */
    titleRise: 14,
    titleHeight: 26,
    titlePadding: [10, 11] as const,
  };
}
