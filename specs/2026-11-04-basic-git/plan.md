---
status: auto-approved
spec-revision: 3
---

# Plan: Basic git UI in the web UI

**Goal:** a Git page for the main checkout that pulls, pushes, fetches, stages and commits any file,
shows diffs and the history, merges a branch into `main`, fixes conflicts in the shared editor, and
cleans and removes worktrees, in place of the Commit page.

**Architecture:** three layers, each owning its rules, as the
[spec's architecture](spec.md#architecture) draws them.

- **The core's `git/` module** owns every git rule: what the checkout holds (files, conflicts, the
  stopped operation and its sides by branch name), diffs and their 1,000-line cap, and every write.
  Reads go through gix; writes go through `git`, from one runner that never prompts
  (`process::git_write`). It owns the pull's default (`--rebase` when `pull.rebase` and `pull.ff`
  are unset), the push's refusal text, the credential hint, and the one guard that refuses a commit
  while a pull or a merge is stopped, in `Git::commit_staged`, which every commit of every action
  goes through. A pull or a merge that stops on a conflict succeeds: the state shows the stop.
- **The core's `api/`** gathers the page's views in one read each, and maps a page's group (the main
  checkout, or a feature's folder) to its worktree, so the web never passes a path to act on. It
  owns which files a page may write: a conflicted file only, and a worktree the repository lists.
- **The server** serves the views, lands every write in the repository's write queue with its output
  streamed to the toast, owns the checkout guard (a chat's agent in the main checkout, a feature's
  agent in its worktree), and runs the fetcher: on the page's open and every 5 minutes, outside the
  toast, keeping the last failure for the page. It publishes the page's views after each write, on
  the watcher's new `git` change, and when a session's turn starts or ends.
- **The web** draws the page from the views. It owns the presentation only: the tree of folders
  built from the flat file list, folding, the picked row in the address, the keys, and the conflict
  bar's text edits in the shared editor, which the human saves.

The authoritative state is the repository: no layer keeps a copy beyond a read. The write queue is
the only place writes are ordered; the write lock (`api::write_lock`) is held by each core write.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The conditions the spec implies but does not name. Each is pinned in the task that owns its code.

1. **A path the web sends outside the repository**, like `../x` or `/etc/passwd`, or a file that is
   not conflicted, to stage, discard, or save as a resolution: refused, nothing written. Tasks 4
   and 6.
2. **A path with spaces, quotes, or non-ASCII letters** lists, diffs, stages, and discards as
   itself. Tasks 2 and 4.
3. **`main` with no upstream set**, only `origin/main`: pull, push, and the counts still work, since
   every remote write names `origin` and the branch. Task 3.
4. **A staged new file discarded**: it is deleted, after the same question; a file staged and also
   changed since is restored whole to `HEAD`. Task 4.
5. **Commit with nothing staged**, or an empty message: refused with git's message, nothing
   committed. Task 4.
6. **A background fetch that fails** never shows in the toast, never blocks the next write, and its
   failure clears once a fetch succeeds. Task 8.
7. **A conflict file with CRLF line endings, or `diff3` markers** with the base section: the bar
   finds each conflict and keeps the file's line endings. Task 10.
8. **Two presses of Pull**, or Pull then Push: they land one after another, in order. The existing
   queue's ordering test owns it; task 7 puts every git write in that queue.

## Global constraints

From the spec, word for word:

- The title's line reads "main · 3 to pull · 6 to push · fetched just now": the branch, then "N to
  pull" and "N to push" when not 0, then when it was fetched. With no remote: "main · no remote". On
  a detached `HEAD`: "detached at 4f8c2b7", Pull and Push disabled.
- A rejected push: "origin has commits main lacks: pull first."
- A credential failure shows git's message and "The server runs git without a terminal: give it a
  credential helper or an ssh-agent."
- The sidebar reads "Git · 3 · ↓3": the changes to commit, then the commits to pull. It shows "Git"
  alone when nothing waits, and is always there; the phone's tab shows only while something waits.
- `Space g`, `g c`, and `/commit` open the Git page, at `/git`.
- A binary file's diff reads "Binary file, 12 KB to 14 KB". A diff over 1,000 lines shows "+2,900
  −100" and "Show the whole diff".
- Discard asks "Discard the changes to docs/web-ui.md?", and only Discard restores it.
- An untracked file reads "new", and Space adds it.
- A stopped pull reads "The pull stopped: 1 file conflicts."; a merge, "The merge stopped: 2 files
  conflict.", each with Continue and Abort.
- A conflict's sides are named by branch: "Use origin/main", "Use main", "Use both" over each
  conflict in the editor; a file's row offers the two whole sides. A delete conflict reads "deleted
  on origin/main, changed on main", with "Keep the file" and "Delete the file". A conflict in a
  binary file, or a rename, offers the whole sides only, without the editor.
- Abort after files were resolved asks "Abort the pull? The resolved files go back as they were."
- While a rebase is stopped, an action that commits on `main` is refused: "A pull is stopped:
  continue or abort it first."
- Merging is "Merge into main…" on a branch picked from the local and `origin` branches.
- A worktree with changes reads "has changes" and offers neither Clean nor Remove; a missing one
  reads "missing", with Remove, which prunes its record. Remove keeps the branch.
- While a chat's agent works in the main checkout: "An agent works in this checkout.", and Pull,
  Push, Stage, Commit, and Merge are disabled.
- Keys: `p` pull, `P` push, `f` fetch, Space stage or unstage, `a` stage or unstage all, Enter fold
  a folder or open a file's diff, `c` commit staged, `d` discard the file or remove the worktree,
  `M` merge into main, `m` continue or abort, `j`/`k` and Enter in the lists. Space on a file row
  stages: the leader menu opens there with Ctrl+K.
- The fetcher runs on the page's open and every 5 minutes, in the write queue, without a toast.
- SC-001: the page draws within 100 ms from what the server holds, on Uraeda's own repository.
- SC-003: no write of the page forces, and a discard, a removal, or an abort never runs without its
  confirmation.
- SC-004: while a chat's agent works in the main checkout, every write of the page is refused.

From [Git](../decisions/git.md):

- Tools MUST NOT lose the user's work: no force-removed worktree, no force-push, and no deleted
  branch with commits the default branch lacks. Checked by the core's tests.
- Tools MUST remove or delete anything only when a human asks. Checked by the core's tests.
- Tools MUST NOT bypass the user's hooks, signing, or credentials. Checked by the core's tests.
- Tools MUST NOT switch the user's checkout unless the human asks.
- Tools MUST NOT commit the human's edits unless the human asks for that commit, on the Git page or
  by an action that says it commits. Checked by the core's tests.
- Rust tools MUST read git with the gix library, and write through the system `git`, from one module
  of the core.

From [Stack](../decisions/stack.md):

- Workflow logic, parsing, validation, and states MUST live in the Rust core.
- TypeScript MUST reach the core only through the binding, never reimplementing it.
- The server MUST be TypeScript on Node, and the web UI React with Astryx, the UI's design system,
  fed only by the server through fate, its data library.

From [UI behaviour](../decisions/ui-behaviour.md):

- Small edits MUST happen in place, with a dialog only to confirm an irreversible action or to hold
  a short form.
- Unsaved text MUST be marked as unsaved, outside an outline's rows.
- Status MUST show next to what it concerns, with an error staying there until dealt with, never
  only in a toast.
- A refused write MUST put back what it showed and say why next to what it concerns.
- A git write MUST show its progress in a toast until it lands.
- Git writes MUST land one after another, in the order they were made, without blocking the human.
- Back and reload MUST keep the human's place and what they were reading.
- Unsaved text SHOULD NOT be dropped without asking.

From [Keyboard](../decisions/keyboard.md):

- A shortcut MUST be declared in the key registry, and listened for nowhere else. Checked by a
  structural test.
- Every action MUST work by keyboard and by tap, never by hover or a single key alone.
- A key MUST NOT mean two things on one page, though two pages may give it different meanings.
  Checked by the registry's tests.
- The status line SHOULD show the keys that work on the page, drawn from the registry.

From [Text editing](../decisions/text-editing.md):

- Every text field MUST be the one shared editor, unless it is part of another Astryx component,
  like a picker's filter, or only the browser's field can do the job, like a password. Checked by
  lint.
- The editor MUST highlight Markdown, with Vim on or off.
- Vim's keys MUST come from CodeMirror's Vim engine, never from keys handled by hand.

From [UI components](../decisions/ui-components.md):

- Views MUST use Astryx components wherever one fits the job, except text fields, which follow the
  Text editing decision. Checked by lint.
- Views MUST be styled only through Astryx's theme, never with a global stylesheet or inline styles.
  Checked by lint.
- A kind of information MUST be drawn by one shared component on every page that shows it.
- A raw element or a plain style MAY stand in where Astryx and StyleX cannot do the job, with its
  reason in a comment, the plan listing it as an Astryx gap. Checked by lint.

From [UI layout](../decisions/ui-layout.md):

- On narrow screens, views MUST be pages, and pickers, short forms, and confirmations rise as sheets
  from the bottom.
- A selector or a menu opened from a control MUST stay a popover anchored to it, at every width.
- An open detail, tab, or sheet MUST be in the address, so reload, Back, or a width change keeps it.

From [Performance](../decisions/performance.md):

- The browser MUST keep the data of the pages it has shown, and read the page of the selected row
  ahead, so a key reaches it as fast as a click.
- A page SHOULD NOT show a loading state: what it shows comes from what the server and the browser
  already hold. Checked by the benchmark.
- A commit's hooks and an agent's work MAY take longer than the target, as long as their progress
  shows.

From [Testing](../decisions/testing.md), at the `early` stage:

- A test MUST assert what a caller or a user observes, never how the code does it.
- At the `early` stage, a feature MUST test little beyond stored formats, git, security, contracts
  between the project's parts, pure logic with many cases, and the reproduction of each bug fixed.
- A test of the web UI MUST guard behaviour that is costly to lose and that using the UI would not
  show, such as unsaved text or a git write.
- A UI change MUST be easy to try in the running app, through the sandbox.
- The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's and a desktop's width.
- A pull request that adds a view MUST show one screenshot of it, never committed to the repository.

From [Code quality](../decisions/code-quality.md), with the limits of `clippy.toml` and
`vite.config.ts`: functions at most 100 lines and 7 parameters, nesting at most 4 levels in a
function and 3 in a method, files at most 500 lines (`crates/cli/tests/structure.rs`):

- Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting. Checked by clippy and Oxlint.
- A new marker MUST NOT be added unless a human approves it in the plan.
- Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.

From [Toolchain](../decisions/toolchain.md):

- After every task, the fast check MUST cover formatting, lint, types, and the affected focused
  tests and boundary checks, naming the broader checks it leaves to `ready`.
- An agent MUST run `vp run ready` before pushing a branch.

Existing guarantees to keep:

- Every commit runs the user's hooks: `commit_staged` in
  [`git/commit.rs`](/crates/core/src/git/commit.rs) never passes `--no-verify`, and makes a relative
  `core.hooksPath` absolute in a linked worktree (`hooks_override`). The page's commit goes through
  it.
- `Git::remove_worktree` never forces ([`git.rs`](/crates/core/src/git.rs)); `ura clean` refuses a
  worktree with changes ([`actions/clean.rs`](/crates/core/src/actions/clean.rs) `worktree`).
- A feature's writes are refused while its agent works:
  [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) `writable`, with `REFUSALS.working`.

## Code read

- [`crates/core/src/git.rs`](/crates/core/src/git.rs), 497 lines, 3 under the file limit: `Git` over
  a `gix::Repository` and its `root`; `discover`, `open`, `default_branch`, `current_branch`,
  `branches` (local and `origin/*`), `tip`, `remote_tip`, `worktrees`, `worktree_records` (with
  `locked` and `missing`), `has_local_changes`, `remove_worktree` (never forced), `prune_worktrees`,
  `fetched_at` (from `FETCH_HEAD`). `GitError` has `Command{subcommand, message, output}` for a
  failed `git`, and no variant for a refusal of our own. New modules need room: task 1 moves the
  worktree functions out.
- [`git/process.rs`](/crates/core/src/git/process.rs): `run` and `run_streaming` (stdin null, lines
  streamed to a callback). No environment is set: nothing turns git's prompts off, and a
  `--continue` would open the editor.
- [`git/status.rs`](/crates/core/src/git/status.rs): `status_items` over gix's status;
  `operation_in_progress` returns `None` for a rebase on purpose, for its one caller, the start's
  plan ([`actions/start/plan.rs`](/crates/core/src/actions/start/plan.rs)), which stays as it is.
- [`git/log.rs`](/crates/core/src/git/log.rs): `behind(local, remote)` counts through gix; ahead is
  `behind(remote, local)`. [`git/history.rs`](/crates/core/src/git/history.rs):
  `history(tip, since)` walks without paging; `numstat` runs `git diff --numstat`.
  `ChangedFile{path, added, removed}` is in [`changes.rs`](/crates/core/src/changes.rs), `None` for
  a binary file.
- [`git/commit.rs`](/crates/core/src/git/commit.rs): `stage`, `unstage(paths)`, `restore`,
  `commit_staged` (private, every commit's command), `commit_streaming` with `OnOutput`.
- gix 0.89 with `sha1`, `revision`, `status` ([`Cargo.toml`](/Cargo.toml)): `status` brings
  `blob-diff`, so blob diffs and `gix-diff`'s unified diff need no new feature. Nothing uses them
  yet.
- [`crates/core/src/api.rs`](/crates/core/src/api.rs) and
  [`api/commit_panes.rs`](/crates/core/src/api/commit_panes.rs): views are
  `#[cfg_attr(feature = "napi", napi_derive::napi(object))]` structs with serde's camelCase;
  `ApiError{code: "refused"|"conflict"|"hook", message, output}` in
  [`api/error.rs`](/crates/core/src/api/error.rs), and `From<GitError>` drops `output`; writes take
  `write_lock(repo)`. `default_checkout` finds the checkout holding the default branch.
- [`actions/clean.rs`](/crates/core/src/actions/clean.rs): `clean(git, workspace, feature, dry_run)`
  is what `ura clean` runs ([`crates/cli/src/clean.rs`](/crates/cli/src/clean.rs)); it refuses a
  feature not `Done`.
- [`crates/core/src/watch.rs`](/crates/core/src/watch.rs), 396 lines: watches the common git folder
  (not recursive), `refs/`, `worktrees/`, each worktree's top level and `specs/`. `Changes` has no
  field for the index, `HEAD`, or an operation.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs) and
  [`deferred.rs`](/crates/binding/src/deferred.rs): `job(...)` runs an API call as an `AsyncTask`;
  an `ApiError` becomes `"{code}: {message}"` plus `"\n\n{output}"`. Streaming output passes a
  `ThreadsafeFunction<String, ...>` called per line (`land`). `packages/binding/index.d.ts` is
  generated by `vp run --filter uraeda-binding build`, and committed.
- Core tests: [`crates/core/tests/common/repo.rs`](/crates/core/tests/common/repo.rs) `TestRepo` (a
  repository on `main`, a counting pre-commit hook, `push(branch)` creating a bare `origin.git`),
  `run_git`, `without_user_git`. Run by `cargo nextest` through `vp run fast` and `vp run ready`,
  with git's user configuration off (`isolatedGit` in [`vite.tasks.ts`](/vite.tasks.ts)). The tests
  of the commit panes are in [`tests/branch_commits.rs`](/crates/core/tests/branch_commits.rs).
- [`packages/server/src/writes/queue.ts`](/packages/server/src/writes/queue.ts): `WriteQueue` with
  `enqueue(write, land, keys)` streaming `onOutput` lines into the record, throttled; every entry
  shows in the toast; a refused one stays with `failure` and `output`.
  [`fate/write-queue.ts`](/packages/server/src/fate/write-queue.ts): `queued`, `landed`,
  `featureKeys`. [`fate/errors.ts`](/packages/server/src/fate/errors.ts): `callSiteError`,
  `refusable`.
