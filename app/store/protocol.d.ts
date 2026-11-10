// The protocol between Uraeda's server and its clients, as a client reads it.
// Written by `vp run protocol:types` from `crates/protocol/`: never by hand.

/** The protocol's version, which a client's `hello` gives. */
export type Protocol = 1;

/**
 * Every feature's branch changes, without their files, read at once for the sidebar's cards.
 */
export type AllBranchChanges = { 
/**
 * Each feature that has changes.
 */
features: Array<FeatureChanges>, 
/**
 * Whether they could not be read.
 */
failed: boolean, };

/**
 * A block, its place in the tree, its lines, and the fields of its kind.
 */
export type Block = { 
/**
 * Its index in the document's blocks.
 */
id: number, parent: number | null, kind: BlockKind, startLine: number, endLine: number, 
/**
 * The text of the nearest heading at or above its first line, for review anchors.
 */
heading: string | null, 
/**
 * A heading's level.
 */
level: number | null, 
/**
 * A heading's anchor, numbered like GitHub's when several share a slug.
 */
anchor: string | null, 
/**
 * The text of a heading, a paragraph, a cell, an item's own text, or a callout's title.
 */
spans: Array<Span>, 
/**
 * A list's kind, and the number of its first item.
 */
ordered: boolean | null, start: number | null, marker: ItemMarker | null, 
/**
 * A task's checkbox.
 */
checked: boolean | null, calloutKind: CalloutKind | null, 
/**
 * Whether a row is the table's header.
 */
header: boolean | null, 
/**
 * A cell's alignment: `left`, `center`, `right`, or `None`.
 */
align: string | null, 
/**
 * A code block's language.
 */
language: string | null, 
/**
 * A code block's or an HTML block's text, shown as text.
 */
text: string | null, };

export type BlockKind = "heading" | "paragraph" | "list" | "item" | "callout" | "quote" | "table" | "row" | "cell" | "code" | "rule" | "html";

/**
 * A feature's branch changes, by its folder.
 */
export type BranchChanges = { 
/**
 * The changes: none when the feature has no branch, is merged, or is no feature, when the
 * default branch is unknown, and when they could not be read.
 */
changes: BranchChangesView | null, 
/**
 * Whether they could not be read: git missing, or the diff failing.
 */
failed: boolean, };

/**
 * The changes of a feature's branch, outside the feature's own folder.
 */
export type BranchChangesView = { 
/**
 * The first 50 files, sorted by path, outside `specs/<folder>/`.
 */
files: Array<ChangedFile>, 
/**
 * Every changed file outside the feature's folder, listed or not.
 */
count: number, added: number, removed: number, };

/**
 * A decision as a feature's branch has it, and its change against the merge base of the branch
 * and the default branch.
 */
export type BranchDecision = { 
/**
 * The file's name, without `.md`.
 */
name: string, 
/**
 * The feature's folder.
 */
folder: string, change: DecisionChange, 
/**
 * The branch's version of the file.
 */
document: Document, };

export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution" | "question";

/**
 * The candidate of one option of a question of a decisions check.
 */
export type Candidate = { 
/**
 * The question's folder part, like `q1`.
 */
question: string, 
/**
 * The option's letter, lowercase, like `a`.
 */
option: string, 
/**
 * The candidate against the active decision of the same name: a new decision when there is
 * none.
 */
change: DecisionChange, };

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
 * Starts a change from a note of the inbox, with its note file's text and images, then takes
 * the note out of the inbox.
 */
export type ChangeFromNote = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The inbox's hash as read.
 */
hash: string, 
/**
 * Its slug: the one the core proposes when none is given.
 */
slug?: string | null, };

/**
 * Starts a change typed as a text, then sends its first run.
 */
export type ChangeStart = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The text, as typed.
 */
text: string, 
/**
 * Its slug: the one the core proposes when none is given.
 */
slug?: string | null, 
/**
 * Its images, as their upload answered them.
 */
images?: Array<ChatImage> | null, 
/**
 * The text of the line of **Now** it was filled from, which its link replaces.
 */
line?: string | null, 
/**
 * Its own run options, only what differs from the settings'.
 */
options?: RunOptions | null, };

/**
 * Starts a proposal file as a change, then sends its first run.
 */
export type ChangeStartProposal = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The proposal file, from the top level.
 */
proposal: string, 
/**
 * Its slug: the one the core proposes when none is given.
 */
slug?: string | null, };

/**
 * A change started.
 */
export type ChangeStarted = { 
/**
 * Its folder.
 */
folder: string, 
/**
 * The session its first run was sent to: none when no run was sent, and its page offers
 * the message unsent.
 */
session: string | null, };

/**
 * A file changed on a feature's branch, from the default branch's merge base to its tip.
 */
export type ChangedFile = { 
/**
 * From the repository's top level; the new path of a renamed file.
 */
path: string, 
/**
 * Lines added and removed; `None` for a binary file.
 */
added: number | null, removed: number | null, };

/**
 * An image of a typed start, as its upload answered it.
 */
export type ChatImage = { 
/**
 * What names it in the server's store.
 */
id: string, 
/**
 * Its width, in pixels.
 */
width: number, 
/**
 * Its height, in pixels.
 */
height: number, };

/**
 * An option of a question.
 */
export type Choice = { letter: string, recommended: boolean, 
/**
 * The option's text, without its letter.
 */
summary: Array<Span>, 
/**
 * The item blocks of its `[pro]` and `[con]` bullets.
 */
pros: Array<number>, cons: Array<number>, 
/**
 * Its "Why recommended" item.
 */
why: number | null, 
/**
 * Its other nested blocks.
 */
other: Array<number>, 
/**
 * Its item block.
 */
block: number, };

/**
 * What a client sends.
 *
 * A `sub`, a `call`, and a `resume` carry an `id` the client picks, unique among the
 * subscriptions and the calls it has open on the connection: every answer names it.
 */
export type ClientMessage = { "type": "hello", protocol: number, signIn: SignIn, } | { "type": "sub", id: number, record: string, args: JsonValue, } | { "type": "unsub", id: number, } | { "type": "call", id: number, action: string, input: JsonValue, } | { "type": "resume", id: number, record: string, args: JsonValue, epoch: string, seq: number, };

export type CommentItem = { number: number, 
/**
 * The lines it points to, 0 for a general comment.
 */
startLine: number, endLine: number, heading: string | null, general: boolean, 
/**
 * The decision whose file the lines are of, `specs/decisions/<name>.md`, not the reviewed
 * file's.
 */
decision: string | null, 
/**
 * Whether the lines are of a part the branch removed from the decision, at the merge base.
 */
removed: boolean, quote: Array<string>, text: string, };

/**
 * `specs/CONSTITUTION.md`: its title, its version line's fields when it has them, and its
 * principles, the `### <number>. <title>` headings.
 */
export type Constitution = { title: string, 
/**
 * From `**Version**: 1.3.1 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-14`.
 */
version: string | null, ratified: string | null, amended: string | null, principles: Array<Principle>, document: Document, };

/**
 * A part of a round's context: a `###` sub-heading and its blocks.
 */
export type ContextPart = { 
/**
 * Its heading's block, or none for the triage's one free part.
 */
heading: number | null, 
/**
 * Its heading's text, empty without a heading.
 */
title: string, 
/**
 * Its top-level blocks.
 */
blocks: Array<number>, };

/**
 * A kind of automatic run, each with its switch in the settings.
 */
