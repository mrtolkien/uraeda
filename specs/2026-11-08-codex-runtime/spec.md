---
status: changes-requested
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Codex runtime + model settings

> [!NOTE]
>
> Changes requested on 2026-11-08: 3 comments in spec-review.md.
>
> - You approve Codex as a second agent, sandboxed with each action outside its worktree reviewed,
>   and a model and effort picked when any session starts, kept for its whole life.
> - Changed decision, Agents: each agent is reached through its own protocol, and the network counts
>   as outside the worktree.
> - New decision, Models: a session keeps its agent, model, and effort; the agent's defaults apply
>   until you pick.
> - Your note on usage, read as: the sidebar shows every agent's windows once it reported, as Home
>   does, so Claude Code's and Codex's both show while each runs a feature.
> - The guard is a model: a hostile page that fooled both Codex and its reviewer could get one
>   command outside the worktree run, such as sending code to a website.
> - Unverified: a model outside your plan is assumed to fail at its first turn, with the agent's own
>   error; the plan's first task checks it on Codex.
> - Risk tier high, for a new agent running commands on your machine; the plan does not wait for
>   your review.

Uraeda gets a second agent, Codex, run through your installed `codex` like Claude Code is through
`claude`, so a feature can run on whichever agent fits it or still has usage left. Every session
also gets its model and effort picked where it starts, among what its agent lists, on the agent's
own defaults until you pick. The [proposal](proposal.md) asked for both; the
[discovery](discovery-01.md) found Codex's sandbox blocks commits unless escalations are reviewed,
and the [clarifications](clarifications-01.md) settled the protocol, the permissions, and the
picker.

## Decisions

- **Changed: [Agents](../decisions/agents.md)**. A runtime reaches its agent through the agent's own
  protocol, never a wrapper package, and each action outside the worktree, the network included, is
  reviewed before it runs; revisited when Codex's protocol leaves its experimental label.
- **New: [Models](../decisions/models.md)**. A session keeps the agent, model, and effort it started
  with; until you pick, the agent's own defaults apply; an effort is picked among the model's.

Relied on:

| Decision                                       | What it means for this spec                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Extensions](../decisions/extensions.md)       | Codex is a built-in extension, on the same runtime contract, which it can turn off.  |
| [Run lifecycle](../decisions/run-lifecycle.md) | Codex reports restarts, limits, and their reset, so its runs continue by themselves. |
| [Settings](../decisions/settings.md)           | Codex's one setting, its command, lives in `config.toml` like Claude Code's.         |
| [Compatibility](../decisions/compatibility.md) | The runtime contract grows without a new API version: its additions are optional.    |
| [UI components](../decisions/ui-components.md) | The picker is Astryx's menu; the header and the usage pane keep their components.    |
| [Testing](../decisions/testing.md)             | Tests reach Codex through the fake runtime, never the real agent.                    |

## User stories

### US1: Run a session on Codex (P1)

You pick Codex where a session starts, and it runs the workflow as Claude Code does: it answers,
takes your messages during its turn, stops on Stop, commits, and continues after a usage limit.

