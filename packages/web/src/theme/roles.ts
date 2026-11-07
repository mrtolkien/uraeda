// The mapping from a theme's roles to the colours the app draws: Astryx's tokens, the syntax
// theme's, and the views' `--role-*` variables (R1), every derived colour included. The built theme
// (`theme.ts`) draws Catppuccin through it, the palette rule (`palette.ts`) every other theme, and
// the contrast tests measure what it gives. Imported by the theme's build as `#theme-roles`.
import { mix } from "./colour.ts";

/** A theme's roles, by name, each `#rrggbb` or `#rrggbbaa`. */
export type Roles = Readonly<Record<string, string>>;
/** Custom properties and their colours. */
export type Tokens = Readonly<Record<string, string>>;
export type Mode = "dark" | "light";

/** The roles whose tint, the role at 12% over the page, views draw as a background (R1). */
export const TINTED = [
  "action",
  "needs-you",
  "changed",
  "added",
  "removed",
  "caution",
  "context",
  "yours",
  "link",
  "working",
  "live",
  "example",
  "sub-agent",
];

/** A tint's share of its role, over the page. */
const TINT = 0.12;

/** Astryx's hues, and the role each takes; pink takes `changed` (R5). */
const HUES: Record<string, string> = {
  blue: "link",
  cyan: "syntax-operator",
  green: "added",
  orange: "needs-you",
  pink: "changed",
  purple: "changed",
  red: "removed",
  teal: "example",
  yellow: "caution",
};

/** The syntax theme's tokens, each from the role `syntax-<token>`. */
const SYNTAX = [
  "attribute",
  "comment",
  "constant",
  "function",
  "keyword",
  "number",
  "operator",
  "property",
  "punctuation",
  "string",
  "tag",
  "type",
  "variable",
];

/**
 * Text and icons over media, the built theme's constants, which no role sets: they are drawn over
 * images, not over the page (R5).
 */
export const MEDIA: Tokens = { "--color-on-dark": "#eff1f5", "--color-on-light": "#11111b" };

/** A colour's alpha, from 0 to 1. */
const alphaOf = (colour: string) =>
  colour.length === 9 ? Number.parseInt(colour.slice(7), 16) / 255 : 1;

/** `colour` at `share` over `under`, its own alpha counted, as `#rrggbb`. */
const over = (colour: string, share: number, under: string) =>
  mix(colour.slice(0, 7), share * alphaOf(colour), under.slice(0, 7));

/** `colour` with the alpha `alpha`, two hex digits, times its own. */
function withAlpha(colour: string, alpha: string) {
  const value = Math.round(Number.parseInt(alpha, 16) * alphaOf(colour));
  return `${colour.slice(0, 7)}${value.toString(16).padStart(2, "0")}`;
}

/**
 * Every colour token the mapping sets, from a theme's roles in its mode: Astryx's tokens, the
 * syntax theme's, `--role-<role>` for every role, and `--role-<role>-tint` for the tinted ones.
 */
export function tokensOf(roles: Roles, mode: Mode): Tokens {
  const role = (name: string) => {
    const colour = roles[name];
    if (colour === undefined) {
      throw new Error(`A theme without the role ${name}`);
    }
    return colour;
  };
  const tint = (name: string) => over(role(name), TINT, role("page"));
  const dark = mode === "dark";
  const tokens: Record<string, string> = {};
  const set = (names: Array<string>, colour: string) => {
    for (const name of names) {
      tokens[name] = colour;
    }
  };

  set(["--color-background-body", "--color-background-card"], role("page"));
  set(["--color-background-surface", "--color-background-popover"], role("raised"));
  set(["--color-background-muted"], role("sunken"));
  set(["--color-background-gray", "--color-skeleton"], role("chip"));
  set(["--color-accent-muted"], role("cursor-row"));
  // The selected block of a review: a tint, and a bar that stands 3:1 from the card.
  set(["--color-selection"], tint("marked"));
  set(["--color-selection-edge"], role("marked"));
  const borders = ["--color-border", "--color-border-emphasized", "--color-border-gray"];
  set([...borders, "--color-icon-disabled"], role("rule"));
  set(["--color-text-lavender"], role("pane-title"));
  set(["--color-text-primary", "--color-icon-primary", "--color-text-gray"], role("ink"));
  set(["--color-text-secondary", "--color-icon-secondary"], role("ink-quiet"));
  set(["--color-text-disabled", "--color-icon-gray"], role("ink-faint"));
  set(["--color-accent", "--color-text-accent", "--color-icon-accent"], role("action"));
  const ons = ["accent", "error", "success", "warning"].map((status) => `--color-on-${status}`);
  set(ons, role("on-action"));
  for (const [hue, name] of Object.entries(HUES)) {
    set([`--color-text-${hue}`, `--color-border-${hue}`, `--color-icon-${hue}`], role(name));
    set([`--color-background-${hue}`], tint(name));
  }
  const statuses = { accent: "action", error: "removed", success: "added", warning: "caution" };
  for (const [status, name] of Object.entries(statuses)) {
    set([`--astryx-theme-neutral-color-status-fill-${status}`], role(name));
    if (status !== "accent") {
      set([`--color-${status}`], role(name));
      set([`--color-${status}-muted`], tint(name));
    }
  }
  set(["--astryx-theme-neutral-color-status-muted-accent"], tint("context"));
  set(["--color-fill-teal"], role("sub-agent"));
  set(["--color-border-sapphire", "--color-text-sapphire"], role("live"));

  for (const token of SYNTAX) {
    set([`--color-syntax-${token}`], role(`syntax-${token}`));
  }
  set(["--color-syntax-background"], role("code-ground"));
  // A diff's added and removed lines, tints over the code's background, and their `+` and `-`.
  set(["--color-syntax-added"], over(role("added"), dark ? 0.16 : 0.18, role("code-ground")));
  set(["--color-syntax-removed"], over(role("removed"), 0.16, role("code-ground")));
  set(["--color-syntax-added-marker"], role("added"));
  set(["--color-syntax-removed-marker"], role("removed"));

  set(["--color-neutral"], withAlpha(role("ink"), dark ? "1a" : "0f"));
  set(["--color-overlay-hover"], withAlpha(role("ink"), "0d"));
  set(["--color-overlay-pressed"], withAlpha(role("ink"), "1a"));
  // A scrim: dialogs' backdrop, and under the on-dark icon over media, 3:1 over a white image.
  set(["--color-overlay"], dark ? withAlpha(role("sunken"), "cc") : withAlpha(role("ink"), "b3"));
  set(["--color-shadow"], dark ? withAlpha(role("sunken"), "4d") : withAlpha(role("ink"), "1a"));

  for (const [name, colour] of Object.entries(roles)) {
    set([`--role-${name}`], colour);
  }
  for (const name of TINTED) {
    set([`--role-${name}-tint`], tint(name));
  }
  return tokens;
}
