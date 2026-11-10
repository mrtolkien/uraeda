// The protocol between Uraeda's server and its clients, as a client reads it.
// Written by `vp run protocol:types` from `crates/protocol/`: never by hand.

/** The protocol's version, which a client's `hello` gives. */
export type Protocol = 1;

/**
 * What a client sends.
 *
 * A `sub`, a `call`, and a `resume` carry an `id` the client picks, unique among the
 * subscriptions and the calls it has open on the connection: every answer names it.
 */
export type ClientMessage = { "type": "hello", protocol: number, signIn: SignIn, } | { "type": "sub", id: number, record: string, args: JsonValue, } | { "type": "unsub", id: number, } | { "type": "call", id: number, action: string, input: JsonValue, } | { "type": "resume", id: number, record: string, args: JsonValue, epoch: string, seq: number, };

/**
 * A conflicted text file of the main checkout, for the editor.
 */
export type ConflictFile = { 
/**
 * The file, from the checkout's top level.
 */
path: string, 
/**
 * Its text as it is on disk, with git's conflict markers.
 */
text: string, 
/**
 * What a save over it names, to be refused when the file changed since.
 */
hash: string, };

/**
 * Which conflicted file of the main checkout.
 */
export type ConflictFileArgs = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The file, from the checkout's top level.
 */
path: string, };

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

/**
 * Aborts the main checkout's stopped pull or merge.
 */
export type GitAbort = { 
/**
 * The repository's name.
 */
repo: string, };

/**
 * Which repository's page, or count.
 */
export type GitArgs = { 
/**
 * The repository's name.
 */
repo: string, };

/**
 * Cleans a merged feature, as `ura clean` does: its worktree, its branch, and its line of the
 * priorities. Refused, after what it could do, when something stays.
 */
export type GitClean = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The feature's folder.
 */
folder: string, };

/**
 * A commit, with the files it changed.
 */
export type GitCommit = { 
/**
 * Its full id.
 */
id: string, 
/**
 * Its message's first line.
 */
subject: string, 
/**
 * The rest of its message.
 */
body: string, 
/**
 * When it was authored, in Unix seconds.
 */
authored: number, 
/**
 * The files it changed.
 */
files: Array<GitCommitFile>, };

/**
 * Which commit of the main checkout's history.
 */
export type GitCommitArgs = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The commit's id, full or short.
 */
id: string, };

/**
 * A file a commit changed.
 */
export type GitCommitFile = { 
/**
 * From the repository's top level; the new path of a renamed file.
 */
path: string, 
/**
 * Lines added; none for a binary file.
 */
added: number | null, 
/**
 * Lines removed; none for a binary file.
 */
removed: number | null, };

/**
 * A commit of the history.
 */
export type GitCommitRow = { 
/**
 * Its full id.
 */
id: string, 
/**
 * Its first 7 characters.
 */
short: string, 
/**
 * Its message's first line.
 */
subject: string, 
/**
 * When it was authored, in Unix seconds.
 */
authored: number, 
/**
 * `pull` for a commit only `origin` has, `push` for one only the branch has, else empty.
 */
mark: "" | "pull" | "push", };

/**
 * Commits what is staged in a group's checkout, through the repository's hooks. A hook's
 * refusal is the error `hook`, with its output, and leaves the files staged.
 */
export type GitCommitStaged = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The group's folder; none for the main checkout.
 */
folder: string | null, 
/**
 * The message, as typed: a blank one takes the group's `defaultMessage`.
 */
message: string, };

/**
 * A conflicted file of the main checkout.
 */
export type GitConflict = { 
/**
 * Its path.
 */
id: string, 
/**
 * From the checkout's top level; a renamed file's new path.
 */
path: string, 
/**
 * How its two sides differ: `ours` is the stopped operation's `ours` side.
 */
kind: "both-changed" | "both-added" | "deleted-ours" | "deleted-theirs" | "both-deleted" | "added-ours" | "added-theirs", 
/**
 * Whether it is binary: only a side taken whole resolves it.
 */
isBinary: boolean, 
/**
 * Whether it is resolved, and waits for the operation to continue.
 */
isResolved: boolean, };

