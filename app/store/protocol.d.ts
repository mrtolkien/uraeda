// The protocol between Uraeda's server and its clients, as a client reads it.
// Written by `vp run protocol:types` from `crates/protocol/`: never by hand.

/** The protocol's version, which a client's `hello` gives. */
export type Protocol = 1;

/**
 * Saves one answer of a feature's latest round, from the letters picked and a comment, over
 * the answer last read.
 */
export type AnswerSave = { repo: string, folder: string, question: string, letters: Array<string>, comment: string, previous: string, };

/**
 * Submits a feature's latest round, and commits it.
 */
export type AnswersSubmit = { repo: string, folder: string, 
/**
 * The round answered: refused when the latest is another.
 */
file?: string, 
/**
 * Whether the answers continue the implementation.
 */
resumes: boolean, write?: WriteName, };

/**
 * A buffer: any Markdown file under `specs/`, whole, frontmatter included, as the branch it is
 * written on has it.
 */
export type Buffer = { path: string, text: string, 
/**
 * The hash of `text`, which `buffer.save` takes back.
 */
hash: string, 
/**
 * The branch the file is written on: its feature's or its change's, else the default one.
 */
branch: string, };

/**
 * Which buffer: a Markdown file under `specs/`, by its path from the repository's top level.
 */
export type BufferArgs = { repo: string, path: string, };

/**
 * Saves a buffer as typed on its branch, over the text read with `hash`, without committing.
 */
export type BufferSave = { repo: string, path: string, text: string, hash: string, };

/**
 * What a client sends.
 *
 * A `sub`, a `call`, and a `resume` carry an `id` the client picks, unique among the
 * subscriptions and the calls it has open on the connection: every answer names it.
 */
export type ClientMessage = { "type": "hello", protocol: number, signIn: SignIn, } | { "type": "sub", id: number, record: string, args: JsonValue, } | { "type": "unsub", id: number, } | { "type": "call", id: number, action: string, input: JsonValue, } | { "type": "resume", id: number, record: string, args: JsonValue, epoch: string, seq: number, };

/**
 * Commits again what did not land, its files left written: a submitted round, a review's
 * findings, or a verdict.
 */
export type CommitRetry = { repo: string, folder: string, file: string, write?: WriteName, };

/**
 * Saves one answer of a round of the default branch, `inbox-triage` or `decisions-check`, over
 * the answer last read, in the round read with the hash `base`.
 */
export type DefaultRoundAnswer = { repo: string, id: string, question: string, letters: Array<string>, comment: string, previous: string, 
/**
 * The hash of the round as the page read or wrote it last.
 */
base: string, };

/**
 * Dismisses the inbox's triage, read with the hash `previous`: deletes it, and commits the
 * deletion alone.
 */
export type DefaultRoundDismiss = { repo: string, previous: string, write?: WriteName, };

/**
 * Saves the notes of a round of the default branch, as an answer is.
 */
export type DefaultRoundNotes = { repo: string, id: string, notes: string, previous: string, base: string, };

/**
 * Commits an answered round of the default branch again.
 */
export type DefaultRoundRetry = { repo: string, id: string, write?: WriteName, };

/**
 * Submits a round of the default branch, read with the hash `previous`, and commits it.
 */
export type DefaultRoundSubmit = { repo: string, id: string, previous: string, write?: WriteName, };

/**
 * A paired device.
 */
export type Device = { 
/**
 * What names the device: the part of its token before the dot, which is no secret.
 */
id: string, 
/**
 * The name it gave as it paired, or the owner gave it since.
 */
name: string, 
/**
 * When it paired, in RFC 3339, as `2026-11-10T09:00:00Z`.
 */
created: string, 
/**
 * The day it last signed in, in RFC 3339: a use is recorded once a day at most.
 */
used: string, };

/**
 * The devices paired with the server, each signing in with a token of its own.
 */
export type Devices = { 
/**
 * The oldest pairing first.
 */
devices: Array<Device>, };

/**
 * Renames a device.
 */
export type DevicesRename = { 
/**
 * The device's `id`.
 */
id: string, 
/**
 * Its new name: the blanks around it go, and it holds a letter at least.
 */
name: string, };

/**
 * Revokes a device: its token signs in nowhere any more, and its open connections close.
 */
export type DevicesRevoke = { 
/**
 * The device's `id`.
 */
id: string, };

/**
 * What an `error` is about.
 */
