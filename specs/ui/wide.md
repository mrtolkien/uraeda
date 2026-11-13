# Wide screens

From 1280 px: a full desktop. The keyboard is at hand, the pointer too, and there is room for the
page and its companions side by side.

## The frame

- **The sidebar** on the left, open, about 14% of the window and resizable, or folded to the rail
  with `[`, unfolding over the page on hover as on [semi-wide screens](semi-wide.md).
- **Unfold**, folded, the rail's first button, above Commit and New: its icon alone in the rail, its
  name too once the rail opens over the page. A click or a tap unfolds the sidebar, as `[` does. Its
  room opens and closes as the sidebar's width eases, so the rows under it glide, never jump.
- **The page** in the middle of the room right of the sidebar, as if the side column were closed, as
  far as the room allows: the home's columns sit in the middle of what shows beside the sidebar, and
  a page stays where it is as the side column opens. Each page takes its width from
  [the scale](reading.md#the-scale-of-widths): a document centres its panes, each a reading pane; a
  page of rows keeps a reading pane's text column; a round's split question card holds the question
  beside its answers, at a split card's width. The round's context stays one pane wide, its parts
  one under the other: "put them back one by one".
- **The decisions page** puts its list and its reader side by side only where the list shows about
  40 characters a line and the reader 60; narrower, the list is the page and what is open is a page
  of its own, at the reading measure. The reader grows first, to 80 characters, then the list, to
  60, and the two are centred together, as a page is. The constitution is one page, at
  `/decisions/constitution`.
- **The side column** on the right, for a document's or a session's companions, 400 px until
  dragged, foldable with `]`, resizable, its tab in the address.
- **The status line** at the bottom, in LazyVim's shape: the Vim mode while it is on, the branch a
  page names, `Space menu`, `[ ] fold`, then the page's hints in the order they are used, each one
  clickable, then the counts of what needs the human and what runs.

## Pages of columns

The priorities are a page of columns, one per section, each 360 px at least, so the four fit a 1920
px window beside the sidebar, taking the window's whole width, or, at the human's choice with `v`,
one centred list, its text column a reading pane, as on every page of rows. The switch is the
human's, not a breakpoint's: "Instead of doing the switch ourself it should simply be up to the
user." Moving the selection across columns glides the view sideways to it.

## Layers

- **Popovers** for menus, anchored to what opened them.
- **Dialogs** for the shared confirmation, short forms, and pickers, centred.
- **The leader menu** in the bottom right, over the page, in the phone bars' frosted glass, rising
  from the bottom, its frame easing to each group's size.

## The pointer

- Hover brightens what can be pressed, as a whole, and moves a list's selection to the row under the
  pointer.
- A click selects; a click on the selected row, or a double click, edits it.
- Rows drag to reorder, and sideways to nest, with the dragged row's children.
- Hover is never the only way: everything hovered can be reached by a key and by a tap.

## macOS

The app on a Mac is the wide screen above, with the rule the [iPhone](phone.md#ios) follows, taken
from Apple's guidelines for Liquid Glass: **what navigates and what the system draws floats in the
system's glass, and what is read stays Uraeda's**. The glass is the system's, rounded, and used for
the window's controls and the overlays alone: never in a pane, never one piece over another. The
panes keep their square corners, their titled borders, and their type ("it needs to look MacOS
native with the current vibe"). [`app/ui/native.ts`](/app/ui/native.ts) says whether the app runs
there, and [`app/ui/layout/macBars.tsx`](/app/ui/layout/macBars.tsx) draws the toolbar.

- **The window has no title bar of the system's**: the page goes up to the window's top edge, and
  over it, in the bar's room, a toolbar with no background, as macOS 26 draws an app's. On its
  leading side, after the window's buttons, the sidebar's toggle on its glass, then the repository's
  name, which opens the switcher, on no glass: a title is no control. On its trailing side Find and
  New, on one piece of glass, as the system groups a toolbar's buttons. Its empty room moves the
  window, and a double click there zooms it; a page without the frame, as the server's start, keeps
  that room at its top.
- **The rail's pane is the places'**, titled "Places", with no toggle of its own: the toolbar holds
  the repository's name and the sidebar's toggle, which nothing repeats.
- **The menu bar holds every command of the frame**, with the Mac's own shortcuts beside the keys
  the app writes out: Settings (`⌘,`), New Session (`⌘N`), New Feature (`⇧⌘N`), Switch Repository
  (`⌘O`), Find Anything (`⌘K`), Toggle Sidebar (`⌃⌘S`), the appearance, Back (`⌘[`), each place
  (`⌘1` to `⌘9`), and the key map (`⌘/`), with the system's Edit and Window menus
  ([`MenuBar.tsx`](/app/screens/shell/MenuBar.tsx)).
- **A menu and a select's list are the system's menu**, opened under what opened them, its rows'
  icons tinted by the menu, a tick on the value held, with the system's keys. The page's keys still
  run every action of a menu.
- **Every other overlay is drawn as the system draws its own**: a dialog, a picker, the key map, and
  the leader menu are the system's Liquid Glass with corners rounded and continuous, a panel's over
  the window as a window's, a popover's and a toast's as a menu's, their title on a row inside them,
  not on a plate over their edge.
- **A confirmation is the system's alert** on the window, its button red where something is lost,
  which Return never presses. One that holds more than words, a list of what it takes, stays the
  app's dialog.
- **The desktop's notifications are the system's**, which asks its owner once; a click opens the
  item's page. The Dock's icon counts what needs the human, as the window's title does.
- **An extension's page runs in a web view**, WebKit's, as on an iPhone.

`just package-macos` makes `Uraeda.app`, with `ura` inside, which it starts as its server when none
runs, in `ura serve`'s data folder, and stops as it quits; the device's token is kept in the login
keychain.