/**
 * Continues the main checkout's stopped pull or merge, once its conflicts are resolved.
 */
export type GitContinue = { 
/**
 * The repository's name.
 */
repo: string, };

/**
 * A file's diff.
 */
export type GitDiff = { 
/**
 * The file, from the checkout's top level.
 */
path: string, 
/**
 * The unified diff; none for a binary file, or one capped.
 */
text: string | null, 
/**
 * A binary file's size before, in bytes.
 */
binaryBefore: number | null, 
/**
 * A binary file's size after, in bytes.
 */
binaryAfter: number | null, 
/**
 * Lines added.
 */
added: number, 
/**
 * Lines removed.
 */
removed: number, 
/**
 * Whether it is over 1,000 lines, and the whole was not asked for.
 */
isCapped: boolean, };

/**
 * Which diff: of a file in a commit of the main checkout's history, else in a group's working
 * tree.
 */
export type GitDiffArgs = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The group's folder; none for the main checkout, or with a commit.
 */
folder: string | null, 
/**
 * The commit's id; none for a working tree.
 */
commit: string | null, 
/**
 * The file, from the checkout's top level.
 */
path: string, 
/**
 * Whether to give the whole diff, past 1,000 lines.
 */
whole: boolean, };

/**
 * Discards the changes to a file of a group's checkout.
 */
export type GitDiscard = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The group's folder; none for the main checkout.
 */
folder: string | null, 
/**
 * The file, from the checkout's top level.
 */
path: string, };

/**
 * Fetches `origin` in the main checkout.
 */
export type GitFetch = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * Whether the fetch is the page's own, as it opens, and not a person's: it never fails,
 * and the page's `fetchFailure` says why it brought nothing.
 */
quiet: boolean, };

/**
 * A changed file of a group.
 */
export type GitFile = { 
/**
 * Its path.
 */
id: string, 
/**
 * From the checkout's top level.
 */
path: string, 
/**
 * What happened to it.
 */
state: "modified" | "new" | "deleted", 
/**
 * How much of its change the next commit holds.
 */
staged: "no" | "yes" | "partly", 
/**
 * Lines added from `HEAD`; none for a binary file, or one past 1 MiB.
 */
added: number | null, 
/**
 * Lines removed from `HEAD`; none for a binary file, or one past 1 MiB.
 */
removed: number | null, };

/**
 * The changed files of one checkout.
 */
export type GitGroup = { 
/**
 * The feature's folder, or `.` for the main checkout's.
 */
id: string, 
/**
 * The feature's folder, as the page's writes name the group; none for the main checkout.
 */
folder: string | null, 
/**
 * The main checkout's branch, or the feature's title.
 */
name: string, 
/**
 * Sorted by path. A conflicted file is under the page's conflicts instead.
 */
files: Array<GitFile>, 
/**
 * The message a commit takes when none is typed, from what is staged; none when nothing is.
 */
defaultMessage: string | null, 
/**
 * Whether its feature's agent works, which refuses its writes.
 */
isWorking: boolean, };

/**
 * Which page of the main checkout's history.
 */
export type GitHistoryArgs = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The id of the commit the page continues after: the last one of the page before.
 */
after: string, };

/**
 * A page of the history, after a commit.
 */
export type GitHistoryPage = { 
/**
 * The next commits, the newest first.
 */
commits: Array<GitCommitRow>, 
/**
 * Whether the history goes on after them.
 */
hasMore: boolean, };

/**
 * Merges a branch into the main checkout's branch.
 */
export type GitMerge = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * One of the page's `branches`.
 */
branch: string, };

