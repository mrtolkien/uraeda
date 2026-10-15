---
status: auto-approved
spec-revision: 1
---

# Plan: Inbox

**Goal:** Notes about the software go in `specs/INBOX.md`, under `##` categories. They are captured
from the web UI's sidebar, `ura note`, and Neovim, and organized by hand in the web UI or through an
agent's triage file. Home shows their count.

**Architecture:** The core owns the inbox, as it owns the priorities:

- **The format.** `files/inbox.rs` parses `INBOX.md` and edits it by splicing lines, with helpers it
  shares with `files/priorities.rs` in `files/lines.rs`.
- **The writes.** `actions/inbox.rs` writes the file on the default branch with hash checks, and
  owns the moves that cross files: into the priorities, a new draft, or an existing draft.
- **The commit.** `actions/changes.rs` owns the change list that merges `INBOX.md`, `PRIORITIES.md`,
  and the drafts notes went into. The commit bar's count, its message, Commit, and Discard all come
  from that list.
- **The triage.** `api/triage.rs` reads and answers `specs/INBOX-TRIAGE.md` through the
  clarifications code, generalized from a feature's round to a path.

Every surface only calls the core: the binding, the server's fate views and mutations, the web UI,
`ura note`, and the language server. The skill's `references/inbox.md` is the source of truth for
the format, capture, organizing, the triage, and agents' notes. See the
[spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both, with the
approval comments in [spec-review.md](spec-review.md).

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A note's text inside fenced code or a sub-bullet.** Lines inside a ``` fence, and indented
   sub-bullets of a note, are not notes. Moving a multi-line note moves all its lines. Task 2.
2. **Undo after the commit bar committed.** Commit and Discard close the open Undo toasts, as the
   priorities do (`closeUndoToasts`), so an Undo never writes over committed text. Task 10.
3. **A move into the priorities when only `PRIORITIES.md` changed on disk.** It is refused with the
   `PRIORITIES.md` message, and `INBOX.md` is not written. Writing the inbox first and then failing
   on the priorities would lose the note. Task 4.
4. **The merged change list after a note is edited and then moved.** It names one change, a move,
   with the edited text, not an edit plus a move. Task 4.
5. **`ura note` from a feature's worktree when the default branch has no checkout.** It writes in
   `.worktrees/main`, created by `place::reach`, and commits there, as `ura draft` does today.
   Task 7.
6. **Two `## UI` headings.** Edits add to the first, and `ura check` reports `inbox.category` on the
   second. Tasks 2 and 5.
7. **A note linking a draft that becomes a folder** when an image is attached. The inbox's link is
   rewritten to `drafts/<slug>/proposal.md`, as the priorities' link already is. Task 11.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these:

- "Drafts, backlog files, `PRIORITIES.md`, `INBOX.md`, and `INBOX-TRIAGE.md` MUST be written on the
  default branch, from every tool and from any checkout. A tool opened in another branch's checkout
  MAY act on its copy of one of them only while that copy holds the default branch's text, and MUST
  otherwise refuse, naming the default branch's checkout." ([git](../decisions/git.md))
- "Workflow logic, parsing, validation, and workflow states MUST live in the Rust core". "TypeScript
  code MUST reach the core only through the binding". "The web UI MUST draw workflow files from the
  document tree the core sends, and MUST NOT parse their markdown". "Editor plugins [...] MUST NOT
  parse workflow files". "Actions that write another file or commit MUST be commands the user runs
  explicitly, never code actions." ([stack](../decisions/stack.md))
- "Every rule the CLI enforces or checks MUST be written in the skill" and "A change to a command's
  behaviour MUST update the skill in the same change". "Commands MUST print data to stdout and
  messages to stderr, exit 0 on success and 1 on any error". ([CLI](../decisions/cli.md))
- "Rust and TypeScript functions MUST NOT be longer than 100 lines", "MUST NOT take more than 7
  parameters", "Code MUST NOT nest blocks more than 4 levels deep", "source files MUST NOT be longer
  than 500 lines". "A new marker MUST NOT be added unless a human approves it". A feature touching a
  marked function or file splits it first, in a commit that only restructures it.
  ([code quality](../decisions/code-quality.md))
- "Every UI test MUST guard a spec's acceptance scenario, edge case, or success criterion, or a rule
  of a UI decision." Tests drive the UI "through roles, labels, and visible text". "Before handing
  over a UI change, the agent MUST take screenshots of every changed view at both sizes and in both
  themes [...] and commit them in the feature's folder under `screenshots/`."
  ([UI checks](../decisions/ui-checks.md))
- The UI rules for in-place edits, toasts, dialogs, and panes: "A small edit, like a line's text,
  MUST happen in place: Enter or its Save button saves, Escape or its Cancel button cancels." "A
  toast [...] MUST last 5 seconds, MAY carry one action, Undo". "On wide screens, menus MUST be
  popovers and short forms dialogs. On narrow screens, both MUST be bottom sheets." "An open detail
  [...] MUST be in the URL". ([UI behaviour](../decisions/ui-behaviour.md),
  [UI layout](../decisions/ui-layout.md))
- **Exact text, from the spec**: every string in its user stories, edge cases, and
  [Components](spec.md#components). Examples: "Added to the inbox, not committed", "INBOX.md changed
  on disk. Your change was not applied.", "N notes to organize", "A note needs text.", and the two
  triage messages of US4.
- **Commit messages, from the spec's assumptions**: `add "<note>" to the inbox`,
  `edit "<note>" in the inbox`, `remove "<note>" from the inbox`,
  `move "<note>" to <Category> in the inbox`, `move "<note>" from the inbox to <Section>`,
  `move "<note>" from the inbox to the draft <title>`. Each takes `chore:`, and several take
  `, and N more` with a body. The triage's are `chore: propose an inbox triage`,
  `chore: answer the inbox triage`, `chore: apply the inbox triage`. Notes are shortened like
  priorities entries: `short()`, 40 characters.
- **Existing guarantee, byte-for-byte edits**: every priorities edit leaves the rest of the file
  unchanged ([`crates/core/tests/priorities.rs`](/crates/core/tests/priorities.rs),
  `moves_keep_every_other_line`). Task 1 must keep those tests passing unchanged.
- **C1 of the approval**: "don't do anything to it. Just move the scratchpad to INBOX.md." No task
  fixes the three bugs of today's `## Scratchpad`.
- **The approval's general comment**: "the last step of the development should be pulling in the
  changes of the bugfixing flow and integrating nicely with them" (task 14).

## Code read

- [`crates/core/src/files/priorities.rs`](/crates/core/src/files/priorities.rs):
  - 685 lines, listed at 685 in `LARGE` ([`structure.rs`](/crates/cli/tests/structure.rs)).
  - `parse` scans bullets with continuation lines under a section heading.
  - `insert`, `edit`, `remove`, and `move_entry` splice line ranges inside `with_unix_newlines`.
  - `diff` is an LCS over entries, plus a move and edit matching pass.
  - Keys are text slugs, made unique with `-2`; ids are `<section>-<position>`.
- [`crates/core/src/actions/priorities.rs`](/crates/core/src/actions/priorities.rs):
  - `apply` checks the hash and refuses with "PRIORITIES.md changed on disk. Your change was not
    applied."
  - Messages come from `short`, `describe`, `line`, and `message`.
  - `commit` stages only `PATH` through `ensure_only_staged` and `commit::commit`; `discard` runs
    `git.restore`.
- [`crates/core/src/api.rs`](/crates/core/src/api.rs):
  - 859 lines, at its `LARGE` cap.
  - `From<ActionError>` maps a refusal starting with "PRIORITIES.md changed" to `conflict` (L78).
  - Also used: `reach_default`, `write_lock`, `on_default`, `on_default_branch` (path-agnostic),
    `create_draft`, `read_draft`, `draft_path`, `commit_text`, and `read_file`, which is
    feature-only.
  - [`api/priority_edits.rs`](/crates/core/src/api/priority_edits.rs) is the pattern for new
    `api/*.rs` files.
- [`crates/core/src/actions/draft.rs`](/crates/core/src/actions/draft.rs):
  - `draft_entry` writes `specs/drafts/<slug>.md` from `proposal(line)` and links the line.
  - It refuses an existing file rather than numbering it.
- [`crates/core/src/actions/text.rs`](/crates/core/src/actions/text.rs):
  - `change()` adds `PRIORITIES.md` to a draft's commit when it changed.
  - It adds `images::linked_images` and the single-file draft a folder replaced.
- [`crates/core/src/actions/attach.rs`](/crates/core/src/actions/attach.rs): `into_folder` turns a
  single-file draft into `<slug>/proposal.md`, and `retarget` rewrites the links in `PRIORITIES.md`
  only.
- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs):
  - 1061 lines, capped at 1080.
  - `Workspace::read` reads `PRIORITIES.md` from the default checkout or its tip.
  - `FileKind::of` names `clarifications-NN.md`.
