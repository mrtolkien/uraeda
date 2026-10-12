---
status: approved
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Claude Code runner (triggered manually)

> [!NOTE]
>
> Approved on 2026-10-12.
>
> - **New decision, [agents](../decisions/agents.md).** How Uraeda runs agents:
>   - the installed `claude`, behind an adapter, never the SDK;
>   - `auto` mode;
>   - the server's copy of the skill as a plugin;
>   - one session per feature;
>   - a local SQLite cache. A
>     [proposed change](../decisions/stack.md#proposed-change-2026-10-12-claude-code-runner-triggered-manually-https-code)
>     to the stack decision drops its line about the SDKs. Its rules are unchanged.
> - **Your request to accept a blocked action, read one way.** A blocked action shows after the run,
>   with "Allow and continue": it starts a new run of the same session, with an allow rule for that
>   one action. A live prompt during the run would need a channel that Claude Code does not
>   document, so it is left out.
> - **Your note on models and effort, read one way.** The command-line tool cannot list its models
>   without the SDK's undocumented protocol, so the choices are the aliases Claude Code documents.
>   They are picked when the feature's first session starts.
> - **The SQLite cache you asked for** keeps session IDs, runs, and their parsed events, in the
>   repository's git folder. It uses Node's built-in `node:sqlite`: no dependency, but a release
>   candidate in Node 24.
> - **Commits on a feature wait while its agent runs.** Answering, approving, and editing are
>   refused, so the agent and you never write the same branch at once.
> - **The agent's messages show as plain text.** The stack decision forbids parsing markdown in the
>   UI.
> - **Risk tier `high`:** a new service that runs an agent with this machine's login, from any
>   allowed host. The plan waits for your review.

The web UI's committing actions can now start Claude Code on the feature's next step, and it works
until the next human gate. Each feature has one Claude Code session, resumed at every run, in the
feature's worktree. The feature page shows the run live, with its log, its cost, and a Stop button.
It replaces running a Claude Code session by hand at each step. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Commit and continue (P1)

Each action that commits and leads to an agent step offers two buttons: "Commit and continue", the
primary one, and "Commit only". Those actions are submitting answers, approving, requesting changes,
committing a proposal or a bug report, and starting a feature.

"Commit and continue" commits, then starts Claude Code on the feature's next step, in its worktree.
The agent works through every step that needs no human, and the run ends at the next human gate.
"Commit only" does what the single button does today.

Why this priority: it is the proposal's main path, and removes driving a session by hand
([Q3](clarifications-01.md#q3-how-far-does-one-trigger-run),
[Q6](clarifications-01.md#q6-how-do-commit-and-continue-and-commit-only-appear)).

Acceptance scenarios:

1. **Given** round 01 of `2026-10-12-claude-code-runner-triggered-manually-https-code` with every
   question answered, **When** the human clicks "Commit and continue", **Then** the round is
   committed as `discovery(claude-code-runner-triggered-manually-https-code): answer round 01`, and
   a run starts. Its message names step `spec`, `skills/uraeda/references/spec.md`, and "The human
   answered round 01 of the questions."
2. **Given** the same round, **When** the human clicks "Commit only", **Then** the round is
   committed, and no run starts.
3. **Given** a spec waiting for review, **When** the human approves it with "Commit and continue",
   **Then** the run's message names the step the core returns after the approval, and "The human
   approved the spec."
4. **Given** a run that commits the plan with `status: auto-approved`, then two implementation tasks
   and the final review, **When** the fake agent reports its result, **Then** the run is `done`, and
   the feature shows the gate the core reports.
5. **Given** a commit refused by a hook, after "Commit and continue", **When** the human clicks "Try
   again" and the commit succeeds, **Then** a run starts.
6. **Given** a server where `claude --version` fails, **When** the round page opens, **Then** it
   shows only "Submit answers", as today.

### US2: Follow and stop a run (P1)

The feature page shows an "Agent" panel while a run goes on and after it ends. The panel holds:

- the state: working on the step, done, failed, or stopped;
- the elapsed time;
- the session's estimated cost, and its model and effort;
- the log of the run: the agent's messages, its tool calls with their status, and system events like
  a resumed session or an API retry.

Stop ends the run, and keeps the session resumable. Home's "Agents at work" rows say whether an
agent is working. Earlier runs stay readable after a server restart.

Why this priority: a run can take hours, and a stuck run must be visible and stoppable
([Q5](clarifications-01.md#q5-what-does-the-ui-show-of-a-run)).

Acceptance scenarios:

1. **Given** a running run, **When** the fake agent emits the text "Reading the answers", **Then**
   the feature page's log shows it as an agent message within 1 second.
2. **Given** a running run, **When** the fake agent emits a `Bash` tool call `vp run ready`, and
   then its result after 2.5 seconds, **Then** the log shows a `Bash` row with target
   `vp run ready`, first running, then complete with "2.5 s".
3. **Given** a running run, **When** the human clicks Stop, **Then** the agent's process gets
   SIGINT, and the run shows "Stopped" once it exits.
4. **Given** a run whose process ignores SIGINT, **When** 10 seconds pass after Stop, **Then** the
   process gets SIGTERM.
5. **Given** a run that ended with a result costing `$3.10`, **When** the feature page opens,
   **Then** the panel shows "$3.10 this session".
6. **Given** two finished runs of a feature, **When** the server restarts and the feature page
   opens, **Then** the latest run's state and log show, and "Earlier runs" lists 1 run.
7. **Given** a running run, **When** Home opens, **Then** the feature's row in "Agents at work"
   shows "Working" and its step.

### US3: One session per feature (P1)

The first run of a feature starts a Claude Code session with an ID the server chooses. Every later
run resumes it. When the session is gone, the run starts a new one, and says so.

Why this priority: it is the proposal's model, and the session's context saves each step re-reading
everything ([proposal](proposal.md)).

Acceptance scenarios:

1. **Given** a feature with no session, **When** a run starts, **Then** the agent is started with
   `--session-id` set to a new UUID, and the cache records it for the feature.
2. **Given** a feature whose session `3f2c…` has a transcript, **When** a run starts, **Then** the
   agent is started with `--resume 3f2c…`.
3. **Given** a feature whose recorded session has no transcript, **When** a run starts, **Then** the
   agent is started with a new `--session-id`, and the log opens with "Started a new session: the
   previous one is gone."
4. **Given** a feature with a running run, **When** another run is requested for it, **Then** it is
   refused with "An agent is already working on this feature."

### US4: Start the agent without a commit (P2)

A feature waiting on an agent, with no run going, shows "Start the agent" in its panel. This covers
a run that failed or stopped, a feature started from the CLI, and this feature today.

Why this priority: otherwise such a feature can only move by hand
([settled](clarifications-01.md#settled-without-the-human)).

Acceptance scenarios:

1. **Given** a feature at step `discovery`, waiting on an agent, with no run, **When** the human
   clicks "Start the agent", **Then** a run starts, with "The human asked you to continue."
2. **Given** a run that failed with "Rate limit reached", **When** the human clicks "Try again",
   **Then** a run starts on the same session.
3. **Given** a feature waiting on the human, **When** its page opens, **Then** it shows no "Start
   the agent".

### US5: Pick the model and effort when work starts (P2)

Where a feature's first session can start, two selectors show next to the buttons, "Model" and
"Effort", both on "Your default":

- committing a proposal;
- starting a feature;
- "Start the agent" on a feature with no session yet.

The choice is kept for the session, and passed to every run of it.

Why this priority: the human's note asks for it, on starting work on a feature
([notes](clarifications-01.md#settled-without-the-human)).

Acceptance scenarios:

1. **Given** a draft being started, **When** the human picks "Opus" and "High", then "Commit and
   continue", **Then** the agent is started with `--model opus --effort high`, and the panel shows
   "Opus, high effort".
2. **Given** a session started with Opus and high effort, **When** its next run starts, **Then** the
   agent is started with `--model opus --effort high` again.
3. **Given** "Your default" for both, **When** a run starts, **Then** the agent is started with
   neither `--model` nor `--effort`.
4. **Given** a feature that has a session, **When** its spec page opens, **Then** no model or effort
   selector shows.

### US6: Allow a blocked action (P3)

`auto` mode can block an action, and the agent then goes on without it. When a run ends with blocked
actions, the panel lists each one with "Allow and continue". The button starts a new run of the same
session that allows that one action, and asks the agent to run it again.

Why this priority: the human asked for it, "if that's not too hard"
([Q2](clarifications-01.md#q2-what-may-the-agent-do-without-asking)).

Acceptance scenarios:

1. **Given** a run whose result lists a denied `Bash` call with command `gh pr create --draft`,
   **When** the run ends, **Then** the panel shows "Blocked by auto mode" and "Bash: gh pr create
   --draft".
2. **Given** that blocked action, **When** the human clicks "Allow and continue", **Then** a run
   starts with `--allowedTools "Bash(gh pr create --draft)"`, and the message "The human allowed
   `Bash(gh pr create --draft)`: run it again, then continue."
3. **Given** a denied `Write` to `/home/me/.ssh/config`, **When** the run ends, **Then** the button
   reads "Allow and continue" too, with the rule `Write(/home/me/.ssh/config)`.
4. **Given** the run started by "Allow and continue", **When** a later run starts, **Then** it
   passes no `--allowedTools`.

## Edge cases

- **`claude` is missing or not signed in.** The server checks `claude --version` at startup and
  every 60 seconds. Without it, only the "Commit only" behaviour shows, labelled as today. A run
  that fails on authentication shows the result's error, like "Not logged in. Run `claude` and sign
  in."
- **The plugin does not load.** The run fails with "The Uraeda skill did not load: <error>", from
  the `init` event's `plugin_errors`.
- **The step does not wait on an agent** when the run is asked for, for example because another
  device answered first. The run is refused with "Nothing for the agent: the feature waits on you."
- **The run ends, but the feature still waits on an agent.** The agent stopped early. The panel
  shows "Done", and "Start the agent".
- **A commit or a save is asked for a feature with a running run.** It is refused with "An agent is
  working on this feature. Stop it first, or wait for it." The UI shows the message where the action
  was. Drafts and priorities are not affected.
- **No event arrives for 30 minutes.** The server stops the run as Stop does, and marks it failed
  with "No activity for 30 minutes."
- **The server stops while runs go on.** It stops each one as Stop does, and marks them "Stopped:
  the server stopped." Runs found `running` in the cache at startup are marked "Stopped: the server
  stopped while it ran."
- **The cache is deleted, or cannot be opened.** It is created again empty. Features get new
  sessions, and their old logs are gone.
- **A line of the agent's output is not JSON, or has an unknown type.** It is skipped and counted.
  The log shows one system line per run: "Skipped 3 lines Claude Code printed that the runner does
  not read."
- **An API retry.** It shows as a system line, "Rate limited, retrying in 30 s."
- **A blocked write to a protected path**, like `.git/`, is reviewed by the classifier even with an
  allow rule. It can be blocked again, and then shows again.
- **Two features run at once.** Each has its own worktree and session. Both run.
- **A merged feature** has a record and no step for an agent. Its panel shows its earlier runs, and
  no button.
- **A bug** runs the same way: its folder, its branch `fix/...`, and its steps from the core.

## Success criteria

- **SC-001**: After "Commit and continue", the feature page shows "Working on <step>" within 2
  seconds, with the fake agent.
- **SC-002**: An event that reaches the server shows in an open feature page within 1 second.
- **SC-003**: Stop ends the process within 10 seconds of SIGINT, or with SIGTERM right after, and
  the next run of the feature passes `--resume` with the same session ID.
- **SC-004**: "Commit only" starts no process: the fake adapter records zero starts.
- **SC-005**: `vp run ready` passes in the Nix shell, which has no `claude`.
- **SC-006**: Every run passes `--permission-mode auto` and `--plugin-dir`, and never
  `bypassPermissions`: checked on the arguments the fake records, for every trigger.

## Design

### Approach

The server gains a runner. It asks the core for the feature's step and working directory, starts the
installed `claude` in that directory through an adapter, and reads its JSON events. It stores what
matters in a local SQLite cache, and publishes the run's state to the UI through fate's live
updates. The web UI adds the second button on committing actions, the model and effort selectors,
and an "Agent" panel built with Astryx's chat components. The agent's commits reach open pages
through the existing watcher, as any commit does.

Why this way: the human chose the installed tool, `auto` mode, a single run until the next gate, the
server's skill, a run view with a log, and two visible buttons
([Q1](clarifications-01.md#q1-how-does-the-server-run-claude-code) to
[Q6](clarifications-01.md#q6-how-do-commit-and-continue-and-commit-only-appear)). All of it becomes
the [agents](../decisions/agents.md) decision. Remote Control is out of this feature
([Q7](clarifications-01.md#q7-how-does-remote-control-get-turned-on)).

### Data

**The cache** is a SQLite database at `<git common dir>/uraeda/runner.sqlite`, opened with
`node:sqlite`. It is shared by every worktree, and never committed. Its schema version is
`PRAGMA user_version`, starting at `1`, and each upgrade is a numbered migration.

```sql
CREATE TABLE sessions (
  folder     TEXT PRIMARY KEY,   -- the feature or bug folder, `2026-10-12-...`
  session_id TEXT NOT NULL,      -- a UUID, chosen by the server
  model      TEXT,               -- `opus`, ... or NULL for the user's default
  effort     TEXT,               -- `low` ... `max`, or NULL
  created_at TEXT NOT NULL       -- ISO 8601, UTC
);
CREATE TABLE runs (
  id          INTEGER PRIMARY KEY,
  folder      TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  new_session INTEGER NOT NULL,  -- 1 when this run started the session
  trigger     TEXT NOT NULL,     -- see Trigger below
  step        TEXT NOT NULL,     -- the core's step name when the run started
  allowed     TEXT,              -- the allow rule of "Allow and continue", or NULL
  state       TEXT NOT NULL,     -- `running`, `done`, `failed`, `stopped`
  reason      TEXT,              -- why it failed or stopped, in the UI's words
  cost_usd    REAL,              -- the latest result's total_cost_usd: the session's total
  started_at  TEXT NOT NULL,
  ended_at    TEXT
);
CREATE TABLE events (
  run_id  INTEGER NOT NULL REFERENCES runs(id),
  seq     INTEGER NOT NULL,      -- 0, 1, 2, ... within the run
  at      TEXT NOT NULL,
  kind    TEXT NOT NULL,         -- `text`, `tool`, `system`, `denial`
  data    TEXT NOT NULL,         -- JSON, by kind, below
  PRIMARY KEY (run_id, seq)
);
```

Events are what the runner parsed from the agent's output, not its raw lines:

```ts
type RunEvent =
  | { kind: "text"; text: string } // an assistant text block, as written
  | {
      kind: "tool";
      id: string; // the tool_use id
      name: string; // `Bash`, `Read`, ...
      target?: string; // the command, the file path, the URL, the pattern
      status: "running" | "complete" | "error";
      durationMs?: number;
      output?: string; // the result's text, cut to its first 4,000 characters
    }
  | { kind: "system"; text: string } // "Resumed the session", retries, skipped lines, errors
  | { kind: "denial"; tool: string; target?: string; rule: string };
```

A tool event is updated in place when its result arrives. Subagent messages, those with a
`parent_tool_use_id`, are not logged in this feature: their parent tool call shows as running.

**A run's message** is one stream-json user line, written on stdin, after which stdin closes:

```
/uraeda:uraeda Continue the feature specs/<folder>/, on branch <branch>.
<trigger sentence>
Its next step is <step>: follow <reference>.
No chat session is attached: work until the next human gate, and commit every step. The commit is
the message.
```

**Trigger** and its sentence:

| Trigger    | From                            | Sentence                                                     |
| ---------- | ------------------------------- | ------------------------------------------------------------ |
| `answers`  | submitting answers              | The human answered round NN of the questions.                |
| `approval` | approving                       | The human approved the <spec, plan, or assessment>.          |
| `changes`  | requesting changes              | The human requested changes on the <spec, plan, assessment>. |
| `proposal` | committing a proposal or report | The human committed the <proposal or bug report>.            |
| `start`    | starting a feature              | The human started the feature.                               |
| `manual`   | "Start the agent", "Try again"  | The human asked you to continue.                             |
| `allow`    | "Allow and continue"            | The human allowed `<rule>`: run it again, then continue.     |

**Allow rules** come from a denial's tool and input:

| Tool                    | Rule                      |
| ----------------------- | ------------------------- |
| `Bash`                  | `Bash(<command>)`         |
| `Edit`, `Write`, `Read` | `<Tool>(<file_path>)`     |
| `WebFetch`              | `WebFetch(domain:<host>)` |
| any other               | `<Tool>`                  |

**The models and efforts offered** are the aliases Claude Code documents
([model configuration](https://code.claude.com/docs/en/model-config)):

- Model: "Your default", which passes nothing, then "Best" (`best`), "Fable" (`fable`), "Opus"
  (`opus`), "Sonnet" (`sonnet`), and "Haiku" (`haiku`).
- Effort: "Your default", which passes nothing, then "Low", "Medium", "High", "Extra high"
  (`xhigh`), and "Max".

**What fate serves.** Two new types:

- `Runner { id: "runner", available: boolean, version: string | null }`: whether `claude` works.
- `Run`: a run's row, plus its `log: RunEvent[]`. Each feature view gains `runs`, the IDs of its
  runs, newest first.

The runner publishes `live.update("Run", id)` at most every 250 ms while events arrive, and right
away when the state changes.

**The core and the binding** gain three reads. TypeScript computes none of them:

- `nextStep(repo, folder)`: the step, as `ura next` gives it. It includes `reference` and the pull
  request state from `gh`, with `unknown` when `gh` is missing.
- `workDir(repo, folder)`: the absolute path of the feature's working directory. It creates the
  worktree at `.worktrees/<branch>/` when none has the branch, as `place::reach` does.
- `readWorkspace`: gains `gitCommonDir`, the absolute path the cache lives under.

**Mutations.** `answers.submit`, `review.approve`, `review.requestChanges`, `text.commit`,
`feature.start`, and `commit.retry` gain an optional input:

```ts
continue?: { model?: string; effort?: string };
```

When it is set and the commit succeeds, the server starts a run. New mutations:

- `run.start({ folder, model?, effort? })`, for "Start the agent" and "Try again";
- `run.allow({ run, seq })`, for "Allow and continue";
- `run.stop({ run })`.

### Components

- **Core steps and places** ([`crates/core/src/api.rs`](/crates/core/src/api.rs),
  [`steps.rs`](/crates/core/src/steps.rs), [`actions/place.rs`](/crates/core/src/actions/place.rs)):
  `next_step` and `work_dir`, behind the git module. Binding wrappers in
  [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs), with the generated declarations.
- **Agent adapter** (`packages/server/src/runner/adapter.ts`): the interface.
  `start({ cwd, message, sessionId, resume, model?, effort?, allowed? })` returns an async iterable
  of `AgentEvent`, plus `stop()`. `AgentEvent` is the runner's own type: `init` (plugins, plugin
  errors), `text`, `toolStart`, `toolEnd`, `retry`, `result` (cost, subtype, errors, denials),
  `skipped`, `exit` (code). It depends on nothing else.
- **Claude Code adapter** (`packages/server/src/runner/claude.ts`):
  - It spawns `claude` with the flags of the [agents](../decisions/agents.md) decision, and
    `--verbose`.
  - It buffers stdout by line, and turns each stream-json message into `AgentEvent`s.
  - `stop()` sends SIGINT, then SIGTERM after 10 seconds.
  - It also checks `claude --version`, and whether a transcript exists. The transcript check looks
    for `<id>.jsonl` under `$CLAUDE_CONFIG_DIR` or `~/.claude/projects/*/`, without reading it.
- **Fake adapter** (`packages/server/src/runner/fake.ts`), for tests. It records each start's
  arguments, emits the events a test scripts, can ignore SIGINT, and can make a transcript appear
  missing.
- **Run cache** (`packages/server/src/runner/cache.ts`): the database, its migrations, and typed
  reads and writes for sessions, runs, and events. Nothing else opens the database.
- **Runner** (`packages/server/src/runner/runner.ts`):
  - It holds the running runs, one per folder.
  - `start(folder, trigger, options)` refuses a second run and a step that does not wait on an
    agent. It then reads the step and work directory, picks resume or a new session, writes the run,
    and builds the message.
  - It consumes the adapter's events into the cache and live updates, and enforces the 30-minute
    watchdog.
  - `stopAll()` runs when the server stops.
  - It is created in [`main.ts`](/packages/server/src/main.ts) and
    [`dev.ts`](/packages/server/src/dev.ts) with the Claude Code adapter, and in tests with the fake
    one, and passed to [`createApp`](/packages/server/src/app.ts) with the binding.
- **fate wiring** ([`packages/server/src/fate/`](/packages/server/src/fate/)): the `Runner` and
  `Run` sources, the `runs` field on features, the new mutations, and the `continue` input. The
  write guard refuses commits and saves on a folder with a running run.
- **Commit buttons** (`packages/web/src/CommitActions.tsx`, new): renders "Commit and continue" and
  "Commit only", or the page's single button when the runner is unavailable. It takes the commit
  function, and shows model and effort selectors when asked to. It is used by
  [RoundPage](/packages/web/src/RoundPage.tsx), [ReviewPage](/packages/web/src/ReviewPage.tsx), and
  [EditorPage](/packages/web/src/EditorPage.tsx). Each page keeps the choice for its "Try again".
- **Agent panel** (`packages/web/src/AgentPanel.tsx`, new): on
  [FeaturePage](/packages/web/src/FeaturePage.tsx), under the gate callout.
  - It shows the state with `StatusDot`, the elapsed time with `Timer`, and the cost.
  - It holds Stop, "Start the agent" (with the selectors when the feature has no session), "Try
    again", and the denials with "Allow and continue".
  - The log uses `ChatMessageList`. Texts are `ChatMessage` and `ChatMessageBubble`, as plain text
    with its line breaks. Tool calls are `ChatToolCalls`, with the output in a `CodeBlock` as
    `resultDetail`. System lines are `ChatSystemMessage`.
  - Earlier runs sit in a `Collapsible`.
- **Home** ([`Home.tsx`](/packages/web/src/Home.tsx)): an "Agents at work" row shows a "Working"
  badge while its feature has a running run.
- **Skill plugin** (`packages/server/plugin/`): `.claude-plugin/plugin.json` with
  `{ "name": "uraeda" }`, and `skills/uraeda`, a link to [`skills/uraeda`](/skills/uraeda/). It is
  the folder passed to `--plugin-dir`, so the skill is `/uraeda:uraeda`.

### Mockups

- [Runner mockups](mockups/runner.html), each state named in the user stories:
  1. the two buttons on a round of questions;
  2. a proposal with the model and effort selectors;
  3. a working run with its log;
  4. a run done at a gate, with a blocked action;
  5. a failed run;
  6. a feature waiting on an agent with no run;
  7. Home's "Agents at work".

### Error handling

- **Refused run:** the mutation returns `refused: <text>`, shown where the button was:
  - "An agent is already working on this feature."
  - "Nothing for the agent: the feature waits on you."
  - "Claude Code is not available on this machine."
- **A committing action on a feature with a running run** is refused: "An agent is working on this
  feature. Stop it first, or wait for it."
- **Failed run:** the panel shows the result's `errors`, or the last 20 lines of stderr when no
  result came, and "Try again".
- **Skill not loaded:** "The Uraeda skill did not load: <error>", and the run is stopped before its
  message is sent.
- **Cache errors:** logged on the server's stderr. A write that fails does not stop the run, and the
  UI keeps the in-memory state until the server restarts.

### Testing

Server tests run the real app and binding in process, against temporary repositories built from
[`fixtures/repo`](/fixtures/repo/), with the fake adapter and an in-memory cache. Web tests render
the app the same way. Timers are faked where the spec sets durations. Rust tests cover the new core
reads. The Claude Code adapter's parsing is a table-driven test over recorded stream-json lines in
`fixtures/claude/`. One manual check runs a real `claude` on a fixture feature before the pull
request.

| What                                                 | Test                                                     |
| ---------------------------------------------------- | -------------------------------------------------------- |
| US1 scenarios 1–3, SC-004                            | Server: mutations with `continue`, fake adapter's starts |
| US1 scenario 4                                       | Server: runner ends with the core's step                 |
| US1 scenario 5                                       | Server: `commit.retry` with `continue`                   |
| US1 scenario 6, unavailable `claude`                 | Web: round page with an unavailable runner               |
| US2 scenarios 1–2, SC-002                            | Web: feature page with a live run                        |
| US2 scenarios 3–4, SC-003                            | Server: stop, fake ignoring SIGINT, faked timers         |
| US2 scenario 5                                       | Web: panel's cost                                        |
| US2 scenario 6                                       | Server: cache reopened, runs read back                   |
| US2 scenario 7                                       | Web: Home with a running run                             |
| US3 scenarios 1–4                                    | Server: runner with and without a transcript             |
| US4 scenarios 1–3                                    | Web and server: "Start the agent", "Try again"           |
| US5 scenarios 1–4                                    | Web and server: selectors and recorded arguments         |
| US6 scenarios 1–4, allow rules                       | Server: denials and the rule table, table-driven         |
| Stream-json parsing, unknown and broken lines        | Table-driven: `fixtures/claude/` lines to `AgentEvent`s  |
| Plugin not loaded, failed run, watchdog, server stop | Server: fake adapter scripts, faked timers               |
| Commits refused during a run                         | Server: each committing mutation                         |
| `nextStep`, `workDir`, `gitCommonDir`                | Rust: core tests on fixture repositories                 |
| SC-001                                               | Web: time from click to "Working", fake adapter          |
| SC-005                                               | CI: `vp run ready`                                       |
| SC-006                                               | Server: arguments for every trigger                      |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- One session per feature, kept as a cache. The SQLite cache replaces the file
  `.git/uraeda/sessions.json` named there, as your answer to Q5 asked.
- Each run's message carries the step, its reference, and the trigger, since the system prompt is
  frozen at the first run.
- The step and the working directory come from the core, through the binding.
- The choice shows on submitting answers, approving, requesting changes, committing a proposal or a
  bug report, and starting a feature. "Try again" after a refused hook keeps it.
- A feature waiting on an agent gets "Start the agent".
- One run per feature at a time, features in parallel.
- Stop sends SIGINT, then SIGTERM; a server stop does the same to every run.
- A failed run shows its errors, and "Try again" resumes the session.
- Model and effort come from your settings, unless you pick them when work starts, as your note
  asked. The permission mode is passed at every run.
- No budget cap; each run shows the session's estimated cost.
- Commit messages and attribution follow the project's instructions, unchanged.
- The runner is reachable from the same hosts as every commit.
- Notifications are left to "Ping user when input is needed".
- The benchmarks' fresh session per step stays theirs to decide.
- The UI follows the UI improvements' decisions that are active when the plan is written.

Settled while writing this spec:

- **Blocked actions are allowed after the run, not during it.** A live prompt needs
  `--permission-prompt-tool`, whose stdio protocol is undocumented
  ([questions and approvals](discovery-01.md#questions-and-approvals-in-a-headless-run)). In `auto`
  mode, allow rules resolve before the classifier, except for protected paths
  ([permission modes](https://code.claude.com/docs/en/permission-modes)).
- **The models are a fixed list.** Listing them needs the SDK's control protocol, which the
  command-line tool does not document
  ([TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)).
- **Model and effort are picked once per session.** A resumed session keeps its model
  ([model configuration](https://code.claude.com/docs/en/model-config)), and the runner passes both
  at every run.
- **Interrupts use SIGINT, not the stdin control protocol**, which is documented only through the
  SDK ([headless](https://code.claude.com/docs/en/headless)). Stdin carries the run's single
  message, then closes.
- **Commits on a feature wait while its agent runs**, so the agent and the human never write the
  same branch at once. The core's write lock does not cover the agent's own `git`
  ([the code](discovery-01.md#important-reads)).
- **A transcript is checked by its file name only**, at the path the sessions documentation gives.
  Its content is never read ([sessions](https://code.claude.com/docs/en/sessions)).
- **Subagents' messages are not logged.** Their parent tool call shows as running.
- **The agent's text is plain text** in the log. The stack decision forbids parsing markdown in the
  UI.
- **Tool output is cut** to its first 4,000 characters in the cache.
- **The watchdog** stops a run after 30 minutes without an event.
- **`claude` is checked** at startup and every 60 seconds, so installing it needs no restart.
- **Runs and events are never deleted** by the runner. Deleting the cache file removes them all.

## Decisions

New, applied when this spec is approved:

- [Agents](../decisions/agents.md): the server spawns the installed `claude` behind an adapter, in
  `auto` mode, with the server's skill as a plugin, one session per feature, and a SQLite cache that
  is never committed.

Changed, applied when this spec is approved:

- [Stack](../decisions/stack.md): the consequence that named the SDKs now names the installed
  command-line tools. The rules are unchanged
  ([proposed change](../decisions/stack.md#proposed-change-2026-10-12-claude-code-runner-triggered-manually-https-code)).

Relied on:

- [Stack](../decisions/stack.md): the runner is TypeScript in the server, and reaches the core only
  through the binding. The UI gets runs through fate, uses Astryx, and parses no markdown. The host
  guard covers the new mutations.
- [Git](../decisions/git.md): the run works in the feature's worktree, from the core. The agent
  commits with the system `git`, with the user's hooks, and switches no checkout.
- [CLI](../decisions/cli.md): `nextStep` gives what `ura next --json` gives, from the same core
  function.
- [Toolchain](../decisions/toolchain.md): `vp run ready` covers the new tests, without `claude`.

## Constitution check

| Principle                            | Complies | Notes                                                                                                     |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | Runs start only on a human action, end at human gates, and stop on demand. Allowing an action is per run. |
| II. Git and plain text first         | yes      | The cache holds no workflow state: every step's result is a commit. The decision says so.                 |
| III. Asynchronous by default         | yes      | Losing the session or the cache costs a new session; the repository holds everything the step needs.      |
| IV. Review effort matches impact     | yes      | Runs end at the skill's gates, with their blocks.                                                         |
| V. Tools are optional                | yes      | "Commit only" keeps today's behaviour, and the workflow runs without the runner.                          |
| VI. Code is checked against the spec | yes      | Every scenario has a test. The adapter is a new abstraction, justified in the plan.                       |

## Risk tier

**High**: a new service that runs an agent with this machine's login from any allowed host, a new
local database, and new core reads.
