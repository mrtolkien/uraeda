# Rulings: Codex runtime + model settings

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: A process opened without resume adopts its agent's first ID

- **Decision**: a process opened for a new agent session takes the session ID of its first `init` as
  the session's, silently; any later different ID in the same process is still a `/clear`.
- **Rationale**: Codex picks a thread's ID, so its first `init` always differs from the ID Uraeda
  stored, and `Transcript.#init` would read it as a clear. Claude Code's first `init` repeats the ID
  it was given, so nothing changes for it.
- **Alternatives considered**: a runtime flag saying "picks its own IDs": a contract field for what
  the process already knows.
- **Where**: task 2, `transcript.ts` and `Proc.adopts`.

## R2: The agent reports what ran by names, in a `runsOn` event

- **Decision**: each runtime sends `{ type: "runsOn", model, effort }` with names for people,
  resolved from its own model list; the cache stores them as `ran_model` and `ran_effort`.
- **Rationale**: the data model stores names, and only the runtime knows how its IDs map to them:
  Claude Code reports `claude-opus-5-5` for the `opus` row, Codex `gpt-6-luna` for "GPT-6-Luna".
- **Where**: tasks 2, 4, 5, and 7.

## R3: An effort change applies when the next turn opens its process

- **Decision**: `session.setEffort` only stores the effort; `Processes.open`, at the next turn's
  start, applies it through `setEffort`, or reopens a process whose runtime has none.
- **Rationale**: the spec keeps the running turn's effort; Claude Code's `apply_flag_settings`
  mid-turn could change the requests left in it.
- **If wrong**: a message Claude Code itself queued during the turn runs on the old effort; moving
  the call into `setEffort` at once would fix it.
- **Where**: task 3.

## R4: Model lists live in `Runtimes`, beside each runtime's status

- **Decision**: `Runtimes` keeps each runtime's last list and refreshes it, at most once a minute
  per runtime; its records carry the list.
- **Rationale**: `Runtimes` already owns each runtime's registration and status, and a list belongs
  to a registered runtime: an unregistered one takes its list with it.
- **Where**: task 3.

## R5: Efforts carry no description

- **Decision**: a model's efforts are `{ id, name }`, as the data model lists them; the picker's
  effort preview shows the name, and the mockup's descriptions go.
- **Rationale**: the data model is the spec's, and Claude Code gives no description.
- **Where**: tasks 2 and 8.

## R6: Codex's requests to the client are refused at once

- **Decision**: any JSON-RPC request Codex sends the client gets an error answer straight away.
- **Rationale**: with the auto-reviewer, approvals never reach the client; anything else, as a
  question to the user, would hang an unattended turn. A refused request ends in Codex's own error,
  in the transcript.
- **Where**: task 7.

## R7: Uraeda's skill reaches Codex as an extra skill root

- **Decision**: `skills/extraRoots/set` with the server's `<plugin>/skills` folder and the
  extensions' `skills/` folders, as Claude Code gets them as plugins.
- **Rationale**: the folder already holds `skills/uraeda/`, and Codex reads a root's skill folders;
  no copy is made.
- **Where**: task 7.

## R8: The shared process plumbing writes stdin's JSON lines and reads stdout's lines

- **Decision**: `Child` gains `write(value)`, one JSON line to stdin, dropped once stdin has closed,
  and `lines`, stdout's line reader, moves from `claude-events.ts` to `child.ts`.
- **Rationale**: Claude Code's stream-json and Codex's JSON-RPC are both JSON lines over stdio: each
  runtime would copy the same writer, and Codex would import its reader from Claude Code's parser.
- **Where**: task 1, `child.ts`; task 7 builds on it.

## R9: The session manager's split is the human's edits, not the moves and holds

- **Decision**: `rename`, `archive`, `seen`, and `dismiss` move from `sessions.ts` into
  `session-edits.ts`; `hold`, `moving`, `held`, and `attach` stay.
- **Rationale**: `moving` and `held` are one-line delegations and `attach` already delegates, so
  moving them frees almost nothing; the edits are the longest bodies, one kind of call, a stored
  field the human changes, and `setEffort` is one more of them.
- **Where**: task 1, `session-edits.ts`; task 3 adds `setEffort` there.

## R10: An effort is checked against the models the last list holds

- **Decision**: `checkEffort` refuses an effort only for a model the runtime's last list holds, the
  picked one or the list's default: with no list, or for a model the list no longer holds, the
  effort goes to the agent, which answers for it in the turn.
