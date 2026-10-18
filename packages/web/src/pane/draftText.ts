// A draft's or a proposal's text as its edit box holds it: the text after its frontmatter, which
// the controls above the box set, like the discovery effort. A save joins the frontmatter back.

/** A draft's fields the split reads: its text, and its frontmatter's lines from the core. */
type Read = {
  document: { frontmatterLines?: { end: number } | null };
  text: string;
} | null;

/**
 * A file's text as its field holds it: a text field's value has LF line breaks, whatever the file
 * has, and the cursor's positions count them so (R50).
 */
export const asTyped = (text: string) => text.replaceAll(/\r\n?/g, "\n");

/** The line that opens and closes a frontmatter. */
const FENCE = "---";

/**
 * `text` cut after line `end`, and the blank lines after it: the head the box hides, kept byte for
 * byte, and the text it holds. Without `end`, the head is empty.
 */
function cut(text: string, end: number | undefined) {
  if (end === undefined) {
    return { body: text, head: "" };
  }
  const lines = text.split("\n");
  let at = end;
  while (at < lines.length - 1 && lines[at]?.trim() === "") {
    at += 1;
  }
  if (at >= lines.length) {
    // Only a frontmatter: its head ends its line, whether the file did or not, for the typed text
    // to start the next one.
    return { body: "", head: text.endsWith("\n") ? text : `${text}\n` };
  }
  return { body: lines.slice(at).join("\n"), head: `${lines.slice(0, at).join("\n")}\n` };
}

/** A draft's text, its line breaks as typed, cut after the frontmatter the core found. */
export function splitDraft(draft: Read | undefined) {
  return cut(asTyped(draft?.text ?? ""), draft?.document.frontmatterLines?.end ?? undefined);
}

/** A line a frontmatter may hold: a field, a list item or a continued value, a comment, or a blank. */
const FIELD = /^([A-Za-z_][\w-]*:(\s|$)|\s+\S|- |#|\s*$)/;

/**
 * The text an editor stored before its box hid the frontmatter, without it: `undefined` when
 * `text` opens no frontmatter. The core's lines are the file's, which may have changed since: the
 * stored text's own closing line ends it. Text opening with a thematic break, `---`, around lines
 * that are no fields is a body, not a frontmatter.
 */
export function storedBody(text: string): string | undefined {
  const lines = text.split("\n");
  if (lines[0] !== FENCE) {
    return undefined;
  }
  const closing = lines.indexOf(FENCE, 1);
  if (closing === -1 || !lines.slice(1, closing).every((line) => FIELD.test(line))) {
    return undefined;
  }
  return cut(text, closing + 1).body;
}
