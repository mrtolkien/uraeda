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
  halted today. The human's message clears it. The capped run's card, in the sidebar and on home,
  offers no Dismiss: the feature's status it reads does not carry its turn's state, as for a halted
  run, so the banner on the session's page is where it is dismissed.
- **Rationale**: the cache dismisses failed or stopped turns only, and halted runs already work this
  way.
- **Where**: task 10, `packages/web/src/useDismiss.ts`; the card, review of task 10.

## R10: The ledger test takes the run lifecycle decision

- **Decision**: the ledger's word limit in `crates/core/tests/check.rs` goes from 12,200 to 12,300.
- **Rationale**: the decision the human approved with the spec puts the ledger at 12,214 words. The
  same limit was raised for the decisions main approved before, in `b3cc500b`.
- **Where**: `crates/core/tests/check.rs`, before task 1.

## R11: A refusal may give two `limit` events, and usage credits refuse nothing

- **Decision**: `parseLine` reads each line alone, so a refusal reported by a rejected
  `rate_limit_event` and then by its assistant line gives two `limit` events, the later one the more
  precise. A reader keeps the turn's last one. A `rate_limit_info` with `isUsingOverage: true` gives
  none: the request went through on usage credits.
- **Rationale**: one event per refusal would need state kept across lines for a case where both
  reports say the same limit. A rejected window let through on credits is not a refusal, and read as
  one it would make a working run wait for a reset.
- **If wrong**: a run whose last report is the usage event alone waits for that report's reset.
- **Where**: task 2, and the readers of the `limit` event in tasks 7 and 8.

## R12: The claim's test catches an unchecked claim, not a race

- **Decision**: task 3's claim test makes two claims one after the other, on two caches of one file.
  It catches a claim that does not check that a continue still waits. A claim that checks in one
  statement and writes in another, outside a transaction, would pass it: the guard against that race
  is the code itself, one `UPDATE … RETURNING` in a `BEGIN IMMEDIATE` transaction.
- **Rationale**: `node:sqlite` is synchronous, so one test process cannot interleave two claims.
  Racing two processes on a timer would depend on elapsed time, which the testing decision rules
  out.
- **Where**: task 3.

## R13: A switch's variable that is not true or false stops the start

- **Decision**: `URAEDA_CONTINUE_AFTER_RESTART`, `URAEDA_CONTINUE_AFTER_LIMIT`, and
  `URAEDA_CONTINUE_BEFORE_GATE` read `true` or `false`, trimmed. Any other value stops the start
  with `<NAME> is true or false.`, as a port that is not one does. `env.ts` keeps the variable as
  typed, and `settings.ts` checks it where it checks the port, at `ServerSettings.open`, not the
  core: after `--help` and `--version`, which a bad variable does not break, and after the flags, so
  a `--no-…` flag replaces a bad variable without an error. Found by the review of task 4.
- **Rationale**: a TOML boolean is typed, so the file has no text rule to share with the variable,
  unlike the port and the cap, which the core checks for the file and the variable alike.
- **If wrong**: a core rule for the switches' text, called by the binding, as `checkedPort` is.
- **Where**: task 4, `packages/server/src/env.ts` and `packages/server/src/settings.ts`.

## R14: A continue's turn is queued in the step that claims it

- **Decision**: when a continue fires, its turn is added to the cache as `queued`, with its line and
  message, in the same synchronous step as `takeContinue`. The session's queue starts it, as it
  starts any queued turn.
- **Rationale**: a claimed turn keeps its `continue_reason` with `continue_at` null, which is how a
  capped turn reads. Between the claim and a turn added after the process opened, the run would read
  "The agent keeps stopping." and could notify. A queued turn reads as working at once. Found by the
  review of task 3.
- **Where**: task 8.

## R15: An older Claude Code's `5-hour limit` is the session's

- **Decision**: `limitOfText` reads `5-hour limit`, as in `5-hour limit reached ∙ resets 3am`, as
  the session's limit, as it reads `session limit`.
- **Rationale**: older Claude Code versions name the session's limit by its window. Read as another
  limit, the run would stop for the human instead of waiting for the reset. Found by the review of
  task 2.
- **If wrong**: an older version's session limit stops its run as a weekly limit does.
- **Where**: task 2, `packages/server/src/runner/claude-limits.ts`.

## R16: A wakeup more than a day ahead holds no process open

- **Decision**: the transcript ignores a wakeup more than 24 hours ahead, `WAKEUP_HORIZON_MS`: the
  idle process closes after 15 minutes, as without one, and the wakeup dies with it.
