---
verdict: approved
commit: 93735f7
---

# Review: Spec, Redesign home, inbox, and priorities

## C1: Lines 32–33, under "Spec: Redesign home, inbox, and priorities"

> > - This branch starts from before basic security: the plan's first task merges the default
> >   branch. Your local `main` and `origin/main` have diverged, so settle which one is the default
> >   first.

Should be converged again, make sure you rebase from main.

## C2: Line 51, under "US1: Open and edit an entry from its pane (P1)"

> [A priority's pane, editing](/packages/web/src/pane/EntryPane.stories.tsx#Editing)

Story EntryPane.stories.tsx#Editing, element: The BODY ("What" and "Why) should be editable when
"Edit" is picked

This is the most important

## C3: Line 78, under "US1: Open and edit an entry from its pane (P1)"

> [A note's pane](/packages/web/src/pane/EntryPane.stories.tsx#Note)

Story EntryPane.stories.tsx#Note, element: Just show a counter without text + align it vertically
with Inbox. Put the "organize with an agent" at the right, separated

## C4: Lines 110–111, under "US3: Add and commit from ＋ (P1)"

> The ＋ forms next to Priorities and Inbox in the sidebar have "Add and commit", the default on
> Enter, beside "Add". "Add and commit" commits that file alone.

Put an enter icon in the button on desktop: ↵

## C5: Line 85, under "US2: Move through a list with the keyboard (P1)"

> [The priorities, a row selected](/packages/web/src/lists/WorkList.stories.tsx#Selected)

Story WorkList.stories.tsx#Selected, desktop, element: This keyboard shortcut hint is too big and
eats up too much space, and it's useless on mobile.

Remove the hint entirely for the moment, and create a "Next" task for keyboard navigation which also
will include discoverability

## C6: Line 147, under "US4: See what is running and drafted in the priorities (P2)"

> [The priorities](/packages/web/src/lists/WorkList.stories.tsx#Priorities)

Story WorkList.stories.tsx#Priorities: The running features should be in a separate category
visually. They can stay in the same part in the file, but in the web UI do a separate "Ongoing" or
"Working" category at the top.

Also make the view more compact, we should see more features than right now: it's too spaced out on
desktop + too tall on mobile.

Also remove most of the side borders on mobile: this is extremely hard to read for multiline text.

## C7: Line 173, under "US5: Organize the inbox like the priorities (P2)"

> [The inbox](/packages/web/src/lists/WorkList.stories.tsx#Inbox)

Story WorkList.stories.tsx#Inbox: Same comments as priority on the compactness and mobile view

## C8: Line 249, under "US8: Read the constitution and decisions (P3)"

> [The decisions](/packages/web/src/decisions/DecisionsPage.stories.tsx#List)

Story DecisionsPage.stories.tsx#List: Maybe we can add icons to decisions, as front-matter?

I realize this is a format change, but it'd be optional and easy to backfill here for Uraeda, and it
will make the page look much better.
