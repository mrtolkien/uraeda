# Discovery, round 01: Text inputs and comments

## Summary

Text fields in established tools follow one of two patterns: explicit saving, where nothing reaches
the record until a button is pressed, and autosave, usually with a local copy of what is being typed
so it survives a reload. Design systems recommend explicit saving for text, with a warning before
leaving with unsaved text (Primer, Cloudscape), and review tools add a submit shortcut,
Ctrl/Cmd+Enter, and comments anchored to lines or blocks (GitHub, GitLab, Linear, Notion).

The [proposal](proposal.md) asks for explicit saving everywhere, fixes to two bugs, and comments on
the points a round settled without the human, appended to its notes. The web UI mixes the patterns
today: a question's comment and review comments save with a button, while the round's notes and the
proposal editor save 400 ms after the last keystroke, and in-place lines save on Enter or blur, as
the active [UI behaviour](../decisions/ui-behaviour.md) decision requires.

Both bugs have causes in the code. The notes field takes the file's text whenever no save waits, and
the core trims the notes it writes, so a trailing space or line break typed before a pause is
removed; a live update from an older save can also land after a newer one. The notes show twice
because the core counts the `**Notes:**` paragraph as part of the settled section. Review comments
lag because the comment's text lives in the review page, so each keystroke re-renders the whole
document. The unmerged image attachments feature rewrites the same fields, and saves notes as they
are typed.

## How other products do it

### GitHub pull request reviews

- One comment is posted at once with **Add single comment**; several are batched with **Start a
  review**, then **Submit review** with a summary and a verdict. Pending comments are visible only
  to their author, and can be edited until the review is submitted
  ([commenting](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request),
  [reviewing](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)).
- A comment covers several lines by clicking the first line number and Shift-clicking the last (same
  pages).
