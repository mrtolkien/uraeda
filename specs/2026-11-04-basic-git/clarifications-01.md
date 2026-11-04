---
status: awaiting-human
---

# Clarifications, round 01: Basic git UI in the web UI

> [!IMPORTANT]
>
> 13 questions and 2 follow-ups, about 35 minutes.
>
> - Verdict: worth building, with changes: fixing conflicts in the page is a feature of its own. And
>   "pull main" is never a fast-forward here: `main` holds Uraeda's unpushed chores.
> - The split comes first: the page now, editing conflicts by hand later, with an agent to hand
>   conflicts to meanwhile.
> - Two choices last beyond this feature: what draws diffs, Astryx or a new dependency. And the Git
>   decision's new rules for pull, push, and fetch.
> - Pulling, uncommitted edits, and fetching work together: they decide whether a pull ever stops to
>   ask.
> - Not verified yet: how your credentials behave when the server runs git without a terminal.
> - Four settled points to check before the questions, among them refusing a pull while an agent
>   works in the main checkout.

## Context

### Goal

The [proposal](proposal.md) asks for a git page in the web UI, "pretty much web lazygit" but less
deep. It pulls main after a pull request merges, shows diffs and merge conflicts, and the history
and worktrees. It replaces the Commit page, opens with `Space g`, and keeps the commit panes for
uncommitted changes. Its components fit Uraeda's look.

### Today

- **Committing**: the [Commit page](/packages/web/src/CommitPage.tsx) lists only the workflow files
  the web UI edited (inbox, priorities, proposals, notes, buffers), described as changes, one pane
  per branch. A code file changed by hand never shows. It opens from the sidebar's "Commit · N" and
  the phone's tab while something waits, and from `g c`.
- **Pulling**: nothing in Uraeda fetches, pulls, or pushes. Your local `main` is 6 commits ahead of
  `origin/main` right now, all Uraeda's own `chore(...)` commits, and your git configuration sets
  `pull.rebase true` and `rebase.autostash true`. Your pulls in the reflog are rebases.
- **Diffs**: only counts, "+120 −4", in a session's Changes panel and on a feature's card. No page
  shows a line of code.
- **Conflicts**: nothing reads them. Agents already rebase their branch on main before their final
  review, and resolve its conflicts within the spec.
- **Worktrees**: a start creates one per feature under `.worktrees/`; only `ura clean`, in a
  terminal, removes the merged ones.
- **The core** reads git with gix and writes through `git`, one write after another, each streamed
  to the commit toast. Branches, worktrees, ahead and behind, and a commit walk already exist.

| Product        | Pull                          | Conflicts                                    | History        |
| -------------- | ----------------------------- | -------------------------------------------- | -------------- |
| lazygit        | your git config               | pick per hunk, one side per file, abort      | graph          |
| VS Code        | your git config               | three-way editor, per conflict buttons, AI   | graph          |
| GitHub Desktop | pull, or pull with rebase     | external editor, conflicted-file list, AI    | list           |
| JetBrains      | asks: merge, rebase, or reset | one side per file, or a three-pane merge     | graph, filters |
| Zed            | your git config               | "Use main", "Use other", "Use both" per hunk | file history   |

### Scope

The git page: the checked-out branch against `origin`, with pull, push, and fetch. Then the
uncommitted changes, conflicts, the history, worktrees, and the commit panes moved in. Left out
whatever the answers leave out, and, settled below, stash, undo, and switching branches.

### Sources

- The core's git module, the Commit page, the write queue, the start, and `ura clean`, linked in the
  discovery.
- lazygit's keybindings, configuration, and source; gitui, tig, and Magit; GitHub Desktop, VS Code,
  JetBrains, GitHub's and GitLab's web editors, Zed, Fork, GitKraken, Sublime Merge, GitButler.
