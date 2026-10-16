---
status: auto-approved
spec-revision: 1
---

# Plan: Settings page

**Goal:** Keep the server's settings in `~/.config/uraeda/config.toml`, owned by the core, applied
live where the server can, overridden for one run by flags and variables, and shown and changed on a
settings page with categories and a search, which also takes the theme and signing out.

**Architecture:** The [spec's architecture](spec.md#architecture), with these owners:

- **The settings file** is owned by the core's `settings` module: the only code that finds, reads,
  validates, and writes it, and the only home of the rules "what is a host name" and "what is a
  port". It returns full messages, with the file's path written with `~`.
- **The values in force** are owned by the server's `ServerSettings`
  (`packages/server/src/settings.ts`): one pure function, `inForce`, applies the order flag,
  variable, file, default; the class holds the last file read, its problem, watches the config
  folder, and tells its listeners when the values in force change. It is authoritative for the
  running server: the guard, the sign-in cookie, the fate record, and `main.ts` read it, never the
  file or `Options` directly.
- **Flags and variables** are reported, not resolved, by `options.ts` and `env.ts`: each value with
  the name of the flag or variable that gave it, no defaults.
- **Resources**: `ServerSettings.open` starts a `FileWatch` (`settings-watch.ts`): an `fs.watch` of
  the config folder, or of the nearest folder above it until it exists, and of a symlink's target
  folder (R12); `close()` stops them, called by the server's `stop`, by `main.ts` on a handover, and
  by every test that opens one.
- **The page** reads one fate record, `Settings`, on the global endpoint, and changes it through
  five mutations; the record is published on the global live bus when the values change.
- **The data folder's `run/`** has one helper, `runFolder(dataDir)`, the only builder of its paths.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A flag overriding the host names, then the file changing**: the guard keeps the flag's names;
   only the record's `saved` changes. Task 3.
2. **The file written by the page while its watcher fires**: one reload, no stale value published
   after the write's own answer. Task 5.
3. **Two changes from two devices at once**: both land, since each change reads the file under the
   core's write lock. Task 1.
4. **A host name typed with spaces around it, or a trailing dot**: trimmed; a trailing dot is
   refused as not a host name. Task 1.
5. **The settings file present but empty**: the defaults, no problem. Task 1.
6. **`URAEDA_CONFIG_DIR` set but empty**: counts as unset, as `URAEDA_DATA_DIR` does. Task 1.
7. **Removing the browser's host name while the page was reached through `127.0.0.1` or
   `localhost`**: no dialog, since those always pass. Task 6.
8. **A search with no match**: "No setting matches “xyz”." and no category. Task 8.

## Global constraints

From the [settings](../decisions/settings.md) decision, word for word:

- Settings MUST be stored in `config.toml`, in Uraeda's config folder: `URAEDA_CONFIG_DIR` when it
  is set, or else `$XDG_CONFIG_HOME/uraeda/`, or `~/.config/uraeda/` when `XDG_CONFIG_HOME` is
  unset, on Linux and macOS alike.
- Finding, reading, validating, and writing the settings file MUST live in the Rust core,
  `crates/core`. The server, through the binding, and `ura` MUST NOT read or write it any other way.
- A write MUST change only the values it sets, keeping every comment, every key Uraeda does not
  know, and the order of the rest, through `toml_edit`; and MUST replace the file whole, through a
  temporary file renamed over it.
- A file that cannot be read, or holds an invalid value, MUST NOT be overwritten: every write MUST
  be refused until it is fixed, and the server MUST use the defaults of its settings meanwhile.
- A setting's value MUST come, in order, from its command-line flag, its environment variable, the
  settings file, then its default, in one function of the server. A flag or a variable MUST NOT be
  written into the file.
- Settings MUST NOT hold a secret, like the access key or a session.
- Settings MUST be read only from the user's config folder, never from a file in a repository or a
  checkout, except a checkout's `.env` for `vp dev`, as an environment source.
- The data folder MUST hold Uraeda's data and cache: `repositories.json`, `sign-in.json`,
  `runner.sqlite`, and `images/`. Files that only live while a server runs, like a Storybook's
  record or the host token, MUST be in its `run/` folder. Settings MUST NOT be stored there.
- A setting the web UI changes MUST apply at once when the server can apply it while running, and
  MUST say "A change applies at the next start." under it otherwise.

From the [stack](../decisions/stack.md) decision: the server "MUST reject requests whose `Host` is
not `127.0.0.1` or `localhost` on its port, or an allowed host name: the `--allowed-hosts` flag,
else `URAEDA_ALLOWED_HOSTS`, else the settings file's `allowed_hosts`, as the settings decision
orders them, with a change to the file applied to the next request." The TypeScript types of core
data MUST come from the declarations napi-rs generates.

From the [distribution](../decisions/distribution.md) decision: "The server started from the package
MUST NOT read a `.env` file: its settings come from its flags, its environment, and the user's
settings file, in the order of the settings decision, never from a file in a project."

From the [sign-in](../decisions/sign-in.md) decision: "Sign-in MUST NOT be turned off by a flag, an
environment variable, or a setting."

From the UI decisions: text saves only on its Save button or its key, toggles and picks at once
([UI behaviour](../decisions/ui-behaviour.md)); a dialog only to confirm an irreversible action; no
raw `button`, `input`, or `select`; styles with `stylex.create` and Astryx tokens only, sizes from
the theme ([UI components](../decisions/ui-components.md)); UI tests through roles, labels, and
visible text, never markup ([UI checks](../decisions/ui-checks.md)); two widths at 768 px, layouts
by width only ([UI layout](../decisions/ui-layout.md)).

From [code quality](../decisions/code-quality.md): functions at most 100 lines, 7 parameters, 4
levels of nesting; files at most 500 lines; no new marker; unit tests never sleep for a fixed time.

The spec's exact strings, every one copied as written, including:

- "Remove the host name of this browser?", "This browser reaches Uraeda through mac.tail1234.ts.net.
  Once it is removed, the server refuses this browser until the name is added again, from another
  device or in the file.", "Remove", "Cancel".
- "https://mac.tail1234.ts.net is not a host name: use letters, digits, hyphens, and dots, like
  mac.tail1234.ts.net.", "mac.tail1234.ts.net is already allowed.", "The port is a number from 1 to
  65535."
- "Set by --allowed-hosts for this run: build.tail1234.ts.net.", "Set by URAEDA_PORT for this run:
  4400.", "Set by --port for this run: 4500.", "Set by --no-open for this run: off."
- "A change applies at the next start."
- "Cannot read ~/.config/uraeda/config.toml: line 3, port: The port is a number from 1 to 65535.",
  then, in the server's output only, " The server uses its defaults until the file is fixed."; in
  the banner, "Fix the file to change settings here. Until then, the server uses its defaults."
- "Could not save ~/.config/uraeda/config.toml: permission denied."
- "# Uraeda's settings. The settings page writes this file too, and keeps your comments."
- "Kept in ~/.config/uraeda/config.toml, which you can also edit by hand."
- The categories, their summaries, and their later settings, as in
  [`categories.ts`](/packages/web/src/settings/categories.ts) and US4.

Existing guarantees to keep:

- `--help` runs without the binding ([`main.ts`](/packages/server/src/main.ts)), checked by
  `main.test.ts`.
- A second start never opens a file the running server owns, and hands over through the host token
  ([`main.ts`](/packages/server/src/main.ts) `handOver`).
- The packaged server reads no `.env` ([`paths.ts`](/packages/server/src/paths.ts),
  [`smoke.ts`](/packages/uraeda/scripts/smoke.ts)).
- Leftover Storybooks of a killed server are killed at start
  ([`preview/groups.ts`](/packages/server/src/preview/groups.ts) `killLeftGroups`).
- Tests never read the user's own files: today through `URAEDA_DATA_DIR`; with this plan through
  `URAEDA_CONFIG_DIR` too.

## Code read

- [`crates/core/src/repositories.rs`](/crates/core/src/repositories.rs): the pattern to follow:
  `data_dir(var, os, home)` and `default_data_dir`, errors as `thiserror` enums, the atomic write
  through a per-write temporary file, under `crate::api::write_lock()`.
- [`crates/core/src/api.rs`](/crates/core/src/api.rs): 625 lines, listed at 633 in the structure
  test ([`crates/cli/tests/structure.rs`](/crates/cli/tests/structure.rs)); `ApiError`'s fields are
  public. The settings API does not touch this file.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): 426 lines; `job` runs a core call off
  the main thread; `file_writes` and `inbox_writes` are submodules: settings get one too.
  `crates/core/src/view.rs` shows `#[cfg_attr(feature = "napi", napi(object))]` on core types.
