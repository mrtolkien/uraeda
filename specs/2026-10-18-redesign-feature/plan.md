---
status: auto-approved
spec-revision: 2
---

# Plan: Redesign feature and change pages

**Goal:** one page for every feature and change: its stages with their times, "Next" beside the
agent, what it produced, and, once done, its figures and record in place; one recommended message in
the session's composer; problems that are only what stops the workflow.

**Architecture:** the core owns everything read from git and the workflow files, the server owns
tokens and messages, and the page draws both without deciding anything. See the
[spec's architecture](spec.md#architecture).

- **The problems' kind** is one list in
  [`workspace/problem.rs`](/crates/core/src/workspace/problem.rs), `BLOCKING`, read through
  `Problem::blocks`. `FeatureView` splits a feature's results into `problems`, the blocking ones,
  and `notes`, the rest: every reader of `problems`, Home and the sidebar included, gets the new
  meaning without a change of its own.
- **A feature's history** is a new core module, `crates/core/src/history/`, reached by one API call,
  `read_history`, and one binding function, `readHistory`. It owns the stage list of features and
  changes, the step-to-stage mapping, each stage's start, the merge time, the lines changed, the
  total time, the counts of questions, and the decisions a done feature changed. Its git reads go
  through the `git` module: a commit walk with times and subjects, and the `numstat` diff that
  [`changes.rs`](/crates/core/src/changes.rs) runs today, moved there and shared.
- **Tokens** are captured by the Claude adapter as a neutral `tokens` event, the agent session's
  running total, and turned into each turn's own counts by the runner, against a baseline the
  process keeps. The counts are stored on the turn, in four columns. The server sums them per
  feature.
- **The recommended message** is one function of the server, `recommendedMessage`, beside every
  message's text in [`runner/message.ts`](/packages/server/src/runner/message.ts). The composer
  reads it through a fate view; the runner calls it again at send time, and sends as a chat a
  message that no longer applies.
- **The page** is a folder of components, `packages/web/src/feature/`, started from the mockups,
  drawing a feature or a change from `FeatureView`, the history, the session, and the record's
  document. Times are formatted in one module, in the browser's time zone.
- **The comments pass** is a section of the implementation reference, which the change reference and
  `SKILL.md` point to.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A slug that starts another slug**: commits of `redesign` never count for `redesign-feature`,
   nor the other way: the scope matches whole. Task 3.
2. **Stages never go back in time**: a `fix(<slug>)` commit made while the spec was revised does not
   start Build before Plan; each stage starts at its first matching commit at or after the previous
   stage's start. A `chore(<slug>)` commit never starts Build. Task 3.
3. **A branch that merged the default branch into itself**: its lines changed leave out what the
   merge brought in, as the merge base's three-dot diff does today; a feature merged with a merge
   commit counts the same way. Task 6.
4. **The first turn after a resumed process** counts only its own tokens, not the agent session's
   earlier ones; a fresh agent session starts from zero; a steered turn that ends with two results
   adds both. Task 4.
5. **A turn killed before its result** has no counts; the next turn of the same agent session
   absorbs its work, so the feature's total stays the agent's own total. Task 4.
6. **A merged feature's session** recommends no message, though its record's pull request reads
   `open`: a feature without a branch has nothing to continue. Task 5.
7. **Inserting the message over typed text** puts the message first and keeps what was typed after
   it, as the hand-over does today. Task 7.
8. **A hand-over the server refuses**, "Commit and start the agent" read after the step moved on,
   leaves the composer sending as a chat, never disabled. Task 7.
9. **A done feature without `pull-request` in its record**: "Lines changed" is a plain card, not a
   link. Task 9.
10. **Times across midnight**: a stage started the day after the previous one shows its date, and
    one started the same day shows its time only, in the browser's time zone. Task 8.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these.

From the [spec](spec.md), word for word:

- "Stages start at the first commit of their step's type, so a revision does not move them."
- "Lines changed leave out the feature's folder and its record, like the branch's changes today."
- "The comments the agent reads: every unresolved review thread, and every review or comment posted
  after the branch's last push. Resolved and outdated threads are left out."
- "The comments message runs from the implementation reference, with the trigger `comments`, and
  ends when the pull request is ready for review again."
- "'Review and start the agent' leaves the feature page: the recommended message replaces it."
- "No agent working time": the done page shows no waiting or working time.
- Tokens: "'in' counts every token the model read for the first time, tool results included … Re-
  reads from the cache … are left out." The tile shows "5.2 M in" and "113 k out" on two lines.
- C1: "Each stage shows its start time and duration, '12:11 · 2 h 50 min', and a date only when the
  day changes." C3: "Every stage's line fits on one line on a desktop." C4: "The page colours
  '+1,204' green and '−310' red." C6: "Each file is a compact row: its step's icon, its name in
  words, and its status beside it. Every done status is green, a file waiting on you is amber,
  changes requested red. No monospace." C7: "a sleep icon and 'Idle' when it waits, an accent dot
  and its task only while it works. 'Next' carries the heading and the primary button." C8: "On a
  desktop, 'Next' and the agent's card share one row, 'Next' twice as wide. On the phone, 'Next'
  comes first." C10: "one 'Insert the recommended message' button, naming the message." C11: "an
  open pull request's 'Next' only opens it on GitHub."
- Exact texts: "This feature cannot go on"; "No recommended message: the feature waits on you";
  "Sent as a chat: the feature now waits on you."; "Address the pull request's comments"; "Pull
  request state unknown"; "Not recorded"; "Not found on the default branch"; "Open the session";
  "Your review on pull request #31"; "Open pull request #31"; "You review the spec"; "Review the
  spec"; "Idle".

From the [data model](data-model.md): the turn's new columns `input_tokens`, `cache_write_tokens`,
`cache_read_tokens`, and `output_tokens`, "integer or null"; "A null count means the agent reported
none for this turn"; "The page counts 'in' as `input_tokens` plus `cache_write_tokens`, and leaves
`cache_read_tokens` out. All four are kept"; `trigger` gains `comments`.

From the decisions:

- [Problems](../decisions/problems.md): "A check result MUST count as a feature's problem only when
  its rule stops the workflow; every other result MUST be a note." "Whether a rule stops the
  workflow MUST be decided once, in the core, and sent with each result." "Home and the sidebar's
  cards MUST show problems only, and notes MUST show only on their feature's or change's page."
  "`ura check` and editors MUST keep reporting every result at its own severity."
- [UI behaviour](../decisions/ui-behaviour.md): "Status MUST show next to what it concerns, and
  errors MUST stay there until dealt with." "Back MUST restore the scroll position and open items."
  "Every action MUST have a tap and a keyboard path."
- [UI layout](../decisions/ui-layout.md): "The UI MUST have two width classes, split at the theme's
  `md` breakpoint, 768 px, which components read from the shared hook or theme, never their own
  media queries." "Reading text MUST stay left-aligned, never justified, and no wider than about 120
  characters." "Body text MUST be 17 px on narrow screens and 19 px from 1024 px wide, and controls
  at least 44 px tall under a coarse pointer."
- [Agents](../decisions/agents.md): "Every agent MUST be reached through one adapter, in
  `packages/server/src/runner/`, that keeps its formats inside and declares what it can do." "Every
  message MUST be stored and shown as the human's turn: a workflow run's carries its step,
  reference, and trigger." "Sessions MUST be cached in `runner.sqlite`, through `node:sqlite` … MUST
  NOT hold workflow state."
- [Git](../decisions/git.md): "Rust tools MUST read git with gix, built with only the features they
  need, and run the system `git` for writes and reads gix lacks." "In Rust, every git access MUST go
  through one core module, which parses only `git`'s machine-readable output."
- [Stack](../decisions/stack.md): "Workflow logic, parsing, validation, and states MUST live in the
  Rust core, and TypeScript MUST reach them only through the binding." "The web UI MUST draw
  workflow files from the core's document tree, never parsing their markdown."
- [Code quality](../decisions/code-quality.md): "functions MUST NOT be longer than 100 lines, take
  more than 7 parameters, or nest blocks more than 4 levels deep." "source files MUST NOT be longer
  than 500 lines, except tests and generated files." "A new marker MUST NOT be added unless a human
  approves it as a constitution exception in the plan." "Unit tests MUST NOT sleep for a fixed time
  or assert how long something took, except benchmarks of a spec's success criteria."
- [UI components](../decisions/ui-components.md): "Views MUST use an Astryx component wherever one
  fits the job." "Styles MUST be written with StyleX, in the file of the component that uses them,
  from the theme's tokens."
- [UI checks](../decisions/ui-checks.md): "UI tests MUST drive the UI as a user does, by roles,
  labels, and visible text, and MUST NOT assert markup, class names, snapshots, or pixel
  comparisons." "Before handing over a UI change, the agent MUST screenshot every changed view at
  both sizes and in both themes … and commit them under the folder's `screenshots/`."
- [Preview](../decisions/preview.md): "Mockups and named states of views MUST be stories in a
  `<Component>.stories.tsx` file next to the component." "stories MUST NOT fake the server's
  responses."
- [Compatibility](../decisions/compatibility.md): no workflow file changes format in this feature.

Existing guarantees to keep:

- `ura check` prints every error and warning and exits 1 on errors
  ([`crates/cli/src/check.rs`](/crates/cli/src/check.rs)); the problems' kind changes only what
  `FeatureView` sends.
- A step `none` comes only from the workspace's own problems
  ([`steps.rs`](/crates/core/src/steps.rs) 191).
- The hand-overs, "Commit and start the agent", "Approve and start the agent", "Request changes and
  start the agent", and "Start the feature and the agent", fill the composer with their step's
  message ([`HandOver.tsx`](/packages/web/src/HandOver.tsx)).
- The session column's "Changed on the branch" keeps its numbers
  ([`SessionAside.tsx`](/packages/web/src/SessionAside.tsx) `Changes`,
  [`changes.rs`](/crates/core/src/changes.rs)).
- A merged feature's left worktree or branch still says to run `ura clean`.
- `vp run ready` runs `ura check specs` and on the skill's example: both pass after every task.

## Code read

- [`view/feature.rs`](/crates/core/src/view/feature.rs) (185): `FeatureView::new(feature, extra)`
  chains the workspace's problems and the check's; `recorded_pull_request` reads a record's
  `pull-request` as `open`. [`view.rs`](/crates/core/src/view.rs): `ProblemView`.
- [`api.rs`](/crates/core/src/api.rs) (470): `checked` keeps the check's errors only, without the
  rules reading history; `read_workspace`, `read_feature`, `find`, `open`.
- [`workspace.rs`](/crates/core/src/workspace.rs) (731, listed in
  [`structure.rs`](/crates/cli/tests/structure.rs)'s `LARGE` at 742: may only shrink): `Feature`,
  `Kind`, `FileKind`, `from_record` (emits `frontmatter.kind`, `.parse`), `from_texts` (emits
  `frontmatter.status`, `.parse`). No task touches it.
  [`workspace/problem.rs`](/crates/core/src/workspace/problem.rs): `Problem`, `Severity`.
  [`workspace/paths.rs`](/crates/core/src/workspace/paths.rs): `folder_path`, `record_path`,
  `folder_slug`.
- [`steps.rs`](/crates/core/src/steps.rs): `StepName` and `as_str`, `Step::none` set when the
  feature has problems, `finished_step` (Draft gives Finish, Open gives PullRequest), `change_step`.
- [`check/`](/crates/core/src/check/): errors through `File::problem`, warnings through
  `File::warning`; `answers.blank` in [`answers.rs`](/crates/core/src/check/answers.rs) 62, only for
  an `answered` round; `file.utf8` in `mod.rs` 286.
- [`git.rs`](/crates/core/src/git.rs) (475): `tip`, `default_branch`, `merge_base`, `read_file`,
  `output` (the system `git`). [`git/log.rs`](/crates/core/src/git/log.rs) (132): `is_ancestor`,
  `behind` (the only gix `rev_walk`), `first_parent_changes`, `approval_commit`. No commit times are
  read anywhere.
- [`changes.rs`](/crates/core/src/changes.rs) (153): `branch_changes`, `numstat`
  (`git diff --numstat -z -M --no-ext-diff base...tip`), `parse` with its unit test; the exclusion
  of the feature's own files.
- [`decisions/change.rs`](/crates/core/src/decisions/change.rs): `compare(name, before, after)`
  returns `DecisionChange`. [`api/decision.rs`](/crates/core/src/api/decision.rs): `read_decision`.
- [`pulls.rs`](/crates/core/src/pulls.rs): `PullRequestView { number, url, state }`, states `draft`,
  `open`, `changes-requested`, from `gh pr list --state open`.
- Records: no parser; the
  [template](/skills/uraeda/assets/templates/specs/done/YYYY-MM-DD-feature-slug.md) has
  `## Questions` with `### Round NN` and `#### Q1: …`; frontmatter `kind`, `finished`,
  `pull-request`.
- Core tests: `crates/core/tests/*.rs` with `common::repo::TestRepo` (`write`, `commit`,
  `switch_new`, `git`) and `common::texts` (`proposal`, `spec`, `plan`, `record`). Benchmarks are
  `#[ignore = "benchmark"]` tests named `bench_*`, run by `vp run bench`.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs) (495): one `job(...)` export per API
  function; `packages/binding/index.d.ts` generated by `vp run binding:build`, committed.
  [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts) (454): `fixtureRepo`, `git`,
  `commitOnBranch`, `addChange`, `addPlan`, `ELEVEN`.
- [`runner/claude-events.ts`](/packages/server/src/runner/claude-events.ts): `resultEvent` drops
  `usage` and `modelUsage`. [`runner/events.ts`](/packages/server/src/runner/events.ts): the
  `AgentEvent` union, `Trigger`. [`runner/transcript.ts`](/packages/server/src/runner/transcript.ts)
  `#result` ends the turn.
- [`runner/cache.ts`](/packages/server/src/runner/cache.ts) (633, marked
  `oxlint-disable max-lines -- … the migrations in a module of their own`): `migrations` by index
  against `PRAGMA user_version`, `TurnRow`, `addTurn`, `endTurn`, `turns`, `items`, `itemsOf`.
- [`runner/processes.ts`](/packages/server/src/runner/processes.ts) `open`: `resume` when the agent
  still has the session; `line` is `FRESH` or `REPLACED` when a new agent session starts after
  earlier runs, appended as a `system` item of the turn.
- [`runner/message.ts`](/packages/server/src/runner/message.ts): `runMessage`, `goal` per step, no
  trigger; pinned in [`message.test.ts`](/packages/server/src/runner/__tests__/message.test.ts).
  [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts) (494) `#send`: refuses a workflow
  message when the step does not wait on the agent (`REFUSALS.human`).
  [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts): `TRIGGERS`, `readWorkflowMessage`,
  `featureRecord`. [`fate/views.ts`](/packages/server/src/fate/views.ts) (465): `FeatureRecord`,
  `featureDataView`, the `Root` lists. [`fate/sources.ts`](/packages/server/src/fate/sources.ts):
  `branchChanges` as the model of a source by folder.
- Runner tests: [`runner/__tests__/helpers.ts`](/packages/server/src/runner/__tests__/helpers.ts)
  `testSessions` with `FakeAdapter` ([`runner/fake.ts`](/packages/server/src/runner/fake.ts):
  `script`, `emit`) and `SessionCache.open(":memory:")`; cache tests with `tempPath()` and
  `PRAGMA table_info(turns)`; Claude parsing tests over `fixtures/claude/*.jsonl`.
- Web: [`FeaturePage.tsx`](/packages/web/src/FeaturePage.tsx) (235) and
  [`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx) (183), replaced;
  [`App.tsx`](/packages/web/src/App.tsx) `ItemPage` sends a change to its session;
  [`Composer.tsx`](/packages/web/src/Composer.tsx) (383): `workflow` makes a send a workflow run,
  `refused` disables it; [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) (439)
  `FeatureSession`; [`labels.ts`](/packages/web/src/labels.ts) `waiting`, `gateAction`;
  [`home/features.ts`](/packages/web/src/home/features.ts) and
  [`HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx): `problems` decide "Needs you" and "Fix";
  [`sidebar/StepIcon.tsx`](/packages/web/src/sidebar/StepIcon.tsx);
  [`spec/DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx);
  [`Blocks.tsx`](/packages/web/src/Blocks.tsx) draws a document's blocks by `ids`;
  [`data.ts`](/packages/web/src/data.ts) and [`views.ts`](/packages/web/src/views.ts): one hook and
  one selection per view.
- The mockups: [`mockups/`](/packages/web/src/mockups/) (`FeaturePage.stories.tsx`,
  `FeaturePageMockup.tsx`, `FeatureParts.tsx`, `featureMockupData.ts`, `ComposerMessages.tsx`), all
  `TEMPORARY`.
- Web tests: happy-dom, `renderPage(path, repo)` of
  [`helpers.tsx`](/packages/web/src/__tests__/helpers.tsx), over the real server and binding, a fake
  agent; WebKit tests in `src/__browser__/` with `atSize`, `checkLayout`, `checkAccessibility`.
  Strings of the removed panel in tests: `agent-panel.test.tsx`, `feature.test.tsx`,
  `session.test.tsx` 319-324, `commit-actions.test.tsx` 144-186, `__browser__/layout.test.tsx` 86
  and 328, `__browser__/session.test.tsx` 62 and 462.
- Outside behaviour, checked while planning on 2026-10-18: `claude -p … --output-format stream-json`
  ends with a `result` whose `modelUsage` maps each model to `inputTokens`, `outputTokens`,
  `cacheReadInputTokens`, and `cacheCreationInputTokens`; with `--resume`, the totals carry on from
  the earlier run (2 then 4 input tokens). `gh api graphql` accepts
  `reviewThreads { isResolved isOutdated }` on this repository; no pull request here has a thread.
- Validation, inside `nix develop -c`: `cargo nextest run -p uraeda-core <filter>`,
  `vp run binding:build`, `vp check`, `vp test --run <file>`, `vp run browser:phone`,
  `vp run browser:desktop`, `vp run bench`, `vp run storybook:build`, and `vp run ready`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| :------------------: | :------------: | :--------: | :---------------: | :---------------: | :--------------: |
|          ✅          |       ✅       |     ✅     |        ✅         |        ✅         |        ✅        |

## Complexity tracking

| Abstraction or exception                                      | Why it is needed                                                                                            | Simpler alternative rejected because                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `crates/core/src/history/`, with `stages.rs` and `figures.rs` | the stages, the figures, and a done feature's decisions are one view of git, owned once (spec architecture) | inside `api.rs` (470) or `view/feature.rs`: both would pass 500, and the workspace read slows down |
| `git/history.rs`: a commit walk with times, and `numstat`     | the history and `changes.rs` share the diff; the walk is the only reader of commit times                    | `numstat` copied into the history: two diffs with two exclusion rules                              |
| `files/record.rs`, a record's counts                          | the questions figure and the Questions stage of a done feature read the same headings                       | counting headings in the web: the stack forbids parsing markdown there                             |
| `runner/migrations.ts` and `runner/cache-rows.ts`             | the structural step of `cache.ts`, over the limit, before its migration grows                               | another marker: the decision forbids new ones                                                      |
| `recommendedMessage` and its fate view                        | the composer and the runner's send both need the one message that applies now                               | the composer choosing: the server owns each message and when it applies                            |
| `packages/web/src/feature/`, one component per part           | the page has six parts, built by three tasks                                                                | one `FeaturePage.tsx`: past 500 lines, and three tasks in one file                                 |
| `feature/times.ts`                                            | the stages, the figures, and the agent card format times and durations one way                              | each part formatting its own                                                                       |
| `commitsAt` in `packages/binding/test-utils.ts`               | the web tests, the browser tests, and Storybook need features with typed, dated commits                     | each building its own                                                                              |

No new marker. No constitution exception.

## Test map

The core's tests build repositories with `TestRepo`, commits dated through `GIT_AUTHOR_DATE` and
`GIT_COMMITTER_DATE`. The runner's tests run `testSessions` over the fake adapter and an in-memory
cache. The web's tests render the whole app with `renderPage` over a fixture repository, the real
server and binding, and the fake agent, in happy-dom, with `TZ=UTC`; the browser tests run WebKit at
402 × 874 and 1440 × 900.

| Spec                                                                  | Task | Test                                                                                     |
| --------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| US6 1, more 1; the problems' kind                                     | 2    | `crates/core/tests/problems.rs`; `packages/web/src/__tests__/home.test.tsx`              |
| US6 2 (Home)                                                          | 2    | `packages/web/src/__tests__/home.test.tsx`                                               |
| SC-001                                                                | 2    | `crates/core/tests/this_repository.rs`, ignored, run in the task                         |
| US1 3, more 1, more 2 (starts); review focus 1, 2                     | 3    | `crates/core/tests/history.rs`                                                           |
| Edge cases: two rounds; record without typed commits; squash merge    | 3    | `crates/core/tests/history.rs`                                                           |
| US3 2 (stages of a change without a round)                            | 3    | `crates/core/tests/history.rs`                                                           |
| SC-004                                                                | 3    | `crates/core/tests/this_repository.rs`, ignored, run in the task                         |
| Tokens per turn; review focus 4, 5; the migration                     | 4    | `packages/server/src/runner/__tests__/tokens.test.ts`, `cache.test.ts`, `claude.test.ts` |
| US4 1, 2, more 1; US5 1 (message), more 1; edge: no agent, unknown PR | 5    | `packages/server/src/runner/__tests__/recommended.test.ts`, `sessions.test.ts`           |
| Review focus 6                                                        | 5    | `packages/server/src/runner/__tests__/recommended.test.ts`                               |
| US2 1 (total), 2 (counts), 3 (decisions); review focus 3              | 6    | `crates/core/tests/history.rs`                                                           |
| SC-002                                                                | 6    | `crates/core/tests/history.rs`, `bench_history_of_80_commits`                            |
| US4 1, 2, more 1, more 2 (composer); review focus 7, 8                | 7    | `packages/web/src/__tests__/recommended.test.tsx`                                        |
| US1 1, 2, 3, more 1, 2, 3; US3 1; US5 1 (page); US6 2 (page); SC-003  | 8    | `packages/web/src/__tests__/feature-page.test.tsx`                                       |
| Edge cases: invalid status, no agent, unknown PR, left worktree       | 8    | `packages/web/src/__tests__/feature-page.test.tsx`                                       |
| Review focus 10                                                       | 8    | `packages/web/src/__tests__/times.test.ts`                                               |
| US1 more 4; US2 1, 2, 3, more 1, 2, 3; US3 2 (page)                   | 9    | `packages/web/src/__tests__/feature-done.test.tsx`                                       |
| Edge cases: squash merge, partial tokens; review focus 9              | 9    | `packages/web/src/__tests__/feature-done.test.tsx`                                       |
| US5 2, 3; edge: a reviewer bot's comment                              | 1    | the skill's reference, read by review: no code runs it                                   |
| C3, C8; both widths; accessibility in both themes                     | 10   | `packages/web/src/__browser__/feature.test.tsx`                                          |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1, 2, 3, 4, and 5: the skill; the problems' kind; the history's stages; tokens in the
   runner; the recommended message on the server. Shared files, each adding its own part:
   `crates/core/src/api.rs` (task 2 in `checked`, task 3 a `mod` line and a `pub use`),
   `packages/binding/index.d.ts` (tasks 2 and 3: regenerate after the merge),
   `packages/server/src/fate/views.ts` and `fate/sources.ts` (task 2 the feature's `notes`, task 3
   the history's view and source, task 5 the recommended message's), `packages/web/src/views.ts`
   (task 2 `notes`, task 3 `HistoryView`), `packages/server/src/runner/events.ts` (task 4 the
   `tokens` event, task 5 the `comments` trigger).
2. Tasks 6, 7, and 8: the figures in the core; the composer's recommended message; the page. Task 6
   only touches `crates/core/src/history/`, `git/`, `changes.rs`, and the binding; task 7
   `Composer.tsx`, `SessionPage.tsx`, and their tests; task 8 `packages/web/src/feature/`,
   `App.tsx`, `labels.ts`, `test-utils.ts`, and the tests of the removed panel. Shared:
   `packages/web/src/__tests__/session.test.tsx` (task 7 its composer tests, task 8 lines 319-324),
   `packages/binding/index.d.ts` (task 6 only).
3. Task 9: the figures and the record on the page, on tasks 4, 6, and 8.
4. Task 10: the real stories, the browser checks, and the screenshots, on everything.

---

## Task 1: The agent addresses a pull request's comments

**Files:**

- Modify: `skills/uraeda/references/implementation.md` (`## Changes requested on the pull request`,
  the frontmatter's **Runs when** and **Ends at**)
- Modify: `skills/uraeda/references/change.md` (`## The pull request`, its last paragraphs)
- Modify: `skills/uraeda/SKILL.md` (`## Finding the next step`, step 3)
- Modify: `skills/uraeda/references/finish.md` (`## Changes asked on the pull request`, its link)

**Interfaces:**

- Consumes: nothing.
- Produces: the section `## Comments on the pull request` of `implementation.md`, at the anchor
  `#comments-on-the-pull-request`, which task 5's message names by its reference,
  `skills/uraeda/references/implementation.md`.

- [x] **Step 1: Rewrite the changes section as the comments pass**

Rename `## Changes requested on the pull request` to `## Comments on the pull request`, and update
every link to its old anchor (`rg -n 'changes-requested-on-the-pull-request' skills README.md`). The
section says, in the reference's own descriptive voice:

- **When it runs**: when the human's message asks to address the pull request's comments, whatever
  the step table says, and when the pull request has changes requested. The run's trigger is
  `comments`.
- **What to read**: every unresolved review thread, and every review or comment posted after the
  branch's last push; resolved and outdated threads are left out. Name the commands:
  `gh api graphql` on `pullRequest.reviewThreads` with `isResolved`, `isOutdated`, and each
  comment's `author`, `path`, `line`, `body`, and `createdAt`; `gh pr view --json reviews,comments`
  for reviews and comments, compared with the last push's date (`gh pr view --json commits` or the
  remote branch's last commit).
- **Whose comments**: a reviewer bot's comment is handled like a person's: the human chose when to
  send the agent.
- **What to do with each**: a change of behaviour with a test that fails first, one commit per
  change, with the feature's scope; the record updated as the existing paragraph says. A comment
  that asks for a choice the spec does not settle starts a new round of questions instead of a
  guess, as [finish](/skills/uraeda/references/finish.md#changes-asked-on-the-pull-request)
  describes. A comment that needs nothing says why in the last message.
- **Never on GitHub**: the agent does not reply to a comment or resolve a thread; its last message
  lists each comment with what it did, one line each, and the commits say the rest.
- **Ends**: when the pull request is ready for review again: pushed, and ready, not a draft.

Keep the existing paragraph on a pull request opened before the finish step.

- [x] **Step 2: Point the change reference and `SKILL.md` to it**

In `change.md`, "Changes requested on the pull request are handled as for a feature" becomes
"Comments on the pull request are handled as for a feature", linking the new anchor; its list of
what differs stays. In `SKILL.md`, step 3 of "Finding the next step" adds one sentence: a message
asking to address the pull request's comments runs
[Implementation](/skills/uraeda/references/implementation.md)'s comments pass, whatever the table
says. In `finish.md`, the link to the old anchor follows.

- [x] **Step 3: Run the project's validation**

- Run: `nix develop -c vp check`, `nix develop -c vp run specs:check`, and
  `rg -n 'changes-requested-on-the-pull-request' skills README.md specs packages`
- Expected: PASS, and no match outside this plan's own text of this task

- [x] **Step 4: Commit**

```bash
git add skills/uraeda
git commit -m "docs(redesign-feature): the agent addresses a pull request's comments when sent"
```

## Task 2: Problems are only what stops the workflow

**Risky:** a rule several callers share: every reader of a feature's `problems` changes meaning.

**Files:**

- Modify: `crates/core/src/workspace/problem.rs` (`BLOCKING`, `Problem::blocks`)
- Modify: `crates/core/src/view/feature.rs` (`FeatureView`: `problems`, new `notes`)
- Modify: `crates/core/src/api.rs` (`checked`'s doc comment only, if its wording changes)
- Modify: `packages/binding/index.d.ts` (generated)
- Modify: `packages/server/src/fate/views.ts` (`featureDataView`: `notes`),
  `packages/server/src/fate/sources.ts` (`missingFeature`: `notes: []`), `packages/web/src/views.ts`
  (`FeatureView`: `notes: true`, as `problems`)
- Modify: `packages/web/src/FeaturePage.tsx` (`ProblemList` lists the problems, then the notes,
  until task 8 replaces the page, R7)
- Test: `crates/core/tests/problems.rs`, `crates/core/tests/this_repository.rs`,
  `packages/web/src/__tests__/home.test.tsx`; `crates/core/tests/api.rs`'s
  `a_features_problems_leave_its_warnings_out` reads the problems and the notes (R8)

**Interfaces:**

- Consumes: nothing.
- Produces: `pub const BLOCKING: &[&str]` and `Problem::blocks(&self) -> bool`;
  `FeatureView.problems` holds only blocking results, and `FeatureView.notes: Vec<ProblemView>` the
  others, both in the order they are found today. In JavaScript,
  `FeatureView.notes: Array<ProblemView>`, selected by the web's `FeatureView`.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/problems.rs
#[test]
fn a_missing_section_is_a_note_not_a_problem() {
    // TestRepo: a feature at implementation whose plan has no "## Waves", checked out.
    let view = api::read_feature(repo.path(), FOLDER).unwrap();
    assert!(view.problems.is_empty());
    assert_eq!(rules(&view.notes), ["sections.missing"]);
}

#[test]
fn an_invalid_status_is_a_problem() {
    // spec.md with `status: aproved`
    assert_eq!(rules(&view.problems), ["frontmatter.status"]);
    assert_eq!(view.step.name, "none");
}

#[test]
fn a_blank_answer_in_an_answered_round_is_a_problem() { /* answers.blank in problems */ }

#[test]
fn the_check_still_reports_a_note_as_an_error() {
    let found = check::check_files(&root, &folder).unwrap();
    assert!(found.iter().any(|p| p.rule == "sections.missing" && p.severity == Severity::Error));
}
```

```tsx
// packages/web/src/__tests__/home.test.tsx
/** US6.1 */
test("a feature with a format note stays under Agents at work", async () => {
  // A feature at implementation whose plan misses "## Waves", checked out.
  await renderPage("/", repo);

  const agents = await screen.findByRole("region", { name: /Agents at work/ });
  expect(within(agents).getByText(TITLE)).toBeTruthy();
  expect(screen.queryByText("Fix")).toBeNull();
});

/** US6.2 */
test("a spec whose status cannot be read needs a fix", async () => {
  // spec.md with `status: aproved`
  const needsYou = await screen.findByRole("region", { name: /Needs you/ });
  expect(within(needsYou).getByText("Fix")).toBeTruthy();
});
```

Match the region names to `HomeHub.tsx`'s panels. The break each test catches:

- A missing section: the old filter, every error a problem, kept.
- An invalid status: a blocking rule missing from `BLOCKING`.
- A blank answer: `answers.blank`, emitted by the check rather than the workspace, left out.
- The check: a change that lowers the check's severity instead of the view's reading.
- Home: Home still reading notes as problems.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core -E 'binary(problems)'`
- Expected: FAIL, `view.notes` does not exist (a compile error)

- [x] **Step 3: Implement the problems' kind**

`BLOCKING` lists the rules that stop the workflow: `frontmatter.status`, `frontmatter.parse`,
`frontmatter.kind`, and `file.utf8`, which make the step `none`, and `answers.blank`, which leaves
an answered round incomplete. Its doc comment quotes the [Problems](../decisions/problems.md)
decision and says a new rule is a note unless the workflow cannot go on without a fix.
`FeatureView::new` partitions the workspace's problems and `extra` with `Problem::blocks`. Add
`notes` to `featureDataView` and the web's `FeatureView` selection, and list them after the problems
in `FeaturePage.tsx`'s `ProblemList`, so notes stay on the page until task 8 folds them (R7). Then
`nix develop -c vp run binding:build`.

- [x] **Step 4: Measure SC-001 on this repository's history**

`crates/core/tests/this_repository.rs`, `#[ignore = "this repository's history"]`,
`sc001_drift_is_never_a_problem`: for every commit of `main` from 2026-10-17T16:48 to
2026-10-18T10:00 that touched a feature folder
(`git log --format=%H --since … --until … main -- 'specs/20*'`: the pathspec `'specs/20*/'` matches
no commit), export the commit's `specs/` into a temporary folder, run `check::check_files` on each
touched folder still there, and assert that every blocking result's rule is a `frontmatter.*` rule:
drift and unfinished files never block. Print the counts of snapshots, of snapshots with errors, and
of snapshots with a blocking result, for the pull request.

- Run: `nix develop -c cargo nextest run -p uraeda-core --run-ignored only sc001`
- Expected: PASS, 37 snapshots, 36 with errors, 0 blocking. Discovery's 72 counted other branches'
  commits too; `main` holds 39 commits in the window, two of which removed their folder (R7).

- [x] **Step 5: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS. `feature.test.tsx`'s "shows the problems ura check finds" still passes: its
  removed `**Answer:**` line is `answers.marker`, a note, which the page still lists (R7).

- [x] **Step 6: Commit**

```bash
git add crates/core packages/binding/index.d.ts packages/server/src/fate/views.ts packages/web/src
git commit -m "feat(redesign-feature): problems are only what stops the workflow, the rest notes"
```

## Task 3: A feature's stages, read from git

**Files:**

- Create: `crates/core/src/git/history.rs` (`Git::history`), `crates/core/src/history.rs`,
  `crates/core/src/history/stages.rs`, `crates/core/src/files/record.rs`,
  `crates/core/src/api/history.rs`
- Modify: `crates/core/src/git.rs` (`mod history;`), `crates/core/src/lib.rs`,
  `crates/core/src/files/mod.rs`, `crates/core/src/api.rs` (`mod history; pub use`),
  `crates/core/src/today.rs` (`Date::unix_seconds`)
- Create: `crates/binding/src/history.rs` (`read_history`, R9); modify `crates/binding/src/lib.rs`
  (`pub mod history;`), `packages/binding/index.d.ts` and `index.js` (generated)
- Create: `packages/server/src/fate/views-history.ts`
- Modify: `packages/server/src/fate/sources.ts`, `packages/server/src/fate/views.ts` (`Root`:
  `histories`, `Record_` exported), `packages/server/src/fate.ts` (`History`),
  `packages/server/src/live.ts` (a feature's change updates its `History`),
  `packages/web/src/views.ts` (`HistoryView`), `packages/web/src/data.ts` (`useHistory`)
- Test: `crates/core/tests/history.rs`, `crates/core/tests/this_repository.rs`,
  `packages/server/src/__tests__/fate.test.ts` (one test); unit tests of `scope_type`,
  `record::counts`, and `Date::unix_seconds`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `pub struct CommitInfo { pub id: ObjectId, pub parents: Vec<ObjectId>, pub subject: String, pub authored: i64, pub committed: i64 }`,
    times in Unix seconds.
  - `Git::history(&self, tip: ObjectId, since: i64) -> Result<Vec<CommitInfo>, GitError>`: the
    commits reachable from `tip`, newest committed first, down to the first committed before
    `since`, through gix's `rev_walk` with a commit-time cutoff.
  - `history::scope_type(subject: &str, slug: &str) -> Option<&str>`: the type of a subject
    `<type>(<slug>): …` or `<type>(<slug>)!: …`, the scope matched whole.
  - `pub enum Stage { Proposal, Questions, Spec, Plan, Build, Fix, PullRequest, Merged }`, `as_str`:
    `proposal`, `questions`, `spec`, `plan`, `build`, `fix`, `pull-request`, `merged`.
  - `files::record::counts(text: &str) -> RecordCounts { questions: u32, rounds: u32 }`: the
    `#### Q` and `### Round` headings under `## Questions`.
  - `pub fn read_history(repo: &Path, folder: &str) -> Result<HistoryView, ApiError>`, and the view:

```rust
pub struct HistoryView {
    /// The feature's or the change's folder.
    pub folder: String,
    pub stages: Vec<StageView>,
    /// The index of the current stage; `stages.len()` once merged.
    pub current: u32,
    /// Rounds of questions, when it had any.
    pub rounds: Option<u32>,
    /// Whether a done item's commits were found on the default branch: false after a squash merge.
    pub found: bool,
    /// For a done item not found: its record's `finished` day, `YYYY-MM-DD`.
    pub finished: Option<String>,
    /// Filled by task 6.
    pub total_seconds: Option<u32>,
    pub lines: Option<LinesView>,
    pub questions: Option<u32>,
    pub decisions: Vec<DecisionChange>,
}
pub struct StageView { pub name: String, /** RFC 3339, UTC */ pub started: Option<String> }
pub struct LinesView { pub added: u32, pub removed: u32, pub files: u32 }
```

- Binding `readHistory(repo: string, folder: string): Promise<HistoryView>`; fate root list
  `histories`, by folder, `HistoryRecord = Record_<HistoryView> & { id: string }`; web
  `useHistory(folder)`, selecting every field.

- [x] **Step 1: Write the failing tests, and the helpers they use**

A helper in `crates/core/tests/common/repo.rs`,
`TestRepo::commit_at(&self, message: &str, at: &str)`, commits with `GIT_AUTHOR_DATE` and
`GIT_COMMITTER_DATE` set to `at`, an RFC 3339 time, and
`TestRepo::commit_at_merged(message, authored, committed)` for a rebased commit, both through
`TestRepo::git_at(args, authored, committed)`, which also dates a `git merge --no-ff`.

```rust
// crates/core/tests/history.rs
#[test]
fn each_stage_starts_at_its_first_commit_of_its_type() {
    // On 2026-10-17-clarifications: chore 10:52, discovery 11:18, discovery "answer round 01"
    // 12:01, spec 12:11, spec "request changes" 14:14, spec 14:20, spec "approve" 15:01,
    // decision 15:01, plan 15:08, feat 15:09, the plan's task half checked (past its end, the
    // step depends on `gh`); checked out.
    let history = api::read_history(repo.path(), FOLDER).unwrap();
    assert_eq!(starts(&history), [
        ("proposal", Some("2026-10-17T10:52:00Z")),
        ("questions", Some("2026-10-17T11:18:00Z")),
        ("spec", Some("2026-10-17T12:11:00Z")),
        ("plan", Some("2026-10-17T15:01:00Z")),
        ("build", Some("2026-10-17T15:09:00Z")),
        ("pull-request", None),
        ("merged", None),
    ]);
    assert_eq!(history.current, 4);
}

#[test]
fn a_build_started_the_next_day() { /* plan 2026-10-17T15:08, feat 2026-10-18T09:10:
    build starts at "2026-10-18T09:10:00Z" (US1 more 2) */ }

#[test]
fn two_rounds_start_questions_at_the_first() { /* rounds == Some(2), questions at round 01 */ }

#[test]
fn another_slug_never_counts() { /* commits scoped (clarifications-two) and (clarification) are
    ignored for "clarifications" (review focus 1) */ }

#[test]
fn stages_never_go_back_in_time() { /* fix(<slug>) at 13:00 during the spec, plan at 15:08, feat
    at 16:00: build starts 16:00; chore(<slug>) at 15:30, between the plan and the feat, starts
    nothing (review focus 2) */ }

#[test]
fn a_merged_feature_is_timed_to_its_merge() {
    // The branch rebased onto main: every commit's committer date 22:09, the finish commit
    // authored 22:03, the record on main.
    assert_eq!(start(&history, "pull-request"), Some("2026-10-17T22:03:00Z"));
    assert_eq!(start(&history, "merged"), Some("2026-10-17T22:09:00Z"));
    assert_eq!(history.current, 7);
    assert!(history.found);
}

#[test]
fn a_merge_commit_times_the_merge() { /* `git merge --no-ff` at 22:30: merged at 22:30 */ }

#[test]
fn a_squash_merged_feature_shows_its_merge_only() {
    // On main: chore(<slug>): start, then "Feature (#3)" with the record, finished 2026-10-17.
    assert_eq!(names(&history), ["merged"]);
    assert!(!history.found);
    assert_eq!(history.finished.as_deref(), Some("2026-10-17"));
}

#[test]
fn a_change_without_a_round_has_four_stages() {
    // US3 more 2: a merged change, chore, fix, finish, no discovery.
    assert_eq!(names(&history), ["proposal", "fix", "pull-request", "merged"]);
}

#[test]
fn a_change_with_a_round_has_questions() { /* change/2026-…, a discovery commit: five stages */ }
```

The break each test catches:

- First commit of its type: the last commit taken, so a revision moves the stage (spec assumption).
- The next day: author time read as committer time, or the day dropped.
- Two rounds: the second round restarting the stage, or the rounds counted from commits.
- Another slug: a prefix match on the scope.
- Back in time: a stage taken without the previous stage's bound, or a `chore` read as code.
- Merge: the merge read from author dates, which a rebase keeps, so "merged" equals "finished".
- Squash: stages built from the start commit alone.
- A change: a feature's stage list given to a change.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core history`
- Expected: FAIL, `api::read_history` does not exist (a compile error)

- [x] **Step 3: Implement the walk and the stages**

`Git::history` sets `since` to the folder's date minus one day, midnight UTC: no commit of a feature
is older than its folder.

The stage list: a feature's is `proposal`, `questions`, `spec`, `plan`, `build`, `pull-request`,
`merged`; a change's is `proposal`, `questions` only when it had a round (a clarifications file, a
`## Questions` section in its record, or a `discovery(<slug>)` commit), `fix`, `pull-request`,
`merged`.

The commits read: a live item's, from its branch's tip; a done item's, from the default branch's
tip. Only commits whose `scope_type` is `Some` count. Each stage starts at the first commit, by
author time, at or after the previous found stage's start, whose type is:

| Stage          | Types                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| `proposal`     | any                                                                       |
| `questions`    | `discovery`                                                               |
| `spec`         | `spec`                                                                    |
| `plan`         | `decision`, `plan` (a feature only)                                       |
| `build`, `fix` | `feat`, `fix`, `refactor`, `test`, `docs`, `perf`, `build`, `ci`, `style` |
| `pull-request` | `finish`                                                                  |

A live item's stages after its current one have no start: a `fix(<slug>)` commit made while the spec
waits does not start Build (R12).

`merged`, for a done item: the default branch's first-parent commit through which its
`finish(<slug>)` commit arrived, at its committer time, so a later scoped commit made on the default
branch moves nothing (R13): the commit itself when it is on the first-parent line (a rebase or
fast-forward), otherwise the oldest first-parent merge commit it is an ancestor of (`is_ancestor`).
A done item with no `finish(<slug>)` commit on the default branch is not `found`: its stages are
`merged` alone, with no start, and `finished` is its record's.

`current`, from the feature's step: a human gate by its file's kind (`proposal` → `proposal`,
`clarifications` → `questions`, `spec` → `spec`, `plan` → `plan`); `discovery` → `questions`;
`spec`, `spec-revision` → `spec`; `approval`, `plan`, `plan-revision` → `plan`; `implementation`,
`final-review` → `build`; `change` → `fix`; `finish`, `pull-request`, `pull-request-changes`,
`pull-request-unknown` → `pull-request`; `done` → `stages.len()`; `none` → the last stage with a
start, or 0.

`rounds`: a live item's clarifications files; a done item's `RecordCounts.rounds`; `None` at 0.

Add the binding function, the fate view and source (`branchChanges` is the model), the web selection
and `useHistory`, then `nix develop -c vp run binding:build`. A fate test reads `histories` for the
fixture's `2026-10-11-web-ui` and gets its seven stages.

- [x] **Step 4: Measure SC-004 on this repository's history**

In `crates/core/tests/this_repository.rs`, `#[ignore = "this repository's history"]`,
`sc004_past_features_show_timed_stages`: `read_history` for every record of `specs/done/` on this
repository; count those with at least two stages started. Print the list without, for the pull
request.

- Run: `nix develop -c cargo nextest run -p uraeda-core --run-ignored only sc004`
- Expected: PASS, at least 25 records with timed stages

- [x] **Step 5: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git add crates packages/binding/index.d.ts packages/server/src/fate packages/web/src/views.ts packages/web/src/data.ts
git commit -m "feat(redesign-feature): a feature's stages, read from its typed commits"
```

## Task 4: Each turn's tokens, stored

**Risky:** the format of stored data and its migration, in `runner.sqlite`.

**Files:**

- Create: `packages/server/src/runner/migrations.ts`, `packages/server/src/runner/cache-rows.ts`
- Modify: `packages/server/src/runner/cache.ts`, `packages/server/src/runner/events.ts`
  (`TokenCounts`, the `tokens` event), `packages/server/src/runner/claude-events.ts`
  (`resultEvent`'s line), `packages/server/src/runner/processes.ts` (`open`, the process's
  baseline), `packages/server/src/runner/transcript.ts` (the `tokens` event)
- Create: `fixtures/claude/result-usage.jsonl`
- Test: `packages/server/src/runner/__tests__/tokens.test.ts`,
  `packages/server/src/runner/__tests__/cache.test.ts`,
  `packages/server/src/runner/__tests__/claude.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `export type TokenCounts = { cacheRead: number; cacheWrite: number; input: number; output: number }`
    and the event `{ type: "tokens"; total: TokenCounts }`: the agent session's running total, its
    sub-agents included.
  - `TurnRow.tokens: TokenCounts | null`.
  - `SessionCache.addTurnTokens(id: number, counts: TokenCounts): void`, adding to the turn's
    counts, a null count read as 0.
  - `SessionCache.agentSessionTokens(sessionId: string): TokenCounts`: the sum of the counts of the
    session's turns since its latest turn holding a `system` item `FRESH` or `REPLACED`, that turn
    included, or of all its turns without one; a null count read as 0.

- [x] **Step 1: Split `cache.ts` before it changes**

Move `Migration`, `sessionsOfTurns`, `migrations`, `migrate`, and `transaction` to
`runner/migrations.ts`, and `SessionRow`, `TurnRow`, `toSession`, and `toTurn` to
`runner/cache-rows.ts`; `cache.ts` imports them, and re-exports what other modules import from it
today, so no import changes. Remove the `oxlint-disable max-lines` marker.

- Run: `nix develop -c vp test --run packages/server/src/runner`, `nix develop -c vp check`, before
  and after
- Expected: PASS both times, `cache.ts` under 450 lines, and no unused directive

```bash
git add packages/server/src/runner
git commit -m "refactor(redesign-feature): the runner cache's migrations and rows in modules of their own"
```

- [x] **Step 2: Write the failing tests**

```ts
// packages/server/src/runner/__tests__/tokens.test.ts
const TOTAL = (input: number, cacheWrite: number, cacheRead: number, output: number) =>
  ({ type: "tokens", total: { cacheRead, cacheWrite, input, output } }) as const;

test("a turn stores its own tokens", async () => {
  const { adapter, cache, sessions } = testSessions();
  adapter.script([TOTAL(2, 7791, 11304, 4)]);
  const { turn } = await send(sessions, "First");
  await settled();

  expect(cache.turn(turn)?.tokens).toEqual({
    cacheRead: 11304,
    cacheWrite: 7791,
    input: 2,
    output: 4,
  });
});

test("the second turn of a process counts only its own work", async () => {
  // Turn 1 totals (2, 7791, 11304, 4); turn 2 totals (4, 13558, 24671, 8).
  expect(cache.turn(second)?.tokens).toEqual({
    cacheRead: 13367,
    cacheWrite: 5767,
    input: 2,
    output: 4,
  });
});

test("a resumed process starts from the agent session's recorded total", async () => {
  // Turn 1 in a process that closes; turn 2 in a new process resuming the agent session, whose
  // first total already holds turn 1's: only the difference is stored (review focus 4).
});

test("a fresh agent session starts from zero", async () => {
  /* fresh: true on turn 2 */
});

test("two results in one steered turn add up", async () => {
  /* review focus 4 */
});

test("a turn killed before its result has no counts, and the next one absorbs its work", async () => {
  // Turn 1 exits without a result: tokens null. Turn 2, resumed, total (10, …): stored whole,
  // so the session's sum equals the agent's total (review focus 5).
});
```

```ts
// packages/server/src/runner/__tests__/cache.test.ts
test("migration 5 adds the turns' token counts, null for older turns", () => {
  // A cache at version 4 with a turn, migrated: PRAGMA table_info(turns) lists input_tokens,
  // cache_write_tokens, cache_read_tokens, output_tokens; the old turn's tokens are null.
});
```

```ts
// packages/server/src/runner/__tests__/claude.test.ts, in the recorded lines' table
["result-usage.jsonl", [{ type: "tokens", total: { cacheRead: 11304, cacheWrite: 7791, input: 2, output: 4 } }, /* then the result */]],
```

`fixtures/claude/result-usage.jsonl` is the `result` line recorded while planning, with two models
in `modelUsage` whose counts add up to those above. The break each test catches:

- Own tokens: the event dropped, or the per-turn `usage` read instead of the running total.
- Second turn: the running total stored as the turn's.
- Resumed: the baseline reset to zero on every process, counting earlier turns again.
- Fresh: the previous agent session's total subtracted from a new one.
- Steered: a second result overwriting the first.
- Killed: the next turn's count clamped or dropped, losing the work.
- Migration: a column missing, or old turns given zeros, which would read as "0 in".
- Claude: one model's counts only, or cache writes read as cache reads.

- [x] **Step 3: Run them to check they fail**

- Run: `nix develop -c vp test --run packages/server/src/runner/__tests__/tokens.test.ts`
- Expected: FAIL, `expected undefined to deeply equal { cacheRead: 11304, … }`

- [x] **Step 4: Implement**

The Claude adapter, on a `result` line with a `modelUsage` object, emits the `tokens` event before
the `result` event: each count summed over the models, `input` from `inputTokens`, `cacheWrite` from
`cacheCreationInputTokens`, `cacheRead` from `cacheReadInputTokens`, `output` from `outputTokens`.
No `modelUsage`, no event.

Migration 5 adds `input_tokens`, `cache_write_tokens`, `cache_read_tokens`, and `output_tokens`,
`INTEGER`, null by default. `toTurn` reads them as `tokens`, null when all four are null.

`processes.open` keeps the process's baseline: zero when it starts a new agent session (`resume` is
false), otherwise `cache.agentSessionTokens(live.id)`. On a `tokens` event, the turn running in the
process gets `total − baseline`, field by field, never below zero, added with `addTurnTokens`, and
the baseline becomes `total`.

- [x] **Step 5: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/server/src/runner fixtures/claude/result-usage.jsonl
git commit -m "feat(redesign-feature): each turn stores its own tokens, sub-agents included"
```

## Task 5: One recommended message, chosen by the server

**Files:**

- Create: `packages/server/src/fate/recommended.ts` (the record, view, and reader)
- Modify: `packages/server/src/runner/message.ts` (`runMessage`'s `trigger`, the comments message,
  `recommendedMessage`, `sentAsChat`), `packages/server/src/runner/events.ts` (`Trigger`:
  `comments`), `packages/server/src/fate/sessions.ts` (`TRIGGERS`),
  `packages/server/src/runner/send-input.ts` (`workflow.step`, `sendPlace`),
  `packages/server/src/runner/sessions.ts` (`#send`), `packages/server/src/runner/session-state.ts`
  (`SENT_AS_CHAT`, `SENT_AS_CHAT_NO_PULL_REQUEST`), `packages/server/src/fate/views.ts` and
  `sources.ts` (`Root`: `recommendedMessages`), `packages/server/src/fate/mutations.ts` (the `step`
  of `session.send`'s workflow), `packages/server/src/fate.ts` (`RecommendedMessage`),
  `packages/server/src/live.ts` (its live update, beside the feature's)
- Test: `packages/server/src/runner/__tests__/recommended.test.ts`,
  `packages/server/src/runner/__tests__/message.test.ts`,
  `packages/server/src/runner/__tests__/sessions.test.ts`,
  `packages/server/src/__tests__/sessions.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `Trigger` gains `"comments"`.
  - `runMessage({ branch, feature, planReview?, reference, step, trigger? })`: with
    `trigger: "comments"`, or at the step `pull-request-changes`, its work is "Address the comments
    on its pull request" and its stop "the pull request is ready for review again"; otherwise
    unchanged.
  - `recommendedMessage(input: { agent: { available: boolean; name: string }; feature: FeatureView; next: NextView }): Recommended`,
    with
    `type Recommended = { name: string; step: string; text: string; trigger: Trigger } | { reason: string }`.
  - Fate: `recommendedMessages` by folder,
    `RecommendedRecord = { id: string; name: string | null; reason: string | null; step: string | null; text: string; trigger: Trigger | null }`,
    refreshed when the feature is.
  - `SendInput.workflow.step?: string`: the step its message was read at.

- [x] **Step 1: Write the failing tests**

```ts
// packages/server/src/runner/__tests__/recommended.test.ts
test("a step waiting on the agent recommends its own message", () => {
  // US4.1: next = plan, waits on the agent; branch 2026-10-11-web-ui.
  expect(recommendedMessage(input({ step: "plan" }))).toEqual({
    name: "Continue, write the plan",
    step: "plan",
    text: runMessage({
      branch,
      feature,
      reference: "skills/uraeda/references/plan.md",
      step: "plan",
    }),
    trigger: "manual",
  });
});

test("a step waiting on you recommends nothing", () => {
  // US4.2
  expect(recommendedMessage(input({ gate: "spec.md" }))).toEqual({
    reason: "No recommended message: the feature waits on you",
  });
});

test("an open pull request recommends its comments", () => {
  // US5.1: step pull-request, pullRequest { number: 31, state: "open" }.
  const message = recommendedMessage(input({ pullRequest: "open", step: "pull-request" }));
  expect(message).toMatchObject({
    name: "Address the pull request's comments",
    trigger: "comments",
  });
  expect("text" in message && message.text).toContain(
    ": Address the comments on its pull request, starting with skills/uraeda/references/implementation.md.",
  );
});

test("a draft pull request recommends its comments while the feature waits on you", () => {
  // US5 more 1: the folder came back, a round awaits the human, the pull request is a draft.
});

test("a change's comments start from the change reference", () => {
  /* change.md */
});

test("changes requested on the pull request recommend the comments message", () => {
  // step pull-request-changes: the same message, trigger comments.
});

test("a merged feature recommends nothing, though its record reads open", () => {
  // review focus 6: no branch.
  expect(recommendedMessage(merged)).toEqual({
    reason: "This feature has no branch left: it is merged.",
  });
});

test("an unknown pull request state recommends nothing", () => {
  /* no pullRequest, step
  pull-request-unknown: the reason "No recommended message: the feature waits on you" */
});

test("without the agent, nothing is recommended", () => {
  expect(recommendedMessage(input({ available: false, step: "plan" }))).toEqual({
    reason: "Claude Code is not available on this machine.",
  });
});
```

```ts
// packages/server/src/runner/__tests__/sessions.test.ts
/** US4 more 1 */
test("a message inserted for a step that moved on is sent as a chat", async () => {
  // Read at plan, sent with workflow { step: "plan", trigger: "manual" } once the plan waits on
  // the human: the turn is a chat, with no step or trigger, and holds the system item
  // "Sent as a chat: the feature now waits on you."
});

test("the comments message without a pull request is sent as a chat", async () => {
  // "Sent as a chat: no pull request is open."
});

test("a comments run carries its trigger", async () => {
  // PR open: the turn is a workflow run, trigger "comments", step "pull-request".
});
```

Update `message.test.ts`'s `pull-request-changes` row to the new stop, and replace the send-time
refusal tests of `packages/server/src/__tests__/sessions.test.ts` (285, 312) and
`runner/__tests__/sessions.test.ts` (398) with the chat. The break each test catches:

- Own message: the name built from the step's label rather than its message.
- Waits on you: the comments message offered without a pull request.
- Open pull request: the step's message preferred at a human gate, or the wrong reference.
- Draft: a draft left out of "open".
- Merged: the recorded pull request read as open.
- Moved on: today's refusal kept, nothing sent.
- Comments without a pull request: a workflow run started on nothing.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test --run packages/server/src/runner/__tests__/recommended.test.ts`
- Expected: FAIL, `recommendedMessage` is not exported

- [x] **Step 3: Implement**

`recommendedMessage`, in order: no branch → `REFUSALS.noBranch`; no agent → "`<name>` is not
available on this machine."; a step waiting on the agent, with a reference, other than `none`,
`done`, and `pull-request-unknown` (R10) → the step's message, named "Continue, " and its work with
a lower-case first letter, without the ", then implement it" a plan step adds, trigger `manual`,
except `pull-request-changes`, the comments message; a pull request `open`, `draft`, or
`changes-requested` in `feature.pullRequest` → the comments message, named "Address the pull
request's comments", trigger `comments`, reference `skills/uraeda/references/implementation.md` for
a feature and `skills/uraeda/references/change.md` for a change; otherwise "No recommended message:
the feature waits on you".

The source reads `nextStep`, `readFeature`, and the adapter's availability; a folder that is no
feature's has no record. In `#send`, through `sendPlace` in `send-input.ts` and `sentAsChat` in
`message.ts`, a workflow message applies when `recommendedMessage` gives a message of the same
trigger family: `comments` for `comments`, otherwise a step message whose `step` equals
`workflow.step` when given, the existing check of a step waiting on the agent kept for the
hand-overs. One that does not apply runs as a chat turn, with `SENT_AS_CHAT` ("Sent as a chat: the
feature now waits on you.") or, for `comments`, `SENT_AS_CHAT_NO_PULL_REQUEST` ("Sent as a chat: no
pull request is open.") appended as a `system` item after its message; the chat opening is not added
to it, and it is never steered into a running turn. `readWorkflowMessage` keeps its refusal text for
a hand-over read: task 7 turns it into a notice.

- [x] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS; `runner/sessions.ts` stays under 500 lines (move `#send`'s decision into
  `message.ts` or `session-state.ts` if it would not)

- [x] **Step 5: Commit**

```bash
git add packages/server/src
git commit -m "feat(redesign-feature): the server recommends one message, and sends a stale one as a chat"
```

## Task 6: A feature's figures and decisions, read from git

**Files:**

- Create: `crates/core/src/history/figures.rs`
- Modify: `crates/core/src/git/history.rs` (`numstat`, `Range`), `crates/core/src/changes.rs` (uses
  `Git::numstat`; `pub(crate) fn outside(feature: &Feature, path: &str) -> bool`),
  `crates/core/src/history.rs` (fills `total_seconds`, `lines`, `questions`, `decisions`),
  `packages/binding/index.d.ts` (regenerated, if doc comments changed)
- Test: `crates/core/tests/history.rs`, `crates/core/tests/branch_changes.rs` (unchanged, kept
  passing)

**Interfaces:**

- Consumes: task 3's `Git::history`, `CommitInfo`, `HistoryView`, `LinesView`, `RecordCounts`,
  `scope_type`; `decisions::compare`.
- Produces: `pub enum Range { TwoDot, ThreeDot }`;
  `Git::numstat(&self, base: ObjectId, tip: ObjectId, range: Range) -> Result<Vec<ChangedFile>, GitError>`,
  `changes.rs`'s `numstat` and `parse` moved; `HistoryView`'s `total_seconds`, `lines`, `questions`,
  and `decisions` filled.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/history.rs
#[test]
fn total_time_runs_from_the_proposal_to_the_finish() {
    // US2.1: chore 10:52, …, finish 22:03, rebased at 22:09.
    assert_eq!(history.total_seconds, Some(11 * 3600 + 11 * 60));
}

#[test]
fn a_live_feature_counts_its_branch_changes() {
    // 2 files outside the folder: +3 −1 and +2 −0; the folder's own files left out.
    assert_eq!(history.lines, Some(LinesView { added: 5, removed: 1, files: 2 }));
}

#[test]
fn a_merge_of_main_into_the_branch_is_not_counted() {
    // Review focus 3: main gains a 10-line file after the branch starts; the branch merges main.
    assert_eq!(history.lines.unwrap().added, 5);
}

#[test]
fn a_rebased_feature_counts_its_run_of_commits() {
    // Done, rebased onto main after another feature's commits: only its own run is counted, its
    // folder and record left out.
}

#[test]
fn a_feature_merged_with_a_merge_commit_counts_its_branch() { /* three-dot of the merge */ }

#[test]
fn a_done_feature_counts_its_questions() {
    // A record with "### Round 01", Q1 to Q10: questions Some(10), rounds Some(1).
}

#[test]
fn a_done_feature_lists_the_decisions_it_changed() {
    // US2.3: specs/decisions/diagrams.md added by the branch, git.md changed, ledger.md untouched.
    assert_eq!(kinds(&history.decisions), [("diagrams", "new"), ("git", "changed")]);
}

#[test]
fn a_squash_merged_feature_has_no_figures() { /* lines None, total None, decisions empty */ }

#[test]
#[ignore = "benchmark"]
fn bench_history_of_80_commits() {
    // SC-002: a merged feature of 80 commits among 400 others: read_history under 100 ms, the
    // median of 5 runs.
}
```

The break each test catches:

- Total: the merge used as the end, or the first typed commit as the start.
- Live: the folder counted, or a two-dot diff from the default branch's tip.
- Merge of main: a two-dot diff from the folder's first commit.
- Rebased: the start commit on main used as the base, pulling in other features.
- Merge commit: a two-dot diff between its parents. The first parent's diff, the break first named
  here, equals the three-dot one for every clean merge, so no test can see it (R11).
- Questions: rounds counted as questions.
- Decisions: decisions read from the record's text, or every decision compared.
- Squash: figures from the start commit alone.
- SC-002: a walk of the whole history, or one process per commit.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test history`: the filter `history`
  matches test names, not the test binary (R11)
- Expected: FAIL, `assertion left == right failed`, `left: None`, `right: Some(40260)`

- [x] **Step 3: Implement**

Move `numstat` and `parse` from `changes.rs` to `git/history.rs` as `Git::numstat`, `ThreeDot`
running `base...tip` as today and `TwoDot` `base tip`; `branch_changes` calls it, its tests
unchanged. `outside` holds `branch_changes`'s exclusion, now shared, plus the record's path.

- **Lines**: a live item: `numstat(default tip, branch tip, ThreeDot)`, as `branch_changes`. A done,
  found item: when its finish commit `L` is on the default branch's first-parent line, the run of
  consecutive first-parent commits whose `scope_type` is `Some`, ending at `L`, gives
  `numstat(parent of the run's oldest, L, TwoDot)` (R13); otherwise, for the merge commit `M` found
  by task 3, `numstat(M^1, M^2, ThreeDot)`. Files outside the folder and the record only; `files` is
  their count.
- **Total**: `pull-request`'s start minus `proposal`'s, when both are known.
- **Questions**: a done item's `RecordCounts.questions`; `None` for a live item.
- **Decisions**: a done, found item's files under `specs/decisions/` in the same diff, each compared
  with `decisions::compare(name, text at base, text at tip)`, `listed: true`, sorted by name.

- [ ] **Step 4: Run the project's validation, and the benchmark**

- Run: `nix develop -c vp run ready`,
  `nix develop -c cargo nextest run -p uraeda-core --run-ignored only -E 'test(/^bench_history/)'`,
  and the task 3 measurement again (`--run-ignored only sc004`)
- Expected: PASS, the benchmark under 100 ms
- Ran: the benchmark, median 73 ms in a debug build, and SC-004, 27 of 31 records; `vp run ready`
  was left to the merge of the wave, with `vp check`, `rust:test`, `rust:clippy`, `ts:test`, and
  `specs:check` run instead

- [x] **Step 5: Commit**

```bash
git add crates packages/binding/index.d.ts
git commit -m "feat(redesign-feature): a feature's lines, time, questions, and decisions, read from git"
```

## Task 7: The composer inserts the recommended message

**Files:**

- Create: `packages/web/src/RecommendedMessage.tsx`
- Modify: `packages/web/src/Composer.tsx` (`recommended` prop, `refused` dropped),
  `packages/web/src/SessionPage.tsx` (`FeatureSession`), `packages/web/src/data.ts`
  (`useRecommendedMessage`), `packages/web/src/views.ts` (`RecommendedView`),
  `packages/web/src/sessions.ts` (`workflow.step`)
- Test: `packages/web/src/__tests__/recommended.test.tsx`,
  `packages/web/src/__tests__/commit-actions.test.tsx` (144-186), `session.test.tsx`

**Interfaces:**

- Consumes: task 5's `recommendedMessages` and `SendInput.workflow.step`.
- Produces: the composer's "Insert: <name>" button; nothing other tasks call.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/recommended.test.tsx
/** US4.1 */
test("the composer inserts the step's message, unsent", async () => {
  // 2026-10-11-web-ui with an approved spec and no plan: the plan waits on the agent.
  const { sessions } = await renderPage("/f/2026-10-11-web-ui/session", repo);

  await click(await screen.findByRole("button", { name: "Insert: Continue, write the plan" }));

  expect(composer().textContent).toMatch(
    /^\/uraeda Continue the feature specs\/2026-10-11-web-ui\//,
  );
  expect(sessions.sent).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Start the agent" })).toBeTruthy();
});

/** US4.2 */
test("a feature waiting on you recommends nothing, and a typed message still sends", async () => {
  expect(await screen.findByText("No recommended message: the feature waits on you")).toBeTruthy();
  await type(composer(), "Why this order?");
  await click(screen.getByRole("button", { name: "Send" }));
  // sent as a chat
});

test("inserting keeps what was typed after the message", async () => {
  /* review focus 7 */
});

/** US4 more 1 */
test("a message sent after the step moved shows it went as a chat", async () => {
  // Insert at the plan, then the plan is committed awaiting-human, then Start: the session shows
  // "Sent as a chat: the feature now waits on you."
});

/** US4 more 2 */
test("Commit and start the agent still fills the step's message", async () => {
  /* kept */
});
```

In `commit-actions.test.tsx`, the tests of the refused hand-over (144, 160, 176) expect the notice
"The feature waits on you now: there is nothing to continue." and a composer that sends a typed
message as a chat (review focus 8). The break each test catches:

- Inserted unsent: a click that sends at once.
- Waits on you: the composer disabled, as the refused hand-over did.
- Typed text: the message replacing what was typed.
- Moved on: the system line not drawn in the session.
- Hand-over: the recommended message replacing the hand-over's.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test --run packages/web/src/__tests__/recommended.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "Insert: Continue, write the plan"`

- [ ] **Step 3: Implement**

Start from [`ComposerMessages.tsx`](/packages/web/src/mockups/ComposerMessages.tsx): beside Send,
the secondary button `Insert: <name>`, tooltip "Insert the recommended message", or the reason as
supporting text when nothing is recommended. Inserting puts the message's text before what was typed
and sets the composer's workflow to `{ step, trigger }`; Send then reads "Start the agent". Emptying
the composer drops the workflow. The button is hidden while a hand-over fills the composer, and on a
chat with no feature. A refused hand-over shows its notice and leaves the composer sending as a
chat.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src
git commit -m "feat(redesign-feature): the composer inserts the recommended message"
```

## Task 8: The feature page: stages, "Next", and the agent

**Files:**

- Start from: `packages/web/src/mockups/FeaturePage.stories.tsx#Working`, `#WaitingOnYou`,
  `#Blocked`, and their parts in `FeatureParts.tsx`
- Create: `packages/web/src/feature/FeaturePage.tsx`, `Stages.tsx`, `NextCard.tsx`, `AgentCard.tsx`,
  `FileList.tsx`, `Notes.tsx`, `Section.tsx`, `next.ts`, `times.ts`
- Delete: `packages/web/src/FeaturePage.tsx`, `packages/web/src/AgentPanel.tsx`
- Modify: `packages/web/src/App.tsx` (`ItemPage`: every item opens `FeaturePage`),
  `packages/web/src/labels.ts` (the agent's "Next" per step), `packages/web/vite.config.ts`
  (`test.env.TZ = "UTC"` for the unit project)
- Modify: `packages/binding/test-utils.ts` (`commitsAt`)
- Test: `packages/web/src/__tests__/feature-page.test.tsx`,
  `packages/web/src/__tests__/times.test.ts`; remove or move the tests of the removed page:
  `feature.test.tsx`, `agent-panel.test.tsx`, `session.test.tsx` 319-324,
  `__browser__/layout.test.tsx` 86 and 328, `__browser__/session.test.tsx` 62 and 462

**Interfaces:**

- Consumes: task 2's `FeatureView.notes`; task 3's `useHistory`, `HistoryView`.
- Produces:
  - `commitsAt(repo: string, branch: string, commits: Array<{ at: string; committed?: string; files: Record<string, string | null>; message: string }>)`:
    commits on a branch, in its worktree or a temporary one as `commitOnBranch` does, each dated.
  - `feature/times.ts`: `clock(iso: string, previous?: string): string` ("12:11", or "Oct 18, 09:10"
    when its local day differs from `previous`'s), `duration(seconds: number): string` ("< 1 min",
    "26 min", "2 h 50 min", "1 d 3 h"), `day(isoOrDate: string): string` ("Oct 17").
  - `feature/Section.tsx`: `Section({ children, id?, title })`, which task 9 uses.
  - `FeaturePage` renders, in order, the header, `Stages`, the blocking banner, `NextCard` beside
    `AgentCard`, "What it produced so far" with `FileList` and the links, the record's place (task
    9), and `Notes`.

- [ ] **Step 1: Write the failing tests, and the helpers they use**

```tsx
// packages/web/src/__tests__/feature-page.test.tsx
/** US1.1 */
test("a feature being built says the agent is building, with no button", async () => {
  // addPlan(ELEVEN) on 2026-10-11-web-ui, plan approved: task 7 of 11.
  await renderPage("/f/2026-10-11-web-ui");

  const next = await screen.findByRole("region", { name: "Next" });
  expect(within(next).getByRole("heading", { name: "The agent is building" })).toBeTruthy();
  expect(within(next).getByText("Task 7 of 11: Session column")).toBeTruthy();
  expect(within(next).queryByRole("button")).toBeNull();
  expect(currentStage()).toBe("Build");
});

/** US1.2 */
test("a spec waiting for you says so, with its one button", async () => {
  const next = await screen.findByRole("region", { name: "Next" });
  expect(within(next).getByRole("heading", { name: "You review the spec" })).toBeTruthy();
  expect(within(next).getByRole("link", { name: "Review the spec" }).getAttribute("href")).toBe(
    atRepo("/f/<folder>/spec.md"),
  );
});

/** US1.3 */
test("a passed stage shows its time and duration", async () => {
  // commitsAt: spec 2026-10-17T12:11Z, approve 15:01, decision 15:01.
  expect(stageLine("Spec")).toBe("12:11 · 2 h 50 min");
});

/** US1 more 1 */
test("two rounds of questions read as such", async () => {
  /* "2 rounds" in the Questions stage */
});

/** US1 more 2 */
test("a build started the next day shows its date", async () => {
  expect(stageLine("Build")).toContain("Oct 18, 09:10");
});

/** US1 more 3 */
test("an idle agent reads Idle", async () => {
  const agent = await screen.findByRole("region", { name: "Agent" });
  expect(within(agent).getByText("Idle")).toBeTruthy();
});

/** US3.1 */
test("a change opens its page, with Fix marked and the session one click away", async () => {
  // addChange: the change being fixed.
  await renderPage("/f/2026-10-16-change");
  expect(currentStage()).toBe("Fix");
  expect(screen.getAllByRole("link", { name: "Open the session" })).toHaveLength(1);
});

/** US5.1, the page */
test("an open pull request's Next only opens it", async () => {
  // gh faked as the existing pull request tests do (pulls.test.ts): #31 open.
  expect(
    within(next).getByRole("heading", { name: "Your review on pull request #31" }),
  ).toBeTruthy();
  expect(within(next).getAllByRole("link")).toHaveLength(1);
  expect(
    within(next).getByRole("link", { name: "Open pull request #31" }).getAttribute("href"),
  ).toBe(URL);
});

/** US6.2, the page; edge case: invalid status */
test("a spec whose status cannot be read stops the page", async () => {
  expect(await screen.findByText("This feature cannot go on")).toBeTruthy();
  expect(screen.getByText("spec.md:2")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open spec.md" })).toBeTruthy();
});

/** US6.1, the page */
test("format notes are folded at the bottom", async () => {
  expect(await screen.findByRole("button", { name: "1 format note" })).toBeTruthy();
});

/** SC-003 */
test.each(["/f/2026-10-11-web-ui", "/f/2026-10-06-recurring-tasks", "/f/<change>", "/f/<done>"])(
  "%s has exactly one Open the session",
  async (path) => {
    /* getAllByRole("link", { name: "Open the session" }) has length 1 */
  },
);

test("without the agent, its card says so", async () => {
  // fakeAgent({ installed: false }): "Claude Code is not available on this machine."
});

test("an unknown pull request state says so", async () => {
  /* step pull-request-unknown:
  "Pull request state unknown" */
});

test("a merged feature still says to run ura clean", async () => {
  /* feature.test's US2.6 kept */
});

test("the files are compact rows with their status", async () => {
  // C6: "Questions, round 01" with "answered", "Spec" with "awaiting-human"; "not yet" rows kept.
});
```

```ts
// packages/web/src/__tests__/times.test.ts
test("a time shows its date only when the day changes", () => {
  expect(clock("2026-10-17T15:08:00Z", "2026-10-17T12:11:00Z")).toBe("15:08");
  expect(clock("2026-10-18T09:10:00Z", "2026-10-17T15:08:00Z")).toBe("Oct 18, 09:10");
});
test("durations", () => {
  expect(duration(26 * 60)).toBe("26 min");
  expect(duration(2 * 3600 + 50 * 60)).toBe("2 h 50 min");
  expect(duration(27 * 3600)).toBe("1 d 3 h");
  expect(duration(20)).toBe("< 1 min");
});
```

Move each kept test of `feature.test.tsx` and `agent-panel.test.tsx` into `feature-page.test.tsx`
with the page's new words; delete the ones that guard the removed gate banner and "Review and start
the agent". The break each test catches:

- Building: a button added to the agent's "Next", or the progress dropped.
- Waiting: the old gate banner's "Review" verb, or a button to the feature page.
- Time and duration: the date repeated, or the duration taken to the approval's next commit.
- Two rounds: the rounds dropped from the stage.
- Next day: the day compared in UTC rather than the browser's zone, or not compared at all.
- Idle: the agent's card louder than "Next".
- Change: a change still opening its session.
- Pull request: the comments button kept beside the link (C11).
- Blocked: notes shown as the blocking banner, or the banner without its file.
- Notes: notes unfolded, or counted as problems.
- SC-003: a second session button, as "Review and start the agent" was.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test --run packages/web/src/__tests__/feature-page.test.tsx`
- Expected: FAIL, `Unable to find role="region" and name "Next"`

- [ ] **Step 3: Implement the page**

Start from the mockup's components, each moved to its file under `feature/` and fed by the real
data. The header: "Features ›", the title, and "Feature · Oct 17 · branch <branch>" (or "Change …",
the day from the folder's date). `Stages`: Astryx `Stepper`, horizontal on a wide screen and
vertical on the phone, the labels Proposal, Questions, Spec, Plan, Build or Fix, Pull request,
Merged; a passed stage's line is `clock(start, previous start) · duration(next start − start)`, the
current one's `since <clock>`, never a duration, Questions with "2 rounds" when it had several.
`next.ts` turns the feature's step into `{ title, line, action? }`:

| Step                      | Title                                    | Line                                                                                    | Action                           |
| ------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| a gate on a round         | You answer the questions                 | the file's waiting line                                                                 | Answer the questions → the file  |
| a gate on the spec, plan  | You review the spec, You review the plan | the file's waiting line                                                                 | Review the spec, Review the plan |
| a gate on the proposal    | You write the proposal                   | —                                                                                       | Write the proposal → its editor  |
| `implementation`          | The agent is building                    | Task N of M: <title>                                                                    | —                                |
| another step of the agent | The agent's step, from `labels.ts`       | "The agent takes it from here: open the session to start it." when no turn runs, else — | —                                |
| `pull-request`            | Your review on pull request #N           | Review it on GitHub. The session's recommended message sends the agent to its comments. | Open pull request #N → its URL   |
| `pull-request-unknown`    | Pull request state unknown               | —                                                                                       | —                                |
| `done`                    | Merged                                   | On <day>, in pull request #N.                                                           | —                                |
| `none`                    | Nothing can go on                        | Fix the file above: the workflow cannot tell what comes next.                           | —                                |

`NextCard` is a region named "Next" with that heading and its one primary button; `AgentCard` is a
region named "Agent", neutral: a moon icon and "Idle", or the working mark, "Working", the task's
progress bar, and the sub-agents at work; the last run, "Last run: <step> · <state> · <time>", from
the session's latest turn; Stop while it works, as the panel had; "Open the session"; "Claude Code
is not available on this machine." when it is not. On a wide screen they share a row, "Next" two
columns of three; on the phone "Next" comes first. A blocking problem opens the banner "This feature
cannot go on", each problem's file and line and message, and a button "Open <file>" to the first.
`FileList` follows the mockup's compact rows, the record's row and "not yet" rows kept; beside it,
the links: Storybook, the pull request, and the mockups. `Notes` folds "N format notes" with "They
block nothing: the next agent step rewrites what drifted." The left worktree banner stays.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web packages/binding/test-utils.ts
git commit -m "feat(redesign-feature): one page for features and changes: stages, next, and the agent"
```

## Task 9: What a feature produced, and a done one's record in place

**Files:**

- Start from: `packages/web/src/mockups/FeaturePage.stories.tsx#Done`, `#DoneChange`
- Create: `packages/web/src/feature/Figures.tsx`, `packages/web/src/feature/Record.tsx`,
  `packages/server/src/fate/tokens.ts`
- Modify: `packages/web/src/feature/FeaturePage.tsx`, `packages/server/src/fate/sessions.ts`
  (`featureRecord`: `tokens`), `packages/server/src/fate/views.ts` (`FeatureRecord.tokens`),
  `packages/web/src/views.ts` (`FeatureView.tokens`)
- Test: `packages/web/src/__tests__/feature-done.test.tsx`,
  `packages/server/src/__tests__/fate.test.ts`

**Interfaces:**

- Consumes: task 4's `TurnRow.tokens`; task 6's `HistoryView` figures; task 8's `FeaturePage`,
  `Section`, `times.ts`, `commitsAt`.
- Produces:
  `FeatureRecord.tokens: { input: number; output: number; partial: boolean; since: string } | null`:
  `input` is `input + cacheWrite` over the feature session's turns, `output` their output, `since`
  the first counted turn's start, `partial` whether an ended turn before it has no counts; null when
  no turn has counts.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/feature-done.test.tsx
/** US1 more 4 */
test("lines changed read in green and red, with the files", async () => {
  // A branch adding 1,204 lines and removing 310 over 23 files outside its folder.
  const lines = await screen.findByRole("link", { name: /^Lines changed/ });
  expect(within(lines).getByText("+1,204")).toBeTruthy();
  expect(within(lines).getByText("−310")).toBeTruthy();
  expect(within(lines).getByText("23 files")).toBeTruthy();
});

/** US2.1 */
test("a done feature's total time and timed stages", async () => {
  // commitsAt on a branch merged by rebase: 10:52 … finish 22:03, committed 22:09.
  expect(figure("Total time")).toContain("11 h 11 min");
  expect(stageLine("Merged")).toBe("22:09");
});

/** US2.2 */
test("tokens leave cache reads out, on two lines", async () => {
  // The feature's session with turns of 2,712 input, 5,174,704 cache writes, 146,726,052 cache
  // reads, and 113,407 output, seeded through the session cache.
  expect(figureLines("Tokens")).toEqual(["5.2 M in", "113 k out"]);
});

/** US2.3 */
test("Decisions leads to the decisions, drawn as changes", async () => {
  // The branch adds specs/decisions/diagrams.md.
  await click(await screen.findByRole("link", { name: /^Decisions/ }));
  expect(location.hash).toBe("#decisions");
  expect(within(region("Decisions")).getByText("new")).toBeTruthy();
});

/** US2 more 1 */
test("the record shows in place, its questions folded", async () => {
  expect(await screen.findByRole("heading", { name: "What and why" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Behaviour" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Follow-ups" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Questions · 10 in 1 round" }).getAttribute("aria-expanded"),
  ).toBe("false");
});

/** US2 more 2 */
test("a feature without token counts reads Not recorded", async () => {});

/** US3.2 */
test("a merged change without a question shows its four stages and its record", async () => {});

/** Edge case: squash merge */
test("a squash-merged feature says its figures were not found", async () => {
  expect(await screen.findByText("Not found on the default branch")).toBeTruthy();
});

/** Edge case: partial tokens */
test("tokens counted from a later turn say since when", async () => {
  /* "since Oct 19" */
});

/** Review focus 9 */
test("a record without its pull request draws Lines changed as a plain card", async () => {});
```

The break each test catches:

- Lines: no colours, or the folder's files counted.
- Total time: the merge time used as the end.
- Tokens: cache reads counted, or "5174704" unformatted, or both counts on one line.
- Decisions: the record's bullet list drawn instead of the changes, or no anchor.
- Record: the questions unfolded, or the record's file linked instead of drawn.
- Not recorded: "0 in" shown for unrecorded turns.
- Change: a feature's stage list on a change.
- Squash: zero shown as a count.
- Plain card: a link to `undefined/files`.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test --run packages/web/src/__tests__/feature-done.test.tsx`
- Expected: FAIL, `Unable to find role="link" and name /^Lines changed/`

- [ ] **Step 3: Implement**

`Figures` follows the mockup's grid: live, "Lines changed" (`+N` in the success colour, `−N` in the
error colour, U+2212, "N files", leading to the files below) and "Tokens"; done, "Total time"
(caption "10:52 to 22:03", leading to `#stages`), "Lines changed" (leading to `<pull request>/files`
when the record has one), "Tokens", "Questions" (the count, "1 round", leading to `#questions`), and
"Decisions" (the count, "new or changed", leading to `#decisions`). Tokens format with
`Intl.NumberFormat`'s compact notation rules of the spec: "5.2 M", "113 k", "2.7 k", under 1,000 as
is; caption "cache reads left out", or "since Oct 19" when `partial`; "Not recorded" when null. A
done item not found reads "Not found on the default branch" in place of its figures.

`Record` draws the record's document, read with `useFile(folder, "<folder>.md")`, with `Blocks` by
its `##` sections' block ids, found by the headings' anchors: `what-and-why`, `behaviour`, then the
decisions as `DecisionCard`s from `history.decisions`, in a section `#decisions`, then `questions`
folded under "Questions · N in R round(s)", then `follow-ups`, then "Open the record file". The
page's section title reads "What it produced" once done.

The server's `tokens` sums the session's turns in `fate/tokens.ts`, from `cache.turns`.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web packages/server/src/fate
git commit -m "feat(redesign-feature): what a feature produced, and a done one's record in place"
```

## Task 10: The page in its stories, checked at both sizes

**Files:**

- Create: `packages/web/src/feature/FeaturePage.stories.tsx`,
  `packages/web/src/Composer.stories.tsx` (the recommended message's states),
  `packages/web/src/__browser__/feature.test.tsx`, `specs/2026-10-18-redesign-feature/screenshots/`
- Modify: `packages/web/.storybook/fixture.ts` and `checkouts.ts` (features with typed, dated
  commits, through `commitsAt`), `packages/web/scripts/` (a screenshot script for the feature page,
  from the spec page's)
- Delete: `packages/web/src/mockups/`

**Interfaces:**

- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/src/__browser__/feature.test.tsx
test("every stage's line fits on one line on a desktop", async () => {
  // C3, desktop only: a done feature's seven stages each draw their line in one line box.
});

test("Next comes first on the phone, beside the agent on a desktop", async () => {
  // C8: on the phone, Next's region is above the Agent's; on a desktop, on the same row.
});

test("the feature page is accessible in both themes, every fold open", async () => {
  // atSize("both"), colorScheme light then dark: checkLayout and checkAccessibility, notes and
  // questions unfolded.
});
```

The break each test catches: a stage line that wraps (C3), the cards stacked on a desktop or the
agent first on the phone (C8), a colour under the contrast floor, a control under 44 px on the
phone, cut text.

- [ ] **Step 2: Run it**

- Run: `nix develop -c vp run browser:desktop`, `nix develop -c vp run browser:phone`
- Expected: FAIL on the first layout or rule reported, or PASS: either way, fix what it reports.

- [ ] **Step 3: Replace the mockups by the real page**

The stories render the real page over the Storybook fixture, one export per state: `Working`,
`WaitingOnYou`, `Blocked`, `Done`, `DoneChange`, and `PullRequest` when the fixture server can show
an open pull request without faking a response (otherwise a ruling says why it is left out); the
composer's `Recommended`, `Filled`, and `Nothing`. Delete `mockups/`. Screenshot the feature page in
each state, and the session's composer, at both sizes and in both themes; review them against the
mockups and the spec's review comments (C1 to C11), fix what differs, and commit them under this
feature's `screenshots/`.

- [ ] **Step 4: Run the project's validation**

- Run: `nix develop -c vp run ready`, `nix develop -c vp run storybook:build`,
  `nix develop -c vp run bench`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-18-redesign-feature/screenshots
git commit -m "feat(redesign-feature): the feature page in its stories, checked at both sizes"
```