/**
 * The Git page: the main checkout's sync, changes, conflicts, and the first page of its
 * history, each feature's worktree with changes, and every worktree.
 */
export type GitPage = { 
/**
 * Whether a chat's agent works in the main checkout, which refuses the page's writes there.
 */
agentWorking: boolean, 
/**
 * The main checkout's branch, or the one a stopped rebase replays.
 */
branch: string | null, 
/**
 * `HEAD`'s short id when it is detached and nothing is stopped.
 */
detached: string | null, 
/**
 * Whether the repository has an `origin`.
 */
hasRemote: boolean, 
/**
 * The commits to push.
 */
ahead: number, 
/**
 * The commits to pull.
 */
behind: number, 
/**
 * When `origin` was last fetched, in Unix seconds.
 */
fetchedAt: number | null, 
/**
 * Why the last fetch in the background failed, until one succeeds.
 */
fetchFailure: string | null, 
/**
 * The pull or the merge the main checkout stopped in.
 */
stopped: GitStopped | null, 
/**
 * The main checkout's group first, always there, then each feature's worktree with changes.
 */
groups: Array<GitGroup>, 
/**
 * The main checkout's conflicted files.
 */
conflicts: Array<GitConflict>, 
/**
 * The first page of the history.
 */
history: Array<GitCommitRow>, 
/**
 * Whether the history goes on after that page.
 */
hasMoreHistory: boolean, 
/**
 * The linked worktrees, by path.
 */
worktrees: Array<GitWorktree>, 
/**
 * The branches a merge into the checked-out one may pick: the other local ones, then
 * `origin`'s, as `origin/<name>`.
 */
branches: Array<string>, };

/**
 * Pulls the main checkout's branch from `origin`, rebasing unless git's configuration says how
 * to pull. A pull that stops on a conflict succeeds: the page shows the stop.
 */
export type GitPull = { 
/**
 * The repository's name.
 */
repo: string, };

/**
 * Pushes the main checkout's branch to `origin`, never forced.
 */
export type GitPush = { 
/**
 * The repository's name.
 */
repo: string, };

/**
 * Removes a linked worktree, never forced: one with changes, or locked, is refused. Its branch
 * stays.
 */
export type GitRemoveWorktree = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The worktree's `path`, as the page lists it.
 */
path: string, };

/**
 * Resolves a conflicted file of the main checkout with a side whole, or by deleting it, and
 * stages it.
 */
export type GitResolve = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The file, from the checkout's top level.
 */
path: string, 
/**
 * The side to take, as git names them, or `delete`.
 */
resolution: "ours" | "theirs" | "delete", };

/**
 * Saves the editor's text over a conflicted file of the main checkout, and answers the file
 * with its new hash, which the next save names. It never stages: `git.continue` does.
 */
export type GitSaveConflict = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The file, from the checkout's top level.
 */
path: string, 
/**
 * Its new text.
 */
text: string, 
/**
 * The `hash` of the file as it was read: the error `conflict` when it changed since.
 */
hash: string, };

/**
 * Stages files or folders of a group's checkout.
 */
export type GitStage = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The group's folder; none for the main checkout.
 */
folder: string | null, 
/**
 * Files or folders, from the checkout's top level.
 */
paths: Array<string>, };

/**
 * The operation the main checkout stopped in, its sides named by branch.
 */
export type GitStopped = { 
/**
 * What stopped.
 */
kind: "pull" | "merge" | "stash", 
/**
 * Git's stage 2, like `origin/main` during a pull.
 */
ours: string, 
/**
 * Git's stage 3.
 */
theirs: string, 
/**
 * The stash a stash's stop kept, like `stash@{0}`.
 */
stash: string | null, };

/**
 * The sidebar's count.
 */
export type GitSummary = { 
/**
 * The main checkout's changed and conflicted files: a feature worktree's are not counted.
 */
changes: number, 
/**
 * The commits to pull into the main checkout's branch.
 */
behind: number, };

