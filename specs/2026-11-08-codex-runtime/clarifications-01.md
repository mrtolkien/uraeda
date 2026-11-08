---
status: answered
---

# Clarifications, round 01: Codex runtime + model settings

> [!NOTE]
>
> Answered on 2026-11-08.
>
> - Verdict: worth building, with changes: Codex's default sandbox cannot commit in a feature's
>   worktree. Codex needs explicit permissions, and the proposal leaves effort and defaults open.
> - Two choices change the Agents decision: how much a Codex session may do without you, and the
>   experimental protocol Uraeda reaches Codex through.
> - The model questions work together: which agents take a model, the effort beside it, the default,
>   and changes during a session.
> - Run options, next in Now, plans models per step: these answers set the base it builds on.
> - Check the runtime's own instructions to Codex, which the Extensions decision could be read to
>   forbid.

## Context

### Goal

The [proposal](proposal.md) asks to run sessions on Codex instead of Claude Code. It also asks to
pick a session's model when it starts: "pick the harness, pick the model". It is for your own use
first, with more harnesses to come.

### Today

Uraeda already runs several runtimes: each one is an extension, and a picker appears once two are on
([`RuntimePicker.tsx`](/packages/web/src/RuntimePicker.tsx)). Claude Code is the only real one
([`claude.ts`](/packages/server/src/runner/claude.ts)), and Codex already has its mark. No session
has a model or an effort: each agent runs on its own configured default.

Codex is reached through `codex app-server`, the protocol OpenAI's IDE extension uses. Tests with
Codex 0.163.0 on this machine confirmed it lists models and efforts, and switches model on resume.
It also steers a turn, and reports 5-hour and weekly limits.

| Product                 | Harness picked          | Model changes mid-session | Effort control | Model list |
| ----------------------- | ----------------------- | ------------------------- | -------------- | ---------- |
| Conductor               | per tab, from composer  | not documented            | separate       | from agent |
| T3 Code                 | per thread              | yes                       | separate       | from agent |
| JetBrains Air           | per task                | yes                       | not documented | from agent |
| VS Code (Claude, Codex) | before the first prompt | yes                       | not documented | from agent |
| Vibe Kanban             | per attempt             | no                        | separate       | hardcoded  |

### Scope

Codex as a built-in runtime, and a model and effort picked for each session, on the runtimes that
offer them. Models and efforts per workflow step, and defaults per feature, are left to
[Run options](../proposals/run-options.md).

### Sources

- The runner, the runtime contract, the picker, and the session cache, linked in the discovery.
- Codex's app-server, sandbox, models, and skills documentation; Claude Code's model configuration
  and Agent SDK reference.
- Conductor, T3 Code, Vibe Kanban, JetBrains Air, VS Code, Sculptor, Nimbalyst, Zed, and the agents'
  own pickers.
