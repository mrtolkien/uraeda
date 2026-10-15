---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Settings page

## What

We need a settings page with selection of config values.

It will grow bigger with time so let's make it clean from the start.

## Why

I don't like CLI flags for important config values like allowed hosts, which is how it's done at the
moment. And we'll need a settings page anyways for many settings in the future (model selection,
runner type, review settings, workflow settings, ...).

## Notes

- Store the config in a simple format that can be backed up/added to dotfiles simply
- Make sure all our data (config, local db, repositories) is coherent and well organized. You are
  allowed to propose changes to what exists right now, we're open to changes.
