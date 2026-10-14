# Discovery, round 01: Run the UI easily

## Summary

Local web tools that run agents reach users in one of three ways. The most common is a command-line
program that serves a web UI on 127.0.0.1 and opens the browser: opencode, T3 Code, Backlog.md, and
Vibe Kanban, each started with `npx` or installed from npm. Some also ship a desktop app, almost
always Electron: opencode Desktop, T3 Code, and Nimbalyst. A few ship a single executable built with
Bun: Claude Code, opencode, and Backlog.md. On npm, the native part comes in one package per
platform, listed in `optionalDependencies`, the pattern napi-rs generates. Tools differ on whether
users need Node installed, how big the download is, and how a busy port, the browser, and updates
are handled.

The proposal asks for the simplest way to package Uraeda today. It names a single binary as the best
case, a desktop app as a possibility, and `npx uraeda` as the fallback, and it asks for every
promising solution to be tested. Three were built and run on this machine (Linux x64, 2026-10-14):

| Package                            | What the user downloads          | Needs on the machine | Started and served the UI |
| ---------------------------------- | -------------------------------- | -------------------- | ------------------------- |
| npm package, run by `npx`          | 3.5 MB tarball, 8.3 MB installed | Node 24              | Yes                       |
| Node single executable, via tsdown | 159 MB, 51 MB gzip, 34 MB xz     | Nothing              | Yes                       |
| Bun single executable, `--compile` | 90 MB, 40 MB gzip                | Nothing              | Yes                       |

Today the UI only runs from a checkout: the server is TypeScript run straight from its sources, the
binding is built locally, and three paths assume the checkout's layout. The server bundles to one
485 kB JavaScript file with `vp pack`, and each option needs the same three paths changed.

## How other products do it

### opencode

- The npm package `opencode-ai` lists 12 platform packages in `optionalDependencies`, plus a
  `postinstall` script that picks the variant (AVX2, musl) and links the binary over a placeholder.
  When the optional package is missing, the script installs it itself. Read from the published
  tarball, `npm pack opencode-ai@1.19.0`.
