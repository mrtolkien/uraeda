# Discovery, round 01: Basic git UI in the web UI

## Summary

A git client, in a terminal (lazygit, gitui, tig, Magit) or a window (GitHub Desktop, VS Code,
JetBrains, Zed), shows the branch's state against its remote, with pull, push, and fetch. It also
shows the uncommitted changes and any commit's diff, a history, the worktrees, and conflicts with
continue and abort. Products differ most on conflicts: one side per file, a pick per hunk, an inline
bar, a three-way editor, and, new in 2026, an AI's suggestion. They also differ on whether pull
merges, rebases, or asks, which most leave to the user's git configuration.

The proposal asks for a basic, lazygit-like page: pull main, diffs, conflicts, history, and
worktrees, replacing the Commit page, at `Space g`. Today the core reads branches, worktrees, ahead
and behind, and a commit walk, but nothing fetches, pulls, pushes, diffs lines, or reads a conflict.
The Commit page lists only Uraeda's own edits. Here, `main` is always ahead of `origin` with
Uraeda's chores, so a pull is a rebase, never a fast-forward. Astryx's `CodeBlock` already draws a
unified diff in the theme's colours. Fixing conflicts by hand needs a code editor for any file,
which the web UI has never had.

## How other products do it

### lazygit

The proposal's inspiration. Its `docs/` folder has no page on conflicts, worktrees, or pull: those
facts come from its keybindings page, its configuration page, and its source's strings.

