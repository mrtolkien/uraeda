---
status: auto-approved
spec-revision: 2
---

# Plan: Web UI for the workflow files

**Goal:** a web UI, served by `vp dev` at the repository's root and reached from a phone over
Tailscale, that shows every feature and file with its structure and performs every human step,
without ever switching the human's checkout.

**Architecture:** the core grows a document tree for every workflow file, structured items on top of
it, committing actions that write through worktrees, a priorities editor, and a file watcher. The
binding exposes them as async functions. The server turns them into fate sources, mutations, and
live updates; the UI draws the core's blocks with Astryx, following the reading layout. See the
[spec's design](spec.md#design).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

1. **A worktree folder left behind after `git worktree remove --force` or a deleted branch**: a
   stale `.worktrees/<branch>/` registered in git but missing on disk is pruned and created again,
   not refused. Task 3.
2. **An answer comment with a line break**: it is written on the lines after `**Answer:**`, and read
   back as the same comment, letters intact. Task 2.
3. **A priority line whose text has a markdown link and a nested list**: moving or editing it keeps
   the link's target and the nested lines byte for byte. Task 5.
4. **A spec with no user stories, or a story without scenarios**: the review page still renders
   every block, and a block is still selectable. Tasks 2 and 12.
5. **Two quick saves of the same answer, the second before the first returns**: the second carries
   the first's text as `previous`, so it is not refused as changed elsewhere. Task 11.

## Global constraints

From [stack](../decisions/stack.md), word for word:

- Workflow logic, parsing, validation, and workflow states MUST live in the Rust core,
  [`crates/core`](/crates/core/).
- TypeScript code MUST reach the core only through the binding,
  [`packages/binding`](/packages/binding/), and MUST NOT reimplement its parsing, validation, or
  states.
- The TypeScript types of core data MUST come from the declarations napi-rs generates for the
  binding. They MUST NOT be redeclared by hand in TypeScript.
- The web UI MUST use React and Astryx components, live in [`packages/web`](/packages/web/), and get
  its data only from the server, through fate.
- The web UI MUST draw workflow files from the document tree the core sends, and MUST NOT parse
  markdown, with a library or by hand.
- The server MUST listen on 127.0.0.1 only. It MUST reject requests whose `Host` is not `127.0.0.1`
  or `localhost` on its port, or a host name listed in `URAEDA_ALLOWED_HOSTS`, and requests whose
  `Origin`, when present, is not the server's own, `https://` and a listed host name, or an allowed
  origin.

From [git](../decisions/git.md), word for word:

- Tools MUST NOT bypass the user's hooks: no `--no-verify`, and no commit written by gix or with
  plumbing to skip them.
- Tools MUST NOT switch the user's checkout to another branch, unless the human asks for it with a
  flag. To write on a branch, they MUST use the checkout or worktree that has it, or else create a
  worktree for it at `.worktrees/<branch>/`, at the root of the main checkout.
- `ura start` MUST create the new feature's branch in a worktree at `.worktrees/<folder>/` by
  default.
- When `core.hooksPath` is a relative path, commits made by tools in a linked worktree MUST resolve
  it against the main checkout, so the same hooks run.
- Tools MUST keep `.worktrees/` out of the user's `git status`, through the repository's
  `.git/info/exclude`, without editing a tracked file.
- In Rust, every git access MUST go through one module of the core, so no other code uses gix or
  builds `git` command lines.

From [CLI](../decisions/cli.md): `ura status --json` stays at version 1; flags, not prompts.

From the spec, exact texts and values:

- Answers: `A`, `B and C`, `A, B and C`, then `: <comment>`; a comment alone as written; `-` for
  "Does not apply".
- "2 questions left: Q7, Q1.B"; "Add a comment first"; "saved".
- "The spec changed since your comments: your 1 pending comment is on the previous version. Adding a
  comment replaces it."
- "proposal.md changed on disk since you opened it. Your text was not saved.", "Copy my text", "Load
  the new version".
- "The pre-commit hook refused the commit. Your answers are saved, not committed.", "Try again".
- "cannot create the worktree: .worktrees/<branch> exists".
- "No specs/ folder in <path>. Set Uraeda up with ura init."
- "uraeda-server: <path> is not a git repository"; "the native binding is not built; run vp run
  ready"; "Could not reach the Uraeda server."; "Not saved: <message>".
- "PRIORITIES.md changed on disk. Your change was not applied."; "Your 2 priority changes are
  committed with it."; "Added to Next, not committed"; "1 change to commit".
- Commits: `chore: draft <title>`, `chore(<slug>): proposal`, `chore(<slug>): edit the proposal`,
  `chore: update the priorities`; the existing `discovery(<slug>): answer round NN`,
  `<kind>(<slug>): approve`, `<kind>(<slug>): request changes`.
- `URAEDA_ALLOWED_HOSTS`, `URAEDA_PORT` (default `4310`), `URAEDA_REPO`; 200 ms watcher quiet time;
  `localStorage` key `uraeda.theme`; 44 px touch targets; 402 × 874 viewport.

## Code read

- [`crates/core/src/git.rs`](/crates/core/src/git.rs): the one git module. gix reads (`branches`,
  `read_file`, `worktrees`, `changed_files`, `staged_files`); `git` writes through `run`, which
  keeps only the first line of stderr; `commit` runs `git add --all -- <paths>` then `git commit`;
  `switch`, `switch_new`.
- [`crates/core/src/actions/place.rs`](/crates/core/src/actions/place.rs): `reach` returns this
  checkout, a worktree with the branch, or switches this checkout when clean; `switch_back` undoes
  it. Every action and CLI command goes through it.
- [`crates/core/src/actions/`](/crates/core/src/actions/): `answer::write` and `answer::submit`,
  `review::comment`, `approve`, `request_changes`, `draft::run`, `start::run`; each returns a
  `Change` that the CLI commits in [`crates/cli/src/output.rs`](/crates/cli/src/output.rs)
  (`output::commit`).
- [`crates/core/src/files/`](/crates/core/src/files/): `markdown.rs` (headings, links, the review
  callout, `record_block`, `slug`), `clarifications.rs` (questions with option letters, answers,
  `set_answer`), `review.rs` (parse and render), `plan.rs` (tasks and counts), `priorities.rs`
  (entries with `line`, `text_end`, `end`, markers; `link`, `move_to_now`, `add_to_now`),
  `frontmatter.rs`. Every edit goes through `with_unix_newlines`.
- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs): reads features from the working
  tree and branch tips, skips folders merged on the default branch (`merged`), priorities from the
  default branch.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): `StepName`, serialized kebab-case.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): two temporary sync functions; types
  derive `napi(object)` behind the core's `napi` feature
  ([`temporary_status.rs`](/crates/core/src/temporary_status.rs)).
- [`packages/server/src/`](/packages/server/src/): the Hono app, the guard, CLI options, the
  temporary fate source with a hand-built registry cast to `SourceRegistry`.
- [`packages/web/src/`](/packages/web/src/): the temporary status page; tests render `App` on
  happy-dom with the server's app called in process (`__tests__/helpers.tsx`).
