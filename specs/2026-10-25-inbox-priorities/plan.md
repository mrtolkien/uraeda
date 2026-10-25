---
status: auto-approved
spec-revision: 2
---

# Plan: Inbox and priorities in the terminal look

**Goal:** Redraw the priorities as scrolling columns of draggable cards and the inbox as a pane per
category, with a section context read from `PRIORITIES.md`, a detail in an overlay, a `…` menu on
every card, categories you create, rename, and delete, and Blocked retired.

**Architecture:** The core owns every rule of the two files, and the pages only draw. Two new core
rules: a section's context (`files/priorities/context.rs`), read by both the page's data and
`ura check`, and the category edits (`files/inbox/categories.rs`, validated and written by
`actions/inbox/categories.rs`), whose delete returns the file as it was, so its Undo restores it
byte for byte. The binding and the server pass them on. On the web, one `Card` (frame, marks in its
border, selection, `…` slot, dragged from anywhere) is drawn by `WorkList`, which arranges titled
panes as scrolling columns (priorities) or a stack (inbox, and the phone). `DetailOverlay` draws the
detail on the line's URL over the page, which stays mounted. The line menu reuses
`usePriorityActions` and `useNoteActions`, and every move goes through `fileIndex`, so no rule is
copied. See [the spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from it, so the implementer reads both.

## Review focus

1. **The page stays mounted under the overlay.** `pageKey` in [App.tsx](/packages/web/src/App.tsx)
   keys a `task` route differently from `/priorities`, so opening or closing the overlay would
   remount the list: the selection and the scroll position would be lost, and "the card is still
   selected" would fail. `/priorities` and `/priorities/<key>` share a key, so do `/inbox` and
   `/inbox/<key>`. Task 6.
2. **Back closes the overlay in one press, and Previous and Next add no entry.** The shared
   `Overlay` pushes a history entry of its own through `useBackCloses`, and a route already pushed
   one: a click, a reload on the address, Back, and Previous and Next each leave exactly one entry
   to go back over. Task 6.
3. **The other lists keep working.** `TaskRoute` opened from home (`from === "/"`) draws the overlay
   over home; `LedgerRoute` and the decisions page keep their pane and `useListKeys` behaviour.
   Tasks 6 and 9.
4. **Every move goes through `fileIndex`.** Move up, down, to the top, and to the bottom of a
   priority skip the running entries that show in Ongoing, as a drag does. Task 7.
5. **Dropping on Ongoing, or moving a running card, writes nothing.** Task 5 for the drop, task 7
   for the menu.
6. **A press moves a card only past 5 px, and a drag never opens it.** A drag that ends over the
   card it started on does not also open the overlay. Task 1.
7. **A category delete and its Undo give the file back byte for byte**, with Yes and with No, for a
   first and a last category, a file without a final newline, notes before the first heading, and
   two headings of the same name. Task 3.
8. **A category name round-trips as a heading.** A name that `category_of` would read back
   differently, such as one ending in ` #` or holding a line break, is refused, not written as a
   different name. Task 3.
9. **The page hides an empty `## Blocked`, and shows one with lines.** The core's output stays as it
   is: `read` keeps its four sections. Tasks 2 and 5.
10. **A held click on `…` or a press on its menu never starts a drag**, and a drag that starts
    beside it never opens the menu. Task 7.

## Global constraints

Every task's requirements include these. Decisions are copied word for word.

- A human's direct request stands above any test, decision, rule, or the constitution; a test that
  fails because of a requested change is the test to change, after a ruling
  ([AGENTS.md](/AGENTS.md)).
- **Authorship**: never mention a coding agent, a model, or an AI tool as an author or a tool used:
  no `Co-Authored-By` lines and no "generated with" footers in a commit message, a file, or the pull
  request, whatever a harness's own attribution rule says ([AGENTS.md](/AGENTS.md#authorship)).
- **Shell**: run the toolchain as `nix develop -c <command>`, and quote globs.
- [Stack](/specs/decisions/stack.md): "Workflow logic, parsing, validation, and states MUST live in
  the Rust core, and TypeScript MUST reach them only through the binding, never reimplemented." and
  "The web UI MUST draw workflow files from the core's document tree, never parsing their markdown."
- [Compatibility](/specs/decisions/compatibility.md): "A feature that changes a format MUST update
  the templates, examples, fixtures, and default-branch files it affects, in the same branch." The
  spec's approval keeps a retired `## Blocked` readable, with a warning, which this decision's "no
  fallback reading" would not: the approved spec wins (ruling R1).
- [UI behaviour](/specs/decisions/ui-behaviour.md): "Every action MUST work by tap and by keyboard,
  never by hover alone." "Back and reload MUST keep the human's place and what they were reading."
  "Small edits MUST happen in place, and a dialog MUST only confirm an irreversible action or hold a
  short form." "Lists whose rows open a pane SHOULD share one keyboard behaviour."
- [UI layout](/specs/decisions/ui-layout.md): "An open detail, tab, or sheet MUST be in the URL, so
  reload, Back, or a width change keeps it." "On narrow screens, views MUST be pages and menus and
  forms sheets; on wide screens, popovers and dialogs." The UI adapts through the theme's three
  width classes, "never per-view media queries".
- [UI components](/specs/decisions/ui-components.md): "Drag and drop MUST use `@dnd-kit/react`."
  "Views MUST use Astryx components wherever one fits the job, and be styled only through its theme,
  with no global stylesheet or inline styles."
- [UI coherence](/specs/decisions/ui-coherence.md): "A kind of information MUST be drawn by one
  shared component on every page that shows it."
- [UI look](/specs/decisions/ui-look.md): "The UI MUST look like a terminal tool: square corners,
  and content grouped in bordered panes whose title sits in their top border." Text colours reach
  4.5:1 and borders and controls 3:1, in both schemes.
- [UI checks](/specs/decisions/ui-checks.md): "UI tests MUST drive the UI as a user does, and MUST
  NOT assert markup, class names, or pixels." Before handing over, screenshots of every changed view
  at both sizes and in both themes are reviewed and committed.
- [Preview](/specs/decisions/preview.md): a spec's mockups are stories written with the real
  components; stories do not run as tests.
- [Code quality](/specs/decisions/code-quality.md): TypeScript files stay within 500 lines,
  functions within 100, nesting 4, parameters 7; Rust functions within 100 lines. No unit of this
  branch carries a marker, and no task adds one. Unit tests never wait for elapsed time.
- **Exact text** of the spec and its answered rounds, never reworded:
  - "Running now: an agent works or waits on you." (Ongoing's context).
  - "What is worked on, in order: Ongoing runs now, then Now, Next, and Later." (the priorities'
    purpose line).
  - "Things noticed, not decided: turn each into a priority, a draft, or nothing." (the inbox's).
  - "A category named Prompts exists." (with the category's name), "A category needs a name.", "That
    line is gone.", "Delete the N notes too?" with three bordered lines, Yes (Y), No (N), and Cancel
    (C); "New category"; "Add to Next" (with the section's title); "Blocked is retired: move its
    lines".
  - A drag starts after 5 px of a mouse press, and after a touch press of half a second. A context
    is the first callout of any type before a section's first entry, its first paragraph after the
    marker. The overlay is 108 characters of the page's font wide, about 1,060 px, and 60% of the
    window tall, a bottom sheet on the phone. Columns are at least 400 px wide.
- **Preserved guarantees**: each change is written at once over the hash it read, and a stale hash
  is refused as a conflict ([`apply`](/crates/core/src/actions/inbox.rs)); the commit bar commits
  later; a running entry never moves or deletes; Add rows end each section; "Organize with an agent"
  and its banner stay; Undo toasts of deletes and moves stay
  ([useUndoToast](/packages/web/src/layout/useUndoToast.ts)).
- **Commits**: `<type>(inbox-priorities): <summary>`, one per task, the code, tests, and checked
  boxes together, following [Commits](/skills/uraeda/references/conventions.md#commits).
- **Validation**: after each task, `nix develop -c vp run fast`. Before the push,
  `nix develop -c vp run ready`.

## Code read

- [`files/priorities.rs`](/crates/core/src/files/priorities.rs) and its
  [`edits.rs`](/crates/core/src/files/priorities/edits.rs): `Section` has four values and
  `from_heading` finds headings by title; `parse` takes only list items, so a callout is never an
  entry; `read` builds `SectionItems` for all four sections, empty ones included. Tests:
  [`tests/priorities.rs`](/crates/core/tests/priorities.rs).
- [`check/sections.rs`](/crates/core/src/check/sections.rs): `check_priorities` requires the four
  headings; `File::warning` makes a warning that does not fail the check. Its test is
  [`tests/check.rs`](/crates/core/tests/check.rs) line 373.
- [`files/inbox.rs`](/crates/core/src/files/inbox.rs): `category_of`, `category_names`,
  `category_headings`, `add`, `scan`. [`files/inbox/read.rs`](/crates/core/src/files/inbox/read.rs):
  `Inbox.categories` holds only categories with notes, and `Inbox.names` every name once, in file
  order. [`actions/inbox.rs`](/crates/core/src/actions/inbox.rs): `apply` writes over `previous` or
  refuses with the stale message. [`api/inbox_edits.rs`](/crates/core/src/api/inbox_edits.rs): one
  function per edit under the write lock.
- [`binding/src/inbox_writes.rs`](/crates/binding/src/inbox_writes.rs) and
  [`server/fate/inbox-mutations.ts`](/packages/server/src/fate/inbox-mutations.ts): each edit is a
  napi function and a fate mutation returning the `Inbox` record, `added` sent as null on other
  answers ([`fate/views.ts`](/packages/server/src/fate/views.ts)); `sections: true` of the
  priorities view carries any new field of `SectionItems`. Server tests:
  [`__tests__/inbox.test.ts`](/packages/server/src/__tests__/inbox.test.ts),
  [`fate.test.ts`](/packages/server/src/__tests__/fate.test.ts).
- [`lists/WorkList.tsx`](/packages/web/src/lists/WorkList.tsx) (358 lines): sections as headings and
  `ListItem` rows with a handle, drag by `useDragOrder`, keys by `useListKeys`, selection from the
  URL. [`PrioritiesList.tsx`](/packages/web/src/lists/PrioritiesList.tsx): `byRunning`, `fileIndex`,
  Ongoing, Add rows. [`InboxPage.tsx`](/packages/web/src/InboxPage.tsx): `InboxList` hides empty
  categories. [`useDragOrder.ts`](/packages/web/src/lists/useDragOrder.ts): `SENSORS` take the
  handle on a mouse and half a second on a touch, and a keyboard sensor.
- [`App.tsx`](/packages/web/src/App.tsx): `TaskRoute` and `NoteRoute` draw list and detail with
  `Panes` and `ListPaneContext`; `pageKey` remounts a task or note route per entry.
  [`layout/Overlay.tsx`](/packages/web/src/layout/Overlay.tsx) and
  [`useBackCloses.ts`](/packages/web/src/layout/useBackCloses.ts): the shared overlay, its pushed
  entry, and `openOverlayAt` for an overlay an address names.
- [`pane/`](/packages/web/src/pane/): `EntryPane` draws the bar, body, Delete, and `Steps` (which
  navigates by pushing); `PriorityPane`, `NotePane` find their line and call `usePriorityActions`
  and `useNoteActions`, whose `move`, `draft`, `startChange`, `remove`, `toPriorities`,
  `toNewDraft`, `toDraft`, `toCategory` the menu reuses.
- Tests: Vitest in happy-dom under [`__tests__/`](/packages/web/src/__tests__/), and in WebKit under
  [`__browser__/`](/packages/web/src/__browser__/) (`helpers.tsx`: `show`, `atSize`, `pickUp`,
  `commands.tap`), each browser test on a fresh copy of
  [the fixture repository](/fixtures/repo/main/specs/PRIORITIES.md). The phone project runs with
  `hasTouch`. Stories: [`WorkList.stories.tsx`](/packages/web/src/lists/WorkList.stories.tsx) over
  the fixture's real data. Screenshots:
  [`scripts/screenshots.ts`](/packages/web/scripts/screenshots.ts) and the `*-shots.ts` scripts
  beside it.

## Constitution check

| I. Humans stay in control | II. Git and plain text first | III. Asynchronous by default | IV. Review effort matches impact | V. Tools are optional | VI. Code is checked and stays maintainable |
| ------------------------- | ---------------------------- | ---------------------------- | -------------------------------- | --------------------- | ------------------------------------------ |
| ✅                        | ✅                           | ✅                           | ✅                               | ✅                    | ✅                                         |

## Complexity tracking

| Addition                                                        | Why                                                                                                    | Simpler alternative rejected                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `Card`, replacing `RowItem` and `SortableRow`                   | One card on both pages (UI coherence), the drag source and `…` owner                                   | Keeping `ListItem` rows: no marks in the border, a handle               |
| `SectionContext` and `contexts` (core)                          | `read` and `ura check` need the same rule for what is a callout and its text                           | Two parsers: a rule copied across layers                                |
| `categories.rs` in the core's files and actions                 | Create, rename, and delete share the name rule; each file stays a unit of one responsibility           | Growing `files/inbox.rs` (427 lines) and `actions/inbox.rs` (410 lines) |
| `restore_category(before)`: Undo writes the file back whole     | SC-006 asks byte for byte, with repeated headings and missing newlines                                 | An inverse edit of heading and notes: a second rule that can drift      |
| `lists/cardMoves.ts`: the index of an up, down, top, or bottom  | The menu's four moves need `fileIndex`, which a drag already owns                                      | Computing indexes in the menu: skips running entries wrongly            |
| `Overlay` takes a size; `DetailOverlay` (shared by both routes) | Priorities and inbox draw one detail over the page; the dialog's size is the spec's                    | Two overlays: a card's detail drawn twice (UI coherence)                |
| A raw `div` for the card's frame and the columns' scroll row    | Astryx gap: no component draws marks in a border, or a row of panes that scrolls (`Pane` is the app's) | None: the lint accepts a raw element with this reason                   |

No unit grows past a limit, no marker is added, no constitution exception is taken.

## Test map

The Rust tests run on in-memory texts and temporary git repositories through the real core, as the
existing ones of `crates/core/tests` do. The server tests run through the real binding over a
fixture repository. The browser tests (WebKit, desktop and phone projects) render the real app on a
fresh copy of the fixture repository, drive it with the pointer, the keyboard, and taps, and read
the files the app wrote. Happy-dom tests own pure functions only. No test waits a fixed time.

| Spec item                                             | Task | Test                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1 key 1 (1150 px: the row scrolls)                  | 5    | `priorities-columns`: "at 1150 px the row scrolls and each pane is 400 px or more" (ruling R2)                                                                                                                            |
| US1 key 2 (drag 40 px, press under 5 px)              | 1    | `card-drag`: "a press of 4 px opens the card" and "40 px over Next writes the line there"                                                                                                                                 |
| US1 key 3 (running card, Ongoing's context)           | 5    | `priorities-columns`: "a running card does not move, and Ongoing says what it is"                                                                                                                                         |
| US1 more 1 (390 px stack, touch press)                | 5    | `priorities-columns`, phone: "the panes stack in order" and the existing touch drag                                                                                                                                       |
| US1 more 2 (empty Next)                               | 5    | `priorities-columns`: "an empty pane shows its context and its Add row"                                                                                                                                                   |
| US1 more 3 (`l` to the same row)                      | 9    | `list-keys`: "l selects the card at the same row of the next column, or the last"                                                                                                                                         |
| US2 key 1 (TIP callout, `>` line)                     | 2, 4 | `tests/priorities.rs` "context of a TIP callout with a blank quote line"; `fate.test.ts` "the priorities carry each section's context"                                                                                    |
| US2 key 2 (marker alone)                              | 2    | `tests/check.rs` "a callout with its text in a separate quote warns"; `tests/priorities.rs` "no context"                                                                                                                  |
| US2 key 3 (Blocked with a line)                       | 2, 5 | `tests/check.rs` "a Blocked with lines warns it is retired"; `priorities-columns` "a Blocked pane shows under the columns"                                                                                                |
| US2 more 1 (new project)                              | 2    | `tests/init.rs` "a new project's PRIORITIES.md has no Blocked and no warning"                                                                                                                                             |
| US2 more 2 (empty Blocked)                            | 2, 5 | `tests/check.rs` "an empty Blocked reports nothing"; `priorities-columns` "no pane for an empty Blocked"                                                                                                                  |
| US2 more 3 (two callouts)                             | 2    | `tests/priorities.rs` "only the first callout is the context"                                                                                                                                                             |
| US3 keys 1 and 3, more 1 and 2 (panes, purpose, tags) | 8    | `inbox-panes`: "each category with notes is a pane, a sub-line under its note", "the purpose line", "no empty pane without a heading", "both tags show"                                                                   |
| US3 key 2 (drag to Prompts)                           | 8    | `inbox-panes`: "a note dropped on Prompts is written under it"                                                                                                                                                            |
| US4 key 1, 2, 3, more 1, 2 (overlay)                  | 6    | `detail-overlay`: "Enter opens the line at its address", "Escape and Back close it and keep the card selected", "Next steps without a history entry", "a reload keeps it", phone "a tap opens a sheet with Close"         |
| US5 keys 1, 2, 3, more 1, 2 (menu)                    | 7    | `card-menu`: "Move to Now writes the line last of Now and offers Undo", "a note moves to Later", phone "every card shows …", "Tab reaches … and Enter opens it", "a running card's menu offers no move"                   |
| US6 key 1, 2, 3, more 1, 2, 3 (categories)            | 8, 3 | `inbox-panes`: "New category writes it", "No keeps the notes first, Undo restores", "Yes removes them", "rename keeps the notes", "a taken name is refused", "Cancel changes nothing"; `tests/categories.rs` for the file |
| Edge: Undo meets a changed file (High)                | 3, 8 | `tests/categories.rs` "a restore over a changed file is refused"; `inbox-panes` "Undo of a stale file shows the conflict and reads again"                                                                                 |
| Edge: drop on Ongoing (High)                          | 5    | `priorities-columns`: "a drop on Ongoing writes nothing"                                                                                                                                                                  |
| Edge: running priority moved or deleted (High)        | 5, 7 | `priorities-columns` (drag), `card-menu` (menu)                                                                                                                                                                           |
| Edge: lines under a retired Blocked (High)            | 2, 5 | as US2 key 3                                                                                                                                                                                                              |
| Edge: a renamed category takes another's name         | 3, 8 | `tests/categories.rs` "refused with A category named Prompts exists."; `inbox-panes`                                                                                                                                      |
| Edge: a name of only spaces                           | 3    | `tests/categories.rs` "A category needs a name."                                                                                                                                                                          |
| Edge: the overlay's line deleted from its menu        | 6    | `detail-overlay`: "deleting from the overlay closes it and offers Undo"                                                                                                                                                   |
| Edge: an address names a gone line                    | 6    | `detail-overlay`: "a gone line shows the page and says That line is gone."                                                                                                                                                |
| Edge: a press of 4 px                                 | 1    | as US1 key 2                                                                                                                                                                                                              |
| Edge: several paragraphs in a callout (Niche)         | 2    | `tests/priorities.rs` "the first paragraph is the context"                                                                                                                                                                |
| Edge: first image on a narrow card (Niche)            | 8    | `inbox-panes`, phone: "a note's first image shows under its text"                                                                                                                                                         |
| SC-001 (one scroll)                                   | 5    | as US1 key 1                                                                                                                                                                                                              |
| SC-002 (one Enter)                                    | 6, 9 | `detail-overlay` and `list-keys`                                                                                                                                                                                          |
| SC-003 (every action by Tab and tap)                  | 7    | `card-menu`: Tab and Enter on desktop, taps on the phone project                                                                                                                                                          |
| SC-004 (no handle)                                    | 1    | as US1 key 2                                                                                                                                                                                                              |
| SC-005 (context)                                      | 2, 5 | `tests/priorities.rs` and `priorities-columns` "a section with no callout shows no text"                                                                                                                                  |
| SC-006 (no loss)                                      | 3    | `tests/categories.rs` "delete and restore give the file back" over the cases of Review focus 7                                                                                                                            |
| SC-007 (contrast)                                     | 10   | `checkPage` of the screenshots' run in both themes, and the existing palette test                                                                                                                                         |
| Review focus 1, 2                                     | 6    | `detail-overlay`: "opening and closing keep the list's scroll", "Back closes in one press"                                                                                                                                |
| Review focus 3                                        | 6, 9 | `task` browser test from home; the existing decisions keys test                                                                                                                                                           |
| Review focus 4                                        | 7    | `card-moves.test.ts` "up, down, top, and bottom skip running entries"                                                                                                                                                     |
| Review focus 5                                        | 5, 7 | as the High edge cases                                                                                                                                                                                                    |
| Review focus 6                                        | 1    | `card-drag`: "a drag that ends on its own card does not open it"                                                                                                                                                          |
| Review focus 7, 8                                     | 3    | `tests/categories.rs`                                                                                                                                                                                                     |
| Review focus 9                                        | 2, 5 | `tests/priorities.rs` "read keeps four sections"; `priorities-columns`                                                                                                                                                    |
| Review focus 10                                       | 7    | `card-menu`: "a press on … does not drag"                                                                                                                                                                                 |

## Waves

- **Wave 1**: task 1. It checks outside behaviour, and every web task builds on its card.
- **Wave 2**: tasks 2 and 3. Rust only, no file in common: task 2 changes `files/priorities*`,
  `check/sections.rs`, and the skill, template, and example; task 3 adds files under `files/inbox/`,
  `actions/inbox/`, and `api/`. Only task 2 regenerates the binding's `index.d.ts`.
- **Wave 3**: task 4. The binding and the server, one writer for the generated files and
  `fate/views.ts`.
- **Wave 4**: task 5. Columns, context, Blocked, and the purpose line.
- **Wave 5**: task 6. The overlay, `App.tsx`, and the selection.
- **Wave 6**: task 7. The menu.
- **Wave 7**: task 8. The inbox panes and the categories' controls.
- **Wave 8**: task 9. The keys.
- **Wave 9**: task 10. The stories' link rewrites, the screenshots, the mockups' removal, and the
  README.

Tasks 5 to 9 each change `WorkList.tsx` or `App.tsx`, so they are built in sequence.

---

## Task 1: A card that drags from anywhere

**Risky:** It checks the outside behaviour the spec marks unverified: `@dnd-kit/react` must keep a
mouse press under 5 px a click and start a drag past it, on a whole card that is also a link. If the
check fails, stop and start a new round of questions before any later task.

**Files:**

- Create: `packages/web/src/lists/Card.tsx`, `packages/web/src/__browser__/card-drag.test.tsx`
- Modify: `packages/web/src/lists/WorkList.tsx` (`RowItem`, `SortableRow` become `Card`),
  `packages/web/src/lists/useDragOrder.ts` (`SENSORS`, the accessibility instructions),
  `packages/web/src/lists/PrioritiesList.tsx` and `packages/web/src/InboxPage.tsx` (rows' marks as
  text), `packages/web/src/lists/WorkList.stories.tsx`
- Test: `packages/web/src/__browser__/card-drag.test.tsx`, and `priorities.test.tsx`,
  `inbox.test.tsx`, `lists.test.tsx`, `__tests__/priorities.test.tsx` where they use a handle

**Interfaces:**

- Consumes: `useSortable` of `@dnd-kit/react/sortable`, `PointerActivationConstraints` of
  `@dnd-kit/dom`.
- Produces: `Card({ row: WorkRow, isSelected: boolean, section: string, index: number })` in
  `lists/Card.tsx`, drawing the line whole and wrapping, its sub-lines, its marks in the card's top
  border, a stretched link to `row.href` (a click or Enter opens it) with `data-row` on the card so
  `useListKeys` finds `[data-row] a[href]`, and an empty slot for a `…` button that task 7 fills.
  `WorkRow.marks` is a text mark, `ReactNode`, set in the border; `WorkRow.menu?: ReactNode` is that
  slot; `WorkRow.image?: ReactNode` is a picture under the text (ruling R7). `SENSORS` has no handle
  and no keyboard sensor: a mouse or pen press activates after 5 px (`Distance`), a touch press
  after 500 ms with 5 px of tolerance. A card with `isFixed` has no drag.

- [x] **Step 1: Write the failing tests, and the helper they use**

A helper `pressAndMove(text, dx, dy)` in `card-drag.test.tsx` presses on the card's text, moves in
steps, and releases (pointer events through the browser provider's mouse).

```tsx
// packages/web/src/__browser__/card-drag.test.tsx
test("a press of 4 px opens the card", async () => {
  await show("/priorities", "Git listener process");
  await pressAndMove("Git listener process", 4, 0);
  expect(window.location.pathname).toMatch(/\/priorities\/git-listener$/);
});

test("a press of 40 px over Next writes the line in Next at the drop place", async () => {
  await show("/priorities", "Git listener process");
  await dragTo("Git listener process", "Add to Later"); // helper: press, move over, release
  expect(await file("specs/PRIORITIES.md")).toMatch(/## Later[\s\S]*Git listener process/);
});

test("a drag that ends on its own card does not open it", async () => {
  await pressAndMove("Git listener process", 40, 0, { backToStart: true });
  expect(window.location.pathname).toMatch(/\/priorities$/);
});

test("a running card does not move", async () => {
  /* press and move 40 px: the card's top is the same */
});
```

The break each test catches:

- 4 px: a drag that starts at once, so a click never opens the card (SC-004).
- 40 px: a sensor that needs a handle, so a press on the text does nothing.
- Own card: dnd-kit's click after a drag opening the overlay.
- Running card: a draggable card that is derived.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test --project desktop packages/web/src/__browser__/card-drag.test.tsx`
- Expected: FAIL at the first test, the pointer press on the text does not navigate because the
  press under 5 px started no click on a handle-activated row (or the helper finds no `Card`).

- [x] **Step 3: Implement `Card`, the sensors, and the lists on it**

`Card` replaces `RowItem` and `SortableRow` in `WorkList.tsx`: `useSortable` with the card element
as activator and no handle. The sensors follow the Interfaces block; `preventActivation` only keeps
a press on a button or a link's own menu from starting a drag. The keyboard sensor, the screen
reader's "press Space" instruction, and the handle's button are removed, and the announcements stay
for a drag. Priorities' and inbox's rows give `marks` as text ("draft", "backlog", the running step
as "● <step>", a note's tags) instead of badges. A card's first image shows under its text.
`PrioritiesList` and `InboxPage` keep their moves and Add rows. If the browser test shows dnd-kit
cannot tell a 4 px press from a drag on a link, stop here.

- [x] **Step 4: Update the tests that used a handle, and run the task's validation**

The tests that pressed "Move <text>" or dragged by the keyboard now press the card's text; the
keyboard drag tests are removed with the keyboard sensor (ruling R3).

- Run: `nix develop -c vp run fast`
- Expected: PASS. Deferred to `ready`: the phone project's whole browser suite and the screenshots.

- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-25-inbox-priorities/plan.md specs/2026-10-25-inbox-priorities/rulings.md
git commit -m "feat(inbox-priorities): cards that drag from anywhere"
```

---

## Task 2: A section's context, and Blocked retired

**Risky:** It changes the format of `PRIORITIES.md` for every project, and the rule `ura check` and
the page share.

**Files:**

- Create: `crates/core/src/files/priorities/context.rs`
- Modify: `crates/core/src/files/priorities.rs` (`SectionItems.context`, `read`),
  `crates/core/src/check/sections.rs` (`check_priorities`), `packages/binding/index.d.ts` and
  `index.js` (regenerated), `skills/uraeda/SKILL.md` (line 76),
  `skills/uraeda/references/conventions.md` (line 79, and the format's rule),
  `skills/uraeda/references/projects.md` (line 115),
  `skills/uraeda/assets/templates/specs/PRIORITIES.md`,
  `skills/uraeda/assets/templates/specs/README.md` (line 13),
  `skills/uraeda/assets/example/specs/PRIORITIES.md`, `README.md` (line 143),
  `fixtures/repo/main/specs/PRIORITIES.md`
- Test: `crates/core/tests/priorities.rs`, `crates/core/tests/check.rs`, and the init test that
  covers `ura init` (`crates/cli/tests/init.rs`, or where it lives)

**Interfaces:**

- Consumes: `lines::plain` for a text without markdown; `File::warning`.
- Produces:
  `pub struct SectionContext { pub section: Section, pub line: usize, pub text: Option<String> }`
  and `pub fn contexts(text: &str) -> Vec<SectionContext>` in `files::priorities`, one per heading
  whose section has a callout before its first entry; `line` is the callout's first line, from 1;
  `text` is `None` when the marker stands alone. `SectionItems.context: Option<String>` (napi
  `context?: string`), the text of the first of a section's headings that has one; the core's `read`
  still returns four sections. `ura check`: `sections.missing` for Now, Next, and Later only;
  warning `priorities.blocked` ("Blocked is retired: move its lines"), once, when `## Blocked` has
  an entry; warning `priorities.context` per callout with no text, saying to put the text in the
  same callout as its marker.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/priorities.rs
#[test]
fn a_tip_callout_with_a_blank_quote_line_is_the_context() {
    let text = "# Priorities\n\n## Now\n\n> [!TIP]\n>\n> Features for v1.0.0\n\n- A\n";
    assert_eq!(read(text, None).sections[0].context.as_deref(), Some("Features for v1.0.0"));
}
#[test]
fn only_the_first_callout_and_its_first_paragraph_count() { /* two callouts under Next; two paragraphs */ }
#[test]
fn a_marker_alone_has_no_context() { /* "> [!NOTE]\n\n> text": text None, line 5 */ }
#[test]
fn read_keeps_four_sections() { /* Blocked included, empty */ }
// crates/core/tests/check.rs
fn a_blocked_with_lines_warns_it_is_retired() { /* warning, not an error: the check passes */ }
fn an_empty_blocked_reports_nothing() { /* and a file with no Blocked at all has no problem */ }
fn a_callout_with_its_text_in_a_separate_quote_warns() { /* priorities.context, line of the marker */ }
fn a_file_without_next_is_missing_a_section() { /* replaces the test of the missing Blocked */ }
```

The `init` test: `ura init` writes a `PRIORITIES.md` with Now, Next, and Later, no Blocked, and
`ura check` reports nothing for it. The break each test catches: a context read from any `>` line
(the marker's text); a Blocked required again; a Blocked warning that fails the check.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test priorities --test check`
- Expected: FAIL, `no field context on type SectionItems`.

- [x] **Step 3: Implement the context, the check, and the format's documents**

`contexts` scans each section's lines between its heading and its first list item for the first
blockquote whose first line is `[!TYPE]` (any type, case-insensitive, `QUESTION` included, not only
the types CommonMark's alerts know). Its text is the rest of the marker's paragraph, else the next
paragraph of the same quote, as plain text; a separate quote after a blank line is not part of it.
`read` fills `SectionItems.context` from it. `check_priorities` follows the Interfaces block, and
the test of the missing Blocked is replaced (ruling R4). The skill's conventions state the rule,
once: a section's context is the first callout of any type under its heading, its text in the same
callout as its marker, and Blocked no longer exists, a blocked line goes after what it needs. The
template drops Blocked and gives each section a context in plain words, the example moves its
Blocked line to Later and gives each section a context, the fixture repository moves its Blocked
line to Later and gives the sections contexts, and every mention of Blocked in the files listed
above goes. Run `nix develop -c vp run binding:build` to regenerate `index.d.ts`.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then `nix develop -c cargo run -q -p uraeda-cli -- check specs`
  and the same on `skills/uraeda/assets/example/specs`
- Expected: PASS; the repository's own `PRIORITIES.md` warns about Later's callout, which the human
  fixes on the default branch (the spec's assumption), and nothing else.

- [x] **Step 5: Commit**

```bash
git add crates skills README.md fixtures packages/binding specs/2026-10-25-inbox-priorities
git commit -m "feat(inbox-priorities): a section's context, and Blocked retired"
```

---

## Task 3: Category edits in the core

**Risky:** It writes `INBOX.md`: a rule several callers share, and a stored file that an Undo must
give back byte for byte.

**Files:**

- Create: `crates/core/src/files/inbox/categories.rs`,
  `crates/core/src/actions/inbox/categories.rs`, `crates/core/src/api/category_edits.rs`,
  `crates/core/tests/categories.rs`
- Modify: `crates/core/src/files/inbox.rs`, `crates/core/src/actions/inbox.rs`,
  `crates/core/src/api.rs` (module and re-exports only)
- Test: `crates/core/tests/categories.rs`

**Interfaces:**

- Consumes: `inbox::category_of`, `category_names`, `category_headings`, `scan`, and the private
  `apply` of `actions::inbox`.
- Produces, in `files::inbox::categories`, text edits with no checking:
  `add_category(text: &str, name: &str) -> String`,
  `rename_category(text: &str, from: &str, to: &str) -> String`,
  `remove_category(text: &str, name: &str, keep_notes: bool) -> String`. In
  `actions::inbox::categories`, the checked edits over `previous: Option<&str>`:
  `add_category(place: &Place, name: &str, previous: Option<&str>) -> Result<Inbox, ActionError>`,
  `rename_category(place, from: &str, to: &str, previous) -> Result<Inbox, ActionError>`,
  `remove_category(place, name: &str, keep_notes: bool, previous) -> Result<(Inbox, String), ActionError>`
  (the string is the file as it was), and
  `restore_category(place, before: &str, previous: &str) -> Result<Inbox, ActionError>`, which
  writes `before` back only when the file still hashes to `previous`. The same four in `api`, under
  the write lock, as `add_category(repo, name, previous)`,
  `rename_category(repo, from, to, previous)`, `remove_category(repo, name, keep_notes, previous)`,
  `restore_category(repo, before, previous)`. Refusals, as `ActionError::Refused`: "A category needs
  a name.", "A category named {name} exists." (exact, case-sensitive, after trimming), "No category
  named {name}.", and "{name} cannot be written as a heading." when `category_of("## {name}")` does
  not give the name back.

- [x] **Step 1: Write the failing tests**

```rust
// crates/core/tests/categories.rs
const TEXT: &str = "# Inbox\n\n- loose\n\n## UI\n\n- a\n- b\n- c\n\n## Prompts\n\n- p\n";

#[test]
fn deleting_a_category_with_no_keeps_its_notes_after_the_loose_ones() {
    let edited = remove_category(TEXT, "UI", true);
    assert_eq!(edited, "# Inbox\n\n- loose\n- a\n- b\n- c\n\n## Prompts\n\n- p\n");
}
#[test]
fn deleting_a_category_with_yes_removes_its_notes() {
    assert_eq!(remove_category(TEXT, "UI", false), "# Inbox\n\n- loose\n\n## Prompts\n\n- p\n");
}
#[test]
fn deleting_the_first_category_keeps_its_notes_under_no_category() { /* "# Inbox\n\n## UI\n\n- a\n\n## Prompts\n" */ }
#[test]
fn adding_a_category_ends_the_file_with_its_heading() { /* "...- p\n\n## Ideas\n" */ }
#[test]
fn renaming_keeps_the_notes_and_the_other_headings() {}
#[test]
fn delete_then_restore_gives_the_file_back_byte_for_byte() {
    // cases: first, last, no final newline, CRLF, notes before the first heading, two headings "UI",
    // keep_notes true and false: for each, remove_category then restore_category equals the input
}
#[test]
fn a_restore_over_a_changed_file_is_refused_and_writes_nothing() {}
#[test]
fn a_name_is_refused_when_empty_taken_missing_or_not_a_heading() {
    // "   " -> "A category needs a name."; "Prompts" -> "A category named Prompts exists.";
    // "Ideas #" and "a\nb" -> "... cannot be written as a heading."; rename of "Nope" -> "No category named Nope."
}
```

The break each test catches: a delete that drops the notes it should keep, a restore that normalizes
line endings, a stale restore that overwrites a later edit, and a name written as another one.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test categories`
- Expected: FAIL, `unresolved import uraeda_core::files::inbox::categories`.

- [x] **Step 3: Implement the text edits, the checked edits, and the API**

A delete acts on every heading of the name (ruling R5): with `keep_notes`, the body (every line
until the next `##` heading, trailing blank lines trimmed) goes to the end of the lines before the
first heading, joined directly, and the heading goes; without it, the heading and its body go.
`add_category` adds the heading after a blank line at the end, keeping the file's final newline.
Edits preserve the file's line endings. Settle the ordering of the kept notes as R6: after the notes
already without a category.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates specs/2026-10-25-inbox-priorities
git commit -m "feat(inbox-priorities): create, rename, and delete a category in the core"
```

---

## Task 4: The binding and the server

**Files:**

- Modify: `crates/binding/src/inbox_writes.rs`, `packages/binding/index.d.ts` and `index.js`
  (regenerated), `packages/server/src/fate/inbox-mutations.ts`, `packages/server/src/fate/views.ts`,
  `packages/server/src/fate/sources.ts` (`sentInbox`)
- Test: `packages/server/src/__tests__/inbox.test.ts`, `packages/server/src/__tests__/fate.test.ts`

**Interfaces:**

- Consumes: the four `api` functions of task 3, and `SectionItems.context` of task 2.
- Produces: napi `addCategory(repo, name, previous): Promise<Inbox>`,
  `renameCategory(repo, from, to, previous)`,
  `removeCategory(repo, name, keepNotes, previous): Promise<CategoryRemoved>` with
  `CategoryRemoved { inbox: Inbox, before: string }`, and
  `restoreCategory(repo, before, previous): Promise<Inbox>`. Fate mutations on the `Inbox` record:
  `inbox.addCategory` (`{ hash, name }`), `inbox.renameCategory` (`{ hash, from, to }`),
  `inbox.removeCategory` (`{ hash, name, keepNotes }`), `inbox.restoreCategory`
  (`{ hash, before }`). The `Inbox` record has `removed: string | null`, the file as it was, set
  only on the answer of `inbox.removeCategory` and sent as null on every other answer, as `added`
  is. The priorities record's sections carry `context` as the binding sends it.

- [x] **Step 1: Write the failing tests**

```ts
// packages/server/src/__tests__/inbox.test.ts
test("a category is added, renamed, and deleted, and a delete's removed text restores the file", async () => {
  const before = await inboxText();
  const removed = await mutate("inbox.removeCategory", { hash, name: "UI", keepNotes: false });
  expect(removed.removed).toBe(before);
  await mutate("inbox.restoreCategory", { hash: removed.hash, before: removed.removed });
  expect(await inboxText()).toBe(before);
});
test("a category named like another is refused with its message", async () => {});
// fate.test.ts
test("the priorities carry each section's context", async () => {
  expect(sectionsOf(priorities).find((s) => s.section === "next")?.context).toBe(
    "What comes once Now is done",
  );
});
```

The break each test catches: a `removed` text lost in the record, or a context left out of the view.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp run binding:build && nix develop -c vp test packages/server/src/__tests__/inbox.test.ts`
- Expected: FAIL, `mutation inbox.removeCategory is not defined`.

- [x] **Step 3: Implement the napi functions and the mutations**

Follow the existing pairs of `inbox_writes.rs` and `inbox-mutations.ts`, and `refusable` for
refusals. Regenerate the binding.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/binding packages/binding packages/server specs/2026-10-25-inbox-priorities
git commit -m "feat(inbox-priorities): category edits and section context through the binding and server"
```

---

## Task 5: The priorities as columns

**Files:**

- Create: `packages/web/src/__browser__/priorities-columns.test.tsx` (the columns live in
  `WorkList.tsx`, with no `Columns.tsx`: a pane of the row is the section's own pane)
- Modify: `packages/web/src/lists/WorkList.tsx` (sections as titled panes; `layout`),
  `packages/web/src/lists/PrioritiesList.tsx` (context, Blocked, Ongoing's context, `blocked` tone
  gone), `packages/web/src/PrioritiesPage.tsx` (purpose line),
  `packages/web/src/lists/WorkList.stories.tsx`
- Test: `priorities-columns.test.tsx`, `priorities.test.tsx`, `__tests__/priorities.test.tsx`

**Interfaces:**

- Consumes: `Card` of task 1, `SectionItems.context` as `section.context` of `usePriorities()`,
  `layout/Pane.tsx`'s titled pane.
- Produces: `WorkSection.context?: string` and `WorkList`'s `layout: "columns" | "stack"`. `columns`
  draws the sections as titled panes in one scrolling row, each `flex: 1 0 400px`, and, on the
  narrow class, as `stack`. A section whose title is "Blocked" is drawn under the row, and only when
  it has entries; `fileIndex` and `byRunning` keep their signatures.

- [x] **Step 1: Write the failing tests, and the story**

First, the story `Columns` of `WorkList.stories.tsx` (the priorities over the fixture, Ongoing, Now,
Next, Later with their contexts), and `Phone`, the same at 390 px with the viewport parameter.

```tsx
// packages/web/src/__browser__/priorities-columns.test.tsx
test("at 1150 px the row scrolls and each pane is 400 px or more", async () => {
  await show("/priorities", "Now");
  const row = scroller();
  expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
  for (const pane of panes())
    expect(pane.getBoundingClientRect().width).toBeGreaterThanOrEqual(400);
  expect(isWhole(screen.getByRole("region", { name: "Later" }))).toBe(false); // cut at the edge
});
test("a running card does not move, and Ongoing says what it is", async () => {});
test("an empty pane shows its context and its Add row", async () => {});
test("a drop on Ongoing writes nothing", async () => {});
test("a section with a callout shows its text, and one without shows none", async () => {});
test("a Blocked pane shows under the columns only when it has a line", async () => {});
test("the purpose line reads What is worked on, in order: Ongoing runs now, then Now, Next, and Later.", async () => {});
// phone project
test("the panes are stacked in the order Ongoing, Now, Next, Later", async () => {});
```

The break each test catches: columns that shrink to fit instead of scrolling, a Blocked pane for an
empty section, a drop that writes into a derived Ongoing, a context drawn for a section with none.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test --project desktop packages/web/src/__browser__/priorities-columns.test.tsx`
- Expected: FAIL, `Unable to find role="region" and name "Now"` (the sections are not panes yet).

- [x] **Step 3: Implement the columns**

Drawing sections as titled panes (title and count in the border, the context under it, then the
cards and the Add row) is `WorkList`'s; the arrangement is `layout`. Ongoing's context is the spec's
exact text, written by the app; Ongoing still shows only when something runs, as today; its cards
are fixed and a drop on it writes nothing. Blocked is a normal section of the data, and the page
drops it when it has no entries. The purpose line sits under the page's title.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then
  `nix develop -c vp test --project desktop --project phone packages/web/src/__browser__/priorities`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-25-inbox-priorities
git commit -m "feat(inbox-priorities): the priorities as columns with their context"
```

---

## Task 6: The detail in an overlay

**Risky:** It changes how every list opens its detail, and the history entries Back goes over.

**Files:**

- Create: `packages/web/src/pane/DetailOverlay.tsx` (with `DetailHost`, `openDetail`),
  `packages/web/src/pane/DetailRoutes.tsx` (`PrioritiesRoute`, `InboxRoute`),
  `packages/web/src/__browser__/detail-overlay.test.tsx`
- Modify: `packages/web/src/App.tsx` (`pageKey`, `TaskRoute`, `NoteRoute`),
  `packages/web/src/layout/Overlay.tsx` (a size), `packages/web/src/pane/EntryPane.tsx` (`Steps`
  replace the entry; no second Close), `packages/web/src/pane/PriorityPane.tsx`,
  `packages/web/src/pane/NotePane.tsx` (the gone line), `packages/web/src/lists/WorkList.tsx` (the
  selection is the list's own state), `packages/web/src/lists/listPane.ts`
- Test: `detail-overlay.test.tsx`, and `task.test.tsx`, `pane.test.tsx`, `notes.test.tsx`

**Interfaces:**

- Consumes: `Overlay`, `openOverlayAt`, `useBackCloses` (`layout/useBackCloses.ts`); `PriorityPane`
  and `NotePane`.
- Produces: `Overlay`'s `size?: { height?: string; width?: string }` (replacing `width`) for the
  dialog on wide screens; `DetailOverlay({ children, label, line, onClose })`, the dialog of 108
  characters and 60% of the window tall, or the bottom sheet on the phone, shared by both routes.
  `WorkList`'s `selected` seeds a selection it keeps itself, and Escape, Back, and a Previous or
  Next leave the last opened card selected, and focused. `Steps` change the address by `redirect`,
  replacing the entry. A line the address names that is no longer there shows the page with no
  overlay and "That line is gone." `Panes` and `ListPaneContext` stay for the decisions page only;
  remove what no caller uses.

- [x] **Step 1: Write the failing tests, and the story**

The story `Overlay` draws the priorities page with `DetailOverlay` open on a fixture line.

```tsx
// packages/web/src/__browser__/detail-overlay.test.tsx
test("Enter on a selected card opens the line at its address, the columns drawn behind", async () => {});
test("Escape closes the overlay, and the card is still selected and focused", async () => {});
test("Back closes it in one press", async () => {
  /* history.length before and after the open */
});
test("Next steps to the next line and adds no history entry", async () => {});
test("a reload on the address opens it again", async () => {});
test("opening and closing keep the list's scroll", async () => {});
test("deleting from the overlay closes it and offers Undo", async () => {});
test("a gone line shows the page, no overlay, and That line is gone.", async () => {});
test("a priority opened from home opens over home", async () => {});
// phone project
test("a tap on a card opens a bottom sheet with a visible Close", async () => {});
```

The break each test catches: a remounted list (selection and scroll lost), a pushed entry per step,
two Backs to close, a dialog the spec's size is not.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c vp test --project desktop packages/web/src/__browser__/detail-overlay.test.tsx`
- Expected: FAIL, `Unable to find role="dialog"` (the detail still opens in a pane beside the list).

- [x] **Step 3: Implement the overlay**

`pageKey` gives `/priorities` and `/priorities/<key>` one key, and `/inbox` and `/inbox/<key>` one.
The routes draw the page and `DetailOverlay` over it, with `openOverlayAt` for a click so the entry
the overlay pushes is the one Back goes over (read `useBackCloses` for who pushes), and an address
opened by a reload or a link takes its entry once. The size is the spec's 108 characters of the
page's font, with a height of 60% of the window. The bar's own Close goes where the overlay's header
has one. List selection moves out of the URL into state, seeded by it.

- [x] **Step 4: Run the task's validation** (rulings R12 to R15 record the tests that changed)

- Run: `nix develop -c vp run fast`, then both browser projects on `detail-overlay`, `task`,
  `ledger`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-25-inbox-priorities
git commit -m "feat(inbox-priorities): the detail in an overlay"
```

---

## Task 7: A menu on every card

**Risky:** Its moves are a rule the drag also owns, `fileIndex`.

**Files:**

- Create: `packages/web/src/lists/CardMenu.tsx`, `packages/web/src/lists/cardMoves.ts` (with
  `fileIndex`, moved from `PrioritiesList.tsx`, ruling R17), `packages/web/src/pane/useMoveTo.ts` (a
  priority's move with its Undo), `packages/web/src/__tests__/card-moves.test.ts`,
  `packages/web/src/__browser__/card-menu.test.tsx`
- Modify: `packages/web/src/lists/Card.tsx` (the slot, when it shows),
  `packages/web/src/lists/useDragOrder.ts` (`preventActivation` for the button),
  `packages/web/src/lists/PrioritiesList.tsx`, `packages/web/src/InboxPage.tsx`
- Test: `card-moves.test.ts`, `card-menu.test.tsx`

**Interfaces:**

- Consumes: `usePriorityActions`, `useNoteActions` (their `move`, `draft`, `startChange`, `remove`,
  `toPriorities`, `toNewDraft`, `toDraft`, `toCategory`), `fileIndex`, Astryx's `DropdownMenu`
  (ruling R16).
- Produces:
  `moveIndex(entries: ReadonlyArray<PriorityEntry>, key: string, to: "up" | "down" | "top" | "bottom"): number`
  in `lists/cardMoves.ts`, the file index to pass `priorities.move`, skipping running entries.
  `PriorityMenu` and `NoteMenu`, in `CardMenu.tsx` (ruling R16), offer: for a priority, Move to Now,
  Next, or Later (the end of the section), Move up and down, To the top and bottom, Make a draft,
  Start, and Delete; for a note, Move to a priority, Add to a draft, Make a draft, a Category, and
  Delete; a running priority's menu has neither a move nor Delete. The button shows on hover, on the
  selected card, on keyboard focus within the card, and always under `(hover: none)`.

- [x] **Step 1: Write the failing tests**

```ts
// packages/web/src/__tests__/card-moves.test.ts
test("up, down, top, and bottom skip the running entries that show in Ongoing", () => {
  // entries: A, B(running), C, D: moving D up lands before C, as a drag over C's top does
  expect(moveIndex(entries, "d", "up")).toBe(fileIndex(entries, "d", 1));
});
// packages/web/src/__browser__/card-menu.test.tsx
test("Move to Now writes the line last of Now and offers Undo", async () => {});
test("a note moved to a priority in Later is the last entry of Later and leaves the inbox", async () => {});
test("Tab reaches … and Enter opens the menu", async () => {});
test("a running card's menu offers neither a move nor Delete", async () => {});
test("a press on … does not drag, and a card's drag does not open the menu", async () => {});
// phone project
test("every card shows its … button", async () => {});
```

The break each test catches: a move that lands between running entries, a menu only hover shows, a
menu that offers a move for a derived card.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/card-moves.test.ts`
- Expected: FAIL, `Failed to resolve import "../lists/cardMoves.ts"`.

- [x] **Step 3: Implement the menu**

`moveIndex` is computed from `fileIndex` of the target's screen index. The menu runs the existing
actions: no write is repeated, and the toast with Undo is theirs. Whether "Add to a draft" is a
submenu or a picker in the menu is the implementer's, with a ruling if it differs from the pane's.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then both browser projects on `card-menu`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-25-inbox-priorities
git commit -m "feat(inbox-priorities): a menu on every card"
```

---

## Task 8: The inbox as panes, with categories

**Files:**

- Create: `packages/web/src/lists/CategoryPane.tsx`, `packages/web/src/lists/useCategoryActions.ts`,
  `packages/web/src/__browser__/inbox-panes.test.tsx`
- Modify: `packages/web/src/InboxPage.tsx` (`InboxList`), `packages/web/src/lists/WorkList.tsx` (a
  section's title and menu slot), `packages/web/src/lists/WorkList.stories.tsx`
- Test: `inbox-panes.test.tsx`, `inbox.test.tsx`, `__tests__/inbox.test.tsx`

**Interfaces:**

- Consumes: `Inbox.names`, `Inbox.categories`, the mutations of task 4, `layout: "stack"` of task 5,
  `useUndoToast`, Astryx's `AlertDialog` or `Dialog`.
- Produces: the inbox's panes in file order with the notes without a category first, an empty
  category shown as an empty pane, "New category", a title renamed in place, and a pane menu that
  deletes it, asking "Delete the N notes too?" with three bordered lines, Yes (Y), No (N), and
  Cancel (C), keys included. `useCategoryActions(inbox)` returns `add(name)`, `rename(from, to)`,
  `remove(name, count)`, each refusal as a message by the pane, and a conflict read again. An Undo
  toast follows a delete, and calls `inbox.restoreCategory` with the answer's `removed`. The page
  says "Things noticed, not decided: turn each into a priority, a draft, or nothing." under its
  title. An empty inbox shows that line and "New category", and no empty pane without a heading.

- [ ] **Step 1: Write the failing tests, and the stories**

Stories `Inbox` (panes with notes) and `CategoryDelete` (the dialog open).

```tsx
test("each category with notes is a pane, and a note's sub-line shows under its text", async () => {});
test("both tags of a note show on its card", async () => {});
test("a note dropped on Prompts is written under ## Prompts at the drop place", async () => {});
test("New category writes ## Prompts at the end of INBOX.md and shows an empty pane", async () => {});
test("deleting UI and answering No puts its notes first under no category, and Undo restores the file", async () => {});
test("answering Yes removes the heading and its notes, and Undo restores them", async () => {});
test("Y, N, and C choose in the dialog", async () => {});
test("renaming UI to Interface keeps its notes, and a taken name is refused with its message", async () => {});
test("Cancel changes nothing", async () => {});
test("an Undo over a file changed meanwhile shows the conflict and reads the file again", async () => {});
// phone project
test("a note's first image shows under its text", async () => {});
```

The break each test catches: notes lost on No, an Undo that writes over a later edit, an empty
category invisible, a name refused with the wrong text.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test --project desktop packages/web/src/__browser__/inbox-panes.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "New category"`.

- [ ] **Step 3: Implement the panes and their controls**

An empty category's pane comes from `names` minus the categories with notes. The dialog's three
choices are bordered lines of the terminal look, each showing its key, and the keys work while it is
open.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then both browser projects on `inbox`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-25-inbox-priorities
git commit -m "feat(inbox-priorities): the inbox as panes, with categories"
```

---

## Task 9: The keys between columns

**Files:**

- Modify: `packages/web/src/lists/useListKeys.ts`, `packages/web/src/lists/WorkList.tsx`,
  `packages/web/src/statusHints.tsx` (only if the registry needs a field)
- Create: `packages/web/src/__browser__/list-keys.test.tsx`
- Test: `list-keys.test.tsx`, the existing decisions keys test

**Interfaces:**

- Consumes: the list's own selection of task 6, the columns of task 5.
- Produces: `useListKeys` keeps `j k`, the arrows, Home, and End inside a column or pane; `h l` and
  the left and right arrows move to the card at the same row of the neighbouring column, or its last
  card when shorter; Enter opens the selected card's overlay by its link; selecting opens nothing.
  The hints are declared once through `useStatusHints`, with `h l` named only where the list has
  columns. Home and the decisions page keep `j k`, Enter, and Escape as they were.

- [ ] **Step 1: Write the failing tests**

```tsx
test("l selects the card at the same row of the next column, or the last card when it is shorter", async () => {});
test("j and k stay inside a column", async () => {});
test("Enter opens the selected card, and moving the selection opens nothing", async () => {});
test("the status line names h l only on the columns", async () => {});
```

The break each test catches: `l` that lands at the top, a selection that opens the overlay, and keys
on the decisions page changed.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test --project desktop packages/web/src/__browser__/list-keys.test.tsx`
- Expected: FAIL, the card at row 2 of Next is not selected after `l`.

- [ ] **Step 3: Implement the keys**

Rows know their column: the keys read it from the card's section, not from the page.

- [ ] **Step 4: Run the task's validation**

- Run: `nix develop -c vp run fast`, then both browser projects on `list-keys`, `ledger`, `home`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-25-inbox-priorities
git commit -m "feat(inbox-priorities): h and l between columns, Enter opens the overlay"
```

---

## Task 10: The stories replace the mockups

**Files:**

- Create: `packages/web/scripts/priorities-inbox-shots.ts`,
  `specs/2026-10-25-inbox-priorities/screenshots/`
- Modify: `specs/2026-10-25-inbox-priorities/spec.md` (the five mockup links),
  `skills/uraeda/assets/example/specs/` only if the example shows the lists, `README.md` if its
  screenshots or text show the inbox or the priorities
- Delete: `specs/2026-10-25-inbox-priorities/mockups/` (the five pages and `terminal.css`)

**Interfaces:**

- Consumes: the stories `Columns`, `Phone`, `Inbox`, `Overlay`, `CategoryDelete` of tasks 5, 6,
  and 8.
- Produces: the spec's links point at the stories, as story links, and the folder has screenshots of
  each changed view, at the phone and desktop sizes, in both themes.

- [ ] **Step 1: Check that each story shows its mockup's states**

Open the five pages and their stories side by side: columns with contexts and marks in the border;
the phone's stack; the inbox's panes; the overlay's dialog; the category delete's three lines. A
state a mockup shows that its story does not is added to the story, not dropped.

- [ ] **Step 2: Take the screenshots**

- Run: `nix develop -c vp run --filter uraeda-web screenshots 2026-10-25-inbox-priorities`, with the
  views of `priorities-inbox-shots.ts` after the pattern of `questions-page-shots.ts`
- Expected: WebP files for the priorities, the inbox, the overlay, and the category delete, at both
  sizes and in both themes, and `checkPage` clean in each. Read each image against the decisions.

- [ ] **Step 3: Rewrite the spec's links and delete the mockups**

Each link to a mockup becomes a story link, alone in its paragraph:
`[Columns, with the current priorities](/packages/web/src/lists/WorkList.stories.tsx#Columns)`, and
likewise `Phone`, `Inbox`, `Overlay`, `CategoryDelete`. Delete the folder `mockups/`, and rewrite
any link to it in the folder's other files as `` `mockups/<name>` (deleted) ``.

- [ ] **Step 4: Run the complete validation**

- Run: `nix develop -c vp run ready`
- Expected: PASS: formatter, linter, types, Rust and TypeScript tests, both browser projects, the
  Storybook build, and `ura check` of `specs` and the example.

- [ ] **Step 5: Commit**

```bash
git add -A specs/2026-10-25-inbox-priorities packages/web README.md
git commit -m "docs(inbox-priorities): the stories, the screenshots, and the mockups gone"
```
