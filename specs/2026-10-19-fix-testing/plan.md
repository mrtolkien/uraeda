---
status: auto-approved
spec-revision: 2
---

# Plan: Fix testing

**Goal:** Preserve meaningful protection while making local feedback fast and complete delivery
checks reliable.

**Architecture:** Focused tests own local behavior, boundary tests own git/native/request contracts,
and retained application/browser journeys prove integration. A lightweight configuration selects
before optional prerequisites and never imports the production dev server. Reusable fixture history
is immutable; every caller receives independent mutable state. See the
[approved architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md), revision 2, approved on 2026-10-20.

## Review focus

1. **Selection failures** must not become successful empty runs. Invalid git bases, whitespace in
   filenames, deleted source, declarations, runtime assets, and missing native output are covered by
   Task 1.
2. **Unrelated refusal** must not satisfy a negative assertion. Composer sends to an available
   endpoint; resource checks distinguish body refusal from decoding failure. Tasks 2 and 4.
3. **Fixture ownership** includes git object isolation, worktree metadata, settings, timers,
   requests, and cleanup after failure. Task 3.
4. **Browser-specific protection** includes actual parent/child messages and trusted picks, not just
   frame attributes. Task 5 retains those checks.
5. **Incoming work** must survive integration, especially inbox notes, transcript bounds, keyboard
   submission, and attachment behavior. Task 7 reconciles the latest main and updates the inventory.

## Global constraints

The approved spec and active decisions apply to every task. These rules are copied from their
sources:

