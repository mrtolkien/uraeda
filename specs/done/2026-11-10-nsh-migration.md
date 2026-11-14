---
kind: feature
finished: 2026-11-14
pull-request: https://github.com/mrtolkien/uraeda/pull/123
supersedes: [2026-10-14-run-ui, 2026-11-03-vim-text, 2026-11-08-extensions-system]
---

# Record: Migration to Native Shell and a Rust server

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-10, merged on
> 2026-11-13 in [its pull request](https://github.com/mrtolkien/uraeda/pull/123) while still a
> draft, and this record written on 2026-11-14, after the merge. Its full files are in git:
> `git log -- specs/2026-11-10-nsh-migration/`.
>
> Code and guides cite the folder's rulings by number ("ruling R422"). A ruling's text is read with
> `git show ef95ff51:specs/2026-11-10-nsh-migration/rulings.md`.

## What and why

The human asked to move Uraeda's UI off React, for performance, native apps, and a look of its own.
After two spikes, `spike/nsh` and `spike/exact`, they chose Native Shell (NSH), a framework that
draws one TSX and Rust codebase natively and in the browser, and asked that the Node server move to
Rust too. The app is now TSX on NSH over Rust modules, shipped as a Linux app and a web build, on a
component library of its own with glass, blur, and neon light in a terminal style. The server is
Rust, inside `ura`, as `ura serve`. There was no written proposal: the spec was written from a
conversation with the human on 2026-11-10, recorded as the round below. iOS and macOS were out of
scope, and came after the merge, on a Mac.

## Behaviour

- **US1, the Linux app.** `uraeda` finds this machine's server by its status file, or starts
  `ura serve` and stops the one it started as it closes. It pairs with the server, keeps the
  device's token in the Secret Service, and shows every place the React UI had. A reply streams in,
  and the transcript follows its end until the reader moves away. Vim's keys in a text field come
  from Uraeda's own Vim layer, in Rust: `d2w` deletes two words.
- **US2, the same app in a browser.** `ura serve` serves the web build it was compiled with, the
  same TSX with `crates/app` compiled to WebAssembly. A browser signs in with the access key, by an
  `HttpOnly` cookie, not by pairing. The tab's history is the app's: an address opens its page, Back
  returns, and a reload keeps the layout and the scroll. On a phone, every dialog or sheet with a
  scrim is a visit, so Back or an edge swipe closes it. A phone held sideways keeps the narrow
  frame.
- **US3, extensions.** An extension still lives in `<config>/extensions/` and reloads on a save. Its
  server part runs as TypeScript in a QuickJS VM inside the server, one VM per loaded version, with
  2 s to activate, 10 s per call, 256 MB of memory, and three doors to the machine: `uraeda:fs`,
  `uraeda:process`, and `fetch`. Its page is built by the server into an NSH package, signed, and
  run in a view of its own: an embedded view on GTK, a frame on its own `<name>.localhost` origin in
  a browser. A page that throws, loops, or never answers is named, and the app goes on.
- **US4, a coherent, glassy look.** Every screen is built from `app/ui/`. Every surface has a
  height, recessed, standard, raised, or overlay, which decides its shadow, its glass, and its glow.
  The [design language](../ui/design-language.md) holds the look, the gallery draws every component,
  and `just gallery-shots` takes its pictures.
- **US5, a remote device.** `ura pair` prints a one-time code of 12 symbols and its QR code, good
  for one device for 10 minutes. The device trades it at `POST /pair` for a token `<id>.<secret>`,
  which it gives in its `hello` and as `Authorization: Bearer`. Settings, Sign-in lists the devices,
  and revokes one: its connection closes, and it shows the pairing screen. A device unused for 30
  days ends. Uraeda still listens on loopback only: the owner brings the tunnel.

Rules a later feature keeps:

- **One protocol.** A client reaches the server through one WebSocket at `/live` and a few HTTP
  routes for bytes, nothing else. The types are declared once in `crates/protocol/`, and
  `just protocol-types` writes the client's `app/store/protocol.d.ts`; a test fails when it is
  stale. A connection opens with `hello` and gets `welcome` (with an `epoch` and the server's time
  zone) or `refused` (`client-too-old`, `server-too-old`, `not-signed-in`). A client subscribes to a
  record with `sub`, gets `data` whole once, then `change` messages of `set`, `append`, `insert`,
  `remove`, and `move` ops, each numbered by `seq`. It calls an action with `call` and gets `result`
  or `error`. After a drop it sends `resume` with the epoch and the last `seq`, and gets the missed
  changes or the value again. A list's items carry an `id`, and a path steps by field name or item
  `id`. A reply's text that only grew is always one `append`. A `data` value, `change` ops, or
  `result` output over 1 KB goes as a binary frame: its JSON head, a newline, then the part in raw
  deflate; a client refuses one over 16 MiB. The protocol is version 3, and both sides must match: a
  change an older client cannot read raises it, and nothing keeps the older one working.
- **One server per data folder.** `ura serve` keeps its files in `uraeda-next` of the system's data
  folder, and listens on `--port`, else `URAEDA_PORT`, else the settings' port, else 4310. A lock on
  `run/server.lock` holds the folder: a second start waits up to 10 s, then hands its folder to the
  running server with the host token of `run/server.json`, and exits. `ura import-sessions` takes
  the same lock. `ura serve` refuses a folder holding the Node server's `runner.sqlite`.
- **The access key is shown, never logged.** A server makes no key until someone will see it.
  `ura serve` on a terminal makes and prints one at its first start; a start whose output is a file
  or a pipe, as the app's is, makes none. `ura key` asks the running server for one, once, and
  `ura key --replace` signs out every browser and device. Settings, Sign-in has "Sign a browser in".
- **Extension pages are built and signed by the server.** It signs them with
  `<data>/extensions/signing.key` and serves the public half at `GET /extensions/key`. A client runs
  a page only when it verifies under the key this server gave it, with the app id
  `dev.uraeda.extension.<name>`, and refuses a build older than one it ran. A page's rights are its
  host channel alone: no file, process, network, web view, or clipboard. A page imports only its own
  folder, `uraeda/ui`, `uraeda/page`, and the build's modules.
- **The server owns every durable fact; a client owns per-device choices only.** The app holds no
  workflow logic: Markdown is parsed in Rust and sent as a document tree, statuses and messages come
  from records, and a run option sent as `""` means the agent's own default, which the server
  resolves. The device keeps its theme, layout, the position in a round, notification consent, and
  unsaved text (`unsaved:<key>`, written 300 ms after the last key).
- **Writes go through a queue per repository.** A write lands in its repository's turn, under a name
  the status shows ("Committing", "Pulling"), and answers once landed. A write to a feature's files
  is refused while one of its sessions runs a turn. A write arriving while the server stops is
  refused.
- **Agents never wait on a permission.** A blocked action is a `denial` in the turn's result; the
  human's yes opens a new process with the rule, then a message. After 10 quiet minutes on a
  background command the server steers in a check, and after 10 more with no answer the turn fails.
- **Keys that cannot be taken back ask first.** Continue all, Run now, push, merge, discard, allow,
  and the like open `Confirm`. With `loses`, Cancel holds the focus: Enter changes nothing, and `y`
  or the asking key confirms.

Success criteria, as measured:

- **Every route of the React UI has a screen, or a line saying why it went**: met.
  [`app/screens/parity.toml`](/app/screens/parity.toml) maps 31 old pages, 28 to screens and 3
  dropped with their reason (the decisions check, the moved addresses, the first-run page, now a
  state). Its 38 `[[left]]` lines: 19 brought back, 15 replaced, 4 left. The server's
  [`parity.toml`](/crates/server/parity.toml) maps 46 records (6 dropped), 114 actions, and 29
  routes (3 dropped), checked by a test.
- **Streaming and fast scrolling of a 20,000-message session within 8.3 ms a frame at the 99th
  percentile**: met on a GPU in an optimised build, headless at 120 Hz: `streaming` 1.59 ms,
  `scrolling` 3.28, `glass` 3.74, `reading` 6.22. Missed in software on the hidden display, where
  the development build's `scrolling` read 10.04 ms and `glass` 11.93; optimised, software
  `scrolling` is 7.16 ms.
- **Every navigation and action draws within 100 ms**: met warm, missed on a page's first visit
  (Decisions 152 ms, Git 118, a feature 120, a session 104) and for the 20,000-message chat (299 ms
  cold, 87 warm). A development build warns in its console past 100 ms.
- **A broken extension never stops the app or another extension**: met for a throw at load, a throw
  while drawing, an endless loop, and a page that never answers, by the VM's limits and the page
  watch. A browser cuts no call off, so there the watch names a page stopped after 5 s.
- **The repository builds and releases without Node**: met. The repository holds no Node, pnpm, or
  Vite+, and 2.0.0 was released from CI after the merge.

## Design

The server is `axum` on `tokio`, calling the Rust core with no binding between them. Each domain
mounts its records, actions, and routes; handlers are plain functions on blocking threads. A live
engine holds one topic per record and arguments, diffs each new value against the last, and sends
changes at a 16 ms pace, keeping 1,000 changes for a resume and an unheld topic for a minute.
Sessions live in a SQLite store of their own, an append-only log of events, so a streaming reply is
appends. The client is one TSX codebase on NSH 0.5.0, on GTK on Linux and as WebAssembly in a
browser. Work that runs per key or per chunk is Rust, because NSH's TSX runs in an interpreter with
no JIT (R30, R176, R202).

- **The protocol**: [`crates/protocol/`](/crates/protocol/): the messages in
  [`message.rs`](/crates/protocol/src/message.rs), `diff` and `apply`, the binary frames in
  [`frame.rs`](/crates/protocol/src/frame.rs), `catalog()` in
  [`registry.rs`](/crates/protocol/src/registry.rs), and the extension page's channel in
  [`page.rs`](/crates/protocol/src/page.rs). Examples the tests read are in
  [`fixtures/protocol/`](/fixtures/protocol/).
- **The live engine**: [`crates/server/src/live/`](/crates/server/src/live/), subscriptions, the
  typed bus, the topics, and resume (R47, R48).
- **Sign-in and devices**: [`crates/server/src/sign_in/`](/crates/server/src/sign_in/), with the
  pairing codes, the stored hashes, and the list of open routes; the HTTP guard and the web build in
  [`crates/server/src/http/`](/crates/server/src/http/); the lock and handover in
  [`start.rs`](/crates/server/src/start.rs) and [`status.rs`](/crates/server/src/status.rs) (R34,
  R529).
- **Records and writes**: [`crates/server/src/records/`](/crates/server/src/records/), one folder
  per domain, the one file watcher, and the write queue in
  [`records/writing/`](/crates/server/src/records/writing/) (R64, R89, R90).
- **Sessions and agents**: the store and the runner in
  [`crates/server/src/runner/`](/crates/server/src/runner/), the runtimes in
  [`crates/server/src/runtimes/`](/crates/server/src/runtimes/) (Claude Code, Codex, the fake agent,
  accounts), the MCP endpoint in [`crates/server/src/mcp/`](/crates/server/src/mcp/), scheduled jobs
  in [`crates/server/src/jobs/`](/crates/server/src/jobs/), and previews in
  [`crates/server/src/preview/`](/crates/server/src/preview/) (R69, R97).
- **Extensions**: [`crates/server/src/extensions/`](/crates/server/src/extensions/): the QuickJS VM
  in [`vm.rs`](/crates/server/src/extensions/vm.rs), the loader thread, the page build with NSH's
  bundler in [`pages.rs`](/crates/server/src/extensions/pages.rs), and the signing (R222, R225). The
  page API is [`app/extensions/`](/app/extensions/), and the example
  [`examples/extensions/wiki/`](/examples/extensions/wiki/) is written against it.
- **The sandbox**: [`crates/server/src/sandbox.rs`](/crates/server/src/sandbox.rs) and its folder,
  over sample projects built from `fixtures/` and the skill's templates at run time, in `.sandbox/`
  at port 4420 (R230).
- **Shared text**: [`crates/text/`](/crates/text/), the document tree, links, and patches, with no
  git and no file system, so the web build takes it; the core re-exports it (R442). The Vim layer is
  [`crates/vim/`](/crates/vim/), a state machine tested by
  [`tests/cases.toml`](/crates/vim/tests/cases.toml) (R31).
- **The native module**: [`crates/app/`](/crates/app/), `uraeda/native`: themes, fonts, the Vim
  bridge, diagrams by Merman, highlighting, the frame inflater, notifications, the extension view
  with [`page_trust.rs`](/crates/app/src/page_trust.rs), and the Linux host in
  [`host.rs`](/crates/app/src/host.rs) with [`server_start.rs`](/crates/app/src/server_start.rs)
  (R30, R246, R249).
- **The component library**: [`app/ui/`](/app/ui/): tokens, surfaces with the glass shader,
  controls, lists, the text field, the document renderer, the key registry, and the two-stack pane
  layout (R158, R163, R187).
- **The client store**: [`app/store/`](/app/store/): the connection in
  [`connection.ts`](/app/store/connection.ts), records held per owner, routes, history, and device
  storage (R242, R243).
- **The screens**: [`app/screens/`](/app/screens/), one folder per place; the browser's own parts in
  [`app/web/`](/app/web/); the gallery in [`app/gallery/`](/app/gallery/); the walk and the
  benchmarks in [`app/tools/`](/app/tools/).
- **The release**: `just package` and [`scripts/package.sh`](/scripts/package.sh) for the Linux
  tarball and AppImage; `just web-build` for `target/web/`, embedded into `ura` at compile time;
  `just release` in [`crates/xtask/`](/crates/xtask/) (R397, R444).
- **The guards of NSH**: [`crates/app/tests/outside.rs`](/crates/app/tests/outside.rs) checks what
  the migration assumed of NSH on GTK: signed packages, a page's errors, web views, diagrams,
  notifications, and the bundled fonts (R22 to R26, R156).

## Replaced behaviour

- **The React web UI, its Storybook, and its tests**: `packages/web/` is gone. The gallery,
  [`app/gallery/`](/app/gallery/), replaces the app's Storybook.
- **The Node server and its tests**: `packages/server/` is gone. The two parity lists say where each
  record, action, route, and page went. In all, 333 test files and 2,359 tests were removed with the
  Node code, and the Rust and TSX tests guard each group again, except a few: lint rules for colour
  by role and raw elements, the phone's keyboard inset and sheet swipe (pictures only), the tests of
  the worktree-seed script, and the "first page within 2 seconds" smoke test.
- **The Node binding and the npm package**: `packages/binding/`, `crates/binding/`, and
  `packages/uraeda/` are gone, with the core's `napi` feature, Vite+, pnpm, Node, `npm.yml`, and the
  TypeScript of `scripts/`. `npx @uraeda/ui` no longer exists: Uraeda ships as `ura` and the app.
- **The extension API**: rewritten in place, still `api = 1`. Server code has no `node:` modules and
  no Hono; a route takes `(request, repository)` and answers a `Response`. Pages are TSX on the
  app's library, not React with Astryx and StyleX. An extension written for 1.x fails to load, and
  its problem names why.
- **CodeMirror's Vim engine**: its behaviour tests are replaced by the Vim layer's cases, checked
  against Neovim.
- **Sessions' storage**: the Node server's `runner.sqlite` is not read in place.
  `ura import-sessions` copies its sessions once into the new store; nothing imported runs by
  itself.
- **The benchmarks' runner**: `packages/benchmarks/` is deleted. Its suites, cases, and records stay
  in [`benchmarks/`](/benchmarks/), and nothing runs a benchmark until a port to the Rust server.
- **Test fakes**: the fake Storybook and fake Codex are Rust now; the recordings of
  `fixtures/runner/` are frozen, as the scripts that wrote them went.
- **Old features the new app lacks**: four `[[left]]` lines of
  [`app/screens/parity.toml`](/app/screens/parity.toml): the inbox's outliner (indent, outdent,
  nested drags), Home's Recent (a merged feature carries no date), the New page's `/` search, and
  the reply's frame on a done turn. Enter-to-start a feature and the one-line run-options strip were
  replaced on purpose, by the start dialog and the run map.

