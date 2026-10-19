// Colour maths for the browser tests: a computed colour as numbers, and the contrast of two.

/** A computed colour's red, green, and blue, from 0 to 1, whatever the form WebKit gives it in. */
export function rgb(colour: string): [number, number, number] {
  const numbers = [...colour.matchAll(/[\d.]+/g)].map((match) => Number(match[0]));
  const scale = colour.startsWith("color(") ? 1 : 255;
  return [numbers[0]! / scale, numbers[1]! / scale, numbers[2]! / scale];
}

/** A colour's red, green, blue, and alpha, from 0 to 1, whatever the form WebKit gives it in. */
export function rgba(colour: string): [number, number, number, number] {
  if (colour === "transparent") {
    return [0, 0, 0, 0];
  }
  const [r, g, b] = rgb(colour);
  const numbers = [...colour.matchAll(/[\d.]+/g)].map((match) => Number(match[0]));
  return [r, g, b, numbers.length > 3 ? numbers[3]! : 1];
}

/** Whether an element has a background of its own. */
export const tinted = (element: Element) => rgba(getComputedStyle(element).backgroundColor)[3] > 0;

/** `top` laid over `bottom`, an opaque colour, by its alpha. */
export function over(top: string, bottom: [number, number, number]): [number, number, number] {
  const [r, g, b, a] = rgba(top);
  return [r * a + bottom[0] * (1 - a), g * a + bottom[1] * (1 - a), b * a + bottom[2] * (1 - a)];
}

/** The opaque colour behind an element's content: its background over those of the boxes around it. */
export function backdrop(element: Element | null): [number, number, number] {
  const layers: Array<string> = [];
  for (let at = element; at; at = at.parentElement) {
    layers.push(getComputedStyle(at).backgroundColor);
  }
  return layers.reduceRight<[number, number, number]>(
    (below, layer) => over(layer, below),
    [1, 1, 1],
  );
}

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
