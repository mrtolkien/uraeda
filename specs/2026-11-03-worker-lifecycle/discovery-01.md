# Discovery, round 01: Worker lifecycle

## Summary

Keeping agent runs alive has five parts in comparable products. Runs survive the host restarting,
wait out provider limits, and report background work as notifications. Each run shows a clear state
(working, waiting, needs you, failed), and the human gets one action to restart what stopped. On top
of that, tools add scheduled jobs and layered run settings (model, effort, session shape) with
global defaults and per-task overrides.

The proposal asks for all of it, written on 2026-10-16. Session data since then
([evidence](#evidence-since-the-proposal)) shows what still hurts:

- usage limits: 9 events, 16 "Continue" prompts, about 14.5 hours idle after resets;
- server restarts: 5 restarts, 7 runs killed, one never resumed;
- polling, which grew to 618 calls.

Early stops before a gate are now rare, and no "Not logged in" happened.

Today the server kills its agents on exit on purpose, and marks their turns stopped at the next
start. It recognizes neither a usage limit nor a login error: both fail the turn
([the code](#the-code)). Claude Code, at version 2.1.317, now ships most of the building blocks.
`--resume` with `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` continues a turn cut mid-way. A structured
`rate_limit_event` gives the reset time, and background work wakes the session
([Claude Code](#claude-code)). Run options and scheduled jobs are separate subsystems
([scope](#the-proposal-holds-three-subsystems)).

## How other products do it

### Claude Code's own background sessions

- `claude --bg` runs a session under a supervisor daemon, which restarts a process that exits
  unexpectedly. `claude agents --json` is "the supported way to read session state from outside
  Claude Code" ([agent view](https://code.claude.com/docs/en/agent-view.md)).
- It cannot be combined with `-p`: no stream-json, so output comes from `claude logs` or the
  transcript. Agent view is a research preview, and sessions stop if no supervisor reconnects within
  about a minute.
- A restarted session "is told it was restarted"; an interrupted response older than about 1 hour is
  not resumed. Idle processes stop after about 1 hour and resume on the next attach.

### Claude Code interactive sessions

- At a usage limit, interactive sessions wait and continue on their own (`autoContinueAtUsageLimit`,
  on by default since 2.1.234). "After three automatic continuations, automatic continue stops"; the
  count resets with a prompt. No wait for a reset more than 24 hours away
  ([interactive mode](https://code.claude.com/docs/en/interactive-mode.md)).
- Not offered for "Background sessions and `-p` runs", which is how Uraeda runs Claude Code.
- The wait is not durable: quitting Claude Code drops it.

### Vibe Kanban

- Sessions read Running, Idle, or Needs Attention, with sound and browser push on completion, needs
  attention, or error ([sessions](https://vibekanban.com/docs/workspaces/sessions.md),
  [general settings](https://vibekanban.com/docs/settings/general.md)).
- Named agent profiles bundle model, permissions, and an appended prompt; a global default is
  overridden per attempt, storing only the overrides
  ([agent configurations](https://www.vibekanban.com/docs/configuration-customisation/agent-configurations.md)).
- The docs advise a new session when the context gauge turns orange or red.

### Claude Squad and CCManager

- Claude Squad runs each agent in tmux, so it survives the UI closing
  ([README](https://github.com/smtg-ai/claude-squad)).
- CCManager writes its session list "as sessions come and go, not on exit", and on restart offers to
  re-run each command, resuming only when the preset passes `--resume`
  ([README](https://github.com/kbwo/ccmanager)).

### OpenClaw

- A heartbeat, a check every 30 minutes by default, became ordinary scheduled jobs. Each has its own
  schedule, checklist, delivery, and history, with `activeHours`, `idleOnly`, and a "nothing to
  report" outcome that sends nothing ([automation](https://docs.openclaw.ai/automation.md),
  [heartbeat](https://docs.openclaw.ai/gateway/heartbeat.md)).
- Jobs choose their model and thinking level.

### Devin, Jules, and cloud routines

- Devin's scheduled sessions became automations with a schedule trigger. They show an error status
  after consecutive failures, and email on failure by default
  ([scheduled sessions](https://docs.devin.ai/product-guides/scheduled-sessions.md)).
- Devin's dynamic workflows record every agent call and replay completed ones on resume
  ([dynamic workflows](https://docs.devin.ai/work-with-devin/dynamic-workflows.md)).
- Jules shows each scheduled task's last and next run
  ([scheduled tasks](https://jules.google/docs/scheduled-tasks/)).
- Claude Code's cloud scheduled tasks run in a fresh clone, never on local files, at most once an
  hour ([routines](https://code.claude.com/docs/en/routines.md)).

### Per-step models and session shape

- Cline uses a different model for Plan and Act
  ([plan and act](https://docs.cline.bot/core-workflows/plan-and-act)); Aider an architect and an
  editor model ([modes](https://aider.chat/docs/usage/modes.html)).
- Roo's orchestrator hands each subtask only its instructions, "to prevent context poisoning"
  ([boomerang tasks](https://roocodeinc.github.io/Roo-Code/features/boomerang-tasks)).
- Superpowers gives each task a fresh subagent, and asks to "always specify the model explicitly"
  ([subagent-driven development](https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md)).
- Claude Code advises a fresh session to build from a written spec
  ([best practices](https://code.claude.com/docs/en/best-practices.md)).

### Usage-limit resume tools

- claude-auto-resume parses the limit message's timestamp, counts down, then runs
  `claude -p "continue"`; its README warns that the parsing is fragile
  ([repository](https://github.com/terryso/claude-auto-resume)).
- claude-auto-retry watches a tmux pane and sends "continue" at the reset (seen only in a search
  snippet).
- Anthropic's issue asking for auto-resume asked for "max-retries/max-wait to prevent infinite
  loops" ([#38263](https://github.com/anthropics/claude-code/issues/38263)).

### What they have in common

1. Agents survive the host restarting, by a supervisor, tmux, or a resume from a stored session ID.
2. A resumed session knows it was resumed, and a stale interrupted turn is not replayed.
3. Clear states per run, including one for waiting on a limit, and notifications only for asks.
4. Limits: the reset time shown, an automatic continue at the reset, a cap on automatic continues,
   and a way to cancel.
5. Background work reported back as a notification, never by polling.
6. One action to restart what stopped.
7. Scheduled jobs with a schedule, a history, and a quiet "nothing to do".
8. Layered run settings: a global default, per-task overrides, a model per role.
9. Fresh context for each discrete step, with the state handed over in files.

## Standards and libraries

### Claude Code

The installed version (`claude --version`). Docs fetched from `https://code.claude.com/docs/en/`.

- **Resume.** `--resume <id>` continues a session in any project. "A tool that was still running
  when the previous process ended ... doesn't get rerun", and background work that died shows as "a
  note that it didn't finish" ([sessions](https://code.claude.com/docs/en/sessions.md)).
  `CLAUDE_CODE_RESUME_INTERRUPTED_TURN=1` continues an interrupted turn without a new prompt, and
  `CLAUDE_CODE_RESUME_INTERRUPTED_TURN_MAX_AGE_MS` keeps "a restart against an old transcript" from
  re-running a stale prompt ([environment variables](https://code.claude.com/docs/en/env-vars.md)).
- **Not restored on resume**: `--plugin-dir`, `--add-dir`, `--settings`: pass them again. The runner
  already does.
- **Signals.** SIGTERM leaves the turn unfinished, exit code 143; SIGINT ends it
  ([headless](https://code.claude.com/docs/en/headless.md)).
- **Usage limits.** `rate_limit_event.rate_limit_info.status` is `allowed`, `allowed_warning`, or
  `rejected`, with `resetsAt` in epoch seconds
  ([TypeScript SDK](https://code.claude.com/docs/en/agent-sdk/typescript.md)). The text reads
  `You've hit your session limit · resets 3:45pm`, or weekly, or per model family
  ([errors](https://code.claude.com/docs/en/errors.md)). Assistant messages carry
  `error: "rate_limit"`, or `authentication_failed` for login errors.
- **Known gap**: `-p` can exit 1 on a weekly limit with no event or result on stdout, the message
  only in the transcript ([#103820](https://github.com/anthropics/claude-code/issues/103820), open).
- **Retry watchdog.** `CLAUDE_CODE_RETRY_WATCHDOG=1` retries 429 errors indefinitely, waiting "until
  the limit resets when the response carries a rate-limit reset time" (environment variables). It
  fails at once on a spend-limit 429, and an open issue says subscriptions without extra usage are
  treated that way ([#104690](https://github.com/anthropics/claude-code/issues/104690)).
- **Background work.** With stdin open, as the runner keeps it, the process stays alive, and a
  finished background task starts a new turn whose result has `origin.kind: "task-notification"`.
  Once stdin closes, `-p` waits for background work, but stops it after 10 idle minutes unless
  `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` (headless). An open issue reports subagents killed at
  that cap while the result says success
  ([#94392](https://github.com/anthropics/claude-code/issues/94392)).
- **Wakeups and crons.** Session-scoped wakeups and crons "only fire while Claude Code is running
  and idle", with no catch-up
  ([scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks.md)). The
  `background_tasks_changed` event lists background commands, subagents, and workflows; the Stop
  hook's input lists `session_crons` apart from `background_tasks`
  ([hooks](https://code.claude.com/docs/en/hooks.md)).
- **Hooks.** A Stop hook can return `decision: "block"` to keep Claude going, capped at 8 blocks in
  a row; API errors fire `StopFailure` instead, with no decision control (hooks). A PreToolUse hook
  can refuse a tool call with a reason.
- **Model and effort.** `--model` and `--effort low|medium|high|xhigh|max`; subagents take their own
  model ([model configuration](https://code.claude.com/docs/en/model-config.md),
  [subagents](https://code.claude.com/docs/en/sub-agents.md)).

### Temporal and pm2

- Temporal's Continue-As-New starts a fresh history with carried-forward state, to avoid history
  bloat ([continue-as-new](https://docs.temporal.io/workflow-execution/continue-as-new)): the
  analogue of a fresh session per step with state in files.
- pm2 restarts with exponential backoff, reset after 30 s of stable uptime
  ([restart strategies](https://pm2.keymetrics.io/docs/usage/restart-strategies/)).

## The code

### Important reads

- [`runner/claude.ts`](/packages/server/src/runner/claude.ts): spawns
  `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --permission-mode auto --plugin-dir … --add-dir …`,
  with `--resume <id>` when the transcript exists, else `--session-id` (lines 42-65). Each process
  gets its own group (`detached: true`, never `unref()`'d). `endWithServer` (lines 17-34) sends
  SIGTERM to every group on the server's exit, "in groups of their own, they would outlive it".
  `ClaudeAdapter.open()` carries an `oxlint-disable-next-line max-lines-per-function` marker (line
  194), which a task touching it must remove by splitting first.
- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts): 499 lines, one under the 500-line
  limit of [code quality](/specs/decisions/code-quality.md). `closeAll` (lines 446-463) stops queued
  and running turns with `SERVER_STOPPED`. Anything added here needs a split first.
- [`runner/cache.ts`](/packages/server/src/runner/cache.ts): 480 lines. `interrupted` (lines
  457-474) marks every `running` or `queued` turn `stopped` at the next start, unless a live server
  holds the session. The tables are `sessions`, `turns` (states
  `queued | running | done | failed | stopped`), and `items`
  ([migrations](/packages/server/src/runner/migrations.ts)).
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts): opens a process per session,
  claims it with the server's PID, and on exit fails the running turn with stderr. It also keeps the
  usage windows from `rate_limit_event` (lines 46-94), shown in the sidebar and home.
- [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts): parses
  `rate_limit_event` into usage only, keeping `utilization` and `resetsAt`; nothing reads
  `status: "rejected"`. `auth_status` is dropped (lines 170-171). `system/api_retry` becomes a
  "retrying" line.
- [`runner/transcript.ts`](/packages/server/src/runner/transcript.ts): a failed result fails the
  turn with its text as reason (lines 318-365), so a limit and a login error read as any failure. A
  successful result with background tasks still running keeps the turn open (lines 338-344).
- [`runner/turns.ts`](/packages/server/src/runner/turns.ts): the idle close, 15 minutes after a turn
  ends (`IDLE_CLOSE_MS`), waits only for `proc.background` (lines 217-221). That map comes from
  `background_tasks_changed`, which does not list wakeups or crons. A wakeup set for longer than 15
  minutes therefore dies with the process (judgement, matching leader-key's 1500 s wakeup).
  `Turns.resume` reopens an ended turn when output arrives after it (lines 98-108), with no test.
- [`runner/status.ts`](/packages/server/src/runner/status.ts): session statuses
  `working | needs-you | attention | unread | idle`, reasons
  `blocked | step | failed | stopped | interrupted | halted`. `halted` is a workflow turn that ended
  while the step still waits on the agent: the early-stop case, already detected.
- [`runner/message.ts`](/packages/server/src/runner/message.ts): `runMessage` builds each step's
  prompt, "Stop when <gate>, and earlier only if you need a decision from me".
- [`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts) and
  [`SessionAttention.tsx`](/packages/web/src/SessionAttention.tsx): a stopped or failed run asks
  until dismissed; the only action is Dismiss. The human types a message to continue. The feature
  page's [Continue](/packages/web/src/feature/NextPane.tsx) only fills the composer.
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs): `[runs]` holds only
  `build_in_fresh_session`. The settings page lists planned rows for models, session shape, and
  reviews ([categories](/packages/web/src/settings/categories.ts), lines 129-162).
- [`fate/starts.ts`](/packages/server/src/fate/starts.ts) and
  [`runner/send.ts`](/packages/server/src/runner/send.ts): turns go to the feature's latest session;
  a fresh session only for the approval and plan steps, per `build_in_fresh_session` (default on).

### The proposal's path and existing actions

- **Restart.** Today: SIGTERM to every agent, turns marked `stopped`, "Needs attention: The server
  stopped the run" until dismissed. With the feature: the run continues by itself, or waits for one
  action.
- **Usage limit.** Today: the turn fails with the limit text; the sidebar's usage gauge shows the
  window. With the feature: the run waits and continues at the reset.
- **Background task after the turn.** Handled today (`RESUMED`). Pending wakeups die at the idle
  close.
- **Stop.** The human's Stop interrupts the turn and keeps the process. A run waiting for a reset
  meets it: Stop must also cancel the wait.
- **Dismiss.** Clears an ask. A dismissed interrupted run must not resume by itself later.
- **A human message during a wait.** It should go through, and cancel or replace the automatic
  resume.
- **Several sessions in one worktree.** Only one works at a time
  ([agents](/specs/decisions/agents.md)); a resume must queue like any turn.
- **Dev restarts.** Vite's restart calls `stopDevRuns()` ([dev.ts](/packages/server/src/dev.ts),
  lines 51-57): developing Uraeda restarts it often.
- **In-flight features.** [Master PR](/specs/2026-11-03-master-pr/proposal.md), on its own branch,
  touches how pull requests are opened and merged, and may add a choice at feature start. No code
  overlap found; both may add start or run options. Vim in text edit mode does not touch the runner.

### Rules and their owners

- **When a session needs the human**: [`runner/status.ts`](/packages/server/src/runner/status.ts),
  read by [`fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts) and
  [`fate/feature-status.ts`](/packages/server/src/fate/feature-status.ts), as the
  [feature status](/specs/decisions/feature-status.md) decision asks.
- **Stopping at server exit**: `endWithServer` in `claude.ts`, `closeAll` in `sessions.ts`, and
  `interrupted` in `cache.ts`: three places for one rule.
- **The step prompt**: [`runner/message.ts`](/packages/server/src/runner/message.ts) only.

### Likely changes

Under every option:

- [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts): read
  `status: "rejected"` and `error: "rate_limit" | "authentication_failed"` into events.
- [`runner/status.ts`](/packages/server/src/runner/status.ts), `needs-you.ts`, `feature-status.ts`,
  `SessionAttention.tsx`: the new waiting and resumed states.
- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts): split first, then a resume
  scheduler in its own module.
- [`runner/migrations.ts`](/packages/server/src/runner/migrations.ts): a column or table for pending
  resumes and their time.
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs) and the Runs settings page:
  switches.
- [`runner/turns.ts`](/packages/server/src/runner/turns.ts): no idle close while a wakeup or cron
  waits.
- The home page or needs-you list: the "Continue all" action.

With a resume from the transcript at start: `server.ts` start, `cache.ts` `interrupted`, `claude.ts`
environment. With agents that outlive the server: `claude.ts` spawn and stdio, `processes.ts` claim,
a reattach path, and `endWithServer` removed. With a skill rule on polling:
[`implementation.md`](/skills/uraeda/references/implementation.md) and the conventions.

Tests that guard changed behaviour:

- `runner/__tests__/claude.test.ts`: "a session's process and the processes it started end with the
  server" (line 1065), "kill signals the process's group" (1048), and "no argument skips permissions
  or sets a model" (82).
- `runner/__tests__/sessions.test.ts`: "the server's stop kills a process that ignores its close and
  SIGTERM" (305), "US1.7 and C1: an idle process closes after 15 minutes" (206).
- `runner/__tests__/cache.test.ts`: "interrupted stops the running turns of gone servers" (353) and
  "…the queued turns too" (382).
- `runner/__tests__/status.test.ts` (64, 80): a server stop reads interrupted until dismissed.
- `__tests__/sessions.test.ts` (1516-1521) and `__tests__/dismissed.test.ts` (53).
- No test covers `Turns.resume`.

## The proposal

### The proposal holds three subsystems

Keeping runs going (restarts, limits, background work, early stops, continue all), scheduled jobs,
and run options (one session per feature or per step, review settings, models, defaults with
per-feature overrides). Each has its own products to compare, settings, and stories. Together they
would pass [the split rule](/skills/uraeda/references/writing.md#a-spec): about 5 stories for
keeping runs going alone. The settings page already reserves rows for run options under a planned
Codex runtime feature.

### Scheduled jobs name no job

"Heartbeat/cron jobs" names no job to run. The candidates seen: the server's own periodic check for
due resumes (part of keeping runs going), the inbox triage, the decisions check, and pull-request
comment checks. Only the human knows which they want.

### Early stops are mostly fixed

The skill's "continue to the next human gate" rule, from 2026-10-15, and later wording fixed the
auto-approved plan stop: none since 2026-10-17. Two episodes remain, and the runner already reads
them as `halted`.

### "Not logged in" cannot be fixed by Uraeda

The [agents](/specs/decisions/agents.md) decision forbids reading or changing the agent's
credentials. Uraeda can only say the run needs a sign-in, and continue after.

### "Sessions should outlive a restart, or be resumed by it, from their commits"

Resuming from commits would restart the step from the repository, losing the session's context.
Claude Code's transcript resume keeps it. Both remain possible.

### "Should be able to turn it off too"

Each automatic behaviour can be a switch in `[runs]`, as the
[settings](/specs/decisions/settings.md) decision asks of later settings.

### Waiting conflicts with "a stopped run asks until dismissed"

The [feature status](/specs/decisions/feature-status.md) decision says "A failed or stopped run MUST
ask for the human until they dismiss it". A run waiting to resume by itself is stopped, but does not
need the human. The decision changes, or the run asks anyway.

## Worth it and feasibility

### Evidence since the proposal

From the runner's cache, `~/.local/share/uraeda/runner.sqlite`, and Claude Code's transcripts under
`~/.claude/projects/-home-tolki-Development-ai-uraeda*`, from 2026-10-17 to 2026-11-03. The period
holds 85 runner sessions and 240 turns (115 workflow turns, about 111 h of wall time). Counting was
by regex, then each stop was read by hand. Scripts were run from `/tmp`, outside the repository.

#### Usage limits

- 15 turns ended on a limit, from 9 events, about one every 2 days. 13 were marked failed, 1 done,
  and 1 cut by the 30-minute watchdog.
- A limit usually hit 2 features at once.
- About 14.5 h passed in total between a quoted reset and the human's "Continue".
- 16 human prompts existed only to restart after a limit.
- On 2026-10-30 the human resumed 2 h before the quoted reset, and the runs worked. The quoted reset
  is not always what applies, perhaps because of extra usage (judgement).

| Limit hit (UTC)  | Quoted reset (Tokyo) | Idle after the reset |
| ---------------- | -------------------- | -------------------- |
| 10-17 17:21      | 2:30am               | 4h42                 |
| 10-20 06:26      | 5:30pm               | none                 |
| 10-20 11:00      | 8:30pm               | 0h47                 |
| 10-20 16:09      | 1:10am               | 5h23                 |
| 10-24 15:25 (×2) | 1:40am               | 2h01                 |
| 10-24 23:01 (×2) | 8:40am               | 1 min                |
| 10-26 09:21 (×2) | 8:20pm               | 1–4 min              |
| 10-26 14:48 (×2) | 1:20am               | 1h40                 |
| 10-30 05:04 (×2) | 4:30pm               | none                 |

#### Server restarts

5 restarts killed 7 runner turns, each "Stopped: the server stopped while it ran.":

- 10-19 03:07: redesign-session's approval, 58 min in, and its background implementer; benchmarks.
- 10-19 14:00: fix-testing, whose round was already committed.
- 10-30 01:17: performance-pass's approval and 3 Explore agents; phone-bottom.
- 10-30 05:48: performance-pass's "Continue" turn, 10 s in.
- 11-01 13:18: move-relinks' plan run, 1h40 in, with a subagent. Never resumed by the runner: the
  human found it again days later in a terminal session.

5 "Continue" prompts followed restarts.

#### Background work and polling

- 26 turns logged "The agent went on by itself: a background task reported back": a background task
  finishing after its turn ended is handled.
- 618 polling calls in 59 of 83 runner sessions: 226 wait loops (`until`/`while` with `sleep`, about
  19 h blocked), 48 plain sleeps, 121 reads of output files, 28 Monitor calls, 195 ScheduleWakeup
  calls. Subagents add 319 wait loops. The proposal counted 240 for two days.
- The worst stall: an agent ran validation in an untracked `( … ) &` shell, set a 1500 s wakeup, and
  ended its turn. The wakeup never fired: leader-key sat idle 3h51 on 2026-10-26, then 51 min more.
  Of 200 wakeups, 131 fired.
- Claude Code's "didn't finish before the previous session ended" notes appear 6 times in 4 runner
  sessions: background agents lost with the process.

#### Stops before a human gate

- 2026-10-18: five changes started from chat stopped before the review and the pull request; the
  human answered "Finish" four times. One said it had not pushed "because those publish the work and
  you haven't asked". A skill commit landed that evening.
- 2026-10-26: leader-key's two stops, above.
- After 2026-10-17, no run stopped between an auto-approved plan and its implementation. Every
  approval or plan run reached its pull request.

#### Errors

No "Not logged in" in the period. 2 `authentication_failed` and 1 unknown API error were retried by
Claude Code itself, harmlessly. 12 turns were stopped by the human, as redirects.

- **Gain**: about 21 restart prompts in 18 days, about 14.5 h of idle runs after resets, mostly
  overnight, and stalls of several hours from lost wakeups. Runs need the human only at gates.
- **Cost**: keeping runs going is a medium feature in the runner, status, and one action in the web
  UI, with a decision change. Run options and scheduled jobs are each a feature of their own.
- **Outside behaviour, checked in the docs, not by experiment**: `--resume` with
  `CLAUDE_CODE_RESUME_INTERRUPTED_TURN`; `rate_limit_event` with `status` and `resetsAt`; background
  tasks waking the session. No experiment was run: each would start a session that uses the human's
  usage.
- **Unverified**:
  - whether a resumed interrupted turn behaves well in stream-json input mode, which the docs
    describe for SDK mode;
  - whether a `rejected` event reaches stdout before the turn fails;
  - what the weekly limit sends on stdout
    ([#103820](https://github.com/anthropics/claude-code/issues/103820) says nothing);
  - whether a `claude -p` whose parent died keeps running: no documentation; reports of an orphan
    spinning at 100% CPU, seen only in a search snippet.

  The plan's first task checks the first three on the fake adapter's recorded lines and a real run.

- **Guards**: none relaxed. Resumed runs keep the same flags and permission mode.
- **Policy**: Anthropic's Agent SDK page says third parties may not offer claude.ai login or rate
  limits for their products ([overview](https://code.claude.com/docs/en/agent-sdk/overview.md)).
  Uraeda runs the user's own `claude` with their own login, as the
  [agents](/specs/decisions/agents.md) decision describes; resuming adds no new use.

## Approaches

Criteria: runs reach the next gate without the human ([proposal](proposal.md)); the human stays in
control ([constitution I](/specs/CONSTITUTION.md#i-humans-stay-in-control)); state recoverable from
the repository and caches ([constitution III](/specs/CONSTITUTION.md#iii-asynchronous-by-default));
the user's own agent, never skipped permissions ([agents](/specs/decisions/agents.md)); cost to
build.

### Scope

What this feature covers. See [three subsystems](#the-proposal-holds-three-subsystems).

| Option                                       | Spec size           | Waits                         |
| -------------------------------------------- | ------------------- | ----------------------------- |
| A. Keeping runs going only; the others later | about 5 stories     | run options wait a feature    |
| B. All three in one feature                  | past the split rule | nothing, but a longer feature |

### Surviving a restart

See [important reads](#important-reads) and [Claude Code](#claude-code).

| Option                                            | Context kept                 | Cost     | Risk                                         |
| ------------------------------------------------- | ---------------------------- | -------- | -------------------------------------------- |
| A. Kill, then resume from the transcript at start | yes, minus the tool call cut | small    | background agents lost, redone               |
| B. Agents outlive the server, which reattaches    | everything                   | large    | unverified orphan behaviour, stdio via files |
| C. Use `claude --bg` and its supervisor           | everything                   | rewrite  | no stream-json, research preview             |
| D. Resume nothing; one action continues all       | yes, on the action           | smallest | waits for the human                          |

### Waiting out a usage limit

See [usage limits](#usage-limits).

| Option                                                      | Visible          | Survives restart    | Known gap                     |
| ----------------------------------------------------------- | ---------------- | ------------------- | ----------------------------- |
| A. Uraeda stores the reset, resumes the session then        | yes, with a time | yes, from the cache | weekly limit may give no time |
| B. `CLAUDE_CODE_RETRY_WATCHDOG=1`: the process waits itself | as retry lines   | no                  | #104690                       |
| C. Show the reset time, the human continues                 | yes              | n/a                 | none                          |

### Status while waiting

Only with an automatic resume. See
[the conflict](#waiting-conflicts-with-a-stopped-run-asks-until-dismissed).

| Option                               | Notifications       | Decision               |
| ------------------------------------ | ------------------- | ---------------------- |
| A. "Waiting until 17:30", not an ask | none until it fails | feature status changes |
| B. Needs you until it resumes        | one per limit       | unchanged              |

### Early stops

See [early stops are mostly fixed](#early-stops-are-mostly-fixed).

| Option                                                   | Cost   | Risk                    |
| -------------------------------------------------------- | ------ | ----------------------- |
| A. One automatic "continue to the next gate" on `halted` | small  | a loop, capped          |
| B. A Stop hook in Uraeda's plugin blocks the stop        | medium | Claude Code only        |
| C. Nothing: the human continues                          | none   | the two episodes remain |

### Polling

See [background work and polling](#background-work-and-polling).

| Option                                                             | Cost   | Agent-neutral |
| ------------------------------------------------------------------ | ------ | ------------- |
| A. A skill rule: track background work and wait for its notice     | small  | yes           |
| B. A hook in Uraeda's plugin refuses sleep loops and untracked `&` | medium | no            |
| C. Nothing beyond keeping wakeups alive                            | none   | yes           |

### Needs no choice

- **Keeping wakeups alive**: a bug in the idle close, fixed under every option.
- **Clear states and notifications**: the [notifications](/specs/decisions/notifications.md) and
  feature status decisions already say notifications mean asks.
- **A cap on automatic resumes**: every product with auto-resume caps it; Claude Code uses 3.
- **Stale interrupted turns**: Claude Code's max-age variable bounds them.
- **Fresh context per step**: already the default for the approval and plan steps; the rest belongs
  to run options.
- **Scheduled jobs' history and quiet outcome**: only with scheduled jobs in scope.

## Not checked

- Conductor's handling of restarts and limits: its docs do not describe it, and its changelog shows
  only titles.
- Happy's docs page returned 410; Omnara, Sculptor, Terragon, and Cursor's background agents were
  seen only in search snippets.
- Codex cloud's automations page returned 404.
- No experiment with a real `claude` process: each would use the human's usage.