- **Panels**: status, files, branches (with remotes, tags, worktrees), commits (with reflog and
  stash), and a main panel showing the selected item's diff. Global keys: `p` pull, `P` push, `f`
  fetch, `z`/`Z` undo and redo, `m` the merge or rebase's continue, abort, and skip, `@` the log of
  the git commands it ran.
  [Keybindings](https://github.com/jesseduffield/lazygit/blob/master/docs/keybindings/Keybindings_en.md)
- **Pull follows the user's git configuration**: it runs `git pull --no-edit`, and a maintainer says
  "You decide with the `pull.rebase` git config whether this does a merge or a rebase". A per-pull
  choice was asked for and not built.
  [sync.go](https://github.com/jesseduffield/lazygit/blob/master/pkg/commands/git_commands/sync.go),
  [#4755](https://github.com/jesseduffield/lazygit/issues/4755),
  [#2175](https://github.com/jesseduffield/lazygit/issues/2175)
- **Fetch runs in the background**, every 60 seconds by default (`git.autoFetch`,
  `refresher.fetchInterval`), and `git.autoForwardBranches` fast-forwards `main` when it is strictly
  behind its upstream. `f` on a branch fast-forwards it without checking it out.
  [Config](https://github.com/jesseduffield/lazygit/blob/master/docs/Config.md)
- **Credentials**: git's prompts (username, password, passphrase) become popups. A background fetch
  fails on a credential request instead of prompting, and users of private repositories still report
  popups every minute. [#2235](https://github.com/jesseduffield/lazygit/issues/2235)
- **Diverged push** asks once, then force-pushes with `--force-with-lease`. One user lost "2 weeks
  of a collaborator's deleted work".
  [sync_controller.go](https://github.com/jesseduffield/lazygit/blob/master/pkg/gui/controllers/sync_controller.go),
  [#3468](https://github.com/jesseduffield/lazygit/issues/3468)
- **Conflicts**: a failed merge or rebase opens a "Conflicts!" menu, "View conflicts" or "Abort". In
  the merging panel, `space` picks a hunk, `b` both, `z` undoes the last pick, and `e` opens an
  editor. A file's menu takes "current", "incoming", or both whole, through `git merge-file`, or
  opens an external merge tool. Delete-and-modify conflicts get plain sentences with "Keep file" and
  "Delete file". Resolved files are staged, then it asks "All merge conflicts resolved. Continue the
  rebase?". It labels the sides "current" and "incoming", never "ours" and "theirs".
  [merge_and_rebase_helper.go](https://github.com/jesseduffield/lazygit/blob/master/pkg/gui/controllers/helpers/merge_and_rebase_helper.go),
  [working_tree_helper.go](https://github.com/jesseduffield/lazygit/blob/master/pkg/gui/controllers/helpers/working_tree_helper.go)
- **Conflicts are its weak spot**, by its author: they "aren't first-class", and a rebase is all
  resolved or all aborted. A three-way view with the base was asked for and closed.
  [Lazygit 5 years on](https://jesseduffield.com/Lazygit-5-Years-On/),
  [#2133](https://github.com/jesseduffield/lazygit/issues/2133)
- **History**: a graph, in topological order, its colours by author; `enter` on a commit lists its
  files, and two commits can be compared.
  [README](https://github.com/jesseduffield/lazygit/blob/master/README.md)
- **Worktrees**: create from a branch or a commit, switch, and remove, with "Remove worktree and
  delete branch". It asks before removing a dirty worktree, and never removes the main or current
  one. [english.go](https://github.com/jesseduffield/lazygit/blob/master/pkg/i18n/english.go)
- **Undo** walks the reflog: "we can't undo changes to the working tree or stash", nor a push.
  [Undoing](https://github.com/jesseduffield/lazygit/blob/master/docs/Undoing.md)
- **Staging** by file, hunk, or line, and discarding the same way, in the main panel.

### gitui, tig, and Magit

- **gitui** fetches, tries a fast-forward, then asks "Merge of N incoming commits?" or "Rebase onto
  N incoming commits?" by `pull.rebase`, and only goes ahead when nothing conflicts. It has no hunk
  picker for conflicts, and no worktree panel.
  [pull.rs](https://github.com/gitui-org/gitui/blob/master/src/popups/pull.rs),
  [merge_commit.rs](https://github.com/gitui-org/gitui/blob/master/asyncgit/src/sync/branch/merge_commit.rs)
- **tig** is a history browser, with staging by chunk and line, and no pull, push, or merge.
  [Manual](https://jonas.github.io/tig/doc/manual.html)
- **Magit**'s status page shows, in order: the operation in progress, untracked files, unstaged and
  staged changes, stashes, the commits to pull, and the commits to push, or the recent ones. It
  "does not provide its own tools for conflict resolution": a conflicted file opens in Emacs's
  conflict modes, and `k` asks which side to keep.
  [magit.org](https://github.com/magit/magit/blob/main/docs/magit.org)

### GitHub Desktop

- **Fetch origin, Pull origin, and Pull origin with rebase** are separate actions; after a rebase
  the button becomes "Force push origin".
  [Syncing](https://docs.github.com/en/desktop/working-with-your-remote-repository-on-github-or-github-enterprise/syncing-your-branch-in-github-desktop)
- **Conflicts** go to an external editor: Desktop lists the conflicted files, tracks what is left,
  and says when the merge is ready. Over 10% of its merges had conflicts.
  [Desktop 1.5](https://github.blog/2018-11-14-github-desktop-1-5/)
- **Version 3.6, June 2026, added worktrees**, "especially handy alongside coding agents", and
  Copilot's help on conflicts, which can "suggest a resolution that you can review, accept, or
  edit".
  [Desktop 3.6](https://github.blog/changelog/2026-06-26-github-desktop-3-6-worktrees-and-deeper-copilot-integration/)
- **Diffs**: unified or split, hide whitespace, expand context; partial commits by line; discarded
  changes "are saved in a dated file in the Trash".
  [Committing](https://docs.github.com/en/desktop/making-changes-in-a-branch/committing-and-reviewing-changes-to-your-project-in-github-desktop)
- **History**: a list of the branch's commits, no graph; a selected commit shows its diff.
  [History](https://docs.github.com/en/desktop/making-changes-in-a-branch/viewing-the-branch-history-in-github-desktop)

### VS Code

- **Sync** pulls then pushes, and stops at a conflict. Pull follows the git configuration, with a
  separate "Pull (Rebase)". Autofetch, every 180 seconds, is off in the editor and on in its Agents
  window. The status bar shows `↑2 ↓1`.
  [Repositories and remotes](https://code.visualstudio.com/docs/sourcecontrol/repos-remotes)
- **Conflicts**: inline "Accept Current", "Accept Incoming", "Accept Both" over each conflict, and a
  three-way merge editor: Incoming, Current, and an editable Result, with a count of conflicts left.
  "Complete Merge" stages the file, and "does not finish the entire repository operation". It warns
  that "in a rebase, 'ours' is the new base and 'theirs' is your replayed work", and has an
  experimental "Resolve Merge Conflict with AI".
  [Merge conflicts](https://code.visualstudio.com/docs/sourcecontrol/merge-conflicts)
- **The Source Control Graph** marks incoming and outgoing commits, and opens a commit's diff
  without checking it out. [History](https://code.visualstudio.com/docs/sourcecontrol/history)
- **Worktrees** since 1.103: each is a repository in the list; "Delete Worktree" "removes its
  working directory, not its branch".
  [Branches and worktrees](https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees)

### JetBrains IDEs

- **A conflicts dialog** lists each file with "Accept Yours", "Accept Theirs", or "Merge". Merge
  opens three panes: local and incoming, read-only, and the result in the middle, editable, with
  "apply all non-conflicting changes".
  [Resolve conflicts](https://www.jetbrains.com/help/idea/resolve-conflicts.html)
- **Update Project** fetches, then merges, rebases, or resets to the remote, stashing the
  uncommitted changes first.
  [Sync](https://www.jetbrains.com/help/idea/sync-with-a-remote-repository.html)
- **The Git log**: branches, a graph, the commit's files, and its details, with filters.
  [Log](https://www.jetbrains.com/help/idea/log-tab.html)

### GitHub and GitLab on the web

- **GitHub's editor** handles "simple competing line change conflicts" only: the human edits the
  markers out, marks each file resolved, and commits the merge.
  [Resolving on GitHub](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/resolving-a-merge-conflict-on-github)
- **GitLab** offers "Use ours" or "Use theirs" per section, or an inline editor, for text files
  under 200 KB, UTF-8, at the same path on both sides.
  [Merge conflicts](https://docs.gitlab.com/user/project/merge_requests/conflicts/)

### Zed, Fork, GitKraken, Sublime Merge, GitButler

- **Zed**: fetch, pull, and push buttons; a project diff, split by default, with per-hunk staging;
  "Use [branch]", "Use [other branch]", "Use Both" over each conflict, named by branch; a worktree
  picker. [Zed's git](https://zed.dev/docs/git)
- **Fork** names branches instead of "ours" and "theirs" in its resolver, and offers "Stash and
  re-apply local changes on pull" as a checkbox. [Release notes](https://git-fork.com/releasenotes)
- **GitKraken** offers "Fast-forward if possible", "Fast-forward only", and "Rebase" for pull, and
  fetches every minute.
  [Pushing and pulling](https://help.gitkraken.com/gitkraken-desktop/pushing-and-pulling/)
- **Sublime Merge**: three columns, ours, merged, and theirs, an arrow per hunk, then "Save and
  stage". [Getting started](https://www.sublimemerge.com/docs/getting_started)
- **GitButler** never stops at a conflict: it records a "conflicted commit" and lets the human fix
  it later. [Merging](https://docs.gitbutler.com/features/branch-management/merging)

### What they have in common

- **Ahead and behind counts**, and a nudge when the default branch has commits to pull: lazygit,
  Magit, VS Code, GitHub Desktop.
- **Pull that follows the user's git configuration**, merge or rebase: lazygit, Magit, gitui, VS
  Code, Zed. Only JetBrains and GitKraken ask each time.
- **Background fetch**: lazygit (60 s), GitKraken (60 s), VS Code (180 s, opt-in in the editor),
  JetBrains (20 min, opt-in).
- **Push**, next to pull, never forced without asking.
- **A diff of the uncommitted changes, and of any commit, without checking it out**: all of them.
  Unified or split: GitHub Desktop, VS Code, Zed.
- **Staging and discarding by hunk or line**: lazygit, gitui, tig, Magit, GitHub Desktop, Zed.
- **Conflicts**: a list of conflicted files with the operation in progress; take one side whole per
  file; pick per hunk; edit the result; continue and abort. Branch names, or "current" and
  "incoming", instead of "ours" and "theirs". Plain explanations of delete and rename conflicts
  (lazygit). AI help is new in 2026 in GitHub Desktop, VS Code, and GitKraken.
- **History**: a graph in the terminal tools, VS Code, and JetBrains; a plain list in GitHub Desktop
  and Zed.
- **Worktrees**: list, create, open, and remove, never the main one, asking before a dirty one; a
  marker on branches checked out elsewhere.
- **Stash**: lazygit, Magit, GitHub Desktop (one at a time), VS Code, Zed.
- **Undo**: lazygit only, through the reflog, and never for the working tree.

## Standards and libraries

### git 2.56: pull and fetch

- **Without configuration, `git pull` fast-forwards only**: `--ff-only` "is the default when no
  method for reconciling divergent histories is provided". On diverged branches it stops with "Need
  to specify how to reconcile divergent branches."; `--ff-only` says "Not possible to fast-forward,
  aborting.". [git-pull](https://git-scm.com/docs/git-pull)
- **`pull.rebase` and `pull.ff`** choose rebase, merge, or fast-forward only.
  [git-pull](https://git-scm.com/docs/git-pull)
- **`--autostash`** stashes the uncommitted changes and puts them back after, "the final stash
  application … might result in non-trivial conflicts". A rebasing pull "refuses to work with any
  local changes" without it. [git-pull](https://git-scm.com/docs/git-pull)
- **A pull that fails has already fetched**: `origin/main` moved even though `main` did not.
- **`git fetch origin main:main` refuses** while `main` is checked out in any worktree, since git
  2.35. Checked here, see [the proposal's path](#the-proposals-path-and-existing-actions).
  [git-fetch](https://git-scm.com/docs/git-fetch)
- **Hooks**: `post-merge` runs after a pull's merge, not after a conflict; `post-rewrite` after a
  rebase. **Signing**: `commit.gpgSign` signs a merge commit and every commit a rebase makes, and
  fails without an agent for the key. A fast-forward makes no commit.
  [githooks](https://git-scm.com/docs/githooks)
- **Credentials from a server**: `GIT_TERMINAL_PROMPT=0` turns git's prompts into errors, "could not
  read Username for 'https://github.com': terminal prompts disabled"; ssh with `BatchMode=yes` fails
  with "Could not read from remote repository.". ssh-agent works through `SSH_AUTH_SOCK`. Helper
  behaviour (libsecret, the macOS keychain, `gh auth git-credential`) was not checked.
  [gitcredentials](https://git-scm.com/docs/gitcredentials)

### git 2.56: conflicts

- **The operation in progress** lives in each worktree's own git folder: `rebase-merge/` or
  `rebase-apply/`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`. gix's `Repository::state()`
  reads them in git's order (read in the gix 0.89 source, `src/repository/state.rs`).
- **The index holds three stages** of a conflicted file: 1 the base, 2 ours, 3 theirs.
  `git status --porcelain=v2` writes it as `u <XY> ...`, with `UU` both modified, `AA` both added,
  `DU`/`UD` deleted by one side, `AU`/`UA` added by one, `DD` both deleted.
  [git-status](https://git-scm.com/docs/git-status)
- **In a rebase, "ours" and "theirs" swap**: `--ours` is the upstream, the commits being rebased
  onto. [git-checkout](https://git-scm.com/docs/git-checkout)
- **Resolving**: `git checkout --ours|--theirs -- <path>` takes one side; `git add` marks it
  resolved; then `git rebase --continue` or `git merge --continue`, or `--abort`.
  "`git merge --abort` will in some cases be unable to reconstruct" the changes that were
  uncommitted before. [git-merge](https://git-scm.com/docs/git-merge)
- **Marker styles**: `merge.conflictStyle` `merge`, `diff3` (adds the base), or `zdiff3`.
- **Predicting a conflict without touching anything**: `git merge-tree --write-tree A B`, since
  2.38, "does not read from or write to either the working tree or index"; exit 1 means conflicts.
  [git-merge-tree](https://git-scm.com/docs/git-merge-tree)
- **rerere**, on in this repository, replays recorded resolutions, and can resolve hunks silently.

### git 2.56: worktrees

- `git worktree list --porcelain -z` is stable, with `locked` and `prunable`. `remove` refuses a
  worktree with changes or untracked files without `--force`, and never removes the main one. A
  branch is checked out in one worktree at most.
  [git-worktree](https://git-scm.com/docs/git-worktree)

### gix 0.89

Read in the crate's source, `~/.cargo/registry`, and its
[crate status](https://github.com/GitoxideLabs/gitoxide/blob/main/crate-status.md).

- **The `status` feature, already on, brings `blob-diff`**: tree-to-tree diffs with renames
  (`diff_tree_to_tree`) and line diffs (`gix-diff`'s `UnifiedDiff`, over imara-diff) need no new
  feature.
- **Status reports conflicts**: `EntryStatus::Conflict`, with a summary matching git's codes and the
  three stages' entries. The index's `Entry::stage()` reads each stage.
- **Ahead and behind** has no API: two walks, `rev_walk([a]).with_hidden([b])` and the reverse.
- **Worktrees**: `worktrees()` lists the linked ones with `is_locked` and `is_prunable`; removing
  one is not implemented, and stays with `git`, as the decision asks anyway.
- **Merge** (`gix-merge`, a feature not on) merges blobs and trees, and leaves no `MERGE_HEAD`, no
  continue or abort. **Push** is not implemented.

### Security of git run for a web page

- **A repository's configuration runs code** whenever git runs: `core.fsmonitor`, `core.sshCommand`,
  `core.hooksPath`, filter drivers. The server already runs git in repositories the human added, and
  agents in them, as the [Repositories](../decisions/repositories.md) decision accepts.
- **A ref starting with `-` becomes an option**: `--end-of-options` before refs, `--` before paths.
  [gitcli](https://git-scm.com/docs/gitcli)
- **Background reads take `index.lock`**: `GIT_OPTIONAL_LOCKS=0` keeps a periodic `git status` from
  fighting an agent's commit. [git](https://git-scm.com/docs/git)

### Astryx 0.7.3's `CodeBlock`

- **It draws a unified diff**: `isDiff` takes a unified diff's text, read only, with a sign column,
  line numbers, `highlightLines`, collapsing past a threshold, `maxHeight`, and a `tokenizer` prop.
  Read in `node_modules/@astryxdesign/core/dist/CodeBlock/CodeBlock.d.ts`.
- **The theme has five diff slots**: `--color-syntax-added`, `--color-syntax-removed`,
  `--color-syntax-diff-header`, and the added and removed markers, defaulting to the success and
  error colours (`dist/theme/syntax/tokens.d.ts`).
- **No split view, no conflict view, no editing, no virtualization.** Its highlighter is Astryx's
  own, regex-based, painted with the CSS Custom Highlight API.
- **The app already uses it** in six places, among them a document's code blocks
  ([`Blocks.tsx`](/packages/web/src/Blocks.tsx)) and a session's activity.

### @codemirror/merge

- 6.12.3, MIT, released 2026-10-19, by CodeMirror's author; about 17 KB gzipped beyond the
  CodeMirror the app ships. [Reference](https://codemirror.net/docs/ref/#merge),
  [changelog](https://raw.githubusercontent.com/codemirror/merge/main/CHANGELOG.md)
- **`MergeView`**, side by side, and **`unifiedMergeView`**, both editable, with accept and reject
  per chunk, `collapseUnchanged`, and `DiffConfig.override` to feed git's own hunks.
- **No three-way merge**: a request for it got no reply, and diffedit3 kept CodeMirror 5 for its
  three panes because "the CM6 merge plugin only supports two-pane diffs".
  [Forum](https://discuss.codemirror.net/t/fr-three-way-comparison-for-the-v6-merge-plugin/7879),
  [diffedit3](https://docs.rs/crate/diffedit3/latest/source/README.md)
- **Styled through `EditorView.theme`**, as the app's editor already is over Astryx's variables
  ([`fields/editor/theme.ts`](/packages/web/src/fields/editor/theme.ts)).
- **No conflict-marker extension exists for CodeMirror 6**: its author declined one as "much more
  specific than the generic merge view features". A conflict bar is decorations and a widget to
  write.
  [Forum](https://discuss.codemirror.net/t/feasability-assessment-extension-to-decorate-conflict-markers/8459)

### @pierre/diffs

- 1.6.4, Apache-2.0, released 2026-11-04, React 19. Split or stacked, virtualization, workers, line
  selection, and `UnresolvedFile`, a beta conflict view over git's markers with "current",
  "incoming", and "both". [Repository](https://github.com/pierrecomputer/pierre),
  [conflicts PR](https://github.com/pierrecomputer/pierre/pull/367)
- **It renders in a Shadow DOM**, styled through about 80 `--diffs-*` variables, with Shiki's colour
  themes for code: a second theme to keep in step with Astryx's.
- **The heaviest**: Shiki's web bundle alone is 695 KB gzipped.
  [Shiki bundles](https://shiki.style/guide/bundles)

### Other diff renderers

- **react-diff-view** 3.3.3: split and unified, 23 KB, Prism highlighting; its own benchmark renders
  a 2.2 MB diff in 26 seconds without lazy rendering.
- **@git-diff-view/react** 0.1.8: split and unified, 338 KB with highlight.js, a Tailwind
  stylesheet. [Repository](https://github.com/MrWangJustToDo/git-diff-view)
- **diff2html** 3.4.56: an HTML string, not React components.
- **react-diff-viewer-continued** 4.4.0: Emotion, a second CSS-in-JS runtime beside StyleX.
- **Monaco's diff editor**: several MB, its own themes, and a second editor engine, which the
  [Text editing](../decisions/text-editing.md) decision rules out.

### Reading diffs from git

- **Pass `--no-color --no-ext-diff --no-textconv --default-prefix`**: the human's `color.ui`,
  `diff.noprefix`, and external diff tools change the output otherwise.
  [git-diff](https://git-scm.com/docs/git-diff)
- **A conflicted file is a combined diff**, `diff --cc` with `@@@` hunks, which no renderer above
  reads: the three stages are read instead.
- **Binary files** have no hunks; CRLF lines keep their `\r`; "\ No newline at end of file" is a
  line of its own.
- gix's `UnifiedDiff` writes the same text in process, with the features on ([gix 0.89](#gix-089)).

## The code

### Important reads

- [`crates/core/src/git.rs`](/crates/core/src/git.rs) and
  [`crates/core/src/git/`](/crates/core/src/git/): the one module of every git access, gix for
  reads, the system `git` through [`process.rs`](/crates/core/src/git/process.rs) for writes, as the
  [Git](../decisions/git.md) decision asks. It already has what a git page reads first: branches
  local and on `origin` (`branches`), each worktree with its branch (`worktrees`,
  `worktree_records`, with `locked` and `missing`), `has_local_changes`, `changed_files`, `behind`
  and `is_ancestor` ([`log.rs`](/crates/core/src/git/log.rs)), a commit walk with parents, subjects
  and times (`history`, [`history.rs`](/crates/core/src/git/history.rs)), per-file line counts
  between two commits (`numstat`), and `fetched_at`, read from `FETCH_HEAD`. It has no `fetch`, no
  `pull`, no `push` of the default branch, no text diff, and nothing that reads a conflict: no
  unmerged index entry, no conflict stages. `git.rs` is 497 lines, at the 500-line limit of the
  [Code quality](../decisions/code-quality.md) decision: new reads go in new files of `git/`.
- [`crates/core/src/git/status.rs`](/crates/core/src/git/status.rs): `operation_in_progress` reads
  gix's repository state, and names a merge, a cherry-pick, a revert, or applying patches. A rebase
  and a bisect return `None` on purpose: its only caller, the start of a feature
  ([`actions/start/plan.rs`](/crates/core/src/actions/start/plan.rs)), needs to know whether a
  commit of some files alone can run, not which operation is in progress. A git page needs the
  rebase too.
- [`crates/core/src/actions/changes.rs`](/crates/core/src/actions/changes.rs) and
  [`crates/core/src/api/commit_panes.rs`](/crates/core/src/api/commit_panes.rs): what the Commit
  page lists. It is not `git status`: it lists the workflow files the web UI itself edited, the
  inbox's notes, the priorities' lines, proposal and note files, and the files a buffer saved, each
  as a described change ("Add to the inbox: text"), with a suggested message. A file the human or an
  agent changed by hand outside `specs/` never shows there. One pane per branch with changes, the
  default branch's first, then each worktree's.
- [`packages/web/src/CommitPage.tsx`](/packages/web/src/CommitPage.tsx),
  [`commit/BranchPane.tsx`](/packages/web/src/commit/BranchPane.tsx),
  [`commit/usePaneWrites.ts`](/packages/web/src/commit/usePaneWrites.ts): the page at `/commit`, its
  panes, the message field (the shared editor), Commit and Discard, `j`/`k` between panes, Enter and
  `d`, and the phone's bottom bar holding Commit and Discard with one pane.
- [`packages/web/src/destinations.ts`](/packages/web/src/destinations.ts),
  [`keys/leaderTree.ts`](/packages/web/src/keys/leaderTree.ts): the places, each named once. The
  Commit page is reached by `g c` only, not by `Space`: `Space c` is Continue's. `Space g` and `g g`
  are taken differently: `Space g` is free, `g g` is "first row" in every list
  ([`lists/useListKeys.ts`](/packages/web/src/lists/useListKeys.ts)).
- [`packages/web/src/shell/ColumnPanes.tsx`](/packages/web/src/shell/ColumnPanes.tsx) and
  [`shell/Tabs.tsx`](/packages/web/src/shell/Tabs.tsx): the sidebar's "Commit · N" button and the
  phone's Commit tab show only while something waits. The phone's tabs are sized for a 375 px screen
  with Commit showing, Decisions and Settings already moved into a `…`
  ([`__tests__/phone-tabs.test.tsx`](/packages/web/src/__tests__/phone-tabs.test.tsx)).
- [`packages/server/src/writes/queue.ts`](/packages/server/src/writes/queue.ts) and
  [`writes/CommitToast.tsx`](/packages/web/src/writes/CommitToast.tsx): every git write of a
  repository lands in one queue, one after another, with its hooks' output streamed to the commit
  toast, and a refusal shown where it happened
  ([`writes/RefusedHere.tsx`](/packages/web/src/writes/RefusedHere.tsx)). A pull or a push is a git
  write that fits this queue as it is: `process::run_streaming` already streams a process's lines.
- [`packages/server/src/fate/sessions.ts`](/packages/server/src/fate/sessions.ts): `writable`
  refuses a write to a feature's files while its agent works. A session can also run in the main
  checkout itself ([files changed](../done/2026-11-01-files-changed.md) shows one that committed
  there).
- [`crates/core/src/workspace/merged.rs`](/crates/core/src/workspace/merged.rs) and
  [`crates/core/src/pulls.rs`](/crates/core/src/pulls.rs): a feature reads as merged from the
  default branch, "local or on `origin`", and from `gh`'s merged pull requests. Nothing in Uraeda
  fetches: `origin/main` only moves when the human, or an agent, runs `git fetch` or `git pull`.
- [`crates/core/src/actions/start/commits.rs`](/crates/core/src/actions/start/commits.rs): a start
  commits on the local default branch, and creates the feature's branch from it
  (`add_worktree_new(..., self.default)`). When the local default branch is behind `origin`, the new
  feature starts from a stale base, and its agent's catch-up rebase
  ([implementation](/skills/uraeda/references/implementation.md)) does the work later.
- [`crates/core/src/actions/clean.rs`](/crates/core/src/actions/clean.rs): `ura clean` removes a
  merged feature's worktree, branch, and priorities line, never forced. The web UI has no Clean: a
  merged feature's page tells the human to run `ura clean`
  ([`feature/FeaturePage.tsx`](/packages/web/src/feature/FeaturePage.tsx)).
- [`packages/web/src/session/ChangesPanel.tsx`](/packages/web/src/session/ChangesPanel.tsx) and
  [`layout/DiffCount.tsx`](/packages/web/src/layout/DiffCount.tsx): the only diff-like view today, a
  list of files with "+120 −4" counts, in the theme's green and red text colours. No page shows a
  diff's lines, and no page shows a code file: buffers open only Markdown files under `specs/`
  ([vim text](../done/2026-11-03-vim-text.md)).
- [`packages/web/src/fields/editor/`](/packages/web/src/fields/editor/): the one shared editor,
  CodeMirror 6 (`@codemirror/state` 6.7.6, `@codemirror/view` 6.43.15), Markdown highlighted, Vim
  optional, as the [Text editing](../decisions/text-editing.md) decision asks. It is the only place
  a code file could be edited, for a conflict.

### The proposal's path and existing actions

- **Pulling main after a pull request merged.** Today the human runs `git pull` in a terminal. This
  repository shows what that meets: the local `main` is 6 commits ahead of `origin/main`, all
  `chore(...)` commits the web UI made (starts, priorities, notes), not pushed yet
  (`git rev-list --left-right --count main...origin/main` gave `6 0`). Its reflog shows the human's
  pulls as rebases, "pull (finish): refs/heads/main onto ...". Their git configuration sets
  `pull.rebase true` and `rebase.autostash true` globally, and `rerere.enabled true` in this
  repository. A pull here is therefore a rebase of Uraeda's own chores over the merged work, with
  the uncommitted edits stashed and put back.
- **Uncommitted edits in the main checkout.** The web UI's edits wait uncommitted on the default
  branch until the Commit page commits them, and `ura clean` may leave the priorities line removed
  but uncommitted. A pull meets them. Checked in a throwaway repository with git 2.56.0: with
  `rebase.autoStash` off, `git pull --rebase` with an unstaged change refuses, "cannot pull with
  rebase: You have unstaged changes."; with it on, git prints "Created autostash" and "Applied
  autostash.".
- **Updating main without touching the checkout.** Checked in the same experiment:
  `git fetch origin main:main` refuses while `main` is checked out in any worktree, "refusing to
  fetch into branch 'refs/heads/main' checked out at ...", from the main checkout and from a
  feature's worktree alike. Since the main checkout holds `main`, a pull has to run there.
- **A conflict while pulling.** Checked in the same experiment: a local commit and an upstream
  commit changing the same line stop the rebase, "Could not apply c42a595...", with the file as
  `u UU` in `git status --porcelain=v2`, and `.git/rebase-merge/` present. The checkout is then on a
  detached `HEAD`: the web UI's writes to the default branch, which commit on `main`, cannot land
  until the rebase continues or aborts. `operation_in_progress` returns `None` for a rebase, so a
  start would not even refuse.
- **An agent's session in the main checkout.** A pull rebases the files under it. The
  [Run lifecycle](../decisions/run-lifecycle.md) decision continues cut runs by themselves, so a
  pull during one can meet a run resuming.
- **A feature's branch behind main.** Agents already bring main in, by a rebase, before their final
  review ([implementation](/skills/uraeda/references/implementation.md)), and resolve its conflicts
  within the spec. A conflict needing a choice stops the agent and becomes a round of questions. The
  priorities' Next section holds "Agents fix merge conflicts on open pull requests on their own".
- **Looking at a diff.** Today the human sees counts only: a session's Changes panel, and a
  feature's card. Their diffs are on GitHub, in the pull request, or in a terminal.
- **Worktrees.** Uraeda creates one per feature and change under `.worktrees/`, and `ura clean`
  removes them once merged. This repository also holds `.worktrees/coherence-before`, on a detached
  `HEAD`, made by hand. `git worktree list` showed it next to the three feature worktrees.
- **Committing.** The Commit page is the one place the web UI's edits are committed, as the
  [Git](../decisions/git.md) decision says: "Tools MUST NOT commit the human's edits unless the
  human asks for that commit, on the Commit page or by an action that says it commits." Its name is
  in a rule.

### Rules and their owners

- **Which branch is the default**: `Git::default_branch` ([`git.rs`](/crates/core/src/git.rs)), read
  by the workspace; every page reads it from there.
- **Which checkout holds the default branch**: `default_checkout`
  ([`api.rs`](/crates/core/src/api.rs)), used by the commit panes and buffers.
- **Whether a write may run while an agent works**: `writable`
  ([`fate/sessions.ts`](/packages/server/src/fate/sessions.ts)), feature by feature; nothing guards
  the main checkout's sessions.
- **Whether an operation is in progress**: `operation_in_progress`
  ([`git/status.rs`](/crates/core/src/git/status.rs)), with the start's reading of it.
- **What waits for a commit**: `changes::pane`
  ([`actions/changes.rs`](/crates/core/src/actions/changes.rs)), copied by nobody: the sidebar's
  count, the phone's tab, and the page read the same panes.
- **Where a place's name, icon, and keys live**:
  [`destinations.ts`](/packages/web/src/destinations.ts) and
  [`leaderTree.ts`](/packages/web/src/keys/leaderTree.ts).
- **Cleaning a merged feature**: [`actions/clean.rs`](/crates/core/src/actions/clean.rs), for the
  CLI only.

### Likely changes

Under every option:

- [`crates/core/src/git/`](/crates/core/src/git/): new files for the reads (ahead and behind of the
  default branch against `origin`, the operation in progress, a rebase included, the conflicted
  files and their stages, a commit's files, a diff's lines) and for the writes (`fetch`, `pull`,
  `push`, and the conflict's actions), through `process.rs`.
- [`crates/core/src/api/`](/crates/core/src/api/) and [`crates/binding/`](/crates/binding/): the
  page's view and its actions, through the binding, as the [Stack](../decisions/stack.md) decision
  asks.
- [`packages/server/src/fate/`](/packages/server/src/fate/): the page's source and mutations, the
  writes in the queue ([`writes/queue.ts`](/packages/server/src/writes/queue.ts)).
- [`packages/web/src/`](/packages/web/src/): the page, its place in
  [`destinations.ts`](/packages/web/src/destinations.ts) and
  [`leaderTree.ts`](/packages/web/src/keys/leaderTree.ts), its route in
  [`App.tsx`](/packages/web/src/App.tsx) and `routes.tsx`, the sidebar and the phone's tabs.
- [`specs/decisions/git.md`](../decisions/git.md): its rule naming "the Commit page", when the page
  is renamed.
- [`docs/web-ui.md`](/docs/web-ui.md): its "Committing" section, as the
  [Documentation](../decisions/documentation.md) decision asks.
- The sandbox's sample projects ([Sandbox](../decisions/sandbox.md)): a remote to pull from, a
  branch behind, and a conflict, so the page can be tried.

With a diff view:

- A new dependency in [`packages/web/package.json`](/packages/web/package.json), or a new diff
  component over CodeMirror, depending on [diff rendering](#diff-rendering).

With conflicts resolved in the page:

- A code editor for any file of the checkout, the shared editor with a language other than Markdown,
  which the [Text editing](../decisions/text-editing.md) decision's "MUST highlight Markdown" rule
  does not foresee.

Tests that guard behaviour the feature may change:

- [`packages/web/src/__tests__/commit-toast.test.tsx`](/packages/web/src/__tests__/commit-toast.test.tsx):
  "a refused commit shows its output on its file and in the toast", "a typed commit message stays
  once its commit is refused", "a landed typed message goes, and the same change again reads the
  suggestion", "a rewritten message is unsaved text: leaving asks, and it comes back with its
  notice". They test the panes, which stay; they change only if the page's address or name does.
- [`packages/web/src/__tests__/phone-tabs.test.tsx`](/packages/web/src/__tests__/phone-tabs.test.tsx):
  the phone's tabs fit 375 px with Commit showing. A permanent Git tab changes what fits.
- [`packages/web/src/__tests__/keys-leader-tree.test.tsx`](/packages/web/src/__tests__/keys-leader-tree.test.tsx)
  and [`keys-registry.test.tsx`](/packages/web/src/__tests__/keys-registry.test.tsx): the places'
  keys, with `g c`.
- The core's tests of the [Git](../decisions/git.md) decision's rules, in
  [`crates/core/tests/git.rs`](/crates/core/tests/git.rs): never force, never delete unasked. Every
  new write must join them.

### Other features in flight

- [`change/2026-11-04-vim-mode`](/specs/changes/2026-11-04-vim-mode/) changes the shared editor and
  the status line ([`shell/StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx)): a conflict
  editor and the page's status line hints meet it. No stored data in common.
- [`change/2026-11-04-reading-long`](/specs/changes/2026-11-04-reading-long/) has no commit beyond
  its start: the session's composer, not this page.

## The proposal

### Five parts, one page

The proposal names pulling main, seeing diffs, seeing and fixing conflicts, the commit history, and
worktrees, and the page replacing the Commit page. Each is a story at least: with the page itself,
that is 6, the [split rule](/skills/uraeda/references/writing.md#a-spec)'s limit. Fixing conflicts
in the page, as VS Code or JetBrains do, is a feature of its own in every product compared: a
three-way view, a code editor for any file, and the continue and abort of the operation.

### "Pull main" meets Uraeda's own commits

The proposal says "pull main after a PR". In this repository, `main` is ahead of `origin/main` with
the web UI's own chores, so a pull is never a fast-forward: it is a rebase, by the human's
configuration, or a merge. Git's default without configuration refuses it. See
[the proposal's path](#the-proposals-path-and-existing-actions).

### Push is not named

Uraeda's chores on `main` reach `origin` only when someone pushes. Every compared product puts push
next to pull. The proposal says "pull, see diffs, ...": push is a gap.

### "See diffs" of what

Diffs could be of the uncommitted changes, of a commit, or of a feature's branch against main, which
the pull request on GitHub already shows. The proposal does not say which.

### "Fix merge conflicts" where

Conflicts reach the human in two places: the main checkout, during a pull, and a pull request on
GitHub, where agents already rebase their branch before their review. The priorities' Next section
holds "Agents fix merge conflicts on open pull requests on their own". The proposal does not say
whether the page fixes them by hand, or hands them to an agent.

### "Worktrees" for what

Uraeda creates and removes the worktrees of features. The proposal says "look at", which could mean
a list, or also cleaning merged ones, which only `ura clean` does today, or creating and removing
any.

### "The current commit look and behaviour can stay"

The Commit page lists only the workflow files Uraeda edited, described. A git page shows
`git status`: every changed file. Whether the page shows both, and whether it commits other files,
is a gap. Its rule in the [Git](../decisions/git.md) decision names "the Commit page".

### "leader -> g"

`Space g` is free; `g g` is "first row" in every list, so the go keys' own letter for the page
cannot be `g`. `g c` leads to the Commit page today.

### Look and feel

"The components need to fit with our look and feel": the page is built from Astryx and the theme, as
the [UI components](../decisions/ui-components.md) decision requires, and a diff library must be
styled through it.

## Worth it and feasibility

**Gain.** The human leaves the web UI for a terminal today for every pull after a merge, which
happens once per feature: 30 pull requests merged since 26 October in this repository
(`gh pr list --state merged --search "merged:>=2026-10-26"`). A local `main` behind `origin` also
starts new features from a stale base. Diffs are the other gap: no page shows a line of code.

**Cost.** Pull, push, fetch, status, history, a commit's diff, and the worktree list are mostly
reads the core has, and writes that fit the existing queue and toast. The diff view is new UI, a
dependency or a component. Fixing conflicts in the page is the expensive part: a code editor for any
file, a three-way model, the operation's state, and every kind of conflict. Every compared product
calls it its weakest or most complex part.

**Outside behaviour it relies on.**

- Checked: `git fetch origin main:main` refuses while `main` is checked out; a rebasing pull refuses
  an unstaged change without autostash, and goes through with it; a rebase conflict leaves `UU`
  entries, `rebase-merge/`, and a detached `HEAD`. Throwaway repositories, git 2.56.0.
- Checked in the source: gix 0.89 reports conflicts in status and diffs blobs with the features
  already on.
- Not checked: how the human's credential helper behaves from the server's process, without a
  terminal. A pull or a push over HTTPS that needs a prompt fails, and ssh needs `SSH_AUTH_SOCK` in
  the server's environment. The plan's first task checks a pull and a push from the running server.

**Guards.** No option loosens one. A pull and a push run with the human's own credentials, as the
[Git](../decisions/git.md) decision asks: anyone signed in to the server could push the default
branch to GitHub, as they can already start agents that push.

## Approaches

Criteria: the proposal (pull main, diffs, conflicts, history, worktrees, one page, lazygit as
inspiration, Uraeda's look); the [Git](../decisions/git.md) decision (never lose work, never force,
no switched checkout, commit only when asked); [UI components](../decisions/ui-components.md)
(Astryx, the theme); [Performance](../decisions/performance.md) (100 ms, no loading state);
[Keyboard](../decisions/keyboard.md); the constitution's
[humans stay in control](../CONSTITUTION.md#i-humans-stay-in-control).

### Scope and split

How much of the proposal one spec holds. Relies on [five parts](#five-parts-one-page) and
[worth it](#worth-it-and-feasibility).

| Option                                   | Covers                                                                                                                      | Spec size           | Conflicts |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------- |
| A. Everything at once                    | pull, push, diffs, history, worktrees, conflicts edited in the page                                                         | past the split rule | full      |
| B. The page now, editing conflicts later | pull, push, diffs, history, worktrees; conflicts listed, one side taken per file, continued, aborted, or handed to an agent | about 6 stories     | basic     |
| C. Pull and diffs only                   | the page with sync and the changes' diffs                                                                                   | 3 stories           | none      |

### Pulling

What a pull does when `main` has local commits. Relies on [git's pull](#git-256-pull-and-fetch) and
["Pull main" meets Uraeda's own commits](#pull-main-meets-uraedas-own-commits).

| Option                                                             | This repository              | Without configuration | Like                             |
| ------------------------------------------------------------------ | ---------------------------- | --------------------- | -------------------------------- |
| A. Follow the human's configuration, rebasing when it says nothing | rebases (`pull.rebase true`) | rebases               | lazygit, VS Code, plus a default |
| B. Follow the configuration only                                   | rebases                      | refuses on divergence | lazygit, VS Code                 |
| C. Fast-forward only                                               | refuses after every merge    | refuses               | GitKraken's "Fast-forward only"  |
| D. Ask each time: rebase or merge                                  | asks                         | asks                  | JetBrains                        |

### Uncommitted changes during a pull

Relies on [git's pull](#git-256-pull-and-fetch): autostash, and its conflicts on re-applying.

| Option                       | Uraeda's waiting edits               | Risk                            |
| ---------------------------- | ------------------------------------ | ------------------------------- |
| A. Always autostash          | carried over                         | a re-applied stash can conflict |
| B. Follow `rebase.autoStash` | carried over here; refused elsewhere | differs by machine              |
| C. Refuse until committed    | the human commits first              | one more step                   |

### Fetching

When `origin` is read. Relies on [lazygit](#lazygit), [VS Code](#vs-code), and the credential
pitfall.

| Option                                                          | Behind count fresh | Credential failures       | Merged detection |
| --------------------------------------------------------------- | ------------------ | ------------------------- | ---------------- |
| A. In the background, every few minutes, and on the page's open | yes                | silent, shown on the page | sooner           |
| B. On the page's open and a key                                 | when looked at     | at the human's press      | on open          |
| C. Only on a key                                                | stale              | at the press              | stale            |

### Push

Relies on [push is not named](#push-is-not-named).

| Option                                       | Uraeda's chores on `origin` | Risk               |
| -------------------------------------------- | --------------------------- | ------------------ |
| A. Push the checked-out branch, never forced | at a press                  | none with no force |
| B. No push                                   | by hand in a terminal       | none               |

### Diffs shown

Relies on ["see diffs" of what](#see-diffs-of-what).

| Option                     | Uncommitted | A commit | A branch against main |
| -------------------------- | ----------- | -------- | --------------------- |
| A. Uncommitted and commits | yes         | yes      | no, GitHub shows it   |
| B. All three               | yes         | yes      | yes                   |
| C. Uncommitted only        | yes         | no       | no                    |

### Diff rendering

What draws a diff's lines. Relies on [Astryx's `CodeBlock`](#astryx-073s-codeblock),
[@codemirror/merge](#codemirrormerge), and [@pierre/diffs](#pierrediffs). The
[UI components](../decisions/ui-components.md) decision asks for Astryx wherever one fits.

| Option                                                  | Astryx and the theme       | Split view | New dependency | Large diffs               |
| ------------------------------------------------------- | -------------------------- | ---------- | -------------- | ------------------------- |
| A. Astryx's `CodeBlock` with `isDiff`                   | native                     | no         | none           | capped, no virtualization |
| B. @codemirror/merge, through the shared editor's theme | via `EditorView.theme`     | yes        | 17 KB          | viewport rendering        |
| C. @pierre/diffs                                        | 80 variables, Shiki themes | yes        | Shiki, large   | virtualized               |
| D. A component of our own over jsdiff                   | ours                       | ours       | 8 KB           | ours                      |

### Fixing conflicts

Relies on [conflicts](#git-256-conflicts) and the products' conflict sections.

| Option                                                                | One side per file | Per hunk | Edit the result | Continue, abort | Agent    |
| --------------------------------------------------------------------- | ----------------- | -------- | --------------- | --------------- | -------- |
| A. List, one side per file, abort and continue, and hand to an agent  | yes               | no       | no              | yes             | yes      |
| B. A, plus picking per hunk and editing the file in the shared editor | yes               | yes      | yes             | yes             | yes      |
| C. A three-way merge editor, like VS Code                             | yes               | yes      | yes             | yes             | optional |
| D. Show only, and abort                                               | no                | no       | no              | abort           | no       |

### Changes other than Uraeda's

What the page shows of `git status` beyond the Commit page's panes. Relies on
["The current commit look and behaviour can stay"](#the-current-commit-look-and-behaviour-can-stay).

| Option                                                        | Shown | Committed from the page |
| ------------------------------------------------------------- | ----- | ----------------------- |
| A. Listed with their diffs, never committed or discarded here | yes   | no                      |
| B. Listed, committed and discarded per file                   | yes   | yes                     |
| C. Staged by hunk and line, like lazygit                      | yes   | yes, partly             |
| D. Not shown                                                  | no    | no                      |

### History

Relies on [lazygit](#lazygit), [GitHub Desktop](#github-desktop), and [JetBrains](#jetbrains-ides).

| Option                                                                          | Reads               | Cost                  |
| ------------------------------------------------------------------------------- | ------------------- | --------------------- |
| A. The checked-out branch's commits, a list, with what is unpushed and unpulled | like GitHub Desktop | low: `history` exists |
| B. A graph of every branch                                                      | like lazygit        | a graph component     |

### Worktrees

Relies on [worktrees](#git-256-worktrees) and ["Worktrees" for what](#worktrees-for-what).

| Option                                                 | List | Clean merged | Remove any clean one | Create           |
| ------------------------------------------------------ | ---- | ------------ | -------------------- | ---------------- |
| A. List, and clean the merged ones as `ura clean` does | yes  | yes          | no                   | no, a start does |
| B. A, plus removing any clean worktree                 | yes  | yes          | yes                  | no               |
| C. List only                                           | yes  | no           | no                   | no               |

### The page's place and keys

Relies on ["leader -> g"](#leader---g) and the [phone's tabs](#important-reads).

| Option                                                                                               | Sidebar               | Phone                 | Keys             |
| ---------------------------------------------------------------------------------------------------- | --------------------- | --------------------- | ---------------- |
| A. "Git" always in the sidebar, with the count of what waits; a phone tab only while something waits | always                | while something waits | `Space g`, `g c` |
| B. Shown only while something waits, as Commit is                                                    | while something waits | same                  | `Space g`, `g c` |

### Needs no choice

- **Stash**: Uraeda's flows never need one beyond a pull's autostash; listing stashes adds a panel
  for a rare case. Left out, as a settled point.
- **Undo**: lazygit's reflog undo covers neither the working tree nor a push; the page's writes are
  pull, push, and resolving, each with its own way back (abort). Left out.
- **Staging by line**: in [changes other than Uraeda's](#changes-other-than-uraedas), option C.
- **A command log** of the git commands the page runs, praised in lazygit: the toast already shows a
  write's output as it comes ([`CommitToast.tsx`](/packages/web/src/writes/CommitToast.tsx)).
- **Remotes other than `origin`**: Uraeda reads `origin` only (`Git::branches`).
- **Accessibility**: the [Keyboard](../decisions/keyboard.md) and [UI look](../decisions/ui-look.md)
  decisions cover keys and contrast; a diff marks lines with a sign column, never colour alone.
- **Languages and time**: commit times show as the app shows times today.
- **Scale**: a history is paged; a diff over a size shows its counts and a button, as GitLab and
  GitHub do.
- **Removal**: the page replaces one, and nothing is stored: removing it removes code only.

## Not checked

- Credential helpers' behaviour from a server process: libsecret, the macOS keychain,
  `gh auth git-credential`.
- Reddit threads on lazygit: the site refuses automated reads. Community sentiment comes from GitHub
  issues and Hacker News.
- GitHub Desktop's in-app conflict buttons, seen only in search snippets; its official page on
  conflicts returned 404.
- Sublime Merge's and GitKraken's conflict pages, which returned 404.
