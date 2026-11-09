---
status: auto-approved
spec-revision: 2
---

# Plan: Run options

**Goal:** Every workflow step runs as its own run on its own agent, model, effort, and session, set
in the settings and per feature, with the build's implementers and the reviewers run by Uraeda as
sessions of the feature.

**Architecture:** Four owners, each in one place (see the
[spec's architecture](spec.md#architecture)):

- **The Rust core owns the options' data**: reading and writing the `[runs]` tables of
  `config.toml`, migrating `build_in_fresh_session`, checking a set of options, merging a feature's
  options over the settings, mapping each workflow step to its run step, and writing and committing
  `findings-NN.md`. Everything crosses the binding as plain objects.
- **The server owns runs**: a feature's options in its cache database, which session each run goes
  to and on which pick (`runner/run-session.ts`), and the step chain that starts the next step's run
  when one ends before a gate (`runner/chain.ts`). The rule of which joints cut is one TypeScript
  module, `packages/server/src/run-options.ts`, exported as `uraeda-server/run-options`: the server
  and the web UI both use it, replacing the two copies of `FRESH_STEPS`.
- **The sub-agent tool** is an MCP endpoint of the server at `/mcp`, with a token per agent process.
  It has two tools: `run_agent` starts an implementer's sub-session in its task's worktree; `review`
  runs every reviewer at once and commits their findings. Sub-sessions are sessions with a `parent`
  and a `role`: they never become their folder's latest session, never block or wait for their
  folder's other sessions, and stop with their parent.
- **The web UI** wires the run map, the strip, and the sub-session views, already built as stories
  in `packages/web/src/runs/`, to the server's data, removing their `TEMPORARY` markers.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both. Its
stored formats are in [data-model.md](data-model.md).

## Review focus

The conditions the spec implies but does not name. Each is pinned in the task that owns the code.

1. **A sub-session is never its folder's latest session.** A feature's runs, the continuer, and
   Continue all go to the latest session: a sub-session created after its parent must not take its
   runs. Task 8.
2. **Sub-sessions do not wait for each other.** Three implementers of a wave and their parent share
   a folder, where "only one session works at a time" holds for every other session. Task 8.
3. **A token belongs to one process.** A token of a closed process, a token of another session, and
   no token are refused with 401, without saying which. Task 3.
4. **A worktree an agent names must be one of the repository's.** `run_agent` refuses a path that is
   not a worktree of the feature's repository, or is its main checkout. Task 8.
5. **A chained run is no automatic continue.** It counts nothing toward the cap, and a run the human
   stopped never chains. Task 6.
6. **The chain does not loop.** A run whose step did not move on starts nothing, even when the step
   still waits on the agent. Task 6.
7. **A legacy session has no step.** A feature started before this branch keeps working: a session
   without `step` reads as the run step of its latest workflow turn. Task 6.
8. **A findings commit takes only its file.** Committing `findings-NN.md` in the feature's worktree
   never commits other changes there. Task 2.
9. **The old setting is read once, then written away.** `build_in_fresh_session = false` with a
   `[runs.steps.plan]` table already present keeps the table's `new_session`. Task 1.

## Global constraints

From the [Run options](/specs/decisions/run-options.md) decision, word for word:

- A workflow run MUST end with its step.
- Uraeda MUST start the next step's run itself, until the next human gate.
- Steps MUST share a session only where the human joined them.
- A step on another agent or model MUST start a new session.
- Every sub-agent of a workflow run MUST be a session Uraeda starts, on the agent, model, and effort
  its role is set to, never the agent's built-in sub-agents.
- A reviewer MUST be either an agent, using that agent's own review where it has one, or a command
  the human wrote.
- Every reviewer's findings MUST be committed in the feature's folder before they are fixed.
- A feature's options MUST be kept in Uraeda's data folder, never in a repository.
- Run options MUST be shown and edited as one diagram of the steps, the same wherever they appear,
  every action by keyboard and by tap.
- A value the human never picked SHOULD fall back to the settings, then to the agent's own default.

From the [Models](/specs/decisions/models.md) decision:

- A session MUST keep the agent and the model it started with, its automatic runs included.
- A new session MUST start on the model and effort the human picked for it, where it starts or in
  the run options of its step or role, else on the agent's own defaults.
- An effort MUST be picked among the levels the model takes, separately from the model.
- A session's effort MAY change between its turns, from its next turn on, by the human or by the
  next step it runs.

From the [Agents](/specs/decisions/agents.md) decision:

- Uraeda MUST NOT read or change an agent's credentials or settings.
- Every conversation with an agent MUST be a session, run in the worktree of its change or feature,
  or of one of its tasks.
- Sessions MUST be a cache in Uraeda's data folder, never stored in a repository.

From the [Settings](/specs/decisions/settings.md) decision:

- A write MUST keep a human's comments, unknown keys, and order.
- A write MUST NOT overwrite a file that is unreadable or invalid.
- Finding, reading, validating, and writing the settings and the theme files MUST live in the Rust
  core.

From the [Run lifecycle](/specs/decisions/run-lifecycle.md) decision:

- Automatic continues MUST stop after the number in a row the human set, without a commit or a
  message from them.
- A run the human stopped or dismissed MUST NOT continue by itself.

From the [Keyboard](/specs/decisions/keyboard.md) decision:

- A shortcut MUST be declared in the key registry, and listened for nowhere else.
- A key MUST NOT mean two things at once on one page.

From the [Stack](/specs/decisions/stack.md) and [Git](/specs/decisions/git.md) decisions:

- Workflow logic, parsing, validation, and states MUST live in the Rust core.
- TypeScript MUST reach the core only through the binding, never reimplementing it.
- Rust tools MUST read git with the gix library, and write through the system `git`, from one module
  of the core.

From the [Testing](/specs/decisions/testing.md) decision, at the `early` stage:

- A feature MUST test little beyond stored formats, git, security, contracts between the project's
  parts, pure logic with many cases, and the reproduction of each bug fixed.

From the [Code quality](/specs/decisions/code-quality.md) decision: files stay under 500 lines and
functions under 100 (`vite.config.ts`, clippy); a new marker needs the human's approval.

Exact values from the spec:

- The steps, in order: `discovery`, `spec`, `plan`, `build`, `review`, `comments`; their names
  Discovery, Spec, Plan, Build, Review, Comments.
- The default: Discovery and Spec share session 1, a cut before Plan, Plan to Comments share session
  2; every tile "Default". `new_session` is `true` for `plan` when unset, ignored on `discovery`,
  and forced on a step whose agent or model differs from the step before.
- `review_depth`: `waves` (each wave and the branch) or `branch`; `waves` when unset.
- An empty or missing `[[runs.reviewers]]` means one agent reviewer on the review step's agent and
  its defaults. A reviewer table holds `agent` or `command`, never both.
- A model gone: "Spec runs on Opus 4.1, which Claude Code no longer lists." (the step's name, the
  model as stored, the agent's name).
- A reviewer that fails: "Did not review: Codex is not available on this machine."
- A command reviewer that exits with an error: its section holds its output and its exit code.
- Progress is reported every 30 seconds.
- Claude Code's review is `/code-review` at a level matching the reviewer's effort; Codex's is its
  review on the reviewer's model, its effort set on the turn before.
- `findings-NN.md`: frontmatter `reviewed` (`wave 2`, or `branch`) and `commits` (`<base>..<head>`),
  then a `## <Reviewer>` section per reviewer, named as the map shows it: "Codex · GPT-6.1-Sol".
  `NN` counts the reviews of the branch, the waves' included.
- The strip reads "defaults", or what differs: "Spec on Opus · High".

## Code read

- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs) (473 lines) and
  [`settings/file.rs`](/crates/core/src/settings/file.rs) (308): `RunSettings` holds
  `build_in_fresh_session` and the continues; `parse_runs` reads them; `change_path` edits any table
  path keeping comments, the model for writing `[runs.steps.<step>]`. Tests in
  `crates/core/tests/settings.rs`: the table `reads_each_file`, and
  `sets_building_in_a_fresh_session_in_its_own_table`, which goes.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): `StepName` and `Step`, which crosses the
  binding as `NextView.step`; its names are the workflow's steps, which Task 2 maps to run steps.
- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs): `FileKind::of` knows a file by
  name; an unknown name is skipped by the reader and by `ura check`, and is an error in a change's
  folder (`check/names.rs`, `change_holds`). `check/values.rs` lists each kind's frontmatter.
