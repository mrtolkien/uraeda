---
kind: feature
finished: 2026-10-16
pull-request: https://github.com/mrtolkien/uraeda/pull/24
---

# Record: Settings page

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-16, finished on
> 2026-10-16, in [its pull request](https://github.com/mrtolkien/uraeda/pull/24). Its full files are
> in git: `git log -- specs/2026-10-16-settings-page/`.

## What and why

The human did not want important values, like allowed host names, set only by flags and `.env`, and
needed a settings page anyway for the many settings to come: a model per step, run options, review
settings. The page had to be "clean from the start", with categories and placeholders that show its
structure. The settings live in "a simple format that can be backed up/added to dotfiles simply",
flags still change them for a start, "useful for starting a server headless", and Uraeda's data, "it
grew organically so far", was to be organized coherently.

## Behaviour

- **The settings file.** `config.toml` in `URAEDA_CONFIG_DIR`, else `$XDG_CONFIG_HOME/uraeda/`, else
  `~/.config/uraeda/`, on Linux and macOS; a relative `URAEDA_CONFIG_DIR` is resolved from the start
  folder, an empty one is unset. It holds `[server]` with `allowed_hosts`, `port`, and
  `open_browser`, each optional, defaulting to no host names, 4310, and a browser opened. The first
  write creates the folder and the file, which starts with
  `# Uraeda's settings. The settings page writes this file too, and keeps your comments.` A start
  never creates or changes it.
- **Writes keep the file (US1).** Each change reads the file as it is, under the core's write lock,
  changes one value with `toml_edit`, and replaces the file atomically: every comment, unknown key,
  and other byte stays, a name's own comments (the lines above it, and the one ending its line) go
  with it when it is removed, `\r\n` line ends and a byte order mark stay, a symlink stays with its
  target replaced, and the file's permissions stay. A failed write says
  `Could not save ~/.config/uraeda/config.toml: permission denied.`
- **Allowed host names (US1).** The Server category lists them, each a bordered field edited in
  place and saved on Enter, with a "Remove <name>" button, then a "＋ Add a host name" button that
  opens a field. Names are saved trimmed and in lower case, and apply to the next request without a
  restart. The core refuses
  `<name> is not a host name: use letters, digits, hyphens, and dots, like mac.tail1234.ts.net.`,
  `<name> is already allowed.`, `<name> is not an allowed host name.` (edited or removed after a
  hand edit removed it), and "A host name cannot be empty.", the typed text kept. A name listed
  twice is removed everywhere, or edited in its first place with the others removed. Removing the
  name this browser reached the page through, while the file's names are in force, asks "Remove the
  host name of this browser?" ("This browser reaches Uraeda through <name>. Once it is removed, the
  server refuses this browser until the name is added again, from another device or in the file.",
  "Remove", "Cancel"); `127.0.0.1` and `localhost` always pass, and ask nothing.
- **Port and opening a browser (US3).** The port is a field, a number from 1 to 65535, else "The
  port is a number from 1 to 65535."; "Open a browser at start" is a switch saved at once. Both
  apply at the next start, and say "A change applies at the next start." The page says where the
  file is: "Kept in ~/.config/uraeda/config.toml, which you can also edit by hand."
- **Flags and variables override for one run (US2).** The order is the flag, then the variable, then
  the file, then the default, in one function, and nothing is written. `--allowed-hosts` and
  `URAEDA_ALLOWED_HOSTS` override the host names, `--port` and `URAEDA_PORT` the port, `--no-open`
  the browser. The page shows the file's value, with "Set by <flag or variable> for this run:
  <value>." beside it. An empty variable is unset, so `.env`'s value or the file's applies; an empty
  `--allowed-hosts ""` allows no host name for the run. A `--port` or `URAEDA_PORT` that is not a
  port, `--port ""` included, stops the start with `uraeda: The port is a number from 1 to 65535.`,
  exit 1. The packaged server reads no `.env`; `vp dev` does.
