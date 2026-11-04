# Rulings: Basic git UI in the web UI

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The credentials were checked while planning

- **Decision**: the spec's unverified credentials were checked before the plan, from a process with
  no terminal: `git fetch origin main` and `git push --dry-run origin main` both succeeded on this
  repository, whose `origin` is HTTPS with `gh auth git-credential` as its helper. Task 1 runs the
  same check again before any code.
- **Rationale**: the plan's tasks all rely on it, and the check changes nothing.
- **If wrong**: on another machine, with ssh and no agent, the page shows git's message and the
  credential hint, as the spec asks.
- **Where**: task 1.

## R2: A file's diff goes from `HEAD` to the working tree

- **Decision**: a changed file's diff shows its whole change, staged or not, from `HEAD` to the file
  on disk.
- **Rationale**: the page stages whole files, and keeps a staged file in place with one box: a
  staged diff and an unstaged diff of one row would need two views of one row.
- **Alternatives considered**: lazygit's two diffs, staged and unstaged: rejected with staging by
  hunk, which the spec leaves out.
- **Where**: tasks 2 and 9.

## R3: The page's view reads the checkout at each request

- **Decision**: the server keeps no copy of the page's view: each read runs gix's status, which
  reads again only the files whose size or time changed since the index's last write.
- **Rationale**: the watcher does not see every file of a checkout, so a kept view would miss a file
  edited in a terminal. gix's status is itself the read of what changed since, as the Performance
  decision asks; the browser draws from what it holds while the read runs.
- **If wrong**: SC-001's benchmark fails; a kept view invalidated by a recursive watch of the
  checkout would replace it.
- **Where**: tasks 5 and 7.

## R4: Conflict markers are read in the core and in the bar

- **Decision**: the core marks a conflicted file resolved when it holds no line starting `<<<<<<< `
  nor `>>>>>>> `, and refuses Continue otherwise; the conflict bar parses the blocks of the text
  being edited. Task 4's Continue reads task 2's `Conflict::is_resolved`, which holds the one line
  test, `checkout::holds_markers`: task 4's private copy is gone.
- **Rationale**: the bar edits unsaved text in the editor, so it cannot ask the core at each press;
  the core must still refuse to continue over markers whatever the browser sent.
- **If wrong**: the two disagree only on a marker line git did not write.
- **Where**: tasks 2, 4, and 10.

## R5: A stash put back with conflicts is a stop of its own

- **Decision**: unmerged files with no operation in progress read as a stash's stop: its sides are
  the branch and "the stash", it has no Abort, and resolving its files stages them, keeping the
  stash, as git does.
- **Rationale**: the spec's edge case keeps the stash and lists the files under Conflicts; git
  itself leaves no operation to continue or abort.
- **Where**: tasks 1, 4, and 10.

## R6: The server's tests of the commit bar go with it

- **Decision**: `inbox.test.ts`'s "US2 7: the commit bar commits the inbox's changes" and "the
  commit bar's Discard restores the inbox", and `buffer.test.ts`'s tests of `changes.commit` and of
  the commit panes' count, are removed with the `changes.commit` and `changes.discard` mutations.
- **Rationale**: they guard the Commit page's panes, which the spec replaces, without naming these
  server tests.
- **Where**: task 11.

## R7: Discard deletes an untracked file without `git clean`

- **Decision**: discarding an untracked file deletes it from the core, after the page's question,
  and a staged new file is removed from the index first; `git clean` is never run.
- **Rationale**: `git clean` needs `-f`, which reads as forcing; deleting one named file after the
  human confirmed is what they asked.
- **Where**: task 4.

## R8: A merge of the branch's `origin` tip reads as a pull

- **Decision**: a stopped merge whose `MERGE_HEAD` is the checked-out branch's `origin` tip reads
  "The pull stopped", whether `git pull` or "Merge into main…" of `origin/main` started it.
- **Rationale**: git records no difference between the two, and both bring `origin`'s commits in.
- **Where**: task 1.

## R9: The page's confirmations are the web's, and the core never forces

- **Decision**: SC-003's confirmations are asked by the page before it calls discard, removal, or
  abort, and the web's discard test checks one; the core's tests check that no write forces, and
  that each removal is a call of its own, never a side effect of another write.
- **Rationale**: the core has no human to ask; what it guards is that nothing is removed beyond what
  was named.
