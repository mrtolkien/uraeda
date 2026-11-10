---
status: awaiting-human
spec-revision: 1
---

# Plan: Migration to Native Shell and a Rust server

> [!IMPORTANT]
>
> Plan to review, about 2 hours.
>
> - Beyond the spec: four behaviours get a test the spec does not name, see
>   [review focus](#review-focus).
> - Three human gates stop the build: the decisions' text (task 1), the design language (task 26),
>   and the gallery (task 36).
> - Task 3 checks what the spikes did not verify. If a check fails, the build stops and comes back
>   to you.
> - New dependencies: NSH 0.4, `axum`, `tokio`, `rusqlite`, `rquickjs`, and a newer Rust toolchain.
> - The riskiest tasks come early: sign-in (6), the session store (12), and the extension VM (18).
> - The plan has 62 tasks in three phases: core, the Linux app, then the web build.

**Goal:** Uraeda runs as a Rust server inside `ura`, with one TSX client on Native Shell that ships
as a Linux app and a web build, on a component library of its own.

**Architecture:** see [the spec's architecture](spec.md#architecture) for the shape. The ownership,
the layout, and the contracts are under [code read](#code-read). The tasks come in three phases:

| Phase         | Tasks | Ends with                                          |
| ------------- | ----- | -------------------------------------------------- |
| 0, core       | 1–36  | A Rust server, a client core, and a gallery        |
| 1, Linux, GTK | 37–56 | The Linux app, packaged, at parity                 |
| 2, web        | 57–62 | The web build, and the React and Node code removed |

iOS and macOS are not in this plan. Nothing here may close them off: see
[global constraints](#global-constraints).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions the spec implies but does not name. Each gets a test in the task
that owns the code.

1. **A change arrives for a subscription the client just dropped.** The client ignores it, and the
   store's count of subscriptions stays right. Task 24.
2. **Two clients send an action on one record at once.** Both get a result, and both end with the
   same value. Task 7.
3. **The server stops while an extension's VM is in a call.** The VM is stopped, and no process or
   timer of it is left. Task 18.
4. **A paired device's clock is wrong.** Pairing and sign-in do not depend on the device's time.
   Task 6.

## Global constraints

Every task's requirements include these.

Kept from the active decisions, word for word, until task 1's revisions are approved:

From [Stack](../decisions/stack.md):

- Workflow logic, parsing, validation, and states MUST live in the Rust core.
- The web UI MUST draw workflow files from the core's document tree, never parsing their markdown.
- The server MUST stop every preview command it runs when it stops.

From [Extensions](../decisions/extensions.md):

- Extensions MUST load only from the config folder, never from a repository.
- A broken extension MUST NOT stop Uraeda or another extension from running.
- Extensions MUST NOT depend on each other: they use only the contracts Uraeda owns, like a
  runtime's, its events, and its data records.
- Extensions MUST NOT add instructions to the agent's runs.

From [Sign-in](../decisions/sign-in.md), as the code has it in
[`packages/server/src/sign-in/`](/packages/server/src/sign-in/):

- Every request carries a valid session, except the UI's files, the sign-in routes, and preview
  paths with the frame secret. The WebSocket counts as a route.
- The server listens on loopback only.
- Keys, sessions, and tokens are random, and stored only as hashes.

From [Keyboard](../decisions/keyboard.md):

- A shortcut MUST be declared in the key registry, and listened for nowhere else.
- Every action MUST work by keyboard and by tap, never by hover or a single key alone.

From [Testing](../decisions/testing.md):

- A test MUST assert what a caller or a user observes, never how the code does it.
- At the `early` stage, a feature MUST test little beyond stored formats, git, security, contracts
  between the project's parts, pure logic with many cases, and the reproduction of each bug fixed.
- The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's and a desktop's width.

Set by this plan, from the human's answers on 2026-11-10:

- **The React UI and the Node server are frozen.** No task changes `packages/web/` or
  `packages/server/`, except task 62, which removes them. A critical fix there is a separate change.
- **The two servers never share runtime data.** The Rust server has its own data folder and its own
  default port, until task 62.
- **Nothing may close off iOS and macOS.** No screen calls a GTK or web API directly: platform
  differences live behind a component of `app/ui/` or a native component of `crates/app/`.
- **Screens are TSX. Heavy logic is Rust.** A screen holds no parsing, diffing, or key state
  machine.
- **No screen draws a raw primitive with its own colours.** Colours, radii, blur, and glow come from
  tokens, through `app/ui/`.
- **A long reply is drawn as blocks**, each its own row or text, never as one growing Markdown text.
- **Compatibility may break.** The human is the only user, at a very early stage. Prefer the simpler
  design: no second API version, no upgrade path, and no migration code beyond the one-time session
  import.
- **NSH stays pinned.** An upgrade is its own commit, with the gallery's screenshots compared.
- **A fix to NSH goes upstream** as a pull request, and the pin moves once it is released. Until
  then the workaround names the pull request in a comment.
- **Authorship**: no commit, file, or pull request names an agent or a model, as
  [`AGENTS.md`](/AGENTS.md) says.

### Validation

Unless a task says otherwise, its validation is `vp check`, then `cargo nextest run -p <its crate>`
for Rust, or `vp run app:check` and `vp run app:test` for the app. It leaves `vp run ready` to the
push.

### What every records task does

Tasks 8 to 11 each port the records and mutations of one domain from
[`packages/server/src/fate/`](/packages/server/src/fate/), keeping their names, and call the core
function the binding wraps today. Each adds its lines to `records/mod.rs`.

- Consumes: `Registry`, `Bus` (task 7); the core's functions.
- Produces: its records and actions, typed in `crates/protocol/`, and their rows in task 21's list.

- [ ] **Step 1: Write the failing contract tests**: one test per record,
      `<Record> answers its     shape`, on the fixtures in [`fixtures/`](/fixtures/); and one per
      action that writes git or a stored file, asserting what a later read shows. Reuse the cases of
      the Node server's tests for that domain, which name what is costly to lose.
- [ ] **Step 2: Run them**. Expected: FAIL, `unknown record`.
- [ ] **Step 3: Implement the domain's module**, and wire the core's `watch` to `Bus::changed` for
      its records, as [`live.ts`](/packages/server/src/live.ts) maps them today.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): records of <domain>`.

### What every screen task does

Tasks 38 to 52 each port one area of the React UI. They share one shape, so each task below lists
only what differs: its files, the old code to read, its records and actions, and its own rules.

**Shared interfaces:**

- Consumes: `app/ui/` (tasks 27 to 34), `record`, `call`, `text` (task 24), `route` and `navigate`
  (task 25), `registerKey` (task 33), and the records and actions of its area (tasks 8 to 19).
- Produces: its screens, registered for their routes in `app/screens/routes.tsx`, each adding its
  own lines there.

**Shared steps:**

- [ ] **Step 1: Read the old screens and their guide.** The old code says what exists; the guides in
      [`specs/ui/`](/specs/ui/) and the design language say how it should look and behave. Where
      they disagree with the old code, the guides win. List what the old screen does, in the task's
      commit body, so the review can check nothing was lost.
- [ ] **Step 2: Write the tests the area names**, and no others: the testing decision keeps UI tests
      for behaviour that is costly to lose and that using the app would not show.
- [ ] **Step 3: Build the screens** from `app/ui/` only. A missing component is added to `app/ui/`
      and the gallery, never drawn in the screen. Declare the area's keys in the registry.
- [ ] **Step 4: Review each screen in the running app**, on `ura sandbox`, in both themes, at a
      narrow and a wide width, with `vp run app:shots <route>`. Fix what you see. One picture of
      each new screen goes in the pull request, none in the repository.
- [ ] **Step 5: Run the task's validation**: `vp check`, `vp run app:check`, `vp run app:test`.
      Expected: PASS.
- [ ] **Step 6: Commit**: `feat(nsh-migration): <area>`.

## Code read

- **The server's surface**: [`packages/server/src/app.ts`](/packages/server/src/app.ts)
  (`createApp`) lists every route. Live data is fate's event stream at `/fate/live`; the server has
  no WebSocket of its own.
- **The data model**: [`packages/server/src/fate/`](/packages/server/src/fate/) holds 44 record
  types and about 108 mutations. [`packages/web/src/views.ts`](/packages/web/src/views.ts) shows
  which the UI reads.
- **The binding**: [`packages/binding/index.d.ts`](/packages/binding/index.d.ts) lists 155 functions
  over the core. Each is a thin wrapper: the Rust server calls the core function behind it.
- **Sign-in**: [`packages/server/src/sign-in/`](/packages/server/src/sign-in/) and
  [`guard.ts`](/packages/server/src/guard.ts). A cookie holds `<id>.<secret>`; `sign-in.json` holds
  hashes.
- **Runs**: [`packages/server/src/runner/`](/packages/server/src/runner/). Claude runs as
  `claude -p` with stream-json in and out; Codex as `codex app-server` over JSON-RPC. Transcripts
  are in `runner.sqlite`, through `node:sqlite`.
- **Extensions**: [`packages/server/src/extensions/`](/packages/server/src/extensions/),
  [`extension-api.ts`](/packages/server/src/extension-api.ts), and
  [`docs/extensions.md`](/docs/extensions.md). Server parts run in Node's `vm`; pages are compiled
  for React and StyleX.
- **The UI's routes**: [`packages/web/src/routeTable.ts`](/packages/web/src/routeTable.ts) and
  `App.tsx`. Routing is the app's own, with no library.
- **The UI's guides**: [`specs/ui/`](/specs/ui/), which the new screens follow where the design
  language does not replace them.
- **Tests and checks**: `vp run ready` runs every check ([`vite.tasks.ts`](/vite.tasks.ts)); Rust
  tests run with `cargo nextest run`. The core has about 1,180 tests, the server about 960, the web
  UI about 1,000.
- **The spikes**: `spikes/nsh/` on `spike/nsh` holds the Vim layer (`src/vim.rs`), the extension
  view (`src/ext.rs`), both transcripts (`src/session.rs`, `tsx/Transcript.tsx`), and the glass
  shader. `spikes/uraeda-exact/tools/` on `spike/exact` holds the session feed used for
  measurements.

### Layout and ownership

New code, and what each part owns:

| Path               | Owns                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `crates/protocol/` | The protocol's messages, record and action names, and the TypeScript types made from them. |
| `crates/server/`   | Everything `ura serve` does. One module per domain, listed below.                          |
| `crates/vim/`      | The Vim layer: a pure state machine from keys to editor commands. No UI.                   |
| `crates/app/`      | The NSH native module `uraeda/native`, the app's native components, and the Linux host.    |
| `app/ui/`          | The component library, `uraeda/ui`. No data, no routes.                                    |
| `app/store/`       | The client's connection, records as signals, actions, and per-device storage.              |
| `app/gallery/`     | The gallery app: every component in its states, both themes, three widths.                 |
| `app/screens/`     | The screens, one folder per place. They use `app/ui/` and `app/store/` only.               |
| `app/extensions/`  | The page API, and the built-in extensions' pages.                                          |
| `crates/cli/`      | `ura`, which gains `serve`, `pair`, and `import-sessions`.                                 |

`crates/server/` modules: `http` (routes, guard, static files), `sign_in`, `live` (subscriptions and
changes), `records/` (one file per domain), `files`, `runner/` (store, turns, continuer),
`runtimes/` (claude, codex, fake), `mcp`, `preview`, `extensions/` (loader, VM, pages), `sandbox`.

Who owns what state:

- **The server owns every durable fact.** A client holds a cache, and never the truth.
- **The core owns workflow files, git, settings, and themes**, as today. The server calls it
  directly: the functions the Node binding wraps become plain Rust calls.
- **`runner/store` owns sessions and transcripts**, in SQLite. Nothing else opens that file.
- **`sign_in` owns keys, sessions, and device tokens.** Every route and the WebSocket ask it.
- **`extensions/vm` owns every VM it starts**, and stops it on unload, on error, and when the server
  stops.
- **A client owns only per-device choices**: its theme and fonts, layout widths, and unsaved text.

### The protocol, in short

Task 4 writes the contract in `contracts/protocol.md`. Its shape, which every task assumes:

- One WebSocket, at `/live`. The first message is `hello`, with the protocol version and the
  sign-in. The server answers `welcome`, or `refused` with a reason.
- `sub` asks for a record by name and arguments. The server answers `data` with the whole value
  once, then `change` messages. A change is a list of small operations on that value.
- A growing text, such as a reply, changes by `append`. A list changes by `insert`, `remove`, and
  `move`. A client applies each change to one signal.
- Every `change` has a sequence number per subscription. A client that reconnects sends the last
  number it applied, and gets the changes after it, or the whole value again.
- `call` runs an action with an input, and gets `result` or `error`.
- HTTP stays for bytes: images, uploads, raw files, preview proxying, extension packages, the
  agents' MCP endpoint, and the web build's files.

Records and actions keep the names of today's fate views and mutations where one maps to one. Task
21 holds the list, and a test fails when a name is neither mapped nor explicitly dropped.

### What was measured

The choices below rest on two spikes, kept on the branches `spike/nsh` (`spikes/nsh/`) and
`spike/exact` (`spikes/uraeda-exact/`). A task that doubts a choice reruns the spike before changing
it. All numbers are from one machine, on 2026-11-10, with a 60 Hz display.

| Question                   | Result                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| TSX or Rust for screens    | Same frame cost. TSX streaming 0.6 ms median, fast scroll 2.0 ms; Rust fast scroll 2.1 ms.                       |
| Glass on Linux             | GTK draws no backdrop blur. A shader reading what is behind it works: 2.0 ms a frame in all.                     |
| GTK or GPUI on Linux       | GPUI cannot be packaged, and draws no blur or shader effect. GTK is the target.                                  |
| Long replies               | NSH parses a whole message again on each chunk: a 40-times-longer reply ran at 21 fps on a slowed phone browser. |
| Broken extensions          | A throw at load, a throw in a render, and an endless loop each left the app running.                             |
| Extension reload           | 13 to 15 ms on the desktop, from a save to the new page.                                                         |
| Web on a phone, slowed CPU | 57 fps streaming, 37 fps scrolling history.                                                                      |

What the spikes taught, which tasks rely on:

- **NSH's JavaScript is interpreted.** It has no JIT. NSH's own figures put heavy logic about five
  times slower in TSX than in Rust. So parsing, diffing, and Vim are Rust.
- **Only TSX has WebSockets.** A Rust component's `fetch` returns whole responses. So the connection
  lives in TSX.
- **A list crosses nothing.** NSH's list took 20,000 rows directly. So transcripts need no paging
  window in the client.
- **Events, not snapshots.** A streamed transcript sent as growing snapshots lost messages in one
  spike. So the protocol sends changes, each acknowledged.
- **NSH's editor has no Vim.** The spike's layer worked over its commands. So Vim is ours.

### NSH documentation

NSH moves fast: read the page again before building on it. Paths are under
`https://github.com/longbridge/nsh/blob/main/`. The pin is NSH 0.4.x; task 2 records the exact
version and commit.

| Subject                           | Page                                                                                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extensions: modules after release | [`website/docs/index.md`](https://github.com/longbridge/nsh/blob/main/website/docs/index.md), "Dynamic UI and AI-generated UI"                                                                                               |
| Extensions: embedding a view      | [`docs/dev/embedding.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/embedding.md)                                                                                                                                 |
| Extensions: signed packages       | [`website/docs/signed-packages.md`](https://github.com/longbridge/nsh/blob/main/website/docs/signed-packages.md), [`docs/dev/signed-packages.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/signed-packages.md)   |
| Extensions: limits and rights     | [`website/docs/sandbox-and-capabilities.md`](https://github.com/longbridge/nsh/blob/main/website/docs/sandbox-and-capabilities.md), [`docs/dev/sandbox.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/sandbox.md) |
| Extensions: the host's own views  | [`website/docs/native-components.md`](https://github.com/longbridge/nsh/blob/main/website/docs/native-components.md)                                                                                                         |
| Extensions: the web player        | [`website/docs/web.md`](https://github.com/longbridge/nsh/blob/main/website/docs/web.md), [`docs/dev/web.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/web.md)                                                   |
| Rust modules called from TSX      | [`website/docs/rust.md`](https://github.com/longbridge/nsh/blob/main/website/docs/rust.md), [`docs/dev/rust-modules.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/rust-modules.md)                               |
| Styles, glass, shadows            | [`website/docs/styling.md`](https://github.com/longbridge/nsh/blob/main/website/docs/styling.md), [`docs/dev/styles.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/styles.md)                                     |
| Shaders                           | [`website/elements/shader.md`](https://github.com/longbridge/nsh/blob/main/website/elements/shader.md), [`docs/dev/shaders.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/shaders.md)                             |
| Lists and scrolling               | [`docs/dev/scrolling-and-lists.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/scrolling-and-lists.md)                                                                                                             |
| The editor                        | [`website/elements/editor.md`](https://github.com/longbridge/nsh/blob/main/website/elements/editor.md), [`docs/dev/editor.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/editor.md)                               |
| Markdown text                     | [`docs/dev/text-view.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/text-view.md)                                                                                                                                 |
| Web views                         | [`website/docs/web-view-and-video.md`](https://github.com/longbridge/nsh/blob/main/website/docs/web-view-and-video.md)                                                                                                       |
| Linux, and its limits             | [`docs/dev/linux.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/linux.md)                                                                                                                                         |
| Tests and the driver              | [`website/docs/testing-and-trace.md`](https://github.com/longbridge/nsh/blob/main/website/docs/testing-and-trace.md)                                                                                                         |
| Packaging                         | [`website/docs/packaging.md`](https://github.com/longbridge/nsh/blob/main/website/docs/packaging.md)                                                                                                                         |
| Performance                       | [`docs/dev/performance.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/performance.md)                                                                                                                             |
| What stays compatible             | [`website/docs/compatibility.md`](https://github.com/longbridge/nsh/blob/main/website/docs/compatibility.md)                                                                                                                 |

## Constitution check

| I. Humans stay in control | II. Git and plain text first | III. Asynchronous by default | IV. Review effort matches impact | V. Tools are optional |
| ------------------------- | ---------------------------- | ---------------------------- | -------------------------------- | --------------------- |
| ✅                        | ✅                           | ✅                           | ⚠️                               | ✅                    |

- IV: this plan is long to review. It is split by phase so each file can be reviewed alone, and its
  three gates put the human's time where a wrong choice costs most.

## Complexity tracking

| New abstraction                   | Why it is needed                                                  | Simpler alternative rejected                                             |
| --------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `crates/protocol/`                | The server and the client must agree on names and shapes.         | Hand-written types on each side: they drift.                             |
| Changes with sequence numbers     | A streamed reply must not resend its transcript, nor lose a part. | Whole values on each update: measured as too slow, and lossy under load. |
| `crates/vim/`                     | NSH's editor has no Vim, and the UI's language has no JIT.        | Vim in TSX: slower per key, and harder to test.                          |
| A VM for extensions' server parts | The owner's `server.ts` must keep working without Node.           | Extensions without server parts: the human refused it.                   |
| `Glass`, one component, two ways  | GTK draws no backdrop blur; Apple and the web do.                 | Blur only where it is native: no glass on Linux.                         |
| A session importer                | History must survive, and the two servers must not share a store. | Sharing `runner.sqlite`: two writers on one file.                        |
| The component library `app/ui/`   | The human asked for one, first, for a coherent look.              | NSH's `nsh/base` used directly in screens: no one place for the look.    |

No constitution exception.

## Test map

Tests run in three ways. Server tests start `ura serve` on a temporary data folder, with the fake
runtime and a fixed clock, and speak the real protocol. Client store and Vim tests are pure. UI
tests use NSH's headless driver (`nsh test`) on the app against that server, and are rare, as the
testing decision asks.

| Spec item                                          | Task   | Test                                                    |
| -------------------------------------------------- | ------ | ------------------------------------------------------- |
| US1.1: the app starts the server                   | 37     | `the app starts a server when none runs`                |
| US1.2: a reply streams and the transcript follows  | 44     | `a streaming reply stays in view`                       |
| US1.3: `d2w` deletes two words                     | 23     | `d2w deletes two words`, a row of the Vim table         |
| US2.1: an address opens its page, and Back returns | 58     | `a feature's address opens it, and Back returns`        |
| US2.2: the phone keyboard stays open               | 58     | `a touch in a field keeps the focus`                    |
| US3.1: a saved page reloads                        | 35     | `a saved page shows without a restart`                  |
| US3.2: a broken extension is contained and named   | 35     | `a page that never stops is cut off and named`          |
| US4: one library, approved twice                   | 26, 36 | none: the human's two gates                             |
| US5: a device pairs and is revoked                 | 6      | `a paired device signs in until it is revoked`          |
| Edge: the connection drops mid-reply               | 24     | `a reconnect resumes a reply without a gap`             |
| Edge: versions differ                              | 5      | `an older client is refused with the side to update`    |
| Edge: a token revoked while connected              | 6      | a row of `a paired device signs in until it is revoked` |
| Edge: the server stops                             | 37     | a row of `the app starts a server when none runs`       |
| Edge: a diagram fails                              | 32     | `a diagram that fails shows its source`                 |
| Success: every route has a screen                  | 56     | `every old route is mapped or dropped`                  |
| Success: 8.3 ms a frame at the 99th percentile     | 54     | the frame benchmark, on demand                          |
| Success: 100 ms navigation                         | 54     | the navigation benchmark, on demand                     |
| Success: builds without Node                       | 62     | the release workflow                                    |
| Review focus: a change after an unsubscribe        | 24     | a row of `a reconnect resumes a reply without a gap`    |
| Review focus: two clients, one record              | 7      | `two clients acting at once end equal`                  |
| Review focus: the server stops during a VM call    | 18     | `stopping the server leaves no VM work behind`          |
| Review focus: a wrong clock on a device            | 6      | a row of `a paired device signs in until it is revoked` |

## Waves

Tasks 1, 26, and 36 each end at a human gate: the build stops there, with the file to review named
in the task. Phase 1 starts once task 36's gate is approved, and phase 2 once task 56 is done. The
risky tasks, each reviewed on its own, are 6, 12, 18, 20, and 62.

1. Task 1, alone: a human gate.
2. Task 2, alone: every later task builds in what it creates.
3. Task 3, alone: it can stop the build.
4. Tasks 4, 22, 23: the protocol, the native module, and the Vim layer share no file.
5. Task 5, alone.
6. Tasks 6, 7: sign-in and the live engine, in separate modules.
7. Tasks 8, 9, 10, 11, 12, 17, 19: one module each, each adding its lines to the record registry.
8. Task 13, alone: the runtimes and the extension VM implement its contract.
9. Tasks 14, 15, 18: two runtimes and the extension VM.
10. Tasks 16, 20.
11. Task 21, alone: the store's tests and every screen's review run on its sandbox.
12. Tasks 24, 25, 26: the client store, its routes, and the design language, a human gate.
13. Task 27, alone: every component reads its tokens.
14. Tasks 28, 33: surfaces and keys.
15. Task 29, alone: lists, the text field, and the shell use its controls.
16. Tasks 30, 31, 34: each adds its own folder to `app/ui/`.
17. Tasks 32, 35.
18. Task 36, alone: a human gate.
19. Task 37, alone: every screen lives in its shell.
20. Tasks 38, 40, 41, 46, 47, 49: areas with no screen in common, each adding its lines to the
    routes.
21. Tasks 39, 42, 44, 48, 50.
22. Tasks 43, 45, 51.
23. Task 52.
24. Tasks 53, 54.
25. Task 55.
26. Task 56, alone.
27. Task 57, alone.
28. Tasks 58, 59: browser behaviour, and extension pages, in separate files.
29. Tasks 60, 61.
30. Task 62, alone.

---

The settled small choices are in [rulings.md](rulings.md).

**Phase 0: core.** The Rust server, the client core, and the component library with its gallery.
Nothing here is a screen of the app.

## Task 1: The decisions' new text

**Files:**

- Modify: `specs/decisions/stack.md`, `distribution.md`, `toolchain.md`, `extensions.md`,
  `sign-in.md`, `text-editing.md`, `ui-components.md`, `ui-look.md`, `colour-themes.md`,
  `preview.md`, `performance.md`
- Modify: `specs/decisions/protocol.md`, drafted with the spec, `status: proposed`

**Interfaces:**

- Produces: the decisions every later task follows. Until the human approves them, no later task
  starts.

- [ ] **Step 1: Write each decision's new text**, following
      [writing a decision](/skills/uraeda/references/writing.md#a-decision), from the
      [spec's list](spec.md#decisions). Keep every rule the migration does not touch, word for word.
      Each changed decision keeps `status: active`; the new one stays `status: proposed`. What each
      must say:
  - **Stack**: the server is Rust, inside `ura`; the UI is TSX on NSH over Rust modules; the UI
    reaches the server only through the protocol; fate and the binding are gone. The document-tree
    rule stays.
  - **Distribution**: `ura` holds the CLI and the server; the Linux app ships as a tarball and an
    AppImage; the web build is served by `ura serve`; one tag, one version, as today.
  - **Toolchain**: the React Compiler rule and the memoization rule go; NSH's check, its tests, and
    the gallery's build join `ready`.
  - **Extensions**: Uraeda builds and signs pages; a page runs in a view of its own with limits; a
    server part runs as TypeScript in the server's VM; built-in agent runtimes are Rust on the same
    contract, each one able to be turned off; the API stays version 1, rewritten in place. "No build
    step" stays as the owner sees it: Uraeda builds on save.
  - **Sign-in**: a device pairs with a one-time code, gets a token of its own, and the owner can
    list and revoke devices. Loopback only stays.
  - **Text editing**: Vim's keys come from Uraeda's Vim layer; the subset is the list of task 23.
  - **UI components**, **UI look**, **Colour themes**: the library is Uraeda's own; glass, blur, and
    glow join the look; themes gain their roles. Leave the exact visual rules to task 26's gate, and
    say so.
  - **Preview**: native clients draw previews in a web view; the gallery replaces the app's own
    Storybook; a user project's Storybook is still shown.
  - **Performance**: add the frame budget, 8.3 ms at the 99th percentile for scrolling and
    streaming.
  - **Protocol**: one versioned protocol; a record arrives whole, then as changes; a client and a
    server of different versions refuse each other with a reason.

- [ ] **Step 2: Run `ura check specs/decisions`**. Expected: no error, no warning.

- [ ] **Step 3: Commit, and stop for the human**

```bash
git add specs/decisions
git commit -m "decision(nsh-migration): propose the migration's decisions"
```

The human approves by setting `protocol.md` to `active`, or asks for changes in the files.

## Task 2: Scaffolding and toolchain

**Files:**

- Create: `crates/protocol/`, `crates/server/`, `crates/vim/`, `crates/app/` (empty crates, in the
  workspace), `app/nsh.json`, `app/App.tsx`, `app/tsconfig.json`, `app/theme.json`
- Modify: `Cargo.toml`, `rust-toolchain.toml`, `flake.nix`, `vite.tasks.ts`, `CONTRIBUTING.md`

**Interfaces:**

- Produces: `vp run app:check` (NSH's type check), `vp run app:test` (`nsh test`), `vp run app:dev`
  (the app on GTK), all part of `ready`. The pinned NSH version and commit, in `app/nsh.json` and
  `Cargo.lock`.

- [ ] **Step 1: Raise the Rust toolchain** to the first stable release that builds NSH 0.4 (1.96
      does not: the spike used 1.99.1). Run `cargo nextest run` on the whole workspace. Expected:
      PASS, as before the change.
- [ ] **Step 2: Add the four crates and the `app/` project.** `App.tsx` mounts a text. Add NSH's CLI
      and GTK 4.14 to the Nix dev shell, pinned. Pin `rolldown` and its sibling crates to one
      version in every lockfile NSH generates: version drift between them broke two builds in the
      spike.
- [ ] **Step 3: Add the three tasks to `vite.tasks.ts`**, with their inputs, and to `ready`. The
      toolchain configuration's test must name them.
- [ ] **Step 4: Run `vp run ready`**. Expected: PASS, with the new tasks listed.
- [ ] **Step 5: Commit**: `chore(nsh-migration): scaffold the server, the app, and their checks`.

## Task 3: Check what the spikes did not verify

Each check is a test through the real library. If one fails, stop: write a new round of questions,
as [the plan step](/skills/uraeda/references/plan.md#stopping-to-go-back-to-the-human) says.

**Files:**

- Create: `crates/app/tests/outside.rs`, `app/__checks__/`

**Interfaces:**

- Produces: `crates/app/tests/outside.rs`, kept as the guard of each assumption. Its findings, in
  [rulings.md](rulings.md).

- [ ] **Step 1: Write the five checks**
  1. **A signed package loads in an embedded view on GTK.** Build a page, sign it with a key made
     for the test, and load it in an `AppView` that trusts that key. An unsigned or re-signed
     package is refused. See the signed-packages pages.
  2. **A broken page is reported to the host.** The spike's log showed the error; the host got no
     callback on GTK. Find a way to learn of it (a callback, the engine's error channel), or record
     that an upstream change is needed and open it.
  3. **A web view shows a local page on GTK**, with the `webview` feature, and gets keys.
  4. **A diagram draws without a browser.** Run the diagram library in NSH's VM, or in Rust, to
     produce a picture NSH can draw. If neither works, record it: diagrams then show their source on
     Linux, as the spec's assumptions allow.
  5. **A system notification can be sent on Linux** from the app.
- [ ] **Step 2: Run them**: `cargo nextest run -p uraeda-app --test outside`. Expected: PASS, or a
      named failure that stops the build.
- [ ] **Step 3: Write each result as a ruling**, with what later tasks must do.
- [ ] **Step 4: Commit**: `test(nsh-migration): check NSH's unverified behaviours`.

## Task 4: The protocol

**Files:**

- Create: `crates/protocol/src/{lib,message,change,registry}.rs`,
  `specs/2026-11-10-nsh-migration/contracts/protocol.md`, `app/store/protocol.d.ts` (generated)
- Test: `crates/protocol/tests/roundtrip.rs`

**Interfaces:**

- Produces:
  - `PROTOCOL: u32`, the version.
  - `enum ClientMessage { Hello, Sub, Unsub, Call, Resume }` and
    `enum ServerMessage { Welcome, Refused, Data, Change, Result, Error }`, as JSON.
  - `enum Op { Set, Append, Insert, Remove, Move }`, each with a path into the value.
  - `fn apply(value: &mut serde_json::Value, ops: &[Op]) -> Result<(), ApplyError>`.
  - `fn diff(old: &Value, new: &Value) -> Vec<Op>`, which emits `Append` when a string only grew,
    and list operations keyed by each item's `id`.
  - `trait Record` and `trait Action`, with a name, typed arguments, and a typed value; and
    `vp run protocol:types`, which writes `app/store/protocol.d.ts` from them.

- [ ] **Step 1: Write the failing tests**
  - `a change applied to the old value gives the new value`: for a table of pairs,
    `apply(old, diff(old, new))` equals `new`. Rows: a string that grew, a list with an insert, a
    removal, a move, a nested record.
  - `a string that only grew is one append`: the break it catches is a whole-value resend on each
    chunk of a reply.
  - `every message survives JSON`.
- [ ] **Step 2: Run them**. Expected: FAIL, `apply` not found.
- [ ] **Step 3: Implement the crate and write the contract.** `contracts/protocol.md` holds each
      message with an example, the handshake, sequence numbers, `Resume`, and the error codes. A
      list's items must carry an `id`: `diff` falls back to `Set` when one does not.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the protocol's messages and changes`.

## Task 5: `ura serve`, the server's skeleton

**Files:**

- Create: `crates/server/src/{lib,http,guard,status}.rs`, `crates/cli/src/serve.rs`
- Test: `crates/server/tests/skeleton.rs`, `crates/server/tests/support/mod.rs`

**Interfaces:**

- Consumes: `ClientMessage`, `ServerMessage`, `PROTOCOL` (task 4).
- Produces:
  - `ura serve [--port N] [--data-dir DIR]`. Its default port differs from the Node server's.
  - `pub struct Server`, `Server::start(Options) -> Server`, `Server::stop(self)`.
  - The test helper `support::server() -> TestServer`, with `connect() -> TestClient` speaking the
    real protocol on a temporary data folder. Every later server test uses it.
  - The status file and the second-start handoff, as [`open.ts`](/packages/server/src/open.ts) does
    today.

- [ ] **Step 1: Write the failing tests**
  - `an older client is refused with the side to update`: a `Hello` with `PROTOCOL - 1` gets
    `Refused { reason: "client-too-old" }`.
  - `a request with another site's Origin is refused`: the break is DNS rebinding, guarded today by
    `guard.ts`.
  - `a second start hands over to the first`.
- [ ] **Step 2: Run them**. Expected: FAIL, `Server` not found.
- [ ] **Step 3: Implement.** `axum` on `tokio`, loopback only. `/live` upgrades to a WebSocket and
      handles `Hello` only; other messages get `Error { code: "not-signed-in" }` until task 6. Port
      `guard.ts`'s rules as they are.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): ura serve, with its handshake and guard`.

## Task 6: Sign-in and device pairing

**Risky:** it decides who reaches a server that runs code as the owner.

**Files:**

- Create: `crates/server/src/sign_in/{mod,store,cookie,pairing,devices}.rs`,
  `crates/cli/src/pair.rs`
- Test: `crates/server/tests/sign_in.rs`

**Interfaces:**

- Consumes: `Server`, `TestServer` (task 5).
- Produces:
  - HTTP: `GET|POST|DELETE /session`, `DELETE /sessions`, `GET /session/:token`, as today.
  - `POST /pair { code } -> { token }`, and `ura pair`, which prints a one-time code and a QR code.
  - `Hello { sign_in: Cookie | Token(String) }` checked by `sign_in::check`.
  - Records `Devices`; actions `devices.revoke`, `devices.rename`.
  - `fn require(request) -> Result<Identity, Refusal>`: the one check every route and the WebSocket
    call.

- [ ] **Step 1: Write the failing tests**
  - `a paired device signs in until it is revoked`, with rows: a code works once; a second use is
    refused; the token signs in over the WebSocket; a revoked token's open connection closes; a
    device whose clock is a year off still pairs and signs in.
  - `every route but the open ones refuses a request without a session`: walks the router's routes,
    so a new route is closed by default.
  - `a wrong key is slowed, never locked out`.
  - Breaks to make, since the task is risky: skip the check on `/live`; compare tokens without
    constant time; store a token unhashed. Each must fail a test.
- [ ] **Step 2: Run them**. Expected: FAIL, `/pair` answers 404.
- [ ] **Step 3: Implement.** Keep `sign-in.json`'s present fields and add `devices`. A pairing code
      lives 10 minutes, in memory. Tokens are 32 random bytes, stored as hashes.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): sign-in, and pairing a device`.

## Task 7: The live engine

**Files:**

- Create: `crates/server/src/live/{mod,subscription,bus}.rs`, `crates/server/src/records/mod.rs`
- Test: `crates/server/tests/live.rs`

**Interfaces:**

- Consumes: `Record`, `Action`, `diff`, `Op` (task 4); `require` (task 6).
- Produces:
  - `Registry::record::<R>()`, `Registry::action::<A>()`: how a domain registers itself.
  - `Bus::changed(record_name, key)`: a domain says a record changed; the engine reads it again,
    diffs it against what each subscriber has, and sends `Change`.
  - `Bus::append(record_name, key, path, text)`: a growing text changes without a read.
  - Sequence numbers per subscription, and `Resume`.
  - Updates of one record are sent at most once per 16 ms; the latest wins.

- [ ] **Step 1: Write the failing tests**, with a test record `Counter`
  - `a subscriber gets the value, then only changes`.
  - `two clients acting at once end equal`: both call an action on one record; both end with the
    same value and both get a `Result`.
  - `a resume after a drop gets what it missed`: the break is a gap in a reply.
  - `a burst of updates is sent as one change`.
- [ ] **Step 2: Run them**. Expected: FAIL, `Registry` not found.
- [ ] **Step 3: Implement.** One task per connection; a slow client never blocks another. A
      subscriber more than 1,000 changes behind gets the whole value again.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): subscriptions and changes`.

## Task 8: Records: workspace

Follows [what every records task does](#what-every-records-task-does).

- **Files:** `crates/server/src/records/workspace.rs`, and its test in `crates/server/tests/`
- **Records:** Repositories, FolderSuggestions, SlugProposal, Workspace, NeedsYouList, Themes,
  Settings
- **Actions:** `repositories.*`, `settings.*`

## Task 9: Records: features

Follows [what every records task does](#what-every-records-task-does).

- **Files:** `crates/server/src/records/features.rs`, and its test in `crates/server/tests/`
- **Records:** Feature, WorkflowFile, ProposalFile, Priorities, ProposalHints, Inbox, Dropped,
  StartPlan, Ledger, History, BranchDecision, BranchChanges, AllBranchChanges, WorkflowMessage,
  RecommendedMessage, ContinuedAll
- **Actions:** `inbox.*`, `proposals.*`, `priorities.*`, `feature.*`, `change.*`, `item.settings`

## Task 10: Records: writing

Follows [what every records task does](#what-every-records-task-does).

- **Files:** `crates/server/src/records/writing.rs`, and its test in `crates/server/tests/`
- **Records:** Buffer, Undo, WriteQueue
- **Actions:** `review.*`, `settled.*`, `defaultRound.*`, `answer.save`, `answers.submit`,
  `notes.save`, `text.*`, `buffer.save`, `commit.retry`, `undo.*`, `writes.dismiss`
- **Its own rule:** this task owns the write queue: one writer per repository, in order, as the Node
  server has it. Its test `two writes on one repository land in order` guards that.

## Task 11: Records: git

Follows [what every records task does](#what-every-records-task-does).

- **Files:** `crates/server/src/records/git.rs`, and its test in `crates/server/tests/`
- **Records:** GitPage, GitSummary, GitDiff, GitCommit, GitHistoryPage, ConflictFile
- **Actions:** `git.*`

## Task 12: The session store, and its import

**Risky:** it changes the format of stored session data, and reads the old one.

**Files:**

- Create: `crates/server/src/runner/{store,schema,import}.rs`, `crates/cli/src/import_sessions.rs`
- Test: `crates/server/tests/runner_store.rs`, `fixtures/runner/old.sqlite`

**Interfaces:**

- Produces:
  - `Store::open(data_dir) -> Store`, the only code that opens `sessions.sqlite`.
  - `Store::append(turn_id, Event)`, `Store::session(id)`, `Store::turns(session_id)`,
    `Store::log(turn_id, from: u64)`.
  - `enum Event`, the agent-neutral transcript events of
    [`events.ts`](/packages/server/src/runner/events.ts), unchanged in meaning.
  - `ura import-sessions [--from DIR]`, a one-time tool, removed after the port (an inbox note asks
    for it), which copies sessions and transcripts from the Node server's `runner.sqlite`.

- [ ] **Step 1: Write the failing tests**
  - `a transcript reads back as it was written`, across a close and an open.
  - `an old store imports with every session and event`, on a fixture written by the Node server.
  - `a store of a newer schema is refused, untouched`.
  - Break to make: lose the order of events in a turn.
- [ ] **Step 2: Run them**. Expected: FAIL, `Store` not found.
- [ ] **Step 3: Implement**, with `rusqlite` and a numbered schema. A transcript is an append-only
      log per turn, so `Bus::append` and `Store::log(from)` serve a resume without a full read. See
      the ruling on the store's format.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the session store and its import`.

## Task 13: The runtime contract, and the fake runtime

**Files:**

- Create: `crates/server/src/runtimes/{mod,fake}.rs`
- Test: `crates/server/tests/runtimes.rs`

**Interfaces:**

- Consumes: `Event` (task 12).
- Produces: `trait Runtime` with `name`, `capabilities`, `open(Options) -> Box<dyn AgentProcess>`,
  `has_session`, `allow_rule`, `version`, `models`; and `trait AgentProcess` with `events`, `send`,
  `interrupt`, `kill`, `take_back`, `set_effort`, `close`. These mirror the adapter of
  [`extension-api.ts`](/packages/server/src/extension-api.ts), so a VM extension can implement the
  same contract in task 18. The fake runtime plays a script of events, for tests and the sandbox.

- [ ] **Step 1: Write the failing test** `the fake runtime plays its script, and stops when told`.
- [ ] **Step 2: Run it**. Expected: FAIL.
- [ ] **Step 3: Implement** the traits and the fake.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the runtime contract and a fake runtime`.

## Task 14: The Claude runtime

**Files:**

- Create: `crates/server/src/runtimes/claude.rs` (task 14), `crates/server/src/runtimes/codex.rs`
  and `codex_rpc.rs` (task 15)
- Test: `crates/server/tests/claude.rs`, `crates/server/tests/codex.rs`, with recorded streams in
  `fixtures/runtimes/`

**Interfaces:**

- Consumes: `Runtime`, `AgentProcess` (task 13).
- Produces: `runtimes::claude()`, `runtimes::codex()`, each registered as a built-in the owner can
  turn off.

- [ ] **Step 1: Write the failing tests**:
      `a recorded stream becomes the same events as the Node     runner made`, on streams recorded
      from the real CLIs, compared with the events the Node code produces for them; and
      `a permission request waits for an answer`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement**, porting [`claude.ts`](/packages/server/src/runner/claude.ts) and
      `child.ts`, or `codex.ts` and `codex-rpc.ts`. A child process leads its own process group and
      is killed when its session closes or the server stops.
- [ ] **Step 4: Run the task's validation**, then one manual run against the real CLI, noted in the
      commit's body. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the claude runtime`, or `the codex runtime`.

## Task 15: The Codex runtime

As task 14, for Codex: `crates/server/src/runtimes/codex.rs` and `codex_rpc.rs`, tested in
`crates/server/tests/codex.rs` on recorded streams. It ports
[`codex.ts`](/packages/server/src/runner/codex.ts) and `codex-rpc.ts`, and produces
`runtimes::codex()`. Its steps and tests are task 14's, with Codex's streams.

- [ ] **Step 1: Write the failing tests**, as task 14's.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the task's validation**, then one manual run against the real CLI. Expected:
      PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the codex runtime`.

## Task 16: Sessions

**Files:**

- Create: `crates/server/src/runner/{manager,status,continuer}.rs`,
  `crates/server/src/records/sessions.rs`
- Test: `crates/server/tests/sessions.rs`

**Interfaces:**

- Consumes: `Store` (12), `Runtime` (13), `Bus` (7).
- Produces: records Agent, Session, SessionList, SessionSearch, Turn, TurnLog; actions `session.*`
  and `agent.refreshModels`; turn states and session statuses as
  [`events.ts`](/packages/server/src/runner/events.ts) and `status.ts` name them; automatic
  continues, as the [run lifecycle](../decisions/run-lifecycle.md) decision says.

- [ ] **Step 1: Write the failing tests**, on the fake runtime
  - `a streaming reply reaches a subscriber as appends`: no `Set` of the whole log.
  - `a session survives a server restart, and continues when the decision says so`.
  - `stopping a turn ends it as stopped`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** `TurnLog` changes through `Bus::append`. Port the continuer's rules as
      they are.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): sessions and their turns`.

## Task 17: Files, uploads, and the agents' MCP endpoint

**Files:**

- Create: `crates/server/src/files.rs`, `crates/server/src/mcp.rs`
- Test: `crates/server/tests/files.rs`, `crates/server/tests/mcp.rs`

**Interfaces:**

- Produces: `/r/:name/raw/*`, `/mockups/*`, `/images/*`, `/chat-images/:id`, `POST /r/:name/attach`,
  `POST /r/:name/inbox/note-image`, and `/mcp` with its per-process token, as
  [`files.ts`](/packages/server/src/files.ts), `attach.ts`, and `mcp/` have them.

- [ ] **Step 1: Write the failing tests**: `a raw path cannot leave its repository`;
      `an upload     comes back as the image it was`; `the MCP endpoint refuses a wrong token`.
- [ ] **Step 2: Run them**. Expected: FAIL, 404.
- [ ] **Step 3: Implement**, porting each route and its checks.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): files, uploads, and the MCP endpoint`.

## Task 18: The VM for extensions' server parts

**Risky:** it runs the owner's code inside the server, and must never take the server down.

**Files:**

- Create: `crates/server/src/extensions/{mod,loader,vm,api,watch}.rs`,
  `crates/server/src/records/extensions.rs`
- Test: `crates/server/tests/extensions_vm.rs`, `fixtures/extensions/`

**Interfaces:**

- Consumes: `Registry`, `Bus` (7); `Runtime` (13); `compileModule` in
  [`crates/compile/`](/crates/compile/).
- Produces:
  - The server API, for `server.ts`: `record`, `action`, `route`, `on`, `runtime`, `settings`,
    `repositories`, `log`, as today, and `uraeda:process`, `uraeda:fs`, `fetch` in place of `node:`
    imports.
  - Records Extensions, ExtensionRecord, ExtensionAction; actions `extensions.act`, `setOn`,
    `setSetting`, `reportPageProblem`.
  - `extension.toml` keeps `api = 1`: the API is rewritten in place, with no second version and no
    path from the old one. An extension written for the Node server fails to load, as any broken
    extension does.

- [ ] **Step 1: Write the failing tests**
  - `an extension's record and action answer through the protocol`.
  - `a saved server.ts replaces the running one, without a restart`.
  - `an extension that throws at load leaves the others running`, and one
    `that never returns is cut off`: within 2 s at activation, 10 s in a call, as today.
  - `stopping the server leaves no VM work behind`: no timer, child process, or thread of a VM
    remains.
  - Breaks to make: let a VM's panic unwind into the server; forget a VM's child process on unload.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement**, with `rquickjs`, one VM per extension, each on its own thread with a
      memory limit and an interrupt handler for time. Compile TypeScript with `crates/compile`. An
      extension loads only from the config folder; the loader's test for that rule is ported.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): extensions' server parts, in a VM`.

## Task 19: Previews

**Files:**

- Create: `crates/server/src/preview/{mod,command,proxy}.rs`,
  `crates/server/src/records/previews.rs`
- Test: `crates/server/tests/preview.rs`

**Interfaces:**

- Produces: records Preview, Story, StoryHref; action `preview.restart`; the proxy at
  `/r/:name/preview/<secret>/<folder>/*`, HTTP and WebSocket, as
  [`preview/proxy.ts`](/packages/server/src/preview/proxy.ts) has it.

- [ ] **Step 1: Write the failing tests**: `the server stops every preview command when it stops`
      (the stack decision's rule); `a preview path without its secret is refused`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement**, porting the runner's rules.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): previews and their proxy`.

## Task 20: Extension pages: built, signed, served

**Risky:** a client runs what this task signs.

**Files:**

- Create: `crates/server/src/extensions/{pages,signing}.rs`
- Test: `crates/server/tests/extension_pages.rs`

**Interfaces:**

- Consumes: the loader and watcher (task 18); the result of task 3's first check.
- Produces:
  - `GET /extensions/:name/page`: the page as a signed NSH package, and its version.
  - The record Extensions carries each page's `pageVersion`, which changes on every build.
  - `GET /extensions/key`: the public key a client trusts, sent only over a signed-in connection.
  - A compile error keeps the last good package, and is carried in the record as `problem`.

- [ ] **Step 1: Write the failing tests**
  - `a saved page gets a new version and a valid signature`.
  - `a page that does not compile keeps the last one, and says why`.
  - `the signing key never leaves the data folder`: no route or record returns it.
  - Breaks to make: serve an unsigned package; serve the private key.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement**, with `nsh-bundler` for the build and NSH's package signing. The key is
      made at the first start, in the data folder. Give the bundler the UI sets a page may import:
      `nsh`, `nsh/base`, `uraeda/ui`, `uraeda/page`. Read NSH's signed-packages pages first.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): build, sign, and serve extension pages`.

## Task 21: The parity list, and the server's sandbox

**Files:**

- Create: `crates/server/tests/parity.rs`, `crates/server/parity.toml`,
  `crates/server/src/sandbox.rs`, `crates/cli/src/sandbox.rs`
- Modify: `AGENTS.md` (the sandbox's command)

**Interfaces:**

- Consumes: every record and action of tasks 8 to 20.
- Produces:
  - `parity.toml`: each of the Node server's record types, mutations, and routes, with the name it
    has now, or `dropped` and why.
  - `ura sandbox [--reset]`: the Rust server over the sample projects and the fake runtime, without
    sign-in, as the [sandbox](../decisions/sandbox.md) decision describes. Phase 1 reviews screens
    on it.

- [ ] **Step 1: Write the failing test**
      `every old record, mutation, and route is mapped or     dropped`: it reads the names from
      `packages/server/src/fate/` and `app.ts`, and fails on one missing from `parity.toml` or
      unknown to the registry.
- [ ] **Step 2: Run it**. Expected: FAIL, naming what is missing.
- [ ] **Step 3: Fill the list, port what it shows missing, and write the sandbox.**
- [ ] **Step 4: Run the task's validation**, then `ura sandbox` once. Expected: PASS, and a server
      that answers `Workspace`.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the parity list and the sandbox`.

## Task 22: The native module

**Files:**

- Create: `crates/app/src/{lib,native}.rs`
- Test: `crates/app/tests/native.rs`

**Interfaces:**

- Produces: the NSH native module `uraeda/native`, which TSX imports. It starts with `version()`.
  Later tasks add to it: the Vim layer's bridge (31), highlighting and diagrams (32), the app's
  native components (35, 37). See NSH's Rust-modules pages.

- [ ] **Step 1: Write the failing test** `TSX calls a function of the module`, through `nsh test`.
- [ ] **Step 2: Run it**. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the module and register it in `app/nsh.json`.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the app's native module`.

## Task 23: The Vim layer

**Files:**

- Create: `crates/vim/src/{lib,state,motion,operator,object,register,search}.rs`
- Test: `crates/vim/tests/keys.rs`, `crates/vim/tests/cases.toml`

**Interfaces:**

- Produces:
  - `struct Vim`, `Vim::key(&mut self, key: Key, text: &TextView) -> Vec<Edit>`, pure: it reads a
    text and a selection, and returns edits and selection changes. It never touches an editor.
  - `enum Mode { Normal, Insert, Visual, VisualLine, Replace, OperatorPending }`, and
    `Vim::status(&self) -> Status` for the status line.
  - The subset, which the text-editing decision names:
    - motions `h j k l w b e W B E 0 ^ $ gg G f F t T ; , % { }`, with counts;
    - operators `d c y > <`, doubled for a line, with `D C Y x X s S r J ~ p P`;
    - text objects `iw aw iW aW ip ap i" a" i' a' i( a( i[ a[ i{ a{ it at` and their backtick form;
    - `v` and `V`, with `o`;
    - registers: unnamed, `"a`–`"z`, `"0`, and `"+` for the system clipboard;
    - `/ ? n N * #`, `.`, `u` and `Ctrl-r`, `i a I A o O`.
  - Out for now: Ex commands, macros, marks, block visual.

- [ ] **Step 1: Write the failing tests**: `cases.toml` holds one row per behaviour, as text before,
      keys, and text after, with `|` for the caret. `every case gives its text` runs them all. Write
      at least one row per item of the subset, and the rows `d2w deletes two words`,
      `2dw deletes     two words`, and `a yank reaches the system clipboard`. The break each row
      catches is its own behaviour.
- [ ] **Step 2: Run them**. Expected: FAIL, `Vim` not found.
- [ ] **Step 3: Implement.** Start from the spike's `src/vim.rs`, which already handles counts
      before and after an operator. A count repeats the motion, then the operator runs once, so one
      undo step undoes it.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the Vim layer`.

## Task 24: The client store

**Files:**

- Create: `app/store/{connection,records,actions,index}.ts`
- Test: `app/store/store.test.ts`

**Interfaces:**

- Consumes: `app/store/protocol.d.ts` (task 4); `ura sandbox` (task 21) for its tests.
- Produces:
  - `connect(options): Connection`, with `status: Signal<"connecting"|"live"|"offline"|"refused">`.
  - `record<N>(name: N, args): Signal<Value<N> | undefined>`: subscribes while something reads it,
    and applies changes to one signal, or to one signal per item for lists.
  - `call<N>(name: N, input): Promise<Result<N>>`.
  - `text(record, path): Signal<string>`: a growing text, for transcripts.
  - Reconnection with `Resume`, and a wait that grows from 0.5 s to 10 s.

- [ ] **Step 1: Write the failing tests**
  - `a record's signal follows the server`.
  - `a reconnect resumes a reply without a gap`, with a row where a change arrives after its
    `Unsub`: it is ignored, and no subscription is left.
  - `a refused connection says which side to update`.
- [ ] **Step 2: Run them**: `vp run app:test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Changes that arrive within one frame are applied together, so a burst
      draws once. The list of a record keeps each item's signal across changes: a chunk of one
      message redraws that message only.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the client store`.

## Task 25: Routes and per-device storage

**Files:**

- Create: `app/store/{routes,history,device}.ts`
- Test: `app/store/routes.test.ts`

**Interfaces:**

- Produces:
  - `type Route`, `parseRoute(path): Route`, `pathOf(route): string`, with the paths of
    [`routeTable.ts`](/packages/web/src/routeTable.ts) unchanged, so old links keep working.
  - `navigate(route)`, `back()`, `route: Signal<Route>`, and per-entry scroll and leave guard, as
    `routeHistory.ts` keeps them.
  - `device.get(key)`, `device.set(key, value)`: per-device choices, on NSH's storage.

- [ ] **Step 1: Write the failing test** `every old path parses to its route and back`, on the paths
      of the old route table's tests.
- [ ] **Step 2: Run it**. Expected: FAIL.
- [ ] **Step 3: Implement.** No browser API here: task 58 binds the history to the browser's.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): routes and per-device storage`.

## Task 26: The design language

A human gate: the first of the two design gates.

**Files:**

- Create: `specs/ui/design-language.md`, `app/gallery/samples/` (six rendered samples)

**Interfaces:**

- Produces: the rules tasks 27 to 34 follow. Until the human approves it, they do not start.

- [ ] **Step 1: Write `design-language.md`**, short enough to review in 15 minutes. It decides:
  - the surfaces and their order in depth: page, pane, glass, overlay;
  - where glass goes, how strong its blur and tint are, and where it never goes (behind long prose);
  - neon light: which roles glow, how far, and when it moves;
  - corners, borders, and the titled pane, kept or changed from
    [look and feel](/specs/ui/look-and-feel.md);
  - type: the font of each role, and the scale;
  - motion: what animates, and for how long, from [space and motion](/specs/ui/space-and-motion.md);
  - colour roles added for glass and glow, and the contrast floors kept from the UI look decision.

  Where it changes a guide of [`specs/ui/`](/specs/ui/), it says which line.

- [ ] **Step 2: Render six samples** in a throwaway gallery page: a pane, a glass panel over text, a
      button row, a dialog, a list with a selected row, and a status line, in both themes. Take
      their pictures on GTK, with the screenshot script of the spike's `tools/`.
- [ ] **Step 3: Commit, and stop for the human**, with the samples' pictures in the pull request,
      never in the repository: `docs(nsh-migration): propose the design language`.

## Task 27: Tokens, themes, and fonts

**Files:**

- Create: `app/ui/tokens/`, `app/ui/theme.ts`, `crates/app/src/theme.rs`
- Modify: the core's theme reader, for the new roles
- Test: `crates/app/tests/theme.rs`

**Interfaces:**

- Consumes: the approved design language (task 26); the record Themes (task 8).
- Produces: `applyTheme(theme)`, which maps a theme's roles onto NSH's tokens; the roles for glass
  and glow; bundled fonts, with no file loaded from another host; `tokens`, the only source of
  colours, radii, blur, and glow for `app/ui/`.

- [ ] **Step 1: Write the failing tests**: `every shipped theme meets the contrast floors` (4.5:1
      for text, 3:1 for borders, as today); `a theme without the new roles inherits them`;
      `a     broken theme never blocks the others`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** Themes stay one TOML file each. A role missing from a user's theme
      comes from the default of its mode.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): tokens, themes, and fonts`.

## Task 28: Surfaces

**Files:**

- Create: `app/ui/surfaces/{Glass,Glow,Pane,Overlay,Sheet,Popover,Dialog,Toast,Tooltip}.tsx`,
  `app/ui/surfaces/glass.wgsl`

**Interfaces:**

- Consumes: `tokens` (task 27).
- Produces: the components named above. `Glass` draws native glass or backdrop blur where the
  platform has it, and the shader elsewhere: on GTK today. No caller knows which.

- [ ] **Step 1: Build `Glass` first, and measure it.** Start from the spike's shader, with a
      smoother blur. Put it over the spike's scrolling transcript: the frame cost must stay under
      8.3 ms at the 99th percentile on GTK. If it does not, lower the blur's samples, not the
      budget.
- [ ] **Step 2: Build the others**, each following [surfaces](/specs/ui/surfaces.md) and the design
      language. A sheet rises from the bottom on a narrow window; a menu stays a popover at every
      width, as the UI layout decision says.
- [ ] **Step 3: Add each to the gallery**, in its states.
- [ ] **Step 4: Run the task's validation**: `vp run app:check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): surfaces, with glass and glow`.

## Task 29: Controls

**Files:**

- Create: `app/ui/controls/`: Button, IconButton, Switch, Segmented, Select, Checkbox, Radio,
  NumberInput, Badge, Banner, Spinner, Progress, StatusDot, Kbd, Tabs, Menu, Breadcrumbs, Divider,
  Icon, Link, Heading, Text

**Interfaces:**

- Consumes: `tokens` (27), surfaces (28).
- Produces: one component for each Astryx component the React UI imports, listed in
  [`packages/web/`](/packages/web/)'s imports of `@astryxdesign/core`, built on `nsh/base`'s
  unstyled parts where one exists.

- [ ] **Step 1: Build each control**, with its keyboard behaviour and its 44-point touch target on a
      narrow window. Icons are Lucide, and Codicons for harness marks, as today.
- [ ] **Step 2: Add each to the gallery**, in every state: rest, hover, focus, pressed, disabled.
- [ ] **Step 3: Run the task's validation**. Expected: PASS.
- [ ] **Step 4: Commit**: `feat(nsh-migration): controls`.

## Task 30: Lists, cards, tables, and trees

**Files:**

- Create: `app/ui/lists/`: List, Card, SelectableCard, Table, Tree, Collapsible, VirtualList,
  DragOrder, Empty

**Interfaces:**

- Consumes: `tokens`, surfaces, controls.
- Produces: the components above. `VirtualList` wraps NSH's list with the app's cursor and
  selection, and follows its end when asked. `DragOrder` reorders by drag, by long press on touch,
  and by keys.

- [ ] **Step 1: Build them**, following [components](/specs/ui/components.md): a multi-fact item is
      a framed card with a hierarchy, not grey lines.
- [ ] **Step 2: Add each to the gallery**, with a list of 20,000 rows.
- [ ] **Step 3: Run the task's validation**. Expected: PASS.
- [ ] **Step 4: Commit**: `feat(nsh-migration): lists, cards, tables, and trees`.

## Task 31: The text field

**Files:**

- Create: `app/ui/text/{TextField,Composer,PickerField,SaveStatus,LeaveGuard}.tsx`,
  `crates/app/src/vim_bridge.rs`, `app/ui/text/unsaved.ts`
- Test: `app/ui/text/text.test.tsx`

**Interfaces:**

- Consumes: `Vim` (task 23); `uraeda/native` (22); `device` storage (25); the setting for Vim.
- Produces: `TextField`, the one editor of every text field, as the text-editing decision asks: it
  highlights Markdown, wraps, never scrolls sideways, and runs Vim when the setting is on.
  `vimStatus: Signal<Status>` for the status line. Unsaved text kept per device, as
  [`unsaved.ts`](/packages/web/src/fields/unsaved.ts) does.

- [ ] **Step 1: Write the failing tests**: `unsaved text comes back after a restart`;
      `Escape in     normal mode does what Escape does without Vim`;
      `a yank reaches the system clipboard`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement**, on NSH's `Editor`. Keys go to `Vim::key` in Rust, in one call per key;
      its edits are applied as one editor transaction. Bind keys only while the field has the focus.
      On a real GTK window a field gets no focus by itself: focus it when it mounts, where the
      screen asks.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the shared text field, with Vim`.

## Task 32: The document renderer

**Files:**

- Create: `app/ui/document/{Document,Blocks,Spans,Table,Code,Diagram}.tsx`,
  `crates/app/src/{highlight,diagram}.rs`
- Test: `app/ui/document/document.test.tsx`

**Interfaces:**

- Consumes: the core's document tree, from the record WorkflowFile; the result of task 3's diagram
  check.
- Produces: `Document`, which draws a document tree and never parses Markdown, as the stack decision
  asks. `Reply`, which draws a streamed reply as blocks: finished blocks never redraw while the last
  one grows.

- [ ] **Step 1: Write the failing tests**: `a diagram that fails shows its source`;
      `a growing reply     redraws its last block only`, counting the blocks made while a text
      grows.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** Port the block and span kinds of
      [`Blocks.tsx`](/packages/web/src/Blocks.tsx) and `Spans.tsx`. Highlight code in Rust. Split a
      reply at block boundaries in Rust, so TSX never scans a long text.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the document renderer`.

## Task 33: Keys

**Files:**

- Create: `app/ui/keys/{registry,sequence,LeaderMenu,KeyPicker,KeyMap}.tsx`
- Test: `app/ui/keys/keys.test.ts`

**Interfaces:**

- Produces: `registerKey(spec)`, the only way a shortcut is declared; sequences of keys, which NSH
  does not have; the leader menu on Space; the key picker; the key map. All follow the keyboard
  decision and [the keyboard guide](/specs/ui/keyboard.md).

- [ ] **Step 1: Write the failing tests**: `a key means one thing on a page` (two registrations of
      one key in one scope fail); `a sequence waits for its second key, then gives up`;
      `single-key     shortcuts can be switched off, and a chord then opens the leader menu`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** A text field with the focus gets keys first.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the key registry and the leader menu`.

## Task 34: The layout shell

**Files:**

- Create: `app/ui/layout/{Page,Panes,SideColumn,Rail,StatusLine,NavBar,BottomBar,width}.tsx`

**Interfaces:**

- Consumes: surfaces, controls, `route` (25).
- Produces: the app's frame at the three width classes of the UI layout decision: narrow below 768,
  semi-wide from 768, wide from 1280. `width: Signal<"narrow"|"semi-wide"|"wide">`.

- [ ] **Step 1: Build the frame**, following [wide](/specs/ui/wide.md),
      [semi-wide](/specs/ui/semi-wide.md), and [phone](/specs/ui/phone.md). Read the window's width
      after the first layout: at the first render it is 0, which chose the wrong layout in the
      spike.
- [ ] **Step 2: Add it to the gallery**, at each width.
- [ ] **Step 3: Run the task's validation**. Expected: PASS.
- [ ] **Step 4: Commit**: `feat(nsh-migration): the layout shell`.

## Task 35: Extension pages in the client

**Files:**

- Create: `crates/app/src/extension_view.rs`, `app/extensions/{page,host,ExtensionPlace}.tsx`,
  `fixtures/extensions/{counter,throws,loops}/`
- Test: `app/extensions/extensions.test.tsx`

**Interfaces:**

- Consumes: `/extensions/:name/page` and its key (task 20); the record Extensions (18); the result
  of task 3's first two checks.
- Produces:
  - The native component `uraeda.extension`, which holds a view of its own per page, with NSH's
    limits and no rights beyond the host's functions.
  - `uraeda/page`: `place`, `homePane`, `newSection`, `statusItem`, `itemRenderer`,
    `settingsSection`, `key`, `onUnload`, `useRecord`, `useAction`, `useExtensionSettings`,
    `useRepository`, as [`docs/extensions.md`](/docs/extensions.md) names them today.
  - A page talks to the app only through NSH's host channel: the app answers `record`, `call`, and
    `navigate`, and sends the theme.
  - A page's problem, shown in its place and reported with `extensions.reportPageProblem`.

- [ ] **Step 1: Write the failing tests**
  - `a saved page shows without a restart`.
  - `a page that throws at load is named, and the app goes on`.
  - `a page that never stops is cut off and named`.
  - `a page reads a record and calls an action of its extension`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement**, from the spike's `src/ext.rs`. The page takes the app's theme, so it
      looks like the app. The client trusts only the server's key. Read NSH's embedding and sandbox
      pages first: this is the part most likely to have changed.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): extension pages in the client`.

## Task 36: The gallery

A human gate: the second design gate.

**Files:**

- Create: `app/gallery/{App.tsx,pages/}`, `app/tools/{shots,frames}.ts`
- Modify: `vite.tasks.ts`

**Interfaces:**

- Consumes: every component of tasks 27 to 35.
- Produces: `vp run gallery` (the gallery on GTK); `vp run gallery:shots` (a picture of every
  component, in both themes, at three widths, on an invisible display); `vp run frames` (the frame
  cost of a named scene, as median, 95th, 99th percentile, and worst).

- [ ] **Step 1: Assemble the gallery**: one page per component, and three scenes: a session with
      20,000 messages streaming, the same scrolling by itself, and a glass panel over it.
- [ ] **Step 2: Write the two tools**, from the spike's `tools/` and its self-scrolling switch. They
      never open a window on the human's display.
- [ ] **Step 3: Run `vp run frames`** on the three scenes. Expected: at most 8.3 ms at the 99th
      percentile. Record the numbers in the commit's body.
- [ ] **Step 4: Review every picture yourself**, against the design language, and fix what drifts.
- [ ] **Step 5: Commit, and stop for the human**, with the pictures in the pull request:
      `feat(nsh-migration): the component gallery`.

**Phase 1: the Linux app.** Every screen, on the component library, as a Linux app on GTK, then its
package. It starts once the gallery's gate (task 36) is approved.

## Task 37: The app's shell

**Files:**

- Create: `crates/app/src/bin/uraeda.rs` (the Linux host), `crates/app/src/server_start.rs`,
  `app/App.tsx`, `app/screens/{routes.tsx,shell/,sign-in/,repository/}`, `app/tools/shots.ts`
- Test: `app/screens/shell/shell.test.tsx`
- Read: [`App.tsx`](/packages/web/src/App.tsx), `Shell.tsx`, `shell/`, `sidebar/`,
  `sign-in/SignInPage.tsx`, `RepositoryPages.tsx`

**Interfaces:**

- Consumes: the layout shell (34), the store (24), routes (25), `ura serve` and pairing (5, 6).
- Produces:
  - The `uraeda` app: a GTK window that finds a running server through its status file, or starts
    `ura serve` and waits for it.
  - `uraeda --server <address>`: connect to another machine's server, pairing on the first run.
  - The frame every screen draws in: the sidebar or rail, the tabs, the side column, the status line
    with the Vim mode, the connection's state.
  - The sign-in and pairing screens; the first-run, unknown-repository, and missing-folder pages;
    "Nothing here"; the server-error banner; the "update this side" page for a refused version.
  - `vp run app:shots <route>`: a picture of a route on the sandbox, on an invisible display.

- [ ] **Step 1: Write the failing tests**
  - `the app starts a server when none runs`, with a row where the server stops while the app is
    open: the app says so, then starts or waits for one.
  - `a refused version shows which side to update`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Build the host and the shell.** The app owns a server it started, and stops it when
      the last window closes; it never stops a server it found running. The device's token is kept
      in the system's secret store, never in a plain file.
- [ ] **Step 4: Review it in the running app**, as the shared step 4 says.
- [ ] **Step 5: Run the task's validation**. Expected: PASS.
- [ ] **Step 6: Commit**: `feat(nsh-migration): the app's shell and its server start`.

## Task 38: Home and priorities

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{home,priorities}/`
- **Read:** [`Home.tsx`](/packages/web/src/Home.tsx), `home/`, `PrioritiesPage.tsx`, `lists/`,
  `pane/DetailRoutes.tsx`
- **Records and actions:** Workspace, Priorities, NeedsYouList, ProposalHints; `priorities.*`,
  `proposals.move`, `proposals.outline`
- **Routes:** `/`, `/priorities`, `/priorities/<key>`
- **Its own rules:** priorities show as columns or one list, switched with `v`. Order changes by
  drag, by long press, and by keys.
- **Tests:** `a reorder is saved once, in the order shown`.

## Task 39: Proposals, and starting work

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{proposal,new}/`
- **Read:** `pane/ProposalPane.tsx`, `ProposalEditor.tsx`, `NewPage.tsx`, `StartDialog.tsx`,
  `NewFeatureComposer.tsx`
- **Records and actions:** ProposalFile, StartPlan, SlugProposal, FolderSuggestions; `proposals.*`,
  `feature.start`, `feature.startText`, `change.start`, `session.new`
- **Routes:** `/priorities/<key>` as an overlay or a page, `/new?kind=session|change|feature`
- **Tests:** `leaving an edited proposal asks first, and keeps the text`.

## Task 40: Inbox and triage

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{inbox,triage}/`
- **Read:** `InboxPage.tsx`, `pane/EntryPane.tsx`, `TriagePage.tsx`, `attach/`
- **Records and actions:** Inbox, Dropped; `inbox.*`
- **Routes:** `/inbox`, `/inbox/<key>`, `/inbox/triage`
- **Its own rules:** an image is added by drop, by paste, and by a picker, and uploaded through
  `POST /r/:name/inbox/note-image`.
- **Tests:** none: using the screen shows every behaviour.

## Task 41: The feature page

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/feature/`
- **Read:** `feature/FeaturePage.tsx` and its panes
- **Records and actions:** Feature, Ledger, History, WorkflowMessage, RecommendedMessage;
  `feature.*`
- **Routes:** `/f/<folder>`, `/f/<folder>/runs/<id>`
- **Tests:** none.

## Task 42: Workflow files

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/file/{DocumentPage,SpecPage,PlanPage,DataModelPage}.tsx`
- **Read:** `FilePage.tsx`, `spec/`, `PlanPage.tsx`, `DocumentPage.tsx`,
  `decisions/BranchDecision.tsx`
- **Records and actions:** WorkflowFile, BranchDecision, BranchChanges
- **Routes:** `/f/<folder>/<file>`, `/f/<folder>/decisions/<name>`
- **Consumes also:** `Document` (task 32).
- **Its own rules:** a file is drawn from the core's document tree. The spec page keeps its review
  tab, its decision cards, its history, and what changed since the last review.
- **Tests:** none.

## Task 43: Rounds and reviews

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{round,review}/`
- **Read:** `RoundPage.tsx`, `QuestionCard.tsx`, the `Round*`, `Question*`, `Settled*`, and
  `Review*` files, `review/`
- **Records and actions:** WorkflowFile; `defaultRound.*`, `answer.save`, `answers.submit`,
  `notes.save`, `settled.*`, `review.*`
- **Its own rules:** an answer is saved as it is typed, and submitted only by the action that says
  it commits. The position in a round is kept per device.
- **Tests:** `an answer typed and not submitted is there after a restart`;
  `submitting sends every answer once`.

## Task 44: Sessions

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/session/{SessionsPage,SessionPage,Transcript,Composer,Permission}.tsx`
- **Read:** `shell/SessionsPage.tsx`, `SessionPage.tsx`, `SessionView.tsx`, the `Transcript*` and
  `Composer*` files, `session/`
- **Records and actions:** SessionList, SessionSearch, Session, Turn, TurnLog, Agent; `session.*`
- **Routes:** `/sessions`, `/sessions/<id>`, `/f/<folder>/session`
- **Consumes also:** `Reply` (32), `VirtualList` (30), `TextField` (31), `text()` (24).
- **Its own rules:** the transcript opens at its newest message and follows it while a reply
  streams, unless the reader scrolled away. Each message has its own signal. A reply is drawn as
  blocks. Images are attached through `POST /r/:name/attach`.
- **Tests:** `a streaming reply stays in view`; `a reader who scrolled up is not moved`;
  `a message typed during a reply is sent once`.
- **Extra step, before the commit:** run `vp run frames session` on a session of 20,000 messages.
  Expected: at most 8.3 ms at the 99th percentile, streaming and scrolling.

## Task 45: Session panels and runs

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/session/panels/`, `app/screens/runs/`
- **Read:** `session/` (activity, changes, subagents, start steps), `runs/` (run map, strip,
  sub-sessions)
- **Records and actions:** Session, Turn, BranchChanges, AllBranchChanges; `session.allow`,
  `session.allowAll`, `session.toChange`
- **Tests:** none.

## Task 46: Decisions

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/decisions/`
- **Read:** `decisions/DecisionsPage.tsx`, `decisions/CheckPage.tsx`
- **Records and actions:** Workspace, WorkflowFile; the decisions check's actions
- **Routes:** `/decisions`, `/decisions/<name>`, `/decisions/constitution`, `/decisions/check`
- **Its own rules:** the list sits beside the reader when there is room. The sort is kept per
  device.
- **Tests:** none.

## Task 47: Git

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/git/`
- **Read:** `git/GitPage.tsx`, `git/Diff.tsx`, `git/ChangesTree.tsx`
- **Records and actions:** GitPage, GitSummary, GitDiff, GitCommit, GitHistoryPage, ConflictFile;
  `git.*`
- **Routes:** `/git`
- **Its own rules:** the page is shaped like lazygit. Diffs use NSH's diff view, styled through
  `app/ui/`.
- **Tests:** `a commit holds exactly the staged files`.

## Task 48: Editors

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{editor,buffer,conflict}/`
- **Read:** `EditorPage.tsx`, `buffer/BufferPage.tsx`, `fields/editor/` (the merge-conflict bar)
- **Records and actions:** Buffer, ConflictFile; `buffer.save`, `text.*`, `git.saveConflict`
- **Routes:** `/edit/<path>`, `/buffer/<path>`
- **Tests:** `a file changed on disk while it is edited is not overwritten silently`.

## Task 49: Settings

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/settings/`
- **Read:** `settings/SettingsPage.tsx`, `settings/categories.ts`, `theme/`, `keys/` (the theme and
  font pickers)
- **Records and actions:** Settings, Themes, Devices, Extensions; `settings.*`, `devices.*`,
  `extensions.setOn`, `extensions.setSetting`
- **Routes:** `/settings/<category>`, for server, appearance, fonts, keyboard, sign-in, runs, and
  extensions
- **Its own rules:** the theme and the fonts are chosen per device. The sign-in category lists
  paired devices, and revokes one.
- **Tests:** none.

## Task 50: Previews

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/preview/{MockupPage,StoryPage,LiveFrame}.tsx`,
  `app/ui/surfaces/WebFrame.tsx`
- **Read:** `LiveFrame.tsx`, `LiveWindow`, `StoryFrames.tsx`, `StoryEmbed.tsx`, `MockupPage.tsx`
- **Records and actions:** Preview, Story, StoryHref; `preview.restart`
- **Routes:** `/f/<folder>/mockups/<name>`, `/f/<folder>/storybook`, `/storybook`
- **Consumes also:** the result of task 3's web-view check.
- **Its own rules:** `WebFrame` is the only component that shows a web page: a web view on GTK, a
  frame on the web. A preview's address carries its frame secret.
- **Tests:** none.

## Task 51: Notifications, undo, and writes

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/shell/{Notifications,Undo,Writes}.tsx`
- **Read:** `notify/`, `undo/`, `writes/` (the commit toast and the write queue),
  `fields/LeaveGuard`
- **Records and actions:** NeedsYouList, Undo, WriteQueue; `undo.*`, `writes.dismiss`,
  `commit.retry`
- **Consumes also:** the result of task 3's notification check.
- **Its own rules:** the app asks for notifications only after saying why, and never again after a
  refusal. `u` and `Ctrl+Z` undo, `U` and `Ctrl+Shift+Z` redo, on a stack of the last 50 actions. An
  undoable action never asks to confirm.
- **Tests:** `undo puts back what the action changed`.

## Task 52: Built-in extensions, and extension places

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/extensions/builtins/` (decisions, git, inbox, priorities, sessions, notifications,
  previews), `app/screens/extension/`, `docs/extensions.md`
- **Read:** [`extensions/builtins/`](/packages/web/src/extensions/builtins/),
  `extensions/routes.tsx`, [`docs/extensions.md`](/docs/extensions.md)
- **Routes:** `/e/<name>/<rest>`
- **Consumes also:** the page API and `uraeda.extension` (task 35).
- **Its own rules:** each built-in place is declared through the same page API as the owner's, and
  can be turned off. A built-in's screen is the app's own code, linked in: only its declaration goes
  through the API. See the ruling on built-ins.
- **Extra step:** rewrite `docs/extensions.md` for the new API: the folder, `extension.toml`, the
  server API, the page API, what a page may import, and limits. A session must be able to write an
  extension from it alone.
- **Tests:** `turning a built-in off removes its place, and the app goes on`.

## Task 53: The sandbox, and a walk through the app

**Files:**

- Modify: `AGENTS.md`, `CONTRIBUTING.md`, `vite.tasks.ts` (`vp run sandbox` starts the new app)

**Interfaces:**

- Consumes: every screen.
- Produces: `vp run sandbox`, which opens the Linux app on `ura sandbox`. A report of what a person
  meets, in the pull request.

- [ ] **Step 1: Point `vp run sandbox` at the new app**, with `--reset` kept.
- [ ] **Step 2: Walk through the app as one persona** of [personas](/specs/ui/personas.md), from a
      new feature to an approved spec and a finished session, by keyboard and by pointer. Note what
      hurts its looks, readability, behaviour, and coherence, with pictures.
- [ ] **Step 3: Fix what is clearly wrong.** Propose the rest as changes to the guides, in the pull
      request.
- [ ] **Step 4: Run `vp run ready`**. Expected: PASS.
- [ ] **Step 5: Commit**: `fix(nsh-migration): what a walk through the app found`.

## Task 54: Performance

**Files:**

- Create: `app/tools/navigation.ts`
- Modify: `packages/benchmarks/` or its successor, `app/tools/frames.ts`

**Interfaces:**

- Produces: `vp run bench:navigation` (the time from a key to the next page drawn, for every page
  and action the performance decision names) and `vp run frames <scene>`; a development build's
  warning when an interaction passes 100 ms.

- [ ] **Step 1: Write the navigation benchmark** over the sandbox's projects, as the performance
      decision asks.
- [ ] **Step 2: Run both benchmarks.** Expected: navigation within 100 ms, a reload within 1 second,
      frames at most 8.3 ms at the 99th percentile.
- [ ] **Step 3: Fix what misses.** The usual causes, from the spikes: a list bound without pacing, a
      long text drawn as one block, a record sent whole where a change would do, work done in TSX
      that belongs in Rust.
- [ ] **Step 4: Run them again, and record the numbers** in the commit's body.
- [ ] **Step 5: Commit**: `perf(nsh-migration): meet the navigation and frame targets`.

## Task 55: Packaging and release

**Files:**

- Modify: `.github/workflows/`, `dist-workspace.toml`, `INSTALL.md`, `README.md`, `CONTRIBUTING.md`
- Create: `app/package/` (icons, the desktop entry)

**Interfaces:**

- Produces: a release with `ura` (the CLI and the server) and the Linux app as a tarball and an
  AppImage, from one tag, with one version, as the distribution decision asks.

- [ ] **Step 1: Package the app** with NSH's packager. Read its packaging page first. The app needs
      GTK 4.14 or newer, and says so when it is missing.
- [ ] **Step 2: Add both artifacts to the release workflow.** A release that fails part way must be
      completable at the same version.
- [ ] **Step 3: Write the install pages**: `INSTALL.md` for every way to install, `README.md` for a
      quick one.
- [ ] **Step 4: Install each artifact on a clean container**, start it, and open a repository.
      Expected: the home page.
- [ ] **Step 5: Commit**: `build(nsh-migration): package the Linux app and ura serve`.

## Task 56: Parity

**Files:**

- Create: `app/screens/parity.toml`, `app/screens/parity.test.ts`

**Interfaces:**

- Produces: the list of every route of [`routeTable.ts`](/packages/web/src/routeTable.ts), each with
  its new screen, or `dropped` and why.

- [ ] **Step 1: Write the failing test** `every old route is mapped or dropped`: it reads the old
      route table and fails on a route missing from `parity.toml`, or mapped to a route that draws
      "Nothing here".
- [ ] **Step 2: Run it**. Expected: FAIL, naming what is missing.
- [ ] **Step 3: Fill the list, and build what it shows missing.** A route dropped on purpose names
      the human's request or the decision behind it.
- [ ] **Step 4: Run `vp run ready`**. Expected: PASS.
- [ ] **Step 5: Commit**: `test(nsh-migration): every old route has a screen`.

**Phase 2: the web build.** The same app in a browser, served by `ura serve`, then the removal of
the React UI and the Node server. Read NSH's web pages before each task:
[`website/docs/web.md`](https://github.com/longbridge/nsh/blob/main/website/docs/web.md) and
[`docs/dev/web.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/web.md). The plan ends
here: iOS and macOS are the human's, later.

## Task 57: The web build, served by `ura serve`

**Files:**

- Create: `crates/server/src/http/web.rs`, `app/web/` (the page that hosts the app)
- Modify: `vite.tasks.ts`, `.github/workflows/`
- Test: `crates/server/tests/web.rs`

**Interfaces:**

- Consumes: the app (phase 1); `sign_in` (task 6).
- Produces: `vp run web:build`, which packages the app for the web; `ura serve` serving it at `/`,
  with any unknown path answering the app's page; the sign-in cookie for the browser, as today.

- [ ] **Step 1: Write the failing tests**
  - `the app's files are served compressed, and cached by their hash`: the break is a 10 MB first
    load, which the spike met when its server ignored the compressed files.
  - `an unknown path answers the app, and a server path does not`.
  - `the first load is at most 3 MB`, compressed.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** The web build is embedded in `ura`, so a release has no loose files.
      The app's entry must be TSX: a web build whose root is pure Rust cannot run TSX extension
      pages.
- [ ] **Step 4: Run the task's validation**, then open the app in a headless browser on the sandbox.
      Expected: PASS, and the home page.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the web build, served by ura serve`.

## Task 58: Browser behaviour

**Files:**

- Create: `app/store/history.web.ts`, `app/web/manifest.webmanifest`
- Modify: `app/ui/surfaces/Glass.tsx`, `app/ui/surfaces/WebFrame.tsx`,
  `app/screens/shell/Notifications.tsx`
- Test: `app/web/web.test.ts`, run in a headless browser

**Interfaces:**

- Consumes: `route`, `navigate`, `back` (task 25).
- Produces: the browser's address and history bound to the app's routes; `Glass` drawn with the
  browser's backdrop blur; `WebFrame` as a frame; browser notifications; the page's title with the
  count of what needs the owner; the web app manifest.

- [ ] **Step 1: Write the failing tests**
  - `a feature's address opens it, and Back returns`.
  - `a reload keeps the page and its scroll`.
  - `a touch in a field keeps the focus`: the keyboard bug fixed upstream in
    [longbridge/nsh#1482](https://github.com/longbridge/nsh/pull/1482). If the pin lacks the fix,
    this test fails, and the pin moves.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** Known gaps of NSH on the web, from the spike: a list's first scroll
      position is not honoured, so scroll to the end after the first layout; a web build has no
      native components, so every native component of `crates/app/` needs its web form.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): addresses, history, and browser behaviour`.

## Task 59: Extension pages in the browser

**Files:**

- Create: `app/extensions/host.web.tsx`
- Test: `app/web/extensions.test.ts`

**Interfaces:**

- Consumes: the page API and its host channel (task 35); `/extensions/:name/page` (task 20).
- Produces: the web form of `uraeda.extension`: each page runs in NSH's player, in a frame of its
  own, with the same page API and the same theme.

- [ ] **Step 1: Write the failing tests**: the four tests of task 35, run in a headless browser.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** Read NSH's web page on players first. What the spike found: a page in a
      frame without an origin runs one app, and is loaded again to run another; the frame's files
      need cross-origin headers. A frame is not a security boundary here, and need not be: an
      extension is the owner's own code.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): extension pages in the browser`.

## Task 60: The phone

**Files:**

- Modify: the screens and components that fail the review below

**Interfaces:**

- Produces: every screen right on a phone's browser, as [the phone guide](/specs/ui/phone.md) asks.

- [ ] **Step 1: Take a picture of every route** at 390 by 844, in both themes, with
      `vp run app:shots --web --phone`.
- [ ] **Step 2: Review each against the phone guide**: one column, top tabs, a bottom bar, sheets
      for pickers and short forms, 44-point targets, prose at 16 points, wrapping text on the full
      width. Walk through one persona's journey with touches.
- [ ] **Step 3: Fix what fails**, in `app/ui/` where the cause is a component.
- [ ] **Step 4: Run `vp run ready`**. Expected: PASS.
- [ ] **Step 5: Commit**: `fix(nsh-migration): the app on a phone`.

## Task 61: Web performance

**Files:**

- Modify: `app/tools/frames.ts`, `app/tools/navigation.ts` (a `--web` form of each)

**Interfaces:**

- Produces: the two benchmarks of task 54, run in a headless browser, at a phone's size with the
  processor slowed four times.

- [ ] **Step 1: Run both benchmarks** on the sandbox, and on a session with a very long reply.
- [ ] **Step 2: Compare with the spike's numbers**: 57 frames a second streaming, 37 scrolling.
      Expected: no worse, and no frame over 100 ms while a long reply streams.
- [ ] **Step 3: Fix what misses**, then run them again and record the numbers in the commit's body.
- [ ] **Step 4: Run `vp run ready`**. Expected: PASS.
- [ ] **Step 5: Commit**: `perf(nsh-migration): the web build on a slow phone`.

## Task 62: Remove the React UI and the Node server

**Risky:** it deletes the code that runs Uraeda today.

**Files:**

- Delete: `packages/web/`, `packages/server/`, `packages/binding/`, `packages/uraeda/`,
  `crates/binding/`, and what only they use in `package.json`, `vite.config.ts`, `flake.nix`, and
  `.github/workflows/`
- Modify: `README.md`, `INSTALL.md`, `CONTRIBUTING.md`, `AGENTS.md`, `docs/`, `specs/ui/`,
  `crates/server/parity.toml`, `app/screens/parity.toml` (their tests no longer read deleted code:
  keep the lists, drop the reads)
- Modify: `crates/cli/src/serve.rs` (the default port becomes the Node server's old one)

**Interfaces:**

- Consumes: everything.
- Produces: a repository that builds, tests, and releases without Node.

- [ ] **Step 1: Import the human's sessions once**, with `ura import-sessions`, while the Node
      server is stopped. Nothing more is built for upgrades: the human is the only user.
- [ ] **Step 2: Delete the old code**, as the spec's
      [replaced behaviour](spec.md#replaced-behaviour) lists it, with its tests.
- [ ] **Step 3: Update every page a reader meets**: what Uraeda is, how to install it, how to build
      and test it, the web UI's page in `docs/`, and the guides of `specs/ui/` that named Astryx or
      the browser.
- [ ] **Step 4: Run `vp run ready`, and a release to a test tag.** Expected: PASS, and artifacts
      with no Node in them.
- [ ] **Step 5: Commit**: `feat(nsh-migration)!: remove the React UI and the Node server`.
