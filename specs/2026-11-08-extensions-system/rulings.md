# Rulings: Extensions system

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Your places live at `/e/<name>/…`

- **Decision**: a place an extension registers opens at `/e/<name>/<id>`, under the repository's
  `/r/<repo>` prefix. Built-in places keep their paths (`/inbox`, `/priorities`, …).
- **Rationale**: the spec puts extensions' server routes at `/x/<name>/`; a page path there would be
  answered by the server instead of the app.
- **Where**: task 9, `packages/web/src/routeTable.ts`.

## R2: Imports between extension files are copies, not live bindings

- **Decision**: the compiler turns `import { a } from "./b"` into `const { a } = __import("./b")`,
  read once when the module runs.
- **Rationale**: modules run synchronously, in order, inside one `vm` timeout (task 7), so a value
  exported later by a cycle is the only case that differs, and extension code has no reason for
  cycles. A live binding rewrite would rename every use of each import.
- **If wrong**: an import cycle reads `undefined`; the compiler can switch to `__m0.a` reads later.
- **Where**: task 3, `crates/compile/src/modules.rs`.

## R3: Built-ins move their registration, not their component files

- **Decision**: each built-in's entry, `packages/web/src/extensions/builtins/<name>.tsx`, registers
  its places, panes, sections, and keys through the page API; the components it draws stay at their
  current paths.
- **Rationale**: the spec's "moved from where it is today" is about who owns the part: the
  registration is what turning it off removes. Moving about 60 component files would only rename
  imports, and conflict with every branch touching them.
- **Alternatives considered**: `git mv` of each part's files into its folder: rejected as churn
  without behaviour.
- **Where**: task 9.

## R4: Any folder without `.ura-source` reloads on save

- **Decision**: an extension is "linked" when its folder has no `.ura-source`, whether it is a link
  or a folder written straight into the extensions folder, as a session does.
- **Rationale**: the spec says only a linked folder reloads; a folder a session writes in place must
  reload too (US2), and an installed one never changes without `ura extension update`.
- **Where**: task 2's `is_linked`; task 7.

## R5: Built-ins' data stays in Uraeda's static fate views

- **Decision**: the inbox, priorities, decisions, and git keep their fate views and mutations in
  `packages/server/src/fate/`, served even when they are off; their built-in extensions have no
  server part beyond what task 8 names.
- **Rationale**: the stack decision gets every page its data through fate, whose client is typed
  from the server's static module at build time; moving these views behind the run-time record kind
  would lose their types. Turning a built-in off hides it, and the core keeps reading its files, as
  the spec says.
- **Where**: task 8.

## R6: Sessions are not an extension

- **Decision**: the Sessions place, the session page, and the composer are always on, and have no
  manifest.
- **Rationale**: the spec's built-in list leaves them out; a session is how runtimes are used at
  all.
- **Where**: task 9.

## R7: Every `@astryxdesign/core/<path>` import resolves to the package's index

- **Decision**: in the page runtime, `@astryxdesign/core` and any of its subpaths resolve to one
  namespace, the package's index, loaded with the runtime's lazy chunk.
- **Rationale**: the app imports Astryx by subpath; listing each subpath as a shared module would
  pull every component into the main chunk. The index exports every component by the same name its
  subpath does.
- **Where**: task 12, `packages/web/src/extensions/shared.ts`.

## R8: The release note's sizes are in the record

- **Decision**: the measured growth of the web UI's package and the binding is written here and in
  the feature's record, which the release's changelog quotes.
- **Rationale**: `CHANGELOG.md` is written at release time from the records.
- **Where**: tasks 3 and 14.

## R9: A `list` setting is a list of strings

- **Decision**: a manifest's setting of type `list` holds strings only, its default and its values
  in `config.toml` alike; any other item is the setting's problem.
- **Rationale**: the data model names the four types without saying what a list holds; the settings
  page edits a list as lines of text, as it does `vim_commands`.
- **If wrong**: a list of numbers or tables needs a type of its own, like `list-of-integers`.
- **Where**: task 2, `crates/core/src/extensions/values.rs`.

## R10: A wrong `on` turns the extension off

- **Decision**: an `on` in `[extensions.<name>]` that is neither `"all"` nor a list of names turns
  the extension off, with a problem naming it; an absent `on` is `"all"`.
- **Rationale**: a value the owner wrote and got wrong most likely meant to narrow where it runs;
  turning it on everywhere would run it where they did not want it.
- **Where**: task 2, `crates/core/src/extensions/values.rs`.

