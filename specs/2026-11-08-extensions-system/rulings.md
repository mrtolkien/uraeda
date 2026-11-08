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
