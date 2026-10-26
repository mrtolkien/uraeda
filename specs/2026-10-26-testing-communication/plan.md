---
status: auto-approved
spec-revision: 2
---

# Plan: Testing strategy review

**Goal:** Give the skill one short, generic home for testing, records that are their pull request's
text and point to their successors, and rewrite the repository's tests to the Testing decision,
tuned by runs of Claude Code with Sonnet.

**Architecture:** Three parts, owned apart. The skill's wording: the testing section of
[`code-quality.md`](/skills/uraeda/references/code-quality.md) owns every rule on tests, and the
other steps link to it; [`finish.md`](/skills/uraeda/references/finish.md) owns the record and the
pull request body written from it. The core: the record and spec templates, which
[`sections.rs`](/crates/core/src/check/sections.rs) embeds as the rules of `ura check`, gain their
new sections, and [`values.rs`](/crates/core/src/check/values.rs) owns the record's two new fields
and their pairing. The suite: each area's tests are judged against the Testing decision, logic that
only a UI test guards is extracted into pure functions with unit tests first, then the web UI's
rendering tests and the browser runner go. See the [spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A single-file check of a record** (`ura check <record>`, the editor's diagnostics) keeps only
   the problems of that file, so a pairing problem must be reported on the record whose own field is
   unmatched, never on its partner. Task 2.
2. **A rule only a removed test checked, in a decision this spec did not change**: the decision
   still names the test, so the test stays or its rule's owner moves to a unit test. Diagrams,
   notifications, sandbox, UI look, and code quality name tests here. Tasks 4, 5, 12.
3. **The theme's contrast test imports from the browser folder**: deleting `__browser__` breaks it
   unless the contrast functions move first. Task 10.
4. **The fast check's discovery tests name test files this feature deletes**: they fail once the
   files go, and must name files that remain. Tasks 10, 12.

## Global constraints

The approved rules every task follows, word for word, with their sources.

From the [Testing](/specs/decisions/testing.md) decision:

- A test MUST give way to the approved spec, the decisions, and the human's requests: a test that
  guards behaviour they replace is rewritten or removed in the task that changes the behaviour,
  never kept by bending the code. Checked by review.
- A spec that replaces behaviour MUST list it with the tests that guard it, so its approval covers
  their removal, and the record MUST name them. Checked by review.
- A test MUST assert what a caller or a user observes, never how the code does it. Checked by
  review.
- At the `early` stage, a feature MUST test little beyond stored formats, git, security, contracts
  between the project's parts, pure logic with many cases, and the reproduction of each bug fixed.
  Checked by review.
- A test of the web UI MUST guard behaviour that is costly to lose and that using the UI would not
  show, such as unsaved text or a git write, and everything else is left to the human's review.
  Checked by review.

From [UI checks](/specs/decisions/ui-checks.md):

- A pull request that adds a view MUST show one screenshot of it, in the pull request only. Checked
  by review.
- Screenshots MUST NOT be committed to the repository for review. Checked by review.

From [Toolchain](/specs/decisions/toolchain.md):

- `vp run ready` MUST run every check of the repository, rerunning only what a change can affect,
  and a new language, package, crate, or tool MUST add its checks to it. Checked by the toolchain
  configuration's test.
- CI MUST run the same checks as `ready`, uncached, in the Nix dev shell. Checked by the toolchain
  configuration's test.
- Test runners MUST NOT retry a failed test, and a test failing without a bug MUST be fixed in the
  pull request that finds it. Checked by the toolchain configuration's test and review.

From [Code quality](/specs/decisions/code-quality.md):

- Unit tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria.
  Checked by review.
- Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting, enforced by the existing linters. Checked by clippy and Oxlint.

From [Problems](/specs/decisions/problems.md):

- A new rule of `ura check` SHOULD be a note, unless the workflow cannot go on without a fix.
  Checked by review.

From the [spec](spec.md) and its [data model](data-model.md):

- The skill's testing section names no language, no test runner, and no library (SC-007).
- An agent may edit a merged record only to fix a broken link, and to add `superseded-by` and its
  note. Nothing else in the old record changes.
- The pull request body is "Pull request to review, about N minutes", with the points needing
  attention, then the record's text with its links made absolute at the finishing commit, and one
  screenshot per new view. The size table, the lists of tests changed, and the rulings section leave
  the body.

**How a test is judged** (tasks 6, 7, 11, 12, 13), from the rules above. Read each test, then:

- **Keep** a test of a stored format, git, security, a contract between the core, the CLI, the
  binding, and the server (a request and its response, a command's output and exit code, a check's
  message), pure logic with many cases, or the reproduction of a bug fixed. Example: a core test
  that builds a git history and asserts a branch's step stays.
- **Remove** a test that asserts how the code does it, such as the order of internal calls, a call
  or render count, markup, a class name, a size, or private state; a test that repeats what another
  kept test already owns; and a test of trivial code. Example: a test asserting the order of
  internal calls goes.
- **Never change production code to keep a test**, except to extract a logic rule into a pure
  function with its unit test, before the UI test that guarded it goes.
- **Every test a decision's "Checked by" names stays**, even when it would otherwise go: the
  decisions this spec did not change were not approved for edits. When the rule's test is a UI test,
  it stays as a kept UI test.
- **A judged file is cut, never rewritten**: remove tests, and the helpers only they used. Do not
  reword or merge the tests that stay.
- **Record each removed test** in this plan's [Removed tests](#removed-tests), under the task's own
  heading: its file, its name, and the behaviour it guarded, one row each; a whole file removed is
  one row.

## Code read

- [`crates/core/src/check/values.rs`](/crates/core/src/check/values.rs): `fields()` lists a record's
  fields (`kind`, `finished` required, `pull-request` optional); an unknown field is the error
  `frontmatter.unknown`. `check_plan_revision` reads a sibling file through `file.folder`, the model
  for the pairing: every record sits in `specs/done/`, so `file.folder` holds them all.
- [`crates/core/src/files/frontmatter.rs`](/crates/core/src/files/frontmatter.rs): `Value` has no
  list; a YAML list parses as `Value::Other`.
- [`crates/core/src/check/mod.rs`](/crates/core/src/check/mod.rs): `check_file` runs the record's
  checks; `ura check <file>` and the LSP keep only the target file's problems (`retain` at the
  `check_with` and `check_text` sites). `Severity::Warning` problems print as warnings.
- [`crates/core/src/check/sections.rs`](/crates/core/src/check/sections.rs): the sections of a spec,
  a record, and the other files are the embedded templates'; a section whose placeholder starts
  `[Optional` may be left out; its place is checked by `check_order`.
- [`crates/core/tests/check.rs`](/crates/core/tests/check.rs): `each_rule`'s record rows (around
  line 336), `the_example_has_no_problems`, and the example's word limit;
  [`fields.rs`](/crates/core/tests/fields.rs) asserts the record's field list;
  [`common/texts.rs`](/crates/core/tests/common/texts.rs) has `record(kind, title)`.
