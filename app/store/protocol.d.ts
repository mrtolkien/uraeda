// The protocol between Uraeda's server and its clients, as a client reads it.
// Written by `vp run protocol:types` from `crates/protocol/`: never by hand.

/** The protocol's version, which a client's `hello` gives. */
export type Protocol = 1;

/**
 * What a branch behind the default branch catches up with, at the step `catch-up`.
 */
export type CatchUpView = { 
/**
 * The default branch's name, like `main`.
 */
branch: string, 
/**
 * The full hash of the default branch's tip to catch up with.
 */
commit: string, 
/**
 * That commit's subject line.
 */
subject: string, };

/**
 * What a client sends.
 *
 * A `sub`, a `call`, and a `resume` carry an `id` the client picks, unique among the
 * subscriptions and the calls it has open on the connection: every answer names it.
 */
export type ClientMessage = { "type": "hello", protocol: number, signIn: SignIn, } | { "type": "sub", id: number, record: string, args: JsonValue, } | { "type": "unsub", id: number, } | { "type": "call", id: number, action: string, input: JsonValue, } | { "type": "resume", id: number, record: string, args: JsonValue, epoch: string, seq: number, };

/**
 * A kind of automatic run, each with its switch in the settings.
 */
export type ContinueKind = "catch-up" | "limit" | "restart";

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
 * A feature's status, decided in one place from its step and its sessions: every view and the
 * notifications read it.
 */
export type FeatureStatus = { 
/**
 * What it reads as.
 */
status: SessionStatus, 
/**
 * The status in words, like `Needs you`.
 */
label: string, 
/**
 * Why it needs the human, or works with no turn running.
 */
reason: StatusReason | null, 
/**
 * The session it follows: a running one, else the latest. None without one.
 */
session: string | null, 
/**
 * That session's latest turn: what Dismiss names. None without one.
 */
turn: string | null, 
/**
 * When that turn's run continues by itself, while it waits.
 */
wait: Wait | null, };

/**
 * A workflow file of a feature, in short.
 */
export type FileSummary = { 
/**
 * Its name, like `spec.md`.
 */
name: string, 
/**
 * `proposal`, `clarifications`, `spec`, and the others.
 */
kind: string, 
/**
 * Its round, for a file of a round.
 */
round: number | null, 
/**
 * Its status, as its frontmatter has it.
 */
status: string | null, 
/**
 * The first line of its `> [!IMPORTANT]` block.
 */
waitingLine: string | null, };

/**
 * A folder the add form suggests.
 */
export type FolderSuggestion = { 
/**
 * The folder, as typed, ending with `/`.
 */
path: string, 
/**
 * Whether it holds `.git`.
 */
git: boolean, };

/**
 * The folders the add form suggests for a typed text: at most 20, by name. It is read once, and
 * never changes.
 */
export type FolderSuggestions = { 
/**
 * The folders whose path starts with the text.
 */
rows: Array<FolderSuggestion>, };

/**
 * The text typed in the add form.
 */
export type FolderSuggestionsArgs = { 
/**
 * A path that starts with `/` or `~`.
 */
text: string, };

export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]: JsonValue } | null;

/**
 * How the keys behave.
 */
export type KeyboardSettings = { 
/**
 * Whether the keys of one printable character act.
 */
singleKeyShortcuts: Setting<boolean>, 
/**
 * Whether the text fields edit with Vim's keys.
 */
vimMode: Setting<boolean>, 
/**
 * The lines of Vim's commands run when Vim starts, like `imap jj <Esc>`.
 */
vimCommands: Setting<Array<string>>, };

/**
 * Every item, of every listed repository, that needs the human.
 */
export type NeedsYouList = { 
/**
 * The items, each repository's features first, then its chats.
 */
rows: Array<NeedsYouRow>, };

/**
 * Why an item needs the human, in the order a notification picks it.
 */
export type NeedsYouReason = "blocked" | "attention" | "step" | "pull-request";

/**
 * An item that needs the human.
 */
