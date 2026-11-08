# Discovery, round 02: Extensions system

## Why this round

The answers to [round 01](clarifications-01.md) widened the feature:

- Extensions reach everything: hooks on every event, and Uraeda's own features rebuilt as
  extensions, so a user can remove the inbox and use only proposals.
- The notes muse that Uraeda could be an orchestrator: the default workflow an extension, features
  and changes "workflow extensions", inbox and proposals "core extensions", plus docs and deploy
  extensions and hooks inside workflows. WASM core extensions are a next goal, "with the express
  goal being workflow customization".
- Local extensions must be trivial to create: Uraeda builds them. Changes must hot reload, not wait
  for a restart.
- Uraeda is past 1.0, so the compatibility decision must change.
- The feature is "more to be able to share and let it be used by other people".

This round researches workflow customization, which built-ins can become extensions, hooks, building
extensions inside Uraeda, and hot reload. [Round 01's discovery](discovery-01.md) holds the
products, isolation, and the code seams; this file links to it rather than repeating it.

## Summary

Tools with customizable workflows ship a strong default as one more package: Spec Kit's `speckit`
workflow, OpenSpec's `spec-driven` schema. The workflow is declarative data an engine reads; only
custom step types are code. Hooks are named points before and after steps, either a prompt the agent
follows or a command the tool runs. Spec Kit took two months and three releases to move git out of
its core into an opt-in extension.

In Uraeda, the workflow's kinds are encoded in the Rust core (steps, files, gates, check rules,
stages) and copied across about thirty TypeScript files. The inbox is drawn by hard-coded literals
in about fifteen web files, and read, watched, and checked by the core. No event says a step
changed.

Building extensions inside Uraeda is feasible. oxc transforms TypeScript and TSX in about 2 ms, as a
4.5 MB native package or a crate in the existing binding. A loader that evaluates modules as
functions, as Vite's module runner does, reloads without leaking memory; Node's own `import()` leaks
every version. In the browser, a reloaded extension remounts and loses its state: production React
has no hot refresh.

## How other products do it

### Spec Kit