export type ContinueKind = "catch-up" | "limit" | "restart";

export type Criterion = { 
/**
 * `SC-001`.
 */
id: string, 
/**
 * The few words in parentheses after its id, `two clicks`.
 */
measure: string | null, 
/**
 * The item's spans after its id and its measure, and the `: ` or `): ` ending them, its marks
 * kept.
 */
sentence: Array<Span>, block: number, };

/**
 * A data model's items.
 */
export type DataModelItems = { 
/**
 * The top-level blocks before the first `##`, its `#` title aside.
 */
intro: Array<number>, sections: Array<DataSection>, };

/**
 * A `##` section of a data model: an entity.
 */
export type DataSection = { 
/**
 * Its heading's text.
 */
title: string, 
/**
 * Its heading's anchor.
 */
anchor: string, 
/**
 * Its heading's block.
 */
heading: number, 
/**
 * Its top-level blocks, deeper headings included, up to the next `##`.
 */
blocks: Array<number>, 
/**
 * The tables among its blocks.
 */
tables: Array<DataTable>, };

/**
 * A table of a data model, and the rows its "Change" column marks.
 */
export type DataTable = { 
/**
 * The table's block.
 */
block: number, 
/**
 * The index of its column headed "Change", from 0, the one whose cells show a row's change;
 * none without one.
 */
column: number | null, 
/**
 * Its marked rows, in order; none without a column headed "Change".
 */
changes: Array<RowChange>, };

/**
 * A decision of `specs/decisions/`.
 */
export type Decision = { 
/**
 * Its file name without `.md`, like `ui-behaviour`.
 */
name: string, 
/**
 * Its H1, else, or when it is unreadable, its name.
 */
title: string, 
/**
 * Its frontmatter's fields, when they are text.
 */
status: string | null, approvedBy: string | null, 
/**
 * A Lucide icon name, like `git-branch`.
 */
icon: string | null, 
/**
 * The first sentence of its first paragraph, when one comes before its first section.
 */
summary: string | null, 
/**
 * The date of the last commit of the default branch touching it, `YYYY-MM-DD`.
 */
changed: string | null, 
/**
 * Its file as read, frontmatter included: what a preview shows.
 */
text: string, document: Document, 
/**
 * The kept parts of its `## Rules` section, each with its strength and its check; empty for
 * an unreadable file or one without the section.
 */
rules: Array<PartChange>, 
/**
 * The first problem `ura check` finds in it.
 */
problem: string | null, 
/**
 * Whether it cannot be parsed, like a frontmatter that is not valid YAML: its title is then its
 * name, and nothing else read from it stands.
 */
unreadable: boolean, };

/**
 * The change of one decision, from its version at the merge base to the branch's.
 */
export type DecisionChange = { 
/**
 * The file's name, without `.md`.
 */
name: string, 
/**
 * Its `# ` heading, from the branch's version when it has one.
 */
title: string, 
/**
 * `new`, `changed`, or `removed`.
 */
kind: string, 
/**
 * Whether the spec's `## Decisions` lists it.
 */
listed: boolean, 
/**
 * Whether both versions could be read.
 */
compared: boolean, 
/**
 * The title and the frontmatter fields whose value differs, for a changed decision.
 */
fields: Array<FieldChange>, sections: Array<SectionChange>, };

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
 * The tree of one workflow file.
 */
export type Document = { blocks: Array<Block>, frontmatterLines: LineRange | null, 
/**
 * The SHA-256 of the text, in hexadecimal, to refuse saves over a change made elsewhere.
 */
hash: string, };

/**
 * A feature or a change dropped.
 */
export type Dropped = { 
/**
 * Its branch, which stays.
 */
branch: string, 
/**
 * Why its worktree stays, when it does.
 */
worktreeLeft: string | null, 
/**
 * Whether its proposal's removal from the priorities was committed: when not, it stays
 * written for the commit bar.
 */
committed: boolean, };

/**
 * A row of the `## Edge cases` table.
 */
export type EdgeCase = { 
/**
 * Its first cell's text, lowercased: `high`, `normal`, or `niche` when it is valid.
 */
importance: string, 
/**
 * Its row's block.
 */
row: number, };

/**
 * What an `error` is about.
 */
export type ErrorCode = "not-signed-in" | "bad-message" | "unknown-record" | "unknown-action" | "bad-args" | "bad-input" | "refused" | "conflict" | "hook" | "internal";

/**
 * A feature or a change, by its folder. Its value is `null` when no feature has that folder.
 */
export type Feature = { 
/**
 * The name the human gave it in the sidebar. No workflow rule reads it.
 */
label: string | null, 
/**
 * Whether it needs the human, works, or waits.
 */
status: FeatureStatus, 
/**
 * Whether its worktree, or else the main checkout, has an active preview decision.
 */
preview: boolean, 
/**
 * Its run options.
 */
runOptions: RunOptionsPair, 
/**
 * Its latest session, the one its runs go to: none before its first message.
 */
session: string | null, 
/**
 * Its sessions, the latest started first, without the archived ones.
 */
sessions: Array<string>, 
/**
 * The runtime of its latest session, which its runs go to: none before its first message.
 */
runtime: string | null, 
/**
 * What a session of it made without a pick runs on: none at a step no agent runs.
 */
newPick: NewPick | null, 
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

/**
 * A feature's count of changed files and of lines, as a card shows them.
 */
export type FeatureChanges = { 
/**
 * The feature's folder, which names it in a change.
 */
id: string, 
/**
 * Every changed file outside the feature's folder.
 */
count: number, 
/**
 * The lines added.
 */
added: number, 
/**
 * The lines removed.
 */
removed: number, };

/**
 * Drops a started feature or change: its proposal leaves the priorities, its worktree is removed
 * unless it has uncommitted changes, and its branch stays.
 */
export type FeatureDrop = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The feature's or the change's folder.
 */
folder: string, };

/**
 * Repairs the links of a done feature's record whose file moved or was deleted since, in the
 * default branch's checkout, without committing.
 */
export type FeatureFixLinks = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The feature's or the change's folder.
 */
folder: string, };

/**
 * Makes a change a feature, in place: its branch loses its `change/` prefix, its folder moves to
 * `specs/`, and **Now** links it.
 */
export type FeaturePromote = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The feature's or the change's folder.
 */
folder: string, };

/**
 * Keeps a feature's own run options, only what differs from the settings': they apply from its
 * next run.
 */
export type FeatureSetRunOptions = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The feature's or the change's folder.
 */
folder: string, 
/**
 * Its options: none set removes them.
 */
options: RunOptions, };

/**
 * Starts a proposal file as a feature, or as a change, in its own worktree.
 */
export type FeatureStart = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The proposal file, from the top level.
 */
proposal: string, 
/**
 * Its slug: the one the core proposes when none is given.
 */
slug?: string | null, 
/**
 * A feature when none is given.
 */
kind?: StartKind | null, };

/**
 * Starts a feature typed as a text: its first written line is its title.
 */
export type FeatureStartText = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The text, as typed.
 */
text: string, 
/**
 * Its slug.
 */
slug: string, 
/**
 * Its images, as their upload answered them.
 */
images?: Array<ChatImage> | null, 
/**
 * The text of the line of **Now** it was filled from, which its link replaces.
 */
line?: string | null, 
/**
 * The research effort its proposal asks for.
 */
discovery?: string | null, 
/**
 * Its own run options, only what differs from the settings'.
 */
