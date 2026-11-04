---
status: changes-requested
revision: 1
clarifications: 2
risk-tier: high
plan-review: false
---

# Spec: Basic git UI in the web UI

> [!NOTE]
>
> Changes requested on 2026-11-04: 2 comments in spec-review.md.
>
> - You approve a generic git page for the main checkout, replacing the Commit page. It pulls,
>   pushes, merges, stages and commits any file, and fixes conflicts in the shared editor.
> - One answer read one way: you kept the main checkout only and picked merging. So the page merges
>   a branch you pick into `main`, and never rebases a feature's branch.
> - Changed decision: Git, where "the Commit page" becomes "the Git page". Nothing else in it moves.
> - Unverified: how your credentials behave when the server runs git without a terminal. The plan's
>   first task pulls and pushes from the running server; if it fails, the page says why.
> - Risk tier high: the page discards files, removes worktrees, and rewrites `main` by rebasing on
>   pull. Every one of them asks first or follows your git configuration.
> - Writes wait while a chat's agent works in the main checkout, as a feature's writes do today.

A git page in the web UI, to work fully remotely: the human pulls `main` after a pull request
merges, pushes, reads diffs, commits, merges, fixes conflicts, reads the history, and cleans
worktrees. It is a simple, generic client in lazygit's spirit, for the main checkout, and it
replaces the Commit page. The human runs these commands, never an agent. See the
[proposal](proposal.md), the discovery's rounds [01](discovery-01.md) and [02](discovery-02.md), and
the answers of [round 01](clarifications-01.md) and [round 02](clarifications-02.md).

## Decisions

- **Changed: [Git](../decisions/git.md)**. The page where the human's edits are committed is now
  named the Git page, in the commit rule, its why, and its consequences.

Relied on:

| Decision                                       | What it means for this spec                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| [Git](../decisions/git.md)                     | reads through gix, writes through `git`; never a forced push or removal     |
| [Stack](../decisions/stack.md)                 | git logic in the Rust core, reached through the binding                     |
| [UI components](../decisions/ui-components.md) | Astryx's `CodeBlock` draws diffs; panes, banners, and buttons are the app's |
| [UI layout](../decisions/ui-layout.md)         | sections beside the diff on wide screens; the picked row in the address     |
| [UI behaviour](../decisions/ui-behaviour.md)   | every git write in the toast, its refusal next to what it concerns          |
| [Keyboard](../decisions/keyboard.md)           | the page's keys in the registry, every action by tap too                    |
| [Text editing](../decisions/text-editing.md)   | a conflicted file opens in the one shared editor                            |
| [Performance](../decisions/performance.md)     | the page draws from what the server holds; git's slow writes show progress  |
| [Preview](../decisions/preview.md)             | the mockups are stories built with the real components                      |
| [Testing](../decisions/testing.md)             | the git writes and stored formats are what the tests guard                  |

## User stories

### US1: Pull and push the main checkout (P1)

After a pull request merges on GitHub, the human opens the Git page from the sidebar or `Space g`.
They see what waits on `origin`, and pull, then push Uraeda's chores.

