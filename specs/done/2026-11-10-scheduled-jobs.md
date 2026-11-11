---
kind: feature
finished: 2026-11-10
pull-request: https://github.com/mrtolkien/uraeda/pull/122
---

# Record: Scheduled jobs

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-10, finished on
> 2026-11-10, in [its pull request](https://github.com/mrtolkien/uraeda/pull/122). Its full files
> are in git: `git log -- specs/2026-11-10-scheduled-jobs/`.

## What and why

A job is a prompt Uraeda sends to an agent at set times, in each repository it names, like a daily
dependencies upgrade or a performance pass. Recurring upkeep should not wait for someone to start
it. Each run is a new session of the main checkout, and starts the change it offers, up to a pull
request, unless the human made the job report only. Nothing merges without the human.

## Behaviour

- **A job runs at its time.** A job is a `[[jobs]]` table of `config.toml`: a name, a prompt, a
  schedule, repositories, and optionally an agent, a model, an effort, `on`, and `report_only`. A
  schedule is `hourly`, `daily HH:MM`, `weekdays HH:MM`, or `<day> HH:MM`, in the server's local
  time. At each time, a session named after the job starts in each repository's main checkout, opens
  with "Started by the schedule “<job>”.", gets the prompt, then Uraeda's note: nobody follows the
  session, change no file, and what happens to an offered change. Runs due together start a minute
  apart. `[runs] scheduled_jobs`, `--no-scheduled-jobs`, or `URAEDA_SCHEDULED_JOBS` turns every job
  off.
- **Missed and skipped times.** A time that passes while the server is not running, the job is
  paused, or the switch is off is missed, and never made up: only a server that saw a time arrive
  starts it, at most 5 minutes late. A time is skipped, with a line in the history, while the job's
  last run there still works or waits for a wakeup its agent set, or while a change one of its runs
  started there is open. A time whose session could not start is recorded once as "Could not start:
  <why>", shown in the history and on the card's "Last run", and not tried again. A time is recorded
  once, so two ticks, two servers, or a clock set back start it once.
- **A run starts the change it offers.** When a run's last word is a `uraeda-offer change` block,
  Uraeda starts the change as the offer's card does, through `toChange`, and the session says "The
  job “<job>” started the change “<title>”.". Nothing starts for a report-only job, a `feature`
  offer, an offer that is not the turn's last text or whose fence is not at column 0, a session the
  human wrote in, a turn that left a wakeup pending, a run whose earlier offer was refused, a job
  that left the file or has a problem other than its schedule, or a repository where the job no
  longer runs: the card waits. A change that cannot start asks for the human under "The change could
  not start by itself.", with the reason.
- **The Jobs place.** `/jobs`, a built-in extension reached with `Space j` or `g j`, lists the jobs
  that name the repository, and those that name no listed repository, each as a card: name, schedule
  in words, the pause switch, "Next run" or why not, and "Last run". Its keys: Enter opens the job,
  `r` runs it now, `p` pauses or resumes it, `d` deletes it after a confirmation, `a` adds one. "Run
  now" ignores the pause, the switch for all jobs, an open change, and a schedule that is not
  understood. It is refused while the job's run works there, for any other problem of the job, and
  where the Jobs extension is off.
- **Write a job in the web UI.** A job's page, `/jobs/<name>`, is a form whose fields save as they
  are left, each refusal under its field, and ends with the job's history. A new job is added by one
  button once its name and prompt are filled. Writes keep the comments, unknown keys, and order of
  `config.toml`. Of two jobs with one name, every write by that name is refused until one is renamed
  by hand.

## Design

Jobs are settings, so the core owns their format and every write. The server owns time: a scheduler
beside the catch-up of pull requests is the only code that starts a scheduled run. The cache of
sessions is the authority on what ran, with one row per run, skipped time, or failed start. A run is
a plain session, and its change starts through the path the offer's card uses, so the start of a
change has one home.

- The job settings, [`jobs.rs`](/crates/core/src/jobs.rs): reading each table with its problem,
  never failing the settings file. The schedule's forms are in
  [`schedule.rs`](/crates/core/src/jobs/schedule.rs) and the writes in
  [`write.rs`](/crates/core/src/jobs/write.rs). The built-in extension's manifest is
  [`jobs.toml`](/crates/core/extensions/jobs.toml).
- The times of a schedule, [`times.ts`](/packages/server/src/jobs/times.ts): the time due, the next
  one, and the 5 minutes after which a time is missed.
- The scheduler, [`scheduler.ts`](/packages/server/src/jobs/scheduler.ts): each tick queues the
  times due, and a drain starts them a minute apart, reading the job and its guards again right
  before each start. [`starts.ts`](/packages/server/src/jobs/starts.ts) owns the reservation of a
  job's start and why a time is skipped. "Run now" is
  [`run-now.ts`](/packages/server/src/jobs/run-now.ts), and the card's next run
  [`next-run.ts`](/packages/server/src/jobs/next-run.ts).
- The run's start, [`run.ts`](/packages/server/src/jobs/run.ts): the run's row first, then its
  session, with the line and the note of [`message.ts`](/packages/server/src/runner/message.ts).
- The record of runs, [`cache-jobs.ts`](/packages/server/src/runner/cache-jobs.ts): the `job_runs`
  table, its unique row per time, and its pruning.
- The offer's acceptance, [`accept.ts`](/packages/server/src/jobs/accept.ts), over the offer's
  grammar in [`offers.ts`](/packages/server/src/runner/offers.ts), which the web UI's card reads
  too. [`problem.ts`](/packages/server/src/jobs/problem.ts) holds the one rule of which problems
  stop a run by hand and an acceptance, and [`guards.ts`](/packages/server/src/jobs/guards.ts) what
  "works" means for both.
- The `Jobs` record of fate and its mutations, [`jobs.ts`](/packages/server/src/fate/jobs.ts) and
  [`job-mutations.ts`](/packages/server/src/fate/job-mutations.ts), announced by
  [`announce.ts`](/packages/server/src/jobs/announce.ts).
- The Jobs place and a job's page, in [`packages/web/src/jobs/`](/packages/web/src/jobs/).
- The skill's rule, in its [change reference](/skills/uraeda/references/change.md): a job the human
  scheduled is their yes, given in advance.

## Gotchas

- The unique index of a time is plain, not partial, in
  [`migrations.ts`](/packages/server/src/runner/migrations.ts): an insert's
  `ON CONFLICT (job, repository, due)` cannot use a partial index, and SQLite counts each null as
  distinct, so runs by hand, whose `due` is null, never conflict.
- The core reports a job's schedule problem last, and says so in `schedule_only`, in
  [`jobs.rs`](/crates/core/src/jobs.rs): when it stopped at the schedule first, a bad schedule hid a
  `report_only` that was not a boolean, which then read false, and the acceptance started a change
  for a job written as report only.
- The acceptance takes an offer only from a fence at column 0, in
  [`offers.ts`](/packages/server/src/runner/offers.ts), while the card keeps markdown's three
  spaces: an offer quoted in a list or a quote must not start a change by itself.
- `works` reads the agent's wakeup itself, in [`guards.ts`](/packages/server/src/jobs/guards.ts): a
  session's status reads a wakeup only in a feature's step, and a run's session is a chat.
- The start's row is written with nothing awaited after its last guard, in
  [`scheduler.ts`](/packages/server/src/jobs/scheduler.ts): the workspace is read first, then the
  job, then the reads that await nothing, so a pause or a change opened meanwhile stops the start.
- The settings' read ticks the scheduler, in [`start.ts`](/packages/server/src/jobs/start.ts), but
  runs before the extensions' host refreshes from the same read: a Jobs extension just turned on is
  seen at the timer's next tick, up to 30 seconds later.

## Questions

### Round 01

#### Check these

Six points were settled before the questions: the schedule in words, not cron; a missed run made up
once at the next start; a time skipped while the last run works or its change is open; no usage
threshold; each run a session like any other; and no event triggers, one-off runs, or scheduling by
extensions. The spec's review then changed two: a missed run is never made up, and a job starts
changes by default, with `report_only = true` turning that off.

#### Q1: What may a scheduled run do without you?

**Answer:** A: a run is a session of the main checkout, and a job's change offer is accepted by
itself, going on to a pull request. The spec's review made that the default of every job, where the
answer had it per job.

#### Q2: Where is a job written?

**Answer:** A: `[[jobs]]` tables of `config.toml`, each naming its repositories, its schedule, and
its prompt.

#### Q3: Where do you see and edit jobs in the web UI?

**Answer:** A: a Jobs place per repository, with each job's schedule, next run, and history, a
switch, "Run now", and a form that adds or edits a job.

#### Q4: Which decision holds the rules of scheduled jobs?

**Answer:** B: the run lifecycle decision gains them. "I'm sure some of the existing rules are low
impact. You pad each decision to 10 rules every time." A new decision was "a last resort".

## Decisions

- [Run lifecycle](../decisions/run-lifecycle.md) now covers every run Uraeda starts by itself,
  scheduled jobs included: a job is the human's own, written in their settings, never read from a
  repository.
- [Agents](../decisions/agents.md): scheduling a job is the human's yes for the changes its runs
  start, unless they made the job report only.

## Changes after approval

- A scheduled start that fails is a third outcome, beside started and skipped: recorded once, shown
  as "Could not start: <why>", and not tried again. A start cut by the server's stop records
  nothing.
- A job that names no repository of Uraeda's list shows in every repository's Jobs place, where the
  spec put it on the settings page.
- Of two jobs with one name, each has its card, and every write by that name, and "Run now", is
  refused until one is renamed in `config.toml`.
- "Run now" is refused for any problem of the job but its schedule, and where the Jobs extension is
  off, beyond the spec's one refusal, a run still working.
- A run's offer is accepted at most once: after a refusal, the card is the only way. It is not
  accepted either once the Jobs extension is off in the repository, the job no longer names it, or
  the repository left the list.
- A session that waits for a wakeup its agent set counts as working: its time is skipped, and its
  offer waits for the turn the wakeup starts.
- Every run's note says "Change no file.", not only a report-only job's.
- `hourly` runs in each real hour: the night the clock goes back, the repeated hour runs twice.
- A clock set back is covered by the 50 latest rows of a job in a repository: set back past them, by
  days, a time whose row was pruned runs again.
- A job saved, resumed, or switched on up to 30 seconds before its time runs at it: the settings'
  read ticks the scheduler.
- A skipped time names the open change that blocked it, by the change's own title.
- The card's times read in the server's time zone, whatever the browser's.
- On the phone, the schedule's kind and day are two selectors that open as sheets.
- A job's address carries any name: `new`, `.`, `..`, and a name starting with `~` are written with
  a `~` before them.
- Unticking the page's own repository leaves the page saying so, with "Run it here again".
- A run's row holds three fields beyond the data model: why its change could not start with the turn
  that offer ended, the change that blocked a skipped time, and why a start failed.
- Caught up with multi-accounts: a run's session takes its account as any session does, and the
  sessions' context moved to [`session-context.ts`](/packages/server/src/runner/session-context.ts)
  to keep `sessions.ts` under 500 lines.

## Follow-ups

- The Jobs extension turned on in a repository is seen up to 30 seconds late, so a job due within
  that time waits for its next one: the extensions' host announces no change to tick on.
- The `Jobs` record reads a job's history and its latest run several times per job on each read.
