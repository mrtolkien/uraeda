// A review's comments written, edited, and removed: each write answers its change, which the app's
// undo stack keeps with words a person would say, so `u` takes it back from any page. A removal
// says so in a toast, its comment gone from view; an addition or an edit shows in place, and the
// stack keeps it quietly.
import { call } from "../../store";
import type { CommentItem } from "../../store/protocol";
import type { FileArgs } from "../file/read";
import { remember } from "../shell/undoStack";

/** Where a comment points, as a person says it: "Architecture", "the whole spec". */
const placeWords = (args: FileArgs, heading: string | null, general: boolean) =>
  general ? `the whole ${args.name === "plan.md" ? "plan" : "spec"}` : (heading ?? "its title");

const whereOf = (args: FileArgs) => ({ file: args.name, folder: args.folder, repo: args.repo });

const options = (args: FileArgs, text: string, quiet = false) => ({
  quiet,
  repo: args.repo,
  subject: text,
});

/** Adds a comment on lines of the file, or the general one with no lines. */
export async function addComment(
  args: FileArgs,
  lines: { endLine: number; startLine: number } | null,
  heading: string | null,
  text: string,
) {
  const written = await call("review.comment", { ...whereOf(args), ...lines, text });
  const on = placeWords(args, heading, lines === null);
  remember(written.change, `Commented on ${on}.`, options(args, text, true));
}

/** Writes a pending comment's new text. */
export async function editComment(args: FileArgs, comment: CommentItem, text: string) {
  const where = { ...whereOf(args), number: comment.number };
  const written = await call("review.edit", { ...where, text });
  const on = placeWords(args, comment.heading, comment.general);
  remember(written.change, `Edited your comment on ${on}.`, options(args, text, true));
}

/** Removes a pending comment: the toast says so, with its Undo. */
export async function removeComment(args: FileArgs, comment: CommentItem) {
  const written = await call("review.remove", { ...whereOf(args), number: comment.number });
  const on = placeWords(args, comment.heading, comment.general);
  remember(written.change, `Removed your comment on ${on}.`, options(args, comment.text));
}
