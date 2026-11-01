---
status: auto-approved
spec-revision: 1
---

# Plan: Moving a file never breaks a link to it

**Goal:** every core move rewrites the links to the moved file across `specs/`, and
`ura check --fix`, or the Fix button of a done feature's page, repairs a link a merge broke, from
git's history, without committing.

**Architecture:** one pure rewrite, one history reader, one relinker, then their callers. See the
[spec's architecture](spec.md#architecture).

- **The link rewrite** ([`files/retarget.rs`](/crates/core/src/files/retarget.rs)) owns a link's
  form after a move: `relink(text, folder, moves)` points each link of a file written in `folder` at
  where its file went, and turns a link to a deleted file into its words. The move types it reads,
  `Move` and `Went`, live in a new `crates/core/src/moves.rs`, shared by the rewrite, the finder,
  and the moves.
- **The move finder** (`moves/history.rs`) owns "where a file went": one `git log` of a commit's
  history, parsed once, paired and chained. It is built lazily, at the first broken link, and
  memoized by repository and tip.
- **The relinker** (`actions/relink.rs`) owns writing the rewrite over every markdown file under a
  folder of a checkout: all files written or none, each file's text before and after, and whether it
  had uncommitted edits. It owns the put back too: a file is put back only while it holds what the
  relinker wrote.
- **The core's moves** each pass their own moves to the relinker, skip the lists they already edit,
  and add the rewritten files to their commit, or leave them for the commit page.
- **The check** ([`check/links.rs`](/crates/core/src/check/links.rs)) asks the finder for each
  broken link, and marks the result `fixable`. **`check::fix`** runs the check, then the relinker
  with the finder's moves, over the checked folder or file. `ura check --fix` and the server's
  `feature.fixLinks` mutation call it.
- **The commit page's list** ([`actions/changes.rs`](/crates/core/src/actions/changes.rs)) finds
  repairs by content: a file of `specs/` whose only change since `HEAD` is link destinations, or
  links turned into their words.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A link inside a code span or a code block** is never rewritten nor unlinked: the rewrite reads
   links through pulldown-cmark, as today. Task 1.
2. **A nested image inside a link to a deleted file**, `[![i](a.png)](/specs/gone.md)`, keeps the
   image: the outer link becomes its text, the image's markdown kept. Task 1.
3. **A link to a folder**, `../2026-10-10-cli-core/`, finished as its record, points at the record.
   Task 2, and task 1 for the form.
4. **A move whose history chains back to its own path** (a file moved away and back) never loops:
   the chain only follows events newer than the one that brought the path. Task 2.
5. **A file that is not UTF-8, or a symbolic link**, under `specs/` is skipped by the relinker,
   never written through. Task 3.
6. **The first open of a done feature's page with a broken link** reads the history once, about 0.5
   seconds on this repository, then the finder's memo answers. Task 8 measures it.
7. **A wikilink to a moved file** is reported, never rewritten. Task 1.

## Global constraints

From the spec, word for word:

- The check's message for a moved file: `no file <path>: it moved to <new path>`; for a finished
  folder: `no file <path>: it became the record <record path>`; for a deleted file:
  `no file <path>: deleted in <7-character commit> (<subject>)`. `<path>` is the link's path as
  written; the new path and the record path are rooted, `/specs/...`. Example:
  `specs/done/2026-10-30-inbox-again.md:88: no file /specs/2026-10-30-proposal-start/proposal.md: it became the record /specs/done/2026-10-30-proposal-start.md`.
- `ura check --fix` prints `fixed <file>: <n> link` or `<n> links` for each file it changed, writes
  without committing, and exits as the check after it: zero when nothing is left. Its JSON adds a
  `fixed` list of files and link counts.
- A link's form is kept: a rooted link stays rooted, a relative one relative, its anchor, title, and
  `<…>` stay.
- A link to a finished folder's question keeps its anchor in the record; any other anchor is
  dropped, and the link points at the record.
- A link to a deleted file keeps its words without the link; an image keeps its alt text.
- Wikilinks are reported, never rewritten.
- A file with uncommitted edits is rewritten in place, and left out of the move's commit.
- A hook's refusal of a move's commit puts back every rewritten file, unless edited since.
- The commit page lists a repair as `- Repair links: <file name>`.
- The Fix button reads "Fix moved links", writes the files, and never commits; it shows for the
  default branch's files only.
- History is read only for a broken link: SC-003, no extra `git` process when clean; SC-004, one
  history read, under 1 second on this repository.
- Two runs of `--fix` from the same tree write identical bytes (SC-005).
- Links outside `specs/` (`README.md`, `docs/`, code comments) are neither rewritten nor checked.

From [Git](../decisions/git.md):

- Tools MUST NOT lose the user's work: no force-removed worktree, no force-push, and no deleted
  branch with commits the default branch lacks. Checked by the core's tests.
- Tools MUST remove or delete anything only when a human asks. Checked by the core's tests.
- Tools MUST NOT bypass the user's hooks, signing, or credentials. Checked by the core's tests.
- Rust tools MUST read git with the gix library, and write through the system `git`, from one module
  of the core. Checked by review.
- Proposal files, note files, and the human's inbox and priorities MUST be written on the default
  branch. Checked by the core's tests.

The history read runs `git log -M` through the system `git`, from the core's git module, as
`numstat_in` in [`git/history.rs`](/crates/core/src/git/history.rs) already runs `git diff -M`: gix
is built without rename detection. The spec settled this in its clarifications; see
[R1](rulings.md#r1-the-history-is-read-through-the-system-git).

From [Problems](../decisions/problems.md):

- A check result MUST count as a feature's problem only when its rule stops the workflow, and as a
  note otherwise. Checked by the core's tests.
- Notes MUST show only on their item's page. Checked by review.
- `ura check` and editors MUST keep reporting every result at its own severity: a note is the web
  UI's reading of an error. Checked by the CLI's tests.

From [CLI](../decisions/cli.md):

- Every rule the CLI enforces or checks MUST be written in the skill, in
  [`skills/uraeda/`](/skills/uraeda/). Checked by review.
- A change to a rule MUST update the skill and the CLI in the same change. Checked by review.
- The skill MUST keep the manual instructions of every step. Checked by review.
- What commands print MUST be stable for tools to read, with versioned JSON on every read command.
  Checked by the CLI's tests.

From [Testing](../decisions/testing.md):

- A test MUST give way to the approved spec, the decisions, and the human's requests: a test of
  behaviour they replace is rewritten or removed in the task that changes it, never kept by bending
  the code. Checked by review.
- A test MUST assert what a caller or a user observes, never how the code does it. Checked by
  review.
- At the `early` stage, a feature MUST test little beyond stored formats, git, security, contracts
  between the project's parts, pure logic with many cases, and the reproduction of each bug fixed.
  Checked by review.
- The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's and a desktop's width. Checked by review.

From [Preview](../decisions/preview.md):

- A spec's mockups, and the named states of views, MUST be stories written with the real components,
  next to them. Checked by review and lint.

From [Documentation](../decisions/documentation.md):

- Reference for users, such as settings, sign-in, and the CLI's commands, MUST live in pages under
  `docs/`. Checked by review.

From [Code quality](../decisions/code-quality.md):

- Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting. Checked by clippy and Oxlint. (100 lines and 7 parameters per Rust function, 5 levels of
  nesting, [`clippy.toml`](/clippy.toml); 500 lines per TypeScript file.)
- A new marker MUST NOT be added unless a human approves it in the plan. Checked by review.

Existing behaviour to preserve: the lists' own rewrites (`retarget`, `moved`, `rebase`, `relocated`)
and their tests in `retarget.rs`; a start's put back of its files on a hook's refusal
([`start/restore.rs`](/crates/core/src/actions/start/restore.rs)); the commit page's lines for the
inbox, the priorities, and proposal and note files
([`changes.rs`](/crates/core/src/actions/changes.rs)).

## Code read

- [`files/retarget.rs`](/crates/core/src/files/retarget.rs): `rewrite` finds every inline link's and
  reference definition's destination through pulldown-cmark and edits only its bytes; `rebased`
  writes a path relative to a folder; `links_to` resolves from `specs/` only. Tests in the file.
- [`check/links.rs`](/crates/core/src/check/links.rs): `check_links` reports `links.file` with
  `no file {path}`; links from `PRIORITIES.md` and `INBOX.md` to a dated folder are excused.
  `exists` reads the tip's tree when `File::tip` is set, else the disk.
- [`check/mod.rs`](/crates/core/src/check/mod.rs): `check`, `check_files`, `check_text`,
  `check_folder_texts` all reach `check_texts`, which builds each `File`. The lazy finder goes in
  `File`.
- [`workspace/problem.rs`](/crates/core/src/workspace/problem.rs): `Problem`, serialized by
  `ura check --json`, built by struct literal in 23 places; [`view.rs`](/crates/core/src/view.rs)
  `ProblemView` is the binding's and the web's.
- [`git/history.rs`](/crates/core/src/git/history.rs): `numstat_in` runs `git diff -M` through
  `output_in`; [`git/status.rs`](/crates/core/src/git/status.rs): `differs_from_head`,
  `as_committed`.
- [`actions/start/commits.rs`](/crates/core/src/actions/start/commits.rs) `move_proposal` returns
  the moves and the texts before; `commit_start` stages `paths` and, on a hook's refusal, calls
  `put_back` ([`start/restore.rs`](/crates/core/src/actions/start/restore.rs)), which returns the
  paths left.
- [`actions/promote.rs`](/crates/core/src/actions/promote.rs): `Move::relink` commits the priorities
  and the moved folder on the default branch with `commit_only`, putting both back on a refusal;
  `Move::run` moves the folder on the branch and commits it with the decisions.
- [`actions/attach.rs`](/crates/core/src/actions/attach.rs): `retarget` (lists, forward), used by
  `into_folder`, `to_folder`, and Discard's `Undo::Converted`; `to_file` (the Undo).
- [`actions/inbox/note_file.rs`](/crates/core/src/actions/inbox/note_file.rs): `to_proposals` and
  `back_to_notes`, the note file's move and its Undo, also Discard's `Undo::Moved`.
- [`actions/inbox/merge.rs`](/crates/core/src/actions/inbox/merge.rs): `merge` holds a `Merged`
  record in memory for `undo`, which puts the note file back.
- [`actions/changes.rs`](/crates/core/src/actions/changes.rs): `gather` builds the commit page's
  lines and paths; `commit` and `discard` use them.
- [`api.rs`](/crates/core/src/api.rs): `check_feature` checks only features read from a working
  tree; done features (`Source::DefaultBranch`) get no notes today. `read_feature` serves the
  feature page.
- [`crates/cli/src/check.rs`](/crates/cli/src/check.rs): `run(target, json)`, the output format.
- [`packages/web/src/feature/Notes.tsx`](/packages/web/src/feature/Notes.tsx) already takes `onFix`
  and reads `fixable`, with its stories `MovedLinks` and `OnABranch`; `FeaturePage.tsx` renders
  `<Notes notes={feature.notes} />`. The server's moves are in
  [`fate/session-moves.ts`](/packages/server/src/fate/session-moves.ts).
- Tests: `crates/core/tests/` with `common::TestRepo` (`write`, `commit`, `git`, `set_hook`,
  `changed_in`, `porcelain`); `crates/cli/tests/`; the server's in `packages/server/src/__tests__/`.
- Validation: `nix develop -c vp run fast` for a task; `nix develop -c vp run ready` before the
  push, which runs `ura check specs` and builds Storybook.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| Unit                                     | Why                                                                    | Simpler alternative rejected                                       |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `moves.rs`, `Move` and `Went`            | one vocabulary for the rewrite, the finder, the six moves, and the fix | a `(from, to)` pair: cannot say a record, a deletion, or an anchor |
| The finder, `moves/history.rs`           | "where a file went" read from git, used by the check and the fix       | git's renames alone: miss the 36% start and the records            |
| The finder's memo, by repository and tip | the feature page and `ura check` each read history once per tip        | no memo: every done feature's page would run `git log`             |
| The relinker, `actions/relink.rs`        | one writer of the rewrite, with put back, for six moves and the fix    | each move walking `specs/` itself: six copies of the same put back |
| `Problem::fixable`                       | the web's button and the JSON say which results the fix reaches        | parsing the message: brittle across wordings                       |

No function or file is grown past a limit by plan; a task that would grow one splits it first.

## Test map

The core's tests run on throwaway git repositories (`TestRepo`), with the system `git` and real
hooks; the rewrite's tests are pure, in `retarget.rs`. The CLI's tests run the built `ura`. The
server's test runs the real binding on a repository. No test of the view: the human reviews it in
the sandbox.

| Spec                                                                  | Task | Test                                                                                       |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| Link form; edge cases: question anchor, other anchor, image, wikilink | 1    | `retarget.rs` `links_follow_their_moves`                                                   |
| Edge case: link to a deleted file (words kept); review focus 1, 2, 7  | 1    | `retarget.rs` `links_follow_their_moves`                                                   |
| Commit page's repair detection                                        | 1    | `retarget.rs` `only_links_changed_reads_link_edits_alone`                                  |
| US2 more 2, edge case: proposal below git's rename threshold          | 2    | `tests/moves.rs` `a_missing_path_is_followed_to_where_it_went`                             |
| US2 more 3, edge case: never existed; review focus 3, 4               | 2    | `tests/moves.rs` `a_missing_path_is_followed_to_where_it_went`                             |
| Edge case: uncommitted edits reported; review focus 5                 | 3    | `actions/relink.rs` unit test `relinks_every_file_and_puts_back_the_unchanged`             |
| US2 1, 2, 3, more 1; SC-001; SC-005                                   | 4    | `tests/move_relinks.rs` `the_six_incidents_are_fixed`                                      |
| `--fix` output and JSON; exit code                                    | 4    | `crates/cli/tests/check.rs` `fix_rewrites_and_reports_each_file`                           |
| SC-003, SC-004                                                        | 4    | none: the finder is built in a `OnceCell` on the first broken link (review); timed in step |
| Problems decision: `links.file` stays a note                          | —    | existing `problem.rs` `BLOCKING` and its tests                                             |
| US1 1, 2, 3; SC-002 for the start; edge case: hook refusal            | 5    | `tests/start_relinks.rs` `a_start_relinks_the_record`                                      |
| US1 more 4; SC-002 for a change made a feature                        | 5    | `tests/promote.rs` row added to the existing default-branch test                           |
| US1 more 1, 2, 3; SC-002 for attach and inbox moves; edge case: Undo  | 6    | `tests/inbox_relinks.rs` `inbox_moves_relink_and_undo_puts_back`                           |
| US1 more 1 (the commit page line); Discard restores a repair          | 7    | `tests/inbox_moves.rs` `a_repair_waits_on_the_commit_page`                                 |
| US4 1, 2, 3                                                           | 8    | `packages/server/src/__tests__/fix-links.test.ts`; view reviewed in the sandbox            |
| US3 1, 2                                                              | 9    | none: rules of the skill, read by review                                                   |
| Edge case: two branches repair the same link                          | 4    | owned by SC-005's determinism assertion                                                    |
| Edge case: `PRIORITIES.md`/`INBOX.md` link to a feature on its branch | —    | existing `check.rs` test of the excused links, unchanged                                   |
| Review focus 6                                                        | 8    | none: measured in step 4 of task 8                                                         |
| Replaced behaviour: moves leaving other files untouched               | 5, 6 | any test met that asserts it is rewritten in the task, named in its commit                 |

## Waves

1. Task 1 alone: the rewrite and the move types, which every later task uses.
2. Tasks 2 and 3: the finder and the relinker, in different files; each adds one `mod` line, to
   `moves.rs` and `actions/mod.rs`.
3. Tasks 4, 5, 6, and 7: the check and the CLI; the start and promote; attach and the inbox moves;
   the commit page. No file in common: task 7 calls `attach::retarget` and `back_to_notes` without
   changing them, and task 6 changes them without touching `changes.rs`.
4. Tasks 8 and 9: the server and the web UI; the skill and the docs.

---

## Task 1: The link rewrite and the move types

**Files:**

- Create: `crates/core/src/moves.rs`
- Modify: `crates/core/src/lib.rs` (`pub mod moves;`), `crates/core/src/files/retarget.rs`

**Interfaces:**

- Produces, in `crate::moves`:

  ```rust
  /// Where a file or folder went, from the top level.
  pub enum Went {
      /// Moved: its new path, and the anchor the link takes instead of its own, for a note merged
      /// into a proposal file's `## Notes`.
      Moved { path: String, anchor: Option<String> },
      /// A finished folder's file, now its record `specs/done/<folder>.md`.
      Record(String),
      /// Deleted, by the commit `commit` (7 characters), whose subject is `subject`.
      Deleted { commit: String, subject: String },
  }
  pub struct Move { pub from: String, pub went: Went }
  ```

  `Move::from` is a file or a folder from the top level; a folder matches every path under it, the
  rest of the path kept after `Moved`'s path. A `from` ending in `#anchor` matches only links with
  that anchor, case-insensitive: the Undo of a merged note. `Went` implements `Display` as the
  check's message tail: `it moved to /<path>`, `it became the record /<path>`,
  `deleted in <commit> (<subject>)`.

- Produces, in `crate::files::retarget`:
  - `pub fn relink(text: &str, folder: &str, moves: &[Move]) -> (String, usize)`: the text written
    in `folder`, from the top level, with each link to a moved file pointing where it went, and the
    number of links changed.
  - `pub fn only_links_changed(then: &str, now: &str) -> bool`: whether `now` differs from `then`
    only by link destinations, or links turned into their words; true when equal. A link added where
    `then` had plain words is a change.

- [x] **Step 1: Write the failing tests**, in `retarget.rs`'s tests module:
      `links_follow_their_moves`, a table of `(text, expected)` for
      `relink(text, "specs/done", moves)` with moves for `specs/proposals/a.md` →
      `specs/2026-11-10-a/proposal.md`, the folder `specs/2026-10-10-cli-core` → record
      `specs/done/2026-10-10-cli-core.md`, and `specs/2026-11-05-dark-mode` deleted. Rows:
  - `[d](../proposals/a.md)` → `[d](../2026-11-10-a/proposal.md)`; rooted
    `[d](/specs/proposals/a.md#why "t")` → `[d](/specs/2026-11-10-a/proposal.md#why "t")`; `<…>`
    kept;
  - `[q](../2026-10-10-cli-core/clarifications-01.md#q6-how-does-ura-run-git)` →
    `[q](2026-10-10-cli-core.md#q6-how-does-ura-run-git)`; `…/discovery-01.md#important-reads` →
    `[q](2026-10-10-cli-core.md)`; `../2026-10-10-cli-core/` → `2026-10-10-cli-core.md`;
  - `[Dark mode](/specs/2026-11-05-dark-mode/proposal.md)` → `Dark mode`;
    `![alt](…/dark-mode/x.png)` → `alt`; `[![i](../x.png)](/specs/2026-11-05-dark-mode/proposal.md)`
    → `![i](../x.png)`;
  - unchanged: `` `[d](../proposals/a.md)` ``, `[[a]]`, `[d](../proposals/b.md)`, a reference
    definition to the deleted folder (see
    [R3](rulings.md#r3-a-reference-definition-to-a-deleted-file-stays)).
  - The count: 2 for a text holding two moved links.

  And `only_links_changed_reads_link_edits_alone`: true for a changed destination, for an unlinked
  link, and for equal texts; false for changed words, a changed link text, and a link added.

  The breaks they catch: a rooted link written relative; a lost anchor or title; a question anchor
  dropped or another anchor kept on a record; a deleted link left, or its words lost; a code span
  rewritten; the commit page taking a human's edit for a repair.

- [x] **Step 2: Run them to check they fail**
  - Run: `nix develop -c cargo nextest run -p uraeda-core retarget`
  - Expected: FAIL to compile, `cannot find function relink`.

- [x] **Step 3: Implement `moves.rs` and `relink`, `only_links_changed`**

  `relink` extends the private `rewrite` so an edit can replace a whole inline link or image with
  its text: the link's text as written, `[…]`'s inner markdown kept, an image's alt. Resolve each
  destination from `folder` with `crate::workspace::resolve`. A `Moved` link is written rooted when
  it was, else relative to `folder` (`rebased(new, "", folder)`), its `?query` and anchor kept
  unless `Moved::anchor` replaces it. A `Record` keeps the anchor only when the linked file is a
  `clarifications-NN.md` and the anchor reads `q<digits>…`. The first matching move wins; moves are
  applied as given, never chained here. `only_links_changed` compares the two texts with each inline
  link and image reduced to its text and each reference definition's destination emptied, and
  requires every link of `now` to have one in `then`, in order, with the same text.

- [x] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS, the existing `retarget.rs` tests included.

- [x] **Step 5: Commit**

  ```bash
  git add crates/core/src/moves.rs crates/core/src/lib.rs crates/core/src/files/retarget.rs
  git commit -m "feat(move-relinks): rewrite links to moved and deleted files"
  ```

## Task 2: The move finder

**Risky:** it reads git's history and decides where a link points, for every repair.

**Files:**

- Create: `crates/core/src/moves/history.rs`, `crates/core/tests/moves.rs`
- Modify: `crates/core/src/moves.rs` (`mod history; pub use history::History;`),
  `crates/core/src/git/history.rs` (the `git log` read), `crates/core/src/git.rs` (exports
  `CommitPaths`)

**Interfaces:**

- Consumes: `Move`, `Went` (task 1).
- Produces:
  - `impl Git { pub fn path_events(&self, tip: ObjectId) -> Result<Vec<CommitPaths>, GitError> }`,
    in `git/history.rs`: one `git log <tip> -M --diff-filter=ADR --name-status -z` over the `specs/`
    folders (the top level's and any nested one, as the example's: the pathspec
    `:(glob)**/specs/**`), newest first, each commit's 7-character id, subject, renames
    `(old, new)`, deleted and added paths.
  - `pub struct History`, in `moves/history.rs`, with
    `pub fn read(git: &Git, tip: ObjectId) -> Result<Arc<History>, GitError>`, memoized: the last
    history read is kept by repository root and tip, and returned again for them;
    `pub fn went(&self, path: &str) -> Option<Went>`, where the file or folder `path`, missing at
    the tip, went, chained to its end; `None` when no commit removed it, or when the chain brings it
    back to its own path.

- [x] **Step 1: Write the failing test** `a_missing_path_is_followed_to_where_it_went`, on a
      `TestRepo` whose commits, made with plain `git`, are: a proposal file edited to about a third
      of its text and moved into a dated folder in one commit; that folder later deleted with
      `specs/done/<folder>.md` added; a rename by `git mv`; a change folder moved to `specs/`; a
      file moved away and back; a dropped folder in a commit `chore(dark-mode): drop Dark mode`.
      Asserts:
  - the proposal file's path → `Went::Record("specs/done/<folder>.md")`, through the start's pairing
    and the finish;
  - the dated folder itself → the same record;
  - the renamed file → `Moved` to its new path; the change's file → `specs/<folder>/<file>`;
  - the dropped folder's proposal → `Deleted` with that commit's 7 characters and subject;
  - `specs/proposals/gone.md` → `None`; the file moved back → `None` (it exists).

  The breaks: git's renames alone (the edited start is lost); a chain stopped at its first move; a
  record taken for a plain move; an endless loop.

- [x] **Step 2: Run it to check it fails**
  - Run: `nix develop -c cargo nextest run -p uraeda-core --test moves`
  - Expected: FAIL to compile, `unresolved import uraeda_core::moves::History`.

- [x] **Step 3: Implement `path_events` and `History`**

  Pairing, per commit, after git's renames:
  - **A finished folder**: a commit adding (or renaming to) `specs/done/<name>.md` makes every path
    it deletes under `specs/<name>/` or `specs/changes/<name>/` a `Record` of it.
  - **A change made a feature**: a deleted `specs/changes/<d>/<rest>` with an added
    `specs/<d>/<rest>` in the same commit is `Moved` there.
  - **A start or a move of a main file**: when exactly one unpaired deleted path is a proposal or
    note file's main file (`specs/proposals/<x>.md`, `…/<x>/proposal.md`, `specs/notes/<x>.md`,
    `…/<x>/note.md`) and exactly one unpaired added path is one, or a dated folder's `proposal.md`,
    they pair.
  - **Otherwise** a deleted path is `Deleted` by that commit.

  `went` finds the newest event removing `path`, follows `Moved` to the new path, and repeats only
  with events newer than the one it came from; a `Record` or `Deleted` ends the chain. A missing
  folder went where its files went, when they all went to one folder or one record: the files the
  last commit removing any of them removed (see
  [R8](rulings.md#r8-a-missing-folder-follows-the-files-its-last-removal-took)).

- [x] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS.

- [x] **Step 5: Commit**

  ```bash
  git add crates/core/src/moves.rs crates/core/src/moves/history.rs crates/core/src/git/history.rs crates/core/tests/moves.rs
  git commit -m "feat(move-relinks): find where a missing file went in git's history"
  ```

## Task 3: The relinker

**Risky:** it writes files the human wrote, frozen records included.

**Files:**

- Create: `crates/core/src/actions/relink.rs`
- Modify: `crates/core/src/actions/mod.rs` (`pub mod relink;`)

**Interfaces:**

- Consumes: `Move` (task 1), `retarget::relink`, `retarget::only_links_changed` (task 1).
- Produces:

  ```rust
  /// A file the relinker rewrote: its path from the top level, its text before and after, the
  /// links it changed, and whether it differed from `HEAD` before, which keeps it out of a commit.
  pub struct Relinked { pub path: String, pub before: String, pub after: String, pub links: usize, pub edited: bool }
  /// Rewrites every markdown file under `under` (a folder or a file, from the top level of `root`)
  /// but `skip`, for `moves`: all written, or none and the error.
  pub fn relink(root: &Path, under: &str, moves: &[Move], skip: &[&str]) -> Result<Vec<Relinked>, ActionError>;
  /// Puts back each file still holding what the relinker wrote: the paths left, changed since.
  pub fn put_back(root: &Path, relinked: &[Relinked]) -> Vec<String>;
  /// The Undo of a move without memory: `moves` reversed by the caller, applied only to the files
  /// whose change since `HEAD` is links alone, so a file edited since keeps its text.
  pub fn relink_back(root: &Path, moves: &[Move], skip: &[&str]) -> Result<Vec<Relinked>, ActionError>;
  ```

  Files are visited in path order, skipping dot-folders, symbolic links, and files that are not
  UTF-8. `edited` is `Git::differs_from_head`; outside a repository it is false.

- [x] **Step 1: Write the failing unit test** `relinks_every_file_and_puts_back_the_unchanged`, in
      `relink.rs`, on a temporary repository with a committed record and an uncommitted edit in a
      second file, both linking a moved proposal file: both are rewritten; the second is `edited`;
      after a hand edit of the first, `put_back` restores the second and returns the first. The
      breaks: a file left with a stale link; an edited file sent into a move's commit; a put back
      over the human's later edit.

- [x] **Step 2: Run it to check it fails**
  - Run: `nix develop -c cargo nextest run -p uraeda-core relink`
  - Expected: FAIL to compile, `cannot find function relink in this scope`.

- [x] **Step 3: Implement the relinker**, writing each file as the rewrite gives it, and restoring
      the written ones when a write fails.

- [x] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS.

- [x] **Step 5: Commit**

  ```bash
  git add crates/core/src/actions/relink.rs crates/core/src/actions/mod.rs
  git commit -m "feat(move-relinks): relink every file of specs/ for a list of moves"
  ```

## Task 4: The check says where a file went, and `ura check --fix`

**Files:**

- Create: `crates/core/tests/move_relinks.rs`, `crates/core/src/check/finder.rs` (the lazy finder,
  `fix`, and `Fixed`), `crates/core/src/check/reviews.rs` (the review file's checks, moved out of
  `mod.rs` to keep it under 500 lines)
- Modify: `crates/core/src/check/mod.rs` (`File`, `check_with`, `check_texts`, re-exports `fix`),
  `crates/core/src/check/links.rs`, `crates/core/src/workspace/problem.rs` (`fixable`), every
  `Problem { … }` literal, `crates/core/src/view.rs` (`ProblemView::fixable`),
  `crates/cli/src/check.rs`, `crates/cli/src/main.rs` (the flag), `crates/cli/tests/check.rs`

**Interfaces:**

- Consumes: `History::read`, `History::went` (task 2); `relink::relink` (task 3).
- Produces:
  - `Problem::fixable: bool`, serialized as `"fixable": true` only when true;
    `ProblemView::fixable: bool` (camelCase in the binding).
  - `pub fn fix(root: &Path, target: &Path) -> Result<Vec<Fixed>, CheckError>` in `check`, with
    `pub struct Fixed { pub file: String, pub links: usize }`: checks `target`, then rewrites the
    files under it for the moves the finder found for its fixable results, and returns each file
    changed, by path.

- [x] **Step 1: Write the failing tests**
  - `the_six_incidents_are_fixed`, in `tests/move_relinks.rs`, on a `TestRepo` replaying the
    incidents with plain `git`: a record `specs/done/2026-10-30-inbox-again.md` linking
    `/specs/2026-10-30-proposal-start/proposal.md` at line 88,
    `../proposals/proposal-start-flow.md`,
    `../2026-10-10-cli-core/clarifications-01.md#q6-how-does-ura-run-git`,
    `[Dark mode](/specs/2026-11-05-dark-mode/proposal.md)`, and `/specs/proposals/gone.md`; then the
    start of `proposal-start-flow.md` edited to about a third, its finish, the finish of `cli-core`,
    and the drop of Dark mode. Asserts the check's message for line 88, exactly as in US2 1, and the
    `deleted in <id> (chore(dark-mode): drop Dark mode)` one; after `fix`: the rewritten
    destinations of US2 2 and more 1, 2, the words `Dark mode` unlinked, `gone.md` still reported,
    `fixed` naming the record, nothing committed (`porcelain` shows the record modified); a second
    `fix` from a reset copy of the tree writes the same bytes.
  - `fix_rewrites_and_reports_each_file`, in `crates/cli/tests/check.rs`: `ura check specs --fix`
    prints `fixed specs/done/<record>.md: 1 link` and exits 0; with `--json`, `fixed` holds
    `{"file": …, "links": 1}`.

  The breaks: a message without where the file went; a fix that commits, or leaves a link; a
  non-deterministic rewrite; the JSON missing `fixed`.

- [x] **Step 2: Run them to check they fail**
  - Run: `nix develop -c cargo nextest run -p uraeda-core --test move_relinks`
  - Expected: FAIL, the line 88 message is `no file /specs/2026-10-30-proposal-start/proposal.md`
    without `: it became the record …`.

- [x] **Step 3: Implement the check's history and `fix`**

  `File` gains a reference to a lazy finder, created once per call of `check`, `check_files`,
  `check_text`, and `check_folder_texts`, holding `root` and the tip (`File::tip`'s, else `HEAD` of
  the repository at `root`), built at the first broken link only; a failed read leaves every message
  as today. `check_links` appends `: {went}` and sets `fixable` when the finder answers. The finder
  keeps the moves it answered, for `fix`. Outside a repository nothing changes.

- [x] **Step 4: Implement `--fix` in the CLI**: `fix` first, its lines printed, then the check as
      today; its JSON object gains `fixed`. Exit as the check after it.

- [x] **Step 5: Run the task's validation**
  - Run: `nix develop -c vp run fast`; then
    `nix develop -c cargo run -q -p uraeda-cli -- check specs` with a broken link added to a record
    by hand, timed with `time`, then the link removed.
  - Expected: PASS; the timed check under 1 second (SC-004).

- [x] **Step 6: Commit**

  ```bash
  git add crates/core crates/cli packages/binding
  git commit -m "feat(move-relinks): ura check says where a file went, and --fix relinks it"
  ```

  (`packages/binding/index.d.ts` only when its build regenerates it for `fixable`.)

## Task 5: A start and a change made a feature relink every file

**Risky:** the start commit and its put back on a hook's refusal, a rule several callers share.

**Files:**

- Modify: `crates/core/src/actions/start/commits.rs`, `crates/core/src/actions/start/mod.rs`,
  `crates/core/src/actions/promote.rs`
- Test: `crates/core/tests/start_relinks.rs` (new), `crates/core/tests/promote.rs`

**Interfaces:**

- Consumes: `relink::relink`, `relink::put_back`, `Relinked` (task 3); `Move`, `Went::Moved` (task
  1).
- Produces: `move_proposal` also returns the start's `Vec<Relinked>`; `commit_start` adds each
  relinked file not `edited` to its paths, and on a hook's refusal `relink::put_back` puts them all
  back while unchanged, naming the others among the paths left.

- [x] **Step 1: Write the failing tests**
  - `a_start_relinks_the_record`, in `tests/start_relinks.rs`: with
    `specs/done/2026-10-10-cli-core.md` linking `[the draft](../proposals/cli-tuis.md)`, a start of
    `cli-tuis.md` as `2026-11-10-cli-tuis` commits the record with
    `[the draft](../2026-11-10-cli-tuis/proposal.md)` (`changed_in`); with a refusing hook, the
    record and the proposal file are back as they were; with an uncommitted edit in the record, the
    link is rewritten, the edit kept, and the record is not in the start commit.
  - In `tests/promote.rs`, the existing test of a change on the default branch gains a record
    linking `/specs/changes/<d>/proposal.md`, asserted to read `/specs/<d>/proposal.md` on the
    default branch and on the branch after the move.

  The breaks: a record left behind; a refused start leaving a rewritten record; the human's edit
  committed with the start.

- [x] **Step 2: Run them to check they fail**
  - Run: `nix develop -c cargo nextest run -p uraeda-core --test start_relinks --test promote`
  - Expected: FAIL, the record still links `../proposals/cli-tuis.md`.

- [x] **Step 3: Relink in the start**: after the moved files' own links, relink `specs` for the
      start's moves (each moved file, and the proposal folder for a folder), skipping
      `specs/PRIORITIES.md`, which the start writes itself, and the moved files, whose links the
      rebase already pointed (see
      [R11](rulings.md#r11-a-start-leaves-its-moved-files-to-the-rebase)). A failed relink is a
      partial failure like the rebase's.

- [x] **Step 4: Relink in a change made a feature**: on the default branch before its commit, and on
      the branch before its commit, for the move of `specs/changes/<d>` to `specs/<d>`, skipping
      `PRIORITIES.md`; the refused default-branch commit puts them back with the rest; on the
      branch, the relinked files join the commit's paths and its `left` instruction.

- [x] **Step 5: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS. A test met that asserts a start or a move leaves another file as it was is
    rewritten to the new behaviour, and named in the commit message's body.

- [x] **Step 6: Commit**

  ```bash
  git add crates/core/src/actions/start crates/core/src/actions/promote.rs crates/core/tests/start_relinks.rs crates/core/tests/promote.rs
  git commit -m "feat(move-relinks): a start and a change made a feature relink every file"
  ```

## Task 6: Attach and the inbox moves relink every file, and their Undo

**Files:**

- Modify: `crates/core/src/actions/attach.rs` (`retarget`, `to_file`),
  `crates/core/src/actions/inbox/note_file.rs` (`to_proposals`, `back_to_notes`),
  `crates/core/src/actions/inbox/merge.rs` (`merge`, `undo`, `Merged`),
  `crates/core/src/files/markdown.rs` (`Document::anchor_list`, the anchors in the headings' order)
- Test: `crates/core/tests/inbox_relinks.rs` (created: task 4 creates `move_relinks.rs` in the same
  wave)

**Interfaces:**

- Consumes: `relink::relink`, `relink::relink_back`, `relink::put_back` (task 3); `Went::Moved` with
  an anchor (task 1).
- Produces: `attach::retarget`, `to_file`, `to_proposals`, and `back_to_notes` keep their
  signatures, and now rewrite every file of `specs/` but the two lists: forward for the move,
  `relink_back` for the Undo. `merge` relinks the note file to
  `Moved { path: <proposal file>, anchor: Some(<subsection's anchor>) }`, and its copied images to
  their copies, and keeps the `Vec<Relinked>` in its `Merged` record; `undo` puts them back while
  unchanged. The merge's relink skips the note file and the proposal file it goes into too
  ([R12](rulings.md#r12-a-merges-relink-skips-the-proposal-file-the-note-went-into)).

- [x] **Step 1: Write the failing test** `inbox_moves_relink_and_undo_puts_back`: a record and
      `specs/ui/flows.md` link a single proposal file, `specs/proposals/inbox-screenshots.md#why`
      rooted; attaching an image rewrites both to `…/inbox-screenshots/proposal.md#why`; a record
      linking `/specs/notes/dark/note.md` reads `/specs/proposals/look.md#dark` after the note goes
      into `look.md`; after that move's Undo, the record links `/specs/notes/dark/note.md` again; a
      note file moved to the proposals, then undone, with the record edited by hand in between,
      keeps the record's text. The breaks: an attach that leaves a stale link; a merged note's link
      without its subsection; an Undo that leaves the moved path, or overwrites a hand edit.

- [x] **Step 2: Run it to check it fails**
  - Run: `nix develop -c cargo nextest run -p uraeda-core --test inbox_relinks`
  - Expected: FAIL, `flows.md` still links `/specs/proposals/inbox-screenshots.md#why`.

- [x] **Step 3: Relink at each move and its Undo**, the lists skipped (each move edits them), a
      failed relink undoing the move as a failed list edit does today.

- [x] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS; tests met that assert a move leaves other files are rewritten, and named in the
    commit message's body.

- [x] **Step 5: Commit**

  ```bash
  git add crates/core/src/actions/attach.rs crates/core/src/actions/inbox crates/core/src/files/markdown.rs crates/core/tests/inbox_relinks.rs specs/2026-11-01-move-relinks
  git commit -m "feat(move-relinks): attach and inbox moves relink every file, and their Undo"
  ```

## Task 7: The commit page lists repairs

**Files:**

- Modify: `crates/core/src/actions/changes.rs` (`gather`, `discard`)
- Test: `crates/core/tests/inbox_moves.rs` (a test added)

**Interfaces:**

- Consumes: `retarget::only_links_changed` (task 1).
- Produces: `changes::list`, `message`, `commit`, and `discard` include each markdown file of
  `specs/` changed since `HEAD` and not already listed, whose change is links alone: its line
  `- Repair links: <file name>`, its subject `repair links in <file name>`, its path in the commit;
  Discard restores it from `HEAD`.

- [ ] **Step 1: Write the failing test** `a_repair_waits_on_the_commit_page`: a committed
      `specs/ui/flows.md` with a link rewritten by hand to another destination, and a committed
      record with a sentence edited: `list` holds `- Repair links: flows.md` and nothing for the
      record; `commit` commits `flows.md` (`changed_in`) and leaves the record uncommitted; a second
      repair then `discard` restores it. The breaks: a repair left out of the commit page, a human's
      edit committed as a repair, a Discard that leaves the repair.

- [ ] **Step 2: Run it to check it fails**
  - Run: `nix develop -c cargo nextest run -p uraeda-core --test inbox_moves`
  - Expected: FAIL, `list` has no `- Repair links: flows.md` line.

- [ ] **Step 3: Implement the repairs in `gather` and `discard`**, reading the changed files with
      `Git::changed_files`, under `specs/`, `.md`, other than the lists and the paths already
      listed.

- [ ] **Step 4: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add crates/core/src/actions/changes.rs crates/core/tests/inbox_moves.rs
  git commit -m "feat(move-relinks): the commit page lists link repairs"
  ```

## Task 8: Fix moved links from a done feature's page

**Files:**

- Modify: `crates/core/src/api.rs` (`check_feature`, `read_feature`, a new `fix_links`),
  `crates/binding/src/moves.rs` (`fix_links`), `packages/binding/index.d.ts` and `index.js` as
  generated, `packages/server/src/fate/session-moves.ts` (`feature.fixLinks`),
  `packages/web/src/feature/FeaturePage.tsx` (`onFix`)
- Test: `packages/server/src/__tests__/fix-links.test.ts`

**Interfaces:**

- Consumes: `check::fix`, `Problem::fixable`, `ProblemView::fixable` (task 4).
- Produces:
  - `pub fn fix_links(repo: &Path, folder: &str) -> Result<FeatureView>` in `api`: reaches the
    default branch's checkout (`place::reach`), runs `check::fix` over the feature's record under
    the repository's write lock, and returns the feature read again. Refused for a feature not on
    the default branch.
  - `read_feature` checks a done feature's record (`Source::DefaultBranch`) in the working tree that
    has the default branch checked out, never creating one; `read_workspace` still skips them, since
    notes show only on their page.
  - The binding's `fixLinks(repo, folder): Promise<FeatureView>`; the server's mutation
    `feature.fixLinks({ folder })`, type `Feature`, through the write queue as `feature.promote`'s
    writes go.
  - `FeaturePage` passes `onFix` to `Notes` when `feature.source === "default-branch"`, calling the
    mutation.

- [ ] **Step 1: Write the failing test** `fix-links.test.ts`: a repository whose record links a
      proposal file started and finished since; `readFeature` gives a note with `fixable: true` and
      the message `… it became the record …`; `feature.fixLinks` rewrites the record, commits
      nothing (`git status` shows it modified, `HEAD` unchanged), returns the feature without the
      note, and the commit list holds `- Repair links: <record file name>`. The breaks: notes
      missing on a done feature; a Fix that commits; a stale view after the Fix.

- [ ] **Step 2: Run it to check it fails**
  - Run: `nix develop -c vp test packages/server/src/__tests__/fix-links.test.ts`
  - Expected: FAIL, the done feature has no notes.

- [ ] **Step 3: Implement the API, the binding, the mutation, and the page's `onFix`**

- [ ] **Step 4: Review in the sandbox**: `vp run sandbox`, a done feature with a moved link, in both
      themes, at a phone's and a desktop's width; press "Fix moved links", then open the commit
      page. Time the first open of that page (review focus 6).

- [ ] **Step 5: Run the task's validation**
  - Run: `nix develop -c vp run fast`
  - Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add crates/core/src/api.rs crates/binding packages/binding packages/server packages/web
  git commit -m "feat(move-relinks): fix moved links from a done feature's page"
  ```

## Task 9: The skill and the docs

**Files:**

- Modify: `skills/uraeda/references/implementation.md` (the catch-up),
  `skills/uraeda/references/finish.md` (`#rewrite-the-links`, the finish's catch-up),
  `skills/uraeda/references/projects.md` (postpone and drop), `skills/uraeda/references/cli.md`
  (`ura check --fix`), `docs/cli.md`

**Interfaces:**

- Consumes: the rules of tasks 1, 2, and 4, as the global constraints state them.

- [ ] **Step 1: Write the rules by hand** in the catch-up of
      [implementation](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch):
      after the rebase, every link of `specs/` that no longer resolves is repaired and committed
      with the catch-up; where a file went (git's renames, a start's single proposal paired with its
      `proposal.md`, a finished folder's record, a change's folder in `specs/`, chained); the link's
      form kept; a question's anchor kept on a record, any other dropped; a deleted file's link
      reduced to its words; a path never in the history left; wikilinks left. With `ura`:
      `ura check --fix`.
- [ ] **Step 2: Point the other steps at it**: the finish keeps its anchor rule for links into its
      own folder, then repairs the rest as the catch-up says; postpone and drop name
      `ura check --fix` after their moves; `cli.md` and `docs/cli.md` describe `--fix`, its output,
      its JSON `fixed`, and its exit code.
- [ ] **Step 3: Run the task's validation**
  - Run: `nix develop -c vp run fast`, and
    `nix develop -c cargo run -q -p uraeda-cli -- check specs`
  - Expected: PASS, `specs/: no problems`.
- [ ] **Step 4: Commit**

  ```bash
  git add skills/uraeda/references docs/cli.md
  git commit -m "docs(move-relinks): the repair of moved links in the skill and the CLI's page"
  ```
