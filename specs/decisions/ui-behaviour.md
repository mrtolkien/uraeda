---
status: active
approved-by: mrtolkien
icon: mouse-pointer-click
---

# UI behaviour

The web UI acts on things where they are: a row is tapped as a whole, a small edit happens in place,
and status shows next to what it is about. Overlays are kept for short forms and for confirming what
cannot be undone, a toast confirms only what cannot be seen, and leaving a page and coming back
keeps the human's place. Text is saved only by a button or the field's own key, unsaved text is kept
in the browser and never left without asking, and every multi-line field has a fixed height. A git
write shows at once on its button and its item's card, and blocks the other writing buttons until it
ends; the UI never guesses a status.

## Rules

- A row that leads somewhere MUST be tappable as a whole, not only through a button or a chevron.
  Checked by the UI tests.
- A small edit, like a line's text, MUST happen in place: Enter or its Save button saves, Escape or
  its Cancel button cancels. Leaving the field MUST NOT save it: it stays open with its text.
  Checked by the UI tests.
- A text field MUST save only when the human presses its Save button, its own key (Enter in a
  one-line field, Ctrl+Enter or Cmd+Enter in a multi-line one), or a button that uses its text, like
  Add comment, Submit, Commit, Start, or a verdict. It MUST NOT save as it is typed, after a pause,
  or when it loses the focus. Adding an image to a field MAY save that field at once, with its text
  as typed. Toggles, switches, segmented controls, and option picks MAY save at once. Checked by the
  UI tests.
- A text field whose text differs from what is saved MUST say "Unsaved changes" next to its Save
  button. Its Save button MUST be disabled while nothing changed. Checked by the UI tests.
- Cancel or Escape on a field whose text changed MUST ask first, with "Discard" and "Keep editing".
  Checked by the UI tests.
- Leaving a page that holds unsaved text MUST ask first: the app's own dialog, "Leave page" and
  "Stay", for a link or Back, and the browser's prompt for a reload or a closed tab. Nothing MUST
  ask when nothing is unsaved. Checked by the UI tests.
- The unsaved text of every field MUST be kept in the browser until it is saved or discarded, and
  restored when the field shows again, with a notice saying so and a Discard button. Checked by the
  UI tests.
- Every multi-line text field MUST have a fixed height, set by what it holds, a little larger than
  its usual text, and the same wherever that kind of field appears: 20 rows for the editor of drafts
  and proposals, 12 for notes, 7 for every comment and summary, and 3 for a line that may wrap. A
  field MUST NOT grow or shrink with its text: past its height, it scrolls. It MAY keep the
  browser's resize handle, for the human to drag it taller. The chat composer is the one exception:
  7 rows, it MUST grow upward with its text up to 20 rows, then scroll. Every multi-line field
  except the chat composer MUST use the app's one text area. Checked by the UI tests.
- A modal sheet or dialog MUST be used only to confirm an irreversible action or to fill a short
  form, like adding a line. Everything else happens in the page. Checked by review.
- Every sheet and dialog MUST have a visible close button, and Back MUST close it. Checked by the UI
  tests.
- A save's status MUST show next to its control: saving, saved, or the error. Checked by the UI
  tests.
- A button that writes to git, by committing, starting a feature or a change, or changing a branch,
  MUST say what it does at once, like "Committing…", with a spinner beside its label, until its
  write ends. While any git write runs, every other button that writes to git, in the page and in
  the sidebar, MUST be blocked and stay focusable, and a thin bar MUST run at the top of the page.
  Reading and navigating MUST stay usable. Checked by the UI tests.
- A write or a run's start that concerns a feature or a change MUST show that action on its sidebar
  card at once, until the server's status for it changes or 10 seconds pass. The UI MUST NOT guess
  an item's next step or status: the core decides them. Checked by the UI tests.
- A toast MAY confirm only a result the human cannot see on screen. It MUST last 5 seconds, MAY
  carry one action, Undo, which reverts that change alone, and MUST NOT be the only place an error
  shows. Checked by the UI tests.
- Errors MUST stay on screen until the human deals with them, or the action is retried. Checked by
  the UI tests.
- Back MUST return to the same scroll position and the same open items. A page MUST keep showing its
  content while its data reloads. Checked by the UI tests.
- Nothing MUST work only on hover: every action has a tap or a keyboard path. A control shown on
  hover MUST also show while it or its row has the keyboard's focus, and always under a pointer that
  cannot hover. Checked by the UI tests.
- A keyboard shortcut MUST NOT act while a text field has the focus. A field's own keys, Enter and
  Ctrl+Enter or Cmd+Enter, are not shortcuts. Checked by the UI tests.
- Opening an item of a list, by a click, a tap, or a key, SHOULD NOT put the focus in a text field:
  taking keyboard focus should be deliberate and clear to the user.
- A list whose rows open a pane MUST move its selection from the keyboard: ↑ and ↓, or j and k, to
  the next or previous row, with the pane following on wide screens; Home and End to the first and
  last row; Enter to edit the selected item, or to open it when it has nothing to edit; Escape to
  close an open field, then the pane. The selected row MUST look different from the focused one.
  Checked by the browser tests of each list.

## Why