- Tests: Rust integration tests in `crates/*/tests/`, on `TestRepo`
  ([`repo.rs`](/crates/core/tests/common/repo.rs)), whose hook counts runs and whose
  `core.hooksPath` is the relative `.git/hooks`; CLI tests run the built `ura` with
  `URA_TODAY=2026-10-11`. TypeScript tests run with `vp test`, one project per package.
- Validation: `vp run ready` (cargo fmt, clippy `-D warnings`, cargo test, `ura check` on `specs`
  and the example, the binding build, `vp check`, `vp test`, the web build).
- fate 1.7.7: `createFateServer({ roots, queries, mutations, sources, live })`; mutations
  `{ input?, resolve({ ctx, input, select }), type }`; `createLiveEventBus().update(type, id)`;
  `GET`/`POST /fate/live` through the same handler.
- Vite+ reads `defaultPackage` statically from the root config: `vp dev` at the root runs
  `packages/web`'s config.
- Astryx 0.6.7: `Theme` has `mode` (`system`, `light`, `dark`); components listed in the spec exist
  under `@astryxdesign/core/<Name>`.

## Constitution check

| Principle                        | Complies | Notes                                                                      |
| -------------------------------- | -------- | -------------------------------------------------------------------------- |
| I. Humans stay in control        | yes      | Every write comes from a human's tap; the plan's review was waived in chat |
| II. Git and plain text first     | yes      | State stays in the files and git; worktrees are plain git                  |
| III. Asynchronous by default     | yes      | Answers save as typed and commit on Submit, from any device                |
| IV. Review effort matches impact | yes      | Full questions and block comments; risk tier high, as the spec says        |
| V. Tools are optional            | yes      | Every action stays doable by hand; the skill documents worktrees (task 15) |
| VI. Code is checked against spec | yes      | Every scenario and criterion has a test, listed in each task               |

## Decisions

- [Stack](../decisions/stack.md): logic in the core (tasks 1 to 7), types generated by napi-rs (task
  8), the UI draws the core's tree (tasks 10 to 13), the guard's hosts (task 9).
- [Git](../decisions/git.md): worktrees, hook paths, the exclude file, all in `git.rs` (task 3);
  `ura start` in a worktree (task 5).
- [CLI](../decisions/cli.md): `--switch` is a flag; `ura status --json` stays version 1 (tasks 5,
  6).
- [Toolchain](../decisions/toolchain.md): new tests join `vp run ready`; the binding's declarations
  are committed (task 8).

## Complexity tracking

| Abstraction or exception                 | Why it is needed                                                       | Simpler alternative rejected because                                       |
| ---------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `files::document` (blocks, spans)        | The UI draws structure without a TypeScript parser (stack decision)    | Sending markdown text needs a parser in the UI, which the decision forbids |
| `files::items` per file kind             | Questions, stories, tasks, comments need ids and lines the UI acts on  | Deriving them in the UI from blocks reimplements the core's parsing        |
| `actions::commit` (shared commit step)   | `ura` and the server commit the same way, with the hook's whole output | Committing in each caller duplicates the hook handling                     |
| `watch` module with `notify`             | The server and the TUI both need change events; the human asked for it | Node's `fs.watch` in the server, which the TUI could not reuse             |
| `packages/server/src/fate/source.ts`     | fate has no source for data outside a database                         | One hand-cast registry per type, as the temporary code did                 |
| Browser test project (Playwright WebKit) | SC-007 measures layout, which happy-dom does not compute               | A manual check, which nothing would keep true                              |

---

## Task 1: The document tree

**Files:**

- Create: `crates/core/src/files/document.rs`
- Modify: `crates/core/src/files/mod.rs` (`pub mod document;`), `crates/core/Cargo.toml` (none)
- Test: `crates/core/tests/document.rs`

**Interfaces:**

- Consumes: `files::markdown::{options, slug}`, `workspace::resolve`.
- Produces:
  - `pub fn parse(text: &str, dir: &str) -> Document`, `dir` the folder of the file from the top
    level, for link paths.
  - `Document { blocks: Vec<Block>, frontmatter_lines: Option<LineRange>, hash: String }`, `hash`
    the hex SHA-256 of the text.
  - `Block { id: u32, parent: Option<u32>, kind: BlockKind, start_line: u32, end_line: u32, heading: Option<String>, level: Option<u32>, anchor: Option<String>, spans: Vec<Span>, ordered: Option<bool>, start: Option<u32>, marker: Option<ItemMarker>, checked: Option<bool>, callout_kind: Option<CalloutKind>, header: Option<bool>, align: Option<String>, language: Option<String>, text: Option<String> }`:
    flat fields, `None` where a kind has none, so napi-rs can generate them.
  - `BlockKind`: `heading`, `paragraph`, `list`, `item`, `callout`, `quote`, `table`, `row`, `cell`,
    `code`, `rule`, `html`. `ItemMarker`: `plain`, `task`, `pro`, `con`, `question`, `important`,
    `warning`, `ask`, `note`. `CalloutKind`: `note`, `tip`, `important`, `warning`, `caution`,
    `question`.
  - `Span { text: String, strong: bool, emphasis: bool, code: bool, strike: bool, link: Option<SpanLink> }`,
    `SpanLink { target: String, wiki: bool, path: Option<String> }`.
  - `LineRange { start: u32, end: u32 }`. Every type derives `serde::Serialize` (camelCase) and
    `napi(object)` / `napi(string_enum)` behind `cfg_attr(feature = "napi", ...)`.

- [x] **Step 1: Write the failing tests**

Table-driven, each `(markdown, expected blocks as (kind, parent, start_line, end_line))`:

```rust
#[test]
fn blocks_have_their_source_lines() {
    let doc = parse("---\nstatus: x\n---\n\n# T\n\nA\nB\n\n- one\n- two\n", "specs/f");
    assert_eq!(doc.frontmatter_lines, Some(LineRange { start: 1, end: 3 }));
    assert_eq!(shape(&doc), [("heading", None, 5, 5), ("paragraph", None, 7, 8),
        ("list", None, 10, 11), ("item", Some(2), 10, 10), ("item", Some(2), 11, 11)]);
}
```

