# URAEDA

裏枝 = back branch

Uraeda is an asynchronous, git-driven development workflow for coding agents. You write a short
proposal. An agent investigates it in depth, comes back with the questions only you can answer, then
with a complete spec to approve. Then it plans, implements, and opens a pull request. Every step is
a plain text file, committed to git, and you answer whenever you have time.

> [!WARNING]
>
> Uraeda is an early proof of concept. It ships as an [agent skill](skills/uraeda/SKILL.md), with
> templates and a filled-in example, and an optional command-line tool, `ura`.

## Why Uraeda

Spec Kit and Kiro give you spec files to fill in with an agent. superpowers gives you an excellent
design conversation with an agent, for as long as you stay in the chat. Uraeda aims for the quality
of that conversation without the conversation: the agent does the research first, asks everything at
once in a file, and you answer in a few words when you have time.

- **Deep discovery before any question.** The agent reads the code, the documentation, and how other
  products solve the problem, before asking you anything. What it can settle itself, it settles, and
  lists for you to check.
- **Questions built for thinking, not searching.** Each one is self-contained: context with sources,
  options with pros and cons, a recommended answer with its reason. Every file waiting for you opens
  with what is asked, an honest time estimate, and what needs your attention.
- **A ledger of your decisions.** High-impact choices, like how dates are stored, become short
  decision files that every later feature must follow. An agent cannot work around one: when a new
  feature needs to change it, the agent proposes the change in that feature's spec, and it only
  takes effect when you approve the spec.
- **Review scales with risk.** The agent proposes a risk tier in each spec, with its reason, and
  whether the plan waits for your review: by default, only for high risk, like a change to every
  saved record. When you approve the spec, you decide, whatever the tier. When the plan does not
  wait for you, the approved spec goes to a pull request without you.
- **Plain text in git, no service.** Markdown in a `specs/` folder, readable on GitHub or in
  Obsidian, with each file's state in its frontmatter. No Jira, no Linear.

It is built for technical users, who read code and designs.

## How you use it today

You run each step yourself: open your coding agent in the repository, and say "continue recurring
tasks", "I answered the questions", or "what is next?". The agent reads the `specs/` folder, finds
the next step from the files alone, does it, commits, and stops when it needs you. You answer or
approve by editing the file, by telling the agent, or with `ura answer` and `ura review`, and run it
again later.

