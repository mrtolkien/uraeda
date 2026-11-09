# Rulings: Agents catch up open pull requests with main

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A catch-up turn is a turn sent at the step `catch-up`

- **Decision**: the status and the notifications treat as a catch-up any turn whose `step` is
  `catch-up`, whatever its trigger: the catcher's (`catch-up`), Continue's, or Continue all's
  (`manual`). Every one of them records `caught_up_to`.
- **Rationale**: the spec says the step reads idle "until a catch-up turn ran". A catch-up the human
  started by hand and that stopped on a conflict must ask for them the same way, and must count for
  its tip, or the catcher would start a second one for the same tip at once.
- **Alternatives considered**: only the trigger `catch-up`: a manual catch-up stopped on a conflict
  would read idle, and the catcher would run it again.
- **Where**: tasks 4 and 5.

## R2: The catcher lives beside the fetcher and the pull requests' refresher

- **Decision**: `packages/server/src/catch-ups.ts`, at the server's top level, beside `pulls.ts` and
  `git-fetch.ts`, not in `runner/`.
- **Rationale**: it reads features' statuses and steps through the fate layer
  (`fate/feature-status.ts`), as Continue all does; `runner/` never imports `fate/`. The spec's
  "beside the continuer" places it among the automatic runs, which this keeps.
- **Where**: task 6.

## R3: A feature without a session, or one that asks for the human, is not caught up by itself

- **Decision**: the catcher skips a feature at `catch-up` with no session, and one whose status is
  "Needs attention" (a failed, stopped, capped, or conflict run not dismissed). It catches up only
  an idle one, or one with an unread reply.
- **Rationale**: a run the human stopped must not continue by itself (run lifecycle). Every feature
  that opened a pull request has a session; Continue on its page starts one when the cache lost it.
- **If wrong**: a feature whose cache was emptied reads "Catch up" until Continue.
- **Where**: task 6.

## R4: SKILL.md makes room for the catch-up rows

- **Decision**: the paragraph on follow-up questions and blank answers moves from `SKILL.md` to
  [Writing for the human](/skills/uraeda/references/writing.md), with a one-line pointer. The notes
  paragraph keeps one sentence, its bullet example moving to the notes of that reference. The step
  table's catch-up rows link as `[Catch up](...)`, not `[Implementation](...), catch up`.
- **Rationale**: `SKILL.md` holds 19,973 characters, and `crates/cli/tests/skill.rs` refuses more
  than 20,000, asking to move what most steps do not need. Only the spec step and `ura answer` read
  how follow-ups are answered. The move alone left too little room: the longer link widens every row
  of the table, the step column padded to it, and `SKILL.md` reached 20,136 characters.
- **Where**: task 3.

## R5: The step rows behind main get a table of their own

- **Decision**: the rows "open, behind main", "changes requested, behind main", "draft, behind
  main", and "record, ready, behind main" live in `behind_main_rows` in
  [`steps.rs` tests](/crates/core/tests/steps.rs), on a repository whose `main` gained code after
  the branch, and apply a snapshot as the other rows do, not `steps::step(feature, Behind)`.
- **Rationale**: `pull_request_rows` and `finishing_rows` share one repository where `main` never
  moves, and a state fed by hand never reaches changes requested or a draft: only a real `main`
  ahead checks that `Behind` does not leak into them.
- **Alternatives considered**: a column for whether `main` moved in both tables: every existing row
  grows a field that only four rows use.
- **Where**: task 1.

## R6: The server reads the switch from `settings.runs()`

- **Decision**: the switch in force is `settings.runs().catchUpPullRequests.inForce`, as
  `continueSettings` in `live.ts` reads the continues', not `settings.values().runs…`.
- **Rationale**: `ServerSettings` has no `values()`: it gives each table through its own method,
  `view()`, `runs()`, and `keyboard()`.
- **Where**: tasks 2 and 6.

## R7: A branch holds the default branch's tip when its local tip or its remote tip does

