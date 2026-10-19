---
status: active
approved-by: mrtolkien
icon: settings
---

# Settings

Uraeda's settings live in one TOML file that a human edits, backs up, and keeps in their dotfiles.
The web UI writes the same file without losing a hand edit. A flag or an environment variable
overrides a setting for one run, and settings stay apart from Uraeda's data and secrets.

## Rules

- Settings MUST live in one TOML file in the config folder, on macOS too, apart from Uraeda's data
  and secrets, and MUST NOT hold a secret or be read from a repository. Checked by the core's tests
  and review.
- Finding, reading, validating, and writing the settings MUST live in the Rust core, which the
  server and `ura` reach the file through. Checked by review.
- A write MUST keep a human's comments, unknown keys, and order, and MUST NOT overwrite a file that
  is unreadable or invalid. Checked by the core's tests.
- A setting MUST resolve from its flag, then its environment variable, the file, and its default,
  and a flag or variable MUST NOT be written into the file. Checked by the server's tests.
- A setting changed in the web UI MUST apply at once when it can, and otherwise the page MUST say
  when it applies. Checked by the settings page's tests.

## Why

The server's values had to leave flags and `.env` for a file simple to back up and keep in dotfiles.
TOML in the config folder is the only option that is both there and safe to annotate by hand
([the file's format and place](../done/2026-10-16-settings-page.md#q1-what-format-is-the-settings-file-and-where-does-it-live)).
Settings sit apart from data and secrets
([organizing the data](../done/2026-10-16-settings-page.md#q2-how-is-uraedas-data-organized)). A
flag overrides for one run, as in every product checked
([sources and their order](../done/2026-10-16-settings-page.md#q3-what-does-a-flag-given-at-start-do-to-the-settings)).

## Alternatives considered

- JSON, in the data or the config folder: no dependency, but no comments.
- A flag given at start written into the file: a test start would change the settings for good.
- The full XDG split, with the cache in the state folder: a migration, while macOS merges the
  folders anyway.

## Consequences

- Every later setting, like models, run options, or reviews, joins one file and one page.
- A hand edit shows on the page at once, and a broken file shows its problem there.
- Tests set `URAEDA_CONFIG_DIR` and `URAEDA_DATA_DIR`, so they never touch the user's files.

## Applies to

- [`crates/core/`](/crates/core/), [`packages/server/`](/packages/server/),
  [`packages/web/`](/packages/web/), and every feature that adds a setting, a flag, an environment
  variable, or a file in Uraeda's data or config folder
