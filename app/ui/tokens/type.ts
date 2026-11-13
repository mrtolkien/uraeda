// Type: the family of each part, and the short scale of sizes, 13, 15, 18, and 22 px. Monospace
// is the default voice, and hierarchy comes from colour and weight before size.
import { type FontRole, type Fonts, fontOf } from "./fonts";

export function type(fonts: Fonts) {
  const family = (role: FontRole) => fontOf(role, fonts[role]).family;
  return {
    /** The interface: the sidebar, the status line, buttons, panes' titles, and lists. */
    body: family("body"),
    heading: family("heading"),
    /** Long prose. */
    reading: family("reading"),
    /** Code, paths, and keys. */
    code: family("code"),
    /** The text typed in a field. */
    markdown: family("markdown"),
    /** How many of `prose` a line of about 80 characters takes, in the reading font. */
    measure: fontOf("reading", fonts.reading).measure,
    /** The reading size of the interface, with its line. */
    size: 15,
    line: 24,
    /** Long prose: one step over the reading size, with its line. */
    prose: 18,
    proseLine: 28,
    /** One step under, for what reads second. */
    under: 13,
    /** One and two steps over, for titles. */
    over: 18,
    over2: 22,
  };
}