options?: RunOptions | null, };

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
 * A field of a decision that differs between two versions: its `title`, or a frontmatter key.
 */
export type FieldChange = { name: string, 
/**
 * Its value in the merge base's version, `None` when it had none.
 */
before: string | null, 
/**
 * Its value in the branch's version, `None` when it has none.
 */
after: string | null, };

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
 * A workflow file: the version on disk, the version committed at its branch's tip when it
 * differs, and its pending review.
 */
export type FileView = { 
/**
 * `<folder>/<name>`.
 */
id: string, folder: string, name: string, 
/**
 * From the repository's top level.
 */
path: string, kind: string, status: string | null, current: VersionView, 
/**
 * The short hash of the branch's tip.
 */
tip: string | null, 
/**
 * The version at the tip, when it differs from `current`.
 */
committed: VersionView | null, 
/**
 * The items of its review file, `spec-review.md` for `spec.md`, when there is one.
 */
review: Items | null, 
/**
 * Whether the pending review comments on an older version of the file than its tip's.
 */
reviewStale: boolean, 
/**
 * Whether images can be attached to it: a feature's or a change's file can, the inbox's
 * triage, committed alone, cannot.
 */
takesImages: boolean, 
/**
 * Whether its round can be answered to continue the implementation: the feature is being
 * built, see `steps::building`.
 */
resumable: boolean, 
/**
 * For `spec.md`, the decisions its branch changed, and those its `## Decisions` lists: the
 * listed ones first, in the items' order, then the others by name. Empty for other files.
 */
decisionChanges: Array<DecisionChange>, 
/**
 * For the decisions check, each option's candidate decision against the active one, by
 * question and option. Empty for other files.
 */
candidates: Array<Candidate>, 
/**
 * For `spec.md` at revision 2 or later, the review that requested the revision, as it stood
 * when the revision was first committed: the one `## Your review` answers, whatever the review
 * file holds now. `None` when that review did not request changes.
 */
answered: ReviewItems | null, 
/**
 * For `spec.md`, what changed since the version that `answered` reviewed, the spec at its
 * commit against the one the page shows: the committed one while it waits for review. `None`
 * when `answered` is.
 */
sinceReview: SinceReview | null, };

/**
 * A write that made or moved a proposal file: where the file is now, for the page that opens.
 */
export type FileWritten = { 
/**
 * The file's path from the top level.
 */
path: string, 
/**
 * The change the write made.
 */
change: RecordedChange | null, };

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

/**
 * A feature's or a change's stages, and what it produced.
 */
export type HistoryView = { 
/**
 * The feature's or the change's folder.
 */
folder: string, stages: Array<StageView>, 
/**
 * The index of the current stage; `stages.len()` once merged.
 */
current: number, 
/**
 * Rounds of questions, when it had any.
 */
rounds: number | null, 
/**
 * Whether a done item's commits were found on the default branch: false after a squash merge,
 * or for one from before typed commits.
 */
found: boolean, 
/**
 * For a done item not found: its record's `finished` day, `YYYY-MM-DD`.
 */
finished: string | null, 
/**
 * The time from its first commit to its finish, in seconds.
 */
totalSeconds: number | null, 
/**
 * The lines and files it changed outside its folder and its record.
 */
lines: LinesView | null, 
/**
 * The questions a done item asked.
 */
questions: number | null, 
/**
 * The decisions a done item changed.
 */
decisions: Array<DecisionChange>, };

/**
 * `INBOX.md` read for editing.
 */
export type Inbox = { 
/**
 * The SHA-256 of the text, to refuse edits over a change made elsewhere.
 */
hash: string, 
/**
 * The categories that hold notes, the notes without one first, then in file order. Notes
 * under two headings of the same name are in one category.
 */
categories: Array<InboxCategory>, 
/**
 * Every category's name, once, in file order, empty ones included: what the add form offers.
 */
names: Array<string>, 
/**
 * How many notes it holds.
 */
count: number, 
/**
 * How many changes wait for a commit.
 */
changes: number, 
/**
 * The status of `INBOX-TRIAGE.md`, when there is one.
 */
triage: string | null, };

/**
 * Adds a note, at the end of its category.
 */
export type InboxAdd = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note, as markdown.
 */
text: string, 
/**
 * Its category: none for the notes without one.
 */
category?: string | null, 
/**
 * The folder of the feature or the change it is about: the note is marked with its slug.
 */
about?: string | null, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * Adds a category at the end of the inbox.
 */
export type InboxAddCategory = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The category's name.
 */
name: string, 
/**
 * The inbox's hash as read.
 */
hash: string, };

export type InboxCategory = { 
/**
 * `None` for the notes before the first category.
 */
name: string | null, notes: Array<InboxNote>, };

/**
 * Drops a note, or with `at` its nested item, its own items with it: under the note `under`, or
 * with `underAt` under its nested item, or else into `category`, at `index` there.
 */
export type InboxDrop = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The nested item dragged, by its index: none for the note.
 */
at?: number | null, 
/**
 * Its place where it lands, counted once it left.
 */
index: number, 
/**
 * The category it lands in: none for the notes without one.
 */
category?: string | null, 
/**
 * The note it lands under.
 */
under?: string | null, 
/**
 * That note's nested item it lands under.
 */
underAt?: number | null, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * Replaces a note's text. It is not undone: the field's own undo is.
 */
export type InboxEdit = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * Its new text, as markdown.
 */
text: string, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * Moves a note into a proposal file: a single file made a folder for a note file's images
 * moves, and the answer says where it is.
 */
export type InboxIntoProposal = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The proposal file, from the top level.
 */
file: string, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * Moves a note with a note file into a line of the priorities without a file: the line gets its
 * proposal file first.
 */
export type InboxIntoProposalLine = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The proposal's id, like `now-2`.
 */
proposal: string, 
/**
 * The inbox's hash as read.
 */
hash: string, 
/**
 * The priorities' hash as read.
 */
prioritiesHash: string, };

/**
 * Moves a note to the end of a category.
 */
export type InboxMoveCategory = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The category: none for the notes without one.
 */
category?: string | null, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * A note of `INBOX.md`, for editing.
 */
export type InboxNote = { 
/**
 * `note-3`: its place in the file, from 1.
 */
id: string, 
/**
 * Its address: the slug of its text, made unique.
 */
key: string, 
/**
 * The markdown of its text, after its marker and marks, on one line.
 */
text: string, spans: Array<Span>, agent: boolean, 
/**
 * The slug of the feature or change it is about.
 */
about: string | null, 
/**
 * The path of its note file, the file of `specs/notes/` its whole text links to, from the
 * repository's top level.
 */
file: string | null, 
/**
 * The markdown of that link's text, unescaped: a note added as a file as it was typed, which
 * an add whose answer was lost finds it by.
 */
fileTitle: string | null, 
/**
 * The images its note file links, in order, from the repository's top level: filled in from
 * the file, where it is read. Empty for a note with no file.
 */
images: Array<string>, startLine: number, endLine: number, 
/**
 * Its lines as written, sub-items included.
 */
lines: Array<string>, 
/**
 * Its nested lines, as written.
 */
nested: Array<string>, 
/**
 * The text of each nested item, without its marker.
 */
nestedSpans: Array<Array<Span>>, 
/**
 * Its nested items at any depth, in the order of the file: what its outline shows, and what an
 * edit of one names by its index.
 */
children: Array<NestedItem>, };