- "Do not delete protection to fit a timing sample." [Spec](spec.md#architecture).
- "After every task, fast MUST check formatting, lint, types, affected focused tests and boundary
  checks, and name broader checks deferred to ready." [Toolchain](../decisions/toolchain.md).
- "An agent MUST run `vp run ready` before pushing a branch."
  [Toolchain](../decisions/toolchain.md).
- "CI MUST run the same checks as `ready`, uncached, in the Nix dev shell."
  [Toolchain](../decisions/toolchain.md).
- "Tests MUST be isolated, so runs in several checkouts of one machine do not collide."
  [Toolchain](../decisions/toolchain.md).
- "Test runners MUST NOT retry a failed test, and a test failing without a bug MUST be fixed in the
  pull request that finds it." [Toolchain](../decisions/toolchain.md).
- "Coverage MAY be collected on demand, outside `ready` and CI, and a drop MUST NOT fail a check."
  [Toolchain](../decisions/toolchain.md).
- "Workflow logic, parsing, validation, and states MUST live in the Rust core, and TypeScript MUST
  reach them only through the binding, never reimplemented." [Stack](../decisions/stack.md).
- "Every agent MUST be reached through one adapter that keeps its formats inside and declares what
  it can do, and tests MUST use a fake adapter." [Agents](../decisions/agents.md).
- "Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria."
  [Code quality](../decisions/code-quality.md).
- "Stories MUST NOT run as tests: UI tests are Vitest tests, per the
  [UI checks](../decisions/ui-checks.md) decision." [Preview](../decisions/preview.md).
- "`vp run ready` MUST build Storybook, so a story that does not compile fails."
  [Preview](../decisions/preview.md).
- "`vp run ready` MUST check every page a UI decision governs at a phone and a desktop size, in both
  themes, for readability and accessibility." [UI checks](../decisions/ui-checks.md).
- "An agent's inbox notes MUST be written in its own worktree, never on the default branch."
  [Git](../decisions/git.md).

Before pushing, all required checks remain present, including package smoke, native checks, and CI's
editor smoke. No paid benchmark run, dependency addition, constitution amendment, product redesign,
retry, or new size-limit suppression is authorized by this plan. Use the Nix dev shell. Preserve
hooks and the human's other checkouts. Commit no authorship/tool footers. An independent case must
pass alone; a necessary sequence stays one test. Retain old tests unless the record explains their
replacement, redundancy, or incidental expectation. Unchanged guarantees retain their existing
assertions and coverage, without a target for test counts.

## Code read

- [Root configuration](/vite.config.ts) and [tasks](/vite.tasks.ts): all projects participate in
  ready; broad inputs protect native/runtime dependencies but cause broad invalidation.
- [Web configuration](/packages/web/vite.config.ts): eager freshness/dev imports occur before
  related-test selection. StyleX, React Compiler, and fate transforms must remain consistent.
- [Composer](/packages/web/src/Composer.tsx), [data](/packages/web/src/data.ts),
  [views](/packages/web/src/views.ts), and [clients](/packages/web/src/clients.ts): direct rendering
  needs actual fate context and agent records, not the whole App.
- [Server data views](/packages/server/src/fate/views.ts) and
  [sources](/packages/server/src/fate/source.ts): support a scripted request boundary without a
  native import or copied workflow rules.
- [Application helpers](/packages/web/src/__tests__/helpers.tsx): real server, binding, git
  repositories, storage reset, outstanding requests, and teardown; all App tests remain in ready.
- [Shared fixture construction](/packages/binding/test-utils.ts): synchronous git history is rebuilt
  for each fixture; it owns the new immutable-template optimization.
- [Native contracts](/packages/binding/index.test.ts),
  [settings writer](/crates/core/tests/settings_writes.rs), and
  [binding freshness](/packages/server/src/binding.ts): preserve detailed core cases and prove
  representative transport/error contracts separately.
- [Preview fixtures](/packages/server/src/preview/__tests__/helpers.ts),
  [proxy cases](/packages/server/src/preview/__tests__/proxy.test.ts), and
  [browser configuration](/packages/web/vite.browser.config.ts): real process/socket/frame semantics
  and teardown account for material execution time.
- [Browser layout cases](/packages/web/src/__browser__/layout.test.tsx) and
  [frame cases](/packages/web/src/__browser__/story-embed.test.tsx): required page matrix and
  distinct browser behavior cannot be replaced by DOM attributes.
- [Testing guidance](/skills/uraeda/references/code-quality.md),
  [implementation guidance](/skills/uraeda/references/implementation.md), templates, and example:
  currently encourage large tests and extra full runs; revise together.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

No exception is proposed. Plan approval is automatic because the approved spec has
`plan-review: false`.

## Complexity tracking

| Abstraction or exception                | Why it is needed                                                                                                    | Simpler alternative rejected because                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Shared UI transform factory             | Normal, browser, and fast rendering must use the same StyleX/React Compiler behavior without production startup.    | Importing the production configuration eagerly builds native code and loads the dev server; copying plugin rules would drift. |
| Fast family/input registry and selector | Native code, runtime files, declarations, and deletions cannot be discovered solely through JavaScript imports.     | Direct-import selection hides dependencies; a complete App graph defeats bounded local checks.                                |
| Lightweight test runner/configuration   | Select and execute the relevant focused graph once, before optional builds, while preserving isolation and cleanup. | Loading all production project configs already pays unrelated prerequisites.                                                  |
| Server-owned scripted request fixture   | Composer tests need real fate serialization and failure signaling without starting the full application.            | Handwritten wire responses duplicate the protocol; full app fixtures import unrelated pages/native code.                      |
| Immutable git fixture templates         | Many existing tests need identical committed history but independent writes.                                        | Sharing a mutable repository introduces ordering dependencies; rebuilding history for every case wastes processes.            |
| Focused render helper                   | Composer cases share context setup and controlled promises, with fresh client/state per case.                       | Reusing the App helper recreates fanout; repeating context and transport setup obscures each assertion.                       |

The shared `scripts/test-policy.ts` worker limit keeps normal and lightweight execution at the same
`min(4, availableParallelism())` budget. Keeping the expression in both configurations would create
two owners of the machine resource policy; cache inputs include this shared file.

Existing oversized units are not grown. Split a marked unit before changing its behavior; record any
necessary extra decomposition here.

## Test map

Focused UI tests use actual components and fate clients against a server-owned scripted endpoint.
Boundary tests use real native output and private directories; core git cases retain real temporary
repositories. Application and browser tests retain real server/git and fake runners. Controlled
promises and clocks replace fixed sleeps.

| Spec                                                       | Task    | Check                                                                                                                                            |
| ---------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| US1 key 1; SC-006 incidental copy                          | 5       | `home.test.tsx` and related readiness assertions use required actions/state rather than the heading's words; temporary heading rename must pass. |
| US1 key 2; SC-006 preserved data                           | 2, 4    | `settings_writes.rs` preserves surviving inline comments, BOM, CRLF; native contract checks an actual write/reload.                              |
| US1 key 3                                                  | 5       | `round.test.tsx` / retained journey submits answers, checks a captured commit baseline, reloads resulting state.                                 |
| US1 more 1                                                 | 4       | `answered.rs` retains ordinary-merge versus squash behavior and detects a wrong history lookup.                                                  |
| US1 more 2; Review focus: browser protection               | 5       | Real `story-embed` / `story-comments` tests retain untrusted sender rejection and trusted persisted picks.                                       |
| US2 key 1                                                  | 1, 2    | Selector and discovered Composer graph include its focused tests, exclude App journeys and Rust; complete timed command.                         |
| US2 key 2                                                  | 1, 2    | Native/skill routing, real binding contracts, reverse-dependent Rust packages, explicit deferred families.                                       |
| US2 key 3; high deferred checks                            | 1, 7    | Ready includes every required family/build; pre-push ready must pass.                                                                            |
| US2 more 1; high non-import inputs                         | 1       | Selector cases for declarations, runtime fixtures, embedded skill, root config, deleted source, missing native artifact.                         |
| US2 more 2; Review focus: selection failures               | 1       | Invalid git base fails; NUL-delimited paths preserve whitespace; discovery exceptions cannot print a pass.                                       |
| US3 key 1; SC-004                                          | 4, 6    | Existing guarantee owners below remain; guidance maps main scenarios/high edges/criteria to meaningful owning checks.                            |
| US3 key 2; SC-006 contracts                                | 2, 4, 6 | Exact request/draft/image data, native errors, body-boundary refusal, permission scope, and exact preserved bytes.                               |
| US3 key 3; US3 more 1; normal requested change             | 6       | Guidance follows human intent, reports changed tests, and has an explicit stop for an unresolved spec conflict.                                  |
| US3 more 2; normal readiness                               | 3, 4, 5 | Controlled clock/process readiness, actual target links/results, and no fixed sleep or retry.                                                    |
| US4 keys 1 and 2; SC-005; high unique guard                | 4, 7    | Baseline path inventory plus per-guarantee rulings for every removed/skipped/weakened check; timeout changes list old/new values.                |
| High weak replacement; Review focus: unrelated refusal     | 2, 4    | Available Composer endpoint actually receives the refused request; size-limit test proves refusal before body consumption.                       |
| High shared state; SC-007; Review focus: fixture ownership | 3       | Fixture copies have independent refs, index, settings, and objects; independent cases run by name and in the suite.                              |
| High incoming main; Review focus: incoming work            | 7       | Latest-base reconciliation, decision test map refresh, full ready, and hosted CI for final reviewed commit.                                      |
| Niche Neovim                                               | 5, 7    | Preserve main-action smoke and run in CI against real LSP.                                                                                       |
| SC-001, SC-002, SC-003                                     | 2, 7    | Full command edit matrix; three green CI runs below five minutes; five green runs of the same commit without retries.                            |

Active test-backed decision rules are mapped individually below. These are retained owners, not
permission to delete their cases. When main changes a rule, Task 7 updates the row and checks the
actual assertion.

| Decision rule                                                                                                                                                                                                                                                                                                   | Retained owning checks                                                                                                                            | Task |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| [agents](../decisions/agents.md): Sessions, turns, and items MUST be stored and shown in one agent-neutral shape.                                                                                                                                                                                               | `packages/server/src/runner/__tests__/sessions.test.ts; claude.test.ts`                                                                           | 4, 7 |
| [agents](../decisions/agents.md): An agent MUST run with the least permission that still finishes unattended steps, never skipping permissions, and Uraeda MUST NOT touch its credentials or settings.                                                                                                          | `packages/server/src/runner/__tests__/sessions.test.ts; claude.test.ts`                                                                           | 4, 7 |
| [agents](../decisions/agents.md): A feature MUST have one session, in its worktree and with the server's copy of the skill, where runs and chat follow each other and the agent acts on a chat only when asked.                                                                                                 | `packages/server/src/runner/__tests__/sessions.test.ts; claude.test.ts`                                                                           | 4, 7 |
| [attachments](../decisions/attachments.md): An image attached to a workflow file MUST be committed beside that file, linked with a relative markdown image, and leave with its feature; a record MUST NOT link to an image.                                                                                     | `crates/core/tests/attach.rs; images.rs; packages/server/src/__tests__/attach.test.ts`                                                            | 4, 7 |
| [attachments](../decisions/attachments.md): Images attached to a chat MUST stay out of git, in Uraeda's data folder.                                                                                                                                                                                            | `crates/core/tests/attach.rs; images.rs; packages/server/src/__tests__/attach.test.ts`                                                            | 4, 7 |
| [attachments](../decisions/attachments.md): The core MUST turn every attached image into one small, safe WebP, whatever tool received it, and MUST refuse types that can carry code, such as SVG.                                                                                                               | `crates/core/tests/attach.rs; images.rs; packages/server/src/__tests__/attach.test.ts`                                                            | 4, 7 |
| [attachments](../decisions/attachments.md): The server MUST serve attached images so a browser cannot run them as a page.                                                                                                                                                                                       | `crates/core/tests/attach.rs; images.rs; packages/server/src/__tests__/attach.test.ts`                                                            | 4, 7 |
| [benchmarks](../decisions/benchmarks.md): Agents MUST NOT start a benchmark run without a human's explicit approval, and the run's record MUST name who gave it.                                                                                                                                                | `packages/benchmarks/src/__tests__/run-case.test.ts; human.test.ts; data.test.ts; grader.test.ts`                                                 | 4, 7 |
| [benchmarks](../decisions/benchmarks.md): A run MUST load the skill from a named commit, never from the working tree, and MUST record that commit and whether the tree was clean.                                                                                                                               | `packages/benchmarks/src/__tests__/run-case.test.ts; human.test.ts; data.test.ts; grader.test.ts`                                                 | 4, 7 |
| [benchmarks](../decisions/benchmarks.md): The simulated human MUST see only what a human would open, never the hidden tests or the reference solution, and a run MUST be marked invalid when the human's commit touches a file outside the feature's workflow files.                                            | `packages/benchmarks/src/__tests__/run-case.test.ts; human.test.ts; data.test.ts; grader.test.ts`                                                 | 4, 7 |
| [benchmarks](../decisions/benchmarks.md): A run MUST be marked failed when a session's models name one other than the model asked for.                                                                                                                                                                          | `packages/benchmarks/src/__tests__/run-case.test.ts; human.test.ts; data.test.ts; grader.test.ts`                                                 | 4, 7 |
| [benchmarks](../decisions/benchmarks.md): A run MUST record the commits, the harness and its version, the models asked for and answered, the effort, the task and its image digest, the simulated human's model and guidelines, each step's time, cost, and gate outcome, and every address the agents fetched. | `packages/benchmarks/src/__tests__/run-case.test.ts; human.test.ts; data.test.ts; grader.test.ts`                                                 | 4, 7 |
| [benchmarks](../decisions/benchmarks.md): Git MUST hold each run's record, scores, `specs/` files, and final diff, and MUST NOT hold raw transcripts, which stay local with their SHA-256 recorded.                                                                                                             | `packages/benchmarks/src/__tests__/run-case.test.ts; human.test.ts; data.test.ts; grader.test.ts`                                                 | 4, 7 |
| [cli](../decisions/cli.md): Every action a TUI offers MUST also be available non-interactively, so an agent never meets a prompt it cannot answer.                                                                                                                                                              | `crates/cli/tests/{answer,check,install,status,next}.rs`                                                                                          | 4, 7 |
| [cli](../decisions/cli.md): What commands print MUST be stable for tools to read: data apart from messages, and versioned JSON on every read command.                                                                                                                                                           | `crates/cli/tests/{answer,check,install,status,next}.rs`                                                                                          | 4, 7 |
| [code-quality](../decisions/code-quality.md): The TypeScript lint configuration MUST extend `@nkzw/oxlint-config`, the fate stack's shared one, and MAY turn off its rules only where an active decision conflicts.                                                                                             | `packages/web/src/__tests__/lint.test.ts`                                                                                                         | 4, 7 |
| [diagrams](../decisions/diagrams.md): The web UI MUST draw a diagram with the [`pele`](/packages/web/package.json) package, and a diagram MUST NOT run a script in the page, even when its text holds one.                                                                                                      | `packages/web/src/__tests__/diagram-hostile.test.tsx; diagram.test.tsx`                                                                           | 5, 7 |
| [diagrams](../decisions/diagrams.md): A diagram that fails to draw MUST show its source instead.                                                                                                                                                                                                                | `packages/web/src/__tests__/diagram-hostile.test.tsx; diagram.test.tsx`                                                                           | 5, 7 |
| [distribution](../decisions/distribution.md): The web UI MUST ship as an npm package that runs on the user's own Node, not as a bundled runtime or a single executable.                                                                                                                                         | `packages/uraeda/scripts/smoke.ts; release.test.ts`                                                                                               | 4, 7 |
| [distribution](../decisions/distribution.md): The package MUST be self-contained, with the native binding in one package per supported platform, and MUST NOT run install scripts or download anything when it runs.                                                                                            | `packages/uraeda/scripts/smoke.ts; release.test.ts`                                                                                               | 4, 7 |
| [distribution](../decisions/distribution.md): The packaged server MUST NOT read a `.env` file, taking settings only from the [settings](../decisions/settings.md) decision's sources.                                                                                                                           | `packages/uraeda/scripts/smoke.ts; release.test.ts`                                                                                               | 4, 7 |
| [git](../decisions/git.md): Tools MUST NOT lose the user's work: they never force-remove a worktree, force-push, or delete a branch the default branch lacks, and remove or delete anything only when a human asks.                                                                                             | `crates/core/tests/{git,worktrees,workspace,clean}.rs; crates/cli/tests/note.rs`                                                                  | 4, 7 |
| [git](../decisions/git.md): Tools MUST NOT bypass the user's hooks, signing, or credentials, and MUST NOT switch the user's checkout unless the human asks.                                                                                                                                                     | `crates/core/tests/{git,worktrees,workspace,clean}.rs; crates/cli/tests/note.rs`                                                                  | 4, 7 |
| [git](../decisions/git.md): A branch MUST count as a feature or a change, and its step be read, only from its latest commit.                                                                                                                                                                                    | `crates/core/tests/{git,worktrees,workspace,clean}.rs; crates/cli/tests/note.rs`                                                                  | 4, 7 |
| [git](../decisions/git.md): Drafts, the backlog, and the human's inbox and priorities MUST be written on the default branch.                                                                                                                                                                                    | `crates/core/tests/{git,worktrees,workspace,clean}.rs; crates/cli/tests/note.rs`                                                                  | 4, 7 |
| [git](../decisions/git.md): An agent's inbox notes MUST be written in its own worktree, never on the default branch.                                                                                                                                                                                            | `crates/core/tests/{git,worktrees,workspace,clean}.rs; crates/cli/tests/note.rs`                                                                  | 4, 7 |
| [git](../decisions/git.md): Tools SHOULD keep their worktrees out of the user's `git status` without editing a tracked file.                                                                                                                                                                                    | `crates/core/tests/{git,worktrees,workspace,clean}.rs; crates/cli/tests/note.rs`                                                                  | 4, 7 |
| [notifications](../decisions/notifications.md): A notification MUST be shown only when an item, in any repository, comes to need the human, as the server's statuses say, never the web UI's own logic.                                                                                                         | `packages/web/src/__tests__/notify.test.tsx; packages/server/src/__tests__/needs-you.test.ts`                                                     | 5, 7 |
| [notifications](../decisions/notifications.md): The browser's permission MUST be asked only after the human is told what will notify, never on page load, and a refusal MUST be kept.                                                                                                                           | `packages/web/src/__tests__/notify.test.tsx; packages/server/src/__tests__/needs-you.test.ts`                                                     | 5, 7 |
| [notifications](../decisions/notifications.md): Notifications MUST NOT interrupt a human who is already looking at Uraeda, and a click MUST open the item.                                                                                                                                                      | `packages/web/src/__tests__/notify.test.tsx; packages/server/src/__tests__/needs-you.test.ts`                                                     | 5, 7 |
| [notifications](../decisions/notifications.md): The tab's title SHOULD count the items that need the human.                                                                                                                                                                                                     | `packages/web/src/__tests__/notify.test.tsx; packages/server/src/__tests__/needs-you.test.ts`                                                     | 5, 7 |
| [problems](../decisions/problems.md): A check result MUST count as a feature's problem only when its rule stops the workflow; every other result MUST be a note.                                                                                                                                                | `crates/core/tests/problems.rs; crates/cli/tests/check.rs; packages/web/src/__tests__/home.test.tsx`                                              | 4, 7 |
| [problems](../decisions/problems.md): Whether a rule stops the workflow MUST be decided once, in the core, never by a tool reading its results.                                                                                                                                                                 | `crates/core/tests/problems.rs; crates/cli/tests/check.rs; packages/web/src/__tests__/home.test.tsx`                                              | 4, 7 |
| [problems](../decisions/problems.md): Home and the sidebar's cards MUST show problems only, and notes MUST show only on their item's page.                                                                                                                                                                      | `crates/core/tests/problems.rs; crates/cli/tests/check.rs; packages/web/src/__tests__/home.test.tsx`                                              | 4, 7 |
| [problems](../decisions/problems.md): `ura check` and editors MUST keep reporting every result at its own severity: a note is the UI's reading of an error.                                                                                                                                                     | `crates/core/tests/problems.rs; crates/cli/tests/check.rs; packages/web/src/__tests__/home.test.tsx`                                              | 4, 7 |
| [repositories](../decisions/repositories.md): The list MUST be data in the data folder, never in a repository or the session cache, and only the Rust core MUST read or write it.                                                                                                                               | `crates/core/tests/repositories.rs; packages/server/src/__tests__/repositories.test.ts; live.test.ts`                                             | 4, 7 |
| [repositories](../decisions/repositories.md): Each entry MUST be a git repository's main checkout, listed once, under a unique readable name.                                                                                                                                                                   | `crates/core/tests/repositories.rs; packages/server/src/__tests__/repositories.test.ts; live.test.ts`                                             | 4, 7 |
| [repositories](../decisions/repositories.md): Removing a repository from the list MUST NOT change its files or its cached sessions.                                                                                                                                                                             | `crates/core/tests/repositories.rs; packages/server/src/__tests__/repositories.test.ts; live.test.ts`                                             | 4, 7 |
| [repositories](../decisions/repositories.md): One server MUST serve every listed repository, and every page and route that touches a repository's data MUST be scoped to it by name, never mixing two.                                                                                                          | `crates/core/tests/repositories.rs; packages/server/src/__tests__/repositories.test.ts; live.test.ts`                                             | 4, 7 |
| [repositories](../decisions/repositories.md): Each repository MUST have its own data endpoint and live updates; only a global one MAY span every repository.                                                                                                                                                    | `crates/core/tests/repositories.rs; packages/server/src/__tests__/repositories.test.ts; live.test.ts`                                             | 4, 7 |
| [repositories](../decisions/repositories.md): An entry MAY hold UI presentation, which workflow rules MUST NOT read.                                                                                                                                                                                            | `crates/core/tests/repositories.rs; packages/server/src/__tests__/repositories.test.ts; live.test.ts`                                             | 4, 7 |
| [settings](../decisions/settings.md): Settings MUST live in one TOML file in the config folder, on macOS too, apart from Uraeda's data and secrets, and MUST NOT hold a secret or be read from a repository.                                                                                                    | `crates/core/tests/settings.rs; settings_writes.rs; packages/server/src/__tests__/settings.test.ts; packages/web/src/__tests__/settings.test.tsx` | 4, 7 |
| [settings](../decisions/settings.md): A write MUST keep a human's comments, unknown keys, and order, and MUST NOT overwrite a file that is unreadable or invalid.                                                                                                                                               | `crates/core/tests/settings.rs; settings_writes.rs; packages/server/src/__tests__/settings.test.ts; packages/web/src/__tests__/settings.test.tsx` | 4, 7 |
| [settings](../decisions/settings.md): A setting MUST resolve from its flag, then its environment variable, the file, and its default, and a flag or variable MUST NOT be written into the file.                                                                                                                 | `crates/core/tests/settings.rs; settings_writes.rs; packages/server/src/__tests__/settings.test.ts; packages/web/src/__tests__/settings.test.tsx` | 4, 7 |
| [settings](../decisions/settings.md): A setting changed in the web UI MUST apply at once when it can, and otherwise the page MUST say when it applies.                                                                                                                                                          | `crates/core/tests/settings.rs; settings_writes.rs; packages/server/src/__tests__/settings.test.ts; packages/web/src/__tests__/settings.test.tsx` | 4, 7 |
| [sign-in](../decisions/sign-in.md): Every request MUST carry a valid session, except the built UI's files, the sign-in routes, and preview and mockup paths that carry the current frame secret.                                                                                                                | `packages/server/src/sign-in/__tests__/{closed,store,routes,frames}.test.ts; preview/__tests__/proxy.test.ts`                                     | 4, 7 |
| [sign-in](../decisions/sign-in.md): The access key MUST be generated, shown once, and stored only as a hash; sessions MUST be random and stored hashed.                                                                                                                                                         | `packages/server/src/sign-in/__tests__/{closed,store,routes,frames}.test.ts; preview/__tests__/proxy.test.ts`                                     | 4, 7 |
| [sign-in](../decisions/sign-in.md): A session MUST end after 30 days without use, at sign-out, or when the key changes, and signing out MUST end its live streams.                                                                                                                                              | `packages/server/src/sign-in/__tests__/{closed,store,routes,frames}.test.ts; preview/__tests__/proxy.test.ts`                                     | 4, 7 |
| [sign-in](../decisions/sign-in.md): A failed sign-in MUST NOT lock the owner out, and MUST NOT be a cheap guess.                                                                                                                                                                                                | `packages/server/src/sign-in/__tests__/{closed,store,routes,frames}.test.ts; preview/__tests__/proxy.test.ts`                                     | 4, 7 |
| [sign-in](../decisions/sign-in.md): The frame secret MUST change whenever a session ends and reach only signed-in pages, and a process the server runs MUST NOT receive Uraeda's credentials.                                                                                                                   | `packages/server/src/sign-in/__tests__/{closed,store,routes,frames}.test.ts; preview/__tests__/proxy.test.ts`                                     | 4, 7 |
| [stack](../decisions/stack.md): The server MUST accept only requests that Uraeda's own pages, or frames it gave a secret, make, and MUST listen only on the loopback interface.                                                                                                                                 | `packages/server/src/__tests__/guard.test.ts; preview/__tests__/{proxy,runner}.test.ts; packages/web/src/__browser__/story-embed.test.tsx`        | 4, 7 |
| [stack](../decisions/stack.md): The server MUST NOT let a preview's frame save, create, or open files, through Storybook or otherwise, and the web UI MUST sandbox previews apart from Uraeda's origin.                                                                                                         | `packages/server/src/__tests__/guard.test.ts; preview/__tests__/{proxy,runner}.test.ts; packages/web/src/__browser__/story-embed.test.tsx`        | 4, 7 |
| [stack](../decisions/stack.md): The server MAY run a checkout's active [preview](../decisions/preview.md) command, and MUST stop it when the server stops.                                                                                                                                                      | `packages/server/src/__tests__/guard.test.ts; preview/__tests__/{proxy,runner}.test.ts; packages/web/src/__browser__/story-embed.test.tsx`        | 4, 7 |
| [toolchain](../decisions/toolchain.md): `vp run ready` MUST run every check of the repository, rerunning only what a change can affect, and a new language, package, crate, or tool MUST add its checks to it.                                                                                                  | `packages/server/src/__tests__/toolchain.test.ts; scripts/__tests__/fast-selection.test.ts; packages/server/src/__tests__/test-run.test.ts`       | 1, 7 |
| [toolchain](../decisions/toolchain.md): CI MUST run the same checks as `ready`, uncached, in the Nix dev shell.                                                                                                                                                                                                 | `packages/server/src/__tests__/toolchain.test.ts; scripts/__tests__/fast-selection.test.ts; packages/server/src/__tests__/test-run.test.ts`       | 1, 7 |
| [toolchain](../decisions/toolchain.md): Tests MUST be isolated, so runs in several checkouts of one machine do not collide.                                                                                                                                                                                     | `packages/server/src/__tests__/toolchain.test.ts; scripts/__tests__/fast-selection.test.ts; packages/server/src/__tests__/test-run.test.ts`       | 1, 7 |
| [toolchain](../decisions/toolchain.md): Test runners MUST NOT retry a failed test, and a test failing without a bug MUST be fixed in the pull request that finds it.                                                                                                                                            | `packages/server/src/__tests__/toolchain.test.ts; scripts/__tests__/fast-selection.test.ts; packages/server/src/__tests__/test-run.test.ts`       | 1, 7 |
| [ui-behaviour](../decisions/ui-behaviour.md): Small edits MUST happen in place, and a dialog MUST only confirm an irreversible action or hold a short form.                                                                                                                                                     | `packages/web/src/__tests__/{round,review,writes,leave,priorities}.test.tsx; src/__browser__/{fields,scroll,sidebar}.test.tsx`                    | 5, 7 |
| [ui-behaviour](../decisions/ui-behaviour.md): Text MUST save only on an explicit action, and unsaved text MUST be marked and never dropped without asking.                                                                                                                                                      | `packages/web/src/__tests__/{round,review,writes,leave,priorities}.test.tsx; src/__browser__/{fields,scroll,sidebar}.test.tsx`                    | 5, 7 |
| [ui-behaviour](../decisions/ui-behaviour.md): Status MUST show next to what it concerns, and an error MUST stay there until dealt with, never only in a toast.                                                                                                                                                  | `packages/web/src/__tests__/{round,review,writes,leave,priorities}.test.tsx; src/__browser__/{fields,scroll,sidebar}.test.tsx`                    | 5, 7 |
| [ui-behaviour](../decisions/ui-behaviour.md): A git write MUST show its action at once and never a guessed status, and MUST block other git writes until it ends.                                                                                                                                               | `packages/web/src/__tests__/{round,review,writes,leave,priorities}.test.tsx; src/__browser__/{fields,scroll,sidebar}.test.tsx`                    | 5, 7 |
| [ui-behaviour](../decisions/ui-behaviour.md): Back and reload MUST keep the human's place and what they were reading.                                                                                                                                                                                           | `packages/web/src/__tests__/{round,review,writes,leave,priorities}.test.tsx; src/__browser__/{fields,scroll,sidebar}.test.tsx`                    | 5, 7 |
| [ui-behaviour](../decisions/ui-behaviour.md): Every action MUST work by tap and by keyboard, never by hover alone.                                                                                                                                                                                              | `packages/web/src/__tests__/{round,review,writes,leave,priorities}.test.tsx; src/__browser__/{fields,scroll,sidebar}.test.tsx`                    | 5, 7 |
| [ui-behaviour](../decisions/ui-behaviour.md): Lists whose rows open a pane SHOULD share one keyboard behaviour.                                                                                                                                                                                                 | `packages/web/src/__tests__/{round,review,writes,leave,priorities}.test.tsx; src/__browser__/{fields,scroll,sidebar}.test.tsx`                    | 5, 7 |
| [ui-layout](../decisions/ui-layout.md): On narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and dialogs.                                                                                                                                                               | `packages/web/src/__browser__/{layout,overlay,sidebar,side-column}.test.tsx; packages/web/src/__tests__/pane.test.tsx`                            | 5, 7 |
| [ui-layout](../decisions/ui-layout.md): Text MUST stay readable at each width without zoom, and controls MUST be easy to hit by touch.                                                                                                                                                                          | `packages/web/src/__browser__/{layout,overlay,sidebar,side-column}.test.tsx; packages/web/src/__tests__/pane.test.tsx`                            | 5, 7 |
| [ui-layout](../decisions/ui-layout.md): An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change keeps it.                                                                                                                                                                          | `packages/web/src/__browser__/{layout,overlay,sidebar,side-column}.test.tsx; packages/web/src/__tests__/pane.test.tsx`                            | 5, 7 |
| [ui-layout](../decisions/ui-layout.md): A column that takes room from the main content SHOULD be foldable and resizable.                                                                                                                                                                                        | `packages/web/src/__browser__/{layout,overlay,sidebar,side-column}.test.tsx; packages/web/src/__tests__/pane.test.tsx`                            | 5, 7 |
| [UI behavior](../decisions/ui-behaviour.md): A growing view mounts bounded rows; folded content is                                                                                                                                                                                                              |
| not mounted, checked by counts rather than elapsed time.                                                                                                                                                                                                                                                        |
| `packages/web/src/__tests__/session-tail.test.tsx; session.test.tsx`                                                                                                                                                                                                                                            | 5, 7                                                                                                                                              |      |
| [UI coherence](../decisions/ui-coherence.md): Reading prose goes through Prose, with a shrinking                                                                                                                                                                                                                |
| list of legacy exceptions guarded by lint and a test.                                                                                                                                                                                                                                                           |
| `packages/web/src/__tests__/lint.test.ts; packages/server/src/__tests__/stack.test.ts`                                                                                                                                                                                                                          | 5, 7                                                                                                                                              |

## Waves

1. Task 1 alone: establishes selection/configuration and its checked contracts.
2. Task 2 alone: proves Composer and core/binding pilots before expanding repairs. Resolve or report
   a pilot conflict first.
3. Tasks 3 and 4: fixture execution versus core/server guarantees; no shared code files. Each may
   append its own ruling and check only its own task boxes.
4. Tasks 5 and 6: UI/browser/editor cases versus skill/template/example wording; no shared code
   files.
5. Task 7 alone: reconciles main, validates every family, audits coverage/deletions, and produces
   hosted evidence and the pull request.

---

## Task 1: Select focused and boundary checks before optional prerequisites

**Risky:** Changes validation selection and cache ownership; a false pass can hide affected
behavior.

**Files:** Create `scripts/fast-selection.ts`, `scripts/fast-check.ts`,
`scripts/__tests__/fast-selection.test.ts`, `scripts/vite.config.ts`, `vite.fast.config.ts`, and
`packages/web/vite.transforms.ts`. Modify `vite.config.ts`, `vite.tasks.ts`, and
`packages/web/vite.config.ts`; update `packages/server/src/__tests__/toolchain.test.ts` for the new
fast task.

**Interfaces:** Produce `Change = { path: string; deleted: boolean; added: boolean }` (ruling R10),
`changedFiles(root: string, base?: string): Change[]`, and
`selectFast(changes: Change[]): FastSelection`. `FastSelection` exposes related source paths, whole
selected families, affected Rust packages/workspace, required checks, and named deferred checks. The
runner reports discovered test filenames and executes the selected specifications in one Vitest
lifetime. Produce `uiTransforms()` and `uiTestOptions()` for normal and focused configurations
(R11); no production server/fresh-binding import is allowed in lightweight discovery. After the wave
1 review (R9, R10): a family's inputs include the files its sources import from outside its root,
`rustCommands(rust)` builds the Rust chain with reverse dependents and never nextests the binding or
the workspace flag, `unproven` fails a selected family with no discovered test, and fast takes its
heavy slot itself, after selecting, never around ready.

- [x] **Step 1: Add behavior tests and minimal interfaces.** Cover whitespace paths, explicit
      invalid base, clean-tree latest commit, initial commit, untracked files, deleted/renamed
      paths, declaration/config broadening, skill/native/fixture routing, and docs-only changes.
      Assert Composer selects related focused behavior without Rust or App journeys; native/skill
      selects real contracts and Rust; deferred families are named. A wrong selector that ignores a
      deletion, treats a git error as empty, or routes a UI edit to all App tests must fail.
- [x] **Step 2: Run the selector tests to observe intended failures.** Use
      `nix develop -c vp test --config scripts/vite.config.ts --run` after creating the minimum
      configuration and interfaces. Expected: behavioral routing assertions fail, rather than a
      missing import or missing helper.
- [x] **Step 3: Implement selection and shared transforms.** Use one family/input registry;
      conservative fallback broadens affected fast families. Keep all old tests in ready. Register
      scripts tests with ready. Unknown new tests default to complete validation rather than
      disappearing. Source declarations and runtime/native dependencies have explicit owners; reuse
      binding `SOURCES` instead of copying it. Fast has no unconditional production/native build
      dependency. Build native output only for selected consumers and before loading it. Git and
      discovery failures exit nonzero. Preserve wrapper isolation, process cleanup, and machine-wide
      resource coordination.
- [x] **Step 4: Validate configuration and selection.** Run selector tests,
      `nix develop -c vp check`, toolchain tests, a focused pure test, and a retained application
      test. Show the discovered graph for a UI edit cannot load App, createApp,
      `uraeda-server/testing`, or a native loader. Temporarily break native/skill/deletion routing,
      observe the relevant assertion fail, and restore it.
- [x] **Step 5: Commit.** `feat(fix-testing): select focused checks before build prerequisites`.

Task 1 evidence (2026-10-20):

- The 13 selector cases first failed on behavioral assertions against minimal interfaces. The
  completed scripts suite passes 16 cases, including actual transitive UI discovery/execution,
  discovery failure with runner cleanup, and refusal of an empty required family.
- `nix develop -c vp check` passes. The toolchain suite passes 28 cases. The retained `home` and
  `composer-images` suites pass 20 cases through the normal UI configuration. No legacy test was
  removed or excluded from ready; ready now also registers the scripts project.
- A `ComposerImages.tsx` edit discovers only `composer-images.test.tsx`: 32 discovery modules,
  without App, createApp, server testing, or a native loader. This passed before this checkout had
  native output. This is configuration evidence, not the Composer pilot or its timing result.
- Removing native source ownership, disabling skill/native routing, and ignoring deleted source each
  made its relevant selector assertion fail; all faults were restored. A native build was explicitly
  requested only for the retained application/toolchain checks (`binding:touch`, cache hit);
  lightweight UI discovery did not request it.
- Application journeys, phone/desktop browsers, production/package builds and smoke, and full
  workspace/editor checks remain named deferred checks. Legitimate zero related matches are reported
  separately from discovery errors; a required family with no files is an error.

Task 2 must replace the anticipated `src/__tests__/composer.test.tsx` membership with the pilot's
actual path, and switch fast binding membership from legacy `index.test.ts` to the new
`contracts.test.ts` once it exists. The legacy suite stays in ready throughout.

## Task 2: Prove Composer and real native contracts within the fast budget

**Risky:** A scripted endpoint or shallow assertion can create false confidence; pilots gate further
repairs.

**Files:** Create `packages/server/src/__tests__/request-fixture.ts`,
`packages/web/src/__focused__/composer.test.tsx`, `packages/web/src/__focused__/helpers.tsx`, and
`packages/binding/contracts.test.ts`. Modify the server's test-only export, fast family
registration, and focused configuration as needed. Retain existing session, composer-image, native
image/watch, and core preservation tests.

**Interfaces:** Consume Task 1 selection/configuration. Produce `createRequestFixture(options)`
returning `{ fetch, requests, close }`, typed from production Agent/Session and mutation inputs. Use
actual fate server/data views/source serialization, with scripted handlers and controlled promises;
unexpected calls fail immediately. A chat upload must carry `chat=1` and its `name` in the query, as
the server requires, and `chatImages` lists the images a case starts with (R11). The focused render
helper renders Composer under actual fate, repository, Suspense, and fetch contexts with a fresh
client per case.

- [x] **Step 1: Add focused contract cases.** Refused multiline text and two saved images must reach
      an available endpoint and restore exact text/order with a visible error. A pending custom send
      retains its draft and submits once; refusal retains it, success clears images while the caller
      owns text. An upload in progress blocks Send/Enter; a workflow sends no draft images and
      retains them; removing an uploading thumbnail does not resurrect it. Native contracts verify
      camelCase settings output, a real settings write/reload, synchronous validation errors, and
      asynchronous rejection mapping. Existing core settings cases retain BOM, CRLF, and surviving
      comments inside arrays.
- [x] **Step 2: Run the new cases and prove the required boundary.** Expected: all preserved
      behavior passes; missing context/transport issues are fixed in the fixture, not hidden by
      permissive expectations. Show a refused request reached its handler; temporarily drop restored
      text/images or accept a generic wrong error and observe failure, then restore.
- [x] **Step 3: Measure complete fast commands for Composer and core edits.** Use reversible
      one-file content edits, restore them after each measurement, and record actual
      selected/deferred files. Include startup, binding compilation, checks, lock wait, and
      teardown; report cold and warm states separately. Run core through reverse-dependent nextest
      packages and real native contracts, without all App journeys.
- [x] **Step 4: Resolve or report the pilot result before expanding.** Both pilots must preserve
      their asserted guarantees and meet SC-002. A failed sample is not waived or fixed by deleting
      protection. Fix the measured cause within scope; otherwise return the precise conflict.
- [x] **Step 5: Commit the pilot and its evidence.**
      `test(fix-testing): prove focused composer and binding contracts`.

Task 2 evidence (2026-10-20, 32-thread Linux machine shared with other checkouts' runs):

- `request-fixture.ts` serves fate's own server with the server's roots, data views, source plans,
  `withWholeFields` and `callSiteError`; every production mutation name is registered, and one
  without a handler, an unknown read, or an unscripted path fails the case at teardown. It loads no
  binding. The five focused Composer cases and five native contracts pass in their suites, one by
  one (`-t`), and under the normal web/binding configurations; the legacy `index.test.ts` (17) and
  the discovery/selector suites (16) pass. Keyboard submission is Ctrl+Enter, per R5.
- The refused send's request reached the `session.send` handler with exact text and image order
  before the refusal. Faults made the owning case fail, then were restored: dropping restored text
  (`expected ''`), dropping restored images (`expected []`), a generic error instead of the server's
  (message not found), workflow sending draft images (extra `images`), sending while saving (Send
  not disabled), a second custom send while pending (two calls), forgetting a discarded upload (no
  `delete`), a binding error without its code (`refused:`/`unreadable:` cases), and a swallowed
  synchronous port error (nothing thrown).
- Composer edit (`Composer.tsx` comment): selects only
  `packages/web/src/__focused__/composer.test.tsx` (no App, createApp, server testing/app, or native
  loader in the graph), Rust none, deferred: application journeys, browser phone/desktop, production
  builds/package smoke, full workspace/editor checks. Cold (Vite caches removed): 14.49 s. Warm:
  11.24, 12.57, 12.23 s; after R7, 16.55 and 14.36 s at load average 43 to 45.
- Core edit (`crates/core/src/settings.rs` comment, new content each run): selects the binding
  family (`contracts.test.ts`), `binding:touch`, Rust `uraeda-core`. Sequential runner,
  `uraeda-core` only: cold (no built binding, seeded `target/`) 59.98 s; warm 59.45, 76.50, 52.18 s
  at load 20 to 63. Phases (warm): startup and selection 3 s, `vp check` 9 to 14 s, napi build 2 to
  4 s, fmt and clippy 7 s, test build 14 s, nextest 14 to 22 s for 756 tests, Vitest 0.2 s. After
  R7, still `uraeda-core` only: 45.09, 43.19, 44.06 s.
- The selector runs only `-p uraeda-core` for a core edit (wave 1 review item 3, fixed separately):
  with a temporary local commit (dropped after measuring) adding `uraeda-cli` and `uraeda-lsp`, the
  R7 runner took 46.41, 50.73, 46.87 s warm and 47.46 s with no built binding (1,040 Rust tests),
  all under 1 minute at load average 54 to 67. A clean `target/` without the dev shell's seed was
  not measured.
- Wave 1 review items: (1) a server-only edit, including `request-fixture.ts`, does not reach the
  focused UI suite; it did not affect these samples, whose edits were in `packages/web` and
  `crates/core`. (2) The focused Composer cases read no settings or temporary folders and pass under
  the normal web configuration. (3) Affected the core samples as above. (4) Not exercised.
- Focused helpers are excluded from coverage like `__tests__`.

Wave 1 review fixes (2026-10-20, same shared machine; rulings R9 to R11, R7 updated):

- Fixed: cross-package consumers (I1), reverse dependents and binding clippy (I2), no nextest
  `--workspace` (I3), `vite.fast.config.ts` in `ts:test` (I4), heavy slot after selection (I5),
  shared UI test options (I6), unproven families (M1), named configuration files (M2), legacy test
  edits deferred (M3), nested runs through `test-run.ts` (M4). Wave 2: the fixture's upload contract
  (W1), shared `rewritten` (W2), binding build before the type check (W3), local image path routed
  to the UI (W4), restored `EventSource` (W5), refused-send image order (W6). W7 is not done:
  mutation `type`s are plain strings, so typing answers needs production `as const`.
- `nix develop -c vp check` passes; the scripts suite passes 46 cases, the toolchain suite 29, the
  focused Composer and composer-images cases 6, the binding project 32 (contracts 5), and the
  server's `test-run`, `coverage-summary` and `fate` suites 48.
- Composer edit (`Composer.tsx` comment, warm): selects only the focused Composer suite; 14.26,
  14.47, 13.78 s at load 7 to 13; 25.99, 14.72, 30.46, 32.23, 21.82 s at load 14 to 73.
- Core edit (`settings.rs` comment, warm): Rust `uraeda-core`, `uraeda-binding` (clippy only),
  `uraeda-cli`, `uraeda-lsp`, 1,040 Rust tests, `contracts.test.ts`. 55.19 s at load 9; 56.24,
  56.27, 59.00 s at load 28 to 52; 69.36 to 95.00 s at load 37 to 87 (one with a lock wait). Phases
  at load 36: startup 6.5 s, napi build 7.4 s plus 8 s of Vite Task saving its output, fmt and
  clippy 11 s, test build 25 s, nextest 23 s, Vitest 0.5 s. An alternating comparison with the type
  check beside the binding build (71.86 to 88.45 s) and after it (65.76 to 95.37 s), at load 42 to
  100, showed no difference; clippy with or without `uraeda-binding` took 8 to 10 s. The core pilot
  meets SC-002 only below a load of about 50.
- Server edit (`limits.ts` comment): 34 server files, 6 benchmarks files and the focused Composer
  suite, 797 tests; 75.64 and 85.91 s at load 44 to 58, Vitest 59.5 to 64.6 s; 157 and 216 s at load
  65 to 67, where `runner.test.ts` once hit its 10-second hook timeout. Over SC-002: the server
  family's related run, from Task 1, holds 34 of the files; I1 adds the benchmarks files (3.6 s
  alone) and the Composer suite. Left to Task 7's matrix.
- One Composer sample escalated to ready for an unnamed untracked input, likely another process's
  file in this checkout; ready then failed the UI discovery case on Vitest's 5-second default. The
  scripts project's timeout is now 130 s, and fast prints the changed paths.

## Task 3: Reuse immutable history while keeping every case independent

**Risky:** Shared fixture state, copied git metadata, or incomplete cleanup can contaminate
unrelated tests.

**Files:** Modify `packages/binding/test-utils.ts`, `packages/binding/test-utils.test.ts`, and
test-owned server/web fixture lifecycle helpers where profiling identifies setup/teardown overhead.
If a marked helper needs extraction, add a responsibility-specific helper module rather than growing
it.

**Interfaces:** Preserve `fixtureRepo(name = "repo"): string` and all existing callers. Build each
named history once per isolated test file (R12), in `packages/binding/test-repos.ts`, then return
independent mutable copies with valid git/worktree metadata. Fixture lifetime remains owned by the
existing test-run/file cleanup. Do not change production repository behavior.

- [x] **Step 1: Add isolation regressions.** Mutate and commit one copy, change refs/index/config,
      and verify another copy and a later copy retain original history/content. A repository
      containing linked worktrees must not point at another test's mutable files. Failure cleanup
      releases all owned resources.
- [x] **Step 2: Run those cases before optimization and capture fixture setup time.** Existing
      preservation assertions should already pass. A deliberately shared mutable directory or
      hard-linked mutable git data must make the isolation case fail.
- [x] **Step 3: Implement template reuse and measured lifecycle improvements.** Reuse immutable
      setup, never an evolving repository or server session. Profile server/socket/process cleanup
      before changing waits; release test-owned keepalive connections and child processes explicitly
      where they cause overhead. Do not delete real lifecycle tests or alter product timeouts.
- [x] **Step 4: Run fixture tests, affected server/web suites, and independent-by-name probes.**
      Compare setup, execution, cleanup, and overall duration on equal inputs. Run `vp run fast`;
      preserve exact old product assertions unless a separate ruling justifies a change.
- [x] **Step 5: Commit.** `test(fix-testing): reuse isolated fixture history`.

Task 3 evidence (2026-10-20, 32-thread Linux machine, `/tmp` on btrfs, shared with other checkouts'
runs; load averages as given):

- Four new cases in `packages/binding/test-utils.test.ts`: a copy changed in every mutable way
  (commit on `main`, moved and new refs, tag, config, index, working files, `gc`) leaves an earlier
  and a later copy's refs, config, index, files and objects as built, and no copy holds a
  hard-linked git file or an alternate object store; a copy's linked worktree points at its own
  metadata only, and another copy checks out the same branch on its own; a failed `commitsAt`
  removes its temporary worktree; a failed fixture build leaves no folder and fails again. Each of
  the five cases passes alone by name (`-t`) and in the suite; the binding project passes 36.
- Before optimizing, the preserved cases passed and the failed-build case failed
  (`expected 9 to be 7`: the partial repository was left). Faults, each restored: one shared
  repository for every call failed the history case (`expected { …(6) } to deeply equal { …(6) }`,
  also with the path check removed), the worktree, `commitsAt` and failed-build cases; a hard-linked
  copy (`cp -al`) failed the history case on its state; dropping the failed build's removal failed
  it (`expected 13 to be 11`); removing `commitsAt`'s `finally` failed the worktree-cleanup case. A
  `git clone --shared` copy failed three cases, on its missing commit identity rather than on its
  alternates.
- Fixture setup, summed over 4 workers: server project 522 calls, 90.5 to 99.8 s before, 22.9 s
  after (69 template builds of about 260 ms, copies about 10 ms); web project 871 calls, 245.6 s
  before, 27.7 to 27.9 s after. Teardown was profiled and left as it was (R13).
- Wall time on equal inputs, alternating the old and new `test-utils.ts`: server project 93.4 and
  81.4 s before, 53.2 and 50.2 s after (load 24 to 34); web project 306.6 s before (load 23 to 55),
  218.7 s after (load 55 to 22), and earlier 303.3 s before, 255.9, 248.7 and 245.5 s after (load 21
  to 42). All 888 server and 1,005 web cases pass in every run.
- `nix develop -c vp check` passes. `vp run fast` passed in 146 s at load 21 to 38: 75 files, 1,097
  tests, the Rust workspace (1,040 tests, `vite.tasks.ts` changed); deferred: application journeys,
  browser phone/desktop, production builds/package smoke, full workspace/editor checks, and the
  edited `test-utils.test.ts`, run directly above. Removing `test-repos.ts` from fast's loaders
  fails three selection cases. The browser project, which copies `fixtureRepo`'s result for each
  case, was not run: deferred to ready.

## Task 4: Preserve and strengthen core, server, and runner guard assertions

**Risky:** Covers data preservation, permission scope, uploads, git history, and process boundaries.

**Files:** Review and selectively repair
`crates/core/tests/{answered,settings_writes,images,clean}.rs`, `crates/cli/tests/install.rs`,
`packages/server/src/__tests__/attach.test.ts`,
`packages/server/src/runner/__tests__/{claude,sessions}.test.ts`, and preview lifecycle cases.
Production changes are limited to test seams needed for a precise guard; product defects outside the
approved scope are reported.

**Interfaces:** Preserve public core/server behavior and all distinct useful cases. Core owns the
full file/history/image matrix; binding and callers prove representative mapping rather than
duplicate every row.

- [x] **Step 1: Audit assertion adequacy against the approved guarantees.** Retain distinct
      merge/squash shapes, exact bytes, resource bounds, permission scope, queue/lifecycle
      transitions, image content/orientation/delays, and no-write refusal effects. Add a rollback
      case that fails after partial staging, rather than only before the temporary directory can be
      made.
- [x] **Step 2: Run preserved guards and the new rollback case.** Identify the first specific
      failing outcome; do not weaken any old guard merely to get green. Controlled input must
      isolate the intended refusal, including oversize before reading and chunked bounds.
- [x] **Step 3: Make targeted repairs and remove only established duplication/incidental
      expectations.** Record every removed/skipped/loosened case and its retained guarantee. Keep
      cheap core tables. Do not restore the failed all-flow deletion strategy or introduce a blanket
      ban on text/count/size assertions.
- [x] **Step 4: Run affected Rust/server tests, native contracts, and selective guard faults.**
      Break comment preservation, permission narrowing, body-limit enforcement, and history lookup
      in isolation; each owning check must fail, then restore. Collect comparable product-only
      coverage for changed areas; record unexecuted code and what asserts its behavior.
- [x] **Step 5: Commit.** `test(fix-testing): preserve independent guard assertions`.

Task 4 evidence (2026-10-20, 32-thread Linux machine shared with other checkouts' runs, load average
25 to 35):

- Audit: the read guards hold their contracts (R22). Added and strengthened: the install rollback
  after partial staging (R20), with `ura_with_file_limit` in `crates/cli/tests/common/mod.rs`; the
  chunked upload's read bound, the guard's refusal texts on both cross-site cases, and the no-file
  refusal (R21). Nothing removed, skipped, or loosened.
- Rollback: the new case passes on the product as it is. With the copy's cleanup removed, it fails
  (`left: 1, right: 0`, the `uraeda.ura-tmp` folder left in `.agents/skills`) while the old
  `a_failed_first_install_leaves_nothing` still passes.
- Faults, each restored after its run: removing a name dropped the comment and line end before it
  (`removing_a_name_takes_its_comments_with_it`); a replaced value lost its comment
  (`keeps_windows_line_ends`, `# usual` missing); a command's rule broadened to `Bash` (2 adapter
  cases, 9 session cases); a command with `*` given a rule (3 cases); path escaping skipped (3 rule
  rows); the body limit removed (both limit cases received `refused: The body holds no file.`); a
  chunked body read whole before refusing (only the strengthened case:
  `expected 65 to be less than or equal to 24`); the no-file check skipped (the new case:
  `Cannot read properties of undefined`); history read on first parents only
  (`a_merged_revision_keeps_the_review_it_answers`: `None`); the review read at the tip (3
  `answered.rs` cases).