- [`crates/core/src/watch.rs`](/crates/core/src/watch.rs):
  `Changes { features, files, priorities, workspace }`, and a snapshot hashing the priorities and
  drafts.
- [`crates/core/src/view.rs`](/crates/core/src/view.rs): 499 lines, so a new view type goes in its
  own file.
- [`crates/core/src/check/`](/crates/core/src/check/):
  - `kind_of` maps `PRIORITIES.md` to `Checked::Priorities`.
  - `sections::template_path` and `template` take the title prefix from the template's H1 before
    `[`.
  - `answers::check_answers` and `values.rs` hold the clarifications statuses.
  - `links.rs` L92–99 holds the started-feature exemption for priorities links.
- [`crates/core/src/actions/init.rs`](/crates/core/src/actions/init.rs) copies `README.md`,
  `CONSTITUTION.md`, and `PRIORITIES.md` from `embedded::template`.
  [`crates/cli/tests/init.rs`](/crates/cli/tests/init.rs) asserts the exact list.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs):
  - One `#[napi]` function per API call, through `job(...)`.
  - `index.d.ts` is regenerated by `vp run binding:build` and committed.
- Server:
  - [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts) has the priorities mutations:
    `refusable`, then the binding, then `sources.masked`. `text.commit` and `writable` are there
    too.
  - [`fate/views.ts`](/packages/server/src/fate/views.ts) has `prioritiesDataView` and `Root`.
  - [`fate/sources.ts`](/packages/server/src/fate/sources.ts) has the priorities source.
  - [`live.ts`](/packages/server/src/live.ts) publishes `Priorities` when `changes.priorities` is
    set.
  - [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts): `newChat` runs in the main
    checkout.
- Web:
  - [`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx): `PrioritiesPage` is marked, at 208
    lines. It holds the commit bar at L397–445 and `<QuickAdd/>` at L326.
  - [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx): `AddForm` and `QuickAdd`.
  - [`Home.tsx`](/packages/web/src/Home.tsx): `Home` is marked, at 124 lines, with `QuickAdd` at L98
    and `Group`/`Row`.
  - [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx): 483 lines. `Item` wraps Astryx's
    `SideNavItem`, whose `actions` prop is hidden while the rail is collapsed.
  - [`routes.tsx`](/packages/web/src/routes.tsx): 460 lines, with `Route`, `parseRoute`, and
    `pathLink`.
  - [`App.tsx`](/packages/web/src/App.tsx): `TaskRoute` is the list and pane pattern with `Panes`.
  - [`TaskView.tsx`](/packages/web/src/TaskView.tsx): the move, draft, and remove actions with
    toasts and Undo. It is marked, and this plan does not touch it.
  - [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx),
    [`useAnswer.ts`](/packages/web/src/useAnswer.ts),
    [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx), and
    [`RoundSubmit.tsx`](/packages/web/src/RoundSubmit.tsx) are tied to `file.folder`.
  - [`sessions.ts`](/packages/web/src/sessions.ts): `sendMessage(fate, { text })` creates a chat,
    then sends to it.
  - [`attach/useAttach.ts`](/packages/web/src/attach/useAttach.ts) and
    [`AttachButton.tsx`](/packages/web/src/attach/AttachButton.tsx) post to
    `/r/<name>/attach?path=`.
- CLI:
  - [`main.rs`](/crates/cli/src/main.rs) holds the `Command` enum;
    [`draft.rs`](/crates/cli/src/draft.rs) is the model for a write command.
  - [`output.rs`](/crates/cli/src/output.rs) has `workspace`, `fail`, `say_place`, and
    `action_error`.
  - [`target.rs`](/crates/core/src/target.rs) has `resolve(..., Purpose::Inspect)` and
    `branch_folder`.
  - Test helpers are in [`common/mod.rs`](/crates/cli/tests/common/mod.rs): `ura`, `ura_in`,
    `specs`, `feature`. Benchmarks are `bench_*` tests in
    [`performance.rs`](/crates/cli/tests/performance.rs).
- LSP:
  - [`commands.rs`](/crates/lsp/src/commands.rs) is 500 lines, with `COMMANDS: [&str; 9]` and
    `Outcome { opened, written }`. Its `commit` accepts only drafts, proposals, and `PRIORITIES.md`.
  - Requests are in [`requests.rs`](/crates/lsp/src/requests.rs), such as `uraeda/waiting`, and are
    dispatched in `server.rs`.
  - Tests use `Session::command` in [`tests/commands.rs`](/crates/lsp/tests/commands.rs).
- Neovim:
  - [`actions.lua`](/editors/nvim/lua/uraeda/actions.lua) holds the `M.list` actions; keys
    `n p g i m e v t w ]u [u` are taken.
  - [`client.lua`](/editors/nvim/lua/uraeda/client.lua): `command` needs an attached buffer, while
    `request_checkout` does not.
  - [`pickers.lua`](/editors/nvim/lua/uraeda/pickers.lua): `waiting` and `open_at` are the models.
  - Tests stub `vim.ui.input` and `vim.ui.select` in `tests/test_fields.lua`.
- Tests and validation:
  - Core tests use `TestRepo` and fixtures; `fixtures/repo/main/specs/` is copied by the binding's
    `fixtureRepo` for the web, server, and browser tests.
  - Web unit tests use `renderPage` in
    [`__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx).
  - Browser tests use `takeRepo`, `show`, `atSize`, `commands.readRepo`, and the fake agent.
  - `vp run ready` runs every check. Single suites:
    - `cargo nextest run -p uraeda-core --test <file>`;
    - `vp test packages/web/src/__tests__/<file>`;
    - `vp test --project desktop packages/web/src/__browser__/<file>`;
    - `vp run test:nvim`.

## Constitution check

| Principle                                  | Complies | Notes                                                                                            |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| I. Humans stay in control                  | yes      | Agents add notes and propose a triage; only answers move notes.                                  |
| II. Git and plain text first               | yes      | `INBOX.md` and `INBOX-TRIAGE.md` are markdown; every flow ends in a commit.                      |
| III. Asynchronous by default               | yes      | The triage is a file answered like a round; `ura note` commits at once.                          |
| IV. Review effort matches impact           | yes      | Triage questions carry a recommended answer.                                                     |
| V. Tools are optional                      | yes      | Task 2 writes the format and the by-hand path in the skill, with templates.                      |
| VI. Code is checked and stays maintainable | yes      | Acceptance tests per story; tasks 1, 3, and 9 split marked or capped units first; no new marker. |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Git](../decisions/git.md): every inbox write goes through `reach_default` and `on_default_branch`
  (tasks 3, 4, 7, 8).
- [Stack](../decisions/stack.md):
  - The parsing, edits, diff, and checks are in the core (tasks 2–6), and the UI draws notes from
    the core's spans (task 9).
  - Neovim gets its categories from a language server request (task 8).
- [CLI](../decisions/cli.md): `ura note` is documented in `references/cli.md` and
  `references/inbox.md` in the same task (task 7).
- [Attachments](../decisions/attachments.md): a note's image goes through the existing attach
  endpoint into its draft's folder (task 11).
- [Agents](../decisions/agents.md): the triage runs as a chat in the main checkout, through
  `sendMessage` (task 12).
- [Code quality](../decisions/code-quality.md): structural steps in tasks 1, 3, and 9; no new
  marker.
- [UI behaviour](../decisions/ui-behaviour.md), [UI layout](../decisions/ui-layout.md),
  [UI components](../decisions/ui-components.md), and [UI checks](../decisions/ui-checks.md): tasks
  9–12.
- [Toolchain](../decisions/toolchain.md): new tests run in the existing tasks of `ready`, and the
  regenerated `index.d.ts` is committed (task 6).