- git 2.56's pull, fetch, merge, merge-tree, status, and worktree pages; gix 0.89's source.
- Diff libraries for React and CodeMirror.
- Throwaway experiments with git 2.56.0: fetching into a checked-out `main`, pulling with
  uncommitted changes, and a rebase conflict.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **A pull while an agent works in the main checkout** is refused, as a feature's writes are while
  its agent works. A rebase would change the files under the agent. See
  [the proposal's path](discovery-01.md#the-proposals-path-and-existing-actions).
- **Only the main checkout is pulled**, the default branch's. A feature's worktree belongs to its
  agent, which rebases it before its review. See
  [the proposal's path](discovery-01.md#the-proposals-path-and-existing-actions).
- **Starting a feature does not pull first.** The page shows when `main` is behind `origin`, and the
  start stays as it is. See [the code](discovery-01.md#important-reads).
- **Stash, undo, and switching branches** are left out: Uraeda's flows never need them beyond a
  pull's autostash. lazygit's undo covers neither the working tree nor a push. See
  [needs no choice](discovery-01.md#needs-no-choice).

## Q1: Does this feature fix conflicts by hand in the page, or later?

The proposal holds five parts: pull, diffs, conflicts, history, and worktrees. Every product
compared finds conflicts its hardest part. lazygit's author says they "aren't first-class"; VS Code
and JetBrains built a three-way editor. Here, it also needs a code editor for any file, which the
web UI has never had: buffers open only Markdown under `specs/`. With all five parts, the spec
passes the split rule of 6 stories. More in [discovery](discovery-01.md#scope-and-split).

Why it matters: it decides whether you fix conflicts by hand from this feature on. Otherwise an
agent fixes them until a second feature.

- **A (recommended). This feature builds the page with pull, push, diffs, history, and worktrees.
  Conflicts are listed, with continue, abort, and a button handing them to an agent. Editing a
  conflict by hand is a second feature.**
  - [pro] a spec of about 6 stories, approved in one sitting; the page is useful from the first
    pull.
  - [con] a conflict inside a file needs an agent, or a terminal, until the second feature.
  - Why recommended: your conflicts are rare since branches stopped writing the shared files, and
    Uraeda already runs agents that resolve them.
- **B. One feature for everything, conflicts edited by hand in the page included.**
  - [pro] the whole proposal at once.
  - [con] a spec past the split rule, and the conflict editor delays the pull.
- **C. A smaller first feature: the page with pull, push, and the changes' diffs. History,
  worktrees, and conflicts come later.**
  - [pro] the quickest to build.
  - [con] a conflict during a pull leaves the page stuck until a terminal finishes it.

**Answer:**

### Q1.A: What can you do with a conflict from the page?

Only if you picked A in Q1. Example: a pull rebases your 6 chores onto `origin/main`, and one
commit's `PRIORITIES.md` conflicts. Git stops on a detached `HEAD`: nothing commits on `main` until
the rebase continues or aborts. During a rebase, git's "ours" means `origin` and "theirs" your
commits, which confuses users of every tool; lazygit says "current" and "incoming", Zed names the
branches. More in [discovery](discovery-01.md#fixing-conflicts).

Why it matters: it decides what you can do from the page while a pull is stuck.

- **A (recommended). The page lists each conflicted file with what each side did. Each file offers
  "Keep origin's" and "Keep mine", then Continue or Abort. "Resolve with an agent" starts a session
  in the main checkout, asked to resolve and continue.**
  - Example: you press "Resolve with an agent"; its session opens, edits `PRIORITIES.md`, and
    continues the rebase.
  - [pro] every conflict has a way out from the page.
  - [con] keeping one side whole loses the other side's lines in that file.
  - Why recommended: whole-file choices cover lock files and generated files, and the agent covers
    the rest.
- **B. The page lists the conflicted files, and offers Abort and "Resolve with an agent" only.**
  - [pro] less to build.
  - [con] a lock file's conflict needs an agent too.

**Answer:**

### Q1.B: How are conflicts edited in the page?

Only if you picked B in Q1. Example: `PRIORITIES.md` conflicts during a pull, your line moved on
`main`, another line edited on `origin`. More in [discovery](discovery-01.md#fixing-conflicts).

Why it matters: a three-way editor is the most work in the feature, and the shared editor is the one
every text field uses.

- **A (recommended). The file opens in the shared editor with git's markers. A bar over each
  conflict takes "main (yours)", "origin", or both, as in Zed.**
  - Example: over the conflict, "Use origin" keeps origin's lines and drops the markers; you then
    edit freely.
  - [pro] one editor, the one you know, with Vim when on.
  - [con] the base, what both sides started from, shows only with git's `diff3` marker style.
  - Why recommended: CodeMirror has no three-way view, and a bar over git's markers fits the phone.
- **B. A three-way editor, like VS Code's: both sides read-only above, the result editable below,
  with a count of conflicts left.**
  - Example: origin's lines on the left, yours on the right, the result under them.
  - [pro] the clearest view of each side.
  - [con] the most work; three panes do not fit the phone.

**Answer:**

## Q2: What does Pull do when `main` has commits `origin` lacks?

Example: you merge a pull request on GitHub. Your local `main` holds 6 chores Uraeda committed,
starts and notes, not pushed. Without configuration, git refuses this pull: "Need to specify how to
reconcile divergent branches.". Your configuration rebases. What happens to uncommitted edits is Q3.
More in [discovery](discovery-01.md#pulling).

Why it matters: it decides whether Pull works on another machine with no git configuration, and
whether your history gets merge commits.

- **A (recommended). Pull follows your git configuration, and rebases when it says nothing.**
  - Example: here, your 6 chores move on top of the merged commits, in a line.
  - [pro] works the same here and on a machine without configuration.
  - [con] a rebase rewrites the 6 chores' hashes, harmless while they are not pushed.
  - Why recommended: Uraeda's chores are small and linear, and a rebase keeps the history a line, as
    your own pulls do.
- **B. Pull follows your git configuration only, and refuses where git refuses.**
  - Example: here it rebases; on a machine without configuration, it shows git's refusal.
  - [pro] exactly what `git pull` does in a terminal.
  - [con] the first pull on a new machine fails.
- **C. Pull only fast-forwards.**
  - Example: here it refuses after every merge, until you push or rebase by hand.
  - [pro] never rewrites a commit, never conflicts.
  - [con] fails in your normal flow every time.
- **D. Pull asks each time, rebase or merge, like JetBrains.**
  - [pro] the choice is always yours.
  - [con] a question after every merged pull request.

**Answer:**

## Q3: What happens to uncommitted edits during a pull?

Example: you removed a merged feature's line on the Priorities page, not committed yet, and press
Pull. Git refuses a rebasing pull with any uncommitted change, unless it stashes it first and puts
it back after: "autostash". Putting it back can conflict, when the pulled commits changed the same
lines. Your configuration has `rebase.autostash true`. With how Pull reconciles your commits (Q2),
this decides whether a pull ever stops to ask. More in
[discovery](discovery-01.md#uncommitted-changes-during-a-pull).

Why it matters: Uraeda's edits wait uncommitted on `main` until you commit them, so a pull meets
them often.

- **A (recommended). Pull always stashes the uncommitted changes and puts them back after.**
  - Example: the line stays removed after the pull, still waiting on the commit panes.
  - [pro] Pull works whatever waits, on every machine.
  - [con] a stash that cannot be put back cleanly leaves a conflict, with the stash kept.
- **B. Pull follows `rebase.autoStash`, and refuses with uncommitted changes when it is off.**
  - [pro] exactly what `git pull` does.
  - [con] on a machine without it, you commit or discard first.
- **C. Pull refuses while anything waits, and says to commit first.**
  - [pro] nothing is ever stashed.
  - [con] one more step before most pulls.

**Answer:**

## Q4: When does Uraeda fetch from `origin`?

Nothing fetches today, so `origin/main` moves only when you pull in a terminal. lazygit and
GitKraken fetch every minute, VS Code every 3 minutes if turned on. A fetch needs your credentials:
from the server, with no terminal, a credential that needs a prompt fails. lazygit's users report
popups every minute on private repositories. More in [discovery](discovery-01.md#fetching).

Why it matters: it decides whether the page can say "3 commits to pull" before you press anything.

- **A (recommended). Uraeda fetches when the page opens, and every 5 minutes in the background. A
  failed background fetch shows on the page, never as a popup.**
  - [pro] the page and the sidebar say what waits on `origin` without a press.
  - [con] a credential problem fails every 5 minutes, quietly.
  - Why recommended: a fresh behind count is what tells you to pull, and a failure stays quiet.
- **B. Uraeda fetches when the page opens, and on a key.**
  - [pro] git runs only while you look.
  - [con] the sidebar never knows what waits on `origin`.
- **C. Uraeda fetches only on a key, or as part of Pull.**
  - [pro] nothing runs unasked.
  - [con] the counts are as old as your last pull.

**Answer:**

## Q5: Does the page push?

Your proposal names pull, not push. Uraeda's chores on `main` reach `origin` only when someone
pushes; every product compared puts push next to pull. The Git decision already forbids a forced
push. More in [discovery](discovery-01.md#push).

Why it matters: without it, a terminal stays part of the loop.

- **A (recommended). Push sends the checked-out branch of the main checkout, never forced. When
  `origin` has commits it lacks, it refuses and says to pull first.**
  - [pro] the whole loop, merge then pull then push, from the page.
  - [con] one more button to press by mistake, harmless without force.
  - Why recommended: it closes the loop with nothing to lose.
- **B. No push: the page only pulls.**
  - [pro] less to build.
  - [con] your chores stay local until you push in a terminal.

**Answer:**

## Q6: Which diffs does the page show?

Example: an agent in the main checkout changed `packages/web/src/App.tsx`; a pull brought in
"feat(vim-text): ...". More in [discovery](discovery-01.md#diffs-shown).

Why it matters: each kind is a source of data and a place in the page.

- **A (recommended). The uncommitted changes of the main checkout, and any commit of the history.**
  - Example: you open `App.tsx` and see its lines; you open the vim-text commit and see its files.
  - [pro] covers what you check before committing and after pulling.
  - [con] a feature's whole branch against `main` stays on GitHub's pull request.
  - Why recommended: the pull request already shows a branch's diff, with review comments.
- **B. A, plus a feature's branch against `main`, from its page.**
  - [pro] a feature's diff without GitHub.
  - [con] a second place for what the pull request shows.
- **C. The uncommitted changes only.**
  - [pro] the smallest.
  - [con] after a pull, you cannot see what it brought.

**Answer:**

## Q7: What draws a diff's lines?

Astryx's `CodeBlock`, which the app already uses for code in documents, takes a unified diff with
`isDiff`. It draws it read only, with a `+`/`−` column and line numbers, in the theme's own diff
colours. It has no split view and does not virtualize long diffs. A split view, old left and new
right, needs a library. @codemirror/merge, from CodeMirror's author, is styled like the shared
editor, 17 KB. @pierre/diffs has its own colour themes and Shiki, and is large. The UI components
decision asks for Astryx wherever one fits. More in [discovery](discovery-01.md#diff-rendering).

Why it matters: a new dependency is pinned and kept; Astryx's component follows the theme for free.

- **A (recommended). Astryx's `CodeBlock`: unified diffs only, at every width.**
  - [pro] no dependency, the theme's colours, the look of every code block.
  - [con] no side-by-side view on a wide screen.
  - Why recommended: it fits the UI components decision, and a unified diff reads on the phone too.
- **B. @codemirror/merge: unified on the phone, side by side on wide screens, switched by a key.**
  - [pro] both views, and later a base for editing conflicts.
  - [con] a dependency, and Astryx's `CodeBlock` stays for documents: two looks of code.
- **C. @pierre/diffs: split or stacked, virtualized, with a beta conflict view.**
  - [pro] the most complete, and fast on huge diffs.
  - [con] its own colour themes beside Astryx's, and the heaviest bundle.

**Answer:**

## Q8: What does the page show of changes Uraeda did not make?

Example: an agent's session in the main checkout edited `App.tsx` and left it uncommitted. The
commit panes describe only Uraeda's own edits, "Add to the inbox: ...", with their suggested
message; `App.tsx` shows nowhere today. More in
[discovery](discovery-01.md#changes-other-than-uraedas).

Why it matters: it decides whether the page is a full `git status`, and whether it commits code.

- **A (recommended). The page lists every other changed file with its diff, read only: no commit, no
  discard.**
  - Example: `App.tsx` shows under "Other changes", with "+12 −3"; it opens its diff.
  - [pro] nothing hidden, and the commit panes stay as they are.
  - [con] committing `App.tsx` still needs a terminal or an agent.
  - Why recommended: in Uraeda, code is committed by agents; the Git decision keeps your commits to
    what the page describes.
- **B. The page lists them, and commits or discards each file, in its own commit.**
  - [pro] a whole `git status` workflow from the page.
  - [con] a second kind of commit beside the described panes, and a discard of code to guard.
- **C. B, plus staging by hunk and line, like lazygit.**
  - [pro] lazygit's precision.
  - [con] the most work, for a flow agents do.
- **D. The page shows only the commit panes, as today.**
  - [pro] nothing new.
  - [con] the page hides what `git status` shows.

**Answer:**

## Q9: How does the history read?

lazygit, VS Code, and JetBrains draw a graph of every branch; GitHub Desktop and Zed list the
branch's commits. The core already walks a branch's commits. More in
[discovery](discovery-01.md#history).

Why it matters: a graph is a component Astryx lacks, built for this page.

- **A (recommended). A list of the checked-out branch's commits, newest first, the unpushed and
  unpulled ones marked. Each opens its files and their diffs.**
  - [pro] reads at once; the commits to pull and push stand out.
  - [con] no view of how feature branches join `main`.
  - Why recommended: your history is a line, as pull requests merge by rebase.
- **B. A graph of every branch, like lazygit.**
  - [pro] the branches' shape at a glance.
  - [con] a graph component to build and keep readable on the phone.

**Answer:**

## Q10: What does the page do with worktrees?

Uraeda creates a worktree per feature, and `ura clean` removes the merged ones with their branch and
their priorities line, never forced. This repository also holds `.worktrees/coherence-before`, made
by hand. More in [discovery](discovery-01.md#worktrees).

Why it matters: removing is the one destructive action here; the Git decision allows it only when
you ask.

- **A (recommended). The page lists every worktree with its branch and whether it has changes. A
  merged one offers Clean, which does what `ura clean` does, after asking.**
  - [pro] the after-merge chore leaves the terminal too.
  - [con] a worktree made by hand stays until removed by hand.
  - Why recommended: it finishes the proposal's "pull main after a PR" loop.
- **B. A, plus Remove on any worktree without changes, its branch kept.**
  - [pro] cleans up hand-made worktrees too.
  - [con] one more destructive action, for a rare case.
- **C. A list only.**
  - [pro] nothing destructive.
  - [con] cleaning stays in the terminal.

**Answer:**

## Q11: How is the page laid out?

The Commit page is a column of panes. lazygit shows lists on the left, and the selected item's diff
on the right. The decisions page already draws its list beside the item it reads. The UI layout
decision asks each view's spec to say why its layout reads best, with mockups at each width. More in
[discovery](discovery-01.md#approaches).

Why it matters: it sets how diffs are read, the page's main job after pulling.

- **A (recommended). On wide screens, the sections on the left (sync, commit panes, changes,
  conflicts, history, worktrees), and the selected file's or commit's diff on the right. On the
  phone, the sections in one column, and a diff opens as its own page.**
  - [pro] lazygit's shape, and a diff read without leaving the list.
  - [con] two columns to keep in step with the keys.
  - Why recommended: it follows your inspiration and the decisions page's pattern.
- **B. One column of sections at every width; a diff always opens as its own page.**
  - [pro] the Commit page's shape, simplest.
  - [con] going back and forth between the list and each diff.

**Answer:**

## Q12: Where does the page live, and how is it reached?

The proposal says the page opens with `Space g`. Today Commit shows in the sidebar and in the
phone's tabs only while something waits, and the phone's tabs are already full at 375 px. `g g`
means "first row" in every list, so the go key keeps `g c`. More in
[discovery](discovery-01.md#the-pages-place-and-keys).

Why it matters: the page becomes a place of its own, and the sidebar can tell when `main` is behind.

- **A (recommended). "Git" is always in the sidebar, with a count of what waits: changes to commit,
  commits to pull. On the phone, its tab shows only while something waits, as Commit does. `Space g`
  and `g c` open it, and `/commit` leads to it.**
  - Example: after a merge, the sidebar reads "Git · ↓3".
  - [pro] the page is always one press away, and the count says when to pull.
  - [con] one more permanent entry in the sidebar.
  - Why recommended: pulling is the page's main job, and it waits even when nothing is uncommitted.
- **B. "Git" shows only while something waits, changes or commits to pull, in the sidebar and the
  phone's tabs.**
  - [pro] the sidebar stays as quiet as today.
  - [con] the page hides when nothing waits, reachable by keys only.

**Answer:**

## Q13: Which rules join the Git decision?

The [Git decision](../decisions/git.md) names "the Commit page" in its rule on commits, and has no
rule for pull, push, or fetch. A rule there binds every later feature and agent. More in
[discovery](discovery-01.md#the-current-commit-look-and-behaviour-can-stay).

Why it matters: these rules outlive the page.

- **A (recommended). The commit rule names the Git page. New rules: tools pull, push, and resolve a
  conflict only when the human asks. A pull never discards, resets, or overwrites uncommitted work.
  Tools may fetch in the background.**
  - [pro] what the page may do is written where agents read it.
  - [con] a changed decision to approve with the spec.
- **B. Only the rename: the page's behaviour stays in its spec.**
  - [pro] the smallest change.
  - [con] a later feature could pull on its own without breaking a rule.

**Answer:**

## Settled without the human

### Behaviour

- **The sides of a conflict** are named by branch, "origin/main" and "main (yours)", never "ours"
  and "theirs", which swap during a rebase. See
  [git's conflicts](discovery-01.md#git-256-conflicts).
- **A pull's and a push's output** shows in the commit toast as it comes, like a commit's hooks. A
  refusal shows on the page, with git's message. See [the code](discovery-01.md#important-reads).
- **A credential failure** shows git's message, and says the server runs git without a terminal. See
  [git's pull](discovery-01.md#git-256-pull-and-fetch).
- **A binary file** shows its size change, never its bytes; a diff over 1,000 lines shows its counts
  and a button that opens it whole. See [needs no choice](discovery-01.md#needs-no-choice).
- **The page's keys** follow lazygit where they fit and the base set allows: `p` pull, `P` push, `f`
  fetch, `j`/`k` and Enter in the lists. See [lazygit](discovery-01.md#lazygit).
- **A diff marks its lines** with `+` and `−` in a sign column, never by colour alone. See
  [needs no choice](discovery-01.md#needs-no-choice).

### Under the hood

- **Reads go through gix**: conflicts from its status, ahead and behind from two walks, diffs from
  `gix-diff`, with the features already on. **Writes go through `git`**, refs after
  `--end-of-options`, with `GIT_TERMINAL_PROMPT=0`. See [gix 0.89](discovery-01.md#gix-089).
- **A fetch lands in the repository's write queue**, so it never runs during a commit, and a
  background one shows no toast. See [the code](discovery-01.md#important-reads).
- **The operation in progress**, a rebase included, gets its own read; the start's check stays as it
  is. See [the code](discovery-01.md#important-reads).
- **The sandbox's sample projects** get a remote, a commit to pull, and a conflict, so the page can
  be tried. See [likely changes](discovery-01.md#likely-changes).

**Notes:**