## R11: Built-in manifests name the app's icons and have no version

- **Decision**: a built-in manifest's `icon` is the app's icon name, `uraeda:inbox`, as the Settings
  mockup's rows use, and it has no `version`: its version is Uraeda's.
- **Where**: task 2, `crates/core/extensions/`.

## R12: oxc is pinned at 0.152.0, the last release that builds with Rust 1.96

- **Decision**: every oxc crate is pinned at `=0.152.0` in the workspace's dependencies. The binding
  measured, release build on x86_64 Linux: 8,512,296 bytes before the compiler, 9,841,992 after,
  1,329,696 bytes more (+15.6%).
- **Rationale**: oxc 0.153 and later need Rust 1.97, and the toolchain is 1.96; oxc's crates release
  together, so one exact version keeps them in step.
- **If wrong**: raise the pin with the toolchain; the compiler's tests pin its output.
- **Where**: task 3, `Cargo.toml`.

## R13: Every export is a getter defined first, and `export *` adds getters

- **Decision**: `export default function f` and `export default class C` keep their declaration and
  get a getter, like named exports; only `export default <expression>` assigns `__exports.default`.
  `export * from "x"` defines a getter per key of `x`, except `default` and the names the module
  exports itself, instead of copying the values. `imports` lists each module once, at its first
  import. A file whose extension is not a script's is refused.
- **Rationale**: getters read the current value, like an ES module, so a function declared below its
  export or a re-exported module still loading reads right; listing a module once is all the loader
  needs to compile it.
- **Where**: task 3, `crates/compile/src/modules.rs`.

## R14: `rust:features` also refuses oxc in `ura`

- **Decision**: the `rust:features` task fails when `uraeda-cli` pulls in an `oxc` crate, besides
  `napi`.
- **Rationale**: the plan says the task confirms it; it only checked `napi`.
- **Where**: task 3, `vite.tasks.ts`.

## R15: A page's CSS gets the specificity Astryx's stylesheet gives each priority level

- **Decision**: `compilePage` adds a placeholder rule at each StyleX priority level Astryx's
  `astryx.css` has rules at (`ASTRYX_LEVELS`: 0 to 4, 6, 7 to 9, and 11), and at every level above
  them up to the page's highest, before `processStylexRules`, and drops the placeholders from its
  output, so each rule gets as many `:not(#\#)` as Astryx's at the same level (`padding` one,
  `padding-block` two, `padding-top` four, `::after{content}` seven). StyleX's plugin runs before
  React Compiler's, in the app's order; the output is the same either way.
- **Rationale**: without layers, StyleX counts only the levels present in the rules it is given: a
  page using only `paddingBlock` got none, and lost to Astryx's `padding` on the same element. The
  spike's single rule did not show it, as its class was checked and not its CSS. Astryx skips levels
  5 and 10: a placeholder at every level gave pseudo-elements one `:not(#\#)` more than Astryx's.
- **If wrong**: a StyleX release that counts levels differently, or an Astryx release with rules at
  other levels, fails `extensions/__tests__/page-compiler.test.ts`, which compares each level's rule
  with Astryx's, and the number of levels with the specificities in `astryx.css`.
- **Where**: task 6, `packages/server/src/extensions/page-compiler.ts`.

## R16: A page's CSS skips the app's Lightning CSS pass

- **Decision**: `compilePage` gives `processStylexRules`' output as is, without the Lightning CSS
  transform `@stylexjs/unplugin` runs after it with the app's browser targets.
- **Rationale**: Lightning CSS is a native module, and the package bundles the server into one file
  with only the binding left native. With the app's targets (Chrome 123, Firefox 120, Safari 17.5)
  it lowers nothing Astryx's tokens use; it adds vendor prefixes and minifies.
- **If wrong**: a property Safari 17.5 needs prefixed, like `user-select`, does not apply there from
  an extension's styles; `lightningcss-wasm` would give the same pass without a native module.
- **Where**: task 6, `packages/server/src/extensions/page-compiler.ts`.

## R17: A page's compile error is at a 1-based line and column

- **Decision**: `compilePage`'s error counts lines and columns from 1, as editors show them, and its
  message is Babel's first line without the file's path or position. A plugin's error, like
  StyleX's, takes its position from Babel's code frame.
- **Where**: task 6, `packages/server/src/extensions/page-compiler.ts`.

## R18: `ura extension add` writes a new extension off before its folder appears

