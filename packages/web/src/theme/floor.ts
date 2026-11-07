// The floor step of a shipped theme (R4): a colour under the contrast floor ships as the first step,
// 1% of HSL lightness at a time from its published colour, at which every pair its roles are in
// passes, hue and saturation kept. Used by `scripts/theme-floor.ts`, which prints a theme's floor
// entries, and checked by `theme-roles.test.ts`.
import { failures } from "./pairs.ts";
import { type Mode, type Roles, tokensOf } from "./roles.ts";

/** A `#rrggbb` colour's HSL hue (0 to 360), saturation, and lightness (0 to 100). */
export function hslOf(colour: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(colour.slice(at, at + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const [high, low] = [Math.max(r, g, b), Math.min(r, g, b)];
  const lightness = (high + low) / 2;
  const span = high - low;
  if (span === 0) {
    return [0, 0, lightness * 100];
  }
  const saturation = span / (1 - Math.abs(2 * lightness - 1));
  const sector =
    high === r ? (g - b) / span + 6 : high === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return [(((sector * 60) % 360) + 360) % 360, saturation * 100, lightness * 100];
}

/** The `#rrggbb` colour of an HSL hue, saturation, and lightness. */
export function fromHsl(hue: number, saturation: number, lightness: number): string {
  const [s, l] = [saturation / 100, lightness / 100];
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = l - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * The first colour, from `colour`'s lightness rounded to a whole percent and 1% at a time `away`,
 * hue and saturation kept, that `passes`.
 */
export function floorStep(
  colour: string,
  passes: (colour: string) => boolean,
  away: "lighter" | "darker",
): string {
  const [hue, saturation, lightness] = hslOf(colour);
  const step = away === "lighter" ? 1 : -1;
  for (let at = Math.round(lightness); at >= 0 && at <= 100; at += step) {
    const candidate = fromHsl(hue, saturation, at);
    if (passes(candidate)) {
      return candidate;
    }
  }
  throw new Error(`No step of ${colour} reaches the floor`);
}

/**
 * Roles drawn behind others, or on a fill: an entry they share with a text role keeps its published
 * colour for them, and only the text roles move to its floor step.
 */
export const GROUNDS: ReadonlySet<string> = new Set([
  "page",
  "raised",
  "sunken",
  "chip",
  "cursor-row",
  "code-ground",
  "on-action",
]);

/** A theme as the core gives it: its mode, its roles, and the palette entry each role names. */
type Shipped = {
  mode: string;
  roles: Roles;
  sources: Readonly<Record<string, string>>;
};

/** The theme's roles, every one naming `entry` drawn in `colour`, its grounds kept. */
function withEntry(theme: Shipped, entry: string, colour: string): Roles {
  return Object.fromEntries(
    Object.entries(theme.roles).map(([role, value]) => [
      role,
      theme.sources[role] === entry && !GROUNDS.has(role) ? colour : value,
    ]),
  );
}

/**
 * Whether every pair a role naming the palette `entry` is in passes, the entry drawn in `colour`.
 * Pairs whose tokens no such role sets are left out, so a theme's other failures do not count.
 */
export function entryPasses(theme: Shipped, entry: string, colour: string): boolean {
  const mode = theme.mode as Mode;
  const [black, white] = ["#000000", "#ffffff"].map((each) =>
    tokensOf(withEntry(theme, entry, each), mode),
  );
  const fed = (token: string) => black![token] !== white![token];
  return failures(tokensOf(withEntry(theme, entry, colour), mode)).every(
    ({ back, front }) => !fed(back) && !fed(front),
  );
}
