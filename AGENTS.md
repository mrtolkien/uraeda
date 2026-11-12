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
  every way to install in `INSTALL.md`, reference for users (the app, the `ura` CLI, the `specs/`
  folder) in `docs/`, and building, testing, and releasing in `CONTRIBUTING.md`. The
  [documentation](specs/decisions/documentation.md) decision says what goes where: update the page a
  change makes wrong.
- `specs/PRIORITIES.md`: what is being worked on now, next, and later.
- `specs/ui/`: the app's guides, how its views read, behave, and look at each width. Read them
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
  - `compile/` (`uraeda-compile`): TypeScript to JavaScript, for an extension's server files
  - `lsp/` (`uraeda-lsp`): the `ura lsp` language server
  - `protocol/` (`uraeda-protocol`): the messages between the Rust server and its clients
  - `server/` (`uraeda-server`): the Rust server, everything `ura serve` does
  - `text/` (`uraeda-text`): what is read in a text alone, the document tree, links, and patches,
    which the core re-exports and the app's web build takes without the core
  - `vim/` (`uraeda-vim`): the Vim layer, a state machine from keys to editor commands
  - `app/` (`uraeda-app`): the app's native module `uraeda/native`, its native components, and the
    Linux host
  - `xtask/` (`uraeda-xtask`): the repository's own tools: the start of a release, `just release`,
    and the tests of the toolchain's configuration
- `app/`: the app on Native Shell, in TSX: its screens, its component library, its client store.
  `nsh.json` names its crate, `crates/app/`, and `App.tsx` is its entry. `.nsh/` there is generated,
  and never committed.
- `benchmarks/`: the benchmark's suites, cases, simulated human, and each run's record, scores, and
  specs. Their runner went with the Node server, whose adapter it used, and waits for a port to the
  Rust server (see its [README](benchmarks/README.md))
- `fixtures/`: workflow files and recordings the tests share, some broken on purpose
- `scripts/`: the shell scripts the recipes run
- `justfile`: every check and build, as recipes

The [stack](specs/decisions/stack.md) and [toolchain](specs/decisions/toolchain.md) decisions say
what goes where. Code marked `TEMPORARY:` is a placeholder that a named feature replaces: change it
freely, and do not build on it.

A change to the workflow touches the skill, its templates, and the example together: a step's
reference, its template, and the example's file must agree.

Markdown files can link to any file in the repository. Write markdown links with a relative path or
a path from the repository root (`/src/...`). Humans may also write wikilinks (`[[file-name]]`).

## Native Shell (NSH)