Plus, one test each: `> [!QUESTION]` and `> [!IMPORTANT]` give `callout` with their kind and the
title spans; `- [pro] a` gives marker `pro` and spans `a`; `- ! careful` gives `warning`, `- ?`
`ask`, `- &` `note`; `- [ ] x` and `- [x] y` give `task` with `checked`; a table gives `table`,
`row` with `header: Some(true)` first, `cell` with `align`; `<div>x</div>` gives `html` with its
`text`; a link `[s](spec.md#a)` in `specs/f/x.md` gives `path: Some("specs/f/spec.md")`, a web link
`path: None`, `[[due-dates]]` `wiki: true`; `**b** _e_ \`c\`
~~s~~`sets each mark; headings get`anchor` like GitHub (`"Q2: How does it
work?"`→`q2-how-does-it-work`, duplicates `-1`); every block gets `heading`, the nearest heading above it; `hash`is 64 hex characters and changes with the text. SC-006:`every_example_and_specs_file_parses`reads every`.md`under`skills/uraeda/assets/example/specs`and`specs/`,
and asserts every line belongs to a block or the frontmatter, or is blank.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test document`
- Expected: FAIL to compile, `unresolved import uraeda_core::files::document`.

- [x] **Step 3: Implement `document::parse`**

pulldown-cmark's offset iterator with `markdown::options()` plus `ENABLE_GFM`; a stack of open
blocks gives `parent`; lines from the offsets, as `markdown.rs`'s `Lines` does (make it
`pub(crate)`). Typed bullets and list callouts are read from the item's first text: strip the marker
from the spans. Links resolve with `workspace::resolve(dir, target)`, `None` for `://`/`mailto:`. A
`>` callout kind from `BlockQuoteKind`; `[!QUESTION]`, which pulldown-cmark does not know, from the
quote's first line.

- [x] **Step 4: Run all tests**

- Run: `cargo test -p uraeda-core && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core/src/files crates/core/tests/document.rs
git commit -m "feat(web-ui): the document tree of a workflow file"
```

## Task 2: Structured items per file kind

**Files:**

- Create: `crates/core/src/files/items.rs`, `crates/core/src/files/spec.rs`,
  `crates/core/src/files/rulings.rs`
- Modify: `crates/core/src/files/clarifications.rs` (answer split and compose, question and option
  headings), `crates/core/src/files/review.rs` (edit and remove a comment); plan tasks with their
  steps are read in `items.rs`, from the document's task items
- Test: `crates/core/tests/items.rs`, `crates/core/tests/files.rs`

**Interfaces:**

- Consumes: `document::{parse, Document, Block}`.
- Produces:
  - `pub fn items(name: &str, text: &str, doc: &Document) -> Items`, dispatching on
    `FileKind::of(name)` and `PRIORITIES.md`.
  - `Items { clarifications: Option<RoundItems>, spec: Option<SpecItems>, plan: Option<PlanItems>, review: Option<ReviewItems>, rulings: Option<Vec<Ruling>> }`,
    flat for napi.
  - `RoundItems { status, block: Option<u32>, context: Vec<u32>, questions: Vec<QuestionItem>, settled: Vec<u32>, notes: Option<String>, notes_line: Option<u32> }`;
    `QuestionItem { id, parent, title, start_line, end_line, heading_block: u32, context: Vec<u32>, options: Vec<Choice>, answer: String, letters: Vec<String>, comment: String, applies: String ("yes" | "no" | "unclear"), answer_line: u32 }`;
    `Choice { letter: String, recommended: bool, summary: Vec<Span>, pros: Vec<u32>, cons: Vec<u32>, why: Option<u32>, other: Vec<u32> }`
    (block ids).
  - `SpecItems { stories: Vec<Story>, criteria: Vec<Criterion> }`;
    `Story { id, title, priority, heading_block, blocks: Vec<u32>, why: Option<u32>, scenarios: Vec<Scenario { number: u32, block: u32 }> }`;
    `Criterion { id, block }`.
  - `PlanItems { tasks: Vec<TaskItem { number, title, heading_block, steps: Vec<StepItem { block, checked }>, done, total }> }`.
  - `ReviewItems { verdict, commit, summary, comments: Vec<CommentItem { number, start_line, end_line, heading, general: bool, quote: Vec<String>, text }> }`.
  - `Ruling { id, title, heading_block, blocks: Vec<u32> }`.
  - `clarifications::compose_answer(letters: &[String], comment: &str) -> String` and
    `clarifications::split_answer(answer: &str, options: &[char]) -> (Vec<String>, String)`.
  - `review::edit_comment(text: &str, number: u32, comment: &str) -> Result<String, ReviewError>`,
    `review::remove_comment(text: &str, number: u32) -> Result<Option<String>, ReviewError>` (`None`
    when no comment is left), renumbering from C1.

- [x] **Step 1: Write the failing tests**

- `compose_answer`: `(["A"], "")` → `A`; `(["B","C"], "")` → `B and C`; `(["A","B","C"], "")` →
  `A, B and C`; `(["A"], "but only for the dev server")` → `A: but only for the dev server`;
  `([], "Neither, keep it simple")` → `Neither, keep it simple`; letters given unsorted come out
  sorted.
- `split_answer`: `B and C: weekdays matter` → `(["B","C"], "weekdays matter")`; `A` →
  `(["A"], "")`; `A, B and C` → all three; `C, we want a simple feature` → `([], "C, we want …")`
  (no `:`); `Neither` → `([], "Neither")`; `-` → `([], "-")`. Review focus 2:
  `A: line one\nline two` splits to `(["A"], "line one\nline two")` and composes back to the same
  text.
- `items` on the example's `clarifications-01.md`: Q1 has options A, B, C, A `recommended`, A's
  `pros` and `cons` one block each and `why` set; Q2.B's `parent` is `Q2`; Q2.B `applies` is `no`
  (Q2 answered C); `settled` is non-empty; `notes` read.
- `items` on the example's `spec.md`: `US2` has title "Complete a repeating task", priority `P1`,
  `why` set, scenarios 1 and 2 with blocks whose lines are 58–59 and 60–61; `SC-001` found. Review
  focus 4: a spec with `## User stories` and no story gives `stories: []`, and a story without
  `Acceptance scenarios` gives `scenarios: []`.
- `items` on the example's `plan.md`: task 6 has 5 steps with `checked`, `done` and `total`.
- `items` on a review file: comments with lines and `general`.
- `edit_comment` replaces C1's text, quote kept; `remove_comment` of C1 of two renumbers C2 to C1;
  of the last returns `None`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test items`
- Expected: FAIL to compile, `cannot find function items`.

- [x] **Step 3: Implement the items and the helpers**

Walk the document's blocks: a question is a heading block whose text matches `clarifications`'
`heading`; its option items are the list items whose first `strong` span starts with `A.` or
`A (recommended).`; their nested items with marker `pro`/`con`, and a plain item starting "Why
recommended:" as `why`. Story headings `US\d+: Title (P\d)`; scenarios are the items of the first
ordered list after "Acceptance scenarios:". `answer` and `answer_line` come from
`clarifications::parse`, so both stay one parser.

- [x] **Step 4: Run all tests**

- Run: `cargo test -p uraeda-core && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core/src/files crates/core/tests
git commit -m "feat(web-ui): structured items of each workflow file"
```

## Task 3: Worktrees, and hooks in them

**Files:**

- Modify: `crates/core/src/git.rs` (`add_worktree`, `exclude`, `prune_worktrees`, hooks path in
  `commit`, whole output in `GitError::Command`), `crates/core/src/actions/place.rs` (`reach` never
  switches; `reach_switching`)
- Modify: `crates/cli/src/answer.rs`, `crates/cli/src/review.rs`, `crates/cli/src/draft.rs`,
  `crates/cli/src/output.rs` (`say_place` instead of `say_switched`)
- Test: `crates/core/tests/worktrees.rs`, `crates/cli/tests/answer.rs`, `crates/cli/tests/fixes.rs`,
  `crates/cli/tests/review.rs`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `Git::main_root(&self) -> PathBuf`: the main checkout's top level, from the common dir.
  - `Git::add_worktree(&self, path: &Path, branch: &str) -> Result<(), GitError>`:
    `git worktree add <path> <branch>`, or with `--track -b <branch> <path> origin/<branch>` when
    only `origin` has it; runs `git worktree prune` first.
  - `Git::exclude_worktrees(&self) -> Result<(), GitError>`: appends `/.worktrees/` to
    `<common dir>/info/exclude` once.
  - `GitError::Command { subcommand, message, output: String }`: `output` the whole stderr and
    stdout, for the UI's hook section.
  - `GitError::WorktreeExists(String)`: "cannot create the worktree: .worktrees/<branch> exists".
  - `place::reach(git, branch) -> Result<Place, PlaceError>`: the checkout or a worktree on the
    branch, else `<main root>/.worktrees/<branch>/` created; never switches.
    `Place { root, created: bool }` (the `switched` field goes).
  - `place::reach_switching(git, branch)`: today's behaviour, for `ura start --switch`.

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/worktrees.rs`, on `TestRepo` with a feature branch `2026-10-11-web-ui`:

