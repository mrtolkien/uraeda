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

The dropped cookie-attributes test of `sign-in/__tests__/routes.test.ts` now has a flow:
`sign-in.test.ts` asserts the cookie's `HttpOnly`, `SameSite=Lax`, `Path=/`, and 30-day `Max-Age`,
its name `__Host-uraeda` with `Secure` under a listed host and `uraeda` without otherwise, and the
refusal's `Cache-Control: no-store` with the stale cookie cleared. Each was broken by hand and
failed it.

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

## R7: The web UI's old tests, and the flows that replace them

- **Decision**: the web project's 81 old test files in `packages/web/src/__tests__/` (991 tests
  besides the 13 of `lint.test.ts`, 20,361 lines, 741 seconds of Vitest's per-file durations under
  coverage, 222 seconds of wall time) are replaced by 36 flow files in
  [`packages/web/src/__flows__/`](/packages/web/src/__flows__/) (287 tests, 221 seconds without
  coverage, 81 seconds of wall time). Each file calls `startApp()` of `harness.tsx` once: one
  fixture repository and one server in process for the whole file, made before its first test and
  closed after its last, where the old tests built both for each test. The tests of a file take
  their turn on the repository, each on the feature or the line of its own, or following the one
  before on purpose. A flow is written from the decisions' rules and the page's behaviour, never
  from an old test. It asserts roles, states, link targets, addresses, files, and commits, and the
  words of an action a spec names (Answer, Review, Fix, Add, Commit, Undo, Save, Discard, Stay,
  Leave, Allow all, Take back), and no heading, count, or size.
- **Files**: `home`, `priorities`, `inbox`, `triage`, `decisions`, `round`, `settled`, `spec`,
  `spec-embed`, `review`, `ask`, `mockup`, `underway`, `session`, `session-feature`, `commit-start`,
  `recommended`, `allowance`, `feature`, `feature-pull-request`, `change`, `editor`, `writes`,
  `leave`, `overlays`, `settings`, `settings-flag`, `repositories`, `add-repository`, `sign-in`,
  `notify`, `shell`, `diagram`, `documents`, `storybook-pick`, and `storybook-fixture`. Four
  helpers: `harness.tsx` (the app, `holding` to gate a write, `refreshUntil`), `lists.tsx` (a server
  over a list of repositories, for the repositories, add-repository, and notifier flows),
  `rounds.ts` (a round each test answers), and `session-helpers.tsx`.
- **Where the plan differs**: the project's name is `uraeda-web`, not `web`. Three flows are not of
  a page: `diagram` (the component with Pele, and every diagram the repository tracks),
  `storybook-pick` (the skill's pick script in a frame), and `storybook-fixture` (Uraeda's own
  Storybook, in Node). `setup.ts` moved to `__flows__/setup.ts`, where the web config loads it.
  `lint.test.ts` and `__lint__/` stay, Task 8's. `helpers.tsx` is deleted: no browser test imports
  it. The root `vite.config.ts` has `**/__flows__/**` in the coverage exclusions and in the
  max-lines override. The deletion is one commit, and a later commit drops 15 tests that only
  repeated another flow or checked an absence, to bring the runtime under a third of the old.
