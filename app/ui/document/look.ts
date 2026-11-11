// How a document reads: prose in the reading font, one step over the interface's size, on its
// line, at a measure of about 80 characters; headings in the heading font, in their level's colour,
// with air above them; code in the code font, on the interface's line.
import type { TextStyle } from "nsh";
import { tokens } from "../tokens";

/** The width of a line of about 80 characters of prose, in points. */
export const measure = () => tokens.type.measure * tokens.type.prose;

/** Room between two blocks; a heading takes more above it, by its level. */
export const BLOCK_GAP = 14;
export const HEADING_AIR: Record<number, number> = { 1: 22, 2: 18, 3: 10 };

/** Prose: a paragraph, an item's text, a callout's, a quote's. */
export function prose(colour = tokens.role.ink): TextStyle {
  return {
    color: colour,
    fontFamily: tokens.type.reading,
    fontSize: tokens.type.prose,
    lineHeight: tokens.type.proseLine,
    userSelect: "text",
  };
}

/** A heading of `level`: 22 px for the first, 18 for the others, bold, in its level's colour. */
export function heading(level: number): TextStyle {
  const colour =
    level <= 1
      ? tokens.role.heading1
      : level === 2
        ? tokens.role.heading2
        : level === 3
          ? tokens.role.heading3
          : tokens.role.ink;
  return {
    color: colour,
    fontFamily: tokens.type.heading,
    fontSize: level <= 1 ? tokens.type.over2 : tokens.type.over,
    fontWeight: "700",
    lineHeight: tokens.type.proseLine,
    userSelect: "text",
  };
}

/** Code: a block's text, and a table's, one step under prose, on the interface's line. */
export function code(): TextStyle {
  return {
    color: tokens.role.ink,
    fontFamily: tokens.type.code,
    fontSize: tokens.type.size,
    lineHeight: tokens.type.line,
    userSelect: "text",
  };
}

/** A table's words: the reading font, at the interface's size, so a row holds more. */
export function cell(): TextStyle {
  return {
    color: tokens.role.ink,
    fontFamily: tokens.type.reading,
    fontSize: tokens.type.size,
    lineHeight: tokens.type.line,
    userSelect: "text",
  };
}