- **Where**: tasks 4, 6, and 9.

## R10: An action reaches a branch being rebased, and the commit runs through `git_write`

- **Decision**: `place::reach` takes a checkout whose stopped rebase replays a branch as holding it
  (`Git::rebasing`), so an action on `main` during a stopped pull reaches the main checkout and
  `commit_staged` refuses it with "A pull is stopped: continue or abort it first."; and
  `commit_staged` runs through `process::git_write`, which replaced `run_streaming`.
- **Rationale**: during a rebase `HEAD` is detached, so `reach` tried `git worktree add` for `main`,
  which git refuses with its own message, never the spec's. Running the commit through the one write
  runner gives `git_write` a caller in this task, with no dead-code marker, and keeps a commit's
  hooks from waiting on a prompt in the server.
- **If wrong**: a hook that asks for credentials at a terminal during `ura`'s commit now fails
  instead of prompting. Every process `process::run` starts, not only writes, now has its stdin
  closed.
- **Where**: task 1.

## R11: A binary or a delete conflict is never resolved by its markers

- **Decision**: a conflict's `is_resolved` holds only for a text file both sides have
  (`BothChanged`, `BothAdded`) whose working file has no marker line. A binary conflict, or one
  where a side deleted or alone added the file, stays unresolved until a whole side is taken, which
  stages it and takes it out of the conflicts. Task 4's Continue reads `Conflict::is_resolved`, so
  it refuses while such a conflict has no side taken.
- **Rationale**: git writes no markers in those files, so the marker test alone would read them
  resolved at once, and Continue would stage git's leftover side without the human choosing one, as
  the spec offers only whole sides for them.
- **If wrong**: a human who fixed such a file by hand must still press a side on its row.
- **Where**: tasks 2 and 4.

## R12: What a fetch, a pull, and a push refuse, and the credential test's remote

- **Decision**: a fetch runs on a detached `HEAD`, as it changes no branch; a pull and a push are
  also refused while a pull or a merge is stopped, with the commit's text ("A pull is stopped:
  continue or abort it first."); a pull passes `--rebase` only when `branch.<branch>.rebase` is
  unset too, as git reads it over `pull.rebase`; a push is refused as lacking `origin`'s commits
  only on a `[rejected]` ref, while a hook's `[remote rejected]` keeps git's message. The credential
  test runs a local HTTP server answering 401 with `core.askPass` empty, and `git_remote.rs` runs
  the core's git without the machine's configuration (`without_user_git_config`), since gix and git
  both read a developer's `pull.rebase`.
- **Rationale**: the spec disables only Pull and Push on a detached `HEAD`, and the fetcher would
  otherwise fail every 5 minutes during a stopped pull, whose `HEAD` is detached; that stop would
  else read "main is not checked out"; `branch.main.rebase false` is the user's configuration, which
  the spec follows; a hook's refusal is not "pull first". The server answers at once, with no
  network, and git's exact line, "terminal prompts disabled", fails the test without
  `GIT_TERMINAL_PROMPT=0`.
- **If wrong**: a fetch on a detached `HEAD` shows its failure like any other.
- **Where**: task 3.

## R13: Resolving a conflict is `Git::resolve_conflict`

- **Decision**: the plan's `Git::resolve(path, resolution)` is named `resolve_conflict`, and task
  6's `git_resolve` calls it.
- **Rationale**: `Git::resolve(revision)` already names the commit a revision points to, with six
  callers; renaming it would touch files other tasks of the wave change.
- **Where**: tasks 4 and 6.

## R14: The page's paths are taken literally, and discard deletes only a file git lists

- **Decision**: every path the page's writes take is passed with `--literal-pathspecs`, and refused
  as "<path> is not in this checkout." when it is absolute, holds `..`, `.`, or `.git`, or goes
  through a symbolic link to a folder outside. `discard_path` deletes a file `HEAD` lacks only when
  the index holds it or git lists it as untracked; an ignored file is refused with "<path> has no
  changes to discard.".
- **Rationale**: a file named `*.md` must stage itself alone, and a path the web sends must never
  make the core delete a file the page did not list, like `.git/config` or an ignored `.env`.
- **Where**: task 4.

## R15: A stopped pull or merge refuses an action before it writes