- [`packages/server/src/runner/sessions.ts`](/packages/server/src/runner/sessions.ts): `working`
  (features' folders) and `busy` (any session); a chat is a live session with `folder: null`.
- [`packages/server/src/fate/sources.ts`](/packages/server/src/fate/sources.ts),
  [`views.ts`](/packages/server/src/fate/views.ts), [`fate.ts`](/packages/server/src/fate.ts),
  [`mutations.ts`](/packages/server/src/fate/mutations.ts): a view is a `dataView`, a `fileSource`
  in `sources`, a list in `Root`, and an exported `Entity` type; a mutation is `{resolve, type}` in
  `repositoryMutations`. [`live.ts`](/packages/server/src/live.ts) `publish` maps the watcher's
  `Changes` to `live.update`.
- [`packages/server/src/pulls.ts`](/packages/server/src/pulls.ts): the per-repository timer pattern,
  started and stopped in [`repositories.ts`](/packages/server/src/repositories.ts) `Hosts`, tested
  with fake timers ([`__tests__/pulls.test.ts`](/packages/server/src/__tests__/pulls.test.ts)).
- Server tests: [`__tests__/helpers.ts`](/packages/server/src/__tests__/helpers.ts) `testApp`,
  `testServer` (a fake agent), `byId`, `mutate`;
  [`__tests__/buffer.test.ts`](/packages/server/src/__tests__/buffer.test.ts) shows a write refused
  while an agent works.
- Web: [`GitMockups.stories.tsx`](/packages/web/src/GitMockups.stories.tsx), the approved stories,
  built from `PageTitle`, `Panes`, `Pane`, `DiffCount`, `Path`, `AnnouncedBanner`, `useConfirm`, and
  Astryx's `CheckboxInput` and `CodeBlock`. The Commit page:
  [`CommitPage.tsx`](/packages/web/src/CommitPage.tsx), [`commit/`](/packages/web/src/commit/); its
  message field's unsaved-text handling in
  [`commit/usePaneWrites.ts`](/packages/web/src/commit/usePaneWrites.ts) (`landing`).
- Web places and keys: [`destinations.ts`](/packages/web/src/destinations.ts) `commit`;
  [`keys/leaderTree.ts`](/packages/web/src/keys/leaderTree.ts) `goCommitBinding` (`g c`);
  [`keys/LeaderKeys.tsx`](/packages/web/src/keys/LeaderKeys.tsx); `space g` is free and `g g` is
  taken; [`keys/fields.ts`](/packages/web/src/keys/fields.ts) lets a checkbox keep Space, and
  `mod+k` opens the leader there. [`lists/useListKeys.ts`](/packages/web/src/lists/useListKeys.ts)
  finds rows by `[data-row] a[href], [data-row-link] button`.
- Web routes: [`routeTable.ts`](/packages/web/src/routeTable.ts) (`{page: "commit"}`,
  `{page: "moved", path}`), [`App.tsx`](/packages/web/src/App.tsx), `pages.ts`. Other `/commit`
  literals: [`writes/RefusedHere.tsx`](/packages/web/src/writes/RefusedHere.tsx),
  [`writes/CommitToast.tsx`](/packages/web/src/writes/CommitToast.tsx),
  [`shell/ColumnPanes.tsx`](/packages/web/src/shell/ColumnPanes.tsx) (`CommitAction`).
  [`shell/Tabs.tsx`](/packages/web/src/shell/Tabs.tsx) `CommitTab`.
- The shared editor, [`fields/editor/Editor.tsx`](/packages/web/src/fields/editor/Editor.tsx): a
  fixed list of extensions (`extensionsOf`), Markdown only, no prop for more.
  [`buffer/useBuffer.ts`](/packages/web/src/buffer/useBuffer.ts) shows a save with a base hash and
  its `"conflict"` refusal.
- Web tests: [`__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx) `renderPage` renders
  the real app over the real server on a fixture repository; `atWidth`, `type`, `click`. The Commit
  page's tests:
  [`__tests__/commit-toast.test.tsx`](/packages/web/src/__tests__/commit-toast.test.tsx)
  (`refusingHook`),
  [`keys-leader-tree.test.tsx`](/packages/web/src/__tests__/keys-leader-tree.test.tsx) SC-007,
  [`phone-tabs.test.tsx`](/packages/web/src/__tests__/phone-tabs.test.tsx).
- The sandbox: [`packages/web/samples/projects.ts`](/packages/web/samples/projects.ts) builds the
  projects; none has a remote.
- Benchmarks: `vp run bench` runs the ignored `bench_*` Rust tests and `*.bench.ts`, as
  [`tests/history.rs`](/crates/core/tests/history.rs) `bench_history_of_80_commits` does.
- Credentials, checked while planning: this repository's `origin` is HTTPS with
  `gh auth git-credential` as its helper, and no `SSH_AUTH_SOCK`. From a process with no terminal
  (`setsid`, stdin closed, `GIT_TERMINAL_PROMPT=0`), `git fetch origin main` and
  `git push --dry-run origin main` both succeeded.

## Constitution check

| I. Humans in control | II. Git and plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | ---------------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅                     | ✅         | ✅                | ✅                |

## Complexity tracking

| Abstraction or exception                                | Why it is needed                                                                                             | Simpler alternative rejected because                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `process::git_write`, the one runner of the page's git  | Every write must never prompt (`GIT_TERMINAL_PROMPT=0`) nor open an editor (`GIT_EDITOR=true`), in one place | Setting the environment in each write would let one forget it, and hang on a prompt                   |
| `Git::stopped` and `Stopped`                            | Which operation is stopped, and its sides by branch, is read by the state, the commit guard, and the writes  | Each reading gix's state would name a rebase's sides three times, and "ours" swaps during a rebase    |
| `GitError::Refused`                                     | The page's own refusals carry exact text ("origin has commits main lacks: pull first.")                      | Reusing `Command` would mix our text with git's, and lose which one the human reads                   |
| The page's views (`GitPageView`, `GitSummaryView`, ...) | The sidebar reads a cheap count on every page; the page reads everything in one call                         | One view for both would run every file's diff counts on every page of the app                         |
| `WriteQueue.background`                                 | The fetcher's writes must land in turn with the others, without a toast                                      | A `silent` flag on the record would make the toast and every reader of `writes()` filter it           |
| `git/tree.ts`, the changes' tree from the flat list     | Folding, single-child chains, and mixed boxes are presentation, built from the core's flat list              | A tree from the core would make the core own folding state, which lives in the page                   |
| `fields/editor/conflicts.ts` and the conflict bar       | The bar edits the editor's text between markers: an editor extension, as the spec's architecture says        | A core call per press would make each "Use origin/main" a round trip, and the text no longer editable |
| `Editor`'s `extensions` prop                            | The conflict bar is the only extension a page adds to the shared editor                                      | A second editor for conflicts would break the Text editing decision                                   |

The conflict markers are read in two places: the core says whether a conflicted file still holds
markers (to mark it resolved and to refuse Continue), and the bar finds them in the text being
edited. Both match git's marker lines, `<<<<<<< `, `=======`, `>>>>>>> `; the core's check is one
line test, the bar's a parser of the blocks. See ruling R4.

## Test map

The core's tests run real git on temporary repositories from `TestRepo`, with a bare `origin` where
a test needs a remote, and git's user configuration off. The server's tests run the real binding and
the real queue, with the fake agent for sessions and fake timers for the fetcher. The web's tests
render the real app over the real server on a fixture repository. New tests: 25, the ceiling of the
spec's 19 key scenarios plus 6 high edge cases; the benchmark is not one.

| Spec                                                                           | Task | Test                                                                                                                           |
| ------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| Unverified: credentials from the server without a terminal                     | 1    | the check while planning, run again in task 1's step 1                                                                         |
| Edge: a rebase stopped, an action commits on `main`                            | 1    | `tests/git_stopped.rs` `a_stopped_pull_refuses_every_commit`                                                                   |
| US1 1 (counts), more 4 (count after a fetch)                                   | 2    | `tests/git_checkout.rs` `the_state_counts_commits_to_pull_and_to_push`                                                         |
| US3 more 5 ("new"), Review focus: odd paths                                    | 2    | `tests/git_checkout.rs` `the_state_lists_each_file_with_its_stage`, one row a path with a space                                |
| US4 1, more 3; edge: rename and binary conflicts                               | 2    | `tests/git_checkout.rs` `a_conflict_names_its_sides_by_branch`, rows rebase, merge, delete                                     |
| Edge: the autostash cannot be put back                                         | 2    | `tests/git_checkout.rs` `a_stash_that_conflicts_lists_its_files_and_keeps_the_stash`                                           |
| US2 1, more 1, more 2                                                          | 2    | `tests/git_diff.rs` `a_diff_is_unified_binary_or_capped`, a row each                                                           |
| US2 3                                                                          | 2    | `tests/git_diff.rs` `a_commit_lists_its_files_with_their_counts`                                                               |
| US1 2, more 1, more 2, more 3; edge: pull with edits, autostash off            | 3    | `tests/git_remote.rs` `a_pull_follows_the_configuration_and_rebases_by_default`, a row each                                    |
| US1 3; edge: push when origin has commits main lacks                           | 3    | `tests/git_remote.rs` `a_push_never_forces`                                                                                    |
| US1 more 5; edge: fetch fails for credentials                                  | 3    | `tests/git_remote.rs` `a_credential_failure_says_how_to_give_one`                                                              |
| Edge: no `origin`; detached `HEAD`; Review focus: no upstream                  | 3    | `tests/git_remote.rs` `a_pull_follows_...` rows                                                                                |
| US3 1, 2, more 3; Review focus: odd paths, paths outside                       | 4    | `tests/git_staging.rs` `staging_moves_only_the_named_files`                                                                    |
| US3 3, more 6; Review focus: nothing staged                                    | 4    | `tests/git_staging.rs` `a_commit_holds_the_staged_files_through_the_hooks`                                                     |
| US3 more 4; edge: discard an untracked file; Review focus: a staged new file   | 4    | `tests/git_staging.rs` `discard_restores_one_file_as_git_does`                                                                 |
| US4 2 (the file side), more 1, more 2, 3; edge: abort after resolving          | 4    | `tests/git_resolve.rs` `a_stopped_pull_continues_once_resolved_or_aborts`                                                      |
| US5 1, 2; edge: a ref starting with `-`                                        | 4    | `tests/git_resolve.rs` `merge_brings_a_branch_into_main`                                                                       |
| US2 2 (history marks)                                                          | 5    | `tests/git_page.rs` `the_history_marks_commits_to_pull_and_to_push`                                                            |
| US3 more 7 (a feature's worktree group); US6 3; edge: a missing worktree       | 5    | `tests/git_page.rs` `the_page_groups_changes_and_lists_worktrees`                                                              |
| SC-001                                                                         | 12   | `tests/git_page.rs` `bench_git_page_on_uraedas_repository`, by `vp run bench`                                                  |
| US6 1, 2; SC-003 (removal); Review focus: paths outside, a file not conflicted | 6    | `tests/git_writes.rs` `the_page_writes_only_what_it_lists`                                                                     |
| US7 1, 2; SC-004; edge: a chat's agent starts during a pull                    | 7    | `__tests__/git-page.test.ts` `the_page_refuses_its_writes_while_a_chat_works_in_the_checkout`                                  |
| Streaming output in the toast; a hook's refusal (US3 more 6, server side)      | 7    | `__tests__/git-page.test.ts` `a pull lands in the queue with its output`                                                       |
| US1 1 (fetch on open), more 4 (every 5 minutes); Review focus: a failing fetch | 8    | `__tests__/git-fetch.test.ts` `the fetcher fetches every 5 minutes, outside the toast`                                         |
| US3 1 (Space stages, the row stays)                                            | 9    | `src/__tests__/git-page.test.tsx` `Space on a file row stages it, and the row keeps its place`                                 |
| US3 more 6 (typed message kept on a refusal, dropped once landed)              | 9    | `src/__tests__/git-page.test.tsx` `a typed message stays once its commit is refused, and goes once it lands`                   |
| US3 more 4 (discard asks); SC-003 (discard asks)                               | 9    | `src/__tests__/git-page.test.tsx` `discard asks first, and only Discard restores the file`                                     |
| US4 2 (the bar); Review focus: CRLF and diff3                                  | 10   | `src/fields/editor/conflicts.test.ts` `each choice resolves its block`, a row per case                                         |
| US1 more 6 (`Space g`, `g c`, `/commit`)                                       | 11   | the rewritten SC-007 tests of `keys-leader-tree.test.tsx`, Git among the places, and `/commit`'s row in the moved-address test |
| US1 more 4 (sidebar "Git · ↓3"); the phone's tab                               | 11   | `phone-tabs.test.tsx`, rewritten for the Git tab                                                                               |
| US3 more 1, 2, 3 (folding, mixed box, `a`)                                     | none | presentation the stories show; the stage writes are task 4's tests                                                             |
| US4 more 3 (delete conflict's words); US5 2's banner; the title's words        | none | text drawn from the view; the views' fields are task 2's and 5's tests                                                         |
| SC-002 (three presses)                                                         | none | follows from the keys and the place; reviewed in the running app                                                               |
| US6 1 (Clean as `ura clean`)                                                   | 6    | `the_page_writes_only_what_it_lists`, a row cleaning a merged feature; `tests/clean.rs` owns the rest                          |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Task 1: the runner, the stopped operation, and room in `git.rs`, which every later core task
   uses.
2. Tasks 2, 3, and 4: the reads, the remote writes, and the index and conflict writes, each in its
   own new files of `git/`. Each adds its `mod` line and re-exports to `git.rs`, and its own helpers
   to `tests/common/repo.rs`.
3. Tasks 5 and 6: the API's reads and writes, in their own files of `api/` and
   `crates/binding/src/`. Each adds re-exports to `api.rs` and a `mod` line to the binding's
   `lib.rs`; the generated `packages/binding/index.d.ts` and `index.js` are regenerated after the
   merge, never merged by hand.
4. Task 7: the server's views, mutations, guard, and live updates.
5. Tasks 8 and 9: the fetcher, on the server, and the page, on the web. Task 8 adds a field to the
   view task 7 made; task 9 reads it as optional.
6. Tasks 10 and 11: the conflicts' section and editor, and the page's place with the Commit page's
   removal. Task 10 adds its section to `git/GitPage.tsx`; task 11 does not touch it.
7. Task 12: the sandbox, the documentation, and the benchmark.

---

## Task 1: The write runner, the stopped operation, and room in `git.rs`

**Risky:** it changes the command every commit of every action runs: a wrong guard refuses Uraeda's
own commits, or lets one land on a detached `HEAD`.

**Files:**

- Create: `crates/core/src/git/worktrees.rs` (moved from `git.rs`), `crates/core/src/git/stopped.rs`
- Modify: `crates/core/src/git.rs` (module lines, `GitError::Refused`), `git/process.rs`
  (`git_write`), `git/commit.rs` (`commit_staged`), `actions/place.rs` (`reach` finds a branch being
  rebased)
- Test: `crates/core/tests/git_stopped.rs`; `crates/core/tests/common/repo.rs` (helpers)

**Interfaces:**

- Produces, in `git/process.rs`:
  `pub(crate) fn git_write(args: &[&str], dir: &Path, on_line: Option<&dyn Fn(&str)>) -> Result<Vec<u8>, Failure>`,
  running `git` with stdin null, `GIT_TERMINAL_PROMPT=0`, and `GIT_EDITOR=true`, streaming when
  `on_line` is given. Every write of tasks 3, 4, and 6 runs through it, mapped with
  `Failure::into_git(subcommand)`. `commit_staged` runs through it already, and `run_streaming`,
  which only the commit used, is gone (ruling R10).
- Produces, in `git.rs`: `GitError::Refused(String)`, displayed as its text alone.
- Produces, in `git/stopped.rs`: `pub enum StoppedKind { Pull, Merge, Stash }` and
  `pub struct Stopped { pub kind: StoppedKind, pub ours: String, pub theirs: String, pub stash: Option<String> }`,
  and `impl Git { pub fn stopped(&self) -> Option<Stopped> }`:
  - a rebase in progress is a `Pull`; `ours`, git's stage 2, is the branch rebased onto, as
    `origin/main`; `theirs`, stage 3, is the branch being replayed, `main` (read from
    `rebase-merge/head-name` or `rebase-apply/head-name`);
  - a merge (`MERGE_HEAD`) is a `Pull` when `MERGE_HEAD` is the current branch's `origin` tip, else
    a `Merge`; `ours` is the current branch, `theirs` the merged branch's name, from the local or
    `origin` branch whose tip is `MERGE_HEAD`, else its short id;
  - no operation but unmerged index entries is a `Stash`: a stash put back with conflicts; `ours` is
    the current branch, `theirs` is `"the stash"`, `stash` is `Some("stash@{0}")` when `refs/stash`
    exists, else `None`;
  - otherwise `None`.
- Produces, in `git/stopped.rs`: `impl Git { pub fn rebasing(&self) -> Option<String> }`, the branch
  a stopped rebase replays. `place::reach` takes a checkout rebasing a branch as holding it
  (`place::holder`, which `default_checkout` shares), so an action on `main` reaches the main
  checkout and is refused there before it writes, rather than failing on `git worktree add` (rulings
  R10, R15).
- Produces, in `git/stopped.rs`:
  `impl Git { pub fn ensure_not_stopped(&self) -> Result<(), GitError> }`, the one owner of the
  refusal: `GitError::Refused("A pull is stopped: continue or abort it first.")` when `stopped()` is
  a `Pull`, and `"A merge is stopped: continue or abort it first."` when a `Merge`. `place::reach`,
  `place::reach_switching`, the start's checks, `commit_staged` (as a backstop), the pull, the push,
  and the merge call it before running anything. Task 4's Continue runs `git rebase --continue` and
  `git merge --continue`, never `commit_staged`.
- Produces, in `tests/common/repo.rs`: `TestRepo::with_origin() -> TestRepo`, a repository whose
  `main` is pushed to a bare `origin` and tracks it;
  `TestRepo::upstream_commit(&self, path, text, msg)`, committing to `origin/main` through a second
  clone and fetching; `TestRepo::stopped_pull(&self)`, leaving a rebase stopped on one conflicting
  file `specs/PRIORITIES.md`. Tasks 2 to 6 use them.

- [x] **Step 1: Check the credentials from a process without a terminal**

- Run, in the main checkout: `setsid -w env GIT_TERMINAL_PROMPT=0 git fetch origin main </dev/null`
  and `setsid -w env GIT_TERMINAL_PROMPT=0 git push --dry-run origin main </dev/null`
- Expected: both exit 0. If either fails, stop: the build goes back to the human with a new round of
  questions, as the spec marks this unverified.

- [x] **Step 2: Move the worktree functions out of `git.rs`**

Structural only: `worktrees`, `worktree_records`, `add_worktree`, `add_worktree_new`,
`exclude_worktrees`, `prune_worktrees`, `remove_worktree`, and their types move to
`git/worktrees.rs`, re-exported as before. Run `nix develop -c vp run fast`: PASS, before and after.
Commit alone: `refactor(basic-git): move the worktree functions out of git.rs`.

- [x] **Step 3: Write the failing test, and the helpers it uses**

`a_stopped_pull_refuses_every_commit`: on `stopped_pull()`, `Git::stopped()` is a `Pull` with
`ours == "origin/main"` and `theirs == "main"`; then an inbox action that commits on `main`
(`api::add_to_inbox` or the action the inbox tests use) is refused with exactly "A pull is stopped:
continue or abort it first.", `git rev-parse HEAD` did not move, and `git status --porcelain` is
unchanged, also when the inbox already had a change. The break it catches: the guard reading gix's
`operation_in_progress`, which returns `None` for a rebase.
`a_stopped_merge_refuses_every_commit_and_a_stash_does_not` does the same on
`TestRepo::stopped_merge()` with the merge's text, and checks a stash put back with conflicts, its
stash dropped, refuses nothing and names no stash (ruling R15).

- [x] **Step 4: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test git_stopped`
- Expected: FAIL, `stopped` not found (it does not compile); once it exists, "git worktree failed:
  fatal: 'main' is already used by worktree", until `place::reach` takes the rebased branch as held;
  then the commit landing on the detached `HEAD` (`committed: true`).

- [x] **Step 5: Implement `git_write`, `GitError::Refused`, `Git::stopped`, and the guard**

As the interfaces say. `stopped` reads through gix (`Repository::state()`, the index's stages, the
rebase folder's `head-name` and `onto`), never through `git`.

- [x] **Step 6: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS, the existing commit tests included. Make the break (read the state through
  `operation_in_progress`), see the test fail, revert it, and say so in the commit body.

- [x] **Step 7: Commit**

```bash
git add crates/core specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): refuse commits while a pull or a merge is stopped"
```

## Task 2: The checkout's state and its diffs

**Files:**

- Create: `crates/core/src/git/checkout.rs`, `crates/core/src/git/diff.rs`
- Modify: `crates/core/src/git.rs` (module lines and re-exports only)
- Test: `crates/core/tests/git_checkout.rs`, `crates/core/tests/git_diff.rs`

**Interfaces:**

- Consumes: `Git::stopped`, `TestRepo::with_origin`, `upstream_commit`, `stopped_pull` (task 1).
- Produces, in `git/checkout.rs`:
  - `pub enum FileState { Modified, New, Deleted }` (untracked and added files are `New`);
    `pub enum Staged { No, Yes, Partly }`;
    `pub struct FileChange { pub path: String, pub state: FileState, pub staged: Staged, pub added: Option<u32>, pub removed: Option<u32> }`,
    the counts from `HEAD` to the working tree, `None` for a binary file;
  - `pub enum ConflictKind { BothChanged, BothAdded, DeletedOurs, DeletedTheirs, BothDeleted, AddedOurs, AddedTheirs }`
    (git's `UU AA DU UD DD AU UA`; `DeletedOurs` is deleted on `ours`, changed on `theirs`);
    `pub struct Conflict { pub path: String, pub kind: ConflictKind, pub is_binary: bool, pub is_resolved: bool }`,
    `is_resolved` when both sides have the file as text (`BothChanged`, `BothAdded`, not binary) and
    the working file has no line starting `<<<<<<< ` nor `>>>>>>> `, tested by
    `checkout::holds_markers`, `pub(crate)` for task 4; a binary or a delete conflict is never
    resolved by markers, only by taking a side whole (ruling R11);
  - `pub struct CheckoutState { pub branch: Option<String>, pub detached: Option<String>, pub has_remote: bool, pub ahead: u32, pub behind: u32, pub stopped: Option<Stopped>, pub files: Vec<FileChange>, pub conflicts: Vec<Conflict> }`,
    `branch` the branch checked out, or the one a stopped rebase replays; `detached` the 7-character
    id when `HEAD` is detached and nothing is stopped; `ahead` and `behind` against
    `origin/<branch>`, 0 without one; files sorted by path, conflicted files only in `conflicts`;
  - `impl Git { pub fn checkout_state(&self) -> Result<CheckoutState, GitError>; pub fn changed_count(&self) -> Result<u32, GitError> }`,
    the second counting changed and conflicted files without counting lines, for the sidebar.
- Produces, in `git/diff.rs`:
  - `pub const DIFF_CAP: usize = 1_000;`
  - `pub enum DiffOf { Worktree, Commit(ObjectId) }`;
  - `pub struct FileDiff { pub path: String, pub text: Option<String>, pub binary: Option<(u64, u64)>, pub added: u32, pub removed: u32, pub is_capped: bool }`:
    `text` is a unified diff with `--- a/` and `+++ b/` headers (`/dev/null` for a side without the
    file, as git writes it) and 3 lines of context, `None` for a binary file or a capped one;
    `binary` the sizes before and after in bytes; `is_capped` when the diff adds and removes more
    than `DIFF_CAP` lines and `whole` is false;
  - `pub struct CommitFiles { pub id: ObjectId, pub subject: String, pub body: String, pub authored: i64, pub files: Vec<ChangedFile> }`;
  - `impl Git { pub fn file_diff(&self, of: DiffOf, path: &str, whole: bool) -> Result<FileDiff, GitError>; pub fn commit_files(&self, id: ObjectId) -> Result<CommitFiles, GitError> }`:
    a working-tree diff goes from `HEAD` to the file on disk, staged or not, its path through
    `Git::checked` first; a commit's from its first parent, or from nothing for a root commit. A
    hunk's empty side starts at the line before, as git writes it: `@@ -0,0 +1,2 @@`.

- [x] **Step 1: Write the failing tests, and the helpers they use**

- `the_state_counts_commits_to_pull_and_to_push`: `with_origin`, 2 local commits, 3
  `upstream_commit`s: `ahead == 2`, `behind == 3`, `branch == Some("main")`, `has_remote`. Breaks:
  counting against the upstream config rather than `origin/main`; swapping the two walks.
- `the_state_lists_each_file_with_its_stage`, a row each: a modified file staged (`Yes`), the same
  file changed again (`Partly`), an untracked note (`New`, `No`), a deleted file (`Deleted`), a path
  `notes/a b ü.md`. Asserts each row picked out by path. Break: reading only the index, which misses
  untracked files.
- `a_conflict_names_its_sides_by_branch`, a row each: `stopped_pull` gives `Pull`, `ours`
  `origin/main`, `theirs` `main`, one `BothChanged` conflict, not resolved, and resolved once its
  markers are edited out; a merge of a branch `topic` gives `Merge`, `theirs` `topic`, its conflict
  in a binary file `is_binary`; a file deleted upstream and changed locally gives `DeletedOurs` in
  the rebase. Break: naming stage 2 "main" during a rebase.
- `a_stash_that_conflicts_lists_its_files_and_keeps_the_stash`: with `rebase.autoStash true` and an
  uncommitted edit to the line an upstream commit changes, `git pull --rebase`: `stopped` is `Stash`
  with `stash == Some("stash@{0}")`, the file is in `conflicts`, and `git stash list` still has it.
- `a_diff_is_unified_binary_or_capped`, a row each: `crates/core/src/git.rs` with 4 lines added and
  1 removed gives `added == 4`, `removed == 1`, a text with one `@@` hunk; a PNG of 12,288 bytes
  grown to 14,336 gives `binary == Some((12288, 14336))` and no text; a file of 3,000 new lines
  gives `is_capped`, `added == 3000`, no text, and with `whole` the text.
- `a_commit_lists_its_files_with_their_counts`: a commit changing two files lists both with their
  counts, and its subject; its file's diff is from its parent, not `HEAD`.
- Helpers, in `tests/common/repo.rs`: `write_bytes`, `try_git` (a git command that may stop), and
  `upstream_remove` (a deletion on `origin/main`).

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test git_checkout --test git_diff`
- Expected: FAIL, `checkout_state` not found.

- [x] **Step 3: Implement `checkout_state`, `changed_count`, `file_diff`, and `commit_files`**

Through gix: the status iterator (tree-to-index and index-to-worktree, untracked files listed), the
index's stages for conflicts, `behind` both ways, blob diffs with `gix-diff`'s unified output. The
line counts come from the same diff machinery as `file_diff`, without building the text. Paths are
the repository's bytes as UTF-8, never quoted.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates/core specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): read the checkout's files, conflicts, and diffs"
```

## Task 3: Fetch, pull, and push

**Risky:** a pull rewrites `main`, and a push publishes it: a wrong flag forces, or prompts forever.

**Files:**

- Create: `crates/core/src/git/remote.rs`
- Modify: `crates/core/src/git.rs` (module line)
- Test: `crates/core/tests/git_remote.rs`

**Interfaces:**

- Consumes: `process::git_write`, `GitError::Refused`, `TestRepo::with_origin`, `upstream_commit`
  (task 1).
- Produces, in `git/remote.rs`, `pull` and `push` refusing a detached `HEAD` with
  `GitError::Refused("main is not checked out: HEAD is detached.")` adapted to the default branch's
  name, and a stopped pull or merge with the commit's refusal ("A pull is stopped: continue or abort
  it first."), and each doing nothing without an `origin` remote (`fetch` returns `Ok`, `pull` and
  `push` refuse with `"There is no remote to pull from."` and `"There is no remote to push to."`);
  `fetch` runs on a detached `HEAD` (ruling R12):
  - `impl Git { pub fn fetch(&self, on_output: OnOutput) -> Result<(), GitError> }`:
    `git fetch --prune origin`;
  - `pub fn pull(&self, on_output: OnOutput) -> Result<(), GitError>`:
    `git pull --no-edit [--rebase] origin --end-of-options <branch>`, `--rebase` only when none of
    `pull.rebase`, `pull.ff`, and `branch.<branch>.rebase` is set (read through gix's
    configuration). A pull that stops on a conflict returns `Ok`: `stopped()` then shows it;
  - `pub fn push(&self, on_output: OnOutput) -> Result<(), GitError>`:
    `git push --porcelain origin --end-of-options <branch>`, never `--force` nor
    `--force-with-lease`; a rejected ref (`!` and `[rejected]` in the porcelain output, not a hook's
    `[remote rejected]`) is `GitError::Refused("origin has commits main lacks: pull first.")` with
    the branch's name.
  - A failure whose output holds `terminal prompts disabled`, `could not read Username`,
    `Authentication failed`, `Permission denied (publickey)`, or
    `Could not read from remote repository` keeps git's first line as its message, followed by " The
    server runs git without a terminal: give it a credential helper or an ssh-agent."

- [x] **Step 1: Write the failing tests**

- `a_pull_follows_the_configuration_and_rebases_by_default`, a row each, each starting from 2 local
  commits and 3 upstream ones: no configuration rebases (`ahead == 2`, no merge commit);
  `pull.rebase false` merges (a merge commit, `HEAD^2` the upstream tip); an uncommitted edit with
  `rebase.autoStash true` is put back, still changed; the same with it unset refuses with git's
  message and moves nothing; no `origin` refuses; a detached `HEAD` refuses; `main` with no upstream
  set pulls. Breaks: always passing `--rebase`, which ignores `pull.rebase false`; passing
  `--autostash`, which ignores the configuration.
- `a_push_never_forces`: after an upstream commit, a push is refused with exactly "origin has
  commits main lacks: pull first.", and `origin/main` on the bare remote is unchanged; after a pull,
  the push lands and `ahead == 0`. Break: retrying with `--force-with-lease`.
- `a_credential_failure_says_how_to_give_one`: `origin` set to a local HTTP server answering 401
  (`unauthorized_remote`), `core.askPass` empty: the fetch's error is exactly git's line, "fatal:
  could not read Username for '…': terminal prompts disabled", and the hint. Break: running without
  `GIT_TERMINAL_PROMPT=0`, which prompts at a terminal, or fails with another line without one.
- The rows also cover a pull that stops on a conflict (`Ok`, `stopped()` a `Pull`). Every test of
  `git_remote.rs` first calls `without_user_git_config()`, which keeps the machine's git
  configuration away from the core's git; `TestRepo::diverged()`, `count`, and `origin_rev` hold the
  setup (ruling R12).

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test git_remote`
- Expected: FAIL, `pull` not found.

- [x] **Step 3: Implement `fetch`, `pull`, and `push`**

As the interfaces say, through `git_write`.

- [x] **Step 4: Run the task's validation, and make the breaks**

- Run: `nix develop -c vp run fast`
- Expected: PASS. Make each break the tests name, see it fail, revert it, and report it in the
  commit body.

- [x] **Step 5: Commit**

```bash
git add crates/core specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): fetch, pull, and push the checked-out branch, never forced"
```

## Task 4: Staging, committing, discarding, merging, and resolving

**Risky:** discard and delete remove the human's work, and a merge or an abort rewrites `main`.

**Files:**

- Create: `crates/core/src/git/staging.rs`, `crates/core/src/git/resolve.rs`
- Modify: `crates/core/src/git.rs` (module lines), `crates/core/src/git/commit.rs` (`commit_index`)
- Test: `crates/core/tests/git_staging.rs`, `crates/core/tests/git_resolve.rs`

**Interfaces:**

- Consumes: `process::git_write`, `GitError::Refused`, `Git::stopped`, `stopped_pull` (task 1).
- Produces, each refusing a path that is absolute, holds a `..` component, or leaves the worktree,
  with `GitError::Refused("<path> is not in this checkout.")`, and passing paths after `--`:
  - in `git/staging.rs`:
    `impl Git { pub fn stage_paths(&self, paths: &[String]) -> Result<(), GitError>; pub fn unstage_paths(&self, paths: &[String]) -> Result<(), GitError>; pub fn discard_path(&self, path: &str) -> Result<(), GitError> }`.
    `stage_paths` is `git add --all -- paths`, so a deleted file stages its deletion. `discard_path`
    makes the file as it is in `HEAD`, from the index and the working tree; a file `HEAD` lacks is
    removed from the index and deleted. A folder is refused, "<path> is a folder: discard its files
    one by one.", and so is a conflicted file, "<path> conflicts: take a side.". It never runs
    `git clean`, nor any `--force`;
  - in `git/commit.rs`:
    `pub fn commit_index(&self, message: &str, on_output: OnOutput) -> Result<ObjectId, GitError>`,
    committing what is staged through `commit_staged` (hooks and signing as configured), refusing an
    empty message with `"Write a commit message first."` and an empty index with
    `"Nothing is staged."`; the files stay staged when a hook refuses;
  - in `git/resolve.rs`: `pub enum Resolution { Ours, Theirs, Delete }`;
    `impl Git { pub fn resolve_conflict(&self, path: &str, resolution: Resolution) -> Result<(), GitError>; pub fn continue_stopped(&self, on_output: OnOutput) -> Result<(), GitError>; pub fn abort_stopped(&self, on_output: OnOutput) -> Result<(), GitError>; pub fn merge_branch(&self, branch: &str, on_output: OnOutput) -> Result<(), GitError> }`:
    - `resolve_conflict` (`Git::resolve` already names a revision's commit, ruling R13) refuses a
      path that is not conflicted with "<path> has no conflict."; `Ours` and `Theirs` take git's
      stage 2 or 3 whole (a side that deleted the file deletes it), then stage it; `Delete` removes
      it;
    - `continue_stopped` stages each conflicted file that `is_resolved`, refuses with "1 file still
      conflicts." or "N files still conflict." when one is not, then runs `git rebase --continue` or
      `git merge --continue`; a stash's stop only stages the resolved files, keeping the stash; a
      continue that stops on the next conflict returns `Ok`;
    - `abort_stopped` runs `git rebase --abort` or `git merge --abort`, which puts an autostash
      back; a stash's stop has no abort, and refuses; with nothing stopped, both refuse;
    - `merge_branch` runs `git merge --no-edit --end-of-options <branch>`, refused as a commit is
      while a pull or a merge is stopped, and on a detached `HEAD` as a pull is; a merge that stops
      on a conflict returns `Ok`.

- [x] **Step 1: Write the failing tests**

- `staging_moves_only_the_named_files`: two changed files, staging one leaves the other unstaged;
  staging a folder's two files stages both; unstaging all leaves none staged; `notes/a b ü.md`
  stages; `../outside` and `/etc/passwd` are refused and nothing changed. Break: `git add -A`
  without the paths.
- `a_commit_holds_the_staged_files_through_the_hooks`: `specs/INBOX.md` staged and `docs/web-ui.md`
  not: the commit "chore: notes" holds `specs/INBOX.md` alone, and the hook ran once; a refusing
  hook leaves `specs/INBOX.md` staged and no commit; an empty index is refused. Break:
  `--no-verify`, or `git commit -a`.
- `discard_restores_one_file_as_git_does`, a row each: a changed file staged and changed again is as
  in `HEAD`; an untracked note is deleted; a staged new file is unstaged and deleted; the other
  changed file is untouched in every row. Break: `git checkout -- .`.
- `a_stopped_pull_continues_once_resolved_or_aborts`, a sequence: `stopped_pull`; Continue refuses
  with "1 file still conflicts."; `resolve_conflict(Theirs)` takes `main`'s text; Continue lands,
  nothing is stopped, `ahead` counts the replayed commit. A second repository: `stopped_pull` with
  an autostashed edit, `resolve_conflict(Ours)` takes `origin/main`'s text, then `abort_stopped`:
  `HEAD` is the pull's starting commit and the edit is back. (Theirs comes first: taking
  `origin/main` whole leaves the replayed commit empty, which git drops, so nothing is ahead.)
  Break: `git add` of every conflicted file before checking for markers.
- `merge_brings_a_branch_into_main`: a branch `2026-11-04-vim-mode` merges and `ahead == 1` more
  than before; a branch named `-x` merges as a branch, not an option; a conflicting branch stops as
  `Merge`, with `Ok`. Break: dropping `--end-of-options`.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test git_staging --test git_resolve`
- Expected: FAIL, `stage_paths` not found.

- [x] **Step 3: Implement the writes**

As the interfaces say, through `git_write`. `is_resolved` comes from task 2's reading of a conflict;
until task 2 merges, read the markers with the same one-line test in a private helper of
`resolve.rs`, to be replaced by task 2's at the wave's merge (see ruling R4).

- [x] **Step 4: Run the task's validation, and make the breaks**

- Run: `nix develop -c vp run fast`
- Expected: PASS. Make each break, see it fail, revert it, report it in the commit body.

- [x] **Step 5: Commit**

```bash
git add crates/core specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): stage, commit, discard, merge, and resolve conflicts"
```

## Task 5: The page's views, and the binding's reads

**Files:**

- Create: `crates/core/src/api/git_page.rs`, its views in `api/git_page/views.rs`,
  `crates/binding/src/git_reads.rs`
- Modify: `crates/core/src/api.rs` (re-exports), `crates/core/src/git/history.rs` (`history_page`),
  `crates/core/src/git/staging.rs` (`checked` made `pub(crate)`), `crates/core/src/view/feature.rs`
  (`feature_title`, shared with the groups' names), `crates/core/src/watch.rs` (`Changes::git`),
  `crates/binding/src/lib.rs` (module line), `packages/binding/index.d.ts` and `index.js`
  (generated), the server's `Changes` literals (`git: false`)
- Test: `crates/core/tests/git_page.rs`, `staging_a_file_reports_git` in
  `crates/core/tests/watch.rs`

**Interfaces:**

- Consumes: `checkout_state`, `changed_count`, `file_diff`, `commit_files` (task 2).
- Produces, in `git/history.rs`:
  `pub fn history_page(&self, after: Option<ObjectId>, count: usize) -> Result<Vec<(CommitInfo, Mark)>, GitError>`
  with `pub enum Mark { None, ToPull, ToPush }`: the checked-out branch's commits and those of its
  `origin` branch it lacks, newest first, `ToPull` for those only on `origin`, `ToPush` for those
  only local: the `ToPull` run first, then `HEAD`'s walk, each newest first; no marks without an
  `origin` branch.
- Produces, in `api/git_page.rs`, every struct a napi object with camelCase fields:
  - `GitPageView { id: String /* "git" */, branch: Option<String>, detached: Option<String>, has_remote: bool, ahead: u32, behind: u32, fetched_at: Option<i64> /* seconds */, stopped: Option<StoppedView>, groups: Vec<ChangeGroupView>, conflicts: Vec<ConflictView>, history: Vec<CommitRowView>, has_more_history: bool, worktrees: Vec<WorktreeView>, branches: Vec<String> }`;
  - `StoppedView { kind: String /* "pull" | "merge" | "stash" */, ours: String, theirs: String, stash: Option<String> }`;
  - `ChangeGroupView { folder: Option<String> /* None: the main checkout */, name: String /* the main checkout's branch, else its detached id, or the feature's title */, files: Vec<FileChangeView> }`,
    the main checkout's group first and always there, then one per feature worktree with changes;
  - `FileChangeView { path: String, state: String /* "modified" | "new" | "deleted" */, staged: String /* "no" | "yes" | "partly" */, added: Option<u32>, removed: Option<u32> }`;
  - `ConflictView { path: String, kind: String /* "both-changed" | "both-added" | "deleted-ours" | "deleted-theirs" | "both-deleted" | "added-ours" | "added-theirs" */, is_binary: bool, is_resolved: bool }`;
  - `CommitRowView { id: String, short: String, subject: String, authored: i64, mark: String /* "" | "pull" | "push" */ }`;
  - `WorktreeView { path: String /* from the main checkout's root */, name: String, branch: Option<String>, folder: Option<String>, state: String /* "merged" | "changes" | "missing" | "locked" | "clean" */ }`,
    the linked worktrees only, sorted by path, the first state that holds in that order, `merged`
    for a feature whose step is `Done` (matched by its branch or its `left_branch`);
  - `GitSummaryView { id: String /* "git" */, changes: u32, behind: u32 }`, `changes` summed over
    every group;
  - `GitDiffView { id: String, path: String, text: Option<String>, binary_before: Option<f64>, binary_after: Option<f64>, added: u32, removed: u32, is_capped: bool }`;
  - `GitCommitView { id: String, subject: String, body: String, authored: i64, files: Vec<ChangedFile> }`;
  - `GitHistoryPageView { id: String /* the commit it continues after */, commits: Vec<CommitRowView>, has_more: bool }`;
  - `ConflictFileView { id: String /* the path */, path: String, text: String, hash: String }`;
  - `pub fn git_page(repo: &Path) -> Result<GitPageView>`,
    `git_summary(repo) -> Result<GitSummaryView>`,
    `git_diff(repo, at: &GitAt, path: &str, whole: bool) -> Result<GitDiffView>` with
    `GitAt { folder: Option<String>, commit: Option<String> }` (both `None`: the main checkout's
    working tree), `git_commit(repo, id: &str) -> Result<GitCommitView>`,
    `git_history(repo, after: &str) -> Result<GitHistoryPageView>` (pages of 50, `after` a commit
    id; the page view's first page too),
    `conflict_file(repo, path: &str) -> Result<ConflictFileView>` (refused for a file that is not
    conflicted, or binary).
  - `pub(crate) fn group_root(git: &Git, workspace: &Workspace, folder: Option<&str>) -> Result<PathBuf>`:
    the main checkout for `None`, a feature's worktree for its folder, refused otherwise. Task 6's
    writes use it as `super::git_page::group_root`; `git_diff` uses it too.
- Produces, in `watch.rs`: `Changes::git: bool`, true when `HEAD`, the index, `FETCH_HEAD`, or a
  stopped operation of the main checkout or a worktree changed.
- Produces, in the binding: `gitPage(repo)`, `gitSummary(repo)`, `gitDiff(repo, at, path, whole)`,
  `gitCommit(repo, id)`, `gitHistory(repo, after)`, `conflictFile(repo, path)`, each a promise of
  its view.

- [x] **Step 1: Write the failing tests**

- `the_history_marks_commits_to_pull_and_to_push`: 2 local, 3 upstream commits: the first page's
  first 3 rows are `pull`, the next 2 `push`, newest first in each. Break: walking `HEAD` alone.
- `the_page_groups_changes_and_lists_worktrees`: the fixture repository with a feature worktree
  whose `proposal.md` was saved, a hand-made worktree `.worktrees/coherence-before`, and one whose
  folder was deleted: groups are the main checkout's then one named by the feature's title with
  `proposal.md`; the worktrees read `changes`, `clean`, and `missing`. Break: listing every worktree
  as a group.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test git_page`
- Expected: FAIL, `git_page` not found.

- [x] **Step 3: Implement the views, `history_page`, `Changes::git`, and the binding's reads**

The page's view reads `checkout_state` of the main checkout and of each feature worktree with local
changes (`has_local_changes` first, so clean ones cost one stop of the status). Then regenerate the
binding: `nix develop -c vp run --filter uraeda-binding build`.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates packages/binding specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): the Git page's views"
```

## Task 6: The page's writes, and the binding's writes

**Risky:** these are the entry points the web reaches: a path they let through is a file anyone
signed in can overwrite or delete.

**Files:**

- Create: `crates/core/src/api/git_writes.rs`, `crates/binding/src/git_writes.rs`
- Modify: `crates/core/src/api.rs` (re-exports), `crates/core/src/api/error.rs` (a commit's hook
  output, `commit_error`), `crates/core/src/git/staging.rs` (`Git::checked` made `pub(crate)`),
  `crates/core/src/actions/clean.rs` (`relative` made `pub(crate)`), `crates/binding/src/lib.rs`
  (module line), `packages/binding/index.d.ts` and `index.js` (generated)
- Test: `crates/core/tests/git_writes.rs`

**Interfaces:**

- Consumes: tasks 3 and 4's writes, `actions::clean::clean`, `Git::remove_worktree`,
  `prune_worktrees`.
- Produces, in `api/git_writes.rs`, each under `write_lock(repo)`, each acting on the group's root
  (task 5's `group_root`), the remote writes on the main checkout only:
  - `git_fetch(repo, on_output) -> Result<()>`, `git_pull`, `git_push`,
    `git_merge(repo, branch: &str, on_output)`, `git_continue(repo, on_output)`,
    `git_abort(repo, on_output)`;
  - `git_stage(repo, folder: Option<&str>, paths: &[String]) -> Result<()>`, `git_unstage`,
    `git_discard(repo, folder, path: &str)`;
  - `git_commit_staged(repo, folder, message: &str, on_output) -> Result<CommitView>`: a hook's
    refusal is `ApiError{code: "hook", output: Some(..)}`, as the existing commits' are;
  - `git_resolve(repo, path: &str, resolution: &str /* "ours" | "theirs" | "delete" */) -> Result<()>`;
  - `save_conflict_file(repo, path: &str, text: &str, hash: &str) -> Result<ConflictFileView>`:
    refused unless `path` passes `Git::checked` and is conflicted in the main checkout, not binary,
    and not a symbolic link; `"conflict"` when the file changed since `hash`; never stages;
    `ConflictFileView` is task 5's;
  - `git_remove_worktree(repo, path: &str) -> Result<()>`: only a path `worktree_records` lists,
    matched by its path from the main checkout's root (`clean::relative`), never the main checkout;
    a missing one prunes; one with changes is refused, "<path> has changes: commit or discard them
    first.", never forced; its branch stays;
  - `clean_feature(repo, folder: &str) -> Result<()>`: `actions::clean::clean` on the feature, not a
    dry run; refused, after what it could do, with what stays and why, when something stays.
- Produces, in the binding: `gitFetch(repo, onOutput)`, `gitPull`, `gitPush`,
  `gitMerge(repo, branch, onOutput)`, `gitContinue`, `gitAbort`, `gitStage(repo, folder, paths)`,
  `gitUnstage`, `gitDiscard(repo, folder, path)`,
  `gitCommitStaged(repo, folder, message, onOutput)`, `gitResolve(repo, path, resolution)`,
  `saveConflictFile(repo, path, text, hash)`, `gitRemoveWorktree(repo, path)`,
  `cleanFeature(repo, folder)`; `folder` is `string | null`, `onOutput` `(line: string) => void`.

- [x] **Step 1: Write the failing test**

`the_page_writes_only_what_it_lists`, a row each: `save_conflict_file` of a file that is not
conflicted, and of `../x`, is refused and writes nothing; `git_stage` of `/etc/passwd` is refused;
`git_remove_worktree` of the main checkout's path, and of a folder that is no worktree, is refused;
of a worktree with changes is refused and the folder stays; of `.worktrees/coherence-before` removes
the folder and keeps its branch; of a missing one prunes its record; `git_stage` with an unknown
folder is refused; `clean_feature` of a merged feature removes its worktree and branch; a commit a
hook refuses is `hook` with its output, the file still staged; in a stopped merge, a save over a
stale hash is `conflict` and writes nothing, and one over the read hash writes the text. Breaks:
`save_conflict_file` writing any path; `--force` on removal; a commit's failure mapped as any git
error.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test git_writes`
- Expected: FAIL, `save_conflict_file` not found.

- [x] **Step 3: Implement the writes and the binding's writes**

The streaming writes pass a `ThreadsafeFunction<String, ...>` as `land` does. Regenerate the
binding: `nix develop -c vp run --filter uraeda-binding build`.

- [x] **Step 4: Run the task's validation, and make the breaks**

- Run: `nix develop -c vp run fast`
- Expected: PASS. Make each break, see it fail, revert it, report it in the commit body.

- [x] **Step 5: Commit**

```bash
git add crates packages/binding specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): the Git page's writes"
```

## Task 7: The server's views, writes, and checkout guard

**Risky:** it owns the rule that keeps the page from writing under a working agent.

**Files:**

- Create: `packages/server/src/fate/views-git.ts`, `packages/server/src/fate/git-mutations.ts`,
  `packages/server/src/fate/git-guard.ts`
- Modify: `packages/server/src/fate/sources.ts`, `fate.ts` (`Root` and exports),
  `fate/mutations.ts`, `packages/server/src/live.ts` (`publish`, `publishGit`),
  `packages/server/src/runner/sessions.ts` (`chatWorking`), `packages/server/src/writes/queue.ts`
  (`background`), `packages/server/src/__tests__/request-fixture.ts` (the new views),
  `__tests__/live.test.ts` (a turn's state change sends the Git page)
- Test: `packages/server/src/__tests__/git-page.test.ts`

**Interfaces:**

- Consumes: the binding's reads and writes (tasks 5 and 6).
- Produces, in `views-git.ts`: data views and sources for `GitPage`, `GitSummary`, `GitDiff`,
  `GitCommit`, `GitHistoryPage`, `ConflictFile`, exported from `fate.ts` with their entity types and
  `GIT_ID = "git"`. `GitPage`'s record is the core's view plus `agentWorking: boolean` (a chat works
  in the main checkout) and, on each group, `isWorking: boolean` (its feature's agent works), its
  `folder` null for the main checkout; the records' top-level optional fields are sent as null. A
  `GitDiff` id is `JSON.stringify([folder ?? null, commit ?? null, path, whole])`, made by
  `gitDiffId(folder, commit, path, whole)`, exported from `fate.ts`.
- Produces, in `runner/sessions.ts`: `chatWorking(repo: string): boolean`, whether a session with
  `folder === null` has a turn running, starting, or queued.
- Produces, in `git-guard.ts`:
  `checkoutWritable(ctx: RepoContext, folder: string | null): Promise<void>`, throwing
  `callSiteError("refused: An agent works in this checkout: wait for its turn to end.")` for the
  main checkout while `chatWorking`, and calling `writable(ctx, {folder})` for a feature's.
- Produces, in `writes/queue.ts`: `background(land: Land): Promise<unknown>`, landed in turn with
  the record's writes, never in `writes()`.
- Produces, in `git-mutations.ts`, each returning the `GitPage` view, each guarded, each a write of
  the queue labelled by its `write` input (`writeHere(...)` on the web), with its output streamed,
  answering once it lands: `git.pull`, `git.push`, `git.merge {branch}`, `git.continue`,
  `git.abort`, `git.fetch {quiet?: boolean}` (quiet: in `queue.background`, without a toast; task 8
  makes it join the fetcher), `git.stage {folder, paths}`, `git.unstage {folder, paths}`,
  `git.discard {folder, path}`, `git.commit {folder, message}`, `git.resolve {path, resolution}`,
  `git.removeWorktree {path}`, `git.clean {folder}`. Keys: `["git"]` for the main checkout,
  `featureKeys(folder)` for a group. A refusal stays in the queue's record and answers the call.
  `git.saveConflict {path, text, hash}` answers the `ConflictFile` with its new hash, through
  `landed`, its refusal leaving the record. The quiet `git.fetch` is not guarded;
  `git.removeWorktree` is guarded as the main checkout's and as its feature's; `git.clean` as both
  (R20).
- Produces: after each landed or refused git write, after `changes.git` from the watcher, and when a
  session's turn starts or ends (a change with a `state`, in `sessionPublisher`), `live.update` of
  `GitPage` and `GitSummary` at `GIT_ID`, by `publishGit(bus)` in `live.ts`.

- [x] **Step 1: Write the failing tests**

- `the page refuses its writes while a chat works in the checkout`: a chat's turn running on the
  fake agent: `GitPage`'s `agentWorking` is true, and `git.pull`, `git.stage`, `git.commit` each
  answer
  `{code: "BAD_REQUEST", message: "refused: An agent works in this checkout: wait for its turn to end."}`,
  the index unchanged; once the turn is stopped, `git.stage` lands. A feature's agent working
  refuses its group's `git.stage` with the existing `REFUSALS.working` text, and not the main
  checkout's. Break: guarding with `busy`, which a feature's agent also makes true.
- `a pull lands in the queue with its output`: with a bare `origin` one commit ahead, `git.pull`
  with `write: {href: "/git", label: "Pulling"}` lands, its output lines reach the queue's record
  while it runs, and `GitPage`'s `behind` is then 0; a commit refused by `heldHook` stays in the
  queue as `failure: "hook"` with its output.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/__tests__/git-page.test.ts`
- Expected: FAIL, the source `GitPage` unknown.

- [x] **Step 3: Implement the views, the guard, the mutations, and the live updates**

- [x] **Step 4: Run the task's validation, and make the break**

- Run: `nix develop -c vp run fast`
- Expected: PASS. Make the break, see it fail, revert it, report it in the commit body.

- [x] **Step 5: Commit**

```bash
git add packages/server specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): serve the Git page, its writes, and its guard"
```

## Task 8: The fetcher

**Files:**

- Create: `packages/server/src/git-fetch.ts`
- Modify: `packages/server/src/repositories.ts` (`Hosts` start and stop),
  `packages/server/src/fate/views-git.ts` (`fetchFailure`), `fate/git-mutations.ts` (`git.fetch`)
- Test: `packages/server/src/__tests__/git-fetch.test.ts`

**Interfaces:**

- Consumes: `WriteQueue.background`, the `GitPage` source (task 7), `binding.gitFetch`.
- Produces: `FETCH_EVERY_MS = 300_000`;
  `startFetcher(path: string, binding: Binding, queue: WriteQueue, changed: () => void): Fetcher`
  with
  `Fetcher = { now(): Promise<void>; failure(): string | undefined; settle(error?: unknown): void; stop(): void }`:
  fetches at once and every 5 minutes, in `queue.background`, one at a time (a call while one runs
  joins it), keeping the last failure's message until a fetch succeeds, calling `changed` when the
  failure changed (what a fetch brings reaches the page through the watcher's `git` change);
  `settle` keeps a loud fetch's outcome. Started per repository in `Hosts` as `startPullRequests`
  is, as `Host.fetcher`, stopped with it (R21).
- Produces: `GitPage`'s `fetchFailure: string | null`; the quiet `git.fetch` of task 7 now runs
  `fetcher.now()` and answers the page, its failure in `fetchFailure`, never as an error; a loud one
  stays a queued write with its toast, and its outcome also sets or clears the failure.

- [x] **Step 1: Write the failing test**

`the fetcher fetches every 5 minutes, outside the toast`, with fake timers on `setInterval`: a bare
`origin` gains a commit; after `FETCH_EVERY_MS`, `GitSummary`'s `behind` is 1 and the queue's
`writes()` stayed empty throughout; with `origin` pointing at a missing folder, the next fetch
leaves `fetchFailure` set and `writes()` empty, and a queued `git.stage` still lands; `origin`
restored, the next fetch clears `fetchFailure`. Break: enqueueing the fetch as a record's write.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test packages/server/src/__tests__/git-fetch.test.ts`
- Expected: FAIL, `GitSummary`'s `behind` still 0, as no fetcher runs.

- [x] **Step 3: Implement the fetcher**

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): fetch on the page's open and every 5 minutes"
```

## Task 9: The Git page

**Files:**

- Start from: `packages/web/src/GitMockups.stories.tsx` (`Behind`, `Sections`, `AgentWorking`,
  `PullRefused`, `CleanAsked`)
- Create: `packages/web/src/git/GitPage.tsx`, `git/Sync.tsx`, `git/ChangesTree.tsx`, `git/tree.ts`,
  `git/CommitField.tsx`, `git/Diff.tsx`, `git/History.tsx`, `git/Worktrees.tsx`,
  `git/MergePicker.tsx`, `git/address.ts`, `git/useGitWrites.ts`, `git/useGitKeys.ts`,
  `git/GitPage.stories.tsx` (the page's named states, over the real server's fixture)
- Modify: `packages/web/src/views.ts`, `data.ts` (`useGitPage`, `useGitSummary`, the views),
  `routeTable.ts` (`{page: "git"}` at `/git`), `pages.ts`, `App.tsx` (the route),
  `lists/useListKeys.ts` (rows found by their checkbox too), `writes/labels.ts` (the writes' labels)
- Test: `packages/web/src/__tests__/git-page.test.tsx`

**Interfaces:**

- Consumes: the server's views and mutations (task 7; task 8's `fetchFailure` read as optional).
- Produces: `GitPage()` at `/git`; the picked row in the address,
  `/git?file=<path>[&folder=<folder>]`, `/git?commit=<id>[&file=<path>]`, `/git?conflict=<path>`,
  parsed and written by `git/address.ts` (`gitAddress(picked)`, `pickedOf(search)`). On wide screens
  the picked row's diff is the `Panes` detail; on the phone, the picked row is its own page.
- Produces, in `git/tree.ts`:
  `buildTree(files: ReadonlyArray<FileChange>, folded: ReadonlySet<string>): ReadonlyArray<TreeRow>`
  with
  `TreeRow = { path: string; name: string; depth: number; folder: boolean; isOpen: boolean; staged: boolean | "indeterminate"; added: number; removed: number; paths: ReadonlyArray<string>; file?: FileChange }`:
  folders before files, a single-child chain of folders as one row named `crates/core/src`, a
  folder's counts summed and its box ticked, empty, or mixed from its files, `paths` the files a
  Space on it stages. Task 10 does not use it.
- Produces, in `git/useGitWrites.ts`: `useGitWrites()` returning the page's writes, each a
  `fate.mutations.git.*` call with `write: writeHere(label)`, clearing the refusal first, the
  refusal shown by `RefusedHere` next to the section it concerns. Task 10 adds its writes beside
  them, in its own hook.
- Keys, in `git/useGitKeys.ts`, through `useKeys`: `p`, `P`, `f`, `a`, `c`, `d`, `M`, Enter, as the
  global constraints say; `m` is task 10's. Space is the checkbox's own; rows are found by
  `useListKeys` through `[data-row] input[type="checkbox"]` as well as its links, so `j`/`k` move
  over the tree, the history, and the worktrees.
- The commit field: the shared editor through `useTextField("git:<folder or main>#message", "")`,
  marked unsaved, dropped once its commit lands and kept on a refusal, as
  `commit/usePaneWrites.ts`'s `landing` does today; `mod+Enter` in it commits.
- On open, the page calls `git.fetch {quiet: true}`.

- [ ] **Step 1: Build the page from the stories**

From the mockups' components, over `useGitPage()`: the title's line (global constraints), the
banners (agent working, a refusal, a fetch failure with its message), Changes per group with its
Commit, History with "Show more" over `GitHistoryPage`, Worktrees with Clean and Remove asking first
(the mockup's `'Clean "Master" PR?'`, Keep and Clean; Remove: "Remove <path>?", Keep and Remove),
the diff detail through `CodeBlock isDiff` with the binary and capped texts, "Merge into main…"
opening a popover of `branches` (a sheet on the phone). Every write disabled while `agentWorking`,
or its group `isWorking`.

- [ ] **Step 2: Write the tests**

- `Space on a file row stages it, and the row keeps its place`: the fixture with `specs/INBOX.md`
  and `docs/web-ui.md` changed; focus `specs/INBOX.md`'s box, press Space: once the write lands,
  `git diff --cached --name-only` is `specs/INBOX.md`, and the rows' order is unchanged.
- `a typed message stays once its commit is refused, and goes once it lands`: rewritten from
  `commit-toast.test.tsx`'s two message tests on `/git`, with `refusingHook`.
- `discard asks first, and only Discard restores the file`: `d` on `docs/web-ui.md` asks "Discard
  the changes to docs/web-ui.md?"; Keep leaves it changed; Discard restores it.

- [ ] **Step 3: Run them**

- Run: `nix develop -c vp test packages/web/src/__tests__/git-page.test.tsx`
- Expected: PASS

- [ ] **Step 4: Review the page in the sandbox**

`nix develop -c vp run sandbox`: both themes, at 375 px and 1440 px.

- [ ] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): the Git page"
```

## Task 10: Conflicts in the page and the shared editor

**Files:**

- Start from: `packages/web/src/GitMockups.stories.tsx` (`Conflict`)
- Create: `packages/web/src/fields/editor/conflicts.ts`, `fields/editor/conflictBar.ts`,
  `packages/web/src/git/Conflicts.tsx`, `git/ConflictEditor.tsx`, `git/useConflictWrites.ts`
- Modify: `packages/web/src/fields/editor/Editor.tsx` (`extensions` prop),
  `packages/web/src/git/GitPage.tsx` (the section, the banner, the detail, `m`)
- Test: `packages/web/src/fields/editor/conflicts.test.ts`

**Interfaces:**

- Consumes: `GitPage`'s `stopped` and `conflicts`, `ConflictFile`, `git.resolve`,
  `git.saveConflict`, `git.continue`, `git.abort` (task 7).
- Produces, in `conflicts.ts`: `conflictsIn(text: string): ReadonlyArray<ConflictBlock>` with
  `ConflictBlock = { from: number; to: number; ours: string; theirs: string }` (offsets of the
  block's first marker and the end of its last, the base section of `diff3` dropped), and
  `resolveBlock(text: string, block: ConflictBlock, choice: "ours" | "theirs" | "both"): string`,
  keeping the file's line endings.
- Produces: `Editor`'s `extensions?: ReadonlyArray<Extension>`, added after its own;
  `conflictBar(labels: { ours: string; theirs: string }): Extension`, a bar over each block with
  "Use <ours>", "Use <theirs>", "Use both", each replacing the block in the editor's text, unsaved
  until the human saves.
- The section: Conflicts lists each file with its kind in words ("both changed", "deleted on
  origin/main, changed on main"), its whole sides ("Use origin/main", "Use main", or "Keep the file"
  and "Delete the file"), and opens a text file in the editor at `/git?conflict=<path>`. The banner
  reads "The pull stopped: N file(s) conflict(s)." or "The merge stopped: ...", with Abort (asking
  "Abort the pull? The resolved files go back as they were." once a file is resolved) and Continue.
  `m` opens Continue and Abort as a menu. A stash's stop reads that the pull's stash could not be
  put back, naming it, without Abort.

- [ ] **Step 1: Write the failing test**

`each choice resolves its block`, a table: ours, theirs, both, on a `merge`-style block; a `diff3`
block with its base; two blocks, resolving the second; CRLF lines; a file with no block gives none.
Break: dropping the line ending of the block's last line.

- [ ] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test packages/web/src/fields/editor/conflicts.test.ts`
- Expected: FAIL, `conflictsIn` not found.

- [ ] **Step 3: Implement the parser, the bar, the section, and the editor's page**

- [ ] **Step 4: Review in the sandbox**, both themes, 375 px and 1440 px, on the sample's conflict
      once task 12 adds it, or on a stopped pull made by hand in `.sandbox/`.

- [ ] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): fix conflicts in the Git page and the shared editor"
```

## Task 11: The page's place, and the Commit page's removal

**Files:**

- Modify: `packages/web/src/destinations.ts` (`git` in place of `commit`), `keys/leaderTree.ts`
  (`goGitBindings`: `space g` and `g c`), `keys/LeaderKeys.tsx`, `routeTable.ts` (`/commit` as
  `{page: "moved", path: "/git"}`), `App.tsx`, `shell/ColumnPanes.tsx` (`GitAction`),
  `shell/Tabs.tsx` (`GitTab`), `writes/RefusedHere.tsx` and `writes/CommitToast.tsx` (`/git`),
  `data.ts` (`rereadChanges`)
- Delete: `packages/web/src/CommitPage.tsx`, `packages/web/src/commit/`,
  `packages/server/src/fate/commit-mutations.ts`, the `CommitPanes` view and source,
  `crates/core/src/api/commit_panes.rs`, `crates/core/src/actions/changes/panes.rs` if nothing else
  calls it, the binding's `commitPanes`, `commitBranch`, `discardBranch`
- Test: rewrite `keys-leader-tree.test.tsx`'s two SC-007 tests and `phone-tabs.test.tsx`; delete the
  tests the spec's Replaced behaviour lists

**Interfaces:**

- Consumes: `GitSummary` (task 7), `GitPage()` (task 9).
- Produces: `DESTINATIONS.git = { icon: "git-branch", label: "Git", path: "/git" }`; the sidebar's
  `GitAction` always shown, "Git", "Git · 3", "Git · ↓3", or "Git · 3 · ↓3"; the phone's `GitTab`
  while `changes + behind > 0`.

- [ ] **Step 1: Rewrite the tests of the places**

SC-007's two tests list Git among the places, by `space g`; `/commit` leads to `/git`; the phone's
tabs fit 375 px with the Git tab showing. Delete `branch_commits.rs`'s tests named under the spec's
Replaced behaviour, `commit-toast.test.tsx`'s three `/commit` tests (task 9 rewrote two), and the
server's tests of `changes.commit` and `changes.discard` (ruling R6).

- [ ] **Step 2: Move the place, and remove the Commit page and its panes**

- [ ] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A crates packages specs/2026-11-04-basic-git/plan.md specs/2026-11-04-basic-git/rulings.md
git commit -m "feat(basic-git): the Git page replaces the Commit page"
```

## Task 12: The sandbox, the documentation, and the benchmark

**Files:**

- Modify: `packages/web/samples/projects.ts` (the sample project's `origin`), `docs/web-ui.md`
  ("Committing" becomes the Git page's section), `README.md` if it names the Commit page
- Test: `crates/core/tests/git_page.rs` (`bench_git_page_on_uraedas_repository`)

**Interfaces:**

- Consumes: everything above.

- [ ] **Step 1: Give the sample project a remote**

A bare `origin` beside it under `.sandbox/projects/`, with the sample's `main` pushed, then one
commit on `origin` that local `main` lacks, and one local chore changing the same line of
`specs/PRIORITIES.md`, so a pull stops on a conflict; a second clone does the upstream commit.

- [ ] **Step 2: Write the benchmark**

`bench_git_page_on_uraedas_repository`, ignored, run by `vp run bench`: `api::git_page` on
`common::repository_path()`, its mean under 100 ms.

- [ ] **Step 3: Update the documentation**

- [ ] **Step 4: Run the benchmark and the complete validation**

- Run: `nix develop -c vp run bench` and `nix develop -c vp run ready`
- Expected: PASS, the benchmark's mean printed under 100 ms.

- [ ] **Step 5: Commit**

```bash
git add packages/web/samples docs README.md crates/core/tests specs/2026-11-04-basic-git/plan.md
git commit -m "feat(basic-git): the sandbox's remote, the documentation, and the benchmark"
```
