---
status: auto-approved
spec-revision: 1
---

# Plan: Dedicated session view

**Goal:** a feature's session becomes a page of its own at every width, with a foldable column of
the feature's progress and changed files, and the sidebar shows each feature by its slug, with its
current task.

**Architecture:** see the [spec's architecture](spec.md#architecture) and
[details](spec.md#details). Ownership and boundaries:

- **The core owns every rule.** It computes the plan's progress, from the same parse the plan's
  review uses, and the branch's changes, by running git. The UI only draws what the binding sends
  ([stack](../decisions/stack.md)).
- **The core's watcher owns freshness.** A feature is published when its step, its files, or now its
  branch's tip change. The server turns that into live updates of `Feature`, `Workspace`, and the
  new `BranchChanges`.
- **The web UI owns the layout.** It decides the session's page, the column and its folded state,
  the phone's progress line, following the end, and the announcements. The folded state lives in
  `localStorage`, and the phone's open line in the history entry. Neither is workflow state.
- **Order.** Tasks 1–3 change the core and the binding, Task 4 the server, and Tasks 5–10 the web UI
  on top of them. Task 11 runs the layout checks and takes the screenshots.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **One shape for absent fields.** napi-rs leaves a `None` field's key out of the object, while
   fate's client keeps a record's field an answer leaves out
   ([`fate/views.ts`](/packages/server/src/fate/views.ts), `sentFile`). fate merges records
   shallowly and replaces a nested object like `step` whole, so `step.progress` would not go stale:
   it is sent as `null`, in the features and the workspace's features alike, so the UI reads one
   type, `TaskProgress | null`. `BranchChanges.changes` and a binary file's lines are sent as `null`
   too. Task 4.
2. **A branch only on `origin`, or with a slash in its name** (`fix/2026-10-13-x`): the diff must
   use the ref `Git::tip` resolves, and its name must be passed as one argument. Task 2.
3. **A feature whose branch disappears**, merged and deleted: the watcher's hash must not fail, and
   the feature is published once. Task 3.
4. **Two selected rows in the sidebar** on the session's page: the feature's row and its progress
   row both match today's prefix rule. Task 5.
5. **An announcer that speaks on arrival.** Opening a session that is already working must not
   announce "The agent started": only changes after the page is drawn are announced, as
   `useReplyStatus` does today. Task 10.
6. **Leaving the pane's scroll state behind.** `useOpenAtEnd` skips when the history entry has
   `pane`, which only `Panes` writes. A session opened from a task view's entry must still open at
   its end. Task 6.

## Global constraints

- **Exact texts, from the [spec](spec.md):**
  - the column's label and sections: "Progress", "Sub-agents", "Changed on the branch", "Feature",
    and "Feature page";
  - its button: "Hide progress", then "Show progress";
  - its progress: "Task 7 of 11", "11 of 11 tasks done", and "No plan yet.";
  - its changes: "2 files · +42 −19", "Nothing outside the feature's folder yet.", "and N more
    files", "binary", and "The changes could not be read.";
  - the sidebar's progress row "7/11 · Session column", read as "Task 7 of 11: Session column";
  - a feature's row: its slug, read as "<slug>, <title>, <status>";
  - the phone's line "Implementation · 7/11 · Session column";
  - "Jump to the latest";
  - the announcements "The agent started: Implementation", "The agent finished", "The agent failed:
    <reason>", and "Task 8 of 11: <title>".

  The minus sign in "−19" is U+2212.

- **Exact values, from the [spec](spec.md):**
  - at most 50 files are listed, sorted by path, and the feature's own `specs/<folder>/` is left
    out;
  - the column is 320 px wide, as the theme size `--size-session-aside`;
  - `localStorage` holds `uraeda.sessionAside`, `"shown"` or `"hidden"`;
  - following uses the 24 px measure, `AT_END`, of
    [`Transcript.tsx`](/packages/web/src/Transcript.tsx);
  - live changes show within 2 seconds.
- **The spec's scenarios name this feature's own folder.** Tests use the fixture repository's
  `2026-10-12-cli-tuis`, slug `cli-tuis`, titled "CLI TUIs", with the spec's counts and titles in
  its plan: 11 tasks, the first 6 done, the 7th "Session column".
- **[UI layout](../decisions/ui-layout.md)**, the rules this plan meets:
  - "Readability and clarity for the human MUST come first."
  - "On narrow screens, a view MUST open as its own page."
  - "A view the human stays in or follows, like an agent's session, SHOULD be a page of its own, and
    MAY have a column beside its main content for what the human needs to keep in view. A column
    that takes room from the content MUST be foldable, with the choice kept in the browser."
  - "The sidebar SHOULD stay short and visual: a feature by its slug, its progress and status as
    icons and counts. Each row's accessible name MUST carry the full words: the feature's title, its
    status, and its task."
  - "Components MUST NOT write their own media queries with sizes. They read the width class from
    one shared hook, or the theme's adaptations."
  - "Reading text MUST NOT be wider than about 120 characters."
- **[UI components](../decisions/ui-components.md)**:
  - "Views MUST use an Astryx component wherever one exists for the job."
  - "Components MUST NOT take a `style` prop, and Astryx components MUST NOT take a `className`."
  - "The app's own styles MUST be written with `stylex.create`, in the file of the component that
    uses them, and MUST use Astryx's tokens for colours, spacing, sizes, radii, borders, and type."
  - "Sizes MUST come from the theme. A size the theme lacks is added to the theme, not written in a
    component."
- **[UI behaviour](../decisions/ui-behaviour.md)**:
  - "A row that leads somewhere MUST be tappable as a whole."
  - "Back MUST return to the same scroll position and the same open items."
  - "Nothing MUST work only on hover."
  - "Errors MUST stay on screen until the human deals with them, or the action is retried."
- **[UI checks](../decisions/ui-checks.md)**:
  - "UI tests MUST drive the UI as a user does, through roles, labels, and visible text, and assert
    what the user sees or what is written to the repository."
  - "A test that no longer matches the spec MUST be changed or removed with the spec, never kept
    passing by loosening its assertion."
- **[Stack](../decisions/stack.md)**:
  - "TypeScript code MUST reach the core only through the binding, and MUST NOT reimplement its
    parsing, validation, or states."
  - "The TypeScript types of core data MUST come from the declarations napi-rs generates for the
    binding."
- **[Agents](../decisions/agents.md)**: "The tests that `vp run ready` runs MUST use a fake adapter,
  and MUST NOT run a real agent."
- **[Code quality](../decisions/code-quality.md)**, merged into the default branch after this plan
  was written:
  - "Rust and TypeScript functions MUST NOT be longer than 100 lines."
  - "Rust and TypeScript source files MUST NOT be longer than 500 lines. Tests and generated files
    are exempt."
  - "A new marker MUST NOT be added unless a human approves it as a constitution exception in the
    plan's complexity tracking."
  - "A feature touching a marked function or file splits it first, in a commit that only
    restructures it, then removes its marker."
  - "Unit tests MUST NOT sleep for a fixed time, or assert how long something took. Benchmarks of a
    spec's success criteria are exempt."
- **Existing guarantees to keep.**
  - `ura status` keeps printing "implementation, Task 3: Repeat menu"
    ([`status.rs`](/crates/cli/src/status.rs), test
    [`crates/cli/tests/next.rs`](/crates/cli/tests/next.rs)), and Home keeps `step.task`.
  - Hand-over (`?continue=`), Ask the agent (`?ask=`), and old run links (`/runs/<id>`) keep their
    addresses and behaviour ([`sessions.ts`](/packages/web/src/sessions.ts),
    [`App.tsx`](/packages/web/src/App.tsx) `RunRedirect`).
  - The task view keeps its pane beside its list (`TaskRoute`, `Panes`).

## Code read

- **Core: the step.** [`crates/core/src/steps.rs`](/crates/core/src/steps.rs):
  - `feature_step` (lines 205–230) sets `task: "Task {n}: {title}"` from `plan::tasks`;
  - `bug_step` (line 260) uses `plan::checkboxes`, which stays;
  - `Step` (lines 80–92) is serialized whole by `ura next --json` and `ura status --json`.
- **Core: the plan's parsers.**
  - [`files/plan.rs`](/crates/core/src/files/plan.rs) counts tasks line by line.
  - [`files/items.rs`](/crates/core/src/files/items.rs) builds `TaskItem`s from a parsed `Document`:
    `items(name, text, doc)` at line 210, and the private `tasks(doc)` at line 420.
    `document::parse(text, dir)` is in [`files/document.rs`](/crates/core/src/files/document.rs).
  - Tests: `plan_tasks_count_checkboxes` and `plan_first_unchecked_task` in
    [`crates/core/tests/files.rs`](/crates/core/tests/files.rs) (lines 322–350).
- **Core: the views.** [`view.rs`](/crates/core/src/view.rs):
  - `StepView` (line 38), filled by `From<&Step>` (lines 243–252);
  - `NextStepView` (line 228);
  - `FeatureView` (line 76) already has `slug`.
  - The napi pattern is `#[cfg_attr(feature = "napi", napi(object))]` with
    `#[serde(rename_all = "camelCase")]`.
- **Core: git and the api.**
  - [`git.rs`](/crates/core/src/git.rs): `Git::output` (line 580) runs git in its root;
    `default_branch` (line 189); `tip` (line 258), local then `origin/`; `unmerged_commits` (line
    427), the pattern for a git call.
  - [`api.rs`](/crates/core/src/api.rs): `open(repo)` (line 106), `find(workspace, folder)` (line
    230), `refused` (line 43), and `read_raw` (line 999) as a model.
  - The binding is in [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): every function is a
    `job(move || api::...)` returning a Promise, like `read_raw`.
- **Core: the watcher.** [`watch.rs`](/crates/core/src/watch.rs) `snapshot` (lines 59–122) hashes
  each feature's step, files, problems, texts, and `uncommitted` (lines 91–96). Its tests are in
  [`crates/core/tests/watch.rs`](/crates/core/tests/watch.rs), with `repo()`, `watching()`, and
  `next()`.
- **Core test helpers.**
  - [`tests/common/repo.rs`](/crates/core/tests/common/repo.rs): `TestRepo` with `write`, `commit`,
    `switch_new`, `switch`, `push`, `git`.
  - [`tests/common/texts.rs`](/crates/core/tests/common/texts.rs):
    `plan(status, spec_revision, tasks)` and `spec(...)`.
  - [`tests/steps.rs`](/crates/core/tests/steps.rs): `feature(kind, files)`, built with
    `Feature::from_texts`.
- **Server.**
  - Sources are in [`fate/sources.ts`](/packages/server/src/fate/sources.ts): `fileSource(...)` in
    `createSources`, wrapped in `repository(...)`, with the Feature source (lines 512–534) as the
    model. `each()` drops ids whose read throws.
  - Records and data views are in [`fate/views.ts`](/packages/server/src/fate/views.ts): `Record_`,
    `dataView`, `Root` (lines 351–367), and `sentFile`, which fills absent fields with `null`.
  - `featureRecord` is in [`fate/sessions.ts`](/packages/server/src/fate/sessions.ts) (lines
    338–346), and `missingFeature` in `sources.ts` (lines 468–484).
  - [`live.ts`](/packages/server/src/live.ts) `publish` (lines 28–50) updates `Feature` per changed
    folder.
  - [`fate.ts`](/packages/server/src/fate.ts) re-exports the views and entity types.
  - The by-id request key comes from the `Root` list's name: `branchChangesList` becomes
    `branchChanges`.
- **Server tests.** [`__tests__/helpers.ts`](/packages/server/src/__tests__/helpers.ts) has
  `testApp`, `testHosts(repos, { binding })`, `byId(app, type, ids, select)`, and `git`.
  [`__tests__/live.test.ts`](/packages/server/src/__tests__/live.test.ts) has the watcher-driven
  test (lines 176–208) and `published(bus)`. The binding is real, and fakes spread it.
- **Fixtures.**
  - [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts) `fixtureRepo()` builds
    `fixtures/repo`: `main`, then one branch per `branches/<name>`.
  - `2026-10-12-cli-tuis` has an approved spec at revision 1 and no plan. The only plan with tasks
    is `2026-10-13-plan-review`'s, which waits for its review.
- **Web: the session.**
  - [`App.tsx`](/packages/web/src/App.tsx) `SessionRoute` (lines 146–156) draws `Panes`, and
    `useListPosition` serves `TaskRoute` too.
  - [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx): `Header` (line 58, level 2 when wide),
    `Session` (line 110), `FeatureSession` (line 312, crumbs only when narrow at line 356), and the
    sticky composer style.
  - [`Transcript.tsx`](/packages/web/src/Transcript.tsx), 611 lines: `AT_END` (line 129), `scroller`
    (line 132), `useOpenAtEnd` (line 147), `useFollowEnd` (line 173), `Activity` (line 501), and
    `ChatMessageList aria-label="Conversation"` (line 605).
  - [`Composer.tsx`](/packages/web/src/Composer.tsx) `useReplyStatus` (lines 22–34) announces
    "<agent> is replying" and "Reply complete" in a hidden `role="status"`.
- **Web: the sidebar.** [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx):
  - `Item` (lines 91–126) selects a row when the path equals or starts with its own;
  - `Subagents` (lines 129–149) is the nested-row precedent;
  - `FeatureRow` (lines 308–332) uses the title;
  - `Sessions` filters by title on the client (lines 203–209).
  - `Shell.tsx` saves the sidebar under `uraeda.nav`.
- **Web: the plan's tasks.** [`data.ts`](/packages/web/src/data.ts) `useFile(folder, name)` with
  `FileView`'s `items.plan.tasks`, as [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx) reads
  them (line 97). `useFeature(folder)` is the hook pattern for a new view. `views.ts` `FeatureView`
  selects `step` field by field (line 76).
- **Web: the theme.** [`theme/theme.ts`](/packages/web/src/theme/theme.ts) `localTokens` (lines
  51–72), rebuilt into `theme/built/` by `vp run --filter uraeda-web theme`. The sticky column
  precedent is [`RoundNav.tsx`](/packages/web/src/RoundNav.tsx) (lines 19–31).
- **Web: storage.** No shared `localStorage` helper exists:
  [`theme.tsx`](/packages/web/src/theme.tsx) and
  [`useRoundPosition.ts`](/packages/web/src/useRoundPosition.ts) each wrap it in try/catch. Test
  helpers clear storage before each test.
- **Web: the unit tests.**
  - [`__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx):
    `renderPage(path, repo, { agent })`, `fakeAgent()`, `atWidth(width)` (1024 by default),
    `refreshUntil(check)`, `click`, `type`, `git`, and `fixtureRepo`. Live updates do not arrive
    under happy-dom: tests change data, then `refreshUntil`.
  - Tests that the new layout breaks:
    - [`session.test.tsx`](/packages/web/src/__tests__/session.test.tsx): 274–293, the pane and the
      phone-only crumbs; 156–157 and 173, `atWidth(402)` to avoid a second Stop; 295–309, the reply
      status;
    - [`agent-panel.test.tsx`](/packages/web/src/__tests__/agent-panel.test.tsx): 282 and 307, the
      panel read on `/session`;
    - [`shell.test.tsx`](/packages/web/src/__tests__/shell.test.tsx): `row(title)` (line 113), and
      `sidebarStatus(title)` in `agent-panel.test.tsx`.
- **Web: the browser tests.** [`__browser__/helpers.tsx`](/packages/web/src/__browser__/helpers.tsx)
  has `show`, `drawn`, `checkLayout`, `startTurn`, and `agent` commands (`agentEmit`, `writeRepo`).
  The tests that assume the pane:
  - [`session.test.tsx`](/packages/web/src/__browser__/session.test.tsx): `scroller()` (lines 16–20)
    and the Close at 76–86;
  - [`layout.test.tsx`](/packages/web/src/__browser__/layout.test.tsx): the `PAGES` list (35–59),
    and the agent section checked only on the phone (260–265).

  The browser projects run at 402 × 874 and 1440 × 900.

- **Screenshots.** [`packages/web/scripts/screenshots.ts`](/packages/web/scripts/screenshots.ts):
  `vp run --filter uraeda-web screenshots <folder> <views…>`.
- **Validation.**
  - `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, and `cargo test`.
  - `vp run --filter uraeda-binding build` regenerates `packages/binding/index.{js,d.ts}`, which are
    committed.
  - `vp run --filter uraeda-web build` regenerates `packages/web/.fate/client.generated.ts`, which
    is committed.
  - `vp run --filter uraeda-web theme --check`, `vp check`, and `vp test`, which runs the WebKit
    browser project inside `nix develop`.
  - All of it together: `vp run ready`.

## Constitution check

| Principle                                  | Complies | Notes                                                                                                    |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | Only the approved UI layout change is built. No agent setting changes (Task 10 keeps tool rows).         |
| II. Git and plain text first               | yes      | Progress from `plan.md`, changes from git (Tasks 1–2). The browser holds only the column's folded state. |
| III. Asynchronous by default               | yes      | Everything is recomputed from the repository, and the watcher reaches agents started anywhere (Task 3).  |
| IV. Review effort matches impact           | yes      | One click from the sidebar to the session (Task 5).                                                      |
| V. Tools are optional                      | yes      | The skill and the plan format do not change. `ura` keeps its output (Task 1).                            |
| VI. Code is checked and stays maintainable | yes      | One parser instead of two (Task 1). The following hooks leave the 611-line `Transcript.tsx` (Task 9).    |

## Decisions

The decisions this plan relies on, and where it follows them:

- [UI layout](../decisions/ui-layout.md): the session's own page (Task 6), the foldable column (Task
  7), the short sidebar with full accessible names (Task 5), and both widths (Tasks 8, 11).
- [UI components](../decisions/ui-components.md): Astryx's `Layout`, `LayoutPanel`, `ProgressBar`,
  `SideNavItem`, `Button`, and `List`. The ring is an SVG styled with StyleX tokens (Tasks 5, 7).
- [UI behaviour](../decisions/ui-behaviour.md): whole rows, Back keeping the open line (Task 8), and
  errors kept on screen (Task 7).
- [UI checks](../decisions/ui-checks.md): tests through roles and text, layout checks and
  screenshots (Task 11).
- [Stack](../decisions/stack.md): progress and changes computed in the core, and types generated by
  napi-rs (Tasks 1, 2, 4).
- [Agents](../decisions/agents.md): the fake adapter in every test. No agent setting changes.
- [Code quality](../decisions/code-quality.md): new code in new modules where a file is at its limit
  (Tasks 1, 2), and the marked functions and files split first, in commits of their own (Tasks 5, 6,
  9, 10).

## Complexity tracking

| Abstraction or exception                                      | Why it is needed                                                                                              | Simpler alternative rejected because                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `TaskProgress` type (Task 1)                                  | The sidebar, the column, the phone's line, and the announcer all need the position, the total, and the title. | Parsing `step.task`'s text in TypeScript reimplements the core, against the stack decision. |
| `plan::tasks(text, dir)` over the parsed plan (Task 1)        | The step and the review must count tasks the same way, from one parser.                                       | Keeping `plan::tasks` keeps two rules for one count.                                        |
| The `changes` module: `BranchChanges`, `ChangedFile` (Task 2) | The column's changes, computed in the core like every git read.                                               | Running git from the server would put git logic outside the core.                           |
| `BranchChanges` fate view and source (Task 4)                 | The column reads changes on demand, live, only for the session shown.                                         | Adding them to `FeatureView` would run a diff for every feature on every workspace read.    |
| `ProgressRing` component (Task 5)                             | The sidebar and the phone's line draw the same ring.                                                          | Astryx has no ring, and drawing it twice duplicates the SVG.                                |
| `SessionAside` component and `useAsideShown` (Task 7)         | The same content beside the transcript on wide screens and under the phone's line.                            | Two components would duplicate the sections.                                                |
| `following.ts`, moved out of `Transcript.tsx` (Task 9)        | The "Jump to the latest" button needs the follow state, and `Transcript.tsx` is already 611 lines.            | Growing `Transcript.tsx` past the coming 500-line limit.                                    |
| `SessionAnnouncer` (Task 10)                                  | One status region for turns and tasks, replacing the composer's `useReplyStatus`.                             | Two regions would announce the same turn twice.                                             |
| `addPlan` test helper (Task 4)                                | Server and web tests need a feature at its implementation, which no fixture has.                              | A new fixture branch would change the sidebar and counts many existing tests assert.        |
| `useKeepPlace` (Task 8)                                       | Crossing 768 px lays the old layout out at the new width for a moment, which moved the page to its end.       | The browser's own scroll anchoring, which the moment's clamp at the end defeats.            |

## Review comments

- **C1** (the UI layout decision should rest on concepts, readability first, with some views in
  panes and others in pages). The approval step carried it out, rewriting the decision around that
  goal (commit `8ae66ff`), and every task follows the rewritten rules listed in
  [Global constraints](#global-constraints). It supersedes no clause of the spec: the spec's layout
  is one of the choices the decision now allows.

---

## Task 1: Plan progress in the core

**Files:**

- Modify: `crates/core/src/steps.rs` (`Step`, `feature_step`, new `TaskProgress`)
- Modify: `crates/core/src/files/items.rs` (`tasks` becomes `pub(crate)`, nothing else: the file is
  at 499 lines, under the code quality decision's 500)
- Modify: `crates/core/src/files/plan.rs` (`tasks` returns the parsed plan's `TaskItem`s; `Task`
  goes; `checkboxes` stays)
- Modify: `crates/core/src/view.rs` (`StepView`, `NextStepView`, `From<&Step>`)
- Modify: `packages/binding/index.d.ts`, `packages/binding/index.js` (regenerated)
- Test: `crates/core/tests/steps.rs`, `crates/core/tests/files.rs`, `packages/binding/index.test.ts`

**Interfaces:**

- Produces:
  - `steps::TaskProgress { position: u32, total: u32, title: String }`, serialized in camelCase and
    exposed through napi as `TaskProgress`;
  - `Step.progress: Option<TaskProgress>` and `StepView.progress: Option<TaskProgress>`, set only
    when the step's name is `implementation`;
  - `plan::tasks(text: &str, dir: &str) -> Vec<TaskItem>`, in place of the line-based count, each
    title as written after `Task N:`, with its markup (R9).
  - `Step.task` keeps its text. `plan::Task` is removed.

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/steps.rs`, one table-driven test, `implementation_progress`, over plans built
with `texts::plan("auto-approved", 1, ...)` and an approved spec at revision 1:

| Plan                                                                   | `step.task`                | `step.progress`                                       |
| ---------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------- |
| 11 tasks, the first 6 done, the 7th titled "Session column"            | `Task 7: Session column`   | `{ position: 7, total: 11, title: "Session column" }` |
| Tasks numbered 1, 3, 3, the first done                                 | `Task 3: <second's title>` | `{ position: 2, total: 3, ... }`                      |
| Every box checked                                                      | `None` (final review)      | `None`                                                |
| No `## Task` heading                                                   | `None` (final review)      | `None`                                                |
| Plan `awaiting-human`                                                  | `None` (gate)              | `None`                                                |
| 2 tasks, then a `## Notes` section with `- [ ]` lines, both tasks done | `None` (final review)      | `None`                                                |

The last row pins the end of a task at the next level-2 heading.

In `crates/core/tests/files.rs`, rewrite `plan_tasks_count_checkboxes` and
`plan_first_unchecked_task` over `plan::tasks(text, "specs/x")`, with the same assertions.

In `packages/binding/index.test.ts`, after the step shape assertion at line 93, assert
`expect(next.step.progress).toBeUndefined()` for a feature that is not at its implementation:
napi-rs leaves a `None` field's key out, so `toMatchObject({ progress: undefined })` cannot pass
(R8).

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test steps --test files`
- Expected: FAIL to compile, `no field progress on type Step` and
  `this function takes 1 argument but 2 arguments were supplied`.

- [x] **Step 3: Implement the progress**

`plan::tasks` parses the text with `document::parse` and returns `items::tasks(&doc)`, the same
`TaskItem`s the review reads, with each title taken back as written from the heading's line (R9).
`feature_step` calls it with the feature's `path`, and finds the first task with `done < total`.
`position` is its index plus one, `total` is the number of tasks, and `task` is built from the same
task's `number` and `title`. Both step views copy `progress`. Remove `plan::Task`.

- [x] **Step 4: Run all tests, and regenerate the binding**

- Run:
  `cargo test && cargo clippy --workspace --all-targets -- -D warnings && vp run --filter uraeda-binding build && vp test --project uraeda-binding`
- Expected: PASS. `crates/cli/tests/next.rs` still expects "2026-10-06-recurring-tasks:
  implementation, Task 3: Repeat menu".

- [x] **Step 5: Commit**

```bash
git add crates/core/src/steps.rs crates/core/src/files/items.rs crates/core/src/files/plan.rs \
  crates/core/src/view.rs crates/core/tests/steps.rs crates/core/tests/files.rs \
  packages/binding/index.d.ts packages/binding/index.js packages/binding/index.test.ts
git commit -m "feat(session-view): the plan's progress in the step"
```

## Task 2: Branch changes in the core

**Files:**

- Create: `crates/core/src/changes.rs` (`ChangedFile`, `BranchChanges`, `branch_changes`, and the
  numstat call and parsing)
- Modify: `crates/core/src/lib.rs` (`pub mod changes`)
- Modify: `crates/core/src/git.rs`, `crates/core/src/api.rs`, and `crates/core/src/workspace.rs`:
  `Git::output`, `open`, `find`, and `folder_path` become `pub(crate)`, nothing else. Both files are
  over the code quality decision's 500 lines, and may only shrink.
- Modify: `crates/binding/src/lib.rs` (new `branchChanges`)
- Modify: `packages/binding/index.d.ts`, `packages/binding/index.js` (regenerated)
- Create: `crates/core/tests/branch_changes.rs`

**Interfaces:**

- Produces:
  - `changes::branch_changes(repo: &Path, folder: &str) -> Result<Option<BranchChanges>, ApiError>`;
  - `changes::BranchChanges { files: Vec<ChangedFile>, count: u32, added: u32, removed: u32 }`;
  - `changes::ChangedFile { path: String, added: Option<u32>, removed: Option<u32> }`;
  - in TypeScript, `branchChanges(repo: string, folder: string): Promise<BranchChanges | null>`.
    napi-rs declares `ChangedFile`'s `added` and `removed` optional: a binary file's are absent, not
    `null`, as for `progress`
    ([R8](rulings.md#r8-the-binding-test-asserts-an-absent-progress-with-tobeundefined)).

  It returns `None` when the feature has no branch, is merged, or the default branch is unknown. It
  refuses "no feature <folder>" through `find`. A failing git call becomes the usual `GitError`.

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/branch_changes.rs`, one table-driven test over `TestRepo` repositories. Each
row commits on `main`, then on the feature's branch, and calls `branch_changes`:

| Case                                                                                                                                                      | Expected                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `crates/core/src/git.rs` added with 38 lines; `packages/web/src/App.tsx`, 19 lines on main, gets 4 added and 19 removed; `specs/<folder>/plan.md` changed | `count 2, added 42, removed 19`, files sorted: `crates/core/src/git.rs` (38, 0), `packages/web/src/App.tsx` (4, 19) |
| Only `specs/<folder>/` changed                                                                                                                            | `Some`, `count 0`, no files                                                                                         |
| 60 files changed                                                                                                                                          | 50 files, the first by path; `count 60`                                                                             |
| A PNG committed                                                                                                                                           | the file with `added: None, removed: None`                                                                          |
| `a.txt` renamed to `b.txt`, unchanged                                                                                                                     | one file `b.txt`                                                                                                    |
| A commit on `main` after the branch started                                                                                                               | not listed: the diff starts at the merge base                                                                       |
| The feature only on `origin`, its local branch deleted (`TestRepo::push`)                                                                                 | the same files as before deleting it                                                                                |
| The bug branch `fix/2026-10-13-x` of `specs/bugs/2026-10-13-x/`                                                                                           | its files                                                                                                           |
| The feature's folder merged into `main`                                                                                                                   | `None`                                                                                                              |
| A feature whose proposal is not committed, so with no branch                                                                                              | `None`                                                                                                              |
| A file edited in the feature's worktree, not committed                                                                                                    | not listed                                                                                                          |
| A repository with neither `main`, `master`, `origin/HEAD`, nor `init.defaultBranch`                                                                       | `None`                                                                                                              |
| An unknown folder                                                                                                                                         | `Err`, refused "no feature 2026-10-14-nope"                                                                         |

Add `#[ignore] fn branch_changes_takes_under_100_ms()`, for SC-005: a branch of 60 changed files,
timed with `Instant`, asserting under 100 ms, run by hand with
`cargo test --release -p uraeda-core --test branch_changes -- --ignored`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test branch_changes`
- Expected: FAIL to compile, `could not find changes in uraeda_core`.

- [x] **Step 3: Implement `branch_changes`**

- **The git call.** A private `numstat(git: &Git, base: &str, tip: &str)` in `changes.rs` runs
  `git diff --numstat -z -M --no-ext-diff <base>...<tip>` through `output`. The three dots start the
  diff at the merge base. It parses the NUL-separated records: `added\tremoved\tpath`, or, for a
  rename, `added\tremoved\t` followed by the old and new paths. `-` counts mean a binary file.
- **The refs.** `base` and `tip` are the commits `Git::tip` resolves for `default_branch()` and the
  feature's branch, local first, then `origin`'s, passed as hashes in one `<base>...<tip>` argument
  ([R10](rulings.md#r10-the-diff-names-commits-not-branches)).
- **The result.** `branch_changes` drops the feature's own files: what `Feature::owns` gives it, and
  the paths under `specs/<folder>/` (or `specs/bugs/<folder>/` for a bug), through
  `workspace::folder_path`, so a finished feature's branch drops its record and its deleted folder,
  not the rest of `specs/done/`
  ([R11](rulings.md#r11-a-finished-features-own-files-are-its-record-and-its-folder)). It sorts by
  path, counts and sums all, and keeps the first 50.
- **The binding.** `crates/binding/src/lib.rs` exposes it like `read_raw`.

- [x] **Step 4: Run all tests, and regenerate the binding**

- Run:
  `cargo test && cargo clippy --workspace --all-targets -- -D warnings && vp run --filter uraeda-binding build`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/changes.rs crates/core/src/lib.rs crates/core/src/git.rs crates/core/src/api.rs \
  crates/binding/src/lib.rs crates/core/tests/branch_changes.rs \
  packages/binding/index.d.ts packages/binding/index.js
git commit -m "feat(session-view): the files changed on a feature's branch"
```

## Task 3: The watcher sees branch commits

**Files:**

- Modify: `crates/core/src/watch.rs` (`snapshot`)
- Test: `crates/core/tests/watch.rs`

**Interfaces:**

- Produces: `Changes.features` lists a feature whose branch's tip moved, even when no file of its
  folder changed.

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/watch.rs`:

- `a_code_commit_on_a_feature_branch_is_reported`: on the `repo()` fixture, commit `src/main.rs` on
  `FOLDER`'s branch through its worktree. Then `next(&receiver).features` contains `FOLDER`.
- `a_deleted_feature_branch_is_reported_once`: merge `FOLDER`'s branch into `main`, then delete it.
  Then the watcher reports `FOLDER` and does not panic, and a write to `specs/PRIORITIES.md` after
  that does not list `FOLDER` again.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test watch`
- Expected: FAIL, `a_code_commit_on_a_feature_branch_is_reported` timing out in `next` after 5 s.

- [x] **Step 3: Implement**

Add the hex of `git.tip(branch)` for the feature's branch to the feature's hash in `snapshot`, an
empty string when there is no branch or no tip.

- [x] **Step 4: Run all tests**

- Run: `cargo test -p uraeda-core`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core/src/watch.rs crates/core/tests/watch.rs
git commit -m "feat(session-view): publish a feature when its branch moves"
```

## Task 4: Progress and branch changes on the server

**Files:**

- Modify: `packages/binding/test-utils.ts` (new `addPlan`, `commitOnBranch`, and `ELEVEN`)
- Modify: `packages/server/src/fate/views.ts` (`BranchChangesRecord`, `branchChangesDataView`,
  `Root`)
- Modify: `packages/server/src/fate/sources.ts` (the `BranchChanges` source; `missingFeature`)
- Modify: `packages/server/src/fate/sessions.ts` (`featureRecord`)
- Modify: `packages/server/src/fate.ts` (exports)
- Modify: `packages/server/src/live.ts` (`publish`)
- Modify: `packages/web/.fate/client.generated.ts` (regenerated)
- Test: `packages/server/src/__tests__/fate.test.ts`, `packages/server/src/__tests__/live.test.ts`,
  `packages/server/src/__tests__/helpers.ts` (`testApp`'s options), and
  `packages/server/src/__tests__/guard.test.ts` (its call of `testApp`)

**Interfaces:**

- Consumes:
  - `binding.branchChanges` (Task 2);
  - `StepView.progress` (Task 1).
- Produces:
  - `addPlan(repo: string, folder: string, tasks: Array<[title: string, done: number, total: number]>, status = "auto-approved"): void`
    in `uraeda-binding/test-utils`. It commits `specs/<folder>/plan.md`, with `spec-revision: 1` and
    steps written `- [x] **Step N: Do**`, on the folder's branch, without touching the main
    checkout. It is built on
    `commitOnBranch(repo: string, branch: string, files: Record<string, string>): void`, exported
    beside it, which commits the given files on a branch in a temporary worktree, removed after, so
    the main checkout and its uncommitted files are left as they are
    ([R12](rulings.md#r12-the-test-helpers-commit-through-one-exported-commitonbranch)).
  - The fate type `BranchChanges`:
    `{ id: string /* folder */; changes: BranchChanges | null; failed: boolean }`, requested as
    `branchChanges` by id. A binary file's `added` and `removed` are sent as `null`.
  - Every `Feature` record's `step.progress` is present, `null` when absent.
  - `publish` updates `BranchChanges <folder>` for each changed feature.

- [x] **Step 1: Write the failing tests, and `addPlan`**

The fixture plan, exported from `test-utils.ts` beside `addPlan` and used again by the web tasks:
`ELEVEN`, 11 tasks of 5 steps, the first 6 done. Their titles, in order: "Plan progress in the
core", "One parser for plan tasks", "Branch changes in the core", "Branch changes on the server",
"Sidebar slugs and progress", "The session's own page", "Session column", "Jump to the latest", "The
phone's progress line", "Announcements", "Layout decision checks".

```ts
// fate.test.ts
test("a feature at its implementation sends its progress, and null once every box is checked", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  const { app } = await testApp(repo);

  const [feature] = await byId(app, "Feature", [CLI], ["id", "step"]);
  expect(feature.step.progress).toEqual({ position: 7, total: 11, title: "Session column" });

  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title]) => [title, 5, 5]),
  );
  const [done] = await byId(app, "Feature", [CLI], ["id", "step"]);
  expect(done.step).toHaveProperty("progress", null);
});

