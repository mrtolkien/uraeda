# Rulings: Text inputs and comments

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The approved spec follows main's new spec template

- **Decision**: the spec's sections move to the template that main adopted while the spec was
  reviewed: "Design" becomes "Architecture", from its "Approach", then "Mockups", and "Data",
  "Components", "Error handling", and "Testing" go under "Details", after "Risk tier". No sentence
  changes.
- **Rationale**: `vp run ready` runs `ura check` on `specs/`, which refuses the old sections since
  the code quality feature merged
  ([template](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md)).
- **Alternatives considered**: leaving the spec as approved, which fails the validation of every
  task.
- **If wrong**: the move is mechanical; git shows the spec as approved in its approval commit.
- **Where**: [spec.md](spec.md), in the plan's commit.

## R2: The discard confirmation of fields that are not comments

- **Decision**: Cancel or Escape on a changed line, quick add, or slug asks "Discard your changes?",
  with "The text you typed is deleted.", "Keep editing", and "Discard". The notes and the editor
  have no Cancel: Escape does nothing there, and their unsaved text is discarded with the restore
  notice's Discard, or kept.
- **Rationale**: the spec names "Discard your comment?" for comment forms only; the decision asks
  every changed field's Cancel or Escape to confirm with "Discard" and "Keep editing".
- **Alternatives considered**: "Discard your comment?" everywhere, wrong for a priority line; Escape
  clearing the notes, which would discard a long text with one key.
- **If wrong**: one title in `fields/Confirm.tsx`'s callers.
- **Where**: tasks 4 and 9.

## R3: `section` stays in `items.rs`, and `choices` moves with the round

- **Decision**: task 1's split moves `round()`, `named_section`, `leading_strong`, and `choices`
  into `files/items/round.rs`, and `round_name` with the answer functions into `api/answers.rs`;
  `section` stays in `items.rs`.
- **Rationale**: `section` is also used by the spec's and the rulings' items, while `choices` and
  `round_name` serve the round alone.
- **Alternatives considered**: moving `section` as the plan said, and re-exporting it for its other
  callers, which puts a shared helper in the round's module.
- **If wrong**: a function moves between two files of the same module.
- **Where**: task 1, step 1.

## R4: The workflow file's mutations and binding functions move out before they grow

- **Decision**: before task 2 adds its three functions, the mutations that change a workflow file,
  answers, notes, and reviews, move from `mutations.ts` into `fate/file-mutations.ts`, with the
  `Resolver` type moving into `fate/context.ts`, and the same functions of the binding move from
  `lib.rs` into `file_writes.rs`, each in a commit that only restructures.
- **Rationale**: `mutations.ts` had 499 lines and the binding's `lib.rs` 484: the three new
  functions push both past the 500 lines of the code quality decision.
- **Alternatives considered**: a module for the settled comments alone, which splits the round's
  writes over two files.
- **If wrong**: the functions move back once the limit allows.
- **Where**: task 2.

## R5: `save_notes` compares `previous` with the free notes

- **Decision**: `save_notes` refuses when the file's free notes, not its whole notes, differ from
  `previous`, and writes through `set_notes`, which keeps the comments.
- **Rationale**: the spec's Data says `previous` is the free notes last read, and since task 1 the
  UI reads the free notes only: comparing with the whole notes refused every save of a round with a
  comment.
- **Alternatives considered**: none; the plan did not name the change.
- **If wrong**: one comparison in `answer.rs`.
- **Where**: task 2.

## R6: A session's composer stays as its first message creates the session

- **Decision**: a feature's session page and a new chat draw one `SessionPane`, whose composer stays
  mounted when the first message creates the session: only the header and transcript above it
  change. The pane reads the session's status for the composer through `useView` on a reference to
  the session, `undefined` before it exists. While the new session's header and transcript are read,
  in a `Suspense` of their own, its title stays above the composer, without a transcript: a page
  shows one log.
- **Rationale**: the page drew `NoSession` until the session existed, then `Session`, two trees, so
  the composer was replaced as the session landed: a key typed at that moment was lost, and the
  field lost the focus. Kept mounted, the composer was still hidden, its keys lost, while the page's
  `Suspense` waited for the new session's transcript. React Compiler, task 3, made the tests type
  faster than the session lands, which turned the race into a failure of about half the web test
  runs; it failed without the compiler too.
- **Alternatives considered**: waiting in the tests for the session before typing, which hides a bug
  a human meets; the session's view sending its status up to the page in an effect, which draws
  twice for each change.