- **Rationale**: a model is refused without a list, so a new session's effort is always checked
  against a known model, except on the agent's default with no list yet, which the picker never
  offers an effort for; a running session's model retired since keeps its effort changeable, as the
  spec's "the session's next turn fails with the agent's error".
- **Alternatives considered**: refusing every effort without a known model: a running session on a
  retired model could not even go back to its default effort, and the refusal would need a model
  name it does not have.
- **Where**: task 3, `picks.ts`.

## R11: Claude Code's control requests live in `claude-control.ts`

- **Decision**: the control requests a Claude Code process writes and the answers it waits for, by
  request ID, and the readings of `list_models` and `get_settings` (`claudeModels`, `claudeRunsOn`),
  go in `runner/claude-control.ts`; `claude.ts` keeps the adapter.
- **Rationale**: in `claude.ts` they would take it past the 500 lines the code quality decision
  allows, and `claude-events.ts` is near it; they are one concern, the control channel.
- **Where**: task 5.

## R12: Codex's usage windows take Claude Code's IDs

- **Decision**: Codex's 300- and 10,080-minute windows are `five_hour` and `seven_day`, labelled
  `5h` and `Week`, as `claude-limits.ts` names Claude Code's; other lengths get an ID by their
  duration, and a window without a reset time is left out.
- **Rationale**: the usage window draws both agents' windows the same; the plan's `five-hour` and
  `week` did not match the code.
- **Where**: task 4, `codex-limits.ts`.

## R13: A Codex command's target drops its shell wrapper

- **Decision**: a command's target reads `git commit -m 'add a'`, not `/usr/bin/bash -lc "..."`; its
  input keeps the full command line.
- **Rationale**: the transcript shows what the agent ran, as Claude Code's Bash targets do.
- **Where**: task 4, `shellCommand` in `codex-events.ts`.

## R14: Only the session's thread, and its sub-agents', reach the transcript

- **Decision**: notifications of another thread are dropped; a sub-agent's thread, learned from a
  `spawnAgent` item's `receiverThreadIds`, gives tools and thoughts with `parent`, and no text; a
  sub-agent's `thread/started` gives no `init`. Without a `thread/started`, as on resume, the first
  thread heard from is the session's. `model/rerouted` gives `runsOn` with the model that ran.
- **Rationale**: a sub-agent's `turn/completed` or `thread/started` would end the session's turn or
  read as a clear; Claude Code's sub-agents' text is dropped the same way.
- **If wrong**: only the generated types back the sub-agent shapes; `validate:codex` at Ultra can
  check them.
- **Where**: task 4, `codex-events.ts`.

## R15: Codex's JSON-RPC channel and its turns live beside its adapter

- **Decision**: the requests by ID and the refusal of Codex's own requests go in
  `runner/codex-rpc.ts` (`CodexRpc`), and the turns, steering, the adapter's queue, and taking back
  in `runner/codex-turns.ts` (`CodexTurns`); `codex.ts` keeps the adapter, the pure parameters, and
  the model list.
- **Rationale**: in `codex.ts` alone they would take it past the 500 lines the code quality decision
  allows; they are two concerns, as `claude-control.ts` is Claude Code's channel (R11).
- **Where**: task 7.

## R16: Codex's options take no images folder, and no plugins folder

- **Decision**: `CodexAdapterOptions` is
  `{ codexHome?, command?, extensions?: ExtensionPaths, pluginDir }`: no `imagesDir`, and the
  extensions without Claude Code's `plugins` folder.
- **Rationale**: images reach Codex as `localImage` inputs, which the app-server reads by their
  paths, and `workspace-write` reads the whole disk; Codex takes the extensions' skill folders as
  extra skill roots (R7), so it needs no plugin folders.
- **Where**: task 7, `codex.ts`.

## R17: An effort set back to the default sends the default effort

- **Decision**: a process reads `model/list`, every page, and `config/read` once, before its thread
  starts: the model names for `runsOn`, and the default effort, the configured one, else the
  session's model's own. A turn after one given an effort, its effort now the agent's default, is
  given that default effort; a failed read leaves the names as IDs and sends no effort.
- **Rationale**: Codex keeps a turn's effort "for this turn and subsequent turns", so leaving the
  effort out would keep the last one picked, not go back to the default.
- **Alternatives considered**: sending `effort: null`, whose meaning the protocol's types leave
  open; reopening the process, which `setEffort` exists to avoid.
- **Where**: task 7, `CodexTurns` and `CodexAdapter.#begin`.

## R18: The sandbox's instructions name the escalation and its retry

