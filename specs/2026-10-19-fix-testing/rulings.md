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

## R4: The server's old tests, and the flows that replace them

- **Decision**: the server's 51 old test files (895 tests, 53 seconds) are replaced by 14 flow files
  in [`packages/server/src/__flows__/`](/packages/server/src/__flows__/) (161 tests, 11 seconds with
  the three kept files' 43), and the three files other tasks own stay. A flow is written from the
  decision's rule and the product's routes, never from an old test; the rule it owns is in its
  header. A test of a security rule is table-driven over what the product has: `access.test.ts`
  reads every route from the app's own routing table, so a route added without a row fails it. The
  helpers `__tests__/helpers.ts`, `__tests__/live-stream.ts`, `preview/__tests__/helpers.ts`, and
  the three benchmarks (`*.bench.ts`: success criteria, not tests) stay, as the flows and the
  benchmarks use them.
- **Flows**: `access` (A), `sign-in` (S), `preview` (P), `runner` (R), `claude` (C), `repositories`
  (Rp), `attachments` (At), `settings` (St), `fate` (F), `inbox` (I), `live` (L), `needs-you` (N),
  `files` (Fl), and `start` (Sr), the server as `main.ts` runs it, in its own process.
- **Where the plan differs**: `vp test --project server` names no project: it is
  `--project uraeda-server`. `__flows__/helpers.ts` is new, beside the kept helpers; no file moved.
- **Rules ending "Checked by ..." and their flow**: stack, listens on loopback only (Sr, `vp dev`
  too) and accepts only its own pages and secret frames (A), no write from a preview's frame (P);
  the embed's sandbox is the web's (Task 6), and the proxy's and the mockups' sandbox headers are
  P's and Fl's; it stops its Storybooks when it stops (P). Sign-in: the table over every route (A),
  key and sessions never stored as shown, 30 days, sign-out ends streams, a new key, failures (S),
  the frame secret and no credentials to a process (P). Repositories: scoped by name, each with its
  own endpoint and live updates (Rp, L). Attachments: chat images out of git, served so a browser
  cannot run them (At). Settings: the order, a flag never written (St). Agents: one neutral shape
  (R, C), the least permission, one session per feature in its worktree (R). Notifications: listed
  only as the server's statuses say (N). The notifier's rules 2 to 5 (permission asked only after
  the explanation, no interruption of a viewer, the click, the tab's title) are the page's, not the
  server's: they are not covered here and belong to Task 6.
- **Breaks, run by hand and reverted**: 37, listed in the flows' commit bodies, and each made its
  flow fail: the session check letting every request through, a path dropped from `SERVER_PATHS`, a
  route added outside it, the guard skipping the host check, any frame secret accepted, the proxy
  forwarding the cookie, dropping the sandbox, or forwarding writes, a mockup unsandboxed, a chat
  image saved in the repository, an image without `nosniff` or its CSP, an upload while the agent
  works, the cleanup deleting an image a message holds, routes reading the most recent repository,
  the file winning over the flag, listening on `0.0.0.0` (the server, and `vp dev`), a session that
  never ends, a sign-out that keeps the stream, a new key that keeps the sessions, a key stored as
  shown, a sign-out that keeps the frame secret, a stop that leaves the Storybooks, a start that
  leaves a killed server's, permissions bypassed, the agent in the main checkout, an image path
  taken as given, a commit bar that commits nothing, a refused action that asks nothing, a commit
  not published, a move checking the wrong hash, a triage submitted without its hash, a step that
  waits on the human no longer a status, Claude Code's tool calls unread, a queued message steered,
  a take-back naming no message. Not run: a break in the core's git writes (a priority committed
  with someone's other changes, the triage's commit), which sit in `crates/`, off limits to this
  task: `fate` and `inbox` check their effect through the server (the commit's files, the head, the
  status), and Task 4's flows own that break.
- **Coverage, `packages/server`, lines**: 83.0% (3,416 of 4,117) before, 59.2% after. What no longer
  runs, from the diff of the two reports, the files that lost 25 points or more: the preview
  runner's failure paths (the readiness timeout, the idle stop, the port retry, the restart after a
  new commit: 94.9% to 69.0%), the story index and the `Story` records read for the embeds
  (`fate/preview.ts`, `preview/index.ts`), the session manager's chat features (the list, search,
  rename, archive, Allow all, sub-agents, image sizes, queues: `runner/sessions.ts`, `processes.ts`,
  `transcript.ts`, `send-input.ts`, `message.ts`), Claude Code's event parser beyond a turn, a
  refusal, and a skipped line (`claude-events.ts`, 97.4% to 42.5%), the views of the ledger,
  history, and branch changes, the tokens, the settings page's mutations beyond the hosts, the
  second start's handoff (`open-client.ts`, `sign-in/host.ts`: it runs in a child process, which the
  report does not see), the stale-binding check (`binding.ts`), the browser launcher, `vp dev`'s
  wiring, `worktree-seed.ts`, and `pulls.ts`. They are the web flows' to read (Task 6), or dropped
  below. The report is `vp test --project uraeda-server --coverage`; the config's coverage
  exclusions need `**/__flows__/**` too, which `vite.config.ts` does not have yet.
