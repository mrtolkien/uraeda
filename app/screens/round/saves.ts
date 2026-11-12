// A round's writes, in the order the human made them: its answers, its notes, its settled points'
// comments, and its submit. A round is a feature's, `<folder>/clarifications-NN.md`, or one of the
// default branch, the inbox's triage or the decisions check, which take other actions and chain
// the round's hash. Each save takes what the one before it wrote, not what the record said when
// the human acted: the record catches up a moment later. One queue per round, kept for the run of
// the app, out of any pane: a pane moved or a tab hidden loses no save on its way.
import { type Accessor, signal, untracked } from "nsh";
import { call } from "../../store";
import type { FileView, QuestionItem, SettledComment, WriteName } from "../../store/protocol";
import { readUnsaved, settleUnsaved, unsavedKey } from "../../ui/text";
import { type Ask, useAsk } from "../session";
import { remember } from "../shell/undo";

/** A round, as the record `WorkflowFile` names it: `<folder>/<name>`, or `inbox-triage`. */
export type RoundArgs = { repo: string; id: string };

/** A round of the default branch has an id, a feature's a folder and a file's name. */
export type Target =
  | { kind: "feature"; repo: string; folder: string; name: string }
  | { kind: "default"; repo: string; id: string };

export function targetOf(args: RoundArgs): Target {
  const slash = args.id.lastIndexOf("/");
  return slash === -1
    ? { id: args.id, kind: "default", repo: args.repo }
    : {
        folder: args.id.slice(0, slash),
        kind: "feature",
        name: args.id.slice(slash + 1),
        repo: args.repo,
      };
}

/** How a round asks its feature's agent: a round of the default branch has no feature to ask. */
export function askOf(args: RoundArgs): () => Ask | undefined {
  const target = targetOf(args);
  return target.kind === "feature" ? useAsk(args.repo, target.folder) : () => undefined;
}

/** The file's path a round's fields keep their unsaved text under. */
export const fieldKey = (args: RoundArgs, path: string, field: string) =>
  unsavedKey(args.repo, `${path}#${field}`);

/** The field of a settled point's comment, under the round's file. */
export const settledField = (subject: string) => `settled:${subject}`;

/** An answer: the letters picked, and the comment. */
export type Answer = { comment: string; letters: ReadonlyArray<string> };

const sameAnswer = (a: Answer, b: Answer) =>
  a.comment.trim() === b.comment.trim() &&
  a.letters.length === b.letters.length &&
  a.letters.every((letter, index) => letter === b.letters[index]);

export type Saves = {
  /** How many writes are on their way. */
  pending: Accessor<number>;
  /** Saves a question's answer after the writes before it; rejects with the server's words. */
  answer: (question: QuestionItem, answer: Answer) => Promise<void>;
  /** Whether a question has an answer on its way, or written and not shown by the record yet. */
  holds: (question: string) => boolean;
  /** Saves the free notes. */
  notes: (text: string) => Promise<void>;
  /** Adds a comment on a settled point: a feature's round only. */
  settled: (subject: string, text: string) => Promise<void>;
  /** Changes the text of a comment on a settled point: a feature's round only. */
  reword: (comment: SettledComment, text: string) => Promise<void>;
  /** Removes a comment on a settled point, which the undo stack keeps: a feature's round only. */
  unsettle: (comment: SettledComment) => Promise<void>;
  /**
   * Saves every comment typed and not saved yet, each once, then submits the round: its write
   * named `write`, a feature's continuing its implementation with `resumes`.
   */
  submit: (options: { resumes: boolean; write: WriteName }) => Promise<void>;
  /** Hears the record: what it holds wins over a save's answer once it shows it. */
  read: (file: FileView) => void;
};

const all = new Map<string, Saves>();

/** The one queue of a round, made as it is first asked for. */
export function savesOf(args: RoundArgs, file: () => FileView | null | undefined): Saves {
  const key = `${args.repo}\n${args.id}`;
  const known = all.get(key);
  if (known !== undefined) return known;
  const made = createSaves(targetOf(args), args, file);
  all.set(key, made);
  return made;
}

