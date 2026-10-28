# Open questions

Where the direction is not settled yet. Each is the human's to answer; once answered, its rule moves
into the guide it belongs to, and the item goes.

## Asked again, in plainer words

- **Which keys the status line hints.** The status line at the bottom shows a few keys as hints,
  such as `o add below` and `v view`, not every key that works. It leaves out three kinds: keys that
  work on every page (`b` back, `Ctrl+D` half a page down, `gg` the top), a second key for an action
  already hinted (`a` adds as `o` does), and the moves (`j k h l`). Is that the rule, or should some
  of them show?
- **One look for the phone's sheets.** On the phone, three kinds of panel rise from the bottom:
  - a dialog's, such as a confirmation or "Add a note": a title on top, and a Close button;
  - a picker's, such as `Space Space` or a note's category picker: a filter field and its list, with
    no title and no Close;
  - a menu's, Astryx's, for the `…` of a session's or a feature's header: a plain list of actions.

  Should all three get the dialog's title and Close?

## New, from this pass

- **Mockups in a one-column question card are smaller.** A pane of prose is now as wide as about 80
  characters (about 750 px), and a question's card of one column as wide as one pane, so a mockup's
  live window inside it is drawn at about half its size (it was about 60%). Should a card holding a
  mockup be wider than one pane?
- **A note with a draft, added to another draft.** A note whose text is a draft can no longer go
  under another note or a priority line, since its draft is found by its link. It can still be added
  to another draft's "What", where one draft then links another from inside its text. Allow it, or
  keep such a note out of the drafts too?
- **A note's images.** A note with images shows "1 image" on its row, and its images under the row,
  over the page, while the row is selected, by the keys, a tap, or the mouse's hover. The inbox's
  record had a thumbnail on the row itself. Is the mark enough?
- **Glass in the light theme.** The glass lies over the page's own colour, so the text under it
  fades in both themes: darker in the dark theme, lighter in the light one. Should the light theme's
  glass be darker too, at the cost of the contrast of its own dark text?
- **The round's phone inset** stays tighter than the spec's, which the plan, document, and data
  model pages now follow. Should the round follow the spec too?

## Directions, not urgent

- **One way to move an item.** A priority's section is changed with a segmented control, a new
  note's category with a selector (your next change), and a note's category with a picker (`c`); the
  priorities have no `c`. One picker for all of them, the note's, is the direction you liked: should
  the priorities get `c` with it?
- **Counts.** A count is drawn four ways: a pane's or a group's title (`Inbox · 10`), a badge (the
  sidebar's `10`), and plain text ("10 notes to organize"). A rule could be: `· N` in any titled
  box, a badge only in the navigation. Fine?
- **Home** and **Settings and sign-in** wait for their own review.