- **Rationale**: SC-005 asks for a record of every old file, and the flows are far fewer and break
  on a behaviour, where the old tests broke on a label, a count, or a status text.
- **Alternatives considered**: keeping the session manager's unit tests, which fail on every change
  of a label or a count, the failures the spec set out to end.
- **If wrong**: restore a file from the commit before the deletion (`git show 9bb8de39:<path>`), and
  add its flow.
- **Where**: task 5 of the plan; the flows' commits and the deletion's.

| Old file                               | Flow, or the rule that dropped it                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `__tests__/allowed-hosts.test.ts`      | A (a host added applies to the next request, removed does not), St (a flag's names stay).                                                                                                                                                                                            |
| `__tests__/attach.test.ts`             | At, A. Dropped: the 21 MB wording, chunked bodies, a write failure's text (asserts text), the refusal before the body is read (duplicates the limit row).                                                                                                                            |
| `__tests__/browser.test.ts`            | Dropped: a table of the launch command per platform, which fails on a refactor, and opening a browser cannot be seen.                                                                                                                                                                |
| `__tests__/coverage-summary.test.ts`   | Dropped: it tests the coverage report's script, which no decision's rule needs ("a drop MUST NOT fail a check"). Task 8 may keep it.                                                                                                                                                 |
| `__tests__/decisions-check.test.ts`    | I (the same `defaultRound` mutations and round file). Dropped: the check's two messages (text), the decisions page's data (a view the web flows read).                                                                                                                               |
| `__tests__/dev.test.ts`                | Sr (`vp dev` on loopback only). Dropped: its hosts from `.env`, its handoff on Vite's port, its preview paths, its upgrade refusal, sign-in under `vp dev`: wiring of a development tool.                                                                                            |
| `__tests__/env.test.ts`                | St (the order flag, variable, file, default; `.env`; the data and config folders). Dropped: the `--help` and `--version` texts, a relative data folder, the `--new-key` flag's parsing.                                                                                              |
| `__tests__/fast-check.test.ts`         | Kept: Task 3's.                                                                                                                                                                                                                                                                      |
| `__tests__/fate.test.ts`               | F, I, L. Dropped: the shapes of the ledger, history, branch changes, progress, and tokens (a count or a shape the web flows read), the logging of an internal error.                                                                                                                 |
| `__tests__/files.test.ts`              | Fl, At. Dropped: the 500 for an unreadable file, with its log line.                                                                                                                                                                                                                  |
| `__tests__/folders.test.ts`            | Rp (one table of the suggestions). Dropped: `typedFolder`'s refusal table, a folder that cannot be read (a permission the test changed).                                                                                                                                             |
| `__tests__/free-port.test.ts`          | Dropped: duplicates the flows that start on a free port (P, Sr), which fail if it fails.                                                                                                                                                                                             |
| `__tests__/guard.test.ts`              | A (hosts, origins, fetch sites, over every route), P (frames and upgrades, through real sockets). Dropped: `guardCheck`'s unit rows, which A and P cover through the server.                                                                                                         |
| `__tests__/inbox.test.ts`              | I, F. Dropped: the inbox's per-note edits (edit, recategorize, insert) as shape, the image note, the triage as a round of questions (a view).                                                                                                                                        |
| `__tests__/live.test.ts`               | L, At (the image cleanup). Dropped: the 250 ms throttle (elapsed time), event ids, the sub-agent and take-back updates, the ledger's and decisions' updates.                                                                                                                         |
| `__tests__/locked-list.test.ts`        | Rp.                                                                                                                                                                                                                                                                                  |
| `__tests__/main.test.ts`               | Sr (loopback, the key once, a second start, another data folder, a failed start, stop). Dropped: `--help` and `--version`, the stale-binding checks (the config rebuilds it before every test), `--new-key`, the one-time page's mode, SIGHUP, the port-in-use text, `open_browser`. |
| `__tests__/needs-you.test.ts`          | N.                                                                                                                                                                                                                                                                                   |
| `__tests__/open.test.ts`               | Sr (a second start hands over), A (the host token, a cross-site hand over). Dropped: a folder outside git and an unsent folder's statuses.                                                                                                                                           |
| `__tests__/paths.test.ts`              | Dropped: duplicates C and Sr, which fail if the plugin folder or the built UI is not found.                                                                                                                                                                                          |
| `__tests__/preview.test.ts`            | P. Dropped: the story index, a story's id, a view after a commit, and a turn starting a Storybook: the embeds' reads, the web flows'.                                                                                                                                                |
| `__tests__/pulls.test.ts`              | Dropped: `gh` runs counted by the minute: elapsed time and a count.                                                                                                                                                                                                                  |
| `__tests__/repositories.test.ts`       | Rp, Fl (the old raw link). Dropped: a moved or missing folder's state, a failing watch's log, a repository inside another, `item.settings`.                                                                                                                                          |
| `__tests__/run-folder.test.ts`         | P (a start ends a killed server's Storybooks). Dropped: the `run/` layout and the removal of an earlier version's files (a migration).                                                                                                                                               |
| `__tests__/server.test.ts`             | Sr, P, S. Dropped: the sweep every minute (elapsed time), a recorded pid that now names another process, a sign-in file that is invalid (the store's, below).                                                                                                                        |
| `__tests__/sessions.test.ts`           | R, N, C, At. Dropped: about 45 tests of the session list, search, rename, archive, Allow all counts, sub-agents, queues, image sizes, `change.start`, and slug proposals: labels, counts, and statuses the web flows read.                                                           |
| `__tests__/settings-fate.test.ts`      | A (hosts), St. Dropped: the empty record, a port's refusal text.                                                                                                                                                                                                                     |
| `__tests__/settings-watch.test.ts`     | St (a hand edit applies). Dropped: symlinks, bursts, a thrown listener: the watcher's internals.                                                                                                                                                                                     |
| `__tests__/settings.test.ts`           | St.                                                                                                                                                                                                                                                                                  |
| `__tests__/stack.test.ts`              | Dropped: no markdown parser is a rule "Checked by review", and the 44 px of an element asserts a size.                                                                                                                                                                               |
| `__tests__/test-run.test.ts`           | Kept: Task 8's.                                                                                                                                                                                                                                                                      |
| `__tests__/toolchain.test.ts`          | Kept: Task 8's.                                                                                                                                                                                                                                                                      |
| `__tests__/worktree-seed.test.ts`      | Dropped: a development script no decision's rule needs. Task 8 may keep it.                                                                                                                                                                                                          |
| `preview/__tests__/index.test.ts`      | Dropped: the story index's parsing, read by the embeds (web flows, Task 6).                                                                                                                                                                                                          |
| `preview/__tests__/proxy.test.ts`      | P.                                                                                                                                                                                                                                                                                   |
| `preview/__tests__/runner.test.ts`     | P (start, stop with the server, the group's end, a killed server's Storybooks). Dropped: the 2 minute and 30 minute limits, the port retry, the failed states, the restart after a commit.                                                                                           |
| `runner/__tests__/cache.test.ts`       | Dropped: the cache's schema, migrations, and search, internals a flow reads through R and N ("a cache, never workflow state" is checked by review).                                                                                                                                  |
| `runner/__tests__/claude.test.ts`      | C, R. Dropped: the argument list's exact content (R checks the permission, the rules, and the plugin), the event parser's variants, the transcript lookup.                                                                                                                           |
| `runner/__tests__/fake.test.ts`        | Dropped: it tests the test double, which every R flow exercises.                                                                                                                                                                                                                     |
| `runner/__tests__/helpers.ts`          | Deleted with the tests that used it.                                                                                                                                                                                                                                                 |
| `runner/__tests__/images.test.ts`      | At (the cleanup), R (the paths the agent gets). Dropped: a write failure's text, a file that cannot be deleted.                                                                                                                                                                      |
| `runner/__tests__/message.test.ts`     | Dropped: asserts the text of every message.                                                                                                                                                                                                                                          |
| `runner/__tests__/recommended.test.ts` | R (a feature's one message, none on the human). Dropped: the pull request states' table.                                                                                                                                                                                             |
| `runner/__tests__/sessions.test.ts`    | R, N. Dropped: the steer, queue, take-back, idle-timer, watchdog, `/clear`, and replaced-session cases (the process's lifecycle), the 15 and 30 minute limits (elapsed time).                                                                                                        |
| `runner/__tests__/status.test.ts`      | N (one table of the statuses).                                                                                                                                                                                                                                                       |
| `runner/__tests__/tokens.test.ts`      | Dropped: the arithmetic of token counts (counts the web shows).                                                                                                                                                                                                                      |
| `runner/__tests__/usage.test.ts`       | Dropped: the allowance report's shape (a count).                                                                                                                                                                                                                                     |
| `sign-in/__tests__/closed.test.ts`     | A (every route, from the routing table).                                                                                                                                                                                                                                             |
| `sign-in/__tests__/frames.test.ts`     | P, A.                                                                                                                                                                                                                                                                                |
| `sign-in/__tests__/links.test.ts`      | S (a link once, within minutes, never to another site). Dropped: the page's mode and removal, the link's page in the data folder.                                                                                                                                                    |
| `sign-in/__tests__/routes.test.ts`     | S, A. Dropped: the cookie's attributes and the refresh after a day (an attribute list), never cached, the 4 KB body's log line.                                                                                                                                                      |
| `sign-in/__tests__/store.test.ts`      | S. Dropped: two stores on one file, an unwritable folder, an unreadable file never overwritten, the daily record of a use: the store's internals, a hole to read in the review.                                                                                                      |

## R5: The tooling tests, kept where a decision's rule needs them

- **Decision**: a tooling test stays only where it enforces an active decision's rule. Old file to
  new place:

  | Old file                                                                                                                    | Now                                                                                                                                                                                                                                                                                                      | Rule                                                                  |
  | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
  | `packages/server/src/__tests__/toolchain.test.ts` (11, 35)                                                                  | kept, 696 to about 400 lines, 16 tests: one fixture per check, CI runs every `ready` group uncached, the repository is isolated and never retries and `ready` selects every Vitest project, the fast check exists and is no part of `ready`, and the cached tasks track the binding and the pinned tools | toolchain: `ready` runs every check, CI the same, isolation, no retry |
  | its doctest check                                                                                                           | dropped                                                                                                                                                                                                                                                                                                  | "nextest" is checked by review and CI, not this test                  |
  | its stale-binding import order check and the exact list of the binding's configs                                            | dropped                                                                                                                                                                                                                                                                                                  | no decision's rule: a rebuild convenience, which a failing test shows |
  | its heavy-lock check, the exact browser project names, generated-report and `.worktrees` ignores, the `ts:check` dependency | dropped                                                                                                                                                                                                                                                                                                  | no decision's rule: a speed choice, a count, a cache optimisation     |
  | `packages/server/src/__tests__/test-run.test.ts`                                                                            | kept, minus the free-slot test (the waiting test covers the lock)                                                                                                                                                                                                                                        | toolchain: isolation, a run folder, the lock, cleanup on cancel       |
  | `packages/web/src/__tests__/lint.test.ts` and `__lint__/*`                                                                  | kept whole, its names without the old spec's numbers: each fixture is a rule of code quality or UI components (limits, markers, the shared lint config, Astryx only, no global stylesheet)                                                                                                               | code quality, UI components                                           |
  | `crates/cli/tests/skill.rs`                                                                                                 | the `SKILL.md` length test dropped; `every_command_is_named_in_the_skill` left to Task 4                                                                                                                                                                                                                 | a size, no decision's rule                                            |
  | `packages/server/src/__tests__/coverage-summary.test.ts`                                                                    | dropped                                                                                                                                                                                                                                                                                                  | coverage is on demand and never fails a check: only observes          |
  | `packages/server/src/__tests__/worktree-seed.test.ts`                                                                       | dropped                                                                                                                                                                                                                                                                                                  | no active decision: the dev shell's seeding is a speed-up             |

- **Breaks run by hand**, each failing its test and reverted: CI's `ready:rust` step without
  `--no-cache` (`CI runs every group of ready, uncached`); `--retries 2` on the Rust tests' command
  (`the repository's tests are isolated, never retried`); the browser lock removed from `browserRun`
  (the same test); the `fast` task renamed (`the fast check exists and does not replace ready`).
- **Tests**: 61 before (toolchain 28, test-run 7, coverage 5, seed 7, lint 13, skill.rs 2) and 36
  after (toolchain 16, test-run 6, lint 13, skill.rs 1), as `vp test` and nextest count them.
- **What no longer runs**: the seeding of a worktree's `target/` and Vite Task cache, `coverage`'s
  summary, the doctest and binding-import checks, and the `SKILL.md` size.
- **Rationale**: SC-005 and the plan's Task 8.
- **If wrong**: restore the dropped file from the commit before this task.
- **Where**: tooling tests of `packages/server`, `packages/web`, and `crates/cli`.

## R6: The benchmarks flows, and what the old tests became

- **Decision**: `packages/benchmarks/src/__flows__/` holds five flows over the runner with a fake
  adapter and no network, each from a rule of the [Benchmarks](../decisions/benchmarks.md) decision
  ending "Checked by ...": `loop.test.ts` (the loop, models, blocks, leak audit), `human.test.ts`
  (the simulated human, on real git), `run.test.ts` (`runFlow` end to end on fakes: approval,
  record, skill commit, hidden tests, judge model, baseline), `record.test.ts` (the schema and what
  git keeps), and `sandbox.test.ts` (the credentials, the pinned model). `harness.ts` is their
  helper. The old `__tests__/` folder is deleted whole, since none of its helpers is used by a flow.
- **Rules and their flows**: approval, in `run.test.ts`; skill from a named commit, in
  `run.test.ts`; the human sees only what a human would open and the invalid run, in `human.test.ts`
  and `run.test.ts` (the hidden tests are fetched after the flow, outside its checkout); the wrong
  model fails the run, in `loop.test.ts` and `run.test.ts` (the judge), with the settings that pin
  it in `sandbox.test.ts`; the record's fields, in `record.test.ts` (one case per required field)
  and `run.test.ts`; git holds the record and not the transcripts, in `record.test.ts` and
  `run.test.ts`; the baseline's reuse, in `run.test.ts`; the addresses fetched and the leak flag, in
  `loop.test.ts`; the agents decision's blocked actions allowed once, in `loop.test.ts`.
- **Breaks, run by hand, each caught**: approval not required; the skill copied from the working
  tree; the schema not asking for `urls`; `transcripts/` removed from `.gitignore`; the human's
  commit outside the folder allowed; the loop ignoring a wrong model; the judge's model unchecked;
  the hidden tests fetched before the loop; the upstream never flagged; finished without a push; the
  token's value in the container's arguments; a baseline borrowed across models; the same block
  allowed again; a fallback model allowed in the settings; the record not holding the approval; the
  human's change requests uncapped. Each made at least one flow fail, and the code was restored.
- **Before and after**: 11 test files and 97 tests (1,983 lines with helpers) in about 6.3 seconds
  of Vitest, 77% of statements covered; 5 files and 50 tests (every field of the record is a case)
  in about 2.3 seconds, 50% of statements covered. What the flows no longer run: the screening
  (`screen.ts`), the results page (`report*.ts`), `prepare-case.ts`, `probe.ts`, `case.ts`,
  `suite.ts`, the CLI, and `prepareSandbox` itself, whose docker steps the flows replace by a
  sandbox of real git on a bare origin.
- **Old test files**:

| Old file                                                               | Flow, or the rule that dropped it                                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/loop.test.ts`                                               | `__flows__/loop.test.ts` for the order of turns, the cap, the models, usage limit, blocks, leak flags, the human's turns, and errors; the late round and the `ura next` step tests dropped: they pin the shape of the fake `ura` answer |
| `__tests__/loop-helpers.ts`                                            | `__flows__/harness.ts`, written for the flows                                                                                                                                                                                           |
| `__tests__/human.test.ts`                                              | `__flows__/human.test.ts`; the test of the guidelines' wording ("at most twice", "confirm the risk tier") is dropped: it asserts text, and the cap is checked by the change-request flow                                                |
| `__tests__/run-case.test.ts`                                           | `__flows__/run.test.ts` for the run, the skill commit, the judge's model, hidden tests, the baseline; screening, `prepare-case`, and the plain arm's own record dropped: no decision rule, a tool read by its use                       |
| `__tests__/data.test.ts`                                               | `__flows__/record.test.ts` for the schema and git; the suite and case readers dropped: no decision rule, and a bad file shows at the first run                                                                                          |
| `__tests__/skill.test.ts`                                              | `__flows__/run.test.ts`, the skill's commit and a missing commit                                                                                                                                                                        |
| `__tests__/sandbox.test.ts`                                            | `__flows__/sandbox.test.ts` for the credentials and the pinned model; the mounts, the container labels, and the cleanup dropped: they pin the fake docker's calls, and the first real run shows them                                    |
| `__tests__/grader.test.ts`                                             | `__flows__/run.test.ts` for the scores of passing and failing tests and the hidden tests' place; the parsing of Python literals, the judge's message, and the counts of rounds dropped: no decision rule, checked by the first run      |
| `__tests__/session.test.ts`                                            | dropped: the SIGTERM and SIGKILL grace is a timing rule, and the decision's rules do not name it; a hung process shows in the first run                                                                                                 |
| `__tests__/report.test.ts`                                             | dropped: the results page has no rule in the decision, and its test asserts what the page shows                                                                                                                                         |
| `__tests__/probe.test.ts`                                              | dropped: the probe is a tool for a human to run, with no rule in the decision                                                                                                                                                           |
| `__tests__/server-exports.test.ts`                                     | dropped: "the benchmark reaches agents through the server's adapter" is checked by review, as the decision says; the flows import the same exports                                                                                      |
| `__tests__/fake-bin.ts`, `samples.ts`, `fixtures/next-after-push.json` | helpers of the deleted tests: replaced by `__flows__/harness.ts`                                                                                                                                                                        |

- **Rationale**: the benchmarks decision's "Checked by the runner's tests" rules are the ones a flow
  must keep (SC-004). The rest of the tooling checks no decision's rule.
- **Alternatives considered**: keeping the report and screening tests, which pin what a page shows
  and the order of candidates.
- **If wrong**: restore a deleted file from the commit before this one and rebuild its flow from the
  rule it guards.
- **Where**: `packages/benchmarks/src/__flows__/`, task 9 of the plan.
