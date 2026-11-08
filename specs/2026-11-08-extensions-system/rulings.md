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

- **Decision**: `compilePage` adds a placeholder rule at every StyleX priority level up to the
  page's highest before `processStylexRules`, and drops the placeholders from its output, so each
  rule gets one `:not(#\#)` per level, as in Astryx's `astryx.css` (`padding` one, `padding-block`
  two, `padding-top` four).
- **Rationale**: without layers, StyleX counts only the levels present in the rules it is given: a
  page using only `paddingBlock` got none, and lost to Astryx's `padding` on the same element. The
  spike's single rule did not show it, as its class was checked and not its CSS.
- **If wrong**: a StyleX release that counts levels differently fails
  `extensions/__tests__/page-compiler.test.ts`, which compares each level's rule with Astryx's.
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

- **Decision**: when `config.toml` cannot be read or parsed, each extension in your extensions folder
  is off, with a problem saying the file cannot be read so it is off; the built-in extensions stay on,
  on their defaults, with a problem saying so.
- **Rationale**: the file the owner cannot see into might turn an extension off; running it
  everywhere would run it where they did not want it, as R10 says of a wrong `on`. The built-in ones
  are Uraeda itself, which must keep working for the owner to fix the file.
- **If wrong**: an owner whose file breaks loses their extensions until it parses again, each row
  saying why.
- **Where**: review fix, `crates/core/src/extensions/values.rs`.

## R19: Turning on refuses only repositories new to `on`

- **Decision**: `set_on` refuses a repository that is not in Uraeda's list only when the current
  `on` does not already name it.
- **Rationale**: a repository removed from the list since it was turned on stays in `on`; refusing
  it would keep the owner from changing anything else in `on` until they took it out.
- **Where**: review fix, `crates/core/src/extensions/write.rs`.