- [Repositories](../decisions/repositories.md): the new pages live under `/r/<name>/` (task 9).

## Complexity tracking

| Abstraction or growth                                | Why                                                                                                            | Simpler alternative rejected                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `files/lines.rs`, shared line splicing               | Priorities and inbox both scan bullets with continuation lines and splice ranges: one rule, one home.          | Copying the scan into `inbox.rs`: a second copy of the rule (principle VI).  |
| `actions/changes.rs`, merged change list             | The spec's one commit bar counts, names, commits, and discards across `INBOX.md`, `PRIORITIES.md`, and drafts. | Two commit bars: the spec asks for one, and moves would show as two changes. |
| `api/drafts.rs`, moved out of `api.rs`               | `api.rs` is at its cap; the inbox API needs room for its `mod` and `pub use` lines.                            | Growing `api.rs`: refused by the structure test.                             |
| Answers generalized from a feature's round to a path | The triage is answered with the round's code and UI.                                                           | A copy of the answer code for the triage: a second copy of the rule.         |
| `CommitBar` component                                | Shared by the priorities and inbox pages.                                                                      | Duplicating the bar's JSX in two pages.                                      |
| `Outcome.line` in the language server                | `uraeda.note` opens `INBOX.md` at the added line (C2).                                                         | The plugin finding the line itself: it would parse the file, against stack.  |
| `client.command_checkout` in Neovim                  | The note action runs from any buffer, which `command` cannot.                                                  | Requiring an open specs file: against "from anywhere".                       |
| `RoundPage` with a target instead of a folder        | The triage file is not in a feature folder.                                                                    | A second round page.                                                         |

No function or file is grown past a limit or left over one. `PrioritiesPage` and `Home` lose their
markers in tasks 9 and 10, and `files/priorities.rs` drops under its cap in task 1.

## Review comments

- **General: the bugfixing flow is merged first, and this feature integrates with it last.** Task 14
  catches up with `main` once `2026-10-15-add-bugfixing` is merged. It turns the triage's "Bug"
  outcome into a draft started as a change, and adapts the skill text written in task 2.
- **C1: don't fix the scratchpad's bugs, just move it.** No task fixes them. The move into
  `INBOX.md` is part of the finish commit, as the spec says, and is written down in task 14.
- **C2: in Neovim, a category picker after the note's text, then open `INBOX.md` at the added
  line.** Task 8:
  - a language server request `uraeda/inboxCategories`;
  - a `vim.ui.select` picker with "No category", the categories, and "New category…";
  - `Outcome.line`, so the plugin opens the file at that line.

  This replaces the spec's typed category for Neovim.

---

## Task 1: Share the line splicing of the priorities

**Files:**

- Create: `crates/core/src/files/lines.rs`
- Modify: `crates/core/src/files/priorities.rs`, `crates/core/src/files/mod.rs`,
  `crates/cli/tests/structure.rs` (`LARGE`)
- Test: `crates/core/tests/priorities.rs`, `crates/core/tests/files.rs` (existing, unchanged)

**Interfaces:**

- Produces, in `files::lines`, all `pub(crate)`:
  - `enum Marker`, with `render()`, and `item_marker(line: &str) -> Option<(Marker, &str)>`;
  - `struct Item { line: usize, text_end: usize, end: usize, marker: Marker }`, all 1-based;
  - `items<S: Clone>(text: &str, heading: impl FnMut(&str) -> Option<S>) -> Vec<(S, Item)>`: bullets
    at column 0 under a heading the closure accepts. Any line starting with `#` is a heading. It
    does not skip fenced code yet: task 2 adds that, with its test (ruling R7);
  - `item_text<'a>(lines: &[&'a str], item: &Item) -> Vec<&'a str>`: the first line after its
    marker, then the continuation lines, trimmed;
  - `nested_spans(lines: &[&str]) -> Vec<Vec<Span>>`: the text of each item of nested lines;
  - `append_to_section(text: &str, is_heading: impl Fn(&str) -> bool, new_heading: &str, item: &[String]) -> String`;
  - `replace(text: &str, item: &Item, lines: &[String]) -> String` and
    `remove(text: &str, item: &Item) -> String`;
  - `plain(markdown: &str) -> (String, Option<String>)`, `one_line(line: &str) -> String`, and
    `unique_keys(slugs: Vec<String>) -> Vec<String>` (`-2`, `-3`, empty becomes `line`).
- `files::priorities` keeps every public signature and behaviour.

- [x] **Step 1: Run the priorities tests before the change**

- Run: `cargo nextest run -p uraeda-core --test priorities --test files`
- Expected: PASS

- [x] **Step 2: Move the generic helpers into `files/lines.rs`, and make `priorities.rs` use them**

`priorities.rs` keeps `Section`, `Entry`, `link`, `move_to_now`, `add_to_now`, the napi types,
`read`, `diff`, and the edits. The edits become calls to `lines`. It must end at 500 lines or fewer:
delete its row from `LARGE`, since the structure test fails on a listed file under the limit. This
step only restructures.

- [x] **Step 3: Run all Rust tests**

- Run: `cargo nextest run -p uraeda-core -p uraeda-cli`
- Expected: PASS, the same tests as step 1, and `structure` passes without the `priorities.rs` row

- [x] **Step 4: Commit**

```bash
git add crates/core/src/files crates/cli/tests/structure.rs specs/2026-10-15-add-scratchpad/plan.md
git commit -m "refactor(add-scratchpad): the priorities' line splicing in files/lines.rs"
```

## Task 2: The inbox's format, in the core and the skill

**Files:**

- Create: `crates/core/src/files/inbox.rs`, `skills/uraeda/references/inbox.md`,
  `skills/uraeda/assets/templates/specs/INBOX.md`,
  `skills/uraeda/assets/templates/specs/INBOX-TRIAGE.md`,
  `skills/uraeda/assets/example/specs/INBOX.md`, `fixtures/repo/main/specs/INBOX.md`,
  `fixtures/INBOX-TRIAGE.md`
- Modify: `crates/core/src/files/mod.rs`; `skills/uraeda/SKILL.md`, which gets the layout block and
  the references list; `skills/uraeda/assets/templates/specs/README.md`, which gets a layout line;
  `skills/uraeda/references/conventions.md`, which gets the commit tables and a status table row for
  `INBOX-TRIAGE.md`; `skills/uraeda/references/projects.md`, which gets the setup list;
  `skills/uraeda/references/implementation.md` and `discovery.md`, which get agents' notes
- Test: `crates/core/tests/inbox.rs`

**Interfaces:**

- Consumes: `files::lines` (task 1). Adds the fenced-code skip to `lines::items`, which the
  priorities then share, with a test of a bullet inside a fence in both files (ruling R7).
- Produces, in `uraeda_core::files::inbox`:
  - `pub struct Note { pub id: String, pub key: String, pub category: Option<String>, pub text: String, pub agent: bool, pub about: Option<String>, pub link: Option<String>, pub line: usize, pub end: usize }`.
    The id is `note-<n>`, counted from 1 in file order. The key is the text's slug, made unique.
  - `pub fn parse(text: &str) -> Vec<Note>`, and `pub fn category_names(text: &str) -> Vec<String>`,
    every `##` heading in order, empty ones included.
  - `pub fn note_line(agent: bool, about: Option<&str>, text: &str) -> String`, which gives
    `- [agent] [run-ui] text`.
  - Napi objects, serde camelCase:
    - `InboxNote { id, key, text, spans: Vec<Span>, agent: bool, about: Option<String>, draft: Option<String>, start_line: u32, end_line: u32, lines: Vec<String> }`;
    - `InboxCategory { name: Option<String>, notes: Vec<InboxNote> }`, with no-category first and
      empty categories left out;
    - `Inbox { hash: String, categories: Vec<InboxCategory>, names: Vec<String>, count: u32, changes: u32, triage: Option<String> }`.
  - `pub fn read(text: &str) -> Inbox`, which leaves `changes` at 0 and `triage` at `None`; task 3
    fills them.
  - Edits, each `Option<String>`, `None` when the id is gone:
    - `add(text, category: Option<&str>, line: &str) -> String`, which writes `# Inbox\n\n` into an
      empty text first;
    - `edit(text, id, new_text)`, which keeps the marks;
    - `remove(text, id)`;
    - `move_to(text, id, category: Option<&str>)`;
    - `insert(text, category: Option<&str>, index: usize, lines: &[String])`, for Undo;
    - `note_lines(text, id) -> Option<Vec<String>>`.
  - `pub enum NoteChange { Added { category, text }, Removed { category, text }, Moved { from, to, text }, Edited { category, before, after } }`
    and `pub fn diff(before: &str, after: &str) -> Vec<NoteChange>`. The `from` and `to` fields hold
    `Option<String>` categories.

