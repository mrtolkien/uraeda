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
