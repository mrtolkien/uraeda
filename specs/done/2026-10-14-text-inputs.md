---
kind: feature
finished: 2026-10-15
pull-request: https://github.com/mrtolkien/uraeda/pull/16
---

# Record: Text inputs and comments

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-14, finished on
> 2026-10-15, in [its pull request](https://github.com/mrtolkien/uraeda/pull/16). Its full files are
> in git: `git log -- specs/2026-10-14-text-inputs/`.

## What and why

Writing is most of what the human does in the web UI, and it did not feel solid: the round's notes
lost letters and showed twice on the page, review comments lagged on long specs, and some fields
saved as they were typed while others waited for a button. The human asked for every text field to
save only with a button, and for comments on the points a round settled without them, written into
its notes.

## Behaviour

- Every text field saves only with its Save button, its own key (Enter in a one-line field,
  Ctrl+Enter or Cmd+Enter in a multi-line one), or a button that uses its text: Add comment, Submit,
  Commit, Start, a verdict. Nothing saves as it is typed, after a pause, or on blur. A tap on an
  option saves the letters at once, with the comment as last saved; adding an image still saves its
  field at once, with its text as typed.
- A field whose text differs from what is saved, ignoring spaces at its ends, says "Unsaved changes"
  next to its Save button, which is disabled while nothing changed; the status keeps its room, so
  nothing moves as the human types. The file never writes into a field holding unsaved text.
- Unsaved text is kept in the browser's `localStorage`, under
  `uraeda:unsaved:<repository folder>:<field key>`, until saved or discarded, and dropped after 30
  days. A field showing again restores it, with "Unsaved text restored from HH:MM." and Discard, and
  says when the file changed since or the round was answered.
- Cancel or Escape on changed text asks "Discard your comment?" or "Discard your changes?", with
  "Keep editing" and "Discard". Closing a sheet or an overlay keeps its text without asking.
- Leaving a page while a field drawn on it holds unsaved text asks "Leave page?", with "Stay" and
  "Leave page", for links, `navigate`, and Back; a reload or a closed tab gets the browser's prompt.
  Back that closes a sheet or a dialog, and redirects, never ask.
- Submit saves every question's unsaved comment, the notes, and every settled-point comment holding
  text, then submits; a question whose comment holds unsaved text does not count as left; a refused
  save stops it with "Some answers were not saved: nothing was submitted. Check them, then submit
  again." A verdict with an open comment holding unsaved text, or an image, is refused with "Add or
  cancel your comment first."
- The notes show once, in their field: the core's settled section ends at the **Notes:** line.
- A settled point with a bold subject takes a comment: tapped, its form opens under it on wide
  screens and in a sheet on the phone. The comment is a bullet at the end of the notes,
  `- **<subject>**: <comment>`, further lines indented by two spaces, shown under its point with
  Edit and Remove while the round awaits answers, and hidden from the notes field; saving the notes
  keeps the bullets after the free notes. An edit is bound to its subject and follows a removal.
- Code blocks in the notes, in settled comments, and in question answers are kept as written; a
  fence left open is closed when it is written.
- Review comments render alone: a keystroke redraws the comment form, not the document. A new
  comment shows under its block at once, marked "saving…". A review edit is bound to where its
  comment points, and follows a removal.
- Lines edited in place have Save and Cancel; Enter saves, blur leaves them open with their text.
- Every multi-line field has a fixed height by what it holds, scrolling past it, with the browser's
  resize handle kept: the editor 20 rows, the notes 12, every comment and the review summary 7, the
  chat composer 4, quick add 3.
- The web UI is compiled with React Compiler. A chat's composer stays mounted, and shown, while its
  first message creates the session, so no key typed then is lost.

## Design

The Rust core owns the notes' format: it splits a round's notes into free notes and comments on
settled points, ends the settled section at the notes, and writes both parts back in that order, for
the web UI and `ura answer notes` alike. The web UI owns unsaved text: one module-level store,
mirrored to `localStorage`, read and written only through `useTextField`; a field's saved text
always comes from the file. Each field keeps its own save, through `useSave`'s queue, which has no
timer any more.

- The notes' split and join, in
  [`clarifications/notes.rs`](/crates/core/src/files/clarifications/notes.rs), the settled points
  and comments of a round, in [`items/round.rs`](/crates/core/src/files/items/round.rs), and the
  settled comment actions, in [`answer.rs`](/crates/core/src/actions/answer.rs), reached through
  [`api/answers.rs`](/crates/core/src/api/answers.rs), the binding's
  [`file_writes.rs`](/crates/binding/src/file_writes.rs), and the server's `settled.comment`,
  `settled.edit`, and `settled.remove` in
  [`file-mutations.ts`](/packages/server/src/fate/file-mutations.ts).
- The unsaved store, the field hook, the fixed-height text area, the confirmation, the restore
  notice, the save status, and the leave guard, in
  [`packages/web/src/fields/`](/packages/web/src/fields/), with the guard's check in
  [`routes.tsx`](/packages/web/src/routes.tsx).
- The round page's notes, Submit, and settled points, in
  [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx),
  [`RoundSubmit.tsx`](/packages/web/src/RoundSubmit.tsx), and
  [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx); a question's saving in
  [`useAnswer.ts`](/packages/web/src/useAnswer.ts).
- The review's comment form, drawn apart from the document, in
  [`ReviewCommentForm.tsx`](/packages/web/src/ReviewCommentForm.tsx) and
  [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx).
- React Compiler, through Babel, in [`vite.config.ts`](/packages/web/vite.config.ts).

## Questions

### Round 01

#### Q1: Which text fields should save only with a button?

**Answer:** A: the notes and the editor save with a Save button, and a line edited in place saves
with Enter or its Save button, no longer on blur, which changed the UI behaviour decision.

#### Q2: Should a tap on an option still save the comment typed under it?

**Answer:** A: a tap saves the letters at once, with the comment as last saved.

#### Q3: What protects text you typed and did not save?

**Answer:** A and C: Submit, Commit, and Start save what is typed first, leaving a page asks first,
and unsaved text is kept in the browser and restored.

#### Q4: Where should a comment on a settled point show once added?

**Answer:** A: under its point, with Edit and Remove, and written into the notes.

#### Q5: How should a comment on a settled point read in the notes?

**Answer:** A: one bullet per comment, starting with the point's bold subject; "this is only the
save format: this bullet point should not appear in the UI since it's already shown under its
point".

#### Q6: Should adding an image still save its field at once?

**Answer:** B: adding an image saves its field at once, and image attachments merged first.

#### Q7: Should the comment lag be fixed in the review page, or for the whole UI?

**Answer:** B: React Compiler for the whole web UI, which changed the toolchain decision.

#### Notes

Text boxes should not grow ahead of their text, and should behave the same way everywhere, in line
with good practice. In review, the human then asked for fixed heights by kind of field, scrolling
when the text is longer, since growing fields move the page's layout.

## Decisions

- [UI behaviour](../decisions/ui-behaviour.md): text saves only on a button or the field's own key,
  lines no longer save on blur, unsaved text is kept in the browser and leaving asks first, and
  every multi-line field has a fixed height by what it holds.
- [Toolchain](../decisions/toolchain.md): the web UI is compiled with React Compiler, through Babel,
  and new code does not memoize by hand for speed.

## Changes after approval

- The spec was reshaped to the spec template main adopted during its review, with no sentence
  changed (R1).
- A chat's composer stays mounted, and shown, while its first message creates the session: a bug
  React Compiler made frequent (R6).
- Confirmations are the app's overlay, a dialog with Close on wide screens and a sheet as tall as
  its question on the phone; "Leave page" is its main button, "Discard" its destructive one (R9,
  R29, R30).
- Closing a sheet or an overlay keeps its text without asking; only Cancel asks (R10, R19, R25).
- A verdict is also refused while the open comment holds unsaved text; a new review comment shows at
  once through `useOptimistic` (R16, R18).
- A line's status reads "saving…" and "saved ✓", its "Enter saves · Escape cancels" hint shows on
  wide screens only, and an empty add row no longer closes when left (R24).
- A page holds unsaved text when a field drawn on it does: stale entries never make leaving ask
  (R26).
- The save status keeps its room, and "Ctrl+Enter saves" shows beside the Save of a question's
  comment, the notes, and the editor on wide screens; Ctrl+Enter also sends every comment form (R28,
  R31).
- Code blocks are kept in the notes, in settled comments, and in question answers; a block that
  starts an answer, the notes, or a comment is written below its marker, and a fence left open is
  closed, so nothing after it is swallowed (R32, R34, R37).
- A question whose comment holds unsaved text no longer counts as left: Submit is enabled and saves
  it first.
- A settled comment's edit and a review comment's edit are bound to what they point at, and follow a
  removal; Submit waits for settled comments being written and keeps what is typed meanwhile (R33,
  R35, R36).

## Follow-ups

- On the phone, a review comment left in its closed sheet does not hold the verdict, while the round
  page's Submit saves settled comments left in closed sheets.
- A blank settled-comment edit left after Submit shows the "round was answered" notice under its
  point.
- Tapping Edit on a comment shows text kept under its number from another comment, with the "changed
  since" notice; only the automatic reopen checks what the edit points at. `review.edit` sends no
  previous text for the core to check.
- Back from a later entry re-pushes the page above the forward entry, and a link to the same page
  with another hash asks "Leave page?".
- The core finds settled comments by a line starting `- **`: other list markers and bold styles stay
  free notes; a subject is the first bold span only; an empty comment is accepted; comments after
  free notes ending with a list render as part of that list.
- `round()` in `items/round.rs` is 99 lines, one under the limit.
- On desktop, the shared 400 px dialog wraps "Discard your comment?" onto two lines; the editor's
  Commit button stays secondary where the mockup drew it primary; the phone's comment sheets keep
  62% of the screen.
- WebKit ignores a scripted drag of a text area's resize handle, so the resize is checked through
  its computed style (R28).
- `vp install` rewrites `AGENTS.md` through `vp config`, unformatted, which fails `vp check`.
- A few browser and session tests failed once and passed on reruns: quick add's height at the phone
  size, a dark-mode contrast check, a thumbnail's focus, and a review restore test run alongside the
  browser suite.
