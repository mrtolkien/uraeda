// The app's one undo stack (the undo decision): the last 50 actions of every screen and every
// repository, the latest on top, and the redo side. A screen gives it each undoable action's
// answer with `remember(change, words)`: the server's `Recorded { change }`, or the `change` of a
// list's or a file's write. An undo writes the change's files back through `undo.apply`, which
// refuses once a file changed since; it never commits, reverts, or rewrites history.
//
// The stack lives in the app's memory: it survives a move between pages and a reconnection, and
// empties when the app closes. Replays run one at a time, in the order pressed. `Undo.tsx` draws
// its toasts and declares its keys.
import { signal } from "nsh";
import { call, route, type Route, StoreError } from "../../store";
import type { UndoChange } from "../../store/protocol";

/** An action the stack can undo. */
export type Done = {
  /** The repository it wrote in, by its name in the list. */
  repo: string;
  /** What it changed: its files on both sides, as the server answered. */
  change: UndoChange;
  /** What happened, as its toast says it: "Deleted “Glass bar over the transcript”." */
  words: string;
  /** What it concerned, as a refusal names it: the note's text. */
  subject: string;
  /** Where it happened: an undo takes the human back there. */
  place: Route;
  /** Where its subject went, when it left the page: the way to it. */
  went?: { label: string; to: Route };
  /** A run of moves of one list: a move within a second of the one on top joins it. */
  run?: string;
};

/** What a screen tells the stack besides the change and its words. */
export type RememberOptions = {
  /** The repository, when it is not the one shown. */
  repo?: string;
  subject?: string;
  place?: Route;
  went?: Done["went"];
  run?: string;
  /** Shows no toast, where the screen says it already: the stack still holds it. */
  quiet?: boolean;
};

/** What the last action or replay says: its toast, until the next. */
export type Said = {
  done: Done;
  /** `done` the action, `undone` and `redone` a replay, `refused` an undo the server refused. */
  kind: "done" | "undone" | "redone" | "refused";
  /** Why it was refused, in the server's words, and what stays. */
  why?: string;
  /** Grows at each: a toast for the same action again is a new one. */
  id: number;
};

/** The actions the stack keeps: the oldest goes past them. */
export const LIMIT = 50;
/** A move joins the run on top while it comes this soon after the run's last move, in ms. */
const RUN_MS = 1000;

const done = signal<ReadonlyArray<Done>>([]);
const undone = signal<ReadonlyArray<Done>>([]);
/** The toast of the stack: what was done, or undone, last. */
export const said = signal<Said | null>(null);
/** The question of an action committed since, while it waits for the human's answer. */
export const asking = signal<{ done: Done; redo: boolean; answer: (yes: boolean) => void } | null>(
  null,
);

/**
 * What the last replay brought back, by its repository and its subject, the note's or the line's
 * text: a list of the page it returns to puts its cursor on that row once it shows it, then
 * `took` it.
 */
export const broughtBack = signal<{ id: number; repo: string; subject: string } | null>(null);

/** A list put its cursor on what came back: no later change of its rows moves it there again. */
export function took(id: number) {
  if (broughtBack()?.id === id) broughtBack.set(null);
}

let saidId = 0;
let lastMove: { at: number; run: string } | null = null;
/** Moves on at each action remembered: a replay that lands after one leaves its entry off both sides. */
let epoch = 0;
/** The replays in the order pressed: each starts once the one before settled. */
let queue: Promise<unknown> = Promise.resolve();

function say(entry: Done, kind: Said["kind"], why?: string) {
  saidId += 1;
  said.set({ done: entry, id: saidId, kind, why });
}

/** Whether there is something to undo, or to redo, read as a signal. */
export const canUndo = () => done().length > 0;
export const canRedo = () => undone().length > 0;

/**
 * Keeps an undoable action's change on the stack, and says it in a quiet toast with Undo: what a
 * screen calls with its action's answer. A `null` change, an action that changed nothing, keeps
 * nothing.
 */
