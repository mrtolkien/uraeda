---
status: awaiting-human
revision: 3
clarifications: 1
risk-tier: high
plan-review: true
---

# Spec: Text inputs and comments

> [!IMPORTANT]
>
> Spec to review, about 5 minutes: every multi-line field has a fixed height, everywhere.
>
> - C1: done. No multi-line field grows or shrinks with its text: each has a fixed height, and
>   scrolls when its text is longer. The lines you commented on are in the oldest record below,
>   which still describes revision 1's growing text areas; that design was replaced in revision 2.
> - Each field keeps the browser's resize handle, so you can still drag a field taller by hand.
> - The chat composer gets a fixed height too, 4 rows: today it grows from 1 to 8 rows as you type.
> - Heights by kind of field: the proposal editor 20 rows, the notes 12, every comment and the
>   review summary 7, the chat composer 4, quick add 3.

> [!NOTE]
>
> Changes requested on 2026-10-14: 1 comment in spec-review.md.
>
> - C1: done. Every multi-line field has a fixed height by what it holds, and scrolls past it: the
>   proposal editor 20 rows, the notes 12, every comment and the review summary 7, quick add 3. The
>   [UI behaviour](../decisions/ui-behaviour.md#proposed-change-2026-10-14-text-inputs) change, US6,
>   SC-005, the components, the assumptions, and the mockup's last section follow.
> - Each field keeps the browser's resize handle, so a long text can still be given more room by
>   hand.

> [!NOTE]
>
> Changes requested on 2026-10-14: 1 comment in spec-review.md.
>
> - Two changed decisions:
>   [UI behaviour](../decisions/ui-behaviour.md#proposed-change-2026-10-14-text-inputs) gains the
>   saving rules, from Save buttons to text kept in the browser and one growing text area, and lines
>   stop saving on blur;
>   [toolchain](../decisions/toolchain.md#proposed-change-2026-10-14-text-inputs) compiles the web
>   UI with React Compiler, through Babel, the stable route.
> - React Compiler alone does not stop the comment lag: the review page holds the comment's text and
>   passes it into the document. The comment's text also moves out of the page, into a store of
>   unsaved text shared by every field.
> - Comments on settled points are bullets at the end of the notes, found by their point's bold
>   subject; the notes field shows only the free notes, and saving it keeps the bullets. The skill
>   and its example learn the format.
> - This feature is built after image attachments merges into main, and keeps its rule that adding
>   an image saves its field at once: the one exception to saving on a button.
> - Your note on text areas: every multi-line field becomes one growing text area, measured rather
>   than guessed, which removes the empty rows the editor and comments had.
> - Risk tier `high`, for a compiler that changes how every component renders, and a format agents
>   read in every round: the plan waits for your review.

Every text field of the web UI saves only with its button or its own key, never as it is typed or on
blur, and what is typed and not saved survives a reload. The round's notes stop losing letters and
showing twice, review comments stop lagging, and the points a round settled without the human take
comments, written into its notes. It is for the human, whose main work in the UI is writing. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Notes keep what you type (P1)

The human writes the round's notes, pausing as they think. Nothing is saved until they press "Save
notes" or Ctrl+Enter, so nothing comes back from the file into the field while they type. The notes
show once, in their field, not among the settled points.

Why this priority: letters lost while typing is the proposal's first bug, and the notes are where
the human writes the most.

Acceptance scenarios:

1. **Given** a round awaiting the human with empty notes, **When** the human types "Keep the undo ",
   waits 2 seconds, then types "please", **Then** the field reads "Keep the undo please", says
   "Unsaved changes", and the file's **Notes:** line is still empty.
2. **Given** the field reads "Keep the undo please", **When** the human presses "Save notes",
   **Then** the file reads `**Notes:** Keep the undo please`, the field is unchanged, and the status
   reads "saved ✓".
3. **Given** unsaved notes "Draft one", **When** the file changes on disk for another reason, like a
   question answered from the CLI, **Then** the field still reads "Draft one".
4. **Given** saved notes "Keep the undo please", **When** the round page shows, **Then** the text
   "Keep the undo please" shows once, in the notes field, and not under "Settled without you".
5. **Given** the notes field has the focus and reads "Line one", **When** the human presses
   Ctrl+Enter (Cmd+Enter on a Mac), **Then** the notes are saved as "Line one".

### US2: Every text field saves only with a button (P1)

The question comments, the notes, the proposal editor, review comments and summaries, lines edited
in place, quick add, and slugs save only with their button, their own key, or a button that uses
their text, like Submit or Commit. A tap on an option still saves at once, with the comment as last
saved.

Why this priority: it is the proposal's rule, and the cause of the lost letters.

Acceptance scenarios:

1. **Given** Q2 with the saved comment "Fine" and the field changed to "Fine, but daily only",
   **When** the human taps option B, **Then** the answer line reads `**Answer:** B: Fine`, and the
   comment field still reads "Fine, but daily only", with "Unsaved changes".
2. **Given** the same Q2, **When** the human then presses "Save comment", **Then** the answer line
   reads `**Answer:** B: Fine, but daily only`.
3. **Given** the proposal editor with the text changed, **When** 5 seconds pass, **Then** the file
   on disk is unchanged, and the page says "Unsaved changes" next to "Save".
4. **Given** the proposal editor with unsaved text, **When** the human presses "Commit", **Then**
   the text is saved, then committed.
5. **Given** a priority line "Run the web UI with npx" open for editing and changed to "Run the web
   UI with npx, and a version check", **When** the human taps elsewhere on the page, **Then** the
   line stays open with its text, and `PRIORITIES.md` is unchanged.
6. **Given** the same open line, **When** the human presses Enter, or "Save", **Then** the line is
   saved and closes.
7. **Given** the same open line, **When** the human presses Escape, or "Cancel", **Then** the
   discard confirmation from US5 shows.
8. **Given** a field with no change since its last save, **Then** its Save button is disabled, and
   no "Unsaved changes" shows.

### US3: Review comments keep up with typing (P1)

On a long spec, the human taps a block and types a comment; each keystroke redraws the comment form,
not the spec.

Why this priority: the proposal names it, and a lagging field feels broken.

Acceptance scenarios:

1. **Given** the review of a spec of 300 blocks with a comment form open on line 40, **When** the
   human types "a", **Then** the field reads "a", and none of the document's blocks render again.
2. **Given** a comment "Too vague" typed on line 40, **When** the human taps the block holding line
   52, **Then** the form moves under it on a wide screen, still reading "Too vague", now on lines
   40–52.
3. **Given** a comment "Too vague" on lines 40–52, **When** the human presses "Add comment",
   **Then** the comment shows under its block at once, marked "saving…", then without the mark once
   the review file holds it.

### US4: Comment on the points settled without you (P2)

On a round awaiting answers, the human taps a settled point, writes a comment, and adds it. It shows
under its point, with Edit and Remove, and is written at the end of the notes as a bullet starting
with the point's bold subject. The notes field does not show these bullets.

Why this priority: it is new, and the human can still write about a settled point in the notes
meanwhile.

Acceptance scenarios:

1. **Given** a round whose settled points include "**Undoing a completion** puts back what
   completing changed", **When** the human taps that point, types "Keep the undo, but say what it
   restored.", and presses "Add comment", **Then** the file's notes end with the line
   `- **Undoing a completion**: Keep the undo, but say what it restored.`, and the comment shows
   under the point, with Edit and Remove.
2. **Given** saved notes "Overall fine." and that comment, **When** the round page shows, **Then**
   the notes field reads "Overall fine." only.
3. **Given** the notes field changed to "Overall fine, icon bigger.", **When** the human presses
   "Save notes", **Then** the file's notes are "Overall fine, icon bigger.", a blank line, then the
   comment's bullet, unchanged.
4. **Given** that comment, **When** the human presses Edit, changes it to "Keep the undo.", and
   presses "Save comment", **Then** its bullet reads `- **Undoing a completion**: Keep the undo.`.
5. **Given** that comment, **When** the human presses Remove, **Then** its bullet is gone from the
   notes, and nothing shows under the point.
6. **Given** two comments on two points, **When** the human submits the round, **Then** the
   committed file holds both bullets, and the page shows them under their points, read-only, without
   Edit and Remove.
7. **Given** unsaved notes "Half a thought" and no comment, **When** the human adds a comment on a
   settled point, **Then** the file's notes hold the bullet and not "Half a thought", and the notes
   field still reads "Half a thought", with "Unsaved changes".
8. **Given** a comment of two lines, "Keep the undo." and "Also for deletes.", **When** it is added,
   **Then** its bullet's second line is written indented by two spaces, and the comment reads back
   as the same two lines.

### US5: Unsaved text is never lost by accident (P2)

What the human typed and did not save is kept in the browser, and restored when they come back.
Leaving a page with unsaved text asks first, Cancel on changed text asks first, and Submit, Commit,
and Start save what is typed before they act.

Why this priority: saving on a button makes typed text losable; this story makes the rule safe.

Acceptance scenarios:

1. **Given** the notes field changed to "Bigger icon" and not saved, **When** the human reloads the
   page, **Then** the browser's own leave prompt shows; once reloaded, the field reads "Bigger
   icon", with the notice "Unsaved text restored from 14:32." and a Discard button.
2. **Given** the restored notes, **When** the human presses Discard, **Then** the field reads the
   saved notes, and nothing is restored on the next reload.
3. **Given** unsaved text "Bigger icon" restored over notes that were "Fine" when it was typed and
   are now "Fine, thanks", **Then** the notice reads "Unsaved text restored from 14:32. The notes
   changed since: saving replaces them."
4. **Given** an unsaved comment in Q3, **When** the human taps a link to the feature's page,
   **Then** a dialog asks "Leave page?", with "Stay" and "Leave page"; "Stay" keeps the page as it
   was, and "Leave page" opens the feature's page.
5. **Given** an unsaved comment in Q3, **When** the human presses Back, **Then** the same dialog
   shows, and "Leave page" goes back.
6. **Given** a page with no unsaved text, **When** the human leaves it, reloads it, or closes it,
   **Then** nothing asks.
7. **Given** a review comment form reading "Too vague", **When** the human presses Cancel, **Then**
   a dialog asks "Discard your comment?", with "Keep editing" and "Discard".
8. **Given** an empty comment form, **When** the human presses Cancel, **Then** it closes without
   asking.
9. **Given** an unsaved comment in Q3, unsaved notes, and an open comment on a settled point with
   text, **When** the human presses "Submit answers", **Then** the comment, the notes, and the
   settled point's comment are saved, then the round is submitted.
10. **Given** a review comment form open with text, **When** the human presses Approve, **Then** the
    verdict is not recorded, and "Add or cancel your comment first." shows next to the verdict.

### US6: Fixed-height text fields (P3)

Every multi-line field, everywhere in the UI, has a fixed height: it never grows or shrinks with its
text, and scrolls when its text is longer. The browser's resize handle stays, to drag a field taller
by hand. The height depends on what the field holds, a little larger than its usual text, and is the
same wherever that kind of field appears: the proposal editor 20 rows, the round's notes 12, every
comment and the review summary 7, the chat composer 4, quick add 3. Typing never changes the page's
layout.

Why this priority: the human's note and review; it makes fields coherent, without changing what is
saved.

Acceptance scenarios:

1. **Given** an empty comment field, on a question, a review, or a settled point, **Then** it is 7
   rows tall.
2. **Given** a comment field holding 1 line, **Then** it is still 7 rows tall.
3. **Given** a comment field holding 12 lines, **Then** it is 7 rows tall, scrolls, and the content
   below it on the page has not moved since it was empty.
4. **Given** the round's notes field, empty or full, **Then** it is 12 rows tall.
5. **Given** the proposal editor, **Then** it is 20 rows tall, whatever its text.
6. **Given** quick add, **Then** its field is 3 rows tall.
7. **Given** the chat composer, empty or holding 10 lines, **Then** it is 4 rows tall, and scrolls
   when it holds more.
8. **Given** a comment field 7 rows tall, **When** the human drags its resize handle down, **Then**
   it becomes taller, and keeps that height while they type.

## Edge cases

- **A settled point's subject used twice**: a comment's bullet belongs to the first settled point
  with that bold subject, and shows under it.
- **A settled point with no bold start**: it cannot be tapped for a comment, since nothing would
  find its comment again. The template always starts a point in bold.
- **A bullet in the notes, written by hand, starting with a settled point's bold subject**: it is a
  comment on that point, shown under it, and moved after the free notes at the next save.
- **A bullet in the notes whose bold start matches no settled point**: it stays in the free notes.
- **A comment or a note with a line starting with `#`, `**Answer:**`, or `**Notes:**`**: refused by
  the core, as today, with its message under the field; the text stays in the field.
- **An empty comment**: "Add comment" is disabled while the text is blank.
- **Notes saved with spaces or blank lines at their ends**: the file holds them trimmed, and the
  field counts as saved: trailing spaces and line breaks are not unsaved changes.
- **The round answered elsewhere while a comment is open**: the page turns read-only, as today; the
  unsaved text stays in the browser, and the notice says the round was answered, with Discard.
- **Unsaved text older than 30 days**: dropped when the app starts.
- **Storage full or unavailable in the browser**: fields work as without the store, and the leave
  dialog still protects them.
- **A save refused for a conflict**, the file changed since it was read: the text stays in the
  field, with the error next to Save, as today.
- **Adding an image to an answer's comment, the notes, or the editor**: saves that field at once,
  with its text as typed, as image attachments does, and clears its unsaved text.
- **A review comment restored after the reviewed file changed**: it is restored as a general
  comment, its text starting with what it was on, like "On lines 40–52 of the previous version:".
- **IME composition**: the field never receives text from outside while it has the focus, so a
  composition is never broken.
- **Search and filter fields, and the chat composer**: their saving is unchanged. They save nothing
  to a file, and the composer already keeps its draft with its session. The composer's height is
  fixed, as US6 says.

## Success criteria

- **SC-001**: No text field writes to the repository until its Save button, its key, or a button
  using its text is pressed: in a test per field, typing, waiting 2 seconds, and leaving the field
  leaves every file unchanged.
- **SC-002**: Typing a character in a review comment on a spec of 300 blocks renders none of the
  document's blocks again.
- **SC-003**: A field never loses a character typed: typing "a b c" with 2-second pauses after each
  space, while the file changes on disk, leaves "a b c" in the field.
- **SC-004**: Unsaved text in each kind of field is restored after a reload, in one test per kind.
- **SC-005**: Every multi-line field is the height of its kind, 20, 12, 7, 4, or 3 rows, empty and
  after 30 lines are typed into it, at 402 × 874 and 1440 × 900 in WebKit.
- **SC-006**: A comment on a settled point reads back from the file as the comment written, for
  one-line, multi-line, and hand-written bullets.

## Design

### Approach

One rule for every field, from the changed [UI behaviour](../decisions/ui-behaviour.md) decision,
built once: a store of unsaved text, shared by every field, that holds what is typed and not saved,
mirrors it in the browser's `localStorage`, and tells the router whether a page holds unsaved text.
Each field reads its text from the store and its saved text from the file, so the file never writes
into a field being edited: this removes both causes of lost letters
([notes that lose letters](discovery-01.md#notes-that-lose-letters)). Fields subscribe to their own
key only, so a keystroke renders its field alone; with the comment's text out of the review page,
React Compiler keeps the document from rendering again
([the comment lag](discovery-01.md#the-comment-lag)).

Comments on settled points live in the notes, as the human chose
([Q4](clarifications-01.md#q4-where-should-a-comment-on-a-settled-point-show-once-added),
[Q5](clarifications-01.md#q5-how-should-a-comment-on-a-settled-point-read-in-the-notes)): the core
splits the notes into free notes and comments, and writes them back in that order, so the UI never
parses them, as the [stack](../decisions/stack.md) decision requires. The core also ends the settled
section at the **Notes:** line ([notes shown twice](discovery-01.md#notes-shown-twice)).

This feature is built on main after the image attachments feature merges, as the human asked
([Q6](clarifications-01.md#q6-should-adding-an-image-still-save-its-field-at-once)): its notes and
comment fields are the ones this feature changes, and its rule that an image saves its field at once
stays.

### Data

**In the clarifications file.** The notes are the text after `**Notes:**`, to the end of the file.
They hold, in this order:

1. The free notes: any text.
2. A blank line, then the comments on settled points, one top-level bullet each, in the order they
   were added: `- **<subject>**: <comment>`. `<subject>` is the bold text a settled point starts
   with, as written, without its `**`. A comment's further lines are indented by two spaces; a blank
   line inside a comment is kept, indented the same way.

A bullet is a comment when it is a top-level list item of the notes whose first span is bold and
equal, after trimming, to the bold start of a settled point of the same file. Every other line is
free notes.

**From the core** (`crates/core/src/files/items.rs`, sent through the binding as today):

```rust
pub struct RoundItems {
    // ...existing fields...
    pub settled: Vec<u32>,            // the section's blocks, now ending before the Notes line
    pub settled_points: Vec<SettledPoint>,
    pub notes: Option<String>,        // the free notes only, trimmed
    pub settled_comments: Vec<SettledComment>,
}

pub struct SettledPoint {
    pub block: u32,       // the list item's block
    pub subject: String,  // its bold start, trimmed
}

pub struct SettledComment {
    pub number: u32,      // 1-based, in the notes' order
    pub subject: String,
    pub point: u32,       // the block of the first settled point with that subject
    pub text: String,     // without the bullet, the subject, or the indentation
}
```

**Core actions** (`crates/core/src/actions/answer.rs`), each refusing a file whose notes changed
since the UI read them, as `save_notes` does, and writing nothing on refusal:

- `save_notes(notes, previous)`: writes the free notes, keeping the comments after them. `previous`
  is the free notes last read.
- `add_settled_comment(subject, text)`: appends a comment; refused for an unknown subject, or a line
  the notes refuse.
- `edit_settled_comment(number, text, previous)` and `remove_settled_comment(number, previous)`:
  `previous` is that comment's text as last read.

`ura answer <feature> notes <text>` writes the free notes through `save_notes`, so it keeps the
comments too.

**In the browser** (`localStorage`, key `uraeda:unsaved:<repository path>:<field key>`):

```ts
type Unsaved = {
  text: string; // what the field shows
  base: string; // the saved text when the edit began
  at: string; // when it was last typed, ISO 8601
  extra?: { start: number; end: number; heading: string; commit: string }; // a review comment's lines
};
```

Field keys name the field and its file: `<path>#Q3`, `<path>#notes`, `<path>#settled:<subject>`,
`<path>#settled-edit:<number>`, `<path>#review`, `<path>#review-edit:<number>`, `<path>#summary`,
`<path>#editor`, `priorities#<entry key>`, `quick-add`, `<draft path>#slug`. An entry is written at
each change, removed when its field is saved, discarded, or its text equals the saved text again,
and dropped when older than 30 days.

### Components

- **Unsaved store** (`packages/web/src/fields/unsaved.ts`, new): the in-memory map of unsaved text
  by key, mirrored to `localStorage`, with a subscription per key and one for "is anything unsaved".
  Depends on nothing else in the app; used by the field hook and the leave guard.
- **Field hook** (`packages/web/src/fields/useTextField.ts`, new): `useTextField(key, saved)`
  returns the text to show, whether it differs from `saved` (trimmed), the restore notice if any,
  and `change`, `discard`, and `saved` (called after a save). It subscribes to its key only. Every
  field of US2 uses it; the save itself stays with each field.
- **Leave guard** (`packages/web/src/fields/LeaveGuard.tsx`, new, and
  [`routes.tsx`](/packages/web/src/routes.tsx)): while the store holds unsaved text for the page's
  fields, `navigate` and links ask through the "Leave page?" dialog, Back re-pushes the page and
  asks the same, and a `beforeunload` listener is attached; it is removed once nothing is unsaved.
- **Confirmation dialog** (`packages/web/src/fields/Confirm.tsx`, new): the "Leave page?" and
  "Discard …?" dialogs, an Astryx dialog on wide screens and a sheet on the phone, with a close
  button, as the [UI layout](../decisions/ui-layout.md) decision requires.
- **Text area** (`packages/web/src/fields/TextField.tsx`, replacing `GrowingTextArea` in
  [`Question.tsx`](/packages/web/src/Question.tsx)): Astryx `TextArea`, whose `kind` sets its fixed
  `rows`: `"editor"` 20, `"notes"` 12, `"comment"` 7, `"line"` 3. Its height never follows its text;
  Astryx's resize handle stays. Ctrl+Enter or Cmd+Enter calls its `onSubmit`. Every multi-line field
  uses it, quick add and the editor included.
- **Chat composer** ([`Composer.tsx`](/packages/web/src/Composer.tsx)): `ChatComposerInput` gets
  `maxRows={4}` and a fixed height of 4 rows through its `xstyle`, so it no longer grows from one
  row. Its sending and its draft are unchanged.
- **Restore notice** (`packages/web/src/fields/RestoreNotice.tsx`, new): the notice above a restored
  field, with Discard.
- **Round page** ([`RoundPage.tsx`](/packages/web/src/RoundPage.tsx)): split into a notes field with
  "Save notes", the settled points, which take comments through the shared comment form, and the
  submit, which saves every unsaved field of the page first.
- **Question** ([`Question.tsx`](/packages/web/src/Question.tsx)): its comment through the field
  hook; a tap saves the letters with the comment as last saved.
- **Comment form** ([`CommentForm.tsx`](/packages/web/src/CommentForm.tsx)): its text through the
  field hook, by a key its page gives, so it survives moving and only the form renders as the human
  types. Cancel asks when its text changed. Used by the review, the mockup page, and the settled
  points.
- **Review page** ([`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx),
  [`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts)): the comment's text leaves the
  page's state; a new comment shows under its block at once, marked "saving…"; a verdict with an
  open comment that holds text is refused.
- **Line edited in place** ([`EditableLine.tsx`](/packages/web/src/EditableLine.tsx)): Save and
  Cancel buttons, no save on blur, its text through the field hook.
- **Editor** ([`EditorPage.tsx`](/packages/web/src/EditorPage.tsx)): a Save button, and no saving as
  typed; Commit and Start save first, as today.
- **Save queue** ([`useSave.ts`](/packages/web/src/useSave.ts)): loses its timer and its `schedule`;
  it keeps one queue of saves per field, each carrying the text the last one wrote, so a Save and an
  image's save never cross.
- **Core** ([`items.rs`](/crates/core/src/files/items.rs),
  [`clarifications.rs`](/crates/core/src/files/clarifications.rs),
  [`answer.rs`](/crates/core/src/actions/answer.rs), [`api.rs`](/crates/core/src/api.rs)): the
  settled section ends at the notes; the notes are split and written as in [Data](#data); the three
  settled comment actions, exposed through the binding.
- **Server** ([`mutations.ts`](/packages/server/src/fate/mutations.ts)): `settled.comment`,
  `settled.edit`, and `settled.remove`, each returning the file's view, like `notes.save`.
- **Build** ([`vite.config.ts`](/packages/web/vite.config.ts)): React Compiler through
  `@rolldown/plugin-babel` and `reactCompilerPreset`, for the build, the dev server, and the tests.
- **Skill**: [`SKILL.md`](/skills/uraeda/SKILL.md) says the human may comment on a settled point
  with a bullet in the notes, in the format of [Data](#data);
  [`references/spec.md`](/skills/uraeda/references/spec.md) reads such a bullet as the human's
  answer to that point; the example's
  [answered round](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md)
  holds one comment on a settled point that its spec already agrees with.

### Mockups

- [Text inputs](mockups/text-inputs.html), at 402 px and 1440 px:
  1. A question's comment changed after an option was tapped, with "Unsaved changes".
  2. Settled points with a comment under one and the form under another, the sheet on the phone, and
     the notes field holding the free notes only.
  3. Unsaved notes restored after a reload, with and without the file changed since.
  4. The "Leave page?" and "Discard your comment?" dialogs.
  5. A line edited in place, with Save and Cancel.
  6. The proposal editor with Save, and Commit.
  7. The fixed heights of each kind of text area, empty and full.

### Error handling

- A save refused by the core: the field keeps its text and its unsaved entry, and its error shows
  next to its Save button, as today, until the next save.
- A settled comment on a subject no longer in the file: "That point is no longer in the round." next
  to "Add comment", the text kept.
- A settled comment edited or removed after the notes changed elsewhere: the core's "changed since"
  refusal, the text kept, and the page's data reloaded.
- `localStorage` that throws, full or blocked: the store keeps unsaved text in memory only, without
  telling the human; the leave guard still asks.
- Submit with a field whose save is refused: "Some answers were not saved: nothing was submitted.
  Check them, then submit again.", as today.
- A verdict with an open comment holding text: "Add or cancel your comment first." next to the
  verdict's buttons.

### Testing

Integration tests render the app in happy-dom on a temporary git repository read through the
binding, with the server in process, as today's `packages/web/src/__tests__` do, and drive it by
roles, labels, and text. They read files from the repository to check what is written. Browser tests
in WebKit, at 402 × 874 and 1440 × 900, check what needs a real layout. Core behaviour is tested in
Rust, on fixture files.

| What                                                 | Test                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| US1, scenarios 1–5; SC-003                           | Integration tests on the round page, a file changed on disk mid-typing       |
| US2, scenarios 1–8; SC-001                           | Integration tests, one per field kind: type, blur, wait, then read the files |
| US3, scenarios 1–3; SC-002                           | Integration tests on the review page, with React's `Profiler` on the blocks  |
| US4, scenarios 1–8                                   | Integration tests on the round page, reading the notes from the file         |
| US5, scenarios 1–10; SC-004                          | Integration tests, a reload simulated by unmounting and mounting the app     |
| US6, scenarios 1–6; SC-005                           | Browser tests at both sizes, measuring each field against its line height    |
| SC-006, the notes' split and writing, the edge cases | One table-driven Rust test: one row per notes text and expected parts        |
| Settled section ending at the notes                  | Rust test on a fixture round with notes                                      |
| Core refusals for the three settled comment actions  | Rust tests, one per refusal                                                  |
| `ura answer notes` keeping the comments              | CLI test on a fixture round                                                  |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- The notes field keeps what is typed while it differs from what was last saved.
- The notes no longer show among the settled points: the core ends the settled section at the notes.
- A new review comment shows under its block at once, marked "saving…".
- A settled point takes a comment the way a spec's block does: tapped, one point per comment, the
  form under it on wide screens and in a sheet on the phone.
- A comment on a settled point is saved by "Add comment", leaving the notes being typed unsaved.
- Ctrl+Enter or Cmd+Enter saves a multi-line field, and Enter a line.
- Cancel or Escape on changed text asks first, "Discard" or "Keep editing".
- A comment left open with text stops a verdict.
- Each field says "Unsaved changes" next to its Save button, which is disabled while nothing
  changed.
- Toggles, segmented controls, switches, and option taps keep saving at once.

Settled while writing this spec:

- React Compiler runs through Babel, the compiler React ships as stable; the Rust port is marked
  experimental by `@vitejs/plugin-react` ([React 19.3](discovery-01.md#react-193)).
- The comment's text also leaves the review page, as option A of Q7 proposed: the compiler cannot
  skip the document while the page passes the text into it.
- Comment bullets are hidden from the notes field, and saving the notes keeps them after the free
  notes, as the answer to Q5 asked.
- Unsaved text is kept in `localStorage`, not `sessionStorage`, so it survives a closed tab or a
  crash, as Q3's option C described; it is dropped after 30 days.
- Every field that saves text keeps its unsaved text, lines and slugs included; search fields and
  the chat composer do not.
- Lines edited in place get Save and Cancel buttons, since a phone has no Escape key.
- The fixed heights are 20 rows for the proposal editor, a page of text; 12 for the notes, which
  gather several points; 7 for every comment and the review summary, as the human asked; and 3 for
  quick add, a priority line that may wrap. They are the same at both widths, in rows, so they grow
  with the text size the [UI layout](../decisions/ui-layout.md) decision sets.
- Astryx's `TextArea` keeps its vertical resize handle, so the human can drag a field taller by
  hand; the text never resizes it ([Astryx 0.6.8](discovery-01.md#astryx-068)).
- The chat composer is fixed at 4 rows, a short message with room to spare; it is the one multi-line
  field that is not an Astryx `TextArea`.
- No CLI command adds a settled comment: a human writes the bullet in an editor.

## Decisions

Changed, applied when this spec is approved:

- [UI behaviour](../decisions/ui-behaviour.md#proposed-change-2026-10-14-text-inputs): text saves
  only on a button or the field's own key, lines no longer save on blur, unsaved text is kept in the
  browser and leaving asks first, and every multi-line field has a fixed height by what it holds.
- [Toolchain](../decisions/toolchain.md#proposed-change-2026-10-14-text-inputs): the web UI is
  compiled with React Compiler through Babel, and new code does not memoize by hand for speed.

Relied on:

- [Stack](../decisions/stack.md): the core splits the notes and finds settled points; the UI draws
  what the core sends, and parses no markdown.
- [UI components](../decisions/ui-components.md): every field is an Astryx `TextArea` or
  `TextInput`, the dialogs Astryx's, and the new styles StyleX with tokens.
- [UI layout](../decisions/ui-layout.md): forms under their block on wide screens and in sheets on
  the phone, dialogs as sheets on the phone, every view mocked up at both widths.
- [UI checks](../decisions/ui-checks.md): tests by roles and text, browser checks at both sizes,
  screenshots before handing over.
- Attachments, from the image attachments feature: an image added to a field saves it at once, and
  stays the one exception to saving on a button.

## Constitution check

| Principle                         | Complies | Notes                                                                                              |
| --------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| I. Humans stay in control         | yes      | Two decision changes, proposed for approval                                                        |
| II. Git and plain text first      | yes      | Comments on settled points are plain bullets in the notes, readable and writable by hand           |
| III. Asynchronous by default      | yes      | Unsaved text in the browser is not workflow state: nothing reaches the workflow until it is saved  |
| IV. Review effort matches impact  | yes      | Comments on settled points let the human object to one point without rewriting it in the notes     |
| V. Tools are optional             | yes      | The bullet format is written in the skill, and works in any editor                                 |
| VI. Code is checked, maintainable | yes      | One store and one hook for every field, replacing three copies of the same effect; tests per story |

## Risk tier

**High**: React Compiler changes how every component of the web UI renders, and the notes gain a
format every later spec step reads.