export type NeedsYouRow = { 
/**
 * `<repository>/<folder>`, or `<repository>/sessions/<session id>`.
 */
id: string, 
/**
 * Changes with the reason and the step or the turn, so a new ask notifies again.
 */
key: string, 
/**
 * The repository's name.
 */
repository: string, 
/**
 * The feature's folder: a chat has none.
 */
folder: string | null, 
/**
 * Its page, from the server's root: where the human answers it.
 */
href: string, 
/**
 * Its name in the sidebar, or its slug.
 */
label: string, 
/**
 * Its title.
 */
title: string, 
/**
 * What it asks: `Questions to answer`.
 */
message: string, 
/**
 * Why it needs the human.
 */
reason: NeedsYouReason, };

/**
 * One operation of a change.
 *
 * A list takes `insert`, `remove`, and `move` only when each of its items is a record with an
 * `id`, a text no other item of the list has: any other list changes whole, by `set`.
 */
export type Op = { "op": "set", path: Array<string>, value: JsonValue, } | { "op": "append", path: Array<string>, text: string, } | { "op": "insert", path: Array<string>, value: JsonValue, before?: string | null, } | { "op": "remove", path: Array<string>, } | { "op": "move", path: Array<string>, before?: string | null, };

/**
 * A problem the check found in a workflow file.
 */
export type ProblemView = { 
/**
 * The file it is in.
 */
file: string, 
/**
 * The line it is on, from 1.
 */
line: number | null, 
/**
 * The rule it breaks.
 */
rule: string, 
/**
 * What is wrong, for a person.
 */
message: string, 
/**
 * Whether the fix of moved links repairs it.
 */
fixable: boolean, };

/**
 * A proposal of `PRIORITIES.md`.
 */
export type ProposalView = { 
/**
 * Its section and its place there, like `next-2`.
 */
id: string, 
/**
 * Its address, `/priorities/<key>`: the linked proposal file's name, or the slug of its
 * text.
 */
key: string, 
/**
 * `now`, `next`, `later`, or `blocked`.
 */
section: string, 
/**
 * Its place in its section.
 */
position: number, 
/**
 * Its text.
 */
text: string, 
/**
 * What it links.
 */
link: string | null, 
/**
 * The folder of the feature it links.
 */
feature: string | null, 
/**
 * The proposal file it links.
 */
file: string | null, };

/**
 * An open pull request's state.
 */
export type PullRequestState = "draft" | "open" | "changes-requested";

/**
 * A branch's open pull request.
 */
export type PullRequestView = { 
/**
 * Its number.
 */
number: number, 
/**
 * Its address, like `https://github.com/o/r/pull/31`.
 */
url: string, 
/**
 * Its state.
 */
state: PullRequestState, 
/**
 * Its head commit's full hash, as read on GitHub: empty when read from a record.
 */
head: string, };

/**
 * Why a server turns a `hello` down.
 */
export type Refusal = "client-too-old" | "server-too-old" | "not-signed-in";

/**
 * The listed repositories, the most recently opened first.
 */
export type Repositories = { 
/**
 * The list, as last read.
 */
rows: Array<RepositoryRow>, 
/**
 * Why `repositories.json` could not be read at its last change: the rows are the last read.
 */
problem: string | null, };

/**
 * Adds the git repository holding a folder to the list. One listed already is opened.
 */
export type RepositoriesAdd = { 
/**
 * The folder, as typed: it starts with `/` or `~`.
 */
folder: string, };

/**
 * What `repositories.add` answers.
 */
export type RepositoriesAdded = { 
/**
 * The name of the repository added, or found listed.
 */
name: string, };

/**
 * Records that a repository was opened now: it moves first in the list.
 */
export type RepositoriesOpen = { 
/**
 * The repository's name.
 */
name: string, };

/**
 * Takes a repository off the list. Its folder and its sessions stay as they are.
 */
export type RepositoriesRemove = { 
/**
 * The repository's name.
 */
name: string, };

/**
 * A listed repository, as the menu shows it.
 */
export type RepositoryRow = { 
/**
 * Its name, which names the row in a change.
 */
id: string, 
/**
 * Its name in the list: the `repo` of its records, and the `<name>` of its `/r/<name>/`
 * addresses.
 */
name: string, 
/**
 * Its main checkout, absolute.
 */
path: string, 
/**
 * `path` with the home folder written `~`.
 */
home: string, 
/**
 * Its folder no longer holds a git repository.
 */
missing: boolean, };

/**
 * A reviewer: an agent, or a command the human wrote.
 */
