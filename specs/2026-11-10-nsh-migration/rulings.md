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
    same time, a client's own too: an action that needs an order keeps it itself, as the write queue
    does.
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
    function `register(&Shared, &Registry) -> Result<(), Failure>` and one line, `mod <domain>;`, in
    the list of `records/mod.rs`, which declares the module and calls it.
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
  - An undoable write of the lists answers the change an undo writes back, a `RecordedChange` of
    each file's bytes in base64, with what no record shows: `ListWritten { hash, change }`, the
    list's hash to write over next; `NoteMoved { change }`; `FileWritten { path, change }`, the
    proposal file to open. `inbox.edit`, `priorities.commit`, and `priorities.discard` are not
    undone, and answer no change. `inbox.removeImage` answers the inbox's hash, not its file's. The
    core records the change as the write runs, so the binding's token and its `takeChange` are gone.
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
  - `features/duplicates.rs` holds the seventeen types the workspace's domain declares too, copied
    word for word from task 7's commit, so the client's types are the same text: `FeatureView`,
    `StepView`, `TaskProgress`, `CatchUpView`, `FileSummary`, `ProblemView`, `PullRequestView`,
    `PullRequestState`, `ProposalView`, `FeatureStatus`, `SessionStatus`, `StatusReason`, `Wait`,
    `RunOptions`, `StepOptions`, `RunPick`, and `ReviewerOptions`. The crate names them
    `uraeda_protocol::feature_duplicates::…` until the join deletes the file.
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

- **Decision**: until the write queue (task 9) is joined, `records/features/turn.rs` gives one
  writer per repository: a lock by main checkout, taken by every action of this domain that writes.
  Each call site is marked `// JOIN(wave 6): write queue`.
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
    change's page offers its message unsent. `feature.drop` and `feature.promote` hold, archive, and
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
