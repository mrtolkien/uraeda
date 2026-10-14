---
status: auto-approved
spec-revision: 3
---

# Plan: Text inputs and comments

**Goal:** every text field saves only with its button or its own key, unsaved text survives a reload
and is never left without asking, review comments keep up with typing, settled points take comments
written into the notes, and every multi-line field has a fixed height.

**Architecture:** two owners, one per side. The Rust core owns the notes' format: it splits a
round's notes into free notes and comments on settled points, ends the settled section at the
**Notes:** line, and writes both parts back in that order, for the web UI and `ura answer` alike
([spec, Data](spec.md#data)). The web UI owns unsaved text: one module-level store,
`fields/unsaved.ts`, holds what each field shows and has not saved, by key, mirrored to
`localStorage`; `useTextField` is the only way a field reads and writes it; the leave guard reads
only "does the store hold unsaved text for this page". A field's saved text always comes from the
file, through fate, and is never copied into the store: the file never writes into a field being
edited, which removes both causes of lost letters ([spec, Approach](spec.md#architecture)). Each
field keeps its own save, through `useSave`'s queue, which loses its timer once no field saves as
typed. Images keep saving their field at once, through the same `onText(text, added)` contract of
`attach/useImageText.ts`, and clear the field's unsaved entry when they do.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **An image added to the notes while typed text is unsaved** saves the notes at once with the
   typed text and the link, and leaves no unsaved entry behind: a reload restores nothing. Task 4.
2. **A save refused by the core** keeps the unsaved entry: after a reload, the text is restored.
   Task 4.
3. **Text differing from the saved text only by spaces or line breaks at its ends** is not unsaved:
   no "Unsaved changes", no entry kept, no leave prompt. Task 4.
4. **A round answered elsewhere while its notes hold unsaved text**: the page turns read-only, the
   entry stays, and the notice says "Unsaved text restored from HH:MM. The round was answered." with
   Discard. Task 4.
5. **Submit with an open settled-point comment form whose text is blank** adds no comment, and
   submits. Task 6.
6. **A restored review comment whose reviewed commit changed** comes back as a general comment
   starting "On lines 40–52 of the previous version:". Task 7.
7. **Back that closes a sheet or dialog**, and the editor's redirect after a draft moves into a
   folder, never ask "Leave page?". Task 10.
8. **A key typed in a field during IME composition** never sees outside text written into the field:
   a live update of the file while a field has unsaved text leaves the field unchanged. Task 4.
9. **`localStorage` that throws** on read and write: fields work, unsaved text stays in memory, the
   leave guard still asks. Task 4.

## Global constraints

From the [UI behaviour](../decisions/ui-behaviour.md) decision, word for word:

- A small edit, like a line's text, MUST happen in place: Enter or its Save button saves, Escape or
  its Cancel button cancels. Leaving the field MUST NOT save it: it stays open with its text.
- A text field MUST save only when the human presses its Save button, its own key (Enter in a
  one-line field, Ctrl+Enter or Cmd+Enter in a multi-line one), or a button that uses its text, like
  Add comment, Submit, Commit, Start, or a verdict. It MUST NOT save as it is typed, after a pause,
  or when it loses the focus. Adding an image to a field MAY save that field at once, with its text
  as typed. Toggles, switches, segmented controls, and option picks MAY save at once.
- A text field whose text differs from what is saved MUST say "Unsaved changes" next to its Save
  button. Its Save button MUST be disabled while nothing changed.
- Cancel or Escape on a field whose text changed MUST ask first, with "Discard" and "Keep editing".
- Leaving a page that holds unsaved text MUST ask first: the app's own dialog, "Leave page" and
  "Stay", for a link or Back, and the browser's prompt for a reload or a closed tab. Nothing MUST
  ask when nothing is unsaved.
- The unsaved text of every field MUST be kept in the browser until it is saved or discarded, and
  restored when the field shows again, with a notice saying so and a Discard button.
- Every multi-line text field MUST have a fixed height, set by what it holds, a little larger than
  its usual text, and the same wherever that kind of field appears: 20 rows for the editor of drafts
  and proposals, 12 for notes, 7 for every comment and summary, 4 for the chat composer, and 3 for a
  line that may wrap. A field MUST NOT grow or shrink with its text: past its height, it scrolls. It
  MAY keep the browser's resize handle, for the human to drag it taller. Every multi-line field
  except the chat composer MUST use the app's one text area.
- Every sheet and dialog MUST have a visible close button, and Back MUST close it.
- A save's status MUST show next to its control: saving, saved, or the error.
- A keyboard shortcut MUST NOT act while a text field has the focus. A field's own keys, Enter and
  Ctrl+Enter or Cmd+Enter, are not shortcuts.

From the [toolchain](../decisions/toolchain.md) decision, word for word:

- The web UI MUST be compiled with React Compiler, in its build, its dev server, and its tests,
  through `babel-plugin-react-compiler` with `@vitejs/plugin-react`'s `reactCompilerPreset` and
  `@rolldown/plugin-babel`. These packages and `@babel/core` MUST be pinned to exact versions.
- Web UI code SHOULD NOT add `memo`, `useMemo`, or `useCallback` to make rendering faster: the
  compiler memoizes. They MAY stay where a value's identity matters to an effect or a subscription.
- New web UI code MUST follow the Rules of React that the compiler relies on: no reading or writing
  a ref's `current` during render, and no mutation of props, state, or values a render captured.
  Code that changes an existing component that breaks them SHOULD fix it.

From the [code quality](../decisions/code-quality.md) decision:

- Functions MUST NOT be longer than 100 lines, take more than 7 parameters, or nest more than 4
  levels; source files MUST NOT be longer than 500 lines, tests exempt. Checked by Oxlint and
  clippy, and for Rust files by [`structure.rs`](/crates/cli/tests/structure.rs).
- A new marker MUST NOT be added unless a human approves it as a constitution exception in the
  plan's complexity tracking. A task touching a marked unit splits it first, in a commit that only
  restructures it, and removes its marker.
- Unit tests MUST NOT sleep for a fixed time, or assert how long something took.

From the [stack](../decisions/stack.md) decision: the web UI MUST draw workflow files from the
document tree the core sends, and MUST NOT parse their markdown; TypeScript types of core data MUST
come from the binding's generated declarations.

From the [UI components](../decisions/ui-components.md) decision: Astryx components wherever one
exists; no raw `button`, `input`, `textarea`, `select`, or `dialog`; styles in StyleX with Astryx's
tokens; no `style` prop, no `className` on Astryx components.

From the spec, exact text: "Save notes", "Save comment", "Add comment", "Save", "Cancel", "Unsaved
changes", "saving…", "saved ✓", "Discard your comment?", "Keep editing", "Discard", "Leave page?",
"Stay", "Leave page", "Unsaved text restored from 14:32." (the time, `HH:MM`, local, 24-hour, from
the entry's `at`), "The notes changed since: saving replaces them.", "Add or cancel your comment
first.", "That point is no longer in the round.", "Some answers were not saved: nothing was
submitted. Check them, then submit again.". Field heights: editor 20 rows, notes 12, comments and
the review summary 7, chat composer 4, quick add 3. Unsaved entries older than 30 days are dropped
when the app starts. Storage key: `uraeda:unsaved:<repository path>:<field key>`, field keys as the
spec's [Data](spec.md#data) lists them.

Existing guarantees to preserve:

- An image added to an answer's comment, the notes, or the editor saves that field at once
  ([`QuestionComment.tsx`](/packages/web/src/QuestionComment.tsx) `onImages`,
  [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx), and
  [`useEditorImages.ts`](/packages/web/src/attach/useEditorImages.ts)), and Submit waits for images
  under way, a follow-up removed during its upload included (R74 of image attachments). Tested by
  the image tests of [`round.test.tsx`](/packages/web/src/__tests__/round.test.tsx) and
  [`editor.test.tsx`](/packages/web/src/__tests__/editor.test.tsx).
- A verdict is refused while the open comment holds or is uploading an image
  ([`useReviewImages.ts`](/packages/web/src/useReviewImages.ts) `hold`), tested in
  [`review.test.tsx`](/packages/web/src/__tests__/review.test.tsx).
- Every save carries the text last read as `previous`, and the core refuses a file changed since
  ([`answer.rs`](/crates/core/src/actions/answer.rs)).
- `ura answer <feature> notes <text>` writes the notes, through `set_answer` in
  [`clarifications.rs`](/crates/core/src/files/clarifications.rs).

## Code read

- [`crates/core/src/files/clarifications.rs`](/crates/core/src/files/clarifications.rs): `notes()`
  reads from the `**Notes:**` line to the next heading, trimmed; `set_answer(text, "notes", …)`
  writes after the marker, refusing lines starting with `#`, `**Answer:**`, or `**Notes:**`. The CLI
  and `save_notes` both go through it: the one place to keep the comments.
- [`crates/core/src/files/items.rs`](/crates/core/src/files/items.rs) (499 lines, at the file
  limit): `RoundItems`, `round()`, `named_section`, which runs to the end of the file, notes
  included, and `leading_strong`. `settled` holds the section's top-level blocks, usually one list;
  its items are the blocks whose `parent` is that list.
- [`crates/core/src/actions/answer.rs`](/crates/core/src/actions/answer.rs): `save`, `save_notes`
  with the `previous` check, `submit_and_commit`.
- [`crates/core/src/api.rs`](/crates/core/src/api.rs) (898 lines, listed in
  [`structure.rs`](/crates/cli/tests/structure.rs) at 941): `save_answer`, `save_notes`,
  `submit_answers`, each `write_lock`, `reach`, the action, then `file_view`.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): `save_notes` at lines 143–150, the
  pattern for each new function; the generated `index.d.ts` is committed.
- [`packages/server/src/fate/mutations.ts`](/packages/server/src/fate/mutations.ts): `notes.save`,
  the pattern for `settled.*`; the web client is typed through `react-fate/vite`.
- [`packages/web/src/views.ts`](/packages/web/src/views.ts): `ItemsSelection.clarifications`, which
  selects `notes`, `settled`; new fields must be selected here.
- Round page: [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx) (marker on `RoundPage`, and a
  `react/refs` marker on `pending`), [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx),
  [`Question.tsx`](/packages/web/src/Question.tsx) (437 lines, markers on `Question` and `local`),
  [`QuestionComment.tsx`](/packages/web/src/QuestionComment.tsx): `PendingSaves`, `composed`,
  `GrowingTextArea`, `useCommentSaves`, and the effects that copy the file into the field.
- Review: [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx),
  [`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts) (holds `text`),
  [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx),
  [`useReviewImages.ts`](/packages/web/src/useReviewImages.ts) (`hold`, `onText` into the draft),
  [`useReviewActions.ts`](/packages/web/src/useReviewActions.ts) (`send`),
  [`YourReview.tsx`](/packages/web/src/YourReview.tsx),
  [`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx) (marker; `summary` in local state),
  [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx) (`MockupComment` keeps its own text).
- Editor: [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx) (marker; `rows` grows from 16),
  [`useEditorImages.ts`](/packages/web/src/attach/useEditorImages.ts) (`holding`, `adopt`, flush
  before uploads, `redirect` after a move, `beforeunload` while uploading).
- Lines: [`EditableLine.tsx`](/packages/web/src/EditableLine.tsx) (marker; saves on blur), used by
  [`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx) (add row, `stayOpen`),
  [`TaskView.tsx`](/packages/web/src/TaskView.tsx) (rename; slug `TextInput`), and
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) (chat title).
  [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx): a 3-row `TextArea` in an overlay.
- [`Composer.tsx`](/packages/web/src/Composer.tsx): `ChatComposerInput` without `maxRows`, which
  Astryx defaults to 8 rows of 22 px.
- [`routes.tsx`](/packages/web/src/routes.tsx): `navigate`, `redirect`, `RouterAnchor`, the
  `popstate` subscription; [`layout/useBackCloses.ts`](/packages/web/src/layout/useBackCloses.ts):
  overlays push `{overlay}` entries that Back pops;
  [`layout/Overlay.tsx`](/packages/web/src/layout/Overlay.tsx): Astryx `Dialog` on wide screens,
  `BottomSheet` on the phone, with a Close button.
- [`layout/useUndoToast.ts`](/packages/web/src/layout/useUndoToast.ts): a module-level store with
  `useSyncExternalStore`, reset in tests by `forgetUndoToasts()`: the pattern for the unsaved store.
  [`useRoundPosition.ts`](/packages/web/src/useRoundPosition.ts): `localStorage` behind try/catch.
- Tests: [`__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx) renders the app in
  happy-dom on a fixture git repository with the server in process (`renderPage`, `type`, `click`,
  `read`, `refreshUntil`), clearing `localStorage` before each test;
  [`__browser__/helpers.tsx`](/packages/web/src/__browser__/helpers.tsx) runs WebKit at 402 × 874
  and 1440 × 900 (`show`, `reload`, `checkPage`). Rust tests: `cargo test -p uraeda-core`, fixtures
  in [`fixtures/`](/fixtures/).
- Validation: `vp run ready` runs everything; while working, `cargo test -p uraeda-core`,
  `vp run --filter uraeda-binding build` after a binding change, `vp check`, and
  `vp test --project uraeda-web` or `vp test --project uraeda-web-browser` with a file filter.

## Constitution check

| Principle                         | Complies | Notes                                                                                    |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| I. Humans stay in control         | yes      | Only the approved decisions are followed; no new one                                     |
| II. Git and plain text first      | yes      | Settled comments are bullets in the notes, written and read by the core                  |
| III. Asynchronous by default      | yes      | Unsaved text in the browser is not workflow state; nothing reaches git until it is saved |
| IV. Review effort matches impact  | yes      | No question asked; the plan follows the spec                                             |
| V. Tools are optional             | yes      | Task 12 writes the bullet format into the skill, readable without the UI                 |
| VI. Code is checked, maintainable | yes      | Tests per scenario; marked units split first; one store and one hook for every field     |

## Decisions

- [UI behaviour](../decisions/ui-behaviour.md): every rule above, tasks 4 to 11.
- [Toolchain](../decisions/toolchain.md): React Compiler through Babel, task 3; no new hand
  memoization in any task.
- [Code quality](../decisions/code-quality.md): the structural steps of tasks 1, 4, 6, 8, and 9.
- [Stack](../decisions/stack.md): the notes' split lives in the core, task 1; the UI reads
  `settledPoints` and `settledComments`, never the markdown.
- [UI components](../decisions/ui-components.md) and [UI layout](../decisions/ui-layout.md): Astryx
  `TextArea`, `AlertDialog`, `Banner`; forms under their block on wide screens and in sheets on the
  phone, tasks 5 and 7.
- [UI checks](../decisions/ui-checks.md): browser checks and screenshots, tasks 11 and 13.
- [Attachments](../decisions/attachments.md): images still save their field at once, tasks 4, 6, 8.

## Complexity tracking

| Abstraction or exception                                             | Why it is needed                                                                                                                                   | Simpler alternative rejected because                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `fields/unsaved.ts`, a module-level store mirrored to `localStorage` | Every field kind (notes, comments, settled comments, review comments, summary, editor, lines, quick add, slugs) and the leave guard share one rule | State per field cannot tell the router what is unsaved, nor survive the comment form moving or a reload |
| `fields/useTextField.ts`                                             | The one way a field reads, writes, discards, and restores its unsaved text, and decides "Unsaved changes" with the trimmed comparison              | Each field doing it would copy the trimming, the notice, and the store keys into nine places            |
| `fields/TextField.tsx`, replacing `GrowingTextArea`                  | The fixed heights by kind, and Ctrl+Enter, in one place, as the decision requires one text area                                                    | `rows` at each call site would let heights drift                                                        |
| `fields/Confirm.tsx` and `fields/RestoreNotice.tsx`                  | The discard and leave dialogs, and the restore notice, shared by every field                                                                       | Astryx's `AlertDialog` at each call site would copy the texts                                           |
| `fields/LeaveGuard.tsx` and a guard check in `routes.tsx`            | One check for links, `navigate`, Back, and `beforeunload`                                                                                          | A guard per page would miss direct `navigate` calls                                                     |
| `crates/core/src/api/answers.rs`                                     | The answer and notes functions, and the three new ones, out of `api.rs`, listed over the file limit                                                | Growing `api.rs` breaks the structural test                                                             |
| `crates/core/src/files/items/round.rs`                               | `round()` and its helpers out of `items.rs`, which is at 499 lines                                                                                 | New fields would push `items.rs` past 500                                                               |

No new marker, and no constitution exception.

---

## Task 1: The core splits the notes, and ends the settled section at them

**Files:**

- Create: `crates/core/src/files/items/round.rs`, `crates/core/src/api/answers.rs`
- Modify: `crates/core/src/files/items.rs`, `crates/core/src/api.rs`,
  `crates/core/src/files/clarifications.rs`, `crates/cli/tests/structure.rs` (`api.rs`'s length)
- Test: `crates/core/src/files/clarifications.rs` (tests module), `crates/core/tests/` (round
  items), `crates/cli/tests/` (`ura answer notes`), a fixture round with notes and comments under
  `fixtures/`

**Interfaces:**

- Produces:
  - `pub struct SettledPoint { pub block: u32, pub subject: String }` and
    `pub struct SettledComment { pub number: u32, pub subject: String, pub point: u32, pub text: String }`,
    napi objects in camelCase, like `RoundItems`.
  - `RoundItems` gains `settled_points: Vec<SettledPoint>` and
    `settled_comments: Vec<SettledComment>`; `settled` ends before the `**Notes:**` line; `notes`
    holds the free notes only, trimmed.
  - `clarifications::split_notes(notes: &str, subjects: &[String]) -> (String, Vec<(String, String)>)`:
    the free notes and the `(subject, text)` comments, in order.
  - `clarifications::join_notes(free: &str, comments: &[(String, String)]) -> String`: the free
    notes, a blank line, then one bullet per comment, `- **<subject>**: <text>`, further lines
    indented by two spaces.
  - `set_answer(text, "notes", free)` writes `free` and keeps the file's comments after it. Every
    caller, `save_notes` and the CLI, gets this.

- [x] **Step 1: Split `items.rs` and `api.rs` before they change**

Move `round()`, `named_section`, `leading_strong`, and `choices` into `files/items/round.rs`
(`section` stays in `items.rs`, shared with specs and rulings, R3), and `save_answer`, `save_notes`,
`submit_answers`, with `round_name`, from `api.rs` into `api/answers.rs`, re-exported so no caller
changes. Lower `api.rs`'s length in `structure.rs`'s `LARGE` list to its new length.

- Run:
  `cargo test -p uraeda-core && cargo test -p uraeda-cli --test structure && cargo clippy --workspace --all-targets -- -D warnings`,
  before and after
- Expected: PASS both times

```bash
git add crates/core/src crates/cli/tests/structure.rs
git commit -m "refactor(text-inputs): the round's items and the answer functions in modules of their own"
```

- [ ] **Step 2: Write the failing tests**

One table-driven test of `split_notes` and `join_notes`, rows:

| Notes text                                                        | Subjects               | Free notes      | Comments                                                      |
| ----------------------------------------------------------------- | ---------------------- | --------------- | ------------------------------------------------------------- |
| `Overall fine.`                                                   | `Undoing a completion` | `Overall fine.` | none                                                          |
| `Overall fine.\n\n- **Undoing a completion**: Keep the undo.`     | `Undoing a completion` | `Overall fine.` | (`Undoing a completion`, `Keep the undo.`)                    |
| `- **Undoing a completion**: Keep the undo.\n  Also for deletes.` | `Undoing a completion` | empty           | (`Undoing a completion`, `Keep the undo.\nAlso for deletes.`) |
| `- **Nothing matches**: stays free.`                              | `Undoing a completion` | the same text   | none                                                          |
| `Intro\n- **Undoing a completion**: written by hand\nOutro`       | `Undoing a completion` | `Intro\nOutro`  | (`Undoing a completion`, `written by hand`)                   |

Plus: `join_notes` of each row's parts, split again, gives the same parts (SC-006). A round test on
the fixture: `settled` holds no block at or after the `**Notes:**` line; `settled_points` lists each
item's bold subject; a comment on a subject used twice points at the first point. A CLI test:
`ura answer <fixture> notes "New"` keeps the fixture's comment bullet.

The break each test catches:

- Hand-written bullet mid-notes: a split that only reads bullets at the end.
- Multi-line comment: continuation lines kept in the free notes, or their indentation kept in the
  text.
- No matching subject: every bold bullet taken as a comment.
- Settled section: `named_section` still running to the end of the file.
- CLI: `set_answer` writing over the comments.

- [ ] **Step 3: Run them to check they fail**

- Run: `cargo test -p uraeda-core notes`
- Expected: FAIL, `cannot find function split_notes`

- [ ] **Step 4: Implement**

The split and join in `clarifications.rs`; `round()` computes `settled_points` from the list items
of the settled section with a leading strong span, trimmed, then splits the notes with their
subjects; the settled section stops at the block holding the notes line. `set_answer` for `notes`
reads the file's current comments with the file's own subjects, then writes
`join_notes(answer, comments)`. Regenerate the binding's declarations.

- [ ] **Step 5: Run all tests**

- Run: `cargo test && vp run --filter uraeda-binding build && vp test --project uraeda-web`
- Expected: PASS. A web test asserting the notes appear among the settled points, if any, fails and
  is changed with a ruling.

- [ ] **Step 6: Commit**

```bash
git add crates fixtures packages/binding
git commit -m "feat(text-inputs): the core splits the notes from the comments on settled points"
```

## Task 2: Adding, editing, and removing a comment on a settled point

**Files:**

- Modify: `crates/core/src/actions/answer.rs`, `crates/core/src/api/answers.rs`,
  `crates/binding/src/lib.rs`, `packages/server/src/fate/mutations.ts`, `packages/web/src/views.ts`
  (select `settledPoints`, `settledComments`)
- Test: `crates/core/tests/` (actions), `packages/server/src/` mutation test if the package has one
  for `notes.save`, else covered by task 5's UI tests

**Interfaces:**

- Consumes: task 1's `split_notes`, `join_notes`, `SettledComment`.
- Produces:
  - core `answer::add_settled_comment(place, feature, subject: &str, text: &str)`,
    `answer::edit_settled_comment(place, feature, number: u32, text: &str, previous: &str)`,
    `answer::remove_settled_comment(place, feature, number: u32, previous: &str)`, each
    `Result<Written, ActionError>`, writing nothing on refusal.
  - api and binding: `addSettledComment(repo, folder, subject, text)`,
    `editSettledComment(repo, folder, number, text, previous)`,
    `removeSettledComment(repo, folder, number, previous)`, each `Promise<FileView>`.
  - fate mutations `settled.comment` `{folder, subject, text}`, `settled.edit`
    `{folder, number, text, previous}`, `settled.remove` `{folder, number, previous}`, each
    `type: "WorkflowFile"`, returning the file as `notes.save` does.

- [ ] **Step 1: Write the failing tests**

- Adding to a round whose notes are "Overall fine." appends
  `- **Undoing a completion**: Keep the undo.` after a blank line (US4 1).
- Adding a two-line comment writes the second line indented by two spaces (US4 8).
- Editing comment 1 with `previous` "Keep the undo." writes the new text; with `previous` "Other" it
  is refused with the core's "changed since" error, the file unchanged.
- Removing comment 1 leaves the free notes and the other comments.
- Adding on an unknown subject is refused with "That point is no longer in the round.".
- Adding a comment with a line starting `#` is refused with the structure error.

The break each test catches: appending inside the free notes; an edit that ignores `previous`; a
remove that renumbers into the wrong bullet; a refusal that writes anyway.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core settled`
- Expected: FAIL, `cannot find function add_settled_comment`

- [ ] **Step 3: Implement** the three actions in `answer.rs` on top of `split_notes`/`join_notes`
      and `set_answer`'s structure check, the api functions with `write_lock` and `file_view` like
      `save_notes`, the binding functions, and the three mutations.

- [ ] **Step 4: Run all tests**

- Run:
  `cargo test && vp run --filter uraeda-binding build && vp check && vp test --project uraeda-server`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates packages/binding packages/server packages/web/src/views.ts
git commit -m "feat(text-inputs): comments on settled points are added, edited, and removed"
```

## Task 3: React Compiler compiles the web UI

**Files:**

- Modify: `packages/web/package.json`, `pnpm-workspace.yaml` (catalog, exact versions),
  `packages/web/vite.config.ts`, `packages/web/vite.browser.config.ts` (it reuses the plugins)
- Test: `packages/web/src/__tests__/compiler.test.tsx`

**Interfaces:**

- Produces: every web module compiled by `reactCompilerPreset()` through `@rolldown/plugin-babel`,
  in `vp dev`, `vp build`, and both test projects.

- [ ] **Step 1: Write the failing test**

```tsx
test("a component whose props did not change does not render again (React Compiler)", async () => {
  const renders = vi.fn();
  function Child({ label }: { label: string }) {
    renders();
    return <span>{label}</span>;
  }
  function Parent() {
    const [count, setCount] = useState(0);
    return (
      <>
        <button onClick={() => setCount(count + 1)}>{count}</button>
        <Child label="fixed" />
      </>
    );
  }
  render(<Parent />);
  await click(screen.getByRole("button", { name: "0" }));
  expect(renders).toHaveBeenCalledTimes(1);
});
```

The break it catches: the plugin missing from the tests' config, where the child renders twice.

- [ ] **Step 2: Run it to check it fails**

- Run: `vp test --project uraeda-web compiler`
- Expected: FAIL, `expected "spy" to be called 1 times, but got 2 times`

- [ ] **Step 3: Implement**: add `@rolldown/plugin-babel`, `@babel/core`, and
      `babel-plugin-react-compiler` as exact versions, and
      `babel({ presets: [reactCompilerPreset()] })` after `react()`. A raw `button` in a test file
      is allowed: the lint rule covers `packages/web/src` sources, check it does not cover tests; if
      it does, use Astryx's `Button`.

- [ ] **Step 4: Run all tests and the build**

- Run: `vp check && vp test && vp run --filter uraeda-web build`
- Expected: PASS. A test that relied on a re-render the compiler now skips fails; fix the code,
  never the test, and write a ruling.

- [ ] **Step 5: Commit**

```bash
git add packages/web pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "build(text-inputs): React Compiler compiles the web UI"
```

## Task 4: The notes save with their button, on the shared unsaved store

**Files:**

- Create: `packages/web/src/fields/unsaved.ts`, `fields/useTextField.ts`, `fields/TextField.tsx`,
  `fields/Confirm.tsx`, `fields/RestoreNotice.tsx`
- Modify: `packages/web/src/RoundPage.tsx`, `RoundNotes.tsx`, `Question.tsx` (`GrowingTextArea`
  moves out), `__tests__/helpers.tsx` (reset the store before each test)
- Test: `packages/web/src/__tests__/notes.test.tsx`, `__tests__/unsaved.test.ts`,
  `__tests__/round.test.tsx` (the autosave tests change, with a ruling)

**Interfaces:**

- Produces:
  - `fields/unsaved.ts`:
    `type Unsaved = { text: string; base: string; at: string; extra?: { start: number; end: number; heading: string; commit: string } }`;
    `unsavedKey(repo: string, field: string): string`; `readUnsaved(key): Unsaved | undefined`;
    `writeUnsaved(key, value: Unsaved)`; `dropUnsaved(key)`; `useUnsaved(key): Unsaved | undefined`
    (subscribes to one key); `hasUnsaved(prefix?: string): boolean` and
    `useHasUnsaved(prefix?: string): boolean`; `pruneUnsaved(now: Date)` (drops entries older than
    30 days, called once at start); `forgetUnsaved()` for tests. `localStorage` errors fall back to
    memory.
  - `fields/useTextField.ts`:
    `useTextField(key: string, saved: string): { text: string; dirty: boolean; restored?: { at: string; changed: boolean }; change(text: string): void; discard(): void; saved(text: string): void }`.
    `dirty` compares trimmed texts; `change` writes the entry, or drops it when equal to `saved`
    trimmed; `saved(text)` drops the entry; `restored` is set when the entry existed at mount and
    differs from `saved`, `changed` when its `base` differs from `saved`.
  - `fields/TextField.tsx`:
    `TextField({ kind: "editor" | "notes" | "comment" | "line", onSubmit?, ...TextAreaProps })`:
    Astryx `TextArea` with `rows` 20, 12, 7, or 3, and Ctrl+Enter or Cmd+Enter calling `onSubmit`.
  - `fields/Confirm.tsx`:
    `useConfirm(): (options: { title: string; body: string; confirm: string; cancel: string }) => Promise<boolean>`
    and its host, rendered once in `App.tsx`, on Astryx's `AlertDialog`.
  - `fields/RestoreNotice.tsx`: `RestoreNotice({ restored, onDiscard, answered? })`, texts from the
    global constraints.

- [ ] **Step 1: Split `RoundPage` before it changes**

Move the submit into `useRoundSubmit(file, notes, pending)` and the end of the page (notes,
questions left, error, Submit) into a component, so `RoundPage` is under 100 lines; replace the
`pending` ref with `useState(() => new Set())[0]`, removing both markers.

- Run: `vp check && vp test --project uraeda-web round`, before and after
- Expected: PASS both times, no unused marker

```bash
git add packages/web/src/RoundPage.tsx packages/web/src/RoundSubmit.tsx
git commit -m "refactor(text-inputs): the round's submit and its end of page out of RoundPage"
```

- [ ] **Step 2: Write the failing tests**

In `notes.test.tsx`, on a fixture round awaiting the human:

- US1 1 and SC-003: type "Keep the undo ", write another file in the repository and wait until the
  page has read it (`refreshUntil`), type "please": the field reads "Keep the undo please", the page
  shows "Unsaved changes", the file's notes line is still empty.
- US1 2: press "Save notes": the file reads `**Notes:** Keep the undo please`, the status "saved ✓".
- US1 3: unsaved "Draft one", then the CLI-like write of an answer to Q1 on disk: the field still
  reads "Draft one".
- US1 4: saved notes show once: `getAllByText("Keep the undo please")` has one element.
- US1 5: Ctrl+Enter in the field saves.
- US2 8: with nothing changed, "Save notes" is disabled, and no "Unsaved changes".
- US5 1 and 2: type "Bigger icon", unmount and render the page again: the field reads "Bigger icon",
  the notice "Unsaved text restored from" with the time, Discard brings back the saved notes, and a
  further remount restores nothing.
- US5 3: restored over notes changed since: the notice adds "The notes changed since: saving
  replaces them."
- Review focus 1: type "Typed", add an image with "Add image to the notes": the file holds "Typed"
  and the link, and a remount shows no notice.
- Review focus 2: a save refused (notes changed on disk since the page read them): the error shows,
  and a remount restores the text.
- Review focus 3: "Fine " over saved "Fine": no "Unsaved changes".
- Review focus 4: unsaved notes, then the round answered on disk: the notice says the round was
  answered.

In `unsaved.test.ts`, table-driven: entries older than 30 days pruned, younger kept; a
`localStorage` whose methods throw keeps entries in memory (review focus 9).

Change `round.test.tsx`'s "the notes are saved as the last line" and "Submit waits for the notes
being typed" to save with the button and with Submit; write a ruling saying what each checked and
why it changed.

The break each test catches: the field copying the file's notes while dirty (US1 3, SC-003); a
`dirty` without trimming (focus 3); the entry kept after an image's save (focus 1); an entry dropped
on a refused save (focus 2); the restore notice ignoring `base` (US5 3).

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test --project uraeda-web notes unsaved`
- Expected: FAIL, `Unable to find an element with the text: Unsaved changes`

- [ ] **Step 4: Implement**

The five `fields/` modules, `pruneUnsaved` called once in `App.tsx`; the notes field on
`useTextField(\`${path}#notes\`, notes)`and`TextField
kind="notes"`, a "Save notes" button with the status beside it; `useRoundNotes`loses its effect copying the file into the field and its`schedule`calls; an image run calls the save at once with the text and drops the entry. The`Blocks`of the settled points render`round.settled`, which no longer holds the notes. Every caller of `GrowingTextArea`moves to`TextField`with its kind:`"comment"`in`QuestionComment`, `CommentForm`, and `ReviewVerdict`.

- [ ] **Step 5: Run all tests**

- Run: `vp check && vp test --project uraeda-web`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(text-inputs): the notes save with their button, and keep what is typed"
```

## Task 5: Settled points take comments

**Files:**

- Create: `packages/web/src/SettledPoints.tsx`
- Modify: `packages/web/src/RoundPage.tsx` (or the component task 4 split out),
  `packages/web/src/CommentForm.tsx` (its text through `useTextField` by a key the caller gives)
- Test: `packages/web/src/__tests__/settled.test.tsx`

**Interfaces:**

- Consumes: task 2's `settled.*` mutations and `settledPoints`/`settledComments`; task 4's
  `useTextField`, `TextField`, `useConfirm`.
- Produces: `CommentForm` takes `field: string` (its unsaved key) instead of `text` and
  `onTextChange`; Cancel asks "Discard your comment?" when its text changed.
  `SettledPoints({ file, readOnly })`.

- [ ] **Step 1: Write the failing tests**

US4 1 to 8, on a fixture round with the recurring-tasks example's settled points, with the values of
the spec's scenarios: tap "Undoing a completion", type, "Add comment", read the notes from the file;
the notes field shows only "Overall fine."; saving the notes keeps the bullet; Edit then "Save
comment"; Remove; a submitted round shows the comments read-only, with no Edit or Remove; unsaved
notes untouched by adding a comment; two lines. Plus US5 7 and 8 on this form: Cancel with text asks
"Discard your comment?", "Keep editing" keeps it, an empty form closes without asking. Plus the
spec's edge case: a comment whose point left the round shows "That point is no longer in the
round.".

The break each test catches: the bullet shown in the notes field (US4 2); a notes save dropping the
comments (US4 3); Edit or Remove on a read-only round (US4 6); adding a comment saving the notes
field's draft (US4 7).

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-web settled`
- Expected: FAIL,
  `Unable to find an accessible element with the role "button" and name "Undoing a completion"`

- [ ] **Step 3: Implement**: each settled point with a subject is a selectable block, as in
      [`Selection.tsx`](/packages/web/src/Selection.tsx); the form under it on wide screens and in
      an `Overlay` sheet on the phone, keyed `${path}#settled:<subject>` or
      `${path}#settled-edit:<number>`; comments under their point through `PendingComment`'s look,
      with Edit and Remove only while awaiting the human. The review page keeps passing its text
      until task 7: give `CommentForm` both modes only if needed, and remove the old one in task 7.

- [ ] **Step 4: Run all tests**

- Run: `vp check && vp test --project uraeda-web`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(text-inputs): comments on the points settled without the human"
```

## Task 6: Question comments and Submit on the shared store

**Files:**

- Modify: `packages/web/src/Question.tsx`, `QuestionComment.tsx`, the round's submit from task 4
- Test: `packages/web/src/__tests__/round.test.tsx`

**Interfaces:**

- Consumes: task 4's `useTextField`, task 5's settled forms.
- Produces: `PendingSaves` entries also come from open settled-point forms holding text.

- [ ] **Step 1: Split `Question` before it changes**

Move the answer's saving into `useAnswer(question, folder)`, so `Question` is under 100 lines, and
keep the latest answer for the effects without writing a ref during render, removing the
`max-lines-per-function` and `react/refs` markers. The `forbid-elements` marker on the option stays.

- Run: `vp check && vp test --project uraeda-web round`, before and after
- Expected: PASS both times

```bash
git add packages/web/src/Question.tsx packages/web/src/useAnswer.ts
git commit -m "refactor(text-inputs): a question's saving in a hook"
```

- [ ] **Step 2: Write the failing tests**

- US2 1: Q2 saved with "Fine", the field changed to "Fine, but daily only", tap B: the answer line
  reads `**Answer:** B: Fine`, the field keeps its text and "Unsaved changes".
- US2 2: then "Save comment": `**Answer:** B: Fine, but daily only`.
- US5 9: an unsaved Q3 comment, unsaved notes, and an open settled-point comment with text; "Submit
  answers": all three saved, then the round submitted.
- Review focus 5: an open settled-point form with blank text; Submit adds no comment, and submits.
- A Q3 comment typed, the page remounted: restored with the notice.

The break each test catches: a tap saving the typed comment (US2 1); Submit skipping the settled
form (US5 9); Submit adding an empty bullet (focus 5).

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test --project uraeda-web round`
- Expected: FAIL, `expected '**Answer:** B: Fine, but daily only' to be '**Answer:** B: Fine'`

- [ ] **Step 4: Implement**: the comment through `useTextField(\`${path}#${id}\`,
      savedComment)`;     a tap commits `{letters, comment: savedComment}`; "Save comment" and
      Ctrl+Enter commit the typed text; an image run commits the typed text with its links, as
      today. Submit's pending set also saves each open settled-point form with text.

- [ ] **Step 5: Run all tests**

- Run: `vp check && vp test --project uraeda-web`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(text-inputs): a tap saves the letters, and a comment saves with its button"
```

## Task 7: Review comments keep up, and the summary is kept

**Files:**

- Modify: `packages/web/src/useCommentDraft.ts` (no `text`), `ReviewPage.tsx`, `useReviewImages.ts`,
  `useReviewActions.ts`, `ReviewComments.tsx`, `CommentForm.tsx` (drop the `text` mode),
  `MockupPage.tsx`, `ReviewVerdict.tsx` (split first)
- Test: `packages/web/src/__tests__/review.test.tsx`, `__tests__/mockup.test.tsx`

**Interfaces:**

- Consumes: tasks 3 to 5.
- Produces: the review comment's text in the store under `${path}#review` or
  `${path}#review-edit:<number>`, with `extra` holding the selection and the reviewed commit.

- [ ] **Step 1: Split `ReviewVerdict` before it changes**

Move the tier and plan review choices into a component, removing its marker.

- Run: `vp check && vp test --project uraeda-web review`, before and after
- Expected: PASS both times

```bash
git add packages/web/src/ReviewVerdict.tsx packages/web/src/ReviewChoices.tsx
git commit -m "refactor(text-inputs): the verdict's tier and plan review choices in a component"
```

- [ ] **Step 2: Write the failing tests**

- US3 1 and SC-002: a spec of 300 blocks (a generated fixture), a comment form open on line 40, type
  "a" with React's `Profiler` around the document's `Blocks`: the profiler's `onRender` is not
  called for the keystroke.
- US3 2: "Too vague" typed on line 40, tap the block holding line 52: the form under it still reads
  "Too vague", anchored "Lines 40–52".
- US3 3: "Add comment": the comment shows under its block marked "saving…" before the server answers
  (hold the mutation with a deferred `fetch`), then without the mark.
- US5 7 and 8 on the review form.
- US5 10: a form open with text, Approve: "Add or cancel your comment first." and no verdict
  written.
- A typed comment restored after a remount, its selection included; review focus 6: restored after
  the reviewed commit changed, as a general comment starting "On lines 40–52 of the previous
  version:".
- The summary typed, remounted: restored. The mockup page's comment typed, the overlay closed with
  Discard confirmed: gone; closed with "Keep editing": kept.

The break each test catches: the text back in page state (US3 1); a form remount losing the text
(US3 2); a verdict ignoring a form with text but no image (US5 10); a restore that keeps stale line
numbers (focus 6).

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test --project uraeda-web review mockup`
- Expected: FAIL, `expected "spy" to not be called`

- [ ] **Step 4: Implement** within the approved behaviour; `hold` also refuses while the form holds
      text, with the existing UNSENT message changed to "Add or cancel your comment first.".

- [ ] **Step 5: Run all tests**

- Run: `vp check && vp test --project uraeda-web`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(text-inputs): review comments render alone, and survive a reload"
```

## Task 8: The editor saves with its button

**Files:**

- Modify: `packages/web/src/EditorPage.tsx` (split first), `attach/useEditorImages.ts`,
  `TaskView.tsx` (the slug), `useSave.ts` (no timer, no `schedule` delay)
- Test: `packages/web/src/__tests__/editor.test.tsx`

**Interfaces:**

- Consumes: task 4's `useTextField`, `TextField kind="editor"`.
- Produces: `useSave(run, initial)` without `delay`; `schedule(value)` replaced by `save(value)`,
  which queues at once; `idle`, `settle`, `flush`, `write`, `state` unchanged.

- [ ] **Step 1: Split `EditorPage` before it changes**

Move the commit, start, and discovery actions into a hook, removing its marker.

- Run: `vp check && vp test --project uraeda-web editor`, before and after
- Expected: PASS both times

```bash
git add packages/web/src/EditorPage.tsx packages/web/src/useEditorActions.ts
git commit -m "refactor(text-inputs): the editor's actions in a hook"
```

- [ ] **Step 2: Write the failing tests**

- US2 3: change the text, wait for another file's change to be read (`refreshUntil`): the file is
  unchanged, "Unsaved changes" next to "Save".
- US2 4: "Commit" with unsaved text: the text saved, then committed.
- Save and Ctrl+Enter save; an image added saves at once with the typed text (existing tests keep
  passing).
- The slug typed, remounted: restored.
- A remount restores the editor's text, with the notice.

The break each test catches: a leftover timer saving (US2 3); Commit committing the old text (US2
4).

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test --project uraeda-web editor`
- Expected: FAIL, `expected file to equal the committed text`

- [ ] **Step 4: Implement**, and remove `useSave`'s timer and its `react/refs` marker once no caller
      schedules with a delay.

- [ ] **Step 5: Run all tests**

- Run: `vp check && vp test --project uraeda-web`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(text-inputs): the editor saves with its button"
```

## Task 9: Lines edited in place save with Enter or Save, and quick add keeps its text

**Files:**

- Modify: `packages/web/src/EditableLine.tsx` (split first), `PrioritiesPage.tsx`, `TaskView.tsx`,
  `SessionPage.tsx` (their keys), `QuickAdd.tsx`
- Test: `packages/web/src/__tests__/priorities.test.tsx`, `__tests__/task.test.tsx`

**Interfaces:**

- Produces: `EditableLine` takes `field: string`, its unsaved key: `priorities#<entry key>` for a
  line, `priorities#add:<section>` for an add row, `session#<id>:title` for a chat title; `QuickAdd`
  uses `quick-add` and `TextField kind="line"`.

- [ ] **Step 1: Split `EditableLine` before it changes**: the save in a hook, removing its marker.

- Run: `vp check && vp test --project uraeda-web priorities task`, before and after
- Expected: PASS both times

```bash
git add packages/web/src/EditableLine.tsx packages/web/src/useLineSave.ts
git commit -m "refactor(text-inputs): a line's save in a hook"
```

- [ ] **Step 2: Write the failing tests**: US2 5, 6, and 7 with "Run the web UI with npx" and ", and
      a version check"; Save and Cancel buttons; quick add's text kept after the overlay is closed
      with "Keep editing", restored after a remount. The break: a blur still saving (US2 5).

- [ ] **Step 3: Run them to check they fail**

- Run: `vp test --project uraeda-web priorities task`
- Expected: FAIL, `expected PRIORITIES.md to be unchanged`

- [ ] **Step 4: Implement**

- [ ] **Step 5: Run all tests**

- Run: `vp check && vp test --project uraeda-web`
- Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(text-inputs): lines save with Enter or Save, never on blur"
```

## Task 10: Leaving a page with unsaved text asks first

**Files:**

- Create: `packages/web/src/fields/LeaveGuard.tsx`
- Modify: `packages/web/src/routes.tsx` (`navigate`, `RouterAnchor`, the `popstate` path), `App.tsx`
- Test: `packages/web/src/__tests__/leave.test.tsx`

**Interfaces:**

- Consumes: task 4's `useHasUnsaved(prefix)`, `useConfirm`.
- Produces: `setLeaveGuard(check: (() => Promise<boolean>) | undefined)` in `routes.tsx`, consulted
  by `navigate` and links; `redirect` is never guarded.

- [ ] **Step 1: Write the failing tests**

- US5 4: an unsaved Q3 comment, a link to the feature's page: "Leave page?"; "Stay" keeps the page,
  "Leave page" opens the feature's page.
- US5 5: Back with an unsaved comment asks the same; "Leave page" goes back.
- US5 6: no unsaved text: a link and Back do not ask; no `beforeunload` listener is attached.
- US5 1's browser prompt: with unsaved text, a `beforeunload` event is cancelled.
- Review focus 7: Back closing a sheet with an unsaved comment inside it does not ask; the editor's
  redirect after a move does not ask.

The break each test catches: a guard only on `RouterAnchor`, missing `navigate` (US5 4 through a
`navigate` call); Back not re-pushed (US5 5); a guard on overlay pops (focus 7).

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-web leave`
- Expected: FAIL, `Unable to find role="alertdialog"`

- [ ] **Step 3: Implement**: the guard asks only when the store holds unsaved text for the page's
      repository path; Back re-pushes the left entry before asking, and ignores entries whose state
      is an overlay; the `beforeunload` listener exists only while something is unsaved.

- [ ] **Step 4: Run all tests**

- Run: `vp check && vp test --project uraeda-web`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(text-inputs): leaving a page with unsaved text asks first"
```

## Task 11: Fixed heights, the chat composer included

**Files:**

- Modify: `packages/web/src/Composer.tsx`, `packages/web/src/theme/theme.ts` if a size is missing
- Test: `packages/web/src/__browser__/fields.test.tsx`

**Interfaces:**

- Consumes: task 4's `TextField` kinds, now used everywhere.

- [ ] **Step 1: Write the failing browser tests**, at both sizes: US6 1 to 8 with the heights of the
      global constraints, measured as `clientHeight` against the field's line height and padding; 30
      lines typed leave each height unchanged (SC-005); the content below a comment field does not
      move as 12 lines are typed (US6 3); the composer is 4 rows empty and with 10 lines; dragging a
      comment field's resize handle makes it taller (US6 8). The break: the composer's default
      growth.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-web-browser fields`
- Expected: FAIL on the composer: its height with 10 lines exceeds 4 rows

- [ ] **Step 3: Implement**: `maxRows={4}` and a fixed height of 4 rows through its `xstyle`, from
      the theme's sizes.

- [ ] **Step 4: Run all tests**

- Run: `vp check && vp test`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(text-inputs): every multi-line field has a fixed height"
```

## Task 12: The skill describes comments on settled points

**Files:**

- Modify: `skills/uraeda/SKILL.md` or the reference that holds the clarifications conventions
  (`references/conventions.md`), `skills/uraeda/references/spec.md` ("Read the answers"),
  `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md` (one comment
  in its notes)
- Test: `cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs`

- [ ] **Step 1: Write**: the human may comment on a settled point with a bullet at the end of the
      notes, `- **<the point's bold subject>**: <comment>`; the spec step reads it as the human's
      answer to that point. The example's notes get
      `- **Repeating tasks show a repeat icon**: Yes, the same icon as in the menu.`, which its spec
      already agrees with.

- [ ] **Step 2: Run the check**

- Run: `cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs && vp check`
- Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add skills
git commit -m "docs(text-inputs): comments on settled points in the skill and its example"
```

## Task 13: Layout checks and screenshots

**Files:**

- Modify: `packages/web/src/__browser__/layout.test.tsx` (the round page with a settled comment
  open, the dialogs)
- Create: `specs/2026-10-14-text-inputs/screenshots/`

- [ ] **Step 1: Add the changed views to the layout checks**: the round page with a comment under a
      settled point and a form open, the restore notice, the "Leave page?" and "Discard your
      comment?" dialogs, at both sizes, light and dark.

- [ ] **Step 2: Run them**

- Run: `vp test --project uraeda-web-browser layout`
- Expected: PASS

- [ ] **Step 3: Take and review screenshots** of every changed view at both sizes and themes, with
      `vp run --filter uraeda-web screenshots`, against the mockups; fix what differs.

- [ ] **Step 4: Run the full validation**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-14-text-inputs/screenshots
git commit -m "test(text-inputs): layout checks and screenshots of the changed views"
```
