# Discovery, round 01: Extensions system

## Summary

An extensions system lets code that is not in Uraeda's repository add to Uraeda, or replace part of
it. Established products agree on the shape: a manifest that declares what an extension contributes
(commands, keys, settings, views, themes), code that runs only when needed, a few install sources (a
folder, a git URL, a package registry), and lifecycle verbs (install, enable, disable, update,
remove). They differ in three places:

- **Isolation.** Zellij, Zed, and Figma run extensions in WASM or a sandbox with permissions. VS
  Code runs them in a separate process with full rights. Every agent harness compared (pi, Claude
  Code, opencode, DeepSeek Harness) runs them in-process, with full rights and a warning.
- **Where they load from.** User-level folders everywhere; project folders only after a trust prompt
  (VS Code, Claude Code, pi).
- **UI.** Declarative contributions rendered by the host (VS Code), in-page code sharing the host's
  React (Grafana, Backstage), or sandboxed frames (VS Code webviews, Figma, MCP Apps).

The proposal asks for three kinds: core extensions (WASM?), server extensions (TypeScript?), and UI
extensions. It names the Claude integration as a candidate, and "the references system, which is
more of a skill". It asks for one feature, not a split.

Today, Uraeda has no extension mechanism. The agent runner already reaches Claude Code through an
`Adapter` interface, but one adapter is hard-wired. Colour themes are the only "files the user drops
in" seam. Everything else — check rules, steps, routes, pages, settings categories, CLI commands —
is a closed enum or a constant table. Several active decisions shape the design: one Rust core for
workflow logic, settings and themes only from the config folder and never from a repository, a
self-contained npm package that downloads nothing, and no backward compatibility before 1.0.

## How other products do it

### VS Code

