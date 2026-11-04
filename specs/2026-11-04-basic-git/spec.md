---
status: awaiting-human
revision: 2
clarifications: 2
risk-tier: high
plan-review: false
---

# Spec: Basic git UI in the web UI

> [!IMPORTANT]
>
> Spec to review again, about 10 minutes.
>
> - You approve a generic git page for the main checkout, replacing the Commit page. It pulls,
>   pushes, merges, stages and commits any file, and fixes conflicts in the shared editor.
> - Changed since your review: Uraeda's described edits are gone. Every changed file is in one list,
>   the inbox and priorities included, staged by Space as in lazygit.
> - Gone with them: suggested messages, amending the latest chore, and Discard's undo of note moves.
>   Their tests are under Replaced behaviour.
> - Read one way: a feature's worktree with uncommitted buffer edits gets its own group in the list,
>   so those edits can still be committed.
> - Keyboard tension: Space stages a focused file row, as a checkbox, which `fields.ts` already lets
>   own Space. There the leader menu opens with Ctrl+K. The Keyboard decision does not change.
> - Unverified: credentials when the server runs git without a terminal. The plan's first task
>   checks a pull and a push.
> - Changed decision: Git, "the Commit page" renamed. Risk tier high: discards, removals, and a
>   rebasing pull, each asked first or as your git configuration says.

A git page in the web UI, to work fully remotely: the human pulls `main` after a pull request
merges, pushes, reads diffs, commits, merges, fixes conflicts, reads the history, and cleans
worktrees. It is a simple, generic client in lazygit's spirit, for the main checkout, and it
replaces the Commit page. The human runs these commands, never an agent. See the
[proposal](proposal.md), the discovery's rounds [01](discovery-01.md) and [02](discovery-02.md), and
the answers of [round 01](clarifications-01.md) and [round 02](clarifications-02.md).

## Your review

- **C1** (one list of changed files, Space stages): done. Changes lists every file, the inbox and
  the priorities included, with `j`/`k` or the arrows to move and Space to stage or unstage. The
  described pane is gone.