/**
 * Edits a note's outline: the note, or with `at`, its nested item at `at` in the order of the
 * file.
 */
export type InboxOutline = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The nested item, by its index among the note's nested items: none for the note.
 */
at?: number | null, 
/**
 * `edit`, `insert-below`, `insert-above`, `append-child`, `remove`, `indent`, `outdent`,
 * `up`, or `down`.
 */
kind: string, 
/**
 * The line the kinds that write one write.
 */
text?: string | null, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * Moves a note before the note at `index` of a category, or to its end.
 */
export type InboxPlace = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The category: none for the notes without one.
 */
category?: string | null, 
/**
 * Its place there, from 0.
 */
index: number, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * Removes a note, its nested lines and its note file with it.
 */
export type InboxRemove = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * Deletes a category.
 */
export type InboxRemoveCategory = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The category's name.
 */
name: string, 
/**
 * Whether its notes stay, without a category, or go with it.
 */
keepNotes: boolean, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * Takes an image out of a note file or a proposal file: the lines linking it go, and its file
 * stays until the next commit.
 */
export type InboxRemoveImage = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note file or the proposal file, from the top level.
 */
file: string, 
/**
 * The image, from the top level.
 */
image: string, 
/**
 * The file's hash as read.
 */
hash: string, };

/**
 * Renames a category, every heading of its name.
 */
export type InboxRenameCategory = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * Its name now.
 */
from: string, 
/**
 * Its new name.
 */
to: string, 
/**
 * The inbox's hash as read.
 */
hash: string, };

/**
 * Moves a note to the end of a section of the priorities, as a line.
 */
export type InboxToProposal = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The section's id: `now`, `next`, `later`, or `blocked`.
 */
section: string, 
/**
 * The inbox's hash as read.
 */
hash: string, 
/**
 * The priorities' hash as read.
 */
prioritiesHash: string, };

/**
 * Moves a note to the end of a section of the priorities, as a proposal file its line links.
 */
export type InboxToProposalFile = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The section's id: `now`, `next`, `later`, or `blocked`.
 */
section: string, 
/**
 * The inbox's hash as read.
 */
hash: string, 
/**
 * The priorities' hash as read.
 */
prioritiesHash: string, };

/**
 * Moves a note under a proposal of the priorities, as a nested line.
 */
export type InboxUnderProposal = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The note's id, like `note-3`.
 */
note: string, 
/**
 * The proposal's id, like `now-2`.
 */
proposal: string, 
/**
 * The inbox's hash as read.
 */
hash: string, 
/**
 * The priorities' hash as read.
 */
prioritiesHash: string, };

/**
 * Which thing of a repository: a feature, a workflow file, a proposal file.
 */
export type ItemArgs = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * What names the thing there: a feature's folder, a file's `<folder>/<name>`, a proposal
 * file's path from the top level.
 */
id: string, };

/**
 * What a list item is, from its marker: a task, a typed bullet (`[pro]`, `[con]`, `[?]`, `[!]`),
 * or a list callout (`!`, `?`, `&`).
 */
export type ItemMarker = "plain" | "task" | "pro" | "con" | "question" | "important" | "warning" | "ask" | "note";

/**
 * Sets the name a feature or a change shows in the sidebar. No workflow rule reads it.
 */
export type ItemSettings = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The feature's or the change's folder.
 */
folder: string, 
/**
 * The name: none, or an empty one, removes it.
 */
label?: string | null, };

/**
 * The items of a file, by its kind: at most one field is set.
 */
export type Items = { clarifications: RoundItems | null, spec: SpecItems | null, plan: PlanItems | null, dataModel: DataModelItems | null, review: ReviewItems | null, rulings: Array<Ruling> | null, };

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
 * The constitution and the decisions of the default branch, kept live.
 */
export type Ledger = { 
/**
 * The constitution: none without `specs/CONSTITUTION.md`.
 */
constitution: Constitution | null, 
/**
 * The decisions, by file name: none without `specs/decisions/`.
 */
decisions: Array<Decision>, 
/**
 * Every problem `ura check` finds in the decisions.
 */
problems: Array<ProblemView>, 
/**
 * The status of `DECISIONS-CHECK.md`: none when there is no check.
 */
decisionsCheck: string | null, };

/**
 * Lines of a file, 1-based and inclusive.
 */
export type LineRange = { start: number, end: number, };

/**
 * Lines added and removed, over a number of files.
 */
export type LinesView = { added: number, removed: number, files: number, };

/**
 * The proposal file a proposal of the priorities links, as it is on the default branch.
 */
export type LinkedFile = { 
/**
 * From the top level: `specs/proposals/x.md`, `specs/proposals/y/proposal.md`.
 */
path: string, };

/**
 * A write of the inbox or of the priorities: the list's hash as written, which the next write
 * is made over, and the change to undo, none for a write that is not undone.
 */
export type ListWritten = { 
/**
 * The SHA-256 of the list's text now.
 */
hash: string, 
/**
 * The change the write made.
 */
change: RecordedChange | null, };

/**
 * An item of `## Decisions`: a decision the spec creates, changes, or removes.
 */
export type ListedDecision = { 
/**
 * `new`, `changed`, or `removed`.
 */
kind: string, 
/**
 * The decision file's stem, `task-storage`.
 */
name: string, 
/**
 * Its link's text, or a removed decision's bold title.
 */
title: string, 
/**
 * Its list item.
 */
block: number, };

/**
 * The feature or change a proposal of the priorities links, once its step is `done`: merged, its
 * line left for `ura clean` to remove.
 */
export type MergedFeature = { folder: string, 
/**
 * Whether it is a change.
 */
change: boolean, 
/**
 * Its pull request, from its record's `pull-request`.
 */
pullRequest: PullRequestView | null, };

/**
 * A paragraph that embeds an HTML mockup.
 */
export type MockupEmbed = { 
/**
 * The mockup's page, from the repository's top level, without its query or anchor.
 */
path: string, 
/**
 * The link's anchor, after its `#`.
 */
anchor: string | null, 
/**
 * The link's query, after its `?` and before its `#`, as written, `w` included: the state the
 * page shows, as `doc=plan&w=1440`.
 */
query: string | null, 
/**
 * The width it shows at, in pixels: its `?w=` query's, or 1440.
 */
width: number, 
/**
 * The link's text.
 */
label: string, 
/**
 * The paragraph's block.
 */
block: number, };

/**
 * A link of a spec's story to an HTML file under `mockups/`, or to a story.
 */
export type MockupLink = { 
/**
 * `mockups/repeat.html`, from the spec's folder, or a story's stories file, from the
 * repository's top level.
 */
path: string, 
/**
 * The link's text.
 */
label: string, 
/**
 * The selectable block holding the link: its list item, row, or paragraph.
 */
block: number, 
/**
 * The story it names, when it is a story link.
 */
story: StoryTarget | null, };

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
 * An item nested under a list's item, for editing: its address, its depth, and its text.
 */
export type NestedItem = { 
/**
 * Its address, `<item's key>/<slug of its text>`, unique under its item as the items' keys
 * are: stable while its text stays.
 */
key: string, 
/**
 * 1 for the item's own items, 2 for theirs, ...
 */
depth: number, 
/**
 * The markdown of its text, after its marker, on one line.
 */
text: string, spans: Array<Span>, };

/**
 * What a new session of a feature runs on, when the human picks nothing.
 */
