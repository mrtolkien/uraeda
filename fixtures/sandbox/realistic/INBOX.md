# Inbox

- The reminder email arrives an hour late when the due time is set in another time zone than the phone's
- Searching for a task by its label should also find the tasks of the lists that are archived, with a way to tell which ones they are, and without making the results of the lists in use any harder to find
- Dark mode flashes white for a moment when the app opens

## UI

- [run-ui] The count on the Today tab is not centered in its badge
- [The due date picker hides the task's title on a phone](notes/due-date-picker/note.md)
- A task with a very long title pushes its due date out of the row on a phone, where it should wrap to a second line and keep the date visible beside the first one, as the desktop does
- The empty state of a new list has no way to add a first task from the keyboard

## Sync

- Two devices that complete the same repeating task at the same time create the next one twice
- [agent] After a long time offline the app replays every change at once, which freezes it for several seconds, where it should replay them in small batches and show a progress line that the human can leave
- The calendar sync should not touch tasks that have no due date
