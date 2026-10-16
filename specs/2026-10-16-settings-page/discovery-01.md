# Discovery, round 01: Settings page

## Summary

A settings page in a developer tool backed by files usually has four parts: a file a human can edit
and back up, a page that reads and writes the same values, a rule for which source wins when a flag,
an environment variable, and the file disagree, and a navigation of categories. VS Code, Zed, Claude
Code, Codex, and opencode all keep the file as the source of truth, write it from their UI at once,
put command-line flags above the file, and keep secrets and the program's own state in other files.
They differ on the format (JSON, JSONC, TOML), on where the file lives, and on how far they layer
scopes (user, project, local).

The [proposal](proposal.md) asks for the page's structure with categories, one real category, the
server's values that are only flags and environment variables today (allowed host names first), and
placeholders for later settings: a model per step, run options, review settings, renaming a
repository, and signing out. It asks for a format fit for dotfiles, and for a coherent organization
of all of Uraeda's data, open to changing what exists.

Today Uraeda has no settings file. The server reads four variables, from its environment or, in a
checkout only, a `.env` file, and three flags, once at start. Its data folder holds a list of
repositories, a SQLite cache, chat images, and process files, with only the list versioned. Three
active decisions name these sources and files, so the feature changes them. Basic security, about to
merge, adds `sign-in.json` to the data folder and the two sign-out items this page should take.

## How other products do it

### VS Code

