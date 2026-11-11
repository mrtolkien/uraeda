# Priorities

## Now

> [!NOTE]
>
> The features worked on today

- [Keyboard navigation](/specs/2026-10-14-keyboard-nav/proposal.md)
- [Due date reminders](/specs/2026-10-18-due-reminders/proposal.md)
- [Calendar view](/specs/2026-10-21-calendar-view/proposal.md)
- [Leader key/shortcut map](/specs/2026-10-21-leader-key/proposal.md)
- [Leader key/shortcut map](/specs/2026-10-19-leader-key/proposal.md)
- Bulk edit for tasks: select several with the keyboard or a drag, then change their due date, labels, or project at once, with a single undo for the whole batch
- Drag to reorder subtasks
- Quick add from the keyboard
- Undo for deleted tasks, kept for thirty days in a trash that can be searched, and restored with their subtasks and comments
  - the trash empties itself, and says when it will, so that nothing is lost without a warning on a phone that was offline the whole month
- Subtasks that repeat with their task

## Next

> [!NOTE]
>
> What comes once Now is done

- Task templates
- Natural-language due dates, so that "every other Friday until the end of the quarter" becomes a repeating task with an end date, and the parsing is shown before the task is saved
- Offline mode
  - with a queue of the changes made meanwhile, which a conflict with another device's can neither lose nor silently overwrite
- Attachments on tasks
- A weekly review page

## Later

> [!NOTE]
>
> Ideas for one day, and what waits on another line

- Calendar sync with Google and Apple, both ways, so that a task dragged on the calendar moves its due date and an event moved in the calendar moves the task
- [Shared lists](proposals/shared-lists.md)
- Team workspaces
  - after sharing lists, with roles for who may edit, who may only comment, and who is only told when a task is done
- Time tracking
- A public API
- Import from other task apps, keeping the labels, the due dates, the repeats, and the comments each one has, and listing what could not be kept before anything is written
