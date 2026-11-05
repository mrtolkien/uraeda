# Semi-wide screens

From 768 to 1279 px: a desktop window at half a screen, a tablet. Most views take their wide shape
here, with less room, and two things change.

## The sidebar is a rail

The shell's sidebar is a rail of icons, one per place and card, all 20 px on one axis. It unfolds
over the page on hover, on `[`, or on a tap, wide enough to read (about 400 px), and folds back when
the pointer leaves. Unfolding never moves the page or the rail's icons: the open sidebar is drawn
over them, clipped to the rail, then grows.

## The page shares its room

- The side column sits beside the page, at 400 px, where the page keeps a reading pane beside it.
  Where it would not, the column is a rail of its tabs' icons, the open tab's picked, and the page
  keeps its reading pane: the rail opens over the page, without moving it, on hover, on a tap, or on
  `]`, and folds back when the pointer leaves, or on `]` or Escape. "Hover should also work." A
  session's column stays beside its page.
- The status line shows the page's hints, and the counts when they fit; where they do not, the
  counts go first, then the hints past the line's end.
- A question's card keeps one column below its [split width](reading.md#the-scale-of-widths).
- The Git page is laid out as lazygit, over the whole window: its sections a column of two fifths of
  the room, 20rem at least and 36rem at most, each row one line cut by an ellipsis, a commit's
  naming its hash alone; Merge beside the title, the sync buttons on one line under the branch's
  line, and a group's Commit under its message. The detail, a diff or a commit with its hash and
  age, takes the rest to the window's edge, and its height down to the status line, scrolling on its
  own; its title is one line, a path's folders cut at their start before the file's name, the whole
  in a tooltip. Wide screens keep the same shape.

## Everything else is wide

Keys, hints, hover, popovers, dialogs, and the leader menu behave as on [wide screens](wide.md).
