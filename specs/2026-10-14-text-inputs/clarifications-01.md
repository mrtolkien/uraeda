---
status: awaiting-human
---

# Clarifications, round 01: Text inputs and comments

> [!IMPORTANT]
>
> 7 questions on saving text and commenting on settled points, about 25 minutes.
>
> - One choice changes an active decision: lines edited in place would stop saving on blur, which
>   the UI behaviour decision requires today.
> - How comments on settled points show and how they read in the file work together, and the format
>   lasts beyond this feature: the spec step reads it in every later round.
> - The unmerged image attachments feature saves notes as typed, and an answer as soon as an image
>   is added: one question decides whether that stays.
> - Both bugs have causes found in the code: the notes field takes the file's trimmed text while you
>   type, and each keystroke in a review comment redraws the whole spec. Their fixes are settled.
> - Saving only on a button puts unsaved text at risk on a reload or Back: one question decides what
>   protects it.
> - Ten points are settled without you, at the end.

## Context

The [proposal](proposal.md) asks for every text field to save only with a button, for the notes to
stop losing letters and showing twice, for review comments to stop lagging, and for comments on the
points a round settled without you, added to the notes.

Today, a question's comment and review comments save with their button, but the round's notes and
the proposal editor save 400 ms after you stop typing
([`RoundPage.tsx`](/packages/web/src/RoundPage.tsx),
[`EditorPage.tsx`](/packages/web/src/EditorPage.tsx)), and a line edited in place saves on Enter or
when you tap elsewhere ([`EditableLine.tsx`](/packages/web/src/EditableLine.tsx)). The notes lose
letters because each save writes them trimmed and the field then takes the file's text, so a space
typed before a pause disappears; a late live update can do the same. They show twice because the
core counts the **Notes:** paragraph as one of the settled points. Comments lag because their text
is held by the review page, which redraws the whole document at each keystroke.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Which text fields should save only with a button?