- Runs: `cargo fmt --check`, `vp check`, clippy (`uraeda-core`, `uraeda-cli`, all targets) pass;
  nextest `uraeda-core` and `uraeda-cli` 965 passed, 9 skipped; server attach, adapter, sessions,
  and preview suites 221; binding contracts 5. Each changed case passes alone by name. `vp run fast`
  selected `uraeda-cli` and the attach suite (209 Rust tests, 16 Vitest) and passed in about 36 s at
  load 32. Deferred to ready: application journeys, browser phone/desktop, production builds/package
  smoke, full workspace/editor checks.
- Coverage (product files of the changed tests, on demand): `attach.ts` from its suite, 70% of lines
  before the no-file case; its one line no test ran was that refusal, now asserted; lines 50 to 74
  (`/inbox/note-image`) are run by `inbox.test.ts`. `crates/core/src/actions/install.rs` from
  `install.rs`: the cleanup line was already counted as run, by the old case, whose staging folder
  never exists, so line coverage could not show the gap. Not run by `install.rs`: a stale temporary
  file (170), an update writing a missing file (281 to 283), a manifest naming a missing file (323),
  and a link that would not reach `.agents` (382 to 385). The capped run writes no profile (R20).

Wave 3 review fixes (2026-10-20):

- The tmp leftover count asserts the isolated `TMPDIR` it relies on; the fixture isolation case now
  checks hard links on the working files as well as `.git`, and requires no `alternate:` line from
  `git count-objects -v`. A `cp -al` copy and a `git clone --shared` copy (identity copied, `origin`
  and its refs removed) each fail the real case; a single hard-linked working file fails the new
  link check alone (`expected [ '.../specs/PRIORITIES.md' ] to deeply equal []`) once the earlier
  state assertion is set aside, and the state assertion itself fails first otherwise. The
  `alternates` file check fails the shared clone before the `count-objects` line is reached. A
  copy's temporary entry is spliced out when its fill fails.
