---
status: auto-approved
spec-revision: 1
---

# Plan: Worker lifecycle

**Goal:** Uraeda continues a run by itself after a server restart, a session limit's reset, or an
early end before its gate, says why in the session, caps the continues in a row, and lets the human
turn each kind off and continue every stopped run at once.

**Architecture:** the cache is the authority on every pending continue, as the
[spec's architecture](spec.md#architecture) sets out. A turn waiting to continue has `continue_at`
and `continue_reason` set, as the [data model](data-model.md) says. Timers in memory are only
wakeups. A timer that fires claims the continue in one transaction, `continue_at` set back to null,
and sends nothing when the claim fails. That way a message, Stop, a dismiss, or a setting turned off
cancels a wait by clearing the column, whichever server or timer looks next.

- **The stop reader** sits in the Claude adapter (`runner/claude-events.ts` and a new
  `runner/claude-limits.ts`). It turns Claude Code's limit reports into one agent-neutral `limit`
  event, and a one-shot wakeup into a `wakeup` event. Nothing outside the adapter reads Claude
  Code's formats.
- **The continuer**, `runner/continuer.ts`, owns every rule of the
  [run lifecycle](../decisions/run-lifecycle.md) decision:
  - whether a stopped turn continues, and when;
  - the switches, the cap, and what sets the count back;
  - the 6-hour window, the stagger, and the cancels.

  It is a part of the session manager, reached through `SessionContext` like `Turns` and
  `Processes`. `Turns.end` reports each end to it, and `Sessions.send`, `stop`, and `dismiss` cancel
  through it.

- **The continue's turn** is delivered by `send.ts`, next to the human's messages. It is queued
  behind another session of the worktree, as any message is.
- **The session status** (`runner/status.ts`) is still decided in one place, as the
  [feature status](../decisions/feature-status.md) decision asks. A turn with `continue_at` reads
  `working`, reason `waiting`. A turn the cap stopped reads `attention`, reason `capped`. Every
  view, notification, and count follows, as today.
- **Continue all** is a repository mutation. It picks its runs with one rule, `continuable`, which
  the web imports to draw its preview.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A continue claimed twice**: a second server sharing the cache, or a human message sent at the
   moment the timer fires, gets the continue at most once. The claim is one transaction, and the
   second claim finds nothing. Task 3, and task 8's message case.
2. **A continue that cannot be delivered**: the agent is unavailable, or the feature was dropped. No
   turn stays waiting forever: the stopped turn asks for the human with its own reason. Task 8.
3. **A queued turn cut by a restart** never ran, and its message never reached the agent. It is not
   continued with "Continue where you left off", and it asks for the human, as today. Task 9.
4. **A crash, with no clean stop**: the 6-hour window counts from the turn's last activity, not from
   the next start, which marks it stopped. A run cut at 01:00 by a crash is not continued at 08:00.
   Task 3.
5. **A reset time already past when it is read**, from a stale report: the run continues a minute
   after now, never in the past or at once in a loop. Task 8.

## Global constraints

From the [run lifecycle](../decisions/run-lifecycle.md) decision, word for word:

- A run cut by a server restart MUST continue by itself from its agent's session, when it was cut
  recently. Checked by the runner's tests.
- A run stopped by a usage limit MUST continue by itself once the limit resets, as a best effort.
  Checked by the runner's tests.
- A run that ends before the next human gate MUST be asked once to continue to it. Checked by the
  runner's tests.
- Automatic continues MUST stop after the number in a row the human set, without a commit or a
  message from them. Checked by the runner's tests.
- Each automatic continue MUST say in its session why it happened. Checked by the runner's tests.
- A run the human stopped or dismissed MUST NOT continue by itself. Checked by the runner's tests.
- Each kind of automatic continue MUST have a setting that turns it off. Checked by the core's
  tests.
- Agents SHOULD wait for their background work by its notice, never by polling it.

From the [feature status](../decisions/feature-status.md) decision:

- A feature's status MUST be decided in one place, which every view, notification, and count reads.
- A failed or stopped run MUST ask for the human until they dismiss it, unless it waits to continue
  by itself. Checked by the runner's tests.
- A run waiting to continue by itself MUST read as in progress, with when it goes on. Checked by the
  server's tests.

From the [notifications](../decisions/notifications.md) decision: a notification MUST be shown only
when an item, in any repository, comes to need the human, as the server's statuses say.

From the [settings](../decisions/settings.md) decision:

- Finding, reading, validating, and writing the settings MUST live in the Rust core.
- A setting MUST resolve from its flag, then its environment variable, then the file, then its
  default. Checked by the server's tests.
- A flag or an environment variable MUST NOT be written into the file.
- A setting changed in the web UI MUST apply at once when it can.

From the [agents](../decisions/agents.md) decision:

- Every agent MUST be reached through one adapter, which keeps the agent's formats inside it.
- Uraeda MUST NOT read or change an agent's credentials or settings.
- Tests MUST reach agents through a fake adapter, never a real agent.

From the [code quality](../decisions/code-quality.md) decision:

- Functions and files MUST stay within limits on length, parameters, and nesting: 500 lines per
  file.
- A new marker MUST NOT be added unless a human approves it in the plan.
- Unit tests MUST NOT depend on elapsed time: they set the clock.

From the [testing](../decisions/testing.md) decision, at the `early` stage:

- A test MUST assert what a caller or a user observes.
- A UI change MUST be easy to try in the running app, through the sandbox.
- The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's and a desktop's width.

From the spec, exact values every task uses:

| What                     | Value                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Restart's message        | `The server restarted while you worked. Continue where you left off.`               |
| Limit's message          | `The usage limit has reset. Continue where you left off.`                           |
| Gate's message           | `You stopped before the next human gate. Continue to it.`                           |
| Restart's line           | `Continued after the server restarted.`                                             |
| Limit's line             | `Continued after the usage limit's reset.`                                          |
| Gate's line              | `The run stopped before a human gate. Uraeda asked it to continue to the next one.` |
| Cap reached, title       | `The agent keeps stopping.`                                                         |
| Waiting for a limit      | `Waiting for the usage limit's reset.`                                              |
| Restart window           | 6 hours from the cut                                                                |
| Restart's continue       | within 10 seconds of the server's start                                             |
| Limit's continue         | 1 minute after the reset, 1 more minute for each other waiting run                  |
| No reset time            | a try every hour, each counting toward the cap                                      |
| Cap                      | `automatic_continues`, 1 to 10, default 3                                           |
| Count back to 0          | a commit on the feature's branch, or a message from the human                       |
| Continue all's preview   | targeted rows tinted, every other row of home dimmed, fading in 150 ms              |
| Settings, all on default | `continue_after_restart`, `continue_after_limit`, `continue_before_gate`            |

Existing guarantees to keep:

- A turn cut by the server reads `interrupted` until dismissed when it is not continued.
  `runner/__tests__/status.test.ts`, "a turn the server stopped (US2.1)". The same test owns US2's
  scenario 2 and the cases where a run is not continued.
- One working session per worktree: a continue queues behind another session's turn.
  [`runner/send.ts`](/packages/server/src/runner/send.ts) `deliver`.
- The server's stop still kills its agents: `closeAll` and `endWithServer` are unchanged.

## Code read

The discovery's [map of the code](discovery-01.md#important-reads) holds. On top of it:

- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts): 499 lines. `send`, `stop`,
  `dismiss`, and `closeAll` are where a continue is cancelled or a restart's cut is made. It builds
  `SessionContext` in its constructor.
- [`runner/turns.ts`](/packages/server/src/runner/turns.ts):
  - `end` records every turn's end, the hook for the continuer.
  - `begin` takes an opening system `line`.
  - `next` arms the 15-minute idle close, unless a background task runs.
