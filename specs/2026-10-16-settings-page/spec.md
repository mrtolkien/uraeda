---
status: approved
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Settings page

> [!NOTE]
>
> Approved on 2026-10-16.
>
> - One new decision, settings: a TOML file in `~/.config/uraeda/`, owned by the core, written with
>   your comments kept, which flags and variables override for one run and never write.
> - Two changed decisions: the distribution decision lets the packaged server read that file, and
>   the stack decision takes allowed host names from the settings, applied without a restart.
> - Your two notes are in: the theme moves from the sidebar into an Appearance category, and Sign
>   out and Sign out everywhere move into a Sign-in category, out of the repository menu.
> - Renaming a repository is left out entirely, as you asked, and so is the "This repository"
>   category, which would have held nothing yet.
> - Any signed-in device can now change which host names reach the server, and a change applies at
>   once: removing the name a browser uses asks first.
> - Risk tier high, for the change to the host check; the plan does not wait for your review.
> - The Settings entry in the sidebar's footer has no story of its own: the shell's stories need
>   data this feature does not add. It is one more row, like the others.

The settings page gives Uraeda one place for its settings, starting with the server's: the host
names it accepts, its port, and whether it opens a browser at start, which only flags and
environment variables set today. They live in a TOML file fit for dotfiles, which the page and a
hand edit both change, and which a flag overrides for one run. The page shows its categories, real
and planned, so the settings to come have a home: the theme and signing out move there now, and
agents, runs, and reviews are listed with the features that will bring them. Uraeda's data folder
gets its running server's files in their own folder. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Allowed host names, set from the page (P1)

You open Settings, then Server, and add your machine's name on your tailnet: your phone reaches
Uraeda through it at once, and the name is kept in your settings file, next to your own comments.

Why this priority: it is the setting the proposal is about, and the one that needs a file today.