- The chunked upload's bound is 30 chunks (23 measured, 64 sent); R21's text says so.
- `clean.rs`'s locked and outside-worktree cases assert the whole `left`, an empty `did`, and the
  remaining branch; with clean ignoring a left worktree and deleting the branch, both fail.

## Task 5: Keep critical UI and browser journeys while removing expensive duplication

**Risky:** Wrong readiness or replacement of real browser semantics can hide integration failures.

**Files:** Modify
`packages/web/src/__tests__/{home,session,round,review,settings,sidebar}.test.tsx`, focused Composer
cases/helpers, and related application helpers. Review
`packages/web/src/__browser__/{layout,story-embed,story-comments,session-tail}.test.tsx`, browser
helpers/configuration, and `editors/nvim/tests/`. Keep exact file scope in the task commit/rulings
as evidence narrows the changes.

**Interfaces:** Consume proven pilots and unchanged fixtureRepo API. Focused cases own local
Composer variants; retain a real session/send/upload journey and real
answer/review/conflict/repository/authentication journeys. Browser owns frame isolation/messaging,
focus, keyboard/touch, scrolling, and the required page matrix.

- [x] **Step 1: Map old behavior before changing tests.** Identify independently covered variants,
      necessary complete journeys, and incidental heading/fixture coupling. Do not treat two
      different boundary refusals as duplicates because one flow reaches both.
