---
status: auto-approved
spec-revision: 1
---

# Plan: Finish feature

**Goal:** A last workflow step that replaces a feature's or a bug's folder with one record in
`specs/done/`, `ura` and the web UI reading those records, `ura clean` for what merged features
leave behind, and the three merged features of this repository finished.

**Architecture:** The record format comes first, with its template, its example, and its checks.
Then the core reads records as finished or merged features, the step table gains the finishing rows,
and the CLI and the web UI show them. `ura clean` is a core action over a few new git calls, with a
thin command on top. The skill's text and the migration of the three features come last, once the
tools can check them. See the [spec's design](spec.md#design).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

Inputs the spec does not mention, most likely to bite a user first. Each gets a test in the task
that owns the code.

1. **`specs/done/.gitkeep`, and any file of `specs/done/` that is not `.md`**, which `ura init`
   creates: it is never read as a record, and `ura check` ignores it. Tasks 1 and 2.
2. **A merged feature whose branch got new commits after the merge, with its folder back**, for
   example a revert pushed after the merge: the record on the default branch wins, the feature is
   `done`, and its branch is a leftover. Task 2.
3. **A bug's worktree at `.worktrees/fix/<folder>`**, one folder deeper than a feature's: it is
   found, shown, and removed, and the empty `.worktrees/fix/` is left as it is. Tasks 2 and 6.
4. **A repository without `origin`**, the case of every local-only project: merged-ness and unmerged
   commits use the local default branch alone, and the message says "not on main". Task 6.
5. **A finished branch whose pull request state is unknown**, without `gh` or offline: the step is
   `pull-request`, waiting on an agent, as for a folder today, never `finish`, which would write the
   record again. Task 3.

## Global constraints

From the decisions and the spec, every task's requirements include these:

- "Rust tools MUST read git through gix: references and branches, files at a ref, worktrees, the
  working tree's status, and ancestry." ([git](../decisions/git.md#rules))
- "Tools MUST run the system `git` binary for every write: commits, worktrees, branch switches,
  branch deletions, and pushes, and for any read gix does not support."
  ([git](../decisions/git.md#rules))
- "Tools MUST remove a worktree or delete a local branch only when a human asks for it, for a
  feature merged into the default branch." ([git](../decisions/git.md#rules))
- "Tools MUST remove only worktrees under `.worktrees/`, with `git worktree remove`, never with
  `--force`." ([git](../decisions/git.md#rules))
- "Tools MUST delete a local branch only once no worktree has it checked out, with `git branch -D`,
  and only when each of its commits is on the local default branch or its remote-tracking branch, or
  has a patch-equivalent commit on one of them, as `git cherry` reports it."
  ([git](../decisions/git.md#rules))
- "Tools MAY run `git worktree prune`, which only drops the records of worktree folders already
  gone." ([git](../decisions/git.md#rules))
- "Tools MUST read whether a worktree has uncommitted or untracked files, or is locked, before
  removing it, and MUST NOT infer it from `git`'s messages." ([git](../decisions/git.md#rules))
- "Tools MUST NOT delete remote branches." ([git](../decisions/git.md#rules))
- "Output of the `git` binary MUST be parsed only in its plumbing, `--porcelain`, or `--format`
  forms, never as text meant for humans." ([git](../decisions/git.md#rules))
- "In Rust, every git access MUST go through one module of the core, so no other code uses gix or
  builds `git` command lines." ([git](../decisions/git.md#rules))
- "Every rule the CLI enforces or checks MUST be written in the skill, `skills/uraeda/`. The CLI
  MUST NOT require anything the skill does not state." ([CLI](../decisions/cli.md#rules))
- "A change to a command's behaviour MUST update the skill in the same change, and a change to a
  skill rule a command follows MUST update the command." ([CLI](../decisions/cli.md#rules))
- "Every read command MUST offer `--json`: an object with a top-level `"version"`, increased only
  for incompatible changes. Adding a field or a value MUST NOT increase it."
  ([CLI](../decisions/cli.md#rules))
- "Commands MUST print data to stdout and messages to stderr, exit 0 on success and 1 on any error,
  validation errors included [...], and print no colour without a terminal or when `NO_COLOR` is
  set." ([CLI](../decisions/cli.md#rules))
- A record is `specs/done/<folder>.md`, named after the feature's or the bug's folder; its title
  starts with `Record: `; its question headings are `#### Q<n>: <the question's heading text>` under
  `### Round <NN>`. ([spec](spec.md#data))
- The step `finish` follows `skills/uraeda/references/finish.md`. ([spec](spec.md#data))
- Every text `ura clean`, `ura status`, and `ura next` print for this feature is the
  [mockup](mockups/cli-output.md)'s, word for word.

## Code read

- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs): `Workspace::read` builds `merged`
  from the folders on the default branch's local tip only, skips every branch whose folder is
  merged, and reads the current branch from disk and every other branch from its worktree or tip.
  `Feature::from_texts` builds a feature from its files, with `path` `specs/<folder>` or
  `specs/bugs/<folder>`; `read_feature` lists the folder's files and sets `proposal_committed`.
  `Reader::folders` only keeps dated folder names.
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): `step` maps a feature's files to the
  skill's table; `after_the_last_step` maps the pull request state; `pull_request` asks
  `gh pr list --head <branch> --state open --json reviewDecision`; `refresh_pull_request` recomputes
  the step when `step.pull_request` is set.
- [`crates/core/src/git.rs`](/crates/core/src/git.rs): `tip` prefers the local branch, then
  `origin`'s; `worktrees` skips worktrees whose folder cannot be opened; `changed_files` excludes
  untracked files; `run` returns no stdout. Every git call lives here.
- [`crates/core/src/check/`](/crates/core/src/check/): `kind_of` chooses the rules by folder and
  name; `sections.rs` reads the template's headings into slots, `Fixed`, `Item` for `Q`, `US`,
  `Task `, `R`, `C`, `Prefix` for a literal start before `[`, and `Free`, and requires every slot
  that is not optional, whatever its parent; `values.rs` lists each kind's fields; `names.rs` lists
  `specs/`'s fixed folders; `links.rs` checks links and anchors with `Document::anchors`, which
  numbers repeated slugs like GitHub.
- [`crates/core/src/target.rs`](/crates/core/src/target.rs): `resolve` matches a path against
  `feature.path` as a prefix, and a name against folders and slugs; `waiting` takes the current
  branch's feature first.
- [`crates/core/src/api.rs`](/crates/core/src/api.rs) and [`view.rs`](/crates/core/src/view.rs):
  `feature_of` matches a path by `feature.path` prefix; `file_view` reads `<feature.path>/<name>`;
  `FeatureView::new` takes the title from the proposal or the report.
- [`crates/core/src/actions/start.rs`](/crates/core/src/actions/start.rs): `taken` checks the
  branches, `specs/<folder>`, and the workspace's features.
  [`init.rs`](/crates/core/src/actions/init.rs) creates `drafts`, `backlog`, `decisions`, and `bugs`
  with a `.gitkeep`.
- [`crates/cli/src/`](/crates/cli/src/): `main.rs` declares the commands with clap; `status.rs`
  groups rows and `describe`s a step; `next.rs` renders the target; `output.rs` has `workspace`,
  `target`, `print_json`, and `fail`.
- Tests: [`crates/core/tests/common/repo.rs`](/crates/core/tests/common/repo.rs), `TestRepo`, a
  temporary repository on `main`, with `push` creating `origin.git`;
  [`texts.rs`](/crates/core/tests/common/texts.rs), workflow file texts; the CLI's tests reuse both
  through [`crates/cli/tests/common/mod.rs`](/crates/cli/tests/common/mod.rs), with `ura`, `specs`,
  `feature`, and `branch_with`. [`check.rs`](/crates/core/tests/check.rs) copies the skill's example
  into an `Example` and breaks it, one row per rule, in `each_rule`; it also checks this repository
  with `this_repository_has_no_problems`. [`steps.rs`](/crates/core/tests/steps.rs) is table-driven.
  The web UI's tests render pages on `fixtureRepo()`, built from
  [`fixtures/repo/`](/fixtures/repo/), in
  [`packages/web/src/__tests__/`](/packages/web/src/__tests__/).
- [`packages/server/src/fate/views.ts`](/packages/server/src/fate/views.ts): `featureDataView` lists
  the feature fields the UI may select.
- [`packages/web/src/FeaturePage.tsx`](/packages/web/src/FeaturePage.tsx) and
  [`labels.ts`](/packages/web/src/labels.ts): the page lists files in workflow order with their
  status, and "not yet" rows for a missing spec and plan.
- Validation: `vp run ready`, from [`package.json`](/package.json), runs `cargo fmt --check`,
  clippy, `cargo test --workspace --exclude uraeda-binding`, `ura check` on `specs` and on the
  example, the binding's build, `vp check`, `vp test`, and the web build.

## Constitution check

| Principle                            | Complies | Notes                                                                                          |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | `ura clean` acts only when run; the migration lands through this feature's pull request.       |
| II. Git and plain text first         | yes      | Records are markdown in git (Task 1); nothing is stored elsewhere.                             |
| III. Asynchronous by default         | yes      | Every finishing state is read from the branch and its pull request (Tasks 2 and 3).            |
| IV. Review effort matches impact     | yes      | The record replaces the folder in the review (Tasks 8 and 9).                                  |
| V. Tools are optional                | yes      | `finish.md` gives every step by hand (Task 8); `ura check` validates records (Task 1).         |
| VI. Code is checked against the spec | yes      | Every acceptance scenario has its test in Tasks 1 to 7; the complexity table lists one module. |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Git](../decisions/git.md): reads through gix, writes and `git log` through `git`, all in `git.rs`
  (Tasks 2 and 6); the cleanup's guards (Task 6).
- [CLI](../decisions/cli.md): `ura clean`'s target rule, flags, output, and exit codes (Task 7); the
  new `--json` fields keep `version` 1 (Task 4); the skill describes `ura clean` (Task 8).
- [Stack](../decisions/stack.md): the logic in the Rust core, the web UI through the binding (Task
  5).
- [Toolchain](../decisions/toolchain.md): `vp run ready` validates every task.

## Complexity tracking

| Abstraction or exception                                   | Why it is needed                                                                                          | Simpler alternative rejected because                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `actions/clean.rs` with `Cleaned`, `Did`, and `Left` types | The CLI prints and the tests assert the same outcomes; the core never prints                              | Printing from the core: the CLI's rule keeps output in `crates/cli`, and tests would parse text |
| `Feature::owns(path)`                                      | A finished feature's files live in the shared `specs/done/`, so a path prefix no longer names one feature | Giving each record its own `path`: `file_view` and the UI build `<path>/<name>` everywhere      |
| `record(kind, title)` in the tests' `texts.rs`             | Core and CLI tests both build records                                                                     | A literal per test: the frontmatter and sections would drift between tests                      |

## Review comments

From [`spec-review.md`](spec-review.md), the spec approved with two comments:

- **C1** ("add the day the feature was finished, and any other relevant info for future readers"):
  the record's frontmatter gains `finished`, required, the date of the finishing commit, and its
  `> [!NOTE]` block keeps the start date, the pull request, and the `git log` command (Task 1). The
  folder's name already holds the start date.
- **C2** ("I'm not sure a line count goal is necessary"): no line limit anywhere. The template's
  placeholders and `finish.md` give each section's purpose and how dense to write it instead (Tasks
  1 and 8), and SC-001's 250 and 750 lines are not checked: Task 9 reports the line counts in its
  commit, as information.

---

## Task 1: The record's template, its example, and its checks

**Files:**

- Create: `skills/uraeda/assets/templates/specs/done/YYYY-MM-DD-feature-slug.md`
- Create: `skills/uraeda/assets/example/specs/done/2026-10-06-recurring-tasks.md`
- Modify: `crates/core/src/workspace.rs` (`FileKind::Record`)
- Modify: `crates/core/src/check/mod.rs` (`Checked::Record`, `kind_of`)
- Modify: `crates/core/src/check/values.rs` (`fields`, `allowed`, the `finished` date)
- Modify: `crates/core/src/check/sections.rs` (`template_path`, children of an absent optional
  section, `check_record_numbering`)
- Modify: `crates/core/src/check/names.rs` (`done` among `specs/`'s fixed folders)
- Modify: `crates/core/src/actions/init.rs` (`done` with its `.gitkeep`)
- Modify: `crates/core/tests/common/texts.rs` (`record`)
- Test: `crates/core/tests/check.rs`, `crates/cli/tests/init.rs`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `FileKind::Record`, serialized `record`, with `statuses()` empty. `FileKind::of` does not return
    it: only a file directly in `specs/done/` is a record, decided by its folder.
  - `check::Checked::Record`, for a `.md` file directly in a folder named `done` whose parent is
    named `specs`.
  - The rule ids `frontmatter.missing` (existing) for `kind` and `finished`, `frontmatter.kind` for
    a value other than `feature` or `bug`, `frontmatter.finished` for a value that is not a real
    `YYYY-MM-DD` date, and `sections.numbering` for record numbering.
  - `texts::record(kind: &str, title: &str) -> String`, a valid record with one round of two
    questions, `#### Q1: Question 1?` and `#### Q2: Question 2?`, `finished: 2026-10-11`, and
    `pull-request: https://github.com/owner/repo/pull/1`; for `kind` `bug`, no `## Questions`.

- [x] **Step 1: Write the template and the example record**

The template, exactly these headings, in this order, each placeholder saying the section's purpose
and how dense to write it, with no line count (C2):

```markdown
---
kind: [feature | bug]
finished: [YYYY-MM-DD: the day of the finishing commit]
pull-request: [Optional: the pull request's URL]
---

# Record: [Feature name]

> [!NOTE]
>
> The record of a merged [feature | bug], not instructions to follow. Started on [YYYY-MM-DD],
> finished on [YYYY-MM-DD], in [its pull request](https://...). Its full files are in git:
> `git log -- specs/YYYY-MM-DD-feature-slug/`.

## What and why

## Behaviour

## Design

## Questions

### Round [NN]

#### Q1: [The question, exactly as its heading was in the questions file]

**Answer:** [...]

#### Notes

## Decisions

## Changes after approval

## Follow-ups
```

Each section's placeholder text: **What and why**, "[Two to four sentences from the proposal or the
report: what it does, for whom, and why.]"; **Behaviour**, "[One line per user story: what users
get, with the rules a later feature must keep. For a bug, the behaviour fixed. Kept true to the
merged code.]"; **Design**, "[The approach in a few sentences, then the main components, each with a
link to its code. For a bug, the root cause and the fix.]"; **Questions**, "[Optional, absent for a
bug: every round, every question with its heading as it was, so links keep their anchors.]";
**Answer**, "[The answer in a sentence: the letters and what they chose, or the human's words,
shortened.]"; **Notes**, "[Optional: the human's notes on the settled points, a sentence each.]";
**Decisions**, "[Optional: each decision the feature made or changed, linked, in a line.]";
**Changes after approval**, "[Optional: the rulings that change behaviour, the spec's revisions
after its approval, and the changes asked on the pull request, one line each.]"; **Follow-ups**,
"[Optional: the deferred minor findings and the work left, one line each.]"

The example record: the recurring tasks feature, from its folder in
`skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/`, `kind: feature`,
`finished: 2026-10-13`, `pull-request: https://github.com/example/todo/pull/42`, with its seven
questions of round 01 under their exact headings, its two decisions linked, its rulings that change
behaviour under **Changes after approval**, and the follow-ups its plan left.

- [x] **Step 2: Write the failing tests**

In `crates/core/tests/check.rs`, rows of `each_rule` on the example's record, with
`const RECORD: &str = "specs/done/2026-10-06-recurring-tasks.md";`:

```rust
("record without kind", |e| e.edit(RECORD, "kind: feature\n", ""),
 format!("{RECORD}: no \"kind\" field")),
("record kind", |e| e.edit(RECORD, "kind: feature", "kind: chore"),
 format!("{RECORD}:2: kind \"chore\" is not one of feature, bug")),
("record finished date", |e| e.edit(RECORD, "finished: 2026-10-13", "finished: 2026-13-01"),
 format!("{RECORD}:3: finished \"2026-13-01\" is not a date: YYYY-MM-DD")),
("record numbering", |e| e.edit(RECORD, "#### Q2: When does", "#### Q3: When does"),
 format!("{RECORD}:{}: Q3 should be Q2", record_line("#### Q3: When does"))),
("record title", |e| e.edit(RECORD, "# Record: ", "# Done: "),
 format!("{RECORD}:6: the title starts with \"Record: \"")),
```

And three tests:

```rust
#[test]
fn a_record_keeps_the_anchors_of_its_questions() {
    let example = Example::new();
    let anchors = |path: &str| Document::parse(&example.read(path)).anchors();
    let record = anchors(RECORD);
    let questions: Vec<String> = Document::parse(&example.read(&format!("{FEATURE}/clarifications-01.md")))
        .headings.iter().filter(|h| h.level == 2 && h.text.starts_with('Q')).map(|h| slug(&h.text)).collect();

    assert_eq!(questions.len(), 7);
    for anchor in questions {
        assert!(record.contains(&anchor), "{anchor}");
    }
}

#[test]
fn a_bug_record_needs_no_questions() {
    let example = Example::new();
    example.write("specs/done/2026-10-14-completed-tasks-reappear.md", &record("bug", "Completed tasks reappear"));

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}

#[test]
fn files_of_done_that_are_not_markdown_are_ignored() {
    let example = Example::new();
    example.write("specs/done/.gitkeep", "");
    example.write("specs/done/notes.txt", "notes");

    assert_eq!(summary(&example.problems()), Vec::<String>::new());
}
```

In `crates/cli/tests/init.rs`, the existing test of the created folders also expects
`specs/done/.gitkeep`.

- [x] **Step 3: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test check`
- Expected: FAIL, `the_example_has_no_problems` first: `specs/done: "done" is not a feature folder`,
  since `specs/done/` is not known yet.

- [x] **Step 4: Implement the record's checks**

- `kind_of(dir, name, any_folder)`: `Checked::Record` when `name` ends with `.md`, `dir` is named
  `done`, and its parent is named `specs`, checked before the workflow folder test.
- `values.rs`: `Checked::Record` has required `kind` and `finished`, optional `pull-request`; `kind`
  is one of `feature`, `bug`; `finished` must parse with `today::Date::parse`, else
  `frontmatter.finished`, "finished \"<value>\" is not a date: YYYY-MM-DD".
- `sections.rs`: `template_path(Checked::Record)` is `done/YYYY-MM-DD-feature-slug.md`. A slot below
  an optional level-2 section is required only when that section is present: record each slot's
  level-2 parent while reading the template, and skip the required check when the parent is optional
  and absent from the document. `check_record_numbering(file, document, problems)`, called for
  `Checked::Record`: under each `### Round NN`, the `#### Q<n>:` headings without a follow-up letter
  are numbered 1, 2, 3, ...; a gap is `sections.numbering`, "Q<found> should be Q<expected>", at its
  line; rounds are numbered `01`, `02`, ..., the same way, "Round <found> should be Round
  <expected>".
- `names.rs`: `done` joins `["drafts", "backlog", "decisions", "bugs"]`.
- `init.rs`: `done` joins the folders created with a `.gitkeep`.
- `texts.rs`: `record(kind, title)`, as in **Produces**.

- [x] **Step 5: Run all tests**

- Run:
  `cargo test --workspace --exclude uraeda-binding && cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs`
- Expected: PASS, and `skills/uraeda/assets/example/specs/: no problems`.

- [x] **Step 6: Commit**

```bash
git add skills/uraeda/assets crates/core crates/cli/tests/init.rs
git commit -m "feat(finish-feature): check records of finished features"
```

## Task 2: Read finished and merged features from their records

**Files:**

- Modify: `crates/core/src/git.rs` (`remote_tip`)
- Modify: `crates/core/src/workspace.rs` (`Reader::records`, `Feature::from_record`,
  `Feature::owns`, `left_worktree`, `left_branch`, `Workspace::read`)
- Modify: `crates/core/src/target.rs` (`by_path` through `Feature::owns`)
- Modify: `crates/core/src/api.rs` (`feature_of` through `Feature::owns`)
- Modify: `crates/core/src/actions/start.rs` (`taken`)
- Test: `crates/core/tests/workspace.rs`, `crates/cli/tests/start.rs`

**Interfaces:**

- Consumes: `FileKind::Record` and `texts::record` (Task 1).
- Produces:
  - `Git::remote_tip(&self, branch: &str) -> Option<ObjectId>`: `refs/remotes/origin/<branch>` only.
  - `Feature::from_record(kind: Kind, folder: &str, text: String) -> Feature`: `path` `specs/done`,
    one `WorkflowFile` named `<folder>.md` of kind `Record`, `branch` `folder_branch(kind, folder)`,
    `proposal_committed` true, and its step from `steps::step`.
  - `Feature::is_finished(&self) -> bool`: it has a `Record` file.
  - `Feature::owns(&self, path: &str) -> Option<&str>`: the file name when `path`, from the top
    level, is one of its files: `<path>/<name>` for a folder, only `specs/done/<folder>.md` for a
    finished feature.
  - `Feature.left_worktree: Option<String>` and `Feature.left_branch: Option<String>`, serialized
    `left-worktree` and `left-branch`, `None` unless the feature is `done`.
  - Merged features: a record or a folder on the local default branch's tip or on
    `origin/<default>`'s, read from the local tip first; a record wins over a folder.

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/workspace.rs`, with a helper
`fn finish(repo: &TestRepo, branch: &str, folder: &str, kind: &str)` that, on `branch`, deletes the
feature's folder, writes `specs/done/<folder>.md` with `record(kind, "Web UI")`, and commits:

```rust
/// US2.1
#[test]
fn a_record_on_the_default_branch_is_a_merged_feature() {
    let repo = repo();
    finish(&repo, FOLDER, FOLDER, "feature");
    repo.git(&["merge", "--quiet", "--no-ff", FOLDER]);
    repo.delete_branch(FOLDER);

    let feature = workspace(&repo).feature(FOLDER).cloned().unwrap();

    assert_eq!(feature.step.name, StepName::Done);
    assert_eq!(feature.files.iter().map(|f| f.name.as_str()).collect::<Vec<_>>(), ["2026-10-11-web-ui.md"]);
    assert_eq!((feature.left_branch, feature.left_worktree), (None, None));
}

/// US2.2
#[test]
fn a_merged_feature_names_its_branch_and_worktree_left() { /* merge, then place::reach the branch */
    // ...
    assert_eq!(feature.left_branch.as_deref(), Some("2026-10-11-web-ui"));
    assert_eq!(feature.left_worktree.as_deref(), Some(".worktrees/2026-10-11-web-ui"));
}

/// US2.4
#[test]
fn a_record_only_on_origin_is_merged() {
    // finish on the branch, push main and the branch, merge on a clone of origin and push it,
    // then `git fetch`: the local main is behind.
    assert_eq!(feature.step.name, StepName::Done);
}

/// US2.5
#[test]
fn a_merged_folder_is_still_done() { /* today's behaviour, kept: merge the branch with its folder */ }

/// Edge case: both a folder and a record on the default branch.
#[test]
fn the_record_wins_over_the_folder() {
    // ...
    assert!(feature.is_finished());
}

/// Review focus 1
#[test]
fn files_of_done_that_are_not_markdown_are_not_features() {
    // commit specs/done/.gitkeep on main
    assert_eq!(workspace(&repo).features.len(), 1);
}

/// Review focus 2
#[test]
fn new_commits_after_the_merge_leave_the_feature_done() {
    // merge the finished branch, then on the branch restore the folder and commit
    assert_eq!(feature.step.name, StepName::Done);
    assert_eq!(feature.left_branch.as_deref(), Some(FOLDER));
}

/// Review focus 3
#[test]
fn a_merged_bugs_worktree_is_one_folder_deeper() {
    assert_eq!(bug.left_worktree.as_deref(), Some(".worktrees/fix/2026-10-14-completed-tasks-reappear"));
}

#[test]
fn a_finished_branch_is_read_from_its_record() {
    let repo = repo();
    finish(&repo, FOLDER, FOLDER, "feature");

    let feature = workspace(&repo).feature(FOLDER).cloned().unwrap();

    assert!(feature.is_finished());
    assert_eq!(feature.branch.as_deref(), Some(FOLDER));
    assert_eq!(feature.owns("specs/done/2026-10-11-web-ui.md"), Some("2026-10-11-web-ui.md"));
    assert_eq!(feature.owns("specs/done/2026-10-10-cli-core.md"), None);
}
```

In `crates/cli/tests/start.rs`, where `ura start`'s tests live:

```rust
#[test]
fn refuses_a_name_a_record_holds() {
    // main has specs/done/2026-10-11-git-listener-process.md; start the draft on 2026-10-11
    assert_eq!(output.stderr, "ura: specs/done/2026-10-11-git-listener-process.md exists: choose another slug with --slug\n");
}
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test workspace`
- Expected: FAIL to compile: `no method named is_finished found for struct Feature`.

- [x] **Step 3: Implement**

- `Git::remote_tip`: as in **Produces**, with gix.
- `Reader::records(from) -> BTreeSet<(Kind, String)>`: each `specs/done/<folder>.md` whose stem is a
  dated folder name, its `kind` from its frontmatter, `feature` when missing or unknown.
- `Workspace::read`: `merged` is the folders and records of the local default tip and of
  `remote_tip(default)`. Each merged feature is read from the local tip when it has the record or
  the folder there, else from the remote tip, preferring the record: `Feature::from_record`,
  `source` `DefaultBranch`, `branch` `None`, step `done`. Its `left_branch` is
  `folder_branch(kind, folder)` when that local branch exists; its `left_worktree` is the worktree
  of `git.worktrees()` whose branch is that one, shown from the main checkout, like `worktree`. A
  branch, or the current checkout, whose folder is absent but whose `specs/done/<folder>.md` exists
  is read with `Feature::from_record`, keeping `branch`, `worktree`, `source`, and `uncommitted` as
  for a folder.
- `target.rs` `by_path` and `api.rs` `feature_of`: match with `Feature::owns`, and a finished
  feature's own path is its record's.
- `start.rs` `taken`: also `root.join("specs/done").join(format!("{folder}.md")).exists()` or the
  workspace's records, with the message "specs/done/<folder>.md exists: choose another slug with
  --slug".

- [x] **Step 4: Run all tests**

- Run: `cargo test --workspace --exclude uraeda-binding`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core
git commit -m "feat(finish-feature): read finished and merged features from their records"
```

## Task 3: The finishing rows of the step table

**Files:**

- Modify: `crates/core/src/steps.rs` (`StepName::Finish`, `PullRequest::Draft`, `step`,
  `feature_step`, `bug_step`, `pull_request`)
- Test: `crates/core/tests/steps.rs`

**Interfaces:**

- Consumes: `Feature::is_finished` and `Feature::from_record` (Task 2).
- Produces:
  - `StepName::Finish`, `as_str` `finish`, waiting on an agent, reference
    `skills/uraeda/references/finish.md`.
  - `PullRequest::Draft`, serialized `draft`; `pull_request(branch)` asks
    `gh pr list --head <branch> --state open --json reviewDecision,isDraft`, and returns `Draft`
    when `isDraft` is true, before looking at `reviewDecision`.
  - The rows, for features and bugs alike, before every other row once the proposal or report is
    committed:

| Files                         | Pull request      | Step                             |
| ----------------------------- | ----------------- | -------------------------------- |
| a record                      | none, or draft    | `finish`, agent                  |
| a record                      | changes requested | `pull-request-changes`, agent    |
| a record                      | open, ready       | `pull-request`, human            |
| a record                      | unknown           | `pull-request`, agent            |
| every step checked (or fixed) | draft             | `finish`, agent                  |
| every step checked (or fixed) | none              | `final-review` (or `fix`), agent |
| every step checked (or fixed) | the others        | as today                         |

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/steps.rs`, a table-driven test over a finished feature, a finished bug, and a
feature with every step checked:

```rust
fn finished_record(kind: Kind) -> Feature {
    Feature::from_record(kind, "2026-10-10-x", record(if kind == Kind::Bug { "bug" } else { "feature" }, "X"))
}

#[test]
fn finishing_rows() {
    let rows = [
        ("record, no pull request", finished_record(Kind::Feature), PullRequest::NoPullRequest, StepName::Finish, WaitsOn::Agent),
        ("record, draft", finished_record(Kind::Feature), PullRequest::Draft, StepName::Finish, WaitsOn::Agent),
        ("record, changes requested", finished_record(Kind::Feature), PullRequest::ChangesRequested, StepName::PullRequestChanges, WaitsOn::Agent),
        ("record, ready", finished_record(Kind::Feature), PullRequest::Open, StepName::PullRequest, WaitsOn::Human),
        ("record, unknown", finished_record(Kind::Feature), PullRequest::Unknown, StepName::PullRequest, WaitsOn::Agent),
        ("checked, draft", feature(Kind::Feature, &finished()), PullRequest::Draft, StepName::Finish, WaitsOn::Agent),
        ("checked, no pull request", feature(Kind::Feature, &finished()), PullRequest::NoPullRequest, StepName::FinalReview, WaitsOn::Agent),
        ("bug record, draft", finished_record(Kind::Bug), PullRequest::Draft, StepName::Finish, WaitsOn::Agent),
        ("bug fixed, draft", feature(Kind::Bug, &fixed()), PullRequest::Draft, StepName::Finish, WaitsOn::Agent),
    ];
    for (name, mut feature, pull_request, expected, waits_on) in rows {
        feature.with_pull_request(pull_request);

        assert_eq!(feature.step.name, expected, "{name}");
        assert_eq!(feature.step.waits_on, waits_on, "{name}");
    }
}

/// US4.3
#[test]
fn a_new_round_after_a_revert_waits_on_the_human() {
    let mut files = finished();
    files.push(("clarifications-02.md", clarifications("awaiting-human", "1 question, about 3 minutes.", &[""])));
    let mut feature = feature(Kind::Feature, &files);

    feature.with_pull_request(PullRequest::Draft);

    assert_eq!(feature.step.name, StepName::HumanGate);
    assert_eq!(feature.step.file.as_deref(), Some("clarifications-02.md"));
}

#[test]
fn finish_follows_its_reference() {
    let mut feature = finished_record(Kind::Feature);
    feature.with_pull_request(PullRequest::Draft);
    assert_eq!(feature.step.reference.as_deref(), Some("skills/uraeda/references/finish.md"));
}
```

`fixed()` is a report and an approved assessment with every step checked, from the existing
`assessment` helper. The existing `pull_request_rows` test keeps its rows.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test steps`
- Expected: FAIL to compile: `no variant named Draft found for enum PullRequest`.

- [x] **Step 3: Implement the rows**

In `step`, once the feature has no problem: a finished feature goes to a new
`finished_step(pull_request)`, the record rows above. In `after_the_last_step`, `Draft` gives
`Finish`. `refresh_pull_request` already recomputes steps whose `pull_request` is set: the record
rows set it.

- [x] **Step 4: Run all tests**

- Run: `cargo test --workspace --exclude uraeda-binding`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core
git commit -m "feat(finish-feature): the finishing rows of the step table"
```

## Task 4: Finished and merged features in `ura status` and `ura next`

**Files:**

- Modify: `crates/cli/src/status.rs` (`describe`)
- Modify: `crates/cli/src/next.rs` (`run`)
- Test: `crates/cli/tests/status.rs`, `crates/cli/tests/next.rs`

**Interfaces:**

- Consumes: `left_worktree`, `left_branch` (Task 2), `StepName::Finish` (Task 3).
- Produces: `status::describe` texts: `finish` for the step `finish`; for `done`, `merged`, then
  `: worktree and branch left, run ura clean`, `: worktree left, run ura clean`, or
  `: branch left, run ura clean` when something is left.
  `status::leftovers(feature: &Feature) -> Option<&'static str>`, `worktree and branch`, `worktree`,
  or `branch`, shared with `next.rs`.

- [ ] **Step 1: Write the failing tests**

In `crates/cli/tests/status.rs`, with a helper in `common/mod.rs`,
`pub fn finish_and_merge(repo: &TestRepo, folder: &str)`, which finishes the feature's branch with a
record and merges it into `main` with `--no-ff`:

```rust
/// US2.1
#[test]
fn a_merged_record_is_done() {
    // ...
    assert_eq!(output.row("2026-10-11-web-ui"), ["2026-10-11-web-ui", "-", "merged"]);
}

/// US2.2
#[test]
fn a_merged_feature_with_leftovers_says_so() {
    // keep the branch, and add its worktree with `git worktree add .worktrees/2026-10-11-web-ui`
    assert_eq!(output.row("2026-10-11-web-ui"), ["2026-10-11-web-ui", "-", "merged: worktree and branch left, run ura clean"]);
    let json: serde_json::Value = serde_json::from_str(&ura(&repo, &["status", "--json"]).stdout).unwrap();
    let feature = json["features"].as_array().unwrap().iter().find(|f| f["folder"] == "2026-10-11-web-ui").unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(feature["left-worktree"], ".worktrees/2026-10-11-web-ui");
    assert_eq!(feature["left-branch"], "2026-10-11-web-ui");
}

/// US1.6
#[test]
fn a_finished_branch_waits_for_its_pull_request() {
    // finish the branch, no gh in PATH: unknown state
    assert_eq!(output.row("2026-10-11-web-ui")[1], "agent");
}
```

In `crates/cli/tests/next.rs`:

```rust
/// US2.3
#[test]
fn leftovers_are_reminded_on_stderr() {
    // ...
    assert_eq!(output.stderr, "ura: 2026-10-11-web-ui is merged, with its worktree and branch left: run ura clean\n");
}
```

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test status --test next`
- Expected: FAIL, `a_merged_feature_with_leftovers_says_so`: the row reads `merged`.

- [ ] **Step 3: Implement**

`describe` and `leftovers` as in **Produces**. `next::run`, after printing its target, prints on
stderr, for each `done` feature with leftovers, in folder order:
`ura: <name> is merged, with its <leftovers> left: run ura clean`, `<name>` from `status::name`. The
JSON output needs no change: the fields come from `Feature`.

- [ ] **Step 4: Run all tests**

- Run: `cargo test --workspace --exclude uraeda-binding`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/cli
git commit -m "feat(finish-feature): show finished features and their leftovers in status and next"
```

## Task 5: Finished features in the web UI

**Files:**

- Modify: `crates/core/src/view.rs` (`FeatureView`: `left_worktree`, `left_branch`, the title)
- Modify: `packages/server/src/fate/views.ts` (`featureDataView`)
- Modify: `packages/web/src/FeaturePage.tsx`
- Modify: `packages/web/src/labels.ts` (`STEPS`, `RANK`)
- Test: `packages/web/src/__tests__/feature.test.tsx`

**Interfaces:**

- Consumes: `Feature::from_record`, `left_worktree`, `left_branch` (Task 2).
- Produces: `FeatureView.left_worktree: Option<String>` and `left_branch: Option<String>`, in
  JavaScript `leftWorktree` and `leftBranch`; a finished feature's `title` is its record's title
  without `Record: `.

- [ ] **Step 1: Write the failing test**

```tsx
/** US2.6 */
test("a merged feature shows its record and what is left", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "--create", "2026-10-09-dark-mode", "main");
  mkdirSync(join(repo, "specs/done"), { recursive: true });
  writeFileSync(join(repo, "specs/done/2026-10-09-dark-mode.md"), record("Dark mode"));
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "finish(dark-mode): dark mode");
  git(repo, "switch", "--quiet", "main");
  git(repo, "merge", "--quiet", "--no-ff", "--no-edit", "2026-10-09-dark-mode");
  git(
    repo,
    "worktree",
    "add",
    "--quiet",
    ".worktrees/2026-10-09-dark-mode",
    "2026-10-09-dark-mode",
  );

  await renderPage("/f/2026-10-09-dark-mode", repo);

  expect(await screen.findByText("Dark mode")).toBeTruthy();
  expect(screen.getByText("Merged into the default branch")).toBeTruthy();
  expect(screen.getByText("Worktree and branch left")).toBeTruthy();
  expect(screen.getByText(".worktrees/2026-10-09-dark-mode")).toBeTruthy();
  expect(screen.getByText("record")).toBeTruthy();
  expect(screen.queryByText("not yet")).toBeNull();
});
```

`record(title)` is a small helper in `helpers.tsx` returning a valid record text, `kind: feature`,
`finished: 2026-10-11`.

- [ ] **Step 2: Run it to check it fails**

- Run: `vp run --filter uraeda-binding build && vp test packages/web/src/__tests__/feature.test.tsx`
- Expected: FAIL, `Unable to find an element with the text: Dark mode`: the title is the slug.

- [ ] **Step 3: Implement**

`FeatureView::new` takes a finished feature's title from its record, and copies the two fields;
`featureDataView` selects `leftWorktree` and `leftBranch`. `FeaturePage` shows, after the branch
line and when `leftWorktree` or `leftBranch` is set, a `callout` with the title "Worktree and branch
left", "Worktree left", or "Branch left", and the text of the [mockup](mockups/web-ui.html); it
shows no "not yet" rows for a feature with a `record` file; a `record` file's badge reads `record`.
`labels.ts`: `finish: "Finish"` in `STEPS`, `record: 0` in `RANK`.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/core/src/view.rs packages
git commit -m "feat(finish-feature): show finished features in the web UI"
```

## Task 6: The cleanup of a merged feature, in the core

**Files:**

- Modify: `crates/core/src/git.rs` (`WorktreeRecord`, `worktree_records`, `has_local_changes`,
  `prune_worktrees`, `remove_worktree`, `delete_branch`, `unmerged_commits`)
- Create: `crates/core/src/actions/clean.rs`
- Modify: `crates/core/src/actions/mod.rs` (`pub mod clean`)
- Test: `crates/core/tests/clean.rs`

**Interfaces:**

- Consumes: `Feature.left_worktree`, `Feature.left_branch` (Task 2).
- Produces, in `git.rs`:
  - `pub struct WorktreeRecord { pub path: PathBuf, pub branch: Option<String>, pub locked: bool, pub missing: bool }`
    and `Git::worktree_records(&self) -> Result<Vec<WorktreeRecord>, GitError>`: every linked
    worktree from gix's records, its folder missing or not, its branch read from its record's
    `HEAD`.
  - `Git::has_local_changes(&self) -> Result<bool, GitError>`: a gix status of this working tree,
    untracked files included, ignored files excluded.
  - `Git::prune_worktrees`, `Git::remove_worktree(&self, path: &Path)`, and
    `Git::delete_branch(&self, branch: &str)`: `git worktree prune`, `git worktree remove <path>`,
    and `git branch -D <branch>`, through `run`.
  - `Git::unmerged_commits(&self, branch: &str, bases: &[&str]) -> Result<usize, GitError>`: the
    commits of `branch` absent from every base, a commit counting as present when the base has it or
    a patch-equivalent one: for each base,
    `git log --cherry-pick --right-only --no-merges --format=%H <base>...<branch>`, and the count of
    hashes in every base's list.
- Produces, in `actions/clean.rs`:

```rust
pub enum Did { RemovedWorktree(String), PrunedWorktree(String), DeletedBranch(String) }
pub enum WhyLeft { Changes, Locked, Outside(String), WorktreeLeft, CheckedOutHere, Unmerged { count: usize, bases: Vec<String> } }
pub struct Left { pub what: Leftover, pub why: WhyLeft }
pub enum Leftover { Worktree(String), Branch(String) }
pub struct Cleaned { pub name: String, pub did: Vec<Did>, pub left: Vec<Left>, pub dry_run: bool }
pub fn clean(git: &Git, workspace: &Workspace, feature: &Feature, dry_run: bool) -> Result<Cleaned, ActionError>
```

`name` is the folder, or `fix/<folder>` for a bug; worktree paths are shown from the main checkout.
`clean` refuses a feature whose step is not `done` with
`ActionError::Refused("<folder> is not merged: only merged features are cleaned")`.

- [ ] **Step 1: Write the failing tests**

`crates/core/tests/clean.rs`, with a helper `fn merged(kind: Kind) -> (TestRepo, Feature)` that
finishes a branch, rebase-merges it into `main` with `git rebase` then `git merge --ff-only`, keeps
the branch, and adds its worktree with `place::reach`:

```rust
/// US3.1
#[test]
fn removes_a_clean_worktree_and_its_merged_branch() {
    let (repo, feature) = merged(Kind::Feature);
    fs::create_dir_all(repo.path().join(".worktrees/2026-10-11-web-ui/node_modules")).unwrap();
    repo.write(".worktrees/2026-10-11-web-ui/.gitignore", "node_modules\n"); // committed on the branch before the merge

    let cleaned = clean(&git(&repo), &workspace(&repo), &feature, false).unwrap();

    assert_eq!(cleaned.did, [Did::RemovedWorktree(".worktrees/2026-10-11-web-ui".into()), Did::DeletedBranch("2026-10-11-web-ui".into())]);
    assert!(cleaned.left.is_empty());
    assert!(!repo.exists(".worktrees/2026-10-11-web-ui"));
}

/// US3.2, SC-003
#[test]
fn leaves_a_worktree_with_an_untracked_file() { /* notes.txt */ }

/// US3.3, SC-003
#[test]
fn leaves_a_branch_with_commits_main_lacks() { /* two commits after the merge */
    // assert left == [Left { what: Branch(..), why: Unmerged { count: 2, bases: ["main"] } }]
}

/// US3.4
#[test]
fn a_merge_only_on_origin_counts() { /* bases ["main", "origin/main"], branch deleted */ }

/// US3.5
#[test]
fn leaves_the_branch_the_checkout_is_on() {}

/// US3.7
#[test]
fn refuses_a_feature_not_merged() {}

/// US3.8, review focus 3
#[test]
fn cleans_a_merged_bug() { /* .worktrees/fix/<folder> removed, fix/<folder> deleted */ }

/// Review focus 4
#[test]
fn without_origin_the_local_main_alone_counts() {}

#[test]
fn a_squash_merge_leaves_the_branch() {}

#[test]
fn leaves_a_locked_worktree() { /* git worktree lock */ }

#[test]
fn leaves_a_worktree_outside_worktrees() { /* git worktree add ../elsewhere */ }

#[test]
fn prunes_a_worktree_deleted_by_hand() {
    // rm -rf the worktree folder
    // assert did == [PrunedWorktree(".worktrees/2026-10-11-web-ui"), DeletedBranch(..)]
}

#[test]
fn a_dry_run_changes_nothing() {
    // assert the worktree and the branch still exist, and did lists both
}
```

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test clean`
- Expected: FAIL to compile: `could not find clean in actions`.

- [ ] **Step 3: Implement `git.rs`'s additions, then `clean`**

`clean`, in this order, deciding everything before any write, and writing nothing on a dry run:

1. Refuse a feature that is not `done`.
2. The worktree: the `WorktreeRecord` whose branch is the feature's. Missing folder: `prune`, did
   `PrunedWorktree`. Outside `<main root>/.worktrees/`: left, `Outside(<path>)`. Locked: left,
   `Locked`. `Git::open(path)?.has_local_changes()?` true: left, `Changes`. Otherwise
   `remove_worktree`, did `RemovedWorktree`.
3. The branch, when it exists locally: the current branch of the main checkout: left,
   `CheckedOutHere`. Its worktree left: left, `WorktreeLeft`. `unmerged_commits(branch, bases)`,
   with `bases` the local default branch and `origin/<default>` when it exists, above 0: left,
   `Unmerged`. Otherwise `delete_branch`, did `DeletedBranch`.

- [ ] **Step 4: Run all tests**

- Run: `cargo test --workspace --exclude uraeda-binding`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/core
git commit -m "feat(finish-feature): clean a merged feature's worktree and branch"
```

## Task 7: `ura clean`

**Files:**

- Create: `crates/cli/src/clean.rs`
- Modify: `crates/cli/src/main.rs` (`Command::Clean`)
- Modify: `crates/core/src/target.rs` (`Purpose::Clean`)
- Test: `crates/cli/tests/clean.rs`

**Interfaces:**

- Consumes: `actions::clean::clean` and its types (Task 6), `status::name` (Task 4).
- Produces: `ura clean [TARGET] [--all] [--dry-run]`, described as "Remove the worktree and the
  branch merged features left behind". `Purpose::Clean`: candidates are `done` features with
  `left_worktree` or `left_branch`; without a target, the current branch's feature when it is a
  candidate, else the only candidate; a named feature that is not `done` reaches `clean`, which
  refuses it.

- [ ] **Step 1: Write the failing tests**

`crates/cli/tests/clean.rs`, each asserting stdout, stderr, and the exit code against the
[mockup](mockups/cli-output.md), word for word:

```rust
/// US3.1
#[test]
fn cleans_one_merged_feature() {
    // ...
    assert_eq!(output.stdout, "2026-10-11-web-ui\n  removed the worktree .worktrees/2026-10-11-web-ui\n  deleted the branch 2026-10-11-web-ui\n");
    assert_eq!(output.code, 0);
}

/// US3.2
#[test]
fn reports_a_worktree_with_untracked_files() { /* exit 1, the two "left" lines */ }

/// US3.3
#[test]
fn reports_commits_the_default_branch_lacks() {
    // with origin: "left the branch 2026-10-11-web-ui: 2 commits are on neither main nor origin/main. Delete it with\n  git branch -D 2026-10-11-web-ui if they are not needed\n"
    // without origin: "2 commits are not on main."
}

/// US3.6
#[test]
fn several_candidates_need_a_target_or_all() {
    assert_eq!(output.stderr, "ura: 2 merged features have a worktree or a branch left: name one, or pass --all\n  2026-10-10-cli-core\n  2026-10-11-web-ui\n");
    assert_eq!(output.code, 1);
}

/// US3.6
#[test]
fn a_dry_run_with_all_prints_what_it_would_do() {}

/// US3.7
#[test]
fn refuses_a_feature_not_merged() {
    assert_eq!(output.stderr, "ura: 2026-10-12-finish-feature is not merged: only merged features are cleaned\n");
}

#[test]
fn nothing_to_clean() {
    assert_eq!(output.stdout, "Nothing to clean: no merged feature has a worktree or a branch left.\n");
    assert_eq!(output.code, 0);
}
```

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test clean`
- Expected: FAIL: `ura: unrecognized subcommand 'clean'` in every test's stderr.

- [ ] **Step 3: Implement**

`clean::run(target, all, dry_run)`: no candidate and no target prints "Nothing to clean: ..." and
exits 0; `--all` cleans every candidate in folder order; otherwise the target rule. Each `Cleaned`
prints its name, then one line per `Did`, `would remove`, `would delete`, and `would prune` on a dry
run, then one per `Left`, with the mockup's texts, wrapped at 100 columns with a two-space indent as
in the mockup. Exit 1 when any `Left` was printed. The commit-free command makes no commit.

- [ ] **Step 4: Run all tests**

- Run: `cargo test --workspace --exclude uraeda-binding`
- Expected: PASS, except `every_command_is_named_in_the_skill`, which fails on `clean` until Task 8.
  Mark that test `#[ignore = "until the skill names ura clean, task 8"]` in this commit.

- [ ] **Step 5: Commit**

```bash
git add crates
git commit -m "feat(finish-feature): ura clean"
```

## Task 8: The finishing step in the skill

**Files:**

- Create: `skills/uraeda/references/finish.md`
- Modify: `skills/uraeda/SKILL.md`
- Modify: `skills/uraeda/references/implementation.md`, `bug.md`, `spec.md`
- Modify: `skills/uraeda/assets/templates/specs/README.md`, `specs/README.md`
- Modify: `README.md`
- Modify: `crates/cli/tests/skill.rs` (remove the `#[ignore]` of Task 7)
- Test: `crates/cli/tests/skill.rs`, `crates/core/tests/check.rs`

**Interfaces:**

- Consumes: the record template and example (Task 1), the step rows (Task 3), `ura clean` (Task 7).
- Produces: `references/finish.md`, the reference of the step `finish`.

- [ ] **Step 1: Write `finish.md`**, in the style of the other references (runs when, writes, ends
      at; then the sections), covering, in order:
  - When it runs: the rows of [the spec's table](spec.md#data), and what to do from each: write the
    record after a draft pull request and the folder; mark it ready after the record and a draft;
    open it after the record and no pull request.
  - Opening the draft pull request after the final review, with `gh pr create --draft`, and without
    draft pull requests, the finishing commit first, then a second commit with the link.
  - Writing the record from each file: which file feeds which section, exact question headings,
    shortened answers, notes, decisions, rulings and revisions after approval, deferred minors; as
    dense as the section's purpose allows, with no line limit (C2); `finished` and the `> [!NOTE]`
    block (C1).
  - Rewriting the links, in every file of the branch: the rule of [the spec](spec.md#data), checked
    with `ura check specs`.
  - The finishing commit: the record, the folder's deletion, the links, the `PRIORITIES.md` line,
    `finish(<slug>): <feature name>`.
  - Marking the pull request ready, with `gh pr ready`, its description as today's, its links to
    `spec.md` and `plan.md` at the commit before finishing, and its last line "Once merged, run
    `ura clean` to remove the worktree and the branch.", for features and bugs.
  - Changes asked on the pull request: the record's Behaviour or Design in place, and a line under
    **Changes after approval**. A change that needs a new round: `git revert` of the finishing
    commit, then the changes listed since finishing carried into the spec and the plan, then
    `gh pr ready --undo`, then the round.
  - Merging: merge commits or rebases, not squash, so `git log -- specs/<folder>/` finds the files.
  - Cleaning after the merge: `ura clean`, or by hand: `git worktree remove .worktrees/<branch>`
    without `--force`, then `git branch -D <branch>` only when
    `git log --cherry-pick --right-only --no-merges --format=%H <default>...<branch>` prints
    nothing, against `origin/<default>` too. Remote branches: GitHub's "Automatically delete head
    branches" setting.
  - Records are frozen once merged, edited only to fix a broken link.
  - Finishing a feature merged before this step: on a branch, the same record, through a pull
    request, when a human asks.

- [ ] **Step 2: Update the rest of the skill and the READMEs**
  - `SKILL.md`: `done/` in the folder tree, after `backlog/`; the rows of the step table and the bug
    table, as in [the spec](spec.md#data), "Final review, then Finish" in place of the last row's
    text; in **Finding the next step**, step 4: when a merged feature still has a worktree or a
    branch, tell the human to run `ura clean`, or give them the commands of `finish.md`; a section
    "Finishing a feature" after "Starting, postponing, and dropping a feature", two short paragraphs
    pointing to `finish.md`; `finish:` in the commit types; `ura clean` in the CLI table.
  - `implementation.md`: **Final review** ends by handing over to `finish.md`; **Pull request**
    moves there, leaving one sentence; **Changes requested** amends the record, as in `finish.md`.
  - `bug.md`: its last step hands over to `finish.md`.
  - `spec.md`, under **Writing a decision**, **Why**: the link goes to the question, and finishing
    rewrites it to the record.
  - Both `specs/README.md`: `done/` in the layout, a record's purpose in a line.
  - `README.md`: the walkthrough's last step names finishing and links the example record.

- [ ] **Step 3: Run the checks**

- Run:
  `cargo test -p uraeda-cli --test skill && cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs && cargo run -q -p uraeda-cli -- check specs`
- Expected: PASS, and `no problems` twice.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills README.md specs/README.md crates/cli/tests/skill.rs
git commit -m "docs(finish-feature): the finishing step in the skill"
```

## Task 9: Finish the three merged features

**Files:**

- Create: `specs/done/2026-10-10-stack-decision.md`, `specs/done/2026-10-10-cli-core.md`,
  `specs/done/2026-10-11-web-ui.md`
- Delete: `specs/2026-10-10-stack-decision/`, `specs/2026-10-10-cli-core/`,
  `specs/2026-10-11-web-ui/`
- Modify: `specs/decisions/cli.md`, `git.md`, `stack.md`, `toolchain.md`, `specs/drafts/cli-tuis.md`
- Test: `ura check specs`, `crates/core/tests/check.rs` (`this_repository_has_no_problems`)

**Interfaces:**

- Consumes: the record template and `finish.md` (Tasks 1 and 8).
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the three records**, following `finish.md`, from each folder and
      `git log -- specs/<folder>/`: `finished` is the merge date, 2026-10-10, 2026-10-11, and
      2026-10-12; `pull-request` is `https://github.com/mrtolkien/uraeda/pull/1`, `/2`, and `/3`.

- [ ] **Step 2: Rewrite the links and delete the folders**, by the rule of [the spec](spec.md#data):
      the 26 links of `specs/decisions/` and the 8 of `specs/drafts/cli-tuis.md`, then `git rm -r`
      the three folders.

- [ ] **Step 3: Check**

- Run:
  `cargo run -q -p uraeda-cli -- check specs && grep -rn "2026-10-10-stack-decision/\|2026-10-10-cli-core/\|2026-10-11-web-ui/" --include=*.md specs skills README.md AGENTS.md; wc -l specs/done/*.md`
- Expected: `specs/: no problems`, no grep match, and the line counts, which go in the commit's
  body.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A specs
git commit -m "chore(finish-feature): finish the three merged features"
```
