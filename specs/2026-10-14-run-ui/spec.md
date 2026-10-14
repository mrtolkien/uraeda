---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Run the UI easily

> [!IMPORTANT]
>
> Spec to review, about 20 minutes.
>
> - One new decision, [distribution](../decisions/distribution.md): the npm package `uraeda` on the
>   user's Node 24, four platform packages for the binding, no install scripts, and releases
>   published by CI from `ura`'s tag, platform packages first.
> - Taking the port now comes before opening the session cache. Today a second start on a busy port
>   marks the running server's turns as stopped in the shared cache; this fixes it.
> - A new local route, `POST /open`, lets a second `npx uraeda` hand its repository to the running
>   server. It can add a repository, as the UI's menu already can, behind the same guard.
> - The browser opens by default, but not over SSH or on Linux without a display, where `xdg-open`
>   could start a text browser in the terminal.
> - Your note asks for a guide in the pull request: it covers the first publish of the five names,
>   trusted publishing on npmjs.com, and the first tag.
> - Risk tier `high`: the first public release channel, with names and versions that cannot be taken
>   back, and a new route. The plan does not wait for your review.

Anyone with Node 24 can run the web UI with `npx uraeda` in a repository: it starts the server, adds
the repository, and opens it in the browser, with no checkout, Rust, or build. A second `npx uraeda`
in another repository opens it in the server already running. Releases publish the package from CI,
on the tag that releases `ura`. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## User stories

### US1: Run the web UI with one command (P1)

In a repository, a user runs `npx uraeda`. npm installs the package and the binding for the
platform, the server starts on 127.0.0.1, adds the repository to the list, prints its address, and
opens the repository's page in the browser.

Why this priority: it is the proposal's one command.

Acceptance scenarios:

1. **Given** Node 24, no server running, and the git repository `/home/ana/todo`, **When** Ana runs
   `npx uraeda` in `/home/ana/todo`, **Then** stdout prints
   `Uraeda server on http://127.0.0.1:4310`, the list holds `todo`, and the browser opens
   `http://127.0.0.1:4310/r/todo/`.
2. **Given** the same, **When** Ana runs `npx uraeda --no-open --port 4400`, **Then** stdout prints
   `Uraeda server on http://127.0.0.1:4400`, and no browser opens.
3. **Given** the folder `/home/ana/notes`, not in git, and `todo` in the list, **When** Ana runs
   `npx uraeda` there, **Then** stderr prints
   `uraeda: /home/ana/notes is not in a git repository: add one from the web UI`, the server starts,
   and the browser opens `http://127.0.0.1:4310/`, where the most recent repository opens.
4. **Given** `/home/ana/todo/.env` holding `URAEDA_PORT=5000` and `URAEDA_ALLOWED_HOSTS=evil.test`,
   **When** Ana runs `npx uraeda` there, **Then** the server listens on 4310, and a request with
   `Host: evil.test:4310` is refused with 403.
5. **Given** the environment `URAEDA_PORT=5000`, **When** Ana runs `npx uraeda`, **Then** the server
   listens on 5000.
6. **Given** the installed package, **When** Ana runs `npx uraeda --version`, **Then** stdout prints
   the release's version, like `0.5.0`, and the command exits 0.
7. **Given** a Claude session started from the packaged UI, **When** it opens, **Then** `claude`
   receives `--plugin-dir` with the package's copy of the skill, and the session opens.

### US2: Open another repository while the server runs (P1)

With a server already running, `npx uraeda` in another repository adds it to that server and opens
its page, instead of starting a second server on the same data.

