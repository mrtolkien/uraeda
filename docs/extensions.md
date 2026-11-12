# Extensions

An extension is a folder of TypeScript that adds to or replaces a part of Uraeda: a place of the
app, a pane of Home, a key, a data record, an action, a route, an agent runtime, or code that runs
when something happens in a repository. Uraeda compiles it, runs it, and reloads it when you save,
with no build step, package install, or restart. Uraeda's own places, from the inbox to Jobs, are
built-in extensions declared the same way, and each one can be turned off.

This page is written for you and for the agent of a session, which is told where it is and may write
your extensions: it holds everything needed to write one, with a whole example. The
[extensions](https://github.com/mrtolkien/uraeda/blob/main/specs/decisions/extensions.md) decision
holds the rules.

An extension has two halves, each optional:

- **Its server code**, `server.ts`, runs inside Uraeda's server, in a sandboxed JavaScript engine of
  its own: it registers records, actions, routes, event handlers, and an agent runtime.
- **Its page**, `page.tsx`, runs in the app: it declares places, panes, keys, and items, and draws
  them with the app's own components. A page reads and writes only through its server code's records
  and actions.

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
one. Your extensions run with your rights, as Uraeda's own code does: an extension can read and
write your files, run commands, and reach the network. Install only the ones you would run yourself.

An agent's session may write your extensions folder, as it may any file you can write: an agent can
write code the server runs as you, on its next save, in every repository the extension is on in,
with no review step between. Read a session's changes to your extensions before relying on them.

A folder written straight into the extensions folder, with no `[extensions.<name>]` table in
`config.toml`, is on in every repository from its first saved file. So a session writing an
extension creates its folder with its `extension.toml` first, runs
`ura extension add <folder> --here` to turn it on in its repository alone, and only then writes its
code. Uraeda's instructions to the agent say so.

## A whole extension, step by step

The Wiki, in Uraeda's repository at
[`examples/extensions/wiki/`](https://github.com/mrtolkien/uraeda/tree/main/examples/extensions/wiki),
lists the Markdown files of a repository's `docs/` folder in a place of its own, `Space k`, with
their count in the rail, draws the one you pick, and adds a pane to Home. It uses every common part
of the API: a setting, two records, an action, an event, a place with a key and a count, and a pane
of Home. Its three files follow, whole.

**`extension.toml`**, which names it, its entries, and its setting `folder`:

```toml
name = "wiki"
title = "Wiki"
description = "The Markdown pages of a repository's documentation folder."
version = "0.2.0"
api = 1
icon = "book-open"
scope = "repository"
server = "server.ts"
page = "page.tsx"

[settings.folder]
type = "string"
default = "docs"
label = "Folder"
help = "The folder of the repository the pages are read from."
```

**`server.ts`**, the server code: the record `pages`, the record `count`, which the rail shows, and
the action `read`, a page's text. Both records are sent again when a commit lands.

```ts
import type { ServerApi } from "uraeda/server";
import { exists, join, list, readText, relative } from "uraeda:fs";

/** A page: its path in the folder, and its title. */
export type WikiPage = { path: string; title: string };

/** The record `pages`: the folder it read, whether it is there, and its pages by path. */
export type Wiki = { folder: string; isMissing: boolean; pages: Array<WikiPage> };

/** The most pages the record holds: a larger folder is cut, so the page stays quick. */
const MOST_PAGES = 200;

/** The most characters of a page `read` gives: a longer one is cut, with a note saying so. */
const MOST_CHARACTERS = 256 * 1024;

/** The page's title: its first `# ` heading, else its path without `.md`. */
function titleOf(path: string, text: string): string {
  return /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? path.replace(/\.md$/, "");
}

/** The Markdown files under `folder`, by their path in it, in order. */
function markdownFiles(folder: string, under = folder): Array<string> {
  return list(under)
    .flatMap((entry) => {
      const path = join(under, entry.name);
      if (entry.kind === "folder") return markdownFiles(folder, path);
      return entry.kind === "file" && entry.name.endsWith(".md") ? [relative(folder, path)] : [];
    })
    .sort();
}

export default function activate(api: ServerApi) {
  /** The wiki's folder in `repository`, refused when the setting leads out of it. */
  const folderOf = (repository: string) => {
    const root = api.repositories().find((one) => one.name === repository)?.path;
    if (root === undefined) throw new Error(`no repository named ${repository}`);
    const named = String(api.settings(repository).folder);
    const folder = join(root, named);
    if (relative(root, folder).startsWith("..")) {
      throw new Error(`the folder ${named} is outside the repository`);
    }
    return { folder, named };
  };

  const readWiki = (repository: string): Wiki => {
    const { folder, named } = folderOf(repository);
    if (!exists(folder)) return { folder: named, isMissing: true, pages: [] };
    const pages = markdownFiles(folder)
      .slice(0, MOST_PAGES)
      .map((path) => ({ path, title: titleOf(path, readText(join(folder, path))) }));
    return { folder: named, isMissing: false, pages };
  };

  const pages = api.record("pages", readWiki);
  const count = api.record("count", (repository) => readWiki(repository).pages.length);

  api.action("read", (input: { path: string }, repository) => {
    const { folder } = folderOf(repository);
    const path = join(folder, input.path);
    if (relative(folder, path).startsWith("..")) throw new Error("that page is outside the wiki");
    if (!exists(path)) throw new Error(`${input.path} is gone: it was moved or removed`);
    const text = readText(path);
    return text.length <= MOST_CHARACTERS
      ? text
      : `${text.slice(0, MOST_CHARACTERS)}\n\nThis page is cut here: open its file for the rest.`;
  });

  api.on("commit-landed", (event) => {
    pages.changed(event.repository);
    count.changed(event.repository);
  });
}
```

**`page.tsx`**, the page: the place, with `count` naming the record the rail shows and `key` its key
after `Space`, and a pane of Home in its second column.

```tsx
import { effect, Scroll, signal, View } from "nsh";
import { homePane, navigate, place, useAction, useRecord, useRepository } from "uraeda/page";
import { Banner, Empty, Heading, Line, Row, Spinner, Text } from "uraeda/ui";
import type { Wiki, WikiPage } from "./server";

/** The wiki's pages, or why they cannot be shown: the record's error, or its folder missing. */
function usePages() {
  const wiki = useRecord<Wiki>("pages");
  const missing = () => {
    const value = wiki().value;
    return value?.isMissing === true ? value.folder : undefined;
  };
  return { missing, pages: () => wiki().value?.pages ?? [], wiki };
}

/** The place: the pages, a row each, and the one picked under them. */
function WikiPlace() {
  const { missing, pages, wiki } = usePages();
  const read = useAction<{ path: string }, string>("read");
  const picked = signal<string | undefined>(undefined);
  const text = signal<string | undefined>(undefined);
  const refused = signal<string | undefined>(undefined);
  // The first page until another is picked; each pick reads it.
  effect(() => {
    const path = picked() ?? pages()[0]?.path;
    if (path === undefined) return;
    refused.set(undefined);
    read({ path }).then(
      (page) => text.set(page),
      (error: unknown) => refused.set(error instanceof Error ? error.message : String(error)),
    );
  });
  const shown = () => picked() ?? pages()[0]?.path;
  return (
    <Scroll style={{ flex: 1 }}>
      <View style={{ gap: 12 }}>
        <If when={wiki().error}>
          {(error) => <Banner title={`The wiki cannot be read: ${error()}`} tone="danger" />}
        </If>
        <If when={missing()}>
          {(folder) => (
            <Empty
              icon="book-open"
              title={`No folder ${folder()}`}
              words="The wiki reads the Markdown files of this folder of the repository. Name another in Settings, Extensions, Wiki."
            />
          )}
        </If>
        <Each key={(page: WikiPage) => page.path} of={pages()}>
          {(page) => (
            <Row onPress={() => picked.set(page().path)} selected={shown() === page().path}>
              <Line icon="file-text" label={page().title} meta={page().path} />
            </Row>
          )}
        </Each>
        <If when={refused()}>{(words) => <Banner title={words()} tone="caution" />}</If>
        <If when={text()} else={<Spinner label="Reading the page" />}>
          {(page) => <Text font="code">{page()}</Text>}
        </If>
      </View>
    </Scroll>
  );
}

/** The pane of Home: the first pages, each opening the place. */
function WikiHome() {
  const { pages } = usePages();
  const repo = useRepository();
  return (
    <View style={{ gap: 4 }}>
      <Heading level={3}>{`${pages().length} pages`}</Heading>
      <Each key={(page: WikiPage) => page.path} of={pages().slice(0, 5)}>
        {(page) => (
          <Row onPress={() => navigate(`/r/${repo}/e/wiki/wiki`)}>
            <Line icon="file-text" label={page().title} />
          </Row>
        )}
      </Each>
    </View>
  );
}

place({ count: "count", icon: "book-open", id: "wiki", key: "k", title: "Wiki", view: WikiPlace });
homePane({ column: 1, icon: "book-open", id: "wiki", title: "Wiki", view: WikiHome });
```

To try it from a checkout of Uraeda, link it, and say where it is on:

```sh
ura extension add examples/extensions/wiki --here   # on in the repository you are in
```

Within a second the rail shows "Wiki" with its count, `Space k` opens it, and Home shows its pane.
Copy the folder elsewhere to make it yours, then edit it: each save reloads it. Check what Uraeda
thinks of it with `ura extension list`, which names every problem with its file and line.

## The manifest, `extension.toml`

```toml
name = "wiki"                   # kebab-case, the folder's name
title = "Wiki"                  # shown in the settings, and where a part has no title of its own
description = "The Markdown pages of a repository's documentation folder."
version = "0.2.0"               # your extension's own version, shown in the settings
api = 1                         # the extension API it is built for
icon = "book-open"              # an icon of the app's set
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
inside the folder. The names of the built-in extensions are taken: `claude`, `codex`, `fake`,
`inbox`, `priorities`, `decisions`, `git`, `jobs`, `previews`, and `notifications`, and Uraeda keeps
`uraeda` and `sessions`: an extension with one of these names is refused, as
`sessions is reserved by Uraeda`. `on` and `repositories` are not setting names.

An icon, in the manifest and in a page, is a name of the app's set, the
[Lucide](https://lucide.dev/icons/) icons the app ships, like `book-open`, `database`, `globe`,
`list-checks`, `rows-3`, `sparkles`, or `terminal`, each listed in
[`app/ui/controls/icons/lucide.ts`](https://github.com/mrtolkien/uraeda/blob/main/app/ui/controls/icons/lucide.ts).
`uraeda:book-open` is read as `book-open`. A name the app does not carry draws a plug.

This Uraeda runs extension API **1**. An extension built for another is turned off, and the settings
say `built for extension API 1, and Uraeda runs API 2`, with its numbers. API 1 is the API this page
describes: an extension written for Uraeda's earlier Node server, with `node:` imports and React
pages, fails to load, and says why.

## Where it is on, and its settings

An extension is on in every repository, or in the ones you name, by their names in Uraeda's list.
Its settings hold for every repository, and a repository may have its own. Both live in
`config.toml`, beside the other settings, and the settings write them, keeping your comments:

```toml
[extensions.wiki]
on = ["uraeda", "notes"]   # "all" by default; [] turns it off
folder = "docs"            # its settings for every repository

[extensions.wiki.repositories.uraeda]
folder = "wiki"            # its settings in uraeda, over the ones above
```

A value that fails its setting's type is left out: the extension runs on the default, and the
settings name the setting and the problem. An `on` that is neither `"all"` nor a list of names turns
the extension off. A repository that leaves Uraeda's list keeps its settings, unused until it
returns. When `config.toml` cannot be read, your extensions are off until it can, and the built-in
ones run on their defaults.

Settings, Extensions lists yours and the built-in ones, each with a switch, which turns it on
everywhere or off, "Only in…", the repositories it is on in, and its settings. A change of its
settings, or of where it is on, loads it again. `ura extension add` asks where a new one is on.

## Server code

The server entry's default export is called once each time the extension loads, with the server API,
which it registers through. Everything it registers, and everything it starts, is its own, and gone
when it unloads: at a save, when it is turned off, and when the server stops.

```ts
import type { ServerApi } from "uraeda/server";

export default function activate(api: ServerApi) {
  const pages = api.record("pages", (repository) => readPages(repository));
  api.on("commit-landed", (event) => pages.changed(event.repository));
}
```

It runs in a sandboxed JavaScript engine (QuickJS) inside Uraeda's server, one per extension, on a
thread of its own: no Node, no `node:` module, and no npm package. It imports:

- its own files, by relative paths: `./lib/pages`;
- `uraeda/server`, for the API's types;
- `uraeda:fs`, your files, and `uraeda:process`, commands, below.

An import of anything else is refused with what to use:
`"node:fs" cannot be imported: an extension's server code has no Node. Use uraeda:fs, uraeda:process, and fetch`.
Copy a small library into the folder instead of a package.

Its globals, beside JavaScript's own: `fetch`, `Response`, `Headers`, `TextEncoder`, `TextDecoder`,
`console`, `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, and `queueMicrotask`. There
is no `setImmediate`, no `Buffer`, and no `process`.

### Its limits

- **The activation is synchronous, and has 2 seconds.** One that returns a promise is refused with
  `activation must be synchronous: start async work from a callback, not while loading`. Start async
  work from a callback the API calls, like a record's read, or from a timer.
- **A record, an action, or a route has 10 seconds to answer**, and any piece of the extension's
  code 10 seconds to run. Past them, the record reads with the error `no answer in 10 s`, the action
  is refused, and the route answers 504.
- **Memory**: 256 MB for the engine, and a 1 MB stack.
- **A file read** is at most 64 MB; **`fetch`** answers within 30 seconds, and at most 64 MB, the
  whole answer at once.
- **What turns it off, as broken, until its files or its settings change**: an activation that
  throws or runs over 2 seconds, a piece of code that runs over 10, a timer's callback or a process
  line's handler that throws, a rejection nothing handles, and a crash under its code. A record's or
  an action's throw is that call's error alone, and an event handler's is printed.

### What it can touch

Your extension runs with your rights, through three doors, and reaches Uraeda's server through the
API alone:

- **`uraeda:fs`**: any absolute path you can read or write, whole files and folders: `readText`,
  `readBytes`, `writeText`, `writeBytes`, `appendText`, `list`, `stat`, `exists`, `makeFolder`,
  `remove`, `rename`, and the paths' `join`, `relative`, `parent`, `name`. Each call holds the
  extension's thread until it returns, and nothing of Uraeda's. A pipe or a device is refused.
- **`uraeda:process`**: any command, with `spawn(command, args, { cwd, env })` or `run(...)`, in the
  server's environment, the config folder's `.env` included, in the extension's folder unless it
  names another. Its stdout comes by lines (`onLine`), the blank ones left out, and its stdin takes
  JSON lines (`write`). One still running when the extension unloads is asked to end, and killed 5
  seconds later, with everything it started.
- **`fetch`**: any address, from the server.
- **Of the server**: its own records, actions, routes, and runtime; the events of the repositories
  it is on in; its settings; and the list of those repositories with their paths. It holds no handle
  on Uraeda's own data, another extension, the sessions' store, or sign-in.

### The server API

| Method                          | What it does                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `record(name, read)`            | A data record its page reads with `useRecord(name)`; gives `changed(repository?)`                     |
| `action(name, run)`             | An action its page runs with `useAction(name)`, with an input and an output                           |
| `route(path, handler, method?)` | An HTTP route under `/x/<name>/`, behind sign-in                                                      |
| `on(event, handler)`            | Calls `handler` with each event of that name, in the repositories the extension is on in              |
| `runtime(runtime)`              | An agent runtime, under the extension's name                                                          |
| `settings(repository)`          | Its settings in a repository, defaults filled in; `{}` where it is off; every repository's for `null` |
| `repositories()`                | The repositories it is on in, each `{ name, path }`, the path its main checkout's                     |
| `log(message)`                  | Prints a line to the server's output, after the extension's name                                      |

### Records and actions

A record is the extension's data, which its page reads, live, over the app's own connection: a page
never fetches its own data. Its `read(repository)` gives a JSON value, or a promise of one, for the
repository the page is drawn in, only where the extension is on. `changed(repository)` sends the
record again to that repository's pages, and `changed()` to every one's. What a read throws reaches
the page as the record's `error`.

An action is what a page asks the server to do: `run(input, repository)` gets the page's input as
JSON and gives the output. What it throws is its refusal, which the page's call rejects with. It is
refused where the extension is off. Record and action names are letters, digits, `.`, `_`, or `-`.

### Routes

A route's path starts with `/x/<name>/`, and a path ending in `/*` takes every path under it; any
other path is refused, naming the extension. It answers at its path, with no repository, and under
each repository's `/r/<repo>`, where the extension is on. Without a method, it answers GET and POST;
a GET route answers HEAD too. Every route needs a signed-in client, and refuses a request another
site sent with 403.

The handler gets `(request, repository)`: the request's `method`, `path` (without `/r/<repo>`),
`query`, `headers` (without `Cookie` and `Authorization`), and its body by `text()`, `json()`,
`bytes()`, or `arrayBuffer()`. It answers a `Response`, a text, or any value, sent as JSON. One that
throws answers 500; a `Set-Cookie` it sets is left out.

```ts
api.route("/x/wiki/raw/*", (request, repository) => rawPage(repository, request.path), "GET");
```

### Events

`api.on(event, handler)` gets the events of the repositories the extension is on in. Each payload
has the `repository`, by name, and the `time`, in RFC 3339:

| Event             | When                                          | Its payload, besides `repository` and `time`                                          |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `step-reached`    | A feature or a change reached a workflow step | `feature`, `step`, `waitsOn`: `"agent"`, `"human"`, or `"nobody"`                     |
| `turn-ended`      | A session's turn ended                        | `session`, `feature` (null for a chat), `state`: `"done"`, `"failed"`, or `"stopped"` |
| `commit-landed`   | The main checkout's `HEAD` moved to a commit  | `commit`, `branch` (null when detached)                                               |
| `session-started` | A session was made                            | `session`, `runtime`                                                                  |

`step` is the step's name, like `plan`, except at a human gate, where it is the kind of the file
waiting for you, like `spec`. A handler that throws or rejects is printed under the extension's
name, and never stops the event for others.

### Runtimes

An agent runtime is what sessions run on. Claude Code and Codex are the built-in `claude` and
`codex` extensions, and a runtime of yours is registered with `api.runtime(runtime)`, under your
extension's name: one an extension. A session stores the name of the runtime it was started on, and
keeps running on it. Wherever a session starts, the app offers every runtime on, with the models of
those that list them, and picks the settings' default agent where it is on, else the first runtime
on. Where a session's runtime is off, its transcript shows, and its composer says it is off.

A runtime implements the `Runtime` type of `uraeda/server`: its `name`, `kind`, `icon`, and
`capabilities`; `open(options)`, a session's process, which never throws; `hasSession`; `allowRule`;
and `version`. Its process's `events` are `AgentEvent`s, in order, ending with `exit`: the session's
`init`, text, tool calls (`toolStart`, `toolEnd`), the turn's `result`, limits, and `usage`, a list
of windows, each `{ id, label, used, resetsAt }`, `used` from 0 to 1, which Home's usage pane draws;
the sidebar's draws the window whose `id` is `five_hour`. Its process is a command of
`uraeda:process`, whose stdin takes JSON lines and whose stdout comes by lines.

Optional parts:

- `models()` gives the models the agent lists, `{ models, defaults }`: each model
  `{ id, name, description?, efforts }`, its efforts `{ id, name }`. `open` then gets the `model`
  and `effort` picked, none for the agent's defaults; a process's `setEffort(effort)` changes its
  effort from its next turn on, and its `{ type: "runsOn", model, effort? }` event names what it
  runs on, which the session's header shows. `models`, `version`, and `reviewMessage` may answer a
  promise.
- `accounts`, several accounts of the agent: `list()`, each
  `{ id, name, state, windows, askedAt, known }`, `state` `ready`, `signed-out`, or `missing`;
  `nameOf(id)`; `problems()`, what needs you, in your words; and `refresh(maxAgeMs)`. A new session
  starts on the `ready` account with the most of its first window left, its usage known first, and
  keeps it until a usage limit moves it to another that holds its conversation
  (`hasSession(nativeId, account)`). `open` gets the account's id as `account`.
- `reviewMessage(ask)`: the message that reviews the commits `<base>..<head>` its agent's own way.

A runtime that runs workflow steps takes Uraeda's tools, and turns its agent's own sub-agents off,
as the [run options](https://github.com/mrtolkien/uraeda/blob/main/specs/decisions/run-options.md)
decision requires. For a workflow session, `open`'s `tools` is `{ url, token }`: give the agent the
endpoint as the MCP server `uraeda`, with its tools `run_agent` and `review`, sending
`Authorization: Bearer <token>`, and pass the token in the agent's environment, never its arguments.
For a sub-session, `tools` is `"none"`: no sub-agents at all. A chat gets none, and keeps the
agent's own.

A runtime's extension reloads only once its sessions' turns end: until then the settings say
`Wiki reloads when the turn of “…” ends`, with the session's title.

## Page code

The page entry runs in the app, in an engine of its own, and declares its parts at its top level
with the functions of `uraeda/page`. Each part's `view` is a component of
[Native Shell](https://nsh.dev), the app's UI framework: JSX over signals, with `View`, `Text`,
`Scroll`, `If`, and `Each` (see [nsh.dev/llms.txt](https://nsh.dev/llms.txt)). The Wiki's `page.tsx`
above is a whole page.

```tsx
import { Text } from "nsh";
import { place, useRecord } from "uraeda/page";

function Pages() {
  const pages = useRecord<{ pages: Array<{ title: string }> }>("pages");
  return <Text>{`${pages().value?.pages.length ?? "…"} pages`}</Text>;
}

place({ icon: "book-open", id: "wiki", key: "k", title: "Wiki", view: Pages });
```

A page imports only:

- its own files, `.ts`, `.tsx`, `.js`, `.jsx`, or `.json`, inside its folder;
- `nsh` and `nsh/base`, Native Shell and its unstyled components;
- `uraeda/ui`, the app's own components and tokens, below;
- `uraeda/page`, the page API, below.

A type from its server code is fine, `import type { Wiki } from "./server"`: types are stripped. A
file outside the folder, or a module not in this list, fails the build, which says so in the
settings.

### Each part is a pane of the app

A part is drawn by the app, in a view of its own: a place is a pane of the app, framed, titled, and
moved between the app's two stacks like any other, at whatever width its stack has. A page never
draws its own frame, title bar, or side column, and it follows the app's theme, light or dark, and
its fonts. Each part shown runs the whole page in an engine of its own, so a part keeps no state in
the page's memory that another part could read: its state is the server's records.

| Function                   | What it adds                                                     | Where it shows                                                                            |
| -------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `place(place)`             | `{ id, title, icon, view, key?, count? }`: a place of its own    | A row of the rail, at `/r/<repo>/e/<name>/<id>`, a pane in the main stack                 |
| `homePane(pane)`           | `{ id, title, icon, view, column?, tone? }`: a pane of Home      | Home, its first stack (`column: 0`) or its second (`1`, the default), before Usage        |
| `newSection(section)`      | `{ id, title, view, tone? }`: a section of the New page          | A pane beside the composer; `useProps` gives `{ kind }`                                   |
| `statusItem(item)`         | `{ id, view }`: an item of the status line                       | The status line's end, 160 points wide                                                    |
| `itemRenderer(renderer)`   | `{ tool, view }`: what draws a tool's items in a session         | In place of the tool's line in a transcript, 160 points high; `useProps` gives `{ item }` |
| `settingsSection(section)` | `{ id, title, icon, view }`: a section under the extension's row | Settings, Extensions, 240 points high                                                     |
| `key(key)`                 | `{ keys, label, run, icon? }`: a key under the leader, `Space`   | The leader's menu and the key map                                                         |
| `onUnload(fn)`             | Nothing: `fn` runs as the part drawn goes                        |                                                                                           |

- A place's **`key`** is its key after `Space`: `"k"` is `Space k`; a key the app or another
  extension holds, as `Space w` the panes', leaves the extension's keys out, named in the settings.
  Its **`count`** names a record of the extension whose value is a number, which the rail shows
  after the title: what waits there.
- A **key**'s `keys` is one key after `Space`, like `"y"`, or a sequence under one of Uraeda's
  groups, like `"n y"` under New. The app keeps one view of the page unseen from the key's first
  press, and runs `run` there: it acts through `navigate` and the extension's actions, never by
  drawing. A page's views hear no other key: its keys are the leader's.
- **Keys never clash.** Each extension's keys are declared together. A key that means two things,
  one the app or a built-in has, even a built-in turned off, or one another extension took first,
  leaves all of that extension's keys out: the settings say why, as
  `Wiki's keys are off: A key means two things in Wiki: "space r" is bound twice, …`, and every
  other extension keeps its own.
- **Order**: the built-in places first, in their order, then yours by name, then New and Settings.
  Home's panes, the New page's sections, and the status line's items follow the same order. On a
  phone, a place of yours is in the bar's `…`.

### The hooks of `uraeda/page`

| Hook                        | What it gives                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `useRecord<T>(name)`        | `() => { value, error }`: the extension's record in the repository shown, live; never throws       |
| `useAction<I, O>(name)`     | `(input) => Promise<O>`: runs the action; rejects with why it was refused                          |
| `useExtensionSettings<T>()` | `() => { value, error }`: the extension's settings in the repository shown, defaults filled in     |
| `useRepository()`           | The repository's name the part is drawn for                                                        |
| `useProps<T>()`             | `() => T`: what the app gives the part, `{ kind }` to a New-page section, `{ item }` to a renderer |
| `navigate(to)`              | Opens an address of the repository shown, as a link does: `/inbox`, `/r/todo-app/e/wiki/wiki`      |

`navigate` opens the repository's own pages (home, the inbox, the priorities, a feature and its
files, the decisions, sessions, Git, jobs, the New page, a buffer) and the extension's own places.
It never opens the settings, another repository, or another extension's place: the app refuses, and
says so in its log.

`value` is `undefined` until the record came, and `error` says why there is none: the extension is
off there, has no such record, threw, or did not answer in 10 seconds. A record stays read through a
broken version of the server code, and comes back once a save fixes it.

### What a page may draw with: `uraeda/ui`

`uraeda/ui` is the app's component library, the one every screen of Uraeda draws with, but the app's
frame: [`app/ui/index.ts`](https://github.com/mrtolkien/uraeda/blob/main/app/ui/index.ts) lists it.
The parts a page uses most:

- **Text and controls**: `Text` (`tone`, `bold`, `font`: `body`, `code`, `heading`), `Heading`,
  `Button`, `IconButton`, `Link`, `Badge`, `Banner` (a message with a `tone` and an `action`),
  `Switch`, `Checkbox`, `Select`, `Spinner` (with the `label` of what it waits for), `Icon`, `Kbd`,
  and `TextField`.
- **Lists**: `Row` (a pressed row, `selected`), `Line` (an icon, a label, a quiet `meta`), `Card` (a
  thing of several facts, with its state and times), `Empty` (what a list shows with nothing: its
  `title`, why in `words`, and an `action`), `Table`, `Tree`, `VirtualList` for long lists.
- **Surfaces**: `Dialog`, `Sheet`, `Popover`, `Toast`.
- **Tokens**: `tokens`, the theme's colours by role (`tokens.role.ink`, `tokens.role.inkQuiet`, the
  tones), spaces, and radii. Ask for a colour by its role, never a hue: it then follows the theme.
- `width` and `isNarrow()`: the width class of the window, for a phone's layout.

### A page that breaks

A page that breaks says so in its place, named, and the rest of the app goes on:

- **A throw as it loads**: "The page of Wiki failed as it loaded", with the error.
- **A throw as a part draws**, in an effect, or in a listener: the part says what threw.
- **A call that never ends**, as a loop: Native Shell cuts it off after 2 seconds, and the part says
  "The page of Wiki held the app"; one that answers nothing for 5 seconds is named as stopped.
- **A build that fails**, as a syntax error or an import a page cannot have: the last page that
  built keeps running, and the settings name the file and the line.

Each problem is also listed in Settings, Extensions, above the rows, until the page's next version.

### In a browser

The app in a browser (`ura serve`'s page) runs the same page, with the same API and theme, in a
frame of its own. What differs for its author:

- **A loop is not cut off.** A browser cannot stop a call that never ends. The page answers nothing,
  and after 5 seconds its place says "The page of Wiki stopped", and its frame is taken away, which
  ends it. The app itself goes on: on this machine, at `127.0.0.1` or `localhost`, each extension's
  frame is at a host of its own, `<name>.localhost`, which the browser runs in a process of its own,
  so another extension's pages go on too. Behind another host name, a proxy's, every extension's
  frame shares one process apart from the app's: a loop holds the other pages for those 5 seconds.
  An extension whose name is not a host's label, lowercase letters, digits, and dashes, runs that
  way everywhere.
- **The page runs on the browser's JavaScript**, not Native Shell's interpreter: it is faster, and
  `globalThis` holds the browser's objects. Use only what `nsh` gives: what a browser has alone does
  not exist in the app.
- **It reaches nothing but its host.** Its frame has no session's cookie and none of the app's
  storage, and its policy lets it reach its own frame's host alone, which answers nothing without a
  session: `fetch`, a picture, or a form to anywhere else is refused, as on the desktop. On this
  machine it opens no popup either. What a browser lets no policy stop is the page navigating its
  own frame, `location.href = …`, which carries what it puts in the address: the app then takes the
  frame away, and its place says the page failed as it loaded: it left its frame for another
  address. Nothing more is sent to it. Behind a proxy's host name, the frame is Native Shell's,
  which lets a page open a popup.
- **Its imports of `nsh/base`** are what the app's web build holds: a part of Native Shell the app
  never uses may be missing there, and the page then fails as it loads, with
  `does not provide an export named …`.
- **Each part shown downloads the runtime once per extension**, a few megabytes, then keeps it in
  the browser's cache.

## The TypeScript Uraeda compiles

Uraeda compiles server code itself, each `.ts` file with no `tsconfig.json`, in strict mode. Types
are stripped, never checked. Some module syntax has no place in it:

- Only `.ts` and `.tsx` files: a `.js` file cannot be imported.
- No top-level `await`: load in the function you export.
- No dynamic `import()`, and no `import.meta`.
- No `import x = require("y")`, and no `export =`.
- A relative import names a file of the folder, with or without its ending: `./pages` finds
  `pages.ts`, `pages.tsx`, `pages/index.ts`, or `pages/index.tsx`. A path out of the folder, by `..`
  or a link, is refused. A file over 2 MB is refused.
- Avoid import cycles: a file importing one that imports it back reads `undefined` for what is not
  defined yet.

A page is built by Native Shell's bundler, from `.ts`, `.tsx`, `.js`, `.jsx`, and `.json` files,
into one module, signed by your server, which the app runs only under its key.

A compile error turns the extension's new version away, with its file and line in the settings, and
the version before it keeps running.

## Reloading

An extension whose folder has no `.ura-source`, a linked folder or one written in place, reloads
each time you save one of its files, within a second, and when its settings or where it is on
change. Its old version is undone first: its records, routes, listeners, timers, processes, and
runtime. A new page shows in every part drawn, without a restart, in about 15 ms, and loses what it
held in memory, as the text of a field: keep what matters in a record.

An extension `ura` installed from git changes only when `ura extension update` moves it.

## Skills

An extension's `skills/` folder, in the [Agent Skills](https://agentskills.io/) format, reaches the
agent of every session in the repositories the extension is on in, beside the Uraeda skill: Claude
Code gets it as a plugin of its own, named `ext-<name>`. A skill tells the agent how to use your
extension, or anything else; the instructions of a session are Uraeda's, and an extension adds none.

## When something breaks

A broken extension stops alone: Uraeda and every other extension go on. Settings, Extensions shows
each problem above the rows, with its file and line when it has one:

- A manifest or a setting it cannot read, or a file that does not compile.
- Server code that throws while loading, runs over its time, or throws later from a timer or a
  promise: the extension is turned off until its files or its settings change.
- A page that throws, holds the app, or does not build.
- Keys that clash with another's.
- A linked folder that was deleted: `folder not found`.
- An extension built for another API version.

`ura extension list` shows the same problems, so an agent that wrote an extension checks it there
after saving: a manifest's problems always, and its state and the problems of loading and compiling
its code as the running server last saw them. The server writes those to
`run/extensions-status.json` in Uraeda's data folder, and removes the file as it stops.

`api.log` and `console` write to the server's output, after the extension's name, where a route's or
a listener's error also shows.

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
branch. Given a folder already in `extensions/`, or an installed extension's name, it only turns it
on: in the repositories given, besides the ones it is on in already, or everywhere with `--all`.
Without a terminal, give `--all`, `--here`, or `--repo <name>`, repeated for more. `update` refuses
a linked extension: edit its folder instead. See
[the CLI's page](https://github.com/mrtolkien/uraeda/blob/main/docs/cli.md) for the rest.

## Changing a part of Uraeda

Uraeda's own parts are built-in extensions: `claude`, Claude Code; `codex`, Codex; `fake`, the
scripted agent of the tests and the sandbox; `inbox`, its place and its pane of Home; `priorities`,
the priorities and proposals, and Priorities now on Home; `decisions`; `git`, the Git place; `jobs`,
the Jobs place, where your scheduled jobs are listed, written, and run; `previews`, the Storybook
previews and HTML mockups in specs and sessions; and `notifications`, the toasts and the desktop's
notifications when work needs you. Each is declared through the same parts as yours, a place, a key,
a pane of Home, and each is turned off in the settings, everywhere or in some repositories, like
yours.

Turning one off in a repository takes its place from the rail, its keys from the leader's menu, and
its panes from Home there, and the app goes on. Its files stay, and `ura check` still checks them. A
link to one of its pages opens "The Decisions extension is off in sample", with "Turn it on here"
and the way to the settings. Sessions, the session page, and the composer are always on.

To change a built-in, leave Uraeda's source as it is: turn the built-in off, and write an extension
that adds the part as you want it.

## Types

The compiler strips types, so they matter only to your editor and your agent. In a checkout of
Uraeda, the server API's types are
[`crates/server/src/extensions/api/server.d.ts`](https://github.com/mrtolkien/uraeda/blob/main/crates/server/src/extensions/api/server.d.ts),
which declares `uraeda/server`, `uraeda:fs`, `uraeda:process`, and the engine's globals; the page
API is
[`app/extensions/page.tsx`](https://github.com/mrtolkien/uraeda/blob/main/app/extensions/page.tsx),
`uraeda/page`, and the components
[`app/ui/index.ts`](https://github.com/mrtolkien/uraeda/blob/main/app/ui/index.ts), `uraeda/ui`.
[`examples/tsconfig.json`](https://github.com/mrtolkien/uraeda/blob/main/examples/tsconfig.json)
maps them onto a checkout, once `just app-check` wrote Native Shell's types in `app/.nsh/`.