- **If wrong**: `SessionPane` splits back into its two branches.
- **Where**: [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx), before task 3's commit.

## R7: Two notes tests of the round page save with the button

- **Decision**: "the notes are saved as the last line" types "LGTM", then presses "Save notes";
  "notes changed elsewhere show when the page reads again" presses "Save notes" after typing
  "theirs, and mine". "Submit waits for the notes being typed" stays as it was: it already types the
  notes and presses "Submit answers" alone, which now saves them first.
- **Rationale**: both tests checked that notes typed reach the file, by waiting for the save 400 ms
  after the last keystroke, which the [UI behaviour](../decisions/ui-behaviour.md) decision now
  forbids. What they check stays: the notes are written as the last line, and a save after notes
  changed elsewhere builds on the notes read, not on those first shown.
- **Alternatives considered**: deleting them, since the notes tests cover saving; they also cover
  the line's place in the file and the `previous` of a save after a reread, which those do not.
- **If wrong**: two lines in [`round.test.tsx`](/packages/web/src/__tests__/round.test.tsx).
- **Where**: task 4.

## R8: What the field hook and the restore notice also give

- **Decision**: `useTextField` also returns `entry`, the field's unsaved entry, and `unsavedNow()`,
  the entry as the store holds it when called. `RestoreNotice` takes `changed`, the sentence saying
  the saved text changed since, "The notes changed since: saving replaces them." for the notes. The
  store's keys name the repository by its folder, read through `useRepositoryPath()` in
  [`routes.tsx`](/packages/web/src/routes.tsx), which `App` sets from the repository's row. A
  field's status, "Unsaved changes", "saving…", "saved ✓", or the error, is `fields/SaveStatus.tsx`.
  `fields/Confirm.tsx`'s host is `ConfirmHost`, wrapping the pages in `App`. `saved(text)` keeps the
  entry when the field changed during the save, and an entry equal to the saved text, trimmed, goes
  once the file's text comes back, as when an image's save wrote it.
- **Rationale**: the round answered elsewhere shows the notice for text typed on the page, not
  restored, which needs the entry's time; Submit reads the notes after waiting for images, when the
  text drawn may be older than the store's; a comment's notice cannot say "the notes"; the spec's
  key holds the repository path, which the pages did not have.
- **Alternatives considered**: the repository's name in the keys, which a rename would orphan; the
  status in each field, which would copy its four states into nine places.
- **If wrong**: additions to the `fields/` modules, which tasks 5 to 10 use.
- **Where**: task 4.

## R9: The confirmation is the app's overlay, not Astryx's alert dialog

- **Decision**: `ConfirmHost` draws its question in
  [`Overlay`](/packages/web/src/layout/Overlay.tsx), a dialog on wide screens and a bottom sheet on
  the phone, with Close, and Back closing it, the body above its two buttons. Close, Back, Escape,
  and the cancel button answer `false`. Every answer comes once the browser went back over the
  overlay's history entry, so a page a caller opens on "Leave page" or "Discard" is not undone by
  that Back. `useConfirm` is unchanged.
- **Rationale**: Astryx's `AlertDialog`, which task 4 used, has no close button, Back does not close
  it, and it is a centred dialog on the phone: the [UI behaviour](../decisions/ui-behaviour.md)
  decision requires a visible close button and Back on every sheet and dialog, the
  [UI layout](../decisions/ui-layout.md) decision a bottom sheet for a short form on the phone, and
  the spec's confirmation dialog both.
- **Alternatives considered**: `AlertDialog` with a close button and `useBackCloses` added around
  it, which still draws a dialog on the phone.
- **If wrong**: one component, `fields/Confirm.tsx`, behind an unchanged hook.
- **Where**: task 5, before its first step; the plan's task 4 interface says so.

## R10: How a settled point's comment form behaves

- **Decision**: a settled point's form says where it goes as `On "<subject>"`, and a comment under
  its point is headed "Your comment", as the mockup draws them, in a group named
  `Your comment on "<subject>"`. A form with `field` shows "Unsaved changes" beside its buttons
  while its text differs from `saved`, and its submit button waits for a change, as the UI behaviour
  decision asks of every text field; restored text shows the restore notice, whose sentence for a
  comment changed since is "The comment changed since: saving replaces it.". The form holding
  unsaved text when the round's page is drawn opens again, under its point. Closing the phone's
  sheet, with Close, Back, or Escape, keeps the text unsaved, without asking: nothing is lost, and a
  tap on the point restores it; Cancel asks. A round answered while a settled comment holds unsaved
  text shows, under its point, the notice saying the round was answered, with Discard. A form whose
  point left the round stays open after the points, wide, so its refusal shows. One form is open at
  a time: a tap on another point opens its own, the first one's text kept.