- US5.1: checkout on `main`, `reach` → `root` ends with `.worktrees/2026-10-11-web-ui`, `created`,
  `git worktree list` has it, `current_branch()` of the main checkout is `main`.
- US5.2: `reach` twice → the second `created == false`, one worktree added.
- US5.3: checkout on the branch → `root` is the checkout.
- US5.4: branch only on `origin` (pushed, local deleted) → a local branch tracking
  `origin/2026-10-11-web-ui` checked out in the worktree.
- US5.5 / SC-003: `core.hooksPath` is `.git/hooks` (relative): a commit through `Git::commit` in the
  worktree increments `hook_runs()`.
- US5.6: after a first worktree, `porcelain()` of the main checkout is empty and `.git/info/exclude`
  contains `/.worktrees/` once after two creations.
- Edge: `.worktrees/2026-10-11-web-ui/` exists as a plain folder → `WorktreeExists`, message "cannot
  create the worktree: .worktrees/2026-10-11-web-ui exists".
- Review focus 1: a worktree removed with `rm -rf` but still registered → `reach` prunes and creates
  it again.
- A refused commit keeps the hook's whole output: a hook printing two lines then `exit 1` →
  `GitError::Command` whose `output` has both lines.

In the CLI tests, rewrite `switches_to_the_branch_from_a_clean_main` as
`writes_in_a_new_worktree_from_main` (stdout starts with
`wrote in .worktrees/2026-10-10-cli-core\n`, `repo.current_branch()` is `main`), and
`refuses_to_switch_over_uncommitted_changes` as `writes_in_a_worktree_over_uncommitted_changes`;
`a_refused_answer_switches_back` becomes `a_refused_answer_leaves_the_checkout` (SC-002: branch
unchanged).

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test worktrees`
- Expected: FAIL to compile, `no field created on type Place`.

- [x] **Step 3: Implement**

`commit` passes `-c core.hooksPath=<abs>` when the configured value is relative and this is a linked
worktree, `<abs>` = `main_root().join(value)`. `run` returns the whole output in `output`, and keeps
`message` its first line.

- [x] **Step 4: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(web-ui): write on branches through worktrees, never switching"
```

## Task 4: Committing actions in the core

**Files:**

- Create: `crates/core/src/actions/commit.rs`, `crates/core/src/actions/text.rs`
- Modify: `crates/core/src/actions/answer.rs` (`save`, `save_notes`, `submit_and_commit`),
  `crates/core/src/actions/review.rs` (`edit`, `remove`, `start_over`, committing verdicts),
  `crates/core/src/actions/mod.rs` (`ActionError::Hook`, `ActionError::Changed`, `Committed`)
- Modify: `crates/cli/src/answer.rs`, `crates/cli/src/review.rs`, `crates/cli/src/output.rs`
- Test: `crates/core/tests/actions.rs`

**Interfaces:**

- Consumes: `place::reach`, `Git::commit`, `clarifications::{compose_answer, set_answer}`,
  `review::{edit_comment, remove_comment}`.
- Produces:
  - `commit::commit(place: &Place, change: &Change) -> Result<String, ActionError>`: refuses other
    staged files before writing (checked by callers through `ensure_only_staged`), commits, returns
    the short hash. A failed `git commit` is `ActionError::Hook { output: String }`, files kept.
  - `answer::save(place, feature, id: &str, letters: &[String], comment: &str, previous: &str) -> Result<Written, ActionError>`:
    `ActionError::Changed` when the question's current answer is not `previous`.
  - `answer::save_notes(place, feature, notes: &str, previous: &str)`.
  - `answer::submit_and_commit(place, feature, today) -> Result<Committed, ActionError>`,
    `Committed { change: Change, commit: String }`.
  - `review::edit(place, feature, file, number: u32, text: &str)`,
    `review::remove(place, feature, file, number: u32)`, `review::start_over(place, feature, file)`
    (deletes the pending review), and `review::approve_and_commit`,
    `review::request_changes_and_commit` returning `Committed`.
  - `text::save(place: &Place, path: &str, text: &str, hash: &str) -> Result<String, ActionError>`
    (the new hash; `Changed` when the file's hash on disk is not `hash`; an absent file has the hash
    of `""`), `text::commit(place, path) -> Result<Committed, ActionError>`, which names the commit
    itself: `chore: draft <title>` with `PRIORITIES.md` when it changed, `chore(<slug>): proposal`,
    or `chore(<slug>): edit the proposal`.
  - `ActionError::Changed { path: String }`, message "<file name> changed on disk since you opened
    it. Your text was not saved.".

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/actions.rs`, on a `TestRepo` holding the example's clarifications round:

- US2.1: `save(…, "Q2", ["A"], "", "")` → the file's Q2 line is `**Answer:** A`.
- US2.2: `["B","C"]` → `**Answer:** B and C`; `["A","B","C"]` → `**Answer:** A, B and C`.
- US2.3: `["A"]`, `"but only for the dev server"` → `**Answer:** A: but only for the dev server`.
- US2.4: `[]`, `"Neither, keep it simple"` → `**Answer:** Neither, keep it simple`.
- US2.7: `save("Q1.B", [], "-")` → `**Answer:** -`.
- US2.10: `save_notes("LGTM")` → the file's last line `**Notes:** LGTM`.
- Two tabs: `save(…, previous: "B")` when the file says `A` → `Changed`.
- Edge: `save(…, comment: "# heading")` → `ActionError::Answer(Structure)`, file unchanged.
- US2.9: every question answered → `submit_and_commit` makes one commit
  `discovery(<slug>): answer round 01` on the feature's branch, status `answered`, block "Answered
  on 2026-10-11.".
- Hook: a hook that fails → `ActionError::Hook` with its output; the file stays `answered` and
  uncommitted; a second `commit` after fixing the hook succeeds ("Try again").
- US3.3: `review::edit(1, "Say what the row shows, and for how long")` changes C1;
  `review::remove(1)` deletes `spec-review.md` when it was the only comment.
- US3.4: approve with tier `high` from `medium` → `approved`, `risk-tier: high`,
  `plan-review: true`, one commit.
- US4.2: `text::save` writes the text byte for byte; with a stale hash → `Changed`, file untouched.
- US4.3: `text::commit("specs/drafts/git-listener-process.md")` with `PRIORITIES.md` changed commits
  both, as `chore: draft Git listener process`.
- SC-002: every test asserts `repo.current_branch()` is unchanged.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test actions`
- Expected: FAIL to compile, `unresolved import uraeda_core::actions::text`.

