// WCAG contrast of opaque colours, from channels between 0 and 1.

/** A channel of a colour, from 0 to 1, without its gamma. */
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** A colour's relative luminance, as WCAG counts it. */
export function luminance([r, g, b]: [number, number, number]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The contrast ratio of two opaque colours, from 1 to 21. */
export function contrast(a: [number, number, number], b: [number, number, number]) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}