export type NewPick = { 
/**
 * The agent's runtime.
 */
runtime: string, 
/**
 * The model: none for the agent's default.
 */
model: string | null, 
/**
 * The effort: none for the agent's default.
 */
effort: string | null, };

/**
 * A note moved from the inbox to the priorities: both lists changed, and their records show
 * them.
 */
export type NoteMoved = { 
/**
 * The change the move made.
 */
change: RecordedChange | null, };

/**
 * One operation of a change.
 *
 * A list takes `insert`, `remove`, and `move` only when each of its items is a record with an
 * `id`, a text no other item of the list has: any other list changes whole, by `set`.
 */
export type Op = { "op": "set", path: Array<string>, value: JsonValue, } | { "op": "append", path: Array<string>, text: string, } | { "op": "insert", path: Array<string>, value: JsonValue, before?: string | null, } | { "op": "remove", path: Array<string>, } | { "op": "move", path: Array<string>, before?: string | null, };

/**
 * A paragraph or a list item of a decision, compared.
 */
export type PartChange = { 
/**
 * `kept`, `changed`, `added`, or `removed`.
 */
kind: string, 
/**
 * A list item's strength, as `Strength::as_str` names it.
 */
strength: string | null, 
/**
 * Its lines in the merge base's version, from the file's first line.
 */
before: LineRange | null, 
/**
 * Its lines in the branch's version, from the file's first line.
 */
after: LineRange | null, 
/**
 * The part's words. For a rule, the words before its check.
 */
runs: Array<Run>, 
/**
 * For a rule, the words of its check, from "Checked by"; empty for any other part.
 */
check: Array<Run>, };

export type PlanItems = { 
/**
 * Its lead paragraphs, "**Goal:**" and the like, before its first `##`.
 */
lead: Array<PlanLead>, tasks: Array<TaskItem>, };

/**
 * A plan's lead paragraph: a top-level paragraph before the first `##` whose first span is bold
 * text ending in ":", such as "**Goal:**".
 */
export type PlanLead = { 
/**
 * The bold text without its colon: `Goal`, `Architecture`, `Spec`.
 */
label: string, 
/**
 * The paragraph's block.
 */
block: number, 
/**
 * The paragraph's spans without the bold label and the space after it, which its pane's title
 * says: empty for a label alone.
 */
text: Array<Span>, };

/**
 * A principle of the constitution.
 */
export type Principle = { 
/**
 * Its Roman numeral, like `IV`.
 */
number: string, 
/**
 * Its numeral in lower case, like `iv`, for its address.
 */
slug: string, title: string, 
/**
 * The ids of its heading and of the top-level blocks under it, up to the next heading of its
 * level or above, in the constitution's document.
 */
blocks: Array<number>, };

/**
 * `PRIORITIES.md` read for editing.
 */
export type Priorities = { 
/**
 * The SHA-256 of the text, to refuse edits over a change made elsewhere.
 */
hash: string, sections: Array<SectionItems>, 
/**
 * How many proposals were added, moved, edited, or removed since the last commit.
 */
changes: number, 
/**
 * The changes the commit would hold, each as a line: what the Git page shows.
 */
changeLines: Array<string>, };

/**
 * Commits the priorities alone.
 */
export type PrioritiesCommit = { 
/**
 * The repository's name in the list.
 */
repo: string, };

/**
 * Restores the committed priorities.
 */
export type PrioritiesDiscard = { 
/**
 * The repository's name in the list.
 */
repo: string, };

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
 * A change made a feature, in place.
 */
export type PromotedView = { folder: string, 
/**
 * The feature's branch, the folder's name.
 */
branch: string, 
/**
 * The decisions the change applied, proposed again for the feature's spec.
 */
decisions: Array<string>, };

/**
 * A proposal file, a postponed folder's proposal, a note file, or a feature's or a change's
 * proposal, for its editor.
 */
export type ProposalFileView = { 
/**
 * From the repository's top level.
 */
path: string, title: string, text: string, hash: string, document: Document, 
/**
 * The stories its paragraphs embed.
 */
stories: Array<StoryLink>, 
/**
 * The HTML mockups its paragraphs embed.
 */
mockups: Array<MockupEmbed>, 
/**
 * Whether its current text is committed.
 */
committed: boolean, 
/**
 * The proposal of `PRIORITIES.md` linking it.
 */
proposal: ProposalView | null, 
/**
 * How many changes of `PRIORITIES.md` are not committed, which its commit takes along.
 */
priorityChanges: number, 
/**
 * `proposal-file` for a file of `specs/proposals/`, `note-file` for a file of `specs/notes/`,
 * or `proposal` for a feature's or a change's.
 */
kind: string, 
/**
 * The feature's or the change's folder, for a proposal.
 */
folder: string | null, 
/**
 * The slug Start gives a proposal file's feature unless another is typed.
 */
slug: string | null, 
/**
 * The effort its `discovery` field asks for, `high` by default.
 */
discovery: string | null, 
/**
 * The discovery efforts it may ask for, from the least research to the most.
 */
discoveryLevels: Array<string>, 
/**
 * Whether it holds more than its title and What: text in any other part of it.
 */
written: boolean, 
/**
 * The headings of its `##` sections that hold no text yet.
 */
emptySections: Array<string>, };

/**
 * A section of the proposal template, with the guidance the editor shows while it is empty.
 */
export type ProposalHint = { heading: string, hint: string, };

/**
 * The proposal template's guidance, by heading, which the editor shows in empty sections. It
 * never changes while the server runs.
 */
export type ProposalHints = { 
/**
 * Each section of the template, in its order.
 */
hints: Array<ProposalHint>, };

/**
 * A proposal of `PRIORITIES.md`, for editing: its markdown, its spans, and its nested lines.
 */
export type ProposalItem = { 
/**
 * `next-2`: its section and its position in it, from 1.
 */
id: string, 
/**
 * Its address, stable while its text or file stays: see the core's `keys`.
 */
key: string, 
/**
 * The markdown of its text, after its marker, on one line.
 */
text: string, spans: Array<Span>, startLine: number, endLine: number, 
/**
 * Its lines as written, its marker, wrapped text, and nested lines included.
 */
lines: Array<string>, 
/**
 * Its nested lines, as written.
 */
nested: Array<string>, 
/**
 * The text of each nested item, without its marker.
 */
nestedSpans: Array<Array<Span>>, 
/**
 * Its nested items at any depth, in the order of the file: what its outline shows, and what
 * an edit of one names by its index.
 */
children: Array<NestedItem>, 
/**
 * The proposal file it links, when it exists: set by the workspace, see
 * `Workspace::join_priorities`.
 */
file: LinkedFile | null, 
/**
 * The feature or change it links, while it runs: set by the workspace.
 */
running: RunningFeature | null, 
/**
 * The feature or change it links, once merged: set by the workspace.
 */
merged: MergedFeature | null, };

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
 * Adds a line at the end of a section.
 */
export type ProposalsAdd = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The section's id: `now`, `next`, `later`, or `blocked`.
 */
section: string, 
/**
 * The line, as markdown.
 */
text: string, 
/**
 * The priorities' hash as read.
 */
hash: string, };

/**
 * Drops a proposal, or with `at` its nested item, its own items with it: under the proposal
 * `under`, or with `underAt` under its nested item, or else into `section`, at `index` there.
 */
export type ProposalsDrop = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The proposal's id, like `next-2`.
 */
proposal: string, 
/**
 * The nested item dragged, by its index: none for the proposal.
 */