- **A file that cannot be read.** It is never overwritten: the server uses the defaults, flags and
  variables still applying, and prints
  `uraeda: Cannot read ~/.config/uraeda/config.toml: line 3, port: The port is a number from 1 to 65535. The server uses its defaults until the file is fixed.`
  Each problem has its line: the parser's message, `[server] is a table of settings.`,
  `The allowed host names are a list, like ["mac.tail1234.ts.net"].`,
  `Opening a browser at start is true or false.`, or `permission denied.` for a file that cannot be
  opened. The Server category shows the problem as a banner, "Fix the file to change settings here.
  Until then, the server uses its defaults.", with no control.
- **The file is watched.** A hand edit shows on the page without a reload, after 100 ms of quiet,
  and applies its host names at once; a deleted file brings the defaults back. A missing config
  folder is watched from the nearest folder above it, and a symlinked `config.toml` at its target
  too, as dotfiles managers link it; a symlink to nothing is not followed. Two servers on two ports
  watch the same file.
- **Finding a setting (US4).** "Settings" in the sidebar's footer, with a gear icon, opens
  `/r/<name>/settings`. The categories are Server, Appearance, Sign-in, Agents, Runs, and Reviews:
  on a desktop, beside the open one, Server first; on a phone, the list is a page and each category
  its own, with a "‹ Settings" button back. An unknown category reads as none. Agents, Runs, and
  Reviews list their later settings with "Comes with the Codex runtime", "Comes with run options",
  "Comes with review settings", or "Comes with the adversarial review", and no control. Renaming a
  repository is not on the page.
- **Searching (C1).** "Search settings", top right on a desktop and first on a phone, finds every
  setting, planned ones included, by its label or its category's, trimmed and in any case, each
  result leading to its category; "No setting matches “xyz”." otherwise. The search starts empty and
  clears once a result opens its category in the page.
- **Appearance (US5).** The theme, "System", "Light", or "Dark", leaves the sidebar for Appearance,
  still kept on each browser.
- **Sign-in (US6).** "Sign out" and "Sign out everywhere…", with its dialog, leave the repository
  menu for the Sign-in category, working as basic security made them; an unreachable server shows
  "Could not reach the Uraeda server." there.
- **The data folder's `run/`.** A running server's files, Storybook records, the host token, and
  one-time sign-in link pages, live in `run/` (mode `0700`). The first start removes exactly the
  older `storybooks/` (after stopping the Storybooks it lists), `sign-in-links/`, and
  `server-<digits>.token` from the data folder's root, and nothing else.

## Design

Settings follow the list of repositories: the core owns the file, the binding exposes it, the server
watches it and serves it on the global fate endpoint, and the page reads and changes one live
record. The server's values in force come from one pure function, and everything that runs reads
them there, never the file or the flags.

- The core's [`settings.rs`](/crates/core/src/settings.rs), with
  [`settings/rules.rs`](/crates/core/src/settings/rules.rs) (the only home of "a host name" and "a
  port"), [`settings/file.rs`](/crates/core/src/settings/file.rs) (reading with spans, writing
  atomically), and [`settings/list.rs`](/crates/core/src/settings/list.rs) (a list's layout and
  comments); the binding's [`settings.rs`](/crates/binding/src/settings.rs).
- The server's [`settings.ts`](/packages/server/src/settings.ts), `inForce` and `ServerSettings`,
  which holds the last file read and its problem and tells its listeners, and
  [`settings-watch.ts`](/packages/server/src/settings-watch.ts), the folder and symlink watch.
  [`env.ts`](/packages/server/src/env.ts) and [`options.ts`](/packages/server/src/options.ts) only
  report what they were given, with its name.
- The host check, [`guard.ts`](/packages/server/src/guard.ts), rebuilds its sets when the names in
  force change; the sign-in cookie's HTTPS test reads them too.
- [`run-folder.ts`](/packages/server/src/run-folder.ts): `runFolder(dataDir)`, the only builder of
  `run/`'s paths, and the removal of the old files.
- The fate record and its five changes, [`fate/settings.ts`](/packages/server/src/fate/settings.ts)
  and [`fate/settings-mutations.ts`](/packages/server/src/fate/settings-mutations.ts), published by
  `announceSettings` in [`live.ts`](/packages/server/src/live.ts).