export type ReviewerOptions = { 
/**
 * An agent reviewer's runtime: none on a command reviewer.
 */
agent: string | null, 
/**
 * A model the agent lists.
 */
model: string | null, 
/**
 * An effort the model takes.
 */
effort: string | null, 
/**
 * Text added to the review's prompt.
 */
instructions: string | null, 
/**
 * A command reviewer's shell command, run in the feature's worktree.
 */
command: string | null, };

/**
 * The run options a settings file or a feature holds, every value optional: what was picked,
 * nothing resolved.
 */
export type RunOptions = { 
/**
 * The steps with an option set, in the workflow's order.
 */
steps: Array<StepOptions>, 
/**
 * The agent, model, and effort of the build's implementers.
 */
implementers: RunPick | null, 
/**
 * The reviewers, in the order they run: one agent reviewer on the review step's agent when
 * unset or empty.
 */
reviewers: Array<ReviewerOptions> | null, 
/**
 * `waves`, each wave and the branch, or `branch`: `waves` when unset.
 */
reviewDepth: string | null, };

/**
 * An agent, a model, and an effort picked for a role, like the implementers'.
 */
export type RunPick = { 
/**
 * The agent's runtime.
 */
agent: string | null, 
/**
 * A model the agent lists.
 */
model: string | null, 
/**
 * An effort the model takes.
 */
effort: string | null, };

/**
 * How the workflow's runs start and go on.
 */
export type RunSettings = { 
/**
 * The automatic continues in a row before a run asks, 1 to 10.
 */
automaticContinues: Setting<number>, 
/**
 * Whether an open pull request behind the default branch is caught up by itself.
 */
catchUpPullRequests: Setting<boolean>, 
/**
 * Whether a run a usage limit stopped continues at its reset.
 */
continueAfterLimit: Setting<boolean>, 
/**
 * Whether a run the server's restart cut continues.
 */
continueAfterRestart: Setting<boolean>, 
/**
 * `CLAUDE_CODE_EFFORT_LEVEL` of the server's environment when set, which every Claude Code
 * session inherits, over any effort picked.
 */
claudeEffortFromEnv: string | null, 
/**
 * The run options the file holds, only what it sets: no flag or variable gives them.
 */
options: RunOptions, };

/**
 * What a server sends.
 */
export type ServerMessage = { "type": "welcome", protocol: number, epoch: string, } | { "type": "refused", reason: Refusal, protocol: number, } | { "type": "data", id: number, seq: number, value: JsonValue, } | { "type": "change", id: number, seq: number, ops: Array<Op>, } | { "type": "result", id: number, output: JsonValue, } | { "type": "error", id?: number | null, code: ErrorCode, message: string, };

/**
 * The server's settings.
 */
export type ServerSettings = { 
/**
 * The host names accepted besides 127.0.0.1 and localhost.
 */
allowedHosts: Setting<Array<string>>, 
/**
 * Whether a start opens a browser.
 */
openBrowser: Setting<boolean>, 
/**
 * The port the server listens on.
 */
port: Setting<number>, };

/**
 * A session's or a feature's status, in the sidebar and its view.
 */
export type SessionStatus = "working" | "needs-you" | "attention" | "unread" | "idle";

/**
 * A setting: its value in force, the file's, and where the one in force comes from.
 */
export type Setting<T> = { 
/**
 * The value the server applies.
 */
inForce: T, 
/**
 * The file's value: none when the file has none.
 */
saved: T | null, 
/**
 * Where the value in force comes from.
 */
source: Source, };

/**
 * The settings, as the server applies them.
 */
export type Settings = { 
/**
 * The settings file, with `~` for the home folder.
 */
file: string, 
/**
 * Why the file cannot be read: the defaults apply meanwhile, and no action writes it.
 */
problem: string | null, 
/**
 * The `[server]` table.
 */
server: ServerSettings, 
/**
 * The `[runs]` table.
 */
runs: RunSettings, 
/**
 * The `[keyboard]` table.
 */
keyboard: KeyboardSettings, };

/**
 * Adds a host name, in lower case, to the allowed host names.
 */
export type SettingsAddHost = { 
/**
 * The host name, like `mac.tail1234.ts.net`.
 */
name: string, };

/**
 * Replaces an allowed host name with another, in its place.
 */
export type SettingsEditHost = { 
/**
 * The name to replace.
 */
from: string, 
/**
 * The name that takes its place.
 */
to: string, };