- [`runner/send.ts`](/packages/server/src/runner/send.ts): `sendTo` decides a fresh session with
  `FRESH_STEPS` and `freshByDefault`, on the pick of the session sent to.
  [`send-input.ts`](/packages/server/src/runner/send-input.ts): `SendInput.workflow.fresh` and
  `freshByDefault`. Callers pass `freshByDefault` from the setting in
  [`fate/send-mutations.ts`](/packages/server/src/fate/send-mutations.ts) and
  [`fate/session-moves.ts`](/packages/server/src/fate/session-moves.ts).
- [`runner/message.ts`](/packages/server/src/runner/message.ts): `goal(step, planReview)` gives each
  run its work and its stop; `runMessage`, `recommendedMessage`, `sentAsChat`. Tests in
  `runner/__tests__/message.test.ts` assert "Write the plan, then implement it".
- [`runner/picks.ts`](/packages/server/src/runner/picks.ts): `newSessionPick` and `checkEffort`, the
  one rule of what a new session runs on; `newSessionRuntime` in
  [`runtimes.ts`](/packages/server/src/runner/runtimes.ts) refuses an agent off.
- [`runner/session-folders.ts`](/packages/server/src/runner/session-folders.ts): `featureSession`,
  the latest session or a new one; `newSession`.
- [`runner/turns.ts`](/packages/server/src/runner/turns.ts): `Turns.end` ends every turn and asks
  `continuer.ended`, holding the end's publication while a promise settles; `Turns.next` starts the
  queue; `wake` starts the folder's other waiting sessions.
- [`runner/continuer.ts`](/packages/server/src/runner/continuer.ts): restart and limit continues,
  `#current` requires a chat or the folder's latest session.
- [`runner/status.ts`](/packages/server/src/runner/status.ts): `sessionStatus` gives `halted` ("The
  run stopped before a gate") when a workflow turn ended `done` and the feature still waits on the
  agent: what scenario US2 3 relies on.
- [`runner/live-sessions.ts`](/packages/server/src/runner/live-sessions.ts): `otherWorking(live)`
  blocks a turn while another session of its folder works.
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts): `open(live)` resolves the cwd
  (`binding.workDir` for a folder) and calls `adapter.open(OpenOptions)`;
  [`adapter.ts`](/packages/server/src/runner/adapter.ts): `OpenOptions`, `AgentProcess`, `Adapter`.
- [`runner/claude.ts`](/packages/server/src/runner/claude.ts): `claudeArgs` (`--allowedTools` is
  variadic and last); `spawnGrouped` in `child.ts` passes no `env`. Test: `claude.test.ts`, "the
  model and effort picked are arguments; none skips permissions".
- [`runner/codex.ts`](/packages/server/src/runner/codex.ts) (484 lines): `codexThreadParams`, whose
  `config` holds only the project's trust, asserted by `codex.test.ts`'s "a thread's permissions";
  `codex-turns.ts` starts turns and sets the effort; `codex-rpc.ts` answers every server request
  with an error.
- [`runner/migrations.ts`](/packages/server/src/runner/migrations.ts): ten migrations; a new one is
  appended. `SessionRow` in `cache-rows.ts`, `NewSession` and `insertSession` in
  `cache-sessions.ts`, `latestSession` and `folderSessions` in `cache.ts`.
- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts): `stop(repo, session)`.
- [`fate/continue-all.ts`](/packages/server/src/fate/continue-all.ts): `continueOne`, the model the
  chain follows: next step, recommended message, `sessions.send`.
- [`fate/change-starts.ts`](/packages/server/src/fate/change-starts.ts) and
  [`fate/starts.ts`](/packages/server/src/fate/starts.ts): a change's start takes a pick and sends
  its first run; a feature's start takes none.
- [`fate/views.ts`](/packages/server/src/fate/views.ts) (486 lines) and
  [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) (411): `SessionRecord`,
  `FeatureRecord.sessions`; `featureRecord` lists the folder's sessions.
- [`settings.ts`](/packages/server/src/settings.ts) and
  [`fate/settings-mutations.ts`](/packages/server/src/fate/settings-mutations.ts):
  `RunSettingsView`, `settingsChanged`.
- [`app.ts`](/packages/server/src/app.ts), [`main.ts`](/packages/server/src/main.ts),
  [`sign-in/check.ts`](/packages/server/src/sign-in/check.ts): the routes; the host guard; paths
  outside `SERVER_PATHS` pass sign-in, so `/mcp` checks its own token, as `fromHost` compares a
  bearer token in constant time. The port is known in `serve()`.
- The web UI: [`runs/`](/packages/web/src/runs/) holds `RunMap`, `RunStrip`, `FeatureRuns`,
  `SubSessionRow`, `SubSessionBar`, `runOptions.ts`, `subSessions.ts`, with `TEMPORARY` markers in
  `FeatureRuns.tsx`, `subSessions.ts`, `feature/SessionsPane.tsx`, `session/SubagentsPanel.tsx`, and
  `SessionView.tsx`. `RunMap` and `RunStrip` listen for keys on their own, which fails
  `keys-structural.test.ts` on the branch today: the baseline's only failure.
- Settings UI: `settings/RunSettings.tsx`, `categories.ts`, `ServerSettings.tsx`, `optimistic.ts`,
  `SettingsPage.tsx`, `SettingsView.stories.tsx`; the record in `web/src/views.ts` (498 lines).
- Start dialogs: `StartDialog.tsx` (prop `runs`), `NewFeatureComposer.tsx`, `NewChangePage.tsx`.
  `HandOver.tsx` holds the second `FRESH_STEPS` and the "Build in a fresh session" switch.
- Tests: Rust with cargo-nextest; TypeScript with Vitest, the server's in Node, the web UI's in
  happy-dom with `renderPage` (`web/src/__tests__/helpers.tsx`) over the in-process server and a
  fake agent. `vp run fast` after each task, `vp run ready` before a push. `vp run validate:claude`
  and `vp run validate:codex` check the integrations against the installed agents, outside `ready`.
- The skill: [implementation](/skills/uraeda/references/implementation.md) gives tasks to "a fresh
  implementer agent" and reviews with "a fresh reviewer agent, on the most capable model available";
  [change](/skills/uraeda/references/change.md) has one review; `SKILL.md`'s step 4 runs the next
  step in the same session.
- Docs: [`docs/web-ui.md`](/docs/web-ui.md) lists `build_in_fresh_session` and the change's picker.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ⚠️             | ✅         | ✅                | ✅                |

II: a feature's options live in Uraeda's data folder, not in git, as the human chose in the
clarifications and the spec's constitution check records. Findings stay in git.

## Complexity tracking

| Abstraction or exception                           | Why it is needed                                                                                                                  | Simpler alternative rejected because                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `crates/core/src/settings/runs.rs`                 | the `[runs]` tables, their migration, checks, and merge; `settings.rs` is at 473 lines                                            | growing `settings.rs` passes its limit                                                                      |
| `packages/server/src/run-options.ts`               | the joint rule, read by the server's session choice and the web UI's map: the clarifications asked for one home                   | the web's copy in `runOptions.ts` would stay a second rule, as `FRESH_STEPS` was                            |
| `packages/server/src/mcp/` (endpoint and tokens)   | the sub-agent tool both agents reach; no MCP library is in the project, and the protocol needed is three JSON-RPC methods         | a library adds a dependency for 150 lines of protocol                                                       |
| `runner/run-session.ts`                            | which session a run goes to, and on which pick: `send.ts` today, which grows past what it should own                              | inlining in `sendTo` mixes delivery and the session rule                                                    |
| `runner/chain.ts`                                  | starting the next step's run when one ends, beside the continuer, which owns automatic continues                                  | putting it in the continuer mixes two rules the Run lifecycle decision keeps apart (a chain is no continue) |
| `runner/sub-sessions.ts` and `runner/reviews.ts`   | starting, waiting for, and stopping sub-sessions; running reviewers and writing their findings                                    | in `sessions.ts` (464 lines) they pass its limit                                                            |
| `runner/codex.ts` at 484 lines                     | Task 7 adds the tool's configuration: its thread parameters move to `codex-thread.ts` first, in a structural step                 | adding to `codex.ts` passes 500                                                                             |
| `web/src/views.ts` at 498 lines                    | Task 10 adds run options to the settings record: the settings' selections move to `settings/settingsViews.ts` first, structurally | adding to `views.ts` passes 500                                                                             |
| `fate/views.ts` (486) and `fate/sessions.ts` (411) | Task 12 adds sub-sessions to the session record: they go in `fate/sub-session-views.ts`                                           | growing them passes 500                                                                                     |