- **Decision**: `Git::ensure_not_stopped`, in `git/stopped.rs`, owns the refusal "A pull is stopped:
  continue or abort it first." (or "A merge is stopped: …"), and replaces `commit::refused`.
  `place::reach` calls it on the checkout it reaches, unless it created it, and `reach_switching` on
  this one, so an action is refused before writing a file; the start's checks call it first too, so
  a start during a merge now reads "A merge is stopped: continue or abort it first." instead of
  "cannot start: a merge is in progress on main: …", and `operation_in_progress` names only a
  cherry-pick, a revert, or applying patches. `default_checkout` finds the default branch's checkout
  as `reach` does (`place::holder`), a stopped rebase of it included. A stash's stop names
  `stash@{0}` only while `refs/stash` exists.
- **Rationale**: refused only at the commit, an action left its file written, which made
  `git rebase --continue` fail, and over a file already changed it answered "other changes" instead
  of the spec's text. One owner keeps the commit's, the sync's, and the merge's texts the same.
- **If wrong**: an action during a stopped pull could write and wait for the commit; nothing else
  changes.
- **Where**: tasks 1, 3, and 4.

## R16: A rename conflict lists under its new path alone

- **Decision**: `ConflictView` has one `path`: a file renamed on one side and changed on the other
  lists under its new path, with no `other_path`.
- **Rationale**: git's index holds every stage of such a conflict at the new path; the old path is
  only in the merge's rename detection, which gix is built without (see `path_events`), so naming it
  would mean a `git diff -M` of each side per read of the page.
- **If wrong**: the spec's niche edge, "listed with both paths", reads one path; a rename whose
  content conflicts is `both-changed`, so it is offered the editor as well as the whole sides.
- **Where**: task 5.

## R17: The page's view names the main checkout by its branch, and reads a diff's path checked

- **Decision**: the main checkout's group is named by the branch it has checked out (or its detached
  id), not by the default branch; a worktree's state is the first of `missing`, `changes`, `locked`,
  `merged`, `clean` that holds, so a merged feature's worktree with changes reads "has changes"; a
  working tree's diff takes its path through `Git::checked`, task 4's check, so `../x` is refused
  before any file is read; `git_history` takes a commit id, the first page coming with the page's
  view; `Changes::git` hashes each checkout's `HEAD`, index size and time, `MERGE_HEAD`, and rebase
  folder, the main branch's tip and its `origin` tip, and `FETCH_HEAD`'s time.
- **Rationale**: the main checkout may sit on another branch, and its name is what a commit lands
  on; the spec offers neither Clean nor Remove on a worktree with changes; a diff reads the file on
  disk, so a path the web sends must stay inside the checkout; a push moves only `origin`'s tip, and
  a stopped operation or a stage only git's folder.
- **Where**: task 5.

## R18: The page's removal and clean say what stays, in the core's words

- **Decision**: `git_remove_worktree` matches the path the page sends against each worktree git
  records, by its path from the main checkout's root, as `ura clean` writes it (`clean::relative`,
  now `pub(crate)`), and checks the worktree for changes itself before `git worktree remove`,
  refusing with "<path> has changes: commit or discard them first."; `clean_feature` is refused,
  after what it could do, with each part that stays and why, like "The branch x stays: it has
  commits main lacks."; `save_conflict_file` checks its path with task 4's `Git::checked`, now
  `pub(crate)`, before looking for its conflict.
- **Rationale**: git's own refusal of a worktree with changes reads as a failed command, not the
  page's text; a clean that leaves its worktree or branch must not read as done; one check of a path
  the web sends, not two.
- **If wrong**: a clean that left something reads as refused in the toast, though the rest of it
  landed; the page's next view shows what is left.
- **Where**: task 6.

## R19: Discard takes one file, and the core checks every path the page sends

- **Decision**: `Git::discard_path` refuses a folder, on disk or in `HEAD`, with "<path> is a
  folder: discard its files one by one.", and a conflicted file with "<path> conflicts: take a
  side."; a file `HEAD` lacks is staged only when the index holds that path exactly.
  `Git::file_diff` checks a working tree's path itself, so the API no longer does (R17's check moves
  into the core); `Git::merge_branch` refuses a detached `HEAD` with a pull's text; a hunk's empty
  side starts at the line before, as git writes it; the page's state tells a binary file on disk
  from its first 8,000 bytes before reading it whole.
