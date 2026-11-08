---
status: auto-approved
spec-revision: 2
---

# Plan: Extensions system

**Goal:** Let the owner add to or replace any part of Uraeda's server and web UI from TypeScript
folders in their config folder, compiled and reloaded by Uraeda, with Claude Code and Uraeda's own
places moved onto the same API.

**Architecture:** As the [spec's architecture](spec.md#architecture) says, with these owners and
boundaries:

- **The core** (`crates/core/src/extensions/`) owns the manifest format, the built-in manifests
  (embedded TOML files), each extension's `on` list, and its settings' validation and writes. It
  reads; it never runs extension code. The binding and `ura` both call it.
- **The compiler** is a new crate, `crates/compile/` (`uraeda-compile`), used only by the binding,
  so `ura` does not grow. It turns one TypeScript or TSX file into the body of a function
  `(__import, __exports)`: types stripped, JSX turned into `react/jsx-runtime` calls, `import` and
  `export` rewritten into calls of those two parameters. The same output runs in the server and the
  page, so both have one module runner and no module cache that keeps old versions
  ([reloading server modules](discovery-02.md#reloading-server-modules)).
- **The page compiler** (`packages/server/src/extensions/page-compiler.ts`) runs Babel with StyleX
  and React Compiler on page files before the compiler, and returns their CSS.
- **The loader** (`packages/server/src/extensions/loader.ts`) owns the authoritative state of every
  extension: its compiled versions, its registrations, its problems, and its reloads. It watches
  `<config>/extensions/`, evaluates server code inside `vm` with a timeout, and undoes every
  registration of a version before the next one runs. Nothing else evaluates extension code on the
  server.
- **The server API** (`packages/server/src/extensions/api.ts`) is the only object an extension's
  server code receives. Each method checks that its scope is still loaded, and scopes everything to
  the repositories the extension is on in.
- **The runtimes registry** (`packages/server/src/runner/runtimes.ts`) replaces the single
  `Adapter`. A session finds its runtime by its stored `agent` name. Claude Code and the fake agent
  are built-in extensions that register a runtime through the server API.
- **fate stays static.** One record kind, `ExtensionRecord`, carries every extension's named records
  as JSON, read through the loader at request time; one global `Extensions` record lists the
  extensions for the settings page and the page runtime. No fate server is rebuilt on reload.
- **The web's registries** (`packages/web/src/extensions/registry.ts`) replace the fixed lists of
  places, keys, home panes, phone tabs, New-page sections, status items, item renderers, and
  settings sections. Built-ins register into them from `packages/web/src/extensions/builtins/`, with
  the same page API extension pages get; the page runtime evaluates extension pages fetched from the
  server and registers them the same way.
- **`ura extension`** (`crates/cli/src/extension/`) clones, pins, links, and removes folders, and
  writes `on`. It never runs extension code.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The conditions the spec implies but does not name. Each is pinned in the owning task's tests.

1. **A symbolic link in the extensions folder pointing into a repository** is the owner's own act
   (`ura extension add <folder>`), so it loads; but a repository can never add a link itself: the
   loader reads only `<config>/extensions/`, and never a path a repository's files name. Task 7.
2. **An extension saved twice within the debounce** compiles once, and a save during a compile leads
   to one more compile of the latest files, never an older version winning. Task 7.
3. **A timer or listener an old version left running** throws a named error when it calls the API
   after the reload, as the spec's "refusing calls from a scope already unloaded" says, and never
   reaches the new version's state. Task 7.
4. **A session started on a runtime that is then removed** keeps its `agent` name; it is read-only
   until the runtime returns, and resuming after a server restart finds the runtime by name again.
   Task 4.
5. **A route an extension registers** sits behind the same sign-in check as every route: a request
   without a session gets 401, like `/fate`. Task 8.
6. **Settings written for a repository whose name is not in the list** are refused by `ura` and the
   page, so a typo never creates an orphan table. Task 2.
7. **An extension's page module that throws while registering** leaves the other extensions' places,
   and Uraeda's, on screen, and the settings page names it. Task 12.

## Global constraints

Every task's requirements include these.

From the [extensions decision](../decisions/extensions.md), word for word:

- Extensions MUST load only from the config folder, never from a repository.
- Uraeda's own places and agent runtimes MUST be built on the same extension API as the owner's,
  each one able to be turned off.
- An extension MUST run from its source and reload on change, with no build step, package install,
  or server restart.
- A broken extension MUST NOT stop Uraeda or another extension from running.
- Extensions MUST NOT depend on each other: they use only the contracts Uraeda owns, like a
  runtime's, its events, and its data records.
- Extensions MUST NOT add instructions to the agent's runs.
- Extension code MUST reach the server only through `ura`, pinned to a commit, never fetched by the
  server.

From the [agents decision](../decisions/agents.md): "Every agent MUST be reached through one
adapter, which keeps the agent's formats inside it and declares what the agent can do." "Tests MUST
reach agents through a fake adapter, never a real agent." "Uraeda MUST NOT read or change an agent's
credentials or settings."

From the [compatibility decision](../decisions/compatibility.md): "An extension built for another
version of the extension API MUST be turned off, with a message saying why." The API version is `1`.
The message is exactly `built for extension API 1, and Uraeda runs API 2` with the numbers filled
in.

From the [settings decision](../decisions/settings.md): "Finding, reading, validating, and writing
the settings and the theme files MUST live in the Rust core." "A write MUST keep a human's comments,
unknown keys, and order." "A write MUST NOT overwrite a file that is unreadable or invalid." "The
settings file MUST NOT hold a secret, or be read from a repository."

From the [stack decision](../decisions/stack.md): extension pages get their data through fate, never
their own fetches.

From the [sign-in decision](../decisions/sign-in.md): every route an extension adds needs a
signed-in session.

From the [keyboard decision](../decisions/keyboard.md): an extension's keys go through the key
registry.

From the [sandbox decision](../decisions/sandbox.md): "The sandbox MUST NOT read or write the
human's real repositories, data folder, config folder, or agent." The sandbox already sets its own
`URAEDA_CONFIG_DIR` (`packages/web/sandbox/seed.ts`), so it loads only its own extensions folder.

From the [CLI decision](../decisions/cli.md): "Every action of a TUI, a full-terminal interactive
screen, MUST also be available without one, so an agent never meets a prompt it cannot answer."
"What commands print MUST be stable for tools to read, with versioned JSON on every read command."
The compiler is never linked into `ura`.

From the [code-quality decision](../decisions/code-quality.md): functions at most 100 lines, files
at most 500 lines, at most 7 parameters, nesting at most 4, in both languages. No new marker. "Unit
tests MUST NOT depend on elapsed time, except benchmarks of a spec's success criteria."

From the [testing decision](../decisions/testing.md), stage `early`: test stored formats, git,
security, contracts between parts, and pure logic with many cases; a web UI test only for behaviour
costly to lose that using the UI would not show. Each changed view is reviewed in the running app,
in both themes, at a phone's and a desktop's width.

Exact text from the spec, used as written:

- `ura extension add` asks "every repository" or "this repository"; with `scope = "repository"` it
  suggests "this repository" first.
- `deploy is taken by a built-in extension` (with the name filled in).
- `` `y` is taken by Deploy `` (key and title filled in).
- `reloads when the turn of … ends` (the session's title in place of `…`).
- `No agent runtime is on here: turn one on in Settings, Extensions`.
- `pi-durable is off: turn it on to continue this session` (the runtime's title filled in).
- `Inbox is off here`, with a button to turn it on.
- `folder not found`.

Exact limits from the spec: a saved change reaches the page or the server within 1 second for an
extension of 50 files (SC-001); 100 reloads grow the server's memory by less than 10 MB (SC-002).

Existing guarantees to keep, with their tests:

- A run whose agent did not load the Uraeda skill fails with "The Uraeda skill did not load: <why>"
  (`packages/server/src/runner/__tests__/sessions.test.ts`, the two plugin tests).
- Every route of the app is one of the server's paths, and closed routes need a session
  (`packages/server/src/sign-in/__tests__/closed.test.ts`).
- Settings writes keep comments and unknown tables byte for byte (`crates/core/tests/settings.rs`,
  `keeps_comments_and_unknown_keys`).
- The run lifecycle: continues after restart and after limits
  (`packages/server/src/runner/__tests__/` continuer tests).

## Code read

- [`packages/server/src/runner/adapter.ts`](/packages/server/src/runner/adapter.ts): `Adapter`,
  `AgentProcess`, `OpenOptions`, `Capabilities`; already the agent boundary.
- [`packages/server/src/main.ts`](/packages/server/src/main.ts) (line 125) and
  [`dev.ts`](/packages/server/src/dev.ts) (lines 158–160) build the one `ClaudeAdapter`;
  `startServer` → `startSessions` → `createSessions` (`live.ts`) → `new Sessions({adapter, …})`,
  stored in `SessionContext.adapter` and read as `ctx.sessions.adapter` across `fate/`.
- Reads of `adapter.kind`: `send.ts`, `session-folders.ts`, `fate/sessions.ts`. Of `adapter.name`:
  `fate/commit-messages.ts`, `continue-all.ts`, `recommended.ts`, `send-mutations.ts`,
  `session-moves.ts`, `starts.ts`, `processes.ts`, `sessions.ts`, `take-back.ts`. Of `capabilities`:
  `sessions.ts`, `send.ts`, `take-back.ts`, `turns.ts`, `fate/chat-images.ts`, `commit-messages.ts`,
  `starts.ts`, `sessions.ts`, `send-input.ts`.
- Usage: `claude-events.ts` (`usageEvents`, lines 205–230) emits
  `{type: "usage", fiveHour?, week?}`; `processes.ts` keeps the latest per window
  (`UsageWindow = "fiveHour" | "week"`); `Sessions.status()` returns `fiveHourLimit`, `weekLimit`;
  `fate/sessions.ts` `agentRecord`; the web reads them in `home/Usage.tsx`, `sidebar/Allowance.tsx`,
  through `AgentView` (`packages/web/src/views.ts` line 280).
- The plugin check: `runner/transcript.ts` lines 113–125, `PLUGIN = "uraeda"`.
- [`runner/claude.ts`](/packages/server/src/runner/claude.ts) `claudeArgs`: `--plugin-dir`, one
  `--add-dir` (chat images), `--append-system-prompt WEB_UI_INSTRUCTIONS`, `--permission-mode auto`
  (writes allowed in added folders).
- [`runner/instructions.ts`](/packages/server/src/runner/instructions.ts): `WEB_UI_INSTRUCTIONS`.
- [`fate.ts`](/packages/server/src/fate.ts): static `Root`, `mutations`, `sources`; one fate server
  globally and one per repository (`repositories.ts` `#start`); the Vite plugin types the client
  from this module's exports.
- [`live.ts`](/packages/server/src/live.ts): `publish(changes, host, sessions)`, `onTurnDone` (only
  caller `app.ts`, the Storybook warmer), `announceSettings`, `announceThemes`.
- [`settings.ts`](/packages/server/src/settings.ts),
  [`settings-watch.ts`](/packages/server/src/settings-watch.ts)
  `FileWatch(dir, file, changed, {folder?})`: follows symlinks and watches folder entries.
- [`app.ts`](/packages/server/src/app.ts) `createApp`;
  [`server-paths.ts`](/packages/server/src/server-paths.ts) `SERVER_PATHS`; `sign-in/check.ts`
  `OPEN_PATHS`; tests in `sign-in/__tests__/closed.test.ts`.
- Server tests: `src/__tests__/helpers.ts` (`testApp`, `testServer`, `testHosts`, `fate`, `mutate`),
  `src/runner/__tests__/helpers.ts` (`testSessions`, `restart`), `src/testing.ts` (`fakeSessions`,
  `testSettings`). The sandbox's `SandboxAgent extends FakeAdapter`
  (`packages/web/sandbox/agent.ts`). Benchmarks import `Adapter`, `ClaudeAdapter`, `FakeAdapter`
  from `uraeda-server/runner/*`.
- Core: `crates/core/src/settings.rs` (`config_dir`, `change_table`, `set`), `settings/file.rs`
  (`toml_edit`, atomic `save`), `themes.rs` (`user_files`: symlinks followed, broken files reported
  per file). Tests: `crates/core/tests/settings.rs`, `settings_writes.rs`, `themes.rs`.
- Repository names: `crates/core/src/repositories.rs` `read(data_dir)`, `Repository { name, path }`.
- Watcher: `crates/core/src/watch.rs` `Changes` lists changed feature folders, not steps; the server
  consumes it in `repositories.ts` line 278.
- Binding: `crates/binding/src/lib.rs` (`job` → `AsyncTask`), `settings.rs`, `themes.rs`; generated
  `packages/binding/index.d.ts`; no oxc crate in `Cargo.lock`.
- CLI: `crates/cli/src/main.rs` `enum Command`; nested subcommands as `inbox.rs`; the ratatui
  `picker.rs`; `terminal::interactive(no_input)`; tests in `crates/cli/tests/*.rs` with `ura_in`.
- Git: `crates/core/src/git/process.rs` `run`, `git_write`; no clone helper.
- Web places: `destinations.ts` `DESTINATIONS`; `keys/leaderTree.ts` `PLACES`, `FIND`,
  `newBindings`; `shell/ColumnPanes.tsx` `Navigate`; `shell/Tabs.tsx` `Tabs`, `FOLDED`;
  `home/HomeHub.tsx` `Lists` sections; `NewEntries.tsx` `useEntries` sections; `routeTable.ts`
  `Route`, `parseRoute`; `App.tsx` `RoutePage`; `shell/StatusLine.tsx`; `TranscriptMessages.tsx`,
  `session/ActivityRows.tsx`; `settings/categories.ts` `CATEGORIES`, `settings/SettingsView.tsx`.
- Keys: `keys/store.ts` throws on a clash outside production, so the registry must drop a
  conflicting extension key before it reaches `useKeys`.
- Web tests: `src/__tests__/helpers.tsx` `renderPage` runs the real server in process with real git
  fixtures; focused tests in `src/__focused__/`.
- Build: `packages/web/vite.transforms.ts` (StyleX `debug: false`, React Compiler preset);
  `packages/uraeda/scripts/build.ts` copies `web/` and `plugin/`; the smoke test
  `packages/uraeda/scripts/smoke.ts`.
- Checked while planning: StyleX's Babel plugin, run at run time on a file outside the app with a
  custom resolver for `@astryxdesign/core/theme/tokens.stylex`, gives
  `paddingBlock: spacingVars["--spacing-3"]` the class `x8o8v82`, the same class as Astryx's own
  `astryx.css`. Task 1 makes this a test.
- Validation: `vp check`, `vp test`, `nix develop -c cargo nextest run`,
  `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`; everything at once
  with `vp run ready`; the fast check `vp run fast`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| Abstraction or exception                      | Why it is needed                                                                                         | Simpler alternative rejected because                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Crate `uraeda-compile`                        | oxc in the binding only, tested by nextest; the binding crate has no tests                               | Inside `crates/binding`: untestable there. Inside `crates/core`: would grow `ura`                  |
| Module transform to `(__import, __exports)`   | One runner for server and page; no module cache keeping old versions; sync evaluation under `vm` timeout | Node `import()` keeps every version (discovery 02); blob-URL modules keep every version in the tab |
| Loader with scoped `ServerApi`                | Owns reload, undo, isolation, version check: the spec's loader                                           | Ad hoc registration per contribution: no single place undoes a version                             |
| `Runtimes` registry                           | Several runtimes, found by a session's `agent`                                                           | A single adapter: cannot run pi-durable beside Claude Code                                         |
| `ExtensionRecord` and `Extensions` fate views | Keep fate static and typed, while extensions add records at run time                                     | A fate server rebuilt per reload: untyped client, live subscriptions dropped                       |
| Web `registry.ts` and page API                | Fifteen fixed lists become one store with order, on-state, and clash rules                               | A list per place with its own filter: the on-state rule copied fifteen times                       |
| Built-in manifests embedded in core           | Built-ins' settings are validated by the same reader as yours                                            | Built-ins described in TypeScript: two formats for one manifest                                    |

No function or file grows past a limit: tasks that touch `runner/sessions.ts` (495 lines),
`runner/cache.ts` (485), and `runner/continuer.ts` (481) move code out rather than adding to them.

## Test map

How the tests run: Rust tests on temporary folders (`tempfile`), with real `git` for the CLI. Server
tests on the fake adapter, a `:memory:` session cache, temporary config folders, and the real
binding; the loader's tests write extension folders to a temporary config folder and wait for the
loader's own "loaded" notice, never a sleep. Web tests render the real app over the in-process
server (`renderPage`). SC-001 and SC-002 are benchmarks, the only tests that time. 21 new tests,
against the spec's 21 key scenarios and 4 high edge cases.

| Spec                                                                                    | Task | Test                                                                                                 |
| --------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| Unverified: fate built again at each reload                                             | 1    | `server/src/extensions/__tests__/spike.test.ts`, a record registered after the fate server is made   |
| Unverified: StyleX at run time matches Astryx's classes                                 | 1    | `spike.test.ts`, the same class as `astryx.css`                                                      |
| US1 more 2 (settings per repository); Review focus: unknown repository                  | 2    | `crates/core/tests/extensions.rs`, `settings_for_one_repository_override_the_global_ones`            |
| Edge: settings fail their schema                                                        | 2    | `extensions.rs`, rows of `manifest_and_settings_problems`                                            |
| US7 2 (API version) — manifest side                                                     | 2    | `manifest_and_settings_problems`, a row for `api`                                                    |
| Compiler contract (imports, exports, JSX, errors with line)                             | 3    | `crates/compile/tests/compile.rs`, rows of `compiles`                                                |
| US1 more 1 (syntax error with file and line) — compiler side                            | 3    | `compile.rs`, a row with a syntax error                                                              |
| US3 1 (Claude Code by default, usage windows as today)                                  | 4    | `runner/__tests__/claude.test.ts`, the usage fixtures now give windows `5h` and `Week`               |
| Replaced: plugin check moves into Claude Code                                           | 4    | `claude.test.ts` init fixtures give `problem`; `sessions.test.ts` plugin tests use `problem`         |
| US3 2 (pick pi-durable); Review focus: removed runtime                                  | 4    | `runner/__tests__/runtimes.test.ts`, `a session runs on the runtime it was started with`             |
| US3 more 1 (runtime off: read-only)                                                     | 4    | `runtimes.test.ts`, a row of the same test                                                           |
| US4 1, 3; edge: built-in name                                                           | 5    | `crates/cli/tests/extension.rs`, `add_clones_pins_and_turns_on` and `remove_keeps_settings`          |
| US4 2 (update shows diff, moves after confirm)                                          | 5    | `extension.rs`, `update_shows_the_diff_and_moves_only_with_yes`                                      |
| US1 1 (add asks where), more 3 (scope suggests)                                         | 5    | `extension.rs`, `add_without_a_terminal_needs_where`; picker order in `extension/where.rs` unit test |
| US8 1 (page compiled with StyleX)                                                       | 6    | Task 1's spike test, moved onto `compilePage`                                                        |
| US1 2 (save reloads); Review focus: two saves                                           | 7    | `extensions/__tests__/loader.test.ts`, `a saved change reloads the extension once, latest files`     |
| US1 more 1 (last working version keeps running)                                         | 7    | `loader.test.ts`, `a file that fails to compile keeps the last working version`                      |
| US7 1, SC-003 (throws, loops, fails to compile)                                         | 7    | `loader.test.ts`, `a broken extension leaves the others running`, three rows                         |
| US7 2 (API version off)                                                                 | 7    | `loader.test.ts`, a row of the same test                                                             |
| Review focus: stale scope                                                               | 7    | `loader.test.ts`, `an unloaded version's calls are refused`                                          |
| Review focus: only the config folder; sandbox                                           | 7    | `loader.test.ts`, `loads only the config folder's extensions`                                        |
| Edge: linked folder deleted ("folder not found")                                        | 7    | `loader.test.ts`, a row of `a broken extension…`                                                     |
| SC-001, SC-002                                                                          | 7    | `extensions/__tests__/loader.bench.test.ts`                                                          |
| US1 3 (record through fate, live); US6 1, 2 (events, scoped)                            | 8    | `extensions/__tests__/api.test.ts`, `records reach fate, live` and `events reach only repositories…` |
| Edge: route outside `/x/<name>/`; Review focus: route sign-in                           | 8    | `sign-in/__tests__/closed.test.ts`, rows for `/x/wiki/`; `api.test.ts` row for the refusal           |
| US3 3 (runtime reload waits for the turn); edge: runtime reload                         | 8    | `api.test.ts`, `a runtime reloads once its turns end`                                                |
| US9 1 (skills reach Claude Code)                                                        | 11   | `claude.test.ts`, `claudeArgs` gives a plugin folder per extension with skills                       |
| US2 1, 2, 3 (sessions know the API and the folder, may write it)                        | 11   | `claude.test.ts`, `claudeArgs` adds the extensions folder; instructions name the docs                |
| US5 1, 2 (inbox off everywhere, off in one repository)                                  | 9    | `web/src/__tests__/extensions-builtins.test.tsx`, `a built-in turned off leaves every list`          |
| US5 3 (`ura check` still checks `INBOX.md`)                                             | none | Nothing in core changes: the existing check tests own it                                             |
| Edge: built-in off and a link to it                                                     | 9    | `extensions-builtins.test.tsx`, a row of the same test                                               |
| Edge: two extensions claim a key                                                        | 9    | `web/src/extensions/registry.test.ts`, `the first loaded keeps a key`                                |
| Ordering of places (built-ins first, yours by name)                                     | 9    | `registry.test.ts`, `places keep the built-ins' order, then yours by name`                           |
| Settings page (on, per repository, errors)                                              | none | Reviewed in the running app; the writes are task 2's and task 8's tests                              |
| US1 1 (`Space w` opens Wiki), US1 2 (redraws without reload); Review focus: page throws | 12   | `web/src/__tests__/extension-pages.test.tsx`, `an extension page registers a place and reloads`      |
| US8 1 (theme colours, widths)                                                           | none | Reviewed in the running app in both themes and both widths, as the testing decision asks             |
| Edge: every runtime off; US3 more 1 composer text                                       | 13   | `server/src/runner/__tests__/runtimes.test.ts` row (start refused with the text); composer reviewed  |
| Edge: runtime reports no usage                                                          | none | The usage window draws an empty list: reviewed in the running app                                    |
| Edge: repository leaves the list; settings stay                                         | none | Nothing deletes settings: task 2's writes only touch the named table                                 |

## Waves

1. Tasks 1, 2, 3, and 4: the checks of outside behaviour (new server test file), the core's manifest
   and settings (core and binding), the compiler (new crate and binding), and the runtime contract
   (server runner and the web's usage readers). Tasks 2 and 3 each add their own module to
   `crates/binding/src/lib.rs` and `Cargo.toml`; `packages/binding/index.d.ts` is regenerated after
   the merge, never merged by hand.
2. Tasks 5, 6, and 7: `ura extension` (CLI), the page compiler (one server file), and the loader
   (server `extensions/`). Task 6's file is one task 7 does not touch.
3. Task 8 alone: the server API, fate views and mutations, routes, events, and the built-in server
   extensions build on the loader and the runtimes registry.
4. Tasks 9, 10, and 11: the web's registries and built-ins (web shell, home, New page, routes), the
   settings page's Extensions category (web `settings/`), and the session's instructions, skills,
   and write access (server `runner/claude.ts`, `instructions.ts`). Tasks 9 and 10 each add their
   own exports to `packages/web/src/views.ts` and `data.ts`.
5. Tasks 12 and 13: the page runtime (web `extensions/`) and the runtimes in the web (composer,
   start dialog, usage window).
6. Task 14 alone: documentation, the example extension, the package, and the measurements.

---

## Task 1: Check fate and StyleX for extensions

The spec's two unverified points, checked through the real libraries before anything relies on them.
If either test cannot pass, the build stops here and goes back to the human.

**Files:**

- Create: `packages/server/src/extensions/__tests__/spike.test.ts`
- Modify: `packages/server/package.json` (dependencies `@babel/core`, `@stylexjs/babel-plugin`,
  `babel-plugin-react-compiler`, at the versions `packages/web` already resolves: the catalog's
  `@babel/core`, `@stylexjs/babel-plugin` 0.19.1, `babel-plugin-react-compiler` 1.0.0;
  `@astryxdesign/core` 0.7.3 for its token file)

**Interfaces:**

- Consumes: nothing.
- Produces: the dependencies above in `uraeda-server`, which task 6 uses.

- [x] **Step 1: Write the tests**

```ts
// packages/server/src/extensions/__tests__/spike.test.ts
test("a record kind registered after the fate server is made is read and updated live", async () => {
  // A fate server made with a dataView whose resolver reads a Map filled after creation:
  // the value set later is read through fate, and a live update reaches a subscriber.
});

test("StyleX compiled at run time gives Astryx's own class to the same style", () => {
  // Babel + @stylexjs/babel-plugin on a TSX file in a temporary folder outside the checkout,
  // with dev: false, debug: false, runtimeInjection: false, and a custom resolver for
  // "@astryxdesign/core/theme/tokens.stylex": the className for
  // { paddingBlock: spacingVars["--spacing-3"] } appears in astryx.css with the same declaration.
  expect(astryxCss).toContain(`.${className}:not(#\\#):not(#\\#){padding-block:var(--spacing-3)}`);
});
```

The break each test catches:

- Record kind: fate copying its roots or sources at creation, so a record added later is never
  resolved.
- StyleX: a hashing option that differs from the app's build (`debug`, `classNamePrefix`), giving
  extension styles classes that never override Astryx's.

- [x] **Step 2: Run them**

- Run: `vp test packages/server/src/extensions/__tests__/spike.test.ts`
- Expected: PASS. A failure here is a reason to stop: start a new round of questions.

- [x] **Step 3: Run the task's validation**

- Run: `vp check`
- Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add packages/server/package.json pnpm-lock.yaml packages/server/src/extensions/__tests__/spike.test.ts
git commit -m "test(extensions-system): check fate records and run-time StyleX"
```

## Task 2: Read manifests and extension settings in the core

**Risky:** a new stored format (`extension.toml`, `[extensions.*]` in `config.toml`) and writes to
the settings file.

**Files:**

- Create: `crates/core/src/extensions.rs` (public API), `crates/core/src/extensions/manifest.rs`,
  `crates/core/src/extensions/values.rs` (settings and `on`), `crates/core/src/extensions/write.rs`
- Create:
  `crates/core/extensions/{claude,fake,inbox,priorities,decisions,git,previews,notifications}.toml`
  (built-in manifests, embedded with `include_dir!`; `crates/core/build.rs` adds
  `rerun-if-changed=extensions`)
- Modify: `crates/core/src/lib.rs`, `crates/core/src/settings.rs` (`change_table` calls the new
  `change_path`, which reaches a nested path, the tables above it created implicit)
- Create: `crates/binding/src/extensions.rs`; Modify: `crates/binding/src/lib.rs`
- Test: `crates/core/tests/extensions.rs`

**Interfaces:**

- Consumes: `settings::config_dir`, `settings::change_table`, `repositories::read`.
- Produces (napi objects, camelCase in TypeScript):
  - `pub const EXTENSION_API: u32 = 1;`
  - `pub fn extensions_dir(config_dir: &Path) -> PathBuf` → `<config>/extensions`.
  - `pub fn read(config_dir: &Path) -> Extensions`, never failing:
    `Extensions { folder: String, extensions: Vec<Extension> }`, built-ins first in the order of the
    file list above, then yours by name.
  - `Extension { name, title, description, version, api: u32, icon, scope: String /* "global" | "repository" */, server: Option<String> /* absolute path */, page: Option<String>, folder: String /* resolved */, is_built_in: bool, is_linked: bool, source: Option<Source>, on_all: bool, on: Vec<String>, settings: Vec<SettingSpec>, problems: Vec<ExtensionProblem> }`
  - `Source { url, commit, git_ref }` (TOML key `ref`);
    `SettingSpec { key, kind /* "bool" | "integer" | "string" | "list" */, default_json: String, label, help }`;
    `ExtensionProblem { file: String, line: Option<u32>, message: String, setting: Option<String>, is_fatal: bool }`.
  - `pub fn settings_json(config_dir: &Path, name: &str, repository: Option<&str>) -> String`: the
    extension's settings as a JSON object, defaults first, the global table over them, the
    repository's table over that; a value failing its schema is left at its default (its problem is
    in `read`).
  - `pub fn is_on(extension: &Extension, repository: Option<&str>) -> bool`: `on_all`, or the name
    in `on`; `None` (no repository) is on when `on_all`.
  - `pub fn set_on(config_dir: &Path, data_dir: &Path, name: &str, on: On) -> Result<(), ApiError>`
    with `pub enum On { All, Some(Vec<String>) }`; writes `on = "all"` or `on = [..]` (`[]` is off).
  - `pub fn set_setting(config_dir: &Path, data_dir: &Path, name: &str, repository: Option<&str>, key: &str, value_json: &str) -> Result<(), ApiError>`:
    writes under `[extensions.<name>]` or `[extensions.<name>.repositories.<repo>]`, refusing a key
    the manifest lacks, a value of another type, and a repository not in
    `repositories::read(data_dir)` (`refused: no repository named <repo> in Uraeda's list`).
  - Binding: `extensionsFolder(configDir)`, `readExtensions(configDir): Promise<Extensions>`,
    `extensionSettings(configDir, name, repository?): Promise<string>`,
    `setExtensionOn(configDir, dataDir, name, on: "all" | string[])`,
    `setExtensionSetting(configDir, dataDir, name, repository: string | null, key, valueJson)`,
    `extensionApi(): number`.

Manifest rules, each a problem with its line: `name` kebab-case and equal to the folder's name;
`api` an integer (a different API is not a manifest problem: the loader turns it off with the
compatibility message); `scope` one of the two; `server` and `page` relative paths inside the
folder, to existing files; each setting's `type` one of four, its `default` of that type. A missing
or unreadable `extension.toml` is one fatal problem. A folder named like a built-in is fatal:
`<name> is taken by a built-in extension`. A dangling symbolic link is fatal: `folder not found`.
`.ura-source` is read when present. Hidden entries are skipped, as for themes.

- [x] **Step 1: Write the failing tests, and their helpers**

```rust
// crates/core/tests/extensions.rs
#[test]
fn settings_for_one_repository_override_the_global_ones() {
    // A manifest with setting `folder` (string, default "docs"); config.toml
    // [extensions.wiki] folder = "notes" / [extensions.wiki.repositories.uraeda] folder = "wiki".
    // settings_json(.., Some("uraeda")) has folder "wiki"; Some("other") "notes"; None "notes".
    // set_setting(.., Some("nowhere"), ..) is refused with "no repository named nowhere…",
    // and the file is unchanged byte for byte.
}

#[test]
fn manifest_and_settings_problems() {
    // Rows: name not kebab-case; name differs from the folder; scope "team"; page path missing;
    // setting type "date"; default of another type; built-in name "inbox"; dangling link
    // ("folder not found"); a setting value of the wrong type in config.toml (not fatal,
    // the default is used). Each row: the problem's message, line, and is_fatal.
}

#[test]
fn turning_on_keeps_the_rest_of_the_file() {
    // set_on(.., "wiki", On::Some(vec!["uraeda"])) on a file with comments and an unknown table:
    // only `[extensions.wiki] on = ["uraeda"]` is added; is_on is true for "uraeda", false for "x".
}
```

The break each test catches:

- Repository override: merging in the wrong order, or a typo creating an orphan table.
- Problems: a broken manifest hiding the others, or a wrong type silently accepted.
- Turning on: a write that reorders or drops a human's comments.

Built: a fourth test, `a_first_write_creates_the_file_with_the_nested_table`, writes a repository
named `my.repo` into a new file, its key quoted. A `list` setting is a list of strings (R9); an `on`
that is neither `"all"` nor a list of names turns the extension off, with its problem (R10); the
built-in manifests name icons as the app does, `uraeda:inbox`, and have no version (R11).

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test extensions`
- Expected: FAIL to compile, `unresolved import uraeda_core::extensions`.

- [x] **Step 3: Implement the reader, the writes, the built-in manifests, and the binding**

Built-in manifests carry `api = 1`, `scope = "global"`, their title and one-line description from
the Settings mockup (`packages/web/src/ExtensionsMockups.stories.tsx`), and no `server` or `page`
path (their code is Uraeda's). `claude` declares one setting, `command` (string, default `claude`),
the command it runs. Rebuild the binding (`vp run binding:build`) so `index.d.ts` has the new
functions.

- [x] **Step 4: Make the break, then run the task's validation**

Swap the merge order of the global and repository tables, see
`settings_for_one_repository_override_the_global_ones` fail, revert it, and name the failure in the
commit body.

- Run:
  `nix develop -c cargo nextest run -p uraeda-core && nix develop -c cargo clippy --workspace --all-targets -- -D warnings && vp check`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core crates/binding packages/binding/index.d.ts
git commit -m "feat(extensions-system): read extension manifests and settings in the core"
```

## Task 3: Compile extension files with oxc

**Files:**

- Create: `crates/compile/Cargo.toml` (`uraeda-compile`; `oxc_allocator`, `oxc_ast`,
  `oxc_ast_visit`, `oxc_codegen`, `oxc_diagnostics`, `oxc_parser`, `oxc_semantic`, `oxc_span`,
  `oxc_transformer`, all pinned at `=0.152.0`:
  [R12](rulings.md#r12-oxc-is-pinned-at-01520-the-last-release-that-builds-with-rust-196)),
  `crates/compile/src/lib.rs`, `crates/compile/src/modules.rs` (the import and export rewrite)
- Modify: `Cargo.toml` (workspace member, and in `default-members`), `crates/binding/Cargo.toml`,
  `crates/binding/src/lib.rs`, `vite.tasks.ts` (`rust:features` also refuses oxc:
  [R14](rulings.md#r14-rustfeatures-also-refuses-oxc-in-ura)); Create:
  `crates/binding/src/compile.rs`; regenerated: `packages/binding/index.d.ts`,
  `packages/binding/index.js`
- Test: `crates/compile/tests/compile.rs`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `pub fn compile(source: &str, filename: &str) -> Result<Compiled, CompileError>`
  - `pub struct Compiled { pub code: String, pub imports: Vec<String> }`: `code` is the body of a
    function called as `f(__import, __exports)`; `imports` lists every specifier, in order, each
    once.
  - `pub struct CompileError { pub line: u32, pub column: u32, pub message: String }`
  - Binding: `compileModule(source: string, filename: string): CompiledModule` (synchronous: a file
    takes about 2 ms) with
    `CompiledModule { code: string; imports: string[]; error: { line: number; column: number; message: string } | null }`,
    the error's type named `CompileModuleError`; line and column count from 1, the column in
    characters. A panic in oxc is caught and thrown as a JavaScript error.

The rewrite, applied after the TypeScript and JSX transform (`.ts` without JSX, `.tsx` with the
automatic runtime, `importSource` `react`):

- `import d, { a, b as c } from "x"` →
  `const __m0 = __import("x"); const d = __m0.default; const { a, b: c } = __m0;` (no live bindings:
  a ruling); `import * as n from "x"` → `const n = __import("x");`; `import "x"` → `__import("x");`.
- `export const|let|function|class x` → the declaration, and
  `Object.defineProperty(__exports, "x", { enumerable: true, get: () => x })` placed first in the
  body; `export default function f` or `class C` → the declaration and a getter;
  `export default <expr>` → `__exports.default = (<expr>)`; `export { a as b }` → a getter;
  `export … from "x"` → an import and getters; `export * from "x"` → a getter per key but `default`
  and the module's own names
  ([R13](rulings.md#r13-every-export-is-a-getter-defined-first-and-export--adds-getters)).
- Refused, with their position: top-level `await` ("top-level await is not supported: load in the
  function you export"), dynamic `import()` ("dynamic import is not supported"), and `import.meta`.

- [x] **Step 1: Write the failing tests**

```rust
// crates/compile/tests/compile.rs
#[test]
fn compiles() {
    // Rows: source, filename → run the code with a tiny JS-free check: the emitted text contains
    // no "import " or "export " statements, `imports` is in order, and for each row an expected
    // fragment (`__import("react/jsx-runtime")` for TSX, the defineProperty getter for an export,
    // `__exports.default =`). Error rows: a syntax error (line 3, column 7), top-level await,
    // dynamic import, import.meta, each with its message and line.
}
```

The server's loader tests (task 7) run the output for real; here the contract is the text shape and
the errors.

The break the test catches: an export left as an ES statement, which `vm` refuses at run time; an
import missing from `imports`, so the loader never compiles that file.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-compile`
- Expected: FAIL to compile, the crate does not exist.

- [x] **Step 3: Implement the crate and the binding function**

Rewrite by spans on the transformed code (parse it again, splice each top-level module declaration),
not by building AST nodes.

- [x] **Step 4: Measure, then run the task's validation**

Record the release binding's size before and after (`pnpm run build:release` in `packages/binding`,
the `.node` file's bytes) in `rulings.md`, for SC-004.

- Run:
  `nix develop -c cargo nextest run -p uraeda-compile && nix develop -c cargo clippy --workspace --all-targets -- -D warnings && vp run rust:features`
- Expected: PASS; `rust:features` confirms `uraeda-cli` pulls in neither `napi` nor oxc.

- [x] **Step 5: Commit**

```bash
git add Cargo.toml Cargo.lock vite.tasks.ts crates/compile crates/binding packages/binding/index.d.ts packages/binding/index.js specs/2026-11-08-extensions-system/plan.md specs/2026-11-08-extensions-system/rulings.md
git commit -m "feat(extensions-system): compile extension files with oxc"
```

## Task 4: Runtimes: several agents, usage as windows

**Risky:** a rule every session relies on: which runtime runs a session, after a restart too.

**Files:**

- Create: `packages/server/src/runner/runtimes.ts`
- Modify: `runner/adapter.ts` (`Adapter` gains `usage`, `icon`; `OpenOptions` gains `skills`),
  `runner/events.ts` (`usage` event, `init.problem`), `runner/claude-events.ts`, `runner/claude.ts`,
  `runner/fake.ts`, `runner/transcript.ts`, `runner/processes.ts`, `runner/sessions.ts`,
  `runner/session-state.ts`, `runner/send.ts`, `runner/session-folders.ts`, `runner/take-back.ts`,
  `runner/turns.ts`, `runner/live-sessions.ts`, the `fate/` files that read `sessions.adapter`
  (listed in **Code read**), `fate/views.ts` (`AgentRecord`), `live.ts` (`createSessions`),
  `server.ts`, `main.ts`, `dev.ts`, `testing.ts`, `src/__tests__/helpers.ts`,
  `runner/__tests__/helpers.ts`
- Modify (web, same contract): `packages/web/src/views.ts` (`AgentView`), `home/Usage.tsx`,
  `sidebar/Allowance.tsx`, `HarnessMark.tsx`, `packages/web/sandbox/agent.ts`
- Modify (benchmarks): `packages/benchmarks/src/real-deps.ts` and the files importing `Adapter`, if
  the type moves
- Test: `runner/__tests__/runtimes.test.ts`; Modify: `runner/__tests__/claude.test.ts`,
  `sessions.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `export type UsageWindow = { id: string; label: string; used: number /* 0..1 */; resetsAt: string }`;
    `AgentEvent` `{ type: "usage"; windows: ReadonlyArray<UsageWindow> }` replaces
    `fiveHour`/`week`; `init` gains `problem?: string`.
  - `Adapter` gains `readonly icon: string` (an icon name of the app's set; Claude Code
    `uraeda:harness-claude`). `OpenOptions` gains `skills: ReadonlyArray<string>` (skill folders to
    pass, empty until task 11). `export type Runtime = Adapter` for extensions.
  - `class Runtimes`: `register(name: string, runtime: Adapter): () => void` (the undo; a name
    registered twice throws); `get(name: string): Adapter | undefined`;
    `forRepository(repo: string | null): Adapter[]` (on there, in registration order);
    `new Runtimes({ isOn })`, `isOn: (name, repo) => boolean`, `repo` being the main checkout's path
    the sessions are kept under, or null (R19); `onChange(listener): () => void`, fired by
    `register`, the undo, and `changed()`, which task 8 calls when an `on` list changes. Also
    `names()`, `defaultFor(repo)` (the name a new session takes), `status(name)` and `check()` (each
    runtime's availability and version, checked every minute as the one agent was), and
    `records(repo, usage)`. A runtime's `kind` in the UI is the name it is registered as; the
    adapter's own `kind` stays for the benchmarks' records. `runtimesOf({ claude: adapter })` builds
    one, for `main.ts`, `dev.ts`, the tests, and the sandbox.
  - `Sessions` takes `runtimes: Runtimes` instead of `adapter`; `sessions.runtimes`;
    `sessions.runtimeOf(sessionId): Adapter | undefined` (by the stored `agent`, registered, on or
    off); `sessions.usage(name): UsageWindow[]`. `Sessions.status()` is gone: the fate code reads
    `runtimes.status`, and the helpers `messageRuntime` and `runtimeState` of `runtimes.ts`.
  - A new session is created with `agent` = the runtime chosen: `featureSession`, `newSession`, and
    `newChat` take an optional `runtime`, else the first of `forRepository` (R20); none → refused
    with `No agent runtime is on here: turn one on in Settings, Extensions`. A run that starts fresh
    in a new session keeps the runtime of the session it was sent to. A session whose runtime is
    missing or off refuses sends with `<title> is off: turn it on to continue this session`, the
    title being the session's stored runtime name (from the extension's title once task 8 lands; the
    `agent` name until then). A process keeps the runtime it was opened on to its exit.
  - `AgentRecord` =
    `{ id, runtimes: Array<{ kind, name, icon, available, version, capabilities, usage: UsageWindow[], isOn }> }`:
    the web's `AgentView` follows, and `Usage.tsx` and `Allowance.tsx` draw `usage` windows by
    `label`, the rail bar from the first window.
  - The plugin check: `transcript.ts` halts the turn when `init.problem` is set, with the problem as
    its text; `claude-events.ts` sets `problem` to "The Uraeda skill did not load: <why>" when
    `pluginErrors` is non-empty or `plugins` lacks `uraeda`. The `init` event no longer carries
    `plugins` and `pluginErrors`: they are Claude Code's format. `FakeAdapter` sends no problem
    unless a script does.
  - The web's `useAgent()` returns the first runtime on (`AgentRecord.runtimes`), in the shape the
    views read; `UsageWindow` takes a `window` and shows the reset's weekday when it is not today.
    The sandbox registers its agent as `fake`, `claude`, and `codex`, so its sample sessions of each
    kind still answer. `HarnessMark` is left to task 13.

`ClaudeAdapter` and `FakeAdapter` keep their constructors; `main.ts`, `dev.ts`, and the tests
register them in a `Runtimes` under `claude` and `fake` until task 8 moves that into built-in
extensions. `sessions.ts` is at 495 lines: move the status and runtime lookups into `runtimes.ts`
rather than growing it.

- [x] **Step 1: Write the failing tests, and rewrite the moved ones**

```ts
// packages/server/src/runner/__tests__/runtimes.test.ts
test.each([
  ["on", true, "sends"],
  ["off", false, "pi-durable is off: turn it on to continue this session"],
  ["removed", undefined, "pi-durable is off: turn it on to continue this session"],
])("a session runs on the runtime it was started with (%s)", async (_, state, expected) => {
  // Two fake runtimes, "claude" and "pi-durable"; a session started with runtime "pi-durable"
  // is stored with agent "pi-durable" and opens that runtime's process. After `restart`, with the
  // runtime on, off, or unregistered, a send opens pi-durable again or is refused with the text.
});

test("starting a session with no runtime on is refused", async () => {
  // isOn false for both: the send is refused with
  // "No agent runtime is on here: turn one on in Settings, Extensions".
});
```

In `claude.test.ts`, the usage fixtures now expect
`windows: [{ id: "five_hour", label: "5h", … }, { id: "seven_day", label: "Week", … }]`, and the
init fixtures expect `problem` undefined and "The Uraeda skill did not load: …". In
`sessions.test.ts`, the two plugin tests script an `init` with `problem` instead of plugin lists,
keeping their names' behaviour: the turn fails with the problem's text.

The break each test catches:

- Runtime by session: a send using the first runtime instead of the stored one, which moves a
  pi-durable session onto Claude Code after a restart.
- No runtime: a session created with an empty `agent`.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner`
- Expected: FAIL, `Cannot find module '../runtimes.ts'`.

- [x] **Step 3: Implement the registry, the contract changes, and their readers**

Make the break: have `runtimeOf` return the first runtime; see the `removed` row fail; revert.

- [x] **Step 4: Run the task's validation**

- Run: `vp check && vp test packages/server packages/web packages/benchmarks`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server packages/web packages/benchmarks
git commit -m "feat(extensions-system): run sessions on several runtimes, usage as windows"
```

## Task 5: `ura extension`

**Risky:** clones code that later runs as the owner; must pin and never run it.

**Files:**

- Create: `crates/cli/src/extension.rs` (args and dispatch), `crates/cli/src/extension/add.rs`,
  `update.rs`, `remove.rs`, `list.rs`, `where.rs` (the "where is it on" question)
- Create: `crates/core/src/extensions/install.rs` (clone, pin, link, source file, remove: core, so
  the CLI stays thin and the rules are tested once), and `crates/core/src/git/pin.rs` (the clone,
  the fetch, the detached checkout, and the diff, in the git module, as the git decision asks of
  every write)
- Modify: `crates/cli/src/main.rs` (`Command::Extension(extension::Args)`), `docs/cli.md`,
  `skills/uraeda/references/cli.md` (the skill names every command, `crates/cli/tests/skill.rs`)
- Test: `crates/cli/tests/extension.rs`

**Interfaces:**

- Consumes: task 2's `read`, `set_on`, `extensions_dir`, `Extension`; `git::process::run`.
- Produces: the commands below; core functions
  `install::add(config_dir, source: &str, cwd: &Path) -> Result<Extension, ApiError>`,
  `install::update(config_dir, name) -> Result<Pending, ApiError>` (fetches, returns
  `Pending { from, to, diff: String }`), `install::apply(config_dir, name, to: &str)`,
  `install::remove(config_dir, name) -> Result<(), ApiError>`; `ExtensionProblem::text()`, a problem
  as `extension.toml:3: <message>`.

Commands:

- `ura extension add <folder | git URL> [--all | --here | --repo <name>]... [--no-input]`: a folder
  is linked (`<config>/extensions/<name>` → the folder; a folder already inside the extensions
  folder is only turned on); a URL (anything `git clone` takes that is not an existing folder) is
  cloned into a temporary folder, its manifest read for the name, then moved to
  `<config>/extensions/<name>`, checked out at the default branch's commit, detached, with
  `.ura-source` (`url`, `commit`, `ref`); a host without a scheme, `github.com/gary/uraeda-deploy`,
  is cloned over `https://`. Refuses: `<name> is taken by a built-in extension`, a manifest with a
  fatal problem (`<file>:<line>: <message>`), a name already installed
  (`<name> is already installed: run ura extension update <name>`). A new extension is written
  `on = []` before its folder appears (R18). The flags are read before anything is cloned. Then asks
  where it is on: a picker "Every repository" / "This repository (<name>)", the second first when
  the manifest's `scope` is `repository`; outside a listed repository only "Every repository".
  Prints `Turned <title> on for: every repository` or `…: <name>`. Without a terminal and without a
  flag: `no terminal to ask: pass --all or --here`. `--here` outside a listed repository:
  `this folder is in no repository of Uraeda's list: run ura add, or pass --all or --repo <name>`. A
  cancelled picker leaves it installed, its `on` unchanged:
  `cancelled: where <title> is on did not change`.
- `ura extension update <name> [--yes]`: fetches `ref`, prints `<title>: <old> -> <new>` and
  `git diff <old>..<new>`, asks "Move <title> to <short commit>?" (No first), and moves only on yes,
  printing `Moved <title> to <short commit>`; nothing new:
  `<title> is up to date at <short commit>`. Linked folders:
  `<name> is linked: update its folder yourself`; built-ins:
  `<name> is built in: it updates with Uraeda`. Without a terminal and without `--yes`, prints the
  diff, then `<title> stays at <old>: pass --yes to move it`, and moves nothing.
- `ura extension remove <name>`: deletes the folder or the link, never a linked folder's files; the
  settings stay: `Removed <title>: its settings stay in <config.toml>`. Built-ins:
  `<name> is built in: turn it off in Settings, Extensions`.
- `ura extension list [--json]`: name, title, version, where on (`every repository`, names, or
  `off`), source (`built in`, `<url> at <short commit>`, or `linked <folder>`), then each problem
  indented; `--json` with `{"version": 1, "extensions": [...]}`, each with `name`, `title`,
  `description`, `version`, `api`, `scope`, `folder`, `is_built_in`, `is_linked`, `on_all`, `on`,
  `source` (`url`, `commit`, `ref`, or `null`), and `problems`.

- [x] **Step 1: Write the failing tests**

```rust
// crates/cli/tests/extension.rs
#[test]
fn add_clones_pins_and_turns_on() {
    // A local bare git repository holding extension.toml (name "deploy") as the URL;
    // `ura extension add <url> --all`: <config>/extensions/deploy exists at the commit,
    // .ura-source has url, commit, ref; config.toml has [extensions.deploy] on = "all".
    // Adding again is refused; a repository named "inbox" is refused with
    // "inbox is taken by a built-in extension".
}

#[test]
fn update_shows_the_diff_and_moves_only_with_yes() {
    // Two new upstream commits: `update deploy` without a terminal prints the new commit and the
    // diff, and HEAD stays; `update deploy --yes` moves HEAD and .ura-source's commit.
}

#[test]
fn remove_keeps_settings() {
    // After `remove deploy`, the folder is gone and [extensions.deploy] stays.
}

#[test]
fn add_without_a_terminal_needs_where() {
    // `ura extension add <folder>` with no flag and no terminal fails with
    // "no terminal to ask: pass --all or --here"; `--here` in a listed repository writes on = [name].
}
```

A unit test in `where.rs` covers the picker's order for both scopes, and the flags' answers.

The break each test catches: a clone left on a branch that moves; an update that moves without yes;
a remove that deletes settings; a prompt an agent cannot answer.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-cli --test extension`
- Expected: FAIL, `unrecognized subcommand 'extension'`.

- [x] **Step 3: Implement the commands**

Make the break: skip the detached checkout; see `add_clones_pins_and_turns_on` fail on the commit;
revert.

- [x] **Step 4: Run the task's validation**

- Run:
  `nix develop -c cargo nextest run -p uraeda-cli -p uraeda-core && nix develop -c cargo clippy --workspace --all-targets -- -D warnings`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/cli crates/core docs/cli.md skills/uraeda/references/cli.md specs/2026-11-08-extensions-system
git commit -m "feat(extensions-system): add, update, remove, and list extensions with ura"
```

## Task 6: Compile extension pages with StyleX and React Compiler

**Files:**

- Create: `packages/server/src/extensions/page-compiler.ts`
- Modify: `packages/server/src/paths.ts` (`Layout.stylexTokens`: the path of Astryx's
  `dist/theme/tokens.stylex.js`, in the checkout from `node_modules`, in the package from
  `dist/stylex/tokens.stylex.js`)
- Modify: `packages/server/src/extensions/__tests__/spike.test.ts` (the StyleX test goes through
  `compilePage`), `packages/server/src/__tests__/paths.test.ts` (`stylexTokens` in both layouts)
- Test: `packages/server/src/extensions/__tests__/page-compiler.test.ts` (each priority level's rule
  as specific as Astryx's, R15; a StyleX error's position, R17)

**Interfaces:**

- Consumes: task 1's dependencies; task 3's `compileModule` is not used here.
- Produces:
  `compilePage(source: string, filename: string, tokens: string): { code: string; css: string } | { error: { line: number; column: number; message: string } }`:
  Babel with `parserOpts.plugins: ["typescript", "jsx"]`, `@stylexjs/babel-plugin` first, as the
  app's build, then `babel-plugin-react-compiler`, StyleX with the app's options (`dev: false`,
  `debug: false`, `runtimeInjection: false`, a custom resolver mapping
  `@astryxdesign/core/theme/tokens.stylex` to `tokens`), output still TSX for the compiler; `css`
  from `processStylexRules` with the options the app's unplugin uses (no layers), with placeholder
  rules so each rule gets Astryx's specificity for its priority level (R15), and without the
  unplugin's Lightning CSS pass (R16). Errors are at a 1-based line and column (R17).

- [x] **Step 1: Move the StyleX check onto `compilePage`, and add a React Compiler row**

The existing assertion stays, and the compiled CSS must hold the same rule; a second asserts the
output imports `react/compiler-runtime` and is still TSX; a third gives a syntax error's line and
column.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test packages/server/src/extensions/__tests__/spike.test.ts`
- Expected: FAIL, `Cannot find module '../page-compiler.ts'`.

- [x] **Step 3: Implement `compilePage`**

- [x] **Step 4: Run the task's validation**

- Run: `vp check && vp test packages/server/src/extensions`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server/src/extensions packages/server/src/paths.ts \
  packages/server/src/__tests__/paths.test.ts specs/2026-11-08-extensions-system
git commit -m "feat(extensions-system): compile extension pages with StyleX and React Compiler"
```

## Task 7: The loader

**Risky:** runs the owner's code in the server; owns reload, isolation, and where code comes from.

**Files:**

- Create: `packages/server/src/extensions/loader.ts` (state, reload queue), `extensions/evaluate.ts`
  (the module runner under `vm`), `extensions/graph.ts` (compiles an entry's files, resolves
  relative imports inside the folder), `extensions/scope.ts` (registrations and their undo, the
  stale check), `extensions/faults.ts` (scoped timers, the process's backstop)
- Test: `extensions/__tests__/loader.test.ts`, `extensions/__tests__/loader-faults.test.ts`,
  `extensions/__tests__/graph.test.ts`, `extensions/__tests__/loader.bench.test.ts`,
  `extensions/__tests__/helpers.ts` (`extensionFolder(config, name, files)`, `loaded(loader, name)`:
  a promise of the loader's next notice for that name)

**Interfaces:**

- Consumes: task 2's `readExtensions`, `extensionApi`, `extensionsFolder`; task 3's `compileModule`;
  `FileWatch`. Task 6's `compilePage` is built beside this task, so the loader takes it as an
  option, and task 8 passes the real one
  ([R23](rulings.md#r23-the-loader-takes-the-page-compiler-as-an-option)).
- Produces:
  - `class Loader`:
    `static open({ binding, configDir, api: (scope: Scope) => object, shared: Record<string, unknown>, compilePage: PageCompiler }): Promise<Loader>`,
    with
    `PageCompiler = (source: string, filename: string) => { code: string; css: string } | { error: { line: number; column: number; message: string } }`
    (task 6's `compilePage` with its `tokens` bound; `filename` is the file's absolute path);
    `list(): ReadonlyArray<LoadedExtension>`; `get(name)`;
    `onChange(listener: (name: string) => void): () => void` (after every load, unload, or problem);
    `pageBundle(name): PageBundle | undefined`;
    `defer(name, until: Promise<void>, waitingFor?: string)` (a reload waits on it: task 8's
    runtimes); `reload(name): Promise<void>` (reads and loads it again, as a change of its settings
    asks); `close()`.
  - `LoadedExtension = { extension: Extension /* task 2 */; version: number; state: "on" | "off" | "broken" | "waiting"; problems: ReadonlyArray<{ file: string; line?: number; message: string }>; waitingFor?: string }`.
  - `class Scope`: `name`, `isLive()`, `add(undo: () => void)`, `check()` (throws
    `Error("<name>: this version of the extension was unloaded")` once unloaded), `onUnload(fn)`.
  - `PageBundle = { version: number; modules: Record<string, string>; entry: string; css: string }`
    (relative paths as keys, `/` between parts, the entry first): page files compiled through
    `compilePage` then `compileModule`, the CSS of each file joined by a line break. A module's
    relative imports keep their text: the page runtime resolves them against the keys with the same
    rule (`.ts`, `.tsx`, `/index.ts`, `/index.tsx`).

Behaviour:

- Reads `readExtensions(configDir)` at open and on every change of `<config>/extensions/` and of
  each extension's folder (links followed); never another path.
- An extension is evaluated when its `api` equals `extensionApi()` (else state `off`, problem
  `built for extension API <n>, and Uraeda runs API <m>`), it has no fatal problem (else state
  `broken`, its running version unloaded, as for `folder not found`), it is on in some repository
  (else `off`), and it has a `server` entry. Built-ins (`isBuiltIn`) are listed, `on` or `off`, and
  never evaluated here: task 8 registers them.
- Compile the entry's graph first: relative imports resolve inside the folder only (`.ts`, `.tsx`,
  `/index.ts`), a path leaving it is a problem; bare specifiers must be keys of `shared` or `node:`
  modules (server only); a page's bare specifiers are the page runtime's to check, except `node:`
  ones, refused ([R26](rulings.md#r26-a-pages-bare-imports-are-the-page-runtimes-to-check)). Any
  compile problem keeps the last working version running, with the problem shown (state stays `on`,
  problems set); with no working version, state `broken`.
- Evaluate synchronously inside one `new vm.Script("…").runInThisContext({ timeout: 2000 })`: the
  module bodies (from `vm.compileFunction` with the file as `filename`) and the call of the entry's
  default export with `api(scope)`. A throw or the timeout makes state `broken`, with the message,
  and undoes what the version registered. Activation is synchronous: one that returns a promise is
  `broken`, with the problem
  `activation must be synchronous: start async work from a callback, not while loading`, and its
  registrations undone ([R28](rulings.md#r28-activation-is-synchronous)). A version removed, or the
  loader closed, while it loads is unloaded and never kept. A throw after activation breaks only its
  extension: module code sees scoped `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`,
  and their `clear*`, whose callbacks' throws break the version and which unloading clears; and the
  loader's handlers of the process's `uncaughtException` and `unhandledRejection` break the
  extension whose folder the error's stack names, else print it and exit with code 1, as Node does
  ([R29](rulings.md#r29-late-throws-break-only-their-extension)). Each module function is compiled
  with a context extension without a prototype, holding only those timers, which keeps V8's
  compilation cache from holding every version
  ([R24](rulings.md#r24-module-functions-are-compiled-with-an-empty-context-extension)).
- Reload: debounce changes 50 ms per extension; one compile at a time per extension; a change during
  a compile queues exactly one more, of the latest files. `reload(name)` during a load queues that
  one more and resolves after it. Before evaluating a new version, unload the old one: run its undos
  in reverse order, then mark its scope dead.
- Watches: `<config>/extensions/` (its entries and their link targets); for a linked extension, its
  folder and the folder of each file its last working version compiled, and on a compile problem the
  files at fault too; a watched folder deleted and made again is followed on its next event; for an
  installed one, its `.ura-source` only, which `ura extension update` rewrites.
- `defer(name, until, waitingFor)`: a reload of that extension waits until the promise settles,
  state `waiting`, `waitingFor` set by the caller.

- [x] **Step 1: Write the failing tests, and their helpers**

```ts
// packages/server/src/extensions/__tests__/loader.test.ts
test("a saved change reloads the extension once, latest files", async () => {
  // An extension whose server.ts registers `api.mark(n)`; write n=1, n=2, n=3 within 10 ms:
  // one reload, the final registrations are [3], the old version's undo ran.
});
test("a file that fails to compile keeps the last working version", async () => {
  // v1 loads; v2 has a syntax error at line 2: v1's registration stays, problems name
  // "server.ts", line 2.
});
test.each([
  ["throws", "throw new Error('boom')", "boom"],
  ["loops", "while (true) {}", "Script execution timed out"],
  ["does not compile", "const = ;", "server.ts"],
  [
    "is built for another API",
    "api = 2 in extension.toml",
    "built for extension API 2, and Uraeda runs API 1",
  ],
  ["lost its folder", "a dangling link", "folder not found"],
])("a broken extension leaves the others running (%s)", async (_, breakage, message) => {
  // Two extensions, one broken: the other's registration is there, the broken one's state and
  // problem name the message.
});
test("an unloaded version's calls are refused", async () => {
  // v1 keeps a reference to `api` in a global; after reload, calling it throws
  // "wiki: this version of the extension was unloaded".
});
test("loads only the config folder's extensions", async () => {
  // A repository holding `.uraeda/extensions/x` and `extensions/x` is ignored; a link in the
  // config folder to a folder anywhere loads (it is the owner's act).
});
```

```ts
// packages/server/src/extensions/__tests__/loader.bench.test.ts
test("SC-001: a saved change reloads an extension of 50 files within 1 second", async () => {});
test("SC-002: 100 reloads grow the heap by less than 10 MB", async () => {
  // gc between measures: exposed at run time with `v8.setFlagsFromString("--expose-gc")` and a
  // new `vm` context, skipped with a message when it is unavailable (R25).
});
```

The first test also defers a reload (`defer`), and holds a reload mid-compile through a binding
whose `readExtensions` waits at a gate, so a save then compiles exactly once more. The break each
test catches: Node's `import()` used instead (memory grows, SC-002); undos not run (old registration
kept); an older compile finishing last and winning; the timeout missing (the test process hangs: the
loop row is the guard); a compile error unloading the working version.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/extensions`
- Expected: FAIL, `Cannot find module '../loader.ts'`.

- [x] **Step 3: Implement the loader**

Make the breaks: drop the undo call (the reload test fails); drop the timeout (the loop row hangs:
stop it, revert); report both in the commit body.

- [x] **Step 4: Run the task's validation**

- Run: `vp check && vp test packages/server`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server/src/extensions
git commit -m "feat(extensions-system): load, isolate, and reload extensions"
```

## Task 8: The server API, its data channel, routes, events, and built-in server extensions

**Risky:** new routes behind sign-in, and runtimes registered by extensions.

**Files:**

- Create: `packages/server/src/extensions/api.ts` (`serverApi(scope, deps): ServerApi`),
  `extensions/events.ts` (step comparison and the event bus), `extensions/routes.ts` (the
  `/x/<name>/*` dispatch and the page-bundle route), `extensions/builtins.ts` (registers the
  built-ins' server parts through the same `serverApi`, and `BuiltIns`, their scopes and reloads),
  `extensions/server.ts` (`ExtensionsHost`: reads the extensions and their settings, owns the
  runtimes, opens the loader with its deps; `startServer` calls it), `extensions/contributions.ts`
  (records, actions, and routes, each called inside a guard), `extensions/turns.ts` (the sessions at
  work by runtime, which a runtime's reload waits for)
- Create: `packages/server/src/extension-api.ts`: the public types extensions import as
  `uraeda/server` (`ServerApi`, `Runtime`, `UsageWindow`, event payloads), exported from
  `packages/server/package.json` as `./extension-api`
- Create: `fate/extensions.ts` (views `Extensions`, id `extensions`, `ExtensionRecord`, id
  `<extension>/<name>`, and `ExtensionAction`, an action's answer), `fate/extension-mutations.ts`
  (mutations `extensions.setOn`, `extensions.setSetting`, `extensions.act`)
- Modify: `fate.ts`, `fate/mutations.ts`, `fate/sources.ts`, `fate/context.ts`
  (`extensions?: ExtensionsHost` in the context, absent in tests' apps made without one, R32),
  `server.ts` (`startServer` takes `agents` instead of `runtimes`, R31), `app.ts` (the extensions'
  routes; the turn-done Storybook warmer stays only for an app without extensions, the `previews`
  built-in doing it otherwise), `server-paths.ts`, `live.ts` (`onSessionChange`,
  `announceEverywhere`), `repositories.ts` (`started` and `changed` hooks feed the events),
  `settings.ts` (`onRead`, after every read of `config.toml`), `runner/cache.ts` (`onCreated`, for
  `session-started`), `runner/runtimes.ts` (a status carried across a re-registration; refusals name
  the extension's title), `main.ts`, `dev.ts`, the tests and the sandbox that passed `runtimes`
  (runtimes now come from the built-ins)
- Test: `extensions/__tests__/api.test.ts`; Modify: `sign-in/__tests__/closed.test.ts`

**Interfaces:**

- Consumes: tasks 2, 4, 7.
- Produces:
  - `ServerApi` (each method calls `scope.check()` first; every registration is undone on unload):
    - `runtime(runtime: Runtime): void` (registered under the extension's name);
    - `record<T>(name: string, read: (repository: string) => T | Promise<T>): { changed(repository?: string): void }`
      (JSON-serialisable values; read only for repositories the extension is on in);
    - `action<I, O>(name: string, run: (input: I, repository: string) => O | Promise<O>): void`;
    - `route(path: string, handler: (c: HonoContext, repository: string | null) => Response | Promise<Response>, method?: "GET" | "POST"): void`:
      `path` must start with `/x/<name>/`, else throws `<name>: routes must be under /x/<name>/`;
    - `on(event: "step-reached" | "turn-ended" | "commit-landed" | "session-started", handler): void`,
      each payload with `repository` and `time` (ISO), and: step-reached `{ feature, step }`,
      turn-ended `{ session, feature, state }`, commit-landed `{ branch, commit }`, session-started
      `{ session, runtime }`; step-reached also gives `waitsOn`, and its `step` is the waiting
      file's kind at a human gate (R30); delivered only for repositories the extension is on in;
    - `settings(repository: string | null): Record<string, unknown>` (task 2's `settings_json`);
    - `repositories(): ReadonlyArray<{ name: string; path: string }>` (the on ones);
    - `log(message: string): void` (to the server's output, prefixed with the name).
  - fate: `Extensions` =
    `{ id: "extensions", folder, docs, api, extensions: Array<{ name, title, description, version, api, icon, isBuiltIn, isLinked, source, onAll, on, state, problems: Array<{ file, line: number | null, message }>, waitingFor, settings: SettingSpec[], values: string /* JSON, global */, keys: Array<{ keys, takenBy }>, pageVersion: number | null }> }`;
    `keys` is always empty from the server: the page fills in its clashes (task 9, R35); `docs` is
    `<checkout>/docs/extensions.md` until task 14 ships the documentation; `ExtensionRecord` =
    `{ id, value: string /* JSON */, error: string | null }` on each repository's fate server, live
    through its bus.
  - Mutations: `extensions.setOn({ name, on: "all" | string[] })`,
    `extensions.setSetting({ name, repository, key, valueJson })`,
    `extensions.act({ extension, name, inputJson })` → `ExtensionAction` `{ id, outputJson }`
    (repository from the request's context; refused when off there).
  - Routes: `GET /extensions/<name>/page` → the `PageBundle` JSON, `cache-control: no-store`;
    `ALL /x/<name>/*` and `/r/<repo>/x/<name>/*` → the extension's handler (a route path ending `/*`
    takes the paths under it; without `method`, every method answers, R33). Both in `SERVER_PATHS`,
    both closed.
  - Events: the server keeps each repository's last step per feature (from its workspace read); each
    watcher `Changes` listing a feature compares the new step's `name` with the kept one and emits
    `step-reached` when it differs; `git: true` emits `commit-landed` with the branch; `onTurnDone`
    emits `turn-ended`; a session's creation emits `session-started`. A handler's throw is logged
    with the extension's name and never reaches the caller.
  - Built-ins' server parts through `serverApi` with a built-in scope: `claude` registers
    `ClaudeAdapter` (its `command` setting), `fake` registers `FakeAdapter` only when the server is
    started with a fake agent (tests, sandbox) and is off otherwise, `previews` moves the Storybook
    warmer onto `turn-ended`. `inbox`, `priorities`, `decisions`, `git`, and `notifications` have no
    server part: their data stays in Uraeda's static fate views, which stay served when they are
    off.
  - A runtime extension's reload is deferred (`loader.defer`) while one of its sessions has a turn
    running, with `waitingFor` = that session's title; it reloads when the turn ends. A built-in's
    settings change registers it again, a runtime's once its turns end, the same way (R34).
  - Each read of `config.toml` reads the extensions and their settings again: an extension whose
    `on` or settings changed reloads (`loader.reload`, or the built-in registered again), and the
    `Extensions` record is sent on every bus, as after each of the loader's notices.

- [x] **Step 1: Write the failing tests**

```ts
// packages/server/src/extensions/__tests__/api.test.ts
test("records reach fate, live", async () => {
  // An extension on in "uraeda" registers record "pages"; fate at /r/uraeda/fate reads
  // ExtensionRecord "wiki/pages" with its JSON; `changed("uraeda")` sends a live update; reading it
  // for a repository it is off in gives error "wiki is off in other".
});
test("events reach only repositories the extension is on in", async () => {
  // A spec's status moves to awaiting-human in "uraeda": step-reached { repository: "uraeda",
  // feature, step: "spec", time }; the same in "other" sends nothing.
});
test("a runtime reloads once its turns end", async () => {
  // A runtime extension with a session mid-turn: saving its file leaves state "waiting",
  // waitingFor the session's title; ending the turn reloads it.
});
test("a route outside /x/<name>/ is refused", () => {
  // api.route("/api/x", …) throws "wiki: routes must be under /x/wiki/".
});
```

In `closed.test.ts`, the `closed` table gains `/x/wiki/hello`, `/r/repo/x/wiki/hello`, and
`/extensions/wiki/page`: each needs a session.

The break each test catches: records served to repositories the extension is off in; an event
leaking across repositories; a runtime reloaded mid-turn; an extension route reachable without
sign-in.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/extensions packages/server/src/sign-in`
- Expected: FAIL, `Cannot find module '../api.ts'`.

- [x] **Step 3: Implement the API, the views, the routes, the events, and the built-ins**

Make the break: drop the `isOn` check in event delivery; see the events test fail; revert.

- [x] **Step 4: Run the task's validation**

- Run: `vp check && vp test packages/server packages/web`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server packages/web/.fate
git commit -m "feat(extensions-system): give extensions records, actions, routes, events, and runtimes"
```

## Task 9: Web registries, with Uraeda's places as built-in extensions

**Files:**

- Create: `packages/web/src/extensions/registry.ts` (the store), `extensions/pageApi.ts` (the
  `PageApi` type and `pageApi(name, registry)`), `extensions/useContributions.ts`,
  `extensions/OffPage.tsx` ("Inbox is off here" with a button that turns it on here),
  `extensions/builtins/{inbox,priorities,decisions,git,previews,notifications,sessions}.tsx`
- Modify: `destinations.ts` (keeps only Home, Sessions, New, Settings), `keys/leaderTree.ts`,
  `keys/LeaderKeys.tsx`, `keys/kinds.ts`, `keys/pickerSources.ts`, `shell/ColumnPanes.tsx`,
  `shell/Tabs.tsx`, `home/HomeHub.tsx`, `NewEntries.tsx`, `NewPage.tsx`, `shell/StatusLine.tsx`,
  `routeTable.ts` (route `extension { name, rest }` at `/e/<name>/…`), `App.tsx` (`RoutePage`
  renders a place's component, or `OffPage` for a built-in place off here), `views.ts` and `data.ts`
  (`ExtensionsView`, `useExtensions()`)
- Test: `extensions/registry.test.ts`, `src/__tests__/extensions-builtins.test.tsx`

**Interfaces:**

- Consumes: task 8's `Extensions` view and `extensions.setOn`.
- Produces:
  - `type PageApi = { place(p: Place): void; homePane(p: HomePane): void; newSection(s: NewSection): void; statusItem(s: StatusItem): void; itemRenderer(r: ItemRenderer): void; settingsSection(s: SettingsSection): void; key(k: ExtensionKey): void }`,
    each registration tagged with its extension and undone with the extension.
  - `Place = { id: string; title: string; icon: IconName; key?: string /* leader key after Space */; path?: string /* built-ins keep theirs; yours are /e/<name>/<id> */; component: ComponentType; count?: () => number | undefined; phoneTab?: "bar" | "more"; actions?: ComponentType }`;
    `HomePane = { id; title; icon; tone; component: ComponentType; column: 0 | 1 }` (renders as a
    `WorkSection`'s body);
    `NewSection = { id; title; tone; component: ComponentType<{ search: string; onInsert: … }> }`;
    `StatusItem = { id; component: ComponentType }`;
    `ItemRenderer = { tool: string; component: ComponentType<{ item: Item }> }`;
    `SettingsSection = { id; title; icon; component: ComponentType }`;
    `ExtensionKey = { keys: string; label: string; icon?: IconName; run: () => void }` (always under
    the leader, `space …`).
  - `createRegistry()`: `register(extension, order, contribution) → undo`; `list(kind, isOn)`:
    built-ins in their `order` (today's order), then yours by extension name; keys: the first
    registered keeps a key, a later clash is dropped and reported as `{ keys, takenBy: <title> }`
    (shown by task 10 as "`y` is taken by Deploy").
  - `useContributions(kind)`: the current repository's on extensions only (from `useExtensions()`).
  - Each built-in file registers what today's literals draw: the inbox its place (`i`, `/inbox`,
    count, phone tab "bar", add-note action), its home pane, its New section, its find key
    (`space f n`) and new key (`space n n`); priorities the same for priorities and proposals;
    decisions its place (`d`, phone tab "more") and find key; git its action-row place and keys
    (`space g`, `g G`); previews nothing visible beyond today's story pages; notifications its
    needs-you behaviour; sessions (not an extension in the manifests: always on) its place. Screens
    look exactly as today when every built-in is on.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/web/src/extensions/registry.test.ts
test("places keep the built-ins' order, then yours by name", () => {
  // Built-ins inbox (order 1), priorities (2) registered after "wiki" and "deploy":
  // list gives inbox, priorities, deploy, wiki.
});
test("the first loaded keeps a key", () => {
  // deploy then wiki register `space y`: wiki's binding is dropped, reported
  // { keys: "space y", takenBy: "Deploy" }; unregistering deploy gives the key to nobody until
  // wiki reloads.
});
```

```ts
// packages/web/src/__tests__/extensions-builtins.test.tsx
test.each([
  ["every repository", { inbox: [] }, "uraeda"],
  ["this repository", { inbox: ["other"] }, "uraeda"],
])("a built-in turned off leaves every list (%s)", async (_, on, repo) => {
  // renderPage("/", repo) with config.toml turning the inbox off as `on` says: no "Inbox" in the
  // navigation, the home's sections, or the New page; `space i` does nothing; /inbox shows
  // "Inbox is off here" with its button. In a repository it is still on in, the Inbox shows.
});
```

The break each test catches: yours sorted before Uraeda's; a clash reaching `useKeys`, which throws
outside production and blanks the page; a list still reading the old literal.

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/extensions packages/web/src/__tests__/extensions-builtins.test.tsx`
- Expected: FAIL, `Cannot find module './registry.ts'`.

- [ ] **Step 3: Implement the registry, the built-ins, and move each list onto it**

- [ ] **Step 4: Run the task's validation, and review the screens**

- Run: `vp check && vp test packages/web`
- Expected: PASS. Then `vp run sandbox`: the home, the navigation, the phone tabs, the leader menu,
  and the New page look as before with everything on; with the inbox off, it is gone from each.

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(extensions-system): draw Uraeda's places from registries, as built-in extensions"
```

## Task 10: Settings, Extensions

**Files:**

- Start from: `packages/web/src/ExtensionsMockups.stories.tsx#Settings` and `#NeedsYou`
- Create: `packages/web/src/settings/ExtensionSettings.tsx` (the category's rows, banners, and each
  extension's settings form), `settings/ExtensionWhere.tsx` (on for every repository, or a picker of
  repositories)
- Modify: `settings/categories.ts` (`CategoryId` gains `extensions`), `settings/SettingsView.tsx`,
  `settings/SettingsPage.tsx`, `views.ts`, `data.ts`; delete the mockups story's `Settings` and
  `NeedsYou` exports once the real section draws them (the story file keeps the others for task 12)

**Interfaces:**

- Consumes: task 8's view and mutations; task 9's `useContributions("settingsSection")` (an
  extension's own section renders under its row).
- Produces: the Extensions category: "Your extensions" then "Built in", each row with its icon,
  title, description, version and source, its switch (on for every repository / off) and "Only in…"
  picker; under it, its settings form from `settings` (bool switch, integer and string fields, list
  as one value per line) for every repository or one; above, a banner per problem: errors with file
  and line, the API message with no Update button (an agent updates it), "reloads when the turn of …
  ends", and each key clash "`y` is taken by Deploy".

- [ ] **Step 1: Build the section from the story's components**

- [ ] **Step 2: Run the task's validation, and review it**

- Run: `vp check && vp test packages/web`
- Expected: PASS. In the sandbox, in both themes, at a phone's and a desktop's width: switching the
  inbox off removes it at once; a broken sample extension shows its banner.

- [ ] **Step 3: Commit**

```bash
git add packages/web
git commit -m "feat(extensions-system): list, turn on, and set up extensions in Settings"
```

## Task 11: Sessions know the extension API, may write extensions, and get their skills

**Files:**

- Modify: `packages/server/src/runner/instructions.ts` (a section on extensions), `runner/claude.ts`
  (`claudeArgs` adds `--add-dir <config>/extensions` and a `--plugin-dir` per extension with skills;
  `extensionPlugins` makes their folders), `runner/runtimes.ts` (`skills(root)`),
  `runner/processes.ts` (passes `runtimes.skills(live.repo)`), `extensions/builtins.ts` (the
  `claude` built-in gives the paths), `paths.ts` (`layout().docs`), and the host that knows the
  folders (task 8's `extensions/server.ts`: `skillsFor(repository): string[]`, R36)
- Test: `runner/__tests__/claude.test.ts`, `extensions/__tests__/api.test.ts` (the host's filter,
  through a session), `__tests__/paths.test.ts`

**Interfaces:**

- Consumes: task 4's `OpenOptions.skills`; task 8's loader list and `is_on`.
- Produces:
  - `WEB_UI_INSTRUCTIONS` gains a section "Extensions": Uraeda's server and web UI take extensions,
    TypeScript folders in `<extensions folder>`, documented in `<docs path>`; to change a part of
    Uraeda, a built-in included, write or edit an extension there, never Uraeda's source, then run
    `ura extension add <folder> --here` (or `--all`). The two paths are filled in when the server
    starts (`layout().docs`, task 14 ships it): `webUiInstructions({ folder, docs })`;
    `WEB_UI_INSTRUCTIONS` stays the text without that section, for scripts outside the server. No
    other text reaches runs from extensions.
  - `claudeArgs(options, pluginDir, imagesDir, extensions?: { folder, docs, plugins })`:
    `--add-dir <folder>`; for each folder in `options.skills` (`<folder>/<name>/skills`), a plugin
    folder `<plugins>/<name>/` (`<data>/extension-plugins/<name>/`) holding
    `.claude-plugin/plugin.json` (`{"name": "<name>"}`) and `skills` linked to the extension's
    `skills/`, made by `extensionPlugins(skills, plugins)` as the process opens, passed as one more
    `--plugin-dir`. Uraeda's own plugin stays first.
  - `skillsFor(repository)`: each extension of yours on there, built for this API, without a fatal
    problem, with a `skills/` folder; the built-ins ship none.

- [x] **Step 1: Write the failing tests**

```ts
// in packages/server/src/runner/__tests__/claude.test.ts
test("claudeArgs lets the agent write extensions, and passes their skills", () => {
  // options.skills = ["/c/extensions/docs-ext/skills"]: the args hold
  // "--add-dir", "/c/extensions", and "--plugin-dir" with a folder whose skills link resolves to
  // the extension's skills; WEB_UI_INSTRUCTIONS names the extensions folder and the docs path.
});
```

In `extensions/__tests__/api.test.ts`, a session in `uraeda` gets the skills of an extension on
there, and a session in `other`, where it is off, and of an extension off everywhere, gets none.

The break it catches: skills passed for an extension off in that repository (the host's filter,
asserted by giving none), or the agent unable to write the folder it was told to use. Made: the
`isOn` check dropped from `skillsFor`, the api test failed with both extensions' skills.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test packages/server/src/runner/__tests__/claude.test.ts`
- Expected: FAIL, `extensionPlugins is not a function`, and the session gets no skills.

- [x] **Step 3: Implement**

- [x] **Step 4: Run the task's validation**

- Run: `vp check && vp test packages/server`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(extensions-system): let sessions write extensions and use their skills"
```

## Task 12: The page runtime

**Files:**

- Create: `packages/web/src/extensions/runtime.ts` (fetches `/extensions/<name>/page` when an on
  extension's `pageVersion` changes, evaluates its modules with
  `new Function("__import", "__exports", code)`, calls the entry's default export with
  `pageApi(name, registry)`, injects its CSS in one `<style data-extension="<name>">` replaced on
  reload, and undoes the old version's registrations first), `extensions/shared.ts` (the modules
  pages may import: `react`, `react/jsx-runtime`, `react/compiler-runtime`, `react-dom`,
  `@stylexjs/stylex`, `@astryxdesign/core` and each `@astryxdesign/core/<path>` resolved to its
  index, `uraeda/page`), `extensions/hooks.ts` (exported from `uraeda/page`: `useRecord<T>(name)`,
  `useAction(name)`, `useExtensionSettings()`, `useRepository()`),
  `extensions/ExtensionBoundary.tsx` (an error boundary per contribution, keyed by the extension's
  version so a reload remounts it)
- Modify: `App.tsx` (mounts the runtime inside the repository's client), `pages.ts` (the runtime's
  chunk loads lazily, only when an extension page is on), `views.ts`, `data.ts`
  (`ExtensionRecordView`)
- Test: `src/__tests__/extension-pages.test.tsx`

**Interfaces:**

- Consumes: tasks 8, 9.
- Produces: `uraeda/page`'s runtime values (`definePage` is not needed: the entry exports
  `default (api: PageApi) => void`); the hooks above, `useRecord` reading `ExtensionRecord`
  `<name>/<record>` live, `useAction` calling `extensions.act`. A throwing entry registers nothing,
  is reported on the settings page through the `Extensions` view's problems (the page posts it with
  `extensions.reportPageProblem({ name, version, message })`, a mutation task 8's file gains here),
  and leaves every other contribution drawn.

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/src/__tests__/extension-pages.test.tsx
test("an extension page registers a place and reloads", async () => {
  // A config folder with extension "wiki" on in the repository (page.tsx registers place "Wiki"
  // with key "w" and draws useRecord("pages")); renderPage("/"): Space w opens /e/wiki/wiki and
  // shows the record's text. Rewriting page.tsx's heading: the place shows the new heading without
  // a page reload. A second extension whose page throws leaves "Wiki" and the Inbox drawn, and the
  // Extensions view lists its problem.
});
```

The break it catches: an old version's place left registered beside the new one; a throwing page
blanking the shell.

- [ ] **Step 2: Run it to check it fails**

- Run: `vp test packages/web/src/__tests__/extension-pages.test.tsx`
- Expected: FAIL, no "Wiki" in the leader menu.

- [ ] **Step 3: Implement the runtime, the shared modules, and the hooks**

- [ ] **Step 4: Run the task's validation, and review it**

- Run: `vp check && vp test packages/web && vp run web:build`
- Expected: PASS; the main chunk does not grow by the runtime (it is lazy). In the sandbox, the
  example extension of task 14 (a temporary copy until then) draws in both themes and both widths.

- [ ] **Step 5: Commit**

```bash
git add packages/web packages/server/src/fate
git commit -m "feat(extensions-system): load extension pages in the web UI, reloaded on save"
```

## Task 13: Runtimes in the web UI

**Files:**

- Modify: `packages/web/src/StartDialog.tsx` and `StartChat.tsx` (a runtime picker when several are
  on), `Composer.tsx` (a session whose runtime is off says so and sends nothing), `home/Setup.tsx`
  (the setup link names the default runtime, not Claude Code), `HarnessMark.tsx` (marks from each
  runtime's `icon`), `UsageWindow.tsx`, `home/Usage.tsx`, `sidebar/Allowance.tsx` (one window per
  reported `UsageWindow`, the active runtime's), `packages/server/src/fate/send-mutations.ts`
  (`input.runtime`)
- Test: `packages/server/src/runner/__tests__/runtimes.test.ts` (a row: `session.send` with
  `runtime: "pi-durable"` stores it)

**Interfaces:**

- Consumes: task 4's `AgentRecord.runtimes`, its refusals' texts; task 8's titles.
- Produces: the start picker (shown only with two runtimes or more), the composer's off text
  `<title> is off: turn it on to continue this session`, the start refusal shown as is.

- [ ] **Step 1: Add the row, run it to check it fails**

- Run: `vp test packages/server/src/runner/__tests__/runtimes.test.ts`
- Expected: FAIL, the session's `agent` is `claude`.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Run the task's validation, and review it**

- Run: `vp check && vp test packages/server packages/web`
- Expected: PASS. In the sandbox with two fake runtimes: the picker, the marks, the usage windows,
  and the composer's off text, in both themes and widths.

- [ ] **Step 4: Commit**

```bash
git add packages/web packages/server
git commit -m "feat(extensions-system): pick a runtime, and show each runtime's usage"
```

## Task 14: Documentation, the example extension, and the package

**Files:**

- Create: `docs/extensions.md` (the extension API's documentation: the folder, the manifest, the
  server API, the page API and `uraeda/page` hooks, shared modules, styling with StyleX and the
  theme, events, runtimes, skills, reload, `ura extension`, and what an extension can do as you),
  `examples/extensions/wiki/` (`extension.toml`, `server.ts` reading the repository's `docs/` as a
  record, `page.tsx` drawing it with Astryx, setting `folder`, `scope = "repository"`)
- Modify: `README.md` (one line and a link), `INSTALL.md` (Claude Code is the default runtime, now a
  built-in extension), `docs/web-ui.md`, `docs/cli.md` (task 5 wrote the commands; links),
  `packages/uraeda/scripts/build.ts` (copies `docs/extensions.md` to `docs/`, Astryx's token file to
  `dist/stylex/tokens.stylex.js`), `packages/server/src/paths.ts` (`Layout.docs`),
  `packages/uraeda/scripts/smoke.ts` (`contents` checks both files)
- Test: `packages/server/src/extensions/__tests__/example.test.ts` (the example loads through the
  loader with no problem and its record lists a temporary repository's `docs/` files)

**Interfaces:**

- Consumes: everything above.
- Produces: the docs path task 11's instructions name; the measured sizes.

- [ ] **Step 1: Write the example's test, run it to check it fails**

- Run: `vp test packages/server/src/extensions/__tests__/example.test.ts`
- Expected: FAIL, `examples/extensions/wiki/extension.toml` not found.

- [ ] **Step 2: Write the example, the documentation, and the package changes**

- [ ] **Step 3: Measure**

The web UI package's packed and unpacked size, and the release binding's, before (main) and after,
with `packages/uraeda/scripts/release.ts`'s printout: write them in `rulings.md` for the record's
release note (SC-004).

- [ ] **Step 4: Run the complete validation**

- Run: `vp run ready`
- Expected: PASS, the package's smoke test included.

- [ ] **Step 5: Commit**

```bash
git add docs examples README.md INSTALL.md packages specs/2026-11-08-extensions-system/rulings.md
git commit -m "docs(extensions-system): document the extension API, with a wiki example"
```
