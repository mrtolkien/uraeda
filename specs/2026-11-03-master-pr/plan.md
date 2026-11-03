---
status: auto-approved
spec-revision: 1
---

# Plan: "Master" PR

**Goal:** Branches stop writing `PRIORITIES.md` and `INBOX.md`: an agent's note is a note file of
its own that the inbox reads, a merged feature's line stays until `ura clean` removes it, and the
catch-up settles the records' and generated files' conflicts by rule.

**Architecture:** One reader owns where an agent's note shows: `files::inbox::read`, which now takes
the note files beside `INBOX.md` and places each one no note links at the end of its category, as
the line `inbox::add` would write for it (see
[R1](rulings.md#r1-the-inbox-reader-places-agents-notes-as-lines-of-a-joined-text)). Its companion
`inbox::joined` gives the same placement as a text, for the commit bar's diff. One action owns
turning an agent's note into a line, `actions::inbox::agent::linked`, which every action that takes
a note's id calls first ([R2](rulings.md#r2-an-action-on-an-agents-note-writes-its-line-first)).
`ura note --agent` writes the file in its worktree; `ura inbox` prints the reader's result;
`ura clean` removes the merged line as `ura drop` removes a dropped one; the priorities' join gains
`merged` beside `running`. The skill, its templates, and the example change together. See the
[spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A stale id of an agent's note**: the web UI holds an agent's note's id while the file is
   deleted or linked elsewhere. The action refuses with `no note <id>`, writing nothing. Task 2.
2. **An agent's note with the same text as a line**: two notes, one key each; the line's key does
   not change because a file arrived. Task 1.
3. **The commit bar after removing an agent's note without committing**: the change list names it
   `remove "<note>" from the inbox`, and its commit holds the deleted file. Task 2.
4. **`ura clean` of a change**: the line it removes links `specs/changes/<folder>/proposal.md`.
   Task 5.

## Global constraints

- "A feature's or a change's branch MUST NOT write `PRIORITIES.md` or `INBOX.md`. Checked by the
  core's tests." ([git](../decisions/git.md))
- "An agent's inbox note MUST be a note file of its own, written in its own worktree, never on the
  default branch. Checked by the CLI's tests." ([git](../decisions/git.md))
- "Tools MUST remove or delete anything only when a human asks." and "Tools MUST NOT bypass the
  user's hooks, signing, or credentials." ([git](../decisions/git.md)): commits go through
  `commit::commit_only` and `commit::add_alone`, as today.
- "Before version 1.0, a format change MUST NOT keep the old format working: no fallback reading, no
  migration code." and "A feature that changes a format MUST update the templates, examples,
  fixtures, and default-branch files it affects, in the same branch."
  ([compatibility](../decisions/compatibility.md))
- "Every rule the CLI enforces or checks MUST be written in the skill" and "A change to a rule MUST
  update the skill and the CLI in the same change." ([cli](../decisions/cli.md))
- "What commands print MUST be stable for tools to read, with versioned JSON on every read command."
  ([cli](../decisions/cli.md)): `ura inbox --json` prints through `output::json`, with `version`.
- "Rust and TypeScript functions and files MUST stay within limits on length, parameters, and
  nesting." and "A new marker MUST NOT be added unless a human approves it in the plan."
  ([code quality](../decisions/code-quality.md)): 100 lines, 7 arguments, 5 levels.
- "A test of behaviour they replace is rewritten or removed in the task that changes it" and "At the
  `early` stage, a feature MUST test little beyond stored formats, git, security, contracts between
  the project's parts, pure logic with many cases" ([testing](../decisions/testing.md)).
- Exact texts from the spec: the file `specs/notes/<slug>-<words>.md` with `agent: true`,
  `about: <slug>`, `category: <name>`; the commit `chore: add "<note>" to the inbox`; the removal's
  commit `chore: remove "<note>" from the inbox`; `ura clean`'s commit
  `chore(<slug>): remove "<name>" from the priorities`, and its message
  `PRIORITIES.md had uncommitted changes: the line is removed but not committed.`; `ura inbox`
  prints a category's name, then `- [agent] [<slug>] <text>` per note.
- A line of `INBOX.md` linking a note file wins over the file's fields: its marks and category
  ([data model](data-model.md#agents-note-file)).
- After each task: `nix develop -c vp run fast`. Before the push: `nix develop -c vp run ready`
  ([toolchain](../decisions/toolchain.md)).

## Code read

- [`crates/core/src/files/inbox.rs`](/crates/core/src/files/inbox.rs): `parse`, `add` (appends a
  line at the end of a category, creating it at the end of the file), `note_line`, `Note::file`.
- [`crates/core/src/files/inbox/read.rs`](/crates/core/src/files/inbox/read.rs): `read(text)` builds
  `Inbox`, the one shape the web UI, `api::read_inbox`, and `actions::inbox::read` return. Callers:
  `actions/inbox.rs` `of`, `api/outlines.rs` `note_stays`, `cli/src/complete.rs`, core tests.
- [`crates/core/src/actions/inbox.rs`](/crates/core/src/actions/inbox.rs): every action by id
  (`remove`, `remove_and_commit`, `edit`, `outline`, `drop_item`, `category`, `place`), `assembled`,
  `note`; `moves.rs` (`to_proposal`, `under_proposal`, `to_proposal_file`, `into_proposal_line`,
  `into_proposal`) and `image.rs` (`attach_to_note`) take ids too. `note_file::remove_left` deletes
  a note file as committed once no line links it.
- [`crates/core/src/actions/changes.rs`](/crates/core/src/actions/changes.rs): the commit bar diffs
  `INBOX.md` at `HEAD` and now (`Texts.inbox`, `pair`, `note_file`).
- [`crates/core/src/api/inbox_edits.rs`](/crates/core/src/api/inbox_edits.rs): `read_inbox` reads
  the default branch with `on_default` (`api/default_branch.rs`), from its checkout or its tip;
  `Git::list_files(commit, dir)` lists a tree.
- [`crates/core/src/check/notes.rs`](/crates/core/src/check/notes.rs): `layout.unlinked-note`,
  guarded by `an_unlinked_note_file_is_a_warning` in `crates/core/tests/check.rs`.
- [`crates/cli/src/note.rs`](/crates/cli/src/note.rs): `--agent` outside the default branch writes
  in this checkout; tests in `crates/cli/tests/note.rs` (`TestRepo`, `feature_worktree`, `ura_in`).
- [`crates/cli/src/inbox.rs`](/crates/cli/src/inbox.rs) and `main.rs`: `ura inbox` has one
  subcommand, `clean`. `output::json` adds `version`.
- [`crates/core/src/actions/clean.rs`](/crates/core/src/actions/clean.rs), `cli/src/clean.rs`:
  worktree and branch only; `candidates` needs a worktree or a branch left. `actions/drop.rs`
  `remove_from_default` removes a linked line with `priorities::remove_linked` and commits it alone.
  Tests in `crates/cli/tests/clean.rs` (`repo_with_merged`).
- [`crates/core/src/check/links.rs`](/crates/core/src/check/links.rs): a missing link of
  `PRIORITIES.md` into a dated folder is skipped, so a merged line is no problem already.
- [`crates/core/src/workspace/links.rs`](/crates/core/src/workspace/links.rs): `Linked::running()`
  is `None` for a done feature; `join_priorities` fills `ProposalItem.file` and `.running`
  ([`files/priorities.rs`](/crates/core/src/files/priorities.rs)). `view/feature.rs`
  `recorded_pull_request` reads the record's `pull-request`.
- Web: [`lists/PrioritiesList.tsx`](/packages/web/src/lists/PrioritiesList.tsx) (`lookOf`,
  `byRunning`, `outlineOf`, `row`, `open`, `onStart`, `onPromote`),
  [`home/HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx) "Priorities now",
  [`pane/ProposalPane.tsx`](/packages/web/src/pane/ProposalPane.tsx) `Kind`,
  [`home/Recent.tsx`](/packages/web/src/home/Recent.tsx) (a done row: `DoneIcon`, "Merged"),
  [`sidebar/ItemCard.tsx`](/packages/web/src/sidebar/ItemCard.tsx) (`#N` pull request). The inbox's
  web code treats `id` as opaque and never uses `startLine`; Undo of a removal inserts `lines`.
- Server: `fate/sources.ts` `sentPriorities` spreads each proposal, so plain new fields pass
  through. Its tests: `packages/server/src/__tests__/fate.test.ts` (priorities' `file` and
  `running`), `inbox.test.ts`.
- Skill: [`finish.md`](/skills/uraeda/references/finish.md#the-finishing-commit),
  [`implementation.md`](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch),
  [`change.md`](/skills/uraeda/references/change.md),
  [`inbox.md`](/skills/uraeda/references/inbox.md),
  [`projects.md`](/skills/uraeda/references/projects.md),
  [`cli.md`](/skills/uraeda/references/cli.md); the example's `INBOX.md` holds an agent's line;
  `docs/cli.md`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| Abstraction or exception               | Why it is needed                                                               | Simpler alternative rejected because                                       |
| -------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `files::inbox::NoteFile` and `joined`  | the reader, the commit bar, and the actions place an agent's note the same way | each reader placing it alone would drift, as the spec's one reader forbids |
| `actions::inbox::agent::linked`        | the one owner of an agent's note's turn into a line, for every action by id    | handling agents' notes in each action repeats the rule a dozen times       |
| `ProposalItem.merged`, `MergedFeature` | the web's line needs the merged folder and its pull request                    | joining by folder in the web: the line carries no folder today             |

## Test map

The core's tests read texts or a `TestRepo` with real git; the CLI's run the `ura` binary on a
`TestRepo`; the server's run `testApp()` on a fixture repository. New tests: 9, for the spec's 8 key
scenarios and 2 high edge cases, one owning two rows.

| Spec                                                                       | Task | Test                                                                                             |
| -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| US2 2 (shows at the end of its category), more 1, edge: no category        | 1    | `crates/core/tests/inbox.rs` `agents_note_files_show_at_the_end_of_their_category`, rows         |
| Edge: a linked `agent: true` file, the line wins; Review focus 2           | 1    | same test, rows                                                                                  |
| SC-002 (one reader)                                                        | 1    | `crates/core/tests/inbox_actions.rs` `read_inbox_lists_an_agents_note_from_main`                 |
| `layout.unlinked-note` removed                                             | 1    | `an_unlinked_note_file_is_a_warning` removed: it is now a note                                   |
| US2 more 2 (removal deletes the file), Review focus 3                      | 2    | `crates/core/tests/inbox_actions.rs` `removing_an_agents_note_deletes_its_file`                  |
| US2 more 3 (move writes its line), Review focus 1                          | 2    | `crates/core/tests/inbox_actions.rs` `placing_an_agents_note_writes_its_line`                    |
| US2 more 4 (made a proposal)                                               | 2    | none: `to_proposal_file` on the line it writes is the linked note file's path, tested today      |
| Edge: a linked note's file with uncommitted changes stays                  | none | none: `remove_left` keeps it, tested today; the reader then shows it, as task 1's test reads     |
| US2 1, SC-003, more 6 (`-2`)                                               | 3    | `crates/cli/tests/note.rs` `an_agents_note_from_a_feature_worktree_is_a_note_file`, rewritten    |
| Replaced: `an_agents_note_about_a_feature`, `..._a_change_writes_its_slug` | 3    | rewritten to read the file's `about`                                                             |
| US2 3, more 7                                                              | 4    | `crates/cli/tests/inbox.rs` `ura_inbox_prints_the_notes_by_category`, with `--json`              |
| US1 3, more 2, more 3, edge: no line; Review focus 4                       | 5    | `crates/cli/tests/clean.rs` `clean_removes_the_merged_line`, rows                                |
| US1 more 1 (check leaves the link)                                         | none | none: `check/links.rs` skips it today, as `ura check` on this branch's own `PRIORITIES.md` shows |
| US1 2 (the Home shows it merged)                                           | 6    | `packages/server/src/__tests__/fate.test.ts` `a_merged_line_carries_its_folder_and_pull_request` |
| US1 1, US2 2, SC-001 (no conflict)                                         | 7    | none: no tool writes the files on a branch any more; the skill's steps say so, checked in review |
| US3 1, 2; edge: a postponed feature; edge: a record with more than links   | 7    | none: the catch-up's and the postpone's rules are the skill's text                               |
| Edge: an old branch still removing its line                                | 7    | none: the catch-up's rule takes the default branch's `PRIORITIES.md`                             |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Task 1: the reader every later task reads through.
2. Tasks 2, 3, 4, 5, 6, and 7: the inbox's actions, `ura note`, `ura inbox`, `ura clean`, the
   priorities' join, and the skill touch different files. Tasks 2 and 3 each add a `mod` line to
   `crates/core/src/actions/inbox.rs`; tasks 3 and 4 each add tests in `crates/cli/tests/`.

---

## Task 1: The inbox reads agents' note files

**Risky:** it changes the rule every inbox reader shares: where a note shows, and its id.

**Files:**

- Create: `crates/core/src/files/inbox/agent.rs`
- Modify: `crates/core/src/files/inbox.rs` (exports), `crates/core/src/files/inbox/read.rs`
  (`read`), `crates/core/src/actions/inbox.rs` (`assembled`, `read_text`, `of`),
  `crates/core/src/api/inbox_edits.rs` (`read_inbox`), `crates/core/src/api/outlines.rs`
  (`note_stays`), `crates/cli/src/complete.rs`, `crates/core/src/check/mod.rs`
- Delete: `crates/core/src/check/notes.rs`
- Test: `crates/core/tests/inbox.rs`, `crates/core/tests/inbox_actions.rs`,
  `crates/core/tests/check.rs` (remove `an_unlinked_note_file_is_a_warning`), and every caller of
  `inbox::read` in the core's tests

**Interfaces:**

- Produces:
  - `pub struct NoteFile { pub path: String, pub text: String }`: a note file of `specs/notes/`,
    `<name>.md` or `<name>/note.md`, its path from the top level.
  - `pub fn read(text: &str, files: &[NoteFile]) -> Inbox`: as today for `INBOX.md`'s notes, their
    ids, keys, and lines unchanged; then each file no note links, sorted by path, as an `InboxNote`
    with `id` its path, `file` its path, `agent`, `about` (when a slug), and its category from the
    frontmatter, `text` the link markdown `[<title>](notes/<file>)` and `file_title` the title,
    `start_line` and `end_line` 0, `lines` the one line `inbox::note_line` gives for that link with
    its marks, a key unique besides every line's key and `triage`. It shows where
    `inbox::add(text, category, line)` would put that line: at the end of its category, a category
    `INBOX.md` lacks after the file's own, in order, no category after the notes without one.
    `count` and `names` include them. The title is the file's first `# ` heading, else its name.
  - `pub fn joined(text: &str, files: &[NoteFile]) -> String`: `text` with each such line added by
    `inbox::add`, in path order: what the commit bar diffs.
  - `pub fn note_files(list: impl Fn() -> Vec<String>, read: impl Fn(&str) -> Option<String>) -> Vec<NoteFile>`
    or an equivalent pair of readers, one from a directory on disk, one from a commit through
    `Git::list_files(commit, "specs/notes")`: `actions::inbox::read` reads the checkout's,
    `api::read_inbox` the default branch's, from its checkout when it has one, else its tip.
  - `actions::inbox::assembled(text, files, changes, file)` takes the files.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/inbox.rs
/// US2 2, more 1: agents' note files show at the end of their category; a linked file's line wins.
#[test]
fn agents_note_files_show_at_the_end_of_their_category() {
    let inbox = "# Inbox\n\n- Loose\n\n## Deferred fixes\n\n- Human's\n- [Linked](notes/linked.md)\n";
    let file = |path: &str, front: &str, title: &str| NoteFile {
        path: format!("specs/notes/{path}"),
        text: format!("---\n{front}---\n\n# {title}\n"),
    };
    let files = [
        file("feature-state-the-workspace.md", "agent: true\nabout: feature-state\ncategory: Deferred fixes\n", "The workspace record's running"),
        file("linked.md", "agent: true\ncategory: Testing\n", "Linked"),
        file("reading-pass-testing.md", "agent: true\nabout: reading-pass\ncategory: Testing\n", "Human's"),
        file("x-uncategorized/note.md", "agent: true\n", "Uncategorized"),
    ];

    let read = inbox::read(inbox, &files);

    let placed: Vec<(Option<&str>, &str, &str)> = read.categories.iter()
        .flat_map(|c| c.notes.iter().map(move |n| (c.name.as_deref(), n.id.as_str(), n.key.as_str())))
        .collect();
    // rows: (category, id, key) for each note the case adds, picked out by id
    assert_eq!(find(&placed, "specs/notes/feature-state-the-workspace.md"), (Some("Deferred fixes"), "the-workspace-record-s-running"));
    assert_eq!(find(&placed, "specs/notes/x-uncategorized/note.md").0, None); // after "Loose"
    assert_eq!(find(&placed, "specs/notes/reading-pass-testing.md"), (Some("Testing"), "human-s-2"));
    assert_eq!(find(&placed, "note-2").1, "human-s"); // the line keeps its key
    assert_eq!(read.names, ["Deferred fixes", "Testing"]);
    assert_eq!(read.count, 6);
}
```

`find` is a local helper; the implementer writes the rows as they see fit, asserting the category
and order of each file note, that the linked file shows once, as its line, and keys. In
`inbox_actions.rs`, `read_inbox_lists_an_agents_note_from_main` commits a note file on `main`
without a line, reads `api::read_inbox`, and asserts its `id`, `agent`, `about`, `file`, and that
`lines` is `["- [agent] [feature-state] [<title>](notes/<file>)"]`.

The break each test catches:

- Placement: a file shown before the category's lines, or a linked file shown twice.
- Keys: a line's key renumbered when a file with the same text arrives.
- Main: the API reading only `INBOX.md`, so the web UI misses merged agents' notes.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test inbox --test inbox_actions`
- Expected: FAIL to compile, `cannot find struct NoteFile`.

- [x] **Step 3: Implement the reader, its two sources, and the callers**

Add `agent.rs` with `NoteFile`, the agent's note's fields read with `files::frontmatter`, and
`joined`; build `read`'s added notes with the same `inbox_note` it uses for lines, from the line
`joined` adds. Pass the files from `actions::inbox::read_text` (disk, `place.root`), and
`api::read_inbox` (default branch). `note_stays` and `complete.rs` read with `&[]`: neither needs
agents' notes. Remove `check/notes.rs`, its call, and its test: an unlinked note file is an agent's
note. Update every test calling `inbox::read(text)` to `inbox::read(text, &[])`.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core crates/cli/src/complete.rs
git commit -m "feat(master-pr): the inbox reads agents' note files"
```

## Task 2: The inbox's actions on an agent's note

**Risky:** git writes, and a rule every action by id shares.

**Files:**

- Create: `crates/core/src/actions/inbox/agent.rs`
- Create: `crates/core/src/actions/changes/texts.rs` (`Texts`, `INBOX.md` read through `joined`, at
  `HEAD` and now: `changes.rs` would pass the 500-line limit)
- Modify: `crates/core/src/actions/inbox.rs` (each action by id), `actions/inbox/moves.rs`,
  `actions/inbox/image.rs`, `crates/core/src/actions/changes.rs`
- Test: `crates/core/tests/inbox_actions.rs`

**Interfaces:**

- Consumes: `inbox::read(text, files)`, `inbox::joined`, `NoteFile` readers (task 1).
- Produces (see
  [R5](rulings.md#r5-the-actions-on-an-agents-note-run-through-one-wrapper-which-takes-its-line-back)):
  `pub(super) fn acting<T>(place, id, previous: Option<&str>, act: impl FnOnce(&str, Option<&str>) -> Result<T, ActionError>) -> Result<T, ActionError>`:
  for an id naming a note file of `specs/notes/` no line links, refuses `INBOX.md` changed since
  `previous` (`INBOX.md` and the stale message, as `apply`), writes the file's line with
  `inbox::add` at the end of its category, and runs `act` on the line's `note-<n>` id and the new
  hash; `INBOX.md` goes back as it was when `act` refuses, and a category the line made goes once
  the line left it. Any other id runs `act` unchanged. An id naming no such file refuses
  `no note <id>`. `acting_read` is the same for the actions read at a `&str`; `moving`, for
  `category`, `place`, and a drop among the notes, then drops the file's `category` field from its
  frontmatter. `remove` deletes an agent's note's file alone, `INBOX.md` unchanged, and only when
  the file is as `HEAD` has it: an edited or never committed file refuses
  `<path> has uncommitted changes: the note was not removed`, writing nothing. Its commit holds the
  deleted file, and `INBOX.md` only when the file exists. Signatures of the actions do not change.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/inbox_actions.rs
/// US2 more 2: removing an agent's note deletes its file, in `chore: remove "..." from the inbox`.
#[test]
fn removing_an_agents_note_deletes_its_file() {
    let (repo, path) = repo_with_agents_note("The workspace record's running is read by no view");
    let read = api::read_inbox(repo.path()).unwrap();

    api::remove_note_and_commit(repo.path(), &path, &read.hash).unwrap();

    assert!(!repo.path().join(&path).exists());
    assert_eq!(repo.subjects("main")[0], "chore: remove \"The workspace record's running…\" from the inbox");
    assert_eq!(repo.read(INBOX), fixture_text("repo/main/specs/INBOX.md"));
}

/// US2 more 3: a moved agent's note becomes a line linking its file, its `category` dropped; an id
/// whose file is gone is refused.
#[test]
fn placing_an_agents_note_writes_its_line() { /* place at index 0 of "UI": the line
   `- [agent] [feature-state] [<title>](notes/<file>)` is UI's first note, the file has no
   `category:`; then place it again by its old id: Refused("no note specs/notes/...") */ }
```

`repo_with_agents_note` commits the fixture repository with a note file
`specs/notes/feature-state-the-workspace-records-running.md` (`agent: true`, `about: feature-state`,
`category: Deferred fixes`). The removal's case also removes without committing, then asserts the
commit bar's message (`api::commit_message` or the function the commit bar reads, whichever exists)
names `remove "The workspace record's running…" from the inbox`.

The break each test catches:

- Removal: the line written but the file kept, or the file deleted outside the commit.
- Place: the line written at the end of the category instead of the drop, or `category` kept.
- Stale id: the old path writes a second line.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test inbox_actions`
- Expected: FAIL, `Refused("no note specs/notes/feature-state-the-workspace-records-running.md")`.

- [x] **Step 3: Implement `acting` and call it from every action by id, then the commit bar**

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core
git commit -m "feat(master-pr): act on an agent's note as on its line"
```

## Task 3: `ura note --agent` writes a note file

**Files:**

- Create: `crates/core/src/actions/inbox/agent_file.rs`
- Modify: `crates/core/src/actions/inbox.rs` (its `mod` and export), `crates/cli/src/note.rs`
- Test: `crates/cli/tests/note.rs`

**Interfaces:**

- Produces:
  `pub fn agent_note(place: &Place, category: Option<&str>, marks: &Marks, text: &str, commit: bool) -> Result<(String, Noted), ActionError>`:
  writes `specs/notes/<about>-<words>.md`, `-2`, `-3`, ... when taken, as
  [R4](rulings.md#r4-an-agents-note-file-is-named-from-four-words) names it, with the frontmatter
  `agent: true`, `about`, `category` (each only when set), a blank line, and `# <text>`; commits it
  alone with `chore: add "<note>" to the inbox` when `commit`; gives the path. `ura note --agent`
  calls it outside the default branch's checkout, as
  [R3](rulings.md#r3-ura-note---agent-on-the-default-branch-writes-a-line-as-before) says, and
  prints `added to the inbox` or `added to the inbox, not committed`, as today.

- [x] **Step 1: Rewrite the tests of the replaced behaviour**

Rewrite `an_agents_note_from_a_feature_worktree_stays_on_its_branch` as
`an_agents_note_from_a_feature_worktree_is_a_note_file`:
`ura note "The workspace record's running is read by no view" --agent --category "Deferred fixes"`
twice in the worktree of `2026-10-15-add-scratchpad`; assert the first commit changed only
`specs/notes/add-scratchpad-the-workspace-records-running.md`, its text
`---\nagent: true\nabout: add-scratchpad\ncategory: Deferred fixes\n---\n\n# The workspace record's running is read by no view\n`,
the second wrote `...-running-2.md`, `INBOX.md` is unchanged on the branch (SC-003), and `main` has
no new commit. Rewrite `an_agents_note_about_a_feature` and
`an_about_naming_a_change_writes_its_slug` to assert the file's name and `about:` instead of
`INBOX.md`'s line, both from a feature's worktree; the first's old body, on `main`, stays as
`an_agents_note_on_the_default_branch_is_a_line` for
[R3](rulings.md#r3-ura-note---agent-on-the-default-branch-writes-a-line-as-before), and the second
keeps its human note's line on `main`.

The break each test catches: a write to `INBOX.md` on the branch; a second note overwriting the
first; `about` lost.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-cli --test note`
- Expected: FAIL, the commit changed `specs/INBOX.md`.

- [x] **Step 3: Implement**

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core crates/cli
git commit -m "feat(master-pr): an agent's note is a note file of its own"
```

## Task 4: `ura inbox` prints the inbox

**Files:**

- Modify: `crates/cli/src/inbox.rs`, `crates/cli/src/main.rs` (`Inbox` with an optional subcommand
  and `--json`)
- Create: `crates/cli/tests/inbox.rs`

**Interfaces:**

- Consumes: `api::read_inbox(repo)` (task 1).
- Produces: `ura inbox [--json]`. Text: the notes without a category first, then each category's
  name on its own line and its notes, a blank line between groups; a note is `- `, `[agent] ` when
  marked, `[<slug>] ` when about one, and its plain text (a note file's: its title). JSON:
  `{"version": 1, "notes": [{"category": "...", "text": "...", "agent": true, "about": "...", "file": "..."}]}`,
  `null` for an absent value. `ura inbox clean` is unchanged.

- [x] **Step 1: Write the failing test**

`ura_inbox_prints_the_notes_by_category`: a repository with an `INBOX.md` of one line under
"Deferred fixes", and a committed note file about `feature-state` under the same category. Assert
stdout contains
`Deferred fixes\n- Human's note\n- [agent] [feature-state] The workspace record's running is read by no view\n`,
and that `--json`'s note for the file has `"agent": true`, `"about": "feature-state"`, `"file"` its
path. The break: a listing that skips note files, or loses the marks.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-cli --test inbox`
- Expected: FAIL, clap's `requires a subcommand`.

- [x] **Step 3: Implement**

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/cli
git commit -m "feat(master-pr): ura inbox prints the inbox"
```

## Task 5: `ura clean` removes the merged line

**Files:**

- Modify: `crates/core/src/actions/clean.rs` (`clean`, `Did`), `crates/cli/src/clean.rs`
  (`candidates`, `render`)
- Test: `crates/cli/tests/clean.rs`

**Interfaces:**

- Produces: `Did::RemovedLine { name: String, committed: bool }`. `clean` (not on a dry run) reaches
  the default branch with `place::reach`, removes the line linking
  `folder_path(kind, folder)/proposal.md` with `priorities::remove_linked`, and commits
  `specs/PRIORITIES.md` alone as `chore(<slug>): remove "<name>" from the priorities` when it had no
  other change; otherwise it leaves it written, `committed: false`. No line: no `Did`. A dry run
  says it would remove it. `render` prints `removed "<name>" from the priorities`,
  `would remove "<name>" from the priorities`, and, uncommitted,
  `PRIORITIES.md had uncommitted changes: the line is removed but not committed.` `candidates` also
  takes a merged feature whose line is still in the priorities, found by `clean::merged_line` in the
  workspace's priorities; the messages for nothing to clean and for several candidates name the line
  ([R7](rulings.md#r7-ura-clean-names-the-priorities-line-among-what-is-left)). The removal on disk
  is shared with `drop.rs` as `actions::priorities::remove_linked`.

- [x] **Step 1: Write the failing test**

`clean_removes_the_merged_line`, rows over one helper building a merged feature with its line in
Now: (a) a feature: the line leaves, the subject is
`chore(<slug>): remove "<name>" from the priorities`; (b) a change: same, its line linking
`/specs/changes/<folder>/proposal.md`; (c) `PRIORITIES.md` edited first: the line leaves, no new
commit, stdout has the uncommitted message; (d) no line: the priorities' text and `main`'s subjects
unchanged, and the worktree still removed. `a_merged_line_alone_is_something_to_clean`: a merged
feature with only its line left is found by `ura clean` with no target, dry run included. The break:
the line removed without its commit, a change's line missed, the human's edit committed.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c cargo nextest run -p uraeda-cli --test clean`
- Expected: FAIL, the line is still in `PRIORITIES.md`.

- [x] **Step 3: Implement**, sharing the removal with `drop.rs` where it reads simpler.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core crates/cli
git commit -m "feat(master-pr): ura clean removes a merged feature's line"
```

## Task 6: A merged feature's line shows as merged

**Files:**

- Modify: `crates/core/src/workspace/links.rs` (`Linked::merged`, `MergedFeature`,
  `join_priorities`), `crates/core/src/files/priorities.rs` (`ProposalItem.merged`),
  `crates/core/src/view/feature.rs` (`recorded_pull_request` made `pub(crate)`),
  `crates/core/src/workspace.rs` (export), `packages/binding/index.d.ts` and `index.js` (regenerated
  by the build), `packages/web/src/lists/PrioritiesList.tsx`, `packages/web/src/home/HomeHub.tsx`,
  `packages/web/src/pane/ProposalPane.tsx`
- Test: `packages/server/src/__tests__/fate.test.ts`

**Interfaces:**

- Produces: `MergedFeature { folder: String, change: bool, pull_request: Option<PullRequestView> }`,
  napi object, camelCase; `ProposalItem.merged: Option<MergedFeature>` set by `join_priorities` for
  a line whose feature's step is done, the pull request the record's. The web draws such a line with
  the done icon and "Merged", a `#N` mark when it has a pull request, opens `/f/<folder>`, and
  offers no edit in place, no Start, and no Expand; the line pane shows it as merged. Home's
  "Priorities now" row does the same.

- [x] **Step 1: Write the failing test**

`a merged line carries its folder and pull request`: on `fixtureRepo()`, write
`specs/done/2026-10-11-web-ui.md` from the record template with
`pull-request: https://github.com/o/r/pull/12`, delete `specs/2026-10-11-web-ui/` on main, commit,
delete the branch, read the priorities; the line linking `/specs/2026-10-11-web-ui/proposal.md` has
`merged.folder` `2026-10-11-web-ui` and `merged.pullRequest.number` 12, and no `running`. The break:
a done feature's line read as plain text.

- [x] **Step 2: Run it to check it fails**

- Run:
  `nix develop -c vp run --filter uraeda-binding build && nix develop -c vp test packages/server/src/__tests__/fate.test.ts`
- Expected: FAIL, `merged` is undefined.

- [x] **Step 3: Implement the join, then the web's line, row, pane, and Home row**

- [x] **Step 4: Run the task's validation, and review the view in the sandbox**

- Run: `nix develop -c vp run fast`, then `vp run sandbox` with a merged line, in both themes, at a
  phone's and a desktop's width.
- Expected: PASS; the line reads "Merged" with its pull request.

- [x] **Step 5: Commit**

```bash
git add crates packages
git commit -m "feat(master-pr): a merged feature's line shows as merged"
```

## Task 7: The skill, its templates, the example, and the docs

**Files:**

- Modify: `skills/uraeda/references/finish.md` (the finishing commit, mark ready's last line, after
  the merge), `implementation.md` (catch-up: no `PRIORITIES.md` rule but for an old branch; a record
  of `specs/done/` taken from the default branch then `ura check --fix`; a generated file
  regenerated by the build; a record conflict holding more than links is a reason to stop),
  `change.md` (its finish), `inbox.md` (format: agents' note files; capture; organizing by hand: an
  agent's note's remove, move, proposal; the triage reads both; agents' notes), `projects.md`
  (start's "feature branches only remove their own proposal", postpone: the line moves on the
  default branch after the merge), `cli.md` (`ura note --agent`, `ura inbox`, `ura clean`),
  `conventions.md` where it names the branch's writes, `SKILL.md`'s `specs/` tree (`notes/` holds
  agents' notes); `skills/uraeda/assets/example/specs/INBOX.md` and a new
  `skills/uraeda/assets/example/specs/notes/tasks-reappear-completing-a-task-rewrites.md` in place
  of its agent's line; `docs/cli.md`, `docs/specs-folder.md`
- Test: `nix develop -c cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs`, and
  the skill's structural tests in `crates/cli/tests/skill.rs`

- [x] **Step 1: Rewrite the references, the example, and the docs**, each rule of the spec where its
      step reads it, with `ura`'s command beside the manual steps

- [x] **Step 2: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS, and `ura check` on the example reports nothing.

- [x] **Step 3: Commit**

```bash
git add skills docs
git commit -m "docs(master-pr): branches never write the priorities or the inbox"
```
