# Rulings: Fix testing

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The record of old tests lives in the rulings

- **Decision**: each area's task adds a ruling listing its old test files, each with the flow that
  replaces its behaviour or the rule that dropped it, and the coverage before and after.
- **Rationale**: SC-005 asks for a record of every old test file, and the rulings are the plan's
  place for choices made while building: no new file kind for `ura check` to reject.
- **Alternatives considered**: a separate inventory file, which the workflow has no template for.
- **If wrong**: move the rulings' tables to the record in `specs/done/` when the feature finishes.
- **Where**: tasks 4 to 10 of the plan.

## R2: The fast check's SC-002 time, and where it differs from the plan

- **Decision**: `vp run fast` runs `scripts/fast-check.ts`, uncached, on the working tree's changes
  against the last commit, or the last commit's files when the tree is clean (`vp run fast main`
  takes the whole branch). Its test lives in `packages/server/src/__tests__/fast-check.test.ts`,
  where `coverage-summary.test.ts` already tests a script: no Vitest project covers `scripts/`. A
  Rust or skill change relates the TypeScript tests to `packages/binding/index.js`, so Vitest's
  module graph finds the tests loading the binding; a root config file is never related, since every
  test loads it.
- **SC-002 measured**: on the old suites, after a one-line edit of one web file, `vp run fast` took
  3 minutes 12 seconds for `Composer.tsx` and 3 minutes 11 seconds for the leaf `Crumbs.tsx`: 51 of
  the 53 related test files run, 838 tests, 180 seconds of them. `vp check` takes about 7 seconds
  and the rest of the run about 10. SC-002 is not met yet: the old web tests each build a real
  repository and reach almost every component through `App`. Task 10 measures it again on the new
  flows.
- **Rationale**: a task is one commit, so the branch's older changes were checked by their own task
  (a branch diff re-ran every test after a `vite.tasks.ts` change of an earlier task).
- **Alternatives considered**: the diff to the merge base, which grows with the branch.
- **If wrong**: pass `main` as the argument to check the whole branch.
- **Where**: [`scripts/fast-check.ts`](/scripts/fast-check.ts), task 3 of the plan.

## R3: The core, CLI, and LSP tests are three flow binaries

- **Decision**: `crates/*/tests/flows/` hold the flows, one binary per crate, built before the old
  tests went. The 64 integration test files and the 33 unit tests of `crates/*/src` are deleted.
  Each old file maps to the flows that replace its behaviour, or to the rule that drops what no flow
  keeps. No file is unplaced. The shared helpers (`tests/common/`) stay.
