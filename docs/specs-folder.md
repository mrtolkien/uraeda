# The `specs/` folder

Every workflow file lives in a `specs/` folder at the root of your repository, as plain Markdown,
readable on GitHub or in Obsidian. Each file's state is in its frontmatter. The workflow itself is
in the [Uraeda skill](../skills/uraeda/SKILL.md), with one [reference](../skills/uraeda/references/)
per step, one for its conventions, and [templates](../skills/uraeda/assets/templates/specs/) for
every file. The [example project](../skills/uraeda/assets/example/specs/) shows them filled in.

## Running the workflow

You run each step from your coding agent, in a terminal or a session host: say "start the tags
proposal", "I answered the questions", or "what is next?". The agent reads the `specs/` folder,
finds the next step from the files alone, does it, commits, and runs on until it needs you. You
answer or approve by editing the file, by telling the agent, with `ura answer` and `ura review`, or
on the pages of `ura serve`. You commit nothing: the next agent step commits your work first, as it
left it. Then you tell the agent to continue, or `ura serve` tells your T3 Code session.

Each step runs on a pick, an agent, a model, and an effort, and some steps share a session while
others start a new one. You choose both in `ura`'s settings, outside the repository, and `ura next`
tells the agent which applies. See [the CLI](cli.md#ura-serve).

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

A boundary you set, that every later feature must respect, like "a task due Monday stays due
Monday", becomes a short decision file in `decisions/`. It opens with your words, as a quote, then
holds a few rules, each a plain sentence followed by "_So:_" and a case it settles, and why. An
agent cannot work around one: a feature that needs to change it edits it on its own branch, and
lists it in its spec. You approve the change with the spec, where you see it marked in place, and
the merge brings it in.

How an area should feel and behave, its layouts, its keys, its wording, is not a decision but a
guide: a free-form file, edited with each feature that learns something about it, in `ui/` for a UI
and in `guides/` for any other area.

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
   approve it, and its decisions with it: the merge brings them in.
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
   approved. Once you merge, the next agent that finds the record sets the proposal's note `done`.
   The worktree and the branch stay until you remove them.

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
  decisions/                   # decision ledger, one file per topic
  ui/                          # the UI's guides, free form
  guides/                      # the guides of other areas, free form
  done/                        # one record per merged feature or change, in place of its folder
  changes/YYYY-MM-DD-<slug>/   # a change: your proposal, and the questions it needed
  2026-10-06-recurring-tasks/  # one folder per feature, dated the day it starts
    proposal.md                # you: what and why; the branch's first commit
    discovery-01.md            # agent: what the round's questions rely on, and the map of the code
    clarifications-01.md       # agent: questions; you: answers
    spec.md                    # agent: decisions, stories, architecture; you: approval
    spec-review.md             # you: comments on the spec, with your verdict
    plan.md                    # agent: implementation tasks and tests
    rulings.md                 # agent: what the build settled that you will notice
    images/                    # your screenshots, linked from your files
```

Ideas, the inbox of things you notice, priorities, proposals not started yet, and the long research
behind each round live in your notes, outside git: see [Notes](#notes) below.

## Setting it up

To start in a project, run `ura init`, or ask the agent to "set up specs/". Either creates the
folder, and the agent writes the constitution with you. `ura init` also offers to install the skill
for your user, when your agents have none.

The project is set up once it holds its constitution, written rather than the template, and two
decisions, `code-quality.md` and `testing.md`. A `preview.md` decision is optional. Until then,
`ura status` lists the files missing.

## Features

Each feature lives on a branch named after its folder, in a worktree of its own, from its first
commit, the proposal, to its merge. The default branch gets nothing until then. You answer and
approve in that worktree. A single pull request merges everything at once: the decisions, the code,
and the feature's record. The record replaces its folder in the branch's last commit, while git
keeps the folder's history. When your answers raise new questions, a second round follows,
`discovery-02.md` and `clarifications-02.md`, and so on.

## Changes

Bug fixes and small changes take a lighter flow, a change. You ask your agent for it, or accept the
change it offers when you ask for a code change in a session. It works on its own branch,
`change/YYYY-MM-DD-<slug>`, and worktree. It investigates and asks only what you must decide. It
makes the change with tests that fail first, has it reviewed by the reviewers you set in `ura`'s
settings, or by a fresh reviewer, and opens a pull request.

There is no spec and no plan, and often nothing to answer before the review. A change that turns out
too big is offered to you as a feature, and becomes one in place, its code kept.

## Notes

What changes daily stays out of git, in your notes: an inbox of things you notice, ideas, proposals
not started yet with their priority, and the research agents write. Any notes app that keeps plain
Markdown files works. The skill's [Notes](../skills/uraeda/references/notes.md) lays out an Obsidian
vault: `inbox/`, a `wiki/` the agents write, and `projects/<repository>/` with its `proposals/` and
`research/`. A proposal's frontmatter, `status` and `rank`, makes a board of them.

A feature enters git when it starts: the agent copies its proposal, unchanged, as the first commit
of its branch, and sets the note `started`. With `ura`, the vault is one folder for every
repository, which `ura serve` syncs with Obsidian on your phone: see
[the CLI](cli.md#your-notes-on-your-phone).
