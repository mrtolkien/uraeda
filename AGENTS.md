# Uraeda

Uraeda is a git-driven, asynchronous development workflow for coding agents. Humans write proposals,
answer questions, and approve specs. Agents investigate, ask, and write specs, plans, and code, and
every step is checkpointed as plain text in git. The project is an early proof of concept: the
workflow ships as an agent skill, and the tools come later.

It works like an asynchronous [superpowers](https://github.com/obra/superpowers), with
[Spec Kit](https://github.com/github/spec-kit)'s file names where they fit: a capable agent does the
hard work upfront, autonomously, and the human only answers the questions only they can decide and
approves specs, in files built so their time goes into thinking, not searching. It targets technical
users for now.

## A human's request stands above everything

A human's direct request stands higher than any test, decision, rule, or the constitution. Never
refuse it, never water it down, and never silently overrule it: not by reverting it, not by skipping
it, not by bending it to fit.

If a request conflicts with an existing test, a decision, or the constitution, do it anyway when it
is safe and reversible, or stop when it is not, and tell the human in the same response: what
conflicts, and what each way out costs. The human arbitrates. A test that fails because of a
requested change is the test to change or remove, after telling the human, never the request.

## Constitution

Read `specs/CONSTITUTION.md` before any work. It holds the project's principles, ordered by
priority: when two conflict, the higher one wins. Its MUST and SHOULD rules are binding, and any
conflict with them must be resolved by a human. Only a human amends it: report a problem instead of
editing it.

## Understanding the workflow

- `skills/uraeda/SKILL.md` and its `references/`: the workflow, its source of truth.
- `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/`: the reference for what good
  artifacts look like. Read it before writing or changing a template, a reference, or an example
  file.
- `README.md`: user-facing, for people discovering the project. It describes what Uraeda is and
  links into the skill and the example, with a quick install. The reference moved to its own pages:
  every way to install in `INSTALL.md`, reference for users (the web UI, the `ura` CLI, the `specs/`
  folder) in `docs/`, and building, testing, and releasing in `CONTRIBUTING.md`. The
  [documentation](specs/decisions/documentation.md) decision says what goes where: update the page a
  change makes wrong.
- `specs/PRIORITIES.md`: what is being worked on now, next, and later.
- `specs/ui/`: the web UI's guides, how its views read, behave, and look at each width. Read them
  before designing or changing a view.

## Repository layout

- `skills/uraeda/`: the Uraeda skill, harness-agnostic, following the
  [Agent Skills format](https://agentskills.io/specification)
  - `SKILL.md`: the entry point that finds the current workflow step and stops at human gates
  - `references/`: one file per workflow step, and one each for the conventions, setting up and
    starting features, and the `ura` CLI
  - `assets/templates/specs/`: artifact skeletons, at the same paths as in a user's `specs/` folder
  - `assets/example/specs/`: a filled-in example project (todo app), at the same paths
- `specs/`: Uraeda's own workflow files. Not the templates installed in users' projects.
- `crates/`: Rust, in one cargo workspace
  - `core/` (`uraeda-core`): the workflow logic, parsing, validation, and states, shared by every
    tool
  - `cli/` (`uraeda-cli`): the `ura` binary
  - `binding/` (`uraeda-binding`): the core's Node binding, built with napi-rs
  - `lsp/` (`uraeda-lsp`): the `ura lsp` language server
  - `protocol/` (`uraeda-protocol`): the messages between the Rust server and its clients
  - `server/` (`uraeda-server`): the Rust server, everything `ura serve` does
  - `vim/` (`uraeda-vim`): the Vim layer, a state machine from keys to editor commands
  - `app/` (`uraeda-app`): the app's native module `uraeda/native`, its native components, and the
    Linux host
- `app/`: the app on Native Shell, in TSX. `nsh.json` names its crate, `crates/app/`, and `App.tsx`
  is its entry. `.nsh/` there is generated, and never committed.
- `packages/`: TypeScript, in one pnpm workspace
  - `binding/`: the binding's npm package, with its generated `index.js` and `index.d.ts`
  - `server/`: the Hono server on Node, serving fate's protocol at `/fate` and the built UI
  - `web/`: the React web UI, with Astryx components and fate
  - `benchmarks/`: the runner of the benchmarks, in TypeScript, over the server's adapter
- `benchmarks/`: the benchmark's suites, cases, simulated human, and each run's record, scores, and
  specs; `packages/benchmarks/` runs them (see its [README](benchmarks/README.md))
- `fixtures/`: workflow files shared by the Rust and TypeScript tests, some broken on purpose

The [stack](specs/decisions/stack.md) and [toolchain](specs/decisions/toolchain.md) decisions say
what goes where. Code marked `TEMPORARY:` is a placeholder that a named feature replaces: change it
freely, and do not build on it.

A change to the workflow touches the skill, its templates, and the example together: a step's
reference, its template, and the example's file must agree.

Markdown files can link to any file in the repository. Write markdown links with a relative path or
a path from the repository root (`/src/...`). Humans may also write wikilinks (`[[file-name]]`).

## Native Shell (NSH)

The UI is moving to [Native Shell](https://nsh.dev) (NSH), a young framework: assume you know
nothing about it, and read before writing. The
[migration plan](specs/2026-11-10-nsh-migration/plan.md) says what is built on it, and what the
spikes measured.

- **Start here**: <https://nsh.dev/llms.txt> lists every page of the documentation with one line
  each. Every page is also served as Markdown, at its address plus `.md`.
- **For app code**: the guides are under `https://nsh.dev/docs/`, one page per element under
  `/elements/`, and one per module an app imports under `/modules/` (`nsh`, `nsh/base`,
  `nsh/desktop`, the style reference).
- **For how it works inside**: the source is at <https://github.com/longbridge/nsh>. Its `docs/dev/`
  has one page per area (`embedding.md`, `signed-packages.md`, `sandbox.md`, `rust-modules.md`,
  `shaders.md`, `editor.md`, `linux.md`, `pitfalls.md`), and its `AGENTS.md` maps the crates.
  `crates/nsh-core/` is the engine, `crates/nsh-base/` the unstyled components, and
  `crates/nsh-platform-*/` one backend each.
- **For examples**: `examples/` in that repository, with `gallery` and `gallery-rs` for every
  element in TSX and in Rust, and `embedded` and `host-echo` for a view inside a host.
- **Read the pinned version.** The migration pins NSH **0.4.0**, the release `v0.4.0`, at commit
  `e626a8dd8f8d8b277b9507cfd5ac74d0e67020f3`. NSH's Rust API changes between releases: read the
  source at that commit (`git clone --depth 1 --branch v0.4.0 https://github.com/longbridge/nsh.git`
  in a temporary folder), not at `main`. The website follows `main`.
- **Trust the source over the website** when they disagree, and a run over both: the spikes found
  pages that were out of date.

What the spikes learned, which no page says plainly:

- TSX runs in an interpreter with no JIT: put parsing, diffing, and per-key logic in Rust.
- On Linux the app ships on GTK. GPUI is NSH's backend for embedding in a GPUI app: `nsh package`
  refuses it, and it draws no backdrop blur.
- `backdropFilter` draws nothing on GTK: glass there is a `<Shader>` that samples what is behind it.
- Only TSX has WebSockets and streamed `fetch`. Rust gets whole responses.
- A view embedded on GTK has no error callback, and the process's log is NSH's runner's: a page says
  its own errors, through `ErrorBoundary`, which catches a throw while drawing, in an effect or a
  listener, and a call NSH cut off after 2 s, as `InternalError: interrupted` (ruling R207).
- An `<Image>` draws an SVG's shapes only: no text, and no CSS variable.
- On GTK a view's border is painted over what it holds: where a child stands on its parent's edge,
  the edge is a view of its own, under that child, as `Surface` draws it.
- Tests run without a display, with `nsh test`. Never open a window on the human's screen without
  asking: use the dev shell's `hidden-display`.

Running it here:

- **The pin is in four places**, which move together in one commit: `nsh`'s version and hash in
  `flake.nix`, the `nsh-*` crates in `Cargo.toml`, `minRuntime` in `app/nsh.json`, and the version
  and commit above.
- **Run `nsh` through `node scripts/nsh.ts <command>`**, as the tasks do: `vp run app:check`
  (`cargo check` of the crate, then the TSX's types), `vp run app:test` (`nsh test`, with no
  display), and `vp run app:dev`. It runs `nsh` in `app/`, builds in the repository's `target/`, and
  starts the lockfile of the workspace `nsh` generates from the repository's `Cargo.lock`. A bare
  `nsh` in `app/` builds everything again, in `app/target/`, with the newest version of every crate.
- **A window opens only on the hidden display**: `hidden-display <command>`, as in
  `hidden-display vp run app:dev`, or `hidden-display node scripts/nsh.ts test --target linux` for
  tests that draw in a GTK window and take pictures with `app.screenshot(path)`. It is an X display
  of 1400 by 800 that no screen shows, with a session bus of its own, so a notification sent there
  reaches no desktop, and shaders draw on it. It paints in software: a frame's time there is not a
  GPU's. `hidden-display --gpu <command>` draws on the machine's GPU instead, on no screen either: a
  headless Weston with its GL renderer, at 120 Hz, as `just frames` and `just bench-navigation` use.
- **`crates/app/tests/outside.rs` guards what the migration assumes of NSH on GTK**: signed
  packages, a page's errors, web views, diagrams, notifications, and the bundled fonts being the
  ones drawn. Each test starts a hidden display of its own, so
  `cargo nextest run -p uraeda-app --test outside` opens no window. Its pages are in
  `app/__checks__/`. A test that fails after an upgrade of NSH names the assumption that broke: the
  rulings R22 to R26, and R156 for the fonts, say what was built on each.
- **In a new worktree, run `vp run app:check` before `vp check`**: it writes NSH's types in
  `app/.nsh/`, without which `vp check` fails with `Invalid tsconfig`. `vp run fast` and
  `vp run ready` do it themselves.
- **A crate that takes `nsh-bundler` takes the five `rolldown_*` crates beside it** in `Cargo.toml`,
  as `crates/server/` does: NSH holds `rolldown` at 1.2.13, a new release moved those five alone,
  and `rolldown` no longer built.
- Rust 1.97.0 is the first release that builds NSH 0.4.0: its bundler's `oxc` asks for it.

## Shell

- Commands run in zsh or fish, where an unquoted glob that matches no file fails the whole command
  (`no matches found: --include=*.ts`). Quote globs, `--include='*.ts'`, or use `rg -g '*.ts'`.
- Run the toolchain inside the dev shell, `nix develop -c <command>`: outside it, `cargo nextest`,
  `just`, and other pinned tools are missing.
- The new stack's checks are recipes of the `justfile`, `nix develop -c just <recipe>`, and `just`
  lists them: `just task <crates>` after a Rust task, `just task-app` after an app task,
  `just check` after a merge, `just ready` for the full pass. They need no `vp`, `pnpm`, or `node`,
  which stay only for the old UI until the migration removes it.
- In a new worktree, the dev shell clones the `target/` of the closest checkout once, the feature's
  worktree for a task's, so the first build compiles only the workspace's crates: see
  `scripts/worktree-seed.sh`. `du` counts the clone's shared blocks; `btrfs filesystem du` does not.
- The sandbox is the Rust server over sample projects and a fake agent, without sign-in:
  `nix develop -c just sandbox` runs `ura sandbox` at http://127.0.0.1:4420, keeps its state in
  `.sandbox-next/` until `just sandbox --reset` rebuilds it, and never reads the human's folders or
  runs a real agent. `--port 0` takes a free port, `--sign-in` keeps sign-in on with a new key at
  each start, `--long-chat` adds a chat of 20,000 messages, and `--folder DIR` puts it elsewhere.
  Every screen is reviewed on it. `just sandboxed <command>` runs a command beside a fresh sandbox
  of its own, its address in `URAEDA_SANDBOX`, as the app's tests need one. Stop a sandbox you
  started by its process id.
- Every test, picture, gallery, frame, and sandbox recipe, and whatever `hidden-display` runs, goes
  through `scripts/isolated.sh`: its data, configuration, cache, and state folders are temporary,
  and the run fails when it wrote in the person's `dev.uraeda.app` or `uraeda-next` folders. Only
  `just app` and `just app-dev` run by a person use the person's folders (ruling R356).
- The app itself, `uraeda`, is `just app`: it finds this machine's server, or starts one, and stops
  the one it started as it closes. An agent runs it on the hidden display, on folders of its own:
  `hidden-display just app --data-dir <a temporary folder> --port 0`, with the agents' commands
  stood in for on its `PATH`. `just app-dev` runs the TSX with hot reload over the sandbox at 4420.
  A screen's pictures are `just app-shots <route>`, `/r/sample/inbox`, on a fresh sandbox, in
  `target/shots/app/`.
- `vp run sandbox` still serves the old web UI over the old sandbox, in `.sandbox/`, until the
  migration removes it (task 61).
- The Vite+ section at the end of this file has no markers, so `vp install` no longer rewrites it:
  it rewrote the section unwrapped, which fails the format check. Edit it by hand, or copy a newer
  version from `node_modules/vite-plus/AGENTS.md`.

## Working with the human

- Give one complete response per turn. When a subagent's result matters to the answer, such as an
  adversarial review, wait for it, act on it, and only then respond, with its findings already taken
  into account. Never send a response and then a second one when the subagent finishes.
- Keep responses short: what changed, what the human must decide, and the next action.

## Authorship

Never mention a coding agent, a model, or an AI tool as an author or a tool used: not in commit
messages (no `Co-Authored-By` lines, no "generated with" footers), not in the README, not in any
file or pull request. This applies to every coding agent working on this repository. The work is
made by its human owner, who takes the decisions an agent executes, the same way a README does not
name the code editor it was written in.

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown,
Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend
tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through
`vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for
information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a
`vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do
different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the
project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+ release. Add a tool name
to select part of the graph. For example, run `vp toolchain vite`. Use `--global` to ignore the
local `vite-plus` package. Use `vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation,
      run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include
      its output when asking for help.
