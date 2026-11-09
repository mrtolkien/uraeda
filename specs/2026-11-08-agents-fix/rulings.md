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
  [Writing for the human](/skills/uraeda/references/writing.md), with a one-line pointer.
- **Rationale**: `SKILL.md` holds 19,973 characters, and `crates/cli/tests/skill.rs` refuses more
  than 20,000, asking to move what most steps do not need. Only the spec step and `ura answer` read
  how follow-ups are answered.
- **Where**: task 3.