[Picked](/packages/web/src/SessionPicker.stories.tsx#Picked)

Key scenarios:

1. **Given** Claude Code and Codex installed and on, **When** you pick Codex in a new chat's
   composer and send "Summarize the inbox", **Then** the chat runs on Codex, and its header reads
   "Codex · GPT-6.1-Sol · Medium" once Codex reports its start.
2. **Given** a feature's Codex session writing its plan in the feature's worktree, **When** it runs
   `git commit`, **Then** Codex asks to escalate, its reviewer approves, and the commit lands; the
   transcript shows the command and the review's verdict.
3. **Given** a Codex turn at work, **When** you send "Also cover the empty state", **Then** the
   message joins the running turn; **When** you press Stop, **Then** the turn ends as stopped.

More scenarios:

1. **Given** a Codex run stopped by its 5-hour limit at 14:00, resetting at 16:30, **When** 16:30
   passes, **Then** the run continues by itself, and its session says why.
2. **Given** `codex` missing from the machine, **When** you pick Codex and send, **Then** the
   message is refused with "Codex is not available on this machine."
3. **Given** a Codex session sent an image, **When** it starts its turn, **Then** Codex receives the
   image by its path and can describe it.

### US2: Pick the model and effort a session runs on (P1)

Where a session starts, one button names the agent, model, and effort it will run on. It opens a
menu of the agents on here, then the agent's models, then the picked model's efforts, "Default"
first in each.

[Defaults](/packages/web/src/SessionPicker.stories.tsx#Defaults)

[Open](/packages/web/src/SessionPicker.stories.tsx#Open)

[One agent](/packages/web/src/SessionPicker.stories.tsx#OneAgent)

[No effort](/packages/web/src/SessionPicker.stories.tsx#NoEffort)

[Header](/packages/web/src/SessionPicker.stories.tsx#Header)

Key scenarios:

1. **Given** Codex configured on GPT-6.1-Sol at Medium, **When** you open a new chat, **Then** the
   button reads "Codex · GPT-6.1-Sol · Medium", and the menu marks "Default" for both, naming
   GPT-6.1-Sol and Medium under them.
2. **Given** GPT-6-Astra at High picked, **When** you send, **Then** the session runs on GPT-6-Astra
   at High, and every later run of it does too, the automatic ones and a fresh session for the build
   included.
3. **Given** a feature's session on Opus, and you want the build on Sonnet, **When** you open its
   composer, **Then** it has no picker: as you put it, "if a user wants to change model, they should
   create a new session", which starts from the feature's "New session" with the picker.

More scenarios:

1. **Given** Sonnet at Max picked, **When** you pick Haiku 4.5, which takes no effort, **Then** the
   Effort group goes, and the button reads "Claude Code · Haiku 4.5".
2. **Given** Codex at Ultra picked, **When** you pick GPT-6-Luna, which stops at Max, **Then** the
   effort goes back to Default.
3. **Given** Codex picked with GPT-6-Astra, **When** you pick Claude Code, **Then** the model and
   the effort go back to Claude Code's defaults.
4. **Given** only Claude Code on, **When** a composer starts a session, **Then** the button still
   shows, without the Agent group.

### US3: See every agent's usage (P2)

The sidebar's usage pane shows the windows of every agent that reported usage, not only the agent of
the page in view, so two features on two agents show both.

Key scenarios:

1. **Given** a feature running on Claude Code and another on Codex, both having reported, **When**
   you look at the sidebar on any page, **Then** it shows Claude Code's 5-hour and weekly windows,
   then Codex's, each with its mark.
2. **Given** only Claude Code reported so far, **When** you look at the sidebar, **Then** it shows
   Claude Code's windows alone.

More scenarios:

1. **Given** the closed rail, **When** both reported, **Then** its one bar shows the shortest window
   of the agent in view, as today.

## Replaced behaviour

- **With one runtime on, nothing shows where a session starts.** Guarded by no test: the button now
  always shows, for the model.
- **The sidebar's usage pane shows only the runtime in view.** Guarded by no test.
- **A Claude Code session runs on whatever model and effort Claude Code is configured with.**
  Guarded by `claudeArgs` in `packages/server/src/runner/__tests__/claude.test.ts`, whose arguments
  gain the picked model and effort.

## Architecture

Codex joins as a built-in extension, `codex`, beside `claude`, on the same runtime contract, through
`codex app-server`, Codex's own protocol, over your installed `codex`, as the
[Agents](../decisions/agents.md) decision asks. The contract gains a model list and a model and
effort to open with, so the picker serves any runtime that lists models, an extension's included.
See [reaching Codex](discovery-01.md#reaching-codex) and
[Codex's permissions](discovery-01.md#codexs-permissions).

- **The Codex runtime** runs one `codex app-server` per open session, in its own process group, and
  turns Codex's notifications into the agent-neutral events. It owns Codex's permissions: the
  `workspace-write` sandbox, network off, approvals on request, reviewed by Codex's auto-reviewer,
  and a sandbox section of instructions telling Codex to escalate git writes and network calls. It
  also gives Codex the web UI's instructions, Uraeda's skill and the extensions' skills as extra
  skill folders, and the extensions folder as writable. It holds queued messages itself, steers,
  interrupts, and takes back what Codex has not read.
- **Codex's limits** turn Codex's rate limits into the 5-hour and weekly usage windows, and a
  limit's refusal into the limit event the run lifecycle continues from.
- **The runtime contract** gains an optional model list, `{ models, defaults }`, a `model` and an
  `effort` to open with, and the model and effort the agent reports at its start. Optional additions
  keep the extension API at version 1, and `docs/extensions.md` documents them.
- **The Claude Code runtime** opens with `--model` and `--effort` when picked, and lists its models
  through a short `claude` process asking `list_models` and `get_settings`, which spends no usage.
  It leaves out models that would drop auto mode. It reports the model from Claude Code's start.
- **The model lists** keep each runtime's last list in the server's memory, refreshed at start, when
  a runtime registers, and when a picker opens, at most once a minute. A failed refresh keeps the
  last list. They feed the runtime records the web UI reads.
- **What a new session runs on** is one rule, on the server: the agent picked, else the first on;
  the model and effort picked, else none, the agent's defaults. It refuses a model its agent's list
  does not hold, or an effort the model does not take. A fresh session of a feature copies its
  latest session's agent, model, and effort.
- **The session cache** stores each session's picked model and effort and the ones last reported,
  and takes Codex's thread ID from its first start rather than reading it as a cleared session. See
  the [data model](data-model.md).
- **The session picker** replaces the runtime picker in every place a session starts: a new chat's
  composer, a feature's new session, a change's start dialog, "Apply the answers", and the chats the
  inbox and decisions pages start.
- **The session header** names the model and effort that ran after the agent's name.
- **The usage pane** lists every runtime that reported windows, as Home's does, in the runtimes'
  order.
- **The fake runtime** lists two models with efforts, so tests, Storybook, and the sandbox cover the
  picker without a real agent.

Tradeoffs:

- Codex's protocol is experimental: a Codex update can break its runtime until the runtime follows.
- Each review of an escalation takes about 4 seconds and a little of Codex's usage.
- Another model means another session, which forgets the conversation.
- Codex still reads your own `~/.codex` configuration, `AGENTS.md`, and hooks, as Claude Code reads
  yours.

## Edge cases

| Importance | Situation                                                                    | What happens                                                                                          |
| ---------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| High       | Codex runs `git commit` without escalating, and the read-only `.git` refuses | The step's run ends before its gate, and the run lifecycle asks it once to continue to the gate       |
| High       | A picked model outside your plan                                             | The first turn fails with the agent's own error as its reason; a new session on another model goes on |
| High       | Codex's sandbox cannot start, as on a system without user namespaces         | Commands fail with Codex's error in the transcript; the runtime never falls back to full access       |
| Normal     | The picked model left the agent's list between opening the picker and Send   | The send is refused with "Codex has no model gpt-6-astra: pick another", and the text stays           |
| Normal     | A model was retired after a session started on it                            | The session's next turn fails with the agent's error; its transcript stays                            |
| Normal     | Codex installed but signed out                                               | The turn fails with Codex's own sign-in error                                                         |
| Normal     | Codex's thread file was deleted                                              | The session starts a new thread, with the line a replaced Claude Code session shows                   |
| Normal     | The model list cannot be read, the agent being down or too slow              | The picker keeps the last list; with none yet, it offers only "Default"                               |
| Niche      | Ultra effort, which runs Codex's sub-agents                                  | Their work shows as tool calls of the session                                                         |
| Niche      | Your own `~/.agents/skills/uraeda` beside Uraeda's copy                      | Codex lists both; the run goes on whichever Codex reads                                               |

## Success criteria

- **SC-001** (step to commit): A feature step on Codex runs from its message to its commit with no
  action from you, in the sandbox with the network off.
- **SC-002** (choice kept): A session's model and effort hold on every later run, automatic ones and
  a fresh build session included.
- **SC-003** (agent's list): The picker offers exactly the models the agent listed, hidden ones left
  out, and only the picked model's efforts.
- **SC-004** (no wait): The picker opens with the last list at once; a refresh never delays the
  composer.
- **SC-005** (what ran): A session's header names the model and effort its agent reported at its
  latest start.
- **SC-006** (both windows): Once Claude Code and Codex both reported, the sidebar shows both
  agents' windows on every page.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Your
note changed one: Codex's usage windows show beside Claude Code's in the sidebar, not only on its
own pages. Settled while writing this spec:

- **The button names what will run**, defaults resolved, "Codex · GPT-6.1-Sol · Medium"; the menu
  says "Default" and what it resolves to, so a default is never mistaken for a pick. See
  [what they have in common](discovery-01.md#what-they-have-in-common).
- **"Default" is the agent's configured choice**, read from Codex's configuration and Claude Code's
  settings, not the catalogue's default: your `config.toml` says GPT-6.1-Sol at Medium, while
  Codex's catalogue marks Low. See [Codex app-server](discovery-01.md#codex-app-server).
- **The picker's menu stays open while you pick**, so the agent, model, and effort are chosen in one
  opening; Escape or a click outside closes it.
- **The agent's names are used**: Codex's own model names and descriptions, and Claude Code's;
  effort levels read Low, Medium, High, Extra high, Max, Ultra.
- **The feature's start dialog keeps no picker**: its hand-over composer picks, as today.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**High**: a new agent runs commands on your machine, under a permission model of its own.
