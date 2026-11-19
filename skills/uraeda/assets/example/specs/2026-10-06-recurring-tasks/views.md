---
status: approved
---

# Views: Recurring tasks

> [!NOTE]
>
> Approved on 2026-10-08.
>
> - You agreed to the repeat menu in the task's edit panel, the row that completes a repeating task,
>   and the custom screen.
> - The menu keeps a check on the current choice, and the custom screen opens from the menu's last
>   entry.

The three views of the [proposal](proposal.md) that users meet, in the project's own look. See the
[discovery](discovery-01.md).

## Views

### The repeat menu, open

[Repeat menu, open](/src/tasks/RepeatMenu.stories.tsx#Open)

A check sits on the current choice, and the repeat icon of the list row follows the choice at once.
A row of eight buttons was drawn as the other variant, and dropped: it does not fit the panel at 360
pixels.

### A repeating task, completed

[Repeating task, completed](/src/tasks/RepeatMenu.stories.tsx#Completed)

The row stays in the list with its new due date, and says so for 5 seconds, with an undo button.

### The custom repeat screen

[Custom repeat screen](/src/tasks/RepeatMenu.stories.tsx#Custom)

Every N days, weeks, months, or years, and, for weeks, the days of the week.

## Persona walk

Walked as a first-time user on a phone, 360 pixels wide, by touch only, with five tasks, one of them
repeating. The walk fixed two things: the "custom" entry sat under the keyboard when the panel
opened with the title focused, and the undo label was cut at the narrowest width.