The UI is built on [Native Shell](https://nsh.dev) (NSH), a young framework: assume you know nothing
about it, and read before writing. The [migration plan](specs/2026-11-10-nsh-migration/plan.md) says
what is built on it, and what the spikes measured.

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
- **Read the pinned version.** The migration pins NSH **0.5.0**, the release `v0.5.0`, at commit
  `f4d68f7f9f31eb7b3ecc8a4cbc31096d5c6238a1`. NSH's Rust API changes between releases: read the
  source at that commit (`git clone --depth 1 --branch v0.5.0 https://github.com/longbridge/nsh.git`
  in a temporary folder), not at `main`. The website follows `main`. Ruling R422 lists what 0.5.0
  changed for Uraeda, and which of NSH's limits it left.
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
- An `<Image>` draws an SVG's text in the machine's fonts, never the app's bundled ones, and no CSS
  variable: a picture of the app holds its text as shapes, as a diagram's does.
- On GTK a view's border is painted over what it holds: where a child stands on its parent's edge,
  the edge is a view of its own, under that child, as `Surface` draws it. The web paints it under
  the children.
- `nsh test`'s driver refuses a press on a view another is drawn over, a toast over a row: wait for
  what covers it to go, as a hand does.
- Tests run without a display, with `nsh test`. Never open a window on the human's screen without
  asking: use the dev shell's `hidden-display`.

Running it here:

- **The pin is in four places**, which move together in one commit: `nsh`'s version and its two
  hashes in `flake.nix` (the release's archive, and the web runtime, a component of the release),
  the `nsh-*` crates in `Cargo.toml`, `minRuntime` in `app/nsh.json`, and the version and commit
  above. A hash is what `nix store prefetch-file --hash-type sha256 <url>` prints.
- **NSH's parts are Cargo features** of `nsh-platform-linux`: shaders, the editor and the diff,
  highlighting, and the other large parts of `nsh/base`. The workspace takes its default features,
  as NSH's own runner does: without one, a shader draws nothing, or a page fails at its import. The
  backend links GStreamer, which the dev shell and a machine that runs the package hold.
- **Run `nsh` through `just nsh <command>`**, which is `scripts/nsh.sh`, as the recipes do:
  `just app-check` (`cargo check` of the crate, then the TSX's types), `just app-test` (`nsh test`,
  with no display), and `just app-dev`. It runs `nsh` in `app/`, builds in the repository's
  `target/`, and starts the lockfile of the workspace `nsh` generates from the repository's
  `Cargo.lock`. A bare `nsh` in `app/` builds everything again, in `app/target/`, with the newest
  version of every crate.
- **A window opens only on the hidden display**: `hidden-display <command>`, as in
  `hidden-display just app-dev`, or `hidden-display just nsh test --target linux` for tests that
  draw in a GTK window and take pictures with `app.screenshot(path)`. It is an X display of 1400 by
  800 that no screen shows, with a session bus of its own, so a notification sent there reaches no
  desktop, and shaders draw on it. It paints in software: a frame's time there is not a GPU's.
  `hidden-display --gpu <command>` draws on the machine's GPU instead, on no screen either: a
  headless Weston with its GL renderer, at 120 Hz, as `just frames` and `just bench-navigation` use.
- **`crates/app/tests/outside.rs` guards what the migration assumes of NSH on GTK**: signed
  packages, a page's errors, web views, diagrams, notifications, and the bundled fonts being the
  ones drawn. Each test starts a hidden display of its own, so
  `cargo nextest run -p uraeda-app -E 'test(/^outside::/)'` opens no window. Its pages are in
  `app/__checks__/`. A test that fails after an upgrade of NSH names the assumption that broke: the
  rulings R22 to R26, and R156 for the fonts, say what was built on each.
- **`just app-check` writes NSH's types in `app/.nsh/`**, which the TSX's lints and an editor read:
  in a new worktree, run it once.
- **A crate that takes `nsh-bundler` takes the five `rolldown_*` crates beside it** in `Cargo.toml`,
  as `crates/server/` does: NSH holds `rolldown` at 1.2.13, a new release moved those five alone,
  and `rolldown` no longer built.
- The toolchain is Rust 1.100.0 (`rust-toolchain.toml`), and the workspace's `rust-version` is
  1.100. NSH 0.5.0 declares 1.97, the oldest release that builds it.

## Shell

- Commands run in zsh or fish, where an unquoted glob that matches no file fails the whole command
  (`no matches found: --include=*.ts`). Quote globs, `--include='*.ts'`, or use `rg -g '*.ts'`.
- Run the toolchain inside the dev shell, `nix develop -c <command>`: outside it, `cargo nextest`,
  `just`, and other pinned tools are missing.
- Every check and build is a recipe of the `justfile`, `nix develop -c just <recipe>`, and `just`
  lists them: `just task <crates>` after a Rust task, `just task-app` after an app task,
  `just check` after a merge, `just ready` for the full pass, `just fmt` to format. The repository
  holds no Node, pnpm, or Vite+: a check that needs one is wrong. A commit is formatted by the hook
  of `.githooks/`, turned on once in a clone with `git config core.hooksPath .githooks`: it formats
  the staged text alone, and stops a commit whose file staged in part is not formatted.
- In a new worktree, the dev shell clones the `target/` of the closest checkout once, the feature's
  worktree for a task's, so the first build compiles only the workspace's crates: see
  `scripts/worktree-seed.sh`. `du` counts the clone's shared blocks; `btrfs filesystem du` does not.
- **To review UI changes in the whole app, run `nix develop -c just sandbox`**: the app, with hot
  reload, over the Rust server's sandbox, sample projects and a fake agent, without sign-in, at
  http://127.0.0.1:4420. Its state stays in `.sandbox/` until `just sandbox --reset` rebuilds it,
  and it never reads the human's folders or runs a real agent; Ctrl+C stops the app and the server.
  `--long-chat` adds a chat of 20,000 messages, `--port 0` takes a free port, `--sign-in` keeps
  sign-in on with a new key at each start, `--folder DIR` puts it elsewhere, and `--no-app` starts
  the server alone. An agent runs it inside `hidden-display` (or `hidden-display --gpu`). Every
  screen is reviewed on it. `just sandboxed <command>` runs a command beside a fresh sandbox of its
  own, its address in `URAEDA_SANDBOX`, as the app's tests need one. Stop a sandbox you started by
  its process id.
- **`just walk`** walks the whole app as one person's day, on a fresh sandbox and the hidden
  display: the steps of `app/tools/walk.test.tsx`, by keys at a desk, then by touch at a phone's
  width, then the pages that matter in light, each step a numbered picture in `target/shots/walk/`.
  `just walk 07` runs the steps whose name holds `07`. A tool to look at the app with after a fix,
  never a check.
- Every test, picture, gallery, frame, and sandbox recipe, and whatever `hidden-display` runs, goes
  through `scripts/isolated.sh`: its data, configuration, cache, and state folders are temporary,
  and the run fails when it wrote in the person's `dev.uraeda.app` or `uraeda-next` folders. Only
  `just app` and `just app-dev` run by a person use the person's folders (ruling R356).
- The app itself, `uraeda`, is `just app`: it finds this machine's server, or starts one, and stops
  the one it started as it closes. An agent runs it on the hidden display, on folders of its own:
  `hidden-display just app --data-dir <a temporary folder> --port 0`, with the agents' commands
  stood in for on its `PATH`. `just app-dev` runs the TSX with hot reload over a sandbox already
  running at 4420. A screen's pictures are `just app-shots <route>`, `/r/sample/inbox`, on a fresh
  sandbox, in `target/shots/app/`.
- **The app in a browser is `just web-build`**, which writes `target/web/`: NSH's static site of
  `app/`, with `crates/app` compiled to WebAssembly, so that crate and what it depends on must build
  for `wasm32-unknown-unknown`. `ura serve` serves the build it was compiled with
  (`URAEDA_WEB_BUILD`, as `just package` sets it), or the folder that variable names as it starts:
  `URAEDA_WEB_BUILD=$PWD/target/web just sandbox --no-app`. `just web-test` opens it in the dev
  shell's headless Chromium, `web-browser`, signs in, and writes its pictures in
  `target/shots/web/`. No other check builds the web app. `just web-shots [word]` pictures every
  page and the states a phone meets in that browser, at 390 by 844 with touch, an iPhone's safe
  area, and a keyboard laid over the page, with `report.txt` listing what is pressed and under 44
  points, in `target/shots/phone/`: a tool for the phone, never a check.
- **In a browser, a layer's content runs where it was written**: Native Shell's web runtime makes a
  component under the owner of the place its element was written, so a provider inside an overlay
  never reaches content its caller wrote. Content that declares keys in a popover or a sheet takes
  its layer's scope explicitly (`keyScope`, then `scope` on the `Popover`, `Sheet`, and `Options`),
  as `Menu` and `Select` do (ruling R478). GTK and `nsh test` do not show it.
- `ura serve` listens on 4310 by default, and keeps its files in `uraeda-next` of the system's data
  folder: the earlier server's `uraeda` is only read, by `ura import-sessions`. A test or a run of
  yours always names its own port and data folder: `--port 0 --data-dir <a temporary folder>`.

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