test("a feature's branch changes, and none for a feature without a branch", async () => {
  const repo = fixtureRepo();
  commitOnBranch(repo, CLI, { "src/cli.rs": "fn main() {}\n" });
  const { app } = await testApp(repo);

  const [changes] = await byId(app, "BranchChanges", [CLI], ["id", "changes", "failed"]);
  expect(changes).toEqual({
    id: CLI,
    failed: false,
    changes: {
      count: 1,
      added: 1,
      removed: 0,
      files: [{ path: "src/cli.rs", added: 1, removed: 0 }],
    },
  });
  const [onMain] = await byId(app, "BranchChanges", ["2026-10-10-cli-core"], ["changes"]);
  expect(onMain.changes).toBeNull();
});

test("a branch whose changes cannot be read is answered as failed", async () => {
  const { app } = await testApp(fixtureRepo(), {
    binding: { ...binding, branchChanges: () => Promise.reject(new Error("git: not found")) },
  });

  const [changes] = await byId(app, "BranchChanges", [CLI], ["changes", "failed"]);
  expect(changes).toEqual({ changes: null, failed: true });
});
```

`commitOnBranch` is exported from `test-utils.ts`, and `addPlan` uses it. `testApp` takes its
options as `{ allowedHosts, binding }`, the binding passed on to `testHosts` and `createApp`. The
failed answer also holds `id: CLI`, which fate sends with every record. More tests: a folder that is
no feature's sends `step.progress` as `null`, and no branch changes, `failed: false`, without a log;
the workspace's features send `progress`, `null` when absent; a binary file's lines are sent as
`null`. `packages/binding/test-utils.test.ts` checks that `commitOnBranch` leaves the main checkout
and its uncommitted files alone.

In `live.test.ts`, extend the watcher-driven test: a change listing `CLI` publishes
`"BranchChanges 2026-10-12-cli-tuis"` beside `"Feature 2026-10-12-cli-tuis"`.

- [x] **Step 2: Run them to check they fail**

- Run:
  `vp test packages/server/src/__tests__/fate.test.ts packages/server/src/__tests__/live.test.ts`
- Expected: FAIL. The binding already sends a set `progress`, so the first test fails at its last
  line, `expected { name: 'pull-request', … } to have property "progress" with value null`, and the
  changes' tests with `No source registered for 'BranchChanges'`.

- [x] **Step 3: Implement the source, the records, and the live update**

- **`step.progress`.** `featureRecord`, `missingFeature`, and the workspace's features send it as
  `null` when the core leaves it out ([review focus 1](#review-focus)), through `sentStep`.
- **The source.** The `BranchChanges` source calls `ctx.binding.branchChanges(ctx.repo, id)`, and
  sends a binary file's lines as `null`. On a thrown error, it writes the error's first line to
  `process.stderr`, as the server logs elsewhere, and answers `{ id, changes: null, failed: true }`.
  A folder that is no feature's, refused as missing, is answered
  `{ id, changes: null, failed: false }` without a log, as the `Feature` source answers it.
- **The live update.** `publish` updates `BranchChanges` in its loop over `changes.features`.
- **The client.** Regenerate it with `vp run --filter uraeda-web build`.

- [x] **Step 4: Run all tests**

- Run: `vp check && vp test --project uraeda-binding --project uraeda-server`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/binding/test-utils.ts packages/server/src packages/web/.fate/client.generated.ts
git commit -m "feat(session-view): progress and branch changes on the server"
```