- [`packages/web/src/spec/parts.ts`](/packages/web/src/spec/parts.ts) `KNOWN_PARTS`,
  [`SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx) `Groups`, and
  [`SpecContents.tsx`](/packages/web/src/spec/SpecContents.tsx): an unknown section is drawn after
  the built parts, so a `## Replaced behaviour` would land after the architecture today.
- [`packages/web/vite.browser.config.ts`](/packages/web/vite.browser.config.ts), the root
  [`vite.config.ts`](/vite.config.ts) `test.projects`, [`vite.tasks.ts`](/vite.tasks.ts)
  (`browser:*` tasks, `ready:browser-*` groups), [`ci.yml`](/.github/workflows/ci.yml) (the
  `browser-phone` and `browser-desktop` jobs), and
  [`toolchain.test.ts`](/packages/server/src/__tests__/toolchain.test.ts) (the browser task, the
  binding-config list, and `browserProjects()` assertions): everything the browser runner needs.
  `playwright` also serves [`screenshots.ts`](/packages/web/scripts/screenshots.ts), so it stays,
  with the flake's Playwright variables.
- [`theme-tokens.test.ts`](/packages/web/src/__tests__/theme-tokens.test.ts): the WCAG contrast
  test, in Node, importing `contrast` from `__browser__/colours.ts`.
- [`scripts/fast-selection.ts`](/scripts/fast-selection.ts): the `ui` family's tests include
  `src/__focused__/**` and `composer-images`; its `deferred` list names the browser groups;
  [`fast-discovery.test.ts`](/scripts/__tests__/fast-discovery.test.ts) expects the focused composer
  and `composer-images` tests to be discovered.
- [`scripts/test-weights.json`](/scripts/test-weights.json): weights by `<project>:<path>`; an
  unknown key weighs 5, nothing validates the keys.
- [`packages/web/src/__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx): the whole app
  on the real server and core, against a git fixture; `links.test.ts` and `routes.test.ts` render
  the app through it.
- Validation: `nix develop -c vp run fast` after each task, `nix develop -c vp run ready` before a
  push; `nix develop -c cargo nextest run -p <crate>` for a crate's tests;
  `nix develop -c cargo run -q -p uraeda-cli -- check` for `ura check` with this branch's core (the
  installed `ura` does not know the new fields).
- Baseline, before any change: `ready` failed only on `specs:check`, a link of
  `specs/done/2026-10-13-nvim-plugin.md` to the removed nvim plugin, fixed in its own commit.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| Abstraction or exception                          | Why it is needed                                                           | Simpler alternative rejected because                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A list value in the core's frontmatter            | `supersedes` and `superseded-by` are lists of record names                 | a comma-separated text field: the spec's scenario writes a YAML list |
| The pure functions extracted in tasks 4 and 5     | the edge case asks a logic rule only a UI test guarded to keep a unit test | keeping the UI tests: the Testing decision removes them              |
| The contrast functions moved out of `__browser__` | the theme's contrast test, an outside standard, needs them                 | keeping `__browser__/colours.ts`: the folder goes                    |

## Test map

The kept tests run as today: the core's against real git repositories in temporary folders, the
server's and the web's through the real server and core, the web's in happy-dom. No test uses a real
browser after task 10. Most stories here are about how agents write tests: their check is the
evaluation of task 14, and review, not a test of this repository.

| Spec                                                                           | Task        | Test                                                                                            |
| ------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------- |
| US1 1, 2, 3, more 1, 2                                                         | 3, 14       | none here: agent behaviour, checked by the evaluation's runs and review                         |
| US2 1                                                                          | —           | none: the decisions were rewritten and approved with the spec                                   |
| US2 2                                                                          | 1, 9        | none: the finish step's wording, checked by review                                              |
| US3 1, 2, 3; edge cases: a UI test the only guard, unsaved text or a git write | 4, 5, 10–13 | the kept tests, listed in [Kept web UI tests](#kept-web-ui-tests); `theme-tokens.test.ts`       |
| US4 1, SC-005                                                                  | 9           | none: the finish step's wording, checked by the final review on this feature's own pull request |
| US4 2; SC-006; edge cases: `supersedes` names no record, superseded twice      | 2           | `crates/core/tests/check.rs`, the supersession rows of `each_rule` and their test               |
| US4 3; edge case: no gotchas                                                   | 2, 9        | `the_example_has_no_problems`, with the example's record holding a gotcha                       |
| US5 1, 2; SC-002, SC-003, SC-004, SC-008                                       | 14          | the evaluation's scores, in the record                                                          |
| SC-001                                                                         | 15          | the final review's reading of the changed tests                                                 |
| SC-007                                                                         | 3, 14       | review of the testing section                                                                   |
| Edge case: a test the spec replaces but did not list                           | 3           | none: wording, checked by review                                                                |
| Edge case: a screenshot cannot be attached                                     | 1, 9        | none: wording, from task 1's finding                                                            |
| Edge case: an open change still has `screenshots/`                             | 2           | `check.rs`'s existing change-folder rows, unchanged                                             |
| Edge case: the coherence-pass change merges first                              | —           | none: it merged before this branch started, and its tests are judged with the others            |
| Review focus: a single-file check of a record                                  | 2           | `crates/core/tests/check.rs`, the supersession test checking one record                         |
| Review focus: a decision naming a removed test                                 | 4, 5, 12    | the kept tests that decisions name                                                              |
| Review focus: the contrast test's import                                       | 10          | `theme-tokens.test.ts` passing after `__browser__` is gone                                      |
| Review focus: the fast check's discovery tests                                 | 10, 12      | `scripts/__tests__/fast-discovery.test.ts`, `fast-selection.test.ts`                            |
| The spec page draws the replaced behaviour (task 8)                            | 8           | none: a view, left to the human's review in the sandbox, as the Testing decision asks           |

### Kept web UI tests

Each `.test.tsx` of `packages/web` kept, the tests it keeps, and the cost each guards. Every other
`.test.tsx` of `src/__tests__`, `src/__browser__`, and `src/__focused__` is removed, its logic rules
first extracted (tasks 4 and 5). The browser tests' two weak candidates go with the runner: their
logic is extracted, and their wiring is left to review.

| File                                     | Tests kept                                                                                                                                                                                                                                                                          | Cost guarded                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/__focused__/composer.test.tsx`      | "a refused send reaches the endpoint, then restores its exact text, images and reason"                                                                                                                                                                                              | a refused message lost silently                                                                                 |
| `src/__tests__/editor.test.tsx`          | "Commit saves the text typed, then commits it (US2 4)"; "Commit stops when the text could not be saved"; "a save over a change made elsewhere keeps the text, and offers the new version"                                                                                           | a commit of the wrong text; a file overwritten                                                                  |
| `src/__tests__/round.test.tsx`           | "Submit saves a comment not saved yet"; "Submit stops when an answer could not be saved"; "a comment being written is not replaced by an answer changed elsewhere"; "Submit writes the edit of a comment renumbered by a removal into that comment"                                 | answers committed without the typed text, or into the wrong comment                                             |
| `src/__tests__/review.test.tsx`          | "a verdict with an open comment holding text is refused"; "Request changes during an upload is refused, and commits nothing"; "a comment restored after the reviewed commit changed is a general one"; "an edit of a review comment follows it when a comment before it is removed" | a verdict committed without a comment; a comment on the wrong lines                                             |
| `src/__tests__/leave.test.tsx`           | "a link away from unsaved text asks first; Stay keeps the page, Leave page leaves"; "Back from unsaved text asks first, the page staying while it asks"                                                                                                                             | typed text lost on navigation                                                                                   |
| `src/__tests__/new-page.test.tsx`        | "a start that answers late clears only the text and slug it sent"                                                                                                                                                                                                                   | newer typed text cleared by a late answer                                                                       |
| `src/__tests__/sign-in.test.tsx`         | "unsaved text survives a sign-out"                                                                                                                                                                                                                                                  | typed text lost when the app swaps to sign-in                                                                   |
| `src/__tests__/diagram-hostile.test.tsx` | the whole file                                                                                                                                                                                                                                                                      | a script run from a diagram: [Diagrams](/specs/decisions/diagrams.md) names it                                  |
| `src/__tests__/diagram.test.tsx`         | the tests of a diagram that fails to draw showing its source                                                                                                                                                                                                                        | the rule [Diagrams](/specs/decisions/diagrams.md) checks by "the diagram's tests"                               |
| `src/__tests__/notify.test.tsx`          | the whole file, but a render or call count                                                                                                                                                                                                                                          | the rules [Notifications](/specs/decisions/notifications.md) checks by "the notifier's tests"                   |
| `src/__tests__/preview-sandbox.test.tsx` | "the mockup embed, a story's frame, and the mockup page run scripts, never with Uraeda's origin"                                                                                                                                                                                    | a preview running with Uraeda's origin: the [Stack](/specs/decisions/stack.md) decision names the embed's tests |
| `src/__tests__/writes-store.test.tsx`    | the whole file: a pending label shown until the server's status changes, 10 seconds pass, or the write fails; overlapping writes keep it; a failed write after a status change stays gone                                                                                           | a stale git-write status after a failed write, a bug reproduced                                                 |

The test names are as the files have them today; a name that differs slightly is matched by its
meaning, and the plan is corrected in the task's commit.

### Removed tests

Each judging task adds its own heading, `#### Task N`, with a table of three columns, the file, the
test, and the behaviour it guarded: one row per removed test, or per file when a whole file goes.

#### Task 6

| File                              | Test                                           | Behaviour it guarded                                                                                                                            |
| --------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/cli/tests/status.rs`      | `a_finished_branch_waits_for_its_pull_request` | `ura status` shows a finished branch as waiting on the agent: `a_finished_branch_without_gh_has_its_pull_request_unknown` asserts the whole row |
| `crates/cli/tests/review.rs`      | `comments_add_up`                              | a second comment is numbered C2 after C1: `a_pending_review_survives_an_unrelated_commit` asserts both comments and their numbers               |
| `crates/cli/src/upgrade.rs`       | `the_latest_release_installs_nothing`          | `newer` is false for the same version: trivial code, a `!=`                                                                                     |
| `crates/cli/src/install.rs`       | `answer_lines`                                 | the text of the two lines echoing a picker's answers: trivial formatting                                                                        |
| `crates/cli/src/picker.rs`        | `nothing_checked_warns_until_space`            | the picker's private `warning` flag, set on Enter with nothing checked and cleared by space                                                     |
| `crates/cli/src/picker.rs`        | `draws_the_scope_picker`                       | the exact screen text of the scope picker: wording and layout, left to the human's use                                                          |
| `crates/cli/src/picker.rs`        | `draws_the_folder_picker`                      | the exact screen text of the folder picker: wording and layout                                                                                  |
| `crates/cli/src/picker.rs`        | `draws_nothing_checked`                        | the exact screen text of the folder picker with nothing checked: wording and layout                                                             |
| `crates/cli/src/picker.rs`        | `draws_the_init_question`                      | the exact screen text of `ura init`'s question: wording and layout                                                                              |
| `crates/cli/src/picker.rs`        | `the_cursor_reads_without_colour`              | the foreground colour of the picker's cells, with and without colours: the look                                                                 |
| `crates/lsp/tests/diagnostics.rs` | `a_changed_risk_tier_gives_one_diagnostic`     | a changed `risk-tier` gives one diagnostic, on line 4, with its message: `an_unsaved_change_shows_its_problem` asserts the same and more        |

#### Task 7

| File                                                    | Test                                                                                | Behaviour it guarded                                                                                                                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/runner/__tests__/sessions.test.ts` | a turn's messages are forgotten once it ended and none waits to be read             | Private bookkeeping read through `sessions.tracked()`; "a message of a turn that ended is refused as read" keeps what a caller sees                                                    |
| `packages/server/src/runner/__tests__/sessions.test.ts` | US1.6: a feature's writes are refused while its turn runs                           | That `working(repo)` lists the feature during a turn; kept queueing tests assert `working()` too                                                                                       |
| `packages/server/src/runner/__tests__/sessions.test.ts` | a session is forgotten once its process exited with nothing left to run             | Private state read through `sessions.held()`; the idle close and the resume are kept by US1.7 and C1                                                                                   |
| `packages/server/src/runner/__tests__/sessions.test.ts` | US3 more 3: the rules end with their process                                        | An allow rule dying with its process: duplicate of "US5.3: the rule ends with its process"                                                                                             |
| `packages/server/src/runner/__tests__/cache.test.ts`    | a chat has no folder, and many are allowed                                          | A chat session's null folder: trivial, and other kept tests use chats                                                                                                                  |
| `packages/server/src/runner/__tests__/claude.test.ts`   | Claude Code declares what it can do                                                 | The adapter's kind, name and capabilities constant: trivial                                                                                                                            |
| `packages/server/src/runner/__tests__/claude.test.ts`   | a result line's cost and models reach the result event                              | Cost and models on the result event: owned by `result-usage.jsonl` in "the lines of %s"                                                                                                |
| `packages/server/src/runner/__tests__/claude.test.ts`   | a result with no cost or models keeps both fields absent                            | Absent cost and models on a bare result: owned by the exact rows of "%s sends no tokens, which would reset the baseline"                                                               |
| `packages/server/src/runner/__tests__/fake.test.ts`     | capabilities, availability, and the allow rule                                      | The test double's own name, capabilities, version and rule: trivial                                                                                                                    |
| `packages/server/src/runner/__tests__/fake.test.ts`     | a message sent after the exit plays no fallback                                     | The fake's private fallback call count after an exit                                                                                                                                   |
| `packages/server/src/runner/__tests__/fake.test.ts`     | awaited steps leave no listener on the signal they were given                       | The number of abort listeners inside the test double                                                                                                                                   |
| `packages/server/src/runner/__tests__/message.test.ts`  | the message does not say what the human did                                         | No "the human" in the run message: the exact-string run-message test owns it                                                                                                           |
| `packages/server/src/runner/__tests__/moves.test.ts`    | the opening tells to merge by hand                                                  | One sentence of the opening: the exact-string "the opening names the files the session edited" owns it                                                                                 |
| `packages/server/src/__tests__/decisions-check.test.ts` | both messages name the reference and a waiting stop                                 | Substring wording of two round-message constants                                                                                                                                       |
| `packages/server/src/__tests__/attach.test.ts`          | refuses an upload while the feature's agent works                                   | Upload refused while the agent works: "refuses an upload to a working feature, or without a target, before reading the body" owns the status and message                               |
| `packages/server/src/__tests__/env.test.ts`             | --no-open, --new-key, --help, and --version                                         | Flag-to-boolean parsing: trivial                                                                                                                                                       |
| `packages/server/src/__tests__/guard.test.ts`           | a host name added or removed applies to the next check                              | Host names read at each check: `allowed-hosts.test.ts` owns it through the real server and a settings reload                                                                           |
| `packages/server/src/__tests__/inbox.test.ts`           | a delete's removed text is the file as it was                                       | Text a category delete returns: asserted by "a category is added, renamed, and deleted, and a delete's removed text restores the file"                                                 |
| `packages/server/src/__tests__/live.test.ts`            | a repository is watched once, until it leaves the list                              | The count of `binding.watch` calls through a counting wrapper: how, not what                                                                                                           |
| `packages/server/src/__tests__/live.test.ts`            | review focus 10: a cleanup that fails is logged, and the server starts all the same | A mocked `ChatImages.clean` failing, with a stderr spy and a call count                                                                                                                |
| `packages/server/src/__tests__/main.test.ts`            | a second start hands its repository to the running server and exits 0               | The hand-over's output and exit code: asserted by "a second start hands over with the host token, and signs its browser in" and "a second start during the first's start waits for it" |
| `packages/server/src/__tests__/main.test.ts`            | the help names --new-key                                                            | One line of the help text, which "--help prints the options and exits 0" compares in full                                                                                              |
| `packages/server/src/__tests__/preview.test.ts`         | a view gives the runner the commit with the stamp taken before it was read          | Spies on `Previews.prototype.view` and `read`: private argument wiring                                                                                                                 |
| `packages/server/src/__tests__/repositories.test.ts`    | a missing repository's host starts without a watch                                  | A mocked `watch` never being called; the host's `missing` flag is kept by the moved-away tests                                                                                         |
| `packages/server/src/__tests__/repositories.test.ts`    | an invalid list keeps the hosts, with its problem                                   | Duplicate of "an invalid list on disk keeps the hosts, reports the problem, and refuses adding"                                                                                        |
| `packages/server/src/__tests__/server.test.ts`          | stopping closes the hosts and the session manager                                   | Spies on `close` and `closeAll`: internal calls                                                                                                                                        |
| `packages/server/src/__tests__/server.test.ts`          | the server sweeps its Storybooks every minute                                       | A spy on `sweep` under fake timers; the idle stop is kept by the SC-005 preview test                                                                                                   |
| `packages/server/src/__tests__/server.test.ts`          | the server ends unused sessions every minute                                        | A spy on `SignInStore.prototype.sweep` under fake timers: an interval's call count                                                                                                     |
| `packages/server/src/__tests__/settings.test.ts`        | the host names keep their array while a read changes nothing                        | Array identity kept for the guard's rebuild: private state                                                                                                                             |
| `packages/server/src/__tests__/settings-fate.test.ts`   | a change sends one update on the global bus and the repository's                    | A spy on `reload` and exact `update` call counts; "a hand edit of the file sends the update" stays                                                                                     |
| `packages/server/src/__tests__/settings-watch.test.ts`  | a burst of writes is read once                                                      | The count of the binding's `readSettings` calls under fake timers: how the debounce works                                                                                              |
| `packages/server/src/__tests__/stack.test.ts`           | under a coarse pointer, Astryx's elements are 44 px tall                            | A size in the built CSS, left to the human's review; no decision names the test                                                                                                        |
| `packages/server/src/preview/__tests__/runner.test.ts`  | a state change is told                                                              | The runner's `onChange` callback firing on starting, ready, and stopped; the server's live "ready" update test keeps the observable result                                             |

#### Task 10

All of them run in a real WebKit browser, so
[R2](rulings.md#r2-the-browser-runner-goes-with-its-two-weakest-candidates) removes the runner with
them. `sandbox-pick.test.tsx`'s rule is owned by the unit tests
([R6](rulings.md#r6-the-unit-tests-own-the-sandbox-rule-on-a-picks-text-with-the-pick-scripts-cases)),
and layout, look, and wiring are left to the human's review of the UI.

| File                                                                                        | Test                                                                                                                                                 | Behaviour it guarded                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/web/src/__browser__/attach.test.tsx`                                              | the whole file                                                                                                                                       | Images dropped on or pasted into the editor, comments, answers, and notes are saved by the core and linked at the cursor, a chat's unread images dimmed (image attachments' US1, US3, US4)                                                 |
| `packages/web/src/__browser__/blocks.test.tsx`                                              | the whole file                                                                                                                                       | A table wider than its region scrolls sideways in its own region, never the page, and keeps its links, at both sizes                                                                                                                       |
| `packages/web/src/__browser__/card-drag.test.tsx`                                           | the whole file                                                                                                                                       | A card drags from anywhere only past 5 px of a mouse press; a shorter press opens it; a drag never opens the card it ends on                                                                                                               |
| `packages/web/src/__browser__/card-menu.test.tsx`                                           | the whole file                                                                                                                                       | Each card's menu does what its pane does, by tap and keyboard; a running priority offers no move or Delete; a press on the menu never drags                                                                                                |
| `packages/web/src/__browser__/change.test.tsx`                                              | the whole file                                                                                                                                       | A change's session has the session's column, its branch's files, no plan progress, a "Change" tag, and passes the UI checks                                                                                                                |
| `packages/web/src/__browser__/column-session.test.tsx`                                      | the whole file                                                                                                                                       | The round's Session column draws the feature's session, its transcript follows its end, Back to the round keeps its place                                                                                                                  |
| `packages/web/src/__browser__/decisions.test.tsx`                                           | the whole file                                                                                                                                       | The decisions page's keys, Escape back to the constitution, a list of 30% of the window, and the `/` palette's preview                                                                                                                     |
| `packages/web/src/__browser__/detail-overlay.test.tsx`                                      | the whole file                                                                                                                                       | A card opens in an overlay over its still-mounted page; Back closes it in one press; Previous and Next add no history entry                                                                                                                |
| `packages/web/src/__browser__/diagram.test.tsx`                                             | the whole file                                                                                                                                       | A `mermaid` block draws in the page's colours, a bad one shows its source, a wide one scrolls inside its card, and `pele` loads only with a diagram                                                                                        |
| `packages/web/src/__browser__/document-column.test.tsx`                                     | the whole file                                                                                                                                       | The document column keeps one width across tabs, a dragged width for every document, WAI-ARIA tabs with arrows, keyboard scrolling of split panels                                                                                         |
| `packages/web/src/__browser__/document-lists.test.tsx`                                      | the whole file                                                                                                                                       | A list's marker hangs in the margin on the phone and a nested list is one character in; markers stay whole on their item's first line                                                                                                      |
| `packages/web/src/__browser__/feature.test.tsx`                                             | the whole file                                                                                                                                       | The feature page at both sizes: "Next" with the sessions column, and the layout checks in both themes                                                                                                                                      |
| `packages/web/src/__browser__/fields.test.tsx`                                              | the whole file                                                                                                                                       | Each multi-line field has its kind's fixed height, scrolls past it, never moves the layout, and still resizes                                                                                                                              |
| `packages/web/src/__browser__/home.test.tsx`                                                | the whole file                                                                                                                                       | Home keeps two columns at half a screen, one on the phone in the same order, and passes the layout checks                                                                                                                                  |
| `packages/web/src/__browser__/inbox-panes.test.tsx`                                         | the whole file                                                                                                                                       | The inbox as a pane per category: purpose line, empty pane, "New category", renaming in place, and a delete asking "Delete the N notes too?"                                                                                               |
| `packages/web/src/__browser__/inbox.test.tsx`                                               | the whole file                                                                                                                                       | A note added from the sidebar's plus in a dialog or a bottom sheet, the inbox page full and empty, the triage's banner and answering view                                                                                                  |
| `packages/web/src/__browser__/layout.test.tsx`                                              | the whole file                                                                                                                                       | The UI checks decision on every page at both sizes in light and dark: no cut text, no sideways scroll, 19 px paragraphs, 44 px controls under touch, line measure, left alignment, axe, and width changes keeping typed text               |
| `packages/web/src/__browser__/leave.test.tsx`                                               | the whole file                                                                                                                                       | Back from a page with unsaved text puts it back and asks; "Leave page" goes back, in a real browser's history                                                                                                                              |
| `packages/web/src/__browser__/ledger.test.tsx`                                              | the whole file                                                                                                                                       | The spec ledger's colours by kind (new, changed, removed), removed words struck, and a fit to the phone's screen                                                                                                                           |
| `packages/web/src/__browser__/list-keys.test.tsx`                                           | the whole file                                                                                                                                       | The list's keys between columns (`j k`, `h l`, arrows, Enter) move the selection and open nothing but on Enter                                                                                                                             |
| `packages/web/src/__browser__/lists.test.tsx`                                               | the whole file                                                                                                                                       | The shared list moves its selection by keyboard, opens on Enter and closes on Escape, and ignores keys while a field, selector, menu, or dialog has the focus                                                                              |
| `packages/web/src/__browser__/live-window.test.tsx`                                         | the whole file                                                                                                                                       | A story or HTML mockup draws in a titled live window at a scaled or 100% width, in full screen, with load failures reported, fitting a 390 px screen                                                                                       |
| `packages/web/src/__browser__/new-cards.test.tsx`                                           | the whole file                                                                                                                                       | The New page's three cards side by side on wide screens and stacked on the phone, and the picked kind's form after them                                                                                                                    |
| `packages/web/src/__browser__/new-change.test.tsx`                                          | the whole file                                                                                                                                       | The sidebar's "New" with Change starts a change and its agent in two clicks and the typing; Start disabled while empty, a taken name refused with its text kept                                                                            |
| `packages/web/src/__browser__/offer-card.test.tsx`                                          | the whole file                                                                                                                                       | A session opened at its end keeps its end in view, with the agent's offer card's buttons above the composer                                                                                                                                |
| `packages/web/src/__browser__/offline.test.tsx`                                             | the whole file                                                                                                                                       | The home draws in its bundled fonts with no request to another host                                                                                                                                                                        |
| `packages/web/src/__browser__/overlay.test.tsx`                                             | the whole file                                                                                                                                       | Short forms are bottom sheets on narrow screens and dialogs on wide ones                                                                                                                                                                   |
| `packages/web/src/__browser__/palette-check.test.tsx`                                       | the whole file                                                                                                                                       | Astryx's `CommandPalette` reports the highlighted item through its public context, which the decisions palette's preview relies on                                                                                                         |
| `packages/web/src/__browser__/plan.test.tsx`                                                | the whole file                                                                                                                                       | A plan read as it is lays its text out as the same plan waiting for review does                                                                                                                                                            |
| `packages/web/src/__browser__/priorities-columns.test.tsx`                                  | the whole file                                                                                                                                       | The priorities as titled panes in one scrolling row, stacked on the phone, each with its context                                                                                                                                           |
| `packages/web/src/__browser__/priorities.test.tsx`                                          | the whole file                                                                                                                                       | Dragging priority cards with a mouse and a finger, a cancelled drag, and committing closing the toasts                                                                                                                                     |
| `packages/web/src/__browser__/prose-font.test.tsx`                                          | the whole file                                                                                                                                       | A reading block is set in the reading font while its controls keep the UI's monospace font                                                                                                                                                 |
| `packages/web/src/__browser__/reading-place.test.tsx`                                       | the whole file                                                                                                                                       | Saving a comment, and a story frame that grows above the screen, never move the text read                                                                                                                                                  |
| `packages/web/src/__browser__/repositories.test.tsx`                                        | the whole file                                                                                                                                       | The repository menu and the add form as a popover and a dialog on wide screens, bottom sheets on narrow ones, closed by Back, passing the layout checks                                                                                    |
| `packages/web/src/__browser__/review.test.tsx`                                              | the whole file                                                                                                                                       | On the phone the comment sheet opens with the selected block in view and quotes its lines; a spec's folds survive Back                                                                                                                     |
| `packages/web/src/__browser__/round-cards.test.tsx`                                         | the whole file                                                                                                                                       | The round's two-column ratio, the follow-up's joint and indent, the sticky card header, the options' focus ring, and the phone's widths                                                                                                    |
| `packages/web/src/__browser__/round-column.test.tsx`                                        | the whole file                                                                                                                                       | The round's column is a third of the window; asking or switching tabs moves no card; the outline marks the top part; folding with `]` widens the round; axe passes                                                                         |
| `packages/web/src/__browser__/round-parts.test.tsx`                                         | the whole file                                                                                                                                       | On the phone the round's panes keep only their titled top border and the page's text edge; the desktop keeps borders and inset                                                                                                             |
| `packages/web/src/__browser__/round.test.tsx`                                               | the whole file                                                                                                                                       | The round's outline beside the questions, `n` and `p` between blank questions, Back to the same question, 600 px questions at 1200 px, a card per question                                                                                 |
| `packages/web/src/__browser__/sandbox-pick.test.tsx`                                        | the whole file                                                                                                                                       | The sandbox's pick script picks the clicked element inside open dialogs, sheets, and popovers, or the focused one on Enter or Space, naming its source and HTML (R6: `pickText.test.ts` and `storybook-pick.test.ts` own the rule's logic) |
| `packages/web/src/__browser__/scroll-target.test.tsx`                                       | the whole file                                                                                                                                       | An address naming a section scrolls to it whole, below the phone's tabs, under the pane's title                                                                                                                                            |
| `packages/web/src/__browser__/scroll.test.tsx`                                              | the whole file                                                                                                                                       | Back returns to the same scroll position; a page keeps its content while its data reloads; the position survives a reload                                                                                                                  |
| `packages/web/src/__browser__/session-column.test.tsx`                                      | the whole file                                                                                                                                       | The session's column widths (a third, 300 px semi-wide, 400 px for a document's), its resize, `]` fold, phone sheet, drag along its edge, and eased fold                                                                                   |
| `packages/web/src/__browser__/session-look.test.tsx`                                        | the whole file                                                                                                                                       | The human's messages in a filled bubble and the agent's text flat; the composer's height per width class; "Jump to the latest" and "Allow all"                                                                                             |
| `packages/web/src/__browser__/session-tail.test.tsx`                                        | the whole file                                                                                                                                       | "Show earlier messages" keeps the message read where it is; Back draws as many messages as were shown at the same position                                                                                                                 |
| `packages/web/src/__browser__/session.test.tsx`                                             | the whole file                                                                                                                                       | A session opens as its own page, its transcript follows its end, Back restores the position, the column turns into the status line across 768 px, "Jump to the latest" works                                                               |
| `packages/web/src/__browser__/shell-checks.test.tsx`                                        | the whole file                                                                                                                                       | The folded rail, the feature settings, and the notify banner pass the UI checks at both sizes in both themes                                                                                                                               |
| `packages/web/src/__browser__/shell.test.tsx`                                               | the whole file                                                                                                                                       | The shell's column at three widths: resized between 220 and 480 px and kept, a rail that opens over the page, and the column's return past 1280 px                                                                                         |
| `packages/web/src/__browser__/sidebar.test.tsx`                                             | the whole file                                                                                                                                       | The sidebar folds to its rail by a button and `[`, resizes with its width kept, the phone's tabs start with Home, and done items fill the room                                                                                             |
| `packages/web/src/__browser__/sign-in.test.tsx`                                             | the whole file                                                                                                                                       | The sign-in screen, its wrong-key error, the Sign-in settings and the "Sign out everywhere" dialog pass the layout checks                                                                                                                  |
| `packages/web/src/__browser__/sizes-helper.test.tsx`                                        | the whole file                                                                                                                                       | `atSize` skips a test of the other size before any hook runs                                                                                                                                                                               |
| `packages/web/src/__browser__/sizes.test.tsx`                                               | the whole file                                                                                                                                       | Text and controls follow the width from the theme's tokens                                                                                                                                                                                 |
| `packages/web/src/__browser__/spec-column.test.tsx`                                         | the whole file                                                                                                                                       | The spec's column is 480 px at 1440 px, switching tabs moves no pane, folding grows a live window, axe passes                                                                                                                              |
| `packages/web/src/__browser__/spec-parts.test.tsx`                                          | the whole file                                                                                                                                       | The architecture, edge cases, and criteria fit the screen; the data model's changes show as green, yellow, and red pills                                                                                                                   |
| `packages/web/src/__browser__/spec.test.tsx`                                                | the whole file                                                                                                                                       | The spec page's titled panes take the page's width on the phone, keep their measure, a link to a part opens at it, and the page is accessible                                                                                              |
| `packages/web/src/__browser__/status-line-room.test.tsx`                                    | the whole file                                                                                                                                       | On a semi-wide window the status line's hints give way to the counts, which stay whole on one line                                                                                                                                         |
| `packages/web/src/__browser__/status-line.test.tsx`                                         | the whole file                                                                                                                                       | The fixed status line covers nothing the page keeps in view at its bottom, and nothing runs past the window at 320 px                                                                                                                      |
| `packages/web/src/__browser__/story-chat.test.tsx`                                          | the whole file                                                                                                                                       | A story link alone in a paragraph shows the story live in a session and a chat, a comment on it goes to the composer unsent, and one in a sentence opens its page                                                                          |
| `packages/web/src/__browser__/story-comments.test.tsx`                                      | the whole file                                                                                                                                       | Pick mode and comments on an embedded story write a comment naming the story and element on the embed's line; Escape ends pick mode; messages from other windows                                                                           |
| `packages/web/src/__browser__/story-embed.test.tsx`                                         | the whole file                                                                                                                                       | A story link alone in its paragraph shows the story live in one frame at the desktop's or phone's width, in full screen, in Uraeda's colour mode, through a listed host, with failed start and missing story states                        |
| `packages/web/src/__browser__/story-variants.test.tsx`                                      | the whole file                                                                                                                                       | A round's visual question shows each option's story; a comment on a variant's picked element joins the answer on its own line, keeping the saved comment and leaving the typed one unsaved; a removed variant says so                      |
| `packages/web/src/__browser__/task.test.tsx`                                                | the whole file                                                                                                                                       | On a wide screen the task view opens in an overlay over home, which stays drawn; Back closes it                                                                                                                                            |
| `packages/web/src/__browser__/titled-pane.test.tsx`                                         | the whole file                                                                                                                                       | A folding pane's title button is finger-sized, centred on the pane's top border, and clear of what is above                                                                                                                                |
| `packages/web/src/__browser__/usage.test.tsx`                                               | the whole file                                                                                                                                       | The five-hour allowance in the status line updates live in light and dark                                                                                                                                                                  |
| `packages/web/src/__browser__/helpers.tsx`, `setup.ts`, `forwarding-proxy.ts`, `colours.ts` | the browser tests' helpers (`contrast` and `luminance` moved to `packages/web/src/theme/contrast.ts`)                                                | Rendering, layout checks, axe, and colour maths shared by the browser tests: they go with the tests that used them                                                                                                                         |
| `packages/web/vite.browser.config.ts`, `vite.browser.color-scheme.ts`                       | the browser project (`phone` and `desktop`) and its colour-scheme plugin                                                                             | The runner: WebKit through Playwright at two sizes, in light and dark; R2 removes it                                                                                                                                                       |
| `packages/server/src/__tests__/toolchain.test.ts`                                           | the browser projects are the browser config's instances                                                                                              | the browser runner's projects matched its instances: the runner is gone                                                                                                                                                                    |
| `packages/server/src/__tests__/toolchain.test.ts`                                           | the rows "a browser task without the lock" and "a browser config on Vitest's port", with `unlockedBrowsers`, `defaultBrowserPort`, `browserProjects` | the browser tasks took the browser lock and their own port: the runner is gone                                                                                                                                                             |
| `packages/server/src/__tests__/toolchain.test.ts`                                           | the `browser:phone` and `browser:desktop` rows of "%s invalidates on native binding changes"                                                         | the browser tasks reran on a new binding: the tasks are gone; `ts:test`'s row stays                                                                                                                                                        |
| `packages/server/src/__tests__/toolchain.test.ts`                                           | a project added to test.projects is run by a task selecting the others by exclusion                                                                  | `ts:test` ran every project but the browser's: renamed, as `ts:test` now runs every project                                                                                                                                                |
| `scripts/__tests__/fast-selection.test.ts`                                                  | "browser phone/desktop" in the deferred checks' assertion                                                                                            | the fast check named the browser groups it left to `ready`: they are gone                                                                                                                                                                  |

#### Task 11

| File                                   | Test                                            | Behaviour it guarded                                                                                                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/core/tests/check.rs`           | `the_rounds_template_has_no_problems`           | The round template, its `#topic` placeholders pointed at the example, checks clean in the example: `every_fixture_round_passes` runs the same write and filter on the template and asserts no problems, under its "template" label                                               |
| `crates/core/tests/check.rs`           | `an_awaiting_triage_has_no_problems`            | The fixture `INBOX-TRIAGE.md` checks clean at `specs/INBOX-TRIAGE.md`: `every_fixture_round_passes` loops over that same fixture and the skill's template                                                                                                                        |
| `crates/core/tests/check.rs`           | `each_rule` row "edge case importance"          | The message "importance is high, normal, or niche": `an_edge_case_of_unknown_importance` asserts the exact summary, the rule `edges.importance`, and the severity                                                                                                                |
| `crates/core/tests/check.rs`           | `each_rule` row "spec length"                   | The warning at 3,100 reviewed words on a waiting spec: `a_long_waiting_spec_is_reported` asserts the same string, the word count, and the rule `spec.length`                                                                                                                     |
| `crates/core/tests/check.rs`           | `each_rule` row "spec block items"              | The warning "the block has 8 items: keep at most 7" on a spec: `a_spec_block_of_8_items` asserts the same message and the rule `block.items`                                                                                                                                     |
| `crates/core/tests/check.rs`           | `each_rule` row "decision rules"                | The warning "12 rules: keep at most 10, or split the topic": `a_decision_of_12_rules` asserts the same, and that 10 rules do not warn                                                                                                                                            |
| `crates/core/tests/check.rs`           | `each_rule` row "decision order"                | "a MUST rule after a SHOULD one: put the strongest first": the SHOULD-then-MUST case of `a_must_after_a_should` asserts the same message                                                                                                                                         |
| `crates/core/tests/decision_change.rs` | `a_renamed_decision_is_one_removed_and_one_new` | A rename is a removed decision plus a new one, both compared: `a_renamed_decision_is_removed_and_new` asserts the same kinds through a real `git mv`, and `a_new_decision_has_every_part_added` and `a_removed_decision_has_every_part_removed_with_its_old_lines` own each side |
| `crates/core/tests/settings.rs`        | `removes_the_first_of_two_names`                | Removing the first of two allowed host names leaves the second: `removing_a_name_takes_its_comments_with_it` removes `a.ts.net`, the first of two, in its `TWO` row and checks the file text                                                                                     |
| `crates/core/tests/steps.rs`           | `implementation_names_the_first_unchecked_task` | The implementation step names the first unchecked task: `implementation_progress` asserts `step.task` on every row, including tasks finished out of order                                                                                                                        |
| `crates/core/tests/watch.rs`           | `a_burst_of_writes_is_reported_together`        | Ten writes 10 ms apart arrive in at most 3 reports: how the debounce works, not what a caller sees, and it depended on elapsed time (same ruling as the settings-watch debounce test of task 7)                                                                                  |

#### Task 12

The kept tests are those of [Kept web UI tests](#kept-web-ui-tests). `notify.test.tsx` loses
nothing: none of its tests counts renders or calls alone, and the `asked` assertions say what the
browser was asked (R3). `diagram.test.tsx` and `diagram-hostile.test.tsx` lose nothing.
`links.test.ts` and `routes.test.ts` keep their pure rows of `pathLink`, `parseRoute`,
`parseLocation`, `repoPath`, and `sessionPath`.

| File                                                          | Test                                                                                                                                                        | Behaviour it guarded                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/web/src/__focused__/composer.test.tsx`              | a custom send stays pending once, keeps a refused draft, and clears only images on success                                                                  | A custom send stays pending once, keeps a refused draft, and clears only images on success: the composer's wiring, left to the human's use of the page: the kept one owns a refused message lost silently                                                                                                  |
| `packages/web/src/__focused__/composer.test.tsx`              | an upload in progress blocks Send and Ctrl+Enter until it is saved                                                                                          | An upload in progress blocks Send and Ctrl+Enter until it is saved: the composer's wiring, left to the human's use of the page: the kept one owns a refused message lost silently                                                                                                                          |
| `packages/web/src/__focused__/composer.test.tsx`              | a workflow's message is sent without the draft's images, which stay for the next one                                                                        | A workflow's message is sent without the draft's images, which stay for the next one: the composer's wiring, left to the human's use of the page: the kept one owns a refused message lost silently                                                                                                        |
| `packages/web/src/__focused__/composer.test.tsx`              | a thumbnail removed while saved stays removed, and its saved file is deleted                                                                                | A thumbnail removed while saved stays removed, and its saved file is deleted: the composer's wiring, left to the human's use of the page: the kept one owns a refused message lost silently                                                                                                                |
| `packages/web/src/__tests__/editor.test.tsx`                  | Draft turns a line into a draft, linked, and opens its editor                                                                                               | Draft turns a line into a draft, linked, and opens its editor: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                        |
| `packages/web/src/__tests__/editor.test.tsx`                  | Draft is refused once the priorities changed elsewhere                                                                                                      | Draft is refused once the priorities changed elsewhere: a race with a change made elsewhere, left without a test at the `early` stage; the kept three own the closest cases                                                                                                                                |
| `packages/web/src/__tests__/editor.test.tsx`                  | a new draft shows its hints, which are not in the file (US5 3)                                                                                              | A new draft shows its hints, which are not in the file (US5 3): the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                       |
| `packages/web/src/__tests__/editor.test.tsx`                  | a written proposal opens drawn, with Edit (US5 5)                                                                                                           | A written proposal opens drawn, with Edit (US5 5): the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                                    |
| `packages/web/src/__tests__/editor.test.tsx`                  | a draft is saved as typed, byte for byte                                                                                                                    | A draft is saved as typed, byte for byte: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                                             |
| `packages/web/src/__tests__/editor.test.tsx`                  | the discovery effort is set in the proposal's frontmatter                                                                                                   | The discovery effort is set in the proposal's frontmatter: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                            |
| `packages/web/src/__tests__/editor.test.tsx`                  | quick discovery changes and Commit all land, in order                                                                                                       | Quick discovery changes and Commit all land, in order: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                                |
| `packages/web/src/__tests__/editor.test.tsx`                  | the text box starts at the proposal's title, and saving keeps its frontmatter                                                                               | The text box starts at the proposal's title, and saving keeps its frontmatter: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                        |
| `packages/web/src/__tests__/editor.test.tsx`                  | an unsaved text kept with its frontmatter shows without it, and saves once                                                                                  | An unsaved text kept with its frontmatter shows without it, and saves once: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                           |
| `packages/web/src/__tests__/editor.test.tsx`                  | the discovery control sets the frontmatter, and the text box keeps its text                                                                                 | The discovery control sets the frontmatter, and the text box keeps its text: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                          |
| `packages/web/src/__tests__/editor.test.tsx`                  | a save over a change made elsewhere is refused, its frontmatter joined back                                                                                 | a save over a change made elsewhere is refused, its frontmatter joined back: a race with a change made elsewhere, left without a test at the `early` stage; the kept three own the closest cases                                                                                                           |
| `packages/web/src/__tests__/editor.test.tsx`                  | a draft is committed with the priorities it changed                                                                                                         | A draft is committed with the priorities it changed: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                                  |
| `packages/web/src/__tests__/editor.test.tsx`                  | a draft changed elsewhere shows when the page reads again                                                                                                   | A draft changed elsewhere shows when the page reads again: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                            |
| `packages/web/src/__tests__/editor.test.tsx`                  | the text changed is not saved as time passes, and says so (US2 3)                                                                                           | The text changed is not saved as time passes, and says so (US2 3): the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                    |
| `packages/web/src/__tests__/editor.test.tsx`                  | Save and Ctrl+Enter save the text, and Save waits for a change                                                                                              | Save and Ctrl+Enter save the text, and Save waits for a change: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                       |
| `packages/web/src/__tests__/editor.test.tsx`                  | the editor's unsaved text is restored after a reload, with the notice                                                                                       | the editor's unsaved text is restored after a reload, with the notice: typed text restored after a reload, left without a test at the `early` stage; the kept three own the closest cases                                                                                                                  |
| `packages/web/src/__tests__/editor.test.tsx`                  | the slug typed is restored after a reload, and on the line's page                                                                                           | the slug typed is restored after a reload, and on the line's page: typed text restored after a reload, left without a test at the `early` stage; the kept three own the closest cases                                                                                                                      |
| `packages/web/src/__tests__/editor.test.tsx`                  | Start turns a draft into a feature in its own worktree                                                                                                      | Start turns a draft into a feature in its own worktree: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                               |
| `packages/web/src/__tests__/editor.test.tsx`                  | a draft with the template's placeholders starts                                                                                                             | A draft with the template's placeholders starts: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                                      |
| `packages/web/src/__tests__/editor.test.tsx`                  | Load the new version loads it                                                                                                                               | Load the new version loads it: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                                                        |
| `packages/web/src/__tests__/editor.test.tsx`                  | a draft that gets an image opens at its folder's proposal                                                                                                   | A draft that gets an image opens at its folder's proposal: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                            |
| `packages/web/src/__tests__/editor.test.tsx`                  | a file over 20 MB is refused before it is uploaded                                                                                                          | A file over 20 MB is refused before it is uploaded: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                                   |
| `packages/web/src/__tests__/editor.test.tsx`                  | a file changed elsewhere during an upload is a conflict, not overwritten                                                                                    | a file changed elsewhere during an upload is a conflict, not overwritten: a race with a change made elsewhere, left without a test at the `early` stage; the kept three own the closest cases                                                                                                              |
| `packages/web/src/__tests__/editor.test.tsx`                  | images added during an upload to a single-file draft all go to its new folder                                                                               | Images added during an upload to a single-file draft all go to its new folder: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                        |
| `packages/web/src/__tests__/editor.test.tsx`                  | the editor keeps its draft while the images upload, though it moved                                                                                         | The editor keeps its draft while the images upload, though it moved: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                  |
| `packages/web/src/__tests__/editor.test.tsx`                  | an upload that ends after the page was left saves its link, where it moved                                                                                  | An upload that ends after the page was left saves its link, where it moved: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                           |
| `packages/web/src/__tests__/editor.test.tsx`                  | a draft with a frontmatter that gets an image keeps it, and its box starts at the title                                                                     | A draft with a frontmatter that gets an image keeps it, and its box starts at the title: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                              |
| `packages/web/src/__tests__/editor.test.tsx`                  | an upload ending after the page was left keeps the moved draft's frontmatter                                                                                | An upload ending after the page was left keeps the moved draft's frontmatter: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                         |
| `packages/web/src/__tests__/editor.test.tsx`                  | typing during an upload shows saving, and leaving the page asks                                                                                             | Typing during an upload shows saving, and leaving the page asks: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                      |
| `packages/web/src/__tests__/editor.test.tsx`                  | an image saves the text typed with it, and leaves nothing unsaved                                                                                           | An image saves the text typed with it, and leaves nothing unsaved: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                    |
| `packages/web/src/__tests__/editor.test.tsx`                  | an image is refused while the text is not saved, and added once reloaded                                                                                    | An image is refused while the text is not saved, and added once reloaded: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                             |
| `packages/web/src/__tests__/editor.test.tsx`                  | an upload that gets %s says so under the field                                                                                                              | An upload that gets %s says so under the field: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                                       |
| `packages/web/src/__tests__/editor.test.tsx`                  | an upload the server does not answer in time says so under the field                                                                                        | An upload the server does not answer in time says so under the field: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                 |
| `packages/web/src/__tests__/editor.test.tsx`                  | an image added while the feature's agent works is refused under the field                                                                                   | An image added while the feature's agent works is refused under the field: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                            |
| `packages/web/src/__tests__/editor.test.tsx`                  | a feature's committed proposal is edited and committed in its worktree                                                                                      | A feature's committed proposal is edited and committed in its worktree: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                               |
| `packages/web/src/__tests__/editor.test.tsx`                  | the draft's text typed in the pane opens on the editor page                                                                                                 | The draft's text typed in the pane opens on the editor page: the editor page's wiring, left to the human's use of the page: the kept three own a commit of the wrong text and an overwritten file                                                                                                          |
| `packages/web/src/__tests__/round.test.tsx`                   | a tapped option is saved as the answer                                                                                                                      | A tapped option is saved as the answer: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                             |
| `packages/web/src/__tests__/round.test.tsx`                   | several options are written B and C, then A, B and C                                                                                                        | Several options are written B and C, then A, B and C: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                               |
| `packages/web/src/__tests__/round.test.tsx`                   | a comment follows the letters                                                                                                                               | A comment follows the letters: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                                      |
| `packages/web/src/__tests__/round.test.tsx`                   | a comment alone is the answer                                                                                                                               | A comment alone is the answer: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                                      |
| `packages/web/src/__tests__/round.test.tsx`                   | an answer read back selects its letters and fills its comment                                                                                               | An answer read back selects its letters and fills its comment: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                      |
| `packages/web/src/__tests__/round.test.tsx`                   | a follow-up shows as a card of its own after its parent's once it applies                                                                                   | A follow-up shows as a card of its own after its parent's once it applies: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                          |
| `packages/web/src/__tests__/round.test.tsx`                   | tapping B again removes the follow-up's card, and the outline lists Q1 alone                                                                                | Tapping B again removes the follow-up's card, and the outline lists Q1 alone: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                       |
| `packages/web/src/__tests__/round.test.tsx`                   | a parent answered A and B shows both follow-ups after it, in letter order                                                                                   | A parent answered A and B shows both follow-ups after it, in letter order: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                          |
| `packages/web/src/__tests__/round.test.tsx`                   | B changed to C removes the follow-up's card, and keeps its answer on disk                                                                                   | B changed to C removes the follow-up's card, and keeps its answer on disk: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                          |
| `packages/web/src/__tests__/round.test.tsx`                   | an answered round's options cannot be tapped                                                                                                                | An answered round's options cannot be tapped: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                       |
| `packages/web/src/__tests__/round.test.tsx`                   | the comment field says a comment alone answers                                                                                                              | The comment field says a comment alone answers: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                     |
| `packages/web/src/__tests__/round.test.tsx`                   | a comment alone closes its follow-ups                                                                                                                       | A comment alone closes its follow-ups: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                              |
| `packages/web/src/__tests__/round.test.tsx`                   | the end of the page lists the questions left, and Submit waits for them                                                                                     | The end of the page lists the questions left, and Submit waits for them: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                            |
| `packages/web/src/__tests__/round.test.tsx`                   | a question left blank on disk with its comment typed is not left, and Submit saves it                                                                       | A question left blank on disk with its comment typed is not left, and Submit saves it: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                              |
| `packages/web/src/__tests__/round.test.tsx`                   | submitting commits the round and shows its record                                                                                                           | Submitting commits the round and shows its record: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                  |
| `packages/web/src/__tests__/round.test.tsx`                   | the notes are saved as the last line                                                                                                                        | The notes are saved as the last line: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                               |
| `packages/web/src/__tests__/round.test.tsx`                   | every question and option shows in full                                                                                                                     | Every question and option shows in full: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                            |
| `packages/web/src/__tests__/round.test.tsx`                   | an option's checkbox is named by its letter and its sentence                                                                                                | An option's checkbox is named by its letter and its sentence: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                       |
| `packages/web/src/__tests__/round.test.tsx`                   | quick saves of one answer follow each other                                                                                                                 | Quick saves of one answer follow each other: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                        |
| `packages/web/src/__tests__/round.test.tsx`                   | a refused answer keeps its text, and says why                                                                                                               | A refused answer keeps its text, and says why: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                      |
| `packages/web/src/__tests__/round.test.tsx`                   | a hook's refusal keeps the answers, and Try again commits them                                                                                              | A hook's refusal keeps the answers, and Try again commits them: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                     |
| `packages/web/src/__tests__/round.test.tsx`                   | an answer changed elsewhere shows when the page reads again                                                                                                 | An answer changed elsewhere shows when the page reads again: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                        |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit waits for the notes being typed                                                                                                                      | Submit waits for the notes being typed: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                             |
| `packages/web/src/__tests__/round.test.tsx`                   | notes changed elsewhere show when the page reads again                                                                                                      | Notes changed elsewhere show when the page reads again: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                             |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit saves a comment whose save was refused, once the page read the file again                                                                            | Submit saves a comment whose save was refused, once the page read the file again: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                   |
| `packages/web/src/__tests__/round.test.tsx`                   | the bar counts and offers Next, with no ＋ in the bar (US1 1)                                                                                               | The bar counts and offers Next, with no ＋ in the bar (US1 1): the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                      |
| `packages/web/src/__tests__/round.test.tsx`                   | Next goes to the first blank question after the one at the top, and focuses it (US1 2, 3)                                                                   | Next goes to the first blank question after the one at the top, and focuses it (US1 2, 3): the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                          |
| `packages/web/src/__tests__/round.test.tsx`                   | with nothing blank, Next becomes Submit (US1 4)                                                                                                             | With nothing blank, Next becomes Submit (US1 4): the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                    |
| `packages/web/src/__tests__/round.test.tsx`                   | the outline's sheet lists the questions with their state, and jumps (US1 5)                                                                                 | The outline's sheet lists the questions with their state, and jumps (US1 5): the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                        |
| `packages/web/src/__tests__/round.test.tsx`                   | on the phone, the round starts with its questions, before its context, and jumps                                                                            | On the phone, the round starts with its questions, before its context, and jumps: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                   |
| `packages/web/src/__tests__/round.test.tsx`                   | on wide screens, the round has one index, its column's outline                                                                                              | On wide screens, the round has one index, its column's outline: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                     |
| `packages/web/src/__tests__/round.test.tsx`                   | the round reopens where it was left (US1 9)                                                                                                                 | The round reopens where it was left (US1 9): the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                        |
| `packages/web/src/__tests__/round.test.tsx`                   | a new browser opens at the first blank question (US1 10)                                                                                                    | A new browser opens at the first blank question (US1 10): the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                           |
| `packages/web/src/__tests__/round.test.tsx`                   | a position saved in another repository does not apply                                                                                                       | A position saved in another repository does not apply: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                              |
| `packages/web/src/__tests__/round.test.tsx`                   | a new browser opens a round not started at its top, on its intro                                                                                            | A new browser opens a round not started at its top, on its intro: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                   |
| `packages/web/src/__tests__/round.test.tsx`                   | a saved position on a question that no longer applies falls back                                                                                            | A saved position on a question that no longer applies falls back: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                   |
| `packages/web/src/__tests__/round.test.tsx`                   | without storage, the round opens at the first blank question                                                                                                | Without storage, the round opens at the first blank question: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                       |
| `packages/web/src/__tests__/round.test.tsx`                   | US6.2: a question's Ask the agent quotes its title                                                                                                          | US6.2: a question's Ask the agent quotes its title: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                 |
| `packages/web/src/__tests__/round.test.tsx`                   | without the agent, a question offers no Ask the agent                                                                                                       | Without the agent, a question offers no Ask the agent: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                              |
| `packages/web/src/__tests__/round.test.tsx`                   | an option's image is part of the option's toggle                                                                                                            | An option's image is part of the option's toggle: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                   |
| `packages/web/src/__tests__/round.test.tsx`                   | each Add image names its field, and shows Add image                                                                                                         | Each Add image names its field, and shows Add image: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                |
| `packages/web/src/__tests__/round.test.tsx`                   | Add image on an answer links the image in its comment, saved at once                                                                                        | Add image on an answer links the image in its comment, saved at once: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                               |
| `packages/web/src/__tests__/round.test.tsx`                   | Add image on the notes links the image at their end, saved                                                                                                  | Add image on the notes links the image at their end, saved: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                         |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit during an answer's upload commits the round with the image                                                                                           | Submit during an answer's upload commits the round with the image: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                  |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit waits for the image of a follow-up that stopped applying during its upload                                                                           | Submit waits for the image of a follow-up that stopped applying during its upload: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                  |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit does not save again an answer saved for its image                                                                                                    | Submit does not save again an answer saved for its image: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                           |
| `packages/web/src/__tests__/round.test.tsx`                   | the bar's Submit focuses Submit answers                                                                                                                     | The bar's Submit focuses Submit answers: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                            |
| `packages/web/src/__tests__/round.test.tsx`                   | a tap saves the letters with the comment as saved, and Save comment the comment typed                                                                       | A tap saves the letters with the comment as saved, and Save comment the comment typed: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                              |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit saves a comment, the notes, and a settled point's comment typed, then submits                                                                        | Submit saves a comment, the notes, and a settled point's comment typed, then submits: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                               |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit adds no comment for a settled point's form left blank                                                                                                | Submit adds no comment for a settled point's form left blank: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                       |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit during a settled point's Add comment adds the comment once                                                                                           | Submit during a settled point's Add comment adds the comment once: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                  |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit keeps a settled point's comment typed while it was saving it                                                                                         | Submit keeps a settled point's comment typed while it was saving it: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit does not write the edit of a comment removed into the next one                                                                                       | Submit does not write the edit of a comment removed into the next one: a race with a change made elsewhere, left without a test at the `early` stage; the kept four own the closest cases                                                                                                                  |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit does not write an edit into another comment after a removal made elsewhere                                                                           | Submit does not write an edit into another comment after a removal made elsewhere: a race with a change made elsewhere, left without a test at the `early` stage; the kept four own the closest cases                                                                                                      |
| `packages/web/src/__tests__/round.test.tsx`                   | Submit stops at the edit of a comment changed elsewhere since it began                                                                                      | Submit stops at the edit of a comment changed elsewhere since it began: a race with a change made elsewhere, left without a test at the `early` stage; the kept four own the closest cases                                                                                                                 |
| `packages/web/src/__tests__/round.test.tsx`                   | a question's comment typed is restored after a reload                                                                                                       | a question's comment typed is restored after a reload: typed text restored after a reload, left without a test at the `early` stage; the kept four own the closest cases                                                                                                                                   |
| `packages/web/src/__tests__/round.test.tsx`                   | an unsaved comment of a round answered elsewhere stays, with the notice                                                                                     | an unsaved comment of a round answered elsewhere stays, with the notice: a race with a change made elsewhere, left without a test at the `early` stage; the kept four own the closest cases                                                                                                                |
| `packages/web/src/__tests__/round.test.tsx`                   | the round opens with its block, then the Context's parts in their panes                                                                                     | The round opens with its block, then the Context's parts in their panes: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                            |
| `packages/web/src/__tests__/round.test.tsx`                   | a later round shows Since the last round above Goal                                                                                                         | A later round shows Since the last round above Goal: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                                |
| `packages/web/src/__tests__/round.test.tsx`                   | Why it matters shows in a pane after the context, not within it                                                                                             | Why it matters shows in a pane after the context, not within it: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                    |
| `packages/web/src/__tests__/round.test.tsx`                   | a table and a quote in a question's context show in its card                                                                                                | A table and a quote in a question's context show in its card: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                       |
| `packages/web/src/__tests__/round.test.tsx`                   | on the phone, the in-page index sits after the block, before the context                                                                                    | On the phone, the in-page index sits after the block, before the context: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                           |
| `packages/web/src/__tests__/round.test.tsx`                   | on the phone, the in-page index is announced as Questions once                                                                                              | On the phone, the in-page index is announced as Questions once: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                     |
| `packages/web/src/__tests__/round.test.tsx`                   | on the phone, an answered round has no in-page index                                                                                                        | On the phone, an answered round has no in-page index: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                               |
| `packages/web/src/__tests__/round.test.tsx`                   | a comment starting with a letter warns when no letter is picked                                                                                             | A comment starting with a letter warns when no letter is picked: the questions page's wiring, left to the human's use of the page: the kept four own answers committed without the typed text or into the wrong comment                                                                                    |
| `packages/web/src/__tests__/review.test.tsx`                  | a spec under review shows each story's more scenarios folded                                                                                                | A spec under review shows each story's more scenarios folded: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                      |
| `packages/web/src/__tests__/review.test.tsx`                  | opening a story's scenarios lets the human comment on one                                                                                                   | Opening a story's scenarios lets the human comment on one: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                         |
| `packages/web/src/__tests__/review.test.tsx`                  | a pending comment opens its fold                                                                                                                            | A pending comment opens its fold: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                                  |
| `packages/web/src/__tests__/review.test.tsx`                  | closing a fold keeps the draft                                                                                                                              | Closing a fold keeps the draft: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                                    |
| `packages/web/src/__tests__/review.test.tsx`                  | a fold's trigger opens it and selects no block                                                                                                              | A fold's trigger opens it and selects no block: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                    |
| `packages/web/src/__tests__/review.test.tsx`                  | a tapped block takes a comment on its lines                                                                                                                 | A tapped block takes a comment on its lines: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                       |
| `packages/web/src/__tests__/review.test.tsx`                  | a second tap extends the selection                                                                                                                          | A second tap extends the selection: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                                |
| `packages/web/src/__tests__/review.test.tsx`                  | a pending comment is edited, then removed with its review file                                                                                              | A pending comment is edited, then removed with its review file: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                    |
| `packages/web/src/__tests__/review.test.tsx`                  | approving with a higher tier leaves the plan's review off                                                                                                   | Approving with a higher tier leaves the plan's review off: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                         |
| `packages/web/src/__tests__/review.test.tsx`                  | Request changes waits for a comment                                                                                                                         | Request changes waits for a comment: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                               |
| `packages/web/src/__tests__/review.test.tsx`                  | a new version under pending comments is said                                                                                                                | A new version under pending comments is said: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                      |
| `packages/web/src/__tests__/review.test.tsx`                  | a comment on a decision is listed in your review, not under the spec's lines                                                                                | A comment on a decision is listed in your review, not under the spec's lines: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                      |
| `packages/web/src/__tests__/review.test.tsx`                  | a spec without stories still takes comments                                                                                                                 | A spec without stories still takes comments: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                       |
| `packages/web/src/__tests__/review.test.tsx`                  | the verdict waits while the spec has changes not committed                                                                                                  | The verdict waits while the spec has changes not committed: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                        |
| `packages/web/src/__tests__/review.test.tsx`                  | a general comment is edited, then removed                                                                                                                   | A general comment is edited, then removed: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                         |
| `packages/web/src/__tests__/review.test.tsx`                  | a table row takes a comment on its line                                                                                                                     | A table row takes a comment on its line: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                           |
| `packages/web/src/__tests__/review.test.tsx`                  | on a wide screen, the comment field opens under the block (US2 3, 4)                                                                                        | On a wide screen, the comment field opens under the block (US2 3, 4): the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                              |
| `packages/web/src/__tests__/review.test.tsx`                  | on a wide screen, the text typed follows the field to the next block (US2 2, 3)                                                                             | On a wide screen, the text typed follows the field to the next block (US2 2, 3): the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                   |
| `packages/web/src/__tests__/review.test.tsx`                  | a general comment being typed is kept when a block is tapped                                                                                                | A general comment being typed is kept when a block is tapped: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                      |
| `packages/web/src/__tests__/review.test.tsx`                  | a nested item's comment field takes taps without selecting its parent                                                                                       | A nested item's comment field takes taps without selecting its parent: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                             |
| `packages/web/src/__tests__/review.test.tsx`                  | US6.1: Ask the agent opens the session with the selected lines quoted                                                                                       | US6.1: Ask the agent opens the session with the selected lines quoted: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                             |
| `packages/web/src/__tests__/review.test.tsx`                  | Ask the agent on one line names that line                                                                                                                   | Ask the agent on one line names that line: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                         |
| `packages/web/src/__tests__/review.test.tsx`                  | without the agent, a selection offers no Ask the agent                                                                                                      | Without the agent, a selection offers no Ask the agent: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                            |
| `packages/web/src/__tests__/review.test.tsx`                  | taps in a block's image, opened full screen, do not select the block                                                                                        | Taps in a block's image, opened full screen, do not select the block: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                              |
| `packages/web/src/__tests__/review.test.tsx`                  | a verdict with an open comment of no text goes through                                                                                                      | A verdict with an open comment of no text goes through: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                            |
| `packages/web/src/__tests__/review.test.tsx`                  | a verdict after a comment with an image was cancelled deletes the image                                                                                     | A verdict after a comment with an image was cancelled deletes the image: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                           |
| `packages/web/src/__tests__/review.test.tsx`                  | after a comment with an image is added, a verdict with the next one empty goes through                                                                      | After a comment with an image is added, a verdict with the next one empty goes through: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                            |
| `packages/web/src/__tests__/review.test.tsx`                  | after a comment with an image is added, an image on the next one adds its link alone                                                                        | After a comment with an image is added, an image on the next one adds its link alone: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                              |
| `packages/web/src/__tests__/review.test.tsx`                  | at %i px, the verdict's refusal is in the comment form: %s                                                                                                  | At %i px, the verdict's refusal is in the comment form: %s: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                        |
| `packages/web/src/__tests__/review.test.tsx`                  | on the phone, a new comment left in its closed sheet does not make leaving ask                                                                              | On the phone, a new comment left in its closed sheet does not make leaving ask: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                    |
| `packages/web/src/__tests__/review.test.tsx`                  | on the phone, a verdict during the upload of a cancelled comment is refused on the page                                                                     | On the phone, a verdict during the upload of a cancelled comment is refused on the page: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                           |
| `packages/web/src/__tests__/review.test.tsx`                  | the verdict's refusal goes once the comment is cancelled                                                                                                    | The verdict's refusal goes once the comment is cancelled: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                          |
| `packages/web/src/__tests__/review.test.tsx`                  | an image picked for a comment does not go into a comment edited during its upload                                                                           | An image picked for a comment does not go into a comment edited during its upload: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                 |
| `packages/web/src/__tests__/review.test.tsx`                  | typing a comment renders none of the document's blocks (US3 1, SC-002)                                                                                      | a render count: typing a comment re-rendered no block of the document, counted by a `Profiler` around `Blocks`                                                                                                                                                                                             |
| `packages/web/src/__tests__/review.test.tsx`                  | the comment typed on line 40 follows the field to line 52 (US3 2)                                                                                           | The comment typed on line 40 follows the field to line 52 (US3 2): the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                 |
| `packages/web/src/__tests__/review.test.tsx`                  | a comment added shows under its block at once, saving… until written (US3 3)                                                                                | A comment added shows under its block at once, saving… until written (US3 3): the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                      |
| `packages/web/src/__tests__/review.test.tsx`                  | a comment refused as it is added comes back in its form, with the error                                                                                     | A comment refused as it is added comes back in its form, with the error: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                           |
| `packages/web/src/__tests__/review.test.tsx`                  | Ctrl+Enter in a review comment adds it, and does nothing while it is empty                                                                                  | Ctrl+Enter in a review comment adds it, and does nothing while it is empty: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                        |
| `packages/web/src/__tests__/review.test.tsx`                  | Cancel on a review comment typed asks first (US5 7)                                                                                                         | Cancel on a review comment typed asks first (US5 7): the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                               |
| `packages/web/src/__tests__/review.test.tsx`                  | Cancel on an empty review comment closes it without asking (US5 8)                                                                                          | Cancel on an empty review comment closes it without asking (US5 8): the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                |
| `packages/web/src/__tests__/review.test.tsx`                  | a review comment typed is restored after a reload, with its lines                                                                                           | a review comment typed is restored after a reload, with its lines: typed text restored after a reload, left without a test at the `early` stage; the kept four own the closest cases                                                                                                                       |
| `packages/web/src/__tests__/review.test.tsx`                  | an edit of a review comment removed elsewhere is not restored onto the next one                                                                             | an edit of a review comment removed elsewhere is not restored onto the next one: a race with a change made elsewhere, left without a test at the `early` stage; the kept four own the closest cases                                                                                                        |
| `packages/web/src/__tests__/review.test.tsx`                  | the summary typed while Approve is sent is kept                                                                                                             | The summary typed while Approve is sent is kept: the spec review's wiring, left to the human's use of the page: the kept four own a verdict committed without a comment and a comment on the wrong lines                                                                                                   |
| `packages/web/src/__tests__/review.test.tsx`                  | the summary typed is restored after a reload                                                                                                                | the summary typed is restored after a reload: typed text restored after a reload, left without a test at the `early` stage; the kept four own the closest cases                                                                                                                                            |
| `packages/web/src/__tests__/leave.test.tsx`                   | a page opened by navigate asks the same                                                                                                                     | A page opened by navigate asks the same: leaving a page, left to the human's use of the page: the kept two own typed text lost on navigation                                                                                                                                                               |
| `packages/web/src/__tests__/leave.test.tsx`                   | with nothing unsaved, a link, Back, and a reload do not ask                                                                                                 | With nothing unsaved, a link, Back, and a reload do not ask: leaving a page, left to the human's use of the page: the kept two own typed text lost on navigation                                                                                                                                           |
| `packages/web/src/__tests__/leave.test.tsx`                   | a reload with unsaved text gets the browser's prompt, until it is saved                                                                                     | A reload with unsaved text gets the browser's prompt, until it is saved: leaving a page, left to the human's use of the page: the kept two own typed text lost on navigation                                                                                                                               |
| `packages/web/src/__tests__/leave.test.tsx`                   | Back closing a sheet with an unsaved comment does not ask, nor does the page after                                                                          | Back closing a sheet with an unsaved comment does not ask, nor does the page after: leaving a page, left to the human's use of the page: the kept two own typed text lost on navigation                                                                                                                    |
| `packages/web/src/__tests__/leave.test.tsx`                   | the editor's redirect after a move does not ask                                                                                                             | The editor's redirect after a move does not ask: leaving a page, left to the human's use of the page: the kept two own typed text lost on navigation                                                                                                                                                       |
| `packages/web/src/__tests__/new-page.test.tsx`                | US5.1: New without a kind picks Session, its composer under the cards                                                                                       | US5.1: New without a kind picks Session, its composer under the cards: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                             |
| `packages/web/src/__tests__/new-page.test.tsx`                | US5.2: picking Feature marks it, puts it in the address, and shows its form                                                                                 | US5.2: picking Feature marks it, puts it in the address, and shows its form: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                       |
| `packages/web/src/__tests__/new-page.test.tsx`                | US5.3: each card says what it ends with and what waits on you                                                                                               | US5.3: each card says what it ends with and what waits on you: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                     |
| `packages/web/src/__tests__/new-page.test.tsx`                | each card's sentence and facts are its radio's description                                                                                                  | Each card's sentence and facts are its radio's description: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                        |
| `packages/web/src/__tests__/new-page.test.tsx`                | each card has its sentence and its example                                                                                                                  | Each card has its sentence and its example: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                                        |
| `packages/web/src/__tests__/new-page.test.tsx`                | US5 more 2: the arrow keys move the pick, and Space picks, as in a group of radio buttons                                                                   | US5 more 2: the arrow keys move the pick, and Space picks, as in a group of radio buttons: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                         |
| `packages/web/src/__tests__/new-page.test.tsx`                | an arrow with a modifier is the browser's, as Alt+Right is Forward: the pick stays                                                                          | An arrow with a modifier is the browser's, as Alt+Right is Forward: the pick stays: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                |
| `packages/web/src/__tests__/new-page.test.tsx`                | SC-005: a reload keeps the picked kind                                                                                                                      | SC-005: a reload keeps the picked kind: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                                            |
| `packages/web/src/__tests__/new-page.test.tsx`                | the kind picked is in the address                                                                                                                           | The kind picked is in the address: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                                                 |
| `packages/web/src/__tests__/new-page.test.tsx`                | a change from an inbox note                                                                                                                                 | A change from an inbox note: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                                                       |
| `packages/web/src/__tests__/new-page.test.tsx`                | a change from a note that cannot start keeps the note                                                                                                       | A change from a note that cannot start keeps the note: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                             |
| `packages/web/src/__tests__/new-page.test.tsx`                | a change from a priority line                                                                                                                               | A change from a priority line: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                                                     |
| `packages/web/src/__tests__/new-page.test.tsx`                | a feature from a title                                                                                                                                      | A feature from a title: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                                                            |
| `packages/web/src/__tests__/new-page.test.tsx`                | a feature from a title whose draft cannot be written leaves Now as it was                                                                                   | A feature from a title whose draft cannot be written leaves Now as it was: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                         |
| `packages/web/src/__tests__/new-page.test.tsx`                | a start whose read fails shows why                                                                                                                          | A start whose read fails shows why: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                                                |
| `packages/web/src/__tests__/new-page.test.tsx`                | a feature from a priority line                                                                                                                              | A feature from a priority line: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                                                    |
| `packages/web/src/__tests__/new-page.test.tsx`                | without the agent, the change's page opens with its message unsent                                                                                          | Without the agent, the change's page opens with its message unsent: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                |
| `packages/web/src/__tests__/new-page.test.tsx`                | with the agent, the change's session opens, where its agent works                                                                                           | With the agent, the change's session opens, where its agent works: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                                                 |
| `packages/web/src/__tests__/new-page.test.tsx`                | a start that answers after the human left opens nothing, and shows progress until then                                                                      | A start that answers after the human left opens nothing, and shows progress until then: the New page's wiring, left to the human's use of the page: the kept one owns newer typed text cleared by a late answer                                                                                            |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | a browser without a session sees the sign-in screen                                                                                                         | A browser without a session sees the sign-in screen: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                                     |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | the key signs in, and the page shows                                                                                                                        | The key signs in, and the page shows: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                                                    |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | a wrong key says so, and keeps the text                                                                                                                     | A wrong key says so, and keeps the text: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                                                 |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | an unreachable server says so                                                                                                                               | An unreachable server says so: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                                                           |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | a sign-in answered %i says the server failed                                                                                                                | A sign-in answered %i says the server failed: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                                            |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | the repository menu holds no sign-out item                                                                                                                  | The repository menu holds no sign-out item: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                                              |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | Sign out ends this session                                                                                                                                  | Sign out ends this session: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                                                              |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | Sign out everywhere asks first                                                                                                                              | Sign out everywhere asks first: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                                                          |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | %s with the server stopped says so in Sign-in, and the page stays                                                                                           | %s with the server stopped says so in Sign-in, and the page stays: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                       |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | a live stream that closes on a sign-out elsewhere shows the sign-in screen                                                                                  | A live stream that closes on a sign-out elsewhere shows the sign-in screen: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                              |
| `packages/web/src/__tests__/sign-in.test.tsx`                 | an upload without a session shows the sign-in screen                                                                                                        | An upload without a session shows the sign-in screen: the sign-in screen's wiring, left to the human's use of the page, its server side owned by the sign-in routes' and store's tests: the kept one owns typed text lost when the app swaps to sign-in                                                    |
| `packages/web/src/__tests__/links.test.ts`                    | a change's round links its decision with the change marked                                                                                                  | a decision linked from a change's round opens the branch's decision at its anchor, its changed words marked                                                                                                                                                                                                |
| `packages/web/src/__tests__/links.test.ts`                    | every link of %s starts with its repository's prefix                                                                                                        | SC-003: every link and frame a page of the fixture repository draws starts with `/r/<name>/`; the prefix is `pathLink`'s and `repoPath`'s, whose rows stay                                                                                                                                                 |
| `packages/web/src/__tests__/routes.test.ts`                   | old addresses redirect: %s lands on %s%s%s                                                                                                                  | links from before sessions (`/chats/...`, `/changes/new`) open the same page at its new address, query and hash kept                                                                                                                                                                                       |
| `packages/web/src/__tests__/routes.test.ts`                   | a new session's first message opens /sessions/<id>                                                                                                          | a new session's first send opens its page at `/sessions/<id>`, and the message reached the agent                                                                                                                                                                                                           |
| `packages/web/src/__tests__/routes.test.ts`                   | Back before the next page draws returns the page left to its position                                                                                       | Back before the next page draws takes the scroll position of the page left back, by `scrollTo` calls                                                                                                                                                                                                       |
| `packages/web/src/__tests__/add-repository.test.tsx`          | the whole file                                                                                                                                              | "Add a repository" form completes its Folder field as typed, and the first-run form with an empty list                                                                                                                                                                                                     |
| `packages/web/src/__tests__/change.test.tsx`                  | the whole file                                                                                                                                              | a change's session keeps the crumbs back to its page, in the change's words                                                                                                                                                                                                                                |
| `packages/web/src/__tests__/comment-draft-place.test.tsx`     | the whole file                                                                                                                                              | the last tapped block keeps its place on screen as the comment form closes or another starts: scroll position                                                                                                                                                                                              |
| `packages/web/src/__tests__/commit-actions.test.tsx`          | the whole file                                                                                                                                              | the buttons that commit and hand over to the agent open a session with the workflow's message unsent in its composer; the message-before-typed-text rule is `withInserted`'s, in `RecommendedMessage.test.ts`                                                                                              |
| `packages/web/src/__tests__/compiler.test.tsx`                | the whole file                                                                                                                                              | a component whose props did not change is memoized by React Compiler: how the code does it                                                                                                                                                                                                                 |
| `packages/web/src/__tests__/composer-images.test.tsx`         | the whole file                                                                                                                                              | removing a composer image focuses the next image, then the message: focus placement                                                                                                                                                                                                                        |
| `packages/web/src/__tests__/confirm.test.tsx`                 | the whole file                                                                                                                                              | a confirmation is a dialog on wide screens and a sheet on the phone, with a visible close button, and Back closes it: layout                                                                                                                                                                               |
| `packages/web/src/__tests__/decision-rules.test.tsx`          | the whole file                                                                                                                                              | the decisions page draws a rule's strength icon, words, and check as the spec page does: markup and classes                                                                                                                                                                                                |
| `packages/web/src/__tests__/decisions-check.test.tsx`         | the whole file                                                                                                                                              | "Check decisions" starts a chat, its banner leads to the check's page, and the answers are written in `specs/DECISIONS-CHECK.md`: wiring of buttons and banners                                                                                                                                            |
| `packages/web/src/__tests__/decisions.test.tsx`               | the whole file                                                                                                                                              | the constitution and decisions page, read-only, with its edge cases of a missing folder, constitution, or title: what the page draws                                                                                                                                                                       |
| `packages/web/src/__tests__/diagram-links.test.tsx`           | the whole file                                                                                                                                              | a link in a diagram opens in a new tab and never replaces the app's page: markup (`target`) of a link                                                                                                                                                                                                      |
| `packages/web/src/__tests__/document-ask.test.tsx`            | the whole file                                                                                                                                              | "Ask the agent" on a proposal's paragraph quotes its lines in the Session tab: wiring, with the quote text owned by the kept composer test and the server                                                                                                                                                  |
| `packages/web/src/__tests__/document.test.tsx`                | the whole file                                                                                                                                              | a proposal's drawing: callouts, bullets, images with alt text and their paths, links in the UI or as text, panes: what the page draws                                                                                                                                                                      |
| `packages/web/src/__tests__/feature-done.test.tsx`            | the whole file                                                                                                                                              | what a feature produced, its figures, and a done one's record drawn in place: what the page draws                                                                                                                                                                                                          |
| `packages/web/src/__tests__/feature-menu.test.tsx`            | the whole file                                                                                                                                              | a feature's "…" menu: Rename, and Drop behind its confirmation, with what stayed told on Home                                                                                                                                                                                                              |
| `packages/web/src/__tests__/feature-next.test.tsx`            | the whole file                                                                                                                                              | the feature page's "Next" hands the feature over to the session with the message unsent, before the typed text (`withInserted`, `RecommendedMessage.test.ts`), and follows the live state                                                                                                                  |
| `packages/web/src/__tests__/feature-page.test.tsx`            | the whole file                                                                                                                                              | a feature's page: its stages and times, "Next", files, blocking problems, and folded notes: what the page draws                                                                                                                                                                                            |
| `packages/web/src/__tests__/feature-sessions.test.tsx`        | the whole file                                                                                                                                              | a feature's sessions on its page, latest first with status, sub-agents, and Stop: what the page draws                                                                                                                                                                                                      |
| `packages/web/src/__tests__/feature-settings.test.tsx`        | the whole file                                                                                                                                              | a feature's name in the sidebar, from its card's "…": wiring of a menu                                                                                                                                                                                                                                     |
| `packages/web/src/__tests__/fresh-default.test.tsx`           | the whole file                                                                                                                                              | a failed read of the fresh-session setting leaves it unread and does not crash the composer                                                                                                                                                                                                                |
| `packages/web/src/__tests__/harness-mark.test.tsx`            | the whole file                                                                                                                                              | each harness is marked by its glyph, an unknown kind by the generic agent glyph: the look                                                                                                                                                                                                                  |
| `packages/web/src/__tests__/home.test.tsx`                    | the whole file                                                                                                                                              | Home's layout: the core above "Overview", problems, Needs you, In progress, Sessions, and the widgets: what the page draws                                                                                                                                                                                 |
| `packages/web/src/__tests__/inbox.test.tsx`                   | the whole file                                                                                                                                              | adding a note from the sidebar's ＋, the inbox page, and Home's group; a note whose answer was lost is found once (`addedNote`, now `NoteImage.test.ts`): what the page draws                                                                                                                              |
| `packages/web/src/__tests__/ledger.test.tsx`                  | the whole file                                                                                                                                              | a decision's change as a ledger: removed rules first with a sign named for screen readers, changed words marked, folds mounting nothing until opened: markup                                                                                                                                               |
| `packages/web/src/__tests__/missing.test.tsx`                 | the whole file                                                                                                                                              | a missing file, an unknown folder, or an unknown folder's page says so at once                                                                                                                                                                                                                             |
| `packages/web/src/__tests__/mockup.test.tsx`                  | the whole file                                                                                                                                              | a feature's mockups show inside the UI and take comments while the spec waits for review: what the page draws                                                                                                                                                                                              |
| `packages/web/src/__tests__/notes.test.tsx`                   | the whole file                                                                                                                                              | the round's notes kept while the file changes, saved with Save notes or Ctrl+Enter, and restored after a reload: a race with a change made elsewhere, left without a test at the `early` stage; the kept round tests own the closest cases (the space-only difference rule is `differ`, `unsaved.test.ts`) |
| `packages/web/src/__tests__/offer.test.tsx`                   | the whole file                                                                                                                                              | the agent's `uraeda-offer change` block drawn as a card, started with one click, closed with "Not now": what the page draws                                                                                                                                                                                |
| `packages/web/src/__tests__/overlay.test.tsx`                 | the whole file                                                                                                                                              | every sheet and dialog has a visible close button, and Back closes it                                                                                                                                                                                                                                      |
| `packages/web/src/__tests__/palette.test.tsx`                 | the whole file                                                                                                                                              | the decisions palette finds a decision by name or first sentence and opens it; the ranking is `searchEntries`, `jumpEntries` (`jump.test.ts`)                                                                                                                                                              |
| `packages/web/src/__tests__/pane.test.tsx`                    | the whole file                                                                                                                                              | a priority's or a note's pane opens to read, Edit edits in place, and the task view's section, Delete with Undo, and line field: what the page draws                                                                                                                                                       |
| `packages/web/src/__tests__/plan-page.test.tsx`               | the whole file                                                                                                                                              | the plan's sections and tasks in panes, steps counted, comments on steps: what the page draws                                                                                                                                                                                                              |
| `packages/web/src/__tests__/priorities.test.tsx`              | the whole file                                                                                                                                              | the priorities page, groomed in place: lines open their task view, committing closes the toasts                                                                                                                                                                                                            |
| `packages/web/src/__tests__/question-card.test.tsx`           | the whole file                                                                                                                                              | a question's example and "Why it matters" are panes apart from its context, and a picked option says so: what the page draws                                                                                                                                                                               |
| `packages/web/src/__tests__/quick-add.test.tsx`               | the whole file                                                                                                                                              | "Add and commit" in the sidebar's ＋ forms commits that file alone, and the form says why when it cannot: wiring of a form                                                                                                                                                                                 |
| `packages/web/src/__tests__/rail.test.tsx`                    | the whole file                                                                                                                                              | the rail opens under the mouse only after resting there 250 ms: a timer                                                                                                                                                                                                                                    |
| `packages/web/src/__tests__/recap-join.test.tsx`              | the whole file                                                                                                                                              | a recap line joined across pages keeps its place while the page before loads: scroll position                                                                                                                                                                                                              |
| `packages/web/src/__tests__/recommended.test.tsx`             | the whole file                                                                                                                                              | the session's composer offers the one recommended message inserted unsent; the insertion rule is `withInserted` (`RecommendedMessage.test.ts`)                                                                                                                                                             |
| `packages/web/src/__tests__/repositories.test.tsx`            | the whole file                                                                                                                                              | every page is in its repository's URL; a URL without one opens the last repository, an unknown one says so                                                                                                                                                                                                 |
| `packages/web/src/__tests__/repository-menu.test.tsx`         | the whole file                                                                                                                                              | the navigation's heading opens the repository menu, which switches and removes a repository, a missing folder marked                                                                                                                                                                                       |
| `packages/web/src/__tests__/round-column.test.tsx`            | the whole file                                                                                                                                              | the round's column of Outline, Notes, and Session, with "Ask the agent" writing its quote in the composer: what the page draws; typed text through tabs is `round.test.tsx`'s                                                                                                                              |
| `packages/web/src/__tests__/round-outline.test.tsx`           | the whole file                                                                                                                                              | the round's outline lists every part in order and `n` goes to the next blank question: what the page draws                                                                                                                                                                                                 |
| `packages/web/src/__tests__/round-parts.test.tsx`             | the whole file                                                                                                                                              | the round's parts in titled panes: block, Goal, Today, Scope, Sources, "Check these", Under the hood: what the page draws                                                                                                                                                                                  |
| `packages/web/src/__tests__/selectAfterDraw.test.tsx`         | the whole file                                                                                                                                              | the alt text inserted with an image is selected once the field holds it, even when the page draws again first: selection placement                                                                                                                                                                         |
| `packages/web/src/__tests__/session-actions.test.tsx`         | the whole file                                                                                                                                              | "Allow all (N)" beside Send, and the session's "…" menu making it a change, renaming, archiving, dropping: wiring of buttons                                                                                                                                                                               |
| `packages/web/src/__tests__/session-activity.test.tsx`        | the whole file                                                                                                                                              | the session column's Activity draws the runs with calls, thoughts, sub-agent groups, the latest 200 rows, and the stretch the address names: what the page draws                                                                                                                                           |
| `packages/web/src/__tests__/session-column.test.tsx`          | the whole file                                                                                                                                              | the session's column: files edited, the branch's files under Activity, and the plan's progress at its foot: what the page draws                                                                                                                                                                            |
| `packages/web/src/__tests__/session-cost.test.tsx`            | the whole file                                                                                                                                              | a keystroke in a session's composer redraws no message of the transcript: a render count                                                                                                                                                                                                                   |
| `packages/web/src/__tests__/session-recap.test.tsx`           | the whole file                                                                                                                                              | the chat folds each stretch of the agent's calls into a recap line that opens the Activity at that stretch: what the page draws                                                                                                                                                                            |
| `packages/web/src/__tests__/session-stretch-address.test.tsx` | the whole file                                                                                                                                              | a recap's stretch stays in the address only while it is the human's place: URL state                                                                                                                                                                                                                       |
| `packages/web/src/__tests__/session-subagents.test.tsx`       | the whole file                                                                                                                                              | a Sub-agents tab appears while sub-agents run, with their rows, and marks them done once they end: what the page draws                                                                                                                                                                                     |
| `packages/web/src/__tests__/session-tail.test.tsx`            | the whole file                                                                                                                                              | a session draws its latest 20 messages, "Show earlier messages" adds 20, the address's turn and Back keep what they need drawn; the paging rule is `stepPage` (`tail.test.ts`)                                                                                                                             |
| `packages/web/src/__tests__/session-turns.test.tsx`           | the whole file                                                                                                                                              | a feature's session and its turns: the workflow's message queued after a chat turn, a run ending at a gate, a blocked action, tool calls, long turns: what the page draws                                                                                                                                  |
| `packages/web/src/__tests__/session.test.tsx`                 | the whole file                                                                                                                                              | a session's transcript and composer at both widths; the taken-back message rule is `takeBackInto` (`useDraft.test.ts`), the time format `sentAt` and `elapsed` (`Transcript.test.ts`)                                                                                                                      |
| `packages/web/src/__tests__/settings.test.tsx`                | the whole file                                                                                                                                              | the settings page's Server section: host names added, edited, removed, the port, a flag in force; the removal rule is `cutsOff` (`hosts.test.ts`), the search `shownLabels` (`categories.test.ts`)                                                                                                         |
| `packages/web/src/__tests__/settled.test.tsx`                 | the whole file                                                                                                                                              | comments on the points a round settled without the human, written at the end of the notes: wiring of forms                                                                                                                                                                                                 |
| `packages/web/src/__tests__/shell.test.tsx`                   | the whole file                                                                                                                                              | Home goes home, ＋ confirmed by a toast with Undo, the sidebar's sessions; the order and search are `byStatus`, `featureStatus`, `matching` (`cards.test.ts`, `entries.test.ts`)                                                                                                                           |
| `packages/web/src/__tests__/sidebar.test.tsx`                 | the whole file                                                                                                                                              | the sidebar's hierarchy, counts, and each item as a card with its step, status, task, and changed lines: what the page draws                                                                                                                                                                               |
| `packages/web/src/__tests__/since-marks.test.tsx`             | the whole file                                                                                                                                              | every part changed since your review is marked Δ wherever the page draws it: markup                                                                                                                                                                                                                        |
| `packages/web/src/__tests__/since-review.test.tsx`            | the whole file                                                                                                                                              | "Since your review" lists each changed place, a tap jumping to it, Contents marking the rows: what the page draws                                                                                                                                                                                          |
| `packages/web/src/__tests__/spec-asking.test.tsx`             | the whole file                                                                                                                                              | "Ask the agent" on any selection of the spec page writes its quote into the Session tab, or opens the session's page on the phone: wiring                                                                                                                                                                  |
| `packages/web/src/__tests__/spec-column-phone.test.tsx`       | the whole file                                                                                                                                              | the phone's Contents and Review sheets are kept in the address's `?tab=` and a verdict leaves no history entry: URL state                                                                                                                                                                                  |
| `packages/web/src/__tests__/spec-column.test.tsx`             | the whole file                                                                                                                                              | the spec page's column of Contents and Review, with the pending comments and the verdict's buttons: what the page draws; the typed comment through tabs is `review.test.tsx`'s                                                                                                                             |
| `packages/web/src/__tests__/spec-decisions.test.tsx`          | the whole file                                                                                                                                              | each decision the branch changes is a pane, its change marked in place, each part taking a comment; where a decision comment's edit is kept is `placeOf` (`reviewField.test.ts`)                                                                                                                           |
| `packages/web/src/__tests__/spec-page.test.tsx`               | the whole file                                                                                                                                              | the spec page's contents, pending-comment counts, unknown sections, answers, and review history: what the page draws                                                                                                                                                                                       |
| `packages/web/src/__tests__/spec-panes.test.tsx`              | the whole file                                                                                                                                              | the spec in titled panes: what you approve, decisions, the data model's sections: what the page draws                                                                                                                                                                                                      |
| `packages/web/src/__tests__/spec-parts.test.tsx`              | the whole file                                                                                                                                              | the parts after the stories, each drawn for what it holds: edge cases, criteria pills, architecture cards, data tables: what the page draws                                                                                                                                                                |
| `packages/web/src/__tests__/spec-review-tab.test.tsx`         | the whole file                                                                                                                                              | the Review tab's verdict is the page's one verdict, a hook's refusal shows in the tab, and Try again starts the agent: wiring                                                                                                                                                                              |
| `packages/web/src/__tests__/spec-stories.test.tsx`            | the whole file                                                                                                                                              | a story's card: key scenarios as Given, When, Then rows, the others behind "N more scenarios", its mockup in a live window: what the page draws                                                                                                                                                            |
| `packages/web/src/__tests__/status-hints.test.tsx`            | the whole file                                                                                                                                              | the status line's registry keeps each declarer's place as hints change, and a list's Escape hint says what Escape does: a registry's order                                                                                                                                                                 |
| `packages/web/src/__tests__/status-line.test.tsx`             | the whole file                                                                                                                                              | the status line's key hints, what needs the human, and the running sessions: what the page draws                                                                                                                                                                                                           |
| `packages/web/src/__tests__/stories.test.tsx`                 | the whole file                                                                                                                                              | a query counts as a view and an embed on screen asks again every 5 minutes, so the Storybook of a page left open is not stopped                                                                                                                                                                            |
| `packages/web/src/__tests__/story-page.test.tsx`              | the whole file                                                                                                                                              | a story linked in a sentence opens on its own page in a live window; the old address opens the feature's page: what the page draws                                                                                                                                                                         |
| `packages/web/src/__tests__/storybook-mode.test.tsx`          | the whole file                                                                                                                                              | a story's colour mode is the embedding page's, sent as the frame says it is ready: wiring of a message (the message's check is `frameMessages.test.ts`)                                                                                                                                                    |
| `packages/web/src/__tests__/theme.test.tsx`                   | the whole file                                                                                                                                              | the colour scheme picked in the settings and kept on each browser, Mocha in the dark slot, Latte in the light one; the stored-scheme rule is `storedScheme` (`theme.test.ts`)                                                                                                                              |
| `packages/web/src/__tests__/titled-pane.test.tsx`             | the whole file                                                                                                                                              | a titled pane's title is a button telling whether it is open, and folded its content is not mounted: markup                                                                                                                                                                                                |
| `packages/web/src/__tests__/triage.test.tsx`                  | the whole file                                                                                                                                              | "Organize with an agent" starts a chat, the banners lead to the triage, the answers are written in `specs/INBOX-TRIAGE.md`: wiring                                                                                                                                                                         |
| `packages/web/src/__tests__/usage.test.tsx`                   | the whole file                                                                                                                                              | the five-hour allowance shows at the column's foot, updates, and disappears when the runner exits: what the page draws                                                                                                                                                                                     |
| `packages/web/src/__tests__/width-class.test.tsx`             | the whole file                                                                                                                                              | the three width classes from the theme's breakpoints, narrow, semi-wide, and wide: the breakpoint constants                                                                                                                                                                                                |
| `packages/web/src/__tests__/writes.test.tsx`                  | the whole file                                                                                                                                              | a button that writes to git says what it does at once, the other writing buttons are blocked meanwhile, a bar runs at the top: what the page draws                                                                                                                                                         |
| `packages/web/src/__tests__/helpers.tsx`                      | `addRun`, `holding`, `listOf`, `temporaryHome`, `repoAt`, `record`, `homeHidden`, `read`, `addMockup`, `sent`, and the exports `Binding`, `Fake`, `atWidth` | Setup only the removed tests used: seeding runs, holding requests, a list of repositories, a home folder, a record, a mockup; the request log `sent` that only they read                                                                                                                                   |
| `packages/web/src/__focused__/helpers.tsx`                    | the export of `agentRecord`                                                                                                                                 | Used by the composer tests removed: `renderComposer` still calls it                                                                                                                                                                                                                                        |

#### Task 13

Kept whole, as the decisions name them: `lint.test.ts`
([Code quality](/specs/decisions/code-quality.md)), `theme-tokens.test.ts` and
`offline-build.test.ts` ([UI look](/specs/decisions/ui-look.md)), the sandbox's tests
([Sandbox](/specs/decisions/sandbox.md)), and the benchmark runner's tests
([Benchmarks](/specs/decisions/benchmarks.md)). `build.test.ts` keeps its test of the build's
output, which the Sandbox decision names. `keep-place.test.ts` stays whole: its tests reproduce bugs
fixed in earlier features (R29 and R32), races that using the page does not show. Judged files: 46;
test declarations before 278, after 269 (9 removed, one row each).

| File                                                      | Test                                                                                  | Behaviour it guarded                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/web/src/__tests__/build.test.ts`                | the main bundle holds no pele, which chunks of their own hold                         | Where the bundler puts the diagram library: how the build is cut, and [Diagrams](/specs/decisions/diagrams.md) checks "load the library only when a page holds a diagram" by review                                                                               |
| `packages/web/src/__tests__/decision-icons.test.ts`       | a decision's icon is its own when registered, else the default one                    | A lookup of one registered name and a fallback for four others: trivial code                                                                                                                                                                                      |
| `packages/web/src/__tests__/document-column.test.ts`      | the width before a drag is a third of the window, between 400 and 600 px              | The documents' column's size at four window widths: a size, which using the page shows                                                                                                                                                                            |
| `packages/web/src/__tests__/document-column.test.ts`      | the session column is narrower than the documents' at semi-wide (C2)                  | The session column's size at two window widths: a size, which using the page shows                                                                                                                                                                                |
| `packages/web/src/__tests__/document-column.test.ts`      | a session's dragged width reads as itself in Session, and as 400 px in the documents' | The size a hook reads for each column from one stored value: a size; the kept "folding and unfolding" test asserts the stored value itself                                                                                                                        |
| `packages/web/src/__tests__/stretches.test.ts`            | the stretch's address                                                                 | The query string of a stretch's link: a URL template, trivial code                                                                                                                                                                                                |
| `packages/web/samples/__tests__/projects.test.ts`         | empty is a project just set up                                                        | The sample `empty` holding no feature, problem, priority, or note: its builder's output, which the sandbox shows at once, and no rule names it                                                                                                                    |
| `packages/web/samples/__tests__/storybook-states.test.ts` | Storybook's fixture holds the same features at the same steps                         | A snapshot of the 26 features Storybook's fixture held before the samples moved, and their steps: neither a stored format nor a contract, and adding a feature to the fixture cost an edit of the list ([Testing](/specs/decisions/testing.md), early stage rule) |
| `scripts/__tests__/fast-check.test.ts`                    | fast's own checks wait for a heavy slot                                               | fast waiting while both heavy slots are held, with `vp` never called: "the changed files are listed with the user's globally ignored files left out" asserts the same waiting line and no call                                                                    |

#### Task 15

| File                                                 | Test                                                                  | Behaviour it guarded                                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/web/src/__tests__/columnWidth.test.ts`     | the four clamping rows, old and new key                               | the navigation column's chosen limits, 220 and 480 px: a size, left to review                      |
| `packages/web/src/__tests__/document-column.test.ts` | a stored width is clamped                                             | the documents' column's chosen limits, 400 and 720 px: a size, left to review                      |
| `packages/web/src/__tests__/theme-tokens.test.ts`    | at $width px with a $pointer pointer, text is 120% and corners square | the theme's text sizes, control heights, and corners: sizes no decision states now, left to review |
| `packages/web/src/__tests__/theme-tokens.test.ts`    | the fonts are JetBrains Mono, and Inter for reading                   | the theme's fonts: a look, checked by review in UI look                                            |
| `packages/web/src/__tests__/theme-tokens.test.ts`    | the breakpoints are named at 768 and 1280 px                          | the width classes' pixel values, which UI layout no longer names                                   |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1 to 7: the screenshot check writes `rulings.md` only; the core's record fields and
   templates (task 2), the skill's testing wording (task 3), the two web extractions (tasks 4 and 5,
   separate source files and new unit test files), and the judging of the CLI and LSP (task 6) and
   of the server and binding (task 7) touch different files. Each adds its own section to
   [Removed tests](#removed-tests), and its own rulings, numbered again when the wave is merged.
2. Tasks 8 to 11: the spec page (task 8) touches `packages/web/src/spec/` and a sample; the records
   wording (task 9) the skill's finish, implementation, and change references and the record and
   rulings templates; the browser runner's removal (task 10) its configs, CI, the toolchain test,
   and the fast selection's deferred list; the core's tests (task 11) `crates/core/`.
3. Tasks 12 to 14: the rendering tests' removal (task 12) owns `packages/web/src/__tests__/*.tsx`,
   `helpers.tsx`, `links.test.ts`, `routes.test.ts`, and the fast selection's test lists; the other
   TypeScript tests (task 13) the rest of `packages/web/**/*.test.ts`, `packages/benchmarks/`, and
   `scripts/__tests__/` but the two fast-selection tests; the evaluation (task 14) the skill's
   wording only. Task 12 and 13 remove their own entries of `scripts/test-weights.json`.
4. Task 15: the record's lists, once every judging task is merged.

---

## Task 1: Check how a screenshot reaches a pull request without a commit

**Files:**

- Modify: `specs/2026-10-26-testing-communication/rulings.md`

**Interfaces:**

- Produces: a ruling, "How a screenshot reaches the pull request", that task 9's wording follows:
  the way an agent attaches an image to a pull request body without committing it, or that none
  exists on this forge, and what the body says instead.

- [x] **Step 1: Find what the forge and its tool allow**

Read `gh pr create --help`, `gh pr edit --help`, `gh api --help`, and GitHub's documentation for
attaching images to issues and pull requests, and for the REST API's issue and pull request bodies.
The repository is public: publish nothing to find out, no gist, release, or upload of a test image,
unless the documentation shows a supported upload an agent can make with `gh`.

- Expected: a supported way named with its source, or none.

- [x] **Step 2: Write the ruling**

The ruling says what was found, with its sources, and what the skill's wording does: attach the
screenshot through the supported way; or, when the forge's tool offers none, say in the body that it
carries no image, and name the command that starts the sandbox (`vp run sandbox` here, the project's
own command in general), as the spec's edge case says.

- [x] **Step 3: Commit**

```bash
git add specs/2026-10-26-testing-communication/rulings.md specs/2026-10-26-testing-communication/plan.md
git commit -m "docs(testing-communication): how a screenshot reaches a pull request"
```

## Task 2: Records name what they supersede, and specs and records list replaced behaviour

**Risky:** it adds fields and sections to the checked format of every record and spec, which
`ura check`, the LSP, and the web UI read.

**Files:**

- Modify: `crates/core/src/files/frontmatter.rs` (`Value`, `parse`)
- Modify: `crates/core/src/check/values.rs` (`fields`, the record's checks)
- Modify: `skills/uraeda/assets/templates/specs/done/YYYY-MM-DD-feature-slug.md`
- Modify: `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md`
- Test: `crates/core/tests/check.rs`, `crates/core/tests/fields.rs`

**Interfaces:**

- Produces: the record fields `supersedes` and `superseded-by`, optional, each a YAML list of record
  names without `.md` (`supersedes: [2026-10-19-fix-testing]`), or an empty list. The warning rules
  `frontmatter.supersedes` and `frontmatter.superseded-by`. The optional sections
  `## Replaced behaviour` in the spec template, between `## User stories` and `## Architecture`, and
  `## Replaced behaviour` and `## Gotchas` in the record template, after `## Design`, in that order.
  Task 9 rewrites their placeholder text; task 8 draws the spec's section.

- [x] **Step 1: Write the failing tests**

In `each_rule`'s table, beside the record rows, with the example's record (`RECORD`) and a second
record written by the test:

- `supersedes` naming a record that does not exist: the warning
  `supersedes names "2026-10-01-nothing", which is not a record` on the line of `supersedes`.
- `supersedes` naming a record whose `superseded-by` does not name this one: the warning
  `2026-10-02-older does not name this record in its superseded-by`.
- `superseded-by` naming a record whose `supersedes` does not name this one: the warning
  `2026-10-20-newer does not name this record in its supersedes`.
- A value that is not a list: the error `supersedes "x" is not a list of records`.

And one test, `a_record_superseded_twice_pairs_with_both`: an older record with
`superseded-by: [A, B]`, and records A and B each with `supersedes: [older]`, check with no problem;
then `ura check` of record A alone, with the older record's `superseded-by` naming only B, reports
A's warning and only A's. In `fields.rs`, the record's field list gains the two fields as optional.

The break each test catches:

- A missing record: a name compared with its `.md`, or the folder read from the wrong place.
- The pairing: checking only one direction.
- Superseded twice: comparing the first item only, or reporting on the partner, which a single-file
  check drops.
- Not a list: a text value accepted as one name.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test check --test fields`
- Expected: FAIL, the first on `unknown field "supersedes"`.

- [x] **Step 3: Implement**

Read a YAML list of strings in the frontmatter, as a new `Value` variant or a reader beside `get`.
In `values.rs`, add the two optional fields to the record's list, and check each name against the
records of `file.folder` (every record sits in `specs/done/`), reporting on the checked file only,
as warnings, as the Problems decision asks. In the two templates, add the sections with `[Optional`
placeholders, so the check allows them and orders them.

Make the break each test names, once its test passes, see it fail, revert it, and say what failed in
the commit body.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c cargo run -q -p uraeda-cli -- check specs`, and the same on
  `skills/uraeda/assets/example/specs`
- Expected: PASS, and no problem in `specs` nor the example; the deferred checks named.

- [x] **Step 5: Commit**

```bash
git add crates/core skills/uraeda/assets/templates specs/2026-10-26-testing-communication/plan.md
git commit -m "feat(testing-communication): records name what they supersede, and specs list replaced behaviour"
```

## Task 3: The skill's one home for testing

**Files:**

- Modify: `skills/uraeda/references/code-quality.md` (`## Writing tests`, `## Tests that can fail`,
  `## UIs verified end to end`)
- Modify: `skills/uraeda/references/plan.md`, `implementation.md` (`## Each task`,
  `## Final review`; not its `## Pull request`), `spec.md`, `change.md` (`## Investigating`,
  `## Making the change`; not its `## The pull request`), `discovery.md`, `projects.md`,
  `skills/uraeda/SKILL.md`
- Modify: `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/plan.md`,
  `skills/uraeda/assets/templates/specs/CONSTITUTION.md`
- Create: `skills/uraeda/assets/templates/specs/decisions/testing.md`,
  `skills/uraeda/assets/example/specs/decisions/testing.md`
- Modify: `specs/INBOX.md` (the `[fix-testing]` note on the constitution template's rule VI)
- Modify, to fix a link to a removed anchor: `specs/done/2026-10-18-skill-wording.md`,
  `specs/2026-10-26-testing-communication/discovery-01.md`

**Interfaces:**

- Produces: the anchors other references link to: `code-quality.md#testing` for the section, and its
  subsections, among them one on when a test goes or changes (`#when-a-test-goes`). Task 9 and task
  14 link to and edit them.

- [x] **Step 1: Read the sources**

The spec's US1, its replaced behaviour, and its assumptions; the Testing decision; the discovery's
[what they have in common](discovery-01.md#what-they-have-in-common); superpowers'
[test-driven development skill](https://raw.githubusercontent.com/obra/superpowers/main/skills/test-driven-development/SKILL.md)
for its tone. Agent-facing references describe, as superpowers' do.

- [x] **Step 2: Write the testing section of `code-quality.md`**

One section, `## Testing`, replacing the three, short, naming no language, test runner, or library
(SC-007). It says, each once:

- **What a test is for**: evidence that the code does what the approved spec, the decisions, and the
  human's requests say; never an authority over them.
- **How many**: as the project's testing decision and its stage say; without one, only what is
  costly to get wrong and rarely changes: stored formats, git and other writes, security, contracts
  between the project's parts, pure logic with many cases, and the reproduction of each bug fixed.
  Not every scenario gets a test: the plan's test map says which have none, and why. One test per
  behaviour, none repeating another's coverage: every test is maintenance.
- **What it asserts**: what a caller or a user observes, never how the code does it. An exact
  contract is asserted exactly.
- **A UI**: tests are rare, only for behaviour costly to lose that using it would not show; the
  human checks the rest by using the app.
- **Writing one**: test-first for logic, contracts, and bug fixes; a UI test may follow its code.
  Fakes only at the boundaries the project does not own. Short, Arrange, Act, Assert, on shared
  helpers; no fixed waits, no elapsed time.
- **Tests that can fail**: each test names the break it catches; a risky guarantee's test is shown
  failing on that break, as today, shortened.
- **When a test goes or changes**, the one home of the rule:
  1. It guards behaviour the approved spec lists as replaced: rewrite or remove it in the task that
     changes the behaviour, with no ruling.
  2. It guards behaviour the spec replaces but did not list: remove it with a one-line ruling; the
     final review lists it.
  3. It fails because of the human's own request: change it, and say which test and why in the same
     response.
  4. It fails and nothing approved replaces what it guards: the code is wrong. Fix the code, and say
     so in the commit body; never edit the assertion. Never change code only to keep a test green.
- **The project's testing decision**: what it holds, and that discovery asks for one once.

Keep `## Rules enforced by tools` and the other concepts; fix their links into the old sections.

- [x] **Step 3: Point the other steps to it**

- `plan.md`: a test step carries the scenario's values only for the tests the testing section asks
  for; the test map has a row for every scenario, edge case, and criterion, with "none" and the
  reason where the stage asks no test; the self-review's "a test that replaces or loosens an
  existing one has its ruling" follows the new rule. Drop the copies of the rule.
- `implementation.md`: "The code is wrong" and the final review's evidence link to
  `#when-a-test-goes` instead of their copies; the final review lists tests removed by the spec's
  list or by ruling.
- `spec.md`: scenarios keep exact values, and "the implementation must test each one" becomes the
  testing section's rule; a `## Replaced behaviour` section, optional, between the stories and the
  architecture, each behaviour in bold with the tests that guard it, found by discovery; the
  constitution check's example table loses its sixth column; the red flag on exact values follows.
- `change.md`: the bug's reproduction test stays; "UI work" no longer runs a browser test or commits
  screenshots: the agent reviews the changed view in the running app, as the UI checks decision of
  this repository and the testing section say.
- `discovery.md`: the map of the code lists the tests that guard behaviour the feature changes; a
  project without `specs/decisions/testing.md` is asked once to adopt one, like the code-quality
  question, its recommended option at the `early` stage for a new project.
- `projects.md`: setting up proposes the testing decision after the code-quality one.
- `SKILL.md`: the folder listing's `plan.md` line and the changes line drop "test-first steps" and
  `screenshots/`.

- [x] **Step 4: Templates, the example, and the inbox**

- The testing decision's template, from the decision template's shape, with the stage (`early`,
  `growing`, `stable`) and what each tests, and the kept UI tests' bar.
- The example's `decisions/testing.md`, active, at the `growing` stage for the todo app: stored
  data, date logic, and each story's main scenario, as the example's plan already does.
- The constitution template: principle III loses its test line, and its rationale follows.
- The plan template's test map shows a row with "none" and its reason.
- `specs/INBOX.md`: remove the `[fix-testing]` note about the template's rule VI: it is closed.

- [x] **Step 5: Run the task's validation**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c cargo run -q -p uraeda-cli -- check specs`, and the same on
  `skills/uraeda/assets/example/specs`
- Expected: PASS, every link resolving.

- [x] **Step 6: Commit**

```bash
git add skills specs/INBOX.md specs/2026-10-26-testing-communication/plan.md
git commit -m "docs(testing-communication): one home for testing in the skill"
```

## Task 4: Extract the text and write rules the UI tests guarded

**Files:**

- Modify: the source files named below, only to export or extract a pure function
- Create: one `.test.ts` per source module in `packages/web/src/__tests__/`, named after it

**Interfaces:**

- Produces: each rule below as an exported pure function, with a table-driven unit test, one row a
  case. The `.test.tsx` that guarded it is not touched here: task 12 removes it.

- [x] **Step 1: Write the unit tests, and the extractions they need**

| Rule                                                                                                                                | Source                                              | Cases from                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| a workflow message goes before the typed text, which is kept (`withInserted`)                                                       | `RecommendedMessage.tsx`                            | `recommended.test.tsx`, `commit-actions.test.tsx`, `feature-next.test.tsx` |
| a taken-back message goes before the text already typed (`takeBackInto`)                                                            | `useDraft.ts`                                       | `session.test.tsx`                                                         |
| where an edit of a decision comment is kept (`placeOf`)                                                                             | `reviewField.ts`                                    | `spec-decisions.test.tsx`                                                  |
| a difference only in spaces at the ends is not unsaved (`differ`)                                                                   | `fields/unsaved.ts`                                 | `notes.test.tsx`                                                           |
| a note whose answer was lost is found once, by its words (`addedNote` and its helpers)                                              | `NoteImage.tsx`                                     | `inbox.test.tsx`                                                           |
| a story comment's text: width only while both show, name or `with "<text>"`, a 40-character snippet (`storyComment`, `storyAnchor`) | `storyComment.ts`                                   | `__browser__/story-comments.test.tsx`, `story-variants.test.tsx`           |
| a saved comment then its story line is written, and the unsaved text gets the line after it (the string rule of `saveWithLine`)     | `useAnswer.ts`                                      | `__browser__/story-variants.test.tsx`                                      |
| CRLF typed or pasted is kept as LF (`asTyped`)                                                                                      | `pane/draftText.ts` (a row in `draft-text.test.ts`) | `__browser__/attach.test.tsx`                                              |
| the latest 20 messages, counting messages not tool calls, "Show earlier" adds 20, a turn link draws from that turn                  | `tail.tsx`                                          | `session-tail.test.tsx`                                                    |
| a message's time has its date unless sent today (`sentAt`); an activity's time in seconds, then minutes (`elapsed`)                 | `Transcript.tsx`                                    | `session.test.tsx`                                                         |

Take each case's values from the old test, so the rule stays as it was.

Built: `withInserted`, `placeOf`, `differ`, `addedNote`, `storyComment`, `storyAnchor`, `asTyped`,
`sentAt`, and `elapsed` were already exported and pure, and `takeBackInto` too, with a stub draft as
`storyCommentsInto`'s test has. Extracted: `lostAnswerNote` (`NoteImage.tsx`, the match of
`addedAfterAll` by words, which now calls it), `savedWithLine` and `unsavedWithLine`
(`useAnswer.ts`, the strings `saveWithLine` writes), and from `tail.tsx` `stepPage` (what the walk
does with one page: where it cuts, how many messages it draws, whether it goes on back) and
`shownAfterPress` (what a press of "Show earlier messages" asks for). The tail's tests are rows of
`stepPage`, one page each: the walk across pages and the button's probe stay in the components.
Tests: `RecommendedMessage.test.ts`, `useDraft.test.ts`, `reviewField.test.ts`, `unsaved.test.ts`,
`NoteImage.test.ts`, `storyComment.test.ts`, `useAnswer.test.ts`, `draft-text.test.ts`,
`tail.test.ts`, `Transcript.test.ts`. The old tests have no case of a story comment's 40-character
snippet or of taken-back images: their rows follow the rule in the source.

- [x] **Step 2: Run them**

- Run: the new test files, by path, under `nix develop -c vp test`.
- Expected: PASS once each function is exported or extracted. A function moved out of a component
  keeps its callers' behaviour; the existing `.test.tsx` files still pass.

- [x] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/web/src specs/2026-10-26-testing-communication/plan.md
git commit -m "test(testing-communication): unit tests for the text rules the UI tests guarded"
```

## Task 5: Extract the navigation, storage, and pick rules the UI tests guarded

**Files:**

- Modify: the source files named below, only to export or extract a pure function
- Create: one `.test.ts` per source module in `packages/web/src/__tests__/`; the pick script's cases
  go into `storybook-pick.test.ts`

**Interfaces:**

- Produces: as task 4, for these rules.

- [x] **Step 1: Write the unit tests, and the extractions they need**

| Rule                                                                                                                                                                                                               | Source                                          | Cases from                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------- |
| removing a host name cuts this browser off, unless it is `localhost` or 127.0.0.1, or a flag overrides the list; compared lowercased (`cutsOff`)                                                                   | `settings/SettingsPage.tsx`                     | `settings.test.tsx`                 |
| the stored scheme reads the old `dark` and `light` as Mocha and Latte (`storedScheme`)                                                                                                                             | `theme.tsx`                                     | `theme.test.tsx`                    |
| the sidebar's status order and a feature's status (`byStatus`, `featureStatus`); its search matching (`matching`, `entriesOf`)                                                                                     | `sidebar/cards.ts`, `sidebar/entries.ts`        | `shell.test.tsx`                    |
| the decisions palette's ranking (`searchEntries`, `jumpEntries`)                                                                                                                                                   | `decisions/jump.ts`                             | `palette.test.tsx`                  |
| the settings search (`shownLabels`)                                                                                                                                                                                | `settings/categories.ts`                        | `settings.test.tsx`                 |
| list keys across columns: same row or the last card, stay in the column, first and last (`destination`)                                                                                                            | `lists/useListKeys.ts`                          | `__browser__/list-keys.test.tsx`    |
| the stored navigation width: the old Astryx key migrated, clamped 220 to 480, the fold kept (`readColumn`, `readOld`)                                                                                              | `shell/columnWidth.ts`                          | `__browser__/shell.test.tsx`        |
| the pick script's keys: Enter and Space pick the focused element, a modifier or composing text passes through, a key's repeats are swallowed until its key up or a blur; HTML cut at 2,000 characters, text at 200 | `skills/uraeda/assets/storybook/uraeda-pick.js` | `__browser__/sandbox-pick.test.tsx` |
| a message from the story frame is checked before it is read (`isFrameMessage`, `pickedOf`)                                                                                                                         | `StoryFrames.tsx`                               | `__browser__/story-embed.test.tsx`  |

As built: each rule is a pure function with a table-driven test, named after its source module.

| Function                                                                                | Now in                                          | Test                     |
| --------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------ |
| `cutsOff` (takes the host names' source)                                                | `settings/hosts.ts`, out of `SettingsPage.tsx`  | `hosts.test.ts`          |
| `shownLabels`                                                                           | `settings/categories.ts`, as it was             | `categories.test.ts`     |
| `storedScheme` (takes the stored value)                                                 | `theme.tsx`                                     | `theme.test.ts`          |
| `byStatus`, `featureStatus`                                                             | `sidebar/cards.ts`, as they were                | `cards.test.ts`          |
| `matching`, through `entriesOf`                                                         | `sidebar/entries.ts`, as they were              | `entries.test.ts`        |
| `searchEntries`, `jumpEntries`                                                          | `decisions/jump.ts`, as they were               | `jump.test.ts`           |
| `destination`                                                                           | `lists/destination.ts`, out of `useListKeys.ts` | `destination.test.ts`    |
| `readColumn`, with `readOld` through it                                                 | `shell/columnWidth.ts`, as they were            | `columnWidth.test.ts`    |
| `isFrameMessage`, `heightOf`, `pickedOf`, and `frameMessage` (the frame's window check) | `frameMessages.ts`, out of `StoryFrames.tsx`    | `frameMessages.test.ts`  |
| the pick script's keys and cuts                                                         | `uraeda-pick.js`, as it was                     | `storybook-pick.test.ts` |

The pick script's cases run in `storybook-pick.test.ts`'s existing `pickFrame` harness. Together
with `pickText.test.ts`, they own the [Sandbox](/specs/decisions/sandbox.md) rule "A pick MUST be
copied to the clipboard as text that names the page, the element, and its source location": write a
ruling saying so.

- [x] **Step 2: Run them**

- Run: the new and changed test files, by path, under `nix develop -c vp test`.
- Expected: PASS; the existing `.test.tsx` files still pass.

- [x] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/web/src skills/uraeda/assets/storybook specs/2026-10-26-testing-communication
git commit -m "test(testing-communication): unit tests for the navigation, storage, and pick rules the UI tests guarded"
```

## Task 6: Judge the CLI's and the LSP's tests

**Files:**

- Modify: `crates/cli/tests/*.rs`, `crates/cli/src/**` (only `#[cfg(test)]` modules),
  `crates/lsp/tests/*.rs`

- [x] **Step 1: Judge each test** by [how a test is judged](#global-constraints), and remove the
      ones that go, listing them under [Removed tests](#removed-tests), "Task 6". The
      [CLI](/specs/decisions/cli.md) and [Problems](/specs/decisions/problems.md) decisions name
      "the CLI's tests": keep each test a rule of theirs relies on.

- [x] **Step 2: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-cli -p uraeda-lsp`, then
  `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add crates/cli crates/lsp specs/2026-10-26-testing-communication/plan.md
git commit -m "test(testing-communication): the CLI's and the LSP's tests, judged"
```

## Task 7: Judge the server's and the binding's tests

**Files:**

- Modify: `packages/server/src/**/__tests__/*.test.ts` and `packages/server/scripts/__tests__/`, but
  `toolchain.test.ts` and `test-run.test.ts` (task 10's), and `request-fixture.ts`, which the kept
  composer test uses; `packages/binding/*.test.ts`; `packages/uraeda/scripts/*.test.ts`

- [x] **Step 1: Judge each test** by [how a test is judged](#global-constraints), listing the
      removed ones under [Removed tests](#removed-tests), "Task 7". The decisions naming "the
      server's tests", "the runner's tests", "the sign-in store's tests", "the sign-in routes'
      tests", "the preview proxy's tests", "the notifier's tests", "the guard's tests", and "the
      package's smoke test" keep the tests their rules rely on.

- [x] **Step 2: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add packages/server packages/binding packages/uraeda specs/2026-10-26-testing-communication/plan.md
git commit -m "test(testing-communication): the server's and the binding's tests, judged"
```

## Task 8: The spec page draws the replaced behaviour

**Files:**

- Modify: `packages/web/src/spec/parts.ts` (`KNOWN_PARTS`), `SpecPage.tsx` (`Groups`),
  `SpecContents.tsx`
- Modify: a spec of `packages/web/samples/` that the sandbox serves, given a `## Replaced behaviour`
  section

**Interfaces:**

- Consumes: the `## Replaced behaviour` section of task 2.

- [x] **Step 1: Implement**

Draw `## Replaced behaviour` as its own group between the user stories and the "How it is built"
group, with its entry in the contents at the same place. No test: the Testing decision leaves this
view to the human's review in the sandbox. Built: the group sits right after the stories (before the
data), with the `uraeda:arrow-right-left` icon; the sandbox's sample spec gets its section from
`spec()` of `packages/web/samples/features.ts`, which inserts it before `## Architecture` in the
shared recurring-tasks fixture's text, so `fixtures/` stays untouched.

- [x] **Step 2: Look at it**

Run `vp run sandbox`, open the sample spec, and look at it at a phone's width and a desktop's, in
both themes, as the UI checks decision asks.

- [x] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/web specs/2026-10-26-testing-communication/plan.md
git commit -m "feat(testing-communication): the spec page draws the replaced behaviour"
```

## Task 9: Records are the pull request's text, and point forward

**Files:**

- Modify: `skills/uraeda/references/finish.md`, `implementation.md` (`## Pull request`), `change.md`
  (`## The pull request`), `conventions.md` (the record's checks), `cli.md` if it lists them
- Modify: `skills/uraeda/assets/templates/specs/done/YYYY-MM-DD-feature-slug.md` (placeholders),
  `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/rulings.md`
- Modify: `skills/uraeda/assets/example/specs/done/2026-10-06-recurring-tasks.md`,
  `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/rulings.md`

**Interfaces:**

- Consumes: task 1's ruling; task 2's fields and sections; task 3's `code-quality.md#testing`.

- [x] **Step 1: The finish step**

`finish.md` writes the record, then the pull request body from it, and owns:

- the record's new parts: `supersedes` and `superseded-by`; **Replaced behaviour**, the spec's list
  with the tests removed, and those removed by ruling; **Gotchas**, only what the code and tests do
  not show, one line each next to the choice it shaped, left out when there is none; **Changes after
  approval** holding the rulings that change behaviour;
- the supersession, on both sides: the new record's `supersedes` names each older record whose
  behaviour it replaces; each older record gains `superseded-by` and one line under its title,
  "Superseded in part by" and a link to the newer record, one per newer record, in the finishing
  commit, and nothing else in it changes;
- the body: the opening block, "Pull request to review, about N minutes", with the points needing
  attention; then the record's text, its links made absolute at the finishing commit; then one
  screenshot per new view, attached as task 1's ruling says, or the line saying there is none and
  the sandbox command. Small changes to the record's text for the body are allowed, such as the
  screenshot; no size table, no list of tests changed, no rulings section.
- "After the merge": a merged record is edited only to fix a broken link, or to add `superseded-by`
  and its line.

- [x] **Step 2: The steps that pointed to their own body**

`implementation.md`'s `## Pull request` and `change.md`'s `## The pull request` keep when the pull
request opens and is marked ready, and point to the finish step for the body, dropping their lists
of sections. The final review's size list and removed-test list go to the record or the opening
block, as the finish step says.

- [x] **Step 3: Templates and the example**

- The record template's placeholders for the new fields and sections, and their order as task 2 set
  it.
- The rulings template: **Alternatives considered** and **If wrong** optional.
- The example's record gains a **Gotchas** line from its ruling R1, that `user-event` waits on fake
  timers that never fire unless told to advance them, next to the test helper it shaped; one of the
  example's rulings shows the two optional fields left out.
- `conventions.md`'s list of record checks gains the pairing.
- Built: the older record's "Superseded in part by" line is the last paragraph of its opening
  `> [!NOTE]` block, since `ura check` wants a record to open with it; the finish step also allows
  "Superseded by" for a record replaced in whole. The example's record has its Gotchas, so the
  core's `replaced_behaviour_and_gotchas_are_optional_sections_in_their_place` inserts Replaced
  behaviour before them instead of adding both.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c cargo run -q -p uraeda-cli -- check specs`, and the same on
  `skills/uraeda/assets/example/specs`
- Expected: PASS, the example with no problem and its spec within its word limit.

- [x] **Step 5: Commit**

```bash
git add skills specs/2026-10-26-testing-communication/plan.md
git commit -m "docs(testing-communication): records are the pull request's text, and point forward"
```

## Task 10: Remove the browser runner

**Risky:** it changes `ready`, CI, and the toolchain configuration's test, which every later push
relies on.

**Files:**

- Delete: `packages/web/src/__browser__/`, `packages/web/vite.browser.config.ts`,
  `packages/web/vite.browser.color-scheme.ts`
- Create: the contrast functions (`luminance`, `contrast`, and their private helper) beside the
  theme, such as `packages/web/src/theme/contrast.ts`
- Modify: `packages/web/src/__tests__/theme-tokens.test.ts` (its import), the root `vite.config.ts`
  (`test.projects`, the `__browser__` exemptions), `vite.tasks.ts` (the `browser:*` tasks, the
  `ready:browser-*` groups, `browserRun`, the browser test environment variables only the browser
  config read, the project exclusions), `.github/workflows/ci.yml` (the two browser jobs, the header
  comment), `packages/server/src/__tests__/toolchain.test.ts` (its browser assertions, helpers, and
  fixture cases), `scripts/fast-selection.ts` (`deferred`) and
  `scripts/__tests__/fast-selection.test.ts`, `scripts/test-weights.json` (the `desktop:` and
  `phone:` keys), `packages/web/package.json` (`@vitest/browser-playwright`, `axe-core`),
  `pnpm-lock.yaml`, `packages/web/tsconfig.json`, `packages/web/vite.config.ts` (the exclusion),
  `README.md` (the WebKit line)

**As built:** `luminance` and `contrast` moved to `packages/web/src/theme/contrast.ts`. No task or
test needs the dev shell's Playwright, font, and EGL variables once the browser runner is gone
(`ui:smoke`, `rust:test`, and `ts:test` never used a browser), so `testEnv` is removed whole, and
`ts:test` and `coverage` run `vp test` with no `--project` exclusions. The shell keeps its variables
for the screenshot scripts, and `playwright` stays in `packages/web`. The toolchain test's stripping
of comments keeps strings whole ([R7](rulings.md)).

**Interfaces:**

- Produces: no `browser:*` task, no browser project, and `ready` without browser groups.
  `playwright` stays for `packages/web/scripts/screenshots.ts`, with the flake's variables.

- [x] **Step 1: Move the contrast functions**, then run `theme-tokens.test.ts`: PASS.

- [x] **Step 2: Remove the runner and its configuration**, as the files list. Keep the toolchain
      test's rules that still apply (no retries, isolation, `ready` and CI in step); remove the ones
      only the browser needed. Record the removed browser files under
      [Removed tests](#removed-tests), "Task 10", one row each with what it guarded.

- [x] **Step 3: Run the task's validation**

- Run: `nix develop -c vp install`, `nix develop -c vp run fast`, then `nix develop -c vp run ready`
- Expected: PASS; `ready` runs no browser.

- [x] **Step 4: Commit**

```bash
git add -A packages/web packages/server scripts vite.config.ts vite.tasks.ts .github pnpm-lock.yaml README.md specs/2026-10-26-testing-communication/plan.md
git commit -m "test(testing-communication): remove the browser runner and its tests"
```

## Task 11: Judge the core's tests

**Files:**

- Modify: `crates/core/tests/*.rs`, `crates/core/tests/common/`, and the `#[cfg(test)]` modules of
  `crates/core/src/`

- [x] **Step 1: Judge each test** by [how a test is judged](#global-constraints), listing the
      removed ones under [Removed tests](#removed-tests), "Task 11". Most core tests own stored
      formats, git, and contracts: expect most to stay. The decisions naming "the core's tests" and
      "the core's workspace tests" keep the tests their rules rely on, and task 2's tests stay.

- [x] **Step 2: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-core`, then `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add crates/core specs/2026-10-26-testing-communication/plan.md
git commit -m "test(testing-communication): the core's tests, judged"
```

## Task 12: Remove the web UI's rendering tests

**Files:**

- Delete: every `.test.tsx` of `packages/web/src/__tests__/` not in
  [Kept web UI tests](#kept-web-ui-tests)
- Modify: the kept `.test.tsx` files, cut to the tests the table keeps;
  `src/__focused__/composer.test.tsx`; `src/__tests__/helpers.tsx` and `src/__focused__/helpers.tsx`
  (exports no test uses any more); `links.test.ts` and `routes.test.ts`, judged as rendering tests;
  `scripts/fast-selection.ts` (the `ui` family's test list) and
  `scripts/__tests__/fast-discovery.test.ts`, `fast-selection.test.ts`; the `uraeda-web:` keys of
  `scripts/test-weights.json` for deleted files; the root `vite.config.ts` lint override naming
  `session-cost.test.tsx`

**Interfaces:**

- Consumes: tasks 4 and 5's unit tests, which must be on the branch first.

- [x] **Step 1: Cut the kept files**, removing their other tests, the `Profiler` mock and render
      counts in `review.test.tsx`, and render or call counts in `notify.test.tsx`.

- [x] **Step 2: Delete the rest**, recording each file under [Removed tests](#removed-tests), "Task
      12", with what it guarded; then remove the helpers no test uses.

- [x] **Step 3: Fix the fast check's lists**, so the discovery tests name files that remain.

As built: every kept test's name matched the table as written. `review.test.tsx` lost its `Profiler`
mock of `Blocks.tsx` and its render-count test; `notify.test.tsx` lost nothing, no test of it being
a render or call count alone. `links.test.ts` and `routes.test.ts` lost the tests that draw the app
(SC-003's every-link-has-the-prefix over twelve pages, a change's round linking its decision, the
redirects of the old addresses, a new session's first message) and the spied scroll of Back, and
keep their pure rows. The `ui` family's list drops `composer-images` and its `.tsx` extension, and
the discovery test for `ComposerImages.tsx` expects `composer.test.tsx` alone; the selection test
names no file that existed, so it did not change. `scripts/test-weights.json` lost the 52 keys of
the deleted `.test.tsx` files, `session-aside.test.tsx`'s stale one included. The
`__tests__/helpers.tsx` exports no remaining test uses went with the tests that used them, and
`atWidth`, `Binding`, and `Fake` stay inside the file.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then `nix develop -c vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add -A packages/web scripts vite.config.ts specs/2026-10-26-testing-communication/plan.md
git commit -m "test(testing-communication): the web UI keeps only its extremely useful tests"
```

## Task 13: Judge the other TypeScript tests

**Files:**

- Modify: `packages/web/src/__tests__/*.test.ts` (but `links.test.ts`, `routes.test.ts`, and the
  files tasks 4 and 5 created), `packages/web/samples/__tests__/`,
  `packages/web/sandbox/__tests__/`, `packages/benchmarks/src/__tests__/`, `scripts/__tests__/` (but
  `fast-selection.test.ts` and `fast-discovery.test.ts`); the `uraeda-web:` weights of files it
  deletes

- [x] **Step 1: Judge each test** by [how a test is judged](#global-constraints), listing the
      removed ones under [Removed tests](#removed-tests), "Task 13". Keep the tests decisions name:
      `lint.test.ts` (Code quality), `theme-tokens.test.ts` and `offline-build.test.ts` (UI look),
      the sandbox's tests (Sandbox), the runner's tests (Benchmarks).

- [x] **Step 2: Run the task's validation**

- Run: `nix develop -c vp run fast`, then `nix develop -c vp run ready`
- Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add -A packages/web packages/benchmarks scripts specs/2026-10-26-testing-communication/plan.md
git commit -m "test(testing-communication): the other TypeScript tests, judged"
```

## Task 14: Evaluate the wording with Claude Code and Sonnet

Run by the coordinator, outside the repository: only the scores and the wording reach it.

**Files:**

- Modify: the skill's wording tasks 3 and 9 wrote, between runs
- Modify: `specs/2026-10-26-testing-communication/rulings.md` (the runs' setup and scores, for the
  record)

**Interfaces:**

- Consumes: tasks 2, 3, and 9 merged.

- [ ] **Step 1: Set up the copies**

A run is one clone of this repository at the branch's start (the commit before task 1), on the same
disk, with its `origin` removed, and the skill's wording under test copied over its
`skills/uraeda/`: the start's wording for an "old" run, this branch's for a "new" one. The core's
templates are embedded, so a copy's `cargo run -p uraeda-cli -- check` uses its own. The run is told
to follow `skills/uraeda/SKILL.md` of its own checkout, never an installed skill; the first run's
transcript is checked for the `SKILL.md` it read. Each copy holds the evaluation feature's folder,
with its spec approved, so the run writes the plan and builds it, and stops before pushing.

The evaluation feature, small, in the core, with logic and a contract: **Record dates**.

- New: `ura check` warns when a record's `finished` date is before the date its name starts with:
  `finished 2026-10-05 is before the record's start, 2026-10-06`.
- Replaced: a record's `kind` may also be `chore`, for a maintenance branch finished without a spec.
  Today `chore` is refused, and `crates/core/tests/check.rs`'s "record kind" row asserts
  `kind "chore" is not one of feature, change`. The new wording's copy lists it under the spec's
  replaced behaviour; the old wording's copy says it in the architecture.

- [ ] **Step 2: Run and score**

Up to 12 runs of `claude -p --model sonnet`, at most 2 old and the rest new. Score each run's added
and changed tests by:

- **SC-002**: the "record kind" test changed or replaced, and no code kept for `chore`'s refusal.
- **SC-003**: added tests at most the spec's key scenarios plus its high edge cases; two fresh
  reviewers, and the OpenCode reviewer through its skill, find no test repeating another's coverage.
- **SC-004**: the added tests finish in under 10 seconds.
- **SC-001**: no assertion of markup, a class name, a size, a call sequence, or private state.

- [ ] **Step 3: Revise the wording** between runs where a run fails a criterion, keeping it generic
      (SC-007). Stop when SC-002 to SC-004 hold in three new runs in a row, or after five revisions,
      whichever comes first (SC-008); with the 12-run cap reached first, stop there, and say which.

- [ ] **Step 4: Commit**

```bash
git add skills specs/2026-10-26-testing-communication/rulings.md specs/2026-10-26-testing-communication/plan.md
git commit -m "docs(testing-communication): the testing wording, tuned by the evaluation"
```

## Task 15: The record's lists, and SC-001

**Files:**

- Modify: `specs/2026-10-26-testing-communication/plan.md`; the tests the reading found:
  `columnWidth.test.ts`, `document-column.test.ts`, `diagram.test.tsx`, `useDraft.test.ts`

- [x] **Step 1: Read every changed test of the branch** for SC-001: none asserts markup, a class
      name, a size, a call sequence, or private state. Fix a finding as the final review would.

- [x] **Step 2: Check [Removed tests](#removed-tests)** against `git diff` of the branch: each
      removed test is there, by file and behaviour, for the record's **Replaced behaviour**.

- [x] **Step 3: Commit**

```bash
git add specs/2026-10-26-testing-communication/plan.md
git commit -m "docs(testing-communication): the removed tests, checked against the branch"
```
