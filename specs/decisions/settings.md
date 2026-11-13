---
icon: settings
---

# Settings

> "Store the config in a simple format that can be backed up/added to dotfiles simply"

A setting is a choice that follows the human to every device. What one device remembers about its
own screen, a pane's width, the theme picked there, is no setting, and stays on that device.

## Rules

- Settings live in one TOML file in the config folder, on macOS too, apart from Uraeda's data and
  secrets. _So:_ the switch that turns single-key shortcuts off is a line of that file, not a value
  the app keeps on one device. A file that lives only while a server runs goes to the data folder.
- Nothing a repository holds chooses what Uraeda runs, spends, or shows: no setting, scheduled job,
  or run option is read from one. _So:_ a job file committed in a repository is never read, however
  useful to a team. A feature's picks of agent and model are kept in the data folder, and a
  repository the human opens cannot bring a colour theme with it.
- The settings file never holds a secret, and the server reads secrets only from a `.env` file in
  the config folder, never from a project or the folder it runs in. _So:_ what signs a device in is
  kept in the data folder, and a cloned repository cannot widen the host names the server accepts.
- A write by the app keeps the human's comments, unknown keys, and order, and never overwrites a
  file it cannot read. _So:_ changing the port on the settings page leaves every comment in place. A
  file with a syntax error shows its problem on the page, and stays as it is until fixed by hand.
- A flag or an environment variable overrides the file for one run, and is never written into it.
  _So:_ a server started for a test with its own port leaves the file's port alone. The order is the
  flag, the variable, the file, then the default.

## Why

A file is simple to back up and to keep in one's dotfiles, and TOML is the format usual in the
config folder that is safe to annotate by hand. The human edits it too, so the app treats it as
theirs. Settings stay apart from data and secrets, so dotfiles never hold a secret. A repository is
other people's text: one that could set a value could restyle the app, choose what the human's runs
spend, or run an agent on their machine. A feature's run options are workflow choices kept out of
git for that reason, an exception to the constitution's "git and plain text first". History:
[Settings page](../done/2026-10-16-settings-page.md).

## Alternatives considered

- JSON: no dependency, but no comments.
- A flag written into the file at start: a start for a test would change the settings for good.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/server/`](/crates/server/), [`app/`](/app/), and every
  feature that adds a setting, a flag, an environment variable, or a file in Uraeda's data or config
  folder
