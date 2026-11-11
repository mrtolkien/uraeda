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

## R21: The outside checks run on hidden displays of their own, in `ready` and in CI

- **Decision**: `crates/app/tests/outside.rs` holds task 2's five checks. Each runs in a process of
  its own, started through `hidden-display`, with its own display, session bus, and data, cache, and
  configuration folders. They are part of `cargo nextest run`, so of `rust:test`, `vp run ready`,
  and CI's `rust` job. Outside the dev shell, where `hidden-display` is missing, a check is skipped
  and says so; on CI that is a failure.
  - `hidden-display` gains a session bus of its own, which names no folder of services, and Xvfb
    picks its own display number (`-d`). `xdotool` joins the dev shell, for real clicks and keys.
  - The tasks `app:check`, `rust:clippy`, and `rust:test` pass the dev shell's build variables,
    `gtkEnv` in `vite.tasks.ts`: a cached task gets a clean environment, where `pkg-config` and the
    linker did not find GTK.
  - The app is a package of the pnpm workspace, `uraeda-app` in `app/package.json`: NSH's bundler
    resolves npm packages from `app/node_modules`, and the diagram check imports `pele`.
- **Rationale**: the plan asks for tests that stay as the guard of each assumption, so they run
  where every other Rust test does. With the stock bus configuration, the bus started the machine's
  desktop portal, which reached for the human's compositor. With one display for all, a click of one
  check could land on another's window. With `-a`, two displays starting at once could take the same
  number.
- **If wrong**: nothing was pushed, so CI has not run them. WebKit starts its page in a sandbox that
  needs user namespaces, which CI's machines may refuse: the web view check would then fail there,
  and the human decides between a runner that allows them and skipping that check on CI. The sandbox
  is left on. CI's `rust` job also builds the GTK and WebKitGTK bindings now.
- **Where**: task 2, `crates/app/tests/outside/display.rs`, `flake.nix`, `vite.tasks.ts`. R17's
  `hidden-display` is this one from now on.

## R22: Check 1 holds: a signed package loads in an embedded view on GTK

- **Decision**: extension pages are served as signed NSH packages, as the plan says. The check built
  a page with `nsh-bundler`, signed it, and ran it in an `AppView` on GTK, where it posted to its
  host. The same package with its signature blanked is refused (`Error::BadSignature`), and so is
  one signed again under another root (`Error::UntrustedKey`).
- **What later tasks use**:
  - Task 19, the server: `nsh_package::SecretKey::generate`, `to_base64`, and `from_base64` for the
    keys; `nsh_package::certify(&root, &release.public(), &apps, not_before, not_after)`; and
    `nsh_package::build(&Contents { app, capabilities, source, bytecode: None, source_map, assets, min_runtime: None }, &release, &certificate)`.
    Keys have two levels: a root key certifies a release key, and the release key signs.
    `GET /extensions/key` returns the root's public key, `PublicKey::to_base64`.
  - Task 34, the client: `nsh_package::TrustStore::new()`, `add_root(PublicKey::from_base64(..))`,
    `nsh_engine::load_package(&mut trust, &bytes, assets_folder)`, then
    `AppView::load(loaded.bundle.into())`, with `nsh-platform-linux`'s feature `js`.
  - A page's rights travel in its package, `Contents::capabilities`, so the server sets them:
    `{ "host": [..] }` lists every name the page may `host.call` or `host.post`.
  - `App::build` must never go down: a client refuses a build older than one it loaded
    (`Error::Rollback`), and loads the same build again. So `pageVersion` is a number that only
    grows, across server restarts too, such as the build's time in milliseconds.
- **Rationale**: the check ran the real libraries, on GTK, on the hidden display. No bytecode is
  packaged: a package always carries its source, which loads on every runtime version.
- **If wrong**: the fallback stays as the plan wrote it: the compiled source over the signed-in
  connection, with its hash.
- **Where**: `a_signed_package_loads_in_an_embedded_view_and_any_other_is_refused`,
  `crates/app/tests/outside/signing.rs`. The workspace names `nsh-engine`, `nsh-package`, and
  `nsh-platform-linux` at `=0.4.0`. Tasks 19 and 34.

## R23: Check 2 holds: a broken page is reported to its host, through the engine's log

- **Decision**: the host hears a page's errors from the process's log, and knows the page from the
  thread. No ping is needed.
  - NSH 0.4.0's GTK `AppView` has no error callback: `Surface::set_error_handler` is private to the
    crate, for its development overlay, and GPUI's `AppView::on_app_error` has no GTK twin.
  - The engine writes each error with `log::error!(target: "js", ..)`, on its own thread, named
    `nsh-engine`: one thread per load. The text starts with what happened:
    - `bundle failed: `: the page threw while loading, and never ran.
    - `uncaught exception: `: it threw in a callback, and goes on. A call that never ends is cut off
      after `Limits::call_budget`, 2 seconds by default, and reported the same way:
      `uncaught exception: the script was interrupted`. The page goes on after it too.
    - `stopped: `: its engine stopped, here out of `Limits::memory_bytes`, after an
      `uncaught exception: the script ran out of memory`. No code of the page runs again.
- **What later tasks use**:
  - Task 34: `crates/app/src/extension_view.rs` sets the process's one logger
    (`log::set_boxed_logger`), which keeps the records of target `js` and level `Error` with
    `std::thread::current().id()`. A page's first statement posts `start` to its host
    (`host.post("start")`, granted in its `capabilities.host`). The host's handler,
    `AppView::host().handle("start", ..)`, runs on the engine's thread, and so learns which thread
    is which page. A load that posts no `start` within the load budget, 10 seconds, is broken too.
  - Task 19: the page's build makes `start` its first statement: the entry it compiles is a module
    that imports a `start` module, then the extension's page, as `app/__checks__/throws.tsx` does.
- **Rationale**: the check ran two pages at once in two views. Each report came on its own page's
  thread: a throw at load, a throw in a callback, an endless loop, and a page out of memory. The
  page still answered its host after the first three.
- **If wrong**: the prefixes are log text, not an API. The test fails when an upgrade of NSH changes
  them, and task 34 then takes the plan's fallback: a ping over the host channel, and a page named
  broken when it does not answer within 2 seconds or never posts `start`. NSH also logs
  `unhandled rejection: ` under the same target, which the check did not exercise.
- **Where**: `a_broken_page_is_reported_to_its_host`, `crates/app/tests/outside/errors.rs`,
  `app/__checks__/{start,throws,breaks}`. Tasks 19 and 34.

## R24: Check 3 holds: a web view shows a local page on GTK, and gets keys

- **Decision**: previews show in a web view on Linux, as the plan says.
- **What later tasks use**:
  - Task 49: `<WebView src onLoad onError onMessage>` from `nsh`. The app's `nsh.json` grants the
    addresses it may show: `"capabilities": { "webview": { "hosts": ["127.0.0.1"] } }`. A page talks
    to the app with `window.nsh.postMessage(text)`, heard by `onMessage` as `{ data }`.
  - Web views need `nsh-platform-linux`'s feature `webview`, which links WebKitGTK 6.0. The runners
    NSH builds for the app, for `nsh run` and `nsh package`, have it on by default. A binary of
    Uraeda's own that embeds an `AppView` names it itself, as the test's manifest does: without it,
    a web view shows a placeholder.
  - `onLoad` carries the page's address, and an empty title: the title comes with
    `onNavigationStateChange`.
- **Rationale**: the check served a page on loopback, as the server serves a preview. Its script
  ran, GTK drew it, a real click gave its field the focus, and real key presses reached both the
  page's `keydown` and the field's text. The clicks and keys came from the X server's test
  extension, as a keyboard's do.
- **If wrong**: the fallback stays: on Linux a preview opens in the system's browser.
- **Where**: `a_web_view_shows_a_local_page_and_gets_keys`, `crates/app/tests/outside/web.rs`,
  `app/__checks__/webview.tsx`. Task 49.

## R25: Check 4 holds: a diagram draws without a browser, in two steps

- **Decision**: Pele draws diagrams in NSH's VM, and Rust makes its SVG one NSH's images draw.
  - Pele 1.5.2 runs as it is in NSH's VM, with its hardening on: `render(source)` from `pele` drew a
    three-node flowchart in 2 ms.
  - NSH's `<Image>` cannot draw Pele's SVG as it is. NSH reads SVG with `resvg` built without text,
    and Pele takes its colours from CSS variables: the picture had boxes of the wrong colours, and
    no label.
  - So a Rust step rewrites the SVG: each `var()` gets its value, the theme's or the fallback the
    SVG names; the root's own variables leave its style, where they stopped `usvg` from reading the
    font; a corner's `style="rx:.."` becomes the attribute; and `usvg`, with its feature `text` and
    the app's fonts, writes the text as shapes. The result goes to `<Image src>` as
    `data:image/svg+xml;base64,..`, at the width and height Pele gives.
- **What later tasks use**:
  - Task 31: `crates/app/src/diagram.rs` takes the three functions of
    `crates/app/tests/outside/diagram.rs`, `picture`, `without_variables`, and `resolved`, exports
    the first from `uraeda/native`, and the test then calls the crate's. `Diagram.tsx` calls
    `render` from `pele`, which `app/package.json` already names, then that function. Pele throws
    for a source it cannot draw: the source shows then.
  - The colours are Pele's variables, `--pele-fg`, `--pele-line`, `--pele-surface`, and the others
    of its README, given from the app's tokens. A theme change makes the picture again.
  - The fonts are a `usvg::fontdb::Database` filled with the app's own font files. The check used
    the display's sans-serif font, found with `fc-match`.
- **Rationale**: the check looked at the pixels GTK drew: orange boxes, green arrows, and blue text,
  the three colours the test's theme gave. Without the fonts, the same test failed on the text
  alone.
- **If wrong**: the fallback stays: diagrams show their source on Linux. Not checked: Pele measures
  labels with its own metrics, so a label may overflow its box in a wider font
  (`RenderOptions.measurer` takes the app's); a diagram's links are not clickable in a picture; and
  the web build, where the browser draws Pele's SVG itself.
- **Where**: `a_diagram_is_drawn_without_a_browser`, `app/__checks__/diagram.tsx`. The workspace
  names `usvg` 0.46, the version NSH's `resvg` has. Task 31.

## R26: Check 5 holds: the app sends a system notification on Linux

- **Decision**: the app notifies through the desktop's own service, and hears the click.
  - NSH has no notification API. On Linux a desktop's notifications are the service
    `org.freedesktop.Notifications` of the session bus, at `/org/freedesktop/Notifications`.
  - The app calls its `Notify`, of signature `susssasa{sv}i`, with GTK's `gio`
    (`nsh_platform_linux::gtk4::gio`): `gio::bus_get_sync(gio::BusType::Session, ..)`, then
    `DBusConnection::call`. It sends the app's name, `Uraeda`; no id to replace, `0`; no icon; the
    title; the text; the actions `["default", "Open"]`; the hint `desktop-entry`, the app's id
    `dev.uraeda.app`; and no timeout of its own, `-1`. The answer is the notification's id.
  - A click comes back as the signal `ActionInvoked`, with that id and `default`, heard with
    `DBusConnection::subscribe_to_signal`.
- **What later tasks use**: task 50 moves `send` and `clicks` of
  `crates/app/tests/outside/notify.rs` to `crates/app/src/notify.rs`, exports them from
  `uraeda/native`, and points the test at them. Linux asks no permission for a notification, so
  "asks only after saying why" is the app's own switch there. The web build uses the browser's.
- **Rationale**: the check sent a notification from a GTK process to a service of the test's own, on
  the hidden display's bus, which got every field, and clicked it. The test refuses to run on a bus
  where a notification service already answers, so it can never notify a real desktop.
- **If wrong**: no real desktop's service was called, on purpose. The interface is the one every
  Linux desktop implements. The fallback stays: toasts inside the app only.
- **Where**: `a_system_notification_is_sent_and_its_click_comes_back`. Task 50.

## R27: A change names a list's item by its `id`, and changes are numbered, not acknowledged

- **Decision**: the wire shapes the plan left open, as [the contract](contracts/protocol.md) has
  them.
  - A path's step is a field's name or an item's `id`, a text: `["items", "m2", "text"]`. A list
    whose items do not each have an `id` of their own changes whole, by `set`, and so does one that
    was or becomes empty.
  - `remove` takes a record's field as well as a list's item, so a field that goes needs no sixth
    operation. `insert` and `move` name the item to go before, or none for the end.
  - A `sub`, a `call`, and a `resume` share one space of ids on a connection, so an `error` names
    one of them without saying which kind.
  - No message acknowledges a change. A WebSocket loses nothing while it is open: `seq` shows a gap,
    and `resume` says the last change applied. The plan's "each acknowledged" now reads "each
    numbered", as the decision does.
  - `welcome` carries an `epoch`, drawn at each start of the server, and `resume` gives it back: a
    number from before a restart is never read as one of this run.
  - `refused` has three reasons, `client-too-old`, `server-too-old`, and `not-signed-in`, and
    carries the server's version.
- **Rationale**: a domain that appends to a reply knows the message's id, not its place in each
  subscriber's list, and a client finds an item's signal by its id. Without the epoch, a client that
  outlives the server would apply new changes to an old value.
- **If wrong**: the shapes are one crate and one version number. Ids are texts: a record whose items
  are numbered, as a turn's by `seq` today, sends that number as its `id`.
- **Where**: task 3, `crates/protocol/src/{message,change,diff}.rs`. Tasks 6, 15, and 23.

## R28: The client's types are written by `ts-rs`, and a test checks they are fresh

- **Decision**: a type that crosses the protocol derives `TS`, of the crate `ts-rs`.
  `vp run protocol:types` writes `app/store/protocol.d.ts` from the messages and from `catalog()`,
  the list of every record and action, in `crates/protocol/src/registry.rs`. The crate's test
  `the_clients_types_are_fresh` fails when the file is stale, and `rust:test` reads the file.
  - The file holds types only. The version is the type `Protocol`, the number itself: the store
    writes `const PROTOCOL: Protocol = 1`, which stops compiling when the version rises.
  - `u64` and `i64` are `number` there, as JSON has them.
  - The plan's `Registry` stays the server's, in task 6, where handlers register. The protocol's
    list is `Catalog`, so the two names do not clash: `Catalog::records()` and `actions()` give the
    names a server test can compare its registry with.
- **Rationale**: `ts-rs` is in the lockfile already, through NSH's bundler, and reads serde's
  attributes, so the JSON and the types cannot differ. Writing types by hand for 44 records is the
  drift the protocol decision forbids.
- **Alternatives considered**: a constant in a `.ts` file: a second generated file, for one number.
- **If wrong**: `ts-rs` names no variant's documentation, and puts a type on one line: the file is
  for the compiler, and the contract is what a person reads.
- **Where**: task 3, `crates/protocol/src/{registry,typescript}.rs`, `vite.tasks.ts`. Tasks 6 to 20,
  which add records and actions, and task 23.

## R29: The handshake's rule lives in the protocol's crate

- **Decision**: `handshake(first) -> Result<SignIn, ServerMessage>` reads a connection's first
  message. It gives the sign-in to check, or the message to answer before closing: `refused` for a
  `hello` of another version, on its `type` and `protocol` alone, and `error` for anything else.
- **Rationale**: the version is the crate's, so the rule that compares it is too. A later version
  may write the rest of its `hello` another way: read whole first, it would get `bad-message`, and
  the client could not say which side to update.
- **Where**: task 3, `crates/protocol/src/message.rs`, and its test
  `a_hello_of_another_version_is_refused_naming_the_side_to_update`. Task 4 calls it, and keeps its
  own test over the WebSocket.

## R30: `uraeda/native` exports functions by name, each part in a file of its own

- **Decision**: a function of the native module is imported by its own name,
  `import { version } from "uraeda/native"`, and the module's list is one file.
  - NSH 0.4.0 exports no free function: a function is in the `impl` of a unit struct with
    `#[module]`. With `#[module(flat)]` on the `impl`, TSX imports each function by its name, in
    camel case; without it, TSX imports the struct's name, an object with the functions.
  - `crates/app/src/native.rs` holds `register`, with one line for each part, and the steps to add
    one. A part's Rust is in a file beside it: `about.rs` for `version()`, and `diagram.rs`,
    `notify.rs`, and `extension_view.rs` as R23, R25, and R26 name them. The entry NSH looks for,
    `#[native_module("uraeda/native")]`, stays in `lib.rs`: NSH wants it at the crate's root, and
    reads the module's name in that file.
  - `version()` is the version of the workspace's crates, the release the app was built for.
  - `every_export_is_documented_for_typescript`, in `crates/app/tests/native.rs`, fails for an
    export without a doc comment, where NSH only warns. NSH keeps that text out of a build without
    its feature `declarations`, so the crate's tests turn it on: without it, the test names every
    export.
- **Rationale**: the plan writes `version()`, and R25 and R26 export functions "from
  `uraeda/native`": names, not objects. One list keeps two tasks of a wave to one line each in a
  shared file. A doc comment is all the documentation an export has where it is called.
- **Alternatives considered**: objects, `Diagram.picture(..)`: a second name to choose and to import
  for each part. The entry in `native.rs`, exported again from `lib.rs`: NSH's own check of the
  module's name reads `lib.rs`.
- **If wrong**: every export shares the module's one set of names, and what NSH does with a name two
  parts export was not checked. A part whose names say too little alone drops `flat`, and is
  imported as its object.
- **Where**: task 21, `crates/app/src/{lib,native,about}.rs`. Tasks 26, 30, 31, 34, 36, and 50.

## R31: The Vim layer follows Neovim, reads lines, and leaves undo and the clipboard to its caller

- **Decision**: `crates/vim/` is Vim's keys over a text it reads and never holds.
  - **Neovim's defaults, where Vim and Neovim differ**: `Y` yanks to the line's end; a line opened
    by `o`, `O`, `cc`, or `S` keeps its line's indent, and loses it when left empty; after `dd`,
    `>>`, or `<<` the caret keeps its column. One indent is two blanks, and a tab is eight cells.
  - **The text is read line by line**, through the trait `Text` (`line_count`, `line`), and a
    position is a line and a column in UTF-16 code units: NSH's `EditorPosition`, so the bridge
    converts nothing. The only key that copies the whole text is a tag object, `it` or `at`.
  - **A key returns one replacement at most**, `Edit::Replace`, a range of the text as it was, then
    the selection in the text after it. A counted command, and a change `.` plays again with what it
    typed, are one replacement, so one step of the editor's undo.
  - **Undo is the editor's**: `u` and `Ctrl-r` return `Edit::Undo` and `Edit::Redo`, and the caller
    then calls `Vim::sync`. The editor types in insert mode, so what was typed is undone in the
    editor's steps, which NSH's documentation says are words, where Vim takes back a whole insert.
  - **The clipboard is the caller's**: a yank with no register, or to `"+`, returns
    `Edit::Clipboard(text)`; a delete never does. `"+p` returns `Edit::ReadClipboard`, and the put
    happens when `Vim::clipboard(text, view)` brings the text, since NSH reads the clipboard
    asynchronously. `p` puts Vim's own register, as the human ruled for the earlier Vim mode.
  - **`Edit::Pass` leaves a key to the field**: every key but Escape in insert mode, and Escape and
    Enter in normal mode with nothing pending.
  - **`Mode::Replace` is `r` waiting for its character**, as Vim itself pretends. `R` is not in the
    subset, nor are `i)`, `ib`, and the other names of the bracket objects.
  - **A search is the text as typed**, with no pattern language, and it respects case.
- **Rationale**: the text-editing decision's reason is that the human edits in Neovim everywhere
  else. NSH's editor keeps a rope and speaks positions, so lines and positions cross without a copy
  of a long text or a conversion. Its `edit(edits)` is one step of undo, and it has no call to group
  steps, so the layer cannot make an insert one step.
- **How it was checked**: each of the 266 rows of `cases.toml` was run in Neovim 0.12.6
  (`nvim --clean --headless`, an indent of two blanks), except the 8 rows that name the system
  clipboard, which would write the machine's. 249 rows give the same text and caret. The 9 rows that
  end in another mode, or half typed, were ended with Escape and give the same text. About 10,000
  random key sequences were then run through both: in the last rounds under 1 in 100 differed, in
  the kinds listed under "If wrong", though not each of those was traced. Neovim is not in the dev
  shell, so the comparison is not a test of the repository.
- **If wrong**: known differences from Neovim, none in a row of the table.
  - A command that fails leaves the caret where it is, where Neovim sometimes moves it first.
  - `>$` leaves the caret in its column, not at the line's end.
  - A count before `%`, `v`, or `V` is ignored, and `v` between an operator and its motion cancels
    the operator.
  - In visual mode, `i"` and `a"` select the string and do not extend the selection.
  - A word is letters, digits, and `_`; an emoji is punctuation, where Neovim gives it a class of
    its own.
  - `p` in visual mode with an empty register deletes the selection, as Neovim does, but `.` and the
    caret after it differ.
  - An insert undone in several steps: the layer could keep its own history instead, at the cost of
    going wrong when the text changes outside it.
- **Where**: task 22, `crates/vim/`. Task 30 bridges it to NSH's editor: `Replace` is
  `EditorApi::edit`, `Select` is `set_selections`, `Undo` and `Redo` are `run`.

## R32: `ura serve` listens on 4320 and keeps its files in `uraeda-next`, by flags only

- **Decision**: the Rust server's default port is 4320. Its default data folder is the core's data
  folder with `-next` after its name: `~/.local/share/uraeda-next` on Linux, and
  `$URAEDA_DATA_DIR-next` when that variable is set. `--port` and `--data-dir` change them, and no
  variable or setting does: `URAEDA_PORT`, `URAEDA_DATA_DIR`, and the settings file's `port` stay
  the Node server's. `--port 0` takes a free port.
- **Rationale**: R3 keeps the two servers apart while both exist. They read one config folder, so
  the same `port` in it, or one variable in the human's shell, would send both to one port and one
  folder.
- **If wrong**: the two defaults are `DEFAULT_PORT` and `default_data_dir`, in
  `crates/server/src/lib.rs`, both marked `TEMPORARY:`. Task 61 gives the port its setting, its
  variable, and the Node server's number.
- **Where**: task 4, `crates/server/src/lib.rs`, `crates/cli/src/serve.rs`. Tasks 20, 36, and 61.

## R33: A domain mounts itself, shares its state by type, and registers what stops

- **Decision**: a domain of the server is a module with
  `mount(&Shared, &mut Routes) -> Result<(), Failure>`, and one line in `DOMAINS`, in
  `crates/server/src/lib.rs`. They mount in that order as the server starts.
  - **Routes**: `routes.route("/pair", post(pair))`, with axum's handlers over `State<Shared>`.
    `Server::routes()` lists the paths, so a test can walk them. A rule every request passes is a
    layer in `http::router`, as the guard is.
  - **State**: `shared.provide(store)`, read by any domain as `shared.get::<Store>()`, an
    `Arc<Store>`: one value per type. `get` panics for a type nobody provided, naming it; `find`
    gives an `Option`.
  - **Shutdown**: `shared.on_stop("previews", async move { .. })`. `Server::stop` says the server is
    stopping, which ends `shared.stopping().await` in every connection and task, then runs the
    registered work, the last registered first, each to its end, then gives open requests 5 seconds.
    Work registered once the server is stopping runs at once.
  - **Time and processes**: `shared.now()` is the server's clock, which a test sets. A process
    starts from `shared.environment().command(program)`.
- **Rationale**: twenty tasks extend the server, several at once in separate worktrees. With a field
  per domain in one struct, each would change three places of two shared files. A panic for a
  missing type shows in the first test, since every test starts the whole server.
- **Alternatives considered**: a struct with a field per domain: checked by the compiler, and a
  conflict at each merge. A timeout on each piece of stop work: a command left running in silence,
  where the stack decision says the server MUST stop them.
- **If wrong**: `Shared` is one file. A field per domain replaces `provide` and `get` without
  touching a route.
- **Where**: task 4, `crates/server/src/{lib,shared,stop,http}.rs`, and the test
  `stopping_the_server_stops_what_its_domains_registered`. Tasks 5 to 20.

## R34: One server per data folder, found through `run/server.json`

- **Decision**: a running server writes `run/server.json` in its data folder, readable by its owner
  only: its `pid`, its `port`, and its `token`, the host token, 32 random bytes. It removes the file
  as it stops.
  - A start reads that file first, and asks its server to take over: `POST /open` with
    `Authorization: Bearer <token>` and `{ "folder": "/absolute/path" }`. The answer is
    `{ "uraeda": "<version>", "url": "/r/<name>/" }`, and the start ends there
    (`NotStarted::HandedOver`). A file whose server does not answer to its token is one a killed
    server left: the start goes on, and replaces it.
  - Then the start takes its port. A port in use is another data folder's server when it answers
    401, and another program otherwise.
  - `POST /open` adds the folder's repository to the list, as `ura add` does, through the core. It
    answers 401 without the host token, and `/` for no folder or one outside git.
  - `Shared::from_host(headers)` is the check of the host token, for the routes only the host's own
    `ura` and app call.
- **Rationale**: the Node server named its token file by its port, so a second start on another port
  ran a second server on the same files. The Rust server's store has one writer (R2). A file with
  one name also tells the app where the server listens, on a port it did not choose.
- **Alternatives considered**: the Node server's `given`, for `--repo`: `ura serve` has no such
  flag. Its one-time sign-in link: it comes with sign-in, in task 5.
- **If wrong**: a status file left by a killed server names a port another program may hold now:
  that program gets one request carrying a token that opens nothing any more. A start waits up to a
  minute for a server that holds its status file's token and does not answer.
- **Where**: task 4, `crates/server/src/{status,start,handoff}.rs`, `http/open.rs`, and the test
  `a_second_start_hands_over_to_the_first`. Tasks 5 and 36.

## R35: The server's environment is a value, with the config folder's `.env`

- **Decision**: `Environment` is the environment the server starts in, then the `.env` of the config
  folder for each variable that one leaves unset or empty. The server never changes its process's
  environment, and reads no other `.env`.
  - `environment().var(name)` reads a variable, and `environment().command(program)` starts a
    process with exactly these variables: every agent, preview, and command the server runs starts
    there.
  - `.env` holds one `NAME=value` per line, with `export`, quotes, and `#` comments.
  - The allowed host names are read once at the start: `URAEDA_ALLOWED_HOSTS`, or else the settings
    file's `allowed_hosts`. `Shared::allow_hosts` replaces them: task 7 calls it when the settings
    change.
- **Rationale**: a variable set in a running process is unsafe once it has threads, and a test in
  the same process could not see it. A value is what a test asserts: a command the test's server
  runs prints the config folder's secret, and nothing of a project's `.env`.
- **If wrong**: a later task that starts a process with `Command::new` gives it the process's
  environment, without the secrets. The crate's documentation names the rule; no lint does. The
  core's `git` is such a process: R96 says how it gets them.
- **Where**: task 4, `crates/server/src/env.rs`, and the tests
  `secrets_come_from_the_config_folders_env_only` and, for the folder `ura serve` runs in,
  `serve_runs_until_it_is_stopped_and_a_second_start_hands_over`. Tasks 7, 12 to 15, and 18.

## R36: The guard is ported whole, frames included, and reads the path as sent

- **Decision**: `guard::refusal(rules, asked)` is `guard.ts`'s rule, with its cases as the rows of
  `a_request_with_another_sites_origin_is_refused`. It is a layer over every route and the fallback,
  so it runs before a WebSocket's upgrade.
  - The rule for a sandboxed frame's `Origin: null` is there too, with `guard::frame_secret(path)`,
    the one reader of a preview's and a mockup's path. No path is a frame's yet: the layer's `frame`
    is marked `TEMPORARY:` until task 18 brings the frame secret.
  - The guard reads the path as the request sent it. axum routes on the same text, so the guard and
    the router never read two paths, where the Node server normalized it for both.
  - Every welcomed connection is told `not-signed-in` for a `sub`, a `call`, or a `resume`, as the
    plan says, until tasks 5 and 6.
- **Rationale**: the frame rows are the costly ones to lose, and task 18 would otherwise port them
  from a file task 61 deletes.
- **Where**: task 4, `crates/server/src/guard.rs`. Tasks 5 and 18.

## R37: `ura` holds the server, so it builds oxc, and grows by 0.85 MB

- **Decision**: `ura` depends on `uraeda-server`. The check `rust:features` of `vp run ready` no
  longer fails when `ura` builds an oxc crate: it still fails for napi.
- **Rationale**: the stack decision puts the server inside `ura`, and the server takes NSH's
  bundler, which is built on oxc, to compile extensions' pages (task 19). The check dated from the
  time only the Node binding compiled extensions.
- **What was measured**: the release `ura` is 8,986,752 bytes with the server's skeleton, against
  8,132,240 bytes for the release build of the day before, without it: 854,512 bytes more, for
  `axum`, `hyper`, and `tokio`. The bundler adds nothing yet: nothing calls it, so the linker leaves
  it out. It will count when task 19 calls it.
- **If wrong**: the earlier figure is the main checkout's build of 2026-11-10, not a build of this
  branch's parent, so the difference may hold a little of tasks 1 to 3.
- **Where**: task 4, `crates/cli/Cargo.toml`, `vite.tasks.ts`. Task 19.

## R38: A device's token is `<id>.<secret>`, and a pairing code is 12 symbols

- **Decision**: what a device holds, and what pairs it.
  - A token is `<id>.<secret>`, 16 and 32 random bytes in base64url, as a session's cookie is. The
    `id` is public: it names the device in the record `Devices`, and `POST /pair` answers it beside
    the token.
  - A device gives its token in its `hello`, and on a route as `Authorization: Bearer <token>`.
  - A pairing code is 12 symbols of 5 random bits, shown in three groups: `7KQ2-M9XA-0TBD`. A person
    may type it in small letters, without its dashes, and with `O`, `I`, or `L` for the digits they
    look like.
  - A device ends after 30 days without use, as a session does. The server ends them every hour, and
    never one with a connection open: an open connection is a use, recorded once a day.
- **Rationale**: the store then has one rule for both kinds. 60 bits cannot be guessed in 10 minutes
  at a second a guess, and a person can still read them aloud. Without the connection rule, an app
  left open for a month would be signed out while it is used.
- **If wrong**: the code's length and symbols are two constants of `sign_in/pairing.rs`.
- **Where**: task 5, `crates/server/src/sign_in/{store,pairing}.rs`. Tasks 23, 36, and 59.

## R39: Every route is closed by a layer, and the open ones are one list of mounted paths

- **Decision**: the session check is a layer of `http::router`, after the guard. It reads the path a
  request matched, as its route was mounted, and answers 401 unless the request is signed in or the
  path is in `sign_in::OPEN`.
  - `OPEN` has two kinds. `Open::Anyone`: `/live`, `/session`, `/session/{token}`, `/pair`, each
    checking what it is given. `Open::Host`: `/open`, `/session/key`, `/pair/code`, which pass with
    the host token only, signed in or not.
  - A path that matched no route passes: it answers `Not found` now, and the client's own files from
    task 56.
  - The layer puts the `Identity` in the request, so a handler takes it as an argument:
    `async fn read(identity: Identity, ..)`. On an open route, `Result<Identity, Refusal>` says
    whether there is one.
  - A WebSocket's connection is welcomed by `sign_in::check`, then served by the live engine, whose
    loop awaits `identity.ended()` beside the messages, and closes when that ends first (R51).
- **Rationale**: the router and the check read the same matched path, so they cannot disagree on
  what a request asks for, where the Node server tested the path's text against a pattern. A route
  nobody listed is closed without anyone thinking of it.
- **If wrong**: the connection's messages are dropped where they wait when the sign-in ends. The
  live engine holds `identity.ended()` in its own loop, so what must run after a connection's last
  message goes there.
- **Where**: task 5, `crates/server/src/sign_in/check.rs`, `http.rs`, `http/socket.rs`, and the test
  `every_route_but_the_open_ones_refuses_a_request_without_a_session`. It needs axum's feature
  `matched-path`. Tasks 6, 16, 18, and 19: a preview's path with the frame secret, and `/mcp` with
  its own tokens, are additions to `OPEN` and to the sign-in decision.

## R40: The sign-in file has one writer, and is read once

- **Decision**: the store reads `sign-in.json` as the server starts, and writes it at each change.
  It no longer reads it again when it changed on disk, as the Node server did for two servers on one
  data folder.
  - A file it cannot read stops the start, and is left as it is. To replace a lost key, the owner
    stops the server and deletes the file: the next start makes a key and shows it.
  - A key that a start made and never showed is forgotten when that server stops, with its file.
  - A write that fails still ends what ended, for this run of the server. A new key whose file
    cannot be written is dropped, and the old key stays.
  - Dates are written to the second, `2026-11-10T09:00:00Z`.
- **Rationale**: R34 gives a data folder one server, and `ura pair` asks that server instead of
  opening the file. It removes the signature of the file, the second read, and the broken state.
- **If wrong**: a file edited while the server runs is overwritten at the next change.
- **Where**: task 5, `crates/server/src/sign_in/store.rs`, and the test
  `the_sign_in_file_holds_only_hashes`.

## R41: A new key and "sign out everywhere" end the devices too

- **Decision**: `POST /session/key` and `DELETE /sessions` end every session and every paired
  device. `DELETE /session` from a device unpairs that device.
- **Rationale**: the decision says a new key "signs every device out", and names no case where a
  token outlives it. Ending more is the safe reading for an owner who thinks a key leaked.
- **If wrong**: a device then needs a code from the host's shell again. Keeping the devices is one
  closure of `store.rs`.
- **Where**: task 5, `crates/server/src/sign_in/{store,routes}.rs`. Nothing calls
  `POST /session/key` yet: `ura` has no command for it, and the app may take one (task 48).

## R42: A stored secret is a `Hashed`, which has no `==`

- **Decision**: the key, a session's secret, a device's token, a pairing code, and a one-time link
  are kept as `secret::Hashed`, in the file and in memory. It gives no text, and implements no
  comparison: `Hashed::is(secret)`, over `secret::same`, is the only way to compare one.
- **Rationale**: "compared in constant time" is then what the types allow, not what a reader
  remembers. A timing test would be slow and unreliable.
- **How it was checked**: `a_stored_secret_is_compared_in_constant_time_only` no longer compiles
  when `Hashed` gains `PartialEq`, `Hash`, `PartialOrd`, `AsRef<str>`, or `Display`. A session's or
  a device's `id` is public, and is found with `==`.
- **If wrong**: the test cannot see a secret kept as a plain text beside it. The format test,
  `the_sign_in_file_holds_only_hashes`, sees one that reaches the file.
- **Where**: task 5, `crates/server/src/secret.rs`, `sign_in/{store,once}.rs`.

## R43: `ura pair` asks the running server, and draws its QR code with `qrcodegen`

- **Decision**: `ura pair [--data-dir DIR]` reads the status file, and asks its server for a code
  with the host token: `POST /pair/code` answers `{ code, minutes, address }`. It prints the code,
  the address, and a QR code of `<address>/pair#<code>`.
  - `address` is the owner's first allowed host name, as `https://<name>`, or else the server's own
    address on the machine.
  - The QR code is drawn with half blocks, black on white on a terminal with colours.
  - The crate is `qrcodegen` 1.8.0, new in the lockfile: one file, with no dependency. No QR crate
    was there already. `percent-encoding`, which was, reads and writes a link's `to`.
- **Rationale**: codes live in the server's memory, so only the server makes one. The code is after
  `#`, which a browser never sends, so a proxy's log never holds it.
- **If wrong**: what the QR code holds is one function of `crates/cli/src/pair.rs`. Task 36 or 59,
  which reads it, may want another form.
- **Where**: task 5, `crates/cli/src/pair.rs`, `crates/server/src/sign_in/pairing.rs`, and the test
  `pair_shows_a_code_that_pairs_one_device`.

## R44: `Devices` and its actions are typed, written as functions, and registered by sign-in

- **Decision**: the record `Devices` and the actions `devices.revoke` and `devices.rename` are
  declared in `crates/protocol/src/devices.rs`, in `catalog()`, and in the client's types. Their
  logic is `sign_in::devices::{list, revoke, rename}`, tested as functions, and over `/live` since
  the live engine's `Registry` exists (R51).
  - What is registered: `list(&Shared) -> Devices` as the record's value;
    `revoke(&Shared, &DevicesRevoke)` and `rename(&Shared, &DevicesRename)`, which return
    `Result<(), Fault>`, the engine's code and message for the `error`; and
    `on_change(&Shared, listener)`, called with a closure that tells the bus `Devices` changed.
- **Rationale**: task 6 built the `Registry` at the same time, in another worktree, so the functions
  came first, and their registration with the merge.
- **Where**: task 5, `crates/server/src/sign_in/devices.rs`. Registered in the commit that joined
  tasks 5 and 6.

## R45: One-time links are made by the server alone, with no page on disk

- **Decision**: `sign_in::link(&Shared, to)` makes a link, `/session/<token>?to=<to>`, good once,
  for 5 minutes. `POST /open` with `"signIn": true` answers one as `signIn`, to the page it opens.
  The Node server's page in `run/sign-in-links/`, which led a browser to the link, is not ported.
- **Rationale**: that page kept the link off a command line, where every user of the machine reads
  it. Nothing opens a browser from `ura` yet, so nothing needs it.
- **If wrong**: the task that opens the host's browser (36 or 56) writes that page, or hands the
  link over another way that is not a command line.
- **Where**: task 5, `crates/server/src/sign_in/{mod,routes}.rs`, `http/open.rs`, and the test
  `a_one_time_link_signs_in_once_and_never_leaves_the_server`.

## R46: A handler is a plain function on a blocking thread, and fails with a `Fault`

- **Decision**: a domain registers what serves a record and an action with the server's `Registry`,
  `shared.get::<Registry>()`.
  - `registry.record::<R>(read)`, with `read: Fn(&Shared, R::Args) -> Result<R::Value, Fault>`. A
    read gets no caller: every subscriber of the same arguments shares one read and one value. The
    engine runs one read of a record at a time.
  - `registry.action::<A>(run)`, with `run: Fn(&Call, A::Input) -> Result<A::Output, Fault>`. A
    `Call` has `shared()`, `bus()`, and `caller()`, the identity sign-in checked. Calls run at the
    same time. A connection's own start in the order it sent them, each once the one before took its
    place in the write queue or ended (R92).
  - A handler is not `async`. The engine runs it on one of tokio's blocking threads, so it calls the
    core, git, files, and SQLite as they are. `live::wait(future)` runs a future to its end from
    there, for a queue's turn or a message to a task.
  - `Fault` is a code of the protocol and a message. The core's `ApiError`, `ActionError`,
    `GitError`, `ListError`, and `PlaceError` convert with `?`, through the core's own `ApiError`:
    `refused`, `conflict`, or `hook`, whose message is the hook's output. `Fault::refused`,
    `Fault::conflict`, `Fault::internal`, and `Fault::new(code, message)` make the others.
    `internal` is logged, and so is a handler that panics, which fails its own read or call only. A
    JSON that is not the arguments or the input is `bad-args` or `bad-input`, before the handler
    runs.
  - A read that fails ends the record's subscriptions with that `error`, as the contract says.
- **Rationale**: nearly every read and action is a call of the core, which blocks. A handler that
  were `async` would block the server's threads the day one forgets `spawn_blocking`.
- **Alternatives considered**: `async` handlers: needed by few, and a trap for the rest.
- **If wrong**: a handler that waits holds a blocking thread, of which tokio gives 512.
- **Where**: task 6, `crates/server/src/live/{registry,fault}.rs`. Tasks 5 and 7 to 19.

## R47: The bus names a record by its type and its arguments, and an append says where it grew

- **Decision**: the plan's `Bus::changed(record_name, key)` and
  `Bus::append(record_name, key, path, text)` are typed, and the key is the record's arguments.
  - `bus.changed::<R>(&args)`, with `args: &R::Args`, the arguments a client subscribes with. Two
    clients whose arguments are equal as the record's type reads them hold one record, whatever
    fields they add or leave out.
  - `bus.changed_all::<R>()`: every record of that name somebody holds is read again, as each
    feature's when the settings change.
  - `bus.append::<R>(&args, path, at, text)`, with `path: &[&str]` as a change's path, and `at` the
    text's length in bytes before it grew. A value that is `at` long grows. One that already holds
    `text` there is left as it is. Any other is read again. A domain stores the text first, then
    says it.
  - The bus is `shared.get::<Bus>()`, or `call.bus()` in an action. It is called from any thread, as
    the core's watcher's, and never waits. Nothing happens for a record nobody holds.
- **Rationale**: a key written by hand that names nothing fails in silence, and a type that is not
  the record's arguments does not compile. Without `at`, a read that already brought a text,
  followed by its late append, doubled it in the value, and nothing read the record again. With it,
  a read in flight while a text grows is kept: the appends it lacks are applied to its result.
- **If wrong**: a domain must know a text's length as it grows. A record whose text is replaced, not
  grown, says `changed`.
- **Where**: task 6, `crates/server/src/live/{bus,key,topic}.rs`. Tasks 7 to 19, and 11 and 15 for
  the transcript.

## R48: What the engine keeps of a record, and when it reads and sends

- **Decision**: the server's own choices, inside the contract.
  - **Numbers are a record's**, shared by its subscribers: a `data` is at the record's number, and a
    `resume` on a new connection continues from it. A record held again after it was forgotten
    starts above every number used before, so its changes are never taken for missed ones.
  - **The pace is 16 ms**: a record is read again, and its changes sent, at most once per 16 ms.
    What is said meanwhile is one read, of the latest value, and the appends meanwhile are one
    `append`.
  - **A `data` holds every change said before its `sub`**: a subscriber waits for the read that
    brings them. So a `sub` sent after an action's `result` shows what the action said it changed.
  - **1,000 changes are kept.** What a client is sent is worked out when it reads, from the change
    it is at: one further behind gets `data`. Nothing is queued for a slow client but the answers to
    its own calls.
  - **A record nobody holds is not read.** It is kept one minute with its number, and its appends
    still apply, so a `resume` gets only what it missed, as one change. After the minute, a `resume`
    gets `data`.
  - **Each connection is one task**, each call a task, and each record somebody holds one task while
    it has something to read or to send.
- **Rationale**: a client's place is one number, so a slow client costs no memory and blocks nobody.
  A reply that streams while its connection is down is the spec's high edge case.
- **If wrong**: the three values are `PACE`, `KEPT_CHANGES`, and `KEPT_IDLE` of
  `crates/server/src/live/topic.rs`. A read slower than the appends of its record holds them until
  it ends.
- **Where**: task 6, `crates/server/src/live/{topic,subscription}.rs`. Tasks 15, 23, and 53.

## R49: Where sign-in comes into a connection

- **Decision**: `http/socket.rs` hands a welcomed socket to
  `live::serve(&shared, &mut socket, caller)`, which owns the connection from there.
  - `live::Caller::new(identity, ended)` is who the connection is, and a future that ends with its
    sign-in: the connection closes then.
  - The identity is sign-in's `Identity`, and an action reads it as `call.caller()`. Until sign-in
    was merged, `Caller::anyone()` and a `live::Identity` that was `()` stood in: R51 says how they
    went.
  - Task 4's test no longer expects `not-signed-in` for a `sub` on a welcomed connection: R36 held
    that until this task. It keeps the message that cannot be read.
- **Rationale**: sign-in was built at the same time, in another worktree. One call in `socket.rs`
  and two names kept the merge to a few lines.
- **Where**: task 6, `crates/server/src/live/socket.rs`, `crates/server/src/http/socket.rs`. Task 5.

## R50: The records' list, and the test that compares it with the protocol

- **Decision**: how a domain's handlers join the server, and what checks them.
  - `live::mount` is the first of `DOMAINS`: every domain mounted after it finds the `Registry` and
    the `Bus`, and registers in its own `mount`, as sign-in for its devices.
  - A domain that is only records and actions is a file of `crates/server/src/records/`, with a
    function `register(&Shared, &Registry) -> Result<(), Failure>`, its line `mod <domain>;` in
    `records/mod.rs`, and its line in `DOMAINS` there, which calls it (R86).
  - `every_declared_record_and_action_is_served_and_no_other` compares `catalog()` with the
    `Registry` of a started server, both ways. A name declared before its handler exists goes in the
    test's `NOT_BUILT`, empty today. The test fails for a name that is there and served, so the list
    only shrinks.
  - The protocol's crate gains `get(value, path)`, which reads one place of a value by a change's
    path: the engine reads a text's length with the protocol's own rule for a step.
  - The tests' record `Counter` is declared in the test, and registered on a running server.
- **Rationale**: seven tasks add a domain at the same time, so each adds one line that no formatter
  joins with another's.
- **Where**: task 6, `crates/server/src/records/mod.rs`, `crates/server/tests/live.rs`,
  `crates/protocol/src/change.rs`. Tasks 5 and 7 to 19.

## R51: The live engine serves who sign-in welcomed, and ends a connection with its sign-in

- **Decision**: how tasks 5 and 6, built at the same time, were joined.
  - **One identity.** `live::Identity` is gone: `Connection::open(&shared, identity)` takes
    sign-in's `Identity`, and `call.caller()` gives it, so an action reads `call.caller().kind()`
    and `call.caller().id()`. A record's read still gets no caller.
  - **One place ends a connection.** `http/socket.rs` welcomes with `sign_in::check`, then calls
    `live::serve(&shared, &mut socket, Caller::new(identity, ended))`, where `ended` awaits
    `Identity::ended`. `Caller::anyone()` is gone, and `socket.rs` awaits nothing itself. The
    engine's loop looks at the sign-in's end first, each time, so nothing is read and nothing is
    sent once it ended. Leaving drops the `Connection`, which ends its subscriptions. The calls it
    made run to their end, unanswered.
  - **Sign-in registers its devices.** `DOMAINS` starts with `live::mount`, then `sign_in::mount`,
    which calls `sign_in::devices::register`: the record `Devices` on `list`, the actions
    `devices.revoke` and `devices.rename` on `revoke` and `rename`, and `on_change` telling the bus
    `Devices` changed. So the list follows whatever changes it: an action, `POST /pair`, a device
    that signs out, a new key, the sweep.
  - `devices::Problem` is gone: `revoke` and `rename` fail with the engine's `Fault`.
  - Any signed-in caller revokes or renames any device, its own included: the server has one owner.
  - `NOT_BUILT` is empty. A name there that is declared no more is looked for among the records and
    the actions together: looked for in each, a record's name was refused among the actions.
- **Rationale**: a connection that two places could end would end without its subscriptions, or
  twice. The devices are sign-in's, so sign-in registers them, as R50 says of a domain with routes.
- **How it was checked**: `a_devices_list_follows_a_pairing_and_a_revocation` and
  `an_action_knows_who_calls`, both over `/live`; and in
  `a_paired_device_signs_in_until_it_is_revoked`, the device now holds `Devices` open when it is
  revoked. Without the `ended` arms of `live::serve`, its connection stayed open and got the change
  that removed it, and the connections of a signed-out session and of a new key never closed.
- **If wrong**: `Caller` holds the sign-in's end apart from the identity, which gives it as
  `Identity::ended`: `serve` could take the identity alone.
- **Where**: `crates/server/src/live/socket.rs`, `crates/server/src/http/socket.rs`,
  `crates/server/src/sign_in/{mod,devices}.rs`, `crates/server/tests/{live,sign_in}.rs`. Tasks 7 to
  19, for `call.caller()`.

## R52: A record of one repository takes `repo`, a row carries an `id`, and an action answers little

- **Decision**: the shapes of the workspace's records and actions, where fate's did not carry over.
  - A record of one repository takes the repository's name in the list as `repo`:
    `Workspace { repo }`. A record there is one of takes `null`: `Repositories`, `NeedsYouList`,
    `Settings`, `Themes`. A record read once for a typed text takes it as `text`:
    `FolderSuggestions { text }`, `SlugProposal { text }`.
  - A value has no `id` of its own: fate's ids, as `"workspace"` or `"settings"`, named a record in
    its cache, which the arguments do now.
  - Each row of a list that changes carries an `id`, so it changes row by row (R27): a repository's
    name, a workspace feature's folder.
  - The settings' and the list's actions answer `null`, and the record shows the change:
    `repositories.add` alone answers `{ name }`, the repository added or found listed, in place of
    fate's field `added` on the record.
- **Rationale**: fate answered a mutation with its record, since a client had no other way to learn
  the change. A subscriber gets it as a `change`, and a `sub` sent after the `result` reads it
  (R48).
- **Where**: task 7, `crates/protocol/src/workspace/`. Tasks 8 to 10, whose records are all of one
  repository, and tasks 36 to 48, which read them.

## R53: The core's views cross as the JSON the core writes

- **Decision**: a protocol type named `…View` is the core's view of that name: `FeatureView`,
  `StepView`, `ProposalView`, `PullRequestView`, and the others of
  `crates/protocol/src/workspace/features.rs`. The server turns one into the other with
  `views::sent`, through the JSON the core's `Serialize` writes, which the protocol's type reads. A
  core type with no JSON form, as the themes and the run options, is converted field by field, in
  the domain's file.
  - `WorkspaceFeature` is a `FeatureView` with its `id`, its `label` in the sidebar, and its
    `status`, flattened into one object.
- **Rationale**: the protocol's crate does not depend on the core, and a type that crosses must
  derive `TS` and `Deserialize`, which the core's views do not. The core's JSON is what the Node
  binding sent, so the names and the shapes carry over. Each record's contract test,
  `<Record> answers its shape`, reads the answer with the protocol's type.
- **Alternatives considered**: `TS` derived in the core, with the protocol on top of it: one
  definition, but the core's views are shared by four tasks of the wave, and `ts-rs` would join the
  core's build.
- **If wrong**: a field the core adds is not sent until the protocol's type names it, and one it
  renames fails the record's read as `internal`, which its contract test sees. Tasks 7 and 8 both
  declare the feature's types: the join gives them one home.
- **Where**: task 7, `crates/server/src/records/workspace/views.rs`. Tasks 8 to 10.

## R54: One watcher, two lists of hooks, and `notify` for the files outside a repository

- **Decision**: `crates/server/src/records/watch.rs` is the server's one file watcher, started once
  every records domain registered, and stopped by `Server::stop`.
  - **A repository's files**: the core's `watch` runs for each listed repository whose folder is
    there, and follows the list. After each burst it calls each function of `FILES_CHANGED`, of
    shape `fn(&Shared, &str, &Changes)` since the join (R93), `fn(&Bus, ..)` before it: the server's
    shared state, the repository's name, and the core's `Changes`, which names features, files, and
    flags, not paths. A domain adds one line there.
  - **The config folder**: after each change of `config.toml` or of the themes folder it calls each
    function of `CONFIG_CHANGED`, of shape `fn(&Shared)`.
  - **The list**: a change of `repositories.json`, by `ura add` or by hand, reads the list again.
    The list tells its listeners, the watcher first, then the bus: a client that learns of a
    repository finds it already watched.
  - **Files outside a repository** are watched with `notify`, in `watch/files.rs`, as
    `settings-watch.ts` did: from the nearest folder that exists, through a link to where it leads,
    a folder's linked entries too, and a change is told once, 100 ms after the last event. The
    places are worked out again after each change, by folder and inode, so a folder made again is
    watched again.
  - `notify` is a direct dependency of the server now. It was in the lockfile, through the core.
- **Rationale**: the core's `watch` reads a repository's workspace, so it cannot watch a config
  folder. The human keeps the settings in their dotfiles, where the file is a link.
- **If wrong**: a watch that fails to start is printed, and its files show when read again.
- **Where**: task 7, `crates/server/src/records/{watch.rs,watch/files.rs}`, and the tests
  `the_list_follows_its_file`, `a_commit_reaches_the_workspace_and_what_needs_the_human`,
  `a_host_name_in_the_settings_passes_the_guard_until_it_changes`, and
  `a_theme_file_written_reaches_the_record`. Tasks 8 to 10, 16, and 17.

## R55: A repository is found by its name through the list the server keeps

- **Decision**: `records::repositories::find(&Shared, name) -> Result<Repository, Fault>` gives the
  listed repository of a name, the core's `Repository`, whose `path` is its main checkout. It
  refuses a name the list does not have, and a repository whose folder is gone. `all` gives every
  repository as last read, `label` an item's name in the sidebar, `reload` reads the list again
  after a write of its file, and `on_change` is told of each change.
  - The list is read as the server starts, after each action that writes it, at each change of its
    file, at each read of the record `Repositories`, and by `find` for a name not listed or a folder
    that came or went since. A file that cannot be read keeps the rows, and is the record's
    `problem`.
  - `POST /open` and a start's folder read the list again once they added to it.
- **Rationale**: every record of a repository starts there, so it costs one look at `.git`, and no
  read of the file.
- **Where**: task 7, `crates/server/src/records/workspace/repositories.rs`, and the test
  `a_record_of_a_repository_no_longer_there_is_refused`. Tasks 8 to 19.

## R56: The settings in force come from the environment, the file, then the default

- **Decision**: `records::settings::current(&Shared)` gives the settings in force, the record
  `Settings`: each value, the file's, and its source.
  - The server has no flag for a setting but `--port` (R32). A variable gives a value for one run:
    `URAEDA_ALLOWED_HOSTS`, `URAEDA_AUTOMATIC_CONTINUES`, `URAEDA_CONTINUE_AFTER_RESTART`,
    `URAEDA_CONTINUE_AFTER_LIMIT`, and `URAEDA_CATCH_UP_PULL_REQUESTS`. One that is not a value of
    its setting stops the start, naming the variable.
  - The port in force is the one the server listens on, from `--port` or the default: the file's
    port stays the Node server's until task 61, and `settings.setPort` still writes it.
  - The allowed host names reach the guard through `Shared::allow_hosts`, as the server starts and
    at each change, from an action or on disk. `Shared` no longer reads them itself.
  - The themes are read at each read of `Themes`: the core's read never fails, so nothing is kept.
- **Rationale**: the settings decision's order, flag, variable, file, default, with the flags the
  Rust server has.
- **Where**: task 7, `crates/server/src/records/workspace/settings.rs` and `settings/`,
  `crates/server/src/shared.rs`, and the tests `settings_answers_its_shape`,
  `host_names_given_by_the_environment_stay_whatever_the_file_lists`, and
  `a_variable_that_is_no_value_stops_the_start`. Tasks 13 to 15, which apply them.

## R57: What the workspace leaves to the sessions, the sandbox, and the join

- **Decision**: four rules of the Node server's workspace are not built in task 7, each because what
  it reads does not exist yet.
  - **A feature's status follows no session.** `workspace/status.rs` decides it from the step alone:
    it needs the human when it has problems or its step waits on them, and is idle otherwise.
    `FeatureStatus` has its final shape, with `session`, `turn`, and `wait` empty. The sessions
    (task 15) bring the rules before that one, in the same file, marked `TEMPORARY:`.
  - **`NeedsYouList` holds features only.** A chat refused an action is a row the sessions add.
  - **`repositories.remove` is not refused while an agent works** in the repository.
  - **The locked list** of the sandbox, which refused the list's actions and the folder suggestions,
    comes with the server's sandbox (task 20).
  - **The refresh of the pull requests**, `pulls.ts`, and the fetch every 5 minutes, `git-fetch.ts`,
    ran from the Node server's watcher of each repository. No task of the plan names the first: a
    workspace shows the pull requests the core last knew, which is none until something asks `gh`.
- **Rationale**: the plan builds the sessions and the sandbox later, and a record's shape is what a
  screen is written against.
- **If wrong**: the join task, or task 10 for git, takes the refresh of the pull requests, with a
  line in `watch.rs`'s `FILES_CHANGED`.
- **Where**: task 7, `crates/server/src/records/workspace/{status,needs_you,repositories}.rs`. Tasks
  10, 15, and 20.

## R58: The features' records take `{ repo, id }`, a missing one is `null`, and an action answers what no record shows

- **Decision**: the shapes of the features' records and actions, where fate's did not carry over.
  - A record of a repository takes `{ repo }`: `Priorities`, `Inbox`, `Ledger`, `AllBranchChanges`.
    A record of one thing of it takes `{ repo, id }`, with the id fate gave it: a feature's folder
    for `Feature`, `History`, `BranchChanges`, and `RecommendedMessage`; `<folder>/<name>` for
    `WorkflowFile` and `BranchDecision`, or a default round's `inbox-triage` and `decisions-check`;
    a path for `ProposalFile`. `ProposalHints` takes `null`.
  - `WorkflowMessage` takes `{ repo, folder, trigger }`, in place of fate's
    `<folder>:<trigger>[:<file>]`, whose file nothing read.
  - A record of something that is not there has the value `null`: a folder that is no feature's, a
    file its feature lacks, a decision its branch lacks, a round no agent wrote. fate sent a record
    of empty fields with `missing: true`.
  - `Dropped`, `StartPlan`, and `ContinuedAll` are not records: fate read them once, from their
    mutation. `feature.drop` answers `Dropped`, `feature.start` and `feature.startText` answer
    `StartPlan`, and `ContinuedAll` is declared with `feature.continueAll`, by task 15.
  - An undoable write of the lists answers the change an undo writes back, an `UndoChange` of each
    file's bytes in base64, with what no record shows: `ListWritten { hash, change }`, the list's
    hash to write over next; `NoteMoved { change }`; `FileWritten { path, change }`, the proposal
    file to open. `inbox.edit`, `priorities.commit`, and `priorities.discard` are not undone, and
    answer no change. `inbox.removeImage` answers the inbox's hash, not its file's. The core records
    the change as the write runs, so the binding's token and its `takeChange` are gone.
  - `feature.setRunOptions`, `feature.fixLinks`, and `item.settings` answer `null`.
    `feature.promote` answers the core's `PromotedView`, and the three `change.*` starts
    `ChangeStarted { folder, session }`.
  - `inbox.add`'s `about` is a feature's folder, as the core takes it: the note is marked with its
    slug.
- **Rationale**: the contract's own examples take `{ repo, id }` for `Feature`, and answer a hash
  for `proposals.add`. A value that is `null` says "not there" without a second shape, and a
  client's signal already has "not read yet". Task 7's ruling T7.1 says the rest.
- **If wrong**: an argument's shape is one type of `crates/protocol/src/features.rs`.
- **Where**: task 8, `crates/protocol/src/features/`. Tasks 37 to 41, which read them.

## R59: The core's views are mirrored with the core's names, and the workspace's types are copied until the join

- **Decision**: the features' records cross as task 7's ruling T7.2 says, through the JSON the core
  writes. Their protocol types are the core's definitions, with the core's names, fields, and
  documentation: about ninety types, of which `FileView` and the document tree under it (`Document`,
  `Block`, `Span`), the items of each kind of file, `Inbox`, `Priorities`, `ProposalFileView`,
  `HistoryView`, `BranchDecision`, `Constitution`, and `Decision`.
  - Two names changed, since the client's types are one file: the spec's `Principle`, of its
    constitution check, is `SpecPrinciple`, beside the constitution's `Principle`; the core's
    `BranchChanges` is `BranchChangesView`, inside the record `BranchChanges { changes, failed }`.
  - An optional field is sent as `null`, never left out, as the core writes it.
  - The seventeen types the workspace's domain declares too were copied word for word until the
    join, which gave each one declaration, in `crates/protocol/src/shared/` (R84).
- **Rationale**: the tasks of the wave cannot use each other's code, and two types of one name must
  be the same text for the catalog to take both. Copied by a script from the core's source, the
  mirror cannot differ from the core by a typing mistake, and each record's contract test reads the
  answer with it.
- **If wrong**: a field the core adds is not sent until the mirror names it, and one it renames
  fails the read as `internal`. One definition, with `TS` derived in the core, removes the mirror:
  T7.2 names that alternative.
- **Where**: task 8, `crates/protocol/src/features/{document,items,spec_items,decisions}.rs`, and
  `crates/server/src/records/features/views.rs`. The join after wave 6.

## R60: A write of this domain takes its repository's turn, and a start answers once it landed

- **Decision**: until the write queue (task 9) was joined, `records/features/turn.rs` gave one
  writer per repository: a lock by main checkout, taken by every action of this domain that wrote.
  The join replaced it with the queue's `write` and `land` (R89 to R91), and what follows describes
  the stand-in.
  - A start answers once it landed, and a refusal is the call's `error`. The Node server answered
    `feature.start` once the core planned it, and ran the start in its queue, where the record
    `WriteQueue` showed its steps and its refusal. Without that record a start that failed after its
    answer would have nowhere to say so.
  - A commit is made within its call: nothing is deferred, so a hook's refusal of a start's commit
    leaves the files written, as through `ura`.
  - The core's own write lock still guards every write, whatever takes the turn.
- **Rationale**: the plan gives the queue to task 9, built at the same time. One lock keeps the one
  rule the tests of this task need: no write between a change's start and its note's removal.
- **If wrong**: a start blocks its caller for as long as the repository's hooks run.
- **Where**: task 8, `crates/server/src/records/features/{turn,lists,starts}.rs`. Task 9, and the
  join after wave 6.

## R61: What the features leave to the sessions, the uploads, and the watcher

- **Decision**: the workflow part of each action is built, and what needs a session is left at one
  comment `// TASK 15:`, with the action's name in task 15's text.
  - `feature.continueAll` is not declared: it only sends runs.
  - `Feature` has `session`, `sessions`, `runtime`, and `newPick`, empty until the sessions exist,
    and lacks `agent` and `tokens`. Its status is the step's alone, as the workspace's.
  - `RecommendedMessage` takes an agent as available.
  - The starts keep and send no message, and the `change.*` starts answer `session: null`: the
    change's page offers its message unsent. Since the join a start is a write of the queue, and a
    feature's answers once planned (R91). `feature.drop` and `feature.promote` hold, archive, and
    move no session, and no write is refused while an agent works.
  - A typed start with images was refused until the join: the uploads (task 16) keep an image's
    bytes, and a start reads them from their store since (R95). `change.fromNote` reads a note
    file's images from the repository, and takes them.
  - Nothing called `files_changed` and `config_changed` until the one watcher (task 7) was joined
    (R93): a record followed this domain's own actions only.
- **Rationale**: the plan builds the sessions, the uploads, and the watcher in other tasks.
- **Where**: task 8, `crates/server/src/records/features/`. Tasks 15 and 16, and the join.

## R62: A feature's own run options are a JSON file of the data folder

- **Decision**: `run-options.json`, in the data folder, holds each feature's own run options, by its
  repository's main checkout, then by its folder. A row holds only what the feature changed, as the
  core normalizes and checks it, and options that set nothing remove the row. The file is written
  whole, beside itself first, then renamed. A file that cannot be read is never replaced: a read
  answers no options and prints why, and a write is refused.
- **Rationale**: the Node server kept them in `run-options.sqlite`, apart from the session cache so
  they are never lost with it. The rows are a handful, read whole, and the session store (task 11)
  is the only code that opens its SQLite file. Compatibility may break: the two servers share no
  data, and the old rows are not imported.
- **Alternatives considered**: a table of the session store: the human's choices would live in the
  file the importer fills, and task 11 is built at the same time.
- **If wrong**: the store is `records/features/options.rs`: `own` and `set` are its whole surface.
- **Where**: task 8, `crates/server/src/records/features/options.rs`, and the test
  `a_features_run_options_are_stored_and_survive_a_restart`. Task 15, whose runs read them.

## R63: What writing's actions answer, and `Undo` is no record

- **Decision**: an action of writing answers only what its caller cannot read in a record.
  - An undoable write answers `Recorded { change }`: the change it made, an `UndoChange`, for the
    client's undo stack. `review.comment`, `review.edit`, `review.remove`, `review.startOver`, and
    `settled.remove` do.
  - A save whose next save takes a hash answers `Saved { hash }`: `buffer.save`, `text.save`,
    `text.discovery`, `defaultRound.answer`, and `defaultRound.notes`.
  - `undo.apply` answers `UndoApplied { commit }`, and `undo.committed` a boolean. `Undo` is not a
    record: fate's `Undo` was the type of those two answers, and nothing read it.
  - Every other action answers nothing. The file it wrote reaches its record's subscribers as a
    change.
  - Every record and action names its repository, `repo`, by its name in the list. An action that
    commits takes `write`, `{ href, label }`, the name the write queue shows its commit under.
  - `QueuedWrite` has no `queued`, and `WriteFailure` no `unsent`: nothing sets them before kept
    messages are ported (task 15). `steps` came with the starts, at the join (R91). A new field
    keeps the protocol's version.
- **Rationale**: fate answered a mutation with its whole record, which was how a page saw its own
  write. Here the subscription brings it, so an answer that repeated it would send a spec twice. The
  hash and the change are what a client must hold before the record's change arrives: the next save
  takes the first, and the undo stack the second.
- **If wrong**: an output is one type of `crates/protocol/src/writing.rs`. The inbox's and the
  priorities' undoable writes, built at the same time, need the same `UndoChange`: the join gives it
  one home.
- **Where**: task 9, `crates/protocol/src/writing.rs`. Tasks 20, 23, 42, 47, and 50.

## R64: The write queue is one function, a turn per repository, and a thread that lands

- **Decision**: every write to a repository runs through `records::writing::write`.
  - **The entry point**: `write(&Shared, repository, Write, run) -> Result<T, Fault>`. `repository`
    is the name in the list. `run` gets the main checkout, and calls the core. `Write::saving()` is
    a write that commits nothing. `Write::of_feature(folder)` and `Write::of_lists()` are writes
    that commit, with `.file(name)` for the record, and `.named(input.write)` for the client's name.
  - **A turn**: writes of one repository run one at a time, in the order their handlers reached the
    queue. A committing write first waits for the queued commits of what it commits, a feature's
    folder or the lists, since the core would not defer a second commit of a file whose first has
    not landed. A turn's end takes the commits the write deferred, even when it failed, and queues
    them under its name.
  - **Landing**: each repository has one thread, which lands its commits in order, with the hooks. A
    refused one stays in the record until `writes.dismiss`, as `hook` or `failed`, and does not stop
    the next.
  - **Deferral**: the core defers a repository's commits from the first write through its queue,
    until the server stops. Stopping waits for the commit that runs, and lands no other.
  - **What it says**: `WriteQueue` at each change of the record, each printed line included, and
    every `Buffer` somebody holds after each write. The engine's pace of 16 ms replaces the Node
    queue's 100 ms throttle.
- **Rationale**: handlers are plain functions on blocking threads, so the turn is a lock with
  tickets and a condition variable, and needs no runtime. One function serves saves and commits: a
  save defers nothing, so nothing is queued for it.
- **How it was checked**: three breaks, each run on `two_writes_on_one_repository_land_in_order`.
  - Two threads landing one repository's commits: failed, the second write read `running` while the
    first still ran.
  - No wait for the queued commits of a write's keys: failed, "the lists' second commit ran before
    their first landed".
  - No turn between calls: passed. The core's own write lock keeps two calls apart, so the turn only
    decides which write a deferred commit is taken for, and in what order waiting writes go. A test
    cannot hold a call between its write and its take through the protocol.
  - Deferral left on at the stop: failed `a_stopped_server_defers_no_commit_any_more`.
- **If wrong**:
  - The queue kept the order writes reached it in, not the order a client sent them in: the engine
    started each call on a task of its own, so two calls sent back to back could reach the queue in
    either order. The join made a connection's calls reach it in the order sent (R92).
  - `cargo fmt` did not see a module declared inside `domains! { }`: the join made them plain `mod`
    lines (R86).
  - Git and the hooks the core runs got the server process's environment, without the config
    folder's `.env`, since the core starts them itself: the join gives them its variables (R96).
- **Where**: task 9, `crates/server/src/records/writing/queue.rs` and `queue/repository.rs`. The
  join of wave 6, and tasks 8, 10, 15, and 16.

## R65: What the write queue leaves to the tasks that need it

- **Decision**: the parts of the Node server's queue that nothing calls yet are not ported, since
  unused code fails the lint.
  - **The refusal while an agent works** (`writable` in `fate/sessions.ts`): task 15 owns the
    sessions. Each handler of writing knows the folder or the path it writes, so the refusal is one
    check before its `write`.
  - **A landing of its own, and its steps** (`add`, `enqueue`, `update`, `free`, `inTurn`): a
    start's write. Built at the join, as `writing::land` (R90) and the starts (R91).
  - **Kept messages** (`unsent`, `waits`, `settled`, and `queued` on a write): sessions.
  - **Git's own writes** (`arrive`, `background`, and `landed`): task 10's actions and the fetcher.
    Built at the join (R90); `arrive` is the order of a connection's calls (R92).
  - **A repository leaving the list**: its queue stays open until the server stops.
  - **The other domains' records**: a write here said `Buffer` and `WriteQueue` only. Since the
    join, the queue tells every domain after each write and each landing (R89).
- **Rationale**: each is a few lines beside the code that calls it, and a seam nobody calls cannot
  be tested.
- **Where**: `crates/server/src/records/writing/queue/repository.rs`. The join of wave 6, and tasks
  8, 10, and 15.

## R66: Git's records are keyed by their arguments, and the items of their lists carry an `id`

- **Decision**: how the Git page's views and mutations became records and actions, in
  `crates/protocol/src/git.rs`.
  - **A repository is named.** Every record's arguments and every action's input have `repo`, the
    repository's name in the server's list, as the contract's examples do.
  - **Fate's ids are gone.** `GitPage`, `GitSummary`, `GitDiff`, `GitHistoryPage`, and
    `ConflictFile` no longer hold an `id`: a record's key is its arguments. A diff is asked with
    `{ repo, folder, commit, path, whole }`, in place of the id fate packed those in. `GitCommit`
    keeps its `id`, the commit's.
  - **A list's items carry an `id`**, so the page changes item by item: a group's is its feature's
    folder, or `.` for the main checkout's; a file's, a conflict's, and a worktree's is its path; a
    commit's row has the commit's.
  - **States stay texts**, as the core gives them, typed as unions in the client's types
    (`"modified" | "new" | "deleted"`).
  - **An action is a type that is its own input**, named after it: `GitStage` for `git.stage`.
    `git.commit` is `GitCommitStaged`, since `GitCommit` is the record. Every action answers
    nothing, and the records show what it changed, but `git.saveConflict`, which answers the file
    with its new hash.
  - **Every write takes `write`**, the name the queue's record shows it under, since the join (R90):
    the page's own name when none is given.
- **Rationale**: an `id` that is always `git` says nothing, and one that packs four arguments is
  parsed on both sides. With ids on the items, staging one file sends one field, not every file of
  every group.
- **If wrong**: a client that wants the whole page at each change loses nothing: it applies the
  changes. The ids are four lines of `crates/server/src/records/git/views.rs`.
- **Where**: task 10, `crates/protocol/src/git.rs`, `crates/server/src/records/git/views.rs`. Tasks
  46 and 47.

## R67: A git write takes its repository's turn, and says what it changed

- **Decision**: what every action `git.*` does around the core's call, in
  `crates/server/src/records/git/writes.rs`.
  - **One writer per repository**: until the join, `queue::in_turn`, a lock per main checkout, which
    kept no record, so git's output went nowhere. Since the join each write lands in the write
    queue, under its name, with git's output (R90).
  - **The checkout's guard is written, and nobody works yet.** A write is refused while an agent
    works in a checkout it writes, checked as it lands: the main checkout's for a chat, a feature's
    worktree for its agent, both for a worktree's removal and a feature's cleaning. `working::chat`
    and `working::folders` answer that nobody works, marked `TEMPORARY:`, and so do the page's
    `agentWorking` and `isWorking`. Task 15 answers from its sessions, and owes the Node server's
    test `the page refuses its writes while a chat works in the checkout`.
  - **A fetch is refused for no agent**: it writes no file of a checkout. The Node server refused a
    person's fetch while a chat worked.
  - **After each write, landed or refused**, the bus is told the repository's `GitPage` and
    `GitSummary` changed, and every `GitDiff`, `GitHistoryPage`, and `ConflictFile` somebody holds:
    a working tree's diff and a commit's mark follow a write. `files_changed` says the same for a
    change the core's watcher reports, as `live.ts` maps it: an edit of the priorities, the inbox,
    or a feature, or a change of a checkout's git state. Since the join the queue says it after each
    write, as `git::written`, and the one watcher calls `files_changed`.
- **Rationale**: a record nobody holds keeps its value for a minute, so a write that tells nobody
  leaves the next page that opens on the old one.
- **How it was checked**: without the bus told after a write, seven tests of
  `crates/server/tests/git.rs` fail, each reading the page as it was. With a group's folder dropped
  on the way to the core, `a_groups_writes_land_in_its_features_worktree` fails.
- **Where**: task 10, `crates/server/src/records/git/{writes,queue,working,mod}.rs`. Task 15, and
  the join of wave 6.

## R68: The fetcher is one round over the list, every 5 minutes

- **Decision**: `fetcher::start` fetches `origin` of each repository of the list as the server
  starts, then every 5 minutes, one after another, each in its repository's turn. Why a repository's
  last fetch failed is kept in memory for its page's `fetchFailure`, until one succeeds. `git.fetch`
  with `quiet` is the page's own, as it opens: it never fails. A person's fails as git does, and its
  outcome is kept too.
  - A repository that joins the list after a round began is fetched by the next round, or as its
    page opens. The start's own folder joins the list after the domains mount, so a first start in a
    new folder is one such.
  - Two fetches of one repository asked together run one after the other: the Node server joined the
    second to the first.
- **Rationale**: the Node server kept a fetcher per open repository, started by its host. The list
  is task 7's, built at the same time: a round that reads the list needs nothing of it.
- **How it was checked**: `a_repository_of_the_list_is_fetched_as_the_server_starts` fails without
  the fetcher's start. The 5 minutes have no test: the round is the one the start runs.
- **Since the join**: a repository that joins the list once the server runs is fetched as it joins,
  where its watcher starts (R93).
- **Where**: task 10, `crates/server/src/records/git/fetcher.rs`.

## R69: The session store is three tables, and a transcript is a log of events

- **Decision**: `sessions.sqlite`, in the server's data folder, at schema 1. `runner::Store` is the
  only code that opens it, through `rusqlite` with SQLite built in.
  - `sessions` and `turns` keep the Node store's columns, under the same names but
    `automatic_continues`, now `continues`, and without `pid`. A time is the milliseconds since
    1970, an integer, where the Node store wrote ISO 8601 texts.
  - `events` is a turn's log: `(turn_id, seq)`, `at`, `type`, and `data`, the event's JSON. Rows are
    added and never changed. `seq` counts from 0 in each turn, and is an event's name.
  - A row of a text also says how long its text is, `text_start` and `text_bytes`: a piece reads the
    turn's last such row through an index, and never the turn (R47).
  - The schema's number is `PRAGMA user_version`, and a change is a new step at the end of
    `schema.rs`. A file with a higher number is refused before anything is written, the journal's
    mode included, and keeps every byte.
  - The file is in SQLite's write-ahead mode, with `synchronous` at `NORMAL`.
  - A file that cannot be opened stops the server's start, and is left as it is. The Node server
    replaced a damaged file with an empty one.
- **Rationale**: R2 asks for a log per turn. The Node store changed an item in place, a text at each
  piece, so a reader that fell behind had to read the turn again. With a log, a reader asks for what
  follows the last event it has, and a piece of a reply is one row written once.
- **Alternatives considered**: the text's length kept in memory by the store: lost at a restart, and
  a second state to keep true. Times as ISO texts: a date parser and a formatter in Rust, for a
  format no person reads in a database.
- **If wrong**: a reply streamed in many pieces is many rows, and its whole `text` repeats them. A
  later step of the schema can fold the pieces of an ended turn into their `text`.
- **Where**: task 11, `crates/server/src/runner/{schema,store,session,turn,log}.rs`, and the tests
  `a_transcript_reads_back_as_it_was_written`, `a_store_of_a_newer_schema_is_refused_untouched`, and
  `a_piece_of_text_says_where_its_text_started_and_how_long_it_was`. Task 15.

## R70: `Event` is the agent's events, and three of the runner's

- **Decision**: `runner::Event` has the twenty kinds of `AgentEvent` in `events.ts`, with the same
  JSON, `{"type":"toolEnd","id":..,"isError":..}`, and three kinds no agent sends, which the runner
  logs: `message`, `denial`, and `allowed`.
  - The Node store kept an `Item` per line of a transcript, and changed it: a message's state, a
    tool call's end, a blocked action once allowed. A log changes nothing, so each change is an
    event: `accepted` or `cancelled` after a `message`, `toolEnd` after a `toolStart`, `allowed`
    naming the `seq` of a `denial`.
  - The module's documentation says how a log reads as a transcript. A text is every `textDelta`
    since the last `text`, wherever other events came between; a tool call lasted from its start to
    its end; a thought lasted since the `activity` of kind `thinking` before it.
  - The store takes any event, and cuts nothing. The 4,000 characters a tool's output and a thought
    are cut to are the reader's rule, in task 15.
  - An event is read with `Event::parse`, or `serde_json::from_value`, never `from_str`: NSH's
    bundler turns on serde_json's `arbitrary_precision`, and a number with a fraction, as a usage
    window's `used`, then fails to read from a text into an enum that names its kind in a field.
- **Rationale**: the plan gives one type to the runtimes (task 12) and to the store. A runtime sends
  what `AgentEvent` has, so a recorded stream compares with the Node code's events as JSON (task
  13). The three others are what a transcript holds that no agent says.
- **Alternatives considered**: a second type for a log's lines, wrapping the agent's: two types and
  a conversion, for three kinds.
- **If wrong**: a runtime could send a `message`, which means nothing from an agent. The manager
  ignores it, as it does a kind it does not know.
- **Where**: task 11, `crates/server/src/runner/event.rs`. Tasks 12 to 15.

## R71: The store has no clock, and an append says what it grew

- **Decision**: the plan's `Store::append(turn_id, Event)` is
  `Store::append(turn_id, at, &Event) -> Result<Appended, StoreError>`.
  - Every method that writes takes its time, `shared.now()`: the store holds no clock.
  - `Appended` has the event's `seq`, and for a `textDelta`, `text: Some(Growth { start, at })`:
    `start` is the `seq` of the text's first piece, which names the text, and `at` its length in
    bytes before this piece, what `Bus::append` takes.
  - `Store::log(turn_id, from)` gives the events from the place `from`, each with its `seq` and its
    time.
  - `Store::open(data_dir)` returns a `Result`. `runner::mount`, in `DOMAINS`, provides the store as
    `shared.get::<Store>()`, and closes it as the server stops: a call after that fails with
    `StoreError::Closed`.
  - `create_session` and `add_turn` are there for the import's tests and task 15's first steps. The
    other writes, a turn's end, a session's fields, the continues, are task 15's to add, in files
    beside `session.rs` and `turn.rs`, through `Store::read` and `Store::write`.
- **Rationale**: a test sets the server's clock, and a store with its own would read the system's.
  Holding `Shared` for its clock would make the store and the server hold each other.
- **Where**: task 11, `crates/server/src/runner/{store,log,mod}.rs`. Task 15.

## R72: What the import keeps of the Node store, column by column

- **Decision**: everything but what is listed as dropped.
  - **A session**: `id`, `repo`, `folder`, `parent`, `role`, `step`, `worktree`, `agent`,
    `native_id`, `title`, `model`, `effort`, `ran_model`, `ran_effort`, and `automatic_continues` go
    to the same columns; `created_at`, `updated_at`, `seen_at`, and `archived_at` as milliseconds.
    **Dropped**: `pid`, the Node server's process that held the session.
  - **A turn**: `id`, `session_id`, `kind`, `trigger`, `step`, `allowed`, `caught_up_to`, `state`,
    `reason`, `continue_at`, `continue_reason`, and the four token counts go to the same columns;
    `started_at`, `ended_at`, and `dismissed_at` as milliseconds. R73 says which turns change.
  - **An item** becomes one to three events, in its place. Its `seq` is not kept: an event's is new.
    Its `at` is its events' time, but where said.
    - `message`: a `message` with its `id`, `origin`, `text`, `opening`, and `images`. Its `state`
      is the event after it: `accepted` for `read`, `cancelled` for `taken-back`, none while
      `pending`. Its own `at`, when it has one, is its time.
    - `text`: a `text`, or a `textDelta` alone when `streaming`, a text cut short.
    - `tool`: a `toolStart` with its `id`, `name`, `toolKind` as `kind`, `target`, `parent`, and
      `subagent`. `completed` and `failed` add a `toolEnd` with `output`, `durationMs` later, put
      before the first item written after that time. Any other `status` is a call cut short.
      **Dropped**: nothing. Its `input` is empty: the Node store kept none.
    - `thought`: a `thought` with its `parent` and `text`. `durationMs` is the time since an
      `activity` of kind `thinking`, added before it, when it lasted and has no `parent`.
    - `system`: a `notice` with its `text`.
    - `denial`: a `denial` with its `tool`, `target`, and `rule`. `allowed` is an `allowed` naming
      it, at the end of the turn's log. One not allowed still waits to be allowed, by its rule.
  - **An item that cannot be read**, of an unknown kind or with other fields, is left out and
    counted: `ura import-sessions` says how many.
  - **Chat images**: each file a message names is copied from the old `images/` to the new one, when
    it is there and not yet in the new folder.
  - **Not in the store, so not imported**: the search text, which was a query over messages and
    texts, and is one over `message` and `text` events; the queue, which is the queued turns and
    their pending messages; a feature's run options, in `run-options.sqlite`, which belong to no
    session and wait for the task that ports them.
- **Rationale**: the task is risky because it changes a stored format: the list is what a review
  checks against the Node store's tables.
- **How it was checked**: `fixtures/runner/old.sqlite` is written by the Node server's own
  `SessionCache`, through `fixtures/runner/write-old.ts`, with every kind of item in each of its
  states. `an_old_store_imports_with_every_session_and_event` asserts each event of its nine turns.
- **If wrong**: the old file is never changed, so a fixed import runs again with `--replace`.
- **Where**: task 11, `crates/server/src/runner/import/{old,lines}.rs`.

## R73: The import runs once, reads only, and leaves nothing running

- **Decision**: `ura import-sessions [--from DIR] [--data-dir DIR] [--replace]`.
  - It reads `runner.sqlite` in the Node server's data folder, or `--from`, and writes the store of
    `ura serve`'s data folder (R32), or `--data-dir`.
  - **Read only**: the old store is opened read-only, at one moment of it. Its bytes never change.
    SQLite leaves its two side files beside it, `runner.sqlite-shm` and an empty
    `runner.sqlite-wal`, as any reader of a store in that mode does.
  - **All or nothing**: one transaction holds every session, turn, and event.
  - **Once**: a store that holds a session is refused, and nothing changes. So a second run does
    nothing. With `--replace`, the same transaction first removes every session of the store, those
    made in the Rust server included, so the result is the first run's.
  - **Schema 12 only**, the Node store's last. An older file is one the Node server never opened at
    this version: starting it once brings it there.
  - **Nothing imported runs by itself.** A turn that ran or was queued is stopped, at its last
    event. A turn the Node server's stop cut, not dismissed and with no continue decided, is the one
    a server continues at its next start: its reason becomes the import's. A continue that waited
    for its time is dropped. Each reads as a stopped or failed run, which a message continues. A
    dismissed turn, and one past its cap, stay as they were.
- **Rationale**: until task 61 the Node server is the human's working Uraeda, and may run after an
  import. A run both servers continue is two agents in one worktree. R2 calls the import a one-time
  tool, so a second run that merges is more than it needs.
- **Alternatives considered**: merging by session id on a second run: sessions that went on in the
  Node server would stay as first imported. Keeping the waiting continues: right only once the Node
  server is gone for good, which the import cannot know.
- **If wrong**: at the last import, with the Node server stopped for good, a run that waited to
  continue waits for the human instead. `settle`, in `import.rs`, is the one function to change.
  Nothing checks whether `ura serve` runs: a running server shows the imported sessions only once a
  client reads them again.
- **Where**: task 11, `crates/server/src/runner/import.rs`, `crates/cli/src/import_sessions.rs`, and
  the tests `an_import_keeps_the_old_store_and_never_runs_twice_by_mistake`,
  `an_imported_session_keeps_its_place_and_runs_nothing_by_itself`, and, for the command,
  `import_sessions_copies_the_earlier_servers_sessions_once`. Tasks 15 and 61.

## R74: The reminder to remove the importer is already in the inbox

- **Decision**: task 11 adds no inbox note. The default branch's `specs/INBOX.md` already holds it:
  "Remove `ura import-sessions` and its importer once the port to the Rust server is done".
- **Rationale**: a branch never writes `INBOX.md`, and an agent's note file in `specs/notes/`, which
  a branch may write, would say the same thing twice.
- **What to remove then**: `crates/cli/src/import_sessions.rs` and its lines in `main.rs`;
  `crates/server/src/runner/import.rs` and `import/`, with their exports in `runner/mod.rs`; the
  import's tests in `crates/server/tests/runner_store.rs`, and
  `crates/cli/tests/import_sessions.rs`; `fixtures/runner/`; and the command's lines in
  `docs/cli.md` and `skills/uraeda/references/cli.md`.
- **Where**: task 61.

## R75: `/mcp` is open to the session check, and closed by a process's own token

- **Decision**: `/mcp` is in `sign_in::OPEN`, as `Open::Anyone`, and a layer of its own route
  answers 401 `Unauthorized`, before the body is read and whatever the method, to a request without
  the token of an agent's process. A session's cookie, a device's token, and the host token open
  nothing there.
  - A token is 32 random bytes, `secret::random(32)`, made by `Mcp::issue(session)` and ended by
    `Mcp::revoke(token)`. A session holds one at a time: its next process's token ends the one
    before.
  - It is kept as a `secret::Hashed`, in memory only, and compared with `Hashed::is`, every token
    each time. The runtime gives it to its process in the environment (tasks 13 to 15), never in a
    file and never in the arguments.
- **Rationale**: it is the Node server's rule, `TOKEN_PATHS` of `sign-in/check.ts`. An agent's
  process has no cookie, and a token per process ends with the process, where a session's would give
  an agent everything its owner reaches.
- **If wrong**: the sign-in decision's first rule lists the open routes, and `/mcp` is not among
  them, on the Node server either. Only a human amends a decision: the line to add is "and the
  agents' MCP endpoint, which takes the token of an agent's process".
- **Where**: task 16, `crates/server/src/mcp/{mod,tokens}.rs`, `sign_in/check.rs`, and the tests
  `the_mcp_endpoint_refuses_a_wrong_token` and
  `every_route_but_the_open_ones_refuses_a_request_without_a_session`. Tasks 13 to 15.

## R76: The endpoint declares the tools, and the sessions run them through `mcp::Runner`

- **Decision**: `run_agent` and `review`, the only tools the Node server has, both run agents, so
  neither is served by the core alone. `crates/server/src/mcp/tools.rs` holds what an agent reads of
  each, its description and its arguments' schema, and the check of the arguments. What they do is
  the trait `mcp::Runner`, which task 15 gives with `shared.get::<Mcp>().serve(runner)`:
  - `fn run_agent(&self, session: &str, input: RunAgent) -> Answer`, with
    `RunAgent { task, prompt, worktree }`;
  - `fn review(&self, session: &str, input: Review) -> Answer`, with
    `Review { reviewed, base, head, context: Option<String> }`;
  - `Answer` is a boxed future of `Result<String, String>`: the tool's text, or its refusal, which
    the agent reads as the tool's error (`isError`).
  - Until `serve` is called, `tools/list` lists both, and a call answers the tool's error
    `` `run_agent` is not available: this server runs no agent yet. ``
  - **A call stops by being dropped.** The call's stream holds the `Answer`. A
    `notifications/cancelled` of the same session and id, and a connection that drops, drop it,
    where the Node server aborted a signal. What must stop with a call stops in a `Drop`.
  - Progress is sent every 30 seconds: a `notifications/progress` with the client's token, or a
    comment without one.
- **Rationale**: a trait with both methods fails to compile when one tool is forgotten, and the
  arguments reach the sessions typed and checked. A dropped future cannot be left running by a tool
  that forgot to look at a signal.
- **If wrong**: a tool that must do something that awaits as it stops needs a task of its own,
  started from its `Drop`.
- **Where**: task 16, `crates/server/src/mcp/{tools,endpoint}.rs`, and the tests
  `a_tool_the_sessions_have_not_filled_answers_a_clear_error`,
  `a_long_call_reports_progress_every_30_seconds`, and
  `a_cancellation_or_a_dropped_connection_stops_the_tool`. Task 15.

## R77: A mockup's path holds no frame secret yet, and the links without a repository are gone

- **Decision**: what of the Node server's file routes is not ported as it was.
  - `GET /r/:name/mockups/<path>` served the file at `<path>`, to a signed-in request only, until
    the join: the Node server's path starts with the frame secret, which task 18 owned. Since the
    join the path is `/mockups/<secret>/<path>`, open to its frame (R94).
  - `GET /raw/*` and `GET /mockups/*` without `/r/:name`, which sent a link from before repositories
    had names to the most recently opened one, are not ported: compatibility may break.
  - `DELETE /r/:name/chat-images/:id` deleted an image without asking whether a sent message holds
    it, until the join: the session store answers since (R95). The refusal of an upload to a feature
    an agent works on, `files::attach::writable`, waits for the sessions (task 15).
  - What a path may read is the core's rule alone, `api::read_raw` and `api::read_image`: nothing
    outside the repository, hidden, untracked, or behind a symlink. The server opens no file of a
    repository itself.
- **Rationale**: R36 says the guard's frame check waits for task 18, and both tasks are built at the
  same time. One home for the containment rule is what `ura lsp` and the server share.
- **Since the join**: every answer but a mockup's and a preview's carries
  `X-Frame-Options: SAMEORIGIN`, from a layer of `http::router` (R94).
- **Where**: task 16, `crates/server/src/files/`, and the tests
  `a_raw_path_cannot_leave_its_repository` and
  `a_mockup_is_served_sandboxed_and_only_from_a_mockups_folder`. Tasks 11, 15, and 18.

## R78: Uploads are read with axum's `multipart`, after the refusals that need no body

- **Decision**: `axum` gains the features `multipart` and `query`. Three crates are new in the
  lockfile: `multer` and its `spin`, and `serde_urlencoded`.
  - A body that declares more than 21 MiB, the core's 20 MB and room for the multipart around it, is
    refused before it is read, with the core's text, naming the file from the query string. A body
    without a declared size is counted as it is read, and refused past the limit as 21 MB.
  - The other refusals that need no image come before the body is read too.
  - An upload's answer carries the change its write made, `{ commit, files }` with each file's two
    sides in base64, as the Node binding's `takeChange` gave it: the core's `undo::recorded` gives
    it with the write, so no token names it.
- **Rationale**: a hand-written multipart parser is where uploads break. `multer` is the parser axum
  itself uses.
- **If wrong**: the change's form for a client is `files/change.rs`, marked `JOIN(wave 6)`: the
  undo's actions (task 9) own it.
- **Where**: task 16, `Cargo.toml`, `crates/server/src/files/{attach,change}.rs`, and the tests
  `an_upload_comes_back_as_the_image_it_was`,
  `an_upload_over_the_limit_is_refused_without_reading_it`, and
  `a_refused_upload_says_why_and_writes_nothing`. Task 9.

## R79: The frame secret is the previews', and opens a route as `Open::Frame`

- **Decision**: the frame secret lives in `crates/server/src/preview/frames.rs`, with the previews
  that carry it, and the guard and sign-in ask the previews.
  - `preview::frame_secret(&Shared)` gives the current secret, for an address given to a signed-in
    client. `preview::is_frame(&Shared, path)` says whether a path is a preview's or a mockup's with
    it, read with `guard::frame_secret`, and compared with `secret::same`.
  - The guard's `frame` is `is_frame`: its `TEMPORARY:` mark of R36 is gone.
  - `sign_in::OPEN` gains a third kind, `Open::Frame`: the route passes signed in, or on a path with
    the current secret. The proxy's three paths are listed with it. The proxy then answers 404 to a
    signed-in request whose path has another secret, as to a frame.
  - The proxy mounts three paths, the base without its slash, with it, and what is under it: axum's
    `{*rest}` matches no empty rest.
  - The secret is replaced in sign-in's `on_ended` listener itself, so the old one opens nothing
    from that call on. It changes when a paired device ends too, not only a session.
- **Rationale**: one secret serves previews and mockups, as the sign-in decision says, and the
  guard, the session check, and the proxy must read it alike. With `Open::Anyone`, the route would
  have answered 404 where every other closed route answers 401.
- **Since the join**: the mockups' route is listed in `OPEN` as `Open::Frame`, and reads the secret
  from `preview::frame_secret` (R94).
- **Where**: task 18, `crates/server/src/preview/{mod,frames}.rs`, `guard.rs`, `sign_in/check.rs`,
  and the test `a_preview_path_without_its_secret_is_refused`. Tasks 16 and 49.

## R80: A preview's records name their repository, and give whole addresses

- **Decision**: the shapes of the previews' records, in `crates/protocol/src/previews.rs`.
  - `Preview` takes `{ repo, folder }`, `Story` takes `{ repo, id }`, and `preview.restart` takes
    `{ repo, folder }` and answers the `Preview`. `repo` is the repository's name in the list, the
    `<name>` of `/r/<name>/`, as every record of one repository takes it (R52): the task named it
    `repository`, and the join renamed it. `StoryHref` takes `{ href }` alone: the core's rule reads
    no repository.
  - A value has no `id`: its arguments are its key. States are `none`, `starting`, `ready`,
    `failed`, and `missing` for a story.
  - `Preview.base` and `Story.frame` are paths on the server, with the frame secret. A client puts
    the server's address before one, and builds none itself. `Story.storybook` is a route of the
    app.
- **Rationale**: fate was served under `/r/<name>/fate`, so a record's repository was its address.
  One WebSocket serves every repository, so the arguments name it.
- **Where**: task 18, `crates/protocol/src/previews.rs`, `crates/server/src/records/previews.rs`.
  Task 49.

## R81: A read is a view, and three things read a preview's records again

- **Decision**: reading `Preview` or `Story` starts the checkout's command, and counts as its last
  view. The records somebody holds are read again:
  - at each change of the preview's state, and as each story's compile ends;
  - when the frame secret is replaced: every command stops, and the records, read again, start
    theirs under the new address;
  - when `preview::files_changed(&Shared, repository)` is called, for the repository's running
    previews: a commit outside `specs/` then starts one again at the new code. The one watcher calls
    it after each burst (R93). A commit under `specs/` keeps it.
  - A preview stopped for 30 minutes without a view tells nobody: a read would start it again. Its
    frame then answers 503, and `preview.restart` starts it. A held subscription is not a view.
  - A preview whose folder's file waits for the human, and embeds a story, is kept up, as today.
- **Rationale**: fate read a record again at each page load, and the engine reads one only when
  told. Without the watcher's call, a preview would stay at the old code until its page is opened
  again.
- **If wrong**: each watcher event of a repository reads its running previews' records, a few small
  git reads each.
- **Where**: task 18, `crates/server/src/preview/{mod,runner,checkout}.rs`, and the tests
  `a_preview_follows_its_reads_and_its_checkouts_code` and
  `a_preview_path_without_its_secret_is_refused`. Task 49, and the join of wave 6.

## R82: The server waits for every command it started, and records their groups in one file

- **Decision**: how "the server MUST stop every preview command it runs when it stops" is kept.
  - A command is `sh -c <command>`, made with `shared.environment().command("sh")`, leading a
    process group of its own. It gets `URAEDA_PREVIEW_BASE`, and its port in place of `{port}`.
  - Stopping one sends its group `SIGTERM`, then `SIGKILL` after 5 seconds. A command that exits by
    itself has its group killed at once.
  - The runner keeps every command it started until it ended, whatever became of its preview. Its
    stop work, `shared.on_stop("previews", ..)`, stops each and waits for its end, and no command
    starts after it began.
  - The groups are recorded in the data folder's `run/previews.json`, as
    `{ "groups": [{ "pid", "started" }] }`, where `started` is what `ps -o lstart=` prints in the C
    locale and in UTC. A start stops the groups the file names whose leader still has that start
    time: a killed server's. The Node server kept one file per server: R34 gives a data folder one
    server.
- **Rationale**: a restart or an idle stop only asks a command to end, without waiting. If the
  server then stopped within the 5 seconds, a command that ignores `SIGTERM` would outlive it. The
  start time as the machine's locale prints it differed between a shell and the server's own
  environment.
- **How it was checked**: without the stop work, the shell, the preview, and its child stayed; with
  the signal sent to the leader alone, the preview and its child stayed.
- **Where**: task 18, `crates/server/src/preview/{command,groups,runner}.rs`, and the tests
  `the_server_stops_every_preview_command_when_it_stops` and
  `a_killed_servers_preview_commands_are_stopped_by_the_next_start`.

## R83: What of the Node server's previews is not ported here

- **Decision**: two rules of [`preview-waiting.ts`](/packages/server/src/fate/preview-waiting.ts)
  wait for the sessions: starting the previews of the folders that wait for the human as the server
  starts, and starting a feature's preview as its turn ends done, once its preview folder has its
  `node_modules`. Both compile the linked stories ahead.
  - Whether a workspace or a feature has a preview, `hasPreview`, is a field of the workspace's and
    the features' records: tasks 7 and 8 read it with the core's `api::preview`.
  - The sentences a failed preview shows still name Storybook, as the Node server's do.
  - The server's crate takes `regex`, which the lockfile held already, for the warmer's scan of a
    page's scripts and a module's imports, `libc` for a group's signal, and tokio's `process` and
    `io-util`.
- **Rationale**: a turn's end is task 15's, and the built-in that listens to it is task 51's.
  Neither changes a record or a route of this task.
- **If wrong**: a story is then compiled when it is first read, so its first frame waits as long as
  the compile takes. `Runner::view` and `Runner::compiled` are what a warm-up calls.
- **Where**: tasks 15 and 51.

## R84: A type two domains use is declared once, in the protocol's `shared/`

- **Decision**: how the join of wave 6 gave each protocol type one declaration.
  - `crates/protocol/src/shared/` holds the types more than one domain declares a record or an
    action with, one file each: `RepositoryArgs`, what every record of one repository takes; the
    feature's view and status (`FeatureView` and the types under it, `ProposalView`,
    `FeatureStatus`, `SessionStatus`, `StatusReason`, `Wait`); the run options (`RunOptions`,
    `StepOptions`, `RunPick`, `ReviewerOptions`); `UndoChange` and `UndoFile`, the change an
    undoable write answers and `undo.apply` takes back; and `ChatImage`, what a chat image's upload
    answers and a typed start or a message names.
  - `WorkspaceArgs`, `GitArgs`, and `WriteQueueArgs` are `RepositoryArgs`. `RecordedChange` and
    `RecordedFile` are `UndoChange` and `UndoFile`. `features/duplicates.rs` and
    `uraeda_protocol::feature_duplicates` are gone. The session store's event and the uploads use
    the protocol's `ChatImage`.
  - Two names clashed between domains with different shapes. The action `settled.comment` is the
    type `SettledAddComment`, and `SettledComment` stays the core's view of a comment on a settled
    point. A spec's user story is `SpecStory`, beside `SpecPrinciple`, and `Story` stays the
    previews' record.
  - `catalog()` folds one function per domain, in `registry.rs`: its one function was over the
    lint's 100 lines once seven domains had added theirs.
- **Rationale**: the client's types are one file, where a name is one type, and a second declaration
  drifts the day one changes. A view keeps the core's name (R59), so the action gave way, as
  `git.commit` did (R66).
- **If wrong**: a rename changes no JSON: only the Rust and TypeScript names.
- **Where**: `crates/protocol/src/shared.rs` and `shared/`, `crates/protocol/src/registry.rs`,
  `app/store/protocol.d.ts`. Tasks 15, 20, 23, and the screens.

## R85: Every domain finds a repository through the workspace's list

- **Decision**: `records::repositories::find` (R55) is the only lookup of a repository by its name,
  and `records::repositories::path(&Shared, name) -> Result<PathBuf, Fault>` gives its main checkout
  alone, for what needs no more. The private lookups of the features, writing, git, the files'
  routes, and the previews are gone, each of which read `repositories.json` at every call.
  - One refusal for each case, whatever asks: `No repository named “<name>”` for a name the list
    lacks, and `<name> is no longer at <folder>: move it back, or remove it from the list.` for a
    folder that is gone. The files' routes answer 404 with that text, where they said
    `Folder not found: <folder>`, and git's records no longer say `no repository is named`.
  - A git record of a repository whose folder is gone is refused, as every other: git's lookup did
    not look.
  - `item.settings` reads the list again once the core wrote the name, so the feature's record and
    the workspace show it.
  - The fetcher's round reads `repositories::all`, without the ones whose folder is gone.
- **Rationale**: the list is kept as last read, so a record costs one look at `.git`, and a name
  means the same repository to every domain.
- **Where**: `crates/server/src/records/workspace/repositories.rs`, and its callers in
  `records/{features,writing,git}/`, `files/repository.rs`, and `preview/checkout.rs`. The tests
  `a_repository_that_is_not_listed_or_is_gone_serves_no_file` and
  `a_repository_the_list_lacks_is_refused` expect the one text.

## R86: The records' domains are plain `mod` lines and a list, so `cargo fmt` formats them

- **Decision**: `records/mod.rs` declares each domain with a plain `mod <domain>;` and names its
  `register` in the list `DOMAINS`, in the order they register. The macro `domains! { }`, which did
  both from one line, is gone.
- **Rationale**: rustfmt does not expand a macro, so it never found the files of a module declared
  inside one, and `vp check` passed whatever their formatting. Two lines per domain is the price: a
  domain left out of `DOMAINS` fails the lint, since nothing calls its `register`.
- **Where**: `crates/server/src/records/mod.rs`. Tasks 15, 17, and 20, which add a domain.

## R87: What every records domain needs of another has one home in `records/`

- **Decision**: the helpers the domains of wave 6 each wrote for themselves are one function each.
  - `records::views::sent` turns a view of the core into the protocol's type, and `word` gives a
    word of the protocol as JSON writes it (R53). The features' `views.rs` keeps only `found` and
    `missing`, which answer `null` for what is not there.
  - `records::workspace::status::of` is a feature's status, for the workspace and for the record
    `Feature`: the one function the sessions (task 15) change.
  - `records::settings::options::{sent, given}` turn run options between the core's types and the
    protocol's, for the settings and for a feature's own. A feature's own are read over
    `records::settings::current`, the settings in force, where they read the file again.
  - `records::writing::undo::sent` is the change an undoable write answers, as an `UndoChange`:
    writing's, the lists', and the uploads' answers go through it.
  - `live::locked` takes a lock whoever panicked while holding it: `pub(crate)`, for every domain.
- **Rationale**: one home per rule. A status decided twice is the first thing the sessions would
  have changed in one place only.
- **Where**: `crates/server/src/records/{views.rs,workspace/status.rs,writing/undo.rs}`,
  `records/workspace/settings/options.rs`, `live/mod.rs`. Tasks 15, 17, and 20.

## R88: The server's tests share one fixture repository and one client of `/live`

- **Decision**: `crates/server/tests/support/` holds what the domains' tests each wrote.
  - `support::fixture(path)` and `fixture_text(path)` give a path and a text of `fixtures/`, and
    `fixture_repo(name)` the git repository built from `fixtures/repo/`: `main/` on `main`, then
    each folder of `branches/` on a branch of its name. Files are copied as bytes.
  - `support::read(&server, record, args)` reads a record once, `call(&server, action, input)` calls
    an action, and `Held::open` holds one record on a client of its own, with `until`.
  - `support::Live` is one client that holds several records and makes several calls: `watch`,
    `until`, `read`, `send`, `answer`, `call`, `try_call`, `refused`. It checks that each change is
    numbered one more than the last. Writing's `Fixture`, git's `Page`, and the previews' `Records`
    are thin wrappers of it, for their repository's name.
  - A wait that never ends says what it waited for.
- **Task 9's finding on hooks**: its fixture set `core.hooksPath` to an absolute path, noting that
  `TestRepo`'s relative `.git/hooks` points at nothing in a worktree. The core already resolves a
  relative path from the main checkout when it commits in a worktree (`Git::hooks_override`), and
  `TestRepo`'s relative path is what tests that rule. Writing's tests pass without the override,
  their hook's log included, so the override is gone and `TestRepo` stays as it is.
- **Where**: `crates/server/tests/support/{fixture,live}.rs`. Tasks 15, 17, and 20.

## R89: Every write goes through the write queue, which tells every domain's records

- **Decision**: `records::writing::write` (R64) is the one way a handler writes to a repository. The
  features' lock per repository is gone, and the uploads' writes take the queue's turn too.
  - **What a write names**: `Write::saving()` commits nothing. `Write::of_feature(folder)` and
    `Write::of_lists()` commit, and wait for the queued commits of those files; `.and_feature` adds
    a feature's files to the lists', as a drop and a repair of links write both. `priorities.commit`
    and `feature.drop` take `write`, the client's name for the commit, as writing's actions do:
    `WriteName` moved to the protocol's `shared/`.
  - **A committing action answers once its files are written**, and its commit lands behind it, with
    the hooks, in the queue's record: `priorities.commit` and `feature.drop` did both within their
    call. A test that reads git after one waits for the queue to be idle.
  - **What is told**: after each write, and again once each commit it queued landed or was refused,
    the queue calls `records::written(&Bus, repository)`, which calls each domain's `written`, one
    line each in the list `WRITTEN` of `records/mod.rs`. A domain says there that every record of
    that repository it serves changed, and the engine reads again the ones somebody holds. So an
    action says nothing more on the bus for what it wrote: the features' `changed::life`, `lists`,
    and `proposal_file` calls after a write are gone.
  - **Why every record, and not the ones the write names**: a save names no file the queue could map
    to a record, a buffer's or an undo's least of all, and a record left out is a page that shows
    the old value until the watcher's next burst. The engine reads only what is held, at most once
    per 16 ms, and the watcher's burst that follows reads the same records for the same change. The
    cost is the reads of the records held of that one repository.
  - `Bus::changed_where::<R>(|args| ..)` says it of the records of a name whose arguments match, as
    each of one repository: `changed_all` crossed repositories.
- **How it was checked**: `a_write_and_its_landing_reach_the_records_of_every_domain` failed at its
  first wait, a save of writing never reaching the features' `WorkflowFile`; and
  `the_priorities_commit_lands_in_the_write_queue_under_its_name` never got its answer while the
  hook was held.
- **If wrong**: a domain whose records are costly to read says less in its `written`.
- **Where**: `crates/server/src/records/{mod.rs,writing/queue.rs,writing/queue/repository.rs}`,
  `records/features/{lists,moves,feature,starts,changed}.rs`, `files/attach.rs`, `live/bus.rs`.
  Tasks 15, 17, and 20.

## R90: A write of its own lands on the queue's thread, as git's writes do

- **Decision**: what R65 left of the Node queue for git, `add`, `enqueue`, `background`, and
  `landed`, is `records::writing::land`.
  - **The entry point**: `land(&Shared, repository, Write, land) -> Result<Queued<T>, Fault>`, where
    `land` is `FnOnce(&Path, &Landing) -> Result<T, Fault> + Send + 'static`. It is queued behind
    the writes queued before it, and runs on the repository's landing thread, in the writes' turn,
    so no committing call is between its write and the take of its commits. `Landing::printed(line)`
    adds a line to the write's output in the record. The commits `land` defers are queued behind it,
    under its name.
  - **Waiting for it**: `Queued::landed()` waits, and a refusal stays in the record until dismissed,
    and is the answer too. `Queued::answered()` is for a write whose refusal is its call's alone: it
    leaves the record. Dropping the `Queued` leaves the write to land.
  - **Told before answered**: the record and every domain's `written` are told before the waiter is
    answered, so a read made after an action's `result` finds what the write changed. Answered
    first, three of git's tests read the page as it was.
  - **Its name**: `Write::of_main()` is a write of the main checkout's git state, which waits for
    the lists' queued commits, and they for it; `.or_named(label, href)` names a write the client
    gave no `write` for; `Write::unseen()` lands outside the record, as the server's own fetch.
  - **Git**: every action `git.*` takes `write`, and lands as a write named by it, or by the page's
    own name, `Pulling`, `Committing`, `Discarding <path>`, on `/git`. It is refused while an agent
    works in a checkout it writes, as it is queued and again as it lands. It answers once it landed.
    `git.saveConflict` answers a stale save alone, out of the record. A person's fetch is a write
    named `Fetching`; the page's own and the fetcher's rounds land unseen.
  - A landing that panics is refused as `failed`, and the thread lands the next one.
- **How it was checked**: `a_git_write_lands_in_the_write_queue_under_its_name_with_its_output`
  timed out before, the queue never showing the commit. It asserts the name while the hook runs, the
  answer once landed, and a refused commit left in the record with the hook's output.
- **If wrong**: a write of the page waits for the repository's queued commits to land before it
  runs, hooks included: a stage behind a slow commit waits for it.
- **Where**: `crates/server/src/records/writing/{queue.rs,queue/repository.rs}`,
  `records/git/{writes,fetcher}.rs`, `crates/protocol/src/git.rs`. Tasks 15 and 46.

## R91: A start is a write of the queue, with its steps, and a feature's answers once planned

- **Decision**: the starts run as the Node server's did, in place of R60's stand-in.
  - **A feature's start answers once planned.** `feature.start` and `feature.startText` plan the
    start, queue it, and answer `StartPlan`. The start lands behind the answer, as a write of the
    queue named `Starting the feature <title>`, or by the client's `write`. A refusal stays in the
    record until dismissed, with the page it opens: none for a proposal file, and
    `/new?kind=feature` for a typed one, whose composer still holds the text. A typed feature's run
    options, kept for its planned folder, are dropped again when its start is refused.
  - **One plan at a time for a repository**, and a start holds its folder and its slug while it is
    in the queue: a second start planned for either is refused in the core's own words for a taken
    slug, before anything is queued.
  - **A change's start answers once it landed.** `change.start`, `change.startProposal`, and
    `change.fromNote` queue the start as `Starting a change`, and wait for it: they answer its
    folder, which only the start knows. A refusal is the call's alone, and leaves the record.
    `change.fromNote` then takes the note out of the inbox, in a commit of the lists' queue.
  - **Its steps** are in its write, `QueuedWrite.steps`:
    `Commit the proposal on <default branch>, running your hooks`, then
    `Make the branch <branch> and its worktree`, each a `StartStep` with its `state`, `waiting`,
    `running`, `done`, or `refused`, and the commit's with what the hooks printed, or the refusal.
    The Node server's third step, the agent's, comes with the first run (task 15).
  - **A step's time**: `startedAt`, in milliseconds since 1970, while it runs, and `seconds` once it
    ended. The Node server counted a running step's seconds itself, and sent the record every
    second. A client counts from `startedAt`, so a start that runs sends nothing but its steps.
  - **The lists go free at the branch**: the writes of the lists wait for a start until its commit
    landed, and its feature's until it ended.
  - **`feature.promote`** lands as a write of its own too, named
    `Making the change <folder> a feature` or by its `write`, and answers once it landed. Its
    refusal is the call's alone.
- **Rationale**: R60 named the cost of answering once landed, a caller blocked for as long as the
  repository's hooks run, and why it could not answer earlier, no record to say a late refusal in.
  The queue's record is that place.
- **How it was checked**: `a_start_answers_once_planned_and_lands_in_the_queue_with_its_steps` got
  no answer while a commit's hooks ran. It asserts the plan answered behind a running commit, the
  start's two steps, a second start of the folder refused, the feature once it landed, and a start a
  hook refused left in the record with its refused step, its output, and no feature.
  `starting_a_proposal_file_makes_its_feature_on_a_branch_of_its_own` and the typed feature's test
  now wait for the queue to be idle before they read git.
- **If wrong**: a client that wants a start's outcome in the call's answer waits for its write to
  leave the queue, or to be refused there.
- **Where**: `crates/server/src/records/features/{starts.rs,starts/queued.rs,starts/steps.rs}`,
  `records/features/feature.rs`, `crates/protocol/src/{writing.rs,features/starts.rs}`. Tasks 15,
  38, and 50.

## R92: A connection's calls reach the write queue in the order it sent them

- **Decision**: two rules, one in the engine and one in the queue.
  - **In the engine**, a connection's calls start one after another: each once the call before it
    took its place in what orders it, or ended. From there they run at the same time, as before. A
    handler's thread says its call is placed with `live::placed()`, which the write queue calls as a
    write takes its ticket and as a write of its own is queued. An action that never writes lets the
    next call start as it ends. Reads, and other connections, wait for nothing: a `sub` is no call,
    and the order is a connection's own.
  - **In the queue**, the turn goes by ticket, taken as a write arrives: among the writes that wait,
    the one with the first ticket whose keys have no commit to land takes the turn. A write that
    waits for a commit of its keys no longer takes a new ticket once the commit landed, so two
    commits of one file sent back to back run in the order sent too. Meanwhile the turn goes to the
    writes behind it that wait for none, as before.
- **Rationale**: the order is lost between the connection's task, which reads the calls in order,
  and each call's thread reaching the queue. Closing that gap in the engine fixes it for every
  action at once, and keeps the queue free of any notion of a connection. A ticket handed out by the
  engine as it reads a call, R64's own suggestion, would have made the engine know which calls
  write, and to which repository.
- **How it was checked**: `two_saves_sent_back_to_back_land_in_the_order_sent` sends two saves over
  the same hash, fifty times, with no wait between them: the first must land and the second
  conflict. The first save's input is the longer one to read, so without the order the second
  reaches the queue first: the test failed at its first round, `conflict` for the first save. With
  `before.placed().await` taken out of the engine, it fails the same way.
- **If wrong**: a call that takes long before it writes, or that never writes, holds its
  connection's next calls until it ends. An action that waits on something slow without writing
  calls `live::placed()` first. Two writes of one connection of which the first waits for a queued
  commit of its files, and the second for none, still run second first: a save does not wait for
  another file's hooks.
- **Where**: `crates/server/src/live/{order,subscription}.rs`,
  `crates/server/src/records/writing/queue/repository.rs`. Tasks 15, 17, and 23.

## R93: The one watcher calls every domain, and tells who starts or stops with a repository

- **Decision**: `records/watch.rs` holds four lists, one line per domain in each.
  - `FILES_CHANGED`, of shape `fn(&Shared, &str, &Changes)`: the workspace, the features, writing,
    git, and the previews, after each burst of changes in a repository. The shape takes the server's
    shared state, where it took the bus: the previews read their own state there.
  - `CONFIG_CHANGED`, `fn(&Shared)`: the workspace, then the features, whose `Feature` holds its run
    options merged over the settings'.
  - `REPOSITORY_JOINED`, `fn(&Shared, &str)`: git, which fetches a repository that joins the list
    once the server runs, or whose folder came back, before the next round. The repositories listed
    as the server starts join nothing: the fetcher's first round is theirs.
  - `REPOSITORY_LEFT`, `fn(&Shared, &str)`: the previews, which stop the commands of a repository
    that left the list, or whose folder went.
  - A change of the priorities or of the inbox reads again the `ProposalFile` records of the
    repository: a proposal file is the priorities', and a note file the inbox's.
  - A write the record never shows, as the fetch of a repository that joins, takes no number of the
    writes it shows: `write_queue_answers_its_shape` read `write-2` for the first write.
- **How it was checked**: four tests, each failing before.
  `a_file_written_outside_the_server_reaches_a_record_of_each_domain` writes `INBOX.md` on disk and
  waits for the features' `Inbox`, writing's `Buffer`, and git's `GitPage`: it waited for the inbox
  in vain. `a_preview_follows_its_reads_and_its_checkouts_code` no longer calls
  `preview::files_changed` itself, and waited for the restart in vain.
  `a_repository_that_leaves_the_list_stops_its_previews` found the command running, and
  `a_repository_that_joins_the_list_is_fetched` waited for the commits to pull.
- **Left as it was**: a repository that leaves the list keeps its write queue open until the server
  stops (R65).
- **Where**: `crates/server/src/records/watch.rs`, each domain's `files_changed`,
  `records/git/fetcher.rs`, `records/previews.rs`. Tasks 15, 17, and 20, which add their line.

## R94: A mockup's path carries the frame secret, and every other answer refuses a frame

- **Decision**: what R77 and R79 left to the join.
  - `GET /r/<name>/mockups/<secret>/<path>` serves a file of a `mockups/` folder, sandboxed, when
    `<secret>` is the current frame secret, compared in constant time. The route is `Open::Frame` in
    `sign_in::OPEN`: a sandboxed frame, which sends no cookie and the origin `null`, reads it with
    the secret, and the guard answers it 404 with another.
  - Any other mockup path reaches the handler only signed in, and is sent with 303 to the same path
    under the current secret, its query kept. The secret alone is 404.
  - `http::router` has a layer, the outermost, which sets `X-Frame-Options: SAMEORIGIN` on every
    answer whose path is not a repository's mockups or previews: a refusal of the guard and a path
    no route serves included.
- **Rationale**: a sandboxed frame has an opaque origin, so `SAMEORIGIN` would refuse Uraeda's own
  frames of a mockup or a preview: the Node server left the header out there, and so does this one,
  by the same paths.
- **How it was checked**: `a_mockup_is_served_sandboxed_to_its_frame_and_only_from_a_mockups_folder`
  was served the page with no secret, where it expects the 303; it reads the page as a frame does,
  with no cookie, and is refused with another secret. And
  `every_answer_but_a_mockups_and_a_previews_refuses_another_sites_frame` walks `Server::routes()`:
  no answer had the header.
- **Where**: `crates/server/src/files/{mod,raw}.rs`, `sign_in/check.rs`, `http.rs`,
  `contracts/protocol.md`. Tasks 41 and 49, which frame them.

## R95: The chat images have one store, which the sessions' store answers for

- **Decision**: what the files, the features, and the session store each held of a chat image.
  - `Store::holds_image(id)` says whether a message of any session holds an image, taken back or
    not: one query over the `message` events' `images`. `DELETE /r/<name>/chat-images/<id>` asks it,
    and answers 400 with `refused: <id> is in a sent message.` An image the store cannot answer for
    stays, and the answer is 500.
  - A typed start, `feature.startText` and `change.start`, reads its images' bytes from the chat
    images' store, each once, with `ChatImages::read`. An image whose file is gone refuses the start
    before anything is planned, with the Node server's text, `This image is gone: add it again.`
  - The folder's name and what an image's id is are `files::chat_images::FOLDER` and `is_id`: the
    importer copies with them, in place of its own.
  - The upload's answer for an undo is the undo's own `UndoChange` (R87), and a chat image is the
    protocol's `ChatImage` (R84).
- **How it was checked**: `a_chat_image_a_sent_message_holds_is_never_deleted` got 204 for an image
  a message of the store held, and `a_typed_start_takes_the_images_uploaded_for_it` was refused,
  `A start cannot take images yet`.
- **Left to task 15**: the cleanup of the images no message holds, a day after they were written,
  and the size limits a message's images are checked against.
- **Where**: `crates/server/src/runner/log.rs`, `files/{images,chat_images}.rs`,
  `records/features/starts.rs`, `runner/import.rs`. Task 15.

## R96: The core's git runs in the server's environment, the config folder's `.env` included

- **Decision**: `Environment::added()` gives the variables the config folder's `.env` adds to the
  environment the server started in, the ones that one left unset or empty. The server gives them to
  the core as it starts, `uraeda_core::git::set_environment(added)`, and takes them back as it
  stops. The core adds them to the environment of every `git` and `gh` it starts, in
  `git/process.rs`, the one place it starts a process, and so to the hooks git runs.
- **How the Node server did it**: it started no process in an environment of its own making. Git ran
  inside its process, through the binding, and the agents and the previews were its children: all of
  them had the server's whole environment. Here the server's environment is a value (R35), which
  only the processes started with `environment().command(..)` got, so a hook of a commit the server
  landed lacked what an agent in the same repository had.
- **Rationale**: R35 keeps the server from writing its own process's environment, which is unsafe
  once it has threads. What the core adds is only what `.env` adds: for `ura serve`, the process's
  environment and those variables are the server's environment, whole. A test's server starts in an
  environment of `PATH` alone, and its git keeps the test process's, with what turns the machine's
  git configuration off.
- **How it was checked**: `a_hook_of_a_commit_the_server_lands_gets_the_config_folders_secrets`: a
  pre-commit hook writes two variables to a file, and the server lands a commit of the priorities.
  The hook saw neither before; it sees the config folder's, and not the project's `.env`.
- **If wrong**: the variables are the process's, not a server's: two servers in one process, as
  tests run without `nextest` would have, share the last one's. `ura` never sets them.
- **Where**: `crates/core/src/git/process.rs`, `crates/server/src/{env,start}.rs`. Tasks 13 to 15.

## R97: A runtime is asked on a blocking thread, and its process is told from anywhere

- **Decision**: `runtimes::Runtime` and `runtimes::AgentProcess` are the adapter of
  [`extension-api.ts`](/packages/server/src/extension-api.ts), method for method, with one rule for
  where each runs.
  - **A `Runtime`'s methods are plain functions, called on a blocking thread**, a handler's or
    `spawn_blocking`'s: `open`, `has_session`, `allow_rule`, `version`, `models`, and
    `review_message`. They may read the disk, start a process, or wait for another thread, as a
    runtime in an extension's VM does for its answer. One that waits bounds its own wait: `version`
    within 5 seconds, `models` within 10, a VM's call within 10. `live::wait(future)` awaits from
    one, and tokio is there.
  - **An `AgentProcess`'s methods return at once, from any thread or task**, and never fail: `send`,
    `interrupt`, `kill`, `take_back`, `set_effort`, and `close` write to the agent, or tell the task
    or the VM that does. On a process that exited each does nothing. What the agent made of it comes
    back as events.
  - **`open` never fails.** A command that is missing, or a session the agent does not start, is the
    process's `exit`, with `missing`, or an `init` with its `problem`.
  - **Beside the plan's list**: `kind` and `icon`, which the adapter has and the record of a runtime
    shows; `review_message(&ReviewAsk) -> Option<ReviewMessage>`, the agent's own review; `models`
    answers `Ok(None)` for a runtime that lists none; `set_effort` answers whether the process took
    it, `false` for a runtime that is reopened instead. `name`, `kind`, and `icon` give a `String`.
  - **The one error type** is `RuntimeError`: `Taken(name)` from the registry, and `Failed(words)`
    from `models`.
  - **What crosses is the adapter's JSON**: `Options`, `Outgoing`, and `ReviewAsk` are written as
    the adapter names them (`nativeId`, `tools` left out, `"none"`, or `{ url, token }`), and
    `Capabilities`, `ModelList`, and `ReviewMessage` are read from it. `Signal::name()` is `SIGINT`,
    `SIGTERM`, or `SIGKILL`. `Tools` prints without its token.
- **Rationale**: R46 made handlers plain functions because nearly everything they call blocks, and
  the same holds here: Claude Code's `has_session` reads a folder, its `open` makes folders and
  links, and a VM's answer is a wait on its thread. The sessions already write the store from a
  blocking thread. A process's methods are the Node adapter's, which returned nothing and waited for
  nothing: the agent's protocol is the only place an answer comes from.
- **Alternatives considered**: futures for everything a VM answers: callable from a task, but a
  blocking read inside one is the trap R46 names, and three implementers would box each answer.
- **If wrong**: a `Runtime` method called from a task blocks one of the server's threads, for up to
  its own bound. A VM's proxy that waits with tokio's `blocking_recv` panics there, which the first
  test shows.
- **Where**: task 12, `crates/server/src/runtimes/{mod,options}.rs`. Tasks 13, 14, 15, and 17.

## R98: A process's events are one stream with no limit, ended by one `exit`

- **Decision**: `runtimes::events()` gives an `Emitter` and an `Events`.
  - A runtime writes with `Emitter::send(event) -> bool`, from the task that reads its agent's
    output or from a VM's thread. It never waits. An `exit` is the last event: it closes the stream,
    and what is sent after it is dropped.
  - The one reader takes the stream once, `AgentProcess::events(&mut self)`, and reads with
    `next().await` in a task or `blocking_next()` on a blocking thread.
  - **The stream always ends with exactly one `exit`.** When every `Emitter` is gone without one, as
    for a VM that was stopped, the reader gets an `exit` with no code, then nothing.
  - **No back-pressure.** The stream has no limit: the Node runtimes read stdout as it comes
    "whether or not the events are", since Claude Code loses its last lines when read slowly.
- **Rationale**: a reader that must handle "ended without an exit" beside "exited" would handle it
  three times, once per implementer's idea of a silent end. An event is small, and the reader writes
  one SQLite row per event, faster than any agent prints.
- **If wrong**: a reader that stops reading lets a process's events pile up in memory until it is
  closed. A limit would go in `events()`, the one place the channel is made.
- **Where**: task 12, `crates/server/src/runtimes/events.rs`, and the test
  `a_stream_ends_with_one_exit_whatever_its_runtime_did`. Tasks 13, 14, 15, and 17.

## R99: A blocked action is a denial of its turn's result: no agent waits on a request

- **Decision**: the contract has no permission request. The brief's "a permission request that waits
  for its answer", and task 13's test of that name, are this flow, which the Node runner has and the
  port keeps:
  - An agent runs with the least permission that lets a step finish, and never asks while it runs:
    Claude Code in its `auto` mode, Codex with its own reviewer. An action its permissions block is
    skipped, and named in the `denials` of the turn's `result`.
  - The denial waits in the transcript for the human. Their yes is `Runtime::allow_rule(&denial)`,
    the narrowest rule for that action, none when no rule allows it alone; then a process opened
    with the rule in `Options::allowed`, for that process only; then a message that asks again.
  - `Capabilities::approvals` stays, `false` for every built-in, as in the Node adapter.
  - The fake plays it with a `try` step: blocked, and a denial of the result, unless the process was
    opened with its rule.
- **Rationale**: the plan asks for a port. `AgentEvent` has no request, the React UI draws none, and
  Codex's requests to its client are refused at once. A request an agent waits on is a feature of
  its own: a new event, an answer on `AgentProcess`, and a screen.
- **If wrong**: an agent that asks is added as an event `permission`, a method
  `AgentProcess::answer(id, allow)`, and `approvals: true`, without changing what exists.
- **Where**: task 12, `crates/server/src/runtimes/mod.rs`, and the test
  `a_blocked_action_is_a_denial_of_its_result_until_its_rule_is_allowed`. Tasks 13 and 15.

## R100: An agent's process is a `runtimes::Child`, and the group's rule has one home

- **Decision**: `crates/server/src/process.rs` holds what a command the server runs shares: `Signal`
  (`Interrupt`, `Terminate`, `Kill`), `lead_group(&mut Command)`, and
  `signal_group(leader, signal)`. The previews use it, where they had their own.
  - `runtimes::Child::spawn(&Shared, Spawn { program, args, cwd, env })` starts an agent's process:
    `shared.environment().command(program)` with its own variables, its three streams piped, leading
    a group of its own. It never fails: a command that cannot start is a `Child` with no output
    whose exit says why, `missing` for a command not found, and
    `The session's directory is gone: <cwd>` for a folder that is gone.
  - `lines()` gives stdout's lines, read as they come, blank ones left out; `write(&Value)` one JSON
    line to stdin, without waiting; `end_input()` closes stdin; `signal(Signal)` reaches the whole
    group; `exited().await` gives the `exit` event once both outputs closed, with the last 20 lines
    of stderr; `end_short()` ends a short process done with, as one that lists models; `leader()` is
    the group's id.
  - **The group ends with its leader.** As the leader exits, its group is killed, so a command the
    agent left running never holds its output open, as the previews do (R82). The Node runner waited
    for the output to close by itself.
  - **The server stops them.** `runtimes::mount` registers the stop work `agents`: every process
    still running is sent `SIGTERM`, then `SIGKILL` 5 seconds later, and waited for. It runs after
    the sessions' own stop work, registered later (task 15), which closes each process its way
    first. A stopping server starts no process: its `Child` exits with `The server is stopping.`
  - **No record of the groups in a file**, as the previews keep: a killed server's agents end by
    themselves when their stdin closes.
- **Rationale**: tasks 13 and 14 both port `child.ts`, at the same time. The stack decision says the
  server MUST stop the commands it runs: one helper keeps that from being two.
- **How it was checked**: with the signal sent to the leader alone, three tests fail, each finding
  the `sleep` the shell started; without the stop work,
  `the_server_stops_every_agent_process_when_it_stops` does.
- **If wrong**: an agent that outlives its stdin's end after a server was killed is found by
  recording its group as `preview/groups.rs` does.
- **Where**: task 12, `crates/server/src/process.rs`, `runtimes/child.rs`, `preview/command.rs`, and
  `crates/server/tests/runtimes/child.rs`. Tasks 13 and 14.

## R101: The registry is `Runtimes`, and a runtime is on where its extension is

- **Decision**: `runtimes::mount`, in `DOMAINS` after the store, provides `Runtimes`, a handle cheap
  to clone: `shared.get::<Runtimes>()`.
  - `runtimes::register(&shared, name, Arc<dyn Runtime>) -> Result<Registered, RuntimeError>`
    registers under the extension's name, refused as `Taken` for a name in use.
    `Registered::remove()` takes it away; dropping the `Registered` leaves it, as a built-in's for
    the server's life.
  - It reads: `get(name)`, `names()` in registration order, `status(name)`, `models(name)`.
    `check()` asks every runtime's version, and `refresh_models(&[names])` their models, at most
    once a minute each and given up after 15 seconds: both wait, so they are called on a blocking
    thread. A registration asks its models at once, in the background. A name removed keeps its
    status for the next runtime of that name. `on_change(listener)` and `changed()` tell who shows
    them.
  - **Where a runtime is on is the core's rule**: `is_on(name, repository)`, `on_in(repository)`,
    and `title(name)` read the config folder with `uraeda_core::extensions`, by the repository's
    name in the list. A built-in turned off is off without any code of its runtime: `claude`,
    `codex`, and `fake` are built-in extensions already. A name that is no extension's is on
    everywhere.
  - **Not here**: the skill folders of the extensions on in a repository, `Options::skills`, which
    depend on which extensions loaded (task 17); and the refusals of a session whose runtime is off
    or unavailable, which are the sessions' words (task 15).
  - `Capabilities`, `ModelList`, `ModelDefaults`, `AgentModel`, and `ModelEffort` are declared in
    the protocol's `shared/runtime.rs`, with the adapter's JSON: the record of a runtime sends them
    as they are (task 15). No record uses them yet, so the client's types are unchanged.
- **Rationale**: the Node registry was given three functions by the extensions' loader. The core
  already answers where an extension is on, so the registry needs no one to tell it, and tasks 13,
  14, and 17 only register.
- **If wrong**: `is_on` reads `config.toml` at each call. A cache goes behind `Runtimes`, cleared by
  the watcher's `CONFIG_CHANGED`.
- **Where**: task 12, `crates/server/src/runtimes/registry.rs`,
  `crates/protocol/src/shared/runtime.rs`. Tasks 13, 14, 15, and 17.

## R102: The fake plays JSON scripts of events, waits, and blocked actions

- **Decision**: `runtimes::fake::Fake` is the Node server's `FakeAdapter`, with its script format.
  - **A script is a JSON array**, and a step is an event as a runtime sends it, the Node fake's own
    format; `{ "wait": 400 }`, milliseconds on tokio's clock, where the Node fake took a function
    that waited; or `{ "try": { "id", "tool", "input" } }` (R99). In Rust it is a
    `Script(Vec<Step>)`, read with `serde_json::from_value` or `Script::parse`, and `Step::run` adds
    what JSON cannot say: work of the test's own in the process's directory.
  - `Script::reply(text, over)` is a reply streamed word by word over a time, then whole: the
    sandbox's canned reply, and a reply of 20,000 pieces.
  - **A message plays the next scripted turn**, `fake.script(..)`, else the turn `fake.fallback(..)`
    gives for it, else nothing: the test then says each event with `fake.emit(event)`. A turn is the
    message's `accepted`, the steps, then a successful `result` unless a step ends the turn with a
    `result` or an `exit`.
  - **It reacts as the Node fake does.** An interrupt drops the steps not played and ends the turn
    with an interrupted `result`, keeping the process. A close plays what was written, without its
    waits, then exits with code 0. A kill drops everything and exits with 130, 143, or 137.
    `fake.set(|fake| ..)` makes it ignore each, lists other models, or uninstalls it.
  - **Where it differs**: a take-back cancels a message whose turn has not begun, and sends its
    `cancelled`, where the Node fake only recorded it; a process nobody holds is killed; its name is
    `Fake agent`, where the Node fake took Claude Code's; `reports_runs_on` is the sandbox agent's
    `runsOn`, as a switch.
  - `fake.opens()`, `sent()`, `taken_back()`, `interrupts()`, `closes()`, `kills()`, `efforts()`,
    `model_asks()`, and `running()` say what it saw.
- **Rationale**: task 20's sandbox reuses the Node samples, which are arrays of events. A wait as
  data plays on tokio's paused clock, so no test sleeps.
- **How it was checked**: with an interrupt that drops nothing,
  `the_fake_runtime_plays_its_script_and_stops_when_told` and
  `an_interrupted_process_plays_its_next_message` fail.
- **Where**: task 12, `crates/server/src/runtimes/fake.rs` and `fake/`, and
  `crates/server/tests/runtimes.rs`. Tasks 15, 17, and 20.

## R103: Claude Code's streams are recorded, and the Node runner writes what they become

- **Decision**: `fixtures/runtimes/claude/` holds what the test
  `a_recorded_stream_becomes_the_same_events_as_the_node_runner_made` compares, event by event.
  - **Six streams recorded from Claude Code 2.1.322** by `record.ts`, each one short message run
    with the arguments the Node server gives a session, on Sonnet, in a temporary folder: a reply in
    pieces (`reply`), a tool call and its result (`tool`), a thought (`thought`), a blocked write
    (`denied`), a sub-agent with a tool call of its own (`sub-agent`), and a result that is an error
    (`error`). A stream is scrubbed as it is written: the session's folder reads `/session-dir`, the
    home folder `/home/me`, and the `init` line keeps only the fields a runtime reads.
  - **The Node tests' own recorded lines are reused** for what no run shows on demand, a usage
    limit, a wakeup, a retry: [`fixtures/claude/`](/fixtures/claude/), where they stay, as the Node
    tests read them.
  - **The cases of the Node parser's tests are lines written by hand**, in `written/`: about 200
    lines, for a sub-agent's text, each tool's target, the results, the plugins, the background
    tasks, the limits' words, and the crons.
  - **The events of each are written by `node-events.ts`**, which drives the Node parser,
    `parseLine`, over the lines, and writes no event by hand: `<name>.events.jsonl`, one event a
    line, beside a recorded stream, in `lines/` for the Node tests' lines, and in `written/`.
  - **The clock and the zone are fixed**: 2026-11-10 at 09:00 UTC, when a test's server starts, in
    `Asia/Tokyo`. A stream named `<name>.at-<seconds>.jsonl` is read at that instant instead, as the
    three that cross a change of New York's clocks.
  - The Rust test plays each stream through a stand-in `claude`, in a session's folder of its own,
    which stands for `/session-dir` in the stream and in its events.
- **Rationale**: a port is checked against what it ports. An expectation typed again in Rust would
  be a second reading of the Node code, and the Node tests' inline cases cost nothing more as data.
  A usage limit cannot be asked for, and those lines were recorded when one came.
- **If wrong**: a stream goes stale with a new Claude Code. `record.ts`, then `node-events.ts`,
  write them again, while the Node parser exists; after task 61 the events are kept as they are.
- **Where**: task 13, `fixtures/runtimes/claude/`, `crates/server/tests/claude.rs`.

## R104: The runtime's events are the Node runner's, and it differs only where Node could not go on

- **Decision**: the 330 events of the recorded and written streams are the Node runner's. What the
  Rust runtime does otherwise is outside them:
  - **Half a character is read as U+FFFD.** Claude Code cuts a long output between the two halves of
    a character, and prints the half as an escape. A JavaScript text holds it; a Rust one does not,
    and the line would be dropped, leaving its tool call running for ever.
  - **A process's events end with its exit.** The Node runner read the output until it closed by
    itself. The reader here also ends once the process exited and its group was killed (R100), with
    what it printed read, so a command that escaped the group cannot hold a session open.
  - **A path that is no text gives no target.** In a tool's input still being written, the Node
    parser threw on such a path, and read nothing more of that process.
  - **The models of a result are named in the order the line writes them**, read from the line's
    text, not from the parsed object, whose order depends on how serde_json is built (R19).
  - **The server's zone is `TZ` of its environment, else the machine's**, and a zone a limit's text
    names is found in the machine's zone database, through `jiff`. Node asked `Intl`.
  - **`set_effort` answers `false` on a process that exited**, and `true` otherwise: the process
    changes its effort itself.
- **Rationale**: each is a case where the Node runner stopped, hung, or relied on JavaScript's own
  texts. None changes an event of a stream Claude Code prints whole.
- **Where**: task 13, `crates/server/src/runtimes/claude/{json,process,stream,results,time}.rs`, and
  the test `a_line_cut_inside_a_character_is_read_with_the_half_replaced`.

## R105: The skill and the extensions' documentation are written in the data folder, from the binary

- **Decision**: Claude Code is given folders the server writes itself, as the first process of each
  start opens:
  - `<data folder>/plugin/`, the plugin `uraeda`: `.claude-plugin/plugin.json`, and `skills/uraeda/`
    from the skill the binary holds, `uraeda_core::embedded::SKILL`, written anew, so a file a newer
    skill dropped is gone.
  - `<data folder>/docs/extensions.md`, the documentation of the extension API as it was when the
    server was built, which the instructions name.
  - `<data folder>/extension-plugins/ext-<name>/`, a plugin for each extension of `Options::skills`,
    as the Node server made them, and `<data folder>/images/` and `<config folder>/extensions/`,
    which `--add-dir` refuses when missing.
  - **The instructions appended to the system prompt are the Node server's words**, with the section
    on extensions always: they still say "the web UI".
  - **The command is the `command` setting of the built-in extension `claude`**, read as each
    process starts, where the Node server read it as the extension loaded.
- **Rationale**: the distribution decision makes `ura` one binary that needs nothing beside it, so
  there is no package folder to point `--plugin-dir` at, as the Node server did.
- **If wrong**: Codex's runtime needs the same plugin and the same instructions (task 14). They are
  in `runtimes/claude/{folders,instructions}.rs` until one home is made for both, at the join. The
  instructions' words follow the app, with the screens of the sessions.
- **Where**: task 13, `crates/server/src/runtimes/claude/{folders,instructions,args}.rs`. Tasks 14,
  15, and 17.

## R106: The built-in registers as the server mounts, and no test finds the real `claude`

- **Decision**: `runtimes::mount` registers Claude Code's runtime under `claude`, its built-in
  extension's name, for as long as the server runs. It is reached through the registry,
  `shared.get::<Runtimes>().get("claude")`, and nothing else constructs it: the plan's
  `runtimes::claude()` is not public.
  - **The owner turns it off by turning its extension off**: `Runtimes::is_on` and `on_in` then
    leave it out (R101). It stays registered, and runs nothing by itself, but for its models.
  - **A registration asks its models at once** (R101), which starts `claude`. So every server of the
    tests has a folder of stand-ins first on its `PATH`, `crates/server/tests/support/no-agents/`,
    whose `claude` fails at once, as a command that is not installed: `support::setup()` and
    `crates/cli/tests/serve.rs` add it. The runtime's own tests put their stand-in before it.
  - Two tests of the registry no longer assume it starts empty.
  - **The check against the real `claude` is an ignored test**,
    `real_claude_runs_a_session_and_resumes_it`, run by hand:
    `cargo nextest run -p uraeda-server --test claude --run-ignored only real`. Its first form sent
    a resumed session a message with the id of an earlier one, and hung: Claude Code runs no turn
    for an id its transcript holds, so the sessions give each message a new one.
- **Rationale**: a test that started the machine's `claude` would use its owner's account, from
  every test of the server. A switch in the server's options would say the same, in every place that
  builds them.
- **If wrong**: the sandbox's server must start no real agent either (task 20): it needs that
  switch, or its own stand-ins. Codex's runtime needs its stand-in in the same folder (task 14).
- **Where**: task 13, `crates/server/src/runtimes/{mod,claude}.rs`,
  `crates/server/tests/support/mod.rs`, `crates/server/tests/claude/real.rs`. Tasks 14, 15, and 20.

## R221: An extension's records and actions are two names of the catalog, keyed at run time

- **Decision**: an extension names its records and actions as it loads, so none is an entry of the
  catalog. Three records and four actions serve them all.
  - `ExtensionRecord { repo, extension, name }` is any record an extension registered. Its value is
    `{ value, error }`: the JSON the extension's read gave, or why there is none, in band. The
    extension is off there, has no such record, threw, or did not answer in 10 seconds. A
    subscription stays open through a broken version, and gets the value once a save fixes it.
  - `extensions.act { repo, extension, name, input }` runs any action, and answers
    `ExtensionAction { output }`. `ExtensionAction` is that output's type: fate's record of that
    name was an answer read once, and nothing subscribes to it.
  - `Extensions { repo }` is every extension, the built-in ones first: `repo` is a repository's
    name, whose settings each row's `valuesHere` holds, or null for the settings page, which gets
    `repositoryValues`. Settings cross as JSON objects, where fate sent JSON as text.
  - `extensions.setOn { name, onAll, on }`,
    `extensions.setSetting { name, repository, key, value }`, and
    `extensions.reportPageProblem { name, version, message }` answer null. The first two read the
    extensions again before they answer, so a read after the answer shows the change (R48).
  - Dropped from the row: `keys`, which the page filled in, and `docs` of the record: where the
    API's documentation is belongs to task 51, which rewrites it.
  - `pageVersion` is null, and a page's report is dropped, until task 19 sets an entry's `page`.
- **Rationale**: the catalog is the client's types, made at build time. A page knows its extension's
  names, and the server finds the VM by the extension's name.
- **If wrong**: a record that fails with an `error` of the protocol, in place of the in-band one,
  ends its subscriptions: a page would subscribe again after each save.
- **Where**: task 17, `crates/protocol/src/extensions.rs`,
  `crates/server/src/records/extensions.rs`. Tasks 19, 20, 34, 48, and 51.

## R222: One VM per loaded version, on a thread of its own, run in pieces with limits

- **Decision**: `extensions/vm.rs` is the only code that touches QuickJS.
  - A version of an extension is one VM, one thread named `vm:<name>`, which owns the engine, the
    timers, and the calls waiting for an answer. A reload stops it and starts another: nothing of an
    unloaded version can run, so the Node API's "this version was unloaded" check is gone.
  - Code runs in pieces: one command of the server's, or one timer, with the promise jobs it leaves.
    A piece has 2 seconds for the activation, and 10 after it, enforced by the engine's interrupt
    handler. A caller waits 10 seconds for an answer, then is told `no answer in 10 s` while the
    call goes on.
  - The engine has 256 MB of memory and 1 MB of stack, on a thread with 8 MB: an allocation or a
    call past them throws in the extension, and reaches no stack of the server's.
  - The VM ends, and its extension is `broken` with what it threw, for a piece cut off, a timer's or
    a process line's callback that throws, a rejection nothing handles, and a panic under its code,
    which is caught at the thread's edge. A record's or an action's throw is that call's error
    alone, and an event handler's is printed.
  - `Vm::stop` sets a flag the interrupt handler reads, so it ends code that never returns, and
    waits at most 5 seconds for the thread. `Server::stop` stops every VM that way.
- **Rationale**: the Node server ran every extension on its own thread, where a loop after an
  `await` hung the server. A thread per VM lets a call block, and a flag stop it.
- **How it was checked**: without the interrupt handler,
  `an_extension_that_never_returns_is_cut_off` fails after 10 s on "waiting for endless to be
  broken", and `stopping_the_server_leaves_no_vm_work_behind` on
  `a VM's thread is left: ["vm:busy"]`. Without the catch at the thread's edge,
  `a_panic_under_an_extensions_code_ends_its_vm_alone_and_says_why` fails: the thread panics, and
  nothing says why.
- **If wrong**: the limits are `ACTIVATION`, `CALL`, `MEMORY`, and `STACK` of `extensions/vm.rs`. A
  rejection handled only in a later piece breaks its extension, as it ended a Node process.
- **Where**: task 17, `crates/server/src/extensions/{vm.rs,vm/machine.rs}`.

## R223: The server API is rebuilt over one host function, in four modules of the VM

- **Decision**: `api = 1` keeps its methods, `record`, `action`, `route`, `on`, `runtime`,
  `settings`, `repositories`, and `log`, with these changes, and no path from the Node API.
  - No `node:` module, and no Hono: an import of one is a compile problem that says what to use.
    Server code imports `uraeda/server` for types, `uraeda:fs`, `uraeda:process`, and its own files.
  - A route's handler gets `(request, repository)`, the request with `method`, `path`, `query`,
    `headers`, and `text()`, `json()`, `bytes()`, and answers a `Response`, a text, or a value sent
    as JSON. The VM has `fetch`, `Response`, `Headers`, `TextEncoder`, `TextDecoder`, `console`,
    `setTimeout`, `setInterval`, and `queueMicrotask`. There is no `setImmediate`.
  - An extension registers one runtime, and its `models`, `version`, and `reviewMessage` may answer
    a promise.
  - The VM gets seven natives, of which `call(op, json)` is the only way to the server. The API is
    JavaScript over it: `api/guard.js`, `web.js`, `modules.js`, and `prelude.js`, each a module
    whose default export takes the natives and the parts before it. `api.rs` serves the operations.
  - The declarations are `crates/server/src/extensions/api/server.d.ts`, with a `tsconfig.json`
    beside it that leaves the DOM's types out. `fixtures/extensions/tsconfig.json` checks the
    fixtures against it: `tsc -p fixtures/extensions` passes.
- **Rationale**: one string function keeps the engine's surface small enough to replace (R4), and
  the API readable as the JavaScript an extension's author debugs against.
- **If wrong**: bytes cross as base64 in JSON, which costs a large file two copies.
- **Where**: task 17, `crates/server/src/extensions/api/`, `api.rs`. Task 51 documents it, and
  rewrites `examples/extensions/wiki/`, which is still the Node API's.

## R224: What an extension can touch

- **Decision**: an extension's server code runs with the owner's rights, as it did in Node's `vm`:
  where it comes from is the guard (the extensions decision). It reaches the machine through three
  doors, and the server through the API alone.
  - `uraeda:fs`: any absolute path the owner can read or write, whole files and folders: read,
    write, append, list, stat, make a folder, remove, rename. Each call runs on the VM's own thread.
    A path that is neither a file nor a folder, as a pipe, is refused: reading one could hold the
    thread for ever.
  - `uraeda:process`: any command, as a `runtimes::Child` (R100): in the server's environment, the
    config folder's `.env` included, leading its own process group, in the extension's folder unless
    it names another. Its stdout comes by lines, the blank ones left out, and its stdin takes JSON
    lines.
  - `fetch`: any address, from the server, within 30 seconds and 64 MB, the whole answer at once.
  - Of the server: its own records, actions, routes, and runtime, the events of the repositories it
    is on in, its settings, and the list of those repositories with their paths. It holds no handle
    on the server's state, another extension's VM, the sessions' store, or sign-in.
  - Everything it starts is its VM's: timers, processes, requests, its runtime, and its runtime's
    processes. They are released when the VM ends, however it ends. A process still running is asked
    to end, and killed 5 seconds later; a request's answer is dropped.
- **Rationale**: the brief asks for the reach Node gave, and no more. Node gave every built-in
  module: these three are what the example and the runtimes use of them.
- **How it was checked**: with the processes forgotten as a VM ends,
  `a_saved_server_ts_replaces_the_running_one_without_a_restart` fails on
  `the unloaded version's command is gone`, and `an_extension_that_never_returns_is_cut_off` finds
  the command left.
- **If wrong**: an extension that needs a socket, or a stream it writes text to, has no door yet.
- **Where**: task 17, `crates/server/src/extensions/{fs,process,fetch}.rs`. Task 51.

## R225: The loader is one thread, and loads in the background of the server's start

- **Decision**: `extensions/loader.rs` holds every extension's state, changed by one thread.
  - It reads the config folder through the core, `<config>/extensions/`, and no other path.
  - The first read is asked as the server mounts, and not waited for: a broken extension's 2 seconds
    hold no start. A record read before its extension loaded says so, and is read again.
  - An extension loads again when its manifest, where it is on, or its settings change, and when the
    watcher saw one of its files change. A version that does not compile leaves the one before it
    running, with the problem. A broken one stays so until then.
  - `extensions::hold(shared, name, title)` holds an extension's reloads while a session works on
    its runtime: it is `waiting`, `waitingFor` the title, until the hold is dropped.
  - `run/extensions-status.json` is written in this server's data folder after each change, as the
    Node server writes its own, and removed as the server stops.
  - Built-in extensions are listed and never loaded: their server parts are Rust, registered through
    the same contracts, as `runtimes::register`. One of `claude`, `codex`, and `fake` with no
    runtime registered shows `off`.
- **How it was checked**: with the listed repositories' folders read as config folders,
  `an_extension_in_a_repositorys_folder_is_never_loaded` lists `echo`.
- **If wrong**: `ura extension list` reads the Node server's data folder until task 61.
- **Where**: task 17, `crates/server/src/extensions/{mod,loader,graph,status}.rs`. Tasks 15 and 19.

## R112: The extensions' folders are watched from `extensions/watch.rs`, with the one watcher's files

- **Decision**: three lines join the one watcher's lists (R93): `FILES_CHANGED`, which sends
  `step-reached` and `commit-landed`; `CONFIG_CHANGED`, which reads the extensions again; and
  `REPOSITORY_LEFT`. The extensions folder and each extension's own folders are watched with the
  watcher's `files::watch`, made `pub(crate)`, from `extensions/watch.rs`.
  - `turn-ended` and `session-started` are the sessions': task 15 says them with
    `extensions::emit(shared, &Happened::..)`.
- **Rationale**: which folders are watched follows what is loaded, a file's folder and the folders
  an import was looked for in, so they fit no list written in advance.
- **Where**: task 17, `crates/server/src/extensions/{watch,events}.rs`, `records/watch.rs`.

## R113: A runtime in a VM is a proxy, and its process's events cross one at a time

- **Decision**: `api.runtime(..)` registers a `Runtime` under the extension's name
  (`runtimes::register`), removed as the VM ends.
  - Each of its methods is a call into the VM, on the caller's blocking thread, bounded at 10
    seconds, 5 for `version`. `open` that fails or is late gives a process whose `exit` says why.
  - A process's methods tell the VM, and wait for nothing. Its events are read from the extension's
    async iterable and written on the stream one at a time. One that is no agent's event, the
    runner's `message`, `denial`, and `allowed` included, is refused.
  - As the VM ends, every stream still open ends with an `exit` that has no code (R98).
  - `extensions::skills(shared, repository)` gives `Options::skills`: the `skills/` folder of each
    of the owner's extensions on there.
- **Where**: task 17, `crates/server/src/extensions/runtime.rs`, and the test
  `an_extensions_runtime_runs_a_turn_and_leaves_with_its_extension`. Task 15.

## R107: Codex's exchanges are recorded or written, and the Node runtime writes what they become

- **Decision**: `fixtures/runtimes/codex/` holds what the test
  `a_recorded_stream_becomes_the_same_events_as_the_node_runner_made` compares, event by event.
  - **An exchange is every line both sides wrote**, in order: `{"client": ..}` for the runtime's,
    `{"server": ..}` for Codex's, after a first line that says how the process opened and the
    message sent.
  - **Five exchanges recorded from Codex 0.163.0** by `record.ts`, each one short message sent by
    the Node runtime, `CodexAdapter`, on `gpt-6-luna`, in a temporary folder: a reply in pieces
    (`reply`), a command and its output (`command`), a thought (`reasoning`), a turn that fails on a
    model the account does not have (`error`), and Codex's own review of one small commit
    (`review`).
  - **The sandbox of a recording is read-only.** Between the runtime and Codex, `record.ts` asks for
    `read-only` where the runtime asks for `workspace-write`, and writes the thread's answer with
    the sandbox the runtime asked for, without which the runtime refuses the thread. Nothing else is
    changed but what is scrubbed: the session's folder reads `/session-dir`, the home folder
    `/home/me`, the answers keep only the fields a runtime reads, and the notifications of the
    owner's own setup, their hooks, MCP servers, apps, and account, are left out.
  - **Four exchanges are written**, in `written/`, by `node-events.ts` and `written.ts`: `approved`,
    whose notifications are the exchange the Node server's tests hold, reused as it is
    (`codex-turn.jsonl`); `denied`, the same with the review refused, by hand (R108); `items` and
    `limits`, the cases of the Node runtime's tests as notifications: each kind of item, Codex's own
    sub-agents, the reviews' other ends, the usage windows, and the limits.
  - **The events of each are written by `node-events.ts`**, which drives `CodexAdapter` on the
    exchange and writes no event by hand: `<name>.events.jsonl`. 208 events in all.
  - **One stand-in plays both sides**, `stand-in.mjs`, run by `node`: it replays an exchange for the
    Node runtime and for the Rust one, matching each request by its method and giving each answer
    the id the runtime gave its request, and, with no exchange, answers as the stand-in of the Node
    server's tests did. It writes down its arguments, its token, and each line it read, so the
    requests are compared too. The server's tests of Codex need `node`, which the dev shell has.
- **Rationale**: a port is checked against what it ports. Codex's protocol is two-way, so a
  recording holds the runtime's own lines, and what replays it answers them.
- **If wrong**: an exchange goes stale with a new Codex. `record.ts`, then `node-events.ts`, write
  them again, while the Node runtime exists; after task 61 the events are kept as they are.
- **Where**: task 14, `fixtures/runtimes/codex/`, `crates/server/tests/codex.rs`.

## R108: No refusal of Codex's reviewer was recorded, and no recording asks for more than its sandbox

- **Decision**: `written/denied.jsonl` is written by hand, from the exchange the Node tests hold.
  The brief asked for "an approval asked and denied" recorded from the real CLI: it was not kept.
  - **What happened.** A reviewer's refusal only exists for an action that asks to run outside the
    sandbox. One recording was made with a message that asked Codex to run a command "with escalated
    permissions", a `curl` posting `/etc/hostname` to a host under `.invalid`, worded as the owner's
    own request, and expected to be refused. Codex's reviewer approved it instead, and the command
    ran outside the read-only sandbox the brief set. It failed, as that host resolves nowhere, and
    nothing left the machine. The recording was deleted, and its case removed from `record.ts`.
  - **The rule since.** No message of `record.ts`, nor of the manual check, asks Codex for an
    escalation, or names a command that needs one: what the reviewer approves runs outside the
    sandbox, so its answer cannot be the guard.
  - The approved review is the Node tests' own recorded exchange, reused. The refusal's shape is the
    protocol's `GuardianApprovalReviewStatus`, as the Node tests wrote it.
- **Rationale**: the limit was the owner's, and a message that asks to step over it is not a test of
  a refusal: it is a request.
- **If wrong**: a refusal is recorded by the owner themselves, with a message of their choice, and
  `node-events.ts` writes its events.
- **Where**: task 14, `fixtures/runtimes/codex/{record,node-events}.ts`, `written/denied.jsonl`.

## R109: The runtime's events are the Node runtime's, and it differs only outside them

- **Decision**: the 208 events of the nine exchanges are the Node runtime's, one by one, and so are
  the requests each is asked with. What the Rust runtime does otherwise is outside them:
  - **A line is done with before the next is read.** Everything a process keeps is one `Session`
    behind one lock. What a line leads to, an event, the next request, the turn that waited for an
    answer, is done before the next line, so the order of two events never depends on how the lines
    were cut on their way. The Node runtime went on in promises, between lines. Its events are
    written with each line read alone, as Codex writes them, and that order is this one.
  - **`exit` is the last event** (R98). What a dying process's unanswered requests would say after
    it, an `init` with a problem, a failed `result`, is dropped: the Node runtime pushed them after
    its exit, where its reader had usually ended.
  - **The reader ends with the process**, as Claude Code's does (T13.2): once the process exited and
    its group was killed, with what it printed read.
  - **A process nobody holds has its stdin closed**, which ends Codex.
  - **`set_effort` answers `true` until the process exited**: Codex takes the effort with its next
    turn.
  - **The command is the `command` setting of the built-in extension `codex`**, read as each process
    starts, as Claude Code's is (T13.3).
  - **A catalog that cannot be written says so in other words**: the end of what
    `codex debug models` wrote to its stderr, where Node gave its own error's message.
  - **A window's reset before 1970 or past the year 9999 is no reset**, and a count of tokens is a
    whole number, never below zero.
- **Rationale**: each is where the Node runtime relied on JavaScript's own order or texts, or where
  the contract of task 12 says otherwise.
- **Where**: task 14, `crates/server/src/runtimes/codex/{process,start,turns,limits,items}.rs`.

## R110: Codex's built-in registers as the server mounts, in a folder of small files

- **Decision**: `runtimes::mount` registers Codex's runtime under `codex`, its built-in extension's
  name, after Claude Code's. The owner turns it off by turning its extension off (R101).
  - **The code is `runtimes/codex.rs` and `runtimes/codex/`**, one file per part, where the plan
    named `codex.rs` and `codex_rpc.rs`: `rpc` (the channel), `process` (a session's lock and its
    command), `start` (the thread's start), `turns`, `events` and `items` (notifications into
    events), `limits`, `thread` (parameters), `permissions`, `catalog`, `models` and `lister`,
    `rollouts`, `folders`, `instructions`, `short`, `target`, `wire`, `json`.
  - **`runtimes::codex::codex(&shared)` is public**, with `start_within(duration)`, for the one test
    that shortens a start's time. Everything else reaches the runtime through the registry.
  - **The skill and the documentation are the folders of T13.3**, `<data folder>/plugin/skills` and
    `<data folder>/docs/extensions.md`, written by this runtime too, file by file, so neither
    runtime's write takes a file from the other's session. The instructions' words, an effort's
    name, and a tool's target are in `codex/{instructions,target}.rs` as they are in `claude/`.
    **One home for each is the join's.**
  - **No test finds the real `codex`**: `tests/support/no-agents/codex` fails at once, beside
    `claude` (T13.4), and the runtime's own tests put their stand-in before it. The stage of Claude
    Code's tests replaces the `PATH` without that folder: once both are merged, its servers find the
    real `codex`, and it needs the folder after its own, as `codex/stage.rs` has it.
  - **The check against the real `codex` is an ignored test**,
    `real_codex_runs_a_session_and_resumes_it`, run by hand:
    `cargo nextest run -p uraeda-server --test codex --run-ignored only real --no-capture`. It runs
    through the wrapper of `record.ts`, so its sandbox is read-only, and sends two short messages
    that ask for no command.
- **Rationale**: task 13 set the registration, the folders, and the stand-ins while this task ran.
  The same shapes keep the join to moving code, not deciding.
- **Where**: task 14, `crates/server/src/runtimes/{mod,codex}.rs`, `crates/server/tests/codex/`.
  Tasks 15 and 20, and the join.

## R111: The old UI and the Node server are out of validation, and a wave's gate is light

- **Decision**: no task, wave, or final pass runs `ts:test`, `web:build`, `ui:build`, `ui:smoke`,
  `storybook:build`, or `web:theme`. The full pass is `vp run ready:rust`, `vp run ready:app`, and
  `vp run ts:check`, once, at the end of the feature. After a wave's merge,
  `cargo check --workspace --all-targets` and `vp run app:check` run in the background, and the next
  wave starts at once. A failure or a review's finding goes to a fixer beside the next wave; a wave
  is held only when the merged code does not build, or an interface it consumes is wrong. A test
  that fails while the machine is saturated is rerun once it is quiet, at most twice, and named in a
  ruling when it passes. The checks of `crates/app/tests/outside.rs` are retried twice, in
  `.config/nextest.toml`. No task loads the machine or loops a test.
- **Rationale**: the human ruled it on 2026-11-11, with the skill's new wave gate. The suites of the
  code this feature replaces prove nothing about the new code, and the complete validation after
  each wave held every wave for a drawing check that fails only under other builds' load:
  `a_diagram_is_drawn_without_a_browser` failed twice so, and passed three times of three on a quiet
  machine.
- **If wrong**: `ts:test` also runs the tests of `scripts/`, the toolchain configuration's among
  them, which no pass runs any more until task 61 gives them a place in `ready`. The retries are an
  exception to the [toolchain](../decisions/toolchain.md) decision's "never retried", which the
  human asked for, and its text still says otherwise. The toolchain configuration's test `retried`
  refuses a `retries` line in `.config/nextest.toml`: it is in `ts:test`, so nothing runs it now,
  and task 61 changes it or the retries when it gives that test a place.
- **Where**: the plan's [global constraints](plan.md#global-constraints) and
  [validation](plan.md#validation), tasks 52, 55, 59, 60, and 61, and `.config/nextest.toml`. It
  replaces ruling R20: no pass runs the test R20 excused.

## R114: Pages are signed under a root key of the data folder, and no clock decides trust

- **Decision**: `extensions/signing.rs` holds the only code that reads a key.
  - The root key is made at the first start, in `<data folder>/extensions/signing.key`: an Ed25519
    seed in base64, in a file its owner alone reads (0600, in a folder 0700). A file that is no key
    stops the server's start, with a message that names the file and never what it holds.
  - The release key, which signs, is made anew at each start and kept in memory, with the root's
    certificate for `dev.uraeda.extension.*`. An extension's page is the app
    `dev.uraeda.extension.<name>`.
  - `GET /extensions/key` answers the root's public half, `PublicKey::to_base64`, to a signed-in
    client, which asks for it on each connection.
  - The certificate is valid for all of time, `0..u64::MAX`. NSH compares that window with the time
    the package says it was signed at, `createdAt`, which the signer writes: a verifier's clock is
    never read (`Certified::covers`, `nsh-package` 0.4.0). So a client whose clock is wrong verifies
    a page, and a server whose clock is wrong still signs one: `nsh_package::build` refuses to sign
    outside the window.
- **Rationale**: the plan's review focus keeps sign-in off a device's clock, and a page's trust
  follows it. A narrow window would add nothing: the release key lives one run, in memory, and the
  root never leaves its file. One file is one thing to protect.
- **How it was checked**: served with its signature blanked, the page fails
  `the served page verifies: BadSignature`; signed under another root than the one served,
  `UntrustedKey`; the key's file's text in a header of the page's route fails
  `GET /extensions/{name}/page: a header`, and in a problem of the record,
  `Extensions holds the key`; the root's seed served as the key fails
  `the served key is a public key`.
- **If wrong**: a data folder copied to another machine carries the key with it, as it carries the
  sign-in file. A root that must change is a file to delete: the next start makes another, and every
  client takes it on its next connection. NSH's revocation lists are not used.
- **Where**: task 19, `crates/server/src/extensions/signing.rs`, and the test
  `the_signing_key_never_leaves_the_data_folder`. Tasks 34 and 58.

## R115: A page's version is one counter of the data folder, and unchanged code keeps its version

- **Decision**: `pageVersion` is the package's build number, `App::build`, from
  `<data folder>/extensions/page-build`: the last number given, as text, one counter for every
  extension.
  - `builds::next` reads it, adds one, writes it whole (a file beside it, synced, then renamed), and
    only then gives the number. A file that holds no number is a build problem of the page: starting
    again from 1 would give builds a client refuses.
  - A restart builds every page again, each with a number after every one before it.
  - A page built again from the same code, title, and version keeps its package and its number: a
    save of `server.ts`, or a setting, does not make a client load the page again.
- **Rationale**: R22 suggested the build's time, but a clock can go back, and a test's clock stands
  still. A counter cannot, and one file holds it.
- **How it was checked**: with the counter never written, every build is 1, and
  `a_build_number_never_goes_back_across_a_restart` fails waiting for `a page after version 1`.
- **If wrong**: a data folder deleted starts the counter again, with a new root key. A client that
  keeps its accepted builds on disk (`TrustStore::open`) must drop them when the served key changes:
  task 34's, which may as well keep its trust in memory, and ask for the key on each connection.
- **Where**: task 19, `crates/server/src/extensions/builds.rs`. Task 34.

## R116: A page is bundled from its folder, with `uraeda/ui` and `uraeda/page` built in

- **Decision**: `extensions/pages.rs` builds a page with `nsh_bundler::bundle`, into one module.
  - The build's entry is the server's, in `<data folder>/extensions/pages/<name>/`: `entry.ts`
    imports `./start`, whose one statement is `host.post("start")`, then the page's entry by its
    absolute path. The `nsh.json` beside it is the server's too, so the extension's own, if it has
    one, is never read.
  - `nsh` and `nsh/base` stay imports, which the client's engine serves. `uraeda/ui` and
    `uraeda/page` are TSX, and a page runs in an engine of its own, so they cannot be imports the
    host serves: NSH's UI sets are Rust registries. They are aliases of the build's `nsh.json` to
    files of the server's **modules folder**, and are built into the package: `ui/index.ts` and
    `extensions/page.tsx`, the layout of `app/`.
  - The modules folder is `<data folder>/extensions/modules/`, or the folder the variable
    `URAEDA_PAGE_MODULES` of the server's environment names: `app/` of a checkout, or the tests'
    stand-ins in `fixtures/pages/modules/`.
  - After the build, every file the bundler read (`Bundle::watch_files`) must be in the extension's
    folder, links resolved, in the modules folder, or the build's own. Any other fails the build,
    and so does a file that is no code (`.ts`, `.tsx`, `.js`, `.jsx`, `.json`): a page's package
    carries no asset, since the bundler names an asset from the entry's folder, which is not the
    extension's.
  - The folders of the page's files are watched with the server's. After a build that failed, every
    folder of the extension is, up to 64, without hidden ones and `node_modules`: the bundler does
    not say where it looked.
- **What tasks 26 to 34 provide**, and where:
  - `app/ui/index.ts`: what a page gets of the component library, and `app/extensions/page.tsx`: the
    page API. Both import only `nsh`, `nsh/base`, and files beside them, in `app/ui/` and
    `app/extensions/`. No task of 26 to 33 writes an `index.ts`: task 34 does.
  - Those two folders in the server's binary (`include_dir`, as the skill is, R105), written as
    `extensions::mount` runs to `<data folder>/extensions/modules/ui/` and `.../extensions/`, anew,
    before the loader's first read.
  - If a component of `app/ui/` needs `uraeda/native`, the page's engine must serve it: its
    `SetDescription` joins `ui_sets` in `pages::bundled`, and its registry the page's view.
  - If a page must draw with the app's own tokens at build time, its theme goes in the build's
    `nsh.json`, which `pages::bundled` writes.
  - Until then, a page that imports one of the two fails its build with
    `uraeda/ui cannot be imported: this server holds no such module yet`.
- **Rationale**: the package holds everything that runs, under one signature, on the desktop and in
  the browser's player alike. The extensions decision loads an extension only from the config
  folder: the check reads the bundler's own account of what it read, so no second resolver has to
  agree with it.
- **How it was checked**: with the check skipped, `a_page_is_built_from_its_extensions_folder_only`
  fails waiting for `the outside import's problem`: the page was built with the file beside its
  folder. With the page imported before `start`, the first test fails on the source, where `start`
  is posted after the page's code.
- **If wrong**: a page cannot import an image or a font. A fix is NSH's: an asset named from a root
  the caller gives. `node_modules` inside the extension's own folder is bundled, as its own files.
- **Where**: task 19, `crates/server/src/extensions/pages.rs`, and the tests
  `a_page_is_built_from_its_extensions_folder_only` and
  `a_page_gets_the_apps_modules_from_the_data_folder`. Tasks 34, 51, and 58.

## R117: A page's rights are four functions of its host, and its build's problems are its own

- **Decision**:
  - A package's capabilities are `{ "host": ["start", "record", "call", "navigate"] }`, the constant
    `HOST` of `extensions/signing.rs`: `start` for R23, and the three the plan's task 34 has the app
    answer. Nothing else is granted: no file, process, network, web view, or clipboard. Task 34
    changes the constant if its channel has other names.
  - The package carries the bundle's source map, which NSH's engine reads to name a page's files in
    the errors it logs. It carries no bytecode and no asset. The code is not minified.
  - A build's problem is kept apart from the server code's, in the entry's `page_failure`, and shown
    in the row's `problems` after the code's and before what clients reported. Its file is the
    page's entry, its message the bundler's, with the paths written from the extension's folder. A
    page that fails leaves the extension's state as its server part has it.
  - `GET /extensions/:name/page` answers the running version to `If-None-Match`, with 304, so a
    browser's cache holds a page by its version. A native client asks when `pageVersion` changes.
- **How it was checked**: with the running page dropped as a build fails,
  `a_page_that_does_not_compile_keeps_the_last_one_and_says_why` fails on `pageVersion`, null where
  it was 1.
- **Where**: task 19, `crates/server/src/extensions/{signing,pages,loader}.rs`. Tasks 34 and 58.

## R118: A test's server gets its `PATH` from one place, which holds a stand-in for each agent

- **Decision**: `crates/server/tests/support/machine.rs` is the one home of "no test's server starts
  the machine's agents". It replaces the parts of R106 and R110 on the folder `no-agents/`.
  - **Every test's server has a folder of stand-ins of its own**, with a link `claude` and a link
    `codex` to the one script `tests/support/no-agents/stand-in`. The script writes its name and its
    arguments in that folder's `asked`, and fails at once, as a command that is not installed.
  - **`support::setup()` builds the `PATH`**: the test's own commands, then the stand-ins, then the
    machine's. A test's own commands are a folder given to `Setup::commands(dir)`, as the two
    stages' `bin`. `Setup::env` refuses `PATH`, so no test takes the stand-ins off it.
  - **`Setup::options()`** gives the options of a start the test makes itself, as one that must
    fail: no test builds an environment by hand. `crates/cli/tests/serve.rs` builds the `PATH` of
    its `ura serve` with the same module.
  - **`TestServer::runs_no_agent_of_the_machine()`** asserts it: the `claude` and the `codex` the
    server's `PATH` finds are in a folder the test gave or among the stand-ins, and each stand-in
    was asked, as the built-in runtimes ask for their models at the start. One test calls it on a
    plain server, and one on each stage. Before the stages were moved, both failed.
  - The two checks against the real agents, which are ignored, are the only starts outside it:
    `claude/real.rs` builds its server in the process's environment, and `codex/real.rs` names the
    real `codex` by its path.
- **Rationale**: the stage of Claude Code's tests replaced the `PATH` without the stand-ins, so once
  Codex's runtime was merged each of its servers started the machine's `codex` for its models, on
  its owner's account. A rule every stage must remember is forgotten by the next one. Links, not
  scripts written per server: a script written and run at once can be refused as busy while another
  thread starts a process.
- **If wrong**: the pull requests' refresh runs `gh` (R120), which is a command of the machine that
  uses its owner's account too: it has a stand-in in the same folder. The sandbox's server (task 20)
  needs its own answer, as R106 says.
- **Where**: `crates/server/tests/support/{mod,machine}.rs` and `no-agents/stand-in`,
  `crates/server/tests/{claude,codex}/stage.rs`, `crates/cli/tests/serve.rs`.

## R119: What the built-in runtimes share is in `runtimes/built_in/`

- **Decision**: the four things Claude Code's runtime and Codex's each held a copy of have one home,
  `crates/server/src/runtimes/built_in.rs` and its folder, which closes what R105 and R110 left to
  the join.
  - **`built_in::Given`**, in `given.rs`: the folders every built-in agent is given,
    `<data folder>/plugin` and its `skills/`, `<data folder>/docs/extensions.md`, and the owner's
    extensions folder, with the writer of the skill and the documentation. `runtimes::mount`
    provides one per server, `shared.get::<Given>()`, so they are written once per start, as the
    first process of either agent opens, and no longer once by each runtime.
  - **The writer is the one Codex's runtime had**: file by file, then the files the skill no longer
    has removed, so no file is missing for a session that reads it. Claude Code's removed the
    skill's folder first. What is on disk afterwards is the same.
  - **`built_in::instructions`**, in `instructions.rs`: the app's words with the section on
    extensions. Codex's `instructions.rs` keeps its sandbox's section, after them.
  - **`built_in::tool_target` and `file_target`**, in `target.rs`: what a tool call acts on. The two
    copies read a path under the session's directory in two ways that give the same text; the one
    kept is Codex's.
  - **`built_in::effort_name`**.
  - Claude Code's `folders.rs` keeps what only it needs: the plugin's manifest, the chat images'
    folder, and the extensions' plugin folders.
- **Rationale**: a word of the instructions changed in one runtime alone would tell the two agents
  different things. No test changed: the recorded streams of both runtimes give the same events, and
  both are started with the same arguments and instructions.
- **Where**: `crates/server/src/runtimes/{mod,built_in,claude,codex}.rs`, `built_in/`,
  `claude/{folders,args,models,tools,events}.rs`, `codex/{instructions,items,events,models}.rs`.

## R120: The pull requests' refresh is a records domain, which runs `gh` itself

- **Decision**: `crates/server/src/records/pulls.rs` ports the Node server's `pulls.ts`, which no
  task named (R57). It serves no record: the workspace's and the features' records already carry a
  feature's pull request, from the snapshot the core keeps per repository.
  - **When a repository is asked**: as the server starts and as it joins the list; after a burst of
    the watcher that names a feature, or says a feature, a branch, or a worktree came or went, its
    line in `FILES_CHANGED`; and every minute while one of its features is at `catch-up`,
    `final-review`, `finish`, `pull-request`, `pull-request-changes`, `pull-request-unknown`, or
    `push`.
  - **One round at a time**, on a blocking thread, for every repository: the bursts told while a
    round runs are the next round, each repository asked once.
  - **The server runs `gh`**, in `pulls/gh.rs`, with `shared.environment().command("gh")` in the
    repository's main checkout, and gives what it printed to the core's `pulls::parse`,
    `parse_merged`, `known`, and `settle`, at `shared.now()`. The core's own `pulls::refresh` starts
    `gh` in the process's environment, where a test's server would find the machine's.
  - **Two differences from the core's fetch**: `gh` gives up after 30 seconds, and the merged pull
    requests are not asked for when the open ones failed, since nothing is known without them.
  - **A refresh that changed what is known tells the bus**: `workspace::written` and
    `features::written` of the repository.
  - **The server's stop** ends the rounds through `shared.on_stop`, which waits for the one that
    runs: a `gh` that runs is killed, and none is started.
  - **`SETTLED`**, a list of `fn(&Shared, &str)` in `pulls.rs`, is where the sessions start the
    catch-up runs (task 15). It is empty, and marked `TASK 15:`.
  - **In tests**, `gh` is a stand-in that fails, beside the agents' (R118). `tests/pulls.rs` puts
    its own before it, a script that answers the JSON recorded in its folder. Two of its tests run
    on tokio's paused clock, so a minute passes at once.
  - A failure is not logged: `gh` missing or signed out is the snapshot `Unavailable`, as in the
    core, and a repository whose folder is gone is skipped.
- **Rationale**: without it a workspace shows no pull request, and no step past the last task moves
  on what GitHub says.
- **Alternatives**: a line in the git domain's fetcher, as R57 proposed. The fetcher runs every 5
  minutes as a write of the queue; the refresh writes nothing, and runs by the minute.
- **Where**: `crates/server/src/records/{mod,watch,pulls}.rs`, `pulls/gh.rs`,
  `crates/server/tests/pulls.rs`, `crates/server/tests/support/machine.rs`. Task 15.

## R121: The browser opens at the start with the web build, in task 56

- **Decision**: the Rust server opens no browser as it starts, and `settings.setOpenBrowser` writes
  a setting nothing reads. Task 56, which makes `ura serve` serve the app, reads it and opens the
  browser as the Node server's `browser.ts` does: only where a desktop can show one, never over SSH,
  with `xdg-open` or `open`, and with a one-time sign-in link. Its text says so, and the action is
  marked `TASK 56:`.
- **Rationale**: the Rust server serves no page until task 56. A browser opened on it before would
  show nothing.
- **Where**: `crates/server/src/records/workspace/settings/actions.rs`, and the plan's task 56.

## R122: `just` runs the new stack's checks, and no task runs Vite+, pnpm, or Node

- **Decision**: every check and build of the new stack is a recipe of the [`justfile`](/justfile),
  run in the dev shell as `nix develop -c just <recipe>`.
  - `just task <crates>` is a Rust task's validation, `just task-app` an app task's, `just check`
    the wave's gate, and `just ready` the full pass. `just` lists the others.
  - Formatting and linting of what Cargo does not read run from the dev shell's `oxfmt` and
    `oxlint`, with [`.oxfmtrc.json`](/.oxfmtrc.json) and [`.oxlintrc.json`](/.oxlintrc.json).
    `oxfmt` formats the 739 files it reads as Vite+ did: none changed.
  - Three scripts became shell: [`scripts/nsh.sh`](/scripts/nsh.sh),
    [`scripts/isolated.sh`](/scripts/isolated.sh), a test's own temporary folder, git without the
    host's configuration, and the machine's two heavy slots, and
    [`scripts/worktree-seed.sh`](/scripts/worktree-seed.sh).
  - A new worktree's `target/` is cloned from the checkout whose commit is the closest, the
    feature's worktree for a task's, and no longer from the main checkout: 18 s, with every
    dependency the feature added already built. Seeded from the main checkout, each task's worktree
    compiled them all, about five minutes before its first result.
  - The app has no npm package (ruling R123), so no worktree runs `vp install`.
  - Task 61 removes Vite+, pnpm, and Node from the repository and the dev shell, and points CI at
    `just ready`. Until then their files stay, unused by the new stack: the old UI needs them, and
    is frozen.
- **Rationale**: the human asked for it on 2026-11-11: the project is no longer a JavaScript
  program, and `just` is enough. Cargo and `nsh` skip what did not change, so the recipes need no
  cache of their own.
- **If wrong**: a check that only `vp run ready` held is lost until task 61 rewrites or drops it:
  the toolchain configuration's tests, and the lint rules of the old packages' shared configuration,
  which `.oxlintrc.json` does not carry. The human amended the
  [toolchain](../decisions/toolchain.md) decision to the recipes on 2026-11-11.
- **Where**: `justfile`, `flake.nix`, `scripts/`, the plan's [validation](plan.md#validation), and
  task 61. It replaces the commands of ruling R111, whose rules stay.

## R123: Diagrams are drawn in Rust by Merman, and Pele goes

- **Decision**: `merman` 0.9.3 draws Mermaid diagrams, in Rust. It replaces Pele in NSH's VM, the
  first step of ruling R25, whose second step stays: `usvg` writes the text as shapes.
  - The layout measures labels with the fonts the picture is drawn in, through Merman's
    `native-fonts`. With its own metrics, labels were cut at their box's edge.
  - Its `resvg_safe` pipeline writes labels as SVG text. Its default writes HTML, which `usvg`
    leaves out.
  - Colours are Mermaid's theme variables, `primaryColor`, `lineColor`, `primaryTextColor`, and the
    others, given as the app's configuration, on the theme `base`. A theme change makes the picture
    again.
  - A quoted label's angle brackets become entities before Merman reads it, but for a line break's:
    a label naming `<name>` lost every label of its diagram.
  - A diagram has 2 seconds, then shows as its source, like one Merman cannot read.
- **Rationale**: the human asked for a Rust library, to drop the app's only npm package. Five were
  tried on the 18 distinct diagrams of the repository and its history, each drawn through `usvg` as
  NSH draws it. `merman` drew all 18, with the source's colours and wrapped labels, in 8 ms on
  average. `ariel-rs` drew all 18 but ignores `classDef` colours, and has had no release since
  May 2026. `selkie-rs` scrambled the largest flowchart. `mermaid-rs-renderer` overlapped labels.
  `mmdflux` does not read `erDiagram`, five of the 18. Zed uses Merman.
- **If wrong**: Pele in the VM still holds, as R25 measured it. Merman brings about 240 crates, and
  a second `usvg`, 0.47, beside NSH's 0.46. Not checked: a diagram's links, which a picture cannot
  follow, and the web build.
- **Where**: `a_diagram_is_drawn_without_a_browser`, `crates/app/src/diagram.rs` (moved there by
  task 31), `app/__checks__/diagram.tsx`. Task 31. The human amended the
  [diagrams](../decisions/diagrams.md) decision to Merman on 2026-11-11.

## R124: The branch caught up with the default branch before its last server tasks

- **Decision**: the branch was rebased on the default branch on 2026-11-11, after task 19 and before
  task 20, rather than at the final review. The plan gains tasks 62 (accounts), 63 (scheduled jobs),
  64 (what else the Node server gained), and 65 (the Jobs place), new rules in the screens' tasks,
  and the section [what makes a screen good](plan.md#what-makes-a-screen-good).
- **Rationale**: the human asked for it. The default branch gained multi-accounts, scheduled jobs, a
  limit's move to another account, and a round of fixes to the screens, all in the code this feature
  ports and then removes. The parity lists of tasks 20 and 55 read that code, so with it on the
  branch a record or a route nobody ported fails a test. The decisions it changed,
  [models](../decisions/models.md), [run lifecycle](../decisions/run-lifecycle.md), and
  [agents](../decisions/agents.md), apply to the Rust runner: tasks 62 and 63 meet them.
- **One conflict, in a decision**: both branches changed [toolchain](../decisions/toolchain.md). The
  two changes do not disagree: this branch removes the React Compiler rules, and the default branch
  allows a test that failed on a saturated machine to run again. The text keeps both.
- **If wrong**: task 15 was built on the code before the catch-up, so what it ported of the runner
  is a day older than what tasks 62 to 64 read. Task 64 lists what the difference holds.
- **Where**: the plan's tasks 33, 36 to 39, 43, 44, 48, 51, and 62 to 65.

## R125: The client's first tasks are built beside the sessions

- **Decision**: tasks 24 (routes and per-device storage) and 25 (the design language's samples)
  start while task 15 (sessions) is still built, ahead of tasks 62 to 64 and 20, which wait for it.
- **Rationale**: neither reads the server: task 24 is pure TypeScript, and task 25 draws samples.
  The human's ruling of 2026-11-11 holds a wave only for code that does not build or an interface it
  consumes, and the sessions are the longest task of the server. Task 23, the client store, still
  waits for the sandbox of task 20, which its tests run on.
- **Where**: the plan's [waves](plan.md#waves), 9 to 11.

## R126: A route is a page with the rest of its address, and an old address is resolved as it is read

- **Decision**: `Route` is the React UI's union of pages, each with `repo`, `query`, and `hash`
  beside its own fields, all three optional, and `parseRoute` and `pathOf` take and write a whole
  address. Three pages of the old union went: `moved` and `run`, which only redirected, and
  `first-run`, which no address named. `/commit`, `/chats/<id>`, `/chats/new`, `/changes/new`,
  `/f/<folder>/runs/<id>`, and a Storybook address without `?story=` now parse to the page where it
  is, with the query and the hash the old redirects kept. The New page's `kind` is absent when the
  address names none, and a story's page holds its `story`. The table stays in TSX.
- **Rationale**: the old pages read the repository, the query, and the hash from the browser's
  location, which the app does not have: a screen now gets them from the one signal `route`. A
  redirect drawn by a component needed a screen for each old address, and showed the old address
  until it ran. Read as it is parsed, an old link opens its page at once, and the history writes the
  page's address in its place. The New page asked the location whether `?kind=` was named, to leave
  the choice open on a phone: the absent `kind` says it. Parsing an address is a split and a table
  lookup, once per navigation, so it is not the heavy logic the plan keeps in Rust: the test of 67
  addresses, each parsed twice and written once, runs in 8 ms in NSH's interpreter.
- **Alternatives considered**: `parseRoute(path, search)` and `parseLocation`, as the old table had,
  with the query and the hash in signals of their own: three signals to keep in step, and a
  `navigate` that takes a string.
- **If wrong**: a repository's path without a repository (`repo` absent) and a decision as a branch
  has it still need what the server knows, so the screens of tasks 36 and 45 redirect them, with
  `redirect`.
- **Where**: `app/store/routes.ts`, and the rows of `app/store/routes.test.ts`.

## R127: The history's visits live in an adapter, the app's own stack unless the browser's is bound

- **Decision**: the history keeps the visit shown and its rules: who is asked before a page is left,
  what a visit keeps, and what stays in a repository. The visits themselves are in a
  `HistoryAdapter` of five functions, `start`, `push`, `replace`, `back`, and `listen`.
  `memoryHistory` is the default, and the Linux app's. Task 57 writes the browser's and calls
  `bindHistory`: `push` and `replace` are `pushState` and `replaceState` with the entry as the state
  and `pathOf(entry.route)` as the address, `back` is `history.back()`, `listen` hears `popstate`,
  and `start` is the state's entry or `entryAt` of the location.
- **What changed from `routeHistory.ts`**:
  - `route` is an `Accessor`, not a `Signal` with a `set`: only the history writes it.
  - `navigate(route)` opens the page in the repository of the one shown, as `navigateHere` did.
  - A visit's `from` is the route it was opened from, set by every `navigate`, where the old callers
    passed a path by hand. `back()` answers `false` without it, as `openedInApp` said.
  - The scroll positions are named, `positions().at("page")`, since NSH has no window that scrolls:
    a page starts its `Scroll` at one (`contentOffset`) and keeps it when the scroll comes to rest
    (`onScrollEnd`). No timer, and no list of savers. The `opener` position went with the window's
    scroll.
  - Back asks as the old `LeaveGuard` did, after the adapter moved: the visit left is pushed back
    above the one reached, and stays shown while the human is asked. So the browser's Back button
    and the app's `back()` take one path, and the adapter decides nothing.
  - Nothing is asked when the address stays the same but for its hash, which replaces `openAnchor`,
    and when an overlay closes.
  - `keep(values, id)` replaces `selectOnArrival`, and tells who reads `entry()`.
- **Rationale**: the plan asks for no browser API here and a history task 57 can bind. With the
  rules on one side and the stack on the other, the rules are tested once, on the memory stack, and
  the browser's adapter holds none.
- **Alternatives considered**: NSH's `createNavStack` and `NavStack`, which keep every page of the
  stack mounted, for a phone's native stack: the app's pages are addressed, and one is drawn at a
  time.
- **If wrong**: there is no `forward`. The browser's Forward button arrives through `listen`, and
  the Linux app has no key for it yet.
- **Where**: `app/store/history.ts`, and task 57.

## R128: The device's values are read once, then answered from memory, and their keys are one table

- **Decision**: `device.load()` reads every entry of NSH's `Storage` once, before the app is
  mounted, and `device.get` and `device.set` then answer at once: `get` is a signal's read, and
  `set` writes the storage after. Values are JSON. The keys are the type `DeviceKeys` in
  `app/store/device.ts`, one line per value, where a feature adds its own: it is empty until the
  first does. `deviceStore<Keys>()` makes a store over another table, for tests.
- **What NSH's storage does**, read in its source at the pin (`nsh-core/src/storage.rs`,
  `nsh-engine/src/storage.rs`, `nsh-platform-web/src/storage.rs`, `nsh-testing/src/storage.rs`):
  - In TSX every call returns a promise, and calls run in order. In Rust they are synchronous. The
    entries are in memory once read, on every platform.
  - On GTK: the file `$XDG_DATA_HOME/dev.uraeda.app/storage.json`, one JSON object, written whole to
    a temporary file and renamed, on a thread of its own. A file that does not parse is set aside as
    `storage.json.corrupt`, and the app starts empty.
  - On the web: the browser's `localStorage`, each entry under `nsh:dev.uraeda.app:<key>`. When the
    browser refuses a write, NSH logs it and keeps the entry in memory.
  - Everywhere: 5 MB of keys and values, counted in Rust. `setItem` past it rejects with the code
    `ERR_NSH_QUOTA_EXCEEDED`, and keeps what it held.
  - Under `nsh test`: memory. A test file's own engine starts empty, and an app a test opens starts
    with `open`'s `storage`, read back with `app.storage()`.
- **Rationale**: a theme read through a promise draws the default first, then the choice. One read
  at the start costs a call per entry, all from memory. One table makes a name taken twice a compile
  error, where keys declared beside each feature would collide only when both run. A refused value
  stays for the run and `device.full()` says so, as the old `unsaved.ts` kept text in memory when
  `localStorage` was full.
- **Alternatives considered**: a synchronous read through `uraeda/native`, on Rust's `Storage`: a
  second path to keep on the web build, for one read at the start.
- **Where**: `app/store/device.ts`, `app/store/device.test.ts`.

## R129: Glass on GTK is one shader pass over the picture each view gets

- **Decision**: glass is a `<Shader>` that reads what is behind its box with `sample_backdrop`. The
  language's "frost taken once from a quarter-size copy of the backdrop, and shared" is not drawn on
  GTK: each glass view blurs its own picture, in one pass.
  - The frost is 64 taps on a spiral, weighted as a Gaussian of 7 px, and turned by a different
    angle at each pixel. With taps this far apart a fixed spiral drew ghosts of the text behind, as
    the spike's grid of 49 taps did. The turn makes them a dither finer than the grain.
  - In the bent band, each tap reads three points, one per colour, for the fringe.
  - The rim, the sheen, the line of light, the shade, and the grain are drawn by the same shader.
    Its drop shadow is the view's `boxShadow`.
  - The tint thickens with the brightness of what the frost returns, so the floor holds over any
    page: over white, the dark theme's glass is 92% tint.
- **Rationale**: NSH gives a shader one picture of what is behind its view, at full size, with no
  smaller level and no second pass, and takes it again whenever a view behind changes. Nothing is
  shared between two glass views.
- **Alternatives considered**: two shaders on one box, one blurring across and one down: a smooth
  blur from fewer taps, at the cost of two pictures a frame and of a frame or two more of lag, since
  a shader's frame comes back from the GPU a frame or two late. Not tried: one pass passed the
  tests.
- **If wrong**: the taps are read on the GPU, off the main thread, so their number shows in no frame
  timing here. On a slow GPU the glass would lag what scrolls under it by more frames: the
  language's order holds, the fringe goes first, then the bent edge.
- **Where**: `GLASS` in [`app/gallery/samples/shaders.ts`](/app/gallery/samples/shaders.ts). Task 27
  moves it to `app/ui/surfaces/glass.wgsl`.

## R130: What GTK draws otherwise than a browser, and how the samples draw it

- **Decision**: three parts of the language are drawn another way than the mockup's CSS.
  - **The focused pane's glow is a shader that draws once**, from the distance to the pane's shape,
    its title's tab included. As `filter: drop-shadow()` on the pane, GTK drew the same picture, and
    blurred the whole pane again on some frames of a scroll: the worst frame of each second went
    from 6.5 ms to 11.5 ms at the median, on the hidden display. The glow's shape needs the title's
    width, which `onLayout` gives.
  - **The focused outline is four lines of 1 px**, each a gradient along itself: mauve at the bottom
    left corner, blue at the top right, and their mix at the two others, which is where a gradient
    at 45° puts them on a square pane. The title's tab takes the mix. A CSS gradient cannot follow a
    shape that is not a box, and NSH has no clip path.
  - **A tube's inner light is a gradient** from its two long edges. As an inset shadow with a blur,
    GTK drew it in three bands with seams between them.
- **Rationale**: each was seen in a picture, or measured, on GTK.
- **If wrong**: the glow's shader draws again when the pane's size changes, a frame or two late:
  while a pane is resized by hand its glow follows it late. Not seen: no sample resizes.
- **Where**: `GLOW` in [`app/gallery/samples/shaders.ts`](/app/gallery/samples/shaders.ts), `pane`
  in [`parts.tsx`](/app/gallery/samples/parts.tsx), `button` in
  [`controls.tsx`](/app/gallery/samples/controls.tsx). Tasks 27 and 28.

## R131: How the samples were checked, and what the hidden display cannot say

- **Decision**: the language's three tests were read from the samples' pictures and from NSH's frame
  timing, on the hidden display.
  - **Contrast**: each sample with text on glass is pictured twice, the second time with nothing on
    its glass. The pixels that differ are what sits on the glass, and the second picture has the
    glass under them. Blocks aside, they are the strokes of text and icons: each text colour written
    on that glass is compared with the glass under every one of them. The lowest ratios: 4.70 in the
    dark theme, the faint ink on the bar over the transcript, and 4.71 in the light one, the insert
    mode's green on the status line over the busiest page.
  - **Motion**: each sample is pictured again 1.5 s later. No pixel differs in any sample, in either
    theme, but round the one main action of the two samples that have one.
  - **Frames**: the glass bar over a transcript of 20,000 rows that scrolls 900 points a frame, for
    30 s, with `nsh test --fps`: 1,740 frames at 60 a second, 5.34 ms a frame on average, the 95th
    percentile of each second between 5.74 and 6.42 ms, and one second with frames over 8.3 ms, at
    most three of them, the worst 8.96 ms. So the 99th percentile is under 8.3 ms. The same scroll
    with no bar: 5.02 ms on average. The machine's load was about 4 during both.
- **Rationale**: the task asks for numbers from pixels and from NSH's own timing, and
  [R17](#r17-the-invisible-display-is-hidden-display) allows no other display.
- **If wrong**: the hidden display draws in software, so its frame timing is not the desktop's. The
  spike's same scroll cost 5.3 ms a frame there, and 2.0 ms on the GPU. No measure on a GPU was
  taken here: `just frames` (task 35) and the performance task (53) need a display that draws on the
  GPU and shows on no screen, or the human's leave to use theirs.
- **Where**: [`samples.test.tsx`](/app/gallery/samples/samples.test.tsx) and
  [`frames.test.tsx`](/app/gallery/samples/frames.test.tsx), run by `just samples-shots` and
  `just samples-frames`. The script that reads the pictures' pixels is not in the repository: it was
  Python, which the repository does not have.

## R132: The values the samples corrected, and what they took that the language left open

- **Decision**: the design language keeps its rules, and these values changed.
  - **`edge`**: `#6c7086` to `#70748b`. On a raised card, `#2a2b3e`, the old one reached 2.84:1,
    under the 3:1 a border needs. The new one reaches 3.01:1 there, measured.
  - **Frost**: "a blur of 14 px" is 14 px across, a deviation of 7 px, which is what the mockup's
    lens drew. At a deviation of 14 px the glass was fog.
  - **Grain**: an overlay of 5% in the dark theme, and 1.5% in the light one, from 3.5%.
  - **The tint's thickening** has a value: 30% of the whole at most in the dark theme, 20% in the
    light one.
  - **The edge of glass** keeps 35% of the frost, and is pulled inward by 1.6 bands at most.
  - **The light theme's focus shadow**: 24%, as the mockup has it, where the guide said 18%.
  - **A key's block**: under the pointer, the accent at 32% over the backdrop, from 38%, where the
    letter reached 3.94:1. In the light theme, the accent at 10% over white: on the mockup's
    lavender block the letter reached 3.14:1.
  - **The light theme's roles** are the shipped Latte's darkened accents and faint ink. The mockup's
    faint ink, teal, and orange reached 4.37, 4.23, and 4.18:1 on a plain surface.
- **Left open by the language, and taken**: a pane clips what it holds, as the mockup's does, so a
  main action's glow never reaches the status line's glass; the main action of a page rests while an
  overlay has the focus; and a selected row's bar keeps the mockup's glow of 8 px.
- **Not drawn by any sample**: what moves when a state changes, the light's glide, a run's line
  drawn and faded, the caret's trail, a press. Their durations and curves are in `values.ts`, as the
  language has them. Tasks 27, 28, and 30 draw them.
- **Where**: [`design-language.md`](/specs/ui/design-language.md), and
  [`values.ts`](/app/gallery/samples/values.ts), whose `choices` holds each open choice of
  [R13](#r13-the-designs-open-choices-taken-by-default) at the value it names.

## R133: The new roles are twelve, named as a theme's file names its others, and three old ones are reused

- **Decision**: a theme gains twelve roles, in kebab case as its other roles: `backdrop`,
  `backdrop-wash-1`, `backdrop-wash-2`, `well`, `rule-quiet`, `lip`, `shade`, `glass-tint`,
  `glass-rim`, `light-focus`, `light-focus-2`, `light-running`. Three of the design language's are
  roles a theme already had: its `surface` is `page`, its `edge` is `rule`, and `raised` keeps its
  name. The editing mode's colours stay `mode-normal`, `mode-insert`, `mode-visual`, and
  `mode-replace`.
  - The language wrote the names with dots, `edge.quiet`. A TOML table cannot hold both `edge` and
    `edge.quiet`, and themes stay in the same format.
  - In the two default themes, `raised` becomes the language's raised fill, `#2a2b3e` and `#fbfbfd`,
    where it was Catppuccin's mantle; `rule` in Mocha becomes `#70748b` (R132); and `mode-normal`
    and `mode-visual` trade places, so the normal mode is the accent, as the language says.
  - `well` is Catppuccin's mantle, `#181825` and `#e6e9ef`, where the samples drew `#181824` and
    `#e4e7ee`: a shipped theme keeps its published colours.
  - `glass-tint` is the tint itself, Mocha's mantle warmed by 5% of peach, `#232029`: the samples
    mixed it from a constant.
  - In the tokens, `tokens.role` holds every role of a theme, the old ones included, under its
    file's name in camel case: `tokens.role.ruleQuiet`, `tokens.role.inkFaint`.
- **Rationale**: a second role for the page's fill, or for a pane's border, would leave a theme
  written before them with Catppuccin's page under its own text. One vocabulary from the file to the
  screen is what the colour themes decision asks.
- **If wrong**: the frozen React UI reads the same files. Its Catppuccin is built in, so it does not
  change; another theme's popovers and borders take the new `raised` and `rule` there until task 61.
- **Where**: `ROLES` in [`themes.rs`](/crates/core/src/themes.rs), the files of
  [`crates/core/themes/`](/crates/core/themes/), [`schemas/theme.json`](/schemas/theme.json),
  [`docs/web-ui.md`](/docs/web-ui.md), and the design language's "Roles this adds to a theme".

## R134: The mixing rule lives in Rust, and the tokens read it through `uraeda/native`

- **Decision**: [`crates/app/src/theme/`](/crates/app/src/theme/) is the one home of how colours are
  mixed (`colour.rs`: `mix`, `fade`, `over`, `contrast`) and of what the language mixes from a
  theme's roles (`mixing.rs`: glass's tint and its shares, a key's block, a well's shade, the
  grounds text sits on at each height, and the pairs the floors are measured on).
  - TSX reads them through four functions of `uraeda/native`: `mixColours`, `fadeColour`,
    `mixTheme(roles, mode)`, and `showTheme(roles, sans, mono)`. The tokens mix nothing themselves:
    `mix` and `alpha` of `app/ui/tokens/` are the first two.
  - `tests/theme.rs` reads `mixing::floors` for every shipped theme, which the core reads, a
    dev-dependency of the app's crate.
  - A theme's roles cross as a JSON object: NSH converts no map.
  - The core's own check of a user's theme, `contrast::warnings`, measures a role on a role, and
    gains `well` as a ground. What is mixed, glass first, is not in the core: the app's crate cannot
    be one of its dependencies, nor the reverse, since the app's crate is built for the browser too.
    The contrast formula is WCAG's, and is written in both.
  - `app/ui/tokens/defaults.json` holds the two default themes as the core reads them: the tokens
    draw them before the server answers, and take from them a role a theme lacks. A test of
    `tests/theme.rs` fails when it is stale, and writes it with `UPDATE_TOKENS=1`.
- **Rationale**: the task's test must compute what the tokens will mix, from one rule.
- **Alternatives considered**: a generated TypeScript file of every derived colour: a second file to
  keep fresh for each of the user's themes, which are read at run time.
- **If wrong**: the settings do not yet name a colour of a user's theme under the floor on glass:
  task 48 can call `mixing::floors` through one more function of the module.
- **Where**: `crates/app/src/theme.rs`, `crates/app/src/theme/`, `crates/app/tests/theme.rs`,
  `app/ui/tokens/{mix,source}.ts`.

## R135: What "text over glass" is measured on, and the values it changed

- **Decision**: the floors are measured on seven grounds: a well, a well in a well, a well in glass,
  a pane, a card, a bar of glass, and glass at `overlay`.
  - **Glass is measured over the busiest page a theme draws**: half its `ink` over its `page`, as
    the frost returns it, tinted as the shader tints it, with the tint's thickening. The light
    inside the glass, its sheen, its rim, and its grain, is not counted: R131's measure on the
    samples' pixels stays the check of the whole.
  - **Every text role is measured on the three fills**, `well`, `page`, and `raised`, and `rule`,
    `sub-agent`, and `marked` at 3:1 there. **On glass and on a well cut in another surface, the
    roles a bar, an overlay, or a field holds**: `ink`, `ink-quiet`, `ink-faint`, `action`,
    `needs-you`, `added`, `removed`, `caution`, `context`, `link`. Long prose never sits on glass,
    and a pane is never glass, so headings, quotes, and panes' titles are not measured there.
  - Also measured: a key's letter on its block, at rest and under the pointer, and `on-action` on
    `action` and on each mode's colour.
  - **Values that changed**: the light theme's glass is tinted with the raised fill, `#fbfbfd`,
    where it was the surface's: over the busiest page it is then as light as the page. A well cut in
    a well or in glass darkens it by 5% in a light theme, from 6%: Latte's green reached 4.46:1
    there. A key's block takes less of the key's colour, a hundredth at a time, until its letter
    reaches 4.5:1: at the language's 32% under the pointer, the letter fell under the floor in 18 of
    the shipped themes.
- **Rationale**: over white, Mocha's glass still passes, at 4.58:1 for its faintest text. Over
  black, no light theme's does: Latte's lowest was 4.07:1. A theme does not draw a black page.
- **If wrong**: a dark picture under light glass dims the text on it under the floor. The shader
  thickens the tint there by 20% of the whole: raising `thicken` in `mixing.rs` is the one value.
- **Where**: `mixing.rs`, `tests/theme.rs`, the design language's glass table.

## R136: The 26 other shipped themes take the new roles from their own colours, by one rule

- **Decision**: each shipped theme but the two defaults sets the new roles in its file, mixed once
  from its own colours, and marked "not published" there.
  - Dark: `backdrop` is its page at 57% over black, `well` 46% of its page over that. Light:
    `backdrop` is its page at 88% over its ink, `well` halfway, lighter by steps until every text
    role reaches the floor on it.
  - `raised` stays where the theme's own is a step above its page and meets the floors. Else it is
    its ink at 7% over its page, less by steps until the floors hold, or white at 75% over a light
    page.
  - `rule` moves toward the ink until it reaches 3:1 on the three fills, and `rule-quiet` is it at
    36% over the page, 44% in a light theme.
  - `glass-tint` is the well, or the raised fill in a light theme, moved away from the page until
    the floors hold on glass.
  - `light-focus` and the first wash are its `action`. `light-focus-2` and the second wash are the
    first of `context`, `changed`, `link`, `live`, and `example` that differs from it.
    `light-running` is its `example`.
  - `lip`, `shade`, and `glass-rim` come from the default of its mode.
  - GitHub Light's `fgColor-disabled-floor` and `fgColor-success-floor` are one more percent of
    lightness darker, `#616976` and `#187733`: they reached 4.46 and 4.49:1 on a well in glass.
- **Rationale**: a theme that inherited Catppuccin's backdrop and light would not be itself, and the
  colour themes decision asks a new role of every shipped theme at once. The rule ran once, as a
  test that wrote the files, and is not kept: the files are the record.
- **If wrong**: a theme whose published palette has a darker ground or a second accent of its own
  would look more like itself with them. Each is one line of its file.
- **Where**: [`crates/core/themes/`](/crates/core/themes/).

## R137: Fonts ship in the app's crate, Neon whole, and the others as the React UI shipped them

- **Decision**: the nine families of the React UI are bundled in
  [`crates/app/assets/fonts/`](/crates/app/assets/fonts/), each in a folder with its licence, the
  SIL Open Font License 1.1, and registered by `registry.assets(assets!())`. `bundledFonts()` of
  `uraeda/native` gives each family's name, read from its file when the crate compiles.
  - **Not as TSX imports**: NSH serves an imported file from the folder of the page's entry. A page
    with its entry in a subfolder, as the samples and later the gallery, asked for the font by an
    absolute path, and got a 404 on GTK. A crate's assets are served for every page.
  - **Sources**: Inter, Atkinson Hyperlegible Next, Literata, and JetBrains Mono are the variable
    Latin files of `@fontsource-variable/*` 5.3.0, upright and italic; Monaspace Argon, Krypton,
    Radon, and Xenon the Latin files of `@fontsource/monaspace-*` 5.3.0, in 400, 500, 600, 700, and
    400 italic: the packages `pnpm-lock.yaml` pins for `packages/web/`, copied from the main
    checkout's `node_modules`. Monaspace Neon is the five static faces of Monaspace 1.400, whole,
    from nixpkgs' `monaspace` in the Nix store. Nothing was downloaded.
  - **Why Neon whole**: the Latin files hold no `↵`, no box-drawing character, and no check mark,
    and on the hidden display a key's `↵` drew as nothing. Neon is the interface's default, and
    every other family is named with Neon after it, `JetBrains Mono, Monaspace Neon, monospace`, so
    what a family lacks is drawn by a bundled font on every machine.
  - **The five parts and their defaults are the React UI's**: `body` Neon, `heading` Xenon,
    `reading` Atkinson, `code` JetBrains Mono, `markdown` Neon. The samples named JetBrains Mono for
    everything, and drew in DejaVu.
- **If wrong**: Neon has no `➜`, `⌘`, `⌫`, or `⏎`: they come from the system's fonts. The fonts are
  3.2 MB in the repository, 1.8 MB of them Neon. Whole files of the other families need a download
  from each font's release, and a ruling naming it.
- **Where**: `crates/app/src/fonts.rs`, `app/ui/tokens/fonts.ts`.

## R138: The library keeps nothing: who shows a theme reads the device, and calls `applyTheme`

- **Decision**: `app/ui/theme.ts` holds `applyTheme(theme)`, `applyFonts(picked)`, and
  `pickTheme(themes, choice, scheme)`. They read no storage: `app/ui/` holds no data. The device's
  keys are three lines of `DeviceKeys`: `theme` (the mode, and the theme of each mode),
  `"theme.shown"` (the theme last shown, for the first frame), and `fonts`.
  - `tokens` is an object whose parts are read from a signal each time: a style, a memo, or an
    effect that reads `tokens.height.raised.fill` runs again when the theme changes. A component's
    body runs once, and must not keep a token in a constant.
  - `applyTheme` also gives NSH's own tokens, shadcn's, the theme's roles, through
    `element::set_tokens` in an `async` function of the module: NSH's text views, editors, and the
    system's menus follow, and `font-sans` and `font-mono` are the interface's and the code's fonts.
    It sets the app's appearance to the theme's mode.
  - Task 36 calls them: after `device.load()`, `applyFonts(device.get("fonts"))` and
    `applyTheme(device.get("theme.shown") ?? DEFAULT_THEMES.dark)`, then
    `applyTheme(pickTheme(themes, device.get("theme"), colorScheme()))` in an effect over the record
    `Themes`, keeping `"theme.shown"`. Task 48 writes the device's keys.
- **Rationale**: an extension's page imports `uraeda/ui` in an engine of its own, with no storage of
  the app's.
- **Where**: `app/ui/theme.ts`, `app/ui/tokens/index.ts`, `app/store/device.ts`.

## R139: The registry binds in Native Shell's keymap exactly the keys that work now

- **Decision**: `registerKey` is the only way a shortcut is declared, and `listenKeys`, in
  [`registry.tsx`](/app/ui/keys/registry.tsx), is the one caller of Native Shell's `keymap`. At any
  time it holds one binding for the first key of every shortcut that works now, and, while a
  sequence waits, one more set over them: every key that types, Backspace, Escape, and Ctrl+K.
- **What Native Shell gives for keys**, read in its source at the pin (`nsh-core/src/keymap.rs`,
  `nsh-js/src/keymap.rs`, `nsh-base/src/keys.rs`, `docs/dev/linux.md`) and run on GTK:
  - `keymap.bind(keystroke, handler, { when, repeat })`, one keystroke a binding, or a record of
    them in one call. The platform matches the key itself and takes it from everything else: the
    focused view, scrolling, Escape going back. The handler gets the keystroke's text, and nothing
    else: no target, no repeat flag, and no way to give the key back.
  - Among bindings of one keystroke, the newest that may fire wins. Native Shell's own controls (a
    tree, a slider, a select) bind their keys as they take the focus, so they win over a page's.
  - `when`: by default not in a text field for a key that edits text, `"notEditing"` never in one,
    `"always"` before the field. `repeat`: off, a held key fires once.
  - A key is named by the key of the US layout that types it without Shift: `?` is `shift+/`. GTK
    matches it on any layout. Ctrl+Q, Alt+F4, and F11 cannot be bound.
  - A binding made in a component or an effect is undone with it.
  - The focus: `focusable`, `onFocus`, `onBlur`, and a ref's `focus()`. On GTK a new field gets no
    focus by itself, `autoFocus` or not: the key map and the picker focus theirs.
  - An input's `onKeyPress` reports what was typed in it. `Overlay`'s `onCancel` is Escape and the
    phone's Back, when no binding took Escape.
  - The test driver presses real keys, `app.keyboard.press("shift+/")`, headless and on GTK.
- **What it does not give**: a sequence of keys (its parser refuses one by name), a handler for
  every key, the element a key was pressed on, and a key handed back after a handler declined it. At
  the pin `Input` is exported from `nsh/base`, where the website says `nsh`.
- **What follows**:
  - **A key is written as it is typed**, as the React registry's: `j`, `J`, `?`, `ArrowDown`,
    `mod+k`, `g h`. [`token.ts`](/app/ui/keys/token.ts) alone turns one into Native Shell's
    keystroke, and a key no keyboard gives fails as it is declared.
  - **Each key is bound once and left alone while it stays wanted**, so a control that bound its own
    keys after the page keeps them. Native Shell undoes an effect's bindings when it runs again,
    which would make every key the newest at each change: the effect only says what is wanted, and
    the bindings are made right after it, outside it.
  - **A text field gets its keys first**: every binding is `"notEditing"`. A layer's owner asks for
    a key around its own field with `inField`, as the picker's arrows and Enter, and a key that
    types can never ask.
  - **A held key runs again only where the binding says `repeat`**, as a key that moves. In the
    React UI every key repeated, a held `d` deleting row after row.
  - **A pending sequence hears the keys that type, not the named ones.** Enter or an arrow, pressed
    while a menu waits, goes to who has it, and the menu still waits: the React UI ended the
    sequence there, which needs a handler for every key. The menu shows 300 ms after the last key,
    so nothing waits unseen for longer.
  - **A bound key is taken even where its binding's guard refuses**, and a fallback is the only way
    on.
- **Rationale**: one listener is the keyboard decision's first rule, and the newest-wins rule makes
  how often a key is bound a behaviour, not a detail.
- **Alternatives considered**: binding every key that types at all times, with one handler: it takes
  Space and the letters from every control with keys of its own. Binding in the effect, as Native
  Shell's pages show: the registry's keys would take a focused control's at every change.
- **If wrong**: a key declared while a control with the same key has the focus is the newer one, and
  wins. Nothing built here does that.
- **Where**: [`registry.tsx`](/app/ui/keys/registry.tsx), [`token.ts`](/app/ui/keys/token.ts), and
  the tests of [`keys.test.ts`](/app/ui/keys/keys.test.ts) that open
  [`__checks__/keys.tsx`](/app/ui/keys/__checks__/keys.tsx).

## R140: The sequence matcher stays in TSX

- **Decision**: [`sequence.ts`](/app/ui/keys/sequence.ts), the state machine of the sequences, and
  [`store.ts`](/app/ui/keys/store.ts), which finds the keys that are on, are TSX, in the component
  library, not behind `uraeda/native`.
- **Measured** under `nsh test`, in the interpreter, over 66 bindings (25 single keys, 25 of the
  leader, 12 of `g`, 4 of a group), while other builds ran on the machine: one step of the machine,
  26.5 µs; a whole key, finding what is on and running it, 185 µs; binding and removing the 98 keys
  a pending sequence hears, 120 µs, without GTK's part; declaring the 66 keys at once, with every
  check, 9 ms.
- **Rationale**: it runs once a key press, over a few dozen rows, a fifth of a millisecond at the
  most. The plan keeps a key state machine out of a screen: this is a library file, which no screen
  holds, and a call into Rust for each key would cost a crossing to save microseconds.
- **If wrong**: a page that declares hundreds of keys pays for the checks as it mounts. They compare
  the keys before the scopes, so a key that shares nothing with another costs little.
- **Where**: `app/ui/keys/`.

## R141: A key is declared in a scope, and scopes say what is on together

- **Decision**: every key is in a scope, and five kinds of scope say when keys are on together.
  - **The shell**: the registry's own, for a key declared outside every `KeyScope`.
  - **A page** (the default): on while it is mounted.
  - **A pane**: on while its `on` says it has the focus. Two panes of one parent are never on
    together, so each has its own `j`, and a key of a pane may not be the page's too.
  - **A selection**: on while it holds. Its keys run before the page's and the shell's and may reuse
    them, as the keyboard decision allows, and its `run` returns `false` to give one back.
  - **A layer**: an open overlay. Only the newest open layer's keys are on, its own with the scopes
    in it: the page's and the shell's are off under it, and it may reuse any of them.
- **The rules**, each failing as the key is declared, in every build:
  - a key bound twice where both can be on, but for one fallback beside the key's own binding;
  - a key that is also the start of a sequence, a selection's included;
  - a key no keyboard gives, a sequence through a group [`groups.ts`](/app/ui/keys/groups.ts) does
    not name, a key that types asking for `inField`, a sequence asking for `repeat`, and a
    selection's fallback.
- **What changed from the React registry**:
  - A layer was found by reading the page (`dialog[open]`, `aria-expanded`), and its owner heard its
    own keys outside the registry, on an allowlist. A layer now declares itself, and its keys are
    the registry's.
  - The status line's hints under a layer are the layer's own, so `hintInLayer` is gone.
  - A guard, `when`, takes no target: Native Shell names none. A pane's `on` says where the focus
    is.
  - A control that keeps Space says so with `keepSpace(kept)`, where the page was asked
    (`[role="checkbox"]`).
  - No key is rebound by a setting or a device: the React UI had none.
- **Rationale**: the screens need a `j` per pane and a layer's own Escape, and a clash must fail
  where the key is written, not when two views happen to be shown.
- **Alternatives considered**: any `on` on any scope, with the clashes checked as scopes turn on:
  the failure would come at a key press in one state of one page, where a test may never go.
- **Where**: [`store.ts`](/app/ui/keys/store.ts), and `KeyScope`, `keyScope`, and `keepSpace` in
  [`registry.tsx`](/app/ui/keys/registry.tsx).

## R142: What task 32 built otherwise than its plan, and the seams it leaves

- **Decision**:
  - **More files than the five named**, each small: `token`, `sequence`, `store`, `leader`,
    `keyMap`, `pickerSearch`, `groups`, and `look` are `.ts`, with no view in them; `registry`,
    `LeaderMenu`, `KeyMap`, `KeyPicker`, `KeysHost`, and `parts` are `.tsx`.
  - **`KeysHost`** is mounted once around the app. It hears the keys, draws the leader's menu, and
    owns the key map with `?` and `Space ?`. The rest of the leader's tree is declared where its
    actions are: the places, Find, New, and the UI's keys by the app's shell.
  - **The picker is the component alone.** What it lists, and the one host that opens it over a
    kind, need records, which `app/ui/` does not hold.
  - **The structural test is Rust**, `no_file_but_the_registry_listens_for_a_key` in
    [`crates/app/tests/keys.rs`](/crates/app/tests/keys.rs): a test under `nsh test` reads no file
    unless `nsh.json` grants the app that right. A file whose keys are no shortcut, as the text
    field's own, adds its line to that test's list.
  - **The views are drawn with plain elements**, with every colour and size in
    [`look.ts`](/app/ui/keys/look.ts) and three parts in [`parts.tsx`](/app/ui/keys/parts.tsx), read
    from the samples' values. Marked `TASK 28:` there: `look()` reads `tokens`, `KeyCap` becomes
    `Kbd`, `Words` becomes `Text`, and `Panel` becomes `Overlay` or `Sheet`, which bring the glass
    and the motion out: a layer rises as it comes, and goes at once. No icon is drawn: the names are
    in the specs for `Icon`.
  - **Marked `TASK 30:`**: the key map's search and the picker's filter are Native Shell's `Input`
    until the shared text field exists.
  - **Marked `TASK 33:`**: `isNarrow` in `look.ts` becomes the layout shell's `width`.
  - **Not built**: the focus going back where it was as a layer closes. Native Shell does not say
    what has the focus, so the surface that opens a layer keeps it.
- **Rationale**: the tokens, the surfaces, and the controls were built beside this task, and one
  small file to switch is cheaper than a second look to keep.
- **Where**: `app/ui/keys/`, [`crates/app/tests/keys.rs`](/crates/app/tests/keys.rs).

## R143: A rewrite follows what is right, and its tests earn their place

- **Decision**: for this feature, a decision's rule, a guide, the old code, and the plan's own file
  lists are where a task starts, not a limit. A task departs from one when the result is a better
  screen or simpler, sounder code, and writes a ruling saying what it left and why. A direct request
  of the human, the constitution, and what protects the owner stay binding. Tests are kept for what
  they catch, run fast, and are fixed or removed when they do not. Implementers run on Opus 5.5 at
  medium effort from task 27 on.
- **Rationale**: the human ruled it on 2026-11-11: "this is a full rewrite, so make sure that the
  implementers have some freedom to do what they think is right to make a great UI and high code
  quality. While keeping development velocity of course, so make sure the tests stay decently fast
  and run smoothly, and actually pull their weight. Same goes for you. Decisions are more guidelines
  than rules for this rewrite." The earlier implementers used up the usage limit.
- **If wrong**: each departure is a ruling, so the final review reads them all in one place, and the
  human can send one back.
- **Where**: the plan's [global constraints](plan.md#global-constraints), and every task from 27 on.

## R144: A transcript is read by pages of 100 lines, and a reply grows by appends

- **Decision**: the sessions' records are cut so that a client subscribes to what it draws, and no
  event reads a turn again.
  - `Session { repo, id }` is what a session is, its status, and its turns' ids. It changes when a
    turn starts or ends, when its run's options or its sub-sessions change, never with an event of a
    reply.
  - `Turn { repo, id }` is a turn's state, what it does now, `activity`, its sub-agents at work,
    `subagents`, and `pages`, how many pages its transcript has. Its activity and its sub-agents are
    the manager's memory of the running turn, not a read of its log.
  - `TurnLog { repo, turn, page }` is one page: at most 100 items, `TURN_PAGE`. An item's `id` is
    the place in the log of the event that started it, a text, which never changes (R27).
  - **A piece of a reply is an `append`**: `store.append`, then
    `bus.append::<TurnLog>(&args, &["items", <id>, "text"], at, text)`, with the page and the text's
    first place kept in memory while the text is written. No read, of anything.
  - **A new line, and a line that changed otherwise**, a tool call that ended, a message read, a
    blocked action allowed, says `changed` for its own page: the engine reads that page, 100 lines
    at most, and sends the difference. A new page says `changed` for the `Turn`.
  - **A page is found through an index**: the store's schema is at step 2, where an event that
    starts a line says which one, `item`, from 0 in its turn. A page reads its own events, then the
    few later ones that changed a line of it: the messages' and the blocked actions' by their kind,
    through the new index by kind, the tool calls' ends until every call of the page ended, and the
    rest of a text still written as the page ended. The events already stored are numbered by the
    step itself, by the same rule.
  - A message taken back leaves its page, as in the Node server, and the 4,000 characters a tool's
    output and a thought are cut to are the page reader's (R70).
- **Rationale**: the UI draws a session of 20,000 messages and a long reply at 8.3 ms a frame. With
  the whole log in one record, each tool call would read and compare the turn. A page bounds the
  read whatever the turn's length, and a piece costs one row and one message.
- **How it was checked**: `a_streaming_reply_reaches_a_subscriber_as_appends` reads the raw changes:
  one `insert` for the first piece, then only `append`s at that line's text.
  `a_transcript_reads_by_pages_each_with_what_later_changed_its_lines` writes 102 lines over two
  pages, and `a_store_written_before_its_lines_were_numbered_reads_by_the_same_pages` takes the
  store back to schema 1 and opens it. Measured by hand, with the ignored test
  `a_long_reply_of_20000_pieces_streams_to_a_subscriber`: 20,000 pieces, from the agent to a
  subscriber that applied them all, in 5.7 s in a debug build, 280 µs a piece.
- **If wrong**: `PAGE` is one constant of `runner/page.rs`, with `TURN_PAGE` of the protocol. A
  session of thousands of turns lists as many ids in `Session.turns`: a page of turns is the same
  cut, one level up. The log's activities are stored, one row each, for a thought's time.
- **Where**: `crates/protocol/src/sessions.rs`, `crates/server/src/runner/{page,log,schema}.rs`,
  `runner/transcript.rs`, `records/sessions/turn.rs`. Tasks 43, 44, and 53.

## R145: The manager is plain functions behind one lock, and a process's events are a task's

- **Decision**: `runner::Runner::of(&shared)` is how every domain reaches the sessions. Its methods
  are plain functions, called on a blocking thread, as handlers are (R46, R97).
  - What it keeps in memory, the sessions in use, their processes, their turns, the continues'
    timers, is one `State` behind one lock, held for a few statements and never across a read of the
    core or a call of a runtime. A session's sends and turn starts take that session's own lock, one
    after another, and say `live::placed()` once they have it (R92).
  - A process's events are read by a task, which records each on a blocking thread, in order: a rule
    is asked of a runtime where tokio is, and a task ends with the runtime, where a thread blocked
    on a stream would hold a test's end for ever.
  - What follows a turn's end and may read git, the continuer's decision and the step chain, runs on
    a thread of its own, with the session's changes held until it decided, as the Node server held
    them: a run that waits to continue never reads as asking.
  - A timer is a task that waits, then acts on a blocking thread. A signal to a process is sent by
    the task itself.
  - `Runner::entered()` makes a thread one of the server's runtime: a start's landing, on the write
    queue's own thread, sends its first run there.
- **Rationale**: the Node manager was one thread, with awaits. Here nearly everything it calls
  blocks: the store, the core, a runtime. Futures all the way would box each of them.
- **If wrong**: an action that waits for a process to open holds a blocking thread for as long,
  bounded by the 20 seconds a closing process gets.
- **Where**: `crates/server/src/runner/{manager,live,processes,running,transcript,send}.rs`.

## R146: A queued workflow turn that starts as a chat has its log written again

- **Decision**: `Store::retype_queued` rewrites the log of a turn still queued: the one time a log
  changes, before its turn started. A workflow message queued behind a turn is checked again as it
  starts. When it no longer applies it runs as a chat: its message becomes the human's, with the
  chat's opening, in place of the workflow's line, and the line saying so follows it.
- **Rationale**: the Node store changed the two items in place. A log is only added to (R69), and a
  message's place before the line that explains it cannot be said by an event after both.
- **If wrong**: a turn that started is never rewritten: the statement changes nothing unless the
  turn is `queued`.
- **Where**: `crates/server/src/runner/{turns,send}.rs`.

## R147: A message to a feature waits for its queued commits, and is kept only for a start

- **Decision**: `session.send` to a change or a feature waits, in its call, until the commits queued
  for that folder landed: `records::writing::settled`. A commit refused meanwhile refuses the
  message, `The commit it waited for was refused.` A message sent to a feature whose start still
  lands is kept in memory, answered with its session and no turn, and sent once the start landed, as
  the start's last step.
- **Rationale**: the Node server kept both kinds, answered at once, and gave a message back through
  an `unsent` write of the queue when its commit was refused. A call that waits says the same with
  no second path: its answer is the refusal, and the composer still holds the text. A start is
  different: its folder cannot be read yet, and its page opens on the message.
- **If wrong**: a send behind slow hooks is answered as late as they run. It says `live::placed()`
  first, so its connection's next calls do not wait (R92). A kept message that cannot be sent once
  the start landed is printed, not returned: `QueuedWrite` has no `unsent`.
- **Where**: `crates/server/src/records/sessions/actions.rs`, `records/writing/queue.rs`,
  `records/features/starts.rs`, `runner/starts.rs`.

## R148: A write of a feature's files is refused where the queue takes it

- **Decision**: `Write` names the features whose files it writes: `Write::of_feature(folder)` by
  itself, a save with `.on_feature(folder)` or `.on_path(path)`. `records::writing::write` refuses
  it before its turn while a session of one of them has a turn running, starting, or queued,
  `An agent is working on this feature. Stop it first, or wait for it.` The uploads ask the same
  function, the Git page's guard asks the sessions for the chats and the folders at work, and
  `repositories.remove` is refused while any session of the repository works.
- **Rationale**: R65 left one check before each `write`. In the queue it is one rule, and a handler
  only says what it writes. A write of its own, `land`, is not checked: a start, a review's
  findings, and a promotion land while their own agent works, or hold their folder themselves.
- **Where**: `crates/server/src/records/writing/{queue,text,buffer,undo,rounds,review}.rs`,
  `files/attach.rs`, `records/git/working.rs`, `records/workspace/repositories.rs`.

## R149: The runtimes are checked as the server starts, every minute, and a second after a change

- **Decision**: `runner::serve`, the last of `DOMAINS`, starts the manager: the turns a server left
  running or queued are stopped, `Stopped: the server stopped while it ran.`, the agents' tools are
  given to `/mcp`, the chat images no message holds are cleaned, every runtime is asked its version,
  the continues are armed, and the pull requests behind the default branch are caught up. The check
  runs again every 60 seconds, and one second after a runtime registered, left, or was turned on or
  off: one that came back continues the runs a restart cut.
- **Rationale**: an extension's runtime registers after the start, in the background (R225), and a
  session on it would be refused as not available until the next minute's check. The second's wait
  leaves whoever registered it the first check, as the registry's own tests do.
- **A test of the registry changed with it**: `a_runtimes_status_and_models_follow_what_it_answers`
  asserted that a runtime it had just registered was not asked yet, and that its own check was the
  one to find it. On a server whose sessions check too, both depend on which thread ran first: it
  failed once in three full runs. It now reads each check's outcome from the status alone.
- **If wrong**: `CHECK_EVERY` and `CHECK_AFTER_CHANGE` are in `runner/mod.rs`.
- **Where**: `crates/server/src/runner/{mod,manager}.rs`, `crates/server/src/lib.rs`.

## R150: What the sessions' actions answer, and where a turn's live facts are

- **Decision**: the shapes, where fate's did not carry over (R52, R63).
  - `session.send` answers `{ session, turn }`, the session it went to, which a workflow run's may
    have been made for it, and no turn for a message kept for a start. `session.new` and
    `session.newChat` answer `{ session }`, `session.toChange` `{ folder }`, `session.allow` and
    `session.allowAll` `{ turn }`, and the others nothing. `feature.continueAll` takes `{ repo }`
    and answers `ContinuedAll { refused }`.
  - `session.allow` names a blocked action by its item's `id`, `denial`, in its `turn`.
  - `Agent { repo }` takes a repository's name, or none: `isOn` is for that repository.
  - The sub-agents of a running turn are on `Turn`, with their calls so far, and a row of
    `SessionList` has their count: fate sent them on the session, read from the log at each event.
  - `Feature` gains `agent` and `tokens`, and its `status` follows its sessions first, as the
    workspace's features and `NeedsYouList` do, which also lists the chats refused an action.
  - A time is a number of milliseconds since 1970, but `Wait.at`, already RFC 3339.
- **Where**: `crates/protocol/src/sessions.rs`, `crates/server/src/records/sessions/`. Tasks 43, 44,
  37, and 50.

## R151: The agents' tools are futures over the manager, and a review's findings land in the queue

- **Decision**: `runner::reviews::Tools` is the `mcp::Runner` (R76). `run_agent` and `review` start
  their sub-sessions on blocking threads, then wait for them as futures: a call dropped gives the
  wait up, and leaves the sub-session working, as the Node server's abort did. A parent's turn that
  halts stops its sub-sessions and ends its calls. A command reviewer is a `runtimes::Child`, ended
  when its review is dropped. The findings are written as a write of the queue,
  `Committing a review's findings`, and the tool answers once their commit landed: a hook's refusal
  answers `not committed:` with what it printed, and the same review asked again writes them again
  without running a reviewer.
- **Where**: `crates/server/src/runner/{sub_sessions,reviews}.rs`.

## R152: A start has a third step, its agent's, and three tests say what the sessions made true

- **Decision**: a start's write shows `Start the agent with your message` after its branch: a
  change's first run is sent there, to a session made for it, and a feature's kept messages. A
  change from a note sends its first run after the note left the inbox, outside the step. Three
  tests of earlier tasks were changed with it, each failing because of what this task was asked to
  build:
  - `a_start_answers_once_planned_and_lands_in_the_queue_with_its_steps` lists the third step.
  - `a_tool_the_sessions_have_not_filled_answers_a_clear_error` is now
    `a_tool_called_for_no_workflow_session_answers_a_clear_error`: on a started server the tools are
    always filled.
  - `recommended_message_answers_its_shape` registers the fake runtime: a message is recommended
    only to an agent that takes it.
- **Where**: `crates/server/src/records/features/starts/`, `crates/server/tests/{mcp,features}`.

## R153: What the sessions leave to later tasks

- **Decision**: built, and not exercised by a test of the server, since nothing gives their input
  yet, or left as named:
  - **The catcher** runs on each change of a repository's files, each feature's turn that ends done,
    and each change of the settings. It reads the pull requests the core last knew: until `pulls.ts`
    is ported, no feature is at `catch-up`, and it sends nothing.
  - **The step chain** starts the next step's run as a step's run ends done. The fixture has no step
    an agent's run moves on from.
  - **A preview's warm-up** starts the preview of a folder that waits for the human with a story, as
    a turn ends done and as the server starts (R83). Its linked stories still compile at their first
    read: `preview/warm.rs` keeps the mark for task 51.
  - **A kept message that cannot be sent**, and run options that cannot be kept for a started
    change, are printed. The Node server gave the first back to the composer, and sent the second's
    first run on the options' own pick.
  - `a_repositorys_events_reach_the_extensions_that_listen` timed out once in a full run while other
    builds ran, and passed alone and in the two runs after.
- **Where**: `crates/server/src/runner/{catch_ups,chain}.rs`, `crates/server/src/preview/mod.rs`.
  Tasks 20, 51, and the fixer of the pull requests' refresh.

## R154: The reading size is 15 px on a 24 px line, and every step of the scale moves up one

- **Decision**: the human found the samples' text too small on GTK, and asked on 2026-11-11: "Change
  the design language's reading size from 13 to 15 px monospace, with a 24 px line, and the step
  under from 12 to 13. Prose and titles scale up one step with it." The scale was 12, 13, 15, and 18
  px. It is 13, 15, 18, and 22 px, and each name takes the step above the one it had.
  - **Asked**: `type.size` 13 to 15, `type.line` 20 to 24, `type.under` 12 to 13.
  - **One step up**: `type.over` 15 to 18, and `type.prose` 15 to 18: prose was the step over the
    reading size, and still is.
  - **Picked, `type.over2`: 18 to 22.** The scale had no step above 18. Its last ratio was 18 to 15,
    1.2, and 18 times 1.2 is 21.6.
  - **Picked, `type.proseLine`: 24 to 28.** Prose's line was 1.6 of its size, which the human's 24
    px line is of 15 px: 1.6 of 18 is 28.8. 28 over 29, since the [reading](/specs/ui/reading.md)
    guide found 1.5 and more "too spaced".
  - **Heights that hold one line follow it**, each with the room it had round the line: `space.row`
    24 to 28 (2 px over and under), `status.height` 26 to 30 (2 px, and two 1 px rims),
    `button.height` 28 to 32 (3 px, and two 1 px edges), `pane.titleHeight` 22 to 26, and
    `pane.titleRise` 12 to 14, the same share of the title above the pane's edge.
  - **A key**: `key.size` 19 to 22 and `key.padding` 5 to 6. Its block was a line less 1 px, and is
    a line less 2: even, so it sits on whole pixels in a line, a row, and a bar, and its letter is
    `type.under`.
  - **Not changed**: every gap and padding beside a text, `pane.titlePadding`, `status.padding`,
    `button.padding`, `space.panePadding`, and the gap between panes: none holds a line.
  - **The language now writes the sizes**, in "Type": it named the steps without their values, and
    only a pane title's rise, 12 px, now 14.
  - **In the samples**, what held a line reads it from the tokens: a pane's top padding, the caret,
    a badge, a field, the bar over the transcript, the dialog's plate, the composer. An icon is 16
    px, from 14. The session's right column is 400 px, from 350, where a row's actions were cut; two
    fields' words and two lines of the transcript's code are shorter.
  - **The browser mockup has the same values.** No recipe draws it, so it was not looked at again:
    its panes have fixed widths, which the larger text may overflow.
- **Rationale**: the pictures of `just samples-shots`, in both themes: nothing is cut, no row's text
  touches its edge, and the status line and the panes' titles hold their text with the same room as
  before.
- **If wrong**: the reading guide says "lines are 1.4 high everywhere", which was already not the
  language's 24 px for 15 px prose. 1.4 of 18 px is 25 px: `type.proseLine` is the one value. A
  title two steps over at 21 px is `type.over2`.
- **Where**: [`design-language.md`](/specs/ui/design-language.md), "Type" and "Panes, titles, and
  light"; [`app/ui/tokens/`](/app/ui/tokens/) `type.ts`, `space.ts`, `button.ts`, `height.ts`;
  [`app/gallery/samples/`](/app/gallery/samples/); the [mockup](mockups/design-language.html).

## R155: The keys' views read the tokens now, not at task 28

- **Decision**: `look()` of [`app/ui/keys/look.ts`](/app/ui/keys/look.ts) reads `tokens`, where it
  read the samples' `values.ts`. Its colours are the theme's roles: `action`, `rule`, `rule-quiet`,
  `ink`, `ink-quiet`, and `raised`, and its font is `tokens.type.body`.
- **Rationale**: task 26 lifted `values.ts` into the tokens and removed it, and task 32, built
  beside it, still imported it: once both were merged, `just app-check` failed with "Cannot find
  module '../../gallery/samples/values'", and so did `just task-app` for every later task.
  [R142](#r142-what-task-32-built-otherwise-than-its-plan-and-the-seams-it-leaves) left the switch
  to task 28: it is one file, and the build cannot wait for it.
- **If wrong**: the views follow the theme `applyTheme` shows, where they followed the system's
  colour scheme. Until task 36 calls it, that is the default dark theme.
- **Where**: `app/ui/keys/look.ts`. The rest of the seam, `TASK 28:` in `parts.tsx`, stays.

## R156: The bundled fonts are the ones drawn on GTK, from the app's files alone, and a check says so

- **Decision**: `the_bundled_fonts_are_the_ones_drawn`, the sixth check of
  [`crates/app/tests/outside.rs`](/crates/app/tests/outside.rs), reads in what GTK draws the font of
  a line of text in each part's token (`tokens.type.body`, `heading`, `reading`, `code`, `markdown`)
  and in each of the nine bundled fonts, and fails when one is not the family the line names first.
  Nothing was wrong: the fonts task 26 registered are the ones drawn.
  - **How Native Shell finds a font on GTK**, read in `nsh-platform-linux` 0.4.0, `text.rs`: Pango
    over Fontconfig. The engine registers each font file a UI set's crate ships, before anything is
    measured: it unpacks a WOFF2 file, writes it in the user's cache folder, `nsh/fonts/`, loads a
    Fontconfig configuration of its own from the system's, adds the files to it as the app's fonts
    (`FcConfigAppFontAddFile`), and gives it to its font map. The engine's thread lays the text out
    with that map, and keeps for each run of glyphs the description of the font the layout chose, a
    fallback included. GTK's thread gives its own font map the same files, loads each run's font by
    that description, and draws the run as a text node.
  - **So a registered font needs nothing of the machine**: neither `FONTCONFIG_FILE` nor an
    installed font. The dev shell's fonts hold only DejaVu, and all nine families are drawn there.
  - **What the human saw**: the samples of task 25 named JetBrains Mono and Atkinson Hyperlegible
    before any font was bundled, and drew DejaVu, as
    [R137](#r137-fonts-ship-in-the-apps-crate-neon-whole-and-the-others-as-the-react-ui-shipped-them)
    says. Since task 26 they read the tokens.
  - **How the check tells a fallback**: it serialises the window's render nodes, and reads each text
    node's font, which is the face on screen. Each line has a colour of its own, by which the check
    finds it. Before the lines are drawn, it asks GTK's font map for each family: if the display's
    own fonts hold one, the check fails, since it could not tell the app's file from the machine's.
    That also fails a dev shell to which someone adds the fonts.
  - **It runs the app's module as the app's runner does**: `uraeda_app::registry()` beside
    `nsh_base::registry()`, and the crate's `assets/` under `@uraeda-app/`, as a package holds them.
- **Seen failing**: with `registry.assets(assets!())` removed, every line: "tokens.type.code names
  JetBrains Mono, and is drawn in {"DejaVu Sans Mono"}", and "DejaVu Sans" and "DejaVu Serif" for
  the proportional ones. With the token naming a family that is not bundled, "JetBrains Mono NL":
  "code's font is JetBrains Mono until another is picked".
- **Alternatives considered**: comparing a line's width with the font file's advances: JetBrains
  Mono's is 600 of 1000, DejaVu Sans Mono's 602, and most monospace fonts' 600.
- **If wrong**: GTK's text form of a node is not a stable format. `gsk::TextNode::font()` gives the
  same font, at the cost of walking every kind of node.
- **Where**: `crates/app/tests/outside.rs`, `crates/app/tests/outside/fonts.rs`,
  [`app/__checks__/fonts.tsx`](/app/__checks__/fonts.tsx).

## R157: A shader is a string in a `.wgsl.ts` module

- **Decision**: the surfaces' shaders are `glass.wgsl.ts`, `glow.wgsl.ts`, `backdrop.wgsl.ts`, and
  `hash.wgsl.ts`, which the first three share: each exports its WGSL as a string. The plan named
  `glass.wgsl`.
- **Rationale**: Native Shell's bundler reads every import as JavaScript. A page that imported
  `./a.wgsl` failed to build, with `PARSE_ERROR` at the shader's first line, and the bundler has no
  loader for text.
- **Where**: [`app/ui/surfaces/`](/app/ui/surfaces/). The samples' `shaders.ts` is gone: the samples
  draw with the components.

## R158: A surface is one view, with layers only where something stands on its edge

- **Decision**: `Surface` is one view with its height's fill, border, lip, and shadow. It gains
  layers, absolute children under what it holds, only for what one view cannot draw.
  - **Glass is a layer behind what the surface holds**, not their container: a raised surface that
    becomes glass as content scrolls under it keeps what it holds, where a change of container would
    make it anew. The surface's own border is then transparent, and the shader draws the rim.
  - **The edge is a layer where something stands on it**: a title's tab, the focus's light, a run's
    line. On GTK a view's border is painted over what the view holds: with the border on the surface
    itself, the pane's edge ran through its title's letters, and over the focus's outline and the
    run's line, which read dull. Seen in the samples' picture of the panes.
  - **The focus's light is `Lit`**, drawn for a `standard` surface only: the glow's shader, the fill
    again over it, and the four lines of ruling R130. It fades in and out over `light.glide`, and is
    not drawn at rest. A `recessed` surface with the focus takes its tone on its border, with a
    `boxShadow` from `tokens.height.recessed.glow`, as the samples' field did.
  - **A run's line is `RunLine`**: it is drawn from left to right as `running` turns true, and turns
    green and fades as it turns false. One that is there as its surface appears does not move.
    `light.running.motion` at `breathe` loops its opacity, and at `off` draws none.
  - **`tab`** is what stands on the top edge: at `standard` and `raised` a pane's title, which the
    edge goes around, and at `overlay` the plate of an overlay's title. The plate's line of light is
    a token, `tokens.glass.plateLip`, added for it.
  - **A raised surface's glass takes `rule` under its rim**, its height's border. The samples' bar
    over the transcript drew `rule-quiet` there, and their status line `rule`.
- **Rationale**: most surfaces are rows, cards, and fields, many on a screen: each is one view. The
  layers cost a view each where a pane has a title or the focus.
- **If wrong**: a platform that paints a border under what a view holds draws the edge twice at the
  same place, in the same colour, which shows nothing.
- **Where**: [`Surface.tsx`](/app/ui/surfaces/Surface.tsx),
  [`light.tsx`](/app/ui/surfaces/light.tsx), and the line added to the NSH section of
  [`AGENTS.md`](/AGENTS.md).

## R159: An overlay's keys are the registry's, and the focus is kept in a ledger

- **Decision**: every overlay is Native Shell's `Overlay`, through one component, `Float`. Its keys
  are a layer of the key registry, and what has the focus is kept by the library, in
  [`focus.ts`](/app/ui/surfaces/focus.ts).
  - **What Native Shell gives**, read at the pin and run: a view hears `onFocus` and `onBlur`, and a
    ref has `focus()`, but nothing says which view has the focus. On GTK only a field takes the
    keyboard focus: a view never does (`view.rs`, "Views never take keyboard focus themselves").
    `nsh/base`'s `Dialog` keeps Tab in itself and gives the focus back on GTK (`navigation.rs`,
    `scope_focus`), but the headless runner does neither, and the GTK test driver cannot press Tab
    (`agent.rs`, `press_keys`), so neither behaviour could be tested there.
  - **`focusStop(node, { first? })`** is what a field or a control that takes the focus calls as it
    renders: it answers the `onFocus` and `onBlur` to set on its element. The ledger then knows
    which stop has the focus, and an overlay's stops in the order they were made.
  - **As an overlay that takes the keys opens**, it remembers the stop that had the focus, takes the
    focus off the page with `Keyboard.dismiss()`, so a field typed in stops taking the keys, and
    puts it on its stop marked `first`, else its first. **As it closes**, its own field loses the
    focus at once, and the stop remembered gets it back, unless who closed it sent the focus to a
    stop outside it meanwhile.
  - **A dialog and a sheet keep Tab**: `Tab` and `Shift+Tab` are keys of their layer, heard in a
    field too, which move the focus among the overlay's own stops, around from the last. With no
    stop they do nothing, so Tab never reaches the page.
  - **Escape is the layer's key**, declared by `Float` with its hint, `esc close`. The phone's Back
    is Native Shell's `onCancel`, and a press outside its `onPressOutside`, or the scrim's press.
  - **A toast, a tip, and the corner's overlay take neither the keys nor the focus.**
- **Rationale**: one mechanism on every platform, which the two tests of the task run without a
  display. Each was seen to fail with its behaviour taken out:
  `expected ["page: one"] to contain "page: oney"` without the giving back, and
  `expected [..."first: a","second: "] to contain "second: a"` without the trap.
- **Alternatives considered**: `nsh/base`'s `Dialog` for what dims the page. Its trap and its return
  of the focus are native on GTK, but its layer is the platform's own, its Escape is decided
  natively, before the registry, and nothing of it runs headless.
- **If wrong**: a field that does not call `focusStop` is not given the focus back, and is not a
  stop of Tab in a dialog. The text field (task 30) and the controls (task 28) call it; the key
  map's search and the picker's filter, Native Shell's `Input` until task 30, do.
- **Where**: [`Float.tsx`](/app/ui/surfaces/Float.tsx), [`focus.ts`](/app/ui/surfaces/focus.ts),
  [`surfaces.test.tsx`](/app/ui/surfaces/surfaces.test.tsx).

## R160: An overlay is shown by `open`, and stays drawn for its way out

- **Decision**: each overlay takes `open`, true unless given. It comes in as `open` turns true, or
  as it appears open, and it stays drawn for `motion.out` after `open` turns false, while its layer
  and the focus go back at once: a key pressed right after Escape is the page's.
  - In: it fades in and rises `motion.rise`, over `motion.in`. Out: it fades and sinks back, over
    `motion.out`. With reduced motion it only fades. Behind one that dims the page, the dim fades
    with it.
  - **Values the language does not give, taken here**: a sheet rises four times `motion.rise`; a
    toast drops in from `motion.rise` above; a tip rises half of it, after the pointer rested 600
    ms; a popover keeps 4 points from its anchor and 8 from the window's edges; a sheet and the
    corner's overlay keep 8 points from the window's edges; a dialog is 520 points wide unless told.
  - **Task 32's views float in `Overlay`**: the leader's menu at `corner`, the key map and the
    picker at `middle`, each with its title on the plate. Their `Panel` is gone, and `look.ts` reads
    `tokens`: it read the samples' `values.ts`, which task 26 removed, so the app's types did not
    check as merged. `KeyMap` and `KeyPicker` take `open`, and their search and state are made anew
    at each opening. `KeysHost` keeps the key map mounted, so it goes with its motion. The marks
    `TASK 28:` there now name `Kbd`, `Text`, and `Icon` only.
- **Rationale**: the design language asks that nothing jumps, in or out, and the keyboard decision
  that a key means what the screen shows.
- **If wrong**: an owner that takes an overlay out of the view, in place of turning `open` false,
  sees it go at once. The focus still goes back.
- **Where**: [`presence.ts`](/app/ui/surfaces/presence.ts),
  [`Float.tsx`](/app/ui/surfaces/Float.tsx), [`app/ui/keys/`](/app/ui/keys/).

## R161: What the surfaces draw otherwise than the language, and what was not run

- **Decision**:
  - **A pane's title is drawn at `wrap` only.** The token `pane.title` also names `tab` and
    `border`, the two places the language says were tried and left: `Pane` does not draw them.
  - **Toasts stack from the window's top right**, across its top on a narrow window, as the design
    language says. [Surfaces](/specs/ui/surfaces.md) puts the commit toast at the bottom right, over
    the status line: task 50 places it, with `Overlay` at `corner` if it stays there.
  - **`Overlay` has two places**, `middle` and `corner`. The theme picker's, alone at the page's top
    with no scrim, is a `Popover` on a point until task 48 asks for more.
  - **`Backdrop`** is a component of the surfaces, with its shader: the layout shell (task 33) draws
    it under the panes.
  - **Glass where the platform has a blur** is `backdropFilter` with the tint, and
    `glassEffect: "regular"` for Apple's own. It was drawn on no platform here: only the headless
    runner, which draws nothing, takes that branch.
- **If wrong**: `tab` and `border` are a dozen lines of `Pane` each, the title's place and the
  glow's shape.
- **Where**: [`Pane.tsx`](/app/ui/surfaces/Pane.tsx), [`Toast.tsx`](/app/ui/surfaces/Toast.tsx),
  [`Glass.tsx`](/app/ui/surfaces/Glass.tsx).

## R162: The frames of glass as `Surface` draws it, and the pictures

- **Decision**: no part of the glass recipe was dropped.
  - **Measured** with `just samples-frames`, the bar of glass, now a raised `Surface`, over the
    transcript of 20,000 rows that scrolls 900 points a frame, for 30 s, on the hidden display,
    which draws in software (ruling R131), with the machine's load between 3 and 6: 1,860 frames at
    60 a second, 5.49 ms a frame on average, the 95th percentile of each second between 5.82 and
    7.06 ms, and three seconds with a frame over 8.3 ms, the worst 10.73 ms as the scroll starts. So
    the 99th percentile is under 8.3 ms. The same scroll with no bar: 4.41 ms on average.
  - A first run, while other builds loaded the machine to between 9 and 17: 5.74 ms on average with
    the bar, 5.03 ms without, and frames up to 14.97 ms in four seconds of it. The run with no bar
    had frames of 81 ms then: the machine's, not the glass's.
  - **The pictures**: `just samples-shots` draws the samples with the components, and they read as
    task 25's did. `just gallery-shots` draws the pages of `app/gallery/surfaces/`: every height in
    every other, the states of a well, a card, a bar, and a pane, and each overlay open over a busy
    page, in both themes, 1400 and 390 points wide, in `target/shots/gallery/`.
- **If wrong**: the bar costs about 1 ms a frame here, where ruling R131 measured 0.3 ms: the two
  runs differ by more than that between themselves, and no measure on a GPU was taken.
- **Where**: [`frames.test.tsx`](/app/gallery/samples/frames.test.tsx),
  [`gallery.test.tsx`](/app/gallery/surfaces/gallery.test.tsx), the [`justfile`](/justfile).

## R163: The frame is panes in two stacks, and a screen declares its panes

- **Decision**: task 33 builds the layout as data: panes, each a kind and its arguments, in two
  stacks, main and side, shown as tabs or split. A screen declares its panes and their default
  stacks, and the shell draws them. Task 66, new, adds the moves: a pane sent to the other stack,
  tabs, the side stack as a full pane, zoom, and a layout kept per device.
- **Rationale**: the human asked for it on 2026-11-11: "a clear concept of panes, tabs, and
  sidebar", moved as in a tiling window manager, "with two stacks (the center column + right
  sidebar)". No screen was built yet, so the model costs the screens' tasks nothing now, and would
  cost every one of them later. Zed, VS Code, and Kiro each showed a part: panels that say where
  they may sit, a stored location per view with a reset, and a pane as a view of a thing that holds
  no state.
- **Alternatives considered**: a free tree of splits, as i3 has: every layout possible, and every
  screen must then draw at any size. Two stacks keep a main subject and what goes with it, which is
  what each place of the app is.
- **If wrong**: the moves are one task, 66, which can go without touching the model. The human said
  they did not need the moves in this feature: the task is in because the screens are being written
  now, and it is theirs to drop.
- **Where**: tasks 33 and 66, the screens' shared rule, and the guide `specs/ui/panes.md`, which
  task 33 writes.

## R164: Icons are Lucide's and Codicons' shapes, kept in the repository, drawn as one SVG each

- **Decision**: `Icon` takes a Lucide name, `file-text`, or a harness's mark, `claude`, `openai`,
  `pi`. The shapes are tables of TSX in [`app/ui/controls/icons/`](/app/ui/controls/icons/):
  `lucide.ts`, each icon as the elements inside its SVG, and `marks.ts`. `Icon` makes an SVG of the
  name in its colour and size, and draws it with an `<Image>`, which takes no CSS variable.
  - **Where they come from**: the 120 Lucide icons the React UI uses, its controls need, or Astryx
    drew for it, read once from `lucide-react` 1.55.0, the package `pnpm-lock.yaml` pinned for
    `packages/web/`, in the main checkout's `node_modules`, unchanged. Lucide is under the ISC
    licence, the icons it took from Feather under MIT; Codicons' two marks under CC BY 4.0, copied
    from `packages/web/src/theme/icons.ts`; Pi's mark is Uraeda's, on Lucide's grid. The licences
    are in [`LICENSES.md`](/app/ui/controls/icons/LICENSES.md). Nothing is loaded at run or build
    time.
  - **To add one**: "Copy SVG" on lucide.dev, and one line in `lucide.ts`, in order, with what is
    between `<svg>` and `</svg>`. The generator that read `lucide-react` ran once and is not kept:
    the package goes with the React UI (task 61), and the table is the record.
  - **Names are Lucide's**, not the React UI's `uraeda:*`: which icon stands for a workflow step or
    a decision's strength is the screen's word, not the library's. `iconNamed(name, fallback)` gives
    a name read at run time, a decision's frontmatter's, or `file-text`; `isIconName` says whether
    the app carries one, as the key map does before it draws a key's icon.
  - Lucide's own round caps and joins are kept: the language squares the corners of what Uraeda
    draws, and an icon is Lucide's drawing.
- **Rationale**: the app has no npm package (ruling R123); a table of strings costs 19 KB and no
  build step.
- **If wrong**: an icon's picture is made anew for each colour. A page of hundreds of icons in many
  colours decodes as many pictures: a cache by name, colour, and size is a few lines.
- **Where**: [`Icon.tsx`](/app/ui/controls/Icon.tsx), `app/ui/controls/icons/`, the gallery's page
  `icons`.

## R165: On GTK the focus ledger is a control's focus, and Enter or Space in a dialog presses it

- **Decision**: on GTK a view never takes the platform's focus (`view.rs`: "Views never take
  keyboard focus themselves"), so a button, a switch, or a select cannot be reached by Tab there.
  The focus ledger of [`focus.ts`](/app/ui/surfaces/focus.ts) becomes the focus of the controls:
  - its stop that has the focus is a signal, and `focusStop` answers `focused`, which a control
    draws as its ring;
  - a stop says when it is `disabled`, which Tab and an overlay's first focus pass, and what Enter
    and Space do on it, `press`;
  - a control's `focus()` takes the focus off any field (`Keyboard.dismiss()`), asks the platform
    for it where it gives views one, and marks itself in the ledger;
  - a dialog's and a sheet's layer declares Enter and Space as fallbacks that press the control with
    the focus: a field's own Enter and an overlay's own keys come first. `press.ts` is the one home
    of this for every control, with the states' looks: hover and pressed are the platform's
    `hoverStyle` and `activeStyle` of `nsh/base`'s parts, so the pointer costs no render; the focus
    is drawn from the ledger, and from `focusStyle` where the platform focuses.
- **Not built**: a Tab order through a page's controls outside an overlay. On a page the keys go
  through the registry, as the screens declare them; a form that wants Tab on a page wraps its
  controls in the same ledger as a dialog (`StopsContext`, and Float's `LayerKeys` keys).
- **Rationale**: the tests run headless, where only the ledger is the app's; and a control that
  draws its focus from one place draws it the same on every platform.
- **Seen failing**: without the control marking itself as it takes the focus, "a select picks by
  keyboard, and gives the focus back" failed, Enter in the dialog opening nothing; with Tab not
  passing a disabled stop, "a disabled control takes neither a tap nor the focus" failed, "Kept: 1"
  never shown.
- **Where**: `app/ui/surfaces/focus.ts`, `Float.tsx`, `app/ui/controls/press.ts`.

## R166: A value the server keeps is `sent`, and its refusal is under the control

- **Decision**: a control that takes a value, `Switch`, `Checkbox`, `Radio`, `Segmented`, `Select`,
  takes `value`, `onChange`, `pending`, and `refusal`, and draws `Under`: its refusal with a mark in
  the removed role, or its `hint`. `sent(truth, send)` in [`sent.ts`](/app/ui/controls/sent.ts) is
  what a form gives it: the value set last shows at once, changes go to the server one after
  another, in order, and a refusal (`send` throws, its message the words) puts back the server's
  value unless a later change stands over it. A value the server normalises replaces the one shown
  once the change landed.
- **Rationale**: "a control moves the moment it is touched; a refusal puts it back and says why
  under it" is the human's, and was sent back until every form did it the same way.
- **Seen failing**: without the putting back, "a refused switch goes back, and says why under
  itself" failed with `["Night: on", ...] to contain "Night: off"`.
- **Where**: `sent.ts`, `Under.tsx`, the controls that take a value.

## R167: A button's key is declared by the button, and a picture of a state takes nothing

- **Decision**: `keys` on `Button` and `IconButton` shows the key as a `Kbd` and declares it in the
  key registry, with the button's label, where the button is mounted, off while it is disabled. The
  key shown is the key that works, and the key map and the status line list it. A control drawn in a
  `state` for the gallery takes no press, no focus, and declares no key: a page of pictures shows
  one key in many states without a clash.
- **Rationale**: a key written on a button and declared elsewhere drifts from it, which the keyboard
  decision was made against.
- **If wrong**: a screen that mounts the same button twice where both are on fails as it renders,
  with the registry's "bound twice": it gives the key to one of them.
- **Where**: [`Button.tsx`](/app/ui/controls/Button.tsx), `IconButton.tsx`.

## R168: The controls, against the Astryx components the React UI imports

- **Decision**: one control for each Astryx component of `packages/web/` that is a control, mark, or
  line of words: `Button`, `IconButton`, `ToggleButton` (a `Button` that is `selected`), `Switch`,
  `SegmentedControl` (`Segmented`), `Selector` (`Select`), `CheckboxInput` (`Checkbox`),
  `NumberInput`, `Badge`, `Banner`, `Spinner`, `ProgressBar` (`Progress`), `StatusDot`, `Kbd`,
  `TabList` and `Tab` (`Tabs`), `DropdownMenu` and `MoreMenu` (`Menu`), `Breadcrumbs`, `Divider`,
  `Icon`, `Link`, `Heading`, `Text`, `Code` (`Text` with `font="code"`), and `FieldStatus`
  (`Under`). `Radio` is built though the React UI imports none: settings choose one of a few options
  with words of their own.
  - **Built elsewhere**: `Dialog`, `BottomSheet`, `Tooltip`, and the toasts are the surfaces' (task
    27); `List`, `ListItem`, `CheckboxList`, `Card`, `SelectableCard`, and `Table` the lists' (29);
    `TextInput`, `Field`, and the chat's composer the text field's (30) and the sessions';
    `Markdown`, `CodeBlock`, and `Blockquote` the document renderer's (31); `CommandPalette` the
    keys' picker (32); `Layout`, `SideNavItem`, `ResizeHandle`, and `Collapsible` the layout shell's
    (33).
  - **Not built**: `HStack`, `VStack`, and `Grid`, which are a `View`'s style; `VisuallyHidden`,
    which is `accessibilityLabel`; `Thumbnail`, an image, for the screens that show one.
  - **`Select` and `Menu` are not `nsh/base`'s**: those open the platform's own popup, decide Escape
    natively, before the registry, and a menu becomes a sheet on a phone. They open on the surfaces'
    `Popover` (and a select on a `Sheet` on a narrow window), with their rows in `Options.tsx` and
    its keys in the overlay's layer. `Button`, `Switch`, `Checkbox`, `Radio`, `Link`, `Progress`,
    and `NumberInput` are `nsh/base`'s parts, which give the role and state screen readers hear.
- **Where**: [`app/ui/controls/`](/app/ui/controls/).

## R169: What the controls draw where the design language says nothing

- **Decision**:
  - **Square, as every corner**: a switch is a square track with a square thumb; a checkbox a box
    with Lucide's check; a radio a box with a square dot, which tells it from a checkbox.
  - **On is the accent, filled; off is the well**; disabled is a dashed, quiet edge and faint words,
    never opacity alone. Under the pointer a row of a choice takes a faint block of the accent; a
    picked segment or tab stands a step up, or is bold, over a line of `light.focus`.
  - **Badges, banners, and statuses are text colours on a faint block of themselves**, not white on
    a fill: `on-action` is measured on the accent alone (ruling R135). The tint is
    `tokens.control.tint`, a new part of the tokens, `tokens.control`, with the tones, the controls'
    sizes, and the ring; `Tone` names them.
  - **A spinner is a terminal's braille**, with its words, and an ellipsis with reduced motion.
  - **The focus ring** is 1 px, 2 points outside the control, in `button.focusRing`.
  - **On a narrow window** a button, a select, a segment, a tab, and a list's row are 44 points
    high, and a choice's row 44 at least.
  - `look.ts` and `parts.tsx` of the keys are gone: their views draw with `Kbd` and `Text`, and the
    key map draws a key's icon where the app carries it. `isNarrow` moved to
    [`app/ui/width.ts`](/app/ui/width.ts), still marked `TASK 33:`.
- **Where**: `app/ui/controls/`, `app/ui/tokens/control.ts`, `app/ui/keys/`.

## R170: A list is a cursor, the keys of the pane that holds it, and one row

- **Decision**: every list of the app, `List`, `VirtualList`, `Table`, `Tree`, and `DragOrder`, is
  drawn over one model, `createCursor(items, { initial?, onChange?, range? })` in
  [`cursor.ts`](/app/ui/lists/cursor.ts), with one set of keys, `listKeys` in
  [`keys.ts`](/app/ui/lists/keys.ts), and one row, `Row`.
  - **The cursor is the selection.** The keyboard guide's "one selection per view" and its list's
    "`j` `k` move the selection" are one thing: the row under the cursor. A range, where a list
    allows one (`range: true`), runs from an anchor to the cursor, stretched by `J` `K` and Shift
    with the arrows, as a review's comment is stretched over blocks.
  - **The keys are declared in the scope around the list**, the pane's `KeyScope`, through the
    registry: `j` `k` and the arrows (held, they repeat), `g g` `G` `Home` `End`, and `Enter` for
    `onOpen`. A move past either end returns `false`, so the key goes on to a fallback: the layout
    shell's `k` to the pane's tabs, past the first row. Two lists in one place each sit in a pane of
    their own, or the registry refuses the second `j`, as R141 says.
  - **The pointer moves the cursor when it moves** (`onMouseMove`), never as a row slides under a
    resting pointer. **A press selects the row and runs `onOpen`**: the guide's "a click selects, a
    click on the selected row edits" asks two taps on a phone, which has no pointer that moves, for
    the thing done most, against rule 1. With a mouse the pointer already put the cursor there, so
    the press is the second step anyway. A screen whose open is costly gives no `onOpen`, and the
    press only selects.
  - **The cursor is the screen's to keep**: `initial` from the visit's entry, `onChange` to write it
    back, as panes keep their state (R163). It never scrolls: the list it is given to keeps its row
    in view, scrolling only when the row is not wholly shown, the pointer's moves never.
  - **Rows read `holds(id)`**, which compares ids and builds nothing: a move redraws the two rows it
    left and reached, and a transcript that grows by a row costs no walk of its rows. Where an id is
    in the rows is looked for only as a key moves the cursor, from its last place first.
- **Not built**: `Ctrl+D` `Ctrl+U` (half a screen), and `/` to filter: the first is the shell's on
  every page, the second a screen's own.
- **Seen failing**: with the move not brought into view, "the cursor stays in view as it moves"
  failed with `expected 1120 to be less than or equal to 400`, the list still at its top.
- **Where**: `app/ui/lists/`, and the test [`lists.test.tsx`](/app/ui/lists/lists.test.tsx).

## R171: What the client store and the screens give a list

- **Decision**: a list takes `items`, an accessor of `{ id }` objects, through its cursor, and
  `row(id, index)`, which draws one row and reads `id()` where it uses it. What a row shows comes
  from a signal of its id. So the client store (task 23) gives, for a list record:
  - **the rows' array, new at each insert, remove, or move, keeping every unchanged row's object as
    it was** (`===`): Native Shell's `List` matches rows by identity and keeps their cells and
    sizes, and `Each` keys them by id;
  - **one signal per item, read by id**, so a chunk of one message redraws that row alone, and the
    rows' array does not change for it.
- **For the screens**: a `VirtualList` recycles its cells, so a row never copies a value out of
  `id()` at the top of `row`: the next row the cell shows would keep it. The scroll place is the
  screen's to keep, as the cursor is: `offset` where it opens, `onOffset` as it scrolls, and the
  ref's `scrollTo(offset)`.
- **Where**: [`VirtualList.tsx`](/app/ui/lists/VirtualList.tsx),
  [`List.tsx`](/app/ui/lists/List.tsx).

## R172: A list follows its end by `follow`, and the list scrolls itself when a row comes

- **Decision**: `<VirtualList follow>` opens at its last row and stays at its end while it grows,
  until the reader scrolls more than 48 points from it; scrolled back within them, it follows again.
  `onFollowing(now)` hears each change, for a "jump to the latest" button, and the ref's `toEnd()`
  jumps and follows again.
  - A row that grows, a reply streaming, is followed by Native Shell, with
    `maintainVisibleContentPosition` at 48 points.
  - **A row that comes while it follows is scrolled to by the list itself**, `scrollToEnd` as the
    rows' count grows: in the headless runner the native anchor left the list where it was after an
    append, and the test failed with `expected 1000 to be 1028`.
  - Whether it follows is read from `onScroll`, the offset and the sizes it gives.
- **Seen failing**: scrolling to the end at every new row, followed or not, failed
  `expected 1084 to be 728`: the reader's place was taken from under them.
- **If wrong**: on GTK the native anchor and the list's own scroll both go to the end, once each:
  nothing shows twice, as both land at the same place.
- **Where**: [`VirtualList.tsx`](/app/ui/lists/VirtualList.tsx).

## R173: A card takes slots, never free children

- **Decision**: `Card` is a raised surface with slots, in the order a person reads them: `icon` and
  `hue` (its kind), `title` (what a person calls it aloud), `state` (`label`, `tone`, `running`),
  `time` (`started`, `ended`, `took`), `who` (one quiet line), `facts` (each `icon`, `label`,
  `tone`), `body` (what needs its whole width), and `actions` (buttons, each with its key). Sixteen
  screens then draw the same card, and a card with no state, no time, or a hash in its title is a
  thing a reviewer sees at once in its props.
  - **The head on a phone** is the icon, the state, and the time on one line, and the title at the
    card's full width under it, as the phone guide asks of every text that wraps.
  - **Times are words the screen gives**, in the server's time zone (rule 8): the card draws
    `14:02 → 14:05 · 3 min`, and does no arithmetic on a clock it cannot see.
  - **Selected**, its edge takes `light.focus` and its left edge the bar of light, as a row's.
  - `SelectableCard` is a card that is a choice: a control, with `press.ts`'s focus and states.
- **Alternatives considered**: free children with a few layout helpers, as the React UI's `ItemCard`
  and `AgentCard` were two shapes of one idea: the plan's rule 4 was sent back for exactly that.
- **Where**: [`Card.tsx`](/app/ui/lists/Card.tsx),
  [`SelectableCard.tsx`](/app/ui/lists/SelectableCard.tsx).

## R174: A row moves by keys, by its grip, or by a long press, and says where it went

- **Decision**: `DragOrder` lifts the row under the cursor with `m`; while one is carried, a
  `selection` scope holds `j` `k` and the arrows, which carry it a row at a time, gliding, `Enter`,
  which drops it, and `Escape`, which puts it back. The pointer drags a row by its grip, and a
  finger after a long press on the row; the rows it passes make room, sliding, and the row glides
  the rest of the way from where the pointer left it. `onMove(id, to)` is called once, as a row
  lands somewhere new. Where it went is said under the list and to a screen reader (`announce`):
  "Inbox moved to 3 of 5.".
  - **Native Shell's own `Tree` and drag parts are not used**: its controls bind their own keys as
    they take the focus, which the registry would lose (R139).
  - `Collapsible` is `nsh/base`'s with `reveal`, which eases the height and moves what follows: R168
    named it the layout shell's, and this task's prompt names it here.
- **Not tested**: the pointer's drag, which the gallery's pictures do not show either. The keys'
  move is the test, and the words it says.
- **Seen failing**: with `Escape` landing the row where it was carried, "a reorder by keys moves one
  item, and says where it went" failed with `Order: Now Inbox Next Later Done` and `Moves: 2`.
- **Where**: [`DragOrder.tsx`](/app/ui/lists/DragOrder.tsx), [`order.ts`](/app/ui/lists/order.ts).

## R175: The frames of 20,000 rows scrolling, in software, are over 8.3 ms at the 99th percentile

- **Decision**: measured once, with `just lists-frames`: the gallery's list of 20,000 rows, each an
  icon, its words, a time, and a quiet line, filling a window of 1400 by 800, scrolling 900 points a
  frame by itself for 30 s, on the hidden display, which draws in software (R131). The machine's
  load was 4.4 as it started, after an hour near 60.
  - The seconds at rest from other work: 7.5 to 8.2 ms a frame on average, the 95th percentile of
    each second from 8.1 to 9.5 ms, the worst 11.3 ms, 60 frames a second, none dropped. Painting is
    4.6 ms of it, the layout 0.3 ms, the engine's turn 0.5 ms: the rows' bindings cost little.
  - Four seconds had frames up to 142 ms, with painting at 50 to 90 ms: other work on the machine,
    as the run's first second, not the list.
  - So the 99th percentile is over the 8.3 ms the task asked, by about 1 to 3 ms, in software.
- **Rationale**: the glass bar over the samples' transcript cost 5.5 ms a frame on the same display
  (R162); this list paints more on each frame, a full window of rows with an icon each, where the
  samples' rows were fewer and taller. No measure on a GPU was taken here, as R131 says.
- **If wrong**: the GPU's frames over it are the performance task's (53). The first thing to try
  there is the rows' icons, each a picture made from an SVG and drawn again as a cell is reused for
  another kind.
- **Where**: [`frames.test.tsx`](/app/gallery/lists/frames.test.tsx),
  [`scroll.tsx`](/app/gallery/lists/scroll.tsx), the [`justfile`](/justfile)'s `lists-frames`.

## R176: The Vim bridge is a Rust component around the editor, and a key never crosses into TSX

- **Decision**: every text field draws `TextEditor`, a component of `uraeda/native`
  ([`vim_bridge.rs`](/crates/app/src/vim_bridge.rs)) that renders Native Shell's `Editor` and binds
  the field's keys in Rust, with `on_key_with`, while the field has the focus. A key goes to
  `Vim::key` on the editor's text and selection, read through `EditorApi`, and its edits are carried
  out at once on the same API: `Replace` is `edit`, one step of undo, `Select` is `set_selections`,
  `Undo` and `Redo` are `run`, then `Vim::sync`. The plan asked for "one call into Rust per key"
  from TSX: here a key costs no call at all, and TSX hears only what changed, the text (`onChange`),
  the mode (`onStatus`), a key given back (`onKey`), and a jump (`onTrail`).
  - **With Vim off, the layer is not in the path**: no key of Vim is bound, and no call reaches it.
    `vimKeys()` counts the calls, and the test `a field with Vim off never calls the bridge` holds
    it at 0.
  - **One `Vim` for every field**, a thread's own, reset as a field takes the focus. A field opens
    typing, by `Vim::insert`, new in `crates/vim/`: `i` would step the caret back off a line's end.
    `normalFirst` opens it in normal mode, as a buffer.
  - **The field's own keys**, bound over the editor's: Escape (Vim first, then the field's: its
    owner's Escape in an overlay, else it leaves the field), Shift+Escape leaves from any mode,
    Ctrl+Enter saves, a one-line field's Enter never adds a line. `:w`, `:q`, `:wq`, and `:x` are a
    small command line of the bridge, `COMMAND` in the status line: the Vim layer has no Ex
    commands.
  - **Keys an owner declares `inField`** reach it before the editor: the field binds them too and
    hands them back to the registry, `pressKeys`. A dialog's Tab, a picker's arrows and Enter. In a
    one-line field, `j` and `k` in normal mode are its down and up, as LazyVim's picker.
  - **The field binds a moment after it takes the focus**, with a timer of no delay, so its bindings
    are newer than the editor's, which it binds as it takes the focus. Native Shell gives a key to
    the newest binding of a view, and any view's binding wins over the script's
    (`nsh-core/src/core/components.rs`, `keymap()`): the field's keys always win over the
    registry's.
  - **Not working: Vim's Escape inside an overlay.** Native Shell 0.4.0 adds an overlay's own
    Escape, its `onCancel`, after every view's binding (`nsh-core/src/core/overlay.rs`,
    `overlay_key_binding`, chained last in `keymap()`), so it wins over any field inside, the
    editor's own Escape included, where its documentation says it fires "when no binding took
    Escape". In a dialog or the key picker, Escape closes the overlay from insert mode. Seen: the
    first version of the test, in a dialog, ended with the dialog closed after the first Escape. The
    fix in the app is ten lines of `app/ui/surfaces/` (task 27's files, outside this task):
    `focus.ts` keeps one `takeEscape(take)` hook that the focused field sets while Vim is out of
    normal mode, and `Float`'s `onCancel` calls it before closing; the field then sends the key to
    the bridge (a ref method `press(stroke)`). Upstream, the overlay's binding belongs first in the
    table, under the views'. The test checks the guarantee on a page's field, where Escape leaves
    the field.
- **Rationale**: the edits of a key land before the next key is read, with no copy of the text kept
  in TSX, which could be stale between a TSX call and the editor's `onChange`; and no key state
  machine sits in TSX, which the plan forbids.
- **If wrong**: the keys of Vim are bound by the US layout's names, as R139 says Native Shell
  matches them: on another layout, a key that types `$` without Shift reaches the editor in normal
  mode. On Linux, `ctrl+r` is the development build's reload key, which Native Shell leaves to the
  dev server there: redo works in a packaged build.
- **Where**: `crates/app/src/vim_bridge.rs` and `vim_bridge/`, `app/ui/text/TextField.tsx`,
  `crates/vim/src/state.rs` (`Vim::insert`), `crates/app/tests/keys.rs` (its line).

## R177: The shared field's parts, and what they leave to the screens

- **Decision**:
  - **`TextField`** is every field, one line or many (`lines`), drawn on a `Well` whose edge takes
    the mode's colour with Vim, with `Under` for a refusal or a hint. It wraps, grows with its text
    (`rows`), and is marked with Markdown. `shown` draws it still, for the gallery.
  - **The block caret**: outside insert mode the character under the caret is a decoration in the
    mode's colour, at 45%, over the editor's own caret: Native Shell's caret has no block shape.
  - **The caret's trail** is a `<Shader>` over the field, fed the caret's box before and after a
    move, from `caret_bounds`, when it moved more than one cell, or to another line, with no edit in
    the same step: typing, a new line included, draws none. An animated value closes it in
    `motion.caretTrail`, natively. With reduced motion, or `caret.trail` off, nothing is drawn.
  - **Unsaved text** is `unsavedText(key, saved)` in [`unsaved.ts`](/app/ui/text/unsaved.ts): one
    entry of the device's store per field, `unsaved:<key>`, and their list under `unsaved`, which
    `pruneUnsaved` reads as the app starts. It drops the React UI's fields of one screen (`sources`,
    `picked`, `subject`) for one `extra` that a screen fills.
  - **`SaveStatus`** says Unsaved changes, Saving…, Saved, or Not saved; `saving(send)` runs the
    saves, and its `refusal()` goes to the field's `refusal`, under the field, with the why.
  - **`LeaveGuard`** asks "Leave page?" with the shared `Dialog`, through `setLeaveGuard`, while a
    field drawn holds unsaved text. There is no prompt as the app closes: the text stays on the
    device.
  - **`Composer`** says which key sends, under it: Enter, with Shift+Enter for a line, unless
    `sendOn="mod+enter"`, and on a narrow window Enter adds a line and the Send button sends.
    `PickerField` is a one-line field over a list, its keys a selection's scope, on while the field
    has the focus.
  - **Not built here**: a paste or a drop of an image (Native Shell's editor reports text only, so a
    screen wires them around the field, and `insert` puts the link); the phone's edit menu
    (`onContextMenu` of the editor, not forwarded yet); a confirmation before a changed row is left
    with Escape, which is the screens'.
- **Rationale**: the plan's names, each kept small; the rest is what a screen owns.
- **Where**: `app/ui/text/`, `app/gallery/text/`, `app/store/device.ts` (its two lines).

## R187: The layout is data in the visit, and a place lists its panes in order

- **Decision**: the model is the plan's, with these changes, each in
  [`layout.ts`](/app/ui/layout/layout.ts) and [`panes.tsx`](/app/ui/layout/panes.tsx):
  - **A place is a list, not two.** `definePlace(page, route => [...])` lists a page's panes in
    order, each in its kind's stack (`definePane`'s `stack`) unless the place names another. A
    pane's default stack is said once, by its kind, so a screen cannot place one pane in two ways.
    `placeOf(route)` still answers `{ main, side }`.
  - **The layout lives in the visit**, `entry().kept.layout`, beside `kept.panes`, what each pane
    remembers. The UI layout decision puts an open tab in the address: the visit is what Back and a
    browser's reload restore (ruling R127 keeps the entry as the history's state), and an address
    holding two stacks' arrangement would be long and change at every `h`. A new visit opens on the
    place's default; task 66 keeps the human's arrangement per kind of place, on the device.
  - **The main stack always holds the place's subject**: `move` refuses its last pane. A side stack
    left empty is not drawn. A stack with no pane on either side would leave nothing to focus.
  - **A moved pane takes the focus**, as a window does in i3: the human looks at what they moved,
    and a pane moved into the focused stack, shown there, would otherwise hide the focused one.
  - **The focus is always on a shown pane**, or on its stack's tabs (`onTabs`). A pane that leaves
    gives it to the tab after it, else the one before, else the other stack's shown pane
    (`neighbour`).
  - **Functions added to the plan's**: `cross` (`h` `l`), `step` (the tabs, and the phone's one
    stack), `toTabs`, `close` (with `closed`, so the place does not bring a closed pane back in the
    visit), `sync` (the layout kept, made to hold the place's panes as they are now, as after a
    `redirect`), and `narrowed`, the phone's one stack as a view of the layout, not a change of it:
    a wider window shows both stacks as the narrow one left them.
  - **The side stack's fold is in the layout and on the device**: in the layout for the focus to
    leave a folded stack, and on the device (`DeviceKeys.frame`) for the next visit to open folded.
- **Rationale**: Zed's panels say where they may sit, and VS Code keeps one location per view; one
  default stack per kind is both. Kiro's chat as a tab is a view of the session, never the session:
  `remember` and `PaneScroll` keep a pane's state in the visit, so a hidden tab is not drawn at all.
- **Seen failing**: the table's first run found that a pane moved into the focused stack was shown
  while the focus stayed on the pane it hid, and three rows whose expected focus did not follow the
  neighbour rule.
- **Where**: `app/ui/layout/`, `Kept` in [`history.ts`](/app/store/history.ts), `frame` in
  [`device.ts`](/app/store/device.ts).

## R188: The frame's keys are fallbacks, and a stack's tabs are a selection

- **Decision**: the frame declares its keys in a page scope, `Panes`, around every pane
  ([`keys.tsx`](/app/ui/layout/keys.tsx)):
  - `h` `l` (hint `h l pane`), `j`, and `k` are **fallbacks**. A pane may declare the same keys in
    its own scope, for its columns or rows, and returns `false` at its edge: the frame's then moves
    the focus. So `k` past a list's first row reaches the tabs, as the keyboard guide asks, with no
    pane knowing the frame.
  - **The tabs are a `selection` scope**, on while the focus is on them: `h` `l` step through the
    tabs (past an end, the frame's `h` `l` cross the stacks), `j`, Enter, and Escape go back into
    the pane. Their hints are drawn beside the tabs, as a selection's are.
  - `[` folds the rail and `]` the side stack (hint `[ ] fold`); `{` and `}` widen and narrow the
    side stack by 40 points, a held key repeating. The drag is `nsh/base`'s `ResizablePanelGroup`,
    whose band takes the gap between the stacks; the width is kept on the device.
- **Rationale**: the registry runs a pane's own binding first and a fallback after it (ruling R141),
  which is exactly "the pane's key, else the frame's".
- **Alternatives considered**: `h` `l` as plain frame keys: no pane could then use them, and home's
  columns need them.
- **Seen failing**: with `l` crossing to main, "l crosses into the side stack and h comes back"
  failed on `Focus: Activity`.
- **Where**: `app/ui/layout/keys.tsx`, `layout.test.ts`.

## R178: One component draws a pane and a stack of tabs

- **Decision**: task 27's `Pane` takes `tabs`, a row of titles on its edge, the border around the
  whole row, and `tabsEnd`, what follows them: a stack of tabs is one `Pane`, and a pane alone is a
  stack of one. The shown tab fills with light while the stack has the focus; the others are
  regular, in the faint ink. A tab with `needs` is in `needs-you`, a hidden tab with `running` has a
  small square of the running light, and a count follows the title, `· 4`. Tabs that would not fit
  their stack's width keep their icons alone, but for the one shown (`fitted`, measured on the
  monospace font's width). On a narrow window the stack's edge holds the shown pane's title alone,
  and the bar of tiles at the foot switches panes, as the phone's bottom bar did.
- **Rationale**: the human asked that "panes and tabs will look the same everywhere": one component
  draws every pane's frame and every tab. A tab bar inside a pane would cost a row, which the design
  language already refused.
- **Also found**: a `Scroll` given `{...props}` alone drops its children under NSH's JSX:
  `PaneScroll` passes them explicitly. A running pane's line crossed its own title's words on GTK,
  where an animated view is drawn over its later siblings: `RunLine` now starts where the title
  ends, as the edge does, seen in the gallery's light picture of an unfocused running pane.
- **Where**: [`Pane.tsx`](/app/ui/surfaces/Pane.tsx), `RunLine` in
  [`light.tsx`](/app/ui/surfaces/light.tsx), [`Stack.tsx`](/app/ui/layout/Stack.tsx),
  [`bars.tsx`](/app/ui/layout/bars.tsx).

## R179: The width is the frame's, and a pane reads its stack's

- **Decision**: `width()` and `isNarrow()` stay in [`app/ui/width.ts`](/app/ui/width.ts), where the
  controls read them, not in `app/ui/layout/width.tsx`: the frame writes the width it was laid out
  at (`measured`), and before any frame was laid out the platform's window size is read. The frame
  draws its stacks only once a width is known, so the first render never picks the phone's layout at
  a width of 0. A pane's view is given its own stack's class, `width`: a side stack of 400 points is
  `narrow`, as a phone is, and the pane lays out as one column there.
- **Where**: `app/ui/width.ts`, `Stacks.tsx`, `Stack.tsx`.

## R180: What the frame draws, and its slots

- **Decision**:
  - **The rail** ([`Rail.tsx`](/app/ui/layout/Rail.tsx)) is open on a wide window and folded to
    icons on a semi-wide one until the human chooses, kept on the device. Unfolded it is the places'
    pane, titled by the repository, and the shell's `sidebar` under it. It pushes the stacks aside
    on a semi-wide window, where the guide unfolds it over the page: one behaviour, and the page
    moves by a known width.
  - **The side stack folded is a rail of its panes' icons** at the right, as the rail of places is
    at the left: the fold shows what it holds, and a press unfolds on that pane. The semi-wide
    guide's "rail that opens over the page" is this rail, opening beside it.
  - **The side stack is 400 points wide on a wide window, 340 on a semi-wide one**, between 280 and
    60% of the room, until the human drags or keys it.
  - **The slots task 36 fills**: `rail` (`places`, `title`, `sidebar`), `status` (`mode`, `start`,
    `end`, `place`), and the narrow window's bars, which take the rail's places and its sidebar, in
    a sheet. The status line draws `keyHints()` between `start` and `end`, each a press of its keys.
  - **The old sidebar's panes stay the frame's** (Features, Needs you, Usage), in `sidebar`. A
    third, left stack would let them move like any pane, but they are the app's, not a place's: they
    show on every page, and a layout per place would drop and bring them back as the human moves. If
    the human wants them movable, they become panes of a left stack that every place shares, with
    the moves of task 66.
- **Not built**: zoom, split, close, and the moves have no key or button yet: task 66. The frame
  draws a zoomed pane and a split stack already.
- **Where**: `app/ui/layout/`.

## R181: Accounts are a second trait the runtime hands out, and a session's account crosses the contract

- **Decision**: `Runtime::accounts() -> Option<Arc<dyn Accounts>>`, none by default, with
  `Accounts { list, name_of, problems, refresh(max_age) }` and
  `Account { id, name, state, windows, asked_at, known }` in `runtimes/accounts.rs`, as
  `uraeda/server` has them. `has_session` takes the account, and `Options` gains `account`. The
  pick's rule is one pure function, `accounts::pick`, with `pick_with_room` for a move and `merged`
  for an ask merged with a process's reports, all three tested row by row.
- **Rationale**: a handle rather than methods on `Runtime`, because Claude Code's accounts are built
  again when the `accounts` setting changes, and a VM's are calls into the VM: both hand out an
  object, as the Node adapter's optional `accounts` field was. `AccountState` and `AccountWindow`
  are the protocol's own types, so the record sends what the contract holds.
- **Where**: [`runtimes/accounts.rs`](/crates/server/src/runtimes/accounts.rs),
  [`extensions/accounts.rs`](/crates/server/src/extensions/accounts.rs),
  [`server.d.ts`](/crates/server/src/extensions/api/server.d.ts).

## R182: One pick per open, before the process is looked at

- **Decision**: `Runner::account_for` runs as a process opens, before the session's lock: a session
  with a started turn keeps its stored account, listed or not; else it picks, after asking stale
  usage for at most 10 s, and stores the pick, or clears it when the runtime lists none. An open
  process on another account is closed and opened again, as for an effort it cannot change.
- **Rationale**: the Node server picked twice, once "while idle" to decide whether to reuse the
  process and once to open it. One pick gives the same rule with half the asks and no window between
  them.
- **Where**: [`runner/account.rs`](/crates/server/src/runner/account.rs),
  [`runner/processes.rs`](/crates/server/src/runner/processes.rs).

## R183: A move continues at once, as a continue of its own reason

- **Decision**: a turn a limit failed is decided by the continuer when the limit is a session's, or
  when the session runs on an account of a runtime that lists accounts: a weekly limit then moves
  too. `move_account` picks, among the other listed accounts that hold the transcript, the one with
  room in every window and a known usage; the session's account changes whether or not the run
  continues, and the run continues at once with the reason `account`, under the
  `continue_after_limit` switch and the cap, opening on "Continued on account b, after a usage
  limit." With no account with room, a session's limit waits for its reset, and any other stops.
- **Rationale**: the models and run lifecycle decisions as they stand, ported from
  `account-move.ts`.
- **Where**: [`runner/moves.rs`](/crates/server/src/runner/moves.rs),
  [`runner/continuer.rs`](/crates/server/src/runner/continuer.rs).

## R184: The import reads the Node store at schema 14, and its fixture is written again

- **Decision**: the import reads `runner.sqlite` at schema 14 only: its 13th step added a session's
  `account`, which is imported, and its 14th the scheduled jobs' `job_runs`, which this import does
  not read. `fixtures/runner/old.sqlite` was written again with `write-old.ts`, whose feature
  session now runs on an account, set last so that no other row changed. The store's schema gains
  its third step, `sessions.account`.
- **Rationale**: the task asks for the fixture from its script, which runs on Node: it was run once,
  through the dev shell, against the shared brief's rule that no task runs `node`.
- **If wrong**: task 63, which ports the scheduled jobs, imports `job_runs` from the same fixture.
- **Where**: [`import/old.rs`](/crates/server/src/runner/import/old.rs),
  [`write-old.ts`](/fixtures/runner/write-old.ts).

## R185: Claude Code's short processes share one helper

- **Decision**: `claude/usage.rs` holds `short`, the process that writes control requests and reads
  their answers within 10 s, used by `models` and by an account's `get_usage`;
  `claude auth status --json` runs beside it. `models` runs in the first listed account signed in,
  else the first, after waiting at most 4 s for their ask. An account's asks run at once on blocking
  threads, one at a time per account, at most once a minute.
- **Where**: [`claude/usage.rs`](/crates/server/src/runtimes/claude/usage.rs),
  [`claude/accounts.rs`](/crates/server/src/runtimes/claude/accounts.rs).

## R186: The file-length test failed before this task, and still does

- **Decision**: `rust_source_files_stay_under_500_lines` of `uraeda-cli` failed on this branch
  before the task, on nine files over 500 lines: `core/src/check/mod.rs`, `core/src/settings.rs`,
  `protocol/src/sessions.rs`, and six of `server/src/runner/` (`continuer.rs`, `manager.rs`,
  `page.rs`, `running.rs`, `send.rs`, `transcript.rs`). The task added its code in new files, and
  only the lines it must to three of them: `sessions.rs` from 815 to 822 (a session's account and a
  runtime's accounts), `continuer.rs` from 641 to 649 (the move), `manager.rs` from 764 to 765 (the
  accounts asked with each check). So `just task uraeda-server uraeda-protocol uraeda-cli` fails on
  that test alone: the other 561 tests of the three crates pass.
- **Rationale**: splitting six modules of the runner that tasks 63 and 64 edit at the same time is a
  structural change of its own, which would collide with theirs.
- **If wrong**: the split is one commit after the wave's merge, by module.
- **Where**: [`structure.rs`](/crates/cli/tests/structure.rs).

## R189: The minute between two starts is on the server's clock

- **Decision**: the scheduler keeps no sleeping queue. A look (every 30 seconds, after each change
  of the settings file, and after each `jobs.*` write) queues the times due, then starts the queue's
  head when the minute since the last start has passed on `shared.now()`, else arms one wake at the
  minute's end. A time is read again, job and guards, when its turn comes, and skipped then; Node
  read the skip before the minute's wait, and again after it. A minute that took more than 5 minutes
  beyond its length (the machine slept) drops the queue, recording nothing, as Node did.
- **Rationale**: the tests move time by setting the fixed clock and ticking, as the task asks, and
  one rule decides the order of starts: no wait to cut short at the stop, and no second reading of
  the guards.
- **If wrong**: a run due with others starts at the wake, within a second of its minute.
- **Where**: [`jobs/scheduler.rs`](/crates/server/src/jobs/scheduler.rs).

## R190: The offers' grammar is in the core

- **Decision**: `uraeda_core::offers` holds the grammar of an offer block (`last_offer`, which the
  card draws, `ending_offer`, which a job's acceptance reads, at column 0 only, and
  `proposal_title`). The app's crate already takes the core, so the offer card's native code reads
  the same rule.
- **Rationale**: parsing lives in the core (the stack decision), and one rule serves both readers.
- **Where**: [`offers.rs`](/crates/core/src/offers.rs).

## R191: The jobs' actions answer nothing, and "Run now" its session

- **Decision**: `Jobs { repo }` is a live record: `jobs.add`, `jobs.update`, `jobs.setOn`, and
  `jobs.remove` answer `()`, as the settings' writes do, and `jobs.runNow` answers
  `JobsRan { session }`. Node's mutations answered the whole record, and "Run now" the record with
  the session, for fate's cache; here the subscription shows the change. The record drops fate's
  `id`, and a run's view gains `refusal`, why the change its run offered could not start.
- **Where**: [`protocol/src/jobs.rs`](/crates/protocol/src/jobs.rs),
  [`records/jobs.rs`](/crates/server/src/records/jobs.rs).

## R192: A job's run is a chat whose message is the workflow's

- **Decision**: `send::Message` gains `job`, the line a run's turn opens with: the turn is a chat (a
  chat has no step to continue), and its message's origin is the workflow's, so "the human wrote in
  the session" reads only the human's messages. `session.toChange` became
  `records::move_to_change(runner, repo, row, text, slug)`, with `start_typed_change` taking
  `&Shared`, so the acceptance starts a change through the card's own path, with no client's call. A
  turn's end reaches the jobs from `Runner::publish`, one line, which holds the job busy before
  anything else reads the session.
- **Where**: [`runner/send.rs`](/crates/server/src/runner/send.rs),
  [`records/sessions/actions.rs`](/crates/server/src/records/sessions/actions.rs),
  [`jobs/accept.rs`](/crates/server/src/jobs/accept.rs).

## R193: `--no-scheduled-jobs` is an option of the server

- **Decision**: `Options::no_scheduled_jobs`, set by `ura serve --no-scheduled-jobs`, wins over
  `URAEDA_SCHEDULED_JOBS` and `[runs] scheduled_jobs`, and the setting says its source is the flag.
  `settings.setContinue` takes the key `jobs`, as Node's did.
- **Where**: [`start.rs`](/crates/server/src/start.rs),
  [`settings.rs`](/crates/server/src/records/workspace/settings.rs).

## R194: The job runs' table, and its import

- **Decision**: the store's fourth schema step, after the accounts' third (R181 to R186), adds
  `job_runs`, as Node's: one row per run, skipped time, or failed start, a plain unique index on
  `(job, repository, due)`, pruned to the 50 latest of a job in a repository but the latest started
  run, the latest failed start newer than it, and the runs whose session is a change's. The import
  reads Node's store at schema 14, the one with both the accounts' column and `job_runs`, and copies
  the rows as they are, ids kept, in `import/old/jobs.rs`. `fixtures/runner/write-old.ts` writes
  four runs after everything else, the feature's session's account included, and the fixture was
  written again with it.
- **Where**: [`schema.rs`](/crates/server/src/runner/schema.rs),
  [`job_runs.rs`](/crates/server/src/runner/job_runs.rs),
  [`import/old/jobs.rs`](/crates/server/src/runner/import/old/jobs.rs).

## R195: What of the record is not ported

- **Decision**: a session whose job's offer was refused does not show the attention "The change
  could not start by itself." of Node's session status: the refusal is kept, and shown on the run in
  the `Jobs` record's history (`refusal`). The session's status and its banner are the sessions'
  record's (task 15's), whose `StatusReason` is shared with the features' statuses; the Jobs place
  (task 65) shows the refusal with the run.
- **If wrong**: a reason `change-refused` in `StatusReason`, read from `Store::job_run_of` in
  `runner/reads.rs`, the turn the refusal names still the session's latest.

## R196: A store whose third step was the jobs' runs takes the account's step

- **Decision**: tasks 62 and 63 each added the store's third schema step, the accounts' column and
  `job_runs`. Merged, the account is the third and the jobs' runs the fourth. A store at 3 with no
  `sessions.account` was written by the jobs' version alone: it is read as at 2, so it takes the
  account's step, then the jobs' step, which creates its table and indexes only if missing. Either
  version's store reaches the same schema, its runs kept.
- **Rationale**: such stores exist (the task's worktree, its sandbox), and without this one would
  fail to open with "table job_runs already exists". The check is one query, at the open.
- **If wrong**: drop `steps_taken` and the `IF NOT EXISTS` once no such store is left; nothing else
  reads them.
- **Where**: [`schema.rs`](/crates/server/src/runner/schema.rs),
  [`pages.rs`](/crates/server/tests/sessions/pages.rs).

## R197: An overlay gives Escape to its field first, and Native Shell's order is reported upstream

- **Decision**: an overlay's `onCancel` (Escape, the phone's Back) goes first to the field of its
  own that has the focus: `focusStop` takes an `escape` from a field, `escapeHeld(stops)` in
  [`focus.ts`](/app/ui/surfaces/focus.ts) calls it, and `Float` closes only when no field took it.
  The field's `escape` is the bridge's new ref method `press("escape")`, the key as if typed: Vim's
  first, so insert mode goes to normal mode, then the field's own Escape, which in an overlay is the
  layer's Escape of the registry, and closes it. It replaces the `takeEscape(take)` hook that ruling
  R176 proposed: no state follows Vim's mode in TSX, since the bridge already decides Escape, and a
  field with Vim off closes the overlay through the same path as before. The test
  `Escape in a dialog's field leaves insert mode first, and closes the dialog second` failed without
  it (`expected [... "Dialog closed" ...] to contain "Mode: NORMAL"`), and passes.
- **Rationale**: the cause is as task 30 found it, read again at the pin. `Core::keymap()`
  (`nsh-core/src/core/components.rs`) builds the key table from the script's bindings, then the
  views' (`keys.list`), then `overlay_key_binding()` (`nsh-core/src/core/overlay.rs`), an Escape of
  `When::Always`; `Keymap::find` (`nsh-core/src/keymap.rs`) fires the newest binding of a keystroke.
  So while any overlay listens to `onCancel`, no view's Escape fires, the editor's own included.
- **If wrong**: the phone's Back in a dialog's field with Vim in insert mode goes to normal mode
  first, as Escape does. Once Native Shell orders the overlay's binding under the views', the
  hand-over still works: the field's own binding takes Escape, and `onCancel` is not called.
- **Upstream report**, for the human to file at <https://github.com/longbridge/nsh/issues>:

  > **An overlay's `onCancel` takes Escape from the views inside it**
  >
  > Version 0.4.0 (`e626a8dd`), every platform with a keyboard (seen on GTK and in `nsh test`).
  >
  > The docs say `onCancel` "fires on Escape, the Android back button and VoiceOver's escape gesture
  > on iOS, for the top overlay that listens to it only. It takes them before the pages and
  > `BackHandler`" (`website/elements/overlay.md`), and the coding guide that "Overlays dismiss from
  > the top" (`website/docs/coding-guides.md`). Nothing says it also takes Escape before the views
  > inside the overlay, and the `Command` element's own docs expect the opposite: its Escape is
  > bound "before it propagates to a hosting `Dialog`" (`docs/dev/api-naming.md`).
  >
  > What the code does: `Core::keymap()` (`crates/nsh-core/src/core/components.rs`) chains the
  > script's bindings, then every view's (`on_key`), then `overlay_key_binding()`
  > (`crates/nsh-core/src/core/overlay.rs`), which binds Escape with `When::Always`. `Keymap::find`
  > fires the newest binding, so the overlay's Escape always wins: a view's `on_key("escape", ..)`
  > inside the overlay, an `Editor`'s own Escape, or any focused component that wants Escape for
  > itself (a text field leaving a mode, a combobox closing its list) never sees it while an overlay
  > listens to `onCancel`.
  >
  > Reproduction, with the `Editor` of `nsh/base`, whose keymap binds Escape to `SingleSelection`
  > (`crates/nsh-base/src/editor/keymap.rs`):
  >
  > ```tsx
  > import { mount, Overlay, signal, Text, View } from "nsh";
  > import { Editor } from "nsh/base";
  >
  > mount(() => {
  >   const said = signal("nothing");
  >   return (
  >     <View>
  >       <Text>{said()}</Text>
  >       <Overlay onCancel={() => said.set("overlay")}>
  >         <Editor value={"one\ntwo\nthree"} />
  >       </Overlay>
  >     </View>
  >   );
  > });
  > ```
  >
  > Focus the editor, put a cursor on each line (`mod+a`, then `shift+alt+i`), and press Escape.
  > Expected: the editor goes back to one selection, and the overlay hears nothing, as the editor's
  > binding is the newest. Seen: `overlay`, and the three cursors stay. The same with any Rust
  > component inside the overlay that calls `on_key("escape", ..)` while it has the focus.
  >
  > Suggested fix: put the overlay's binding first in the table, under the views' bindings
  > (`.chain(overlay)` before `.chain(keys.list...)`), so `onCancel` fires when no view inside took
  > Escape, as the back button already falls through to the views' listeners.

  The app's field is the second case: it binds its keys in Rust with `on_key_with`, in
  [`vim_bridge.rs`](/crates/app/src/vim_bridge.rs).

- **Where**: [`focus.ts`](/app/ui/surfaces/focus.ts), [`Float.tsx`](/app/ui/surfaces/Float.tsx),
  [`TextField.tsx`](/app/ui/text/TextField.tsx),
  [`vim_bridge/api.rs`](/crates/app/src/vim_bridge/api.rs) (moved out of `vim_bridge.rs`, which had
  reached 507 lines), [`text.test.tsx`](/app/ui/text/text.test.tsx).

## R198: No row of a field's editor wraps again on GTK

- **Decision**: `TextEditor` ([`vim_bridge.rs`](/crates/app/src/vim_bridge.rs)) draws the editor in
  a view of the Tailwind class `whitespace-nowrap`, which Native Shell's texts inherit, and gives
  the editor's `placeholder` part `whitespace-normal`, so a long placeholder still wraps.
- **Rationale**: the cause, found on the hidden display with a page of fields at fixed widths from
  385 to 390 points. The editor wraps its rows itself (`nsh-base/src/editor/display.rs`,
  `wrap_line`): it breaks after a space, keeps that space at the end of the row, and checks only
  what is not blank against the width, as CSS and Pango let a line's last space hang. Each row is
  then one `Text`, absolutely placed in a row as wide as the editor (`view.rs`, `row_view`). Native
  Shell's text on GTK wraps a line whose trailing space passes its box: a plain `Text` holding
  `Run the tests again, then open the pull ` broke before `pull` in boxes of 364, 366, and 370
  points, and not in 373, while the same words without the space never broke. So in the composer,
  whose rows were 364 to 368 points wide at the gallery's widths, the first row fit by the editor's
  measure, broke again on GTK, and its second line, `pull`, was drawn over the second row,
  `request.`. A fixed width did not cure it because every width where the words fit and the space
  does not shows it: 385.5 to 388 points for this message, a band for any other. The editor's own
  wrap is right, so its rows' texts must never wrap: one class does it.
- **Not used**: the editor's `line` part's style, which would have given every row's text room past
  the wrap: a row sets its decorations' `inline_style` after its part's, so the part's style never
  shows (`view.rs`, `row_view`), which is a second report upstream's.
- **If wrong**: a test would need the pixels of a GTK window, so none was written; the gallery's
  composer, `just gallery-shots field`, shows the case, and the field's pictures were looked at in
  both themes, at 1400 and 390 wide. Upstream, the fix is in either place: the GTK backend's text
  lets trailing whitespace hang, as Pango and CSS do, or the editor's rows never wrap. Until one is
  released, the class stays.
- **Where**: [`vim_bridge.rs`](/crates/app/src/vim_bridge.rs), `Field::view`.

## R199: The caret's trail compiles, draws, and is a thin line

- **Decision**: the trail stays on, behind its token `caret.trail`. Two changes:
  - **Its shader never compiled**: its uniforms were named `from` and `to`, and `from` is a word
    WGSL keeps. Native Shell compiles a `<Shader>`'s source as the page draws it, and a failure is a
    warning in the log, `the shader of node 84: 3:3: name 'from' is a reserved keyword`: the view
    draws nothing. They are `was` and `now`. A test, [`shaders.rs`](/crates/app/tests/shaders.rs),
    compiles every `.wgsl.ts` shader of the app with Native Shell's own `Shader::compile`, as the
    page would: it failed on `TRAIL` with that error, and passes. The other four compiled already.
  - **Its head was a blot**: the wedge widened to half the caret's height, 12 points, at the head, a
    teardrop over the first character where the caret landed, which stayed there, fading, for most
    of the 480 ms, since its tail closes on a cubic ease. The design language asks for "a thin
    wedge", from the terminal cursor shaders, whose head is the cursor's block. It now widens from
    0.4 to 1.25 times the caret's width, at least 1.5 points: a line that tapers onto the caret.
- **Rationale**: seen on the hidden display. The field reports both jumps (`G`: from y 0 to 144;
  `gg`: from 168 to 0), and with the duration set to 6 s for one run, the pictures showed the wedge
  moving. Still frames of the shader at `t` 0, 0.05, 0.15, 0.3, 0.5, and 0.75, over a field in both
  themes, read as a hint of motion at every step, never a smear. It draws only while it closes, one
  pass over the field's box with no texture read: not measured, as no frame of it can be caught.
- **Not done**: a picture of it in the gallery. On the system's clock, the hidden display's pictures
  came about 2 s after the key on the loaded machine; on a manual clock a key's step runs every
  animation to its end. The gallery's `field-typed-vim-trail.png` never showed it, and is gone.
- **If wrong**: the token turns it off. After `G` in a field whose text ends with a line break, the
  trail ends a row above where the caret then sits (144, then 168): the Vim layer's last line and
  the editor's differ by that empty line, which this task left alone.
- **Where**: [`trail.wgsl.ts`](/app/ui/text/trail.wgsl.ts), [`Trail.tsx`](/app/ui/text/Trail.tsx),
  [`shaders.rs`](/crates/app/tests/shaders.rs).

## R200: A narrow window's bar, a stack's tabs, and what the gallery's pictures showed

- **Decision**:
  - **The bottom bar's tiles are as wide as their words**, and share what is left, while every word
    fits; past that, as six or more panes on a phone, each tile keeps its icon alone, and the shown
    one keeps its word too. Five equal tiles at 390 points left 78 each, and cut "Transcript", while
    the five words need about 350 together: sized by their words, all five read whole. When even
    that does not fit, a cut word reads worse than none: the icons, with the shown pane named, say
    where the human is, and each tile keeps its title for screen readers. A scrolling row was not
    taken: it hides panes off the edge with nothing to say they are there.
  - **A stack's tabs keep their titles while they fit**, the shown one first, then the others,
    nearest to it first; the rest draw their icon alone, with their title in a tip and to screen
    readers. The rule was all or nothing: one title too many put every other tab to its icon. At the
    side stack's default width, 386 points, the gallery's `Activity · 12`, `Changes · 4`, and
    `Agents` with the fold need about 450: the shown tab keeps its title, and the next one needs 15
    points more than there is, so the gallery's picture is as before. The width of a character is
    taken at 0.62 of the size, as Monaspace draws it, not 0.6.
  - **The folded side rail draws a pane that waits on the human in `light.needs`**: `IconButton`
    takes a `colour` at rest. The rail passed `danger`, which only reddens a button under the
    pointer.
  - **A run's line is 2 points in both themes**: at 1 point in the dark theme, with a glow that GTK
    draws faintly, it read as a grey edge.
  - **A card sets its border only when selected**: `Card` and `SelectableCard` passed
    `borderColor: undefined` otherwise, which overrode the surface's border, and GTK drew it black:
    every card had a black top edge, in both themes, which ate half of the run's line. Measured: 0
    black pixels in the cards' pictures now, 7972 before in the light one.
  - **`DragOrder` draws its line of words only once it has said something.**
  - The table's pictures, retaken after its column was widened, read whole at both widths.
- **Rationale**: each seen in `target/shots/gallery/` after `just gallery-shots`, in both themes, at
  1400 and 390 wide, before and after. The test of the tabs' rule failed under the old rule
  (`expected ["Activity","Changes","Agents","Plan"] to equal ["Activity","Changes","Agents"]`).
- **If wrong**: the bar's fallback, icons with the shown pane's word, is in no picture: the
  gallery's narrow frame has five panes, which fit.
- **Where**: [`bars.tsx`](/app/ui/layout/bars.tsx), [`Stack.tsx`](/app/ui/layout/Stack.tsx),
  [`Pane.tsx`](/app/ui/surfaces/Pane.tsx), [`SideRail.tsx`](/app/ui/layout/SideRail.tsx),
  [`IconButton.tsx`](/app/ui/controls/IconButton.tsx), [`light.ts`](/app/ui/tokens/light.ts),
  [`Card.tsx`](/app/ui/lists/Card.tsx), [`SelectableCard.tsx`](/app/ui/lists/SelectableCard.tsx),
  [`DragOrder.tsx`](/app/ui/lists/DragOrder.tsx), [`layout.test.ts`](/app/ui/layout/layout.test.ts).

## R201: A list's row costs a view less, and an icon's picture is built once

- **Decision**: two changes to what every row of a list costs, kept because they measured better.
  - **`Line` draws its words as one `Text` with `flex: 1`**, where a `View` held the `Text`: one
    view less per row.
  - **`Icon` keeps each picture it built**, by name, colour, and size: an icon's `src` is an SVG,
    made and URI-encoded in TSX, and a row of a list scrolled fast is bound again on every frame,
    which built the same two pictures for each of its cells, every frame.
- **Rationale**: `just lists-frames`, the 20,000 rows scrolling 900 points a frame for 30 s on the
  hidden display, in software, the medians of its seconds at 60 frames a second:

  | Run           | Load    | Frame, mean | Frame, p95 | Painting | TSX     | Engine  | Snapshot |
  | ------------- | ------- | ----------- | ---------- | -------- | ------- | ------- | -------- |
  | Before, busy  | 9 to 18 | 9.29 ms     | 10.85 ms   | 5.29 ms  |         |         |          |
  | Before, quiet | 3 to 5  | 7.44 ms     | 7.99 ms    | 4.42 ms  | 1.57 ms | 3.02 ms | 1.15 ms  |
  | After         | 5 to 9  | 7.25 ms     | 7.75 ms    | 4.29 ms  | 1.50 ms | 2.91 ms | 1.04 ms  |

  The first run of the baseline was taken while other agents' builds loaded the machine, and a
  second one was taken once it was quiet, so the comparison holds; the run after the change had the
  higher load of the two. Every column went down a little. On a quiet machine the list is within the
  frame budget already: the 95th percentile of each second is 7.6 to 8.1 ms after, 7.8 to 8.4 ms
  before, where ruling R175 measured 8.1 to 9.5 ms under load.

- **What else was read, and not changed**: Native Shell's `docs/dev/scrolling-and-lists.md` and
  `performance.md`. Painting is most of the frame, and it is GTK drawing the whole window in
  software each frame, glyphs first: nothing a row holds is a shadow, a layer of opacity, or a
  surface; the selected row's bar has a glow, on one row. The row's border is its rule, one line. At
  900 points a frame every cell is bound again on every frame, which no real scroll does.
- **If wrong**: the busy run had seconds of 6 to 11 frames, every 7 to 8 s, with painting at 40 to
  105 ms; the quiet runs had none, so they were the machine's, as R175 found.
- **Where**: [`Line.tsx`](/app/ui/lists/Line.tsx), [`Icon.tsx`](/app/ui/controls/Icon.tsx).

## R202: Every kind of parsing has one home, and TSX reads none

- **Decision**: Markdown is read in Rust only, by the core's parser, in two places.
  - **A workflow file**: the core reads it on the server, and the record `WorkflowFile` sends its
    tree, `current.document`. `Document` draws that tree and walks it, children by parent, once per
    tree: it never sees Markdown.
  - **An agent's reply**, which is Markdown text and grows by appends (R144): the client's Rust,
    `ReplySplitter` of `uraeda/native` (`crates/app/src/reply.rs`), reads each appended piece once,
    line by line, keeping only the block being written, and finds where blocks end: a blank line
    ends a paragraph, a quote, or a table; a closing fence ends code; a heading or a rule is one
    line; a list goes on across blank lines until a line that is neither indented nor an item. Each
    finished block's text goes through the core's own `files::document::parse`, and crosses as the
    JSON of the protocol's `Document`, which `Reply` draws with the same blocks as a file.
  - **A whole text the client holds**, as a message once sent: `markdownTree(text)`, the same parse.
  - `uraeda-app` takes `uraeda-core` as a dependency for it, which its tests already built.
- **Measured** (release, once): the core's tree of a 712-byte paragraph with code, bold, and a link
  in 22 µs; 31.6 KB of reply split in 12-byte pieces in 0.62 ms in all, 0.24 µs a piece. So a block
  is parsed once, as it finishes, for less than a frame's thousandth.
- **Rationale**: the stack decision puts parsing in Rust; the spike measured NSH's `TextView`
  parsing a whole message again on each chunk. One parser keeps a reply's blocks and a file's alike:
  callouts, typed items, tasks, links resolved as the core resolves them.
- **If wrong**: the web build (task 56) compiles `uraeda-app` for the browser, and the core brings
  `gix`, `image`, and `libwebp-sys`: the document's parser then moves to a crate of its own, which
  the core and the app both take. A reply's links are resolved from the repository's top level,
  where a file's are from its folder.
- **Where**: `crates/app/src/reply.rs`, `reply/split.rs`, `reply/lines.rs`, and their table of cases
  in `reply/tests.rs`.

## R203: What `Reply` takes, and what the client store gives it

- **Decision**: `Reply` takes `text`, an accessor of the reply so far, and `done`, an accessor that
  turns true once the reply is whole. It keeps how much of the text it has read, and on each change
  sends the splitter `text().slice(read)`: a copy of the new piece only, never a scan of the text. A
  text shorter than what it read is another reply, read from its start. A piece that ends in the
  first half of a UTF-16 pair waits for the next; the splitter itself waits for a UTF-8 character a
  piece cut, for a caller that sends bytes.
  - Finished blocks are a list of `{ key, tree }`, keyed by a count, drawn by `Each`: a new block
    adds one row, and no other row is made again. The growing block is plain prose, or `Code`
    without colours while its fence is open.
- **What task 23 must give**: `text(record, path)` as a signal whose value only grows by `append`
  while one reply streams, and a value that is not longer than before when the record is replaced
  (another reply in the same place), or a new signal. And a reply's end: the message's state in the
  same record, which a screen turns into `done`. Nothing else: no offsets, no chunks.
- **Rationale**: the plan's constraint, "a long reply is drawn as blocks", and its measure: NSH
  parsed a whole message again on each chunk. Tested by "a growing reply redraws its last block
  only", which counts the blocks made through the `mark` slot while 55 pieces arrive.
- **Measured**: `just document-frames`, a reply of 40 sections, each a heading, a paragraph, a list,
  and code, about 22,000 characters, growing 12 characters a frame for 27 seconds, its scroll
  following its end, on the hidden display, which draws in software (R131), the machine's load
  between 6 and 7. Two runs. Seconds 2 to 4, a reply under 3,000 characters: 3.1 to 3.9 ms a frame
  on average, the engine's JavaScript 0.4 to 0.5 ms. Seconds 10 to 27, from about 7,000 characters
  to the whole: 3.4 to 4.4 ms, JavaScript 0.4 to 0.6 ms, 60 frames a second. So a frame's cost stays
  flat as the reply grows. Seconds 5 to 9 of both runs rose, to 6 to 22 ms on average in the first
  and 5 to 7 ms in the second, layout and painting both, not JavaScript: not explained. The first
  code blocks' colours arrive then, from a debug build's syntect on another thread, which re-lays
  out their text once each.
- **Where**: [`Reply.tsx`](/app/ui/document/Reply.tsx),
  [`frames.test.tsx`](/app/gallery/document/frames.test.tsx).

## R204: One highlighter: syntect with the syntaxes NSH's editor reads, coloured by the theme

- **Decision**: `highlightCode(code, language)` of `uraeda/native` cuts a finished code block into
  runs, each with one of the theme's `syntax-*` roles, `keyword` to `variable`, or none. It runs on
  syntect 5 with two-face's syntaxes, at the features NSH 0.4.0's `nsh-base` builds them with, so
  the app holds one highlighter and one set of grammars. NSH's own tokenizer (`nsh_base::syntax`) is
  private, and colours with a palette of its own: the app maps TextMate scopes to its roles itself
  (`highlight/scopes.rs`), the innermost scope that names one deciding, as NSH's does, with the same
  settling of a grammar's `storage.type` by its word (`fn` a keyword, `f32` a type).
  - It runs once per finished block, on a blocking thread (`async`): the first block with a language
    reads the syntaxes, tens of milliseconds in a release build, over a second in a debug one. The
    block shows plain at once, and coloured when the runs arrive. A block still growing in a reply
    is never coloured.
- **Alternatives considered**: NSH's `TextView` for code blocks, which colours them itself: it
  parses Markdown, and its colours are not the theme's.
- **Where**: [`highlight.rs`](/crates/app/src/highlight.rs),
  [`Code.tsx`](/app/ui/document/Code.tsx).

## R205: A diagram is `diagramPicture`, in the interface's font, measured and drawn in Rust

- **Decision**: `crates/app/src/diagram.rs` holds `picture`, `fonts`, and `without_markup`, moved
  from `crates/app/tests/outside/diagram.rs`; the outside check calls the crate's. TSX calls
  `diagramPicture(source, colours)`, named so in the module's one set of names (R30), not `picture`.
  - **The font is Monaspace Neon**, the interface's, bundled whole as an OpenType file: the other
    bundled families are WOFF2, which neither Merman's measuring nor `usvg` reads. The check used
    the display's font before; it passes on Neon.
  - **Colours** are Mermaid's theme variables from the roles: boxes in `chip`, their edges `rule`,
    lines `ink-quiet`, text `ink`, groups `sunken`; a theme's alpha is dropped. An `effect` reads
    them, so a theme change draws the picture again, and the old one stays until the new one comes.
  - **2 seconds**: Merman's own deadline, and a timer in `Diagram.tsx`; past it, or for a source
    Merman refuses, the source shows as code, under "The diagram could not be drawn:" and Merman's
    words. A drawn diagram wider than its room scrolls sideways inside itself.
  - Merman's `filter: none`, `transform: none`, and its drop shadows at 6 % of black leave the SVG
    before `usvg` reads it: each made `usvg` log a warning. One warning of a filter is still logged
    per diagram, unfound.
- **Where**: [`diagram.rs`](/crates/app/src/diagram.rs),
  [`Diagram.tsx`](/app/ui/document/Diagram.tsx), `a_diagram_never_carries_a_script`,
  `a diagram that fails shows its source`.

## R206: A document's blocks, how they read, and the screen's slots

- **Decision**: `Document` draws the core's tree; the screen gives four hands, all optional:
  `onLink(link)` for a link that stays in the app (a file, `#anchor`, a wikilink to a file, a
  story), where a web address opens through the system; `image(image)` for an image's address,
  without which an image is a link with its alt text; `mark(block)`, the screen's own mark under a
  block, made once with the block, for each block of the top level, each list's item, and each
  table's row; and `override(block)`, a block drawn the screen's way, as a story or a mockup live
  (task 49). Each block's view has the test id `block-<id>`, the core's stable index.
  - **Prose** keeps a measure of `type.measure × type.prose` points, about 80 characters, centred in
    a wider pane (`align="start"` puts it at the left edge): 18 px on a 28 px line in the reading
    font. Headings are in the heading font, bold, the first level 22 px and the others 18, in their
    level's colour, with 14 points between blocks and 10 to 22 more above a heading. Inline code is
    the code font a step under, in `code-inline` on a faint block of it.
  - **Code, tables, and diagrams** start at the prose's edge and may take the room to the document's
    right edge: code is as wide as its longest line, at least the measure, and scrolls sideways
    inside itself; a table's columns share the room down to a floor each, about half their widest
    cell, then the table scrolls inside itself, never the page.
  - **Lists** keep their markers in a column of their own, so a wrapped line hangs under its text: a
    bullet, a dash on a narrow document, a number right-aligned, a task's box, a typed item's sign
    in its role's colour. **Callouts** are a bar of their kind's tone on a faint block of it, with
    its icon and title; a quote is the bar alone.
  - **A link alone in its paragraph to a picture in a `mockups` folder**, and an image alone, draw
    in place, as wide as the room, up to their own width.
- **Not built**: footnotes, which the core's tree does not hold, and folds; a selection over the
  blocks is the screens', through `mark`.
- **Alternatives considered**: the lists' `Table` (R170), a list of records with a cursor and keys:
  a document's table is a grid of words, with no cursor. `Heading`, whose third level is the
  interface's 15 px, smaller than the prose under it.
- **Where**: [`app/ui/document/`](/app/ui/document/), the gallery's page
  [`gallery/document/`](/app/gallery/document/), `just gallery-shots document`.

## R207: A page says its own errors, and its host watches it answer, never the process's log

- **Decision**: R23's way, a logger of the process that keeps the target `js` by thread, is not
  built. The host hears a page's problems from the page, and from its answers to pings:
  - **A throw as it loads**: the build's entry, `uraeda_protocol::page_entry`, runs the page by
    `import()`, which the bundler builds into the same module as a function run in a promise, and
    posts `problem` with what the promise was rejected with: `Error: broken at load`.
  - **A throw as it draws, in an effect, or in a listener**: `uraeda/page` draws the part inside
    NSH's `ErrorBoundary`, whose fallback posts `problem`.
  - **A call that never ends**: NSH cuts it off after 2 s, and the boundary catches the cut as
    `InternalError: interrupted`, which the view reads as `slow`. The host also pings the page every
    half second, from the entry's own listener, so a page that imports nothing answers: a ping
    answered after 1.2 s says the page held its engine, and none answered for 5 s, or no `start` 10
    s after the load, that it stopped.
- **Rationale**: the log cannot be had. NSH's release runner (`nsh-linux-app`'s `setup`) and its
  development host (`dev::init_logging`) set the process's logger before the app's code runs, so
  `log::set_boxed_logger` fails in the app: R23's check passed only because its test process set
  none. `ErrorBoundary` is in NSH 0.4.0 (`nsh`'s `index.d.ts`): the note "there is no error
  boundary" of `AGENTS.md` was wrong, and is corrected.
- **Seen failing**: with no cut-off (a call budget of an hour), `a_page_that_never_stops` failed on
  `The page of loops stopped: it answered nothing for 5 s`: still named, but as stopped.
- **If wrong**: an upgrade that changes the interruption's text names a cut-off `threw`, and the
  pings still name it `slow`. An upstream change that gives GTK's `AppView` an error callback
  (`on_app_error`, as GPUI's) would replace the boundary's and the entry's posts.
- **Where**: `crates/protocol/src/page.rs`, `crates/app/src/extension_view/channel.rs`,
  `app/extensions/page.tsx`. Supersedes R23's "What later tasks use" for task 34.

## R208: The page's channel has eight names, which the protocol's crate holds with the entry

- **Decision**: a page's rights are `{ "host": PAGE_HOST }`, `start`, `loaded`, `ready`, `problem`,
  `alive`, `record`, `call`, and `navigate`, and the build's entry is `page_entry(page)`: both in
  `crates/protocol/src/page.rs`, which the server signs and builds with (`HOST` and `START` of
  `extensions/{signing,pages}.rs` are gone) and the app's view answers. The entry is one file now,
  with no `start.ts` beside it. The app's events to a page are `show`, `ping`, `theme`, `props`,
  `record`, and `key`.
- **Rationale**: the names are a contract between what the server signs and what the app answers,
  which is the protocol crate's. `start` stays the first statement; `loaded` and `show` let the host
  draw the page only once its code ran whole, so a page never draws half its parts.
- **Where**: `crates/protocol/src/page.rs`, `app/extensions/host.tsx` (the list of messages).

## R209: One engine per part shown, and a place is a pane whose view is that part

- **Decision**: a page declares its parts at its top level (`place`, `homePane`, `newSection`,
  `statusItem`, `itemRenderer`, `settingsSection`, `key`), and the app draws each part in its own
  `ExtensionPlace`, a view of its own, running the whole page and drawing the part named by its
  launch parameter `part`, `{ kind, id }`. Once drawn, the page posts `ready` with its
  `Declarations`, every part without what draws it, which `onReady` gives the app. A part's state is
  the server's records, never the page's memory.
  - **A place** is a pane kind the app declares per extension and place: `definePane` with the
    extension's name and the place's id as its kind, the place's title and icon, `stack: "main"`,
    and a view that draws `ExtensionPlace` with `part={{ kind: "place", id }}`. It then sits in a
    stack like any pane, gets its width class, and is framed by the app's `Pane`.
  - **A home pane** is a pane of Home's place, the same way, in the stack of its `column` (0 main, 1
    side). **A status item** is an `ExtensionPlace` in the frame's `status.end` slot. A New-page
    section and an item renderer read their `search` and `item` with `useProps`, which the app sends
    again as they change. A key is bound by the app, which sends `key`, `{ keys }`, to a view of the
    page.
  - What a page declares is read by an `ExtensionPlace` with no `part`, drawn at no size: it runs
    the page, draws nothing, and gives `onReady`.
- **Rationale**: a view is one GTK widget, so a part drawn in two places of the frame is two views.
  Engines start in about 15 ms (the spike's reload), and only the parts shown run.
- **Alternatives considered**: the declarations in `extension.toml`, read by the server: a second
  place to declare a part, against the page API the docs name.
- **Left to tasks 36, 37, and 51**: when the declarations are read (once per page version is
  enough), the panes' and the keys' registration, and the place's `count`, which the old API had and
  a page cannot give the rail without a view running: a record of the extension is the way.
- **Where**: `app/extensions/{page,ExtensionPlace}.tsx`.

## R210: The view fetches the page itself, with the device's token, and trusts the server's key only

- **Decision**: `uraeda.extension` takes `server` and `token` as props, and fetches
  `GET /extensions/key` then `GET /extensions/{name}/page` itself, in Rust (`ureq`, off the main
  thread), each time its `version` or its `params` change. It verifies the package with a
  `TrustStore` holding the key the server gave, one per server address, in memory for the process's
  life, and made again when the server's key changes; it refuses a package whose app id is not
  `dev.uraeda.extension.<name>`; it accepts the build, so an older one is refused; and it runs the
  package's bundle with the package's capabilities, never others.
- **Rationale**: Rust takes whole responses, which is what a package is, and verifies without
  crossing the bytes into TSX, where base64 in an interpreter would cost each load. The token goes
  to the view, which the page never reads: its `host.params` are the app's `params` alone.
- **Seen failing**: trusting every key a server ever gave (one store, roots added) failed
  `a_saved_page_shows_without_a_restart` on `a page under the old key is refused`; loading with a
  host function more than the package grants failed `a_page_reads_a_record...` on
  `ERR_NSH_HOST_ERROR` where `ERR_ACCESS_DENIED` was expected.
- **If wrong**: the browser (task 58) fetches with its cookie, in its player: the view's props are
  then the page's address alone.
- **Where**: `crates/app/src/extension_view.rs`, `extension_view/fetch.rs`.

## R211: `uraeda/ui` is the library but the frame, and the server writes it from its binary

- **Decision**: `app/ui/index.ts` exports the controls, lists, surfaces, tokens, `TextField`,
  `width`, and `isNarrow`: not the layout shell and not the keys' host, which are the app's frame.
  `uraeda/page` imports `../ui/theme` to draw in the theme the app sends. The tokens call
  `uraeda/native`, so the server bundles pages with `uraeda_app::registry()`'s description beside
  `nsh/base`'s: `uraeda-server` takes `uraeda-app` without its default feature `host`, which alone
  brings GTK and the view. Every page's engine is served `uraeda/native`, as the app's runner sets
  NSH's UI sets for the process. `extensions/modules.rs` holds `app/ui/` and `app/extensions/` in
  the binary, and writes them, tests and `__checks__` left out, to
  `<data folder>/extensions/modules/{ui,extensions}/` as `extensions::mount` runs, before the loader
  starts; the files of another server's are removed.
- **Rationale**: the tests build their pages from `app/` itself, with a `Button`, `tokens`, and a
  colour of the light theme the app sent, and count that colour's pixels on GTK.
- **If wrong**: a component a page wants that reads the app's store (the layout, the text field's
  unsaved drafts) is the app's; a page gets what it needs of it through its host.
- **Where**: `app/ui/index.ts`, `crates/server/src/extensions/{modules,pages}.rs`,
  `crates/app/Cargo.toml`.

## R212: The page API's hooks are signals, and three names were added

- **Decision**: `useRecord<T>(name)` and `useExtensionSettings<T>()` give
  `Accessor<{ value, error }>`, never throwing: a record's error is a state of the page, not a
  problem the server keeps. `useAction<I, O>(name)` gives `(input) => Promise<O>`. Added:
  `useProps<T>()`, what the app gives the part; `navigate(to)`, an address of the app, which the
  channel's `navigate` names; and the part's `view`, where the old API said `component`. A place's
  `count` and `phoneTab` are not ported (R209). `onUnload(fn)` runs as the part drawn goes: an
  engine stops whole, with its timers and listeners.
- **Where**: `app/extensions/page.tsx`. Task 51 rewrites `docs/extensions.md` with them.

## R213: The pages' tests run on GTK, over a stand-in of the server's two routes

- **Decision**: the plan's four tests are in `crates/app/tests/extensions.rs`, each in a GTK window
  on a hidden display of its own (R21's harness): NSH's headless runner draws no native component.
  The app's side is the real `ExtensionPlace`, in `app/extensions/__checks__/place.tsx`, over
  stand-ins of the store. The pages are built and signed in the test as the server does it, from the
  protocol's entry and the app's own modules, and served by a stand-in of `GET /extensions/key` and
  `GET /extensions/{name}/page`: the server's test support is its own crate's, and starting it from
  the app's crate would bring its agents' stand-ins too. The server's half of a save, a new version
  on save, is task 19's test. `app/extensions/extensions.test.tsx` holds the channel's rule that a
  page reads and acts as its own extension only.
- **Also**: the plan's fixture `throws/` is `crashes/`: `fixtures/extensions/throws/` is task 17's
  server part that throws.
- **Where**: `crates/app/tests/extensions.rs`, `crates/app/tests/extensions/`,
  `fixtures/extensions/{counter,crashes,loops}/`.

## R226: The sessions on the merged branch, their catch-up runs, and the suite's slow tests

- **Decision**: the server's tests had not run since task 15 was merged by a rebase. On the merged
  tree, `just task uraeda-server uraeda-protocol uraeda-cli` failed on one test,
  `rust_source_files_stay_under_500_lines`: nine files were over 500 lines, two of the core
  (`check/mod.rs`, `settings.rs`, over it on main too, from the catch-up with the default branch)
  and seven of the sessions. They are split by responsibility, in a commit of its own. Every other
  test passed: 552 run, in 16 s.
  - **The catch-up runs start on `SETTLED`**, `sessions::settled`, called once the pull requests'
    refresh of a burst ended, and after each other refresh that changed them. The sessions' line in
    `FILES_CHANGED` is gone: on the burst itself, the catcher read the pull requests as they were
    before the refresh, and a pull request opened meanwhile was caught up only if the refresh won
    the race. `a_refresh_that_moves_a_feature_to_catch_up_starts_its_run` passed before the change,
    by that race; with `SETTLED` empty it fails, "the server did not answer: waiting for the
    catch-up's run".
  - **The seams task 15 was to finish are built**: `feature.continueAll`, the feature's status and
    sessions, the start's first run and kept messages, the drop, the promotion's first run, the
    recommended message's agent, `mcp::Runner`, a process's token, the chat images' cleanup,
    `Runtimes::check()`, the extensions' skills and events, the writes refused while an agent works.
    Left, each marked: `TASK 51:` in `preview/warm.rs` (a linked story still compiles at its first
    read) and `TASK 20:` in `records/workspace/repositories.rs` (the sandbox's locked list). The
    `TEMPORARY:` marks are the port and data folder apart from the Node server's, and the session
    import, all for task 61.
  - **Slow tests**: `two_saves_sent_back_to_back_land_in_the_order_sent` ran 50 rounds of a commit,
    5.2 s; it runs 10. `an_extension_that_never_returns_is_cut_off`, 12.8 s, is kept: it waits for
    the VM's real limits, 2 s to load and 10 s a call, on the VM's own thread, which no paused clock
    reaches, and it guards the extensions decision's "a broken extension MUST NOT stop Uraeda".
    Making it fast takes the limits as a value of the server's options, through the VM, its calls,
    and the runtimes' calls. `the_signing_key_never_leaves_the_data_folder`, 5.6 s under load, asks
    every route four ways: kept.
- **If wrong**: a burst with no refresh still settles, so the catcher runs after every burst as it
  did, only later.
- **Where**: `crates/server/src/records/{pulls,watch}.rs`, `records/sessions/mod.rs`,
  `crates/server/tests/sessions/catch_ups.rs`, `crates/server/tests/writing.rs`.

## R227: The default agent is read from the settings at each pick, and a runtime keeps its place

- **Decision**: what the Node server gained for the agents, as built here.
  - **`runs.default_agent`** is in the record `Settings`, `runs.defaultAgent`, and written by
    `settings.setDefaultAgent { agent }`, `null` removing it, through the core's
    `set_default_agent`, which refuses a blank name, "The agent is empty." A name no runtime has is
    kept as written.
  - **The registry reads it from the config folder's file at each pick**, as it already reads where
    each extension is on: `Runtimes::ordered(repository)` lists the names with the default agent
    first while it is registered and on there, and `on_in`, which every pick of a new session asks,
    follows it. The Node server kept it in memory, with `prefer()` called as the settings changed:
    one value read where it is used has no second copy to keep in step. `settings.setDefaultAgent`
    says the runtimes changed, so the record `Agent`, listed in that order, is read again at once.
  - **A runtime registered again keeps its place**: the registry keeps every name in the order of
    its first registration. `a_runtime_is_registered_under_one_name_until_it_is_removed` asserted
    the opposite, a name registered again listed last, and was changed with it.
  - **The MCP tools are listed with `annotations: { readOnlyHint: true }`.**
  - **One `tool_target`**, the built-ins', which now takes the tool's name: a `run_agent` call's
    target is its `task`. The runner had a copy of its own for the blocked actions' lines, which is
    gone. The Claude fixture's expected events, recorded from the Node runner before it named the
    task, have the target.
  - **A sub-session's view** already carried `startedAt` and `endedAt`. Its `about` drops a
    reviewer's ` on <base>..<head>` when both are commits, as the Node server's pattern does.
- **Seen failing first**: `no action is settings.setDefaultAgent`; `["second", "first"]` for
  `["first", "second"]`; a tool's `annotations` `null`.
- **Where**: `crates/server/src/runtimes/{registry,built_in/target}.rs`,
  `records/workspace/settings/`, `records/sessions/{agent,session}.rs`, `mcp/tools.rs`,
  `crates/protocol/src/workspace/settings.rs`; the tests `a_new_session_runs_on_the_default_agent`,
  `a_runtime_registered_again_keeps_its_place`, `the_tools_say_they_change_nothing`,
  `a_run_agent_calls_target_is_its_task`.

## R228: What else the Node server gained, file by file

- **Decision**: `git diff e15482f6 main -- packages/server/src`, outside its tests, decided for each
  change. Accounts are task 62's, jobs task 63's.
  - **Ported here (R227)**: `runner/runtimes.ts` (first-registration order, the default agent
    first), `settings.ts` and `fate/settings-mutations.ts` (`defaultAgent`,
    `settings.setDefaultAgent`), `fate/views.ts` and `fate/sessions.ts` (the runtimes listed default
    first), `mcp/endpoint.ts` (`readOnlyHint`), `runner/message.ts` (a `run_agent` call's target),
    `fate/sub-session-views.ts` (a reviewer's title).
  - **Already in the Rust server**: `catch-ups.ts` and `serially.ts` (a helper moved, no behaviour:
    the catcher's runs go one at a time per repository, `runner/catch_ups.rs`); `fate/errors.ts` and
    `fate/extension-mutations.ts` (`settingsWrite`, a helper moved: an unreadable settings file is a
    refusal, as the Rust `Fault` maps it); `runner/sessions.ts` and `runner/session-context.ts` (the
    context made in a module of its own); the start and end times of a sub-session's view.
  - **Task 62's, accounts**: `extension-api.ts`, `extensions/builtins.ts`, `extensions/server.ts`,
    `limits.ts`, `runner/adapter.ts`, `runner/cache-rows.ts`, `runner/cache-sessions.ts`,
    `runner/cache-turns.ts` (`hasStartedTurn`), `runner/claude.ts` (the accounts' folders; its
    models are asked through the accounts' `askShort`), `runner/continuer.ts` and `runner/events.ts`
    (the `account` continue), `runner/fake.ts`, `runner/migrations.ts` (the `account` column),
    `runner/processes.ts`, `runner/session-state.ts`, the accounts' line of `runner/message.ts`, and
    the accounts of `runtimes.ts`, `fate/sessions.ts`, and `fate/views.ts`.
  - **Task 63's, jobs**: `app.ts`, `env.ts` and `options.ts` (`--no-scheduled-jobs`,
    `URAEDA_SCHEDULED_JOBS`), `fate.ts`, `fate/context.ts`, `fate/mutations.ts`, `fate/sources.ts`,
    `fate/session-moves.ts` and `fate/session-reads.ts` (a job's refused change), `live.ts`
    (`onWorkspaceChange`), `repositories.ts` (`onChange`), `server.ts` (`startJobs`),
    `runner/cache.ts`, the `job_runs` table of `runner/migrations.ts` and of `cache-turns.ts`,
    `runner/send-input.ts` and `runner/send.ts` (a chat message Uraeda sends, with `origin` and
    `line`), `runner/session-folders.ts` (`removeEmpty`), `runner/status.ts` (`change-refused`), the
    jobs' lines of `runner/message.ts`, and the `jobs` switch of the settings.
  - **Not ported, with its reason**: `run-options.ts` and `runner/run-session.ts` (`defaultEffort`,
    and a pick left to the agent's default stored as that default). Only the web UI's
    `runs/runOptions.ts` calls `toStored`: no server path runs it. The settings screen (task 48) and
    the run options' panel (task 44) store the options; the UI holds no workflow logic, so their
    task ports `toStored`, with this rule, to the server.
- **Where**: the commit `feat(nsh-migration): the default agent, and what else the server gained`.
  Tasks 20, 44, 48, 62, and 63.

## R229: The parity list maps every old name, read from the Node code, and freezes for task 61

- **Decision**: `crates/server/parity.toml` has three tables, `records`, `actions`, and `routes`,
  each keyed by the Node server's name (a route as `<METHOD> <Hono path>`), its value the name this
  server serves it by, or `dropped: <why>`. `crates/server/tests/parity.rs` compares the keys with
  the names `tests/parity/node.rs` reads: fate's `dataView<..>("Name")` and quoted `"a.b":` keys of
  `packages/server/src/fate/*.ts`, and the routes of `app.ts` with those of each router it mounts,
  `app.route("<prefix>", router(..))` or `router(app, ..)`, read in the module its import names. A
  new name must be in both the protocol's `catalog()` and the live `Registry`, or in
  `Server::routes()`. Counts: 46 records (40 mapped, 6 dropped), 114 actions (all mapped), 29 routes
  (26 mapped, 3 dropped). Nothing was missing: tasks 7 to 19 and 62 to 64 had ported every name.
- **Rationale**: one reader of the source, small and plain, so task 61 deletes `node.rs` and the
  comparison of keys, and keeps the list and the check of new names.
- **If wrong**: a router mounted another way than the two forms read is missed; the test then says
  nothing of its routes. `fate`'s endpoints map to `/live`, the protocol that replaced them (task
  3).
- **Where**: `crates/server/parity.toml`, `crates/server/tests/parity.rs`, `tests/parity/node.rs`.

## R230: The sandbox is an option of the server, and its builders read the checkout at run time

- **Decision**: `Options::sandbox: Option<sandbox::Mode>` (`Mode { sign_in }`), which only code
  sets, through `ura sandbox`. It registers the fake runtime as `fake`, `claude`, and `codex` in
  place of the built-ins, locks the list (`repositories.add`, `open`, `remove`, and
  `FolderSuggestions` are refused, closing `TASK 20:`), and, without `sign_in`, makes every request
  and `hello` the one session `sandbox`, which never ends (`sign_in::Unguarded`). With `sign_in`, a
  new key is shown at each start, so the sign-in and pairing screens can be reached. The guard and
  loopback stay. `sandbox::prepare(folder, Prepare { reset, long_chat })` builds the sample projects
  in Rust from `fixtures/` and the skill's templates, read at run time from the checkout the binary
  was built in; `sandbox::options` gives the server its folders, a `gh` that lists the sample's pull
  requests first on its `PATH`, no job at its times, and no folder joining its list.
- **Rationale**: no Node runs in the new stack, so the Node builders (`packages/web/samples/`) were
  ported, as data where they were data (`fixtures/sandbox/`). A server option, rather than a second
  server, keeps one start path. The decision says the sandbox's code must not reach the package:
  `ura sandbox` is hidden from `ura --help`, and outside a checkout it refuses with how to run it;
  its fixtures never ship. A cargo feature would have taken the sandbox's tests out of `just task`.
- **Alternatives considered**: a feature `sandbox` of `uraeda-server`; a `ura serve --no-sign-in`,
  which a user could turn on by mistake.
- **Where**: `crates/server/src/sandbox.rs` and `sandbox/`, `crates/cli/src/sandbox.rs`,
  `sign_in/check.rs`, `runtimes/mod.rs`, `records/workspace/repositories.rs`.

## R231: The sandbox keeps its state in `.sandbox-next/`, and what it holds

- **Decision**: the sandbox's folder is `.sandbox-next/` of the checkout, not `.sandbox/`, which the
  Node sandbox owns until task 61: the two servers never share runtime data. Its port is 4420. It is
  built when it has no `stamp`, or on `--reset`, and kept otherwise; a stamp of other builders says
  to reset. What it holds, from the Node builders: "sample" (the fixture repository's four features,
  the feature page's seven, a feature at each of the eleven steps the builders made, six changes,
  the round page's mockup feature, and an `origin` with a commit to pull and one to push), "empty",
  "broken", "realistic" (three done features, the leader key's round and spec, two features at work,
  priorities, inbox, and a triage), and "bare"; six chats in "sample"; two jobs; the extensions
  `echo` (a record, actions, a route) and `hello` (a page); and Claude Code's five sample accounts.
  Its first start sends the workflow's run of four features, which the fake plays for twelve hours,
  two of them in "realistic" on `claude` and `codex`. `URA_TODAY` is 2026-10-21. Left out of the
  Node builders: the stories feature with its fake Storybook, the spec page's and the questions
  page's features, the feature page's past runs, and the leader key's live session, which needs the
  old store's items turned into events; a screen task adds the one it needs.
- **Rationale**: the builders are a fraction of what the Node one made, covering every step and
  state the screens show, and a build takes about two seconds.
- **Where**: `crates/server/src/sandbox/`, `fixtures/sandbox/`.

## R232: The fake answers a message `slowly`, a workflow's run at work, and the long chat on demand

- **Decision**: the sandbox's agent answers a message with the canned reply over 3 s; a message
  holding the word `slowly` with a reply of about 1,500 words over 60 s; and a message starting
  `/uraeda ` (the workflow's) with a turn at work: three sub-agents, then a tool call every 15 s for
  twelve hours. `--long-chat` adds to "sample" the chat "A very long chat", 20,000 messages in
  10,000 turns, kept until a reset.
- **Rationale**: the frame benchmarks of tasks 35, 43, and 53 need a long transcript and a reply
  that streams slowly; every other sandbox stays light.
- **Where**: `crates/server/src/sandbox/agent.rs` and `sessions.rs`.

## R233: `just sandboxed <command>` gives a command a fresh sandbox

- **Decision**: `scripts/sandboxed.sh` builds `ura`, starts `ura sandbox --port 0` in a new
  temporary folder, waits for its address line, runs the command with `URAEDA_SANDBOX` (the address)
  and `URAEDA_SANDBOX_FOLDER`, and stops the server by its process id and removes the folder when
  the command ends. Task 23 runs its tests with it, as
  `{{ heavy }} scripts/sandboxed.sh {{ nsh }} test` in `app-test`, and reads the address in TSX from
  `process.env.URAEDA_SANDBOX`, which `capabilities.process.env` of `app/nsh.json` must grant.
- **Rationale**: `nsh test` runs TSX with no Node to start a server; a variable is what NSH's
  `process.env` gives a test.
- **Where**: `scripts/sandboxed.sh`, the `justfile`'s `sandbox` and `sandboxed`.

## R234: The gallery is one app in the layout shell, and its catalogue is data

- **Decision**: the gallery is [`Gallery.tsx`](/app/gallery/Gallery.tsx), drawn by `Stacks`: its
  groups are the rail's places, reached by `g` and a letter (`g s` Surfaces, `g c` Controls, `g l`
  Lists, `g t` Text, `g d` Documents, `g k` Keys, `g p` Panes, `g x` Scenes); a group's pages are
  panes, the main stack's tabs; the side stack holds the gallery's own pane, Look, with the theme
  and the width, which `t` and `w` switch from anywhere. The Panes group is the layout shell's own
  place, its sample panes in both stacks.
  - **The catalogue is plain data**, [`catalogue.ts`](/app/gallery/catalogue.ts): the pictures' test
    reads it, and it runs where `uraeda/native` is not. [`pages.tsx`](/app/gallery/pages.tsx) gives
    each page its view.
  - **The entry is `Gallery.tsx`, not the plan's `App.tsx`**: NSH takes the nearest folder up from a
    test file that holds an `App.tsx` or an `nsh.json` for the app (`nsh-cli`'s `app_entry`), so
    `app/gallery/App.tsx` made `app/gallery/` an app of its own, whose runner has no
    `uraeda/native`: every page failed with `could not load module 'uraeda/native'`.
  - **The pages stay in their folders**, one shape each: a function of whether its stack is narrow,
    drawn in a `PaneScroll` unless it fills its pane, with no `mount` and no theme of its own. A
    page is drawn `untracked`: what it reads as it is made, a key declared, never makes it again.
  - **The width switch** draws the frame narrower than the window, centred: the shell measures its
    own frame, so the width classes follow, as on a smaller window.
- **Rationale**: the task asked the gallery to be the shell's first real use; one app is what the
  screens will be, and one catalogue gives every page the same frame, keys, and pictures.
- **Where**: `app/gallery/`, the `justfile`'s `gallery` and `gallery-shots`.

## R235: The samples are gone, each shown by a real component

- **Decision**: `app/gallery/samples/` is removed, with `just samples-shots` and
  `just samples-frames`. Each sample is drawn by the library now: heights by the page Heights; panes
  at rest and focused by States and the frame itself; the glass bar over a transcript by the scene
  `glass`; buttons and keys by Buttons and Keys; the dialog by Dialog; the list by Rows; the status
  line by the frame's own; the session by the scenes. The surfaces' pages drew with the samples'
  hand-made `mono`, `tag`, `icon`, and `button`: they draw with `Text`, `Icon`, `Button`, `Kbd`, and
  `Row`. The busiest page, which glass is pictured over, is `Busy` in
  [`parts.tsx`](/app/gallery/parts.tsx).
- **Also gone**: the per-folder roots (`Surfaces.tsx`, `Controls.tsx`, `Lists.tsx`, `Document.tsx`,
  `Fields.tsx`, `Layout.tsx`) and their tests, `just lists-frames` and `just document-frames`: the
  gallery's one test and `just frames` replace them. The page of the list scrolling by itself is the
  scene `scrolling`.
- **If wrong**: the samples' contrast check read pixels with a script the repository does not have
  (R131); nothing in the repository ran it since.

## R236: `just frames` reads Native Shell's windows of frames, and prints bounds

- **Decision**: [`frames.test.tsx`](/app/gallery/frames.test.tsx) opens the gallery on a scene, at
  1400 by 800, dark, lets it settle 4 s, and marks 30 s; [`frames.sh`](/scripts/frames.sh) reads the
  `nsh::perf` lines between the marks. NSH logs no single frame: each line gives the main thread's
  cost per drawn frame over its last 120 frames, as mean, p50, p95, and max. So every other line is
  read, which at 60 frames a second covers each frame once, and each window counts as half its
  frames at its p50, 45% at its p95, and 5% at its max. Every frame then counts at least at its
  cost: the median, p95, and p99 printed are upper bounds, and the worst is exact. The p99 bound is
  coarse: 5% of every window sits at its worst frame, so it reads about the 80th percentile of the
  windows' worst frames. The per-second lines are printed too, with the machine's load before and
  after.
- **Rationale**: the task asks for the median, the 95th and 99th percentiles, and the worst; a bound
  that may only overstate is honest, where an average of the windows' quantiles is not.
- **If wrong**: an exact count needs each frame's cost, which only a hook on GTK's frame clock in
  the app's crate would give (NSH's `fps.rs` keeps them for a second, then drops them).
- **Where**: `scripts/frames.sh`, `app/gallery/frames.test.tsx`, the `justfile`'s `frames`.

## R237: What the layout shell's first real use found, and fixed

- **Decision**: fixed where the fault was, each seen in the gallery:
  - **`PaneScroll` made every pane's content twice**: it spread its props, `children` among them,
    into `Scroll`, and gave the children again. Every screen's pane would have made its rows and
    declared its keys twice; the Fields page threw
    `"mod+Enter" is bound twice, to Save and to Save`. It passes them once. A test,
    `a pane's scroll makes what it holds once`, failed with `Scroll made 2`, and passes.
  - **A stack drew its panes before it knew its width**: at 0 points, so as `narrow`, then again at
    its width. It draws them once it is laid out.
  - **The frame's tabs and a pane's own keys could not share a key**: the registry took the tabs'
    selection and a selection in a pane (a carried row's, a picker field's) to be on together, and
    refused `j` and `Enter` in the Order and Fields pages. The tabs hold the keys only while no pane
    has them: a pane and a selection beside it never meet. A test says so.
  - **The rail's fold button was clipped away**: placed over the places' pane's edge, inside a body
    that clips. It is the pane's `tabsEnd`.
  - **The rail shows each place's keys**, as the mockup does (`gs`): `RailPlace.keys`.
  - **A pane's title longer than its pane ran past its edge**: it is cut with an ellipsis.
  - **`VirtualList` passed a `keyExtractor`** that read `item.id` in TSX, for each of 20,000 rows at
    each row that came: NSH reads `id` itself.
- **What stays awkward, left**: a screen's `view` gets `width` as a class that changes once its
  stack is laid out; a page written as a plain function of `narrow` is made again when it changes,
  as the width switch does. A pane's content cannot read `props.width` before the first layout.
- **Where**: `app/ui/layout/{panes,Stack,Rail}.tsx`, `app/ui/keys/store.ts`,
  `app/ui/surfaces/{Pane,Surface}.tsx`, `app/ui/lists/VirtualList.tsx`, and the tests
  `layout.test.ts` and `keys.test.ts`.

## R238: A surface's icon is a name, and the keys and the text fields have an entry

- **Decision**: `Pane`, a stack's tab, `Dialog`, `Overlay`, `Sheet`, and `Toast` take an icon's
  name, as `Button`, `Card`, and `definePane` did, or a view of the caller's own:
  `SurfaceIcon = IconName | ((colour) => JSX.Element)`, drawn by `drawIcon` in the title's colour.
  Before, `Pane` took a function of the colour and the overlays an element, three shapes for one
  thing. `app/ui/keys/index.ts` and `app/ui/text/index.ts` are their folders' entries, as the other
  folders had; `app/ui/index.ts`, an extension's page's, is unchanged (R211).
- **Where**: `app/ui/surfaces/mark.tsx`, `app/ui/{keys,text}/index.ts`.

## R239: The scenes' frames, in software, and what a transcript must do to keep them

- **Decision**: measured with `just frames`, once each on the final code, on the hidden display,
  which draws in software (R131, R175, R201), at 1400 by 800, 30 s each, the machine's load 1 to 3:

  | Scene       | Median | p95     | p99     | Worst    | Main thread, a second's mean                   |
  | ----------- | ------ | ------- | ------- | -------- | ---------------------------------------------- |
  | `streaming` | ≤ 3.45 | ≤ 4.70  | ≤ 6.03  | 6.39 ms  | paint 0.75, drain 0.28, layout 0.58 ms         |
  | `scrolling` | ≤ 8.09 | ≤ 9.06  | ≤ 10.04 | 10.33 ms | paint 3.79, drain 2.03, layout 0.37; 122 items |
  | `glass`     | ≤ 9.20 | ≤ 11.18 | ≤ 11.93 | 12.15 ms | paint 3.80, drain 2.38, layout 0.95; 123 items |

  Streaming meets the 8.3 ms at the 99th percentile. The two scrolling scenes do not, in software,
  by about 2 to 4 ms: the scroll is 900 points a frame, which binds every row of the window on every
  frame (122 mount items), and GTK paints the whole window in software, 3.8 ms of it. The glass bar
  adds about 1 ms. No measure on a GPU was taken here, as R131 says.

- **Found and fixed on the way**, each for the screens to keep:
  - **A row of a list keeps one structure for every kind of row.** Native Shell's list recycles a
    cell for any row, and has no kinds of row: the scene's message row swapped its views with `If`
    for a tool's call and a message, and made them again at each bind, two commits and 210 items a
    frame, 11.6 ms at the median. One structure whose bindings change: 8.1 ms. Keeping the row's
    text style the same across kinds changed nothing more.
  - **A growing reply is the list's last row, not its footer.** As the footer, the list stopped
    following its end once the reply passed the window, and the frames fell to 1 ms because nothing
    seen changed; as the last row, `maintainVisibleContentPosition` follows it to its end.
  - **A reply that shrinks is drawn again whole**: the first scene started its reply again every 4
    s, a spike of 10 to 14 ms each time. A reply only grows.
  - **`VirtualList` gives no `keyExtractor`** (R237).
- **If wrong**: the frames on a GPU are task 53's. The first thing to try there for a fast fling is
  fewer views per row; a scroll at a hand's speed binds a few rows a frame.
- **Where**: `app/gallery/scenes/session.tsx`, `app/gallery/frames.test.tsx`, `scripts/frames.sh`.

## R240: What the review of the pictures fixed in the library, and what it left

- **Fixed in the components**, each seen in `target/shots/gallery/`:
  - Light glass was a white card: the shader's sheen and edge glow add white over a light tint, and
    on a small panel they covered it. They are 0.18 and 0.1, from 0.5 and 0.3; the tint, which the
    contrast floor is measured on, is unchanged, and white only raised the contrast of dark ink.
  - A selected row on a raised surface had its bar and no fill: its fill was the raised fill. On a
    raised surface it is a wash of the ink, `row.selectedUp`.
  - A banner's fill was the badge's tint, 14%, which a warm tone over a raised fill turned brown:
    `control.wash`, 7% in a dark theme, 6% in a light one.
  - `Tabs` wrapped their last tab to a second row in a narrow part: one row, a tab's words cut.
  - The leader menu drew a key and a word: a chip, a `➜`, then the action, and a group `+name`, as
    the design language has it.
- **Left**:
  - The main button's glow in the light theme, which the language takes from the dark theme's lamp:
    soft and purple, it reads as light on white. The language's light theme turns light into ink for
    a pane's focus only; it says nothing of the lamp. A question for the human.
  - The dialog's dimming of the page behind is hard to see in the dark theme's pictures at 20%: as
    the language has it.
- **Where**: `app/ui/tokens/{glass,light,control}.ts`, `app/ui/lists/Row.tsx`,
  `app/ui/controls/{Tabs,Banner}.tsx`, `app/ui/keys/LeaderMenu.tsx`.

## R241: The store's server tests run in an app of their own, granted by a folder's `nsh.json`

- **Decision**: `store.test.ts` opens `app/store/harness/Harness.tsx` with `network: "live"`, and
  plays its host: each `step` event does one thing (connect, read, call, hold, release, drop), and
  the harness posts its `facts`, what a caller sees, after each change. Its rights are in
  `app/store/harness/nsh.json`: loopback, `URAEDA_SANDBOX`, and the host function `facts`. The
  `app/nsh.json` R233 named is unchanged.
- **Rationale**: measured on NSH 0.4.0. A test file's own engine has no network ("this host has no
  network stack") and reads only the default variables of `process.env`; an app opened with
  `network: "live"` has both. The bundler reads `capabilities` from the `nsh.json` of the entry's
  own folder only (`nsh-bundler`'s `bundle.rs`), and a declaration denies all it does not list:
  granting the variable in `app/nsh.json` would have restricted the app itself.
- **If wrong**: the harness is the store's only page; the steps are the test's vocabulary.
- **Where**: `app/store/harness/`, `app/store/store.test.ts`.

## R242: A record is held by the view that read it, and its list is rows of ids

- **Decision**: `record(name, args)` gives a `Live<V>`, an accessor of the value with `error`, and
  holds the record for the owner it is called in (`cleanup`); with nobody left, the `unsub` goes
  after the grace, 5 s, on a timer even with no grace, so a computation that runs again keeps its
  records. `list(source, "items")` gives `rows()`, `{ id }` objects kept per id, new only on an
  insert, a remove, or a move, and `item(id)`, from one signal per item. `text(source, path)` grows
  by appends. A value is never changed in place: a change copies only its path.
- **Rationale**: R171 asked rows kept by identity and one signal per item. A row that is the item
  itself would be stale after its item's first change, and a screen would read it; a row that is
  only an id cannot be misread. NSH has no hook for a signal's readers, so "while something reads
  it" is the owner's lifetime, as a component's.
- **Seen failing**: with a new `{ id }` at each insert, "a list keeps the objects of the rows that
  did not change" failed with
  `expected {"id":"a"} to be {"id":"a"} (an equal value, not the same one)`.
- **If wrong**: `record` called in a listener or at a module's top level is never let go: the README
  says so. A count of open subscriptions, `Connection.subscriptions()`, shows a leak.
- **Where**: `app/store/{records,held,apply}.ts`, `app/store/README.md`.

## R243: The connection's choices the contract leaves open

- **Decision**:
  - Ids are never reused on a connection. A gap is `unsub`, then `resume` under a new id; a change
    that does not fit, `unsub`, then `sub`. A message for an id no longer open is dropped.
  - The server's messages are applied together, in one `batch`, 16 ms after the first of them, on a
    timer, not `requestAnimationFrame`: a headless engine draws no frame, and a hidden window's
    calls would wait for one.
  - A call fails at once, `offline`, unless the line is welcomed, while connecting too; one whose
    line dropped fails `dropped`, "it may have been done".
  - The line keeps its own queue: NSH's WebSocket throws past eight messages waiting to be sent, and
    a pane reads many records at once.
  - The waits after a drop are 0.5, 1, 2, 4, 8, then 10 s; `refused` never tries again.
- **Rationale**: a reused id cannot tell an answer of the old subscription from the new one. The
  rest are what the contract's rules ask, measured where NSH limits them.
- **Seen failing**: a `resume` under another epoch made the server send the page whole, and "a
  reconnect resumes a reply without a gap" failed with
  `expected ["data","change",...] not to contain "data"`; one with an empty epoch failed its check
  of the message.
- **Where**: `app/store/{connection,line,errors}.ts`.

## R244: A change after its `unsub` shows only in the count of subscriptions

- **Decision**: the test holds what comes to one connection while another changes the record, lets
  the record go, then delivers: the change is ignored, nothing is sent in answer, and both the
  store's count and the server's (from what was sent) are 0.
- **Rationale**: the break the plan names, a change applied after its `unsub`, was made by keeping
  the id open in the store: the count stayed 1 (`expected 1 to be 0`). Applying the change itself to
  the dropped record changes nothing a caller sees, since a change's number is the record's, not the
  subscription's: the guarantee is that no subscription is left, and none is asked again.
- **Where**: `app/store/store.test.ts`.

## R245: `just app-test` starts a sandbox, for about 8 s more

- **Decision**: `app-test` is `{{ heavy }} scripts/sandboxed.sh {{ nsh }} test`, as R233 said.
  Measured warm on 2026-11-12, the machine's load about 4: 52 s for the suite before (96 tests, the
  store's server tests failing at once without a server), 60 s after, of which the store's tests are
  7.5 s, 4 s of it the fake's canned reply. `sandboxed.sh` builds `ura` first: nothing when it is
  built, 1.7 s to check; the first run in a new worktree built it in 71 s, once.
- **If wrong**: the build is the cost: a new worktree whose cloned `target/` holds a fresh `ura`
  pays nothing. Building `ura` with the feature's `just check` after a merge would give it to every
  task's worktree.
- **Where**: `justfile`, `scripts/sandboxed.sh`.

## R246: The host does what touches the machine, and the TSX asks it over NSH's host channel

- **Decision**: the Linux host, `uraeda` (`crates/app/src/bin/uraeda.rs`, `host.rs`,
  `server_start.rs`), finds or starts the server, pairs the device, and keeps its token. The app's
  TSX asks it with `host.call` of four names, granted by `capabilities.host` in `app/nsh.json`:
  `uraeda.server` (`{ address, local }`, once it answers), `uraeda.token` (the token, or `null`),
  `uraeda.pair` (`{ code }`, `{ key }`, or `{}` to pair with its own machine's server), and
  `uraeda.forget`. The shell reads them through `ShellHost` (`app/screens/shell/host.ts`). Without
  the Linux host, as under `just app-dev` or a test's picture, the app connects to a sandbox,
  `URAEDA_SANDBOX` or `http://127.0.0.1:4420`, with no token.
- **Rationale**: a process, a D-Bus call, and a wait of a minute are Rust's, and the host channel
  answers from any thread, so a start never holds the engine. A native module's function would have
  been importable by every extension page, which loads `uraeda/native`; an extension's page runs in
  a view with a host channel of its own (`extension_view.rs`), so it reaches none of these.
- **Alternatives considered**: `uraeda/native` functions, rejected for the reason above; the TSX
  pairing with `fetch`, rejected: the host keeps the token, so the host pairs.
- **Where**: `crates/app/src/host.rs`, `host/window.rs`, `app/screens/shell/host.ts`.

## R247: The token is an item of the Secret Service, over gio's D-Bus, or held for one run

- **Decision**: the token is an item of the session bus's Secret Service (GNOME's keyring, KDE's
  wallet, KeePassXC), in its default collection, found by `application = dev.uraeda.app` and
  `server`: `local <data folder>` for this machine's server, whose port may change between starts,
  or the remote address. The client is gio's `DBusConnection`, which GTK already brings: no new
  crate. A locked store shows its own prompt, which the call waits for, two minutes at most. With no
  store on the bus, the host pairs for the run alone, holds the token in memory, and unpairs it
  (`DELETE /session`) as the app closes: no file holds it, and no device is left behind.
- **Rationale**: the plan's rule, "never in a plain file". `keyring` and `oo7` would each bring a
  second D-Bus stack beside GTK's.
- **Seen failing**: `a device pairs once, and its token is in the secret store, not a file` ran on
  the hidden display's private bus, against a stand-in of the Secret Service
  (`crates/app/tests/host/secret_service.rs`), which refuses any other bus; with the host's
  functions stubbed it failed with `a server starts: "not built"`.
- **Where**: `crates/app/src/host/secrets.rs`.

## R248: `POST /pair` takes the access key as well as a code

- **Decision**: `POST /pair { key, name }` pairs a device with Uraeda's access key, as often as it
  is given; a wrong key waits its second and gets 401, "This is not Uraeda's access key.", as
  `POST /session` does. The pairing page takes either in one field: text starting with `ura_` is a
  key, anything else a code, whose letters and digits alone are sent, in capitals.
- **Rationale**: the task asks that a device pair with "the code `ura pair` printed, or the access
  key". The key already signs a browser in, for 30 days at a time: a device paired with it gains
  nothing the key did not give. The app has no cookie to keep, so the key's session could not serve
  it.
- **Seen failing**: the two rows added to `a_paired_device_signs_in_until_it_is_revoked` and
  `a_wrong_key_is_slowed_never_locked_out` failed with 401 for the key before the change.
- **Where**: `crates/server/src/sign_in/pairing.rs`, `crates/server/tests/sign_in.rs`.

## R249: The app stops only the server it started, and starts none once it closes

- **Decision**: `Local` keeps the `ura serve` process it started; `ensure` finds the data folder's
  server through `run/server.json` and believes it once `GET /session` answers 204 or 401, else
  starts one, its output in `run/server.log`, and waits up to a minute. A server that died is reaped
  and started again. `stop` stops only the process it started (SIGTERM, then SIGKILL after 10 s),
  and sets a flag after which `ensure` starts nothing. The window's close, and `SIGTERM`, `SIGINT`,
  or `SIGHUP` to `uraeda`, end the app the same way: a signal sets a flag the main loop reads five
  times a second. `--port` names the port of a server the app starts (4320 unless given).
- **Seen failing**: on the hidden display, a late `uraeda.server` call of the closing window, made
  as the connection dropped with the stopped server, started a third server after the app had
  stopped its own; it was left running until stopped by hand. The flag ends it. A killed server is a
  zombie until reaped, so the test reads its state in `/proc`, not `kill -0`.
- **Where**: `crates/app/src/server_start.rs`, `crates/app/src/host/window.rs`.

## R250: `routes.tsx` is a list of imports, one line per screen task

- **Decision**: `app/screens/routes.tsx` imports each screen's folder for its `definePlace` calls,
  one line under a comment of its own per screen task, so tasks that land at once change lines
  apart. A page no screen declared draws "Nothing here" in the frame, naming its place ("This app
  has no Inbox screen yet"), with the way home; an address of no page names it.
- **Rationale**: `definePlace` already ties a page to its panes; a second table would say it twice.
  A table typed over every page would fail the type check until the sixteen screen tasks landed.
- **Where**: `app/screens/routes.tsx`, `app/screens/shell/panes.tsx`.

## R251: What the frame shows, and what the layout shell gained

- **Decision**:
  - The rail: the places of `places.ts` (Home, Priorities, Inbox, Sessions, Decisions, Git, Jobs,
    New, Settings), each with its `g` key; its title is the repository, pressed for the switcher.
    Unfolded, under them: Needs you (every repository's), Features (the repository's), and Usage
    (one line per login), each only when it has a row, in a scroll. A row is two lines, its name,
    then its state in the state's colour: one line crushed the name to a letter a line.
  - Folded, the rail's foot is the bar of the account of the session in view, else the one a new
    session starts on (`barWindow`).
  - The status line: the mode, the branch, the hints, "N need you", the extensions' items, the
    connection's word, and the repository at the right end.
  - "Server stopped": a banner on a raised, opaque surface above the status line: at the top, and as
    glass, it covered the panes' titles and let their text through.
  - In `app/ui/layout/`: `RailSlots` gained `bar` and `onTitle`; `Stacks` reads the status line's
    slots one by one, as its spread read them once and left the repository's block empty; the
    phone's bar of places scrolls sideways, nine places being wider than 390 points.
- **Where**: `app/screens/shell/{Frame,Sidebar,Status,places,usage}.tsx`, `app/ui/layout/`.

## R252: The shell's tests run on a played host, and the host's on the real `ura serve`

- **Decision**: `app/screens/shell/shell.test.tsx` opens `__checks__/Shell.tsx`, the real shell with
  a `ShellHost` the test plays through host events (`started`, `stops`) and the store's line seam (a
  `hello` one version off), over the sandbox; the folder has its own `nsh.json`, as R241's harness
  does. `crates/app/tests/host.rs` runs the real `ura serve`, built by the test with
  `cargo build -p uraeda-cli`, on temporary folders, with the agents' stand-ins first on its `PATH`.
- **Rationale**: the guarantees are the host's processes and the store's refusals, which a stand-in
  of either would not prove.
- **Measured**: the test builds `ura` in `target/host-tests/`, a target folder of its own. In the
  workspace's, a `cargo build -p uraeda-cli` resolves the features of the crates it shares with the
  app's tests otherwise (their dev-dependencies turn more on), and each build undid the other's: 35
  s per run, every run. Now the first run in a worktree builds it, 75 s, and later runs take 0.8 s
  and 3.5 s, for 4.1 GB of disk, which a new worktree clones. The shell's two take 3.6 s.
- **Seen failing**: the shell's two tests with `Root` drawing nothing (`on screen: []`); the host's
  two with `not built`.
- **Where**: `app/screens/shell/`, `crates/app/tests/host.rs`.

## R253: `just app-shots` reads a route from the app's environment, and a theme from its host

- **Decision**: `just app-shots /r/<repository>/<page>` sets `URAEDA_ROUTE`, which the app reads as
  it starts, and runs `app/screens/shots.test.tsx` beside a fresh sandbox on the hidden display; a
  word, `pairing`, `refused`, `stopped`, `starting`, or `states`, pictures the shell's own states
  through its checks' app. The theme is `host.params.theme`, which the app's `scheme()` reads before
  the system's: a light picture came out dark with `open`'s `colorScheme` alone, as the gallery
  found. No `app/tools/shots.ts`: the recipe needs no code beyond the test.
- **Where**: `justfile`, `app/screens/shots.test.tsx`, `app/screens/shell/boot.ts`.

## R254: An import refuses a running server, and takes back the images of a failed one

- **Decision**: `runner::import` is refused, with `ImportError::Running`, while a server runs on the
  new store's data folder: its status file names a process that is alive (`status::running`). The
  words say to stop it first. Every import is refused, not only `--replace`: an import into an empty
  store still writes sessions the running server never read. The images are copied inside the
  transaction, as before, and every one it copied is removed when the import fails, its commit
  included, so the count it reports is what it did.
- **Rationale**: a running server holds its turns, timers, and job runs in memory; an import that
  empties its store under it mixes imported turns into live ones (both reviewers). A status file a
  killed server left names a dead process, and is ignored. Copying after the commit instead would
  leave a landed import whose images failed, which reads as neither all nor nothing.
- **If wrong**: a process that took a dead server's id since reads as a server: the way out is to
  remove `run/server.json`.
- **Seen failing**: `an_import_refuses_the_store_of_a_running_server` (it imported), and
  `a_failed_import_leaves_no_image_behind` ("no image is left").
- **Where**: `crates/server/src/{status.rs,runner/import.rs}`.

## R255: A landing takes the repository's turn, and no queue opens once the stop began

- **Decision**: a deferred commit lands in the repository's turn, as a write of its own already did:
  one writer touches the main checkout at a time, git's hooks included. A write that arrives while a
  commit lands waits for that one landing, then goes before the next one, which takes its ticket
  only once the first ended: a save waits for one hook at most, never for the queue behind it. Once
  the stop began, `Queues` holds no map: a write or a landing is refused ("The server is stopping:
  nothing is written any more."), and a write waiting for its turn, or one that found its queue
  before the stop, is refused too, so no queue opens and no thread is left unjoined.
- **Rationale**: the core stages under its write lock but runs `git commit` and its hooks outside
  it, so a save could write the checkout while a hook that stashes what is not staged (`lint-staged`
  style) ran: the save's text taken away, swept into the commit, or a pop that conflicts. **The Node
  server did not protect it either**: its landings ran on their own chain (`#tail`), outside the
  committing calls' turn, and its saves took no turn at all, so a save never waited for a hook, and
  could run inside one. The safe order costs that wait: **a save, or a committing write, that
  arrives while a slow hook runs answers once that hook ended**, where the Node server answered at
  once. The editor keeps its text meanwhile, and the connection's next calls are not held
  (`live::placed`). A refusal at the stop is safer than running without deferral: nothing is half
  done, and the stop does not wait for a hook it did not start.
- **If wrong**: when the wait for a hook is felt, a repository without hooks could let writes run
  beside a landing (git's commit alone never touches the working tree): the human arbitrates between
  that wait and the risk.
- **Seen failing**: `a_save_never_writes_while_a_commit_lands` ("the save ran while the commit's
  hook ran"), and `no_write_opens_a_queue_once_the_stop_began` with the map refilled at the stop.
  `two_writes_on_one_repository_land_in_order` sends its writes while the first commit is held, and
  checks none ran before it landed.
- **Where**: `crates/server/src/records/writing/{queue.rs,queue/repository.rs,queue/tests.rs}`,
  `crates/server/src/live/mod.rs` (`test_bus`).

## R256: A write checks its feature's agent again once its turn came

- **Decision**: `writing::write` refuses a write of a feature's files while its agent works twice:
  as it arrives, so a refused write is refused at once, and again once its turn came, right before
  it runs. No reservation is held through the write.
- **Rationale**: the turn may wait for a commit's hooks (R255), and an agent may start meanwhile
  (Codex's P2): the second check closes that wait. What is left is the write's own run, a few
  milliseconds of a save, during which a session's start does not wait for it. A reservation that
  start would wait on (`Runner::hold`, the moves' hold) refuses a message with "The agent is
  working" instead of waiting, which a save of a few milliseconds should not cause.
- **If wrong**: a start that lands inside that run: the starts would wait for a hold of the write's
  folders, a hold that waits rather than refuses.
- **Seen failing**: `a_write_is_refused_when_an_agent_started_while_it_waited`, the save answering
  as written.
- **Where**: `crates/server/src/records/writing/queue.rs`.

## R257: Code that is not the server's gets no credential and sets no cookie, by one rule

- **Decision**: `crate::http::foreign` holds the rule the previews' proxy kept for itself: a
  request's `Authorization` and `Cookie` never reach code that is not the server's own, and an
  answer's `Set-Cookie`, `Set-Cookie2`, and `Clear-Site-Data` never come back. The previews' proxy
  and the extensions' routes both use it. The server has no other credential header: the host token
  travels as `Authorization: Bearer`, and the frame secret in the path. The API's declarations say
  it. An extension's route path is cut after `/r/<name>`, the first part after `/r/`, so a
  repository may be named `x`.
- **Rationale**: an extension's route got the owner's session cookie and a device's 30-day token,
  and could set or clear the owner's session (findings 01, 3): it could then act as that client,
  beyond its own API. The path was cut at the first `/x/` of the whole path (finding 5).
- **Seen failing**: `a_route_gets_no_credential_and_sets_no_cookie`, first with 404 "echo has no
  route /x/x/echo/headers", then, with the path fixed and the filters taken out, with the session's
  cookie in the headers the extension echoed.
- **Where**: `crates/server/src/http/foreign.rs`, `crates/server/src/extensions/routes.rs`,
  `crates/server/src/preview/proxy.rs`, `fixtures/extensions/echo/server.ts`.

## R258: An extension reads a file up to 64 MB

- **Decision**: `uraeda:fs`'s `readText` and `readBytes` refuse a file over 64 MB before reading it,
  by its size, and a file that grows past it while read, through a read bounded at one byte over:
  "`<path>` is over 64 MB, the most an extension reads at once", thrown as every refusal of
  `uraeda:fs` is, which the extension can catch. The API's declarations say it.
- **Rationale**: the server held the whole file before the VM's 256 MiB limit applied, then copied
  it as base64 or a string: a large file could exhaust the server's memory, and take every extension
  and session down (Codex's P1), which the extensions decision forbids. 64 MB is `fetch`'s limit for
  an answer, and leaves the VM room for the copies a read makes.
- **Seen failing**: `extensions::fs::tests::a_file_over_the_limit_is_refused_before_it_is_read`, on
  a sparse file one byte over the limit, which the read accepted.
- **Where**: `crates/server/src/extensions/{fs.rs,api/server.d.ts}`.

## R259: The session store reads on a connection of its own

- **Decision**: `Store` opens `sessions.sqlite` twice: the connection that writes, as before, and a
  read-only one, opened once the writer made the file and its schema, which every `Store::read` uses
  inside one read transaction, so a read's statements see one state of the store. Writes, their
  transactions, and `Store::write` are as they were; `Store` is still the only code that opens the
  file, and `close` drops the reader first, so the writer's close folds the log in.
- **Rationale**: one mutex around one connection made every read wait behind every write, and the
  standard mutex is not fair: with agents streaming, a page read starved (finding 7). In write-ahead
  mode a reader never waits for the writer. One reader, not a pool: reads are short, and a second
  lock is the whole change.
- **Measured**, once each, by a throwaway test: four threads appending text pieces to four turns as
  fast as they can, while one thread reads the last page of a turn of 2,000 events, for 3 s. Before:
  18 reads, mean 167 ms, median 82 ms, p99 769 ms; 54,010 writes. After: 5,080 reads, mean 0.59 ms,
  median 0.58 ms, p99 0.82 ms, max 1.4 ms; 41,578 writes, the writers now sharing the machine with a
  reader that runs.
- **If wrong**: a read that must see a write the same thread made a moment before still does: a read
  transaction begins after the write committed.
- **Where**: `crates/server/src/runner/store.rs`.

## R260: The session store's schema is one first step

- **Decision**: the four steps of `sessions.sqlite`'s schema (the first tables, the lines' numbers,
  the session's account, the jobs' runs) are one first step, schema 1, with no `steps_taken` shim
  and no `IF NOT EXISTS`. The steps that come after it are added at the end, as before; a store of a
  newer schema is still refused, untouched.
- **Rationale**: no store of this schema shipped, and the project keeps no upgrade path (finding 8):
  the shim served stores two parallel tasks wrote, each with its own step 3, and the second step's
  backfill of the lines' numbers served stores written before it, in development only. Folding them
  reads as the schema it is, and drops the backfill's query. The two tests of those upgrade paths
  went with them.
- **If wrong**: a development store at schema 2 to 4 is refused as "written by a newer Uraeda": it
  is rebuilt, `just sandbox --reset` for the sandbox's, or by removing `sessions.sqlite` from the
  data folder.
- **Where**: `crates/server/src/runner/schema.rs`, `crates/server/tests/sessions/pages.rs`.

## R261: An extension's page runs only while its view is in a window

- **Decision**: a page fetched while its `uraeda.extension` view is in no window waits, and runs
  when the view is put in a window again; a view dropped runs nothing. A page's calls are numbered
  across its loads, so the app's late answer to a call of the page before matches no call of the new
  one.
- **Rationale**: NSH 0.4.0 takes a removed element out of its window at once (`MountItem::Remove`)
  and drops its component only later, when the element is deleted: a flag set in `Drop` was still
  unset when the fetch ended, and the page ran in a stopped view, in an engine nothing stops
  (`Surface`'s drop does not stop it). Waiting instead of discarding keeps a pane that is moved, out
  of its window for a moment, loading its page.
- **Seen failing**: `a_page_fetched_after_its_place_closed_never_runs` counted 3 engines for 2, with
  the `Drop` flag alone too; `a_late_answer_reaches_only_the_page_that_asked` got 99, the old page's
  answer, for 4.
- **Where**: `crates/app/src/extension_view.rs`, `extension_view/channel.rs`,
  `crates/app/tests/extensions.rs`.

## R262: The phone's bar holds the places visited most, a `…` for the others, and New last

- **Decision**: on a narrow window the top bar shows Home, Priorities, Inbox, Sessions, and Git,
  then a `…` whose menu holds Decisions, Jobs, and Settings, then New. A place says where it goes
  with `onPhone` (`RailPlace`, `app/screens/shell/places.ts`): on the bar unless given, `more`, or
  `end`. The `…` is the current tab while one of its places shows, and carries their count.
- **Rationale**: nine places at 44 points each, beside the sidebar's toggle, are wider than 390
  points: Settings was off-screen until the bar was scrolled. `specs/ui/phone.md` puts the least
  visited places in a `…`, as the old phone did, and rule 1 keeps the places used most one tap away.
  Eight controls fit from 375 points; narrower, the bar still scrolls rather than cut.
- **Where**: `app/ui/layout/bars.tsx`, `Rail.tsx`, `app/screens/shell/places.ts`, `Frame.tsx`.

## R263: Every time the app shows reads in the server's zone, through `serverTime`

- **Decision**: `app/store/time.ts` exports `serverTime(at, now?)`, "15:08" today, "Tue 15:08"
  within a week, "12 Nov 15:08" this year, "12 Nov 2025" before, and `serverClock(at)`, the parts.
  The wall clock is read in Rust (`zonedClock`, `crates/app/src/time.rs`, with jiff and the system's
  time zone database): NSH's JavaScript has none. The zone is the record `Jobs`'s `timeZone`, which
  the frame reads for the repository shown and hands to `setServerZone`; until then, times read in
  the device's zone. The sidebar's usage resets use it.
- **Rationale**: rule 8. One helper, in the store every screen imports, so no screen reads `Date`'s
  hours, which are the device's.
- **If wrong**: the zone belongs in the server's `welcome`, server-wide, with no repository: a
  change of the protocol and of `crates/server/`, left to the server's side.
- **Where**: `app/store/time.ts`, `crates/app/src/time.rs`, `app/screens/shell/Frame.tsx`.

## R264: An extension page's view reads the app's files, and its fonts with them

- **Decision**: `uraeda.extension` makes each page's view with the app's asset location: the one the
  Linux host gives at its start (`share_app_assets`), else, under NSH's development host
  (`just app-dev`, `just app-shots`), the development server's `/assets/`, by the same rule that
  host applies to the app's own view.
- **Rationale**: "font failed: asset:/@uraeda-app/…: no asset location configured" in the route
  pictures came from the pages' views, made with no location: each page engine registers the UI
  sets' fonts, the app's bundled ones, and failed, so a page drew in the system's fonts. The app's
  own view was not concerned: R156's check guards it, with the location a package has; the new
  `a_page_draws_in_the_app_s_bundled_font` guards the pages'.
- **Seen failing**: with the view's location taken away, the new test timed out with no text in
  Monaspace Neon; after the fix, `just app-shots /` logged no font failure.
- **Where**: `crates/app/src/extension_view.rs`, `crates/app/src/host/window.rs`.

## R265: What a page declares is kept on the device, by the page's version

- **Decision**: every `ready` of a page's view keeps its declarations under `declared:<name>` on the
  device, with the page's version (`app/extensions/declared.ts`). `ReadDeclarations` runs a page
  unseen only while the device knows nothing for its current version; the status line's items read
  `declaredBy`.
- **Rationale**: each extension with a page ran one hidden view at every start, for its declarations
  alone. Now that happens once per version per device. The server reporting them in its record would
  stop even that, but the server would have to run the page to learn them.
- **If wrong**: a version number reused by a server built anew could show the old declarations,
  until any part of the page draws and says them again.
- **Where**: `app/extensions/declared.ts`, `ExtensionPlace.tsx`, `app/screens/shell/Status.tsx`.

## R266: A server found at another address takes the same connection there

- **Decision**: `Connection.moveTo(address)` reconnects at a new address, keeping every record's
  value, `stale()` until the server there answers each. The shell moves its connection when this
  machine's server starts again on another port, instead of making a new one; `address` is a signal,
  which an extension page's view follows.
- **Rationale**: a new connection drew "Reaching Uraeda's server", then a frame of empty records:
  the Features pane and the branch vanished, and came back. A resume from an unknown epoch is
  answered with `data`, so nothing more is needed for the new server's values.
- **Seen failing**: with `moveTo` emptying the records,
  `a server found at another address keeps the records' values, stale, until its own come` failed,
  `expected false to be true`.
- **Where**: `app/store/connection.ts`, `app/screens/shell/Root.tsx`.

## R267: The app's tests have a second sandbox, with sign-in on

- **Decision**: `scripts/sandboxed.sh` starts a second sandbox beside the first, with `--sign-in`,
  and gives its address and access key as `URAEDA_SANDBOX_SIGN_IN` and `URAEDA_SANDBOX_KEY`.
  `a revoked device is sent back to pairing` pairs a device with the key through the pairing page,
  revokes it from a second paired device with `devices.revoke`, and sees the pairing page again,
  with why.
- **Rationale**: pairing against a server with sign-in, and a revoked token, were never run by a
  test. The test passed at once: no fix was needed. With the shell ignoring a sign-in refusal, it
  failed after 20 s, the frame still shown.
- **Where**: `scripts/sandboxed.sh`, `app/screens/shell/shell.test.tsx`, `__checks__/Shell.tsx`.

## R268: A pane's remembered value takes the type its first value stands for

- **Decision**: `usePane().remember(name, 0)` is a `Remembered<number>`, not `Remembered<0>`, and so
  for texts and booleans; a type given, `remember<string | null>`, is kept.
- **Rationale**: a pane written from the guides alone, keeping a `VirtualList`'s offset as
  `panes.md` now shows, failed the type check: `offset.set` took only `0`. The guide's example also
  read records that do not exist (`session`, `sessionChanges`), imported keys past the folder's
  index, and said nothing of a list's cursor and scroll, nor of an absent repository: all fixed.
- **Where**: `app/ui/layout/panes.tsx`, `specs/ui/panes.md`, `specs/ui/components.md`,
  `app/store/README.md`.

## R269: A place may show its stacks split from the start, and Home's both are

- **Decision**: `definePlace(page, panes, { split })` names the stacks that show all their panes at
  once until the human makes them tabs: `Place.split`, which `layoutOf` reads. Home splits both:
  Needs you and In progress in the main stack, the inbox, Priorities now, and Usage in the side one.
  On a phone, one pane at a time, the bar at the foot switching, as every place.
- **Rationale**: Home is read at a glance, "what needs them, what runs, what is next": as tabs, it
  showed Needs you alone, and the rest one key away each. The layout already drew a split stack;
  only a place could not ask for one.
- **Alternatives considered**: one Home pane drawing every part: a second frame inside a pane, which
  the panes guide forbids, and no part could move to the other stack (task 66).
- **Where**: `app/ui/layout/{layout.ts,panes.tsx}`, `app/screens/home/index.tsx`.

## R270: Git's place is `g c`, and `g g` is a list's first row again

- **Decision**: the Git place's key is `c` (`g c`, `Space c`), not `g`.
- **Rationale**: `g g` is every list's "first row" (`listKeys`, as in Vim and the React UI), and the
  shell's `g g` for Git made the registry throw "A key means two things" as soon as a list was drawn
  in a pane: the priorities page could not open. `c` was free after `g` and `Space`.
- **If wrong**: another letter in `PLACES`; never `g`.
- **Where**: `app/screens/shell/places.ts`.

## R271: The priorities' sections each own a key scope; `H` `L` send a row across them

- **Decision**: each section (Ongoing, Now, Next, Later, Blocked while it holds any) is a
  `DragOrder` (Ongoing a `List`) in a `KeyScope` of kind `pane` of its own, on while it has the
  pane's focus, so their `j` `k` `m` `a` never clash. `h` `l` cross the columns, and return `false`
  past the last, so the frame crosses the stacks; in one list, `j` `k` past a section's end go on
  into the next, from a scope beside the sections', whose keys run only where a section's did
  nothing. `H` `L` send the row under the cursor to the section before, at its end, or after, at its
  start: carried across the line between them. By touch, the proposal's pane has "Move it to the top
  of" Now, Next, Later, Blocked. One cursor shows at a time: entering a section lets the others' go.
  A narrow stack, a phone's or the side's, shows one list; `v` and the switch are for a wide one,
  the choice kept on the device (`DeviceKeys["priorities.view"]`).
- **Rationale**: `DragOrder` orders one list, and Now, Next, and Later are three: a drag between
  columns would need a second component for a rare move. `H` `L` say where the row lands by a rule
  that reads aloud.
- **Where**: `app/screens/priorities/{Priorities,Section}.tsx`, `app/store/device.ts`.

## R272: A reorder is one `sent` value of the whole order, written in the order made

- **Decision**: the page shows the server's order with the human's moves over it (`createOrder`,
  over `sent`): a move shows at once, is sent once as `proposals.move`, after the moves before it,
  and a refusal puts the rows back and says why under the section it was made in ("The priorities
  changed elsewhere, and show as they are now: move it again."). A move names the proposal by its id
  in the order before it (`next-2`), and its place in the file among the section's lines, the
  running ones counted (`fileIndex`); its hash is the one the last write answered until the record
  shows it, so a second move sent before the record caught up is not refused as a conflict.
- **Seen failing**: with every move sent twice, `a reorder is saved once, in the order shown` failed
  (two `proposals.move`); with a refusal swallowed, the refused test waited for its words in vain.
  The checks' app's posts were first refused: a post is listed only for a name in `open`'s
  `host.handlers`, and granted in the folder's `nsh.json`.
- **Where**: `app/screens/priorities/{moves,order}.ts`, `app/screens/priorities/__checks__/`.

## R273: A proposal's address shows its line, until task 38's pane takes its place

- **Decision**: `/priorities/<key>` shows the proposal as its line reads, `proposal-summary`, the
  subject in the main stack, with the priorities in the side one: where it stands, its words, its
  nested lines, its file's path, "Open its feature" or "Open its file", and the moves to another
  section. A key no longer there says so, with the way back. Task 38 joins without a change here: a
  kind of pane named `proposal`, with the arguments `{ repo, key }`, declared anywhere, takes the
  summary's place in its kind's stack (`kindOf` at the place's call).
- **Rationale**: the priorities record gives the line's spans, not a document's tree: the document
  renderer has nothing to draw until the proposal's file is read, which is task 38's record.
- **Where**: `app/screens/priorities/{index,Proposal}.tsx`.

## R274: Home is five panes, and leaves Continue all, Recent, and Setup out

- **Decision**: Needs you is the server's `NeedsYouList`, this repository's first, then the others',
  each card naming its reason as its state and the server's words under its title, with the features
  whose problems stop the workflow first; In progress is the features in flight that wait on an
  agent, the ones at work first, then the chats at work; the inbox's pane puts its field first
  (Enter adds a note, `a` reaches it), then its three latest notes; Priorities now is Now's first
  five that do not run; Usage lists each agent under its mark, each account by name with every
  window, "5h 58% left - reset 15:08", a window nearly gone in the danger's colour, "b · signed
  out", "c · no folder". Left out: Continue all, whose rule (`continuedByAll`) is the Node server's
  and has no field in the protocol to read, so the button would guess, against the stack decision;
  Recent, the merged features, which carry no date to order by; the Setup pane and the banners of
  drops, which the new page and task 50 own.
- **If wrong**: Continue all needs `FeatureStatus.continuable` from the server, then a button in
  Needs you's pane.
- **Where**: `app/screens/home/`.

## R275: Usage has one reading of the record, the sidebar's and Home's

- **Decision**: `usageByAgent` in `app/screens/shell/usage.ts`, beside the sidebar's `usageLines`,
  with the same `leftOf` and `resetWords`; `iconNamed` reads the server's names of agents' marks,
  `uraeda:harness-claude`, which drew nothing before.
- **Where**: `app/screens/shell/usage.ts`, `app/ui/controls/Icon.tsx`.

## R276: The inbox's add is a field at the top of its pane, and its rare actions are icons beside it

- **Decision**: the inbox pane opens on a one-line field, "Add a note: Enter adds it", with three
  icons after it on the same row: add images to the new note, Organize with AI (while no triage
  exists), and New category. Enter adds the note and keeps the focus there for the next one; `a`
  focuses it from the list, in the category of the row under the cursor, and `Space n i` opens the
  inbox with it focused from anywhere. "New category" is also the list's last row, after every note.
  The old page's ＋ opened a form: one tap more, and its New category icon sat where the add was
  expected.
- **Rationale**: the human's complaint ("It's the inbox: it should be accessible in one click") asks
  for the add to be the first thing, one tap or one key away. A field that is always there is one
  tap on a phone and one key on a desktop; a note typed and not added is kept on the device by the
  shared field's unsaved store (`unsavedText`), whose own test guards it across a restart, so the
  task adds no test of its own.
- **Where**: `app/screens/inbox/{AddNote,InboxPane}.tsx`, `app/screens/shell/keys.tsx`.

## R277: A note's pane sits beside the list, in side; on a phone it is the pane shown

- **Decision**: `/inbox/<key>` shows the list in main, where it was on `/inbox`, and the note in
  side. Enter or a press on a note from `/inbox` opens its page with the focus on the note's pane,
  so a phone shows the note, the list one tile away; from `/inbox/<key>`, another note replaces it
  in the same visit (`redirect`), so Back returns to the inbox, not through every note read. A note
  saved under a new text has a new key: its pane follows it by its id. `/inbox/triage` shows the
  triage in main and the inbox in side, so a note a question names is read where it sits.
- **Rationale**: the list does not jump to the other stack as a note opens, and a note's pane, a
  field and a few actions, reads well at a side stack's width. The reverse, the note in main, moved
  the list across the window at each opening.
- **Where**: `app/screens/inbox/{index.tsx,InboxPane.tsx,NotePane.tsx}`,
  `app/screens/triage/index.tsx`.

## R278: The inbox is a flat list, not an outliner; its last action has its own Undo until task 50

- **Decision**: the list is one cursor over the notes and the categories' rows, `j` `k` and Enter,
  with `a` add, `d` delete (a note, or a category, whose notes stay without one), `c` move to a
  category, `p` make it a proposal (a section's line or file, under a proposal, or into a proposal
  file), `C` new category, `R` rename. A note's sub-items show in its pane, read only: the old
  page's outliner (indent, outdent, nested drags, an add beside each row) is not ported, and
  `inbox.outline` and `inbox.drop` stay unused. An undoable action never asks first: the inbox's
  banner says what it did, where the note went with the way to it, and Undo (`u`), through
  `undo.apply`. Marked `TASK 50:` in `app/screens/inbox/actions.ts`, for the app's undo stack to
  replace, with its `u`.
- **Rationale**: the inbox is a place to drop and sort thoughts; editing nested outlines of a note
  is rare, and `INBOX.md` or the note's file, one press away, does it. An outliner is the largest
  part of the old page, and the most fragile.
- **If wrong**: an outline of a note in its pane, over `inbox.outline`, which the server serves.
- **Where**: `app/screens/inbox/`.

## R279: Images come by picker, paste, and drop; the app reads dropped files from home and `/tmp`

- **Decision**: an image is held for the new note, or sent to the note shown, through
  `POST /r/<name>/inbox/note-image`: from NSH's `Picker.pickImages` (an open panel on GTK, the photo
  picker on a phone), from `Clipboard.readImage` on `Ctrl+V` (heard in the fields too, which then
  get the clipboard's text when it holds no image), and from `onFileDrop` on the pane, whose `file:`
  URLs `fs/promises` reads. `app/nsh.json` gains `"fs": { "read": ["${homeDir}", "/tmp"] }` for that
  read. Images are drawn by fetching them with the device's token into a `blob:` URL: an `Image`'s
  source carries no header.
- **Rationale**: NSH's editor inserts only the text of a paste, and drops images; and a drop gives
  paths, not bytes. Files dropped from elsewhere than the home folder or `/tmp` are refused, with
  NSH's words under the pane.
- **Where**: `app/screens/inbox/images.ts`, `app/nsh.json`.

## R280: The triage asks one question at a time, a letter answers and goes on

- **Decision**: `/inbox/triage` shows one question at a time, with its context drawn by `Document`,
  why it matters, its options as `SelectableCard`s with their pros and cons, and a comment. A
  letter's key (`a` to `f`, in a selection scope, so `b` is the answer and not Back while a question
  is shown) picks one option, saves it with `defaultRound.answer`, and goes on to the next question;
  a press picks and stays, for a comment, which `i` focuses. `n` `p` move between questions; after
  the last, its end lists the questions without an answer, the notes, and Submit, a button only,
  disabled until every question has its answer. A comment and the notes are kept on the device until
  saved, as their field leaves. An answered triage reads its answers under the banner that applies
  them in a chat (`session.newChat`, then `session.send`), or dismisses it. The two messages,
  organize and apply, are the old server's words, now in `app/screens/triage/chat.ts`.
- **Rationale**: the task asks for a fast keyboard flow, one key per answer, and no answer typed
  lost. Task 42 builds the rounds of features: this one is the triage's own, small, and its question
  view can move there if task 42 wants one component for both.
- **Where**: `app/screens/triage/`.

## R281: A list's first row is `Home`, not `g g`, which goes to Git

- **Decision**: `listKeys` no longer binds `g g`. `G`, `Home`, and `End` stay. The join of tasks 40
  to 48 replaced it: Git's place is `g c` (R270), and `listKeys` binds `g g` to the first row again,
  as an ordinary key.
- **Rationale**: the shell binds `g g` to the Git place (`g` then a place's key, Git's being `g`),
  on in every pane, so the first `List` drawn in a pane threw "A key means two things in Inbox: "g
  g" is bound twice, to Git and to first row". One of the two had to yield; a place's key is reached
  from everywhere, the first row of a list by `Home` too.
- **If wrong**: Git's place takes another key, and `g g` comes back to lists.
- **Where**: `app/ui/lists/keys.ts`.

## R282: A `SelectableCard`'s title wraps

- **Decision**: the title of a `SelectableCard` takes the row's width and wraps, as its words do.
- **Rationale**: the triage's options are sentences: in a row with no width of its own, the title
  ran past the card's edge, cut, at every width.
- **Where**: `app/ui/lists/SelectableCard.tsx`.

## R283: A `Banner` reads its action and its words once

- **Decision**: `Banner` holds `action` and `children` in a `computed`, and draws what it holds.
- **Rationale**: a prop holding elements makes them again at each read: the banner read `action`
  once to test it and once to draw it, so a button with `keys` in it was declared twice, and threw
  "A key means two things in Inbox: "u" is bound twice, to Undo and to Undo". Seen in the inbox's
  Undo, by driving the app with its keys.
- **Where**: `app/ui/controls/Banner.tsx`.

## R284: The feature page is five panes, its subject and steps in the main stack

- **Decision**: `/f/<folder>` declares five panes, in this order: `feature-overview` ("Overview":
  the title and its facts, the status, what stops it, **Next** with the one main action, the message
  a continue sends, what a merge left, the check's notes, and Drop) and `feature-steps` ("Steps":
  each stage of its history with its times, its files and mockups under it) in the main stack;
  `feature-sessions` (a card per session), `feature-decisions` ("Decisions": what it touches in the
  ledger), and `feature-figures` ("Figures": what it produced and cost, and its branch, worktree,
  folder, and pull request) in the side stack. On a narrow window the frame folds them into one
  stack in that order: what to do, where it is, who works, what it touches, what it cost.
- **Rationale**: the main stack holds the subject, where the feature stands and its files; the side
  stack holds companions read beside it. Sessions come first there, as what works on the feature now
  is what the human checks most while it runs. The old page stacked every part in one column, with a
  column of figures and links beside it and a bar of sheets on a phone: the frame's two stacks and
  their tabs replace all three.
- **If wrong**: the order is `definePlace("feature", ...)`'s list in
  `app/screens/feature/panes.tsx`, and task 66's moves let the human keep another.
- **Where**: `app/screens/feature/`.

## R285: "Next"'s continue starts the run from the page, its message readable above it

- **Decision**: when the agent's step has a recommended message, **Next**'s main action, labelled
  with the message's name ("Continue, write the plan"), sends it with `session.send` (`folder`,
  `text`, `workflow: { trigger, step }`), then opens the session it went to. The message is shown
  whole, folded under **Next** ("The message it sends"). The button is the pane's one main action,
  breathes, and takes `n`; no field is involved, so Enter never starts a run. The old page opened
  the session with the message unsent in its composer. Marked `TASK 38:` in `Overview.tsx`: the
  start dialog, with the run's options at full size, replaces this plain start.
- **Rationale**: the task asks for a plain start until the start dialog lands. A press of a labelled
  button after the message can be read is deliberate (rule 2); a detour through a composer only to
  press Send again is a second step that decides nothing.
- **If wrong**: `run` in `Overview.tsx` navigates to the session page instead of sending, once task
  43's composer takes a message to offer.
- **Where**: `app/screens/feature/{Overview,next}.ts*`.

## R286: The decisions a live feature touches are read from its branch's changed files

- **Decision**: the Decisions pane of a merged feature lists `History.decisions`, which the core
  fills for a done item only. Before the merge it lists the files under `specs/decisions/` that
  `BranchChanges` names, "new" when the ledger (`Ledger`) has no decision of that name, "changed"
  otherwise, with the ledger's title and icon.
- **Rationale**: the old page showed decisions only in a done feature's record. The ledger a branch
  touches is what the human reviews before the merge. `BranchChanges` lists the first 50 changed
  files: a branch that changes more misses some.
- **If wrong**: the core's `history` computes the decisions for a live feature too, and the pane
  reads `History.decisions` alone.
- **Where**: `app/screens/feature/Decisions.tsx`.

## R287: What the old feature page did that this one leaves out, and why

- **Decision**: left out: **Rename** (the sidebar card's settings, `item.settings`, belong to the
  sidebar's own task), **Postpone** (its message was written in the React UI's TSX: the workflow's
  text belongs to the server, which has no such message yet), the record of a done feature drawn in
  the page (its `record.md` is listed under Merged in Steps, and opens in task 41's panes), the
  picker of sessions on `s` (the Sessions pane's cursor and `Enter` replace it), and the phone's bar
  of sheets (the frame's tabs replace it). Times are read in the device's zone, as the shell's usage
  lines are: no record gives the server's zone but `Jobs`.
- **If wrong**: each is a button of the Overview's foot, beside Drop, once its action exists.
- **Where**: `app/screens/feature/`.

## R288: Git's go key is `g c`, and `g g` a list's first row

- **Decision**: the rail's Git place goes by `g c` and `Space c`, where task 36 gave it `g g` and
  `Space g`.
- **Rationale**: every list declares `g g` for its first row (`app/ui/lists/keys.ts`, the keyboard
  guide's table), in the scope of its pane, which meets the shell's: the registry threw "A key means
  two things in Sessions: "g g" is bound twice, to Git and to first row" as the first pane with a
  list was drawn, and the page stopped. The guide's own go keys gave `c`, commit, to the page Git
  replaced, and `/commit` still opens it.
- **If wrong**: a pane's key shadows the shell's in the registry, and Git takes `g g` back.
- **Where**: `app/screens/shell/places.ts`.

## R289: A card's fact wraps under its icon's line

- **Decision**: a fact of `Card` shrinks to the card's width, its words wrapping, its icon on the
  first line. It was a row that did not shrink: in the side stack, a session's "Last run: Build,
  running for 5 s" was cut at the card's edge, and a failed run's words, the reason the human opens
  it, would have been too.
- **Where**: `app/ui/lists/Card.tsx`.

## R290: The decisions are a reader in the main stack and the ledger's list in the side stack

- **Decision**: every page of the decisions is two panes: the reader (`decision`, `constitution`,
  `branch-decision`, `decisions-check`) in the main stack, and the list (`decisions-list`) in the
  side stack. On a wide window the list's cursor moves the reader with it, by `redirect`, in the
  same visit, and Enter, or a press on a card, gives the reader the focus; on a phone, `/decisions`
  shows the list first, the constitution as its next pane, and Enter or a tap opens the reader in a
  visit of its own, which Back leaves. The constitution is one row, first, and one document: its
  principles are found by Jump (`/`), which lists them, and open the constitution. The decisions
  check, while one waits, is the row above it. The order is kept on the device, `decisions.sort` in
  `DeviceKeys`.
- **Rationale**: what is read is the subject, and the main stack is the one wide enough for the
  reading measure; the side stack folds to 280 to 400 points, which a card of a decision fills well
  and a decision's prose does not. A reader that follows the cursor by a `redirect` lets the human
  step through the ledger with `j` `k` without filling the history, as the React page did. The old
  list drew a row per principle, each opening the same page: one row says the constitution is one
  file, and Jump still reaches each principle by name.
- **Alternatives considered**: the list as the main pane and the reader beside it, which reads a
  decision at 45 characters a line; one place whose stacks swap by width, which `sync` does not do
  within a visit.
- **Where**: `app/screens/decisions/{index,List}.tsx`.

## R291: A decision is read whole by the document renderer, its branches' changes as cards

- **Decision**: a decision's reader is its head (icon, title, status with its cause, rules and its
  last change), the problem `ura check` finds, one card per feature whose branch changes it
  ("Proposed by Due date reminders", what its branch does, counted, with "Read the branch's
  version"), then the whole file past its title through `Document`, links staying in the app
  (`links.ts`). The branch's version, `/f/<folder>/decisions/<name>`, is the same reader over
  `BranchDecision`, each part the branch added or changed marked under it ("Added on this branch"),
  the parts it removed listed after, and it redirects to the decision in force, at the same heading,
  when the branch has none: the redirect R126 left to this task.
- **Rationale**: the React page drew the `## Rules` section with the spec page's rule lines and the
  branch's change as the spec page's diff card, two components the app has not ported (tasks 41 and
  42). The document renderer draws every rule already, so one component draws the decision, and a
  mark under each changed part shows the change where it is read.
- **Not built**: a link to a heading (`#anchor`) keeps the hash, and does not scroll the reader to
  it: `Document` gives no block's place in its scroll. A link to code or to a done record opens
  `/buffer/<path>`, task 47's page, which the server limits to `specs/` today.
- **Where**: `app/screens/decisions/{Reader,Branch,Branches,links}.tsx`.

## R292: The decisions check's page reads the round, and its answers wait for task 42's cards

- **Decision**: `/decisions/check` reads `WorkflowFile { id: "decisions-check" }`: its state and how
  many questions are answered, then the file through `Document`, each question's answer under its
  heading, read-only, and each option's candidate decisions under the option, from `candidates`. The
  seam is marked `TASK 42:` in `Check.tsx`. "Review with AI", which asked an agent for a check, is
  not built: its message is the Node server's (`round-messages`), and the Rust server serves no
  record of it.
- **Sandbox**: the `realistic` repository gains a decisions check, `specs/DECISIONS-CHECK.md` with
  its candidate, and its "Due date reminders" branch changes the notifications decision, so the
  reader shows a feature proposing a change to an active decision.
- **Where**: `app/screens/decisions/Check.tsx`, `crates/server/src/sandbox/others.rs`.

## R293: A list's keys leave `g g` to the shell

- **Decision**: `listKeys` no longer binds `g g` to the first row: `Home` does. The shell binds
  `g g` to the Git place, and the key store refuses a key bound twice where both are on, so the
  first pane to hold a list in the app threw as it was drawn ("A key means two things in Decisions:
  "g g" is bound twice, to Git and to first row"). The join of tasks 40 to 48 replaced it: Git's
  place is `g c` (R270), and `listKeys` binds `g g` to the first row again, as an ordinary key.
- **Rationale**: the places' `g` keys are the app's, everywhere; `G` and `End` keep the last row.
- **Where**: `app/ui/lists/keys.ts`.

## R294: The Git page's lists are the side stack, its diff the main one, and the page opens in Changes

- **Decision**: `/git` declares four panes: `git-diff` (Diff) in the main stack, and `git-changes`
  (Changes), `git-history` (History), and `git-worktrees` (Worktrees) as tabs of the side stack. The
  place names Changes as the pane focused as it opens, with `focus: true` on its `Placed`, a field
  the layout shell gained (`Place.focus`, read by `layoutOf`, which unfolds the side stack for it).
  A pane's action that leads to another calls `focusPane(ref)`, which the shell takes: Enter on a
  file or a commit focuses the Diff. What the lists picked is kept in the visit under the page's own
  key (`app/screens/git/picked.ts`), since two panes share it.
- **Rationale**: lazygit's shape is a column of lists beside a wide diff. The side stack's 400
  points are the old page's list column (`min(36rem, 40%)`), and a diff needs the main stack's
  width: in the side stack it read 45 characters a line. The work, staging and committing, is in the
  lists, so the page opens there, as the old page focused its selected row; on a phone the one stack
  opens on Changes, as the old page showed its sections first.
- **Alternatives considered**: Changes as the main pane and the Diff in the side stack, as the panes
  guide's "main holds the subject" reads: a cramped diff, or a side stack widened for every page,
  since its width is one choice per device.
- **If wrong**: swap the two stacks in `definePlace("git")` and drop `focus`; `focusPane` and
  `Place.focus` cost nothing to a place that does not use them.
- **Where**: `app/screens/git/panes.tsx`, `app/ui/layout/{layout.ts,panes.tsx,Stacks.tsx}`.

## R295: `s` stages, since Space is the leader; the Git place is `g c`

- **Decision**: in Changes, `s` stages or unstages the row (a file, a folder's files, a checkout's),
  and a press on a file's mark does the same; `a` every file of the checkout; `c` goes to the
  message, and `Ctrl+Enter` there, or Commit, commits; `d` asks, then discards; `o` and `t` take a
  side of a conflict. `f` `p` `P` `M` sync from every pane of the page. The rail's Git was `g G`,
  `Space G`, as the old web UI had it: the join of tasks 40 to 48 made it `g c`, `Space c` (R270),
  the keyboard guide's letter for the page Git replaced.
- **Rationale**: Space starts every leader sequence, and the registry hears no single Space beside
  them; the old page's Space was a focused checkbox's own, which a list row here is not. `g g` is
  every list's first row (`listKeys`): with the Git place on `g g`, the registry threw "a key means
  two things" as the first list of a pane mounted, on any page.
- **If wrong**: a list could give `g g` up instead; the place's key is one line of `places.ts`.
- **Where**: `app/screens/git/{Changes,CommitBox,Sync}.tsx`, `app/screens/shell/places.ts`.

## R296: The Git page ports what the server has: no hunk staging, amend, or stash

- **Decision**: the page stages and unstages whole files and folders, commits, discards, fetches,
  pulls, pushes, merges, resolves conflicts by a side or by editing, continues or aborts, and
  removes or cleans worktrees: every action `git.*` has. It has no hunk staging, amend, or stash,
  which the server does not offer and the old page did not have.
- **Rationale**: the task ports what exists. Each missing one is a server action first.
- **Where**: `app/screens/git/`.

## R297: Discard, Remove, and Clean ask first; a write names itself in the queue

- **Decision**: `git.discard`, `git.removeWorktree`, and `git.clean` are not in the server's undo,
  so each asks in a dialog that says what goes and that nothing brings it back. Every write of the
  page passes its `write` name, "Committing 1 file in main", "Pushing main to origin", with the
  page's address, `/r/<repo>/git`: the server's default names the page `/git`, without the
  repository. A refusal shows under the control it came from, whole, in git's or the hook's words,
  until the next write from there.
- **Where**: `app/screens/git/{writes.ts,Changes.tsx,Worktrees.tsx}`.

## R298: `Diff` draws one file's patch, or several, with Native Shell's `DiffView`

- **Decision**: `app/ui/document/Diff.tsx` draws a unified patch with `DiffView`, unified, in the
  code font at the under size on 20-point rows, its parts in the theme's roles (`added`, `removed`,
  `code-ground`, `sunken`), scrolling down and sideways inside itself, wrapping with `wrap`. With
  `keys`, `j` `k` scroll it and `n` `N` go to the next or previous change. A commit is one patch of
  its files' diffs, each read as its own `GitDiff`, joined. The gallery's Documents has a page of
  it.
- **Where**: `app/ui/document/Diff.tsx`, `app/gallery/document/diff.tsx`.

## R299: `Banner` makes its action once

- **Decision**: `Banner` reads its `action` once, as it is made. The join of tasks 40 to 48 kept
  R283's fix instead, the action and the words each in a `computed`, which declares the key once and
  still follows an action that changes; the stopped pull's Continue works with it. It read it in its
  `If`'s condition and again to draw it, and the condition ran again at each change of what the
  action read: the stopped pull's Continue, a button with a key, was made twice, and the registry
  threw "`m` is bound twice".
- **Where**: `app/ui/controls/Banner.tsx`.

## R300: The sandbox's `sample` leaves two changes in its main checkout

- **Decision**: the sample's builder ends with `specs/README.md` changed and `notes/standup.md` new,
  uncommitted, for the Git page and its test; the builders' stamp is `2`, so an older sandbox is
  built again. A pull of `sample` still stops on the priorities' conflict, seen on the hidden
  display.
- **Where**: `crates/server/src/sandbox/{origin,sample}.rs`, `crates/server/src/sandbox.rs`.

## R301: An option left to the agent's default is sent empty, and the server stores that default

- **Decision**: a pick's `model` or `effort` sent as `""` means "the agent's own default".
  `settings::options::left_to_agents` turns it into what is stored, before the core checks it: over
  a fallback that sets that value on the same agent (a feature's own options over the settings'),
  the default the agent's model list gives now; anywhere else, and while the agent says no default,
  nothing. A reviewer's is always nothing, as the reviewers are stored whole. It runs in
  `settings.setRunOptions` (over no fallback), and in every store of a feature's options
  (`features::options::keep`), its start's check, and `over`.
- **Rationale**: stored options only add values over what they are read over, so "the agent's
  default" left unset would run on the settings' model. The web UI's `toStored` stored the default
  in the client; the UI holds no workflow logic (task 64's audit, R228), so the rule is the
  server's, and the client only says what the human picked. An empty text names no model or effort,
  so it needs no second field in the protocol.
- **Alternatives considered**: the client sending the whole map, and the server diffing it against
  the fallback as `toStored` did, which changes what `feature.setRunOptions` takes for tasks 38 and
  44; a separate flag per value, which doubles the run options' fields.
- **Seen failing**: `an_option_left_to_the_agents_default_is_stored_as_that_default`, with the rule
  out of `keep`: the plan step kept `model: ""`.
- **Where**: `crates/server/src/records/workspace/settings/options.rs`,
  `crates/server/src/records/features/options.rs`, `crates/protocol/src/shared/run_options.rs`.

## R302: Settings are a category pane and an index pane, and `/settings` is the index

- **Decision**: `settings-category({ category })` in the main stack, the page's subject, and
  `settings-index` in the side stack: the search across every setting, then the seven categories,
  each with a line of what it holds. `/settings` alone places the index in the main stack, as a
  phone's first screen. The categories go in the order of what is changed most: Appearance, Fonts,
  Keyboard, Runs, Extensions, Sign-in, Server. Moving between categories is navigation, so Back
  returns to the last one, its row and the search kept in the visit.
- **Rationale**: the old page was one long form that scrolled to a section. As panes, a category
  reads at the width it needs, the runs' map (task 44) has room, and the index works the same as a
  side pane wide and as a tile on a phone, with no tab bar of the screen's own. Tabs of seven panes
  would have moved order with the route, as the first main pane is the subject.
- **Where**: `app/screens/settings/panes.tsx`, `Index.tsx`, `categories.ts`.

## R303: Every setting is one `SettingRow`, on one cursor, and Enter changes it

- **Decision**: `SettingRow` draws every setting, an extension's too: its icon and name, what it
  does, where its value comes from ("Set in config.toml", "The default, on", "Set by --port for this
  run: 4400. The file's value applies without it.", "Kept on this device"), its control, and the
  server's refusal under it with `Under`; wide, the control at the row's end, narrow, under the
  words, the icon and the name a head line. A category's rows share one cursor (`SettingRows`): `j`
  `k` move it, Enter does the row's act, a switch flipped, a select opened, the theme picker opened.
  `Select` gains `opener`, which gives a screen what opens it, as a press does. An extension's
  settings are rows inside its row, out of the cursor (`Unlisted`).
- **Rationale**: on GTK a pane's controls take no Tab focus outside an overlay, so the cursor is how
  the keys reach every control (rule 5); one row keeps every refusal, source, and help where the
  human looks for them (R166, rules 6 and 8).
- **Test**: `a setting refused by the server goes back, and says why under itself`, by the keys, on
  the row with a switch whose server refuses. With the row's `Under` given no refusal, it failed:
  the words were not on screen.
- **Where**: `app/screens/settings/Row.tsx`, `app/ui/controls/Select.tsx`.

## R304: A list's `g g` yields to the shell's Git

- **Decision**: `listKeys` declares `g g` as a fallback: the shell's `g g` goes to Git on every
  page, and `Home` is a list's first row. The join of tasks 40 to 48 replaced it: Git's place is
  `g c` (R270), and `listKeys` binds `g g` to the first row again, as an ordinary key.
- **Rationale**: the first list drawn in a pane threw "A key means two things: "g g" is bound twice,
  to Git and to first row", and the frame drew nothing. Of the two, the place key is the one the
  status line and the rail teach, and it means the same everywhere.
- **If wrong**: the place of Git takes another key, and the list gets `g g` back.
- **Where**: `app/ui/lists/keys.ts`.

## R305: The device's look is picked in one place, and the keyboard's settings are followed app-wide

- **Decision**: `app/screens/settings/look.ts` holds `chooseMode`, `chooseTheme`, and `chooseFont`;
  the leader's `Space u m`, `Space u t`, and `Space u f` call them, and the settings too. A theme
  picked from the leader shows its mode; one picked in the settings keeps the mode, as each mode has
  its own row. Each theme is drawn in its own colours by `ThemeSample` (`app/ui/lists/`, gallery
  Cards), the one component that draws a theme's colours. `FollowKeyboard`, drawn by the frame,
  writes the single-key shortcuts and Vim mode in force into the keys' store and the fields.
- **Rationale**: nothing followed the keyboard's settings after the shell's task: they said "the
  shell writes it", and no code did. The Vim commands are kept in the file, and the row says the
  app's Vim does not run them yet: the Vim layer has no mappings.
- **Where**: `app/screens/settings/look.ts`, `follow.tsx`,
  `app/screens/shell/{Frame,keys,pickers}.tsx`.

## R306: Sign-in lists the paired devices, and says how to pair; no sign-out rows

- **Decision**: each paired device is a card, with when it paired and was last seen, "This device"
  for the one whose token the app holds, Rename in place, and Revoke after a second press, whose
  banner says it is locked out at once. Pairing another is `ura pair` on the server's machine,
  worded as it prints. The old "Sign out" and "Sign out everywhere" go: a paired app signs in by its
  token, and revoking a device is its sign-out.
- **Rationale**: no action makes a pairing code from a client; adding one would put a door into the
  server from any signed-in client, beyond this task. A browser's sign-out returns with the web
  build (task 56).
- **Where**: `app/screens/settings/SignIn.tsx`.

## R307: A list marks three things, each with one look, and a focused list shows its cursor at once

- **Decision**: the cursor of a list, a `Row`'s or a `Card`'s `selected`, is a fill one step up and
  a 2 px bar on its left edge. `Bar` lights it, `light.focus` and its glow, while the keys declared
  where it is drawn work (`keysWorkHere`, the key store's `works`: its pane focused, its section's
  scope on, no dialog over it), and draws it in `row.barRest`, the edge's colour, unlit, otherwise.
  A card's cursor no longer lights its edge. What is open now is `current`, on `Line` and `Card`:
  its icon and words in the accent (`row.current`), bold, no bar, no fill; the rail's place shown
  and the sidebar's feature shown take it, where they took the cursor's bar. A choice made
  (`SelectableCard`, `ThemeSample`) keeps its accent edge and loses the bar. While its keys work, a
  list with no cursor puts it on its first row (`listKeys`), without scrolling and without opening
  it. Git's worktrees take `listKeys` in place of their own `j` `k`.
- **Rationale**: seen on the first six screens together, a selected row looked four ways: a lit bar
  and a lit edge (decisions), a lit bar (Git), a coloured title (settings), and nothing until a key
  was pressed (Home, Priorities, the inbox, which also hid the cursor of a pane at rest). The design
  language says "only its bar is lit" and "only the focused pane emits light": the unlit bar follows
  from both. A keyboard-first app shows where `j` starts; a quiet bar on the first row bothers no
  pointer user.
- **Props whose meaning changed**: `Card`'s `selected` no longer draws an accent edge; `Bar` takes
  `lit`, and is unlit outside the scope whose keys work; `SelectableCard`'s and `ThemeSample`'s
  picked look has no bar; `Rail`'s current place has no bar or fill. New: `Line`'s and `Card`'s
  `current`, `tokens.row.barRest`, `tokens.row.current`, `keysWorkHere`.
- **If wrong**: the unlit bar takes the accent at a lower strength (`row.barRest`), one token.
- **Where**: `app/ui/lists/{Row,Card,Line,keys,SelectableCard,ThemeSample}.tsx`,
  `app/ui/keys/{store.ts,registry.tsx}`, `app/ui/tokens/light.ts`, `app/ui/layout/Rail.tsx`,
  `app/screens/shell/Sidebar.tsx`, `app/screens/home/Cards.tsx`, `app/screens/git/Worktrees.tsx`.

## R308: A title gets the row's width first; its state wraps to a second line

- **Decision**: `Line` and `Card` lay a title and its end (a meta, a count, a state, a time) in one
  wrapping row: the title at its whole width (`flexBasis: auto`) and the end beside it while both
  fit, the end at the end of a second line when they do not, wrapping again there. On a narrow
  window a card keeps its head line, and a card with neither state nor time draws its icon before
  its title, where it stood alone on a line.
- **Rationale**: "Recurrin g tasks" in a priorities column, "Decisions check" beside "Waits for your
  answers" in the side stack, a note squeezed by "1 image" on a phone: a fixed end beside a
  shrinking title broke words. The phone's rule, "text of more than one line takes the full width",
  is the same rule at any width: a title that fits on one line keeps its state beside it, one that
  does not gets the row.
- **If wrong**: the end goes to a head line over the title in every narrow pane, as on the phone.
- **Where**: `app/ui/lists/{Line,Card}.tsx`.

## R309: Empty states and refusals speak in one voice

- **Decision**: an `Empty` says what is not here (a title, no full stop), why and what brings one
  (words), and the one thing to do (an action, with its key where it has one); its `refusal` sits
  under the action. A refused action is a `Refusal` under its control: the inbox's (was a danger
  banner), a proposal's move (was a banner "Not moved"), a priorities section's (was red text), and
  the triage's start (was put in place of the empty state's words). A banner's title has no full
  stop. "Nothing here yet." becomes "Nothing in Now", with how one comes; Home's empty Now gets its
  action, "Open the priorities", in place of a link under it; "The inbox is empty" becomes "Nothing
  in the inbox"; "The branch has no commit." says where the first comes from.
- **Rationale**: rule 8 of a good screen, and the join's example: "Nothing here yet." beside
  "Nothing in Now". The rule is written in `specs/ui/components.md` so the next screens follow it.
- **Where**: `app/ui/lists/Empty.tsx`, the screens named, `specs/ui/components.md`.

## R310: The side stack takes 440 points while the main one keeps 680; a pane's header is one row

- **Decision**: on a wide window, the side stack's default width is 400 points, and up to 440 while
  the main stack keeps 680, a reading pane's prose and its room: at 1400 points it is 440. A width
  the human dragged still wins. A pane's header is one row of controls: `Button`'s `compact` draws
  its key and icon, its label in its tip, and the decisions' Jump is compact in a narrow pane. Short
  of room, the tabs beside the shown one first leave their icons out and keep their titles, which
  say more, before any shrinks to its icon.
- **Rationale**: at 1400 points, the feature page's and Git's three side tabs left the third an
  icon, and the decisions' Jump and order wrapped onto two rows at 400 points. Three named tabs with
  icons need about 445 points; the main stack had 40 to spare above its prose's measure, and the
  icons beside the shown tab's say what their titles already say.
- **Props whose meaning changed**: none; `Button`'s `compact` is new.
- **Where**: `app/ui/layout/{Stacks,Stack}.tsx`, `app/ui/controls/Button.tsx`,
  `app/screens/decisions/List.tsx`.

## R311: A long list opens on its cursor's row; a guarded key's hint shows only where it works

- **Decision**: `VirtualList` opens on the cursor's row when the visit kept no place for it, and the
  decisions list moves its cursor to the decision a link opens with `reveal`, which scrolls it into
  view. The key store's hints leave out a key whose `when` does not hold, as the key map already
  did; Git's `d`, `o`, and `t` have their hints back, shown on a file, or a conflict, alone.
- **Rationale**: a decision opened from elsewhere had its card selected below the fold; Git had
  dropped its conflict keys' hints because they showed on every row.
- **Where**: `app/ui/lists/VirtualList.tsx`, `app/ui/keys/store.ts`,
  `app/screens/decisions/List.tsx`, `app/screens/git/Changes.tsx`.

## R312: The server's time zone comes with its `welcome`, and every day the app shows is the store's

- **Decision**: `welcome` carries `timeZone`, the server's IANA zone (the machine's, `UTC` where it
  names none), and the store's connection hands it to `setServerZone` at each `welcome`. The frame
  no longer reads the record `Jobs` for it. `app/store/time.ts` adds `serverDay`, "17 Oct", "17 Oct
  2025", a `YYYY-MM-DD` date as written, and `serverDaysAgo`; the feature page's times and days, the
  decisions' dates, Git's older days, and sign-in's days use them, so a day reads "17 Oct"
  everywhere, where the feature page and the decisions wrote "Oct 17". Usage's reset reads "5h 58%
  left · reset 07:11", with the app's separator.
- **Rationale**: ruling R263's "If wrong" came true: with the Jobs extension off, times read in the
  device's zone, and the feature page wrote device times of its own.
- **Where**: `crates/protocol/src/message.rs`, `crates/server/src/http/socket.rs`,
  `crates/server/tests/live.rs`, `contracts/protocol.md`, `app/store/{connection,index,time}.ts`,
  `app/screens/feature/words.ts`, `app/screens/decisions/ledger.ts`, `app/screens/git/when.ts`,
  `app/screens/settings/SignIn.tsx`, `app/screens/shell/{Frame.tsx,usage.ts}`.

## R313: The diff's code colours are Native Shell's; a patch it cannot read shows as text

- **Decision**: `DiffView` takes no colour for its code: NSH 0.4.0 paints each token with
  `Token::style` (`nsh-base/src/syntax.rs`), a fixed pair of colours for a light and a dark theme,
  and its `styles` reach rows, numbers, and words, not tokens. The diff keeps them, with its rows in
  the theme's roles. A patch `DiffView` cannot read, which it draws as nothing, is checked first in
  Rust by the reader's rules (`patchProblem`, `crates/app/src/patch.rs`), and `Diff` shows it as its
  plain text, under a quiet line naming the line that failed.
- **Rationale**: drawing the code plain, to keep to the theme's hues, would cost every diff its
  colours for a difference only a custom theme shows; reading a patch in TSX would be a parser in
  the interpreter.
- **If wrong**: NSH takes token colours (a `styles` part per token, or the editor's theme), and
  `Diff` passes the theme's `syntax-*` roles, as `Code` does.
- **Where**: `app/ui/document/Diff.tsx`, `crates/app/src/{patch,native,lib}.rs`,
  `app/gallery/document/diff.tsx`.

## R314: The status line hides a hint it cannot hold whole

- **Decision**: the status line's hints wrap inside one line's height: a hint the line cannot hold
  is hidden whole, from the end, never cut through its key or word.
- **Rationale**: seen at 1400 points on Git, once its guarded keys' hints came back: the last hint
  showed as a bare "c" at the line's edge, a key with no word. The order stays (the leader, the key
  map, and the folds first): the keys a screen names in its own buttons are drawn there too.
- **If wrong**: the screen's own hints come before the frame's, and the frame's go first.
- **Where**: `app/ui/layout/StatusLine.tsx`.

## R315: The proposal's pane is the one place a proposal file is written and started

- **Decision**: `proposal({ repo, key })` (`app/screens/proposal/`) takes the place of task 37's
  `proposal-summary` at `/priorities/<key>`, through the seam R273 left, with no change to its
  files. It shows where the proposal stands and its words, then by what it is: a started or merged
  one opens its feature; one with a file is that file in the shared `TextField` (Ctrl+Enter and `:w`
  save over the hash it was read at, `SaveStatus`, unsaved text kept on the device, so `LeaveGuard`
  asks before leaving), its research effort (`text.discovery`, through `sent`), its images (picker,
  paste, drop, each attached to the file and linked at the caret), and its start; a line alone is
  written into a file (`proposals.expand`) or started from the New page with its words. Then the
  moves to another section and Remove, which asks for a second press. The old React UI split this
  between the line's overlay and the editor page `/edit/<path>`.
- **Rationale**: one pane for the thing the human reads, writes, and starts, with nothing to open in
  between; `/edit/<path>` stays task 47's for every other file.
- **If wrong**: task 47's editor places this pane for a proposal file's `/edit/<path>`.
- **Where**: `app/screens/proposal/`.

## R316: A proposal file's start is its pane's Start, or Ctrl+Enter in its short name

- **Decision**: the Start part holds the kind (`f`, `c`), the short name (`s` focuses it, proposed
  by the file's `slug`, kept on the device as typed), and the main button. The short name has no
  `onEnter`: Enter there does nothing, and its `onSave`, Ctrl+Enter, starts, as it holds nothing to
  save. A feature starts with `feature.start` and its write named "Starting the feature <title>",
  opening `/priorities/<key>` again; a change with `change.startProposal`, which answers once landed
  and opens the change's page. The text is saved first, and a refusal shows under the short name.
  The proposal file's start sends no run options: `feature.start` takes none, so it runs on the
  settings', which its feature page changes; a typed start's dialog holds the map.
- **Test**: `Enter in a proposal's slug starts nothing`. The headless runner gives a field's own
  keys to no editor, so the test guards Enter pressed on the page and in the short name reaching no
  key that starts; the button's start is its control. With the Start button given `keys="Enter"` it
  failed: `feature.start` was sent.
- **Where**: `app/screens/proposal/StartPart.tsx`, `proposal.test.tsx`.

## R317: A start says where the work went, its steps landing, and the way to its page

- **Decision**: once `feature.start` or `feature.startText` answers its `StartPlan`, the pane that
  started it shows `Landing` (`app/screens/new/Landing.tsx`): the feature's title and folder, the
  write queue's steps of its write (`WriteQueue`, by folder) with their states and times, a refused
  step's output with the way back, then "Open the feature" once its write left the queue and
  `Feature` reads it. A change's start answers once landed, and opens the change's page; a new
  session opens its page. The pane keeps the start in its visit (`rememberStarted`, a JSON text, as
  a pane keeps plain values only).
- **Rationale**: rule 9; the old UI opened the session with the message in its composer, which the
  server now sends itself (R91).
- **Where**: `app/screens/new/Landing.tsx`, `NewPane.tsx`, `app/screens/proposal/ProposalPane.tsx`.

## R318: The run map is one component in `app/screens/runs/`, over the protocol's run options

- **Decision**: `RunMap` (`app/screens/runs/RunMap.tsx`) draws run options as the server keeps them,
  `value` read over `over` (a feature's or a start's own over the settings', or the settings' over
  nothing), and gives `onChange` the options as the human set them: a model or an effort left to the
  agent is `""` (R301), and the server stores what it means. The track's six steps are
  `SelectableCard`s with "agent · model · effort", the joints between them `IconButton`s (scissors
  where a new session starts, a link where the step goes on; a forced cut, two steps on different
  agents or models, cannot be joined), the roles under them (implementers, reviewers, the reviewer
  to add, where reviews happen), and under the map the selected place's controls: one `Select` of
  every agent's models ("Claude Code · Default", "Claude Code · Opus 5.5"), one of efforts, a
  joint's `Switch`, the depth's `Segmented`, Add, Back to what it follows, Remove. A place that
  names no agent says it runs on the default agent, the setting's or the first on. Keys, a
  selection's scope on while `active()`: `h` `l` and `j` `k` (along every place in a column), each
  `false` at the edge; Enter picks or flips; `e` effort; `r` back; `a` add; `d` remove. The old
  map's `toStored` diff, its own pickers, its history lock, and its row of presses are left: the
  server stores the choice (R301), the controls are the app's, and a feature's history on its page
  is task 44's.
- **Rationale**: rule 3, "only one component to maintain": the settings, a typed start's dialog, and
  a feature's continue draw the same map. Built here, a wave before task 44, as both this task and
  the settings needed it.
- **If wrong**: a lock of the steps a feature already ran is a `disabled` per place, from the
  feature's history.
- **Where**: `app/screens/runs/{options,places,RunMap,Detail,SettingsMap,ContinueDialog}.ts*`.

## R319: A typed start's dialog holds the run map at its size, the field first, Enter confirming

- **Decision**: the New page's Start, or Ctrl+Enter in its composer for a change or a feature, opens
  `StartDialog`: the short name (`SlugProposal` of the text, editable, first focus, Enter starts:
  the dialog is the deliberate step), a feature's research effort, and the run map under them, a row
  of six tiles 1180 points wide in a wide window, a column 640 wide otherwise and for a change,
  scrolling inside the dialog's 80% of the window. It sends only what the map changed (`options`
  `null` when nothing was). Closing it starts nothing, and the draft stays.
- **Where**: `app/screens/new/StartDialog.tsx`.

## R320: A feature's continue opens the continue dialog, its message and its map

- **Decision**: "Next"'s continue (R285) opens `ContinueDialog`: the workflow's message whole, the
  run map on the feature's own options (`feature.setRunOptions` through `sent`, saved at once), and
  the run's button, its first focus. It sends `session.send` as R285 did, then opens the session.
- **Where**: `app/screens/runs/ContinueDialog.tsx`, `app/screens/feature/Overview.tsx`.

## R321: The New page is one draft for three kinds, and a source list beside it

- **Decision**: `new({ repo })` in main, `new-sources({ repo })` in side, the kind read from the
  address so a switch (`s` `c` `f`, or the cards) keeps the panes. One draft per repository, kept on
  the device without the leave question (`draftOf`), with images held while the app runs and sent
  through `/attach?chat=1` with the start. A session starts with Enter, on the default agent, named
  under the composer (rule 10); a change and a feature with Ctrl+Enter or Start, through the dialog.
  "Start from" lists the proposals not started and the inbox's notes: Enter puts a line's words in
  the draft (a proposal's line kept, so its start links it), or opens a proposal with a file. The
  old page's `/` search of the entries is left: the side pane's list is short, and the app's find
  covers the rest.
- **Where**: `app/screens/new/`.

## R322: The leave question resolved nothing, and the images moved to a shared module

- **Decision**: `LeaveGuard` held its resolver as `asking.set(() => resolve)`: a signal keeps a
  function as its value, so the answer called the wrapper and never resolved, and neither Leave nor
  Stay did anything but close the dialog. It now holds `{ answer: resolve }`. The inbox's image
  helpers (sign-in, draw, pick, paste, drop) moved to `app/screens/images.ts`, with `attachToFile`
  and `keepForChat`; `inbox/images.ts` keeps the note's upload and re-exports them.
- **Test**: `leaving an edited proposal asks first, and keeps the text` failed without the fix:
  after "Leave page", the proposal's page stayed.
- **Where**: `app/ui/text/LeaveGuard.tsx`, `app/screens/images.ts`, `app/screens/inbox/images.ts`.

## R323: A buffer reads any text file of its repository, and edits only the Markdown of `specs/`

- **Decision**: the Rust server was not narrower than the Node one: both read and saved only the
  Markdown files of `specs/`, through the same core function. The decisions' links already sent a
  done record's or code's path to `/buffer/<path>`, which refused it. `read_buffer` now reads any
  text file of the main checkout, by a plain path (no hidden part: never `.git`, nor a `.env`) that
  stays inside it once its links are followed, at most 2 MiB, with no NUL byte, and says why it is
  only read in `Buffer.readOnly`. `buffer.save` refuses it as before. `Buffer` also carries
  `worktree` and `checkedOut`, where the file lives, for the editor's head line.
- **Rationale**: a code buffer that can be read answers a link without a dead end; one that can be
  saved would let the app write any file of the repository, the hooks' folder's neighbours included,
  which nothing asked for.
- **If wrong**: a save of code is the core's `save_buffer` with a wider check, and the editor drops
  its `readOnly` banner.
- **Where**: `crates/core/src/api/buffer.rs`, `crates/protocol/src/writing.rs`, the tests
  `buffer_answers_its_shape` and `a_buffer_refuses_paths_outside_specs`.

## R324: An editor never saves over a file that changed under the text typed, and says so at once

- **Decision**: the save sends the hash of the version the text was typed over, as the server asks;
  the editor knows that version without keeping a hash, from the unsaved entry's `base`, the text
  the edit began from. When it is not the file's text now, the file changed underneath: the editor
  says so at once, before any save, in a banner over the text it keeps, with "See what changed"
  (`d`, the patch from the file to the text, `Diff` over Rust's `textPatch`), "Take the file's
  version" (`t`), and "Save yours over it" (`w`), the last two asking first in a `Dialog`, as the
  undo decision asks of what loses work. Save, `Ctrl+Enter`, and `:w` are refused meanwhile, the why
  under the field. A save's own change is told apart by its answer, `Saved { hash }`, until the
  record catches up (`editor/disk.ts`), so the banner never flickers after a save. While nothing is
  typed, the field shows the record, and follows the disk.
- **Rationale**: the React UI waited for the save to be refused, then offered "Copy my text" and
  "Load the new version": the human learnt it once their save had failed, and copying their text out
  was the way to keep it. The text is kept on the device already: the choice is between the two
  versions, and the patch shows it.
- **Seen failing**: with the editor's own check removed, the save sent the record's newest hash,
  which the server accepted: `a file changed on disk while it is edited is not overwritten silently`
  failed on "Not saved", the agent's text overwritten.
- **Where**: `app/screens/editor/`, `app/screens/buffer/buffer.test.tsx`.

## R325: `/edit/<path>` and `/buffer/<path>` are one editor; an outline beside a Markdown file

- **Decision**: both pages are the pane `buffer` in the main stack, and for a Markdown file the pane
  `buffer-outline` in the side stack, its headings from the core's document reader (`outline` of
  `uraeda/native`), `Enter` moving the editor's caret there (`TextField`'s new `goToLine`).
  `/edit/<path>`, a workflow file's source opened from its page, goes back there once saved; a
  buffer stays, as Vim's does. Both go back on Escape outside the field, `:q`, or `b`, and `:wq`
  waits for its save. The old `/edit/<path>` was the proposal file's page, with its start: that is
  task 38's (`/priorities/<key>`), so the address keeps the links of the inbox, the triage, the
  priorities, and the feature page working, and opens the file's text.
- **Rationale**: one editor of a whole file, the same keys and the same guarantee on both addresses;
  no second component for the source of a page.
- **Where**: `app/screens/buffer/`, `app/screens/editor/FileEditor.tsx`.

## R326: A code buffer is highlighted by the editor's own language, and wraps as every field

- **Decision**: `TextEditor` takes `language`, a name, an extension, or a path, which NSH's editor
  resolves (`nsh-base` 0.4.0, `editor/language.rs`): `TextField`'s `language` is the file's path for
  a file that is not Markdown, and Markdown otherwise. Every buffer wraps, as the React UI's did,
  and as the text-editing decision asks of every field.
- **Rationale**: NSH's editor already highlights by its syntect grammars, the ones `highlightCode`
  reads (R204); its colours are its palette's, as the Markdown field's already are.
- **Where**: `crates/app/src/vim_bridge.rs` and `vim_bridge/types.rs`, `app/ui/text/TextField.tsx`.

## R327: One conflict editor, in `app/screens/conflict/`, with a bar of blocks

- **Decision**: the Git page's `ConflictEditor` moved to `app/screens/conflict/`, and the Git page's
  Diff pane imports it there. It keeps its writes in its own state, named for the Git page in the
  write queue, so it imports nothing of the Git screen. Over its field, a bar names the block in
  hand, "Conflict 2 of 3", with `1` use ours, `2` use theirs, `3` use both, each named by its
  branch, and `n` the next block, the caret moved to it: the React UI's per-block bar, which
  CodeMirror drew among the lines. The blocks are found and replaced in Rust (`conflictBlocks`,
  `takeConflict`, `crates/app/src/editing.rs`), as `conflicts.ts` did in TSX, with its cases as unit
  tests.
- **Rationale**: NSH's editor draws no widget among its lines; one bar for the block in hand keeps
  each choice one key, and the field keeps the text.
- **Where**: `app/screens/conflict/ConflictEditor.tsx`, `crates/app/src/editing.rs`.
## T41.1: A workflow file is read as it is written, beside its panes, not rebuilt into parts

- **Decision**: every workflow file, a spec and a plan included, is one reader in the main stack:
  the file drawn from the core's tree, in its own order, at the reading measure, under a head that
  says its kind, its status, and its facts ("6 of 11 tasks done", "1 decision changed on its
  branch"). What helps reading it sits in the side stack, in this order: for a spec, Outline,
  Review, and Decisions; for a plan, Tasks and Outline; for any other file, Outline. Which panes a
  page has follows the file's name, before the record comes. The old screen's four pages
  (`DocumentPage`, `SpecPage`, `PlanPage`, `DataModelPage`) are one `Reader`; the spec's groups of
  cards (stories, built parts, the data model drawn in the spec), its folds, and the plan's lead
  panes are not built.
- **Rationale**: the old spec page re-arranged the file into groups, each drawn by a component of
  its own, so a spec read differently on the page and in the file, and every new part of the
  template needed a new component. The file's own order is the one its writer chose and the one the
  review comments on; the side panes give the overview the groups gave, without a second way to draw
  the same text. A plan's waves are not in the record (`PlanItems` holds its lead and its tasks): a
  plan's "Waves" section is in its outline.
- **If wrong**: a pane of the side stack draws one part of the spec as cards, reading `SpecItems`,
  and the reader stays as it is.
- **Where**: `app/screens/file/`.

## T41.2: A long document scrolls by its top-level blocks, and a heading is brought to the top by id

- **Decision**: `DocumentScroll` (`app/ui/document/`) draws a document as Native Shell's list of its
  top-level blocks, with a header and a footer at the measure, its reading keys (`j` `k` and the
  arrows by three lines, `mod+d` `mod+u` by half a screen, `g g` `G` `Home` `End`), its place kept
  by the caller (`offset`, `onOffset` once it comes to rest), the block at its top heard
  (`onPlace`), and a ref with `toBlock(id)`, `toAnchor(anchor)`, and `scrollTo(offset)`. `Document`
  stays for a document inside a page that scrolls. The file's panes share the reader's place and
  their jumps through `app/screens/file/place.ts`; a link to a heading of the page, the address's
  `#heading`, an outline's entry, and a plan's task all call `toBlock`. `Pictured` takes an image's
  address as it comes, so an image fetched with the sign-in (`imageOf`, moved from the inbox to
  `app/store/images.ts`) draws once it is there.
- **Rationale**: a plan of 2,700 lines drawn whole made every block at once; the list makes those
  near the screen. The scene `reading` of `just frames` scrolls such a plan (82 tasks of 33 lines)
  at 900 points a frame: 1,430 frames, median under 14.1 ms, 95th percentile under 25.6 ms, 99th
  under 31.9 ms, worst 44.5 ms, in software on the hidden display while other builds held the
  machine's load at 18 to 28. A cell reused for another block is made again (`Each` keyed by the
  block), as blocks differ in kind. The test `a link to a heading scrolls the reader to it`
  (`app/ui/document/document.test.tsx`) failed with the scroll removed: section 50 never showed.
- **If wrong**: `Document` takes the list's way of drawing, and `DocumentScroll` goes.
- **Where**: `app/ui/document/DocumentScroll.tsx`, `Document.tsx`, `Picture.tsx`;
  `app/gallery/scenes/reading.tsx`; `app/screens/file/{place.ts,Reader.tsx}`.

## T41.3: Approving, answering, and live embeds stay with their tasks

- **Decision**: the file's one main action, approving a spec or a plan or answering a round, is task
  42's, at the seam `TASK 42:` in `Reader.tsx`'s head, beside its `mark` slot for comments and
  question cards, and in `panes.tsx` for a round's pane and a review's. A story or a mockup drawn
  live is task 49's (`TASK 49:` at `override`, and a story link opens its file until then). The
  Review pane shows the review not sent, the review a revision answers, and the parts changed since,
  never a verdict of its own. `Space b`, the page's file as a buffer, is task 47's. The decision as
  a branch has it, `/f/<folder>/decisions/<name>`, is task 45's, as built: nothing was left for this
  task there; it scrolls to its `#heading` only once it reads with `DocumentScroll`, more than the
  one line the task allowed, and is left as it is.
- **Rationale**: one approve button, the review's, as the task asks; a second one here would be a
  second component to keep right.
- **Where**: `app/screens/file/{Reader,panes}.tsx`.
## T43.1: A session is one pane, its conversation, and the sessions' list sits beside it

- **Decision**: a session's place is the pane `session-transcript` in the main stack, its head, its
  conversation, its banners, and its composer, one pane as the composer belongs to the conversation;
  then `sessions-list` in the side stack; then what other screens add with
  `addSessionPanes((args) => [...])` from `app/screens/session/place.ts`, at their module's top
  level. All three pages of a session, `/sessions/<id>`, `/f/<folder>/session`, and
  `/f/<folder>/session?new`, place the same panes with one `SessionArgs`
  `{ repo, session, folder, fresh }`, `session` "" for a feature's latest, which `sessionIdOf(args)`
  reads from the record `Feature`. `/sessions` places the list alone, in the main stack: Enter or a
  press opens a session, whose page keeps the list beside it.
- **Rationale**: the old screen drew its own side column; panes give the session's panels (task 44)
  their tabs, keys, and folds from the frame, and a feature's session page is the same place, so
  nothing is drawn twice. The list beside the conversation is "the session beside it when there is
  room" turned around: the conversation is what a session page is for, and it gets the width.
- **If wrong**: `/sessions` can place the first session's conversation beside the list, as the
  decisions place the constitution, by redirecting the cursor's moves.
- **Where**: `app/screens/session/{index.tsx,place.ts}`.

## T43.2: The transcript reads a window of pages, and keeps what it read until it is far

- **Decision**: `transcriptFeed` (`app/screens/session/pages.ts`) holds a `Turn` for each turn and a
  `TurnLog` for each page of the rows within two screens of those shown (at least 40 rows either
  way), and always the last turn and its last page. A turn not read is one row, `turn`; a page not
  read is one row, `turn#page`; an item is `turn/item#turn#page`, so a row says which page reads it.
  What was read stays read until the rows shown are six screens from it: a page that becomes 100
  rows pushes its neighbours away, and a window that let them go at once would read them again and
  again. The window is an effect that writes the keys read, as the list's shown rows and the rows
  change; the records are held by one computation of those keys, and let go after the store's grace.
  `VirtualList` gains `onShown(first, last)`, the rows wholly shown (R171's list says which).
- **Rationale**: the store's README designed it so; the row id carries the page because an item's id
  is its place in its turn, not its page, and the row must read its own page's signals. A session of
  10,000 turns lists 10,000 ids, each one row until read: the list knows its length at once, and a
  fling far up reads only where it stops.
- **If wrong**: the window is `MARGIN` and `KEPT` in `pages.ts`.
- **Where**: `app/screens/session/pages.ts`, `app/ui/lists/VirtualList.tsx`.

## T43.3: A transcript row is a line that binds and a body made once for its row

- **Decision**: every row of the transcript is one structure (`Rows.tsx`): a line, whose icon,
  words, and time bind to the row, for a tool's call, a thought, the runner's notice, or a part not
  read yet; and a body, made by an `Each` keyed by the row's id, for what has words of its own: a
  message, the agent's text, or a blocked action. A cell reused for a call binds again; one reused
  for a text makes its body again. A text whole when its row is drawn is a `Document` of its tree,
  read with `markdownTree` once per row and kept for the 2,000 latest rows; a text that streams is a
  `Reply`. Each tool call is one quiet line, the command or path in the code font, its time at the
  end; a sub-agent's own calls and thoughts are left to the Activity (task 44). The list is not
  framed: the row draws its selection itself, a fill and the bar of light at its left edge, as `Row`
  does, and fills the list's width, so its words wrap on a phone.
- **Rationale**: R239's rule. `Reply` keeps its splitter's state per reply: a reply bound to another
  row of a longer text would have read on from where the first left. A whole text split again at
  each bind cost a native call and a parse per row in a fling: its tree, kept, costs neither. The
  old screen folded each stretch of calls into one recap line, which linked to the Activity: one
  line per call reads as the agent works, and the Activity, which task 44 builds, keeps the
  stretches. `Row` lays its children in a row: inside it, a card and a long line kept their own
  width and ran past a phone's edge.
- **Where**: `app/screens/session/Rows.tsx`.

## T43.4: An offer's kind is told by its body, and starting it is its card's button

- **Decision**: the core's tree keeps a fence's first word only, `uraeda-offer`: a block of that
  language is an offer, a change's when its body opens with `# `, its proposal's title, else a
  feature's, as the offer's grammar shapes them. The card has its buttons while it is the session's
  live offer: in its last turn, once that turn ended, moving that kind of session (a chat to a
  change, a change to a feature), and not closed with "Not now". "Start the change" is a tube, not
  the view's main action, or `Ctrl+Enter` in its proposal's field, never Enter; the slug field takes
  what is typed, or the title's. Once it moved, the session's page says where it went, with the way
  there (rule 9). `c` opens the same card, empty, for a chat, as the old "…" did.
- **Rationale**: changing the core's tree to keep the whole info string reaches every reader of a
  workflow file; the grammar already tells the two bodies apart.
- **If wrong**: `Block.language` keeps the info string whole, and `offerOf` reads its second word.
- **Where**: `app/screens/session/{offers.ts,Offer.tsx}`.

## T43.5: A blocked action is allowed by its card's button or `a`, never by a press on its row

- **Decision**: the card reads "The agent wanted to run X", its state "Blocked by auto mode", and
  why or what allowing does. "Allow and retry" is `session.allow`, "Allow all (N)" from two is
  `session.allowAll`: the server's two actions, which the plan's words "allow once, allow always"
  stood for. Neither shows while the agent works, as allowing reopens its process: the card says to
  wait. With the card's row selected, `a` allows and `A` allows all.
- **Rationale**: a list's press runs its `onOpen` (R170): a tap on the card would have spent the
  agent's time (rule 2). The transcript has no `onOpen`; a press only selects.
- **Where**: `app/screens/session/{Permission,Transcript}.tsx`.

## T43.6: A message leaves the composer at once, is sent once, and comes back when refused

- **Decision**: Enter sends (the library's `Composer`); the draft empties at once (rule 6), and a
  send already on its way takes no second. A refusal puts the text and the images back, with the
  server's words under the field. While the agent works, the composer says whether the message joins
  its turn (the runtime's `steer`) or goes once it ends. Images are kept by the server as they come,
  by the paperclip (`Picker`), `Ctrl+V`, or a drop on the pane (the inbox's helpers), and Send waits
  for them. `S` stops the agent or its wait, declared only while there is one, and the Stop button
  shows then. A draft is kept on the device by its session, without `unsavedText`, whose
  `LeaveGuard` would ask before every leave of a page with a draft. `i` takes the composer.
- **Seen failing**: with the draft emptied only once the server answered and no guard, nothing
  failed: the second Enter came after the field emptied. With one Enter sending twice, "a message
  typed during a reply is sent once" failed with `expected 2 to be 1`.
- **Where**: `app/screens/session/Composer.tsx`.

## T43.7: What the old session screen did that this one leaves, and to whom

- **Decision**: left, each with its reason: the hand-over's workflow message and the recommended
  message (`?continue=`, "Start the agent", task 38's start); `?ask=` quotes and story comments
  (task 49's stories); the start's steps drawn where the transcript will be (task 38); recap lines
  and the Activity at a stretch (T43.3, task 44); the session's rename in place and "Drop the
  change…" (a later pass: rename needs a dialog, drop is the feature page's); the effort picker of a
  running session, `m` (task 38's run picker, whose component it is); `#turn-<id>` and the scroll
  place kept by Back (a transcript opens at its newest message, the rule of this task); the reply's
  frame on a done turn's last text; the announcer for screen readers.
- **Where**: `app/screens/session/`.

## T43.8: What the session's tests found of the driver

- **Decision**: three things the tests now work around, each said where it is done:
  - `app.value` reads the driver's own input, which the field's editor does not empty when its
    `value` changes: the composer is checked by what was sent, not by what the input holds.
  - Enter right after `app.type`'s last key can reach the field before the field's last change
    reaches the screen, and send what it held before: the tests wait for the field to hold the text.
    A person who types and presses Enter within a frame loses nothing: the text stays.
  - Whether a list is at its end is not on screen while it does not scroll: the list's "follows" is
    only heard from its scroll. `app.scroll(list, 1)` refuses at the end, "it is at N of N": with
    the list's anchor removed, "a streaming reply stays in view" failed with
    `expected ["Part 2",false,false] to equal ["Part 2",true,false]`; before that check it passed.
- **Where**: `app/screens/session/session.test.tsx`.

## T43.9: The sandbox's `sample` has a seventh chat, with a blocked action and an offer

- **Decision**: "Run the tests, then tidy the imports": its reply offers a change, and auto mode
  blocked `npm test`, with the rule `Bash(npm test)`: the permission card and the offer's card are
  seen and used there. R231's "six chats" are seven.
- **Where**: `fixtures/sandbox/chats.json`, `crates/server/src/sandbox/sessions.rs`.

## T43.10: The transcript's frames, in software: streaming meets 8.3 ms, a fling does not

- **Decision**: measured with `just frames`, once each on the final code, on the hidden display,
  which draws in software (R131), at 1400 by 800, 30 s each, the machine's load 1 to 4 (other
  agents' builds had held it near 20 to 30 before: each run waited for it to fall under 5):

  | Scene       | Median | p95     | p99     | Worst    | Main thread, a second's mean                   |
  | ----------- | ------ | ------- | ------- | -------- | ---------------------------------------------- |
  | `streaming` | ≤ 3.28 | ≤ 4.74  | ≤ 5.64  | 6.21 ms  | paint 0.67, drain 0.23, layout 0.54; 11 items  |
  | `scrolling` | ≤ 9.59 | ≤ 11.08 | ≤ 12.54 | 14.50 ms | paint 2.60, drain 1.75, layout 1.40; 159 items |

  Streaming is under the stand-in's 6.03 ms. The fling, 900 points a frame, is over the stand-in's
  10.04 ms, which was over 8.3 ms already (R239). Why, found by drawing each message's body as one
  `Text` for one run: 10.71 ms at p99, 99 items, the stand-in's cost. The rest is the Markdown each
  message is: a document's measure, its blocks' views, made again at each bind. On the way down from
  13.71 ms: the list's `Row` wrapper dropped (13.06), a whole text's tree kept per row in place of a
  split at each bind (12.78, JavaScript 3.1 to 2.5 ms), the text's own wrapper view dropped (12.54).

- **If wrong**: the frames on a GPU are task 53's. Next to try there: a document of one paragraph
  drawn as its one text, without its measure's and blocks' views.
- **Where**: `app/screens/session/Rows.tsx`, `app/gallery/scenes/session.tsx`.
