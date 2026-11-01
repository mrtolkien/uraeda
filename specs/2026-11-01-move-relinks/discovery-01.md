# Discovery, round 01: Moving a file never breaks a link to it

## Summary

Workflow files move often: a proposal file moves into a dated folder when it starts, a single
proposal or note file becomes a folder when it gets an image, a note file becomes a proposal file, a
change becomes a feature, a finished folder becomes a record, a postponed feature goes back to the
proposals, and a dropped feature's folder is deleted. Today the core rewrites the links to a moved
file in `PRIORITIES.md` and `INBOX.md` only, and the moved files' own relative links. Every other
file of `specs/` keeps the old path, and `ura check` reports it as `no file <path>`, failing
`vp run ready` on the default branch.

The proposal asks for three things: every core move rewrites the links in every file of `specs/`;
`ura check` says where a broken link's file went, and `ura check --fix` rewrites it; and the finish
step and the catch-up with the default branch run the fix. The rewriting code exists
([`retarget.rs`](/crates/core/src/files/retarget.rs)); what is missing is the list of files to
rewrite, the history reading that finds where a file went, and the `--fix` flag.

The discovery effort is `low`: no product comparison, only the code, the skill, and git's
documentation.

## How other products do it

Not researched: the discovery effort is `low`. See [Not checked](#not-checked).

### What they have in common

Not researched.

## Standards and libraries

### Git's rename detection

- `git diff -M[<n>]` pairs a deleted file with an added one as a rename when their similarity is
  over the threshold, 50% by default: "-M90% means Git should consider a delete/add pair to be a
  rename if more than 90% of the file hasn't changed" (`git help diff`, git 2.56.0, read locally).
- `git log --follow` follows a single file's history across renames, from its new path backwards
  (`man git-log`). It cannot answer "where did this deleted path go", which needs a forward lookup.
- The core already runs `git diff --numstat -z -M` through the system `git`, in
  [`git/history.rs`](/crates/core/src/git/history.rs) (`numstat_in`). The workspace's gix is built
  without its `blob-diff` feature ([`Cargo.toml`](/Cargo.toml), gix 0.89 with `sha1`, `revision`,
  `status`), so gix cannot detect renames here without a new feature flag.

### Measured on this repository

- `git log main -M --diff-filter=R --name-status -- specs/` lists 97 renames, in about 0.5 seconds.
- Of 92 start commits (`chore(<slug>): start …`), git's default threshold paired the proposal file
  with its new `proposal.md` in all but one: `97b6ac53`, the start of Proposal start flow, where the
  human edited the proposal just before starting. At `-M10%` it pairs, at 36% similarity. Starts at
  68% and 80% similarity show that a start's edits are common (`653f59f3`, `71f7a222`).

### pulldown-cmark

- The rewrite parses links with pulldown-cmark 0.13.4 ([`Cargo.toml`](/Cargo.toml)) and edits only
  each destination's bytes, so the rest of a file stays byte for byte, as `rewrite` in
  [`retarget.rs`](/crates/core/src/files/retarget.rs) does today.

## The code

### Important reads

- [`files/retarget.rs`](/crates/core/src/files/retarget.rs): `retarget` (a file that moved within
  its folder, as a single file becoming a folder), `moved` (a file moved anywhere, rooted links kept
  rooted, anchors kept), `rebase` and `relocated` (a moved file's own relative links). All four sit
  on one private `rewrite`, which edits inline links, images, and reference definitions. Their docs
  name `PRIORITIES.md` and `INBOX.md`, but nothing in them is specific to those files. `links_to`
  resolves a destination from `specs/` only: a file in another folder needs its own folder there.
- [`check/links.rs`](/crates/core/src/check/links.rs): `links.file` reports `no file <path>` for a
  link into `specs/` or to a markdown file that does not resolve. Links from `PRIORITIES.md` and
  `INBOX.md` to a dated folder are excused, since a started feature's files live on its branch.
- [`workspace/problem.rs`](/crates/core/src/workspace/problem.rs): `links.file` is not in
  `BLOCKING`, so the web UI shows it as a note on the item's page, and `ura check` as an error.
- [`vite.tasks.ts`](/vite.tasks.ts): `vp run ready` runs `ura check specs` and the example's check,
  and [CI](/.github/workflows/ci.yml) runs it on every push to `main`. Only files under `specs/` are
  checked; their links to any markdown file are followed.
- [`git/commit.rs`](/crates/core/src/git/commit.rs): `stage` adds whole files. A file with the
  human's uncommitted edits cannot have only its rewritten links staged without new code.
- [`actions/drop.rs`](/crates/core/src/actions/drop.rs): a drop whose `PRIORITIES.md` has other
  changes leaves its removals uncommitted, beside the human's edits. That is the existing precedent
  for a file the move must edit but cannot commit alone.

### The proposal's path and existing actions

Every move the core or the skill makes, and what happens to links today:

| Move                                                  | Where                                                                                        | Links rewritten today                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| Start: proposal file or folder → dated folder         | [`start/commits.rs`](/crates/core/src/actions/start/commits.rs), on the default branch       | `PRIORITIES.md`, the moved files' own  |
| Single proposal or note file → folder (image, attach) | [`attach.rs`](/crates/core/src/actions/attach.rs) `into_folder`, `to_folder`; Undo `to_file` | `PRIORITIES.md`, `INBOX.md`            |
| Note file → proposal file                             | [`inbox/moves.rs`](/crates/core/src/actions/inbox/moves.rs), Undo in `inbox/undo.rs`         | `PRIORITIES.md`, `INBOX.md`            |
| Note file merged into a proposal file's Notes         | [`inbox/merge.rs`](/crates/core/src/actions/inbox/merge.rs)                                  | `PRIORITIES.md`, `INBOX.md`            |
| Note file removed with its note                       | [`inbox/note_file.rs`](/crates/core/src/actions/inbox/note_file.rs)                          | none: nothing to point at              |
| Change → feature, `specs/changes/<d>/` → `specs/<d>/` | [`promote.rs`](/crates/core/src/actions/promote.rs), on the default branch and the branch    | `PRIORITIES.md`                        |
| Drop: the dated folder deleted                        | [`drop.rs`](/crates/core/src/actions/drop.rs)                                                | none                                   |
| Finish: folder → `specs/done/<d>.md`                  | the skill, by hand ([finish](/skills/uraeda/references/finish.md#rewrite-the-links))         | every file of the branch, by the agent |
| Postpone: `specs/<d>/` → `specs/proposals/<slug>/`    | the skill, by hand ([projects](/skills/uraeda/references/projects.md))                       | `PRIORITIES.md`, by the agent          |
| Decision renamed or removed                           | the spec step, by hand                                                                       | none required                          |

Existing actions the feature meets:

- **Undo** of a note's move and of a file becoming a folder puts the file back and rewrites
  `PRIORITIES.md` and `INBOX.md` back, only while they hold what the move wrote
  ([`inbox/undo.rs`](/crates/core/src/actions/inbox/undo.rs), `attach.rs` `to_file`). Links
  rewritten in other files need the same treatment.
- **A hook's refusal** of the start commit puts back every file the start wrote, only while it is
  unchanged ([`start/restore.rs`](/crates/core/src/actions/start/restore.rs)). The rewritten files
  join that list.
- **Deferred commits** in the server write files first and commit later
  ([`deferred.rs`](/crates/core/src/actions/deferred.rs)); a refusal puts back file by file. The
  rewritten files join the deferred write.
- **The catch-up** is a rebase on the default branch, not a merge
  ([implementation](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch),
  step 3), and the finish step catches up again before marking the pull request ready.

### How the links broke

Five commits on five branches fixed the same three links of
[`2026-10-30-inbox-again.md`](/specs/done/2026-10-30-inbox-again.md): `d8896c81`, `94128a4a`,
`e6ef27de`, `bad21ed7`, `0594bf9b`. Each branch's `vp run ready` failed on the default branch's
broken links after its catch-up. The identical edits merged without conflict. A sixth, `560fd5f0`,
fixed the link to `/specs/2026-10-30-proposal-start/proposal.md` once that folder became its record
on merge.

Two causes:

1. **A move on the default branch** left the old path in a record already merged: three starts.
   Rewriting every file of `specs/` at the move fixes this one.
2. **A merge on the forge** deleted a folder that a file written on another branch linked: the
   finish of Proposal start flow. The finishing branch did not have the link, so its finish step
   could not rewrite it. Only a repair after both are on the default branch fixes this one.

Links exposed today: four links in records point at `specs/proposals/` files (`worker-lifecycle.md`,
`chat-right-column.md`, `cli-tuis.md` twice), which break at their start.

### Rules and their owners

- **Where a link points after a move**: [`retarget.rs`](/crates/core/src/files/retarget.rs) owns the
  rewrite; each move calls it for its own lists (`attach.rs` `edit_lists`, `inbox/moves.rs`,
  `inbox/merge.rs`, `inbox/undo.rs`, `start/plan.rs` for the priorities, `promote.rs`).
- **A finished folder's link becomes the record's**: written only in the skill,
  [finish](/skills/uraeda/references/finish.md#rewrite-the-links): a question's anchor kept, another
  anchor pointing at the first question that links the same section, else no anchor.
- **A record is frozen but for a broken link**:
  [finish](/skills/uraeda/references/finish.md#after-the-merge).

### Likely changes

Under every option:

- [`files/retarget.rs`](/crates/core/src/files/retarget.rs): a rewrite of any file's links to a list
  of moves, written from the file's own folder.
- A new module of the core: where a missing path went, from the default branch's history, chained (a
  proposal file to its folder, to a dated folder, to a record).
- [`check/links.rs`](/crates/core/src/check/links.rs): the message names where the file went.
- [`crates/cli/src/check.rs`](/crates/cli/src/check.rs): `--fix`.
- Each move in the table above: rewrite every file of `specs/`, put back on a refusal or an Undo.
- The skill: [finish](/skills/uraeda/references/finish.md),
  [projects](/skills/uraeda/references/projects.md),
  [implementation](/skills/uraeda/references/implementation.md) (the catch-up), and
  [cli](/skills/uraeda/references/cli.md); and the CLI's page in `docs/`.
- With a repair on the default branch by every move (option B of
  [the default branch](#repairing-the-default-branch)): the start, attach, inbox, promote, and drop
  commits carry the repairs.
- With the web UI's action (option B of [the web UI](#the-web-ui)): the item page's note, the
  server's adapter.

Tests that guard behaviour the feature changes: [`retarget.rs`](/crates/core/src/files/retarget.rs)
`moved_files_are_linked_where_they_went_and_the_others_rebased` and
`relative_links_are_rebased_and_the_others_kept` keep passing; tests that assert a move leaves other
files untouched, if any, are found by the plan in `crates/core/tests/` (`promote.rs`
`assert_nothing_moved`, `inbox_actions.rs`, `drop.rs`).

## The proposal

### "Found through git's renames" misses an edited proposal

The proposal finds a started proposal file through git's renames. Git missed the one start whose
proposal was edited just before it, at 36% similarity ([measured](#measured-on-this-repository)),
and that start is one of the incidents. A start commit's shape pairs them reliably: it deletes one
proposal file or folder and adds one dated folder.

### A deleted file has nowhere to point

A drop deletes the folder, a note file can be removed with its note, and the spec step can remove a
decision (`ui-checks.md`, `ui-coherence.md` were). The proposal lists "a drop" among the moves, but
a deleted file has no new path.

### "Merging the default branch into a branch"

The skill's catch-up rebases the branch rather than merging. The fix runs after the rebase, and
again at the finish's second catch-up.

### What repairs the default branch itself

The second cause of [how the links broke](#how-the-links-broke) happens at the forge's merge, after
every agent step. The proposal names no step that runs then.

### "Starts as a change"

The proposal says it starts as a change, but it was started as a feature, and the human asked for
this discovery.

### Files outside `specs/`

The proposal limits the rewrite to `specs/`. `README.md`, `docs/`, and code comments may link into
`specs/`, and `ura check specs` does not check them.

## Worth it and feasibility

- **Gain**: six fix commits in two days, five of them duplicates on parallel branches, and CI red on
  `main` each time. Four links in records break at their next start.
- **Cost**: one generic rewrite already exists; the new parts are the history lookup, the list of
  files each move touches, their put-back on refusal and Undo, and `--fix`. Medium for a `low`
  effort, mostly in the core's moves.
- **Outside behaviour**: git's rename detection, checked on this repository
  ([measured](#measured-on-this-repository)). Nothing unverified.
- No guard is relaxed.

## Approaches

Criteria: the proposal (no hand fixes, `ura check` stays the guard), the
[git decision](/specs/decisions/git.md) (writes through `git`, nothing removed unasked), the
[problems decision](/specs/decisions/problems.md) (a broken link stays a note in the UI), the
[CLI decision](/specs/decisions/cli.md) (every rule in the skill), and the constitution's principle
V (the manual steps stay).

### Finding where a file went

| Option                                                                           | Finds the 36% start | Cost                              |
| -------------------------------------------------------------------------------- | ------------------- | --------------------------------- |
| A. Git's renames at the default threshold                                        | no                  | one `git log -M`                  |
| B. Git's renames, with a start or move commit's single delete and add paired too | yes                 | one `git log`, a pairing pass     |
| C. A ledger file of moves, written by each move                                  | yes                 | a new file, by-hand moves miss it |

### A deleted file

| Option                                                 | Default branch stays green | Reader keeps a pointer |
| ------------------------------------------------------ | -------------------------- | ---------------------- |
| A. Keep the link's words, remove the link              | yes                        | no                     |
| B. Report it, never fix it                             | no, until a human edits    | no                     |
| C. A permalink to the file's last version on the forge | yes                        | yes, forge-bound       |

### Repairing the default branch

| Option                                                                | When `main` is repaired                       | Surprise                           |
| --------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------- |
| A. Catch-ups and the finish run the fix; on `main`, `ura check --fix` | when a branch with the fix merges, or by hand | none                               |
| B. A plus every core move on the default branch repairs what it can   | at the next start, attach, or inbox move      | a start commit carries other links |
| C. The server repairs and commits on the default branch after a merge | at once, while the server runs                | a commit nobody asked for          |

### The web UI

| Option                                                       | Cost                    |
| ------------------------------------------------------------ | ----------------------- |
| A. No new UI: the note on the item's page says where it went | none                    |
| B. A Fix action on that note                                 | a server action, a view |

### Needs no choice

- The link's form (rooted, relative, anchor, title, `<…>`) is kept, as `retarget.rs` does today.
- Undo and a hook's refusal put back the rewritten files, as they do for the priorities.
- A file with uncommitted edits is rewritten and left uncommitted, as a drop leaves the priorities.
- Wikilinks name a file anywhere in `specs/`, and one exists in the example: they are not rewritten.

## Not checked

- How other tools (Obsidian, Foam, Dendron) rewrite links on a move: out of scope at the `low`
  effort.
