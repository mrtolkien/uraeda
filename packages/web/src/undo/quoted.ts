// How a label names a row: its text in quotes, cut to its first words, shared by every page's
// entries on the undo stack.

/** The longest text a label quotes whole: a toast is no place for a whole line. */
const LONGEST = 40;

/** A row's text in a label, “Color themes”: its first words, ending in "…", past 40 characters. */
export function quoted(text: string) {
  const short = text.length > LONGEST ? `${text.slice(0, LONGEST - 1).trimEnd()}…` : text;
  return `“${short}”`;
}
