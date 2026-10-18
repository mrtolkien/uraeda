import type { CommentItem, Document } from "uraeda-binding";
import { readUnsaved, type Unsaved, unsavedKey, writeUnsaved } from "./fields/unsaved.ts";
import { selectable } from "./Selection.tsx";
import type { CommentDraft, Last, Range } from "./useCommentDraft.ts";

/**
 * The field keys of a review's comment: a new one, on lines or the whole file, whose lines are in
 * its entry's `extra`, or an edit of comment `number`.
 */
export const reviewKey = (path: string) => `${path}#review`;
export const reviewEditKey = (path: string, number: number) => `${path}#review-edit:${number}`;

/** The block a comment on lines shows under: the smallest tappable block holding its last line. */
export function holderOf(tree: Document, line: number) {
  return tree.blocks
    .filter((b) => selectable(b) && b.startLine <= line && line <= b.endLine)
    .sort((a, b) => a.endLine - a.startLine - (b.endLine - b.startLine))[0];
}

/** Lines as a review names them: `lines 40–52`, or `line 40`. */
export const linesOf = ({ end, start }: { end: number; start: number }) =>
  start === end ? `line ${start}` : `lines ${start}–${end}`;

/**
 * Lines as a review comment names them: `lines 40–52`, or, of a decision, `decision git, lines
 * 15–16`, with ` removed` after a removed part's lines.
 */
export function placeOfLines({ decision, ...lines }: Omit<Range, "heading">) {
  return decision
    ? `decision ${decision.name}, ${linesOf(lines)}${decision.removed ? " removed" : ""}`
    : linesOf(lines);
}

/**
 * Where a review comment points, kept with its edit as the comment it is of: `general`, or its
 * lines, those of a decision named with it, so the edit of a comment on the spec's lines is never
 * taken for one on a decision's same lines. Its number changes as comments before it go.
 */
export const placeOf = (comment: CommentItem) =>
  comment.general
    ? "general"
    : placeOfLines({
        decision:
          comment.decision === undefined
            ? undefined
            : { name: comment.decision, removed: comment.removed },
        end: comment.endLine,
        start: comment.startLine,
      });

/** The comment that held unsaved text when the review was drawn, opened again to restore it. */
export type Restored = {
  draft: CommentDraft;
  /** The block or the decision's part it opens under, on lines. */
  last?: Last;
  selection?: Range;
  /** Its entry, on lines of a commit no longer reviewed: written again as a general comment. */
  stale?: { key: string; value: Unsaved };
};

/**
 * The comment a review opens as it is drawn: the one last typed of those whose text the store
 * keeps, a new one or an edit of a pending comment. A new one on lines of the reviewed commit
 * opens on them; on lines of an older one, it becomes a general comment, `stale`. An edit kept for
 * a number now another comment's, pointing elsewhere, does not open: its text stays in the browser.
 */
export function restoredComment(
  repo: string,
  path: string,
  tip: string,
  comments: ReadonlyArray<CommentItem>,
  tree: Document,
): Restored | undefined {
  const kept = [
    {
      draft: { kind: "lines" } as CommentDraft,
      key: unsavedKey(repo, reviewKey(path)),
      place: undefined,
    },
    ...comments.map((comment) => ({
      draft: { kind: "edit", number: comment.number } as CommentDraft,
      key: unsavedKey(repo, reviewEditKey(path, comment.number)),
      place: placeOf(comment),
    })),
  ]
    .flatMap(({ draft, key, place }) => {
      const entry = readUnsaved(key);
      const ofIt = entry?.subject === undefined || entry.subject === place;
      return entry && ofIt ? [{ draft, entry, key }] : [];
    })
    .sort((a, b) => b.entry.at.localeCompare(a.entry.at))[0];
  if (!kept) {
    return undefined;
  }
  const { draft, entry, key } = kept;
  if (draft.kind === "edit") {
    return { draft };
  }
  const lines = entry.extra;
  if (!lines) {
    return { draft: { kind: "general" } };
  }
  if (lines.commit !== tip) {
    return { draft: { kind: "general" }, stale: { key, value: entry } };
  }
  const { decision, end, heading, start } = lines;
  const selection = { decision, end, heading, start };
  const last = decision
    ? { decision: decision.name, line: end, removed: decision.removed }
    : holderOf(tree, end)?.id;
  return { draft, last, selection };
}

/**
 * Writes a comment restored on lines of an older commit as a general comment, its text starting
 * with the lines it was on, unless it changed since.
 */
export function writeStale({ key, value }: { key: string; value: Unsaved }) {
  const now = readUnsaved(key);
  if (!now?.extra || now.text !== value.text || !value.extra) {
    return;
  }
  writeUnsaved(key, {
    at: now.at,
    base: now.base,
    text: `On ${placeOfLines(value.extra)} of the previous version: ${now.text}`,
  });
}

/**
 * Moves the unsaved text of a new comment to other lines, or to the whole file without them, as a
 * tap or "Add a general comment" does: nothing is kept for a comment with no text.
 */
export function reanchor(key: string, extra: Unsaved["extra"]) {
  const entry = readUnsaved(key);
  if (!entry) {
    return;
  }
  const { extra: _before, ...rest } = entry;
  writeUnsaved(key, extra ? { ...rest, extra } : rest);
}