## Test map

Tests run on real code: Rust tests write settings files and git repositories in temporary folders;
server tests run the session manager on its SQLite cache in a temporary data folder, with the fake
agent of `runner/fake.ts` and a clock the test sets; MCP tests make real HTTP requests to the app;
the web UI's test renders the page over the in-process server. Real agents are checked only by
`validate:claude` and `validate:codex`, outside `ready`. New tests: 20, at the ceiling of 20 (17 key
scenarios and 3 high edge cases).

| Spec                                                                 | Task  | Test                                                                                                                                              |
| -------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1 1 (the defaults' sessions)                                       | 5     | `server/src/__tests__/run-options.test.ts`, the joints table, row "defaults"                                                                      |
| US1 2 (Spec on Opus High, written to `[runs.steps.spec]`, cut locks) | 1, 5  | `crates/core/tests/run_options.rs` `writes_a_step_in_its_own_table`; the joints table, row "a step on another model"                              |
| US1 3 (Space cuts a joint, `new_session = true`)                     | 1     | `writes_a_step_in_its_own_table` also writes `new_session`                                                                                        |
| US1 more 1 (a lock: Space changes nothing)                           | 5     | the joints table, row "forced": `withCut` of a forced joint still cuts                                                                            |
| US1 more 2 (`build_in_fresh_session = false` read, then replaced)    | 1     | `crates/core/tests/run_options.rs` `migrates_the_old_switch` (rewrites the replaced settings test)                                                |
| Review focus 9 (old switch with a plan table)                        | 1     | `migrates_the_old_switch`, its second row                                                                                                         |
| US2 1 (plan committed, run ends, Sonnet build starts)                | 6     | `runner/__tests__/chain.test.ts` "a plan run that ends at the build starts the build's run in a new session on its pick"                          |
| US2 2 (joined revision continues, effort Medium)                     | 6     | `chain.test.ts` "a revision joined to its spec runs in the spec's session, on its own effort"                                                     |
| US2 3 (no plan, no build; asks for you)                              | 6     | `chain.test.ts` "a run whose step did not move on starts nothing" (status `halted` stays owned by `status.test.ts`)                               |
| Review focus 5, 6 (no count, no chain after Stop; no loop)           | 6     | rows of the three `chain.test.ts` tests                                                                                                           |
| Review focus 7 (legacy session)                                      | 6     | row of "a revision joined to its spec…"                                                                                                           |
| US2 more 1 (limit continues in the build's session)                  | none  | the continuer's existing tests own it: a continue goes to its turn's session                                                                      |
| US2 more 2 (Continue all sends to the build's session)               | 6     | `continue-all.test.ts`'s existing test, now through `run-session.ts`; no new test                                                                 |
| US3 1 (3 Codex implementers at once, their answers back)             | 8     | `runner/__tests__/sub-sessions.test.ts` "run_agent runs each task in its own sub-session at once, on the role's pick"                             |
| Review focus 1, 2 (never latest; no waiting)                         | 8     | assertions of the same test                                                                                                                       |
| US3 2 (Stop on the parent stops the sub-agent)                       | 8     | `sub-sessions.test.ts` "Stop on a parent stops its sub-sessions"                                                                                  |
| US3 more 1, SC-003 (40 or 60 minutes, progress every 30 s)           | 3     | `server/src/__tests__/mcp.test.ts` "a long call reports progress every 30 seconds", on a clock the test sets                                      |
| Niche: a repeated call gets the first one's answer                   | 8     | row of "run_agent runs each task…": a second call with the same task                                                                              |
| Review focus 4 (a worktree not the repository's)                     | 8     | row of "run_agent runs each task…"                                                                                                                |
| High: the server restarts while sub-agents run                       | 8     | `sub-sessions.test.ts` "after a restart, a parent continues once its sub-sessions end"                                                            |
| Review focus 3 (tokens)                                              | 3     | `mcp.test.ts` "a call without its process's token is refused"                                                                                     |
| SC-002 (every sub-agent on its role's model)                         | 7, 8  | `claude.test.ts`, `codex.test.ts` rewritten tests; the role's pick in US3 1's test; `validate:*` checks the real agents                           |
| SC-004 (agents' settings untouched)                                  | 7     | `validate:codex` already compares `~/.codex/config.toml`; `validate:claude` gains the same check of `~/.claude/settings.json`                     |
| US4 1 (Claude `/code-review high`, Codex review, a section each)     | 9     | `runner/__tests__/reviews.test.ts` "a review runs every reviewer at once and commits a section for each"                                          |
| US4 2 (a command reviewer's output)                                  | 9     | row of the same test                                                                                                                              |
| Normal: a command reviewer exits with an error                       | 9     | row of the same test                                                                                                                              |
| High: a reviewer fails or its agent is unavailable                   | 9     | row of the same test: "Did not review: Codex is not available on this machine."                                                                   |
| US4 3 (depth Branch: no wave review)                                 | 9     | `reviews.test.ts` "a wave's review on a branch-only feature runs no reviewer"                                                                     |
| `findings-NN.md` format; Review focus 8                              | 2     | `crates/core/tests/findings.rs` "writes_and_commits_only_the_findings"                                                                            |
| US5 1 (strip: Tab, Spec, Opus High; only the spec's pick stored)     | 11    | `web/src/__tests__/start-runs.test.tsx` "a feature started with Spec on Opus keeps only that pick"                                                |
| SC-001 (four keys)                                                   | 11    | the same test drives it with Tab, one move, Enter, and the pick                                                                                   |
| US5 2 (Review's model changed on the page; the build keeps its own)  | 4     | `runner/__tests__/feature-options.test.ts` "a feature's change applies to its next run"                                                           |
| Normal: a step's pick changed while it runs                          | 4     | row of the same test                                                                                                                              |
| US5 3 (a new default reaches an unchanged feature)                   | 4     | `feature-options.test.ts` "a feature runs on the settings for every value it never changed"                                                       |
| US5 more 1, 2 (tile times, gate in `needs-you`)                      | none  | drawn by `featureStages`, already in stories; the `early` stage asks no UI test; reviewed in the sandbox                                          |
| US6 1, 2, 3 (Sub-agents pane, its page, nested on the feature page)  | 12    | none new: UI, reviewed in the sandbox; the record's fields are owned by `sub-sessions.test.ts`'s assertions on the record                         |
| High: a step's model is gone                                         | 6     | row of "a plan run that ends at the build…": the refusal's exact text                                                                             |
| Normal: a step's agent is off                                        | 6     | row of the same test: the first runtime on                                                                                                        |
| Normal: `CLAUDE_CODE_EFFORT_LEVEL` set                               | 10    | `settings-fate.test.ts`'s existing record test gains the field's assertion                                                                        |
| Niche: a run without Uraeda                                          | 13    | none: the skill's prose                                                                                                                           |
| Replaced: "Write the plan, then implement it"                        | 6     | `message.test.ts` rewritten: "Write the plan", stopping when the plan is committed                                                                |
| Replaced: a fresh run keeps the session's pick (R20)                 | 6     | `runtimes.test.ts` rewritten to the step's pick                                                                                                   |
| Replaced: "Build in a fresh session"                                 | 6, 10 | the tests the spec lists, removed or rewritten in the task that removes the setting                                                               |
| Replaced: a new session on the agent's defaults when nobody picked   | 6     | `picks.test.ts` and `runtimes.test.ts` keep their cases, now without a step's pick                                                                |
| Replaced: the change's "Runs on" picker                              | 11    | `runtimes.test.ts`'s "change.start sends the change's first run on the runtime, model, and effort picked (R20)" rewritten to the change's options |
| Replaced: workflow sessions use the agent's own sub-agents           | 7     | `claude.test.ts` and `codex.test.ts` rewritten                                                                                                    |
| Replaced: the timeline's spine                                       | none  | already replaced on the branch; `stage-files.test.ts` keeps guarding which stage a file goes to                                                   |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1, 2, and 3: the settings module of the core, the core's findings and step mapping, and the
   server's MCP endpoint. Tasks 1 and 2 each add their own functions to the binding
   (`crates/binding/src/`), whose generated `index.d.ts` is regenerated after the merge.
2. Tasks 4 and 5: the server's store of a feature's options and settings, and the shared joint rule
   with the web's options model. Different files.
3. Tasks 6 and 7: the run chain in the runner's send path, and the runtimes' wiring in the adapters.
   Different files.
4. Tasks 8, 10, and 11: sub-sessions in the runner; the settings' Runs section and the old setting's
   removal; the start dialogs. Tasks 10 and 11 each add their own entries to the key registry, the
   map's and the strip's.
5. Tasks 9 and 12: reviews, on Task 8's sub-sessions; the feature page and the sub-session views, on
   Task 8's records. Different files.
6. Task 13: the skill and the documentation, on what was built.

---

## Task 1: Run options in the core's settings

**Risky:** changes a stored format, `config.toml`, and migrates its old switch.

**Files:**

- Create: `crates/core/src/settings/runs.rs`
- Modify: `crates/core/src/settings.rs` (`RunSettings`), `crates/core/src/settings/file.rs`
  (`parse_runs`), `crates/binding/src/settings.rs`
- Test: `crates/core/tests/run_options.rs`; `packages/binding/contracts.test.ts`

**Interfaces:**

- Produces, in `uraeda_core::settings` and on the binding in camelCase:
  - `pub struct RunOptions { steps: Vec<StepOptions>, implementers: Option<RunPick>, reviewers: Option<Vec<ReviewerOptions>>, review_depth: Option<String> }`,
    every field optional: what the file or a feature holds, nothing resolved.
  - `pub struct StepOptions { step: String, agent: Option<String>, model: Option<String>, effort: Option<String>, new_session: Option<bool> }`;
    `pub struct RunPick { agent, model, effort }`, each `Option<String>` (not `Pick`, which would
    hide TypeScript's own in the binding's types: see
    [R6](rulings.md#r6-the-cores-pick-is-runpick));
    `pub struct ReviewerOptions { agent, model, effort, instructions, command }`, each
    `Option<String>`.
  - `RunSettings.options: RunOptions`, beside `build_in_fresh_session` until Task 10. Reading
    `build_in_fresh_session = false` gives `[runs.steps.plan] new_session = false` unless that table
    sets `new_session`; `true` gives nothing.
  - `pub fn set_run_options(dir: &Path, options: &RunOptions) -> Result<Settings, ApiError>`:
    replaces `[runs.steps.*]`, `[runs.implementers]`, `[[runs.reviewers]]`, and `review_depth` with
    `options`, writing only the fields set, and removes `build_in_fresh_session`. Keeps every other
    key, comment, and order of `[runs]`. Binding: `setRunOptions(dir, options)`.
  - `pub fn check_run_options(options: &RunOptions) -> Result<(), ApiError>`: refuses a step not of
    the six, a step listed twice, a depth not `waves` or `branch`, a reviewer with both or neither
    of `agent` and `command`, and an empty command. Binding: `checkRunOptions(options)`.
  - `pub fn merge_run_options(defaults: &RunOptions, feature: &RunOptions) -> RunOptions`: each
    field the feature sets wins over the default's, step by step and field by field; the feature's
    reviewers replace the defaults' list whole. Binding: `mergeRunOptions(defaults, feature)`.
  - Parsing errors follow the file's: `line 4, runs.steps.spec.effort: The effort is a name.`

- [x] **Step 1: Write the failing tests**

`crates/core/tests/run_options.rs`, in the style of `tests/settings.rs`:

- `writes_a_step_in_its_own_table`: from `# mine\n[runs]\ncontinue_after_limit = false\n`, setting
  the spec to `agent = "claude"`, `model = "opus"`, `effort = "high"` and the spec's
  `new_session = true` writes exactly `[runs.steps.spec]` with those four keys after the kept
  `[runs]`, and reading it back gives the same options. Break: writing a nested inline table, or
  dropping `# mine`.
- `migrates_the_old_switch`, a table: `build_in_fresh_session = false` alone reads as the plan's
  `new_session = Some(false)`; with `[runs.steps.plan] new_session = true` too, reads `Some(true)`;
  the next `set_run_options` of the options read writes no `build_in_fresh_session`. Break: the old
  key winning over the table, or surviving the write.
- `merges_a_feature_over_the_settings`, a table: a feature's spec model over the settings' spec
  agent keeps both; a feature's reviewers replace the settings' list; a feature without the plan
  keeps the settings' plan. Break: a feature's step replacing the whole step.
- A row of `check_run_options` for each refusal above, in one table test.

In `contracts.test.ts`, the existing "settings cross the binding in camelCase" also checks
`runs.options.steps[0].newSession`.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test run_options`
- Expected: FAIL to compile, `cannot find function set_run_options in module settings`

- [x] **Step 3: Implement `runs.rs`, its parsing, writing, check, and merge**

`parse_runs` calls the new module for `steps`, `implementers`, `reviewers`, and `review_depth`.
`set_run_options` edits through `change_path`, so the write keeps the file's comments and refuses an
unreadable file. `build_in_fresh_session`, its field, and `set_build_in_fresh_session` stay until
Task 10 removes their last caller, so every wave leaves the project working.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS but `keys-structural.test.ts`, failing before this branch's tasks (Tasks 10 and 11
  fix it)

- [x] **Step 5: Commit**

```bash
git add crates/core/src/settings.rs crates/core/src/settings crates/binding/src/settings.rs crates/core/tests packages/binding
git commit -m "feat(run-options): run options in the settings file"
```

## Task 2: Findings files and run steps in the core

**Files:**

- Modify: `crates/core/src/workspace.rs` (`FileKind::Findings`, prefix `findings-`),
  `crates/core/src/check/names.rs` (round prefixes, `change_holds` and its message),
  `crates/core/src/check/values.rs` (`fields`: required `reviewed`, `commits`),
  `crates/core/src/steps.rs` (`Step.run_step`)
- Create: `crates/core/src/actions/findings.rs`, `crates/binding/src/findings.rs`,
  `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/findings-01.md`,
  `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/findings-01.md`
- Modify: `packages/web/src/feature/stageFiles.ts` (`findings` goes to the build stage)
- Test: `crates/core/tests/findings.rs`; `crates/core/tests/steps.rs` (or the steps test file in
  place) gains the mapping's table

**Interfaces:**

- Produces:
  - `FileKind::Findings`, serialised `findings`, with its round.
  - `Step::run_step(&self) -> Option<&'static str>`
    ([R7](rulings.md#r7-a-findings-files-title-and-its-place-in-a-change)), `runStep` on the
    binding's `NextView.step`: the run step a workflow step belongs to. `discovery` → `discovery`;
    `spec`, `spec-revision` → `spec`; `approval`, `plan`, `plan-revision` → `plan`;
    `implementation`, `change` → `build`; `final-review`, `finish`, `pull-request-unknown` →
    `review`; `pull-request-changes`, `push` → `comments`; every other step → `None`.
  - `api::write_findings(repo: &Path, folder: &str, findings: &Findings) -> Result<String, ApiError>`
    with `pub struct Findings { reviewed: String, commits: String, sections: Vec<FindingsSection> }`
    and `pub struct FindingsSection { reviewer: String, text: String }`: writes the next
    `findings-NN.md` in the folder of the feature's worktree, titled `# Findings: <title>, wave 2`,
    commits only that file with `review(<slug>): findings NN`, and returns its path from the
    repository's root. `retry_commit` commits it again after a hook's refusal. Binding:
    `writeFindings(repo, folder, findings)`.

- [x] **Step 1: Write the failing tests**

- `crates/core/tests/findings.rs` `writes_and_commits_only_the_findings`: in a feature's worktree
  with `findings-01.md` and an unrelated modified file, writing findings for `wave 2` and `abc..def`
  with two sections creates `findings-02.md` with frontmatter `reviewed: wave 2`,
  `commits: abc..def`, sections `## Claude Code · Opus` and `## Codex · GPT-6.1-Sol`, commits it
  alone, leaves the other file modified, and `ura check` on the folder reports nothing. Break:
  `git commit -a`, or numbering from the count of files rather than the highest round.
- The steps' table gains a row per mapping above. Break: `change` mapped to nothing, so a change
  never chains its picks.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core findings steps`
- Expected: FAIL to compile, `cannot find function write_findings`

- [x] **Step 3: Implement the kind, its checks, `run_step`, and `write_findings`**

The commit goes through the core's git module, as every write does. The template and the example
follow the data model; the example holds one section per reviewer of a wave of recurring tasks,
graded as the implementation reference grades findings.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates skills/uraeda/assets packages/binding packages/web/src/feature/stageFiles.ts
git commit -m "feat(run-options): findings files, and each step's run step"
```

## Task 3: The MCP endpoint

**Risky:** a new route reaches the agents' tools, guarded by its own token: security.

**Files:**

- Create: `packages/server/src/mcp/endpoint.ts`, `packages/server/src/mcp/tokens.ts`
- Modify: `packages/server/src/app.ts` (the route), `packages/server/src/server-paths.ts` and
  `packages/server/src/sign-in/check.ts` (`/mcp` passes the session check),
  `packages/server/src/server.ts`, `packages/server/src/live.ts`, and
  `packages/server/src/runner/sessions.ts` (the address and the tokens reach the session manager)
- Test: `packages/server/src/__tests__/mcp.test.ts`, its app's `mcp` option in
  `packages/server/src/__tests__/helpers.ts`

**Interfaces:**

- Produces:
  - `class McpTokens { issue(session: string): string; revoke(token: string): void; sessionOf(header: string | undefined): string | undefined }`:
    a random token per agent process, kept hashed, compared in constant time.
  - `type McpTool = { name: string; description: string; inputSchema: object; call(session: string, input: unknown, signal: AbortSignal): Promise<string> }`.
  - `mcpRoutes({ tokens, tools, every?: number }): Hono`, mounted at `/mcp`: MCP's streamable HTTP
    transport for `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`, the
    last answered as an event stream with `notifications/progress` every `every` milliseconds, 30
    000 by default, until the tool answers. A tool that throws answers `isError: true` with its
    message. A dropped connection aborts the call's signal.
  - `ServerAddress = { url: string }` (`http://127.0.0.1:<port>`) given to the session manager.
  - `createApp`'s `mcp?: { tokens, tools }`, the session manager's `mcp?: { address, tokens }`
    (`SessionsOptions`, `createSessions`, `startSessions`), and `Server.mcp`, with `tools` an array
    the server reads at each request, empty until Task 8 pushes its tools.

- [x] **Step 1: Write the failing tests**

`mcp.test.ts`, over `createApp` with a tool the test controls:

- "a long call reports progress every 30 seconds": a call with a progress token, the clock advanced
  by 65 seconds, then the tool answering; the stream holds 2 progress notifications, then the
  result's text. Break: progress only at the start, so a client's timeout drops the call.
- "a call without its process's token is refused": no token, a revoked token, and another process's
  token rows; each 401 with the same body, and the tool never runs. Break: a revoked token still
  accepted.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/mcp.test.ts`
- Expected: FAIL, `Cannot find module '../mcp/tokens.ts'` (the endpoint's import is a type's)

- [x] **Step 3: Implement the endpoint and the tokens**

`/mcp` is one of `SERVER_PATHS`, and the session check lets it through: its token is its sign-in,
and the host guard still applies
([R8](rulings.md#r8-mcp-is-one-of-the-servers-paths-let-through-by-the-session-check)). The server
makes the endpoint's tokens and its tool list, empty until Task 8 adds to it, in `server.ts`, from
the port `startServer` already takes: `main.ts` needs no change.

- [x] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server/src specs/2026-11-08-run-options
git commit -m "feat(run-options): an MCP endpoint for the agents' sub-agent tool"
```

## Task 4: A feature's options and the settings' run options on the server

**Risky:** a new stored table, and the cache's migration.

**Files:**

- Create: `packages/server/src/runner/feature-options.ts`
- Modify: `packages/server/src/runner/migrations.ts` (migration 11),
  `packages/server/src/runner/cache-rows.ts`, `cache-sessions.ts`, `cache.ts` (session columns),
  `packages/server/src/settings.ts` (`RunSettingsView`),
  `packages/server/src/fate/settings-mutations.ts` (`settings.setRunOptions`), a fate mutation
  `feature.setRunOptions` beside the feature's mutations, and the feature's record (its own options
  and the defaults)
- Test: `packages/server/src/runner/__tests__/feature-options.test.ts`; `settings-fate.test.ts`

**Interfaces:**

- Consumes: Task 1's binding `RunOptions`, `setRunOptions`, `checkRunOptions`, `mergeRunOptions`.
- Produces:
  - Migration 11: table
    `feature_options (repo TEXT, folder TEXT, options TEXT, updated_at TEXT, PRIMARY KEY (repo, folder))`,
    and the sessions' columns `step`, `parent`, `role`, `worktree`, each `TEXT` and null by default.
    `SessionRow` and `NewSession` gain `step`, `parent`, `role`, `worktree`, each `string | null`.
  - `class FeatureOptions { own(repo, folder): RunOptions; set(repo, folder, options: RunOptions): void; resolved(repo, folder): RunOptions }`:
    `own` is what the feature changed, `{steps: []}` when none; `set` checks with `checkRunOptions`
    and stores what it is given, deleting the row for empty options; `resolved` merges the feature's
    over the settings' as they are now.
  - `ctx.settings.runs().options`, the settings' run options, and `claudeEffortFromEnv?: string`,
    `CLAUDE_CODE_EFFORT_LEVEL` when set.
  - Fate mutations `settings.setRunOptions({ options })` and, on a repository's endpoint,
    `feature.setRunOptions({ folder, options })`, refused with the core's message (R9).
  - `ctx.featureOptions`, made by `featureOptionsOf({ binding, sessions, settings })`, keyed by the
    repository's main checkout, as the sessions are (R9).
  - The feature's record gains `runOptions: { own: RunOptions; defaults: RunOptions }`.

- [x] **Step 1: Write the failing tests**

`feature-options.test.ts`:

- "a feature runs on the settings for every value it never changed": settings with the review on
  Opus; a feature that set only the spec; the settings then set the review to Sonnet; `resolved`
  gives the feature's spec and Sonnet's review. Break: copying the settings into the feature's row
  at its start.
- "a feature's change applies to its next run": a feature's row set while a session of its build
  works; `resolved` gives the new review, and the running session's row keeps its model. Break:
  `set` updating the sessions.

`settings-fate.test.ts`: the existing record test asserts `runs.options` and, with the variable set,
`claudeEffortFromEnv`.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner/__tests__/feature-options.test.ts`
- Expected: FAIL, `Cannot find module '../feature-options.ts'`

- [x] **Step 3: Implement the migration, the store, the settings' view, and the mutations**

The migration's comment says the table is never cleared with the cache's sessions. A change promoted
to a feature keeps its folder's name, and its sessions theirs: its row needs no move (R9).

- [x] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server/src
git commit -m "feat(run-options): a feature's own options, and the settings' run options"
```

## Task 5: The joint rule, shared by the server and the web UI

**Files:**

- Create: `packages/server/src/run-options.ts`, exported as `uraeda-server/run-options` in
  `packages/server/package.json`
- Modify: `packages/web/src/runs/runOptions.ts` (imports the rule and the conversions; keeps the
  view's helpers: `STEP_LOOKS`, `METER`, `differences`, `changes`, `resolved`)
- Test: `packages/server/src/__tests__/run-options.test.ts`

**Interfaces:**

- Consumes: Task 1's binding `RunOptions` type.
- Produces, in `run-options.ts`:
  - `STEPS`, `StepId`, `Depth`, `Pick = { runtime?: string; model?: string; effort?: string }`,
    `Reviewer = { kind: "agent"; pick: Pick; instructions?: string } | { kind: "command"; command: string }`,
    and
    `MapOptions = { cuts: ReadonlyArray<number>; depth: Depth; implementers: Pick; reviewers: ReadonlyArray<Reviewer>; steps: Record<StepId, Pick> }`,
    the shape the map edits: the web's `RunOptions` becomes this type.
  - `type Agents = { runtime(chosen?: string): string | undefined; defaultModel(runtime: string): string | undefined }`,
    how a pick's defaults resolve, from the server's `Runtimes` or the web's `PickerRuntime` list.
  - `samePick(agents, a, b)`, `isForced(agents, options, index)`,
    `jointCuts(agents, options, index)`, `sessionSpans(agents, options)`, and
    `withCut(options, index)`, moved from the web with their behaviour: a joint cuts where the human
    cut, or where its two steps run on another agent or model; `discovery` always starts a session.
  - `toMap(options: RunOptions, fallbackRuntime: string): MapOptions` (the plan's `new_session`
    defaulting to `true`, reviewers defaulting to one agent reviewer on the review step's pick) and
    `toStored(map: MapOptions, defaults: MapOptions): RunOptions`, only the fields that differ from
    `defaults`, the whole reviewers' list when it differs.
  - `stepSession(agents, options: MapOptions, from: StepId, to: StepId): boolean`, whether `to` runs
    in the session that ran `from`: true only when both are in one span and `from` comes first.

- [ ] **Step 1: Write the failing tests**

`run-options.test.ts`, one table test of the joints over two agents' model lists, rows: "defaults"
(spans `[0,1]`, `[2,5]`), "a step on another model" (Spec on Opus: a forced cut before and after
Spec), "forced" (`withCut` on a forced joint leaves it cut), "joined" (`new_session = false` on the
plan joins it to the spec), "a default resolved" (a pick naming the agent's default model is the
same pick as none). And one table of `toStored(toMap(x))` round trips: the defaults store
`{steps: []}`; one change stores that field alone. Break: comparing raw picks, so "Default" and the
default model's name cut.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/run-options.test.ts`
- Expected: FAIL, `Cannot find module '../run-options.ts'`

- [ ] **Step 3: Implement the module, and make the web's `runOptions.ts` import it**

The web's stories keep compiling on the same names: `todayOptions` becomes
`toMap({steps: []}, runtime)`.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS but `keys-structural.test.ts`, failing before this branch's tasks (Tasks 10 and 11
  fix it)

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/run-options.ts packages/server/package.json packages/server/src/__tests__/run-options.test.ts packages/web/src/runs/runOptions.ts
git commit -m "feat(run-options): one rule of the sessions' joints"
```

## Task 6: Each step its own run, chained

**Risky:** changes where every run goes and when runs start by themselves: a rule several callers
share, and concurrency with the continuer.

**Files:**

- Create: `packages/server/src/runner/run-session.ts`, `packages/server/src/runner/chain.ts`
- Modify: `runner/send.ts` (`sendTo`, `FRESH_STEPS` removed), `runner/send-input.ts`
  (`freshByDefault` removed), `runner/message.ts` (`goal`), `runner/turns.ts` (`end` asks the
  chain), `runner/events.ts` (`Trigger` gains `"next-step"`), `limits.ts` (the gone model's
  refusal), `fate/send-mutations.ts`, `fate/session-moves.ts`, `web/src/HandOver.tsx` (its
  `FRESH_STEPS`, `useFreshDefault`, `FreshDefault`, and the switch removed) and its callers in
  `Composer.tsx` and `SessionPage.tsx`
- Test: `packages/server/src/runner/__tests__/chain.test.ts`; rewritten: `message.test.ts`,
  `runtimes.test.ts` (R20), `runner/__tests__/sessions.test.ts` and `src/__tests__/sessions.test.ts`
  (the fresh session's tests removed)

**Interfaces:**

- Consumes: `NextView.step.runStep` (Task 2); `FeatureOptions.resolved` and the sessions' `step`
  column (Task 4); `toMap`, `stepSession` (Task 5).
- Produces:
  - `runSession(context, live, runStep: StepId, fresh?: boolean): Promise<Live>` in
    `run-session.ts`: the session a run of `runStep` goes to. The latest session when it never ran;
    else the latest when `stepSession` joins its step to `runStep` and it runs on the step's agent
    and model, its effort set to the step's for the next turn; else a new session on the step's
    pick, `step` set. `fresh: true` always starts a new one. A session without `step` reads as the
    run step of its latest workflow turn. A step whose agent is off runs on the first runtime on,
    without its model and effort. A step whose model the agent no longer lists is refused with
    `RUNTIME_REFUSALS.stepModelGone(step, model, agent)`: "Spec runs on Opus 4.1, which Claude Code
    no longer lists."
  - `goal(step, planReview)` stops each run at its step: approval, plan, and plan revision "Write
    the plan" (or "Record the approved decisions and write the plan"), stopping when "the plan is
    committed" without plan review; implementation stopping when "every task of the plan is
    checked"; the others unchanged.
  - `class Chain { ended(live, turn): Promise<void> | undefined }`, asked by `Turns.end` beside the
    continuer: for a workflow turn of a feature's session, not a sub-session, ended `done`, it reads
    the next step; when it waits on the agent and its `runStep` differs from the turn's, it sends
    the recommended message with trigger `next-step`, as `continueOne` does, holding the end's
    publication until sent. It sends nothing otherwise, so the status stays `halted` as today.

- [ ] **Step 1: Write the failing tests, and rewrite the replaced ones**

`chain.test.ts`, on the session manager with the fake agent and two runtimes:

- "a plan run that ends at the build starts the build's run in a new session on its pick": plan on
  Opus, build on Sonnet; the plan turn ends with the next step at `implementation`; a new session on
  Sonnet holds a workflow turn "Implement the plan", trigger `next-step`, and the automatic
  continues count stays 0. Rows: a step's model gone refuses with the exact text; a build agent off
  runs on the first runtime on; a turn the human stopped chains nothing. Break: chaining from
  `stopped`, or counting the chain as a continue.
- "a revision joined to its spec runs in the spec's session, on its own effort": spec at High,
  revision step at Medium in the same span; a revision run sent after a review goes to the spec's
  session with effort Medium. Row: a legacy session without `step` whose last workflow turn was
  `spec` is joined the same way. Break: a new session per run, or the session's effort unchanged.
- "a run whose step did not move on starts nothing": the plan turn ends with the step still `plan`;
  no new turn anywhere. Break: a loop of plan runs.

Rewrite `message.test.ts`'s plan messages, the R20 test to "a new session runs on its step's pick",
and remove the fresh session's tests the spec lists.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `vp test packages/server/src/runner/__tests__/chain.test.ts packages/server/src/runner/__tests__/message.test.ts`
- Expected: FAIL, `Cannot find module '../chain.ts'`, and the message tests on "Write the plan, then
  implement it"

- [ ] **Step 3: Implement the session choice, the goals, and the chain**

`sendTo` asks `runSession` for a workflow message with a step, and keeps today's path for a chat.
Continue all, the hand-over, applying answers, and approvals all reach it through `sessions.send`,
so each lands in its step's session. The chain is a member of the session context like the
continuer, created in the same place.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS but `keys-structural.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/server/src packages/web/src
git commit -m "feat(run-options): each step its own run, chained to the next"
```

## Task 7: The agents get Uraeda's tool, without their own sub-agents

**Risky:** changes what each agent process may call: security, and the agents' own permissions.

**Files:**

- Modify: `runner/adapter.ts` (`OpenOptions.tools`), `runner/claude.ts` (`claudeArgs`),
  `runner/child.ts` (`spawnGrouped` takes `env`), `runner/codex.ts` (structural split first),
  `packages/server/scripts/validate-claude.ts`, `packages/server/scripts/validate-codex.ts`
- Create: `runner/codex-thread.ts`
- Test: `runner/__tests__/claude.test.ts`, `runner/__tests__/codex.test.ts` (rewritten)

**Interfaces:**

- Consumes: Task 3's endpoint (`/mcp`, its tools' names `run_agent` and `review`).
- Produces:
  - `OpenOptions.tools?: { url: string; token: string } | "none"`: the endpoint and the process's
    token for a workflow session; `"none"` for a sub-session, which gets neither Uraeda's tool nor
    the agent's sub-agents; absent for a chat, which keeps the agent's own sub-agents.
  - Claude Code, with `tools`: `--mcp-config` naming server `uraeda` over HTTP with the token as a
    bearer header, `--strict-mcp-config` absent (the user's servers stay),
    `--disallowedTools Agent Task Workflow`, `mcp__uraeda__run_agent` and `mcp__uraeda__review`
    added to `--allowedTools`, and `MCP_TOOL_TIMEOUT` in the process's environment high enough for a
    60-minute call. With `"none"`: only `--disallowedTools`.
  - Codex, with `tools`: the thread's `config` gains `mcp_servers.uraeda` (its URL, the token, a
    tool timeout of at least 60 minutes, its tools approved and parallel) and turns its sub-agents
    off; with `"none"`, only its sub-agents off. The project's trust stays.

- [ ] **Step 1: Split `codex.ts` before it changes**

Move `codexThreadParams` and `codexTrust` to `codex-thread.ts`, unchanged.

- Run: `vp test packages/server/src/runner/__tests__/codex.test.ts`, before and after
- Expected: PASS both times

```bash
git add packages/server/src/runner/codex.ts packages/server/src/runner/codex-thread.ts
git commit -m "refactor(run-options): codex's thread parameters in their own file"
```

- [ ] **Step 2: Rewrite the replaced tests**

- `claude.test.ts` "the model and effort picked are arguments; none skips permissions" keeps its
  assertions, and gains a row per `tools` value: with tools, `--disallowedTools` names `Agent`, the
  MCP configuration's URL and header carry the token, both tool names are allowed; with none, no
  `--mcp-config`. Break: a sub-session given the tool, so sub-agents nest.
- `codex.test.ts` "a thread's permissions" keeps its trust and sandbox assertions, its `config`
  equal to the trust plus `mcp_servers.uraeda` and the sub-agents off with tools. Break: an approval
  policy loosened for the tool.

- [ ] **Step 3: Run them to check they fail**

- Run:
  `vp test packages/server/src/runner/__tests__/claude.test.ts packages/server/src/runner/__tests__/codex.test.ts`
- Expected: FAIL, `expected [ …(n) ] to include '--disallowedTools'`

- [ ] **Step 4: Implement the arguments and the configuration, then check both agents**

Extend `validate-claude.ts` and `validate-codex.ts` with a session given a stand-in tool on a
temporary `/mcp` that sleeps 70 seconds and answers: the agent calls it, waits past a progress, gets
the answer, and has no built-in sub-agent tool; and `~/.claude/settings.json` is byte-identical
after, as `~/.codex/config.toml` already is. Run both once. If an agent cannot call the tool or
drops the call, stop: the spec's sub-agents rely on it, so that is a new round of questions for the
human.

- Run: `vp run validate:claude` and `vp run validate:codex`
- Expected: both pass, the tool's answer in the transcript

- [ ] **Step 5: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS but `keys-structural.test.ts`

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/runner packages/server/scripts
git commit -m "feat(run-options): workflow sessions call Uraeda's sub-agents, never their own"
```

## Task 8: Sub-sessions and `run_agent`

**Risky:** concurrency (sessions of one folder working at once), and a path an agent gives.

**Files:**

- Create: `packages/server/src/runner/sub-sessions.ts`
- Modify: `runner/cache.ts` (`latestSession`, `folderSessions` leave sub-sessions out;
  `subSessionsOf(parent)`), `runner/live-sessions.ts` (`otherWorking` ignores sub-sessions, and a
  sub-session ignores its folder), `runner/processes.ts` (a token per workflow process, revoked at
  close; a sub-session's cwd is its `worktree`), `runner/sessions.ts` (`stop` stops a parent's
  sub-sessions), `runner/continuer.ts` (a parent's restart continue waits for its sub-sessions),
  `server.ts` (the tools reach the endpoint)
- Test: `packages/server/src/runner/__tests__/sub-sessions.test.ts`

**Interfaces:**

- Consumes: `McpTokens`, `McpTool` (Task 3); `OpenOptions.tools` (Task 7); the sessions' columns and
  `FeatureOptions.resolved` (Task 4).
- Produces:
  - `class SubSessions { start(parent: string, role: "implementer" | "reviewer", { about, cwd, message, pick, review? }): Promise<string>; ofParent(parent: string): Array<SessionRow>; stopAll(parent: string): void }`:
    `start` creates a session with `parent`, `role`, `title` `about`, `worktree` `cwd`, on `pick`,
    sends `message` as a workflow turn, and resolves with its last message once the turn ends; a
    second `start` with the same parent, role, and `about` resolves with the first one's answer,
    waiting while it works, after a restart too.
  - The tool `run_agent`, input `{ task: string; prompt: string; worktree: string }`: refused when
    `worktree` is not a worktree of the parent's repository, or its main checkout; else starts an
    implementer on the feature's resolved `implementers` pick (the build's agent when unset).
  - `SessionRow.parent`, `role` set on sub-sessions; their turns' `step` is the parent's.

- [ ] **Step 1: Write the failing tests**

`sub-sessions.test.ts`, on the session manager with the fake agent, calling the tool as the endpoint
does:

- "run_agent runs each task in its own sub-session at once, on the role's pick": build on Claude,
  implementers on Codex at Low; three calls at once; three sessions work at the same time on Codex
  at Low, each in its worktree, `parent` the build's session, `role` `implementer`; each call
  resolves with its session's last message; the feature's latest session is still the build's. Rows:
  a repeated call for task 4 resolves with the first one's answer and starts no session; a
  `worktree` of `/tmp` and the main checkout are refused. Break: the second sub-session queued
  behind the first, or the latest session becoming a sub-session.
- "Stop on a parent stops its sub-sessions": two working sub-sessions; `stop` on the parent ends
  their turns `stopped`, and their calls answer with an error. Break: orphaned sub-sessions.
- "after a restart, a parent continues once its sub-sessions end": a parent and a sub-session cut by
  a restart; the sub-session continues first; the parent's continue is queued only once the
  sub-session's turn ends. Break: the parent continuing at once, calling the tool again before its
  sub-session answered.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner/__tests__/sub-sessions.test.ts`
- Expected: FAIL, `Cannot find module '../sub-sessions.ts'`

- [ ] **Step 3: Implement sub-sessions, the tool, and their exclusions**

A worktree is checked against `git worktree list` of the repository, through the binding.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS but `keys-structural.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/server/src
git commit -m "feat(run-options): implementers run as sub-sessions Uraeda starts"
```

## Task 9: Reviews

**Files:**

- Create: `packages/server/src/runner/reviews.ts`
- Modify: `runner/adapter.ts` (`Outgoing.review`), `runner/codex-turns.ts` (a review turn starts
  `review/start`), `runner/claude.ts` only if a review needs more than its message
- Test: `packages/server/src/runner/__tests__/reviews.test.ts`

**Interfaces:**

- Consumes: `SubSessions.start` (Task 8), `writeFindings` (Task 2), `FeatureOptions.resolved` (Task
  4).
- Produces:
  - The tool `review`, input `{ reviewed: string; base: string; head: string; context?: string }`.
    On a feature whose depth is `branch` and a `reviewed` other than `branch`, it answers "No
    review: this feature's reviews run on the branch only." and runs nothing. Otherwise it runs
    every reviewer of the feature's resolved options at once and answers with the path and text of
    the `findings-NN.md` it committed.
  - An agent reviewer is a sub-session with `role` `reviewer` in the feature's worktree, on its
    pick: on Claude Code its message is `/code-review <level>` on the range, the level its effort's;
    on Codex, `Outgoing.review = { base, instructions }` makes its turn a `review/start` with the
    effort set before. Its `instructions` follow its prompt. Its last message is its section.
  - A command reviewer runs `sh -c <command>` in the feature's worktree; its output is its section,
    with its exit code when it failed.
  - A reviewer that fails, or whose agent is not available, gets "Did not review: <agent> is not
    available on this machine." or its error; the others stand.
  - Section names as the map shows a reviewer: "Claude Code · Opus", "Codex · GPT-6.1-Sol", and a
    command's own text.

- [ ] **Step 1: Write the failing tests**

`reviews.test.ts`:

- "a review runs every reviewer at once and commits a section for each": a Claude reviewer at High,
  a Codex reviewer, `coderabbit review --plain` faked as a script, and a failing `exit 3` command;
  the Claude sub-session's message starts `/code-review high`, the Codex turn carries `review`, all
  start before any ends, and `findings-NN.md` holds four sections: the agents' answers, the
  command's output, and the failure's output with "exit code 3". Row: a Codex reviewer with Codex
  off gives "Did not review: Codex is not available on this machine." Break: reviewers run one after
  the other, or a failure dropping the file.
- "a wave's review on a branch-only feature runs no reviewer". Break: depth ignored.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner/__tests__/reviews.test.ts`
- Expected: FAIL, `Cannot find module '../reviews.ts'`

- [ ] **Step 3: Implement the tool and the review turns**

Check `/code-review`'s arguments and Codex's `review/start` target against the installed agents, and
add a review to `validate:claude` and `validate:codex`.

- [ ] **Step 4: Run the task's validation**

- Run: `vp run fast`, then `vp run validate:claude` and `vp run validate:codex`
- Expected: PASS but `keys-structural.test.ts`; both validations pass

- [ ] **Step 5: Commit**

```bash
git add packages/server/src packages/server/scripts
git commit -m "feat(run-options): reviewers run at once, their findings committed"
```

## Task 10: The settings' Runs section

**Files:**

- Start from: `packages/web/src/runs/RunMap.stories.tsx#SettingsDefaults`
- Modify: `web/src/views.ts` (structural split first: the settings' selections to
  `web/src/settings/settingsViews.ts`), `settings/RunSettings.tsx` (the map in place of "Build in a
  fresh session"), and the old setting's last callers, removed with it: the server's
  `settings.setBuildInFreshSession` and `RunSettingsView.buildInFreshSession`, the core's
  `set_build_in_fresh_session`, `RunSettings.build_in_fresh_session`, and their binding functions,
  `settings/categories.ts`, `settings/ServerSettings.tsx`, `settings/optimistic.ts`,
  `settings/SettingsPage.tsx`, `settings/SettingsView.stories.tsx`, `runs/RunMap.tsx` (its keys in
  the registry), `keys/` registry entries
- Test: `web/src/__tests__/categories.test.ts` (the rows' labels); removed with the setting:
  `settings.test.ts` and `settings-fate.test.ts`'s fresh session cases, and the rows of
  `crates/core/tests/settings.rs` naming `build_in_fresh_session`, with
  `sets_building_in_a_fresh_session_in_its_own_table`

**Interfaces:**

- Consumes: `settings.setRunOptions`, `runs.options`, `claudeEffortFromEnv` (Task 4); `toMap`,
  `toStored` (Task 5).
- Produces: `RunMap`'s keys declared with `useKeys`: ← → h l, ↓ ↑ j k, Enter, Space, `r`, `a`, `d`,
  on the map's selection, so they never clash with a page's `j`/`k`.

- [ ] **Step 1: Split `views.ts` before it changes**

Move the settings' selections to `settings/settingsViews.ts`, re-exported where they are imported.

- Run: `vp run fast`, before and after
- Expected: the same result both times

```bash
git add packages/web/src/views.ts packages/web/src/settings/settingsViews.ts
git commit -m "refactor(run-options): the settings' views in their own file"
```

- [ ] **Step 2: Wire the map to the settings, and its keys to the registry**

The Runs section shows the map over the settings' options, saving each change with
`settings.setRunOptions`, optimistically; under the map, the keys, and when `claudeEffortFromEnv` is
set: "CLAUDE_CODE_EFFORT_LEVEL is set to high: every Claude Code effort follows it." The rows'
labels, the category's terms, and the stories follow.

- [ ] **Step 3: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS but `keys-structural.test.ts` for `RunStrip.tsx` alone, which Task 11 fixes

- [ ] **Step 4: Review it in the sandbox**

Run `vp run sandbox`, open Settings, Runs: both themes, at a phone's and a desktop's width. Change a
step, cut a joint, add a reviewer, by keyboard and by tap.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(run-options): the Runs settings draw the run map"
```

## Task 11: The start dialogs' strip

**Files:**

- Start from: `packages/web/src/runs/RunMap.stories.tsx#StartFeatureDefaults`
- Modify: `web/src/NewFeatureComposer.tsx`, `web/src/NewChangePage.tsx`, `web/src/StartDialog.tsx`
  (`RunsOn` removed), `runs/RunStrip.tsx` (its keys in the registry), `server/src/fate/starts.ts`
  (`feature.startText` takes `options`), `server/src/fate/change-starts.ts` (`change.start` takes
  `options` in place of a pick; its first run on its build step's pick), the new session's picker
  default for a feature's first session (its discovery step's pick)
- Test: `web/src/__tests__/start-runs.test.tsx`; `runtimes.test.ts`'s change start test rewritten

**Interfaces:**

- Consumes: `FeatureOptions.set` (Task 4), `toStored` (Task 5), `runSession` (Task 6).
- Produces: `feature.startText` and `change.start` inputs gain `options?: RunOptions`, stored as the
  feature's own when not empty; `change.start` no longer takes `runtime`, `model`, `effort`.

- [ ] **Step 1: Write the failing tests**

- `start-runs.test.tsx` "a feature started with Spec on Opus keeps only that pick": on the New page
  with two runtimes, Tab to the strip, → to Spec, Enter, pick Opus, then High, start; the strip read
  "Spec on Opus · High" before the start, and the feature's own options hold only
  `steps: [{ step: "spec", agent: "claude", model: "opus", effort: "high" }]`. Break: storing the
  whole resolved map, so later defaults never reach it.
- `runtimes.test.ts`: the change start test sends its first run on the build step's pick of its
  options.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/start-runs.test.tsx`
- Expected: FAIL, `Unable to find an element with the text: Runs`

- [ ] **Step 3: Implement the strips and the starts' options**

- [ ] **Step 4: Run the task's validation, and review in the sandbox**

- Run: `vp run fast`
- Expected: PASS, `keys-structural.test.ts` included
- In the sandbox: a feature's and a change's start dialogs, both themes, phone and desktop.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src packages/server/src
git commit -m "feat(run-options): the start dialogs' run strip"
```

## Task 12: The feature page's map and the sub-sessions' views

**Files:**

- Start from: `packages/web/src/runs/RunMap.stories.tsx#FeaturePage`,
  `packages/web/src/runs/SubSessions.stories.tsx#SubagentsPaneMixed`,
  `packages/web/src/feature/SessionsPane.stories.tsx#WithSubSessions`
- Create: `packages/server/src/fate/sub-session-views.ts`
- Modify: `server/src/fate/sessions.ts` and `views.ts` (the session record's `parent`, `role`, and
  `subSessions`), `web/src/runs/FeatureRuns.tsx`, `web/src/runs/subSessions.ts`,
  `web/src/feature/FeaturePage.tsx`, `web/src/feature/SessionsPane.tsx`,
  `web/src/session/SubagentsPanel.tsx`, `web/src/session/SessionColumn.tsx`,
  `web/src/SessionView.tsx`, `web/src/SessionPage.tsx`, the web's session selection

**Interfaces:**

- Consumes: `SubSessions.ofParent`, the sessions' `parent` and `role` (Task 8); the feature record's
  `runOptions` and `feature.setRunOptions` (Task 4); `toMap`, `toStored` (Task 5).
- Produces: `SessionRecord.subSessions: Array<SubSessionRecord>`, the web's `SubSession` fields
  (`about`, `agent`, `effort`, `endedAt`, `id`, `model`, `parent`, `role`, `startedAt`, `state`,
  `usage`); `SessionRecord.parent` and `role`. Every `TEMPORARY` marker of `runs/`, `SessionsPane`,
  `SubagentsPanel`, and `SessionView` goes.

- [ ] **Step 1: Serve the sub-sessions, and draw them**

The feature page's map reads the feature's own options and the settings' defaults, and saves a
change with `feature.setRunOptions`. The Sub-agents pane lists a session's sub-sessions; Enter or a
click opens the sub-session's page, read only, with Stop while it works and a link to its parent.
The feature's sessions pane nests sub-sessions under their parent, in the `sub-agent` colour. A
chat's pane keeps the agent's own sub-agents.

- [ ] **Step 2: Run the task's validation**

- Run: `vp run fast`
- Expected: PASS

- [ ] **Step 3: Review it in the sandbox**

The feature page at Build with sub-sessions working, a finished feature, a change's page, the
Sub-agents pane, a sub-session's page: both themes, phone and desktop, by keyboard and by tap.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src packages/web/src
git commit -m "feat(run-options): the feature page's run map, and sub-sessions"
```

## Task 13: The skill and the documentation

**Files:**

- Modify: `skills/uraeda/SKILL.md` (step 4, the folder tree), `references/implementation.md`
  (implementers, wave and branch reviews, the second reviewer), `references/change.md` (its review),
  `references/plan.md` (where it says the plan runs on in the same session),
  `references/projects.md`, `assets/templates/specs/README.md`, `assets/example/specs/README.md`,
  `docs/web-ui.md` (the `[runs]` tables, the start dialogs, the feature page, sub-sessions),
  `docs/specs-folder.md`, `docs/extensions.md` (a runtime must accept an outside tool and turn its
  own sub-agents off)

- [ ] **Step 1: Write the skill's changes**

When Uraeda runs the workflow, a run's message names where it stops: the skill says to stop there,
and Uraeda starts the next step. When the session has Uraeda's tools, it gives each task to
`run_agent` and each review to `review`, then reads the committed `findings-NN.md` and fixes its
findings as it grades them today. Without them, it uses its own sub-agents, as today, and writes
`findings-NN.md` itself. The templates' and the example's READMEs list `findings-NN.md`.

- [ ] **Step 2: Update the documentation**

- [ ] **Step 3: Run the task's validation**

- Run: `vp run fast`, then `ura check`
- Expected: PASS, and no problem

- [ ] **Step 4: Commit**

```bash
git add skills docs
git commit -m "docs(run-options): the skill and the docs on run options"
```
