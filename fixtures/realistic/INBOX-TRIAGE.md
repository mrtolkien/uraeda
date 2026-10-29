---
status: awaiting-human
---

# Inbox triage

> [!IMPORTANT]
>
> 8 questions on 10 notes, about 15 minutes.
>
> - Three changes are offered for five of the six bug notes. Answering them all with a change starts
>   three branches: pick the ones you want now.
> - The reminder email note is about Due date reminders, being built on its branch: its fix waits
>   for the feature to merge.
> - Three notes belong under lines already in your priorities: Quick add from the keyboard, Offline
>   mode, and Calendar sync.
> - Searching archived lists needs a design choice, so it is offered as a new proposal file.

## Context

The inbox holds 10 notes: 3 without a category, 4 under UI, and 3 under Sync. This triage covers
all of them.

For each note, I read the code it names on `main` and searched the commits since the note was
written. I read [PRIORITIES.md](PRIORITIES.md), the proposal file
[Shared lists](proposals/shared-lists.md), the records of the three done features, and the due date
picker's [note file](notes/due-date-picker/note.md), with its screenshot. I also read the open
branches: Due date reminders, being built, Calendar view, whose spec is being written, and the two
Leader key/shortcut map features.

None of the notes is fixed on `main`. Questions group notes that go to the same place, so one change
can carry them. A change's slug is its folder's name without the date, as in `specs/changes/`.

## Q1: Should the three notes on how the task list looks on a phone be one change?

The notes:

- "[run-ui] The count on the Today tab is not centered in its badge"
- "The due date picker hides the task's title on a phone"
- "A task with a very long title pushes its due date out of the row on a phone…"

All three are still present. The picker opens over the top of the screen, so the task it sets a
date for is hidden: the note file's screenshot shows it. A long title wraps on the desktop, where
the row keeps its date beside the first line, but not on a phone. The badge's count is off by a
pixel or two, a one-line fix.

Why it matters: on a phone, a hidden title or a hidden date is how a date gets set on the wrong
task.

- **A (recommended). Start one change, from a new proposal file "Task list fixes on phones" with the
  three notes, with the slug `task-list-phone`.**
  - [pro] The row, the picker, and the badge are checked together, on one screen size.
  - [con] One more branch to review.
  - Why recommended: all three are small, and they share the task list's layout.
- **B. Start the same change with the two phone notes only, and keep the badge note in the inbox.**
  - [pro] A smaller change, about the phone alone.
  - [con] The badge stays off-center for a one-line fix.
- **C. Keep them in the inbox.**
  - [pro] Nothing to review now.
  - [con] The picker keeps hiding the task it dates.

**Answer:**

## Q2: Should "Dark mode flashes white for a moment when the app opens" be a change?

The note is "Dark mode flashes white for a moment when the app opens".

The page paints once in the light theme before the saved theme is read, then switches. No commit
since the note mentions the theme. The fix is to apply the saved theme before the first paint.

Why it matters: it happens at every start, in the dark, which is when dark mode is used.

- **A (recommended). Start it as a change, from a new proposal file "No white flash in dark mode",
  with the slug `dark-mode-flash`.**
  - [pro] A small fix, seen at every start.
  - [con] One more branch to review.
  - Why recommended: small and contained, and every dark mode user sees it.
- **B. Keep it in the inbox.**
  - [pro] Nothing to review now.
  - [con] The flash stays.

**Answer:**

## Q3: Should the repeating task created twice be a change?

The note is "Two devices that complete the same repeating task at the same time create the next one
twice".

Completing a repeating task creates its next one on the device that completed it, and the two
devices each send theirs. Nothing merges them. Offline mode, in **Next**, plans a queue of changes
that "a conflict with another device's can neither lose nor silently overwrite". It is not started.

Why it matters: a duplicate task is a wrong list, and every repeat after it is duplicated too.

- **A (recommended). Start it as a change, from a new proposal file "Complete a repeating task once
  across devices", with the slug `repeat-once`.**
  - [pro] Duplicates stop now, before Offline mode.
  - [con] Offline mode may later redo the same merge in its queue.
  - Why recommended: it corrupts lists today, and each duplicate repeats.
- **B. Move the note under the Offline mode entry of Next.**
  - [pro] Every conflict between devices is designed once.
  - [con] Duplicates continue until Offline mode is built.