The fixture `fixtures/repo/main/specs/INBOX.md`, used by every later task, holds 11 notes:

```md
# Inbox

- Specs are still way too long and hard to read
- We'll need a model selector for each step
- We need a home icon

## UI

- [run-ui] In failures the `x` is not centered in the circle
- Draft to proposal on mobile went 404
- Icons are blurry on retina screens
- [agent] [session-view] Opening a session with 2,000 messages takes 4 s
- Text input feels laggy on the sessions page

## CLI

- Allow no selection in responses (after a warning)
- Make sure agents are resumable
```

`fixtures/INBOX-TRIAGE.md` is an `awaiting-human` triage of three questions on these notes, written
from the template. Tests copy it into a repository when they need a triage, so the fixture
repository itself has none. A test that needs the "Look and feel pass" draft writes
`specs/drafts/look-and-feel.md` itself, with a `## What` section. Existing tests that list the
fixture repository's files are updated for `INBOX.md`.

- [ ] **Step 1: Write the failing tests**

`crates/core/tests/inbox.rs`, table-driven where the cases are many:

- `parse` rows:
  - the spec's [Data](spec.md#data) example gives 4 notes, with categories `None`, `UI`, `UI`,
    `CLI`;
  - `[agent] [session-view]` gives `agent: true, about: Some("session-view")`;
  - `[!] text` gives `agent: false, about: None`, text `[!] text`;
  - a note with an indented sub-bullet is one note, with `end` on the sub-bullet;
  - a bullet inside a ``` fence is not a note;
  - a whole-line link gives `link: Some("drafts/x/proposal.md")`.
- Edits:
  - `add(None)` on `"# Inbox\n\n## UI\n\n- a\n"` places the note before `## UI`;
  - `add(Some("UI"))` places it after `- a`;
  - `add(Some("Editor"))` appends `\n## Editor\n\n- note\n`;
  - `add` on `""` gives `"# Inbox\n\n- note\n"`.
- Byte-for-byte: on a file with paragraphs, an `### aside`, and CRLF line endings, `edit`, `remove`,
  and `move_to` change only the note's lines (SC-004).
- `category_names` on two `## UI` gives `["UI", "UI"]`, and `add(Some("UI"))` adds to the first.
- `diff` rows: an added note, a removed one, a category change as `Moved`, an edited text as
  `Edited`, and an edit plus a category change as one `Moved` with the new text.

The break each test catches:

- Parse: a heading-reset bug that files the notes before the first `##` under the last category, and
  marks parsed into the text.
- Byte-for-byte: an edit that renormalizes newlines or blank lines.
- Diff: the review focus's edit-then-move counted as two changes.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-core --test inbox`
- Expected: FAIL to compile, `unresolved import uraeda_core::files::inbox`

- [ ] **Step 3: Implement `files/inbox.rs` on `files::lines`**

The format rules of the [spec's Data](spec.md#data) are the reference. `read` builds `spans` the way
`priorities::read` does, from `document::parse` of the note's markdown, with the marks stripped.

- [ ] **Step 4: Write the skill's inbox reference, templates, and example**

`references/inbox.md` covers these, in this order:

- **What the inbox is for.**
- **The format.** Use the spec's Data, word for word.
- **Capture.** By hand, with `ura note`, the web UI, and the editor. Notes are written on the
  default branch from any checkout. By hand, commit only `specs/INBOX.md`. When it has other
  uncommitted changes, write without committing.
- **Organizing by hand.** The outcomes and the commit messages of the global constraints.
- **The triage:**
  - `INBOX-TRIAGE.md` and its template;
  - one question per note or group of notes, naming the notes by their text, with the options the
    spec's assumptions list;
  - the refusal "An inbox triage already waits: answer or delete specs/INBOX-TRIAGE.md first.";
  - applying the answers in one commit, `chore: apply the inbox triage`, which deletes the file;
  - leaving later notes untouched, and skipping notes deleted meanwhile, said in the commit body;
  - a "Bug" answer starting a bug, as `bug.md` says.
- **Agents' notes.** For a problem outside the task, write `[agent]` and the slug, pick or create
  the category, and name the note in the step's report.

`implementation.md` and `discovery.md` link to that last section where they talk about findings
outside the task.

The two templates:

- `INBOX.md` is `# Inbox\n`.
- `INBOX-TRIAGE.md` is the clarifications template with these changes:
  - the title is `# Inbox triage`;
  - the block's first line reads `[N] questions on [M] notes, about [T] minutes.`;
  - `## Context` and the question format stay;
  - there is no `## Settled without the human`;
  - `**Notes:**` comes last.

The example's `INBOX.md` holds two categories and an agent's note.

- [ ] **Step 5: Run all tests and the specs check**

- Run:
  `cargo nextest run -p uraeda-core && cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs`
- Expected: PASS, and "no problems"

- [ ] **Step 6: Commit**

```bash
git add crates skills fixtures packages specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): the inbox's format, in the core and the skill"
```

## Task 3: Inbox edits on the default branch

**Files:**

- Create: `crates/core/src/actions/inbox.rs`, `crates/core/src/api/drafts.rs`,
  `crates/core/src/api/inbox_edits.rs`
- Modify: `crates/core/src/api.rs` (the draft functions move out; the `From<ActionError>` conflict
  arm), `crates/core/src/actions/mod.rs`, `crates/core/src/workspace.rs` (inbox text),
  `crates/core/src/watch.rs` (`Changes.inbox`), `crates/cli/tests/structure.rs` (`api.rs` row
  lowered)
- Test: `crates/core/tests/inbox_actions.rs`, `crates/core/tests/watch.rs`

**Interfaces:**

- Consumes: `files::inbox` (task 2).
- Produces:
  - In `actions::inbox`:
    - `pub const PATH: &str = "specs/INBOX.md"` and `pub fn read(place: &Place) -> Inbox`, with
      `triage` from `specs/INBOX-TRIAGE.md`'s status;
    - `pub struct Marks { pub agent: bool, pub about: Option<String> }`;
    - `pub fn add(place, category: Option<&str>, marks: &Marks, text: &str, previous: Option<&str>) -> Result<Inbox, ActionError>`,
      where `previous` is `None` from the CLI;
    - `edit(place, id, text, previous)`, `remove(place, id, previous)`,
      `category(place, id, category: Option<&str>, previous)`, and
      `insert(place, category, index, lines, previous)`, each returning
      `Result<Inbox, ActionError>`.
  - In `api::inbox_edits`, re-exported from `api`, each through `write_lock` and `reach_default`:
    - `read_inbox(repo) -> Result<Inbox>`;
    - `add_note(repo, category: Option<String>, about: Option<String>, text, previous) -> Result<Inbox>`,
      where `about` is a feature folder, written as its slug;
    - `edit_note`, `remove_note`, `move_note_to_category`, and `insert_note`.
  - In `watch`: `Changes.inbox: bool`, set when the default branch's `INBOX.md` or `INBOX-TRIAGE.md`
    changes.

- [ ] **Step 1: Move the draft functions out of `api.rs` into `api/drafts.rs`**

This is a structural step. Move `create_draft`, `read_draft`, `draft_path`, and their helpers out,
re-exported unchanged. Lower `api.rs`'s `LARGE` number to its new size.

- Run: `cargo nextest run -p uraeda-core -p uraeda-cli`
- Expected: PASS

```bash
git add crates/core/src/api.rs crates/core/src/api crates/cli/tests/structure.rs specs/2026-10-15-add-scratchpad/plan.md
git commit -m "refactor(add-scratchpad): the draft API in api/drafts.rs"
```

- [ ] **Step 2: Write the failing tests**

`inbox_actions.rs`, on `TestRepo`, using the fixture repo pattern of
[`tests/priorities.rs`](/crates/core/tests/priorities.rs):

- US1 1: adding "The plan's task list scrolls under the top bar" to `UI` writes that line last in
  `## UI`.
- US1 6: adding to a repository without `INBOX.md` creates `# Inbox\n\n- <note>\n`.
- US1 4: `add_note` with `about: Some("2026-10-14-run-ui")` writes
  `- [run-ui] The x is not centered`.
- From a feature branch's checkout, the note lands in the default branch's checkout, as in the
  priorities' worktree test.
- A stale hash is refused with "INBOX.md changed on disk. Your change was not applied.", and
  `api::add_note` returns code `conflict`.
- `remove`, then `insert` at the same place, restores the bytes (Undo, US1 7).

The break each test catches:

- The conflict check comparing the priorities' hash.
- The slug written as the folder name.
- A write into the feature's checkout.

In `watch.rs`, writing `INBOX.md` on main gives `Changes { inbox: true, .. }`.

- [ ] **Step 3: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-core --test inbox_actions --test watch`
- Expected: FAIL to compile, `could not find inbox in actions`

- [ ] **Step 4: Implement the actions, the API, the workspace read, and the watch flag**

- The conflict arm of `From<ActionError>` matches any refusal containing " changed on disk.", so
  `INBOX.md`'s maps to `conflict` like `PRIORITIES.md`'s.
- `Workspace` reads the default branch's `INBOX.md` and triage status the way it reads
  `PRIORITIES.md`, within its 19 lines of room.
- The snapshot hashes them into the inbox flag.

- [ ] **Step 5: Run all tests**

- Run:
  `cargo nextest run -p uraeda-core -p uraeda-cli && cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add crates specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): inbox edits on the default branch"
