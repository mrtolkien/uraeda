---
verdict: changes-requested
commit: 26ed37b
---

# Review: Spec, Inbox and priorities in the terminal look

## C1: Line 22, under "Spec: Inbox and priorities in the terminal look"

> > - A section's context is the first `> [!NOTE]` callout under its heading, read-only in the app.

Allow any type of callout, even if you show them all the same way

## C2: Lines 56–60, under "US1: Priorities as columns (P1)"

> The priorities page shows Ongoing, Now, Next, and Later as titled panes side by side, each with
> its context under its title. Every line is a small card with its whole text wrapping. Columns are
> at least 300 px wide, so on a half screen the row scrolls sideways and Later may be cut at the
> edge. On the phone the same panes are stacked, one column. A line is dragged from anywhere on its
> card, with no handle. Under the title, one line says what the page is for.

300px is not enough if that's what's in the mock. With all the border, it's really hard to read
since only ~4 words fit per line.

Let's do 400px.

Also don't forget that panes have information on their border: the "spec", "questions", "draft" info
you have should not be words at the beginning/end but part of the frame border

## C3: Lines 136–139, under "US4: A line in an overlay (P1)"

> Enter or a click on a card opens that line in an overlay over the page, with its actions, Previous
> and Next, and Close. On every width but the phone it is a dialog about 70 characters wide, over
> the dimmed page. On the phone it is a bottom sheet. The URL is the line's, so reload and Back keep
> it: Back closes it. The list's selection does not open it.

Make the overlay a bit bigger, 50% bigger both width and height

## C4: Lines 183–184, under "US6: Categories you create, rename, and delete (P2)"

> "New category" adds an empty pane. A pane's title is renamed in place, and its menu deletes it.
> Deleting asks "Delete the N notes too?". No keeps them, in order, under No category.

Yes/No/Cancel should be separate lines and easy to click (border/button) + show a shortcut (Y/N/C)