at?: number | null, 
/**
 * Its place where it lands, counted once it left.
 */
index: number, 
/**
 * The section it lands in.
 */
section?: string | null, 
/**
 * The proposal it lands under.
 */
under?: string | null, 
/**
 * That proposal's nested item it lands under.
 */
underAt?: number | null, 
/**
 * The priorities' hash as read.
 */
hash: string, };

/**
 * Replaces a proposal's text.
 */
export type ProposalsEdit = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The proposal's id, like `next-2`.
 */
proposal: string, 
/**
 * Its new text, as markdown.
 */
text: string, 
/**
 * The priorities' hash as read.
 */
hash: string, };

/**
 * Expands a proposal into a proposal file, which its line then links.
 */
export type ProposalsExpand = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The proposal's id, like `next-2`.
 */
proposal: string, 
/**
 * The priorities' hash as read.
 */
hash: string, };

/**
 * Moves a proposal before the line at `index` of a section, or to its end.
 */
export type ProposalsMove = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The proposal's id, like `next-2`.
 */
proposal: string, 
/**
 * The section it goes to.
 */
section: string, 
/**
 * Its place there, from 0.
 */
index: number, 
/**
 * The priorities' hash as read.
 */
hash: string, };

/**
 * Edits a proposal's outline: the line, or with `at`, its nested item at `at` in the order of
 * the file.
 */
export type ProposalsOutline = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The proposal's id, like `next-2`.
 */
proposal: string, 
/**
 * The nested item, by its index among the proposal's nested items: none for the line.
 */
at?: number | null, 
/**
 * `edit`, `insert-below`, `insert-above`, `append-child`, `remove`, `indent`, `outdent`,
 * `up`, or `down`.
 */
kind: string, 
/**
 * The line the kinds that write one write.
 */
text?: string | null, 
/**
 * The priorities' hash as read.
 */
hash: string, };

/**
 * Removes a proposal and its nested lines.
 */
export type ProposalsRemove = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The proposal's id, like `next-2`.
 */
proposal: string, 
/**
 * The priorities' hash as read.
 */
hash: string, };

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

export type QuestionItem = { 
/**
 * `Q2`, or `Q2.B`.
 */
id: string, parent: string | null, 
/**
 * The parent's option a follow-up depends on.
 */
parentLetter: string | null, title: string, startLine: number, endLine: number, headingBlock: number, 
/**
 * Its context: the blocks between its heading and its answer, options and "Why it matters"
 * aside.
 */
context: Array<number>, 
/**
 * Its paragraph starting "Why it matters".
 */
why: number | null, 
/**
 * Its "Why it matters" paragraph's spans without the lead, which its pane's title says, nor the
 * ":", "." or "—" after it, its first letter capitalised: empty without the paragraph.
 */
whyText: Array<Span>, 
/**
 * Its first paragraph starting "Example:", left out of its context.
 */
example: number | null, 
/**
 * Its example's spans without "Example:", its first letter capitalised: empty without one.
 */
exampleText: Array<Span>, options: Array<Choice>, answer: string, 
/**
 * The answer split as the UI composes it.
 */
letters: Array<string>, comment: string, 
/**
 * `yes` or `no`: whether it needs an answer, from its parent's letters.
 */
applies: string, 
/**
 * Whether the round asks it now: it may apply, and a follow-up's parent has an answer.
 */
asked: boolean, 
/**
 * The line of its `**Answer:**` marker, or 0.
 */
answerLine: number, };

/**
 * The one workflow message that applies to a feature now, by its folder, which its session's
 * composer offers; or why none does, with an empty text. Its value is `null` when no feature
 * has that folder.
 */
export type RecommendedMessage = { 
/**
 * What the message does, like `Continue, write the plan`.
 */
name: string | null, 
/**
 * Why no message is recommended.
 */
reason: string | null, 
/**
 * The step it starts.
 */
step: string | null, 
/**
 * The message: empty with a reason.
 */
text: string, 
/**
 * What sending it counts as.
 */
trigger: Trigger | null, };

/**
 * The change a write made to the files of `specs/`: what undoing it takes. A client keeps it,
 * and hands it back to undo or redo the write.
 */
export type RecordedChange = { 
/**
 * The commit the files' checkout was at.
 */
commit: string | null, 
/**
 * Each file the write changed, and each it left as it was that is kept with the change.
 */
files: Array<RecordedFile>, };

/**
 * A file of a change, by its path from the top level, with its bytes on each side in base64:
 * none on the side where it did not exist.
 */
export type RecordedFile = { 
/**
 * Its path from the top level.
 */
path: string, 
/**
 * Its bytes before the write.
 */
before: string | null, 
/**
 * Its bytes after it.
 */
after: string | null, };

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
 * Which repository.
 */
export type RepositoryArgs = { 
/**
 * The repository's name in the list.
 */
repo: string, };

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
 * An answer of `## Your review` to a comment of the last review:
 * `- **C2** (undo too short): done. The undo stays 5 seconds.`
 */
export type ReviewAnswer = { 
/**
 * The comment's number in the last review file.
 */
number: number, 
/**
 * The comment in a few words, from the parentheses.
 */
summary: string, 
/**
 * `done` or `declined`.
 */
verdict: string, 
/**
 * Its list item.
 */
block: number, };

export type ReviewItems = { verdict: string, commit: string, summary: string | null, comments: Array<CommentItem>, };

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

export type RoundItems = { status: string | null, 
/**
 * The `> [!IMPORTANT]` block, or its `> [!NOTE]` record.
 */
block: number | null, 
/**
 * The block's verdict, from its item starting "Verdict: ".
 */
verdict: RoundVerdict | null, 
/**
 * The parts of the round's context section, in file order.
 */
context: Array<ContextPart>, questions: Array<QuestionItem>, 
/**
 * The groups of the points settled without the human: the `## Check these` section, then the
 * `###` groups of `## Settled without the human`, up to the `**Notes:**` line.
 */
settledGroups: Array<SettledGroup>, 
/**
 * The settled points that start in bold, which take comments, the points to check included.
 */
settledPoints: Array<SettledPoint>, 
/**
 * The free notes, trimmed, without the comments on settled points.
 */
notes: string | null, notesLine: number | null, 
/**
 * The comments on settled points, written at the end of the notes.
 */
settledComments: Array<SettledComment>, };

/**
 * The block's item starting "Verdict: ", then one of the three phrases.
 */
export type RoundVerdict = { kind: VerdictKind, 
/**
 * Its list item's block.
 */
item: number, 
/**
 * The item's spans after the phrase and its following ":" or ",", trimmed, the first letter
 * capitalised.
 */
text: Array<Span>, };

/**
 * A row of a data model's table, and its change.
 */
export type RowChange = { 
/**
 * The row's block.
 */
row: number, kind: RowChangeKind, };

/**
 * What a data model's row does: its "Change" cell, "New", "Changed", or "Removed".
 */
export type RowChangeKind = "new" | "changed" | "removed";

export type Ruling = { 
/**
 * `R1`.
 */
id: string, title: string, headingBlock: number, blocks: Array<number>, };

/**
 * Words of a part, joined with single spaces, all `kept`, `added`, or `removed`.
 */
export type Run = { kind: string, text: string, };

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
 * A feature's run options: its own, and what its next run starts on.
 */