## Gotchas

NSH's own traps that [`AGENTS.md`](/AGENTS.md) already lists (no JIT, GTK and its backdrop, the
`<Image>` fonts, borders painted over children, `ErrorBoundary`, the browser's layer scope, the four
places of the pin, the `rolldown` crates, the hidden displays) are not repeated here.

**NSH and GTK**

- **The overlay's Escape is held while a field is in insert mode**: NSH chains an overlay's Escape
  after every view's binding, so it beat the field inside, and a dialog closed in insert mode. The
  field holds it with `escapeHeld`, and the Vim bridge presses Escape itself
  ([`TextField.tsx`](/app/ui/text/TextField.tsx)) (R197).
- **The focus ledger is the app's**: on GTK only a field takes keyboard focus, and NSH's Tab walks
  every pressable view without drawing focus. Tab and Shift+Tab walk a pane's own stops in
  [`focus.ts`](/app/ui/surfaces/focus.ts) (R159, R522).
- **The glass shader takes 64 taps per glass view, turned per pixel**: NSH gives a shader one
  full-size backdrop and no second pass, so there is no shared quarter-size frost, and a fixed
  spiral drew ghosts of the text behind ([`glass.wgsl.ts`](/app/ui/surfaces/glass.wgsl.ts)) (R129).