- [x] **Step 3: Implement**

`ura answer` and `ura review` call the committing functions; their output and the existing CLI tests
stay as they are, except the place line of task 3.

- [x] **Step 4: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(web-ui): actions that save, check, and commit in the core"
```

## Task 5: Start in a worktree, and edit the priorities

**Files:**

- Modify: `crates/core/src/actions/start.rs` (worktree by default, `switch: bool`),
  `crates/core/src/files/priorities.rs` (`Priorities` with ids, nested lines; `add`, `move_entry`,
  `edit`, `remove`)
- Create: `crates/core/src/actions/priorities.rs`
- Modify: `crates/cli/src/start.rs`, `crates/cli/src/main.rs` (`--switch`)
- Test: `crates/core/tests/priorities.rs`, `crates/cli/tests/start.rs`

**Interfaces:**

- Consumes: `place::{reach, reach_switching}`, `commit::commit`, `text`'s hash helper.
- Produces:
  - `priorities::read(text: &str) -> Priorities { hash, sections: Vec<SectionItems { section, entries: Vec<EntryItem { id: String, text: String, spans: Vec<Span>, start_line, end_line, nested: Vec<String> }> }> }`,
    `id` = `<section>-<position>` (`next-2`).
  - `priorities::add(text, section, line: &str) -> String`: line breaks to spaces, appended at the
    end of the section, `- ` marker, the section created when missing.
  - `priorities::move_entry(text, id, section, index: usize) -> Option<String>`,
    `priorities::edit(text, id, line) -> Option<String>`,
    `priorities::remove(text, id) -> Option<String>`: whole entries with their nested lines, every
    other byte kept.
  - `actions::priorities::{add, move_entry, edit, remove}(place, …, hash: &str) -> Result<String, ActionError>`
    (new hash; refused with "PRIORITIES.md changed on disk. Your change was not applied."),
    `commit(place) -> Committed` (`chore: update the priorities`, the file alone), `discard(place)`
    (`Git::restore`), `read(place) -> Priorities` whose `changes` counts the entries added, moved,
    edited, or removed since `HEAD`: those outside the longest common sequence of entries, so a swap
    is one change.
  - `draft::create(place, id)`: drafts a priority line by its id.
  - `start::run(git, workspace, draft, slug, today, switch: bool)`;
    `Started { worktree: Option<String>, .. }`; `Git::add_worktree_new(path, branch, from)`.

- [x] **Step 1: Write the failing tests**

- US7.1: `add(text, Next, "Show the agent's last commit on the feature page")` ends Next with
  `- Show the agent's last commit on the feature page`; US7.2 with Later.
- US7.3: `move_entry("next-2", Next, 0)` swaps the two Next lines, and `changes` is 1.
- US7.4 / review focus 3: a Later entry `- [Nice TUI](drafts/cli-tuis.md)` with a nested `  - x`
  moved to Next keeps both lines byte for byte, and Later loses them.
- US7.5: `edit` writes the markdown as given, link included.
- Every edit on this repository's `specs/PRIORITIES.md` keeps the other lines byte for byte.
- US7.6: `commit` makes one commit `chore: update the priorities` holding only the file.
- US7.7: `discard` restores the committed text.
- US7.8: checkout on a feature branch → the action writes in `.worktrees/main/`.
- Edge: `add` with an empty line → `Refused("empty")`; with a stale `hash` → `Changed`.
- US4.4 (CLI `start.rs`): `ura start specs/drafts/git-listener.md --slug git-listener` on 2026-10-12
  → `.worktrees/2026-10-12-git-listener/specs/2026-10-12-git-listener/proposal.md` exists, the main
  checkout is still on `main`, the entry is in Now; US5.7: `--switch` switches the checkout as
  before. Existing start tests switch to asserting the worktree.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test priorities`
- Expected: FAIL to compile, `cannot find function read in module priorities`.

- [x] **Step 3: Implement**

`start` commits the priorities on the default branch where `reach` finds it, then
`git worktree add -b <folder> .worktrees/<folder> <default>` (through `Git::add_worktree_new`),
moves the draft into the worktree, and commits there. A draft not committed moves from the default
branch's checkout into the worktree (edge case of the spec).

- [x] **Step 4: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(web-ui): start features in worktrees, and edit the priorities"
```

## Task 6: The workspace: merged features, worktrees, drafts

**Files:**

- Modify: `crates/core/src/workspace.rs`, `crates/core/src/steps.rs` (`StepName::Done`),
  `crates/cli/src/status.rs` (the Done group)
- Test: `crates/core/tests/workspace.rs`, `crates/cli/tests/status.rs` (`merged_features_are_done`
  replaces `merged_remote_branch_is_hidden`, the cli-core ruling R10 this spec reverses)

**Interfaces:**

- Consumes: `Git::worktrees`.
- Produces: `Feature.worktree: Option<String>`, from the main checkout (`.` for it); merged folders
  as features with `source: default-branch`, `branch: None`, step `done`, waiting on `nobody` (a new
  `WaitsOn` value); `PriorityEntry.draft: Option<String>`; `Workspace::read` reads a feature checked
  out in any worktree from that worktree's disk.

- [x] **Step 1: Write the failing tests**

- US1.3: two feature folders committed on `main` → both features with step `done` and source
  `default-branch`; `ura status` prints them under "Done", and `--json` has `"version": 1`.
- US1.2: an approved spec with no plan → step `plan`, waits on agent (already true; keep a test).
- A feature checked out in `.worktrees/x` with an uncommitted answer → read from that worktree,
  `worktree` set, `uncommitted: true`.
- A Next entry linking `drafts/note.md` → `draft: Some("specs/drafts/note.md")`; without a link
  `None`.
- Edge: a merged feature whose branch still exists → one feature, `done`, read from `main`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test workspace && cargo test -p uraeda-cli --test status`
- Expected: FAIL to compile, `no field worktree on type &Feature`.

- [x] **Step 3: Implement**

- [x] **Step 4: Run all tests**

- Run: `cargo test --workspace --exclude uraeda-binding`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(web-ui): merged features, worktrees, and drafts in the workspace"
```

## Task 7: The watcher

**Files:**

- Create: `crates/core/src/watch.rs`
- Modify: `Cargo.toml` (`notify = "8.2.0"`), `crates/core/Cargo.toml`, `crates/core/src/lib.rs`,
  `crates/core/src/git.rs` (`common_dir`)
