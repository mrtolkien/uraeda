# Discovery, round 01: Scheduled jobs

## Summary

A scheduled job is a saved prompt that an agent runs at set times, without a human starting it.
Every product read has the same parts: a name, a prompt, a schedule, where it runs, the model, a
switch to pause it, "Run now", and a history of runs. They differ on four points: where the job is
stored, whether a run works in the user's checkout or in a worktree of its own, what happens to a
run missed while the machine was off, and what a run may do without asking.

The proposal asks for agent runs on a schedule, per repository, like a daily dependencies upgrade
and performance pass. It says nothing on those four points.

The code has every piece but the clock. Sessions start on the main checkout or as a change, with a
picked agent, model, and effort. Automatic runs exist: continues after a restart or a limit, and the
catch-up of pull requests, each with its switch, its cap, and a line saying why it ran. Nothing
fires at a time of day, and nothing stores a prompt to send later.

No other branch is in flight on runs: [Run options](/specs/done/2026-11-08-run-options.md) merged in
pull request 120, and no pull request is open. The feature can start now.

## How other products do it

### Claude Code Desktop, scheduled tasks

From
[Schedule recurring tasks in Claude Code Desktop](https://code.claude.com/docs/en/desktop-scheduled-tasks):

- A task has a name, a description, instructions, a local folder, a schedule, a permission mode, and
  a model. "Scheduled tasks start a new session automatically at a time and frequency you choose."
- Schedules are presets: Hourly, Daily, Weekdays, Weekly, Manual ("only runs when you click Run
  now"), and Custom, a cron expression "evaluated in your local time". The form refuses more than
  once per hour.
- A run works in the folder as it is, "including uncommitted changes", or in "its own isolated Git
  worktree" when Worktree is ticked.
- Missed runs: "Desktop starts exactly one catch-up run for the most recently missed time and
  discards anything older", looking back seven days. "A task scheduled for 9am might run at 11pm".
- The history lists skipped runs with why: "your computer was asleep, the previous run was still in
  progress, or other scheduled tasks were already running."
- The prompt is a file, `~/.claude/scheduled-tasks/<task-name>/SKILL.md`. "Schedule, folder, model,
  and enabled state are not in this file".
- Each task starts a few minutes late, by a fixed offset, "to stagger API traffic".
- A task has Run now, Active or Paused, Edit, and Delete, which keeps its sessions.

### Claude Code cloud scheduled tasks

From [Automate work with scheduled tasks](https://code.claude.com/docs/en/routines):

- A task is "a prompt, one or more repositories, and a set of connectors", with schedule, API, and
  GitHub triggers. The shortest interval is one hour.
- "Each repository is cloned at the start of a run. Claude creates `claude/`-prefixed branches for
  its changes." A run can open a pull request; nothing merges by itself.
- Runs start in auto mode, where "a classifier model allows or blocks actions".
- "Scheduled tasks draw down subscription usage the same way interactive sessions do." Past the
  usage limit, "additional runs are rejected until your usage window resets".
- A five-field cron expression is read in UTC, a preset in the user's time zone.

### Claude Code `/loop`

From [Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks): tasks live in one
session and end with it, expire after seven days, and have "no catch-up for missed fires". They are
for polling, not for upkeep.

### Codex, scheduled tasks

From [Codex's page on scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app), read
through a summary of the page, not its full text:

- A task has a prompt, a schedule, one or more projects, and a model and effort. An advanced
  schedule is an RFC 5545 recurrence rule.
- In a git repository, the user picks the local project or a new worktree. Local mode "can change
  files you are actively editing"; a worktree keeps a task's changes "separate from unfinished local
  work". Worktrees pile up with frequent schedules.
- Each run starts a new chat and reports in a Scheduled view, which "acts as your inbox", with an
  unread mark when a run needs attention.
- Runs use the default sandbox, unattended. The app must run, and the computer stay on.
- The page recommends testing the prompt in a regular chat first, and keeping the action in a skill.

### GitHub Actions and Renovate

- [GitHub Actions' `schedule`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
  takes POSIX cron in UTC, runs "only on the default branch", can be delayed, and under load drops
  runs. Public repositories lose their schedules after 60 days without activity.
- [Renovate's scheduling](https://docs.renovatebot.com/key-concepts/scheduling/) exists because the
  default, "open PRs right away", overwhelms users. Schedules are cron without minutes, in UTC or a
  named time zone. Its limits on open pull requests are on other pages, not read.

### What they have in common

- A job is a name, a prompt, a schedule, a place to run, and a model.
- Presets come first, cron second. Local tools read times in local time.
- A switch pauses a job without deleting it, and Run now tests it.
- Each run is a new session, listed in a history under its job, skipped runs included.
- A run never overlaps the one before it.
- A run never merges: its result is a report to read, or a branch and a pull request.
- Runs spend the user's own usage.
- Missed runs split the products: one catch-up run (Desktop), or none (`/loop`, GitHub).
- Where a run works splits them too: the user's checkout, or a worktree per run.

## Standards and libraries

### Cron expressions

Five fields, minute to day of week. When both day fields are set, a date matches if either does, a
known trap, as [Claude Code's reference](https://code.claude.com/docs/en/scheduled-tasks) notes.
Uraeda has no cron or date library: the workspace's [`Cargo.toml`](/Cargo.toml) holds `toml_edit`
and no `chrono`, `jiff`, or `cron`, and [the server's package](/packages/server/package.json) holds
no cron package. Daily and weekly times need none: JavaScript's `Date` computes the next local time.

### Timers in Node

`setTimeout` fires at once past 2^31 - 1 ms, about 24.8 days: the continuer re-arms long waits, in
[`continuer.ts`](/packages/server/src/runner/continuer.ts) (`LONGEST_TIMER_MS`). A timer does not
tick while the machine sleeps, so a scheduler compares the clock on a short tick, or on wake.

### Daylight saving time

A local time may not exist one night a year, and exist twice another. Desktop and `/loop` read cron
in local time and say nothing of it. No source read settles it.

## The code

### Important reads

- [`catch-ups.ts`](/packages/server/src/catch-ups.ts): the closest pattern. An automatic run started
  by the server, behind a switch, once per trigger, one at a time per repository, each refusal
  printed once. It sends through `continueOne` with an `automatic` object: a `trigger`, and the
  `line` that says why in the session.
- [`continuer.ts`](/packages/server/src/runner/continuer.ts): waits that survive a restart. The
  cache holds every pending continue, "a timer only wakes this server to claim one". Runs waiting
  for the same reset go a minute apart.
- [`change-starts.ts`](/packages/server/src/fate/change-starts.ts): starts a change from a typed
  text (`TypedChange`), commits its proposal, and sends its first run, on a picked agent and model.
- [`session-moves.ts`](/packages/server/src/fate/session-moves.ts): moves a session of the main
  checkout into a change, what the offer's card does. It holds the session while it moves, and is
  refused while the session works.
- [`instructions.ts`](/packages/server/src/runner/instructions.ts): tells every session to offer a
  change in a fenced block, and that "only the card moves this session into the change's worktree".
- [`builtins.ts`](/packages/server/src/extensions/builtins.ts): built-in extensions register through
  the server API, and get a few internal functions beside it, like `warm` for previews.
- [`extension-api.ts`](/packages/server/src/extension-api.ts): the server API has `record`,
  `action`, `route`, `on`, `runtime`, `settings`, `repositories`, and `log`. It starts no session.
  An extension's settings are `bool`, `integer`, `string`, or a list of strings: no table.
- [`settings.rs`](/crates/core/src/settings.rs) and
  [`settings/file.rs`](/crates/core/src/settings/file.rs): the core reads, validates, and writes
  `config.toml`, the `[runs]` table included.
- [`needs-you.ts`](/packages/server/src/fate/needs-you.ts) and
  [`status.ts`](/packages/server/src/runner/status.ts): a session reads `working`, `needs-you`,
  `attention`, `unread`, or `idle`. Only `needs-you` and `attention` notify; a new reply reads
  `unread`.
- [`sessions.ts`](/packages/server/src/runner/sessions.ts): a session of a feature is refused while
  another session of that feature works. Sessions of the main checkout have no such hold.

### The proposal's path and existing actions

The path, for "Dependencies, every day at 3:00, in uraeda":

1. The human writes the job. No place stores one today.
2. At 3:00 the server starts a session with the job's prompt. A session of the main checkout starts
   from the New page today, through the session manager's `send`.
3. The agent finds upgrades. In a session of the main checkout, the skill has it offer a change, and
   change no file before the human's yes ([Change](/skills/uraeda/references/change.md)).
4. The human is asleep. The offer waits until morning, and the upgrade has not started.

Existing actions that meet the feature:

- **Stop** ends the run's turn, as on any session.
- **A session limit** during the run: the run waits for the reset and continues, by the
  [run lifecycle](/specs/decisions/run-lifecycle.md) decision.
- **A server restart** during the run: it continues at the next start, by the same decision.
- **Continue all** on Home sends each stopped workflow run its step's message. A chat gets nothing.
- **Turning a repository's agent off**: no session starts there.
- **Removing a repository from the list**: a job naming it has nowhere to run.
- **Dropping or postponing a change** a job started: the next run finds no open change.
- **The sandbox** runs a fake agent over sample projects, and reads no real config
  ([sandbox](/specs/decisions/sandbox.md)).

Other work in flight: the main checkout holds uncommitted edits to
`packages/web/src/settings/RunSettings.tsx`, the page of the `[runs]` settings. A branch adding
controls there will meet them at its catch-up.

### Rules and their owners

- **Who starts a change.** The [agents](/specs/decisions/agents.md) decision: "An agent MUST NOT
  turn a session into a change, or a change into a feature, unless the human accepts it." Copies:
  rule 8 of [`SKILL.md`](/skills/uraeda/SKILL.md), "Only when a human asks" in
  [Change](/skills/uraeda/references/change.md) and
  [Projects](/skills/uraeda/references/projects.md), and
  [`instructions.ts`](/packages/server/src/runner/instructions.ts).
- **Automatic runs.** The [run lifecycle](/specs/decisions/run-lifecycle.md) decision: each
  automatic run says why in its session, and each kind has a setting that turns it off.
- **Who chooses what runs spend.** The [run options](/specs/decisions/run-options.md) decision keeps
  a feature's options out of the repository: "A repository someone else wrote must never choose what
  the human's runs spend."
- **Settings.** The [settings](/specs/decisions/settings.md) decision: one TOML file in the config
  folder, never read from a repository, with theme files as its one folder of files.
- **Places.** The [extensions](/specs/decisions/extensions.md) decision: "A new place, runtime, or
  event of Uraeda is written as a built-in extension", each one able to be turned off.
- **Notifications.** The [notifications](/specs/decisions/notifications.md) decision: only when an
  item comes to need the human.
- **Git.** The [git](/specs/decisions/git.md) decision: starting a change may commit on its own; a
  branch never writes `PRIORITIES.md`.

### Likely changes

Under every option:

- A scheduler in [`packages/server/src/`](/packages/server/src/), beside `catch-ups.ts`: the next
  time of each job, a tick, the missed runs at the start, and the skips.
- The record of each job's fires, in Uraeda's data folder, so a restart knows what it missed.
- A new trigger and line in [`message.ts`](/packages/server/src/runner/message.ts) and
  [`events.ts`](/packages/server/src/runner/events.ts).
- A switch in the `[runs]` table: [`settings.rs`](/crates/core/src/settings.rs), the binding, and
  the settings page.
- [`docs/web-ui.md`](/docs/web-ui.md), and a sample job in the sandbox's projects.

With jobs in `config.toml`: a `[[jobs]]` table in the core's settings, validated there.

With jobs as files beside `config.toml`: a reader like [`themes.rs`](/crates/core/src/themes.rs),
and a change to the settings decision.

With jobs in the repository: a `specs/jobs/` folder in the skill, its template, its example, and
`ura check`, and a per-machine switch.

With a job starting changes by itself: the offer's acceptance in the server, on
[`session-moves.ts`](/packages/server/src/fate/session-moves.ts), the scheduled session's own
wording in [`instructions.ts`](/packages/server/src/runner/instructions.ts), and the agents
decision.

With a Jobs page: a built-in `jobs` extension, its place in
[`packages/web/src/`](/packages/web/src/), and its fate views.

Tests that guard behaviour the feature changes:

- `packages/server/src/runner/__tests__/moves.test.ts`, the moves of a session into a change, only
  with a job starting changes by itself.
- `packages/server/src/__tests__/settings.test.ts` and `settings-fate.test.ts`, the `[runs]` keys.
- The tests of [`instructions.ts`](/packages/server/src/runner/instructions.ts), on the offer's
  wording, only with a job starting changes by itself.

## The proposal

### Timing against other branches

The proposal asks to be told when it is better built after a running branch that touches agents'
options or triggering. None runs. [Run options](/specs/done/2026-11-08-run-options.md),
[Agents fix](/specs/done/2026-11-08-agents-fix.md), and
[the extensions system](/specs/done/2026-11-08-extensions-system.md) are merged. The branch
`change/2026-11-09-scheduled-jobs` is this proposal's earlier start as a change, with no work on it.

### What a run may do

"A daily dependencies upgrade" changes code, and the workflow lets only a human start a change. As
written, the run could only offer the upgrade and wait.

### Where a job is written

"Per repository" does not say whether the job lives in the repository or on the machine.

### What the human sees

The proposal names no page, no history, and no way to test a job.

### Missed and overlapping runs

The proposal does not say what a 3:00 job does when the server was off at 3:00, or when yesterday's
run or pull request is still open.

## Worth it and feasibility

**Worth it.** The gain: upkeep the human starts by hand today, and the priorities already wait on it
("Once CRON jobs exist: daily persona run, performance run, code quality run"). The cost: a
scheduler and a store of fires, a settings table, a page if one is wanted, and usage spent while
nobody watches. No new dependency. The pieces that start, continue, and cap runs exist. Judgement:
the gain outweighs the cost.

**Outside behaviour it relies on.** None new. Sessions start as they do today, on agents Uraeda
already runs. A machine asleep at the scheduled time is the one outside fact, and a clock compared
on a tick covers it.

**Guards it relaxes.** Only with a job starting changes by itself: the agent's offer is accepted
with no human reading it. A web page or a changelog the agent reads during a run could then talk it
into opening a branch and a pull request nobody asked for. Nothing merges without the human. With
jobs written in the repository: anyone who can push to it could change what an agent runs unattended
on the human's machine.

## Approaches

### What a run is

What the server starts at the scheduled time, and what it may do alone. Relies on
[the proposal's path](#the-proposals-path-and-existing-actions) and
[rules and their owners](#rules-and-their-owners).

| Criterion                         | A session of the main checkout, its offer accepted for jobs that allow it | A session that only reports | A change from the start       |
| --------------------------------- | ------------------------------------------------------------------------- | --------------------------- | ----------------------------- |
| The upgrade is made by morning    | yes, where allowed                                                        | no                          | yes                           |
| A run with nothing to do          | a session saying so                                                       | a session saying so         | a commit, a branch, a folder  |
| Reports, like a performance pass  | yes                                                                       | yes                         | no, a change must change code |
| Commits on the default branch     | only when a change starts                                                 | none                        | every run                     |
| The agents decision               | changes                                                                   | holds                       | changes                       |
| Works in the human's own checkout | reads only, by the skill's rule                                           | reads only                  | never                         |

### Where a job is defined

Relies on [rules and their owners](#rules-and-their-owners) and
[Claude Code Desktop](#claude-code-desktop-scheduled-tasks).

| Criterion                             | `[[jobs]]` in `config.toml` | A file per job beside `config.toml` | A file per job in the repository |
| ------------------------------------- | --------------------------- | ----------------------------------- | -------------------------------- |
| A long prompt edits well              | a TOML multi-line string    | Markdown                            | Markdown                         |
| The settings decision                 | holds                       | changes                             | holds                            |
| A cloned repository starts no run     | yes                         | yes                                 | only with a per-machine switch   |
| Shared with collaborators             | no                          | no                                  | yes                              |
| The skill, its templates, the example | untouched                   | untouched                           | a new kind of file               |
| In git                                | the human's dotfiles        | the human's dotfiles                | the repository                   |

### Seeing and editing jobs

Relies on [what they have in common](#what-they-have-in-common).

- A Jobs place per repository: the jobs, their next run, their history, a switch, Run now, and a
  form to write one. The most to build; works on the phone.
- The same place without the form: jobs are written in the file.
- No page: jobs in the file, runs among the sessions. Nothing shows a skipped run or the next one.

### The schedule's format

Relies on [cron expressions](#cron-expressions).

- Words: `daily 03:00`, `weekdays 03:00`, `monday 03:00`. Readable, no library, no trap.
- Five-field cron: any pattern, a parser to write or a dependency to add, and the day-fields trap.

### Missed runs

Relies on [what they have in common](#what-they-have-in-common).

- One run at the server's start for a job whose latest time passed while it was off.
- None: the job waits for its next time.

### Overlapping runs

- Skip a time while the job's last run still works, or the change it started is still open.
- Start anyway: two runs of one job, or two pull requests upgrading the same files.

### Usage

Relies on [Claude Code cloud scheduled tasks](#claude-code-cloud-scheduled-tasks).

- No threshold: a run that meets a session limit waits for its reset, as any run.
- Skip a run when a usage window is past a share the human sets. Uraeda reads the windows
  ([`processes.ts`](/packages/server/src/runner/processes.ts)), not every runtime reports them.

### The decision

- A decision of its own, on scheduled jobs.
- Rules added to the [run lifecycle](/specs/decisions/run-lifecycle.md) decision, which holds 8 of
  its 10.

### Needs no choice

- **A switch that pauses a job, and one for all jobs**: the run lifecycle decision asks for it.
- **Each run says why it started**: the same decision.
- **Each run is a new session**: every product does it, and a session keeps its model.
- **Notifications**: the notifications decision already says when.
- **Staggering**: runs due together go a minute apart, as the continuer's do.
- **Local time**: the server's, as every local tool read.

## Not checked

- Codex's page was read through a summary: its words on missed runs and on runs with nothing to
  report could not be confirmed.
- Renovate's limits on open pull requests and its dashboard, on pages not read.
- No source says what a local cron does on the night a time does not exist.
