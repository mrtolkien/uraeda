---
status: auto-approved
spec-revision: 1
---

# Plan: Chat in the web UI

**Goal:** Each feature gets one conversation with its agent, holding its runs and the human's chat,
and the project gets chats without a feature, listed in the sidebar with their status.

**Architecture:** The runner becomes a session manager over an agent-neutral adapter that opens one
process per session and sends it messages as they come. The cache stores sessions, turns, and items,
and fate serves them to a session view with a composer, and to a sidebar with statuses and search.
See the [spec's design](spec.md#design).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

1. **A message sent while the process is still opening**, before its `init`, is written once the
   process is up, never lost or sent twice. Task 6.
2. **The agent's process dies while a message waits in the queue**: the queued turn starts on a
   reopened process, instead of staying queued forever. Task 6.
3. **The same session opened in two tabs**: a take-back from one tab, of a message the other tab
   sees, removes it from both through the live update. Task 7.
4. **A search with SQL wildcards**, like `100%` or `a_b`: it matches the text literally. Task 3.
5. **A chat title longer than 80 characters, or a first line that is only spaces**: the title is cut
   at 80 characters, or falls back to "New chat". Task 6.

## Global constraints

From the decisions and the spec, every task's requirements include these:

- "Every agent MUST be reached through one adapter interface, in `packages/server/src/runner/`: open
  or resume a session in a directory, send it messages, stream its events, interrupt its turn, and
  close it. Each adapter MUST declare its capabilities [...] and the UI MUST offer only what the
  session's agent declares." ([agents](../decisions/agents.md))
- "The tests that `vp run ready` runs MUST use a fake adapter, and MUST NOT run a real agent."
  ([agents](../decisions/agents.md))
- "An agent's own formats MUST stay inside its adapter." ([agents](../decisions/agents.md))
- "A feature MUST have at most one session. A session MUST have at most one live process and at most
  one turn at a time. A message sent during a turn MUST be steered into it or queued after it, as
  the adapter declares, and MUST NOT start a second process." ([agents](../decisions/agents.md))
- "Its rows MUST be keyed by the repository's main checkout path and the session's own ID, with the
  feature's folder when the session has one." ([agents](../decisions/agents.md))
- "Stopping MUST interrupt the session's turn through the agent's own interrupt, which keeps the
  session. When the turn has not ended 10 seconds later, the server MUST end the process: SIGINT
  first, and SIGTERM when it is still running 10 seconds after that."
  ([agents](../decisions/agents.md))
- "A session's process MUST be closed after 15 minutes without a turn, and resumed with its next
  message." ([agents](../decisions/agents.md))
- "TypeScript code MUST reach the core only through the binding [...] The TypeScript types of core
  data MUST come from the declarations napi-rs generates." ([stack](../decisions/stack.md))
- "Raw `button`, `input`, `textarea`, `select`, and `dialog` elements MUST NOT be written in
  `packages/web/src`." Styles in StyleX with Astryx's tokens only.
  ([UI components](../decisions/ui-components.md))
- "Components MUST NOT write their own media queries with sizes. They read the width class from one
  shared hook." ([UI layout](../decisions/ui-layout.md))
- "UI tests MUST drive the UI as a user does, through roles, labels, and visible text."
  ([UI checks](../decisions/ui-checks.md))
- Exact texts, from the spec:
  - Opening line: "A human is chatting with you about the feature specs/<folder>/, on branch
    <branch>: answer, and change files, commit, or move the workflow only when they ask."
  - Refusals: "An agent is working on this feature. Stop it first, or wait for it.", "The feature
    waits on you now: there is nothing to continue.", "This feature has no branch yet: commit its
    proposal first.", "Claude Code is not available on this machine."
    (`<agent name> is not available on this machine.`), "The agent already read it."
  - System lines: "Started a new session: the previous one is gone.", "Stopped: the server stopped
    while it ran.", "No output for 30 minutes.", "The Uraeda skill did not load: <error>".
  - Retry message: "Try the blocked action again, now allowed: <tool> <target>".
  - Blocked action: "Blocked by auto mode: <tool> <target>", button "Allow and retry".
  - Status labels: "Working", "Needs you", "Failed", "New reply", "Idle", "Stopped".
  - Search: "No session matches “<text>”."
  - Transcript: log named "Conversation"; a workflow turn opens with "Run: <step label>"; status
    region "Claude Code is replying" (`<agent name> is replying`) and "Reply complete".
  - Ask: "About specs/<folder>/<file>, lines <start>–<end>:", and "About Q3 of
    specs/<folder>/<file>:".
  - Composer placeholder "Message Claude Code" (`Message <agent name>`).
- Timings: idle close 15 minutes, watchdog 30 minutes during a turn, terminate 10 seconds then 10
  seconds, live updates every 250 ms, a status change in every sidebar within 1 second.
- Titles: a chat's first line, cut at 80 characters.
- `vp run ready` fails today on `crates/core/tests/priorities.rs`, `edits_keep_every_other_line`, a
  failure already there before this branch's code: run the checks after `cargo test` with `vp check`
  and `vp test`, and
  `cargo test --workspace --exclude uraeda-binding -- --skip edits_keep_every_other_line`, and do
  not fix it here.

## Code read

- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts),
  [`runner/events.ts`](/packages/server/src/runner/events.ts): `Adapter.start` with one message,
  `AgentRun` with `interrupt` and `terminate`, the `AgentEvent` and `RunEvent` unions, and
  `Trigger`.
- [`runner/claude.ts`](/packages/server/src/runner/claude.ts): `claudeArgs`, `parseLine` over
  `KNOWN_TYPES`, `lines()`, `ClaudeAdapter` writing one message and ending stdin. Its tests in
  `runner/__tests__/claude.test.ts` are table-like over JSON lines.
- [`runner/cache.ts`](/packages/server/src/runner/cache.ts): `RunCache`, two migrations by
  `PRAGMA user_version`, the `startRun` claim in a `BEGIN IMMEDIATE` transaction with `alive(pid)`,
  `interrupted()`, WAL, the corrupt-file fallback. Tests in `runner/__tests__/cache.test.ts`.
- [`runner/runner.ts`](/packages/server/src/runner/runner.ts): `Runner` with `#busy`, `#live`,
  `#record` mapping events to the log, `#halt`, the watchdog, `outcome()`. Tests in
  `runner/__tests__/runner.test.ts` with `testRunner()` from `runner/__tests__/helpers.ts`, on the
  binding's `fixtureRepo()`: `2026-10-12-cli-tuis` waits on an agent at `plan`, `2026-10-11-web-ui`
  waits on the human.
- [`runner/message.ts`](/packages/server/src/runner/message.ts): `runMessage`, `triggerSentence`,
  `toolTarget`, `allowRule`.
- [`runner/fake.ts`](/packages/server/src/runner/fake.ts): `FakeAdapter` with `script`, `emit`,
  `finish`, `starts`, `sessions`.
- [`fate/runs.ts`](/packages/server/src/fate/runs.ts): `readRun`, `ownRun`, `mainRoot` through
  `nextStep`, `featureRecord` with `runs`, `writable`.
