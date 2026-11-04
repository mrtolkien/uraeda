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
  and answers the call. `WriteQueue.background` takes no keys: no committing call waits for a fetch.
  The roots of the new views are in `fate.ts`'s `Root`, as the write queue's are, since
  `fate/views.ts` is at the file length limit.
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