The proposal's problems are behaviour as much as looks: a one-word edit behind a modal, a
confirmation taking the top bar's place, a reading position lost on Back
([proposal](../done/2026-10-12-ui-improvements.md)). Design systems answer each with a rule: modals
only when needed (NN/g, Atlassian), status inline and short toasts (Pajamas), a visible close and
Back on sheets (NN/g), state that survives navigation (Vercel)
([Q3](../done/2026-10-12-ui-improvements.md#q3-which-rules-should-govern-how-the-ui-behaves),
[how the UI behaves](../done/2026-10-12-ui-improvements.md#q3-which-rules-should-govern-how-the-ui-behaves)).

Text is saved only on a button: notes saved as they were typed lost letters, because each save came
back trimmed into the field, and a line saved on blur saves half-typed text; the human asked for
every text field to save only with a button, lines on Enter or a Save button
([Q1](../done/2026-10-14-text-inputs.md#q1-which-text-fields-should-save-only-with-a-button),
[which fields](../done/2026-10-14-text-inputs.md#q1-which-text-fields-should-save-only-with-a-button)),
and Primer recommends explicit saving for text. Saving on a button puts unsaved text at risk, so the
human asked for both a warning before leaving and text kept in the browser, like GitHub
([Q3](../done/2026-10-14-text-inputs.md#q3-what-protects-text-you-typed-and-did-not-save),
[unsaved text](../done/2026-10-14-text-inputs.md#q3-what-protects-text-you-typed-and-did-not-save)).
Images keep saving their field at once, so an image and its link are never apart
([Q6](../done/2026-10-14-text-inputs.md#q6-should-adding-an-image-still-save-its-field-at-once)).
The human found text boxes taller than their text, asked for one coherent behaviour everywhere
([notes](../done/2026-10-14-text-inputs.md)), and then for fixed heights by kind of field, since
fields that grow move the page's layout as the human types (the review of the
[spec](../done/2026-10-14-text-inputs.md)).

commits take seconds while the hooks format files, and the human asked for "EXTREMELY CLEAR
feedback" on every button that works in the background; they chose a spinner with the action's name
and every other writing button blocked, over graying out the whole page
([Q9](../done/2026-10-16-redesign-interface.md#q9-what-does-a-button-that-writes-to-git-show-while-it-runs),
[feedback for git writes](../done/2026-10-16-redesign-interface.md#q9-what-does-a-button-that-writes-to-git-show-while-it-runs)).
They asked for the sidebar to change at once, and chose to show the action rather than a guessed
status, which would copy the workflow's rules into the browser against the [stack](stack.md)
decision ([Q10](../done/2026-10-16-redesign-interface.md#q10-how-do-optimistic-statuses-work)). The
"…" and the fold button show under the pointer, as the human asked, and stay reachable without one
([Q5](../done/2026-10-16-redesign-interface.md#q5-what-does-hiding-a-sidebar-do)).

A click on a priority opened its pane, a click on its text opened the field, and Enter saved: the
human asked for "one click to open the pane, one click to edit", with a pane that "shows markdown
and does not steal focus", and for ↑ and ↓ to move through the list when no text field has the focus
([Q4](../done/2026-10-16-redesign-priorities.md#q4-what-does-a-click-on-a-priority-or-a-note-open),
[Q6](../done/2026-10-16-redesign-priorities.md#q6-which-keys-move-through-the-list)). Linear,
Todoist, and Gmail move a highlighted row with these keys, and the accessibility guidance asks for
focus and selection to look different
([keyboard navigation](../done/2026-10-16-redesign-priorities.md#q6-which-keys-move-through-the-list)).

## Alternatives considered

- The same rules with no toasts at all, as Primer advises for accessibility: confirmations from
  another page then have nowhere to show, and Undo no place to live.
- Text areas growing with their text, measured, up to half the window: no empty rows, but the page
  moves under the human as they type.
- Lines saving on Enter or blur, the earlier rule: a tap elsewhere saved a half-typed line.
- Notes and the editor saving 400 ms after the last keystroke: the field took the file's trimmed
  text back while the human typed.
- A click opening the field with the cursor in it, the earlier behaviour of the priorities' pane:
  one click less to edit, but the arrow keys moved the cursor, not the selection, until the field
  was left.

## Consequences

- Undo in a toast goes against Pajamas' "no actions in toasts"; it is limited to the change just
  made, and Discard still covers every uncommitted change.
- Every page needs its own scroll restoration once its data has drawn, through the shared router.
- Short forms may still be modal, which keeps ＋ quick to reach on any width.
- Every field that saves text goes through one shared hook, which holds its unsaved text, keeps it
  in the browser, and tells the router whether a page may be left.
- A line left open stays open until it is saved or cancelled.
- Text typed on one device is restored on that device only.
- Every button that writes to git goes through one shared record of writes in flight.
- Two git writes never start from the UI at once, even in different repositories' pages of one tab.
- A card says "Committing…" for up to 10 seconds, then the server's status, whatever it is.
- Every list with a pane, the priorities, the inbox, and the decisions, and those to come, shares
  one keyboard behaviour, and an agent adding a list gets it from the shared list rather than
  writing its own.
- Editing a line takes one more click than a field opened on arrival, and reading never risks a
  keystroke landing in a field.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
