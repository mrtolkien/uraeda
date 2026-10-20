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
of that conversation without the conversation. The agent does the research first and asks everything
at once in a file. You answer in a few words when you have time.

- **Deep discovery before any question.** The agent reads the code, the documentation, and how other
  products solve the problem, before asking you anything. What it can settle itself, it settles, and
  lists for you to check.
- **Questions built for thinking, not searching.** Each one is self-contained: context with sources,
  options with pros and cons, a recommended answer with its reason. Every file waiting for you opens
  with what is asked, an honest time estimate, and what needs your attention.
- **A ledger of your decisions.** High-impact choices, like how dates are stored, become short
  decision files that every later feature must follow. An agent cannot work around one: a feature
  that needs to change it edits it on its own branch, and lists it in its spec. The change takes
  effect when you approve the spec, and you see it marked in place.
- **Review scales with risk.** The agent proposes a risk tier in each spec, with its reason. By
  default, the plan does not wait for your review, whatever the tier: when you approve the spec, you
  can turn plan review on. When the plan does not wait for you, the approved spec goes to a pull
  request without you.
- **Plain text in git, no service.** Markdown in a `specs/` folder, readable on GitHub or in
  Obsidian, with each file's state in its frontmatter. No Jira, no Linear.

It is built for technical users, who read code and designs.

## How you use it today

You run each step yourself: open your coding agent in the repository, and say "continue recurring
tasks", "I answered the questions", or "what is next?". The agent reads the `specs/` folder, finds
the next step from the files alone, does it, commits, and stops when it needs you. You answer or
approve by editing the file, by telling the agent, or with `ura answer` and `ura review`, and run it
again later.