- **Rationale**: `git checkout HEAD -- docs` wipes every edit under `docs`, and over a conflict
  takes a side unasked; the core owns git's reads, so a diff read from anywhere stays inside the
  checkout; a merge on a detached `HEAD` moves no branch.
- **If wrong**: discarding a folder takes one press per file; nothing else changes.
- **Where**: tasks 2, 3, 4, and 5, after the review of tasks 2 to 4.

## R20: Which of the page's writes the guard refuses, and what a conflict's save answers

- **Decision**: the quiet `git.fetch`, the page's on its open, is not guarded; a loud one is. The
  removal of a worktree is refused while a chat works in the main checkout, and while the agent of
  the feature on its branch works; a clean, while either works. `git.saveConflict` answers the
  `ConflictFile`, with its new hash, not the page, and lands through `landed`, so a stale save
  leaves the queue's record and answers where it was made; every other refusal stays in the record
  and answers the call. No committing call waits for a fetch: `WriteQueue.background` takes no keys,
  and the core's `git_fetch` takes no write lock; a queued write still lands after it, in the
  queue's order. The roots of the new views are in `fate.ts`'s `Root`, as the write queue's are,
  since `fate/views.ts` is at the file length limit.
- **Rationale**: a fetch changes no file of a checkout, and the fetcher (task 8) runs every 5
  minutes whatever the agents do; a worktree's removal writes the main checkout's git folder and the
  feature's worktree; the editor's next save names the hash the save gave back.
- **If wrong**: a quiet fetch while a chat works moves `origin`'s refs under it, which no file of
  the checkout shows.
- **Where**: task 7.

## R21: The fetcher is the host's, a quiet fetch answers its failure in the page, and a loud one's outcome is kept

- **Decision**: each listed repository's `Host` holds its `fetcher`, started with its pull requests'
  refresher and stopped with it; the fetcher fetches at the host's start too, so the sidebar's count
  is fresh before the page opens. The quiet `git.fetch` joins the fetcher's fetch and answers the
  page, a failure in `fetchFailure` rather than as the call's error. `Fetcher` gains
  `settle(error?)`, by which a loud `git.fetch`, still a queued write with its toast, sets or clears
  the failure. A fetch's outcome is kept, and the next call fetches again, as its landing ends,
  before the queue's next write starts. The fetcher publishes the page only when its failure
  changed: what a fetch brings, the refs and `FETCH_HEAD`, reaches it through the watcher's `git`
  change.
- **Rationale**: the quiet fetch reaches the fetcher through the context's host, as the queue is
  reached; a failure the page reads in its view needs no error path on the web; a loud fetch that
  succeeds after a failing background one must clear the page's message; a publish after each fetch
  sent every repository's page at the server's start, with nothing new.
- **If wrong**: the page's open shows a failing fetch only in its view, not as a refused call.
- **Where**: task 8.

## R23: The page's reads skip what they cannot read, and its writes take only what it lists

- **Decision**: the page's view reads each worktree's state once; one that cannot be read, as with a
  broken index, reads `changes` and has no group, and the sidebar's count leaves it out, so neither
  fails. A changed file past 1 MiB, on disk or in `HEAD`, is listed without line counts, as a binary
  one is. Removing a missing worktree runs `git worktree remove` on its record alone, never
  `git worktree prune`; a locked one is refused, "<path> is locked: unlock it first.". `git_merge`
  takes only one of the page's `branches`; `git_history` refuses an `after` its history lacks, so
  the web reloads the first page; `conflict_file` refuses a symbolic link and a file it cannot read,
  and `save_conflict_file` a file it cannot read; a diff's id ends in `:whole` for the whole.
  `git_fetch` takes no write lock. `Changes::git` hashes the stash's ref and log too. The views'
  string fields are literal unions in the binding's typings.
- **Rationale**: one stale worktree must not blank the page and every page's sidebar; a big text
  file would be diffed on every read of the page (SC-001); pruning dropped every missing worktree's
  record unasked; a fetch writes only refs and objects, which git locks itself, and the fetcher's
  fetch every 5 minutes would hold every save behind a slow remote; dropping a stash touches no
  index.
- **If wrong**: a big file's counts show only in its diff; nothing else changes.
- **Where**: tasks 5 and 6, after their review.