/**
 * Removes an allowed host name.
 */
export type SettingsRemoveHost = { 
/**
 * The host name.
 */
name: string, };

/**
 * Sets the automatic continues in a row before a run asks.
 */
export type SettingsSetAutomaticContinues = { 
/**
 * The number as typed, from 1 to 10.
 */
continues: string, };

/**
 * Turns a kind of automatic run on or off.
 */
export type SettingsSetContinue = { 
/**
 * The kind of automatic run.
 */
key: ContinueKind, 
/**
 * Whether it runs.
 */
on: boolean, };

/**
 * Sets whether a start opens a browser.
 */
export type SettingsSetOpenBrowser = { 
/**
 * Whether it does.
 */
open: boolean, };

/**
 * Sets the port the server listens on, from its next start.
 */
export type SettingsSetPort = { 
/**
 * The port as typed, from 1 to 65535.
 */
port: string, };

/**
 * Writes the run options whole.
 */
export type SettingsSetRunOptions = { 
/**
 * The run options, only what is set.
 */
options: RunOptions, };

/**
 * Sets whether the keys of one printable character act.
 */
export type SettingsSetSingleKeyShortcuts = { 
/**
 * Whether they act.
 */
on: boolean, };

/**
 * Sets the lines of Vim's commands run when Vim starts.
 */
export type SettingsSetVimCommands = { 
/**
 * The lines, like `imap jj <Esc>`.
 */
lines: Array<string>, };

/**
 * Sets whether the text fields edit with Vim's keys.
 */
export type SettingsSetVimMode = { 
/**
 * Whether they do.
 */
on: boolean, };

/**
 * An item of the setup.
 */
export type SetupItem = { 
/**
 * `specs`, `constitution`, `code-quality`, `testing`, or `preview`.
 */
key: string, 
/**
 * What the human reads, like `Code-quality decision`.
 */
name: string, 
/**
 * `missing`, `template` for a constitution still holding a placeholder, or `written`.
 */
state: string, 
/**
 * Whether the project is set up only once it is written: the preview decision is not.
 */
required: boolean, };

/**
 * How a client signs in.
 */
export type SignIn = { "by": "cookie" } | { "by": "token", "token": string };

/**
 * The slug the core proposes for a typed start, and the research efforts a feature may ask
 * for: the start dialog shows them. It is read once, and never changes.
 */
export type SlugProposal = { 
/**
 * The slug proposed.
 */
slug: string, 
/**
 * The research efforts, the lightest first.
 */
discoveryLevels: Array<string>, };

/**
 * The text typed for a start.
 */
export type SlugProposalArgs = { 
/**
 * The change, as typed.
 */
text: string, };

/**
 * Where a setting's value in force comes from: a flag, then a variable of the server's
 * environment, then the settings file, then the default.
 */
export type Source = { "kind": "default" } | { "kind": "file" } | { "kind": "flag", 
/**
 * The flag.
 */
name: string, } | { "kind": "environment", 
/**
 * The variable.
 */
name: string, };

/**
 * Why a status needs the human, or works with no turn running.
 */
export type StatusReason = "blocked" | "step" | "failed" | "stopped" | "interrupted" | "halted" | "conflict" | "capped" | "waiting";

/**
 * One step's options.
 */
export type StepOptions = { 
/**
 * The step: `discovery`, `spec`, `plan`, `build`, `review`, or `comments`.
 */
step: string, 
/**
 * The agent's runtime, like `claude` or `codex`.
 */
agent: string | null, 
/**
 * A model the agent lists.
 */
model: string | null, 
/**
 * An effort the model takes.
 */
effort: string | null, 
/**
 * Whether the step starts a clean session.
 */
newSession: boolean | null, };

/**
 * A feature's step in the workflow.
 */
export type StepView = { 
/**
 * `human-gate`, `plan`, `implementation`, `done`, and the others.
 */
name: string, 
/**
 * `human`, `agent`, or `nobody`.
 */
waitsOn: string, 
/**
 * The file waiting for the human, at a gate.
 */
file: string | null, 
/**
 * That file's kind, `clarifications`, `spec`, `plan`: what the gate asks of the human.
 */
fileKind: string | null, 
/**
 * The task `progress` names, as `Task N: title`, for implementation.
 */
task: string | null, 
/**
 * Where the implementation is in the plan's tasks, for implementation.
 */
progress: TaskProgress | null, 
/**
 * Whether the implementation is over: the final review or after.
 */
implemented: boolean, 
/**
 * Its position in the workflow, from the proposal's gate, 0, to `none`, 14.
 */
order: number, 
/**
 * The default branch's commit to catch up with, at `catch-up`.
 */
catchUp: CatchUpView | null, };