export function remember(
  change: UndoChange | null | undefined,
  words: string,
  options: RememberOptions = {},
) {
  const repo = options.repo ?? route().repo;
  if (change == null || change.files.length === 0 || repo === undefined) return;
  const entry: Done = {
    change,
    place: options.place ?? route(),
    repo,
    run: options.run,
    subject: options.subject ?? words,
    went: options.went,
    words,
  };
  const now = Date.now();
  const top = done().at(-1);
  const joins =
    entry.run !== undefined &&
    top?.run === entry.run &&
    lastMove?.run === entry.run &&
    now - lastMove.at < RUN_MS;
  epoch += 1;
  undone.set([]);
  if (joins && top !== undefined) {
    done.set([...done().slice(0, -1), { ...entry, change: joinChanges(top.change, change) }]);
  } else {
    done.set([...done(), entry].slice(-LIMIT));
  }
  lastMove = entry.run === undefined ? null : { at: now, run: entry.run };
  if (options.quiet !== true) say(done().at(-1)!, "done");
}

/**
 * The change of two moves in a run, `earlier` then `later`: each file's bytes before the earlier,
 * and after the later.
 */
export function joinChanges(earlier: UndoChange, later: UndoChange): UndoChange {
  const files = new Map(earlier.files.map((file) => [file.path, file]));
  for (const file of later.files) {
    const first = files.get(file.path);
    files.set(file.path, { ...file, before: first === undefined ? file.before : first.before });
  }
  return { commit: earlier.commit, files: [...files.values()] };
}

/** Asks the human whether to go on with an action committed since. */
function ask(entry: Done, forth: boolean): Promise<boolean> {
  return new Promise((answer) =>
    asking.set({
      answer: (yes) => {
        asking.set(null);
        answer(yes);
      },
      done: entry,
      redo: forth,
    }),
  );
}

/** Why a replay was refused, and what stays: the server's words, without its code. */
function refusalWords(error: unknown, forth: boolean): string {
  const message = error instanceof Error ? error.message : String(error);
  const what = forth ? "redone" : "undone";
  return `${message.replace(/^(refused|conflict): /, "")} Nothing was ${what}: the files stay as they are now.`;
}

/** Replays the top of one side: an undo, or a redo with `redo`. */
async function replay(forth: boolean) {
  const from = forth ? undone : done;
  const entry = from().at(-1);
  if (entry === undefined) return;
  const started = epoch;
  lastMove = null;
  try {
    const committed = await call("undo.committed", { change: entry.change, repo: entry.repo });
    if (committed && !(await ask(entry, forth))) return;
    const applied = await call("undo.apply", {
      change: entry.change,
      direction: forth ? "redo" : "undo",
      repo: entry.repo,
      subject: entry.subject,
    });
    // A commit since the replay makes the next one ask: the change is at the commit of now.
    const moved: Done = { ...entry, change: { ...entry.change, commit: applied.commit } };
    from.set(from().filter((one) => one !== entry));
    // An action remembered meanwhile leaves this one off both sides: its reverse would come after.
    if (epoch === started) {
      if (forth) done.set([...done(), moved].slice(-LIMIT));
      else undone.set([...undone(), moved]);
    }
    say(moved, forth ? "redone" : "undone");
    broughtBack.set({ id: saidId, repo: entry.repo, subject: entry.subject });
  } catch (error) {
    // The server refused it, a file having changed since: it goes, as it can never apply. A line
    // that dropped keeps it for another try.
    const refused =
      error instanceof StoreError && (error.code === "refused" || error.code === "conflict");
    if (refused) from.set(from().filter((one) => one !== entry));
    say(entry, "refused", refusalWords(error, forth));
  }
}

/** Undoes the latest action, after any replay still on its way. `false` when there is none. */
export function undo(): boolean {
  if (!canUndo()) return false;
  queue = queue.then(() => replay(false)).catch(() => undefined);
  return true;
}

/** Redoes the latest action undone, after any replay still on its way. */
export function redo(): boolean {
  if (!canRedo()) return false;
  queue = queue.then(() => replay(true)).catch(() => undefined);
  return true;
}

/** Ends the toast of the stack, as its close does. */
export function quiet(id: number) {
  if (said()?.id === id) said.set(null);
}

/** Empties the stack: for tests, which share the app's memory. */
export function forgetAll() {
  done.set([]);
  undone.set([]);
  said.set(null);
  lastMove = null;
  epoch += 1;
}
