// An icon: Lucide's, or a harness's mark (`icons/`). An `<Image>` draws an SVG's shapes, with no
// CSS variable, so each icon is an SVG made for its colour and size: the colour is in the picture.
import { Image, type StyleProp, type ViewStyle } from "nsh";
import { LUCIDE, type LucideName } from "./icons/lucide";
import { MARKS, type MarkName, STROKED_MARKS } from "./icons/marks";
import { tokens } from "../tokens";

/** An icon's name: Lucide's own, `file-text`, or a mark's, `claude`, `openai`, `pi`. */
export type IconName = LucideName | MarkName;

/** Whether the app carries an icon of that name. */
export const isIconName = (name: string): name is IconName =>
  Object.hasOwn(LUCIDE, name) || Object.hasOwn(MARKS, name) || Object.hasOwn(STROKED_MARKS, name);

/**
 * The icon of a name read at run time, as a decision's frontmatter gives one, or the server's
 * name of an agent's mark, `uraeda:harness-claude`: `fallback` for a name the app does not carry.
 */
export function iconNamed(name: string | null | undefined, fallback: IconName = "file-text") {
  const bare = name?.replace(/^uraeda:(harness-)?/, "");
  return bare != null && isIconName(bare) ? bare : fallback;
}

/** The SVG of an icon in one colour, at its size. */
export function svgOf(name: IconName, colour: string, size: number): string {
  const head = `xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`;
  if (Object.hasOwn(MARKS, name)) {
    const mark = MARKS[name as keyof typeof MARKS];
    return `<svg ${head} viewBox="0 0 ${mark.grid} ${mark.grid}" fill="${colour}">${mark.shapes}</svg>`;
  }
  const shapes =
    (LUCIDE as Record<string, string>)[name] ?? (STROKED_MARKS as Record<string, string>)[name];
  return (
    `<svg ${head} viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`
  );
}

export type IconProps = {
  /** Its colour: the quiet ink unless given, a tone's or a kind's hue otherwise. */
  colour?: string;
  name: IconName;
  /** In points: 16, the icon beside a line of text. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The picture of each icon drawn so far, by name, colour, and size: a list's row is bound again
 * as it scrolls, and builds the same few pictures over and over.
 */
const pictures = new Map<string, string>();

/** The `src` of an icon in one colour, at its size. */
function pictureOf(name: IconName, colour: string, size: number): string {
  const key = `${name} ${colour} ${size}`;
  let src = pictures.get(key);
  if (src === undefined) {
    src = `data:image/svg+xml,${encodeURIComponent(svgOf(name, colour, size))}`;
    pictures.set(key, src);
  }
  return src;
}

export function Icon(props: IconProps) {
  const size = () => props.size ?? tokens.control.icon;
  return (
    <Image
      src={pictureOf(props.name, props.colour ?? tokens.role.inkQuiet, size())}
      style={[{ flexShrink: 0, height: size(), width: size() }, props.style]}
      testID={props.testID}
    />
  );
}