Notes and the proposal editor save as you type, and lines edited in place, like a priority or a
session's name, save on Enter or blur: the [UI behaviour](../decisions/ui-behaviour.md) decision
says "Enter or blur saves, Escape cancels". Primer, GitHub's design system, recommends explicit
saving for every text field. Search and filter fields save nothing and stay as they are. More in
[discovery](discovery-01.md#which-fields-save-on-a-button).

Why it matters: options A and C change an active decision, which binds every later view.

- **A (recommended). Notes and the proposal editor save with a Save button; a line edited in place
  saves with Enter or a Save button next to it, and no longer on blur: tapping elsewhere leaves it
  open with its text. The UI behaviour decision's rule becomes "Enter or its Save button saves,
  Escape cancels".**
  - [pro] nothing is ever saved by accident, half-typed, and every field works the same way.
  - [con] a line left open stays open until saved or cancelled.
  - Why recommended: it is the proposal's rule, and Enter keeps a line's edit as quick as today.
- **B. Notes and the proposal editor save with a Save button; lines keep saving on Enter or blur,
  and the decision stays as it is.**
  - [pro] no decision changes, and one-line edits stay one gesture.
  - [con] a tap elsewhere still saves a half-typed line.
- **C. Every field saves only with its button, Enter included, and the decision changes to match.**
  - [pro] one rule with no exception.
  - [con] one more tap for every line, where Enter is the habit.

**Answer:**

## Q2: Should a tap on an option still save the comment typed under it?

A tap on an option saves the answer at once, with the question's comment as typed, saved or not
([`Question.tsx`](/packages/web/src/Question.tsx)). Options are toggles, which Primer allows to save
at once, but the comment is a text field. More in [discovery](discovery-01.md#option-taps).

Why it matters: it decides whether a comment can ever be saved without its button.

- **A (recommended). A tap saves the letters at once, with the comment as last saved: a comment
  being typed waits for its Save button.**
  - [pro] taps stay instant, and a comment is only saved by its button.
  - [con] the answer can be saved with letters and an older comment, until the comment's Save.
  - Why recommended: it keeps the quick taps and the proposal's rule.
- **B. A tap only selects: the letters and the comment wait for one Save button per question.**
  - [pro] one save per question, nothing written before you are done.
  - [con] one more tap per question, and the round's progress shows only once saved.
- **C. As today: a tap saves the comment as typed.**
  - [pro] nothing changes.
  - [con] a comment is saved without its button.

**Answer:**

## Q3: What protects text you typed and did not save?

With saving on a button, everything typed since the last Save is lost on a reload, a closed tab, or
Back. Today, Submit and Commit save what waits first. Cloudscape and Primer warn before leaving a
page with unsaved text, and GitHub keeps the text of a comment being typed in the browser, so it
survives a reload. More in [discovery](discovery-01.md#unsaved-text).

Why it matters: it decides whether a reload can lose a long note, and whether Submit can include
text you never saved.

C can come on top of A or B.

- **A (recommended). Submit, Commit, and Start save every unsaved field first, as today, and leaving
  a page with unsaved text asks first: the app's own dialog, "Leave page" or "Stay", for a link or
  Back, and the browser's prompt for a reload or a closed tab.**
  - [pro] nothing is lost by accident, and the final buttons keep working in one tap.
  - [con] Submit saves text you never pressed Save on, though it is a button you pressed.
  - Why recommended: it keeps today's Submit, and protects the rest with what design systems advise.
- **B. Submit, Commit, and Start refuse while a field has unsaved text, and name it; leaving a page
  asks first, as in A.**
  - [pro] the strictest reading of "only with a button": only Save saves.
  - [con] one more step before every Submit with an open field.
- **C. On top of A or B: the text of every unsaved field is kept in the browser, restored after a
  reload or a crash, and cleared when saved.**
  - [pro] nothing is lost even when the browser closes without asking.
  - [con] text restored on one device only, and a second place where text lives until saved.

**Answer:**

## Q4: Where should a comment on a settled point show once added?

On a spec, a comment is anchored to lines, shows under its block, and can be edited or removed until
the verdict, like GitHub's pending review comments. The round's notes are one free text, at the end
of the file, which the spec step reads like answers. The proposal asks for comments on settled
points "like we do for specs", appended as a note. Tapping a point would open the same comment form
as on a spec. The next question is how the comment reads in the notes. More in
[discovery](discovery-01.md#where-comments-on-settled-points-show).

Why it matters: it decides whether the core reads these comments back from the notes, and what
editing one means.

- **A (recommended). The comment shows under its point, with Edit and Remove, and its line is added
  to the notes, where it also shows in the notes field.**
  - [pro] it reads like a spec review: you see what each point got.
  - [con] the comment shows in two places, and editing it in the notes field changes it under its
    point too.
  - Why recommended: it is what "like we do for specs" describes.
- **B. The comment is added to the notes, and is edited there like any other note.**
  - [pro] one place for the text, and the core only appends.
  - [con] once added, nothing shows under the point.

**Answer:**

## Q5: How should a comment on a settled point read in the notes?

Settled points are bullets that start with their subject in bold, like "**Undoing a completion**
puts back...". Today, notes are free text with no format: the skill only says the human may write
about the settled points there. With A in Q4, the core finds each comment again by its format. More
in [discovery](discovery-01.md#the-format-of-a-comment-in-the-notes).

Why it matters: the format is read by every later spec step, and becomes part of the skill.

- **A (recommended). One bullet per comment, starting with the point's subject in bold, then a colon
  and the comment, like "- Undoing a completion: keep the undo, but ask first", with the subject in
  bold.**
  - [pro] reads like the settled list it answers, and is easy to write by hand.
  - [con] two points with the same bold subject cannot be told apart.
  - Why recommended: the shortest format that reads well and that a human can write in an editor.
- **B. A quote of the point's first line, then the comment.**
  - [pro] the comment carries its full context.
  - [con] long notes, and a quote that drifts if the point is reworded.
- **C. A paragraph, `On "Undoing a completion": keep the undo, but ask first.`**
  - [pro] reads as prose.
  - [con] harder to scan than a list, and no different to find.

**Answer:**

## Q6: Should adding an image still save its field at once?

The image attachments feature, implemented but not merged, saves the notes as typed and saves an
answer as soon as an image is added to its comment (its rulings R49 and R64), so the image's file
and its link stay together. Both contradict saving only on a button. This feature would be built
after it merges, as the priorities order them. More in
[discovery](discovery-01.md#images-and-explicit-saves).

Why it matters: it decides whether images are an exception to the rule.

- **A (recommended). An image is uploaded at once, but its link waits for the field's Save, like
  typed text; an image whose link is never saved is removed at the next commit.**
  - [pro] one rule for every field, images included.
  - [con] an image added and never saved is uploaded for nothing.
  - Why recommended: the leave warning from Q3 already protects unsaved links.
- **B. Adding an image saves its field at once, as image attachments does.**
  - [pro] the image and its link are never apart.
  - [con] an exception: a field saves without its button, with whatever was typed.

**Answer:**

## Q7: Should the comment lag be fixed in the review page, or for the whole UI?

Each keystroke in a review comment redraws the whole spec, because the page holds the comment's text
and nothing in the UI is memoized. React Compiler, now stable, memoizes every component
automatically; enabling it adds an experimental Rust transform or three Babel packages, and changes
the [toolchain](../decisions/toolchain.md). More in [discovery](discovery-01.md#the-comment-lag).

Why it matters: B speeds up every page, at the cost of a new dependency and a decision.

- **A (recommended). Keep the comment's text in its form, and memoize the document's drawing: only
  the form redraws as you type.**
  - [pro] no dependency, and the cause is removed where it is.
  - [con] other large pages keep the same risk, fixed one by one.
  - Why recommended: it fixes the reported lag with no new dependency.
- **B. Enable React Compiler for the whole web UI, with a change to the toolchain decision.**
  - [pro] every page benefits, without hand-written memoization.
  - [con] a new dependency, experimental through the Rust transform, and a build that may change
    behaviour subtly.

**Answer:**

## Settled without the human

- **The notes field keeps what you type** while it differs from what was last saved, and takes the
  file's text only when it has no unsaved change, as a question's comment does already. This removes
  both causes of lost letters. See [discovery](discovery-01.md#notes-that-lose-letters).
- **The notes no longer show among the settled points**: the core ends the settled section at the
  **Notes:** line, so no rule of the file's structure goes into the UI, as the
  [stack](../decisions/stack.md) decision requires. See
  [discovery](discovery-01.md#notes-shown-twice).
- **The lag after tapping a block or pressing "Add comment"** is fixed too: a new comment shows
  under its block at once, marked "saving…", and its text comes back in the form if the save is
  refused. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **A settled point takes a comment the way a spec's block does**: tap it, and the same comment form
  opens under it on a wide screen, or in a sheet on the phone, one point per comment. See
  [discovery](discovery-01.md#where-comments-on-settled-points-show).
- **A comment on a settled point is saved by its "Add comment" button**, added to the notes in the
  file, and to the notes field's text, leaving the rest of what you typed in that field unsaved. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Ctrl/Cmd+Enter saves a multi-line field, and Enter a line**, as in GitHub, GitLab, and Linear;
  Enter alone adds a line in a multi-line field. It is the field's own key, not a page shortcut. See
  [discovery](discovery-01.md#needs-no-choice).
- **Cancel, or Escape, on changed text asks first**, "Discard" or "Keep editing", as NN/g advises
  for destructive actions. See [discovery](discovery-01.md#needs-no-choice).
- **A comment left open when you press a verdict** stops the verdict, with "Add or cancel your
  comment first": it would change what the verdict means. See
  [discovery](discovery-01.md#needs-no-choice).
- **Each field shows "Unsaved changes" next to its Save button** while its text differs from the
  file, and Save stays disabled while nothing changed, as "Save comment" does today. Primer advises
  never disabling Save; the status line says why it is. See
  [discovery](discovery-01.md#saving-patterns-in-design-systems).
- **Toggles, segmented controls, and switches keep saving at once**, like the discovery effort or
  the risk tier: Primer allows it for such controls, and the proposal is about text. See
  [discovery](discovery-01.md#saving-patterns-in-design-systems).

**Notes:**