- The manifest is `package.json`, with a required `engines.vscode` semver range and an ID
  `publisher.name` ([manifest](https://code.visualstudio.com/api/references/extension-manifest)).
- 38 declarative contribution points: `commands`, `menus` with `when` clauses, `configuration`
  rendered in the Settings editor, `keybindings`, `views`, `themes`, `languages`, and newer AI
  points like `chatSkills` and `languageModelTools`
  ([contribution points](https://code.visualstudio.com/api/references/contribution-points)).
- Code loads lazily on activation events (`onCommand`, `onView`, ...). Since 1.74 contributions
  activate implicitly
  ([activation events](https://code.visualstudio.com/api/references/activation-events)).
- Extensions run in an extension-host process, apart from the UI, to protect startup and UI speed,
  not for security: "The extension host has the same permissions as VS Code itself"
  ([extension host](https://code.visualstudio.com/api/advanced-topics/extension-host),
  [runtime security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security)).
- Custom UI is a webview, "an `iframe` within VS Code that your extension controls", talking by
  `postMessage`. VS Code passes its colours as `--vscode-*` CSS variables. Microsoft advises using
  webviews "sparingly", since they can "feel out of place"
  ([webviews](https://code.visualstudio.com/api/extension-guides/webview)).
- Workspace Trust: an untrusted folder runs in Restricted Mode, and extensions declare whether they
  work there
  ([workspace trust](https://code.visualstudio.com/api/extension-guides/workspace-trust)).
- Unstable API is "proposed", usable only in Insiders, never in published extensions
  ([proposed API](https://code.visualstudio.com/api/advanced-topics/using-proposed-api)).

### Zellij

- Plugins are WASM/WASI, Rust only officially. Zellij's own tab bar and status bar are plugins
  ([plugins](https://zellij.dev/documentation/plugins)).
- Loaded by reference: `file:`, `https://`, or a built-in alias; no registry
  ([loading](https://zellij.dev/documentation/plugin-loading)).
- Plugins request named permissions at load time (`RunCommands`, `FullHdAccess`, `ReadPaneContents`,
  ...), and the user is prompted
  ([permissions](https://zellij.dev/documentation/plugin-api-permissions)).
- The filesystem is mapped: `/host` is the focused pane's folder, `/data` per plugin
  ([file system](https://zellij.dev/documentation/plugin-api-file-system)).
- Zellij moved from Wasmtime to wasmi, an interpreter, in 0.44
  ([Cargo.toml](https://raw.githubusercontent.com/zellij-org/zellij/main/zellij-server/Cargo.toml));
  the reason (no compile step or cache) is seen only in a release-notes mirror.

### Zed

- An extension is a git repository with an `extension.toml`. Most contribute only data (themes,
  grammars, snippets); language servers and debuggers need Rust compiled to `wasm32-wasip2`
  ([developing](https://zed.dev/docs/extensions/developing-extensions)).
- Wasmtime with the Component Model and WIT, versioned folders `since_v0.x.y`. Zed keeps every old
  API version working ([Zed decoded](https://zed.dev/blog/zed-decoded-extensions),
  [extension_api README](https://github.com/zed-industries/zed/blob/main/crates/extension_api/README.md)).
- The API offers `download_file`, `npm_install_package`, and `process::Command`: the sandbox is
  porous by design
  ([zed_extension_api](https://docs.rs/zed_extension_api/latest/zed_extension_api/)). Users can
  narrow these capabilities ([capabilities](https://zed.dev/docs/extensions/capabilities)).
- Zed deprecated its agent-server and slash-command extensions for the ACP registry, and MCP
  extensions for the MCP registry
  ([publishing](https://zed.dev/docs/extensions/publishing/prerequisites)).

### pi

- pi (now `earendil-works/pi`) is "a minimal, extensible agent harness"; sub-agents and plan mode
  are left to extensions. It has no permission system
  ([repository](https://github.com/badlogic/pi-mono)).
- An extension is a TypeScript file exporting a factory that receives `ExtensionAPI`, loaded with
  jiti, without a build. Global ones in `~/.pi/agent/extensions/`; project ones in
  `.pi/extensions/`, loaded only after the project is trusted. `pi -e ./x.ts` loads one for a run
  ([extensions](https://raw.githubusercontent.com/earendil-works/pi/refs/heads/main/packages/coding-agent/docs/extensions.md)).
- The API registers tools, commands, shortcuts, flags, model providers, MCP servers, and message
  renderers, and listens to about 40 events. A `tool_call` handler can block or rewrite a call.
  `ctx.ui` offers dialogs, a status line, widgets, and full custom components; extensions check
  `ctx.hasUI`, since pi has several front ends.
- Packages bundle `extensions/`, `skills/`, `prompts/`, and `themes/`, installed from `npm:`,
  `git:`, or a path, with `pi install`, `remove`, `update`, and `config` to enable or disable.
  Pinned versions never move
  ([packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)).
- "Extensions run with your full system permissions" (extensions doc above).

### DeepSeek Harness

- `dsh` is DeepSeek's agent harness, in public preview, whose idea is "everything is a plugin":
  models, tools, skills, sessions, sandboxes, loops, and UI
  ([product page](https://www.deepseek.com/en/harness/),
  [repository](https://github.com/deepseek-ai/deepseek-harness)).
- Built on Cordis: "There is no privileged core to patch". Plugins contribute services, events, and
  effects that unwind when the plugin unloads, which gives hot reload
  ([architecture](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md)).
- The web client's chat nodes are registered renderers. Plugin indexes are JSON files of npm or git
  sources; "Nothing is installed without that confirmation"
  ([plugin market](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/user/guide/plugin-market.md)).
- "THERE WILL BE COMPATIBILITY-BREAKING CHANGES", and "untrusted plugins may damage the host
  computer"
  ([SAFETY.md](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/SAFETY.md)).

### Claude Code

- A plugin bundles skills, agents, hooks, MCP and LSP servers, output styles, and a `bin/` folder.
  Its manifest `.claude-plugin/plugin.json` needs only a `name`. `userConfig` declares typed
  settings, sensitive ones kept in the OS keychain
  ([reference](https://code.claude.com/docs/en/plugins-reference)).
- Marketplaces are `marketplace.json` files in a git repository, with sources from a path, GitHub,
  git, a URL, an archive pinned by sha256, or npm
  ([marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)).
- Scopes: user, project (committed), local, and managed. Repository plugins load only after the
  trust check. `/plugin` enables, disables, updates, and shows each plugin's context cost
  ([install](https://code.claude.com/docs/en/plugins/install.md),
  [loading](https://code.claude.com/docs/en/plugins/loading.md)).
- Auto-update is off for third-party marketplaces, since "the files you reviewed can change on
  disk". npm dependencies install with `--ignore-scripts` from a lockfile
  ([security](https://code.claude.com/docs/en/plugins/security.md)).
- Mods are in-process JS handlers on events like `tool.call` and `ui.render`, and some built-in
  features are themselves mods. "Mods aren't sandboxed"
  ([mods](https://code.claude.com/docs/en/plugins/mods/overview.md)).
- Uraeda already uses this: it passes its skill to `claude --plugin-dir`
  ([claude.ts](/packages/server/src/runner/claude.ts)).

### Other products

- **opencode**: plugins from folders or npm/git entries in `opencode.json`, with server, TUI, and
  experimental GUI parts. Server hooks include `execute.before`, `prompt`, and permission
  evaluation, where a configured `deny` is final ([plugins](https://opencode.ai/docs/plugins/),
  [server plugins](https://opencode.ai/docs/build/plugins/server)).
- **Cursor** and **Codex**: plugins bundle rules, skills, MCP servers, and hooks; Cursor's team
  marketplaces set plugins off, on, or required ([Cursor](https://cursor.com/docs/plugins),
  [ChatGPT](https://learn.chatgpt.com/docs/plugins)).
- **Agent Plugins 1.0** (2026-08-06, Vercel, with OpenAI, GitHub, Microsoft, Cursor): a root
  `plugin.json` with only skills and `mcp.json`; hooks and agents are left out as too
  client-specific. Claude Code is not a launch client
  ([announcement](https://vercel.com/blog/introducing-agent-plugins),
  [specification](https://agent-plugins-site-c7uy8oud2.labs.vercel.dev/specification)).
- **Obsidian**: "Obsidian cannot reliably restrict plugins to specific permissions". Restricted mode
  is on by default, and every version is scanned
  ([plugin security](https://obsidian.md/help/plugin-security)). A 2026 campaign spread a remote
  access tool through a shared vault and a shell plugin
  ([Gigazine](https://www.gigazine.net/gsc_news/en/20260513-obsidian-plugin-future)).
- **Grafana**: backend plugins are separate processes over gRPC, so "Plugins can't crash your
  Grafana process"
  ([backend plugins](https://grafana.com/developers/plugin-tools/key-concepts/backend-plugins/)).
  Frontend plugins share Grafana's React through SystemJS
  ([npm dependencies](https://grafana.com/developers/plugin-tools/key-concepts/npm-dependencies)).
  Its in-page frontend sandbox is deprecated, to be removed in 13.4
  ([frontend sandbox](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-frontend-sandbox/)).
  Its move to React 19 broke plugins, every author raising their minimum version
  ([React 19](https://grafana.com/blog/react-19-is-coming-to-grafana-what-plugin-developers-need-to-know)).
- **Backstage**: frontend extensions form a tree, each attached to a parent's input, enabled or
  configured by ID in `app-config`
  ([extensions](https://backstage.io/docs/frontend-system/architecture/extensions)). Backend
  extension points are additive: a break means a new `V2` point
  ([extension points](https://backstage.io/docs/backend-system/architecture/extension-points)).
  Plugins are installed at build time
  ([building backends](https://backstage.io/docs/backend-system/building-backends/index)).
- **Figma**: plugin logic in a sandbox without browser APIs, UI in an iframe, talking by messages; a
  manifest network allowlist enforced by CSP
  ([how plugins run](https://developers.figma.com/docs/plugins/how-plugins-run/),
  [manifest](https://developers.figma.com/docs/plugins/manifest/)).
- **Neovim**: `vim.pack` installs from git, pinned in a committable lockfile, with a confirmation
  before updates ([pack](https://neovim.io/doc/user/pack/)).
- **JetBrains**: `plugin.xml` declares extensions and extension points; a no-restart plugin needs
  every point it uses to be dynamic
  ([configuration file](https://plugins.jetbrains.com/docs/intellij/plugin-configuration-file.html)).

### What they have in common

- **A manifest separate from the code**, read without running the extension: its name, version, the
  host version it supports, and what it contributes.
- **Install sources**: a local folder for development, a git URL pinned to a commit, a package
  registry, and lately git-hosted catalog files.
- **Scopes**: user-level everywhere; project-level only behind a trust prompt.
- **Lifecycle verbs**: install, remove, enable, disable without removing, update, list, and reload
  without a restart.
- **A version contract**: the extension states which host versions it supports, and unstable API is
  fenced.
- **Settings contributions**: a typed schema rendered in the host's settings, secrets kept apart.
- **Contributions**: commands, keybindings, themes, views and panels, status-line items, and custom
  renderers of chat items.
- **Agent contributions**: skills, MCP servers, tools, model providers, and hooks on tool calls that
  can observe, rewrite, or block.
- **Disposable registrations**: each registration returns a function that undoes it, so an extension
  unloads cleanly.
- **A trust model said plainly**: either a real sandbox with permissions, or full rights and a
  warning.

## Standards and libraries

### WASM in a Rust host

- WASI 0.3 shipped on 2026-06-11, with native async; WASI 1.0 has no date
  ([roadmap](https://wasi.dev/roadmap)). Wasmtime 46 and later enable it by default
  ([WASI 0.3](https://bytecodealliance.org/articles/WASI-0.3)); Wasmtime is at 50.
- Wasmtime releases a major version every month, with an LTS every 12th release, supported 24 months
  ([release policy](https://docs.wasmtime.dev/stability-release.html)).
- Size, as of 2024-12: about 19 MB for a default build, about 2.1 MB for a runtime-only build that
  needs precompiled modules ([minimal builds](https://docs.wasmtime.dev/examples-minimal.html)).
  Neither its build time nor its size inside a napi-rs addon is documented.
- Extism wraps Wasmtime with host SDKs in many languages, on WASI preview 1, and rules out the
  Component Model "now or soon" ([issue 666](https://github.com/extism/extism/issues/666)).
- wasmi is an interpreter with fuel metering, the choice of Zellij
  ([wasmi](https://github.com/wasmi-labs/wasmi)).
- `jco transpile` turns a component into an ES module that runs in Node and the browser, but the
  WASI 0.3 shim targets Node only ([jco](https://github.com/bytecodealliance/jco),
  [transpiling](https://bytecodealliance.github.io/jco/transpiling.html)).
- Writing a component in JavaScript embeds an 8 MB engine, and is experimental
  ([ComponentizeJS](https://github.com/bytecodealliance/ComponentizeJS)).
- WIT versions each item with `@since`; adding a case to a variant breaks consumers
  ([WIT](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md)).

### TypeScript in Node

- Node strips types natively, stable since 24.12. It refuses files under `node_modules`, `.tsx`, and
  non-erasable syntax like `enum`, and ignores `tsconfig` paths
  ([TypeScript in Node](https://nodejs.org/api/typescript.html)). Uraeda requires Node 24
  ([`packages/uraeda/package.json`](/packages/uraeda/package.json)).
- jiti loads any TypeScript, JSX included, with a cache; pi uses it
  ([jiti](https://github.com/unjs/jiti)).
- No in-process isolation is a security boundary:
  - "The `node:vm` module is not a security mechanism" ([vm](https://nodejs.org/api/vm.html)).
  - The permission model "does not provide security guarantees in the presence of malicious code"
    ([permissions](https://nodejs.org/api/permissions.html)).
  - isolated-vm is in maintenance mode, tied to even Node majors
    ([isolated-vm](https://github.com/laverdet/isolated-vm)).
  - ShadowRealm is "not aiming to defend against malicious code"
    ([explainer](https://github.com/tc39/proposal-shadowrealm/blob/main/explainer.md)).
  - Worker threads cap only the heap ([worker threads](https://nodejs.org/api/worker_threads.html)).
- Hono has no plugin concept: middleware and sub-apps mounted with `app.route()`, which must have
  their routes before mounting ([routing](https://hono.dev/docs/api/routing)).

### UI extensions in a React app

- **Sandboxed frames**: strong only on a separate origin; `allow-scripts` with `allow-same-origin`
  on the same origin "lets the embedded document remove the `sandbox` attribute"
  ([iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)).
- **MCP Apps** (spec 2026-01-26, stable): HTML resources in a frame on a different origin, JSON-RPC
  over `postMessage`, declared domains, and the host's theme passed as CSS variables
  ([spec](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/specification/2026-01-26/apps.mdx)).
- **Shared modules**: import maps map `react` to one URL, registered before any module loads
  ([importmap](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)).
  `@module-federation/vite` supports Vite 8 with React as a singleton
  ([module-federation/vite](https://github.com/module-federation/vite)).
- In-page code has the page's session: an `HttpOnly` cookie cannot be read, but "the browser always
  includes the cookies" on its requests
  ([OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)).

### Security of extensions beside a coding agent

- Claude Code: "A Claude Code plugin you install can execute arbitrary code on your machine with
  your user privileges"; its sandbox covers the agent's tool calls, not a plugin's code
  ([security](https://code.claude.com/docs/en/plugins/security.md)).
- Supply-chain worms reached both npm (Shai-Hulud, 500+ packages, by stolen tokens)
  ([CISA](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem))
  and editor marketplaces (GlassWorm, hidden in invisible Unicode)
  ([Endor Labs](https://www.endorlabs.com/learn/invisible-threats-glassworm-unicode-vscode)).
- Seven sandbox escapes in coding agents in 2026 came from files the agent wrote and an unsandboxed
  component later ran: hooks, `.git/config`, editor tasks
  ([CSA note](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-coding-agent-sandbox-escapes-20260722-c/)).
- Judgement: an agent that already runs shell commands as the user can read what an extension could.
  What protects the user is where code comes from (pinned, reviewed, never loaded from a cloned
  repository without asking), not a sandbox around it.

### Versioning extension APIs

- `engines.vscode`, Obsidian's `minAppVersion`, Grafana's `grafanaDependency`, and Fastify's version
  range all state the host versions an extension supports
  ([publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension),
  [Obsidian manifest](https://docs.obsidian.md/Reference/Manifest),
  [fastify-plugin](https://github.com/fastify/fastify-plugin)).
- MCP negotiates a protocol version at `initialize`, and refuses an unsupported one
  ([lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)).

## The code

### Important reads

- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts): the `Adapter` interface, "the one
  interface every agent is reached through": `kind`, `name`, `capabilities`, `open()`,
  `allowRule()`, `hasSession()`, `version()`. Neutral events and items are in
  [`events.ts`](/packages/server/src/runner/events.ts). This is an extension point already, minus
  loading.
- [`main.ts`](/packages/server/src/main.ts) line 125 builds `new ClaudeAdapter(...)`: one adapter
  per server, hard-wired. `Sessions` takes a single adapter, and nothing looks one up by a session's
  stored `agent` kind ([`sessions.ts`](/packages/server/src/runner/sessions.ts)).
- Claude assumptions outside the adapter:
  - [`transcript.ts`](/packages/server/src/runner/transcript.ts) fails a run whose `init` lacks the
    `uraeda` plugin;
  - [`instructions.ts`](/packages/server/src/runner/instructions.ts) is appended to Claude's system
    prompt;
  - [`message.ts`](/packages/server/src/runner/message.ts) reads Claude's tool input keys and starts
    runs with `/uraeda`;
  - [`fake.ts`](/packages/server/src/runner/fake.ts) reuses Claude's `allowRule`;
  - the web's [`HarnessMark.tsx`](/packages/web/src/HarnessMark.tsx),
    [`UsageWindow.tsx`](/packages/web/src/UsageWindow.tsx) (Claude's five-hour and week windows),
    and [`home/Setup.tsx`](/packages/web/src/home/Setup.tsx) ("Install Claude Code").
- [`packages/benchmarks`](/packages/benchmarks/) imports the adapter from `uraeda-server/runner/*`,
  and the benchmarks decision says "A new agent is benchmarked by writing its adapter".
- [`themes.rs`](/crates/core/src/themes.rs): shipped themes embedded, user themes from
  `<config>/themes/*.toml`, a broken one never blocking the others. The only seam today where the
  user drops files in.
- [`check/mod.rs`](/crates/core/src/check/mod.rs): 12 rule modules called from fixed `match` blocks;
  templates embedded from the skill ([`embedded.rs`](/crates/core/src/embedded.rs)). A project
  cannot add a rule, a field, or a template.
- [`steps.rs`](/crates/core/src/steps.rs): `StepName` is a closed enum, and the reference path is
  `skills/uraeda/references/{reference}.md`. Step names are copied in TypeScript in seven places
  (`pulls.ts`, `message.ts`, `continuer.ts`, `status.ts`, `labels.ts`, `next.ts`, `cards.ts`).
- [`app.ts`](/packages/server/src/app.ts): fixed `app.route` calls, no route registry.
  [`fate.ts`](/packages/server/src/fate.ts) builds each fate server from static `mutations`,
  `roots`, and `sources` at creation; fate's Vite plugin types the client from the server module at
  build time ([`vite.transforms.ts`](/packages/web/vite.transforms.ts)).
- Web: [`routeTable.ts`](/packages/web/src/routeTable.ts) is a closed union of about 27 pages;
  [`destinations.ts`](/packages/web/src/destinations.ts) a constant list of places;
  [`settings/categories.ts`](/packages/web/src/settings/categories.ts) a closed list of categories.
  The [key registry](/packages/web/src/keys/registry.tsx) is the one runtime registry: components
  declare bindings while mounted. No command palette runs actions.
- [`crates/cli/src/main.rs`](/crates/cli/src/main.rs): an exhaustive `match` of subcommands, with no
  external `ura-foo` lookup.
- [`actions/install.rs`](/crates/core/src/actions/install.rs): installs the embedded skill into
  `.agents/skills` or `.claude/skills`, with a hash manifest that keeps edited files. Extra files a
  project adds survive updates, but nothing reads them.
- [`packages/server/plugin/`](/packages/server/plugin/): a Claude plugin whose `skills/uraeda` links
  to the skill, passed with `--plugin-dir`.
- [`preview/runner.ts`](/packages/server/src/preview/runner.ts): the server already runs a command a
  project names, its preview decision's `preview-command`.
- File sizes: no source file is over the 500-line limit; `sessions.ts` (495), `cache.ts` (485),
  `continuer.ts` (481), and `claude-events.ts` (475) are within 25 lines of it. `ClaudeAdapter.open`
  carries the one marker in the runner.

### The proposal's path and existing actions

- **Installing an extension**: nothing exists. The nearest are `ura install`, for the skill, and the
  themes folder.
- **Starting a session**: [`send.ts`](/packages/server/src/runner/send.ts) stores
  `agent: adapter.kind`; with several runtimes, the session must find its adapter by that kind,
  including after a restart, when [`continuer.ts`](/packages/server/src/runner/continuer.ts) resumes
  runs.
- **Settings**: [`settings/file.rs`](/crates/core/src/settings/file.rs) parses only the `server`,
  `runs`, and `keyboard` tables, but writes keep unknown keys, so an extension's table survives an
  edit from the page.
- **Keys**: an extension's command needs a key in the registry, which throws on a conflict outside
  production; a conflict between two extensions must not break the page.
- **Sandbox**: the sandbox must not read the human's config folder
  ([sandbox](/specs/decisions/sandbox.md)), so it cannot load the human's extensions.
- **Removing or disabling an extension**: a session whose runtime came from a removed extension, a
  setting table left behind, and a key that disappears all need a defined behaviour.
- **Upgrading Uraeda**: an extension built for an older API meets a newer server.

### Rules and their owners

- **Which agent runs a session**: `main.ts` (the one adapter), copied as `agent` in each session
  row.
- **Step names**: `steps.rs`, copied in seven TypeScript files (above).
- **Check rules and templates**: the core, from the embedded skill; the
  [CLI decision](/specs/decisions/cli.md) asks that every rule be written in the skill.
- **Settings tables**: `settings/file.rs`, with categories copied in the web's `categories.ts`.

### Likely changes

- Under every option: a manifest format and its reader; an extensions folder beside the settings
  file; the server loading extensions at start; a settings category listing them; `docs/` pages; a
  new decision; the README's and `INSTALL.md`'s mentions of Claude Code.
- With the agent runtime as an extension point: `main.ts`, `dev.ts`, `sessions.ts` (an adapter per
  kind), `transcript.ts`, `instructions.ts`, `message.ts`, the web's `HarnessMark.tsx`,
  `UsageWindow.tsx`, `Setup.tsx`; benchmarks' imports.
- With server contributions: `app.ts` (mounted sub-apps), `fate.ts` and `fate/mutations.ts` (merged
  at creation), `guard.ts` and the sign-in route table (every route signed in).
- With UI contributions: `routeTable.ts`, `App.tsx`, `pages.ts`, `destinations.ts`,
  `settings/categories.ts`, `keys/`, the Vite build (shared React and Astryx), the status line.
- With core extensions in WASM: `crates/core` (a host, a WIT world), `crates/cli` and
  `crates/binding` (both embed it), `Cargo.toml`, and the release sizes.
- Tests that guard behaviour that changes: the sign-in route table test (every route), the runner's
  tests built on one `FakeAdapter`
  ([`sessions.test.ts`](/packages/server/src/runner/__tests__/sessions.test.ts)), the core's
  settings tests that reject unknown tables if any, and the package smoke test (no download at run
  time).

### Features in flight

- `change/2026-11-07-drag-handles` and `change/2026-11-07-git-changes` are finished changes that
  touch the phone's sheets and the Git page: no overlap.
- [Run options](/specs/proposals/run-options.md), blocked, adds model and effort settings per step:
  with several runtimes, these become per runtime.

## The proposal

### Three kinds, one feature

The proposal asks for core, server, and UI extensions in one feature, and says not to split it. Each
kind is built on different ground: the core in Rust, read by both the CLI and the binding; the
server in Node; the UI in the browser. A core extension point in WASM is a separate host, toolchain,
and size cost from the other two.

### Core extensions against the core's decisions

The [stack](/specs/decisions/stack.md) puts all workflow logic in the Rust core. The
[CLI decision](/specs/decisions/cli.md) says every rule the CLI checks is written in the skill, and
the release binary stays "as small as possible". Constitution V says tools "MUST only enforce rules
that humans and agents can follow unaided". A core extension adding a check rule must therefore ship
the rule's text for agents too, and Wasmtime adds 2 to 19 MB to both `ura` and the binding.

### "The references system, which is more of a skill"

The phrase reads three ways. It may mean the skill's own `references/`, the instructions of each
workflow step, made extendable: adding or replacing a step. It may mean extensions shipping agent
skills, as pi and Claude Code packages do. Or it may mean the "References (docs) querying" item of
the [priorities](/specs/PRIORITIES.md), built as an extension.

### "What existing part of the code could be made into an extension"

Candidates, from the code:

- the Claude Code runtime, already behind `Adapter`;
- the fake agent, the sandbox's and the tests';
- colour themes, as files an extension ships;
- the preview runner, a project's Storybook;
- notifications, the browser's, which a Slack extension would sit beside;
- the usage window, Claude's allowance concept.

The workflow's pages (features, inbox, git) are its product, not candidates.

### Who may load extensions, and from where

The proposal does not say. The [settings decision](/specs/decisions/settings.md) says settings and
themes are "never read from a repository", so that "no repository restyles the UI". Extensions from
a repository would run code on clone, which every compared product gates behind a trust prompt.

### Installing against the distribution decision

The [distribution decision](/specs/decisions/distribution.md) says the package "MUST NOT run install
scripts, or download anything when it runs". An install button in the web UI that fetches a git
repository or an npm package conflicts with it; an install by `ura`, or by hand, does not.

### A stable API against no compatibility before 1.0

The [compatibility decision](/specs/decisions/compatibility.md) forbids keeping old formats working
before 1.0. An extension API is a contract with code outside the repository, which every compared
product versions.

### The agents decision and third-party runtimes

The [agents decision](/specs/decisions/agents.md) says the server "MUST run the user's installed
agent, never a bundled one or the agent's SDK". A runtime extension written by someone else could
use an SDK. The rule was written for Anthropic's subscription terms, which apply to Claude Code.

## Worth it and feasibility

**Gain.** The proposal's reason: an LLM can write an extension in minutes, so the software should
take one. Without extensions, the owner's agent can still patch Uraeda's source, but each patch
conflicts with the next release. Extensions keep personal changes outside the source, and let Codex
and pi runtimes, listed in the priorities, arrive without touching the runner's core. The priorities
also name extensions as what a cooler home view needs.

**Cost.** Judgement, from the code map: the server and UI kinds need a manifest, a loader, mounted
routes and fate views, a page registry, settings and key contributions, and a shared React and
Astryx for extension code. That is a large feature, but each part has a precedent in the code (the
themes folder, the key registry, the adapter). A WASM core kind doubles it: a Wasmtime host in two
binaries, a WIT world, and a Rust toolchain for authors, against a core whose rules the CLI decision
keeps in the skill.

**Outside behaviour it relies on, not verified:**

- fate's server takes its views and mutations once, at creation; extension views could be merged
  then, but fate's client types come from a build-time Vite plugin, so extension pages may have to
  read data without fate's typing. The plan must check it first.
- An extension's UI module sharing the app's React, Astryx, and StyleX at run time: Astryx is styled
  with StyleX, compiled at build time; whether a separately built extension can use Astryx's
  components unchanged is unchecked.
- Wasmtime's size inside the napi-rs addon and its build time: undocumented; to measure if the core
  kind is kept.

**Guards it relaxes:**

- In-process server extensions: an extension can do anything Uraeda's server can, as the owner: read
  every registered repository, commit, run agents, and read the sign-in store.
- In-page UI extensions: an extension can act as the signed-in owner from the browser, calling every
  route.
- Extensions loaded from a repository: anyone whose repository the owner opens in Uraeda could run
  code on the owner's machine.

## Approaches

Criteria come from the [proposal](proposal.md) (extend easily with LLMs; core, server, and UI), the
[constitution](/specs/CONSTITUTION.md) (workflow in git and plain text; tools optional), and the
active decisions [stack](/specs/decisions/stack.md), [agents](/specs/decisions/agents.md),
[settings](/specs/decisions/settings.md), [distribution](/specs/decisions/distribution.md),
[compatibility](/specs/decisions/compatibility.md), [cli](/specs/decisions/cli.md),
[sign-in](/specs/decisions/sign-in.md), [ui-components](/specs/decisions/ui-components.md), and
[keyboard](/specs/decisions/keyboard.md).

### Purpose

What extensions are for decides trust, distribution, and API stability. See
[worth it](#worth-it-and-feasibility).

| Option                                   | Trust needed            | API stability      | Fits the priorities ("personal usage") |
| ---------------------------------------- | ----------------------- | ------------------ | -------------------------------------- |
| A. The owner's own and copied extensions | Owner reviews or writes | Can break, pre-1.0 | Yes                                    |
| B. A public ecosystem with a catalog     | Review, signing, scans  | Must hold          | Later                                  |

### Core extensions

Whether the Rust core takes extension code. See
[core extensions against the core's decisions](#core-extensions-against-the-cores-decisions) and
[WASM in a Rust host](#wasm-in-a-rust-host).

| Option                                             | Size               | Author toolchain        | CLI decision (rules in the skill)      |
| -------------------------------------------------- | ------------------ | ----------------------- | -------------------------------------- |
| A. No core extensions in this feature              | None               | —                       | Holds                                  |
| B. WASM components on Wasmtime, in CLI and binding | +2 to 19 MB, twice | Rust, `wasm32-wasip2`   | Rule text must ship with the extension |
| C. WASM run by Node only, through jco              | None in the CLI    | Rust or experimental JS | `ura check` would not run them         |

### Contributions

What a server or UI extension can add. See [what they have in common](#what-they-have-in-common).

| Option                                                                                                                | Reach                       | Cost                           |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------ |
| A. A fixed set: runtimes, settings, commands and keys, pages, panels, status items, session renderers, themes, skills | Most of what products offer | A registry per kind            |
| B. Runtimes and commands only                                                                                         | Codex and pi; small tools   | Small                          |
| C. Hooks on every event, built-ins rebuilt as extensions (DeepSeek Harness)                                           | Everything                  | A rewrite of the server and UI |

### UI isolation

How UI extension code runs. See [UI extensions in a React app](#ui-extensions-in-a-react-app).

| Option                                         | Looks like the app         | Guard relaxed                        | Breaks on upgrade       |
| ---------------------------------------------- | -------------------------- | ------------------------------------ | ----------------------- |
| A. In-page modules sharing React and Astryx    | Yes, same components       | Acts as the owner                    | React and Astryx majors |
| B. Sandboxed frames on a separate origin       | Only through CSS variables | None beyond the messages it may send | Message protocol only   |
| C. Declarative manifest only, drawn by the app | Yes                        | None                                 | Manifest format only    |

### Server isolation

How server extension code runs. See [TypeScript in Node](#typescript-in-node).

| Option                                     | Crash isolation | Guard relaxed                 | Cost                  |
| ------------------------------------------ | --------------- | ----------------------------- | --------------------- |
| A. In-process ES modules                   | None            | Everything the server can do  | Small                 |
| B. A child process per extension, over RPC | Yes             | Its own process, as the owner | A protocol, processes |

### Load sources

Where extensions load from. See [who may load extensions](#who-may-load-extensions-and-from-where).

| Option                                              | Code on clone | Settings decision |
| --------------------------------------------------- | ------------- | ----------------- |
| A. The owner's config folder only                   | Never         | Holds             |
| B. Also a repository's folder, after a trust prompt | After a yes   | Narrowed          |

### Installing

How an extension arrives in the folder. See
[installing against the distribution decision](#installing-against-the-distribution-decision).

| Option                                          | Distribution decision | Pinning          |
| ----------------------------------------------- | --------------------- | ---------------- |
| A. `ura extension add` from a path or a git URL | Holds                 | Commit, by `ura` |
| B. By hand: copy or clone into the folder       | Holds                 | Up to the owner  |
| C. From the web UI, git or npm                  | Changed               | By the server    |

### Agent runtimes

How the adapter becomes an extension point. See [important reads](#important-reads) and
[the agents decision](#the-agents-decision-and-third-party-runtimes).

| Option                                               | Proof of the API | Install burden             |
| ---------------------------------------------------- | ---------------- | -------------------------- |
| A. Claude Code a built-in extension, on the same API | Yes              | None                       |
| B. Claude Code a separate extension, installed apart | Yes              | One more step for everyone |
| C. Runtimes stay closed                              | No               | None                       |

### Skills

What "references as a skill" becomes. See
[the references system](#the-references-system-which-is-more-of-a-skill).

| Option                                               | Core change                          |
| ---------------------------------------------------- | ------------------------------------ |
| A. Extensions ship agent skills, passed to the agent | None                                 |
| B. Extensions add or replace workflow steps          | Steps, checks, and templates open up |

### API versions

See [a stable API](#a-stable-api-against-no-compatibility-before-10).

| Option                                                   | Compatibility decision |
| -------------------------------------------------------- | ---------------------- |
| A. One API version; a mismatched extension is turned off | Holds                  |
| B. Old API versions kept working                         | Changed                |

### Needs no choice

- **Lifecycle verbs** (list, enable, disable, remove): every product has them; they follow from the
  installing and settings choices.
- **Settings contributions**: the settings decision already says one TOML file; an extension's
  settings are a table in it, and secrets stay out of it.
- **Keybindings**: the keyboard decision already says every key goes through the registry.
- **Themes**: the theme format exists; an extension ships theme files in it.
- **Disposable registrations**: an implementation detail of the loader.
- **Accessibility and locales**: UI extensions using Astryx's components inherit their
  accessibility; Uraeda has no locales.
- **Performance**: the performance decision's 100 ms budget applies to pages an extension adds.
- **Offline**: extensions are local files; nothing downloads at run time.

## Not checked

- Wasmtime's build time and its size inside a napi-rs addon: no source found.
- Zellij's reason for moving to wasmi: seen only in a release-notes mirror.
- Grafana's reason for dropping its frontend sandbox: its announcement gives none.
- Secondary sources only for GlassWorm's later waves and Shai-Hulud's second wave.
- The Codex plugin manifest page and Lapce's plugin docs returned 404.
- DeepSeek Harness's release date: no primary source.