- Six building blocks: extensions add commands, templates, and hooks; presets change templates and
  wording; workflows automate steps; step packages add executable step types; bundles install them
  together
  ([customization](https://github.com/github/spec-kit/blob/main/docs/how-to/customization.md)).
- "An extension is declarative content. It does not register Python plugins, replace CLI handlers,
  or import executable package code"
  ([design](https://github.com/github/spec-kit/blob/main/design/extension.md)).
- Hooks are `before_<command>` and `after_<command>` for every core command, mandatory or optional.
  Agents run them by reading prose in each command's template: "Emitting the block alone does not
  run the hook"
  ([tasks template](https://github.com/github/spec-kit/blob/main/templates/commands/tasks.md)).
  Priorities and conditions only work in the engine, not in the agent's path
  ([API](https://github.com/github/spec-kit/blob/main/docs/extensions/api.md)).
- Workflows are YAML: steps of types `command`, `prompt`, `shell`, `gate`, `if`, `while`, `fan-out`,
  and others. Its `speckit` and `bugfix` workflows are bundled files
  ([workflows](https://github.com/github/spec-kit/blob/main/docs/workflows/overview.md),
  [speckit](https://github.com/github/spec-kit/blob/main/workflows/speckit/workflow.yml)).
- Overlays edit an installed workflow by anchors on step ids; slots are declared extension points
  ([overlays](https://github.com/github/spec-kit/blob/main/docs/workflows/overlays.md)).
- Git left the core in stages: a bundled extension with 18 hooks in April 2026, a notice, then
  opt-in in June. The core had to gain explicit state to stop depending on git
  ([PR 1941](https://github.com/github/spec-kit/pull/1941),
  [PR 2873](https://github.com/github/spec-kit/pull/2873)).
- 110+ community extensions surfaced missing pieces: no lockfile, and two extensions writing the
  same file "silently overwrite each other"
  ([issue 2566](https://github.com/github/spec-kit/issues/2566)).

### OpenSpec

- A workflow is a `schema.yaml`: artifacts with a template, an instruction for the agent, and the
  artifacts they require. One built-in schema; `openspec schema fork` copies it to edit
  ([customization](https://github.com/Fission-AI/OpenSpec/blob/main/docs/customization.md)).
- No hooks: a community schema says to "enforce the gate with your own CI or hook".
- Its agent prompts assumed the default schema, and several releases removed hard-coded artifact ids
  ([changelog](https://github.com/Fission-AI/OpenSpec/blob/main/CHANGELOG.md)).

### BMAD Method, superpowers, Kiro

- BMAD modules are sets of skills. Customization layers TOML over each skill, with prose hooks like
  `on_complete`. "No removal. An override cannot delete a base item"
  ([customize](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/customize/customize-bmad.md)).
- superpowers has no engine: skills hand off by name, and user instructions take precedence over
  skills
  ([using-superpowers](https://github.com/obra/superpowers/blob/main/skills/using-superpowers/SKILL.md)).
- Kiro's spec types are fixed. Its hooks are JSON files with a trigger (file saved, task done, agent
  stopped, ...) and an action, a shell command or a prompt for the agent
  ([hooks](https://kiro.dev/docs/hooks/), [types](https://kiro.dev/docs/hooks/types/)).

### Workflow engines outside agents

- Jira workflows are statuses and transitions with conditions, validators, and post functions. Five
  essential post functions "cannot be deleted"
  ([advanced workflows](https://support.atlassian.com/jira-cloud-administration/docs/configure-advanced-issue-workflows/)).
  Atlassian added team-managed projects as the simpler model
  ([project types](https://support.atlassian.com/jira-work-management/docs/what-are-team-managed-and-company-managed-projects)).
- GitHub Actions: events trigger jobs, reusable workflows pinned by commit
  ([workflows](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows)).
- YouTrack workflows are JavaScript rules on issue changes
  ([quick start](https://www.jetbrains.com/help/youtrack/devportal/Quick-Start-Guide-Workflows-JS.html)).
- The inner-platform effect: a system "so customizable as to become a replica" of its platform
  ([Wikipedia](https://en.wikipedia.org/wiki/Inner-platform_effect)). "Configurability is good, but
  I'd rather have sensible defaults if I can only have one"
  ([Hacker News](https://news.ycombinator.com/item?id=8990990)).

### Hosts that build and reload extensions

- pi compiles extensions in-process with jiti. `/reload` sends `session_shutdown`, reloads, and
  sends `session_start`; its API refuses calls from a stale extension
  ([extensions](https://cdn.jsdelivr.net/npm/@mariozechner/pi-coding-agent@0.73.1/docs/extensions.md)).
- Obsidian, VS Code, and Figma ship built code; reloading disables and re-enables the extension, or
  the whole host ([hot-reload](https://github.com/pjeby/hot-reload),
  [VS Code](https://code.visualstudio.com/api/get-started/your-first-extension)).
- Raycast's `ray develop` reloads on save, and "the last successful command keeps running"
  ([CLI](https://developers.raycast.com/information/developer-tools/cli)).
- Backstage's dynamic frontend plugins need a page reload (seen only in a snippet).

### What they have in common

- A strong default shipped as one more package, and a curated core even in "everything is a plugin"
  hosts.
- The workflow as data, read by an engine; only step types are code.
- Hooks at named points, before and after steps, optional or mandatory.
- Layers that customize without forking, with an escape hatch to fork.
- Registrations that undo themselves, so a reload is clean.
- A core that stays fixed: Jira's essential functions, Linear's fixed categories.

## Standards and libraries

### Reloading server modules

All measured on Node 24.22 in a throwaway folder:

- `import(url + "?v=n")` keeps every version: 100 reloads of a 1 MB module held 100 MB more, and
  `gc()` freed none of it. Node has no API to evict a module
  ([modules](https://nodejs.org/docs/latest-v24.x/api/module.html)).
- Vite's module runner, used without a Vite server, evaluates modules as functions; 200 reloads
  stayed at 11 MB ([environment runtimes](https://vite.dev/guide/api-environment-runtimes)). Its
  transform helper is marked "Only works for Vite".
- jiti without its caches stayed flat too, at about 6 ms per reload.
- A worker per extension frees memory, at about 30 ms per restart, but every call crosses
  `postMessage`.
- `vm.SourceTextModule` is collected, but needs the `--experimental-vm-modules` flag.

### Compiling TypeScript and TSX

- Node's type stripping has no TSX and refuses `enum`
  ([TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html)).
- Sizes per platform, unpacked: oxc-transform's native package 4.5 MB; esbuild 11.4 MB, with an
  install script; rolldown 21.4 MB; jiti 1.75 MB, pure JS; sucrase 1.1 MB, pure JS. The web UI's
  package weighs about 3.5 MB ([distribution](/specs/decisions/distribution.md)).
- 48 KB of TSX transformed in 1.9 ms with oxc, 4.4 ms with esbuild, 6.5 ms with sucrase.
- oxc is also a Rust crate, `oxc_transformer` 0.157
  ([crates.io](https://crates.io/api/v1/crates/oxc_transformer)); its size inside Uraeda's binding
  is unmeasured.
- React Compiler exists only as a Babel plugin, 3.9 MB: extensions built at run time skip it.

### Sharing React and Astryx with extension pages

- Import maps must come before the first module, and Firefox rejects a second one
  ([importmap](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap),
  [multiple maps](https://web-platform-dx.github.io/web-features-explorer/features/import-maps-multiple.json)).
- Uraeda compiling extensions can instead rewrite `react` to a stable URL of the app's own copy, as
  rolldown's `output.paths` does. Measured: one React instance shared with the app. Re-exporting a
  CommonJS React needs its names listed one by one.
- Production React has no hot refresh: a reloaded page extension remounts and loses its state. The
  browser keeps each old version until the page reloads.

### Styling extension pages

- StyleX at run time needs Babel, 1.5 MB minified, and `@stylexjs/dev-runtime` is deprecated
  ([babel plugin](https://stylexjs.com/docs/api/configuration/babel-plugin/)).
- The built theme exposes 321 CSS variables, and Astryx ships precompiled components: an extension
  styles with those, without StyleX.

## The code

### Important reads

**Built-ins, by size and ties.**

Sizes are files and lines, from a count of the code.

| Built-in              | Core        | Server      | Web          | Ties outside its own code                                    |
| --------------------- | ----------- | ----------- | ------------ | ------------------------------------------------------------ |
| Inbox and triage      | 21 / 3,900  | 4 / 630     | 17 / 3,060   | Home, New page, sidebar, phone tabs, keys, commit bar, watch |
| Proposals, priorities | 20 / 4,960  | ~5 / 600    | 9 / 1,500    | Home is drawn by the priorities page; `ura next`; starts     |
| Decisions ledger      | 10 / 1,580  | 3 / 200     | 19 / 1,870   | The Approval step; setup items; the spec page                |
| Git page              | 20 / 4,340  | 6 / 820     | 23 / 3,120   | Few                                                          |
| Preview, Storybook    | 2 / 130     | 10 / 1,730  | 12 / 1,590   | The spec page's embeds                                       |
| Usage window          | —           | 1 / 205     | 3 / 195      | Claude's limits                                              |
| Notifications         | —           | 1 / 173     | 4 / 306      | Needs-you rows                                               |
| Features and changes  | ~45 / 9,700 | ~25 / 3,500 | ~80 / 12,700 | Everything                                                   |

- The inbox is drawn by literals in [destinations](/packages/web/src/destinations.ts), the
  [leader tree](/packages/web/src/keys/leaderTree.ts), the navigation pane
  ([ColumnPanes.tsx](/packages/web/src/shell/ColumnPanes.tsx)), the
  [phone tabs](/packages/web/src/shell/Tabs.tsx), the [home](/packages/web/src/home/HomeHub.tsx),
  and the [New page](/packages/web/src/NewEntries.tsx). Hiding it means turning each into a list
  that built-ins fill.
- The core reads, watches, and checks `INBOX.md` whatever the UI shows: its change hash is shared
  with the decisions check ([watch.rs](/crates/core/src/watch.rs)), its commit bar with priorities
  ([changes.rs](/crates/core/src/actions/changes.rs)), and `ura init` writes it.

**The workflow's kinds.**

- The core encodes feature and change in [`workspace.rs`](/crates/core/src/workspace.rs) (`Kind`,
  file names, statuses), [`steps.rs`](/crates/core/src/steps.rs) (17 step names, two step
  functions), [`gates.rs`](/crates/core/src/gates.rs),
  [`history/stages.rs`](/crates/core/src/history/stages.rs), and the check rules on names and
  fields.
- TypeScript copies them in about thirty files: the run messages
  ([message.ts](/packages/server/src/runner/message.ts)), the steps that start fresh sessions, pull
  request polling, needs-you rows, and the web's labels, cards, icons, stages, and New page.
- A workflow definition would carry: folder and branch names, allowed files, templates, the step
  table with a reference per step, gates, stages, the record, run messages, and UI labels.

**Events today.**

- The core's watcher reports which folders changed, not from which step to which
  ([watch.rs](/crates/core/src/watch.rs)).
- The server publishes data updates on fate's live bus ([live.ts](/packages/server/src/live.ts)).
  Its one listener registry is `onTurnDone`, used by the Storybook warmer.
- Git hooks run inside every commit, their output streamed; Uraeda defines none.
- The config folder is already watched and hot reloaded, for settings and themes
  ([settings-watch.ts](/packages/server/src/settings-watch.ts)).

**Build and serving.**

- The web build has no shared chunks, externals, or import map
  ([vite.config.ts](/packages/web/vite.config.ts)); StyleX and React Compiler run at build time
  ([vite.transforms.ts](/packages/web/vite.transforms.ts)).
- No TypeScript or JSX compiler is a run-time dependency of the server or the package.

**The compatibility decision.**

- [Compatibility](/specs/decisions/compatibility.md) applies "until Uraeda reaches version 1.0", and
  says to revisit it then. v1.0.0 was tagged on 2026-11-01; Uraeda is at 1.2.0.
- The session cache already has migrations
  ([migrations.ts](/packages/server/src/runner/migrations.ts)): the rule covers workflow files, not
  Uraeda's own data.

### The proposal's path and existing actions

- **Linking a local extension**: `ura extension add <folder>` links it; the server watches it,
  compiles on save, and reloads it. Removing the link unloads it.
- **Turning a built-in off** (with built-ins as extensions): its places, keys, panes, and data views
  unregister; its files stay on disk and in `ura check`.
- **A step changing**: today the watcher sends a folder's new state; a hook on "step reached" needs
  the server to compare the step before and after each change.
- **A run starting**: the run message comes from
  [message.ts](/packages/server/src/runner/message.ts); an instruction hook appends to it.
- **Upgrading Uraeda**: an extension stating another API version is turned off, as round 01 chose.

### Likely changes

- Under every option: a loader and its watcher in the server; registries in the web for places,
  keys, panes, home panes, New-page sections, settings categories, and pickers, replacing the
  literals listed above; the run message builder, for instruction hooks.
- With oxc in the binding: [`crates/binding`](/crates/binding/), `Cargo.toml`, and the release's
  size check.
- With built-ins as extensions: the inbox, priorities, decisions, git, preview, notification, and
  usage code moves behind the extension API, in the server and the web.
- With workflow definitions: [`steps.rs`](/crates/core/src/steps.rs),
  [`workspace.rs`](/crates/core/src/workspace.rs), the check rules, the skill, and the thirty
  TypeScript copies.
- With the compatibility change: [compatibility.md](/specs/decisions/compatibility.md).

## The proposal

### The orchestrator idea against the core's decisions

The [stack](/specs/decisions/stack.md) puts the workflow's logic in the Rust core, and the
[CLI decision](/specs/decisions/cli.md) writes every rule `ura` checks in the skill. Workflows as
extensions mean the core reads workflow definitions instead of its built-in tables, and the skill
gains a part per workflow. The answer to round 01 put core extensions next, for workflow
customization.

### Removing a built-in

"Remove the inbox from the UI" is cheap once the web's places, keys, and panes become lists. Making
the inbox an extension the core does not read means `ura`, `ura check`, and the skill learn it too.

### Hooks inside workflows

"Trigger documentation update" after a step is either code the server runs when the step changes, or
an instruction added to the agent's run. A hook that only the web UI applies is invisible to an
agent running the workflow from the CLI.

### Sharing

The notes say the feature is to let others use Uraeda and share extensions. Round 01 chose no
catalog: sharing by a git URL and `ura extension add` covers it.

## Worth it and feasibility

**Cost of the orchestrator.** Judgement, from the sizes above: the workflow's two kinds span about
150 files and 26,000 lines in three languages. Spec Kit needed months to move git out of its core.
Building the host first, then moving workflows onto it, lets the second step reuse what the first
proves.

**Outside behaviour it relies on:**

- Checked: oxc transforms TSX with the automatic runtime; a function-evaluating loader reloads
  without leaking; rewriting `react` to the app's copy shares one instance.
- Unverified: remounting a reloaded extension page in the browser; `oxc_transformer`'s size in the
  binding; the module runner outside Vite in future versions.

**Guards it relaxes:**

- Hot reload of a linked folder: whatever edits that folder, an agent session included, changes code
  the server runs as you at once.
- Prompt hooks: an extension can add instructions to every agent run.

## Approaches

Criteria: the answers and notes of [round 01](clarifications-01.md), the
[constitution](/specs/CONSTITUTION.md), and the decisions [stack](/specs/decisions/stack.md),
[cli](/specs/decisions/cli.md), [distribution](/specs/decisions/distribution.md), and
[compatibility](/specs/decisions/compatibility.md).

### Workflows as extensions

| Option                                               | Work in this feature | The next feature           |
| ---------------------------------------------------- | -------------------- | -------------------------- |
| A. Host and built-ins now, workflow definitions next | Host, built-ins      | Workflows on a proven host |
| B. Workflow definitions in this feature too          | Doubled              | —                          |

### Workflow definitions

Only with B of [workflows as extensions](#workflows-as-extensions).

| Option                               | `ura` reads it | Authors need   |
| ------------------------------------ | -------------- | -------------- |
| A. Declarative data read by the core | Yes            | TOML, markdown |
| B. WASM code                         | Yes, +2–19 MB  | Rust           |

### The core and built-in extensions

| Option                                                  | Removing the inbox                    | Cost   |
| ------------------------------------------------------- | ------------------------------------- | ------ |
| A. Places as built-in extensions, turned off one by one | Gone from the UI; files still checked | Medium |
| B. A setting that hides places, no extension API        | Hidden                                | Small  |
| C. Built-ins out of the core too, `ura` included        | Gone everywhere                       | Large  |

### Hooks

| Option                                             | Visible to CLI agents | Changes runs |
| -------------------------------------------------- | --------------------- | ------------ |
| A. Events for code, and instructions added to runs | No                    | Yes          |
| B. Events for code only                            | No                    | No           |
| C. A and blocking hooks on every action            | No                    | Yes          |

### Compiling extensions

| Option                          | Package size               | Speed  | Native |
| ------------------------------- | -------------------------- | ------ | ------ |
| A. oxc in Uraeda's Rust binding | Unmeasured, in the binding | 1.9 ms | Yes    |
| B. oxc-transform's npm package  | +4.5 MB per platform       | 1.9 ms | Yes    |
| C. jiti                         | +1.75 MB                   | Slower | No     |

### Compatibility after 1.0

| Option                                                     | Code kept for old formats |
| ---------------------------------------------------------- | ------------------------- |
| A. Same rule without "before 1.0": agents rewrite files    | None                      |
| B. Format breaks only in a major release, with a migration | Migrations                |

### Needs no choice

- **Hot reload**: a function-evaluating loader with disposable registrations, measured to not leak.
- **Styling**: Astryx components and the theme's CSS variables.
- **Sharing**: git URLs, as round 01 chose.

## Not checked

- Cordis's own source, and Raycast's build: secondary sources only.
- How Zed reloads a dev extension.
- Rolldown's native module federation status.
- No browser experiment ran: remounting is from documentation.
