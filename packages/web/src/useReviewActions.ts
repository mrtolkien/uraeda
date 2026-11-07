import { startTransition, useEffect, useOptimistic, useRef } from "react";
import { useFateClient, view } from "react-fate";
import type { WorkflowFile } from "uraeda-server/fate";
import type { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import {
  dropUnsaved,
  readUnsaved,
  renumberUnsaved,
  unsavedKey,
  writeUnsaved,
} from "./fields/unsaved.ts";
import { filePage } from "./readAhead.ts";
import { reviewEditKey } from "./reviewField.ts";
import { quoteOfRange } from "./reviewQuote.ts";
import { useRepository, useRepositoryPath } from "./routes.tsx";
import type { useRefusals } from "./ReviewVerdict.tsx";
import { changeEntry } from "./undo/changeEntry.ts";
import { useUndo } from "./undo/useUndo.ts";
import type { Range, useCommentDraft } from "./useCommentDraft.ts";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;
type Draft = ReturnType<typeof useCommentDraft>;
type Refusals = ReturnType<typeof useRefusals>;
type Fate = ReturnType<typeof useFateClient>;
/** The reviewed file, by its feature's folder and its name. */
type Reviewed = Pick<File, "folder" | "name">;

/** A new comment being added: its text, and its lines, if on lines. */
export type Adding = { range?: Range; text: string };

/** The reviewed file as a review's write answers it, with the change the undo stack takes. */
export const ReviewChangeView = view<WorkflowFile>()({
  ...FileView,
  change: { commit: true, files: true },
});

/** A review write's answer, as the stack records it. */
type Answer = { result?: { change?: Parameters<typeof changeEntry>[1] | null } | null };

/** What the refusal of a comment's undo names: its first line, "“Say it stays.” changed since". */
const subjectOf = (text: string) => text.trim().split("\n")[0] ?? "";

/** What the refusal of Start over's undo names: the whole review. */
const REVIEW_SUBJECT = "Your review";

/** Moves the edits kept for comments `number` to `count` one number on, as comment `number` is back. */
function followRestored(keyOf: (number: number) => string, number: number, count: number) {
  for (let at = count; at >= number; at -= 1) {
    const entry = readUnsaved(keyOf(at));
    if (entry) {
      writeUnsaved(keyOf(at + 1), entry);
      dropUnsaved(keyOf(at));
    }
  }
}

/**
 * Records a review's write that answered its change on the tab's undo stack, as `label`, at the
 * reviewed file's page: each undo and redo reads the file again, so the page shows its comments as
 * they now are, then runs `after`'s side, which keeps the comments typed but not sent with theirs.
 */
function useRecord(file: Reviewed) {
  const fate = useFateClient();
  const record = useUndo();
  const repo = useRepository();
  return (
    answer: Answer,
    label: string,
    subject: string,
    after: { redo?: () => void; undo?: () => void } = {},
  ) => {
    const change = answer.result?.change;
    if (!change) {
      return;
    }
    const place = { path: `/f/${file.folder}/${file.name}`, repo };
    const entry = changeEntry(fate, change, label, place, subject);
    const replayed = (replay: () => Promise<string | undefined>, then?: () => void) => async () => {
      const refused = await replay();
      await reread(fate, file);
      if (refused === undefined) {
        then?.();
      }
      return refused;
    };
    record({
      ...entry,
      redo: replayed(entry.redo, after.redo),
      undo: replayed(entry.undo, after.undo),
    });
  };
}

/**
 * Records a new comment on `file`, its text `text`, once `review.comment` answered `answer`
 * through `ReviewChangeView`: "Added a comment", as the review page's own comments are, for the
 * other forms that comment on a review, the mockup page's and an embedded story's.
 */
export function useRecordComment(file: Reviewed) {
  const recorded = useRecord(file);
  return (answer: Answer, text: string) => recorded(answer, "Added a comment", subjectOf(text));
}

/** Reads the reviewed file again, once an undo or a redo wrote it: a failed read changes nothing. */
async function reread(fate: Fate, file: Reviewed) {
  await fate
    .request(filePage(file.folder, file.name), { mode: "network-only" })
    .catch(() => undefined);
}

/** Runs `call` through the refusals' `run`: its answer once done, or nothing once refused. */
async function ran<T extends { error?: unknown }>(run: Refusals["run"], call: () => Promise<T>) {
  let answer: T | undefined;
  const done = await run(async () => {
    answer = await call();
    return answer;
  });
  return done ? answer : undefined;
}

/**
 * Removes a comment, by its number: the edits kept for the comments after it, and the one open,
 * follow their numbers, back again on its undo, and on again on its redo; the comment's own edit
 * kept, typed but not sent, goes with it, and comes back with it on its undo.
 */
function useRemove(file: File, commentDraft: Draft, run: Refusals["run"]) {
  const fate = useFateClient();
  const repo = useRepositoryPath();
  const recorded = useRecord(file);
  // The comment being written now, which an undo or a redo after the page drew again follows.
  const latest = useRef(commentDraft);
  useEffect(() => {
    latest.current = commentDraft;
  }, [commentDraft]);
  return async (number: number) => {
    const comments = file.review?.review?.comments ?? [];
    const count = comments.length;
    const text = comments.find((c) => c.number === number)?.text ?? "";
    const keyOf = (n: number) => unsavedKey(repo, reviewEditKey(file.path, n));
    // The removed comment's own edit, typed but not sent, which its undo puts back.
    let own: ReturnType<typeof readUnsaved>;
    const removing = () => {
      own = readUnsaved(keyOf(number));
      renumberUnsaved(keyOf, number, count);
      latest.current.removed(number);
    };
    const answer = await ran(run, () =>
      fate.mutations.review.remove({
        input: { file: file.name, folder: file.folder, number },
        view: ReviewChangeView,
      }),
    );
    if (answer) {
      removing();
      recorded(answer, "Removed a comment", subjectOf(text), {
        redo: removing,
        undo: () => {
          followRestored(keyOf, number, count - 1);
          if (own) {
            writeUnsaved(keyOf(number), own);
          }
          const { draft, start } = latest.current;
          if (draft?.kind === "edit" && draft.number >= number) {
            start({ kind: "edit", number: draft.number + 1 });
          }
        },
      });
    }
  };
}

/**
 * What a review sends: a comment on the selected lines or the whole file, an edit of one, its
 * removal, a general comment from the end's own field, and starting over; and, with `onAsk`, Ask the agent, which hands it the selected lines
 * quoted, as they read in the reviewed file, or a decision's parts, as they read in its own. A new
 * comment is `adding` from its "Add comment" until the review file holds it, its form hidden:
 * refused, the form shows again, with the error. Each write lands on the tab's undo stack.
 */
export function useReviewActions(
  file: File,
  commentDraft: Draft,
  { run }: Refusals,
  onAsk?: (quote: string) => void,
) {
  const { close, draft, selection } = commentDraft;
  const fate = useFateClient();
  const recorded = useRecord(file);
  const recordComment = useRecordComment(file);
  const remove = useRemove(file, commentDraft, run);
  // Shown from "Add comment" until the comment is written, in a transition of its own.
  const [adding, setAdding] = useOptimistic<Adding | undefined>(undefined);
  const input = { file: file.name, folder: file.folder };
  const comment = async (text: string, extent: object) => {
    const result = await fate.mutations.review.comment({
      input: { ...input, text, ...extent },
      view: ReviewChangeView,
    });
    recordComment(result, text);
    return result;
  };
  const add = (text: string) => {
    const range = draft?.kind === "lines" ? selection : undefined;
    return new Promise<{ error?: unknown }>((resolve) =>
      startTransition(async () => {
        setAdding({ range, text });
        const extent = range
          ? { decision: range.decision, endLine: range.end, startLine: range.start }
          : {};
        resolve(await comment(text, extent));
      }),
    );
  };
  const edit = async (number: number, text: string) => {
    const result = await fate.mutations.review.edit({
      input: { ...input, number, text },
      view: ReviewChangeView,
    });
    recorded(result, "Edited a comment", subjectOf(text));
    return result;
  };
  const send = async (written: string) => {
    if (!draft) {
      return undefined;
    }
    const result = draft.kind === "edit" ? await edit(draft.number, written) : await add(written);
    if (result.error) {
      return refusal(result.error).message;
    }
    close();
    return undefined;
  };
  const ask =
    onAsk &&
    ((range: Range) => onAsk(quoteOfRange(file, (file.committed ?? file.current).text, range)));
  /** Adds a general comment, from the end's own field: the error to show, or nothing once written. */
  const general = async (text: string) => {
    const result = await comment(text, {});
    return result.error ? refusal(result.error).message : undefined;
  };
  const startOver = async () => {
    const answer = await ran(run, () =>
      fate.mutations.review.startOver({ input, view: ReviewChangeView }),
    );
    if (answer) {
      recorded(answer, "Started the review over", REVIEW_SUBJECT);
    }
  };
  return { adding, ask, general, remove, send, startOver };
}