- **Rationale**: the spec names the texts of the notes, not those of a settled comment's anchor,
  heading, or restore notice; the mockup's section 2 draws the first two. A sheet closed by Back
  that asked first would need to reopen itself and push its history entry again; keeping the text
  loses nothing, and the leave guard of task 10 still counts it.
- **Alternatives considered**: asking "Discard your comment?" as the sheet closes; one shared key
  for every new settled comment, which a tap on another point would carry over to the wrong point.
- **If wrong**: texts in `SettledPoints.tsx` and `CommentForm.tsx`, and the sheet's `onClose`.
- **Where**: task 5.

## R11: `PendingSaves` and `composed` move into `useAnswer.ts`

- **Decision**: task 6's split moves `PendingSaves`, the context of the saves Submit waits for, and
  `composed`, the answer as the core writes it, from `Question.tsx` into `useAnswer.ts`, with the
  answer's saving; `RoundPage` imports `PendingSaves` from there.
- **Rationale**: the hook uses both, and `Question.tsx` imports the hook: leaving them in
  `Question.tsx` makes the two modules import each other.
- **Alternatives considered**: a module of their own, for two small values that serve the answer's
  saving alone.
- **If wrong**: two exports move between two files.
- **Where**: task 6, step 1.

## R12: Submit saves the settled comments the store keeps

- **Decision**: Submit saves the settled points' comments through `useSaveSettled`, in
  [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx), after the questions' saves and the
  notes, not through `PendingSaves`: for each comment of the round, then each settled subject, it
  reads the text the store keeps for its field, skips it when there is none or it is blank, writes
  it with `settled.edit`, whose `previous` is the comment as read, or `settled.comment`, and drops
  the entry once written. A refusal stops the submit with "Some answers were not saved: nothing was
  submitted. Check them, then submit again.".
- **Rationale**: a settled form keeps its text only in the store, one form is open at a time, and
  its text stays when it closes (R10): an entry in `PendingSaves` registered by the open form would
  miss the text of a form closed, or of one a tap on another point replaced. Edits come first, as
  adding a comment never renumbers the others.
- **Alternatives considered**: each form registering its save in `PendingSaves`, as the plan said,
  which saves the open form only.
- **If wrong**: one hook, called from `useRoundSubmit`.
- **Where**: task 6.

## R13: A quick tap after a comment's save follows it

- **Decision**: "quick saves of one answer follow each other" types "first", presses "Save comment",
  then taps B at once, and still expects `**Answer:** B: first` and no error.
- **Rationale**: it typed "first" and tapped B, which saved the comment typed with the letter; US2 1
  now has a tap save the comment as saved, not as typed. What it checks stays: a save of the answer
  that follows another before it returns is not taken for a change made elsewhere.
- **Alternatives considered**: deleting it, which leaves the queue of an answer's saves untested.
- **If wrong**: one line in [`round.test.tsx`](/packages/web/src/__tests__/round.test.tsx).
- **Where**: task 6.

## R14: How a question's comment behaves

- **Decision**: a tap takes the comment as last saved or read when its save runs, after the saves
  before it, so a tap right after "Save comment" keeps the comment just saved. The letters follow
  the file whenever nothing of the answer waits to be saved, a comment being typed or not: the
  comment, in the store, is never replaced. "Does not apply" discards the comment typed, as it
  replaced it before. A restored comment shows the restore notice, with "The comment changed since:
  saving replaces it." (`COMMENT_CHANGED`); a round answered while a comment is unsaved shows its
  comment as the file holds it, with the notice saying the round was answered, and Discard.
- **Rationale**: the comment as it was when tapped would undo a "Save comment" still running; the
  letters were held back only so a comment being typed was not replaced, which the store now
  ensures. The spec's edge case asks the notice of a round answered for every open comment.
- **Alternatives considered**: the tap carrying the comment last handed to a save, which carries a
  refused one again.
- **If wrong**: `useAnswer.ts` and `AnswerComment` in
  [`QuestionComment.tsx`](/packages/web/src/QuestionComment.tsx).
- **Where**: task 6.