- Experiments with the local `codex app-server` and `claude`, outside the repository.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **The runtime's instructions to Codex** tell it that `.git` is read-only and the network is off,
  and to escalate git writes and network calls. Without them, Codex never commits in a worktree. The
  [Extensions](../decisions/extensions.md) decision forbids extensions adding instructions to runs,
  to keep the workflow in the skill. These describe the sandbox, not the workflow. Claude's runtime
  already appends the web UI's instructions. See
  [discovery](discovery-01.md#worth-it-and-feasibility).
- **Automatic runs keep the model and effort** of the session they run in. A fresh session for the
  build takes them from the session before it. Products that dropped the model on scheduled or
  delegated runs drew complaints. See [discovery](discovery-01.md#t3-code).
- **"Allow and retry" is not offered on Codex**: a blocked action shows in the transcript, and you
  ask again in words. Codex's method to approve a denied action is marked unstable. See
  [discovery](discovery-01.md#codex-sandbox-and-approvals).
- **Two Uraeda skills**: Codex gets Uraeda's skill from the server, beside the copy you installed in
  `~/.agents/skills`, and lists both under the same name. Which one Codex reads is not documented.
  See [discovery](discovery-01.md#worth-it-and-feasibility).
- **Claude Code lists only models that keep auto mode**. With another model, Claude Code would ask
  before actions, which an unattended run cannot answer. See
  [discovery](discovery-01.md#claude-codes-model-and-effort).

## Q1: How much may a Codex session do without you?

Example: the plan step of a feature ends with `git commit`, then the pull request step runs
`git push` and `gh pr create`.

Codex runs commands in a sandbox. Its usual mode, `workspace-write`, keeps every `.git` folder
read-only and the network off. A test in a worktree failed to commit, and Codex stopped without
asking. With instructions to escalate, the commit and a `curl` call went to Codex's auto-reviewer, a
model that judges each request's risk. It approved both in about 4 seconds. Your own Codex setting
is full access without approvals. The [Agents](../decisions/agents.md) decision says an agent "MUST
run with the least permission that still lets unattended steps finish, never with its permissions
skipped". More in [discovery](discovery-01.md#codexs-permissions).

Why it matters: this becomes the rule for every Codex run, and how much a hostile web page or file
could make Codex do.

- **A (recommended). Run Codex in its `workspace-write` sandbox, network off, with every escalation
  reviewed by its auto-reviewer, and instructions to escalate git writes and network calls.**
  - Example: the commit, the push, and `gh pr create` each wait about 4 seconds for a review, then
    run.
  - [pro] every action outside the worktree is judged first, like Claude Code's auto mode.
  - [con] each review spends a little usage, and a run fails if Codex forgets to escalate.
  - Why recommended: it is the least permission that tests showed finishing a step.
- **B. The same, with the network on in the sandbox.**
  - Example: the push and `gh pr create` run at once; only the commit waits for a review.
  - [pro] fewer reviews, faster installs and pushes.
  - [con] a web page or file Codex reads could make it send the project's code to any website,
    unreviewed.
- **C. Full access without approvals, as your own Codex configuration runs.**
  - Example: everything runs at once, with no review.
  - [pro] nothing ever fails for permissions.
  - [con] a hostile text could make Codex delete any file on the machine or read your credentials;
    it breaks the Agents decision, which would need changing.

**Answer:** A

## Q2: How should Uraeda talk to Codex?

`codex app-server` is the protocol OpenAI built for "rich clients", such as its VS Code extension.
It is labelled experimental, and some methods changed during 2026. `codex exec --json` is stable,
but runs one prompt per process: no message during a turn, and no model list. The `codex-acp`
package wraps app-server in the Agent Client Protocol, a standard several editors speak. It adds an
npm dependency and hides the limits and skills. More in [discovery](discovery-01.md#reaching-codex).

Why it matters: this answer goes into the Agents decision, which expects a revisit for such a
protocol. A protocol change in Codex can break the runtime.

- **A (recommended). Through `codex app-server`, Codex's own protocol, over the user's installed
  `codex`.**
  - [pro] steering, stopping, models, efforts, limits, and skills all work, as tested.
  - [con] experimental: a Codex update can break the runtime, as a Claude Code update can today.
  - Why recommended: it is the only route that does everything a session needs.
- **B. Through `codex exec --json`, one process per message.**
  - [pro] a stable command and output.
  - [con] no steering or stop during a turn, no model list, no limits.
- **C. Through the `codex-acp` adapter, an npm package over app-server.**
  - [pro] a standard protocol, reusable for other ACP agents later.
  - [con] a new dependency between Uraeda and Codex, and no limits or skill listing.

**Answer:** A

## Q3: Which agents get a model picker?

The proposal says "select the model to use with Codex", then "pick the harness, pick the model" for
any session. Claude Code takes a model and lists its own models as readily as Codex. Through the
runtime contract, any runtime that lists models would offer them, a later pi-durable one too. More
in [discovery](discovery-01.md#model-for-codex-only-or-for-every-runtime).

Why it matters: it decides whether the runtime contract gains a model list for every runtime, or
Codex gets a control of its own.

- **A (recommended). Every runtime that lists its models, Claude Code and Codex now.**
  - [pro] one picker that works the same on each agent.
  - [con] Claude Code's runtime changes too, and its tests.
  - Why recommended: it is the same work once, and Claude Code is the runtime you use most.
- **B. Codex only.**
  - [pro] Claude Code's runtime stays as it is.
  - [con] the picker behaves differently from one agent to the other.

**Answer:** A

## Q4: Should you also pick the reasoning effort?

Example: Codex's GPT-6.1-Sol takes Low, Medium, High, Extra High, Max, and Ultra; Ultra runs
sub-agents. Claude Code's Opus takes Low to Max.

Both agents treat effort, how long the model thinks, as a second control beside the model. Its
levels differ per model, and each model has its own default. Every comparable product with an effort
shows it as its own control. More in [discovery](discovery-01.md#effort-is-not-mentioned).

Why it matters: effort changes cost and quality as much as the model does, and Run options will want
it per step.

- **A (recommended). Pick the effort beside the model, among the levels that model takes, its own
  default first.**
  - Example: picking GPT-6.1-Sol offers its 6 levels, Low first, as Codex marks Low its default.
  - [pro] full control over cost and depth, per session.
  - [con] one more control in the start of a session.
  - Why recommended: it is the agents' own model, and Run options needs it anyway.
- **B. No effort control: each agent uses the effort in its own configuration.**
  - Example: Codex runs at Medium, as your `config.toml` says, whatever the model.
  - [pro] a simpler picker.
  - [con] a model whose levels differ from your setting runs on its nearest level, unseen.

**Answer:** A

## Q5: What is picked before you choose?

Example: you open a new chat on Codex. Your `config.toml` says GPT-6.1-Sol at Medium; yesterday you
picked GPT-6-Astra at High.

Comparable products either start from the agent's own default or remember the last pick. Users
complain when a hidden or stale default wins silently, or when "Default" names a model that is not
the default. The [Settings](../decisions/settings.md) decision puts any setting in Uraeda's one
settings file. [Run options](../proposals/run-options.md) plans global defaults with per-feature
overrides. More in [discovery](discovery-01.md#the-default-model).

Why it matters: it decides how often you touch the picker, and whether this feature adds settings
that Run options would then reshape.

- **A (recommended). "Default", the agent's own choice, every time, showing what it resolves to.**
  - Example: the picker reads "Default · GPT-6.1-Sol" and the effort "Default · Medium".
  - [pro] nothing hidden: the agent's configuration stays the one source of defaults.
  - [con] a model you prefer over your configured one takes a pick each time.
  - Why recommended: Run options brings Uraeda's own defaults, so this stays the simple base.
- **B. The last pick, per agent, remembered in this browser.**
  - Example: the picker opens on GPT-6-Astra at High.
  - [pro] one pick lasts until you change it.
  - [con] a stale pick runs silently, and each device remembers its own.
- **C. A default model and effort per agent, in the settings file and the Settings page.**
  - Example: the picker opens on what Settings says, GPT-6.1-Sol at High.
  - [pro] the same default on every device, in your dotfiles.
  - [con] settings that Run options will reshape soon.

**Answer:** A

## Q6: Can the model change during a session?

Example: a feature's session wrote its spec on Opus at High; the plan is approved, and you want the
build on Sonnet.

Both agents switch between turns: Claude Code by a control message, Codex on its next turn. Claude
Code then loses its prompt cache, so the next turn reads the whole context again. Codex warns that a
switch "may affect performance". Most products allow it; the agent itself never changes. More in
[discovery](discovery-01.md#changing-the-model-during-a-session).

Why it matters: it decides whether the picker stays in a running session's composer, or only shows
where a session starts.

- **A (recommended). Yes, from the composer's picker, from the next turn on.**
  - Example: you pick Sonnet in the session's composer; the next turn, and the build after it, run
    on Sonnet.
  - [pro] the model fits each step without a new session.
  - [con] the turn after a switch costs more, as the cache restarts.
  - Why recommended: the workflow keeps one session per feature, so a fixed model would freeze it
    for every step.
- **B. No: the model is fixed when the session starts.**
  - Example: the build runs on Opus, unless you start a new session on Sonnet.
  - [pro] a session's model never changes under you.
  - [con] another model means another session, which forgets the conversation.

**Answer:** B: If a user wants to change model, they should create a new session

## Q7: What should the picker look like?

Today a selector names the agent, in the composer, only once two agents are on. Air, Conductor, and
VS Code group agent and model in one menu. Sculptor and the agents' own pickers put effort beside
the model. With one agent on, both shapes still show the model. The picker's look follows
[UI components](../decisions/ui-components.md), Astryx first. More in
[discovery](discovery-01.md#the-pickers-shape).

Why it matters: the picker sits in every composer that starts a session, and on the phone.

- **A (recommended). One button showing "Codex · GPT-6.1-Sol · High", opening a menu: the agent,
  then its models, then the efforts.**
  - [pro] one compact control, which fits a phone's composer.
  - [con] two steps to change only the effort.
  - Why recommended: it keeps the composer as light as today's single selector.
- **B. Separate selectors side by side: agent, model, effort.**
  - [pro] each value changes in one step.
  - [con] three controls in the composer, which wrap on a phone.

**Answer:** A

## Settled without the human

### Behaviour

- **The session header shows the model and effort that ran**, as the agent reports them, beside the
  agent's mark. A picker that disagrees with what ran is the most common complaint. See
  [discovery](discovery-01.md#what-they-have-in-common).
- **The model list comes from each agent**, for your account, refreshed when the server starts and
  when a picker opens. Codex's hidden models are left out, as Codex's own picker leaves them. See
  [discovery](discovery-01.md#codex-app-server).
- **The agent stays fixed for a session**: another agent means another session, as in every compared
  product. See [discovery](discovery-01.md#needs-no-choice).
- **Codex's usage windows and limits** show in the sidebar as Claude Code's do. A run stopped by a
  5-hour limit continues once it resets, as the run lifecycle asks. See
  [discovery](discovery-01.md#codex-app-server).
- **Images** go to Codex as local image inputs: every Codex model takes them. See
  [discovery](discovery-01.md#codex-models-and-terms).
- **Codex's sub-agents** show as tool calls, until their notifications are stable. See
  [discovery](discovery-01.md#needs-no-choice).
- **A message sent during a Codex turn** joins it by steering, or waits in Uraeda's queue, where it
  can be taken back. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

### Under the hood

- **One `codex app-server` per session**, in a process group of its own, as Claude Code's process
  is. See [discovery](discovery-01.md#needs-no-choice).
- **Codex picks the thread ID**: the runner stores it from the first `init`, instead of reading a
  new ID as `/clear`. See [discovery](discovery-01.md#important-reads).
- **The runtime contract gains a model list, and a model and effort to open with**, documented in
  `docs/extensions.md`. The fake runtime gets a list for tests and the sandbox. See
  [discovery](discovery-01.md#likely-changes).
- **Model and effort go through the typed fields**, never Codex's free-form `config` overrides,
  which hang a turn in an open Codex issue. See [discovery](discovery-01.md#codex-app-server).
- **Resume asks for no turns**, `excludeTurns`, as a full history can reach tens of megabytes on one
  line. See [discovery](discovery-01.md#codex-app-server).

**Notes:**

- **Codex's usage windows and limits**: If both Codex and Claude are running on two different
  features, both should show
