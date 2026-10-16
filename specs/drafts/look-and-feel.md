---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Look and feel pass

## What

Look and feel pass: components style, logo, favicon, ... Until this feature we focus on the
_functional_ part of the UI: the goal here is for it to look _good_.

- Generally, the happy path should look good
- We need _many more icons_ to make everything more readable: sidebar, agent statuses, feature step,
  spec layout and paragraphs, ...
- Icons for the different harnesses (claude code, codex, pi, ...)
- A home icon/logo
- In failures in the sidebar the `x` is not centered in the circle

## Why

The UI works, but it does not look like a finished tool yet: it should look good before v1.0.0.

## Notes

This feature should ideally be almost ONLY about UI: minimal core and server-side changes. There is
no new operational concept introduced in this feature.

It comes last: after the page redesigns, the settings page, and the
[overall flow review](flow-review.md).