- **Glow is a shader and gradients, not `drop-shadow`**: `filter: drop-shadow()` on a pane
  re-blurred it on some scroll frames, and an inset-shadow tube drew in three bands
  ([`glow.wgsl.ts`](/app/ui/surfaces/glow.wgsl.ts)) (R130).
- **A shader is a string in a `.wgsl.ts` file, compiled by a test**: NSH's bundler reads every
  import as JavaScript, and a shader that fails to compile only logs: `from`, a reserved WGSL word,
  silently killed the caret's trail ([`shaders.rs`](/crates/app/tests/shaders.rs)) (R157, R199). A
  font imported from a subfolder got 404 on GTK, so fonts are the crate's assets
  ([`crates/app/assets/fonts/`](/crates/app/assets/fonts/)) (R137).
- **Text fields keep `whitespace-nowrap` around the editor**: NSH's editor wraps rows itself, and
  GTK re-wrapped a row whose trailing space passed its box, drawing one word over another (R198).
- **A list row has one structure**: NSH's list recycles cells with no kinds, and a row swapping
  views with `If` cost 210 mounted items a frame. A growing reply is the list's last row, not its
  footer, and NSH reads `id` itself, since a `keyExtractor` in TSX was slow over 20,000 rows
  ([`VirtualList.tsx`](/app/ui/lists/VirtualList.tsx)) (R237, R239).
