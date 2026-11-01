---
status: answered
---

# Clarifications, round 01: Moving a file never breaks a link to it

> [!NOTE]
>
> Answered on 2026-11-01.
>
> - Verdict: worth building, with changes. Six fix commits in two days, five of them the same fix on
>   parallel branches, but git's renames alone miss one of the incidents.
> - Repairing the default branch after a forge merge: no agent step runs then, so the proposal's
>   fixes leave a window.
> - A deleted file, like a dropped feature's folder, has no new path to point at.
> - Finding a started proposal pairs a start commit's delete and add, beyond git's renames: check
>   it.
> - A file with your uncommitted edits is rewritten but left out of the move's commit.

## Context

### Goal

A move of a workflow file, by the core or by a step of the skill, never leaves a broken link in
`specs/`. A link broken by a move on another branch is repaired by a command, not by hand, so
`ura check` stops failing on the default branch.

### Today

| Move                                               | Links rewritten today                     |
| -------------------------------------------------- | ----------------------------------------- |
| Start: a proposal file into its dated folder       | `PRIORITIES.md`, and the file's own links |
| A single proposal or note file becoming a folder   | `PRIORITIES.md`, `INBOX.md`               |
| A note file becoming a proposal file               | `PRIORITIES.md`, `INBOX.md`               |
| A change becoming a feature                        | `PRIORITIES.md`                           |
| Finish: a folder becoming its record, by the agent | every file of its branch                  |
| Postpone and drop                                  | `PRIORITIES.md`                           |

The rewrite is [`retarget.rs`](/crates/core/src/files/retarget.rs), and nothing in it is specific to
those two files. [`check/links.rs`](/crates/core/src/check/links.rs) reports a broken link as
`no file <path>`, an error in `ura check` and a note in the web UI.

The links broke two ways. Three starts on the default branch left their old paths in the inbox-again
record. Then the finish of Proposal start flow deleted its folder on merge, while that record,
written on another branch, still linked its proposal.

### Scope

In:

- every core move rewrites the links in every file of `specs/`;
- `ura check` names where a broken link's file went, and `ura check --fix` rewrites the link;
- the finish step and the catch-up run the fix;
- the skill's finish, projects, implementation, and CLI references, and the CLI's page in `docs/`.

Out: links from outside `specs/`, see the first point below.

### Sources

- The core's moves: [`start/commits.rs`](/crates/core/src/actions/start/commits.rs),
  [`attach.rs`](/crates/core/src/actions/attach.rs),
  [`inbox/moves.rs`](/crates/core/src/actions/inbox/moves.rs),
  [`inbox/merge.rs`](/crates/core/src/actions/inbox/merge.rs),
  [`promote.rs`](/crates/core/src/actions/promote.rs),
  [`drop.rs`](/crates/core/src/actions/drop.rs).
