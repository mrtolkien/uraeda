---
icon: settings
---

# Settings

> "Store the config in a simple format that can be backed up/added to dotfiles simply"

A setting is a choice that follows the human to every device: the picks of each step, `ura serve`'s
port, host names, repositories, and wake, and the vault's place.

## Rules

- Settings live in one TOML file, `config.toml` in the config folder, on macOS too, apart from
  Uraeda's data. _So:_ `ura serve`'s token, which changes nothing the human chose, is kept in the
  data folder, and the vault's place is a line of the settings file.
- Nothing a repository holds chooses what Uraeda runs, spends, or shows: no setting or run option is
  read from one. _So:_ the picks of agent, model, and effort are in the settings file only, and a
  cloned repository cannot widen the host names `ura serve` answers at.
- The settings file never holds a secret. _So:_ the token that opens the pages is kept in the data
  folder, never written into `config.toml`.
- A write by a page keeps the human's comments, unknown keys, and order, and never overwrites a file
  it cannot read or that changed since the page read it. _So:_ changing a step's model on the
  settings page leaves every comment in place. A file with a syntax error shows its problem on the
  page, and stays as it is until fixed by hand.
- A flag or an environment variable overrides the file for one run, and is never written into it.
  _So:_ a `ura serve` started for a test with `--port 0` leaves the file's port alone. The order is
  the flag, the variable, the file, then the default.

## Why

A file is simple to back up and to keep in one's dotfiles, and the human edits it too, so the pages
treat it as theirs. Settings stay apart from data and secrets, so dotfiles never hold a secret. A
repository is other people's text: one that could set a value could choose what the human's runs
spend, or reach the pages from another host. History:
[Settings page](../done/2026-10-16-settings-page.md).

## Alternatives considered

- JSON: no dependency, but no comments.
- A flag written into the file at start: a start for a test would change the settings for good.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/serve/`](/crates/serve/),
  [`crates/vault/`](/crates/vault/), and every feature that adds a setting, a flag, an environment
  variable, or a file in Uraeda's data or config folder