- **Decision**: the sandbox section says git's folder is read-only and the network off, and to run
  every git command that writes and every network command with escalated permissions from its first
  try, naming Codex's `sandbox_permissions: "require_escalated"`, and to run a refused one again
  escalated, never to work around the sandbox.
- **Rationale**: on the real Codex 0.163.0 (GPT-6-Luna, Low), the plan's shorter wording ended four
  turns out of four with "git add failed" and no escalation; with this one, a plain "commit it"
  escalated, the reviewer approved, and the commit landed.
- **If wrong**: a model that still does not escalate ends its step before the gate, and the run
  lifecycle asks it once to continue, as the spec's edge case says.
- **Where**: task 7, `codexInstructions`.

## R19: What a Codex process does when a start fails

- **Decision**: a thread that fails to start or resume gives an `init` with its `problem` and no ID,
  which fails the turn and closes the process; a refused `turn/start` gives a failed `result` with
  Codex's words. Messages left in the adapter's queue after a failed or stopped turn are not
  started: the runner takes them back, which gives `cancelled`. The defaults of `codexModels` are
  the configured model and effort, else the list's row marked default and its default effort.
- **Rationale**: the runner already fails a turn on an `init` problem and on a failed result, and
  takes back the messages a turn did not read; a model list without a configured model would
  otherwise show no default.
- **Where**: task 7, `codex.ts` and `codex-turns.ts`.

## R20: The composer's picker lives in `ComposerPicker.tsx`, its samples in `sampleRuntimes.ts`

- **Decision**: `useComposerRuntime` moves from `Composer.tsx` into `ComposerPicker.tsx`, with the
  running session's effort picker, which reads the session's `model` and `effort` through a small
  `SessionPickView`; the stories' two runtimes move into `sampleRuntimes.ts`, shared by the stories
  and `session-picker.test.ts`; what a new session's input sends is the pure `pickSent` in
  `runtimes.ts`, which `useSessionPick` returns as `sent`, and the inputs carry it whole
  (`PickSent`) in place of `runtime`. The start dialog names the picker "Runs on", beside it, as it
  names its research effort.
- **Rationale**: `Composer.tsx` is at 446 lines, and the effort picker would take it past the 500
  the code quality decision allows; a test importing a story file would load Storybook; the pure
  rule is the part worth testing, as `pickedRuntime` was.
- **Where**: task 8.

## R21: On the phone, the button leaves the agent's name to its mark

- **Decision**: at a phone's width, the button reads "GPT-6.1-Sol · Medium" beside the agent's mark,
  not "Codex · GPT-6.1-Sol · Medium"; the composer's footer wraps, so the picker never cuts the
  model it names to make room for the paperclip or "Insert: …". The effort step opens a frame after
  the model step closes.
- **Rationale**: at 390 px the full text pushed Send out of the composer; the mark already names the
  agent. Opened in the frame the model step closed, the effort step had no row under its cursor and
  no preview.
- **Where**: task 8, `SessionPicker.tsx`, `ComposerSend.tsx`.

## R22: The extensions folder is not writable for Codex

- **Decision**: a turn's sandbox has no writable root besides the session's directory; the sandbox
  section of the instructions says writing in the extensions folder needs escalated permissions,
  from its first try, as git writes do. The spec's Architecture gives Codex "the extensions folder
  as writable": the Agents decision wins over it.