[Behind](/packages/web/src/GitMockups.stories.tsx#Behind)

[Sidebar entry](/packages/web/src/GitMockups.stories.tsx#SidebarEntry)

Key scenarios:

1. **Given** `main` has 6 unpushed chores and `origin/main` 3 new commits, **When** the page opens,
   **Then** it fetches, and reads "main · 3 to pull · 6 to push · fetched just now".
2. **Given** the same, with `pull.rebase` unset, **When** the human presses Pull, **Then** the 6
   chores are rebased onto `origin/main`, and the page reads "6 to push".
3. **Given** `origin/main` has a commit `main` lacks, **When** the human presses Push, **Then**
   nothing is pushed, and the page reads "origin has commits main lacks: pull first."

More scenarios:

1. **Given** `pull.rebase false`, **When** the human pulls diverged branches, **Then** git merges,
   as in a terminal.
2. **Given** an uncommitted inbox edit and `rebase.autoStash true`, **When** the human pulls,
   **Then** the edit is stashed and put back, still waiting in Uraeda's edits.
3. **Given** the same edit and `rebase.autoStash` unset, **When** the human pulls, **Then** git
   refuses, and its message shows under the page's title.
4. **Given** the page stays open, **When** 5 minutes pass, **Then** Uraeda fetches again, and the
   sidebar reads "Git · ↓3".
5. **Given** a fetch needs a password, **When** it runs, **Then** the page shows git's message and
   "The server runs git without a terminal: give it a credential helper or an ssh-agent."
6. **Given** any page, **When** the human presses `Space g`, `g c`, or opens `/commit`, **Then** the
   Git page opens.

### US2: Read diffs and the history (P1)

The human reads what changed before committing, and what a pull brought, without a terminal.

[Sections, as the phone shows them](/packages/web/src/GitMockups.stories.tsx#Sections)

Key scenarios:

1. **Given** `crates/core/src/git.rs` has 4 lines added and 1 removed, **When** the human picks its
   row, **Then** its unified diff shows beside the sections, or as its own page on the phone.
2. **Given** a pull brought 3 commits, **When** the human reads the history, **Then** they show
   newest first, marked ↓ until pulled, and unpushed ones ↑.
3. **Given** the commit "feat(vim-mode): selected text stays visible in visual mode", **When** the
   human opens it, **Then** its files show with their counts, each opening its diff.

More scenarios:

1. **Given** a changed PNG, **When** its row is picked, **Then** the diff reads "Binary file, 12 KB
   to 14 KB".
2. **Given** a diff of 3,000 lines, **When** it opens, **Then** it shows "+2,900 −100" and "Show the
   whole diff".

### US3: Commit any file (P1)

Changes Uraeda did not make, like an agent's leftover, are staged and committed from the page.
Uraeda's own edits keep their described pane, as on the Commit page.

[Behind](/packages/web/src/GitMockups.stories.tsx#Behind)

Key scenarios:

1. **Given** `docs/web-ui.md` is changed, **When** the human presses Stage, **Then** it moves under
   "Staged".
2. **Given** `App.tsx` staged, **When** the human writes "fix: the sidebar's count" and presses
   Commit staged, **Then** a commit holds `App.tsx` alone, through the human's hooks.
3. **Given** `docs/web-ui.md` changed, **When** the human presses Discard, **Then** it asks "Discard
   the changes to docs/web-ui.md?", and only Discard restores it.

More scenarios:

1. **Given** an untracked file, **When** it is listed, **Then** it reads "new", and Stage adds it.
2. **Given** a hook refuses the commit, **When** it lands, **Then** its output shows above Changes,
   and the files stay staged.
3. **Given** Uraeda's edits wait, **When** the human presses their pane's Commit, **Then** it
   commits as the Commit page does today, with its suggested message.

### US4: Fix conflicts in the page (P1)

A pull or a merge stops on a conflict. The human resolves each file in the shared editor, or takes
one side whole, then continues or aborts.

[Conflict](/packages/web/src/GitMockups.stories.tsx#Conflict)

Key scenarios:

1. **Given** a pull's rebase stops on `specs/PRIORITIES.md`, **When** the page opens, **Then** it
   reads "The pull stopped: 1 file conflicts.", with the file under Conflicts.
2. **Given** the file opens in the editor, **When** the human presses "Use origin/main" over the
   conflict, **Then** origin's lines stay, the markers go, and the file can still be edited.
3. **Given** every conflict resolved and saved, **When** the human presses Continue, **Then** the
   rebase goes on, and the page reads "6 to push".

More scenarios:

1. **Given** `pnpm-lock.yaml` conflicts, **When** the human presses "Use main" on its row, **Then**
   main's whole file is taken, and the row leaves Conflicts.
2. **Given** a conflict left, **When** the human presses Abort, **Then** `main` is as before the
   pull, its stash put back.
3. **Given** a file deleted on one side and changed on the other, **When** it is listed, **Then** it
   reads "deleted on origin/main, changed on main", with "Keep the file" and "Delete the file".

### US5: Merge a branch into main (P2)

The human merges a branch, local or on `origin`, into `main`, like lazygit's merge. Its conflicts go
to the Conflicts section.

Why this priority: merging locally is rarer than pulling a pull request merged on GitHub.

Key scenarios:

1. **Given** the branch `2026-11-04-vim-mode`, **When** the human picks "Merge into main…" and that
   branch, **Then** git merges it, and the page reads "1 to push".
2. **Given** the merge conflicts, **When** it stops, **Then** the page reads "The merge stopped: 2
   files conflict." with Continue and Abort.

### US6: Clean and remove worktrees (P2)

The human sees every worktree, cleans merged features as `ura clean` does, and removes hand-made
ones.

[Clean, asked](/packages/web/src/GitMockups.stories.tsx#CleanAsked)

Key scenarios:

1. **Given** "Master" PR is merged, **When** the human presses Clean and confirms, **Then** its
   worktree, its branch, and its priorities line go, as `ura clean` does.
2. **Given** `.worktrees/coherence-before` without changes, **When** the human presses Remove and
   confirms, **Then** its folder goes, and its branch, if any, stays.
3. **Given** a worktree with changes, **When** it is listed, **Then** it offers neither Clean nor
   Remove, and reads "has changes".

### US7: Writes wait while an agent works (P2)

A chat's agent working in the main checkout would meet files a pull or a commit changed. The page
reads, and its writes wait for the turn's end.

[Agent working](/packages/web/src/GitMockups.stories.tsx#AgentWorking)

Key scenarios:

1. **Given** a chat's turn runs in the main checkout, **When** the page opens, **Then** it reads "An
   agent works in this checkout.", and Pull, Push, Stage, Commit, and Merge are disabled.
2. **Given** the turn ends, **When** the page updates, **Then** the writes come back.

## Replaced behaviour

- **The Commit page at `/commit`, named Commit.** It becomes the Git page's first section; `/commit`
  leads to `/git`. Guarded by `packages/web/src/__tests__/commit-toast.test.tsx`, whose tests render
  `/commit`, and by `keys-leader-tree.test.tsx`'s "the menu's place entries draw the icon and label
  of the navigation column's links (SC-007)" and "the phone's tabs name theirs as the menu does
  (SC-007)".
- **Commit shows in the sidebar only while something waits.** Git is always there, with its count;
  the phone's tab still shows only while something waits. No test guards the sidebar's.

## Architecture

The core gains a git page's view and its writes, over the existing git module: reads through gix,
writes through `git`, as the [Git](../decisions/git.md) decision asks. The server serves the view,
lands every write in the repository's queue, and fetches in the background. The page is built from
the app's panes, Astryx's `CodeBlock` for diffs, and the shared editor for conflicts. See
[round 01's approaches](discovery-01.md#approaches) and [round 02's](discovery-02.md#approaches).

- **The checkout's state** (core, `git/`) reads the main checkout: staged, unstaged, untracked, and
  conflicted files, ahead and behind `origin`, and the operation in progress, a rebase included. It
  owns which side a conflict's stage is, by branch name, whatever git calls "ours".
- **Diffs** (core, `git/`) give a file's or a commit's unified diff, binary files and size caps
  included. They own the cap of 1,000 lines.
- **The history** (core, `git/`) pages the checked-out branch's commits, each marked to pull or to
  push.
- **Git writes** (core, `git/`) run fetch, pull, push, merge, stage, unstage, discard, commit, a
  conflict's side, continue, abort, and worktree removal, through `process.rs`. They own the pull's
  default: rebase when `pull.rebase` and `pull.ff` are unset. They never force.
- **Clean** reuses `ura clean`'s action, one worktree at a time.
- **The git page's view** (core, `api/`) gathers the sections in one read: sync, Uraeda's edits,
  changes, conflicts, history's first page, and worktrees.
- **The fetcher** (server) fetches each repository on the page's open and every 5 minutes, in the
  write queue, without a toast, and keeps the last failure for the page.
- **The checkout guard** (server) refuses the page's writes while a chat's agent works in the main
  checkout. It owns that rule, beside `writable`'s for features.
- **The Git page** (web) draws the sections and the picked row's diff, the picked row in the
  address. It replaces `CommitPage.tsx`, keeping its `BranchPane`.
- **The conflict bar** (web) is an extension of the shared editor: a bar over each conflict, its
  sides named by branch, then both.

Tradeoffs:

- Diffs are unified only: Astryx's `CodeBlock` has no side-by-side view.
- The page acts on the main checkout only: a feature's branch is fixed by its agent, or a terminal.
- A merge is the only way to bring a branch in: no rebase from the page.

## Edge cases

| Importance | Situation                                         | What happens                                                                           |
| ---------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| High       | Pull with uncommitted edits, autostash off        | git refuses; its message shows; nothing changes                                        |
| High       | The autostash cannot be put back cleanly          | the file lists under Conflicts; the stash is kept, named in the banner                 |
| High       | Push when `origin` has commits `main` lacks       | refused: "origin has commits main lacks: pull first."                                  |
| High       | Discard of an untracked file                      | asks, as for a changed file; the file is deleted only on Discard                       |
| High       | Abort after files were resolved                   | asks "Abort the pull? The resolved files go back as they were."                        |
| High       | A rebase stopped: Uraeda's edits commit on `main` | refused until it continues or aborts: "A pull is stopped: continue or abort it first." |
| Normal     | A chat's agent starts during a pull               | the pull goes on; the page's next writes wait for the turn                             |
| Normal     | Fetch fails for credentials                       | the page shows git's message and the credential hint; no popup                         |
| Normal     | No `origin`                                       | no Fetch, Pull, or Push; the title reads "main · no remote"                            |
| Normal     | Detached `HEAD` in the main checkout              | the title reads "detached at 4f8c2b7"; Pull and Push are disabled                      |
| Normal     | A worktree's folder is gone                       | it reads "missing", with Remove, which prunes its record                               |
| Niche      | A file renamed on one side, changed on the other  | listed with both paths; its sides taken whole only                                     |
| Niche      | A conflict in a binary file                       | "Use origin/main" and "Use main" only; no editor                                       |
| Niche      | A ref name starting with `-`                      | passed after `--end-of-options`, never read as an option                               |

## Success criteria

- **SC-001** (100 ms): the page draws within 100 ms from what the server holds, on Uraeda's own
  repository, as the benchmark measures.
- **SC-002** (no terminal): after a pull request merges on GitHub, pulling and pushing take three
  presses from any page: `Space g`, Pull, then Push.
- **SC-003** (nothing lost): no write of the page forces, and a discard, a removal, or an abort
  never runs without its confirmation, as the core's tests check.
- **SC-004** (agent safe): while a chat's agent works in the main checkout, every write of the page
  is refused, as the server's tests check.

## Assumptions

The points settled in round 02, [to check](clarifications-02.md#check-these) and
[without the human](clarifications-02.md#settled-without-the-human), hold as written there. Settled
while writing this spec:

- **Merging into `main`**: with the main checkout only, merging is "Merge into main…" on a branch
  you pick. Round 02's merge answer is read so. See
  [round 02](discovery-02.md#bringing-main-into-a-branch).
- **The pull's default**: with `pull.rebase` and `pull.ff` unset, the page passes `--rebase`;
  otherwise it runs `git pull` as configured. See [round 01](discovery-01.md#pulling).
- **The commit message field** is the shared editor, as the commit panes' message is.
- **Delete and rename conflicts** offer whole sides only, in plain words, as lazygit does. See
  [lazygit](discovery-01.md#lazygit).
- **The sidebar's count** is the changes to commit plus the commits to pull, "Git · 3 · ↓3".
- **Keys**: `p` pull, `P` push, `f` fetch, `space` stage or unstage, `c` commit staged, `d` discard,
  `m` merge, `j`/`k` and Enter in the lists.

## Constitution check

| I. Humans in control | II. Git and plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | ---------------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅                     | ✅         | ✅                | ✅                |

## Risk tier

**High**: new git writes that rewrite `main`, discard files, and remove worktrees, each guarded by a
confirmation or the human's git configuration.
