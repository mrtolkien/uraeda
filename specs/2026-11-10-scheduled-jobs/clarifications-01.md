---
status: answered
---

# Clarifications, round 01: Scheduled jobs

> [!NOTE]
>
> Answered on 2026-11-10.
>
> - Verdict: worth building, with changes: as written, a nightly upgrade could only offer a change
>   and wait for you, since only a human starts one.
> - No running branch is in the way: Run options is merged and no pull request is open, so this
>   starts now.
> - What a run may do alone lasts beyond this feature. One answer lets an agent start a change
>   nobody read, on a page's or a changelog's word. Nothing merges without you.
> - Where a job is written decides who can make your machine run an agent unattended.
> - The answers become a new decision or rules of an existing one: the last question.
> - Six points to check before the questions: the schedule's format, missed runs, skipped runs,
>   usage, the session list, and what is left out.

## Context

### Goal

The [proposal](proposal.md) asks for agent runs that start by themselves at set times, per
repository, like a daily dependencies upgrade and a performance pass. Upkeep then no longer waits
for you to start it.

### Today

Nothing in Uraeda fires at a time of day, and nothing stores a prompt to send later. The rest
exists:

- A session starts in the main checkout, or as a change, on a picked agent, model, and effort.
- Uraeda already starts runs by itself: continues after a restart or a limit, and the catch-up of
  pull requests ([`catch-ups.ts`](/packages/server/src/catch-ups.ts)). Each has a switch, and says
  why in its session.
- In a session of the main checkout, the agent offers a code change as a card, and changes no file
  before your yes.

| Product             | Where a job is stored              | Where a run works              | A missed run        |
| ------------------- | ---------------------------------- | ------------------------------ | ------------------- |
| Claude Code Desktop | a prompt file in `~/.claude/`      | your folder, or a new worktree | one catch-up run    |
| Claude Code cloud   | your claude.ai account             | a fresh clone, its own branch  | not said            |
| Codex               | the app                            | your project, or a worktree    | not said            |
| GitHub Actions      | a workflow file, in the repository | a fresh clone                  | delayed, or dropped |

All of them give a job a name, a prompt, a schedule, a pause switch, "Run now", and a history. None
merges a run's work.

### Scope

A job: a name, a prompt, a schedule, the repositories it runs in, and its agent, model, and effort.
Its runs, their history, pausing, and running one now. Left out: runs triggered by an event, like a
merged pull request, and one-off runs at a future time.

### Sources

- The runner and its automatic runs, the starts of changes, the settings in the core, and the
  extension API.
- The decisions on [agents](/specs/decisions/agents.md),
  [the run lifecycle](/specs/decisions/run-lifecycle.md),
  [run options](/specs/decisions/run-options.md), [settings](/specs/decisions/settings.md), and
  [extensions](/specs/decisions/extensions.md).