- [x] **Step 2: Move only proven local cases to focused boundaries.** Retain exact request/draft
      assertions; await actual target links, displayed states, persisted outcomes, and completed
      transitions. Replace repeated remounts or fixed sleeps with explicit readiness; independent
      tests establish their own preconditions.
- [x] **Step 3: Consolidate required browser page checks and remove redundant setup/work.** Keep
      every governed page at both sizes/themes and all unique frame/message/pick protections. Keep
      actual paste/drop/keyboard/focus cases where an emulator cannot establish the behavior. Reduce
      editor checks to its approved main-action smoke only with a guarantee map.
- [x] **Step 4: Validate retained protection and independence.** Temporary home-heading rename
      passes; broken submission, lost draft, untrusted frame message, or duplicate commit fails its
      owner. Run changed cases individually, full affected application suites, phone/desktop browser
      checks, and applicable editor smoke. Collect comparable UI coverage and explain losses; record
      all test expectation changes.
- [x] **Step 5: Commit.** `test(fix-testing): focus ui cases and retain browser contracts`.

Task 5 evidence:

- Known failure (R30): the wave 3 `ready` thumbnail-focus failure was a product race, fixed in
  `ComposerImages.tsx` (the focus waits until the removed key is gone). Before: 2 of 40 copies of
  the case failed under 12 busy loops (load 40 to 60), with the focus log showing the removed button
  taking it; after: 0 of 40 under the same load. New case in `composer-images.test.tsx` fails on the
  old code and passes now.