/**
 * Unstages files or folders of a group's checkout.
 */
export type GitUnstage = { 
/**
 * The repository's name.
 */
repo: string, 
/**
 * The group's folder; none for the main checkout.
 */
folder: string | null, 
/**
 * Files or folders, from the checkout's top level.
 */
paths: Array<string>, };

/**
 * A linked worktree.
 */
export type GitWorktree = { 
/**
 * Its path.
 */
id: string, 
/**
 * From the main checkout's top level, or absolute outside it: what `git.removeWorktree`
 * names.
 */
path: string, 
/**
 * The feature's title, else its folder's name.
 */
name: string, 
/**
 * The branch it has checked out.
 */
branch: string | null, 
/**
 * The folder of the feature on its branch.
 */
folder: string | null, 
/**
 * The first that holds: `merged` is a feature that is done.
 */
state: "missing" | "changes" | "locked" | "merged" | "clean", 
/**
 * Whether its feature's agent works, which refuses its cleaning and its removal.
 */
isWorking: boolean, };

export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]: JsonValue } | null;

/**
 * One operation of a change.
 *
 * A list takes `insert`, `remove`, and `move` only when each of its items is a record with an
 * `id`, a text no other item of the list has: any other list changes whole, by `set`.
 */
export type Op = { "op": "set", path: Array<string>, value: JsonValue, } | { "op": "append", path: Array<string>, text: string, } | { "op": "insert", path: Array<string>, value: JsonValue, before?: string | null, } | { "op": "remove", path: Array<string>, } | { "op": "move", path: Array<string>, before?: string | null, };

/**
 * Why a server turns a `hello` down.
 */
export type Refusal = "client-too-old" | "server-too-old" | "not-signed-in";

/**
 * What a server sends.
 */
export type ServerMessage = { "type": "welcome", protocol: number, epoch: string, } | { "type": "refused", reason: Refusal, protocol: number, } | { "type": "data", id: number, seq: number, value: JsonValue, } | { "type": "change", id: number, seq: number, ops: Array<Op>, } | { "type": "result", id: number, output: JsonValue, } | { "type": "error", id?: number | null, code: ErrorCode, message: string, };

/**
 * How a client signs in.
 */
export type SignIn = { "by": "cookie" } | { "by": "token", "token": string };

/** Every record, by the name a `sub` gives: its arguments, and its whole value. */
export type Records = {
  ConflictFile: { args: ConflictFileArgs; value: ConflictFile };
  Devices: { args: null; value: Devices };
  GitCommit: { args: GitCommitArgs; value: GitCommit };
  GitDiff: { args: GitDiffArgs; value: GitDiff };
  GitHistoryPage: { args: GitHistoryArgs; value: GitHistoryPage };
  GitPage: { args: GitArgs; value: GitPage };
  GitSummary: { args: GitArgs; value: GitSummary };
};

/** Every action, by the name a `call` gives: its input, and its output. */
export type Actions = {
  "devices.rename": { input: DevicesRename; output: null };
  "devices.revoke": { input: DevicesRevoke; output: null };
  "git.abort": { input: GitAbort; output: null };
  "git.clean": { input: GitClean; output: null };
  "git.commit": { input: GitCommitStaged; output: null };
  "git.continue": { input: GitContinue; output: null };
  "git.discard": { input: GitDiscard; output: null };
  "git.fetch": { input: GitFetch; output: null };
  "git.merge": { input: GitMerge; output: null };
  "git.pull": { input: GitPull; output: null };
  "git.push": { input: GitPush; output: null };
  "git.removeWorktree": { input: GitRemoveWorktree; output: null };
  "git.resolve": { input: GitResolve; output: null };
  "git.saveConflict": { input: GitSaveConflict; output: ConflictFile };
  "git.stage": { input: GitStage; output: null };
  "git.unstage": { input: GitUnstage; output: null };
};
