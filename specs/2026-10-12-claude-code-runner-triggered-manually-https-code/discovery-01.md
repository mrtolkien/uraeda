# Discovery, round 01: Claude Code runner (triggered manually)

## Summary

Products that drive Claude Code from a UI share one shape:

- **Launch:** they start the real Claude Code binary headlessly, either `claude -p` with JSON
  streamed in both directions or the Agent SDK, which runs the same binary.
- **Isolation:** each task gets its own git worktree.
- **Session:** they keep one conversation per task and resume it by its ID.
- **UI:** they show a live transcript with clear states (working, needs input, done, failed,
  stopped), and offer a Stop button that leaves the session resumable.
- **Permissions:** most skip permission prompts entirely. The more careful ones route approvals and
  questions to their UI.

They differ in four places: how they launch, what the agent may do without asking, how much of the
transcript they show, and whether the human can type follow-ups.

The [proposal](proposal.md) asks for the core of that shape, triggered by hand from the web UI:

- one Claude Code session per feature, resumed at each step;
- the Uraeda skill available to that session;
- a choice on every committing action: commit and continue the work, or commit only;
- a toggle for Remote Control.

Remote Control is the one part the headless modes do not offer. Every documented way to start it is
an interactive or server-mode session, and it needs a claude.ai subscription login.

The code has no runner yet. The server already commits through the core, and pushes every change
under `specs/` to open pages within about 2 seconds, agent commits included. The binding does not
expose the pieces a runner needs:

- the step's reference file;
- the pull request state;
- a call that returns, or creates, a feature's worktree.

## How other products do it

### Claude Code's own headless modes

