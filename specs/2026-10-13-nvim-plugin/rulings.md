# Rulings: Nvim plugin

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Candidates are padded to the longest section listed

- **Decision**: `draft::listed` pads each section's title to the longest title listed plus two
  spaces, so `Blocked  Benchmarks` gets two spaces and a list of `Now` and `Next` lines keeps its
  `Now   ` padding.
- **Rationale**: the padding lives in the core's
  [`actions/draft.rs`](/crates/core/src/actions/draft.rs), shared by `ura draft` and `ura start`,
  not in the CLI as the plan said. The plan's `{:<8}` leaves one space after `Blocked`, where its
  own test expects two, and changes the expected output of three existing CLI tests.
- **Alternatives considered**: `{:<9}`: fixes `Blocked` but rewrites the existing tests' expected
  output, which a fix of one section has no reason to change.
- **If wrong**: a display change of one line, with its test in `crates/cli/tests/draft.rs`.
- **Where**: task 1, `crates/core/src/actions/draft.rs`.

## R2: `ura lsp` adds 420 KB to the release binary

- **Decision**: the release `ura` (`cargo build --release -p uraeda-cli`, Linux x86-64) grows from
  4,936,136 bytes on task 1's commit to 5,366,376 bytes with `ura lsp` and its diagnostics: +430,240
  bytes, about 420 KB, or 8.7%. The pull request states it, as SC-005 asks.
- **Rationale**: the plan names this ruling R1, which task 1 already took. The growth is above the
  discovery's 263 KB, measured in a scratch crate: it adds the server's own code and the serde code
  of the `lsp-types` structures it uses, which a bare dependency does not instantiate. Later tasks
  use more of them, so the final growth is measured again for the pull request.
- **Alternatives considered**: none: `lsp-server` is the smallest server crate, and the
  [stack decision](../decisions/stack.md) names it.
- **If wrong**: a number in the pull request, measured again by one command.
- **Where**: task 2, `crates/lsp/`.

## R3: The server's tests use the example project

- **Decision**: the diagnostics tests copy the example project's `specs/` into a `TestRepo`
  (`feature_with_spec`, `write_example`), and edit its spec, instead of building a folder from
  `texts::spec("awaiting-human", 1, 1)`.
- **Rationale**: `texts::spec` is not a valid spec: it lacks thirteen required sections, so a test
  expecting one problem would get fourteen. The plan's own test replaces `risk-tier: high`, the
  example spec's value, and the example is the reference for valid files.
- **Alternatives considered**: a complete spec in `texts.rs`: a second copy of the template to keep
  in step with it, shared by the core's and the CLI's tests.
- **If wrong**: test fixtures only, in
  [`crates/lsp/tests/common/mod.rs`](/crates/lsp/tests/common/mod.rs).
- **Where**: task 2, `crates/lsp/tests/`.

## R4: The outline and the fields on disk come from the core

- **Decision**: a new core module, `files::outline`, gives every heading of a file with the item it
  holds (question, story, task, or comment), its id, and the line its section ends on; the server
  only nests the entries by level. `check::fields_on_disk` reads a closed file's fields for
  `uraeda/fields`. The plan's task 3 listed `crates/lsp` alone, and its commit adds `crates/core`
  too.
- **Rationale**: telling a question, a story, a task, or a comment from a heading is the workflow's
  structure, which the [stack decision](../decisions/stack.md) keeps in the core, and the core
  already parsed each of them (`question_heading`, `story_heading`, the plan's tasks, the review's
  comments); the outline reuses those parsers, now shared within the core. Reading a closed file
  from disk is the same rule for the spec's "else from disk".
- **Alternatives considered**: matching `Q`, `US`, `Task`, and `C` headings in the server: a second
  copy of the core's parsers to drift; `api::read_file`: it takes a feature folder and file name,
  and returns far more than the fields.
- **If wrong**: one module of the core and its test, in
  [`crates/core/src/files/outline.rs`](/crates/core/src/files/outline.rs) and
  [`crates/core/tests/files.rs`](/crates/core/tests/files.rs).
- **Where**: task 3, `crates/core/src/files/outline.rs`, `crates/core/src/check/mod.rs`.

## R5: An item's symbol is named by its id

- **Decision**: a question's, story's, task's, or comment's symbol is named by its id, `Q1.A`,
  `US1`, `Task 3`, or `C1`, with the rest of its heading as the symbol's detail; other headings keep
  their text. Questions and comments are `STRING`, as the plan says, stories `EVENT`, tasks
  `FUNCTION`, and other headings `NAMESPACE`.
- **Rationale**: the plan's test names the symbols `Q1`, `Q1.A`, and `Q2`, and pickers show the
  detail next to the name. Distinct kinds let an outline tell the items apart; LazyVim filters no
  symbol kind in markdown buffers, so every kind shows.
- **Alternatives considered**: the whole heading as the name: longer entries in a picker, and an id
  the user cannot jump to by typing it alone.
- **If wrong**: a naming and a `match` in [`crates/lsp/src/symbols.rs`](/crates/lsp/src/symbols.rs).
- **Where**: task 3, `crates/lsp/src/symbols.rs`.

