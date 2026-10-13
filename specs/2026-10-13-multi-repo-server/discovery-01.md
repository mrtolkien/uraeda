# Discovery, round 01: Multi-repo server

## Summary

Tools with a local web UI over several repositories share a few parts: a current-repository selector
with recent repositories first, several ways to add one (a local folder, a clone, a new repository),
a way to remove one from the list without touching its files, a state for a folder that has moved,
the selection in the URL, and a list kept in the user's own folders. In a browser, none of them can
use the operating system's folder dialog, since a web page never learns an absolute path: they offer
a typed path with completion, or a folder browser served by the server. Products differ most on how
much they offer beyond adding a local folder, on whether a localhost server needs a token, and on
how they ship.

The [proposal](proposal.md) asks for three things: a repository selector at the top left of the web
UI, adding any folder of the machine, and a UI that is easy to run, "maybe with npx". Its title in
[the priorities](../PRIORITIES.md) adds "clean server code". It frames the selector as the first-run
flow a packaged Uraeda will need anyway.

The code is closer to several repositories than it looks: the core and its binding take the
repository's path on every call, and the agent sessions and their cache are already keyed by the
main checkout. What is single-repository is the server's wiring (one repository per process), the
live-update IDs and the web client's cache keys, which have no repository in them, and the UI's
URLs. Nothing is published: all three packages are private, the server runs from its TypeScript
sources, and only the `ura` CLI has releases.

## How other products do it

### Vibe Kanban

The closest analogue: a local Rust server and React UI, started with `npx vibe-kanban`.