- Create: `specs/2026-10-11-web-ui/rulings.md` (R1: no `notify-debouncer-full`)
- Test: `crates/core/tests/watch.rs`

**Interfaces:**

- Consumes: `Workspace::read`, `document::parse` (hashes).
- Produces:
  `watch::watch(root: &Path, on_change: impl Fn(Changes) + Send + 'static) -> Result<Watcher, WatchError>`;
  `Changes { features: Vec<String>, files: Vec<String>, priorities: bool, workspace: bool }`;
  `Watcher` stops when dropped; `WatchError` carries notify's message.

- [x] **Step 1: Write the failing tests**

Each waits on a channel for at most 5 s:

- Writing an answer in the feature's worktree →
  `Changes { files: ["<folder>/clarifications-01.md"], features: ["<folder>"], .. }`.
- A commit on another branch (refs change) adding `spec.md` → its feature and file listed (US6.5's
  core half).
- Editing `specs/PRIORITIES.md` on `main` → `priorities: true`.
- Creating a worktree → `workspace: true`, and an edit inside it afterwards is reported.
- Ten writes within 100 ms → one `Changes` (200 ms quiet time).

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test watch`
- Expected: FAIL to compile, `unresolved import uraeda_core::watch`.

- [x] **Step 3: Implement**

`notify` watching `specs/` of every worktree recursively, each worktree's top level and the git
common dir without recursion, and its `refs/` and `worktrees/` recursively; a thread waits for 200
ms without events (ruling R1), re-reads the workspace, hashes each feature's texts and each file's
text, compares them with the last snapshot, and calls `on_change` when anything differs; it adds
watches for new worktrees.

- [x] **Step 4: Run all tests**

- Run: `cargo test -p uraeda-core && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add Cargo.toml Cargo.lock crates/core
git commit -m "feat(web-ui): watch the repository for changes in the core"
```

## Task 8: The binding

**Files:**

- Create: `crates/core/src/view.rs` (the napi objects the UI reads: `WorkspaceView`, `FeatureView`,
  `FileView`, `DraftView`, `CommitView`, `StartedView`), `crates/core/src/api.rs` (one function per
  binding call, by repository path, with `ApiError { code, message, output }`), `fixtures/repo/`
  (`main/` and `branches/<branch>/`, mostly from the skill's example)
- Modify: `crates/binding/src/lib.rs`, `packages/binding/index.d.ts`, `packages/binding/index.js`
  (generated), `packages/binding/index.test.ts`, `packages/binding/test-utils.ts`
- The temporary functions stay until tasks 9 and 10 replace the server and UI code calling them;
  task 10 deletes them, with `crates/core/src/temporary_status.rs`.

**Interfaces:**

- Consumes: everything above.
- Produces (TypeScript names, all async except `watch`): `readWorkspace(repo)`,
  `readFeature(repo, folder)`, `readFile(repo, folder, name): Promise<FileView>`
  (`{ id, folder, name, path, kind, status, current: { text, document, items }, tip, committed, review }`),
  `readPriorities(repo)`, `readDraft(repo, path)`,
  `saveAnswer(repo, folder, question, letters, comment, previous)`,
  `saveNotes(repo, folder, notes, previous)`, `submitAnswers(repo, folder)`,
  `retryCommit(repo, folder, subject, paths)`,
  `addComment(repo, folder, file, startLine?, endLine?, text)`, `editComment`, `removeComment`,
  `startOver`, `approve(repo, folder, file, summary?, riskTier?, planReview?)`, `requestChanges`,
  `createDraft(repo, id)`, `saveText(repo, path, text, previous)`, `commitText(repo, path)`,
  `startFeature(repo, draft, slug?)`, `addPriority(repo, section, text, previous)`, `movePriority`,
  `editPriority`, `removePriority`, `commitPriorities`, `discardPriorities`, and
  `watch(repo, onChange: (changes: Changes) => void): WatchHandle` with `close()`. Errors reject
  with `<code>: <message>`, `code` being `refused`, `conflict`, or `hook`, the hook's output after a
  blank line.
- `test-utils.ts`: `fixtureRepo(name = "repo")`, a temporary git repository built by running `git`:
  `fixtures/<name>/main/` committed on `main`, each `fixtures/<name>/branches/<branch>/` on its
  branch; `git(cwd, ...args)`.

- [x] **Step 1: Write the failing tests**

`packages/binding/index.test.ts`: `readWorkspace(fixtureRepo())` lists the fixture's features;
`readFile` of a round returns `items.clarifications.questions` with letters; `saveAnswer` writes
`A`; `watch` calls back after a write, then `close()` stops it.

- [x] **Step 2: Run them to check they fail**

- Run: `vp run --filter uraeda-binding build && vp test packages/binding`
- Expected: FAIL, `readWorkspace is not a function`.

- [x] **Step 3: Implement**

Each `#[napi]` function returns an `AsyncTask` of one generic `Job<T>`, which runs its `api` call on
libuv's pool, with `ts_return_type` naming its promise; `watch` takes a weak `ThreadsafeFunction`,
so it does not keep Node running.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS, the temporary functions and their callers kept.

- [x] **Step 5: Commit**

```bash
git add crates packages/binding
git commit -m "feat(web-ui): the binding's async functions and watcher"
```

## Task 9: The server

**Files:**

- Create: `packages/server/src/fate/{source,views,sources,mutations,context,errors}.ts`,
  `packages/server/src/env.ts`, `packages/server/src/live.ts`, `packages/server/src/files.ts`,
  `.env.example`
- Modify: `packages/server/src/{app,fate,guard,main,options}.ts`, `.gitignore` (`.env`),
  `crates/core/src/api.rs` and `crates/binding/src/lib.rs` (`readText`, `readRaw`)
- Delete: `packages/server/src/__tests__/temporary-spec-folders.test.ts`; the temporary source
  stays, among the new ones, until task 10 replaces the status page
- Test: `packages/server/src/__tests__/{guard,env,fate,live,files,main}.test.ts`

**Interfaces:**

- Consumes: the binding (task 8).
- Produces:
  - `loadEnv(root, environment = process.env): { allowedHosts: string[]; port: number; repo: string }`
    from `<root>/.env`, the environment winning; `parseOptions(argv, env)` with `--repo`, `--port`,
    `--allow-origin`, `--web-root` over them.
  - `guard({ port, allowedHosts, allowOrigins })`: hosts `127.0.0.1:<port>`, `localhost:<port>`, and
    each allowed host with or without the port; origins `http://` the first two, `https://` each
    allowed host, and the allowed origins.
  - `fileSource(view, { byIds, list? })` and `createSources(entries)`, returning fate's
    `{ getSource, registry }` and `masked(view, ctx, record, select)`, which masks a mutation's
    record to the client's selection.
  - Entities, each read by id: `Workspace` (`id: "workspace"`), `Feature` (its folder),
    `WorkflowFile` (`<folder>/<name>`), `Priorities` (`id: "priorities"`), `Draft` (its path); the
    roots list each type, so fate registers every source.
  - Mutations named as in the spec's **Mutations**, plus `commit.retry`, each returning the changed
    `WorkflowFile`, `Feature`, `Priorities`, or `Draft`; refusals as `BAD_REQUEST`, their kind in
    the message (ruling R3).
  - `createApp({ repo, port, allowedHosts, allowOrigins, webRoot?, binding })`; `/fate` and
    `/fate/live` on one handler; `GET /raw/<path>` (text/plain) and `GET /mockups/<path>` with its
    type and `Content-Security-Policy: sandbox allow-scripts`, both through `readRaw`.
  - `startLive(binding, repo)`: the core's watcher, each `Changes` published as `live.update` of the
    workspace, the features, the files, and the priorities.