- [`packages/server/src/env.ts`](/packages/server/src/env.ts) and
  [`options.ts`](/packages/server/src/options.ts): resolve values with defaults today; tested by
  `__tests__/env.test.ts`.
- [`packages/server/src/main.ts`](/packages/server/src/main.ts): takes the port before opening any
  owned file; `options.open && browserOpens()` in two places.
- [`packages/server/src/server.ts`](/packages/server/src/server.ts) (286 lines),
  [`app.ts`](/packages/server/src/app.ts) (180), [`dev.ts`](/packages/server/src/dev.ts): pass
  `options.allowedHosts`, an array, to the guard, `sessionCheck`, and `signInRoutes`; `devServer`
  gives Vite its own `allowedHosts`.
- [`packages/server/src/guard.ts`](/packages/server/src/guard.ts): `guardCheck` builds its sets
  once; used by `guard` and by `previewUpgrade` in `server.ts`; tested by `guard.test.ts`.
- [`packages/server/src/sign-in/check.ts`](/packages/server/src/sign-in/check.ts) and
  [`routes.ts`](/packages/server/src/sign-in/routes.ts): `cookieName(host, allowedHosts)`, the HTTPS
  test of listed hosts; [`host.ts`](/packages/server/src/sign-in/host.ts) and
  [`links.ts`](/packages/server/src/sign-in/links.ts): `server-<port>.token` and
  `sign-in-links/<port>/` in the data folder's root.
- [`packages/server/src/preview/groups.ts`](/packages/server/src/preview/groups.ts): `storybooks/`.
- [`packages/server/src/repositories.ts`](/packages/server/src/repositories.ts): `Hosts`, the
  watcher to copy: `fs.watch` of the folder, filtered by file name, debounced `LIST_QUIET_MS`, and
  `#announce` on the global bus.
- [`packages/server/src/fate/`](/packages/server/src/fate/): `list-mutations.ts` serves every
  endpoint; `sources.ts` (349 lines) and `views.ts` (485 lines, `Root` at its end) define records;
  `fate.ts` exports views and types for the client. `views.ts` would pass 500 with a new record: the
  settings record lives in its own module, as `preview.ts` does.
- [`packages/web/src/routes.tsx`](/packages/web/src/routes.tsx) (483 lines), `App.tsx` (327),
  `Shell.tsx` (202, the theme in the footer), `RepositoryMenu.tsx` (369, the sign-out group),
  `data.ts` (474, `useRepositories` reads the global record), `views.ts` (303).
- [`packages/web/src/settings/`](/packages/web/src/settings/): the approved mockups, the starting
  point of the page.
- [`packages/web/src/EditableLine.tsx`](/packages/web/src/EditableLine.tsx): the in-place line,
  closed as a link today.
- Tests: Rust in `crates/core/tests/` with `common/`, run by `cargo nextest run`; server in
  `packages/server/src/__tests__/` with `helpers.ts`, and `main.test.ts` spawning `main.ts`; web
  happy-dom tests in `packages/web/src/__tests__/` rendering the app on an in-process server
  (`helpers.tsx`: `renderPage`, `serverApp`, `signInServer`, `atWidth`); WebKit tests in
  `src/__browser__/`, one Vite dev server for all of them (`setup.ts`, `vite.browser.config.ts`,
  which sets `URAEDA_ALLOWED_HOSTS=uraeda.test`), with the page list of `layout.test.tsx`. Every
  package's tests load [`packages/binding/test-setup.ts`](/packages/binding/test-setup.ts), which
  gives each file its own `TMPDIR`. Existing tests that change: `theme.test.tsx`, `sign-in.test.tsx`
  (sign-out from the menu), `story-embed.test.tsx` (the theme radiogroup), `env.test.ts`,
  `guard.test.ts`, and the helpers building `createApp`.
