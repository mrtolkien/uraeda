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

## R33: A route without a method answers every method

- **Decision**: `api.route(path, handler)` without a method answers every method; a path ending in
  `/*` answers every path under it. A route answers globally with no repository, and under
  `/r/<repo>/` only where its extension is on, else 404; a handler that throws answers 500.
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