- **The transcript follows its end by reader state**: GTK clamps the offset when content shrinks for
  a frame, and a clamp looks like a wheel notch in a scroll event, so only `onScrollEnd` says the
  reader moved ([`follow.ts`](/app/ui/lists/follow.ts)). `just follow-check` guards it (R519).
- **A long list opens at its end with `initialScrollAtEnd`**: NSH 0.5.0's animated `scrollToEnd`
  stops about 35 rows short in a 20,000-row list of unmeasured rows (R425).
- **`KeysHost` returns its children alone**: beside changing siblings it remade the whole app at
  each navigation, 126 frames per run where one was due; `g p` fell from 74 to 40 ms. No small test
  reproduces it (R413).
- **NSH's WebSocket throws past eight queued messages**, so the connection keeps its own queue. A
  headless engine draws no frame, so batching is on a 16 ms timer, not `requestAnimationFrame`
  ([`connection.ts`](/app/store/connection.ts)) (R243).
- **An app folder is wherever `App.tsx` or `nsh.json` sits**: one above a test file makes that
  folder an app of its own, with no `uraeda/native`. The gallery's entry is `Gallery.tsx` for that
  reason. A test's engine has no network and default `process.env` alone, and capabilities come from
  the entry folder's `nsh.json` only, hence `app/store/harness/nsh.json` (R234, R241, R252).
