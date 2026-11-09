---
status: approved
revision: 2
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Run options

> [!NOTE]
>
> Approved on 2026-11-09.
>
> - You approve a diagram of the six steps, in the settings, every start dialog, and now the feature
>   page. Each step gets its agent, model, effort, and session, with implementers and reviewers of
>   your choice. Uraeda runs every sub-agent itself, and keeps a feature's choices on your machine.
> - Since your review: the run map replaces the feature page's timeline. Each tile carries its
>   stage's time, files, and the build's tasks; your gates show on the joints.
> - Since your review: a joint's line and its scissors or lock sit on one axis, on every width.
> - Since your review, from your message: sub-agents are sub-sessions. The Sub-agents pane shows
>   each one's info and opens its page, read only, and the feature page nests them under their
>   parent.
> - Unchanged: the decisions, the sub-agent tool and its relaxed guard, and the risk tier `high`,
>   without a plan review.

Every workflow step gets its own agent, model, effort, and session, set in the settings and changed
per feature where it starts. The build's implementers and the reviewers get theirs too, through a
sub-agent tool Uraeda serves to Claude Code and Codex. Reviewers are agents, using their own review
feature, or commands. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Your review

- **C1** (the line centred on the scissors): done. A joint's line, its scissors, and its lock share
  one axis in the row, the phone's column, and the start dialogs' strip.