- **Rules ending "Checked by the UI tests" (and the notifier, settings page, and diagram tests)**,
  with their flows:
  - UI behaviour, in place, and a dialog only for an irreversible action: `priorities` (a line and a
    draft edited in the pane), `overlays` (a confirmation closes with Close, Back, and Escape).
  - Text saves only on an explicit action, unsaved text is marked, restored, and never dropped
    without asking: `round`, `settled`, `review`, `mockup`, `editor`, `priorities`, `inbox`,
    `leave`, and `sign-in` (the text survives a sign-out).
  - Status next to what it concerns, an error stays: `round` (a refused answer keeps its text beside
    its question), `writes` (a hook's refusal gives the button back with the error), `priorities` (a
    refused Undo stays until dismissed), `settings`, `repositories`.
  - A git write shows its action at once and blocks the others: `writes`, `priorities`, `editor`,
    through `holding`.
  - Back and reload keep the place: `priorities`, `inbox`, and `decisions` (the pane's address),
    `spec` (the contents and the folds on Back), `round` (the position), `documents` (an image
    closes with Back), `feature` (the format notes on Back), `session-feature` (the progress).
  - UI layout, an open detail in the URL: `priorities`, `inbox`, `decisions`, `settings` (the
    category, at both widths), `documents` (the image's address and Back).
  - Problems, Home and the sidebar's cards show problems only: `home` and `shell` (a spec that
    cannot be read is a Fix, a format note keeps the feature with its agent).
  - Settings page, applies at once or says when: `settings` (hosts apply, the port says it applies
    at the next start).
  - Notifier: `notify` (only an item that comes to need the human, in any repository, a blocked chat
    too; nothing at load; the permission asked only from Turn on and a refusal kept; no notification
    while this tab or another is in front; one of two tabs notifies; a click opens the item; the
    tab's title counts).
  - Diagrams: `diagram` (a hostile text draws no script, handler, or `javascript:` link; a diagram
    that fails shows its source; a link opens in a new tab with no opener).
  - Stack, the embed's sandbox: `spec-embed` (a story's frame and the Storybook page's frame run
    scripts and never share the app's origin), `spec` and `mockup` (a mockup's frame).
- **Not satisfied here**: "every action works by tap and keyboard" and "lists whose rows open a pane
  share one keyboard behaviour" are also checked by the browser tests (Task 7), and the web flows
  cover them only through Enter, Ctrl+Enter, Escape, and Back. The list keys cannot run in
  happy-dom: `useListKeys` stops when a layer is open, and happy-dom's `getClientRects()` is never
  empty, so the closed repositories popover looks open. Task 7 owns the keyboard walk of a list: it
  is `keyboard` of R8.
- **Breaks, run by hand and reverted**, 63 in all, 62 made at least one flow fail: the round (a tap
  writes no letters, Submit enabled with a blank question, Try again does nothing, the unsaved text
  never read back, Cancel never asks, a verdict through an unsent comment, Approve losing its tier,
  the story's frame and the mockup's frame gaining `allow-same-origin`, the contents' choice not
  stored, the settled form not reopened, Comment shown on an approved mockup); the session (a
  take-back returning no text, an image's DELETE a no-op, no Stop, a refused send losing its text,
  Commit and start committing without the hand-over, Commit only handing over, Try again not handing
  over, Allow all a no-op, the fresh-session default lost, a start answered after the human left
  still navigating, the primary action pointing at `/`, the agent card's Stop doing nothing);
  priorities, inbox, and the editor (the write flag never taken, the pending state skipped, the
  leave guard always false, the unsaved store never read, Undo of a delete restoring nothing, Add
  row forced to Later, the editor dropping the frontmatter, a move forced to Later, the conflict
  banner hidden; the tenth, the round's own "not saved, nothing submitted" check skipped, made no
  flow fail: the server's hash check refuses the stale submit on its own); settings, repositories,
  sign-in, and the notifier (a tab in front always false, the permission asked on load, nothing seen
  at load, the permission check dropped, the leader check dropped, a click that opens nothing, no
  count in the title, the own host removed without asking, the port's note dropped, the browser
  switch never written, sign-out everywhere without asking, any failure read as a wrong key, the
  current repository's removal opening nothing, the refusal not shown, the add form's error not set,
  every feature a problem card); and the last flows (the action badge removed from Home, the round's
  link pointing at the feature, the problems dropped from Needs you, a script added to a drawn
  diagram, a failure hiding the source, a diagram link followed in place, Check enabled while a
  check waits, a code link pointing elsewhere, raw HTML rendered, `resumes` never written, the pick
  script obeying any window, the fixture's frame Origin kept). Not run: the server's refusals behind
  a flow (the removal of a repository an agent works in, a settings write that drops comments),
  which Tasks 4 and 5 broke, and the notifier's rows for a blocked chat, which the server lists.
- **Coverage, `packages/web`, lines**: 81.21% (9,835 of 12,110) before, 79.13% (9,477 of 11,976)
  after; statements 79.55% to 77.38%, branches 76.41% to 72.69%, functions 76.13% to 73.49%. What no
  longer runs, from the diff of the two reports, the files that lost 8 lines or more: the feature
  page's figures (`feature/Figures.tsx`: lines changed, tokens, times), the transcript's tool groups
  and message details (`TranscriptMessages.tsx`, `ToolGroups.tsx`), the comment draft's edges
  (`useCommentDraft.ts`, `reviewField.ts`), the round index's states (`RoundNav.tsx`), the review's
  image handling (`useReviewImages.ts`), the phone's comment sheet (`CommentSheet.tsx`, the browser
  tests'), the feature record's pull request card (`feature/Record.tsx`), the composer's and the
  attachments' error paths (`Composer.tsx`, `attach/chatImages.ts`), the unsaved store's edges
  (`fields/unsaved.ts`, 90%), the progress column (`SessionAside.tsx`), and the screenshot scripts'
  `edited` helper (`scripts/edited.ts`). The reports are `vp test --project uraeda-web --coverage`
  on the commit before the flows and on the last.
- **Runtime**: Vitest's per-file durations under coverage, 741 to 242 seconds; without coverage, the
  plan's 690 to 221, which is 32% of it; wall time 222 to 81 seconds. Five runs of the whole project
  stayed green once a notifier flow that raced was fixed (below). After a change of `Composer.tsx`,
  `vp run fast` takes 90 seconds, where the old tests took 192: SC-002's minute is not met for a
  file that most pages import.
- **Findings, not fixed**: on "Could not reach the Uraeda server", Try again does not recover once
  the server is back: the boundary draws again with the same fate client, which keeps the failed
  read, and only a reload recovers (`App.tsx`). The `home` flow asserts the button and the reload. A
  tab that becomes the notifying one after the other closed may notify an ask it first read after
  the handover, once more: the browser folds it, as both share the item's tag, and the `notify` flow
  counts the items.
- **Rationale**: SC-005 and SC-006: the old tests were 20,000 lines pinning headings, counts,
  statuses' words, and sizes, which fail on changes that keep the behaviour.
- **Alternatives considered**: keeping the unit tests of pure helpers (`times`, `figures`,
  `draft-text`, `roundTarget`): they fail on every refactor and guard text formats the browser
  shows, and the writes they feed are the flows' to break.
- **If wrong**: restore a file from the commit before the deletion (`git show 77e54196:<path>`), and
  add its flow.
- **Where**: task 6 of the plan, the flows' commits, the deletion's, and the last drop's.

| Old file                                 | Flow, or the rule that dropped it                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/add-repository.test.tsx`      | `add-repository`. Dropped: Down then Enter and the single suggestion's Enter (keyboard microcases), one request per text typed (a count), the exact error sentences.                                                                                                                                                                                                    |
| `__tests__/build.test.ts`                | Dropped: the main bundle holding no Pele reads the build's output, a size choice the diagrams decision checks by review ("loads the library only when a page holds a diagram").                                                                                                                                                                                         |
| `__tests__/cards.test.ts`                | `shell` (the sidebar's order and statuses, through the real server). Dropped: the sort of `byStep` as a unit, which fails on a refactor.                                                                                                                                                                                                                                |
| `__tests__/change.test.tsx`              | `change`. Dropped: the plural words of a question count, the title without a pull request, the change's words (text), and the late start clearing only what it sent (a normal edge case).                                                                                                                                                                               |
| `__tests__/comment-draft-place.test.tsx` | Dropped: the scroll position of a tapped block needs a layout: the browser tests own scrolling.                                                                                                                                                                                                                                                                         |
| `__tests__/commit-actions.test.tsx`      | `commit-start`, `underway` (the round asked during the implementation), `recommended`. Dropped: every commit button's wording, "without Claude the round keeps its single button" (an absence), and the commit shown at once (`writes` has it).                                                                                                                         |
| `__tests__/compiler.test.tsx`            | Dropped: it counts renders of the React Compiler (a count and a performance choice).                                                                                                                                                                                                                                                                                    |
| `__tests__/composer-images.test.tsx`     | `session` (the focus after a thumbnail is removed).                                                                                                                                                                                                                                                                                                                     |
| `__tests__/confirm.test.tsx`             | `overlays`.                                                                                                                                                                                                                                                                                                                                                             |
| `__tests__/decision-icons.test.ts`       | Dropped: every decision of the repository and the example names a registered icon: a missing one falls back to the default icon, which review sees, and no decision's rule needs it.                                                                                                                                                                                    |
| `__tests__/decision-rules.test.tsx`      | `spec` (a rule's strength by role, never struck out) and `review` (a comment on a decision's rule). Dropped: the Must icon's colour and the check line's look.                                                                                                                                                                                                          |
| `__tests__/decisions-check.test.tsx`     | `decisions` (the check's start, the waiting check, its page, its answers in their own file, committed alone, applied). Dropped: the option's candidate drawn as a changed decision beyond its id, and the second candidate (a card each).                                                                                                                               |
| `__tests__/decisions.test.tsx`           | `decisions` (the pane and its address after a reload, a principle, the sort kept, a branch's decision with its changes marked, one a branch removed). Dropped: the constitution's version line, the rows' dates and subtitles, the empty states, a decision with no title.                                                                                              |
| `__tests__/diagram-hostile.test.tsx`     | `diagram` (the hostile texts, and a page holding one).                                                                                                                                                                                                                                                                                                                  |
| `__tests__/diagram-links.test.tsx`       | `diagram` (a link opens in a new tab, without an opener).                                                                                                                                                                                                                                                                                                               |
| `__tests__/diagram.test.tsx`             | `diagram` (a failure shows the source). The old test mocked a Pele that fails to load: the flow uses a source that does not parse, a real failure.                                                                                                                                                                                                                      |
| `__tests__/diagrams-repo.test.ts`        | `diagram` (every diagram the repository tracks draws).                                                                                                                                                                                                                                                                                                                  |
| `__tests__/document.test.tsx`            | `documents`. Dropped: callouts and typed bullets drawn (look), the folds of an approved spec (`spec`), an image without alt text and an image inside a link (variants), the redraw of a failed image after its address changes (an editor's detail).                                                                                                                    |
| `__tests__/draft-text.test.ts`           | Dropped: the split of a draft's frontmatter is exercised by the editor flow's frontmatter tests; units that fail on a refactor.                                                                                                                                                                                                                                         |
| `__tests__/drop.test.ts`                 | `priorities` (the drag's order gives the core's move).                                                                                                                                                                                                                                                                                                                  |
| `__tests__/edited.test.ts`               | Dropped: a unit of the screenshot scripts' helper, which no decision's rule needs.                                                                                                                                                                                                                                                                                      |
| `__tests__/editor.test.tsx`              | `editor`, and `priorities` (the draft's text in the pane). Dropped: the hints of a new draft (words), a draft changed elsewhere read again (the unsaved-text test reads again), the placeholders draft (folded into Start).                                                                                                                                             |
| `__tests__/feature-done.test.tsx`        | Dropped: the figures of a done feature (lines changed, tokens, stage times) and their words and counts: no decision's rule needs them. `feature` checks that a merged feature has no action.                                                                                                                                                                            |
| `__tests__/feature-page.test.tsx`        | `feature`, `feature-pull-request`. Dropped: the stages' times and dates, "Task 7 of 11", the header's words, the unknown pull request state, the agent card's strings, the file rows' look, the hint to run `ura clean`.                                                                                                                                                |
| `__tests__/feature-settings.test.tsx`    | `shell` (name and colour keep the slug, the phone's drawer). Dropped: the 40 character limit (a size), search by name (the same search as by title and slug), Save waiting for a change (a normal edge case).                                                                                                                                                           |
| `__tests__/figures.test.ts`              | Dropped: the compact format of token counts: text.                                                                                                                                                                                                                                                                                                                      |
| `__tests__/fresh-default.test.tsx`       | Dropped: it mocks `data.ts` so a settings read throws; the real default is the fresh-session switch's in `settings` and `session-feature`.                                                                                                                                                                                                                              |
| `__tests__/helpers.tsx`                  | Deleted with the tests: `__flows__/harness.tsx` replaces it, with one server for a file.                                                                                                                                                                                                                                                                                |
| `__tests__/home.test.tsx`                | `home`. Dropped: the four counts and their captions, the cards' order, "Show all (7)", the empty states, the phone's order, the setup hint of a repository without `specs/`.                                                                                                                                                                                            |
| `__tests__/inbox.test.tsx`               | `inbox`, and `shell` (the sidebar's ＋). Dropped: Home's inbox count and its plural, the page's headings and counts, children and tags, the ＋'s place in the top bar, a note moved before another of the same text and a note edited then removed elsewhere (niche).                                                                                                   |
| `__tests__/insertLink.test.ts`           | Dropped: the caret's place after an image link is inserted, a unit that fails on a refactor; the image write is the attachments flow's of the server.                                                                                                                                                                                                                   |
| `__tests__/keep-place.test.ts`           | Dropped: the bookkeeping of a scroll kept (layout): the browser tests own it.                                                                                                                                                                                                                                                                                           |
| `__tests__/leave.test.tsx`               | `leave`. Dropped: Back closing a phone's sheet with an unsaved comment (layout, the browser tests').                                                                                                                                                                                                                                                                    |
| `__tests__/links.test.ts`                | `documents` (every kind of link, through a page), `decisions` (a branch's decision), `repositories` (every link keeps its repository's prefix). Dropped: the unit rows of `pathLink`.                                                                                                                                                                                   |
| `__tests__/lint.test.ts`                 | Kept, Task 8's: each fixture is a rule of code quality or the UI components decision.                                                                                                                                                                                                                                                                                   |
| `__tests__/missing.test.tsx`             | `documents` (a file, a folder, and a feature that are not there settle with a way back). Dropped: the count of requests the page sends.                                                                                                                                                                                                                                 |
| `__tests__/mockup.test.tsx`              | `mockup`.                                                                                                                                                                                                                                                                                                                                                               |
| `__tests__/new-change.test.tsx`          | `change`.                                                                                                                                                                                                                                                                                                                                                               |
| `__tests__/notes.test.tsx`               | `round` (the notes save only on an action, Submit saves them, restored after a reload, a round answered elsewhere). Dropped: the notice's variants, saved and unsaved sequences, spaces at the ends, images added to the notes.                                                                                                                                         |
| `__tests__/notify.test.tsx`              | `notify`, now on the real server's list of what needs the human instead of rows given to the hook, with a blocked chat. Dropped: the 1 second timer (elapsed time).                                                                                                                                                                                                     |
| `__tests__/overlay.test.tsx`             | `overlays`.                                                                                                                                                                                                                                                                                                                                                             |
| `__tests__/pane.test.tsx`                | `priorities`. Dropped: the walk of Next › and ‹ Previous (keyboard, the browser tests'), "Open draft", a removed line's message, the pane's labels.                                                                                                                                                                                                                     |
| `__tests__/priorities.test.tsx`          | `priorities`. Dropped: the sections' counts, the Ongoing and Draft badges, the step labels (words and counts), a done feature leaving Ongoing (the core decides it).                                                                                                                                                                                                    |
| `__tests__/quick-add.test.tsx`           | `priorities` (and `inbox` for the note). Dropped: four taps from the phone's Home, the ↵ icon by width (a count and a size), the "Undoing…" label (the blocking test covers the rule).                                                                                                                                                                                  |
| `__tests__/readLetters.test.ts`          | `round` (a comment that starts like a letter warns); the unit is dropped.                                                                                                                                                                                                                                                                                               |
| `__tests__/recommended.test.tsx`         | `recommended`, `commit-start`, `session-feature` (the fresh-session switch). Dropped: the pull request states' table.                                                                                                                                                                                                                                                   |
| `__tests__/repositories.test.tsx`        | `repositories`. Dropped: first run on every page (`add-repository`), the raw file's code link (`documents`).                                                                                                                                                                                                                                                            |
| `__tests__/repository-menu.test.tsx`     | `repositories`. Dropped: going back moves a repository first again, an unreadable list's problem (the server's), the narrow screen's sheet (the browser tests'), the checked and missing marks (labels).                                                                                                                                                                |
| `__tests__/review.test.tsx`              | `review`, `ask`. Dropped: a fold's open and close per story, table rows and nested items (the same path as a block), a field's place per width (the browser tests'), typing renders no block (a render count), the images of comments (the server's attachments), the summary's restore, a second tap extending (`spec` has it), no Ask without the agent (an absence). |
| `__tests__/roundTarget.test.ts`          | Dropped: the bookkeeping of the default branch's round hash; the core refuses a stale write, and `round` covers a change made elsewhere.                                                                                                                                                                                                                                |
| `__tests__/round.test.tsx`               | `round`. Dropped: every question in full and the checkbox's name, the questions left, the Context's parts and the Why box, the index per width, the "Since the last round" band, the position's storage keys, the images of answers and notes (the server's), quick-save races.                                                                                         |
| `__tests__/routes.test.ts`               | `priorities`, `inbox`, `decisions`, `settings` (the addresses of the open details, through the pages). Dropped: `parseRoute`'s rows, and Back before the next page draws (scroll, the browser tests').                                                                                                                                                                  |
| `__tests__/selectAfterDraw.test.tsx`     | Dropped: the caret's place after a draw, a unit that fails on a refactor.                                                                                                                                                                                                                                                                                               |
| `__tests__/session-actions.test.tsx`     | `session-feature` (Allow all, Allow and retry, Archive, Unarchive). Dropped: Archive's place in the footer (layout).                                                                                                                                                                                                                                                    |
| `__tests__/session-aside.test.tsx`       | `session-feature` (the tasks, the current task, the changed files, the fold kept after a reload, no column on a chat, the phone's line). Dropped: "Task 7 of 11", the +/- counts, more than 50 files, binary files, git failing, `localStorage` refused, the focus on fold.                                                                                             |
| `__tests__/session-cost.test.tsx`        | Dropped: it counts renders (a count and a performance choice).                                                                                                                                                                                                                                                                                                          |
| `__tests__/session-tail.test.tsx`        | `session-feature` (a long chat draws its recent part with a way to earlier messages and a link into history). Dropped: the 20, 40, and 500 counts, the tool-call edge cases, Back after messages arrived.                                                                                                                                                               |
| `__tests__/session-turns.test.tsx`       | `session-feature` (announcements, a blocked action), `feature` (a failed or stopped run). Dropped: the tool call's target and duration, 250 items in order, the closing text's place.                                                                                                                                                                                   |
| `__tests__/session.test.tsx`             | `session`, `session-feature`. Dropped: the time of day of a message, the Stop failure's text, Ask the agent's quote (`review` and `round`), the Back scroll of "Open the session" (the browser tests').                                                                                                                                                                 |
| `__tests__/settings.test.tsx`            | `settings`, `settings-flag`. Dropped: the word table of `searchSettings`, the "coming later" lists, the search's place per width (layout), the `localhost` case, the exact refusal words, an unknown category and a search with no match (normal edge cases).                                                                                                           |
| `__tests__/settled.test.tsx`             | `settled`. Dropped: the groups and their counts, the band and the card per width (layout), "Anything else", the fold's persistence, a two-line comment's indentation, Ctrl+Enter's variants, the add's race.                                                                                                                                                            |
| `__tests__/setup.ts`                     | Moved to `__flows__/setup.ts`, the web config's setup file.                                                                                                                                                                                                                                                                                                             |
| `__tests__/shell.test.tsx`               | `shell`. Dropped: the exact card strings, "7/11", the 200 ms search debounce (elapsed time), the ＋'s moved-line case, a running sub-agent's card and the folded sidebar's status names (normal cases).                                                                                                                                                                 |
| `__tests__/sidebar.test.tsx`             | `shell`, `home`. Dropped: the links' order and counts, `+3/-0`, the background command's line, the invalid-status and blank-answer cards (the core decides them: its problems tests).                                                                                                                                                                                   |
| `__tests__/sign-in.test.tsx`             | `sign-in`. Dropped: the exact texts, "Signing in…", no sign-out item in the repository menu (an absence), and the 403, 413, and 500 as separate tests.                                                                                                                                                                                                                  |
| `__tests__/spec-decisions.test.tsx`      | `spec` (changes marked by role, never struck out, a removed decision a card with no link), `review` (a comment on a decision's rule). Dropped: reworded and removed words as strings, rewrapped equality, "Not listed" and "Removed" sentences, fold counts.                                                                                                            |
| `__tests__/spec-page.test.tsx`           | `spec`. Dropped: exact contents lists and counts, the 1100 px threshold, the band per width, "Your review, answered" and the History for revisions 1, 3, and an approved one, the unreadable items, what you approve's marks (text and counts).                                                                                                                         |
| `__tests__/spec-parts.test.tsx`          | `spec`. Dropped: pills, the Cost label, the data model's versions and intro, criteria ids and measures, architecture bullets, a unit's card taking a comment (the review flow's path), the niche edge case's fold, an unknown section: drawing the browser checks read.                                                                                                 |
| `__tests__/spec-stories.test.tsx`        | `spec`, `spec-embed`. Dropped: the Given, When, and Then words and the frames' count.                                                                                                                                                                                                                                                                                   |
| `__tests__/stories.test.tsx`             | Dropped: it runs on a fake 5 minute interval (elapsed time); the preview's idle stop is the server's preview flow.                                                                                                                                                                                                                                                      |
| `__tests__/storybook-fate.test.ts`       | `storybook-fixture` (a frame's GET reads the fixture, another site's is refused and adds no repository, the frame cannot change the list or reach another endpoint). Dropped: the three rows of paths as separate tests.                                                                                                                                                |
| `__tests__/storybook-mode.test.tsx`      | Dropped: a story rendering dark from the mode its page sent: a theme detail the browser tests' colours cover.                                                                                                                                                                                                                                                           |
| `__tests__/storybook-pick.test.ts`       | `storybook-pick` (ready, one pick with its role and name, Escape, a message from another window ignored). Dropped: the disabled button, the press and its click, the tap, the link and the separator, the dialog, the height (browser and touch microcases).                                                                                                            |
| `__tests__/storybook-preview.test.ts`    | Dropped: the helper's rows per Storybook config and variable (base, scripts, sockets, builders): they pin a transform; the server's preview flow starts a real Storybook through the proxy.                                                                                                                                                                             |
| `__tests__/theme.test.tsx`               | `shell` (the theme chosen in Appearance and kept by this browser alone). Dropped: no theme switch in the sidebar (an absence).                                                                                                                                                                                                                                          |
| `__tests__/times.test.ts`                | Dropped: the format of dates and durations: text.                                                                                                                                                                                                                                                                                                                       |
| `__tests__/triage.test.tsx`              | `triage`. Dropped: the triage's card structure (counts and words) and the one-line messages' exact text.                                                                                                                                                                                                                                                                |
| `__tests__/unsaved.test.ts`              | `editor`, `priorities` (the store is what both restore-after-reload tests break on).                                                                                                                                                                                                                                                                                    |
| `__tests__/usage.test.tsx`               | `allowance`. Dropped: the "57% left · reset" text, the collapsed sidebar, the loading state.                                                                                                                                                                                                                                                                            |
| `__tests__/useDraft.test.ts`             | Dropped: the composer's text after a story's comment line, a unit of a string join; the story's comment is the spec flows'.                                                                                                                                                                                                                                             |
| `__tests__/writes-store.test.tsx`        | Dropped: a unit of the store's 10 second timer (elapsed time); `writes` covers the card showing and clearing and a failed write.                                                                                                                                                                                                                                        |
| `__tests__/writes.test.tsx`              | `writes`.                                                                                                                                                                                                                                                                                                                                                               |

## R8: The browser tests, rebuilt as page checks and flows that need a real layout

- **Decision**: the 42 files of `packages/web/src/__browser__/` (38 test files and 4 helpers; 8,991
  lines, 348 declared tests, each run at the phone's size and at the desktop's) are replaced by 7
  test files (68 declared tests, 1,129 lines, 1,461 with `helpers.tsx` and `setup.ts`): `pages` (the
  page checks), `keyboard`, `place`, `session-place`, `overlays`, `columns`, and `width`. The
  browser project's `vite.browser.config.ts` goes from 489 lines to 222: it kept the repository's
  turn, the fake agent's commands, and the colour scheme, and the commands for frames, Storybook
  previews, a proxy, the mouse, images, reduced motion, and a slow network went with the tests that
  used them. What stays in a real browser is what happy-dom cannot run: a layout, a scroll, a focus
  order, a history entry of WebKit's, and a window that resizes. Everything else is in `__flows__`
  (R7).
- **The page checks** (`pages.test.tsx`): one table, a row per page or state a UI decision governs,
  each read in light and in dark, at both sizes (the phone project has a touch screen). The rows:
  the repository's pages (home, a round, a spec, a plan, a task, the priorities, a feature, its new
  session, a new chat, a new change, the settings and its Server and Sign-in categories, the
  decisions and one open, the inbox and a note), every feature page state that `gh` does not decide,
  the empty inbox, the triage's banner and its answering view, a change's session with its progress
  open, a session at its implementation with its column, a working session, the feature settings,
  the repository menu, the add-repository form, the sign-out confirmation, and the notification
  banner; besides the table, the folded navigation (desktop) and the sign-in screen. That is 32
  rows, 66 page reads at the phone's size and 68 at the desktop's. Each read checks the same two
  things: **readable** (nothing scrolls the page sideways, no line is clamped, no text is cut where
  an element clips it, nothing reaches past the screen's edge) and **accessible** (axe-core's WCAG
  2.1 A and AA rules on the whole document). No heading, label, count, or pixel is asserted
  (SC-006): a row's name is the only wording, and a page is read once it shows a heading and no
  "Loading…".
- **What the old layout checks lost**: the text sizes (17 and 19 px), the 44 px control height, the
  measure of about 110 characters, the left alignment, and the phone's insets are measured sizes,
  and the UI checks decision says tests "MUST NOT assert ... pixels". "Controls easy to hit by
  touch" and "readable at each width" are kept as axe's rules and the no-cut-text rule. axe's
  target-size rule of WCAG 2.2 (`wcag22aa`) was tried and left out: it fails on a link set over a
  review's selectable block (an `<a>` over a `<button aria-pressed>`), which is the product's to
  decide and not a test's to loosen here.
- **Flows**:
  - `keyboard` (desktop): the rules "lists whose rows open a pane share one keyboard behaviour" and
    "every action works by tap and by keyboard", which R7 left for this task. The priorities and the
    inbox are one table: ↓ ↑ j k move the selection with the pane following in place (no history
    entry per row), End and Home, Escape closes the pane, Enter on a row opens it; the decisions
    page goes from the last principle to the first decision and back; a dialog and a menu keep the
    keys from the list; Space, ↓, Space on a line's handle moves it in the file; Tab goes from the
    handle to the link.
  - `place` and `session-place` (both sizes, one test on the desktop): Back, and a reload then Back,
    return a spec to the position left, with no loading state in between; the form that moves under
    a block leaves the block tapped where it was (desktop); a session follows its end only while the
    human is at the end, "Jump to the latest" brings the end back, Back and a reload return to the
    position read, and "Show earlier messages" leaves the message read where it is.
  - `overlays`: a menu and a form are a sheet on the phone, along the bottom edge and the window's
    width, and a popover or a dialog on the desktop, narrower than half the window; leaving a
    half-written form asks first, in an overlay of its own, and keeping it keeps the text; Back
    closes a sheet and leaves the page's address as it was (phone).
  - `columns` (desktop): the sidebar folds to a rail from its button and from `[` and unfolds back
    to its width, leaves `[` to a text field, and resizes with the keys, its width kept after a
    reload; the session's column folds with its button and `]` and resizes the same way.
  - `width` (desktop): a pane open keeps its address as the window goes under 768 px and back, and a
    comment being typed keeps its text and its focus. Every size or place is compared with another
    measured in the same run (narrower than, equal to, within 4 px of where it was), never with a
    number of pixels.
- **Breaks, run by hand and reverted**: a page failing an accessibility rule (an `<img>` with no alt
  added to Home) failed the page check at both sizes with `image-alt`, and a page failing the
  readable rule (a 3,000 px box in Home's card) failed both with the card's width; the list keys (↓
  not moving the row) failed four `keyboard` tests; the keyboard move (the drag's end writing
  nothing) failed its test; the position (the scroll saved as 0) failed the three Back and reload
  tests; the place kept (`keepPlace` no longer scrolling back) failed the block flow on the desktop
  and the "Show earlier messages" flow, and left the block flow green on the phone, where WebKit
  anchors the page on its own, so that flow runs on the desktop only; the following (the transcript
  always following) failed two `session-place` tests; the overlays (the dialog drawn on the phone
  and the sheet on the desktop; the overlay's history entry not pushed) failed `overlays`; the
  columns (`[` and `]` unbound, the column's width not stored) failed three `columns` tests; and the
  width (the narrow layout drawing the list, not the detail; the questions remounted on a change of
  width) failed both `width` tests. A flow of saving a comment on the phone and keeping the heading
  read, like the old test it came from, stayed green when the place kept was removed: it is dropped,
  not kept as a test that passes whatever the code does.
- **Findings, not fixed**: after Enter on a row of the priorities, the focus is on the page, not on
  the row, where the inbox keeps it on the row: the lists do not share one behaviour there (the flow
  asserts the address and the pane, not the focus). The drawer of the phone's navigation is not a
  history entry: Back leaves the page, where a sheet's Back closes the sheet. Two old tests failed
  before any change: the phone's touch press that lifts a line (`priorities`) and the lines changed
  in green and red (`feature`); both are dropped below.
- **Before and after**: 348 declared tests, 220 run on the phone (1 failed, 128 skipped for the
  other size) in 302 seconds, and 292 on the desktop (1 failed, 56 skipped) in 385 seconds; now 68
  declared, 45 run on the phone (23 skipped) in 78 seconds and 67 on the desktop (1 skipped) in 100
  seconds, six runs in a row green with the same counts (78, 78, 78 and 102, 100, 100 seconds). That
  is 26% of the old time at each size, but not "well under a minute": the page checks are most of
  each run. Coverage was not measured: the browser project has no coverage run, before or after.
- **What no longer runs**: the story embed and the Storybook page in a real browser (starting a
  preview, the frame's sizes, scale and full screen, the pick and comment on a story, a frame
  reloaded, the host name's check); the images' drops and pastes in the editor, the review, and the
  round, and the refusals that follow; the row counts and the resize of text fields; the diagram's
  scale and scroll inside a card; the feature page's stage lines on one line, its lines changed
  colours, and the order of its Next; the round's columns, the options' places, an accent line, and
  the card's focus ring; the spec's sticky parts, card widths, strength colours, and phone insets;
  the sidebar's hover button, its sizes, its eased fold, and the done items filling the room; the
  mouse and touch drags of the priorities and the inbox (the keyboard's move stays); the session's
  bubbles, the composer's growth, and Jump to the latest's centring; the review's sheet keeping the
  block quoted above it; the toasts' closing; the sign-in screen with a wrong key's error and the
  allowance's live update at both sizes; Back after "Show earlier messages" twice; and the window
  narrowing for home's pane and the folded rail's controls.
- **Rationale**: SC-006 and the UI checks decision: a browser test is slow, so it keeps only what
  needs a layout, and the old ones pinned sizes, counts, and words that a design change breaks
  whatever the behaviour.
- **Alternatives considered**: keeping the old layout checks in the page check (text sizes, control
  heights, measure): they are measured sizes. A page check per page in its own test: a repository
  per page and theme was most of the old time; one test reads a page in both themes unless the page
  starts the agent's turn.
- **If wrong**: restore a file from the commit before the deletion (`git show f5a3bc0f:<path>`), and
  add its flow.
- **Where**: task 7 of the plan, the flows' commits, and the deletion's.
- **Old files**:

| Old file                              | Flow, or the rule that dropped it                                                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `__browser__/attach.test.tsx`         | `__flows__/editor`, `session`, and `review` (R7) for what an upload writes and links. Dropped: the cursor's place at a drop, the dimmed unread message, and the paste's markup variants, which need no layout and no decision asks (normal edge cases).                              |
| `__browser__/blocks.test.tsx`         | `pages` (nothing scrolls the page sideways). Dropped: a table reaching into the margin is a measure of pixels.                                                                                                                                                                       |
| `__browser__/change.test.tsx`         | `__flows__/change` (R7) for the column, the pull request, and the sidebar; `pages` for a change's session at both sizes. Dropped: the phone's line wording (text).                                                                                                                   |
| `__browser__/colours.ts`              | Dropped with the tests that read the colour of a diff, a pill, a bubble, and an icon (design choices, no decision's rule).                                                                                                                                                           |
| `__browser__/decisions.test.tsx`      | `keyboard` (↓ from the last principle to the first decision, ↑ back, Escape).                                                                                                                                                                                                        |
| `__browser__/diagram.test.tsx`        | `__flows__/diagram` (R7) for the drawing, its name, and a source that fails; `pages` for a round. Dropped: the chunk loaded on demand, the dark colours, the scale and the scroll in a card (sizes and a performance choice the diagrams decision checks by review).                 |
| `__browser__/feature.test.tsx`        | `pages` (every state of the feature page, both themes, every fold open). Dropped: the stage lines on one line, Next first on the phone, and the colours of lines changed (a layout and a colour no decision asks; the last failed before this task).                                 |
| `__browser__/fields.test.tsx`         | `__flows__/round` and `review` (Ctrl+Enter saves). Dropped: the rows of each field, its growth, and the resize handle's drag are sizes (SC-006).                                                                                                                                     |
| `__browser__/forwarding-proxy.ts`     | Dropped with the host-name test of the embed (the stack decision's embed sandbox is `__flows__/spec-embed`).                                                                                                                                                                         |
| `__browser__/helpers.tsx`             | Rewritten: 621 lines to 305, without the text sizes, the control heights, the measure, the alignment, the insets, and the drop and paste helpers.                                                                                                                                    |
| `__browser__/inbox.test.tsx`          | `pages` (the inbox, empty, a note, the triage's banner and answering view), `overlays` (the form as a sheet or a dialog), `keyboard` (a note's row and the keys), `__flows__/inbox` (three taps, images, toasts' effects). Dropped: the mouse drags of a note, which need a pointer. |
| `__browser__/layout.test.tsx`         | `pages` (every page of its table, in both themes); `width` (the comment typed, the pane's address across 768 px). Dropped: the sizes of text and controls, the insets, the folded rail's controls, and the session at 1024 px with the sidebar open.                                 |
| `__browser__/leave.test.tsx`          | `__flows__/leave` (R7) for Back, Stay, and Leave. Dropped: the dialog's main button, a design choice.                                                                                                                                                                                |
| `__browser__/lists.test.tsx`          | `keyboard` (↓ ↑ j k, End, Home, Escape, Enter, a dialog or a menu holding the keys). Dropped: the Selector's keys (a third-party component's), the pane starting at its top, and the selected row's background colour.                                                               |
| `__browser__/new-change.test.tsx`     | `pages` (a new change at both sizes, both themes); `__flows__/commit-start` and `change` (R7) for the start, the slug, and the text kept. Dropped: images with a refusal and the disabled Start (normal edge cases of the composer).                                                 |
| `__browser__/overlay.test.tsx`        | `overlays` (a sheet or a dialog by the width, Back closes a sheet). Dropped: the two races of the history on a component (an overlay opened while another closes), which no page does; the confirmation's height is a size.                                                          |
| `__browser__/priorities.test.tsx`     | `keyboard` (a line moved by the keys), `__flows__/priorities` (R7). Dropped: the mouse's drag, Escape cancelling it, a live update during a drag, the touch press of 500 ms (it failed before this task and is a library's sensor), the focus ring, and the toasts.                  |
| `__browser__/reading-place.test.tsx`  | `place` (the block tapped stays where it was, desktop). Dropped: the heading read while saving on the phone (it passed with the place kept removed), and the story frame above that grows (a unit of the embed's size message).                                                      |
| `__browser__/repositories.test.tsx`   | `pages` (the menu and the add form, both themes), `overlays` (a menu is a sheet or a popover, Close and Escape), `__flows__/repositories` and `add-repository` (R7).                                                                                                                 |
| `__browser__/review.test.tsx`         | `__flows__/review` (R7). Dropped: the block above the sheet and under the bar are sizes of the phone's sheet; open folds on Back is `__flows__/spec`'s; a hash that is no escape.                                                                                                    |
| `__browser__/round-cards.test.tsx`    | Dropped: the columns of a card, the accent line's width, and the focus ring are sizes and colours (SC-006); `pages` reads the round.                                                                                                                                                 |
| `__browser__/round.test.tsx`          | `__flows__/round` (R7) and `pages` (a round, every group open). Dropped: the index column, the `n` and `p` keys' jump, 600 px for the questions, and each option's place are layout sizes; Back to the question is `place`'s Back.                                                   |
| `__browser__/scroll.test.tsx`         | `place` (Back, and a reload then Back, return a spec to its position, with no loading state), at both sizes where it was the phone's.                                                                                                                                                |
| `__browser__/session-look.test.tsx`   | `pages` (a working session at both sizes, both themes). Dropped: the bubbles' places and fills, the list items' heights, the code block's scroll, the composer's height and growth, and Jump to the latest's centring (sizes and colours).                                           |
| `__browser__/session-tail.test.tsx`   | `session-place` ("Show earlier messages" leaves the message read; Back and a reload return the position). Dropped: Back after two presses with 60 messages drawn again (a count).                                                                                                    |
| `__browser__/session.test.tsx`        | `session-place` (following, scrolling up, Jump to the latest, Back), `pages` (a working session). Dropped: the sub-agent and steered message in dark, a chat's images opening at its end, a run that fails at the end, the progress line's state across Back and 768 px.             |
| `__browser__/shell-checks.test.tsx`   | `pages` (the folded rail, the feature settings, the notification banner).                                                                                                                                                                                                            |
| `__browser__/side-column.test.tsx`    | `columns` (the column folds and unfolds with its button and `]`, resizes with the keys, its width kept). Dropped: the 280 to 560 px bounds, the drag, the rail's step and count, the eased fold, and what the hidden column keeps.                                                   |
| `__browser__/sidebar.test.tsx`        | `columns` (the fold and `[`, the text field leaving `[`, the resize and its kept width). Dropped: the 200 to 480 px bounds, the drag under 160 px, the hover opacity, the eased fold, the done items, and the phone's top bar.                                                       |
| `__browser__/sign-in.test.tsx`        | `pages` (the sign-in screen, the Sign-in category, and its confirmation). Dropped: the wrong key's error shown (`__flows__/sign-in` has it).                                                                                                                                         |
| `__browser__/sizes-helper.test.tsx`   | Dropped: a test of `atSize`, the helper: a flow at the wrong size does not run, and a misplaced call throws at once.                                                                                                                                                                 |
| `__browser__/sizes.test.tsx`          | Dropped: asserts a 19 px paragraph and a 38 px button, sizes (SC-006).                                                                                                                                                                                                               |
| `__browser__/spec-parts.test.tsx`     | `pages` (a spec with its folds open). Dropped: the parts fit the screen, and the pills' colours.                                                                                                                                                                                     |
| `__browser__/spec.test.tsx`           | `__flows__/spec` (R7) and `pages`. Dropped: the sticky part and story, the head sliding under the bar, 12 px edges, 75 characters per card line, the strength icon's colour, and the accessible-in-both-themes test (`pages` has it).                                                |
| `__browser__/story-chat.test.tsx`     | `__flows__/session` and `spec-embed` (R7) for the story in a message. Dropped: the chat on the main checkout showing the story from main, which needs a running Storybook.                                                                                                           |
| `__browser__/story-comments.test.tsx` | `__flows__/storybook-pick` (R7) for the pick script. Dropped: the four-action comment on a picked element, the phone's toolbar, and a comment kept through a restart, which need a running Storybook in a frame.                                                                     |
| `__browser__/story-embed.test.tsx`    | `__flows__/spec-embed` (the sandbox of the frame, R7). Dropped: the frame's start, sizes, scale, full screen, loading on scroll, the colour mode sent, and the host name's check, which need a running Storybook and measure pixels.                                                 |
| `__browser__/story-variants.test.tsx` | `__flows__/round` (a comment on a variant joins the answer). Dropped: where each variant shows under its option, which needs a running Storybook.                                                                                                                                    |
| `__browser__/storybook-page.test.tsx` | `__flows__/storybook-fixture` (R7). Dropped: the page's frame height and the list of Storybook in the column, which need a running Storybook.                                                                                                                                        |
| `__browser__/task.test.tsx`           | `width` (a pane's address across 768 px), `__flows__/priorities` (a line opens a pane). Dropped: the pane beside home on a wide screen, a layout choice.                                                                                                                             |
| `__browser__/usage.test.tsx`          | `__flows__/allowance` (R7). Dropped: the live update at both sizes and the sidebar's drawer.                                                                                                                                                                                         |

## R9: The Neovim tests, rebuilt as a smoke, and the files no earlier ruling placed

- **Decision**: the 13 test files of `editors/nvim/tests/` (87 mini.test cases, 2,628 lines, on the
  real `ura lsp`) are replaced by one, `test_smoke.lua`: 5 cases, 198 lines, over the same
  `helpers.lua` (139 lines to 118: the pre-commit hook helpers went with the test that counted hook
  runs) and `minimal_init.lua` (unchanged, 26 lines). The smoke keeps the plugin's main actions, as
  the spec's assumptions say, and reads what a file or git holds, never a window's wording or a
  drawn mark. Its cases:
  - **diagnostics**: the example's spec attaches the client, and an edit to `risk-tier: extreme`
    shows one diagnostic from `uraeda` on that line, without saving;
  - **a code action**: on `discovery: high` of the proposal, `vim.lsp.buf.code_action` applies "Set
    discovery to low" in the buffer, and the file on disk stays as it was;
  - **the waiting list**: from `README.md` of a repository whose round waits in another worktree,
    `:Uraeda waiting` opens that worktree's round;
  - **a comment**: `V2j` and `<leader>am` on a waiting spec, typed and saved, write the spec's
    `spec-review.md` with `verdict: pending` and the text, and leave the spec's buffer on screen;
  - **a verdict**: `<leader>av` and Approve, then `<C-s>`, commit `spec(nvim-plugin): approve` on
    the feature's branch, with `status: approved` in the file and a buffer not modified.
- **Rationale**: the plugin holds no workflow rules ([the README](/editors/nvim/README.md)): the
  rules are the server's, and their flows (R3's LSP `commands`, `writes`, `reads`, `fields`, and
  `diagnostics`) send the same requests the plugin sends, to the real server, with the refusals, the
  hook, and the git outcome. What only Neovim can break is the wiring: the client attaches, a
  response is applied, a command saves first and reloads what it wrote, and a window sends the
  command. One case each guards that wiring.
- **Alternatives considered**: keeping a case per command, each the server's flow behind a picker:
  they ran 44 s for the same wiring. A case per key: the plugin's key table is its configuration,
  and the smoke presses two of its keys.
- **If wrong**: restore a file from the commit before the smoke (its parent, `df916aab^`), and add
  its case.
- **Where**: task 10 of the plan, `editors/nvim/tests/`.
- **Breaks, run by hand and reverted**: each case failed alone, and no other, on a break of the
  wiring it guards. Diagnostics: the server's change handler no longer publishing
  (`crates/lsp/src/server.rs`). The code action: the server offering no choice
  (`crates/lsp/src/actions.rs`). The waiting list: the picked item no longer opened (`pickers.lua`).
  The comment: the text no longer sent (`comment.lua`, an empty text). The verdict: Approve sending
  the request-changes command (`verdict.lua`).
- **Before and after**: 87 cases in 13 files, 44 s per run (44.1 and 44.2 s, two runs, with `ura`
  already built), now 5 cases in 1 file, 1.6 s (1.64, 1.62, 1.60 s, three runs in a row green with
  the same counts). The Lua has no coverage run, before or after. CI runs it (the `neovim` job);
  Neovim 0.12.5 and mini.test were available on the development machine, so the smoke and its five
  breaks ran there.
- **What no longer runs**: the draft, the start, and the image through the plugin (the cursor's
  place after an image, a closed or edited buffer while a command runs, the clipboard's tools); the
  picker of a field and a typed number; the notes' cursor; the comment's other cases (an edited or
  emptied comment, the refusals) and its window; the verdict's window, its tier and plan review
  toggles, a round's submit, and its refusals; the inline comments and the priorities' hints drawn;
  the jumps between questions; the plugin's keys and prefix; the health report; the help's names;
  and the message of each refusal.
- **Old files**:

| Old file                             | Flow, or the rule that dropped it                                                                                                                                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test_attach.lua` (5)                | The smoke's diagnostics case (attach, and a diagnostic from an unsaved edit). Dropped: the files that do not attach, one client per checkout, and `lsp = false` (normal edge cases of the configuration; the comment and verdict cases attach inside a worktree). |
| `test_client.lua` (6)                | The comment and verdict cases (a command saves first, reloads what it wrote, and shows the committed file). Dropped: the refusal's text, a hook's output, and the older `ura` (messages; the server's flows hold the refusals and the hook).                      |
| `test_comment.lua` (7)               | The comment case. Dropped: an opened, emptied, or refused comment and the refusals of an uncommitted or approved spec (LSP `writes`), and the window's look (a screenshot of an appearance).                                                                      |
| `test_verdict.lua` (8)               | The verdict case. Dropped: the tier and plan review toggles, a failing hook, changes without comments, a file not waiting, a submitted round, blank answers (LSP `writes`, CLI `reviews` and `answers`), and the two windows' looks (screenshots).                |
| `test_waiting.lua` (5)               | The waiting case. Dropped: the current repository's own server, snacks' picker, outside a checkout, and nothing waiting (normal edge cases; LSP `reads` lists the waiting files).                                                                                 |
| `test_fields.lua` (4)                | The code action case (a value replaces its line in the buffer). Dropped: the picker's two steps, a typed number, a status that opens the verdict, and a cancelled picker (the one edit behind them is LSP `fields`).                                              |
| `test_actions.lua` (22)              | Dropped: draft, start, commit, and image are the server's commands, held by LSP `commands` and `writes` (R3) over the same requests; the cursor, buffer, and clipboard cases are editor details no decision's rule asks for (normal edge cases).                  |
| `test_note.lua` (6)                  | Dropped: the inbox's note is LSP `commands` and core `notes` (R3); the cursor placed at the note and the cancelled or blank note are normal edge cases.                                                                                                           |
| `test_jumps.lua` (2)                 | Dropped: `]u` and `[u` walk the items LSP `reads` returns; a key's motion is a normal edge case.                                                                                                                                                                  |
| `test_inline.lua` (8)                | Dropped: the comments and hints drawn under their lines, and their screenshot, are an appearance no decision asks for; the comments they draw are LSP `reads`' items.                                                                                             |
| `test_keys.lua` (5)                  | Dropped: the plugin's own key table, its prefix, and the files it sets keys in are its configuration, listed in its README; the smoke presses `<leader>am` and `<leader>av`.                                                                                      |
| `test_health.lua` (7)                | Dropped: `:checkhealth` prints text about the host's tools, and no decision asks for it.                                                                                                                                                                          |
| `test_doc.lua` (2)                   | Dropped: the help names every subcommand and option (text).                                                                                                                                                                                                       |
| `screenshots/` (4 reference screens) | Dropped with the cases that compared them (the comment window, the verdict's two windows, the inline comments): an appearance.                                                                                                                                    |
| `helpers.lua`, `minimal_init.lua`    | Kept, `helpers.lua` without the hook counter. The init still keeps the host's git out (R2).                                                                                                                                                                       |

### The files no earlier ruling placed

Every file of `main` whose path holds `test` or `tests/` was read against R3 to R9. These had no
flow or rule, and are placed here.

| Old file                                      | Flow, or the rule that placed it                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `crates/core/tests/problems.rs` (6)           | Core `check`: a missing section is a note and not a problem, what stops the workflow is a problem and loses the step, and the check keeps a note at its own severity (R3's problems rule). Dropped: each blocking rule's own case (a blank or deleted answer line, an invalid status), as a table row. |
| `packages/uraeda/scripts/release.test.ts` (3) | Kept as it is: a tag that is not a version or not the workspace's is refused, and the four platforms publish before `@uraeda/ui`, the distribution decision's order, which an npm publish cannot undo.                                                                                                 |
| `packages/uraeda/scripts/bump.test.ts` (6)    | Kept as it is: the release notes and the version bump the release writes into the tagged commit, so a mistake is only seen once released; 105 lines of pure functions, run in `ts:test`.                                                                                                               |
| `packages/binding/test-utils.test.ts` (1)     | Kept as it is: the test of the helper that commits on a branch without touching the checkout, which the TypeScript flows' repositories rely on: a helper that moved the checkout would make their flows pass whatever the code does.                                                                   |

Files with `test` in their path that are no tests: the shared helpers and setup
(`crates/*/tests/common/`, `packages/binding/test-setup.ts` and `test-utils.ts`,
`packages/server/src/testing.ts`, `__tests__/live-stream.ts`,
`packages/benchmarks/src/tests-source.ts`), the three benchmarks (`*.bench.ts`, R4),
`scripts/test-run.ts` and `.config/nextest.toml` (the runners, R5), `JumpToLatest.tsx` (a
component), and the drafts and records in `specs/` and `docs/`, which are prose.

## R10: The wording the web flows still read, accepted

- **Decision**: a web flow reads a state, a role, or an attribute where one exists. These reads of
  words stay, because no state of the page carries the same fact and a mark for it would be added
  only for the test:
  - `shell.test.tsx` reads a card's status from its mark's name (`Needs you`, `Working`,
    `Needs attention`): the mark's accessible name is the status.
  - `shell.test.tsx` matches `\d+ of \d+` in the task line: its count has no attribute of its own.
  - `notify.test.tsx` reads the count of the tab's title, `(3) Uraeda`: the title is the product.
  - `session-feature.test.tsx` reads the `Current: ` and `Done: ` prefixes of the task steps'
    labels: the label says which step is which.
- **Rationale**: SC-006 asks that a flow not break when a sentence is reworded. These four are the
  accessible names or the title the page gives, which a rewording of them would break for its
  readers too. The others, a sentence to find an element, were replaced by a role (`alert`) or a
  described-by link.
- **Alternatives considered**: a `data-` attribute on each, which only tests would read.
- **If wrong**: replace each read by a state when the page gets one.
- **Where**: `packages/web/src/__flows__/`.
