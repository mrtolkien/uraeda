---
status: auto-approved
spec-revision: 1
---

# Plan: Nvim plugin

**Goal:** A `ura lsp` language server and a Neovim plugin in `editors/nvim/` that bring Uraeda's
checks, outline, and every human action of the workflow into Neovim, under `<leader>a`.

**Architecture:** A new crate, `crates/lsp`, serves the protocol on `lsp-server` over stdio and
calls only the core: `check` on the buffer's text for diagnostics, the core's fields for completion
and code actions, and `api` for every command. The Lua plugin holds keys, pickers, and windows, and
asks the server for every fact about a file. See the [spec's design](spec.md#design).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

1. **A file opened from `.worktrees/<branch>/` whose branch is also checked out nowhere else**: the
   server's root is that worktree, and every `api` call receives the worktree's path, never the main
   checkout's. Task 2.
2. **A `PRIORITIES.md` line wrapped over two lines, or a nested sub-item**: drafting from the second
   line of an entry drafts that entry; drafting from a nested sub-item refuses with
   `This line is not a priorities entry.` Task 5.
3. **A comment typed with a line starting with `#`**: the core refuses it; the window stays open
   with the text, and the error shows, so nothing typed is lost. Task 9.
4. **A buffer closed or its client stopped while a command runs**: the result is applied to the
   files on disk only; the plugin never errors on a missing buffer. Task 7.
5. **CRLF files**: a frontmatter edit keeps the file's line endings, and diagnostics' lines match.
   Task 1.

## Global constraints

From the decisions and the spec, every task's requirements include these:

- "The language server MUST live in `crates/lsp`, run as `ura lsp` over stdio, and reach workflow
  files only through the core." ([stack](../decisions/stack.md))
- "The language server MUST be built on the `lsp-server` and `lsp-types` crates, without an async
  runtime." ([stack](../decisions/stack.md))
- "Editor plugins MUST live in `editors/<editor>/`, and MUST reach workflow files only through
  `ura lsp`. They MUST NOT parse workflow files, their frontmatter, or their structure, with a
  library or by hand." ([stack](../decisions/stack.md))
- "The language server's completions and code actions MUST only edit the open document. Actions that
  write another file or commit MUST be commands the user runs explicitly, never code actions."
  ([stack](../decisions/stack.md))
- "Workflow logic, parsing, validation, and workflow states MUST live in the Rust core,
  [`crates/core`](/crates/core/)." ([stack](../decisions/stack.md))
- "Tools MUST NOT bypass the user's hooks: no `--no-verify`, and no commit written by gix or with
  plumbing to skip them." ([git](../decisions/git.md))
- "In Rust, every git access MUST go through one module of the core, so no other code uses gix or
  builds `git` command lines." ([git](../decisions/git.md))
- "A change to a command's behaviour MUST update the skill in the same change" and "A feature that
  adds a dependency to the CLI MUST measure the size it adds to the release binary".
  ([CLI](../decisions/cli.md))
- "`vp run ready` MUST run every check of the repository. A new language, package, crate, or tool
  MUST add its checks to it." ([toolchain](../decisions/toolchain.md))
- Lines are 1-based in `uraeda/*` messages and command arguments, 0-based in standard LSP messages.
  ([spec, Data](spec.md#data))
- Command results are `{ opened?: string, written: string[] }`, absolute paths; errors are LSP
  errors with the core's message, and `data: { code }` with `refused`, `conflict`, or `hook`.
  ([spec, Data](spec.md#data))
- Exact texts ([spec](spec.md)):
  - `Only a draft or a backlog file can be started.`
  - `spec.md differs from its last commit: comments point at the committed version. Commit or undo the change first.`
    (with the file's name)
  - `spec.md is not waiting for a review.` (with the file's name)
  - `Requesting changes needs at least one comment.`
  - `Q3 and Q5 have no answer.` (the blank questions, joined with `, ` and a final `and`)
  - `Only drafts, backlog files, proposals, and PRIORITIES.md are committed from the editor.`
  - `This file is not a Uraeda workflow file.`
  - `ura is older than the plugin: run ura upgrade.`
  - `Starting <title>…`, then `Started <folder>`
  - `PRIORITIES.md changed on disk. Nothing was drafted.` (the core's)
  - `ura not found on PATH`, `Neovim 0.11 or later is required` (health)
- Diagnostics have the source `uraeda`, severity error; a problem without a line is on line 1.
- Keys: prefix `vim.g.uraeda.prefix`, default `<leader>a`; `n` draft, `p` start, `m` comment (normal
  and visual), `e` field, `v` verdict, `g` commit, `t` inline comments, buffer-local; `w` waiting,
  global; `]u` and `[u` buffer-local. Descriptions start with `Uraeda`.
- Highlight groups: `UraedaVerdictBorder` linked to `DiagnosticWarn`, `UraedaComment` linked to
  `DiagnosticInfo`. Inline comments read `▎ C1  <text>`.
- Neovim 0.11 is the minimum; Lua targets LuaJIT (Lua 5.1), formatted by StyLua at 2 spaces and 100
  columns.

## Code read

- [`crates/core/src/api.rs`](/crates/core/src/api.rs): every action the server needs, by repository
  path: `read_workspace`, `read_file` (current version, its items, the review's items with comment
  lines), `create_draft(repo, id, previous)` guarded by the priorities' hash, `start_feature`,
  `add_comment`, `edit_comment`, `remove_comment`, `approve`, `request_changes` (both refusing a
  file whose disk differs from its tip, `as_committed`), `submit_answers`, `commit_text` (drafts,
  backlog files, proposals), `commit_priorities`. Writes take the global `write_lock`. Errors are
  `ApiError { code, message, output }`.
- [`crates/core/src/check/mod.rs`](/crates/core/src/check/mod.rs): `check(root, target)` reads every
  file of a folder from disk (`check_folder_files`), then `check_file` per file. A text variant
  needs one file's text replaced in that folder's `texts` map.
- [`crates/core/src/check/values.rs`](/crates/core/src/check/values.rs): private `fields(kind)` and
  `allowed(kind, key)`, the only list of fields and values; `FileKind::statuses()` in
  [`workspace.rs`](/crates/core/src/workspace.rs).
- [`crates/core/src/files/frontmatter.rs`](/crates/core/src/files/frontmatter.rs): `parse` gives
  each field's line and raw value without a trailing ` #` comment; `set` replaces the whole line,
  through `with_unix_newlines`, so CRLF files keep their endings.
- [`crates/core/src/files/items.rs`](/crates/core/src/files/items.rs): `items(name, text, document)`
  gives questions with `start_line`, `answer_line`, `answer`, comments with `start_line`,
  `end_line`, `general`, and spec stories, plan tasks.
- [`crates/core/src/files/priorities.rs`](/crates/core/src/files/priorities.rs): `parse(text)` gives
  `Entry { section, position, line, link, .. }`; `Section::id()` and the position make the id
  `next-2` that `create_draft` takes. Nested items are not entries.
- [`crates/core/src/files/markdown.rs`](/crates/core/src/files/markdown.rs): `Document::parse` gives
  headings with lines, for symbols.
- [`crates/core/src/today.rs`](/crates/core/src/today.rs): `URA_TODAY` sets the date in tests.
- [`crates/core/tests/common/repo.rs`](/crates/core/tests/common/repo.rs): `TestRepo`, a temporary
  repository with a pre-commit hook counting its runs, shared by the CLI's tests through `#[path]`
  ([`crates/cli/tests/common/mod.rs`](/crates/cli/tests/common/mod.rs)); `texts.rs` builds
  proposals, rounds, specs, and plans.
- [`crates/cli/src/main.rs`](/crates/cli/src/main.rs): clap subcommands; `draft.rs` lists candidates
  with `{:<6}`, which glues `Blocked` to its text.
- [`package.json`](/package.json): `ready` runs cargo fmt, clippy, tests, `ura check`, the binding,
  `vp check`, `vp test`, and the web build. [`flake.nix`](/flake.nix): the dev shell has Node, pnpm,
  and Rust only. [`vite.config.ts`](/vite.config.ts): staged `*.rs` go to rustfmt, all else to
  `vp check --fix`.
- `nixpkgs` at the flake's lock has `vimPlugins.mini-test` 0.18.0 and `stylua` 2.5.2.
- `lsp-server` 0.10.0 and `lsp-types` 0.97.0 are in the local cargo cache.

## Constitution check

| Principle                            | Complies | Notes                                                                           |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | Commits run only from commands; code actions only edit the buffer (task 3)      |
| II. Git and plain text first         | yes      | No state outside the repository; edits are text edits                           |
| III. Asynchronous by default         | yes      | Each command ends on disk or in a commit, like `ura`                            |
| IV. Review effort matches impact     | yes      | The verdict window shows the commit before it is made (task 10)                 |
| V. Tools are optional                | yes      | The skill names `ura lsp`; the server reports only `ura check`'s rules (task 2) |
| VI. Code is checked against the spec | yes      | Every scenario has a test below; abstractions are listed in complexity tracking |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Stack](../decisions/stack.md): the server in `crates/lsp` on `lsp-server` (task 2), the core's
  functions for every fact and action (tasks 1 to 5), code actions that only edit the buffer (task
  3), and a plugin that never parses workflow files (tasks 6 to 12).
- [CLI](../decisions/cli.md): `ura lsp` in the skill's CLI table, and the release size measured
  (task 2).
- [Git](../decisions/git.md): every write through `api`, hooks running (task 5).
- [Toolchain](../decisions/toolchain.md): Neovim, StyLua, and mini.test in the dev shell, their
  checks in `vp run ready` (task 6).

## Complexity tracking

| Abstraction or exception               | Why it is needed                                                           | Simpler alternative rejected because                                      |
| -------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `uraeda-lsp` crate                     | The protocol layer, apart from the core's logic and the CLI's commands     | In `crates/cli`: the CLI's modules are commands; the server is a service  |
| `Documents` (open texts by URI)        | Every capability reads the buffer, not the disk                            | Reading the disk: diagnostics would lag unsaved edits, against US1        |
| `check::check_text`                    | Diagnostics on unsaved text with the same rules                            | Writing the buffer to a temporary folder: a copy of the folder per change |
| `values::field_list` public            | The server and `check` share one list of fields and values                 | A copy in the server: two lists to drift                                  |
| Lua `client.lua`                       | One place for requests, saving, reloading, progress, and errors            | Each action calling `vim.lsp`: the same error handling seven times        |
| Lua test helpers (`tests/helpers.lua`) | A child Neovim on a temporary repository with the real server, in a line   | Setup in each test file: the same twenty lines in each                    |
| Rust test helper `Session`             | Drives the server in memory: initialize, open, request, wait for a message | Raw `Connection` calls in each test: protocol noise in every test         |

## Review comments

- **C1** (lines 28–29): you want the server to show something on `PRIORITIES.md`, a file with a
  special role. Each entry linked to a feature gets an inlay hint at the end of its line, its step
  and who it waits on, like `discovery · waits on you`, and each linked draft `draft`; the sections
  are symbols in the outline. Task 4 (server) and task 12 (enabling the hints in the plugin).
- **C2** (lines 33–39): noted: the plugin is a second way in, next to the web UI, not a replacement.
  Nothing in the design assumed otherwise; the feature's record will word it so (finish step).

---

## Task 1: The core's fields, a frontmatter edit that keeps comments, and a check of a text

**Files:**

- Modify: `crates/core/src/check/values.rs` (`fields`, `allowed`, new `field_list`)
- Modify: `crates/core/src/check/mod.rs` (new `check_text` and `fields`)
- Modify: `crates/core/src/files/frontmatter.rs` (`set`)
- Modify: `crates/core/src/actions/draft.rs` (the candidates' padding, in `listed`)
- Test: `crates/core/tests/fields.rs`, `crates/core/tests/check.rs`, `crates/core/tests/files.rs`,
  `crates/cli/tests/draft.rs`

**Interfaces:**

- Produces:
  - `uraeda_core::check::fields(root: &Path, path: &Path, text: &str) -> Vec<Field>`: the fields of
    the file at `path` (absolute, under `root`) with `text` as its content; empty for a file without
    frontmatter fields.
  - `pub struct Field { name: String, line: Option<u32>, value: Option<String>, kind: FieldKind, values: Vec<Choice> }`,
    `pub enum FieldKind { Choice, Integer, Boolean, Date, Text }`,
    `pub struct Choice { value: String, action: Option<Action> }`,
    `pub enum Action { Approve, RequestChanges, Submit }`, all `Serialize` with camelCase, in
    `crates/core/src/check/values.rs`, re-exported from `check`.
  - `uraeda_core::check::check_text(root: &Path, path: &Path, text: &str) -> Vec<Problem>`: the
    problems `check(root, path)` would report if the file held `text`.
  - `frontmatter::set` keeps a ` # comment` after the value it replaces.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/fields.rs, on a TestRepo with a feature folder
#[test]
fn a_spec_lists_its_fields_with_their_values_and_actions() {
    // spec("awaiting-human", 1, 1) at specs/2026-10-13-x/spec.md
    let fields = check::fields(root, &spec_path, &text);
    assert_eq!(names(&fields), ["status", "revision", "clarifications", "risk-tier", "plan-review"]);
    let status = &fields[0];
    assert_eq!(status.line, Some(2));
    assert_eq!(values(status), ["awaiting-human", "approved", "changes-requested"]);
    assert_eq!(status.values[1].action, Some(Action::Approve));
    assert_eq!(status.values[2].action, Some(Action::RequestChanges));
    assert_eq!(fields[1].kind, FieldKind::Integer);
    assert_eq!(fields[4].kind, FieldKind::Boolean);
}

#[test]
fn a_round_offers_submit_on_answered() { /* clarifications: answered → Some(Action::Submit) */ }

#[test]
fn a_proposal_without_its_optional_field_lists_it_without_a_line() {
    // "# Proposal\n" → [Field { name: "discovery", line: None, value: None, kind: Choice, values: low, medium, high }]
}

#[test]
fn every_kind_lists_the_fields_check_requires() {
    // table-driven: proposal, clarifications, spec, plan, review, decision, record, assessment,
    // PRIORITIES.md (no fields)
}

// crates/core/tests/check.rs
#[test]
fn a_text_is_checked_in_place_of_its_file() {
    // spec on disk with risk-tier: high; text with risk-tier: extreme
    let problems = check::check_text(root, &spec_path, &edited);
    assert_eq!(problems[0].line, Some(5));
    assert_eq!(problems[0].message, "risk-tier \"extreme\" is not one of low, medium, high");
}

#[test]
fn a_checked_text_sees_the_rest_of_its_folder_on_disk() {
    // spec text with clarifications: 2 while only clarifications-01.md exists on disk
    // → "clarifications is 2, but the last round is 01"
}

// crates/core/tests/files.rs
#[test]
fn setting_a_field_keeps_its_comment() {
    let text = "---\ndiscovery: high # low, medium, or high\n---\n";
    assert_eq!(frontmatter::set(text, "discovery", "low"), "---\ndiscovery: low # low, medium, or high\n---\n");
}

#[test]
fn setting_a_field_keeps_crlf_line_endings() {
    assert_eq!(frontmatter::set("---\r\nstatus: a\r\n---\r\n", "status", "b"), "---\r\nstatus: b\r\n---\r\n");
}

// crates/cli/tests/draft.rs
#[test]
fn candidates_of_the_blocked_section_are_spaced() {
    // an unlinked line under ## Blocked; `ura draft` without text lists "Blocked  <text>"
}
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test fields --test check --test files`
- Expected: FAIL, `cannot find function `fields`in module`check``

- [x] **Step 3: Implement `field_list`, `fields`, `check_text`, and the comment-keeping `set`**

`fields` derives the kind as `check` does (`kind_of`, with `any_folder: true`), and builds each
field from `values::fields(kind)` (required, then optional), `allowed(kind, key)` for `Choice`,
`Integer` for `revision`, `clarifications`, `spec-revision`, `Boolean` for `plan-review` (values
`true` and `false`), `Date` for `finished`, `Text` otherwise. `action` comes from the skill's status
table: `answered` on a round is `Submit`; `approved` and `changes-requested` on a spec, plan, or
assessment are `Approve` and `RequestChanges`. `check_text` reads the folder's texts like
`check_folder_files`, replaces the file's entry with `text`, and returns that file's problems. `set`
keeps everything from the first ` #` after the value on the replaced line. `draft::listed` pads the
sections to the longest one listed plus two spaces
([R1](rulings.md#r1-candidates-are-padded-to-the-longest-section-listed)).

- [x] **Step 4: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates/core crates/cli
git commit -m "feat(nvim-plugin): fields of a file, and a check of a text"
```

## Task 2: `ura lsp` with diagnostics

**Files:**

- Create: `crates/lsp/Cargo.toml` (`uraeda-lsp`; `lsp-server = "0.10.0"`, `lsp-types = "0.97.0"`,
  `crossbeam-channel` (the channel `lsp-server` already uses, for the server's sender), `serde`,
  `serde_json`, `uraeda-core`; dev: `tempfile`), `crates/lsp/src/lib.rs`, `crates/lsp/src/server.rs`
  (the loop and dispatch), `crates/lsp/src/documents.rs`, `crates/lsp/src/diagnostics.rs`
- Modify: `Cargo.toml` (workspace dependencies), `crates/cli/Cargo.toml`, `crates/cli/src/main.rs`
  (`Lsp` subcommand), `skills/uraeda/SKILL.md` (the CLI table: a row `ura lsp` | "Serves workflow
  files to editors: diagnostics, completion, outline, actions")
- Test: `crates/lsp/tests/common/mod.rs` (`Session`), `crates/lsp/tests/diagnostics.rs`,
  `crates/cli/tests/lsp.rs`

**Interfaces:**

- Consumes: `check::check_text` (task 1).
- Produces:
  - `uraeda_lsp::run(connection: lsp_server::Connection) -> Result<(), Box<dyn std::error::Error + Send + Sync>>`
    and `uraeda_lsp::stdio()`, called by `ura lsp`; `uraeda_lsp::file_uri(path: &Path) -> Uri`, the
    `file:` URI of a path, for tests.
  - `server.rs` routes each request by method to its capability's module through
    `handle::<R>(params, |params| ...)`, and each notification through `notify::<N>`; an unknown
    method answers `MethodNotFound`, `method not found: <method>`.
  - `Documents` in `documents.rs`: `open(uri, text)`, `change(uri, text)`, `close(uri)`,
    `text(uri) -> Option<&str>`, `path(uri) -> Option<PathBuf>`, and the server's `root: PathBuf`,
    from `initialize`'s first workspace folder, else `rootUri`.
  - Capabilities: full text sync with open, close, and save.
  - Test helper `Session` in `crates/lsp/tests/common/mod.rs`:
    `Session::start(root: &Path) -> Session` (in-memory connection, server thread, `initialize`
    done), `open(path, text)`, `change(path, text)`, `save(path)`, `close(path)`,
    `request<R: lsp_types::request::Request>(params) -> R::Result`,
    `raw(method, params) -> Result<Value, ResponseError>`,
    `command(name, args) -> Result<Value, ResponseError>`, `diagnostics(path) -> Vec<Diagnostic>`
    (waits up to 2 s for the next publish), `notifications(method) -> Vec<Value>`; the server's own
    requests are answered with `null`. `TestRepo` and `texts` through `#[path]`, as the CLI's tests
    do, and `feature_with_spec() -> (TestRepo, PathBuf, String)`, a repository holding the example
    project's `specs/`, with `FEATURE`, `example()`, and `write_example(repo)`
    ([R3](rulings.md#r3-the-servers-tests-use-the-example-project)).

- [x] **Step 1: Write the failing tests, and `Session`**

```rust
// crates/lsp/tests/diagnostics.rs
#[test]
fn an_unsaved_change_shows_its_problem() {          // US1.1
    let (repo, path, spec_text) = feature_with_spec(); // the example's spec, risk-tier: high
    let mut session = Session::start(repo.path());
    session.open(&path, &spec_text);
    session.change(&path, &spec_text.replace("risk-tier: high", "risk-tier: extreme"));
    let diagnostics = session.diagnostics(&path);
    assert_eq!(diagnostics[0].range.start.line, 4);
    assert_eq!(diagnostics[0].message, "risk-tier \"extreme\" is not one of low, medium, high");
    assert_eq!(diagnostics[0].source.as_deref(), Some("uraeda"));
    assert_eq!(diagnostics[0].severity, Some(DiagnosticSeverity::ERROR));
}

#[test]
fn a_problem_without_a_line_is_on_line_1() { /* missing section → range.start.line == 0 */ }

#[test]
fn a_file_that_is_no_workflow_file_has_no_diagnostics() { /* specs/2026-10-13-x/mockups/notes.md → [] */ }

#[test]
fn a_worktree_is_its_own_root() {                    // review focus 1
    // feature branch in .worktrees/<branch>; Session::start(worktree); a problem in its spec shows,
    // with the file read from the worktree, not the main checkout
}

#[test]
fn diagnostics_arrive_within_300_ms() {              // SC-001
    // the example's spec.md (skills/uraeda/assets/example/...): time from change to publish < 300 ms
}

// crates/cli/tests/lsp.rs
#[test]
fn ura_lsp_answers_initialize_over_stdio() { /* spawn `ura lsp`, write an initialize request, read capabilities */ }
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-lsp`
- Expected: FAIL, `could not find `run`in`uraeda_lsp``

- [x] **Step 3: Implement the crate, the loop, documents, and diagnostics**

Publish diagnostics on open, change, and save, for files under `<root>/specs/`, with
`check_text(root, path, text)`; on close, publish an empty list. Each `Problem` covers its whole
line (0-based), line 1 when `None`. The loop answers `shutdown` and stops on `exit`.

- [x] **Step 4: Run all tests, and measure the release binary**

- Run:
  `cargo test --workspace --exclude uraeda-binding && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS
- Run: `cargo build --release -p uraeda-cli && ls -l target/release/ura`, on this commit and on its
  parent
- Expected: the growth, written in `rulings.md` as
  [R2](rulings.md#r2-ura-lsp-adds-420-kb-to-the-release-binary), for the pull request (SC-005)

- [x] **Step 5: Commit**

```bash
git add Cargo.toml Cargo.lock crates skills/uraeda/SKILL.md specs/2026-10-13-nvim-plugin/rulings.md
git commit -m "feat(nvim-plugin): ura lsp with diagnostics"
```

## Task 3: Completion, symbols, code actions, and `uraeda/fields`

**Files:**

- Create: `crates/lsp/src/completion.rs`, `crates/lsp/src/symbols.rs`, `crates/lsp/src/actions.rs`,
  `crates/lsp/src/requests.rs`
- Create: `crates/core/src/files/outline.rs`
  ([R4](rulings.md#r4-the-outline-and-the-fields-on-disk-come-from-the-core))
- Modify: `crates/lsp/src/server.rs`, `crates/lsp/src/documents.rs` (UTF-16 line helpers),
  `crates/core/src/check/mod.rs` (`fields_on_disk`),
  `crates/core/src/files/{mod,items,spec,review}.rs` (the heading parsers the outline shares)
- Test: `crates/lsp/tests/editing.rs`, `crates/core/tests/files.rs`

**Interfaces:**

- Consumes: `check::fields` (task 1), `Session` (task 2).
- Produces:
  - `uraeda_core::files::outline::outline(name: &str, text: &str) -> Vec<OutlineEntry>`: every
    heading in file order,
    `OutlineEntry { kind: OutlineKind, name, detail: Option<String>, level, line, end_line }`
    (1-based lines), `OutlineKind { Heading, Question, Story, Task, Comment }`; an item's `name` is
    its id (`Q1.A`, `US1`, `Task 3`, `C1`) and `detail` the rest of its heading.
  - `uraeda_core::check::fields_on_disk(root: &Path, path: &Path) -> Vec<Field>`: `fields` of the
    file as it is on disk.
  - `textDocument/completion` on a frontmatter line `key: ` returns the `Choice` values of `key`.
  - `textDocument/documentSymbol`: headings nested by level, with questions, stories, tasks, and
    comments as the symbols of their headings, kind `STRING` for questions and comments, `EVENT` for
    stories, `FUNCTION` for tasks, `NAMESPACE` for other headings
    ([R5](rulings.md#r5-an-items-symbol-is-named-by-its-id)).
  - `textDocument/codeAction` on a field's line: `Set <field> to <value>` for each value but the
    current one and those with an `action`, each a `refactor.rewrite` `WorkspaceEdit` replacing that
    line with the text `frontmatter::set` gives.
  - `uraeda/fields { uri }` → `Field[]` (task 1's type), from the open text, else from disk; `[]`
    outside `<root>/specs/`. Completion, symbols, and code actions also answer nothing there.

- [x] **Step 1: Write the failing tests**

```rust
#[test] fn risk_tier_completes_from_its_values() {}                 // US1.2: low, medium, high
#[test] fn a_round_lists_its_questions_as_symbols() {}              // US1.3: "Q1", "Q1.A", "Q2"
#[test] fn priorities_sections_are_symbols() {}                     // C1: Now, Next, Later, Blocked
#[test] fn a_field_line_offers_its_other_values_as_edits() {}       // US5.4: "Set risk-tier to low", "Set risk-tier to medium"
#[test] fn no_code_action_commits_or_writes_another_file() {}       // US5.4: every action has an edit on the open uri only, no command
#[test] fn fields_of_an_unsaved_text_come_from_the_text() {}        // US5.1: discovery edited to low in the buffer → value "low"
#[test] fn an_edit_keeps_the_comment_and_crlf() {}                  // review focus 5
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-lsp --test editing`
- Expected: FAIL, `method not found: textDocument/completion`

- [x] **Step 3: Implement completion, symbols, code actions, and `uraeda/fields`**

- [x] **Step 4: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates/core crates/lsp specs/2026-10-13-nvim-plugin
git commit -m "feat(nvim-plugin): completion, outline, and field edits in ura lsp"
```

## Task 4: The reads: items, comments, verdict, waiting, and priorities hints

**Files:**

- Modify: `crates/lsp/src/requests.rs`, `crates/lsp/src/server.rs`
- Create: `crates/lsp/src/hints.rs`
- Modify: `crates/core/src/actions/review.rs` (a public `subject(feature, file, verdict) -> String`
  extracted from the approve and request-changes commits, so the message shown is the one committed)
- Modify: `crates/core/src/actions/answer.rs` (public `subject(slug, round)` and `blank(text)`,
  shared with the submission), `crates/core/src/api.rs` (`waiting`, `priority_links`),
  `crates/core/src/workspace.rs` (`Workspace::linked_feature`, `linked_draft`),
  `crates/core/src/view.rs` (`WaitingFile`, `PriorityLink`, not exposed to the binding)
  ([R6](rulings.md#r6-the-waiting-files-and-the-priorities-links-come-from-the-core))
- Test: `crates/lsp/tests/reads.rs`

**Interfaces:**

- Consumes: `files::items::items`, `actions::review::subject`, `actions::answer::{subject, blank}`,
  `api::waiting`, `api::priority_links`, `Session`.
- Produces, with 1-based lines:
  - `uraeda/items { uri }` → `[{ kind: "question" | "comment", label, line, endLine }]`, in file
    order: questions of a round (`label` `Q1`, line of its heading), comments of the pending review
    of a spec, plan, or assessment (`label` `C1`, its lines; general comments left out).
  - `uraeda/comments { uri }` → `[{ number, line?, endLine?, text }]` of the pending review.
  - `uraeda/verdict { uri }` →
    `{ file, kind: "review" | "round", approve: string, requestChanges?: string, comments: number, riskTier?: string, planReview?: bool, blank: string[], waiting: bool }`;
    `approve` and `requestChanges` are commit subjects (`spec(nvim-plugin): approve`), and for a
    round `approve` is `discovery(nvim-plugin): answer round 01`; `blank` lists the questions that
    need an answer and have none.
  - `uraeda/waiting {}` → `[{ feature, file, path, line, text }]`: every file of every feature whose
    `status` is `awaiting-human`, `path` absolute in the checkout that has it, `text` the first line
    of its block.
  - `textDocument/inlayHint` on `PRIORITIES.md`: at the end of each entry's first line linked to a
    feature, `<step> · waits on <you|agent|nobody>`; linked to a draft, `draft`.
  - `uraeda/verdict` on a file other than a spec, plan, assessment, or round refuses
    `Only a spec, a plan, an assessment, or a round of questions gets a verdict.`, and outside
    `specs/` `This file is not a Uraeda workflow file.`, both with `data: { code: "refused" }`.

- [x] **Step 1: Write the failing tests**

```rust
#[test] fn a_round_lists_its_questions_in_order() {}       // US8.2: Q1 line 12, Q1.A, Q2
#[test] fn a_spec_lists_its_comments_in_order() {}         // US8.3: C1 line 12, C2 line 50
#[test] fn comments_come_with_their_lines_and_text() {}    // US9.1: { number: 1, line: 50, endLine: 52, text: "Rename this field" }
#[test] fn a_spec_verdict_names_its_commits() {}           // US6.1: approve "spec(nvim-plugin): approve", riskTier "high", comments 1
#[test] fn a_round_verdict_lists_its_blank_questions() {}  // US6.4: blank ["Q3", "Q5"]
#[test] fn waiting_lists_files_of_every_checkout() {}      // US8.1: codex-runtime · clarifications-01.md · "7 questions, about 25 minutes."
#[test] fn priorities_entries_hint_their_step() {}         // C1: "discovery · waits on agent", "draft"
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-lsp --test reads`
- Expected: FAIL, `method not found: uraeda/items`

- [x] **Step 3: Implement the reads and the hints**

- [x] **Step 4: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(nvim-plugin): reads and priorities hints in ura lsp"
```

## Task 5: The commands

**Files:**

- Create: `crates/lsp/src/commands.rs`
- Modify: `crates/lsp/src/server.rs` (`executeCommand` capability, the worker),
  `crates/core/src/api.rs` (a public `default_root(repo) -> Result<PathBuf>`: the checkout holding
  the default branch, as `create_draft` reaches it)
- Test: `crates/lsp/tests/commands.rs`

**Interfaces:**

- Consumes:
  `api::{create_draft, start_feature, add_comment, edit_comment, remove_comment, approve, request_changes, submit_answers, commit_text, commit_priorities}`.
- Produces the commands of the [spec's table](spec.md#data), each answering `{ opened?, written }`:
  - `uraeda.draft { uri, line }`: the entry whose lines hold `line`; its id from `Section::id()` and
    position; `previous` the hash of the open text. An entry already linked to a draft answers
    `{ opened: <draft>, written: [] }`. A line in no entry refuses
    `This line is not a priorities entry.`
  - `uraeda.start { uri }`: refuses `Only a draft or a backlog file can be started.` outside
    `specs/drafts/` and `specs/backlog/`; `opened` the new `proposal.md` in its worktree; reports
    progress `Starting <title>…`.
  - `uraeda.comment { uri, line?, endLine?, text }`: refuses `<name> is not waiting for a review.`
    unless `status: awaiting-human`, and
    `<name> differs from its last commit: comments point at the committed version. Commit or undo the change first.`
    when the open text differs from the file at the branch's tip.
  - `uraeda.editComment { uri, number, text }`: removes it when `text` is blank.
  - `uraeda.approve`, `uraeda.requestChanges`: refuse
    `Requesting changes needs at least one comment.` on a review without comments.
  - `uraeda.submit { uri }`, `uraeda.commit { uri }`: commit refuses
    `Only drafts, backlog files, proposals, and PRIORITIES.md are committed from the editor.`
  - Every command runs on a worker thread, one at a time, between `$/progress` `begin` and `end`;
    the loop keeps answering meanwhile ([R9](rulings.md#r9-progress-results-and-unknown-commands)).
  - The review refusals are checked by the server before the core, with the spec's texts
    ([R7](rulings.md#r7-the-review-refusals-of-the-spec-are-the-servers-checked-before-the-core)); a
    hook's output comes in `data.output`.

- [x] **Step 1: Write the failing tests**

```rust
#[test] fn a_line_becomes_a_draft() {}                        // US2.1: specs/drafts/codex-runtime.md, link, nothing committed
#[test] fn a_linked_line_opens_its_draft() {}                 // US2.2
#[test] fn the_second_line_of_a_wrapped_entry_drafts_it() {}  // review focus 2
#[test] fn a_nested_line_is_not_an_entry() {}                 // review focus 2
#[test] fn priorities_changed_on_disk_refuse_the_draft() {}   // edge: "PRIORITIES.md changed on disk. Nothing was drafted."
#[test] fn a_draft_starts_a_feature() {}                      // US3.1: URA_TODAY=2026-10-14 (R8); two commits; opened proposal; hook ran twice
#[test] fn a_spec_cannot_be_started() {}                      // US3.2
#[test] fn a_comment_quotes_its_lines() {}                    // US4.1
#[test] fn a_comment_is_edited_then_removed() {}              // US4.2, US4.3
#[test] fn an_uncommitted_spec_refuses_comments() {}          // US4.4
#[test] fn an_approved_spec_refuses_comments() {}             // US4.5
#[test] fn approving_records_the_block_and_commits() {}       // US6.1: tier medium → plan-review false
#[test] fn changes_need_a_comment() {}                        // US6.2
#[test] fn a_round_is_submitted() {}                          // US6.3
#[test] fn drafts_proposals_and_priorities_are_committed() {} // US7.1, US7.2
#[test] fn a_spec_is_not_committed() {}                       // US7.3
#[test] fn a_failing_hook_reports_its_output() {}             // edge: data.code "hook", files kept
#[test] fn requests_are_answered_while_a_command_runs() {}    // edge: a 1 s hook; uraeda/fields answers before the command
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-lsp --test commands`
- Expected: FAIL, `method not found: workspace/executeCommand`
  ([R9](rulings.md#r9-progress-results-and-unknown-commands))

- [x] **Step 3: Implement the commands and the worker**

- [x] **Step 4: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(nvim-plugin): ura lsp commands"
```

## Task 6: The plugin's skeleton, its tests, and the toolchain

**Files:**

- Create: `editors/nvim/plugin/uraeda.lua`, `editors/nvim/lsp/uraeda.lua`,
  `editors/nvim/lua/uraeda/init.lua` (config: defaults, `vim.validate`),
  `editors/nvim/lua/uraeda/client.lua`, `editors/nvim/lua/uraeda/health.lua`,
  `editors/nvim/stylua.toml` (2 spaces, 100 columns), `editors/nvim/tests/minimal_init.lua`,
  `editors/nvim/tests/helpers.lua`, `editors/nvim/tests/test_attach.lua`,
  `editors/nvim/tests/test_health.lua`, `editors/nvim/tests/test_client.lua`
  ([R10](rulings.md#r10-the-plugins-test-harness-and-health))
- Modify: `flake.nix` (`neovim`, `stylua`, `MINI_TEST = "${pkgs.vimPlugins.mini-test}"`),
  `package.json` (a `test:nvim` script, and `ready` running `stylua --check editors/nvim` and it),
  `vite.config.ts` (`staged`: `"*.lua": "stylua"`; `!(*.{rs,lua})` for the rest)

**Interfaces:**

- Produces:
  - `require("uraeda").config() -> table`: `vim.g.uraeda` merged over
    `{ prefix = "<leader>a", lsp = true, cmd = { "ura", "lsp" }, inline_comments = true }`.
  - `lsp/uraeda.lua`: `filetypes = { "markdown" }`, `root_dir(bufnr, on_dir)` calling `on_dir` with
    the folder above the nearest `specs/` holding `PRIORITIES.md`, only for buffers under it.
  - `client.lua`: `client.get(bufnr) -> vim.lsp.Client?`;
    `client.request(bufnr, method, params, cb)`; `client.command(bufnr, name, args, opts, cb)` that
    runs `:update` when `opts.save`, shows a `vim.notify` replaced in place (`id = "uraeda"`) with
    the server's progress, then reloads `written` with `:checktime`, edits `opened`, and calls
    `cb(result)`; errors go to `vim.notify(message, ERROR, { title = "Uraeda" })`, a
    `MethodNotFound` or unknown command as `ura is older than the plugin: run ura upgrade.`, no
    client as `This file is not a Uraeda workflow file.`
  - `health.lua`: Neovim 0.11, `ura` and `git` on the path, `ura --version` shown, and
    `<cmd> --help` exiting 0, else `ura is older than the plugin: run ura upgrade.` with its stderr.
  - `client.command` sends its own `workDoneToken` (`uraeda/nvim/<n>`) and listens to `LspProgress`
    for it; `cb` and `client.request`'s `cb(result)` run on success only. `client.request`'s
    `params` default to `{ uri }` of the buffer, as `client.command`'s `args.uri`.
  - Test helpers, loaded with `dofile("tests/helpers.lua")` from `editors/nvim`:
    `helpers.new_child()` (a mini.test child; `child.setup(config?)` restarts it with the plugin,
    `URAEDA_TEST` set, and `vim.g.uraeda = config` over a `cmd` pointed at `target/debug/ura`),
    `helpers.repo(files: table<string,string>, branches?: table<string, table<string,string>>)` (a
    temporary git repository on `main` with a counting pre-commit hook, each branch committed from
    `main` and checked out in `.worktrees/<branch>`, returning its real path),
    `helpers.edit(child, path)`, `helpers.wait_client(child, timeout?) -> boolean`,
    `helpers.git(path, args) -> string`, `helpers.write(path, text)`,
    `helpers.set_hook(repo, script)`, `helpers.hook_runs(repo) -> integer`, `helpers.example()` (the
    example project's `specs/` as `files`), `helpers.root`, `helpers.ura`.

- [x] **Step 1: Write the failing tests, and the helpers they use**

```lua
-- editors/nvim/tests/test_attach.lua
T["attaches to workflow files only"] = function()          -- US1.4
  local repo = helpers.repo({ ["specs/PRIORITIES.md"] = "# Priorities\n\n## Now\n", ["README.md"] = "# R\n" })
  helpers.edit(child, repo .. "/README.md")
  eq(child.lua_get("#vim.lsp.get_clients({ bufnr = 0, name = 'uraeda' })"), 0)
  helpers.edit(child, repo .. "/specs/PRIORITIES.md")
  eq(helpers.wait_client(child), true)
end
T["one client per checkout"] = function() end              -- US1.5: main and .worktrees/<branch>, two clients, two roots
T["an unsaved change shows its diagnostic"] = function() end -- US1.1, through Neovim
T["the server is not enabled when lsp is false"] = function() end

-- editors/nvim/tests/test_health.lua
T["reports a missing ura"] = function() end               -- "ura not found on PATH"
T["reports an ura without lsp"] = function() end          -- cmd pointed at a script exiting 2
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo build -q -p uraeda-cli && vp run test:nvim`
- Expected: FAIL, no `uraeda` client attaches (`Left: false`),
  `No healthcheck found for "uraeda" plugin.`, and `module 'uraeda.client' not found`

- [x] **Step 3: Implement the plugin's entry, config, client, and health**

`plugin/uraeda.lua` returns early on Neovim older than 0.11, guards `vim.g.loaded_uraeda`, and calls
`vim.lsp.enable("uraeda")` when `config().lsp`, with
`vim.lsp.config("uraeda", { cmd = config().cmd })`.

- [x] **Step 4: Run all checks**

- Run: `stylua --check editors/nvim && vp run test:nvim && vp run ready`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add editors flake.nix flake.lock package.json vite.config.ts
git commit -m "feat(nvim-plugin): the Neovim plugin's skeleton and its checks"
```

## Task 7: Draft, start, commit, the `:Uraeda` command, and the keys

**Files:**

- Create: `editors/nvim/lua/uraeda/actions.lua`, `editors/nvim/lua/uraeda/keys.lua`,
  `editors/nvim/lua/uraeda/command.lua`
- Modify: `editors/nvim/plugin/uraeda.lua` (`:Uraeda`, `<Plug>` mappings, `LspAttach` for keys)
- Test: `editors/nvim/tests/test_actions.lua`, `editors/nvim/tests/test_keys.lua`

**Interfaces:**

- Consumes: `client.command` (task 6).
- Produces:
  - `actions.draft()`, `actions.start()`, `actions.commit()`, `actions.get(name)`, and the registry
    `actions.list: { name, desc, fn, modes, buffer_local, key? }[]` that later tasks append to in
    `actions.lua`: `comment`, `field`, `verdict`, `waiting`, `comments`, `next`, `prev`. `key` is
    the key under the prefix; `fn(opts?)` gets `:Uraeda`'s command opts (`range`, `line1`, `line2`),
    and nothing from a key or a `<Plug>` mapping
    ([R11](rulings.md#r11-an-actions-key-lives-in-its-registry-entry)).
  - `:Uraeda <name>` (`command.lua`, with a range) with completion from `actions.list`;
    `<Plug>(uraeda-<name>)` for each, in its `modes`; keys from `keys.attach(bufnr)` on `LspAttach`
    of a `uraeda` client, the actions without `buffer_local`, like `w`, set once globally on the
    first attach.

- [x] **Step 1: Write the failing tests**

```lua
T["a line becomes a draft"] = function() end         -- US2.1: draft opened, link written, buffer reloaded, no commit
T["a linked line opens its draft"] = function() end  -- US2.2
T["an unsaved priorities file is saved first"] = function() end -- US2.3
T["a draft starts a feature"] = function() end       -- US3.1: URA_TODAY, proposal in the current window, draft buffer wiped, two commits
T["a spec cannot be started"] = function() end       -- US3.2: notification text
T["a draft is committed"] = function() end           -- US7.1, US7.3
T["a buffer closed while a command runs"] = function() end -- review focus 4: no error
T["every action has a key, a subcommand, and a Plug mapping"] = function() end -- SC-002
T["no key collides under <leader>a"] = function() end -- with LazyVim's AI keys a b c C d f r s mapped first
T["prefix false sets no keys"] = function() end
T["keys use the configured prefix"] = function() end  -- prefix "<leader>au"
T["keys are set only in workflow files"] = function() end
```

- [x] **Step 2: Run them to check they fail**

- Run: `vp run test:nvim`
- Expected: FAIL, `module 'uraeda.actions' not found`

- [x] **Step 3: Implement the actions, the command, and the keys**

- [x] **Step 4: Run all checks**

- Run: `stylua --check editors/nvim && vp run test:nvim`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add editors/nvim
git commit -m "feat(nvim-plugin): draft, start, and commit from Neovim"
```

## Task 8: The field and value pickers

**Files:**

- Create: `editors/nvim/lua/uraeda/pickers.lua`
- Modify: `editors/nvim/lua/uraeda/actions.lua` (`field`)
- Test: `editors/nvim/tests/test_fields.lua`

**Interfaces:**

- Consumes: `uraeda/fields` (task 3), `actions.list` (task 7); `verdict.open(bufnr, choice)` from
  task 10, called through `require` at selection time, so this task only stubs it in its test.
- Produces: `pickers.field(bufnr)`: `vim.ui.select` over fields (kind `uraeda_field`, items shown
  `name  value`), then over values (kind `uraeda_value`, the current one with `(current)`, an
  action's value with `…` and `commits`); a plain value applies the code action's edit
  (`vim.lsp.util.apply_workspace_edit`), a number or text opens `vim.ui.input` with the current
  value, an action's value calls `require("uraeda.verdict").open(bufnr, action)`.

- [ ] **Step 1: Write the failing tests, stubbing `vim.ui.select` and `vim.ui.input` in the child**

```lua
T["a value replaces its line and keeps the comment"] = function() end -- US5.1, then `u` restores high
T["a number is typed"] = function() end                                -- US5.2: revision 2
T["a status that commits opens the verdict"] = function() end          -- US5.3: items, then verdict.open called with "approve"
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp run test:nvim`
- Expected: FAIL, `module 'uraeda.pickers' not found`

- [ ] **Step 3: Implement the pickers**

- [ ] **Step 4: Run all checks**

- Run: `stylua --check editors/nvim && vp run test:nvim`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add editors/nvim
git commit -m "feat(nvim-plugin): pick frontmatter values"
```

## Task 9: The comment window

**Files:**

- Create: `editors/nvim/lua/uraeda/comment.lua`
- Modify: `editors/nvim/lua/uraeda/actions.lua` (`comment`)
- Test: `editors/nvim/tests/test_comment.lua`, screenshots in `editors/nvim/tests/screenshots/`

**Interfaces:**

- Consumes: `uraeda/comments` (task 4), `uraeda.comment` and `uraeda.editComment` (task 5).
- Produces: `comment.open(bufnr, first, last)`: a float under the last line, titled
  `Comment · lines 50–52` (or `line 50`), footer `:w save · q cancel`, a scratch `markdown` buffer
  prefilled with the comment on those lines if any; `:w` and `<C-s>` send it, `q` and `<Esc>` in
  normal mode close it. After a save, `User UraedaComment` fires.

- [ ] **Step 1: Write the failing tests**

```lua
T["a selection gets a comment"] = function() end         -- US4.1: V on 50–52, type, :w → review file content
T["a commented line opens its comment"] = function() end -- US4.2
T["an emptied comment is removed"] = function() end      -- US4.3
T["an uncommitted spec refuses"] = function() end        -- US4.4: no window, notification text
T["a refused text keeps the window"] = function() end    -- review focus 3: "# heading" → error, window and text kept
T["the window looks right"] = function() end             -- screenshot
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp run test:nvim`
- Expected: FAIL, `module 'uraeda.comment' not found`

- [ ] **Step 3: Implement the comment window**

- [ ] **Step 4: Run all checks**

- Run: `stylua --check editors/nvim && vp run test:nvim`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add editors/nvim
git commit -m "feat(nvim-plugin): comment on lines of a spec"
```

## Task 10: The verdict window

**Files:**

- Create: `editors/nvim/lua/uraeda/verdict.lua`
- Modify: `editors/nvim/lua/uraeda/actions.lua` (`verdict`)
- Test: `editors/nvim/tests/test_verdict.lua`, screenshots

**Interfaces:**

- Consumes: `uraeda/verdict` (task 4), `uraeda.approve`, `uraeda.requestChanges`, `uraeda.submit`
  (task 5).
- Produces: `verdict.open(bufnr, action?: "approve" | "requestChanges" | "submit")`: for a review
  without `action`, `vim.ui.select` over `Approve` and `Request changes` (kind `uraeda_verdict`);
  `Request changes` with `comments == 0` refuses with the spec's text. The float has a border in
  `UraedaVerdictBorder`, the title `Approve · <path>`, `Request changes · <path>`, or
  `Submit answers · <file>`, and real lines: `Commits  <subject>`, `Comments <n>…`, for a spec
  approval `Risk tier    < medium >` and `Plan review  < false >`, a separator, then the summary.
  `<Tab>` on the risk tier's line cycles `low`, `medium`, `high`, and sets plan review to the tier's
  default (`true` for `high`); `<Tab>` on the plan review's line toggles it; `<C-s>` runs the
  command with the summary (the lines after the separator) and the values held in Lua; `q` closes.
  With `blank` not empty, the window shows `Q3 and Q5 have no answer.` and `<C-s>` does nothing.

- [ ] **Step 1: Write the failing tests**

```lua
T["approving a spec with a new tier"] = function() end -- US6.1: Tab to medium, plan review false, C-s → commit and status
T["changes without comments refuse"] = function() end  -- US6.2
T["a round is submitted"] = function() end             -- US6.3
T["blank questions block the submit"] = function() end -- US6.4
T["the window looks right"] = function() end           -- screenshots: approve, submit with blanks
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp run test:nvim`
- Expected: FAIL, `module 'uraeda.verdict' not found`

- [ ] **Step 3: Implement the verdict window**

- [ ] **Step 4: Run all checks**

- Run: `stylua --check editors/nvim && vp run test:nvim`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add editors/nvim
git commit -m "feat(nvim-plugin): approve, request changes, and submit answers"
```

## Task 11: Waiting on me, and jumps

**Files:**

- Modify: `editors/nvim/lua/uraeda/pickers.lua` (`waiting`), `editors/nvim/lua/uraeda/actions.lua`
  (`waiting`, `next`, `prev`)
- Create: `editors/nvim/lua/uraeda/marks.lua` (jumps now, inline comments in task 12)
- Test: `editors/nvim/tests/test_waiting.lua`, `editors/nvim/tests/test_jumps.lua`

**Interfaces:**

- Consumes: `uraeda/waiting`, `uraeda/items` (task 4).
- Produces: `pickers.waiting()`: from any buffer, using any running `uraeda` client, else starting
  one on the current folder's root; with snacks,
  `Snacks.picker.pick({ title = "Uraeda · waiting on you", items, format, preview = "file", confirm = "jump" })`,
  items `<slug> · <file> · <text>`; without, `vim.ui.select` with the same text.
  `marks.jump(bufnr, direction: 1 | -1)` to the next or previous item's line, no wrap.

- [ ] **Step 1: Write the failing tests**

```lua
T["waiting lists a round of another worktree"] = function() end -- US8.1, with vim.ui.select stubbed
T["waiting uses snacks when present"] = function() end           -- a stub Snacks.picker.pick records its items
T["]u goes from question to question"] = function() end          -- US8.2
T["]u goes from comment to comment"] = function() end            -- US8.3
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp run test:nvim`
- Expected: FAIL, `module 'uraeda.marks' not found`

- [ ] **Step 3: Implement the waiting picker and the jumps**

- [ ] **Step 4: Run all checks**

- Run: `stylua --check editors/nvim && vp run test:nvim`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add editors/nvim
git commit -m "feat(nvim-plugin): files waiting on you, and jumps between items"
```

## Task 12: Inline comments and priorities hints

**Files:**

- Modify: `editors/nvim/lua/uraeda/marks.lua` (`show`, `toggle`),
  `editors/nvim/lua/uraeda/actions.lua` (`comments`), `editors/nvim/plugin/uraeda.lua` (highlight
  groups; on `LspAttach`, inlay hints enabled for the buffer, inline comments drawn; refreshed on
  `User UraedaComment` and `BufWritePost` of a review file)
- Test: `editors/nvim/tests/test_inline.lua`, screenshots

**Interfaces:**

- Consumes: `uraeda/comments` (task 4), `textDocument/inlayHint` (task 4).
- Produces: `marks.show(bufnr)`: virtual lines in the `uraeda` namespace below each comment's
  `endLine`, `▎ C1  <first line>` then `▎     <next lines>`, in `UraedaComment`;
  `marks.toggle(bufnr)`; nothing drawn when `config().inline_comments` is false.

- [ ] **Step 1: Write the failing tests**

```lua
T["comments show under their lines"] = function() end   -- US9.1
T["the toggle hides and shows them"] = function() end   -- US9.2
T["a new comment shows at once"] = function() end       -- US9.3
T["priorities show their hints"] = function() end       -- C1: vim.lsp.inlay_hint.get on PRIORITIES.md
T["the inline comments look right"] = function() end    -- screenshot
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp run test:nvim`
- Expected: FAIL, `attempt to call field 'show' (a nil value)`

- [ ] **Step 3: Implement inline comments and enable hints**

- [ ] **Step 4: Run all checks**

- Run: `stylua --check editors/nvim && vp run test:nvim`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add editors/nvim
git commit -m "feat(nvim-plugin): inline comments and priorities hints"
```

## Task 13: Documentation

**Files:**

- Create: `editors/nvim/doc/uraeda.txt`, `editors/nvim/README.md`
- Modify: [`README.md`](/README.md) (an "Editors" section linking the plugin),
  [`AGENTS.md`](/AGENTS.md) (`editors/` and `crates/lsp/` in the repository layout)
- Test: `editors/nvim/tests/test_doc.lua`

**Interfaces:**

- Consumes: every action of `actions.list`, the options of `config()`.

- [ ] **Step 1: Write the failing test**

```lua
T["the help names every subcommand, Plug mapping, and option"] = function() end -- reads doc/uraeda.txt, checks each name of actions.list and each key of config()
T[":help uraeda opens"] = function() end
```

- [ ] **Step 2: Run it to check it fails**

- Run: `vp run test:nvim`
- Expected: FAIL, `E149: Sorry, no help for uraeda`

- [ ] **Step 3: Write the vimdoc, the plugin's README with the lazy.nvim spec
      `{ dir = "~/Development/ai/uraeda/editors/nvim", name = "uraeda.nvim" }`, and the repository's
      README and AGENTS.md lines**

- [ ] **Step 4: Run all checks**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add editors/nvim README.md AGENTS.md
git commit -m "docs(nvim-plugin): the Neovim plugin's help and README"
```
