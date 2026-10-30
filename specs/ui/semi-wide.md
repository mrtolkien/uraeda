# Semi-wide screens

From 768 to 1279 px: a desktop window at half a screen, a tablet. Most views take their wide shape
here, with less room, and two things change.

## The sidebar is a rail

The shell's sidebar is a rail of icons, one per place and card, all 20 px on one axis. It unfolds
over the page on hover, on `[`, or on a tap, wide enough to read (about 400 px), and folds back when
the pointer leaves. Unfolding never moves the page or the rail's icons: the open sidebar is drawn
over them, clipped to the rail, then grows.

## The page shares its room

- The side column sits beside the page, at its least width, 400 px. It folds only on wide screens:
  here it stays, and the page reads in the room it leaves.
- The status line shows the page's hints, and the counts when they fit; where they do not, the
  counts go first, then the hints past the line's end.
- A question's card keeps one column below its split width.
- What sits in two places on wide screens may share a line here: the sessions page's Usage and Done
  side by side, each half as wide, Done greyed.

## Everything else is wide

Keys, hints, hover, popovers, dialogs, and the leader menu behave as on [wide screens](wide.md).