- **Rationale**: Uraeda's loader runs an extension's `server.ts` in its own process, with the
  network. A sandboxed Codex writing there without escalation would be an action outside its
  worktree that no reviewer saw, which the Agents decision forbids ("each action outside its
  worktree, the network included, reviewed before it runs"); it outranks the spec.
- **If the human prefers the spec's wording**: give `codexTurnParams` the extensions folder in
  `writableRoots` again (`[this.#extensions.folder]` from `CodexAdapter.open`), drop the extensions
  sentence of `sandboxSection`, and amend the Agents decision to name the extensions folder as an
  exception.
- **Where**: `codex.ts`, `codexTurnParams` and `sandboxSection`.

## R23: A thread runs only on the permissions Codex says it applied

- **Decision**: `#begin` reads the `sandbox`, `approvalPolicy`, and `approvalsReviewer` of the
  `thread/start` or `thread/resume` answer, and refuses a thread that is not on the `workspaceWrite`
  sandbox with `networkAccess: false`, `on-request`, and `auto_review`: the R19 path, an `init`
  whose `problem` names what Codex applied, as "Codex applied danger-full-access instead of
  workspace-write: Uraeda does not run it". The sandbox's writable roots are not checked: each
  `turn/start` sends its own policy, with none (R22).
- **Rationale**: the parameters ask for the permissions, but the user's settings, a managed
  configuration, or a later Codex could apply others; the Agents decision asks that the agent never
  run wider than reviewed. This machine's own `~/.codex/config.toml` says `danger-full-access` and
  `approval_policy = "never"`.
- **Where**: `codex-permissions.ts` (`appliedProblem`), `CodexAdapter.#begin`.

## R24: A thread gives Codex its project's trust, so that Codex does not write it

- **Decision**: `thread/start` and `thread/resume` carry one `config` override,
  `projects."<session directory>".trust_level`: the level of the user's `projects` setting, as
  `config/read` gives it, for the session's directory, else its main checkout, else the closest
  folder holding either; `trusted` without one. Unread settings give no override.
- **Rationale**: on Codex 0.163.0, every `thread/start` in a project without its own entry, a
  worktree's being its main checkout's, writes
  `[projects."<main checkout>"] trust_level = "trusted"` into `~/.codex/config.toml`, whatever the
  sandbox and approval parameters, ephemeral threads included; a parent folder's entry (`/tmp`) is
  honoured but does not stop the write. An entry given in memory for the session's directory stops
  it, and wins over the main checkout's. `thread/resume` writes nothing, but gets the same override
  so a resumed thread has the trust its start had. The Agents decision says Uraeda MUST NOT change
  an agent's settings; `trusted` is the level Codex would write and apply, so a project without an
  entry runs as before, without the write; an existing entry, `untrusted` included, is kept.
- **Alternatives considered**: `ephemeral: true`, which writes the entry all the same and keeps no
  rollout to resume; `untrusted` in memory for every project, which would drop the project's own
  `.codex/` settings that the user's trust lets Codex read.
- **If wrong**: where Codex looks trust up differently (a symlinked path, a managed layer), the
  override can differ from what Codex alone would apply; it is never wider than `trusted`, the level
  Codex gives a project without an entry.
- **Where**: `codex-permissions.ts` (`codexTrust`, `gitMainRoot`), `codexThreadParams`,
  `CodexAdapter.#begin`.

## R25: A Codex process's start gives up after 60 seconds

- **Decision**: from `initialize` to the answer of `thread/start` or `thread/resume`, a process has
  `START_TIMEOUT_MS`, 60 seconds; past it, its start fails on the R19 path, an `init` whose
  `problem` says "Codex did not answer within 60 seconds", and its process group gets `SIGKILL`.
  `CodexAdapterOptions.startTimeoutMs` changes it, for the tests.
- **Rationale**: a Codex that never answers would hold the turn running with nothing to stop; the
  model list and the configuration read before the thread are part of the start, as a slow account
  check is.
- **Where**: `CodexAdapter.#bounded`, `open`.

## R26: A refused steer never starts a turn after a failed one

- **Decision**: a `turn/steer` Codex refuses after the turn ended badly, or while the process
  closes, puts its message back in the adapter's queue, where the runner's `takeBack` cancels it;
  only after a turn that ended well does it start the next turn. A process closed while its thread
  fails to start ends its input then.
- **Rationale**: the runner takes back what a failed turn left; a refused steer that started a turn
  by itself, its refusal arriving before the runner's `takeBack`, ran outside any runner turn, and
  the runner marked it taken back all the same. A close that came while `#start` waited for the
  thread left the process running with nothing to end it.
- **Where**: `codex-turns.ts`, `#steer` and `#start`.

## R27: The sidebar's usage pane says each window on one line, and the sandbox's agent says what it runs on

- **Decision**: the sidebar's pane lists the same windows as Home's, in the same order, each with
  its mark, but its line reads "5h 58% · 04:33", on one line at the sidebar's width, its whole
  sentence as its title; Home's keeps "5h 58% left - reset 04:33". Home's and the sidebar's lists
  share `UsageWindows` and `useReportedRuntimes` in `UsageWindow.tsx`. The closed rail's one bar
  stays the runtime in view's first window, and shows nothing while that runtime reported none,
  though others did. The sandbox's agent reports `runsOn` as each process opens and as its effort
  changes, by the fake model list's names, so the sandbox shows the header's model and effort.
- **Rationale**: two agents' four windows, each on two lines at the sidebar's width, took the room
  of the navigation's "Needs you" and "In progress" panes on a 900 px tall window; the fake runtime
  reported no `runsOn`, so the header could not be reviewed in the sandbox.
- **Where**: task 9, `UsageWindow.tsx`, `sidebar/Allowance.tsx`, `packages/web/sandbox/agent.ts`.