## R6: The waiting files and the priorities' links come from the core

- **Decision**: two new core functions, `api::waiting` and `api::priority_links`, give the files
  waiting for the human with their absolute paths, and what each entry of a priorities text links to
  with its step. The server reads a round's questions and a review's comments with `files::items`,
  from the open text or the disk, and the commit subjects from `actions::review::subject` and
  `actions::answer::subject`; `actions::answer::blank` lists the questions without an answer, shared
  with the submission. The plan's task 4 named `api::read_file` and `api::read_workspace`.
- **Rationale**: `read_workspace` gives a feature's worktree relative to the main checkout, which a
  server rooted in a worktree cannot resolve, and links an entry to its feature only in the
  priorities on disk, not in the open text the hints follow; the path and the link matching are the
  core's, private to it. `read_file` reads the file on its branch, not the open text, and runs the
  checks of the whole feature. Both new functions skip `ura check`, so the hints stay cheap.
- **Alternatives considered**: resolving worktree paths and matching links in the server: a second
  copy of the core's rules; `read_workspace` for the hints: they would lag unsaved edits.
- **If wrong**: two functions in [`api.rs`](/crates/core/src/api.rs) and their callers in
  [`crates/lsp/src/requests.rs`](/crates/lsp/src/requests.rs) and
  [`crates/lsp/src/hints.rs`](/crates/lsp/src/hints.rs).
- **Where**: task 4, `crates/core/src/api.rs`, `crates/lsp/src/`.

## R7: The review refusals of the spec are the server's, checked before the core

- **Decision**: `uraeda.comment`, `uraeda.approve`, and `uraeda.requestChanges` refuse with the
  spec's texts before calling the core: `<name> is not waiting for a review.` from the text's
  status, `<name> differs from its last commit: …` when the open text differs from the file at the
  branch's tip (read with `api::read_file`), and `Requesting changes needs at least one comment.`
  from the pending review's comments, as `uraeda/verdict` counts them. `uraeda.submit` on another
  file than a round refuses `Only a round of questions is submitted.`, a text the spec does not
  give. A hook's whole output comes in `data.output`, next to `data.code`.
- **Rationale**: the core's own messages differ (`spec.md is not waiting for a review`,
  `a request for changes needs at least one comment: ura review …`), and the CLI's tests pin them;
  the core never compares an editor's unsaved text with the tip. The checks only read, through the
  core's parsers and `api`, and every write stays the core's, which checks again.
- **Alternatives considered**: changing the core's messages: rewrites the expected output of the
  CLI's tests, and the CLI's wording; mapping the core's messages in the server: matching on text
  that can change.
- **If wrong**: three checks in [`crates/lsp/src/commands.rs`](/crates/lsp/src/commands.rs).
- **Where**: task 5, `crates/lsp/src/commands.rs`, `crates/lsp/src/requests.rs` (`api_error`).

## R8: The command tests set `URA_TODAY` once for their process

- **Decision**: every test of `crates/lsp/tests/commands.rs` first sets `URA_TODAY=2026-10-14`
  through one `Once`, so starts, approvals, and submissions write that day; the core reads the
  variable from the process, which the server's thread shares with the test.
- **Rationale**: the core has no other way in for the date, and adding one to `api` for tests
  changes the binding's functions. One value for the whole file, set before any server starts, never
  races with a read; the spec's `Approved on 2026-10-13.` is checked as `2026-10-14`, the day US3.1
  needs.
- **Alternatives considered**: a date parameter in `api`: a change to every write function for
  tests; running `ura lsp` as a process per test: slower, and the in-memory `Session` is the plan's
  helper.
- **If wrong**: one helper of the test file.
- **Where**: task 5, `crates/lsp/tests/commands.rs`.

## R9: Progress, results, and unknown commands

- **Decision**: the worker reports progress on the client's `workDoneToken`, else on a token it
  creates with `window/workDoneProgress/create` when the client advertises
  `window.workDoneProgress`, as Neovim does; the `Session` advertises it. `begin`'s title is the
  action (`Starting Codex runtime…`, `Approving spec.md…`), and only a start's `end` has a message,
  `Started <folder>`. `uraeda.commit` writes no file and answers `written: []`; `uraeda.start`
  answers the default branch's `PRIORITIES.md` and draft as written. A command the server does not
  know answers `InvalidParams`, `unknown command <name>`, and `initialize` lists the eight commands
  in `executeCommandProvider`. The tests drive the protocol directly, so step 2 failed with
  `method not found: workspace/executeCommand`, the server's answer before the capability existed.
- **Rationale**: LSP lets a server create progress only for a client that supports it; the list of
  commands lets the plugin tell an older `ura` from a refusal.
- **Alternatives considered**: progress without `create`: clients drop tokens they did not create.
- **If wrong**: the worker in [`crates/lsp/src/server.rs`](/crates/lsp/src/server.rs).
- **Where**: task 5, `crates/lsp/src/server.rs`, `crates/lsp/tests/common/mod.rs`.