- Home rename (R31): "Needs you" renamed to "Waiting on you" in the card, its list, and its count
  failed 11 cases in 4 files before the changes; with them, `home`, `notify`, `sign-in`, `usage`
  pass renamed and unrenamed. The whole `uraeda-web` project with the rename: the 6 failures were
  those cases and `build.test.ts`, which needs `vp run web:build` (a built bundle, absent in this
  worktree; owned by ready).
- Faults, each restored after its run: broken submission (the send's `text` emptied): 27 cases
  failed across `__focused__/composer.test.tsx` and `session.test.tsx`; lost draft (the refusal's
  `onChange(text)` removed): `composer.test.tsx` "a refused send reaches the endpoint…" and
  `session.test.tsx` "a refused send keeps the text…"; untrusted frame message (the source check of
  `StoryFrames.tsx` removed): exactly the two desktop browser cases of R34; duplicate commit (the
  submit handler adding an empty commit of the same subject): `round.test.tsx` "submitting commits
  the round…" `expected 4 to be 3` (R32).
- Runs: `vp check` (format, lint, types, 636 files) passes. Affected jsdom suites (`home`,
  `session`, `round`, `review`, `settings`, `sidebar`, `composer-images`, `notify`, `sign-in`,
  `usage`, focused composer): 279 passed in 90 s at load 15 to 25. Full `uraeda-web` project with
  the rename applied: 1000 passed, 6 failed (above), 6 min 11 s at load 28 to 46. Browser, four
  named files (`layout`, `story-embed`, `story-comments`, `session-tail`): phone 88 passed, 34
  skipped (2 min 34 s at load 38 to 22); desktop 117 passed, 5 skipped (3 min 44 s at load 22 to
  25). Neovim `vp run test:nvim`, every `tests/test_*.lua`: 0 fails, 59 s at load 24 to 16.
- No test removed, skipped, moved, or loosened (R33), so no UI coverage was lost and none was
  collected: no product file's executed lines changed except `ComposerImages.tsx`'s new key check,
  run by the two cases above. Deferred to ready: the whole browser projects, the production build,
  and the other web suites.

## Task 6: Align testing guidance, templates, and examples with the proven architecture

**Files:** Modify testing sections of
`skills/uraeda/references/{code-quality,plan,implementation,change}.md`, related artifact templates,
the recurring-tasks example's plan/rulings, and README's validation instructions. Update
`skills/uraeda/SKILL.md` only where entry-point wording contradicts the approved loop.

**Interfaces:** Guidance uses the approved main-scenario/high-edge/criterion coverage rule, focused
owning assertions, selected boundary checks, explicit deferral, and complete ready before push.
Existing project constitutions remain authoritative, including a stricter installed template; no
constitution file is amended here.

- [ ] **Step 1: Rewrite the testing rules together.** Remove automatic whole-app/browser tests for
      every UI scenario and mandatory fault injection for every low-risk assertion. Keep selective
      proof for security/git/writes, explicit conflict reporting, and exact contract assertions.
- [ ] **Step 2: Update plan/test-map and final-review wording in templates and example.** Cover
      important guarantees without requiring a separate new test for every sentence.
      Removed/skipped/loosened tests and timeout changes are independently visible with their
      rulings; human intent takes precedence.
- [ ] **Step 3: Check references and examples against the same rules.** Run `ura check specs`,
      `ura check skills/uraeda/assets/example/specs`, formatting/lint/types, and fast's skill/native
      routing. Self-review confirms no remaining requirement to run full ready after each task
      contradicts the active decision.
- [ ] **Step 4: Commit.** `docs(fix-testing): align behavioral testing and validation loops`.

## Task 7: Reconcile current main and deliver complete evidence

**Risky:** Final cache inputs, incoming changes, or a misleading record can conceal regressions.

**Files:** Update `rulings.md`, this plan, the final record, and only necessary combination/rebase
fixes. CI/task configuration changes must preserve all required checks and uncached hosted
validation.

**Interfaces:** All task contracts above remain present. Keep complete ready separate from fast.

- [ ] **Step 1: Refresh and integrate main.** Re-read changed decisions/constitution; preserve
      concurrent product behavior and tests. Reconcile baseline file inventory and individual
      decision-rule map against the actual updated base.
- [ ] **Step 2: Audit every old test disposition and changed assertion.** Retained tests stay named;
      moved/replaced cases identify their owning assertions and faults. Record exact
      timeout/skip/expectation changes, coverage exclusions/denominators, file/function growth, and
      any unresolved evidence.
- [ ] **Step 3: Run complete local validation and the representative edit matrix.** Run uncached
      ready, required editor smoke where available, and comparable coverage investigations. Measure
      Composer, leaf, shared helper, core, skill, fixture, declaration, config, deletion, and docs
      with complete-command timing and explicit selected/deferred checks. Missing evidence remains
      incomplete; do not silently relax SC-001 through SC-007.
- [ ] **Step 4: Complete independent branch review and fix important findings.** Recheck all
      high-risk guarantees, input owners, fixture independence, cancellation, and current-main
      behavior. Each behavioral fix starts with the intended failing check; review the combined
      branch again as necessary.
- [ ] **Step 5: Push after green ready and gather hosted evidence.** Prepare the concrete PR/record
      through the finish step, then publish within the invoked workflow. Obtain five green runs of
      the same reviewed commit without retrying tests; at least three consecutive runs meet the
      five-minute budget. Respect current main updates and report any budget conflict before
      claiming completion.
- [ ] **Step 6: Deliver the pull request at the workflow's review gate.** Its description includes
      test changes, rulings, verified criteria, relevant timing/coverage evidence, and remaining
      limitations.