## Task 5: The sidebar by slug, with each feature's progress

**Files:**

- Create: `packages/web/src/ProgressRing.tsx`
- Modify: `packages/web/src/SessionNav.tsx` (`Item`, `FeatureRow`, a new `ProgressRow`, `Sessions`)
- Modify: `packages/web/src/views.ts` (`FeatureView.step` gains `progress: true`)
- Test: `packages/web/src/__tests__/shell.test.tsx`,
  `packages/web/src/__tests__/agent-panel.test.tsx` (`sidebarStatus` by slug), and
  `packages/web/src/__browser__/layout.test.tsx` (the search for "CLI" waits for `cli-tuis`)

**Interfaces:**

- Consumes: `step.progress` (Tasks 1 and 4), and `addPlan` and `ELEVEN` (Task 4).
- Produces: `ProgressRing({ position, total }: { position: number; total: number })`, an
  `aria-hidden` SVG ring filled to `position / total`, in StyleX with theme tokens. Tasks 7 and 8
  use it.

- [x] **Step 1: Restructure `Sessions` in `SessionNav.tsx`, and commit**

Split it as its `max-lines-per-function` marker says: the search's filter in a function, and each
group in a component. Remove the marker. Behaviour does not change:
`vp check && vp test --project uraeda-web` passes with no test changed. Commit
`packages/web/src/SessionNav.tsx` alone:
`refactor(session-view): the sidebar's search and groups in their own parts`. The code quality
decision asks for this commit before the feature touches the function.