- The skill: [finish](/skills/uraeda/references/finish.md#rewrite-the-links),
  [projects](/skills/uraeda/references/projects.md#starting-postponing-and-dropping-a-feature), and
  the [catch-up](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch).
- Git's rename detection, `git help diff`, measured on this repository's 92 start commits.
- The six fix commits of the inbox-again record, from `d8896c81` to `560fd5f0`.
- The full investigation is in [discovery](discovery-01.md).

## Check these

- **Links outside `specs/`** are left out, as the proposal says: `README.md`, `docs/`, and code
  comments are neither rewritten nor checked, as today. See
  [discovery](discovery-01.md#files-outside-specs).
- **Finding a started proposal** uses git's renames, and also pairs a commit's single deleted
  proposal file with its single added `proposal.md`. Git's renames alone missed the start of
  Proposal start flow: you edited it just before starting, and only 36% of it matched. See
  [discovery](discovery-01.md#found-through-gits-renames-misses-an-edited-proposal).
- **A file with uncommitted edits** that links the moved file gets its links rewritten. It stays out
  of the move's commit, beside your edits: a drop does the same with `PRIORITIES.md`. Committing
  only the rewritten lines would need new staging code. See
  [discovery](discovery-01.md#important-reads).
- **A finished folder's anchors**: a link to a question keeps its anchor in the record, as the
  finish step says. Any other anchor, like a discovery topic, is dropped, and the link points at the
  record. The finish step's "first question that links the same section" needs the deleted folder's
  text. See [discovery](discovery-01.md#rules-and-their-owners).
- **The catch-up is a rebase**: the proposal says "merging the default branch", but the skill's
  catch-up rebases. The fix runs after each catch-up's rebase, the finish's second catch-up
  included. See [discovery](discovery-01.md#merging-the-default-branch-into-a-branch).
- **A feature, not a change**: the proposal says "Starts as a change", but it was started as a
  feature, and you asked for this discovery. It stays a feature. See
  [discovery](discovery-01.md#starts-as-a-change).

## Q1: What does the fix do with a link to a file that was deleted, not moved?

Example: a record links `/specs/2026-11-05-dark-mode/proposal.md`. You drop Dark mode, and its
folder leaves the default branch. The link has no new path.

The same happens to a note file removed with its note, and to a decision the spec step removes:
`ui-checks.md` and `ui-coherence.md` were. Records are frozen, but a broken link is the one edit
they take. More in [discovery](discovery-01.md#a-deleted-file).

Why it matters: it decides whether a drop can turn the default branch's check red. It also decides
whether a record keeps a pointer to what it named.

- **A (recommended). The fix keeps the link's words and removes the link, and `ura check` names the
  commit that deleted the file.**
  - Example: the record reads "Dark mode", as plain text, and `ura check` said
    `no file …: deleted in a1b2c3d (chore(dark-mode): drop Dark mode)` before the fix.
  - [pro] the check never stays red after a drop; `git log -- specs/2026-11-05-dark-mode/` still
    finds the files.
  - [con] the record loses its pointer.
  - Why recommended: it meets "repaired, not fixed by hand" with no forge, and git keeps the files.
- **B. The fix leaves it, and `ura check` keeps reporting it, with the deleting commit, until a
  human edits it.**
  - Example: the record still links the folder, and `vp run ready` fails until someone edits it.
  - [pro] a human chooses the words.
  - [con] a drop turns the default branch red, the problem this feature removes.
- **C. The fix replaces it with a link to the file's last version on the forge.**
  - Example: the link becomes
    `https://github.com/<owner>/<repo>/blob/<commit>/specs/2026-11-05-dark-mode/proposal.md`.
  - [pro] the reader still opens the proposal in one click.
  - [con] the link leaves the repository, needs a forge, and breaks on a fork or a move.

**Answer:** A

## Q2: What repairs a link that a merge on the forge breaks on the default branch?

Example: Proposal start flow finishes on its branch: its folder becomes its record. Meanwhile,
another branch merges a record that links `/specs/2026-10-30-proposal-start/proposal.md`. You merge
Proposal start flow last, on GitHub: the folder leaves, and the link breaks on `main`.

No agent step runs at the forge's merge. With this feature, every catch-up runs the fix. Each branch
in flight then repairs the link in its own commit, as five branches did by hand for the inbox-again
record. Their identical edits merged without conflict. More in
[discovery](discovery-01.md#repairing-the-default-branch).

Why it matters: it decides how long `main`'s CI stays red, and whether a tool commits on the default
branch without your action.

- **A (recommended). The catch-ups and the finish run the fix; on the default branch, you or an
  agent run `ura check --fix` when `ura check` fails.**
  - Example: `main`'s CI is red until the next branch merges, or until you run `ura check --fix` and
    commit.
  - [pro] nothing commits without a person or a step asking.
  - [con] `main` can stay red between a merge and the next one.
  - Why recommended: the window is a few merges, the fix is one command, and nothing new writes on
    the default branch.
- **B. As A, and every move the core makes on the default branch also repairs every broken link it
  can, in its own commit.**
  - Example: your next start of a proposal repairs the record's link, in the start commit.
  - [pro] `main` heals during your normal work, with no command.
  - [con] a start commit carries edits to other files, under a message that does not say so.
- **C. The server repairs and commits on the default branch as soon as it sees a broken link after a
  merge.**
  - Example: a minute after the merge, a commit `chore: repair links` appears on `main`.
  - [pro] `main` is red only until the server notices.
  - [con] a tool commits on the default branch with nobody asking, which the
    [git decision](/specs/decisions/git.md) never allowed; it needs the server running.

**Answer:** A

## Q3: Does the web UI get a way to run the fix?

Example: Home is fine, but the inbox-again record's page shows a note: "no file
/specs/proposals/cli-tuis.md: it moved to /specs/2026-11-10-cli-tuis/proposal.md".

The web UI's moves go through the core, so they rewrite links like `ura`. A broken link from a forge
merge shows only as a note on the item's page, as the
[problems decision](/specs/decisions/problems.md) says. More in
[discovery](discovery-01.md#the-web-ui).

Why it matters: it decides whether a human without a terminal can repair the default branch.

- **A (recommended). No new UI: the note says where the file went, and `ura check --fix` repairs
  it.**
  - Example: you read the note, and run `ura check --fix` in a terminal, or ask an agent.
  - [pro] no new view or action to build and keep.
  - [con] the repair needs a terminal or an agent.
  - Why recommended: you work with a terminal, and the note already says what is wrong.
- **B. A Fix button on the note, which rewrites the link and commits it on the default branch.**
  - Example: you click Fix on the note, and a commit `chore: repair links` appears.
  - [pro] the repair happens where the problem shows.
  - [con] a server action and a view to build, and a commit on the default branch from a note.

**Answer:** B: No commit on the default branch, just a fix to the file. The commit will go through
our commit dialog.

## Settled without the human

### Behaviour

- **Where it went** shows in `ura check`'s message: `no file <path>: it moved to <new path>`, or
  `it became the record <path>`. It stays an error in `ura check` and a note in the web UI. See
  [discovery](discovery-01.md#important-reads).
- **Chained moves** are followed to the end: a proposal file that became a folder, then started,
  then finished points at its record. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The link's form** is kept: a rooted link stays rooted, and a relative one relative. Its anchor,
  title, and `<…>` stay, as in the priorities' links today. See
  [discovery](discovery-01.md#important-reads).
- **Undo and a hook's refusal** put back the rewritten links in every file, as they do for the
  priorities. A file changed since the move keeps its changes. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **`ura check --fix` writes and never commits**: it prints each file it changed, and the step or
  the human commits. See [discovery](discovery-01.md#likely-changes).
- **Wikilinks** are not rewritten: one names a file anywhere in `specs/`, and only the example has
  one. See [discovery](discovery-01.md#needs-no-choice).

### Under the hood

- **One rewrite** in [`retarget.rs`](/crates/core/src/files/retarget.rs) takes a file's folder and a
  list of moves; every core move and `--fix` call it. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **History is read only for a broken link**: one `git log -M` over the default branch's `specs/`,
  about half a second here, through the system `git` as `numstat` already is. See
  [discovery](discovery-01.md#measured-on-this-repository).
- **The rewrite is deterministic**, so branches repairing the same link make identical edits that
  merge cleanly. See [discovery](discovery-01.md#how-the-links-broke).
- **Deferred commits** in the server include the rewritten files, put back file by file on a
  refusal. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

**Notes:**
