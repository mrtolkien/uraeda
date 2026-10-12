---
verdict: approved
commit: 108617d
---

# Review: Spec, UI improvements

## C1: General

We also need to add a way to view mockups from inside the web ui. Right now there's no option for
that.

We should also be able to comment on mockups.

## C2: Lines 36–37, under "Spec: UI improvements"

> > - New drafts keep the line as their title and also under What (Q10 B). `ura start` still refuses
> >   a draft whose Why is empty. `ura draft` and the skill change with the UI.

ura start should accept any proposal, there's no strict proposal.md format.

This is very important: this is the part of the workflow that's the most human-driven, it needs to
be freeform.

## C3: General

Mockups comments:

US1 desktop: Desktop left bar needs to be collapsable + in the mockup the center column is too small
on a half-screen (which is still bigger than 768px, ~1200px).

US3: remove the "move up/move down" from the task view, it's weird without seeing the list it's
acting on.

US4: Actually, tap should open the task view. This way we can remove the "..." and make the view
easier to parse visually. Remove in-place text editing for this. Same for desktop.