- [x] **Step 1: Write the failing tests**

- US6.1/6.2 in `guard.test.ts` with `allowedHosts: ["mac.tail1234.ts.net"]`: Host
  `mac.tail1234.ts.net` + Origin `https://mac.tail1234.ts.net` → 200; Host `evil.example` → 403
  "Forbidden host"; Origin `https://evil.example` → 403 "Forbidden origin".
- `env.test.ts`: `.env` with `URAEDA_ALLOWED_HOSTS=a.ts.net, b.ts.net` → both; no `URAEDA_PORT` →
  4310; `URAEDA_REPO` relative → resolved from the root.
- `fate.test.ts` on `fixtureRepo()`: the `workspace` query groups features; `file` returns
  `document.blocks` and `items`; `answer.save` writes and returns the file; a stale `previous` →
  error code `CONFLICT`; `priorities.add` → `Priorities` with the new entry.
- `live.test.ts` (US6.5): subscribe to `Feature:<id>` over `GET /fate/live`, commit `spec.md` on the
  branch, receive the update within 2 s.
- `files.test.ts`: a mockup is served with `Content-Security-Policy: sandbox`; `/raw/../x` → 404.
- `main.test.ts`: `URAEDA_REPO` not a repository → stderr "uraeda-server: <path> is not a git
  repository", exit 1; the binding message test stays.
- SC-001: a repository with 20 feature branches answers the `workspace` query in under 500 ms.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server`
- Expected: FAIL, `Cannot find module '../env.ts'`.

- [x] **Step 3: Implement**

- [x] **Step 4: Run all tests**

- Run: `vp check && vp test packages/server`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server .env.example .gitignore
git commit -m "feat(web-ui): the server's fate sources, mutations, and live updates"
```

## Task 10: The shell, home, feature, and document pages

**Files:**

