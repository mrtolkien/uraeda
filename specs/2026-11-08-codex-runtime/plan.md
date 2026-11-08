---
status: auto-approved
spec-revision: 2
---

# Plan: Codex runtime + model settings

**Goal:** sessions run on Codex as they do on Claude Code, and every session starts on the agent,
model, and effort picked where it starts, its effort changeable between turns.

**Architecture:** the [spec's architecture](spec.md#architecture), in these homes:

- **The runtime contract** (`runner/adapter.ts`, `runner/events.ts`) gains a model list, a model and
  an effort to open with, an optional effort change on an open process, and two events: `runsOn`,
  the model and effort the agent reports, and `notice`, a line of the agent's for the transcript, as
  Codex's review verdicts. All additions are optional: extensions stay on API version 1.
- **The session cache** owns the stored pick (`model`, `effort`) and what ran (`ran_model`,
  `ran_effort`), as the [data model](data-model.md) says. The transcript writes what ran from
  `runsOn`, and a process opened without `resume` adopts the agent's own ID from its first `init`.
- **`Runtimes`** (`runner/runtimes.ts`) owns each runtime's last model list, in memory, and its
  refresh, at most once a minute. Its records carry the list to the web UI.
- **`runner/picks.ts`** is the one rule of what a session runs on: the agent picked, else the first
  on; the model and effort picked, else none. It refuses a model the agent's list lacks and an
  effort the model does not take, for a new session and for an effort change alike. Every start path
  calls it through `session-folders.ts`; the fresh session of a build copies its latest session's
  three fields.
- **`Processes.open`** gives the session's model and effort to its runtime, and applies an effort
  changed since the process opened as the next turn starts: through `setEffort` when the process has
  it, else by reopening the process.
- **The Codex runtime** is three files beside Claude Code's: `codex-events.ts` (notifications into
  `AgentEvent`s), `codex-limits.ts` (rate limits into windows and limits), and `codex.ts` (one
  `codex app-server` per process, JSON-RPC, permissions, skills, queue, model list). It joins the
  built-ins as `codex`.
- **The Claude Code runtime** opens with `--model` and `--effort`, changes effort with
  `apply_flag_settings`, lists models through a short process, and reports `runsOn`.
- **The web UI** wires the existing `SessionPicker.tsx` in place of `RuntimePicker.tsx`; the header
  and the usage pane read the new fields.

Shared process plumbing, the process group, stderr's tail, the exit event, and the event queue,
moves out of `claude.ts` first, so Codex reuses it instead of copying it.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A server request from Codex the runtime does not handle**, such as a question to the user or an
   approval routed to the client, is answered with a JSON-RPC error at once, so a turn never hangs
   waiting for a client that does not answer. Task 7.
2. **Codex's `init` on a new thread** carries an ID Uraeda did not choose: it must not read as
   `/clear`, add no "cleared" line, and reset no token baseline; a later different ID in the same
   process still reads as a clear. Task 2.
3. **An effort changed while a turn runs**: the running turn's process is not touched; the next
   turn's open applies it once, and a runtime without `setEffort` is reopened only when the effort
   really differs. Task 3.
4. **A model list that fails to refresh** keeps the last one; a runtime that never listed has none,
   and a pick of a model is then refused. Task 3.
5. **Codex's sandbox never widens**: no code path passes `danger-full-access`, `never`, or network
   on, whatever the session or the user's `~/.codex/config.toml` says. Task 7.
6. **A Codex process killed by the server** takes its sandbox helpers with it: it runs in its own
   process group, signalled whole, as Claude Code's. Task 1 (shared plumbing) and task 7.
7. **A pick of another agent's model**, as an old page sending Codex with `opus`, is refused, not
   sent to Codex. Task 3.

## Global constraints

From the [Agents](../decisions/agents.md) decision:

- Every agent MUST be reached through one adapter, which keeps the agent's formats inside it and
  declares what the agent can do.
- Sessions, their turns, and their items MUST be stored and shown in one agent-neutral shape.
  Checked by the runner's tests.
- An agent MUST run with the least permission that still lets unattended steps finish: never with
  its permissions skipped, and each action outside its worktree, the network included, reviewed
  before it runs. Checked by the runner's tests.
- Uraeda MUST NOT read or change an agent's credentials or settings.
- Tests MUST reach agents through a fake adapter, never a real agent.
- A runtime SHOULD run the user's installed agent through the agent's own protocol, never a bundled
  agent, its SDK, or a wrapper package, where the agent's terms ask for it, as Claude Code's and
  Codex's do.

Reading the agent's configured defaults, Codex's `config/read` and Claude Code's `get_settings`, is
how the spec's "Default" is resolved; neither call writes, and `apply_flag_settings` changes only
the running process, not Claude Code's settings files (checked on Claude Code 2.1.319: the file's
modification time stayed).

From the [Models](../decisions/models.md) decision:

- A session MUST keep the agent and the model it started with, its automatic runs included. Checked
  by the runner's tests.
- A new session MUST start on the agent's own default model and effort until the human picks others.
  Checked by the runner's tests.
- Every runtime that lists its models MUST offer them where a session starts, beside its agent.
- An effort MUST be picked among the levels the model takes, separately from the model. Checked by
  the runner's tests.
- A session's effort MAY change between its turns, from its next turn on, its automatic runs
  following it.

From the [Extensions](../decisions/extensions.md), [Compatibility](../decisions/compatibility.md),
and [Settings](../decisions/settings.md) decisions, as the spec relies on them: Codex is a built-in
extension on the same runtime contract, which it can turn off; the contract grows without a new API
version, its additions optional; Codex's one setting, its command, lives in `config.toml` like
Claude Code's.

From the [Keyboard](../decisions/keyboard.md) decision:

- A shortcut MUST be declared in the key registry, and listened for nowhere else. Checked by a
  structural test.
- A key MUST NOT mean two things at once on one page. Checked by the registry's tests.

From the [UI components](../decisions/ui-components.md) decision, as the spec relies on it: the
picker is the app's key picker, `keys/KeyPicker.tsx`; the header and the usage pane keep theirs.

From the [Testing](../decisions/testing.md) decision: at the `early` stage, a feature MUST test
little beyond stored formats, git, security, contracts between the project's parts, pure logic with
many cases, and the reproduction of each bug fixed. A test of the web UI MUST guard behaviour that
is costly to lose and that using the UI would not show. The agent MUST review each changed view in
the running app before handing it over, in both themes and at a phone's and a desktop's width.

From the [Code quality](../decisions/code-quality.md) decision: functions stay within 100 lines,
files within 500, 7 parameters, depth 4 (`vite.config.ts`). A feature touching a marked function or
file splits it first, in a commit that only restructures it, and removes its marker. A new marker
MUST NOT be added unless a human approves it in the plan: this plan adds none.

Exact texts from the spec:

- Refusals: `Codex is not available on this machine.` (the existing `RUNTIME_REFUSALS.unavailable`),
  `Codex has no model gpt-6-astra: pick another`, `GPT-6-Luna takes no Ultra effort: pick another`.
- Effort names: Low, Medium, High, Extra high, Max, Ultra, for the IDs `low`, `medium`, `high`,
  `xhigh`, `max`, `ultra`; any other ID shows as given.
- The button: "Codex · GPT-6.1-Sol · Medium" where a session starts, "Effort · High" in a running
  session; the picker's default row "Codex · Default · GPT-6.1-Sol", marked "picked".