- **Decision**: `add` writes `[extensions.<name>] on = []` before it links or moves the folder into
  `extensions/`, then writes where the flags or the picker say. A cancelled picker leaves the
  extension installed and off. The flags are read, and a missing answer refused, before anything is
  cloned.
- **Rationale**: an absent `on` means every repository, and a running server loads a folder as soon
  as it appears: without this, a cloned extension would run everywhere while `ura` waits on the
  picker, or for good after a cancel.
- **If wrong**: drop the first write, and remove the folder on a cancel instead.
- **Where**: task 5, `crates/core/src/extensions/install.rs`.

## R19: A runtime is on or off by the repository's main checkout

- **Decision**: `Runtimes`' `isOn(name, repo)` takes the path of the repository's main checkout, the
  key sessions are stored under, or null for every repository; the server API maps it to the
  repository's name.
- **Rationale**: the session manager knows a session's repository only by that path; a name lookup
  in the runner would read the repositories' list at every send.
- **Where**: task 4, `packages/server/src/runner/runtimes.ts`; task 8 gives the `isOn`.

## R20: A session picks its runtime when it is made

- **Decision**: `featureSession`, `newSession`, and `newChat` take the runtime a new session runs
  on, the first one on in the repository by default; a run that starts fresh in a new session keeps
  the runtime of the session it was sent to.
- **Rationale**: sessions are made before their first message, by the start dialog and the feature's
  page, so the choice belongs where the row is written; a fresh run continues the same work, on the
  same agent.
- **Where**: task 4, `runner/session-folders.ts`, `runner/send.ts`; task 13 passes the picker's
  choice from `session.send`.

## R21: An unreadable `config.toml` turns your extensions off

- **Decision**: when `config.toml` cannot be read or parsed, each extension in your extensions
  folder is off, with a problem saying the file cannot be read so it is off; the built-in extensions
  stay on, on their defaults, with a problem saying so.
- **Rationale**: the file the owner cannot see into might turn an extension off; running it
  everywhere would run it where they did not want it, as R10 says of a wrong `on`. The built-in ones
  are Uraeda itself, which must keep working for the owner to fix the file.
- **If wrong**: an owner whose file breaks loses their extensions until it parses again, each row
  saying why.
- **Where**: review fix, `crates/core/src/extensions/values.rs`.

## R22: Turning on refuses only repositories new to `on`

- **Decision**: `set_on` refuses a repository that is not in Uraeda's list only when the current
  `on` does not already name it.
- **Rationale**: a repository removed from the list since it was turned on stays in `on`; refusing
  it would keep the owner from changing anything else in `on` until they took it out.
- **Where**: review fix, `crates/core/src/extensions/write.rs`.

## R23: The loader takes the page compiler as an option

- **Decision**: `Loader.open` takes `compilePage: (source, filename) => { code, css } | { error }`,
  task 6's `compilePage` with its `tokens` path bound, instead of importing `page-compiler.ts`. The
  loader's tests pass a compiler that changes nothing; task 8 passes the real one.
- **Rationale**: tasks 6 and 7 are built at the same time, in one wave, so task 7's branch has no
  `page-compiler.ts`; an option also keeps Babel out of the loader's tests.
- **Where**: task 7, `packages/server/src/extensions/loader.ts`; task 8 wires it.

## R24: Module functions are compiled with an empty context extension

- **Decision**: each module body goes through `vm.compileFunction` with
  `contextExtensions: [Object.create(null)]`, an object with no prototype, so it resolves no name
  and every free name still reaches the globals.
- **Rationale**: measured on Node 24.22, V8 keeps every function `vm.compileFunction`,
  `new Function`, or `vm.Script` compiles in its compilation cache, freed only by a last-resort
  collection near the heap's limit: 100 reloads of a 200 KB file held 60 MB, 400 held 243 MB. V8
  does not cache a function compiled with a context extension: 400 reloads stayed flat, and SC-002
  measures about −1 MB. Turning the cache off for the whole process, `--no-compilation-cache`, would
  also work, but changes every other script the server runs.
- **If wrong**: free names in extension code take V8's slower dynamic lookup; if that shows, the
  loader can set `--no-compilation-cache` at start instead.
- **Where**: task 7, `packages/server/src/extensions/evaluate.ts`.

## R25: The memory benchmark exposes `gc` at run time

- **Decision**: `loader.bench.test.ts` calls `v8.setFlagsFromString("--expose-gc")` and reads `gc`
  from a new `vm` context, skipping SC-002 with a message when that gives none.