- A Settings editor and `settings.json` edit the same values; the editor applies a change at once,
  with no save step. Categories form a table of contents, search filters them, and `@modified` lists
  what differs from the defaults
  ([VS Code settings](https://code.visualstudio.com/docs/configure/settings)).
- A modified setting has a coloured bar beside it, and a gear menu to reset it, copy its ID, or copy
  it as JSON (same page).
- Scopes: user, then workspace (`.vscode/`, shareable in git), then folder; an organization's policy
  wins over all of them (same page).
- Some settings, like colour customizations, can only be edited in the JSON file (same page).

### Zed

- Before late 2025, `settings.json` was the only way to change settings; the new settings UI is a
  window with categories on the left and controls on the right, and the file "will always remain
  there if you want unfettered control" ([Zed blog](https://zed.dev/blog/settings-ui)).
- User settings, and per-project overrides in `.zed/settings.json`, applied only in trusted
  worktrees; named profiles hold sets of overrides
  ([configuring Zed](https://zed.dev/docs/configuring-zed)).

### Claude Code

- Precedence, highest first: managed settings, the `--settings` flag, `.claude/settings.local.json`,
  `.claude/settings.json`, `~/.claude/settings.json`. Environment variables are not one level: each
  pairs with its key, and decides its own winner
  ([Claude Code settings](https://code.claude.com/docs/en/settings)).
- Strict JSON: a comment or a trailing comma is a settings error, and an interactive start asks to
  fix the file, exit, or go on without it. A `$schema` gives completion in editors (same page).
- Settings files are watched and reloaded; the keys read only at start are listed apart (same page).
- `/config` is a short list of personal options, not a view of the whole file; `/status` lists the
  sources loaded, not which one set each key (same page).
- The program's own state, like sign-in and trust, lives apart, in `~/.claude.json`; credentials in
  the macOS Keychain or `~/.claude/.credentials.json`, mode 0600
  ([authentication](https://code.claude.com/docs/en/authentication)).

### Codex CLI

- TOML, `~/.codex/config.toml`. Precedence, highest first: flags and `-c` overrides, the project's
  `.codex/config.toml` (trusted projects only), `--profile` files, the user's file, managed and
  system files, built-in defaults
  ([config basics](https://learn.chatgpt.com/docs/config-file/config-basic)).
- A project's trust is recorded in the user's file, as `projects.<path>.trust_level`
  ([config reference](https://learn.chatgpt.com/docs/config-file/config-reference)).
- Credentials live in `auth.json` or the keyring, "like a password", never in the config
  ([Codex auth](https://learn.chatgpt.com/docs/auth)).

### opencode and Vibe Kanban

- opencode: JSON or JSONC in `~/.config/opencode/opencode.json`, with `$schema`, plus a project
  file; files are merged, not replaced; values may read `{env:VAR}` or `{file:path}`; the TUI's
  settings live in a separate `tui.json` ([opencode config](https://opencode.ai/docs/config/)).
- Vibe Kanban, the closest product to Uraeda, a web UI running coding agents: its global settings
  page has categories for theme, the default agent and its variant (overridable per attempt), the
  editor, git's branch prefix, notifications, telemetry, task tags, and agent profiles
  ([Vibe Kanban settings](https://www.vibekanban.com/docs/configuration-customisation/global-settings)).
  Its storage is not documented there.

### What they have in common

Capabilities users of these products may expect, whether or not the proposal mentions them:

- One file as the source of truth, readable and editable by hand, which the UI writes too
- Flags above the file, for one run; environment variables near them
- A category list beside the settings on wide screens
- Toggles and picks applied at once; a sign of what differs from the default, and a reset
- Search across settings, once there are many
- A schema for completion in editors
- The file watched, so a hand edit shows without a restart, and the settings that need a restart
  named
- Secrets and the program's own state in other files than the settings
- Per-project, then per-session overrides, layered on the user's file

## Standards and libraries

### XDG Base Directory specification

- Four kinds of files, each with its folder: configuration in `$XDG_CONFIG_HOME` (`~/.config`), data
  in `$XDG_DATA_HOME` (`~/.local/share`), state "not important or portable enough" to be data, like
  logs and history, in `$XDG_STATE_HOME` (`~/.local/state`), and caches in `$XDG_CACHE_HOME`
  (`~/.cache`). `$XDG_RUNTIME_DIR` holds sockets and process files, removed at logout
  ([XDG spec](https://specifications.freedesktop.org/basedir/latest/)).
- On macOS, `etcetera` uses the XDG folders for command-line tools, "used by most CLI tools", and
  advises it whenever users edit config files; its native strategy uses `~/Library` for GUI apps
  ([etcetera](https://docs.rs/etcetera)). The `directories` crate puts both config and data in
  `~/Library/Application Support` on macOS, and has no state folder there
  ([directories](https://docs.rs/directories/latest/directories/struct.ProjectDirs.html)).
- `gh` keeps its config in `~/.config/gh` on macOS too, or `$GH_CONFIG_DIR`
  ([gh environment](https://cli.github.com/manual/gh_help_environment)).

### Command Line Interface Guidelines

- Precedence, highest first: flags, environment variables, project config, user config, system
  config. Follow XDG. A `.env` file is not a substitute for a config file. Do not read secrets from
  environment variables ([clig.dev, configuration](https://clig.dev/#configuration)).
- 12-factor puts config in environment variables, for deployed services
  ([12factor.net](https://12factor.net/config)): a local tool fits clig.dev's layers better (a
  judgement).

### File formats

- TOML: comments with `#`, unambiguous mapping to a table, and no null: an unset value is an absent
  key ([TOML 1.0](https://toml.io/en/v1.0.0)).
- `toml_edit` writes TOML "preserving comments, spaces and relative order of items", except the
  order of dotted keys and a missing final newline ([toml_edit](https://docs.rs/toml_edit)). It is
  not in the workspace today: [`Cargo.lock`](/Cargo.lock) has `serde_json` and a YAML parser,
  `serde-saphyr`, but no TOML crate. The [CLI](../decisions/cli.md) decision asks a new dependency
  of the core, which `ura` links, to be measured in the discovery or the spec.
- A TOML file names its schema with a `#:schema` comment at its top, for Taplo-based editors
  ([Taplo directives](https://taplo.tamasfe.dev/configuration/directives.html)).
- Strict JSON has no comments: a program that writes the file whole loses nothing, but a human
  cannot leave a note in it. JSONC keeps them only through a targeted editor, like `jsonc-parser`'s
  `modify` ([node-jsonc-parser](https://github.com/microsoft/node-jsonc-parser)); in Rust, no such
  editor was checked.

### Saving settings

- Primer: save text inputs, checkbox groups, and radios with a button; apply toggles, segmented
  controls, and single-select menus at once; never mix both in one form; keep the input and show the
  error when a save fails ([Primer saving](https://primer.style/ui-patterns/saving)).
- NN/g: a toggle takes effect at once, without Save; where it cannot, use a checkbox
  ([toggle guidelines](https://www.nngroup.com/articles/toggle-switch-guidelines/)).
- The [UI behaviour](../decisions/ui-behaviour.md) decision already says the same for Uraeda: text
  saves on its button or key, toggles and picks save at once.

### Astryx

- The installed `@astryxdesign/core` 0.6.8 ships `FormLayout` (vertical, or labels to the left,
  collapsing under 480 px), `Field`, `Switch` (with an async `changeAction` and a loading state),
  `Selector`, `SegmentedControl`, `TextInput`, `NumberInput`, `SideNav` with sections, and
  `TabList`: everything a settings page needs, without a gap to report (its `src/*/*.doc.mjs`).

## The code

### Important reads

- [`packages/server/src/env.ts`](/packages/server/src/env.ts): `loadEnv` reads
  `URAEDA_ALLOWED_HOSTS`, `URAEDA_PORT`, and `URAEDA_REPO` from the environment, then from the
  checkout's `.env`, parsed with `util.parseEnv`; `loadDataDir` reads `URAEDA_DATA_DIR` the same way
  and hands it to the core. The port is not checked for a number or a range, and host names only
  split and trimmed.
- [`packages/server/src/options.ts`](/packages/server/src/options.ts): `--port`, `--repo`,
  `--allowed-hosts`, `--no-open`, `--version`, `--help`, and a hidden `--allow-origin` for dev
  servers; each flag replaces its variable. Basic security adds `--new-key`.
- [`packages/server/src/main.ts`](/packages/server/src/main.ts): reads options and the data folder
  once, at start; listens on `127.0.0.1`, written in the code. Started from the npm package, the
  server has no checkout, so it reads no `.env` ([`paths.ts`](/packages/server/src/paths.ts)), as
  the [distribution](../decisions/distribution.md) decision requires.
- [`packages/server/src/guard.ts`](/packages/server/src/guard.ts): `guardCheck` builds its sets of
  hosts and origins once, in a closure. A host name changed while the server runs needs the guard
  rebuilt, or a restart.
- [`crates/core/src/repositories.rs`](/crates/core/src/repositories.rs): `data_dir` finds the data
  folder (`URAEDA_DATA_DIR`, then the platform default); the list is `{ version: 1, repositories }`,
  written through a temporary file renamed over it, refused when its version is unknown. No rename.
- [`packages/server/src/repositories.ts`](/packages/server/src/repositories.ts): watches the data
  folder for `repositories.json`, debounced 100 ms, and reloads: the only value read live today, the
  model for watching a settings file.
- [`packages/server/src/runner/cache.ts`](/packages/server/src/runner/cache.ts): `runner.sqlite`,
  sessions, turns, and items, migrated by `PRAGMA user_version`; 633 lines, marked over the file
  limit.
- [`packages/server/src/runner/claude.ts`](/packages/server/src/runner/claude.ts) and
  [`adapter.ts`](/packages/server/src/runner/adapter.ts): no model, effort, or step option; one
  session per feature, enforced by a unique index on `(repo, folder)`.
- [`packages/web/src/routes.tsx`](/packages/web/src/routes.tsx): the app's own router; every page
  sits under `/r/<name>/`, and `InRepository` in [`App.tsx`](/packages/web/src/App.tsx) needs a
  repository. 482 lines: a new route family may need the file split first
  ([extract, don't grow](/skills/uraeda/references/code-quality.md#extract-dont-grow)).
- [`packages/web/src/Shell.tsx`](/packages/web/src/Shell.tsx): Astryx `AppShell` and `SideNav`; its
  footer holds the only settings-like control today, the theme's `SegmentedControl`, kept in the
  browser's `localStorage` ([`theme.tsx`](/packages/web/src/theme.tsx)).
- [`packages/web/src/RepositoryMenu.tsx`](/packages/web/src/RepositoryMenu.tsx): the list of
  repositories, "Remove from Uraeda", and "Add a repository…"; basic security adds Sign out and Sign
  out everywhere to it, in `sign-in/SignOutList.tsx` (its ruling R25).
- [`packages/web/src/layout/Panes.tsx`](/packages/web/src/layout/Panes.tsx) and
  [`useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts): a list with a detail pane on wide
  screens, one or the other on narrow ones.
- [`packages/web/src/fields/useTextField.ts`](/packages/web/src/fields/useTextField.ts): the shared
  hook for unsaved text keys its browser copy by the repository's path: a page outside a repository
  needs another key.
- [`packages/web/src/__browser__/layout.test.tsx`](/packages/web/src/__browser__/layout.test.tsx):
  the pages the layout and accessibility checks cover; a new page joins its list.

### The data folder today

| File                    | Owner                                                             | Format                  | Kind, in XDG's terms      |
| ----------------------- | ----------------------------------------------------------------- | ----------------------- | ------------------------- |
| `repositories.json`     | the core, [`repositories.rs`](/crates/core/src/repositories.rs)   | JSON, versioned, atomic | data                      |
| `runner.sqlite`         | the server, [`cache.ts`](/packages/server/src/runner/cache.ts)    | SQLite, `user_version`  | cache or state            |
| `images/`               | the server, [`images.ts`](/packages/server/src/runner/images.ts)  | WebP and GIF, mode 0600 | data, unsent ones cleaned |
| `storybooks/<pid>.json` | the server, [`groups.ts`](/packages/server/src/preview/groups.ts) | JSON, not atomic        | runtime                   |
| `sign-in.json`          | the server, basic security's `sign-in/store.ts`                   | JSON, mode 0600, atomic | data, secret              |
| `server-<port>.token`   | the server, basic security                                        | text, mode 0600         | runtime, secret           |

The data folder's location has one home, the core's `data_dir`. The server reads `URAEDA_DATA_DIR`
from the checkout's `.env` too, while `ura add` reads the environment only, so a value set in `.env`
alone splits the two tools onto two lists, as [`.env.example`](/.env.example) warns.

### The proposal's path and existing actions

- **Opening the page**: no entry or route exists. Every page today lives under a repository, while
  the server's values are the machine's, not a repository's.
- **Changing allowed host names**: today, edit `.env` or the shell's environment, or pass
  `--allowed-hosts`, then restart. With the page, a write to the file, then either a rebuilt guard
  or a restart.
- **Removing the host name the page was opened through**: the next request from that browser is
  refused as a forbidden host. Nothing guards it today, since the value only changes at start.
- **Starting with a flag**: today the flag wins for the run, and nothing is written. The proposal's
  "they change config on boot" can read as either "they override it for this run" or "they write
  it".
- **A hand edit of the file while the page is open**: the list of repositories already reloads on a
  hand edit; a settings file would need the same, or the page shows stale values and a write
  overwrites the edit.
- **A broken file**: `repositories.json` with an unknown version is refused, never overwritten; the
  same rule fits settings.
- **Signing out**: basic security puts both items in the repository menu, and its spec review asked
  for them to move to this page (its C1, "this feature will be part of the settings page").
- **Renaming a repository**: not possible today but by hand; the
  [repositories](../decisions/repositories.md) decision says a name stays as added, "so links keep
  working". A rename breaks `/r/<name>/` links and preview addresses; sessions survive, keyed by the
  checkout's path.
- **The theme**: per browser, in `localStorage`, from the sidebar's footer.

### Rules and their owners

- **Where the data folder is**: the core, `data_dir`. The server copies the reading of
  `URAEDA_DATA_DIR` from `.env`.
- **Which source wins for a server value**: [`options.ts`](/packages/server/src/options.ts), flags
  over variables, and [`env.ts`](/packages/server/src/env.ts), environment over `.env`. A settings
  file joins this rule, in one place.
- **Which hosts pass**: [`guard.ts`](/packages/server/src/guard.ts), fed once at start.
- **The list of repositories, its file and its names**: the core, by the
  [repositories](../decisions/repositories.md) decision.

### Overlaps with work in flight

- **Basic security** (branch `2026-10-16-basic-security`, plan implemented, final fixes, not
  merged): adds `sign-in.json` and the host token to the data folder, `--new-key`, and Sign out and
  Sign out everywhere to the repository menu. Its decision `sign-in.md` says "Sign-in MUST NOT be
  turned off by a flag, an environment variable, or a setting". It touches `main.ts`, `options.ts`,
  `app.ts`, `guard.ts`, `routes.tsx`, `App.tsx`, `RepositoryMenu.tsx`, and `.env.example`: every
  file this feature changes. Until it merges, a page that edits allowed host names would be
  reachable by any page able to reach the server.
- **Drafts in Now** ([redesign interface](../drafts/redesign-interface.md)): reworks the sidebars,
  navigation, and URLs, without naming settings. [Look and feel](../drafts/look-and-feel.md) and the
  [flow review](../drafts/flow-review.md) come after this page.
- **Next** in [priorities](../PRIORITIES.md): run options with "global defaults and override
  per-feature", the Codex runtime with model settings, review settings: the placeholders' future
  features.

### Likely changes

- `crates/core/src/`: a settings module, reading, writing, and validating the file, next to
  `repositories.rs`; with A of [the file's format](#the-files-format-and-place), `toml_edit` in the
  workspace.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): read and write settings.
- [`packages/server/src/env.ts`](/packages/server/src/env.ts),
  [`options.ts`](/packages/server/src/options.ts), [`main.ts`](/packages/server/src/main.ts): the
  file joins the sources, below flags and variables.
- [`packages/server/src/guard.ts`](/packages/server/src/guard.ts): host names read live, with live
  changes.
- `packages/server/src/settings.ts`, new: watching the file, as `repositories.ts` watches the list.
- `packages/server/src/fate/`: a settings source and mutations, on the global endpoint, like the
  list's mutations.
- `packages/web/src/settings/`, new: the page, its categories, and its stories; `routes.tsx` (split
  first), `App.tsx`, `Shell.tsx` or `RepositoryMenu.tsx` for the entry.
- `packages/server/src/runner/cache.ts`, `preview/groups.ts`, `sign-in/`: only with B or C of
  [organizing the data](#organizing-the-data), for moved files.
- [`.env.example`](/.env.example), [`README.md`](/README.md): the new file and its precedence.
- Decisions: [distribution](../decisions/distribution.md) ("its settings come from its flags and its
  environment"), [stack](../decisions/stack.md) (hosts "listed in `URAEDA_ALLOWED_HOSTS`"), and with
  a rename, [repositories](../decisions/repositories.md); with C of
  [organizing the data](#organizing-the-data), [agents](../decisions/agents.md), which names
  `runner.sqlite`'s folder.

## The proposal

### "Everything that's in .env/cli flags"

The four variables and the flags are not the same kind of value. `URAEDA_ALLOWED_HOSTS` and
`URAEDA_PORT` are lasting settings of the machine. `URAEDA_REPO` and `--no-open` say what one start
does. `URAEDA_DATA_DIR` says where the files are, the settings file perhaps among them, so it cannot
be read from a file it locates. `--allow-origin` exists for dev servers only.

### "They change config on boot"

Two readings: flags override the file for one run, as in every product above and in clig.dev, or
they write their value into the file. The second turns a one-off start into a lasting change.

### A settings file and two active decisions

The [distribution](../decisions/distribution.md) decision says the packaged server's "settings come
from its flags and its environment", and the [stack](../decisions/stack.md) decision names
`URAEDA_ALLOWED_HOSTS` as where host names are listed. A settings file changes both. The reason
behind the first, a cloned project's `.env` widening the accepted hosts, does not apply to a file in
the user's own folder (a judgement).

### Placeholders that clash with an active decision

The [agents](../decisions/agents.md) decision says tools MUST NOT change the agent's model or
effort, and a feature MUST have at most one session. A model per step and a session per step are the
future features that will change it; a placeholder that only names them changes nothing now.

### Sign-in among the settings

Basic security's decision forbids a setting that turns sign-in off. Signing out is an action, not a
value, so it fits the page without a setting.

### "Rename a project slug, at least in the UI"

Listed among the placeholders, but "at least in the UI" can mean a name shown in the UI only, while
the URL keeps the old name, or a real rename. The repositories decision promises names that never
change.

### Order with basic security

Editing accepted host names from a web page is safe only behind sign-in. Basic security is not
merged yet.

## Approaches

Criteria come from the proposal (clean structure that will grow, a format fit for dotfiles, flags
still working, coherent data), the constitution (principle II, plain text; III, recoverable state;
VI, one home per rule), and the active decisions named above.

### The file's format and place

What the settings file is, and where it lives. Relies on [XDG](#xdg-base-directory-specification),
[file formats](#file-formats), and [how others do it](#what-they-have-in-common).

| Option                                                                                 | Dotfiles                    | Comments kept on UI writes | New dependency          | Matches               |
| -------------------------------------------------------------------------------------- | --------------------------- | -------------------------- | ----------------------- | --------------------- |
| A. TOML, `~/.config/uraeda/config.toml` on Linux and macOS, written with `toml_edit`   | yes, the usual folder       | yes                        | `toml_edit`, to measure | Codex, gh's folder    |
| B. JSON, `settings.json` in the data folder, next to `repositories.json`, `serde_json` | mixed with data and secrets | no comments at all         | none                    | the repositories list |
| C. JSON, `~/.config/uraeda/settings.json`, written whole                               | yes                         | no comments at all         | none                    | Claude Code, VS Code  |

### Organizing the data

Which folder holds each file. Relies on [the data folder today](#the-data-folder-today) and
[XDG](#xdg-base-directory-specification).

| Option                                                                                                                                        | Files moved                         | Backing up                         | Decisions changed    |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------- | -------------------- |
| A. A config folder for settings only; the data folder keeps the rest, with process files (`storybooks/`, the host token) grouped under `run/` | two kinds, process files only       | one file, the settings             | distribution         |
| B. Everything in the data folder, settings included, unchanged otherwise                                                                      | none                                | the folder, with cache and secrets | distribution         |
| C. Full XDG split: config, data (repositories, sign-in, images), state (`runner.sqlite`), runtime (process files)                             | the cache, process files, migration | one file                           | distribution, agents |

### Sources and their order

How a flag, a variable, and the file combine. Relies on
[clig.dev](#command-line-interface-guidelines) and
["they change config on boot"](#they-change-config-on-boot).

| Option                                                              | Lasting effect of a flag | What the page shows                    |
| ------------------------------------------------------------------- | ------------------------ | -------------------------------------- |
| A. Flag, then variable, then file, then default; nothing is written | none                     | the file's value, and the one in force |
| B. A flag or variable given at start is written into the file       | lasting                  | one value                              |

### Which values become settings

Relies on ["everything that's in .env/cli flags"](#everything-thats-in-envcli-flags).

| Option                                                         | Settings                                  |
| -------------------------------------------------------------- | ----------------------------------------- |
| A. Allowed host names, port, open the browser at start         | three lasting values                      |
| B. Allowed host names and port only                            | two                                       |
| C. All four variables, the repository and data folder included | a data folder read from a file it locates |

### Where the page lives

The page's address and entry. Relies on [routes](#important-reads) and the
[UI layout](../decisions/ui-layout.md) decision.

| Option                                                                              | Works without a repository | Room for a repository's settings |
| ----------------------------------------------------------------------------------- | -------------------------- | -------------------------------- |
| A. `/r/<name>/settings/<category>`, entry in the sidebar's footer, beside the theme | no                         | a category of the same page      |
| B. `/settings/<category>`, outside repositories, entry in the repository menu       | yes                        | a second page later              |

### Placeholder categories

How future settings show now. Relies on
[placeholders that clash](#placeholders-that-clash-with-an-active-decision).

| Option                                                           | Shows the structure | Code to remove later | Designs future features now |
| ---------------------------------------------------------------- | ------------------- | -------------------- | --------------------------- |
| A. Each future category with its planned settings named, as text | yes                 | text only            | no                          |
| B. Disabled controls for each planned setting                    | most                | controls and tests   | yes                         |
| C. No placeholders: only categories with real settings           | no                  | none                 | no                          |

### Signing out

Relies on [sign-in among the settings](#sign-in-among-the-settings).

| Option                                                                                  | Scope added            |
| --------------------------------------------------------------------------------------- | ---------------------- |
| A. Both items move to a Sign-in category of the page                                    | moving two items       |
| B. Same, plus the list of signed-in devices, with their last use, each signed out alone | a device list, a route |
| C. Both stay in the repository menu                                                     | none                   |

### Renaming a repository

Relies on ["rename a project slug"](#rename-a-project-slug-at-least-in-the-ui).

| Option                                      | Links          | Decision changed |
| ------------------------------------------- | -------------- | ---------------- |
| A. A placeholder now, its own change later  | unchanged      | none             |
| B. A real rename, in the list and the URL   | old ones break | repositories     |
| C. A display name, the URL keeping the name | unchanged      | repositories     |

### Needs no choice

- **Applying a change at once**: settled by the [UI behaviour](../decisions/ui-behaviour.md)
  decision: toggles and picks at once, text with its Save button or key.
- **A modified marker and a reset**: follows from showing the file's value and the default; a detail
  of the spec.
- **Search across settings**: three real settings do not need it; it can come with many.
- **A schema for editors**: with A of [the file's format](#the-files-format-and-place), a `#:schema`
  line costs one generated file; a detail of the spec.
- **Watching the file**: the list of repositories already does it; the same code fits.
- **Secrets apart**: basic security already keeps them in `sign-in.json`, mode 0600; the settings
  file holds none.
- **Per-repository and per-feature overrides**: the run options feature in Next; the file's tables
  leave room for them.

## Not checked

- The size `toml_edit` adds to `ura`'s release binary: not built in this round; the spec measures
  it, as the [CLI](../decisions/cli.md) decision asks.
- Apple's Human Interface Guidelines page on settings rendered without content.
- Whether Zed's or VS Code's UI keeps comments when it writes the file: their pages do not say.
- Conductor's and Coder's settings: not reached.
- A design system's guidance on a phone's "category list, then category page": not found.