```

## Task 4: Moves out of the inbox, and one change list

**Files:**

- Create: `crates/core/src/actions/changes.rs`
- Modify: `crates/core/src/actions/inbox.rs`, `crates/core/src/actions/draft.rs` (drafts from a
  note's text), `crates/core/src/actions/text.rs` (`INBOX.md` in a draft's commit),
  `crates/core/src/actions/priorities.rs` (`commit` and `discard` delegate to `changes`),
  `crates/core/src/api/inbox_edits.rs`, `crates/core/src/api/priority_edits.rs`,
  `crates/core/src/api.rs` (`read_priorities` reports the merged count)
- Test: `crates/core/tests/inbox_moves.rs`, `crates/core/tests/priorities.rs` (commit messages)

**Interfaces:**

- Consumes: `actions::inbox` (task 3), and `priorities::add` and `priorities::diff`.
- Produces:
  - In `actions::inbox`:
    - `to_priorities(place, id, section: Section, previous: &str, priorities_previous: &str) -> Result<(), ActionError>`;
    - `to_new_draft(place, id, section, previous, priorities_previous) -> Result<String, ActionError>`,
      which returns the draft's path and adds `-2`, `-3` when the slug exists;
    - `to_draft(place, id, draft: &str, previous) -> Result<(), ActionError>`, which appends the
      note's lines at the end of the draft's `## What`;
    - `add_as_draft(place, category, marks, text, previous) -> Result<String, ActionError>`, which
      writes `specs/drafts/<slug>.md` from the proposal template and links it as a whole-line note.
  - In `actions::changes`:
    - `pub struct Changes { pub count: u32, pub lines: Vec<String> }`;
    - `pub fn list(place: &Place) -> Changes`;
    - `pub fn message(place: &Place) -> (String, Option<String>)`;
    - `pub fn commit(place) -> Result<Committed, ActionError>` and
      `pub fn discard(place) -> Result<(), ActionError>`.
  - `Priorities.changes` and `Inbox.changes` both carry `changes::list(...).count`.
  - API: `note_to_priorities(repo, id, section_id, previous, priorities_previous)`,
    `note_to_new_draft(...) -> Result<String>`, `note_to_draft(repo, id, draft, previous)`,
    `add_note_as_draft(repo, category, about, text, previous) -> Result<String>`, and
    `commit_changes(repo)` and `discard_changes(repo)`, which return `()`.
  - `commit_priorities` and `discard_priorities` call the same two functions.

- [ ] **Step 1: Write the failing tests**

Moves:

- **US2 1:** moving "Draft to proposal on mobile went 404" to Next leaves `INBOX.md` without it and
  Next ending with `- Draft to proposal on mobile went 404`.
- **US2 2:**
  - "We need a home icon" made a draft in Later creates `specs/drafts/we-need-a-home-icon.md`, with
    `# We need a home icon` and the text under `## What`;
  - Later ends with `- [We need a home icon](drafts/we-need-a-home-icon.md)`;
  - with that file already there, `we-need-a-home-icon-2.md`.
- **US2 3:** "Icons are blurry on retina screens" added to `look-and-feel.md` is the last line of
  its `## What`.
- **US6 2, core half:** `add_as_draft` writes the draft and the note `- [<text>](drafts/<slug>.md)`.
- **Review focus 3:** when only `PRIORITIES.md`'s hash is stale, the move is refused with the
  `PRIORITIES.md` message, and `INBOX.md` is unchanged.

Change list:

- **US2 7:** with two notes moved to Next and one deleted, the commit's subject is
  `chore: move "Draft to proposal on mobile went 404" from the inbox to Next, and 2 more`, and its
  body has three lines. The commit holds exactly `specs/INBOX.md` and `specs/PRIORITIES.md`.
- **US2 8:** a note added to a draft gives
  `move "<note>" from the inbox to the draft Look and feel pass`, and the commit holds the draft.
- A table-driven test of `message` maps one change of each kind to its subject.
- **Review focus 4:** an edited note, then moved, is one move.
- **Discard:** it restores all three files.
- **Drafts in the editor:** `text::commit` of a draft made from a note holds `INBOX.md`.

The break each test catches:

- Writing the inbox before checking the priorities' hash.
- A draft's commit leaving `INBOX.md` uncommitted.
- A change list counting a move as two changes.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-core --test inbox_moves`
- Expected: FAIL to compile, `no function to_priorities in actions::inbox`

- [ ] **Step 3: Implement the moves and `actions/changes.rs`**

Each cross-file move does these, in order:

1. Check both hashes.
2. Compute both new texts.
3. Write the target file first, then `INBOX.md`.
4. Restore the target if the second write fails.

The change list is built like this:

- Diff `INBOX.md` and `PRIORITIES.md` against `HEAD`.
- Pair a removed note with an added priorities entry, or with a line added to a changed draft under
  `specs/drafts/` or `specs/backlog/`, when their text is the same. Each pair is one move.
- Hold the draft files of those moves in the commit, and any uncommitted draft that an added note
  links to.

The messages follow the global constraints. Priorities-only changes keep today's messages.

- [ ] **Step 4: Run all tests**

- Run: `cargo nextest run -p uraeda-core -p uraeda-cli`
- Expected: PASS, the existing priorities commit tests included

- [ ] **Step 5: Commit**

```bash
git add crates specs/2026-10-15-add-scratchpad
git commit -m "feat(add-scratchpad): moves out of the inbox, committed in one change list"
```

## Task 5: Checking and setting up the inbox

**Files:**

- Modify: `crates/core/src/check/mod.rs` (`Checked::Inbox`, `Checked::Triage`, `kind_of`),
  `crates/core/src/check/sections.rs` (templates), `crates/core/src/check/values.rs` (triage
  statuses), `crates/core/src/check/links.rs` (the exemption extends to `INBOX.md`),
  `crates/core/src/actions/init.rs`
- Test: `crates/core/tests/check.rs`, `crates/cli/tests/init.rs`, `crates/cli/tests/check.rs`

**Interfaces:**

- Consumes: `files::inbox::category_names` (task 2), and the templates (task 2).
- Produces:
  - the rules `inbox.title`, which requires `# Inbox`, and `inbox.category`, which reports "the
    category \"UI\" is repeated";
  - `INBOX-TRIAGE.md` checked like a round of questions, with its title, statuses, answers, and the
    awaiting block;
  - `ura init` creates `specs/INBOX.md`.

- [ ] **Step 1: Write the failing tests**

- **Review focus 6:** two `## UI` headings report `inbox.category` on the second's line.
- A file titled `# Notes` reports `inbox.title`.
- A missing `INBOX.md` reports nothing.
- An answered triage with a blank answer reports the same problem a round does.
- An `INBOX.md` link to a started feature's folder passes.
- `ura init` lists `created specs/INBOX.md`, and a second run keeps it.