- **Rationale**: a Vitest project with `execArgv: ["--expose-gc"]` would run one file apart for one
  flag; the run-time flag gives the same `gc` in the same worker.
- **Where**: task 7, `packages/server/src/extensions/__tests__/loader.bench.test.ts`.

## R26: A page's bare imports are the page runtime's to check

- **Decision**: the loader refuses a page's `node:` imports and any relative import leaving the
  folder, and leaves other bare specifiers to the page runtime, which knows its shared modules
  (React, Astryx and its subpaths, `uraeda/page`).
- **Rationale**: the loader's `shared` modules are the server's; listing the page's in the server
  too would be a second home for the page runtime's list (R7).
- **Where**: task 7, `packages/server/src/extensions/graph.ts`; task 12 checks the rest.

## R27: `ura` never updates a symbolic link, whatever its folder holds

- **Decision**: `ura extension update` refuses an extension whose entry in the extensions folder is
  a symbolic link, with "is linked", even when its folder holds a `.ura-source`, and
  `ura extension list` shows it linked; the server still reloads by R4's rule, a folder without
  `.ura-source`.
- **Rationale**: a link points at a folder the owner keeps elsewhere, perhaps a clone they moved out
  and work in: fetching and checking out a commit there would overwrite their work with code they
  did not read.
- **Where**: review fix, `crates/core/src/extensions/install.rs` (`is_link`),
  `crates/cli/src/extension/list.rs`.

## R28: Activation is synchronous

- **Decision**: an activation that returns a promise, or any thenable, is refused: the version is
  `broken` with the problem
  `activation must be synchronous: start async work from a callback, not while loading`, and what it
  registered is undone. The loader no longer waits up to 2 seconds for the promise.
- **Rationale**: SC-003 says an extension that loops on load leaves the others running. `vm`'s
  timeout stops synchronous code only: a loop after an `await` runs in a promise job, outside any
  timeout, and would hang the server. Only a synchronous activation can be stopped, and refusing a
  promise also removes the window in which a version removed or closed during the wait was kept.