- Create: `packages/web/src/{routes,theme,Shell,Home,FeaturePage,DocumentPage,Blocks,Spans}.tsx`,
  `packages/web/src/{data,views,labels,errors}.ts`, `packages/web/src/styles.css` (the reading
  layout, on Astryx's CSS variables: a plain stylesheet, as the app has no StyleX compiler),
  `packages/web/src/css.d.ts`, `packages/server/src/fate/select.ts` (ruling R4)
- Modify: `packages/web/src/{App,main}.tsx`, `packages/web/package.json`
  (`@astryxdesign/theme-neutral` 0.6.7), `packages/web/vite.config.ts` (the test URL),
  `packages/server/src/app.ts`, `crates/core/src/{view,api}.rs` (`noSpecs`)
- Delete: the temporary status page, source, binding functions, and their tests, with
  `crates/core/src/temporary_status.rs`
- Test: `packages/web/src/__tests__/{home,feature,document,theme}.test.tsx`, helpers on
  `fixtureRepo()`

**Interfaces:**

- Consumes: the fate client from the server's module.
- Produces: `routes.tsx` with `useRoute()`, `navigate(path)`, `<Link to>`, and `pathLink(path)` over
  the location's path (`/`, `/f/<folder>`, `/f/<folder>/<file>`, `/priorities`, `/edit/<path>`), so
  in-page anchors keep working; `<Blocks document ids? selection? />` drawing every block kind, a
  selection making top-level blocks and items tappable; `<Spans spans />`;
  `useThemeMode(): [mode, set]`, stored under `uraeda.theme`; `useWorkspace()`, `useFeature()`,
  `useFile()`, `usePriorities()`, `useDraft()`, each a live view read again when the page is shown
  again; `refusal(error)` reading the core's code from a message (ruling R3).

- [x] **Step 1: Write the failing tests**

- US1.1: home shows "Waiting on you", the feature's title under "Answer", and its block line.
- US1.2: "Agents at work" with the step "Plan".
- US1.3: "Done" lists merged features.
- US1.4: "Priorities" shows "Draft" on a line without a link, "Start" on a line linking a draft; no
  Later line.
- US1.5: a feature's files in order, then `spec.md` and `plan.md` "not yet".
- US1.6: a problem "clarifications-01.md:40" with its message.
- Edges: no `specs/` → "No specs/ folder in <path>. Set Uraeda up with ura init."; the server
  unreachable → "Could not reach the Uraeda server." with "Try again".
- Document page: a callout renders as a banner with its title; `[pro]` items show their sign; a
  `html` block shows its text, not markup; a link to `spec.md` navigates to `#/f/<folder>/spec.md`,
  to code to `/raw/<path>`, a web link has `target="_blank"`.
- US6.6: firing `visibilitychange` to visible refetches.
- US6.7: picking Dark sets `data-theme="dark"` and `localStorage["uraeda.theme"] = "dark"`; a
  remount reads it back; System removes the key.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web`
- Expected: FAIL, `Failed to resolve import "./Home.tsx"`.

- [x] **Step 3: Implement**

The reading layout of the spec: one 16 px inset, no `Card`, 17 px body text on narrow screens,
labels, bands, hairlines, tints with a 4 px accent bar. `AppShell` with a `SideNav`, which it turns
into the phone's menu, the theme switch in its footer; ＋ comes with the quick add, in task 13.
Callouts are a bar, not a `Banner` (ruling R5).

- [x] **Step 4: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(web-ui): the shell, home, feature, and document pages"
```

## Task 11: Answering a round

**Files:**

- Create: `packages/web/src/{RoundPage,Question,FilePage}.tsx`, `packages/web/src/useSave.ts`
- Modify: `packages/web/src/{App,DocumentPage}.tsx`; `crates/core/src/api.rs`,
  `crates/binding/src/lib.rs`, and the server's `commit.retry`, which take the file's name and let
  the core name the commit
- Test: `packages/web/src/__tests__/round.test.tsx`

**Interfaces:**

- Consumes: `answer.save`, `notes.save`, `answers.submit`, `commit.retry`; `Blocks`.
- Produces: `useSave(run, initial, delay = 400)`: saves in order, each with the text the last one
  wrote as `previous`, after `delay` without changes or at once; state
  `idle | saving | saved | error(message)`; `settle(text)` takes the file's text when nothing waits.
  `HookRefusal`, the hook's banner with its output and "Try again", for the review page too.
  `FilePage` picks a file's page by its kind.

- [x] **Step 1: Write the failing tests**

US2.1 to US2.11 on a fixture round, one test each, with the spec's values; plus review focus 5: two
comment edits 100 ms apart produce two saves, the second with the first's text as `previous`, and no
conflict; a refused save shows "Not saved: <message>" and keeps the field's text; a hook refusal
shows "The pre-commit hook refused the commit. Your answers are saved, not committed." and "Try
again"; a round submitted elsewhere turns read-only.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/round.test.tsx`
- Expected: FAIL, `Failed to resolve import "./RoundPage.tsx"`.

- [x] **Step 3: Implement**

Options are rows with the letter floated beside the first line, "Recommended" as a label above,
every text in full; tapping anywhere on a row toggles its letter.

- [x] **Step 4: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(web-ui): answer a round of questions"
```

## Task 12: Reviewing a spec, plan, or assessment

**Files:**

- Create: `packages/web/src/ReviewPage.tsx`, the verdict included
- Modify: `packages/web/src/{Blocks,FilePage}.tsx` (`override`, to draw story and task headings),
  `crates/core/src/files/items.rs` (`SpecItems.risk_tier`, `plan_review`, from the frontmatter),
  `crates/core/src/{view,api}.rs` (`FileView.review_stale`: the file at the review's commit differs
  from the file at the tip)
- Test: `packages/web/src/__tests__/review.test.tsx`

**Interfaces:**

- Consumes: `review.*` mutations, `commit.retry`; `Blocks` with a selection and an override;
  `HookRefusal`.

- [x] **Step 1: Write the failing tests**

US3.1 to US3.7 with the spec's values, on a fixture spec whose scenario 1 of US2 spans lines 92–93;
review focus 4: a spec without stories still renders and selects blocks; "Start over" deletes the
pending review.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/review.test.tsx`
- Expected: FAIL, `Failed to resolve import "./ReviewPage.tsx"`.

- [x] **Step 3: Implement**

- [x] **Step 4: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(web-ui): review a spec, a plan, or an assessment"
```

## Task 13: Drafts, proposals, starting, and priorities

**Files:**

- Create: `packages/web/src/{EditorPage,PrioritiesPage,QuickAdd}.tsx` (the draft's page is the
  editor's, with Start for drafts)
- Modify: `packages/web/src/{App,Shell,DocumentPage}.tsx` (the routes, ＋ in the navigation's
  header, Edit on a proposal), `packages/web/src/labels.ts` (a proposal's gate opens its editor)
- Test: `packages/web/src/__tests__/{editor,priorities}.test.tsx`

**Interfaces:**

- Consumes: `draft.create`, `text.save`, `text.commit`, `feature.start`, `priorities.*`; `useSave`;
  `usePriorities`, `useDraft`.
- Produces: a line's menu as a bottom sheet of actions (Move up, Move down, Move to a section, Edit,
  Delete); dragging by its handle with pointer events.

- [x] **Step 1: Write the failing tests**

US4.1 to US4.6 and US7.1 to US7.8 with the spec's values; edges: "Copy my text" and "Load the new
version" after a conflict; "Your 2 priority changes are committed with it." before a draft commit or
a start with pending priority changes; "Add" disabled while empty; dragging covered by the menu's
Move up and Move down (pointer dragging is tested by the browser project of task 14).

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/priorities.test.tsx`
- Expected: FAIL, `Failed to resolve import "./PrioritiesPage.tsx"`.

- [x] **Step 3: Implement**

- [x] **Step 4: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(web-ui): drafts, proposals, starting, and priorities"
```

## Task 14: `vp dev` at the root, and the layout on an iPhone

**Files:**

- Create: `packages/server/src/dev.ts` (`devServer(env)`, `devHandler(root)`: the server's routes in
  Vite's middleware, for the repository of `.env` or a later `URAEDA_REPO`, on the port each request
  came in on), `packages/web/vite.browser.config.ts` (the WebKit project at 402 × 874),
  `packages/web/src/__browser__/{setup.ts,layout.test.tsx}`,
  `packages/server/src/__tests__/{dev,stack}.test.ts`
- Modify: `vite.config.ts` (`defaultPackage: "./packages/web"`, the projects listed),
  `packages/web/vite.config.ts` (the handler mounted, `server` from `.env`, the browser tests left
  out), `packages/server/package.json` (`./dev`; its `dev` script goes), `package.json` (the `dev`
  script goes), `flake.nix` (`playwright-driver.browsers`, `PLAYWRIGHT_BROWSERS_PATH`,
  `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`),
  `packages/web/package.json` (`@vitest/browser-playwright` 5.0.1, `playwright` 1.63.0, the version
  nixpkgs pins), `.gitignore` (`.vitest/`), `packages/web/src/styles.css` (text keeps the page's
  size under Astryx's 14 px body text; list markers)

- [x] **Step 1: Write the failing tests**

- US6.3 / US6.4 in `dev.test.ts`: the config with no `URAEDA_PORT` has `server.port` 4310,
  `server.host` `127.0.0.1`, `strictPort: true`; with `URAEDA_ALLOWED_HOSTS=mac.tail1234.ts.net`,
  `server.allowedHosts` contains it; `URAEDA_REPO` reaches the mounted app.
- SC-007 in `layout.test.tsx`, WebKit at 402 × 874, on the fixture repository: home, a round, a spec
  review, a plan, the priorities: no element clipping its text, by an ellipsis or a hidden overflow,
  unless it scrolls (tables, code); nothing past the screen's right edge; no line clamp;
  `document.documentElement.scrollWidth <= 402`; every paragraph's computed font size ≥ 16 px; every
  question, option, story, and scenario text's left edge ≤ 50 px (ruling R6).
- SC-005: the stylesheet's `pointer: coarse` rule sets Astryx's three element heights to 44 px.
- SC-004: a test reading every `packages/*/package.json` finds no `marked`, `markdown-it`, `remark`,
  `micromark`, `react-markdown`, `mdast`, or `@astryxdesign/core/Markdown` import in
  `packages/*/src`.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/dev.test.ts`
- Expected: FAIL, `Cannot find module …/uraeda-server/src/dev.ts`, imported by the web package's
  config.

- [x] **Step 3: Implement**

- [x] **Step 4: Run all tests**

- Run: `nix develop --command vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add vite.config.ts package.json flake.nix packages pnpm-lock.yaml
git commit -m "feat(web-ui): vp dev at the root, checked at iPhone size"
```

## Task 15: The skill, and the feature's entry

**Files:**

- Modify: `skills/uraeda/SKILL.md` (branches, start, finding the next step: worktrees;
  `.worktrees/`; `ura start --switch`; `ura answer` and `ura review` write in a worktree),
  `README.md` (the web UI, `vp dev`, `.env`), `specs/PRIORITIES.md` (this feature's entry removed,
  in the last commit)
- Test: `crates/cli/tests/skill.rs` (unchanged, passes),
  `ura check skills/uraeda/assets/example/specs`

- [x] **Step 1: Update the skill and the README**

- [x] **Step 2: Run all checks**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add skills README.md specs/PRIORITIES.md
git commit -m "docs(web-ui): worktrees in the skill, and the web UI in the README"
```