- **Launch:** `claude -p` runs a prompt and exits. With `--output-format stream-json`, it prints one
  JSON event per line. The first is `system/init`, which carries the `session_id`; the last is
  `result`, which carries the cost, the turn count, and an error subtype if any
  ([headless](https://code.claude.com/docs/en/headless),
  [CLI reference](https://code.claude.com/docs/en/cli-reference)).
- **Streaming input:** `--input-format stream-json` keeps one process open. It takes messages and
  control requests, including interrupts, on stdin. The Agent SDK calls this streaming input mode
  and names it "the preferred way". Single-message mode has no interrupt and no queued messages
  ([streaming vs single mode](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)).
- **Stopping:** SIGTERM leaves the turn unfinished, with no result. SIGINT, or an interrupt over
  stdin, ends the turn cleanly. The session file stays either way
  ([headless](https://code.claude.com/docs/en/headless)).
- **`--bare`:** recommended for scripts, and planned as the default for `-p`. It skips hooks,
  skills, plugins, and CLAUDE.md, and accepts only an API key, never the subscription login
  ([headless](https://code.claude.com/docs/en/headless)).

### Claude Code's agent view

Anthropic's own multi-session UI ([agent view](https://code.claude.com/docs/en/agent-view)):

- **States:** working, needs input, idle, completed, failed, stopped.
- **Notifications:** sent through the `Notification` hook (`agent_needs_input`, `agent_completed`).
- **Replies:** a reply to a working session joins its queue.
- **Isolation:** each dispatched session works in its own worktree, and never pushes to main or
  merges.
- **Quota:** "Each session uses your subscription quota independently."

### Claude Code GitHub Actions

- **Launch:** the action is built on the SDK and takes any CLI flag through `claude_args`.
  Follow-ups are new `@claude` comments, and each run gathers its context again from the issue or
  pull request ([GitHub Actions](https://code.claude.com/docs/en/github-actions),
  [usage](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)).
- **Progress:** a single comment, updated with checkboxes as Claude works
  ([README](https://github.com/anthropics/claude-code-action)).
- **Credentials:** an API key, or a subscription token from `claude setup-token`.

### Claude Code on the web

- **Sessions:** each runs in an Anthropic-managed VM
  ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)).
- **Follow-ups:** messages typed while Claude works queue until it reads them, and can be taken
  back.
- **Permissions:** the mode is picked when the session is created, can be changed while it runs, and
  is restored on resume.
- **Quota:** parallel sessions share the account's rate limits, proportionately.

### Conductor

- **Launch:** it bundles its own Claude Code and Codex so that versions match, and reuses the Mac's
  Claude Code login by default ([docs](https://www.conductor.build/docs/),
  [FAQ](https://www.conductor.build/docs/faq)).
- **Isolation:** one git worktree per workspace, and the agent renames the branch to match its work
  ([workspaces and branches](https://www.conductor.build/docs/concepts/workspaces-and-branches)).
- **Permissions:** agents run with the user's own permissions, without a sandbox
  ([security](https://www.conductor.build/docs/reference/security-and-permissions)).
- **Review:** comments on the diff become attachments to the next message.

### Vibe Kanban

From its source
([claude.rs](https://raw.githubusercontent.com/BloopAI/vibe-kanban/main/crates/executors/src/executors/claude.rs)):

- **Launch:** a pinned `npx @anthropic-ai/claude-code@2.1.119`, run with
  `-p --output-format=stream-json --input-format=stream-json --include-partial-messages`. The prompt
  and the permission mode go in over stdin.
- **Permissions:** an approvals variant uses `--permission-prompt-tool=stdio` and sends every tool
  except reads to an approval UI. Otherwise it skips permissions, and only `AskUserQuestion` reaches
  the UI.
- **Pitfall:** enterprises that disable skipping permissions broke it until users found the
  approvals variant ([#2189](https://github.com/BloopAI/vibe-kanban/issues/2189)).
- **States:** Running, Idle, and Needs Attention, with sounds and browser push notifications
  ([sessions](https://vibekanban.com/docs/workspaces/sessions.md)).

### Sculptor

From its source
([agent wrapper](https://raw.githubusercontent.com/imbue-ai/sculptor/HEAD/sculptor/sculptor/agents/default/claude_code_sdk/agent_wrapper.py)):

- **Launch:**
  `exec claude --permission-prompt-tool stdio --output-format=stream-json --input-format stream-json --resume <id>`.
  The `exec` makes signals reach Claude Code.
- **Questions and plans:** it disables the built-in `AskUserQuestion` and `ExitPlanMode` and offers
  its own tools in their place.
- **Resume:** it checks a transcript before resuming it.
- **Pitfall:** plan mode is lost between `-p` invocations.

### Terragon

From the open-source snapshot it left at shutdown
([daemon](https://raw.githubusercontent.com/terragon-labs/terragon-oss/HEAD/packages/daemon/src/claude.ts)):

- **Launch:** `claude -p --resume <id>`, with the prompt passed through a temporary file, never as
  an argument.
- **Resume:** if the transcript is missing, it falls back to `--continue`.
- **Watchdog:** a process silent for 15 minutes is killed.
- **Follow-ups:** a new message kills the running process and resumes it with the message.
- **Repair:** after a kill, it writes an error tool result for each dangling tool call, so that the
  session can be resumed.

### opcode, Crystal, claude-code-webui, Happy

- **opcode** always runs `--dangerously-skip-permissions`. It reads `session_id` from `init`, and
  reads `cwd` from the transcript, because the encoding of project folder names "isn't reversible"
  ([claude.rs](https://raw.githubusercontent.com/getAsterisk/opcode/HEAD/src-tauri/src/commands/claude.rs)).
- **Crystal** skips permissions by default. Its approve mode is an MCP permission tool. It notes
  that worktrees do not see the main checkout's MCP configuration
  ([manager](https://raw.githubusercontent.com/stravu/crystal/HEAD/main/src/services/panels/claude/claudeCodeManager.ts)).
- **claude-code-webui** wraps each SDK message as NDJSON over one streaming HTTP response. An
  approval dialog built on `allowedTools` rules looped forever when a rule did not match
  ([chat.ts](https://raw.githubusercontent.com/sugyan/claude-code-webui/HEAD/backend/handlers/chat.ts),
  [#140](https://github.com/sugyan/claude-code-webui/issues/140)).
- **Happy** runs the interactive TUI while you are at the computer. When the phone takes over, it
  aborts the TUI and resumes the same session through the SDK, with a permission callback
  ([claudeRemote.ts](https://raw.githubusercontent.com/slopus/happy/HEAD/packages/happy-cli/src/claude/claudeRemote.ts)).

### Copilot coding agent and Cursor cloud agents

- **Copilot** runs one branch and at most one pull request per task, in an Actions VM capped at 59
  minutes. Steering messages are applied after the current tool call. Stopping keeps the commits
  already pushed
  ([about](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent),
  [tracking sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/track-copilot-sessions)).
- **Cursor** runs agents in isolated VMs on their own branch, as many in parallel as you want,
  behind a spend limit ([cloud agents](https://cursor.com/docs/cloud-agent)).

### What they have in common

Capabilities users of these products may expect, whether or not the proposal mentions them:

- One worktree per task, and a session per task that can be resumed, with a fallback when it cannot
- The agent's states shown live: working, needs input, done, failed, stopped
- A live transcript, or at least the current activity
- A Stop button that leaves the session resumable
- A choice of what the agent may do without asking, and questions or approvals answered from the UI
- Follow-up messages to a working or idle session
- Notifications when the agent finishes, fails, or needs input
- Several tasks in parallel, with their quota cost visible
- Cost and token estimates per run
- The user's own login or API key, never handled by the tool
- The agent never merges: the human reviews the pull request

## Standards and libraries

### Claude Code CLI

The installed version is 2.1.296, and every flag below was checked against `claude --help`.

**Sessions** ([sessions](https://code.claude.com/docs/en/sessions)):

- `--session-id <uuid>` lets the caller choose the ID before the first run. `--resume <id>`
  continues a session, and `--fork-session` branches it.
- Transcripts live in `~/.claude/projects/<cwd with non-alphanumerics as ->/<id>.jsonl`. Their
  format is internal and changes between versions. They are deleted silently after
  `cleanupPeriodDays`, 30 days by default
  ([settings](https://code.claude.com/docs/en/settings-reference#cleanupperioddays)).
- Since 2.1.223, resuming by ID searches every project on the machine, not only the current
  directory.
- `-p --resume` does not restore the permission mode, `--settings`, `--plugin-dir`, `--add-dir`, or
  `--mcp-config`: they must be passed again at every run.
- The system prompt, `--append-system-prompt` included, is recorded at the first request and reused
  until compaction. Instructions that change at each step must go in the message, not the system
  prompt.
- "If you resume the same session in two terminals without forking, messages from both interleave":
  nothing locks a session, so the caller must run one process per session at a time.

**Known bugs** around resuming:

- A session resumed after SIGTERM failed with "No conversation found"
  ([#12730](https://github.com/anthropics/claude-code/issues/12730)).
- `init` reported a new session ID on resume
  ([#58760](https://github.com/anthropics/claude-code/issues/58760)).
- A session started with `--worktree` resumed only with the same flag
  ([#28769](https://github.com/anthropics/claude-code/issues/28769)).

**Limits:** `--max-turns` and `--max-budget-usd`. The budget is a client-side estimate, and can be
exceeded. `total_cost_usd` on a resumed session includes the earlier runs, so results must not be
added up ([headless](https://code.claude.com/docs/en/headless),
[cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)).

### Permission modes

From [permission modes](https://code.claude.com/docs/en/permission-modes) and
[headless](https://code.claude.com/docs/en/headless).

**The modes:**

- `default` allows reads.
- `acceptEdits` adds file edits and simple file commands.
- `plan` blocks edits.
- `auto` lets a classifier review each action.
- `dontAsk` denies everything that is not allowed in advance.
- `bypassPermissions` allows everything. It is meant for isolated environments, and is refused as
  root.

**In `-p`:**

- Without a permission host, an action that would prompt is denied, and the run continues.
- The starting mode depends on whether feature flags were fetched (`default` or `auto`), so the mode
  must always be passed explicitly.
- In auto mode with no prompt tool, the action is skipped after 3 consecutive or 20 total classifier
  blocks, and Claude keeps working.

**Auto mode:**

- It is available on every plan, and needs Opus or Sonnet 4.6 or later, or Haiku 5.5.
- It cannot be set from a project's `.claude/settings.json`.
- It drops `--allowedTools Bash` as too broad.

**Denials:** they appear in `result.permission_denials`. No mode auto-approves `AskUserQuestion` or
explicit `ask` rules.

**Untrusted folders:** in `-p`, a project's hooks and `.mcp.json` servers run without the trust
dialog, but its `permissions.allow` rules are ignored
([permissions](https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder)).

### Questions and approvals in a headless run

- **`--permission-prompt-tool`** names an MCP tool that answers prompts in `-p`. Vibe Kanban and
  Sculptor pass `stdio`, and answer over the stream-json control protocol. Its request and response
  schema is not on the pages read ([CLI reference](https://code.claude.com/docs/en/cli-reference)).
- **`canUseTool`, in the Agent SDK,** receives both approvals and `AskUserQuestion`, and "can stay
  pending indefinitely" ([user input](https://code.claude.com/docs/en/agent-sdk/user-input)).
- **A `PreToolUse` hook returning `defer`** ends a `-p` run with `stop_reason: "tool_deferred"`. The
  caller collects the answer, resumes, and the hook allows the call with the answer. It works only
  when the turn made a single tool call ([hooks](https://code.claude.com/docs/en/hooks)).

Uraeda's own questions are files, not `AskUserQuestion`: a step that needs the human ends at a gate,
and needs no in-session channel.

### Skills and project instructions

From [skills](https://code.claude.com/docs/en/skills):

- **Where skills load from:** `~/.claude/skills/`, the project's `.claude/skills/` (from the working
  directory up to the repository or worktree root), the `.claude/skills/` of an `--add-dir` folder,
  and plugins (`--plugin-dir`, with names like `/plugin:skill`).
- **Worktrees:** a worktree without its own `.claude/skills/` loads the main checkout's skills.
- **No `.agents/skills/`:** no page read lists it as a location. `ura init` installs the skill there
  and links it from `.claude/skills/uraeda`
  ([Q15 of the CLI core](../done/2026-10-10-cli-core.md#q15-does-ura-init-install-the-skill)).
- **In `-p`:** a prompt that starts with `/skill-name` loads the skill.

Claude Code reads `AGENTS.md` as the project's instructions when there is no `CLAUDE.md`
([memory](https://code.claude.com/docs/en/memory#agents-md)). Headless sessions in this repository
therefore get its rules, its authorship rule included.

### Remote Control

From [Remote Control](https://code.claude.com/docs/en/remote-control):

- **What it does:** it connects claude.ai/code and the Claude app to a Claude Code process running
  on this machine. Work stays local, and the connection is outbound HTTPS.
- **How it starts:**
  - `claude remote-control`, a server mode that the phone drives, with `--spawn worktree`;
  - `claude --remote-control`, an interactive session;
  - `/remote-control` inside a session, which keeps its history;
  - `remoteControlAtStartup`, for interactive sessions.
- **Permissions:** prompts and questions are forwarded to the device, and wait there for an answer.
- **Requirements:** a Pro, Max, Team, or Enterprise plan, with a full claude.ai login. API keys,
  `setup-token` tokens, Bedrock, Vertex, and a custom `ANTHROPIC_BASE_URL` are refused.
- **Headless runs:** no page documents Remote Control for `-p` or an Agent SDK session.
  `claude --resume <id> --remote-control` combines two documented flags, but untested. The SDK's
  changelog mentions "SDK-hosted Remote Control sessions" without saying how to start one
  ([changelog](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md)).
- **Locking:** a second process that turns Remote Control on for the same conversation prints
  `Remote Control not started here`.

### Claude Agent SDK for TypeScript

From the [overview](https://code.claude.com/docs/en/agent-sdk/overview),
[TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript), and
[npm registry](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/latest).

**Package:**

- `@anthropic-ai/claude-agent-sdk` 0.3.296, published 2026-10-09, for Node 18 or later.
- Peer dependencies: zod 4, `@anthropic-ai/sdk`, and the MCP SDK.
- It bundles the matching Claude Code binary (v2.1.296) as one optional package per platform: the
  user's installed `claude` is not used unless `pathToClaudeCodeExecutable` points to it.

**`query()`:**

- It takes `cwd`, `resume`, `sessionId`, `forkSession`, `permissionMode`, `canUseTool`,
  `settingSources`, `plugins`, `skills`, `additionalDirectories`, `maxBudgetUsd`, `abortController`,
  and `env`. `env` replaces the environment instead of merging into it.
- It also takes `projectConfigRoot`, which reads the project's `.claude/` settings and skills from
  the main checkout while `cwd` is a worktree.
- Without `systemPrompt: {type: "preset", preset: "claude_code"}`, the session gets a minimal system
  prompt, without Claude Code's own instructions.

**Session helpers:** `listSessions` and `getSessionMessages` read transcripts through a supported
API ([sessions](https://code.claude.com/docs/en/agent-sdk/sessions)).

**Removed:** the V2 session preview, `unstable_v2_createSession`, was removed in 0.3.142.

### Credentials and Anthropic's terms

From [legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) and the
[Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview).

**What the terms say:**

- OAuth is for subscribers' "ordinary use of Claude Code and other native Anthropic applications".
- Developers building products, "including those using the Agent SDK, should use API key
  authentication". They may not offer claude.ai login, route requests through subscription
  credentials, or "collect, store, or intermediate Claude.ai credentials".
- Allowed explicitly: "an end user signing in to the unmodified Claude Code binary with their own
  Claude subscription, including where a platform hosts Claude Code".
- The Agent SDK overview: "Unless previously approved, Anthropic does not allow third party
  developers to offer claude.ai login or rate limits for their products, including agents built on
  the Claude Agent SDK."
- Pro and Max limits "assume ordinary, individual usage of Claude Code and the Agent SDK".

**How credentials are picked:** an API key in the environment wins over the subscription login in
`-p` ([authentication](https://code.claude.com/docs/en/authentication)).

Judgement: a local server that spawns the user's own installed `claude`, signed in with their own
account, is the case the terms allow. Embedding the SDK's bundled binary in a tool for other people,
on their subscription, is the case they restrict.

### OpenAI Codex SDK

- `@openai/codex-sdk` 0.162.1 wraps the `codex` CLI over JSONL
  ([README](https://raw.githubusercontent.com/openai/codex/main/sdk/typescript/README.md)).
- Threads: `startThread`, `resumeThread(id)`, and `runStreamed()`, with a `thread.started` event
  that carries the ID.
- No approval callback and no cost, only `approvalPolicy` and token counts.

Judgement: an ID, resume, an event stream, and cancel map onto both harnesses. Approvals and cost do
not.

## The code

### Important reads

**Rules that frame the feature:**

- [Constitution](../CONSTITUTION.md):
  - Principle III requires every step to be completable with a commit, and durable state to be
    recoverable from the repository. A session ID can only be a cache: losing it must mean a new
    session, never lost work.
  - Principle V requires the workflow to work without the runner, so "Commit only" always stays.
- [Stack decision](../decisions/stack.md):
  - Workflow logic stays in the core, and the server reaches it only through the binding.
  - The server listens on 127.0.0.1, and accepts the hosts in `URAEDA_ALLOWED_HOSTS`. Anyone who
    reaches a listed host reaches the server.
  - Its consequences expected "the official Claude Code and Codex SDKs" in the server.
- [Git decision](../decisions/git.md): its **Applies to** already names "the runner". Writes go
  through the system `git`, never with `--no-verify`, in the branch's worktree.

**The server:**

- [Server entry point](/packages/server/src/main.ts) and [app](/packages/server/src/app.ts): routes
  `/fate`, `/fate/live` (SSE), `/raw`, and `/mockups`, all behind
  [the guard](/packages/server/src/guard.ts). In development, a new route prefix must also be added
  to `SERVER_PATHS` in [dev.ts](/packages/server/src/dev.ts).
- [Mutations](/packages/server/src/fate/mutations.ts): the actions that commit and lead to an agent
  step are:
  - `answers.submit`, which leads to the spec;
  - `review.approve`, which leads to approval, the plan, implementation, or the fix;
  - `review.requestChanges`, which leads to a revision;
  - `feature.start`, which leads to discovery;
  - `text.commit`, for a proposal or a bug report;
  - `commit.retry`, which repeats any of these after a hook refused the commit.

  `priorities.commit` commits, but leads to no step.

- [Live updates](/packages/server/src/live.ts) publish each change the core's watcher reports
  ([watch.rs](/crates/core/src/watch.rs)). Agent commits in a worktree therefore reach open pages
  with no extra work.
- [fate sources](/packages/server/src/fate/source.ts): `fileSource` can serve a type kept in memory,
  like a run's state.

**The core:**

- [Steps](/crates/core/src/steps.rs): `Step` has `reference` (`skills/uraeda/references/<x>.md`) and
  the pull request state.
- [Views](/crates/core/src/view.rs): the binding's `StepView` keeps only `name`, `waitsOn`, `file`,
  and `task`.
- [Workspace](/crates/core/src/workspace.rs) computes steps without asking `gh`, so in the UI a
  feature with every task checked always reads as `pull-request`, waiting on an agent. Only
  `ura next` asks `gh` ([next.rs](/crates/cli/src/next.rs)).
- [Place](/crates/core/src/actions/place.rs): `reach` finds or creates a feature's worktree, but is
  internal to the core.
- [Binding declarations](/packages/binding/index.d.ts): 27 functions and `watch`, with no `next`, no
  `status`, and no worktree call.
- [API](/crates/core/src/api.rs): every write goes through one global lock. An agent committing with
  its own `git` in a worktree is outside it.

**The web UI:**

- Commit buttons:
  - [RoundPage](/packages/web/src/RoundPage.tsx): Submit answers;
  - [ReviewPage](/packages/web/src/ReviewPage.tsx): Approve and Request changes;
  - [EditorPage](/packages/web/src/EditorPage.tsx): Commit, and Start the feature.

  Each calls one mutation and shows the hook refusal banner on failure.

- [FeaturePage](/packages/web/src/FeaturePage.tsx) shows the gate callout with its one action.
  [Home](/packages/web/src/Home.tsx) and [Shell](/packages/web/src/Shell.tsx) list "Agents at work",
  read-only.
- Astryx 0.6.7 already ships `Switch`, `DropdownMenu`, `MoreMenu` (adaptive), `ButtonGroup`,
  `Spinner`, `StatusDot`, `Timer`, and `Chat`.

**Tests and dependencies:**

- Server and web tests run in process against temporary repositories built from
  [fixtures/repo](/fixtures/repo/). CI's Nix shell has no Claude Code, so tests need a fake agent.
- No `@anthropic-ai` package is a dependency anywhere. pnpm's `allowBuilds` and minimum release age
  in [pnpm-workspace.yaml](/pnpm-workspace.yaml) apply to any new dependency.

**Where the skill comes from:**

- This repository has no `.claude/` or `.agents/` folder. On this machine, Claude Code finds the
  skill through `~/.claude/skills/uraeda`, a link to the main checkout's `skills/uraeda`.
- A session in a feature worktree therefore uses the main checkout's skill, not the branch's.

### The proposal's path and existing actions

- **Trigger:**
  - The human submits answers, approves, requests changes, commits a proposal, or starts a feature.
  - Today the action commits, and the feature waits on an agent until someone runs one by hand.
  - With the feature, the action can also start the agent on the feature's next step, in the
    feature's worktree.
- **Run:**
  - The server picks the step from the core, as `ura next` does, and resumes the feature's session.
  - The session runs the step, then the next ones that need no human, and commits each one.
  - The UI follows through the existing live updates, and through the run's own state.
- **Gate:** the step ends at a human gate, as the skill says. The run ends, and the session stays,
  to be resumed at the next trigger.
- **A feature waiting on an agent with no action to take:** a run that failed, or a feature started
  from the CLI. Nothing commits there, so the feature needs a way to start the agent without a
  commit.
- **A hook refuses the commit:** `commit.retry` commits again, and the choice to continue must
  survive the retry.
- **The human acts while the agent works:**
  - Writes on the same branch are possible today: saving answers, or editing a proposal. The agent's
    commits would interleave with them.
  - A second trigger on the same feature would resume the same session twice, and the docs warn that
    the two would interleave in one transcript.
- **The server stops while a run is going:** the child process stops with it. A SIGTERM leaves the
  turn unfinished and, given #12730, maybe unresumable.
- **The session is gone:** it was deleted after 30 days, or the server's record of it was lost.
  Principle III allows a new session from the repository.
- **Merged features:** a feature finished and merged has a record, not a session. Its worktree stays
  until `ura clean`, and the session's transcript stays until Claude Code deletes it.

### Likely changes

Under every option:

- [`crates/core/src/view.rs`](/crates/core/src/view.rs) and
  [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): expose the step's `reference`, the pull
  request state, and a call that returns a feature's working directory, creating its worktree. This
  regenerates [`packages/binding/index.d.ts`](/packages/binding/index.d.ts).
- `packages/server/src/runner/`, new:
  - the run of one feature: start, follow, stop;
  - the Claude Code adapter, and a fake adapter for tests;
  - the session record.
- [`packages/server/src/fate/`](/packages/server/src/fate/): a run type for live state, and an
  option on the committing mutations, or a separate "continue" mutation.
- [`packages/server/src/env.ts`](/packages/server/src/env.ts) and [`.env.example`](/.env.example):
  the runner's settings.
- [RoundPage](/packages/web/src/RoundPage.tsx), [ReviewPage](/packages/web/src/ReviewPage.tsx),
  [EditorPage](/packages/web/src/EditorPage.tsx): the second commit option.
- [FeaturePage](/packages/web/src/FeaturePage.tsx), and the agents rows of
  [Home](/packages/web/src/Home.tsx): run state, Stop, and starting without a commit.
- [`specs/decisions/`](/specs/decisions/): a decision on how Uraeda runs agents.

Depending on the options:

- With the Agent SDK, [`packages/server/package.json`](/packages/server/package.json) and
  [pnpm-workspace.yaml](/pnpm-workspace.yaml) gain `@anthropic-ai/claude-agent-sdk` and its peers.
- With a pseudo-terminal for Remote Control, a native dependency like `node-pty`, or the system's
  `script` command.
- With the project's own skill install, a tracked `.claude/skills/uraeda` link in this repository.
- With a transcript in the UI, a run view in `packages/web/src/`, possibly built on Astryx `Chat`.

**Overlap with UI improvements** (`2026-10-12-ui-improvements`, waiting on its round 01 answers),
which touches the same pages:

- Its answered Q1 makes Astryx components and StyleX the rule, and removes `styles.css`.
- Its answered Q2 sets two layouts split at 768 px, with popovers on desktop and sheets on the
  phone.
- Its open Q3 proposes rules for inline status and toasts.

This feature's buttons, menus, and run status will follow the decisions it proposes, and both
features will change the same files.

**Overlap with Benchmarks** (backlog): a point its round settled without the human says each step is
a fresh session
([benchmarks](../backlog/benchmarks/clarifications-01.md#settled-without-the-human)). That is the
opposite of this proposal. Its open Q8 to Q10, on how agents are run, the runner's language, and
credentials, overlap with this feature's choices.

## The proposal

### Remote Control is not available in headless sessions

The proposal asks for "a toggle in the UI to enable remote control in the session if that's possible
with headless claude code". Nothing documents it:

- Every documented way to start Remote Control is an interactive session, or server mode driven from
  the phone.
- It needs a full claude.ai login, so it is unavailable with an API key.
- A second process cannot turn it on for a conversation that already has it.

The workable path is to resume the session interactively, under a terminal the server holds, while
no headless run uses it. That is undocumented in combination and untested.

### "A single claude code session for the whole feature" meets the 30-day cleanup and the constitution

Transcripts are deleted after 30 days by default, and may not survive a hard kill (#12730).
Principle III makes the repository the only durable state, so the session is a cache. The proposal
does not say what happens when the session is gone, or where its ID is kept.

### How far a trigger runs

The proposal's example messages name a single step: "Spec is approved, move to plan". The skill says
to continue with the next step in the same session when no gate stops it. After an approved spec,
that can run through the plan, when it is auto-approved, every implementation task, the final
review, and the pull request: hours of work. The proposal does not say which one it wants.

### What the agent may do without asking

The proposal does not say:

- `-p` denies anything that would prompt, so a step that runs `vp run ready`, `cargo`, or `gh` needs
  permission to do so.
- Most products skip permissions, which this machine allows outside a container.
- Anyone who reaches a host listed in `URAEDA_ALLOWED_HOSTS` could start an agent with the machine's
  credentials.

### "Make sure the claude code instance has access to the uraeda skill"

Several copies can serve:

- the user-level link this machine has, which points to the main checkout;
- a project install made by `ura init`, which this repository does not have;
- a copy passed by the server.

They differ in which version of the workflow runs, which matters in this repository, where feature
branches change the skill.

### Progress, follow-ups, and stopping are not mentioned

The proposal does not say how much of the session the UI shows, whether the human can write to the
session, or how a run is stopped. Every compared product has a Stop button and a transcript, and
most accept follow-ups. "Chat in the web UI" is already a separate entry in
[Next](../PRIORITIES.md).

### Starting without a commit

The proposal puts the choice on actions that commit. A feature waiting on an agent with nothing to
commit has no way to start a run: the current feature is one.

## Approaches

Criteria come from:

- the proposal: a single resumed session, the skill available, the choice on committing actions, and
  Remote Control;
- the constitution: III, a commit per step and state recoverable from the repository; V, tools are
  optional; VI, simple code with tests;
- the [stack decision](../decisions/stack.md): TypeScript server, logic in the core, local host
  guard;
- the [git decision](../decisions/git.md): worktrees, the user's hooks;
- Anthropic's terms on credentials.

### Launching Claude Code

How the server starts and talks to Claude Code. Relies on
[headless modes](#claude-codes-own-headless-modes), [the SDK](#claude-agent-sdk-for-typescript), and
[credentials](#credentials-and-anthropics-terms).

| Option                                                     | Dependency                                 | Which binary and login                           | Interrupt, follow-ups, approvals                                          | Remote Control                | Tests                   |
| ---------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------- | ----------------------- |
| A. Spawn the installed `claude -p`, stream-json in and out | None                                       | The user's own binary, settings, and login       | Interrupt and messages over stdin; approvals through the control protocol | Not documented                | Fake process or adapter |
| B. The Agent SDK's `query()`                               | SDK, zod, Anthropic and MCP SDKs, a binary | The bundled binary, unless pointed at the user's | Typed `interrupt()`, `canUseTool`, session helpers                        | Not documented                | Fake adapter            |
| C. The interactive TUI in a pseudo-terminal                | `node-pty` or `script`                     | The user's own                                   | Typed keystrokes; no structured events, the transcript read from disk     | `--remote-control` documented | Hard                    |

### The session

Where the feature's session ID lives, and what happens when it is gone. Relies on
[the CLI](#claude-code-cli) and [the path](#the-proposals-path-and-existing-actions).

| Option                                                                                | Survives a server restart | Committed                               | Start over                  |
| ------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------- | --------------------------- |
| A. A local file in the repository's git folder, never committed                       | Yes                       | No                                      | Remove the entry            |
| B. In the server's memory                                                             | No                        | No                                      | Restart the server          |
| C. A file in the feature's folder, committed                                          | Yes                       | Yes, but meaningless on another machine | A commit                    |
| D. Derived from the feature's folder name, passed with `--session-id`, stored nowhere | Yes                       | No                                      | Needs a counter, so storage |

Under every option, a missing transcript starts a new session, with the step's context from the
repository.

### Permission mode

Relies on [permission modes](#permission-modes) and
[questions and approvals](#questions-and-approvals-in-a-headless-run).

| Option                                         | Steps that run tests and `gh`          | Risk on this machine                    | Work                                 |
| ---------------------------------------------- | -------------------------------------- | --------------------------------------- | ------------------------------------ |
| A. `auto` mode                                 | Yes, unless the classifier blocks them | A classifier reviews each action        | None                                 |
| B. `bypassPermissions`                         | Yes                                    | Everything allowed, outside a container | None                                 |
| C. `acceptEdits` with an allowlist of commands | Only the commands listed               | Bounded by the list                     | A list to keep up to date            |
| D. Approvals answered in the web UI            | Yes, once approved                     | The human approves each new action      | A permission channel, an approval UI |

### Run length

Relies on [how far a trigger runs](#how-far-a-trigger-runs).

| Option                       | Matches the skill | Human time           | Cost of one trigger      |
| ---------------------------- | ----------------- | -------------------- | ------------------------ |
| A. Until the next human gate | Yes               | One trigger per gate | Unbounded until the gate |
| B. One step, then stop       | No                | One trigger per step | One step                 |

### The skill's source

Relies on [skills](#skills-and-project-instructions).

| Option                                                                        | Version that runs        | Works in other projects    | Change in this repository |
| ----------------------------------------------------------------------------- | ------------------------ | -------------------------- | ------------------------- |
| A. The project's own install, `.claude/skills/uraeda`, as `ura init` makes it | The feature branch's     | Yes, after `ura init`      | A tracked link            |
| B. The server's own copy, passed with `--plugin-dir`                          | The server's             | Yes, always                | None                      |
| C. The user's skills, `~/.claude/skills`                                      | Whatever the user linked | Only if the user set it up | None                      |

### The commit choice

How "Commit and continue" and "Commit only" appear. Relies on [the web UI](#important-reads), and
the layout rules proposed by [UI improvements](#likely-changes).

| Option                                                   | Clicks to continue | Clicks to commit only     | Risk of starting an agent by mistake |
| -------------------------------------------------------- | ------------------ | ------------------------- | ------------------------------------ |
| A. A split button: continue first, commit only in a menu | 1                  | 2                         | Higher                               |
| B. Two buttons side by side                              | 1                  | 1                         | Low                                  |
| C. One button, and a switch remembered per device        | 1                  | 1, once the switch is off | Hidden in the switch                 |

### What the UI shows of a run

Relies on [what they have in common](#what-they-have-in-common).

| Option                                                                  | What the human sees                | Work                    | Overlap with "Chat in the web UI" |
| ----------------------------------------------------------------------- | ---------------------------------- | ----------------------- | --------------------------------- |
| A. State, current activity, cost, a log of the run's messages, and Stop | Enough to follow and stop          | A run view              | None                              |
| B. State and Stop only                                                  | That it runs; the work, in commits | Small                   | None                              |
| C. A full chat: transcript and follow-up messages                       | Everything, and can steer          | A chat view and a queue | It is that feature                |

### Turning Remote Control on

Relies on [Remote Control](#remote-control).

| Option                                                                                                      | Works today             | Dependency             | Phone                               |
| ----------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------- | ----------------------------------- |
| A. A toggle that resumes the idle session interactively with Remote Control, in a terminal the server holds | Untested: a spike first | `node-pty` or `script` | Claude app, from anywhere           |
| B. Show the command to run it by hand, `claude --resume <id> --remote-control`                              | Yes, from a terminal    | None                   | Only after typing it on the machine |
| C. Leave Remote Control out of this feature                                                                 | Yes                     | None                   | No                                  |

### Needs no choice

- **One worktree per task:** the feature's worktree exists already, made by `ura start`, and the git
  decision requires it.
- **The run's states:** working, done, failed, and stopped come from the process and its `result`.
  "Needs input" is a human gate, which the core already reports.
- **Stop:** an interrupt first, then SIGINT, so the session stays resumable, under every option.
- **Several tasks in parallel:** worktrees isolate features, so one run per feature, with features
  in parallel, has nothing to share. The quota cost is the tradeoff.
- **Notifications:** "Ping user when input is needed" is a separate entry in Next.
- **Cost estimate:** `total_cost_usd` comes with each result. On a resumed session it is cumulative,
  so the latest result is the session's total.
- **Credentials:** with A in launching, the user's own binary and login, as the terms allow.
- **The agent never merges:** the skill's implementation and finish steps stop at the pull request.

## Not checked

- Whether `claude --resume <id> --remote-control` works on a session started with `-p`, and whether
  `/remote-control` works in a `-p` or SDK session: no page documents either, and no command was
  run.
- The request and response schema of `--permission-prompt-tool stdio`: not on the pages read.
- Which working directory a session resumed by ID from another directory runs in, outside the
  worktree case: not stated.
- The `SDKRateLimitEvent` fields, for showing subscription limits: not in the parts of the reference
  read.
- Conductor's launch method, notifications, and cost display: not on its pages.
- GitHub issues #4953, #18859, #16157, and webui #251 and #352: seen by title only, after the search
  rate limit.