- **C2** (capital letters for keys, `p` pull and `P` push): done. The keys are in
  [Assumptions](#assumptions), lazygit's, capitals included.

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
   **Then** the edit is stashed and put back, still in Changes.
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

### US3: Stage and commit any file (P1)

Every changed file is in one list, the inbox and priorities included, as in lazygit. The human moves
with `j`/`k` or the arrows, stages with Space, and commits what is staged.

[Behind](/packages/web/src/GitMockups.stories.tsx#Behind)

Key scenarios:

1. **Given** `specs/INBOX.md` and `docs/web-ui.md` changed, **When** the human picks
   `specs/INBOX.md` and presses Space, **Then** it moves under "Staged".
2. **Given** `specs/INBOX.md` staged, **When** the human writes "chore: notes" and presses `c`,
   **Then** a commit holds `specs/INBOX.md` alone, through the human's hooks.
3. **Given** `docs/web-ui.md` changed, **When** the human presses `d`, **Then** it asks "Discard the
   changes to docs/web-ui.md?", and only Discard restores it.

More scenarios:

1. **Given** an untracked note file, **When** it is listed, **Then** it reads "new", and Space adds
   it.
2. **Given** a hook refuses the commit, **When** it lands, **Then** its output shows above Changes,
   and the files stay staged.
3. **Given** a buffer saved `spec.md` in the Vim mode worktree, **When** the page opens, **Then**
   Changes shows it under "Vim mode", with its own Commit.
4. **Given** nothing staged, **When** the human presses `a`, **Then** every file of main is staged.

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

- **The Commit page at `/commit`, named Commit.** `/commit` leads to `/git`. Guarded by
  `packages/web/src/__tests__/commit-toast.test.tsx`, whose tests render `/commit`, and by
  `keys-leader-tree.test.tsx`'s "the menu's place entries draw the icon and label of the navigation
  column's links (SC-007)" and "the phone's tabs name theirs as the menu does (SC-007)".
- **Uraeda's edits described as changes, one pane per branch, with a suggested message.** The list
  shows files, and the message starts empty. Guarded by `crates/core/tests/branch_commits.rs`'s
  `each_branch_lists_its_buffer_edits`, `a_buffer_edit_is_one_edit_line`,
  `a_typed_message_is_never_amended`, `a_typed_message_is_committed_as_typed`, and
  `a_refused_deferred_commit_keeps_its_pane`. Also `commit-toast.test.tsx`'s "a typed commit message
  stays once its commit is refused", "a landed typed message goes, and the same change again reads
  the suggestion", and "a rewritten message is unsaved text: leaving asks, and it comes back with
  its notice".
- **A suggested commit amends the latest suggested one, while unpushed.** Each commit is new.
  Guarded by `a_suggested_message_amends_the_latest_suggested_one` and
  `a_feature_commit_keeps_the_typed_mark_of_the_default_branch`.
- **Discard puts back what Uraeda's edits moved, note files and link repairs together.** Discard
  restores one file, as git does. Guarded by `a_branch_discards_alone` and
  `a_buffer_edit_of_the_inbox_discards_the_note_files_it_links`.
- **Committing a buffer's inbox edit takes the note files it links.** The human stages each file.
  Guarded by `a_buffer_edit_of_the_inbox_commits_the_note_files_it_links`.
- **Commit shows in the sidebar only while something waits.** Git is always there, with its count;
  the phone's tab still shows only while something waits. No test guards the sidebar's.

## Architecture

The core gains a git page's view and its writes, over the existing git module: reads through gix,
writes through `git`, as the [Git](../decisions/git.md) decision asks. The server serves the view,
lands every write in the repository's queue, and fetches in the background. The page is built from
the app's panes, Astryx's `CodeBlock` for diffs, and the shared editor for conflicts. See
[round 01's approaches](discovery-01.md#approaches) and [round 02's](discovery-02.md#approaches).

- **The checkout's state** (core, `git/`) reads the main checkout, and each worktree with changes:
  staged, unstaged, untracked, and conflicted files, ahead and behind `origin`, and the operation in
  progress, a rebase included. It owns which side a conflict's stage is, by branch name, whatever
  git calls "ours".
- **Diffs** (core, `git/`) give a file's or a commit's unified diff, binary files and size caps
  included. They own the cap of 1,000 lines.
- **The history** (core, `git/`) pages the checked-out branch's commits, each marked to pull or to
  push.
- **Git writes** (core, `git/`) run fetch, pull, push, merge, stage, unstage, discard, commit, a
  conflict's side, continue, abort, and worktree removal, through `process.rs`. They own the pull's
  default: rebase when `pull.rebase` and `pull.ff` are unset. They never force.
- **Clean** reuses `ura clean`'s action, one worktree at a time.
- **The git page's view** (core, `api/`) gathers the sections in one read: sync, changes, conflicts,
  history's first page, and worktrees.
- **The fetcher** (server) fetches each repository on the page's open and every 5 minutes, in the
  write queue, without a toast, and keeps the last failure for the page.
- **The checkout guard** (server) refuses the page's writes while a chat's agent works in the main
  checkout, and a worktree group's while its feature's agent works. It owns that rule, beside
  `writable`'s for features.
- **The Git page** (web) draws the sections and the picked row's diff, the picked row in the
  address. It replaces `CommitPage.tsx` and its panes. A file row is a checkbox, staged or not, so
  Space ticks it.
- **The conflict bar** (web) is an extension of the shared editor: a bar over each conflict, its
  sides named by branch, then both.

Tradeoffs:

- Diffs are unified only: Astryx's `CodeBlock` has no side-by-side view.
- The page acts on the main checkout only: a feature's branch is fixed by its agent, or a terminal.
- A merge is the only way to bring a branch in: no rebase from the page.
- Uraeda's edits lose their descriptions: a note moved out of the inbox reads as two files changed.
- Space on a file row stages: the leader menu opens there with Ctrl+K, or once the focus leaves it.

## Edge cases

| Importance | Situation                                        | What happens                                                                           |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| High       | Pull with uncommitted edits, autostash off       | git refuses; its message shows; nothing changes                                        |
| High       | The autostash cannot be put back cleanly         | the file lists under Conflicts; the stash is kept, named in the banner                 |
| High       | Push when `origin` has commits `main` lacks      | refused: "origin has commits main lacks: pull first."                                  |
| High       | Discard of an untracked file                     | asks, as for a changed file; the file is deleted only on Discard                       |
| High       | Abort after files were resolved                  | asks "Abort the pull? The resolved files go back as they were."                        |
| High       | A rebase stopped: an action commits on `main`    | refused until it continues or aborts: "A pull is stopped: continue or abort it first." |
| Normal     | A chat's agent starts during a pull              | the pull goes on; the page's next writes wait for the turn                             |
| Normal     | Fetch fails for credentials                      | the page shows git's message and the credential hint; no popup                         |
| Normal     | No `origin`                                      | no Fetch, Pull, or Push; the title reads "main · no remote"                            |
| Normal     | Detached `HEAD` in the main checkout             | the title reads "detached at 4f8c2b7"; Pull and Push are disabled                      |
| Normal     | A worktree's folder is gone                      | it reads "missing", with Remove, which prunes its record                               |
| Niche      | A file renamed on one side, changed on the other | listed with both paths; its sides taken whole only                                     |
| Niche      | A conflict in a binary file                      | "Use origin/main" and "Use main" only; no editor                                       |
| Niche      | A ref name starting with `-`                     | passed after `--end-of-options`, never read as an option                               |

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
- **The commit message field** is the shared editor, empty until typed, kept as unsaved text.
- **A feature's worktree with changes**, such as a buffer's save, gets its own group in Changes,
  under the feature's name. The page acts on no other worktree.
- **Delete and rename conflicts** offer whole sides only, in plain words, as lazygit does. See
  [lazygit](discovery-01.md#lazygit).
- **The sidebar's count** is the changes to commit plus the commits to pull, "Git · 3 · ↓3".
- **Keys**, lazygit's: `p` pull, `P` push, `f` fetch, Space stage or unstage, `a` stage all, `c`
  commit staged, `d` discard the file or remove the worktree, `M` merge into main, `m` continue or
  abort a stopped pull or merge, `j`/`k` and Enter in the lists.

## Constitution check

| I. Humans in control | II. Git and plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | ---------------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅                     | ✅         | ✅                | ✅                |

## Risk tier

**High**: new git writes that rewrite `main`, discard files, and remove worktrees, each guarded by a
confirmation or the human's git configuration.

## History

> [!NOTE]
>
> Changes requested on 2026-11-04: one list of changed files, staged by Space, and capital letters
> for keys.
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