- The documentation of Claude Code's
  [Desktop](https://code.claude.com/docs/en/desktop-scheduled-tasks) and
  [cloud](https://code.claude.com/docs/en/routines) scheduled tasks, Codex's scheduled tasks, GitHub
  Actions' `schedule`, and Renovate's scheduling.
- The full investigation is in [discovery](discovery-01.md).

## Check these

- **The schedule's format** is words, not cron: `daily 03:00`, `weekdays 03:00`, `monday 03:00`, or
  `hourly`, in the server's local time. It reads at a glance and needs no library. Cron's patterns
  can come later. See [discovery](discovery-01.md#the-schedules-format).
- **A missed run** starts once when the server next starts, however many times were missed. A 3:00
  job may then run at 9:00, while you work. Claude Code Desktop does the same. See
  [discovery](discovery-01.md#missed-runs).
- **A skipped run** happens while the job's last run still works, or while a change it started is
  still open. Two pull requests upgrading the same files would conflict. The history says why it
  skipped. See [discovery](discovery-01.md#overlapping-runs).
- **Usage** has no threshold: a run that meets a session limit waits for its reset, as any run does.
  A night job can therefore eat into the morning's window. See [discovery](discovery-01.md#usage).
- **The session list** shows each run as a session like any other, reading as a new reply when it
  ends. A daily job adds seven a week, and no run hides for having nothing to say.
- **Left out**: event triggers, one-off runs, and a way for your own extensions to schedule runs.
  The extension API starts no session today, and no job named needs it.

## Q1: What may a scheduled run do without you?

Example: "Dependencies" runs every day at 3:00 in uraeda. Tonight, three packages have a new
version. Tomorrow night, none does.

Each run is a new session. In a session of the main checkout, the agent offers a code change and
waits for your yes. The [agents](/specs/decisions/agents.md) decision says an agent never turns a
session into a change "unless the human accepts it". The skill and the web UI's instructions say the
same. A job that upgrades needs that yes given in advance. More in
[discovery](discovery-01.md#what-a-run-is).

Why it matters: it decides whether you wake up to a pull request or to an offer. It also changes a
rule of the agents decision that guards every session.

- **A (recommended). A run is a session of the main checkout. A job you marked "starts changes" has
  its change offer accepted by itself, going on to a pull request. Other jobs only report.**
  - Example: tonight the session offers "Upgrade three dependencies", the change starts, and a pull
    request waits for you. Tomorrow the session says there is nothing to upgrade, and nothing else
    is made.
  - [pro] one kind of run covers upgrades and reports, and a quiet night leaves no branch.
  - [con] a web page or a changelog the agent reads could talk it into starting a change nobody
    asked for; it still cannot merge.
  - Why recommended: it is the only option that upgrades overnight and stays silent on quiet nights.
    The switch is off unless you set it, per job.
- **B. A run is a session of the main checkout that only reports: a change it offers waits for your
  yes on its card.**
  - Example: tonight's session ends on the offer "Upgrade three dependencies". The upgrade starts
    when you accept it.
  - [pro] the agents decision holds as it is.
  - [con] the upgrade waits for you, which the proposal wants to end.
- **C. Every run starts a change from the job's prompt, in its own branch and worktree.**
  - Example: tonight a change starts and ends in a pull request. Tomorrow a change starts too: a
    commit on main, a line in Now, and a branch, for you to drop.
  - [pro] no offer to accept, and the run never works in your checkout.
  - [con] a commit on main every night, and a job that only reports has no place.

**Answer:** A

## Q2: Where is a job written?

Example: you want "Dependencies" in uraeda and in a second repository, with a prompt of fifteen
lines.

"Per repository" can mean a file in the repository, or a setting naming it. The
[settings](/specs/decisions/settings.md) decision keeps settings in one TOML file, never read from a
repository, with theme files as its only folder. The [run options](/specs/decisions/run-options.md)
decision keeps a cloned repository from choosing what your runs spend. More in
[discovery](discovery-01.md#where-a-job-is-defined).

Why it matters: it decides who can change what an agent runs unattended on your machine, and which
decision moves.

- **A (recommended). Jobs are `[[jobs]]` tables of `config.toml`, each naming its repositories, its
  schedule, and its prompt as a multi-line string.**
  - Example: one table, `repositories = ["uraeda", "notes"]`, kept in your dotfiles.
  - [pro] no decision changes, one job serves several repositories, and only you write it.
  - [con] a long prompt in a TOML string is less pleasant to edit than Markdown.
  - Why recommended: it follows both decisions as they are. A long prompt can name a skill or a file
    of the repository to follow.
- **B. Each job is a Markdown file in a `jobs/` folder beside `config.toml`: its schedule and
  repositories in the frontmatter, its prompt as the body.**
  - Example: `~/.config/uraeda/jobs/dependencies.md`, like Claude Code Desktop's prompt files.
  - [pro] the prompt is Markdown, and still only you write it.
  - [con] the settings decision gains a second folder of files.
- **C. Each job is a Markdown file in the repository, `specs/jobs/dependencies.md`, and runs only on
  a machine where you turned it on.**
  - Example: one file in each of the two repositories, shared with whoever clones them.
  - [pro] in git, reviewed, and shared with collaborators.
  - [con] anyone who can push to the repository could change what your agent runs unattended, and
    the skill gains a new kind of file.

**Answer:** A

## Q3: Where do you see and edit jobs in the web UI?

Every product read lists jobs with their next run and a history, skipped runs included. Uraeda's
places are built-in extensions, each one able to be turned off, by the
[extensions](/specs/decisions/extensions.md) decision. More in
[discovery](discovery-01.md#seeing-and-editing-jobs).

Why it matters: it sets most of the feature's size. Without a page, nothing shows why a run was
skipped, or when the next one is.

- **A (recommended). A Jobs place per repository lists its jobs with their schedule, next run, and
  history. Each has a switch and "Run now", and a form adds or edits a job.**
  - [pro] a job is written, tested, and paused from the phone.
  - [con] the most to build: the form writes the job where Q2 puts it.
  - Why recommended: "Run now" and the history are how a prompt gets tested. The settings decision
    has the web UI write what the file holds.
- **B. The same Jobs place without the form: jobs are written by hand in the file.**
  - [pro] less to build, and the history and "Run now" stay.
  - [con] no new job from the phone.
- **C. No page: jobs live in the file, and their runs show among the sessions.**
  - [pro] the least to build.
  - [con] skipped runs and the next run show nowhere, and testing means editing the schedule.

**Answer:** A

## Q4: Which decision holds the rules of scheduled jobs?

The answers above make rules that outlive the feature: who may write a job, what a run may do alone,
and that runs never overlap. The [run lifecycle](/specs/decisions/run-lifecycle.md) decision holds
the automatic runs of today, in 8 rules of the 10 a decision may have. With a job that starts
changes (A in Q1), the agents decision changes too, whatever you pick here. More in
[discovery](discovery-01.md#the-decision).

Why it matters: agents read a decision alone before a task, and find it by its topic.

- **A (recommended). A new decision, "Scheduled jobs", holds them.**
  - [pro] found by its topic, and the run lifecycle decision stays about continuing runs.
  - [con] one more decision in the ledger.
  - Why recommended: about five rules would not fit beside the run lifecycle's eight.
- **B. The run lifecycle decision gains them, and its intent widens to every run Uraeda starts.**
  - [pro] every automatic run in one place.
  - [con] it passes 10 rules, or its rules merge and lose detail.

**Answer:** B: I'm sure some of the existing rules are low impact. You pad each decision to 10 rules
every time.

If it's really too big for the same decision, go with A, but it should be a last resort.

## Settled without the human

### Behaviour

- **Each run says why it started**, with a first line like "Started by the schedule “Dependencies”."
  The run lifecycle decision asks it of every automatic run.
- **A job's agent, model, and effort** are its own, else those of a new chat. A change it starts
  follows your run map, as any change. See [discovery](discovery-01.md#needs-no-choice).
- **A switch for all jobs** joins the `[runs]` settings, with its flag and its variable, beside each
  job's own switch. The run lifecycle decision asks for one per kind of automatic run.
- **Jobs due at the same minute** start a minute apart, as runs waiting for the same reset do.
- **A run that fails or is stopped** asks for you like any run. One cut by a restart or a limit
  continues like any run.
- **A night when the clock changes** runs the job once: at the next minute that exists, or at the
  first of two.
- **A job naming a repository** that left the list, or whose agent is off, does not run there, and
  its row says why.
- **Notifications** do not change: a run notifies only when it comes to need you.

### Under the hood

- **The Jobs place** is a built-in extension, turned off like the others. The scheduler is part of
  the server, beside the catch-up of pull requests.
- **Each job's latest fire** is kept in Uraeda's data folder, so a restart knows what it missed. See
  [discovery](discovery-01.md#likely-changes).
- **No dependency** is added: the next local time is computed with what Node has.
- **The sandbox** gets sample jobs that the clock never starts: "Run now" starts one on the fake
  agent.
- **The documentation** of the web UI gains the jobs, their settings, and their page.

**Notes:**