- **Decision**: the behind rule reads both `refs/heads/<branch>` and `origin/<branch>`, and a branch
  is behind only when every one of them lacks the default branch's tip, with changes beyond the
  default branch's own files.
- **Rationale**: GitHub's "Update branch", or a push from another clone, catches up the remote
  branch while the local one stays where it was. The pull request then holds the default branch's
  tip, and a catch-up would only redo it. The local tip alone, read first, read Catch up then.
- **Alternatives considered**: the remote tip alone: a catch-up committed but not pushed yet would
  read Catch up again.
- **Where**: `crates/core/src/behind.rs`, found in review.

## R8: A catch-up's commit follows its turn, continued or retyped

- **Decision**: an automatic continue of a stopped catch-up records the stopped turn's
  `caught_up_to`, and a queued catch-up that starts as a chat, its step gone, drops it.
  `turns.begin` takes its system lines as `lines`, the process's then the workflow message's,
  written with the turn and its message in one transaction.
- **Rationale**: R1 says every workflow turn at `catch-up` records its commit, and a continue is
  one, of the same commit; a turn retyped as a chat caught up with nothing, and would keep the
  catcher from catching up with that tip.
- **Where**: task 4, `packages/server/src/runner/send.ts` and `cache.ts`.

## R9: A dismissal ends no turn

- **Decision**: `dismiss` sends its change with `dismissed: true`, and `onTurnDone` and the
  extensions' `turn-ended` skip such a change.
- **Rationale**: a done catch-up stopped on a conflict is the first done turn a dismissal sends. Its
  state `done` would reach `onTurnDone`, which the catcher listens to, and warm the feature's
  Storybook: a dismissed run would start work by itself, which the run lifecycle forbids.
- **Alternatives considered**: a change without the turn's state: the turn's record, the session's
  list, and what needs the human would not be sent at once.
- **Where**: `runner/session-state.ts` (`SessionChange`), `runner/session-edits.ts`, `live.ts`,
  `extensions/server.ts`; task 5.

## R10: Only a step's ask skips the catch-up's turn in its key

- **Decision**: the notification's key holds the followed session's latest turn not sent at
  `catch-up` only when the status's reason is `step`, as a ready pull request's. Any other ask, a
  conflict, a failed or a refused catch-up, keys on the status's own turn.
- **Rationale**: a catch-up that ended at the pull request only brought back the review asked
  before, but a second conflict, after the first was dismissed, is a new ask: keyed on the turn
  before the catch-ups, it would not notify.
- **Where**: `fate/needs-you.ts` `askedBy`; task 5.

## R11: A conflict reads in the folder's latest session, and dismissed reads idle

- **Decision**: the conflict rule holds only in the folder's latest session, as `halted` does, and a
  dismissed conflict reads "Idle", not "New reply", as a dismissed failure does.
- **Rationale**: the folder's runs go to its latest session, so an older one's catch-up stopped
  nothing now; a dismissal says the human has seen it.
- **Where**: `runner/status.ts` `sessionStatus`; task 5.

## R12: A catch-up stopped on a conflict only for the tip it caught up with

- **Decision**: a done turn sent at `catch-up` reads `conflict` only when its `caught_up_to` is the
  step's current `catchUp.commit`. One that caught up with an older tip falls through to the rules
  after it: idle, or a new reply.
- **Rationale**: a catch-up that rebased and pushed while main moved again ends with the step still
  `catch-up`, for the new tip. Read as a conflict, it would ask for the human and the catcher would
  skip it, where the spec starts one more catch-up for the new tip.
- **Alternatives considered**: reading the turn's end for a conflict: the agent's end says nothing
  the server can read reliably, and the tip already tells the two apart.
- **If wrong**: a catch-up that stopped on a conflict, with main moving again before the human sees
  it, reads idle and is caught up again for the new tip, stopping on the conflict once more.
- **Where**: `runner/status.ts` `sessionStatus`, `fate/session-reads.ts` `statusOf`; task 5.