export type ErrorCode = "not-signed-in" | "bad-message" | "unknown-record" | "unknown-action" | "bad-args" | "bad-input" | "refused" | "conflict" | "hook" | "internal";

export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]: JsonValue } | null;

/**
 * Saves the notes on a round's settled points, over the notes last read.
 */
export type NotesSave = { repo: string, folder: string, notes: string, previous: string, };

/**
 * One operation of a change.
 *
 * A list takes `insert`, `remove`, and `move` only when each of its items is a record with an
 * `id`, a text no other item of the list has: any other list changes whole, by `set`.
 */
export type Op = { "op": "set", path: Array<string>, value: JsonValue, } | { "op": "append", path: Array<string>, text: string, } | { "op": "insert", path: Array<string>, value: JsonValue, before?: string | null, } | { "op": "remove", path: Array<string>, } | { "op": "move", path: Array<string>, before?: string | null, };

/**
 * A write of the queue: its name, where it is, and the feature and file it concerns.
 */
export type QueuedWrite = { id: string, 
/**
 * What it does, as the UI named it, or its commit's subject.
 */
label: string, 
/**
 * The page it opens: empty when the UI named none.
 */
href: string, 
/**
 * The feature or the change it concerns.
 */
folder: string | null, 
/**
 * The file it concerns: a feature's file by its name, any other by its path.
 */
file: string | null, state: WriteState, 
/**
 * Once refused, why.
 */
failure: WriteFailure | null, 
/**
 * What git and the hooks printed: as it comes, then the refusal's whole message.
 */
output: string | null, };

/**
 * What an undoable write answers: the change it made, for the client's undo stack.
 */
export type Recorded = { change: UndoChange, };

/**
 * Why a server turns a `hello` down.
 */
export type Refusal = "client-too-old" | "server-too-old" | "not-signed-in";

/**
 * Approves a spec or a plan, and commits it.
 */
export type ReviewApprove = { repo: string, folder: string, file: string, summary?: string, 
/**
 * The spec's risk tier, when the human changes it.
 */
tier?: string, 
/**
 * Whether the plan is reviewed, when the human changes it.
 */
planReview?: boolean, write?: WriteName, };

/**
 * Comments on lines of a file as committed, on lines of a decision its spec changes, or on
 * the whole file without lines.
 */
export type ReviewComment = { repo: string, folder: string, file: string, startLine?: number, 
/**
 * `startLine` alone when left out.
 */
endLine?: number, text: string, decision?: ReviewDecision, };

/**
 * The decision a comment points into: its file's stem, and whether the lines are of a part the
 * branch removed.
 */
export type ReviewDecision = { name: string, removed: boolean, };

/**
 * Replaces the text of a pending comment.
 */
export type ReviewEdit = { repo: string, folder: string, file: string, number: number, text: string, };

/**
 * Removes a pending comment.
 */
export type ReviewRemove = { repo: string, folder: string, file: string, number: number, };

/**
 * Requests changes on a spec or a plan, and commits it.
 */
export type ReviewRequestChanges = { repo: string, folder: string, file: string, summary?: string, write?: WriteName, };

/**
 * Deletes the pending review of a file.
 */
export type ReviewStartOver = { repo: string, folder: string, file: string, };

/**
 * What a save answers: the hash of the text as written, which the next save takes.
 */
export type Saved = { hash: string, };

/**
 * What a server sends.
 */
export type ServerMessage = { "type": "welcome", protocol: number, epoch: string, } | { "type": "refused", reason: Refusal, protocol: number, } | { "type": "data", id: number, seq: number, value: JsonValue, } | { "type": "change", id: number, seq: number, ops: Array<Op>, } | { "type": "result", id: number, output: JsonValue, } | { "type": "error", id?: number | null, code: ErrorCode, message: string, };

/**
 * Adds a comment on the settled point starting with `subject`, at the end of the notes.
 */
export type SettledComment = { repo: string, folder: string, subject: string, text: string, };

/**
 * Writes comment `number` on the settled point `subject` over its text last read.
 */
export type SettledEdit = { repo: string, folder: string, number: number, subject: string, text: string, previous: string, };

/**
 * Removes comment `number` on the settled point `subject`, over its text last read.
 */
export type SettledRemove = { repo: string, folder: string, number: number, subject: string, previous: string, };

/**
 * How a client signs in.
 */
export type SignIn = { "by": "cookie" } | { "by": "token", "token": string };

/**
 * Commits a proposal file or a note file, with the lists that changed.
 */
