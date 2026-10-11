---
status: approved
spec-revision: 3
---

# Plan: CLI core features

> [!NOTE]
>
> Approved on 2026-10-11, without a review: the human asked in chat to start the implementation
> right after the plan.
>
> - Review focus: a hand-edited file with Windows line endings, a target named by a path from a
>   subfolder, a branch name with a slash, answers containing `**Answer:**`, and a hook that
>   reformats the files `ura` commits.
> - The CI size limit rises to 5 MB, as you accepted for gix's `status` feature.
> - New dependencies: gix (reads), pulldown-cmark, serde_json, sha2, include_dir; tempfile for tests
>   only.
> - The riskiest tasks come late, on tested reads: branch access (task 6), then the actions that
>   commit (tasks 6 to 10).

**Goal:** `ura` reads the whole `specs/` folder across branches, tells where each feature stands and
what comes next, validates the files, records answers and reviews, drafts and starts features, sets
projects up, and ships as a release; the skill names every command.

**Architecture:** the core gets a git module (gix for reads, the `git` binary for writes), parsers
for each workflow file, a workspace model, the step tables, the checks, and the actions; the CLI is
a thin clap layer with text and JSON output. See the [spec's design](spec.md#design).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

1. **A workflow file saved with Windows line endings (`\r\n`)** parses like the same file with `\n`,
   and an edit keeps its `\r\n` endings. Task 2.
2. **A target given as a path from a subfolder** (`ura answer ../specs/2026-10-10-cli-core` run in
   `crates/`) resolves like the same path from the top level. Task 6.
3. **A feature branch checked out under a name with a slash, like `fix/2026-10-14-x`,** is found by
   `status`, and `next` and `review` reach it. Tasks 3 and 7.
4. **An answer whose text contains `**Answer:**` or starts with `#`** is written as given and does
   not create a new answer or heading for the parser: `ura answer` refuses a line starting with `#`
   or `**Answer:**`, with `an answer line cannot start with "#" or "**Answer:**"`. Task 6.
5. **A pre-commit hook that reformats the files `ura` commits** (this repository's `vp check --fix`)
   leaves a clean working tree after `ura` commits, with the reformatted content committed. Task 6.

## Global constraints

From the decisions and the spec, every task's requirements include these:

- "Rust tools MUST read git through gix: references and branches, files at a ref, worktrees, the
  working tree's status, and ancestry." ([git](../decisions/git.md))
- "Tools MUST run the system `git` binary for every write: commits, branch switches, and pushes, and
  for any read gix does not support." ([git](../decisions/git.md))
- "Tools MUST NOT bypass the user's hooks: no `--no-verify`, and no commit written by gix or with
  plumbing to skip them." ([git](../decisions/git.md))
- "In Rust, every git access MUST go through one module of the core, so no other code uses gix or
  builds `git` command lines." ([git](../decisions/git.md))
- "gix MUST be built without its default features, with only those the reads need."
  ([git](../decisions/git.md))
- "Every rule the CLI enforces or checks MUST be written in the skill, `skills/uraeda/`. The CLI
  MUST NOT require anything the skill does not state." ([CLI](../decisions/cli.md))
- "The CLI MUST embed the skill and its templates from `skills/uraeda/` at build time. No second
  copy of a template or a rule MAY live in the code." ([CLI](../decisions/cli.md))
- "Commands that act on a feature, a bug, a draft, or a workflow file MUST take it as one optional
  target argument, resolved the same way everywhere: a path under `specs/`, or a name matching
  exactly one item (a folder name, a slug, or a draft's file name). Without a target, a command MUST
  use the current branch's feature, or the only item waiting for that action, and otherwise exit 1
  listing the candidates. Several matches MUST exit 1 listing them." ([CLI](../decisions/cli.md))
- "Every read command MUST offer `--json`: an object with a top-level `"version"`, increased only
  for incompatible changes." ([CLI](../decisions/cli.md))
- "Commands MUST print data to stdout and messages to stderr, exit 0 on success and 1 on any error,
  validation errors included, except a path not built yet, which MAY stop with `unimplemented!`, and
  print no colour without a terminal or when `NO_COLOR` is set." ([CLI](../decisions/cli.md))
- Every error is one line on stderr, `ura: <message>`. ([spec](spec.md#error-handling))
- Files are written only once every check passed, so a refused action leaves the repository as it
  was. Edits keep every other byte of the file. ([spec](spec.md#error-handling),
  [components](spec.md#components))
- Dates come from `URA_TODAY` (`YYYY-MM-DD`) when set, else the local date. ([spec](spec.md#data))
- JSON field names are kebab-case; `status`, `next`, and `check` print `{ "version": 1, ... }`.
  ([spec](spec.md#data))
- Commit messages: `discovery(<slug>): answer round NN`, `spec(<slug>): approve`,
  `spec(<slug>): request changes`, the same for `plan` and `assessment`,
  `chore(<slug>): start <name>`, `chore(<slug>): proposal`. ([spec](spec.md#assumptions))
- The release build of `ura` stays under 5 MB (SC-002); `.github/workflows/ci.yml` checks
  `-lt 5000000`.
- `vp run ready` passes after every task.

## Code read

- [`crates/cli/src/main.rs`](/crates/cli/src/main.rs): clap 4 derive, one `Status { folder }`
  subcommand calling the temporary module; `ExitCode` from each command.
- [`crates/core/src/temporary_status.rs`](/crates/core/src/temporary_status.rs): frontmatter between
  `---` lines, read with serde-saphyr; `Kind` and allowed statuses; feature folders matched by
  `YYYY-MM-DD-`; napi types behind the `napi` feature. The server's temporary page reads it through
  [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs) and
  [`packages/server/src/temporary-spec-folders.ts`](/packages/server/src/temporary-spec-folders.ts).
- [`crates/core/tests/`](/crates/core/tests/) and [`crates/cli/tests/`](/crates/cli/tests/):
  integration tests with a `common` module; `fixture(path)` points into [`fixtures/`](/fixtures/);
  the CLI tests run `env!("CARGO_BIN_EXE_ura")`.
- [`package.json`](/package.json): `ready` runs `cargo fmt --check`, clippy with `-D warnings`,
  `cargo test --workspace --exclude uraeda-binding`, a check that the CLI has no napi, the binding
  build, `vp check`, `vp test`, and the web build.
- [`vite.config.ts`](/vite.config.ts): the pre-commit hook runs `rustfmt` on staged `.rs` files and
  `vp check --fix` on the others (markdown is reflowed, `proseWrap: always`); `fixtures/**` is
  ignored by the formatter.
- [`.github/workflows/ci.yml`](/.github/workflows/ci.yml): `vp run ready` in the Nix shell, the
  generated-files check, and the 3,000,000-byte limit on `target/release/ura`.
- [`flake.nix`](/flake.nix): a dev shell only, for `aarch64-darwin`, `aarch64-linux`,
  `x86_64-linux`.
- [`Cargo.toml`](/Cargo.toml): workspace dependencies, `publish = false`, version `0.0.0`, release
  profile `opt-level = "z"`, LTO, strip.
- [`skills/uraeda/`](/skills/uraeda/): `SKILL.md`'s step table and status table, the references, the
  templates (optional sections marked `[Optional` in some, "Remove this section" or "UI work only"
  in others), and the example, whose `clarifications-01.md` leaves `Q2.B` blank after a C.
- A spike for this plan, in the release profile: clap, serde-saphyr, pulldown-cmark, serde_json,
  sha2, the embedded skill, and gix with `sha1`, `revision`, and `status` measure 3.40 MB; with
  `index` instead of `status`, 2.48 MB. See
  [R1](rulings.md#r1-gixs-status-feature-and-a-5-mb-limit).

## Constitution check

| Principle                            | Complies | Notes                                                                                          |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | Human statuses change only through `answer` and `review`, run by the human or at their request |
| II. Git and plain text first         | yes      | Every action writes markdown and commits it; review files are markdown                         |
| III. Asynchronous by default         | yes      | Each action ends with a commit; the model is read from git alone                               |
| IV. Review effort matches impact     | yes      | The plan's review was waived by the human in chat                                              |
| V. Tools are optional                | yes      | Task 11 writes every rule `check` enforces into the skill, with its manual instructions        |
| VI. Code is checked against the spec | yes      | One integration test per acceptance scenario and edge case                                     |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Git](../decisions/git.md): the git module of task 1 is the only code that reaches git; gix for
  reads, `git` for `switch` and `commit`.
- [CLI](../decisions/cli.md): targets (task 6), JSON (tasks 3 to 5), exit codes (every task), the
  embedded skill (task 8), the skill's commands (task 11).
- [Stack](../decisions/stack.md): all logic in `crates/core`; the CLI stays Rust only.
- [Toolchain](../decisions/toolchain.md): `ura check` joins `vp run ready` (task 5); the release
  matrix (task 12).

## Complexity tracking

| Abstraction or exception    | Why it is needed                                          | Simpler alternative rejected because             |
| --------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| `Git` wrapper type (task 1) | The git decision requires one module for every git access | Calling gix from each module breaks the decision |

| `Workspace` model (task 3) | `status`, `next`, targets, and actions all read the same data | Each
command reading files itself duplicates the branch logic | | `Place`, where an action writes
(task 6) | `answer`, `review`, `draft`, and `start` reach a branch the same way | Per-action
switching code diverges | | `TestRepo` test helper (task 1) | Every CLI test needs a real repository
with branches and a hook | Shell scripts per test are unreadable |

---

## Task 1: Git module and test repositories

**Files:**

- Modify: `Cargo.toml` (workspace dependencies:
  `gix = { version = "0.89", default-features = false, features = ["sha1", "revision", "status"] }`,
  `tempfile = "3"`)
- Modify: `crates/core/Cargo.toml`, `.github/workflows/ci.yml` (size limit `5000000`)
- Create: `crates/core/src/git.rs`
- Modify: `crates/core/src/lib.rs`
- Create: `crates/core/tests/git.rs`, `crates/core/tests/common/repo.rs`
- Modify: `crates/core/tests/common/mod.rs`

**Interfaces:**

- Produces:
  - `pub struct Git` with `Git::discover(start: &Path) -> Result<Git, GitError>`,
    `Git::open(worktree: &Path) -> Result<Git, GitError>`, `root(&self) -> &Path`.
  - `current_branch(&self) -> Option<String>` (`None` when detached).
  - `default_branch(&self) -> Option<String>`: `refs/remotes/origin/HEAD`'s target without
    `origin/`, else `init.defaultBranch` when that branch exists, else `main`, else `master`.
  - `branches(&self) -> Result<Vec<Branch>, GitError>`;
    `Branch { name: String, local: Option<ObjectId>, remote: Option<ObjectId> }`, remote being
    `origin/<name>`.
  - `tip(&self, branch: &str) -> Option<ObjectId>` (local first, then `origin/`).
  - `read_file(&self, commit: ObjectId, path: &str) -> Result<Option<Vec<u8>>, GitError>` and
    `list_files(&self, commit: ObjectId, dir: &str) -> Result<Vec<String>, GitError>` (recursive,
    paths from the top level).
  - `worktrees(&self) -> Result<Vec<Worktree>, GitError>`;
    `Worktree { path: PathBuf, branch: Option<String> }`, the main worktree first.
  - `changed_files(&self) -> Result<Vec<String>, GitError>`: tracked files differing from `HEAD`,
    staged or not, sorted.
  - `is_ancestor(&self, ancestor: ObjectId, of: ObjectId) -> bool`,
    `behind(&self, local: ObjectId, remote: ObjectId) -> usize`,
    `fetched_at(&self) -> Option<SystemTime>`.
  - Writes, through the `git` binary in `root()`: `switch(&self, branch: &str)`,
    `switch_new(&self, branch: &str, from: &str)`,
    `commit(&self, paths: &[String], subject: &str, body: Option<&str>) -> Result<(), GitError>`.
  - `pub enum GitError { NotARepository(PathBuf), Read(String), Command { subcommand: String, message: String }, GitNotFound }`,
    with `Display` matching the spec's messages: `cannot read <what>: <message>`,
    `git <subcommand> failed: <first line>`, `git not found: install git to commit`,
    `not in a git repository: run git init first`.
  - Test helper `TestRepo` (in `crates/core/tests/common/repo.rs`, reused by the CLI tests through
    `#[path]`): `TestRepo::new() -> TestRepo` (a `main` branch with one commit, `user.name` and
    `user.email` set, a pre-commit hook appending to `.git/hook-runs`), `write(&self, path, text)`,
    `remove(&self, path)`, `commit(&self, message)`, `branch(&self, name)`, `switch(&self, name)`,
    `subjects(&self, branch) -> Vec<String>`, `hook_runs(&self) -> usize`, `path(&self) -> &Path`,
    `add_remote_branch(&self, name)` (a bare `origin` with that branch pushed, then fetched).

- [x] **Step 1: Write the failing tests, and the `TestRepo` helper**

Tests in `crates/core/tests/git.rs`, one per behaviour:

- `discovers_the_top_level_from_a_subfolder`: `Git::discover(repo/"crates")` → `root()` is the
  repository.
- `outside_a_repository`: a temporary folder → `GitError::NotARepository`, displayed as
  `not in a git repository: run git init first`.
- `lists_local_and_remote_branches`: branches `2026-10-10-a` (local) and `2026-10-12-b` (remote
  only) → both listed, with `local` and `remote` set accordingly.
- `default_branch_follows_origin_head`, then `default_branch_falls_back_to_main`.
- `reads_a_file_on_another_branch_without_switching`: `spec.md` written on `2026-10-10-a` only →
  `read_file(tip("2026-10-10-a"), "specs/2026-10-10-a/spec.md")` returns its bytes, and
  `current_branch()` is still `main`.
- `lists_files_under_a_folder`.
- `finds_linked_worktrees`: `git worktree add ../wt 2026-10-10-a` → a `Worktree` with that branch.
- `changed_files_lists_staged_and_unstaged_tracked_files`: modify `README.md`, stage `a.md` →
  `["README.md", "a.md"]`; an untracked file is not listed.
- `changed_files_ignores_a_touched_but_identical_file`: rewrite `README.md` with the same bytes →
  `[]`.
- `commit_runs_the_hook_and_commits_only_the_given_paths`: two modified files, commit one →
  `subjects("main")[0]` is the message, the other file is still changed, `hook_runs() == 1`.
- `commit_reports_a_failing_hook`: a hook exiting 1 with `boom` → `GitError::Command`, displayed
  `git commit failed: boom`.
- `behind_counts_remote_commits`, `is_ancestor_of_a_merged_branch`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test git`
- Expected: FAIL to compile, `unresolved import uraeda_core::git`.

- [x] **Step 3: Implement `crates/core/src/git.rs`**

gix for every read; `changed_files` runs gix's status and keeps the tracked files that differ from
`HEAD` or the index. `commit` refuses when other files are staged, runs `git add -A -- <paths>`,
then `git commit -m <subject> [-m <body>]`, so what the hook reformats is committed
([R7](rulings.md#r7-commits-refuse-other-staged-files)); it never passes `--no-verify`. A missing
`git` binary is `GitError::GitNotFound`.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add Cargo.toml Cargo.lock crates/core
git commit -m "feat(cli-core): git module"
```

## Task 2: Workflow file parsers

**Files:**

- Create: `crates/core/src/files/mod.rs`, `frontmatter.rs`, `markdown.rs`, `clarifications.rs`,
  `plan.rs`, `review.rs`, `priorities.rs`
- Modify: `crates/core/src/temporary_status.rs` (use `files::frontmatter`), `crates/core/Cargo.toml`
  (`pulldown-cmark`)
- Test: `crates/core/tests/files.rs`

**Interfaces:**

- Produces:
  - `frontmatter::parse(text: &str) -> Result<Frontmatter, FrontmatterError>`;
    `Frontmatter { fields: Vec<(String, Value)>, end_line: usize }` with
    `Value::{Text(String), Number(i64), Bool(bool), Other}`;
    `FrontmatterError::{Missing, Unclosed, Yaml(String), NotUtf8}`.
  - `frontmatter::set(text: &str, key: &str, value: &str) -> String`: replaces the line `key: ...`,
    or adds it before the closing `---`.
  - `markdown::Document::parse(text: &str) -> Document` with
    `headings: Vec<Heading { level: u8, text: String, line: usize }>`,
    `links: Vec<Link { target: String, line: usize }>` (markdown links and wikilinks),
    `callout: Option<Callout { kind: CalloutKind::{Important, Note}, first_line: String, start: usize, end: usize }>`
    (the first callout after the title), and `line_count`. Lines are 1-based.
  - `markdown::slug(heading: &str) -> String`: GitHub's anchor slug.
  - `markdown::record_block(text: &str, outcome: &str) -> String`: turns the first `> [!IMPORTANT]`
    callout into `> [!NOTE]` with `outcome` as its first line, items kept.
  - `clarifications::parse(text: &str) -> Vec<Question>`;
    `Question { id: String ("Q2", "Q2.B"), parent: Option<String>, letter: Option<char>, options: Vec<char>, answer: String, answer_line: usize }`;
    `Question::applies(&self, all: &[Question]) -> Applicability::{Yes, No, Unclear}`;
    `clarifications::notes(text) -> Option<(usize, String)>`;
    `clarifications::set_answer(text: &str, id: &str, answer: &str) -> Result<String, AnswerError>`
    (id `notes` writes after `**Notes:**`).
  - `plan::tasks(text: &str) -> Vec<Task { number: u32, title: String, done: usize, total: usize }>`.
  - `review::parse(text: &str) -> Result<Review, ReviewError>`;
    `Review { verdict: Verdict::{Pending, Approved, ChangesRequested}, commit: String, summary: Option<String>, comments: Vec<Comment { number: u32, anchor: Anchor::{Lines(usize, usize, String), General}, quote: Vec<String>, text: String }> }`,
    and `review::render(&Review, title: &str) -> String`.
  - `priorities::parse(text: &str) -> Vec<Entry { section: Section::{Now, Next, Later, Blocked}, position: usize, text: String, link: Option<String>, line: usize }>`,
    and edits `priorities::link(text, line, target) -> String`,
    `priorities::move_to_now(text, line, link_text, target) -> String`,
    `priorities::add_to_now(text, link_text, target) -> String`.

- [x] **Step 1: Write the failing tests**

Table-driven tests in `crates/core/tests/files.rs`, one row per case:

- Frontmatter: valid, missing, unclosed, not YAML, empty, `\r\n` endings (review focus 1); `set` on
  an existing and a missing key keeps every other byte, and keeps `\r\n`.
- Applicability (from the example's answers): "C, we want a simple feature" → Q2.B `No`; "B and C:
  ..." → `.B` and `.C` `Yes`; "A, B" → `Yes`; "We'll see" → `Unclear`; "B" → `Yes`; "-" → `No`.
- `set_answer`: writes after `**Answer:** `, replaces an earlier answer, keeps newlines of a
  multi-paragraph answer, refuses a line starting with `#` or `**Answer:**` (review focus 4).
- `record_block`: the spec's scenario `Answered on 2026-10-11.` on the cli-core clarifications.
- Headings and links with lines; `slug("Q6: How does `ura` run git?")` is `q6-how-does-ura-run-git`;
  `slug("US8: Start a drafted feature (P2)")` is `us8-start-a-drafted-feature-p2`.
- Review files: parse and render round-trip the spec's example; comment heading
  `Lines 50–52, under "US2: Edit a repeat (P1)"`.
- Priorities: this repository's `specs/PRIORITIES.md` gives the cli-core entry in Now, position 1,
  linking `/specs/2026-10-10-cli-core/proposal.md`; `move_to_now` appends the line at the end of
  Now.
- Plan tasks: the example's plan → every task with `done == total`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test files`
- Expected: FAIL to compile, `unresolved import uraeda_core::files`.

- [x] **Step 3: Implement the parsers**

pulldown-cmark with `into_offset_iter()` and
`ENABLE_GFM | ENABLE_TABLES | ENABLE_TASKLISTS | ENABLE_YAML_STYLE_METADATA_BLOCKS | ENABLE_WIKILINKS`;
byte offsets mapped to lines once. Edits are string splices at known lines, so the rest stays byte
for byte; they detect `\r\n` and write lines with it.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS, the temporary status tests included.

- [x] **Step 5: Commit**

```bash
git add crates/core
git commit -m "feat(cli-core): workflow file parsers"
```

## Task 3: Workspace model and `ura status`

**Files:**

- Create: `crates/core/src/workspace.rs`, `crates/core/src/steps.rs`, `crates/core/src/today.rs`
- Create: `crates/cli/src/status.rs`, `crates/cli/src/output.rs`
- Modify: `crates/cli/src/main.rs` (remove the temporary command), `crates/cli/Cargo.toml`
  (`serde_json`)
- Delete: `crates/cli/src/temporary_status.rs`, `crates/cli/tests/temporary_status.rs`
- Test: `crates/cli/tests/status.rs`, `crates/cli/tests/common/mod.rs`

**Interfaces:**

- Consumes: `Git` (task 1), every parser (task 2).
- Produces:
  - `Workspace::read(git: &Git) -> Result<Workspace, CoreError>` and the spec's types
    ([data](spec.md#data)), `Serialize` in kebab-case: `Workspace`, `PriorityEntry`, `Feature`,
    `WorkflowFile`, `Step`, `Problem`. `Feature` also keeps, not serialized, its file texts:
    `text(&self, name: &str) -> Option<&str>`, and `place: FeatureSource`.
  - `steps::step(feature: &Feature, decisions: &[Decision], pr: PullRequest) -> Step`, from the
    skill's tables (spec revision rows included), with `reference` paths
    `skills/uraeda/references/<file>.md`. A feature without a committed `proposal.md` is a
    `human-gate` on `proposal.md`.
  - `today::today() -> Date` (`URA_TODAY`, else the local date from `date +%F`, else the UTC date),
    `Date::parse(&str) -> Option<Date>`, `Date::to_string()` as `YYYY-MM-DD`, `today::rfc3339`, and
    `today::ago` ([R3](rulings.md#r3-the-local-date-from-date)).
  - CLI: `output::print_json(&impl Serialize)`, `output::style(Style::{Bold, Dim}, &str) -> String`
    honouring the terminal and `NO_COLOR`; errors through `output::fail(message) -> ExitCode`.
  - CLI test helper: `common::ura(repo: &TestRepo, args: &[&str]) -> Output` (cwd the repository,
    `URA_TODAY=2026-10-11`, `NO_COLOR=1`, no terminal), and fixture writers
    `common::feature(repo, folder, files: &[(&str, &str)])` with texts built by
    `common::clarifications(status, questions)`, `common::spec(status)`,
    `common::plan(status, tasks)`.

- [x] **Step 1: Write the failing tests**

One test per scenario of US1 and its edge cases, in `crates/cli/tests/status.rs`, each building a
`TestRepo`: `waiting_on_you_across_branches` (US1.1, exact line from the
[mockup](mockups/cli-output.md#ura-status)), `waiting_on_an_agent` (US1.2), `not_started_entry`
(US1.3), `uncommitted_changes_on_the_current_branch` (US1.4), `merged_remote_branch_is_hidden`
(US1.5), `json_has_version_and_features` (US1.6), `behind_its_remote` (`(behind origin by 2)` and
the fetch line), `invalid_files_instead_of_a_step`, `impossible_date_is_skipped`, `no_specs_folder`
(`ura: no specs/ folder at <top level>: run ura init`, exit 1), `branch_with_a_slash` (review focus
3: `fix/2026-10-14-x` listed under **Not in priorities**).

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test status`
- Expected: FAIL, the first test's stdout is clap's `unrecognized subcommand` error.

- [x] **Step 3: Implement**

`Workspace::read`: PRIORITIES and merged features from the default branch's tip; every branch named
`YYYY-MM-DD-<slug>` or `fix/YYYY-MM-DD-<slug>` not merged into the default branch, from its local
tip, else its remote tip; the current branch from the working tree, with `uncommitted` from
`changed_files` under its folder. Decisions from the default branch, overlaid with the branch's own.
`status` prints the [mockup](mockups/cli-output.md#ura-status)'s layout: sections in PRIORITIES
order, then **Not in priorities**.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/cli crates/core
git commit -m "feat(cli-core): ura status"
```

## Task 4: `ura next`

**Files:**

- Create: `crates/cli/src/next.rs`
- Modify: `crates/core/src/steps.rs` (`target`, pull requests), `crates/cli/src/main.rs`
- Test: `crates/cli/tests/next.rs`, `crates/core/tests/steps.rs`

**Interfaces:**

- Consumes: `Workspace`, `steps::step` (task 3).
- Produces: `steps::next_target(ws: &Workspace) -> Option<&Feature>` (the first feature of Now whose
  step waits on an agent), `steps::pull_request(branch: &str) -> PullRequest` (through
  `gh pr list --head <branch> --state all --json state,reviewDecision` when `gh` is on PATH, else
  `Unknown`), and `target::resolve` from task 6 is not needed yet: `next` takes a folder name or
  slug here, and task 6 moves it onto `resolve`.

- [x] **Step 1: Write the failing tests**

- `crates/core/tests/steps.rs`, table-driven: one row per row of the skill's two tables, with the
  feature state and the expected step name, including `spec-revision` (spec `changes-requested`),
  `plan-revision` (plan `spec-revision` lower), `approval` (a linked decision `proposed`, or a
  `## Proposed change (<folder>)` section), `final-review`, and the bug rows.
- `crates/cli/tests/next.rs`: US2.1 to US2.5, with the [mockup](mockups/cli-output.md#ura-next)'s
  text; US2.4 runs with `PATH` lacking `gh`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test next`
- Expected: FAIL, `unrecognized subcommand 'next'`.

- [x] **Step 3: Implement**

`next` prints the step's name, the branch, and `follow <reference>`; `--json` prints
`{ "version": 1, "feature": ..., "step": ... }`, or `"step": "none"` with exit 0.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(cli-core): ura next"
```

## Task 5: `ura check`

**Files:**

- Create: `crates/core/src/check/mod.rs` and one file per rule group: `names.rs`, `frontmatter.rs`,
  `sections.rs`, `answers.rs`, `links.rs`, `reviews.rs`, `blocks.rs`
- Create: `crates/core/src/embedded.rs`, `crates/cli/src/check.rs`
- Modify: `skills/uraeda/assets/templates/specs/**` (every optional section's placeholder starts
  with `[Optional`), `package.json` (`ready` runs `cargo run -q -p uraeda-cli -- check` on `specs`
  and `skills/uraeda/assets/example/specs`), `fixtures/broken/` (expected messages), any file under
  `specs/` or the example that fails
- Test: `crates/core/tests/check.rs`, `crates/cli/tests/check.rs`

**Interfaces:**

- Consumes: the parsers (task 2), `markdown::slug`.
- Produces: `embedded::SKILL: include_dir::Dir` and
  `embedded::template(path: &str) -> Option<&str>`;
  `check::check_folder(specs: &Path) -> Vec<Problem>` and
  `check::check_file(path: &Path) -> Vec<Problem>`, sorted by file and line, each with its `rule`
  id.

The rules, each stated in the skill by task 11:

- `names.folder`: feature and bug folders are `YYYY-MM-DD-<slug>` with a real date; `names.round`:
  rounds are two digits.
- `frontmatter.*`: the file kind's fields only, with their allowed values (the skill's status
  table); `revision` an integer from 1; `clarifications` at most the highest round; `plan-review`
  only with `risk-tier: medium`; `spec-revision` at most the spec's `revision`.
- `sections.missing` and `sections.order`: the template's headings, at their level and in order; a
  heading whose template body starts with `[Optional` may be missing; repeated items follow their
  pattern (`## Q<n>:`, `### Q<n>.<letter>:`, `### US<n>: <title> (P<n>)`, `## Task <n>:`,
  `## R<n>:`, `## C<n>:`).
- `answers.blank`: in an `answered` round, every applicable question has an answer; an `Unclear`
  follow-up is reported with `(may not apply: answer "-" if so)`.
- `blocks.important`: an `awaiting-human` file opens with `> [!IMPORTANT]`; `blocks.note`: an
  answered or approved file has no `> [!IMPORTANT]` block.
- `links.file` and `links.heading`: relative and `/` links resolve to a file, and their anchor to a
  heading of it; wikilinks resolve to a file name in `specs/`.
- `reviews.*`: the review file rules of the [spec](spec.md#data).

- [x] **Step 1: Write the failing tests**

- `crates/core/tests/check.rs`, table-driven: one row per rule with a fixture text and the expected
  problem; the US3 messages exactly (`status "done" is not one of awaiting-human, answered`,
  `Q3 has no answer`, `missing section "## Constitution check"`,
  `no heading "git-backend" in discovery-01.md`); US3.4 (Q2.B not reported).
- `crates/cli/tests/check.rs`: US3.1 (this repository's `specs/`: `specs/: no problems`, exit 0),
  US3.7 (the example, exit 0), `json_lists_problems`, and one test per file of `fixtures/broken/`
  (SC-003).

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test check`
- Expected: FAIL, `unrecognized subcommand 'check'`.

- [x] **Step 3: Implement, then fix the files `ura check` reports in `specs/` and the example**

Templates are read from `embedded::SKILL`; the section rules come from parsing them, `[...]`
headings being patterns. Fixes to existing files go in this task's commit, each a correction to the
skill's rules, never a weakened rule.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS, including the two new `ura check` runs.

- [x] **Step 5: Commit**

```bash
git add crates package.json skills/uraeda/assets fixtures specs
git commit -m "feat(cli-core): ura check"
```

## Task 6: Targets, branch access, and `ura answer`

**Files:**

- Create: `crates/core/src/target.rs`, `crates/core/src/actions/mod.rs`,
  `crates/core/src/actions/place.rs`, `crates/core/src/actions/answer.rs`,
  `crates/cli/src/answer.rs`
- Modify: `crates/cli/src/next.rs` (use `target::resolve`), `crates/cli/src/main.rs`
- Test: `crates/cli/tests/answer.rs`, `crates/cli/tests/targets.rs`

**Interfaces:**

- Consumes: `Workspace`, `Git::{worktrees, changed_files, switch, commit}`, the parsers.
- Produces:
  - `target::resolve(ws: &Workspace, cwd: &Path, target: Option<&str>, purpose: Purpose) -> Result<Target, TargetError>`;
    `Target::{Feature(usize), File(usize, String), Draft(String)}`, indexes into `ws.features`;
    `Purpose::{Answers, Review, Inspect, Start}`; `Workspace.drafts` lists `specs/drafts/` and
    `specs/backlog/`. Messages: `<target> matches 2 items: <a>, <b>`,
    `no feature or draft named <target>`, `several items wait: name one of <a>, <b>`.
  - `place::reach(git: &Git, branch: &str) -> Result<Place, PlaceError>`;
    `Place { root: PathBuf, switched: Option<String> }`: the current worktree when it has the
    branch, another worktree that has it, or a switch when `changed_files()` is empty;
    `cannot switch to <branch>: uncommitted changes in <files>`,
    `detached HEAD: switch to a branch first`.
  - `pub struct Change { paths: Vec<String>, subject: String, body: Option<String> }` returned by
    every action, committed by the CLI through `Git::commit` unless `--no-commit`.
  - `answer::write(place, feature, id: &str, text: &str) -> Result<Written, ActionError>` (no
    commit; `Written { file, answered, total }`) and
    `answer::submit(place, feature, today) -> Result<Change, ActionError>`
    (`Q7 and Q9 have no answer`).

- [x] **Step 1: Write the failing tests**

- `crates/cli/tests/answer.rs`: US4.1 to US4.8 with the spec's values; the hook's run counted after
  the submit (SC-005); `hook_reformatting_leaves_a_clean_tree` (review focus 5: a hook rewriting the
  file then `git add`ing it → `git status --porcelain` empty after `ura`).
- `crates/cli/tests/targets.rs`: `path_from_a_subfolder` (review focus 2), `name_matching_two`,
  `slug_and_folder_name_are_equivalent`, `no_target_uses_the_current_branch`,
  `no_target_with_two_waiting_lists_them`, `next_takes_a_path` (task 4's `next` on `resolve`).

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test answer --test targets`
- Expected: FAIL, `unrecognized subcommand 'answer'`.

- [x] **Step 3: Implement**

`ura answer [target] <question> <text>`, `ura answer [target] --submit [--no-commit]`; a first
argument matching `^(Q\d+(\.[A-Z])?|notes)$` is the question. After a commit, what the hook changed
and staged is in the commit; the test pins it.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(cli-core): ura answer"
```

## Task 7: Review files and `ura review`

**Files:**

- Create: `crates/core/src/actions/review.rs`, `crates/cli/src/review.rs`
- Modify: `crates/cli/src/main.rs`
- Test: `crates/cli/tests/review.rs`

**Interfaces:**

- Consumes: `target::resolve` with `Waiting::Review`, `place::reach`, `review::{parse, render}`,
  `markdown::{Document, record_block}`, `frontmatter::set`, `Git::tip`.
- Produces: `review::reviewed_file(feature, named: Option<&str>) -> Result<String, ActionError>`,
  `review::comment(git, place, feature, file, lines: Option<(usize, usize)>, text) -> Result<Commented, ActionError>`
  (commits nothing),
  `review::approve(place, feature, file, summary: Option<&str>, tier: &Tier, today) -> Result<Change, ActionError>`,
  `review::request_changes(place, feature, file, summary: Option<&str>, today) -> Result<Change, ActionError>`;
  `Frontmatter::raw(key)` reads a value as written, so a commit of digits stays text.

- [x] **Step 1: Write the failing tests**

US5.1 to US5.8 with the spec's exact values: the comment heading, quote, `verdict`, `commit`; the
record lines `Changes requested on 2026-10-11: Name the field` and
`Changes requested on 2026-10-11: 1 comment in spec-review.md.`; the deleted stale review file; the
`risk-tier: medium` with `plan-review: false`; the bug assessment on `fix/2026-10-14-...` (review
focus 3); the auto-approved plan refused. Edge cases: `comment_outside_the_file`
(`spec.md has 400 lines`), `pending_review_of_an_older_version_is_replaced`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test review`
- Expected: FAIL, `unrecognized subcommand 'review'`.

- [x] **Step 3: Implement**

`ura review [target] --comment <N[-M]|general> <text>`,
`--approve [--summary <text>] [--risk-tier <tier>] [--plan-review <bool>]`,
`--request-changes [--summary <text>]`, `--no-commit`. The reviewed file's line numbers and quote
come from its committed version at the branch's tip.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(cli-core): ura review"
```

## Task 8: `ura init` and the embedded skill

**Files:**

- Create: `crates/core/src/actions/init.rs`, `crates/cli/src/init.rs`
- Modify: `crates/core/Cargo.toml` (`sha2`), `crates/cli/src/main.rs`
- Test: `crates/cli/tests/init.rs`

**Interfaces:**

- Consumes: `embedded::SKILL` (task 5), `Git::discover`.
- Produces: `init::run(root: &Path, skill: bool) -> Result<Vec<InitLine>, ActionError>`;
  `InitLine::{Created(String), Kept(String, Option<String>), Updated(String, usize), Linked(String, String)}`.
  The manifest `.agents/skills/uraeda/.ura-manifest` holds `<sha256>  <path>` lines.

- [x] **Step 1: Write the failing tests**

US6.1 to US6.5 with the spec's paths and the [mockup](mockups/cli-output.md#ura-init)'s lines; the
edge case `existing_claude_skill_folder_is_kept`; `manifest_checks_with_sha256sum` (runs
`sha256sum -c .ura-manifest` in the skill folder when `sha256sum` exists).

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test init`
- Expected: FAIL, `unrecognized subcommand 'init'`.

- [x] **Step 3: Implement**

`specs/README.md`, `CONSTITUTION.md`, `PRIORITIES.md` from the templates; the four `.gitkeep` files;
the skill's files from `embedded::SKILL`; the symbolic link `../../.agents/skills/uraeda`. A skill
file is updated when its current hash matches the manifest, kept otherwise.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates Cargo.lock
git commit -m "feat(cli-core): ura init"
```

## Task 9: `ura draft`

**Files:**

- Create: `crates/core/src/actions/draft.rs`, `crates/core/src/slug.rs`, `crates/cli/src/draft.rs`,
  `crates/cli/src/editor.rs`
- Modify: `crates/cli/src/main.rs`
- Test: `crates/cli/tests/draft.rs`, `crates/core/tests/slug.rs`

**Interfaces:**

- Consumes: `priorities::{parse, link}`, `embedded::template`, `place::reach` on the default branch.
- Produces: `slug::from_text(text: &str) -> String` (the spec's rule: lowercase, runs of other
  characters than letters and digits to one hyphen, at most 50 characters cut on a hyphen);
  `draft::run(place, text: &str) -> Result<Drafted, ActionError>` (`Drafted { path, text }`);
  `editor::open(path: &Path) -> bool` (`$VISUAL`, `$EDITOR`, `vi`, through `sh -c`).

- [x] **Step 1: Write the failing tests**

US7.1 to US7.4 (with `EDITOR` set to a script recording its argument, and no terminal for US7.4);
`slug` table: `Git listener process` → `git-listener-process`,
`Basic web UI for _viewing_ the workflow files -> React + Astryx + Fate stack` → cut at 50 on a
hyphen; the edge case `no_editor_found` (`EDITOR` and `VISUAL` unset, `PATH` without `vi` → path
printed).

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test draft`
- Expected: FAIL, `unrecognized subcommand 'draft'`.

- [x] **Step 3: Implement**

The editor opens only when stdin and stdout are terminals and `--no-edit` is not set.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(cli-core): ura draft"
```

## Task 10: `ura start`

**Files:**

- Create: `crates/core/src/actions/start.rs`, `crates/cli/src/start.rs`
- Modify: `crates/cli/src/main.rs`
- Test: `crates/cli/tests/start.rs`

**Interfaces:**

- Consumes: `target::resolve` (`Target::Draft`), `place::reach` on the default branch,
  `Git::{switch_new, commit, branches}`, `priorities::{move_to_now, add_to_now}`, `slug`.
- Produces:
  `start::run(git, ws, draft: &str, slug: Option<&str>, today) -> Result<Started, StartError>`;
  `StartError::Partial { done: Vec<String>, left: Vec<String>, cause: String }` for a failure after
  the first commit.

- [x] **Step 1: Write the failing tests**

US8.1 to US8.10 with the spec's values; the edge cases: `failure_after_the_first_commit` (a hook
failing only on the second commit → the [mockup](mockups/cli-output.md#ura-start)'s `Done:` and
`Left:` lines, exit 1), `other_uncommitted_changes_refuse`, `draft_linked_by_two_lines_refuses`,
`priorities_edits_go_into_the_start_commit`; US8.10 asserts the panic message and exit code 101.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test start`
- Expected: FAIL, `unrecognized subcommand 'start'`.

- [x] **Step 3: Implement**

Every refusal is checked before the first write; the draft is moved with a file rename on the new
branch, its uncommitted content carried by `git switch -c` as an untracked or modified file.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(cli-core): ura start"
```

## Task 11: The skill names the commands

**Files:**

- Modify: `skills/uraeda/SKILL.md`, every file of `skills/uraeda/references/`, the templates
  (`clarifications-01.md`: `**Notes:**`; `plan.md`: optional `## Review comments`), the example (its
  `clarifications-01.md` gets `**Notes:**`), `skills/uraeda/assets/templates/specs/README.md`,
  `specs/README.md`, `README.md`
- Create: `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec-review.md`
- Test: `crates/cli/tests/skill.rs`

**Interfaces:**

- Consumes: every command; `ura check`'s rule list (task 5).

- [x] **Step 1: Write the failing test**

`crates/cli/tests/skill.rs`: `every_command_is_named_in_the_references` (SC-004: each subcommand of
`ura --help` appears as `` `ura <name>`` in `skills/uraeda/`), and
`check_passes_on_the_templates_example_and_specs` (US9's files, through `ura check`).

- [x] **Step 2: Run it to check it fails**

- Run: `cargo test -p uraeda-cli --test skill`
- Expected: FAIL, `ura status` is not named in the references.

- [x] **Step 3: Write the skill changes**

Each step's reference names its command next to the manual instructions (US9.1); the review files
replace `## Changes requested` everywhere (SKILL's status table, coming back to the human, spec,
plan, bug, discovery); approval comments: the plan's `## Review comments`, the implementation's pull
request description (US9.2); a revision's block says how each comment was handled (US9.3); the
manual start leaves `proposal.md` uncommitted for an entry without a draft, and the step table's
first row is the gate on an uncommitted `proposal.md` (US9.4, US9.5); the start writes the entry's
link from the repository root; the setup creates the four folders with `.gitkeep`; `**Notes:**`
(US9.6); every rule of `ura check` (task 5) in words; agents set human statuses with `--no-commit`
and their own commit message.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add skills specs/README.md README.md crates/cli/tests/skill.rs
git commit -m "docs(cli-core): the skill names the commands"
```

## Task 12: Release and install

**Files:**

- Modify: `Cargo.toml` (version `0.1.0`, a `dist` profile inheriting `release`), `flake.nix`
  (`packages.default`)
- Create: `dist-workspace.toml`, `.github/workflows/release.yml` (generated by `dist init`)
- Modify: `README.md` (install), `.github/workflows/ci.yml` (`dist plan` on pull requests)

- [ ] **Step 1: Generate the release workflow**

- Run: `dist init --yes` with targets `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`,
  `x86_64-apple-darwin`, `aarch64-apple-darwin`, installers `shell` and `homebrew`, tap
  `mrtolkien/homebrew-tap`, publish job `homebrew`, packaging `uraeda-cli` only.
- Expected: `dist-workspace.toml` and `.github/workflows/release.yml` written.

- [ ] **Step 2: Check the plan**

- Run: `dist plan`
- Expected: one release, `ura`, four archives and the two installers.

- [ ] **Step 3: Add the Nix package**

`packages.default` with `rustPlatform.buildRustPackage`, `cargoLock.lockFile = ./Cargo.lock`,
`cargoBuildFlags = [ "-p" "uraeda-cli" ]`, `doCheck = false`.

- [ ] **Step 4: Check it builds and runs**

- Run: `nix run . -- --version`
- Expected: `ura 0.1.0`.

- [ ] **Step 5: Run all tests and the size check**

- Run: `vp run ready && cargo build --release -p uraeda-cli && stat -c %s target/release/ura`
- Expected: PASS, and a size under 3000000.

- [ ] **Step 6: Commit**

```bash
git add Cargo.toml Cargo.lock dist-workspace.toml .github flake.nix README.md
git commit -m "build(cli-core): release and install"
```

## Task 13: Hand the TUIs to the next feature

**Files:**

- Create: `specs/drafts/cli-tuis.md`
- Modify: `specs/PRIORITIES.md` (in the pull request's last commit, after merging `main`)

- [ ] **Step 1: Write the draft**

The proposal's TUI parts, quoted as the human wrote them, with links to Q4 and Q12 to Q14 of
[the clarifications](clarifications-01.md) and to the settled TUI libraries and keys.

- [ ] **Step 2: Replace the entry**

Merge `main` into the branch, then replace this feature's **Now** entry with
`- [CLI TUIs](drafts/cli-tuis.md)`, at the same place.

- [ ] **Step 3: Run all tests**

- Run: `vp run ready`
- Expected: PASS, `ura check` included.

- [ ] **Step 4: Commit**

```bash
git add specs/drafts/cli-tuis.md specs/PRIORITIES.md
git commit -m "chore(cli-core): hand the TUIs to the next feature"
```
