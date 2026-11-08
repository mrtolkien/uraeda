---
kind: feature
finished: 2026-11-09
pull-request: https://github.com/mrtolkien/uraeda/pull/114
supersedes:
  - 2026-11-08-extensions-system
---

# Record: Codex runtime + model settings

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-08, finished on
> 2026-11-09, in [its pull request](https://github.com/mrtolkien/uraeda/pull/114). Its full files
> are in git: `git log -- specs/2026-11-08-codex-runtime/`.

## What and why

Uraeda gets a second agent, Codex, run through the user's installed `codex` as Claude Code is
through `claude`, so a feature runs on whichever agent fits it or still has usage left. Every
session also starts on a model and an effort picked where it starts: "pick the harness, pick the
model". Uraeda needs to support more harnesses, and the model is the control every comparable
product has.

## Behaviour

- **Codex sessions.** Codex is the built-in `codex` extension, its one setting the command it runs.
  A session on Codex runs the workflow as Claude Code does: it answers, takes messages during its
  turn (steered into it, or queued and taken back), stops on Stop, commits, receives images by their
  paths, and continues after its 5-hour limit resets. Without `codex`, a message is refused with
  "Codex is not available on this machine."
- **Codex's permissions.** Every thread runs in Codex's `workspace-write` sandbox, network off,
  approvals on request, each escalation judged by Codex's auto-reviewer; the instructions tell Codex
  to escalate git writes, network calls, and writes in the extensions folder, and to retry a refused
  git command escalated. A thread whose applied permissions differ, whatever the user's
  `~/.codex/config.toml` says, does not run. Each review's verdict shows in the transcript, as
  "Automatic review approved (risk: low): …". Uraeda gives Codex the project's trust for the thread,
  so Codex never writes it into the user's configuration.
- **The session picker.** Where a session starts (a new chat, a feature's new session, a change's
  start dialog, "Apply the answers", the inbox's and decisions' chats), one button names what will
  run, defaults resolved: "Codex · GPT-6.1-Sol · Medium", the agent's name left to its mark on a
  phone. It, or `Space a`, opens the app's key picker in two steps: every agent's models, each
  agent's "Default" first and the pick marked "picked", searchable by words; then the picked model's
  efforts, "Default" first. A model without efforts skips the second step; a model or agent change
  keeps the effort only while the new model takes it.
- **What a session keeps.** A session keeps its agent and model for its whole life, its automatic
  runs and a feature's fresh build session included; until the human picks, the agent's own
  configured defaults apply. Its effort may change between turns from a running session's composer
  ("Effort · High"), from the next turn on: the turn at work keeps its effort. Another model means
  another session.
- **Refusals.** The server refuses a model the agent's list lacks, "Codex has no model gpt-6-astra:
  pick another", and an effort the model does not take, "GPT-6-Luna takes no Ultra effort: pick
  another", before anything is committed or sent; a model gone from the agent fails its turn with
  the agent's own words.
- **What ran.** A session's header names the agent, then the model and effort the agent last
  reported running on: "Codex · GPT-6.1-Sol · Medium".
- **Usage.** The sidebar's usage pane shows the windows of every agent that reported usage, in the
  runtimes' order, each on one line with its mark; the closed rail's bar shows the agent in view.

## Design

Codex joins as a built-in extension beside Claude Code, on the same runtime contract, through
`codex app-server`, Codex's own JSON-RPC protocol, as the Agents decision asks. The contract gains
optional parts, so extensions stay on API version 1: a model list, `{ models, defaults }`; a model
and an effort to open with; an effort change on an open process; and two events, `runsOn`, what the
agent runs on by names for people, and `notice`, a line of the agent's for the transcript.

- The contract, in [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts) and
  [`runner/events.ts`](/packages/server/src/runner/events.ts); effort names in
  [`runner/efforts.ts`](/packages/server/src/runner/efforts.ts); the process group, stderr, exit,
  and event queue both runtimes share, in [`runner/child.ts`](/packages/server/src/runner/child.ts).
- The one rule of what a session runs on, `newSessionPick` and `checkEffort`, in
  [`runner/picks.ts`](/packages/server/src/runner/picks.ts), called by every start path; the model
  lists, kept in memory and refreshed at most once a minute, by
  [`Runtimes`](/packages/server/src/runner/runtimes.ts); the effort applied as the next turn opens
  its process, through the runtime's effort change or a reopen, in
  [`runner/processes.ts`](/packages/server/src/runner/processes.ts).
- The session cache's `model`, `effort`, `ran_model`, and `ran_effort` columns, migration 11 in
  [`runner/migrations.ts`](/packages/server/src/runner/migrations.ts); a process opened without
  resume adopts the agent's first session ID rather than reading it as a clear, in
  [`runner/transcript.ts`](/packages/server/src/runner/transcript.ts).
- The Codex runtime: [`runner/codex.ts`](/packages/server/src/runner/codex.ts) (the adapter, its
  thread and turn parameters, instructions, models, trust),
  [`codex-rpc.ts`](/packages/server/src/runner/codex-rpc.ts) (the JSON-RPC channel, refusing Codex's
  requests at once), [`codex-turns.ts`](/packages/server/src/runner/codex-turns.ts) (turns,
  steering, the queue, efforts), [`codex-events.ts`](/packages/server/src/runner/codex-events.ts)
  and [`codex-limits.ts`](/packages/server/src/runner/codex-limits.ts) (notifications into events,
  windows, and limits), [`codex-permissions.ts`](/packages/server/src/runner/codex-permissions.ts),
  and [`codex-rollouts.ts`](/packages/server/src/runner/codex-rollouts.ts); its manifest
  [`crates/core/extensions/codex.toml`](/crates/core/extensions/codex.toml).
- Claude Code: `--model` and `--effort`, the effort changed with `apply_flag_settings`, and its
  models listed through a short process asking `list_models` and `get_settings`, leaving out models
  that would drop auto mode, in [`runner/claude.ts`](/packages/server/src/runner/claude.ts) and
  [`runner/claude-control.ts`](/packages/server/src/runner/claude-control.ts).
- The web UI: [`SessionPicker.tsx`](/packages/web/src/SessionPicker.tsx) on
  [`keys/KeyPicker.tsx`](/packages/web/src/keys/KeyPicker.tsx), wired by
  [`ComposerPicker.tsx`](/packages/web/src/ComposerPicker.tsx) and `useSessionPick` in
  [`runtimes.ts`](/packages/web/src/runtimes.ts); the usage pane in
  [`sidebar/Allowance.tsx`](/packages/web/src/sidebar/Allowance.tsx) and
  [`UsageWindow.tsx`](/packages/web/src/UsageWindow.tsx).
- `vp run validate:codex`,
  [`packages/server/scripts/validate-codex.ts`](/packages/server/scripts/validate-codex.ts), checks
  the runtime against the real Codex: a commit in a worktree, a steer, an interrupt, an image, the
  reported model, and the user's configuration left byte-identical.

## Replaced behaviour

- **With one runtime on, nothing showed where a session starts.** Guarded by no test: the button now
  always shows, for the model. `RuntimePicker.tsx` is gone.
- **The sidebar's usage pane showed only the runtime in view.** Guarded by no test.
- **A Claude Code session ran on whatever model and effort Claude Code was configured with.**
  Guarded by `claudeArgs`'s "no argument skips permissions or sets a model", in
  `packages/server/src/runner/__tests__/claude.test.ts`, rewritten as "the model and effort picked
  are arguments; none skips permissions".

## Gotchas

- Codex's sandbox instructions name `sandbox_permissions: "require_escalated"` and the retry of a
  refused git command, in `codexInstructions` of [`codex.ts`](/packages/server/src/runner/codex.ts):
  with a plainer wording, Codex 0.163 never escalated and gave up on `git add` in four turns out of
  four.
- The trust `config` override in [`codex.ts`](/packages/server/src/runner/codex.ts) exists because
  Codex appends `[projects."<main checkout>"] trust_level = "trusted"` to `~/.codex/config.toml` on
  every `thread/start` in a repository without an entry, whatever the other parameters, and its
  protocol has no trust parameter; it is the one free-form override, and gives the trust Codex
  itself would apply.
- A resumed Codex thread keeps the effort it last ran on, so a resumed thread on the default effort
  is sent the default explicitly, in [`codex-turns.ts`](/packages/server/src/runner/codex-turns.ts).
- Codex sends no `thread/settings/updated` on resume: what ran is read from the resume's answer, in
  [`codex.ts`](/packages/server/src/runner/codex.ts).
- Codex picks a thread's ID, so a process opened without resume adopts its first `init`'s ID, in
  [`transcript.ts`](/packages/server/src/runner/transcript.ts); a later different ID is still a
  `/clear`.
- Claude Code reports `claude-opus-5-5` for the `opus` row: the model's name is matched by
  `resolvedModel`, then `value`, in
  [`claude-control.ts`](/packages/server/src/runner/claude-control.ts).

## Questions

### Round 01

#### Q1: How much may a Codex session do without you?

**Answer:** A: Codex's `workspace-write` sandbox, network off, every escalation reviewed by its
auto-reviewer, with instructions to escalate git writes and network calls.

#### Q2: How should Uraeda talk to Codex?

**Answer:** A: through `codex app-server`, Codex's own protocol, over the user's installed `codex`.

#### Q3: Which agents get a model picker?

**Answer:** A: every runtime that lists its models, Claude Code and Codex now.

#### Q4: Should you also pick the reasoning effort?

**Answer:** A: the effort beside the model, among the levels that model takes.

#### Q5: What is picked before you choose?

**Answer:** A: "Default", the agent's own choice, every time, showing what it resolves to.

#### Q6: Can the model change during a session?

**Answer:** B: "If a user wants to change model, they should create a new session."

#### Q7: What should the picker look like?

**Answer:** A: one button showing the agent, model, and effort, opening a picker; the spec's review
made it the app's key picker, the model then the effort, opened by `Space a`.

#### Notes

- **Codex's usage windows and limits**: "If both Codex and Claude are running on two different
  features, both should show": the sidebar shows every agent's windows.

## Decisions

- [Agents](../decisions/agents.md), changed: each agent through its own protocol, never a wrapper
  package, and each action outside the worktree, the network included, reviewed before it runs.
- [Models](../decisions/models.md), new: a session keeps the agent and model it started with, the
  agent's defaults apply until the human picks, and the effort, picked among the model's, may change
  between turns.

## Changes after approval

- The spec's review: the effort changes between turns, and the picker is the app's key picker,
  opened by `Space a` (revision 2).
- The extensions folder is not writable in Codex's sandbox, against the spec's architecture: the
  Agents decision wants each action outside the worktree reviewed, and Uraeda runs what the folder
  holds, so writing an extension escalates and is reviewed.
- A thread runs only on the permissions Codex reports it applied, and Codex is given the project's
  trust in memory, so it never writes it to the user's configuration.
- A Codex run that commits without escalating ends before its gate and asks for the human, as the
  Run lifecycle decision changed on `main` says, not with a continue.
- On a phone, the picker's button leaves the agent's name to its mark, so Send stays in the
  composer; the sidebar's usage pane says each window on one line.
- Efforts carry no description, as the data model lists them.
- The Agents decision says Uraeda MUST NOT read an agent's settings, which the spec's "Default"
  resolution and the trust both read; an amendment, "MUST NOT change an agent's settings, nor read
  its credentials", waits for the human.

## Follow-ups

- Inbox, Deferred fixes: a session started on the agent's default model checks its effort changes
  against the agent's current default, not the model it runs on.
- Codex's sub-agents' token usage and cache writes follow shapes not yet seen from the real agent.