- [`runner/transcript.ts`](/packages/server/src/runner/transcript.ts) `#result`: ends the turn
  failed with the result's errors as its reason. A limit's text becomes the reason there.
  `#background` fills `proc.background`.
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts) `#exited`: a process exiting
  mid-turn fails the turn with its stderr.
- [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts), 447 lines:
  - `assistant` lines read only their content blocks.
  - `rate_limit_event` becomes usage only, and its `status` is ignored.
  - The fixtures are in `fixtures/claude/*.jsonl`, played by `runner/__tests__/claude.test.ts`'s
    table "the lines of %s".
- Claude Code 2.1.317, the installed binary. Its SDK schema, read from the binary's strings:
  - An assistant message wrapping an API error carries `api_error: "usage_limit_reached"`, and
    `api_error_params.rate_limit_info` with `status: "rejected"`, `rateLimitType`, and `resetsAt` in
    epoch seconds.
  - The types are `five_hour`, `seven_day`, `seven_day_opus`, `seven_day_sonnet`,
    `seven_day_overage_included`, and `overage`.
  - `rate_limit_event` carries the same `rate_limit_info`.
  - A real transcript's text: `You've hit your session limit · resets 8:20pm (Asia/Tokyo)`.
  - One-shot wakeups are the `ScheduleWakeup` tool, `delaySeconds`, and `CronCreate` with
    `recurring: false`. See [rulings](rulings.md) R1 and R6.
- [`runner/cache.ts`](/packages/server/src/runner/cache.ts), 480 lines, with
  [`migrations.ts`](/packages/server/src/runner/migrations.ts):
  - The schema is at version 7.
  - `interrupted` stamps `ended_at` with the start's time.
  - `cache-tokens.ts` and `cache-work.ts` hold queries as functions over `db`: the pattern for a
    split.
- [`runner/status.ts`](/packages/server/src/runner/status.ts) `sessionStatus`:
  - Its only caller is `statusOf` in
    [`fate/session-reads.ts`](/packages/server/src/fate/session-reads.ts).
  - `statusOf` feeds the session records
    ([`fate/sessions.ts`](/packages/server/src/fate/sessions.ts)), the feature status
    ([`fate/feature-status.ts`](/packages/server/src/fate/feature-status.ts)), and what needs the
    human ([`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts)).
  - The web reads `STATUS_ORDER` through `uraeda-server/status`.
