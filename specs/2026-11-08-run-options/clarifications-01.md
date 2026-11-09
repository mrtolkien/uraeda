---
status: awaiting-human
---

# Clarifications, round 01: Run options

> [!IMPORTANT]
>
> 8 questions and 1 follow-up, about 25 minutes.
>
> - Verdict: worth building, with changes: one run covers several steps today, and "command" and
>   "depth" of reviews need a meaning.
> - Claude Code raises no issue: its model changes mid-session, and sub-agents' models are set from
>   outside. Both were verified, as was everything for Codex.
> - Choices that last beyond the feature: one session or one per step, and where a feature's options
>   are kept. Both change the Models decision.
> - What a step is, one session or many, and a model change inside a session work together.
> - Reviewers become a list with their own models; a reviewer of another agent replaces your
>   personal Codex review skill.
> - Points to check: no repository layer, and what a change's options are.

## Context

### Goal

The [proposal](proposal.md) asks to choose how each workflow step runs. That is one session for the
whole feature or one per step, a model and an effort, and its reviewers. Defaults live in the
settings. A feature, a change, or a session overrides them where it starts, by keyboard.

### Today

- **Sessions**: a feature's runs go to its latest session. The setting "Build in a fresh session",
  on by default, starts a new session after a spec's approval. It reuses the previous session's
  model. See [`send.ts`](/packages/server/src/runner/send.ts).
- **Runs**: one run goes from one human gate to the next. After an approval without plan review, one
  run writes the plan, builds, reviews, and opens the pull request. See
  [`message.ts`](/packages/server/src/runner/message.ts).
- **Models**: a session keeps the agent and model it started with, by the
  [Models](/specs/decisions/models.md) decision. Its effort may change between turns. Only a new
  session, or a change's start, shows the picker.
- **Reviews**: the skill's prose. A fresh reviewer checks each wave and then the branch, "on the
  most capable model available". Your personal `uraeda-external-review` skill then runs
  `codex review` on GPT-6.1-Sol, hard-coded.
- **The settings page** no longer lists the planned rows the proposal mentions: they were removed on
  2026-11-05, for this feature to bring.

What the two agents can do, checked on the installed versions with small experiments:

| Need                                     | Claude Code 2.1.319                         | Codex 0.163.0                           |
| ---------------------------------------- | ------------------------------------------- | --------------------------------------- |
| Another model in a running session       | yes, conversation kept                      | yes, per turn, conversation kept        |
| Its cost                                 | the conversation re-read uncached           | likely the same, undocumented           |
| Sub-agents' model and effort from Uraeda | yes, defined for one process (`--agents`)   | yes, through the thread's configuration |
| Built-in review on a chosen model        | no: `/code-review` takes only a depth level | yes: `review_model`, effort inherited   |
| Agent's settings left untouched          | yes                                         | yes, byte-identical                     |

### Scope

Run options for features, changes, and sessions. That is sessions per step, and an agent, model, and
effort per step and per sub-agent role. Then reviewers, the settings rows, and the start dialogs.
Left out: scheduled jobs, and the catch-up runs of the "agents fix merge conflicts" proposal. Both
are proposals of their own, and may later reuse these options.

### Sources

- The runner, settings, start dialogs, and picker, linked in each question.
- Claude Code's docs on models, sub-agents, prompt caching, and code review, and Codex's app-server
  protocol and source, each with experiments.
