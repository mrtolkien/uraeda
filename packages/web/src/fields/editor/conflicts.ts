// The conflicts git wrote into a file, found in the text being edited, as the conflict bar offers
// them: each block from its `<<<<<<< ` line to its `>>>>>>> ` line, its two sides between, the base
// section `diff3` adds after `||||||| ` dropped. The core tells a file resolved by the same marker
// lines (ruling R4); this reads the text before it is saved. A side's own line that looks like a
// marker is taken for one, as git's markers cannot tell them apart: a quoted `<<<<<<< ` line opens
// the block at it, the one before left as text, and a Markdown heading's `=======` underline in
// the first side parts the sides there. The text stays editable for those.

/**
 * A conflict's block: `from`, the start of its `<<<<<<< ` line, and `to`, the end of its `>>>>>>> `
 * line, its line break included; `ours`, git's stage 2, and `theirs`, its stage 3, each its lines
 * with their line breaks.
 */
export type ConflictBlock = { from: number; ours: string; theirs: string; to: number };

/** What replaces a block: one side's lines, or both, ours first. */
export type ConflictChoice = "both" | "ours" | "theirs";

/** A line of the text: its content without its line break, and where it starts and ends. */
type Line = { end: number; start: number; text: string };

/** The text's lines, `end` past each one's line break, `\n` or `\r\n`. */
function linesOf(text: string): Array<Line> {
  const lines: Array<Line> = [];
  let start = 0;
  while (start < text.length) {
    const next = text.indexOf("\n", start);
    const end = next === -1 ? text.length : next + 1;
    const content = text.slice(start, next === -1 ? end : next);
    lines.push({ end, start, text: content.endsWith("\r") ? content.slice(0, -1) : content });
    start = end;
  }
  return lines;
}

const isOpen = (line: Line) => line.text.startsWith("<<<<<<< ") || line.text === "<<<<<<<";
const isBase = (line: Line) => line.text.startsWith("||||||| ") || line.text === "|||||||";
const isClose = (line: Line) => line.text.startsWith(">>>>>>> ") || line.text === ">>>>>>>";

/** The block opened at `lines[open]`, and the index of its last line, or none when malformed. */
function blockAt(
  text: string,
  lines: ReadonlyArray<Line>,
  open: number,
): { block: ConflictBlock; last: number } | undefined {
  let base: number | undefined;
  let middle: number | undefined;
  for (let at = open + 1; at < lines.length; at += 1) {
    const line = lines[at]!;
    if (isOpen(line)) {
      return undefined;
    }
    if (middle === undefined && base === undefined && isBase(line)) {
      base = at;
    } else if (middle === undefined && line.text === "=======") {
      middle = at;
    } else if (middle !== undefined && isClose(line)) {
      const oursEnd = lines[base ?? middle]!.start;
      return {
        block: {
          from: lines[open]!.start,
          ours: text.slice(lines[open]!.end, oursEnd),
          theirs: text.slice(lines[middle]!.end, line.start),
          to: line.end,
        },
        last: at,
      };
    }
  }
  return undefined;
}

/** The conflicts' blocks of `text`, in order: none when it has no complete one. */
export function conflictsIn(text: string): ReadonlyArray<ConflictBlock> {
  const lines = linesOf(text);
  const blocks: Array<ConflictBlock> = [];
  for (let at = 0; at < lines.length; at += 1) {
    const found = isOpen(lines[at]!) ? blockAt(text, lines, at) : undefined;
    if (found) {
      blocks.push(found.block);
      at = found.last;
    }
  }
  return blocks;
}

/** The line break the side's last line ends with, if any. */
const breakOf = (side: string) =>
  side.endsWith("\r\n") ? "\r\n" : side.endsWith("\n") ? "\n" : "";

/** `block`'s lines as `choice` takes them: a block that ends the file leaves no line break after. */
export function chosenLines(text: string, block: ConflictBlock, choice: ConflictChoice): string {
  const lines =
    choice === "ours" ? block.ours : choice === "theirs" ? block.theirs : block.ours + block.theirs;
  const atEnd = block.to === text.length && !text.endsWith("\n");
  return atEnd ? lines.slice(0, lines.length - breakOf(lines).length) : lines;
}

/** `text` with `block` replaced by its side `choice`, or both, keeping the file's line endings. */
export function resolveBlock(text: string, block: ConflictBlock, choice: ConflictChoice): string {
  return text.slice(0, block.from) + chosenLines(text, block, choice) + text.slice(block.to);
}
