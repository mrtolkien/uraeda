---
status: auto-approved
spec-revision: 1
---

# Plan: Redesign home, inbox, and priorities

**Goal:** Home as a control hub, one shared list with handles, colours, and keyboard navigation for
the priorities and the inbox, panes that open to read and edit in place, "Add and commit", drafts
that take their line's children, started entries on top of Now, and a constitution and decisions
page.

**Architecture:** Every rule about files, links, and the workflow stays in the Rust core
([stack](../decisions/stack.md)), and the web UI draws what the core sends, as the
[spec's architecture](spec.md#architecture) says. Core tasks come first (1–7): each extends a reader
or an action, its napi export, and its fate source or mutation, so the web tasks (8–15) consume
finished data. The web side grows two shared units, `lists/` (sections, rows, dragging, keyboard)
and `pane/` (the top bar and in-place editing), which replace the per-page code of the priorities,
the inbox, and their task and note views. The mockups committed with the spec are the starting point
of each view: their `TEMPORARY:` joins and copies are removed as the core data and the shared units
land.

- **Owners**: `files/priorities.rs` owns the file's layout, including where started entries go;
  `workspace.rs` owns which feature or draft an entry has; `actions/` owns commits, with `git.rs`
  the only module running git; `api/ledger.rs` owns reading the constitution and decisions. In the
  web, `lists/` owns selection, focus, and drag order; `routes.tsx` owns which item is open.
- **State**: the files on the default branch are the truth; the fate records are views, pushed by
  the watch. The browser keeps only display choices (`uraeda:home:priorities`,
  `uraeda:decisions:sort`) and unsaved text, through the existing unsaved store.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both, with
[spec-review.md](spec-review.md), whose comments change parts of it (see
[Review comments](#review-comments)).

## Review focus

1. **"Add and commit" with other files already staged** in the checkout commits `PRIORITIES.md` or
   `INBOX.md` alone and leaves the others staged, as the spec's edge case says. Today's
   `Git::commit` refuses when other files are staged, so this needs a commit limited to its paths,
   through `git commit --only`. Task 6.
2. **The blank line under the started block**: starting when Now begins with a blank-separated group
   of entries that are not started, finishing the last started entry (its branch removes the line),
   and a Now holding only started entries must leave exactly one blank line between the started
   block and the rest, and none at a section's end. Task 3.
3. **Dropping in Now while started entries show apart**: Now on screen lists only the entries not
   started, while the file may hold started entries first (new ones) or last (entries started before
   this feature). A drop at a place in the screen's Now must land at the matching place among the
   entries not started, never between two started ones. Task 8.
4. **A feature that finishes while its entry shows as ongoing**: when a feature's step becomes
   `done`, its entry leaves "Ongoing" and gets its handle back without a reload. The priorities
   record must be pushed when the workspace changes, not only when `PRIORITIES.md` does: the watch's
   priorities hash covers the steps of the features the entries link (R6). Task 2.
5. **Keys while a popover, a menu, or a dialog is open**: ↑ ↓ j k move the list's selection only
   when the focus is on the list or the page, never inside a text field, an open Selector, a menu,
   or a dialog. Task 10.
6. **Undo of a committed add after the file changed**: the removal is refused with the existing
   conflict message, the toast's error stays, and nothing is committed. Task 6 (core), Task 12 (UI).
7. **A decision without an H1, without a summary, or that cannot be parsed**: the page still lists
   it, by its file name, and shows the core's first problem in its pane. Task 7 (core), Task 14
   (UI).

## Global constraints

From the [UI behaviour](../decisions/ui-behaviour.md) decision:

- A row that leads somewhere MUST be tappable as a whole, not only through a button or a chevron.
- A small edit, like a line's text, MUST happen in place: Enter or its Save button saves, Escape or
  its Cancel button cancels. Leaving the field MUST NOT save it: it stays open with its text.
- A text field MUST save only when the human presses its Save button, its own key (Enter in a
  one-line field, Ctrl+Enter or Cmd+Enter in a multi-line one), or a button that uses its text, like
  Add comment, Submit, Commit, Start, or a verdict. It MUST NOT save as it is typed, after a pause,
  or when it loses the focus.
- A text field whose text differs from what is saved MUST say "Unsaved changes" next to its Save
  button. Its Save button MUST be disabled while nothing changed.
- Cancel or Escape on a field whose text changed MUST ask first, with "Discard" and "Keep editing".
- The unsaved text of every field MUST be kept in the browser until it is saved or discarded, and
  restored when the field shows again, with a notice saying so and a Discard button.
- Every multi-line text field MUST have a fixed height, set by what it holds: 20 rows for the editor
  of drafts and proposals. Every multi-line field except the chat composer MUST use the app's one
  text area.
- A toast MAY confirm only a result the human cannot see on screen. It MUST last 5 seconds, MAY
  carry one action, Undo, which reverts that change alone, and MUST NOT be the only place an error
  shows.
- Errors MUST stay on screen until the human deals with them, or the action is retried.
- Back MUST return to the same scroll position and the same open items.
- Nothing MUST work only on hover: every action has a tap or a keyboard path.
- A keyboard shortcut MUST NOT act while a text field has the focus. A field's own keys, Enter and
  Ctrl+Enter or Cmd+Enter, are not shortcuts.
- Opening an item of a list, by a click, a tap, or a key, MUST NOT put the focus in a text field:
  its pane or page opens to read, with an Edit button at its top that edits in place. Checked by the
  tests of each pane.
- A list whose rows open a pane MUST move its selection from the keyboard: ↑ and ↓, or j and k, to
  the next or previous row, with the pane following on wide screens; Home and End to the first and
  last row; Enter to edit the selected item, or to open it when it has nothing to edit; Escape to
  close an open field, then the pane. The selected row MUST look different from the focused one.
  Checked by the browser tests of each list.

From the [UI components](../decisions/ui-components.md) decision:

- Views MUST use an Astryx component wherever one exists for the job.
- Raw `button`, `input`, `textarea`, `select`, and `dialog` elements MUST NOT be written in
  `packages/web/src`. Lint (`react/forbid-elements`) names the Astryx component to use instead.
- Components MUST NOT take a `style` prop, and Astryx components MUST NOT take a `className`. Their
  own styles go through `xstyle`.
- The app's own styles MUST be written with `stylex.create`, in the file of the component that uses
  them, and MUST use Astryx's tokens for colours, spacing, sizes, radii, borders, and type.
- Reordering by drag MUST use `@dnd-kit/react`. No other drag-and-drop library MAY be added.

From the [UI layout](../decisions/ui-layout.md) decision:

- Components MUST NOT write their own media queries with sizes. They read the width class from one
  shared hook, or the theme's adaptations.
- On narrow screens, a view MUST open as its own page. On wide screens, a detail the human checks
  while working through a list SHOULD open in a pane beside the list, which stays usable.
- An open detail, tab, or sheet that can be returned to MUST be in the URL, so a reload, Back, or a
  change of width keeps it.

From the [stack](../decisions/stack.md) decision:

- Workflow logic, parsing, validation, and workflow states MUST live in the Rust core,
  [`crates/core`](/crates/core/).
- TypeScript code MUST reach the core only through the binding, and MUST NOT reimplement its
  parsing, validation, or states.
- The TypeScript types of core data MUST come from the declarations napi-rs generates for the
  binding. They MUST NOT be redeclared by hand in TypeScript.
- The web UI MUST draw workflow files from the document tree the core sends, and MUST NOT parse
  their markdown, with a library or by hand.

From the [git](../decisions/git.md) decision:

- Rust tools MUST read git through gix; tools MUST run the system `git` binary for every write and
  for any read gix does not support.
- Tools MUST NOT bypass the user's hooks: no `--no-verify`.
- Drafts, backlog files, `PRIORITIES.md`, `INBOX.md`, and `INBOX-TRIAGE.md` MUST be written on the
  default branch, from every tool and from any checkout.
- In Rust, every git access MUST go through one module of the core, so no other code uses gix or
  builds `git` command lines.
- Output of the `git` binary MUST be parsed only in its plumbing, `--porcelain`, or `--format`
  forms, never as text meant for humans.

From the [code quality](../decisions/code-quality.md) decision:

- Rust and TypeScript functions MUST NOT be longer than 100 lines, take more than 7 parameters, or
  nest blocks more than 4 levels deep. Source files MUST NOT be longer than 500 lines; tests and
  generated files are exempt.
- A new marker MUST NOT be added unless a human approves it as a constitution exception in the
  plan's complexity tracking.
- Unit tests MUST NOT sleep for a fixed time, or assert how long something took.

From the [UI checks](../decisions/ui-checks.md) and [preview](../decisions/preview.md) decisions:

- Every UI test MUST guard a spec's acceptance scenario, edge case, or success criterion, or a rule
  of a UI decision. UI tests MUST drive the UI as a user does, through roles, labels, and visible
  text, and MUST NOT assert markup structure, class names, or snapshots.
- `vp run ready` MUST run, in WebKit, at 402 × 874 and at 1440 × 900, on every page a UI decision
  governs: no text cut, no sideways scroll, the text sizes and control heights, and axe-core's WCAG
  2.1 A and AA rules in light and dark.
- Before handing over a UI change, the agent MUST take screenshots of every changed view at both
  sizes and in both themes, review them, and commit them under `screenshots/` in the feature's
  folder.
- Mockups of Uraeda's planned UI and named states of its views MUST be Storybook stories, in a
  `<Component>.stories.tsx` file next to the component. Stories MUST NOT fake the server's
  responses.

From [the spec](spec.md), with the approval comments that replace parts of it:

- Exact texts: "Edit", "Open draft", "Open the feature", "Running", "Draft", "Backlog", "Add and
  commit", "Add", "Added to <Section> and committed", "Added to the inbox and committed", "Added to
  <Section>, not committed", "Added to <Section>. Not committed: PRIORITIES.md has other changes to
  commit or discard." (`INBOX.md` for a note), "Commit failed: <first line of the hook's output>",
  "Nothing waits on you.", "The inbox is empty.", "Nothing in Now.", "Nothing in Next.", "Show all
  (N)", "Constitution and decisions", "The project's principles and the choices agents follow",
  "Constitution", "Decisions · N", "Latest change first", "Latest change last", "A to Z",
  "Proposed", "No decisions yet.", "No constitution yet.", "Can't read this file".
- Commit messages: `chore: add "<short>" to <Section>`, `chore: add "<note>" to the inbox`,
  `chore: remove "<short>"`, `chore: remove "<note>" from the inbox`, and the existing
  `move "<note>" within <Category> in the inbox` change line.
- Section colours: Now blue, Next neutral, Later grey, Blocked orange, and the ongoing entries
  green, from Astryx's tokens, the words always there.
- C5 replaces US2's sixth scenario and the hint's edge case: **no keyboard hint** shows anywhere;
  `uraeda:hint:lists` is not used.
- C6 replaces US4's "In Now, started entries come first" on screen: started entries show in their
  own section, **"Ongoing"**, above Now, in green, with their step, without handles and without an
  add row; "Now · N" counts the others. The file keeps them at the top of Now, as US4's scenarios
  4–6 say. Rows are more compact on every width, and on narrow screens the sections lose their
  coloured side edge: only the heading carries the colour.
- C2 extends US1: picking "Edit" on a drafted entry also opens the draft's text in place, in the
  pane, in the editor of drafts, with its Save and Commit.

## Code read

- [`crates/core/src/files/priorities.rs`](/crates/core/src/files/priorities.rs): `parse`,
  `read(text, committed) -> Priorities`, `EntryItem`, `link` (keeps sub-items through
  `lines::replace`), `add_to_now` and `move_to_now` (end of Now), private `insert`. Items end at a
  blank line; blank lines between items keep them in one section
  ([`lines.rs`](/crates/core/src/files/lines.rs), `item_at`, `items`, `append_to_section`).
- [`crates/core/src/actions/priorities.rs`](/crates/core/src/actions/priorities.rs): `apply`'s hash
  check, `describe`, `line`, `short`;
  [`api/priority_edits.rs`](/crates/core/src/api/priority_edits.rs): `read_priorities` already reads
  the whole workspace through `open`, the writes do not.
- [`crates/core/src/actions/changes.rs`](/crates/core/src/actions/changes.rs) and
  [`changes/drafts.rs`](/crates/core/src/actions/changes/drafts.rs): the one change list,
  `message_of`, `commit` (refuses other staged files), `discard`, `never_committed` (expects a draft
  without nested lines).
- [`crates/core/src/actions/inbox.rs`](/crates/core/src/actions/inbox.rs):
  `note(place, category, marks, text, commit)` commits `INBOX.md` alone when it was clean (lines
  200–232), only from the CLI; [`files/inbox.rs`](/crates/core/src/files/inbox.rs) `insert_at`,
  `move_to`; [`files/inbox/read.rs`](/crates/core/src/files/inbox/read.rs) `InboxNote` has no
  children. `note_change` in `changes.rs` already describes a move within a category.
- [`crates/core/src/actions/draft.rs`](/crates/core/src/actions/draft.rs): `draft_entry` writes
  `proposal(&entry.text, &[])`; `from_note` rebases links with `retarget::rebase`.
- [`crates/core/src/actions/start/plan.rs`](/crates/core/src/actions/start/plan.rs): `add_to_now` at
  line 212 (typed text) and 357, `move_to_now` at line 361 (draft).
- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs), lines 612–635: `priority_entries`
  matches features and drafts; [`workspace/links.rs`](/crates/core/src/workspace/links.rs)
  `linked_draft` ignores backlog and existence; `Workspace.drafts` lists the existing draft and
  backlog files.
- [`crates/core/src/git.rs`](/crates/core/src/git.rs) and
  [`git/commit.rs`](/crates/core/src/git/commit.rs): `output()` runs git; `commit()` stages its
  paths then commits everything staged; no file date reader.
- [`crates/core/src/check/values.rs`](/crates/core/src/check/values.rs), line 24: a decision's
  allowed frontmatter fields.
- [`crates/core/src/watch.rs`](/crates/core/src/watch.rs) and
  [`packages/server/src/live.ts`](/packages/server/src/live.ts): the priorities hash covers
  `workspace.priorities` and drafts only; the priorities record is pushed only when that hash or the
  inbox's changes.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs) and
  [`inbox_writes.rs`](/crates/binding/src/inbox_writes.rs): `job(move || api::...)` exports;
  `vp run binding:build` regenerates `packages/binding/index.d.ts`.
- [`packages/server/src/fate/`](/packages/server/src/fate/): `sources.ts` (`fileSource` per record),
  `views.ts` (`dataView`, `Root`, near its limit at 485 lines), `mutations.ts` and
  `inbox-mutations.ts`; tests in `packages/server/src/__tests__/` (`testApp`, `byId`, `mutate`).
- Web: [`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx) (419 lines, drag machinery at
  192–331), [`InboxPage.tsx`](/packages/web/src/InboxPage.tsx),
  [`TaskView.tsx`](/packages/web/src/TaskView.tsx) (marker at 123),
  [`NoteView.tsx`](/packages/web/src/NoteView.tsx),
  [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx) (369 lines: `useDraft`, `useTextField`,
  `useSave`, `useEditorImages`, `EditorText`, `ConflictBanner`),
  [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx),
  [`SidebarAdd.tsx`](/packages/web/src/SidebarAdd.tsx),
  [`AddNote.tsx`](/packages/web/src/AddNote.tsx), [`Home.tsx`](/packages/web/src/Home.tsx),
  [`App.tsx`](/packages/web/src/App.tsx) (`TaskRoute`, `NoteRoute`),
  [`routes.tsx`](/packages/web/src/routes.tsx) (483 lines; `pathLink` at 465),
  [`data.ts`](/packages/web/src/data.ts) (474 lines),
  [`layout/Panes.tsx`](/packages/web/src/layout/Panes.tsx) (draws its own Close),
  [`theme/icons.ts`](/packages/web/src/theme/icons.ts) (Lucide outlines, registered at runtime).
- The mockups: [`lists/`](/packages/web/src/lists/), [`pane/`](/packages/web/src/pane/),
  [`decisions/`](/packages/web/src/decisions/), [`home/`](/packages/web/src/home/), and the
  `AddButtons` of `QuickAdd.tsx`, with their `TEMPORARY:` notes.
- The focus ring: [`Selection.tsx`](/packages/web/src/Selection.tsx), lines 46–62, writes
  `outlineStyle: {default: "none"}`, the same atomic class as Astryx's `focusWithin`, unlayered, so
  it beats Astryx's `@layer astryx-base` ring on every `ListItem`; the same for
  `borderBlockEndWidth` in `StoryEmbed.tsx`, `Question.tsx`, and `pane/EntryPane.tsx` against
  `ListItem`'s last-child rule.
- Tests: happy-dom in [`packages/web/src/__tests__/`](/packages/web/src/__tests__/) with
  `renderPage(path, repo)` and `atWidth`; browser tests in
  [`__browser__/`](/packages/web/src/__browser__/) with `atSize`, `show`, `checkLayout`, and the
  `PAGES` of `layout.test.tsx`; core tests in [`crates/core/tests/`](/crates/core/tests/) with
  `TestRepo`; screenshots with `vp run --filter uraeda-web screenshots`.
- Commands, inside `nix develop`: `cargo nextest run -p uraeda-core`, `vp run binding:build`,
  `vp test --project uraeda-server`, `vp test --project uraeda-web <file>`,
  `vp test --project desktop <file>`, `vp test --project phone <file>`, `vp check`, and the full
  `vp run ready`.

## Constitution check

| Principle                                  | Complies | Notes                                                                                |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| I. Humans stay in control                  | yes      | Commits only on the human's button; decisions stay read-only.                        |
| II. Git and plain text first               | yes      | Decisions gain an optional `icon` field, plain text, which the skill documents (C8). |
| III. Asynchronous by default               | yes      | The browser keeps display choices only.                                              |
| IV. Review effort matches impact           | yes      | The decisions page makes the rules readable.                                         |
| V. Tools are optional                      | yes      | The skill states the new rules: started entries on top, children into drafts, icons. |
| VI. Code is checked and stays maintainable | yes      | Shared list and pane replace two copies each; files near their limits split first.   |

## Decisions

- [UI behaviour](../decisions/ui-behaviour.md): no focus in a field on opening, the keyboard of
  lists, saving rules (tasks 10, 11, 12).
- [UI components](../decisions/ui-components.md): Astryx, StyleX tokens, dnd-kit (tasks 8–15).
- [UI layout](../decisions/ui-layout.md): panes and pages by width class (tasks 8–14).
- [UI checks](../decisions/ui-checks.md) and [preview](../decisions/preview.md): tests, layout
  checks, screenshots, stories (every web task, task 15).
- [Stack](../decisions/stack.md): core data through the binding (tasks 1–7).
- [Git](../decisions/git.md): `git commit --only` through `git.rs`, file dates with
  `git log --format` (tasks 6, 7).
- [Code quality](../decisions/code-quality.md): structural task 1, limits in every task.

## Complexity tracking

| Unit                                                                 | Why                                                                             | Simpler alternative rejected                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `lists/` (`WorkList`, `useDragOrder`, `useListKeys`)                 | One list for the priorities, the inbox, and the decisions' keyboard (spec, C7). | Two pages with their own rows and drag: the drift the human asked to end.     |
| `pane/EntryPane` and its bodies                                      | One top bar and in-place edit for priorities and notes (US1).                   | Edit buttons added to `TaskView` and `NoteView` separately.                   |
| `pane/DraftEditor` extracted from `EditorPage`                       | C2: the draft's text edited in the pane with the editor page's save and commit. | A second editor in the pane, duplicating the save, conflict, and image logic. |
| `api/ledger.rs` and the `ledger` record                              | US8: nothing reads decisions today.                                             | Raw files parsed in the UI: forbidden by the stack decision.                  |
| `Git::commit_only` and `Git::last_change`                            | Review focus 1, and the decisions' dates.                                       | Refusing when other files are staged: against the spec's edge case.           |
| `links.tsx` split from `routes.tsx`, `sessionData.ts` from `data.ts` | Both files are near 500 lines and gain routes and hooks.                        | Growing them past the limit.                                                  |

No function or file is left over a limit, and no new marker is added: task 11 removes `TaskView`'s.

## Review comments

- **C1** (rebase from main): done before the plan, the branch rebased on the default branch; the
  final review catches up again.
- **C2** (the body editable on Edit): task 11.
- **C3** (inbox header: a counter without text, aligned with "Inbox", "Organize with an agent" on
  the right, separated): task 9.
- **C4** (↵ in "Add and commit" on desktop): task 12.
- **C5** (no keyboard hint; a "Next" entry for keyboard navigation and its discoverability): the
  entry is in `PRIORITIES.md`'s Next, committed on the default branch before the plan; task 10
  builds no hint.
- **C6** ("Ongoing" section on top, more compact, no side borders on mobile): task 8.
- **C7** (the inbox as compact): task 9.
- **C8** (icons for decisions, as optional frontmatter, backfilled): task 7 (format, check, skill,
  backfill), task 14 (display).

---

## Task 1: Split the router and the data hooks

**Files:**

- Create: `packages/web/src/links.tsx` (`inApp`, `RouterAnchor`, `pathLink`, from `routes.tsx` lines
  409–483)
- Create: `packages/web/src/sessionData.ts` (`useSession`, `useReadOnceLive`, `useTurn`,
  `useTurnLog`, `useNavigation`, `useSessionSearch`, from `data.ts` lines 211–300)
- Modify: `packages/web/src/routes.tsx`, `packages/web/src/data.ts`, and their importers

**Interfaces:**

- Produces: `pathLink(path: string, repo: string): { href: string; inApp: boolean }` and
  `RouterAnchor` from `links.tsx`; the session hooks from `sessionData.ts`, which read `data.ts`'s
  now exported `useRefreshOnShow` and `WORKSPACE_ID`. No behaviour change.

- [x] **Step 1: Move the code, update the imports, keep the `exhaustive-deps` marker with its
      function**
- [x] **Step 2: Run the web tests**
  - Run: `vp check && vp test --project uraeda-web`
  - Expected: PASS, as before
- [x] **Step 3: Commit**

```bash
git add packages/web/src
git commit -m "refactor(redesign-priorities): split links from the router, and session hooks from the data hooks"
```

## Task 2: Entries say which draft and feature they have

**Files:**

- Modify: `crates/core/src/files/priorities.rs` (`EntryItem`), `crates/core/src/workspace.rs`,
  `crates/core/src/workspace/links.rs` (`LinkedFile`, `RunningFeature`,
  `Workspace::join_priorities`), `crates/core/src/api.rs`, `crates/core/src/api/priority_edits.rs`,
  `crates/core/src/watch.rs`, `packages/server/src/fate/views.ts` (`PrioritiesRecord` with the
  `StepRecord` treatment for the nested step), `packages/server/src/fate/sources.ts`
  (`sentPriorities`), `packages/server/src/fate/masked.ts`, `packages/server/src/fate.ts`
  (`PriorityEntry`), and the web's two `EntryItem` annotations, in `PrioritiesPage.tsx` and
  `lists/PrioritiesWork.tsx`, which read the record's `PriorityEntry` instead
- Test: `crates/core/tests/priorities.rs`, `crates/core/tests/watch.rs`,
  `packages/server/src/__tests__/fate.test.ts`

**Interfaces:**

- Produces, on `EntryItem`, napi camelCase:
  - `draft: Option<LinkedFile>`, `LinkedFile { path: String, backlog: bool }`: the linked file under
    `specs/drafts/` or `specs/backlog/`, set only when it exists on the default branch
    (`Workspace.drafts`, a folder's `proposal.md` counting as its folder).
  - `running: Option<RunningFeature>`,
    `RunningFeature { folder: String, change: bool, step: StepView }`: the feature or change the
    entry's link matches, while its step is not `done`.
- `api::read_priorities` and every priorities write's answer fill both from the workspace; the
  file-level `priorities::read` leaves them `None`.
- The watch's priorities hash covers the record as the core joins it, each entry's nested lines and
  each matched feature's step included, so `priorities: true` reports a feature that starts, moves a
  step, or finishes; `live.ts` pushes the priorities record on it, as today (R6).

- [x] **Step 1: Write the failing tests**
  - `priorities.rs`, `an_entry_links_its_existing_draft_or_backlog_file`: fixture with
    `drafts/git-listener.md` (exists), `backlog/benchmarks/proposal.md` (exists), and
    `drafts/missing.md` (missing) → `draft` is
    `{path: "specs/drafts/git-listener.md", backlog: false}`,
    `{path: "specs/backlog/benchmarks/proposal.md", backlog: true}`, and `None`. Break: trusting the
    link without checking the file (US4 scenario 3).
  - `an_entry_names_its_running_feature_until_done`: a Now entry linking a started feature's
    proposal → `running.folder` is the folder and `running.step.name` its step; once the feature is
    merged (a record in `specs/done/`) → `None`. Break: matching done features (edge case "a started
    entry whose feature is done").
  - `a_change_is_running_too`: a Now entry linking `/specs/changes/<dated>/proposal.md` on its
    branch → `running.change` is `true`.
  - `watch.rs`, `a_child_line_or_a_step_change_flags_the_priorities`: editing only a child line, and
    separately committing a step on a feature branch, both give `priorities: true`.
  - `fate.test.ts`,
    `US4.1 and US4.2: the priorities' entries carry their draft and running feature`: the fixture's
    "Git listener process" has its draft, "Web UI for the workflow files" its running feature, its
    step's `progress` sent as `null`. Break: the source sending the binding's answer without
    `sentPriorities`.
- [x] **Step 2: Run them to check they fail**
  - Run: `cargo nextest run -p uraeda-core -E 'test(/draft_or_backlog|running|child_line/)'`
  - Expected: FAIL, `no field 'draft' on type EntryItem` (compile error)
- [x] **Step 3: Implement the fields, the workspace join in the core's api layer, and the hash;
      rebuild the binding and send the fields from the server's source**
- [x] **Step 4: Run all tests**
  - Run:
    `cargo nextest run -p uraeda-core && vp run binding:build && vp test --project uraeda-server`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add crates/core packages/binding packages/server packages/web specs/2026-10-16-redesign-priorities
git commit -m "feat(redesign-priorities): entries say which draft and feature they have"
```

## Task 3: Started entries go to the top of Now

**Files:**

- Modify: `crates/core/src/files/priorities.rs` (new `add_started`, `move_to_started`; remove
  `add_to_now` and `move_to_now` once unused), `crates/core/src/actions/start/plan.rs` (lines 212,
  357, 361)
- Modify: `skills/uraeda/references/projects.md` (Start, step 1),
  `skills/uraeda/references/inbox.md` (line 171, "linked from the end of **Now**, where starting
  puts it"), `skills/uraeda/references/change.md` if it says where a change's entry goes
- Test: `crates/core/tests/files.rs`, `crates/core/tests/actions.rs`

**Interfaces:**

- Produces: `pub fn add_started(text: &str, link_text: &str, target: &str) -> String` and
  `pub fn move_to_started(text: &str, line: usize, link_text: &str, target: &str) -> Option<String>`.
  A started entry is one linking `/specs/<YYYY-MM-DD-slug>/proposal.md` or
  `/specs/changes/<YYYY-MM-DD-slug>/proposal.md`. The new entry goes after the last started entry of
  Now's first block, the entries before Now's first blank line; with no started entry there, it goes
  first, followed by one blank line when other entries follow. Same marker style as today.

- [x] **Step 1: Write the failing tests**, one table-driven test, `started_entries_go_on_top`, rows:
  - Now "A" (started), blank, "B" → start "C": "A", "C", blank, "B" (US4 scenario 4).
  - Now "B", "D" (not started) → start "C": "C", blank, "B", "D" (US4 scenario 5).
  - Now empty → start "C": "C" alone, no blank line (edge case).
  - Now "A" (started) only → start "C": "A", "C", no blank line.
  - Now "B", blank, "D" (first block not started) → start "C": "C", blank, "B", blank, "D" (review
    focus 2).
  - Numbered Now "1. A" (started), "2. B" → the new entry is numbered as today's `add_to_now`.
  - `move_to_started` moves an entry from Next with its children dropped, as `move_to_now` does.
  - `actions.rs`, `a_started_draft_tops_now`: `start` of a Next draft writes its entry first in Now.
- [x] **Step 2: Run them to check they fail**
  - Run: `cargo nextest run -p uraeda-core -E 'test(/started/)'`
  - Expected: FAIL, `cannot find function add_started`
- [x] **Step 3: Implement both functions with `lines.rs` helpers; switch `start/plan.rs` to them;
      update the skill's sentences ("at the top of **Now**, after the other started entries, then a
      blank line")**
- [x] **Step 4: Run all tests**
  - Run: `cargo nextest run && vp run specs:check`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add crates skills
git commit -m "feat(redesign-priorities): started entries go to the top of Now"
```

## Task 4: A draft takes its line's children

**Files:**

- Modify: `crates/core/src/actions/draft.rs` (`draft_entry`), `crates/core/src/files/priorities.rs`
  (`link` drops sub-items; an accessor for an entry's nested lines),
  `crates/core/src/actions/changes/drafts.rs` (`never_committed` passes the entry's former nested
  lines, read from the committed `PRIORITIES.md`)
- Modify: `skills/uraeda/references/projects.md` (Draft: "the line as its title and as the first
  paragraph of What, followed by its children, which leave the line")
- Test: `crates/core/tests/priorities.rs`, and `crates/core/tests/files.rs`
  (`priorities_link_an_entry` now expects the link alone)

**Interfaces:**

- Changes: `draft::create` writes `from_note(path, &entry.text, &dedented children)`, so links are
  rebased from `specs/` to the draft's folder; `priorities::link` replaces the whole item, sub-items
  included, by the one link line.

- [x] **Step 1: Write the failing tests**
  - `a_drafted_line_takes_its_children`: Later "Nix + Docker based execution environments" with
    child "with a cache" → the draft `specs/drafts/nix-docker-based-execution-environments.md` has
    the title, and What holds the line, a blank line, then `- with a cache`; the entry is the link
    alone (US6 scenario 1). Break: children kept under the line too.
  - `a_drafted_child_link_still_resolves`: child `[git](/specs/decisions/git.md)` and child
    `[git](decisions/git.md)` → both resolve from `specs/drafts/` (US6 scenario 2).
  - `discard_deletes_the_draft_and_gives_the_children_back` (US6 scenario 3), and
    `discard_after_a_note_draft_and_a_line_draft` (edge case).
- [x] **Step 2: Run them to check they fail**
  - Run: `cargo nextest run -p uraeda-core -E 'test(/drafted|discard_/)'`
  - Expected: FAIL, the draft's What lacks `- with a cache`
- [x] **Step 3: Implement; update the skill**
- [x] **Step 4: Run all tests**
  - Run: `cargo nextest run -p uraeda-core`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add crates skills
git commit -m "feat(redesign-priorities): a draft takes its line's children"
```

## Task 5: Notes have children and a place

**Files:**

- Modify: `crates/core/src/files/inbox/read.rs` (`InboxNote.nested`, `nested_spans`),
  `crates/core/src/files/inbox.rs` (`place`), `crates/core/src/actions/inbox.rs` (`place`),
  `crates/core/src/api/inbox_edits.rs`, `crates/binding/src/inbox_writes.rs`,
  `packages/server/src/fate/inbox-mutations.ts` (`inbox.place`); `views.ts` sends `categories`
  whole, so the notes' new fields need no change there (R7)
- Modify: `skills/uraeda/references/inbox.md` (a note can move to a place in its category, with its
  commit line)
- Test: `crates/core/tests/inbox.rs`, `crates/core/tests/inbox_moves.rs`,
  `packages/server/src/__tests__/inbox.test.ts`

**Interfaces:**

- Produces: `InboxNote { nested: Vec<String>, nested_spans: Vec<Vec<Span>> }`, as `EntryItem`;
  `actions::inbox::place(place, id: &str, category: Option<&str>, index: usize, previous: Option<&str>) -> Result<Inbox, ActionError>`;
  `api::place_note(repo, id, category: Option<String>, index: u32, previous) -> Result<Inbox>`;
  binding `placeNote(repo, id, index, previous, category?)`, the category last as in every inbox
  export (R7); mutation `inbox.place { hash, note, category?, index }` returning the inbox; `index`
  counts the category's notes once the note has left it.

- [x] **Step 1: Write the failing tests**
  - `a_note_shows_its_children`: a note with two children → `nested` holds both, `nested_spans`
    their spans (US5 scenario 3).
  - `a_note_moves_to_a_place_in_its_category`: UI's third note to index 0 → first of UI; the change
    list's subject is `move "<note>" within UI in the inbox` (US5 scenario 1).
  - `a_note_moves_to_a_place_in_another_category`: to CLI's end → last of CLI, subject
    `move "<note>" to CLI in the inbox` (US5 scenario 2).
  - `a_stale_hash_refuses_the_place` (review of the existing conflict rule).
  - `inbox.test.ts`: `inbox.place` answers the moved inbox.
- [x] **Step 2: Run them to check they fail**
  - Run: `cargo nextest run -p uraeda-core -E 'test(/children|place/)'`
  - Expected: FAIL, `no field 'nested' on type InboxNote`
- [x] **Step 3: Implement on `insert_at`; export; add the mutation; update the skill**
- [x] **Step 4: Run all tests**
  - Run:
    `cargo nextest run -p uraeda-core && vp run binding:build && vp test --project uraeda-server`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add crates packages/binding packages/server skills
git commit -m "feat(redesign-priorities): notes have children and a place"
```

## Task 6: An add can commit alone

**Files:**

- Modify: `crates/core/src/git/commit.rs` (`commit_only`), `crates/core/src/actions/commit.rs`,
  `crates/core/src/actions/priorities.rs`, `crates/core/src/actions/inbox.rs` (`note` uses the same
  path for the CLI), `crates/core/src/actions/inbox/undo.rs`,
  `crates/core/src/files/priorities/edits.rs` (`remove_added`),
  `crates/core/src/api/priority_edits.rs`, `crates/core/src/api/inbox_edits.rs`, the binding,
  `packages/server/src/fate/mutations.ts`, `inbox-mutations.ts`, `masked.ts`, `views.ts` (the
  records' `added`, after `sentInbox` moves to `sources.ts` in a `refactor(...)` commit)
- Modify: `skills/uraeda/references/inbox.md` (Capture, web UI: "＋ next to Inbox … 'Add and commit'
  commits the note alone, unless `INBOX.md` had other changes; 'Add' leaves it for the commit bar")
- Test: `crates/core/tests/priorities.rs`, `crates/core/tests/inbox_actions.rs`,
  `packages/server/src/__tests__/fate.test.ts`

**Interfaces:**

- Produces:
  - `Git::commit_only(&self, paths: &[String], subject: &str, body: Option<&str>) -> Result<(), GitError>`:
    `git add -- <paths>` then `git commit --only --quiet --message … -- <paths>`, hooks running;
    other staged files stay staged.
  - `actions::commit::Added { committed: bool, reason: Option<String>, message: Option<String> }`
    (napi object `AddCommit`, R8; `reason` is `"other-changes"` or `"hook-failed"`, `message` the
    hook's first line), and the binding's answers `PrioritiesAdded { priorities, added }` and
    `InboxAdded { inbox, added }`.
  - `api::add_priority_and_commit(repo, section_id, line, previous) -> Result<(Priorities, Added)>`
    and `api::add_note_and_commit(repo, category, about, text, previous) -> Result<(Inbox, Added)>`:
    write, then commit the file alone with `chore: add "<short>" to <Section>` or
    `chore: add "<short>" to the inbox` when the file equalled its committed text before the write.
  - `api::undo_committed_priority(repo, lines, previous)` and
    `api::undo_committed_note(repo, lines, previous)`: remove the entry or note, committed alone
    with `chore: remove "<short>"` or `chore: remove "<short>" from the inbox`; a stale hash refuses
    with the existing conflict message.
  - Mutations `priorities.add` and `inbox.add` take `commit?: boolean` and answer `added`, a field
    of the `Priorities` and `Inbox` records, null on every other answer; new
    `priorities.undoCommitted` and `inbox.undoCommitted`, taking `{ hash, lines }`.

- [x] **Step 1: Write the failing tests**
  - `an_add_commits_alone_on_a_clean_file`: subject `chore: add "Sort done features" to Next`, the
    commit holds `specs/PRIORITIES.md` only (US3 scenario 1).
  - `an_add_on_a_changed_file_is_not_committed`: `committed: false`, `reason: "other-changes"`, the
    entry written (US3 scenario 3).
  - `an_add_commits_alone_beside_other_staged_files`: a staged `README.md` stays staged and out of
    the commit (review focus 1).
  - `a_hook_failure_leaves_the_entry_written`: `reason: "hook-failed"`, `message` the hook's first
    line, nothing staged by the add left behind (edge case).
  - `a_note_commits_alone`: `chore: add "Icons are blurry" to the inbox` (US3 scenario 4).
  - `undo_of_a_committed_add_commits_the_removal` (US3 scenario 6) and
    `undo_after_the_file_changed_is_refused` (review focus 6).
  - For notes too: `a_note_on_a_changed_inbox_is_not_committed`,
    `undo_of_a_committed_note_commits_the_removal`; the server's US3 1, 3, 4, and 6 tests.
  - CLI's existing `crates/cli/tests/note.rs` still passes.
- [x] **Step 2: Run them to check they fail**
  - Run:
    `cargo nextest run -p uraeda-core -E 'test(/commits_alone|not_committed|hook_failure|undo_/)'`
  - Expected: FAIL, `cannot find function add_priority_and_commit`
- [x] **Step 3: Implement; export; add the mutations; update the skill**
- [x] **Step 4: Run all tests**
  - Run: `cargo nextest run && vp run binding:build && vp test --project uraeda-server`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add crates packages/binding packages/server skills
git commit -m "feat(redesign-priorities): an add can commit alone"
```

## Task 7: The core reads the constitution and decisions, with icons

**Files:**

- Create: `crates/core/src/api/ledger.rs`
- Modify: `crates/core/src/git/log.rs` (`last_change`), `crates/core/src/check/values.rs` (`icon`
  among a decision's optional fields), `crates/core/src/watch.rs` (`decisions` flag), the binding,
  `packages/server/src/fate/sources.ts`, `views.ts` (move the record views it gains to a new
  `views-ledger.ts` if it would pass 500 lines), `packages/server/src/fate.ts`,
  `packages/server/src/live.ts`; first, in a `refactor(...)` commit, a review's commands move from
  `crates/core/src/api.rs` to `api/reviews.rs`, so `api.rs` can gain the ledger's module
- Modify: `skills/uraeda/assets/templates/specs/decisions/decision-topic.md` and `preview.md`
  (`icon:` optional, empty), `skills/uraeda/references/conventions.md` (the status table:
  `decisions/*.md`, `icon`, set by the agent or the human, "a Lucide icon name, like `git-branch`"),
  `skills/uraeda/references/spec.md` (writing a decision: an icon for it), the example's decisions,
  and each of `specs/decisions/*.md` given an icon (C8)
- Test: `crates/core/tests/ledger.rs`, `crates/core/tests/check.rs`, `crates/core/tests/watch.rs`,
  `crates/core/tests/fields.rs` (a decision's fields list `icon`),
  `packages/server/src/__tests__/fate.test.ts`, `packages/server/src/__tests__/live.test.ts`

**Interfaces:**

- Produces: `api::read_ledger(repo) -> Result<Ledger>`, napi objects:
  - `Ledger { constitution: Option<Constitution>, decisions: Vec<Decision>, problems: Vec<Problem> }`
  - `Constitution { title, version, ratified, amended, principles: Vec<Principle>, document: Document }`,
    `Principle { number: "IV", slug: "iv", title, blocks: Vec<u32> }` (block ids of the principle's
    heading and the blocks under it), from `### <number>. <title>` headings and the
    `**Version**: … | **Ratified**: … | **Last Amended**: …` line.
  - `Decision { name: "ui-behaviour", title, status, approved_by: Option<String>, icon: Option<String>, summary: Option<String>, changed: Option<String> /* "2026-10-16" */, document: Document, problem: Option<String> }`:
    `title` from the H1, else the file name; `summary` the first sentence of the first paragraph;
    `changed` from `Git::last_change`; `problem` the check's first problem for the file.
  - `Git::last_change(&self, revision: &str, path: &str) -> Result<Option<String>, GitError>`:
    `git log -1 --format=%cs <revision> -- <path>`, given the default branch (R9).
  - Binding `readLedger(repo)`; fate record `Ledger`, id `ledger`, in `Root` as `ledgers`;
    `Changes.decisions` set when `specs/decisions/` or `specs/CONSTITUTION.md` change, pushing it.

- [x] **Step 1: Write the failing tests**
  - `ledger.rs`, `the_ledger_reads_the_constitution`: version `1.3.1`, ratified `2026-10-07`,
    amended `2026-10-14`, six principles from `I` "Humans stay in control" to `VI` (US8 scenario 1).
  - `the_ledger_reads_each_decision`: title, status, approved-by, icon, summary's first sentence,
    and the last commit date (US8 scenarios 1, 3, 7).
  - `a_decision_without_a_title_uses_its_file_name` and `an_unreadable_decision_names_its_problem`
    (review focus 7).
  - `no_decisions_or_no_constitution`: empty list, `None` (edge cases).
  - `check.rs`, `a_decision_may_have_an_icon`: no problem with `icon: git-branch`; still
    `frontmatter.unknown` for another field.
- [x] **Step 2: Run them to check they fail**
  - Run: `cargo nextest run -p uraeda-core -E 'binary(ledger) | test(icon)'` (R9)
  - Expected: FAIL, `cannot find function read_ledger`
- [x] **Step 3: Implement; export; add the record, the watch flag, and the push; give each decision
      of this repository an icon from Lucide (agents `bot`, attachments `paperclip`, cli `terminal`,
      code-quality `ruler`, distribution `package`, git `git-branch`, preview `eye`, repositories
      `folder-git-2`, sign-in `key-round`, stack `layers`, toolchain `wrench`, tui
      `square-terminal`, ui-behaviour `mouse-pointer-click`, ui-checks `scan-eye`, ui-components
      `component`, ui-layout `layout-panel-left`); update the template, the example, and the skill**
- [x] **Step 4: Run all tests**
  - Run:
    `cargo nextest run && vp run binding:build && vp test --project uraeda-server && vp run specs:check`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add crates packages/binding packages/server skills specs/decisions
git commit -m "feat(redesign-priorities): the core reads the constitution and decisions, with icons"
```

## Task 8: The priorities page on the shared list

**Files:**

- Start from:
  [`WorkList.stories.tsx#Priorities`](/packages/web/src/lists/WorkList.stories.tsx#Priorities)
- Create: `packages/web/src/lists/useDragOrder.ts` (the drag machinery of `PrioritiesPage.tsx` lines
  192–331: sensors, announcements, `useDrag`, generalised to sections of rows),
  `packages/web/src/lists/PrioritiesList.tsx` (from `PrioritiesWork.tsx`)
- Modify: `packages/web/src/lists/WorkList.tsx` (dragging, the "Ongoing" section, compact rows, no
  side edge on narrow screens, no `KeysHint`), `packages/web/src/PrioritiesPage.tsx` (title, error
  banner, `PrioritiesList`, `CommitBar`), `packages/web/src/Selection.tsx`, `StoryEmbed.tsx`,
  `Question.tsx`, `pane/EntryPane.tsx` (the focus ring and divider overrides, fixed where they come
  from), `packages/web/src/lists/WorkList.stories.tsx`
- Delete: `packages/web/src/lists/PrioritiesWork.tsx` (its `TEMPORARY:` join replaced by
  `EntryItem.draft` and `.running`)
- Test: `packages/web/src/__tests__/priorities.test.tsx`,
  `packages/web/src/__browser__/priorities.test.tsx`, `packages/web/src/__browser__/layout.test.tsx`

**Interfaces:**

- Consumes: `EntryItem.draft`, `EntryItem.running` (task 2).
- Produces:
  - `WorkList({sections, selected?, onMove?, isFocused?})`, `isFocused` putting the keyboard's focus
    on the selected row, for the `Selected` story,
    `WorkSection { id, title, tone: "green" | "blue" | "neutral" | "gray" | "orange", rows, footer?, isFixed? }`,
    `WorkRow { key, href, text, label?, lines, marks?, isFixed? }`;
    `onMove(row: string, section: string, index: number)` is called on a drop with the index among
    the section's rows on screen once the row is taken out, `Number.MAX_SAFE_INTEGER` for the end;
    the list stays as the drag left it until the promise it returns resolves.
  - `useDragOrder(sections, onMove)`: the dnd-kit wiring and announcements, as today's.
  - On the priorities page: "Ongoing · N" (green, entries with `running`, file order, no handle, no
    add row), then "Now · N" (the others), Next, Later, Blocked. A drop at screen index `i` of Now
    maps to the file position of the `i`-th entry of Now that is not running, or after the last of
    them (review focus 3): `fileIndex(entries, key, index)` in `PrioritiesList.tsx`. "Ongoing"
    gathers the running entries of every section and shows only when one runs (R10). The focus ring
    and the dividers use Astryx's own styles (R11).

- [x] **Step 1: Write the failing tests**
  - happy-dom `priorities.test.tsx`:
    - `ongoing entries show apart, with their step`: fixture → heading "Ongoing · 4", rows "Web UI
      for the workflow files" … each with "Running" and its step ("Plan" for "CLI TUIs"), no "Move
      …" button; "Now · 0" (C6, US4 scenario 1).
    - `a drafted entry shows Draft, a missing draft nothing`: "Git listener process" shows "Draft";
      an entry linking `drafts/missing.md` shows none (US4 scenarios 2, 3).
    - `a done feature's entry leaves Ongoing`: after the feature's merge, refresh → its entry is in
      Now with its handle (edge case, review focus 4).
    - Existing tests updated to the new headings, kept otherwise.
  - browser `priorities.test.tsx`:
    - `a drop in Now lands among the entries not started`: Now file "A" (started), blank, "B", "C",
      and "D" (started, last) → drag "C" above "B" → file "A", blank, "C", "B", "D" (review focus 3,
      US4 scenario 6).
    - `a focused row shows the focus ring`: tab to a row → its computed `outline-style` is not
      `none` (C6's list, the ring the UI behaviour decision asks for; Selection.tsx fix).
    - Existing drag tests (mouse, keyboard, touch 500 ms) still pass; the keyboard's moves a line of
      Later, since the fixture's Now holds only started entries, without handles.
  - `layout.test.tsx`: the priorities page's PAGES entry waits for "Ongoing"; narrow and wide checks
    pass (SC-004).
- [x] **Step 2: Run them to check they fail**
  - Run: `vp test --project uraeda-web packages/web/src/__tests__/priorities.test.tsx`
  - Expected: FAIL, `Unable to find role "heading" with name "Ongoing · 4"`
- [x] **Step 3: Implement; fix the focus ring and divider at their source (write those styles so
      they do not emit Astryx's atomic values, or layer the app's StyleX after Astryx's); remove
      `KeysHint`; update the stories (`Priorities`, `Selected` without the hint)**
- [x] **Step 4: Run all tests**
  - Run:
    `vp check && vp test --project uraeda-web && vp test --project desktop packages/web/src/__browser__/priorities.test.tsx packages/web/src/__browser__/layout.test.tsx && vp test --project phone packages/web/src/__browser__/layout.test.tsx`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(redesign-priorities): the priorities on the shared list, ongoing work apart"
```

## Task 9: The inbox on the shared list

**Files:**

- Start from: [`WorkList.stories.tsx#Inbox`](/packages/web/src/lists/WorkList.stories.tsx#Inbox)
- Modify: `packages/web/src/InboxPage.tsx` (header per C3, the body on `WorkList` with `onMove`
  calling `inbox.place`), `packages/web/src/lists/WorkList.stories.tsx`
- Delete: `packages/web/src/lists/InboxWork.tsx` (its `TEMPORARY:` children replaced by
  `InboxNote.nested`)
- Test: `packages/web/src/__tests__/inbox.test.tsx`, `packages/web/src/__browser__/inbox.test.tsx`

**Interfaces:**

- Consumes: `WorkList`, `useDragOrder` (task 8); `inbox.place`, `InboxNote.nested` (task 5).
- Produces: the inbox's header: "Inbox" and a neutral count badge on one line, vertically centred,
  then, on the right, set apart, "Organize with an agent".

- [x] **Step 1: Write the failing tests**
  - happy-dom: `the inbox heading shows a count without words` → heading "Inbox", a "10" badge, no
    "10 notes" text; `a note shows its children` (US5 scenario 3).
  - browser: `a note drags within its category` → file order and the commit bar's message
    `move "<note>" within UI in the inbox` (US5 scenario 1); `a note drags to another category`
    (scenario 2); `the keyboard moves a note` Space, ↓, Space (scenario 4); the inbox's layout
    checks at both sizes (SC-004).
- [x] **Step 2: Run them to check they fail**
  - Run: `vp test --project uraeda-web packages/web/src/__tests__/inbox.test.tsx`
  - Expected: FAIL, `Unable to find an element with the text: …` for the first child line
- [x] **Step 3: Implement**
- [x] **Step 4: Run all tests**
  - Run:
    `vp check && vp test --project uraeda-web && vp test --project desktop packages/web/src/__browser__/inbox.test.tsx && vp test --project phone packages/web/src/__browser__/inbox.test.tsx`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(redesign-priorities): the inbox on the shared list"
```

## Task 10: Lists move with the keyboard

**Files:**

- Create: `packages/web/src/lists/useListKeys.ts`, `packages/web/src/lists/listPane.ts`
- Modify: `packages/web/src/lists/WorkList.tsx`, `packages/web/src/App.tsx` (`TaskRoute`,
  `NoteRoute`: the pane follows the selection with `redirect`, so Back is not flooded; the page's
  key), `packages/web/src/EditableLine.tsx`, `TaskView.tsx`, `NoteView.tsx` (their Edit through
  `usePaneEdit`)
- Test: `packages/web/src/__browser__/lists.test.tsx`

**Interfaces:**

- Produces:
  - `useListKeys({selected, onSelect(index), onEdit(), onClose()}) -> {ref, focusSelected}`, built
    on Astryx's `useListFocus` over the rows' links (`[data-row] a[href]`, the `data-row` of each
    `WorkList` row's item), `ref` on the list's element: ↑ ↓ and j k move the focus, Home and End go
    to the first and last row across sections, then `onSelect`; Enter on the selected row calls
    `onEdit`, which returns whether it edited, else the row's link opens it; Escape calls `onClose`,
    which returns whether it closed something. It acts only when the event's target is a row's link
    or the page itself, never a text field or a row's handle, and when no dialog, no open popover
    other than the toasts', and no expanded popup trigger is in the page (review focus 5). No hint
    (C5).
  - `lists/listPane.ts`, the hook point between a list and its pane (R12): `ListPaneContext`, set by
    `TaskRoute` and `NoteRoute` with `useListPane(close)`; `WorkList` reads it, so its keys follow
    (`redirect`, the page's position kept), edit, and close only when a pane is open, and without
    one only the focus moves. A pane calls `usePaneEdit(edit, isEditing)`: Enter calls `edit`, and
    once `isEditing` turns false with the focus lost, the focus goes back to the row. Today
    `EditableLine isPaneEdit` (the task view's line) and `NoteView`'s line call it; task 11's
    `EntryPane` calls `usePaneEdit(onEdit, isEditing)` in their place.
  - `App`'s page key: a task or a note page is keyed by its history entry, not its address, so the
    list and its focus stay drawn while the pane follows in the same entry.

- [x] **Step 1: Write the failing tests**, browser, desktop:
  - `↓ selects the next row and the pane follows` (US2 scenario 1, SC-003: nine presses reach the
    tenth row).
  - `j crosses sections` (scenario 2).
  - `Enter opens the field; ↓ then moves the cursor` (scenario 3).
  - `Escape closes the field, then the pane` (scenario 4).
  - `End and Home` (scenario 5).
  - `k in the inbox` (scenario 7).
  - `keys do nothing while a Selector is open` (review focus 5).
- [x] **Step 2: Run them to check they fail**
  - Run: `vp test --project desktop packages/web/src/__browser__/lists.test.tsx`
  - Expected: FAIL, the address stays on the first entry after ↓
- [x] **Step 3: Implement**
- [x] **Step 4: Run all tests**
  - Run:
    `vp check && vp test --project uraeda-web && vp test --project desktop packages/web/src/__browser__/lists.test.tsx packages/web/src/__browser__/priorities.test.tsx`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(redesign-priorities): lists move with the keyboard"
```

## Task 11: Panes open to read, and edit in place

**Files:**

- Start from:
  [`EntryPane.stories.tsx#Reading`](/packages/web/src/pane/EntryPane.stories.tsx#Reading)
- Create: `packages/web/src/pane/DraftEditor.tsx` and `packages/web/src/pane/useDraftEditor.ts`,
  extracted from `EditorPage.tsx` (`useDraft`, the editor `useTextField` keyed `${path}#editor`,
  `useSave`, `useEditorImages`, `EditorText`, `ConflictBanner`, Save, Commit)
- Modify: `packages/web/src/EditorPage.tsx` (uses them), `packages/web/src/pane/EntryPane.tsx`,
  `pane/PriorityPane.tsx`, `pane/NotePane.tsx`, `pane/PaneDraft.tsx`, `packages/web/src/App.tsx`
  (`TaskRoute` and `NoteRoute` draw `PriorityPane` and `NotePane`; one Close only, the pane's),
  `layout/Panes.tsx` (its Close only with `onCloseDetail`; the detail scrolled to its top when
  `detailKey` changes), `routes.tsx` (`navigate` does not ask "Leave page?" when only the pane shows
  another item of its list, R14), `labels.ts` (`stepTitle`, and `waiting` from the step's
  `fileKind`, R13), `lists/PrioritiesList.tsx`, `packages/web/src/views.ts`,
  `crates/core/src/view/feature.rs` (`StepView.file_kind`), `packages/web/.storybook/fixture.ts` (a
  note's children for the `Note` story), `packages/web/src/pane/EntryPane.stories.tsx`
- Delete: `packages/web/src/TaskView.tsx`, `packages/web/src/NoteView.tsx` (their `renaming`
  fallback and `origin()` move into the panes and `usePriorityActions`; `NoteParts.tsx` becomes
  their only copy)
- Test: `packages/web/src/__tests__/pane.test.tsx` (from `task.test.tsx`; the note pane's Organize
  tests stay in `inbox.test.tsx`, which already reach them through the pane),
  `packages/web/src/__tests__/editor.test.tsx`, `priorities.test.tsx` (the gate's label),
  `packages/web/src/__browser__/task.test.tsx`, `layout.test.tsx` (the 768 px task test),
  `lists.test.tsx` (the pane's scroll), `crates/core/tests/steps.rs` (`file_kind`)

**Interfaces:**

- Consumes: `EntryItem.draft`, `.running` (task 2), `InboxNote.nested` (task 5).
- Produces:
  `EntryPane({location, onEdit, isEditing, draftHref?, onClose?, onDelete, steps, text, children})`,
  which calls `usePaneEdit(onEdit, isEditing)`; `useDraftEditor({draft, isDrawnFirst, path, slug})`;
  `stepTitle(step)`, what a step asks of the human at a gate, like "Review the spec"; picking "Edit"
  opens the line's field (cursor in it) and, for a drafted entry, the `DraftEditor` of its draft
  under it (C2), 20 rows, with "Save" (Ctrl+Enter or Cmd+Enter) and "Commit" as on the editor page;
  the pane and the editor page share the unsaved text of `${path}#editor`.

- [x] **Step 1: Write the failing tests**, happy-dom `pane.test.tsx`:
  - `a click opens the pane to read`: "Git listener process" → "Next · 2 of 2", "Edit", "Open
    draft", the draft drawn, `document.activeElement` not a textbox (US1 scenario 1, SC-005).
  - `Edit opens the line and the draft's text in place`: textbox "Line" holds
    `[Git listener process](drafts/git-listener.md)`, focused; a 20-row textbox "Text" holds the
    draft's text (US1 scenario 2, C2).
  - `Enter saves the line`: "Git listener" in the list and the pane; "1 change to commit" (US1
    scenario 3).
  - `the draft's text saves in place`: change What, Ctrl+Enter → the file on disk has it; "Commit"
    commits it (C2).
  - `Open draft opens the editor page` (US1 scenario 4).
  - `a note opens to read`: "Note, in No category", its children, "Edit", no focused textbox (US1
    scenario 5).
  - `on a phone, the page opens to read` at 402 px (US1 scenario 6).
  - `a running entry's pane`: "Running", its step, "Open the feature", no section picker (US1
    scenario 7).
  - `another row with unsaved text`: type in the line's field, open another row, come back → the
    text is restored with its notice (edge case).
  - The existing task and note tests kept, moved, and updated to the read-first path.
  - `editor.test.tsx`: `the draft's text typed in the pane opens on the editor page` (R1).
  - `priorities.test.tsx`: `an ongoing entry at a gate says what it asks of the human`, "Answer
    questions", not "Waiting on you" (the spec's assumption, R13); core `steps.rs`:
    `a_gate_names_the_kind_of_its_file`.
  - Browser `lists.test.tsx`: `the pane starts at its top when the keys show another row`.
- [x] **Step 2: Run them to check they fail**
  - Run: `vp test --project uraeda-web packages/web/src/__tests__/pane.test.tsx`
  - Expected: FAIL, `Unable to find role "button" with name "Edit"`
- [x] **Step 3: Implement; the stories `Reading`, `Editing` (now showing the draft's text too),
      `Running`, `Note` use the real panes**
- [x] **Step 4: Run all tests**
  - Run:
    `vp check && vp test --project uraeda-web && vp test --project desktop packages/web/src/__browser__/task.test.tsx packages/web/src/__browser__/layout.test.tsx`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(redesign-priorities): panes open to read, and edit in place"
```

## Task 12: Add and commit

**Files:**

- Start from: [`QuickAdd.stories.tsx#Priority`](/packages/web/src/QuickAdd.stories.tsx#Priority)
- Modify: `packages/web/src/QuickAdd.tsx` (`AddButtons` with the ↵ icon in "Add and commit" on wide
  screens, C4), `packages/web/src/AddNote.tsx` (its row uses `AddButtons`, keeping `AttachButton`),
  `packages/web/src/SidebarAdd.tsx` (results, toasts, Undo of a committed add),
  `packages/web/src/theme/icons.ts` (`uraeda:enter`, Lucide `corner-down-left`),
  `packages/web/src/QuickAdd.stories.tsx` (the `TEMPORARY:` `NoteForm` replaced by `AddNote`)
- Test: `packages/web/src/__tests__/quick-add.test.tsx`, `packages/web/src/__tests__/shell.test.tsx`

**Interfaces:**

- Consumes: `priorities.add` and `inbox.add` with `commit`, `added`, and the `undoCommitted`
  mutations (task 6).

- [x] **Step 1: Write the failing tests**, happy-dom:
  - `Enter adds and commits`: "Sort done features", Next → `git log -1` subject
    `chore: add "Sort done features" to Next`, toast "Added to Next and committed" (US3 scenario 1).
  - `Add leaves it uncommitted`: toast "Added to Next, not committed" (scenario 2).
  - `a changed file only adds`: the form shows "Added to Next. Not committed: PRIORITIES.md has
    other changes to commit or discard." and stays open (scenario 3).
  - `a note adds and commits` (scenario 4); `four taps from the phone's home` at 402 px (scenario 5,
    SC-002); `Undo commits the removal` (scenario 6); `a failed hook shows its first line` ("Commit
    failed: …", edge case); `Undo after a change elsewhere shows the conflict` (review focus 6).
  - `the ↵ icon shows on wide screens only`: the button's accessible name stays "Add and commit".
- [x] **Step 2: Run them to check they fail**
  - Run: `vp test --project uraeda-web packages/web/src/__tests__/quick-add.test.tsx`
  - Expected: FAIL, `Unable to find role "button" with name "Add and commit"`
- [x] **Step 3: Implement**
- [x] **Step 4: Run all tests**
  - Run: `vp check && vp test --project uraeda-web`
  - Expected: PASS
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(redesign-priorities): add and commit from the ＋ forms"
```

## Task 13: Home as a control hub

**Files:**

- Start from: [`Home.stories.tsx#Hub`](/packages/web/src/Home.stories.tsx#Hub)
- Modify: `packages/web/src/Home.tsx` (draws `HomeHub` inside `Page`, keeping `useRestoreScroll` and
  the no-specs banner; the old groups removed), `packages/web/src/home/HomeHub.tsx` (split into one
  file per card if it passes 500 lines), `packages/web/src/home/summary.ts` (running entries from
  `EntryItem.running` through the workspace's priorities, no folder matching of its own)
- Test: `packages/web/src/__tests__/home.test.tsx` (rewritten for the hub),
  `packages/web/src/__tests__/inbox.test.tsx` (its home part), `layout.test.tsx` (home's PAGES entry
  waits for "Needs you")

**Interfaces:**

- Consumes: `EntryItem.running` (task 2), the decisions route `/decisions` (task 14 adds the page;
  the card's link exists already).

- [ ] **Step 1: Write the failing tests**, happy-dom `home.test.tsx`, one per US7 scenario 1–8, with
      the counts "Needs you 4", "Agents 4", "Now 4", "Inbox 10" from the fixture, "Now | Next" kept
      in `uraeda:home:priorities` across a reload, the titles' links, no "Organize" link, "Show all
      (7)" on a repository with seven done features, "Nothing waits on you.", and the phone order;
      plus "The inbox is empty." and "Nothing in Next." (edge cases).
- [ ] **Step 2: Run them to check they fail**
  - Run: `vp test --project uraeda-web packages/web/src/__tests__/home.test.tsx`
  - Expected: FAIL, `Unable to find role "heading" with name "Needs you"`
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run all tests**
  - Run:
    `vp check && vp test --project uraeda-web && vp test --project desktop packages/web/src/__browser__/layout.test.tsx && vp test --project phone packages/web/src/__browser__/layout.test.tsx`
  - Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(redesign-priorities): home as a control hub"
```

## Task 14: The constitution and decisions page

**Files:**

- Start from:
  [`DecisionsPage.stories.tsx#List`](/packages/web/src/decisions/DecisionsPage.stories.tsx#List)
- Modify: `packages/web/src/decisions/*` (data from `useLedger`, documents drawn with `Blocks`, the
  keyboard through `useListKeys`, no hint; `model.ts` keeps only the sort, with the values
  `changed-desc`, `changed-asc`, `title` under `uraeda:decisions:sort`, and the date format),
  `packages/web/src/routes.tsx` (`decisions`, `decision {name}`, `principle {slug}`),
  `packages/web/src/links.tsx` (`pathLink` sends `specs/decisions/<name>.md` and
  `specs/CONSTITUTION.md` to the page), `packages/web/src/App.tsx`, `packages/web/src/data.ts`
  (`useLedger`), `packages/web/src/views.ts` (`LedgerView`), `packages/web/src/theme/icons.ts` (the
  sixteen Lucide icons of task 7, and a default for an unknown name)
- Delete: `packages/web/src/decisions/samples.ts` (stories read the fixture's ledger; the fixture
  repository gains a few decisions with icons and a constitution)
- Test: `packages/web/src/__tests__/decisions.test.tsx`, `packages/web/src/__tests__/links.test.ts`,
  `layout.test.tsx` (PAGES: the decisions, a decision open)

**Interfaces:**

- Consumes: `readLedger` and the `Ledger` record (task 7), `useListKeys` (task 10).

- [ ] **Step 1: Write the failing tests**, happy-dom, one per US8 scenario 1–7 on the fixture's
      ledger: the version line and the principle cards, "Decisions · N" latest first, "A to Z" kept
      across a reload, a decision's pane at `/decisions/<name>` with its status, approver, and
      sections, a principle's at `/decisions/constitution/iv`, ↓ from the last principle to the
      first decision, a spec's link to `../decisions/git.md` opening the page, "Proposed" on a
      proposed decision; plus each decision's icon (C8), an unknown icon's default, "No decisions
      yet.", "No constitution yet.", and "Can't read this file" (edge cases, review focus 7).
- [ ] **Step 2: Run them to check they fail**
  - Run: `vp test --project uraeda-web packages/web/src/__tests__/decisions.test.tsx`
  - Expected: FAIL, the route `/decisions` draws the missing page
- [ ] **Step 3: Implement; the stories `List`, `Decision`, `Principle`, `SortedAToZ` run on the
      fixture's data**
- [ ] **Step 4: Run all tests**
  - Run:
    `vp check && vp test --project uraeda-web && vp test --project desktop packages/web/src/__browser__/layout.test.tsx && vp test --project phone packages/web/src/__browser__/layout.test.tsx`
  - Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add packages/web fixtures
git commit -m "feat(redesign-priorities): the constitution and decisions page"
```

## Task 15: Check every view, and take its screenshots

**Files:**

- Modify: `packages/web/scripts/screenshots.ts`, `packages/web/scripts/inbox-shots.ts` (views: home,
  priorities, inbox, pane-reading, pane-editing, quick-add, decisions, decision)
- Create: `specs/2026-10-16-redesign-priorities/screenshots/*.webp`

- [ ] **Step 1: Run the full validation**
  - Run: `nix develop -c vp run ready`
  - Expected: PASS
- [ ] **Step 2: Take the screenshots of every changed view at both sizes and in both themes**
  - Run: `nix develop -c vp run --filter uraeda-web screenshots 2026-10-16-redesign-priorities`
  - Expected: one `.webp` per view, size, and theme
- [ ] **Step 3: Review them against the UI decisions, the stories, and the approval comments; fix
      what they show, each fix with its test**
- [ ] **Step 4: Commit**

```bash
git add packages/web/scripts specs/2026-10-16-redesign-priorities/screenshots
git commit -m "test(redesign-priorities): screenshots of every changed view"
```
