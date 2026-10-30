# The `specs/` folder

Every workflow file lives in a `specs/` folder at the root of your repository, as plain Markdown,
readable on GitHub or in Obsidian. Each file's state is in its frontmatter. The workflow itself is
in the [Uraeda skill](../skills/uraeda/SKILL.md), with one [reference](../skills/uraeda/references/)
per step, one for its conventions, and [templates](../skills/uraeda/assets/templates/specs/) for
every file. The [example project](../skills/uraeda/assets/example/specs/) shows them filled in.

## Running the workflow

You run each step yourself: open your coding agent in the repository, and say "continue recurring
tasks", "I answered the questions", or "what is next?". The agent reads the `specs/` folder, finds
the next step from the files alone, does it, commits, and stops when it needs you. You answer or
approve by editing the file, by telling the agent, or with `ura answer` and `ura review`, and run it
again later.

Or hand it over from the web UI: "Commit and start the agent" commits your answers or your approval.
It then opens the feature's session with the workflow's message ready to send. You read it, add a
note, and send it. Claude Code works on the next step until it needs you again, while you watch,
write to it, or stop it. See [the web UI's sessions](web-ui.md#sessions-with-claude-code). A runner
that starts the agent when you push an answer is planned.

**A good fit** for features worth a spec. Getting the design wrong is costly there, and you would
rather answer ten precise questions than review a guess. **Not a fit** for a one-line fix: just ask
your agent. It assumes a capable model with web access: a discovery round reads a lot, and takes
time and tokens.

## What the human reads

The agent reads the code, the documentation, and how other products solve the problem, before asking
you anything. What it can settle itself, it settles, and lists for you to check.

Each question is self-contained: context with sources, options with pros and cons, a recommended
answer with its reason. Every file waiting for you opens with what is asked, an honest time
estimate, and what needs your attention.

## Decisions

High-impact choices, like how dates are stored, become short decision files in `decisions/` that
every later feature must follow. An agent cannot work around one: a feature that needs to change it
edits it on its own branch, and lists it in its spec. The change takes effect when you approve the
spec, and you see it marked in place.

## Review and risk

The agent proposes a risk tier in each spec, with its reason. By default, the plan does not wait for
your review, whatever the tier: when you approve the spec, you can turn plan review on. When the
plan does not wait for you, the approved spec goes to a pull request without you.

## A feature, step by step

The [example project](../skills/uraeda/assets/example/specs/) is a small todo app. The recurring
tasks feature went through the whole workflow:

1. **You write the
   [proposal](../skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/proposal.md)**: a few
   lines. Tasks that come back once completed, two clicks to set, simple enough for "my parents".
2. **The agent investigates**, and writes
   [discovery-01.md](../skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/discovery-01.md):
   how Microsoft To Do, Todoist, and Google Calendar handle repeats, the iCalendar standard, and a
   problem in the app's code. Due dates stored as timestamps drift by a day across daylight saving
   changes.
3. **It asks you 7 questions** in
   [clarifications-01.md](../skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md),
   and lists 5 points it settled without you. One of them, trimmed:

   ```md
   ## Q2: When does the next occurrence appear?

   The app cannot create tasks while it is closed. Todoist keeps a single task and moves its due
   date on completion. [...]

   - **A (recommended). Create the next occurrence as a new task when the current one is completed.
     Editing a task changes that task only.**
     - [pro] completed tasks stay in the list as a history; no notion of series to learn.
     - [con] the list grows by one task per completion.
   - **B. Create the next 4 occurrences in advance, so they are always visible.** [...]
   - **C. Keep a single task, and move its due date to the next occurrence when it is completed,
     like Todoist. Editing the task changes the whole repetition.** [...]

   **Answer:** C, we want a simple feature. The repetition is more about time management and
   organization than history (we're a todo app, not a calendar)
   ```

4. **It writes the
   [spec](../skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md)**: what you
   approve first, then two new decisions,
   [due dates](../skills/uraeda/assets/example/specs/decisions/due-dates.md) and
   [repeating tasks](../skills/uraeda/assets/example/specs/decisions/repeating-tasks.md), the user
   stories with their key scenarios, and the architecture. The build details go to the plan. You
   approve it, and the decisions become active.
5. **It writes the
   [plan](../skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/plan.md)**, in the style
   of superpowers: tasks with the files they touch, their interfaces, and their failing tests
   written out. The spec's risk tier is high, since every saved due date is upgraded. So it proposed
   that you review the plan too, and you kept that when approving it.
6. **It implements the plan, building independent tasks at the same time, and opens a pull
   request**, where you review the code. When you want, one message sends it to your comments: it
   fixes each in a commit, and the pull request waits for you again.
7. **It finishes the feature** in the pull request's last commit. One
   [record](../skills/uraeda/assets/example/specs/done/2026-10-06-recurring-tasks.md) replaces the
   folder, with what the feature does, each question and its answer, and what changed after you
   approved. Once you merge, `ura clean` removes its worktree and branch.

Every file waiting for you opens with a summary of what is asked, how long it takes, and what to
look at first. Its spec opened like this when it was submitted:

```md
> [!IMPORTANT]
>
> Spec to review, about 20 minutes.
>
> - You approve tasks that repeat from a menu, a custom screen, or a phrase at the end of their
>   title. Completing one moves it to its next due date, and keeps no history of completions.
> - Two new decisions: repeating tasks, one task whose due date moves, with no history of
>   completions; and due dates, calendar days for every feature with dates.
> - Every saved due date is converted once, when users get the new version. [...]
> - Your answer said rules are typed "when editing the task's title". This spec reads every title
>   typed, when a task is created or edited, like Todoist. Say so if you meant editing only.
> - A "weekends" preset is added next to "weekdays", for your weekdays against weekends need.
> - Risk tier `high`, because of the upgrade of every saved due date: the plan waits for your
>   review.
```

Once you approved, the block stayed as a record, "Approved on 2026-10-09", so later readers see what
you were asked to weigh.

## Layout

```sh
specs/
  README.md                    # the folder layout, for any agent or human
  CONSTITUTION.md              # the project's principles, by priority, written with you at setup
  PRIORITIES.md                # Now, Next, Later
  INBOX.md                     # notes jotted down, waiting to be organized
  proposals/                   # upcoming features, free form: one becomes a dated folder when you
                               # say "start it"; a postponed feature keeps its folder here, undated
  notes/                       # inbox notes with images: their files
  decisions/                   # decision ledger, one file per topic
  done/                        # one record per merged feature or change, in place of its folder
  changes/YYYY-MM-DD-<slug>/   # a change: your proposal, and the questions it needed
  2026-10-06-recurring-tasks/  # one folder per feature, dated the day it starts
    proposal.md                # you: what and why
    discovery-01.md            # agent: findings and options
    clarifications-01.md       # agent: questions; you: answers
    spec.md                    # agent: decisions, stories, architecture; you: approval
    plan.md                    # agent: implementation tasks and tests
    images/                    # your screenshots, linked from your files
```

## Setting it up

To start in a project, run `ura init`, or ask the agent to "set up specs/". Either creates the
folder, and the agent writes the constitution with you. `ura init` also offers to install the skill
for your user, when your agents have none.

The project is set up once it holds its constitution, written rather than the template, and two
decisions, `code-quality.md` and `testing.md`. A `preview.md` decision is optional. Until then, the
web UI's Home shows a Setup pane, and `ura status` lists the files missing.

## Features

Each feature lives on a branch named after its folder. You answer and approve on that branch. A
single pull request merges everything at once: the decisions, the code, and the feature's record.
The record replaces its folder in the branch's last commit, while git keeps the folder's history.
When your answers raise new questions, a second round follows, `discovery-02.md` and
`clarifications-02.md`, and so on.

## Changes

Bug fixes and small changes take a lighter flow, a change. You type the request under Change on the
web UI's New page, or accept the change the agent offers in a session. Its agent works in its own
branch and worktree. It investigates and asks only what you must decide. It makes the change with
tests that fail first, has a fresh reviewer check it, and opens a pull request.

There is no spec and no plan, and often nothing to answer before the review. A change that turns out
too big is offered to you as a feature, and becomes one in place, its code kept.

## The inbox

Small things you notice while working, a misaligned icon or a confusing command, go in the inbox,
`specs/INBOX.md`, in a few seconds. Use the web UI's ＋, or `ura note`, which agents use too. You
organize the notes later into proposals or changes, by hand or by answering an agent's proposed
triage.
