---
status: answered
---

# Clarifications, round 02: Basic git UI in the web UI

> [!NOTE]
>
> Answered on 2026-11-04.
>
> - Verdict: worth building, with changes: a generic client as you asked, where worktrees are the
>   only real choice.
> - Which worktree the page acts on decides how you fix a pull request's conflicts remotely.
> - Rebasing a feature's branch needs a forced push, which the Git decision forbids today.
> - Your earlier answer kept other files read only; a generic client commits them.
> - Everything else is settled from your answers and lazygit's habits: check the list before the
>   questions.

## Context

### Since the last round

[Round 01](clarifications-01.md) asked 13 questions, and you answered 8. You then asked for a
simpler round: a generic git client like lazygit, Magit, or VS Code's, to work fully remotely. You
run the merges, pulls, and pushes, not agents. The Git decision does not limit the page's actions,
and everything goes in one spec. Your answers are now the settled points below, and the questions
are about worktrees.

### Goal

A git page in the web UI, to work fully remotely: pull, push, diffs, commits, conflicts, history,
and worktrees, like lazygit but simpler. It replaces the Commit page, and opens with `Space g`.

### Today

- Uraeda keeps one worktree per feature and change under `.worktrees/`, each with its own branch,
  uncommitted changes, and operation in progress. The main checkout holds `main`.
- The server knows when an agent works in each worktree, and refuses writes to a feature's files
  meanwhile ([`runner/sessions.ts`](/packages/server/src/runner/sessions.ts)).
- Nothing fetches, pulls, pushes, merges, or shows a diff's lines. Only `ura clean`, in a terminal,
  removes merged worktrees.

| Product        | Picking the worktree                             | Removing one                         |
| -------------- | ------------------------------------------------ | ------------------------------------ |
| lazygit        | a Worktrees panel; switching moves the whole UI  | never the main or current one        |
| GitHub Desktop | a "Current Worktree" menu beside the branch's    | not documented                       |
| VS Code        | every worktree listed as a repository of its own | removes the folder, keeps the branch |
| Zed            | a picker that switches the workspace             | only those not open                  |

### Scope

The whole page in one spec: sync, changes, commits, conflicts, history, and worktrees. Left out:
stash, undo, and switching branches inside a worktree.

### Sources

- The server's sessions and refusals, the commit panes, and the core's worktree reads.
- lazygit's keybindings and strings, GitHub Desktop 3.6, VS Code's branches and worktrees page,
  Zed's git page, GitHub's conflict editor.