- **Rationale**: a one-shot cron days ahead would hold the agent's process open that long, and a
  timer past about 24.8 days overflows `setTimeout` and fires at once, closing the process at the
  turn's end. Found by the review of task 7.
- **If wrong**: an agent that sets a wakeup a few days ahead does not go on by itself; a cap of a
  few days, under the timer's limit, would keep it.
- **Where**: task 7, `packages/server/src/runner/transcript.ts`.

## R17: Two servers on one cache test the continuer's claim

- **Decision**: `continuer.test.ts` gets one more test, "two servers sharing the cache continue a
  wait once": a second `Sessions` on the same cache arms the same wait, and one continue is sent.
- **Rationale**: the plan's tests did not catch a fire that skips the claim. Every cancel clears
  `continue_reason` too, so a fire that only reads the turn still finds nothing to send after a
  message, Stop, a dismiss, or a setting turned off. Only a second timer on the same wait, another
  server's, shows it. Found by the break of task 8's step 4.
- **Where**: task 8, `packages/server/src/runner/__tests__/continuer.test.ts`.

## R18: A continue is delivered synchronously

- **Decision**: `Continuer.fire` and `deliverContinue` are synchronous. The claim, the refusals (the
  agent unavailable, a move or a drop holding the session), the queued turn with its line and
  message, and the count are one step; the session's queue opens the process and starts the turn.
  `Continuer.ended` returns a promise only when its decision awaits, and `Turns.end` then publishes
  the end once it settles; the limit's decision reads the cache alone, so its end is published at
  once, already waiting.
- **Rationale**: R14 asks for the queued turn in the claim's step, and rule 5 for no end published
  before the decision. Without an `await`, neither can be broken by a later change of order, and a
  refusal is known before the continue is counted.
- **Where**: task 8, `packages/server/src/runner/continuer.ts` and `send.ts`.

## R19: Continue all leaves a run that failed at a human gate

- **Decision**: Continue all picks its runs with `continuedByAll` in `runner/status.ts`: the
  feature's status is `continuable`, and its step waits on the agent. It sends in the run's own
  session, `fresh` off, so a run at `plan` or `approval` goes on where it stopped instead of in a
  new session. The web's preview imports the same function.
- **Rationale**: a run whose step moved to a human gate before it failed reads `continuable`, but
  its step has no message to send: with `continuable` alone, the preview would tint a row that gets
  nothing. The plan names the latest session as the one that goes on. The plan's break for the
  server's test, a rule that sends to every Needs you row, cannot send to a gate: the step's
  recommended message is none there. The test's gate fails its run instead, and the web's test
  catches a preview by a rule of its own.
- **If wrong**: a run at a gate would need a message of its own, which the spec does not give.
- **Where**: task 11, `packages/server/src/fate/continue-all.ts` and
  `packages/web/src/home/Core.tsx`.

## R20: Every decision of a feature's run reads its worktree's commit first

- **Decision**: `Continuer.#decide` reads the feature's worktree commit, `binding.checkoutCommit`,
  before its cap check, for every kind of continue, so a limit's `ended` returns a promise too, and
  `Turns.end` publishes its end once the decision settled. A chat's decision reads nothing. After
  the read, the decision is dropped when the human's message, a dismiss, or a turn queued after it
  took the run over. The commit read at the decision is recorded as the continue fires, which stays
  synchronous.
- **Rationale**: the commit sets the count back before the cap is checked (rule 3, R5), and reading
  it is asynchronous. Read at the fire, after the turn is queued, it could see the agent's next
  commit and miss the reset. R18's "the limit's end is published at once" no longer holds: it is
  published after the read, already waiting. The US3 test checks the published statuses on this
  path. Found by building task 9.
- **If wrong**: a limit's end reached NeedsYouList a few milliseconds later than before.
- **Where**: task 9, `packages/server/src/runner/continuer.ts`.

## R21: On a touch screen, Continue all's first tap previews it

- **Decision**: a touch screen has no pointer over Continue all, so its first tap shows the preview
  and sends nothing; a second tap while it shows sends. A tap elsewhere, or 4 seconds without one,
  ends it. A tap's focus shows no preview: only a key's focus does, as a mouse's hover does. A mouse
  click and a key send at once.
- **Rationale**: US5 shows the human which runs Continue all sends before they press it. Without a
  pointer, the preview flashed under the finger only while it pressed, after the sends had left. A
  sheet to confirm would be a second surface for what the home already shows.
- **If wrong**: a confirmation, or a preview of its own on the phone, replaces the first tap's.
- **Where**: review of task 11, `packages/web/src/home/ContinueAll.tsx`.
