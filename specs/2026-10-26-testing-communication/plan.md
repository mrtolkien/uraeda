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

### Kept web UI tests

Each `.test.tsx` of `packages/web` kept, the tests it keeps, and the cost each guards. Every other
`.test.tsx` of `src/__tests__`, `src/__browser__`, and `src/__focused__` is removed, its logic rules
first extracted (tasks 4 and 5). The browser tests' two weak candidates go with the runner: their
logic is extracted, and their wiring is left to review.

| File                                     | Tests kept                                                                                                                                                                                                                                                                          | Cost guarded                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/__focused__/composer.test.tsx`      | "a refused send reaches the endpoint, then restores its exact text, images and reason"                                                                                                                                                                                              | a refused message lost silently                                                               |
| `src/__tests__/editor.test.tsx`          | "Commit saves the text typed, then commits it (US2 4)"; "Commit stops when the text could not be saved"; "a save over a change made elsewhere keeps the text, and offers the new version"                                                                                           | a commit of the wrong text; a file overwritten                                                |
| `src/__tests__/round.test.tsx`           | "Submit saves a comment not saved yet"; "Submit stops when an answer could not be saved"; "a comment being written is not replaced by an answer changed elsewhere"; "Submit writes the edit of a comment renumbered by a removal into that comment"                                 | answers committed without the typed text, or into the wrong comment                           |
| `src/__tests__/review.test.tsx`          | "a verdict with an open comment holding text is refused"; "Request changes during an upload is refused, and commits nothing"; "a comment restored after the reviewed commit changed is a general one"; "an edit of a review comment follows it when a comment before it is removed" | a verdict committed without a comment; a comment on the wrong lines                           |
| `src/__tests__/leave.test.tsx`           | "a link away from unsaved text asks first; Stay keeps the page, Leave page leaves"; "Back from unsaved text asks first, the page staying while it asks"                                                                                                                             | typed text lost on navigation                                                                 |
| `src/__tests__/new-page.test.tsx`        | "a start that answers late clears only the text and slug it sent"                                                                                                                                                                                                                   | newer typed text cleared by a late answer                                                     |
| `src/__tests__/sign-in.test.tsx`         | "unsaved text survives a sign-out"                                                                                                                                                                                                                                                  | typed text lost when the app swaps to sign-in                                                 |
| `src/__tests__/diagram-hostile.test.tsx` | the whole file                                                                                                                                                                                                                                                                      | a script run from a diagram: [Diagrams](/specs/decisions/diagrams.md) names it                |
| `src/__tests__/diagram.test.tsx`         | the tests of a diagram that fails to draw showing its source                                                                                                                                                                                                                        | the rule [Diagrams](/specs/decisions/diagrams.md) checks by "the diagram's tests"             |
| `src/__tests__/notify.test.tsx`          | the whole file, but a render or call count                                                                                                                                                                                                                                          | the rules [Notifications](/specs/decisions/notifications.md) checks by "the notifier's tests" |

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
  `nix develop -c cargo run -q -p uraeda-cli -- check specs skills/uraeda/assets/example/specs`
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
  `nix develop -c cargo run -q -p uraeda-cli -- check specs skills/uraeda/assets/example/specs`
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

- [ ] **Step 2: Look at it**

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

- [ ] **Step 1: The finish step**

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

- [ ] **Step 2: The steps that pointed to their own body**

`implementation.md`'s `## Pull request` and `change.md`'s `## The pull request` keep when the pull
request opens and is marked ready, and point to the finish step for the body, dropping their lists
of sections. The final review's size list and removed-test list go to the record or the opening
block, as the finish step says.

- [ ] **Step 3: Templates and the example**

- The record template's placeholders for the new fields and sections, and their order as task 2 set
  it.
- The rulings template: **Alternatives considered** and **If wrong** optional.
- The example's record gains a **Gotchas** line from its ruling R1, that `user-event` waits on fake
  timers that never fire unless told to advance them, next to the test helper it shaped; one of the
  example's rulings shows the two optional fields left out.
- `conventions.md`'s list of record checks gains the pairing.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c cargo run -q -p uraeda-cli -- check specs skills/uraeda/assets/example/specs`
- Expected: PASS, the example with no problem and its spec within its word limit.

- [ ] **Step 5: Commit**

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

**Interfaces:**

- Produces: no `browser:*` task, no browser project, and `ready` without browser groups.
  `playwright` stays for `packages/web/scripts/screenshots.ts`, with the flake's variables.

- [ ] **Step 1: Move the contrast functions**, then run `theme-tokens.test.ts`: PASS.

- [ ] **Step 2: Remove the runner and its configuration**, as the files list. Keep the toolchain
      test's rules that still apply (no retries, isolation, `ready` and CI in step); remove the ones
      only the browser needed. Record the removed browser files under
      [Removed tests](#removed-tests), "Task 10", one row each with what it guarded.

- [ ] **Step 3: Run the task's validation**

- Run: `nix develop -c vp install`, `nix develop -c vp run fast`, then `nix develop -c vp run ready`
- Expected: PASS; `ready` runs no browser.

- [ ] **Step 4: Commit**

```bash
git add -A packages/web packages/server scripts vite.config.ts vite.tasks.ts .github pnpm-lock.yaml README.md specs/2026-10-26-testing-communication/plan.md
git commit -m "test(testing-communication): remove the browser runner and its tests"
```

## Task 11: Judge the core's tests

**Files:**

- Modify: `crates/core/tests/*.rs`, `crates/core/tests/common/`, and the `#[cfg(test)]` modules of
  `crates/core/src/`

- [ ] **Step 1: Judge each test** by [how a test is judged](#global-constraints), listing the
      removed ones under [Removed tests](#removed-tests), "Task 11". Most core tests own stored
      formats, git, and contracts: expect most to stay. The decisions naming "the core's tests" and
      "the core's workspace tests" keep the tests their rules rely on, and task 2's tests stay.

- [ ] **Step 2: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-core`, then `nix develop -c vp run fast`
- Expected: PASS.

- [ ] **Step 3: Commit**

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

- [ ] **Step 1: Cut the kept files**, removing their other tests, the `Profiler` mock and render
      counts in `review.test.tsx`, and render or call counts in `notify.test.tsx`.

- [ ] **Step 2: Delete the rest**, recording each file under [Removed tests](#removed-tests), "Task
      12", with what it guarded; then remove the helpers no test uses.

- [ ] **Step 3: Fix the fast check's lists**, so the discovery tests name files that remain.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then `nix develop -c vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Judge each test** by [how a test is judged](#global-constraints), listing the
      removed ones under [Removed tests](#removed-tests), "Task 13". Keep the tests decisions name:
      `lint.test.ts` (Code quality), `theme-tokens.test.ts` and `offline-build.test.ts` (UI look),
      the sandbox's tests (Sandbox), the runner's tests (Benchmarks).

- [ ] **Step 2: Run the task's validation**

- Run: `nix develop -c vp run fast`, then `nix develop -c vp run ready`
- Expected: PASS.

- [ ] **Step 3: Commit**

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

- Modify: `specs/2026-10-26-testing-communication/plan.md`

- [ ] **Step 1: Read every changed test of the branch** for SC-001: none asserts markup, a class
      name, a size, a call sequence, or private state. Fix a finding as the final review would.

- [ ] **Step 2: Check [Removed tests](#removed-tests)** against `git diff` of the branch: each
      removed test is there, by file and behaviour, for the record's **Replaced behaviour**.

- [ ] **Step 3: Commit**

```bash
git add specs/2026-10-26-testing-communication/plan.md
git commit -m "docs(testing-communication): the removed tests, checked against the branch"
```