[Server category](/packages/web/src/settings/SettingsView.stories.tsx#Server)

Acceptance scenarios:

1. **Given** no settings file and a server started without flags or variables, **When** you add
   `mac.tail1234.ts.net` under "Allowed host names", **Then** `~/.config/uraeda/config.toml` exists
   and holds `[server]` with `allowed_hosts = ["mac.tail1234.ts.net"]`, and the next request with
   `Host: mac.tail1234.ts.net` is accepted, without a restart.
2. **Given** a settings file holding `# my tailnet` on the line above
   `allowed_hosts = ["mac.tail1234.ts.net"]`, **When** you add `phone.tail1234.ts.net`, **Then** the
   file holds `# my tailnet` on the line above
   `allowed_hosts = ["mac.tail1234.ts.net", "phone.tail1234.ts.net"]`, and nothing else in it
   changed.
3. **Given** the allowed host name `mac.tail1234.ts.net`, **When** you tap it, type
   `laptop.tail1234.ts.net`, and press Enter, **Then** the file holds
   `allowed_hosts = ["laptop.tail1234.ts.net"]`, and the next request with
   `Host: mac.tail1234.ts.net` is refused with "Forbidden host".
4. **Given** the allowed host names `mac.tail1234.ts.net` and `phone.tail1234.ts.net`, and the page
   opened through `127.0.0.1`, **When** you tap "Remove phone.tail1234.ts.net", **Then** it is
   removed at once, without asking.
5. **Given** the page opened through `mac.tail1234.ts.net`, the file's host names in force, **When**
   you tap "Remove mac.tail1234.ts.net", **Then** a dialog asks "Remove the host name of this
   browser?", with "This browser reaches Uraeda through mac.tail1234.ts.net. Once it is removed, the
   server refuses this browser until the name is added again, from another device or in the file.",
   "Remove", and "Cancel"; "Cancel" changes nothing, and "Remove" removes it.
6. **When** you add `https://mac.tail1234.ts.net`, **Then** the field keeps your text and says
   "https://mac.tail1234.ts.net is not a host name: use letters, digits, hyphens, and dots, like
   mac.tail1234.ts.net.", and the file is unchanged.
7. **Given** the allowed host name `mac.tail1234.ts.net`, **When** you add `MAC.tail1234.ts.net`,
   **Then** the field says "mac.tail1234.ts.net is already allowed.", and the file is unchanged.
8. **Given** the page open on Server, **When** you add `laptop.tail1234.ts.net` to the file by hand,
   **Then** the page lists it without a reload.

### US2: A flag or a variable overrides a setting for one run (P1)

You start a headless Uraeda with `--allowed-hosts`, for one run: it uses that value, your file stays
as it was, and the page says what is in force.

Why this priority: the proposal keeps the flags, and they must not change the file behind your back.

[A flag and a variable in force](/packages/web/src/settings/SettingsView.stories.tsx#Overridden)

Acceptance scenarios:

1. **Given** a file with `allowed_hosts = ["mac.tail1234.ts.net"]`, **When** the server starts with
   `--allowed-hosts build.tail1234.ts.net`, **Then** requests with `Host: build.tail1234.ts.net` are
   accepted, requests with `Host: mac.tail1234.ts.net` are refused, the file is byte for byte the
   same, and the page lists `mac.tail1234.ts.net` under "Set by --allowed-hosts for this run:
   build.tail1234.ts.net."
2. **Given** a file with `port = 4310` and `URAEDA_PORT=4400`, **When** the server starts, **Then**
   it listens on 4400, and the page shows `4310` under "Set by URAEDA_PORT for this run: 4400."
3. **Given** `URAEDA_PORT=4400`, **When** the server starts with `--port 4500`, **Then** it listens
   on 4500, and the page says "Set by --port for this run: 4500."
4. **Given** a server started with `--allowed-hosts build.tail1234.ts.net`, **When** you add
   `laptop.tail1234.ts.net` on the page, **Then** the file holds it, the page still says "Set by
   --allowed-hosts for this run: build.tail1234.ts.net.", and requests with
   `Host: laptop.tail1234.ts.net` are refused until a start without the flag.
5. **Given** a file with `open_browser = true`, **When** the server starts with `--no-open`,
   **Then** it opens no browser, and the page says "Set by --no-open for this run: off."

### US3: The port, and opening a browser at start (P2)

You set the port and turn off the browser a start opens, once, in the file, instead of at every
start.

Why this priority: both are lasting values of the machine, but neither blocks reaching Uraeda.

Acceptance scenarios:

1. **Given** no settings file and a server on 4310, **When** you tap `4310` under "Port", type
   `4400`, and press Enter, **Then** the file holds `port = 4400`, the server keeps listening on
   4310, "A change applies at the next start." shows under the port, and the next start without
   flags or variables listens on 4400.
2. **When** you set the port to `70000`, **Then** the field keeps your text and says "The port is a
   number from 1 to 65535.", and the file is unchanged.
3. **Given** no settings file, **When** you turn off "Open a browser at start", **Then** the file
   holds `open_browser = false`, and the next start opens no browser.

### US4: Finding a setting (P2)

From any page, you open Settings from the sidebar's footer. On a desktop, the categories stay on the
left and the open one on the right, Server first; on a phone, the categories are a page, and each
one opens as its own page. Agents, Runs, and Reviews list the settings later features will bring.

Why this priority: every later setting is reached this way.

[The categories](/packages/web/src/settings/SettingsView.stories.tsx#Index)

[A category of later settings](/packages/web/src/settings/SettingsView.stories.tsx#Runs)

Acceptance scenarios:

1. **Given** any page of the repository `uraeda`, **When** you tap "Settings" in the sidebar's
   footer, **Then** `/r/uraeda/settings` opens.
2. **Given** a desktop window 1440 px wide, **When** `/r/uraeda/settings` opens, **Then** the list
   of categories shows Server, Appearance, Sign-in, Agents, Runs, and Reviews, in that order, with
   Server selected and its settings beside the list.
3. **Given** a phone 402 px wide, **When** `/r/uraeda/settings` opens, **Then** it shows the list of
   categories only; tapping "Runs" opens `/r/uraeda/settings/runs`, with "‹ Settings" leading back.
4. **When** `/r/uraeda/settings/runs` opens, **Then** it lists "One session for the whole feature,
   or a new session at each step", "Sub-agents during the implementation", and "A different choice
   for one feature", each with "Comes with run options", and no control.
5. **When** `/r/uraeda/settings/agents` opens, **Then** it lists "The agent that runs each step" and
   "The model and effort of each step", each with "Comes with the Codex runtime".
6. **When** `/r/uraeda/settings/reviews` opens, **Then** it lists "The review's command, model, and
   number of reviewers", with "Comes with review settings", and "A second review by another model",
   with "Comes with the adversarial review".

### US5: The theme, in Appearance (P2)

The theme switch leaves the sidebar's footer, where Settings takes its place, and lives in
Appearance, still kept on each browser.

Why this priority: your answer to the page's place moved it here.

[Appearance](/packages/web/src/settings/SettingsView.stories.tsx#Appearance)

Acceptance scenarios:

1. **When** any page opens, **Then** the sidebar has no theme switch.
2. **Given** the system in light mode, **When** you pick "Dark" in Appearance, **Then** the app
   turns dark at once, and stays dark after a reload of this browser.
3. **Given** "Dark" picked on this browser, **When** another browser opens Uraeda, **Then** it
   follows its system's mode.

### US6: Signing out, from Sign-in (P2)

Sign out and Sign out everywhere move from the repository menu to the Sign-in category, as they work
today.

Why this priority: your review of basic security asked for it, and signing out is rare.

[Sign-in](/packages/web/src/settings/SettingsView.stories.tsx#SignIn)

Acceptance scenarios:

1. **When** the repository menu opens, **Then** it holds no "Sign out" and no "Sign out
   everywhere…".
2. **When** you tap "Sign out" in Sign-in, **Then** this browser shows the sign-in screen, and its
   session is ended on the server.
3. **When** you tap "Sign out everywhere…", **Then** the dialog "Sign out every device?" asks first,
   with "Every browser signed in to Uraeda, this one included, will need the access key again.",
   "Sign out everywhere", and "Cancel"; confirmed, every session ends and this browser shows the
   sign-in screen.
4. **Given** the server stopped, **When** you tap "Sign out", **Then** "Could not reach the Uraeda
   server." shows in Sign-in, and the page stays.

## Edge cases

- **A file that cannot be read**, from a syntax error or an invalid value like `port = 0`: the
  server starts with the defaults of every setting, flags and variables still applying, and prints
  "Cannot read ~/.config/uraeda/config.toml: line 3, port: The port is a number from 1 to 65535. The
  server uses its defaults until the file is fixed." The Server category shows that problem as its
  banner, with "Fix the file to change settings here. Until then, the server uses its defaults.",
  and no control. Fixing the file by hand brings the values and controls back without a reload.
  [Unreadable file](/packages/web/src/settings/SettingsView.stories.tsx#Unreadable)
- **A file broken while the page is open**: a change from the page is refused, with the same banner;
  the file is never overwritten.
- **Keys Uraeda does not know**, like `[agents]` from a later version or a typo: kept as they are on
  every write, and ignored.
- **No config folder**: the first write creates `~/.config/uraeda/` and the file, which starts with
  "# Uraeda's settings. The settings page writes this file too, and keeps your comments."
- **A hand edit and a page change at the same moment**: the page's change is applied to the file as
  it is when the change is written, so a hand edit to another key survives; on the same key, the
  last write wins.
- **The file deleted while the server runs**: the defaults apply, so the host names it held are
  refused from the next request.
- **Every host name removed**: only `127.0.0.1` and `localhost` reach the server.
- **A host name removed while a page uses it**: that page's next request is refused as "Forbidden
  host", as it is today after a restart.
- **The port changed while a server runs**: the next `uraeda` without flags starts a second server
  on the new port, instead of opening the running one, since it looks for a server on the new port.
- **An unknown category**, like `/r/uraeda/settings/nope`: read as no category: the list on a phone,
  Server on a desktop.
- **Removing the browser's host name while a flag overrides the host names**: the file's list is not
  in force, so it is removed without asking.
- **Process files from before this feature**: the first start removes the data folder's old
  `storybooks/`, after stopping the Storybooks it lists, as today's start does, and the old
  `server-<port>.token` files; from then on, they live in `run/`.
- **`URAEDA_CONFIG_DIR` relative**: resolved from the folder the server starts in, as
  `URAEDA_DATA_DIR` is.
- **Two servers on two ports**: both read and watch the same file; each applies its host names at
  once, and its port at its next start.

## Success criteria

- **SC-001**: A host name added on the page is accepted by the request that follows its save,
  without a restart.
- **SC-002**: A write from the page changes only the value it sets: every other byte of the file,
  comments and unknown keys included, stays the same.
- **SC-003**: Starting the server, with or without flags and variables, never changes the settings
  file.
- **SC-004**: Every setting is reached in two taps from any page: Settings, then its category; on a
  desktop, the Server category in one.
- **SC-005**: The settings pages pass the layout and accessibility checks at 402 × 874 and 1440 ×
  900, in light and dark.

## Architecture

Settings follow the list of repositories, the closest pattern in the code: the core owns the file,
the binding exposes it, the server watches it and serves it through the global fate endpoint, and
the page reads and changes it there ([important reads](discovery-01.md#important-reads)). The new
[settings](../decisions/settings.md) decision holds the rules.

- **The core's settings module** owns the file: where it is (`URAEDA_CONFIG_DIR`, else
  `$XDG_CONFIG_HOME/uraeda/`, else `~/.config/uraeda/`), what a valid value is (a host name, a
  port), reading it with its problem, and each change, written with `toml_edit` so comments and
  unknown keys stay, atomically, under the core's write lock. The rules "what is a host name" and
  "what is a port" live here, once.
- **The server's settings unit** owns the precedence: flag, then variable, then file, then default,
  in one function, with where each value in force comes from. It reads the file at start, watches
  it, and tells the host check, the sign-in cookie's HTTPS test, and the page when the values in
  force change. `env.ts` and `options.ts` stop applying defaults: they only report what the
  environment and the flags give, with their names.
- **The host check** reads the allowed host names in force from the settings unit, and rebuilds its
  sets when they change, instead of fixing them at start.
- **The settings source and mutations**, on the global fate endpoint like the repositories' list,
  give the page one record, live, and five changes: add, edit, and remove a host name, set the port,
  and set opening a browser.
- **The page** is a list of categories and the open one, in `packages/web/src/settings/`: its views
  take their values as props, and one route component reads the record and passes the changes. The
  sidebar's footer gets a Settings entry in place of the theme switch, and the repository menu loses
  its sign-out group, whose actions the Sign-in category reuses.
- **The data folder's `run/`** gets the files of a running server, through one helper the Storybook
  records and the host token share.

On a desktop, the categories stay beside the open one, since settings are browsed from one category
to the next, like VS Code's and Zed's; on a phone, the list is a page and each category its own
page, as the [UI layout](../decisions/ui-layout.md) decision asks. The page sits under the
repository's address, with the sidebar, as you chose
([Q5](clarifications-01.md#q5-where-does-the-settings-page-live)): every category is the machine's
or the browser's today.

Tradeoffs: the server's values come from four places, which the page shows rather than hides; and a
signed-in device can widen what reaches the server, from any device, which the sign-in in front of
every route makes acceptable.

## Mockups

The Server values in these stories are passed in, as the page's view of the server's record, until
that record exists; Appearance and Sign-in are the real components.

- [Server](/packages/web/src/settings/SettingsView.stories.tsx#Server): the file's host names, port,
  and browser switch.
- [Overridden](/packages/web/src/settings/SettingsView.stories.tsx#Overridden): a flag and a
  variable in force for this run.
- [Unreadable](/packages/web/src/settings/SettingsView.stories.tsx#Unreadable): a broken file, and
  no control.
- [Appearance](/packages/web/src/settings/SettingsView.stories.tsx#Appearance): the theme.
- [Sign-in](/packages/web/src/settings/SettingsView.stories.tsx#SignIn): signing out.
- [Runs](/packages/web/src/settings/SettingsView.stories.tsx#Runs): a category of later settings.
- [Index](/packages/web/src/settings/SettingsView.stories.tsx#Index): the list of categories on a
  phone, and Server beside it on a desktop.

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- The order of sources is the flag, then the environment variable, then the file, then the default,
  in one function of the server; a checkout's `.env` still works for `vp dev`, as an environment
  source, and the packaged server reads none.
- Allowed host names apply at once, the server watching the file; the port and opening a browser
  apply at the next start, and say so; there is no restart button.
- Removing the host name the page is using asks first, in a dialog naming it.
- Host names are edited as a list of lines, each saved on Enter or its Save button, as the UI
  behaviour decision asks; the core checks each name and the port.
- A file that cannot be read is never overwritten: the server uses its defaults, prints the problem,
  and the page shows it and takes no change until the file is fixed.
- The core owns the file, and `URAEDA_CONFIG_DIR` moves its folder; there is no `ura config`
  command.
- Sign-in has no setting: signing out is an action.
- This feature is built on basic security, now merged; per-repository and per-feature overrides wait
  for the run options feature.
- One settled point changed with your answer: the theme does not stay in the sidebar's footer; it
  moves into Appearance (Q5's note).

Settled while writing this spec:

- **No "This repository" category**: with renaming left out
  ([Q8](clarifications-01.md#q8-does-renaming-a-repository-stay-a-placeholder)), it would hold
  nothing; it comes with the first repository setting.
- **Categories, in order**: Server, Appearance, Sign-in, then Agents, Runs, and Reviews, the real
  ones first. Sub-agents during the implementation go in Runs, review settings in Reviews, from the
  proposal's list.
- **Keys** are `snake_case` under `[server]`: `allowed_hosts`, `port`, `open_browser`, like Codex's
  file and the serde names of the core.
- **Host names are saved in lower case**: `Host` headers do not depend on case, and a name typed
  twice in two cases is one name.
- **The `--no-open` flag** overrides `open_browser` for one run; no `--open` flag or variable is
  added, since opening the page by hand covers it.
- **No schema line** in the file yet: three keys need no completion; a `#:schema` line can come with
  more settings.
- **The page shows where the file is**, "Kept in ~/.config/uraeda/config.toml, which you can also
  edit by hand.", since the proposal asks for a file to back up.
- **A Settings icon**, Lucide's `settings` outline, joins the app's own icons, since Astryx's
  neutral theme has none.
- **The settings unit sends the problem as text** made by the core, with its line and key, so the
  server and the page say the same thing.
- **Old process files are removed, not moved**, at the first start: a Storybook record is useless
  once its Storybook is stopped, and a token only serves a running server.

## Decisions

New, applied when this spec is approved:

- [Settings](../decisions/settings.md): settings live in `~/.config/uraeda/config.toml`, owned by
  the core, written with comments kept; flags and variables override them for one run and never
  write them; secrets and data stay in the data folder, a running server's files in its `run/`.

Changed, applied when this spec is approved:

- [Distribution](../decisions/distribution.md): the packaged server's settings come from its flags,
  its environment, and the user's settings file, never from a file in a project
  ([proposed change](../decisions/distribution.md#proposed-change-2026-10-16-settings-page)).
- [Stack](../decisions/stack.md): the allowed host names come from the settings, in their order, and
  a change to the file applies to the next request
  ([proposed change](../decisions/stack.md#proposed-change-2026-10-16-settings-page)).

Relied on:

- [Repositories](../decisions/repositories.md): the core keeps finding the data folder; the settings
  file follows the list's pattern, in the config folder instead.
- [Sign-in](../decisions/sign-in.md): no setting turns sign-in off; the cookie's HTTPS test reads
  the allowed host names in force; secrets stay in `sign-in.json`.
- [Agents](../decisions/agents.md): unchanged; the Agents and Runs categories only name the features
  that will change it.
- [CLI](../decisions/cli.md): `toml_edit` measured, about 167 KB in a release binary that uses it (a
  size-optimized binary parsing and editing a document, against one using `serde_json` alone); `ura`
  does not read settings yet, so its binary does not grow.
- [UI behaviour](../decisions/ui-behaviour.md): text saved on Enter or Save, the switch and the
  theme at once, a dialog only to confirm cutting a browser off.
- [UI layout](../decisions/ui-layout.md), [UI components](../decisions/ui-components.md), and
  [UI checks](../decisions/ui-checks.md): two widths, Astryx only, a new size in the theme
  (`--size-settings-index`), the layout checks on the new pages.
- [Preview](../decisions/preview.md): the mockups are stories next to their components.
- [Code quality](../decisions/code-quality.md): `routes.tsx` is at 483 lines; the two settings
  routes keep it under 500.

## Constitution check

| Principle                                  | Complies | Notes                                                                                            |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| I. Humans stay in control                  | yes      | Two decision changes proposed, applied only on approval.                                         |
| II. Git and plain text first               | yes      | Settings are a plain-text file a human edits; no workflow state moves.                           |
| III. Asynchronous by default               | yes      | Nothing in the workflow depends on settings yet.                                                 |
| IV. Review effort matches impact           | yes      | Every question had a recommendation; the overrides show on the page.                             |
| V. Tools are optional                      | yes      | The file is readable and editable by hand, and a hand edit is the command-line path.             |
| VI. Code is checked and stays maintainable | yes      | Host name and port rules live once, in the core; precedence in one server function; tests below. |

## Risk tier

**High**: it changes which host names the server accepts while it runs, a security check, and adds a
file format users edit.

## Details

### Data

The settings file, `config.toml`:

```toml
# Uraeda's settings. The settings page writes this file too, and keeps your comments.

[server]
allowed_hosts = ["mac.tail1234.ts.net"]
port = 4310
open_browser = true
```

Every key is optional; an absent key takes its default: no host names, port 4310, a browser opened.

The core's types, generated for TypeScript by napi-rs:

```rust
pub struct Settings {
    pub server: ServerSettings,
}

pub struct ServerSettings {
    pub allowed_hosts: Option<Vec<String>>,
    pub port: Option<u16>,
    pub open_browser: Option<bool>,
}
```

- A host name is 1 to 253 characters, labels of letters, digits, and hyphens joined by dots, none
  starting or ending with a hyphen; it is saved in lower case. A port is a whole number from 1
  to 65535.
- A file that does not parse, or holds an invalid value, gives a problem, "line 3, port: The port is
  a number from 1 to 65535.", instead of settings.

The binding's functions, each a call into the core:

- `configDir(custom?: string): string`, the folder, from `URAEDA_CONFIG_DIR` when `custom` is unset.
- `readSettings(dir: string): Settings`, throwing the problem.
- `addAllowedHost(dir, name)`, `editAllowedHost(dir, from, to)`, `removeAllowedHost(dir, name)`,
  `setPort(dir, port: number)`, `setOpenBrowser(dir, open: boolean)`: each reads the file as it is,
  refuses on a problem or an invalid value with its message, changes one value with `toml_edit`, and
  writes the file through a temporary file renamed over it.

The server's view of the settings, the fate record `Settings` on the global endpoint, id `settings`:

```ts
type Source =
  | { kind: "default" }
  | { kind: "file" }
  | { kind: "flag"; name: "--allowed-hosts" | "--port" | "--no-open" }
  | { kind: "environment"; name: "URAEDA_ALLOWED_HOSTS" | "URAEDA_PORT" };

type Setting<T> = { inForce: T; saved: T | null; source: Source };

type SettingsRecord = {
  id: "settings";
  file: string; // with ~ for the home folder
  problem: string | null;
  server: {
    allowedHosts: Setting<Array<string>>;
    port: Setting<number>;
    openBrowser: Setting<boolean>;
  };
};
```

The flow: at start, `main` reads flags and variables, `configDir` and `readSettings` give the file,
and the settings unit computes the values in force; the port and opening a browser are used once,
the host names on every request. When the file changes, the unit reads it again, after 100 ms of
quiet, as the list of repositories does, recomputes the values in force, tells the host check, and
publishes the record's live update.

In the data folder: `repositories.json`, `sign-in.json`, `runner.sqlite`, and `images/` stay;
`storybooks/<pid>.json` becomes `run/storybooks/<pid>.json`, and `server-<port>.token` becomes
`run/server-<port>.token`. `run/` is created with mode `0700`.

### Components

- **Settings module** (`crates/core/src/settings.rs`, with `api/settings.rs` and the binding's
  functions): the folder, the types, reading, validating, and the five changes, under the core's
  write lock. `toml_edit` joins the workspace, with only its parsing, display, and serde features.
- **Server settings unit** (`packages/server/src/settings.ts`): the precedence function, from the
  flags and variables `options.ts` and `env.ts` report with their names, and the file; the watcher;
  a subscription the host check, the sign-in routes, and the fate source use.
- **`env.ts` and `options.ts`**: report each value given, and the name of the flag or variable it
  came from, without defaults; `loadEnv` keeps reading a checkout's `.env` for `vp dev` only.
- **Host check** (`packages/server/src/guard.ts`): `guardCheck` takes the allowed host names as a
  function of the moment, and rebuilds its host and origin sets when the list changes.
- **Run folder helper** (`packages/server/src/run-folder.ts`): `runFolder(dataDir)`, used by the
  Storybook records (`preview/groups.ts`) and the host token (`sign-in/host.ts`), and the first
  start's removal of the old files.
- **Fate source and mutations** (`packages/server/src/fate/`): the `Settings` record, and
  `settings.addHost`, `settings.editHost`, `settings.removeHost`, `settings.setPort`, and
  `settings.setOpenBrowser`, each returning the record or the core's message.
- **Settings page** (`packages/web/src/settings/`): `categories.ts`, the categories and their later
  settings; `SettingsView.tsx`, the layout; `ServerSettings.tsx` and `OtherSettings.tsx`, the
  categories; `SettingsPage.tsx`, the route component, reading the record through the global fate
  client, passing `window.location.hostname` as the browser's host name, and asking before removing
  it. The strings are those of the stories and the scenarios above.
- **Routes** (`packages/web/src/routes.tsx`, `App.tsx`): `{ page: "settings"; category?: string }`,
  for `/settings` and `/settings/<category>`.
- **Sidebar footer** (`packages/web/src/Shell.tsx`): a `SideNavItem` "Settings", with the
  `uraeda:settings` icon, selected on the settings page; the theme switch leaves it. Folded, the
  icon alone, with "Settings" as its name.
- **Repository menu** (`packages/web/src/RepositoryMenu.tsx`): its sign-out group and its error
  banner go; `sign-in/SignOutList.tsx` is deleted; `useSignOut.ts` serves the Sign-in category.
- **README and `.env.example`**: the settings file, its folder, and the order of sources.

### Error handling

- **Invalid host name or port**: under the field, the core's message, with the typed text kept, as
  in US1 and US3.
- **A file that cannot be read**: the problem in the server's output at start and on each change,
  and in the Server category's banner, as in the edge cases.
- **A write that fails**, like a read-only folder: under the field, "Could not save
  ~/.config/uraeda/config.toml: permission denied.", the typed text kept.
- **The server unreachable** during a change: "Could not reach the Uraeda server." under the field;
  during a sign-out, in the Sign-in category.

### Testing

The integration tests run the real server over the fixture repository, on the fake agent, with
`URAEDA_DATA_DIR` and `URAEDA_CONFIG_DIR` set to fresh folders, and drive the page in WebKit at the
phone's and the desktop's sizes through roles and labels, asserting what the page shows and what the
file holds. Their setup clears `URAEDA_ALLOWED_HOSTS`, which the browser tests set today, except
where a scenario sets it.

| What                                                   | Test                                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| US1 scenarios 1–4, 6–8; SC-001                         | Browser test of the Server category, then a request with each `Host`                                                    |
| US1 scenario 5, and the flag case of the edge cases    | Happy-dom test of the page opened at `mac.tail1234.ts.net`                                                              |
| US1 scenario 2; SC-002; unknown keys; no config folder | Core table-driven test of each change, against the file's text before and after                                         |
| Host name and port validity; the core's problems       | Core table-driven test, one row per value                                                                               |
| US2 scenarios 1–3, 5; SC-003                           | Server table-driven test of the precedence, flag × variable × file × default, and the file's bytes after a start        |
| US2 scenario 4                                         | Browser test with `--allowed-hosts`                                                                                     |
| US3 scenarios 1–3; the port changed while running      | Browser test of the port and the switch, then a server started on the file                                              |
| US4 scenarios 1–6; an unknown category                 | Browser test at both sizes                                                                                              |
| US5 scenarios 1–3                                      | Browser test of Appearance, and the sidebar without the switch                                                          |
| US6 scenarios 1–4                                      | The sign-out browser tests of basic security, moved to the Sign-in category                                             |
| A file that cannot be read; broken while open; deleted | Server test of start and watch, and a browser test of the banner                                                        |
| A hand edit and a page change at the same moment       | Core test: a change applied to a file edited after it was read                                                          |
| Process files from before this feature                 | Server test of the first start over an old data folder                                                                  |
| `URAEDA_CONFIG_DIR` relative; the folder's resolution  | Core table-driven test, like the data folder's                                                                          |
| SC-004, SC-005                                         | The layout and accessibility checks, with `/settings`, `/settings/server`, and `/settings/sign-in` added to their pages |
| The packaged server reads the file, and no `.env`      | The package's smoke test, with `URAEDA_CONFIG_DIR` set                                                                  |