- Settings:
  - [`crates/core/src/settings.rs`](/crates/core/src/settings.rs) and its `rules.rs` and `file.rs`.
    A range is checked like `port`: one rule for typed text, one for the file's integer.
  - [`crates/binding/src/settings.rs`](/crates/binding/src/settings.rs).
  - [`packages/server/src/settings.ts`](/packages/server/src/settings.ts): `inForce`, `Source`, and
    `givenSource`.
  - [`env.ts`](/packages/server/src/env.ts), and [`options.ts`](/packages/server/src/options.ts)
    with its `HELP`.
  - [`fate/settings-mutations.ts`](/packages/server/src/fate/settings-mutations.ts).
  - On the web, [`RunSettings.tsx`](/packages/web/src/settings/RunSettings.tsx) and
    [`categories.ts`](/packages/web/src/settings/categories.ts).
  - No `[runs]` key has a flag yet; `port` and `--no-open` are the patterns.
  - The docs are [`docs/web-ui.md`](/docs/web-ui.md#settings), `.env.example`, and
    `CONTRIBUTING.md`.
- Server start: [`server.ts`](/packages/server/src/server.ts) `startSessions` calls
  `cache.interrupted`, then `createSessions`, then `check()`. It does not receive the settings yet.
  [`live.ts`](/packages/server/src/live.ts) `createSessions` builds the manager.
- Web:
  - [`SessionAttention.tsx`](/packages/web/src/SessionAttention.tsx) is the banner above the
    composer, `ATTENTION` by reason.
  - [`TurnLines.tsx`](/packages/web/src/TurnLines.tsx) `ending` formats a turn's end.
  - [`useDismiss.ts`](/packages/web/src/useDismiss.ts) holds `DISMISSABLE`.
  - [`home/Core.tsx`](/packages/web/src/home/Core.tsx) `part()` builds home's panes from
    `FeatureCard`s: home does not use `HomeRow`, the mockups do.
  - [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx) takes `actions`.
  - `pickedStyles` tints a row.
- Tests:
  - `runner/__tests__/helpers.ts` `testSessions` fakes `setTimeout` only, on an in-memory cache,
    with the `FakeAdapter`. A restart is two `Sessions` on one cache.
  - The fixture feature `2026-10-12-cli-tuis` waits on the agent, at `plan`.
  - Server tests use `__tests__/helpers.ts` `testServer`, `byId`, and `mutate`.
  - The fast check is `nix develop -c vp run fast`, and the complete validation
    `nix develop -c vp run ready`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

Pending continues live in the runner's cache, which the agents decision makes a cache, and survive
restarts there. Workflow state stays in git.

## Complexity tracking

| Abstraction or exception                         | Why it is needed                                                                                                | Simpler alternative rejected because                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `runner/continuer.ts`, the `Continuer` class     | the spec's architecture names it: one owner for the switches, the cap, the window, the stagger, and the cancels | rules spread over `turns.ts`, `sessions.ts`, and `server.ts` would repeat the cap and the settings checks     |
| `limit` and `wakeup` agent events                | the agents decision keeps Claude Code's formats in its adapter                                                  | reading `api_error` in the transcript would put Claude Code's format outside the adapter                      |
| `runner/claude-limits.ts`                        | `claude-events.ts` is at 447 lines; the limit's text and its reset are pure logic with many cases               | growing `claude-events.ts` past 500                                                                           |
| `continuable(status)` in `runner/status.ts`      | Continue all's server action and its preview on the web must pick the same runs                                 | a copy of the rule in the web would drift                                                                     |
| `runner/cache-turns.ts`, split out of `cache.ts` | `cache.ts` is at 480 lines and gains the continue queries                                                       | none: the code quality limit                                                                                  |
| a module split out of `runner/sessions.ts`       | 499 lines, and it gains the continuer's wiring                                                                  | none: the code quality limit                                                                                  |
| `runs` option of `Sessions`, a settings getter   | the runner reads the switches and the cap at each decision, and they apply at once                              | passing values per call, as `freshByDefault` does: a continue starts from a timer, with no call to carry them |
| test helpers start with the continues off        | existing tests end workflow turns at an agent's step, which would now send gate continues                       | rewriting dozens of tests whose subject is not continuing; the lifecycle tests turn them on (ruling R4)       |

## Test map

The tests run on the `FakeAdapter`, never a real agent, as the agents decision requires.

- **The runner's tests** build `Sessions` on an in-memory cache, with `setTimeout` faked and
  advanced by `vi.advanceTimersByTime`. A restart is a second `Sessions` on the same cache, after
  the first one's `closeAll`.
- **The server's tests** use `testServer` over the fixture repository.
- **The stop reader** plays recorded lines from `fixtures/claude/`, built from the installed Claude
  Code's schema and a real transcript's text.
- **The core's tests** read and write a real `config.toml` in a temporary folder.
- **The web's view changes** are reviewed in the sandbox, with one test for Continue all's preview.

New tests: 15, under the ceiling of 20 (15 key scenarios and 5 high edge cases).

| Spec                                                                                                 | Task | Test                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Stop reader: session limit with its reset; weekly and model limits; text fallback                    | 2    | `runner/__tests__/claude.test.ts`, rows of "the lines of %s"; `runner/__tests__/claude-limits.test.ts`, "the limit text %s" (table)     |
| Review focus: a crash's window counts from the last activity; a claim taken twice                    | 3    | `runner/__tests__/cache.test.ts`, "migration 8 adds the continue columns, and a continue is claimed once"; a row of "interrupted…"      |
| US4 setting keys; "Each kind of automatic continue MUST have a setting"                              | 4    | `crates/core/tests/settings.rs`, rows of `reads_each_file`; `sets_the_automatic_continues`                                              |
| Settings resolve flag, then env, then file, then default                                             | 4    | `packages/server/src/__tests__/settings.test.ts`, rows of "US2.1 to US2.5"                                                              |
| US6 2: the skill's rule                                                                              | 5    | none: a sentence of a reference, read by the final review                                                                               |
| US1 1 (status and label), SC-003 (no notification, no count)                                         | 6    | `runner/__tests__/status.test.ts`, rows "a turn waiting to continue", "a turn the cap stopped"; `needs-you.test.ts` row "a waiting run" |
| Feature status reads a waiting run in progress, with when                                            | 6    | `packages/server/src/__tests__/sessions.test.ts`, "a run waiting to continue makes its feature Working, with when it goes on"           |
| US6 1, SC-005: a wakeup keeps the process open                                                       | 7    | `runner/__tests__/sessions.test.ts`, "US6.1: a pending wakeup keeps the idle process open until it fires"                               |
| US1 1, 2, SC-001: wait and continue after the reset, with its line                                   | 8    | `runner/__tests__/continuer.test.ts`, "US1.1 and US1.2: a session limit waits, then continues a minute after its reset"                 |
| US1 3: a stagger of a minute                                                                         | 8    | `continuer.test.ts`, "US1.3: two runs waiting for one reset continue a minute apart"                                                    |
| US1 more 1, high edge "a message during a wait", review focus 1                                      | 8    | `continuer.test.ts`, "a message during a wait goes at once, drops the continue, and sets the count back"                                |
| US1 more 2, high edges "Stop during a wait", "you dismissed a run"                                   | 8    | `continuer.test.ts`, "Stop or a dismiss during a wait ends it for good" (two rows)                                                      |
| US1 more 3, 4, high edge "restart during a wait"                                                     | 8    | `continuer.test.ts`, "a wait survives a restart, and an overdue one continues at once"                                                  |
| US1 more 5, edge "weekly or model-family limit"                                                      | 8    | `continuer.test.ts`, row of "a limit that is not the session's fails and asks" (weekly, model)                                          |
| Edge "no reset time", review focus 5                                                                 | 8    | rows of the US1.1 test: no reset, a past reset                                                                                          |
| US4 1, SC-004, high edge "the limit hits again right after a continue"                               | 8    | `continuer.test.ts`, "US4.1: past the cap, the run asks: the agent keeps stopping"                                                      |
| US4 3: a setting turned off ends its waits                                                           | 8    | `continuer.test.ts`, "US4.3: turning off the limit's continue ends its waits, and the runs ask"                                         |
| Review focus 2: a continue that cannot be delivered                                                  | 8    | an assertion of the US4.3 test: an unavailable agent at the reset leaves the run asking                                                 |
| US2 1, SC-002: restart continue within 10 s                                                          | 9    | `continuer.test.ts`, "US2.1: a run the restart cut continues at the next start, with its line"                                          |
| US2 2, US2 more 1, 2, edge "transcript gone", review focus 3                                         | 9    | rows of the US2.1 test: cut 7 h before, transcript gone, an older session, a queued turn; none continues                                |
| US3 1, 2: a gate continue, once                                                                      | 9    | `continuer.test.ts`, "US3: a run that stops before its gate is asked once, and a second stop asks for you"                              |
| US4 2: a commit sets the count back                                                                  | 9    | `continuer.test.ts`, "US4.2: a commit on the branch sets the count back to 0"                                                           |
| US4 mockups: the Runs rows                                                                           | 10   | none: reviewed in the sandbox; the values' contract is task 4's                                                                         |
| Session lines and banners: waiting, capped                                                           | 10   | none: reviewed in the sandbox; the texts are owned by task 8's line assertions and task 6's status                                      |
| US5 1, 3, SC-006: Continue all sends each asking run its step's message, none to a gate              | 11   | `packages/server/src/__tests__/continue-all.test.ts`, "US5: Continue all sends each stopped run its step's message, and none to a gate" |
| US5 2: the preview                                                                                   | 11   | `packages/web/src/__tests__/continue-all.test.tsx`, "Continue all's preview tints the runs it continues and dims the rest"              |
| Edge "Not logged in"                                                                                 | none | the existing failure path: `sessions.test.ts`, "the process exits during a turn: it fails with its stderr"; Continue all owns the rest  |
| Edge "another session of the worktree is working"                                                    | none | the existing queue: `deliver` queues any message; the continue goes through it                                                          |
| Edge "a restart from Vite"                                                                           | none | `stopDevRuns` calls the same `server.stop`, and the next server the same `startSessions`                                                |
| Replaced: "a server stop reads interrupted until dismissed", "a usage limit fails", "halted at once" | none | kept as the paths where the continue is off or not allowed; the helpers turn the continues off (R4)                                     |
| Replaced: "US1.7 and C1: an idle process closes after 15 minutes"                                    | 7    | kept: without a wakeup, the process still closes after 15 minutes                                                                       |

## Waves

1. Tasks 1, 2, 3, 4, and 5. They touch different files: task 1 `sessions.ts`, task 2 the Claude
   adapter and `events.ts`, task 3 the cache, task 4 the settings, and task 5 the skill.
2. Tasks 6 and 7. Task 6 changes the status and its readers, and task 7 the idle close in
   `turns.ts`, `transcript.ts`, and `session-state.ts`.
3. Tasks 8, 10, and 11.
   - Task 8 is the runner and the server's start.
   - Task 10 is the session view and the settings page.
   - Task 11 is Continue all and home.
   - Shared file: `docs/web-ui.md`, where tasks 10 and 11 each add their own paragraphs.
4. Task 9, which extends task 8's continuer.

---

## Task 1: Split the session manager

**Files:**

- Modify: `packages/server/src/runner/sessions.ts`
- Create: `runner/session-folders.ts`, for a cohesive group of `Sessions`' methods: the sessions'
  creation (`featureSession`, `newSession`, `newChat`), `attach`, and `archiveFolder`. `hold` stays
  in `Sessions`, which it shares `working` and `sessionWorking` with

**Interfaces:**

- Produces: `Sessions`' public methods unchanged, in name, signature, and behaviour. `sessions.ts`
  is under 440 lines, leaving room for task 8.

- [x] **Step 1: Move the group into its module.** The moved code becomes functions over
      `SessionContext`, plus what they need, called by thin `Sessions` methods. Leave the module's
      exports to the implementer.

- [x] **Step 2: Run the runner's and the server's session tests, which pass before and after**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/sessions.test.ts packages/server/src/__tests__/sessions.test.ts`
- Expected: PASS

- [x] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 4: Commit**

```bash
git add packages/server/src/runner/
git commit -m "refactor(worker-lifecycle): split the session manager's folder sessions out"
```

## Task 2: Read why a turn stopped: limits and wakeups

**Files:**

- Modify: `packages/server/src/runner/events.ts`, `packages/server/src/runner/claude-events.ts`
- Create: `packages/server/src/runner/claude-limits.ts`
- Create: `fixtures/claude/limit-session.jsonl`, `fixtures/claude/limit-weekly.jsonl`,
  `fixtures/claude/limit-text.jsonl`, `fixtures/claude/wakeup.jsonl`
- Test: `packages/server/src/runner/__tests__/claude.test.ts`,
  `packages/server/src/runner/__tests__/claude-limits.test.ts`

**Interfaces:**

- Produces, in `events.ts`:
  - `type Limit = { kind: "session" | "other"; resetsAt?: string; text?: string }`. `resetsAt` is in
    ISO 8601. `other` is any weekly, per-model, overage, or unknown limit.
  - A new `AgentEvent` member, `{ type: "limit"; limit: Limit }`: the agent reported that a usage
    limit refused its turn.
  - A new `AgentEvent` member, `{ type: "wakeup"; at: string }`: the agent set a one-shot wakeup for
    that instant, in ISO 8601.
- Produces, in `claude-limits.ts`:
  - `limitOfInfo(info: unknown, text?: string): Limit | undefined`, from a `rate_limit_info` with
    `status: "rejected"`, and not let through on usage credits (`isUsingOverage`).
  - `limitOfText(text: string, now: Date, zone?: string): Limit | undefined`, from the limit's text.
    `zone` is the server's own by default; the tests set it.
  - `limitOfMessage` and `wakeupOf`, which `parseLine` calls on an assistant message and on its tool
    calls.

- [x] **Step 1: Write the failing tests, and the fixtures they use**

The fixtures are recorded lines:

- `limit-session.jsonl`:
  - an assistant line with `error: "rate_limit"`, `is_api_error_message: true`,
    `api_error: "usage_limit_reached"`, and
    `api_error_params.rate_limit_info: { status: "rejected", rateLimitType: "five_hour", resetsAt: 1793749200 }`,
    2026-11-03T23:40Z, 8:40am in Tokyo;
  - the text `You've hit your session limit · resets 8:40am (Asia/Tokyo)`;
  - a `result` with `is_error: true` and that text.
- `limit-weekly.jsonl`: the same with `rateLimitType: "seven_day"`, `resetsAt: 1794150000`, and
  `You've hit your weekly limit · resets Mon 12:00am (Asia/Tokyo)`.
- `limit-text.jsonl`: the assistant line without `api_error`, as an older Claude Code sends it.
- `wakeup.jsonl`: an assistant `tool_use` of `ScheduleWakeup` with `delaySeconds: 1500`, and one of
  `CronCreate` with `recurring: false`, and a recurring `CronCreate`.

Rows of "the lines of %s", each asserting only the new event among the file's. The table's clock is
set to `2026-11-03T14:01:00Z`, 23:01 in Tokyo:

```ts
["limit-session.jsonl", expect.arrayContaining([{ type: "limit", limit: { kind: "session", resetsAt: "2026-11-03T23:40:00.000Z", text: SESSION_TEXT } }])],
["limit-weekly.jsonl", expect.arrayContaining([{ type: "limit", limit: { kind: "other", resetsAt: "2026-11-08T15:00:00.000Z", text: WEEKLY_TEXT } }])],
["limit-text.jsonl", expect.arrayContaining([{ type: "limit", limit: { kind: "session", resetsAt: "2026-11-03T23:40:00.000Z", text: SESSION_TEXT } }])],
["wakeup.jsonl", expect.arrayContaining([{ type: "wakeup", at: "2026-11-03T14:26:00.000Z" }, { type: "wakeup", at: new Date(2026, 10, 5, 9, 30).toISOString() }])],
```

`claude-limits.test.ts`, "the limit text %s": a table over `limitOfText(text, now, zone)`, with
`now` `2026-11-03T14:01:00Z` and the server's zone `Europe/Paris` (15:01 there). Each limit also
carries its `text`:

| Text                                                             | Expected                                      |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `You've hit your session limit · resets 8:40am (Asia/Tokyo)`     | session, `2026-11-03T23:40:00.000Z`           |
| `You've hit your session limit · resets 11pm (Asia/Tokyo)`       | session, `2026-11-04T14:00:00.000Z`           |
| `You've hit your session limit · resets 8:40am`                  | session, `2026-11-04T07:40:00.000Z`, in Paris |
| `You've hit your session limit`                                  | session, no `resetsAt`                        |
| `You've hit your weekly limit · resets Mon 12:00am (Asia/Tokyo)` | other                                         |
| `You've hit your Opus limit · resets 8:40am (Asia/Tokyo)`        | other                                         |
| `Not logged in · Please run /login`                              | undefined                                     |

The break each test catches:

- The fixture rows: a parser that ignores `api_error_params`, whose text fallback gives the weekly
  limit no reset, or that reads a weekly limit as the session's; a wakeup not read from its tool
  call.
- The table: a reset read in the server's zone instead of the zone the text names, or a time already
  past today not moved to the next day.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/claude.test.ts packages/server/src/runner/__tests__/claude-limits.test.ts`
- Expected: FAIL. The rows miss the `limit` event, and `claude-limits.ts` does not exist.

- [x] **Step 3: Implement the stop reader**

`parseLine` emits a `limit` event for a refusal (ruling R11):

- from the main agent's assistant line whose `api_error` is `usage_limit_reached`, through
  `limitOfInfo`;
- else from one with `error: "rate_limit"`, through `limitOfText` on its text;
- and from a `rate_limit_event` whose `rate_limit_info.status` is `rejected`, its usage event kept.
  It comes before the refusal's assistant line, which says the same or more, and is read last.

Rules:

- `rateLimitType: "five_hour"` is the session limit. Every other type, or none, is `other`.
- `resetsAt` is in epoch seconds.
- `limitOfText` reads `session limit` as the session's. The time `h(:mm)?(am|pm)` gives the next
  instant after `now` with that wall-clock time, in the IANA zone in parentheses, or the server's
  own zone without one. Any other `limit` sentence is `other`.

A `tool_use` of `ScheduleWakeup` emits `{ type: "wakeup", at: now + delaySeconds }` besides its
`toolStart`. A `CronCreate` with `recurring: false` emits its next fire time, from its 5-field
`cron` read in the server's zone; one it cannot read emits nothing. A recurring cron emits nothing.

- [x] **Step 4: Run the tests to check they pass**

- Run: the command of step 2
- Expected: PASS

- [x] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS. The transcript ignores the new events until tasks 7 and 8.

- [x] **Step 6: Commit**

```bash
git add packages/server/src/runner/ fixtures/claude/
git commit -m "feat(worker-lifecycle): read usage limits and one-shot wakeups from Claude Code"
```

## Task 3: Store pending continues in the cache

**Risky:** it changes the stored format of `runner.sqlite`, with a migration, and the claim that
keeps two servers or timers from continuing a run twice.

**Files:**

- Modify: `packages/server/src/runner/migrations.ts`, `runner/cache.ts`, `runner/cache-rows.ts`
- Create: `packages/server/src/runner/cache-turns.ts`
- Test: `packages/server/src/runner/__tests__/cache.test.ts`

**Interfaces:**

- Produces, in `events.ts` or `cache-rows.ts`: `type ContinueReason = "restart" | "limit" | "gate"`.
- Produces on `TurnRow`: `continueAt: number | null` (epoch ms) and
  `continueReason: ContinueReason | null`.
- Produces on `SessionRow`: `automaticContinues: number`.
- Produces on `SessionCache`:
  - `scheduleContinue(turn: number, at: number, reason: ContinueReason): void`.
  - `markCapped(turn: number, reason: ContinueReason): void`: `continue_reason` set, `continue_at`
    null.
  - `takeContinue(turn: number): TurnRow | undefined`: one transaction that clears `continue_at`,
    keeps `continue_reason`, and returns the row. It returns undefined when nothing waited.
  - `cancelContinue(turn: number, { stopped }: { stopped: boolean }): boolean`:
    - clears both columns;
    - with `stopped`, sets the state `stopped` and the reason null, as the human's Stop does;
    - returns whether a continue waited.
  - `dropContinues(reason: ContinueReason): Array<TurnRow>`: clears both columns of every pending
    continue of that reason.
  - `pendingContinues(): Array<TurnRow>`: every turn with `continue_at` set.
  - `latestLimitContinue(from: number): number | undefined`: the latest `continue_at` of a pending
    limit continue at or after `from`.
  - `addContinue(session: string): number`: increments `automatic_continues`, and returns it.
  - `resetContinues(session: string): void`.
- Changes `dismiss`: it also clears both columns.
- Changes `interrupted`: `ended_at` is the turn's last item's `at`, else its `started_at`, else now.

- [x] **Step 1: Move the turn-state writes out of `cache.ts`.** `startTurn`, `reopenTurn`,
      `endTurn`, `dismiss`, and `interrupted` move into `cache-turns.ts`, as functions over `db`
      that `SessionCache` delegates to, following `cache-tokens.ts`. Run
      `nix develop -c vp test packages/server/src/runner/__tests__/cache.test.ts`: PASS. Commit
      alone: `refactor(worker-lifecycle): move the cache's turn-state writes to their module`.

- [ ] **Step 2: Write the failing tests**

"migration 8 adds the continue columns, and a continue is claimed once". It follows "migration 5":
apply `migrations.slice(0, 7)`, insert a session and a turn, then open the cache. Assert:

- the new columns hold their defaults: `continueAt` null, `continueReason` null, and
  `automaticContinues` 0;
- after `scheduleContinue(t, 1000, "limit")`, two caches on the same file each call
  `takeContinue(t)`. One gets the row, with `continueReason: "limit"` and `continueAt: null`. The
  other gets undefined.

A row of "interrupted stops the running turns of gone servers": a running turn whose last item is at
`2026-11-03T01:00:00.000Z` ends at that time.

The break each test catches:

- A claim that reads, then writes, outside one transaction: both callers get the row.
- `interrupted` keeping the start's time: a crash's run reads as cut minutes ago.

- [ ] **Step 3: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/runner/__tests__/cache.test.ts`
- Expected: FAIL. `takeContinue` is not a function.

- [ ] **Step 4: Implement the migration and the methods.** Migration 8:

```sql
ALTER TABLE turns ADD COLUMN continue_at INTEGER;
ALTER TABLE turns ADD COLUMN continue_reason TEXT;
ALTER TABLE sessions ADD COLUMN automatic_continues INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 5: Run the tests, then make the breaks.** For each: PASS, then FAIL with the break,
      then revert. Report the failures in the commit body.

- [ ] **Step 6: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/runner/
git commit -m "feat(worker-lifecycle): keep pending continues in the runner's cache"
```

## Task 4: The continues' settings

**Files:**

- Modify:
  - `crates/core/src/settings.rs`, `crates/core/src/settings/rules.rs`,
    `crates/core/src/settings/file.rs`
  - `crates/binding/src/settings.rs`, then regenerate `packages/binding/index.d.ts` and `index.js`
    with `nix develop -c vp run --filter uraeda-binding build`
  - `packages/server/src/env.ts`, `options.ts`, `settings.ts`, `dev.ts`
  - `packages/server/src/fate/settings-mutations.ts`
  - `docs/web-ui.md`, `.env.example`, `CONTRIBUTING.md`
- Test:
  - `crates/core/tests/settings.rs`
  - `packages/binding/contracts.test.ts`
  - `packages/server/src/__tests__/settings.test.ts`, `settings-fate.test.ts`, `main.test.ts` (the
    `HELP` assertion follows the constant)

**Interfaces:**

- Produces:
  - In the core, `RunSettings` gains `continue_after_restart`, `continue_after_limit`, and
    `continue_before_gate`, each an `Option<bool>`, and `automatic_continues: Option<i64>`.
  - `rules::automatic_continues(typed: &str)` and `rules::automatic_continues_number(n: i64)` refuse
    anything outside 1 to 10, with the problem
    `Automatic continues in a row is a whole number from 1 to 10.`
  - Setters `set_continue(dir, key: ContinueKey, on: bool)` and
    `set_automatic_continues(dir, typed: &str)`.
  - In the binding: `setContinue(dir, key: "restart" | "limit" | "gate", on)`,
    `setAutomaticContinues(dir, typed)`, and `checkedAutomaticContinues(typed): number`.
  - `ServerSettings.runs()` gains `continueAfterRestart`, `continueAfterLimit`, and
    `continueBeforeGate`, each `Setting<boolean>`, and `automaticContinues: Setting<number>`.
  - The fate mutations `settings.setContinue` take `{ key, on }`, and
    `settings.setAutomaticContinues` takes `{ continues: string }`. Both answer the `Settings`
    record.
- Produces the flags and variables of ruling R3:
  - `--no-continue-after-restart` and `URAEDA_CONTINUE_AFTER_RESTART`;
  - `--no-continue-after-limit` and `URAEDA_CONTINUE_AFTER_LIMIT`;
  - `--no-continue-before-gate` and `URAEDA_CONTINUE_BEFORE_GATE`;
  - `--automatic-continues <n>` and `URAEDA_AUTOMATIC_CONTINUES`.

- [ ] **Step 1: Write the failing tests**

- Rows of `reads_each_file`: the four keys read, and a bad value of each refused with its problem.
- `sets_the_automatic_continues`:
  - "4" is written;
  - "0", "11", and "three" are refused with the problem, the file unchanged.
- The contract test's row: `runs` crosses in camelCase, `automaticContinues: 3`.
- Rows of "US2.1 to US2.5" for `runs`:
  - `URAEDA_AUTOMATIC_CONTINUES=5` beats the file's 4;
  - `--automatic-continues 6` beats both;
  - `--no-continue-after-limit` beats the file's `true`;
  - without a value, the defaults are `true` and 3.

The break each test catches:

- A range checked only in the web: the file or a flag holds 0.
- A flag that does not win over the file.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test settings`
- Expected: FAIL to compile, `no field continue_after_restart`

- [ ] **Step 3: Implement the core, the binding, the server's resolution, and the mutations.** Then
      document the keys:
  - the `[runs]` table in `docs/web-ui.md`'s settings sample, and its flags and variables;
  - `.env.example`;
  - `CONTRIBUTING.md`'s variables;
  - `HELP`.

- [ ] **Step 4: Run the tests to check they pass**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test settings`, then
  `nix develop -c vp test packages/binding/contracts.test.ts packages/server/src/__tests__/settings.test.ts packages/server/src/__tests__/settings-fate.test.ts packages/server/src/__tests__/main.test.ts`
- Expected: PASS

- [ ] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add crates/ packages/binding/ packages/server/src/ docs/ .env.example CONTRIBUTING.md
git commit -m "feat(worker-lifecycle): settings to turn off and cap automatic continues"
```

## Task 5: Agents wait for background work by its notice

**Files:**

- Modify: `skills/uraeda/references/implementation.md`, in **Each task**

**Interfaces:**

- Produces: nothing other tasks use.

- [ ] **Step 1: Add the rule.** Background work, such as a test suite, a build, or a subagent, is
      started the way the agent's harness tracks: a background command or agent it reports on, never
      a shell's `&`. The agent then ends its turn and waits for the work's notice. It never polls in
      sleep loops, or rereads an output file in a loop: a run blocked in a loop cannot read the
      human's messages. The rule applies to every agent, so it names no tool.

- [ ] **Step 2: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS. The format and the skill's checks hold.

- [ ] **Step 3: Commit**

```bash
git add skills/uraeda/references/implementation.md
git commit -m "docs(worker-lifecycle): agents wait for background work by its notice"
```

## Task 6: A waiting run reads in progress; the cap asks

**Files:**

- Modify:
  - `packages/server/src/runner/status.ts`
  - `packages/server/src/fate/session-reads.ts`, `feature-status.ts`, `needs-you.ts`, `sessions.ts`,
    `views.ts`
  - `packages/web/src/views.ts`, which selects the new fields
- Create: `packages/web/src/wait.ts`, with `waitLabel`
- Test:
  - `packages/server/src/runner/__tests__/status.test.ts`
  - `packages/server/src/__tests__/needs-you.test.ts`
  - `packages/server/src/__tests__/sessions.test.ts`

**Interfaces:**

- Consumes: task 3's `TurnRow.continueAt`, `continueReason`, and `SessionRow.automaticContinues`.
- Produces:
  - `StatusReason` gains `"waiting"` and `"capped"`.
  - `sessionStatus`'s `latest` picks `continueAt` and `continueReason`. Its rules:
    - A latest turn with `continueAt` set is
      `{ label: "Waiting", reason: "waiting", status: "working" }`, right after the running and
      queued rule.
    - A latest turn that asks, failed, stopped, or halted, with `continueReason` set and
      `continueAt` null, is `{ label: "Needs attention", reason: "capped", status: "attention" }`,
      until dismissed.
  - `continuable(status: { reason: StatusReason | null; status: SessionStatus }): boolean`: true for
    `attention` with `failed`, `stopped`, `interrupted`, `halted`, or `capped`. It is exported for
    the web through `uraeda-server/status`.
  - `type Wait = { at: string; reason: ContinueReason }`, with `at` in ISO 8601.
  - `FeatureStatus` and `SessionRecord` gain `wait: Wait | null`, and `SessionRecord` gains
    `automaticContinues: number`.
  - `needs-you`'s message for `capped` is `The agent keeps stopping`.
  - On the web, `waitLabel(wait: Wait): string` gives `Waiting until 8:41`, with the time in the
    reader's locale. Tasks 10 and 11 use it.

- [ ] **Step 1: Write the failing tests**

- Rows of `status.test.ts`:
  - "a turn waiting to continue": `ended("failed")` with `continueAt` set gives
    `{ label: "Waiting", reason: "waiting", status: "working" }`.
  - "a turn the cap stopped": `continueReason: "limit"` and `continueAt: null` give `capped`.
- A row of `needs-you.test.ts`'s `needsYouReason` table: "a waiting run" gives undefined.
- "a run waiting to continue makes its feature Working, with when it goes on": seed a failed turn of
  `2026-10-12-cli-tuis` with `scheduleContinue`. `statusesOf` reads `status: "working"`, and
  `wait: { at, reason: "limit" }`.

The break each test catches:

- A waiting turn read by its failed state: it asks, notifies, and counts in the title.
- A feature status that drops `wait`: home cannot say when.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/runner/__tests__/status.test.ts packages/server/src/__tests__/needs-you.test.ts packages/server/src/__tests__/sessions.test.ts`
- Expected: FAIL. The waiting row reads `Needs attention`.

- [ ] **Step 3: Implement the rules, the records, and the web's selections**

- [ ] **Step 4: Run the tests to check they pass**

- Run: the command of step 2
- Expected: PASS

- [ ] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/ packages/web/src/
git commit -m "feat(worker-lifecycle): a run waiting to continue reads in progress"
```

## Task 7: The idle close waits for a pending wakeup

**Files:**

- Modify: `packages/server/src/runner/session-state.ts` (`Proc`),
  `packages/server/src/runner/transcript.ts`, `packages/server/src/runner/turns.ts` (`next`)
- Test: `packages/server/src/runner/__tests__/sessions.test.ts`

**Interfaces:**

- Consumes: task 2's `{ type: "wakeup"; at: string }` event.
- Produces: `Proc.wakeup?: number`, the latest pending one-shot wakeup in epoch ms. `Turns.next`
  arms the idle close at the later of 15 minutes and a minute after the wakeup.

- [ ] **Step 1: Write the failing test**

"US6.1: a pending wakeup keeps the idle process open until it fires":

- the turn emits `{ type: "wakeup", at: now + 25 min }` and ends;
- after `IDLE_CLOSE_MS`, `adapter.closes` is 0;
- the wakeup's output at 25 minutes reopens the turn with `RESUMED`, the way a background task's
  does;
- 15 minutes after that turn ends, `closes` is 1.

The break it catches: an idle close that ignores the wakeup and closes at 15 minutes.

- [ ] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test packages/server/src/runner/__tests__/sessions.test.ts -t US6.1`
- Expected: FAIL, `expected 1 to be 0` on `closes`

- [ ] **Step 3: Implement it.** The transcript records the wakeup on the process. A wakeup in the
      past is dropped. "US1.7 and C1" keeps passing: no wakeup, a close at 15 minutes.

- [ ] **Step 4: Run the runner's session tests**

- Run: `nix develop -c vp test packages/server/src/runner/__tests__/sessions.test.ts`
- Expected: PASS

- [ ] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/runner/
git commit -m "fix(worker-lifecycle): an idle agent stays open for its pending wakeup"
```

## Task 8: The continuer: usage limits, the cap, and the cancels

**Risky:** concurrency between timers, the human's messages, and other servers on one cache. It also
sends messages to an agent without the human.

**Files:**

- Create: `packages/server/src/runner/continuer.ts`
- Modify:
  - `runner/message.ts`, for the continue messages and lines
  - `runner/send.ts`, for the continue's delivery
  - `runner/session-state.ts`: `SessionContext.continuer`, and `Running.limit`
  - `runner/transcript.ts`, which records the `limit` event on the running turn
  - `runner/turns.ts` (`end`), which reports to the continuer
  - `runner/sessions.ts`: the `runs` option; `send`, `stop`, and `dismiss` cancel; `startContinues`;
    `runsChanged`
  - `packages/server/src/server.ts`, `live.ts`, `testing.ts`
  - `runner/__tests__/helpers.ts`: the continues off by default (ruling R4), and a `restart(cache)`
    helper
- Test: `packages/server/src/runner/__tests__/continuer.test.ts`

**Interfaces:**

- Consumes:
  - task 1's `Sessions`;
  - task 2's `limit` event and `Limit`;
  - task 3's cache methods;
  - task 4's `ServerSettings.runs()`;
  - task 6's statuses, which the tests read through `sessionStatus` where useful.
- Produces:
  - In `message.ts`: `continueMessage(reason: ContinueReason): string` and
    `continuedLine(reason: ContinueReason): string`, the exact texts of the global constraints.
  - `type ContinueSettings = { afterRestart: boolean; afterLimit: boolean; beforeGate: boolean; cap: number }`.
  - `new Sessions({ ..., runs?: () => ContinueSettings })`. The default is all on, cap 3.
    `createSessions` passes the `inForce` values of `settings.runs()`.
  - `Sessions.startContinues(): Promise<void>`: called by `startSessions` after `check()`. It arms
    every pending continue. Task 9 adds the restart scan to it.
  - `Sessions.runsChanged(): void`: called on `settings.onChange`. It drops the pending continues of
    each kind now off.
  - In `continuer.ts`:
    - `Continuer.ended(live: Live, turn: TurnRow, limit?: Limit): Promise<void>`, called by
      `Turns.end` for every turn that ends;
    - `Continuer.cancel(session: string, { stopped }: { stopped: boolean }): void`;
    - `Continuer.fire(turn: number): Promise<void>`;
    - `Continuer.decide(...)`, private, which task 9 extends with the gate and the commit.
  - In `send.ts`:
    `deliverContinue(context, live, { line, reason, stopped }: { line: string; reason: ContinueReason; stopped: TurnRow }): Promise<number>`.
    - It sends `continueMessage(reason)` as an item with `origin: "workflow"`.
    - The turn takes the stopped turn's kind, step, and trigger. An `allow` turn becomes `chat`.
    - The turn opens with `line` as its first system line, whether it starts or queues.
    - A queued continue is not rechecked as a workflow message.

The rules:

1. **When a turn ends failed with a limit** (`Running.limit`, from the transcript, or its process's
   exit after a `limit` event), and its session is its folder's latest, or a chat:
   - a limit of kind `other` changes nothing: it fails and asks, its text as its reason;
   - with `afterLimit` off, the same;
   - when the session's `automaticContinues` is at the cap, `markCapped`;
   - otherwise `scheduleContinue` at the reset plus a minute. With
     `latestLimitContinue(reset + 1 min)` set, it is a minute after that one. Without a reset, the
     continue is an hour from now. A time already past becomes a minute from now.
2. **When the timer fires**:
   - `takeContinue` claims the continue; nothing happens without the claim;
   - `addContinue` counts it;
   - `deliverContinue` sends it with `continuedLine(reason)`.

   A refusal, such as the agent unavailable or the feature dropped, clears the turn's
   `continue_reason`: the turn asks with its own reason.

3. **The cancels**:
   - `Sessions.send` cancels the session's pending continue, and calls `resetContinues`;
   - `Sessions.stop` cancels it with `stopped: true`;
   - `Sessions.dismiss` clears it through the cache's `dismiss`;
   - `runsChanged` calls `dropContinues` for each kind turned off.
4. **Timers** are armed per pending continue, unref'd, and cleared by `Sessions.close`.

- [ ] **Step 1: Write the failing tests, and the helpers they use.** `testSessions(repo, { runs })`
      passes `runs`. `restart(sessions)` calls `closeAll` and builds a second `Sessions` on the same
      cache and adapter. `limitTurn(adapter, limit)` scripts a turn that emits a `limit` event, then
      fails with its text.

```ts
test("US1.1 and US1.2: a session limit waits, then continues a minute after its reset", async () => {
  vi.setSystemTime(new Date("2026-11-03T14:01:00Z"));
  const { adapter, cache, sessions, repo } = await testSessions(fixtureRepo(), { runs: ON });
  const { turn } = await sendLimited(sessions, repo, {
    kind: "session",
    resetsAt: "2026-11-03T23:40:00.000Z",
  });

  expect(cache.turn(turn)).toMatchObject({
    continueAt: Date.parse("2026-11-03T23:41:00Z"),
    continueReason: "limit",
  });
  vi.setSystemTime(new Date("2026-11-03T23:41:00Z"));
  vi.advanceTimersByTime(Date.parse("2026-11-03T23:41:00Z") - Date.parse("2026-11-03T14:01:00Z"));
  await flush();

  expect(adapter.sent.at(-1)?.text).toBe("The usage limit has reset. Continue where you left off.");
  expect(systemLines(cache, latestTurn(cache))).toContain(
    "Continued after the usage limit's reset.",
  );
});
```

Rows of this test:

- no reset: the continue is 1 hour later;
- a reset already past: 1 minute after now.

The others:

- **US1.3**: two features, one reset. Continues at 23:41 and 23:42.
- **A message during a wait** goes at once. No continue follows at the reset: `adapter.sent` holds
  only the human's. `automaticContinues` is back to 0.
- **Stop or a dismiss during a wait**:
  - after Stop, the turn reads `stopped` with reason null, and no continue is sent at the reset;
  - after a dismiss, no continue is sent either.
- **A wait across a restart**: `restart(sessions)`, then `startContinues()`. The continue is sent at
  the reset. A second case starts the new manager after the reset: it continues at once, on the
  first timer tick.
- **A limit that is not the session's**:
  - weekly or model: the turn is `failed` with its text, `continueAt` null, and nothing sent;
  - with `afterLimit` off, the same.
- **US4.1, the cap at 3**: four limits in a row, each continue fired.
  - The fourth turn has `continueReason` set and `continueAt` null.
  - `sessionStatus` reads `capped`.
  - Exactly 3 continue messages were sent.
- **US4.3**: two features waiting.
  - `runs` returns `afterLimit: false`, then `runsChanged()`. Both turns lose `continueAt`, and
    nothing is sent at the reset.
  - Then a third wait at a reset, with `adapter.installed = false` and `sessions.check()` before it.
    The turn asks with its limit's text, `continueReason` null.

The break each test catches:

- The US1.1 test: a continue at the reset itself, or one with no line.
- US1.3: a stagger computed only from the reset, so both continue at 23:41.
- The message test: a continue left armed after the human's message, so two messages go.
- The Stop and dismiss test: a cancel that clears the timer but not the cache, so the next start
  continues it.
- The restart test: waits kept only in memory.
- The other-limit test: a weekly limit read as the session's.
- US4.1: a count incremented at the decision instead of the fire, or never compared to the cap.
- US4.3: a setting read once at start.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/runner/__tests__/continuer.test.ts`
- Expected: FAIL, `continueAt` null on the limited turn

- [ ] **Step 3: Implement the continuer, its wiring, and the server's start.** `startSessions` takes
      the server's `settings`. It passes `runs` to `createSessions`, calls `startContinues()` after
      `check()`, and subscribes `runsChanged` to `settings.onChange`. The subscription is removed on
      `stop`.

- [ ] **Step 4: Run the tests, then make the breaks.** Make each break above that touches the claim,
      the cancel, or the cap: PASS, then FAIL with the break, then revert. Report the failures in
      the commit body.

- [ ] **Step 5: Run the runner's and the server's tests**

- Run:
  `nix develop -c vp test packages/server/src/runner packages/server/src/__tests__/sessions.test.ts packages/server/src/__tests__/dismissed.test.ts`
- Expected: PASS. The helpers keep the continues off for the existing tests.

- [ ] **Step 6: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/
git commit -m "feat(worker-lifecycle): continue a run at its usage limit's reset, within the cap"
```

## Task 9: Continue after a restart, and before a gate

**Risky:** messages sent without the human at every start, and a rule on the count several paths
share.

**Files:**

- Modify: `packages/server/src/runner/continuer.ts`
- Test: `packages/server/src/runner/__tests__/continuer.test.ts`

**Interfaces:**

- Consumes: task 8's `Continuer`, `startContinues`, `deliverContinue`, and helpers.
- Produces: `startContinues()` also continues the turns the restart cut. `Continuer.ended` also asks
  a workflow run to continue to its gate. The count goes back to 0 on a commit.

The rules:

1. **At `startContinues()`**, a turn is cut by the restart when all of these hold:
   - it is `stopped` with the reason `SERVER_STOPPED`, not dismissed, and has no `continue_reason`;
   - it was started, `startedAt` set;
   - `endedAt` is less than 6 hours ago;
   - it is its session's latest turn, not taken back;
   - its session is not archived, and is its folder's latest session, or a chat;
   - `adapter.hasSession(nativeId)` holds.

   With `afterRestart` on and the count under the cap, it gets `scheduleContinue(now, "restart")`
   and fires at once. At the cap, it gets `markCapped`.

2. **When a workflow turn ends `done`**, in its folder's latest session, the feature is read. The
   continuer asks it to go on when all of these hold:
   - its step waits on the agent, and is not `pull-request-unknown`;
   - `beforeGate` is on;
   - the turn before it in the session has no `continue_reason` of `gate`.

   It gets `scheduleContinue(now, "gate")` and fires at once, or `markCapped` at the cap. When the
   turn before was a gate continue, nothing happens: the run reads `halted`.

3. **The count**: before each decision, the feature's worktree commit is read with
   `binding.checkoutCommit`. When it differs from the one recorded at the session's last continue,
   the count goes back to 0. The commit is recorded at each fire, in memory (ruling R5).

- [ ] **Step 1: Write the failing tests**

"US2.1: a run the restart cut continues at the next start, with its line":

- a running workflow turn of `2026-10-12-cli-tuis`, then `restart(sessions)` and `startContinues()`;
- the last message sent is `The server restarted while you worked. Continue where you left off.`;
- the new turn's first system line is `Continued after the server restarted.`

Rows where nothing is sent and the turn stays `interrupted`:

- cut 7 hours before;
- `adapter.sessions` without its native ID;
- an older session of the folder;
- a queued turn that never started.

"US3: a run that stops before its gate is asked once, and a second stop asks for you":

- a workflow turn at `plan` ends `done`;
- the gate's message is sent, with the line
  `The run stopped before a human gate. Uraeda asked it to continue to the next one.`;
- that turn ends `done` too, and nothing more is sent;
- `sessionStatus` reads `halted`.

"US4.2: a commit on the branch sets the count back to 0":

- two gate continues, each on a different feature run: the count is 2;
- `commitOnBranch` on the feature's branch, then the next stop: the count read before it is 0;
- the stop continues.

The break each test catches:

- US2.1: the restart scan reading every stopped turn, so a 7-hour-old cut is continued; or a queued
  turn's lost message replaced by "continue".
- US3: the gate continue asked again and again, until the cap.
- US4.2: a count never set back, so a run that commits still reaches the cap.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/runner/__tests__/continuer.test.ts`
- Expected: FAIL. No message is sent after the restart.

- [ ] **Step 3: Implement the rules**

- [ ] **Step 4: Run the tests, then make the breaks.** Make the 6-hour window's and the gate-once
      breaks: PASS, then FAIL with each, then revert. Report the failures in the commit body.

- [ ] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`, and
  `nix develop -c vp test packages/server/src/runner packages/server/src/__tests__/sessions.test.ts`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/runner/
git commit -m "feat(worker-lifecycle): continue a run after a restart, and before its gate"
```

## Task 10: The session's waits and the Runs settings

**Files:**

- Start from: `packages/web/src/RunLifecycle.stories.tsx#WaitingForReset`, `#ContinuedLines`,
  `#CapOnContinues`, and `#RunsSection`
- Modify:
  - `packages/web/src/SessionAttention.tsx`, `packages/web/src/useDismiss.ts`,
    `packages/web/src/TurnLines.tsx`
  - `packages/web/src/sidebar/ItemCard.tsx`, or wherever `StatusMark`'s label is read
  - `packages/web/src/settings/RunSettings.tsx`, `ServerSettings.tsx`, `SettingsPage.tsx`,
    `optimistic.ts`, `categories.ts`
  - `docs/web-ui.md`

**Interfaces:**

- Consumes:
  - task 4's settings record and mutations;
  - task 6's `wait`, `waitLabel`, `automaticContinues`, and the `waiting` and `capped` reasons;
  - task 8's lines.
- Produces: nothing other tasks use.

What the views show:

- **A status mark** of a waiting session or feature reads `waitLabel(wait)`.
- **The session's banner** above the composer:
  - waiting for a limit: `info`, title `Waiting for the usage limit's reset.`, and the text
    `The run continues by itself at {time}. A message you send now goes to the agent at once, and Stop cancels the wait.`;
  - a restart's and a gate's waits last seconds, and show no banner (ruling R8);
  - `capped`: `warning`, title `The agent keeps stopping.`, and the text
    `Uraeda continued it {automaticContinues} times in a row without a commit or a message from you, and stops there. Read its last message, then tell it how to go on, or dismiss this.`
    Dismiss shows when the turn failed or stopped (ruling R9).
- **A waiting turn's ending** shows its reason without `Failed:`, such as the limit's text.
- **The Runs settings** gain the mockup's three switches and the number, with their exact labels and
  help.
  - The number commits its value on blur or Enter, refused values shown as the port's are.
  - A flag or a variable shows the "Set by … for this run" note, as the server's rows do.
  - The rows go under "Build in a fresh session", with the footer
    `A change applies at once: turning one off cancels the waits it started.`

- [ ] **Step 1: Build the views from the stories, wired to the records and mutations**

- [ ] **Step 2: Review them in the sandbox.** Run `nix develop -c vp run sandbox`. Look at a waiting
      run, a capped run, and the Runs section, in both themes, at a phone's and a desktop's width.
      To see the states, seed `continue_at` in the sandbox's `runner.sqlite`.

- [ ] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS. The `categories.test.ts` labels include the new rows.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/ docs/web-ui.md
git commit -m "feat(worker-lifecycle): show waiting runs, the cap, and the Runs settings"
```

## Task 11: Continue all, and home's waiting runs

**Files:**

- Start from: `packages/web/src/RunLifecycle.stories.tsx#Home` and `#ContinueAllPreview`
- Create: `packages/server/src/fate/continue-all.ts`
- Modify:
  - `packages/server/src/fate/mutations.ts`, which registers it
  - `packages/web/src/home/Core.tsx` and `HomeHub.tsx`
  - `docs/web-ui.md`
- Test:
  - `packages/server/src/__tests__/continue-all.test.ts`
  - `packages/web/src/__tests__/continue-all.test.tsx`

**Interfaces:**

- Consumes: task 6's `continuable`, `FeatureStatus.wait`, and `waitLabel`.
- Produces: the repository mutation `feature.continueAll`, with input `{}`. It answers the
  `Workspace` record.
  - It sends each feature of the repository whose `FeatureStatus` is `continuable` the step's
    recommended message, with `recommendedMessage`, through `ctx.sessions.send` to its latest
    session. That is the message the step's start sends.
  - It skips the features at a gate, blocked, or working.
  - A feature refused, for example while another session works, is skipped. The others go on.

The views:

- **Needs you's pane** has `Continue all` in its border when a row is `continuable`.
- **While the button is under the pointer or focused**:
  - the rows it continues get `pickedStyles.picked`;
  - every other row of home is dimmed to an opacity of 0.4;
  - both fade in 150 ms, at once with reduced motion.
- **In progress**: a waiting feature's detail is its task, then
  `waiting for the usage limit, until {time}` for a limit.

- [ ] **Step 1: Write the failing tests**

"US5: Continue all sends each stopped run its step's message, and none to a gate":

- `2026-10-12-cli-tuis` has a failed turn, `Not logged in · Please run /login`;
- `2026-10-11-web-ui` waits on the human;
- after `feature.continueAll`, `adapter.sent` holds one message, the plan step's
  `/uraeda Continue the feature`, sent to the first feature's session.

"Continue all's preview tints the runs it continues and dims the rest": render home's core with one
continuable and one gate feature, then hover `Continue all`. The continuable row carries the picked
style, and the gate's row the dimmed one.

The break each test catches:

- The server test: a rule that sends to every Needs you row, so the gate gets a message.
- The web test: a preview that picks rows by a rule of its own, not `continuable`.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test packages/server/src/__tests__/continue-all.test.ts packages/web/src/__tests__/continue-all.test.tsx`
- Expected: FAIL. `feature.continueAll` is not a mutation.

- [ ] **Step 3: Implement the mutation and the views**

- [ ] **Step 4: Run the tests to check they pass, then review home in the sandbox,** in both themes,
      at a phone's and a desktop's width.

- [ ] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/ packages/web/src/ docs/web-ui.md
git commit -m "feat(worker-lifecycle): continue every stopped run from home"
```