export type RunOptionsPair = { 
/**
 * Only what the feature changed, which `feature.setRunOptions` keeps.
 */
own: RunOptions, 
/**
 * The core's merge of them over the settings' run options.
 */
merged: RunOptions, };

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
 * The feature or change a proposal of the priorities links, while its step is not `done`.
 */
export type RunningFeature = { folder: string, 
/**
 * Whether it is a change.
 */
change: boolean, step: StepView, };

export type Scenario = { number: number, block: number, 
/**
 * Its steps, from its bold Given, When, and Then.
 */
steps: Array<ScenarioStep>, };

/**
 * A step of a scenario: its word, and the spans up to the next step, without the blanks and the
 * comma the word leaves before them.
 */
export type ScenarioStep = { 
/**
 * Given, When, or Then; empty for the spans before the first step.
 */
word: string, spans: Array<Span>, };

/**
 * A section of a decision: the intent before the first `##`, titled `""`, then each `##`.
 */
export type SectionChange = { title: string, parts: Array<PartChange>, };

export type SectionItems = { 
/**
 * `now`, `next`, `later`, or `blocked`.
 */
section: string, title: string, 
/**
 * The text of the first callout under the first of its headings that has one, before its
 * first proposal: what the section holds.
 */
context: string | null, proposals: Array<ProposalItem>, };

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
 * A comment on a settled point: a bullet of the notes, `- **<subject>**: <text>`.
 */
export type SettledComment = { 
/**
 * 1-based, in the notes' order.
 */
number: number, subject: string, 
/**
 * The block of the first settled point with that subject.
 */
point: number, 
/**
 * Its text, without the bullet, the subject, or the indentation.
 */
text: string, };

/**
 * A group of the points settled without the human: the `## Check these` section, or a `###`
 * sub-heading of the settled section, and its blocks.
 */
export type SettledGroup = { 
/**
 * Its heading's block: the `##` heading of the points to check, a `###` heading otherwise.
 */
heading: number, 
/**
 * Its kind, from its heading.
 */
kind: SettledKind, 
/**
 * Its top-level blocks, before the `**Notes:**` line.
 */
blocks: Array<number>, 
/**
 * How many points it holds: the items of its lists that start in bold, as `settled_points`
 * gives them.
 */
points: number, };

/**
 * The kind of a settled group: `## Check these`, or the settled section's `### Behaviour` or
 * `### Under the hood`.
 */
export type SettledKind = "check" | "behaviour" | "hood";

/**
 * A point settled without the human, by its bold start.
 */
export type SettledPoint = { 
/**
 * Its list item's block.
 */
block: number, 
/**
 * Its bold start, trimmed.
 */
subject: string, };

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
 * A part of a spec that changed since its review.
 */
export type SinceChange = { 
/**
 * `changed`, `added`, or `removed`.
 */
kind: string, 
/**
 * The text of the nearest heading above the part, on its side: the reviewed one's for a
 * removed part.
 */
heading: string, 
/**
 * Its lines in the reviewed version, from the file's first line.
 */
before: LineRange | null, 
/**
 * Its lines in the version shown, from the file's first line.
 */
after: LineRange | null, 
/**
 * Its words, as a decision's part gives them.
 */
runs: Array<Run>, };

/**
 * A spec's change since the version reviewed by the review its revision answers.
 */
export type SinceReview = { 
/**
 * The reviewed revision.
 */
revision: number, 
/**
 * Whether the review's commit resolves and holds the spec; `parts` is empty when not.
 */
found: boolean, 
/**
 * The parts changed, added, or removed, in the order of the version shown, a removed part
 * at the place it held. Kept parts are left out.
 */
parts: Array<SinceChange>, };

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
 * A run of text with the same marks. An image's span holds its alt text.
 */
export type Span = { text: string, strong: boolean, emphasis: boolean, code: boolean, strike: boolean, link: SpanLink | null, image: SpanImage | null, };

/**
 * An image of a span: its target as written, and the file it shows in the repository.
 */
export type SpanImage = { target: string, 
/**
 * The file from the repository's top level; absent for an image on the web or in a URI,
 * such as `data:`.
 */
path: string | null, };

/**
 * A link of a span: its target as written, and the file it points to in the repository.
 */
export type SpanLink = { target: string, wiki: boolean, 
/**
 * The file from the repository's top level; absent for a web link, a URI, or an anchor in
 * the page.
 */
path: string | null, 
/**
 * The story it names, when it is a story link.
 */
story: StoryTarget | null, 
/**
 * The part of its target after `#`, when not empty: a heading of the file it opens.
 */
anchor: string | null, };

export type SpecItems = { stories: Array<Story>, criteria: Array<Criterion>, 
/**
 * The frontmatter's `risk-tier` and `plan-review`, which an approval may change.
 */
riskTier: string | null, planReview: boolean | null, 
/**
 * The risk tiers an approval may pick, from the least risk to the most.
 */
tiers: Array<TierChoice>, 
/**
 * The story and HTML mockups the stories link, in file order.
 */
mockups: Array<MockupLink>, 
/**
 * The block: the first top-level callout before the first level-2 heading.
 */
block: number | null, 
/**
 * The block's time, the number before "minutes" in its first paragraph.
 */
minutes: number | null, 
/**
 * The block's first list item starting "You approve".
 */
approve: number | null, 
/**
 * The items of `## Your review`.
 */
answers: Array<ReviewAnswer>, 
/**
 * The items of `## Decisions`, each decision once; not the "Relied on" table.
 */
decisions: Array<ListedDecision>, 
/**
 * Each level-2 section, in file order.
 */
parts: Array<SpecPart>, 
/**
 * The rows of the `## Edge cases` table, its header aside.
 */
edges: Array<EdgeCase>, 
/**
 * The bold-led list items of `## Architecture` before its paragraph "Tradeoffs:".
 */
units: Array<number>, 
/**
 * The list items of `## Architecture` after its paragraph "Tradeoffs:".
 */
tradeoffs: Array<number>, 
/**
 * The principles of the `## Constitution check` table.
 */
principles: Array<SpecPrinciple>, };

/**
 * A level-2 section of a spec, in file order.
 */
export type SpecPart = { title: string, 
/**
 * Its heading's anchor, `user-stories`.
 */
anchor: string, 
/**
 * Its heading's block.
 */
heading: number, 
/**
 * Its top-level blocks after the heading, deeper headings included, up to the next level-1
 * or level-2 heading.
 */
blocks: Array<number>, };

/**
 * A principle of the `## Constitution check` table: a header cell, and the cell below it.
 */
export type SpecPrinciple = { 
/**
 * The header cell's text, `I. Humans in control`.
 */
label: string, 
/**
 * Whether the cell below holds ✅.
 */
ok: boolean, };

/**
 * A stage, and when it started.
 */
export type StageView = { 
/**
 * `proposal`, `questions`, `spec`, `plan`, `build`, `fix`, `pull-request`, or `merged`.
 */
name: string, 
/**
 * RFC 3339, UTC.
 */
started: string | null, };

/**
 * What a start makes.
 */
export type StartKind = "feature" | "change";

/**
 * A feature started: what its session page opens with.
 */
export type StartPlan = { 
/**
 * Its folder.
 */
folder: string, 
/**
 * Its name, its line in the priorities.
 */
title: string, 
/**
 * The workflow's message of its first step, which its session's composer holds.
 */
message: string, };

/**
 * Why a status needs the human, or works with no turn running.
 */
export type StatusReason = "blocked" | "step" | "failed" | "stopped" | "interrupted" | "halted" | "conflict" | "capped" | "waiting";

