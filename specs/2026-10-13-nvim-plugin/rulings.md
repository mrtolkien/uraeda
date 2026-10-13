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

## R10: The plugin's test harness and health

- **Decision**: `helpers.new_child()` returns a mini.test child whose `child.setup(config?)`
  restarts it with `vim.g.uraeda` set through `--cmd`, since `plugin/uraeda.lua` reads the options
  at startup; `helpers` also gives `write`, `set_hook`, `hook_runs`, and `example`, for later tasks.
  A third test file, `test_client.lua`, covers `client.command` and `client.request`: saving first,
  reloading what was written, opening what was opened, the progress notification, a refusal, a
  hook's output, an older `ura`, and a buffer without a client. `client.command` sends its own
  `workDoneToken`, so it follows its command's progress only. Health also shows `ura --version` and
  says `ura is older than the plugin: run ura upgrade.` when `<cmd> --help` fails. Step 2 failed
  with no client attaching and `No healthcheck found for "uraeda" plugin.`, not
  `module 'uraeda' not found`, since the plan's tests only require the plugin through the child.
  `vp run ready` stops at the pre-existing failure of `uraeda-core --test priorities`
  (`edits_keep_every_other_line`); its other parts, run one by one, pass.
- **Rationale**: the plan's tests set options such as `lsp = false` that only apply at startup; the
  spec's flow (save, progress, reload, open, errors) lives in `client.lua`, which no listed test of
  task 6 reached, and later tasks build on it. The spec's health reports the version found; `ura`
  has no version the plugin needs beyond having `lsp`.
- **Alternatives considered**: setting options after startup in each test: the plugin would have
  enabled the server already; leaving `client.lua` to task 7's tests: its errors would surface
  through the actions, harder to trace.
- **If wrong**: test helpers and one test file in [`editors/nvim/tests/`](/editors/nvim/tests/), and
  a few lines of [`health.lua`](/editors/nvim/lua/uraeda/health.lua).
- **Where**: task 6, `editors/nvim/`.

## R11: An action's key lives in its registry entry

