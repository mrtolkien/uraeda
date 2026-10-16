---
verdict: approved
commit: c5a811d
---

# Review: Spec, Redesign sidebars and global interface

## C1: Line 94, under "US2: The sidebar shows the hierarchy (P1)"

> [The sidebar, unfolded](/packages/web/src/sidebar/Sidebar.stories.tsx#Unfolded)

Story Sidebar.stories.tsx#Unfolded, link “Priorities12”: In priorities the count should be the "Now"
count

## C2: Line 131, under "US3: Fold and resize both sidebars (P2)"

> [The right column, shown](/packages/web/src/layout/SideColumn.stories.tsx#Shown)

Story SideColumn.stories.tsx#Shown, complementary “Progress”: The right sidebar is not resizable, I
guess it's expected for a mockup?

## C3: Line 133, under "US3: Fold and resize both sidebars (P2)"

> [The right column, hidden](/packages/web/src/layout/SideColumn.stories.tsx#Hidden)

Story SideColumn.stories.tsx#Hidden, button “Show progress”: Pay special attention to the
fold/unfold button not moving between the two states: it is a bit jarring at the moment

## C4: Line 184, under "US5: Clear feedback on git writes (P2)"

> [A card while its answers commit](/packages/web/src/sidebar/Sidebar.stories.tsx#Committing)

Story Sidebar.stories.tsx#Committing, element: Because of the `...` appearing on hover, the card
size changes on hover: this is a big no-no and looks terrible.

I guess the `...` should just always be visible.

## C5: Lines 274–275, under "US8: Rename and colour a feature (P3)"

> A "…" on a card, shown under the pointer, opens "Feature settings": its name in the sidebar and
> its colour, kept by the server for the repository.

As said above, let's have the ... always visible. You can use an icon too, muted.
