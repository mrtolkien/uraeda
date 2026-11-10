---
status: approved
spec-revision: 1
---

# Plan: Migration to Native Shell and a Rust server

> [!NOTE]
>
> Approved on 2026-11-10.
>
> - Beyond the spec: four behaviours get a test the spec does not name, see
>   [review focus](#review-focus).
> - The eleven changed decisions and the new one are written on this branch: approving the spec
>   approves them. The [design language](/specs/ui/design-language.md) is written too.
> - No human gate stops the build: it runs from task 1 to task 61 without you. Where an earlier
>   draft stopped, a task now takes a named fallback, and records it in [rulings](rulings.md).
> - Task 2 checks what the spikes did not verify. A check that fails takes its fallback: none stops
>   the build.
> - The design's four open choices are taken as the design language proposes them, each behind one
>   token: see ruling R13.
> - New dependencies: NSH 0.4, `axum`, `tokio`, `rusqlite`, `rquickjs`, and a newer Rust toolchain.
> - The riskiest tasks come early: sign-in (5), the session store (11), and the extension VM (17).
> - The plan has 61 tasks in three phases: core, the Linux app, then the web build.

**Goal:** Uraeda runs as a Rust server inside `ura`, with one TSX client on Native Shell that ships
as a Linux app and a web build, on a component library of its own.

**Architecture:** see [the spec's architecture](spec.md#architecture) for the shape. The ownership,
the layout, and the contracts are under [code read](#code-read). The tasks come in three phases:

| Phase         | Tasks | Ends with                                          |
| ------------- | ----- | -------------------------------------------------- |
| 0, core       | 1–35  | A Rust server, a client core, and a gallery        |
| 1, Linux, GTK | 36–55 | The Linux app, packaged, at parity                 |
| 2, web        | 56–61 | The web build, and the React and Node code removed |

iOS and macOS are not in this plan. Nothing here may close them off: see
[global constraints](#global-constraints).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions the spec implies but does not name. Each gets a test in the task
that owns the code.

1. **A change arrives for a subscription the client just dropped.** The client ignores it, and the
   store's count of subscriptions stays right. Task 23.
2. **Two clients send an action on one record at once.** Both get a result, and both end with the
   same value. Task 6.
3. **The server stops while an extension's VM is in a call.** The VM is stopped, and no process or
   timer of it is left. Task 17.
4. **A paired device's clock is wrong.** Pairing and sign-in do not depend on the device's time.
   Task 5.

## Global constraints

Every task's requirements include these.

From the decisions, as this branch changes them, word for word:

From [Stack](../decisions/stack.md):

- Workflow logic, parsing, validation, and states MUST live in the Rust core.
- The UI MUST hold no workflow logic: what it shows, and what it may do, come from the server.
- The server MUST stop every preview command it runs when it stops.

From [Extensions](../decisions/extensions.md):

- Extensions MUST load only from the config folder, never from a repository.
- A broken extension MUST NOT stop Uraeda or another extension.
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

- **No task waits for the human.** A task that cannot do what it says takes the fallback it names,
  or the simplest design that keeps its tests, writes a ruling, and goes on. It never asks, and
  never leaves the build stopped.
- **No window opens on the human's display.** Every run of the app, the gallery, or a test that
  draws uses an invisible display: `hidden-display <command>`, from the dev shell (ruling R17).
- **Nothing outside the worktree changes.** No task installs a tool on the machine, touches the
  human's config or data folders, or stops a server it did not start: tools come from the Nix dev
  shell, and data from temporary folders and the sandbox.
- **The React UI and the Node server are frozen.** No task changes `packages/web/` or
  `packages/server/`, except task 61, which removes them. A critical fix there is a separate change.
- **The two servers never share runtime data.** The Rust server has its own data folder and its own
  default port, until task 61.
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
push. In a new worktree, run `vp run app:check` once before `vp check`: it writes the types of `nsh`
in `app/.nsh/`, which `vp check` reads.

### What every records task does

Tasks 7 to 10 each port the records and mutations of one domain from
[`packages/server/src/fate/`](/packages/server/src/fate/), keeping their names, and call the core
function the binding wraps today. Each adds its line `mod <domain>;` and its line in `DOMAINS` to
`records/mod.rs` (ruling T99.3), and removes its names from `NOT_BUILT` in
`crates/server/tests/live.rs` if they are there.

- Consumes: `Registry`, `Bus`, `Fault`, `Call` (task 6, whose section and
  [`live/mod.rs`](/crates/server/src/live/mod.rs) show a whole domain); the core's functions.
- Produces: its records and actions, typed in `crates/protocol/`, each with its line in `catalog()`
  and the client's types written again by `vp run protocol:types`, and their rows in task 20's list.

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

Tasks 37 to 51 each port one area of the React UI. They share one shape, so each task below lists
only what differs: its files, the old code to read, its records and actions, and its own rules.

**Shared interfaces:**

- Consumes: `app/ui/` (tasks 26 to 33), `record`, `call`, `text` (task 23), `route` and `navigate`
  (task 24), `registerKey` (task 32), and the records and actions of its area (tasks 7 to 18).
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

Task 3 writes the contract in `contracts/protocol.md`. Its shape, which every task assumes:

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
  spike. So the protocol sends changes, each numbered.
- **NSH's editor has no Vim.** The spike's layer worked over its commands. So Vim is ours.

### Why Vim's keys, and not Helix

Reviewed on 2026-11-10, on Helix at commit `ba40e54`: could Helix's code be embedded, leaving only
the drawing to write? No. The human ruled that Helix is worth it only with its full feature set, so
the layer keeps Vim's keys.

- **Helix's commands cannot be embedded.** They are 7,200 lines of `helix-term/src/commands.rs`,
  written against Helix's own editor and screen. That editor, `helix-view`, brings `tokio`, language
  servers, the debugger, and version control with it.
- **Helix's core crate could be, and costs more than it saves.** `helix-core` holds pure functions
  over a rope: motions, text objects, surrounds. It is not published, so it would be pinned from
  git, under MPL 2.0. It brings Helix's grammar loader and its C parser, which its own manifest says
  are not ready for the web target. Building it for the web was not tried.
- **"Only the drawing" is the largest part.** With Helix's buffer, Uraeda would draw the text, the
  carets, and the selections itself, and handle composed input, touch selection, the phone's
  keyboard, and accessibility, on GTK, on the web, and later on iOS. NSH's editor already does all
  of that.
- **A subset of Helix's keys is possible, and not wanted.** It would be a smaller state machine than
  Vim's, and not the whole of Helix.

### NSH documentation

NSH moves fast: read the page again before building on it. Start from
[`llms.txt`](https://nsh.dev/llms.txt), which lists every page, and from the NSH section of
[`AGENTS.md`](/AGENTS.md), which says where the documentation and the source are. Paths below are
under `https://github.com/longbridge/nsh/blob/main/`. The pin is NSH 0.4.0, the release `v0.4.0`, at
commit `e626a8dd8f8d8b277b9507cfd5ac74d0e67020f3` (ruling R14): read the pages at that commit, with
`v0.4.0` in place of `main` in a path.

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

- IV: this plan is long to review. Nothing in it waits for the human, at their request: the
  decisions are approved with the spec, and the design's open choices are one token each.

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
| US1.1: the app starts the server                   | 36     | `the app starts a server when none runs`                |
| US1.2: a reply streams and the transcript follows  | 43     | `a streaming reply stays in view`                       |
| US1.3: `d2w` deletes two words                     | 22     | `d2w deletes two words`, a row of the Vim table         |
| US2.1: an address opens its page, and Back returns | 57     | `a feature's address opens it, and Back returns`        |
| US2.2: the phone keyboard stays open               | 57     | `a touch in a field keeps the focus`                    |
| US3.1: a saved page reloads                        | 34     | `a saved page shows without a restart`                  |
| US3.2: a broken extension is contained and named   | 34     | `a page that never stops is cut off and named`          |
| US4: one library, on the design language           | 25, 35 | none: pictures, reviewed after the build                |
| US5: a device pairs and is revoked                 | 5      | `a paired device signs in until it is revoked`          |
| Edge: the connection drops mid-reply               | 23     | `a reconnect resumes a reply without a gap`             |
| Edge: versions differ                              | 4      | `an older client is refused with the side to update`    |
| Edge: a token revoked while connected              | 5      | a row of `a paired device signs in until it is revoked` |
| Edge: the server stops                             | 36     | a row of `the app starts a server when none runs`       |
| Edge: a diagram fails                              | 31     | `a diagram that fails shows its source`                 |
| Success: every route has a screen                  | 55     | `every old route is mapped or dropped`                  |
| Success: 8.3 ms a frame at the 99th percentile     | 53     | the frame benchmark, on demand                          |
| Success: 100 ms navigation                         | 53     | the navigation benchmark, on demand                     |
| Success: builds without Node                       | 61     | the release workflow                                    |
| Review focus: a change after an unsubscribe        | 23     | a row of `a reconnect resumes a reply without a gap`    |
| Review focus: two clients, one record              | 6      | `two clients acting at once end equal`                  |
| Review focus: the server stops during a VM call    | 17     | `stopping the server leaves no VM work behind`          |
| Review focus: a wrong clock on a device            | 5      | a row of `a paired device signs in until it is revoked` |

## Waves

No task ends at a human gate. Phase 1 starts once task 35 is done, and phase 2 once task 55 is done.
The risky tasks, each reviewed on its own, are 5, 11, 17, 19, and 61.

1. Task 1, alone: every later task builds in what it creates.
2. Task 2, alone: later tasks read its results.
3. Tasks 3, 21, 22: the protocol, the native module, and the Vim layer share no file.
4. Task 4, alone.
5. Tasks 5, 6: sign-in and the live engine, in separate modules.
6. Tasks 7, 8, 9, 10, 11, 16, 18: one module each, each adding its lines to the record registry.
7. Task 12, alone: the runtimes and the extension VM implement its contract.
8. Tasks 13, 14, 17: two runtimes and the extension VM.
9. Tasks 15, 19.
10. Task 20, alone: the store's tests and every screen's review run on its sandbox.
11. Tasks 23, 24, 25: the client store, its routes, and the design language's samples.
12. Task 26, alone: every component reads its tokens.
13. Tasks 27, 32: surfaces and keys.
14. Task 28, alone: lists, the text field, and the shell use its controls.
15. Tasks 29, 30, 33: each adds its own folder to `app/ui/`.
16. Tasks 31, 34.
17. Task 35, alone: it measures every component together.
18. Task 36, alone: every screen lives in its shell.
19. Tasks 37, 39, 40, 45, 46, 48: areas with no screen in common, each adding its lines to the
    routes.
20. Tasks 38, 41, 43, 47, 49.
21. Tasks 42, 44, 50.
22. Task 51.
23. Tasks 52, 53.
24. Task 54.
25. Task 55, alone.
26. Task 56, alone.
27. Tasks 57, 58: browser behaviour, and extension pages, in separate files.
28. Tasks 59, 60.
29. Task 61, alone.

---

The settled small choices are in [rulings.md](rulings.md).

**Phase 0: core.** The Rust server, the client core, and the component library with its gallery.
Nothing here is a screen of the app.

## Task 1: Scaffolding and toolchain

**Files:**

- Create: `crates/protocol/`, `crates/server/`, `crates/vim/`, `crates/app/` (empty crates, in the
  workspace: `crates/app/` holds an empty `uraeda/native`, and `crates/server/` takes
  `nsh-bundler`), `app/nsh.json`, `app/App.tsx`, `app/App.test.tsx`, `app/tsconfig.json`,
  `app/theme.json`, `scripts/nsh.ts`
- Modify: `Cargo.toml`, `rust-toolchain.toml`, `flake.nix`, `vite.tasks.ts`, `CONTRIBUTING.md`,
  `AGENTS.md` (the pinned NSH version and commit, and the `app/` and new crates in the layout),
  `scripts/fast-check.ts`, `.github/workflows/ci.yml`, the toolchain configuration's test, and
  `crates/core/src/extensions.rs` (its JSON sorts its keys itself: ruling R19)

**Interfaces:**

- Produces:
  - `vp run app:check` (`cargo check` of the app's crate, then NSH's type check) and
    `vp run app:test` (`nsh test`, with no display), both part of `ready`, in its group `ready:app`;
    and `vp run app:dev` (the app on GTK), which is no check.
  - `node scripts/nsh.ts <command>`: any other `nsh` command on the app, as the three tasks run it
    (ruling R16).
  - `hidden-display <command>`: the invisible display (ruling R17).
  - The pinned NSH version, 0.4.0, in `flake.nix`, `Cargo.toml`, `Cargo.lock`, and `app/nsh.json`
    (`minRuntime`), and its commit in `AGENTS.md` (ruling R14). Rust 1.97.0 (ruling R15).

- [x] **Step 1: Raise the Rust toolchain** to the first stable release that builds NSH 0.4 (1.96
      does not: the spike used 1.99.1). Run `cargo nextest run` on the whole workspace. Expected:
      PASS, as before the change.
- [x] **Step 2: Add the four crates and the `app/` project.** `App.tsx` mounts a text. Add NSH's
      CLI, GTK 4.14, and an invisible display server to the Nix dev shell, pinned. Pin `rolldown`
      and its sibling crates to one version in every lockfile NSH generates: version drift between
      them broke two builds in the spike.
- [x] **Step 3: Add the three tasks to `vite.tasks.ts`**, with their inputs, and to `ready`. The
      toolchain configuration's test must name them.
- [x] **Step 4: Run `vp run ready`**. Expected: PASS, with the new tasks listed. It ran with the new
      tasks, and every check passed but one test of `ts:test`, which failed before this task:
      `each decision of this repository has a drawn icon`, since the frozen web UI draws no `cable`
      icon for the new protocol decision.
- [x] **Step 5: Commit**: `chore(nsh-migration): scaffold the server, the app, and their checks`.

## Task 2: Check what the spikes did not verify

Each check is a test through the real library. None stops the build: a check that fails takes the
fallback written under it, and later tasks build on the fallback.

**Files:**

- Create: `crates/app/tests/outside.rs`, its helpers in `crates/app/tests/outside/`,
  `app/__checks__/` (the pages the checks load), `app/package.json`
- Modify: `flake.nix` (`hidden-display`'s own session bus, `xdotool`), `vite.tasks.ts` (the dev
  shell's build variables, for the tasks that build the crate's tests), `Cargo.toml`,
  `crates/app/Cargo.toml`, `pnpm-workspace.yaml`, `AGENTS.md`

**Interfaces:**

- Produces: `crates/app/tests/outside.rs`, kept as the guard of each assumption. Its findings, in
  [rulings.md](rulings.md): for each check, "holds" or "fallback taken". All five hold: rulings R22
  to R26, and R21 for how the checks run.

- [x] **Step 1: Write the five checks**
  1. **A signed package loads in an embedded view on GTK.** Build a page, sign it with a key made
     for the test, and load it in an `AppView` that trusts that key. An unsigned or re-signed
     package is refused. See the signed-packages pages. **Fallback:** the server sends the page's
     compiled source over the signed-in connection, with its hash, as the spike loaded it; the
     client checks the hash. Tasks 19 and 34 then build that, and name signing as future work.
  2. **A broken page is reported to the host.** The spike's log showed the error; the host got no
     callback on GTK. Look for a callback or the engine's error channel. **Fallback:** the host
     pings each page over its host channel, and names a page broken when it does not answer within 2
     seconds or never sends its first "ready".
  3. **A web view shows a local page on GTK**, with the `webview` feature, and gets keys.
     **Fallback:** on Linux a preview opens in the system's browser, from a link in its place.
  4. **A diagram draws without a browser.** Run the diagram library in NSH's VM, or in Rust, to
     produce a picture NSH can draw. **Fallback:** diagrams show their source on Linux, as the
     spec's assumptions allow.
  5. **A system notification can be sent on Linux** from the app. **Fallback:** notifications are
     toasts inside the app only.
- [x] **Step 2: Run them**: `cargo nextest run -p uraeda-app --test outside`. Expected: PASS. A
      check whose fallback is taken is rewritten to test the fallback, and marked so. The five
      passed, each in a GTK window on a hidden display of its own, and no fallback was taken.
- [x] **Step 3: Write each result as a ruling**, with what later tasks must do: R21 to R26.
- [x] **Step 4: Commit**: `test(nsh-migration): check NSH's unverified behaviours`.

## Task 3: The protocol

**Files:**

- Create: `crates/protocol/src/{lib,message,change,diff,registry,typescript}.rs`,
  `crates/protocol/examples/types.rs`, `specs/2026-11-10-nsh-migration/contracts/protocol.md`,
  `app/store/protocol.d.ts` (generated), `fixtures/protocol/{messages,changes}.json`
- Test: `crates/protocol/tests/roundtrip.rs`, `crates/protocol/tests/types.rs`

**Interfaces:**

- Produces:
  - `PROTOCOL: u32`, the version.
  - `enum ClientMessage { Hello, Sub, Unsub, Call, Resume }` and
    `enum ServerMessage { Welcome, Refused, Data, Change, Result, Error }`, as JSON, with
    `enum SignIn { Cookie, Token(String) }`, `enum Refusal`, and `enum ErrorCode`.
  - `fn handshake(first: &str) -> Result<SignIn, ServerMessage>`: the sign-in of a `hello` of this
    version, or the `refused` or the `error` to answer before closing (ruling R29).
  - `enum Op { Set, Append, Insert, Remove, Move }`, each with a path into the value: a step is a
    field's name or an item's `id` (ruling R27).
  - `fn apply(value: &mut serde_json::Value, ops: &[Op]) -> Result<(), ApplyError>`.
  - `fn diff(old: &Value, new: &Value) -> Vec<Op>`, which emits `Append` when a string only grew,
    and list operations keyed by each item's `id`.
  - `trait Record` and `trait Action`, with a name, typed arguments, and a typed value;
    `catalog() -> Catalog`, the list of every one declared, with `Catalog::record::<R>()`,
    `action::<A>()`, `records()`, and `actions()`; and `vp run protocol:types`, which writes
    `app/store/protocol.d.ts` from it (ruling R28).
  - `fixtures/protocol/`: each message's JSON, and pairs of values with the change between them, for
    the tests of anything that applies a change.

- [x] **Step 1: Write the failing tests**
  - `a change applied to the old value gives the new value`: for a table of pairs,
    `apply(old, diff(old, new))` equals `new`. Rows: a string that grew, a list with an insert, a
    removal, a move, a nested record.
  - `a string that only grew is one append`: the break it catches is a whole-value resend on each
    chunk of a reply.
  - `every message survives JSON`.
  - `a hello of another version is refused, naming the side to update`: the break is two versions
    that talk on, each reading the other wrong.
  - `a declared record and action are typed for the client`, and `the client's types are fresh`.
- [x] **Step 2: Run them**. Expected: FAIL, `apply` not found.
- [x] **Step 3: Implement the crate and write the contract.** `contracts/protocol.md` holds each
      message with an example, the handshake, sequence numbers, `Resume`, and the error codes. A
      list's items must carry an `id`: `diff` falls back to `Set` when one does not.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the protocol's messages and changes`.

## Task 4: `ura serve`, the server's skeleton

**Files:**

- Create:
  `crates/server/src/{lib,start,run,shared,stop,http,guard,status,handoff,env,clock,secret}.rs`,
  `crates/server/src/http/{socket,open}.rs`, `crates/cli/src/serve.rs`
- Test: `crates/server/tests/skeleton.rs`, `crates/server/tests/support/{mod,client,request}.rs`,
  `crates/cli/tests/serve.rs`

**Interfaces:**

- Consumes: `ClientMessage`, `ServerMessage`, `PROTOCOL`, `handshake` (task 3).
- Produces:
  - `ura serve [--port N] [--data-dir DIR]`. Its default port, 4320, and its default data folder,
    the core's with `-next` after its name, differ from the Node server's (ruling R32).
  - `pub struct Server`, `Server::start(Options) -> Result<Server, NotStarted>`,
    `Server::stop(self)`, and `uraeda_server::run(Options)`, which `ura serve` calls. `Options` has
    `port`, `config_dir`, `data_dir`, `folder`, `environment`, `allow_origins`, and `clock`.
  - How a domain joins the server (ruling R33): a function
    `mount(&Shared, &mut Routes) -> Result<(), Failure>`, and its line in `DOMAINS`, in `lib.rs`. It
    adds routes with `Routes::route`, provides its state with `Shared::provide` for
    `Shared::get::<T>()`, and registers what stops with the server with `Shared::on_stop`. `Shared`
    also gives `now()`, `environment()`, `data_dir()`, `config_dir()`, `epoch()`,
    `from_host(headers)`, `allowed_hosts()`, `allow_hosts(names)`, and `stopping()`.
  - The test helper `support::server().await -> TestServer`, and `support::setup()` for a start that
    differs, with `connect().await -> TestClient` speaking the real protocol on temporary config and
    data folders, `get`, `post`, and `request` for plain HTTP, and a clock the test sets. Every
    later server test uses it.
  - The status file, `run/server.json` in the data folder, and the second-start handoff,
    `POST /open`, as [`open.ts`](/packages/server/src/open.ts) does today (ruling R34).
  - `Environment`, the server's environment with the config folder's `.env`, whose `command` starts
    every process the server runs (ruling R35); `guard::refusal` and `guard::frame_secret` (ruling
    R36); `secret::random` and `secret::same`, for tokens.

- [x] **Step 1: Write the failing tests**
  - `an older client is refused with the side to update`: a `Hello` with `PROTOCOL - 1` gets
    `Refused { reason: "client-too-old" }`.
  - `a request with another site's Origin is refused`: the break is DNS rebinding, guarded today by
    `guard.ts`.
  - `a second start hands over to the first`.
  - `secrets come from the config folder's .env only`: a `.env` in a project or in the folder the
    server runs in is never read; the config folder's joins the server's environment, and so reaches
    the agents it runs.
  - `stopping the server stops what its domains registered`: the contract every later domain hangs
    its shutdown on.
  - In the CLI's tests, `serve runs until it is stopped and a second start hands over`: the real
    `ura serve`, its signal, and the `.env` of the folder it runs in.
- [x] **Step 2: Run them**. Expected: FAIL, `Server` not found.
- [x] **Step 3: Implement.** `axum` on `tokio`, loopback only. `/live` upgrades to a WebSocket and
      handles `Hello` only; other messages get `Error { code: "not-signed-in" }` until task 5. Port
      `guard.ts`'s rules as they are.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): ura serve, with its handshake and guard`.

## Task 5: Sign-in and device pairing

**Risky:** it decides who reaches a server that runs code as the owner.

**Files:**

- Create:
  `crates/server/src/sign_in/{mod,check,store,listeners,cookie,date,once,routes,pairing,devices}.rs`,
  `crates/protocol/src/devices.rs`, `crates/cli/src/pair.rs`
- Test: `crates/server/tests/sign_in.rs`, and `pair_shows_a_code_that_pairs_one_device` in
  `crates/cli/tests/serve.rs`

**Interfaces:**

- Consumes: `Server`, `TestServer` (task 4).
- Produces:
  - HTTP: `GET|POST|DELETE /session`, `DELETE /sessions`, `GET /session/{token}`, as today, and
    `POST /session/key` for the host.
  - `POST /pair { code, name } -> { token, id }`; `POST /pair/code` for the host; and `ura pair`,
    which prints a one-time code and a QR code (ruling R43).
  - `sign_in::check(&Shared, &HeaderMap, &SignIn) -> Result<Identity, Refusal>`: the check of a
    `hello`, by the cookie of the request that opened the connection, or by the token it gives.
  - `sign_in::require(&Shared, &HeaderMap) -> Result<Identity, Refusal>`: the check of a request, by
    its cookie, or by a device's token as `Authorization: Bearer <token>`. A layer over every route
    calls it, so a handler takes `Identity` as an argument and never calls it itself (ruling R39).
  - `Identity`, with `kind()`, `id()`, `has_ended()`, and `ended().await`, which a connection awaits
    beside its messages: it ends when the session signs out or the device is revoked. The live
    engine's loop awaits it, and an action reads the identity as `call.caller()` (ruling R51).
  - `sign_in::OPEN`: the one list of the routes open without a session. Every other route answers
    401, so a new route is closed until it is listed there.
  - The record `Devices` and the actions `devices.revoke` and `devices.rename`, typed in
    `crates/protocol/`, with their logic in `sign_in::devices`: `list`, `revoke`, `rename`, and
    `on_change`. `sign_in::mount` registers them with the live engine's `Registry`, and tells the
    `Bus` at each change of the list (rulings R44 and R51).
  - `secret::Hashed`, the only form a secret is kept in, and `sign_in::link`, `sweep`, `on_ended`,
    and `first_key` (rulings R40 to R42).
  - In the tests' support: `TestServer::connect` pairs a device and signs in with its token, and
    `key`, `sign_in`, `pair`, `pairing_code`, `browser_socket`, and `restart` are there for the
    rest.

- [x] **Step 1: Write the failing tests**
  - `a paired device signs in until it is revoked`, with rows: a code works once; a second use is
    refused; the token signs in over the WebSocket; a revoked token's open connection closes; a
    device whose clock is a year off still pairs and signs in.
  - `every route but the open ones refuses a request without a session`: walks the router's routes,
    so a new route is closed by default.
  - `a wrong key is slowed, never locked out`.
  - `a device's list follows a pairing and a revocation`, over `/live`, written when the live engine
    was joined (ruling R51): a subscriber of `Devices` sees a device pair, be renamed, and go.
  - The cases of the Node server's sign-in tests, as five more tests: the key and signing out, 30
    days without use, a one-time link, a new key, and what the sign-in file holds.
  - Breaks to make, since the task is risky: skip the check on `/live`; compare tokens without
    constant time; store a token unhashed. Each must fail a test.
- [x] **Step 2: Run them**. Expected: FAIL, `/pair` answers 404.
- [x] **Step 3: Implement.** Keep `sign-in.json`'s present fields and add `devices`. A pairing code
      lives 10 minutes, in memory. Tokens are 32 random bytes, stored as hashes.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): sign-in, and pairing a device`.

## Task 6: The live engine

**Files:**

- Create: `crates/server/src/live/{mod,registry,fault,key,bus,topic,subscription,socket}.rs`,
  `crates/server/src/records/mod.rs`
- Test: `crates/server/tests/live.rs`

**Interfaces:**

- Consumes: `Record`, `Action`, `diff`, `apply`, `Op`, `catalog` (task 3); sign-in's `check` and
  `Identity` (task 5). `http/socket.rs` gives the identity it welcomed to `live::serve`, as
  `Caller::new(identity, ended)`: the engine closes the connection when the sign-in ends, and an
  action reads who calls as `call.caller()` (rulings R49 and R51).
- Produces, in `uraeda_server::live` (rulings R46 to R51):
  - `Registry::record::<R>(read)` and `Registry::action::<A>(run)`: how a domain registers itself. A
    handler is a plain function, run on a blocking thread:
    `read: Fn(&Shared, R::Args) -> Result<R::Value, Fault>` and
    `run: Fn(&Call, A::Input) -> Result<A::Output, Fault>`, where `Call` has `shared()`, `bus()`,
    and `caller()`. `live::wait(future)` runs a future to its end from a handler.
  - `Fault`, a handler's error: a code of the protocol and a message. The core's errors convert with
    `?` and keep their code. `Fault::refused`, `conflict`, `internal`, and `new` make others.
  - `Bus::changed::<R>(&args)`: a domain says a record changed; the engine reads it again, diffs it
    against what its subscribers hold, and sends `Change`. A record's key is its arguments.
    `Bus::changed_all::<R>()` says it of every record of a name.
  - `Bus::append::<R>(&args, path, at, text)`: a growing text changes without a read. `at` is the
    text's length in bytes before it grew.
  - The `Registry` and the `Bus` are `shared.get::<Registry>()` and `shared.get::<Bus>()`, for every
    domain mounted after `live::mount`, the first of `DOMAINS`.
  - `records/mod.rs`: the list of the domains that are only records and actions, each a line
    `mod <domain>;` and a line in `DOMAINS`, for a file with
    `register(&Shared, &Registry) -> Result<(), Failure>` (ruling T99.3).
  - `Connection`, a client's side of the engine with no socket, for a test that sets the clock.
  - Sequence numbers per record, shared by its subscribers, and `Resume`.
  - Updates of one record are sent at most once per 16 ms; the latest wins.
  - The test `every_declared_record_and_action_is_served_and_no_other`, which compares the
    `Registry` with `catalog()` both ways.

- [x] **Step 1: Write the failing tests**, with a test record `Counter`
  - `a subscriber gets the value, then only changes`.
  - `two clients acting at once end equal`: both call an action on one record; both end with the
    same value and both get a `Result`.
  - `a resume after a drop gets what it missed`: the break is a gap in a reply.
  - `a burst of updates is sent as one change`.
  - `an error names what it answers and why`, and
    `every declared record and action is served and no other`.
  - `an action knows who calls`, written when sign-in was joined (ruling R51).
- [x] **Step 2: Run them**. Expected: FAIL, `Registry` not found.
- [x] **Step 3: Implement.** One task per connection; a slow client never blocks another. A
      subscriber more than 1,000 changes behind gets the whole value again.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): subscriptions and changes`.

## Task 7: Records: workspace

Follows [what every records task does](#what-every-records-task-does).

- **Files:** `crates/server/src/records/workspace.rs` and `workspace/`,
  `crates/server/src/records/watch.rs` and `watch/files.rs`, `crates/protocol/src/workspace.rs` and
  `workspace/`, and its test, `crates/server/tests/workspace.rs`
- **Records:** Repositories, FolderSuggestions, SlugProposal, Workspace, NeedsYouList, Themes,
  Settings
- **Actions:** `repositories.*`, `settings.*`
- **Produces, for every other domain** (rulings R52 to R57):
  - `records::repositories::find(&Shared, name) -> Result<Repository, Fault>`: the listed repository
    of a name, whose `path` is its main checkout. With it, `all`, `label`, `reload`, and
    `on_change`.
  - `records::settings::current(&Shared) -> Settings`: the settings in force.
  - The server's one file watcher, `records/watch.rs`. A domain adds one line to `FILES_CHANGED`,
    for `fn files_changed(bus: &Bus, repository: &str, changes: &Changes)`, called after each burst
    of changes in a repository, with the core's `Changes`; or to `CONFIG_CHANGED`, for
    `fn(&Shared)`, called after each change of the settings file or the themes folder.
  - A record of one repository takes `{ repo }`, the repository's name. A protocol type named
    `…View` is the core's view, turned with `views::sent`.
  - A feature's status is `workspace/status.rs`, from the step alone until the sessions (task 15).
- [x] **Done**: `feat(nsh-migration): records of the workspace`

## Task 8: Records: features

Follows [what every records task does](#what-every-records-task-does).

- **Files:** `crates/server/src/records/features.rs` and `features/`,
  `crates/protocol/src/features.rs` and `features/`, and its test, `crates/server/tests/features.rs`
  and `features/`
- **Records:** Feature, WorkflowFile, ProposalFile, Priorities, ProposalHints, Inbox, Ledger,
  History, BranchDecision, BranchChanges, AllBranchChanges, WorkflowMessage, RecommendedMessage.
  `Dropped` and `StartPlan` are what `feature.drop` and the starts answer, not records, and
  `ContinuedAll` goes with `feature.continueAll`, to task 15 (ruling R58).
- **Actions:** `inbox.*`, `proposals.*`, `priorities.*`, `feature.*` but `feature.continueAll`,
  `change.*`, `item.settings`
- **Produces, for the screens and the later tasks** (rulings R58 to R62):
  - A record of a repository takes `{ repo }`, and a record of one thing of it `{ repo, id }`: a
    feature's folder, a file's `<folder>/<name>`, a proposal file's path. `WorkflowMessage` takes
    `{ repo, folder, trigger }`. A record of something that is not there has the value `null`.
  - `WorkflowFile`'s value is the core's `FileView`, with its `Document` as the core writes it. A
    protocol type that is a view of the core keeps the core's name.
  - A write of the lists answers `ListWritten { hash, change }`, `NoteMoved { change }`, or
    `FileWritten { path, change }`: the hash to write over next, the proposal file to open, and the
    change an undo writes back, an `UndoChange`.
  - `Trigger`, what starts a workflow turn, and the workflow's message text,
    `records/features/messages/text.rs`, which the sessions' runs use.
  - A feature's own run options, `records/features/options.rs`, kept in `run-options.json` of the
    data folder.
  - `files_changed(&Bus, &str, &Changes)` and `config_changed(&Shared)`, for the one watcher.
- [x] **Done**: `feat(nsh-migration): records of features`

## Task 9: Records: writing

Follows [what every records task does](#what-every-records-task-does).

- **Files:** `crates/server/src/records/writing.rs` and the folder beside it (`queue`,
  `queue/repository`, `review`, `rounds`, `text`, `buffer`, `undo`),
  `crates/protocol/src/writing.rs`, and its tests in `crates/server/tests/writing.rs`
- **Records:** Buffer, WriteQueue. `Undo` is no record: it is what `undo.apply` and `undo.committed`
  answer (ruling R63).
- **Actions:** `review.*`, `settled.*`, `defaultRound.*`, `answer.save`, `answers.submit`,
  `notes.save`, `text.*`, `buffer.save`, `commit.retry`, `undo.*`, `writes.dismiss`
- **Its own rule:** this task owns the write queue: one writer per repository, in order, as the Node
  server has it. Its test `two writes on one repository land in order` guards that.
- **Produces**, for every domain that writes to a repository (ruling R64):
  `records::writing::write(&Shared, repository, Write, run) -> Result<T, Fault>`, where `run` is
  `FnOnce(&Path) -> Result<T, Fault>` on the repository's main checkout, and `Write` is
  `Write::saving()`, `Write::of_feature(folder)`, or `Write::of_lists()`, with `.file(name)` and
  `.named(Option<WriteName>)`. It also produces `files_changed(&Bus, repository, &Changes)`, for the
  one watcher.
- **Left to later tasks** (ruling R65): the refusal of a feature's write while its agent works, for
  task 15, and the parts of the Node queue that only starts, sessions, and git use.
- [x] **Done**: `feat(nsh-migration): records of writing`

## Task 10: Records: git

Follows [what every records task does](#what-every-records-task-does).

- **Files:** `crates/server/src/records/git/`, a folder, `crates/protocol/src/git.rs`, and its test
  `crates/server/tests/git.rs`
- **Records:** GitPage, GitSummary, GitDiff, GitCommit, GitHistoryPage, ConflictFile
- **Actions:** `git.*`
- **As built** (rulings R66 to R68): every record and action takes `repo`, the repository's name; a
  diff is asked with `{ repo, folder, commit, path, whole }`; the items of the page's lists carry an
  `id`; an action answers nothing but `git.saveConflict`; the fetcher runs as the server starts and
  every 5 minutes. A write takes its repository's turn in `git/queue.rs`, which stands in for task
  9's write queue. Nobody works in a checkout until task 15 answers `git/working.rs`'s two
  functions, marked `TEMPORARY:`.
- [x] **Done**: `feat(nsh-migration): records of git`

## Task 11: The session store, and its import

**Risky:** it changes the format of stored session data, and reads the old one.

**Files:**

- Create: `crates/server/src/runner/{mod,event,schema,store,session,turn,log,import}.rs`,
  `crates/server/src/runner/import/{old,lines}.rs`, `crates/cli/src/import_sessions.rs`
- Test: `crates/server/tests/runner_store.rs`, `crates/cli/tests/import_sessions.rs`,
  `fixtures/runner/old.sqlite`, written by `fixtures/runner/write-old.ts`

**Interfaces:**

- Produces, in `uraeda_server::runner` (rulings R69 to R74):
  - `Store::open(data_dir) -> Result<Store, StoreError>`, the only code that opens
    `sessions.sqlite`. `runner::mount` provides it: `shared.get::<Store>()`.
  - `Store::append(turn_id, at, &Event) -> Result<Appended, StoreError>`: `Appended` has the event's
    `seq`, its place in its turn's log from 0, and for a `textDelta`,
    `text: Some(Growth { start, at })`, the `seq` of the text's first piece and the text's length in
    bytes before this one, for `Bus::append`.
  - `Store::log(turn_id, from: u64) -> Result<Vec<Logged>, StoreError>`: the events from a place,
    each a `Logged { seq, at, event }`.
  - `Store::session(id)`, `Store::turns(session_id)`, `Store::create_session(NewSession, at)`,
    `Store::add_turn(NewTurn, at)`, and `Store::close()`. A time is a `SystemTime` the caller gives,
    `shared.now()`. Task 15 adds the other writes beside them, through `Store::read` and
    `Store::write`.
  - `Session`, `Turn`, `TurnKind`, `TurnState`, and `ContinueReason`, the rows as the store keeps
    them.
  - `enum Event`, the events of `AgentEvent` in
    [`events.ts`](/packages/server/src/runner/events.ts), unchanged in meaning and in JSON, and
    three the runner logs: `message`, `denial`, and `allowed`. Read one with `Event::parse`.
  - `ura import-sessions [--from DIR] [--data-dir DIR] [--replace]`, a one-time tool, removed after
    the port (the inbox already asks for it), which copies sessions, transcripts, and chat images
    from the Node server's `runner.sqlite`, through `runner::import(from, &store, now, Replace)`.

- [x] **Step 1: Write the failing tests**
  - `a transcript reads back as it was written`, across a close and an open.
  - `an old store imports with every session and event`, on a fixture written by the Node server.
  - `a store of a newer schema is refused, untouched`.
  - Also: `a piece of text says where its text started and how long it was`;
    `any sequence of events reads back equal and a log from a place is its tail`;
    `an imported session keeps its place and runs nothing by itself`;
    `an import keeps the old store and never runs twice by mistake`;
    `an import refuses a store it cannot read and imports nothing`;
    `the server opens the store and closes it as it stops`; and the command's own test.
  - Breaks made, each failing a test: the order of events in a turn lost; one kind of item dropped
    in the import; a newer schema opened.
- [x] **Step 2: Run them**. Expected: FAIL, `Store` not found.
- [x] **Step 3: Implement**, with `rusqlite` and a numbered schema. A transcript is an append-only
      log per turn, so `Bus::append` and `Store::log(from)` serve a resume without a full read. See
      the rulings on the store's format, R69 to R73.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the session store and its import`.

## Task 12: The runtime contract, and the fake runtime

**Files:**

- Create: `crates/server/src/runtimes/{mod,fake}.rs`
- Test: `crates/server/tests/runtimes.rs`

**Interfaces:**

- Consumes: `Event` (task 11).
- Produces: `trait Runtime` with `name`, `capabilities`, `open(Options) -> Box<dyn AgentProcess>`,
  `has_session`, `allow_rule`, `version`, `models`; and `trait AgentProcess` with `events`, `send`,
  `interrupt`, `kill`, `take_back`, `set_effort`, `close`. These mirror the adapter of
  [`extension-api.ts`](/packages/server/src/extension-api.ts), so a VM extension can implement the
  same contract in task 17. The fake runtime plays a script of events, for tests and the sandbox.

- [ ] **Step 1: Write the failing test** `the fake runtime plays its script, and stops when told`.
- [ ] **Step 2: Run it**. Expected: FAIL.
- [ ] **Step 3: Implement** the traits and the fake.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the runtime contract and a fake runtime`.

## Task 13: The Claude runtime

**Files:**

- Create: `crates/server/src/runtimes/claude.rs` (task 13), `crates/server/src/runtimes/codex.rs`
  and `codex_rpc.rs` (task 14)
- Test: `crates/server/tests/claude.rs`, `crates/server/tests/codex.rs`, with recorded streams in
  `fixtures/runtimes/`

**Interfaces:**

- Consumes: `Runtime`, `AgentProcess` (task 12).
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

## Task 14: The Codex runtime

As task 13, for Codex: `crates/server/src/runtimes/codex.rs` and `codex_rpc.rs`, tested in
`crates/server/tests/codex.rs` on recorded streams. It ports
[`codex.ts`](/packages/server/src/runner/codex.ts) and `codex-rpc.ts`, and produces
`runtimes::codex()`. Its steps and tests are task 13's, with Codex's streams.

- [ ] **Step 1: Write the failing tests**, as task 13's.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the task's validation**, then one manual run against the real CLI. Expected:
      PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the codex runtime`.

## Task 15: Sessions

**Files:**

- Create: `crates/server/src/runner/{manager,status,continuer}.rs`,
  `crates/server/src/records/sessions.rs`
- Test: `crates/server/tests/sessions.rs`

**Interfaces:**

- Consumes: `Store` (11), `Runtime` (12), `Bus` (6), and the MCP endpoint's `Mcp` (16).
- Fills what task 16 left to the sessions (ruling R76):
  - The tools `run_agent` and `review`: `shared.get::<Mcp>().serve(runner)`, with an
    `Arc<dyn mcp::Runner>`, whose `run_agent(&self, session: &str, input: RunAgent) -> Answer` and
    `review(&self, session: &str, input: Review) -> Answer` do what
    [`sub-sessions.ts`](/packages/server/src/runner/sub-sessions.ts) and
    [`reviews.ts`](/packages/server/src/runner/reviews.ts) do. The endpoint has checked the
    arguments, and drops the `Answer` when the call is cancelled or its connection drops.
  - A process's token: `Mcp::issue(session)` as its process starts, given to it with `mcp::url`, and
    `Mcp::revoke(token)` as it closes.
  - `files::images::in_a_message`, which keeps `DELETE /r/:name/chat-images/:id` from deleting an
    image a sent message holds, and `files::attach::writable`, which refuses an upload to a feature
    an agent works on. Both are marked `JOIN(wave 6)`.
  - The cleanup of the chat images no message holds, a day after they were written, as
    `ChatImages.clean` does as the Node server starts: `files::chat_images` has no such function
    yet.
- Produces: records Agent, Session, SessionList, SessionSearch, Turn, TurnLog; actions `session.*`
  and `agent.refreshModels`; turn states and session statuses as
  [`events.ts`](/packages/server/src/runner/events.ts) and `status.ts` name them; automatic
  continues, as the [run lifecycle](../decisions/run-lifecycle.md) decision says.
- **Finishes what task 8 left to the sessions** (ruling R61), each at a `// TASK 15:` comment of
  [`records/features/`](/crates/server/src/records/features/):
  - `feature.continueAll`, with its answer `ContinuedAll`: not declared yet, it is all runs.
  - `Feature`: its `session`, `sessions`, `runtime`, and `newPick`, empty until then, the fields
    `agent` and `tokens`, which it lacks, and its status from its sessions (`status.rs`).
  - `RecommendedMessage`: whether the feature's runtime takes the message, taken as available.
  - `feature.start` and `feature.startText`: the messages kept for the planned folder while the
    start lands, sent to its session once it landed.
  - `change.start`, `change.startProposal`, and `change.fromNote`: the started change's first run,
    whose session they answer, and the check of run options no new session could run on.
  - `feature.drop`: the feature's sessions held while it lands, and archived after.
  - `feature.promote`: the change's sessions moved to the feature, and its first run.
  - The writes of this domain are not refused while an agent works on their feature.

- [ ] **Step 1: Write the failing tests**, on the fake runtime
  - `a streaming reply reaches a subscriber as appends`: no `Set` of the whole log.
  - `a session survives a server restart, and continues when the decision says so`.
  - `stopping a turn ends it as stopped`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** `TurnLog` changes through `Bus::append`. Port the continuer's rules as
      they are.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): sessions and their turns`.

## Task 16: Files, uploads, and the agents' MCP endpoint

**Files:**

- Create: `crates/server/src/files/{mod,repository,raw,images,chat_images,attach,change}.rs`,
  `crates/server/src/mcp/{mod,tokens,tools,endpoint}.rs`
- Test: `crates/server/tests/files.rs`, `crates/server/tests/mcp.rs`

**Interfaces:**

- Produces, under `/r/:name`, each closed: `GET /raw/*`, `GET /mockups/*`, `GET /images/*`, `GET`
  and `DELETE /chat-images/:id`, `POST /attach`, `POST /inbox/note-image`, as
  [`files.ts`](/packages/server/src/files.ts) and `attach.ts` have them. A mockup's path holds no
  frame secret until task 18 (ruling R77).
- Produces `/mcp`, open to the session check and closed by its own per-process tokens, as `mcp/` has
  it (ruling R75): `shared.get::<Mcp>()` with `issue(session)`, `revoke(token)`, and
  `serve(runner)`, the trait `mcp::Runner` for the tools `run_agent` and `review`, which task 15
  fills, and `mcp::url(&shared)` (ruling R76).

- [x] **Step 1: Write the failing tests**: `a raw path cannot leave its repository`;
      `an upload     comes back as the image it was`; `the MCP endpoint refuses a wrong token`.
- [x] **Step 2: Run them**. Expected: FAIL, 404.
- [x] **Step 3: Implement**, porting each route and its checks.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): files, uploads, and the MCP endpoint`.

## Task 17: The VM for extensions' server parts

**Risky:** it runs the owner's code inside the server, and must never take the server down.

**Files:**

- Create: `crates/server/src/extensions/{mod,loader,vm,api,watch}.rs`,
  `crates/server/src/records/extensions.rs`
- Test: `crates/server/tests/extensions_vm.rs`, `fixtures/extensions/`

**Interfaces:**

- Consumes: `Registry`, `Bus` (6); `Runtime` (12); `compileModule` in
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

## Task 18: Previews

**Files:**

- Create:
  `crates/server/src/preview/{mod,frames,checkout,runner,ports,command,groups,index,warm,upstream,proxy}.rs`,
  `crates/server/src/records/previews.rs`, `crates/protocol/src/previews.rs`
- Test: `crates/server/tests/preview.rs`, on the fake Storybook of
  [`fixtures/preview/serve.mjs`](/fixtures/preview/serve.mjs)

**Interfaces:**

- Produces (rulings R79 to R83):
  - Records `Preview { repo, folder }`, `Story { repo, id }`, and `StoryHref { href }`; action
    `preview.restart { repo, folder }`, which answers the `Preview`. `folder` is a feature's or a
    change's folder, or `main`; a story's `id` is `<folder>:<path>#<export>`.
  - The proxy at `/r/:name/preview/<secret>/<folder>/*`, HTTP and WebSocket, as
    [`preview/proxy.ts`](/packages/server/src/preview/proxy.ts) has it. A client shows the path a
    record gives it, `Preview.base` or `Story.frame`, on the server's address: it never builds one.
  - The frame secret: `preview::frame_secret(&Shared)` and `preview::is_frame(&Shared, path)`, for
    previews and mockups alike, and `Open::Frame` in `sign_in::OPEN`, for a route open with it.
  - `preview::files_changed(&Shared, repository)`, for the one watcher to call;
    `preview::repository_removed(&Shared, name)`, for the action that removes a repository; and
    `preview::sweep(&Shared)`.

- [x] **Step 1: Write the failing tests**: `the server stops every preview command when it stops`
      (the stack decision's rule); `a preview path without its secret is refused`.
- [x] **Step 2: Run them**. Expected: FAIL.
- [x] **Step 3: Implement**, porting the runner's rules.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): previews and their proxy`.

## Task 19: Extension pages: built, signed, served

**Risky:** a client runs what this task signs.

**Files:**

- Create: `crates/server/src/extensions/{pages,signing}.rs`
- Test: `crates/server/tests/extension_pages.rs`

**Interfaces:**

- Consumes: the loader and watcher (task 17); the result of task 2's first check, which holds:
  ruling R22 names the signing calls, and why a page's build number only grows. Ruling R23 asks the
  build to make a post of `start` the page's first statement.
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

## Task 20: The parity list, and the server's sandbox

**Files:**

- Create: `crates/server/tests/parity.rs`, `crates/server/parity.toml`,
  `crates/server/src/sandbox.rs`, `crates/cli/src/sandbox.rs`
- Modify: `AGENTS.md` (the sandbox's command)

**Interfaces:**

- Consumes: every record and action of tasks 7 to 19.
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

## Task 21: The native module

**Files:**

- Create: `crates/app/src/native.rs` (the list of the module's exports), `crates/app/src/about.rs`
  (`version()`)
- Modify: `crates/app/src/lib.rs`, which task 1 made with an empty `uraeda/native`, and
  `crates/app/Cargo.toml`
- Test: `app/native.test.ts`, through `nsh test`, and `crates/app/tests/native.rs`

**Interfaces:**

- Produces: the NSH native module `uraeda/native`, which TSX imports. It starts with `version()`:
  `import { version } from "uraeda/native"`. Later tasks add to it: the Vim layer's bridge (30),
  highlighting and diagrams (31), the app's native components (34, 36). See NSH's Rust-modules
  pages, and ruling R30 for how a task adds an export:
  - its Rust goes in a file of its own, `crates/app/src/<part>.rs`, named in `lib.rs`, with one line
    in `register` of `crates/app/src/native.rs`, whose comment says the rest;
  - functions are a unit struct with `#[module]` and its `impl` with `#[module(flat)]`: TSX imports
    each `pub(crate) fn` by its name in camel case;
  - TypeScript's types come from Rust's, written by `vp run app:check` in
    `app/.nsh/types/uraeda/native.d.ts`;
  - every export has a doc comment, its documentation in TypeScript:
    `every_export_is_documented_for_typescript` fails without one.

- [x] **Step 1: Write the failing test** `TSX calls a function of the module`, through `nsh test`.
- [x] **Step 2: Run it**. Expected: FAIL, `uraeda/native` has no `version`. It failed with
      `Could not find export 'version' in module 'uraeda/native'`.
- [x] **Step 3: Implement** the module. `app/nsh.json` names the crate since task 1.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the app's native module`.

## Task 22: The Vim layer

**Files:**

- Create: `crates/vim/src/`, one small module per part: `lib` (the public types), `state` (the state
  between keys, and the layer's doors), `command` (the keys of a command, and `SUBSET`), `key`,
  `text` (lines, positions, one replacement), `walk` and `word` (Vim's word motions), `motion`,
  `pair` (brackets), `object`, `tag`, `select` (objects in visual mode), `operator`, `edit`
  (`J ~ r p P`), `insert`, `visual`, `register`, `search`, `repeat` (`.`), `out` (a key's edits)
- Test: `crates/vim/tests/keys.rs`, `crates/vim/tests/cases.toml`

**Interfaces:**

- Produces, as built
  ([ruling R31](rulings.md#r31-the-vim-layer-follows-neovim-reads-lines-and-leaves-undo-and-the-clipboard-to-its-caller)):
  - `struct Vim`, `Vim::key(&mut self, key: Key, text: &TextView) -> Vec<Edit>`, pure: it reads a
    text and a selection, and returns edits and selection changes. It never touches an editor. One
    `Vim` serves every field, with `Vim::reset()` when the focus moves.
  - `enum Key { Char(char), Escape, Enter, Backspace, Ctrl(char) }`, and `keys("d2w<Esc>")` for
    Vim's notation.
  - `struct TextView<'a> { text: &'a dyn Text, anchor: Position, head: Position }`. `trait Text` is
    `line_count()` and `line(index) -> Cow<str>`, so a rope gives its lines without a copy, and
    `Lines::new(&str)` is a `Text` for a caller that has one string. `Position { line, column }`
    counts the column in UTF-16 code units, as NSH's `EditorPosition`.
  - `enum Edit { Replace { start, end, text }, Select { anchor, head }, Undo, Redo, Clipboard(String), ReadClipboard, Pass }`.
    A call returns one `Replace` at most, a range of the text as it was, then `Select` in the text
    after it: one transaction, one step of undo. `Undo` and `Redo` are the editor's own, followed by
    `Vim::sync(&TextView)`. `Clipboard` is a text to write to the system clipboard, `ReadClipboard`
    a request answered with `Vim::clipboard(&str, &TextView) -> Vec<Edit>`. `Pass` leaves the key to
    the field: every key but Escape in insert mode, which the editor types, and Escape and Enter in
    normal mode.
  - `Vim::sync(&mut self, text: &TextView) -> Vec<Edit>`, for a selection or a text changed outside
    the layer: a selection made with the pointer becomes visual mode.
  - `enum Mode { Normal, Insert, Visual, VisualLine, Replace, OperatorPending }` with
    `Mode::label()`, and `Vim::status(&self) -> Status { mode, pending }` for the status line.
    `Replace` is `r` waiting for its character.
  - The subset, which the text-editing decision names, as the constant `SUBSET`:
    - motions `h j k l w b e W B E 0 ^ $ gg G f F t T ; , % { }`, with counts;
    - operators `d c y > <`, doubled for a line, with `D C Y x X s S r J ~ p P`;
    - text objects `iw aw iW aW ip ap i" a" i' a' i( a( i[ a[ i{ a{ it at` and their backtick form;
    - `v` and `V`, with `o`;
    - registers: unnamed, `"a`–`"z`, `"0`, and `"+` for the system clipboard;
    - `/ ? n N * #`, `.`, `u` and `Ctrl-r`, `i a I A o O`.
  - Out for now: Ex commands, macros, marks, block visual.

- [x] **Step 1: Write the failing tests**: `cases.toml` holds one row per behaviour, as text before,
      keys, and text after, with `|` for the caret. `every case gives its text` runs them all. Write
      at least one row per item of the subset, and the rows `d2w deletes two words`,
      `2dw deletes     two words`, and `a yank reaches the system clipboard`. The break each row
      catches is its own behaviour. `every key of the subset has a case` and
      `a key outside the subset does nothing` hold the table and `SUBSET` together.
- [x] **Step 2: Run them**. Expected: FAIL, `Vim` not found.
- [x] **Step 3: Implement.** Start from the spike's `src/vim.rs`, which already handles counts
      before and after an operator. A count repeats the motion, then the operator runs once, so one
      undo step undoes it. The spike gave editor commands and read no text; the layer reads the
      text, so its motions and objects are Vim's own, ported from Neovim's source where they are
      subtle.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the Vim layer`.

## Task 23: The client store

**Files:**

- Create: `app/store/{connection,records,actions,index}.ts`
- Test: `app/store/store.test.ts`

**Interfaces:**

- Consumes: `app/store/protocol.d.ts`, with its type `Protocol`, and `fixtures/protocol/` for the
  store's own `apply` (task 3); `ura sandbox` (task 20) for its tests.
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

## Task 24: Routes and per-device storage

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
- [ ] **Step 3: Implement.** No browser API here: task 57 binds the history to the browser's.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): routes and per-device storage`.

## Task 25: The design language's samples

**Files:**

- Create: `app/gallery/samples/` (eight rendered samples)
- Modify: [`specs/ui/design-language.md`](/specs/ui/design-language.md), where a sample proves a
  value wrong

**Interfaces:**

- Consumes: the [design language](/specs/ui/design-language.md), written with the spec from a study
  of LazyVim, Zed, Hyprland, and Linux desktop setups, and its
  [browser mockup](mockups/design-language.html), which is the reference for how each sample should
  look. Its values were tuned in a browser, not on GTK.
- Produces: the same language, with its values proven on GTK, which tasks 26 to 33 follow.

- [ ] **Step 1: Render eight samples** in a throwaway gallery page, in both themes: every height
      nested in every other; a pane at rest beside a focused one, each with its border round its
      title; a glass bar over a scrolling transcript; buttons and keycaps in every state; a dialog
      over a dimmed page; a list with a selected row and its bar; the status line; and a session
      with an agent running. Take their pictures on GTK, on an invisible display, with the
      screenshot script of the spike's `tools/`.
- [ ] **Step 2: Check each against the language's own tests**: text over glass meets the contrast
      floor over the busiest page; the glass bar over the scrolling transcript costs under 8.3 ms a
      frame at the 99th percentile; nothing in a sample moves unless a state just changed, but a
      view's one main action.
- [ ] **Step 3: Compare each picture with the mockup, and correct the language's values** where a
      sample fails a test or drifts from the mockup. Say which in the commit. Change a value, never
      a rule: where a rule cannot be drawn on GTK, keep the nearest look that passes the tests, and
      write a ruling.
- [ ] **Step 4: Take the open choices as written**, each behind its token, as ruling R13 says.
- [ ] **Step 5: Commit**: `docs(nsh-migration): the design language's samples`. Keep the pictures in
      `target/shots/samples/`, for the pull request, never in the repository.

## Task 26: Tokens, themes, and fonts

**Files:**

- Create: `app/ui/tokens/`, `app/ui/theme.ts`, `crates/app/src/theme.rs`
- Modify: the core's theme reader, for the new roles
- Test: `crates/app/tests/theme.rs`

**Interfaces:**

- Consumes: the design language (task 25); the record Themes (task 7).
- Produces: `applyTheme(theme)`, which maps a theme's roles onto NSH's tokens; the roles for glass
  and glow; bundled fonts, with no file loaded from another host; `tokens`, the only source of
  colours, radii, blur, and glow for `app/ui/`; `tokens.height[name]`, one set per height: fill,
  border, shadow, blur, tint, and glow.

- [ ] **Step 1: Write the failing tests**: `every shipped theme meets the contrast floors` (4.5:1
      for text, 3:1 for borders, as today); `a theme without the new roles inherits them`;
      `a     broken theme never blocks the others`.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** Themes stay one TOML file each. A role missing from a user's theme
      comes from the default of its mode.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): tokens, themes, and fonts`.

## Task 27: Surfaces

**Files:**

- Create:
  `app/ui/surfaces/{Surface,Glass,Glow,Pane,Well,Overlay,Sheet,Popover,Dialog,Toast,Tooltip}.tsx`,
  `app/ui/surfaces/glass.wgsl`

**Interfaces:**

- Consumes: `tokens` (task 26).
- Produces: the components named above.
  - `Surface` takes `height: "recessed" | "standard" | "raised" | "overlay"`, and draws that
    height's fill, border, shadow, glass, and glow from `tokens.height`. It is the only component
    that draws a shadow or glass: every other one is built on it, and none sets its own.
  - `useHeight()` gives the height a component sits on, from a context `Surface` sets, so a control
    picks its contrast and a nested surface its look.
  - `Glass` draws native glass or backdrop blur where the platform has it, and the shader elsewhere:
    on GTK today. No caller knows which. A later iOS client maps a height to the system's material
    here, and nowhere else.

- [ ] **Step 1: Build `Glass` first, and measure it.** Write the shader from the design language's
      [glass recipe](/specs/ui/design-language.md#glass), reading the sources it links first: the
      frost from one shared quarter-size copy, the bent edge, the colour fringe, the rim, and the
      care it asks for square corners. The spike's shader is the starting file. Put it over the
      spike's scrolling transcript: the frame cost must stay under 8.3 ms at the 99th percentile on
      GTK. If it does not, drop parts in the order the recipe gives, not the budget.
- [ ] **Step 2: Build `Surface`, then the others on it**, each following
      [surfaces](/specs/ui/surfaces.md) and the design language. `Well` is the recessed one, `Pane`
      the standard one, and every overlay sits at `overlay`. A sheet rises from the bottom on a
      narrow window; a menu stays a popover at every width, as the UI layout decision says.
- [ ] **Step 3: Add each to the gallery**, in its states, with one page that shows every height
      inside every other.
- [ ] **Step 4: Run the task's validation**: `vp run app:check`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): surfaces, with glass and glow`.

## Task 28: Controls

**Files:**

- Create: `app/ui/controls/`: Button, IconButton, Switch, Segmented, Select, Checkbox, Radio,
  NumberInput, Badge, Banner, Spinner, Progress, StatusDot, Kbd, Tabs, Menu, Breadcrumbs, Divider,
  Icon, Link, Heading, Text

**Interfaces:**

- Consumes: `tokens` (26), surfaces (27).
- Produces: one component for each Astryx component the React UI imports, listed in
  [`packages/web/`](/packages/web/)'s imports of `@astryxdesign/core`, built on `nsh/base`'s
  unstyled parts where one exists.

- [ ] **Step 1: Build each control**, with its keyboard behaviour and its 44-point touch target on a
      narrow window. Buttons and keys follow the design language's
      [buttons and keys](/specs/ui/design-language.md#buttons-and-keys): a lamp, tubes, and chips,
      with their variants behind `key.look` and `button.main.look`. `Kbd` is the one key. Icons are
      Lucide, and Codicons for harness marks, as today.
- [ ] **Step 2: Add each to the gallery**, in every state: rest, hover, focus, pressed, disabled.
- [ ] **Step 3: Run the task's validation**. Expected: PASS.
- [ ] **Step 4: Commit**: `feat(nsh-migration): controls`.

## Task 29: Lists, cards, tables, and trees

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

## Task 30: The text field

**Files:**

- Create: `app/ui/text/{TextField,Composer,PickerField,SaveStatus,LeaveGuard}.tsx`,
  `crates/app/src/vim_bridge.rs`, `app/ui/text/unsaved.ts`
- Test: `app/ui/text/text.test.tsx`

**Interfaces:**

- Consumes: `Vim` (task 22); `uraeda/native` (21); `device` storage (24); the setting for Vim.
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
      screen asks. The caret's trail is a `<Shader>` over the field, fed the caret's box before and
      after a move from the editor's `caret_bounds`, as the design language's
      [motion](/specs/ui/design-language.md#motion-means-a-change-of-state) says.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the shared text field, with Vim`.

## Task 31: The document renderer

**Files:**

- Create: `app/ui/document/{Document,Blocks,Spans,Table,Code,Diagram}.tsx`,
  `crates/app/src/{highlight,diagram}.rs`
- Test: `app/ui/document/document.test.tsx`

**Interfaces:**

- Consumes: the core's document tree, from the record WorkflowFile; the result of task 2's diagram
  check, which holds: Pele draws in NSH's VM, and `crates/app/src/diagram.rs` makes its SVG one
  NSH's images draw, as ruling R25 says.
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

## Task 32: Keys

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

## Task 33: The layout shell

**Files:**

- Create: `app/ui/layout/{Page,Panes,SideColumn,Rail,StatusLine,NavBar,BottomBar,width}.tsx`

**Interfaces:**

- Consumes: surfaces, controls, `route` (24).
- Produces: the app's frame at the three width classes of the UI layout decision: narrow below 768,
  semi-wide from 768, wide from 1280. `width: Signal<"narrow"|"semi-wide"|"wide">`.

- [ ] **Step 1: Build the frame**, following [wide](/specs/ui/wide.md),
      [semi-wide](/specs/ui/semi-wide.md), and [phone](/specs/ui/phone.md). Read the window's width
      after the first layout: at the first render it is 0, which chose the wrong layout in the
      spike.
- [ ] **Step 2: Add it to the gallery**, at each width.
- [ ] **Step 3: Run the task's validation**. Expected: PASS.
- [ ] **Step 4: Commit**: `feat(nsh-migration): the layout shell`.

## Task 34: Extension pages in the client

**Files:**

- Create: `crates/app/src/extension_view.rs`, `app/extensions/{page,host,ExtensionPlace}.tsx`,
  `fixtures/extensions/{counter,throws,loops}/`
- Test: `app/extensions/extensions.test.tsx`

**Interfaces:**

- Consumes: `/extensions/:name/page` and its key (task 19); the record Extensions (17); the result
  of task 2's first two checks, which hold: ruling R22 names the calls that verify and load a
  package, and ruling R23 how the host hears a page's errors, from the engine's log, and knows the
  page from the thread.
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

## Task 35: The gallery

**Files:**

- Create: `app/gallery/{App.tsx,pages/}`, `app/tools/{shots,frames}.ts`
- Modify: `vite.tasks.ts`

**Interfaces:**

- Consumes: every component of tasks 26 to 34.
- Produces: `vp run gallery` (the gallery on GTK); `vp run gallery:shots` (a picture of every
  component, in both themes, at three widths, on an invisible display); `vp run frames` (the frame
  cost of a named scene, as median, 95th, 99th percentile, and worst).

- [ ] **Step 1: Assemble the gallery**: one page per component, and three scenes: a session with
      20,000 messages streaming, the same scrolling by itself, and a glass panel over it.
- [ ] **Step 2: Write the two tools**, from the spike's `tools/` and its self-scrolling switch. They
      never open a window on the human's display.
- [ ] **Step 3: Run `vp run frames`** on the three scenes. Expected: at most 8.3 ms at the 99th
      percentile. Record the numbers in the commit's body.
- [ ] **Step 4: Review every picture yourself**, against the design language and its mockup, and fix
      what drifts. Then ask a second reviewer, with no part in building the library, to compare the
      pictures with the design language, and fix what it finds.
- [ ] **Step 5: Commit**: `feat(nsh-migration): the component gallery`. Keep the pictures in
      `target/shots/gallery/`, for the pull request.

**Phase 1: the Linux app.** Every screen, on the component library, as a Linux app on GTK, then its
package. It starts once the gallery (task 35) is done.

## Task 36: The app's shell

**Files:**

- Create: `crates/app/src/bin/uraeda.rs` (the Linux host), `crates/app/src/server_start.rs`,
  `app/App.tsx`, `app/screens/{routes.tsx,shell/,sign-in/,repository/}`, `app/tools/shots.ts`
- Test: `app/screens/shell/shell.test.tsx`
- Read: [`App.tsx`](/packages/web/src/App.tsx), `Shell.tsx`, `shell/`, `sidebar/`,
  `sign-in/SignInPage.tsx`, `RepositoryPages.tsx`

**Interfaces:**

- Consumes: the layout shell (33), the store (23), routes (24), `ura serve` and pairing (4, 5).
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

## Task 37: Home and priorities

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

## Task 38: Proposals, and starting work

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{proposal,new}/`
- **Read:** `pane/ProposalPane.tsx`, `ProposalEditor.tsx`, `NewPage.tsx`, `StartDialog.tsx`,
  `NewFeatureComposer.tsx`
- **Records and actions:** ProposalFile, StartPlan, SlugProposal, FolderSuggestions; `proposals.*`,
  `feature.start`, `feature.startText`, `change.start`, `session.new`
- **Routes:** `/priorities/<key>` as an overlay or a page, `/new?kind=session|change|feature`
- **Tests:** `leaving an edited proposal asks first, and keeps the text`.

## Task 39: Inbox and triage

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{inbox,triage}/`
- **Read:** `InboxPage.tsx`, `pane/EntryPane.tsx`, `TriagePage.tsx`, `attach/`
- **Records and actions:** Inbox, Dropped; `inbox.*`
- **Routes:** `/inbox`, `/inbox/<key>`, `/inbox/triage`
- **Its own rules:** an image is added by drop, by paste, and by a picker, and uploaded through
  `POST /r/:name/inbox/note-image`.
- **Tests:** none: using the screen shows every behaviour.

## Task 40: The feature page

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/feature/`
- **Read:** `feature/FeaturePage.tsx` and its panes
- **Records and actions:** Feature, Ledger, History, WorkflowMessage, RecommendedMessage;
  `feature.*`
- **Routes:** `/f/<folder>`, `/f/<folder>/runs/<id>`
- **Tests:** none.

## Task 41: Workflow files

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/file/{DocumentPage,SpecPage,PlanPage,DataModelPage}.tsx`
- **Read:** `FilePage.tsx`, `spec/`, `PlanPage.tsx`, `DocumentPage.tsx`,
  `decisions/BranchDecision.tsx`
- **Records and actions:** WorkflowFile, BranchDecision, BranchChanges
- **Routes:** `/f/<folder>/<file>`, `/f/<folder>/decisions/<name>`
- **Consumes also:** `Document` (task 31).
- **Its own rules:** a file is drawn from the core's document tree. The spec page keeps its review
  tab, its decision cards, its history, and what changed since the last review.
- **Tests:** none.

## Task 42: Rounds and reviews

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

## Task 43: Sessions

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/session/{SessionsPage,SessionPage,Transcript,Composer,Permission}.tsx`
- **Read:** `shell/SessionsPage.tsx`, `SessionPage.tsx`, `SessionView.tsx`, the `Transcript*` and
  `Composer*` files, `session/`
- **Records and actions:** SessionList, SessionSearch, Session, Turn, TurnLog, Agent; `session.*`
- **Routes:** `/sessions`, `/sessions/<id>`, `/f/<folder>/session`
- **Consumes also:** `Reply` (31), `VirtualList` (29), `TextField` (30), `text()` (23).
- **Its own rules:** the transcript opens at its newest message and follows it while a reply
  streams, unless the reader scrolled away. Each message has its own signal. A reply is drawn as
  blocks. Images are attached through `POST /r/:name/attach`.
- **Tests:** `a streaming reply stays in view`; `a reader who scrolled up is not moved`;
  `a message typed during a reply is sent once`.
- **Extra step, before the commit:** run `vp run frames session` on a session of 20,000 messages.
  Expected: at most 8.3 ms at the 99th percentile, streaming and scrolling.

## Task 44: Session panels and runs

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/session/panels/`, `app/screens/runs/`
- **Read:** `session/` (activity, changes, subagents, start steps), `runs/` (run map, strip,
  sub-sessions)
- **Records and actions:** Session, Turn, BranchChanges, AllBranchChanges; `session.allow`,
  `session.allowAll`, `session.toChange`
- **Tests:** none.

## Task 45: Decisions

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/decisions/`
- **Read:** `decisions/DecisionsPage.tsx`, `decisions/CheckPage.tsx`
- **Records and actions:** Workspace, WorkflowFile; the decisions check's actions
- **Routes:** `/decisions`, `/decisions/<name>`, `/decisions/constitution`, `/decisions/check`
- **Its own rules:** the list sits beside the reader when there is room. The sort is kept per
  device.
- **Tests:** none.

## Task 46: Git

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/git/`
- **Read:** `git/GitPage.tsx`, `git/Diff.tsx`, `git/ChangesTree.tsx`
- **Records and actions:** GitPage, GitSummary, GitDiff, GitCommit, GitHistoryPage, ConflictFile;
  `git.*`
- **Routes:** `/git`
- **Its own rules:** the page is shaped like lazygit. Diffs use NSH's diff view, styled through
  `app/ui/`.
- **Tests:** `a commit holds exactly the staged files`.

## Task 47: Editors

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{editor,buffer,conflict}/`
- **Read:** `EditorPage.tsx`, `buffer/BufferPage.tsx`, `fields/editor/` (the merge-conflict bar)
- **Records and actions:** Buffer, ConflictFile; `buffer.save`, `text.*`, `git.saveConflict`
- **Routes:** `/edit/<path>`, `/buffer/<path>`
- **Tests:** `a file changed on disk while it is edited is not overwritten silently`.

## Task 48: Settings

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

## Task 49: Previews

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/preview/{MockupPage,StoryPage,LiveFrame}.tsx`,
  `app/ui/surfaces/WebFrame.tsx`
- **Read:** `LiveFrame.tsx`, `LiveWindow`, `StoryFrames.tsx`, `StoryEmbed.tsx`, `MockupPage.tsx`
- **Records and actions:** Preview, Story, StoryHref; `preview.restart`
- **Routes:** `/f/<folder>/mockups/<name>`, `/f/<folder>/storybook`, `/storybook`
- **Consumes also:** the result of task 2's web-view check, which holds: ruling R24.
- **Its own rules:** `WebFrame` is the only component that shows a web page: a web view on GTK, a
  frame on the web. A preview's address carries its frame secret.
- **Tests:** none.

## Task 50: Notifications, undo, and writes

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/shell/{Notifications,Undo,Writes}.tsx`
- **Read:** `notify/`, `undo/`, `writes/` (the commit toast and the write queue),
  `fields/LeaveGuard`
- **Records and actions:** NeedsYouList, Undo, WriteQueue; `undo.*`, `writes.dismiss`,
  `commit.retry`
- **Consumes also:** the result of task 2's notification check, which holds: ruling R26 names the
  call, and asks for `crates/app/src/notify.rs`.
- **Its own rules:** the app asks for notifications only after saying why, and never again after a
  refusal. `u` and `Ctrl+Z` undo, `U` and `Ctrl+Shift+Z` redo, on a stack of the last 50 actions. An
  undoable action never asks to confirm.
- **Tests:** `undo puts back what the action changed`.

## Task 51: Built-in extensions, and extension places

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/extensions/builtins/` (decisions, git, inbox, priorities, sessions, notifications,
  previews), `app/screens/extension/`, `docs/extensions.md`
- **Read:** [`extensions/builtins/`](/packages/web/src/extensions/builtins/),
  `extensions/routes.tsx`, [`docs/extensions.md`](/docs/extensions.md)
- **Routes:** `/e/<name>/<rest>`
- **Consumes also:** the page API and `uraeda.extension` (task 34).
- **Its own rules:** each built-in place is declared through the same page API as the owner's, and
  can be turned off. A built-in's screen is the app's own code, linked in: only its declaration goes
  through the API. See the ruling on built-ins.
- **Extra step:** rewrite `docs/extensions.md` for the new API: the folder, `extension.toml`, the
  server API, the page API, what a page may import, and limits. A session must be able to write an
  extension from it alone.
- **Tests:** `turning a built-in off removes its place, and the app goes on`.

## Task 52: The sandbox, and a walk through the app

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

## Task 53: Performance

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

## Task 54: Packaging and release

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

## Task 55: Parity

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

## Task 56: The web build, served by `ura serve`

**Files:**

- Create: `crates/server/src/http/web.rs`, `app/web/` (the page that hosts the app)
- Modify: `vite.tasks.ts`, `.github/workflows/`
- Test: `crates/server/tests/web.rs`

**Interfaces:**

- Consumes: the app (phase 1); `sign_in` (task 5).
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

## Task 57: Browser behaviour

**Files:**

- Create: `app/store/history.web.ts`, `app/web/manifest.webmanifest`
- Modify: `app/ui/surfaces/Glass.tsx`, `app/ui/surfaces/WebFrame.tsx`,
  `app/screens/shell/Notifications.tsx`
- Test: `app/web/web.test.ts`, run in a headless browser

**Interfaces:**

- Consumes: `route`, `navigate`, `back` (task 24).
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

## Task 58: Extension pages in the browser

**Files:**

- Create: `app/extensions/host.web.tsx`
- Test: `app/web/extensions.test.ts`

**Interfaces:**

- Consumes: the page API and its host channel (task 34); `/extensions/:name/page` (task 19).
- Produces: the web form of `uraeda.extension`: each page runs in NSH's player, in a frame of its
  own, with the same page API and the same theme.

- [ ] **Step 1: Write the failing tests**: the four tests of task 34, run in a headless browser.
- [ ] **Step 2: Run them**. Expected: FAIL.
- [ ] **Step 3: Implement.** Read NSH's web page on players first. What the spike found: a page in a
      frame without an origin runs one app, and is loaded again to run another; the frame's files
      need cross-origin headers. A frame is not a security boundary here, and need not be: an
      extension is the owner's own code.
- [ ] **Step 4: Run the task's validation**. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(nsh-migration): extension pages in the browser`.

## Task 59: The phone

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

## Task 60: Web performance

**Files:**

- Modify: `app/tools/frames.ts`, `app/tools/navigation.ts` (a `--web` form of each)

**Interfaces:**

- Produces: the two benchmarks of task 53, run in a headless browser, at a phone's size with the
  processor slowed four times.

- [ ] **Step 1: Run both benchmarks** on the sandbox, and on a session with a very long reply.
- [ ] **Step 2: Compare with the spike's numbers**: 57 frames a second streaming, 37 scrolling.
      Expected: no worse, and no frame over 100 ms while a long reply streams.
- [ ] **Step 3: Fix what misses**, then run them again and record the numbers in the commit's body.
- [ ] **Step 4: Run `vp run ready`**. Expected: PASS.
- [ ] **Step 5: Commit**: `perf(nsh-migration): the web build on a slow phone`.

## Task 61: Remove the React UI and the Node server

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

- [ ] **Step 1: Leave the human's data alone.** `ura import-sessions` is theirs to run once, after
      the build: say how in `INSTALL.md`. Nothing more is built for upgrades: the human is the only
      user.
- [ ] **Step 2: Delete the old code**, as the spec's
      [replaced behaviour](spec.md#replaced-behaviour) lists it, with its tests.
- [ ] **Step 3: Update every page a reader meets**: what Uraeda is, how to install it, how to build
      and test it, the web UI's page in `docs/`, and the guides of `specs/ui/` that named Astryx or
      the browser.
- [ ] **Step 4: Run `vp run ready`, and a release to a test tag.** Expected: PASS, and artifacts
      with no Node in them.
- [ ] **Step 5: Commit**: `feat(nsh-migration)!: remove the React UI and the Node server`.