The break each test catches:

- The triage checked as a free file, so blank answers pass.
- `init` overwriting a human's inbox.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `cargo nextest run -p uraeda-core --test check && cargo nextest run -p uraeda-cli --test init`
- Expected: FAIL, the duplicate category not reported

- [ ] **Step 3: Implement the two kinds, and `init`'s template**

- [ ] **Step 4: Run all tests, and the specs check of the repository and the example**

- Run: `cargo nextest run -p uraeda-core -p uraeda-cli && cargo run -q -p uraeda-cli -- check specs`
- Expected: PASS, and "no problems"

- [ ] **Step 5: Commit**

```bash
git add crates specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): ura check and ura init know the inbox and its triage"
```

## Task 6: The triage's answers, the binding, and the server

**Files:**

- Create: `crates/core/src/api/triage.rs`
- Modify:
  - core: `crates/core/src/actions/answer.rs` and `crates/core/src/api/answers.rs` (answers by
    path);
  - binding: `crates/binding/src/lib.rs`, `packages/binding/index.d.ts`,
    `packages/binding/index.js`;
  - server: `packages/server/src/fate/views.ts`, `fate/sources.ts`, `fate/mutations.ts` (or a new
    `fate/inbox-mutations.ts` if `mutations.ts` passes 450 lines), `live.ts`, and `binding.ts`
    (`SOURCES`)
- Test: `crates/core/tests/triage.rs`, `packages/server/src/__tests__/inbox.test.ts`,
  `packages/server/src/__tests__/live.test.ts`

**Interfaces:**

- Consumes: tasks 3 and 4.
- Produces:
  - Core `api::triage`, each written on the default branch:
    - `read_triage(repo) -> Result<Option<FileView>>`, kind `clarifications`, with `folder: ""` and
      `name: "INBOX-TRIAGE.md"`;
    - `save_triage_answer(repo, question, letters, comment, previous) -> Result<FileView>`;
    - `save_triage_notes(repo, notes, previous)`;
    - `submit_triage(repo)`, which commits `chore: answer the inbox triage`.
  - Binding functions of the same names in camelCase, and every task 3 and 4 API call.
  - The server's views:
    - type `Inbox`, id `"inbox"`, with `{ id, hash, categories, names, count, changes, triage }`;
    - type `WorkflowFile` with id `"inbox-triage"` for the triage.
  - The server's mutations:
    - `inbox.add { hash, category?, about?, text }`, `inbox.edit { note, hash, text }`,
      `inbox.remove { note, hash }`, `inbox.insert { hash, category?, index, lines }`, and
      `inbox.category { note, hash, category? }`;
    - `inbox.toPriorities { note, hash, prioritiesHash, section }`;
    - `inbox.toNewDraft { note, hash, prioritiesHash, section }`, which returns a `Draft`;
    - `inbox.toDraft { note, hash, draft }` and
      `inbox.addAsDraft { hash, category?, about?, text }`, the second returning a `Draft`;
    - `changes.commit {}` and `changes.discard {}`, which return `Priorities`;
    - `triage.answer`, `triage.notes`, and `triage.submit`.
  - `live.ts` updates `Inbox` and `Priorities` when `changes.inbox` is set.

- [ ] **Step 1: Write the failing tests**

- **Core:** answering Q1 of `fixtures/INBOX-TRIAGE.md`, written into the repository, with "A" writes
  `**Answer:** A` under it. `submit` commits the file with `status: answered` and the block turned
  into a record.
- **Server:**
  - `mutate(app, "inbox.add", { hash, category: "UI", text: "…" })` returns `count` plus one and
    `changes: 1`;
  - a stale hash returns `BAD_REQUEST` with the conflict code;
  - `changes.commit` empties `changes`;
  - `byId(app, "WorkflowFile", ["inbox-triage"])` reads `fixtures/INBOX-TRIAGE.md` once written.
- **Live:** writing `INBOX.md` publishes `Inbox`.

The break each test catches:

- An answer written into a feature's round.
- A live update forgotten for the inbox.

- [ ] **Step 2: Run them to check they fail**

- Run:
  `cargo nextest run -p uraeda-core --test triage && vp test packages/server/src/__tests__/inbox.test.ts`
- Expected: FAIL, `no function read_triage` and `unknown mutation inbox.add`

- [ ] **Step 3: Generalize the answer actions to a path, implement `api/triage.rs`, then the binding
      and the server**

- [ ] **Step 4: Regenerate the binding, and run all tests**

- Run:
  `vp run binding:build && cargo nextest run && vp test --project '!phone' --project '!desktop'`
- Expected: PASS, and `index.d.ts` declares `Inbox` and `addNote`

- [ ] **Step 5: Commit**

```bash
git add crates packages specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): the inbox and its triage through the binding and the server"
```

## Task 7: `ura note`

**Files:**

- Create: `crates/cli/src/note.rs`, `crates/cli/tests/note.rs`
- Modify: `crates/cli/src/main.rs`, `crates/cli/tests/performance.rs`,
  `skills/uraeda/references/cli.md` (a row for `ura note`), `skills/uraeda/references/inbox.md` (its
  flags)

**Interfaces:**

- Consumes: `actions::inbox::add` and `actions::inbox::PATH` (task 3), and `target::resolve`.
- Produces:
  - the command `ura note <text> [--category <name>] [--about <target>] [--agent] [--no-commit]`;
  - inside a feature's or a bug's worktree, `--about` defaults to that folder;
  - the commit holds `specs/INBOX.md` alone.

- [ ] **Step 1: Write the failing tests**

- **US1 5:** from a worktree of `2026-10-15-add-scratchpad`,
  `ura note "Status hangs on a broken worktree" --category CLI` commits on main with the subject
  `chore: add "Status hangs on a broken worktree" to the inbox`. The worktree's `git status` is
  empty. The note is `- [add-scratchpad] Status hangs on a broken worktree`, since it was written
  from that worktree.
- **US5 1:** `--agent --about session-view --category UI` writes
  `- [agent] [session-view] Opening a session with 2,000 messages takes 4 s`.
- Errors:
  - `ura note ""` exits 1 with "ura: A note needs text.";
  - outside `specs/`, "ura: No specs/ folder here.";
  - an uncommitted `INBOX.md` gives exit 0, no commit, and stderr "INBOX.md had uncommitted changes:
    the note is written but not committed.".
- **Review focus 5:** with main not checked out anywhere, the note is committed in
  `.worktrees/main`.
- **SC-002:** `bench_note`, bounded like the other benchmarks.

The break each test catches:

- The note committed on the feature's branch.
- Other dirty files committed with it.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-cli --test note`
- Expected: FAIL, `error: unrecognized subcommand 'note'`

- [ ] **Step 3: Implement `note.rs`, following `draft.rs`, and document it in the skill**

- [ ] **Step 4: Run all tests**

- Run: `cargo nextest run -p uraeda-cli -p uraeda-core`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/cli skills specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): ura note"
```

## Task 8: Notes from Neovim

**Files:**

- Create: `crates/lsp/src/commands/note.rs`, `editors/nvim/tests/test_note.lua`
- Modify:
  - language server: `crates/lsp/src/commands.rs`, which gets `COMMANDS` and `Outcome.line` and
    moves `commit` into `commands/commit.rs` to stay at or under 500 lines;
    `crates/lsp/src/requests.rs` and `server.rs` (`uraeda/inboxCategories`);
  - Neovim: `editors/nvim/lua/uraeda/actions.lua`, `client.lua` (`command_checkout`), and
    `editors/nvim/README.md`
- Test: `crates/lsp/tests/commands.rs`

**Interfaces:**

- Consumes: `api::add_note`, `api::read_inbox`, and `api::commit_changes` (tasks 3 and 4).
- Produces:
  - The request `uraeda/inboxCategories` returns `string[]`, the default branch's category names.
  - The command `uraeda.note { text, category? }` returns `{ opened, written, line }`:
    - `opened` is the default branch's `INBOX.md`;
    - `line` is the 1-based line of the note.
  - `uraeda.commit` on `INBOX.md` commits the change list. Its refusal becomes "Only drafts, backlog
    files, proposals, PRIORITIES.md, and INBOX.md are committed from the editor."
  - In Neovim, the action `note`, desc "Uraeda: add a note to the inbox", key `o`, global.