- The header: the agent's name, then the model and effort that ran: "Codex · GPT-6.1-Sol · Medium".
- The fresh session's line when a Codex thread file is gone: the existing `REPLACED` line.

Existing behaviour to preserve:

- A session runs only on its stored runtime, refused while it is off or unregistered
  (`sessionRuntime`, guarded by `runner/__tests__/runtimes.test.ts`).
- A fresh run keeps the runtime of the session it was sent to (`send.ts`, guarded by "a fresh run
  keeps the runtime of the session it was sent to" in `runtimes.test.ts`): it now keeps the model
  and effort too.
- Claude Code's arguments keep `--permission-mode auto` and never skip permissions (`claudeArgs`,
  guarded by `claude.test.ts`).

## Code read

- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts): `Capabilities`, `OpenOptions`,
  `Outgoing`, `AgentProcess`, `Adapter`. No model, no effort; `nativeId` chosen by Uraeda.
- [`runner/events.ts`](/packages/server/src/runner/events.ts): `AgentEvent`; `init` carries the
  agent's session ID and an optional `problem`; `usage` windows; `limit`; `tokens`; `result`.
- [`runner/runtimes.ts`](/packages/server/src/runner/runtimes.ts): `Runtimes` keeps entries with a
  status; `records()` builds `RuntimeRecord`; `newSessionRuntime`, `messageRuntime`, `runtimeState`
  choose and refuse runtimes.
- [`runner/session-folders.ts`](/packages/server/src/runner/session-folders.ts): `create`,
  `featureSession`, `newSession`, `newChat`, each taking `runtime?: string`, the only places a
  session row is created besides `send.ts`'s fresh session.
- [`runner/send.ts`](/packages/server/src/runner/send.ts) line 62: the fresh session after a spec's
  approval copies the latest session's `agent`; line 160 opens the process at a turn's start.
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts) `open`: builds `OpenOptions`
  from the row, resumes when `hasSession`, replaces a lost transcript with `REPLACED`; called at
  each turn's start by `send.ts`, `turns.ts`, and `allow.ts`.
- [`runner/transcript.ts`](/packages/server/src/runner/transcript.ts) `#init`: an ID different from
  the row's is a `/clear`, with the `CLEARED` line and a token baseline reset.
- [`runner/session-state.ts`](/packages/server/src/runner/session-state.ts): `Proc`, `REFUSALS`,
  `REPLACED`, `CLEARED`.
- [`runner/cache.ts`](/packages/server/src/runner/cache.ts) (498 lines),
  [`cache-rows.ts`](/packages/server/src/runner/cache-rows.ts): `SessionRow`, `toSession`,
  `createSession`, `updateSession` with `sessionColumns`; the only writers of the `sessions` table.
- [`runner/migrations.ts`](/packages/server/src/runner/migrations.ts): migrations by `user_version`,
  nine so far.
- [`runner/claude.ts`](/packages/server/src/runner/claude.ts) (424 lines; `open` carries a
  `max-lines-per-function` marker): `claudeArgs`, `ClaudeAdapter`, the process group, stderr's tail,
  the exit event, `EventQueue`.
- [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts): `parseLine`, the
  `system` `init` line's events.
- [`runner/fake.ts`](/packages/server/src/runner/fake.ts): `FakeAdapter`, the tests' and the
  sandbox's agent, with recorded `opens`.
- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts) (496 lines): the session manager's
  facade, `featureSession`, `newSession`, `newChat` taking `runtime?`.
- [`extensions/builtins.ts`](/packages/server/src/extensions/builtins.ts): `BUILT_IN_SERVER`,
  `BUILT_IN_RUNTIMES`, `claudeCommand`;
  [`crates/core/src/extensions.rs`](/crates/core/src/extensions.rs) `BUILT_INS` and
  [`crates/core/extensions/claude.toml`](/crates/core/extensions/claude.toml).
- The fate start paths, each passing `runtime?`: `fate/send-mutations.ts`, `fate/change-starts.ts`,
  `fate/session-moves.ts` (`newSession`), `fate/mutations.ts` (`newChat`), `fate/starts.ts`,
  `fate/commit-messages.ts`; `fate/sessions.ts` builds the `Agent` record and the session record;
  `fate/views.ts` declares the views' fields; [`limits.ts`](/packages/server/src/limits.ts)
  `RUNTIME_REFUSALS`, shared with the web UI.
- Web: [`SessionPicker.tsx`](/packages/web/src/SessionPicker.tsx) and its stories, the spec's mockup
  and the starting point; [`RuntimePicker.tsx`](/packages/web/src/RuntimePicker.tsx), used by
  `Composer.tsx` (`useComposerRuntime`), `StartChat.tsx`, `StartDialog.tsx`; `NewChangePage.tsx`
  sends `pickedRuntime`; [`runtimes.ts`](/packages/web/src/runtimes.ts) `runtimeFor`,
  `useRuntimePick`; [`SessionHeader.tsx`](/packages/web/src/SessionHeader.tsx) has a `runsOn` prop
  already; [`sidebar/Allowance.tsx`](/packages/web/src/sidebar/Allowance.tsx) shows the runtime in
  view, [`home/Usage.tsx`](/packages/web/src/home/Usage.tsx) every runtime that reported;
  [`keys/registry.tsx`](/packages/web/src/keys/registry.tsx) `useKeys`; `keys/KeyPicker.tsx` takes
  `start` already.