## R24: The guard runs again as a write lands, and the main checkout's git writes hold the lists

- **Decision**: each of the page's writes, `git.saveConflict` too, runs its guard as it is queued
  and again as it lands, a refusal at the landing staying in the queue's record. The main checkout's
  writes are keyed `["git", LISTS]`, so the inbox's, the priorities', and the proposals' commits
  wait for them; `git.removeWorktree` reads the folder of the worktree's feature before it is
  queued, and adds its `featureKeys`.
- **Rationale**: a write queued behind a slow one, a held hook, lands after a chat's turn may have
  started, which the guard at the queueing never saw (SC-004); a pull or a merge writes the lists'
  files, which a list's commit, keyed `LISTS` alone, wrote meanwhile; a worktree's removal writes
  the feature's files, which its commits wait for.
- **If wrong**: a list's commit waits for a slow push, which writes none of its files.
- **Where**: task 7.

## R22: The Git page's records and places live in `git/`, and its refusals are found by their place

- **Decision**: the page's views and hooks (`GitPageView`, `useGitPage`, `useGitSummary`, `GIT_ID`,
  `gitDiffId`) are in `packages/web/src/git/data.ts`, not `views.ts` and `data.ts`; the web copies
  the server's `GIT_ID` and `gitDiffId`, as it imports no runtime code from `uraeda-server/fate`.
  `GitPageView` selects `fetchFailure` through a widened type, so task 8's field shows once merged
  and a server without it leaves it out. Each write names its place in its `href`: `/git` for the
  sync's, `/git#changes` or `/git#changes-<folder>` for a group's, `/git#worktrees`; each section
  shows `RefusedHere` for its place, which takes a `title` (`gitRefusalTitle`, from the write's
  label), and a refusal that never reached the queue, as the agent guard's, from the call's answer.
  A typed message goes once `git.commit` answers landed, since the call waits for the landing:
  `commit/usePaneWrites.ts`'s `landing` map is not needed. The Git page's query only picks a row, so
  `navigate` and Back between two of its addresses never ask "Leave page?".
- **Rationale**: `views.ts` and `data.ts` are 3 and 6 lines under the file limit; the queue's record
  holds only `href` and `label`, so a place is told by its `href`; a commit refused or landed is
  known when the call answers.
- **If wrong**: a refusal opened from the toast lands on the page with its hash, not scrolled to it.
- **Where**: task 9.

## R25: On wide screens the Git page's detail never leaves while the page has a file or a commit

- **Decision**: with nothing in the address, the detail shows the selected row's diff or commit, or,
  on a folder or a worktree, the first row's that has one; `j`/`k` move it along, in the same
  history entry. The page's stories show the fixture's main checkout, wide and on the phone; the
  spec's named states stay the mockups'.
- **Rationale**: `Panes` draws the list alone without a detail, and the list drawn anew lost the
  focus of the box Space had just ticked; Storybook's fixture is shared and has no remote.
- **Where**: task 9.

## R26: The conflicts' writes, questions, and bar

- **Decision**: the conflicts' writes run through `useGitWrites`' `run`, now returned, at the place
  `"sync"`, so their refusals show under the title with Pull's; the editor's save shows its refusal
  in its own pane, a stale save offering the text to copy or the new version to load, as a buffer's,
  its toast opening `/git?conflict=<path>`. Abort always asks (SC-003): "The resolved files go back
  as they were." once a file reads resolved or had a side taken on the page, which the browser
  remembers while the operation is stopped, else "main goes back as it was before the pull.". The
  banner counts the files not yet resolved, "every conflict is resolved." at none; Continue is
  enabled once every conflict reads resolved; `m` opens Continue and Abort as a menu anchored at
  Continue. A delete conflict's "Keep the file" takes the side that has it; a file deleted on both
  offers "Delete the file" alone; one added on one side alone reads "added on main alone". The bar's
  buttons are the browser's, in a CodeMirror widget, styled from the Astryx theme's tokens, an
  Astryx gap the plan lists. `Editor.tsx`, at its length limit, gives `hearLabels` to
  `fields/editor/labels.ts`. A row's head line on the phone wraps its actions, which cut "Keep the
  file" and "Delete the file" short.
