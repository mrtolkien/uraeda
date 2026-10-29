---
status: proposed
approved-by:
icon: settings
---

# Settings

Uraeda's settings live in one TOML file that a human edits, backs up, and keeps in their dotfiles.
The web UI writes the same file without losing a hand edit. A flag or an environment variable
overrides a setting for one run, and settings stay apart from Uraeda's data and secrets.

## Rules

- Settings MUST live in one TOML file in the config folder, on macOS too, apart from Uraeda's data
  and secrets. Checked by the core's tests.
- The settings file MUST NOT hold a secret, or be read from a repository. Checked by review.
- Finding, reading, validating, and writing the settings MUST live in the Rust core. Checked by
  review.
- A write MUST keep a human's comments, unknown keys, and order. Checked by the core's tests.
- A write MUST NOT overwrite a file that is unreadable or invalid. Checked by the core's tests.
- A setting MUST resolve from its flag, then its environment variable, then the file, then its
  default. Checked by the server's tests.
- A flag or an environment variable MUST NOT be written into the file. Checked by the server's
  tests.
- A setting changed in the web UI MUST apply at once when it can, the page saying otherwise when it
  applies. Checked by review.

## Why

A file is simple to back up and keep in one's dotfiles. TOML is the one format both usual in the
config folder and safe to annotate by hand. Settings stay apart from data and secrets, so dotfiles
never hold a secret. A flag overrides for one run, as in every product compared. History:
[Settings page](../done/2026-10-16-settings-page.md).

## Alternatives considered

- JSON, in the data or the config folder: no dependency, but no comments.
- A flag given at start written into the file: a test start would change the settings for good.
- Splitting the data, state, and cache folders as XDG does: a migration, while macOS merges the
  folders anyway.

## Consequences

- Every later setting, like models, run options, or reviews, joins one file and one page.
- A hand edit shows on the page at once, and a broken file shows its problem there.

## Applies to

- [`crates/core/`](/crates/core/), [`packages/server/`](/packages/server/),
  [`packages/web/`](/packages/web/), and every feature that adds a setting, a flag, an environment
  variable, or a file in Uraeda's data or config folder