- [`fate/views.ts`](/packages/server/src/fate/views.ts),
  [`fate/sources.ts`](/packages/server/src/fate/sources.ts),
  [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts): `dataView`s, byId sources only,
  `run.start`, `run.allow`, `run.stop`; every write calls `writable`.
- [`live.ts`](/packages/server/src/live.ts): `runPublisher` throttling at 250 ms, `startRunner`
  checking the agent every 60 s. [`main.ts`](/packages/server/src/main.ts) and
  [`testing.ts`](/packages/server/src/testing.ts) wire the adapter.
- Server tests: `src/__tests__/helpers.ts` gives `testServer()`, `mutate()`, `byId()`; run tests in
  `src/__tests__/runs.test.ts`.
- [`crates/core/src/api.rs`](/crates/core/src/api.rs): `next_step` gives `main_root` from
  `git.main_root()`; `work_dir` refuses "<folder> has no branch". The binding wraps each in
  [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs) as an `AsyncTask`; core tests in
  `crates/core/tests/runs.rs`.
- Web: [`views.ts`](/packages/web/src/views.ts) and [`data.ts`](/packages/web/src/data.ts) (one hook
  per record, live, refreshed on show); [`runs.ts`](/packages/web/src/runs.ts) `startRun`, called by
  `AgentPanel.tsx`, `RoundPage.tsx` (168), `EditorPage.tsx` (145, 171), `ReviewPage.tsx` (272);
  [`CommitActions.tsx`](/packages/web/src/CommitActions.tsx) with `continueLabel`;
  [`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx),
  [`RunPage.tsx`](/packages/web/src/RunPage.tsx) with `useFollowEnd` and `useOpenGroups`,
  [`RunLog.tsx`](/packages/web/src/RunLog.tsx) with `RunEvents`;
  [`Shell.tsx`](/packages/web/src/Shell.tsx) `Nav` over `SideNav`;
  [`routes.tsx`](/packages/web/src/routes.tsx) `parseRoute`, `navigate`, `redirect`, `Entry`;
  [`App.tsx`](/packages/web/src/App.tsx) `RunRoute` with `Panes`.
- Web tests: `src/__tests__/helpers.tsx` (`renderPage`, `fakeAgent`, `refreshUntil`, `click`,
  `type`, `atWidth`; happy-dom, no live updates); browser tests in `src/__browser__/` with `show()`,
  the `agentEmit`/`agentFinish` commands of `vite.browser.config.ts`, at 402 × 874 and 1440 × 900.
- Validation: `vp check`, `vp test`, `cargo fmt --check`,
  `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test --workspace --exclude uraeda-binding`, `vp run --filter uraeda-binding build` after a
  binding change, `vp run ready` for everything.

## Constitution check

| Principle                            | Complies | Notes                                                             |
| ------------------------------------ | -------- | ----------------------------------------------------------------- |
| I. Humans stay in control            | yes      | The workflow's message is sent only by the human's Send (task 10) |
| II. Git and plain text first         | yes      | No workflow state in the cache; commits go through the core       |
| III. Asynchronous by default         | yes      | Every step still runs from a commit; chat history is a cache      |
| IV. Review effort matches impact     | yes      | Needs you sorts first (tasks 4, 9)                                |
| V. Tools are optional                | yes      | Nothing in the workflow requires the chat                         |
| VI. Code is checked against the spec | yes      | Each scenario has a test; abstractions are listed below           |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Agents](../decisions/agents.md): the adapter interface and capabilities (task 5), the Claude
  command line (task 5), one process and one turn per session, steer or queue, idle close, Stop
  (task 6), cache keys (task 3), the opening line and stored messages (tasks 4, 6).
- [Stack](../decisions/stack.md): `mainRoot` from the binding (task 2); fate for every read (task
  7); `Markdown` for the agent's text (task 8).
- [Git](../decisions/git.md): no checkout switched; chats run in the main checkout (task 6).
- [UI layout](../decisions/ui-layout.md), [UI behaviour](../decisions/ui-behaviour.md),
  [UI components](../decisions/ui-components.md), [UI checks](../decisions/ui-checks.md): tasks 8
  to 12.
- [Toolchain](../decisions/toolchain.md): every test runs in `vp run ready`; the validation script
  does not.

## Complexity tracking

| Abstraction or exception                       | Why it is needed                                               | Simpler alternative rejected because                     |
| ---------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| `Adapter` and `AgentProcess` with capabilities | The agents decision, and Q7: Codex and pi-durable adapters     | A Claude-only runner: Q7 asked for the generic model now |
| `Sessions` manager (`sessions.ts`)             | One process per session, turns, a queue, timers                | Extending `Runner`: built around one process per run     |
| `sessionStatus()` (`status.ts`)                | One rule set for the sidebar, the header, and the feature page | Computing it in each view: three copies that drift       |
| `Transcript` and `Composer` components         | Shared by a feature's session and a chat                       | Two pages each drawing their own                         |
| `SessionSearch` record keyed by the query      | Search over message text needs the server                      | Filtering in the browser: the item text is not loaded    |
| Test helpers `testSessions()`, `fakeClock`     | Each session test stays a few lines                            | Repeating the setup in each test                         |

## Review comments

The spec was approved with comments, in [spec-review.md](spec-review.md):

- **C1** (resume after the idle close, for cache hits): the closed process is reopened with
  `--resume <native id>`, Claude Code's own resume, keeping the same session. Task 6, test "an idle
  process closes after 15 minutes, and the next message resumes the same session".
- **C2** (rename "… and continue"): every button that commits and leads to the agent says it starts
  the agent: "Commit and start the agent", "Approve and start the agent", "Request changes and start
  the agent", and "Start the feature and the agent" in the editor. The composer's Send reads "Start
  the agent" while it holds the workflow's message. Task 10.

---

## Task 1: Check Claude Code's stdin messages on the installed version

**Files:**

- Modify: `packages/server/scripts/validate-claude.ts`
- Create: `specs/2026-10-13-chat-in-the-web-ui/rulings.md` (R1 to R4 are written at planning; add
  the results as R5)

**Interfaces:**

- Produces: whether Claude Code can take back one queued message, which sets
  `ClaudeAdapter.capabilities.takeBack` in task 5.

The script spawns the real `claude`, by hand only: it is not part of `vp run ready`.

- [ ] **Step 1: Add the checks to the script**, each printing `PASS <name>` or `FAIL <name>: <why>`,
      in a temporary directory, with `--model haiku`, stdin kept open:
  1. `two turns`: two user messages a few seconds apart in one process each end with a `result`,
     with the same `session_id`.
  2. `partial text`: with `--include-partial-messages`, `stream_event` lines carry `text_delta`s.
  3. `steer`: a message with `"priority":"next"`, written while a `Bash` `sleep 5` runs, is answered
     within the same turn (one `result` for both).
  4. `queue`: a message with `"priority":"later"` gets its own `result` after the first.
  5. `lifecycle`: messages with a `uuid` get `command_lifecycle` events, `queued` then `started`.
  6. `take back`: write a `later` message, then try, in order,
     `{"type":"control_request","request_id":"t","request":{"subtype":"cancel_queued_message","uuid":"<uuid>"}}`
     and
     `{"type":"control_request","request_id":"t","request":{"subtype":"interrupt","cancel_queued":true}}`;
     pass when a `command_lifecycle` `cancelled` arrives for that uuid and no reply to it follows.
     Record which request worked.
  7. `interrupt`: the interrupt control request ends the turn with a `result`, and the process takes
     the next message.
  8. `sub-agent`: asked to use a sub-agent, the sub-agent's messages carry a `parent_tool_use_id`
     equal to the `Agent` (or `Task`) tool call's id.
  9. `resume`: close stdin, then `-p --resume <id>` with a new message answers with the earlier
     context.
- [ ] **Step 2: Run it**

- Run: `node packages/server/scripts/validate-claude.ts`
- Expected: a `PASS` or `FAIL` line for each of the nine checks.

- [ ] **Step 3: Write R5 in `rulings.md`**: the version tested, each result, the take-back request
      that worked or "none", and the event names seen. When `take back` failed, R5 says Claude
      sessions declare `takeBack: false`.
- [ ] **Step 4: Commit**

```bash
git add packages/server/scripts/validate-claude.ts specs/2026-10-13-chat-in-the-web-ui/rulings.md
git commit -m "test(chat-in-the-web-ui): check Claude Code's stdin messages"
```

## Task 2: The main checkout's path without a feature

**Files:**

- Modify: `crates/core/src/api.rs` (next to `next_step`), `crates/binding/src/lib.rs`
- Generated: `packages/binding/index.d.ts`, `packages/binding/index.js`
- Test: `crates/core/tests/runs.rs`, `packages/binding/index.test.ts`

**Interfaces:**

- Produces: `api::main_root(repo: &Path) -> Result<String>`; binding
  `mainRoot(repo: string): Promise<string>`.

- [x] **Step 1: Write the failing tests**

```rust
#[test]
fn main_root_of_a_worktree_is_the_main_checkout() {
    let repo = fixture_repo();
    let worktree = api::work_dir(&repo, "2026-10-12-cli-tuis").unwrap();
    assert_eq!(api::main_root(Path::new(&worktree)).unwrap(), repo.to_string_lossy());
    assert_eq!(api::main_root(&repo).unwrap(), repo.to_string_lossy());
}
```

```ts
test("mainRoot gives the main checkout from a worktree", async () => {
  const repo = fixtureRepo();
  const worktree = await binding.workDir(repo, "2026-10-12-cli-tuis");
  expect(await binding.mainRoot(worktree)).toBe(repo);
});
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test runs main_root`
- Expected: FAIL to compile, `cannot find function main_root in module api`

- [x] **Step 3: Implement `pub fn main_root(repo: &Path) -> Result<String>`** with `open(repo)` and
      `git.main_root()`, and its binding `main_root(repo: String) -> AsyncTask<Job<String>>`, then
      `vp run --filter uraeda-binding build`.
- [x] **Step 4: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding -- --skip edits_keep_every_other_line && vp test`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates/core/src/api.rs crates/binding/src/lib.rs crates/core/tests/runs.rs packages/binding/index.d.ts packages/binding/index.js packages/binding/index.test.ts
git commit -m "feat(chat-in-the-web-ui): the main checkout's path without a feature"
```

## Task 3: Sessions, turns, and items in the cache

**Files:**

- Modify: `packages/server/src/runner/events.ts`, `packages/server/src/runner/cache.ts`
- Test: `packages/server/src/runner/__tests__/cache.test.ts`

**Interfaces:**

- Produces, in `events.ts` (replacing `RunEvent`, `RunState`, and the `"allow"` trigger):

```ts
export type ToolKind =
  "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "other";
export type ToolStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
export type Item =
  | {
      kind: "message";
      id: string;
      text: string;
      origin: "human" | "workflow";
      opening?: string;
      state: "pending" | "read" | "taken-back";
    }
  | { kind: "text"; text: string; streaming: boolean }
  | {
      kind: "tool";
      id: string;
      name: string;
      toolKind: ToolKind;
      target?: string;
      status: ToolStatus;
      durationMs?: number;
      output?: string;
      parent?: string;
      subagent?: { description: string };
    }
  | { kind: "system"; text: string }
  | { kind: "denial"; tool: string; target?: string; rule: string; allowed: boolean };
export type TurnKind = "workflow" | "chat" | "allow";
export type TurnState = "queued" | "running" | "done" | "failed" | "stopped";
export type Trigger = "answers" | "approval" | "changes" | "proposal" | "start" | "manual";
```

- Produces, in `cache.ts`, `SessionCache` replacing `RunCache` (same `open(path, {pid, timeout})`,
  WAL, corrupt-file fallback, `dataDir`):

```ts
type SessionRow = { id: string; repo: string; folder: string | null; agent: string; nativeId: string;
  title: string | null; createdAt: string; updatedAt: string; seenAt: string | null;
  archivedAt: string | null; pid: number | null };
type TurnRow = { id: number; sessionId: string; kind: TurnKind; trigger: Trigger | null;
  step: string | null; allowed: string | null; state: TurnState; reason: string | null;
  costUsd: number | null; startedAt: string | null; endedAt: string | null };
createSession(row: { repo: string; folder: string | null; agent: string; nativeId: string;
  title: string | null }): SessionRow   // a new UUID; refuses a second session of a feature
session(id: string): SessionRow | undefined
featureSession(repo: string, folder: string): SessionRow | undefined
updateSession(id: string, fields: Partial<Pick<SessionRow, "nativeId" | "title" | "seenAt" | "archivedAt">>): void
claimSession(id: string): boolean     // sets pid to this process unless a live other process holds it
releaseSession(id: string): void      // clears pid when it is this process's
sessions(repo: string, options?: { query?: string; limit?: number }): Array<SessionRow>
addTurn(row: { sessionId: string; kind: TurnKind; trigger: Trigger | null; step: string | null;
  allowed: string | null; state: "queued" | "running" }): number   // also bumps updatedAt
startTurn(id: number): void           // queued → running, startedAt now
endTurn(id: number, end: { state: TurnState; reason?: string; costUsd?: number }): void
turn(id: number): TurnRow | undefined
turns(sessionId: string): Array<TurnRow>   // oldest first
appendItem(turnId: number, item: Item): number   // seq
updateItem(turnId: number, seq: number, item: Item): void
items(turnId: number, offset: number, limit: number): Array<Item & { seq: number }>
itemsOf<K extends Item["kind"]>(turnId: number, kind: K): Array<Extract<Item, { kind: K }> & { seq: number }>
itemCount(turnId: number): number
interrupted(reason: string): Array<TurnRow>   // running turns of sessions whose pid is dead or this one
```

- [x] **Step 1: Write the failing tests**, replacing the tests of the removed methods:
  - "migration 3 turns each feature's runs into the turns of one session": open a file written with
    migrations 1 and 2 holding two runs of `(repo, f)` with two `session_id`s and one event each;
    after `open`, `featureSession(repo, "f")` has `agent: "claude"`, the latest `session_id` as
    `nativeId`, `title: null`; `turns(id)` has both runs, same IDs, `kind: "workflow"`, their
    `trigger` and `step`; `items(runId, 0, 10)` has each event.
  - "a feature has one session": `createSession` twice for `(repo, "f")` throws.
  - "a chat has no folder, and many are allowed": two `createSession({folder: null})` both work.
  - "a session is claimed by one live server": two caches on one file, opened with
    `pid: process.pid` and with the pid of a live child process; the second's `claimSession` refuses
    while the first holds it, and succeeds once the holder's pid is dead, as the existing claim test
    does.
  - "search matches titles, folders, and message and text items, case-insensitively":
    `sessions(repo, { query: "wal" })` finds a chat whose text item says "the cache uses WAL mode".
  - "search matches its text literally" (review focus 4): `query: "100%"` finds "100% done" and not
    "1000 done"; `query: "a_b"` finds "a_b" and not "axb".
  - "search stays in its repository": a session of another `repo` is never listed.
  - "sessions are newest first, at most 50".
  - "interrupted stops the running turns of gone servers".
- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner/__tests__/cache.test.ts`
- Expected: FAIL, `cache.featureSession is not a function`

- [x] **Step 3: Implement migration 3 and `SessionCache`**. Migration 3, in one transaction: create
      `sessions` and `turns` as the spec's [Data](spec.md#data) gives them, with `pid INTEGER` on
      `sessions` (see R1); insert one session per distinct `(repo, folder)` of the old `runs`, with
      `randomblob`-based UUIDs computed in TypeScript before the SQL runs (the migration may be a
      function: change `migrations` to `Array<string | ((db) => void)>`); copy `runs` into `turns`
      keeping `id`; `ALTER TABLE events RENAME TO items` and
      `ALTER TABLE items RENAME COLUMN run_id TO turn_id`; drop the old tables. Search uses
      `LIKE ? ESCAPE '\'` with `%`, `_`, and `\` escaped, on `lower()`.
- [x] **Step 4: Run all tests**

- Run: `vp test packages/server/src/runner/__tests__/cache.test.ts`
- Expected: PASS (other server tests fail to compile until task 6: run only this file)

- [x] **Step 5: Commit**

```bash
git add packages/server/src/runner/events.ts packages/server/src/runner/cache.ts packages/server/src/runner/__tests__/cache.test.ts
git commit -m "feat(chat-in-the-web-ui): sessions, turns, and items in the cache"
```

## Task 4: Session statuses and messages

**Files:**

- Create: `packages/server/src/runner/status.ts`
- Modify: `packages/server/src/runner/message.ts`
- Test: `packages/server/src/runner/__tests__/status.test.ts`,
  `packages/server/src/runner/__tests__/message.test.ts`

**Interfaces:**

- Produces:

```ts
export type SessionStatus = "working" | "needs-you" | "failed" | "unread" | "idle";
export function sessionStatus(input: {
  latest?: Pick<TurnRow, "state" | "endedAt">;
  queued: boolean;
  blocked: boolean;
  waitsOnHuman: boolean;
  seenAt: string | null;
}): { status: SessionStatus; label: string; reason?: "blocked" | "step" };
export const STATUS_ORDER: Record<SessionStatus, number>; // needs-you 0, failed 1, unread 2, working 3, idle 4
export function runMessage(input: {
  folder: string;
  branch: string;
  bug?: boolean;
  step: string;
  reference: string;
  trigger: Trigger;
  file?: string;
}): string; // three lines, no "No chat session"
export function chatOpening(input: { folder: string; branch: string; bug?: boolean }): string;
export function retryMessage(denial: { tool: string; target?: string }): string;
export function chatTitle(text: string): string; // first non-blank line, cut at 80, else "New chat"
export function toolTarget(
  name: string,
  input: Record<string, unknown>,
  cwd?: string,
): string | undefined;
```

- [x] **Step 1: Write the failing tests**:
  - `status.test.ts`, one table-driven test "sessionStatus", one row per rule: a running latest turn
    → `working`/"Working"; queued only → `working`; running with `waitsOnHuman` → `working`; ended
    with `blocked` → `needs-you`/"Needs you", reason `blocked`; `waitsOnHuman` → `needs-you`, reason
    `step`; latest `failed` → `failed`/"Failed"; `done` ended `2026-10-13T10:00` with `seenAt`
    `09:00` → `unread`/"New reply"; same with `seenAt` `11:00` → `idle`/"Idle"; `stopped` and seen →
    `idle`/"Stopped"; no turn → `idle`/"Idle"; no turn and `waitsOnHuman` → `needs-you`.
  - `message.test.ts`: `runMessage` for
    `{folder: "2026-10-13-chat", branch: "2026-10-13-chat", step: "spec", reference: "skills/uraeda/references/spec.md", trigger: "answers", file: "clarifications-01.md"}`
    is exactly "/uraeda:uraeda Continue the feature specs/2026-10-13-chat/, on branch
    2026-10-13-chat.\nThe human answered clarifications-01.md of the questions.\nIts next step is
    spec: follow skills/uraeda/references/spec.md.\n"; `chatOpening` gives the opening line of the
    global constraints; `retryMessage({tool: "Bash", target: "git push origin HEAD"})` is "Try the
    blocked action again, now allowed: Bash git push origin HEAD"; `chatTitle` cuts "x".repeat(90)
    to 80, keeps "List the open draft files", and gives "New chat" for " \n " (review focus 5);
    `toolTarget("Read", {file_path: "/repo/specs/a.md"}, "/repo")` is "specs/a.md".
- [x] **Step 2: Run them to check they fail**

- Run:
  `vp test packages/server/src/runner/__tests__/status.test.ts packages/server/src/runner/__tests__/message.test.ts`
- Expected: FAIL, `Cannot find module '../status.ts'`

- [x] **Step 3: Implement them**, `sessionStatus` in the order of the spec's status table.
- [x] **Step 4: Run them**: same command, PASS.
- [x] **Step 5: Commit**

```bash
git add packages/server/src/runner/status.ts packages/server/src/runner/message.ts packages/server/src/runner/__tests__/status.test.ts packages/server/src/runner/__tests__/message.test.ts
git commit -m "feat(chat-in-the-web-ui): session statuses and chat messages"
```

## Task 5: The adapter interface, the fake, and Claude Code kept open

**Files:**

- Modify: `packages/server/src/runner/adapter.ts`, `packages/server/src/runner/fake.ts`,
  `packages/server/src/runner/claude.ts`
- Create: `packages/server/src/runner/claude-events.ts` (`parseLine` and its helpers, moved)
- Test: `packages/server/src/runner/__tests__/claude.test.ts`,
  `packages/server/src/runner/__tests__/fake.test.ts`

**Interfaces:**

- Produces, in `adapter.ts`:

```ts
export type Capabilities = {
  steer: boolean;
  queue: boolean;
  takeBack: boolean;
  approvals: boolean;
  subagents: boolean;
};
export type OpenOptions = { cwd: string; nativeId: string; resume: boolean; allowed?: string };
export type Outgoing = { id: string; text: string; when: "steer" | "queue" };
export interface AgentProcess {
  events: AsyncIterable<AgentEvent>; // until its `exit`
  send(message: Outgoing): void;
  takeBack(id: string): void;
  interrupt(): void; // ends the turn, keeps the process
  close(): void; // ends the process once its turn is over
  kill(signal: "SIGINT" | "SIGTERM"): void;
}
export interface Adapter {
  readonly kind: string; // "claude"
  readonly name: string; // "Claude Code"
  readonly capabilities: Capabilities;
  version(): Promise<string | undefined>;
  hasSession(nativeId: string): boolean;
  allowRule(denial: Denial): string;
  open(options: OpenOptions): AgentProcess;
}
```

- Produces, in `events.ts`, `AgentEvent` becomes: `init {sessionId, plugins, pluginErrors}`,
  `textDelta {text}`, `text {text}`,
  `toolStart {id, name, kind: ToolKind, input, target?, parent?, subagent?: {description}}`,
  `toolEnd {id, isError, output}`, `accepted {id}`, `cancelled {id}`, `retry`,
  `result {ok, costUsd?, errors, denials, interrupted: boolean}`, `skipped`, `exit`.
- `ClaudeAdapter({ command?, configDir?, pluginDir })`: `capabilities`
  `{steer: true, queue: true, takeBack: <R5>, approvals: false, subagents: true}`.
- `FakeAdapter`: `capabilities` settable per test; `opens: Array<OpenOptions>`;
  `sent: Array<Outgoing>`; `script(steps)` now scripts the next turn's events, played when a message
  is sent; `emit(event)`, `exit(code?, stderr?)` on the current process; `interrupts`, `closes`,
  `kills: Array<signal>`; `ignoreInterrupt`.

- [ ] **Step 1: Write the failing tests**, table-driven over recorded lines in `claude.test.ts`:
  - `claudeArgs({cwd, nativeId: "id", resume: false}, "/plugin")` is
    `-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --permission-mode auto --plugin-dir /plugin --session-id id`;
    with `resume: true`, `--resume id`; with `allowed`, `--allowedTools <rule>` last.
  - `parseLine` rows: a `stream_event` `text_delta` → `textDelta`; an `assistant` text block →
    `text`; a `tool_use` `Read` → `toolStart` with `kind: "read"`; `Bash` → `execute`; `Grep` →
    `search`; `WebFetch` → `fetch`; `Edit` → `edit`; an `Agent` tool use with
    `input.description: "Map the runner code"` → `toolStart` with `subagent`; an `assistant` message
    with `parent_tool_use_id: "toolu_1"` → its `toolStart` has `parent: "toolu_1"`;
    `command_lifecycle` `started` with `command_uuid: "m1"` → `accepted {id: "m1"}`; `cancelled` →
    `cancelled`; a `result` with `terminal_reason: "aborted_streaming"` and no `result` field →
    `{ok: false, interrupted: true}`; `system/init` repeated at each turn → `init` each time.
  - "send writes a user message with its uuid and priority": a fake child process (spawn `node -e`
    echoing stdin to a file) receives
    `{"type":"user","message":{"role":"user","content":"hi"},"uuid":"m1","priority":"next"}` for
    `when: "steer"`, and `"later"` for `queue`.
  - "interrupt writes the interrupt control request, and close ends stdin".
  - `fake.test.ts`: "a scripted turn plays when a message is sent, then waits for the next".
- [ ] **Step 2: Run them to check they fail**

- Run:
  `vp test packages/server/src/runner/__tests__/claude.test.ts packages/server/src/runner/__tests__/fake.test.ts`
- Expected: FAIL, `claudeArgs` gives no `--include-partial-messages`

- [ ] **Step 3: Implement them**. `ClaudeAdapter.open` spawns once and keeps stdin open; `send`
      writes the user line with `uuid` and `priority` (`next` for steer, `later` for queue);
      `takeBack` writes the request R5 found (a no-op when none); `interrupt` writes
      `{"type":"control_request","request_id":<uuid>,"request":{"subtype":"interrupt"}}`; `close`
      ends stdin; `kill` sends the signal. The `cwd` passed to `toolTarget` makes targets relative.
      `allowRule` moves from `message.ts` into the adapter, unchanged.
- [ ] **Step 4: Run them**: same command, PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/server/src/runner/adapter.ts packages/server/src/runner/events.ts packages/server/src/runner/fake.ts packages/server/src/runner/claude.ts packages/server/src/runner/claude-events.ts packages/server/src/runner/message.ts packages/server/src/runner/__tests__/claude.test.ts packages/server/src/runner/__tests__/fake.test.ts
git commit -m "feat(chat-in-the-web-ui): agents opened once per session, Claude Code kept open"
```

## Task 6: The session manager

**Files:**

- Create: `packages/server/src/runner/sessions.ts`,
  `packages/server/src/runner/__tests__/sessions.test.ts`
- Delete: `packages/server/src/runner/runner.ts`,
  `packages/server/src/runner/__tests__/runner.test.ts`
- Modify: `packages/server/src/runner/__tests__/helpers.ts`

**Interfaces:**

- Consumes: tasks 2 to 5.
- Produces:

```ts
export const IDLE_CLOSE_MS = 15 * 60_000;
export const WATCHDOG_MS = 30 * 60_000;
export const TERMINATE_AFTER_MS = 10_000;
export const OUTPUT_LIMIT = 4_000;
export const REFUSALS: {
  working: string;
  human: string;
  noBranch: string;
  read: string;
  blank: string;
  unavailable: (name: string) => string;
};
export type SessionChange =
  | { agent: true }
  | { repo: string; session: string; folder: string | null; turn?: number; state?: TurnState };
export class Sessions {
  constructor(options: {
    adapter: Adapter;
    cache: SessionCache;
    binding: Binding;
    onChange: (change: SessionChange) => void;
  });
  get cache(): SessionCache;
  get adapter(): Adapter;
  status(): { available: boolean; version: string | null };
  check(): Promise<void>;
  mainRoot(repo: string): Promise<string>;
  working(repo: string): Array<string>; // folders with a running turn
  featureSession(repo: string, folder: string): Promise<SessionRow>; // created when missing
  newChat(repo: string): Promise<SessionRow>;
  send(
    repo: string,
    session: string,
    input: { text: string; workflow?: { trigger: Trigger; file?: string } },
  ): Promise<{ turn: number }>;
  takeBack(repo: string, session: string, message: string): void;
  stop(repo: string, session: string): void;
  allow(repo: string, session: string, turn: number, seq: number): Promise<{ turn: number }>;
  rename(repo: string, session: string, title: string): void;
  archive(repo: string, session: string, archived: boolean): void;
  seen(repo: string, session: string): void;
  settled(turn: number): Promise<void>;
  closeAll(): Promise<void>;
  close(): void;
}
```

Every refusal throws `Error("refused: <text>")`, as the runner did.

- [ ] **Step 1: Write the failing tests**, with `testSessions()` in `helpers.ts` (fake adapter,
      `SessionCache.open(":memory:")`, the real binding, `fixtureRepo()`, `vi.useFakeTimers()` for
      the timers), one test per scenario:
  - US1.1 "a chat message on a feature waiting on the human goes with the opening line": feature
    `2026-10-11-web-ui`; `send(repo, id, {text: "Why did you recommend A in Q6?"})`; the fake's
    first `sent` text is the opening line, a newline, then the question; the turn's first item is a
    `message` with `opening` and `text` apart; `nextStep` still waits on the human.
  - US1.2 "a second message goes without the opening line, on the same process": `adapter.opens` has
    one entry (SC-001).
  - US1.3 "a message sent during a turn is steered into it": the fake's `sent` has `when: "steer"`;
    the item is `pending`; after `emit({type: "accepted", id})` it is `read`; `turns()` has one
    turn.
  - US1.4 "a pending message can be taken back": `takeBack` with `takeBack: true` capability marks
    it `taken-back` after the fake's `cancelled` event; once `read`, `takeBack` refuses with "The
    agent already read it."
  - US1.5 "Stop interrupts the turn and keeps the process": the fake's `interrupts` is 1, `kills`
    empty, the turn ends `stopped`; with `ignoreInterrupt`, after 10 s `kills` is `["SIGINT"]`,
    after 20 s `["SIGINT", "SIGTERM"]`.
  - US1.6 "a feature's writes are refused while its turn runs": `working(repo)` lists the folder.
  - US1.7 and C1 "an idle process closes after 15 minutes, and the next message resumes the same
    session": after `vi.advanceTimersByTime(IDLE_CLOSE_MS)`, `closes` is 1; the next `send` opens
    with `resume: true` and the same `nativeId`.
  - US2.2 "a workflow message starts a workflow turn": `send` with `workflow: {trigger: "manual"}`
    on `2026-10-12-cli-tuis` records `kind: "workflow"`, `step: "plan"`, origin `workflow`.
  - US2.4 "a workflow message on a feature waiting on the human is refused": "The feature waits on
    you now: there is nothing to continue."
  - US2.5 "a workflow message during a chat turn is queued, and starts after it": the second turn is
    `queued`, then `running` once the first turn's `result` arrives.
  - US4.1 "a new chat works in the main checkout, without an opening line, and is titled by its
    first line": the fake's `opens[0].cwd` is the repo; title "List the open draft files".
  - US4.3 "sending to an archived chat brings it back": `archivedAt` is null after.
  - US4.4 "no agent: sends are refused" with "Claude Code is not available on this machine." when
    the fake is not installed (its `name` is "Claude Code").
  - US5.2 "Allow and retry reopens the process with the rule and sends the retry message": the
    previous process got `close()`; the new `opens` entry has
    `allowed: "Bash(git push origin HEAD)"`; `sent` holds "Try the blocked action again, now
    allowed: Bash git push origin HEAD"; the denial item is `allowed: true`.
  - US5.3 "the rule ends with its process": after the idle close, the next open has no `allowed`.
  - Edge "a gone transcript starts a new session, which says so": `adapter.sessions.clear()` before
    the next send; a `system` item "Started a new session: the previous one is gone."; the session's
    `nativeId` changed.
  - Edge "the process exits during a turn: it fails with its stderr"; "between turns: the next
    message resumes it".
  - Edge "an interrupted result with no text ends the turn as stopped".
  - Edge "an init with a new session ID updates the native ID".
  - Edge "a feature with no branch refuses with 'This feature has no branch yet: commit its proposal
    first.'": a draft started without a commit, as the binding's fixtures allow.
  - Edge "the watchdog fails a silent turn after 30 minutes with 'No output for 30 minutes.'".
  - Edge "a plugin that does not load fails the turn with 'The Uraeda skill did not load: <error>'".
  - Review focus 1 "a message sent before the process's init is sent once".
  - Review focus 2 "a queued turn starts on a reopened process when the process died".
  - Sub-agents "a sub-agent's tools carry its parent": items keep `parent`, the sub-agent's tool
    keeps `subagent`.
  - Streaming "deltas update one text item until its block ends": `textDelta` × 3 then `text` gives
    one item, `streaming: false`, with the block's text.
- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner/__tests__/sessions.test.ts`
- Expected: FAIL, `Cannot find module '../sessions.ts'`

- [ ] **Step 3: Implement `Sessions`**. Per session it keeps: the open `AgentProcess`, the running
      turn and its items' state (`tools` by id, the streaming text's `seq`), the queue of turns, and
      the idle and watchdog timers. `send` takes the session's process, opening it with
      `resume = adapter.hasSession(nativeId)`, a new `nativeId` (and the system line) when the
      transcript is gone, in the feature's `workDir` or `mainRoot(repo)`; it writes messages only
      after `init` (review focus 1). A `result` ends the running turn and starts the next queued
      one, writing its message. A process `exit` fails the running turn and, when turns are queued,
      reopens (review focus 2). The idle timer starts when no turn runs; the watchdog runs only
      during a turn. `stop` calls `interrupt()`, then `kill("SIGINT")` after 10 s and
      `kill("SIGTERM")` 10 s later. `claimSession` guards every open; `releaseSession` on close.
      `onChange` fires on every recorded item (with `turn`) and on each state change (with `state`).
- [ ] **Step 4: Run them**: same command, PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/server/src/runner/sessions.ts packages/server/src/runner/__tests__/sessions.test.ts packages/server/src/runner/__tests__/helpers.ts
git rm packages/server/src/runner/runner.ts packages/server/src/runner/__tests__/runner.test.ts
git commit -m "feat(chat-in-the-web-ui): sessions of turns, one process each"
```

## Task 7: Sessions in fate, and their live updates

**Files:**

- Create: `packages/server/src/fate/sessions.ts` (replacing `fate/runs.ts`)
- Modify: `packages/server/src/fate/views.ts`, `fate/sources.ts`, `fate/mutations.ts`,
  `fate/context.ts`, `packages/server/src/live.ts`, `main.ts`, `testing.ts`, `app.ts`, `fate.ts`,
  `packages/server/scripts/validate-claude.ts` (imports)
- Test: `packages/server/src/__tests__/sessions.test.ts` (replacing `runs.test.ts`),
  `packages/server/src/__tests__/live.test.ts`, `packages/server/src/__tests__/search.bench.ts`

**Interfaces:**

- Consumes: `Sessions` (task 6), `sessionStatus` (task 4).
- Produces, records and their data views:

```ts
type AgentRecord = {
  id: "agent";
  kind: string;
  name: string;
  available: boolean;
  version: string | null;
  capabilities: Capabilities;
};
type SessionRecord = {
  id: string;
  folder: string | null;
  agent: string;
  title: string;
  status: SessionStatus;
  statusLabel: string;
  place: string;
  costUsd: number | null;
  turns: Array<string>;
  archived: boolean;
  subagents: Array<{ id: string; description: string }>;
}; // running ones
type TurnRecord = {
  id: string;
  session: string;
  kind: TurnKind;
  trigger: string | null;
  step: string | null;
  state: TurnState;
  reason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  pages: number;
};
type TurnLogRecord = {
  id: string;
  turn: string;
  page: number;
  items: Array<Item & { seq: number }>;
};
type SessionListRecord = { id: string; rows: Array<SessionRow_> }; // id "all"
type SessionSearchRecord = { id: string; rows: Array<SessionRow_> }; // id: the query
type SessionRow_ = {
  id: string;
  folder: string | null;
  title: string;
  status: SessionStatus;
  statusLabel: string;
  archived: boolean;
  updatedAt: string;
  subagents: Array<{ id: string; description: string }>;
};
type WorkflowMessageRecord = { id: string; text: string; step: string }; // id "<folder>:<trigger>[:<file>]"
```

`FeatureRecord.runs` becomes `session: string | null`; `WorkspaceRecord.running` stays. `place` is
"branch <branch>" for a feature, "main checkout, branch <branch>" for a chat. Mutations, each
returning a `Session`:
`session.send {session?: string; folder?: string; text:   string; workflow?: {trigger: Trigger; file?: string}}`
(with `folder`, the feature's session), `session.newChat {}`, `session.takeBack {session, message}`,
`session.stop {session}`, `session.allow {session, turn, seq}`, `session.rename {session, title}`,
`session.archive   {session, archived}`, `session.seen {session}`. `run.start`, `run.allow`, and
`run.stop` are removed. `writable` reads `sessions.working(repo)`.

- [ ] **Step 1: Write the failing tests**:
  - "session.send on a feature creates its session and returns it with its first turn".
  - "a session of another repository is not read" (the cache is shared, as `6f6cebb` required).
  - "SessionList lists features' and chats' sessions with their status, needs you first" (US3.6):
    `2026-10-11-web-ui` (waits on you) before a failed one.
  - "SessionSearch finds a chat by its message text" (US3.5); "a query matching nothing gives no
    rows".
  - "WorkflowMessage gives the message the composer is filled with" (US2.1): for
    `2026-10-12-cli-tuis:manual`, the three lines of `runMessage` with step `plan`.
  - "session.seen turns New reply into Idle" (US3.3).
  - "a write on a feature is refused while its turn runs" (US1.6), with the exact text.
  - `live.test.ts`: "a session's status change is published at once, with the list, its feature, and
    the workspace" and "items are published at most every 250 ms" (SC-002), on fake timers.
  - Review focus 3 "a take-back is published to every reader": after `session.takeBack`, a `Session`
    and its turn's last `TurnLog` page are published.
  - `search.bench.ts` (SC-003): 500 sessions, 100,000 items, `sessions(repo, {query: "needle"})`
    under 200 ms, with `bench` from `vite-plus/test`.
- [ ] **Step 2: Run them to check they fail**

- Run:
  `vp test packages/server/src/__tests__/sessions.test.ts packages/server/src/__tests__/live.test.ts`
- Expected: FAIL, `no mutation session.send`

- [ ] **Step 3: Implement them**: `fate/sessions.ts` reads records through `Sessions` and the cache,
      scoped by `sessions.mainRoot(ctx.repo)`; `sessionPublisher` in `live.ts` replaces
      `runPublisher` with the same throttle; `startSessions` replaces `startRunner`; `Context` holds
      `sessions` in place of `runner`; `main.ts` builds
      `new ClaudeAdapter({ pluginDir:     PLUGIN_DIR })`; `testing.ts` exports `fakeSessions()` in
      place of `fakeRunner()`.
- [ ] **Step 4: Run all tests**

- Run: `vp check && vp test --project uraeda-server`
- Expected: PASS (the web project fails until task 8)

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(chat-in-the-web-ui): sessions, their search, and their live updates in fate"
```

## Task 8: The session view and its composer

**Files:**

- Create: `packages/web/src/SessionPage.tsx`, `packages/web/src/Transcript.tsx` (from `RunLog.tsx`),
  `packages/web/src/Composer.tsx`, `packages/web/src/sessions.ts` (from `runs.ts`)
- Delete: `packages/web/src/RunPage.tsx`, `packages/web/src/RunLog.tsx`, `packages/web/src/runs.ts`
- Modify: `packages/web/src/views.ts`, `data.ts`, `routes.tsx`, `App.tsx`
- Test: `packages/web/src/__tests__/session.test.tsx` (replacing `run.test.tsx`),
  `packages/web/src/__tests__/helpers.tsx`

**Interfaces:**

- Consumes: the records and mutations of task 7.
- Produces:
  - Routes: `{ page: "session"; folder: string }` at `/f/<folder>/session`;
    `{ page: "chat"; id: string }` at `/chats/<id>`; `{ page: "new-chat" }` at `/chats/new`.
    `/f/<folder>/runs/<id>` redirects to `/f/<folder>/session#turn-<id>`.
  - `useAgent()`, `useSession(id)`, `useTurn(id)`, `useTurnLog(id)`, `useSessionList()`,
    `useSessionSearch(query)`, `useWorkflowMessage(folder, trigger, file?)` in `data.ts`.
  - `sendMessage(fate, input): Promise<{ ok: true; session: string } | { ok: false; message: string }>`
    in `sessions.ts`.
  - `Transcript({ session, onAllow? })`: the turns in order, each workflow turn opened by "Run:
    <step label>", items as the spec's [Components](spec.md#components) list them, `id` `turn-<id>`
    on each turn for the redirect's anchor.
  - `Composer({ session?, folder?, agentName, initial?, workflow?, onSent })`: Astryx `ChatComposer`
    and `ChatSendButton`; Send reads "Start the agent" while `workflow` is set.
  - `SessionPage({ folder } | { id } | { newChat: true })`.

- [ ] **Step 1: Write the failing tests**, through `renderPage` with `fakeAgent()`:
  - US1.1: at `/f/2026-10-11-web-ui/session`, type "Why did you recommend A in Q6?", press Send;
    `refreshUntil` the log "Conversation" shows the question and, muted, the opening line, then the
    fake's scripted text "Because …".
  - US1.3: during a scripted turn left open, a second message shows with "Not read yet" and a button
    "Take back" (when the fake declares `takeBack`); with `takeBack: false`, no "Take back".
  - US1.4: "Take back" removes the message and puts its text back in the composer.
  - US1.5: Send turns into "Stop" during a turn; pressing it shows "Stopped".
  - US4.4: with the agent not installed, the composer is disabled with "Claude Code is not available
    on this machine."
  - Edge "a blank message cannot be sent": Send disabled for " ".
  - Edge "a refused send keeps the text and shows the reason under the composer".
  - "an old run's address opens the session at that turn": `/f/<folder>/runs/<id>` →
    `/f/<folder>/session` with hash `#turn-<id>`.
  - Phone: at 402, the session is its own page with crumbs; at 1024, beside the feature page.
  - "the status region says when a reply starts and ends": "Claude Code is replying", then "Reply
    complete".
- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/session.test.tsx`
- Expected: FAIL, no textbox "Message Claude Code"

- [ ] **Step 3: Implement them.** `Transcript` keeps `useOpenGroups` and `useFollowEnd` from
      `RunPage.tsx`; text items render with `Markdown`; a `subagent` tool and the tools whose
      `parent` is its id form one `ChatToolCalls` group of their own; denials render as a warning
      `Banner` "Blocked by auto mode: <tool> <target>" with "Allow and retry" when `onAllow` is
      given and the session is not working. Enter sends when `useWidthClass()` is wide; on narrow,
      only the button sends.
- [ ] **Step 4: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS, except the tests task 9 and 10 rewrite: delete `run.test.tsx`, and mark
  `agent-panel.test.tsx` and `commit-actions.test.tsx` cases that start runs with `test.skip` naming
  task 10, removed there.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(chat-in-the-web-ui): the session view and its composer"
```

## Task 9: Sessions in the sidebar

**Files:**

- Create: `packages/web/src/SessionNav.tsx`, `packages/web/src/StatusMark.tsx`
- Modify: `packages/web/src/Shell.tsx`
- Test: `packages/web/src/__tests__/shell.test.tsx`

**Interfaces:**

- Consumes: `useSessionList()`, `useSessionSearch()` (task 8).
- Produces: `StatusMark({ status, label, small? })`, an Astryx `StatusDot` per the spec's status
  table: `working` accent pulsing, `needs-you` warning with "!", `failed` error with "×", `unread`
  success with "✓", `idle` neutral; used by the sidebar, the session header, and the feature page.

- [ ] **Step 1: Write the failing tests**:
  - US3.1 "a feature waiting on you shows Needs you": the nav row "Web UI" has a status "Needs you".
  - US3.2 "a working turn shows Working, then New reply": after the fake's turn ends, `refreshUntil`
    the row shows "New reply".
  - US3.4 "a running sub-agent shows under its session, then leaves".
  - US3.5 "search filters features and chats by message text", with a 200 ms debounce; "No session
    matches “zzz”." for nothing.
  - US3.6 "needs you sorts first in its group".
  - US4.1 "New chat opens an empty chat, and its first message lists it in Chats".
  - US4.3 "an archived chat moves under Archived".
- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/shell.test.tsx`
- Expected: FAIL, no searchbox "Search sessions"

- [ ] **Step 3: Implement them**: `SessionNav` draws the search field (Astryx `TextInput` with role
      `searchbox`, label "Search sessions"), the feature groups of `Shell.tsx` with each row's
      `StatusMark` as its `icon`, sub-agent rows as `SideNavItem`s indented under their session, and
      the "Chats" section with "New chat" and "Archived".
- [ ] **Step 4: Run all tests**: `vp check && vp test`, PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(chat-in-the-web-ui): sessions in the sidebar, with their status and search"
```

## Task 10: Handing over to the agent, from the feature page and the commit buttons

**Files:**

- Modify: `packages/web/src/AgentPanel.tsx`, `CommitActions.tsx`, `RoundPage.tsx`, `ReviewPage.tsx`,
  `EditorPage.tsx`, `FeaturePage.tsx`, `SessionPage.tsx`
- Test: `packages/web/src/__tests__/agent-panel.test.tsx`,
  `packages/web/src/__tests__/commit-actions.test.tsx`

**Interfaces:**

- Produces: `handOver(folder: string, trigger: Trigger, file?: string): void` in `sessions.ts`,
  navigating to `/f/<folder>/session?continue=<trigger>&file=<file>`; `SessionPage` reads it, fills
  the composer from `useWorkflowMessage`, and sends with `workflow: {trigger, file}`.
  `CommitActions`' default `continueLabel` is "Commit and start the agent" (C2).

- [ ] **Step 1: Write the failing tests**:
  - US2.1 "Commit and start the agent commits, then opens the session with the message, unsent": on
    `2026-10-11-web-ui`'s round, answer, press "Commit and start the agent"; the round is committed
    (`git log` shows "discovery(web-ui): answer round 01"); the composer holds the three lines; the
    fake's `sent` is empty.
  - US2.2 "Send hands over, with the note": add "Keep the spec short.", press "Start the agent"; the
    log shows "Run: Spec", and the fake's `sent[0].text` ends with the note.
  - C2 "every commit button that leads to the agent says it starts the agent": the review page shows
    "Approve and start the agent" and "Request changes and start the agent"; the editor shows "Start
    the feature and the agent"; no button label ends with "and continue".
  - "the feature page shows the session's status and Open the session": US1's entry point; "Start
    the agent" and "Try again" open the session with the message; no "Runs" list.
  - US2.3 "a run ending at a gate shows its closing text last, and Needs you".
  - US5.1 "a blocked action shows Allow and retry, and Needs you".
- [ ] **Step 2: Run them to check they fail**

- Run:
  `vp test packages/web/src/__tests__/agent-panel.test.tsx packages/web/src/__tests__/commit-actions.test.tsx`
- Expected: FAIL, no button "Commit and start the agent"

- [ ] **Step 3: Implement them**: callers of `startRun` call `handOver` after their commit; the
      `continueLabel`s change as C2 says; `AgentPanel` shows `StatusMark`, the latest turn's step
      and time, the cost, Stop while working, "Open the session", and "Start the agent" or "Try
      again" (both `handOver(folder, "manual")`), and drops the runs list.
- [ ] **Step 4: Run all tests**: `vp check && vp test`, PASS, with no skipped test left from task 8.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(chat-in-the-web-ui): read the workflow's message before handing over"
```

## Task 11: Ask the agent about a block

**Files:**

- Modify: `packages/web/src/ReviewPage.tsx`, `packages/web/src/RoundPage.tsx` (or `Question.tsx`,
  where a question's actions are), `packages/web/src/SessionPage.tsx`
- Test: `packages/web/src/__tests__/review.test.tsx`, `packages/web/src/__tests__/round.test.tsx`

**Interfaces:**

- Produces: `askAbout(folder: string, quote: string): void` in `sessions.ts`, navigating to
  `/f/<folder>/session?ask=<encoded quote>`; the composer starts with the quote and an empty line.

- [ ] **Step 1: Write the failing tests**:
  - US6.1: on the spec's review page with lines 50–52 selected, "Ask the agent" opens the session
    with the composer starting "About specs/<folder>/spec.md, lines 50–52:", then the lines quoted
    with `> `, then an empty line.
  - US6.2: on a round's page, Q3's "Ask the agent" gives "About Q3 of
    specs/<folder>/clarifications-01.md:" and the question's title quoted.
- [ ] **Step 2: Run them to check they fail**

- Run:
  `vp test packages/web/src/__tests__/review.test.tsx packages/web/src/__tests__/round.test.tsx`
- Expected: FAIL, no button "Ask the agent"

- [ ] **Step 3: Implement them**, beside "Comment" on the review page, and in each question's
      actions; shown only when the agent is available.
- [ ] **Step 4: Run all tests**: `vp check && vp test`, PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(chat-in-the-web-ui): ask the agent about a block"
```

## Task 12: Layout checks, screenshots, and the validation run

**Files:**

- Modify: `packages/web/src/__browser__/layout.test.tsx`,
  `packages/web/src/__browser__/run.test.tsx` (renamed `session.test.tsx`),
  `packages/web/scripts/screenshots.ts`
- Create: `specs/2026-10-13-chat-in-the-web-ui/screenshots/`

- [ ] **Step 1: Write the failing tests** (SC-004): the session page, a chat, `/chats/new`, and the
      sidebar searched, at both sizes and both themes: no text cut, no sideways scroll, axe clean;
      "the log follows its end while at the end" and "Back keeps the position" on a session page.
- [ ] **Step 2: Run them to check they fail**

- Run: `vp run --filter uraeda-web test:browser` (or the project's browser test command in
  `packages/web/package.json`)
- Expected: FAIL, no route `/chats/new` in the layout list until added

- [ ] **Step 3: Fix what they find**, then take the screenshots of every changed view, both sizes
      and themes, into `specs/2026-10-13-chat-in-the-web-ui/screenshots/`, and review them against
      the [mockups](mockups/chat.html).
- [ ] **Step 4: Run the whole validation**

- Run: `vp run ready`
- Expected: PASS but for `edits_keep_every_other_line`, already failing; then
  `vp check && vp test && vp run --filter uraeda-web build` PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-13-chat-in-the-web-ui/screenshots
git commit -m "test(chat-in-the-web-ui): the session views at both sizes, with screenshots"
```