export type StepItem = { block: number, checked: boolean, };

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

export type Story = { 
/**
 * `US2`.
 */
id: string, title: string, 
/**
 * `P1`.
 */
priority: string, headingBlock: number, 
/**
 * Its top-level blocks after the heading.
 */
blocks: Array<number>, 
/**
 * Its "Why this priority" paragraph.
 */
why: number | null, 
/**
 * Its first paragraph holding only a story link, or a link to an HTML mockup.
 */
mockup: number | null, 
/**
 * The list after its paragraph "Key scenarios:".
 */
key: Array<Scenario>, 
/**
 * That paragraph and its list, among `blocks`; none without the list.
 */
keyBlocks: Array<number>, 
/**
 * The list after its paragraph "More scenarios:".
 */
more: Array<Scenario>, 
/**
 * That paragraph and its list, among `blocks`, which the page folds; none without the list.
 */
moreBlocks: Array<number>, };

/**
 * A paragraph that embeds a story.
 */
export type StoryLink = { 
/**
 * The stories file, from the repository's top level.
 */
path: string, 
/**
 * The export's name.
 */
export: string, 
/**
 * The link's text.
 */
label: string, 
/**
 * The paragraph's block.
 */
block: number, };

/**
 * The story a link names.
 */
export type StoryTarget = { 
/**
 * The stories file, from the repository's top level.
 */
path: string, 
/**
 * The export's name.
 */
export: string, };

export type TaskItem = { number: number, title: string, headingBlock: number, steps: Array<StepItem>, done: number, total: number, };

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
 * A risk tier an approval may pick, and whether the plan then waits for the human's review,
 * unless the human says otherwise.
 */
export type TierChoice = { value: string, planReview: boolean, };

/**
 * What started a workflow turn, which its message tells the agent.
 */
export type Trigger = "answers" | "approval" | "catch-up" | "changes" | "comments" | "proposal" | "start" | "manual" | "next-step";

/**
 * The verdict of a round's block, by its phrase.
 */
export type VerdictKind = "as-proposed" | "with-changes" | "not-as-proposed";

/**
 * A file's document and items, at one version.
 */
export type VersionView = { text: string, document: Document, items: Items, 
/**
 * The stories its paragraphs embed.
 */
stories: Array<StoryLink>, 
/**
 * The HTML mockups its paragraphs embed.
 */
mockups: Array<MockupEmbed>, };

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
 * The workflow's message for a feature and a trigger, which the composer is filled with. Its
 * value is `null` when no feature has that folder.
 */
export type WorkflowMessage = { 
/**
 * Why there is no message: the feature has no branch, or does not wait on the agent.
 */
refusal: string | null, 
/**
 * The step the message starts.
 */
step: string, 
/**
 * The message: empty with a refusal.
 */
text: string, };

/**
 * Which workflow message: a feature's, for what starts its run.
 */
export type WorkflowMessageArgs = { 
/**
 * The repository's name in the list.
 */
repo: string, 
/**
 * The feature's or the change's folder.
 */
folder: string, 
/**
 * What starts the run: `comments` gives the comments message, whatever the step.
 */
trigger: Trigger, };

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
  AllBranchChanges: { args: RepositoryArgs; value: AllBranchChanges };
  BranchChanges: { args: ItemArgs; value: BranchChanges };
  BranchDecision: { args: ItemArgs; value: BranchDecision | null };
  Devices: { args: null; value: Devices };
  Feature: { args: ItemArgs; value: Feature | null };
  FolderSuggestions: { args: FolderSuggestionsArgs; value: FolderSuggestions };
  History: { args: ItemArgs; value: HistoryView };
  Inbox: { args: RepositoryArgs; value: Inbox };
  Ledger: { args: RepositoryArgs; value: Ledger };
  NeedsYouList: { args: null; value: NeedsYouList };
  Priorities: { args: RepositoryArgs; value: Priorities };
  ProposalFile: { args: ItemArgs; value: ProposalFileView };
  ProposalHints: { args: null; value: ProposalHints };
  RecommendedMessage: { args: ItemArgs; value: RecommendedMessage | null };
  Repositories: { args: null; value: Repositories };
  Settings: { args: null; value: Settings };
  SlugProposal: { args: SlugProposalArgs; value: SlugProposal };
  Themes: { args: null; value: Themes };
  WorkflowFile: { args: ItemArgs; value: FileView | null };
  WorkflowMessage: { args: WorkflowMessageArgs; value: WorkflowMessage | null };
  Workspace: { args: WorkspaceArgs; value: Workspace };
};

/** Every action, by the name a `call` gives: its input, and its output. */
export type Actions = {
  "change.fromNote": { input: ChangeFromNote; output: ChangeStarted };
  "change.start": { input: ChangeStart; output: ChangeStarted };
  "change.startProposal": { input: ChangeStartProposal; output: ChangeStarted };
  "devices.rename": { input: DevicesRename; output: null };
  "devices.revoke": { input: DevicesRevoke; output: null };
  "feature.drop": { input: FeatureDrop; output: Dropped };
  "feature.fixLinks": { input: FeatureFixLinks; output: null };
  "feature.promote": { input: FeaturePromote; output: PromotedView };
  "feature.setRunOptions": { input: FeatureSetRunOptions; output: null };
  "feature.start": { input: FeatureStart; output: StartPlan };
  "feature.startText": { input: FeatureStartText; output: StartPlan };
  "inbox.add": { input: InboxAdd; output: ListWritten };
  "inbox.addCategory": { input: InboxAddCategory; output: ListWritten };
  "inbox.category": { input: InboxMoveCategory; output: ListWritten };
  "inbox.drop": { input: InboxDrop; output: ListWritten };
  "inbox.edit": { input: InboxEdit; output: ListWritten };
  "inbox.intoProposal": { input: InboxIntoProposal; output: FileWritten };
  "inbox.intoProposalLine": { input: InboxIntoProposalLine; output: FileWritten };
  "inbox.outline": { input: InboxOutline; output: ListWritten };
  "inbox.place": { input: InboxPlace; output: ListWritten };
  "inbox.remove": { input: InboxRemove; output: ListWritten };
  "inbox.removeCategory": { input: InboxRemoveCategory; output: ListWritten };
  "inbox.removeImage": { input: InboxRemoveImage; output: ListWritten };
  "inbox.renameCategory": { input: InboxRenameCategory; output: ListWritten };
  "inbox.toProposal": { input: InboxToProposal; output: NoteMoved };
  "inbox.toProposalFile": { input: InboxToProposalFile; output: FileWritten };
  "inbox.underProposal": { input: InboxUnderProposal; output: NoteMoved };
  "item.settings": { input: ItemSettings; output: null };
  "priorities.commit": { input: PrioritiesCommit; output: ListWritten };
  "priorities.discard": { input: PrioritiesDiscard; output: ListWritten };
  "proposals.add": { input: ProposalsAdd; output: ListWritten };
  "proposals.drop": { input: ProposalsDrop; output: ListWritten };
  "proposals.edit": { input: ProposalsEdit; output: ListWritten };
  "proposals.expand": { input: ProposalsExpand; output: FileWritten };
  "proposals.move": { input: ProposalsMove; output: ListWritten };
  "proposals.outline": { input: ProposalsOutline; output: ListWritten };
  "proposals.remove": { input: ProposalsRemove; output: ListWritten };
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