- [x] **Step 2: Write the failing tests**

In `shell.test.tsx`, `row(name)` finds a row by its accessible name's start, which is now the slug.
Existing tests move from titles to slugs: `row("cli-tuis")`, `row("web-ui")`, and
`row("stack-decision")`.

```tsx
test("US2.1: a feature's row reads its slug, and its title for screen readers", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  const cli = await findRow("cli-tuis");
  expect(cli.textContent).toContain("cli-tuis");
  expect(cli.textContent).not.toContain("CLI TUIs");
  expect(cli.getAttribute("aria-label")).toBe("cli-tuis, CLI TUIs, Idle");
});

test("US2.2, US2.3: a feature at its implementation has a progress row that opens its session", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage("/", repo, { agent: await fakeAgent() });

  const progress = await screen.findByRole("link", { name: "Task 7 of 11: Session column" });
  expect(progress.textContent).toContain("7/11 · Session column");
  click(progress);

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${CLI}/session`)));
  expect(nav().getByRole("link", { current: "page" })).toBe(progress);
});

test("US2.4: an agent's checked boxes move the progress, its dot staying Idle", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage("/", repo, { agent: await fakeAgent() });
  await screen.findByRole("link", { name: "Task 7 of 11: Session column" });

  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title], i) => [title, i < 7 ? 5 : 0, 5]),
  );

  await refreshUntil(() => screen.getByRole("link", { name: /^Task 8 of 11: / }));
  expect(statusOf(row("cli-tuis"))).toBe("Idle");
});

