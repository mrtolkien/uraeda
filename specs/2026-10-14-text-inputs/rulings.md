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

## R15: The review's and the mockup page's field keys

- **Decision**: a new review comment is `<path>#review`, `<path>` the reviewed file's, like
  `specs/<folder>/spec.md`: on lines, its entry's `extra` holds them and the reviewed commit; with
  no `extra`, it is a general comment. A tap moves the entry's lines with the selection, and "Add a
  general comment" removes them, text or not typed since. An edit is `<path>#review-edit:<number>`,
  the summary `<path>#summary`, and a mockup's comment `<spec path>#mockup:<mockup file name>`, with
  no `extra`: the mockup page finds its line itself. As the review is drawn, the comment last typed
  of those the store keeps for the page opens again, on its lines, under the block holding their
  last line. On lines of a commit no longer reviewed, it opens as a general comment, its text
  written again as `On lines 40–52 of the previous version: <text>`, on one line, as a mockup's
  general comment reads `Mockup <name>: <text>`. The summary has no Save button, so no "Unsaved
  changes": it shows the restore notice, and its entry goes once a verdict is recorded.
- **Rationale**: the spec lists `<path>#review` for a new comment, on lines or not, and the lines in
  `extra`; one key keeps the text of a general comment when a block is tapped, as before. The spec
  names no key for the mockup page, whose comment goes into the spec's review.
- **Alternatives considered**: `<path>#review-general` for a general comment, which a tap would have
  to move to another key; restoring every entry, when one form shows at a time.