- Validation: `vp check`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo nextest run`, `vp test --project <name> <file>` for one file, and `vp run ready` for all.

## Constitution check

| Principle                                  | Complies | Notes                                                              |
| ------------------------------------------ | -------- | ------------------------------------------------------------------ |
| I. Humans stay in control                  | yes      | Only the approved decisions; the review comments carried out.      |
| II. Git and plain text first               | yes      | A plain-text file; no workflow state moves.                        |
| III. Asynchronous by default               | yes      | Nothing in the workflow reads settings.                            |
| IV. Review effort matches impact           | yes      | The page says where each value in force comes from.                |
| V. Tools are optional                      | yes      | The file is edited by hand as well as by the page.                 |
| VI. Code is checked and stays maintainable | yes      | One home per rule, tests per scenario, no file grown past a limit. |

## Decisions

- [Settings](../decisions/settings.md): every rule (tasks 1 to 5).
- [Stack](../decisions/stack.md): the host check (task 3); core types generated (task 1); data only
  from the server through fate (tasks 5, 6).
- [Distribution](../decisions/distribution.md): no `.env` in the package, the smoke test isolated
  (task 2).
- [Sign-in](../decisions/sign-in.md): no setting turns it off; the cookie's HTTPS test reads the
  host names in force (task 3); signing out moves (task 7).
- [Repositories](../decisions/repositories.md): the data folder found by the core (task 4).
- [CLI](../decisions/cli.md): `toml_edit` measured in the spec, about 167 KB (task 1).
- [Code quality](../decisions/code-quality.md): `api.rs` untouched, `views.ts` not grown past 500,
  `routes.tsx` kept under 500 (tasks 1, 5, 6).
- [UI behaviour](../decisions/ui-behaviour.md), [UI layout](../decisions/ui-layout.md),
  [UI components](../decisions/ui-components.md), [UI checks](../decisions/ui-checks.md),
  [preview](../decisions/preview.md): tasks 6 to 9.

## Complexity tracking

| What                                                           | Why                                                                                     | Simpler alternative rejected                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Core module `settings`, and the binding's `settings` submodule | The decision puts the file in the core; `api.rs` is over its limit                      | The settings API in `api.rs`: grows a file over 500                                       |
| `ServerSettings` class and `inForce` function                  | One owner of the values in force, live, for the guard, the cookie, the page, and `main` | Each reader merging flags and file: four copies of the order                              |
| `AllowedHosts`, a function type, in place of an array          | The guard and the cookie read the names in force at each request                        | Rebuilding the app on a change: drops live streams and middleware state                   |
| `runFolder(dataDir)` helper                                    | Three writers of process files share one folder                                         | Each joining `run` itself: the folder's name in three places                              |
| `fate/settings.ts` module                                      | `views.ts` would pass 500 lines                                                         | The record in `views.ts` and `sources.ts`                                                 |
| `SettingsPage` route component over `SettingsView`             | The approved stories render `SettingsView` with props                                   | Reading fate inside each category: stories would need a server record that has no fixture |
| A `look="field"` variant of `EditableLine`                     | C2 asks for borders on the editable values; the line is shared                          | A bordered box around the line: a double border once open                                 |
| Search entries in `categories.ts`                              | C1's search reads one list of every setting, real and planned                           | Searching the rendered page: categories not shown cannot be searched                      |

No function or file grows past a limit; `routes.tsx` stays under 500, at about 490 lines.

## Review comments

- **C1, a search bar, top right on desktop, top on mobile**: task 8 adds "Search settings" above the
  categories, in the heading row on wide screens and first on narrow ones, with its results across
  every category.
- **C2, borders on the editable values**: task 6 draws each closed host name and the port as a
  bordered field, at the control height, with the theme's border and radius, the value inside; the
  Add line reads as a button.

---

## Task 1: The core's settings file

**Files:**

- Create: `crates/core/src/settings.rs`, `crates/core/tests/settings.rs`,
  `crates/binding/src/settings.rs`
- Modify: `Cargo.toml` (workspace dependency), `crates/core/Cargo.toml`, `crates/core/src/lib.rs`
  (`pub mod settings;`), `crates/binding/src/lib.rs` (`pub mod settings;`),
  `packages/binding/index.js`, `packages/binding/index.d.ts` (generated)

**Interfaces:**

- Produces, in `uraeda_core::settings`:
  - `pub struct Settings { pub server: ServerSettings }` and
    `pub struct ServerSettings { pub allowed_hosts: Option<Vec<String>>, pub port: Option<u16>, pub open_browser: Option<bool> }`,
    `#[cfg_attr(feature = "napi", napi(object))]`, so `index.d.ts` declares `Settings` and
    `ServerSettings` with `allowedHosts?`, `port?`, `openBrowser?`.
  - `pub fn config_dir(var: impl Fn(&str) -> Option<String>, home: &Path) -> PathBuf`, and
    `pub fn default_config_dir() -> PathBuf`.
  - `pub fn read(dir: &Path) -> Result<Settings, ApiError>`, `add_allowed_host(dir, name: &str)`,
    `edit_allowed_host(dir, from: &str, to: &str)`, `remove_allowed_host(dir, name: &str)`,
    `set_port(dir, port: &str)`, `set_open_browser(dir, open: bool)`, each
    `-> Result<Settings, ApiError>`, the settings after the change.
  - Errors as `ApiError`: `code: "refused"` for an invalid value, with the field's message;
    `code: "unreadable"` for a file that does not parse or holds an invalid value, the message
    "Cannot read <file>: <problem>"; `code: "refused"` for a failed write, "Could not save <file>:
    <reason>", `<file>` with the home folder written `~`, `<reason>` the I/O error's kind in lower
    case.
