# Extensions

An extension is a folder of TypeScript that adds to or replaces a part of Uraeda's server and web
UI: a place in the navigation, a pane of Home, a key, a data record, a route, an agent runtime, or
code that runs when something happens in a repository. Uraeda compiles it, runs it, and reloads it
when you save, with no build step, package install, or restart. Uraeda's own parts, from Claude Code
to the inbox, are built-in extensions on the same API, and each one can be turned off.

This page is written for you and for the agent of a session, which is told where it is and may write
your extensions. The
[extensions](https://github.com/mrtolkien/uraeda/blob/main/specs/decisions/extensions.md) decision
holds the rules. The web UI's package ships this page: its links lead to Uraeda's repository on
GitHub, where the example and the API's types are.

## Where extensions live

Your extensions are the folders of `extensions/` in your config folder:
`~/.config/uraeda/extensions/`, or `$XDG_CONFIG_HOME/uraeda/extensions/`, or
`$URAEDA_CONFIG_DIR/extensions/`. Uraeda loads extensions from there only, never from a repository.
Each folder is one extension, and its name is the extension's name:

```text
~/.config/uraeda/extensions/wiki/
  extension.toml   # the manifest
  server.ts        # the server entry, when the manifest names one
  page.tsx         # the page entry, when the manifest names one
  lib/pages.ts     # any file the entries import
  skills/<name>/   # agent skills, in the Agent Skills format
```

A folder there may be a symbolic link to a folder you keep elsewhere, as `ura extension add` makes
one. Your extensions run with your rights, as Uraeda's own code does: an extension can read every
repository in Uraeda's list, commit, and run agents. Install only the ones you would run yourself.

## A first extension

[`examples/extensions/wiki/`](https://github.com/mrtolkien/uraeda/tree/main/examples/extensions/wiki)
is a whole extension: a Wiki place, opened with `Space w`, that lists the Markdown files of the
repository's `docs/` folder and draws the one you pick. Its three files:

- [`extension.toml`](https://github.com/mrtolkien/uraeda/blob/main/examples/extensions/wiki/extension.toml)
  names it, its entries, and its setting `folder`, `docs` by default.
- [`server.ts`](https://github.com/mrtolkien/uraeda/blob/main/examples/extensions/wiki/server.ts)
  registers the record `pages`, read from the repository's folder, and sends it again when a commit
  lands.
- [`page.tsx`](https://github.com/mrtolkien/uraeda/blob/main/examples/extensions/wiki/page.tsx)
  registers the place, which reads the record with `useRecord` and draws it with Astryx's components
  and StyleX.

To try it from a checkout of Uraeda, link it, and say where it is on:

```sh
ura extension add examples/extensions/wiki --here   # on in the repository you are in
```

Copy the folder elsewhere to make it yours, then edit it: each save reloads it.

## The manifest, `extension.toml`

```toml
name = "wiki"                   # kebab-case, the folder's name
title = "Wiki"                  # shown on the settings page
description = "The Markdown pages of a repository's documentation folder."
version = "0.1.0"               # your extension's own version, shown on the settings page
api = 1                         # the extension API it is built for
icon = "uraeda:book-open"       # an icon of the app's set
scope = "repository"            # "global" or "repository": what `ura extension add` suggests first
server = "server.ts"            # its server entry, optional
page = "page.tsx"               # its page entry, optional

[settings.folder]
type = "string"                 # bool, integer, string, or list, a list of strings
default = "docs"
label = "Folder"
help = "The folder of the repository the pages are read from."
```

`name` and `api` are required, and a setting needs a `type` and a `default`. An entry must be a file
inside the folder. The names of the built-in extensions are taken: `claude`, `fake`, `inbox`,
`priorities`, `decisions`, `git`, `previews`, and `notifications`. `on` and `repositories` are not
setting names.

An icon is one of the app's set: `uraeda:` and a name of a [Lucide](https://lucide.dev/icons/) icon
the app ships, like `uraeda:book-open`, `uraeda:database`, `uraeda:globe`, or `uraeda:rows-3`, each
listed in `uraedaIcons` of
[`theme/icons.ts`](https://github.com/mrtolkien/uraeda/blob/main/packages/web/src/theme/icons.ts).
Without one, an extension shows a plug.

This Uraeda runs extension API **1**. An extension built for another is turned off, and the settings
page says `built for extension API 1, and Uraeda runs API 2`, with its numbers. A change of the API
turns your extensions off until they are updated, by you or an agent.

## Where it is on, and its settings

An extension is on in every repository, or in the ones you name, by their names in Uraeda's list.
Its settings hold for every repository, and a repository may have its own. Both live in
`config.toml`, beside the other settings, and the settings page writes them, keeping your comments:

```toml
[extensions.wiki]
on = ["uraeda", "notes"]   # "all" by default; [] turns it off
folder = "docs"            # its settings for every repository

[extensions.wiki.repositories.uraeda]
folder = "wiki"            # its settings in uraeda, over the ones above
```

A value that fails its setting's type is left out: the extension runs on the default, and the
settings page names the setting and the problem. An `on` that is neither `"all"` nor a list of names
turns the extension off. A repository that leaves Uraeda's list keeps its settings, unused until it
returns. When `config.toml` cannot be read, your extensions are off until it can, and the built-in
ones run on their defaults.

Settings, Extensions lists "Your extensions" and the built-in ones, each with a switch, "Only in…",
and its settings for every repository or one. `ura extension add` asks where a new one is on.

## Server code

The server entry's default export is called once each time the extension loads, with the server API,
which it registers through:

```ts
import type { ServerApi } from "uraeda/server";

export default function activate(api: ServerApi) {
  const pages = api.record("pages", (repository) => readPages(repository));
  api.on("commit-landed", (event) => pages.changed(event.repository));
}
```

The activation must be synchronous, and finish within 2 seconds: one that returns a promise is
refused with `activation must be synchronous: start async work from a callback, not while loading`.
Start async work from a callback the API calls, like a record's read, or from a timer.

Server code imports Node's modules, by `node:` names, its own files, by relative paths, and types
from `uraeda/server`. It cannot import an npm package: there is no install. Copy a small library
into the folder instead.

### The server API

| Method                          | What it does                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `record(name, read)`            | A data record pages read through fate, as `useRecord(name)`; gives `changed(repository?)`             |
| `action(name, run)`             | An action pages run through fate, as `useAction(name)`, with an input and an output                   |
| `route(path, handler, method?)` | An HTTP route under `/x/<name>/`, behind sign-in                                                      |
| `on(event, handler)`            | Calls `handler` with each event of that name, in the repositories the extension is on in              |
| `runtime(runtime)`              | An agent runtime, under the extension's name                                                          |
| `settings(repository)`          | Its settings in a repository, defaults filled in; `{}` where it is off; every repository's for `null` |
| `repositories()`                | The repositories it is on in, each `{ name, path }`, the path its main checkout's                     |
| `log(message)`                  | Prints a line to the server's output, after the extension's name                                      |

Everything an extension registers is scoped to it, and undone when it unloads. The API refuses a
call from a version already unloaded, `wiki: this version of the extension was unloaded`, so a
listener an old version left behind does nothing. `setTimeout`, `setInterval`, `setImmediate`, and
`queueMicrotask` are the extension's own: their callbacks never run after it unloads, and one that
throws turns the extension off alone.

### Records and actions

A record is the extension's data, which its pages read through fate, Uraeda's data channel, like the
rest of the app: a page never fetches its own data. Its `read(repository)` gives a JSON value, or a
promise of one, for the repository the page is drawn in, only where the extension is on.
`changed(repository)` sends the record again to that repository's pages, and `changed()` to every
one's. A record that throws reaches the page as its error.

An action is what a page asks the server to do: `run(input, repository)` gets the page's input as
JSON and gives the output. It is refused where the extension is off. Record and action names are
letters, digits, `.`, `_`, or `-`.

A record, an action, or a route has 10 seconds to answer. Past them, the record reads with the error
`wiki: no answer in 10 s`, the action is refused, and the route answers 504; the call itself goes
on, no longer waited for.

### Routes

A route's path starts with `/x/<name>/`, and a path ending in `/*` takes every path under it; any
other path is refused, naming the extension. The handler gets [Hono](https://hono.dev/)'s context
and the repository, and gives a `Response`. A route answers at its path, with no repository, and
under each repository's `/r/<repo>`, where the extension is on. Without a method, it answers GET and
POST; a GET route answers HEAD too.

Every route needs a signed-in browser, as every page of Uraeda does, and refuses a request another
site sent with 403. A route that throws answers 500.

```ts
api.route("/x/wiki/raw/*", (c, repository) => c.text(rawPage(repository, c.req.path)), "GET");
```

### Events

`api.on(event, handler)` gets the events of the repositories the extension is on in. Each payload
has the `repository`, by name, and the `time`, in ISO 8601:

| Event             | When                                          | Its payload, besides `repository` and `time`                                          |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `step-reached`    | A feature or a change reached a workflow step | `feature`, `step`, `waitsOn`: `"agent"`, `"human"`, or `"nobody"`                     |
| `turn-ended`      | A session's turn ended                        | `session`, `feature` (null for a chat), `state`: `"done"`, `"failed"`, or `"stopped"` |
| `commit-landed`   | The main checkout's `HEAD` moved to a commit  | `commit`, `branch` (null when detached)                                               |
| `session-started` | A session was made                            | `session`, `runtime`                                                                  |

`step` is the step's name, like `plan`, except at a human gate, where it is the kind of the file
waiting for you, like `spec`. A handler that throws or rejects is reported under the extension's
name, and never stops the event for others.

### Runtimes

An agent runtime is what sessions run on. Claude Code is the built-in `claude` extension, and a
runtime of yours is registered with `api.runtime(runtime)`, under your extension's name. A session
stores the name of the runtime it was started on, and keeps running on it; new sessions take the
first runtime on in the repository, Claude Code before yours. Where a session's runtime is off, its
transcript shows, and the composer says `pi-durable is off: turn it on to continue this session`.
Where every runtime is off, starting a session says
`No agent runtime is on here: turn one on in Settings, Extensions`.

A runtime implements the contract every agent is reached through, the `Runtime` type of
`uraeda/server`: its `name`, `kind`, `icon`, and `capabilities`, `open` for a session's process,
`hasSession`, `allowRule`, and `version`. Its process sends `AgentEvent`s: the session's start,
text, tool calls and their ends, the turn's result, limits, and usage. Usage is a list of windows,
each `{ id, label, used, resetsAt }`, `used` from 0 to 1, which the usage window draws as it draws
Claude Code's five hours and week.
[`runner/claude.ts`](https://github.com/mrtolkien/uraeda/blob/main/packages/server/src/runner/claude.ts)
is a whole runtime, and
[`runner/fake.ts`](https://github.com/mrtolkien/uraeda/blob/main/packages/server/src/runner/fake.ts)
a scripted one.

A runtime reloads only once its sessions' turns end: until then the settings page says
`Wiki reloads when the turn of “…” ends`, with the session's title.

## Page code

The page entry's default export is called each time the page loads, with the page API, which it
registers through. Its components are React components:

```tsx
import { useRecord, type PageApi } from "uraeda/page";

function Wiki() {
  const wiki = useRecord<{ pages: Array<{ title: string }> }>("pages");
  return (
    <ul>
      {wiki.pages.map((page) => (
        <li key={page.title}>{page.title}</li>
      ))}
    </ul>
  );
}

export default function page(api: PageApi) {
  api.place({ component: Wiki, icon: "uraeda:book-open", id: "wiki", key: "w", title: "Wiki" });
}
```

Its activation must be synchronous too. A page imports only its own files and the app's own copies
of these modules, so it draws with the same React and the same theme as the app:

- `react`, `react-dom`, `react/jsx-runtime`
- `@astryxdesign/core` and its subpaths, like `@astryxdesign/core/Button`: the design system the app
  draws with
- `@astryxdesign/core/theme/tokens.stylex`: the theme's tokens, `colorVars`, `spacingVars`,
  `radiusVars`, and the rest
- `@stylexjs/stylex`: StyleX, for styles
- `uraeda/page`: the hooks below, and the `PageApi` type

A page cannot import a `node:` module, or a value of its server code: a type is fine, as types are
stripped.

### The page API

| Method                     | What it adds                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `place(place)`             | A place: a row in the navigation column, an entry in the leader menu, and a page of its own |
| `homePane(pane)`           | A pane of Home, in column `0` or `1`                                                        |
| `newSection(section)`      | A section of the New page, under the composer                                               |
| `statusItem(item)`         | An item of the status line                                                                  |
| `itemRenderer(renderer)`   | What draws a tool's items in a session, by the tool's name, in place of its output          |
| `settingsSection(section)` | A section under the extension's row in Settings, Extensions                                 |
| `key(key)`                 | A key under the leader, `Space`                                                             |

- A **place** is `{ id, title, icon, component }`, with an optional `key`, its key after `Space`;
  `count`, a function called as a hook while its row draws, giving the number the row shows, which
  cannot call the hooks of `uraeda/page`; and `phoneTab`, `"bar"` or `"more"`, to show it among the
  phone's tabs. It opens at `/r/<repo>/e/<name>/<id>`, drawn in the app's column, at the app's
  widths.
- A **home pane** is `{ id, title, icon, column, tone, component }`, `tone` one of `"now"`,
  `"ongoing"`, `"later"`, or `"neutral"`.
- A **New-page section** is `{ id, title, tone, component }`; its component gets `search`, the
  composer's text, and `onInsert(text)`, which puts a text in the composer.
- A **status item** is `{ id, component }`.
- An **item renderer** is `{ tool, component }`; its component gets the session's `item`.
- A **settings section** is `{ id, title, icon, component }`.
- A **key** is `{ keys, label, run, icon? }`: `keys` is one key after `Space`, like `"y"`, or a
  sequence under one of Uraeda's groups, like `"n y"` under New.

The places, panes, and sections show only in the repositories the extension is on in, after Uraeda's
own, then yours by name. A key is kept by the first extension that registers it, and Uraeda's own
keys win over every extension's. A key lost shows on the settings page as
`` `y` is taken by Deploy ``.

Each component is drawn inside its extension's own boundary: one that throws shows "Wiki: <message>"
in its place, and the rest of the page goes on.

### The hooks of `uraeda/page`

| Hook                        | What it gives                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `useRecord<T>(name)`        | The extension's record in the current repository, redrawn as it changes; throws its error        |
| `useAction<I, O>(name)`     | A function that runs the action with an input, and gives its output or throws why it was refused |
| `useExtensionSettings<T>()` | The extension's settings in the current repository, defaults filled in                           |
| `useRepository()`           | The current repository's name                                                                    |

They know which extension calls them, and work only in a component the page API draws.

### Styles and the theme

Pages are compiled as the app's own components are: StyleX's styles, with the app's options, and
React Compiler. Style with `stylex.create` on the theme's tokens, and pass the styles to an Astryx
component's `xstyle` prop, or to an element through `stylex.props`:

```tsx
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  body: {
    backgroundColor: colorVars["--color-background-surface"],
    paddingBlock: spacingVars["--spacing-4"],
  },
});
```

A style on a token follows the colour theme picked, light or dark, as the app's do, and gets the
same class as the app's, so it overrides Astryx's as it would in the app. Ask for a colour by its
role, like `--color-text-secondary`, never a hue. Draw text with Astryx's `Text`, `Heading`, and
`Markdown`, and lay out with `VStack` and `HStack`: the page then reads like the rest of Uraeda at a
phone's width and a desktop's.

## The TypeScript Uraeda compiles

Uraeda compiles each `.ts` and `.tsx` file itself, with no `tsconfig.json`, and runs it in strict
mode. Types are stripped, never checked. Some module syntax has no place in it:

- Only `.ts` and `.tsx` files: a `.js` file cannot be imported.
- No top-level `await`: load in the function you export.
- No dynamic `import()`, and no `import.meta`.
- No `import x = require("y")`, and no `export =`.
- A relative import names a file of the folder, with or without its ending: `./pages` finds
  `pages.ts`, `pages.tsx`, `pages/index.ts`, or `pages/index.tsx`. A path out of the folder, by `..`
  or a link, is refused. A file over 2 MB is refused.
- An import is a copy of the value, taken when the importing file runs: a file importing one that
  imports it back reads `undefined` for what is not defined yet. Avoid import cycles.

A compile error turns the extension's new version away, with its file and line on the settings page,
and the version before it keeps running.

## Reloading

An extension whose folder has no `.ura-source`, a linked folder or one written in place, reloads
each time you save one of its files, within a second, and when its settings or where it is on
change. Its old version is undone first: its records, routes, listeners, timers, places, and keys. A
page redraws without reloading the browser's page, and loses its unsaved state, like the text of a
field.

An extension `ura` installed from git changes only when `ura extension update` moves it.

## Skills

An extension's `skills/` folder, in the [Agent Skills](https://agentskills.io/) format, reaches the
agent of every session in the repositories the extension is on in, beside the Uraeda skill: Claude
Code gets it as a plugin of its own. A skill tells the agent how to use your extension, or anything
else; the instructions of a session are Uraeda's, and an extension adds none.

## When something breaks

A broken extension stops alone: Uraeda and every other extension go on. Settings, Extensions shows
each problem above the rows, with its file and line when it has one:

- A manifest or a setting it cannot read, or a file that does not compile.
- Server code that throws while loading, runs over 2 seconds, or throws later from a timer, a
  callback, or a promise: the extension is turned off until its files or its settings change.
- A page that throws while registering, an import a page cannot have, or a component that throws as
  it draws.
- A linked folder that was deleted: `folder not found`.
- An extension built for another API version.

`api.log` writes to the server's output, where a route's or a listener's error also shows, after the
extension's name.

## `ura extension`

`ura extension` manages the folders of your extensions folder, and the `on` of each. It never runs
an extension's code.

```sh
ura extension add ~/code/uraeda-wiki                     # link a folder; asks where it is on
ura extension add github.com/gary/uraeda-deploy --all    # clone, pinned to its branch's commit
ura extension add ~/code/uraeda-wiki --repo uraeda --repo notes
ura extension update deploy                              # fetch, print the diff, move once you confirm
ura extension remove deploy                              # the folder, or only the link; settings stay
ura extension list --json                                # every extension, the built-in ones first
```

`add` takes a folder, which it links as `extensions/<name>`, or a git URL, which it clones and
checks out at its default branch's commit, writing `.ura-source` with the URL, the commit, and the
branch. A URL without a scheme is cloned over `https://`. It refuses a built-in extension's name,
one installed already, and a manifest with a fatal problem. Without a terminal, give `--all`,
`--here`, or `--repo <name>`, repeated for more. `update` refuses a linked extension: edit its
folder instead. See [the CLI's page](https://github.com/mrtolkien/uraeda/blob/main/docs/cli.md) for
the rest.

## Changing a part of Uraeda

Uraeda's own parts are built-in extensions: `claude`, Claude Code; `fake`, the scripted agent of the
tests and the sandbox; `inbox`; `priorities`, the priorities and starting from a proposal;
`decisions`; `git`, the Git page; `previews`, the Storybook previews; and `notifications`. Each is
turned off on the settings page, everywhere or in some repositories, like yours. Turning one off
removes its place, keys, panes, and sections; its files stay, and `ura check` still checks them. A
link to a place turned off opens a page saying "Inbox is off here", with "Turn it on here".

To change a built-in, leave Uraeda's source as it is: turn the built-in off, and write an extension
that adds the part as you want it. Sessions, the session page, and the composer are always on.

## Types

The compiler strips types, so they matter only to your editor and your agent. The server API's types
are in
[`extension-api.ts`](https://github.com/mrtolkien/uraeda/blob/main/packages/server/src/extension-api.ts),
imported as `uraeda/server`; the page API's in
[`pageApi.ts`](https://github.com/mrtolkien/uraeda/blob/main/packages/web/src/extensions/pageApi.ts)
and
[`registry.ts`](https://github.com/mrtolkien/uraeda/blob/main/packages/web/src/extensions/registry.ts),
and the hooks in
[`hooks.ts`](https://github.com/mrtolkien/uraeda/blob/main/packages/web/src/extensions/hooks.ts),
imported as `uraeda/page`. The example's
[`tsconfig.json`](https://github.com/mrtolkien/uraeda/blob/main/examples/tsconfig.json) maps both
onto a checkout of Uraeda.
