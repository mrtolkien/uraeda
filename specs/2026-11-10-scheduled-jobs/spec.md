---
status: approved
revision: 2
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Scheduled jobs

> [!NOTE]
>
> Approved on 2026-11-10.
>
> - You approve jobs written in `config.toml` that run a prompt at set times, a Jobs place to see,
>   test, and write them, and runs that start the change they offer, unless a job is report only.
> - Since your review: a time that passes while Uraeda is not running is never made up. A job waits
>   for its next time.
> - Since your review: a job starts changes by default. I read "the flag the other way around" as a
>   key that turns it off, `report_only = true`.
> - The relaxed guard now holds for every job that is not report only. A web page or a changelog its
>   run reads could talk it into a branch, a commit on main, and a pull request nobody asked for.
>   Nothing merges without you.
> - Since your review: the Agents rule is reworded, in two sentences.
> - Since your review: each job is a card, its name and schedule on a raised head, then its next and
>   last run under labels, each with an icon.
> - Unchanged: Run lifecycle's rules, and the risk tier `high`, without a plan review.

A job is a prompt Uraeda sends to an agent at set times, in each repository it names, so upkeep like
a daily dependencies upgrade no longer waits for you. Each run is a new session, and starts the
change it offers, up to a pull request, unless you made the job report only. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## Your review

- **C1** (missed runs made up): done. A time that passes while Uraeda is not running is missed, and
  nothing makes it up: reopening an old repository starts no job.