- The page, in [`packages/web/src/settings/`](/packages/web/src/settings/): `categories.ts` (the
  categories, their planned settings, and the search), `SettingsView.tsx`, `ServerSettings.tsx`,
  `OtherSettings.tsx`, and the route component `SettingsPage.tsx`; the footer entry in
  [`Shell.tsx`](/packages/web/src/Shell.tsx), and the bordered `look="field"` of
  [`EditableLine.tsx`](/packages/web/src/EditableLine.tsx).

## Questions

### Round 01

#### Q1: What format is the settings file, and where does it live?

**Answer:** A: TOML, in `~/.config/uraeda/config.toml` on Linux and macOS, written by the core with
`toml_edit`, which keeps comments and order.

#### Q2: How is Uraeda's data organized?

**Answer:** A: settings in the config folder; the data folder keeps its data and cache, and a
running server's files move to its `run/` subfolder, without migration.

#### Q3: What does a flag given at start do to the settings?

**Answer:** A: a flag wins over its variable, which wins over the file, for that run only, and the
page says what overrides the file.

#### Q4: Which of today's values become settings?

**Answer:** A: allowed host names, the port, and opening a browser at start; the repository to open
and the data folder stay a flag and a variable.

#### Q5: Where does the settings page live?

**Answer:** A: one page at `/r/<name>/settings/<category>`, from a Settings entry in the sidebar's
footer, with "Move the theme switch into the settings btw".

#### Q6: How do the settings to come show now?

**Answer:** A: each future category listed, its planned settings as plain lines naming the feature
that brings them.

#### Q7: Do Sign out and Sign out everywhere move to the settings page?

**Answer:** A: both move to a Sign-in category, out of the repository menu.

#### Q8: Does renaming a repository stay a placeholder?

**Answer:** A, read as none: "Don't even add the option", renaming comes with the sidebar feature.

#### Notes

- **Built on basic security**: "I've merged basic security, so you can include the necessary
  features in the settings page."

## Decisions

- [Settings](../decisions/settings.md), new: one TOML file in `~/.config/uraeda/`, owned by the
  core, written with comments kept, overridden for one run by flags and variables that never write
  it; a running server's files in the data folder's `run/`.
- [Stack](../decisions/stack.md), changed: allowed host names come from the settings, in their
  order, and a change to the file applies to the next request.
- [Distribution](../decisions/distribution.md), changed: the packaged server's settings come from
  its flags, its environment, and the user's settings file, never a file in a project.

## Changes after approval

- A search of every setting, planned ones included, top right on a desktop and first on a phone
  (spec review C1; R17: it clears when a result opens its category).
- Host names and the port show as bordered fields, and adding a host name is a button (spec review
  C2; R15, with "A host name cannot be empty." for an empty line).
- `vp dev`'s own pages keep `URAEDA_ALLOWED_HOSTS` and `.env` for Vite's host check, and its port
  from `URAEDA_PORT` or 4310, while its server routes follow the settings (R1, R2).
- One-time sign-in link pages move to `run/` too (R4).
- Editing or removing a name the file no longer lists is refused (R5); a name listed twice is edited
  and removed in every place (R8).
- The file's other problems have their own one-line messages, and host names in the file are read
  trimmed and in lower case (R6).
- An empty variable is unset; an empty flag is given (R7).
- A removed name takes its own comments with it; `\r\n` line ends and a byte order mark stay (R9).
- A port flag or variable that is not a port refuses the start (R11).
- A symlinked file is watched at its target, and a missing folder from the nearest one above it
  (R12).
- The first start removes only the three old names from the data folder's root (R13).
- On a phone, the way back to the categories is a "‹ Settings" button, tall enough for a finger
  (R16).

## Follow-ups

- A name listed twice in two cases shows twice on the page.
- A name the file lists with spaces around it cannot be edited or removed from the page.
- Under an override, the port field and the switch show the value in force, beside its note.
- An older server still running during an upgrade loses its running files to the first new start.
- Two servers writing the file at once can lose a change.
- The file's name, `config.toml`, and the port's refusal are written in both the core and
  TypeScript.
- Unsaved settings text is kept per repository.
- A server error during a change reads as an unreachable server.
- Editing the host name this browser uses asks nothing, unlike removing it.
- `packages/server/src/__tests__/sessions.test.ts` and `runner/__tests__/sessions.test.ts` still
  time out in an `afterAll` hook under the full run's load, before this feature too; they pass
  alone.