function createSaves(
  target: Target,
  args: RoundArgs,
  file: () => FileView | null | undefined,
): Saves {
  const pending = signal(0);
  let chain: Promise<unknown> = Promise.resolve();
  // What the saves wrote, which the next ones take until the record shows it: each question's
  // answer, the notes, and the round's hash.
  const written = new Map<string, string>();
  let notesWritten: string | undefined;
  let hash: string | undefined;
  // The answer last queued per question: a second save of the same answer is the same save.
  const queued = new Map<string, { answer: Answer; done: Promise<void> }>();

  const now = () => untracked(file) ?? undefined;
  const round = () => now()?.current.items.clarifications;
  const base = () => hash ?? now()?.current.document.hash ?? "";
  const previousOf = (question: string) =>
    written.get(question) ?? round()?.questions.find((one) => one.id === question)?.answer ?? "";
  const notesBefore = () => notesWritten ?? round()?.notes ?? "";
  /** After a refusal, the record is the truth again. */
  const forget = () => {
    written.clear();
    notesWritten = undefined;
    hash = undefined;
  };

  const queue = <T>(run: () => Promise<T>): Promise<T> => {
    pending.update((count) => count + 1);
    const done = chain.then(run).finally(() => pending.update((count) => count - 1));
    chain = done.catch(() => undefined);
    return done.catch((error: unknown) => {
      forget();
      throw error;
    });
  };

  const saveAnswer = (question: string, answer: Answer) =>
    queue(async () => {
      const comment = answer.comment.trim();
      const input = {
        comment,
        letters: [...answer.letters],
        previous: previousOf(question),
        question,
        repo: target.repo,
      };
      const saved =
        target.kind === "feature"
          ? await call("answer.save", { ...input, folder: target.folder })
          : await call("defaultRound.answer", { ...input, base: base(), id: target.id });
      written.set(question, saved.answer);
      hash = saved.hash;
      // The comment typed is in the file now: the device lets it go, unless typed on since.
      settleUnsaved(fieldKey(args, now()?.path ?? "", question), comment);
    });

  const settled = (subject: string, text: string) =>
    queue(async () => {
      if (target.kind !== "feature") throw new Error("This round takes no comments on its points.");
      await call("settled.comment", { folder: target.folder, repo: target.repo, subject, text });
    });

  const unsettle = (comment: SettledComment) =>
    queue(async () => {
      if (target.kind !== "feature") throw new Error("This round takes no comments on its points.");
      const { number, subject, text } = comment;
      const where = { folder: target.folder, repo: target.repo };
      const removed = await call("settled.remove", { ...where, number, previous: text, subject });
      remember(removed.change, `Removed your comment on “${subject}”.`, {
        repo: target.repo,
        subject: text,
      });
    });

  const reword = (comment: SettledComment, text: string) =>
    queue(async () => {
      if (target.kind !== "feature") throw new Error("This round takes no comments on its points.");
      const { number, subject } = comment;
      const where = { folder: target.folder, repo: target.repo };
      await call("settled.edit", { ...where, number, previous: comment.text, subject, text });
    });

  /** Saves an answer, once: the same answer queued and not answered yet is that save. */
  const answer = (question: QuestionItem, value: Answer) => {
    const last = queued.get(question.id);
    if (last !== undefined && sameAnswer(last.answer, value)) return last.done;
    const done = saveAnswer(question.id, value).finally(() => {
      if (queued.get(question.id)?.done === done) queued.delete(question.id);
    });
    queued.set(question.id, { answer: value, done });
    return done;
  };

  return {
    answer,
    notes: (text) =>
      queue(async () => {
        const notes = text.trim();
        if (target.kind === "feature") {
          await call("notes.save", {
            folder: target.folder,
            notes,
            previous: notesBefore(),
            repo: target.repo,
          });
        } else {
          const saved = await call("defaultRound.notes", {
            base: base(),
            id: target.id,
            notes,
            previous: notesBefore(),
            repo: target.repo,
          });
          hash = saved.hash;
        }
        notesWritten = notes;
      }),
    pending,
    read(read) {
      if (untracked(pending) > 0) return;
      const items = read.current.items.clarifications;
      for (const [question, text] of written) {
        const shown = items?.questions.find((one) => one.id === question)?.answer;
        if (shown?.trim() === text.trim()) written.delete(question);
      }
      if (notesWritten !== undefined && (items?.notes ?? "").trim() === notesWritten) {
        notesWritten = undefined;
      }
      if (hash === read.current.document.hash) hash = undefined;
    },
    holds: (question) => queued.has(question) || (written.get(question)?.trim() ?? "") !== "",
    reword,
    settled,
    unsettle,
    async submit(options) {
      // A comment typed and not saved, in any question, is saved first, with its letters.
      const path = now()?.path ?? "";
      const typed = (round()?.questions ?? []).flatMap((question) => {
        const entry = readUnsaved(fieldKey(args, path, question.id));
        if (entry === undefined || entry.text.trim() === question.comment.trim()) return [];
        const letters = queued.get(question.id)?.answer.letters ?? question.letters;
        return [{ answer: { comment: entry.text, letters }, question }];
      });
      // So is a comment on a settled point typed and not saved.
      const subjects = [...new Set((round()?.settledPoints ?? []).map((point) => point.subject))];
      const points = subjects.flatMap((subject) => {
        const key = fieldKey(args, path, settledField(subject));
        const text = readUnsaved(key)?.text.trim() ?? "";
        return text === "" ? [] : [{ key, subject, text }];
      });
      await Promise.all([
        ...typed.map((one) => answer(one.question, one.answer)),
        ...points.map((point) =>
          // Saved as it was when the submit was asked: what was typed on since stays.
          settled(point.subject, point.text).then(() => settleUnsaved(point.key, point.text)),
        ),
      ]);
      await queue(async () => {
        if (target.kind === "feature") {
          await call("answers.submit", {
            file: target.name,
            folder: target.folder,
            repo: target.repo,
            resumes: options.resumes,
            write: options.write,
          });
        } else {
          await call("defaultRound.submit", {
            id: target.id,
            previous: base(),
            repo: target.repo,
            write: options.write,
          });
        }
      });
    },
  };
}