- Produces, in the binding: `configDir(custom?: string | null): string`, `readSettings(dir)`,
  `addAllowedHost(dir, name)`, `editAllowedHost(dir, from, to)`, `removeAllowedHost(dir, name)`,
  `setPort(dir, port: string)`, `setOpenBrowser(dir, open: boolean)`, all but `configDir` returning
  `Promise<Settings>`, rejecting with "<code>: <message>".

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/settings.rs`, on a temporary folder per test:

- `reads_each_file` (table): no file and an empty file give `Settings::default()`;
  `[server]\nallowed_hosts = ["mac.tail1234.ts.net"]\nport = 4400\nopen_browser = false` gives each
  value; `[agents]\nmodel = "x"` gives the defaults; `port = 0`, `port = 70000`, `port = "x"` give
  `unreadable` "Cannot read <dir>/config.toml: line 2, port: The port is a number from 1 to 65535.";
  `allowed_hosts = ["https://x"]` gives "…: line 2, allowed_hosts: https://x is not a host name: use
  letters, digits, hyphens, and dots, like mac.tail1234.ts.net.". In its own test,
  `reports_where_a_file_does_not_parse`: `[server` gives a `unreadable` message starting with
  "Cannot read <dir>/config.toml: line 1".
- `checks_each_host_name` (table, through `add_allowed_host`): `mac.tail1234.ts.net` and
  `MAC.Tail1234.ts.net` (saved `mac.tail1234.ts.net`), `mac.tail1234.ts.net` (trimmed) are accepted;
  `https://mac.tail1234.ts.net`, `mac.tail1234.ts.net.`, `-mac.ts.net`, `mac_1.ts.net`,
  `mac.ts.net:4310`, an empty name, and a 254-character name are refused with the spec's message,
  the typed text in it; the file is unchanged after each refusal.
- `refuses_a_name_already_allowed`: adding `MAC.tail1234.ts.net` to `["mac.tail1234.ts.net"]` is
  refused with "mac.tail1234.ts.net is already allowed.".
- `keeps_comments_and_unknown_keys` (US1.2, SC-002): a file with a first line `# mine`,
  `# my tailnet` above `allowed_hosts = ["mac.tail1234.ts.net"]`, and `[agents]\nmodel = "x"` at its
  end; after `add_allowed_host("phone.tail1234.ts.net")` the text equals the original with only the
  array line changed to `allowed_hosts = ["mac.tail1234.ts.net", "phone.tail1234.ts.net"]`.
- `edits_and_removes_a_name` (US1.3, US1.4): edit to `laptop.tail1234.ts.net` gives
  `allowed_hosts = ["laptop.tail1234.ts.net"]`; remove leaves `allowed_hosts = []`; editing or
  removing a name not listed is refused with "<name> is not an allowed host name.".
- `removes_the_first_of_two_names`: removing the first of
  `["mac.tail1234.ts.net", "phone.tail1234.ts.net"]` gives
  `allowed_hosts = ["phone.tail1234.ts.net"]`.
- `adds_the_server_table_to_a_file_without_it`: a file holding only `[agents]` gets `[server]` after
  it, the rest unchanged.
- `creates_the_folder_and_file`: on a missing folder, `set_open_browser(false)` creates it, and the
  file starts with "# Uraeda's settings. The settings page writes this file too, and keeps your
  comments." then `[server]` and `open_browser = false`.
- `sets_the_port` (US3.1, US3.2): `"4400"` writes `port = 4400`; `"70000"`, `"0"`, `"x"`, `""` are
  refused with "The port is a number from 1 to 65535.".
- `refuses_writes_to_a_broken_file`: with `[server`, every change returns the `unreadable` error,
  and the file's bytes are unchanged.
- `applies_to_the_file_as_it_is_now` (review focus 3): two threads each add a different name 20
  times; the file lists all 40.
- `finds_the_config_folder` (table): `URAEDA_CONFIG_DIR=/c` gives `/c`; empty `URAEDA_CONFIG_DIR`
  with `XDG_CONFIG_HOME=/x` gives `/x/uraeda`; neither gives `<home>/.config/uraeda`.
- `reports_a_failed_write`: on a read-only folder (`chmod 500`), the error is "Could not save
  <dir>/config.toml: permission denied.".

The break each test catches:

- Reading: a schema that rejects unknown tables, or reports a problem without its line.
- Host names: a check that accepts schemes, ports, or trailing dots, or forgets to lower-case.
- Comments: a write that serializes a new document instead of editing the parsed one.
- Concurrency: a change applied to a copy read before the lock.
- Folder: `XDG_CONFIG_HOME` read before `URAEDA_CONFIG_DIR`, or an empty value taken as a path.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo nextest run -p uraeda-core --test settings`
- Expected: FAIL to compile, `unresolved import uraeda_core::settings`

- [x] **Step 3: Implement the module and the binding's functions**

Add
`toml_edit = { version = "0.23", default-features = false, features = ["parse", "display", "serde"] }`
to the workspace and the core. Read with `toml_edit::Document`, which keeps each key's span,
checking each value with the host name and port rules (1 to 253 characters; labels of ASCII letters,
digits, and hyphens joined by dots, none empty, none starting or ending with a hyphen; ports 1 to
65535), and finding a key's line from its span for problems (see
[R6](rulings.md#r6-the-files-other-problems-and-their-messages) for the problems the spec names no
text for). Write each change on the parsed document, under `crate::api::write_lock()`, into a
temporary file renamed over `config.toml`, as `repositories::save` does. The binding's submodule
wraps each in `job`, as `lib.rs` does.

- [x] **Step 4: Run all the Rust checks and regenerate the binding**

- Run:
  `cargo nextest run && cargo clippy --workspace --all-targets -- -D warnings && vp run binding:touch`
- Expected: PASS; `packages/binding/index.d.ts` declares the seven functions and two types.

- [x] **Step 5: Commit**

```bash
git add Cargo.toml Cargo.lock crates/core crates/binding packages/binding/index.js packages/binding/index.d.ts specs/2026-10-16-settings-page/plan.md
git commit -m "feat(settings-page): the settings file in the core"
```

## Task 2: The values in force, at start

**Files:**

- Create: `packages/server/src/settings.ts`, `packages/server/src/__tests__/settings.test.ts`
- Modify: `packages/server/src/env.ts`, `packages/server/src/options.ts`,
  `packages/server/src/main.ts`, `packages/server/src/__tests__/env.test.ts`,
  `packages/server/src/__tests__/main.test.ts`, `packages/binding/test-setup.ts`,
  `packages/uraeda/scripts/smoke.ts`

**Interfaces:**

- Consumes: task 1's binding functions and `Settings` type.
- Produces, in `env.ts`: `type Given<T, N> = { name: N; value: T }`, `HostsName`, `PortName`;
  `Env = { allowedHosts?: Given<Array<string>, HostsName>; given: boolean; port?: Given<string, PortName>; repo: string }`,
  the port as typed, without defaults, an empty variable as unset
  ([R7](rulings.md#r7-an-empty-variable-is-unset-an-empty-flag-is-given));
  `loadConfigDir(root, core: { configDir }, environment?, sources?): string`, like `loadDataDir`.
  `DEFAULT_PORT` moves to `settings.ts`, with the other defaults.
- Produces, in `options.ts`: `Options = Env & { allowOrigins; newKey; noOpen: boolean; show? }`,
  `--allowed-hosts` and `--port` given with their flag's name, `--allowed-hosts ""` given as `[]`;
  `open` is gone.
- Produces, in `settings.ts`:
  - `type Source`, `type Setting<T>`, as the spec's **Data**;
    `type ServerSettingsView = { allowedHosts: Setting<Array<string>>; openBrowser: Setting<boolean>; port: Setting<number> }`.
  - `function checked(given: GivenValues, check: (typed: string) => number): RunValues`, the port
    checked by the binding's `checkedPort`, the core's rule
    ([R11](rulings.md#r11-a-port-given-by-a-flag-or-a-variable-that-is-not-one-refuses-the-start)).
  - `function inForce(options: RunValues, file: Settings | null): ServerSettingsView`.
  - `class ServerSettings` with
    `static async open({ binding, dir, options }): Promise<ServerSettings>`,
    `view(): ServerSettingsView`, `problem: string | null`, `file: string` (with `~`, from the
    binding's `settingsFile`), `allowedHosts(): ReadonlyArray<string>`,
    `onChange(listener: () => void): () => void`, `reload(): Promise<void>`, `close(): void`. `open`
    reads the file once and watches it (R12); a reload that finds the file broken keeps nothing of
    it, and prints, once per new problem, "uraeda: <problem> The server uses its defaults until the
    file is fixed.".
- Produces, in `server.ts` and `app.ts`: `StartOptions` and `AppOptions` no longer derive from
  `Options`: they list `allowedHosts?: Array<string>`, `allowOrigins`, `port: number`, and, for
  `startServer`, `given`, `repo`, and `settings?: ServerSettings`, which its `stop` closes.
  `main.ts` passes the host names in force at start, the port in force, and the settings; `dev.ts`
  passes the variable's host names, as before, until task 3.

- [x] **Step 1: Write the failing tests**

- `settings.test.ts`, `inForce` (table, US2.1–2.5): each of flag, variable, file, default, alone and
  together, for each setting, gives the value and source the spec names; `noOpen: true` gives
  `{ inForce: false, source: { kind: "flag", name: "--no-open" } }` over `open_browser = true`; an
  absent key gives `saved: null`.
- `ServerSettings`: a broken file gives the defaults and its `problem`; a hand edit that adds
  `laptop.tail1234.ts.net` reaches `view().allowedHosts.saved` once `reload()` resolves and calls
  each listener once; the file deleted gives the defaults.
- `env.test.ts`: the variables and flags are reported with their names, nothing when unset; `.env`
  values carry the variable's name.
- `main.test.ts` (US2.2, US2.3, US3.1, SC-003): with `URAEDA_CONFIG_DIR` holding `port = 4400`, the
  server listens on 4400; with `URAEDA_PORT` too, on its port; with `--port` too, on the flag's; the
  file's bytes are the same after each start; with `open_browser = false`, no browser opens.
- `test-setup.ts` sets `URAEDA_CONFIG_DIR` to a folder inside the test file's `TMPDIR`; the smoke
  test sets it to an empty folder.

The break each test catches: the variable read over the flag; the file read over the variable; a
default applied in `env.ts`, hiding the source; a start that writes the file; a test reading the
developer's own `~/.config/uraeda`.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-server src/__tests__/settings.test.ts`
- Expected: FAIL, `Failed to resolve import "../settings.ts"`

- [x] **Step 3: Implement `settings.ts`, the reporting `env.ts` and `options.ts`, and `main.ts`**

`main.ts` opens `ServerSettings` after loading the binding and before taking the port, takes the
port and `openBrowser` from its view, closes it on a handover, and passes it to `startServer` (task
3 consumes it there). The watcher copies `Hosts.#watchList`: the config folder, filtered by
`config.toml`, debounced `LIST_QUIET_MS`; a missing folder is watched from the nearest one above it,
and a symlink's target folder too (R12).

- [x] **Step 4: Run all server tests**

- Run: `vp test --project uraeda-server && vp check`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server packages/binding/test-setup.ts packages/uraeda/scripts/smoke.ts specs/2026-10-16-settings-page/plan.md
git commit -m "feat(settings-page): the server's settings, from flags, variables, then the file"
```

## Task 3: Host names applied while the server runs

**Files:**

- Modify: `packages/server/src/guard.ts`, `packages/server/src/app.ts`,
  `packages/server/src/server.ts`, `packages/server/src/dev.ts`,
  `packages/server/src/sign-in/check.ts`, `packages/server/src/sign-in/routes.ts`,
  `packages/server/src/testing.ts`, `packages/server/src/main.ts`,
  `packages/server/src/__tests__/guard.test.ts`, `packages/server/src/__tests__/server.test.ts`,
  `packages/server/src/__tests__/helpers.ts`, `packages/server/src/__tests__/files.test.ts`,
  `packages/server/src/__tests__/repositories.test.ts`,
  `packages/server/src/preview/__tests__/helpers.ts`,
  `packages/server/src/sign-in/__tests__/routes.test.ts`, `packages/web/src/__tests__/helpers.tsx`,
  `packages/web/.storybook/fixture.ts`, `packages/web/src/__browser__/setup.ts`,
  `packages/web/scripts/screenshots.ts`, `packages/web/scripts/validate-storybook.ts`
- Create: `packages/server/src/__tests__/allowed-hosts.test.ts`
  ([R10](rulings.md#r10-the-live-host-name-tests-have-their-own-file))

**Interfaces:**

- Consumes: `ServerSettings` (task 2).
- Produces: `type AllowedHosts = () => ReadonlyArray<string>` in `guard.ts`; `guardCheck`,
  `sessionCheck`, `signInRoutes`, and `cookieName` take it in place of an array; `createApp` and
  `startServer` take `settings: ServerSettings` in place of `allowedHosts`, and `startServer`'s
  `stop` closes it, as does a failed start; `devHandler` opens one per started server from
  `loadConfigDir`. `ServerSettings.allowedHosts()` keeps its array while the values in force do not
  change. In `uraeda-server/testing`:
  `testSettings({ allowedHosts?, dir? }): Promise<ServerSettings>`, on a new config folder by
  default, `allowedHosts` given as `--allowed-hosts`.

- [x] **Step 1: Write the failing tests**

- `guard.test.ts`: a `guardCheck` whose list changes from `[]` to `["mac.tail1234.ts.net"]` accepts
  `Host: mac.tail1234.ts.net` on the next check, and its `Origin: https://mac.tail1234.ts.net`; back
  to `[]`, refuses it with "Forbidden host".
- `allowed-hosts.test.ts` (US1.1, US1.3, SC-001, review focus 1; R10): on a started server with an
  empty config folder, a request with `Host: mac.tail1234.ts.net` is refused; after `addAllowedHost`
  and `settings.reload()`, the next is accepted; after editing it to `laptop.tail1234.ts.net`,
  refused again; with `--allowed-hosts build.tail1234.ts.net` given, the file's names never pass and
  `build.tail1234.ts.net` does; the file deleted, refused. The upgrade guard follows the same names:
  refused as a forbidden host, then past the guard once the name is added.
- `routes.test.ts`: a host added to the settings gets `__Host-uraeda` on sign-in.

The break each test catches: sets built once at start; the flag dropped when the file reloads; the
cookie's host list read from `Options`; the upgrade's guard given the names at start.

- [x] **Step 2: Run them to check they fail**

- Run:
  `vp test --project uraeda-server src/__tests__/guard.test.ts src/__tests__/allowed-hosts.test.ts`
- Expected: FAIL, `TypeError: allowedHosts is not iterable`, and `testSettings is not a function`

- [x] **Step 3: Implement**

`guardCheck` rebuilds its two sets when `allowedHosts()` returns a different array than last time.
Every caller of `createApp` and `startServer`, the test helpers and the Storybook fixture included,
passes a `ServerSettings` over a temporary config folder; the browser setup and the fixture set
`URAEDA_CONFIG_DIR` to a temporary folder, as do the screenshots and the Storybook check.
`devServer` keeps giving Vite `URAEDA_ALLOWED_HOSTS` only (R1).

- [x] **Step 4: Run every TypeScript test**

- Run: `vp test --project '!phone' --project '!desktop' && vp check`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages specs/2026-10-16-settings-page
git commit -m "feat(settings-page): host names applied while the server runs"
```

## Task 4: A running server's files in `run/`

**Files:**

- Create: `packages/server/src/run-folder.ts`, `packages/server/src/__tests__/run-folder.test.ts`
- Modify: `packages/server/src/preview/groups.ts`, `packages/server/src/sign-in/host.ts`,
  `packages/server/src/sign-in/links.ts`, `packages/server/src/server.ts`, their tests where they
  name the old paths (`main.test.ts`), and `packages/server/src/__tests__/helpers.ts`, which takes
  `groupLeader` and `running` from `server.test.ts` for both test files

**Interfaces:**

- Produces: `runFolder(dataDir: string): string`, `<dataDir>/run`, created with mode `0700` by its
  writers; `removeOldRunFiles(dataDir: string): void`, called once at start after `killLeftGroups`
  has read the old `storybooks/` too, `oldGroupsFolder(dataDir)`
  ([R13](rulings.md#r13-the-old-running-files-are-three-names-in-the-data-folders-root)).

- [x] **Step 1: Write the failing tests**

- A started server writes `run/storybooks/<pid>.json` when a Storybook starts,
  `run/server-<port>.token`, and `run/sign-in-links/<port>/`; nothing new in the data folder's root.
- Over a data folder holding `storybooks/<pid>.json` of a dead process, `server-4310.token`, and
  `sign-in-links/4310/`, a start kills the listed group, removes all three, and keeps
  `repositories.json`, `sign-in.json`, `runner.sqlite`, and `images/`.
- A second start finds the running server's token in `run/` (the existing handover test, path
  updated).

The break each test catches: one writer left on the old path; the old Storybooks never killed; data
removed with the old files.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-server src/__tests__/run-folder.test.ts`
- Expected: FAIL, `Cannot find module '../run-folder.ts'`

- [x] **Step 3: Implement**

- [x] **Step 4: Run all server tests**

- Run: `vp test --project uraeda-server && vp check`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server specs/2026-10-16-settings-page/plan.md
git commit -m "feat(settings-page): a running server's files in run/"
```

## Task 5: The settings record and its changes, in fate

**Files:**

- Create: `packages/server/src/fate/settings.ts`, `packages/server/src/fate/settings-mutations.ts`
  ([R14](rulings.md#r14-the-settings-mutations-have-their-own-module)),
  `packages/server/src/__tests__/settings-fate.test.ts`
- Modify: `packages/server/src/fate/context.ts` (`settings: ServerSettings`),
  `packages/server/src/fate/views.ts` (one `Root` entry), `packages/server/src/fate/sources.ts` (one
  source entry), `packages/server/src/fate/mutations.ts` (spread the settings mutations beside
  `listMutations`), `packages/server/src/fate.ts` (exports), `packages/server/src/app.ts` (context,
  and `announceSettings`), `packages/server/src/live.ts` (`announceSettings`),
  `packages/server/src/settings.ts` (`dir`, the config folder the mutations write)

**Interfaces:**

- Consumes: `ServerSettings` (task 2), the binding's changes (task 1).
- Produces: the record `Settings`, id `SETTINGS_ID = "settings"`, with `file`, `problem`, and
  `server` as the spec's **Data**; `settingsDataView`, type `Settings` exported from `fate.ts`;
  mutations `settings.addHost({ name })`, `settings.editHost({ from, to })`,
  `settings.removeHost({ name })`, `settings.setPort({ port })`,
  `settings.setOpenBrowser({ open })`, each on every endpoint, each answering the record or a
  `refused: <message>` error; a `Settings` update on the global bus and every host's bus when
  `ServerSettings` changes.

- [x] **Step 1: Write the failing tests**

- Reading `settings` on the global endpoint gives the record of an empty folder: no host names, port
  4310 from the default, a browser opened.
- `settings.addHost({ name: "mac.tail1234.ts.net" })` answers the record with it in `saved` and
  `inForce`; the file holds it.
- `settings.setPort({ port: "70000" })` is refused with "The port is a number from 1 to 65535.".
- A broken file: the record's `problem` is "Cannot read …", and every mutation is refused with it.
- Review focus 2: after a mutation, one `Settings` update is published, and the record read after it
  holds the change.

The break each test catches: a record built from `Options`; a mutation that answers before the
settings reload; updates sent only to one bus.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-server src/__tests__/settings-fate.test.ts`
- Expected: FAIL, `No source registered for 'Settings'.`

- [x] **Step 3: Implement**

Each mutation calls the binding, then `ctx.settings.reload()`, then answers the record masked to the
selection, as `listChanged` does. `announceSettings(settings, hosts)` in `live.ts`, called once by
`createApp`, sends the update on each `ServerSettings` change; `settings.close()`, as the server
stops, removes it.

- [x] **Step 4: Run all server tests**

- Run: `vp test --project uraeda-server && vp check`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server specs/2026-10-16-settings-page/plan.md
git commit -m "feat(settings-page): the settings record and its changes"
```

## Task 6: The settings page and its Server category

**Files:**

- Start from: [`SettingsView.stories.tsx`](/packages/web/src/settings/SettingsView.stories.tsx),
  `SettingsView.tsx`, `ServerSettings.tsx`, `OtherSettings.tsx`, `categories.ts`
- Create: `packages/web/src/settings/SettingsPage.tsx`,
  `packages/web/src/__tests__/settings.test.tsx`
- Modify: `packages/web/src/routes.tsx`, `packages/web/src/App.tsx`, `packages/web/src/data.ts`
  (`useSettings`), `packages/web/src/views.ts` (`SettingsView` fate view, named `SettingsRecordView`
  to avoid the component's name), `packages/web/src/EditableLine.tsx` (`look`),
  `packages/web/src/settings/*`

**Interfaces:**

- Consumes: the record and mutations (task 5).
- Produces: route `{ page: "settings"; category?: string }` for `/settings` and
  `/settings/<category>`; `ServerValues`, now `Pick<Settings, "file" | "problem" | "server">` of the
  record's type from `fate.ts`, and `ServerActions`, each action resolving with the error to show or
  undefined; `SettingsPage` reads the browser's host from `window.location.hostname` and asks before
  removing it, so the view takes no `currentHost`
  ([R15](rulings.md#r15-the-add-row-is-a-button-and-empty-values-have-their-own-refusal));
  `EditableLine`'s `look?: "text" | "field"`, `"text"` by default, and `empty?: string`, the refusal
  of an empty text; `OnListClient` exported from `RepositoryMenu.tsx`; the web tests' `renderPage`
  option `settings: { allowedHosts?, dir? }`, as `testSettings` takes it.

- [x] **Step 1: Write the failing tests**

In `settings.test.tsx`, on `renderPage("/settings/server")` with a temporary config folder:

- US1.1, US1.6, US1.7: add a name through "＋ Add a host name"; the file and the page list it; the
  refusals show under the field, the typed text kept.
- US1.3: tap `mac.tail1234.ts.net`, type, Enter: the file holds the new name.
- US1.4 and review focus 7: removing a name at `127.0.0.1` asks nothing.
- US1.5: at `http://mac.tail1234.ts.net/`, removing it asks the spec's dialog; Cancel keeps it;
  Remove removes it.
- US1.8: a hand edit, then the record read again, lists the new name.
- US2.4: with `--allowed-hosts build.tail1234.ts.net` given, the note says "Set by --allowed-hosts
  for this run: build.tail1234.ts.net.", and an added name is saved.
- US3.1–3.3: the port saved, "A change applies at the next start." shown; `70000` refused; the
  switch writes `open_browser = false`.
- The broken file: the banner, and no "＋ Add a host name".
- C2: the closed host name and port are buttons named by their values, each inside a field-styled
  box (checked in screenshots, task 9).

The break each test catches: the browser's host compared with the port; the dialog shown for
`127.0.0.1`; a refusal clearing the field; the note hidden when the flag wins.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-web src/__tests__/settings.test.tsx`
- Expected: FAIL, the page at `/settings/server` renders the missing page:
  `Unable to find role "heading" and name "Server"`

- [x] **Step 3: Implement the route, `SettingsPage`, and the wiring**

`SettingsPage` reads `useSettings()` on the global client, as `useRepositories` does, and passes the
record and the mutations to `SettingsView`; the stories keep passing values, now of the record's
type.

- [x] **Step 4: Run the web tests**

- Run: `vp test --project uraeda-web && vp check`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-16-settings-page/plan.md
git commit -m "feat(settings-page): the settings page and its Server category"
```

## Task 7: Settings in the sidebar; the theme and signing out move

**Files:**

- Modify: `packages/web/src/Shell.tsx`, `packages/web/src/RepositoryMenu.tsx`,
  `packages/web/src/theme/icons.ts`, `packages/web/src/settings/OtherSettings.tsx`,
  `packages/web/src/settings/SettingsView.tsx` ("‹ Settings",
  [R16](rulings.md#r16-the-way-back-to-the-categories-is-a-ghost-button)),
  `packages/web/src/sign-in/useSignOut.ts`, `packages/web/src/__tests__/theme.test.tsx`,
  `packages/web/src/__tests__/sign-in.test.tsx`, `packages/web/src/__tests__/settings.test.tsx`,
  `packages/web/src/__browser__/story-embed.test.tsx`,
  `packages/web/src/__browser__/sign-in.test.tsx` (its menu's sign-out list, checked in Sign-in)
- Delete: `packages/web/src/sign-in/SignOutList.tsx`

**Interfaces:**

- Consumes: the settings route (task 6).
- Produces: the `uraeda:settings` icon; the footer's `SideNavItem` "Settings".

- [x] **Step 1: Write the failing tests**

- US4.1: from home, "Settings" in the sidebar opens `/r/<name>/settings`, selected there.
- US4.2, US4.3 at 1440 and 402 wide: the categories in order, Server beside on wide; the list alone
  on narrow, "Runs" then "‹ Settings".
- US4.4–4.6: the later settings of Runs, Agents, and Reviews, exactly.
- US5.1–5.3: no "Theme" radiogroup in the sidebar; "Dark" in Appearance turns the app dark and is
  kept after a reload; another browser follows its system.
- US6.1–6.4: the repository menu holds no sign-out item; the existing sign-out tests, moved to the
  Sign-in category, pass with their texts.

The break each test catches: the theme switch left in the footer; the sign-out group left in the
menu; categories out of order.

- [x] **Step 2: Run them to check they fail**

- Run:
  `vp test --project uraeda-web src/__tests__/theme.test.tsx src/__tests__/sign-in.test.tsx src/__tests__/settings.test.tsx`
- Expected: FAIL, `Unable to find role "link" and name "Settings"`

- [x] **Step 3: Implement**

- [x] **Step 4: Run the web tests**

- Run: `vp test --project uraeda-web && vp check`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-16-settings-page/plan.md
git commit -m "feat(settings-page): Settings in the sidebar, with the theme and signing out"
```

## Task 8: Searching settings (C1)

**Files:**

- Modify: `packages/web/src/settings/categories.ts` (each category's searchable settings),
  `packages/web/src/settings/SettingsView.tsx`, `packages/web/src/settings/SettingsView.stories.tsx`
  (a `Search` story), `packages/web/src/__tests__/settings.test.tsx`

**Interfaces:**

- Produces: `Category.settings: ReadonlyArray<string>`, the labels of its real settings, and
  `searchSettings(text: string): Array<{ category: Category; label: string }>`, matching each label
  and category name without case, the planned settings included; `SettingsView`'s
  `initialSearch?: string`, for the `Search` story
  ([R17](rulings.md#r17-the-search-clears-when-a-result-opens-its-category-and-starts-empty)).

- [x] **Step 1: Write the failing tests**

- A table of `searchSettings`: "host" finds "Allowed host names" in Server; "THEME" finds "Theme" in
  Appearance; "model" finds "The model and effort of each step" in Agents, and the two Reviews
  settings that name a model; "sign-IN" finds both Sign-in settings, by the category's name; "xyz"
  and "" find nothing.
- On the page, at 1440 and at 402 wide: "Search settings" is in the heading row on wide screens,
  after the heading and before the categories, and first on narrow ones, before the heading and
  before "‹ Settings" (the row itself is seen in task 9's screenshots); typing "port" lists "Port",
  under "Server", which opens `/settings/server` and clears the search, and "theme" at 402 opens
  `/settings/appearance`; review focus 8: "xyz" says "No setting matches “xyz”."; clearing the field
  shows the categories again.

The break each test catches: planned settings left out of the search; case kept; results that do not
lead to their category.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-web src/__tests__/settings.test.tsx`
- Expected: FAIL, `searchSettings is not a function`

- [x] **Step 3: Implement**

The field is an Astryx `TextInput` with the `search` icon, its text kept in the page's state, never
saved, like the repository menu's filter.

- [x] **Step 4: Run the web tests**

- Run: `vp test --project uraeda-web && vp check`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-16-settings-page/plan.md
git commit -m "feat(settings-page): search the settings"
```

## Task 9: Layout checks, documentation, and screenshots

**Files:**

- Modify: `packages/web/src/__browser__/layout.test.tsx` (`PAGES`), `README.md`, `.env.example`,
  `packages/web/scripts/screenshots.ts` (a second server, for a variable in force),
  `packages/web/scripts/sign-in-shots.ts` (its sign-out views, moved to the settings' views)
- Create: `packages/web/scripts/settings-shots.ts`,
  `specs/2026-10-16-settings-page/screenshots/*.webp`

- [x] **Step 1: Add the settings pages to the layout checks**

`/settings`, `/settings/server`, and `/settings/sign-in`, at both sizes, light and dark (SC-005).

- [x] **Step 2: Run the browser tests**

- Run:
  `vp test --project desktop src/__browser__/layout.test.tsx && vp test --project phone src/__browser__/layout.test.tsx`
- Expected: PASS

- [x] **Step 3: Document the settings file**

`README.md` and `.env.example`: the file, its folder, `URAEDA_CONFIG_DIR`, and the order flag,
variable, file, default.

- [x] **Step 4: Screenshots**

Each settings page and the sidebar's footer, at 402 × 874 and 1440 × 900, light and dark, reviewed
against the stories and C2, committed as WebP under `screenshots/`.

- [x] **Step 5: Run the whole validation**

- Run: `vp run ready`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/web README.md .env.example specs/2026-10-16-settings-page
git commit -m "test(settings-page): the settings pages' layout, documentation, and screenshots"
```
