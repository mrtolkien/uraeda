---
status: auto-approved
spec-revision: 1
---

# Plan: Claude Code runner (triggered manually)

**Goal:** the web UI's committing actions can start Claude Code on the feature's next step, in one
session per feature, and the feature page follows the run live and stops it.

**Architecture:**

- **The core** gives the step, its reference, and the feature's worktree, through two new binding
  calls.
- **A runner in the server** starts the installed `claude` through an adapter, and keeps sessions,
  runs, and parsed events in a SQLite cache in Uraeda's data folder. It publishes runs through
  fate's live updates.
- **The web UI** adds "Commit and continue", and an agent panel built with Astryx's chat components.

See the [spec's design](spec.md#design), as changed by its [review comments](#review-comments).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

1. **A line of Claude Code's output split across two chunks**, or a multi-byte character split in
   the middle, is parsed as one event, with its characters intact. Task 4.
2. **Two clicks on "Commit and continue" in a row** start one run. The second `run.start` is refused
   with "An agent is already working on this feature.", and the adapter records one start. Task 3.
3. **A run with 250 events** shows all of them, in three log pages of 100, 100, and 50, in order.
   Tasks 5 and 7.
4. **Stop on a run that already ended** changes nothing: the run keeps its state, and no signal is
   sent. Task 3.
5. **`claude` disappears between the availability check and the run** (spawn fails with `ENOENT`).
   The run fails with "Claude Code is not available on this machine." Tasks 3 and 4.

## Global constraints

From the decisions and the spec, word for word. Every task's requirements include these.

From [agents](../decisions/agents.md):

- The server MUST run Claude Code by spawning the `claude` binary found on the machine's `PATH`, in
  print mode, with `--input-format stream-json` and `--output-format stream-json`. It MUST NOT
  depend on the Claude Agent SDK, or bundle a Claude Code binary.
- Every agent MUST be reached through one adapter interface, in `packages/server/src/runner/`: start
  or resume a session in a directory with one message, stream its events, stop it. The tests that
  `vp run ready` runs MUST use a fake adapter, and MUST NOT run a real agent. Validation scripts,
  run by hand when an agent's integration breaks, MAY run the real agent, and MUST be kept in the
  repository.
- Tools MUST NOT read, store, or pass the agent's credentials: the binary uses the user's own login
  or API key.
- Every run MUST pass `--permission-mode auto` explicitly. Tools MUST NOT pass `bypassPermissions`
  or `--dangerously-skip-permissions`. A permission the human grants from the UI MUST be a narrow
  allow rule, passed with `--allowedTools` to a single run, and never written to a settings file.
- A run MUST work in the feature's worktree, as the core returns it, and MUST NOT switch any
  checkout.
- The skill MUST come from the server's own copy, `skills/uraeda`, loaded as a plugin with
  `--plugin-dir`. The run MUST fail when the plugin does not load.
- A feature MUST have at most one session and at most one run at a time. A run MUST NOT start while
  another one is going on the same feature.
- Runs MUST carry the step, its reference, and the trigger in their message, since a resumed session
  keeps its first system prompt.
- Session IDs, runs, and their parsed events MUST be stored in a SQLite database, `runner.sqlite`,
  through Node's built-in `node:sqlite`, in Uraeda's data folder for the user: `URAEDA_DATA_DIR`
  when it is set, or else the operating system's default, `$XDG_DATA_HOME/uraeda/` on Linux
  (`~/.local/share/uraeda/` when `XDG_DATA_HOME` is unset), `~/Library/Application Support/uraeda/`
  on macOS, and `%APPDATA%\uraeda\` on Windows. Its rows MUST be keyed by the repository's main
  checkout path and the feature's folder. It MUST NOT live in a repository. It is a cache: workflow
  state MUST NOT be stored in it, and losing it MUST cost only a new session and the old logs.
- Stopping a run MUST send SIGINT first, and SIGTERM only when the process is still running 10
  seconds later.
- Tools MUST NOT change the agent's commit attribution, model, effort, or settings, except the
  permission mode above: the user's active Claude Code settings apply.

From [stack](../decisions/stack.md):

- Workflow logic, parsing, validation, and workflow states MUST live in the Rust core,
  `crates/core`.
- TypeScript code MUST reach the core only through the binding, `packages/binding`, and MUST NOT
  reimplement its parsing, validation, or states.
- The TypeScript types of core data MUST come from the declarations napi-rs generates for the
  binding. They MUST NOT be redeclared by hand in TypeScript.
- The web UI MUST use React and Astryx components, live in `packages/web`, and get its data only
  from the server, through fate.
- The web UI MUST draw workflow files from the document tree the core sends, and MUST NOT parse
  their markdown, with a library or by hand. It MAY render an agent's messages, which are not
  workflow files, with Astryx's `Markdown` component.

From [git](../decisions/git.md):

- Tools MUST NOT switch the user's checkout to another branch, unless the human asks for it with a
  flag. To write on a branch, they MUST use the checkout or worktree that has it, or else create a
  worktree for it at `.worktrees/<branch>/`, at the root of the main checkout.
- In Rust, every git access MUST go through one module of the core, so no other code uses gix or
  builds `git` command lines.

From [toolchain](../decisions/toolchain.md):

- `vp run ready` MUST run every check of the repository. A new language, package, crate, or tool
  MUST add its checks to it.

From [the spec](spec.md), with its review comments:

- **Refusals**, exactly:
  - "An agent is already working on this feature."
  - "Nothing for the agent: the feature waits on you."
  - "Claude Code is not available on this machine."
  - "An agent is working on this feature. Stop it first, or wait for it."
- **Run messages**, exactly:
  - "Started a new session: the previous one is gone."
  - "The Uraeda skill did not load: <error>"
  - "No activity for 30 minutes."
  - "Stopped: the server stopped."
  - "Stopped: the server stopped while it ran."
  - "Skipped <n> lines Claude Code printed that the runner does not read."
- **Panel texts:**
  - "Working on <step label>", "Done: waiting for you", "Done", "Failed on <step label>", "Stopped";
  - "$<cost> this session", with two decimals;
  - "Blocked by auto mode", "Allow and continue", "Start the agent", "Try again", "Stop", "Earlier
    runs".
- **Buttons:** "Commit and continue", primary, and "Commit only", secondary. Without a working
  `claude`, each page's single button, as today.
- **Timings:**
  - SIGTERM 10 s after SIGINT;
  - watchdog after 30 min without an event;
  - `claude --version` checked at startup and every 60 s;
  - `Run` live updates at most every 250 ms;
  - tool output cut to its first 4,000 characters.
- **Message template:** see [Data](spec.md#data), with the trigger sentences of its table.
- **Spec review C1:** no model or effort selector. No `--model` or `--effort` flag: user story US5
  is not built.

## Code read

**Setup:**

- [`package.json`](/package.json): `vp run ready` runs cargo fmt, clippy, and tests, `ura check` on
  `specs` and the example, the binding's build, `vp check`, `vp test`, and the web build.
- `vp test <filter>` runs the matching test files. The projects are in
  [`vite.config.ts`](/vite.config.ts).
- A new worktree needs `vp install` before any TypeScript runs, and the binding built with
  `vp run --filter uraeda-binding build`.

**The core and the binding:**

- [`crates/core/src/api.rs`](/crates/core/src/api.rs):
  - every write takes `write_lock()`;
  - `open(repo)` reads the workspace;
  - `find` refuses an unknown folder with `refused("no feature <folder>")`;
  - `reach(repo, folder)` returns the feature's `Place`, creating its worktree.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs):
  - `Step { name, waits_on, reference, file, task, pull_request }`;
  - `refresh_pull_request(feature, steps::pull_request)` asks `gh`, and falls back to
    `PullRequest::Unknown` when it fails;
  - [`crates/cli/src/next.rs`](/crates/cli/src/next.rs) uses both.
- [`crates/core/src/actions/place.rs`](/crates/core/src/actions/place.rs): `reach(git, branch)`.
- [`crates/core/src/git.rs`](/crates/core/src/git.rs): `Git::discover`, `root()`, and `main_root()`.
- [`crates/core/src/view.rs`](/crates/core/src/view.rs): napi `object` views with
  `#[serde(rename_all = "camelCase")]`. `StepView` drops `reference` and `pull_request`.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): each export is a `#[napi]` function
  returning `AsyncTask<Job<T>>` through `job(...)`. Errors are `"<code>: <message>"`.
- [`crates/core/tests/api.rs`](/crates/core/tests/api.rs) and
  [`common/repo.rs`](/crates/core/tests/common/repo.rs): `TestRepo` with `write`, `git`,
  `switch_new`, `switch`. Texts come from [`common/texts.rs`](/crates/core/tests/common/texts.rs).
- [`packages/binding/index.test.ts`](/packages/binding/index.test.ts) tests the exports on
  `fixtureRepo()`.

**The fixture repository** ([`fixtures/repo`](/fixtures/repo/), built by
[`test-utils.ts`](/packages/binding/test-utils.ts)):

| Feature                      | Waits on | Gate or step                         |
| ---------------------------- | -------- | ------------------------------------ |
| `2026-10-11-web-ui`          | human    | `clarifications-01.md`, 11 questions |
| `2026-10-06-recurring-tasks` | human    | `spec.md`                            |
| `2026-10-12-cli-tuis`        | agent    | step `plan`                          |
| `2026-10-13-plan-review`     | human    | `plan.md`                            |

Each has a branch and no worktree.

**The server:**

- [`app.ts`](/packages/server/src/app.ts): `createApp(options & { binding })` sets fate's context
  `{ binding, repo }`.
- [`fate.ts`](/packages/server/src/fate.ts): `live = createLiveEventBus()`, the entity types, and
  `fateServer`.
- [`fate/views.ts`](/packages/server/src/fate/views.ts): `dataView<Record>("Type")({...})`, records
  are binding views plus `id`, and `Root` holds one `list()` per type.
- [`fate/sources.ts`](/packages/server/src/fate/sources.ts) and
  [`fate/source.ts`](/packages/server/src/fate/source.ts): `fileSource(view, { byIds, list })`.
- [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts):
  - `{ type, resolve({ ctx, input, select }) }`;
  - `refusable()` turns binding errors into `BAD_REQUEST`, and `callSiteError(message)` builds one
    ([`fate/errors.ts`](/packages/server/src/fate/errors.ts));
  - the folders written: `answer.save`, `notes.save`, `answers.submit`, `commit.retry`, and
    `review.*` take `input.folder`. `text.save` and `text.commit` take `input.path`, which is a
    feature's when it is under `specs/<folder>/` or `specs/bugs/<folder>/`.
- [`live.ts`](/packages/server/src/live.ts): `publish(changes)` and `startLive`.
- [`main.ts`](/packages/server/src/main.ts) and [`dev.ts`](/packages/server/src/dev.ts) build the
  app. `dev.ts` keeps one app per port and repository.
- [`env.ts`](/packages/server/src/env.ts) reads `.env`, then the environment.
- [`__tests__/helpers.ts`](/packages/server/src/__tests__/helpers.ts): `testApp(repo)`,
  `fate(app, operations)`, `byId`, `mutate`. Live updates are tested in
  [`live.test.ts`](/packages/server/src/__tests__/live.test.ts) with fate's SSE handshake.

**The web UI:**

- [`__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx): `renderPage(path, repo)` runs
  `createApp` in process. Its `SilentEventSource` means no live update reaches UI tests.
- [`data.ts`](/packages/web/src/data.ts): `useRequest` plus `useLiveView` per type.
- [`views.ts`](/packages/web/src/views.ts): one `view<Type>()` per type.
- [`errors.ts`](/packages/web/src/errors.ts): `refusal(error)`.
- The commit sites:
  - [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx): `submit` and `retry`, and the "Submit
    answers" button.
  - [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx): `run`, `verdict`, the hook retry, and
    "Request changes" and "Approve".
  - [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx): `commit` and `start`, "Commit" and "Start
    the feature".
- [`FeaturePage.tsx`](/packages/web/src/FeaturePage.tsx): the gate callout.
  [`Home.tsx`](/packages/web/src/Home.tsx): the "Agents at work" rows.
  [`labels.ts`](/packages/web/src/labels.ts): `stepLabel`.
- Astryx 0.6.7 exports:
  - `Chat` components: `ChatMessageList`, `ChatMessage`, `ChatMessageBubble`, `ChatToolCalls`
    (`calls: ChatToolCallItem[]` with `name`, `status`, `target`, `duration`, `resultDetail`), and
    `ChatSystemMessage`;
  - `Markdown` (`children: string`), `StatusDot` (`variant`, `label`, `isPulsing`), `Timer`
    (`startTime`), `Collapsible`, and `CodeBlock`.

**Claude Code** (version 2.1.296 here):

- `system/init` carries `session_id`, `plugins: {name, path}[]`, and `plugin_errors`.
- `assistant` messages carry `message.content` blocks: `text`, and `tool_use` with `id`, `name`, and
  `input`. `user` messages carry `tool_result` blocks with `tool_use_id`, `content`, and `is_error`.
- `system/api_retry` carries `attempt`, `retry_delay_ms`, and `error`.
- `result` carries `subtype`, `is_error`, `total_cost_usd`, `errors`, and `permission_denials`
  (`{tool_name, tool_use_id, tool_input}`).
- The stdin user line is `{"type":"user","message":{"role":"user","content":"..."}}`.

Sources: [headless](https://code.claude.com/docs/en/headless) and the
[TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript).

## Constitution check

| Principle                            | Complies | Notes                                                                    |
| ------------------------------------ | -------- | ------------------------------------------------------------------------ |
| I. Humans stay in control            | yes      | A run starts only from a button. Allow rules last one run (task 3)       |
| II. Git and plain text first         | yes      | The cache holds sessions and logs only, outside the repository (task 2)  |
| III. Asynchronous by default         | yes      | A lost session or cache starts a new session (task 3)                    |
| IV. Review effort matches impact     | yes      | Runs end at the skill's gates                                            |
| V. Tools are optional                | yes      | Without `claude`, the pages keep today's single button (task 6)          |
| VI. Code is checked against the spec | yes      | Every scenario has a test. The adapter and the cache are justified below |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Agents](../decisions/agents.md): the adapter and its fake (tasks 2 and 4), auto mode and
  `--plugin-dir` (task 4), one run per feature (task 3), and the cache in the data folder (task 2).
  The validation script runs the real `claude` (task 4).
- [Stack](../decisions/stack.md):
  - the step and the worktree come from the core (task 1), and their types from the generated
    declarations (task 5);
  - the UI reads runs through fate (tasks 5 to 7);
  - agent messages use Astryx `Markdown` (task 7).
- [Git](../decisions/git.md): the worktree comes from `place::reach` (task 1). The agent commits
  with the system `git`.
- [Toolchain](../decisions/toolchain.md): every new test runs in `vp test`, and the validation
  script stays out of `vp run ready` (task 4).

## Complexity tracking

| Abstraction or exception                    | Why it is needed                                                         | Simpler alternative rejected because                                               |
| ------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `Adapter`, `AgentRun`, and `AgentEvent`     | The agents decision requires one adapter interface, and a fake for tests | Spawning `claude` from the runner would need it in CI, which has none              |
| `FakeAdapter`                               | Every runner, server, and UI test drives runs without Claude Code        | Mocking `child_process` would test the mock, and could not script events           |
| `RunCache`, the only code that opens SQLite | Migrations, keys, and paging in one place                                | SQL in the runner and the fate sources would spread the schema                     |
| `Runner`                                    | One place for the one-run rule, sessions, stopping, and the watchdog     | Logic in mutations would be duplicated across six commit sites                     |
| Log pages of 100 events, `RunLog` records   | A live update resends only the last page, not the whole log              | One `log` field on `Run` would resend thousands of events every 250 ms             |
| `CommitActions` and `AgentPanel` components | Three pages share the two buttons; the panel is the run view             | Copying the buttons into three pages would let them drift                          |
| `startRun` in `packages/web/src/runs.ts`    | Every commit site starts a run the same way, after its commit            | Six inline calls with their trigger and file would drift                           |
| The skill plugin, `packages/server/plugin/` | `--plugin-dir` needs a plugin folder around `skills/uraeda`              | The repository root as the plugin folder would load whatever else lies at the root |

## Review comments

From [spec-review.md](spec-review.md), approved with comments:

- **C1, models and effort:** dropped, the active settings apply. No selector, no `--model` or
  `--effort` (tasks 3, 4, and 6), and the agents decision says so. User story US5 is not built.
  Claude Code not being the recommended runner for future features is recorded in the decision's
  consequences.
- **C2, the cache's folder:** Uraeda's data folder, from the operating system's defaults, keyed by
  the main checkout's path (task 2). The binding needs no `gitCommonDir`, and `nextStep` returns
  `mainRoot` instead (task 1).
- **C3, markdown:** agent texts render with Astryx `Markdown` (task 7), as the stack decision now
  allows.
- **C4, testing against the real Claude Code:** automated tests use the fake adapter. A validation
  script, `packages/server/scripts/validate-claude.ts`, runs the real `claude` (task 4), and the
  implementation runs it before the pull request.

---

## Task 1: The step and the worktree, from the core

**Files:**

- Modify: `crates/core/src/view.rs` (new `NextView`, `NextStepView`), `crates/core/src/api.rs`
  (`next_step`, `work_dir`), `crates/binding/src/lib.rs` (`next_step`, `work_dir`)
- Modify (generated): `packages/binding/index.d.ts`, `packages/binding/index.js`
- Test: `crates/core/tests/runs.rs`, `packages/binding/index.test.ts`

**Interfaces:**

- Produces:
  - Rust: `api::next_step(repo: &Path, folder: &str) -> Result<NextView>`, and
    `api::work_dir(repo: &Path, folder: &str) -> Result<String>`.
  - TypeScript: `nextStep(repo: string, folder: string): Promise<NextView>`, and
    `workDir(repo: string, folder: string): Promise<string>`.
  - `NextView { folder: string, branch?: string, mainRoot: string, step: NextStepView }`.
  - `NextStepView { name, waitsOn, reference?, file?, task?, pullRequest? }`, all strings, with
    `pullRequest` one of `open`, `draft`, `changes-requested`, `none`, `unknown`.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/runs.rs
#[test]
fn next_step_gives_the_reference_of_an_agent_step() {
    let repo = repo_with_answered_round(); // a branch whose round 01 is answered
    let next = api::next_step(repo.path(), FOLDER).unwrap();
    assert_eq!(next.step.name, "spec");
    assert_eq!(next.step.waits_on, "agent");
    assert_eq!(next.step.reference.as_deref(), Some("skills/uraeda/references/spec.md"));
    assert_eq!(next.branch.as_deref(), Some(FOLDER));
    assert_eq!(Path::new(&next.main_root), repo.path().canonicalize().unwrap());
}

#[test]
fn next_step_of_a_gate_names_its_file() { /* awaiting round: waits_on "human", file Some(...), reference None */ }

#[test]
fn work_dir_creates_the_worktree_of_a_branch_not_checked_out() {
    // path == <main>/.worktrees/<branch>, and it exists
}

#[test]
fn work_dir_reuses_the_checkout_that_has_the_branch() { /* switch to the branch: returns repo root */ }

#[test]
fn work_dir_of_a_merged_feature_is_refused() {
    // a record in specs/done on main, no branch: "refused: <folder> has no branch"
}
```

```ts
// packages/binding/index.test.ts
test("nextStep and workDir give where and what an agent runs", async () => {
  const repo = fixtureRepo();
  const next = await binding.nextStep(repo, "2026-10-12-cli-tuis");
  expect(next.step).toMatchObject({
    name: "plan",
    waitsOn: "agent",
    reference: "skills/uraeda/references/plan.md",
  });
  expect(await binding.workDir(repo, "2026-10-12-cli-tuis")).toBe(
    join(repo, ".worktrees", "2026-10-12-cli-tuis"),
  );
});
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test runs`
- Expected: FAIL, ``cannot find function `next_step` in module `api` ``.

- [x] **Step 3: Implement `next_step` and `work_dir` in `crates/core/src/api.rs`, and the views in
      `view.rs`**

- `next_step` opens the workspace, finds the feature, and calls
  `steps::refresh_pull_request(feature, steps::pull_request)`. It returns `NextView` with
  `git.main_root()` as a string.
- `work_dir` takes `write_lock()`, then `reach(repo, folder)`, and returns `place.root` as a string.
  A feature without a branch is refused with `"<folder> has no branch"`.
- `NextStepView::from(&Step)` uses the kebab names `steps.rs` serializes.

- [x] **Step 4: Expose them in `crates/binding/src/lib.rs`, and build the binding**

- `#[napi(ts_return_type = "Promise<NextView>")] pub fn next_step(repo: String, folder: String)`.
- `#[napi(ts_return_type = "Promise<string>")] pub fn work_dir(repo: String, folder: String)`.
- Run: `vp run --filter uraeda-binding build`.

- [x] **Step 5: Run all tests**

- Run: `cargo test --workspace --exclude uraeda-binding && vp test packages/binding`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add crates/core/src/view.rs crates/core/src/api.rs crates/binding/src/lib.rs crates/core/tests/runs.rs packages/binding/index.d.ts packages/binding/index.js packages/binding/index.test.ts
git commit -m "feat(claude-code-runner-triggered-manually-https-code): the step and the worktree for a run"
```

## Task 2: The adapter interface, its fake, and the run cache

**Files:**

- Create: `packages/server/src/runner/events.ts`, `packages/server/src/runner/adapter.ts`,
  `packages/server/src/runner/fake.ts`, `packages/server/src/runner/cache.ts`
- Test: `packages/server/src/runner/__tests__/cache.test.ts`

**Interfaces:**

- Produces, in `events.ts`:

```ts
export type Denial = { tool: string; input: Record<string, unknown> };
export type AgentEvent =
  | { type: "init"; sessionId: string; plugins: Array<string>; pluginErrors: Array<string> }
  | { type: "text"; text: string }
  | { type: "toolStart"; id: string; name: string; input: Record<string, unknown> }
  | { type: "toolEnd"; id: string; isError: boolean; output: string }
  | { type: "retry"; attempt: number; delayMs: number; error: string }
  | { type: "result"; ok: boolean; costUsd?: number; errors: Array<string>; denials: Array<Denial> }
  | { type: "skipped" }
  | { type: "exit"; code: number | null; stderr: string; missing?: boolean };
export type RunEvent = /* the spec's RunEvent, Data section */;
export type RunState = "running" | "done" | "failed" | "stopped";
export type Trigger = "answers" | "approval" | "changes" | "proposal" | "start" | "manual" | "allow";
```

- Produces, in `adapter.ts`:

```ts
export type StartOptions = {
  cwd: string;
  message: string;
  sessionId: string;
  resume: boolean;
  pluginDir: string;
  allowed?: string;
};
export interface AgentRun {
  events: AsyncIterable<AgentEvent>; // ends after its `exit` event
  interrupt(): void; // SIGINT
  terminate(): void; // SIGTERM
}
export interface Adapter {
  version(): Promise<string | undefined>; // undefined when unavailable
  hasSession(sessionId: string): boolean;
  start(options: StartOptions): AgentRun;
}
```

- Produces, in `fake.ts`: `class FakeAdapter implements Adapter`, with:
  - `starts: Array<StartOptions>`, and `interrupts` and `terminates` counters;
  - `installed = true`, `sessions = new Set<string>()`, and `ignoreInterrupt = false`;
  - `script(events: Array<AgentEvent | ((cwd: string) => void)>)`, which queues the next run's
    events. A function runs in the run's `cwd`, for example to commit a file;
  - `emit(event)` and `finish(code = 0, stderr = "")`, which drive the current run by hand.

  A scripted run exits with code 0 after its events, unless they hold an `exit`. A run started
  without a script waits for `emit` and `finish`. Every start adds its session ID to `sessions`, as
  Claude Code writes a transcript: a test removes it to make the transcript missing. An interrupted
  fake emits `{ type: "exit", code: 130, stderr: "" }`, unless `ignoreInterrupt` is set, and a
  terminated one `{ type: "exit", code: 143, stderr: "" }`.

- Produces, in `cache.ts`:

```ts
export function dataDir(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, home: string): string;
export type RunRow = {
  id: number;
  repo: string;
  folder: string;
  sessionId: string;
  newSession: boolean;
  trigger: Trigger;
  step: string;
  allowed: string | null;
  state: RunState;
  reason: string | null;
  costUsd: number | null;
  startedAt: string;
  endedAt: string | null;
};
export class RunCache {
  static open(path: string): RunCache; // ":memory:" in tests; creates the folder; replaces a broken file
  session(repo: string, folder: string): string | undefined;
  saveSession(repo: string, folder: string, sessionId: string): void;
  startRun(row: Omit<RunRow, "id" | "state" | "reason" | "costUsd" | "endedAt">): number;
  appendEvent(runId: number, event: RunEvent): number; // returns its seq
  updateEvent(runId: number, seq: number, event: RunEvent): void;
  endRun(runId: number, end: { state: RunState; reason?: string; costUsd?: number }): void;
  run(id: number): RunRow | undefined;
  runs(repo: string, folder: string): Array<RunRow>; // newest first
  events(runId: number, offset: number, limit: number): Array<RunEvent & { seq: number }>;
  eventCount(runId: number): number;
  interrupted(reason: string): Array<RunRow>; // marks every `running` row stopped, returns them
}
```

- [x] **Step 1: Write the failing tests**

```ts
// packages/server/src/runner/__tests__/cache.test.ts
test.each([
  [{ URAEDA_DATA_DIR: "/data" }, "linux", "/data"],
  [{ XDG_DATA_HOME: "/xdg" }, "linux", "/xdg/uraeda"],
  [{}, "linux", "/home/me/.local/share/uraeda"],
  [{}, "darwin", "/home/me/Library/Application Support/uraeda"],
  [
    { APPDATA: "C:\\Users\\me\\AppData\\Roaming" },
    "win32",
    "C:\\Users\\me\\AppData\\Roaming\\uraeda",
  ],
])("the data folder for %o on %s is %s", (env, platform, expected) => {
  expect(dataDir(env, platform as NodeJS.Platform, "/home/me")).toBe(expected);
});

test("sessions are kept per repository and folder", () => {
  const cache = RunCache.open(":memory:");
  cache.saveSession("/repo/a", "2026-10-12-cli-tuis", "3f2c");
  expect(cache.session("/repo/a", "2026-10-12-cli-tuis")).toBe("3f2c");
  expect(cache.session("/repo/b", "2026-10-12-cli-tuis")).toBeUndefined();
});

test("a run's events come back in order, a tool event updated in place", () => {
  /* seq 0,1; update seq 1 to complete */
});
test("runs come back newest first, with their end", () => {
  /* two runs; endRun with cost 3.1 */
});
test("reopening the file keeps the runs", () => {
  /* temp dir file, open, write, open again: run(id) */
});
test("runs left running are marked stopped on startup", () => {
  // interrupted("Stopped: the server stopped while it ran.") returns the run, state "stopped"
});
test("the schema is at version 1", () => {
  /* PRAGMA user_version = 1 */
});
```

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner`
- Expected: FAIL, `Failed to resolve import "../cache.ts"`.

- [x] **Step 3: Implement `events.ts`, `adapter.ts`, `fake.ts`, and `cache.ts`**

- The schema is the [spec's](spec.md#data), with these changes:
  - `sessions` has `repo` in its primary key, `(repo, folder)`, and no `model` or `effort` (C1, C2);
  - `runs` gains `repo TEXT NOT NULL`, and an index on `(repo, folder, id)`.
- Migrations are an array of SQL strings, applied while `PRAGMA user_version` is below their number,
  in one transaction.
- `dataDir` uses `node:path`'s `win32.join` on Windows and `posix.join` elsewhere.
- `RunEvent` data is stored as JSON in `events.data`.

- [x] **Step 4: Run all tests**

- Run: `vp test packages/server`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server/src/runner
git commit -m "feat(claude-code-runner-triggered-manually-https-code): the agent adapter, its fake, and the run cache"
```

## Task 3: The runner

**Files:**

- Create: `packages/server/src/runner/message.ts`, `packages/server/src/runner/runner.ts`
- Test: `packages/server/src/runner/__tests__/message.test.ts`,
  `packages/server/src/runner/__tests__/runner.test.ts`,
  `packages/server/src/runner/__tests__/helpers.ts`

**Interfaces:**

- Consumes: `nextStep` and `workDir` (task 1); `Adapter`, `FakeAdapter`, `RunCache`, and the event
  types (task 2).
- Produces, in `message.ts`:
  - `type TriggerDetail = { trigger: Trigger; file?: string; rule?: string }`.
  - `triggerSentence(detail: TriggerDetail): string`, with the spec's table. The file names the
    round and the kind:
    - `clarifications-01.md` gives "round 01";
    - `spec.md`, `plan.md`, and `assessment.md` give "spec", "plan", and "assessment";
    - `proposal.md` gives "proposal", and `report.md` gives "bug report".
  - `runMessage(input: { folder: string; branch: string; bug?: boolean; step: string; reference: string; detail: TriggerDetail }): string`.
    A bug's message reads "Continue the bug specs/bugs/<folder>/" (ruling R10).
  - `toolTarget(name: string, input: Record<string, unknown>): string | undefined`. It returns
    `command`, `file_path`, `url`, `pattern`, or `path`, the first present.
  - `allowRule(denial: Denial): string`, with the spec's rule table.
- Produces, in `runner.ts`:

```ts
export type RunnerChange =
  { runner: true } | { repo: string; folder: string; run: number; state: RunState };
export type RunnerOptions = {
  adapter: Adapter;
  cache: RunCache;
  binding: Binding;
  pluginDir: string;
  onChange: (change: RunnerChange) => void;
};
export const REFUSALS: { busy: string; human: string; unavailable: string }; // the spec's texts
export class Runner {
  constructor(options: RunnerOptions);
  status(): { available: boolean; version: string | null }; // last check; unavailable before one
  check(): Promise<void>; // claude --version; onChange({ runner: true }) when it changes
  running(repo: string): Array<string>; // folders with a running run
  start(repo: string, folder: string, detail: TriggerDetail): Promise<number>; // the run id
  allow(repo: string, runId: number, seq: number): Promise<number>; // refused unless seq is a denial
  settled(runId: number): Promise<void>; // resolves once the run has ended
  stop(runId: number): void;
  stopAll(): Promise<void>; // "Stopped: the server stopped."
  close(): void; // clears its timers
}
```

`start` rejects with `Error("refused: <text>")`, which fate's `refusable` passes on. `repo` is the
server's repository as given, and `running`, `onChange`'s `repo`, and the one-run rule use it as
given. The cache's rows are keyed by `nextStep`'s `mainRoot` instead, so a fate source reads a
feature's runs with `cache.runs(mainRoot, folder)` (ruling R9). A run with trigger `allow` passes
`detail.rule` as its `allowed`.

- [x] **Step 1: Write the failing tests, and the helpers they use**

`__tests__/helpers.ts` provides:

- `testRunner(repo?)`, which resolves to `{ runner, adapter, cache, repo, changes }` with a
  `FakeAdapter`, `RunCache.open(":memory:")`, the real binding, `pluginDir: "/plugin"`, and the
  recorded `onChange` calls, after one `runner.check()`;
- `settle(runner, id)`, which awaits `runner.settled(id)`, and `flush()`, one `setImmediate`.

```ts
// message.test.ts
test.each([
  [
    { trigger: "answers", file: "clarifications-01.md" },
    "The human answered round 01 of the questions.",
  ],
  [{ trigger: "approval", file: "spec.md" }, "The human approved the spec."],
  [{ trigger: "changes", file: "plan.md" }, "The human requested changes on the plan."],
  [{ trigger: "proposal", file: "report.md" }, "The human committed the bug report."],
  [{ trigger: "start" }, "The human started the feature."],
  [{ trigger: "manual" }, "The human asked you to continue."],
  [
    { trigger: "allow", rule: "Bash(gh pr create --draft)" },
    "The human allowed `Bash(gh pr create --draft)`: run it again, then continue.",
  ],
])("the sentence of %o", (detail, sentence) => expect(triggerSentence(detail)).toBe(sentence));

test.each([
  [{ tool: "Bash", input: { command: "gh pr create --draft" } }, "Bash(gh pr create --draft)"],
  [{ tool: "Write", input: { file_path: "/home/me/.ssh/config" } }, "Write(/home/me/.ssh/config)"],
  [{ tool: "WebFetch", input: { url: "https://example.com/a?b" } }, "WebFetch(domain:example.com)"],
  [{ tool: "mcp__x__y", input: {} }, "mcp__x__y"],
])("the allow rule of %o", (denial, rule) => expect(allowRule(denial)).toBe(rule));

test("the message names the skill, the step, its reference, and the trigger", () => {
  expect(
    runMessage({
      folder: "2026-10-12-cli-tuis",
      branch: "2026-10-12-cli-tuis",
      step: "plan",
      reference: "skills/uraeda/references/plan.md",
      detail: { trigger: "manual" },
    }),
  ).toBe(
    "/uraeda:uraeda Continue the feature specs/2026-10-12-cli-tuis/, on branch 2026-10-12-cli-tuis.\n" +
      "The human asked you to continue.\n" +
      "Its next step is plan: follow skills/uraeda/references/plan.md.\n" +
      "No chat session is attached: work until the next human gate, and commit every step. The commit is\nthe message.\n",
  );
});
```

```ts
// runner.test.ts, on fixtureRepo(); FOLDER = "2026-10-12-cli-tuis", waiting on an agent at `plan`
test("US3.1: a first run starts a new session in the feature's worktree", async () => {
  const { runner, adapter, cache, repo } = testRunner();
  adapter.script([{ type: "result", ok: true, costUsd: 0.5, errors: [], denials: [] }]);
  const id = await runner.start(repo, FOLDER, { trigger: "manual" });
  await settle(runner, id);
  const [start] = adapter.starts;
  expect(start.resume).toBe(false);
  expect(start.cwd).toBe(join(repo, ".worktrees", FOLDER));
  expect(cache.session(repo, FOLDER)).toBe(start.sessionId);
  expect(cache.run(id)).toMatchObject({
    state: "done",
    costUsd: 0.5,
    newSession: true,
    step: "plan",
  });
});
test("US3.2: a later run resumes the session", async () => {
  /* adapter.sessions has it: resume true, same id */
});
test("US3.3: a session without a transcript is replaced", async () => {
  // first event of the second run: { kind: "system", text: "Started a new session: the previous one is gone." }
});
test("US3.4 and review focus 2: a second run on the same feature is refused", async () => {
  // second start rejects with "refused: An agent is already working on this feature."; adapter.starts.length === 1
});
test("a feature waiting on the human is refused", async () => {
  // "2026-10-11-web-ui": "refused: Nothing for the agent: the feature waits on you."
});
test("an unavailable claude is refused", async () => {
  /* adapter.installed = false; check(); "refused: Claude Code is not available on this machine." */
});
test("US2.3: Stop interrupts, and the run is stopped once it exits", async () => {
  /* interrupts 1, state "stopped", reason null */
});
test("US2.4: SIGTERM follows 10 seconds after an ignored interrupt", async () => {
  // vi.useFakeTimers(); ignoreInterrupt; stop; advance 9_999 ms: terminates 0; advance 1 ms: terminates 1
});
test("review focus 4: Stop on an ended run changes nothing", async () => {
  /* interrupts 0, state "done" */
});
test("the watchdog stops a silent run after 30 minutes", async () => {
  // advance 30 * 60_000: interrupted, state "failed", reason "No activity for 30 minutes."
});
test("a plugin that does not load fails the run", async () => {
  // init with pluginErrors ["missing path"]: state "failed", reason "The Uraeda skill did not load: missing path"
});
test("a failed result keeps its errors", async () => {
  /* result ok false, errors ["Rate limit reached"]: reason "Rate limit reached" */
});
test("review focus 5: a missing binary fails the run", async () => {
  // exit { missing: true }: state "failed", reason "Claude Code is not available on this machine."
});
test("an exit without a result keeps the last 20 lines of stderr", async () => {
  /* 25 lines in, 20 out */
});
test("events become the log", async () => {
  // text, toolStart Bash { command: "vp run ready" }, toolEnd after 2_500 ms (fake timers):
  // events: text, then tool { name "Bash", target "vp run ready", status "complete", durationMs 2500 }
});
test("tool output is cut to 4,000 characters", async () => {});
test("skipped lines are counted in one system line", async () => {
  // three skipped: "Skipped 3 lines Claude Code printed that the runner does not read."
});
test("an API retry is a system line", async () => {
  /* retry 30_000 rate_limit: "Rate limited, retrying in 30 s." */
});
test("US6.1 and US6.4: denials are logged, and allow runs once with their rule", async () => {
  // result denials [{ tool: "Bash", input: { command: "gh pr create --draft" } }]
  // event { kind: "denial", tool: "Bash", target: "gh pr create --draft", rule: "Bash(gh pr create --draft)" }
  // allow(repo, id, seq): start.allowed === "Bash(gh pr create --draft)", message has the allow sentence
  // the run after it: start.allowed undefined
});
test("US1.4: a run that commits up to a gate ends done", async () => {
  // script: a function that writes plan.md with status awaiting-human and commits it in cwd, then result ok
  // run done; binding.nextStep(...).step.waitsOn === "human"
});
test("stopAll stops every run with the server's reason", async () => {});
test("the runner publishes each change", async () => {
  /* changes include { run: id, folder, repo } */
});
test("every run passes auto mode and the plugin, for every trigger", () => {
  // SC-006 is checked on the Claude adapter's arguments in task 4; here: start.pluginDir === "/plugin"
});
```

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner`
- Expected: FAIL, `Failed to resolve import "../message.ts"`.

- [x] **Step 3: Implement `message.ts`**

The message is the spec's template, with the `/uraeda:uraeda` skill name from the plugin, and the
same line breaks as the test's.

- [x] **Step 4: Implement `runner.ts`**

`start(repo, folder, detail)`:

1. Refuse when the folder has a running run, or when the last check found no `claude`.
2. Call `nextStep`: refuse unless `step.waitsOn === "agent"` and `step.reference` is set.
3. Call `workDir`, and `readFeature` for the feature's kind, a bug or not.
4. Pick the session:
   - the cached ID, with `resume: true`, when `adapter.hasSession(id)`;
   - otherwise a new `crypto.randomUUID()`, saved, with the "Started a new session" line when an old
     ID existed.
5. Write the run, and start the adapter with `runMessage(...)`.
6. Consume the events in the background:
   - each event resets the 30-minute watchdog;
   - `toolEnd` updates its `toolStart`'s event, with `durationMs` from the runner's clock;
   - the `result` sets the cost and the denials;
   - `exit` ends the run: `done` after an `ok` result, `stopped` after `stop`, and `failed`
     otherwise.

`stop` interrupts, and then terminates after 10,000 ms when the run is still going. `onChange` is
called for every event, and the server throttles it.

- [x] **Step 5: Run all tests**

- Run: `vp test packages/server`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/server/src/runner
git commit -m "feat(claude-code-runner-triggered-manually-https-code): the runner: sessions, runs, stop, and the watchdog"
```

## Task 4: The Claude Code adapter, its plugin, and the validation script

**Files:**

- Create: `packages/server/src/runner/claude.ts`
- Create: `packages/server/plugin/.claude-plugin/plugin.json`, with `{ "name": "uraeda" }`
- Create: `packages/server/plugin/skills/uraeda`, a symbolic link to `../../../../skills/uraeda`
- Create: `fixtures/claude/` with recorded stream-json lines: `init.jsonl`,
  `init-plugin-error.jsonl`, `text.jsonl`, `tool.jsonl`, `result-success.jsonl`,
  `result-denied.jsonl`, `result-error.jsonl`, `retry.jsonl`, `ignored.jsonl`, `unknown.jsonl`
- Create: `packages/server/scripts/validate-claude.ts`, and a root `package.json` script
  `"validate:claude": "node packages/server/scripts/validate-claude.ts"`
- Modify: `packages/server/tsconfig.json`, which includes `scripts` so the script is type checked
- Test: `packages/server/src/runner/__tests__/claude.test.ts`

**Interfaces:**

- Consumes: `Adapter`, `AgentRun`, `AgentEvent`, `StartOptions` (task 2).
- Produces:
  - `claudeArgs(options: StartOptions): Array<string>`;
  - `parseLine(line: string): Array<AgentEvent>`;
  - `lines(chunks: AsyncIterable<Buffer>): AsyncIterable<string>`;
  - `class ClaudeAdapter implements Adapter`, built as
    `new ClaudeAdapter({ command = "claude", configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude") })`;
  - `PLUGIN_DIR`, the absolute path of `packages/server/plugin`.

- [x] **Step 1: Write the failing tests**

```ts
// claude.test.ts
test("SC-006: a new session's arguments", () => {
  expect(
    claudeArgs({ cwd: "/w", message: "m", sessionId: "3f2c", resume: false, pluginDir: "/p" }),
  ).toEqual([
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "auto",
    "--plugin-dir",
    "/p",
    "--session-id",
    "3f2c",
  ]);
});
test("a resumed session with an allow rule", () => {
  // [..., "--resume", "3f2c", "--allowedTools", "Bash(gh pr create --draft)"]
});
test("no argument skips permissions or sets a model", () => {
  // for both shapes above: none of "bypassPermissions", "--dangerously-skip-permissions", "--model", "--effort"
});
test.each([
  ["init.jsonl", [{ type: "init", sessionId: "…", plugins: ["uraeda"], pluginErrors: [] }]],
  ["text.jsonl", [{ type: "text", text: "Reading the answers" }]],
  [
    "tool.jsonl",
    [
      { type: "toolStart", id: "toolu_1", name: "Bash", input: { command: "vp run ready" } },
      { type: "toolEnd", id: "toolu_1", isError: false, output: "ok" },
    ],
  ],
  ["retry.jsonl", [{ type: "retry", attempt: 1, delayMs: 30000, error: "rate_limit" }]],
  ["result-success.jsonl", [{ type: "result", ok: true, costUsd: 3.1, errors: [], denials: [] }]],
  [
    "result-denied.jsonl",
    [
      {
        type: "result",
        ok: true,
        costUsd: 0.4,
        errors: [],
        denials: [{ tool: "Bash", input: { command: "gh pr create --draft" } }],
      },
    ],
  ],
  [
    "result-error.jsonl",
    [{ type: "result", ok: false, costUsd: 0.4, errors: ["Rate limit reached"], denials: [] }],
  ],
  ["unknown.jsonl", [{ type: "skipped" }]],
])("the lines of %s", (file, events) => {
  /* every line of the fixture through parseLine, flattened */
});
test("a line that is not JSON is skipped", () =>
  expect(parseLine("Warning: x")).toEqual([{ type: "skipped" }]));
test("review focus 1: a line split across chunks, in the middle of a character, is one line", async () => {
  // chunks: Buffer of '{"type":"assistant", ... "text":"é' cut inside the two bytes of é, then the rest and "\n"
  // lines() yields one line whose text contains "é"
});
test("a session exists when its transcript is found", () => {
  // temp configDir with projects/-w/3f2c.jsonl: hasSession("3f2c") true, hasSession("9a9a") false
});
test("review focus 5: a missing command exits as missing", async () => {
  // new ClaudeAdapter({ command: "/nonexistent/claude" }).start(...): last event { type: "exit", missing: true }
});
test("version() is undefined without the command", async () => {});
```

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner/__tests__/claude.test.ts`
- Expected: FAIL, `Failed to resolve import "../claude.ts"`.

- [x] **Step 3: Record the fixtures, and implement `claude.ts`**

**The fixtures:** take their lines from a real run of
`claude -p --output-format stream-json --verbose` here, shortened to what the tests read. Each line
keeps the fields of the [Code read](#code-read). The tests expect the recorded values: the session
IDs, tool IDs, and costs of those runs. `retry.jsonl` follows the documented fields, since a retry
cannot be caused on purpose, and `unknown.jsonl` has a made-up type
([R13](rulings.md#r13-the-fixtures-come-from-runs-shaped-to-give-each-line)).

**`parseLine`:** a line of a type Claude Code documents that the runner has no use for, like hooks,
rate limit status, or thinking tokens, gives no event, which `ignored.jsonl` tests. Only a line that
is not JSON, or of an undocumented type, is `skipped`
([R12](rulings.md#r12-documented-lines-the-runner-has-no-use-for-give-no-event)). `plugin_errors` is
`null` when every plugin loaded, and each error's `message` is kept.

**`start`:**

- Spawn the command with `claudeArgs(options)` and `cwd`, with `stdio: ["pipe", "pipe", "pipe"]`.
- Write `JSON.stringify({ type: "user", message: { role: "user", content: options.message } })` and
  a newline on stdin, then end stdin.
- `events` yields each `parseLine` of `lines(stdout)`, then one `exit` with the last 20 lines of
  stderr, once stdout and stderr have closed. A spawn `error` with code `ENOENT` gives
  `missing: true`.
- `interrupt()` and `terminate()` send `SIGINT` and `SIGTERM`.

**The rest:**

- `version()` runs `claude --version` with a 5-second timeout, and returns its first line.
- `hasSession(id)` checks for `<configDir>/projects/*/<id>.jsonl` with `readdirSync`, without
  reading any file.
- `lines` decodes with one `TextDecoder` in streaming mode, and splits on `\n`.

- [x] **Step 4: Write `packages/server/scripts/validate-claude.ts`**

The script runs the real `claude` through `ClaudeAdapter` on a temporary `fixtureRepo()`. It prints
one line per check, `ok` or `FAIL` with what it got, and exits 1 on any failure. The checks:

1. `version()` returns a version.
2. A first run, with the message
   `/uraeda:uraeda Reply with the single word ready, and do nothing else.`, gives an `init` with
   `uraeda` in its plugins and no plugin error, then an `ok` result. Its transcript shows the skill
   loaded from the plugin's copy, so `/uraeda:uraeda` is the skill's name.
3. `hasSession` is true for that session ID afterwards.
4. A resumed run, with "Reply with the word again", gives `init.sessionId` equal to the first.
5. A run asked to run `node -e "setTimeout(() => {}, 30000)"` and interrupted after its `toolStart`
   exits within 10 s. A resumed run after it gives an `ok` result. Claude Code refuses a bare
   `sleep 30` itself, so the command waits in node
   ([R14](rulings.md#r14-the-interrupt-check-waits-in-node-not-with-sleep)).

Its header comment says when to run it: after a Claude Code upgrade, or when runs break.

- [x] **Step 5: Run all tests, then the validation script against this machine's `claude`**

- Run: `vp test packages/server`
- Expected: PASS.
- Run: `vp run validate:claude`
- Expected: five `ok` lines. If a check fails, fix the adapter or the fixtures, and record what
  changed in `rulings.md`.

- [x] **Step 6: Commit**

```bash
git add packages/server/src/runner/claude.ts packages/server/src/runner/__tests__/claude.test.ts packages/server/plugin fixtures/claude packages/server/scripts package.json
git commit -m "feat(claude-code-runner-triggered-manually-https-code): run Claude Code, with the skill as a plugin"
```

## Task 5: Runs in fate, and the server's wiring

**Files:**

- Create: `packages/server/src/fate/runs.ts` (the records, `writable`), and
  `packages/server/src/testing.ts` (`fakeRunner`, exported as `uraeda-server/testing`)
- Modify:
  - `packages/server/src/fate/context.ts` (`runner` in `Context`);
  - `packages/server/src/fate/views.ts` (`RunnerRecord`, `RunRecord`, `RunLogRecord`, and `running`
    on `WorkspaceRecord`, `runs` on `FeatureRecord`);
  - `packages/server/src/fate/sources.ts`, `packages/server/src/fate/mutations.ts` (`run.start`,
    `run.allow`, `run.stop`, and the write refusal);
  - `packages/server/src/fate.ts` (entity types);
  - `packages/server/src/app.ts` (`runner` option);
  - `packages/server/src/live.ts` (`runPublisher`, `createRunner`, `startRunner`);
  - `packages/server/src/main.ts` and `packages/server/src/dev.ts` (build the runner, stop it on
    exit), and `packages/web/vite.config.ts` (`stopDevRuns` when Vite's server closes);
  - `packages/server/src/env.ts` (`loadDataDir`);
  - `packages/server/src/runner/runner.ts` (`Runner.cache`, `REFUSALS.working`) and
    `packages/server/src/runner/cache.ts` (`eventsOf`);
  - `packages/server/package.json` (the `./testing` export);
  - `.env.example` (`URAEDA_DATA_DIR`).
- Modify: `packages/server/src/__tests__/helpers.ts` (`testApp` with an unavailable runner, and a
  new `testServer`), and `packages/web/src/__tests__/helpers.tsx` (an unavailable runner, so that
  `createApp` type-checks; task 6 adds the `agent` option)
- Test: `packages/server/src/__tests__/runs.test.ts`, a case in `live.test.ts`, `env.test.ts`, and
  `dev.test.ts`, and `eventsOf` in `runner/__tests__/cache.test.ts`

**Interfaces:**

- Consumes: `Runner` (task 3), `ClaudeAdapter` and `PLUGIN_DIR` (task 4), `RunCache` and `dataDir`
  (task 2).
- Produces, the fate records:
  - `Runner { id: "runner", available: boolean, version: string | null }`, read by id with
    `RUNNER_ID` (`"runner"`, exported by `uraeda-server/fate`);
  - `Run`, with:
    - `id: string`, `folder: string`, `trigger: string`, `step: string`, `state: string`,
      `reason: string | null`, `costUsd: number | null`;
    - `startedAt: string`, `endedAt: string | null`;
    - `newSession: boolean`, `allowed: string | null`;
    - `pages: number`, the count of log pages of 100 events;
    - `denials: Array<{ seq: number; tool: string; target: string | null; rule: string }>`;
  - `RunLog { id: "<run>:<page>", run: string, page: number, events: Array<RunEvent & { seq: number }> }`;
  - `Workspace.running: Array<string>`, the folders with a running run;
  - `Feature.runs: Array<string>`, the run IDs, newest first;
  - the roots `runner`, `run`, and `runLog` (by id), and the entity types `Runner`, `Run`, `RunLog`,
    and `Trigger`, exported by `uraeda-server/fate`.
- Produces, the mutations:
  - `run.start({ folder: string; trigger: Trigger; file?: string }) → Run`, the new run. It refuses
    the `allow` trigger, which goes through `run.allow`;
  - `run.allow({ run: string; seq: number }) → Run`, the new run;
  - `run.stop({ run: string }) → Run`, the run as it was when SIGINT was sent, still `running`: its
    live update brings `stopped`. An unknown run is refused with `refused: no run <id>`.
- Produces, in `createApp`: `createApp(options & { binding; runner: Runner })`.
- Produces, for tests: `fakeRunner({ installed = true }) → { runner, adapter }` from
  `uraeda-server/testing`, a runner on the `FakeAdapter` and an in-memory cache, publishing live
  updates, not checked yet.

- [x] **Step 1: Write the failing tests, and the helpers they use**

`testApp(repo, allowedHosts)` keeps its signature and return. Inside, it builds a `Runner` on a
`FakeAdapter` with `installed = false`, so existing tests see no runner.

A new `testServer(repo = fixtureRepo(), { installed = true } = {})` returns
`{ app, adapter, runner, repo }`. It builds a `FakeAdapter`, `RunCache.open(":memory:")`, and
`pluginDir: "/plugin"`, through `fakeRunner`, and awaits `runner.check()` before returning.

```ts
// runs.test.ts, FOLDER = "2026-10-12-cli-tuis"
test("US4.1: run.start starts a run and returns it", async () => {
  // mutate run.start { folder: FOLDER, trigger: "manual" } → { state: "running", step: "plan", folder: FOLDER }
});
test("US1.2 and SC-004: submitting answers alone starts nothing", async () => {
  // answers.submit on an answered web-ui round: adapter.starts.length === 0
});
test("US1.1: submitting then run.start sends the round's sentence", async () => {
  // answer every question of 2026-10-11-web-ui (helpers from fate.test.ts), answers.submit, run.start { trigger: "answers", file: "clarifications-01.md" }
  // adapter.starts[0].message contains "The human answered round 01 of the questions." and "Its next step is spec: follow skills/uraeda/references/spec.md."
});
test("a commit on a feature with a running run is refused", async () => {
  // run.start on FOLDER; text.save on specs/FOLDER/proposal.md → error "refused: An agent is working on this feature. Stop it first, or wait for it."
});
test.each([
  "answer.save",
  "notes.save",
  "answers.submit",
  "commit.retry",
  "review.comment",
  "review.approve",
  "review.requestChanges",
  "text.commit",
])("%s is refused during a run", async (name) => {
  /* each, with a valid input for FOLDER */
});
test("drafts and priorities stay writable during a run", async () => {
  /* priorities.add ok */
});
test("US2.6: runs are read back with their log pages", async () => {
  // 250 events (review focus 3): Run.pages === 3; RunLog "<id>:2" has 50 events with seq 200..249
});
test("run.stop stops the run", async () => {});
test("run.allow starts a run with the denial's rule", async () => {});
test("the workspace lists running folders, and the feature its runs", async () => {});
test("Runner reads unavailable without claude", async () => {
  /* adapter.installed = false */
});
```

```ts
// live.test.ts
test("SC-002: a run's events reach a subscribed Run within a second", async () => {
  // subscribe to Run <id>; adapter.emit({ type: "text", text: "Reading the answers" }); the update arrives in under 1,000 ms
});
```

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/runs.test.ts`
- Expected: FAIL, `No mutation run.start`, or the helper's missing `adapter`.

- [x] **Step 3: Implement the views, sources, and mutations**

- **Records:** `RunRecord` and `RunLogRecord` are built from `RunCache` rows in
  `packages/server/src/fate/runs.ts`, a new file, through `ctx.runner.cache`. A feature's `runs` are
  read with the main checkout that `nextStep` gives, once per repository
  ([R15](rulings.md#r15-a-features-runs-are-read-with-the-main-checkout-from-its-first-step)).
- **The write refusal:** a helper `writable(ctx, folder)` throws
  `callSiteError("refused: An agent is working on this feature. Stop it first, or wait for it.")`.
  It runs at the top of every mutation that takes a feature's `folder`, or a `path` under
  `specs/<folder>/` or `specs/bugs/<folder>/`.
- **`run.start`** maps a refusal through `refusable`.
- **Live updates:** `runPublisher(cache)` is the runner's `onChange`, and `createRunner` wires it.
  It publishes:
  - `Run` and the last two `RunLog` pages, where a tool call may end, throttled to 250 ms per run,
    and right away on a state change;
  - `Feature` and `Workspace` on start and end;
  - `Runner` when availability changes.

- [x] **Step 4: Wire the server**

- **`startRunner({ adapter, binding, dataDir, pluginDir })`**, in `live.ts`, returns
  `{ runner, stop }`:
  - It opens `RunCache.open(join(dataDir, "runner.sqlite"))`.
  - It calls `cache.interrupted("Stopped: the server stopped while it ran.")`.
  - It builds the runner with `createRunner`, awaits `check()`, and checks every 60,000 ms.
  - `stop()` clears the check, awaits `runner.stopAll()`, and calls `runner.close()`.
- **`main.ts`:** calls `startRunner` with `new ClaudeAdapter()`, `PLUGIN_DIR`, and
  `loadDataDir(process.cwd())`, which reads `URAEDA_DATA_DIR` from the environment or `.env`
  ([R17](rulings.md#r17-uraeda_data_dir-is-read-from-env-too)), before serving, and passes the
  runner to `createApp`. On `SIGINT` and `SIGTERM`, it awaits `stop()`, then exits.
- **`dev.ts`:** `devHandler(root, { adapter? })` does the same once per process, with the first
  request, shared by its apps. `stopDevRuns()` stops the runs, called when Vite's HTTP server
  closes, and the next request starts a new runner.
- **`.env.example`:** gains `URAEDA_DATA_DIR=`, with a comment naming the default folders.

- [x] **Step 5: Run all tests**

- Run: `vp test packages/server && vp check`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/server .env.example
git commit -m "feat(claude-code-runner-triggered-manually-https-code): runs in fate, and the runner in the server"
```

## Task 6: "Commit and continue"

**Files:**

- Create: `packages/web/src/CommitActions.tsx`, `packages/web/src/runs.ts`
- Modify:
  - `packages/web/src/views.ts` (`RunnerView`, `RunView`, `RunLogView`, and `runs` on `FeatureView`,
    `running` on `WorkspaceView`);
  - `packages/web/src/data.ts` (`useRunner`, `useRun`, `useRunLog`);
  - `packages/web/src/RoundPage.tsx`, `packages/web/src/ReviewPage.tsx`,
    `packages/web/src/EditorPage.tsx`.
- Modify: `packages/web/src/__tests__/helpers.tsx` (`renderPage(path, repo, { agent })`: an
  unavailable fake by default, so existing tests keep their single buttons)
- Test: `packages/web/src/__tests__/commit-actions.test.tsx`

**Interfaces:**

- Consumes: the fate records and mutations (task 5).
- Produces:
  - `CommitActions({ label, variant?, isDisabled?, continueLabel = "Commit and continue", onlyLabel = "Commit only", onCommit: (continues: boolean) => Promise<boolean> })`:
    - with an available runner, `continueLabel` (primary) and `onlyLabel` (secondary);
    - otherwise one button with `label` and `variant`;
    - `onCommit` returns whether the commit succeeded.
  - `startRun(fate, input: { folder: string; trigger: Trigger; file?: string }): Promise<string | undefined>`,
    which returns the refusal message, if any.
  - `useRunner()`, `useRun(id)`, `useRunLog(ids)`.

- [ ] **Step 1: Write the failing tests**

```ts
// commit-actions.test.tsx
test("US1.6: without claude, the round keeps Submit answers", async () => {
  await renderPage(ROUND, answeredRepo());
  expect(await screen.findByRole("button", { name: "Submit answers" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Commit and continue" })).toBeNull();
});
test("US1.1: Commit and continue commits the round and starts the agent", async () => {
  const { agent, repo } = await renderPage(ROUND, answeredRepo(), { agent: true });
  await tap(await screen.findByRole("button", { name: "Commit and continue" }));
  await waitFor(() => expect(agent.starts).toHaveLength(1));
  expect(git(repo, "log", "-1", "--format=%s", WEB_UI).trim()).toBe(
    "discovery(web-ui): answer round 01",
  );
  expect(agent.starts[0].message).toContain("The human answered round 01 of the questions.");
  expect(await screen.findByText("The agent is working on the spec.")).toBeTruthy();
});
test("US1.2: Commit only commits, and starts nothing", async () => {});
test("US1.3: approving a spec with Commit and continue starts the agent", async () => {
  // 2026-10-06-recurring-tasks spec review page: "The human approved the spec."
});
test("requesting changes with Commit and continue starts the agent", async () => {});
test("committing a proposal and starting a feature offer both buttons", async () => {
  // the draft editor: "Commit and continue" starts with trigger "start" after feature.start
});
test("US1.5: Try again after a refused hook keeps Commit and continue", async () => {
  // a pre-commit hook that fails once (helpers set core.hooksPath in the repo), then Try again: one start
});
test("SC-001: the feature page shows the run within 2 seconds", async () => {
  // after Commit and continue, navigate to /f/<folder>: "Working on Spec" in under 2,000 ms
});
```

The page message after a started run reads "The agent is working on the <step label, lowercase>."
When `run.start` is refused, the page shows the refusal message, and the commit stays done.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/commit-actions.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "Commit and continue"`.

- [ ] **Step 3: Implement `CommitActions`, `startRun`, the views, and the hooks, and use them on the
      three pages**

**Where it is used:**

- `RoundPage` passes `label="Submit answers"`.
- `ReviewPage` uses it for "Approve", and a second `CommitActions` with `label="Request changes"`,
  variant destructive. Its two continue buttons read "Approve and continue" and "Request changes and
  continue". Its "Commit only" buttons read "Approve only" and "Request changes only".
- `EditorPage` uses it for a proposal's or a report's "Commit", and for "Start the feature". A
  draft's "Commit" keeps its single button.

**The choice:** each page keeps the last `continues` in state, so that its hook retry calls
`startRun` after a successful retry.

- [ ] **Step 4: Run all tests**

- Run: `vp test packages/web && vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(claude-code-runner-triggered-manually-https-code): commit and continue"
```

## Task 7: The agent panel, and Home

**Files:**

- Create: `packages/web/src/AgentPanel.tsx`, `packages/web/src/RunLog.tsx`
- Modify: `packages/web/src/FeaturePage.tsx` (the panel under the gate callout),
  `packages/web/src/Home.tsx` ("Working" badge)
- Test: `packages/web/src/__tests__/agent-panel.test.tsx`

**Interfaces:**

- Consumes: `useRun`, `useRunLog`, `startRun` (task 6), and `run.stop` and `run.allow` (task 5).
- Produces:
  - `AgentPanel({ feature })`: the latest run, its buttons, and "Earlier runs";
  - `RunLog({ run })`: every page of the run's log, in order.

- [ ] **Step 1: Write the failing tests, and the helpers they use**

`renderPage(..., { agent: true })` exposes the fake. A helper `seedRun(agent, events)` scripts a run
and starts it through `run.start` before rendering.

```ts
test("US2.1 and C3: an agent's text renders as markdown", async () => {
  // a text event "Reading **the answers**": a <strong> with "the answers", inside a chat message
});
test("US2.2: a tool call shows its target and duration", async () => {
  // Bash "vp run ready", complete after 2,500 ms: a row with "Bash", "vp run ready", "2.5 s"
});
test("US2.3: Stop stops the run", async () => {
  /* tap Stop: agent.interrupts === 1, then "Stopped" */
});
test("US2.5: the panel shows the session's cost", async () => {
  /* result 3.1: "$3.10 this session" */
});
test("US2.6: earlier runs are listed", async () => {
  /* two runs: "Earlier runs", 1 */
});
test("US2.7: Home shows a working agent", async () => {
  /* "Working" badge on the cli-tuis row */
});
test("US4.1: Start the agent starts a run", async () => {
  /* cli-tuis feature page: agent.starts[0].message contains "The human asked you to continue." */
});
test("US4.2: Try again after a failure", async () => {
  /* failed with "Rate limit reached": the text, then Try again → a second start */
});
test("US4.3: a feature waiting on you has no Start the agent", async () => {
  /* web-ui feature page */
});
test("US6.1 and US6.2: a blocked action can be allowed", async () => {
  // "Blocked by auto mode", "Bash: gh pr create --draft"; tap "Allow and continue": agent.starts[1].allowed === "Bash(gh pr create --draft)"
});
test("review focus 3: 250 events show in order", async () => {
  /* the 1st and the 250th texts both render, in order */
});
test("a run done at a gate says so", async () => {
  /* "Done: waiting for you" when the feature waits on the human */
});
test("a merged feature shows its runs and no button", async () => {});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/agent-panel.test.tsx`
- Expected: FAIL, `Unable to find an element with the text: Start the agent`.

- [ ] **Step 3: Implement `AgentPanel`, `RunLog`, and the two page changes**

**`RunLog`:**

- Texts are `ChatMessage sender="assistant"` around a `ChatMessageBubble` holding
  `<Markdown density="compact" headingLevelStart={4}>`.
- Consecutive tool events are one `ChatToolCalls`. Each call's `duration` is formatted as `2.5 s`,
  or `340 ms` below a second, and its `resultDetail` is a `CodeBlock` of `output`.
- System events and denials are `ChatSystemMessage`s.

**`AgentPanel`:**

- **State:** `StatusDot`, pulsing while running, with the panel texts of the
  [global constraints](#global-constraints).
- **Time and cost:** `Timer` from `startedAt` while running, and the duration once ended. The cost
  shows only when known.
- **Buttons:**
  - Stop while running;
  - "Start the agent" when the feature waits on an agent with no run going;
  - "Try again" after a failed or stopped run when the feature still waits on an agent.
- **Denials:** each in a `Banner`, with "Allow and continue".
- **Earlier runs:** a `Collapsible` with the count, listing each run's step, state, and date, and
  its `RunLog` when opened.

**Home:** a row shows `Badge label="Working"` when `workspace.running` has its folder, in place of
the step badge. Its subtitle keeps the step's label.

- [ ] **Step 4: Run all tests**

- Run: `vp test packages/web && vp check`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(claude-code-runner-triggered-manually-https-code): the agent panel"
```

## Task 8: Documentation, the full check, and a real run

**Files:**

- Modify: `README.md` (the runner: "Commit and continue", what it needs, the data folder, and the
  validation script), `AGENTS.md` (`packages/server/plugin/` and `packages/server/scripts/` in the
  repository layout)

**Interfaces:**

- Consumes: everything above.

- [ ] **Step 1: Update `README.md` and `AGENTS.md`**

In the README's web UI section, add:

- that "Commit and continue" runs the installed `claude`, signed in, in `auto` mode;
- where the cache lives;
- that `vp run validate:claude` checks the integration.

Name no agent as an author.

- [ ] **Step 2: Run the full check**

- Run: `vp run ready`
- Expected: PASS, with the working tree unchanged.

- [ ] **Step 3: Run the validation script, and a real run on a fixture feature**

- Run: `vp run validate:claude`
- Expected: five `ok` lines.
- Then run `vp dev` on a temporary `fixtureRepo()` (`URAEDA_REPO`), open the `2026-10-12-cli-tuis`
  feature, and click "Start the agent". Then check:
  - the log shows the agent's messages and tools;
  - Stop stops it;
  - "Try again" resumes the same session.

  Record the result in the pull request's description.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs(claude-code-runner-triggered-manually-https-code): the Claude Code runner"
```