Or let the web UI run it: "Commit and continue" commits your answers or your approval, then starts
Claude Code on the feature's next step, and it works until it needs you again. The feature page
shows the run live, with its log, its estimated cost, and a Stop button. A runner that starts the
agent when you push an answer is planned: see [the project status](#project-status). The skill
follows the [Agent Skills format](https://agentskills.io/specification).

**A good fit** for features worth a spec: where getting the design wrong is costly, and where you
would rather answer ten precise questions than review a guess. **Not a fit** for a one-line fix:
just ask your agent. It assumes a capable model with web access: a discovery round reads a lot, and
takes time and tokens.

## What it looks like

The [example project](skills/uraeda/assets/example/specs/) is a small todo app. The recurring tasks
feature went through the whole workflow:

1. **You write the
   [proposal](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/proposal.md)**: a few
   lines. Tasks that come back once completed, two clicks to set, simple enough for "my parents".
2. **The agent investigates**, and writes
   [discovery-01.md](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/discovery-01.md):
   how Microsoft To Do, Todoist, and Google Calendar handle repeats, the iCalendar standard, and a
   problem in the app's code: due dates stored as timestamps drift by a day across daylight saving
   changes.
3. **It asks you 7 questions** in
   [clarifications-01.md](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md),
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

4. **It writes the [spec](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md)**:
   user stories with acceptance scenarios, the technical design, and two new decisions,
   [due dates](skills/uraeda/assets/example/specs/decisions/due-dates.md) and
   [repeating tasks](skills/uraeda/assets/example/specs/decisions/repeating-tasks.md). You approve
   it, and the decisions become active.
5. **It writes the [plan](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/plan.md)**,
   in the style of superpowers: tasks with the files they touch, their interfaces, and their failing
   tests written out. The spec's risk tier is high, since every saved due date is upgraded, so it
   proposed that you review the plan too, and you kept that when approving it.
6. **It implements the plan, task by task, and opens a pull request**, where you review the code.
7. **It finishes the feature** in the pull request's last commit: one
   [record](skills/uraeda/assets/example/specs/done/2026-10-06-recurring-tasks.md) replaces the
   folder, with what the feature does, each question and its answer, and what changed after you
   approved. Once you merge, `ura clean` removes its worktree and branch.

Every file waiting for you opens with a summary of what is asked, how long it takes, and what to
look at first. Its spec opened like this when it was submitted:

```md
> [!IMPORTANT]
>
> Spec to review, about 20 minutes.
>
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

## The `specs/` folder

```sh
specs/
  README.md                    # the folder layout, for any agent or human
  CONSTITUTION.md              # the project's principles, by priority, written with you at setup
  PRIORITIES.md                # Now, Next, Later, Blocked
  drafts/                      # upcoming features, free form: one becomes a dated folder when you
                               # say "start it"
  backlog/                     # nice-to-have features, not scheduled
                               # a postponed feature keeps its folder here, without its date
  decisions/                   # decision ledger, one file per topic
  done/                        # one record per merged feature or bug, in place of its folder
  bugs/YYYY-MM-DD-<slug>/      # a bug report, and the agent's assessment with its fix
  2026-10-06-recurring-tasks/  # one folder per feature, dated the day it starts
    proposal.md                # you: what and why
    discovery-01.md            # agent: findings and options
    clarifications-01.md       # agent: questions; you: answers
    spec.md                    # agent: behaviour and design; you: approval
    plan.md                    # agent: implementation tasks and tests
```

Each feature lives on a branch named after its folder. You answer and approve on that branch, and a
single pull request merges everything at once: the decisions, the code, and the feature's record,
which replaces its folder in the branch's last commit, while git keeps the folder's history. When
your answers raise new questions, a second round follows, `discovery-02.md` and
`clarifications-02.md`, and so on. Bugs get a lighter flow: the agent reproduces the bug with a
failing test, finds the root cause, and proposes a fix for you to approve.

To start in a project, run `ura init`, or ask the agent to "set up specs/": either creates the
folder, and the agent drafts the constitution with you.

The workflow itself is in the [Uraeda skill](skills/uraeda/SKILL.md), with one
[reference](skills/uraeda/references/) per step and
[templates](skills/uraeda/assets/templates/specs/) for every file.

## Install

`ura` runs on Linux and macOS, on x64 and arm64. From a release:

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/mrtolkien/uraeda/releases/latest/download/uraeda-cli-installer.sh | sh
brew install mrtolkien/tap/ura                     # or with Homebrew
nix run github:mrtolkien/uraeda -- --version       # or with Nix, built from source
```

Then, in your repository, `ura init` sets up `specs/` and installs the skill for your agents. To
install the skill alone, for any agent, run `npx skills add mrtolkien/uraeda`. `ura upgrade`
installs the latest release, through the installer script or Homebrew; with Nix, update the flake
input.

## The `ura` CLI

`ura` performs the mechanical parts of the workflow, for you and for agents. It is optional: the
skill says how to do each step by hand, and names the command that does it.

```sh
ura init                                   # specs/, and the skill for your agents
ura status                                 # every feature and bug, and who it waits on
ura next                                   # the next step for an agent, from the skill's table
ura check                                  # every workflow file against the skill's rules
ura draft "listener"                       # a line of PRIORITIES.md becomes a draft
ura start git-listener-process             # a written draft becomes a started feature
ura answer cli-core Q3 "B, simpler"        # one answer; --submit sends the round
ura review cli-core --comment 50-52 "Why?" # a comment; --approve or --request-changes
```

Every command works without a terminal, and the read commands print JSON with `--json`.

## Inspirations

- [superpowers](https://github.com/obra/superpowers): the flow from clarification to design to plan,
  and plans with test code in every task. Uraeda makes it asynchronous.
- [Spec Kit](https://github.com/github/spec-kit): the file names and their formats: constitution,
  spec, plan, user stories, success criteria. Uraeda adds the decision ledger, numbered question
  rounds, and risk tiers.
- [Plain Text Team](https://github.com/0atman/noboilerplate/blob/main/scripts/34-Plain-Text-Team.md):
  a team's work kept as plain text in git, instead of in a project management tool.

## Building the tools

The tools are a Rust core, the `ura` CLI, and a web UI served with its server: it shows every
feature and file with its structure, and performs every human step, answering, reviewing, drafting,
and jotting down priorities, from a phone too. With Rust, Node 24, and pnpm, or in `nix develop`,
where `pnpm install` stands for `vp install` and the layout tests find their WebKit browser:

```sh
vp install         # dependencies
vp run ready       # every check and test, as CI runs them
vp dev             # the web UI on http://127.0.0.1:4310, for this repository
cargo run -p uraeda-cli -- status
```

`vp dev` reads `.env` at the root, from [`.env.example`](.env.example): `URAEDA_REPO` opens another
repository, `URAEDA_PORT` changes the port, and `URAEDA_ALLOWED_HOSTS` lists the host names it
accepts besides 127.0.0.1, like your machine's full name on your tailnet, `mac.tail1234.ts.net`. The
server listens on 127.0.0.1 only: `tailscale serve --bg 4310` reaches it from your phone, at
`https://mac.tail1234.ts.net/`.

"Commit and continue" needs `claude` installed and signed in on the machine. The server starts it in
the feature's worktree, in `auto` permission mode, with your own Claude Code settings, and with the
server's copy of the skill as a plugin: see the [agents](specs/decisions/agents.md) decision.
Without `claude`, the pages only commit. Sessions and run logs are kept in `runner.sqlite`, in
`URAEDA_DATA_DIR` or your system's data folder, `~/.local/share/uraeda/` on Linux. When Claude Code
changes and runs break, `vp run validate:claude` checks the integration against the installed
`claude`, with a few small runs.

The code is under the MIT or Apache-2.0 licenses, at your option.

## Project status

What is being built now, and next, is in [specs/PRIORITIES.md](specs/PRIORITIES.md): the skill
first, then a CLI, a web UI to view and edit the workflow files, a runner that starts Claude Code
from the web UI, and a git listener that starts it when you commit an answer.
