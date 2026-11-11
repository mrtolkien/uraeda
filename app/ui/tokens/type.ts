// Type: the family of each part, and the short scale of sizes. Monospace is the default voice, and
// hierarchy comes from colour and weight before size.
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
    size: 13,
    line: 20,
    /** Long prose. */
    prose: 15,
    proseLine: 24,
    under: 12,
    over: 15,
    over2: 18,
  };
}