- **NSH has no notification API**: Linux sends `org.freedesktop.Notifications` over gio, on a thread
  running its own GLib loop, since NSH's engine thread runs none
  ([`notify.rs`](/crates/app/src/notify.rs)) (R26, R371).
- **NSH storage holds 5 MB**, in `$XDG_DATA_HOME/dev.uraeda.app/storage.json` on GTK, and gives no
  order to concurrent writes of one key: the device store writes one value at a time
  ([`device.ts`](/app/store/device.ts)) (R128, R434).

**The browser**

- **The host channel is set by the page entry itself**: NSH 0.5.0's browser `nsh/host` never reaches
  `createPlayer`'s `host` option. Remove `BROWSER` from [`page.rs`](/crates/protocol/src/page.rs)
  and `uraedaHost` from [`frame.html`](/app/web/frame.html) once NSH fixes it (R466).
- **Extension frames live on `<name>.localhost`**: a looping same-origin frame froze the app, and a
  sandboxed frame without an origin froze every other one. Only a separate host gives each its own
  process in Chromium. Safari isolates no frame, and behind a proxy the frames share one process
  ([`host.web.tsx`](/app/extensions/host.web.tsx)) (R465).
- **The page's CSP allows `'unsafe-inline'` scripts**: NSH writes the frame's import map as an
  inline script, which a hash policy refused ([`policy.rs`](/crates/server/src/http/web/policy.rs))
  (R446).
- **The app's history is its own**, `web.history: false` in `nsh.json`: NSH's entries took the
  address of the turn that opened a dialog ([`history.web.ts`](/app/store/history.web.ts)). A
  browser's `history.back()` lands a tick later, so a push right after a close queues behind it
  ([`backCloses.ts`](/app/ui/surfaces/backCloses.ts)) (R454, R536).
- **Glass in a browser is `backdrop-filter`**: at 4x CPU slowdown, the blur held 60 frames a second
  on the Decisions list where the shader held 9 ([`Glass.tsx`](/app/ui/surfaces/Glass.tsx)) (R456).
- **Diagrams in a browser are the server's pictures**: Merman and `usvg` were 7.7 MB of the module,
  so the web build leaves them out, and `POST /diagram` draws them (R443, R457).
- **The first load stays under 3 MB, brotli**: it was 5.0 MB at first. Only Monaspace Neon Regular
  registers before the first frame, each other family is a chunk of its own, and the syntaxes come
  after the first frame. The build weighs about 2.98 MB, and [`web.rs`](/crates/server/tests/web.rs)
  holds the limit at the plan's 3 MB, since a tighter 2.95 MB failed the 2.0.0 release on its
  version alone (R445, R471, R475).
- **The protocol compresses itself**: `tungstenite` 0.28 to 0.30 has no `permessage-deflate`.
  Default deflate made 890 KB into 145 KB in 17 ms, where the fast level gave 218 KB in 2.5 ms
  ([`frame.rs`](/crates/protocol/src/frame.rs)) (R484, R485).
