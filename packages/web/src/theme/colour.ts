// Colour arithmetic of the theme's build (`theme.ts`): a tint mixed into a plain `#rrggbb`, which
// the build writes as it is.

/** A `#rrggbb` colour's red, green, and blue, from 0 to 255. */
const channels = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));

/** `colour` at `share` over `under`, as `#rrggbb`: a tint the build writes as a plain colour. */
export function mix(colour: string, share: number, under: string) {
  const [top, bottom] = [channels(colour), channels(under)];
  return `#${top
    .map((value, at) => Math.round(value * share + bottom[at]! * (1 - share)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}
