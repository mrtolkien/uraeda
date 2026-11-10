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
  environment, without the secrets. The crate's documentation names the rule; no lint does.
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
    place in the write queue or ended (T99.9).
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
    `records/mod.rs`, and its line in `DOMAINS` there, which calls it (T99.3).
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
    shape `fn(&Bus, &str, &Changes)`: the bus, the repository's name, and the core's `Changes`,
    which names features, files, and flags, not paths. A domain adds one line there.
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
- **If wrong**: a domain that needs the server's state in `files_changed` gets the bus only: the
  join widens the shape. A watch that fails to start is printed, and its files show when read again.
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
    join, which gave each one declaration, in `crates/protocol/src/shared/` (T99.1).
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
  The join replaced it with the queue's `write` and `land` (T99.6 to T99.8), and what follows
  describes the stand-in.
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
    feature's answers once planned (T99.8). `feature.drop` and `feature.promote` hold, archive, and
    move no session, and no write is refused while an agent works.
  - A typed start with images is refused: the uploads (task 16) keep an image's bytes, and
    `starts.rs` has the one function that reads them, marked `// JOIN(wave 6): chat images`.
    `change.fromNote` reads a note file's images from the repository, and takes them.
  - Nothing calls `files_changed` and `config_changed` until the one watcher (task 7) is joined: a
    record follows this domain's own actions, and not yet a file written outside the server.
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
    messages are ported (task 15). `steps` came with the starts, at the join (T99.8). A new field
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
    either order. The join made a connection's calls reach it in the order sent (T99.9).
  - `cargo fmt` did not see a module declared inside `domains! { }`: the join made them plain `mod`
    lines (T99.3).
  - Git and the hooks the core runs get the server process's environment, without the config
    folder's `.env`: the core starts them itself.
- **Where**: task 9, `crates/server/src/records/writing/queue.rs` and `queue/repository.rs`. The
  join of wave 6, and tasks 8, 10, 15, and 16.

## R65: What the write queue leaves to the tasks that need it

- **Decision**: the parts of the Node server's queue that nothing calls yet are not ported, since
  unused code fails the lint.
  - **The refusal while an agent works** (`writable` in `fate/sessions.ts`): task 15 owns the
    sessions. Each handler of writing knows the folder or the path it writes, so the refusal is one
    check before its `write`.
  - **A landing of its own, and its steps** (`add`, `enqueue`, `update`, `free`, `inTurn`): a
    start's write. Built at the join, as `writing::land` (T99.7) and the starts (T99.8).
  - **Kept messages** (`unsent`, `waits`, `settled`, and `queued` on a write): sessions.
  - **Git's own writes** (`arrive`, `background`, and `landed`): task 10's actions and the fetcher.
    Built at the join (T99.7); `arrive` is the order of a connection's calls (T99.9).
  - **A repository leaving the list**: its queue stays open until the server stops.
  - **The other domains' records**: a write here said `Buffer` and `WriteQueue` only. Since the
    join, the queue tells every domain after each write and each landing (T99.6).
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
  - **Every write takes `write`**, the name the queue's record shows it under, since the join
    (T99.7): the page's own name when none is given.
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
    queue, under its name, with git's output (T99.7).
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
- **If wrong**: the join can call `fetcher::fetch` as a repository joins the list, where it starts
  that repository's watcher.
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
  - `GET /r/:name/mockups/<path>` serves the file at `<path>`, to a signed-in request only. The Node
    server's path starts with the frame secret, and a path without it is sent to its path under it
    with 303. Task 18 owns the secret: the comment `TASK 18: frame secret`, in `files/raw.rs`, is
    where its check and the redirect go. Until then, a sandboxed frame, which sends `Origin: null`,
    gets the guard's 404 on a mockup.
  - `GET /raw/*` and `GET /mockups/*` without `/r/:name`, which sent a link from before repositories
    had names to the most recently opened one, are not ported: compatibility may break.
  - `DELETE /r/:name/chat-images/:id` deletes an image without asking whether a sent message holds
    it: the session store answers that (task 11), through `files::images::in_a_message`, marked
    `JOIN(wave 6)`. So does the refusal of an upload to a feature an agent works on,
    `files::attach::writable`. No session exists on this server before task 15.
  - What a path may read is the core's rule alone, `api::read_raw` and `api::read_image`: nothing
    outside the repository, hidden, untracked, or behind a symlink. The server opens no file of a
    repository itself.
- **Rationale**: R36 says the guard's frame check waits for task 18, and both tasks are built at the
  same time. One home for the containment rule is what `ura lsp` and the server share.
- **If wrong**: the Node server answered every route but mockups' and previews' with
  `X-Frame-Options: SAMEORIGIN`. The Rust server has no such layer yet: it belongs in
  `http::router`, with the frame paths of task 18.
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
- **If wrong**: task 16 built mockups at the same time, without this. At the join, its mockup route
  is listed in `OPEN` as `Open::Frame`, and reads the secret from `preview::frame_secret`.
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
    previews: a commit outside `specs/` then starts one again at the new code. The join's watcher
    calls it. A commit under `specs/` keeps it.
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

## T99.1: A type two domains use is declared once, in the protocol's `shared/`

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

## T99.2: Every domain finds a repository through the workspace's list

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

## T99.3: The records' domains are plain `mod` lines and a list, so `cargo fmt` formats them

- **Decision**: `records/mod.rs` declares each domain with a plain `mod <domain>;` and names its
  `register` in the list `DOMAINS`, in the order they register. The macro `domains! { }`, which did
  both from one line, is gone.
- **Rationale**: rustfmt does not expand a macro, so it never found the files of a module declared
  inside one, and `vp check` passed whatever their formatting. Two lines per domain is the price: a
  domain left out of `DOMAINS` fails the lint, since nothing calls its `register`.
- **Where**: `crates/server/src/records/mod.rs`. Tasks 15, 17, and 20, which add a domain.

## T99.4: What every records domain needs of another has one home in `records/`

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

## T99.5: The server's tests share one fixture repository and one client of `/live`

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

## T99.6: Every write goes through the write queue, which tells every domain's records

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

## T99.7: A write of its own lands on the queue's thread, as git's writes do

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

## T99.8: A start is a write of the queue, with its steps, and a feature's answers once planned

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

## T99.9: A connection's calls reach the write queue in the order it sent them

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