- [Round 01's discovery](discovery-01.md), for pull, conflicts, diffs, and the products.
- The full investigation of this round is in [discovery](discovery-02.md).

## Check these

- **One spec** holds everything, past 6 stories, as you answered.
- **Conflicts** open in the shared editor with a bar over each one: "Use main", "Use <branch>", or
  both, named by branch. A conflicted file also offers its whole side, for lock files. Then Continue
  or Abort. No agent hand-off. See [round 01](discovery-01.md#fixing-conflicts).
- **Pull** follows your git configuration, and rebases when it says nothing. Uncommitted changes
  follow `rebase.autoStash`. See [round 01](discovery-01.md#pulling).
- **Fetch** runs when the page opens and every 5 minutes; a failure shows on the page, never as a
  popup. See [round 01](discovery-01.md#fetching).
- **Push** sends the worktree's branch, and refuses when `origin` has commits it lacks. Forcing it
  depends on bringing main in, below. See [round 01](discovery-01.md#push).
- **Diffs** of the uncommitted changes and of any commit, unified, drawn by Astryx's `CodeBlock`.
  See [round 01](discovery-01.md#diff-rendering).
- **History** lists the worktree's branch's commits, newest first, the unpushed and unpulled ones
  marked; each opens its files and diffs. No graph: your history is a line. See
  [round 01](discovery-01.md#history).
- **Layout**, like lazygit: on wide screens, sections on the left and the selected diff on the
  right. On the phone, the sections in one column, and a diff as its own page. See
  [round 01](discovery-01.md#approaches).
- **The page's place**: "Git" always in the sidebar, with a count of what waits. On the phone, its
  tab shows while something waits. `Space g` and `g c` open it, and `/commit` leads to it. See
  [round 01](discovery-01.md#the-pages-place-and-keys).
- **The Git decision** only gets the page's new name in its commit rule. See
  [round 01](discovery-01.md#the-current-commit-look-and-behaviour-can-stay).
- **Stash and undo** are left out: a pull's autostash covers the one need, and lazygit's undo covers
  neither the working tree nor a push. See [round 01](discovery-01.md#needs-no-choice).

## Q1: Which checkout does the page act on?

Example: the pull request of "Vim mode" reports conflicts after another one merged. You are on your
phone. Fixing it means bringing `main` into its branch, in its worktree
`.worktrees/2026-11-04-vim-mode`, then pushing. Each worktree has its own changes, branch, and
history. More in [discovery](discovery-02.md#which-checkout).

Why it matters: it decides whether the page can fix a feature's branch, and how the page is shaped.

- **A (recommended). One worktree at a time, picked from a list at the page's top, the main checkout
  first. Each worktree reads as its feature's name, and the choice is in the address.**
  - Example: you pick "Vim mode"; the changes, history, pull, and push are now its branch's.
  - [pro] lazygit's and GitHub Desktop's model; every section stays as simple as for one checkout.
  - [con] one more control at the top of the page.
  - Why recommended: it covers remote conflict fixes with the simplest page.
- **B. Every worktree on the page at once, a section each, like VS Code's list of repositories.**
  - Example: "main", "Vim mode", and "Reading long" each show their changes and their sync.
  - [pro] everything at a glance.
  - [con] a long page, and the history and diffs need a worktree anyway.
- **C. The main checkout only.**
  - [pro] the smallest.
  - [con] a feature's conflicts still need a terminal.

**Answer:** C

## Q2: What can you do in a worktree while its agent works?

Example: you pick "Vim mode" while its agent is running a turn. A commit there would take files the
agent is editing. A merge would change them under it. Today, a write to a feature's files waits
until its agent stops. With the main checkout only (C in Q1), this still applies to a chat's agent
there. More in [discovery](discovery-02.md#an-agent-working-there).

Why it matters: it decides whether the page can surprise a running agent.

- **A (recommended). The page reads that worktree, but its writes are refused, saying an agent works
  there, until the turn ends.**
  - [pro] an agent never meets changed files; it matches the rest of Uraeda.
  - [con] you stop the agent, or wait, before fixing its branch.
  - Why recommended: a conflict fix during a turn would be redone or undone by the agent.
- **B. The page writes there after a warning.**
  - [pro] you never wait.
  - [con] the agent may commit your half-fixed files, or fail on them.

**Answer:** A

## Q3: How does the page bring `main` into a feature's branch?

Example: "Vim mode" conflicts with `main` on GitHub. A merge adds a merge commit, then pushes
normally; GitHub's own conflict editor merges too. A rebase replays the branch's commits on `main`,
so the push must replace the branch on GitHub: a forced push. The Git decision forbids every forced
push today. Agents rebase their own branch before review, and keep a merge commit you made, with
their next pull. With the main checkout only (C in Q1), choose C here. More in
[discovery](discovery-02.md#bringing-main-into-a-branch).

Why it matters: a forced push can drop commits someone pushed meanwhile; the decision exists for
that.

- **A (recommended). Merge: "Merge main into Vim mode", then an ordinary push.**
  - [pro] no forced push, and the Git decision stays as it is.
  - [con] one merge commit per fix in the branch's history.
  - Why recommended: it is what GitHub does, and it never loses a commit.
- **B. Merge or rebase, your choice each time; a rebase's push is forced with `--force-with-lease`,
  after asking. The Git decision then allows a forced push the human confirms.**
  - [pro] a linear history, as agents keep it.
  - [con] a changed decision, and a forced push one tap away.
- **C. Neither: the page pulls and pushes only.**
  - [pro] the smallest.
  - [con] a pull request's conflicts still need a terminal or an agent.

**Answer:** A

## Q4: Does the page commit files other than Uraeda's own edits?

In round 01, you answered that other changed files show read only, with their diffs. A generic
client stages and commits any file: by file in VS Code and Zed, by hunk in lazygit and Magit. The
commit panes stay for Uraeda's described edits. More in
[discovery](discovery-02.md#committing-other-files).

Why it matters: it decides whether a change by hand, or an agent's leftover, ever needs a terminal.

- **A (recommended). Stage, unstage, and discard each file, then commit what is staged, with a
  message. Discard asks first.**
  - [pro] VS Code's model, enough for working remotely.
  - [con] a second kind of commit beside the panes' described ones.
  - Why recommended: it is the generic client you described, at its simplest.
- **B. A, plus staging single hunks from a diff, like lazygit.**
  - [pro] lazygit's precision.
  - [con] the diff becomes interactive, beyond Astryx's `CodeBlock`.
- **C. Read only, as you answered in round 01.**
  - [pro] nothing new to guard.
  - [con] committing code stays in a terminal.

**Answer:** A

## Q5: Which actions does the worktree list offer?

Uraeda creates a worktree when a feature starts, and `ura clean` removes merged ones with their
branch and their priorities line. `.worktrees/coherence-before` here was made by hand. lazygit and
VS Code never remove the main worktree, and ask for one with changes. More in
[discovery](discovery-02.md#worktree-actions).

Why it matters: removing is the one destructive action of the list.

- **A (recommended). Clean on merged ones, which does what `ura clean` does, and Remove on any other
  without changes, its branch kept. Both ask first.**
  - [pro] the after-merge chore and hand-made leftovers, both from the page.
  - [con] two removal actions to tell apart.
  - Why recommended: it covers both cases without forcing anything.
- **B. Clean on merged ones only.**
  - [pro] one action.
  - [con] hand-made worktrees stay until a terminal.
- **C. A, plus creating a worktree from a branch.**
  - [pro] lazygit's full panel.
  - [con] Uraeda's starts already create the ones you need.

**Answer:** A

## Settled without the human

### Behaviour

- **The sides of a conflict** are named by branch, never "ours" and "theirs", which swap during a
  rebase. See [round 01](discovery-01.md#git-256-conflicts).
- **A write's output**, a pull, a push, a merge, or a commit, shows in the commit toast as it comes.
  A refusal shows on the page, with git's message. See [round 01](discovery-01.md#important-reads).
- **A credential failure** shows git's message, and says the server runs git without a terminal. See
  [round 01](discovery-01.md#git-256-pull-and-fetch).
- **A binary file** shows its size change; a diff over 1,000 lines shows its counts and a button
  that opens it whole. See [round 01](discovery-01.md#needs-no-choice).
- **The page's keys** follow lazygit where the base set allows: `p` pull, `P` push, `f` fetch, space
  to stage, `c` to commit, `j`/`k` and Enter in the lists. See [round 01](discovery-01.md#lazygit).
- **A diff marks its lines** with `+` and `−` in a sign column, never by colour alone.

### Under the hood

- **Reads go through gix**, conflicts, ahead and behind, and diffs, with the features already on.
  **Writes go through `git`**, refs after `--end-of-options`, with `GIT_TERMINAL_PROMPT=0`. See
  [round 01](discovery-01.md#gix-089).
- **Every write lands in the repository's write queue**, a background fetch included, without a
  toast for it. See [round 01](discovery-01.md#important-reads).
- **The sandbox's sample projects** get a remote, a commit to pull, a feature behind `main`, and a
  conflict, so the page can be tried. See [round 01](discovery-01.md#likely-changes).

**Notes:** Use the uraeda design system for the mockups
