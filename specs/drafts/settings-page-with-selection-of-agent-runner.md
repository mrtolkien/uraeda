---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Settings page

## What

We need a settings page with selection of config values.

It will grow bigger with time so let's make it clean from the start:

- Categories (can have some placeholder for now, just to show the general UI structure)

## Why

I don't like having only CLI flags for important config values like allowed hosts, which is how it's
done at the moment. And we'll need a settings page anyways for many settings in the future (model
selection, runner type, review settings, workflow settings, ...).

Settings already known, all placeholders for the moment:

- Allowed hosts and everything that's in .env/cli flags atm. Still keep the CLI flags, they change
  config on boot (useful for starting a server headless for example).
- A model selector for _each step_ once we have multiple models/runners
- Run options: "master session" vs 1 session per workflow: does each step start with a new context
  or continue a "master session"? Should be a config flag, and able to toggle it per feature
- Same for subagents in implementation, or review settings (command, model, count, ...)
- Need to be able to rename a project slug, at least in the UI
- Sign-in: "Sign out" and "Sign out everywhere", which basic security puts in the repository menu
  for now ([its spec](/specs/2026-10-16-basic-security/spec.md), on its branch until it merges)

## Notes

- Store the config in a simple format that can be backed up/added to dotfiles simply
- Make sure all our data (config, local db, repositories) is coherent and well organized. You are
  allowed to propose changes to what exists right now, we're open to changes.
