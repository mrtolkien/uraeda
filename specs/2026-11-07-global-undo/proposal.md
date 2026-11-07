---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Global undo

## What

Global undo: we need a good, centralized undo stack, and we need to clearly outline what can be
undone and what can’t.

u should undo like in nvim, U should redo and show up only when available.

Actions without undo need a confirmation dialog.

And make sure we have a clean interface for all this!

## Why

It’s not clear what is and what isn’t un doable at the moment.

## Notes

We don’t need to go too overkill, what matters is that key actions are un doable.