export type TextCommit = { repo: string, path: string, write?: WriteName, };

/**
 * Sets a proposal's discovery level, over the text read with `hash`.
 */
export type TextDiscovery = { repo: string, path: string, level: string, hash: string, };

/**
 * Saves a proposal file, a note file, or a feature's proposal as typed, over the text read
 * with `hash`, without committing.
 */
export type TextSave = { repo: string, path: string, text: string, hash: string, };

/**
 * What `undo.apply` answers: the commit the files' checkout is at now.
 */
export type UndoApplied = { commit: string | null, };

/**
 * Writes a change back, for an undo, or forward, for a redo, once every file holds the other
 * side: `subject` names the action in the refusal of a file that changed since.
 */
export type UndoApply = { repo: string, change: UndoChange, direction: UndoDirection, subject: string, };

/**
 * What a write changed, as its answer gives it and `undo.apply` takes it back: the commit its
 * checkout was at, and each file on both sides.
 */
export type UndoChange = { commit: string | null, files: Array<UndoFile>, };

/**
 * Whether a commit since a change holds any of its files otherwise: its undo then asks first.
 */
export type UndoCommitted = { repo: string, change: UndoChange, };

/**
 * Which way a change is written.
 */
export type UndoDirection = "undo" | "redo";

/**
 * A file of a change, by its path from the top level: its bytes before and after, in base64,
 * `null` on the side where it did not exist.
 */
export type UndoFile = { path: string, before: string | null, after: string | null, };

/**
 * Why a refused write did not land.
 */
export type WriteFailure = "hook" | "failed";

/**
 * What the UI names a committing write with, in the write queue.
 */
export type WriteName = { 
/**
 * The page it opens.
 */
href: string, 
/**
 * Its running text, as "Approving the spec of Recurring tasks".
 */
label: string, };

/**
 * A repository's write queue: its commits still landing, one after another, and the refused
 * ones, until dismissed.
 */
export type WriteQueue = { 
/**
 * In the order they were made.
 */
writes: Array<QueuedWrite>, };

/**
 * Which write queue: a repository's.
 */
export type WriteQueueArgs = { repo: string, };

/**
 * Where a queued write is.
 */
export type WriteState = "waiting" | "running" | "refused";

/**
 * Takes a refused write out of the write queue.
 */
export type WritesDismiss = { repo: string, id: string, };

/** Every record, by the name a `sub` gives: its arguments, and its whole value. */
export type Records = {
  Buffer: { args: BufferArgs; value: Buffer };
  Devices: { args: null; value: Devices };
  WriteQueue: { args: WriteQueueArgs; value: WriteQueue };
};

/** Every action, by the name a `call` gives: its input, and its output. */
export type Actions = {
  "answer.save": { input: AnswerSave; output: null };
  "answers.submit": { input: AnswersSubmit; output: null };
  "buffer.save": { input: BufferSave; output: Saved };
  "commit.retry": { input: CommitRetry; output: null };
  "defaultRound.answer": { input: DefaultRoundAnswer; output: Saved };
  "defaultRound.dismiss": { input: DefaultRoundDismiss; output: null };
  "defaultRound.notes": { input: DefaultRoundNotes; output: Saved };
  "defaultRound.retry": { input: DefaultRoundRetry; output: null };
  "defaultRound.submit": { input: DefaultRoundSubmit; output: null };
  "devices.rename": { input: DevicesRename; output: null };
  "devices.revoke": { input: DevicesRevoke; output: null };
  "notes.save": { input: NotesSave; output: null };
  "review.approve": { input: ReviewApprove; output: null };
  "review.comment": { input: ReviewComment; output: Recorded };
  "review.edit": { input: ReviewEdit; output: Recorded };
  "review.remove": { input: ReviewRemove; output: Recorded };
  "review.requestChanges": { input: ReviewRequestChanges; output: null };
  "review.startOver": { input: ReviewStartOver; output: Recorded };
  "settled.comment": { input: SettledComment; output: null };
  "settled.edit": { input: SettledEdit; output: null };
  "settled.remove": { input: SettledRemove; output: Recorded };
  "text.commit": { input: TextCommit; output: null };
  "text.discovery": { input: TextDiscovery; output: Saved };
  "text.save": { input: TextSave; output: Saved };
  "undo.apply": { input: UndoApply; output: UndoApplied };
  "undo.committed": { input: UndoCommitted; output: boolean };
  "writes.dismiss": { input: WritesDismiss; output: null };
};
