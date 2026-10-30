# Rulings: Feature state pass

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The ledger's word budget rises to 12,100

- **Decision**: `the_ledger_reads_alone` allows 12,100 words, up from 11,800.
- **Rationale**: the approved Feature status decision takes the ledger to 12,069 words. The limit
  rose the same way with each decision approved before, as the test's comment records.
- **Where**: `crates/core/tests/check.rs`, before the plan.

## R2: A pull request's head the repository never fetched reads as ready

- **Decision**: when the pull request's head commit is not in the local repository, the step is "PR
  ready", not Push.
- **Rationale**: a head missing locally was pushed from elsewhere, so the local branch is most
  likely behind it. The spec's "a local branch behind its pull request's head reads 'PR ready'"
  covers it, and nothing proves the branch holds commits the pull request lacks.
- **If wrong**: a branch both behind and ahead of its pull request reads ready until the next fetch.
- **Where**: task 5.

## R3: Progress's `position` becomes `done`

- **Decision**: `TaskProgress.position` is renamed `done`, the count of tasks done.
- **Rationale**: the same number with a new meaning under its old name would be misread by each of
  its six readers.
- **Where**: task 7.

## R4: Only the composer's first line is replaced by the start

- **Decision**: a change started from the New change page passes its first line source to the start,
  which replaces it in the start commit. Other line sources and notes are still taken out by the
  browser, as before.
- **Rationale**: the start makes one link, so it replaces one line. Several sources in one change
  are rare, and the spec only names the line the change is started from.
- **Where**: task 3.

## R5: A notification's key carries the turn its status follows

- **Decision**: the notifier's key for a feature adds the ID of the latest turn of the session its
  status follows.
- **Rationale**: the notifier fires once per key. Without the turn, a pull request ready before a
  run would never notify again after it, against the spec's US1 scenario 3.
- **Where**: task 6.

## R6: A run halted before a gate keeps clearing on its own

- **Decision**: Dismiss applies to failed runs and to runs stopped by the human or the server. A
  workflow run that ended before a human gate keeps reading "Needs attention" until the agent moves
  on, as before.
- **Rationale**: the spec's US2 names failed and stopped runs only, and the halted case already
  clears when the step moves.
- **Where**: task 4.

## R7: The failed run's banner shows its reason

- **Decision**: the banner of a failed run starts its text with the turn's reason, when it has one,
  as the approved `SessionBanners` story shows.
- **Where**: task 9.

## R8: A commit whose hooks run is still a pending write

- **Decision**: `deferred::land` keeps the commit it lands in a `landing` map until git and the
  hooks are done, and `pending` reads it with the commits not taken or waiting.
- **Rationale**: `land` took the commit out of the repository's map before running its hooks, so
  while a pre-commit hook held it, the step read neither its write nor a commit holding it, and the
  card went back to the gate: review focus 2. It leaves the map under the write lock, so a read sees
  it pending or committed.
- **Where**: task 1, `crates/core/src/actions/deferred.rs`.

## R9: The benchmark runs with `vp test bench --run`

- **Decision**: `live.bench.ts` runs with `nix develop -c vp test bench --run <file>`, the command
  `vp run bench` runs; `vp bench` does not exist.
- **Where**: task 1, step 5.
