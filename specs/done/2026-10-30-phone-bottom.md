---
kind: change
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/70
supersedes: [2026-10-25-feature-page]
---

# Record: Phone bottom bars on more pages

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/70). Its full files are
> in git: `git log -- specs/changes/2026-10-30-phone-bottom/`.

## What and why

On the phone, only the pages with a side column ended with a bottom bar: icon tiles on frosted glass
for the page's companions, then the one action that moves the human forward. The human asked for it
on more pages, the feature page and the pages with one main action, since the bar is where the thumb
is, and puts a page's companions and its next action in the same place everywhere. A bar of one
entry is a single glass button at the bottom right, of two a button in each corner, and of three or
more the bar across the screen.

## Behaviour

- **Every phone bar's shape follows its count**: one tile is a square glass button at the bottom
  right, two are a button in each corner, three or more the bar of glass across the screen. Today's
  bars follow it too: the constitution's reader is one button, a plan with no review two. The page
  under the corners stays usable, and the page's end shows above the buttons, which come back at the
  page's end as the bar does.
- **The feature page**: Produced and Links (while the feature has one), its wide column, each open a
  sheet of their rows; Session, once the feature has one, opens the session's page; then the next
  step, in the accent, does what the Next pane's button and `n` do. The Next pane keeps its button,
  as the human asked. The column is no longer drawn after the timeline on the phone. A figure's jump
  into the page, as to a done feature's questions, closes its sheet first.
- **The draft editor**: a proposal file ends with a single Start button, which opens the Start pane,
  the kind, the slug, and the button, as a sheet, the slug focused (`?tab=start`, closed by Back).
  The pane leaves the body on the phone. A refused start shows its message in the sheet. `s` opens
  the sheet before focusing the slug. A note file and a started proposal have no Start and no bar.
- **The inbox and the priorities**: a single Add button opens their add form, as the
  sidebar's ＋ does.
- **The commit page**, while changes wait: Discard in the left corner, which still asks first, and
  Commit, a save icon, in the accent, in the right one; the buttons under the list leave the page.
  Commit runs as a git write, and both tiles are blocked while any write runs.
- **Wider screens** keep every page as it was.
- **Under a short page**, the page's surface goes on under the status line's row, which the corner
  buttons leave visible.

## Design

[`NavTiles`](/packages/web/src/layout/NavBar.tsx) counts its tiles and draws the shape itself: the
glass moved from the status line's row ([`StatusLine`](/packages/web/src/shell/StatusLine.tsx)),
which no longer takes taps, to the bar `NavTiles` draws, or to each tile when there are one or two.
A tile shown or not is written `{shown && <NavTile />}`, never a fragment of several, so the count
is the tiles drawn. A corner button is `--bar-button` wide, inside the bar's row
([`bar.stylex.ts`](/packages/web/src/layout/bar.stylex.ts)), so the page's end already clears it.

The new bars go through the status line's slot, as the round's and the spec's do:
[`FeatureBar`](/packages/web/src/feature/FeatureBar.tsx), with the panes' rows drawn without their
pane in the sheets (`ProducedRows`, `LinkRows`); [`StartBar`](/packages/web/src/ProposalStart.tsx);
[`AddBar`](/packages/web/src/SidebarAdd.tsx); and `CommitBar` in
[`CommitPage`](/packages/web/src/CommitPage.tsx), whose Commit starts through `useOwnWrite` as the
page's Commit button does. [`Shell`](/packages/web/src/Shell.tsx)'s frame is at least the window's
height, the status line's row included. Lucide's `play` and `save` are in
[`barIcons.ts`](/packages/web/src/theme/barIcons.ts), beside `lucide.ts`, at its size limit.

Two pages were at the 100-line limit of a function, and gave parts away first: the feature page's
title, menu, and refused-drop banner (`FeatureTitle`), and the editor's research effort
(`useResearchEffort`).

## Gotchas

- **The research effort's pick is dropped as the page draws, not in an effect**: moved out of the
  page, React Compiler compiles it, and lint refuses a state set in an effect, which it had skipped
  while the page was uncompiled ([`EditorPage`](/packages/web/src/EditorPage.tsx)).
- **A sheet's history entry is named by its label**: the feature's sheets have fixed names, and
  Links only while it shows, so a stale `?tab=links` or a feature done with its sheet open leaves no
  dead Back entry ([`FeatureBar`](/packages/web/src/feature/FeatureBar.tsx)).
- **The note delete's test waited for one of Undo's two files**: Undo's one write puts back the
  inbox, then the note file, and a loaded machine let the test read between them. It now waits for
  both ([`inbox-note-delete.test.tsx`](/packages/web/src/__tests__/inbox-note-delete.test.tsx)).

## Questions

### Round 01

#### Q1: What goes in the feature page's bar?

**Answer:** A, Produced, Links, Session, then Next in the accent, with Produced and Links leaving
the body, but the Next pane keeps its button: "I know it's duplication, but it's clearer".

#### Q2: What does the draft editor's Start do?

**Answer:** A, a single Start button opening the Start pane as a sheet, the pane leaving the body.

#### Q3: Do the inbox and the priorities get an Add button?

**Answer:** A, Add alone, on both pages.

#### Q4: What goes in the commit page's bar?

**Answer:** A, Discard in the left corner and Commit in the right one, the body's buttons leaving
it, with a save icon for Commit: "Not a fan of your 'commit' icon though, it's not very clear."

#### Notes

The buttons must appear at the page's end, with the whole content visible above the bar.

## Changes after approval

- The final review found a refused Start hidden under the Start sheet: its message now shows in the
  sheet too.
- The commit page's Discard tile is blocked while a git write runs, as Commit is. The wide page's
  Discard button was not before this change, and stays so.