Why this priority: once several repositories are listed, it is the most common start, and a second
server would break the rule of one session per feature
([Q4](clarifications-01.md#q4-what-happens-when-the-port-is-already-taken)).

Acceptance scenarios:

1. **Given** a server running on 4310 with `todo` listed, **When** Ana runs `npx uraeda` in the git
   repository `/home/ana/notes`, **Then** the list holds `todo` and `notes`, the running server
   serves `/r/notes/`, stdout prints `Uraeda already runs at http://127.0.0.1:4310/r/notes/`, the
   browser opens that address, and the command exits 0.
2. **Given** the same, **When** Ana runs `npx uraeda --no-open` in `/home/ana/notes`, **Then**
   stdout prints the same line, no browser opens, and the command exits 0.
3. **Given** a server running on 4310, **When** Ana runs `npx uraeda --repo /home/ana/notes`, with
   `/home/ana/notes` not in git, **Then** stderr prints
   `uraeda: /home/ana/notes is not a git repository`, and the command exits 1.
4. **Given** a server running on 4310 with a turn in progress in `todo`, **When** Ana runs
   `npx uraeda` in `/home/ana/notes`, **Then** the turn is still in progress in the session cache.
5. **Given** another program listening on 127.0.0.1:4310, **When** Ana runs `npx uraeda`, **Then**
   stderr prints `uraeda: port 4310 is used by another program: pass --port to use another one`, and
   the command exits 1.

### US3: Publish a release to npm (P1)

The maintainer pushes the version tag that releases `ura`. CI builds the binding for the four
platforms, the server, and the UI, checks the package on Linux and macOS, then publishes the four
platform packages and `uraeda`, with provenance and no stored token.

Why this priority: without it, `npx uraeda` has nothing to install.

Acceptance scenarios:

1. **Given** the workspace at version 0.5.0, **When** the tag `v0.5.0` is pushed, **Then** npm holds
   `uraeda-binding-linux-x64-gnu`, `uraeda-binding-linux-arm64-gnu`, `uraeda-binding-darwin-x64`,
   `uraeda-binding-darwin-arm64`, and then `uraeda`, each at 0.5.0 with provenance, and `uraeda`
   lists the four at exactly 0.5.0 in `optionalDependencies`.
2. **Given** the tag `v0.5.0` and the build of `darwin-x64` failing, **When** the workflow runs,
   **Then** nothing is published.
3. **Given** the smoke test failing on macOS arm64, **When** the workflow runs, **Then** nothing is
   published.
4. **Given** a run that published three platform packages at 0.5.0 and stopped, **When** the
   maintainer runs the workflow again on `v0.5.0`, **Then** it skips the three, publishes the fourth
   and `uraeda`, and succeeds.
5. **Given** the tag `v0.6.0-rc.1`, **When** the workflow runs, **Then** the five packages are
   published under the dist-tag `next`, and `npx uraeda` still installs the latest stable version.
6. **Given** a pull request that changes the package or the workflow, **When** CI runs, **Then** the
   workflow builds and checks the package up to its smoke tests, and publishes nothing.

### US4: Find how to run it (P2)

The README's install section says how to run the web UI from npm, what it needs, and how to update
it. `npx uraeda --help` lists the options.

Why this priority: the command must be found to be used, but the package works without it.

Acceptance scenarios:

1. **Given** the README, **When** a reader opens "Install", **Then** it shows `npx uraeda`, Node 24
   or later, `claude` installed and signed in for sessions, and `npm i -g uraeda@latest` for a
   lasting install.
2. **Given** the package, **When** Ana runs `npx uraeda --help`, **Then** stdout lists `--port`,
   `--repo`, `--no-open`, `--version`, and `--help`, each with one line, and the command exits 0.
3. **Given** the package, **When** Ana runs `npx uraeda --colour`, **Then** stderr prints
   `uraeda: unknown option --colour; see uraeda --help`, and the command exits 1.

## Edge cases

- **Opening the browser fails**, as with no `xdg-open` installed: stderr prints
  `uraeda: could not open a browser: <reason>`; the server keeps running, its address already
  printed.
- **Over SSH**, `SSH_CONNECTION` or `SSH_TTY` set: no browser is opened, on Linux or macOS.
- **On Linux without a display**, neither `DISPLAY` nor `WAYLAND_DISPLAY` set: no browser is opened.
- **The port answers HTTP but is not Uraeda**, like a Vite server of another project: treated as
  another program (US2, scenario 5).
- **The running server is `vp dev` from a checkout**: it answers `POST /open` like the packaged
  server, so a second start hands off to it.
- **The running server is an older version**: the handoff works with any server that answers
  `POST /open`; the running server keeps its version. A server older than this feature answers 404,
  and is treated as another program.
- **The repository is already listed**: the handoff opens it; the list does not change.
- **A missing platform package**, as with `npm install --no-optional`: the loader's error is shown,
  prefixed with `uraeda: `, and the command exits 1.
- **Node older than 24**: npm warns with `EBADENGINE` before running, and the server runs on a
  version it is not tested on; Node without `node:sqlite`, older than 22.13, fails with Node's own
  error.
- **A checkout without the built UI**, `pnpm start` before `vp run --filter uraeda-web build`:
  stderr prints `uraeda: the web UI is not built; run vp run --filter uraeda-web build`, and the
  command exits 1.
- **A checkout's `.env`**: still read, from the checkout's root, by `pnpm start` and `vp dev`, as
  today.
- **Stopping the server** with Ctrl-C: unchanged; its sessions' turns are interrupted, then it
  exits.
- **Removing it**: `npm cache npx`, or `npm rm -g uraeda`; the data folder stays.

## Success criteria

- **SC-001**: The `uraeda` tarball is at most 3 MB, and each platform package at most 4 MB.
- **SC-002**: From an installed package, the server answers its first request within 2 seconds of
  the command starting, on Linux x64.
- **SC-003**: The Linux binaries need at most `GLIBC_2.17`, as `objdump -T` reports.
- **SC-004**: A release with any of the four binaries missing, or a smoke test failing, publishes
  nothing.
- **SC-005**: The npm package runs without any file from the checkout: the smoke test installs it in
  a temporary folder, outside the repository.

## Architecture

The server ships as the npm package `uraeda`, run on the user's Node, as the new
[distribution](../decisions/distribution.md) decision says
([Q1](clarifications-01.md#q1-how-does-uraeda-ship), [the spikes](discovery-01.md#the-spikes)).
Nothing about the server's behaviour changes, except three things at its start: where it finds its
files, whether it reads a `.env`, and what it does with a busy port.

The units:

- **The paths module**, in the server, is the one home of where the server finds its plugin, its web
  UI, and its checkout. It returns one of two layouts: the checkout's, from the server's sources,
  and the package's, from the bundle. Today these paths live in three places
  ([rules and their owners](discovery-01.md#rules-and-their-owners)).
- **The start**, the server's `main.ts`, takes the port first, then either starts the server or
  hands the repository to the one already on the port. It opens the browser once the address is
  known. Taking the port before the session cache fixes a second start marking the running server's
  turns as stopped.
- **The handoff route**, `POST /open`, in the server, adds a folder's repository to the list the way
  the start does, and answers with its page's address. The start's own adding of its repository and
  the route share one function.
- **The browser opener**, a small module in the server, spawns the platform's opener when a desktop
  session is likely, without a new dependency.
- **The package**, `packages/uraeda/`, builds `uraeda` from the server, the web UI, the skill, and
  the binding's loader, and holds its smoke test.
- **The release workflow**, its own file next to cargo-dist's, builds and publishes the five
  packages on `ura`'s tag.
- **The binding's version**, a new function of the binding, from the Cargo workspace: the one home
  of the version the command prints and the release checks.

The tradeoff accepted is Node 24 on the user's machine, for a 3 MB package on stable tooling and the
same runtime as the tests.

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- A project's `.env` is not read when the server runs from the package: settings come from flags and
  the environment. The checkout's `vp dev` and `pnpm start` keep reading Uraeda's own `.env`, from
  the checkout's root.
- Where the server finds its files moves to one module that knows both layouts; the package holds a
  copy of the skill; the binding's freshness check runs only in a checkout.
- Platforms are Linux glibc and macOS, x64 and arm64.
- Node 24 or later is required.
- No `postinstall` script.
- No update notice: npm 11.2 and later check the registry at each `npx uraeda`; the README names
  `npm i -g uraeda@latest`.
- Release order: platform packages first, `uraeda` last, behind the gate; a partial release is
  completed at the same version.
- The npm packages take the Cargo workspace's version and `ura`'s tag, in a workflow of their own.
- The command takes `--port`, `--repo`, and `--no-open`; the web UI's folder is no longer an option.
- The README moves the web UI into "Install".

Settled while writing this spec:

- Homebrew and Nix packages for the web UI are left for later, as your answer says
  ([Q7](clarifications-01.md#q7-which-channels-does-this-feature-cover)).
- The package's `bin` is the bundle itself, with a `#!/usr/bin/env node` line, so `bunx` and
  `pnpm dlx` run it with Node too ([npm and npx](discovery-01.md#npm-and-npx)).
- The loader napi-rs generates ships unchanged next to the bundle, as `dist/binding.js`, and finds
  the platform package through Node's usual lookup. No sixth package is published for it.
- The platform packages' folders, `packages/binding/npm/<platform>/`, are generated by
  `napi create-npm-dirs` and committed, as the [toolchain](../decisions/toolchain.md) decision
  requires of files napi-rs generates. Their committed version, and `uraeda`'s, is `0.0.0`: the
  release writes the tag's version, so the Cargo workspace stays the one home of the version.
- The root `package.json` is renamed `uraeda-workspace`, so the name `uraeda` belongs to the package
  alone in the pnpm workspace.
- `--version` and `--help` are added: a published command is expected to have them.
- Messages of the start use the prefix `uraeda: `, the command's name, instead of `uraeda-server: `.
- `--allow-origin` stays, undocumented in `--help`: it is meant for development servers.
- The browser is opened with `open` on macOS and `xdg-open` on Linux, spawned detached, its output
  ignored; the `open` npm package is not added, since it resolves before `xdg-open` fails
  ([browser launchers](discovery-01.md#browser-launchers)). The `BROWSER` variable is not read.
- Over SSH, or on Linux without a display, the browser is not opened: `xdg-open` there can start a
  text browser in the same terminal.
- A version with a prerelease suffix is published under the dist-tag `next`.
- The release builds the Linux binaries with `--use-napi-cross`, for the glibc 2.17 floor, and the
  macOS ones on a macOS runner, as napi-rs's template does
  ([napi-rs publishing](discovery-01.md#napi-rs-publishing)).
- The `.node` files are not signed or notarized: npm downloads carry no quarantine flag, which is
  how esbuild, Biome, and Rolldown ship native code. The macOS smoke test checks that it loads.
- The release workflow also runs on pull requests that change the package, the binding's npm
  folders, or the workflow, up to its smoke tests, so it is tested before a tag needs it.

## Decisions

New, applied when this spec is approved:

- [Distribution](../decisions/distribution.md): the web UI ships as the npm package `uraeda` on the
  user's Node 24, with the binding in four platform packages, no install scripts, one module for the
  server's paths, no `.env` in the package, and releases published by CI from `ura`'s tag, platform
  packages first, behind a gate.

Relied on:

- [Stack](../decisions/stack.md): the server stays TypeScript on Node, behind the same `Host` and
  `Origin` check, which also guards `POST /open`; `ura` keeps needing no runtime.
- [Toolchain](../decisions/toolchain.md): the four platforms; the package's build and smoke test are
  added to `vp run ready`; the generated npm folders are committed.
- [Repositories](../decisions/repositories.md): one server serves every listed repository; the
  handoff adds to the list through the core, as `ura add` does.
- [Agents](../decisions/agents.md): the plugin comes from the server's own copy of the skill, now
  inside the package; one session per feature, kept by the handoff.
- [Code quality](../decisions/code-quality.md): the binding's `lib.rs`, at 484 lines, stays under
  500 with its version function; `main.ts` stays a short start, its parts in their modules.

## Constitution check

| Principle                                  | Complies | Notes                                                                        |
| ------------------------------------------ | -------- | ---------------------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | Publishing runs only on a tag the human pushes; the first publish is theirs. |
| II. Git and plain text first               | yes      | No workflow state moves; the list stays `repositories.json`.                 |
| III. Asynchronous by default               | yes      | Unchanged: the package runs the same server.                                 |
| IV. Review effort matches impact           | yes      | The pull request carries the guide the human asked for.                      |
| V. Tools are optional                      | yes      | The web UI stays optional; the skill and `ura` are unchanged.                |
| VI. Code is checked and stays maintainable | yes      | Smoke and integration tests; the paths gain one home; no new marker.         |

## Risk tier

**High**: the first public release channel, whose names and versions can never be taken back, and a
new local route that adds repositories.

## Details

### Data

- **The layout**, returned by the paths module:

  ```ts
  type Layout = {
    /** `package` from the bundle, `checkout` from the server's sources. */
    kind: "checkout" | "package";
    /** The folder passed to `claude --plugin-dir`, holding `skills/uraeda/`. */
    plugin: string;
    /** The built web UI, served as static files. */
    web: string;
    /** The checkout's root, for its `.env` and the binding's freshness check; null in the package. */
    checkout: string | null;
  };
  ```

  In a checkout: `packages/server/plugin`, `packages/web/dist`, and the root. In the package, from
  the bundle at `<package>/dist/uraeda.mjs`: `<package>/plugin`, `<package>/web`, and null. The
  bundle's build sets the constant that selects the package's layout.

- **The handoff request**, `POST /open` with `Content-Type: application/json`:

  ```ts
  type OpenRequest = { folder: string; given: boolean };
  type OpenAnswer = { uraeda: string; url: string };
  ```

  `folder` is absolute; `given` is true when `--repo` or `URAEDA_REPO` named it. The answer's
  `uraeda` is the running server's version, which identifies it as Uraeda; `url` is the path to
  open, `/r/<name>/`, or `/` when the folder is not in git and was not given. A folder not in git
  that was given answers 400 with `{ "error": "<folder> is not a git repository" }`. The route takes
  the repository's main checkout and adds it to the list, then reloads the hosts before answering,
  so its page is served at once.

- **The package's contents**, `uraeda`:

  ```
  package.json      bin: { "uraeda": "dist/uraeda.mjs" }, engines: { "node": ">=24" }
  dist/uraeda.mjs   the server, bundled, with `#!/usr/bin/env node`
  dist/binding.js   the loader napi-rs generated, unchanged
  web/              the built web UI
  plugin/           .claude-plugin/plugin.json, and skills/uraeda/, a copy
  ```

  Each platform package holds `package.json`, with the `os`, `cpu`, and `libc` napi-rs writes, and
  its `uraeda-binding.<platform>.node`.

- **Versions**: `version()` from the binding returns the Cargo workspace's version. The release
  checks that the tag, without its `v`, equals it, and writes it into the five `package.json` files
  and `uraeda`'s `optionalDependencies` before publishing.

### Components

- **Paths** (`packages/server/src/paths.ts`, new): `layout()` returns the layout above.
  [`runner/claude.ts`](/packages/server/src/runner/claude.ts) loses `PLUGIN_DIR`, and
  [`binding.ts`](/packages/server/src/binding.ts) its `ROOT`; both take theirs from the layout.
  `checkBinding` runs only when `checkout` is set.
- **Settings** ([`env.ts`](/packages/server/src/env.ts)): `loadEnv` reads `<checkout>/.env` only
  when the layout has a checkout, then the environment, which wins, as today.
  [`dev.ts`](/packages/server/src/dev.ts) keeps passing the checkout's root.
- **Options** ([`options.ts`](/packages/server/src/options.ts)): `--port`, `--repo`, `--no-open`,
  `--version`, `--help`, and `--allow-origin`; `--web-root` goes, the layout gives the UI. An
  unknown option fails with `uraeda: unknown option --<name>; see uraeda --help`. `--help` prints:

  ```
  Usage: uraeda [options]

  Starts Uraeda's web UI for the repository of the current folder.

    --port <port>    the port on 127.0.0.1, 4310 by default (URAEDA_PORT)
    --repo <folder>  the repository to open, the current folder by default (URAEDA_REPO)
    --no-open        do not open the browser
    --version        print the version
    --help           print this help
  ```

- **The start** ([`main.ts`](/packages/server/src/main.ts)): parses the options, takes the port with
  a Node HTTP server, then:
  - when the port is free, starts the server as today, hands its requests to the app, prints
    `Uraeda server on http://127.0.0.1:<port>`, and opens `/r/<name>/`, or `/` without a repository;
  - when the port is busy, sends `POST /open` to it with a 2 second timeout. An answer with a
    `uraeda` field prints `Uraeda already runs at http://127.0.0.1:<port><url>`, opens that address,
    and exits 0. A 400 prints its `error` and exits 1. Anything else, a refused connection, another
    status, or a timeout, prints the "used by another program" message and exits 1.
- **The handoff route** ([`app.ts`](/packages/server/src/app.ts), and its handler in a new
  `open.ts`): `POST /open` as above, behind the guard. The function adding a folder's repository is
  shared with [`server.ts`](/packages/server/src/server.ts)'s start.
  [`dev.ts`](/packages/server/src/dev.ts)'s `SERVER_PATHS` adds `/open`, so `vp dev` answers it.
- **The browser opener** (`packages/server/src/browser.ts`, new):
  `openBrowser(url, { platform, env, spawn })` spawns `open <url>` on macOS and `xdg-open <url>` on
  Linux, detached, with its output ignored, and returns without waiting. It skips when
  `SSH_CONNECTION` or `SSH_TTY` is set, and on Linux when neither `DISPLAY` nor `WAYLAND_DISPLAY`
  is. A spawn error prints `uraeda: could not open a browser: <reason>`.
- **The binding** ([`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs)): a `version()`
  function returning the core's `CARGO_PKG_VERSION`; [`index.d.ts`](/packages/binding/index.d.ts)
  and [`index.js`](/packages/binding/index.js) regenerated.
  [`package.json`](/packages/binding/package.json) gains `napi.targets` for the four triples, and
  `npm/<platform>/` folders from `napi create-npm-dirs`.
- **The package** (`packages/uraeda/`, new, named `uraeda`): its `package.json`, a `vite.config.ts`
  whose `pack` block bundles [`main.ts`](/packages/server/src/main.ts) into `dist/uraeda.mjs`, with
  `uraeda-binding` resolved to `./binding.js` and kept external, and a `build` script that runs the
  pack, copies the loader, the built UI, and the plugin with a copy of the skill, following its
  symlink. The built files are ignored by git.
- **The smoke test** (`packages/uraeda/scripts/smoke.ts`, new): packs `uraeda`, installs it in a new
  temporary folder with npm, outside the repository, with a platform package given as a tarball, or,
  in `vp run ready`, the checkout's binding through `NAPI_RS_NATIVE_LIBRARY_PATH`. It then starts it
  in a new git repository with its own data folder and `--no-open`, and checks the scenarios marked
  "smoke" in [Testing](#testing). It prints each check, and exits 1 on the first failure.
- **The root** ([`package.json`](/package.json)): renamed `uraeda-workspace`; `start` runs
  `node packages/server/src/main.ts` after the builds; `ready` builds the package and runs its smoke
  test after the web UI's build.
- **The release workflow** (`.github/workflows/npm.yml`, new): on the tags `release.yml` takes, and
  on pull requests that change `packages/uraeda/`, `packages/binding/npm/`, or the workflow. Jobs:
  - build the binding in release mode for each target: Linux x64 and arm64 on `ubuntu-latest` with
    `--use-napi-cross`, macOS x64 and arm64 on `macos-latest`; check the Linux binaries with
    `objdump -T`;
  - build `uraeda` once, on Linux;
  - gate: the four `.node` files are present, the tag matches `version()`, the sizes meet SC-001;
  - smoke test on `ubuntu-latest` and `macos-latest`, with that platform's package;
  - on a tag only, with `id-token: write`: publish each platform package not yet on npm at that
    version, then `uraeda`, with `npm publish --provenance --access public`, and `--tag next` for a
    prerelease. A version already on npm is skipped, which completes a partial release.
- **The README** ([`README.md`](/README.md)): "Install" gains the web UI: `npx uraeda` in a
  repository, Node 24 or later, `claude` for sessions, `--no-open` and `--port`, and
  `npm i -g uraeda@latest`. "Building the tools" keeps the checkout's commands.
- **The pull request's guide**, in its description, for the human: create or sign in to the npm
  account; publish each of the five names once by hand, as a `0.0.0` placeholder, with the commands
  to run; on npmjs.com, add a trusted publisher to each, for `mrtolkien/uraeda` and `npm.yml`, or
  with `npm trust`; mark the placeholders deprecated; then push the next version tag, and check
  `npx uraeda@latest` on a clean machine. Each command checked against npm's documentation when the
  guide is written.

### Error handling

- **Port busy with another program**:
  `uraeda: port <port> is used by another program: pass --port to use another one`, exit 1.
- **A given folder not in git**, from the start or the handoff:
  `uraeda: <folder> is not a git repository`, exit 1.
- **Browser**: `uraeda: could not open a browser: <reason>`; the server keeps running.
- **The binding missing**: in the package, the loader's error, prefixed with `uraeda: `, exit 1. In
  a checkout, the messages of today, naming `vp run`.
- **The UI not built in a checkout**:
  `uraeda: the web UI is not built; run vp run --filter uraeda-web build`, exit 1.
- **Release**: any failed job before the publish job publishes nothing. A publish that fails part
  way fails the workflow, and running it again completes it.

### Testing

The server's tests run with Vitest, as today: the start through `main.ts` spawned as a child process
on a fixture repository and its own data folder, with `--no-open`; the route through the app with
the fake adapter. The package's smoke test runs the packed package as a user would, from
`vp run ready` on Linux x64 and from the release workflow on Linux x64 and macOS arm64.

| What                                                      | Test                                                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| US1.1, US1.3, SC-002, SC-005                              | Smoke: start in a new repository, then in a folder outside git                                                                |
| US1.2, US1.5                                              | `main.test.ts`: `--port`, `URAEDA_PORT`, `--no-open`                                                                          |
| US1.4                                                     | Smoke: a project `.env` is ignored, `evil.test` refused                                                                       |
| US1.6, US4.2, US4.3                                       | Smoke: `--version`, `--help`, an unknown option                                                                               |
| US1.7                                                     | `paths.test.ts`: the package layout's plugin holds `skills/uraeda/SKILL.md`; `claude.test.ts`: `--plugin-dir` from the layout |
| US2.1, US2.2, already listed                              | `main.test.ts`: a second start hands off to the first and exits 0                                                             |
| US2.3                                                     | `open.test.ts`: a given folder outside git answers 400                                                                        |
| US2.4                                                     | `main.test.ts`: a turn in progress stays in progress after a handoff                                                          |
| US2.5, an HTTP server that is not Uraeda, an older server | `main.test.ts`: a plain listener, and a server answering 404                                                                  |
| US3.1 to US3.6, SC-001, SC-003, SC-004                    | The release workflow's gate and its runs on pull requests; checked by review                                                  |
| US4.1                                                     | Review of the README                                                                                                          |
| Browser: opened, SSH, no display, spawn error             | `browser.test.ts`: one table, one row per platform and environment                                                            |
| `vp dev` answers `/open`                                  | `dev.test.ts`: `/open` is a server path                                                                                       |
| A missing platform package                                | Smoke: without the binding, the message and exit 1                                                                            |
| A checkout without the built UI                           | `main.test.ts`: with a layout whose web folder is missing                                                                     |
| A checkout's `.env` still read                            | `env.test.ts`: as today                                                                                                       |
| Layouts                                                   | `paths.test.ts`: one table, the checkout's and the package's                                                                  |
| `version()`                                               | `packages/binding/index.test.ts`: equals the workspace's version                                                              |