- [ ] **Step 1: Move `commit` out of `commands.rs` into `commands/commit.rs`**

This is a structural step.

- Run: `cargo nextest run -p uraeda-lsp`
- Expected: PASS

```bash
git add crates/lsp specs/2026-10-15-add-scratchpad/plan.md
git commit -m "refactor(add-scratchpad): the editor's commit command in its own file"
```

- [ ] **Step 2: Write the failing tests**

- **Language server:**
  - `uraeda/inboxCategories` on the fixture returns `["UI", "CLI"]`;
  - `uraeda.note` with "Hints flicker on save" and "Editor" returns `opened` and `line` pointing at
    that line;
  - from `.worktrees/feat`, it writes main's file, following the model of
    `a_worktree_acts_on_mains_drafts_and_priorities`;
  - `uraeda.commit` on `INBOX.md` commits.
- **Neovim, US7 1 and C2:**
  - the stubbed `vim.ui.input` returns "Hints flicker on save";
  - `vim.ui.select` is shown `No category, UI, CLI, New category…`;
  - picking "New category…" with typed "Editor" leaves the buffer on `specs/INBOX.md` at the note's
    line;
  - the message is "Added to the inbox, not committed".

The break each test catches:

- The plugin parsing the file for categories.
- Opening the file without moving the cursor.

- [ ] **Step 3: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-lsp --test commands && vp run test:nvim`
- Expected: FAIL, `unknown command uraeda.note`

- [ ] **Step 4: Implement the request, the command, and the action**

- [ ] **Step 5: Run all tests**

- Run: `cargo nextest run && vp run test:nvim && vp run lua:fmt`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add crates/lsp editors/nvim specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): notes from Neovim"
```

## Task 9: Capture in the web UI: the sidebar, the add form, the inbox page, and Home

**Files:**

- Create: `packages/web/src/InboxPage.tsx`, `packages/web/src/AddNote.tsx`,
  `packages/web/src/SidebarAdd.tsx` (both ＋ buttons and their overlays),
  `packages/web/src/__tests__/inbox.test.tsx`, `packages/web/src/__browser__/inbox.test.tsx`
- Modify:
  - `packages/web/src/Home.tsx`: a structural split first, then the Inbox group, with `QuickAdd`
    removed;
  - `packages/web/src/PrioritiesPage.tsx`: `QuickAdd` removed;
  - `packages/web/src/QuickAdd.tsx`: `AddForm` exported; `QuickAdd` deleted;
  - `packages/web/src/SessionNav.tsx`: an `actions` prop on `Item`, and the Inbox row;
  - `packages/web/src/routes.tsx`: `{ page: "inbox" }`, `{ key, page: "note" }`, and
    `{ page: "triage" }`;
  - `packages/web/src/App.tsx`, `packages/web/src/data.ts` (`useInbox`, `readInbox`), and
    `packages/web/src/views.ts` (`InboxView`)

**Interfaces:**

- Consumes: the `Inbox` view and the `inbox.add` mutation (task 6).
- Produces:
  - `InboxPage()`;
  - `AddNoteButton()` and `AddPriorityButton()`, the sidebar's ＋ buttons;
  - `useInbox()` and `readInbox(fate)`;
  - the routes `/inbox`, `/inbox/<key>`, and `/inbox/triage`.

- [ ] **Step 1: Split `Home` into a component per group, and remove its marker**

This is a structural step.

- Run: `vp test packages/web/src/__tests__/home.test.tsx && vp check`
- Expected: PASS

```bash
git add packages/web/src/Home.tsx specs/2026-10-15-add-scratchpad/plan.md
git commit -m "refactor(add-scratchpad): Home's groups as components"
```

- [ ] **Step 2: Write the failing tests**

Unit tests in `__tests__/inbox.test.tsx`, through `renderPage`:

- **US1 1:** ＋ "Add a note to the inbox", then type, pick "UI", and press "Add".
  `read(repo, "specs/INBOX.md")` has the line last in `## UI`, the toast reads "Added to the inbox,
  not committed", and the page lists it under "UI".
- **US1 2, 3, and 7:** "No category", "New category…" with "Editor", and Undo.
- **US1 4:** adding from `/f/2026-10-14-run-ui` writes `[run-ui]`.
- **Blank text:** the "Add" button is disabled.
- **US3:** Home shows "11 notes to organize" for the fixture with 11 notes, and "1 note to organize"
  with one. With none, there is no Inbox group.
- **US5 3:** an agent's note shows an `agent` tag.
- **The empty inbox:** "The inbox is empty. Notes you add with ＋ next to Inbox land here."
- The sidebar's "Add to the priorities" opens the existing priorities form.
- No "Add a priority" button is left in the top bar.

Browser tests, in `__browser__/inbox.test.tsx`, at both sizes:

- adding a note;
- the add form as a dialog or a sheet;
- `checkPage` on `/inbox` and on the empty inbox;
- **SC-001:** one tap on ＋, the text, and Enter.

The break each test catches:

- The note added to the priorities.
- The slug missing from a feature's page.
- Plural text broken at 1.

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/inbox.test.tsx`
- Expected: FAIL, `Unable to find role="button" name "Add a note to the inbox"`

- [ ] **Step 4: Implement the pages, form, sidebar, routes, and Home group**

Follow the strings and layout of the spec's [Components](spec.md#components) and the
[mockups](mockups/inbox.html), frames 1, 2, 4, 5, 7, and 8. `AddNote` reuses `Overlay` and
`useTextField("inbox-add", "")`.

- [ ] **Step 5: Run all tests**

- Run:
  `vp check && vp test --project '!phone' --project '!desktop' && vp test --project desktop packages/web/src/__browser__/inbox.test.tsx && vp test --project phone packages/web/src/__browser__/inbox.test.tsx`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): capture notes from the sidebar, see them in the inbox and on Home"
```

## Task 10: Organizing by hand in the web UI, with one commit bar

**Files:**

- Create: `packages/web/src/NoteView.tsx`, `packages/web/src/CommitBar.tsx`
- Modify: `packages/web/src/PrioritiesPage.tsx` (the bar extracted, its marker removed),
  `packages/web/src/InboxPage.tsx`, `packages/web/src/App.tsx` (a note in `Panes` beside the inbox)
- Test: `packages/web/src/__tests__/inbox.test.tsx`, `packages/web/src/__browser__/inbox.test.tsx`

**Interfaces:**

- Consumes: the `inbox.*` and `changes.*` mutations (task 6).
- Produces:
  - `NoteView({ noteKey })`;
  - `CommitBar({ changes })`, with Commit, Discard, the confirmation, and `closeUndoToasts`.

- [ ] **Step 1: Extract `CommitBar` from `PrioritiesPage`, and remove its marker**

This is a structural step. Point it at `changes.commit` and `changes.discard`.

- Run: `vp test packages/web/src/__tests__/priorities.test.tsx && vp check`
- Expected: PASS

```bash
git add packages/web/src specs/2026-10-15-add-scratchpad/plan.md
git commit -m "refactor(add-scratchpad): the priorities' commit bar as a component"
```

- [ ] **Step 2: Write the failing tests**

- **US2 1:** "Move to priorities", then "Next", gives the file contents of task 4 and the toast
  "Moved to Next, not committed".
- **US2 2:** "Make a draft", then "Later", opens `/edit/specs/drafts/we-need-a-home-icon.md`.
- **US2 3:** "Add to a draft", filter "Look", pick "Look and feel pass", and the toast reads "Added
  to Look and feel pass, not committed".
- **US2 4:** "Delete" asks nothing, the toast reads "Deleted, not committed", and Undo restores the
  note.
- **US2 5:** "Category", then "UI".
- **US2 6:** "Edit", type "Specs are too long", press Enter, and the marks stay.
- **US2 7 and 8:** the bar reads "3 changes to commit" on both the inbox and the priorities pages.
  Commit gives the task 4 subject in `git log`.
- **Discard:** "Discard them" restores every file.
- **Review focus 2:** after Commit, the Undo toast is gone.
- **A note linking a draft:** "Make a draft" is not offered.
- **Stale file:** `writeRepo` changes `INBOX.md`, a move shows "INBOX.md changed on disk. Your
  change was not applied.", and the page reloads.
