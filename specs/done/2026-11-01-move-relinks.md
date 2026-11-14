---
kind: feature
finished: 2026-11-02
pull-request: https://github.com/mrtolkien/uraeda/pull/86
supersedes: [2026-10-13-image-attachments, 2026-10-15-add-scratchpad]
superseded-by: [2026-11-03-vim-text]
---

# Record: Moving a file never breaks a link to it

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-01, finished on
> 2026-11-02, in [its pull request](https://github.com/mrtolkien/uraeda/pull/86). Its full files are
> in git: `git log -- specs/2026-11-01-move-relinks/`.
>
> Superseded in part by [2026-11-03-vim-text](2026-11-03-vim-text.md).

## What and why

Workflow files move: a proposal starts, a note becomes a proposal, a change becomes a feature, a
folder becomes its record. Each move left the old path in every file but `PRIORITIES.md` and
`INBOX.md`, and `ura check`, part of `vp run ready`, failed on the default branch until someone
fixed the link by hand: six times in two days, five of them the same fix on parallel branches. The
human wanted every move to rewrite the links to it, and a link broken by a move on another branch to
be a one-command repair, in the terminal or the web UI.

## Behaviour

- **A move rewrites every link to the moved file** in every file of `specs/`: a start, a single file
  made a folder by an attachment, a note file moved to the proposals or merged into a proposal file,
  a change made a feature. The rewritten files go into the move's commit, or wait on the commit page
  when the move does not commit. A file with uncommitted edits is rewritten in place and left out of
  the move's commit. A start skips the files it moved and `PRIORITIES.md`, whose links the rebase
  before it already points; a change made a feature skips only `PRIORITIES.md`.
- **A hook's refusal and an Undo put the links back.** A refused commit puts back every file it
  rewrote. A merged note's Undo puts back the texts it wrote while unchanged; the Undo of a single
  file made a folder, or of a note file moved to the proposals, reverses its moves over the files
  whose change since `HEAD` is link destinations alone.
- **A link keeps its form**: rooted or relative, its title, `<…>`, and a moved folder's trailing
  `/`. A decision candidate's relative links are read and written from `specs/decisions/`, as
  `ura check` resolves them. Code spans and code blocks are never rewritten. A link to a finished
  folder points at its record, a question's anchor kept, any other anchor dropped; a link to its
  image, found by the folder's move or the image's own, becomes its words. A move matched on an
  anchor writes the anchor the move gives, or none. A note merged into a proposal file is linked at
  its subsection, the first `###` heading the merge added.
- **A link to a deleted file keeps its words without the link**, in records too; an image keeps its
  alt text. Words left at a line's start stay as they are, even when they then read as markdown
  syntax. A reference definition to a deleted file stays, still reported. Wikilinks are reported,
  never rewritten.
- **`ura check` says where a missing file went**: `no file <path>: it moved to <new path>`,
  `it became the record <record>`, or `deleted in <commit> (<subject>)`, read from git's history
  only when a link is broken. The history is one `git log -M` over `specs/`, its last four reads
  kept by repository and tip, read without holding a lock. Chained moves are followed to the end.
  Beyond git's renames, a commit's one removed proposal or note main file pairs with the one file it
  added that is a dated folder's `proposal.md` or a main file of the same name, or with `-<n>`
  after; otherwise it reads as deleted. A missing folder follows the files its newest removal took.
  A note merged into a proposal file reads as deleted. A path that never existed stays reported.
- **`ura check --fix` rewrites every such link and never commits.** It prints
  `fixed <file>: <n> links` for each file, adds a `fixed` list to its JSON, and exits as the check
  after it. Given a path outside `specs/`, such as `.`, it relinks each `specs/` folder under it
  that has a broken link, all or nothing. When several moves match a link, the most specific wins: a
  file's move over its folder's. Two runs from the same tree write identical bytes, so branches
  repairing the same link merge without conflict.
- **The commit page lists link repairs**: each file of `specs/` whose only change since `HEAD` is
  link destinations, an image's inside a link included, is a change of its own, after the lists',
  subject `repair links in <file>`, line `- Repair links: <file>`, named by its path from `specs/`
  when another repair has the same name. A proposal or note file's commit from its editor leaves the
  repairs on the commit page.
- **A done feature's page fixes moved links.** Its record's format notes say where each file went,
  and "Fix moved links" rewrites them in the default branch's files, without committing, busy until
  the repair settles. The record is checked when its page is read, not when Home or the sidebar read
  the workspace. A feature on its branch shows the note without the button.
- **The workflow repairs at the catch-up and the finish.** The catch-up runs `ura check --fix` after
  its rebase and commits the repairs alone, `fix(<slug>): repair the links to moved files`, as a
  postpone and a drop do. The finish rewrites the links into its own folder by its anchor rule, then
  runs the fix for the rest, amended into the finishing commit. The skill gives every rule by hand.
- **On the default branch, nothing repairs a broken link by itself**: a human, an agent, or the next
  branch to merge does.

## Design

One rewrite, applied to every file of `specs/` with a list of moves. Each core move knows its own
moves; `--fix` and the Fix button find theirs in git's history.

- **The link rewrite**, [`relink`](/crates/core/src/files/retarget.rs), points each link to a moved
  file at its new path and turns a link to a deleted file into its words; the move types, `Move` and
  `Went`, are in [`moves.rs`](/crates/core/src/moves.rs).
- **The move finder**, [`moves/history.rs`](/crates/core/src/moves/history.rs), reads where each
  missing path went from [`git/history.rs`](/crates/core/src/git/history.rs)'s `git log`, through
  the system `git`.
- **The relinker**, [`actions/relink.rs`](/crates/core/src/actions/relink.rs), runs the rewrite over
  a checkout's `specs/`, writes each file by renaming a new file over it, and returns each file's
  text before, for a refusal or an Undo to put back.
- **The core's moves** call it: [`start/commits.rs`](/crates/core/src/actions/start/commits.rs),
  [`promote.rs`](/crates/core/src/actions/promote.rs),
  [`attach.rs`](/crates/core/src/actions/attach.rs),
  [`inbox/note_file.rs`](/crates/core/src/actions/inbox/note_file.rs), and
  [`inbox/merge.rs`](/crates/core/src/actions/inbox/merge.rs).
- **The check and the fix**: [`check/finder.rs`](/crates/core/src/check/finder.rs) names the
  destination in `links.file`'s message and runs `fix`; the CLI's `--fix` is in
  [`check.rs`](/crates/cli/src/check.rs).
- **The commit page's repairs**:
  [`changes/repairs.rs`](/crates/core/src/actions/changes/repairs.rs).
- **The Fix button**: the core's [`api/checks.rs`](/crates/core/src/api/checks.rs), the server's
  [`session-moves.ts`](/packages/server/src/fate/session-moves.ts), and the web's
  [`Notes.tsx`](/packages/web/src/feature/Notes.tsx) and
  [`FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx).
- **The skill**: [implementation](/skills/uraeda/references/implementation.md)'s catch-up, with
  where a moved link points, [finish](/skills/uraeda/references/finish.md),
  [projects](/skills/uraeda/references/projects.md), [change](/skills/uraeda/references/change.md),
  inbox, and [cli](/skills/uraeda/references/cli.md), with [`docs/cli.md`](/docs/cli.md).

## Replaced behaviour

- **A core move left every file but `PRIORITIES.md`, `INBOX.md`, and the moved files as they were.**
  Guarded by no test; no test removed.
- **The commit page held only the inbox, the priorities, and proposal and note files.** Guarded by
  no test; no test removed.

## Gotchas

- **A save can be lost in a few milliseconds' window**: the relinker reads a file, then renames its
  rewrite over it, so an editor saving between the two loses its save; the moves hold the
  repository's write lock for the server's own writes. A rename also drops the file's other hard
  links. See [`relink.rs`](/crates/core/src/actions/relink.rs).
- **An Undo leaves an untracked file's moved link**: with no `HEAD` text, nothing proves its change
  is links alone. See [`relink.rs`](/crates/core/src/actions/relink.rs)'s `relink_back`.
- **A history read takes about 0.7 seconds on this repository**, close to the 1 second criterion,
  and grows with history; it runs only when a link is broken, but a broken link in any record makes
  every done page's first open read it. See [`moves/history.rs`](/crates/core/src/moves/history.rs).
- **A main file renamed with most of its text rewritten in one commit reads as deleted**: the
  pairing beyond git's renames only takes a dated `proposal.md` or the same name, since pairing any
  added file sent links to unrelated files.

## Questions

### Round 01

#### Q1: What does the fix do with a link to a file that was deleted, not moved?

**Answer:** A: the fix keeps the link's words and removes the link, and `ura check` names the commit
that deleted it.

#### Q2: What repairs a link that a merge on the forge breaks on the default branch?

**Answer:** A: the catch-ups and the finish run the fix; on the default branch, a human or an agent
runs it, or the next branch to merge does.

#### Q3: Does the web UI get a way to run the fix?

**Answer:** B, changed: a Fix button, but "No commit on the default branch, just a fix to the file.
The commit will go through our commit dialog."

## Changes after approval

- The rewrite takes the most specific of several matching moves, a file's over its folder's, since a
  note's main file and its folder moved to different names.
- `ura check --fix` given a path outside `specs/` relinks each `specs/` folder under it.
- The Fix button stays busy until its repair settles.
- The catch-up, a postpone, and a drop commit their repairs alone; the finish amends its repairs
  into the finishing commit.
- A decision candidate's links follow a move from `specs/decisions/`, a finished folder's image
  found by its own path becomes its words, and an image inside a link counts as a link repair.