- **C2** (the Agents rule's wording): done. It reads: "An agent MUST NOT turn a session into a
  change, or a change into a feature, without the human's yes. Scheduling a job is that yes for the
  changes its runs start, unless the human made the job report only."
- **C3** (starting changes should be the default): done. Every job starts the change its run offers.
  `report_only = true`, "Report only" on its page, turns that off for a job.
- **C4** (the jobs list reads as one blob): done. Each job is a card with a raised head, labelled
  facts, and icons, on the desktop and the phone.

## Decisions

- **Changed: [Run lifecycle](../decisions/run-lifecycle.md)**. It covers every run Uraeda starts by
  itself, scheduled jobs included: a job is your own, written in your settings, never read from a
  repository.
- **Changed: [Agents](../decisions/agents.md)**. Scheduling a job is your yes for the changes its
  runs start, unless you made the job report only.

Relied on:

| Decision                                         | What it means for this spec                                        |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| [Settings](../decisions/settings.md)             | jobs are tables of `config.toml`, written keeping your comments    |
| [Extensions](../decisions/extensions.md)         | the Jobs place is a built-in extension, turned off like the others |
| [Models](../decisions/models.md)                 | a run's session keeps the agent and model it started on            |
| [Git](../decisions/git.md)                       | a change a job starts commits its start alone, as any start does   |
| [Feature status](../decisions/feature-status.md) | a run and the change it starts read as any session and change do   |
| [Notifications](../decisions/notifications.md)   | a run notifies only when it comes to need you                      |
| [Keyboard](../decisions/keyboard.md)             | the page's keys are in the registry, each one also a tap           |
| [Sandbox](../decisions/sandbox.md)               | sample jobs run on the fake agent, and the clock starts none       |
| [Preview](../decisions/preview.md)               | the mockups are stories of the real components                     |

## User stories

### US1: A job runs at its time (P1)

You write a job in `config.toml`: a name, a prompt, a schedule, and repositories. At each of its
times, Uraeda starts a new session in each repository's main checkout, named after the job. The
session opens with a line saying why it started, then gets the prompt. Under it, a note from Uraeda
says nobody follows the session. The run ends as any session does: a new reply to read, or a failure
that asks for you.

[A run's session](/packages/web/src/jobs/JobsMockups.stories.tsx#SessionLines)

[The switch for all jobs](/packages/web/src/jobs/JobsMockups.stories.tsx#RunsSection)

Key scenarios:

1. **Given** the job "Dependencies", `schedule = "daily 03:00"`, in uraeda, **When** the clock
   reaches 3:00 on Wednesday 11 November, **Then** a session "Dependencies" starts in uraeda with
   the line "Started by the schedule “Dependencies”." and the job's prompt.
2. **Given** that job in uraeda and notes, **When** it is 3:00, **Then** uraeda's run starts at 3:00
   and notes' at 3:01.
3. **Given** "Run scheduled jobs" turned off at 22:00 and on again at 9:00, **When** 3:00 passed
   meanwhile, **Then** no run started, and the next one is tomorrow at 3:00.

More scenarios:

1. **Given** a job with `agent = "codex"` and no model, **When** it runs, **Then** its session
   starts on Codex's default model and effort.
2. **Given** a run that meets the session limit at 3:05, **When** the limit resets, **Then** the run
   continues, as any run does.
3. **Given** `schedule = "hourly"`, **When** it is 14:00, **Then** a run starts.

### US2: Missed and skipped runs (P1)

A time that passes while Uraeda is not running, the server off or the machine asleep, is missed.
Nothing makes it up: the job waits for its next time. A time is skipped while the job's last run
still works in that repository, or while a change it started there is still open. A skipped time is
not made up either.

Key scenarios:

1. **Given** "Dependencies", daily at 3:00, and the server off from Monday 22:00 to Tuesday 9:12,
   **When** it starts, **Then** no run starts, and the job's next run is Wednesday at 3:00.
2. **Given** five jobs in a repository, and the server off for 5 days, **When** it starts, **Then**
   no job runs before its next time.
3. **Given** Tuesday's run started the change "Upgrade three dependencies", still open, **When** it
   is 3:00 on Wednesday, **Then** no run starts, and the history reads "Skipped: the change “Upgrade
   three dependencies” is still open."

More scenarios:

1. **Given** Tuesday's run still waiting for a limit's reset, **When** it is 3:00 on Wednesday,
   **Then** the history reads "Skipped: its last run still works."
2. **Given** that change merged on Wednesday at 10:00, **When** it is 3:00 on Thursday, **Then** a
   run starts.
3. **Given** the machine asleep at 3:00, **When** it wakes at 3:03, **Then** the run starts: a time
   is missed once it is more than 5 minutes past.

### US3: A run starts the change it offers (P1)

Scheduling a job is your yes in advance. When its run ends on a change offer, Uraeda starts that
change as the offer's card would: its proposal, its branch, its worktree. The session moves into it
and goes on to a pull request, which waits for you. A job with `report_only = true` starts none: the
offer's card waits in the session, as in any session.

Key scenarios:

1. **Given** the job "Dependencies", **When** its run ends on the offer "Upgrade three
   dependencies", **Then** the change starts, the session reads "The job “Dependencies” started the
   change “Upgrade three dependencies”.", and its pull request later reads "PR ready" in Needs you.
2. **Given** that job, **When** its run ends on "Nothing to upgrade." with no offer, **Then**
   nothing is made: no commit, no branch, no worktree.
3. **Given** "Performance pass" with `report_only = true`, **When** its run ends on a change offer,
   **Then** the card waits for you, and nothing starts.

More scenarios:

1. **Given** a change that cannot start, its folder's name taken, **When** the run ends, **Then**
   the session asks for you under the banner "The change could not start by itself.", with the
   reason, and the card stays.
2. **Given** a change a job started, **When** its agent offers to make it a feature, **Then** that
   offer waits for you.
3. **Given** you wrote in a run's session, **When** the agent then offers a change, **Then** the
   card waits for you: only the run's own turns start one.

### US4: The Jobs place (P2)

Jobs, a place of each repository, opens with `Space j` or `g j`, and from the phone's `…` tab. It
lists the jobs that name the repository, each as a card. Its head holds the job's name, its schedule
in words, and the switch that pauses it. Under it, "Next run" and "Last run" each have an icon: when
it runs next or why it does not, and what its last run left for you. A job that only reports wears
"Report only". A job's page ends with its history here, newest first: each run's session or change
as its card, and each skipped time with its reason.

[The jobs](/packages/web/src/jobs/JobsMockups.stories.tsx#JobsList)

[On the phone](/packages/web/src/jobs/JobsMockups.stories.tsx#JobsListPhone)

[No job yet](/packages/web/src/jobs/JobsMockups.stories.tsx#JobsEmpty)

[All jobs off](/packages/web/src/jobs/JobsMockups.stories.tsx#JobsOff)

The keys, on the selected card's bar: Enter opens the job's page, `r` runs it now, `p` pauses or
resumes it, `d` deletes it, and `a` adds a job. Each is also a tap.

Key scenarios:

1. **Given** "Dependencies" selected, **When** you press `r`, **Then** a run starts at once with the
   line "Started by “Run now” of the job “Dependencies”.", and its session opens.
2. **Given** "Dependencies" on, **When** you turn its switch off, **Then** `on = false` is written
   in its table, its card reads "Paused" under Next run, and 3:00 passes without a run.
3. **Given** a job whose schedule reads `dayly 06:00`, **When** you open Jobs, **Then** its card
   reads "Not running: the schedule “dayly 06:00” is not understood".

More scenarios:

1. **Given** "Dependencies" selected, **When** you press `d`, **Then** the shared confirmation asks
   "Delete the job “Dependencies”? Its prompt leaves config.toml, and its sessions stay."
2. **Given** a run of "Dependencies" at work here, **When** you press `r`, **Then** it is refused
   under the card: "“Dependencies” still runs here."
3. **Given** a paused job, or all jobs off, **When** you press `r`, **Then** the run starts.

### US5: Write a job in the web UI (P2)

A job's page is a form: its name, its prompt, its schedule, its repositories, its agent, model, and
effort, and "Report only". Each field of an existing job saves as you leave it, as the settings do.
A new job is added by one button once its name and prompt are filled. "Run now" sits by the page's
title, and on the phone it is the bottom bar's one action, which the mockup leaves out.

[A job's page](/packages/web/src/jobs/JobPageMockups.stories.tsx#JobOpen)

[On the phone](/packages/web/src/jobs/JobPageMockups.stories.tsx#JobOpenPhone)

[A new job](/packages/web/src/jobs/JobPageMockups.stories.tsx#JobNew)

Key scenarios:

1. **Given** the Jobs place of uraeda, **When** you press `a`, type the name "Dependencies" and a
   prompt, keep Daily at 03:00, and press "Add the job", **Then** a `[[jobs]]` table is added to
   `config.toml`, and its card reads "Tomorrow at 3:00" under Next run.
2. **Given** that job's page, **When** you pick Weekly, Monday, and type 04:00, **Then**
   `schedule = "monday 04:00"` is written, and the card reads "Every Monday at 4:00".
3. **Given** the time field, **When** you type 25:00 and leave it, **Then** it is refused under the
   field, "A time is from 00:00 to 23:59.", and the file keeps 03:00.

More scenarios:

1. **Given** a job "Dependencies", **When** you name a second one the same, **Then** it is refused:
   "A job named “Dependencies” exists already."
2. **Given** a job in uraeda alone, **When** you untick uraeda, **Then** it is refused: "A job runs
   in one repository at least."
3. **Given** a job edited by hand in `config.toml`, **When** you save the file, **Then** its page
   shows the edit within a second.

## Architecture

Jobs are settings, so the core reads and writes them. The server gains a scheduler beside
[the catch-up of pull requests](/packages/server/src/catch-ups.ts), the closest pattern: an
automatic run behind a switch, one at a time. A run is a plain session, and a job's change starts
through the path the offer's card already uses. See [what a run is](discovery-01.md#what-a-run-is)
and [the data model](data-model.md).

- **The job settings**, in the core, read, validate, and write the `[[jobs]]` tables and the switch
  for all jobs. They own the schedule's forms and each job's problems.
- **The scheduler**, in the server, compares the clock with each job's times every 30 seconds. It
  owns which times are due, missed, or skipped, and the minute between runs due together.
- **The record of runs**, in the cache of sessions, keeps each run and each skipped time. The
  scheduler and the history read it.
- **The run's start** opens a session in the main checkout on the job's pick, with its line and its
  message. It owns the note under the prompt.
- **The offer's acceptance** reads the change offer a run's turn ended on, and starts it as the card
  does. It owns when an offer starts by itself: never for a report-only job, and only in the run's
  own turns.
- **The Jobs place**, a built-in extension, draws the list, a job's form, and its history, and sends
  their writes to the job settings.
- **The skill** says scheduling a job is your yes given in advance: its rule on offering a change,
  and "Starting a change" in its change and projects references.

Tradeoffs:

- A run reads your main checkout, where your uncommitted edits are. Nothing but the skill's rule and
  the run's note keeps an agent from editing there.
- The history lives in a cache. If the cache is lost, so is the history.
- The server reads the offer's block too, which only the web UI read until now.
- A run starts up to 30 seconds after its time.
- The list draws its own card, with a switch, since the shared list's rows are outlines edited in
  place. It departs from [the components guide](../ui/components.md) there.
- Scheduled runs start unseen, against [the flows guide](../ui/flows.md): that is the feature. "Run
  now" opens the session it starts.

## Edge cases

| Importance | Situation                                                    | What happens                                                             |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| High       | A page read by a run talks it into offering a change         | unless the job is report only, the change starts, up to a pull request   |
| High       | `config.toml` cannot be read                                 | no job runs, and the Jobs place says why, as the settings page does      |
| High       | The main checkout has uncommitted edits when a change starts | the start commits its own files alone, as any start does                 |
| High       | A job is edited while its run works                          | the run keeps the prompt it started with                                 |
| Normal     | The server restarts during a run                             | the run continues, as any run does                                       |
| Normal     | A job names a repository that left Uraeda's list             | it runs in the others; its page reads "“notes” is not in Uraeda's list." |
| Normal     | The job's agent is off in a repository                       | no run there: "Not running here: Claude Code is off in this repository." |
| Normal     | Two jobs have one name                                       | the second does not run: "Two jobs are named “Dependencies”."            |
| Normal     | You stop a run                                               | it ends as any stopped session, and the next time runs                   |
| Normal     | The Jobs extension is off in a repository                    | its place is gone there, and no job starts there                         |
| Niche      | The night the clock moves forward, a job at 2:30             | it runs once, at 3:00                                                    |
| Niche      | The night the clock moves back, a job at 2:30                | it runs once, at the first 2:30                                          |
| Niche      | The system clock is set back                                 | a time already run does not run again                                    |
| Niche      | A job renamed by hand                                        | it starts a new history                                                  |

## Success criteria

- **SC-001** (within a minute): With the server running, a run starts less than 60 seconds after its
  time.
- **SC-002** (nothing made up): After any time off, no run starts for a time that passed meanwhile.
- **SC-003** (no overlap): The schedule never starts a job's run in a repository where its last run
  works, or its change is open.
- **SC-004** (a quiet night leaves nothing): A run that offers no change adds no commit, branch, or
  worktree.
- **SC-005** (report only holds): No change starts without your yes from a report-only job, or
  outside a run's own turns.
- **SC-006** (hand edits kept): A write from the Jobs place keeps the comments, unknown keys, and
  order of `config.toml`.
- **SC-007** (the phone): At 390 px, a job is added, paused, and run with no sideways scroll, every
  target 44 px at least.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, but one
your review changed: a missed run is not made up. Settled while writing this spec:

- A time counts as missed once it is more than 5 minutes past when the server sees it.
- A missed time leaves no line in the history: the server was not there to note it.
- Times that pass while a job is paused, or while all jobs are off, are missed too.
- "Run now" ignores the pause, the switch for all jobs, and an open change. It is refused only while
  the job's run works in that repository.
- "Run now" starts the change its run offers, as a scheduled run does: it tests the job as it runs.
- The slug of a change a job starts is the one the offer's card suggests.
- Deleting a job asks first: the undo stack does not hold the settings file.
- The wording of Uraeda's note under the prompt is the plan's. It says nobody follows the session,
  and whether a change the run offers starts by itself.
- Jobs with a problem that name no listed repository show on the settings page, with the file's
  other problems.
- The place's icon is a clock; the mockups draw the history's icon, which the app already ships.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ⚠️                   | ✅             | ✅         | ✅                | ✅                |

- I. A job lets an agent open a change no human read. You schedule each job, "Report only" turns it
  off for one, and nothing merges without you.

## Risk tier

**high**: an agent runs unattended, and a guard on starting changes is relaxed.

## History

> [!NOTE]
>
> Changes requested on 2026-11-10: no making up of missed runs, changes started by default, a
> clearer Agents rule, and the jobs as cards.
>
> - You approve jobs written in `config.toml` that run a prompt at set times, a Jobs place to see,
>   test, and write them, and, for the jobs you allow, changes started without you.
> - A relaxed guard: a web page or a changelog read by a job that starts changes could talk it into
>   a branch, a commit on main, and a pull request nobody asked for. Nothing merges without you.
> - Run lifecycle changes, with no new decision, as you asked: it now covers jobs, in 8 rules as
>   before. Its restart and limit rules merged, and the polling hook left its alternatives.
> - Agents changes: your yes to a change may be given in advance, for a job you scheduled.
> - Runs work in your main checkout, beside your uncommitted edits. Only the skill's rule keeps a
>   run from editing there.
> - Two points settled here: times that pass while a job is paused are not made up, and turning the
>   Jobs extension off in a repository also stops its jobs there.
> - Risk tier `high`, without a plan review.