test("US2.5: a feature at its spec has no progress row", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  await findRow("cli-tuis");
  expect(screen.queryByRole("link", { name: /^Task \d+ of / })).toBeNull();
});

test("US2.6: the progress row comes before a running sub-agent's", async () => {
  // A session of CLI at Task 7 with a running sub-agent, emitted through the fake adapter as in
  // the existing sub-agent test (line 183).
  const links = within(nav())
    .getAllByRole("link")
    .map((link) => link.getAttribute("aria-label"));
  expect(links.indexOf("Task 7 of 11: Session column")).toBe(
    links.indexOf("Explore the tests, Working") - 1,
  );
});

test("US2.7: search finds a feature by its title", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  type(screen.getByRole("searchbox", { name: "Search sessions" }), "CLI TUI");

  await refreshUntil(() => expect(row("cli-tuis")).toBeTruthy());
});

test("a feature leaving its implementation loses its progress row", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage("/", repo, { agent: await fakeAgent() });
  await screen.findByRole("link", { name: "Task 7 of 11: Session column" });

  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title]) => [title, 5, 5]),
  );

  await refreshUntil(() => expect(screen.queryByRole("link", { name: /^Task / })).toBeNull());
});

test("the folded sidebar hides progress rows", async () => {
  // Fold the sidebar through its collapse button, as the existing folded test does.
  expect(screen.queryByRole("link", { name: /^Task / })).toBeNull();
});
```

US2.6's and the folded test's arrangement reuses the existing sub-agent and folded tests' setup.

- [x] **Step 3: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/shell.test.tsx`
- Expected: FAIL, US2.1 with `Unable to find a row "cli-tuis"`.

- [x] **Step 4: Implement**

