---
kind: change
finished: 2026-11-01
pull-request: https://github.com/mrtolkien/uraeda/pull/81
---

# Record: If there's nothing in progress, the "nothing in progress" in the sidebar looks…

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-01, finished on
> 2026-11-01, in [its pull request](https://github.com/mrtolkien/uraeda/pull/81). Its full files are
> in git: `git log -- specs/changes/2026-11-01-nothing-bar/`.

## What and why

With nothing in progress, the sidebar's In progress pane said "Nothing in progress.", which the
folded rail, 52 px wide, clipped to a stray "Not" between two separator lines. The human asked to
fix it, and to make sure unfolding the sidebar still works.

## Behaviour

- **The In progress pane is left out while nothing is in progress**, as Needs you and Sessions
  already were, in the open column, the folded and semi-wide rail, and the phone's column and
  Sessions page. It shows again with the first feature or change started.
- **Unfolding the rail moves nothing**: the open column draws the same rows the rail clips, so its
  icons keep their place as it opens.
- **Home keeps its own "Nothing in progress."** line, in its In progress pane: a page, not the
  sidebar.

## Design

The root cause was in [`shell/ShellPanes.tsx`](/packages/web/src/shell/ShellPanes.tsx): `ShellPane`
drew an empty pane's line unless the pane asked to be hidden, and only In progress did not. It now
leaves out every pane whose count is 0, as [the look and feel guide](/specs/ui/look-and-feel.md)'s
"empty sections disappear" says, and its `empty` and `isHiddenEmpty` props went with the line.
[`empty-panes.test.tsx`](/packages/web/src/__tests__/empty-panes.test.tsx) checks the folded rail
with nothing started, and with features in progress.

## Gotchas

- **Main's CI was red** before this branch, from two causes it fixes in commits of their own: the
  inbox pass's record linked the proposal start's folder, gone since its merge, and the ledger test
  rejected the decisions the reading pass and mockup previews had approved. The test now lists the
  attachments decision's MUST and MAY in one rule, and the UI look's Why with two records, as
  approved over its shape, and takes 12,200 words in place of 12,100
  ([`check.rs`](/crates/core/tests/check.rs), `the_ledger_reads_alone`).