- **Rationale**: [SC-005](spec.md#success-criteria) asks for the record. The flows run the real
  `ura` binary, the real language server, and the core's public API on real git repositories, and
  assert exit codes, JSON, files, and git, never a message's words.
- **Alternatives considered**: keeping the unit tests of pure logic: the ones worth keeping became
  table rows of a flow (`clock`, `text_kept`, `draft_images`), the others test text or only observe.
- **If wrong**: a behaviour a regression shows is missing gets a flow, from the list of what no
  longer runs.
- **Where**: task 4 of the plan, `crates/core/tests/flows/`, `crates/cli/tests/flows/`,
  `crates/lsp/tests/flows/`.

Before and after, measured the same way (`cargo nextest run`, `cargo llvm-cov nextest`, product
lines only, the old tests' own lines left out):

| Measure                    | Before                                 | After                                  |
| -------------------------- | -------------------------------------- | -------------------------------------- |
| Tests                      | 1039, 10 skipped, 1 failing            | 204 (core 112, CLI 59, LSP 33)         |
| Run time (nextest summary) | 17 s                                   | 4 s                                    |
| Line coverage              | 93.6 % (core 95.1, CLI 73.8, LSP 95.4) | 84.5 % (core 85.3, CLI 66.4, LSP 94.3) |

The one failing test, `ledger::the_ledger_reads_the_constitution`, pinned the constitution's version
`1.3.1` and its amendment date, which the human amended to 2.0.0: a test that failed without a bug,
deleted here. The ledger flow asserts that a version and the principles are read, not their values.

The rules ending "Checked by ... tests", and the flow that keeps each:

| Rule                                                                         | Flow                                                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| git: never lose the user's work                                              | CLI `clean` (the worktree, the unmerged commits, the checkout, the lock), core `git_contract`               |
| git: never bypass hooks, never switch the checkout                           | core `git_contract`; CLI `answers`, `start`, `reviews`; LSP `writes`, `commands` (the hook runs, a refusal) |
| git: a branch is read from its latest commit                                 | core `steps::a_branch_is_read_only_from_its_latest_commit`                                                  |
| git: drafts, backlog, inbox, priorities on the default branch                | core `notes`, CLI `notes`, LSP `commands`                                                                   |
| git: worktrees out of `git status`                                           | core `git_contract::worktrees_are_reused_and_stay_out_of_git_status`                                        |
| repositories: the list is data, once per main checkout, removal leaves files | core `repositories`; CLI `start` (`ura add`)                                                                |
| repositories: presentation is the UI's                                       | core `repositories::the_ui_presentation_of_an_item_is_kept_apart_from_the_repository`                       |
| settings: one file in the config folder, a write keeps the human's file      | core `settings`                                                                                             |
| attachments: beside the file, linked relatively, SVG refused, safe WebP      | core `attachments`, `draft_images`; LSP `commands` (an image)                                               |
| problems: a note unless it stops the workflow, decided in the core           | core `check` (the problem and note flows, `BLOCKING`)                                                       |
| problems: `ura check` reports every result at its own severity               | CLI `check`                                                                                                 |
| cli: every action without a terminal                                         | CLI `install`, `start`, `answers`, `notes`, `clean`, `lsp_command` (stdin is never a terminal)              |
| cli: versioned JSON on every read command                                    | CLI `next_status` (status, next), `check`                                                                   |

What replaces each old file:

| Old file (tests)                                                                                   | Flow or rule                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| core `actions` (68)                                                                                | `rounds`, `text_kept`, `reviews`. Dropped: the composed answer text of each letter choice, each line variant of a settled comment (assert text, duplicate).                                                                                                                  |
| core `answered` (7)                                                                                | `views::a_revision_keeps_the_review_it_answers...`. The other git shapes (merged, squashed, uncommitted) are dropped as duplicates of it.                                                                                                                                    |
| core `api` (26)                                                                                    | `api_files`, `notes`, `rounds`, `repositories`, `settings` (writes at once). Dropped: spans of priority lines, a feature's file order (read models the web flows read).                                                                                                      |
| core `attach` (18)                                                                                 | `attachments`, `draft_images`. Dropped: the failed-write rollbacks by read-only permissions (skip as root, depend on the machine).                                                                                                                                           |
| core `branch_changes` (1 + cases)                                                                  | `runs`. Dropped: the cap of 50 files (a count), the timing test (elapsed time), the merged, orphan, and moved variants (duplicates).                                                                                                                                         |
| core `check` (69)                                                                                  | `check`: the example passes, 13 slips each by its rule, the broken fixtures, problem against note, severity. Dropped: each rule's message, line, and column (text and counts).                                                                                               |
| core `clean` (15)                                                                                  | CLI `clean`. Dropped: the squash-merge and no-origin variants, which the core API tests twice (duplicate of the CLI).                                                                                                                                                        |
| core `decision_change` (27)                                                                        | `decisions` (kinds, a decision as the branch has it). Dropped: the part-by-part comparison, which pins words and counts of a text diff.                                                                                                                                      |
| core `decisions_bar` (2)                                                                           | Dropped: reads this repository's decisions for the words of their rules (a lint of prose, no behaviour; it fails when a human rewrites a decision).                                                                                                                          |
| core `decisions_check` (11)                                                                        | `decisions` (candidates against the active decision, the constitution and a stray folder, candidates checked as decisions).                                                                                                                                                  |
| core `default_rounds` (6), `triage` (13)                                                           | `rounds::the_triage_and_the_decisions_check_are_answered...`. Dropped: the other triage variants (duplicates of the round flows).                                                                                                                                            |
| core `document` (20), `items` (26), `stories` (5), `proposal` (7), `fields` (7)                    | `views` (the example reads as the items its pages show); `fields` is LSP `fields`. Dropped: span, callout, table, and marker details (the web flows assert the structure).                                                                                                   |
| core `files` (39)                                                                                  | `text_kept`, `check`, `views`, `settings`, and the CLI's tier flows (a frontmatter edit keeps the rest). Dropped: the parse tables of frontmatter, lines, and markdown.                                                                                                      |
| core `git` (20)                                                                                    | `git_contract`. Dropped: the reads (branches, default branch, merge base, ancestry), which the workspace, clean, and history flows run.                                                                                                                                      |
| core `history` (24)                                                                                | `history` (stages by commit, a merge, a squash). Dropped: the rebase, review-fix, and live variants (duplicates).                                                                                                                                                            |
| core `images` (13)                                                                                 | `attachments`. Dropped: the timing bench, the corpus under 2400 KiB, exact output sizes, the lossy against lossless choice, the bounded-memory test of an iCCP bomb (sizes, time, instrumentation).                                                                          |
| core `inbox` (15), `inbox_actions` (23), `inbox_images` (10), `inbox_moves` (36), `inbox_undo` (8) | `notes`, `undo`. Dropped: the marks, line-ending, and nested-code variants, the commit subject texts, and the undo variants past the flows.                                                                                                                                  |
| core `ledger` (14)                                                                                 | `decisions::the_ledger_holds_the_constitution_and_every_decision...`. Dropped: dates of last change, summaries, titles (text).                                                                                                                                               |
| core `preview` (3), `pulls` (2), `slug` (3), `runs` (8)                                            | `views`, `runs`, `clock`.                                                                                                                                                                                                                                                    |
| core `priorities` (40)                                                                             | `notes` (edit, move, commit, insert, draft), `draft_images`. Dropped: the parse and key tables (pure structure).                                                                                                                                                             |
| core `repositories` (22)                                                                           | `repositories`. Dropped: the names table (text), the platform table is kept.                                                                                                                                                                                                 |
| core `settings` (17), `settings_writes` (10)                                                       | `settings`. Dropped: each message and host-name row (text; the accepted and refused names are a table), `shown` paths.                                                                                                                                                       |
| core `steps` (23), `workspace` (30)                                                                | `steps` (the step table, the pull request table, the latest commit, merged is done, a listed decision). Dropped: the order numbers and the record's views.                                                                                                                   |
| core `this_repository` (4, ignored)                                                                | Dropped: measures on this repository's own history, ignored by default and dependent on the machine (the `specs:check` task checks the specs).                                                                                                                               |
| core `unapproved` (16)                                                                             | `decisions` (edited after approval, activated, uncommitted).                                                                                                                                                                                                                 |
| core `watch` (19), `worktrees` (9)                                                                 | `watch`, `git_contract`.                                                                                                                                                                                                                                                     |
| CLI `add` (6), `init` (9), `install` (30)                                                          | `start::a_repository_is_added...`, `install` (init, install, update, links, failure). Dropped: the terminal pickers and the interactive question (text, need util-linux `script`).                                                                                           |
| CLI `answer` (14), `fixes` (17), `review` (15), `start` (18)                                       | `answers`, `reviews`, `start`, `check`. Dropped: each output line (messages).                                                                                                                                                                                                |
| CLI `check` (9), `draft` (9), `next` (9), `note` (15), `status` (18), `targets` (7), `clean` (8)   | `check`, `start`, `next_status`, `notes`, `clean`. Dropped: the printed tables and sentences, the terminal and editor tests of `draft`.                                                                                                                                      |
| CLI `lsp` (1)                                                                                      | `lsp_command`.                                                                                                                                                                                                                                                               |
| CLI `skill` (2)                                                                                    | `repo_rules::every_command_of_the_cli_is_named_in_the_skill`. The length of `SKILL.md` is dropped, as the spec says.                                                                                                                                                         |
| CLI `structure` (4)                                                                                | `repo_rules::rust_source_files_stay_under_500_lines...` (the code quality decision's limit no linter has). The three tests of its own helpers are dropped.                                                                                                                   |
| CLI `performance` (1 + bench)                                                                      | Dropped: assert elapsed time.                                                                                                                                                                                                                                                |
| LSP `commands` (39)                                                                                | `commands`, `writes`. Dropped: the progress texts, the wrapped-entry and sub-item variants.                                                                                                                                                                                  |
| LSP `diagnostics` (8)                                                                              | `diagnostics`. The 300 ms bench is dropped (elapsed time).                                                                                                                                                                                                                   |
| LSP `editing` (13), `reads` (16)                                                                   | `reads` (completion, outline, code actions, items, comments, verdict, waiting, hints), `fields` (fields from the open text, an edit that keeps the comment and CRLF, a typed value, a verdict refused as an edit). Dropped: the exact hint labels and symbol details (text). |

The 33 unit tests of `crates/*/src`: `today` (3) is the `clock` flow; `clarifications` (4) and its
`notes` (3) are `text_kept`; `retarget` (1) and `attach` (1) are `draft_images`; `record` (1) is
`history::a_merged_feature_is_timed_to_its_merge` (its questions); the unit test of the history
parser (1) is `runs::a_renamed_file_and_an_unusual_path_are_listed_by_their_new_path`; `history` (2)
and `history/stages` (1) are `history::each_stage_starts_at_the_first_commit_of_its_kind`; CLI
`status` (1) is `next_status::merged_features_are_done_once...`; `proposal` (1) is
`attachments::an_image_is_committed_beside_its_file_and_linked_relatively`. Dropped by rule: the
`picker` (7) and `upgrade` (5) tests assert drawn text and the commands an upgrade runs (text, and
no flow can run an upgrade), and CLI `install` (2) read the answers of the interactive picker, a
path no flow runs (the non-interactive install is the flows').

What the area no longer runs: by the coverage report, 1,748 fewer product lines are covered, mostly
the individual `ura check` rules past their slips (`check/names`, `check/links`), the inbox and
priorities edits past the flows (`actions/inbox`, `actions/priorities`, `api/inbox_edits`,
`files/priorities`), the part comparison of a decision (`decisions/change`), the read models
(`files/document`, `files/lines`, `history/figures`), the terminal pickers and the upgrade command
of the CLI, and the LSP's code actions on lines that are not fields. A regression there shows first
in a flow of another area, or in a human's review.

The breaks, run by hand: each flow of a write, git, or security rule was shown failing on the
realistic mistake, made in the code, then reverted. The list, with the flow that fails, is the body
of the flows commit: a step read from the disk, a commit with `--no-verify`, the inbox written in
the current checkout, a clean that forces a worktree out, an install written through a link, a file
served through a link, a verdict over a changed buffer, a step read from the tip's parent (the
spec's own US1 3 break), and 23 more (31 breaks, 30 of them failing a flow). One was not caught
alone: the draft-path check of a start, which the core's start repeats, so its flow guards the
outcome of both.

The `Cargo.toml` change, outside the plan's files: the `image` and `libwebp-sys` crates are
optimized in the dev profile, since the image flows encode photos and an unoptimized encoder took 8
s of a 10 s run (3 s now). If wrong: remove the two `[profile.dev.package.*]` tables, and the flows
take 7 s more.
