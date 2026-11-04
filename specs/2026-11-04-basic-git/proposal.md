---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Basic git UI in the web ui (pull, see diffs, ...)

## What

I want a basic git UI in the web ui (pull, see diffs, ...)

It's pretty much web lazygit?

The goal is to be able to:

- Pull main after a PR
- See/fix merge conflicts
- Look at the commit history, worktrees, ...

## Why

## Notes

- I don't want to reinvent the wheel, but at the same time the components need to fit with our look
  and feel.
- We don't need an interface as deep as lazygit, but it's an inspiration
- It should replace the current commit page: instead it'd be a git page (leader -> g) and the
  current commit look and behaviour can stay when they are uncommitted changes.