**Answer:**

## Q4: Where should "The reminder email arrives an hour late…" go?

The note is "The reminder email arrives an hour late when the due time is set in another time zone
than the phone's".

Reminder emails come from the feature in progress, Due date reminders, on its branch: task 7 of 11
is being built. `main` sends no reminder yet, so a change started from `main` has nothing to fix.

Why it matters: a reminder an hour late is a missed reminder, for anyone who travels.

- **A (recommended). Keep it in the inbox until Due date reminders is done, for the next triage.**
  - [pro] The fix starts from the merged code.
  - [con] It waits a few days in the inbox.
  - Why recommended: the code it is about exists only on the feature's branch.
- **B. Start it as a change now, from a new proposal file "Reminders in the due date's time zone",
  with the slug `reminder-time-zone`.**
  - [pro] Not forgotten.
  - [con] Its branch waits for the feature to merge before it can change anything.

**Answer:**

## Q5: Should the replay after a long time offline go under Offline mode?

The note is "[agent] After a long time offline the app replays every change at once…".

An agent left it in a final review. Today the app sends the changes made offline all at once when it
reconnects. Offline mode, in **Next**, already plans "a queue of the changes made meanwhile". Small
batches and a progress line are how that queue would be sent.

Why it matters: a frozen app after a flight looks like a crash.

- **A (recommended). Move the note under the Offline mode entry of Next.**
  - [pro] The queue is designed once, with its batches.
  - [con] The freeze stays until Offline mode is built.
  - Why recommended: the note describes how that queue should behave.
- **B. Start it as a change, from a new proposal file "Replay offline changes in batches", with the
  slug `offline-batches`.**
  - [pro] The freeze ends sooner.
  - [con] Offline mode may replace the replay it fixes.

**Answer:**

## Q6: Where should "The calendar sync should not touch tasks that have no due date" go?

The note is "The calendar sync should not touch tasks that have no due date".

Calendar sync with Google and Apple is in **Later**, not started. Calendar view, whose spec is being
written, draws the due dates in the app and syncs nothing.

Why it matters: a rule for sync is lost if nobody reads it when sync is designed.

- **A (recommended). Move the note under the Calendar sync entry of Later.**
  - [pro] Read when sync is designed.
  - [con] Later may wait a long time.
  - Why recommended: it is a rule of that entry, and of no other.
- **B. Delete it.**
  - [pro] The inbox gets shorter.
  - [con] A task without a date could get a calendar event of its own.

**Answer:**

## Q7: Where should "The empty state of a new list has no way to add a first task…" go?

The note is "The empty state of a new list has no way to add a first task from the keyboard".

[Keyboard navigation](done/2026-10-14-keyboard-nav.md), done on October 18, moves between tasks, so
an empty list has nothing to move to. Quick add from the keyboard, in **Now**, is the shortcut that
adds a task from anywhere.

Why it matters: a new list is where the keyboard is first tried.

- **A (recommended). Move the note under the Quick add from the keyboard entry of Now.**
  - [pro] Quick add covers the empty list with the rest of the app.
  - [con] It waits for that feature.
  - Why recommended: the shortcut it asks for is the one Quick add makes.
- **B. Start it as a change, from a new proposal file "Add a first task from the keyboard", with the
  slug `empty-list-keys`.**
  - [pro] Fixed sooner.
  - [con] Quick add may replace the key it adds.

**Answer:**

## Q8: Where should searching archived lists go?

The note is "Searching for a task by its label should also find the tasks of the lists that are
archived…".

[Task search](done/2026-10-12-task-search.md), done on October 17, searches the lists in use only.
The note asks for archived lists too, marked, without burying the results that matter. How to mark
them, and where they rank, are choices to ask you about first.

Why it matters: a task in an archived list is found today only by unarchiving its list.

- **A (recommended). Make a new proposal file, "Search archived lists", with the note, linked from
  the end of Next.**
  - [pro] Its round of questions settles how archived results show.
  - [con] It waits behind Now.
  - Why recommended: it needs design choices, which a change does not ask for.
- **B. Start it as a change, from a new proposal file "Search archived lists", with the slug
  `search-archived`.**
  - [pro] Ships sooner.
  - [con] The agent picks how results show, without asking.

**Answer:**

**Notes:**
