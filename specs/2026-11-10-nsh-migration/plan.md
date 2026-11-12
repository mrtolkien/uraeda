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

| Phase         | Tasks        | Ends with                                          |
| ------------- | ------------ | -------------------------------------------------- |
| 0, core       | 1–35, 62–64  | A Rust server, a client core, and a gallery        |
| 1, Linux, GTK | 36–55, 65–66 | The Linux app, packaged, at parity                 |
| 2, web        | 56–61        | The web build, and the React and Node code removed |

iOS and macOS are not in this plan. Nothing here may close them off: see
[global constraints](#global-constraints).

**Caught up with the default branch on 2026-11-11.** While the plan was built, two features and a
round of fixes merged there: [several accounts](../done/2026-11-10-multi-accounts.md) for one agent,
[scheduled jobs](../done/2026-11-10-scheduled-jobs.md) with their Jobs place, a run a usage limit
refused going on at once on another account, and fixes to the screens the human uses every day. The
branch is rebased on them, and the plan gains four tasks, 62 to 65, and new rules in the screens'
tasks: see [what makes a screen good](#what-makes-a-screen-good) and ruling R124.

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

- **This is a rewrite: do what is right.** The human ruled on 2026-11-11 that, for this feature, the
  decisions are "more guidelines than rules", and that implementers have "some freedom to do what
  they think is right to make a great UI and high code quality". The old screens, the guides, the
  plan's file lists and names, and a decision's rule say where to start, not where to end: a task
  may depart from any of them for a better screen or simpler, sounder code, and says so in a ruling,
  with what it left and why the result is better. Three things stay binding: a direct request of the
  human, the constitution, and what protects the owner, which is sign-in, loopback, hashed secrets,
  extensions loaded only from the config folder, and the safety of stored data.
- **Tests pull their weight, and stay fast.** A test is kept for what it would catch: a guarantee
  that is costly to lose and that using the app would not show. It runs on a fake, a fixed or paused
  clock, and temporary folders, never on a sleep, a real agent, or the network. A test that is slow,
  that fails by timing, or that only pins how the code is written is fixed or removed, with a
  ruling, by the task that meets it: development speed is a goal of this rewrite, and a suite nobody
  wants to run guards nothing.
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
- **Out of validation: the old UI and the Node server.** No task, no wave, and no final pass runs
  `ts:test`, `web:build`, `ui:build`, `ui:smoke`, `storybook:build`, or `web:theme`, at any point,
  the end included, and so never `vp run ready`, which runs them. They prove nothing about the new
  code, and cost every run (rulings R111 and R122).
- **No task loads the machine, or runs a test in a loop**, to reproduce a failure of timing. A test
  that fails while other builds saturate the machine is rerun once it is quiet, at most twice: when
  it passes then, it passed, and a ruling names it.
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

- **Every check is a recipe of the [`justfile`](/justfile)**, run in the dev shell:
  `nix develop -c just <recipe>`. No task runs `vp`, `pnpm`, or `node`: the new stack needs none of
  them, and a new worktree needs no install (ruling R122).
- **A task's validation**, unless it says otherwise: `just task <its crates>` for Rust, which checks
  formatting, runs Clippy, and runs the crates' tests; `just task-app` for the app, which checks
  formatting, lints the TSX, and runs `just app-check` and `just app-test`. A task that changes both
  runs both.
- **After a wave's merge**: `just check`, which is `cargo check --workspace --all-targets` and
  `just app-check`, in the background. The next wave starts at once, without waiting for them. A
  failure, like a review's finding, goes to a fixer that works beside the next wave. A wave is held
  only when the merged code does not build, or an interface the wave consumes is wrong.
- **The full pass** is `just ready`. It runs once, at the end of the feature, in task 61's last
  step, and before the push.
- **The checks of `crates/app/tests/outside.rs`** draw in real windows, and are retried twice, in
  `.config/nextest.toml`.

### What every records task does

Tasks 7 to 10 each port the records and mutations of one domain from
[`packages/server/src/fate/`](/packages/server/src/fate/), keeping their names, and call the core
function the binding wraps today. Each adds its line `mod <domain>;` and its line in `DOMAINS` to
`records/mod.rs` (ruling R86), and removes its names from `NOT_BUILT` in
`crates/server/tests/live.rs` if they are there.

- Consumes: `Registry`, `Bus`, `Fault`, `Call` (task 6, whose section and
  [`live/mod.rs`](/crates/server/src/live/mod.rs) show a whole domain); the core's functions.
- Produces: its records and actions, typed in `crates/protocol/`, each with its line in `catalog()`
  and the client's types written again by `just protocol-types`, and their rows in task 20's list.

1. **Write the failing contract tests**: one test per record, `<Record> answers its shape`, on the
   fixtures in [`fixtures/`](/fixtures/); and one per action that writes git or a stored file,
   asserting what a later read shows. Reuse the cases of the Node server's tests for that domain,
   which name what is costly to lose.
2. **Run them**. Expected: FAIL, `unknown record`.
3. **Implement the domain's module**, and wire the core's `watch` to `Bus::changed` for its records,
   as [`live.ts`](/packages/server/src/live.ts) maps them today.
4. **Run the task's validation**. Expected: PASS.
5. **Commit**: `feat(nsh-migration): records of <domain>`.

### What every screen task does

Tasks 37 to 51, and 65, each port one area of the React UI. They share one shape, so each task below
lists only what differs: its files, the old code to read, its records and actions, and its own
rules.

**Shared interfaces:**

- Consumes: `app/ui/` (tasks 26 to 33), `record`, `call`, `text` (task 23), `route` and `navigate`
  (task 24), `registerKey` (task 32), and the records and actions of its area (tasks 7 to 18).
- Produces: its screens, registered for their routes in `app/screens/routes.tsx`, each adding its
  own lines there.

**A screen is panes, not a page.** A screen task declares its kinds of pane with `definePane`, and
the panes of its routes with `definePlace` (task 33, and the panes guide, `specs/ui/panes.md`): it
never draws a side column or a tab bar of its own. Each pane draws well in either stack, at the
width its stack has, and keeps its scroll, its selection, and its unsaved text in the store or the
visit's entry, so a move or a hidden tab loses nothing. Each page it places gets one address in
`app/screens/shell/places.test.tsx`, which opens every place in turn and fails on a page without
one, or on a key that means two things once its panes are drawn.

**Shared steps:**

1. **Read the old screens and their guide.** The old code says what exists; the guides in
   [`specs/ui/`](/specs/ui/) and the design language say how it should look and behave. Where they
   disagree with the old code, the guides win. List what the old screen does, in the task's commit
   body, so the review can check nothing was lost.
2. **Write the tests the area names**, and no others: the testing decision keeps UI tests for
   behaviour that is costly to lose and that using the app would not show.
3. **Build the screens** from `app/ui/` only. A missing component is added to `app/ui/` and the
   gallery, never drawn in the screen. Declare the area's keys in the registry.
4. **Review each screen in the running app**, on `ura sandbox`, in both themes, at a narrow and a
   wide width, with `just app-shots <route>`. Fix what you see. One picture of each new screen goes
   in the pull request, none in the repository.
5. **Run the task's validation**: `just task-app`. Expected: PASS.
6. **Commit**: `feat(nsh-migration): <area>`.

### What makes a screen good

A port that copies the old screen's pixels also copies its mistakes. In the week this plan was
built, the human sent back a round of fixes to the React UI, each for something that hurt in daily
use. They are listed here with the complaint behind each, because the complaint is the rule: a
screen is judged by what its owner can do with it at the end of a long day, on a phone, with the
keyboard, not by whether it shows the right data.

Every screen task, and every component task, checks its work against these before its review step,
and says in its commit body how each applies:

1. **The thing done most is one tap or one key away, and nothing costly sits beside it.** "Adding
   notes on mobile is clunky. I clicked 'add a category' by mistake the first time I navigated
   there. It's the inbox: it should be accessible in one click." The inbox's add now comes first, as
   one row of icons beside the title, and "New category" comes after the notes. Name the one action
   a view exists for, give it the best place, and put rare or structural actions where a thumb does
   not land by mistake.
2. **An action that commits, starts a branch, or spends an agent's time is deliberate.** "Pressing
   enter when modifying the slug or body of a proposal starts it, which is often too early. Starting
   work should be deliberate since it starts a branch and makes commits." Enter in a field never
   starts work: only the Start button does, or `Ctrl+Enter` in the field whose whole purpose is the
   start. Saving text (`Ctrl+Enter`, `:w`) and starting work are never the same key in the same
   place.
3. **Show the whole thing, at the size it needs, with the one component that draws it.** Of the
   one-line strip of run options in the start dialog: "This should be a much bigger view, it's super
   hard to read. Should be the same as settings pretty much." Then: "Put the full map in the dialog,
   and make it almost full screen if necessary. Only one component to maintain that way." A cramped
   summary of something the human must read and decide on is a second component to keep right, and
   it is harder to read. Reuse the full one, and let the dialog grow to fit it.
4. **Several facts about one thing make a card, in the order things happened, with their times.**
   "Subagent sidebar should have start time, at least. Likely nicer cards. Also remove the commit
   hash from review agents' titles." A row of grey text hides which fact matters. A card has a title
   a person would say aloud, the state, and when it started and ended; lists of things that happen
   read in the order they happened, and follow their end as the activity does. Internal names,
   hashes, and ids stay out of titles.
5. **Every part of a screen is reached by the keyboard, with the keys the rest of the app uses.**
   "There's no way to navigate, focus, or move into the sidebar of a session with the keyboard." `l`
   now crosses into a session's column and `h` back, `j` `k` move through its rows, as on every page
   of columns. Before a screen is done, cross it without the pointer: every pane, every row, every
   action, and the way back. The status line names the keys that work where the focus is.
6. **A control moves the moment it is touched, and a refusal comes back to where the hand was.** The
   jobs' form was sent back until "a job's switch shows its value at once", "a form's changes are
   queued patches, and its controls move at once", and a refused value "shows under its field". The
   screen never waits for the server to show what the human just did: it shows it, sends it in
   order, and when the server refuses, puts the control back and says why under that control, in
   words that name the way out ("A time is from 00:00 to 23:59.").
7. **Take what a person types.** "A time typed as 3:00 is sent as 03:00." A field accepts the forms
   a person writes, and normalises them itself, before it ever refuses.
8. **Say what is true, and why not.** A job's card says "Next run: Tomorrow at 3:00", or why it does
   not run: "Paused", "Not running here: Claude Code is off in this repository." A session's header
   names the account it runs on now. A skipped time "names the change that blocked it", a run whose
   session is gone reads "Its session is gone." Times read in the server's time zone, whatever the
   device's. Never an empty space, a spinner with no end, or a state the human must guess: each
   state has its words, and the words name the cause.
9. **No dead end.** "Unticking the page's own repository says so, and offers the way back": the page
   tells what just happened and gives "Run it here again". After any action that takes the human's
   subject away from under them, the screen says where it went and how to return.
10. **A default the human can explain.** "How do we define the default model? Why is it Codex?" A
    default came from the order runtimes happened to register in. Now a setting names it, and the
    first agent on is the default when it is unset. Where the app chooses for the human, the choice
    follows a rule they can read in the settings, and stays the same from one start to the next.

The implementer of a screen uses it as its owner would before handing it over: from the sandbox, a
whole errand through that screen by keyboard, then the same by touch at a phone's width, in both
themes. What made them hesitate, look twice, or reach for the pointer is fixed, or written in the
commit body for the walk through the app (task 52).

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
- **Tests and checks**: the recipes of the [`justfile`](/justfile) run the new stack's checks
  (ruling R122). Until task 61, `vp run ready` ran every check ([`vite.tasks.ts`](/vite.tasks.ts)),
  the old UI's and the Node server's included, which this plan leaves
  [out of validation](#global-constraints); Rust tests run with `cargo nextest run`. The core has
  about 1,180 tests, the server about 960, the web UI about 1,000.
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
   Then [their join](#the-join-of-wave-6), alone.
7. Task 12, alone: the runtimes and the extension VM implement its contract.
8. Tasks 13, 14, 17: two runtimes and the extension VM.
9. Tasks 15, 19. Then tasks 62, 63, 64, added on 2026-11-11: accounts, scheduled jobs, and what else
   the Node server gained, in separate modules, each on the sessions of task 15.
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
20. Tasks 38, 41, 43, 47, 49, 65.
21. Tasks 42, 44, 50.
22. Task 51. Then task 66, alone: it moves every screen's panes.
23. Tasks 52, 53.
24. Task 54.
25. Task 55, alone. Then task 68, alone: Native Shell 0.5.0, before the web build.
26. Task 56, alone.
27. Tasks 57, 58: browser behaviour, and extension pages, in separate files.
28. Tasks 59, 60.
29. Task 61, alone.
30. Task 67, alone, last: what the default branch gained while the plan was built.

### The join of wave 6

The seven tasks of wave 6 were built without seeing each other, each with a copy of what it needed
of another, marked `JOIN(wave 6)`. The join gave each rule one home, and built what the stand-ins
dropped. Rulings R84 to R96 say what was decided. What later tasks use:

- **A repository by its name**:
  `records::repositories::find(&Shared, name) -> Result<Repository, Fault>`, and
  `records::repositories::path(&Shared, name) -> Result<PathBuf, Fault>` for its main checkout
  alone. With them `all`, `label`, `reload`, and `on_change`.
- **A write to a repository**, every one of them, through the write queue:
  - `records::writing::write(&Shared, repository, Write, run) -> Result<T, Fault>`, with
    `run: FnOnce(&Path) -> Result<T, Fault>`, in the repository's turn, on the caller's thread. The
    commits it defers land behind it.
  - `records::writing::land(&Shared, repository, Write, land) -> Result<Queued<T>, Fault>`, with
    `land: FnOnce(&Path, &Landing) -> Result<T, Fault> + Send + 'static`, on the queue's thread, in
    its place among the queued writes. `Queued::landed()` waits and leaves a refusal in the record;
    `Queued::answered()` waits and takes it out. `Landing` has `printed(line)`, `steps(steps)`, and
    `free_lists()`.
  - `Write::saving()`, `of_feature(folder)`, `of_lists()`, `of_main()`, and `unseen()`, with
    `.and_feature(folder)`, `.file(name)`, `.named(Option<WriteName>)`, `.or_named(label, href)`,
    and `.steps(steps)`.
  - The queue tells every domain after each write and each landing: an action says nothing more on
    the bus for what it wrote in a repository.
- **A domain's lines**, one each:
  - in `records/mod.rs`: `mod <domain>;`, its `register` in `DOMAINS`, and its
    `written(&Bus, repository)` in `WRITTEN`, which says every record of that repository it serves
    changed;
  - in `records/watch.rs`: `FILES_CHANGED` for `fn(&Shared, &str, &Changes)`, `CONFIG_CHANGED` for
    `fn(&Shared)`, and `REPOSITORY_JOINED` and `REPOSITORY_LEFT` for `fn(&Shared, &str)`.
- **The bus**: `Bus::changed_where::<R>(|args| ..)`, beside `changed` and `changed_all`.
- **The order of a connection's calls**: a call starts once the one before it took its place in the
  write queue or ended. An action that waits long without writing calls `live::placed()` first.
- **The protocol's shared types**, in `crates/protocol/src/shared/`: `RepositoryArgs`, the feature's
  view and status, the run options, `UndoChange`, `WriteName`, and `ChatImage`.
- **Other helpers**: `records::views::sent`, `records::workspace::status::of`,
  `records::settings::current` and `settings::options::{sent, given}`,
  `records::writing::undo::sent`, `live::locked`, `Store::holds_image`, `Environment::added`.
- **The tests' support**, `crates/server/tests/support/`: `fixture(path)`, `fixture_text(path)`,
  `fixture_repo(name)`, `Hook`, `read`, `call`, `Held`, `Live`, `idle(&server, repo)`, and
  `writes(&queue)`. A test's own commands, as a stand-in of `gh` or of an agent, are a folder given
  to `Setup::commands(dir)`: no test sets `PATH`, which holds a stand-in that fails for `claude`,
  `codex`, and `gh` (rulings R118 and R120).

Left for later tasks, each marked `TASK 15:`, `TASK 20:`, `TASK 51:`, or `TEMPORARY:` where it goes:
a feature's status from its sessions, the refusal of a write while an agent works, a start's first
run and kept messages, `feature.continueAll`, the MCP endpoint's `Runner`, the sandbox's locked
list, and the previews' warm-ups.

- [x] **Done**: thirteen rulings, R84 to R96, each with its commit.

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
    `action::<A>()`, `records()`, and `actions()`; and `just protocol-types`, which writes
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
    `register(&Shared, &Registry) -> Result<(), Failure>` (ruling R86).
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
    for `fn files_changed(shared: &Shared, repository: &str, changes: &Changes)`, called after each
    burst of changes in a repository, with the core's `Changes`; to `CONFIG_CHANGED`, for
    `fn(&Shared)`, called after each change of the settings file or the themes folder; or to
    `REPOSITORY_JOINED` and `REPOSITORY_LEFT`, for `fn(&Shared, &str)`, called as a repository joins
    or leaves the list (ruling R93).
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
  - A feature's start answers `StartPlan` once planned, and lands as a write of the queue, with its
    steps; a change's answers `ChangeStarted` once it landed (ruling R91).
  - `Trigger`, what starts a workflow turn, and the workflow's message text,
    `records/features/messages/text.rs`, which the sessions' runs use.
  - A feature's own run options, `records/features/options.rs`, kept in `run-options.json` of the
    data folder.
  - `files_changed(&Shared, &str, &Changes)` and `config_changed(&Shared)`, which the one watcher
    calls.
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
  `.named(Option<WriteName>)`. It also produces `files_changed(&Shared, repository, &Changes)`,
  which the one watcher calls.
- **Left to later tasks** (ruling R65): the refusal of a feature's write while its agent works, and
  the messages kept for a write, for task 15. The join built what starts and git use of the queue
  (rulings R89 to R91).
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
  every 5 minutes. A write lands in the write queue, under its `write` (ruling R90). Nobody works in
  a checkout until task 15 answers `git/working.rs`'s two functions, marked `TEMPORARY:`.
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

- Create: `crates/server/src/runtimes/{mod,options,events,registry,child,fake}.rs`,
  `crates/server/src/runtimes/fake/{script,process}.rs`, `crates/server/src/process.rs`,
  `crates/protocol/src/shared/runtime.rs`
- Test: `crates/server/tests/runtimes.rs`, `crates/server/tests/runtimes/child.rs`

**Interfaces:**

- Consumes: `Event` (task 11).
- Produces, in `uraeda_server::runtimes` (rulings R97 to R102):
  - `trait Runtime` with `name`, `kind`, `icon`, `capabilities`,
    `open(Options) -> Box<dyn AgentProcess>`, `has_session`, `allow_rule`, `version`, `models`, and
    `review_message`: plain functions, called on a blocking thread.
  - `trait AgentProcess` with `events`, `send`, `interrupt`, `kill`, `take_back`, `set_effort`, and
    `close`: each returns at once, from any thread.
  - These mirror the adapter of [`extension-api.ts`](/packages/server/src/extension-api.ts), with
    its JSON, so a VM extension implements the same contract in task 17.
  - `events() -> (Emitter, Events)`: a process's events, with no limit, ended by one `exit`.
  - `Runtimes`, the registry, `shared.get::<Runtimes>()`, and
    `register(&shared, name, runtime) -> Result<Registered, RuntimeError>`.
  - `Child::spawn(&shared, Spawn)`: an agent's process, in the server's environment, leading a group
    that ends with it and with the server.
  - `fake::Fake`, which plays `fake::Script`s of events, waits, and blocked actions, for tests and
    the sandbox.
  - A blocked action is a denial of its turn's `result`, allowed by a rule and a reopened process:
    the contract has no permission request (ruling R99).

- [x] **Step 1: Write the failing test** `the fake runtime plays its script, and stops when told`.
  - Also: `an interrupted process plays its next message`;
    `a kill ends the process with its signal's code and leaves no task`;
    `a message the agent has not read is taken back`;
    `a blocked action is a denial of its result until its rule is allowed`;
    `a very long reply streams in order and whole`;
    `a stream ends with one exit whatever its runtime did`; the registry's three; and, for an
    agent's process, its lines both ways, a command that cannot start, a signal that reaches
    everything it started, and the server's stop.
- [x] **Step 2: Run it**. Expected: FAIL.
- [x] **Step 3: Implement** the traits and the fake.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the runtime contract and a fake runtime`.

## Task 13: The Claude runtime

**Files:**

- Create: `crates/server/src/runtimes/claude.rs` and `claude/` (task 13: `args`, `folders`,
  `process`, `control`, `models`, `events`, `stream`, `system`, `results`, `tools`, `limits`,
  `wakeups`, `time`, `allow`, `json`), `crates/server/src/runtimes/codex.rs` and `codex_rpc.rs`
  (task 14)
- What the two built-in runtimes share is in `crates/server/src/runtimes/built_in.rs` and
  `built_in/{given,instructions,target}.rs`: the skill and the documentation written in the data
  folder, the app's instructions, what a tool call acts on, and an effort's name (ruling R119)
- Test: `crates/server/tests/claude.rs` and `claude/{stage,process,asked,real}.rs`,
  `crates/server/tests/codex.rs`, with recorded streams in `fixtures/runtimes/`, and the stand-ins
  of the machine's agents, in `crates/server/tests/support/machine.rs`: every test's server gets its
  `PATH` from `support::setup()`, and a test's own commands are a folder given to `Setup::commands`
  (ruling R118)

**Interfaces:**

- Consumes: `Runtime`, `AgentProcess` (task 12).
- Produces: the built-in runtimes `claude` and `codex`, each registered by `runtimes::mount` under
  its extension's name, which the owner turns off: `shared.get::<Runtimes>().get("claude")` (rulings
  R103 to R106). What the sessions rely on, for Claude Code:
  - **Every event comes from the process**: `accepted` once Claude Code read a message, `init` at
    each turn, with a `problem` when the skill did not load, `runsOn` as it opens and after each
    `set_effort`, and one `exit`, which `close()` brings once the turn is over. A message sent
    before `init` is read: the sessions need not wait.
  - **`Options::tools`**: `Tools::Uraeda { url, token }` gives the MCP endpoint, allows
    `mcp__uraeda__run_agent` and `mcp__uraeda__review`, and takes Claude Code's own sub-agents away;
    the token reaches the process as `URAEDA_MCP_TOKEN` only. `Tools::None` takes the sub-agents
    away alone.
  - **`Options::skills`** are folders `<extensions folder>/<name>/skills`.
  - **`Options::allowed`** are rules of `allow_rule`, given last, for that process only: a denial of
    a `result` runs once a process is opened with its rule and asked again (ruling R99).
  - **`set_effort` answers `true`**: the process changes its effort itself, from its next turn.
  - **A wakeup's and a limit's times** are read on the server's clock, `shared.now()`, in the zone
    `TZ` of its environment names.
  - **The command** is the `command` setting of the extension `claude`, read at each start.
  - **A message's id is new to the agent's session.** Claude Code 2.1.322 runs no turn for a message
    whose id its transcript already holds: a resumed session sent an old id again gets no `accepted`
    and no `result`.

- [x] **Step 1: Write the failing tests**:
      `a recorded stream becomes the same events as the Node     runner made`, on streams recorded
      from the real CLIs, compared with the events the Node code produces for them; and
      `a permission request waits for an answer`: a blocked action is a denial of its turn's
      `result`, which runs once its rule is in `Options::allowed` (ruling R99).
  - Also, for Claude Code: `closing a session leaves no claude process`;
    `a line cut inside a character is read with the half replaced`; a session's arguments, a
    workflow session's tools, an extension's skills as a plugin folder, a message as Claude Code
    reads it, a process's events and its exit, a missing command and a folder that is gone, what a
    process runs on and its effort, the models and their defaults, a list that fails or does not
    come, the version, a session that can be resumed, the allow rules, its own review, and that it
    is a built-in the owner turns off.
  - Breaks made, each failing a test: a group's signal sent to its leader alone; the allow rules
    left out of the arguments; a sub-agent's tool call without its parent.
- [x] **Step 2: Run them**. Expected: FAIL. Seen failing after the port, not before it: with the
      runtime's registration removed, every test failed, 20 of them on "the built-in runtime"; and
      each break above failed its test.
- [x] **Step 3: Implement**, porting [`claude.ts`](/packages/server/src/runner/claude.ts), or
      `codex.ts` and `codex-rpc.ts`. `child.ts` is ported already, as `runtimes::Child` (ruling
      R100): a child process leads its own process group, which ends with it and with the server.
- [x] **Step 4: Run the task's validation**, then one manual run against the real CLI, noted in the
      commit's body. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the claude runtime`, or `the codex runtime`.

## Task 14: The Codex runtime

As task 13, for Codex: `crates/server/src/runtimes/codex.rs` and the folder `runtimes/codex/`, one
small file per part (ruling R110), tested in `crates/server/tests/codex.rs` and `tests/codex/` on
the exchanges of `fixtures/runtimes/codex/` (ruling R107). It ports
[`codex.ts`](/packages/server/src/runner/codex.ts) and `codex-rpc.ts`, with what they import, and
produces `runtimes::codex::codex(&shared)`, which `runtimes::mount` registers as the built-in
`codex`. Its steps and tests are task 13's, with Codex's streams. What it shares with Claude Code's
runtime is in `runtimes/built_in/` (ruling R119).

What the sessions (task 15) rely on:

- The runtime is `shared.get::<Runtimes>().get("codex")`. `open` is called on a blocking thread,
  where tokio is.
- A process says one `init`, once its thread started: its `sessionId` is the thread's id, the native
  id to store and to resume by, with `has_session`. An `init` with a `problem` has an empty
  `sessionId`: the process runs no turn, and is closed.
- A message's `accepted` can follow its turn's `result`, when Codex ends a turn before it answers
  its start.
- After a turn that failed or was stopped, the messages still queued stay in the runtime: the
  sessions take each back, and get its `cancelled`.
- `set_effort` answers `true`: no process is reopened for an effort. A review is the message
  `review_message` gives, sent with `review` set, on a thread opened on the reviewer's effort.
- A result names no denial, and `allow_rule` gives no rule: Codex asks its own reviewer, whose
  verdict is a `notice` (ruling R109). `Options::allowed` is not read.
- `close` ends the process once its turn is over, with code 0. A process dropped has its stdin
  closed.

- [x] **Step 1: Write the failing tests**, as task 13's. They were written after the port, against
      the brief's order, and seen failing with the registration removed.
- [x] **Step 2: Run them**. Expected: FAIL. Seen failing after the port, not before it: with the
      runtime's registration removed, 19 of the 20 tests failed on "the built-in runtime".
- [x] **Step 3: Implement.**
- [x] **Step 4: Run the task's validation**, then one manual run against the real CLI. Expected:
      PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the codex runtime`.

## Task 15: Sessions

**Files:**

- Create:
  `crates/server/src/runner/{manager,live,processes,running,transcript,send,edits,picks, message,status,reads,continuer,chain,sub_sessions,reviews,starts,catch_ups}.rs`,
  the store's writes beside task 11's, `runner/{turns,waits,session_edits,page}.rs`,
  `crates/server/src/records/sessions/`, `crates/protocol/src/sessions.rs`
- Test: `crates/server/tests/sessions.rs` and `sessions/{messages,pages,tools,escalation,seams}.rs`

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
  - `files::attach::writable`, which refuses an upload to a feature an agent works on, marked
    `TASK 15`. The session store already answers whether a sent message holds a chat image,
    `Store::holds_image` (ruling R95).
  - The cleanup of the chat images no message holds, a day after they were written, as
    `ChatImages.clean` does as the Node server starts: `files::chat_images` has no such function
    yet.
- Produces: records Agent, Session, SessionList, SessionSearch, Turn, TurnLog; actions `session.*`
  and `agent.refreshModels`; turn states and session statuses as
  [`events.ts`](/packages/server/src/runner/events.ts) and `status.ts` name them; automatic
  continues, as the [run lifecycle](../decisions/run-lifecycle.md) decision says. As built (rulings
  R144 to R153):
  - `Session { repo, id }`, `Turn { repo, id }`, `TurnLog { repo, turn, page }`, pages of 100 items,
    each with an `id`, `SessionList { repo }`, `SessionSearch { repo, query }`, and
    `Agent { repo }`. A reply grows as an `append` at `["items", <id>, "text"]` of its page.
  - `runner::Runner::of(&shared)`, the sessions' manager, which `runner::serve`, the last of
    `DOMAINS`, starts; `runner::Sessions` is its state, `shared.get::<Sessions>()`.
  - The store at schema 2, with `Store::page`, `pages`, `page_of`, `blocked`, `edited_files`, and
    the turns', sessions', and continues' writes.
  - `records::writing::settled`, `working`, `Write::on_feature`, and `Write::on_path`.
- **Starts the catch-up runs on the pull requests' refresh** (ruling R120), which
  [`records/pulls.rs`](/crates/server/src/records/pulls.rs) runs: it asks `gh` for each listed
  repository as the server starts, as a repository joins the list, after a burst of the watcher that
  moved a branch, and every minute while a branch is past its last task, and the core keeps what it
  answered for every read of the workspace. The sessions add one line to its list `SETTLED`, marked
  `TASK 15:`, for `fn(&Shared, repository: &str)`: called on a blocking thread after each burst of
  the watcher, once the refresh it asked for ended, and after each other refresh that changed what
  is known. From there `api::read_workspace` of the repository gives each feature's `pull_request`
  and its step, `catch-up` with its `catch_up` when its branch is behind the default branch.
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

- [x] **Step 1: Write the failing tests**, on the fake runtime
  - `a streaming reply reaches a subscriber as appends`: no `Set` of the whole log.
  - `a session survives a server restart, and continues when the decision says so`.
  - `stopping a turn ends it as stopped`.
  - Also: a cut run that asks when its continue is off; a message steered or queued, taken back, and
    a blocked action allowed then tried again; `run_agent` and `review` through `/mcp`; an
    unanswered interrupt or close followed by signals at 10 second steps; a restart that never
    continues an imported run; a transcript by pages; and one test per seam closed.
- [x] **Step 2: Run them**. Expected: FAIL. Seen failing before the code:
      `no action is     session.newChat`.
- [x] **Step 3: Implement.** `TurnLog` changes through `Bus::append`. Port the continuer's rules as
      they are.
- [x] **Step 4: Run the task's validation**. Expected: PASS. Two tests of the runtimes' registry
      fail as they did before: they expect its names without the Codex built-in.
- [x] **Step 5: Commit**: `feat(nsh-migration): sessions and their turns`.

## Task 16: Files, uploads, and the agents' MCP endpoint

**Files:**

- Create: `crates/server/src/files/{mod,repository,raw,images,chat_images,attach,change}.rs`,
  `crates/server/src/mcp/{mod,tokens,tools,endpoint}.rs`
- Test: `crates/server/tests/files.rs`, `crates/server/tests/mcp.rs`

**Interfaces:**

- Produces, under `/r/:name`, each closed: `GET /raw/*`, `GET /images/*`, `GET` and
  `DELETE /chat-images/:id`, `POST /attach`, `POST /inbox/note-image`, as
  [`files.ts`](/packages/server/src/files.ts) and `attach.ts` have them; and
  `GET /mockups/<secret>/*`, open to a path with the frame secret, as `Open::Frame` (ruling R94).
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

- Create:
  `crates/server/src/extensions/{mod,loader,graph,vm,api,runtime,process,fs,fetch,events,routes,status,watch}.rs`,
  `extensions/vm/machine.rs`, `extensions/api/{guard,web,modules,prelude}.js`,
  `extensions/api/server.d.ts`, `crates/server/src/records/extensions.rs`,
  `crates/protocol/src/extensions.rs`
- Test: `crates/server/tests/extensions_vm.rs`, `extensions_vm/{broken,reach}.rs`,
  `fixtures/extensions/`

**Interfaces:**

- Consumes: `Registry`, `Bus` (6); `Runtime` (12); `compile` of
  [`crates/compile/`](/crates/compile/).
- Produces (rulings R221 to R225, R112, and R113):
  - The server API, for `server.ts`: `record`, `action`, `route`, `on`, `runtime`, `settings`,
    `repositories`, `log`, as today, and `uraeda:process`, `uraeda:fs`, `fetch` in place of `node:`
    imports. Its declarations are [`server.d.ts`](/crates/server/src/extensions/api/server.d.ts).
  - Records `Extensions { repo }`, with `repo` null for the settings page, and
    `ExtensionRecord { repo, extension, name }`, whose value is `{ value, error }`. Actions
    `extensions.act { repo, extension, name, input }`, which answers `ExtensionAction { output }`,
    and `extensions.setOn`, `setSetting`, and `reportPageProblem`, which answer null.
    `ExtensionAction` is that output, and no record.
  - Routes `/x/{extension}/{*path}` and `/r/{name}/x/{extension}/{*path}`, closed like every route.
  - In `uraeda_server::extensions`: `skills(shared, repository)`, a session's `Options::skills`;
    `emit(shared, &Happened::..)`, for the sessions' `turn-ended` and `session-started`;
    `hold(shared, name, title)`, a session at work on an extension's runtime, whose reload waits;
    `settings(shared, name, repository)` and `is_on(shared, name, repository)`, a built-in's too.
  - For task 19, marked `TASK 19:`: an entry's `page`, which `Extensions` shows as `pageVersion` and
    `extensions.reportPageProblem` checks, set where `Loader::load` compiles the server's files, and
    the page's folders in `extensions/watch.rs`.
  - `extension.toml` keeps `api = 1`: the API is rewritten in place, with no second version and no
    path from the old one. An extension written for the Node server fails to load, as any broken
    extension does.

- [x] **Step 1: Write the failing tests**
  - `an extension's record and action answer through the protocol`.
  - `a saved server.ts replaces the running one, without a restart`.
  - `an extension that throws at load leaves the others running`, and one
    `that never returns is cut off`: within 2 s at activation, 10 s in a call, as today.
  - `stopping the server leaves no VM work behind`: no timer, child process, or thread of a VM
    remains.
  - Also: `an extension in a repository's folder is never loaded`;
    `the settings page's actions reload an extension and turn it off`;
    `an extension reaches files, commands, and the web through Uraeda's modules`;
    `an extension's runtime runs a turn and leaves with its extension`;
    `a repository's events reach the extensions that listen`;
    `a runtime's reload waits for the session at work on it`; and, in the VM's own file,
    `a panic under an extension's code ends its VM alone, and says why`.
  - Breaks to make: let a VM's panic unwind into the server; forget a VM's child process on unload;
    no interrupt handler; an extension loaded from a repository's folder.
- [x] **Step 2: Run them**. Expected: FAIL. Seen failing through its breaks, not before the code:
      the tests were written once the VM answered, and each failed under its break.
- [x] **Step 3: Implement**, with `rquickjs`, one VM per extension, each on its own thread with a
      memory limit and an interrupt handler for time. Compile TypeScript with `crates/compile`. An
      extension loads only from the config folder; the loader's test for that rule is ported.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): extensions' server parts, in a VM`.

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
  - `preview::files_changed(&Shared, repository)`, which the one watcher calls after each burst;
    `preview::repository_removed(&Shared, name)`, which it calls as a repository leaves the list
    (ruling R93); and `preview::sweep(&Shared)`.

- [x] **Step 1: Write the failing tests**: `the server stops every preview command when it stops`
      (the stack decision's rule); `a preview path without its secret is refused`.
- [x] **Step 2: Run them**. Expected: FAIL. Seen failing through breaks, not before the code:
      without the stop work, with the signal sent to the group's leader alone, with every
      frame-shaped path accepted, and without the rule that keeps a waiting folder's preview, each
      test failed.
- [x] **Step 3: Implement**, porting the runner's rules.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): previews and their proxy`.

## Task 19: Extension pages: built, signed, served

**Risky:** a client runs what this task signs.

**Files:**

- Create: `crates/server/src/extensions/{pages,signing,builds}.rs`
- Test: `crates/server/tests/extension_pages.rs`, `fixtures/pages/`

**Interfaces:**

- Consumes: the loader and watcher (task 17); the result of task 2's first check, which holds:
  ruling R22 names the signing calls, and why a page's build number only grows. Ruling R23 asks the
  build to make a post of `start` the page's first statement.
- Produces (rulings R114 to R117, and "Extension pages" in
  [`contracts/protocol.md`](contracts/protocol.md)):
  - `GET /extensions/:name/page`: the page as a signed NSH package, `application/octet-stream`, with
    its version in `X-Uraeda-Page-Version` and `ETag`; 304 for `If-None-Match` of the running
    version; 404 without a page.
  - The record Extensions carries each page's `pageVersion`, the package's build number, which
    changes on every build of changed code and only grows, across restarts too.
  - `GET /extensions/key`: the public key a client trusts, in base64, sent only over a signed-in
    connection.
  - A build that fails keeps the last good package, and is carried in the row's `problems`.
  - A page imports its own files, `nsh`, `nsh/base`, and `uraeda/ui` and `uraeda/page`, which are
    built into it from the server's modules folder: `ui/index.ts` and `extensions/page.tsx` of
    `<data folder>/extensions/modules/`, or of the folder `URAEDA_PAGE_MODULES` names. Task 34 fills
    that folder from the binary (ruling R116).
  - A page's rights are `{ "host": ["start", "record", "call", "navigate"] }`, the constant `HOST`
    of `extensions/signing.rs`, which task 34 changes if its channel has other names.

- [x] **Step 1: Write the failing tests**
  - `a saved page gets a new version and a valid signature`.
  - `a page that does not compile keeps the last one, and says why`.
  - `the signing key never leaves the data folder`: no route or record returns it.
  - Also: `a build number never goes back across a restart`;
    `a page is built from its extension's folder only`; and
    `a page gets the app's modules from the data folder`.
  - Breaks to make: serve an unsigned package; serve the private key; sign with a key other than the
    one whose public half is served.
- [x] **Step 2: Run them**. Expected: FAIL. Seen failing through its breaks, not before the code:
      the tests were written once the pages were served, and each failed under its break.
- [x] **Step 3: Implement**, with `nsh-bundler` for the build and NSH's package signing. The key is
      made at the first start, in the data folder. Give the bundler the modules a page may import:
      `nsh`, `nsh/base`, `uraeda/ui`, `uraeda/page`. Read NSH's signed-packages pages first.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): build, sign, and serve extension pages`.

## Task 62: Accounts

Added on 2026-11-11, from the default branch's
[multi-accounts](../done/2026-11-10-multi-accounts.md) feature, which this plan's port of the runner
predates. Read its record first: it is the specification.

**Files:**

- Create: `crates/server/src/runtimes/accounts.rs` (the contract and the pick),
  `crates/server/src/runtimes/claude/accounts.rs`, `crates/server/src/runner/{account,moves}.rs`
- Modify: the store's schema (a session's account), the import (the Node store's account columns),
  the records Agent and Session
- Test: `crates/server/tests/accounts.rs`

**Interfaces:**

- Consumes: `Runtime` (12), the Claude runtime (13), sessions and the continuer (15).
- Produces:
  - Accounts in the runtime's contract, as
    [`extension-api.ts`](/packages/server/src/extension-api.ts) has them now, so an extension's
    runtime lists its own; and the pick's rule, one function, as
    [`account-pick.ts`](/packages/server/src/runner/account-pick.ts) has it.
  - Claude Code's accounts from the configuration folders of `[extensions.claude] accounts`, each
    reaching the process only as `CLAUDE_CONFIG_DIR`, never for `~/.claude`
    ([`claude-accounts.ts`](/packages/server/src/runner/claude-accounts.ts)).
  - Each account's usage, asked in short processes that spend nothing, at most once a minute per
    account ([`account-usage.ts`](/packages/server/src/runner/account-usage.ts)), in the record
    Agent; a session's account in the record Session.
  - A run a usage limit refused goes on at once on the account with the most room among those that
    hold its conversation, with a line naming the account; with no room elsewhere it waits for its
    own reset ([`account-move.ts`](/packages/server/src/runner/account-move.ts), and the
    [models](../decisions/models.md) and [run lifecycle](../decisions/run-lifecycle.md) decisions).
  - An account's problems, for the settings' banners.

- [x] **Step 1: Write the failing tests**, on the fake runtime with scripted accounts, reusing the
      cases of the Node tests:
      `a session picks the account with the most of its five hours left,     and keeps it`, with the
      record's rows for ties, an unknown usage, a used-up week, and none signed in;
      `a run a limit refused goes on at once on another account`, with a row where no other has
      room; `an account reaches the agent only as its configuration folder`.
- [x] **Step 2: Run them**. Expected: FAIL. Seen failing through breaks, not before the code: the
      pick ranking the most used first, the move finding no account, and the folder not given to the
      process each failed its tests.
- [x] **Step 3: Implement**, porting the files above. Uraeda never reads or writes a credential. No
      test and no step asks a real account for its usage.
- [x] **Step 4: Run the task's validation**: `just task uraeda-server uraeda-protocol`. Expected:
      PASS. At the task, every test passed but `rust_source_files_stay_under_500_lines`, failing on
      earlier tasks' files; it passed once task 91 split the last of them, `preview/runner.rs`, and
      the whole validation passed then.
- [x] **Step 5: Commit**: `feat(nsh-migration): accounts, their usage, and a limit's move`.

**As built** (rulings R181 to R185):

- The contract: `Runtime::accounts() -> Option<Arc<dyn Accounts>>`,
  `Accounts { list, name_of, problems, refresh }`, `Account`, `has_session(native_id, account)`, and
  `Options::account`, in `runtimes/accounts.rs` with the pick, `pick`, `pick_with_room`, and
  `merged`. An extension's runtime gives `accounts` in `uraeda/server`, through
  `extensions/accounts.rs`.
- The records: `RuntimeRecord.accounts: Vec<AccountRecord>` (`id`, `name`, `state`, `windows`,
  `isNext`), `AccountWindow.resetsAt` none for a window not open, and `Session.account` and
  `Session.accountId`; an account's problems are its extension's in the record `Extensions`.
- The runner: `Runner::account_for` (the pick, as a process opens), `account_records`,
  `refresh_accounts`, `account_name`, in `runner/account.rs`; `move_account` in `runner/moves.rs`;
  the continue's reason `account`. The accounts are asked with each check of the runtimes, at the
  start and every minute, and on a read of `Agent`.
- The store is at schema 3, with `sessions.account`; the import reads the Node store at schema 14.

## Task 63: Scheduled jobs

Added on 2026-11-11, from the default branch's
[scheduled jobs](../done/2026-11-10-scheduled-jobs.md) feature. Read its record first, with its
gotchas: each is a bug the Node code met.

**Files:**

- Create: `crates/server/src/jobs/` (times, scheduler, starts, run, run_now, accept, guards,
  problem, announce), `crates/server/src/records/jobs.rs`, the store's `job_runs` table
- Modify: the import (the Node store's `job_runs`)
- Test: `crates/server/tests/jobs.rs`

**Interfaces:**

- Consumes: the core's [`jobs.rs`](/crates/core/src/jobs.rs), which owns a job's format and every
  write; sessions, `session.toChange`, and the offers' grammar (15); the store (11); the catch-ups'
  scheduler beside which it runs.
- Produces: the record Jobs and its actions, with the names of
  [`fate/jobs.ts`](/packages/server/src/fate/jobs.ts) and `job-mutations.ts`; the scheduler, the
  only code that starts a scheduled run; "Run now"; the acceptance of a run's change offer; the
  switches `[runs] scheduled_jobs`, `ura serve --no-scheduled-jobs`, and `URAEDA_SCHEDULED_JOBS`.

- [x] **Step 1: Write the failing tests**, on the server's fixed clock and the fake runtime, reusing
      the Node tests' cases: `a job runs at its time, once`, with rows for two ticks, a clock set
      back, and a time more than 5 minutes past;
      `a time is skipped while the last run works or     its change is open`;
      `a run starts the change it offers, and only then`, with the record's rows of offers that
      start nothing; `a job is never read from a repository`.
- [x] **Step 2: Run them**. Expected: FAIL.
- [x] **Step 3: Implement**, porting [`packages/server/src/jobs/`](/packages/server/src/jobs/). The
      run's row is written with nothing awaited after its last guard. The scheduler stops through
      `shared.on_stop`, waiting for an acceptance in flight.
- [x] **Step 4: Run the task's validation**: `just task uraeda-server uraeda-protocol`. Expected:
      PASS. It passed whole once task 91 split `preview/runner.rs`, the last file over 500 lines.
      Seen at the task, with `uraeda-cli` and `uraeda-core`: formatting and Clippy pass, and 1,767
      of 1,768 tests; `rust_source_files_stay_under_500_lines` fails, as it did before this task, on
      nine files of the runner, the protocol's sessions, and the core (task 15's and earlier),
      `runner/manager.rs` and `runner/send.rs` among them, which this task grew by 2 and 9 lines.
- [x] **Step 5: Commit**: `feat(nsh-migration): scheduled jobs`.

As built (rulings R189 to R195):

- The record `Jobs { repo }`: `{ enabled, jobs, problem, timeZone }`, each job
  `{ name, index, prompt, scheduleText, schedule, repositories, on, reportOnly, agent, model, effort, problem, next: { at, why, text }, last, history }`,
  each run
  `{ id, at, due, trigger, outcome, reason, blockedBy: { folder, title }, error, refusal, session, title, folder }`,
  in [`protocol/src/jobs.rs`](/crates/protocol/src/jobs.rs).
- The actions `jobs.add { repo, job }`, `jobs.update { repo, name, job }`,
  `jobs.setOn { repo, name, on }`, and `jobs.remove { repo, name }` answer nothing: the record shows
  the change. `jobs.runNow { repo, name }` answers `JobsRan { session }`. `settings.setContinue`
  takes the key `jobs`, and `Settings.runs.scheduledJobs` is the switch.
- The offers' grammar is `uraeda_core::offers`: `last_offer` for the card, `ending_offer` for the
  acceptance, `proposal_title`.
- `crates/server/src/jobs/` (times, scheduler, guards, place, problem, run, run_now, accept) and
  `records/jobs.rs`; the store's `job_runs`, schema step 4 (after the accounts' 3), in
  `runner/job_runs.rs`; its import in `runner/import/old/jobs.rs`, of Node's store at schema 14.
  Tests in `crates/server/tests/jobs.rs` and the modules' own.

## Task 64: What else the Node server gained

Added on 2026-11-11: the small behaviours the default branch gained in the code tasks 7 to 19
ported, beyond accounts and jobs.

**Files:**

- Modify: `crates/server/src/mcp/`, `crates/server/src/records/sessions/`,
  `crates/server/src/records/workspace/settings/`, `crates/server/src/runtimes/registry.rs`
- Test: in those domains' test files

**Interfaces:**

- Produces:
  - `runs.default_agent` names the agent a new session runs on, the first agent on when unset, with
    its action. A runtime registered again keeps its place in the order.
  - Uraeda's MCP tools are listed with `readOnlyHint`, so an agent runs the `run_agent` calls of one
    turn at once, and a wave's implementers run together. A `run_agent` call's target is its task.
  - A sub-session's view carries when it started and ended, and a reviewer's title no commit.
  - Anything else `git diff e15482f6 main -- packages/server/src` shows that tasks 62 and 63 do not
    own: list each in the commit body, ported or dropped with its reason.
- As built (rulings R226 to R228): `settings.setDefaultAgent { agent }`, and `runs.defaultAgent` in
  `Settings`; `Runtimes::ordered(repository)`, the names with the default agent first, which `on_in`
  and the record `Agent` follow, read from the settings file at each pick. The catch-up runs start
  on the pull requests' `SETTLED`, `sessions::settled`. The audit left one change unported:
  `toStored`'s stored defaults, which the web UI alone runs, for the screen tasks 44 and 48 to port
  to the server.

- [x] **Step 1: Write the failing tests**: `a new session runs on the default agent`;
      `a runtime registered again keeps its place`; `the tools say they change nothing`.
- [x] **Step 2: Run them**. Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run the task's validation**: `just task uraeda-server uraeda-protocol`. Expected:
      PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the default agent, and what else the server gained`.

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

- [x] **Step 1: Write the failing test**
      `every old record, mutation, and route is mapped or     dropped`: it reads the names from
      `packages/server/src/fate/` and `app.ts`, and fails on one missing from `parity.toml` or
      unknown to the registry.
- [x] **Step 2: Run it**. Expected: FAIL, naming what is missing.
- [x] **Step 3: Fill the list, port what it shows missing, and write the sandbox.**
- [x] **Step 4: Run the task's validation**, then `ura sandbox` once. Expected: PASS, and a server
      that answers `Workspace`.
- [x] **Step 5: Commit**: `feat(nsh-migration): the parity list and the sandbox`.

**As built** (rulings R229 to R233):

- `parity.toml` maps 40 records, 114 actions, and 26 routes, and drops 6 records (answers, no
  records) and 3 routes (the React UI's files, two links without a repository). Nothing was left to
  port. Task 61 deletes `tests/parity/node.rs` and keeps the list.
- `ura sandbox [--reset] [--port N] [--folder DIR] [--sign-in] [--long-chat]`, hidden from
  `ura --help`; `just sandbox` runs it on http://127.0.0.1:4420, its state in `.sandbox-next/`.
  `Options::sandbox: Option<sandbox::Mode>`, `sandbox::prepare`, `sandbox::options`,
  `sandbox::default_folder`, `sandbox::PORT`.
- For the app's tests (task 23): `just sandboxed <command>`, `scripts/sandboxed.sh`, runs a command
  beside a fresh sandbox on a free port, its address in `URAEDA_SANDBOX`: `app-test` becomes
  `{{ heavy }} scripts/sandboxed.sh {{ nsh }} test`, and the TSX reads `process.env.URAEDA_SANDBOX`,
  granted by `capabilities.process.env` in `app/nsh.json`.

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
  - TypeScript's types come from Rust's, written by `just app-check` in
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

- [x] **Step 1: Write the failing tests**
  - `a record's signal follows the server`.
  - `a reconnect resumes a reply without a gap`, with a row where a change arrives after its
    `Unsub`: it is ignored, and no subscription is left (a test of its own, R244).
  - `a refused connection says which side to update`.
- [x] **Step 2: Run them**: `just app-test`. Expected: FAIL. Seen: with nothing applied, the five
      tests against the server timed out waiting for `live`.
- [x] **Step 3: Implement.** Changes that arrive within one frame are applied together, so a burst
      draws once. The list of a record keeps each item's signal across changes: a chunk of one
      message redraws that message only.
- [x] **Step 4: Run the task's validation**. Expected: PASS. `just task-app`: 96 tests passed.
- [x] **Step 5: Commit**: `feat(nsh-migration): the client store`.

**As built** (rulings R241 to R245), all from `app/store` (`index.ts`), with
[`app/store/README.md`](/app/store/README.md), the guide the screens read:

- `connect({ address, signIn, grace?, open? }): Connection`, which closes the one before and makes
  this one the app's; `connection()`. `Connection`: `status()`
  (`"connecting" | "live" | "offline" | "refused"`), `stale()`, `refused()` (`Refused`: `reason`,
  `update` `"app" | "server" | "sign-in"`, `words`, `protocol`), `reconnect()`, `close()`,
  `subscriptions()`, `address`, `signIn`.
- `record<N>(name, args): Live<Value<N>>`, an accessor with `error()`; `list(source, key | path)`:
  `rows()` of `{ id }` and `item(id)`; `text(source, path): Accessor<string>`;
  `call<A>(name, input): Promise<Output<A>>`, rejecting with `StoreError` (`code`: the protocol's
  `ErrorCode`, `offline`, or `dropped`; `message`); `extensionHost(): ExtensionHost`; `PROTOCOL`,
  `GRACE`, `WAITS`; and task 24's names, re-exported.
- The tests' seam: `open`, an `Opener` that wraps the platform's WebSocket (`line.ts`).

## Task 24: Routes and per-device storage

**Files:**

- Create: `app/store/{routes,history,device}.ts`
- Test: `app/store/routes.test.ts`, `app/store/device.test.ts`

**Interfaces:**

- Produces, as built (rulings R126 to R128). Each name is exported from its own file: task 23 writes
  `app/store/index.ts`.
  - From `routes.ts`: `type Route`, a page (`route.page`, with the page's own fields) and the rest
    of its address, `repo?`, `query?`, and `hash?`; `type RouteOf<P>`, the route of the page `P`;
    `parseRoute(address): Route` and `pathOf(route): string`, on a whole address, its query and hash
    included, with the paths of [`routeTable.ts`](/packages/web/src/routeTable.ts) unchanged, so old
    links keep working. An address from before a page moved parses to the page where it is now:
    there is no `moved`, `run`, or `first-run` page.
  - From `history.ts`: `route: Accessor<Route>`, a signal only the history writes;
    `navigate(route, kept?)`, in the repository of the page shown unless the route names one;
    `redirect(route)`; `back(): boolean`, `false` on the visit the app started on; `entry(): Entry`,
    the visit shown, with its `id`, `from`, and `kept`; `keep(values, id?)`; `positions()`, with
    `at(name)` and `keep(name, offset)`, a visit's scroll positions; `openOverlay(label, route?)`;
    `setLeaveGuard(guard)`.
  - The seam for task 57, in `history.ts`: `type HistoryAdapter`, `bindHistory(adapter)`,
    `entryAt(address)`, and `memoryHistory(start)`, the app's own stack, which is what the history
    uses until another adapter is bound.
  - From `device.ts`: `device.get(key)` and `device.set(key, value)`, at once, from memory;
    `device.load()`, which reads NSH's storage once, before the app is mounted; `device.full()`;
    `type DeviceKeys`, the one table of the keys, where a feature adds its line; and
    `deviceStore<Keys>()`, a store over a table of a test's own.

- [x] **Step 1: Write the failing test** `every old path parses to its route and back`, on the paths
      of the old route table's tests.
- [x] **Step 2: Run it**. Expected: FAIL.
- [x] **Step 3: Implement.** No browser API here: task 57 binds the history to the browser's.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): routes and per-device storage`.

## Task 25: The design language's samples

**Files:**

- Create: `app/gallery/samples/` (eight rendered samples, their values, their shaders, and the two
  tests that picture and time them)
- Modify: [`specs/ui/design-language.md`](/specs/ui/design-language.md), where a sample proves a
  value wrong; the [`justfile`](/justfile), for the two recipes

**Interfaces:**

- Consumes: the [design language](/specs/ui/design-language.md), written with the spec from a study
  of LazyVim, Zed, Hyprland, and Linux desktop setups, and its
  [browser mockup](mockups/design-language.html), which is the reference for how each sample should
  look. Its values were tuned in a browser, not on GTK.
- Produces: the same language, with its values proven on GTK, which tasks 26 to 33 follow, and:
  - [`values.ts`](/app/gallery/samples/values.ts): every value of the language, shaped as the
    tokens: `roles` (a theme's colours, by mode), `choices` (the open choices, by their token's
    name), and `values(mode)`, one set per part: `height` (fill, edge, lip, shadow, glass, for each
    of the four heights), `pane`, `light`, `row`, `glass`, `button`, `key`, `status`, `motion`,
    `type`, `space`, `backdrop`. Task 26 lifts it.
  - [`shaders.ts`](/app/gallery/samples/shaders.ts): `GLASS`, `GLOW` (the focused pane's), and
    `BACKDROP` (the wash and the grain), in WGSL, with their uniforms. Task 27 lifts them.
  - `just samples-shots [word]`: the samples' pictures in `target/shots/samples/`, on the hidden
    display, all of them or those whose test's name holds the word (`dark`, `glass`). It is
    `hidden-display` and `nsh test <file> --target linux`, whose tests call `app.screenshot(path)`:
    `just app-shots` and `just gallery-shots` are built the same way.
  - `just samples-frames`: NSH's frame timing, one `nsh::perf` line a second, of a transcript that
    scrolls by itself, with `nsh test --target linux --fps -v`: `just frames` is built the same way.
  - The rulings R129 to R132: how glass, the glow, and a tube's light are drawn on GTK, how the
    tests were measured, and each value that changed.

- [x] **Step 1: Render eight samples** in a throwaway gallery page, in both themes: every height
      nested in every other; a pane at rest beside a focused one, each with its border round its
      title; a glass bar over a scrolling transcript; buttons and keycaps in every state; a dialog
      over a dimmed page; a list with a selected row and its bar; the status line; and a session
      with an agent running. Take their pictures on GTK, on an invisible display. The spike's script
      read the X window: NSH's test driver takes the picture itself, so the samples' test does, with
      `just samples-shots`.
- [x] **Step 2: Check each against the language's own tests**: text over glass meets the contrast
      floor over the busiest page; the glass bar over the scrolling transcript costs under 8.3 ms a
      frame at the 99th percentile; nothing in a sample moves unless a state just changed, but a
      view's one main action.
- [x] **Step 3: Compare each picture with the mockup, and correct the language's values** where a
      sample fails a test or drifts from the mockup. Say which in the commit. Change a value, never
      a rule: where a rule cannot be drawn on GTK, keep the nearest look that passes the tests, and
      write a ruling.
- [x] **Step 4: Take the open choices as written**, each behind its token, as ruling R13 says.
- [x] **Step 5: Commit**: `docs(nsh-migration): the design language's samples`. Keep the pictures in
      `target/shots/samples/`, for the pull request, never in the repository.

## Task 26: Tokens, themes, and fonts

**Files:**

- Create: `app/ui/tokens/`, `app/ui/theme.ts`, `crates/app/src/theme.rs` with `theme/`,
  `crates/app/src/fonts.rs`, `crates/app/assets/fonts/`
- Modify: the core's theme reader, for the new roles; every shipped theme; the samples, which read
  the tokens
- Test: `crates/app/tests/theme.rs`, `app/ui/tokens/tokens.test.ts`, and
  `the_bundled_fonts_are_the_ones_drawn` in `crates/app/tests/outside.rs` (ruling R156)

**Interfaces:**

- Consumes: the design language (task 25); the record Themes (task 7), whose `roles` is a map and
  carries the new roles with no change of the protocol.
- Produces, as built (rulings R133 to R138):
  - From `app/ui/tokens`: `tokens`, the only source of colours, radii, blur, and glow for `app/ui/`.
    Its parts: `theme`, `mode`, `role` (every role of the theme, `role.inkFaint` for `ink-faint`),
    `black`, `type`, `space`, `radius`, `backdrop`, `height`, `pane`, `light`, `row`, `glass`,
    `button`, `key`, `status`, `motion`, `choices`. `tokens.height[name]`, for `recessed`,
    `standard`, `raised`, and `overlay`, holds `fill`, `border`, `lip`, `shadow`, `glass`, `blur`,
    `tint`, and `glow`, with `fillIn` on `recessed` and `glassShadow` on `raised`.
  - `tokens` is live: read inside a style, a memo, or an effect, a part follows the theme shown.
    `tokensOf(theme, fonts?)` gives the same set for one theme, for a page that shows both.
  - Also from `app/ui/tokens`: `mix` and `alpha`, mixed in Rust; `choices`, the open choices of R13,
    each one value; `DEFAULT_THEMES`; `FONTS`, `FONT_ROLES`, `DEFAULT_FONTS`, `fontOf`; and the
    types `Tokens`, `Roles`, `ThemeSource`, `Mode`, `Height`, `HeightName`, `Glow`, `Fonts`,
    `FontRole`.
  - From `app/ui/theme.ts`: `applyTheme(theme): boolean`, which shows a theme in `tokens` and maps
    its roles onto NSH's tokens; `applyFonts(picked)`; `pickTheme(themes, choice, scheme)`;
    `shownTheme()` and `pickedFonts()`; and `ThemeChoice`. Task 36 calls them, from the device's
    keys `theme`, `"theme.shown"`, and `fonts`.
  - The roles a theme gains, in its TOML: `backdrop`, `backdrop-wash-1`, `backdrop-wash-2`, `well`,
    `rule-quiet`, `lip`, `shade`, `glass-tint`, `glass-rim`, `light-focus`, `light-focus-2`,
    `light-running`. `page`, `raised`, and `rule` are the language's surface, raised fill, and edge.
  - Bundled fonts, nine families, registered from the app's crate, with no file loaded from another
    host: a component names one as `tokens.type.body`, `heading`, `reading`, `code`, or `markdown`.
  - From `uraeda/native`: `mixColours`, `fadeColour`, `mixTheme`, `showTheme`, `bundledFonts`. Only
    `app/ui/tokens/` and `app/ui/theme.ts` call them.

- [x] **Step 1: Write the failing tests**: `every shipped theme meets the contrast floors` (4.5:1
      for text, 3:1 for borders, as today, and for text over glass at each height);
      `a theme without the new roles inherits them`; `a broken theme never blocks the others`.
- [x] **Step 2: Run them**. Expected: FAIL. Seen failing before the code: the core's
      `a theme     without the new roles inherits them` first.
- [x] **Step 3: Implement.** Themes stay one TOML file each. A role missing from a user's theme
      comes from the default of its mode.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): tokens, themes, and fonts`.

## Task 27: Surfaces

**Files:**

- Create: `app/ui/surfaces/`: `Surface.tsx`, `Glass.tsx`, `Glow.tsx`, `Pane.tsx`, `Well.tsx`,
  `Backdrop.tsx`, `Overlay.tsx`, `Dialog.tsx`, `Sheet.tsx`, `Popover.tsx`, `Toast.tsx`,
  `Tooltip.tsx`, `Float.tsx`, `light.tsx`, `height.ts`, `focus.ts`, `presence.ts`, `index.ts`, the
  shaders `glass.wgsl.ts`, `glow.wgsl.ts`, `backdrop.wgsl.ts`, and `hash.wgsl.ts`, and the tests'
  page, `__checks__/focus.tsx`; `app/gallery/surfaces/`, their gallery pages
- Modify: the samples, which draw with the components; `app/ui/keys/`, whose views float in an
  `Overlay`; the [`justfile`](/justfile), for `gallery-shots`
- Test: `app/ui/surfaces/surfaces.test.tsx`

**Interfaces:**

- Consumes: `tokens` (task 26); `KeyScope` and `registerKey` (task 32).
- Produces, as built (rulings R157 to R162), all from `app/ui/surfaces`:
  - `Surface` takes `height: "recessed" | "standard" | "raised" | "overlay"`, and draws that
    height's fill, border, lip, shadow, glass, and glow from `tokens.height`. It is the only
    component that draws a shadow, glass, or a glow: every other one is built on it, and none sets
    its own. Its other props: `glass` (a raised surface over what scrolls), `focused` (a pane's
    light, a field's edge and glow in `tone`), `running` (a run's line), `tab` (what stands on its
    top edge: a pane's title, an overlay's plate), and `style`, `testID`, `ref`, `onPress`,
    `onLayout`, `accessibilityLabel`.
  - `useHeight()` gives the height a component sits on, and `useGlass()` whether that is glass, each
    read as a signal, from a context `Surface` sets: a control picks its contrast from them, and a
    nested surface its look. Outside every surface it is `standard`.
  - `Glass` draws Apple's own glass or a backdrop blur where the platform has one, and the shader
    elsewhere: on GTK today. No caller knows which, and only `Surface` uses it. A later iOS client
    maps a height to the system's material here, and nowhere else.
  - `Pane` (`title`, `more`, `icon`, `tone`, `focused`, `running`, `needs`, `height`, `body`,
    `style`), `Well` (`focused`, `tone`, `style`, `ref`), and `Backdrop`, what is under the panes.
  - The overlays, each shown while its `open` is true, and for its way out after: `Overlay` (`name`,
    `title`, `icon`, `place` "middle" or "corner", `width`, `onClose`), `Dialog` (`title`, `icon`,
    `width`, `onClose`), `Sheet`, `Popover` (`anchor`, `placement`, `align`, `width`, `name`,
    `onClose`), `Toasts` with `Toast` (`title`, `icon`), and `Tooltip` (`text`, `placement`, around
    what it is about).
  - `focusStop(node, { first?, escape? })`: what a field or a control that takes the focus calls as
    it renders, and whose two handlers it sets on its element. An overlay puts the focus on its
    first stop as it opens, gives it back where it was as it closes, and a dialog or a sheet keeps
    Tab among its own stops. Tasks 28 and 30 call it for every control and field. A field's `escape`
    takes an overlay's Escape first (ruling R197).
  - `just gallery-shots [word]`: the pictures of the surfaces' gallery pages, in
    `target/shots/gallery/`, in both themes, 1400 and 390 points wide.

- [x] **Step 1: Build `Glass` first, and measure it.** The shader is the samples', which follows the
      design language's [glass recipe](/specs/ui/design-language.md#glass): on GTK the frost is one
      pass over the picture each view gets, with the bent edge, the colour fringe, the rim, and the
      care it asks for square corners (ruling R129). Over the samples' scrolling transcript the
      frame cost stays under 8.3 ms at the 99th percentile on GTK, so no part was dropped (ruling
      R162).
- [x] **Step 2: Build `Surface`, then the others on it**, each following
      [surfaces](/specs/ui/surfaces.md) and the design language. `Well` is the recessed one, `Pane`
      the standard one, and every overlay sits at `overlay`. A dialog is a sheet on a narrow window;
      a popover stays a popover at every width, as the UI layout decision says.
- [x] **Step 3: Add each to the gallery**, in its states, with one page that shows every height
      inside every other: the pages of `app/gallery/surfaces/`, which the gallery app (task 35)
      takes in.
- [x] **Step 4: Run the task's validation**: `just task-app`. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): surfaces, with glass and glow`.

## Task 28: Controls

**Files:**

- Create: `app/ui/controls/`: Button, IconButton, Switch, Segmented, Select, Checkbox, Radio,
  NumberInput, Badge, Banner, Spinner, Progress, StatusDot, Kbd, Tabs, Menu, Breadcrumbs, Divider,
  Icon, Link, Heading, Text

**Interfaces:**

- Consumes: `tokens` (26), surfaces (27): a control that takes the focus calls `focusStop`.
- Produces: one component for each Astryx component the React UI imports, listed in
  [`packages/web/`](/packages/web/)'s imports of `@astryxdesign/core`, built on `nsh/base`'s
  unstyled parts where one exists.
- Produces, as built (rulings R164 to R169), all from `app/ui/controls`:
  - `Text` (`tone`, `colour`, `size` "under" | "size" | "over" | "over2", `bold`, `font` "body" |
    "code" | "heading", `lines`), `textStyle`, `inkOf`, and `Heading` (`level` 1 to 3).
  - `Icon` (`name`, `colour`, `size`), `IconName`, `iconNamed`, `isIconName`: Lucide's names and the
    marks `claude`, `openai`, `pi`, from `icons/` (R164).
  - `Kbd` (`keys`, a key or a sequence as typed; `onMain`; `look`; `state`).
  - `pressable(props)`, `ring`, `PressState`: press, hover, focus, and disabled for every control
    (R165). `focusStop` gains `disabled` and `press`, and answers `focused`.
  - `sent(truth, send)`, `Under` (`hint`, `refusal`), `Refusal`: a value the server keeps, and its
    refusal under the control (R166).
  - `Button` (`label`, `variant` "main" | "tube" | "danger", `icon`, `keys`, `breathes`, `pending`,
    `selected`), `IconButton` (`icon`, `label`, `keys`, `danger`, `selected`): `keys` declares the
    key (R167). Every control also takes `disabled`, `first`, `state`, `testID`.
  - `Switch`, `Checkbox` (`mixed`), `Radio`, `Segmented`, `Select` (`options`, `placeholder`,
    `width`): `value`, `onChange`, `label`, `hint`, `pending`, `refusal`. `NumberInput` (`min`,
    `max`, `step`, `unit`).
  - `Menu` (`entries` of `{ label, run, icon?, keys?, danger?, disabled?, ruled? }`, `label`,
    `icon`), `Tabs` (`tabs` of `{ value, label, icon?, count?, disabled? }`), `Breadcrumbs`
    (`crumbs`), `Link` (`href` or `onPress`), `Divider` (`edge`, `vertical`, `label`), `Badge`
    (`tone`), `StatusDot` (`tone`, `label`), `Banner` (`tone`, `title`, `action`), `Spinner`
    (`label`), `Progress` (`label`, `value`, `words`).
  - `tokens.control` and the type `Tone`, in `app/ui/tokens/`; `isNarrow` in `app/ui/width.ts`.
  - The gallery's pages, `app/gallery/controls/`, which `just gallery-shots` draws too.

- [x] **Step 1: Build each control**, with its keyboard behaviour and its 44-point touch target on a
      narrow window. Buttons and keys follow the design language's
      [buttons and keys](/specs/ui/design-language.md#buttons-and-keys): a lamp, tubes, and chips,
      with their variants behind `key.look` and `button.main.look`. `Kbd` is the one key. Icons are
      Lucide, and Codicons for harness marks, as today.
- [x] **Step 2: Add each to the gallery**, in every state: rest, hover, focus, pressed, disabled.
- [x] **Step 3: Run the task's validation**. Expected: PASS.
- [x] **Step 4: Commit**: `feat(nsh-migration): controls`.

## Task 29: Lists, cards, tables, and trees

**Files:**

- Create: `app/ui/lists/`: List, Card, SelectableCard, Table, Tree, Collapsible, VirtualList,
  DragOrder, Empty

**Interfaces:**

- Consumes: `tokens`, surfaces, controls.
- Produces: the components above. `VirtualList` wraps NSH's list with the app's cursor and
  selection, and follows its end when asked. `DragOrder` reorders by drag, by long press on touch,
  and by keys.
- Produces, as built (rulings R170 to R175), all from `app/ui/lists`:
  - `createCursor(items, { initial?, onChange?, range? }): Cursor`: `at`, `anchor`, `holds(id)`,
    `selected()`, `set(id, { extend?, reveal? })`, `move(by, extend?)`, `to("first" | "last")`. The
    cursor is the selection; the screen keeps it in the visit's entry.
  - `listKeys(cursor, { onOpen?, openLabel?, when? })`: `j` `k` and the arrows, `g g` `G` `Home`
    `End`, `Enter`, and with ranges `J` `K` and Shift with the arrows, declared in the scope around
    the list, the pane's. A move past an end returns `false`, for the shell's fallback.
  - `VirtualList` (`cursor`, `row(id, index)`, `onOpen`, `follow`, `onFollowing`, `offset`,
    `onOffset`, `rowHeight`, `rules`, `framed`, `keys`, `empty`, `header`, `footer`, `ref` with
    `toEnd`, `show`, `scrollTo`), `List` (the same, every row made), `Row` and `Bar`, `Line`
    (`icon`, `hue`, `label`, `meta`, `count`, `quiet`), `Card` (`icon`, `hue`, `title`, `state`,
    `time`, `who`, `facts`, `body`, `actions`, `selected`, `onPress`), `SelectableCard`, `Table`
    (`columns`, `cell(id, column)`, `cursor`), `Tree` with `treeRows(nodes, folded)`, `Collapsible`
    (`title`, `count`, `open`, `onToggle`, `keys`), `DragOrder` (`cursor`, `row`, `label`,
    `onMove(id, to)`), `Empty` (`icon`, `title`, `words`, `action`), and `glide()`.
  - For task 23 (R171): a list record's rows as a new array at each insert, remove, or move, with
    every unchanged row's object kept (`===`), and one signal per item, read by id.
  - The gallery's pages in `app/gallery/lists/`, which `just gallery-shots` draws too, and
    `just lists-frames`, the frames of the 20,000 rows scrolling.

- [x] **Step 1: Build them**, following [components](/specs/ui/components.md): a multi-fact item is
      a framed card with a hierarchy, not grey lines.
- [x] **Step 2: Add each to the gallery**, with a list of 20,000 rows.
- [x] **Step 3: Run the task's validation**. Expected: PASS.
- [x] **Step 4: Commit**: `feat(nsh-migration): lists, cards, tables, and trees`.

## Task 30: The text field

**Files:**

- Create: `app/ui/text/{TextField,Composer,PickerField,SaveStatus,LeaveGuard}.tsx`,
  `crates/app/src/vim_bridge.rs`, `app/ui/text/unsaved.ts`
- Test: `app/ui/text/text.test.tsx`

**Interfaces:**

- Consumes: `Vim` (task 22); `uraeda/native` (21); `device` storage (24); the setting for Vim;
  `focusStop` (27), which the field calls, and `Well`, the surface it is drawn on.
- Produces: `TextField`, the one editor of every text field, as the text-editing decision asks: it
  highlights Markdown, wraps, never scrolls sideways, and runs Vim when the setting is on.
  `vimStatus: Signal<Status>` for the status line. Unsaved text kept per device, as
  [`unsaved.ts`](/packages/web/src/fields/unsaved.ts) does.
- Produces, as built (rulings R176 and R177):
  - `app/ui/text/TextField.tsx`: `TextField` (`value`, `onChange`, `label`, `lines: "one" | "many"`,
    `rows`, `placeholder`, `onSave` for Ctrl+Enter and `:w`, `onEnter`, `autoFocus`, `first`,
    `normalFirst`, `disabled`, `readOnly`, `refusal`, `hint`, `shown`, `ref` with `focus`, `blur`,
    `insert`); `vimStatus`, a signal of `{ mode, pending }`, `mode` "" while no field has the focus;
    `setVimMode(on)` and `vimMode()`, which the app's shell sets from the setting `vimMode`;
    `modeTone(mode)`, a mode's colour for the status line.
  - `crates/app/src/vim_bridge.rs`: the component `TextEditor` and `vimKeys()`, in `uraeda/native`.
    `Vim::insert` in `crates/vim/`.
  - `app/ui/text/unsaved.ts`: `unsavedText(key, saved, { exact?, extra? })`,
    `unsavedKey(repo, field)`, `readUnsaved`, `writeUnsaved`, `dropUnsaved`, `pruneUnsaved(now)`,
    `differ`, `hasDrawnUnsaved`. Two lines in `DeviceKeys`.
  - `SaveStatus` and `saving(send)`; `LeaveGuard`, mounted once; `Composer`; `PickerField`.

- [x] **Step 1: Write the failing tests**: `unsaved text comes back after a restart`;
      `Escape in     normal mode does what Escape does without Vim`;
      `a yank reaches the system clipboard`.
- [x] **Step 2: Run them**. Expected: FAIL. They failed with
      `uraeda/native has no export     vimKeys`.
- [x] **Step 3: Implement**, on NSH's `Editor`. Keys go to `Vim::key` in Rust, in one call per key;
      its edits are applied as one editor transaction. Bind keys only while the field has the focus.
      On a real GTK window a field gets no focus by itself: focus it when it mounts, where the
      screen asks. The caret's trail is a `<Shader>` over the field, fed the caret's box before and
      after a move from the editor's `caret_bounds`, as the design language's
      [motion](/specs/ui/design-language.md#motion-means-a-change-of-state) says.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the shared text field, with Vim`.

## Task 31: The document renderer

**Files:**

- Create:
  `app/ui/document/{Document,Blocks,Spans,List,Callout,Table,Code,Diagram,Picture,Reply}.tsx`,
  `context.ts`, `look.ts`, `index.ts`; `crates/app/src/{highlight,diagram,reply}.rs`, with
  `highlight/scopes.rs` and `reply/{split,lines}.rs`; the gallery's page `app/gallery/document/`,
  and the recipe `just document-frames`
- Test: `app/ui/document/document.test.tsx`, and the Rust tables of `reply/tests.rs`,
  `highlight/tests.rs`, and `diagram.rs`

**Interfaces:**

- Consumes: the core's document tree, from the record WorkflowFile; the diagram check, which holds:
  Rust draws a diagram with Merman, measured and drawn in the app's fonts, and `usvg` makes its text
  shapes, as ruling R123 says. `crates/app/src/diagram.rs` took `picture`, `fonts`, and
  `without_markup` from the check, which now calls the crate's, and exports `diagramPicture` from
  `uraeda/native` (ruling R205). `Diagram.tsx` calls it with the source and the theme's colours, as
  Mermaid's theme variables, and imports no diagram library: the app has no npm package.
- Produces, from `app/ui/document` (ruling R206):
  - `Document({ document, ids?, align?, onLink?, image?, mark?, override? })`, which draws a
    document tree and never parses Markdown, as the stack decision asks. `mark(block)` is a screen's
    slot under each top-level block, list item, and table row; each block's view has the test id
    `block-<id>`.
  - `Reply({ text, done?, ...the same hands })`, which draws a streamed reply as blocks: finished
    blocks never redraw while the last one grows. Task 23's `text(record, path)` feeds `text`
    (ruling R203).
  - In `uraeda/native`: `ReplySplitter` (`push(piece)`, `end()`), `markdownTree(text)`,
    `highlightCode(code, language)`, and `diagramPicture(source, colours)` (rulings R202, R204).

- [x] **Step 1: Write the failing tests**: `a diagram that fails shows its source`;
      `a growing reply redraws its last block only`, counting the blocks made while a text grows.
- [x] **Step 2: Run them**. Expected: FAIL. They failed on the stub: no source shown in 5 s, and
      `expected 0 to be 6` blocks made.
- [x] **Step 3: Implement.** Port the block and span kinds of
      [`Blocks.tsx`](/packages/web/src/Blocks.tsx) and `Spans.tsx`. Highlight code in Rust. Split a
      reply at block boundaries in Rust, so TSX never scans a long text.
- [x] **Step 4: Run the task's validation**. Expected: PASS. `just task-app`: 171 tests passed;
      `just task uraeda-app`: 30 tests passed.
- [x] **Step 5: Commit**: `feat(nsh-migration): the document renderer`.

## Task 32: Keys

**Files:**

- Create: `app/ui/keys/`: `registry.tsx`, `store.ts`, `token.ts`, `sequence.ts`, `leader.ts`,
  `groups.ts`, `keyMap.ts`, `pickerSearch.ts`, `KeysHost.tsx`, `LeaderMenu.tsx`, `KeyMap.tsx`,
  `KeyPicker.tsx`, `look.ts`, `parts.tsx`, and the tests' page, `__checks__/keys.tsx`
- Test: `app/ui/keys/keys.test.ts`, and `crates/app/tests/keys.rs` for the structural rule

**Interfaces:**

- Produces, as built (rulings R139 to R142), all from `app/ui/keys/registry.tsx` unless named:
  - `registerKey(spec: KeySpec | ReadonlyArray<KeySpec>, scope?: Scope): () => void`, the only way a
    shortcut is declared. Called as a component renders, it lasts as long as the component, in the
    scope of the nearest `KeyScope` around it, the shell's without one. It throws where a key would
    mean two things, or could never run.
  - `type KeySpec = { keys, label, run, fallback?, hint?, hintLabel?, hintPress?, icon?, inField?, repeat?, when? }`.
    `keys` is one key as it is typed, or several for a sequence: `"j"`, `"J"`, `"?"`, `"ArrowDown"`,
    `"shift+ArrowDown"`, `"mod+k"`, `"g h"`, `"space n n"`. `run` returns `false` when it did
    nothing, and a `fallback` of the key then runs. `repeat` runs it again while the key is held.
    `inField` hears it in a text field too, never for a key that types. `when` is a guard, read as
    the key comes.
  - `<KeyScope name kind? on?>`, and `keyScope({ name, kind?, on? }, parent?): Scope` for a
    component that passes its scope to `registerKey` itself. `kind` is `"page"` (the default),
    `"pane"` with `on` saying it has the focus, `"selection"` with `on` saying it holds, or
    `"layer"` for an open overlay, which owns the keys while it is mounted.
  - `<KeysHost place?>`, from `KeysHost.tsx`: mounted once, around the app. It hears the keys, draws
    the leader's menu, and owns the key map and its keys, `?` and `Space ?`. A change of `place`,
    the page's address, ends a sequence that waited.
  - For the status line: `keyHints(): ReadonlyArray<StatusHint>`, a signal's read of
    `{ keys, label, press }`, the hints of what is on, the leader's, the key map's, and the folds'
    first; and `pressKeys(keys)`, which a press on a hint or a menu's row calls.
  - `keysOn()`, every key that is on, for the key map; `singleKeys`, the signal the shell writes
    from the setting; `pendingKeys()`, the sequence that waits; `endKeys()`; and `keepSpace(kept)`,
    for a control that Space ticks or picks.
  - `KeyPicker`, from `KeyPicker.tsx`: `items`, `title`, `onPick`, `onClose`, and `preview?`,
    `start?`, `isLoading?`, `placeholder?`, `onCursor?`. Its sources, and the host that opens it
    over a kind, are the shell's.
  - `GROUPS`, in `groups.ts`: a feature whose sequence goes through a new group of the leader's menu
    adds its line.
  - The seams, marked in the code: `TASK 28:` in `parts.tsx` and `look.ts`, for `Kbd`, `Text`, and
    `Icon` (`look.ts` reads the tokens already, ruling R155, and task 27 put the views on
    `Overlay`); `TASK 30:` in `KeyMap.tsx` and `KeyPicker.tsx`, for the shared text field;
    `TASK 33:` in `look.ts`, for the width.
  - For task 33: a side column's keys go in a `pane` scope whose `on` is the column's focus, the
    page's own movement keys in a `pane` beside it, and `h l column` is a `hint` of the key that
    crosses.
  - A file that hears keys which are no shortcut, as the text field's own, adds its line to
    `ALLOWED` in `crates/app/tests/keys.rs`.

- [x] **Step 1: Write the failing tests**: `a key means one thing on a page` (two registrations of
      one key in one scope fail); `a sequence waits for its second key, then gives up`;
      `single-key     shortcuts can be switched off, and a chord then opens the leader menu`;
      `a text field with the focus gets keys first`;
      `a key registered by a view goes when the view goes`.
- [x] **Step 2: Run them**. Expected: FAIL. They failed before the code, on the missing module
      (`Could not resolve './store'`), not on a behaviour; each behaviour was then seen failing
      through a break: every key heard in a text field, a key not removed with its view, a pending
      sequence hearing only its bound keys.
- [x] **Step 3: Implement.** A text field with the focus gets keys first.
- [x] **Step 4: Run the task's validation**: `just task-app`, and `just task uraeda-app` for the
      structural test. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): the key registry and the leader menu`.

## Task 33: The layout shell: panes in two stacks

Rewritten on 2026-11-11, after the human asked for "a clear concept of panes, tabs, and sidebar",
with a behaviour "inspired by tiling WMs like hyprland or i3, with two stacks (the center column +
right sidebar)". This task builds the model and the frame that draws it. Task 66 adds the moves.

**What other apps teach**, read before designing:

- **Zed** splits its window in a centre of panes, whose items are tabs, and docks at the edges,
  whose panels have no tab bar: one shows at a time. A panel says which docks it may sit in, and any
  pane can be zoomed to the whole window
  ([its panel system](https://zed.dev/blog/new-panel-system)).
- **VS Code** keeps a location per view, moved by drag between its side bars and its panel, saved
  across sessions, with "Reset Location" for one view and for all
  ([custom layout](https://code.visualstudio.com/docs/configure/custom-layout)). A view dragged into
  the editor area works from one side bar and not the other: two mechanisms for one idea.
- **Kiro** opens a chat of its panel as an editor tab: the panel and the tab show the same session,
  and closing the tab leaves the session in the panel
  ([chat in the editor](https://kiro.dev/docs/chat/chat-in-editor/)). A pane is a view of a thing,
  never the thing: it holds no state of its own.
- **Tiling window managers** move by the keyboard: focus goes in a direction, the focused window
  moves to the other stack or swaps with the main one, and a group shows its windows as tabs or side
  by side. Nothing needs a drag.

**The model**, small on purpose:

- **A pane** is a kind and its arguments, like a route: `{ kind: "transcript", session }`. Its kind
  is declared once, with `definePane`: its title, its icon, the component that draws it, and where
  it sits by default. Two panes with equal kind and arguments are the same pane.
- **A stack** is an ordered list of panes, shown as tabs, one at a time, or split, all at once.
  There are two: **main**, the centre, and **side**, at the right. The side stack folds away, and on
  a narrow window both become one stack of tabs.
- **A layout** is the two stacks, which pane each shows, which pane has the focus, and whether one
  is zoomed to the whole window. It is plain data, and every change of it is a pure function:
  `focus`, `show`, `move`, `reorder`, `split`, `fold`, `zoom`, `reset`.
- **A place declares its panes, and never places them.** A screen gives the panes of its route and
  their default stacks: a session's transcript in main; its activity, changes, sub-agents, and plan
  as tabs of side. The shell draws them. So a pane works in either stack, at any width its stack may
  have, and keeps what it shows in the store and the visit's entry, never in a component that a move
  would unmount.
- **The navigation rail, the status line, and overlays are not panes**: they are the frame.

**Files:**

- Create, as built: `app/ui/layout/`: `layout.ts` (the model), `panes.tsx`, `Stacks.tsx`,
  `Stack.tsx`, `keys.tsx`, `Rail.tsx`, `SideRail.tsx`, `StatusLine.tsx`, `bars.tsx` (`NavBar`,
  `BottomBar`), `index.ts`, and the tests' page `__checks__/layout.tsx`; `app/gallery/layout/`; the
  guide `specs/ui/panes.md`
- Modify: `app/ui/width.ts`, `app/ui/surfaces/Pane.tsx`, `Kept` and `DeviceKeys` in `app/store/`,
  the `justfile`'s `gallery-shots`
- Test: `app/ui/layout/layout.test.ts`

**Interfaces:**

- Consumes: surfaces (27), controls (28), the key registry's pane scopes (32), `route` and a visit's
  entry (24), the device store (24).
- Produces, as built (rulings R187, R188, and R178 to R180), all from `app/ui/layout` (`index.ts`):
  - `definePane<Args>({ kind, title, icon, view, stack, closes?, flush?, mark? }): PaneKind<Args>`,
    a factory: `transcript({ session })` is a `PaneRef` (`kind`, `args`, `key`, `closes`). `view`
    gets `{ args, focused, width }`, `width` its stack's class. `mark(args)` gives
    `{ count?, needs?, running? }`, read as a signal.
  - `definePlace(page, (route: RouteOf<page>) => Placed[])`, a page's panes in order, each a
    `PaneRef` in its kind's stack or `{ pane, stack }`; `placeOf(route): Place`, `{ main, side }`.
  - In a pane's view: `usePane()`, with `key`, `focused()`, `width()`, and
    `remember(name, initial)`, a value kept in the visit under the pane's key; `PaneScroll`, a
    `Scroll` that keeps its offset there.
  - `Layout` (`main`, `side`: `Stack` of `panes`, `shown`, `split`; `focus`, `onTabs`, `folded`,
    `zoomed`, `closed`) and its pure functions: `layoutOf(place, folded?)`, `reset`, `focus`,
    `show`, `cross`, `step`, `toTabs`, `move`, `reorder`, `split`, `fold`, `zoom`, `close`, `sync`,
    `narrowed`, `neighbour`, `beside`, `stackOf`, `focusedStack`, `isShown`, `paneKey`.
  - `Stacks` (`place?`, `rail?`, `status?`), the frame: `RailSlots` (`places`, `title`, `sidebar`)
    and `StatusSlots` (`mode`, `start`, `end`, `place`) are task 36's to fill.
  - `width()`, `widthClass`, `isNarrow`, and `measured` stay in `app/ui/width.ts`.
  - `Kept.layout` and `Kept.panes` in `app/store/history.ts`; `DeviceKeys.frame` in
    `app/store/device.ts`: the side stack's width and fold, and the rail's fold.
  - `Pane` gains `tabs`, `tabsEnd`, and `onPress` (task 27's file).
  - The keys of the frame, declared in the registry: `h` `l` move the focus between the stacks,
    unfolding the side one; in a stack of tabs `j` `k` move through the focused pane's rows, and `k`
    past the first row reaches the tabs, where `h` `l` show the previous and the next, as
    [the keyboard guide](/specs/ui/keyboard.md) says. The status line names them. `h` `j` `k` `l`
    are fallbacks under a pane's own; `[` `]` fold, `{` `}` resize.

- [x] **Step 1: Write the failing tests** of the layout's functions, as a table: a move to the other
      stack; a move of a stack's last pane; the focus after a pane goes; a fold with the focus
      inside; a narrow window's one stack, and back; `reset`.
- [x] **Step 2: Run them**. Expected: FAIL. Four rows of the table failed, and both tests through
      the runner (`expected [...] to contain "back"`, `cannot scroll by 600: it is at 0 of 0`).
- [x] **Step 3: Build the model and the frame**, following [wide](/specs/ui/wide.md),
      [semi-wide](/specs/ui/semi-wide.md), and [phone](/specs/ui/phone.md). Read the window's width
      after the first layout: at the first render it is 0, which chose the wrong layout in the
      spike. A pane that moves or whose tab shows again keeps its scroll and its selection.
- [x] **Step 4: Write the guide** `specs/ui/panes.md`: what a pane, a stack, and a layout are, what
      a screen declares, and the keys, for the people who write screens.
- [x] **Step 5: Add it to the gallery**, at each width, with sample panes in both stacks.
- [x] **Step 6: Run the task's validation**: `just task-app`. Expected: PASS.
- [x] **Step 7: Commit**: `feat(nsh-migration): the layout shell, panes in two stacks`.

## Task 34: Extension pages in the client

**Files:**

- Create, as built: `crates/app/src/extension_view.rs` with `extension_view/{channel,fetch}.rs`,
  `app/extensions/{page,host,ExtensionPlace}.tsx`, `app/ui/index.ts`, `crates/protocol/src/page.rs`,
  `crates/server/src/extensions/modules.rs`, `fixtures/extensions/{counter,crashes,loops}/` (the
  plan's `throws/` is task 17's server part: ruling R213)
- Test: `crates/app/tests/extensions.rs` with `tests/extensions/`, and its app page
  `app/extensions/__checks__/place.tsx`, on GTK; `app/extensions/extensions.test.tsx`

**Interfaces:**

- Consumes: `/extensions/:name/page` and its key (task 19); the record Extensions (17); the result
  of task 2's first two checks: ruling R22 names the calls that verify and load a package. Ruling
  R23's log is not used: NSH's runner keeps the process's logger (ruling R207).
- Owes task 19 (ruling R116), done (R211): `app/ui/index.ts`, what a page gets of `uraeda/ui`, and
  `app/extensions/page.tsx`, `uraeda/page`; both folders in the server's binary, written as it
  mounts to `<data folder>/extensions/modules/{ui,extensions}/`; `uraeda/native`'s description among
  the page build's UI sets.
- Produces, as built (rulings R207 to R213):
  - The native component `uraeda.extension` (`#[native_components(linux)]` of `crates/app`, behind
    its default feature `host`): props `server`, `token`, `name`, `version`, `params`; events
    `ready`, `problem` (`unreachable`, `untrusted`, `load`, `threw`, `slow`, `stopped`), `message`;
    commands `send` and `reply`. It fetches and verifies the page itself, under the server's key
    only, and runs it with NSH's limits and the package's rights.
  - `uraeda/page`: `place`, `homePane`, `newSection`, `statusItem`, `itemRenderer`,
    `settingsSection`, `key`, `onUnload`, `useRecord`, `useAction`, `useExtensionSettings`,
    `useRepository`, and `useProps` and `navigate` (R212). A part's view is `view`.
  - The channel, `PAGE_HOST` and `page_entry` of `uraeda-protocol` (R208): the app answers `record`,
    `call`, and `navigate`, and sends `show`, `ping`, `theme`, `props`, `record`, `key`.
  - `ExtensionPlace` (`host`, `extension`, `repo`, `part`, `props`, `onReady`, `onProblem`): one
    part of a page, its problem shown in its place and reported with `extensions.reportPageProblem`.
    A place is a pane whose view is this (R209).
  - `ExtensionHost` (`host.tsx`), what task 23 provides: `server()`, `read(name, args, seen)`, and
    `call(name, input)`.

- [x] **Step 1: Write the failing tests**
  - `a saved page shows without a restart`.
  - `a page that throws at load is named, and the app goes on`.
  - `a page that never stops is cut off and named`.
  - `a page reads a record and calls an action of its extension`.
- [x] **Step 2: Run them**. Expected: FAIL. With no component registered, all four timed out
      (`a page is drawn`, `the page reads its record`, `crashes's problem is reported`).
- [x] **Step 3: Implement**, from the spike's `src/ext.rs`. The page takes the app's theme, so it
      looks like the app. The client trusts only the server's key. Read NSH's embedding and sandbox
      pages first: this is the part most likely to have changed.
- [x] **Step 4: Run the task's validation**. Expected: PASS.
- [x] **Step 5: Commit**: `feat(nsh-migration): extension pages in the client`.

## Task 35: The gallery

**Files:**

- Create, as built: `app/gallery/Gallery.tsx` (the app: an `App.tsx` there made NSH take
  `app/gallery/` for an app of its own, without the app's crate), `catalogue.ts`, `pages.tsx`,
  `parts.tsx`, `keys/keys.tsx`, `scenes/session.tsx`, `gallery.test.tsx`, `frames.test.tsx`;
  `scripts/frames.sh`. No `app/tools/`: the recipes need no code beyond the tests and one script.
  The task-by-task pages stay in their folders, each now a function of whether its stack is narrow,
  with no `mount` of its own; `app/gallery/samples/` is gone (ruling R235).
- Modify: `justfile`; `specs/ui/components.md`; the shell, the registry, and the components its
  first use found wrong (ruling R237)

**Interfaces:**

- Consumes: every component of tasks 26 to 34.
- Produces: `just gallery` (the gallery on GTK); `just gallery-shots [word]` (a picture of every
  page, in both themes, at 1400, 900, and 390 points, in `target/shots/gallery/`, as
  `<group>-<page>-<theme>-<width>.png`); `just frames <scene>` (the frame cost of `streaming`,
  `scrolling`, or `glass`, as median, 95th, 99th percentile, and worst: bounds read from NSH's
  windows of frames, ruling R236). They replace `samples-shots`, `samples-frames`, `lists-frames`,
  and `document-frames`.
- Produces for the screens: `app/ui/keys/index.ts` and `app/ui/text/index.ts`, each folder's entry;
  a surface's `icon` is an icon's name or a view (`SurfaceIcon`); `RailPlace.keys`.

- [x] **Step 1: Assemble the gallery**: one page per component, and three scenes: a session with
      20,000 messages streaming, the same scrolling by itself, and a glass panel over it.
- [x] **Step 2: Write the two tools**, from the spike's `tools/` and its self-scrolling switch. They
      never open a window on the human's display.
- [x] **Step 3: Run `just frames`** on the three scenes. Expected: at most 8.3 ms at the 99th
      percentile. Record the numbers in the commit's body. In software, `streaming` passes (p99 at
      most 6.03 ms); `scrolling` and `glass` do not (at most 10.04 and 11.93 ms), ruling R239: a
      GPU's frames are task 53's. Task 53 measured them on the GPU, on an optimised build, quiet:
      p99 at most 1.59, 3.28, and 3.74 ms, 120 frames a second (ruling R416).
- [x] **Step 4: Review every picture yourself**, against the design language and its mockup, and fix
      what drifts. Then ask a second reviewer, with no part in building the library, to compare the
      pictures with the design language, and fix what it finds.
- [x] **Step 5: Commit**: `feat(nsh-migration): the component gallery`. Keep the pictures in
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
  - The sidebar's Usage pane, one line per login with its five hours, "default 5h 58% · 15:08", "b
    signed out", and the closed rail's bar for the account of the session in view, as
    [`sidebar/Allowance.tsx`](/packages/web/src/sidebar/Allowance.tsx) and the
    [multi-accounts record](../done/2026-11-10-multi-accounts.md) have them.
  - The sign-in and pairing screens; the first-run, unknown-repository, and missing-folder pages;
    "Nothing here"; the server-error banner; the "update this side" page for a refused version.
  - `just app-shots <route>`: a picture of a route on the sandbox, on an invisible display.

- [x] **Step 1: Write the failing tests**
  - `the app starts a server when none runs`, with a row where the server stops while the app is
    open: the app says so, then starts or waits for one.
  - `a refused version shows which side to update`.
- [x] **Step 2: Run them**. Expected: FAIL. Seen failing before the code: the shell's two tests with
      nothing drawn (`on screen: []`), the host's two with `not built`, and the server's key-pairing
      rows with 401.
- [x] **Step 3: Build the host and the shell.** The app owns a server it started, and stops it when
      the last window closes; it never stops a server it found running. The device's token is kept
      in the system's secret store, never in a plain file.
- [x] **Step 4: Review it in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 102 tests passed;
      `just task uraeda-app uraeda-server`: 349 passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): the app's shell and its server start`.

**As built** (rulings R246 to R253):

- `uraeda [--server <address>] [--data-dir <folder>] [--port <port>] [--ura <command>] [--app <folder>]`,
  `just app`. The host answers the TSX's `host.call` of `uraeda.server`, `uraeda.token`,
  `uraeda.pair`, and `uraeda.forget`; `crates/app/src/server_start.rs` has `Local`, `LocalOptions`,
  `Running`, `answers`; `crates/app/src/host.rs` has `Host`, `Target`, `Pairing`, `Args`, `run`. The
  token is in the Secret Service (`host/secrets.rs`). `POST /pair` takes `{ key }` too.
- `app/App.tsx` boots (`app/screens/shell/boot.ts`: the device, the theme shown last, the fonts),
  then mounts `Root` (`app/screens/shell/Root.tsx`), which mounts `KeysHost` and `LeaveGuard` once,
  and draws, in order: "Starting Uraeda's server", the pairing page, "Reaching Uraeda's server", the
  "Update this app" or "Update the server" page, or the frame (`Frame.tsx`), drawn again under each
  new connection, with the "server stopped" banner over it while the server is gone.
- **A screen task adds one line to `app/screens/routes.tsx`**, an import of its folder under its own
  comment: `import "./inbox";` under `// Task 39: Inbox and triage.`. Its modules call `definePane`
  and `definePlace` (`specs/ui/panes.md`); a page with no place shows "Nothing here".
- **Its pictures**: `just app-shots /r/sample/inbox`, both themes at 1400 and 390 points, as
  `target/shots/app/r-sample-inbox-<theme>-<width>.png`; `just app-shots states` for the shell's
  own.
- The frame's slots: the rail's places from `app/screens/shell/places.ts` (a place has its `g` key,
  and `Space` with it but for New); the sidebar's Needs you, Features, and Usage (`Sidebar.tsx`,
  `usage.ts`); the status line's branch, "N need you", extensions' status items, and the connection
  (`Status.tsx`). The leader's tree is `keys.tsx`, its pickers `pickers.tsx`.
- `app/ui/layout/`: `RailSlots.bar` and `RailSlots.onTitle`; the status line's slots read one by
  one; the phone's bar of places scrolls sideways.
- Fixed after review (R262 to R268): the phone's bar puts Decisions, Jobs, and Settings in a `…`
  (`RailPlace.onPhone`); every time shown is `serverTime` from `app/store`; a server on a new port
  keeps the same connection (`Connection.moveTo`); `just app-test` runs a sandbox with sign-in too.

## Task 37: Home and priorities

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{home,priorities}/`
- **Read:** [`Home.tsx`](/packages/web/src/Home.tsx), `home/`, `PrioritiesPage.tsx`, `lists/`,
  `pane/DetailRoutes.tsx`
- **Records and actions:** Workspace, Priorities, NeedsYouList, ProposalHints; `priorities.*`,
  `proposals.move`, `proposals.outline`
- **Routes:** `/`, `/priorities`, `/priorities/<key>`
- **Its own rules:** priorities show as columns or one list, switched with `v`. Order changes by
  drag, by long press, and by keys. Home's inbox pane adds a note in one tap. Home's Usage pane
  lists each account under its agent's mark, by name, with its five hours and its week, as
  [`home/Usage.tsx`](/packages/web/src/home/Usage.tsx) and the
  [multi-accounts record](../done/2026-11-10-multi-accounts.md) word it: "5h 58% left - reset
  15:08", a used-up week in the error colour, "b · signed out", "c · no folder".
- **Records and actions, also:** Agent, with its accounts (task 62).
- **Tests:** `a reorder is saved once, in the order shown`.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names, and
      `a refused reorder puts the rows back and     says why under them`.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS.
- [x] **Step 6: Commit**: `feat(nsh-migration): home and priorities`.

**As built** (rulings R269 to R275):

- Home (`app/screens/home/`): the panes `home-needs-you` and `home-in-progress` in the main stack,
  `home-inbox`, `home-now`, and `home-usage` in the side one, both split from the start
  (`definePlace(page, panes, { split })`, new). Extensions' `homePane`s (task 51) join the side
  stack's place in `index.tsx`.
- Priorities (`app/screens/priorities/`): the pane `priorities` (`{ repo, open? }`);
  `/priorities/<key>` shows `proposal-summary` in the main stack and the priorities in the side one.
  **Task 38** declares a kind of pane named `proposal`, with the arguments `{ repo, key }`, and it
  takes the summary's place, with no change to these files.
- Git's place is `g c`: `g g` is every list's first row.
- `usageByAgent` (Home's Usage) is beside `usageLines` in `app/screens/shell/usage.ts`; `iconNamed`
  reads `uraeda:harness-<mark>`.

## Task 38: Proposals, and starting work

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{proposal,new}/`
- **Read:** `pane/ProposalPane.tsx`, `ProposalEditor.tsx`, `NewPage.tsx`, `StartDialog.tsx`,
  `NewFeatureComposer.tsx`
- **Records and actions:** ProposalFile, StartPlan, SlugProposal, FolderSuggestions; `proposals.*`,
  `feature.start`, `feature.startText`, `change.start`, `session.new`
- **Routes:** `/priorities/<key>` as an overlay or a page, `/new?kind=session|change|feature`
- **Its own rules:** Enter in a proposal's slug starts nothing, and `Ctrl+Enter` or `:w` in its text
  saves it: only the Start button, or `Ctrl+Enter` in the slug, starts. A feature's and a change's
  start dialog holds the run map under its field, the settings' own component (task 44's, as
  [`runs/RunMap.tsx`](/packages/web/src/runs/RunMap.tsx) is today), in a dialog as large as the map
  needs, up to most of the window. The field keeps the first focus and Enter, and the map its keys.
  There is no one-line strip of run options. A new session runs on `runs.default_agent`.
- **Tests:** `leaving an edited proposal asks first, and keeps the text`;
  `Enter in a proposal's slug starts nothing`.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 117 tests passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): proposals, and starting work`.

**As built** (rulings R315 to R322):

- `app/screens/proposal/`: the pane `proposal({ repo, key })`, main, which takes the summary's place
  at `/priorities/<key>`: the proposal file edited in place (`FileEditor.tsx`) and its start
  (`StartPart.tsx`). `app/screens/new/`: `new({ repo })` main and `new-sources({ repo })` side, the
  kind read from the address; `StartDialog`, `Landing` (a start's steps landing), and `draft.ts`
  (`startFromLine`, which a proposal with no file starts through).
- **The run map** is `app/screens/runs/RunMap.tsx`,
  `RunMap { value, over?, onChange, runtimes, defaultAgent, kind?: "feature" | "change", column?, active, cursor?, refusal?, disabled? }`,
  over the protocol's `RunOptions`; `SettingsMap` is the settings' (in `Runs.tsx`), `ContinueDialog`
  the feature page's continue, which replaced its plain start.
- `app/screens/images.ts` holds every screen's image helpers, with `attachToFile` and `keepForChat`.
  `LeaveGuard` resolves its answer now (R322).
- A proposal's nested lines (R409): `Nested.tsx`, an outline over `proposals.outline` in the
  proposal's pane.

## Task 39: Inbox and triage

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{inbox,triage}/`
- **Read:** `InboxPage.tsx`, `pane/EntryPane.tsx`, `TriagePage.tsx`, `attach/`
- **Records and actions:** Inbox, Dropped; `inbox.*`
- **Routes:** `/inbox`, `/inbox/<key>`, `/inbox/triage`
- **Its own rules:** an image is added by drop, by paste, and by a picker, and uploaded through
  `POST /r/:name/inbox/note-image`. The inbox's actions are one row of icons beside its title:
  Organize with AI, New category, and a note's add, which comes first and takes one tap. "New
  category" among the categories comes after the notes, never where the add is expected.
- **Tests:** none: using the screen shows every behaviour.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names: none, and none added. A note typed and not added
      is kept by the shared field's unsaved store, whose own test guards it after a restart.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says:
      `just     app-shots` of `/r/realistic/inbox`, `/inbox/<key>`, and `/inbox/triage`, and an
      errand driven by keys on the hidden display (add, delete, undo, a triage answered by its
      letter).
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 102 tests passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): inbox and triage`.

**As built** (rulings R276 to R283):

- `app/screens/routes.tsx` imports `./triage`, which imports `./inbox`: one line for both folders.
- Panes: `inbox` (`inboxList({ repo })`, main), `inbox-note` (`inboxNote({ repo, key })`, side),
  `inbox-triage` (`triage({ repo })`, main). Places: `inbox` is the list; `note` the list and the
  note; `triage` the triage and the list in side. `openNote(repo, key)` opens a note's pane.
- `Space n i` (`app/screens/shell/keys.tsx`) opens the inbox with its add field focused.
- `app/nsh.json` reads files dropped from the home folder and `/tmp` (`fs.read`).
- In `app/ui/`: `listKeys` had no `g g` (R281), back since the join of tasks 40 to 48;
  `SelectableCard`'s title wraps (R282); `Banner` reads its action once (R283); the icons
  `image-plus` and `sparkles`.
- Left for task 50 (`TASK 50:` in `app/screens/inbox/actions.ts`): the inbox's last action and its
  `u` go to the app's undo stack.

## Task 40: The feature page

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/feature/`
- **Read:** `feature/FeaturePage.tsx` and its panes
- **Records and actions:** Feature, Ledger, History, WorkflowMessage, RecommendedMessage;
  `feature.*`
- **Routes:** `/f/<folder>`, `/f/<folder>/runs/<id>`
- **Tests:** none named; one added, `app/screens/feature/feature.test.tsx`,
  `every pane of the feature page draws, and the keys reach each` (a key that means two things
  throws only once its pane is drawn).

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 103 tests passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): the feature page`.

**As built** (rulings R284 to R289):

- `app/screens/feature/panes.tsx` declares `feature-overview` and `feature-steps` (main),
  `feature-sessions`, `feature-decisions`, and `feature-figures` (side), each with
  `{ folder, repo }`, and `definePlace("feature", ...)` in that order. `/f/<folder>/runs/<id>` is
  the session page's, as task 24 parses it: no pane of this task.
- Seams left: `TASK 38:` in `Overview.tsx`, where **Next**'s continue sends the recommended message
  with `session.send` (the start dialog replaces it); `TASK 44:` in `Steps.tsx`, where the run map
  takes the Steps pane's place. A workflow file opens by `navigate({ page: "file", folder, name })`
  and a mockup by `page: "mockup"`: task 41 declares their panes.
- Keys: `n` the next action (Overview), `m` and `f` its folds, `S` a new session, `Enter` on a card,
  a step's file, or a decision. Git's go key became `g c` (R288).
- "Postpone the feature…" (`Postpone.tsx`, R405) beside Drop, over the record `ErrandMessage`
  (R404): a dialog with the message, then the feature's latest session.

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
- **Tests:** none named; one added, `a link to a heading scrolls the reader to it`, in
  `app/ui/document/document.test.tsx`.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names. The added one failed with the scroll removed.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 118 tests passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): workflow files`.

**As built** (rulings R328 to R330):

- `app/screens/file/panes.tsx` declares `file-reader` (main), `file-outline`, `file-tasks`,
  `file-review`, and `file-decisions` (side), each with `{ folder, name, repo }`, and
  `definePlace("file", ...)`: `spec.md` has the reader, Outline, Review, and Decisions; `plan.md`
  the reader, Tasks, and Outline; any other file the reader and Outline. One `Reader` draws every
  kind (`DocumentPage`, `SpecPage`, `PlanPage`, and `DataModelPage` are not separate files).
- `app/ui/document` exports `DocumentScroll` and `DocumentScrollRef` (`toBlock`, `toAnchor`,
  `scrollTo`); `app/store` exports `imageOf`, `chatImage`, `signIn`, and `repositoryAddress`:
  reading an image with the sign-in is the store's (`app/store/images.ts`), sending one (picked,
  pasted, dropped, attached) is `app/screens/images.ts`'s. The gallery's scene `reading`, and
  `just frames reading`, time a plan of 2,700 lines.
- Seams left: `TASK 42:` in `Reader.tsx` (the main action, and comments and question cards under
  their blocks through `mark`) and in `panes.tsx` (a round's pane, a review's pane). The join wired
  task 49's: a story or a mockup a paragraph links alone shows live in place (`override`), and a
  story link opens its page. The decisions' readers (in force, the constitution, a branch's) draw
  through `DocumentScroll` too, so every document scrolls to the address's `#heading` alike.

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

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names, in `app/screens/round/round.test.tsx`, over the
      sample's `2026-10-17-round-mockup` round (its submit refused by the check page). Each failed
      with its guard removed.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says:
      `just     app-shots` of the sample's round and the realistic leader key's spec.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 131 tests passed;
      `just task uraeda-server uraeda-protocol`: passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): rounds and reviews`.

**As built** (rulings R375 to R379):

- `app/screens/round/` exports `Answering` (`{ args: { repo, id }, file, optionExtra? }`, a round
  waiting), `Answers` (read-only), `roundPane` (`round`, main, a feature's round), and
  `roundQuestionsPane` (`round-questions`, side); `roundMains` maps a default round's id to its
  screen's main pane. `id` is the `WorkflowFile` id: `<folder>/<name>`, `inbox-triage`, or
  `decisions-check`. The file place gives `clarifications-NN.md` the round's two panes; a plan's
  page gains the Review pane; the Review pane comes first in the side stack.
- `answer.save` and `defaultRound.answer` answer `AnswerSaved { answer, hash }`.
- `app/screens/review/`: `reviewMark`, `reviewable`, `CommentField`, `Verdict`, `Given`, and the
  reader's cursor (`J` `K`, `c`, a press). `app/screens/round/NextRun.tsx` is the agent's next run
  on a button, opening the continue dialog.
- Asking the agent (R403): `useAsk(repo, folder)` (`app/screens/session/ask.ts`) puts a quote at the
  start of the feature's session draft and opens `sessionBeside` beside the pane, its composer
  focused; a feature's round asks on a question (`s`, a button) and on a settled point, the reader
  on the part at the review's cursor (`s`), and each comment field has "Ask the agent instead".
- The device keeps `round.at:<repo>\n<id>`. `SelectableCard` takes `children`; `app/ui/document`
  exports `Phrase`; `DocumentHands` take `onPress` and `selected`.
- With task 50 (R380 to R383): `app/screens/review/writes.ts` (`addComment`, `editComment`,
  `removeComment`) and `Saves.unsettle` give their changes to `remember`; the reader's pane declares
  the page's `action`, "Verdict", on a phone; a held selection's keys are hinted in the status line.

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
  blocks. Images are attached through `POST /r/:name/attach`. The header names the account after the
  agent, "Claude Code · b · Opus 5.5 · High", and follows it when a limit moves the session to
  another account. `l` crosses from the page into the session's side column, unfolding it, and `h`
  back; there `j` `k` move from row to row, and `k` past the first row reaches the tabs, as
  [the keyboard guide](/specs/ui/keyboard.md) says and
  [`layout/columnKeys.ts`](/packages/web/src/layout/columnKeys.ts) does. The column's keys are a
  part of the layout shell (task 33), not of this screen.
- **Tests:** `a streaming reply stays in view`; `a reader who scrolled up is not moved`;
  `a message typed during a reply is sent once`.
- **Extra step, before the commit:** draw the gallery's scenes (`app/gallery/scenes/session.tsx`)
  with the real transcript's rows, then run `just frames streaming` and `just frames scrolling` on
  its 20,000 messages. Expected: at most 8.3 ms at the 99th percentile.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 118 tests passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): sessions`.

**As built** (rulings R331 to R340):

- `app/screens/session/`: `index.tsx` (the panes and the places), `place.ts`, `pages.ts` (the window
  of pages), `Transcript.tsx` (the pane), `Rows.tsx` (a row), `Head.tsx` (the head and the banners),
  `Composer.tsx`, `Permission.tsx`, `Offer.tsx` with `offers.ts`, `SessionsPage.tsx`, `attach.ts`,
  `words.ts`, and `session.test.tsx`.
- **The panes**: `session-transcript` (main) and `sessions-list` (side), with
  `SessionArgs = { repo, session, folder, fresh }`, `session` "" for a feature's latest. The pages
  `sessions`, `session-id`, and `session` (with `?new`).
- **For task 44**: `import { addSessionPanes, sessionIdOf, type SessionArgs } from "../session"`,
  then `addSessionPanes((args) => [activity(args), ...])` at its module's top level: its panes
  follow the list in the side stack on every page of a session. `sessionIdOf(args)()` is the
  session's id, `undefined` while its feature is read, `null` before its first message.
- **For the gallery**: `just frames streaming` and `just frames scrolling` draw `TranscriptRow` over
  a fixture `Feed` of the server's items' shape (`app/gallery/scenes/session.tsx`).
- `VirtualList` gains `onShown(first, last)`.
- **The extra step** (R340), in software: `streaming` at most 5.64 ms at the 99th percentile;
  `scrolling` at most 12.54 ms, over the stand-in's 10.04 ms by the Markdown of each message.

## Task 44: Session panels and runs

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/session/panels/`, `app/screens/runs/`
- **Read:** `session/` (activity, changes, subagents, start steps, `AgentCall.tsx`), `runs/` (the
  run map, `AgentCard.tsx`, sub-sessions)
- **Records and actions:** Session, Turn, BranchChanges, AllBranchChanges; `session.allow`,
  `session.allowAll`, `session.toChange`
- **Its own rules:** the run map is one component, used by the settings and by the start dialogs
  (task 38). Task 38 built it: `RunMap` in `app/screens/runs/RunMap.tsx` (ruling R318), drawn by the
  settings, the typed starts, and a feature's continue; this task puts it in the feature's Steps
  pane (its `TASK 44:` mark), with what the feature already ran locked. A session's sub-agents are
  framed cards, with their start and their end, in the order they started; the tab follows its end
  as the Activity does, and has no Changes under it. A reviewer's title shows no commit. In the
  Activity, a `run_agent` call shows its sub-session on one line, a link to its page, and its target
  is its task.
- **Tests:** none named; one added, `app/screens/session/panels/panels.test.tsx`,
  `the sub-agents read in the order they started`, reached by the keys alone.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app` and
      `just task uraeda-core uraeda-protocol uraeda-server`.
- [x] **Step 6: Commit**: `feat(nsh-migration): session panels and runs`.

**As built** (rulings R364 to R369):

- `app/screens/session/panels/`: the side panes `session-activity`, `session-changes`, and
  `session-subagents`, each `SessionArgs`, added with `addSessionPanes`; `transcriptFeed` takes
  `{ keep, heads }` for the Activity (`pages.ts`).
- `GitDiffArgs.branch`: a feature's file from where its branch left the default branch
  (`api::branch_diff`).
- `app/screens/runs/`: `AgentPick` (an agent, a model, an effort: the run map's detail, a job's
  "Runs on", the New page's session), `FeatureMap` (the feature's Steps pane), `history.ts`
  (`stepStates`, `isLocked`, `runsByStep`, `stepOfTurn`); `RunMap` gains `locked`, `under`,
  `onEnter`.
- The sandbox's "Keyboard shortcuts" has a plan and a build session, and three sub-sessions.

## Task 45: Decisions

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/decisions/`
- **Read:** `decisions/DecisionsPage.tsx`, `decisions/CheckPage.tsx`
- **Records and actions:** Workspace, WorkflowFile; the decisions check's actions
- **Routes:** `/decisions`, `/decisions/<name>`, `/decisions/constitution`, `/decisions/check`
- **Its own rules:** the list sits beside the reader when there is room. The sort is kept per
  device.
- **Tests:** none.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names: none.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 102 tests passed;
      `just task uraeda-server`: 312 passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): decisions`.

**As built** (rulings R290 to R293):

- Panes: `decision { name, repo }`, `constitution { repo }`,
  `branch-decision { folder, name, repo }`, and `decisions-check { repo }` in the main stack;
  `decisions-list { repo }` in the side stack, on every page of `/decisions…` and on
  `/f/<folder>/decisions/<name>`. On a phone, `/decisions` shows the list first.
- The redirect R126 left: a branch with no such decision opens `/decisions/<name>`, in the visit.
- The order is the device's `decisions.sort`. The check's question cards are task 42's, where
  `Check.tsx` is marked `TASK 42:`; "Review with AI" is not built (R292), and came back with "Apply
  the answers" in `Errand.tsx` (R406): `useErrand`, `ErrandButton`, over `ErrandMessage`.
- `listKeys` bound no `g g` (R293), back since the join of tasks 40 to 48; the icon `cable` joins
  `app/ui/controls/icons/lucide.ts`.

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

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 104 tests passed;
      `just task uraeda-server`: 312 passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): git`.

**As built** (rulings R294 to R300):

- `app/screens/git/panes.tsx`: the place `git` shows `git-diff` (Diff) in the main stack, and
  `git-changes` (Changes), `git-history` (History), `git-worktrees` (Worktrees) as tabs of the side
  stack, Changes focused as it opens. Each takes `{ repo }`.
- `app/ui/layout/`: a `Placed` may say `focus: true` (`Place.focus`), and `focusPane(ref)` focuses a
  pane of the page shown.
- `app/ui/document/Diff.tsx`: `Diff { patch, path, wrap?, keys? }`, a unified patch of one file or
  several, which the session's changes (task 44) can draw too; its gallery page is Documents, "A
  diff".
- `app/ui/lists/Tree.tsx`: a node's `markLabel` with the tree's `onMark` makes its icon a button.
- The Git place's key is `g c` since the join of tasks 40 to 48 (R295). The sandbox's `sample` has
  two uncommitted changes.

## Task 47: Editors

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/screens/{editor,buffer,conflict}/`
- **Read:** `EditorPage.tsx`, `buffer/BufferPage.tsx`, `fields/editor/` (the merge-conflict bar)
- **Records and actions:** Buffer, ConflictFile; `buffer.save`, `text.*`, `git.saveConflict`
- **Routes:** `/edit/<path>`, `/buffer/<path>`
- **Tests:** `a file changed on disk while it is edited is not overwritten silently`.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS.
- [x] **Step 6: Commit**: `feat(nsh-migration): editors`.

**As built** (rulings R323 to R327):

- `Buffer` reads any text file of the main checkout, only read outside the Markdown of `specs/`, and
  carries `worktree`, `checkedOut`, and `readOnly` (commit
  `feat(nsh-migration): a buffer reads any text file of its repository`).
- `app/screens/buffer/`: the panes `buffer` (main) and `buffer-outline` (side, Markdown only), and
  the places `buffer` and `edit`; `/edit/<path>` goes back to its page once saved.
- `app/screens/editor/`: `FileEditor { repo, path, onLeave, leavesOnSave }`, `bufferKey(repo, path)`
  (the unsaved text's key), `askLine(key, line)`, and the changed-on-disk banner.
- `app/screens/conflict/`: `ConflictEditor { repo, path }`, which the Git page's Diff pane draws.
- `TextField` gains `language`, `onQuit`, and its ref's `goToLine(line)`; `uraeda/native` gains
  `conflictBlocks`, `takeConflict`, `textPatch`, and `outline` (`crates/app/src/editing.rs`), and
  the core `git::text_patch`.
- `Space b`, "Open as a buffer", is declared by each page of one file, with
  `navigate({ page: "buffer", path })`: the workflow file's reader, a decision in force, and the
  constitution (the join). A branch's decision does not: the buffer reads a decision on the default
  branch.

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
  paired devices, and revokes one. The runs category holds the run map, the default agent's row
  (`runs.default_agent`, the first agent on when unset), and "Run scheduled jobs". The extensions
  category shows a banner per problem of an account, for the built-in agents and any extension's:
  "Claude Code: account b is signed out, in ~/.claude-b". A setting's control moves at once, and a
  refusal puts it back and shows under it.
- **Tests:** none.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names: none; one the briefs allow,
      `a setting refused by the server goes back, and says why under itself`.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 103 passed;
      `just task uraeda-server uraeda-protocol`: 319 passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): settings`.

**As built** (rulings R301 to R306):

- `app/screens/settings/`: the panes `settings-category({ category })` (main) and `settings-index`
  (side; main alone at `/settings`), each category a module, every setting one `SettingRow` on one
  cursor (`Row.tsx`: `SettingRow`, `SettingRows`, `Unlisted`, `fromWords`). Task 44 puts the run map
  under the row "How each step runs", marked `TASK 44:` in `Runs.tsx`.
- `look.ts`: `chooseMode`, `chooseTheme`, `chooseFont`, `themeChoice`, `fontPicked`, which the
  shell's leader keys and pickers call. `follow.tsx`: `FollowKeyboard`, drawn by the frame.
- `app/ui/lists/ThemeSample.tsx`, a theme in its own colours; `Select`'s `opener`; a list's `g g`
  was a fallback, the shell's Git first, until the join of tasks 40 to 48 made Git `g c` (R304).
- The server: a run option's model or effort sent as `""` is the agent's own default, stored as that
  default over a fallback that sets one on the same agent (`settings::options::left_to_agents`): the
  run map (task 44) sends `""` for "the agent's default".

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

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names: none, and the server's
      `a_preview_that_stopped_restarts_when_it_is_shown` and `mockup_answers_its_shape`.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 116 tests passed;
      `just task uraeda-server uraeda-protocol uraeda-app`: 367 passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): previews`.

**As built** (rulings R341 to R346):

- `app/ui/surfaces/WebFrame.tsx`:
  `WebFrame { src | html, title, width?, height?, scrollable?, onMessage?, onKeys?, onScale?, ref }`,
  its ref `{ focus, reload, post }`; gallery Surfaces, "Web frame". Task 57 gives it a frame on the
  web, with the same props.
- `app/screens/preview/`: the places `storybook` (panes `preview-story`, main, and
  `preview-stories`, side) and `mockup` (`preview-mockup` and `preview-mockups`); `LiveFrame.tsx`,
  the live page with its widths; `states.tsx`, a preview's words and `Restart` (`r`).
- **For task 41**, from `app/screens/preview/index.tsx`: `StoryEmbed { repo, folder, link }`, with
  `link` a version's `StoryLink`, and `MockupEmbed { repo, folder, mockup }`, with `mockup` its
  `MockupEmbed`; `folder` is the file's checkout, `main` for the main checkout. `Document`'s
  `override(block)` returns one for a block that a version's `stories` or `mockups` names.
- Records: `Mockup { repo, path }` gives `{ frame }`, a mockup's address with the frame secret;
  `Preview` gains `command` and `folder`. The proxy starts a stopped preview again when a frame asks
  for it, and counts a frame's request as a view.
- The sandbox's "sample" has `2026-10-20-sidebar-resize`, with three stories, a mockup, and the fake
  Storybook of `fixtures/preview/serve.mjs`.
- Pick mode and comments (R407): `LiveFrame`'s `comment(picked?)` adds Comment (`c`) and, once the
  page's pick script is ready, "Pick an element" (`p`); `StoryEmbed` and `MockupEmbed` take
  `comment: { on, open(about) }`; a preview's page comments through `useSpecComment`
  (`specComment.ts`). A mockup asked with `uraeda-pick` gets the pick script from the server.
- Full screen (R408): `f` on a preview's page zooms its pane, through `zoomer()` of `app/ui/layout`.

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
- **Tests:** `undo puts back what the action changed`, and
  `a refused commit stays shown until it is retried or dismissed`
  (`app/screens/shell/frame.test.tsx`).

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS.
- [x] **Step 6: Commit**: `feat(nsh-migration): notifications, undo, and writes`.

**As built** (rulings R370 to R374):

- The frame mounts, once: `UndoKeys`, `Notifier`, and `Toasts` holding `RefusedWrites`,
  `NeedsYouToasts`, `UndoToast`, and `LandingWrites`, then `UndoQuestion`
  (`app/screens/shell/{Undo,Notifications,Writes}.tsx`).
- **A screen calls `remember(change, words, options?)`** from `app/screens/shell/undo.ts` with an
  undoable action's `change` (`Recorded`, `ListWritten`, `FileWritten`, `NoteMoved`): `repo` (the
  one shown unless given), `subject`, `place`, `went`, `run` (moves of one list a second apart
  join), `quiet` (no toast). Task 42 calls it for `review.*` and `settled.remove`.
- `uraeda/native` exports `notifyDesktop(title, body)` and `nextNotificationClick()`
  (`crates/app/src/notify.rs`, which also holds `send` and `clicks`); the device keeps
  `notifications`; the settings' Appearance has "Desktop notifications".
- `Toast` takes `tone`; the sandbox's `broken` refuses every commit by its pre-commit hook.

## Task 51: Built-in extensions, and extension places

Follows [what every screen task does](#what-every-screen-task-does).

- **Files:** `app/extensions/builtins/` (decisions, git, inbox, jobs, priorities, sessions,
  notifications, previews), `app/screens/extension/`, `docs/extensions.md`
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

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names, and
      `an extension whose key clashes is named, and the others keep their keys`.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says: on a sandbox
      with the Wiki and the fixture pages `counter`, `crashes`, and `loops` loose, Decisions off in
      `sample`.
- [x] **Step 5: Run the task's validation**. Expected: PASS.
- [x] **Step 6: Commit**: `feat(nsh-migration): built-in extensions, and extension places`, after
      `feat(nsh-migration): previews warm up for what waits`.

**As built** (rulings R384 to R390):

- **The one list**: `app/extensions/contributions.ts`, `contributionsIn(repo)` and its readers
  `placesOf`, `homePanesOf`, `newSectionsOf`, `settingsSectionsOf`, `statusItemsOf`, `rendererOf`,
  `keysOf`, with `isOn(name, repo)`, `isOnIn`, `ownerOfPage`, `paged`. The built-ins are `BUILT_INS`
  of `app/extensions/builtins/`, one file each, in the old `order.ts` order.
- **The shell**: `placesIn(repo)` and `placeOfPage(page)` (now the place's name) in
  `app/screens/shell/places.ts`, which keeps Home, New, and Settings; `ShellKeys({ on })` declares
  the built-ins' keys with a guard.
- **`app/screens/extension/`**: the place `extension`; the pane kinds `extension-off` and
  `e:<name>:<id>` (`partKind`); `offPlace(route)`, which the frame asks first; `homePanesIn`,
  `newSectionsIn`, which Home and the New page list; `ExtensionKeys`, `declareExtensionKeys`,
  `keyProblem`.
- **The page API**: `Place.count` is a record's name; `ExtensionPlace` takes `pressed`;
  `ReadAllDeclarations` reads every page's parts once per version.
- **The server**: `preview/ahead.rs`, the previews of what waits, warmed one after the other.
- `docs/extensions.md` is rewritten for this API, with `examples/extensions/wiki/` as its worked
  example, run on the sandbox.

## Task 65: The Jobs place

Follows [what every screen task does](#what-every-screen-task-does). Added on 2026-11-11, from the
default branch's [scheduled jobs](../done/2026-11-10-scheduled-jobs.md) feature.

- **Files:** `app/screens/jobs/`, and its line in `app/extensions/builtins/`
- **Read:** [`packages/web/src/jobs/`](/packages/web/src/jobs/), `extensions/builtins/jobs.tsx`, and
  "Scheduled jobs" in [`docs/web-ui.md`](/docs/web-ui.md), which words every state of the place
- **Records and actions:** Jobs and its actions (task 63); Agent, for the agent, model, and effort
- **Routes:** `/jobs`, `/jobs/<name>`, where a name the address cannot carry is written with a `~`
  before it
- **Its own rules:**
  - The place is a built-in extension, reached with `Space j` or `g j`, turned off like the others.
  - A job is a card: its name, its schedule in words, the pause switch, "Next run" or why it does
    not run, and "Last run". `j` `k` move the selection, Enter opens the job, `r` runs it now, `p`
    pauses or resumes it, `d` deletes it after a confirmation, `a` adds one, each also by tap. A
    refusal shows under its card until it is dismissed.
  - A job's page is a form whose fields save as they are left, and a choice as it is made. A control
    moves at once; changes made while a save is under way wait their turn; a refusal puts the
    control back and shows under its field. A time typed `3:00` is sent as `03:00`. The page ends
    with the job's history, newest first.
  - On a narrow window the schedule's kind and day are two selectors that open as sheets, and "Run
    now" is the bottom bar's one action.
  - Times read in the server's time zone.
- **Tests:** `a field refused by the server goes back, and says why under itself`;
  `changes made during a save are sent in order`.

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names.
- [x] **Step 3: Build the screens**, as the shared step 3 says.
- [x] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [x] **Step 5: Run the task's validation**. Expected: PASS. `just task-app`: 117 tests passed.
- [x] **Step 6: Commit**: `feat(nsh-migration): the Jobs place`.

**As built** (rulings R347 to R350):

- `app/screens/jobs/`: the panes `jobs-list` (`/jobs`, main), `job-form` and `job-history`
  (`/jobs/<name>`, main and side), `job-new` (`/jobs/new`). Tests in `jobs.test.tsx`, its pages in
  `__checks__/`.
- `app/ui/controls/patched.ts`: `patched(truth, send)`, a whole of several fields saved as queued
  patches, each field a `Sent` by `field(at, get, set)`.
- `app/ui/lists/FieldRow.tsx`: `FieldRow`, `FieldRows`, `Unlisted`, the settings' row moved, shared.
- `definePane`'s `action`, `PaneAction`, `actionOf`: a page's one action, the phone's bottom bar's.
- Left to task 51: the line in `app/extensions/builtins/` that declares the place through the page
  API, and removing the place where the Jobs extension is off; until then the place says so, with
  "Turn Jobs on here".

## Task 66: Moving panes

Added on 2026-11-11, with [task 33](#task-33-the-layout-shell-panes-in-two-stacks)'s model: the
human asked that panes move between the centre and the sidebar, open as tabs, and that the sidebar
can become a full pane, as in a tiling window manager.

**Files:**

- Modify: `app/ui/layout/`, `specs/ui/panes.md`, `specs/ui/keyboard.md`
- Test: `app/ui/layout/moves.test.tsx`
- As built (rulings R391 to R396): `moves.ts` (the moves, pure), `arrangement.ts` (what the device
  keeps per kind of place), `moveKeys.tsx` (the table of `Space w` and the pane's menu), `frame.ts`
  (where the layout is kept), `arrival.tsx` (the landing's slide), `drag.ts`, `here.ts` (the pane's
  context and open beside, without the store), the check page `__checks__/moves.tsx`; `beside` on
  `List`, `VirtualList`, and `listKeys`; `DeviceKeys.layouts`; `Menu`'s `shown` and `onOpenChange`;
  a tab's `onLongPress` and `drag` in `Pane`; the pane kinds `session-diff` and `session-beside`;
  `just app-shots arranged`, a session page in four arrangements.

**Interfaces:**

- Consumes: `Layout` and its functions (33), every screen's panes (36 to 51, 65), the key registry
  and the leader menu (32), the device store (24).
- Produces:
  - The moves, by keyboard first, each also in a pane's menu, by tap: send the focused pane to the
    other stack; swap it with the main stack's shown pane; move it left or right among its tabs;
    show a stack as tabs or split; fold the side stack; zoom the focused pane to the window and
    back; close a pane a place does not require; reset this place's layout, and every place's.
  - Open any pane as a tab of a stack, from where it is named: a session, a file, a diff.
  - A layout kept per device and per kind of place, so every session page opens as the human
    arranged the last one. A pane's location is one stored fact, as VS Code's view location is.
  - Drag of a tab to the other stack, on a pointer, as a second way to do the same moves.

- [x] **Step 1: Write the failing tests**:
      `a pane sent to the other stack keeps its scroll and its     text`;
      `a layout comes back after a restart`; `reset gives the place's default`.
- [x] **Step 2: Run them**. Expected: FAIL. The four through the frame failed on the layout line (no
      key moved a pane); the table's rows passed, written after `moves.ts`.
- [x] **Step 3: Implement.** Choose the keys with the keyboard guide's layers: the moves are a group
      of the leader menu, and no single key is taken from a page. Every move is animated, short, as
      the design language's motion asks: a pane never jumps.
- [x] **Step 4: Review it in the running app**, on the sandbox, at each width, by keyboard then by
      touch: arrange a session page three ways, leave it, and come back.
- [x] **Step 5: Run the task's validation**: `just task-app`. Expected: PASS.
- [x] **Step 6: Commit**: `feat(nsh-migration): panes move between the stacks`.

## Task 52: The sandbox, and a walk through the app

**Files:**

- Modify: `AGENTS.md`, `CONTRIBUTING.md`, `justfile` (`just sandbox` starts the new app)
- As built (rulings R417 to R421): `scripts/sandbox.sh` (`just sandbox`, `--no-app` for the server
  alone), `just walk` (`app/tools/walk.test.tsx`, its entry `app/tools/__checks__/Walk.tsx`,
  `scripts/walk.sh`, pictures in `target/shots/walk/`), `URAEDA_SANDBOX_PID` from
  `scripts/sandboxed.sh`, the wiki example and a broken extension in the sandbox

**Interfaces:**

- Consumes: every screen.
- Produces: `just sandbox`, which opens the Linux app on `ura sandbox`. A report of what a person
  meets, in the pull request.

- [x] **Step 1: Point `just sandbox` at the new app**, with `--reset` kept.
- [x] **Step 2: Walk through the app as one persona** of [personas](/specs/ui/personas.md), from a
      new feature to an approved spec and a finished session, by keyboard and by pointer. Note what
      hurts its looks, readability, behaviour, and coherence, with pictures.
- [x] **Step 3: Fix what is clearly wrong.** Propose the rest as changes to the guides, in the pull
      request.
- [x] **Step 4: Run the task's validation**: `just task-app`. Expected: PASS. 176 app tests passed
      (the walk's 22 skip themselves without a display, in 4 s); the crates' task, 380 passed.
- [x] **Step 5: Commit**: `fix(nsh-migration): what a walk through the app found`.

## Task 53: Performance

**Files:**

- Create, as built: `app/ui/timing.ts` (the development build's timing and its warning),
  `app/tools/navigation.test.tsx` with its page `app/tools/__checks__/Navigation.tsx` (a test file
  the recipe runs, which skips itself without a display, in place of `app/tools/navigation.ts`),
  `scripts/gpu-display.sh` (`hidden-display --gpu`)
- Modify: `just frames` (`scripts/frames.sh`), `flake.nix`, the `justfile`, `scripts/nsh.sh`,
  `scripts/sandboxed.sh`, the key registry, `navigate`, `TextField`, the store's connection,
  `KeysHost`, `Document`; `CONTRIBUTING.md`, `AGENTS.md`

**Interfaces:**

- Produces: `just bench-navigation [software]` (the time from a key to the frame that draws its
  result with its records, for every page and action the performance decision names, as a table) and
  `just frames <scene> [software]`, both on an optimised build in `target/optimised/` and on the
  GPU's hidden display (`hidden-display --gpu`, rulings R411 and R412); a development build's
  warning when an interaction passes 100 ms (`interaction`, `onTimed`, `settledWhen` in
  `app/ui/timing.ts`, ruling R415).

- [x] **Step 1: Write the navigation benchmark** over the sandbox's projects, as the performance
      decision asks.
- [x] **Step 2: Run both benchmarks.** Expected: navigation within 100 ms, a reload within 1 second,
      frames at most 8.3 ms at the 99th percentile. Frames met on the GPU; navigation missed by a
      third to a half everywhere, the whole app made again at each navigation (ruling R413).
- [x] **Step 3: Fix what misses.** The usual causes, from the spikes: a list bound without pacing, a
      long text drawn as one block, a record sent whole where a change would do, work done in TSX
      that belongs in Rust. Fixed: the keys' host's children (R413), a paragraph's views in a
      transcript's rows (R414). Left: a page's first visit and the chat of 20,000 messages (R416).
- [x] **Step 4: Run them again, and record the numbers** in the commit's body.
- [x] **Step 5: Commit**: `perf(nsh-migration): meet the navigation and frame targets`.

## Task 54: Packaging and release

**Files:**

- Modify: `.github/workflows/`, `dist-workspace.toml`, `INSTALL.md`, `README.md`, `CONTRIBUTING.md`
- Create: `app/package/` (icons, the desktop entry)

**Interfaces:**

- Produces: a release with `ura` (the CLI and the server) and the Linux app as a tarball and an
  AppImage, from one tag, with one version, as the distribution decision asks.

- [x] **Step 1: Package the app** with NSH's packager. Read its packaging page first. The app needs
      GTK 4.14 or newer, and says so when it is missing.
- [x] **Step 2: Add both artifacts to the release workflow.** A release that fails part way must be
      completable at the same version.
- [x] **Step 3: Write the install pages**: `INSTALL.md` for every way to install, `README.md` for a
      quick one.
- [x] **Step 4: Install each artifact on a clean container**, start it, and open a repository.
      Expected: the home page. Seen: in Debian 13 with only `libgtk-4-1` (4.18.6) and
      `libwebkitgtk-6.0-4` (2.54.0) installed, as an unprivileged user, both the tarball and the
      AppImage (`--appimage-extract-and-run`) started their own `ura serve` and showed the home page
      of the repository they started in; the server stopped when the app closed.
- [x] **Step 5: Commit**: `build(nsh-migration): package the Linux app and ura serve`.

**As built** (rulings R397 to R401):

- `just package` (`scripts/package.sh`) writes `target/package/uraeda/`,
  `uraeda-app-x86_64-linux.tar.gz`, and `uraeda-app-x86_64.AppImage`, each with its `.sha256`: the
  launcher `uraeda` (`app/package/uraeda`), `ura` linked to `lib/ura`, `lib/uraeda`, `lib/nsh/`, and
  the desktop entry and icons in `share/`. NSH's `nsh package` is not used: its program has none of
  the host's calls. The binaries need glibc 2.39 or newer (`scripts/glibc-floor.c`).
- `crates/app`: `uraeda_app::APP_ID`, `uraeda --version`, and a refusal in words below GTK 4.14.
  `crates/app/tests/package.rs` checks the desktop entry, the icon, and `app/nsh.json` against it.
- The release: `global-artifacts-jobs = ["./build-app"]` in `dist-workspace.toml`, and
  `.github/workflows/build-app.yml`. CI's `release` job runs `just release-plan` and `just package`.
  `just lint` runs `actionlint` (`just lint-workflows`). `just dist <args>` runs cargo-dist.
- **Task 61 changes in the release**: delete `.github/workflows/npm.yml`, the npm release of
  `@uraeda/ui` and its binding, with `packages/uraeda/`. Its `scripts/bump.ts` is `vp run release`,
  which writes the notes, sets the workspace's version, tags, and pushes: port it to a recipe, and
  update `CONTRIBUTING.md`'s "Releasing". Keep `release.yml`, `build-app.yml`, and
  `publish-homebrew.yml`. In `ci.yml`, the `release` job stays, and the setup action loses
  `pnpm install`. Write `INSTALL.md`'s "Sessions of the web UI" at its `TASK 61:` mark, and drop its
  "The web UI" section and the README's `npx @uraeda/ui` lines.

## Task 55: Parity

**Files:**

- Create: `app/screens/parity.toml`, `crates/app/tests/parity.rs` (in place of
  `app/screens/parity.test.ts`: a test under `nsh test` reads no file, ruling R402)

**Interfaces:**

- Produces: the list of every route of [`routeTable.ts`](/packages/web/src/routeTable.ts), each with
  its new screen, or `dropped` and why; and `[[left]]`, what the old screens did that the new ones
  do not, each brought back, left, or replaced.

- [x] **Step 1: Write the failing test** `every old route is mapped or dropped`: it reads the old
      route table and fails on a route missing from `parity.toml`, or mapped to a route that draws
      "Nothing here".
- [x] **Step 2: Run it**. Expected: FAIL, naming what is missing.
- [x] **Step 3: Fill the list, and build what it shows missing.** A route dropped on purpose names
      the human's request or the decision behind it.
- [x] **Step 4: Run the task's validation**: `just task-app`. Expected: PASS.
- [x] **Step 5: Commit**: `test(nsh-migration): every old route has a screen`.

**As built** (ruling R402):

- `parity.toml` maps 29 of the React UI's 31 pages and drops 2 (`moved`, `first-run`); `[[left]]`
  holds 8 things brought back, 16 left, and 14 replaced. The test is
  `every_old_route_is_mapped_or_dropped` in `crates/app/tests/parity.rs`, run by
  `just task uraeda-app`. Task 61 deletes its `old_pages()` and the two checks that read it.
- Brought back, a commit per screen: Continue all on Home (`NeedsYouRow.continued`, new, from
  `Runner::continued_by_all`); a session's Rename (`R`) and effort (`m`); a feature's Rename (`R`)
  and "Commit the proposal" at its gate; a proposal's "Edit its line" (`e`); Start over on a review
  on an older version; `agent.refreshModels` as a picker shows. `app/screens/NameDialog.tsx` is the
  one name dialog.
- Actions of the protocol no screen calls: `inbox.drop`, `inbox.outline`, `inbox.place`,
  `inbox.intoProposalLine`, `proposals.drop` (each a `left` line); `change.fromNote`,
  `priorities.commit`, `priorities.discard`, and `session.new`, which no old screen called either.
- The fixes after it (rulings R403 to R410) brought back the rest a person would miss, a commit
  each: Ask the agent, beside (`useAsk`); Postpone, over the new record `ErrandMessage`; "Review
  with AI" and "Apply the answers" on the decisions check, through `ContinueDialog` with
  `folder: null`; pick mode and comments on previews (`?uraeda-pick`); Full screen (`zoomer()`); a
  settled comment's edit; Retry of a default round's commit; a host name's edit; `#turn-<id>`; the
  cursor on what an undo brought back (`broughtBack`); a proposal's nested lines; the screen
  reader's `say`. `[[left]]` now holds 20 brought back, 4 left (none a person misses: the inbox's
  outliner, Recent, the New page's `/`, a done reply's frame), and 14 replaced.

## Task 68: Native Shell 0.5.0

Added on 2026-11-12, at the human's request: "NSH released v0.5.0 while you were doing all that.
Before the next task upgrade to 0.5.0 and read the changelog." It runs before phase 2, whose web
build is the part of NSH that moves fastest.

**Files:**

- Modify: the pin's four places, `flake.nix`, `Cargo.toml` and `Cargo.lock`, `app/nsh.json`, and
  [`AGENTS.md`](/AGENTS.md); every workaround of a defect the release fixes

**Interfaces:**

- Consumes: everything built on NSH 0.4.0, and the rulings that name one of its defects or limits.
- Produces: the branch on NSH 0.5.0, with the gallery's and the app's pictures compared before and
  after, as the plan's constraint on upgrades asks, and a ruling listing what the release changed
  for Uraeda.

- [ ] **Step 1: Read the changelog and the diff of what Uraeda uses**, from 0.4.0 to 0.5.0: every
      breaking change of the Rust API and of TSX, every fix, and what is new. List in a ruling each
      item that touches Uraeda: what breaks, what a workaround can now drop, and what is worth
      adopting.
- [ ] **Step 2: Take the pictures before**: the gallery's, the app's routes, and the frames and
      navigation numbers, on 0.4.0.
- [ ] **Step 3: Move the pin**, in its four places at once, and make the workspace build and its
      checks pass. The checks of `crates/app/tests/outside.rs` say which assumption of NSH broke.
- [ ] **Step 4: Drop each workaround the release makes needless**, one commit each, with its test:
      the rulings name them, among them an overlay's Escape taking a field's, a web view that no key
      can focus, the editor's `line` style, colours of the diff view, a `<Shader>`'s failure that
      only logs, fonts of an embedded view, the `rolldown` crates held beside the bundler. Keep a
      workaround whose defect is still there, with the release's number in its comment.
- [ ] **Step 5: Take the pictures and the numbers again, and compare.** Fix what moved. Say in the
      commit what differs, with the pictures' paths.
- [ ] **Step 6: Run the checks**: `just check`, `just task-app`, and `just task` on the crates that
      take NSH. Expected: PASS.
- [ ] **Step 7: Commit**: `build(nsh-migration): Native Shell 0.5.0`.

**Phase 2: the web build.** The same app in a browser, served by `ura serve`, then the removal of
the React UI and the Node server. Read NSH's web pages before each task:
[`website/docs/web.md`](https://github.com/longbridge/nsh/blob/main/website/docs/web.md) and
[`docs/dev/web.md`](https://github.com/longbridge/nsh/blob/main/docs/dev/web.md). The plan ends
here: iOS and macOS are the human's, later.

## Task 56: The web build, served by `ura serve`

**Files:**

- Create: `crates/server/src/http/web.rs`, `app/web/` (the page that hosts the app)
- Modify: `justfile`, `.github/workflows/`
- Test: `crates/server/tests/web.rs`

**Interfaces:**

- Consumes: the app (phase 1); `sign_in` (task 5).
- Produces: `just web-build`, which packages the app for the web; `ura serve` serving it at `/`,
  with any unknown path answering the app's page; the sign-in cookie for the browser, as today.
- `ura serve` reads the setting `open_browser`, which `settings.setOpenBrowser` writes and nothing
  reads until then, and opens the app in a browser as it starts, as
  [`browser.ts`](/packages/server/src/browser.ts) does: at the comment `// TASK 56:` of
  `records/workspace/settings/actions.rs` (ruling R121).

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

- Consumes: `route`, `navigate`, `back`, and the seam `HistoryAdapter`, `bindHistory`, `entryAt`
  (task 24).
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
      `just app-shots --web --phone`.
- [ ] **Step 2: Review each against the phone guide**: one column, top tabs, a bottom bar, sheets
      for pickers and short forms, 44-point targets, prose at 16 points, wrapping text on the full
      width. Walk through one persona's journey with touches.
- [ ] **Step 3: Fix what fails**, in `app/ui/` where the cause is a component.
- [ ] **Step 4: Run the task's validation**: `just task-app`. Expected: PASS.
- [ ] **Step 5: Commit**: `fix(nsh-migration): the app on a phone`.

## Task 60: Web performance

**Files:**

- Modify: `just frames` (task 35's `scripts/frames.sh` and `app/gallery/frames.test.tsx`),
  `app/tools/navigation.ts` (a `--web` form of each)

**Interfaces:**

- Produces: the two benchmarks of task 53, run in a headless browser, at a phone's size with the
  processor slowed four times.

**What the protocol sends**, added on 2026-11-12 at the human's request. The desktop app talks to a
server on the same machine, so size never mattered. The web build and remote devices change that: a
record's first value arrives whole, as JSON text, with no compression, and a screen opens several
records at once, 3 to 9, plus the shell's 10. The steps below measure it, and decide by a rule,
without stopping for the human.

- [ ] **Step A: Measure what `/live` sends.** For each screen the navigation benchmark visits, on
      the sandbox with `--long-chat`, record the bytes the server sends on `/live` from the
      navigation to the screen being settled: the total, and the largest single message with its
      record's name. Include a reload, which reads the shell's records too. Record the same totals
      with each message compressed, to show what compression would save. On the slow-phone setting
      this task uses, record the time to the first settled frame, and how much of it is waiting for
      the records' first values. Write the numbers in a ruling, as a table per screen.
- [ ] **Step B: Decide by this rule.** Build compression if any screen, or the reload, sends more
      than 100 KB before it settles and compression would save at least half of it. Otherwise do not
      build it: the ruling says so with the numbers, and the work ends there. The rule's numbers are
      the human's, chosen without a measurement: on a link of about 50 KB a second, 100 KB is two
      seconds of waiting. In the same ruling as the table, say whether fewer or smaller first
      values, by paging or a read-ahead of the selected row, would save more than compression for
      the worst screens: a proposal, not built.
- [ ] **Step C: Only if the rule says build, add a task after this one** to the plan, as any task is
      added, with these requirements:
  - The standard per-message compression of WebSockets is not available: the server's library,
    tungstenite through axum, does not implement it in the versions locked. Check that again first.
    If the pin now has it and the browser's and Native Shell's sockets both negotiate it, use it and
    skip the rest of this list.
  - Otherwise it is the protocol's own: a message above a size threshold is sent as a compressed
    binary frame, and small ones stay text. Pick the threshold from the table. Streaming appends
    stay as they are.
  - Use `flate2` or `zstd`, which are already in the lockfile. Another crate only if neither can be
    inflated on the client, with a ruling that says why.
  - The client inflates before it parses, in the Linux app and in the browser, with the same store
    code on both. Find out what Native Shell's engine offers, and whether the app's Rust module is
    the better place, before choosing, and record the choice in a ruling.
  - [`contracts/protocol.md`](contracts/protocol.md) says every message is one text frame: the
    contract, its fixtures, and the protocol's version change with it. Breaking compatibility is
    fine: there is one user.
  - Tests first, as every task: a large first value arrives compressed and reads the same; a small
    message and an append stay text; a client reconnecting resumes as before.
  - Then step A's measurement runs again, with before and after in the commit's body.

- [ ] **Step 1: Run both benchmarks** on the sandbox, and on a session with a very long reply.
- [ ] **Step 2: Compare with the spike's numbers**: 57 frames a second streaming, 37 scrolling.
      Expected: no worse, and no frame over 100 ms while a long reply streams.
- [ ] **Step 3: Fix what misses**, then run them again and record the numbers in the commit's body.
- [ ] **Step 4: Run the task's validation**: `just task-app`. Expected: PASS.
- [ ] **Step 5: Commit**: `perf(nsh-migration): the web build on a slow phone`.

## Task 61: Remove the React UI and the Node server

**Risky:** it deletes the code that runs Uraeda today.

**Files:**

- Delete: `packages/web/`, `packages/server/`, `packages/binding/`, `packages/uraeda/`,
  `crates/binding/`; and Vite+, pnpm, and Node with them (ruling R122): `package.json`,
  `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `vite.config.ts`, `vite.fast.config.ts`, `vite.tasks.ts`,
  `tsconfig.json`, `tsconfig.base.json`, the TypeScript files of `scripts/` with their tests, and
  `nodejs` and `pnpm` in `flake.nix`
- Modify: `.github/workflows/` (CI runs `nix develop -c just ready`), `.config/nextest.toml`
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
- [ ] **Step 4: Run the full pass**, `just ready`, **and a release to a test tag.** Expected: PASS,
      artifacts with no Node in them, and a dev shell with no Node in it. A check the old
      `vp run ready` held that the new stack still needs, as the toolchain configuration's tests
      were, is rewritten as a Rust test or a recipe, or dropped with a ruling.
- [ ] **Step 5: Commit**: `feat(nsh-migration)!: remove the React UI and the Node server`.

## Task 67: What the default branch gained since

Added on 2026-11-11, at the human's request: "after everything is done, review the commits on main
and add all features that are worth it. Since this rewrite is spanning days and runs inside uraeda
itself, there are some small functional fixes and changes here and there (like idle session
nudging)."

**Files:**

- Modify: whatever each kept change needs, in `crates/` and `app/`
- Create: nothing by default

**Interfaces:**

- Consumes: everything, and the default branch's commits since the catch-up of ruling R124, which
  stopped at `67f4dad0`: `git log 67f4dad0..origin/main`.
- Produces: the new stack with every change of the default branch that is worth having, and a list
  of each commit read, kept or left, with its reason.

- [ ] **Step 1: Read every commit** of `git log --reverse 67f4dad0..origin/main`, with its message
      and its diff. The old UI and the Node server it changed are gone from this branch, so nothing
      merges by itself: each commit is read for what it does for the human, not for its lines.
- [ ] **Step 2: Sort them** in the commit body's list: a fix or a feature of behaviour the new stack
      has too, which is ported; one of code the rewrite replaced with something that does not have
      the problem, which is left, saying why; a change of the core, the skill, the specs, or the
      documentation, which comes with the rebase. When in doubt, port: the human made each change
      because something hurt.
- [ ] **Step 3: Port each kept change**, one commit each, named after the default branch's commit,
      with a test that fails first where it changes behaviour. A change to a screen follows
      [what makes a screen good](#what-makes-a-screen-good), and adds its complaint to that section
      when it teaches a new rule.
- [ ] **Step 4: Rebase the branch** on the default branch. A file the default branch changed and
      this branch deleted stays deleted, once step 3 has its change. A decision or the constitution
      changed there is read as the final review's catch-up reads it.
- [ ] **Step 5: Run the full pass**, `just ready`. Expected: PASS.
- [ ] **Step 6: Commit** the list as the last commit's body:
      `feat(nsh-migration): what the default branch gained since the catch-up`.