/**
 * The plan's progress during the implementation.
 */
export type TaskProgress = { 
/**
 * The tasks whose boxes are all checked.
 */
done: number, 
/**
 * The number of tasks in the plan.
 */
total: number, 
/**
 * The first task left: its title, as written after `## Task N:`.
 */
title: string, };

/**
 * A theme in the lists, every role resolved to a colour.
 */
export type Theme = { 
/**
 * The file's name without `.toml`.
 */
id: string, 
/**
 * Its name, as the lists show it.
 */
name: string, 
/**
 * `dark` or `light`.
 */
mode: string, 
/**
 * Whether it ships with Uraeda.
 */
isShipped: boolean, 
/**
 * Every role, `#rrggbb` or `#rrggbbaa`, in lower case.
 */
roles: { [key in string]: string }, 
/**
 * The palette, merged over the palettes of the themes it extends.
 */
palette: { [key in string]: string }, 
/**
 * For each role that names a palette entry, the entry's name.
 */
sources: { [key in string]: string }, };

/**
 * A theme file of the user's, listed or not, and its problems.
 */
export type ThemeFile = { 
/**
 * The file's name, `ember.toml`.
 */
file: string, 
/**
 * The theme's id: the file's name without `.toml`.
 */
id: string, 
/**
 * Its `name`, else its id.
 */
name: string, 
/**
 * Its mode, `dark` or `light`, written or taken from the theme it extends, when known.
 */
mode: string | null, 
/**
 * The theme it extends.
 */
extends: string | null, 
/**
 * Whether it is in the lists: false after a problem that leaves them.
 */
isListed: boolean, 
/**
 * Its problems, errors and warnings.
 */
problems: Array<ThemeProblem>, };

/**
 * A problem of a theme file: an error, or a warning, which never leaves the lists.
 */
export type ThemeProblem = { 
/**
 * The line it is on, from 1, to sort and to point at: none for the whole file.
 */
line: number | null, 
/**
 * The full text as shown, some already beginning `Line 4: `: a client never adds the line
 * itself.
 */
message: string, 
/**
 * Whether it is a warning.
 */
isWarning: boolean, 
/**
 * A warning naming a colour under the contrast floor, which the settings count apart from
 * the file's other problems.
 */
isUnderFloor: boolean, 
/**
 * The role it is about: none for a problem of no one role.
 */
role: string | null, };

/**
 * The themes the lists show, and the user's theme files.
 */
export type Themes = { 
/**
 * The user's themes folder, as messages show it, the home folder written `~`, and a `/`
 * last.
 */
folder: string, 
/**
 * The shipped themes and the user's listed ones: dark first, then light, each mode's default
 * first, then the shipped ones by name, then the user's by name.
 */
themes: Array<Theme>, 
/**
 * Every theme file of the user's, by file name.
 */
files: Array<ThemeFile>, };

/**
 * When a waiting run continues by itself.
 */
export type Wait = { 
/**
 * When, in RFC 3339.
 */
at: string, 
/**
 * Why it waits, as the run lifecycle names it.
 */
reason: string, };

/**
 * A repository's workspace, as the sidebar and home read it.
 */
export type Workspace = { 
/**
 * The main checkout, absolute.
 */
root: string, 
/**
 * The default branch, like `main`.
 */
defaultBranch: string | null, 
/**
 * The branch the main checkout has checked out.
 */
currentBranch: string | null, 
/**
 * Its features and changes.
 */
features: Array<WorkspaceFeature>, 
/**
 * The proposals of `PRIORITIES.md`, in the file's order.
 */
priorities: Array<ProposalView>, 
/**
 * The hash of `PRIORITIES.md` as read, for expanding a proposal by its id.
 */
prioritiesHash: string, 
/**
 * The proposal files and postponed folders, from the top level.
 */
proposals: Array<string>, 
/**
 * The repository's path when it has no `specs/` folder: nothing else is read.
 */
noSpecs: string | null, 
/**
 * What the project lacks to be set up, in the setup's order: every item while a required one
 * is not written, and none once it is set up.
 */
setup: Array<SetupItem>, 
/**
 * Whether the main checkout has an active preview decision.
 */
preview: boolean, };