- **Rows.** Feature rows show `feature.slug`, with `aria-label` "`<slug>, <title>, <status>`".
- **The progress row.** `ProgressRow` is a nested `SideNavItem`, styled like `Subagents`, shown when
  `step.progress` is set, which the core does during the implementation only
  ([R14](rulings.md#r14-the-sidebars-progress-row-shows-whenever-the-step-has-a-progress)), and
  hidden when the sidebar is folded. Its icon is `ProgressRing`, its label
  "`<position>/<total> · <title>`", its accessible name "`Task <position> of <total>: <title>`", and
  it links to `sessionPath(folder)`.
- **Selection.** The progress row is selected on the session's path, and the feature's row is not
  selected there while its progress row shows ([review focus 4](#review-focus)).
- **Search.** The client-side filter matches the title or the slug.

- [x] **Step 5: Run all tests**

- Run: `vp check && vp test --project uraeda-web`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/web/src/ProgressRing.tsx packages/web/src/SessionNav.tsx packages/web/src/views.ts \
  packages/web/src/__tests__/shell.test.tsx packages/web/src/__tests__/agent-panel.test.tsx \
  packages/web/src/__browser__/layout.test.tsx specs/2026-10-14-session-view/plan.md \
  specs/2026-10-14-session-view/rulings.md
git commit -m "feat(session-view): the sidebar by slug, with each feature's progress"
```

## Task 6: The session's own page

**Files:**

- Modify: `packages/web/src/App.tsx` (`SessionRoute`)
- Modify: `packages/web/src/SessionPage.tsx` (`Header`, `FeatureSession`)
- Modify: `packages/web/src/Transcript.tsx` (`useOpenAtEnd` no longer reads the entry's `pane`)
- Test: `packages/web/src/__tests__/session.test.tsx`,
  `packages/web/src/__tests__/agent-panel.test.tsx`,
  `packages/web/src/__browser__/session.test.tsx`, `packages/web/src/__browser__/layout.test.tsx`,
  `packages/web/src/__browser__/helpers.tsx`

**Interfaces:**

- Produces: `/f/<folder>/session` draws `SessionPage` alone at every width, with crumbs and a
  level-1 heading. `Panes` stays for `TaskRoute` only.

- [x] **Step 1: Restructure `Session` in `SessionPage.tsx`, and commit**

Split it as its `max-lines-per-function` marker says: the chat controls in a hook. Remove the
marker. Behaviour does not change: `vp check && vp test --project uraeda-web` passes with no test
changed. Commit `packages/web/src/SessionPage.tsx` and any new file alone:
`refactor(session-view): the chat controls in a hook`.

- [x] **Step 2: Write the failing tests**

In `__tests__/session.test.tsx`, replace "on a wide screen, the session is beside the feature page"
and "on the phone, the session is a page of its own, with crumbs" with one test over both widths:

```tsx
test.each([402, 1440])(
  "US1.1: at %i px, the session is a page of its own, with crumbs",
  async (width) => {
    atWidth(width);
    await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: await fakeAgent() });

    await screen.findByRole("log", { name: "Conversation" });
    expect(
      screen.getByRole("heading", { level: 1, name: "Web UI for the workflow files" }),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumbs" })).getByText("Session"),
    ).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Files" })).toBeNull();
  },
);

test("US1.8: Open the session replaces the feature page, and Back returns to it", async () => {
  await renderPage(`/f/${WEB_UI}`, fixtureRepo(), { agent: await fakeAgent() });
  window.scrollTo(0, 120);

  click(await screen.findByRole("link", { name: "Open the session" }));
  await screen.findByRole("log", { name: "Conversation" });
  expect(screen.queryByRole("list", { name: "Files" })).toBeNull();
  await act(async () => window.history.back());

  await screen.findByRole("list", { name: "Files" });
  expect(window.scrollY).toBe(120);
});

test("US1.9: Ask the agent opens the session with the quote, and Back returns to the review", async () => {
  // The fixture's recurring-tasks spec, its paragraph on lines 26–29 tapped, then Ask the agent.
  await screen.findByRole("log", { name: "Conversation" });
  await waitFor(() => expect(composerText()).toContain(`spec.md, lines 26–29:`));
  await act(async () => window.history.back());

  // With the agent available, Approve reads "Approve and start the agent".
  expect(await screen.findByRole("button", { name: "Approve and start the agent" })).toBeTruthy();
});
```

`composerText()` reads the composer's text, as the existing Ask the agent tests do; create it in the
test helpers if they read it inline. Keep "an old run's address opens the session at that turn"
(US1.10) as it is. Drop the `atWidth(402)` workarounds at lines 156–157 and 173: a wide screen no
longer shows the feature page's Stop. Move `agent-panel.test.tsx`'s two tests at lines 282 and 307
to read the panel on `/f/<folder>`, its own page, opened from the session's crumbs.

In `__browser__/session.test.tsx`:

- `scroller()` becomes the window's `document.scrollingElement`;
- "a working session: beside the feature page or a page" becomes "a working session: a page of its
  own, following its end (US1)", expecting no "Files" list at either size;
- the Close part goes;
- add one case, opening the session from a task view's entry, which still opens at its end
  ([review focus 6](#review-focus)): on a wide screen, from the task view's pane, through the
  sidebar's sub-agent row.

In `__browser__/layout.test.tsx`, the feature page's agent section is checked at both sizes, no
longer only on the phone, and `startTurn` in `__browser__/helpers.tsx` waits for the one Stop.

- [x] **Step 3: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/session.test.tsx`
- Expected: FAIL, US1.1 at 1440 on the crumbs' link (the feature page beside the pane has its own
  level-1 heading), and US1.8 with the "Files" list still shown.

- [x] **Step 4: Implement**

- **The route.** `SessionRoute` returns `<SessionPage folder={folder} />` alone, without
  `useListPosition`.
- **The page.** The heading is level 1 at every width, and `FeatureSession` passes its crumbs at
  every width. Remove the comments about the pane beside the feature page.
- **Opening at the end.** `useOpenAtEnd` skips only on a saved `scroll` or a `#turn-` address: a
  session is never in a pane, so the entry's `pane` is not its own.

- [x] **Step 5: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS, the browser project included.

- [x] **Step 6: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/SessionPage.tsx packages/web/src/Transcript.tsx \
  packages/web/src/__tests__/session.test.tsx packages/web/src/__tests__/agent-panel.test.tsx \
  packages/web/src/__browser__/session.test.tsx packages/web/src/__browser__/layout.test.tsx \
  packages/web/src/__browser__/helpers.tsx
git commit -m "feat(session-view): the session's own page at every width"
```

## Task 7: The session's column

**Files:**

- Create: `packages/web/src/SessionAside.tsx` (`SessionAside`, `useAsideShown`)
- Modify: `packages/web/src/SessionPage.tsx` (the `Layout` on wide screens, "Hide progress")
- Modify: `packages/web/src/views.ts`, `packages/web/src/data.ts` (`BranchChangesView`,
  `useBranchChanges(folder)`)
- Modify: `packages/web/src/theme/theme.ts`, `packages/web/src/theme/built/*`
  (`--size-session-aside: 320px`)
- Create: `packages/web/src/__tests__/session-aside.test.tsx`
- Modify: `packages/web/src/__tests__/helpers.tsx` (`renderPage` and `serverFetch` take the server's
  `binding`)

**Interfaces:**

- Consumes:
  - `ProgressRing` (Task 5);
  - the `BranchChanges` type (Task 4);
  - `useFile(folder, "plan.md")` for the tasks;
  - `useFeature(folder)`;
  - the session's `subagents`.
- Produces:
  - `SessionAside({ folder, session }: { folder: string; session?: string })`, the column's
    sections, used by Task 8 too;
  - `useAsideShown(): AsideShown`, with `type AsideShown = [boolean, (shown: boolean) => void]`,
    over `localStorage`'s `uraeda.sessionAside`, called once in `FeatureSession` and passed to
    `Session` and `NoSession` as `aside`;
  - `WithAside({ aside, children, folder, session })`, the `Layout` around the session's `Page` at
    every width, its `end` slot the column on wide screens while shown, and
    `AsideToggle({ aside })`, "Hide progress" or "Show progress" on wide screens only
    ([R16](rulings.md#r16-the-columns-tests-follow-the-cores-steps-and-the-layout-wraps-the-whole-session),
    [R17](rulings.md#r17-the-layout-wraps-the-page-at-every-width-its-column-at-the-windows-edge)).

- [x] **Step 1: Write the failing tests**

In `session-aside.test.tsx`, at 1440 px, with a helper `aside()` returning
`within(screen.getByRole("complementary", { name: "Progress" }))`:

| Test                                                                | Arrange                                                                      | Assert                                                                                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| US1.2: the column shows the step, Task 7 of 11, and the tasks       | `addPlan(repo, CLI, ELEVEN)`                                                 | "Implementation"; "Task 7 of 11"; `progressbar` "Task 7 of 11" with value 7 of 11; 11 items, 6 named "Done: …", "Current: Session column" |
| US1.3: a checked box moves it                                       | then `addPlan` with 7 done, `refreshUntil`                                   | "Task 8 of 11"                                                                                                                            |
| US1.4: the changed files, without the feature's folder              | commits of the spec's two files and `specs/<CLI>/notes.md`                   | "2 files · +42 −19", then `crates/core/src/git.rs` "+38 −0", `packages/web/src/App.tsx` "+4 −19"                                          |
| US1.5: a new commit adds a file                                     | then one more commit, `refreshUntil`                                         | "3 files"                                                                                                                                 |
| US1.6: a running sub-agent is listed                                | a session with a sub-agent, as in `shell.test.tsx`                           | "Sub-agents", "Explore the tests"                                                                                                         |
| US1.7: Hide progress folds it, for every session and after a reload | click "Hide progress"; open `WEB_UI`'s session; render again                 | no `complementary` "Progress"; the button reads "Show progress"                                                                           |
| Edge: no plan yet                                                   | `CLI` as fixtured                                                            | "Plan", "No plan yet."                                                                                                                    |
| Edge: a plan in review                                              | `addPlan(..., "awaiting-human")`                                             | "Review the plan", 11 tasks, none "Current:", no `progressbar`                                                                            |
| Edge: every box checked                                             | `addPlan` all done                                                           | "Pull request", "11 of 11 tasks done", a full `progressbar`                                                                               |
| Edge: nothing changed                                               | `CLI` as fixtured                                                            | "Nothing outside the feature's folder yet."                                                                                               |
| Edge: more than 50 files                                            | 60 files committed                                                           | 50 paths, "and 10 more files"                                                                                                             |
| Edge: a binary file                                                 | a PNG committed                                                              | its path and "binary"                                                                                                                     |
| Edge: no branch                                                     | a feature whose proposal is uncommitted                                      | "Write the proposal"; once `BranchChanges` is answered, no "Changed on the branch"                                                        |
| Edge: git failing                                                   | the `branchChanges` binding rejecting, through `renderPage`'s server options | "The changes could not be read.", and the tasks still shown                                                                               |
| Edge: no session                                                    | `CLI` with no session                                                        | the column shows, and the transcript is empty                                                                                             |
| Edge: `localStorage` refused                                        | `setItem` throwing                                                           | the column shows; "Hide progress" still folds it                                                                                          |
| US5.1: a chat has no column                                         | a chat                                                                       | no `complementary` "Progress", no "Hide progress"                                                                                         |

The task list's items are named "Done: <title>", "Current: <title>", or "<title>", so screen readers
hear the marks. `CLI` as fixtured is at the plan's step, its spec approved, and a plan whose boxes
are all checked reaches "Pull request" in the tests, which know no pull request
([R16](rulings.md#r16-the-columns-tests-follow-the-cores-steps-and-the-layout-wraps-the-whole-session)).

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/session-aside.test.tsx`
- Expected: FAIL, US1.2 with `Unable to find role "complementary" with name "Progress"`.

- [x] **Step 3: Implement**

- **The layout.** At every width, a session's `Page` is the content of an Astryx `Layout`,
  `height="auto"` as the window scrolls, so the page keeps its place in the tree as the column comes
  and goes. The crumbs, the header, the transcript, and the composer are in the page, as in the
  mockup, and on wide screens, while shown, a `LayoutPanel` labelled "Progress", 320 px from the
  theme, `role="complementary"`, with a divider, sticky through its `xstyle` and scrolling on its
  own like `RoundNav`, is its `end` slot, at the window's edge.
- **"Hide progress" and "Show progress"** sit in the header's status line, on wide screens only.
- **`useAsideShown`** reads and writes `uraeda.sessionAside` in try/catch. Where storage refuses the
  write, the choice is kept in the module for the document's life, as pages are drawn anew at each
  address.
- **The step's heading** reads what a gate asks of the human, `waiting(feature).title` like "Review
  the plan", and the step's label otherwise.
- **Each read of the column** (tasks, sub-agents, changes) has its own `Suspense` and error
  boundary: a failed read leaves its section out, and the session and the other sections stay
  ([R18](rulings.md#r18-the-columns-step-reads-as-a-gate-and-its-reads-fail-alone)).
- **The sections**, in this order:
  - the step's label (`stepLabel`);
  - the progress: "Task N of M" with a `ProgressBar` while `step.progress` is set, "M of M tasks
    done" when every task is done, the tasks from `useFile(folder, "plan.md")`, and "No plan yet."
    without a plan;
  - "Sub-agents", while any run;
  - "Changed on the branch", unless `changes` is `null` and nothing `failed`;
  - "Feature": the feature page, then its workflow files except reviews.
- **The changes.** The total line reads "`N files · +A −R`" and each file "`+a −r`", or "binary".
- **The new view.** `BranchChangesView` selects `{ id, changes, failed }`. `useBranchChanges`
  follows `useFeature`'s pattern.
- **The theme.** Add `--size-session-aside`, rebuild with `vp run --filter uraeda-web theme`, and
  commit both.

- [x] **Step 4: Run all tests**

- Run: `vp run --filter uraeda-web theme --check && vp check && vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/SessionAside.tsx packages/web/src/SessionPage.tsx packages/web/src/views.ts \
  packages/web/src/data.ts packages/web/src/theme packages/web/src/__tests__/session-aside.test.tsx \
  packages/web/src/__tests__/helpers.tsx specs/2026-10-14-session-view/plan.md \
  specs/2026-10-14-session-view/rulings.md
git commit -m "feat(session-view): the session's column of progress and changes"
```

## Task 8: The phone's progress line

**Files:**

- Create: `packages/web/src/ProgressLine.tsx` (`ProgressLine`, the line and its open state)
- Create: `packages/web/src/useKeepPlace.ts` (`useKeepPlace`, the reading place across widths)
- Modify: `packages/web/src/SessionPage.tsx` (the line under the header, and `useKeepPlace`)
- Modify: `packages/web/src/SessionAside.tsx` (`stepTitle` exported)
- Modify: `packages/web/src/layout/useWidthClass.ts` (`widthClassNow`)
- Modify: `packages/web/src/Transcript.tsx` (`AT_END` exported, for `useKeepPlace`)
- Modify: `packages/web/src/routes.tsx` (`Entry` gains `progress?: boolean`)
- Modify: `packages/web/vite.browser.config.ts` (the `addPlan(folder)` command)
- Test: `packages/web/src/__tests__/session-aside.test.tsx`,
  `packages/web/src/__browser__/session.test.tsx`

**Interfaces:**

- Consumes: `SessionAside` and `ProgressRing` (Tasks 5, 7).
- Produces:
  - the history entry's `progress` flag, read and written through `updateEntry`;
  - `ProgressLine({ folder, session })`, drawn by `Session` and `NoSession` for a feature;
  - `useKeepPlace(ref)`, called by `Session` on its transcript;
  - `widthClassNow()` in `layout/useWidthClass.ts`;
  - `stepTitle(feature)`, exported from `SessionAside.tsx`;
  - the browser tests' `agent.addPlan(folder)`, the fixture's plan of 11 tasks
    ([R19](rulings.md#r19-the-phones-line-is-astryxs-collapsible-and-the-page-keeps-the-line-read)).

- [x] **Step 1: Write the failing tests**

In `session-aside.test.tsx`, at 402 px:

```tsx
test("US3.1, US3.2: the progress line opens the column's content in place", async () => {
  atWidth(402);
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  const line = await screen.findByRole("button", {
    name: "Implementation · 7/11 · Session column",
  });
  expect(line.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Task 7 of 11")).toBeNull();

  await click(line);
  expect(line.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Task 7 of 11")).toBeTruthy();

  await click(line);
  expect(screen.queryByText("Task 7 of 11")).toBeNull();
});
```

In `__browser__/session.test.tsx`:

- "US3.3: the open line survives a file link and Back": at the phone size, open the line, scroll to
  320, follow "plan.md", go Back, then the line is expanded at the same `scrollY`;
- "the column follows the width": at the desktop size, with the column shown and the page scrolled,
  `page.viewport(402, 874)` shows the collapsed line, the transcript's line read a third down the
  window where it was, and going back to 1440 shows the column, the line read kept again
  ([R19](rulings.md#r19-the-phones-line-is-astryxs-collapsible-and-the-page-keeps-the-line-read)).

After the task's review, unit tests check that the line comes before the transcript and opens a
region "Progress", that a reload keeps it open and a new visit starts folded, that it folds back
once wide, that without progress it reads the step alone, and that a chat has none; two browser
tests check a paragraph read across the line, and a place moved by opening the line, across 768 px
([R20](rulings.md#r20-the-place-read-follows-what-moves-and-the-line-folds-back)).

A second unit test, "a plan in review", checks that the line reads "Review the plan", as the
column's heading does
([R18](rulings.md#r18-the-columns-step-reads-as-a-gate-and-its-reads-fail-alone)).

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/session-aside.test.tsx`
- Expected: FAIL, `Unable to find role "button" with name "Implementation · 7/11 · Session column"`.

- [x] **Step 3: Implement**

- **The line.** On narrow screens, a feature's session shows an Astryx `Collapsible` under the
  header, its trigger a button with `aria-expanded`. It holds the ring and
  "`<Step> · <position>/<total> · <title>`", or the step alone without progress, the step read as
  the column's heading reads it (`stepTitle`). When open, `SessionAside` shows below it, above the
  transcript, drawn only while open, in a region labelled "Progress". Its open state is drawn by an
  inner `Line`, which the wide layout removes: the line comes back folded
  ([R20](rulings.md#r20-the-place-read-follows-what-moves-and-the-line-folds-back)).
- **Keeping it.** The open state is kept in the history entry's `progress`, so Back restores it.
- **Keeping the place.** `useKeepPlace` keeps the transcript's line read a third down the window
  where it was as the width class changes, or the end in view. It reads the place on scroll and as
  the page or the transcript resizes, and a block holding text across the line is the place
  ([R20](rulings.md#r20-the-place-read-follows-what-moves-and-the-line-folds-back))
  ([R19](rulings.md#r19-the-phones-line-is-astryxs-collapsible-and-the-page-keeps-the-line-read)).

- [x] **Step 4: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/ProgressLine.tsx packages/web/src/useKeepPlace.ts \
  packages/web/src/SessionPage.tsx packages/web/src/SessionAside.tsx packages/web/src/Transcript.tsx \
  packages/web/src/layout/useWidthClass.ts packages/web/src/routes.tsx \
  packages/web/vite.browser.config.ts packages/web/src/__tests__/session-aside.test.tsx \
  packages/web/src/__browser__/session.test.tsx specs/2026-10-14-session-view/plan.md \
  specs/2026-10-14-session-view/rulings.md
git commit -m "feat(session-view): the session's progress line on the phone"
```

## Task 9: Jump to the latest

**Files:**

- Create: `packages/web/src/following.ts` (`useOpenAtEnd`, `useFollowEnd`, moved from
  `Transcript.tsx` in Step 1, with `AT_END`; `useKeepPlace.ts` then imports `atEnd` from it, its own
  copy becoming following's one `atEnd`)
- Create: `packages/web/src/JumpToLatest.tsx` (the button, after the review: R22)
- Create: `packages/web/src/ToolGroups.tsx` (the tool groups, moved from `Transcript.tsx` in Step 1:
  `ToolGroup`, which draws one group, and its calls' statuses and durations)
- Modify: `packages/web/src/Transcript.tsx` (the moved parts and its `max-lines` marker go)
- Modify: `packages/web/src/SessionPage.tsx` (the button above the composer)
- Test: `packages/web/src/__browser__/session.test.tsx`

**Interfaces:**

- Produces:
  `useFollowEnd(ref: RefObject<HTMLElement | null>, enabled: boolean): { following: boolean; jumpToLatest: () => void }`.
  `following` is false once the reader scrolls more than `AT_END` (24 px) from the end, and true
  again at the end: growing does not change it (R22). `jumpToLatest` scrolls to the end and follows
  again. `useOpenAtEnd(ref)` is unchanged.

- [x] **Step 1: Restructure `Transcript.tsx`, and commit**

Move the tool groups into a module of their own, `ToolGroups.tsx`, as the file's `max-lines` marker
says, and the following hooks, with `AT_END`, `scroller`, and one `atEnd`, into `following.ts`.
Remove the file's marker. The grouping function, `TranscriptItems`, stays and draws each group with
`ToolGroup`, which brings it under 100 lines, so its own marker goes too. Behaviour does not change:
`vp check && vp test` passes with no test changed. Commit the three files alone:
`refactor(session-view): the transcript's tool groups and following in their own modules`.

- [x] **Step 2: Write the failing tests**

In `__browser__/session.test.tsx`, on the working session at both sizes:

- US4.1: at the end, a new line comes into view; this is the existing assertion, kept;
- US4.2: scrolled up 400 px, the page keeps its position as lines arrive, and "Jump to the latest"
  shows;
- US4.3: pressing it scrolls the newest line into view, the button goes, and a further line stays in
  view;
- US4.4: at the end, no "Jump to the latest" shows;
- "an ended session scrolled up also offers Jump to the latest";
- after the review (R22): "idle at the end, send: the reply stays in view and no button shows", the
  focus on the composer after the jump, by click and by Enter, and the button above the composer
  without growing the page.

- [x] **Step 3: Run them to check they fail**

- Run: `vp test --project uraeda-web-browser packages/web/src/__browser__/session.test.tsx`
- Expected: FAIL, US4.2 with `Unable to find role "button" with name "Jump to the latest"`.

- [x] **Step 4: Implement**

Make `useFollowEnd`, in `following.ts` since Step 1, expose its state. It measures the distance to
the end whether the session works or not, and only a working session follows it. It skips the
positions of a layout drawn for the other width class, as `useKeepPlace` does. `SessionPage` shows
an Astryx `Button` "Jump to the latest" above the composer, inside its sticky area, while
`following` is false: `JumpToLatest`, floating over the transcript's end.

- [x] **Step 5: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/web/src/following.ts packages/web/src/Transcript.tsx packages/web/src/SessionPage.tsx \
  packages/web/src/__browser__/session.test.tsx specs/2026-10-14-session-view/plan.md \
  specs/2026-10-14-session-view/rulings.md
git commit -m "feat(session-view): jump to the latest"
```

## Task 10: Announcements

**Files:**

- Create: `packages/web/src/SessionAnnouncer.tsx`
- Modify: `packages/web/src/Composer.tsx` (`useReplyStatus` and its region go)
- Modify: `packages/web/src/SessionPage.tsx` (renders the announcer)
- Modify: `packages/web/src/Transcript.tsx` (the log stops announcing)
- Test: `packages/web/src/__tests__/session.test.tsx`

**Interfaces:**

- Consumes: the session's turns and `step.progress`.
- Produces:
  `SessionAnnouncer({ created, feature, session }: { created?: boolean; feature?: string; session?: string })`,
  a visually hidden `role="status"` region named "Agent updates", keeping its last three
  announcements, drawn by `FeatureSession` around both its states and beside a chat's `Session`
  (R23). It follows every turn not yet ended (R24). `useCreatedHere()` reads a new chat's `created`
  history entry once.

- [x] **Step 1: Restructure `Composer` in `Composer.tsx`, and commit**

Split it as its `max-lines-per-function` marker says: the send and stop actions in a hook. Remove
the marker. Behaviour does not change: `vp check && vp test --project uraeda-web` passes with no
test changed. Commit `packages/web/src/Composer.tsx` and any new file alone:
`refactor(session-view): the composer's send and stop in a hook`.

- [x] **Step 2: Write the failing tests**

Replace the test at lines 295–309 of `session.test.tsx`, which checks "is replying" and "Reply
complete", with these, and "a stopped turn is announced". `status()` returns the page's
`role="status"` region by its name, "Agent updates", since Astryx draws status regions of its own
(R23):

```tsx
test("US4.5: turns are announced as they start, end, and fail", async () => {
  const fake = await fakeAgent();
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage(`/f/${CLI}/session?continue=manual`, repo, { agent: fake });
  click(await screen.findByRole("button", { name: "Start the agent" }));

  await refreshUntil(() => expect(status().textContent).toBe("The agent started: Implementation"));
  fake.adapter.emit({ type: "result", ok: true, errors: [], denials: [], interrupted: false });
  await refreshUntil(() => expect(status().textContent).toBe("The agent finished"));
  // A second turn, failed with the runner's own reason.
  await refreshUntil(() =>
    expect(status().textContent).toBe("The agent failed: No output for 30 minutes."),
  );
});

test("US4.6: a new current task is announced", async () => {
  // Task 7, then addPlan with 7 done.
  await refreshUntil(() => expect(status().textContent).toBe("Task 8 of 11: Jump to the latest"));
});

test("a session already working when opened announces nothing", async () => {
  // A feature session with a running turn, then render.
  expect(status().textContent).toBe("");
});

test("the transcript does not announce what streams", async () => {
  expect(screen.getByRole("log", { name: "Conversation" }).getAttribute("aria-live")).toBe("off");
});
```

The failed turn is ended through the cache as
`endTurn(..., { state: "failed", reason: "No output for 30 minutes." })`, as `shell.test.tsx` writes
turns (lines 139–158).

- [x] **Step 3: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/session.test.tsx`
- Expected: FAIL, US4.5 with
  `Unable to find an accessible element with the role "status" and name "Agent updates"`, and the
  log's test with `expected 'polite' to be 'off'`.

- [x] **Step 4: Implement**

- **What it says.** `SessionAnnouncer` says what changed after it was drawn, never what it found:
  - a turn starting: "The agent started: <step label>" for a workflow turn, else "The agent
    started";
  - a turn ending: "The agent finished", "The agent failed: <reason>", or "The agent stopped";
  - `step.progress` moving: "Task <position> of <total>: <title>".
- **The composer's region goes.** It would announce the same turn twice.
- **The log stops announcing.** `ChatMessageList` gets `aria-live="off"`. If Astryx does not pass
  the attribute through, list it as an Astryx gap in this task's commit body, and set it on the log
  element in an effect. It does not: the effect sets it (R23).

- [x] **Step 5: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/web/src/SessionAnnouncer.tsx packages/web/src/Composer.tsx packages/web/src/SessionPage.tsx \
  packages/web/src/Transcript.tsx packages/web/src/__tests__/session.test.tsx \
  specs/2026-10-14-session-view/plan.md specs/2026-10-14-session-view/rulings.md
git commit -m "feat(session-view): announce turns and tasks, not every word"
```

## Task 11: Layout checks and screenshots

**Files:**

- Modify: `packages/web/src/__browser__/layout.test.tsx` (the page cases)
- Modify: `packages/web/vite.browser.config.ts` (a `commitOnBranch` test command over
  `uraeda-binding/test-utils`; `addPlan` came with Task 8)
- Modify: `packages/binding/test-utils.ts` (`planText()`, out of `addPlan`)
- Modify: `packages/web/scripts/screenshots.ts`, and create `packages/web/scripts/sessionShots.ts`
  (the views below, after a commit that splits `take()` under the size limit)
- Create: `specs/2026-10-14-session-view/screenshots/*.png`

**Interfaces:**

- Consumes: everything above.

- [x] **Step 1: Write the failing tests**

In `layout.test.tsx`, run `checkLayout()` in light and dark, at both sizes, on:

- "a feature's session at its implementation, with its column": `addPlan` through the new command, a
  working turn, the column shown. Also assert SC-001: at 1440 px, the log's width is at least 760
  px;
- the same "with its column hidden", after "Hide progress";
- "a chat": the existing "a new chat" case, plus a chat with one reply;
- "a feature waiting on an agent", now at both sizes, since the agent section no longer shows beside
  the session (the phone-only branch at lines 260–265 goes);
- "a session at 1024 px with the sidebar and the column open": no sideways scroll.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-web-browser packages/web/src/__browser__/layout.test.tsx`
- Expected: FAIL. `addPlan` existed already (R25): they failed on the column's long paths and on
  axe-core's label in name, on the sidebar's progress row.

- [x] **Step 3: Implement the command, then fix what the checks find**

Add the `commitOnBranch` command. Fix any cut text, insets, sizes, or axe findings in the new
components, within the UI decisions.

- [x] **Step 4: Run all tests, then take and review the screenshots**

- Run: `vp run ready`
- Expected: PASS.
- Run:
  `vp run --filter uraeda-web screenshots specs/2026-10-14-session-view session-implementation session-hidden session-phone-open sidebar-progress chat`,
  after adding those views to the script.
- Review each image, at both sizes and in both themes, against the
  [mockups](mockups/session-view.html) and the UI decisions, then fix what they show, and run
  `vp run ready` again.

- [x] **Step 5: Commit**

```bash
git add packages/web/src/__browser__ packages/web/vite.browser.config.ts packages/web/scripts/screenshots.ts \
  specs/2026-10-14-session-view/screenshots
git commit -m "test(session-view): layout checks and screenshots of the session's page"
```
