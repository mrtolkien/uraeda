# Discovery, round 02: Basic git UI in the web UI

## Why this round

[Round 01](clarifications-01.md) asked 13 questions. The human answered 8, then asked for a new
round in the session: the page is a simple, generic git client like lazygit, Magit, or VS Code's,
used to work fully remotely. Merging with conflicts, pulling, and pushing are the human's commands,
not an agent's. The Git decision is not a constraint on the page's actions, and everything goes in
one spec. The only complexity left is worktrees. This round builds on
[round 01's discovery](discovery-01.md) and adds what that direction needs.

## Summary

Round 01's answers, read as a direction: one spec for everything; conflicts fixed in the shared
editor with a bar over each conflict; pull follows the git configuration, rebasing when it says
nothing; autostash follows `rebase.autoStash`; fetch on the page's open and every 5 minutes; push,
never forced; diffs of uncommitted changes and of any commit, drawn by Astryx's `CodeBlock`. One
answer reads against the new direction: other changes shown read only.

What is left is which checkout the page acts on. Uraeda keeps one worktree per feature, each with
its own uncommitted changes, branch, and operation in progress. Working fully remotely means fixing
a pull request's conflicts from the page: in the feature's worktree, by merging or rebasing the
default branch into its branch. An agent may be working in that worktree at the time.

## How other products do it

### Picking the worktree

- **lazygit**: a Worktrees panel, where `space` "Switch to the selected worktree", with the message
  "Changing directory to {{.path}}": the whole interface then acts on that worktree. Checking out a
  branch held by another worktree asks "Do you want to switch to that worktree?". It never removes
  the main or the current worktree.
  [Keybindings](https://github.com/jesseduffield/lazygit/blob/master/docs/keybindings/Keybindings_en.md),
  [english.go](https://raw.githubusercontent.com/jesseduffield/lazygit/refs/heads/master/pkg/i18n/english.go)
- **GitHub Desktop 3.6**: "a new Current Worktree menu in the top toolbar, alongside Current
  Repository and Current Branch", listing every worktree with its branch, and a New Worktree button.
  Removing one is not mentioned.
  [Desktop 3.6](https://github.blog/changelog/2026-06-26-github-desktop-3-6-worktrees-and-deeper-copilot-integration/)
- **VS Code**: "Each worktree appears as a separate repository in the Source Control Repositories
  view", each with its own changes: "they don't share working files or uncommitted changes".
  "Deleting a worktree removes its working directory, not its branch", with "Force Delete" when it
  has changes.
  [Branches and worktrees](https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees)
- **Zed**: a worktree picker in the title bar that can "Switch the current workspace to an existing
  worktree", create one, or "Delete linked worktrees that are not currently open".
  [Zed's git](https://zed.dev/docs/git)

### Bringing the default branch into a branch

- **lazygit**: on the branches panel, `M` merges the selected branch into the checked-out one, and
  `r` rebases the checked-out one onto it. A diverged push asks, then force-pushes with
  `--force-with-lease`. [lazygit in round 01](discovery-01.md#lazygit)
- **GitHub's web editor** resolves a pull request's conflicts by merging: "Resolving conflicts on
  GitHub merges the entire base branch into the head branch."
  [Resolving on GitHub](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/resolving-a-merge-conflict-on-github)
- **VS Code and JetBrains** merge or rebase from their branch menus, and their sync after a rebase
  needs a forced push. [VS Code in round 01](discovery-01.md#vs-code)

### Committing any file

Every client compared stages and commits any file: by file in GitHub Desktop, VS Code, and Zed; by
hunk and line in lazygit, gitui, tig, Magit, and GitHub Desktop. Discarding asks, or keeps a copy:
GitHub Desktop moves discarded changes to the Trash.
[What they have in common](discovery-01.md#what-they-have-in-common)

### What they have in common

- One worktree at a time drives the whole interface, picked from a list showing each one's branch
  (lazygit, GitHub Desktop, Zed). VS Code lists them side by side instead.
- Merge or rebase another branch into the checked-out one, from the branches.
- Remove a worktree, never the main or the current one, asking when it has changes.
- Stage and commit any file, at least by file.

## Standards and libraries

### git 2.56: bringing a branch in

- **`git merge <branch>`** records a merge commit, or fast-forwards, and stops at a conflict with
  `MERGE_HEAD`; `git merge --continue` or `--abort` end it. Its push is an ordinary one.
  [git-merge](https://git-scm.com/docs/git-merge)
- **`git rebase <branch>`** replays the branch's commits, stopping at each conflict, with
  `rebase-merge/` and a detached `HEAD`. The branch's pushed commits are replaced, so its push needs
  `--force-with-lease`, which refuses when the remote branch moved since the last fetch. A fetch in
  the background refreshes that lease, which lazygit's users say makes it "does absolutely nothing
  in practice". [git-push](https://git-scm.com/docs/git-push),
  [#3468](https://github.com/jesseduffield/lazygit/issues/3468)
- **Worktrees**: each one's operation in progress lives in its own git folder, so a merge in a
  feature's worktree leaves the main checkout untouched. See
  [round 01](discovery-01.md#git-256-conflicts).

## The code

### Important reads

- [`packages/server/src/runner/sessions.ts`](/packages/server/src/runner/sessions.ts): `working`
  lists the features and changes whose session has a turn running, starting, or queued, and `busy`
  says whether any session of the repository does, a chat's included. A chat session runs in the
  main checkout, with no folder. The server can therefore tell, per worktree, whether an agent works
  there.
- [`packages/server/src/fate/sessions.ts`](/packages/server/src/fate/sessions.ts): `writable`
  refuses a write to a feature's files while its agent works, "refused: ..." with the shared
  refusal's text.
- [`crates/core/src/api/commit_panes.rs`](/crates/core/src/api/commit_panes.rs): the commit panes
  already walk every worktree with a branch, and read each one's own changes: the page's
  per-worktree reads follow the same walk.
- [`crates/core/src/git.rs`](/crates/core/src/git.rs): `worktrees` and `worktree_records` list them,
  with `locked` and `missing`; `has_local_changes` reads one; `remove_worktree` is never forced;
  `switch` changes a checkout's branch. See [round 01's reads](discovery-01.md#important-reads).
- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs): each feature knows its branch and
  its worktree, so a worktree shows as the feature it belongs to, by name.
- The [Git](../decisions/git.md) decision forbids tools to force-push, with no exception for a
  human's press: "Tools MUST NOT lose the user's work: no force-removed worktree, no force-push".

### The proposal's path and existing actions

- **A pull request reports conflicts** after another one merged. Remotely, the human opens the git
  page, picks the feature's worktree, fetches, merges or rebases `origin/main` into its branch,
  fixes the conflicts in the editor, continues, and pushes. With a rebase, the push must replace the
  branch on GitHub: a forced push. With a merge, it is an ordinary push.
- **An agent works in that worktree** meanwhile: a merge or a commit there changes the files and the
  index under it. Today a write to a feature's files is refused while its agent works.
- **The skill's catch-up** has agents rebase their branch and push with `--force-with-lease`
  ([implementation](/skills/uraeda/references/implementation.md)). A human's merge commit on the
  branch is kept by the agent's next `git pull --rebase`, which rebases its own commits over it.
- **Committing a code file** by hand: the commit panes describe Uraeda's own edits only. A generic
  client lists every changed file, staged or not.
- **Cleaning after a merge**: `ura clean` removes the worktree, the branch, and the priorities line,
  never forced, from a terminal only.

### Likely changes

On top of [round 01's](discovery-01.md#likely-changes):

- [`crates/core/src/git/`](/crates/core/src/git/): reads and writes taking the worktree they act on;
  stage, unstage, discard, merge, rebase, and their continue and abort.
- [`packages/server/src/fate/`](/packages/server/src/fate/): the page's mutations, refused or not
  while an agent works there, per [an agent working there](#an-agent-working-there).
- [`packages/web/src/`](/packages/web/src/): the worktree picker, its choice in the page's address,
  as the [UI layout](../decisions/ui-layout.md) decision asks.
- [`specs/decisions/git.md`](../decisions/git.md): the rename of "the Commit page", and its no
  force-push rule, if [bringing main in](#bringing-main-into-a-branch) rebases.

## The proposal

### A generic client, and Uraeda's described commits

The commit panes describe Uraeda's edits and suggest their message. A generic client lists files.
The human asked for both: the panes stay "when they are uncommitted changes", and the page is
generic. Round 01's answer kept other files read only, which a generic client does not.

### Worktrees are named, not asked

The proposal says "look at the commit history, worktrees". Working fully remotely adds acting in
them: a pull request's conflicts are fixed in the feature's worktree, not the main checkout.

## Approaches

Criteria: the human's direction (simple, generic, fully remote, the human runs the commands); round
01's answers; [UI layout](../decisions/ui-layout.md) (an open detail is in the address);
[Keyboard](../decisions/keyboard.md).

### Which checkout

What the page acts on. Relies on [picking the worktree](#picking-the-worktree).

| Option                                                                 | Like                         | Address                  | Remote PR conflicts |
| ---------------------------------------------------------------------- | ---------------------------- | ------------------------ | ------------------- |
| A. One worktree at a time, picked from a list, the main checkout first | lazygit, GitHub Desktop, Zed | `/git?worktree=<branch>` | yes                 |
| B. Every worktree on the page, a section each                          | VS Code's repository list    | `/git`                   | yes, a long page    |
| C. The main checkout only                                              | none of them                 | `/git`                   | no                  |

### An agent working there

Relies on [important reads](#important-reads).

| Option                                        | While its agent works            | Risk                          |
| --------------------------------------------- | -------------------------------- | ----------------------------- |
| A. Reads only: writes refused with the reason | as Uraeda's feature writes today | none                          |
| B. Writes allowed after a warning             | lazygit (no notion of agents)    | the agent meets changed files |

### Bringing main into a branch

Relies on [bringing the default branch into a branch](#bringing-the-default-branch-into-a-branch).

| Option                                                                                  | Push after | Git decision                   |
| --------------------------------------------------------------------------------------- | ---------- | ------------------------------ |
| A. Merge another branch into the checked-out one                                        | ordinary   | fits                           |
| B. A, plus rebase onto another branch, then push with `--force-with-lease` after asking | forced     | its no force-push rule changes |
| C. No merge or rebase from the page                                                     | n/a        | fits                           |

### Committing other files

Relies on [committing any file](#committing-any-file). Round 01's answer was read only.

| Option                                                         | Staging  | Like              |
| -------------------------------------------------------------- | -------- | ----------------- |
| A. Stage, unstage, and discard per file; commit what is staged | per file | VS Code, Zed      |
| B. A, plus per hunk from the diff                              | per hunk | lazygit, Magit    |
| C. Read only                                                   | none     | round 01's answer |

### Worktree actions

Relies on [picking the worktree](#picking-the-worktree).

| Option                                                                                      | Clean merged | Remove any | Create |
| ------------------------------------------------------------------------------------------- | ------------ | ---------- | ------ |
| A. Clean merged ones, as `ura clean`, and remove any other without changes, its branch kept | yes          | yes        | no     |
| B. Clean merged ones only                                                                   | yes          | no         | no     |
| C. A, plus create one from a branch                                                         | yes          | yes        | yes    |

### Needs no choice

- **Switching branches** inside a worktree: each worktree holds its branch, and Uraeda's starts make
  new ones. A generic client switches branches; here, picking the worktree does the job.
- **Pulling in a feature's worktree** pulls its branch from `origin`, with the same rules as main's
  pull: round 01's answers apply to every worktree.
- **The commit panes** stay, for Uraeda's described edits, in the worktree they belong to.

## Not checked

- Whether GitHub Desktop's changes and history follow the selected worktree: its changelog does not
  say.
- Whether lazygit's switch moves every panel: inferred from "Changing directory to", not stated.
