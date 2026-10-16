---
discovery: low # low, medium, or high: how far the agent researches before asking
---

# Faster story embeds

## What

- Story embeds load their frames lazily, only once on screen.
- A feature's Storybook starts ahead of time: when its worktree is set up, and when its feature page
  opens.

## Why

Opening the settings page's spec froze the whole site: its 12 story frames loaded at once, about
1,800 requests through the server, while the worktree's Storybook was still starting.

## Notes

Keep one Storybook per worktree, as the preview decision says: everything on main until code was
weighed and dropped, since redesign mockups edit existing components.