Or hand it over from the web UI: "Commit and start the agent" commits your answers or your approval.
It then opens the feature's session with the workflow's message ready to send. You read it, add a
note, and send it. Claude Code works on the next step until it needs you again, while you watch,
write to it, or stop it. A runner that starts the agent when you push an answer is planned: see
[the project status](#project-status). The skill follows the
[Agent Skills format](https://agentskills.io/specification).

**A good fit** for features worth a spec. Getting the design wrong is costly there, and you would
rather answer ten precise questions than review a guess. **Not a fit** for a one-line fix: just ask
your agent. It assumes a capable model with web access: a discovery round reads a lot, and takes
time and tokens.

## What it looks like

The [example project](skills/uraeda/assets/example/specs/) is a small todo app. The recurring tasks
feature went through the whole workflow:

1. **You write the
   [proposal](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/proposal.md)**: a few
   lines. Tasks that come back once completed, two clicks to set, simple enough for "my parents".
2. **The agent investigates**, and writes
   [discovery-01.md](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/discovery-01.md):
   how Microsoft To Do, Todoist, and Google Calendar handle repeats, the iCalendar standard, and a
   problem in the app's code. Due dates stored as timestamps drift by a day across daylight saving
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
   what you approve first, then two new decisions,
   [due dates](skills/uraeda/assets/example/specs/decisions/due-dates.md) and
   [repeating tasks](skills/uraeda/assets/example/specs/decisions/repeating-tasks.md), the user
   stories with their key scenarios, and the architecture. The build details go to the plan. You
   approve it, and the decisions become active.
5. **It writes the [plan](skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/plan.md)**,
   in the style of superpowers: tasks with the files they touch, their interfaces, and their failing
   tests written out. The spec's risk tier is high, since every saved due date is upgraded. So it
   proposed that you review the plan too, and you kept that when approving it.
6. **It implements the plan, building independent tasks at the same time, and opens a pull
   request**, where you review the code. When you want, one message sends it to your comments: it
   fixes each in a commit, and the pull request waits for you again.
7. **It finishes the feature** in the pull request's last commit. One
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

## The `specs/` folder

```sh
specs/
  README.md                    # the folder layout, for any agent or human
  CONSTITUTION.md              # the project's principles, by priority, written with you at setup
  PRIORITIES.md                # Now, Next, Later, Blocked
  INBOX.md                     # notes jotted down, waiting to be organized
  drafts/                      # upcoming features, free form: one becomes a dated folder when you
                               # say "start it"
  backlog/                     # nice-to-have features, not scheduled
                               # a postponed feature keeps its folder here, without its date
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

Each feature lives on a branch named after its folder. You answer and approve on that branch. A
single pull request merges everything at once: the decisions, the code, and the feature's record.
The record replaces its folder in the branch's last commit, while git keeps the folder's history.
When your answers raise new questions, a second round follows, `discovery-02.md` and
`clarifications-02.md`, and so on.

Bug fixes and small changes take a lighter flow, a change. You type the request under "New change"
in the web UI, and its agent works in its own branch and worktree. It investigates and asks only
what you must decide. It makes the change with tests that fail first, has a fresh reviewer check it,
and opens a pull request. There is no spec and no plan, and often nothing to answer before the
review. A change that turns out too big is offered to you as a feature.

Small things you notice while working, a misaligned icon or a confusing command, go in the inbox,
`specs/INBOX.md`, in a few seconds. Use the web UI's ＋, or `ura note`, which agents use too. You
organize the notes later into priorities, drafts, or changes, by hand or by answering an agent's
proposed triage.

To start in a project, run `ura init`, or ask the agent to "set up specs/". Either creates the
folder, and the agent drafts the constitution with you. `ura init` also offers to install the skill
for your user, when your agents have none.

The workflow itself is in the [Uraeda skill](skills/uraeda/SKILL.md), with one
[reference](skills/uraeda/references/) per step, one for its conventions, and
[templates](skills/uraeda/assets/templates/specs/) for every file.

## Install

`ura` runs on Linux and macOS, on x64 and arm64. From a release:

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/mrtolkien/uraeda/releases/latest/download/uraeda-cli-installer.sh | sh
brew install mrtolkien/tap/ura                     # or with Homebrew
nix run github:mrtolkien/uraeda -- --version       # or with Nix, built from source
```

Then `ura install` installs the skill for your user, so every repository on your machine has it. It
can also install it for one repository, into the folders your agents read: `.agents/skills`,
`.claude/skills`, or both. In a repository, `ura init` sets up `specs/` and offers to install the
skill for your user. Without `ura`, install the skill for any agent with
`npx skills add mrtolkien/uraeda`. `ura upgrade` installs the latest release, through the installer
script or Homebrew, then updates your skill; with Nix, update the flake input.

Tab completes `ura`'s commands, flags, and values in fish and zsh: drafts after `ura start`, the
features and changes under way after `ura next`, and the open questions after `ura answer`. Homebrew
and the Nix package install its scripts, which a fish or zsh from the same package manager finds
without setup; another zsh needs their folder on its `fpath`, as Homebrew's
[shell completion](https://docs.brew.sh/Shell-Completion) page says, or the line below. Otherwise,
in fish, `ura install` offers to set it up, and `ura install --completions` does it alone. In zsh,
add one line to `~/.zshrc`, after `compinit`. Either way, the shell asks `ura` itself at each Tab,
so completion follows every upgrade:

```sh
echo 'COMPLETE=fish ura | source' > ~/.config/fish/completions/ura.fish  # fish, by hand
echo 'source <(COMPLETE=zsh ura)' >> ~/.zshrc                            # zsh
```

The web UI comes from npm. In a repository, run `npx @uraeda/ui`: it starts the server on
http://127.0.0.1:4310 and opens the repository in your browser. It needs Node 24 or later, and
sessions need `claude` installed and signed in. Run `npx @uraeda/ui` in another repository and it
opens in the server already running.

```sh
npx @uraeda/ui                          # the web UI, for the repository you are in
npx @uraeda/ui --no-open --port 4311    # without opening the browser, on another port
npx @uraeda/ui --allowed-hosts mac.tail1234.ts.net  # host names for this run, over the settings
npx @uraeda/ui --new-key                # a new access key, which signs every device out
npm i -g @uraeda/ui@latest              # a lasting install, then `uraeda`; updated the same way
```

Every browser signs in. The first start shows an access key, once, in the terminal: keep it in a
password manager. The browser it opens is signed in already, and so is the one a second start opens
on the same machine. Any other browser, like your phone's, pastes the key once and stays signed in
while it is used at least every 30 days. "Sign out" and "Sign out everywhere…" are in Settings,
under Sign-in. A lost key is replaced with `uraeda --new-key` on the machine that runs Uraeda, which
signs every device out.

Settings, at the bottom of the sidebar, shows and changes the server's settings, and holds the
theme, kept on each browser, and signing out. The server's settings are kept in
`~/.config/uraeda/config.toml`, a file you can also edit by hand and keep in your dotfiles. It is in
`$XDG_CONFIG_HOME/uraeda/` when `XDG_CONFIG_HOME` is set, or in `URAEDA_CONFIG_DIR` when that is.
The page keeps the file's comments. Its `[server]` table holds:

```toml
[server]
allowed_hosts = ["mac.tail1234.ts.net"]  # host names accepted besides 127.0.0.1 and localhost
port = 4310                              # the server's port
open_browser = true                      # whether a start opens the browser
```

A host name added or removed applies to the next request; the port and the browser, at the next
start. Each value comes from its flag, `--allowed-hosts`, `--port`, or `--no-open`, else its
environment variable, `URAEDA_ALLOWED_HOSTS` or `URAEDA_PORT`, else the file, else its default. A
flag or a variable holds for one run, is never written into the file, and the page says which one is
in force. A file that cannot be read is never overwritten: the server says why and uses its defaults
until it is fixed.

To reach Uraeda from a public address, put a proxy that ends TLS on the same machine, like Caddy or
Tailscale Funnel. Add its host name in Settings, or give it to `--allowed-hosts`. With Caddy, the
whole configuration is `uraeda.example.com { reverse_proxy 127.0.0.1:4310 }`. The server itself
listens on 127.0.0.1 only.

In a repository whose `package.json` asks for another package manager in `devEngines`, npm refuses
to run `npx`, with `EBADDEVENGINES`. In a pnpm project, run `pnpm dlx @uraeda/ui`; anywhere, install
it once with `npm i -g @uraeda/ui@latest` and run `uraeda`.

`uraeda --help` lists every option.

## The `ura` CLI

`ura` performs the mechanical parts of the workflow, for you and for agents. It is optional: the
skill says how to do each step by hand, and names the command that does it.

```sh
ura init                                   # specs/, and the skill offered for your user
ura install --user --agents --claude       # the skill, for your agents and Claude Code
ura status                                 # every feature and change, and who it waits on
ura next                                   # the next step for an agent, from the skill's table
ura check                                  # every workflow file against the skill's rules
ura add                                    # this repository, to the web UI's list
ura draft "listener"                       # a line of PRIORITIES.md becomes a draft
ura start git-listener-process             # a draft becomes a started feature; --change, a change
ura note "Blurry icons" --category UI      # a note in the inbox, committed on the default branch
ura answer cli-core Q3 "B, simpler"        # one answer; --submit sends the round
ura review cli-core --comment 50-52 "Why?" # a comment; --approve or --request-changes
```

Every command works without a terminal, and the read commands print JSON with `--json`.

## Editors

`ura lsp` is a language server for workflow files. It offers diagnostics as you type, completion of
frontmatter values, and the human's actions, from commenting on a spec to approving it.

- **Neovim**: [uraeda.nvim](editors/nvim/README.md), in `editors/nvim/`, with keys under `<leader>a`
  to draft, start, comment, approve, answer, and commit.

## Inspirations

- [superpowers](https://github.com/obra/superpowers): the flow from clarification to design to plan,
  and plans with test code in every task. Uraeda makes it asynchronous.
- [Spec Kit](https://github.com/github/spec-kit): the file names and their formats: constitution,
  spec, plan, user stories, success criteria. Uraeda adds the decision ledger, numbered question
  rounds, and risk tiers.
- [Plain Text Team](https://github.com/0atman/noboilerplate/blob/main/scripts/34-Plain-Text-Team.md):
  a team's work kept as plain text in git, instead of in a project management tool.

## Building the tools

The tools are a Rust core, the `ura` CLI, and a web UI served with its server. The web UI shows
every feature and file with its structure. It performs every human step, answering, reviewing,
drafting, and jotting down priorities. It also holds your sessions with the agent, from a phone too.
With Rust, Node 24, and pnpm, or in `nix develop`, where `pnpm install` stands for `vp install` and
the layout tests find their WebKit browser:

```sh
vp install         # dependencies
vp run --filter uraeda-binding build  # the Rust core for Node, which vp dev and the tests rebuild when older
vp run ready       # every check and test; CI also runs the Neovim tests
vp dev             # the web UI on http://127.0.0.1:4310, opening this repository first
vp run dev         # the same, rebuilding the Rust core and restarting as it or the server changes
vp run --filter @uraeda/ui build  # the npm package, in packages/uraeda, after the web UI's build
vp run release 0.5.0  # on an up-to-date main: notes in CHANGELOG.md, version, tag, push
cargo run -p uraeda-cli -- status
```

One server serves every repository in Uraeda's list, kept in your data folder. The menu at the top
left of the web UI switches between them, adds one by its folder, and removes one. `ura add` adds
the repository of the folder you are in. Each repository's pages are under `/r/<name>/`.

`vp dev` and `vp run dev` read `.env` at the root, from [`.env.example`](.env.example):
`URAEDA_REPO` names the repository opened first, and adds it to the list. `URAEDA_PORT` changes the
port. `URAEDA_ALLOWED_HOSTS` lists the host names it accepts besides 127.0.0.1, like your machine's
full name on your tailnet, `mac.tail1234.ts.net`. Vite checks host names and takes its port before
the settings file is read, so under `vp dev`, they come from these variables only. The server
listens on 127.0.0.1 only. `tailscale serve --bg 4310` reaches it from your phone, at
`https://mac.tail1234.ts.net/`. The npm package reads no `.env`: its settings come from its flags,
its environment, and your settings file.

Sessions need `claude` installed and signed in on the machine. Each feature has one session, in its
worktree, where the workflow's runs and your chat follow each other. "New chat" opens one without a
feature, in the main checkout. The buttons that hand a feature over, like "Commit and start the
agent" and "Approve and start the agent", commit. They then open its session with the workflow's
message in the composer. Nothing goes until you send it. A message sent while the agent works is
steered into its turn. Stop ends the turn and keeps the session. The sidebar shows every session
with what needs you, what works, and each new reply. Claude Code runs in `auto` permission mode,
with your own settings, and with the server's copy of the skill as a plugin: see the
[agents](specs/decisions/agents.md) decision. Without `claude`, the pages only commit. Sessions are
kept in `runner.sqlite`, in `URAEDA_DATA_DIR` or your system's data folder, `~/.local/share/uraeda/`
on Linux. There, a running server keeps the files that only live while it runs, like its host token
and its Storybooks' records, in `run/`. When Claude Code changes and sessions break,
`vp run validate:claude` checks the integration against the installed `claude`, with a few short
sessions.

The code is under the MIT or Apache-2.0 licenses, at your option.

## Project status

What is being built now, and next, is in [specs/PRIORITIES.md](specs/PRIORITIES.md). The order is
the skill first. Then come a CLI and a web UI to view and edit the workflow files. Sessions with
Claude Code in the web UI follow, then a git listener that starts it when you commit an answer.