- Cline, Roo Code, Kilo Code, OpenCode, Aider, Cursor, Copilot, Factory, Amp, Kiro, Zed,
  superpowers, and Spec Kit. Also review tools (CodeRabbit, Greptile, Bugbot, Copilot code review)
  and research on context rot and multiple reviewers.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **No repository layer**: options come from the settings, then the feature, as the proposal says. A
  repository's own defaults could come later as a third layer. Products like OpenCode and Kilo have
  one. See [a repository layer](discovery-01.md#a-repository-layer).
- **A change's options** are its pick, already in its start dialog, and the reviewers. A change runs
  one step, its investigation and fix, so per-step picks do not apply. Promoted to a feature, it
  takes the feature's options from its next step. See
  [changes and sessions](discovery-01.md#changes-and-sessions).
- **A feature's options stay editable** on its page after its start, applying from its next run. The
  run at work keeps what it started with.
- **The defaults keep today's models**: every step and role starts on "Default", the agent's own
  choice, until you pick another in the settings. Nothing runs on a model nobody picked.
- **"Build in a fresh session" is replaced** by the session option of the second question. Your
  saved value carries over: off becomes one session for the whole feature.

## Q1: What should count as a step, with its own session and model?

Example: you approve the spec of "Recurring tasks" without a plan review. Today one run writes the
plan, builds it, reviews it, and opens the pull request, all in one session.

A step can only get its own session and model if the run stops at that step. Uraeda would then start
the next step's run itself, without your "Continue". Which steps exist decides how many rows the
settings have. More in [discovery](discovery-01.md#what-a-step-is).

Why it matters: it sets how fine your control is, and whether a run stops at more places than today.

- **A (recommended). Six steps, each its own run: discovery, spec, plan, build, review, and pull
  request comments. Uraeda starts the next step's run when one ends before a human gate.**
  - Example: the plan is written on Opus in one run, then the build on Sonnet starts by itself, then
    the review.
  - [pro] each phase gets the model it needs, like superpowers' final review on the strongest model.
  - [con] six rows to set, and more run boundaries for the server to chain.
  - Why recommended: it is what "model per step" says, and the skill's steps already end with a
    commit.
- **B. Four steps, as runs are today: discovery, spec, plan and build together, and comments.**
  - Example: the plan and the build run in one session on one model.
  - [pro] no change to how runs stop.
  - [con] the plan and the build cannot differ, the most asked-for split (`opusplan`).
- **C. Two roles, like Claude Code's `opusplan`: thinking (discovery, spec, plan) and building
  (build, review, comments).**
  - Example: Opus writes the questions, spec, and plan; Sonnet builds and fixes the comments.
  - [pro] two rows, the split most users want.
  - [con] the review runs on the build's model, unless reviewers pick their own.

**Answer:**

## Q2: Should a feature run in one session, or a new session at each step?

Example: the spec of "Recurring tasks" is approved. In one session, the build's agent still holds
the discovery's and spec's conversation. In a new session, it starts from the files the steps
committed.

Every step already ends with a commit, so a next agent can resume it. Products give delegated work a
fresh context by default: Claude Code's docs say "Once SPEC.md exists, start a fresh session to
build from it". Research shows models degrade as their context grows. Each new session also pays for
re-reading the files. Whatever the default, a feature can override it, and the hand-over keeps a
per-run switch. More in [discovery](discovery-01.md#session-granularity).

Why it matters: it decides what each step remembers, what a long feature costs, and how many
sessions a feature page lists.

- **A (recommended). A new session at each step by default, with "one session for the whole feature"
  as the other choice.**
  - Example: the build starts a new session; the discovery's session stays in the feature's list.
  - [pro] each step starts clean, as both agents advise, and can run on another agent.
  - [con] a remark you made in the discovery's chat, but never wrote in a file, is lost.
  - Why recommended: the workflow already writes everything a step needs to its files, and context
    rot is measured.
- **B. One session by default, with "a new session at each step" as the other choice.**
  - Example: the build continues in the discovery's session, with its whole conversation.
  - [pro] nothing said in the session is forgotten.
  - [con] a long feature's context grows across every step.
- **C. Keep today's: one session, with a new one for the build, as a switch.**
  - Example: the discovery, the spec, and its revisions share a session; the build gets its own.
  - [pro] no change to how you work today.
  - [con] the discovery and the spec cannot run on different agents.

**Answer:**

## Q3: What happens when the next step's model differs from its session's?

Example: "Recurring tasks" runs in one session. Its spec was written on Opus, and the build is set
to Sonnet.

This matters whenever one session runs several steps: as the default (B in the previous question),
or a feature's choice. The [Models](/specs/decisions/models.md) decision says a session keeps the
agent and model it started with. You chose that in the Codex runtime so a feature's runs never land
on a model nobody picked. Both agents can switch the model mid-session. The switch re-reads the
whole conversation without the prompt cache. Another agent can never join a session. More in
[discovery](discovery-01.md#a-different-model-in-one-session).

Why it matters: it decides whether the Models decision changes, and what "one session" promises.

- **A (recommended). A step on another agent or model starts a new session; steps on the same pick
  continue the session.**
  - Example: the build starts a new Sonnet session; the spec's revisions stay in the Opus session.
  - [pro] the Models decision stays; a session is always one model.
  - [con] "one session" holds only while the steps share a pick.
  - Why recommended: it keeps a rule you set in the Codex runtime, and a switch costs as much as a
    re-read anyway.
- **B. The session switches its model for the step, and a step on another agent starts a new
  session.**
  - Example: the build continues the Opus session on Sonnet, re-read once uncached.
  - [pro] the conversation is kept across models.
  - [con] the Models decision changes: a session's model follows its steps.
- **C. One session means one pick: the steps' models are ignored for that feature.**
  - Example: the build runs on Opus, the session's model.
  - [pro] simple to explain.
  - [con] a feature in one session loses every per-step pick.

**Answer:**

## Q4: Should the build's sub-agents get their own model and effort?

Example: the build of "Recurring tasks" runs on Sonnet. It gives each of its 9 tasks to a fresh
implementer agent, and each wave to a reviewer agent.

Today the skill picks sub-agents' models in prose, "the most capable model available" for the final
review. Uraeda can set them for one session without touching your agents' settings. Claude Code
takes sub-agent definitions for one process; Codex takes roles in the thread's configuration. Both
were verified. superpowers advises "the least powerful model that can handle each role". Reviewers'
models are the next question. More in [discovery](discovery-01.md#sub-agents-models).

Why it matters: implementers do most of a build's work, so their model is most of its usage.

- **A (recommended). Implementers get their own model and effort, beside the build step's; reviewers
  get theirs in the reviewers' options.**
  - Example: the build's session runs on Opus and plans the waves; its implementers run on Sonnet,
    medium effort.
  - [pro] a strong orchestrator over cheaper implementers, set once.
  - [con] the session's agent may still pick another model on one call, where the agent allows it.
  - Why recommended: it is where the usage goes, and both agents support it.
- **B. Only sessions get picks; sub-agents follow the skill's prose.**
  - Example: the build runs on Opus; its implementers run on whatever the agent picks.
  - [pro] nothing more to set.
  - [con] no control over most of the build's usage.

**Answer:**

## Q5: How should reviewers be set?

Example: the build of "Recurring tasks" ends. You want one Claude reviewer on Opus, high effort, and
one Codex reviewer on GPT-6.1-Sol.

Review tools expose a depth tier and custom instructions; few expose a model. Several reviewers find
more, mostly by recall, with more comments. A reviewer of another model family catches what the
author's model misses. Claude Code's `/code-review` cannot pin its reviewers' model, so Uraeda would
define its own. Your personal skill runs Codex's review command today. More in
[discovery](discovery-01.md#reviewers).

Why it matters: it sets which reviewers every feature gets, and whether your personal skill goes
away.

- **A (recommended). A list of reviewers in the settings, each with an agent, a model, an effort,
  and optional instructions. The number of reviewers is the list's length.**
  - Example: a Claude reviewer on Opus and a Codex reviewer on GPT-6.1-Sol review the branch, each
    alone.
  - [pro] covers model, count, prompt, and a second model family in one setting.
  - [con] a list to edit, rather than two values.
  - Why recommended: it replaces your hard-coded skill, and keeps one reviewer as today's default.
- **B. One reviewer model and a number of reviewers.**
  - Example: 2 reviewers on Opus review the branch.
  - [pro] two values to set.
  - [con] no second model family, which your personal skill adds today.
- **C. A shell command per reviewer, any tool, its output read by the session.**
  - Example: `codex review --base main -c model=gpt-6.1-sol`, and `coderabbit review`.
  - [pro] any review tool works, even one Uraeda does not know.
  - [con] you write and maintain each command and its model names.

**Answer:**

### Q5.A: Who runs a reviewer on another agent?

Only if you picked A in Q5. Example: the build runs on Claude, and one reviewer is on Codex.

A reviewer on the session's agent runs as its sub-agent. A reviewer on another agent cannot. The
[Agents](/specs/decisions/agents.md) decision makes every conversation with an agent a session, with
its least permissions. More in [discovery](discovery-01.md#who-runs-a-reviewer-of-another-agent).

Why it matters: it decides whether you see that reviewer's work and usage, and how much the server
orchestrates.

- **A (recommended). Uraeda runs it as a session of the feature, its findings committed to a file,
  which the build's session then fixes.**
  - Example: a "Review · Codex · GPT-6.1-Sol" session appears in the feature, and its findings land
    in the feature's folder.
  - [pro] its transcript and usage show, with Codex's own permissions.
  - [con] the review step waits on two sessions, which the server chains.
  - Why recommended: it keeps the Agents decision, and the findings are in git, as every step's
    output is.
- **B. The build's session runs the other agent's review command, as your personal skill does.**
  - Example: Claude runs `codex review` read-only, and reads its findings.
  - [pro] no orchestration in the server.
  - [con] that review shows only as a command's output, and its usage is not counted.

**Answer:**

## Q6: What should a review's depth mean?

Example: "Recurring tasks" has 3 waves. Today a reviewer checks each wave, a risky task gets its own
reviewer, then a reviewer checks the whole branch.

Review tools mean different things by depth: Copilot's tiers add models, Bugbot and Claude's
`/code-review` raise effort or coverage, CodeRabbit changes tone. A reviewer's effort is already its
own option in the reviewers' list. More in [discovery](discovery-01.md#review-depth).

Why it matters: wave reviews cost a reviewer per wave, and catch problems while the build's context
is fresh.

- **A (recommended). Where reviews happen: "the branch only", or "each wave and the branch", today's
  default.**
  - Example: on "the branch only", the 3 waves go unreviewed, and one review checks the branch.
  - [pro] the knob with the largest effect on usage.
  - [con] one more setting beside the reviewer's effort.
  - Why recommended: effort is already per reviewer; where reviews happen is the one choice left.
- **B. No depth option: the reviewer's effort is the depth.**
  - Example: a reviewer on max effort reviews each wave and the branch, as today.
  - [pro] nothing more to set.
  - [con] wave reviews cannot be turned off for a small feature.
- **C. A finding threshold: report only critical findings, or every grade.**
  - Example: on "critical only", a naming issue is never reported.
  - [pro] fewer findings to fix.
  - [con] the skill already fixes only critical and important ones, and drops minor ones not worth
    it.

**Answer:**

## Q7: Where should a feature's own options be kept?

Example: you start "Recurring tasks" with its spec on Opus, high effort, instead of your default.

Both places work with the agents' picks. The proposal's `discovery` level lives in the proposal's
frontmatter, in git. A session's model lives in Uraeda's data folder, out of git. The
[Settings](/specs/decisions/settings.md) decision forbids reading settings from a repository. More
in [discovery](discovery-01.md#per-feature-storage).

Why it matters: options in git travel with the branch, but a repository could then pick what your
runs spend.

- **A (recommended). In Uraeda's data folder, beside the feature's sessions, shown and edited on the
  feature's page.**
  - Example: the feature page reads "Spec · Claude · Opus · High"; the repository holds nothing.
  - [pro] a repository written by someone else can never choose your models or efforts.
  - [con] the options stay on this machine: a clone elsewhere runs on your defaults.
  - Why recommended: model names depend on the agents installed here, like the session's model.
- **B. In the proposal's frontmatter, beside the `discovery` level.**
  - Example: `proposal.md` gains `spec: claude/opus high`, committed on the branch.
  - [pro] in git, readable by an agent working without Uraeda.
  - [con] a repository someone else wrote could make your runs spend usage on its picks.

**Answer:**

## Q8: How should a start dialog show the options?

Example: you start "Recurring tasks" from the New page. The dialog asks for its slug and research
effort; a change's dialog also has the agent, model, and effort button.

You asked for changing one value to be easy, by keyboard. The app's key picker, `Space a`, picks the
agent and model, then the effort, in two steps. More in [discovery](discovery-01.md#creation-ui).

Why it matters: it sets how heavy every start feels, and how fast one value changes.

- **A (recommended). One line naming only what differs from your defaults, "Run options: defaults".
  A key opens the key picker: the step, then the agent and model, then the effort.**
  - Example: `Space o`, `s` for spec, Opus, High; the line reads "Spec on Opus · High".
  - [pro] the dialog stays one row taller, and one value takes four keys.
  - [con] the other steps' values are one key away, not on screen.
  - Why recommended: most starts keep the defaults, and the line still shows any difference.
- **B. A row per step in the dialog, each with its picker button.**
  - Example: six rows, from discovery to comments, Tab between them.
  - [pro] every value on screen.
  - [con] a dialog six rows taller for every start.

**Answer:**

## Settled without the human

### Behaviour

- **Automatic continues and Continue all** go to the current step's session, as they go to the
  latest session today. See
  [the proposal's path](discovery-01.md#the-proposals-path-and-existing-actions).
- **Your message in a session** goes to that session, whatever its step, as today.
- **A step whose model is gone** from its agent is refused before its run, naming the step and the
  model. A start's pick is refused the same way today.
- **An effort set in your environment** (`CLAUDE_CODE_EFFORT_LEVEL`) overrides every Claude Code
  effort. Uraeda never sets it, and the Runs section says so. See
  [Claude Code](discovery-01.md#claude-code-21319).

### Under the hood

- **Sub-agents and reviewers are defined for one process**: Claude Code's `--agents`, and Codex's
  thread configuration with a role file in Uraeda's data folder. Neither writes the agents'
  settings. See [Codex](discovery-01.md#codex-01630).
- **Which steps start a session** gets one home in the server, read by the web UI, rather than its
  two copies today. See [rules and their owners](discovery-01.md#rules-and-their-owners).
- **The new settings** take their own module in the core: its settings file is near the size limit.
  Like "Build in a fresh session", they have no flag or environment variable.
- **Sub-agents are asked to run in the foreground**, since a backgrounded Claude Code sub-agent may
  answer after its turn ends.

**Notes:**