- **If wrong**: async work starts from a callback the activation registers, or from a scoped timer
  ([R29](#r29-late-throws-break-only-their-extension)).
- **Where**: task 7, `packages/server/src/extensions/evaluate.ts` and `loader.ts`.

## R29: Late throws break only their extension

- **Decision**: (a) each module function's context extension, still without a prototype (R24), holds
  scoped `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`, `clearTimeout`,
  `clearInterval`, and `clearImmediate`: each callback runs inside a `try`, its throw makes the
  version `broken` with the error and unloads it, a callback of an unloaded version never runs, and
  unloading clears every timer still pending, through one undo on the scope. (b) The loader installs
  one handler each of the process's `uncaughtException` and `unhandledRejection`, shared by every
  open loader and removed with the last one closed. An error whose stack holds a running extension's
  folder breaks that extension and unloads it, and the server keeps running; any other error is
  printed, and the process exits with code 1, as Node does, unless another listener of the event is
  there to handle it, as a test runner is.
- **Rationale**: SC-003 says an extension that throws leaves the others running, and an extension
  throws after its activation as easily as during it. Node exits on an uncaught error by default;
  the scoped timers name the version for the common case, and the backstop covers the rest
  (`globalThis.setTimeout`, a promise chain, an event listener). Exiting when no extension is named
  keeps the server's own faults as loud as before.
- **If wrong**: an error from extension code whose stack is lost (a rejection with a string, a stack
  cut off) still exits; such code can be wrapped by the API that called it.
- **Where**: task 7, `packages/server/src/extensions/faults.ts`, `evaluate.ts`, and `loader.ts`.

## R30: A step reached is named by what waits

- **Decision**: `step-reached`'s `step` is the step's name, like `plan`, except at a human gate,
  where it is the kind of the file waiting for the human, like `spec`; the payload also gives
  `waitsOn` (`human`, `agent`, or `nobody`), and an event goes when either changes. `turn-ended`
  also gives the turn's `state` (`done`, `failed`, `stopped`), which the `previews` built-in needs
  to warm only after a turn that ends done. `commit-landed` goes when the main checkout's `HEAD`
  moves to another commit, with that `commit`, on a watcher change marked `git`.
- **Rationale**: the spec's scenario names the step "spec" when a spec waits for the human, which
  the core calls `human-gate`; `waitsOn` keeps that apart from the agent writing the spec.
- **If wrong**: commits in a feature's worktree land no event until they reach the main checkout.
- **Where**: task 8, `packages/server/src/extensions/events.ts`, `extension-api.ts`.

## R31: The server takes agents, and its runtimes come from the built-ins

- **Decision**: `startServer` and `devHandler` take `agents?: Record<string, Adapter>` instead of
  `runtimes`. Without it, the built-in `claude` registers Claude Code with its `command` setting,
  and `fake` registers nothing. With it, the built-ins `claude` and `fake` register the agent of
  their name, or nothing, and a name no built-in has (the sandbox's `codex`) is registered as is, on
  everywhere; runtimes are registered in `agents`' order, so new sessions take the first.
- **Rationale**: tests, the screenshots, and the sandbox must never reach the real agent; the
  sandbox's samples of three kinds still answer.
- **Where**: task 8, `packages/server/src/extensions/builtins.ts`, `server.ts`.

## R32: An app without an extensions host still works

- **Decision**: `createApp`'s `extensions` and the fate context's are optional. Without them, as in
  tests that build an app from hosts and sessions, the `Extensions` record is read from the core
  (each one `on` or `off` by its `on` list), no extension's record or route answers, and the app
  keeps warming a feature's Storybook as its turn ends done; `startServer` always gives one, and
  there the `previews` built-in warms it.
- **Rationale**: about a dozen test helpers build apps without starting a server; giving each a
  loader would only slow them.
- **Where**: task 8, `packages/server/src/app.ts`, `fate/extensions.ts`.

## R33: A route without a method answers GET and POST

- **Decision**: `api.route(path, handler)` without a method answers GET and POST, and a GET route
  answers HEAD too; a path ending in `/*` answers every path under it, and a trailing slash is the
  same path. A route answers globally with no repository, and under `/r/<repo>/` only where its
  extension is on, else 404; a handler that throws answers 500.
- **Where**: task 8, `packages/server/src/extensions/contributions.ts`, `routes.ts`.

## R34: Built-ins register their server parts wherever they are on or off

- **Decision**: the built-ins' server parts are registered at start, whatever their `on`; where a
  built-in is off, its runtime reads off and its events are not delivered, through the same `on`
  checks as yours. A change of a built-in's settings registers it again in a new scope, a runtime's
  once its sessions' turns end, the row showing "waiting" meanwhile. A runtime's status is kept when
  it is unregistered, and a runtime registered again under its name starts from it.
- **Rationale**: turning Claude Code off in one repository must not unload it in the others; a
  reloaded runtime is the same agent, and refusing sends as unavailable until the next check, up to
  a minute, would break sessions for nothing.
- **Where**: task 8, `packages/server/src/extensions/builtins.ts`, `runner/runtimes.ts`.

## R35: Key clashes are the page's to fill in

- **Decision**: the `Extensions` record's `keys` is an empty list from the server: keys are
  registered in the page, which knows which extension took a key first (task 9).
- **Where**: task 8, `packages/server/src/fate/extensions.ts`.

## R36: Skills pass through the extensions folder, and the instructions keep their constant

- **Decision**: `skillsFor(repository)` gives `<extensions folder>/<name>/skills` for each extension
  of yours on in the repository, built for this API, without a fatal problem, whose folder has
  `skills/`; `Runtimes.skills(root)` maps a main checkout to it, as `isOn` does (R19), and the
  session manager passes it as `OpenOptions.skills`.
  `claudeArgs(options, pluginDir, imagesDir, extensions?)` takes `{ folder, docs, plugins }` and
  stays pure: `extensionPlugins(skills, plugins)` makes the plugin folders as the process opens.
  `webUiInstructions(paths?)` builds the instructions; `WEB_UI_INSTRUCTIONS` stays, without the
  section on extensions, for the scripts and benchmarks that run Claude Code outside the server,
  which give no `extensions`.
- **Rationale**: a linked extension's folder resolves to a path whose last folder need not be its
  name, so the path through the extensions folder names the plugin; an extension turned off for
  another API version must not reach the agent either; a pure `claudeArgs` keeps the arguments'
  tests free of the file system.
- **Where**: task 11, `packages/server/src/runner/claude.ts`, `runner/instructions.ts`,
  `runner/runtimes.ts`, `extensions/server.ts`.

## R37: An extension's route refuses a request from another site

- **Decision**: `/x/<name>/*` and `/r/<repo>/x/<name>/*` answer 403, whatever the method, when the
  browser's `Sec-Fetch-Site` says `cross-site` or `same-site`; `same-origin`, `none`, and no header
  (a script, a terminal) pass on to the session check and the route.
- **Rationale**: the guard lets GETs through, and the session's cookie is `SameSite=Lax`, so a link
  followed from another site carries it; a route may act on a GET (R33), so it must not answer one
  another site sent. `same-site` is refused too: another port of the same host is another server.
- **Where**: fix of task 8, `packages/server/src/extensions/routes.ts`.

## R38: An extension's record, action, or route has 10 s to answer

- **Decision**: each read of a record, each action, and each route races 10 s. Past it, the record
  reads with the error `<extension>: no answer in 10 s`, the action is refused with
  `refused: <extension>: no answer in 10 s`, and the route answers 504 with the same text; each is
  reported under the extension's name, as a throw is. The call itself goes on: it cannot be stopped,
  only no longer waited for.
- **Rationale**: a record read in a fate request, or a route, that never settles would hold Uraeda's
  own request, and every record read beside it, forever; 10 s is longer than any read a page waits
  for. The tests run the 10 s on fake timers.
- **Where**: fix of task 8, `packages/server/src/extensions/contributions.ts`.

## R39: The steps are read only while an extension listens to them

- **Decision**: the watch of steps and commits reads a repository's workspace, as its host starts or
  it changes, only while a handler of `step-reached` or `commit-landed` is registered. Without one,
  a change drops what the watch kept for the repository; the first handler added reads every
  repository it knows that has nothing kept, so its first change compares with where the repository
  was then. The extensions host no longer seeds the repositories as it starts: the hosts' `started`
  hook does, once.
- **Rationale**: a workspace read per change is the costly part of the watch, wasted when nothing
  listens, as with only the built-ins; a stale step kept across a gap would emit a step reached long
  ago.
- **Where**: fix of task 8, `packages/server/src/extensions/events.ts`, `extensions/server.ts`.

## R40: An extension's form for one repository starts from the values for every repository

- **Decision**: the settings' form of an extension picks the repository its values are for, every
  repository first; picking one shows the values for every repository, says so, and saves through
  `extensions.setSetting` with that repository. The `Extensions` record carries only the values for
  every repository (`values`), so a value already saved for one repository is not shown.
- **Rationale**: the spec asks for a setting saved for `uraeda` only (US1), which the mutation
  already does; showing each repository's own values needs one more field on the record, a server
  change outside task 10, worth adding when the page runtime's task touches the record.
- **Where**: task 10, `packages/web/src/settings/ExtensionForm.tsx`.

## R41: The Extensions category draws its own two panes, and hides the fake agent while it is off

- **Decision**: the settings page's Extensions category is "Your extensions" and "Built in", as the
  spec's mockup draws them, each a pane of its own under the banners, with no pane titled
  "Extensions" around them; its rows join the settings search by title, description, name, and
  setting names. The `fake` built-in is listed only while it is not off, in tests and the sandbox:
  elsewhere its switch would do nothing. Banners say "Deploy is off: page.tsx, line 12: …" for an
  extension that does not run, "Deploy: …" for one that runs with a problem, "Deploy reloads when
  the turn of “…” ends", and "Deploy: `y` is taken by Wiki", the title leading each.
- **Rationale**: a pane inside a pane draws two borders around every row; a fake agent's row is
  pointless for an owner. The mockup's Update button on the API banner is left out, as the plan
  says: an agent updates it.
- **Where**: task 10, `packages/web/src/settings/ExtensionSettings.tsx`, `settings/extensions.ts`.

## R42: The built-ins draw their rows, tabs, and sections with today's components

- **Decision**: a built-in's place may give its own `navRow`, `action`, and `tab`, and its own
  `goKey` and `column`; a built-in's home pane and New section give `section`, a component that
  reads its data with its own hooks and hands its `WorkSection` to its children (`Collect`), so that
  every pane stays a section of one list, which the keys move across. Yours draw from `title`,
  `icon`, and `count`, and render `component` as a section's body.
- **Rationale**: the inbox counts "0" in the column but nothing on its tab, the priorities count Now
  in the column only, Git sits among the column's actions, and home's and the New page's panes are
  one `WorkList`: one generic row could not draw them as today, which the screens must keep.
- **Where**: task 9, `packages/web/src/extensions/registry.ts`, `Collect.tsx`, `builtins/`.

## R43: Uraeda's own keys win over an extension's

- **Decision**: the leader's keys that are no extension's (Home, Settings, `g n`, Find's and New's
  own kinds, `Space r`, the UI group, Continue, the key map, `g g`, `b`) are kept; an extension's
  key that is one of them, starts one, or goes through a group `groups.ts` does not name is dropped,
  and `useKeyClashes` reports it with `takenBy: "Uraeda"`.
- **Rationale**: the key registry throws on any of them outside production, which would blank the
  page for an extension's typo.
- **Where**: task 9, `packages/web/src/extensions/useContributions.ts` (`useExtensionKeys`).

## R44: Sessions registers its place like a built-in, always on

- **Decision**: Sessions is registered through the page API under the name `sessions`, with its
  order among the built-ins, and is on wherever no `Extensions` row names it, which none does.
- **Rationale**: its place sits between the priorities and Git on the phone's bar and in the leader
  menu: registered, it keeps that place without a second list (R6 keeps it out of the manifests).
- **Where**: task 9, `packages/web/src/extensions/builtins/sessions.tsx`, `ExtensionsOn.tsx`.

## R45: A page's shared modules load with its first page, through dynamic imports

- **Decision**: `extensions/shared.ts` loads React, `react/jsx-runtime`, `react/compiler-runtime`,
  `react-dom`, StyleX, Astryx's index, its tokens' module, and `uraeda/page` with `import()`, once,
  when the first page loads; the page runtime itself (`PageRuntime.tsx`, `runtime.ts`,
  `evaluate.ts`) is a lazy chunk `ExtensionsOn` mounts once an extension has a page, never preloaded
  with the pages.
- **Rationale**: the lint forbids namespace imports (`import * as`), and a namespace is what a
  shared module is. Measured with `vp run --filter uraeda-web build`: the main chunk went from 317.1
  kB to 290.7 kB, the runtime is 10.2 kB, and Astryx's index (about 580 kB) loads only with a page;
  but the components the app and the index share now sit in chunks of their own, so the first load
  fetches 81 files instead of 52, 2.21 MB instead of 2.18 MB (+28 kB).
- **If wrong**: Rolldown's chunking options can merge the shared components back into the main
  chunk.
- **Where**: task 12, `packages/web/src/extensions/shared.ts`, `ExtensionsOn.tsx`.

## R46: A page reads its settings for the current repository from `valuesHere`

- **Decision**: each row of the `Extensions` record gains `valuesHere`, its settings in the
  endpoint's repository as JSON (`{}` where it is off, every repository's on the global endpoint),
  which `useExtensionSettings()` reads. `values` stays every repository's, for the settings form
  (R40).
- **Rationale**: a setting saved for `uraeda` only must reach the page drawn in `uraeda`; the server
  already has it (`ExtensionsHost.settings`), and the record is read per endpoint.
- **Where**: task 12, `packages/server/src/fate/extensions.ts`,
  `packages/web/src/extensions/hooks.ts`.

## R47: Your places draw in the app's column, and your settings sections on the repository's client

- **Decision**: a place of yours at `/e/<name>/<id>` draws its component inside the app's `Page` of
  kind `rows`, so it gets the app's widths at each width; an extension's settings section
  (`ownSection`) draws under its row titled with its `title`, inside the repository's fate client,
  as the settings page itself reads the global one.
- **Rationale**: an extension cannot import the app's `Page`; and its section's `useRecord` reads a
  repository's record, which the global endpoint refuses.
- **Where**: task 12, `packages/web/src/extensions/routes.tsx`, `settings/SettingsPage.tsx`.

## R48: A page's problems are kept per version, ten at most

- **Decision**: the page posts `extensions.reportPageProblem({ name, version, message })` when its
  entry throws while registering, an import is refused, its bundle cannot be fetched, or one of its
  contributions throws while drawing (its boundary shows "<title>: <message>" in its place, one line
  in the status line), or its `count` or a key's `run` throws. The host keeps them for the running
  page's version only, dropping a report for another, at most 10 per version, each cut to 1000
  characters, and lists them with the extension's problems under the page's entry file.
- **Rationale**: a page throwing at each draw would otherwise grow the server's memory and the
  settings page without end; a report from a tab still on the old version would show a problem
  already fixed.
- **Where**: task 12, `packages/server/src/extensions/page-problems.ts`, `extensions/server.ts`,
  `packages/web/src/extensions/runtime.ts`.

## R49: A runtime is picked where its session is made

- **Decision**: the picker shows, with two runtimes or more on, wherever a message makes its
  session: the composer of a new chat, of a feature's new session, of a feature without a session
  (the hand-over of a feature's start among them), the change's start dialog, whose first run makes
  the session, and the round banner's "Apply the answers". A feature's start dialog has none: the
  hand-over's composer picks it. `session.send`, `session.new`, `session.newChat`, and
  `change.start` take `runtime`, unused for a session that exists.
- **Rationale**: R20 puts the choice where the row is written; a feature's start writes no session,
  its first message does.
- **Where**: task 13, `packages/web/src/RuntimePicker.tsx`, `Composer.tsx`, `StartDialog.tsx`,
  `StartChat.tsx`; `packages/server/src/fate/send-mutations.ts`, `change-starts.ts`.

## R50: A feature's views follow its latest session's runtime

- **Decision**: `FeatureRecord` gains `runtime`, its latest session's `agent`, null before one; the
  feature's page, its Session tab, its round and review buttons, and the sidebar's usage on its
  pages follow it, as a session's views follow its own `agent`, and the rest the first runtime on.
  `RuntimeRecord` gains `title`, the extension's, and the refusals' texts move to `limits.ts`'s
  `RUNTIME_REFUSALS`, so the composer shows the server's words before sending.
- **Rationale**: a feature's runs go to its latest session (R20), whose runtime may not be the first
  one on; the UI read no title for a runtime off.
- **Where**: task 13, `packages/server/src/fate/sessions.ts`, `runner/runtimes.ts`, `limits.ts`;
  `packages/web/src/runtimes.ts`, `sidebar/Allowance.tsx`.

## R51: The extensions' documentation links to GitHub

- **Decision**: `docs/extensions.md` links the example, the API's types, and other files of the
  repository by their GitHub address on `main`, not by a relative path.
- **Rationale**: the package ships the page as `docs/extensions.md`, and sessions read that copy
  (`layout().docs`); a relative link from it leads nowhere in an installed package, and the types
  are what an agent writing an extension needs most.
- **If wrong**: a reader of the checkout's page opens GitHub instead of the file beside it; the
  package could ship the types it links instead.
- **Where**: task 14, `docs/extensions.md`.

## R52: `uraeda/page` exports the `PageApi` type, and the examples are type-checked

- **Decision**: `packages/web/src/extensions/hooks.ts`, the module pages import as `uraeda/page`,
  also exports the `PageApi` type, so a page's entry is typed as `page(api: PageApi)`. The lint's
  type check covers `examples/`, through `examples/tsconfig.json`, which maps `uraeda/page`,
  `uraeda/server`, React, StyleX, and Astryx onto the checkout's; `examples/**` may import StyleX's
  namespace, as the web UI does.
- **Rationale**: the lint type-checks every file it lints; without the mapping, each import of the
  example was an error, and an example that drifts from the API must fail the checks. A type export
  adds nothing at run time.
- **Where**: task 14, `examples/tsconfig.json`, `vite.config.ts`, `hooks.ts`.

## R53: The smoke test compiles the example's page in the package

- **Decision**: the package's smoke test starts the installed server with the example in a config
  folder of its own, signs in with the key the start prints, reads `/extensions/wiki/page`, and
  compares its CSS with the checkout's `compilePage` of the same file.
- **Rationale**: the page compiler runs Babel's plugins from the server's bundle, against the
  package's copy of Astryx's tokens: only a start of the package shows both work, and the same CSS
  shows the classes match the app's.
- **Where**: task 14, `packages/uraeda/scripts/smoke-extension.ts`, `smoke.ts`.

## R54: The measured growth of the package and the binding (SC-004)

- **Decision**: the release note says the following, measured on x86_64 Linux with
  `npm pack --dry-run` and the binding's release build (`build:release`), before the feature
  (`a3914e75`, the branch's base on `main`) and after it (task 14):
  - `@uraeda/ui`: 5,069,661 bytes packed before, 6,720,385 after, +1,650,724 (+32.6%); 8,761,320
    unpacked before, 16,976,866 after, +8,215,546 (+93.8%), 316 files before, 362 after. The
    server's bundle grew from 805,810 bytes to 8,351,238, by the page compiler's Babel, StyleX, and
    React Compiler; the web UI from 7,449,137 to 8,065,179 (R45); the documentation and Astryx's
    tokens add 54 kB.
  - The binding: 8,512,168 bytes before, 9,934,728 after, +1,422,560 (+16.7%): the compiler, as R12
    measured, and the manifests and settings of the core.
- **Rationale**: SC-004 asks for growth no larger than the plan measured, and the release notes to
  say how much; R8 puts the numbers here.
- **Where**: task 14.
