# Rulings: Worker lifecycle

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Claude Code reports the limit's reset before the run fails

- **Decision**: the spec's unverified point is checked against the installed Claude Code, 2.1.317,
  without a run. Its SDK schema, in the binary's strings, says two things:
  - An assistant message wrapping a refusal by the account's usage limit carries
    `api_error: "usage_limit_reached"`.
  - Its `api_error_params.rate_limit_info` holds `status: "rejected"`, `rateLimitType`, and
    `resetsAt`, "in the shape rate_limit_event carries".

  A real transcript of 2026-10-26 shows the text the fallback reads:
  `You've hit your session limit · resets 8:20pm (Asia/Tokyo)`. The stop reader reads the typed
  error first, then a rejected `rate_limit_event`, then the text.

- **Rationale**: hitting a real limit on purpose would spend the human's usage, which the discovery
  ruled out. The binary's own schema is the outside behaviour itself. The spec's fallback, an hourly
  retry within the cap, covers a version that sends none of the three.
- **If wrong**: a run without a readable reset retries every hour until the cap, then asks.
- **Where**: task 2.

## R2: The waiting label shows when the run continues

- **Decision**: a waiting run reads "Waiting until 8:41", the time Uraeda continues it,
  `continue_at`. The spec's example shows the reset, 8:40, a minute earlier.
- **Rationale**: the feature status decision asks for a waiting run to read "with when it goes on".
  The data model stores only that time, and the stagger moves it by a minute per waiting run.
- **Alternatives considered**: a column for the reset time, which the approved data model does not
  have.
- **Where**: tasks 6, 10, and 11.

## R3: The flags and variables of the continues' settings

- **Decision**:
  - The switches are turned off by `--no-continue-after-restart`, `--no-continue-after-limit`, and
    `--no-continue-before-gate`.
  - Their variables are `URAEDA_CONTINUE_AFTER_RESTART`, `URAEDA_CONTINUE_AFTER_LIMIT`, and
    `URAEDA_CONTINUE_BEFORE_GATE`, which read `true` or `false`.
  - The cap is `--automatic-continues <n>` and `URAEDA_AUTOMATIC_CONTINUES`.
- **Rationale**: the data model gives each key a flag and a variable. The switches are on by
  default, so a flag only turns one off, as `--no-open` does.
- **Where**: task 4.

## R4: The tests start with the continues off

- **Decision**: `testSessions` and `testServer` start with every continue off. The lifecycle's tests
  turn them on.
- **Rationale**: many existing tests end a workflow turn at the fixture's `plan` step, which waits
  on the agent. With the gate continue on, each would send one more message, and the subject of
  those tests is not continuing.
- **If wrong**: a regression where the continues break another path is caught only by the
  lifecycle's tests.
- **Where**: task 8.

## R5: A commit is seen by the worktree's commit, kept in memory

- **Decision**: at each continue, the continuer records the feature's worktree commit in memory.
  Before the next decision, a different commit sets the count back to 0. After a restart, nothing is
  recorded, and the count stays as stored.
- **Rationale**: the data model stores only the count. A restart loses at most the commits made
  since the last continue, which makes a run ask for the human earlier, never later.
- **Where**: task 9.

## R6: One-shot wakeups are `ScheduleWakeup` and `CronCreate` with `recurring: false`

- **Decision**: only these hold the process open, as the spec's tradeoff says of one-shot wakeups. A
  recurring cron never does.
- **Rationale**: the installed Claude Code's schema describes `recurring: false` as "one-shot
  wakeups whose cron field encodes a single fire time".
- **Where**: task 2.

## R7: Chats continue after a restart; Continue all continues features

- **Decision**: a chat cut by a restart continues too, by the same rules. Continue all sends only to
  features, since a chat has no step's message to send.
- **Rationale**: the restart's message works for any run. Home's Needs you lists features only.
- **Where**: tasks 9 and 11.

## R8: Only a limit's wait has a banner

- **Decision**: the session shows "Waiting for the usage limit's reset." while a limit's wait lasts.
  A restart's or a gate's continue fires within seconds, and shows no banner, only its line.
- **Rationale**: the spec's mockups have a banner for the limit alone. A banner gone within seconds
  would only flash.
- **Where**: task 10.

## R9: A capped run offers Dismiss when its turn failed or stopped

- **Decision**: "The agent keeps stopping." offers Dismiss when its turn failed or stopped. A run
  capped after stopping before its gate ended `done`, which a dismiss does not take, as for a run
  halted today. The human's message clears it.
- **Rationale**: the cache dismisses failed or stopped turns only, and halted runs already work this
  way.
- **Where**: task 10.

## R10: The ledger test takes the run lifecycle decision

- **Decision**: the ledger's word limit in `crates/core/tests/check.rs` goes from 12,200 to 12,300.
- **Rationale**: the decision the human approved with the spec puts the ledger at 12,214 words. The
  same limit was raised for the decisions main approved before, in `b3cc500b`.
- **Where**: `crates/core/tests/check.rs`, before task 1.