- **Rationale**: one place per section, as R22 has it; a resolved file leaves the conflicts once its
  side is staged, so the page cannot read it back after a reload; the mockup puts Abort and Continue
  in the section's title, beside the files they act on.
- **If wrong**: after a reload, Abort over files resolved by a whole side alone says main goes back,
  not the resolved files; it still asks.
- **Where**: task 10.

## R27: The lists' count of changes keeps its read, and the Commit page's other tests go with it

- **Decision**: `api/commit_panes.rs` becomes `api/branch_panes.rs`, which keeps only the read of
  each branch's changes, since `Priorities.changes`, `changeLines`, and `Inbox.changes` still count
  them; `BranchPane` loses its folder and message and leaves the API, and `actions/changes/panes.rs`
  keeps `pane` alone, without the suggested message. `commit_branch`, `discard_branch`,
  `branch_changes`, `commit_pane`, and `discard_pane` go. Besides the tests the spec's Replaced
  behaviour names, `branch_commits.rs`'s `a_branch_commits_alone`, `an_empty_message_is_refused`,
  `a_feature_pane_leaves_a_staged_file_out`, `a_pane_commits_a_created_file_and_a_deleted_one`, and
  `a_finished_unmerged_features_pane_is_its_own` go, and `buffer.test.ts`'s "a feature pane is
  refused while its agent works": each calls only the removed commit or discard.
  `a_recorded_file_committed_elsewhere_is_forgotten` and `the_lists_commits_leave_a_buffers_edit`
  stay, read through `read_priorities`. `buffer.test.ts`'s "a buffer's save sends the Commit page's
  panes and the count" stays as "… the Git page and the count": a buffer's save now sends `GitPage`
  and `GitSummary` in place of `CommitPanes`. `rereadChanges` no longer reads the Git summary, which
  the server's live updates send. The sidebar's Git entry and the phone's tab show without `specs/`
  too, as `gitSummary` reads any repository; the entry is Astryx's secondary button, as the mockup's
  `SidebarEntry`, and its icon `uraeda:git-branch`, the app's own. `commit-toast.test.tsx`'s first
  test waits for the home to draw before it checks the refusal left with the page: with the Git
  entry always in the column, the home draws some 70 ms after the navigation's `act`. Only the
  trivially wrong lines of `specs/ui/` and the inbox reference are fixed here; `docs/web-ui.md`,
  `specs/ui/flows.md`'s Committing, and `conventions.md`'s commit paragraph are left for task 12.
- **Rationale**: the count of the inbox's and the priorities' changes has callers beyond the Commit
  page; a test of a removed function guards nothing; the save's live update still guards the
  sidebar's count after a decision saved on the default branch.
- **Where**: task 11.

## R28: A fetch stops after 2 minutes, and the page's writes queue in the order they came

- **Decision**: `Git::fetch` runs git in a process group of its own, through
  `process::git_write_within`, and past `FETCH_DEADLINE`, 2 minutes, stops the whole group, failing
  "git fetch failed: origin gave no answer in 2 minutes, so the fetch was stopped."; the core
  depends on `libc` on unix for that stop. `Git::fetch_within` takes the deadline, as the test's
  second. The page's writes run their checks before the queueing, the guard and the removal's read
  of its feature, in `WriteQueue.arrive`, one after another in the order the calls came, each queued
  before the next one's checks start; the web's commit waits for its group's staging writes still
  answering. A refusal by the guard before the queueing still never reaches the record.
- **Rationale**: a fetch on a remote that never answers, as a hung ssh connection, held the queue's
  tail, and every write behind it, forever; git alone stopped leaves ssh, or the remote's
  upload-pack, holding its output, so the stop must reach what it started; the user's http and ssh
  configuration stay as they are. A guard waits on a read of the main checkout, uncached the first
  time, so a commit made just after a staging could be queued first, and commit nothing; queueing
  first and guarding only at the landing would put every agent's refusal in the toast.
- **If wrong**: a fetch over a slow link that needs more than 2 minutes always fails; a slow check,
  as the removal's read of the page, holds the next write's queueing.
- **Where**: tasks 3 and 7, after the review of tasks 8 and 9.

## R29: The page reads its checkouts at once, and SC-001's 100 ms is checked on a release build

