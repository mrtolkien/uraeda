<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/banner-dark.svg">
    <img src="docs/images/banner-light.svg" alt="Uraeda" width="576">
  </picture>
</p>

**An asynchronous, git-driven development workflow for coding agents.**

You write a short proposal. An agent investigates it in depth, comes back with the questions only
you can answer, then with a complete spec to approve. Then it plans, implements, and opens a pull
request. Every step is a plain text file, committed to git, and you answer whenever you have time.

Uraeda has two parts, the second optional:

- **A workflow**, shipped as an [agent skill](skills/uraeda/SKILL.md), with templates and a
  filled-in example. It works with any agent that reads
  [Agent Skills](https://agentskills.io/specification), like Claude Code, Codex, or OpenCode.
- **`ura`**, a small command-line tool that checks the workflow's files, says what is next and on
  which model, and serves pages to answer questions and review specs on, from your phone too. It
  never commits, branches, or makes a worktree: agents do.

Uraeda runs no agent itself. Your agents run where you already run them: a terminal, or a session
host like T3 Code.

> [!WARNING]
>
> Uraeda is an early proof of concept.

## Why Uraeda

Spec Kit and Kiro give you spec files to fill in with an agent. superpowers gives you an excellent
design conversation, for as long as you stay in the chat. Uraeda aims for the quality of that
conversation without the conversation.

- **Deep discovery before any question.** The agent reads the code, the documentation, and how other
  products solve the problem, and settles what it can.
- **Questions built for thinking, not searching.** Each has its context, options with pros and cons,
  and a recommended answer.
- **A ledger of your decisions.** High-impact choices become decision files that later features must
  follow.
- **Review scales with risk.** Each spec proposes a risk tier, and the plan waits for you only if
  you ask.
- **Plain text in git, no service.** Markdown in a `specs/` folder. No Jira, no Linear. Ideas and
  proposals not started yet stay in your notes, outside git.

It is built for technical users, and for features worth a spec. For a one-line fix, just ask your
agent. It assumes a capable model with web access.

## What it looks like

The [example project](skills/uraeda/assets/example/specs/), a small todo app, took its recurring
tasks feature through the whole workflow:

1. **You write the
   [proposal](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/proposal.md)**: tasks
   that come back once completed, simple enough for "my parents".
2. **The agent investigates** in
   [discovery-01.md](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/discovery-01.md):
   how Todoist and others handle repeats, and a due-date bug across daylight saving changes.
3. **It asks you 7 questions** in
   [clarifications-01.md](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md).
   One of them, trimmed:

   ```md
   ## Q2: When does the next occurrence appear?

   - **A (recommended). Create the next occurrence as a new task when the current one is
     completed.**
     - [pro] completed tasks stay in the list as a history.
     - [con] the list grows by one task per completion.
   - **B. Create the next 4 occurrences in advance.** [...]
   - **C. Keep a single task, and move its due date, like Todoist.** [...]

   **Answer:** C, we want a simple feature.
   ```

4. **It writes the [spec](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md)**,
   with two new [decisions](skills/uraeda/assets/example/specs/decisions/), and you approve it.
5. **It writes the [plan](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/plan.md)**,
   tasks with their failing tests written out, implements it, and opens a pull request.
6. **It finishes the feature**: one
   [record](skills/uraeda/assets/example/specs/done/2026-10-06-recurring-tasks.md) replaces the
   folder, with each question and its answer.

## Getting started

Install `ura`, then the skill. [INSTALL.md](INSTALL.md) has every other way.

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/mrtolkien/uraeda/releases/latest/download/uraeda-cli-installer.sh | sh
ura install                                     # the skill, for your user
```

Without `ura`, install the skill with `npx skills add mrtolkien/uraeda`.

Then, in your repository:

1. **Set it up.** Run `ura init`, then ask your agent to "set up specs/": it writes the
   constitution, the project's principles, with you, and proposes two decisions.
2. **Write a proposal**, in your notes or in the session: what you want, and why. Ask your agent to
   start it. It makes the feature's branch and worktree, and runs until it has questions for you.
3. **Answer, then review.** Edit the files it points you to, or run `ura serve` and answer on its
   pages, from your phone over your own network. Then tell the agent to continue, or let `ura serve`
   tell your T3 Code session.

`ura next` tells an agent the next step, and `ura status` lists every feature and who it waits on.

## Learn more

- [The skill](skills/uraeda/SKILL.md) and [the example project](skills/uraeda/assets/example/specs/)
- [INSTALL.md](INSTALL.md): every way to install
- [The `ura` CLI](docs/cli.md): its commands, `ura serve`'s pages, and your notes on your phone
- [The `specs/` folder](docs/specs-folder.md): its files, features, and changes
- [CONTRIBUTING.md](CONTRIBUTING.md): building Uraeda

## Inspirations

- [superpowers](https://github.com/obra/superpowers): the flow from clarification to design to plan,
  and plans with test code. Uraeda makes it asynchronous.
- [Spec Kit](https://github.com/github/spec-kit): the file names and their formats. Uraeda adds the
  decision ledger, numbered question rounds, and risk tiers.
- [Plain Text Team](https://github.com/0atman/noboilerplate/blob/main/scripts/34-Plain-Text-Team.md):
  a team's work kept as plain text in git.

## Project status

The skill came first, then `ura`, then a web UI that ran the agents' sessions, which became a native
app over a server inside `ura`. Version 3 drops the app and the server: Uraeda is a workflow and a
small `ura`, and other people's tools run the agents and hold the notes. The last release with the
app is [v2.1.0](https://github.com/mrtolkien/uraeda/releases/tag/v2.1.0).

## License

MIT or Apache-2.0, at your option. The icons' licenses are in
[CONTRIBUTING.md](CONTRIBUTING.md#licenses).
