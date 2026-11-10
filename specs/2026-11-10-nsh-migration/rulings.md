# Rulings: Migration to Native Shell and a Rust server

The low-impact choices made while planning [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: What phase 0 holds

- **Decision**: phase 0 holds everything every client shares: the Rust server, the protocol, the
  client store, the Vim layer, the component library, the gallery, and the extension host.
- **Rationale**: the human left the choice open, saying the phases were a rough order of platforms.
  The library and the store are tested through the GTK host, since something must draw them.
- **Where**: tasks 1 to 36 of the plan.

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
- **Where**: tasks 12 and 62.

## R3: The Rust server has its own port and data folder until the end

- **Decision**: until task 62, `ura serve` uses a default port and a data folder apart from the Node
  server's. Both read the same config folder: the frozen Node server reports a rewritten extension
  as broken, and goes on.
- **Rationale**: the React UI is frozen, not removed, so the human keeps a working Uraeda while the
  new one is built.
- **Where**: tasks 5, 18, and 62.

## R4: `rquickjs` for extensions' server parts

- **Decision**: the server's VM is QuickJS, through the `rquickjs` crate.
- **Rationale**: it is the engine NSH runs pages in, so one language behaviour serves both parts of
  an extension. It has memory limits and an interrupt handler, which the "broken extension" rule
  needs.
- **Alternatives considered**: NSH's own engine crate: built for UI, with a UI's module set. A WASM
  runtime: the human chose TypeScript.
- **If wrong**: the VM sits behind `extensions/vm.rs`; another engine replaces that one file.
- **Where**: task 18.

## R5: `axum` and `tokio` for the server

- **Decision**: HTTP and WebSockets are served by `axum` on `tokio`.
- **Rationale**: the most used pair in Rust for both, with the WebSocket upgrade and the proxying
  the previews need.
- **Where**: task 5.

## R6: Records keep fate's names

- **Decision**: a record or an action keeps the name of the fate view or mutation it replaces.
- **Rationale**: the parity list is then a list of names, and a screen's port reads like the old
  one.
- **Where**: tasks 8 to 21.

## R7: Built-in places are declared through the page API, and drawn by the app

- **Decision**: a built-in place (inbox, git, sessions) is declared with the same page API as an
  owner's extension, and can be turned off. Its screen is the app's own code, not a separate package
  in a view of its own.
- **Rationale**: the extensions decision asks for the same API and an off switch. A view of its own
  per built-in would put the main screens behind a host channel, for no gain: they are Uraeda's
  code.
- **If wrong**: a built-in can later be moved into a package, since it already uses only the page
  API's contracts.
- **Where**: task 52.

## R8: No Helix flavour

- **Decision**: the Vim layer has one flavour.
- **Rationale**: the human chose "our own Vim layer in Rust, a defined subset" over the option with
  Helix. The spike's Helix flavour is kept on its branch. Asked again, the human ruled that Helix is
  worth it only with its full feature set. That needs Helix's own code, which cannot be embedded:
  see [the review](plan.md#why-vims-keys-and-not-helix).
- **Where**: task 23.

## R9: The gallery replaces the app's own Storybook

- **Decision**: the app's components are shown in `app/gallery/`, an NSH app, and no longer in
  Storybook. A user project's Storybook is still previewed.
- **Rationale**: Storybook draws in a browser with React. The gallery draws with the real framework,
  on the real platform, and is what the design gates review.
- **Where**: task 36.

## R10: GTK, not GPUI, on Linux

- **Decision**: the Linux app uses NSH's GTK backend.
- **Rationale**: NSH's packager refuses GPUI, which it calls a development host, and GPUI draws no
  blur and no shader effect. Measured frame costs on GTK fit the budget.
- **Where**: task 37, and [what was measured](plan.md#what-was-measured).