- **Decision**: each entry of `actions.list` carries its key under the prefix, `key`, next to the
  plan's `name`, `desc`, `fn`, `modes`, and `buffer_local`; `keys.attach(bufnr)` maps every entry
  with a key, buffer-local or, for one without `buffer_local`, once globally on the first `uraeda`
  attach, as the edge case of a missing `ura` sets no key under the prefix. `fn` receives
  `:Uraeda`'s command opts, so a later action can read a range; keys and `<Plug>` mappings call it
  without arguments. After a start, the draft's buffer is deleted without force, so an edit typed
  while the start ran is kept in it. The tests type the default leader, `\`, since `nvim_input` does
  not expand `<Leader>`. A fifth key test checks that a file without a client gets no key.
- **Rationale**: the plan's entry shape had no key, so `keys.lua` would hold a second list of names
  that each later task edits; one entry per action keeps the key, the subcommand, and the `<Plug>`
  mapping together, which SC-002's test walks.
- **Alternatives considered**: a table of keys by name in `keys.lua`: two places to edit per action;
  the global keys at startup: they would be set with no `ura` on the path, against the edge case.
- **If wrong**: one field per entry in [`actions.lua`](/editors/nvim/lua/uraeda/actions.lua) and a
  loop in [`keys.lua`](/editors/nvim/lua/uraeda/keys.lua).
- **Where**: task 7, `editors/nvim/lua/uraeda/`.

## R12: A picked or typed value is the server's edit

- **Decision**: a new request, `uraeda/setField { uri, name, value }`, answers the `WorkspaceEdit`
  of the field's line in the open document, built by `frontmatter::set` like the code actions, which
  now share its edit. The field picker applies it for every value, picked or typed; it never asks
  for code actions. The request refuses a file that is not open (`spec.md is not open.`), a field
  the file does not have (`spec.md has no field owner.`), a value of more than one line
  (`A value is one line.`), and a value set by a verdict
  (`status: approved is set by a verdict, not an edit.`); it never writes the disk. The picker lists
  the fields the file has, not the missing ones, and says `<file> has no frontmatter field.` when
  there is none. Step 2 failed with `method not found: uraeda/setField` and, in the plugin, on the
  missing `field` action, not `module 'uraeda.pickers' not found`, since the tests reach the pickers
  through the action. A fourth plugin test checks that a cancelled picker changes nothing.
- **Rationale**: the code actions offer only the allowed values other than the current one, so a
  typed revision has no edit to apply, and the plugin must not edit frontmatter text itself
  ([stack](../decisions/stack.md)); one request for both paths keeps one way to an edit in the
  plugin.
- **Alternatives considered**: code actions for picked values and a request for typed ones: two
  paths to the same edit; the plugin writing `name: value` on the line: it would parse the
  frontmatter, against the stack decision.
- **If wrong**: one request in [`crates/lsp/src/actions.rs`](/crates/lsp/src/actions.rs), its test
  in [`crates/lsp/tests/editing.rs`](/crates/lsp/tests/editing.rs), and `set` in
  [`pickers.lua`](/editors/nvim/lua/uraeda/pickers.lua).
- **Where**: task 8, `crates/lsp/src/actions.rs`, `editors/nvim/lua/uraeda/pickers.lua`.

## R13: The comment window asks the server before it opens

- **Decision**: a new request, `uraeda/canComment { uri }`, answers `null` when `uraeda.comment`
  would take a comment on the file, else its refusal (`spec.md is not waiting for a review.`,
  `spec.md differs from its last commit: …`), from the same check, and writes nothing. The comment
  action asks it, then `uraeda/comments`, and opens the window only on an answer. On lines with a
  comment, the window covers that comment's lines and edits it; an empty new comment closes the
  window without a command. The plugin tests use a feature on its own branch, in its worktree, as
  the server's tests do, and step 2 failed with `method not found: uraeda/canComment` and, in the
  plugin, on the missing `comment` action, not `module 'uraeda.comment' not found`.
- **Rationale**: US4.4 wants no window on an uncommitted spec, and the plugin must not tell a
  waiting or committed file itself ([stack](../decisions/stack.md)). A request answers on the
  server's loop, without the progress notification a dry run of the command would show.
- **Alternatives considered**: a `dryRun` argument of `uraeda.comment`: it runs on the worker,
  between progress notifications, for a check that writes nothing; opening the window and refusing
  on save: the text typed would be for nothing.
- **If wrong**: one request in [`commands.rs`](/crates/lsp/src/commands.rs), its test in
  [`crates/lsp/tests/commands.rs`](/crates/lsp/tests/commands.rs), and the first request of `open`
  in [`comment.lua`](/editors/nvim/lua/uraeda/comment.lua).
- **Where**: task 9, `crates/lsp/src/`, `editors/nvim/lua/uraeda/comment.lua`.

## R14: The verdict window's hints are virtual, and its command saves first

- **Decision**: `Tab to change` and `Summary (optional)` are virtual text, so the buffer's lines are
  the plan's: the header, a separator, then the summary only. The risk tier's, the plan review's,
  and the separator's lines are found by extmarks, so an edit above them moves nothing. Plan review
  starts at the spec's value, else at the tier's default. A review without comments reads
  `Comments none`; one blank question reads `Q3 has no answer.`, as `ura check` words it. The window
  opens centred, the cursor on the summary's line in normal mode. `<C-s>` runs the command with
  `save`, like the other actions, so typed answers reach the disk before the submission; on a
  refusal, the window and its summary stay. The plugin tests make the example spec's block a waiting
  one, as the server's tests do, so its record can be checked. Step 2 failed with
  `module 'uraeda.verdict' not found` in the screenshot tests, which call `verdict.open`, and with
  no window in the others, which reach it through the missing `verdict` action.
- **Rationale**: the plan sends the lines after the separator as the summary: a real
  `Summary (optional)` line would be sent with it. US6.3 counts on the answers on disk, which the
  core reads.
- **Alternatives considered**: reading the summary from a marked first line: the human could delete
  the label; refusing a file not waiting before the window opens: the server already refuses it with
  the spec's text (R7).
- **If wrong**: [`verdict.lua`](/editors/nvim/lua/uraeda/verdict.lua).
- **Where**: task 10, `editors/nvim/lua/uraeda/verdict.lua`.

## R15: The waiting picker starts its own server, and `]u` is an entry's own key

- **Decision**: `pickers.waiting()` asks `uraeda/waiting` through a new `client.request_any`: any
  running `uraeda` client, else one started with `vim.lsp.start(…, { attach = false })` on the
  checkout of the current buffer's file, else of the current folder (`<cwd>/specs/PRIORITIES.md`),
  both found by `require("uraeda").checkout`, the function `lsp/uraeda.lua`'s `root_dir` now calls
  instead of its own copy. The request waits for the started client's initialization. Outside a
  checkout it says `This file is not a Uraeda workflow file.`; an empty answer says
  `Nothing waits on you.` (info), rather than an empty picker. Snacks is used when the global
  `Snacks` has `picker.pick`, with items `{ text, file, pos = { line, 0 } }`; `vim.ui.select` has
  the kind `uraeda_waiting`. A registry entry takes `lhs`, a key of its own outside the prefix,
  instead of `key`: `next` and `prev` have `]u` and `[u`, buffer-local, and like every key not set
  when the prefix is `false`. SC-002's test checks that each action has exactly one of `key` and
  `lhs`, and finds its mapping. `marks.jump` adds the jump to the jumplist, and moves nothing when
  the window shows another buffer by the time the server answers. Step 2 failed with no picker, no
  cursor move, and `unknown action "waiting"`, not `module 'uraeda.marks' not found`, since the
  tests reach the modules through the actions and keys.
- **Rationale**: US8 wants the list from any buffer, where no client is attached; the root must be
  found as the server's is, so one function serves both. A notification says more than an empty
  picker.
- **Alternatives considered**: starting the client on the current buffer only: a `README.md` at the
  repository's root has no `specs/` parent; a second list of keys outside the prefix in `keys.lua`:
  two places to edit per action, against R11.
- **If wrong**: `request_any` in [`client.lua`](/editors/nvim/lua/uraeda/client.lua), `waiting` in
  [`pickers.lua`](/editors/nvim/lua/uraeda/pickers.lua), and `lhs` in
  [`keys.lua`](/editors/nvim/lua/uraeda/keys.lua).
- **Where**: task 11, `editors/nvim/lua/uraeda/`, `editors/nvim/lsp/uraeda.lua`.

## R16: Inline comments redraw by folder, and start from the option

- **Decision**: `marks.refresh(paths?)` redraws every loaded buffer with a `uraeda` client, or only
  those in the folders of `paths`: `User UraedaComment` redraws them all, a `BufWritePost` of a file
  with a client redraws its folder, and `client.command` redraws the folders of its `written` files,
  so a comment, an edit, or a verdict redraws the spec, plan, or assessment next to its review.
  `inline_comments = false` hides them until `<leader>at`, which flips a buffer-local
  `vim.b.uraeda_inline`; `UraedaComment` is set where it is drawn, as `UraedaVerdictBorder` is.
  `uraeda/comments` is sent without a buffer, so Neovim sends every buffer's pending changes first
  (a review reloaded after a command), and a redraw shows no error. The priorities test puts the
  example's bug on its own branch, where its step is `human-gate · waits on you`; on `main` the core
  counts it `done`. Task 9's screenshot runs with `inline_comments = false`: the window alone, as
  its reference was taken. Step 2 failed with no virtual line and no inlay hint, not
  `attempt to call field 'show'`, since the tests reach `marks` through the autocommands and keys.
- **Rationale**: telling a review file from its spec by name is the workflow's structure, which the
  plugin must not parse ([stack](../decisions/stack.md)); a folder holds one feature, and redrawing
  its few buffers costs a request each. A verdict writes the review without a `BufWritePost`.
- **Alternatives considered**: a `*-review.md` pattern: a naming rule in the plugin; `show` drawing
  nothing at all when the option is false: the toggle would do nothing.
- **If wrong**: `refresh` in [`marks.lua`](/editors/nvim/lua/uraeda/marks.lua), its three callers,
  and one line of [`test_comment.lua`](/editors/nvim/tests/test_comment.lua).
- **Where**: task 12, `editors/nvim/`.

## R17: The help's names are tags, checked on a copy with its tags generated

- **Decision**: [`test_doc.lua`](/editors/nvim/tests/test_doc.lua) checks that `doc/uraeda.txt`
  defines a tag for each name: `*:Uraeda-<name>*` and `*<Plug>(uraeda-<name>)*` per action of
  `actions.list`, and `*vim.g.uraeda.<key>*` per key of `config()`. `:help uraeda opens` copies the
  help to a temporary `doc/`, runs `:helptags` there, puts it first on the child's runtimepath, and
  opens `:help uraeda`, then each of those tags. Step 2 failed with
  `E484: Can't open file …/doc/uraeda.txt` and a failed copy, not `E149: Sorry, no help for uraeda`,
  since the test reads the file before asking for help. No `tags` file is committed.
- **Rationale**: a tag is what `:help :Uraeda-draft` reaches, so the test checks what a user types,
  not a word in a sentence. lazy.nvim generates the tags of a `dir` plugin; a committed `tags` file
  would go stale, and running `:helptags` in `editors/nvim/doc/` would leave an untracked file.
- **Alternatives considered**: a plain text search for each name: a mention in prose would pass
  without a section; committing `doc/tags`: generated, and stale after an edit.
- **If wrong**: [`test_doc.lua`](/editors/nvim/tests/test_doc.lua) only.
- **Where**: task 13, `editors/nvim/tests/test_doc.lua`, `editors/nvim/doc/uraeda.txt`.

## R18: A round is submitted from its own buffer only, when it waits and is the latest

- **Decision**: `uraeda.submit` refuses a round that is not `awaiting-human` with
  `clarifications-01.md is not waiting for answers.`, and a round followed by another in its folder
  with `clarifications-01.md is not the latest round: clarifications-02.md is.`, before the core
  submits the feature's latest round. The final review found an answered round 01 submitting round
  02; the test failed with the command's success on round 02.
- **Rationale**: the core's `submit_answers` takes a feature, not a file, so the server must make
  sure the file in the buffer is the one it submits. A round waits for answers, not for a review, so
  the reviews' `is not waiting for a review.` would read wrong.
- **Alternatives considered**: the reviews' text: wrong word for a round; a file argument to the
  core's `submit_answers`: a change to the core and the CLI for a check the server can make.
- **If wrong**: `submit` and `latest_round` in [`commands.rs`](/crates/lsp/src/commands.rs), and
  their test in [`crates/lsp/tests/commands.rs`](/crates/lsp/tests/commands.rs).
- **Where**: final review, `crates/lsp/src/commands.rs`.

## R19: Drafts and the priorities act only from the default branch's checkout

- **Decision**: `uraeda.draft` on `PRIORITIES.md`, `uraeda.start` on a draft or a backlog file, and
  `uraeda.commit` on any of them refuse when the server's checkout is not on the default branch,
  with `PRIORITIES.md here is not main's: open it from main's checkout, /path/to/repo.`, the file's
  name and the default branch's, and the path of the checkout that has it; when none has it, the end
  reads `open it from a checkout of main.` The check reads the current and default branches and the
  worktrees through the core's `Git`, rather than comparing with `api::default_root`, which creates
  a worktree for the default branch when none has it. The final review found a worktree's edited
  priorities committed as main's, or `has no change to commit`; the test failed with
  `PRIORITIES.md changed on disk. Nothing was drafted.`
- **Rationale**: these files are written on the default branch, so a feature worktree's copy is not
  the text the core edits: a draft's line, or a commit, would act on another file than the one in
  the buffer. A refusal must not leave a worktree behind.
- **Alternatives considered**: `api::default_root` compared with the root: a refusal that creates a
  worktree; acting on the default branch's copy as before: the human's edit in the buffer is
  ignored, or another change is committed.
- **If wrong**: `on_default_branch` in [`commands.rs`](/crates/lsp/src/commands.rs), its three
  callers, and its test in [`crates/lsp/tests/commands.rs`](/crates/lsp/tests/commands.rs).
- **Where**: final review, `crates/lsp/src/commands.rs`.

## R20: A server failing before its initialization is an older `ura`, said once

- **Decision**: the `uraeda` configuration's `on_exit` calls `client.exited`: a client that exits
  with a non-zero code before it is initialized marks the session, and notifies
  `ura is older than the plugin: run ura upgrade.` once, at the error level, titled `Uraeda`. From
  then on, an action in a buffer without a client says that text instead of
  `This file is not a Uraeda workflow file.`, and the waiting picker says it instead of
  `ura lsp did not start.`; a buffer outside a checkout still says it is not a workflow file. The
  test runs a script printing `error: unrecognized subcommand 'lsp'` and exiting 2 as the server,
  opens two workflow files, and failed with no notification titled `Uraeda`.
- **Rationale**: the spec's edge case wants the error shown once, and its error handling names the
  text; clap's exit before any answer is the only sign the plugin gets, and the plugin must not run
  `ura` itself to tell why. Neovim's own `Client uraeda quit with exit code 2` warning stays.
- **Alternatives considered**: reading the server's stderr for `unrecognized subcommand`: Neovim
  only logs it; one notification per failed client: one per file opened.
- **If wrong**: `exited` and `no_client` in [`client.lua`](/editors/nvim/lua/uraeda/client.lua), and
  `on_exit` in [`lsp/uraeda.lua`](/editors/nvim/lsp/uraeda.lua).
- **Where**: final review, `editors/nvim/`.
