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
  being edited. Task 4 holds a private copy of the core's line test until task 2's merges, then uses
  task 2's.
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