- **Dropped files do not reach the page**: NSH 0.5.0's web runtime passes no drop, so the page says
  to paste or pick ([`Drops.tsx`](/app/web/Drops.tsx)) (R458).
- **The web build's `crates/app` must not pull in the core**: `gix-sec` and `libwebp-sys` do not
  build for `wasm32-unknown-unknown`, which is why `crates/text/` exists (R442).

**The server**

- **Events are read with `Event::parse` or `from_value`, never `from_str`**: `rolldown` turns on
  serde_json's `preserve_order` and NSH's bundler `arbitrary_precision`, so JSON compared or stored
  sorts its own keys (R19, R70).
- **The session store opens its file twice**, a writer and one read-only reader under WAL: one mutex
  made a read wait 167 ms on average behind four writers, and 0.59 ms after
  ([`store.rs`](/crates/server/src/runner/store.rs)) (R259).
- **The queue tells the records before it answers the waiter**: else a read after the `result` saw
  the old state ([`records/writing/`](/crates/server/src/records/writing/)) (R90).
- **A test server's `PATH` holds failing stand-ins for `claude`, `codex`, and `gh`**: without them a
  test started the owner's real Codex on their account. The stand-ins are links to one script, to
  avoid "text file busy" (`crates/server/tests/support/machine.rs`) (R118).
- **A preview wakes only on a navigating `GET`, once a minute**: hot-reload pings from a stale frame
  restarted a preview the idle sweep had just stopped, all night (R430).
- **A flock is inherited by forked children until `exec`**: the lock unlocks before it closes
  ([`status.rs`](/crates/server/src/status.rs)) (R533).
- **`crates/server/tests/` and `crates/app/tests/` are each one test program**, `autotests = false`,
  which cut about 10 GB of `target/`: select tests by module, `-E 'test(/^browser::/)'` (R516).

**Packaging**

- **`nsh package` is not used**: its program lacks the host's calls, so the app waited forever for
  its server ([`scripts/package.sh`](/scripts/package.sh)) (R397).
- **Binaries built in the Nix shell are patched to the system loader**, and eight `libm` functions
  that glibc 2.43 and 2.44 gave new symbol versions are wrapped by
  [`glibc-floor.c`](/scripts/glibc-floor.c): `just package` fails past glibc 2.39. Full RELRO means
  a GTK older than 4.14 fails before `main`, so only the launcher can say so (R398).

**Measuring**

- **A frame's time on the hidden display is software painting**: the GPU numbers come from
  `hidden-display --gpu`, and benchmarks build at `opt-level = 3` in `target/optimised/`, where the
  development host builds NSH at 0: navigations took 110 to 250 ms there against 45 to 100 ms
  optimised (R411, R412).
- **A timing is a quiet machine's or nothing**: under other agents' load, the frames of the same
  scenes, under 6.3 ms on a quiet machine, read 13 to 34 ms (R416).

## Questions

### Round 01

#### Q1: What happens to the TypeScript server in this migration?

**Answer:** A: port the server to Rust in phase 0.

#### Q2: How should the plan handle the active decisions the migration contradicts?

**Answer:** A, the plan drafts them and the human approves; the notes then moved the new text onto
the branch, approved with the spec, with no gate of its own.

#### Q3: What happens to the React web UI while the new clients are built?

**Answer:** A: freeze it now, and remove it at the web phase.

#### Q4: What does phase 0, the core, cover?

**Answer:** "You decide. It was a rough idea of the importance of platforms." Phase 0 covered
everything the clients share: the server, the protocol, the store, the component library, and the
extension host.

#### Q5: What runs an extension's server part, with a Rust server?

**Answer:** A: TypeScript in a VM embedded in the server, with the built-in Claude Code and Codex
runtimes in Rust.

#### Q6: How should a remote device reach the server and sign in?

**Answer:** A: the owner's own tunnel, plus device pairing.

#### Q7: How does the human steer the new look?

**Answer:** A, two gates, the design language then the gallery; the notes replaced both with no gate
at all.

#### Q8: What should modal editing be on the new clients?

**Answer:** A: Uraeda's own Vim layer in Rust, a defined subset.

#### Q9: How should the Rust server ship?

**Answer:** A: one `ura` binary, with `ura serve`.

#### Q10: Which Linux packages should the first release produce?

**Answer:** A: a tarball and an AppImage.

#### Q11: Must the Rust server keep working on the data an installation already has?

**Answer:** "Do what's best. The existing formats exist for a reason, but you're allowed to make
something better." Config, themes, and repositories were kept as they are, and sessions are imported
once into a new store.

#### Q12: How should the plan stand, with no spec to argue from?

