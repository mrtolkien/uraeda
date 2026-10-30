---
kind: change
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/77
supersedes: [2026-10-10-cli-core, 2026-10-20-merge-chats]
---

# Record: Commits shouldn't all fail on "changes to INBOX.md"

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/77). Its full files are
> in git: `git log -- specs/changes/2026-10-30-commits-shouldn/`.

## What and why

Starting a feature or a change failed with "cannot start: uncommitted changes in specs/INBOX.md"
whenever the inbox on the main checkout had an edit not yet committed, which the web UI often
leaves. The start had no reason to care: it commits its own files. The human asked that starting
work "commit just what's relevant and leave what's uncommitted as-is".

## Behaviour

- A start, from a proposal file, a postponed folder, a typed text, or an inbox note, with
  `ura start` or the web UI, commits its own files alone: the proposal's move, its dated folder, and
  `PRIORITIES.md`. Every other change in the main checkout, uncommitted, untracked, or staged, stays
  as it was, out of the commit.
- `ura start <change> --feature` commits its move on the default branch alone the same way: files
  staged there stay staged.
- A proposal file staged but never committed starts once, and leaves nothing staged at its old path.
- A start is refused, before writing anything, while a merge, a cherry-pick, a revert, or a `git am`
  is in progress on the default branch's checkout: git refuses a commit of some files alone during
  the first two, and one would end a revert or leave a patch half applied. A rebase or a bisect
  detaches `HEAD`, and the start fails reaching the default branch, as before.
- A commit of some files alone, by a start, `ura note`, or the web UI's inbox, leaves a clean tree
  when a pre-commit hook reformats and stages the files: the index takes what was committed.
- `--switch` still refuses to switch branches over uncommitted changes.

## Design

The check of uncommitted and staged files in `Start::plan`
([`start/plan.rs`](/crates/core/src/actions/start/plan.rs)) was removed. `Start::commit_start`
([`start/commits.rs`](/crates/core/src/actions/start/commits.rs)) stages its paths with
`stage(&paths, true)`, which commits with `git commit --only`, as `ura note` already did. Before
that, it resets the proposal file's index entries to `HEAD`, so a proposal only staged leaves the
index with its move. `Promote::relink` ([`promote.rs`](/crates/core/src/actions/promote.rs)) calls
`commit_only`. After a commit of files alone, `Git::commit_stage`
([`git/commit.rs`](/crates/core/src/git/commit.rs)) resets those paths in the index to the new
commit, as a best effort. `Git::operation_in_progress`
([`git/status.rs`](/crates/core/src/git/status.rs)) reads gix's state of the repository, and
`Start::plan` refuses the start on a merge, a cherry-pick, a revert, or a `git am`. The
[CLI reference](/skills/uraeda/references/cli.md) and the start's steps by hand in
[Projects](/skills/uraeda/references/projects.md) say the start commits its files alone.

## Replaced behaviour

- **A proposal file's start refused uncommitted changes outside the proposal and `PRIORITIES.md`**,
  and every start refused files staged elsewhere. The tests that pinned it now check the start goes
  through: `uncommitted_changes_elsewhere` in
  [`crates/cli/tests/start.rs`](/crates/cli/tests/start.rs), and
  `a_staged_proposal_file_does_not_start_twice` in
  [`crates/cli/tests/fixes.rs`](/crates/cli/tests/fixes.rs). No test was removed.

## Gotchas

- The index reset after a commit of files alone: `git commit --only` runs the hooks over a temporary
  index, so what a hook like `vp staged` reformats reaches the commit and the working tree but not
  the real index, which would show the start's files as `MM`.
- The refusal of a revert: git allows a commit of some files alone during a stopped revert, and that
  commit removes `REVERT_HEAD`, ending the revert half applied, its message lost.
- The reset is best effort: the commit has landed, and the start and the move undo their files on an
  error. It runs outside the write lock, so a concurrent write can leave the paths as `MM` until
  their next commit.

## Changes after approval

- `ura start <change> --feature` now commits its move alone too: the review found it still refused a
  staged `INBOX.md`.
- A start is now refused during a merge, a cherry-pick, a revert, or a `git am`, which the check of
  uncommitted changes used to refuse up front: without it, the start moved the proposal, then failed
  at its commit or ended the revert.
- A commit of some files alone now leaves a clean tree under a reformatting hook, for `ura note` and
  the inbox's commits as well as the start.
- The links of the [2026-10-30-inbox-again](2026-10-30-inbox-again.md) record to three proposal
  files now point at their started folders: they had broken `ura check` on the default branch.