- **If wrong**: [`reviewField.ts`](/packages/web/src/reviewField.ts) and the keys in
  [`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx) and
  [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx).
- **Where**: task 7.

## R16: An open comment holding unsaved text holds the verdict

- **Decision**: a verdict is refused while the open comment holds unsaved text, or links images, or
  its image is uploading, with one message, "Add or cancel your comment first.", which replaces "Add
  or cancel your comment first: its images are not in the review yet.". An edit opened and left
  unchanged holds nothing back. In `review.test.tsx`, `UNSENT` takes the new text, as does the
  refusal of the browser test "a verdict waits for a comment holding an image to be added or
  cancelled" in `attach.test.tsx`, changed in task 8; "a verdict with an open comment of text alone
  goes through" becomes "a verdict with an open comment holding text is refused", and "a verdict
  with an open comment of no text goes through" keeps what it checked of an open form; "a verdict
  after a comment with an image was cancelled deletes the image" and "the verdict's refusal goes
  once the comment is cancelled" answer "Discard" after Cancel.
- **Rationale**: US5 10 and the spec's error handling refuse a verdict with an open comment holding
  text, which the R64 test of image attachments let through; the plan changes the message. Cancel on
  changed text now asks first (US5 7), so the two tests that cancel a comment holding an image's
  link confirm it. An unchanged edit loses nothing to a verdict.
- **Alternatives considered**: refusing any open form with text, an unchanged edit included, which
  blocks a verdict for a comment already in the review.
- **If wrong**: one condition in `hold`, in
  [`useReviewImages.ts`](/packages/web/src/useReviewImages.ts).
- **Where**: task 7.

## R17: The review's comment form is drawn apart from the document

- **Decision**: `CommentHost`, in
  [`ReviewCommentForm.tsx`](/packages/web/src/ReviewCommentForm.tsx), holds the comment's field and
  images and draws the form through a portal into one element of its own, which a `FormSlot` takes
  wherever the form shows: under a block, in the review's end, or in the phone's sheet. The page
  passes its content to `CommentHost` as children, and the verdict reads the images through
  `ReviewImagesContext`. Which comment the images go to, `writing`, moves into `useCommentDraft`, a
  new one at each close and edit started, and the page's close clears the verdict's refusal for the
  comment: `useReviewImages` loses `onClose` and `onEdit`. The US3 1 test wraps every `Blocks` in a
  `Profiler` through `vi.mock`. `useTextField` takes `extra` as a third argument, written with each
  change.
- **Rationale**: a `Profiler` reports any render in its React tree, and a form drawn in a block's
  `after` is in it, so the document's profiler would be called for the form's own keystrokes;
  `useImageText` needs the text, for where links go as the human types, so the images move with the
  field out of the page, and the page stays unrendered by a keystroke. One element, moved, keeps the
  form mounted as it follows taps, its notice and error included.
- **Alternatives considered**: relying on React Compiler to keep the document's props equal while
  the page holds the text, which the US3 1 test could not tell from a form inside the document; a
  portal straight into each place, which remounts the form at each tap and shows the restore notice
  again.
- **If wrong**: the form goes back into `ReviewPage`, and `useReviewImages` back to the page.
- **Where**: task 7.

## R18: A new review comment shows at once, through `useOptimistic`

- **Decision**: "Add comment" on a new comment shows it under its block, or in the review's end for
  a general one, in a group named `Lines 40–52 · saving…` (or `Line 40 · saving…`,
  `General · saving…`), through `useOptimistic` in a transition of its own; its form is hidden, kept
  mounted, the phone's sheet closed. Refused, the form shows again with its text and the error. An
  edit waits in its form, as before.
- **Rationale**: Astryx's `clickAction` runs in a transition, whose state updates wait for it to
  end, so a plain state did not show until the comment was written; the spec's assumption names a
  new comment only. A form kept mounted keeps its error, which a new form would lose.
- **Alternatives considered**: closing the form and opening it again on a refusal, which shows the
  restore notice for text never left.
- **If wrong**: `add` in [`useReviewActions.ts`](/packages/web/src/useReviewActions.ts).
- **Where**: task 7.

## R19: Closing a comment's sheet or overlay keeps its text

- **Decision**: on the phone, closing the review's comment sheet with Close, Back, or Escape keeps
  its text unsaved, without asking, as R10 does for a settled point; the next comment of that kind
  opens with it, and the restore notice. The mockup page's overlay does the same; its Cancel asks
  "Discard your comment?". The mockup page does not open its overlay as it is drawn: Comment opens
  it with the text kept.
- **Rationale**: as R10, a sheet closed by Back that asked first would push its entry again; nothing
  is lost, and the leave guard of task 10 still counts the text. A mockup's overlay hides the
  mockup, which the human came to see.
- **Alternatives considered**: asking as the sheet closes; opening the mockup's overlay at once.
- **If wrong**: the sheets' `onClose`.
- **Where**: task 7.

## R20: `EditorPage`'s parts move into components with its actions

- **Decision**: task 8's first step moves the commit, start, and discovery actions into
  `useEditorActions`, as planned, and the page's parts into components of
  [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx): `EditorHeading`, `ConflictBanner`,
  `DiscoveryEffort`, `EditorText` with `SectionHints`, and `EditorEnd` with `StartDraft`.
- **Rationale**: the actions alone left `EditorPage` at about 215 lines, and its marker, which said
  the form too must move into components, can only go once it is under 100.
- **Alternatives considered**: a second hook for the save, which leaves the drawing over the limit.
- **If wrong**: the components go back into the page, which only draws them.
- **Where**: task 8, step 1.

## R21: Four editor tests save with the button

- **Decision**: in [`editor.test.tsx`](/packages/web/src/__tests__/editor.test.tsx), "a draft is
  saved as typed, byte for byte", "a draft changed elsewhere shows when the page reads again", "a
  save over a change made elsewhere keeps the text, and offers the new version", and "Load the new
  version loads it" press "Save" after each text they type.
- **Rationale**: each waited for the save 400 ms after the last keystroke, which the
  [UI behaviour](../decisions/ui-behaviour.md) decision now forbids. What they check stays: the text
  is written byte for byte, a save after a reread builds on the version read, a save over a change
  made elsewhere is refused with the text kept, and the new version replaces it.
- **Alternatives considered**: deleting them, since US2's tests cover Save; they cover the conflict
  and the reread, which those do not.
- **If wrong**: one line in each test.
- **Where**: task 8.

## R22: The editor's unsaved text, the discovery effort, and a save already queued

- **Decision**: setting the discovery effort saves the editor's typed text first, as before, then
  writes the effort into it: the control rewrites the text, so it uses it, like Commit. A draft read
  while the editor holds unsaved text does not become the version the next save is made over: a save
  over a file changed elsewhere is refused as a conflict, with "Copy my text" and "Load the new
  version", as today. A restored text, after a reload, is saved over the version read then, and its
  notice says "The file changed since: saving replaces it." when it did; it opens to be edited, not
  drawn. `useSave`'s `save(value)` does not queue a value queued and not written yet again, so quick
  clicks, like two efforts then Commit, do not write the typed text over the efforts. A draft moved
  into a folder as an image was added keeps its text with the link as the new path's unsaved text,
  saved at once, without the restore notice. The page's head says only "committed" or "not
  committed": "saving…", "saved ✓", "Unsaved changes", and the error show next to Save. The slug's
  notice says "The draft's name changed since." when the slug it gives changed.
- **Rationale**: the effort is written into the frontmatter of the text the editor holds, so typed
  text saved after it would remove it; the editor's conflict refusal is an existing guarantee, which
  taking every read would turn into a silent overwrite; the moved page selects the image's alt text
  in the text holding the link, which must show from its first draw; one status per page keeps
  "saving…" in one place.
- **Alternatives considered**: the effort keeping the typed text unsaved, as a tap keeps a
  question's comment (US2 1), which Commit would then write over the effort; taking every read, as
  the notes do, whose core compares only the notes.
- **If wrong**: `setDiscovery` in [`useEditorActions.ts`](/packages/web/src/useEditorActions.ts),
  `adopt` in [`useEditorImages.ts`](/packages/web/src/attach/useEditorImages.ts), and `save` in
  [`useSave.ts`](/packages/web/src/useSave.ts).
- **Where**: task 8.

## R23: Escape on a changed line confirms in the task view's test

- **Decision**: in [`task.test.tsx`](/packages/web/src/__tests__/task.test.tsx), "Escape keeps the
  text, and an empty line is refused" answers "Discard" to "Discard your changes?" after its Escape,
  then checks the same: the line closed, its text as before, the file unchanged.
- **Rationale**: US2 7 and R2 make Escape on a changed line ask first; the test typed "Something
  else", then pressed Escape, which closed the line at once. What it checks stays.
- **Alternatives considered**: deleting it, since the US2 7 tests cover Escape; it also covers the
  empty line refused, which they do not.
- **If wrong**: one line in the test.
- **Where**: task 9.

## R24: How a line edited in place behaves

- **Decision**: `useLineSave(field, onSave, stayOpen, value)` holds the line's text in the unsaved
  store; a line whose key holds unsaved text opens as it is drawn, with the restore notice, whose
  sentence for a line changed since is "The line changed since: saving replaces it.", and whose
  Discard closes the line. Save is disabled while the text is unchanged, with "Unsaved changes"
  beside it, and Enter or Save on an unchanged line closes it, as before. A line's status is
  `SaveStatus`, "saving…" or "saved ✓", which replaces "Saving…" and "Saved"; an error stays under
  the field, as before. "Enter saves · Escape cancels" shows on wide screens only, as the mockup
  draws it. An empty Add row no longer closes when left: leaving a field does nothing, and its
  Cancel closes it without asking.
- **Rationale**: the spec names neither a line's notice sentence nor its status texts; the
  [UI behaviour](../decisions/ui-behaviour.md) decision asks every field's status to say saving or
  saved, as the other fields do, and leaving a field to keep it open. A line holding unsaved text
  that opened closed would hide it until tapped.
- **Alternatives considered**: keeping "Saved"; closing an empty Add row on blur, which the decision
  does not tell apart from a field with text.
- **If wrong**: [`EditableLine.tsx`](/packages/web/src/EditableLine.tsx) and
  [`useLineSave.ts`](/packages/web/src/useLineSave.ts).
- **Where**: task 9.

## R25: Quick add keeps its text as its overlay closes

- **Decision**: quick add's text is the store's `quick-add`. Its overlay gets a Cancel button beside
  Add, which asks "Discard your changes?" when it holds text; closing the overlay with Close, Back,
  or Escape keeps the text unsaved, without asking, and ＋ opens it again with the text and the
  restore notice, as R10 and R19 do for comment sheets. Ctrl+Enter or Cmd+Enter adds, as Add.
- **Rationale**: R2 asks Cancel or Escape on changed quick add text to confirm; Escape in the
  overlay closes it, as it closes every sheet and dialog, and closing loses nothing, so it does not
  ask, as R10 and R19 decided for the other sheets. The overlay had no Cancel, only its Close.
- **Alternatives considered**: Escape in the field asking first, which would make Escape behave
  differently in this overlay than in every other one.
- **If wrong**: [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx)'s `AddForm`.
- **Where**: task 9.

## R26: A page holds unsaved text when a field drawn on it does

- **Decision**: the leave guard asks only when a field drawn now holds unsaved text: `useTextField`
  registers its key and its saved text while drawn (`drawField` in
  [`unsaved.ts`](/packages/web/src/fields/unsaved.ts)), and the guard asks when one of those keys
  has an entry differing from its saved text, trimmed. Entries of fields not drawn, like a blank
  settled edit left after Submit, review entries the restore did not pick, a sheet's comment once
  the sheet closed, quick add's text once its overlay closed, or another page's, never ask; they are
  still restored when their field shows again. Fields in an open overlay count while it is open.
  Back asks only when it reaches another address: Back over an overlay's entry, a sheet's or a
  confirmation's, keeps the page's address and never asks. The guard, its Back handling, and the
  `beforeunload` listener live in [`LeaveGuard.tsx`](/packages/web/src/fields/LeaveGuard.tsx);
  `navigate` asks through `setLeaveGuard`, whose check returns `undefined` when nothing is lost, so
  Back can tell at once whether to put the page back. `useHasUnsaved`, which nothing used, is
  removed.
- **Rationale**: "a page that holds unsaved text" must be what leaving loses: the store keeps
  entries for fields that no longer show, and asking for them would ask on pages that show nothing
  unsaved, with no way to clear the prompt. A key prefix per page cannot tell them apart.
- **Alternatives considered**: every entry of the repository, by its path prefix, as the plan first
  said; entries of the page's file, by key, which still counts stale entries of that file.
- **If wrong**: `hasDrawnUnsaved` in [`unsaved.ts`](/packages/web/src/fields/unsaved.ts) and
  `guardBack` in [`LeaveGuard.tsx`](/packages/web/src/fields/LeaveGuard.tsx).
- **Where**: task 10.

## R27: The slug's restore test leaves the editor through the leave dialog

- **Decision**: in [`editor.test.tsx`](/packages/web/src/__tests__/editor.test.tsx), "the slug typed
  is restored after a reload, and on the line's page" answers "Leave page" to "Leave page?" after
  its `navigate` to the line's page, then checks the same: the line's page shows the slug typed.
- **Rationale**: the slug typed is unsaved, so leaving the editor asks first (US5 4); the test
  navigated away with it, which opened the page at once.
- **Alternatives considered**: saving the slug first, which would no longer show that the line's
  page restores the unsaved slug.
- **If wrong**: one step in the test.
- **Where**: task 10.

## R28: How the fixed heights are checked where the browser cannot show them

- **Decision**: in [`fields.test.tsx`](/packages/web/src/__browser__/fields.test.tsx), US6 8 checks
  that a comment field's computed `resize` is `vertical`, then sets the field's height as dragging
  its handle does, and checks typing keeps it: WebKit ignores Playwright's mouse on a text area's
  resize handle, so the drag itself cannot run in the tests. US6 3 checks that the field's height,
  its Save button, and the content further down, the next question, do not move from the field empty
  to its first letter and to 12 lines. [`SaveStatus`](/packages/web/src/fields/SaveStatus.tsx)
  always takes the room of "Unsaved changes", drawn hidden by its style while another status or none
  shows: the status that appears at the first letter typed, which on the phone wraps under the
  field's buttons, has its line kept, so nothing below moves. Comment forms draw their "Unsaved
  changes" through it too, since the final review: on the phone, the review's form moved its Cancel
  to the next line at the first letter.
- **Rationale**: the drag was tried at both sizes, with real mouse moves, presses, and waits, at the
  handle's corner: the events reach the text area, which never resizes. US6 says typing never
  changes the page's layout: "Unsaved changes" showing at the first letter moved the page 28 px on
  the phone, which the test first measured only from that letter on. The room is kept by the style,
  not by text, so the page reads the status shown only.
- **Alternatives considered**: a drag through another driver, which the browser tests do not have;
  measuring the content below from the first letter, which let the status move it; showing the
  status only once the field loses the focus, which the UI behaviour decision does not allow.
- **If wrong**: the two tests, and the reserved room in `SaveStatus`, which leaves an empty line
  under a phone's field while nothing changed.
- **Where**: task 11, and the fix before task 13.

## R29: "Leave page" is the dialog's main button, "Discard" its destructive one

- **Decision**: a confirmation's button draws as the main one, Astryx's `primary`, unless its
  options say `destructive`: "Leave page" is primary, as the mockup's section 4 draws it, and
  "Discard", in "Discard your comment?" and "Discard your changes?", stays `destructive`.
- **Rationale**: leaving loses nothing, the dialog itself saying the unsaved text stays in the
  browser, so a red button would warn of a loss that does not happen. Discard deletes what the human
  typed, which nothing brings back: the [UI behaviour](../decisions/ui-behaviour.md) decision keeps
  dialogs for confirming what cannot be undone, and the destructive colour says so. The mockup draws
  both as its one accent button, with colours it calls approximate.
- **Alternatives considered**: both primary, as the mockup draws them, which makes deleting text
  look like any other action; both destructive, as built in task 4, which makes leaving look like
  deleting.
- **If wrong**: one option, `destructive`, in `DISCARD_CHANGES` and `DISCARD_COMMENT`.
- **Where**: [`Confirm.tsx`](/packages/web/src/fields/Confirm.tsx), the fix before task 13.

## R30: A confirmation's sheet is as tall as its question

- **Decision**: on the phone, `ConfirmHost` draws its sheet with Astryx's `hug` height, as tall as
  its title, body, and buttons; `Overlay` takes `hug` beside `tall` and `capped`. The comment sheets
  keep `capped`.
- **Rationale**: the screenshots showed "Leave page?" and "Discard your comment?" over 62% of the
  screen, most of it empty under the buttons, where the mockup's section 4 draws a sheet that ends
  under them. A comment sheet holds a 7-row field and a keyboard, which the fixed height suits.
- **Alternatives considered**: `capped` for every sheet, as built in task 5.
- **If wrong**: one prop in [`Confirm.tsx`](/packages/web/src/fields/Confirm.tsx).
- **Where**: task 13, from the review of its screenshots.

## R31: "Ctrl+Enter saves" beside a multi-line field's Save, on wide screens

- **Decision**: a question's comment, the notes, and the editor show "Ctrl+Enter saves" after their
  status, on wide screens only, through `fields/SaveKeys.tsx`, as a line shows "Enter saves · Escape
  cancels" (R24). Comment forms show none, as the mockup's section 2 draws none, though Ctrl+Enter
  or Cmd+Enter sends their comment as their button does, since the final review.
- **Rationale**: the screenshots lacked the hint the mockup's sections 1 and 6 draw beside "Save
  comment" and the editor's Save; the phone's sections draw none, and a phone has no such key.
- **Alternatives considered**: "Cmd+Enter" on a Mac, which the mockup does not draw, and both keys
  save; the hint in `SaveStatus`, which a line's status also uses, with keys of its own.
- **If wrong**: one component, drawn in three places.
- **Where**: task 13, from the review of its screenshots.