- **Decision**: `api::git_page` reads the main checkout's state and each worktree's in scoped
  threads, one each, at once, a panic carried on as the caller's. Its benchmark,
  `bench_git_page_on_uraedas_repository`, reads the page with a watch running, as the server's does,
  and prints the mean of 10 reads; it asserts the mean under 100 ms only in a build without debug
  assertions, as
  `cargo nextest run --cargo-profile release -p uraeda-core --test git_page --run-ignored only`
  makes. Measured on Uraeda's repository with four worktrees: 812 ms in a debug build before, 146 ms
  after, and 39 ms in release.
- **Rationale**: each checkout's status walks its whole working tree, about 10 ms in release and 60
  to 110 ms unoptimized, one after another; the performance decision sets its 100 ms on a release
  build, and `vp run bench` makes a debug one, where one status alone takes about 100 ms.
- **If wrong**: `vp run bench` never fails on the page's time: the release command above is the one
  that checks it, by hand in the review.
- **The run's other failure**: `vp run bench` also fails `uraeda-cli`'s
  `bench_note_writes_and_commits_within_its_bound`, on the default branch too (checked on `main` at
  the time): it was already there, and is named in the pull request.
- **Where**: task 12.

## R30: The sync's buttons sit beside the title, and the page's details go back the way they came

- **Decision**: the Git page's Fetch, Pull, Push, and "Merge into main…" sit beside the title, as
  the mockup draws them, small, and under its line on the phone. `PageTitle`'s aside gives up its
  room first, down to its widest button, its buttons wrapping onto a second line beside the title,
  so the title's words never break while the aside could still wrap. Fetch and `f` are disabled
  while a chat's agent works in the main checkout, as the guard refuses a loud fetch then (R20). The
  view's worktrees carry `isWorking`, their feature's agent at work, which disables their Clean and
  Remove as the guard refuses them. Each history entry the page opens while drawn records the page's
  address it came from as its `from`, and the phone's Back of a diff, a commit, or a conflict goes
  back in the browser's history when there is one, else to the sections afresh. "Show more" on a
  history that lost its last commit shown (R23) forgets the pages read and reads the first again. A
  box pressed twice stays as the last press shows it until that press's write answers.
- **Rationale**: beside the title, in the list's column at 1440 px, the four buttons kept their
  width and squeezed "Git" onto three lines, as `PageTitle` never let its aside shrink: the fix is
  the shared component's, as the UI components decision asks. Its other asides, the Inbox's Organize
  and the Settings' search, have room beside their titles and are drawn as before. The sections come
  back where they were scrolled only through the browser's Back, and a detail opened from another
  page, or loaded directly, has none of the Git page's before it.
- **If wrong**: in the list's column at 1440 px the buttons take two lines beside "Git", "Merge into
  main…" on the second: the title's row is that much taller than the mockup's.
- **Where**: task 9, after the review of tasks 8 and 9; the aside's shrinking after the review of
  tasks 10 and 11.

## R31: A conflict's editor follows the page's list, and a stop holds the sync

- **Decision**: the conflict editor is drawn only while the page lists its file, else "<path> no
  longer conflicts.", and reads the file from the server each time it opens, its record not being
  sent live. Its saves share the buffer's hook (`fields/useFileEditor.ts`): a stale hash read again
  and written over once, and "Load the new version" drops the text when the file is gone. While a
  pull or a merge is stopped, Pull, Push, and Merge, and `p`, `P`, and `M`, are disabled, as the
  core refuses them, and the title's line reads "main · pull stopped · fetched …" in place of its
  counts, which compare the branch's ref, not what the stop replayed; the buttons drop their counts
  too. The sides taken on the page are kept by repository and stop. The bar's buttons are disabled,
  and do nothing, in a read-only editor. A side's own line that looks like a marker is read as git's
  marker: a quoted `<<<<<<< ` opens the block there, and a setext `=======` in the first side parts
  the sides there. Without unix, a git process past its deadline runs to its end and is not reported
  as stopped.
- **Rationale**: after its row's "Use main", the editor kept the old markers, its save refused as
  stale, and its reload found nothing to load. The replayed branch's counts would need a second read
  of the rebase; a stop's line saying so misleads no one. Git's markers carry no escape, so any
  reading of a quoted marker is a guess: the text stays editable.
- **If wrong**: a text file that conflicts again under the same path after a stop ends opens afresh
  only once the page lists it again.
- **Where**: tasks 10 and 11, after their review.
