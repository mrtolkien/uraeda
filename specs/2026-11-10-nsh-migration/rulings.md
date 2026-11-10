# Rulings: Migration to Native Shell and a Rust server

The low-impact choices made while planning [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: What phase 0 holds

- **Decision**: phase 0 holds everything every client shares: the Rust server, the protocol, the
  client store, the Vim layer, the component library, the gallery, and the extension host.
- **Rationale**: the human left the choice open, saying the phases were a rough order of platforms.
  The library and the store are tested through the GTK host, since something must draw them.
- **Where**: tasks 1 to 35 of the plan.

## R2: Stored data: what is kept, and what changes

- **Decision**: `config.toml`, themes, and `repositories.json` keep their formats, which the core
  already owns. `sign-in.json` keeps its fields and gains devices. Sessions move to a new SQLite
  file, `sessions.sqlite`, with a numbered schema, filled once by `ura import-sessions`.
- **Rationale**: the human said the formats exist for a reason, and allowed something better. A
  transcript as an append-only log per turn lets a reply stream and resume without reading a whole
  session. An import, in place of a shared file, keeps two servers from writing one store.
- **Alternatives considered**: reading `runner.sqlite` in place: two writers while both servers
  exist, and a schema shaped by `node:sqlite`'s use.
- **If wrong**: the importer can be run again from the old file, which is never changed. It is a
  one-time tool: an inbox note asks for its removal after the port.
- **Where**: tasks 11 and 61.

## R3: The Rust server has its own port and data folder until the end

- **Decision**: until task 61, `ura serve` uses a default port and a data folder apart from the Node
  server's. Both read the same config folder: the frozen Node server reports a rewritten extension
  as broken, and goes on.
- **Rationale**: the React UI is frozen, not removed, so the human keeps a working Uraeda while the
  new one is built.
- **Where**: tasks 4, 17, and 61.

## R4: `rquickjs` for extensions' server parts

- **Decision**: the server's VM is QuickJS, through the `rquickjs` crate.
- **Rationale**: it is the engine NSH runs pages in, so one language behaviour serves both parts of
  an extension. It has memory limits and an interrupt handler, which the "broken extension" rule
  needs.
- **Alternatives considered**: NSH's own engine crate: built for UI, with a UI's module set. A WASM
  runtime: the human chose TypeScript.
- **If wrong**: the VM sits behind `extensions/vm.rs`; another engine replaces that one file.
- **Where**: task 17.

## R5: `axum` and `tokio` for the server

- **Decision**: HTTP and WebSockets are served by `axum` on `tokio`.
- **Rationale**: the most used pair in Rust for both, with the WebSocket upgrade and the proxying
  the previews need.
- **Where**: task 4.

## R6: Records keep fate's names

- **Decision**: a record or an action keeps the name of the fate view or mutation it replaces.
- **Rationale**: the parity list is then a list of names, and a screen's port reads like the old
  one.
- **Where**: tasks 7 to 20.

## R7: Built-in places are declared through the page API, and drawn by the app

- **Decision**: a built-in place (inbox, git, sessions) is declared with the same page API as an
  owner's extension, and can be turned off. Its screen is the app's own code, not a separate package
  in a view of its own.
- **Rationale**: the extensions decision asks for the same API and an off switch. A view of its own
  per built-in would put the main screens behind a host channel, for no gain: they are Uraeda's
  code.
- **If wrong**: a built-in can later be moved into a package, since it already uses only the page
  API's contracts.
- **Where**: task 51.

## R8: No Helix flavour

- **Decision**: the Vim layer has one flavour.
- **Rationale**: the human chose "our own Vim layer in Rust, a defined subset" over the option with
  Helix. The spike's Helix flavour is kept on its branch. Asked again, the human ruled that Helix is
  worth it only with its full feature set. That needs Helix's own code, which cannot be embedded:
  see [the review](plan.md#why-vims-keys-and-not-helix).
- **Where**: task 22.

## R9: The gallery replaces the app's own Storybook

- **Decision**: the app's components are shown in `app/gallery/`, an NSH app, and no longer in
  Storybook. A user project's Storybook is still previewed.
- **Rationale**: Storybook draws in a browser with React. The gallery draws with the real framework,
  on the real platform, and is what a design review looks at.
- **Where**: task 35.

## R10: GTK, not GPUI, on Linux

- **Decision**: the Linux app uses NSH's GTK backend.
- **Rationale**: NSH makes GPUI its backend for embedding in a GPUI app, and refuses to package a
  standalone app on it. In the spike GPUI was not faster: a frame of streaming cost 1.2 ms at the
  median and 11.9 ms at worst, against 0.6 ms and 4.5 ms on GTK. Its web views need X11, which the
  previews use. GPUI draws no backdrop blur, and whether its shaders can read what is behind them,
  as glass must, was not confirmed.
- **Alternatives considered**: GPUI, with a host of Uraeda's own: the same renderer on Linux and
  macOS, so one look on both, and custom drawing in Rust. Worth a second look when macOS starts.
- **If wrong**: screens and components call no GTK API, so the backend is the host's choice.
- **Where**: task 36, and [what was measured](plan.md#what-was-measured).

## R11: The Linux app ships as a tarball and an AppImage

- **Decision**: the Linux app's two forms are a tarball and an AppImage.
- **Rationale**: the human chose them. The distribution decision names no format, since each
  platform has its own and macOS and iOS come later.
- **Where**: task 54.

## R12: No human gate, and a fallback for each former stop

- **Decision**: the plan runs from its first task to its last without waiting for the human. Each
  place an earlier draft stopped now has a fallback, named in its task, and its result is recorded
  here for the review at the end.
- **Rationale**: the human asked for a plan with no gate, to run overnight.
- **If wrong**: the design's open choices are one token each, and each outside check keeps its test,
  so a fallback is replaced without touching a screen.
- **Where**: tasks 2, 25, and 35.

## R13: The design's open choices, taken by default

- **Decision**: a running pane's line is steady; a pane's border goes around its title; heights show
  as fills and a 1 px lip, with no shadow; a key is a dark chip; the main button is a lamp, and a
  view's main action breathes; the caret leaves a trail when it jumps; the backdrop has its wash and
  panes their gap; every corner is square.
- **Rationale**: the human reviewed the mockup three times. The third showed the variants side by
  side, and they picked: the border around the title, chips, the lamp, and lips.
- **If wrong**: each is one token of `app/ui/tokens/`, listed under the design language's
  [open choices](/specs/ui/design-language.md#open-choices-each-one-token).
- **Where**: tasks 25 and 26.

## R14: NSH is pinned at 0.4.0

- **Decision**: the migration builds on NSH 0.4.0, the release `v0.4.0`, at commit
  `e626a8dd8f8d8b277b9507cfd5ac74d0e67020f3`. Its CLI comes from the release's prebuilt
  distribution, by hash, in the Nix dev shell, on x86_64 Linux only.
- **Rationale**: 0.4.0 is the only 0.4 release, and the one the spike ran. NSH releases its
  distribution for x86_64 Linux and Apple silicon, and the plan targets Linux.
- **Alternatives considered**: building the CLI from source in Nix: every platform, for a 700-crate
  build in the dev shell.
- **If wrong**: the pin is four values that move together: `flake.nix`, the `nsh-*` crates of
  `Cargo.toml`, `minRuntime` in `app/nsh.json`, and the version and commit in `AGENTS.md`.
- **Where**: task 1. Later tasks read NSH's source at that commit.

## R15: Rust 1.97.0

- **Decision**: the toolchain is Rust 1.97.0.
- **Rationale**: it is the first release that builds NSH 0.4.0. On 1.96, Cargo refuses `oxc` 0.153,
  which NSH's bundler takes through `rolldown`. NSH's own crates name no minimum. The workspace, the
  headless runner, and the GTK host built and ran on it.
- **If wrong**: the spike ran on 1.99.1. The locked `rust-overlay` goes up to 1.99.0, so a later
  release also needs `nix flake update rust-overlay`.
- **Where**: task 1, `rust-toolchain.toml`.

## R16: `nsh` runs through `scripts/nsh.ts`, on the repository's lockfile

- **Decision**: every `nsh` command on the app goes through `node scripts/nsh.ts <command>`, which
  the tasks `app:check`, `app:test`, and `app:dev` call. It builds in the repository's `target/`,
  and starts the lockfile of the workspace NSH generates, `app/.nsh/rust/Cargo.lock`, from the
  repository's `Cargo.lock`. `rolldown`'s five crates that NSH does not hold are pinned in
  `Cargo.toml`, and `crates/server/` takes them with `nsh-bundler` from the start.
- **Rationale**: NSH's generated lockfile is not committed, so Cargo filled it with the newest
  version of every crate, and built each a second time. The spike's two broken builds were five
  `rolldown_*` crates at 1.3.1 beside `rolldown` at 1.2.13: only a manifest holds them through a new
  resolution, and tasks 2 and 19 take the bundler.
- **Alternatives considered**: committing the generated lockfile: a second lockfile to keep in step
  by hand, and a conflict between tasks.
- **If wrong**: crates only the runners use still take their newest version, at the first build of a
  checkout.
- **Where**: task 1, `scripts/nsh.ts`, `Cargo.toml`.

## R17: The invisible display is `hidden-display`

- **Decision**: `hidden-display <command>`, from the dev shell, runs a command on an X display of
  its own, 1400 by 800, on Xvfb. `hidden-display node scripts/nsh.ts test --target linux` runs the
  app's tests in GTK windows, where `app.screenshot(path)` takes pictures.
- **Rationale**: the spike used Xvfb, and NSH's own checks do. GTK prefers the session's Wayland
  display, so the command removes it. A text and a shader reading its backdrop both drew on it.
- **If wrong**: Xvfb has no GPU presentation, so GTK draws in software there: a measurement of
  frames on it is not the desktop's.
- **Where**: task 1, `flake.nix`.

## R18: What `ready` runs for the app

- **Decision**: `ready` gains a group, `ready:app`, with `app:check` and `app:test`, and a CI job.
  `app:dev` is a task, and no part of `ready`. `ts:check` and `vp run fast` run `app:check` first.
  The app's crate is in `app/nsh.json` from task 1, with an empty `uraeda/native`.
- **Rationale**: a development run never ends, so no check can wait for it. `vp check` reads the
  types `nsh` writes in `app/.nsh/`, which is not committed. With the crate registered, task 1
  proves that the dev shell builds NSH's runners, and task 21 only fills the module.
- **If wrong**: the toolchain test lives in `packages/server/`, which is frozen: this task changed
  that one file, as the plan asks, and task 61 must keep the test when it removes the package.
- **Where**: task 1, `vite.tasks.ts`, `.github/workflows/ci.yml`.

## R19: No code relies on the key order of serde_json

- **Decision**: a JSON text that is compared or stored sorts its keys itself. The core's two
  functions that gave an extension's settings as JSON now do.
- **Rationale**: `rolldown`, which NSH's bundler brings, turns on serde_json's `preserve_order` for
  every crate built with it. Objects then keep the order their keys were added in, where they were
  sorted before. So the core's JSON depends on what it is built with: sorted in the Node binding, as
  written in `ura` once it holds the server. One of the core's 1,512 tests saw it.
- **If wrong**: an object whose order still differs between the two builds is equal as JSON, and
  differs only as text.
- **Where**: task 1, `crates/core/src/extensions.rs`. Tasks 7 to 20, which port records whose tests
  compare JSON.

## R20: One test of the frozen UI fails until the UI goes

- **Decision**: `vp run ready` counts as passing while its only failure is the React UI's test
  `each decision of this repository has a drawn icon`. A step that expects `ready` to pass is
  checked on that result.
- **Rationale**: the test fails since the branch added the [protocol](../decisions/protocol.md)
  decision, before task 1: the React UI draws no icon for it. The plan freezes `packages/web/`, and
  task 61 removes it with this test. The new app draws the decision's icon from its own library.
- **Alternatives considered**: adding the icon to the React UI: a change to frozen code, for a view
  that is about to go.
- **If wrong**: the icon is one line of the React UI's icon table.
- **Where**: every task that runs `vp run ready`, until task 61. The pull request names the failure.