- **C2** (the run map on the feature page): done. It replaces the timeline, as
  [a feature's own options](#us5-a-features-own-options-p2) shows.

## Decisions

- **New: [Run options](../decisions/run-options.md)**. A run ends with its step and Uraeda starts
  the next; steps share a session where you joined them; sub-agents are sessions Uraeda starts; a
  feature's options stay out of the repository.
- **Changed: [Models](../decisions/models.md)**. A new session starts on its step's or role's pick,
  and a session's effort may follow the next step it runs.
- **Changed: [Agents](../decisions/agents.md)**. A sub-agent's session may run in its task's
  worktree, beside its parent's session.

Relied on:

| Decision                                       | What it means for this spec                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| [Settings](../decisions/settings.md)           | the defaults are tables of `config.toml`, written keeping your comments      |
| [Run lifecycle](../decisions/run-lifecycle.md) | a step's next run is no automatic continue: it counts nothing toward the cap |
| [Keyboard](../decisions/keyboard.md)           | the diagram's keys are in the registry, listed by the key map                |
| [UI components](../decisions/ui-components.md) | the diagram reuses the key picker and the agent marks                        |
| [Preview](../decisions/preview.md)             | the mockups are stories of the real components                               |

## User stories

### US1: Set how each step runs (P1)

In the settings' Runs section, a diagram shows the six steps in a row, Discovery, Spec, Plan, Build,
Review, and Comments. Each tile shows its agent's mark, its model, and its effort as a 5-cell meter.
Between two tiles, a line means the steps share a session; scissors mean a clean session starts.
Bands under the tiles name the sessions.

[Defaults](/packages/web/src/runs/RunMap.stories.tsx#SettingsDefaults)

[Your own choices](/packages/web/src/runs/RunMap.stories.tsx#SettingsCustom)

[Picking a step](/packages/web/src/runs/RunMap.stories.tsx#StepPicking)

[A joint selected](/packages/web/src/runs/RunMap.stories.tsx#JointSelected)

[A forced cut](/packages/web/src/runs/RunMap.stories.tsx#ForcedCut)

The keys, shown under the diagram: ← → (or h l) move along tiles and joints, ↓ ↑ (or j k) go to the
implementers or reviewers and back. Enter on a tile opens the key picker, agent and model, then
effort. Enter or Space on a joint cuts or joins it. `r` puts the selection back to its default.
Every one of these is also a tap.

Key scenarios:

1. **Given** the defaults, **When** you open Settings, Runs, **Then** Discovery and Spec share
   session 1, scissors stand before Plan, and Plan to Comments share session 2, every tile reading
   "Default".
2. **Given** the Spec tile selected, **When** you press Enter, pick Claude Code's Opus, then High,
   **Then** the tile reads "Opus" with 3 cells filled, scissors lock between Spec and Plan, and
   `[runs.steps.spec]` holds `agent = "claude"`, `model = "opus"`, `effort = "high"`.
3. **Given** Discovery and Spec on the same pick, **When** you select their joint and press Space,
   **Then** scissors appear, Spec starts session 2, and `new_session = true` is written.

More scenarios:

1. **Given** Plan on Opus and Build on Sonnet, **When** you select their joint, **Then** it shows a
   lock, and Space changes nothing.
2. **Given** a saved `build_in_fresh_session = false`, **When** the server reads the settings,
   **Then** the diagram shows Spec and Plan joined, and the next write replaces the key with
   `[runs.steps.plan] new_session = false`.

### US2: Each step runs as its own run (P1)

A run now ends with its step. When it ends before a human gate, Uraeda starts the next step's run
itself, in the same session when the joint joins them, else in a new one on the next step's pick.

Key scenarios:

1. **Given** a spec approved without plan review, Plan on Opus and Build on Sonnet, **When** the
   plan is committed, **Then** the run ends, and a new Sonnet session starts "Implement the plan",
   stopping when every task is checked.
2. **Given** Spec and its revision steps joined on Opus, effort High then Medium, **When** you
   request changes, **Then** the revision runs in the spec's session, its next turn on Medium.
3. **Given** a plan run that ended without committing its plan, **When** it ends, **Then** no build
   starts, and the run asks for you, as a run stopped before its gate does today.

More scenarios:

1. **Given** the build session and its session limit, **When** the limit resets, **Then** the build
   continues in its session, as automatic continues do today.
2. **Given** Continue all, **When** it sends a feature at Build, **Then** it sends the build's step
   to the build's session.

### US3: Implementers and reviewers are Uraeda's sessions (P1)

Under Build, an Implementers tile sets the implementers' agent, model, and effort. A workflow
session gets a tool from Uraeda that starts a sub-agent: Uraeda starts it as a session of the
feature, on the role's pick, in the task's worktree, and returns its last message. The agents' own
sub-agents are off in workflow runs. A sub-agent's session shows under its parent in the feature's
sessions, with its transcript and usage.

Key scenarios:

1. **Given** Build on Claude Code's Opus and implementers on Codex's GPT-6.1-Sol at Low, **When**
   the build starts a wave of 3 tasks, **Then** 3 Codex sessions run at once, each in its task's
   worktree, and their last messages come back to the build.
2. **Given** a running sub-agent, **When** you press Stop on its parent, **Then** the sub-agent
   stops too.

More scenarios:

1. **Given** a sub-agent working for 40 minutes, **When** it ends, **Then** its last message reaches
   the build: progress is reported every 30 seconds, so no agent drops the call.

### US4: Choose the reviewers (P2)

Under Review, a stack lists the reviewers, each an agent on its pick or a command, and a toggle sets
where reviews happen: "Waves", after each wave and on the branch, or "Branch" only. An agent
reviewer uses its agent's own review: Codex's review on its model, Claude Code's `/code-review` at a
level matching its effort. Uraeda runs every reviewer at once, then commits their findings in
`findings-NN.md` before the build fixes them.

[A reviewer selected](/packages/web/src/runs/RunMap.stories.tsx#ReviewerSelected)

`a` adds a reviewer, `d` removes the selected one, Enter picks its agent, or edits its command.

Key scenarios:

1. **Given** reviewers Claude Code on Opus at High and Codex on GPT-6.1-Sol, **When** the branch is
   reviewed, **Then** a Claude session runs `/code-review high` and a Codex session runs Codex's
   review, and `findings-04.md` holds a section for each.
2. **Given** a command reviewer `coderabbit review --plain`, **When** the branch is reviewed,
   **Then** Uraeda runs it in the feature's worktree, and its output is its section.
3. **Given** depth "Branch", **When** wave 2 is merged, **Then** no review runs until the branch's.

### US5: A feature's own options (P2)

The start dialogs of a feature and a change show a strip: six tiny tiles with their joints, then
what differs from your defaults, "defaults" or "Spec on Opus · High". Tab focuses it; the diagram's
keys work there. A change shows its one step and its reviewers.

On a feature's page, the run map replaces the timeline. A Proposal cap opens the track and a Merged
cap ends it. Each tile carries what its stage had there: its time ("12:11 · 2 h 50 min", "since
15:08"), its files as links, Discovery its rounds, and Build its tasks. Questions map to Discovery,
the pull request to Review, its requested changes to Comments. A joint where the workflow waits for
you shows your gate: answers, approval, a plan review when it is on, the pull request's review. It
is in the `needs-you` colour while the feature waits there. Steps done dim, the current one is in
the accent, and the steps not started stay editable. A finished feature shows its whole map, read
only.

[Feature start, defaults](/packages/web/src/runs/RunMap.stories.tsx#StartFeatureDefaults)

[Feature start, changed](/packages/web/src/runs/RunMap.stories.tsx#StartFeatureChanged)

[Change start](/packages/web/src/runs/RunMap.stories.tsx#StartChange)

[Feature page, at Build](/packages/web/src/runs/RunMap.stories.tsx#FeaturePage)

[Feature page, on the phone](/packages/web/src/runs/RunMap.stories.tsx#FeaturePagePhone)

[A finished feature](/packages/web/src/runs/RunMap.stories.tsx#FeatureDone)

[A change's page](/packages/web/src/runs/RunMap.stories.tsx#FeatureChange)

[On the phone](/packages/web/src/runs/RunMap.stories.tsx#Phone)

Key scenarios:

1. **Given** the feature start dialog, **When** you Tab to the strip, move to Spec, press Enter,
   pick Opus and High, and start, **Then** the strip reads "Spec on Opus · High", and the feature's
   options hold only the spec's pick.
2. **Given** a feature at Build, **When** you change Review's model on its page, **Then** the review
   runs on it, and the running build keeps its own.
3. **Given** you change a default in the settings, **When** a feature that never changed that value
   reaches it, **Then** it runs on the new default.

More scenarios:

1. **Given** a feature at Build, task 4 of 9, **When** you open its page, **Then** Build's tile
   reads "since 15:08" over its tasks, and the Spec tile links `spec.md` with "10:02 · 1 h 12 min".
2. **Given** a spec waiting for your review, **When** you open the feature's page, **Then** the
   joint after Spec shows your approval's gate in the `needs-you` colour.

### US6: Follow the sub-sessions (P2)

Every sub-agent is a sub-session: a session Uraeda started for a run. A session's Sub-agents pane
lists them, each with its role, its task or what it reviews, its agent, model, and effort, its
state, its time, and its usage. Clicking one, or Enter on it, opens its page: its transcript,
without a composer, with Stop while it works and a link back to its parent. On the feature page, the
sessions pane nests each sub-session under the session that started it, in the `sub-agent` colour. A
chat keeps its agent's own sub-agents, shown in the pane as today.

[The Sub-agents pane](/packages/web/src/runs/SubSessions.stories.tsx#SubagentsPaneMixed)

[A sub-session at work](/packages/web/src/runs/SubSessions.stories.tsx#SubSessionWorking)

[A sub-session done](/packages/web/src/runs/SubSessions.stories.tsx#SubSessionDone)

[Sub-sessions on the feature page](/packages/web/src/feature/SessionsPane.stories.tsx#WithSubSessions)

[On the phone](/packages/web/src/feature/SessionsPane.stories.tsx#WithSubSessionsPhone)

Key scenarios:

1. **Given** a build with 3 implementers working, **When** you open its Sub-agents pane, **Then** it
   lists "Implementer · Task 4 · Codex · GPT-6.1-Sol · Low", working, with its time.
2. **Given** that implementer's row, **When** you press Enter, **Then** its sub-session's page
   opens, with no composer, Stop, and a link back to the build's session.
3. **Given** the feature page, **When** the build has 2 reviewers done, **Then** the sessions pane
   shows them indented under the build's session, each with its role, agent, model, and "done".

## Replaced behaviour

- **The feature page's timeline draws the stages as a vertical spine.** Guarded by no test of its
  look: `stage-files.test.ts` guards which stage each file goes to, and keeps guarding it.

- **The run after an approval writes the plan, then builds, reviews, and opens the pull request.**
  Guarded by `message.test.ts`'s plan messages ("Write the plan, then implement it").
- **A fresh session takes the model of the session before it.** Guarded by `runtimes.test.ts`, "a
  fresh run keeps the runtime, model, and effort of the session it was sent to (R20)".
- **"Build in a fresh session" decides the session after an approval.** Guarded by
  `runner/__tests__/sessions.test.ts`'s fresh run tests, "a workflow run at the plan step sent
  without fresh follows the setting", `src/__tests__/sessions.test.ts`'s "session.send of the plan's
  message without fresh follows the build_in_fresh_session setting",
  `crates/core/tests/settings.rs`'s `sets_building_in_a_fresh_session_in_its_own_table`,
  `settings.test.ts`, `settings-fate.test.ts`, and `categories.test.ts`.
- **A new session starts on the agent's defaults when nobody picked.** Guarded by `picks.test.ts`'s
  `newSessionPick` cases and `runtimes.test.ts`'s "a session on the agent's defaults opens without a
  model or an effort", which now hold only without a step's pick.
- **A change's start dialog has a "Runs on" picker.** Guarded by `start-dialog.test.tsx` and
  `runtimes.test.ts`'s "change.start sends the change's first run on the runtime, model, and effort
  picked (R20)".
- **Workflow sessions use the agent's own sub-agents.** Guarded by `claude.test.ts`'s "the model and
  effort picked are arguments; none skips permissions" and `codex.test.ts`'s thread parameters.

## Architecture

Steps become runs, chained by the server, so a step's pick and session are real. Sub-agents go
through a tool Uraeda serves, since only then does a pick hold and work on any agent. Both agents
were checked against it ([discovery](discovery-01.md#worth-it-and-feasibility)).

- **Run options in the core** read and write the `[runs]` tables, migrate the old switch, and own
  the rule of what a step resolves to: the feature's value, the setting, then the agent's default. A
  module of its own, beside the settings at their size limit.
- **The step chain** ends each run with its step, and starts the next step's run when the step ended
  before a gate. It owns which steps share a session, in one place the web UI reads.
- **The sub-agent tool** is an MCP endpoint of Uraeda's server, given to each workflow process with
  a token of its own. It starts sessions on a role's pick, reports progress every 30 seconds, stops
  them with their parent, and refuses repeated calls.
- **The runtimes' wiring**: Claude Code gets the tool by `--mcp-config` and `--allowedTools`, its
  `Agent` and `Workflow` tools disallowed. Codex gets it in the thread's configuration, approved and
  parallel, with `agents.enabled = false`.
- **The reviews** run every reviewer of a review at once: agents through their own review, commands
  in the worktree. They write `findings-NN.md`, then answer the build. See the
  [data model](data-model.md).
- **A feature's options** are a row of Uraeda's database, written by the start dialogs and the
  feature page.
- **The run map** is one component in two sizes, the diagram and the strip, its keys in the
  registry. On the feature page it reads the stages' history as the timeline did, which it replaces.
- **The skill** says to use Uraeda's tools when they are offered, and its own sub-agents otherwise.

Tradeoffs:

- A sub-agent in another agent costs a session start, slower than the agent's own.
- Sessions per step re-read their files, where one session would remember.
- Turning the agents' built-in sub-agents off removes Claude Code's Explore and Plan in workflow
  runs.

## Edge cases

| Importance | Situation                                                  | What happens                                                                                     |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| High       | A step's model is gone from its agent                      | its run is refused before it starts: "Spec runs on Opus 4.1, which Claude Code no longer lists." |
| High       | The server restarts while sub-agents run                   | each sub-agent continues as a cut run does; its parent continues once they end                   |
| High       | A reviewer fails or its agent is unavailable               | its section reads "Did not review: Codex is not available on this machine."; the others stand    |
| Normal     | A step's agent is turned off in the settings               | the step falls back to the first runtime on, and its tile says so                                |
| Normal     | A command reviewer exits with an error                     | its section holds its output and its exit code                                                   |
| Normal     | You change a step's pick while that step runs              | the running step keeps its pick; the change applies from its next run                            |
| Normal     | `CLAUDE_CODE_EFFORT_LEVEL` is set in your environment      | every Claude Code effort follows it; the Runs section says so under the diagram                  |
| Niche      | The agent calls the sub-agent tool twice for the same task | the second call gets the first one's answer                                                      |
| Niche      | A run without Uraeda, by hand                              | the skill uses the agent's own sub-agents, and writes `findings-NN.md` itself                    |

## Success criteria

- **SC-001** (four keys): Changing one step's model in a start dialog takes Tab, one move, Enter,
  and the pick.
- **SC-002** (every pick holds): In a run's sessions, every sub-agent's reported model is the one
  its role was set to.
- **SC-003** (no drop): A sub-agent running 60 minutes returns its answer on both agents.
- **SC-004** (agents untouched): The agents' settings files are byte-identical after a feature runs.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, but two:
"Build in a fresh session" becomes the joint before Plan, and sub-agents run through Uraeda's tool,
not the agents' own definitions. Settled while writing this spec:

- Your session answer, read as joints you cut or join, and the default, Discovery and Spec joined
  and a cut before Plan, which is today's behaviour.
- "Use the actual review features" maps a reviewer's effort to `/code-review`'s level, and sets
  Codex's review effort on the turn before it, as its review takes the thread's effort.
- A reviewer's instructions are added to its review's prompt; Codex's fixed rubric stays.
- The review step's session reads `findings-NN.md` and fixes them, as the skill grades findings
  today.
- Your personal `uraeda-external-review` skill is replaced by a Codex reviewer in your settings; the
  skill stays yours to delete.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ⚠️             | ✅         | ✅                | ✅                |

A feature's options live in Uraeda's data folder, not in git, as you chose, to keep a repository
from picking your spend: they are run settings, not workflow state.

## Risk tier

**High**: runs change how they chain and where they stop, and a new tool reaches both agents.

## History

> [!NOTE]
>
> Changes requested on 2026-11-09: centre the joints' line on the scissors, and use the run map in
> place of the feature page's timeline.
>
> - You approve a diagram of the six steps, in the settings and in every start dialog. Each step
>   gets its agent, model, effort, and session, with implementers and reviewers of your choice.
>   Uraeda runs every sub-agent itself, and keeps a feature's choices on your machine.
> - Decisions: a new Run options decision, and changes to Models (a session starts on its step's
>   pick) and Agents (sub-agents are sessions, in their task's worktree).
> - Your answer on sessions is read as: you join steps into one session, cutting where you want. A
>   step on another agent or model always cuts. Say so if you meant otherwise.
> - "Full control in Uraeda" is the sub-agent tool Uraeda gives each agent, verified on both. The
>   agents' built-in sub-agents are turned off in workflow runs.
> - A relaxed guard: Codex's sandbox does not cover Uraeda's tool, so a hostile page read by an
>   agent could make it start more sub-agents, spending usage. Each runs with no more permission
>   than its session.
> - Risk tier `high`: runs change how they chain, and a new tool reaches the agents. The plan does
>   not wait for your review.