- Repositories are added through a folder browser served by the server: "Enter path manually",
  "Search current directory", "Navigate folders – click folder names to browse, use home and up
  buttons", "Select Current". A folder holding a git repository gets a "git repo" badge, and recent
  repositories "appear at the top of the list"
  ([repositories](https://www.vibekanban.com/docs/workspaces/repositories)).
- "Create new repo on disk" takes a name and a location, then initialises git (same page).
- Its server lists a folder with `GET /api/filesystem/directory?path=`, defaulting to the home
  folder and hiding dotfiles, and scans for repositories in the current folder, the home folder, and
  `~/repos`, `~/dev`, `~/code`, and the like, with a time limit
  ([source, filesystem.rs](https://github.com/BloopAI/vibe-kanban/blob/main/crates/services/src/services/filesystem.rs)).
- It keeps its data in the operating system's data folder, `~/.local/share/vibe-kanban` on Linux
  ([source, assets.rs](https://github.com/BloopAI/vibe-kanban/blob/main/crates/utils/src/assets.rs)),
  and its routes carry an opaque project ID, `/projects/$projectId/...`
  ([source, routes](https://github.com/BloopAI/vibe-kanban/tree/main/packages/local-web/src/routes)).
- It binds 127.0.0.1 and checks the `Origin` of requests, with no token for local use
  ([README](https://github.com/BloopAI/vibe-kanban/blob/main/README.md),
  [source, origin.rs](https://github.com/BloopAI/vibe-kanban/blob/main/crates/server/src/middleware/origin.rs)).
- Its npm package is a 51 KB launcher that downloads the platform's Rust binary from a CDN, checks
  its SHA-256, and caches it in `~/.vibe-kanban/bin/`
  ([npx-cli](https://github.com/BloopAI/vibe-kanban/tree/main/npx-cli)).

### GitHub Desktop

- "**Current repository** shows the name of the repository you're working on. You can click
  **Current repository** to switch to a different repository", at the top left, next to the current
  branch
  ([GitHub Docs](https://docs.github.com/en/desktop/overview/creating-your-first-repository-using-github-desktop)).
- Without repositories, a "Let's get started!" view offers a tutorial, a clone, a new repository, or
  "add an existing repository from your hard drive" (same page).
- Adding a local repository takes a path, typed or chosen, and "You can add any Git repository …
  even if it's not a GitHub repository"
  ([GitHub Docs](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop)).
  The path is checked while typing: a folder that is not a repository offers "Would you like to
  create a repository here instead?", and a folder owned by another user warns that it may execute
  files
  ([source](https://github.com/desktop/desktop/blob/development/app/src/ui/add-repository/add-existing-repository.tsx)).
- Ctrl+T shows the list of repositories
  ([shortcuts](https://docs.github.com/en/desktop/overview/github-desktop-keyboard-shortcuts)). Past
  7 repositories, the list adds a "Recent" group, and shows an alias when one is set
  ([source](https://github.com/desktop/desktop/blob/development/app/src/ui/repositories-list/group-repositories.ts)).
- Removing a repository removes it from the list, with an optional "Also move this repository to
  Trash"
  ([source](https://github.com/desktop/desktop/blob/development/app/src/ui/remove-repository/confirm-remove-repository.tsx)).
  A moved or deleted folder shows `Can't find "<name>"`, with **Locate…**, **Clone Again**, and
  **Remove**
  ([source](https://github.com/desktop/desktop/blob/development/app/src/ui/missing-repository.tsx)).

### VS Code and its servers

- Desktop VS Code opens a folder with File > Open Folder, and lists recent folders in
  [Open Recent](https://github.com/microsoft/vscode-docs/blob/main/docs/editing/getting-started/tips-and-tricks.md).
  A multi-root workspace names its folders with a `name` field
  ([multi-root workspaces](https://github.com/microsoft/vscode-docs/blob/main/docs/editing/workspaces/multi-root-workspaces.md)).
- Connected to a remote, it replaces the system's dialog with a "simpler Quick Pick dialog" that
  browses the server's folders (same tips page).
- An untrusted folder opens in Restricted Mode, which disables "AI agents, terminal, tasks,
  debugging" until the user trusts it
  ([workspace trust](https://github.com/microsoft/vscode-docs/blob/main/docs/editing/workspaces/workspace-trust.md)).
- code-server picks the folder from the `?folder=` or `?workspace=` URL parameter, then the command
  line, then the last one opened
  ([FAQ](https://github.com/coder/code-server/blob/main/docs/FAQ.md)). It binds 127.0.0.1 with a
  password on by default, and warns that anyone reaching it "can take over your machine via the
  terminal" ([guide](https://github.com/coder/code-server/blob/main/docs/guide.md)).
- `code serve-web` takes a `--connection-token` or `--without-connection-token`, and a
  `--default-folder` for "when no input is specified in the browser URL"
  ([source, args.rs](https://github.com/microsoft/vscode/blob/main/cli/src/commands/args.rs)).
  openvscode-server needs no token since v1.64
  ([README](https://github.com/gitpod-io/openvscode-server/blob/main/README.md)).

### Jupyter

- Jupyter Server requires a token by default, since "access to the Jupyter Server means access to
  running arbitrary code"
  ([security](https://jupyter-server.readthedocs.io/en/latest/operators/security.html)).
- It refuses a request whose `Host` is not local, against DNS rebinding, and confines files to a
  `root_dir`
  ([configuration](https://jupyter-server.readthedocs.io/en/latest/other/full-config.html)). Its
  URLs carry the file's path, `/lab/tree/<path>`
  ([URLs](https://github.com/jupyterlab/jupyterlab/blob/main/docs/source/user/urls.md)).

### opencode

- `opencode web` binds 127.0.0.1, unsecured unless `OPENCODE_SERVER_PASSWORD` is set, "fine for
  local use"
  ([server docs](https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/server.mdx)).
- Each request names its folder with an `x-opencode-directory` header, else the server's current
  folder
  ([source, location.ts](https://github.com/anomalyco/opencode/blob/dev/packages/server/src/location.ts)).
- In the browser, adding a project opens a dialog served by the server: a typed path with `~`
  expansion and completion, and home, root, and parent buttons. Adding moves the project to the top
  of the recent ones
  ([source, dialog.tsx](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/workspaces/selection/dialog.tsx),
  [add.ts](https://github.com/anomalyco/opencode/blob/dev/packages/app/src/home/projects/add.ts)).
- Its npm package, `opencode-ai`, installs one of 12 platform packages, about 186 MB each for Linux
  x64 ([npm registry](https://registry.npmjs.org/opencode-ai/latest)).

### Other tools

- **Claude Code desktop** asks for a project folder per session, through the system's dialog, and
  groups sessions by project ([desktop docs](https://code.claude.com/docs/en/desktop)).
- **Conductor**: "Open project" for a local repository, "Open GitHub project", or "Quick start" for
  a new one; "1 project contains 1 repository"
  ([first workspace](https://www.conductor.build/docs/first-workspace),
  [concepts](https://www.conductor.build/docs/concepts/workspaces-and-branches)).
- **Zed**: Open Recent, with "Remove from Recent Projects"
  ([windows and projects](https://github.com/zed-industries/zed/blob/main/docs/src/windows-and-projects.md)).
- **Lazygit**: Ctrl+R switches to a recent repository, filtered as you type, with each one's current
  branch; entries whose folder is gone are dropped silently; recent repositories live in
  `$XDG_STATE_HOME/lazygit/state.yml`
  ([keybindings](https://github.com/jesseduffield/lazygit/blob/master/docs/keybindings/Keybindings_en.md),
  [source](https://github.com/jesseduffield/lazygit/blob/master/pkg/gui/controllers/helpers/repos_helper.go)).
  Outside a repository, it asks whether to initialise one or open a recent one
  ([config](https://github.com/jesseduffield/lazygit/blob/master/docs/Config.md)).
- **Sourcetree**: a repository browser with groups, renaming, and sorting
  ([Atlassian KB](https://support.atlassian.com/sourcetree/kb/bookmarks-column-repository-browser-overview/)).
- **Backlog.md**: `backlog browser` serves one project, the current folder, opens the browser by
  default, and takes `--port` and `--no-open`. It ships as Bun-compiled binaries in npm platform
  packages, about 101 MB for Linux x64
  ([README](https://raw.githubusercontent.com/MrLesk/Backlog.md/main/README.md),
  [npm registry](https://registry.npmjs.org/backlog.md/latest)).

### What they have in common

Capabilities users of these tools may expect, whether or not the proposal mentions them:

- A current-repository selector at the top left, recent repositories first, filtered as you type,
  often with a keyboard shortcut
- Adding a local folder, by typed path or by browsing, checked while typing; often also cloning a
  URL and creating a new repository
- A folder that is not a repository: refused, or offered `git init`
- Removing a repository from the list without deleting its files
- A moved or deleted folder: an explicit state with Locate and Remove, or silently dropped
- A display name or alias, and groups, in desktop apps
- The selected repository in the URL: a path parameter, a path in the route, or an opaque ID
- The list kept in the user's own folders, following XDG on Linux
- The folder the tool was started in opened first, with a "get started" view when there is none
- A localhost bind, with a token or a `Host` and `Origin` check against DNS rebinding

## Standards and libraries

### Browser folder pickers

- `showDirectoryPicker()` returns a handle whose only properties are `kind` and `name`, no path, and
  it is missing from Firefox and Safari
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker),
  [FileSystemHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle),
  [compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Window.json)).
- `<input webkitdirectory>` gives paths relative to the chosen folder only
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory)).
- A web page therefore cannot learn an absolute host path: the server must take a typed path or list
  its folders.

### XDG base directories

- `$XDG_CONFIG_HOME` defaults to `~/.config`, `$XDG_DATA_HOME` to `~/.local/share`, and
  `$XDG_STATE_HOME` to `~/.local/state`, for "state data that should persist between (application)
  restarts, but that is not important or portable enough", such as "recently used files"
  ([XDG Base Directory](https://specifications.freedesktop.org/basedir/latest/)).
- Uraeda's runner already keeps `runner.sqlite` in `URAEDA_DATA_DIR`, or `$XDG_DATA_HOME/uraeda/`,
  `~/Library/Application Support/uraeda/`, or `%APPDATA%\uraeda\`
  ([agents decision](../decisions/agents.md),
  [`runner/cache.ts`](/packages/server/src/runner/cache.ts)).

### Publishing a napi-rs addon to npm

- napi-rs ships one npm package per platform, like `<name>-linux-x64-gnu` and `<name>-darwin-arm64`,
  each with its `os`, `cpu`, and `libc`, listed in the main package's `optionalDependencies`; its
  generated loader picks the matching one. The pipeline is `napi create-npm-dirs`, one `napi build`
  per target, `napi artifacts`, then `napi prepublish` and `npm publish`
  ([napi-rs release](https://napi.rs/docs/deep-dive/release)).
- Publishing is not atomic and npm versions are immutable: a missing platform package means a broken
  release to deprecate (same page). The template's CI builds macOS on macOS runners, Linux glibc
  with `--use-napi-cross`, and musl with zig
  ([CI template](https://raw.githubusercontent.com/napi-rs/package-template/main/.github/workflows/CI.yml),
  [cross builds](https://napi.rs/docs/cross-build)).
- npm skips optional dependencies that fail, and `--omit=optional` drops them
  ([package.json docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)). Lockfiles
  regenerated on one platform have dropped the others' packages
  ([npm/cli#4828](https://github.com/npm/cli/issues/4828)): a one-off `npx` run is less exposed.
- Uraeda's generated loader, [`packages/binding/index.js`](/packages/binding/index.js), already
  looks for `uraeda-binding-<platform>` packages after a local `.node` file.
- Biome, Rolldown, Turborepo, opencode, and Backlog.md all ship native code through platform
  packages in `optionalDependencies`; a Rolldown binding is about 20 MB per platform
  ([npm registry](https://registry.npmjs.org/rolldown/latest)).

### Node and TypeScript

- Node "refuses to handle TypeScript files inside folders under a `node_modules` path"
  ([Node 24 TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html)): a published
  server must ship JavaScript.
- Vite+'s `vp pack` builds libraries and executables with tsdown, configured in `vite.config.ts`;
  its `exe` option is experimental and needs Node 25.7 or later
  (`node_modules/vite-plus/docs/guide/pack.md`, [tsdown exe](https://tsdown.dev/options/exe)).
- Node's single executable applications are "Active development" in Node 24, CommonJS only, and load
  a native addon only after writing it to a temporary file
  ([Node 24 SEA](https://nodejs.org/docs/latest-v24.x/api/single-executable-applications.html)).
- `npx` runs a package from the npm cache, asking before installing unless `--yes` is passed
  ([npx](https://docs.npmjs.com/cli/v11/commands/npx)).
- On the npm registry, `uraeda` is free, and `ura` is taken by an unrelated 2016 package
  ([uraeda](https://registry.npmjs.org/uraeda), [ura](https://registry.npmjs.org/ura), checked on
  2026-10-13).

### Opening the browser and the port

- Vite tries the next port when its own is taken, unless `strictPort` is set, and opens the browser
  with `server.open`, honouring `BROWSER`
  ([Vite server options](https://vite.dev/config/server-options)).
- The `open` package runs `open` on macOS and `xdg-open` on Linux
  ([open](https://github.com/sindresorhus/open)).

## The code

### Important reads

- [`crates/core/src/api.rs`](/crates/core/src/api.rs): "the operations the binding exposes, by
  repository path". Each call discovers git and reads the workspace again (`open`, lines 95–99): the
  core holds no repository. One process-wide mutex serialises writes, whatever the repository (lines
  85–93).
- [`crates/core/src/git.rs`](/crates/core/src/git.rs): `Git::discover` searches parent folders
  (lines 73–77), so a subfolder of a repository opens that repository; `main_root` is where
  `.worktrees/` lives (lines 105–112). A folder outside git fails with "not in a git repository: run
  git init first" (line 14).
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): every export takes `repo` first;
  `watch` returns a handle to close. `init` is not exposed: only the CLI runs it
  ([`crates/cli/src/init.rs`](/crates/cli/src/init.rs)).
- [`packages/server/src/main.ts`](/packages/server/src/main.ts): one repository per process, from
  `--repo`, `URAEDA_REPO`, or the current folder ([`env.ts`](/packages/server/src/env.ts),
  [`options.ts`](/packages/server/src/options.ts)); refuses to start outside git; one session
  manager, one watch, port 4310 fixed, no browser opened.
- [`packages/server/src/app.ts`](/packages/server/src/app.ts): the single place the repository is
  bound into every request's context (lines 14–21).
  [`fate/context.ts`](/packages/server/src/fate/context.ts) is `{ binding, repo, sessions }`.
- [`packages/server/src/dev.ts`](/packages/server/src/dev.ts): the dev server already keeps one app
  per repository, keyed `"<port> <repo>"`, and reads `URAEDA_REPO` on every request; the browser
  tests switch repositories this way.
- [`packages/server/src/fate/views.ts`](/packages/server/src/fate/views.ts) (lines 290–294) and
  [`packages/web/src/data.ts`](/packages/web/src/data.ts) (lines 22–27): live-update and cache IDs
  are global, `"workspace"`, `"priorities"`, a feature's folder, `folder/name`. One module-level
  live bus carries them ([`fate.ts`](/packages/server/src/fate.ts), lines 72–90).
- [`packages/server/src/live.ts`](/packages/server/src/live.ts): already keeps a watch per
  repository, but publishes on global IDs, and also starts the session manager: three jobs in one
  file.
- [`packages/server/src/runner/sessions.ts`](/packages/server/src/runner/sessions.ts) and
  [`runner/cache.ts`](/packages/server/src/runner/cache.ts): sessions and their SQLite rows are
  keyed by main checkout, and "servers of every repository share the file". One manager can serve
  every repository today.
- [`packages/server/src/binding.ts`](/packages/server/src/binding.ts) and
  [`runner/claude.ts`](/packages/server/src/runner/claude.ts): paths relative to an Uraeda checkout,
  the binding's freshness check against the Rust sources, and the skill reached through a symlink,
  `packages/server/plugin/skills/uraeda`. A package must ship the skill and the built UI.
- [`packages/web/src/Shell.tsx`](/packages/web/src/Shell.tsx): the top-left heading is a link to `/`
  showing "Uraeda" and the repository's folder name, `workspace?.root.split("/").pop()` (line 153),
  the only place the UI names a repository.
- [`packages/web/src/routes.tsx`](/packages/web/src/routes.tsx): a hand-written router, with no
  repository in any path: `/`, `/f/<folder>/...`, `/chats/<id>`, `/priorities`, `/edit/<path>`.
  About 55 path literals in 16 files build these URLs.
- [`packages/web/src/useRoundPosition.ts`](/packages/web/src/useRoundPosition.ts): a `localStorage`
  key per `folder/file`, which two repositories would share.
- [`packages/web/src/Home.tsx`](/packages/web/src/Home.tsx): a repository without `specs/` shows "No
  specs/ folder … Set Uraeda up with ura init."
- [`packages/web/vite.browser.config.ts`](/packages/web/vite.browser.config.ts) and
  `src/__browser__/setup.ts`: browser tests take the repository in turn, one at a time, since the
  dev server reads one `URAEDA_REPO`.
- [`dist-workspace.toml`](/dist-workspace.toml) and
  [`.github/workflows/release.yml`](/.github/workflows/release.yml): cargo-dist releases `ura` only,
  for Linux and macOS on x64 and arm64, through a shell installer and Homebrew. Nothing is published
  to npm.
- [Stack decision](../decisions/stack.md): the server is TypeScript on Node, the CLI "MUST NOT need
  Node or any other runtime", the server listens on 127.0.0.1 with a `Host` and `Origin` check, and
  "shipping the server means shipping a native addon per platform, or a container image".
- [Toolchain decision](../decisions/toolchain.md): Windows is not supported until a decision adds
  it.
- [Web UI record](../done/2026-10-11-web-ui.md#q10-which-repositories-does-the-ui-open-now): the
  human chose `vp dev` at Uraeda's root with `URAEDA_REPO` for another repository, and left
  "packaging the UI to run from any repository, like `ura web`" for a later feature.

### The proposal's path and existing actions

- **Starting the UI**: today, `pnpm start` or `vp dev` from Uraeda's checkout, on one repository.
  With the feature, one server opens several, whatever folder it starts in.
- **Switching repository**: the heading links to `/` today. The selector replaces it, and every URL
  gains the repository, or the client's cache mixes two repositories' features under the same IDs.
- **Adding a folder**: no code today. A folder that is not in git fails every call; a subfolder of a
  repository opens its parent repository; a repository without `specs/` is shown with its banner; a
  repository without a commit has no sessions, and refuses drafts.
- **Live updates**: a change in one repository would refresh the open page of another today, since
  IDs have no repository.
- **Agent sessions**: keyed by main checkout already, and work in the repository's checkout or
  worktree: nothing changes, but one server now runs agents in every listed repository.
- **Removing a repository**: no code today. Its sessions stay in the cache, keyed by its path.
- **A moved or deleted folder**: no code today; every call would fail.
- **Two servers**: the second one on port 4310 fails to listen today. The cache already supports
  several servers.

### Overlaps with work in flight

- `fix/2026-10-13-review-findings`, a local branch with its own worktree, holds 57 changed files
  across `packages/`: it splits `runner/sessions.ts`, refactors `routes.tsx`, `App.tsx`, and
  `data.ts`, and changes the browser tests' waits. Four local `worktree-agent-*` branches hold the
  same kind of work. Every one touches files this feature changes.
- Image attachments, on the `2026-10-13-image-attachments` branch, a proposal only: it will add file
  routes, which need the repository in their URL like `/raw` and `/mockups`.
- In [the priorities](../PRIORITIES.md): "Monorepo support: multiple `specs` folders" in Next, a
  different axis; "Better URLs for the navigation" in the Scratchpad, which a repository segment
  meets; and the onboarding pass, which meets the first-run flow.

### Likely changes

- A repository list, new, in the server: read and written in Uraeda's user folders, under every
  option of [storing the list](#storing-the-list).
- [`packages/server/src/app.ts`](/packages/server/src/app.ts),
  [`fate/context.ts`](/packages/server/src/fate/context.ts),
  [`fate/sources.ts`](/packages/server/src/fate/sources.ts),
  [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts),
  [`fate/views.ts`](/packages/server/src/fate/views.ts),
  [`files.ts`](/packages/server/src/files.ts): the repository resolved per request, and IDs that
  carry it, under every option of [the repository in the URL](#the-repository-in-the-url).
- [`live.ts`](/packages/server/src/live.ts): topics per repository, a watch started and stopped with
  the list, and the session manager moved out.
- [`main.ts`](/packages/server/src/main.ts), [`dev.ts`](/packages/server/src/dev.ts),
  [`env.ts`](/packages/server/src/env.ts), [`options.ts`](/packages/server/src/options.ts): one
  shared wiring for both, and the starting folder added to the list.
- [`packages/web/src/routes.tsx`](/packages/web/src/routes.tsx) and every page building a path: a
  repository segment; [`data.ts`](/packages/web/src/data.ts): IDs with the repository;
  [`Shell.tsx`](/packages/web/src/Shell.tsx): the selector; a new form to add a folder, and a
  first-run view.
- With option A of [shipping](#shipping-the-ui): `vite.config.ts` `pack` for the server,
  `napi.targets` and platform packages for the binding, a published package with a `bin`, and an npm
  job in the release workflow. With option B: a `ura` subcommand and the stack decision.
- Tests: the server helpers bind one repository per app; browser tests could each use their own
  repository and drop their lock.

## The proposal

### Three features in one

The proposal holds a repository selector, adding any folder, and an easy way to run the UI; its
title adds cleaning the server's code. The first two are one feature in the server and the UI. The
third is a release pipeline: platform packages, a bundled server, npm publishing, and a CI matrix,
with a decision of its own. They meet in one place: a packaged server starts in any folder, and the
selector is what it shows first.

### "Any folder of the machine"

Every call into the core needs a git repository, and a subfolder resolves to its repository. "Any
folder" can mean any git repository, or any folder with an offer to run `git init`, or also cloning
and creating one, as GitHub Desktop and Vibe Kanban do. A folder without `specs/` is already shown,
with a banner pointing to `ura init`, which the server cannot run.

### "Clean server code"

The title asks for clean server code without saying what is unclean. The code shows what stands in
the way: `main.ts` and `dev.ts` wire the server twice, `live.ts` mixes three jobs, `binding.ts`
assumes an Uraeda checkout, and IDs have no namespace. A broader cleanup, like splitting
`runner/sessions.ts`, is already on the `fix/2026-10-13-review-findings` branch.

### The selector in the top-left icon

The proposal places the selector in "the top left icon". Today the top left is the heading, "Uraeda"
over the repository's name, and a home icon when the navigation is folded. The
[UI layout decision](../decisions/ui-layout.md) makes menus popovers on wide screens and bottom
sheets on narrow ones, and requires what can be returned to in the URL.

### Security beyond one repository

Today the server reaches one repository the human chose when starting it. Adding any folder from the
UI lets anyone who reaches the server read folder names, add any repository, and run an agent in it:
the host names in `URAEDA_ALLOWED_HOSTS`, a phone on the tailnet, are such clients. The
[stack decision](../decisions/stack.md)'s `Host` and `Origin` check is the only protection, as in
Vibe Kanban and opencode, while Jupyter and code-server add a token.

## Approaches

Criteria come from the [proposal](proposal.md) (a selector, any folder, easy to run), the
[constitution](../CONSTITUTION.md) (git and plain text first, II; asynchronous, III; tools are
optional, V; explicit, simple code, VI), and the active decisions: [stack](../decisions/stack.md)
(Node server, CLI without Node, 127.0.0.1 and the `Host` check), [agents](../decisions/agents.md)
(the user data folder, sessions keyed by main checkout), [UI layout](../decisions/ui-layout.md)
(popover or sheet, state in the URL), [UI components](../decisions/ui-components.md) (Astryx
components), and [toolchain](../decisions/toolchain.md) (Linux and macOS).

### Scope

What this feature delivers. See [three features in one](#three-features-in-one).

| Option                                            | Delivers the proposal | Size   | Risk                                        |
| ------------------------------------------------- | --------------------- | ------ | ------------------------------------------- |
| A. Multi-repo now, publishing as the next feature | The first two parts   | Medium | Low: no release pipeline in the same review |
| B. All three in one                               | All of it             | Large  | A large review, with a release to get right |
| C. Multi-repo only, publishing unplanned          | The first two parts   | Medium | "Easy to run" waits without a date          |

### Shipping the UI

How a user runs the UI outside Uraeda's checkout. See
[publishing a napi-rs addon](#publishing-a-napi-rs-addon-to-npm) and
[Node and TypeScript](#node-and-typescript).

| Option                                        | Command                 | Fits the stack decision       | Effort                                                      | Needs on the machine |
| --------------------------------------------- | ----------------------- | ----------------------------- | ----------------------------------------------------------- | -------------------- |
| A. npm package with platform binding packages | `npx uraeda`            | Yes                           | Bundle the server, napi matrix, npm publishing              | Node 24              |
| B. `ura ui` starting the npm package          | `ura ui`                | No: the CLI would need Node   | A plus a subcommand and a decision change                   | Node 24 and `ura`    |
| C. A single executable (Node SEA, Bun, Deno)  | Download a binary       | Node SEA only; Bun or Deno no | Experimental for Node, native addon as a temp file          | Nothing              |
| D. A container image                          | `docker run -v ...`     | Yes                           | Image per architecture; `claude` and repositories inside it | Docker               |
| E. Keep the checkout                          | `pnpm start` in a clone | Yes                           | None                                                        | Rust, Node, a build  |

### Adding a folder

How the human names a folder from the browser. See
[browser folder pickers](#browser-folder-pickers).

| Option                                        | Works on the phone | Effort                 | Like                        |
| --------------------------------------------- | ------------------ | ---------------------- | --------------------------- |
| A. Typed path with completion from the server | Yes                | A folder-listing query | opencode, VS Code remote    |
| B. A folder browser, with home and up         | Yes, many taps     | A listing and a view   | Vibe Kanban                 |
| C. Typed path only                            | Yes, typing paths  | Smallest               | GitHub Desktop's path field |
| D. Only from a terminal (`--repo` adds)       | No                 | Smallest               | Backlog.md                  |

### Which folders

What a folder must be to be added. See ["any folder of the machine"](#any-folder-of-the-machine).

| Option                                               | Simple | Covers new projects | Effort                                |
| ---------------------------------------------------- | ------ | ------------------- | ------------------------------------- |
| A. Git repositories only, with or without `specs/`   | Yes    | No                  | Small                                 |
| B. A, plus `git init` for a folder outside git       | Yes    | Partly              | Small: a core action                  |
| C. B, plus cloning a URL                             | Less   | Yes                 | Medium: credentials, progress, errors |
| D. Any of these, plus setting Uraeda up (`ura init`) | Less   | Yes                 | Small: `init` exists in the core      |

### Storing the list

Where the server keeps the repositories it knows. See [XDG base directories](#xdg-base-directories).

| Option                                               | Readable and editable by hand | Survives losing the cache | Fits decisions                         |
| ---------------------------------------------------- | ----------------------------- | ------------------------- | -------------------------------------- |
| A. A plain-text file in Uraeda's config folder       | Yes                           | Yes                       | A new location, beside the data folder |
| B. A file in the data folder, beside `runner.sqlite` | Yes                           | Yes                       | The folder the agents decision names   |
| C. A table in `runner.sqlite`                        | No                            | No: it is a cache         | Against "losing it MUST cost only…"    |
| D. No list: the browser remembers                    | No                            | Per browser only          | The phone and the desktop differ       |

### The repository in the URL

How a URL names its repository. See [VS Code and its servers](#vs-code-and-its-servers) and
[Jupyter](#jupyter).

| Option                               | Readable | Stable when the folder moves | Leaks the path in links |
| ------------------------------------ | -------- | ---------------------------- | ----------------------- |
| A. A short name: `/r/uraeda/f/...`   | Yes      | Yes, if the name is kept     | No                      |
| B. An opaque ID: `/r/3fa9/f/...`     | No       | Yes                          | No                      |
| C. The path: `?repo=/home/me/uraeda` | Yes      | No                           | Yes                     |

### The selector

Where switching and adding happen. See
[the selector in the top-left icon](#the-selector-in-the-top-left-icon).

| Option                                          | Clicks to switch | Room for remove, missing folders | Fits UI layout |
| ----------------------------------------------- | ---------------- | -------------------------------- | -------------- |
| A. A menu from the heading, popover or sheet    | Two              | One action per row               | Yes            |
| B. A repositories page, linked from the heading | Two, and a page  | Plenty                           | Yes            |
| C. A command palette (Ctrl+K)                   | Keyboard only    | Little                           | Desktop only   |

### Starting and first run

Which repository opens when the server starts, and what shows with none. See
[what they have in common](#what-they-have-in-common).

| Option                                                                    | Like                     | Without any repository                 |
| ------------------------------------------------------------------------- | ------------------------ | -------------------------------------- |
| A. The starting folder, when it is a repository, else the last one opened | code-server, `serve-web` | A "get started" view with the add form |
| B. Always the last one opened                                             | GitHub Desktop           | Same                                   |
| C. Always a list of repositories                                          | Vibe Kanban's projects   | Same                                   |

### Access from other machines

Who may add folders and run agents in them. See
[security beyond one repository](#security-beyond-one-repository).

| Option                                        | Phone through Tailscale    | Effort | Like                            |
| --------------------------------------------- | -------------------------- | ------ | ------------------------------- |
| A. Keep the `Host` and `Origin` check only    | Unchanged                  | None   | Vibe Kanban, opencode           |
| B. A token printed at start, kept in a cookie | Open the printed link once | Medium | Jupyter, code-server, serve-web |
| C. A, but adding folders only from 127.0.0.1  | Can switch, cannot add     | Small  |                                 |

### Needs no choice

- **Recent first, and filtering**: the list is sorted by last opened; a filter field is part of the
  selector's design.
- **Removing a repository** only removes it from the list, never its files or its sessions' cache
  rows: no product deletes files without an extra choice.
- **A moved or deleted folder** stays in the list, marked missing, with Remove: silently dropping
  it, like Lazygit, would hide what happened.
- **A subfolder, a worktree, or a repository added twice**: the list keeps the main checkout, which
  the core already resolves, so each repository appears once.
- **Aliases and groups**: desktop-app features; the name shown is the folder's name, made unique
  when two match.
- **A keyboard shortcut** to open the selector: a small addition the spec can name.
- **Per-repository browser storage**: the round position key gains the repository.
- **The server's wiring**: one function builds the server for `main.ts` and `dev.ts`.
- **Watching**: one watch per listed repository, started and stopped with the list.

## Not checked

- How Vibe Kanban handles a moved folder, removing, or renaming a repository: its docs are silent.
- Where Conductor and Claude Code desktop store their project lists.
- The size of Uraeda's own `.node` binding and of a bundled server: never built for release.
- Whether the `@uraeda` npm scope and the `uraeda-binding-*` names are free.
- How long `npx` keeps a cached package before checking for a new version: the npx page does not
  say.
- Whether tsdown's `exe` embeds a `.node` file by itself: its page does not mention native addons.
