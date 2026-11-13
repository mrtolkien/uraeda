---
icon: settings
---

# Settings

> "My settings are one file I can keep in my dotfiles."

## Rules

- Settings live in one TOML file in the config folder, apart from Uraeda's data, and never hold a
  secret. _So:_ the access key lives in the data folder.
- A write keeps a human's comments, unknown keys, and order, and never overwrites an invalid file.
  _So:_ a broken file shows its problem on the page instead.
- A setting resolves from its flag, then its environment variable, then the file, then its default,
  and a flag is never written into the file. _So:_ a test's start never changes the settings for
  good.

## Why

A file is simple to back up and keep in one's dotfiles, and TOML is safe to annotate by hand.
Settings stay apart from data and secrets, so dotfiles never hold a secret. History:
[Settings page](../done/2026-10-16-settings-page.md).

## Alternatives considered

- JSON, in the data or the config folder: no dependency, but no comments.

## Applies to

- [`crates/core/`](/crates/core/), [`packages/server/`](/packages/server/),
  [`packages/web/`](/packages/web/), and every feature that adds a setting, a flag, an environment
  variable, or a file in Uraeda's data or config folder
