# Discovery, round 01: Run options

## Summary

Run options decide how each workflow step runs: in which session, on which agent, model, and effort,
and with which reviewers. Comparable products give each phase or role its own model and effort, with
a fallback chain (per run, then role, then global default, then the session's model). They give
delegated work a fresh context by default, and fix the pick when the task is created. Review tools
expose a depth tier, custom instructions, and sometimes a reviewer model or a second model family.

The proposal asks for three things: one session per feature or one per step, a model and an effort
per step, and review options (command, model, prompt, depth, number of reviewers). They come in two
layers: global defaults in the settings, and overrides picked when a feature, a change, or a session
is created, by keyboard.

Today one setting exists, "Build in a fresh session": the run after a spec's approval starts a new
session, on the model of the one before. Every other step continues the feature's latest session. A
session keeps the agent and model it started with, by the [Models](/specs/decisions/models.md)
decision. One run often covers several steps: after an approval without plan review, the same run
writes the plan, builds, reviews, and opens the pull request. Reviewers are prose in the skill, plus
a personal skill that runs Codex as a second reviewer. Both agents support everything the proposal
needs: switching the model in a session, setting sub-agents' models from outside, and reviews on a
chosen model.

## How other products do it

### Cline

- Plan mode reads, Act mode edits; the setting "Use different models for Plan and Act" gives each
  mode its model, switched with the mode. The conversation carries over between modes.
  [Plan and Act](https://docs.cline.bot/core-workflows/plan-and-act)

### Roo Code and Kilo Code

- Roo's modes remember their last model ("sticky models"), and API configuration profiles, which
  include a thinking budget, link to a mode. A task keeps its profile, even on resume; Orchestrator
  subtasks inherit the parent's.
  [Using modes](https://roocodeinc.github.io/Roo-Code/basic-usage/using-modes),
  [profiles](https://roocodeinc.github.io/Roo-Code/features/api-configuration-profiles)
- Orchestrator subtasks run "in complete isolation with its own conversation history": context goes
  in through the orchestrator's instructions, a summary comes back.
  [Boomerang tasks](https://roocodeinc.github.io/Roo-Code/features/boomerang-tasks)
- Kilo's agents (Code, Ask, Plan, Debug) each set a model and a variant; config merges built-in,
  global, project, then environment, property by property. Cmd/Ctrl+. cycles them.
  [Using modes](https://kilo.ai/docs/basic-usage/using-modes),
  [custom modes](https://kilo.ai/docs/customize/custom-modes)

### OpenCode

- Agents are primary or sub-agents, each with a model, a variant (the reasoning effort), a prompt,
  and permissions, globally or per project; "Subagents run with fresh context".
  [Agents](https://opencode.ai/docs/agents/), [config](https://opencode.ai/docs/config/)
- Keys: Tab cycles agents, `<leader>m` lists models, Ctrl+T cycles the effort, `<leader>n` starts a
  new session. [Keybinds](https://docs.opencode.ai/docs/keybinds/)

### Aider

- Architect mode sends each request to an architect model, then an editor model; a weak model writes
  commit messages. [Modes](https://aider.chat/docs/usage/modes.html),
  [options](https://aider.chat/docs/config/options.html)
- Pairs beat a model alone on Aider's benchmark (o1-preview with an o1-mini editor: 85.0% against
  79.7%), but the best pairs were "probably not practical for interactive use".
  [Architect benchmark](https://aider.chat/2024/09/26/architect.html)

### Claude Code

- `opusplan` uses Opus in plan mode and Sonnet to execute. Effort runs from low to max.
  [Model configuration](https://code.claude.com/docs/en/model-config)
- Sub-agents set `model` and `effort` in their definition; "Each subagent starts with a fresh,
  isolated context window". [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- Its best practices: "Once SPEC.md exists, start a fresh session to build from it", and "A second
  session is also the easiest independent reviewer you can get". It warns that a reviewer asked to
  find problems "will always find something".
  [Best practices](https://code.claude.com/docs/en/best-practices)

### Cursor, Copilot, Factory, Amp, Kiro, Zed

- Cursor's sub-agents set a model (default `inherit`) and start "with a clean context"; cloud agents
  use an admin's default model when a run names none.
  [Subagents](https://cursor.com/docs/subagents),
  [cloud agent settings](https://cursor.com/docs/cloud-agent/settings)
- Copilot's coding agent picks a model and an effort per task, where the task is assigned; custom
  agents set a model, else inherit the default.
  [Changing the model](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/changing-the-ai-model),
  [custom agents](https://docs.github.com/en/copilot/reference/custom-agents-configuration)
- Factory's spec mode has its own model and effort settings (`specModeModel`,
  `specModeReasoningEffort`); custom droids set a model and an effort, each in "its own fresh
  context window". [Spec mode](https://docs.factory.com/cli/user-guides/specification-mode),
  [custom droids](https://docs.factory.com/cli/configuration/custom-droids)
- Amp's modes bundle a model, an effort, a prompt, and tools: "Choose a mode based on how much the
  agent needs to figure out, not on which model". The mode is set before the first message, and "You
  cannot change the mode later in that thread". A new thread defaults to the last mode. Its Oracle
  is a read-only advisor whose model is set in its plugin file.
  [The Dial](https://ampcode.com/docs/the-dial),
  [models and subagents](https://ampcode.com/docs/models-and-subagents),
  [threads](https://ampcode.com/docs/threads)
- Kiro picks a model and an effort per chat; nothing per spec phase is documented.
  [Model selection](https://kiro.dev/docs/chat/model-selection/)
- Zed has a model per job: `commit_message_model`, `thread_summary_model`, `subagent_model` with its
  effort. [Agent settings](https://zed.dev/docs/ai/agent-settings)

### superpowers and Spec Kit

- superpowers gives each task a fresh implementer that must "never inherit your session's context",
  reviews each task, then the whole branch. Its model guidance: "use the least powerful model that
  can handle each role", and the final review on "the most capable available model, not the session
  default". "Always specify the model explicitly." (obra/superpowers,
  `skills/subagent-driven-development/SKILL.md`, read through `gh api`)
- Spec Kit's workflow `command` steps take an agent (`integration`) and a `model` per step, between
  `gate` steps for human review. (github/spec-kit, `docs/workflow-steps/types.md`, read through
  `gh api`)

### Review tools

- Claude Code's `/code-review` takes a level, low to max: "At low, the review reports the findings
  it's most confident in … From medium through max, the review broadens coverage". It has no setting
  for the reviewers' model or number.
  [Local code review](https://code.claude.com/docs/en/code-review-local)
- Claude's managed Code Review has Quick, Standard, and Deep levels and rules in `REVIEW.md`, and no
  model choice. [Code review](https://code.claude.com/docs/en/code-review)
- Copilot code review has no model picker: Lite, Balanced ("a higher-reasoning model"), and Max
  ("multiple high-reasoning models"), at about $0.25, $1.50, and $10 a review.
  [Use code review](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review)
- Cursor Bugbot: effort Low, Default, High, Smart, and rules in `.cursor/BUGBOT.md`.
  [Bugbot](https://cursor.com/docs/bugbot)
- CodeRabbit: profiles chill, assertive ("may feel nitpicky"), quiet, plus tone and path
  instructions. [Configuration](https://docs.coderabbit.ai/reference/configuration)
- Greptile: strictness 1 to 3, comment types, instructions, an effort tier.
  [greptile.json](https://www.greptile.com/docs/code-review-bot/greptile-json)
- Codex: `review_model` overrides the model of `/review`. The Codex plugin for Claude Code adds
  `/codex:review` and `/codex:adversarial-review` with `--model` and `--effort`.
  [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference),
  openai/codex-plugin-cc (read through `gh api`)
- Copilot CLI's Rubber Duck is a read-only critic of another model family, picked automatically;
  Sonnet 4.6 with a GPT-5.4 critic closed 74.7% of the gap to Opus on SWE-Bench Pro.
  [Rubber duck](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/rubber-duck),
  [GitHub blog](https://github.blog/ai-and-ml/github-copilot/github-copilot-cli-combines-model-families-for-a-second-opinion/)

### Community and research

- Context rot: "model performance consistently degrades with increasing input length", across 18
  models. [Chroma](https://www.trychroma.com/research/context-rot)
- Each model has its own prompt cache: "Switching models recomputes the entire request", and "Pick
  your model and effort level at the top of a session".
  [Prompt caching](https://code.claude.com/docs/en/prompt-caching). Anthropic's team: "the best way
  to [switch models] is with subagents".
  [Prompt caching is everything](https://claude.dev/blog/lessons-from-building-claude-code-prompt-caching-is-everything/)
- Cognition, 2026: multi-agent works "when writes stay single-threaded and the additional agents
  contribute intelligence rather than actions"; a review works best "when the coding and review
  agents do not share any context".
  [Multi-agents working](https://cognition.com/blog/multi-agents-working)
- Several reviews: aggregating reviews raises F1 "up to 43.67%", mostly by recall
  ([SWR-Bench](https://arxiv.org/abs/2509.01494)); GitHub's ensemble raised precision 8.0% and
  recall 13.6%, with 61% more comments
  ([ReviewBench](https://github.blog/ai-and-ml/github-copilot/reviewbench-an-open-benchmark-for-ai-code-review/)).
  No source measures the returns of each added reviewer.
- A practitioner running Codex on Claude's diffs: a critic "that cries wolf gets ignored"; hand over
  the diff only, never the transcript.
  [Codex reviews Claude's diffs](https://zackproser.com/blog/codex-reviews-claudes-diffs)
- A strong planner with a cheaper executor (`opusplan`) is liked for usage savings, seen only in
  search snippets of blogs and Reddit threads; Cognition calls a weak primary with a strong friend
  "still an open problem".

### What they have in common

1. A model and an effort per phase or role, falling back to a default, then to the session's model.
2. Layered settings: global, project, and a pick per run; often an admin layer.
3. A pick fixed when the task is created (Amp, Roo, Copilot), kept on resume.
4. Keys to cycle agents or modes, a model list, and an effort cycle.
5. Fresh context for delegated work, with a summary back; continuing is the opt-in.
6. Review depth as 3 or 4 tiers, custom instructions in a file, a trigger policy, and a finding
   threshold; a reviewer model only in tools users run themselves.
7. Several reviewers with a check pass against false positives, and an optional reviewer of another
   model family.
8. A warning when a change mid-session breaks the prompt cache (Claude Code asks first).

## Standards and libraries

### Claude Code 2.1.319

Checked on the installed version with `claude --help`, the docs, and small experiments in `/tmp` on
Haiku and Sonnet. The user's `~/.claude/settings.json` was unchanged.

- **The model changes in a running session**: the control request `set_model`, or
  `apply_flag_settings` with a model, answered the new model, and the next reply came from it,
  remembering the conversation. `--resume <id> --model X` does the same. Each switch emits a new
  `system/init`. [Agent SDK](https://code.claude.com/docs/en/agent-sdk/typescript),
  [model configuration](https://code.claude.com/docs/en/model-config)
- **A switch re-reads the conversation uncached**: each model has its own cache. Effort changes keep
  the cache on the 5.5 models and Fable 5.1, not on others.
  [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
- **Effort**: low, medium, high, xhigh, max, by model; an unsupported level falls to the highest one
  below. `CLAUDE_CODE_EFFORT_LEVEL` in the environment overrides every other effort, sub-agents'
  included. [Model configuration](https://code.claude.com/docs/en/model-config)
- **Sub-agents' models, set from outside**: `--agents '<json>'` defines sub-agents for one process,
  with `model`, `effort`, `prompt`, `tools`, without writing any settings. Verified: a definition
  with `model: sonnet` under a Haiku session ran on `claude-sonnet-5-5`. The Agent tool's own
  `model` parameter wins over the definition, unless `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` is set,
  which forced Haiku over both in the experiment.
  [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- **A sub-agent's effort** is accepted in the definition and per call, but the stream shows no
  effort, so it could not be confirmed.
- **Background sub-agents**: in one `-p` test a sub-agent started backgrounded, and the main turn
  ended before its answer came back.
- **A skill** can pin `model` and `effort` in its frontmatter: for the rest of the turn, or for its
  forked sub-agent with `context: fork`. [Skills](https://code.claude.com/docs/en/skills)
- **`/code-review`** (alias `/review`) takes only a level and a target; a project skill named
  `code-review` replaces it. [Local code review](https://code.claude.com/docs/en/code-review-local)
- **The organization's `availableModels`** silently swaps a blocked model for an allowed one.

### Codex 0.163.0

Checked with the installed CLI, its generated protocol types (`codex app-server generate-ts`), the
openai/codex source at commit `8703d32b`, and small experiments in a throwaway repository. The
user's `~/.codex/config.toml` was byte-identical before and after.

- **Per turn**: `turn/start` takes `model` and `effort`, applied to "this turn and subsequent
  turns". Verified: a second turn on another model kept the history, after a
  `thread/settings/updated` notification. Codex adds a `<model_switch>` note to the context
  (`codex-rs/core/src/context/model_switch_instructions.rs`). Cache behaviour on a switch is not
  documented.
- **`thread/settings/update`** changes the model and effort for later turns; it is experimental,
  which Uraeda's `initialize` already opts into
  ([`codex.ts`](/packages/server/src/runner/codex.ts)).
- **Sub-agents**: `multi_agent` is on by default. Verified: a `thread/start` `config` override with
  `agents.default_subagent_model`, `agents.default_subagent_reasoning_effort`, and a role
  `agents.ura-reviewer` whose `config_file` (an absolute path) pins a model and an effort, made both
  sub-agents run on the configured models and efforts. The parent may still pass its own model on a
  spawn, except to a role that pins one ("These settings cannot be changed",
  `core/src/agent/role.rs`).
- **Reviews**: `review/start` takes a target (uncommitted changes, a base branch, a commit, or
  custom instructions). Its model is `review_model`, else the thread's model; its effort is the
  thread's; its system prompt is a fixed rubric; it cannot spawn sub-agents. Verified with a custom
  target: about 14 seconds. `codex review` on the command line takes `-c` overrides
  (`core/src/session/review.rs`, `core/src/tasks/review.rs`).
- **Profiles** (`--profile`) are being replaced by per-file layers in `CODEX_HOME`, which would mean
  writing in the user's folder; `codex app-server` takes none.
- **Models**: most take low to max plus `ultra`; the default here is GPT-6.1-Sol on low.

## The code

### Important reads

- [`runner/send.ts`](/packages/server/src/runner/send.ts): `sendTo` decides a fresh session,
  `fresh ?? (FRESH_STEPS.has(step) && freshByDefault)`, and creates it on the agent, model, and
  effort of the session the run was sent to.
- [`HandOver.tsx`](/packages/web/src/HandOver.tsx): the per-run switch "Build in a fresh session",
  and a second copy of `FRESH_STEPS = new Set(["approval", "plan"])`, a known deferred fix
  ([Redesign feature](/specs/done/2026-10-18-redesign-feature.md)).
- [`runner/message.ts`](/packages/server/src/runner/message.ts): `goal()` gives each run its work
  and its stop. From the approval or the plan without plan review, one run is "write the plan, then
  implement it", stopping when the pull request is ready.
- [`runner/session-folders.ts`](/packages/server/src/runner/session-folders.ts): `featureSession`
  takes the latest session or creates one; `newSession` always creates one.
- [`runner/picks.ts`](/packages/server/src/runner/picks.ts): `newSessionPick` and `checkEffort`, the
  one rule of what a new session runs on; null model and effort mean the agent's defaults.
- [`runner/claude.ts`](/packages/server/src/runner/claude.ts): `--model` and `--effort`, effort
  changes by `apply_flag_settings`; nothing sets sub-agents' models.
- [`runner/codex.ts`](/packages/server/src/runner/codex.ts) and
  [`codex-turns.ts`](/packages/server/src/runner/codex-turns.ts): the model on `thread/start`, the
  effort on `turn/start`, and a `config` override already used for the project's trust. The file is
  484 lines, against a 500-line limit.
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs): `[runs]` holds
  `build_in_fresh_session`, `continue_after_restart`, `continue_after_limit`, and
  `automatic_continues`. 473 lines, near the limit: new tables need their own module.
- [`settings/categories.ts`](/packages/web/src/settings/categories.ts) and
  [`RunSettings.tsx`](/packages/web/src/settings/RunSettings.tsx): the Runs section.
- [`StartDialog.tsx`](/packages/web/src/StartDialog.tsx),
  [`NewFeatureComposer.tsx`](/packages/web/src/NewFeatureComposer.tsx),
  [`NewChangePage.tsx`](/packages/web/src/NewChangePage.tsx),
  [`ProposalStart.tsx`](/packages/web/src/ProposalStart.tsx): a feature's start asks for its slug
  and research effort; a change's adds the agent, model, and effort; a proposal file's start asks
  for the kind and slug.
- [`SessionPicker.tsx`](/packages/web/src/SessionPicker.tsx) on
  [`keys/KeyPicker.tsx`](/packages/web/src/keys/KeyPicker.tsx): the two-step picker, `Space a`.
- [`crates/core/src/files/proposal.rs`](/crates/core/src/files/proposal.rs): the proposal's
  `discovery` frontmatter, the one per-feature option stored today, set at the start.
- The skill: [implementation](/skills/uraeda/references/implementation.md) reviews each wave with a
  fresh reviewer, a risky task alone, and the branch with a reviewer "on the most capable model
  available"; "A second reviewer, such as another tool's review skill, can review the branch too". A
  change has one review ([change](/skills/uraeda/references/change.md)).
- The personal skill `~/.claude/skills/uraeda-external-review/SKILL.md`, not in the repository: runs
  `codex review -c model='"gpt-6.1-sol"' -c sandbox_mode='"read-only"' --base main` after the final
  review, with its model hard-coded and checked weekly.
- [Benchmarks](/benchmarks/README.md): each suite sets a model and an effort per run, and runs each
  step in a fresh session; a session naming another model fails the run.

### The proposal's path and existing actions

- **Settings**: the Runs section shows "Build in a fresh session" and the three continues. The
  planned rows the proposal mentions ("One session for the whole feature, or a new session at each
  step", "The model and effort of each step", "The review's command, model, and number of
  reviewers", "A second review by another model", "A different choice for one feature") were removed
  on 2026-11-05 (`23a13f7c`), as placeholders later features bring.
- **Creating a feature**: from the New page or a proposal file, the session is created when the
  human sends the first message, from the session page's composer, with a picker. A change's start
  dialog picks the agent, model, and effort, and the server sends its first run.
- **Each later step**: applying answers, approving, requesting changes, and the next pane hand the
  feature to its latest session, without a picker. After an approval, the setting starts a new
  session on the same pick.
- **Automatic continues and Continue all** send to the folder's latest session
  ([`continuer.ts`](/packages/server/src/runner/continuer.ts),
  [`continue-all.ts`](/packages/server/src/fate/continue-all.ts)). With a session per step, the
  latest session is the current step's: nothing changes.
- **Promoting a change to a feature** sends to the change's session, without a pick
  ([`session-moves.ts`](/packages/server/src/fate/session-moves.ts)).
- **The human's message in a session** goes to that session, whatever the step.
- **A new session by hand** (`?new`) shows the picker.
- **Effort changes between turns** apply to the session, from its next turn.
- **Overlaps in flight**: the "Agents fix merge conflicts" proposal (branch `2026-11-08-agents-fix`,
  no code yet) wants its catch-up run as "a workflow setting … in-line with the models/run
  settings"; the scheduled jobs change says it touches agents' options and triggering. Neither has a
  spec yet.

### Rules and their owners

- **Which steps start fresh**: `FRESH_STEPS` in [`send.ts`](/packages/server/src/runner/send.ts),
  copied in [`HandOver.tsx`](/packages/web/src/HandOver.tsx). No decision holds the rule: the Agents
  decision's rule was dropped on 2026-10-19 (`e51f7007`), yet comments in `send.ts`, `Composer.tsx`,
  and two tests still cite it.
- **What a new session runs on**: `newSessionPick` in
  [`picks.ts`](/packages/server/src/runner/picks.ts); the fresh session copies the previous pick in
  `send.ts`.
- **A session keeps its model**: the [Models](/specs/decisions/models.md) decision, whose
  consequences say "Defaults per step or per feature, planned by run options, change this decision".
- **Settings resolve from flag, environment, file, default**: the
  [Settings](/specs/decisions/settings.md) decision; `build_in_fresh_session` has no flag or
  variable.
- **Where a run stops**: `goal()` in [`message.ts`](/packages/server/src/runner/message.ts), and the
  skill's "Continue to the next human gate" ([SKILL.md](/skills/uraeda/SKILL.md)).

### Likely changes

- Core settings: a new module beside [`settings.rs`](/crates/core/src/settings.rs) for steps and
  reviewers, its parsing in `settings/file.rs`, the binding, and the server's
  [`settings.ts`](/packages/server/src/settings.ts) and settings mutations. Under every option.
- Runner: [`send.ts`](/packages/server/src/runner/send.ts), `send-input.ts`,
  [`picks.ts`](/packages/server/src/runner/picks.ts), `session-folders.ts`,
  [`message.ts`](/packages/server/src/runner/message.ts) (stops at each step, with runs split by
  step), [`claude.ts`](/packages/server/src/runner/claude.ts) and
  [`codex.ts`](/packages/server/src/runner/codex.ts) (sub-agents' and reviewers' models),
  `processes.ts` (a model change in a session, with one session per feature switching models).
- Fate mutations: `send-mutations.ts`, `change-starts.ts`, `starts.ts`, `session-moves.ts`.
- Web: the Runs section and a reviewers' section of the settings, `HandOver.tsx`, `StartDialog.tsx`,
  `NewFeatureComposer.tsx`, `NewChangePage.tsx`, `ProposalStart.tsx`, `SessionPicker.tsx`, the
  feature page; [`views.ts`](/packages/web/src/views.ts) is 498 lines.
- Per-feature storage: the session cache's migrations, or the proposal's frontmatter in
  [`proposal.rs`](/crates/core/src/files/proposal.rs) (525 lines with its tests) and
  `check/values.rs`, depending on where overrides live.
- Skill: [implementation](/skills/uraeda/references/implementation.md) and
  [change](/skills/uraeda/references/change.md) on reviewers, the templates and example where they
  name them; [`docs/web-ui.md`](/docs/web-ui.md) and the settings' docs.
- Decisions: Models, and a new decision for run options.
- Tests guarding behaviour that changes:
  - `runner/__tests__/runtimes.test.ts`: "a fresh run keeps the runtime, model, and effort of the
    session it was sent to, not the first one on's (R20)"; "a new session runs on the first runtime
    on in its repository"; "a session on the agent's defaults opens without a model or an effort".
  - `runner/__tests__/sessions.test.ts`: "a fresh run starts a new session of the feature", "a fresh
    run's session is the latest", "a workflow run that is not fresh continues the agent session", "a
    workflow run at the plan step sent without fresh follows the setting".
  - `src/__tests__/sessions.test.ts`: "session.send of the plan's message without fresh follows the
    build_in_fresh_session setting".
  - `crates/core/tests/settings.rs`: `sets_building_in_a_fresh_session_in_its_own_table` and the
    round trips; `settings.test.ts` and `settings-fate.test.ts` on the setting.
  - `runner/__tests__/picks.test.ts`: the `newSessionPick` cases.

## The proposal

### The settings page no longer lists planned rows

The proposal says the page "already lists these as planned rows". They were removed on 2026-11-05;
their labels survive in git (`23a13f7c`) and in the
[settings page record](/specs/done/2026-10-16-settings-page.md). Nothing to decide: the feature
brings its rows.

### A run covers several steps

"A new session at each step" cannot hold today: after an approval without plan review, one run
writes the plan, builds, reviews, and opens the pull request. A step can get its own session and
model only if runs stop at each step, or if the step is defined as a run, from one human gate to the
next.

### One session per feature against the Models decision

With one session for the whole feature and a model per step, the model changes inside the session.
The [Models](/specs/decisions/models.md) decision says "A session MUST keep the agent and the model
it started with". Both agents can switch, at the cost of re-reading the conversation uncached, and
another agent cannot join the same session at all.

### "Model per step" inside the implementation

Most of the build's work is done by sub-agents: implementers per task and reviewers per wave. The
proposal does not say whether their models are options, as the removed planned row "Sub-agents
during the implementation" suggested.

### "Command" and "depth" of reviews

"Command" may mean the agent's review command (`/code-review`, `codex review`), or any shell
command, as the personal external review skill runs. "Depth" may mean where reviews happen (each
wave, or the branch only), the reviewer's effort, or a finding threshold, as review tools use it.

### Where the per-feature layer lives

The proposal names two layers, not where the second is kept: the repository, like the `discovery`
level, or Uraeda's data folder, like the session's model. The Settings decision forbids reading
settings from a repository.

### Changes and sessions

A change runs one step, its investigation and fix, then one review. A session already picks its
agent, model, and effort where it starts. What a change's "options" add beyond its pick and its
reviewers is open.

### A repository layer

The proposal names global and per-feature layers. Comparable products add a project layer; Uraeda's
extensions already take values per repository.

## Worth it and feasibility

- **Worth it**: the human runs several features at once, overnight, on two agents with separate
  limits. A model per step spends the strong model where it matters, and fresh sessions per step
  follow both agents' guidance and the context-rot research. The work is wide (settings, runner,
  start dialogs, skill) but builds on the pick, the picker, and the settings file that exist.
  Reviewer models replace a hard-coded personal skill. Judgement: worth building, with changes to
  how "step" and "command" are read.
- **Claude Code**: no blocker. Its model changes mid-session, and sub-agents' models are set per
  process with `--agents`, both verified. Its limits: `/code-review` cannot pin a reviewer's model
  or count, so Uraeda defines its own reviewers; a sub-agent's effort is not shown in its output; an
  exported `CLAUDE_CODE_EFFORT_LEVEL` overrides every effort; sub-agents may run in the background.
- **Codex**: no blocker. Per-turn models, sub-agents' models through the thread's `config`, and
  reviews on a chosen model, all verified. `thread/settings/update` is experimental.
- **Guards**: defining sub-agents or roles for one process changes nothing in the agents' settings,
  as the [Agents](/specs/decisions/agents.md) decision asks. Keeping per-feature options in the
  repository would let a repository someone else wrote pick the model and effort your runs spend
  usage on; it could never pick an agent you have not installed, nor skip permissions.

## Approaches

Criteria: the proposal (per step, two layers, keyboard), the constitution
([II. Git and plain text](/specs/CONSTITUTION.md#ii-git-and-plain-text-first),
[III. Asynchronous](/specs/CONSTITUTION.md#iii-asynchronous-by-default),
[V. Tools are optional](/specs/CONSTITUTION.md#v-tools-are-optional)), and the
[Models](/specs/decisions/models.md), [Agents](/specs/decisions/agents.md),
[Settings](/specs/decisions/settings.md), and [Run lifecycle](/specs/decisions/run-lifecycle.md)
decisions.

### What a step is

What unit gets its own session and pick. See
[a run covers several steps](#a-run-covers-several-steps).

| Option                                                                                    | Settings to set | Change to runs                                     | Plan and build apart |
| ----------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------- | -------------------- |
| A. The workflow's steps, each its own run: discovery, spec, plan, build, review, comments | 6               | runs stop at each step; the server starts the next | yes                  |
| B. Today's runs, gate to gate: discovery, spec, plan and build, comments                  | 4               | none                                               | no                   |
| C. Two roles, like `opusplan`: thinking (discovery, spec, plan) and building              | 2               | runs stop between plan and build                   | yes                  |

### Session granularity

See [one session per feature](#one-session-per-feature-against-the-models-decision) and
[community and research](#community-and-research).

| Option                                                            | Context per step         | Cache                      | Today's behaviour      |
| ----------------------------------------------------------------- | ------------------------ | -------------------------- | ---------------------- |
| A. A new session at each step by default; one session as a choice | fresh, from files        | a new cache per step       | changes for every step |
| B. One session by default; a new session per step as a choice     | the whole conversation   | kept, until a model switch | changes after approval |
| C. Today's: one session, a new one for the build                  | fresh only for the build | kept until the build       | none                   |

### A different model in one session

Only when one session runs several steps. See
[one session per feature](#one-session-per-feature-against-the-models-decision).

| Option                                              | Models decision | Agents mix | Cost                            |
| --------------------------------------------------- | --------------- | ---------- | ------------------------------- |
| A. A step on another model starts its own session   | kept            | yes        | the step re-reads its files     |
| B. The session switches its model for the step      | changed         | no         | one uncached re-read per switch |
| C. One session means one pick for the whole feature | kept            | no         | step picks ignored              |

### Sub-agents' models

See ["model per step" inside the implementation](#model-per-step-inside-the-implementation) and the
[Claude Code](#claude-code-21319) and [Codex](#codex-01630) sections.

| Option                                                          | Uraeda's work                        | Control     |
| --------------------------------------------------------------- | ------------------------------------ | ----------- |
| A. Implementers and reviewers get their own model and effort    | `--agents` and the thread's `config` | per role    |
| B. Sub-agents follow the skill's prose; only sessions get picks | none                                 | the agent's |

### Reviewers

See ["command" and "depth"](#command-and-depth-of-reviews) and [review tools](#review-tools).

| Option                                                                      | Cross-family | Knobs                      | Tools optional                     |
| --------------------------------------------------------------------------- | ------------ | -------------------------- | ---------------------------------- |
| A. A list of reviewers, each an agent, a model, an effort, and instructions | yes          | count by the list          | the skill's default without Uraeda |
| B. One reviewer model and a count                                           | no           | model, count               | same                               |
| C. A shell command per reviewer                                             | any tool     | whatever the command takes | same                               |

### Who runs a reviewer of another agent

Only with reviewers of another agent. See [Codex 0.163.0](#codex-01630).

| Option                                                                | Visible in Uraeda            | Usage shown | Permissions                                       |
| --------------------------------------------------------------------- | ---------------------------- | ----------- | ------------------------------------------------- |
| A. The step's session runs the other agent's review command           | its output in the transcript | no          | the other agent runs inside the session's sandbox |
| B. Uraeda runs it as a session of the feature, its findings in a file | a session of its own         | yes         | the other agent's own                             |

### Review depth

See [review tools](#review-tools).

| Option                                                            | Meaning                       |
| ----------------------------------------------------------------- | ----------------------------- |
| A. Where reviews happen: branch only, or each wave and the branch | today's skill has both levels |
| B. The reviewer's effort only                                     | no separate knob              |
| C. A finding threshold: critical only, or every grade             | like `/code-review`'s levels  |

### Per-feature storage

See [where the per-feature layer lives](#where-the-per-feature-layer-lives).

| Option                                             | In git | Per machine | A repository picks your spend |
| -------------------------------------------------- | ------ | ----------- | ----------------------------- |
| A. Uraeda's data folder, shown on the feature page | no     | yes         | no                            |
| B. The proposal's frontmatter                      | yes    | no          | yes                           |

### Creation UI

How the start dialogs show the options. See
[the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                                              | Dialog height | Keys                              |
| ------------------------------------------------------------------- | ------------- | --------------------------------- |
| A. One line naming what differs from the defaults, opening a picker | one row       | a leader key, then the key picker |
| B. A row per step, each a picker button                             | 6 rows        | Tab through rows                  |

### Needs no choice

- **A fallback chain**: per-feature, then global, then the agent's default, as every product does;
  the Models decision already falls back to the agent's default.
- **Effort beside the model**: the picker already picks both.
- **A pick fixed for a run, kept on resume**: a session keeps its pick already.
- **A warning on a cache-breaking switch**: only with a model switch in one session.
- **An admin layer**: Uraeda has one user.
- **Review instructions in a file and a trigger policy**: the skill reads the project's decisions
  and runs the review at the end of the build; reviewers' instructions are a field of the reviewer.

## Not checked

- Cursor's model per mode and per cloud run, and whether its build after a plan opens a new chat:
  its docs redirect or return 404.
- Greptile's strictness levels: behind a login.
- Kiro's model per spec phase.
- Codex's prompt cache on a model switch: undocumented.
- The effort a Claude Code sub-agent actually runs at: absent from its output.
- Reddit and blog sentiment on `opusplan`: search snippets only.
