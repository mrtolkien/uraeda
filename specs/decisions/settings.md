---
status: active
approved-by: mrtolkien
icon: settings
---

# Settings

Uraeda's settings live in one TOML file a human can edit, back up, and keep in their dotfiles:
`config.toml`, in Uraeda's config folder, `~/.config/uraeda/` on Linux and macOS. The web UI writes
the same file and keeps its comments. A flag or an environment variable overrides a setting for one
run and never writes it. Settings are kept apart from Uraeda's data, its cache, and its secrets,
which stay in the data folder.

## Rules

- Settings MUST be stored in `config.toml`, in Uraeda's config folder: `URAEDA_CONFIG_DIR` when it
  is set, or else `$XDG_CONFIG_HOME/uraeda/`, or `~/.config/uraeda/` when `XDG_CONFIG_HOME` is
  unset, on Linux and macOS alike. Checked by the core's tests.
- Finding, reading, validating, and writing the settings file MUST live in the Rust core,
  [`crates/core`](/crates/core/). The server, through the binding, and `ura` MUST NOT read or write
  it any other way. Checked by review.
- A write MUST change only the values it sets, keeping every comment, every key Uraeda does not
  know, and the order of the rest, through `toml_edit`; and MUST replace the file whole, through a
  temporary file renamed over it. Checked by the core's tests.
- A file that cannot be read, or holds an invalid value, MUST NOT be overwritten: every write MUST
  be refused until it is fixed, and the server MUST use the defaults of its settings meanwhile.
  Checked by the core's and the server's tests.
- A setting's value MUST come, in order, from its command-line flag, its environment variable, the
  settings file, then its default, in one function of the server. A flag or a variable MUST NOT be
  written into the file. Checked by the server's tests.
- Settings MUST NOT hold a secret, like the access key or a session: secrets stay in the data
  folder, as the [sign-in](sign-in.md) decision says. Checked by review.
- Settings MUST be read only from the user's config folder, never from a file in a repository or a
  checkout, except a checkout's `.env` for `vp dev`, as an environment source. Checked by review.
- The data folder MUST hold Uraeda's data and cache: `repositories.json`, `sign-in.json`,
  `runner.sqlite`, and `images/`. Files that only live while a server runs, like a Storybook's
  record or the host token, MUST be in its `run/` folder. Settings MUST NOT be stored there. Checked
  by review.
- A setting the web UI changes MUST apply at once when the server can apply it while running, and
  MUST say "A change applies at the next start." under it otherwise. Checked by the settings page's
  tests.

## Why

The human wanted the server's values out of flags and `.env`, in a format that can be "backed
up/added to dotfiles simply", and a settings page that "will grow bigger with time"
([proposal](../done/2026-10-16-settings-page.md)). They chose TOML in the dotfiles folder, the only
option both in that folder and safe to annotate by hand
([Q1](../done/2026-10-16-settings-page.md#q1-what-format-is-the-settings-file-and-where-does-it-live),
[the file's format and place](../done/2026-10-16-settings-page.md#q1-what-format-is-the-settings-file-and-where-does-it-live)).
Codex and `gh` keep theirs in the same folder, including on macOS
([how others do it](../done/2026-10-16-settings-page.md)).

They asked for coherent data, and chose settings apart from data, with a running server's files in
their own folder, rather than a full XDG split
([Q2](../done/2026-10-16-settings-page.md#q2-how-is-uraedas-data-organized),
[organizing the data](../done/2026-10-16-settings-page.md#q2-how-is-uraedas-data-organized)). Flags
override for one run, as in every product and guideline checked
([Q3](../done/2026-10-16-settings-page.md#q3-what-does-a-flag-given-at-start-do-to-the-settings),
[sources and their order](../done/2026-10-16-settings-page.md#q3-what-does-a-flag-given-at-start-do-to-the-settings)).
The core owns the file as it owns the list of repositories, so `ura` reads the same settings when a
later feature needs them.

## Alternatives considered

- JSON in the data folder, next to `repositories.json`: no dependency, but no comments, and a file
  to pick out of a folder of caches and secrets.
- JSON in the config folder: the dotfiles folder without a dependency, but no comments.
- A flag given at start written into the file: a test start would change the settings for good.
- The full XDG split, with the cache in the state folder: each file where Linux tools expect it, at
  the cost of a migration, while macOS merges the folders anyway.

## Consequences

- Every later setting, models, run options, reviews, joins one file and one page.
- The core depends on `toml_edit`, about 167 KB in a release binary that uses it; `ura` pays it only
  once it reads settings.
- A hand edit while the server runs shows on the page at once; a broken file shows its problem
  there, and the server runs on its defaults until it is fixed.
- Tests set `URAEDA_CONFIG_DIR`, as they set `URAEDA_DATA_DIR`, so they never read the user's file.
- Two folders to know: the config folder for what the human edits, the data folder for what Uraeda
  keeps.

## Applies to

- [`crates/core/`](/crates/core/), [`packages/server/`](/packages/server/),
  [`packages/web/`](/packages/web/), and every feature that adds a setting, a flag, an environment
  variable, or a file in Uraeda's data or config folder