- The text of a comment being typed is saved in the browser, and survives a refresh or a closed tab
  ([changelog, 2026-01-22](https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/),
  [changelog, 2025-06-26](https://github.blog/changelog/2025-06-26-improved-pull-request-files-changed-experience-now-in-public-preview/)).
  GitHub's [`session-resume`](https://github.com/github/session-resume) library keeps field values
  in `sessionStorage` on `pagehide`, and says it is "not designed for persisted crash recovery".
- Ctrl/Cmd+Enter submits a comment, Ctrl/Cmd+Shift+Enter a review comment on Files changed. No
  Escape shortcut is listed for comments
  ([keyboard shortcuts](https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts)).

### GitLab merge request reviews

- **Start a review** keeps a comment pending, **Add comment now** publishes it, and later ones use
  **Add to review**. Discarding a review deletes its pending comments for good
  ([reviews](https://docs.gitlab.com/user/project/merge_requests/reviews/)).
- Pending comments are draft notes stored on the server, with an API to create, edit, publish one,
  or publish all with a summary ([draft notes API](https://docs.gitlab.com/api/draft_notes/)).
- Cmd/Ctrl+Enter adds a comment to the review, Shift+Cmd/Ctrl+Enter publishes it at once, and ↑ in
  an empty field edits the last comment ([shortcuts](https://docs.gitlab.com/user/shortcuts/)).
- Comment text being typed is kept in `localStorage` (seen only in issue snippets:
  [#40462](https://gitlab.com/gitlab-org/gitlab-ce/issues/40462),
  [#351704](https://gitlab.com/gitlab-org/gitlab/-/issues/351704)).

### Linear

- A comment posts with its button or ⌘/Ctrl+Enter. Inline comments go on selected text. "Unsent
  comments are visible on the issue, and in Drafts in your sidebar." Editing a comment ends with an
  explicit save ([comments](https://linear.app/docs/comment-on-issues)).

### Google Docs and Notion

- Google Docs: select text, **Add comment**, type, then **Comment**
  ([help](https://support.google.com/docs/answer/65129)); Ctrl+Alt+M inserts a comment
  ([shortcuts](https://support.google.com/docs/answer/179738)).
- Notion comments go on a page, a block, or a text selection, and "you can't comment on multiple
  blocks at a time" ([help](https://www.notion.com/help/comments-mentions-and-reminders)). Neither
  documents which key submits a comment.

### Slack and Jira

- Slack keeps unsent messages as drafts, listed under "Drafts & sent" (seen only in a snippet of
  [its help](https://slack.com/help/articles/201457107-Send-and-read-messages)).
- Jira's M key jumps to the comment field
  ([help](https://support.atlassian.com/jira-core-cloud/docs/watch-share-and-comment-on-an-issue)).

### What they have in common

Capabilities users of these products may expect, whether or not the proposal mentions them:

- An explicit button for each comment, with Cancel to its left, and Ctrl/Cmd+Enter to submit from
  the field. Plain Enter adds a line in multi-line fields.
- Comments anchored to what they are about: lines, a block, or a selection.
- Comments batched and visible only to their author until the review is submitted, then editable and
  removable until then.
- Text being typed survives a reload, kept apart from the saved record, in the browser.
- A warning before leaving a page with unsaved text.
- A visible status of what is saved.

## Standards and libraries

### Saving patterns in design systems

- Primer, GitHub's design system: "When designing a form, start with an explicit saving pattern";
  text inputs, checkboxes, and radios save explicitly, while toggle switches and segmented controls
  may save at once; one form does not mix the two. Warn before leaving with unsaved changes through
  `beforeunload`; keep the data when a save fails. Primer also says not to disable or hide a save
  button, and to keep one save button per page ([saving](https://primer.style/ui-patterns/saving),
  [forms](https://primer.style/ui-patterns/forms/overview)).
- Cloudscape (AWS): an in-page dialog, "Leave page" with Cancel and Leave, on in-app navigation with
  unsaved changes, and the browser's own prompt for reloads and closed tabs; none when nothing
  changed ([unsaved changes](https://cloudscape.design/patterns/general/unsaved-changes/)).
- NN/g: ask before a destructive action, name buttons by outcome, and "provide an explicit 'Save'
  function even when auto-saving is enabled"
  ([cancel vs close](https://www.nngroup.com/articles/cancel-vs-close/),
  [confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/),
  [floppy disk icon](https://www.nngroup.com/articles/floppy-disk-icon-understandability/)).
- GOV.UK: buttons named by their action, disabled buttons avoided, a visible label above every text
  area ([button](https://design-system.service.gov.uk/components/button/),
  [textarea](https://design-system.service.gov.uk/components/textarea/)).
- Atlassian's Comment component has a saving state, "Saving...", with its actions hidden
  ([comment](https://atlassian.design/components/comment/examples)).

### WCAG 2.1

- 3.2.2 On Input: a field's change must not change the context without warning; a submit button is
  the sufficient technique (G80). A silent save that moves nothing is not a change of context (our
  judgement) ([understanding 3.2.2](https://www.w3.org/WAI/WCAG21/Understanding/on-input.html)).
- 3.3.2 Labels or Instructions: every field needs a visible label
  ([understanding 3.3.2](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)).
- 2.1.4 Character Key Shortcuts covers single printable keys only: Ctrl/Cmd+Enter is outside it (our
  reading of
  [understanding 2.1.4](https://www.w3.org/WAI/WCAG21/Understanding/character-key-shortcuts.html)).

### The browser's leave prompt

- `beforeunload` shows only the browser's generic message, after the user has interacted with the
  page. Add the listener only while something is unsaved: Firefox keeps a page with one out of its
  back-forward cache. It is unreliable on phones, where `visibilitychange` is the event to save on
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)).
- It does not fire on `history.pushState` or `popstate`, which do not unload the page (our
  inference). The Navigation API's `navigate` event is Baseline in 2026
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent)); whether it can cancel a
  Back within the page was seen only in a snippet of a Chromium test change.

### React 19.3

- A controlled field's `onChange` must set its value synchronously, or React reverts the field and
  the caret jumps ([input reference](https://react.dev/reference/react-dom/components/input),
  [facebook/react#955](https://github.com/facebook/react/issues/955)). Input state must not be set
  in a transition ([useTransition](https://react.dev/reference/react/useTransition)).
- Text from the server copied into a field while the user types overwrites their edit. The usual
  answer is to show the local text while the field has changes, and the server's otherwise
  ([TkDodo, React Query and Forms](https://tkdodo.eu/blog/react-query-and-forms)).
- IME composition fires `onChange` before it ends, so a value written into the field during it
  breaks the composition ([facebook/react#3926](https://github.com/facebook/react/issues/3926)).
- To keep typing fast in a large page, keep the field's state in a small component, or wrap the slow
  part in `memo`: without `memo`, `useDeferredValue` does not help
  ([input reference](https://react.dev/reference/react-dom/components/input),
  [useDeferredValue](https://react.dev/reference/react/useDeferredValue)).
- React Compiler is stable and memoizes automatically
  ([introduction](https://react.dev/learn/react-compiler/introduction)). `@vitejs/plugin-react`
  6.1.2 enables it through an experimental Rust transform or through Babel, with three new packages
  (the plugin's README, in `node_modules`). The web package does not use it.

### Astryx 0.6.8

- `TextArea` and `TextInput` are controlled only: `value` is required, there is no `defaultValue`,
  and the `ref` reaches the native element. `onChange` gets the text, synchronously. The value goes
  through `useOptimistic`, which only matters with `changeAction`, unused in the app. `TextArea` has
  no autosize: its height is `rows`. `TextInput` has an `onEnter` that ignores IME keys
  (`@astryxdesign/core/src/TextArea/TextArea.tsx`, `src/TextInput/TextInput.tsx`, `CHANGELOG.md`, in
  the pnpm store).

### fate 1.7.7

- A mutation's response is normalized into the cache; imperative mutations do not wait for each
  other. A live update makes the server re-read the record and push it over one SSE stream. Nothing
  orders the stream against mutation responses (`react-fate/docs/guide/actions.md`,
  `live-views.md`).
- `useView` renders a cache change through `useDeferredValue`, so a live update's re-render runs at
  background priority, after keystrokes (`react-fate/lib/index.mjs`, lines 44–168).
- fate never writes into a component's state: the app's own effects copy server text into fields.

## The code

### Important reads

- [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx): the notes field saves 400 ms after the last
  keystroke through `useSave`, and an effect replaces the field's text with the file's notes
  whenever no save waits and they differ (lines 101–126). The settled points are drawn with `Blocks`
  from `round.settled` (lines 226–233).
- [`Question.tsx`](/packages/web/src/Question.tsx): a question's comment saves with "Save comment",
  with Submit, or with a tap on an option, which saves the letters and the comment as typed (lines
  336–362). The file's answer replaces the shown one only when the comment has no unsaved change
  (lines 325–335). `GrowingTextArea` is shared by every multi-line field (lines 196–224).
- [`useSave.ts`](/packages/web/src/useSave.ts): one queue of saves, each carrying the text the last
  one wrote, for the core's conflict check. `idle()` says nothing waits; it says nothing about how
  old the file's text is.
- [`clarifications.rs`](/crates/core/src/files/clarifications.rs): `notes()` reads from the
  `**Notes:**` line to the next heading, trimmed; `set_answer` writes the notes trimmed, and refuses
  lines starting with `#`, `**Answer:**`, or `**Notes:**` (lines 180–270).
- [`items.rs`](/crates/core/src/files/items.rs): a round's `settled` is every block of the "Settled
  without the human" section, which runs to the end of the file, the `**Notes:**` paragraph included
  (lines 256–262, 353–361).
- [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx) and
  [`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts): the comment's text is state of the
  review page, kept there so it survives the form moving under another tapped block. Each keystroke
  re-renders the page, and `Blocks` re-renders the whole document with new inline callbacks; nothing
  in `packages/web/src` uses `memo`.
- [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx): the comment form, shared by the review and
  the mockup page: where it goes, a quote, the text, Cancel, and "Add comment".
- [`ReviewComments.tsx`](/packages/web/src/ReviewComments.tsx): pending comments under their block,
  with Edit and Remove.
- [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx): drafts and proposals save as typed, after
  400 ms, with the same effect as the notes (lines 54–80). Commit and Start save what waits first.
- [`EditableLine.tsx`](/packages/web/src/EditableLine.tsx): a line edited in place saves on Enter or
  blur and cancels on Escape, as the UI behaviour decision says. It is used by the priorities page,
  the task view, and the session page.
- [`ReviewVerdict.tsx`](/packages/web/src/ReviewVerdict.tsx): the review's summary is local state,
  sent with the verdict's buttons. [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx), the slug
  fields, and [`Composer.tsx`](/packages/web/src/Composer.tsx) save or send with their button. The
  search and filter fields save nothing.
- [`routes.tsx`](/packages/web/src/routes.tsx): the router is the app's own, on `pushState` and
  `popstate`. Nothing handles `beforeunload` or blocks a navigation.
- [`live.ts`](/packages/server/src/live.ts): every change on disk, the UI's own saves included,
  sends a live update of its file.
- Commit `5839e63` moved a question's comment from saving as typed to its button, because the page
  replaced text being typed with the file's, "which made the cursor jump and text disappear in
  comments, notes, and the editor". The notes and the editor kept saving as typed.

### The proposal's path and existing actions

- **Typing notes.** Today, each pause of 400 ms saves. The core writes the notes trimmed, the file
  changes, and the effect sees the file's notes differ from the field's and replaces them: a space
  or a line break typed before a pause disappears, and the next word joins the previous one. A live
  update of an older save, delivered after a newer save returned, replaces the field with older text
  in the same way (a race read in the code, not reproduced). With saving on a button, the field
  keeps its text while it has unsaved changes.
- **Reading the round.** The settled points are drawn from the section's blocks, the `**Notes:**`
  paragraph included, so the notes show once in the settled points and once in their field. On an
  answered round, they show a third way, under "Notes:".
- **Writing a review comment.** Each keystroke re-renders the review page and its document. On a
  long spec this is the likely lag. Tapping a block on the phone also scrolls it above the sheet
  once the sheet's animation ends, and "Add comment" waits for the server before the form closes.
- **Commenting on a settled point.** Today, the settled points are plain blocks, and the human
  writes about them in the notes. Appending a comment to the notes meets the notes being typed and
  not yet saved, the notes' refused lines, and Submit, which saves what waits first.
- **Leaving a page.** Today, nothing warns: a question's unsaved comment is lost on reload, and the
  notes and the editor lose at most 400 ms of typing. With saving on a button, everything typed
  since the last save is at stake.
- **Submit, Commit, and the verdicts.** Submit saves every question's unsaved comment and the notes
  first; Commit and Start save the editor's text first. The verdict ignores a comment form left
  open.
- **Option taps.** A tap on an option saves the answer at once, with the comment as typed: a comment
  can be saved without its button.
- **Lines edited in place.** Enter or blur saves, as the UI behaviour decision requires. A tap
  elsewhere saves a half-typed line.

### Other features in flight

- **Image attachments** (`2026-10-13-image-attachments`, implementing, not merged): images go into
  answers' comments, notes, review comments, proposals, and chats. Its ruling R64 saves an answer as
  soon as an image is added to its comment, and keeps the notes saving as typed; R49 adds `load` to
  `useSave`. It rewrites the notes field, the comment field, `CommentForm`, `EditorPage`, and
  `useSave`, and predates main's `useCommentDraft.ts`, `ReviewComments.tsx`, and
  `ReviewVerdict.tsx`.
- **Code quality in the skill** (`2026-10-14-code-quality-in-the-skill`, finished, pull request
  open): its [code quality](https://github.com/mrtolkien/uraeda/pull/13) decision caps functions at
  100 lines and files at 500, and marks `Question`, `RoundPage`, `EditorPage`, `Composer`,
  `useSave`, and `ReviewVerdict` as over the limits: a feature touching them splits them first. It
  also splits `ReviewPage.tsx` into several files and adds folds to the review.
- **Dedicated session view** (`2026-10-14-session-view`): a proposal only, around the session page
  and its navigation.

### Likely changes

- [`crates/core/src/files/items.rs`](/crates/core/src/files/items.rs): the settled section stops
  before the `**Notes:**` line, under every option.
- [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx): a Save button for the notes, and settled
  points that take comments, under every option.
- [`useSave.ts`](/packages/web/src/useSave.ts): no timer once nothing saves as typed; kept or
  simplified as a queue of explicit saves.
- [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx),
  [`useCommentDraft.ts`](/packages/web/src/useCommentDraft.ts),
  [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx),
  [`Blocks.tsx`](/packages/web/src/Blocks.tsx): the comment's text kept out of the page's state, and
  `Blocks` memoized; with option B of [the comment lag](#the-comment-lag), the build configuration
  instead.
- [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx): a Save button, with option A or C of
  [which fields save on a button](#which-fields-save-on-a-button).
- [`EditableLine.tsx`](/packages/web/src/EditableLine.tsx) and
  [the UI behaviour decision](../decisions/ui-behaviour.md): with option A or C of the same topic.
- [`Question.tsx`](/packages/web/src/Question.tsx): with option A or B of
  [option taps](#option-taps).
- [`routes.tsx`](/packages/web/src/routes.tsx) and a shared registry of unsaved fields: with
  [unsaved text](#unsaved-text).
- [`crates/core/src/actions/answer.rs`](/crates/core/src/actions/answer.rs) and the core's round
  items: appending a comment on a settled point, and, with option A of
  [where comments on settled points show](#where-comments-on-settled-points-show), reading them
  back.
- The skill: [`references/spec.md`](/skills/uraeda/references/spec.md) and the clarifications
  template, if comments on settled points get a format of their own
  ([the format of a comment in the notes](#the-format-of-a-comment-in-the-notes)).

## The proposal

### Which fields "all text input fields" covers

The proposal says all text fields save only with a button. Five kinds exist: fields that already
save with a button (a question's comment, review comments, the summary, slugs, quick add, chat),
fields that save as typed (notes, the editor), lines that save on Enter or blur, and fields that
save nothing (search, filters). Lines saving on blur are an active decision's rule.

### "Eats some of my letters"

The proposal reports the symptom; the code shows two causes, both from the field taking the file's
text while the human types: the trimmed save, and a late live update. Saving on a button removes the
first only if the field keeps its text while it has unsaved changes.

### "Shown in the body of the page"

The notes are drawn inside the settled points, because the core's settled section runs to the end of
the file. Nothing in the proposal is ambiguous here.

### "Super laggy"

The proposal does not say when the lag shows: while typing, when tapping a block, or after "Add
comment". The code has a cause for each, the first the largest.

### Comments on settled points "like we do for specs"

Review comments are anchored to lines, listed under their block, and editable and removable until
the verdict. Notes are one free text. The proposal does not say whether a comment on a settled point
stays visible under it, can be edited there, or only becomes text in the notes, nor how it reads in
the file.

### Unsaved text

Saving only on a button makes everything typed since the last save losable, which the proposal does
not address: a reload, a closed tab, Back, or Submit with text not saved.

### Images

The image attachments feature, not merged, saves the notes as typed and an answer as soon as an
image is added to its comment: both contradict the proposal.

## Approaches

Criteria come from the proposal (writing feels solid), the [constitution](../CONSTITUTION.md) (plain
text in git, rules in one place, checks that never go back), and the active
[UI behaviour](../decisions/ui-behaviour.md), [UI components](../decisions/ui-components.md),
[stack](../decisions/stack.md), and [toolchain](../decisions/toolchain.md) decisions, and WCAG 2.1
AA, which the [UI checks](../decisions/ui-checks.md) decision applies.

### Which fields save on a button

Which fields lose saving as typed, or on blur. Relies on [important reads](#important-reads) and
[saving patterns](#saving-patterns-in-design-systems).

| Option                                                                             | Proposal                         | UI behaviour decision         | Risk of a half-typed save    |
| ---------------------------------------------------------------------------------- | -------------------------------- | ----------------------------- | ---------------------------- |
| A. Notes and editor on a button; lines save on Enter or a Save button, not on blur | Met                              | Changed: blur no longer saves | None                         |
| B. Notes and editor on a button; lines unchanged                                   | Partly: lines still save on blur | Unchanged                     | A tap elsewhere saves a line |
| C. Every field on a button only, Enter included                                    | Met, strictly                    | Changed                       | None, one more tap per line  |

### Option taps

Whether a tap on an option, which is not a text field, still saves the comment as typed. Only the
round's questions. Relies on [the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                                          | Comment saved without its button | Taps                                        |
| --------------------------------------------------------------- | -------------------------------- | ------------------------------------------- |
| A. A tap saves the letters at once, with the last saved comment | Never                            | Saved at once, as Primer allows for toggles |
| B. Letters and comment wait for one Save per question           | Never                            | One more tap per question                   |
| C. As today: a tap saves the comment as typed                   | Yes                              | Saved at once                               |

### Unsaved text

What protects text typed and not saved. Relies on [GitHub](#github-pull-request-reviews),
[the browser's leave prompt](#the-browsers-leave-prompt), and
[the proposal's path](#the-proposals-path-and-existing-actions).

| Option                                                                | Reload or closed tab   | Submit and Commit     | Cost                                             |
| --------------------------------------------------------------------- | ---------------------- | --------------------- | ------------------------------------------------ |
| A. Submit and Commit save what is typed first; leaving asks first     | Asks, browser's prompt | Save first, as today  | A registry of unsaved fields, read by the router |
| B. Submit and Commit refuse while text is unsaved; leaving asks first | Asks                   | Refused, fields named | Same, plus the refusal                           |
| C. On top of A or B: typed text kept in the browser and restored      | Restored               | Unchanged             | Browser storage, cleared on save                 |

### The comment lag

How to make typing a comment fast on a long document. Relies on [React 19.3](#react-193) and
[important reads](#important-reads).

| Option                                                  | Scope                       | Dependencies                                         | Decisions          |
| ------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------ |
| A. The text lives in the form, and `Blocks` is memoized | The review and mockup pages | None                                                 | None               |
| B. React Compiler for the whole web package             | Every page                  | Experimental Rust transform, or three Babel packages | A toolchain change |

### Notes that lose letters

How the notes field stops taking the file's text while the human types. Relies on
[the proposal's path](#the-proposals-path-and-existing-actions) and [fate](#fate-177).

- The field keeps its text while it differs from what was last saved, as a question's comment does,
  and takes the file's text only when it has no unsaved change. With saving on a button, the trimmed
  save and late live updates no longer reach a field being typed in.
- The alternative, ordering every update by a version, fixes the race but keeps saving as typed,
  which the proposal drops.

### Notes shown twice

The core's settled section stops at the `**Notes:**` line. Drawing it in the UI and filtering there
would put a rule of the file's structure in TypeScript, against the [stack](../decisions/stack.md)
decision. No alternative meets the decisions.

### Where comments on settled points show

Whether a comment on a settled point is a review-style comment or text in the notes. Relies on
[GitHub](#github-pull-request-reviews), [Notion](#google-docs-and-notion), and
[comments on settled points](#comments-on-settled-points-like-we-do-for-specs).

| Option                                                     | Like spec comments    | Notes field   | Core work                          |
| ---------------------------------------------------------- | --------------------- | ------------- | ---------------------------------- |
| A. Under its point, with Edit and Remove, and in the notes | Yes                   | Shows it too  | Reads comments back from the notes |
| B. Only in the notes, edited there                         | No, after it is added | The one place | Appends only                       |

### The format of a comment in the notes

How a comment on a settled point reads in the file, for the spec step and any reader. Relies on
[important reads](#important-reads).

| Option                                                   | Reads without tools        | Found by the core | Skill change                |
| -------------------------------------------------------- | -------------------------- | ----------------- | --------------------------- |
| A. A bullet, `- **<the point's bold start>**: <comment>` | Yes, like the settled list | By its bold start | The spec reference names it |
| B. A quote of the point, then the comment                | Yes, longer                | By the quote      | Same                        |
| C. A paragraph, `On "<point>": <comment>`                | Yes                        | By its prefix     | Same                        |

### Images and explicit saves

Whether an image added to a field saves it. Only matters once image attachments merge. Relies on
[other features in flight](#other-features-in-flight).

| Option                                                         | Proposal     | Images left behind                                                      |
| -------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| A. An image's link waits for the field's Save, like typed text | Met          | An uploaded image whose link is never saved, removed at the next commit |
| B. An image saves its field at once, as R64 rules              | An exception | None                                                                    |

### Needs no choice

- **Ctrl/Cmd+Enter saves a multi-line field, Enter a line**: GitHub, GitLab, and Linear agree, and
  it is outside WCAG 2.1.4. It is the field's own key, like Enter in a line today, not a page
  shortcut, which the UI behaviour decision forbids while a field has the focus.
- **Cancel with changed text asks first**: NN/g asks for confirmation before a destructive action,
  and the UI behaviour decision allows a dialog to confirm what cannot be undone.
- **Batching comments until the verdict**: the review already works this way, pending comments
  included.
- **A visible label on every field**: Astryx's fields have labels; the existing ones stay.
- **A visible save status**: the UI behaviour decision already requires one next to each control.
- **One point per comment on settled points**: a settled point is one bullet, as Notion's comments
  are on one block.
- **A comment open when a verdict is pressed**: the comment changes what the verdict means, so the
  verdict asks to add or cancel it first, as image attachments does for images.

## Not checked

- Slack's help pages on drafts and keyboard shortcuts answered HTTP 429; the drafts fact comes from
  a snippet.
- Atlassian's forms pattern page answered 404, and Material's text field guidelines render without
  content outside a browser.
- No official page says which key submits a comment in Google Docs or Notion.
- Whether the Navigation API can cancel a Back within the page: only a snippet of a Chromium test
  change says so.
- The late live update race is read in the code, not reproduced.