- The binary is built with `Bun.build({ compile })`:
  [build.ts](https://github.com/sst/opencode/blob/dev/packages/cli/script/build.ts). Its release
  archives are 43 to 57 MB compressed: [releases](https://github.com/sst/opencode/releases/latest).
- `opencode web` serves the UI on 127.0.0.1, on a random free port by default, takes `--port` and
  `--hostname`, and opens the browser: [web](https://opencode.ai/docs/web/),
  [CLI](https://opencode.ai/docs/cli/). `OPENCODE_SERVER_PASSWORD` turns on a password.
- opencode Desktop is an Electron app (electron-vite, electron-builder, electron-updater), from its
  `packages/desktop/package.json`; downloads are DMG, NSIS, deb, and rpm:
  [download](https://opencode.ai/download).

### Backlog.md

- The npm package `backlog.md` has a JavaScript `bin` wrapper and one Bun-compiled binary per
  platform in `optionalDependencies`, with no `postinstall`
  ([package.json](https://raw.githubusercontent.com/MrLesk/Backlog.md/main/package.json)). It also
  ships through Homebrew and Nix, and `npx backlog.md` tries it:
  [README](https://github.com/MrLesk/Backlog.md).
- Its binaries are 67 to 96 MB uncompressed:
  [releases](https://github.com/MrLesk/Backlog.md/releases/latest).
- `backlog browser` serves on 127.0.0.1, port 6420 by default, opens the browser unless `--no-open`
  is passed, and prints a hint to open it by hand when that fails
  ([advanced config](https://github.com/MrLesk/Backlog.md/blob/main/ADVANCED-CONFIG.md)). Since July
  2026, a busy port offers the next free one, and takes it without asking when there is no terminal
  (task BACK-473 in its repository).

### Vibe Kanban

- `npx vibe-kanban` is an esbuild-bundled JavaScript launcher with no platform packages and no
  `postinstall`: on its first run it downloads a zip of the Rust binary, checks its SHA-256, and
  caches it in `~/.vibe-kanban/bin/<tag>/`. Each run checks for a newer version and prints "Run: npx
  vibe-kanban@latest" (`npx-cli/src/cli.ts` and `download.ts` in
  [its repository](https://github.com/BloopAI/vibe-kanban)).
- The server takes a free port from the system by default, writes it to a port file, and opens the
  browser, logging the URL to open by hand when that fails (`crates/server/src/main.rs`,
  `crates/utils/src/browser.rs`).
- The company behind it shut down on 2026-04-10; the project continues as community maintained:
  [shutdown](https://vibekanban.com/blog/shutdown).

### T3 Code

- The `t3` command, from an install script or `npx t3@latest`, starts a server and opens the web
  app; an Electron desktop app also exists: [README](https://github.com/pingdotgg/t3code).
- Its npm package requires Node `^22.16 || ^23.11 || >=24.10`, because of `node:sqlite`:
  [issue 810](https://github.com/pingdotgg/t3code/issues/810).

### Claude Code and Codex

- Claude Code's recommended install is a native binary, signed and notarized on macOS, which updates
  itself in the background. Its npm package installs the same binary, through 8 platform packages in
  `optionalDependencies` and a `postinstall` that links it over a placeholder, so "the installed
  claude binary does not itself invoke Node": [setup](https://code.claude.com/docs/en/setup). The
  local Linux x64 binary, version 2.1.299, is 254 MB and contains "Bun v1.4.3" (measured).
- Codex's npm package `@openai/codex` lists its platform builds as npm aliases to prerelease
  versions of the same package, like
  `"@openai/codex-linux-x64": "npm:@openai/codex@0.162.1-linux-x64"`, and its `bin` script throws
  "Missing optional dependency" with the command to reinstall. Read from
  `npm pack @openai/codex@0.162.1`.

### Desktop apps

- Electron is what comparable tools use for a desktop app: opencode Desktop, T3 Code, and Nimbalyst,
  which replaced Crystal in February 2026 ([Nimbalyst](https://github.com/Nimbalyst/nimbalyst),
  [Crystal](https://github.com/stravu/crystal)). Conductor is a macOS-only desktop app
  ([conductor.build](https://www.conductor.build/)), and Claude Code Desktop is a tab of the Claude
  desktop app ([desktop](https://code.claude.com/docs/en/desktop)). None of the tools checked uses
  Tauri.

### What they have in common

- One command starts a server on 127.0.0.1 and opens the browser, with a flag to skip opening it.
  The URL is always printed, and a failed browser launch is a warning.
- The native part is chosen per platform by npm, from `optionalDependencies`, without a compiler.
  Tools that ship a whole executable add a `postinstall`, or download it on the first run.
- A busy port either moves to the next free port (Vite, Storybook, Backlog.md, Jupyter) or fails
  with a clear message.
- Updates come from running `npx <tool>@latest`, or from an update notice. Native installs update
  themselves.
- Other channels come next to npm: Homebrew, Nix, install scripts, release archives.

## Standards and libraries

### npm and npx

- npx runs a local dependency or a global command of the same name first, so `npm i -g uraeda`
  shadows `npx uraeda`. Otherwise it installs into `~/.npm/_npx/<hash>/`:
  [npx](https://docs.npmjs.com/cli/v11/commands/npx),
  [libnpmexec](https://github.com/npm/cli/blob/latest/workspaces/libnpmexec/lib/index.js).
- Since npm 11.2.0, `npx <name>` checks the registry for a newer version instead of reusing the
  cached copy ([npm/cli#8100](https://github.com/npm/cli/pull/8100)). Node 24.21.0 ships npm 11.19.0
  (measured). `npx <name>@latest` stays the form tools document.
- npx asks "Need to install the following packages… Ok to proceed?" once per version; `--yes` skips
  it, and without a terminal it installs with a warning.
- `pnpm dlx` reuses its install for a day (`dlxCacheMaxAge`), and skips dependencies' build scripts
  unless allowed: [dlx](https://pnpm.io/cli/dlx), [build settings](https://pnpm.io/settings/build).
  A package that needs a `postinstall` can break under pnpm; `optionalDependencies` resolved at run
  time do not. `bunx` honours a `#!/usr/bin/env node` shebang, so Node runs it:
  [bunx](https://bun.com/docs/pm/bunx).
- npm/cli#4828: when `node_modules` exists, `npm install` can rewrite the lockfile with only the
  current platform's optional packages. It is closed, with regressions reported in npm 11.16 and
  11.17 in 2026 ([issue](https://github.com/npm/cli/issues/4828)). It hurts projects that depend on
  a package through a lockfile, not a fresh `npx` install.
- A version, once published, can never be used again; unpublishing is allowed within 72 hours only
  if no package depends on it: [unpublish policy](https://docs.npmjs.com/policies/unpublish). A
  platform package the root depends on is therefore permanent.
- Trusted publishing from GitHub Actions, through OIDC, needs npm 11.5.1, Node 22.14, and
  `id-token: write`, gives provenance automatically for public repositories, and is configured per
  package on npmjs.com once the package exists:
  [trusted publishers](https://docs.npmjs.com/trusted-publishers),
  [npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust). Every package name, the root and
  each platform package, needs a first publish with a token or by hand.
- On 2026-10-14, `uraeda`, `uraeda-binding`, `uraeda-binding-linux-x64-gnu`, and `@uraeda/cli` were
  all unpublished (`npm view` returned 404), and the `@uraeda` organization page answered 403
  (measured).

### napi-rs publishing

- napi-rs's model: a root package lists exact versions of its platform packages in
  `optionalDependencies`, and the generated loader picks one at run time. `napi create-npm-dirs`
  writes the platform packages, `napi artifacts` moves each built `.node` into its folder, and
  `napi prepublish -t npm` sets their versions and publishes them, before `npm publish` publishes
  the root: [release](https://napi.rs/docs/deep-dive/release),
  [pre-publish](https://napi.rs/docs/cli/pre-publish),
  [config](https://napi.rs/docs/cli/napi-config).
- A missing binary is only a warning in `napi prepublish`, and the publish is not atomic. The docs
  recommend a CI gate checking every binary before the root is published, and, after a partial
  release, running `napi prepublish` again with the same artifacts rather than a new version.
- The package template builds Linux x64 and arm64 on `ubuntu-latest` with `--use-napi-cross` (glibc
  2.17 floor), and both macOS targets on `macos-latest`
  ([CI.yml](https://raw.githubusercontent.com/napi-rs/package-template/main/.github/workflows/CI.yml),
  [cross build](https://napi.rs/docs/cross-build)).
- A missing platform package makes the loader throw "Cannot find native binding", naming
  npm/cli#4828
  ([js-binding.ts](https://github.com/napi-rs/napi-rs/blob/main/cli/src/api/templates/js-binding.ts)).
  The repository's own loader already looks for `uraeda-binding-<platform>` packages:
  [`index.js`](/packages/binding/index.js).

### Node single executable applications

- Stability 1.1, "Active development", in Node 24 and 26:
  [Node 26](https://nodejs.org/api/single-executable-applications.html),
  [Node 24](https://nodejs.org/docs/latest-v24.x/api/single-executable-applications.html).
- Node 24 only runs a CommonJS main script, injected with `postject`. Node 25.5 added
  `node --build-sea`, and the 25.8 docs an ESM main script (`"mainFormat": "module"`)
  ([v25.8.0 docs](https://nodejs.org/download/release/v25.8.0/docs/api/single-executable-applications.html)).
  The server's [`main.ts`](/packages/server/src/main.ts) uses top-level `await`, so it needs ESM.
- Assets are listed one file at a time and read with `sea.getAsset`; Node 26.9 adds `useVfs`, which
  mounts them as read-only files, marked "1.0 Early development". A native addon cannot load from
  assets or the VFS: the documented way is to write it to a temporary file and `process.dlopen` it.
- macOS x64 "is not currently supported and is skipped in the tests" of Node's CI. A SEA built
  inside a Linux arm64 Docker container crashes on `process.dlopen()`.
- Node 26 becomes Active LTS on 2026-10-28; Node 24 moves to maintenance on 2026-10-20, until
  2028-04-30: [release schedule](https://github.com/nodejs/Release).
- `vp pack --exe` builds a SEA through tsdown's `exe` option, experimental, and requires Node 25.7:
  [`pack.md`](/node_modules/vite-plus/docs/guide/pack.md) in Vite+'s local docs,
  [tsdown exe](https://tsdown.dev/options/exe). It cross-builds by downloading each target's Node,
  and signs macOS executables ad hoc only when built on macOS.

### Bun executables

- `bun build --compile` embeds files and folders, and `.node` addons required directly, and
  cross-compiles to Linux and macOS, x64 and arm64, from any host:
  [executables](https://bun.com/docs/bundler/executables). Signing on macOS needs `codesign` with
  JIT entitlements. Bun's own page admits "Bun's binary is still way too big."
- Bun's docs disagree on `node:sqlite`: "Fully implemented"
  ([compatibility](https://bun.com/docs/runtime/nodejs-compat)) against "Not implemented"
  ([reference](https://bun.com/reference/node/sqlite)). On Bun 1.4.2 here, `DatabaseSync` created,
  wrote, and read a table, and the server created its `runner.sqlite` (measured).
- `node:sea` is not implemented, and `node:child_process` is partial, for IPC handles only. A
  detached child with a piped stdin, written twice, then signalled through its process group,
  behaved the same in Bun and Node (measured), which is what the
  [Claude adapter](/packages/server/src/runner/claude.ts) does.

### Deno executables

- `deno compile` embeds folders with `--include`, supports `node:sqlite` since 2.2, and loads native
  addons with `--self-extracting`, which unpacks once next to the executable or in the user's data
  folder: [compile](https://docs.deno.com/runtime/reference/cli/compile/),
  [node:sqlite](https://docs.deno.com/api/node/sqlite/), [Deno 2.3](https://deno.com/blog/v2.3). Not
  built here: Deno is not installed on this machine.

### Desktop wrappers

- Tauri v2 runs Node as a sidecar compiled into one executable with `@yao-pkg/pkg`, declared in
  `bundle.externalBin`, and spawned through the shell plugin:
  [Node.js sidecar](https://v2.tauri.app/learn/sidecar-nodejs/),
  [sidecar](https://v2.tauri.app/develop/sidecar/). The sidecar carries the same addon problem as a
  SEA. Its window can load `http://127.0.0.1:<port>`, with a warning about the risks
  ([localhost plugin](https://v2.tauri.app/plugin/localhost/)). On Linux it relies on WebKitGTK,
  whose versions differ by distribution
  ([webview versions](https://v2.tauri.app/reference/webview-versions/)), and its updater covers
  AppImage only ([updater](https://v2.tauri.app/plugin/updater/)).
- Electron 44 ships Node 24.18.1; `node:sqlite` was fixed in Electron 37
  ([schedule](https://releases.electronjs.org/schedule),
  [PR 47756](https://github.com/electron/electron/pull/47756)). The server could run in its main
  process, and a Node-API addon is ABI-stable across versions
  ([Node-API](https://nodejs.org/api/n-api.html)). electron-builder updates macOS, AppImage, deb,
  and rpm, and requires a signed macOS app for it
  ([auto update](https://www.electron.build/docs/features/auto-update)). A minimal app is about 80
  to 150 MB, from third-party comparisons seen only in search results.
- Notarizing on macOS needs the Apple Developer Program, $99 a year; an app signed ad hoc must be
  approved by the user in Privacy & Security:
  [macOS signing](https://v2.tauri.app/distribute/sign/macos/).
- Electrobun, Neutralinojs, and Wails have no Node runtime of their own, so the server would still
  be a sidecar ([Electrobun](https://framework.blackboard.sh/electrobun/),
  [Neutralinojs](https://neutralino.js.org/docs/), [Wails](https://github.com/wailsapp/wails)).

### Containers

- Claude Code in a container signs in inside it, keeps its login in a volume with
  `CLAUDE_CONFIG_DIR`, and the docs warn against mounting host secrets like `~/.ssh`:
  [devcontainer](https://code.claude.com/docs/en/devcontainer). On macOS the host's login lives in
  the Keychain, so it does not carry over:
  [authentication](https://code.claude.com/docs/en/authentication). The repositories, the git
  identity, and SSH keys would each need a mount.

### Shipping through the Rust CLI

- cargo-dist's npm installer publishes a package that downloads the Rust binary in a `postinstall`.
  It ships the binary only, not Node or a JavaScript server:
  [npm installer](https://axodotdev.github.io/cargo-dist/book/installers/npm.html).
- A `ura ui` command could also download a pinned Node (31.9 MB for 24.21.0 on Linux x64) and a
  server archive into a cache, checked against `SHASUMS256.txt`, like Volta or fnm:
  [Node dist index](https://nodejs.org/dist/index.json).

### Browser launchers

- The `open` package bundles its own `xdg-open` and, on Linux, resolves once the launcher is
  spawned, without checking its exit code, so a headless failure goes unnoticed:
  [open](https://github.com/sindresorhus/open). `xdg-open` is "for use inside a desktop session
  only", may run for a long time, and exits 3 or 4 on failure:
  [xdg-open(1)](https://man.archlinux.org/man/xdg-open.1).
- Vite and Jupyter honour the `BROWSER` variable:
  [Vite server options](https://vite.dev/config/server-options),
  [Jupyter config](https://jupyter-server.readthedocs.io/en/latest/other/full-config.html).

### Ports and running instances

- Vite moves to the next free port unless `strictPort` is set
  ([server options](https://vite.dev/config/server-options)). Storybook asks, and takes the next one
  without asking in `--ci`; `--exact-port` fails instead
  ([CLI options](https://storybook.js.org/docs/api/cli-options)). Jupyter tries up to 50 other
  ports.
- Jupyter writes one `jpserver-<pid>.json` per running server and lists them with
  `jupyter server list`, after checking each process is alive
  ([serverapp.py](https://github.com/jupyter-server/jupyter_server/blob/main/jupyter_server/serverapp.py)).
  Vibe Kanban writes a port file.

## The code

### Important reads

- [`package.json`](/package.json): `start` builds the binding and the UI, then runs
  `node packages/server/src/main.ts --web-root packages/web/dist`. Every package is `private`. The
  root pins Node `^24.0.0` in `devEngines`.
- [`main.ts`](/packages/server/src/main.ts): reads `.env` from `process.cwd()`, loads the binding,
  starts the server on 127.0.0.1 and the port, prints its URL, and on `EADDRINUSE` exits 1 with
  "port 4310 is in use: another Uraeda server may run at http://127.0.0.1:4310/". It never opens a
  browser.
- [`options.ts`](/packages/server/src/options.ts): `--port`, `--repo`, `--web-root`, and
  `--allow-origin`. Without `--web-root`, the server serves no UI.
- [`env.ts`](/packages/server/src/env.ts): `URAEDA_ALLOWED_HOSTS`, `URAEDA_PORT`, `URAEDA_REPO`, and
  `URAEDA_DATA_DIR`, from the environment, then from `<root>/.env`. In a checkout, the root is
  Uraeda's; started by `npx` in a project, it is the project's.
- [`guard.ts`](/packages/server/src/guard.ts): accepts the `Host` of each allowed host name, with or
  without the port. A host name listed in a project's `.env` would be accepted as the server's own.
- [`binding.ts`](/packages/server/src/binding.ts): refuses a binding older than the Rust sources,
  found three folders above the module (`new URL("../../..", import.meta.url)`). Outside a checkout
  it finds no sources and takes any binding; in a bundle, the same relative path points elsewhere.
  Its message names `vp run`, which a user of the package does not have.
- [`runner/claude.ts`](/packages/server/src/runner/claude.ts): `PLUGIN_DIR` is
  `new URL("../../plugin", import.meta.url)`, the folder passed to `claude --plugin-dir`. Its skill
  is a symlink, [`plugin/skills/uraeda`](/packages/server/plugin/skills/uraeda), to `skills/uraeda`.
  A published package must hold a copy, since `npm pack` leaves a symlinked folder out (measured),
  and a single executable must write it to disk, since `claude` reads it as files.
- [`app.ts`](/packages/server/src/app.ts): serves the built UI with `serveStatic` from `webRoot`, a
  folder on disk.
- [`packages/binding/package.json`](/packages/binding/package.json): `napi.binaryName` only, no
  `targets`; `napi build --platform` writes the `.node` next to the loader. A debug build is 157 MB,
  a release build 5.9 MB (measured).
- [`dist-workspace.toml`](/dist-workspace.toml) and [`release.yml`](/.github/workflows/release.yml):
  cargo-dist builds `ura` for the four targets on a version tag, publishes a GitHub release, a shell
  installer, and a Homebrew formula to `mrtolkien/homebrew-tap`. Nothing builds the binding or the
  UI for a release.
- [`ci.yml`](/.github/workflows/ci.yml): runs `vp run ready` on Linux x64, then `dist plan`.
- [`Cargo.toml`](/Cargo.toml): every crate is version 0.4.0. The binding embeds the same core as
  `ura`, and both read and write `repositories.json`, whose top-level `"version"` the
  [repositories](../decisions/repositories.md) decision requires.
- [`README.md`](/README.md): installs `ura` from a release, Homebrew, or Nix, and the web UI only
  from a checkout, under "Building the tools".
- [`upgrade.rs`](/crates/cli/src/upgrade.rs): `ura upgrade` reinstalls through the installer script
  or Homebrew, then updates the skill.

### The proposal's path and existing actions

- **A user runs one command in a repository.** Today: clone, install Rust, Node 24, and pnpm, then
  `pnpm start`. With a package, the command fetches the server, the UI, the skill, and the binding
  for the platform, and starts in the current folder.
- **The server picks its first repository.** [`server.ts`](/packages/server/src/server.ts) adds the
  main checkout of the current folder to the list, or logs that it is not in git and opens the
  list's most recent repository. Unchanged by packaging.
- **The UI opens.** Today the user opens the printed URL. Packaged tools open the browser.
- **A server already runs.** Today: exit 1 with the message above. Two servers on two ports would
  share the data folder, `runner.sqlite`, and the repositories, while the
  [agents](../decisions/agents.md) decision allows at most one session per feature and one process
  per session, which only one server can enforce.
- **Sessions start.** They need `claude` on `PATH`, signed in. Unchanged.
- **The user stops the server** with Ctrl-C: sessions are interrupted, then the server exits.
  Unchanged.
- **A new version comes out.** Today: `git pull` and rebuild. With npx, the next `npx uraeda` checks
  the registry. A global install stays on its version.
- **`ura` and the server meet** in `repositories.json` and the data folder. Different versions of
  each, installed separately, read and write the same files.
- **Removal.** `npx` leaves a copy in `~/.npm/_npx/`, cleared with `npm cache npx`; the data folder
  stays, as it does today.

### Rules and their owners

- **Where the server finds its files**: the plugin folder in
  [`runner/claude.ts`](/packages/server/src/runner/claude.ts), the binding's sources in
  [`binding.ts`](/packages/server/src/binding.ts), and the UI in the `start` script of
  [`package.json`](/package.json) and in [`dev.ts`](/packages/server/scripts/dev.ts). Three owners,
  each relative to the checkout.
- **The binding's package names**: generated in [`index.js`](/packages/binding/index.js) from
  `napi.binaryName`, the only owner.
- **The release targets**: [`dist-workspace.toml`](/dist-workspace.toml) for `ura`, and the
  [toolchain](../decisions/toolchain.md) decision (Linux and macOS, x64 and arm64; Windows not
  supported). A binding release would be a second list of the same targets.
- **The version**: `workspace.package.version` in [`Cargo.toml`](/Cargo.toml). The npm packages
  would carry a second copy.

### Likely changes

- [`packages/server/src/runner/claude.ts`](/packages/server/src/runner/claude.ts),
  [`binding.ts`](/packages/server/src/binding.ts), [`main.ts`](/packages/server/src/main.ts),
  [`options.ts`](/packages/server/src/options.ts), [`env.ts`](/packages/server/src/env.ts): the
  plugin, UI, and sources found from one place that knows the package's layout; under every option.
- A new package, for example `packages/uraeda/`, with its `bin` script, a `vp pack` configuration
  that bundles the server into one file, and a build that copies the UI and the skill: with the npm
  package, or as the input of an executable.
- [`packages/binding/package.json`](/packages/binding/package.json): `napi.targets` and the platform
  packages, with the npm package. Not needed with a single executable, which embeds the `.node`.
- [`.github/workflows/release.yml`](/.github/workflows/release.yml) or a new workflow: build the
  binding for four targets, then publish the npm packages, or build four executables, on the same
  tag as `ura`. cargo-dist generates `release.yml`, so a separate workflow survives `dist generate`.
- [`main.ts`](/packages/server/src/main.ts): opening the browser and the busy port, depending on the
  answers.
- [`README.md`](/README.md): the install section.
- [`flake.nix`](/flake.nix) and the Homebrew tap, only if those channels are added.
- [`specs/decisions/`](/specs/decisions/): a new decision on how Uraeda ships. A change to the
  [stack](../decisions/stack.md) decision with Bun, or with `ura` starting the server; a change to
  the [toolchain](../decisions/toolchain.md) decision with Node 26.

### The spikes

Each was built from this branch, with a release build of the binding
(`napi build --platform --release`, 5.9 MB), and run in a fresh git repository with its own
`URAEDA_DATA_DIR`. Each started, added the repository to `repositories.json`, created
`runner.sqlite`, and served `/` and `/r/repo/` with status 200. None started a Claude session, and
none ran on macOS or arm64.

- **Bundle.** `vp pack` on [`main.ts`](/packages/server/src/main.ts) from a folder whose
  `package.json` lists no dependencies, with `deps.neverBundle: ["uraeda-binding"]`, gives one 485
  kB file importing only `node:` modules and `uraeda-binding`. From the server's own folder,
  `vp pack` keeps hono and fate external: 147 kB.
- **npm package.** The bundle at `server/dist/main.mjs`, the UI at `web/`, the plugin with a copy of
  the skill at `plugin/`, and the binding as a bundled dependency. Its `bin` adds `--web-root` and
  imports the bundle. `npm pack` gives a 3.5 MB tarball; `npx --yes --package <tarball> uraeda` in
  the repository installed 8.3 MB in the npx cache and served the UI in under a second.
- **Node single executable.** With Node 26.11.1, `vp pack` with `exe` and every file of the UI and
  the plugin listed as `seaConfig.assets`, and `uraeda-binding` aliased to a module that writes the
  `.node` asset to a cache folder and loads it with `process.dlopen`. The entry writes the UI and
  the plugin to `~/.cache/<name>/<version>/` on its first run (7.8 MB), then imports the server. The
  `PLUGIN_DIR` line had to be replaced, since `import.meta.url` no longer names a folder on disk.
  Result: a 159 MB executable, of which Node is 150 MB.
- **Bun single executable.** `bun build --compile` on Bun 1.4.2, the bundle with `PLUGIN_DIR` from
  the environment, the `.node` required directly, and the UI and plugin as an embedded tar extracted
  on the first run. Result: 90 MB. Bun also ran the npm package's bundle as is.

## The proposal

### Which channel is "the simplest"

The proposal ranks a single binary first, then a desktop app, then `npx`, and asks for "one command
anyone can run". Every comparable tool ships through npm first, and a single binary through npm too.
A single binary drops the Node requirement, at 25 to 45 times the download of the npm package, with
experimental tooling on Node and a runtime change on Bun. Which matters more, no Node or a small,
stable package, is the human's tradeoff.

### "Today"

The proposal asks for what is best today. Node 26 becomes LTS two weeks from now, on 2026-10-28, and
the Node single executable's file system, which would avoid extracting the UI and the skill, is
still in early development. What is easiest in a month differs from what is easiest today.

### A desktop app

The proposal asks whether Tauri or Electron fits. Both still need the server as a Node program
beside the window, Tauri through the same single executable as above, Electron by shipping Node.
Both need signing and notarization on macOS, $99 a year, for downloads to open without a warning,
and their own updater. A desktop app also loses what the browser gives today: the phone, through
`tailscale serve`.

### `ura` and the server

The proposal's notes say `ura ui` starting the npm package would change the
[stack](../decisions/stack.md) decision: "The CLI MUST … NOT need Node or any other runtime to run."
The proposal does not say whether `ura` should start the UI at all, or whether users install two
things.

### Package names on npm

The notes say `uraeda` was free on npm. Platform packages need names too, and each name is permanent
once published, and needs its own first publish before trusted publishing can be set up.

### Who publishes

The proposal does not say who publishes: CI on a tag, as `ura` today, or the human from their
machine. Either way, the first publish of each package name is done with the human's npm account.

### Opening the browser, a busy port, and new versions

Listed under "To settle" in the proposal's notes.

### A project's `.env`

Started by `npx` in a project, the server reads that project's `.env` for `URAEDA_*` settings, a
behaviour built for Uraeda's own checkout. A cloned repository could then set `URAEDA_ALLOWED_HOSTS`
and widen the host names the server accepts, which the [stack](../decisions/stack.md) decision's
`Host` check exists to prevent.

### Other channels

The proposal names `npx uraeda` "or similar". `ura` ships through an install script, Homebrew, and
Nix; Backlog.md ships through npm, Homebrew, and Nix. Whether the web UI goes beyond npm now is a
scope question.

## Approaches

Criteria come from the [proposal](proposal.md) (one command anyone can run, the simplest package
today, a single binary as the best case), the [constitution](../CONSTITUTION.md) (principle VI:
explicit and simple code, one home per rule), and the active decisions:
[stack](../decisions/stack.md) (the server runs on Node; the CLI needs no runtime; 127.0.0.1 and the
`Host` check), [toolchain](../decisions/toolchain.md) (Linux and macOS, x64 and arm64; Node pinned
in `devEngines`), [agents](../decisions/agents.md) (one session per feature, the plugin from the
server's copy of the skill), and [repositories](../decisions/repositories.md) (one server serves
every repository).

### How the server ships

What the user downloads and runs. See [the spikes](#the-spikes) and
[how other products do it](#how-other-products-do-it).

| Option                                    | Needs on the machine | Download per platform         | Maturity                                              | Decisions                         | Effort                                                      |
| ----------------------------------------- | -------------------- | ----------------------------- | ----------------------------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| A. npm package on the user's Node         | Node 24              | about 3.5 MB                  | Stable; the napi-rs pattern of Biome, Rolldown, Codex | New one on shipping               | Small: bundle, platform packages, publish job               |
| B. Node single executable (SEA)           | Nothing              | 159 MB, 51 MB gzip            | Experimental in Node and tsdown; macOS x64 untested   | Toolchain moves to Node 26        | Medium: assets, addon extraction, signing, four builds      |
| C. Bun single executable                  | Nothing              | 90 MB, 40 MB gzip             | Proven by Claude Code, opencode, Backlog.md           | Stack: the server runs on Bun     | Medium, and tests run on Node while users run Bun           |
| D. Deno single executable                 | Nothing              | 58 to 70 MB, from search only | Addons through self-extraction; little evidence       | Stack: a third runtime            | Medium, not built here                                      |
| E. Electron desktop app                   | Nothing              | 80 to 150 MB                  | Stable, used by opencode, T3 Code, Nimbalyst          | Stack and a new one on the window | Large: app, signing ($99/year), updater; loses the phone    |
| F. Tauri desktop app with a Node sidecar  | WebKitGTK on Linux   | B's size plus the app         | Sidecar has B's problems; Linux webview issues        | Same as E                         | Large                                                       |
| G. Container image                        | Docker               | Node plus the server          | Stable                                                | New one                           | Medium, and `claude`'s login, SSH, and repositories mounted |
| H. `ura ui` downloads Node and the server | Nothing              | 32 MB Node plus the server    | Hand-made, like Volta                                 | Stack: the CLI starts Node        | Medium: download, checksums, cache                          |

B and C can also be published through npm, as Claude Code does, so `npx uraeda` stays the command
whichever is chosen.

### How `ura` relates to the server

Whether the CLI starts the UI, and how versions stay aligned.

| Option                                               | Commands to learn         | Stack decision                     | Versions                    |
| ---------------------------------------------------- | ------------------------- | ---------------------------------- | --------------------------- |
| A. Separate: `ura` from its installers, `npx uraeda` | Two                       | Unchanged                          | Each updates on its own     |
| B. `ura ui` runs `npx uraeda@<ura's version>`        | One                       | The CLI needs Node for one command | Aligned by `ura`            |
| C. The npm package also installs `ura`               | One install, two commands | Unchanged                          | Aligned within npm installs |

### The package names

| Option                                                                   | Names to own  | Trusted publishing setups | Readability                    |
| ------------------------------------------------------------------------ | ------------- | ------------------------- | ------------------------------ |
| A. `uraeda`, and `uraeda-binding-<platform>` as the loader expects today | 5             | 5                         | Plain, unscoped                |
| B. `uraeda`, and `@uraeda/binding-<platform>` in an npm organization     | 5, and an org | 5                         | Grouped under the organization |
| C. `uraeda` only, platform builds as prerelease versions, like Codex     | 1             | 1                         | Unusual versions in the list   |

### A busy port

What the command does when its port is taken. See [ports](#ports-and-running-instances).

| Option                                                                        | Two servers on one data folder | Bookmarks and `tailscale serve` | Effort                     |
| ----------------------------------------------------------------------------- | ------------------------------ | ------------------------------- | -------------------------- |
| A. Reuse a running Uraeda: add this repository to its list, open it, and exit | Never                          | Keep working                    | Small: a check of the port |
| B. Fail, as today, naming `--port`                                            | Possible with `--port`         | Keep working                    | None                       |
| C. Move to the next free port, like Vite                                      | Yes, by default                | Break                           | Small                      |

### Opening the browser

| Option                                                    | First run      | Headless or SSH            |
| --------------------------------------------------------- | -------------- | -------------------------- |
| A. Open by default, `--no-open` to skip, URL always shown | The UI appears | A warning, the URL to open |
| B. Never open, print the URL                              | One more click | Nothing to fail            |

### Publishing

| Option                                                                   | Secrets              | Provenance | Human's work per release    |
| ------------------------------------------------------------------------ | -------------------- | ---------- | --------------------------- |
| A. CI on the version tag, with trusted publishing, after a first publish | None after the first | Yes        | Push the tag                |
| B. CI on the version tag, with an `NPM_TOKEN` secret                     | A long-lived token   | Yes        | Push the tag                |
| C. By hand, from the human's machine                                     | The human's login    | No         | Build four targets, publish |

### Channels

| Option                                       | Users reached             | Effort                              |
| -------------------------------------------- | ------------------------- | ----------------------------------- |
| A. npm only: `npx uraeda`, `npm i -g uraeda` | Anyone with Node          | The package                         |
| B. Also a Homebrew formula                   | macOS users with Homebrew | A formula depending on `node`       |
| C. Also a Nix package                        | Nix users                 | A flake output with the UI and Node |

### Needs no choice

- **Platforms**: Linux glibc and macOS, x64 and arm64, as the toolchain decision lists. No musl and
  no Windows, which the decision does not support.
- **Node version**: Node 24 or later, the version the repository pins and tests; `node:sqlite` needs
  it.
- **pnpm and Bun users**: `optionalDependencies` without a `postinstall` work under `pnpm dlx` and
  `bunx`, which run the `bin` with Node.
- **Where the server finds its files**: one module that knows the package's layout, under every
  option.
- **A project's `.env`**: read only in Uraeda's checkout. See [a project's `.env`](#a-projects-env).
- **New versions**: npm 11.2 and later check the registry on each `npx uraeda`, so no notice is
  needed; a global install updates with `npm i -g uraeda@latest`.
- **Release order**: platform packages first, the root last, behind a check that all four binaries
  are present, as napi-rs and esbuild do.
- **Versions**: the npm packages take the workspace's version and the same tag as `ura`.
- **Removal**: nothing to remove beyond the npx cache and the data folder, which stays as today.
- **Accessibility, locales, and time**: the command prints English messages, as the server does
  today; the UI is unchanged.

## Not checked

- macOS and Linux arm64: no spike ran there. Signing, Gatekeeper on a downloaded executable, and
  addon loading on those platforms are from documentation only.
- A Claude session under the Bun executable or the Node SEA: only Bun's process-group behaviour was
  checked, not a real `claude` run.
- Deno: not installed here, and no sizes measured; its sizes come from search results only.
- Apple's notarization documentation page did not render.
- The exact `os`, `cpu`, and `libc` fields `napi create-npm-dirs` writes.
- Electron and Tauri sizes come from third-party comparisons seen in search results.
- Whether an official Claude Code page explains its move from npm to the native installer.