**Answer:** A: write a short spec too, from the conversation.

#### Notes

- Scope: "iOS and MacOS are _not_ part of this plan. The plan stops after the web app being ready."
  On iOS, later: "we should use native widgets, which are glassy".
- Compatibility: "it's really ok to break compatibility, no one really uses the tool atm". The
  session import is removed after the port, and the extension API stays version 1.
- Helix was weighed against Vim again: "If we can't bring the full helix feature set, go with vim.
  Helix is worth it only if simpler." Helix's code cannot be embedded, so Vim stood.
- Heights: "Components in our system should have a concept of 'height'. We have recessed surface,
  standard surface, and overlays, at least."
- Decisions: "I don't like that the decisions new text is a step in itself and needs a human gate.
  Let's do the decisions here directly."
- The design language: "be BOLD and do research: lazyvim, zed, hyprland, unixporn", "in the _vein_
  of the existing one", and "do the research work for step 26 yourself".
- Gates: "the plan should NOT have a single human gate. I'll start the implementation and will leave
  for the night. Ideally I'll come back to a finished native app."
- From the spec's review: the stack decision drops the document-tree rule, "the idea is just that
  logic should stay on the server"; the distribution decision names no Linux format, and allows "a
  .env for secrets, but in the conf folder".
- On the mockups, over three rounds: "I prefer the 'running light' to be steady. Movement should be
  meaningful (state transition)"; "I like the idea of having the active pane emit 'light'"; "We're
  allowed to have text glow a bit". Their terminal's cursor shader became the caret's trail. The
  last picks: "Main button -> lamp"; "lips for the heights"; "The glass should be a bit darker",
  "contrast is important".

## Decisions

- [Stack](../decisions/stack.md), changed: the server and CLI are Rust in `ura`, calling the core
  directly; the app is TSX on NSH over Rust modules, and holds no workflow logic.
- [Protocol](../decisions/protocol.md), new: clients reach the server only through one versioned
  protocol, a record whole once then changes, with one version at a time.
- [Distribution](../decisions/distribution.md), changed: `ura` and the apps, released together from
  one tag by CI, with no runtime or package manager; no npm package.
- [Toolchain](../decisions/toolchain.md), changed: every check is a `justfile` recipe in the Nix dev
  shell, `just ready` runs them all, and the React Compiler rule went.
- [Extensions](../decisions/extensions.md), changed: Uraeda builds and signs extension pages, each
  in a view of its own; server parts run in a VM; the built-in runtimes are Rust.
- [Sign-in](../decisions/sign-in.md), changed: a device pairs once and signs in with its own
  revocable token; the access key is shown, never stored in clear.
- [Text editing](../decisions/text-editing.md), changed: Vim's keys come from Uraeda's own Vim
  layer, a defined subset.
- [UI components](../decisions/ui-components.md), changed: screens use Uraeda's own library and its
  tokens, in place of Astryx.
- [Colour themes](../decisions/colour-themes.md), changed: themes gain roles for glass and glow, in
  the same TOML format.
- [Preview](../decisions/preview.md), changed: a mockup of what components can draw is a gallery
  page; previews draw in a web view on native clients.
- [Performance](../decisions/performance.md), changed: a frame budget of 8.3 ms joins the 100 ms
  target, and a missed number is measured and named, never a failed check.
- [Diagrams](../decisions/diagrams.md), changed: diagrams are drawn by Merman in Rust, and never run
  a script.
- [Sandbox](../decisions/sandbox.md), [Code quality](../decisions/code-quality.md), and
  [Benchmarks](../decisions/benchmarks.md), changed for the new tools: the sandbox serves the new
  app, exceptions to the linters are marked the same way in Rust and TSX, and benchmarks reach
  agents the way the server does.
- The UI look decision was removed: its look is the [look and feel](../ui/look-and-feel.md) guide's,
  with the new [design language](../ui/design-language.md) and [panes](../ui/panes.md) guides beside
  it. The [keyboard](../ui/keyboard.md), [phone](../ui/phone.md), [components](../ui/components.md),
  and [surfaces](../ui/surfaces.md) guides were rewritten for the new app.

## Changes after approval

- Three tasks were added after approval: catching up the default branch to 1.4.0 (multi-accounts and
  scheduled jobs, ported to the Rust server), moving NSH from 0.4.0 to 0.5.0, and compressing the
  first values a client gets, which became the binary frames and protocol version 2.
- No human gate stopped the build, by the human's note: the design language's mockup review and the
  gallery's review were each replaced by a fallback the agent applied.
- The Linux package is not made by NSH's packager, which could not start the app's server: a script
  of the repository assembles the tarball and the AppImage.
