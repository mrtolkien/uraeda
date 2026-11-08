# Discovery, round 01: Codex runtime + model settings

## Summary

Multi-agent desktop apps (Conductor, T3 Code, JetBrains Air, VS Code's third-party agents) let the
user pick a harness, the agent program that runs the model, and a model when a session starts. The
harness stays fixed for the session, while the model, and a separate reasoning effort, can usually
change between turns. The good ones ask the agent for its model list instead of hardcoding it, keep
"Default" as a value of its own, and show on the session the model that actually ran.

The proposal asks for two things: Codex as a second runtime beside Claude Code, and a model picked
per session, "pick the harness, pick the model". Uraeda already has the runtime half: a runtime
contract, an extension per runtime, a runtime picker shown once two runtimes are on, and a mark for
Codex. It has no notion of a model or an effort anywhere.

Codex is reachable through `codex app-server`, a JSON-RPC protocol over stdio that OpenAI's own IDE
extension uses. Experiments on this machine (Codex 0.163.0) confirmed that it lists models with
their efforts, starts and resumes threads with a model, steers a running turn, reports 5-hour and
weekly limits, loads Uraeda's skill from an extra folder, and reviews escalations automatically.
They also found the main obstacle: Codex's default sandbox keeps `.git` read-only, so a session in a
feature's worktree cannot commit, and the agent gives up without asking, unless its instructions
tell it to escalate, which its auto-reviewer then approves.

## How other products do it

### Conductor

- One picker in the chat composer covers Claude Code's, Codex's, Cursor's, and OpenCode's models;
  "each chat tab uses one harness and one selected model", and picking another harness opens a new
  tab ([changelog 0.36.2](https://www.conductor.build/changelog/0.36.2-model-picker-bug-fixes),
  [harnesses](https://www.conductor.build/docs/reference/harnesses)).
- "The models visible in Conductor depend on your Codex setup, account, subscription, API access,
  and model availability"
  ([Codex harness](https://www.conductor.build/docs/reference/harnesses/codex)).
- Effort is a separate control ([0.48.5](https://www.conductor.build/changelog/0.48.5-effort)); the
  default model is changed from the picker itself (0.36.2); favourites switch models by key
  ([0.85.0](https://www.conductor.build/changelog/0.85.0-sections-routines-and-a-new-model-picker)).

### T3 Code

- A provider and model picker in the composer, with defaults per environment or project
  ([project settings](https://github.com/pingdotgg/t3code/blob/main/docs/user/project-settings.md)).
- Model lists come from each provider, cached
  ([#28008](https://github.com/pingdotgg/t3code/issues/28008): a cache that only adds kept a
  signed-out account's models).
- A mid-thread model change calls Claude's `setModel`, only when the model really changes
  ([PR #1466](https://github.com/pingdotgg/t3code/pull/1466)).
- The last model, effort, and fast mode stick as the default of new threads
  ([PR #1121](https://github.com/pingdotgg/t3code/pull/1121)).
- Complaints are about defaults and effort: a stale hidden default picks a third model
  ([#17556](https://github.com/pingdotgg/t3code/issues/17556)); a resumed thread sends an effort the
  model rejects ([#26863](https://github.com/pingdotgg/t3code/issues/26863)); scheduled and
  delegated tasks drop the model ([#30233](https://github.com/pingdotgg/t3code/issues/30233),
  [#31344](https://github.com/pingdotgg/t3code/issues/31344)); the picker ignores Claude Code's
  `availableModels`, so "picking Haiku on Bedrock silently runs Opus"
  ([#24214](https://github.com/pingdotgg/t3code/issues/24214)).

### Vibe Kanban

- A global default agent and variant, overridden when an attempt starts
  ([agent configurations](https://www.vibekanban.com/docs/configuration-customisation/agent-configurations)).
  The profile cannot change after creation
  ([#528](https://github.com/BloopAI/vibe-kanban/issues/528), open).
- Model lists are hardcoded in its source: its Codex list still stops at GPT-5.5 while Codex ships
  GPT-6.x (`crates/executors/src/executors/codex.rs`, read on GitHub).

### JetBrains Air and VS Code

- Air has one "Agent and Model selector", grouped by provider; "once the task is started, you can
  change the model, but not the provider"; the toolbar shows the current model
  ([Air help](https://www.jetbrains.com/help/air/select-agents-and-models.html)).
- VS Code picks Claude or Codex as the "Session Target" before the first prompt, lists only
  harnesses whose requirements are met, and lets the model change mid-session; the harness shows in
  the input and the title
  ([third-party agents](https://code.visualstudio.com/docs/copilot/agents/third-party-agents)).

### Sculptor, Nimbalyst, Zed, Happy

- Sculptor: the toolbar's model picker "switch[es] the model for the current agent session… takes
  effect on the next message"; effort is a separate control
  ([chat help](https://github.com/imbue-ai/sculptor/blob/main/docs/help/chat.md)).
- Nimbalyst: "Models are discovered dynamically from each provider"; effort "only offers the levels
  the selected model accepts"
  ([provider setup](https://nimbalyst.com/docs/setup-nimbalyst/ai-provider-setup-and-notifications/)).
- Zed: the agent is fixed per thread; model configuration is "usually owned by the External Agent"
  ([external agents](https://zed.dev/docs/ai/external-agents)).
- Happy moved from hardcoded Claude and Codex lists to the agent's own
  (`docs/plans/metadata-driven-model-mode-selection.md` in
  [its repo](https://github.com/slopus/happy)).

### The agents' own pickers

- Claude Code's `/model` switches at once, Enter saving it as the default and `s` for this session
  only; `default` "clears any model override"; effort is its own control, with levels that depend on
  the model ([model configuration](https://code.claude.com/docs/en/model-config)).
- Codex's `/model` "only shows models available to your account and workspace", with effort beside
  it; its IDE extension has a model and effort switcher under the composer
  ([models](https://learn.chatgpt.com/docs/models.md)).
- Claude.ai: "You can change the model, effort level, or thinking setting at any point in a
  conversation"
  ([help](https://support.claude.com/en/articles/8664678-changing-the-model-effort-and-thinking-settings)).
- Complaints: Claude Code's "Default (recommended)" row names the user's saved pick after a restart
  ([#97913](https://github.com/anthropics/claude-code/issues/97913)); a web session silently ran
  another model after compaction ([#86083](https://github.com/anthropics/claude-code/issues/86083));
  Codex's "Default" preset is stuck on an old model
  ([#51225](https://github.com/openai/codex/issues/51225)).

### What they have in common

1. The harness is picked when a session starts and stays; another harness means another session.
2. The model can change between turns, from the next turn on.
3. The model list comes from the agent, for the user's account; hardcoded lists go stale.
4. "Default" means "what the agent picks", a value of its own, ideally saying what it resolves to.
5. Effort is a separate control, offering only the levels the model takes.
6. The last choice is often remembered; a hidden or stale default confuses users.
7. The session shows its model, ideally the one that ran.
8. Every way a session starts, automatic ones included, keeps the choice.

## Standards and libraries

### Codex app-server

- "Codex app-server is the interface Codex uses to power rich clients (for example, the Codex VS
  Code extension). Use it when you want a deep integration inside your own product"
  ([app-server](https://learn.chatgpt.com/docs/app-server.md)). The command is labelled
  `[experimental]` (`codex app-server --help`, 0.163.0); methods outside the stable surface need
  `capabilities.experimentalApi` (same page). No written compatibility promise was found, and
  several methods were removed or deprecated in 2026 (same page).
- Its types are generated by the installed binary: `codex app-server generate-ts --out <dir>`
  ("Output matches the Codex version that generated it", same page).
- Threads: `thread/start` takes `model`, `cwd`, `approvalPolicy`, `approvalsReviewer`, `sandbox`,
  `developerInstructions`, `ephemeral`; it returns the thread, its rollout path, and the model,
  effort, and sandbox in force. Codex picks the thread's ID: a client cannot give one
  (`ThreadStartParams`, generated types).
- `thread/resume` takes the same overrides. Resuming with another model "emits a warning and applies
  a one-time model-switch instruction on the next turn" (app-server page); verified below.
- Turns: `turn/start` takes `input` (text, `localImage` by path, `skill`), and `model`, `effort`,
  `sandboxPolicy`, `cwd`, which apply to "this turn and subsequent turns"; `turn/steer` adds input
  to the running turn, with `expectedTurnId`; `turn/interrupt` ends it as `interrupted` (generated
  types, app-server page).
- Models: `model/list` returns, per model, `id`, `displayName`, `description`, `hidden`,
  `isDefault`, `supportedReasoningEfforts`, `defaultReasoningEffort`, `inputModalities`, and
  `upgrade`. The sign-in guide warns to treat it "as a catalog, not an entitlement check"
  ([Codex app-server for apps](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server.md)).
- Limits: `account/rateLimits/read` and the `account/rateLimits/updated` notification give a primary
  and a secondary window, each `usedPercent`, `windowDurationMins`, `resetsAt`, and
  `rateLimitReachedType`.
- Tokens: `thread/tokenUsage/updated` gives `inputTokens`, `cachedInputTokens`, `outputTokens`,
  `reasoningOutputTokens`, per turn and in total.
- Items: `agentMessage` (with `phase`: `commentary` or `final_answer`), `reasoning`,
  `commandExecution`, `fileChange`, `mcpToolCall`, `webSearch`, `plan`, `collabAgentToolCall` (its
  sub-agents), each with `item/started` and `item/completed`, and text deltas.
- Skills: Codex reads `.agents/skills` from the working directory up to the repository root, and
  `~/.agents/skills` ([build skills](https://learn.chatgpt.com/docs/build-skills.md));
  `skills/extraRoots/set` adds folders; `skills/list` lists what a thread would load.
- Known pitfalls, open issues: a per-thread `config` override made `turn/start` hang on Linux
  ([#45361](https://github.com/openai/codex/issues/45361)); a `thread/resume` with a config override
  can interrupt a starting turn ([#57582](https://github.com/openai/codex/issues/57582)); a default
  resume returns every turn on one line, 23 MB with images
  ([#40362](https://github.com/openai/codex/issues/40362)); an escalation approval never reached the
  client ([#21982](https://github.com/openai/codex/issues/21982)); the bubblewrap helper can outlive
  a killed app-server ([#54877](https://github.com/openai/codex/issues/54877)).
- Rollouts live in `~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<threadId>.jsonl`; `thread/read`
  answers `thread not loaded: <id>` for a missing one (research probe).

### Codex sandbox and approvals

- `sandbox` is `read-only`, `workspace-write`, or `danger-full-access`; `approvalPolicy` is
  `on-request`, `never`, or granular; `untrusted` is retired
  ([approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security.md)).
- "`workspace-write` keeps `.git`, `.agents`, `.codex` and `.aws` under writable roots read-only",
  and network is off by default (same page).
- `approvalsReviewer: "auto_review"` sends escalations to "a carefully prompted subagent" that
  applies "a risk-based decision framework before approving or denying" (`ApprovalsReviewer`,
  generated types). Its notifications are marked "[UNSTABLE] … expected to change soon"
  (`ItemGuardianApprovalReviewCompletedNotification`). A denied action can be approved by the client
  with `thread/approveGuardianDeniedAction`.
- Presets the docs name: Auto is `workspace-write` with `on-request`; Auto-review adds
  `auto_review`; Full access is `danger-full-access` (same page).
- On Linux the sandbox is bubblewrap with seccomp; Ubuntu 24.04 needs an AppArmor profile, and
  Docker may block it ([sandboxing](https://learn.chatgpt.com/docs/sandboxing.md)).

### Codex alternatives to app-server

- `codex exec --json` prints JSONL events for one prompt per process; it takes no input during a
  turn, has no approval round-trip, no effort flag (`-c model_reasoning_effort=…`), and
  `exec resume` has no `--sandbox` flag
  ([non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode.md),
  `codex exec --help`). The TypeScript `@openai/codex-sdk` wraps `codex exec`
  ([SDK README](https://github.com/openai/codex/blob/main/sdk/typescript/README.md)).
- The Agent Client Protocol route: `agentclientprotocol/codex-acp` (v2.6.0, 2026-11-08), a
  TypeScript adapter over app-server, exposes `model` and `reasoning_effort` as session config
  options; it adds an npm dependency and a layer, and loses rate limits and skill listing outside
  its `_meta` extensions ([repo](https://github.com/agentclientprotocol/codex-acp)).
  `zed-industries/codex-acp` is archived.

### Codex models and terms

- Live `model/list` on this Plus account: `gpt-6.1-sol` (default), `gpt-6-astra`, `gpt-6.1-terra`,
  `gpt-6-sol`, `gpt-6-luna`, three `gpt-5.6-*`, and two hidden models. Efforts run `low`, `medium`,
  `high`, `xhigh`, `max`, and on most models `ultra`; default efforts are `low` or `medium`. Every
  model takes images (experiment below).
- Efforts are named Light/Low, Medium, High, Extra High, Max, and Ultra; "Ultra" runs sub-agents
  ([models](https://learn.chatgpt.com/docs/models.md)).
- Terms: no OpenAI page found allows or forbids an app driving the user's own signed-in `codex`. An
  OpenAI engineer wrote "our terms of use and code license are quite permissive, and OSS projects
  like OpenCode are doing things similar"
  ([discussion #8338](https://github.com/openai/codex/discussions/8338)). OpenAI's "Sign in with
  ChatGPT" for open-source apps documents driving `codex app-server` with the plan's usage
  ([token sharing](https://developers.openai.com/siwc/token-sharing-open-source.md)). The Terms of
  Use page itself could not be read (see Not checked).

### Claude Code's model and effort

- `--model <alias|name>` sets a session's model; aliases are `default`, `best`, `fable`, `opus`,
  `sonnet`, `haiku`, `opusplan`, and `[1m]` variants; precedence is the in-session pick, `--model`,
  `ANTHROPIC_MODEL`, the `model` setting
  ([model configuration](https://code.claude.com/docs/en/model-config),
  [CLI reference](https://code.claude.com/docs/en/cli-reference)).
- `--effort low|medium|high|xhigh|max` sets the effort for the process; levels depend on the model,
  defaults are `medium` on the 5.5 models (same pages).
- Over stream-json, a client can list models with the `list_models` or `initialize` control request,
  each model with `value`, `displayName`, `description`, `supportedEffortLevels`, and
  `supportsAutoMode`. It can switch with `set_model`, whose answer gives the resolved model, and
  change effort with `apply_flag_settings`. A probe on this machine (Claude Code 2.1.319) confirmed
  all three without spending usage; types from `@anthropic-ai/claude-agent-sdk` 0.3.319, `sdk.d.ts`.
- A session in `auto` permission mode "drops to `default` if the new model doesn't support auto
  mode" ([Agent SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)). Switching
  models gives up the warm prompt cache (`PostModelSwitch` hook input, `sdk.d.ts`).
- Resuming with another `--model` works: the flag wins over the model saved in the transcript
  ([sessions](https://code.claude.com/docs/en/sessions)).
- An unknown `--model` is accepted at start, and fails only at the first request; an unknown
  `set_model` is refused with `not_found` (probe).
- The list on this Team account has 13 rows: 5 aliases and 8 pinned versions (probe).

## The code

### Important reads

- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts): the runtime contract,
  `Capabilities`, `OpenOptions`, `AgentProcess`. `OpenOptions` has no model or effort, and
  `nativeId` is chosen by Uraeda, which Codex cannot honour.
- [`runner/claude.ts`](/packages/server/src/runner/claude.ts): the whole Claude Code runtime, the
  model to follow: one process per session, `--permission-mode auto`, the skill as a plugin, the web
  UI's instructions appended to the system prompt, the images' and extensions' folders added, a
  process group per session. 424 lines; a Codex runtime of the same shape is a new file pair.
- [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts) and
  [`claude-limits.ts`](/packages/server/src/runner/claude-limits.ts): Claude's events into
  `AgentEvent`s, and its usage windows and limits. A Codex runtime needs the same two parts.
- [`runner/events.ts`](/packages/server/src/runner/events.ts): `AgentEvent`, agent-neutral. `init`
  carries the agent's session ID; `result` already carries `models`, the models that answered.
- [`runner/transcript.ts`](/packages/server/src/runner/transcript.ts) `#init`: a session ID that
  differs from the stored one is read as `/clear`, with a "cleared" line. A Codex thread's first
  `init` would read as a clear, since Codex picks the ID.
- [`runner/runtimes.ts`](/packages/server/src/runner/runtimes.ts): runtimes registered by name, the
  first one on as the default, refusals for one off or missing.
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts) `open`: builds `OpenOptions`
  from the session's row; the place a model and effort would be passed.
- [`runner/migrations.ts`](/packages/server/src/runner/migrations.ts): the sessions cache, with
  `agent` and `native_id`; a model and effort need columns there.
- [`runner/session-folders.ts`](/packages/server/src/runner/session-folders.ts): `create`,
  `featureSession`, `newSession`, `newChat` take an optional `runtime`.
- [`runner/instructions.ts`](/packages/server/src/runner/instructions.ts): the web UI's
  instructions, harness-neutral text; Codex takes them as `developerInstructions`.
- [`extensions/builtins.ts`](/packages/server/src/extensions/builtins.ts): the built-in `claude`
  runtime, its `command` setting, and `BUILT_IN_RUNTIMES`; `crates/core/src/extensions.rs`
  `BUILT_INS` and the manifests in `crates/core/extensions/`. A `codex` built-in joins both.
- [`web/src/RuntimePicker.tsx`](/packages/web/src/RuntimePicker.tsx) and
  [`runtimes.ts`](/packages/web/src/runtimes.ts): the runtime picker, an Astryx `Selector` shown
  only when two runtimes or more are on, used by the composer, the start dialog, and the new chat.
- [`web/src/HarnessMark.tsx`](/packages/web/src/HarnessMark.tsx) and
  [`SessionHeader.tsx`](/packages/web/src/SessionHeader.tsx): Codex's mark exists; the header shows
  the agent's name, not a model.
- [`web/sandbox/agent.ts`](/packages/web/sandbox/agent.ts): the sandbox already fakes a `codex` kind
  with Codex's mark.
- [`docs/extensions.md`](/docs/extensions.md#runtimes): the runtime contract as documented for
  extensions; it changes with the contract.

### The proposal's path and existing actions

- **Starting a session** (a chat, a feature's new session, a change's start, "Apply the answers"):
  the runtime picker sends `runtime` through `send-mutations.ts`, `change-starts.ts`,
  `session-moves.ts`, `mutations.ts`, `starts.ts`, and `commit-messages.ts`; the session row stores
  it as `agent`. A model and an effort would travel the same six paths.
- **A feature's automatic runs** (continues after a restart, a usage limit, or an early end; the run
  after a spec's approval, in a fresh session or not) go to the feature's latest session, and a
  fresh session keeps its runtime (`send-input.ts`, `session-folders.ts`). They have no model to
  keep today.
- **Resuming** a session reopens its process with `resume`; Claude takes `--model` again, Codex
  takes `model` on `thread/resume`, with a warning when it differs.
- **Stop** is `interrupt`: Codex's `turn/interrupt`. **Steering** a message into the running turn is
  `turn/steer`; **queueing** one has no Codex method on the stable surface (its `thread/queue/*` is
  experimental), so the adapter would hold the queue, and take a queued message back from it.
- **"Allow and retry"** and **"Allow all"** ([`allow.ts`](/packages/server/src/runner/allow.ts))
  reopen Claude's process with `--allowedTools` rules from `allowRule`. Codex has no such rules; its
  equivalent is approving a denied action with an unstable method.
- **Usage windows** in the sidebar follow the runtime of a feature's latest session; Codex reports
  the same two windows. **Limits** continue a run when they reset, which
  [Run lifecycle](../decisions/run-lifecycle.md) requires of every runtime.
- **Images**: Claude reads `[Image: <path>]` lines; Codex takes `localImage` inputs.
- **Turning a runtime off** in Settings, Extensions leaves its sessions read-only, as today.
- **Other features in flight**: none on another branch touches the runner.
  [Run options](../2026-11-08-run-options/proposal.md), a proposal in **Now**, plans "model and
  effort per step" with global defaults and per-feature overrides, on top of what this feature adds.

### Rules and their owners

- **Which runtime a session runs on**: `newSessionRuntime` in `runtimes.ts`, mirrored for the UI by
  `runtimeFor` in `web/src/runtimes.ts`. A model rule needs the same pair, or one home on the
  server.
- **A runtime's capabilities**: declared by each adapter, read by the UI through `Capabilities`.
- **Least permission**: [Agents](../decisions/agents.md), applied in `claudeArgs`.

### Likely changes

- Under every option: a Codex runtime (`runner/codex.ts`, `codex-events.ts`, `codex-limits.ts`), its
  built-in manifest and registration, a fake's model list, the contract's model list and options in
  `adapter.ts` and `docs/extensions.md`, the cache's columns, the six start paths, the picker, the
  session header.
- With a model change between turns: the composer's picker on an existing session, and Claude's
  `set_model` and `apply_flag_settings` control requests.
- With a remembered or configured default: a setting in the core's settings, or browser storage.
- Tests that guard changed behaviour: `runner/__tests__/runtimes.test.ts` (runtime choice),
  `web/src/__tests__/runtime-choice.test.ts`, `runner/__tests__/claude.test.ts` (`claudeArgs`),
  `extensions/__tests__/runtimes.test.ts`, and `__tests__/session-record.test.ts`.

## The proposal

### Model for Codex only, or for every runtime

The proposal says "select the model to use with Codex for a session", then "pick the harness, pick
the model" for every session. Claude Code takes a model as readily as Codex.

### Effort is not mentioned

Both agents treat reasoning effort as a second control beside the model, with levels that depend on
the model. Without it, every session runs on the user's configured effort.

### What "a model picker at the start of a session" leaves open

What is picked by default, whether the choice is remembered, and whether it can change once the
session runs. Automatic runs start sessions without a human at the picker.

### Codex's permissions

The proposal does not say how Codex runs. Its default sandbox cannot commit in a worktree (below),
and the user's own Codex configuration runs with `danger-full-access` and no approvals, which
[Agents](../decisions/agents.md) rules out for Uraeda's runs.

## Worth it and feasibility

**Gain.** A second agent for the same workflow, when one account is at its limit or another model
suits a step, and the model control every comparable product has. The runtime contract, the
extension system, the picker, and the mark were built for this.

**Cost.** One runtime the size of Claude's (about 1,100 lines with its events and limits), a model
and effort through the contract, the cache, six start paths, and the picker. App-server is labelled
experimental, and Codex changes fast: a new version can break the runtime, as Claude's can today.

**Outside behaviour, checked on this machine** (throwaway scripts outside the repository, Codex
0.163.0, a ChatGPT Plus account, about 0.1 % of the 5-hour window):

- `model/list` returned 10 models, 2 hidden, with efforts and defaults; `account/rateLimits/read`
  returned a 300-minute window at 6 % and a 10,080-minute window at 64 %.
- A thread started on `gpt-6-luna`, resumed in a new process on `gpt-6.1-terra`: the resume answered
  with the new model and a warning, "This session was recorded with model `gpt-6-luna` but is
  resuming with `gpt-6.1-terra`".
- `developerInstructions` were followed; `~/.codex/AGENTS.md` and the user's hooks loaded too.
- With `workspace-write`, `on-request`, and `auto_review`, a write outside the workspace went to the
  auto-reviewer, which approved it ("risk: low"), with `item/autoApprovalReview/*` notifications.
- `skills/extraRoots/set` with this repository's `skills/` folder listed `uraeda` from it, beside
  the user's own `~/.agents/skills/uraeda`: two skills of the same name.
- **In a git worktree, `git add` and `git commit` failed**: "Unable to create
  '…/main/.git/worktrees/wt/index.lock': Read-only file system". The agent reported it and stopped,
  without asking for an escalation. Adding the main checkout's `.git` as a writable root changed
  nothing: Codex keeps every `.git` read-only.
- With `developerInstructions` saying ".git is read-only and there is no network: run git writes and
  network commands with escalated permissions", the same request committed
  (`[feat 246275d] Add a.txt`) and ran `curl` to example.com: each escalation went to the
  auto-reviewer, which approved it in about 4 seconds ("risk: low, authorization: high"). The review
  is a model call, so it spends a little usage each time.

**Unverified**: whether a model the plan does not include fails at the first turn or at the start,
for both agents; it needs an account on another plan.

**Guards each permission option relaxes**, said as what an attacker could do:

- Network on in the sandbox: a web page or file the agent reads could make it send the project's
  code to any website, with no review of that call.
- Full access without approvals: the same text could make the agent delete or change any file on the
  machine, or read every credential, with no check at all.

## Approaches

### Reaching Codex

How Uraeda talks to Codex. Relies on [Codex app-server](#codex-app-server) and
[Codex alternatives to app-server](#codex-alternatives-to-app-server).

| Criterion                       | A. `codex app-server`        | B. `codex exec --json`     | C. `codex-acp` over app-server |
| ------------------------------- | ---------------------------- | -------------------------- | ------------------------------ |
| Runs the user's installed agent | yes                          | yes                        | yes, through `CODEX_PATH`      |
| Steer and stop a turn           | yes                          | no: one prompt per process | stop yes, steer by extension   |
| Model list and effort           | yes                          | no list; effort by `-c`    | yes                            |
| Limits and usage windows        | yes                          | tokens only                | only through `_meta`           |
| Skills from Uraeda's folder     | yes, `skills/extraRoots/set` | `.agents/skills` only      | not exposed                    |
| New dependency                  | none                         | none                       | an npm package                 |
| Stability                       | labelled experimental        | stable CLI                 | young, tracks app-server       |

### Codex's permissions

How much a Codex session may do without a human, as [Agents](../decisions/agents.md) asks: "the
least permission that still lets unattended steps finish". Relies on
[Codex sandbox and approvals](#codex-sandbox-and-approvals).

- **A. `workspace-write`, `on-request`, `auto_review`, network off, with instructions to escalate
  git writes and network calls**: each commit and push is reviewed; verified to work, but only as
  long as the agent follows the instructions and escalates.
- **B. The same, with network on**: pushes and installs run without review; commits still escalate.
- **C. `danger-full-access` with `never`**: everything works, as in the user's own configuration;
  breaks the Agents decision's MUST.

### Which runtimes take a model

[Model for Codex only, or for every runtime](#model-for-codex-only-or-for-every-runtime). A: every
runtime that declares a model list, Claude Code and Codex; B: Codex only.

### Effort

[Effort is not mentioned](#effort-is-not-mentioned). A: a separate control, the model's levels only;
B: no control, the agent's configured effort.

### The default model

What is picked before the human picks. Relies on
[What they have in common](#what-they-have-in-common), items 4 and 6.

- A. "Default", the agent's own default, every time, showing what it resolves to.
- B. The last pick, per runtime, remembered.
- C. A setting per runtime in Uraeda's settings file.

### Changing the model during a session

- A. From the composer, between turns, from the next turn on.
- B. Fixed when the session starts: another model means another session.

### The picker's shape

- A. One picker: the agent, then its models, then the effort, in one menu.
- B. Separate selectors side by side: agent, model, effort.

### Needs no choice

- **Harness fixed per session**: every product does it, and a session's agent transcript belongs to
  one agent.
- **The model list from the agent**: hardcoded lists go stale in every product that has one.
- **Showing the model that ran**: `result` already carries `models`; Codex's `thread/start` and
  `model/rerouted` say it.
- **Automatic runs keep the session's model and effort**: every start path must carry the choice.
- **Usage windows and limits**: Codex reports both, which the run lifecycle needs.
- **Images**: every Codex model takes images, through `localImage`.
- **Codex's sub-agents**: shown as tool calls; the sub-agent capability waits for a stable shape.
- **"Allow and retry" for Codex**: left out; its method is unstable.
- **Codex picks the thread ID**: the runner stores it from the first `init` instead of reading it as
  a clear.
- **One app-server process per session**: matches the contract, process groups, and stop.
- **Accessibility and phones**: the picker is an Astryx `Selector`, as the runtime picker is.

## Not checked

- OpenAI's Terms of Use page: openai.com answered 403. The clause on programmatic access is known
  only from search snippets and discussion quotes.
- OpenAI's blog post "Unlocking the Codex harness" (403): search snippet only, which calls
  app-server "our standard protocol".
- Codex's `/model` slash-command page (404 after the documentation moved).
- How Conductor and Emdash show a session's model: not documented, closed source.
- A model outside the user's plan, for either agent: no account on another plan.
