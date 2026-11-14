---
kind: feature
finished: 2026-11-08
pull-request: https://github.com/mrtolkien/uraeda/pull/113
superseded-by:
  - 2026-11-08-codex-runtime
  - 2026-11-08-run-options
  - 2026-11-10-nsh-migration
---

# Record: Extensions system

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-08, finished on
> 2026-11-08, in [its pull request](https://github.com/mrtolkien/uraeda/pull/113). Its full files
> are in git: `git log -- specs/2026-11-08-extensions-system/`.
>
> Superseded in part by [2026-11-08-codex-runtime](2026-11-08-codex-runtime.md).
>
> Superseded in part by [2026-11-08-run-options](2026-11-08-run-options.md).
>
> Superseded in part by [2026-11-10-nsh-migration](2026-11-10-nsh-migration.md).

## What and why

Uraeda takes extensions: TypeScript folders in the owner's config folder that add to or replace any
part of its server and web UI. An agent runtime, a place with its keys, a data record, a route, code
run on an event, and agent skills are all extensions, and Uraeda's own places and Claude Code became
built-in ones the owner can turn off. The human's reason: "With LLMs, it's trivial to extend
software. So software should be expandable." The codebase was growing too monolithic to add an
extension system later, and extensions let other people adapt Uraeda without forking it. Creating a
local extension had to be trivial, "Build should be simple/handled by us directly", with hot reload,
since most extensions are written on the spot. Workflows as extensions were asked for, then moved to
the priorities' Later: the workflow stays Uraeda's own.

## Behaviour

- **Where extensions live.** Each folder of `<config>/extensions/` is one extension, named after the
  folder, with an `extension.toml` manifest (name, title, description, version, `api`, icon,
  `scope`, optional `server` and `page` entries, and typed `[settings.*]`), and optionally `skills/`
  and `themes/`. A folder there may be a symbolic link. Uraeda never loads one from a repository;
  the sandbox loads only its own config folder's.
- **Where an extension is on.** `[extensions.<name>] on` in `config.toml` is `"all"` (the default),
  a list of repository names, or `[]` for off. A value that is neither turns the extension off with
  a problem. Settings hold for every repository, and `[extensions.<name>.repositories.<repo>]`
  overrides them in one. A value failing its setting's type is left out, and the extension runs on
  the default. A `list` setting holds strings only. When `config.toml` cannot be read, the owner's
  extensions are off and the built-ins run on their defaults, each row saying why. A repository that
  leaves Uraeda's list keeps its settings, unused.
- **Writing an extension and seeing it on save.** Uraeda compiles each `.ts` and `.tsx` file itself,
  types stripped and never checked. An extension whose folder has no `.ura-source`, linked or
  written in place, reloads within a second of a save, and when its settings or `on` change. The old
  version is undone first: records, routes, listeners, timers, places, keys, and its page's
  `onUnload`. A page redraws without reloading the browser, and loses its unsaved state. A compile
  error keeps the last working version running, with its file and line on the settings page.
- **What extension code may import.** Server code imports `node:` modules, its own files by relative
  path, and types from `uraeda/server`. Page code imports its own files, React, `react-dom`, Astryx
  and its subpaths, the theme's StyleX tokens, StyleX, and `uraeda/page`. No npm package, no `.js`
  file, no top-level `await`, no dynamic `import()`, no path leaving the folder, no file over 2 MB.
  An import is a copy of the value, taken when the importing file runs, so an import cycle reads
  `undefined`.
- **Activation is synchronous.** The entry's default export is called with the API at each load. It
  must return within 2 seconds; one that returns a promise is refused with
  `activation must be synchronous: start async work from a callback, not while loading`, and what it
  registered is undone.
- **The server API.** `record(name, read)` and `action(name, run)` reach pages through fate, as
  `useRecord` and `useAction`. `route(path, handler, method?)` answers under `/x/<name>/`, a path
  ending in `/*` taking every path under it; any other path is refused, naming the extension. A
  route without a method answers GET and POST, a GET route HEAD too. It answers with no repository,
  and under `/r/<repo>/` where the extension is on, else 404. Every route needs a signed-in session,
  and answers 403 to a request whose `Sec-Fetch-Site` is `cross-site` or `same-site`. A route that
  throws answers 500. A record, an action, or a route has 10 seconds: then the record reads with
  `<name>: no answer in 10 s`, the action is refused, and the route answers 504. `on`, `runtime`,
  `settings`, `repositories`, and `log` complete it; everything is scoped to the repositories the
  extension is on in, and a call from an unloaded version is refused with
  `<name>: this version of the extension was unloaded`.
- **Events.** `step-reached` (with `feature`, `step`, and `waitsOn`: `agent`, `human`, or `nobody`),
  `turn-ended` (with `session`, `feature`, and `state`), `commit-landed` (the main checkout's `HEAD`
  moved, with `commit` and `branch`), and `session-started` (with `session` and `runtime`), each
  with `repository` and `time`. `step` is the step's name, except at a human gate, where it is the
  kind of the file waiting, like `spec`. An extension receives only the events of the repositories
  it is on in, and a handler that throws never stops the event for others.
- **A broken extension stays alone.** A manifest or setting it cannot read, a file that fails to
  compile, server code that throws while loading or runs over 2 seconds, a deleted linked folder
  ("folder not found"), or an extension built for another API version
  (`built for extension API 1, and Uraeda runs API 2`) turns that extension off alone. A throw
  later, from its timers or a promise whose stack names its folder, turns it off until its files or
  settings change; any other uncaught error still exits the server, as before. A page that throws
  while registering, imports what it may not, or throws while drawing shows `<title>: <message>` in
  its place, the rest of the app going on; a contribution failed by its record's error draws again
  once the record reads. Settings, Extensions lists every problem with its file and line.
- **The page API.** `place`, `homePane`, `newSection`, `statusItem`, `itemRenderer`,
  `settingsSection`, `key`, and `onUnload`. A place of the owner's opens at
  `/r/<repo>/e/<name>/<id>`, drawn in the app's column at its widths; its `count` is drawn inside
  its extension's boundary. Contributions show only where their extension is on, the built-ins in
  today's order, then the owner's by name. The phone's bar holds four places, the built-ins' first;
  the rest go into its `…`. Until the Extensions record is read, the built-ins draw and the owner's
  do not. Pages are compiled with StyleX and React Compiler, so a style on a theme token gets the
  same class and specificity as the app's.
- **Keys.** An extension's key goes through the key registry. Among the extensions on in a
  repository, the first registered keeps a key; Uraeda's own keys win over any extension's. The
  settings page reports each lost key as `` `y` is taken by Deploy ``, adding the repositories it is
  lost in when not all of them (`` `y` is taken by Deploy in uraeda ``).
- **Settings, Extensions.** Two panes, "Your extensions" and "Built in", each row with a switch,
  "Only in…", and its settings, joining the settings search. Banners name each problem, each runtime
  waiting for a turn (`Deploy reloads when the turn of “…” ends`), and each key clash. The form
  edits the values for every repository or for one; a value set for one repository reads
  `Set for <repository> only.` with "Use the shared value", which removes it. The fake agent's row
  shows only where it is on, in tests and the sandbox.
- **Runtimes.** Claude Code is the built-in `claude` runtime, and `api.runtime` registers another
  under the extension's name. A session stores its runtime's name when it is made and keeps it; a
  fresh run keeps the runtime of the session it was sent to. With two runtimes or more on, a picker
  shows wherever a message makes a session: the composer of a new chat, of a feature's new session,
  or of a feature without one, the change's start dialog, and a round's "Apply the answers". It
  defaults to the first runtime on, Claude Code first. A feature's views and the sidebar's usage
  follow its latest session's runtime. Where a session's runtime is off, its transcript shows and
  the composer says `pi-durable is off: turn it on to continue this session`. Where every runtime is
  off, starting says `No agent runtime is on here: turn one on in Settings, Extensions`. A runtime
  reloads only once its sessions' turns end.
- **Usage.** Every runtime reports usage as a list of windows, `{ id, label, used, resetsAt }`,
  which Uraeda's usage window draws the same way for any runtime: Claude Code's are "5h" and "Week",
  as before. A runtime reporting none shows nothing.
- **Sessions write extensions.** Every session's instructions name the extension API's
  documentation, [`docs/extensions.md`](/docs/extensions.md) as the package ships it, and the
  extensions folder, which Claude Code gets with `--add-dir`. To make one, the agent creates its
  folder and manifest, runs `ura extension add <folder> --here`, then writes its code. To change a
  built-in, it writes an extension that replaces it. Extensions add no instructions to runs.
- **Skills.** An extension's `skills/` reaches the agent of every session in the repositories it is
  on in, as a Claude plugin named `ext-<name>`, beside the Uraeda skill. Plugin folders of removed
  extensions are deleted.
- **`ura extension`.** `add` links a folder, or clones a git URL (`https://` when no scheme) pinned
  at its default branch's commit, with `.ura-source`. It writes the extension off first, then asks
  "every repository" or "this repository", suggesting "this repository" first for
  `scope = "repository"`; a cancelled picker leaves it installed and off. Without a terminal it
  needs `--all`, `--here`, or `--repo <name>`. On an extension already installed, `add` turns it on
  in more repositories. It refuses a built-in's name (`deploy is taken by a built-in extension`),
  `uraeda` and `sessions` (`sessions is reserved by Uraeda`), and a manifest with a fatal problem.
  `update` fetches, prints the diff and the new commit, and moves only once confirmed; it refuses a
  symbolic link. `remove` deletes the folder or the link, never a linked folder's files, and keeps
  the settings. `list` (and `--json`) shows each extension's manifest problems, and its state and
  problems as the running server last saw them, with the time. `ura` never runs extension code.
- **Turning off a part of Uraeda.** The built-ins are `claude`, `fake`, `inbox`, `priorities`,
  `decisions`, `git`, `previews`, and `notifications`, each on everywhere or in some repositories.
  Off, a built-in's place, keys, home pane, phone tab, and New-page section disappear at once, its
  files stay, and `ura check` still checks them. A link to it opens "Inbox is off here" with "Turn
  it on here". With Previews off, embedded stories and HTML mockups draw as their links. Sessions,
  the session page, and the composer are always on.

## Design

Extensions run in the server's process and in the page, trusted like Uraeda's own code. Uraeda
compiles each file into the body of a function `(__import, __exports)`, and runs each version as
fresh functions in a fresh scope, so a reload frees the old one: Node's `import()` and blob-URL
modules keep every version. The same output runs in the server and in the page. fate stays static:
one record kind carries every extension's named records as JSON, and one global record lists the
extensions. Built-ins fill the same registries as the owner's extensions, but their data stays in
Uraeda's typed fate views, served even when they are off. Extensions talk only through contracts
Uraeda owns, never to each other.

- **The core** reads manifests, the built-ins' embedded manifests, each extension's `on`, and its
  settings, and writes them keeping comments:
  [`crates/core/src/extensions.rs`](/crates/core/src/extensions.rs) and
  [`crates/core/src/extensions/`](/crates/core/src/extensions/), with the built-in manifests in
  [`crates/core/extensions/`](/crates/core/extensions/). Its `install.rs` clones, pins, links, and
  removes, and `status.rs` reads the server's status file.
- **The compiler**, a crate used only by the binding, so `ura` does not grow, turns TypeScript and
  TSX into that function body with oxc:
  [`crates/compile/src/modules.rs`](/crates/compile/src/modules.rs).
- **The page compiler** runs Babel with StyleX and React Compiler on page files, and returns their
  CSS: [`page-compiler.ts`](/packages/server/src/extensions/page-compiler.ts).
- **The loader** watches the extensions folder, resolves each import graph, evaluates server code
  under `vm` with a timeout, undoes a version before the next, and keeps each extension's state and
  problems: [`loader.ts`](/packages/server/src/extensions/loader.ts),
  [`graph.ts`](/packages/server/src/extensions/graph.ts),
  [`evaluate.ts`](/packages/server/src/extensions/evaluate.ts), and
  [`faults.ts`](/packages/server/src/extensions/faults.ts), the process-wide handler of late throws.
- **The server API and its host**: [`api.ts`](/packages/server/src/extensions/api.ts),
  [`contributions.ts`](/packages/server/src/extensions/contributions.ts),
  [`routes.ts`](/packages/server/src/extensions/routes.ts),
  [`events.ts`](/packages/server/src/extensions/events.ts), and
  [`server.ts`](/packages/server/src/extensions/server.ts), which wires them to the app; the
  built-in server parts in [`builtins.ts`](/packages/server/src/extensions/builtins.ts); the status
  file for `ura extension list` in
  [`status-file.ts`](/packages/server/src/extensions/status-file.ts); the fate views in
  [`fate/extensions.ts`](/packages/server/src/fate/extensions.ts).
- **The runtimes registry** replaces the single adapter, finding a session's runtime by its stored
  `agent`: [`runner/runtimes.ts`](/packages/server/src/runner/runtimes.ts). Claude Code's runtime,
  its plugin check, its usage windows, and its extension plugins are in
  [`runner/claude.ts`](/packages/server/src/runner/claude.ts); the sessions' instructions in
  [`runner/instructions.ts`](/packages/server/src/runner/instructions.ts).
- **The web's registries** replace the fixed lists of places, keys, home panes, phone tabs, New-page
  sections, status items, item renderers, and settings sections:
  [`extensions/registry.ts`](/packages/web/src/extensions/registry.ts), filled by the built-ins in
  [`extensions/builtins/`](/packages/web/src/extensions/builtins/), which draw with today's
  components.
- **The page runtime**, a lazy chunk, fetches an extension's page bundle, evaluates it against the
  app's shared modules, and registers it like a built-in:
  [`PageRuntime.tsx`](/packages/web/src/extensions/PageRuntime.tsx),
  [`runtime.ts`](/packages/web/src/extensions/runtime.ts),
  [`shared.ts`](/packages/web/src/extensions/shared.ts), and the hooks of `uraeda/page` in
  [`hooks.ts`](/packages/web/src/extensions/hooks.ts).
- **The settings' Extensions category**:
  [`settings/ExtensionSettings.tsx`](/packages/web/src/settings/ExtensionSettings.tsx) and
  [`settings/ExtensionForm.tsx`](/packages/web/src/settings/ExtensionForm.tsx); the runtime picker
  in [`RuntimePicker.tsx`](/packages/web/src/RuntimePicker.tsx).
- **`ura extension`**: [`crates/cli/src/extension/`](/crates/cli/src/extension/).
- **The documentation and the example**: [`docs/extensions.md`](/docs/extensions.md) and the Wiki
  extension in [`examples/extensions/wiki/`](/examples/extensions/wiki/), type-checked by the lint.
  The package's smoke test starts the installed server with it, and compares its page's CSS with the
  checkout's: [`smoke-extension.ts`](/packages/uraeda/scripts/smoke-extension.ts).

## Replaced behaviour

- **The server always runs Claude Code, built in at start**: runtimes now come from extensions,
  Claude Code's from the built-in `claude`. The tests of
  `packages/server/src/runner/__tests__/claude.test.ts` stay with the adapter, its usage fixtures
  now giving windows "5h" and "Week". In `packages/server/src/__tests__/sessions.test.ts`, "Agent
  reads the agent's name, availability, version, and capabilities" was replaced by "Agent reads each
  runtime's name, mark, availability, version, capabilities, and usage".
- **A run fails when the `uraeda` plugin did not load, checked in the runner**: Claude Code's
  runtime now reads its plugins and gives the session's start a `problem`, which fails the turn. In
  `packages/server/src/runner/__tests__/sessions.test.ts`, "a plugin that does not load fails the
  turn…" and "a process whose plugins leave out uraeda…" are kept, their events now giving
  `init.problem`; reading the plugins moved to `claude.test.ts`'s init fixtures.
- **Usage arrives as Claude's five-hour and weekly fields**: it is a list of windows each runtime
  fills. `packages/server/src/runner/__tests__/usage.test.ts` and the runner's status test in
  `sessions.test.ts` read windows; no test was removed.

## Gotchas

- **Module functions are compiled with an empty context extension**: V8 keeps every function
  `vm.compileFunction`, `new Function`, or `vm.Script` compiles in its compilation cache, freed only
  near the heap's limit, so 100 reloads of a 200 KB file held 60 MB. A function compiled with a
  context extension, an object without a prototype, is not cached: 400 reloads stay flat
  ([`evaluate.ts`](/packages/server/src/extensions/evaluate.ts)). `--no-compilation-cache` would
  also work, for every script of the server.
- **Activation is synchronous because `vm`'s timeout stops only synchronous code**: a loop after an
  `await` runs in a promise job, outside any timeout, and would hang the server
  ([`evaluate.ts`](/packages/server/src/extensions/evaluate.ts),
  [`loader.ts`](/packages/server/src/extensions/loader.ts)).
- **A page's CSS gets a placeholder at each StyleX priority level Astryx's stylesheet uses**: StyleX
  counts only the levels present in the rules it is given, so a page using only `paddingBlock` lost
  to Astryx's `padding`. Astryx skips levels 5 and 10: a placeholder at every level gave
  pseudo-elements one `:not(#\#)` too many
  ([`page-compiler.ts`](/packages/server/src/extensions/page-compiler.ts)). `page-compiler.test.ts`
  compares each level with `astryx.css`.
- **A page's CSS skips the app's Lightning CSS pass**: it is a native module, and the package keeps
  only the binding native. With the app's targets it only prefixes and minifies, so a property
  Safari 17.5 needs prefixed, like `user-select`, may not apply there.
- **Babel's plugins are imported, not resolved by name**: only an import puts them in the package's
  server bundle; a path resolved at run time finds nothing in the package. StyleX's plugin is
  CommonJS, read through its `default` when bundled
  ([`page-compiler.ts`](/packages/server/src/extensions/page-compiler.ts)).
- **`node:` imports get a default export added**: `process.getBuiltinModule` gives a module's
  CommonJS exports without a `default`, which a compiled default import reads, so
  `import path from "node:path"` failed. Every import of a `node:` module gets the same namespace
  ([`evaluate.ts`](/packages/server/src/extensions/evaluate.ts)).
- **oxc is pinned at `=0.152.0`**: 0.153 and later need Rust 1.97, and the toolchain is 1.96; its
  crates release together, so one exact version keeps them in step ([`Cargo.toml`](/Cargo.toml)).
  The `rust:features` task fails if `ura` pulls in an oxc crate.
- **A page's relative imports are the files the server resolved**: the server keys files by their
  real path, links resolved, so a page joining specifiers itself named files the bundle did not have
  ([`graph.ts`](/packages/server/src/extensions/graph.ts)).
- **Page versions come from one counter per process, started at the server's start time**: versions
  counted per extension restarted at 1 with the server, so a tab kept its old code
  ([`loader.ts`](/packages/server/src/extensions/loader.ts)).
- **The shared modules load with the first page, through `import()`**: the lint forbids namespace
  imports, which a shared module is; Astryx's index, about 580 kB, loads only with a page
  ([`shared.ts`](/packages/web/src/extensions/shared.ts)).
- **`ura extension add` writes the extension off before its folder appears**: a running server loads
  a folder as soon as it appears, and an absent `on` means everywhere
  ([`install.rs`](/crates/core/src/extensions/install.rs)).

## Questions

### Round 01

#### Q1: What are extensions for, first?

**Answer:** A: the owner's own extensions, written by them or their agent, or copied from someone
they trust, installed by hand, with no catalog.

#### Q2: Should the Rust core take extensions in this feature?

**Answer:** A, no core extensions in this feature: "Ok but mark down WASM core extensions as a next
goal, with the express goal being workflow customization."

#### Q3: What can a server or UI extension add?

**Answer:** C, hooks on every event, with Uraeda's own features rebuilt as extensions: "I'm just
scared of the complexity but it's the approach that appeals to me. Maybe a user wants to remove the
inbox and just use proposals."

#### Q4: How does an extension's page run in the web UI?

**Answer:** A: in-page modules sharing the app's React and Astryx, trusted like Uraeda's own code.

#### Q5: How does an extension's server code run?

**Answer:** A: in the server's process, trusted like Uraeda's own code.

#### Q6: Where may Uraeda load extensions from?

**Answer:** A: only from the config folder, beside the settings file; a repository never loads one.

#### Q7: How is an extension installed?

**Answer:** A: `ura extension add <folder or git URL>`, pinned to its commit, `ura extension update`
showing what changed, and the web UI listing, enabling, and disabling them.

#### Q8: How does the Claude Code runtime become an extension?

**Answer:** A: a built-in extension shipped with Uraeda, on the same API as others, its habits moved
inside it.

#### Q8.A: Must a runtime from an extension follow the agents decision?

**Answer:** A: the rule binds Uraeda's shipped runtimes only; an extension's runtime is the owner's
choice. The spec review later made it a SHOULD for agents whose terms ask for it.

#### Q9: What did you mean by "the references system, which is more of a skill"?

**Answer:** A: extensions can ship agent skills, passed to the agent beside the Uraeda skill; the
workflow's steps stay the skill's.

#### Q10: What happens to extensions when their API changes before 1.0?

**Answer:** A, one API version, a mismatched extension turned off with a message: "We're already
past 1.0 btw, change the decision".

#### Notes

The human wants an opinionated workflow and UI combined with easy extensibility, unsure how deep it
should go, and mused about Uraeda as an orchestrator with workflows, the inbox, and proposals as
extensions, and hooks inside workflows. The feature is to share Uraeda with others, built now
because the codebase grows too monolithic to add extensions later; more research rounds were
welcome. On the settled points: creating local extensions must be trivial, "Build should be
simple/handled by us directly"; hot reload, not a restart, "since most extensions will be created
ad-hoc by users"; and "the more we can make into extensions (with a strong core) the more
extensible/customizable it'll be".

### Round 02

#### Q1: What does this feature build of the orchestrator idea?

**Answer:** B, features and changes as workflow definitions in this feature too: "this way the code
can be directly evaluated against its integration with the new workflow extensions". Dropped by
round 03's notes: workflow extensions moved to Later.

#### Q1.B: How is a workflow defined?

**Answer:** B, as WASM code the core runs: "a workflow could have hooks, code, anything. And it's
more portable." Dropped with the workflows by round 03's notes.

#### Q2: How deep do Uraeda's own parts become extensions?

**Answer:** A: Uraeda's places become built-in extensions on the same API, each able to be turned
off, while the core still reads and checks every file.

#### Q3: What can a hook do?

**Answer:** A: hooks run code on named events, and an extension could add instructions to a step's
runs. The spec review then removed the instructions: extensions add none to runs.

#### Q4: What compiles your extensions?

**Answer:** A: oxc, built into Uraeda's Rust binding.

#### Q5: How does the compatibility decision change now that Uraeda is past 1.0?

**Answer:** A: keep the rule without "before 1.0", name each format change in the changelog, and add
the extension API's version rule.

#### Notes

On styling with Astryx and the theme's colours only: "I'd rather have a bit bigger binary for better
code and performance", so pages got StyleX and React Compiler.

### Round 03

#### Q1: How do you write a workflow's code?

**Answer:** B, any language compiled to a WASM component. Dropped by this round's notes.

#### Q2: Where does a project's workflow load from?

**Answer:** B, the config folder, like other extensions. Dropped by this round's notes.

#### Q3: How are features and changes built as workflows?

**Answer:** A, native Rust behind the workflow interface, shipped as built-ins. Dropped by this
round's notes.

#### Notes

"Let's DROP workflows extensions from this feature. Put it in 'later'", staying focused on the
Uraeda flow. Extensions are only the owner's, "nothing in the repo", and touch the server, for data
fetching or driving agents, and the client, for new UI. The example extensions: Claude Code, Codex
later, a pi-durable runtime, a Deploy tab fetching and caching remote data with the app's look and a
leader key, and a Wiki tab browsing the `docs` folder.

## Decisions

- [Extensions](../decisions/extensions.md), new: extensions are the owner's code, loaded only from
  the config folder, built and reloaded by Uraeda, on for every repository or some; Uraeda's own
  places and runtimes are built on the same API, extensions never depend on each other, and they add
  no instructions to runs.
- [Agents](../decisions/agents.md), changed: every adapter is provided by an extension, and a
  runtime should run the installed agent only where the agent's terms ask for it, as Claude Code's
  and Codex's do.
- [Compatibility](../decisions/compatibility.md), changed: the rule holds past 1.0, each format
  change is named in the changelog, and an extension built for another API version is turned off.

## Changes after approval

- An activation must be synchronous: one returning a promise is refused, where the plan waited up to
  2 seconds for it, since a loop after an `await` escapes every timeout.
- A throw after activation, from a timer or a promise whose stack names an extension, turns that
  extension off instead of stopping the server.
- Whether an extension is on in a repository is resolved by the repository's main checkout path, the
  key sessions are stored under, mapped to its name.
- A session picks its runtime when it is made, not at its first send, and a fresh run keeps the
  runtime of its session. The picker shows wherever a message makes a session; a feature's start
  dialog has none, its hand-over's composer picks.
- A feature's views and the sidebar's usage follow the runtime of its latest session.
- Routes answer GET and POST without a method, refuse a request from another site with 403, and
  answer 504 after 10 seconds; records and actions have the same 10 seconds.
- Key clashes are settled per repository, among the extensions on there, and Uraeda's own keys win
  over any extension's.
- `uraeda` and `sessions` are reserved names, and each extension's Claude plugin is named
  `ext-<name>`.
- The server writes a status file, `run/extensions-status.json` in the data folder, so
  `ura extension list` shows loading, compiling, and page problems too.
- `ura extension add` writes a new extension off before its folder appears; on an installed
  extension it turns it on in more repositories, instead of replacing its `on`. `update` refuses a
  symbolic link.
- An `on` that is neither `"all"` nor a list, or an unreadable `config.toml`, turns the owner's
  extensions off.
- The settings form edits one repository's own values over the shared ones, with "Use the shared
  value"; a page reads its settings for the current repository.
- Turning Previews off draws embedded stories and mockups as their links, and their pages show the
  off page.
- The built-ins draw their rows, tabs, and sections with today's components, and Sessions is
  registered like a built-in, always on. Until the Extensions record is read, only the built-ins
  draw.
- The phone's bar holds four places, the built-ins' first.
- A page's problems are kept for its running version only, ten at most.
- A page's CSS skips the app's Lightning CSS pass.
- The package grew more than the spec's review estimated, about 5 MB for Babel and its plugins:
  `@uraeda/ui` packs at 6,720,385 bytes from 5,069,661 (+32.6%), and unpacks at 16,976,866 from
  8,761,320 (+93.8%), the server's bundle growing from 805,810 to 8,351,238 bytes. The binding grew
  from 8,512,168 to 9,934,728 bytes (+16.7%). Measured on x86_64 Linux, for the release notes.

## Follow-ups

- Claude Code's write access to a linked extension, through its real path outside the extensions
  folder, is unverified in a real session.
- [`extensions/server.ts`](/packages/server/src/extensions/server.ts), at 453 lines, and
  [`loader.ts`](/packages/server/src/extensions/loader.ts), at 499, are near the 500-line limit.
- The status file names a server by its pid: a recycled pid is not detected, and a killed server's
  file then reads as live.
- Workflows as extensions, with WASM core extensions for workflow customization, wait in the
  priorities' Later.