- The web build's tests are Rust, driving the dev shell's headless Chromium over DevTools on the
  page `ura` serves, where the plan first named NSH's test runner, whose web target runs NSH's own
  development page.
- The web build's first load was 5.0 MB against the plan's 3 MB; fonts and syntaxes on demand
  brought it under 3 MB.
- The toolchain moved from Rust 1.97 to 1.100.0.
- The protocol is version 3: a feature in Now with no run, at an agent's step, reads "Waits for your
  Continue", is listed in Needs you, and counted in the window's title, but never notified.
- The access key is no longer made at a server's first start: it is made when someone will see it,
  and `ura key` shows one. So a server the app starts writes no key to `run/server.log`, which an
  earlier version did.
- The Rust server took the Node server's port, 4310, once the Node server went; it ran on 4320
  beside it during the work. Its data folder stays `uraeda-next`.
- The reviews changed what a user notices: keys that cannot be taken back ask first, with Enter safe
  on what loses something; text typed during a save is never lost, and a refused send comes back in
  the field; an editor never saves over a file changed under it, and offers "See what changed",
  "Take the file's version", or "Save yours over it"; a second server never starts on a data folder
  one already holds; a dialog on a phone closes with Back; Tab walks a pane's controls; a quiet
  background command gets a check, then fails the turn.
- The parity pass brought back old features first left out, among them Continue all, renames, a
  session's effort, and "Ask the agent".
- No tag was pushed on the branch: the release was left to the owner, and `just ready` passed in its
  place.

### After the merge

Fourteen commits went to main on 2026-11-13, with no folder of their own:

- **iOS**: `just app-ios`, `just package-ios`, and `just install-ios` build the app for the
  Simulator and a phone, with its navigation in the system's Liquid Glass and a page that connects
  to a server by address or a `ura pair` link ([`scripts/ios.sh`](/scripts/ios.sh)).
- **macOS**: the Mac app on AppKit, running its own server ([`local.rs`](/crates/app/src/local.rs)),
  with the Mac's window, menus, alerts, and Liquid Glass, built by `just package-macos` and in CI on
  Apple silicon.
- **Release 2.0.0**: published from CI on 2026-11-13, with the Linux tarball and AppImage, the Mac
  app, and `ura` for Linux and macOS.
- **The app's own updates**: NSH's updater checks GitHub releases at start and from Settings,
  Updates, and installs a signed update, or opens the release's page where the app cannot replace
  itself ([`updates.tsx`](/app/screens/shell/updates.tsx)).
- Smaller fixes: the first load held to 3 MB, the Vim bridge kept under 500 lines, the extension
  frame on the web, and obsolete inbox notes removed.

## Follow-ups

- **For the owner**: four commits on main end with a co-author line naming a tool, against the
  authorship rule: `b1b3c7a2`, `1f0f2db1`, `d0d93754`, and `04118a98`. Rewording them rewrites all
  later history.
- **Targets not met**: a page's first visit and the 20,000-message chat miss 100 ms, and software
  frames miss 8.3 ms. The remedies named and not built: read-ahead of the selected row's page, fewer
  views per card, a first page of rows near the chat's end, and smaller first values (a `Ledger` of
  rows, a `Decision` record, a `Themes` of names).
- **NSH workarounds kept until a release fixes them**: the overlay's Escape over a field's, the
  browser's host channel (`BROWSER`, `uraedaHost`), the unfocusable GTK web view, the editor's
  `line` style that never shows, `DiffView`'s fixed token colours, a shader that fails only in the
  log, no error callback on an embedded view, the 35 rows `scrollToEnd` stops short, the GTK follow
  clamp, and the held `rolldown_*` crates. The upstream reports drafted in the rulings were not
  filed.
- **`ura import-sessions`** is a one-time tool, to remove with its importer, its tests,
  `fixtures/runner/`, and its lines in `docs/cli.md` and the skill's CLI reference.
- **The benchmarks' runner** waits for a port to the Rust server, about 3,000 lines.
- **The four old features left**: the inbox's outliner, Home's Recent, the New page's search, and
  the reply's frame on a done turn.
- **Untried**: the safe area and browser bars on a real phone, a phone's real notification service
  worker, Home's `C` continue-all, and Safari's frame isolation.
- **Left to the human's taste**: a phone browser held sideways stays narrow, where the phone guide
  defines narrow by width alone, and the sizes the phone walk flagged (session activity rows at 30
  points, diff lines at 20).
- **Dependencies left old**: merman 0.10 (a port), oxc 0.158, nixpkgs, and the GitHub Actions
  versions; advisories under NSH's own crates wait for NSH.
- 20 TSX functions carry a marked exception to the function-length lint, whose limit is 150 lines,
  to come down until it can drop to 100.
