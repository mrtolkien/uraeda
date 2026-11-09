---
kind: feature
finished: 2026-11-04
pull-request: https://github.com/mrtolkien/uraeda/pull/91
supersedes: [2026-10-13-chat-in-the-web-ui, 2026-10-30-feature-state]
superseded-by: [2026-11-08-agents-fix]
---

# Record: Worker lifecycle

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-03, finished on
> 2026-11-04, in [its pull request](https://github.com/mrtolkien/uraeda/pull/91). Its full files are
> in git: `git log -- specs/2026-11-03-worker-lifecycle/`.
>
> Superseded in part by [2026-11-08-agents-fix](2026-11-08-agents-fix.md).

## What and why

Agent runs stopped for reasons outside the work, and each stop waited for the human to type
"Continue", often overnight. A server restart killed the runs it hosted, a Claude Code session limit
failed them until its reset, and agents ended their turn before the next human gate or polled their
background work in loops. In the 18 days before the feature, that was about 14.5 hours idle after
limits, 7 runs killed by restarts, and 19 hours in wait loops. Uraeda now continues those runs by
itself, says so in each session, and lets the human cap and turn off each kind of continue. Run
options and scheduled jobs, also in the proposal, became proposals of their own.

## Behaviour

- **A session limit waits for its reset, then continues.** A run Claude Code refuses for the session
  limit reads in progress, "Waiting until 8:41", the time it continues: a minute after the reset, or
  an hour later without a readable reset, and never sooner than a minute from now. The session shows
  the banner "Waiting for the usage limit's reset."; home's In progress reads "Task 4 of 9 · waiting
  for the usage limit, until 8:41". At that time Uraeda sends "The usage limit has reset. Continue
  where you left off.", and the session's line reads "Continued after the usage limit's reset." The
  runs waiting for the same reset go a minute apart; a later wait, as one without a reset, never
  delays them. A wait survives a restart; the waits overdue at the start go a minute apart, the
  first at once, each reading its new time. A weekly limit, a limit on one model family, or any
  other limit fails the run and asks for the human, as before. A request let through on usage
  credits is no refusal. The human's message during a wait goes at once and drops the continue, but
  a refused message puts the wait back. Stop during a wait ends it: "You stopped the agent."
- **A run cut by a server restart continues at the next start.** A run cut less than 6 hours before,
  counted from its last activity, whose agent still has its session, gets "The server restarted
  while you worked. Continue where you left off." once the server starts and the agent works. Its
  line reads "Continued after the server restarted." When the agent is unavailable at the start, the
  cuts continue once a check finds it back. Only the latest session of a feature continues, only in
  a repository the server lists, and never a turn still queued at the cut, whose message the agent
  never read. Chats continue too. A run not continued reads "The server stopped the agent." until
  dismissed, as before.
- **A workflow run that ends before its gate is asked once to go on.** When its step still waits on
  the agent, Uraeda sends "You stopped before the next human gate. Continue to it.", with the line
  "The run stopped before a human gate. Uraeda asked it to continue to the next one." If that
  continue's turn stops before the gate again, the run reads "The agent stopped before a human
  gate." and asks for the human. A run whose open process waits for a wakeup its agent set is not
  asked: it reads in progress, "Waiting", and its gate continue is decided when the resumed turn
  ends. Stop on such a run closes its process, drops the wakeup, and reads "You stopped the agent."
- **The human caps and turns off each kind of continue.** Under Runs in the settings, "Continue
  after a restart", "Continue after a usage limit", and "Continue before a human gate" are on by
  default; "Automatic continues in a row", 1 to 10, is 3. They are `[runs]` keys of `config.toml`,
  with flags, `--no-continue-after-restart`, `--no-continue-after-limit`,
  `--no-continue-before-gate`, and `--automatic-continues <n>`, and variables,
  `URAEDA_CONTINUE_AFTER_RESTART` and the like, which read `true` or `false`, any other value
  stopping the start. Past the cap, the run reads "The agent keeps stopping." and asks for the
  human, offering Dismiss on its session's banner only when its turn failed or stopped. A commit in
  the feature's worktree, or the human's message, sets the count back to 0; a commit made before a
  restart is not seen after it. Turning a switch off ends its pending waits at once, and those runs
  ask. A run the human stopped or dismissed never continues by itself. A waiting run never notifies
  and adds no count to the tab's title.
- **Continue all, in the border of home's Needs you pane, continues every stopped run at once.** It
  sends each feature whose run failed, was cut, stopped, halted, or capped, and whose step waits on
  the agent, its step's message, as starting the step sends it, in its latest session. A run that
  failed at a human gate, a chat, a blocked run, and a run at work get nothing. While it is under
  the pointer or focused by a key, the runs it sends are tinted and every other row of home is
  dimmed, fading in 150 ms. On a touch screen, the first tap shows that preview and sends nothing; a
  second tap sends, and a tap elsewhere or 4 seconds end it. A screen reader hears the runs it
  continues in its description. A refusal, as without the agent, and the runs it could not continue,
  by name with why, show in a toast.
- **Agents wait for their background work by its notice.** The skill's implementation step says to
  start work the agent's harness tracks, end the turn, and wait for its notice, never polling. An
  idle agent process with a pending one-shot wakeup, Claude Code's `ScheduleWakeup` or a
  `CronCreate` with `recurring: false`, stays open until a minute after it, instead of closing after
  15 minutes. A recurring cron, a sub-agent's wakeup, or a wakeup more than a day ahead holds
  nothing open.

## Design

Uraeda stays the one that continues runs: it reads why each turn stopped, stores when to continue it
in the runner's cache, and sends the session a message then, which works with any agent. Agents
still stop with the server: outliving it was rejected. The cache is the authority on every pending
continue, and timers in memory only wake a server to claim one. A claim is one transaction, so a
continue goes once whatever server or timer looks, and a message, Stop, a dismiss, or a switch
turned off cancels a wait by clearing its column. The [run lifecycle](../decisions/run-lifecycle.md)
decision holds the rules.

- **The stop reader**, in the Claude adapter,
  [`runner/claude-limits.ts`](/packages/server/src/runner/claude-limits.ts) and
  [`claude-events.ts`](/packages/server/src/runner/claude-events.ts), turns Claude Code's limit
  reports into an agent-neutral `limit` event, `session` or `other`, with its reset. It reads, in
  order, an assistant line's typed `usage_limit_reached` error and its `rate_limit_info`, a rejected
  `rate_limit_event`, then the text, "You've hit your session limit · resets 8:40am (Asia/Tokyo)" or
  an older "5-hour limit reached ∙ resets 3am". A one-shot wakeup becomes a `wakeup` event.
- **The continuer**, [`runner/continuer.ts`](/packages/server/src/runner/continuer.ts), owns the
  switches, the cap and what sets it back, the 6-hour window, the stagger, and the cancels.
  `Turns.end` reports each end to `ended`; `Sessions.send`, `stop`, and `dismiss` cancel through
  `takeOver` and `cancel`; the server calls `startContinues` once its repositories are open. What
  its decisions read, the limit's time and the worktree's commit, is in
  [`continue-reads.ts`](/packages/server/src/runner/continue-reads.ts).
- **The cache**: migration 8 adds `continue_at` and `continue_reason` to `turns` and
  `automatic_continues` to `sessions`, with their queries in
  [`runner/cache-turns.ts`](/packages/server/src/runner/cache-turns.ts). A continue's turn is queued
  and counted in the same step that claims it, so the run never reads stopped between them.
- **The messages and lines**, `continueMessage` and `continuedLine` in
  [`runner/message.ts`](/packages/server/src/runner/message.ts), next to the steps' messages, and
  delivered by `deliverContinue` in [`runner/send.ts`](/packages/server/src/runner/send.ts), queued
  behind another session of the worktree as any message is.
- **The session status**, still decided in one place,
  [`runner/status.ts`](/packages/server/src/runner/status.ts): a turn with `continue_at` reads
  `working`, reason `waiting`, and a turn past the cap `attention`, reason `capped`. `continuable`
  and `continuedByAll` pick Continue all's runs, for the server and the web's preview alike. While a
  turn's continue is decided, the session's changes are held and published after it, so no view
  reads the run failed in between.
- **The idle close**, in [`runner/turns.ts`](/packages/server/src/runner/turns.ts), waits for a
  pending wakeup plus a minute, its limits in
  [`session-state.ts`](/packages/server/src/runner/session-state.ts).
- **Continue all** is the repository mutation `feature.continueAll`,
  [`fate/continue-all.ts`](/packages/server/src/fate/continue-all.ts), answering the runs it
  refused, and the button with its preview,
  [`home/ContinueAll.tsx`](/packages/web/src/home/ContinueAll.tsx), placed by
  [`home/Core.tsx`](/packages/web/src/home/Core.tsx).
- **The session view**: the capped and limit banners in
  [`SessionAttention.tsx`](/packages/web/src/SessionAttention.tsx), and the wait's label in
  [`wait.ts`](/packages/web/src/wait.ts).
- **The settings**: the keys and their rules in the core,
  [`crates/core/src/settings.rs`](/crates/core/src/settings.rs); the flags and variables in
  [`options.ts`](/packages/server/src/options.ts), [`env.ts`](/packages/server/src/env.ts), and
  [`settings.ts`](/packages/server/src/settings.ts); the rows in
  [`settings/RunSettings.tsx`](/packages/web/src/settings/RunSettings.tsx).
- **The session manager** was split first, its folder sessions moved to
  [`runner/session-folders.ts`](/packages/server/src/runner/session-folders.ts), to stay under the
  500-line limit.
- **The skill's rule** on background work, in
  [the implementation step](/skills/uraeda/references/implementation.md).
- **The mockups** stay as stories,
  [`RunLifecycle.stories.tsx`](/packages/web/src/RunLifecycle.stories.tsx).

Tradeoffs accepted: a restart's continue redoes the tool call it cut and any background agent;
Claude Code's limit events can change between versions, a best effort; only one-shot wakeups hold a
process open.

## Replaced behaviour

The tests below were kept: the test helpers, `testSessions` and `testServer`, start with every
continue off, so they still guard each path where a continue is off or not allowed. The lifecycle's
tests turn the continues on. No test was removed.

- **A run cut by a server restart asks for the human until dismissed.** Guarded by
  `packages/server/src/runner/__tests__/status.test.ts`, "a turn the server stopped (US2.1)", and
  `packages/server/src/__tests__/sessions.test.ts`, "a running session makes its feature Working
  everywhere, then it follows its latest".
- **A usage limit fails the run.** Guarded by
  `packages/server/src/runner/__tests__/sessions.test.ts`, "the process exits during a turn: it
  fails with its stderr".
- **A workflow run ending before its gate asks for the human at once.** Guarded by
  `packages/server/src/runner/__tests__/status.test.ts`, its halted rows.
- **An idle process closes after 15 minutes, a background task aside.** Guarded by
  `packages/server/src/runner/__tests__/sessions.test.ts`, "US1.7 and C1: an idle process closes
  after 15 minutes, and the next message resumes the same session", which still holds without a
  wakeup.

## Gotchas

- **The stop reader's order** was checked against the installed Claude Code 2.1.317's own SDK
  schema, read from the binary's strings, not against a real limit, which would have spent the
  human's usage. A version that sends none of the three reports retries hourly within the cap. See
  [`claude-limits.ts`](/packages/server/src/runner/claude-limits.ts).
- **One refusal can give two `limit` events**: `parseLine` reads each line alone, and Claude Code
  may report the refusal in a `rate_limit_event`, then in its assistant line. Readers keep the
  turn's last one, the more precise. See
  [`claude-events.ts`](/packages/server/src/runner/claude-events.ts).
- **A text reset read just after its minute** is that reset, not tomorrow's: a reset up to 10
  minutes before now counts, which the continuer turns into a minute from now. See `limitOfText` in
  [`claude-limits.ts`](/packages/server/src/runner/claude-limits.ts).
- **`setTimeout` fires at once past about 24.8 days**: the continuer re-arms a longer wait in steps,
  and a wakeup more than a day ahead holds no process open. See
  [`continuer.ts`](/packages/server/src/runner/continuer.ts) and
  [`transcript.ts`](/packages/server/src/runner/transcript.ts).
- **The claim's race has no test**: `node:sqlite` is synchronous, so one process cannot interleave
  two claims. The guard is the code, one `UPDATE … RETURNING` in a `BEGIN IMMEDIATE` transaction;
  the test with two servers on one cache catches a fire that skips the claim. See
  [`cache-turns.ts`](/packages/server/src/runner/cache-turns.ts).
- **A switch's variable is checked by the server, not the core**: a TOML boolean is typed, so there
  is no text rule to share, and checking it at `ServerSettings.open` keeps `--help` and `--version`
  working with a bad value. See [`settings.ts`](/packages/server/src/settings.ts).

## Questions

### Round 01

#### Q1: Should this feature cover only keeping runs going, with run options and scheduled jobs as features of their own?

**Answer:** A: keeping runs going now, with run options and scheduled jobs as "a very short, concise
proposal" each at the end of the priorities; a scheduled job would be, for example, "a daily
dependencies upgrade + performance pass CRON job".

#### Q2: How should a run survive a server restart?

**Answer:** A: agents stop with the server, and at the next start each run cut less than 6 hours
before continues from its transcript.

#### Q3: What should happen when a run hits a usage limit?

**Answer:** A: Uraeda stores the reset time and continues the session itself at the reset, even
after a restart: "It's life if it's flaky. It's a best effort feature."

#### Q4: Should a run waiting to continue by itself ask for you?

**Answer:** A, never notifying, but read "inside 'in progress', because it's in progress", not as a
status of its own.

#### Q5: What should happen when a run stops before the next human gate?

**Answer:** A: one automatic "continue to the next human gate", then it asks for the human.

#### Q6: How should agents wait for their own background work?

**Answer:** A: a rule in the skill to start tracked background work, end the turn, and wait for its
notice, never polling.

#### Notes

- **A cap on automatic resumes**: "Make it a setting": the cap became a setting, 3 by default.
- **Weekly limits**: "Let's not handle weekly limits for the moment": they fail the run and ask.

## Decisions

- [Run lifecycle](../decisions/run-lifecycle.md), new: Uraeda continues a run after a restart, a
  limit's reset, or an early end, says why, stops after the cap the human set, and never continues a
  run the human stopped or dismissed.
- [Feature status](../decisions/feature-status.md), changed: a run waiting to continue by itself
  reads as in progress, with when it goes on, instead of asking for the human.

## Changes after approval

- The waiting label shows when the run continues, "Waiting until 8:41", not the reset, 8:40: the
  status decision asks for when it goes on, and the stagger moves that time.
- Only a limit's wait has a banner: a restart's or a gate's continue fires within seconds, and shows
  only its line.
- The stagger applies only among the runs of the same reset: a run waiting an hour without a reset
  time no longer pushes a run whose reset is minutes away behind it.
- Waits overdue at a start go a minute apart, the first at once, rather than all at once, and read
  the time they go on.
- An older Claude Code's "5-hour limit" is read as the session's limit, and waits for its reset.
- A request let through on usage credits is not read as a refusal, so the run never waits.
- A restart's continues go only in the repositories the server lists, and when the agent is
  unavailable at the start, they wait until a check finds it back instead of being lost.
- Chats cut by a restart continue too; Continue all continues features only, since a chat has no
  step's message.
- A run whose agent set itself a wakeup is not asked to go on to its gate while the wakeup is
  pending, and reads in progress, "Waiting"; Stop then closes its process and drops the wakeup.
- A gate past the cap is asked again at the next stop after the human's message: "asked once" counts
  the gate continue actually sent.
- A capped run offers Dismiss only on its session's banner, and only when its turn failed or
  stopped; a capped run that ended done before its gate clears with the human's message.
- A commit is seen by the worktree's commit kept in memory, so a commit made before a restart does
  not set the count back after it.
- Continue all leaves a run that failed at a human gate, and sends in the run's own session, never a
  fresh one.
- On a touch screen, Continue all's first tap shows its preview and sends nothing, the second sends;
  a tap's focus shows no preview, only a key's.
- Continue all names the runs it could not continue, with why, in a toast, and the others go on.
- A human message refused, for example while another session works, puts back the wait and the
  count; but a Stop that came while it was read leaves the run stopped.
- A wakeup more than a day ahead holds no process open, and a sub-agent's wakeup none at all.
- A switch's variable that is not `true` or `false` stops the server's start with "`<NAME>` is true
  or false.", after `--help`, `--version`, and the flags.
- A pane's title moves under its actions when it would wrap beside them, as "Needs you · 16" did
  beside Continue all.

## Follow-ups

- The continuer's maps in memory, of commits, takeovers, and Stops by session, never shrink while
  the server runs.
- A feature whose waiting run is in an older session does not show that wait on the feature.
- The web copies the server's rule on which runs Dismiss applies to, in `useDismiss.ts`, instead of
  reading it from the server.
- Editing the feature status decision dropped one of its alternatives considered, "Reading a
  checked-out branch from its disk: it showed branches outside the workflow, and gates not committed
  yet.", for the human to restore or not.
- Code comments still name this feature's rulings by number, as "R19" or "R21", whose file is now in
  git only.