- **Undo of a moved note:** "Could not undo: \"<note>\" is no longer in INBOX.md."
- **Browser, SC-003, at both sizes:** three taps from the inbox page move a note to Next. On narrow
  screens the note opens as its own page; on wide screens, in the pane, with its URL.

The break each test catches:

- Toasts left open after Commit.
- Delete with no Undo.
- The pane not in the URL.

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/inbox.test.tsx`
- Expected: FAIL, `Unable to find role="button" name "Move to priorities"`

- [ ] **Step 4: Implement `NoteView` and the pane, following frames 1 and 6 of the mockups**

- [ ] **Step 5: Run all tests**

- Run:
  `vp check && vp test --project '!phone' --project '!desktop' && vp test --project desktop && vp test --project phone`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): organize notes by hand, committed with the priorities"
```

## Task 11: A note with an image

**Files:**

- Modify: `packages/web/src/AddNote.tsx`, `crates/core/src/actions/attach.rs` (`retarget` rewrites
  `INBOX.md` links too)
- Test: `crates/core/tests/attach.rs`, `packages/web/src/__browser__/inbox.test.tsx`

**Interfaces:**

- Consumes: `inbox.addAsDraft` (task 6), and `useAttach({ path })` and `AttachButton`.
- Produces: `retarget` covers `specs/INBOX.md`.

- [ ] **Step 1: Write the failing tests**

- **Core, review focus 7:** attaching an image to a draft linked from `INBOX.md` rewrites the note's
  link to `drafts/<slug>/proposal.md`.
- **Browser, US6 1 and 2:** attach `fixtureImage("screenshot.png")`. The button reads "Add as a
  draft", and the line "With an image, the note is saved as a draft, linked from the inbox." shows.
  After Add:
  - `readRepo("specs/drafts/the-spec-pages-headings-are-body-sized/proposal.md")` holds
    `![spec-headings](images/spec-headings.webp)`;
  - `INBOX.md` holds the linked note under `## UI`;
  - the toast reads "Added to the inbox as a draft, not committed".
- **US6 3:** moving the linked note to Next keeps the link.
- **An image the core refuses:** the core's message shows, and the text stays.

The break each test catches:

- A dangling link after the folder move.
- The image uploaded before the draft exists.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-core --test attach`
- Expected: FAIL, the note still links `drafts/<slug>.md`

- [ ] **Step 3: Implement `retarget` for `INBOX.md`, and the image in `AddNote`**

`AddNote` calls `inbox.addAsDraft`, then uploads through `useAttach({ path })`.

- [ ] **Step 4: Run all tests**

- Run: `cargo nextest run && vp test --project desktop packages/web/src/__browser__/inbox.test.tsx`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates packages/web specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): a note with an image becomes a linked draft"
```

## Task 12: The triage in the web UI

**Files:**

- Create: `packages/web/src/TriagePage.tsx`
- Modify:
  - `packages/web/src/RoundPage.tsx`, `useAnswer.ts`, `RoundNotes.tsx`, and `RoundSubmit.tsx`: a
    target that is a feature's round or the triage;
  - `packages/web/src/InboxPage.tsx`: the banners and buttons;
  - `packages/server/src/runner/message.ts`: `ORGANIZE_INBOX` and `APPLY_TRIAGE`, exported and
    served to the web through a view or imported constants
- Test: `packages/web/src/__tests__/triage.test.tsx`,
  `packages/server/src/runner/__tests__/message.test.ts`,
  `packages/web/src/__tests__/round.test.tsx` (still passing)

**Interfaces:**

- Consumes: `triage.*` and the `WorkflowFile` `inbox-triage` (task 6), and
  `sendMessage(fate, { text })`.
- Produces: `RoundPage({ file, target })`, where `target` is `{ folder }` or `{ triage: true }`.

- [ ] **Step 1: Write the failing tests**

- **US4 1:** "Organize with an agent" sends exactly
  `/uraeda:uraeda Organize the inbox, specs/INBOX.md: propose a triage in specs/INBOX-TRIAGE.md, following references/inbox.md. Stop when the triage waits for my answers.`
  to the fake agent, in a new chat.
- **US4 2:** with `fixtures/INBOX-TRIAGE.md` written as `specs/INBOX-TRIAGE.md`, the banner reads
  "An inbox triage waits for your answers", and "Answer it" opens `/inbox/triage`, where answering
  "A" writes the answer. "Organize with an agent" is disabled.
- **US4 3:** once the triage is answered, the banner reads "Your triage answers are ready to apply",
  and "Apply the answers" sends
  `/uraeda:uraeda Apply my answers in specs/INBOX-TRIAGE.md, following references/inbox.md.`
- **The server's messages:** they equal those two strings.
- **Rounds:** the existing round tests pass unchanged.

The break each test catches:

- A changed message the skill no longer matches.
- Answers written into a feature.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/triage.test.tsx`
- Expected: FAIL, `Unable to find role="button" name "Organize with an agent"`

- [ ] **Step 3: Implement the round target, `TriagePage`, and the inbox banners**

Follow frame 9 of the mockups. For the triage, `RoundPage` hides "Ask about" and its feature crumbs.

- [ ] **Step 4: Run all tests**

- Run:
  `vp check && vp test --project '!phone' --project '!desktop' && vp test --project desktop && vp test --project phone`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages specs/2026-10-15-add-scratchpad/plan.md
git commit -m "feat(add-scratchpad): an agent's inbox triage, answered in the web UI"
```

## Task 13: Check the triage reference against a run of it

**Files:**

- Modify: `skills/uraeda/references/inbox.md`, if the run shows a gap
- Test: none: US4 4–6 are rules of the skill, as the spec's Testing table says

**Interfaces:**

- Consumes: `references/inbox.md` (task 2), and `ura note` (task 7).

- [ ] **Step 1: Run the triage by the reference, on a scratch copy of the fixture repository**

Use `/tmp`, never the human's repository.

- Run: follow `references/inbox.md` to write `INBOX-TRIAGE.md` for the fixture's notes, answer it by
  hand, apply it, and run `ura check specs` there.
- Expected:
  - one `chore: apply the inbox triage` commit, which deletes the file (US4 4);
  - a note added after the triage is untouched (US4 6);
  - a second triage is refused with the reference's message;
  - `ura check` reports no problems.

- [ ] **Step 2: Fix the reference where it was unclear, and commit**

```bash
git add skills/uraeda/references/inbox.md specs/2026-10-15-add-scratchpad/plan.md
git commit -m "docs(add-scratchpad): the inbox triage reference, checked by a run"
```

## Task 14: Integrate the bugfixing flow, and prepare the scratchpad's move

**Files:**

- Modify: `skills/uraeda/references/inbox.md`,
  `skills/uraeda/assets/templates/specs/INBOX-TRIAGE.md`, `packages/web/src/NoteView.tsx` if the
  change flow adds a start action that fits, and whatever catching up with `main` needs
- Test: the tests above, after the rebase

**Interfaces:**

- Consumes: `main`, with `2026-10-15-add-bugfixing` merged.

- [ ] **Step 1: Check that the bugfixing feature is merged**

- Run: `git fetch origin && git log origin/main --oneline | grep "finish(add-bugfixing)"`
- Expected: a line. With none, stop here, and tell the human the feature waits for it, as the
  approval's general comment says.

- [ ] **Step 2: Rebase on `main`, as the implementation step's catch-up says, and run the
      validation**

- Run: `git rebase origin/main && vp run ready`
- Expected: PASS, once conflicts are resolved within both specs

- [ ] **Step 3: Turn the triage's "Bug" outcome into a draft started as a change**

Update the triage reference and template to say so, in the change flow's own words, and keep every
inbox test passing. Write a ruling for each place where the two features meet.

- [ ] **Step 4: Write down the scratchpad's move for the finish step**

Add to `references/inbox.md`'s setup section how a project moves notes from a `## Scratchpad`
section into `INBOX.md`. This feature's finish commit applies it to this repository: it moves every
bullet under `## Scratchpad` of the default branch's `PRIORITIES.md`, as it is then, under "No
category" in `INBOX.md`, and removes the section (C1, SC-005).

- [ ] **Step 5: Run all tests, and commit**

- Run: `vp run ready`
- Expected: PASS

```bash
git add -A skills packages crates specs/2026-10-15-add-scratchpad
git commit -m "feat(add-scratchpad): the inbox's bugs become changes"
```