/**
 * Which repository.
 */
export type WorkspaceArgs = { 
/**
 * The repository's name in the list.
 */
repo: string, };

/**
 * A feature or a change of a workspace: the core's view of it, with its name in the sidebar and
 * its status.
 */
export type WorkspaceFeature = { 
/**
 * Its folder, which names it in a change.
 */
id: string, 
/**
 * The name the human gave it in the sidebar. No workflow rule reads it.
 */
label: string | null, 
/**
 * Whether it needs the human, works, or waits.
 */
status: FeatureStatus, 
/**
 * `feature` or `change`.
 */
kind: string, 
/**
 * Its folder, `YYYY-MM-DD-<slug>`.
 */
folder: string, 
/**
 * Its folder's path from the top level: `specs/<folder>`, or `specs/changes/<folder>` for a
 * change, even once it is finished.
 */
path: string, 
/**
 * Its slug.
 */
slug: string, 
/**
 * The title of its proposal, or of its record.
 */
title: string, 
/**
 * Its branch.
 */
branch: string | null, 
/**
 * `working-tree`, `local`, `remote`, or `default-branch`.
 */
source: string, 
/**
 * Its worktree, when its branch is checked out in one.
 */
worktree: string | null, 
/**
 * Whether its worktree has changes not committed.
 */
uncommitted: boolean, 
/**
 * How many commits of the default branch its branch lacks.
 */
behind: number | null, 
/**
 * Its files, in workflow order.
 */
files: Array<FileSummary>, 
/**
 * The `.html` files of its `mockups/` folder, sorted.
 */
mockups: Array<string>, 
/**
 * Its step.
 */
step: StepView, 
/**
 * What stops the workflow. Home and the sidebar flag the feature.
 */
problems: Array<ProblemView>, 
/**
 * The check's other results, shown only on its page.
 */
notes: Array<ProblemView>, 
/**
 * For a merged feature, its worktree still there, from the main checkout.
 */
leftWorktree: string | null, 
/**
 * For a merged feature, its local branch still there.
 */
leftBranch: string | null, 
/**
 * Its branch's open pull request; else, once finished, its record's, read as open.
 */
pullRequest: PullRequestView | null, };

/** Every record, by the name a `sub` gives: its arguments, and its whole value. */
export type Records = {
  Devices: { args: null; value: Devices };
  FolderSuggestions: { args: FolderSuggestionsArgs; value: FolderSuggestions };
  NeedsYouList: { args: null; value: NeedsYouList };
  Repositories: { args: null; value: Repositories };
  Settings: { args: null; value: Settings };
  SlugProposal: { args: SlugProposalArgs; value: SlugProposal };
  Themes: { args: null; value: Themes };
  Workspace: { args: WorkspaceArgs; value: Workspace };
};

/** Every action, by the name a `call` gives: its input, and its output. */
export type Actions = {
  "devices.rename": { input: DevicesRename; output: null };
  "devices.revoke": { input: DevicesRevoke; output: null };
  "repositories.add": { input: RepositoriesAdd; output: RepositoriesAdded };
  "repositories.open": { input: RepositoriesOpen; output: null };
  "repositories.remove": { input: RepositoriesRemove; output: null };
  "settings.addHost": { input: SettingsAddHost; output: null };
  "settings.editHost": { input: SettingsEditHost; output: null };
  "settings.removeHost": { input: SettingsRemoveHost; output: null };
  "settings.setAutomaticContinues": { input: SettingsSetAutomaticContinues; output: null };
  "settings.setContinue": { input: SettingsSetContinue; output: null };
  "settings.setOpenBrowser": { input: SettingsSetOpenBrowser; output: null };
  "settings.setPort": { input: SettingsSetPort; output: null };
  "settings.setRunOptions": { input: SettingsSetRunOptions; output: null };
  "settings.setSingleKeyShortcuts": { input: SettingsSetSingleKeyShortcuts; output: null };
  "settings.setVimCommands": { input: SettingsSetVimCommands; output: null };
  "settings.setVimMode": { input: SettingsSetVimMode; output: null };
};
