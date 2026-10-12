---
kind: feature
finished: 2026-10-12
pull-request: https://github.com/mrtolkien/uraeda/pull/5
---

# Record: Claude Code runner (triggered manually)

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-12, finished on
> 2026-10-12, in [its pull request](https://github.com/mrtolkien/uraeda/pull/5). Its full files are
> in git: `git log -- specs/2026-10-12-claude-code-runner-triggered-manually-https-code/`.

## What and why

The web UI's server drives Claude Code headlessly, so the human no longer runs a Claude Code session
by hand at each step. One session per feature is resumed at every run, with the Uraeda skill loaded.
Every UI action that commits and leads to an agent step offers to commit and continue the work, or
to commit only. A Remote Control toggle was asked for "if that's possible"; it was left out, since
no headless mode documents it.

## Behaviour

- **Commit and continue.** Each action that commits and leads to an agent step shows two buttons:
  - "Commit and continue" and "Commit only" on a round of questions and on a proposal or a bug
    report;
  - "Approve and continue" and "Approve only", and "Request changes and continue" and "Request
    changes only", on a review;
  - "Start and continue" and "Start only" for a draft.

  Continuing commits, then starts Claude Code on the feature's next step, in its worktree. The agent
  works through every step that needs no human, and the run ends at the next human gate. "Try again"
  after a refused hook keeps the choice. Without a working `claude`, each page keeps its single
  button.

- **Following a run.** The feature page's "Agent" panel shows:
  - the state: "Working on <step>", "Done: waiting for you", "Done", "Failed on <step>", or
    "Stopped";
  - the elapsed time, and "$<cost> this session", Claude Code's cumulative estimate;
  - the log: the agent's texts as markdown, its tool calls with target, status, duration, and output
    (cut to 4,000 characters), and system lines;
  - "Earlier runs", which stay readable after a restart.

  Home's "Agents at work" rows read "Working" while a run goes on.

- **Stopping.** Stop sends SIGINT, then SIGTERM 10 seconds later, and the session stays resumable. A
  run silent for 30 minutes is stopped as failed with "No activity for 30 minutes." A server that
  stops ends its runs the same way. Runs left by a server that crashed are marked "Stopped: the
  server stopped while it ran." at the next start.
- **One session per feature.** The first run starts a session with an ID the server chooses, and
  every later run resumes it. A session whose transcript is gone is replaced, and the log says
  "Started a new session: the previous one is gone." At most one run per feature at a time, with
  features in parallel. A second run is refused with "An agent is already working on this feature."
- **Writes wait during a run.** Commits and saves on a feature with a running run are refused with
  "An agent is working on this feature. Stop it first, or wait for it." Drafts and priorities stay
  writable.
- **Starting without a commit.** A feature waiting on an agent with no run going shows "Start the
  agent", and a failed or stopped run shows "Try again".
- **Blocked actions.** An action that `auto` mode blocked shows after the run, under "Blocked by
  auto mode", with the exact rule "Allow and continue" passes. The button shows only when a run can
  start. It starts a new run of the same session, with that one rule passed to that run only:
  - `Bash(<command>)`;
  - `Edit(//<path>)` for a write or an edit;
  - `Read(//<path>)`;
  - `WebFetch(domain:<host>)`;
  - the tool's name otherwise.
- **Model and effort.** The user's active Claude Code settings apply: the runner never passes a
  model or an effort.

## Design

The core gives the step, its reference, and the feature's worktree. The server's runner starts the
installed `claude -p` through an adapter, and keeps sessions, runs, and parsed events in a SQLite
cache. fate serves runs with live updates, and the web UI draws them with Astryx's chat components.

**The core and the runner:**

- **Core reads:** `next_step` and `work_dir` in [`crates/core/src/api.rs`](/crates/core/src/api.rs),
  bound as `nextStep` and `workDir` in [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs).
- **The adapter:** the interface in
  [`packages/server/src/runner/adapter.ts`](/packages/server/src/runner/adapter.ts), with its events
  in [`events.ts`](/packages/server/src/runner/events.ts) and the fake every test uses in
  [`fake.ts`](/packages/server/src/runner/fake.ts).
- **The Claude Code adapter,** [`claude.ts`](/packages/server/src/runner/claude.ts):
  - it spawns
    `claude -p --input-format stream-json --output-format stream-json --verbose --permission-mode auto --plugin-dir <plugin>`,
    then `--session-id` or `--resume`, and `--allowedTools` for an allowed action;
  - it writes the run's message on stdin, then closes it, and parses stdout line by line.

  The plugin is [`packages/server/plugin/`](/packages/server/plugin/), whose `skills/uraeda` links
  to the skill, so the message starts with `/uraeda:uraeda`.

- **The run cache,** [`cache.ts`](/packages/server/src/runner/cache.ts): `runner.sqlite` in
  `URAEDA_DATA_DIR` or the system's data folder, opened with `node:sqlite`.
  - Its rows are keyed by the main checkout's path and the feature's folder.
  - It runs in WAL mode, with a 5-second wait for locks.
  - Each run records the pid of its server, so a starting server stops only the runs of servers that
    are gone.
- **The runner,** [`runner.ts`](/packages/server/src/runner/runner.ts), with the message, trigger
  sentences, and allow rules in [`message.ts`](/packages/server/src/runner/message.ts). It covers
  the one-run rule, sessions, the run's lifecycle, stopping, and the watchdog.

**The server and the UI:**

- **fate:** `Runner`, `Run`, and `RunLog` pages of 100 events, in
  [`packages/server/src/fate/runs.ts`](/packages/server/src/fate/runs.ts). The mutations are
  `run.start`, `run.allow`, and `run.stop`, and the write refusal is in
  [`mutations.ts`](/packages/server/src/fate/mutations.ts).
- **Server wiring:** live updates are throttled to 250 ms per run, in
  [`live.ts`](/packages/server/src/live.ts). The runner starts in
  [`main.ts`](/packages/server/src/main.ts) and [`dev.ts`](/packages/server/src/dev.ts), and checks
  `claude --version` every 60 seconds.
- **The UI:**
  - [`CommitActions.tsx`](/packages/web/src/CommitActions.tsx) and
    [`runs.ts`](/packages/web/src/runs.ts) on the round, review, and editor pages;
  - [`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx) and
    [`RunLog.tsx`](/packages/web/src/RunLog.tsx) on the feature page;
  - the "Working" badge in [`Home.tsx`](/packages/web/src/Home.tsx).
- **Validation:**
  [`packages/server/scripts/validate-claude.ts`](/packages/server/scripts/validate-claude.ts), run
  with `vp run validate:claude`, checks the integration against the installed `claude` with six
  small runs. It is kept out of `vp run ready`.

## Questions

### Round 01

#### Q1: How does the server run Claude Code?

**Answer:** A: spawn the installed `claude -p` with stream-json in and out, one process per run,
behind an adapter, rather than the Agent SDK.

#### Q2: What may the agent do without asking?

**Answer:** A: `auto` mode, with its denials listed, and "a button in the webUI to accept it", "if
that's too hard, drop it"; "Auto has been pretty good for developing uraeda so far".

#### Q3: How far does one trigger run?

**Answer:** A: until the next human gate.

#### Q4: Which copy of the skill does the session use?

**Answer:** B: the server's own copy, passed with `--plugin-dir`.

#### Q5: What does the UI show of a run?

**Answer:** A: the state, activity, time, cost, a log, and Stop, with "the relevant Astryx
components", and the core information, the session ID and the parsed transcript, kept in a small
local database, SQLite.

#### Q6: How do "Commit and continue" and "Commit only" appear?

**Answer:** A: two buttons side by side, "Commit and continue" as the primary one.

#### Q7: How does Remote Control get turned on?

**Answer:** C: left out of this feature.

#### Notes

The human asked to fetch the available models and effort levels, and to pick them when work starts
on a feature. The spec offered the documented aliases instead, and the spec review dropped the
choice for the active settings.

## Decisions

- [Agents](../decisions/agents.md), new: the server spawns the installed `claude`, behind an
  adapter, in `auto` mode, with its own copy of the skill as a plugin. Each feature has one session,
  and the runs are kept in a SQLite cache in Uraeda's data folder, never committed.
- [Stack](../decisions/stack.md), changed: the UI may render an agent's messages with Astryx's
  `Markdown`. The consequence that named the agents' SDKs now names their command-line tools.

## Changes after approval

The spec review's comments, applied with the approval:

- **C1:** no model or effort selector: the active settings apply, so user story US5 was not built.
  Claude Code is noted as the first runner, not the recommended one for later features.
- **C2:** the cache moved from the repository's git folder to Uraeda's data folder.
- **C3:** agent messages render as markdown.
- **C4:** a validation script runs the real `claude`.

Rulings that change behaviour:

- **The button labels** name their action: "Approve and continue", "Start and continue", and so on
  (rulings R6 and R20).
- **"Allow and continue"** shows only when a run can start (R22). Its rule for files is
  `Edit(//path)` or `Read(//path)`, since Claude Code reads a single slash as relative and never
  consults `Write(...)` rules. The spec's `Write(/path)` example was wrong (R27).
- **Lines the runner does not show** produce no event, and only unknown lines are counted as skipped
  (R12).
- **The cache:** a locked cache falls back to memory for that server, and only a corrupt file is
  replaced (R26).

## Follow-ups

- **Remote Control**, interactive approvals during a run, and follow-up messages need a channel
  Claude Code does not document for headless runs.
- **A run can stay "running" until the server restarts** when the adapter's start throws, or its
  event stream rejects. The Claude Code adapter does neither today.
- **The write refusal** checks the running runs, not runs still reading their step: a commit can
  land while a run is being prepared.
- **An agent's process survives a server crash.** After the restart, a second run can start on the
  same session.
- **Stopping the server can wait forever** for a child that ignores SIGTERM.
- **The plugin check** reads `plugin_errors` only, not whether `uraeda` is in the loaded plugins.
- **`run.start`'s `file`** reaches the agent's message without a format check.
- **Stop gives no feedback** for up to 10 seconds.
- **Small cleanups:**
  - the stderr tail is cut twice;
  - `toolTarget` has an unused parameter;
  - `init.sessionId` is unused;
  - the cumulative cost across resumes is not checked by the validation script.
- **The fixture feature `2026-10-12-cli-tuis`** reports problems from the core's checks, so it is
  not used for real runs.
- **`AGENTS.md`** is not formatted on the default branch, which fails `vp check` and `vp run ready`.
