---
status: active
approved-by: mrtolkien
icon: undo-2
---

# Undo

Every edit the human makes to their lists and texts can be taken back with one key, in the order it
was made, for as long as the tab stays open. Only what loses work for good asks first, so a question
still means danger. An undo never touches git's history: it writes the reverse, which waits on the
Git page like any edit.

## Rules

- Every edit to the human's lists and texts that waits on the Git page MUST be undoable: the inbox,
  the priorities, proposal files, categories, images, and comments. Checked by the UI tests.
- An action that can be undone MUST NOT ask to confirm it first.
- An action that loses work for good, with no undo, MUST ask first through the shared confirmation.
- `u` and `Ctrl+Z` MUST undo, and `U` and `Ctrl+Shift+Z` redo, the tab's latest action, outside text
  fields. Checked by the UI tests.
- The stack MUST keep the tab's last 50 actions, until the tab reloads or closes.
- An undo MUST NOT commit, revert, or rewrite git's history: it writes the reverse as a change.
  Checked by the core's tests.
- An undo of an action committed since MUST ask first.
- An undo MUST be refused, with its reason next to what it concerns, once what it would restore
  changed since. Checked by the core's tests.
- An undo MUST take the human to where the action happened, with what came back selected.
- Committing, starting, git, and settings actions MAY run at once without an undo, their button
  naming what they do.

## Why

An undo the human can count on lets edits happen in one key, without a question each time: a
confirmation asked for every write gets clicked through unread. Committing and starting actions hand
work to git and the agent, which an undo cannot take back safely. Git stays the backstop, and the
human's commits stay theirs. History: [Global undo](../done/2026-11-07-global-undo.md).

## Alternatives considered

- An undo that lasts as long as its toast: gone before the human notices the slip.
- A question before every action without undo: about 25 questions, soon answered without reading.
- Committing actions undone by a revert commit: an agent may already have acted on the commit.

## Consequences

- A new write to the human's files ships with its reverse, or the UI tests fail.
- A mistaken Approve or Submit is fixed by its own next step, like requesting changes.
- A reload empties the stack: what it held stays in the files and on the Git page.
- On the phone, the toast's 5 seconds stay the only way to undo.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a write the human makes
- [`crates/core/`](/crates/core/)'s writes to the inbox, the priorities, proposals, and comments
