---
icon: undo-2
---

# Undo

> "Global undo: we need a good, centralized undo stack, and we need to clearly outline what can be
> undone and what can’t."

An edit to the human's lists and texts is taken back with one key, so it never asks first. What
cannot be taken back is the other side of that line: it asks, or it is deliberate. The Git page is
where uncommitted changes wait for the human's commit. The shared confirmation is the app's one
dialog that asks before an action. The keys, the toast, and how far back the stack goes are the
guides', in [Surfaces](../ui/surfaces.md#undo) and
[Keyboard](../ui/keyboard.md#a-key-that-cannot-be-taken-back).

## Rules

- Every edit the human makes to their lists and texts can be undone: the inbox, the priorities,
  proposals, comments. _So:_ a feature that adds a new write to those files ships its reverse with
  it. A review's pending comment is removed by `d` at once, with an Undo.
- What can be undone never asks first. _So:_ `d` deletes a note at once. The yes or no dialog that
  stood before it, and the second `d` of `dd`, are gone.
- What loses work for good, with no undo, asks first, through the shared confirmation. _So:_
  discarding a file's changes asks. Dismissing an inbox triage asks only when it holds answers that
  were never committed.
- An undo never commits, reverts, or rewrites git's history: it writes the reverse as a change.
  _So:_ undoing a move the human already committed asks first, then writes the move back as a new
  change, which waits on the Git page.
- Starting a feature or a change, which makes a branch and commits, is deliberate: it never follows
  from Enter in a field or from a slip. _So:_ Enter while editing a proposal's line saves the line.
  Start opens its dialog, whose own button starts the feature.

## Why

An undo the human can count on lets edits happen in one key, without a question each time: a
confirmation asked for every write gets clicked through unread, so a question must still mean
danger. Starting a feature makes a branch and commits, which no undo takes back safely. Git stays
the backstop, and the human's commits stay theirs. History:
[Global undo](../done/2026-11-07-global-undo.md).

## Alternatives considered

- A question before every action without undo: about 25 questions, soon answered without reading.
- Committing actions undone by a revert commit: an agent may already have acted on the commit.

## Applies to

- [`app/`](/app/), and every feature that adds or changes a write the human makes, or a way to start
  a feature or a change
- [`crates/core/`](/crates/core/)'s writes to the inbox, the priorities, proposals, and comments
