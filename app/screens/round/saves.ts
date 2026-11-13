// A round's writes, in the order the human made them: its answers, its notes, its settled points'
// comments, and its submit. A round is a feature's, `<folder>/clarifications-NN.md`, or one of the
// default branch, the inbox's triage or the decisions check, which take other actions and chain
// the round's hash. Each save takes what the one before it wrote, not what the record said when
// the human acted: the record catches up a moment later. One queue per round, out of any pane: a
// pane moved or a tab hidden loses no save on its way. The queue reads the round's file through
// the pane that draws it now, so a round opened again saves over what it shows; and it goes once
// no pane draws the round, no save is on its way, and the round is settled or gone, or the record
// shows everything it wrote: the next round of the same name, as each inbox triage, starts from
// its own file.
import { type Accessor, cleanup, signal, untracked } from "nsh";
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

/** How a round's file is read: by the pane that draws the round. */
type Reader = () => FileView | null | undefined;

/** A round's queue, and what keeps it: the panes that draw the round, and the reader they gave. */
type Queue = {
  /** Reads the file through `file` from now on: the pane that draws the round now. */
  bind: (file: Reader) => void;
  /** How many panes draw the round. */
  holders: number;
  /** Whether nothing is left to keep it for: no save on its way, and nothing the next would need. */
  spent: () => boolean;
  saves: Saves;
};

const all = new Map<string, Queue>();

/**
 * The one queue of a round, made as it is first asked for, and read through `file` from now on.
 * Called as the round's pane renders: the queue is held until the pane goes.
 */
export function savesOf(args: RoundArgs, file: Reader): Saves {
  const key = `${args.repo}\n${args.id}`;
  /** Lets the queue go once nothing keeps it: a pane, a save on its way, or what it wrote. */
  const release = () => {
    const held = all.get(key);
    if (held !== undefined && held.holders === 0 && held.spent()) all.delete(key);
  };
  let queue = all.get(key);
  if (queue === undefined) {
    queue = createSaves(targetOf(args), args, file, release);
    all.set(key, queue);
  }
  const held = queue;
  held.bind(file);
  held.holders += 1;
  cleanup(() => {
    held.holders -= 1;
    release();
  });
  return held.saves;
}

// oxlint-disable-next-line max-lines-per-function -- one queue's closure, whose saves share its chain and what it wrote
function createSaves(target: Target, args: RoundArgs, first: Reader, onIdle: () => void): Queue {
  let file = first;
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
    const done = chain.then(run).finally(() => {
      pending.update((count) => count - 1);
      if (untracked(pending) === 0) onIdle();
    });
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

  const saves: Saves = {
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
  return {
    bind: (reader) => {
      file = reader;
    },
    holders: 0,
    saves,
    spent() {
      if (untracked(pending) > 0) return false;
      // A round settled, or gone, takes no more saves: what the queue wrote is of no use.
      const read = now();
      if (read === undefined || read.status !== "awaiting-human") return true;
      // A round still waiting keeps what the record does not show yet, for its next save.
      return written.size === 0 && notesWritten === undefined && hash === undefined;
    },
  };
}