- [`docs/extensions.md`](/docs/extensions.md#runtimes): the runtime contract for extensions;
  [`CONTRIBUTING.md`](/CONTRIBUTING.md): `vp run validate:claude`, from
  [`packages/server/scripts/validate-claude.ts`](/packages/server/scripts/validate-claude.ts).
- Tests: Vitest through `vp test`, server tests under `packages/server/src/**/__tests__/`, with
  `testSessions` in `runner/__tests__/helpers.ts` (fake adapter as runtime `fake`, in-memory cache,
  fake timers); web tests under `packages/web/src/__tests__/`. Validation: `vp run fast` after each
  task, `vp run ready` before the push, `nix develop -c` around both.
- Outside behaviour, probed on this machine on 2026-11-08 with throwaway scripts in `/tmp`:
  `codex app-server` 0.163.0 answered `model/list` and `config/read` (`model`,
  `model_reasoning_effort`); a thread in a git worktree on `workspace-write`, `on-request`,
  `auto_review`, network off, with the escalation instruction, committed, the review arriving as
  `item/autoApprovalReview/completed` (`review.status`, `riskLevel`, `rationale`) and a
  `guardianWarning` line; `thread/settings/updated` gave the model and effort in force;
  `account/rateLimits/updated` gave `primary` and `secondary` with `usedPercent`,
  `windowDurationMins`, `resetsAt` in epoch seconds. Claude Code 2.1.319 answered `list_models`
  (`value`, `displayName`, `description`, `supportedEffortLevels`, `supportsAutoMode`, a `default`
  row first) and `get_settings` (`effective.model`, `applied.model`, `applied.effort`), and
  `apply_flag_settings` with `{ settings: { effortLevel: "high" } }` changed `applied.effort`.
  `codex app-server generate-ts --out <dir>` gives the protocol's types for the installed version.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| Abstraction or exception                                      | Why it is needed                                                                        | Simpler alternative rejected                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `runner/child.ts`, the shared process plumbing                | Claude Code's and Codex's runtimes both need the process group, stderr, exit, and queue | Copying 120 lines into `codex.ts`, two copies of the group's safety   |
| `runner/picks.ts`, the pick rule                              | One rule for six start paths, the fresh session, and the effort change                  | Checking in each fate path: the six would drift                       |
| `runner/efforts.ts`, effort names                             | Both runtimes name efforts the same, as the spec pins                                   | A table in each runtime                                               |
| `ModelList` on the runtime contract                           | The spec's architecture: any runtime that lists models feeds the picker                 | A Codex-only control, which Q3 declined                               |
| The `runsOn` and `notice` events                              | What ran (SC-005) and Codex's review verdicts (US1) need an agent-neutral event         | Reading Codex's fields in the transcript, against the Agents decision |
| Splitting `claude.ts`'s `open`, `cache.ts`, and `sessions.ts` | Each is at its limit, and this feature grows them                                       | A new marker, which needs the human's approval                        |

## Test map

The server tests run the session manager on the fake adapter, an in-memory cache, fake timers, and
the real binding (`testSessions`); the runtimes' parsers are tested on recorded agent lines. No test
runs a real agent: `vp run validate:codex`, like `validate:claude`, checks the real Codex by hand.
The web UI is checked in the sandbox, as the Testing decision asks; its one test covers the picker's
pure rules.

| Spec item                                                              | Task | Check                                                                                                     |
| ---------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| US1 K1: pick Codex, the header names what Codex reported               | 3, 9 | `runtimes.test.ts` "a new session runs on the pick, and records what its agent reported"; sandbox review  |
| US1 K2: the commit escalates, the transcript shows command and verdict | 4, 7 | `codex-events.test.ts` "an escalated command and its review"; `validate:codex` commits in a worktree      |
| US1 K3: a message joins the running turn; Stop ends it stopped         | 7    | `validate:codex` steers and interrupts; none in unit tests: the JSON-RPC loop needs the real agent        |
| US1 more 1: a 5-hour limit continues at its reset                      | 4    | `codex-limits.test.ts` row "a turn refused by the 5-hour limit"; the run lifecycle's tests own continuing |
| US1 more 2: `codex` missing refuses with the unavailable text          | 7    | existing `checkAvailable` tests; `CodexAdapter.version` gives undefined (row of `codex.test.ts`)          |
| US1 more 3: an image reaches Codex by its path                         | 7    | `codex.test.ts` row "a message's images are local images"                                                 |
| US2 K1: the default row, picked, under the cursor; the button label    | 8    | `session-picker.test.ts` rows of `modelItems` and `pickLabel`; sandbox review                             |
| US2 K2: astra at High holds on automatic runs and a fresh session      | 3    | `runtimes.test.ts` "a fresh run keeps the runtime, model, and effort of the session it was sent to"       |
| US2 K3: an effort change applies from the next turn                    | 3    | `runtimes.test.ts` "an effort changed mid-turn applies to the next turn only"                             |
| US2 K4: a running session's composer offers the effort only            | 8    | sandbox review; `SessionPicker`'s `isStarted` path                                                        |
| US2 more 1–3: an effort reset by a model or agent change               | 8    | `session-picker.test.ts` rows of `withModel`                                                              |
| US2 more 4: only Claude Code on lists its models alone                 | 8    | `session-picker.test.ts` row of `modelItems`                                                              |
| US2 more 5: Escape on the effort step keeps the model                  | 8    | sandbox review: the pick is applied before the effort step opens                                          |
| US2 more 6: a phone shows the picker as a sheet                        | 8    | sandbox review at a phone's width: `KeyPicker` already does it                                            |
| US3 K1, K2: every agent's windows in the sidebar                       | 9    | sandbox review: two fake runtimes report windows; none, a UI layout at the `early` stage                  |
| US3 more 1: the closed rail's bar shows the agent in view              | 9    | sandbox review                                                                                            |
| Edge (High): a commit without escalating                               | 7    | the run lifecycle's gate continue, existing tests; the sandbox instructions in `codexThreadParams`'s test |
| Edge (High): a model outside the plan fails with the agent's words     | 4    | `codex-events.test.ts` row "a failed turn gives Codex's error"                                            |
| Edge (High): the sandbox cannot start, no fallback to full access      | 7    | `codex.test.ts` "a thread's permissions": no parameter widens the sandbox                                 |
| Edge: a model gone from the list at Send                               | 3    | `picks.test.ts` row "a model the list lacks"                                                              |
| Edge: a retired model fails the next turn                              | 4    | same row as a model outside the plan                                                                      |
| Edge: Codex signed out                                                 | 4    | same row as a model outside the plan                                                                      |
| Edge: Codex's thread file deleted                                      | 7    | `codex.test.ts` row of `hasSession`; existing `REPLACED` test in `sessions.test.ts`                       |
| Edge: the model list cannot be read                                    | 3    | `runtimes.test.ts` "a model list that fails keeps the last one"                                           |
| Edge: an effort changed while a turn runs                              | 3    | same test as US2 K3                                                                                       |
| Edge: an effort the model does not take                                | 3    | `picks.test.ts` row "an effort the model does not take"                                                   |
| Edge (Niche): Ultra's sub-agents show as tool calls                    | 4    | `codex-events.test.ts` row "a sub-agent call is a tool call"                                              |
| Edge (Niche): two Uraeda skills                                        | —    | none: Codex's own behaviour, noted in the spec                                                            |
| SC-001: a Codex step from message to commit                            | 10   | `validate:codex`                                                                                          |
| SC-002: the choice kept                                                | 3    | the US2 K2 and K3 tests                                                                                   |
| SC-003: exactly the agent's list, hidden ones out                      | 5, 7 | `claude.test.ts` row of `claudeModels`; `codex.test.ts` row of `codexModels`                              |
| SC-004: no wait for the list                                           | 3, 8 | records read the memory list; the refresh is fire-and-forget (sandbox review)                             |
| SC-005: the header names what ran                                      | 2, 9 | `cache.test.ts` "what a session runs on is stored"; sandbox review                                        |
| SC-006: both windows                                                   | 9    | sandbox review                                                                                            |
| SC-007: `Space a`, letters, Enter, Enter                               | 8    | the registry's conflict test; sandbox review                                                              |
| Review focus: unhandled server requests                                | 7    | `codex.test.ts` row "a server request gets an error"                                                      |
| Review focus: Codex's first `init`                                     | 2    | `sessions.test.ts` "a new agent session's own ID is adopted, not read as a clear"                         |
| Review focus: effort mid-turn                                          | 3    | same test as US2 K3                                                                                       |
| Review focus: a failed refresh                                         | 3    | same test as the unreadable list                                                                          |
| Review focus: the sandbox never widens                                 | 7    | `codex.test.ts` "a thread's permissions"                                                                  |
| Review focus: the process group                                        | 1    | the existing `claude.test.ts` process tests, run on `child.ts`                                            |
| Review focus: another agent's model                                    | 3    | `picks.test.ts` row "another agent's model"                                                               |
| Replaced: `claudeArgs` gains the model and effort                      | 5    | `claude.test.ts` "no argument skips permissions or sets a model" rewritten                                |
| Stored format: the four new columns                                    | 2    | `cache.test.ts` "a session made before the feature reads on the agent's defaults"                         |

## Waves

1. Task 1, alone: the structural splits every later task builds on.
2. Task 2, alone: the contract and the stored data.
3. Tasks 3, 4, and 5: the pick rule, Codex's parsers, and Claude Code's runtime; no file in common.
4. Tasks 6 and 7: the fate paths and Codex's process; no file in common.
5. Task 8, alone: the web picker.
6. Tasks 9 and 10: the header and the usage pane, then the real-Codex validation and the docs; no
   file in common.

---

## Task 1: Split the units this feature grows

**Files:**

- Create: `packages/server/src/runner/child.ts`
- Create: `packages/server/src/runner/cache-sessions.ts`
- Create: `packages/server/src/runner/session-edits.ts`
- Modify: `packages/server/src/runner/claude.ts` (`open`, `EventQueue`, `groups`, `endWithServer`),
  `claude-events.ts` (`lines`), `scripts/validate-claude.ts` (its import of `lines`)
- Modify: `packages/server/src/runner/cache.ts` (`createSession`, `updateSession`, `sessionColumns`)
- Modify: `packages/server/src/runner/sessions.ts`
- Test: the existing `packages/server/src/runner/__tests__/*.test.ts`

**Interfaces:**

- Produces: `runner/child.ts` exports `EventQueue` (as today),
  `lines(chunks: AsyncIterable<Buffer>): AsyncIterable<string>` (moved from `claude-events.ts`), and
  `spawnGrouped(command: string, args: Array<string>, cwd: string): Child`, where
  `Child = { child: ChildProcessWithoutNullStreams; exited: Promise<Extract<AgentEvent, { type: "exit" }>>; signal(name: NodeJS.Signals): void; write(value: unknown): void }`:
  the process in its own group (not on Windows), ended with the server, its stderr's last 20 lines
  in the exit event, `missing` for an absent command, the gone-directory text kept word for word;
  `write` sends one JSON line to stdin, dropped once stdin has closed (R8). `cache-sessions.ts`
  holds the session row writes `cache.ts` delegates to, `insertSession(db, row: NewSession)` and
  `writeSession(db, id, fields: SessionFields)` with `sessionColumns`, as `cache-tokens.ts` does for
  tokens: a new stored field goes in `NewSession`, `SessionFields`, and `sessionColumns`.
  `session-edits.ts` holds the human's edits of a session, `rename`, `archive`, `seen`, and
  `dismiss`, as plain functions `(context, onChange, row, ...)`: `setEffort` joins them (R9).
  `sessions.ts` keeps its public methods and signatures.

- [x] **Step 1: Move the process plumbing out of `claude.ts`.** `ClaudeAdapter.open` uses
      `spawnGrouped` and `EventQueue` from `child.ts`; remove its `max-lines-per-function` marker.
      No behaviour changes.
- [x] **Step 2: Move `createSession`'s and `updateSession`'s SQL into `cache-sessions.ts`,** the
      cache's methods keeping their signatures, so `cache.ts` has room for the new fields.
- [x] **Step 3: Move one cohesive group out of `sessions.ts`** (the human's edits, `rename`,
      `archive`, `seen`, `dismiss`, R9) into a module of plain functions, `session-edits.ts`, as
      `session-folders.ts` is, the facade delegating, so it has room for `setEffort`.
- [x] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS, no new lint marker, `claude.ts` under 400 lines.
- [x] **Step 5: Commit**

```bash
git add packages/server/src/runner/
git commit -m "refactor(codex-runtime): share the agent process plumbing, split the cache and the session manager"
```

## Task 2: The contract and the stored data

**Risky:** changes the stored format of the session cache, and the rule that reads a new agent
session ID as `/clear`.

**Files:**

- Create: `packages/server/src/runner/efforts.ts`
- Modify: `packages/server/src/runner/adapter.ts`, `events.ts`, `migrations.ts`, `cache-rows.ts`,
  `cache-sessions.ts`, `cache.ts`, `transcript.ts`, `session-state.ts` (`Proc`), `processes.ts`
  (`open`: the new `Proc` field only), `extension-api.ts` (re-exports)
- Modify: `docs/extensions.md` (Runtimes)
- Test: `packages/server/src/runner/__tests__/cache.test.ts`, `sessions.test.ts`

**Interfaces:**

- Produces, in `adapter.ts`:

```ts
export type ModelEffort = { id: string; name: string };
export type AgentModel = {
  description?: string;
  efforts: Array<ModelEffort>;
  id: string;
  name: string;
};
export type ModelList = {
  defaults: { effort?: string; model?: string };
  models: Array<AgentModel>;
};
// OpenOptions gains:  effort?: string; model?: string;
// AgentProcess gains: setEffort?(effort: string | undefined): void;  // from the next turn on
// Adapter gains:      models?(): Promise<ModelList>;
```

- Produces, in `events.ts`: `{ type: "runsOn"; model: string; effort?: string }`, names for people,
  and `{ type: "notice"; text: string }`, a line of the agent's, recorded as a `system` item.
- Produces, in `efforts.ts`: `effortName(id: string): string`, the spec's names, an unknown ID as
  given.
- Produces, on `SessionRow`: `model`, `effort`, `ranModel`, `ranEffort`, each `string | null`;
  `createSession` takes optional `model` and `effort`; `updateSession` takes `effort`, `ranModel`,
  `ranEffort`.
- Produces, on `Proc`: `adopts: boolean`, true for a process opened without `resume`, until its
  first `init`.

- [x] **Step 1: Write the failing tests**

```ts
// cache.test.ts
test("a session made before the feature reads on the agent's defaults", () => {
  const cache = cacheAtVersion(9, { sessions: [sessionV9] }); // a database written by migration 9
  expect(cache.session(sessionV9.id)).toMatchObject({
    effort: null,
    model: null,
    ranEffort: null,
    ranModel: null,
  });
});

test("what a session runs on is stored", () => {
  const row = cache.createSession({ ...chat, effort: "high", model: "gpt-6-astra" });
  cache.updateSession(row.id, { effort: "max", ranEffort: "Max", ranModel: "GPT-6-Astra" });
  expect(cache.session(row.id)).toMatchObject({
    effort: "max",
    model: "gpt-6-astra",
    ranEffort: "Max",
    ranModel: "GPT-6-Astra",
  });
});

// sessions.test.ts
test("a new agent session's own ID is adopted, not read as a clear", async () => {
  // fake.autoInit = false; send a message; emit { type: "init", sessionId: "thread-1" }
  // expect the row's nativeId "thread-1", and no CLEARED item in the turn;
  // then emit { type: "init", sessionId: "thread-2" } in the same process: CLEARED is recorded.
});
```

The break each test catches:

- Before the feature: a migration that fails on old rows, or defaults them to a value.
- Stored: a field dropped by `toSession` or `updateSession`'s column map.
- Adopted: Codex's first thread ID read as `/clear`, with a "cleared" line in every new session; or
  a later real `/clear` no longer recorded.

- [x] **Step 2: Run them to check they fail**
  - Run:
    `nix develop -c vp test packages/server/src/runner/__tests__/cache.test.ts packages/server/src/runner/__tests__/sessions.test.ts`
  - Expected: FAIL, the new fields `undefined`, and a `CLEARED` item found.
- [x] **Step 3: Implement the contract, the migration, and the transcript's two rules.** Migration
      10 adds the four nullable columns to `sessions`. `Transcript.#init`: while `proc.adopts`, a
      different ID updates the row's `nativeId` silently and clears `adopts`; otherwise as today.
      `runsOn` writes `ranModel` and `ranEffort` (null without an effort) and calls `changed`;
      `notice` appends a `system` item to the running turn. `docs/extensions.md` documents the
      optional `models`, `setEffort`, `model`, `effort`, `runsOn`, and `notice`.
- [x] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/server/src docs/extensions.md
git commit -m "feat(codex-runtime): a session's model and effort in the contract and the cache"
```

## Task 3: What a session runs on

**Risky:** a rule every start path shares, and the reopening of processes on an effort change.

**Files:**

- Create: `packages/server/src/runner/picks.ts`
- Modify: `packages/server/src/runner/runtimes.ts` (model lists, `records`), `session-folders.ts`,
  `send.ts` (the fresh session), `processes.ts` (`open`), `sessions.ts` (`featureSession`,
  `newSession`, `newChat`, `setEffort`), `fake.ts` (a model list, `setEffort`),
  `packages/server/src/limits.ts` (`RUNTIME_REFUSALS`)
- Test: `packages/server/src/runner/__tests__/picks.test.ts`, `runtimes.test.ts`

**Interfaces:**

- Consumes: task 2's `ModelList`, `OpenOptions.model`/`effort`, `AgentProcess.setEffort`,
  `SessionRow` fields, `effortName`.
- Produces, in `picks.ts`:

```ts
export type SessionPick = { effort?: string; model?: string; runtime?: string };
export type Picked = { agent: string; effort: string | null; model: string | null };
/** The agent picked, else the first on; the model and effort picked, else null. Refused as the spec says. */
export function newSessionPick(runtimes: Runtimes, repo: string, pick?: SessionPick): Picked;
/** Refuses an effort the session's model, picked or the agent's default, does not take. */
export function checkEffort(
  runtimes: Runtimes,
  agent: string,
  model: string | null,
  effort: string | null,
): void;
```

- Produces, on `Runtimes`: `models(name: string): ModelList | undefined`;
  `refreshModels(names?: ReadonlyArray<string>): Promise<void>`, each runtime at most once a minute,
  a failure keeping the last list, a change calling `changed()`;
  `RuntimeRecord.models: ModelList | null`. Registration refreshes the new runtime; the server's
  start refreshes all (task 6, in `server.ts`). A refresh asked for within the minute waits for the
  ask in flight; `MODELS_REFRESH_MS` is the minute. `checkEffort` checks only against a model the
  last list holds
  ([R10](rulings.md#r10-an-effort-is-checked-against-the-models-the-last-list-holds)).
- Produces, in `limits.ts`: `RUNTIME_REFUSALS.noModel(runtime: string, model: string)` and
  `RUNTIME_REFUSALS.noEffort(model: string, effort: string)`, the spec's texts, `effort` given by
  its name.
- Produces, on `Sessions`: `featureSession(repo, folder, pick?: SessionPick)`,
  `newSession(repo, folder, pick?: SessionPick)`, `newChat(repo, pick?: SessionPick)` in place of
  their `runtime?` parameter;
  `setEffort(repo: string, session: string, effort: string | null): void`, checked by `checkEffort`,
  refused for a session not on this repository.
- Produces, on `FakeAdapter`: `models()` giving two models, one with efforts `low` to `max` and one
  without efforts, defaults on the first at `medium` (`fake-big` "Fake Big", `fake-small` "Fake
  Small", exported as `fakeModels()`); `modelList` and `modelsFail`, which a test changes;
  `efforts: Array<string | undefined>`, each `setEffort` call; `hasSetEffort`, false for processes
  without `setEffort`.
- Produces, on `Proc`: `effort: string | null`, the effort it opened with or was last changed to.

- [x] **Step 1: Write the failing tests**

```ts
// picks.test.ts: newSessionPick and checkEffort over a Runtimes with fake lists
test.each([
  // [what, pick, the result or the refusal]
  ["nothing picked: the first on, the agent's defaults", {}, { agent: "claude", effort: null, model: null }],
  ["a model and its effort", { effort: "high", model: "gpt-6-astra", runtime: "codex" }, { agent: "codex", effort: "high", model: "gpt-6-astra" }],
  ["a model the list lacks", { model: "gpt-6-astra", runtime: "claude" }, "Claude Code has no model gpt-6-astra: pick another"],
  ["another agent's model", { model: "opus", runtime: "codex" }, "Codex has no model opus: pick another"],
  ["an effort the model does not take", { effort: "ultra", model: "gpt-6-luna", runtime: "codex" }, "GPT-6-Luna takes no Ultra effort: pick another"],
  ["an effort on the default model, which takes it", { effort: "max", runtime: "codex" }, { agent: "codex", effort: "max", model: null }],
  ["a model with no list yet", { model: "x", runtime: "pi" }, "pi has no model x: pick another"],
])("%s", ...);

// runtimes.test.ts
test("a new session runs on the pick, and records what its agent reported", async () => {
  // send to a new chat with { runtime: "fake", model: "fake-big", effort: "high" }
  // expect fake.opens.at(-1) to include { model: "fake-big", effort: "high" };
  // emit { type: "runsOn", model: "Fake Big", effort: "High" }: the row's ranModel "Fake Big", ranEffort "High"
});

test("a fresh run keeps the runtime, model, and effort of the session it was sent to", async () => {
  // the existing R20 test, its session made with a model and an effort: the fresh session's row has them
});

test("an effort changed mid-turn applies to the next turn only", async () => {
  // a turn running; sessions.setEffort(repo, id, "max"): fake.efforts stays []
  // the turn ends; the next message: fake.efforts equals ["max"], and the process is the same one
  // with fake.setEffort removed: the next turn opens a new process with { effort: "max" }
});

test("a model list that fails keeps the last one", async () => {
  // fake.models resolves once, then rejects: runtimes.models("fake") still gives the first list
});
```

The break each test catches:

- The rule's rows: a pick sent unchecked, Codex accepting the bogus effort silently, a default
  replaced by a value, or another agent's model reaching Codex.
- Picked and reported: the model or effort not reaching `open`, or `runsOn` not stored.
- Fresh run: the build's fresh session losing the model, as T3 Code's delegated tasks did.
- Mid-turn: the effort sent into the running turn, or never applied, or the process reopened when
  `setEffort` exists.
- Failed refresh: the picker emptied by one failed call.

- [x] **Step 2: Run them to check they fail**
  - Run:
    `nix develop -c vp test packages/server/src/runner/__tests__/picks.test.ts packages/server/src/runner/__tests__/runtimes.test.ts`
  - Expected: FAIL, `Cannot find module '../picks.ts'`.
- [x] **Step 3: Implement the rule and its callers.** `session-folders.ts`'s `create` stores
      `newSessionPick`'s result; `send.ts`'s fresh session copies `agent`, `model`, and `effort`.
      `Processes.open` passes the row's `model` and `effort`, keeps the effort opened with on the
      `Proc`, and, reusing a process whose effort differs from the row's, calls `setEffort` or
      closes and reopens it. Keep `newSessionRuntime` for the callers that pick only a runtime, or
      fold it into `newSessionPick`, whichever leaves one rule.
- [x] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/server/src
git commit -m "feat(codex-runtime): pick what a session runs on, and change its effort between turns"
```

## Task 4: Codex's notifications and limits

**Files:**

- Create: `packages/server/src/runner/codex-events.ts`, `codex-limits.ts`
- Create: `packages/server/src/runner/__tests__/fixtures/codex-turn.jsonl`, recorded from a real
  turn with `validate:codex`'s probe or by hand, its paths and IDs made neutral
- Test: `packages/server/src/runner/__tests__/codex-events.test.ts`, `codex-limits.test.ts`

**Interfaces:**

- Consumes: task 2's `AgentEvent` (`runsOn`, `notice`), `effortName`.
- Produces:
  `class CodexEvents { constructor(cwd: string, names: (model: string) => string); read(message: CodexNotification): Array<AgentEvent> }`,
  stateful per process (text deltas by item, the current turn's ID for the caller), and
  `codexWindows(rateLimits): Array<UsageWindow>` and
  `codexLimit(rateLimits, error?): Limit | undefined` in `codex-limits.ts`.
  `CodexNotification = { method: string; params: unknown }`.

The mapping, from the probe and the generated types:

| Codex notification                                                                                    | Events                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `thread/started`                                                                                      | `init` with the thread's ID                                                                                                                         |
| `thread/settings/updated`                                                                             | `runsOn`: the model's name by `names`, the effort's by `effortName`                                                                                 |
| `item/agentMessage/delta`, `item/completed` agentMessage                                              | `textDelta`, then `text`                                                                                                                            |
| `item/reasoning/*`, reasoning items                                                                   | `activity` thinking, then `thought`                                                                                                                 |
| `commandExecution`, `fileChange`, `mcpToolCall`, `webSearch`, `collabAgentToolCall` started/completed | `toolStart` (kinds execute, edit, other, fetch, other with `subagent`), `toolEnd`                                                                   |
| `item/autoApprovalReview/completed`                                                                   | `notice`: "Automatic review approved (risk: medium): <rationale>", or "denied"                                                                      |
| `thread/tokenUsage/updated`                                                                           | `tokens` from `total`: input less cached, cached as `cacheRead`, output                                                                             |
| `account/rateLimits/updated`                                                                          | `usage` with `codexWindows`; `limit` when `rateLimitReachedType` is set                                                                             |
| `turn/completed`                                                                                      | `result`: `ok` for `completed`, `interrupted` for `interrupted`, the error's message for `failed`; a `usageLimitExceeded` error gives `limit` first |
| anything else                                                                                         | nothing, never `skipped`: Codex sends many notifications Uraeda has no use for                                                                      |

Windows: `primary` and `secondary`, IDs `five_hour` and `seven_day`, labels `5h` and `Week`, as
Claude Code's are named in `claude-limits.ts`, when their durations are 300 and 10,080 minutes, else
the duration (`60m`, labelled `1h`); `used` is `usedPercent / 100`; `resetsAt` from epoch seconds. A
limit is `session` for the 300-minute window, else `other`.

- [x] **Step 1: Write the failing tests**

```ts
// codex-events.test.ts, reading fixtures/codex-turn.jsonl and rows of hand-written notifications
test("an escalated command and its review", () => {
  const events = readAll(fixture("codex-turn.jsonl"));
  expect(events).toContainEqual(expect.objectContaining({ kind: "execute", target: expect.stringContaining("git commit"), type: "toolStart" }));
  expect(events).toContainEqual({ text: expect.stringMatching(/^Automatic review approved/), type: "notice" });
  expect(events).toContainEqual({ effort: "Low", model: "GPT-6-Luna", type: "runsOn" });
});
test.each([
  ["a failed turn gives Codex's error", turnFailed("The 'gpt-bogus-9' model is not supported when using Codex with a ChatGPT account."), { errors: ["The 'gpt-bogus-9' model is not supported when using Codex with a ChatGPT account."], ok: false }],
  ["an interrupted turn is a stop", turnInterrupted(), { interrupted: true }],
  ["a sub-agent call is a tool call", collabStarted(), { subagent: expect.anything(), type: "toolStart" }],
])("%s", ...);

// codex-limits.test.ts
test.each([
  ["both windows", rateLimits({ primary: [7, 300, 1794155269], secondary: [64, 10080, 1794205264] }), ...],
  ["a turn refused by the 5-hour limit", ..., { kind: "session", resetsAt: "..." }],
])("%s", ...);
```

The break each test catches: a renamed Codex field dropping commands or verdicts from the
transcript; the model's ID shown instead of its name; a failed turn read as done; a limit read as a
failure, so the run never continues.

- [x] **Step 2: Run them to check they fail**
  - Run:
    `nix develop -c vp test packages/server/src/runner/__tests__/codex-events.test.ts packages/server/src/runner/__tests__/codex-limits.test.ts`
  - Expected: FAIL, `Cannot find module '../codex-events.ts'`.
- [x] **Step 3: Implement both modules.** Read the installed version's generated types
      (`codex app-server generate-ts --out /tmp/codex-ts`) for the field names; keep Codex's types
      inside these files.
- [x] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/server/src/runner/codex-events.ts packages/server/src/runner/codex-limits.ts packages/server/src/runner/__tests__/
git commit -m "feat(codex-runtime): read Codex's notifications and limits"
```

## Task 5: Claude Code's model, effort, and list

**Files:**

- Create: `packages/server/src/runner/claude-control.ts` (control requests and their answers,
  `claudeModels`, `claudeRunsOn`), as `claude.ts` would pass 500 lines (R11)
- Modify: `packages/server/src/runner/claude.ts` (`claudeArgs`, `open`, `models`),
  `claude-events.ts` (control responses left to `claude-control.ts`)
- Test: `packages/server/src/runner/__tests__/claude.test.ts`

**Interfaces:**

- Consumes: task 2's contract and `effortName`; task 1's `child.ts`.
- Produces: `claudeArgs` adds `--model <id>` and `--effort <id>` when `OpenOptions` gives them;
  `ClaudeAdapter.models()`, through a short `claude` process (the same print-mode, stream-json
  arguments, no message sent, closed once answered, 10 seconds at most) asking `list_models` and
  `get_settings`; `claudeModels(listModels, getSettings): ModelList`, a pure function: the `default`
  row left out, models without `supportsAutoMode` left out, `value` as the ID, `displayName` as the
  name, efforts by `effortName`; defaults `effective.model` and `applied.effort`. The open process's
  `setEffort(effort)` sends `apply_flag_settings` with `{ settings: { effortLevel: effort } }`
  (`null` for the default), then `get_settings`; each `get_settings` answer, and one at open, gives
  `runsOn` with the model's name from one `list_models` per process, through
  `claudeRunsOn(listModels, getSettings)`. With no `effective.model`, the default model is the row
  of `applied.model`. The listing process adds `--no-session-persistence` and runs in the home
  folder.

- [x] **Step 1: Rewrite the replaced test, and write the list's**

```ts
test("the model and effort picked are arguments; none skips permissions", () => {
  const args = claudeArgs({ ...open, effort: "high", model: "sonnet" }, PLUGIN, IMAGES);
  expect(args).toEqual(expect.arrayContaining(["--model", "sonnet", "--effort", "high"]));
  expect(args).not.toContain("--dangerously-skip-permissions");
  expect(claudeArgs(open, PLUGIN, IMAGES)).not.toContain("--model");
});
test("claudeModels keeps the models that keep auto mode, without the default row", () => {
  const list = claudeModels(LIST_MODELS, GET_SETTINGS); // recorded answers, as in the probe
  expect(list.models.map((m) => m.id)).not.toContain("default");
  expect(list.models.find((m) => m.id === "no-auto")).toBeUndefined();
  expect(list.defaults).toEqual({ effort: "medium", model: "opus" });
  expect(list.models.find((m) => m.id === "opus")?.efforts.at(-1)).toEqual({
    id: "max",
    name: "Max",
  });
});
```

The break each test catches: the pick never reaching Claude Code, or a model offered that drops auto
mode, which an unattended run cannot answer.

- [x] **Step 2: Run them to check they fail**
  - Run: `nix develop -c vp test packages/server/src/runner/__tests__/claude.test.ts`
  - Expected: FAIL, `--model` not in the arguments.
- [x] **Step 3: Implement the arguments, the list, `setEffort`, and `runsOn`.**
- [x] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`, then `nix develop -c vp run validate:claude`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/server/src/runner/claude.ts packages/server/src/runner/claude-control.ts packages/server/src/runner/claude-events.ts packages/server/src/runner/__tests__/claude.test.ts specs/2026-11-08-codex-runtime
git commit -m "feat(codex-runtime): Claude Code's models and effort"
```

## Task 6: The start paths and the session's fields

**Files:**

- Modify: `packages/server/src/fate/send-mutations.ts`, `change-starts.ts`, `session-moves.ts`,
  `mutations.ts`, `starts.ts`, `commit-messages.ts`, `sessions.ts`, `views.ts`, `fate.ts`
- Modify: `packages/server/src/server.ts` (refresh the lists at start)
- Test: `packages/server/src/runner/__tests__/runtimes.test.ts` (the existing `change.start` row)

**Interfaces:**

- Consumes: task 3's `SessionPick`, `Sessions.featureSession`/`newSession`/`newChat`/`setEffort`,
  `Runtimes.refreshModels`, `RuntimeRecord.models`.
- Produces: each input that takes `runtime?: string` takes `model?: string` and `effort?: string`
  beside it, passed on as one `SessionPick`; a mutation
  `session.setEffort({ id, effort: string | null })`; a mutation `agent.refreshModels({})`, which
  starts the refresh and returns at once; the session record's fields `model`, `effort`, `ranModel`,
  `ranEffort`; the `Agent` record's runtimes with `models`.

- [ ] **Step 1: Extend the existing test.** The `change.start` row of `runtimes.test.ts` sends a
      model and an effort, and asserts the session's row has them.
- [ ] **Step 2: Run it to check it fails**
  - Run: `nix develop -c vp test packages/server/src/runner/__tests__/runtimes.test.ts`
  - Expected: FAIL, `model` null.
- [ ] **Step 3: Thread the pick through the six paths, and add the two mutations and the fields.**
- [ ] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add packages/server/src
git commit -m "feat(codex-runtime): every start path carries the model and effort"
```

## Task 7: The Codex runtime

**Risky:** a new agent running commands on the user's machine, under its own permission model.

**Files:**

- Create: `packages/server/src/runner/codex.ts`
- Create: `crates/core/extensions/codex.toml`
- Modify: `crates/core/src/extensions.rs` (`BUILT_INS`),
  `packages/server/src/extensions/builtins.ts` (`BUILT_IN_SERVER.codex`, `BUILT_IN_RUNTIMES`)
- Test: `packages/server/src/runner/__tests__/codex.test.ts`

**Interfaces:**

- Consumes: task 1's `spawnGrouped` (its `write` for JSON-RPC), `lines`, and `EventQueue`; task 2's
  contract; task 4's `CodexEvents`, `codexWindows`, `codexLimit`; `webUiInstructions` from
  `instructions.ts`.
- Produces: `class CodexAdapter implements Adapter` (`kind` `codex`, `name` "Codex", `icon`
  `uraeda:harness-openai`, capabilities: approvals false, images true, queue true, steer true,
  subagents false, takeBack true), its options as `ClaudeAdapterOptions` with `codexHome` in place
  of `configDir`;
  `codexThreadParams(options: OpenOptions, instructions: string): ThreadStartParams-shaped object`
  and `codexTurnParams(...)`, pure, for the test; `codexModels(modelList, configRead): ModelList`,
  hidden models left out, `displayName` as the name, `supportedReasoningEfforts` by `effortName`,
  defaults `config.model` and `config.model_reasoning_effort`.

What the process does:

- Spawns `codex app-server` with `spawnGrouped` in the session's directory; `initialize` with
  `capabilities.experimentalApi`, then `initialized`; `skills/extraRoots/set` with
  `<pluginDir>/skills` and the extensions' skill folders; then `thread/resume` (`excludeTurns`) or
  `thread/start`, both with the model, `cwd`, `approvalPolicy: "on-request"`,
  `approvalsReviewer: "auto_review"`, `sandbox: "workspace-write"`, and `developerInstructions`: the
  web UI's instructions, then a sandbox section saying that `.git` is read-only and the network is
  off, so git writes and network commands run with escalated permissions, which a reviewer approves.
- Each turn: `turn/start` with the input, `effort` when set, and `sandboxPolicy`
  `{ type: "workspaceWrite", writableRoots: [extensions folder], networkAccess: false }`. A message
  sent as `steer` during a turn is `turn/steer` with `expectedTurnId`; a `queue` message waits in
  the adapter's own queue, starts the next turn when the current one completes, and `takeBack`
  removes it with a `cancelled` event; an accepted message gives `accepted`. Images are `localImage`
  inputs.
- `interrupt` is `turn/interrupt`; `close` ends stdin once no turn runs, and the app-server exits;
  `setEffort` keeps the effort for the next `turn/start`.
- A request from the server (a message with an `id` and a `method`) is answered with a JSON-RPC
  error, "Uraeda does not answer <method>", at once.
- `hasSession(id)` looks for `<codexHome>/sessions/**/rollout-*-<id>.jsonl`; `version()` runs
  `codex --version`; `models()` runs a short app-server, `model/list` (every page) and
  `config/read`, 10 seconds at most.

- [ ] **Step 1: Write the failing tests**

```ts
test("a thread's permissions", () => {
  const params = codexThreadParams({ ...open, model: "gpt-6-astra" }, "instructions");
  expect(params).toMatchObject({ approvalPolicy: "on-request", approvalsReviewer: "auto_review", model: "gpt-6-astra", sandbox: "workspace-write" });
  expect(params.developerInstructions).toMatch(/escalated permissions/);
  expect(JSON.stringify(params)).not.toMatch(/danger-full-access|"never"/);
  expect(codexTurnParams(turn).sandboxPolicy).toMatchObject({ networkAccess: false, type: "workspaceWrite" });
});
test.each([
  ["a message's images are local images", ...],
  ["a server request gets an error", ...],          // through a stand-in `codex` script on stdio
  ["codexModels leaves hidden models out", ...],
  ["a thread exists when its rollout is found", ...],
  ["version is undefined without the command", ...],
])("%s", ...);
```

The stand-in for "a server request gets an error" is a small Node script given as the adapter's
`command`, which prints a request and records the answer: no real agent runs, as the Agents decision
asks.

The break each test catches: a widened sandbox or a skipped review; images sent as text; a turn hung
on an unanswered request; hidden models offered; a lost thread resumed; a missing command read as
available.

- [ ] **Step 2: Run them to check they fail**
  - Run: `nix develop -c vp test packages/server/src/runner/__tests__/codex.test.ts`
  - Expected: FAIL, `Cannot find module '../codex.ts'`.
- [ ] **Step 3: Implement the runtime, its manifest, and its registration.** The manifest copies
      `claude.toml`'s shape: `name = "codex"`, `title = "Codex"`, `icon = "uraeda:harness-openai"`,
      a `command` setting defaulting to `codex`.
- [ ] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS, the core's built-ins test listing `codex`.
- [ ] **Step 5: Commit**

```bash
git add packages/server/src crates/core
git commit -m "feat(codex-runtime): the Codex runtime"
```

## Task 8: The session picker

**Files:**

- Start from: `packages/web/src/SessionPicker.tsx` and its stories
- Modify: `packages/web/src/SessionPicker.tsx`, `runtimes.ts` (`useSessionPick` in place of
  `useRuntimePick`, `useRuntimesOn` moved here), `Composer.tsx` (`useComposerRuntime`),
  `StartChat.tsx`, `StartDialog.tsx`, `NewChangePage.tsx`, `SessionHeader.tsx` (the import only),
  `SessionPicker.stories.tsx`
- Delete: `packages/web/src/RuntimePicker.tsx`
- Test: `packages/web/src/__tests__/session-picker.test.ts`, `runtime-choice.test.ts`

**Interfaces:**

- Consumes: task 6's `Agent` record `models`, the session record's `model` and `effort`, the
  `session.setEffort` and `agent.refreshModels` mutations, and each start input's `model` and
  `effort`.
- Produces: `pickerRuntimes(on: ReadonlyArray<Runtime>): Array<PickerRuntime>` in
  `SessionPicker.tsx`, a runtime without a list giving no models and no defaults; `useSessionPick()`
  returning
  `{ pick: SessionPick | undefined; sent: { runtime?: string; model?: string; effort?: string }; setPick }`,
  `sent` being what the start inputs send: the runtime as `pickedRuntime` resolves it, and the model
  and effort only while that runtime is the picked one.

What changes in the component: `PickerEffort` loses `description`, as the data model's efforts have
none; opening a step calls `agent.refreshModels` without waiting; `Space a` is registered with
`useKeys`, label "Pick the model" where a session starts and "Pick the effort" in a running session,
opening the same step as the button. In a running session the composer shows the picker with
`isStarted`, its value from the session record, and its change calls `session.setEffort`.

- [ ] **Step 1: Write the failing test**

```ts
// session-picker.test.ts: the pure rules, over the stories' two runtimes
test.each([
  ["the default row names what it resolves to, marked picked", () => modelItems([CODEX], { runtime: "codex" })[0], { aside: "picked", title: "Codex · Default · GPT-6.1-Sol" }],
  ["the button resolves the defaults", () => pickLabel(CODEX, { runtime: "codex" }), "Codex · GPT-6.1-Sol · Medium"],
  ["a model without efforts", () => pickLabel(CLAUDE, { model: "claude-haiku-4-5-20251001", runtime: "claude" }), "Claude Code · Haiku 4.5"],
  ["a model that stops below the effort resets it", () => withModel(CODEX, { effort: "ultra", runtime: "codex" }, "gpt-6-luna"), { model: "gpt-6-luna", runtime: "codex" }],
  ["another agent resets the effort", () => withModel(CLAUDE, { effort: "high", model: "gpt-6-astra", runtime: "codex" }, "sonnet"), { model: "sonnet", runtime: "claude" }],
  ["one agent on lists its models alone", () => modelItems([CLAUDE], { runtime: "claude" }).every((i) => i.title.startsWith("Claude Code")), true],
])("%s", ...);
```

The `runtime-choice.test.ts` fixtures gain `models: null`; its `pickedRuntime` rows stay.

The break each test catches: "Default" mistaken for a pick, an effort the model does not take kept
across a model or agent change, and another agent's rows in a one-agent list.

- [ ] **Step 2: Run it to check it fails**
  - Run: `nix develop -c vp test packages/web/src/__tests__/session-picker.test.ts`
  - Expected: FAIL on the default row's title, until the stories' fixtures move to the test's
    helpers, or on `pickerRuntimes` missing.
- [ ] **Step 3: Wire the picker in every place a session starts, and in a running session's
      composer.** The start dialog shows the picker only where it showed the runtime picker;
      `NewChangePage` sends the pick's `sent`.
- [ ] **Step 4: Run the task's validation, and review in the sandbox**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS
  - Then `vp run sandbox`: a new chat, a feature's new session, a change's start, a running
    session's composer, `Space a` and Enter twice, in both themes, at 390 px and 1440 px.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(codex-runtime): the session picker where a session starts"
```

## Task 9: The header and the usage pane

**Files:**

- Modify: `packages/web/src/SessionHeader.tsx` (its callers' `runsOn`), the session page that
  renders it, `packages/web/src/sidebar/Allowance.tsx`

**Interfaces:**

- Consumes: task 6's session record `ranModel` and `ranEffort`; `RuntimeRecord.usage`.

The header's `runsOn` is `ranModel`, then `ranEffort` when there is one, joined by " · ". The usage
pane lists every runtime on that reported windows, in the runtimes' order, as `home/Usage.tsx` does;
the closed rail's bar keeps the runtime in view.

- [ ] **Step 1: Implement both.** No test: a layout read in the sandbox, as the Testing decision
      asks at the `early` stage.
- [ ] **Step 2: Run the task's validation, and review in the sandbox**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS
  - Then `vp run sandbox`: a fake Codex session's header after its start; two runtimes' windows in
    the sidebar on Home and on a feature; the closed rail; both themes, 390 px and 1440 px.
- [ ] **Step 3: Commit**

```bash
git add packages/web/src
git commit -m "feat(codex-runtime): what ran in the header, every agent's usage in the sidebar"
```

## Task 10: The real Codex, and the docs

**Files:**

- Create: `packages/server/scripts/validate-codex.ts`
- Modify: `packages/server/package.json` (`validate:codex`), `CONTRIBUTING.md`, `README.md` or
  `INSTALL.md` where they name Claude Code as the only agent, `docs/web-ui.md` (the picker, the
  header, the usage pane)

**Interfaces:**

- Consumes: task 7's `CodexAdapter`.

`validate-codex.ts` follows `validate-claude.ts`: in a temporary git repository with a worktree, it
opens a `CodexAdapter` on the cheapest listed model at its lowest effort, and checks, each printing
PASS or FAIL: the model list is not empty and has defaults; a turn that commits a file in the
worktree lands the commit and shows a `notice` of the review (SC-001, US1 K2); a message sent
`steer` during a turn is `accepted` (US1 K3); `interrupt` ends a turn with `interrupted` (US1 K3);
`runsOn` names the model (SC-005); an image path reaches Codex.

- [ ] **Step 1: Write the script, and run it on this machine**
  - Run: `nix develop -c vp run validate:codex`
  - Expected: every check PASS. A failure here stops the build: it is outside behaviour the spec
    relies on.
- [ ] **Step 2: Update the documentation the feature makes wrong**, as the
      [documentation](../decisions/documentation.md) decision says.
- [ ] **Step 3: Run the complete validation**
  - Run: `nix develop -c vp run ready`
  - Expected: PASS
- [ ] **Step 4: Commit**

```bash
git add packages/server CONTRIBUTING.md README.md INSTALL.md docs
git commit -m "feat(codex-runtime): validate the real Codex, and document it"
```
