---
status: answered
---

# Clarifications, round 01: Technical stack decision

> [!NOTE]
>
> Answered on 2026-10-10.
>
> - The language split is the choice everything else follows, for the life of the project: it
>   decides the binary size, the data client, and how Claude Code is driven. Each answer but one has
>   its own follow-up.
> - The recommended split, Rust behind a React UI, also recommends dropping fate from the
>   priorities' "React + Astryx + Fate" line. Its follow-up offers to keep fate over GraphQL.
> - Packaging, where files are parsed, the Rust libraries, and the layout work together: they shape
>   the skeleton's crates.
> - Four gaps in the proposal become questions: how the backend and the UI are installed, what the
>   skeleton does, which platforms are supported, and the license.
> - Eleven points are settled without you, at the end. Two concern later features and deserve a
>   look: embedding git is left to the CLI and git listener features, and pi-durable's own store
>   must fit principle III when its runtime is built.

## Context

The [proposal](proposal.md) asks which languages to use for Uraeda's CLI, backend, and web UI,
comparing all TypeScript, all Rust, and a mix, and asks for a skeleton of the three components that
builds, with one root command for every test and check. Its goals: logic shared between the CLI and
the backend, a CLI that is a small native binary, React with Astryx, a backend that drives Codex,
pi-durable, and Claude Code, and later Docker and Nix. You prefer Rust for the CLI and the backend,
and find TypeScript the obvious pick.

Today the repository holds the skill, its specs, and a Vite+ setup that formats and lints on commit
([vite.config.ts](/vite.config.ts), [package.json](/package.json)). It has no application code.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Which language for each component?

Measured locally, one Rust binary holding the CLI, an HTTP server, and an embedded UI is 2.7 MB; the
smallest realistic TypeScript binary, with Bun, is 80 MB, 30 to 37 MB to download. Codex and pi are
driven as subprocesses writing JSON lines, the same from any language. Claude Code too, except its
live approvals, hooks, and interrupts, which use a two-way protocol that only its TypeScript and
Python SDKs implement; deferred tool calls, resumed later, work from any language. fate and
pi-durable are TypeScript, and fate assumes a TypeScript server. Codex, Vite+, oxc, and Biome chose
Rust; Claude Code, Gemini CLI, opencode, and pi chose TypeScript. Two more options, napi-rs bindings
and Go, are in the discovery. More in [discovery](discovery-01.md#language-split).

Why it matters: this lasts for the life of the project, and every later feature is written in it.

- **A (recommended). Rust for the core, the CLI, and the backend, in one cargo workspace; the web UI
  in TypeScript, with React and Astryx, using types generated from the Rust ones.**
  - [pro] one small binary for the CLI and the backend; the core is shared without bindings; Rust
    enums for workflow states; your stated preference; Tauri can wrap the UI around the same core
    later.
  - [con] two toolchains: `vp check` and `vp test` no longer cover the repository, and every type
    the UI uses crosses a generated boundary; a Claude Code client of our own for live approvals;
    fate needs a GraphQL backend or is dropped (the follow-up Q1.A); pi-durable, under **Later**,
    runs as a TypeScript sidecar.
  - Why recommended: it is the only option that meets both the small binary and React with Astryx,
    and it matches your preference. Its costs fall on later features, the runner and pi-durable, and
    each has a known workaround.
- **B. All TypeScript: a core package shared by the CLI and the backend, shipped with Bun, and by
  the React UI.**
  - [pro] one language and one toolchain; the official Claude Code SDK; native fate; pi-durable in
    process; the UI can import the core; isomorphic-git pushes in-process.
  - [con] the CLI is an 80 MB binary, or an npm package that needs Node; tests run on Node while the
    binary runs on Bun; not your preference for the CLI and backend.
- **C. Rust for the core and the CLI; a TypeScript backend that calls the CLI with `--json` and
  reads its output; the React UI.**
  - [pro] a small CLI, with the official Claude Code SDK, native fate, and pi-durable in the
    backend.
  - [con] the backend needs Node or Bun installed next to the CLI; the backend reaches the shared
    logic only through the CLI's output.
- **D. All Rust, the web UI included, with Dioxus, Leptos, or Topcoat.**
  - [pro] one language for the logic and the UI.
  - [con] no Astryx: Rust component libraries are small, and the frameworks are pre-1.0, with
    breaking changes.

**Answer:** C but with napi-rs to integrate the Rust code instead. Take inspiration from oxc/vite
plus if you need.

### Q1.A: How does the React UI get its data from the Rust backend?

Only if you picked A in Q1. fate needs a TypeScript server, a Relay-style GraphQL schema, or a
custom transport that has no guide. Without fate, React apps usually fetch with TanStack Query. More
in [discovery](discovery-01.md#web-ui-data-layer).

Why it matters: it decides the contract between the backend and the UI, and whether the priorities'
"React + Astryx + Fate" line holds.

- **A (recommended). A plain JSON API, with TypeScript types generated from Rust by ts-rs, fetched
  with TanStack Query; live updates over server-sent events, added by hand when needed.**
  - [pro] the simplest contract, plain HTTP, easy to test.
  - [con] removes fate from the stack in the priorities; live views and optimistic updates are
    written by hand.
  - Why recommended: the first web UI only views files, and plain HTTP keeps the backend explicit,
    as principle VI asks. fate's strengths arrive with editing, and B stays possible then.
- **B. A Relay-style GraphQL API served with async-graphql, read by fate through its GraphQL
  transport.**
  - [pro] keeps fate, with its normalized cache and optimistic updates.
  - [con] a GraphQL schema with Relay's conventions on top of the Rust types; fate's live views over
    GraphQL were not verified with async-graphql.
- **C. fate with a custom transport over a plain JSON API.**
  - [pro] fate without GraphQL.
  - [con] no guide to custom transports: we write and maintain one against a library that changes
    fast.

**Answer:**

### Q1.B: How is the TypeScript CLI shipped?

Only if you picked B in Q1. Bun compiles 80 MB binaries for every platform from one machine. Node's
single executables, which Vite+'s `vp pack` uses, are experimental and start at 126 MB. The code
itself is under 1 MB. More in [discovery](discovery-01.md#typescript-binary).

- **A (recommended). An npm package for users who have Node, and Bun-compiled binaries, built in CI,
  for users who do not.**
  - [pro] a small install for most technical users, and no runtime needed for the others.
  - [con] two artifacts to release and test, on two runtimes.
  - Why recommended: it gives the smallest install to the users who can take it.
- **B. Bun-compiled binaries only.**
  - [pro] one artifact.
  - [con] 80 MB for every user.
- **C. `vp pack` executables, with Node's single executables.**
  - [pro] the same runtime in tests and in the binary.
  - [con] experimental, and 126 MB or more.

**Answer:**

### Q1.D: Which Rust framework for the web UI?

Only if you picked D in Q1. Dioxus targets web, desktop, mobile, and an experimental native
renderer; its team joined Cognition in September. Leptos is web-first, with small component
libraries. Topcoat, by the Tokio project, renders HTML on the server, with no WebAssembly. More in
[discovery](discovery-01.md#rust-web-ui).

- **A (recommended). Dioxus, with its first-party shadcn-style components.**
  - [pro] the only path to a native app, and the most complete component set.
  - [con] heavier on the web (115 kB compressed in the benchmark, against React's 51 kB); its team
    now has less time for it.
  - Why recommended: it keeps your "compile to native" goal open.
- **B. Leptos.**
  - [pro] about React's size, with server rendering.
  - [con] breaking changes at each minor version, and the smallest component libraries.
- **C. Topcoat.**
  - [pro] no client build, the fastest to load.
  - [con] early, version 0.10, with no native path.

**Answer:**

## Q2: How do the backend and the UI reach users?

The proposal wants the CLI installable without a package manager, and does not say how the backend
and the UI are installed. Codex, Claude Code, and Vite+'s `vp` are each a single binary. With C in
Q1, the backend is a TypeScript program next to the Rust CLI, so only B or C apply. More in
[discovery](discovery-01.md#packaging).

Why it matters: it decides what a user installs, and how the skeleton's crates fit together.

- **A (recommended). One `uraeda` binary: the CLI commands, and `uraeda serve`, which runs the
  backend and serves the built UI from inside the binary.**
  - [pro] one install, one version: the CLI and the backend never drift apart.
  - [con] the CLI carries the server and the UI, 2.7 MB plus the UI's files with Rust, about 80 MB
    with Bun; building the CLI needs the UI built first.
  - Why recommended: it is the simplest install, like the agents Uraeda drives, and costs little
    with Rust.
- **B. Two binaries: `uraeda` for the CLI, and `uraeda-server` for the backend and the UI.**
  - [pro] the CLI stays minimal.
  - [con] two installs and two versions to keep in step.
- **C. The CLI as a binary, and the backend as a container image.**
  - [pro] ready for servers and remote runners.
  - [con] Docker is required to use the UI locally.

**Answer:** The CLI is a Rust binary, the server is a Typscript program, so it's B/C.

The CLI is meant for human/coding agent usage, and the server is meant for fully autonomous
workflows. The CLI should stay relatively small. Making the server into a container image should be
trivial, but we'll develop locally with node. This aligns with my Q1: CLI only in Rust, full server
in typescript integrating a Rust module for all the workflow logic (shared with the CLI).

## Q3: Where are workflow files parsed and validated?

The CLI must validate workflow files whatever produced them
([principle V](/specs/CONSTITUTION.md#v-tools-are-optional)), and the UI must show their questions,
options, and statuses. Parsers exist in both languages, and the typed bullets and question patterns
need custom code in every one. The proposal wants the logic in the CLI and the backend. More in
[discovery](discovery-01.md#where-workflow-files-are-parsed).

Why it matters: two parsers would disagree on the same file.

- **A (recommended). The core parses and validates files into a typed model (statuses, questions,
  options, errors, with the Markdown of each part); the backend serves it, and the UI only renders
  it. With B in Q1, the UI can import the core instead.**
  - [pro] one parser, and validation in one place for the CLI, the backend, and the UI.
  - [con] the UI cannot show a file the core does not model yet, except as plain Markdown.
  - Why recommended: it keeps the logic where the proposal wants it, and the UI simple.
- **B. The UI parses the raw files itself.**
  - [pro] the UI can render any file, without waiting for the core.
  - [con] with Rust, a second parser that drifts from the first.
- **C. The Rust core compiled to WebAssembly, run in the UI.**
  - [pro] one parser, running in the browser.
  - [con] bindings and serialization to maintain, and a bundle size not measured.

**Answer:** A

## Q4: What does the skeleton do?

The proposal asks for "a basic skeleton for all 3 components that builds". The CLI and the web UI
features come right after it in the priorities, and will design their real commands and pages. More
in [discovery](discovery-01.md#the-skeletons-contents-are-open).

Why it matters: it decides whether this feature proves that the components fit together, or leaves
it to the next ones.

- **A (recommended). A thin slice wired end to end: the core reads the `status` fields of a spec
  folder, `uraeda status <folder>` prints them, the backend serves them, and a UI page lists them,
  with the generated types and the root command covering all of it.**
  - [pro] code sharing, type generation, embedding, and the checks are proven on real code.
  - [con] it starts on ground the CLI and web UI features own, which they may reshape.
  - Why recommended: the stack's risks are the seams between components, and only a wired slice
    tests them.
- **B. A hello world per component, building and tested, with nothing shared yet.**
  - [pro] every design is left to its feature.
  - [con] sharing and type generation stay untested until the next feature.

**Answer:** A, and we should pay a particular focus to how seamless the types and languages
frontiers are. If implementation is painful, we might change the approach.

## Q5: Which platforms are supported?

The proposal does not say. Rust and Bun both cross-compile to Linux, macOS, and Windows, on x64 and
arm64; macOS binaries need signing, and Nix and just are less at home on Windows. More in
[discovery](discovery-01.md#supported-platforms).

Why it matters: it sets the CI matrix now, and the release targets later.

- **A (recommended). Linux and macOS, on x64 and arm64; Windows later.**
  - [pro] a small CI matrix, and every tool considered works there.
  - [con] Windows users wait, or use WSL.
  - Why recommended: it covers the machines this project is built on, and adding Windows later
    changes the CI, not the code.
- **B. Linux, macOS, and Windows from the start.**
  - [pro] every user is covered.
  - [con] a larger CI matrix, and Windows paths and shells to handle from the first commit.
- **C. Linux only, for now.**
  - [pro] the smallest setup.
  - [con] no macOS, where many developers work.

**Answer:** A

## Q6: Under which license is Uraeda published?

The repository has no license file, and its manifests have no `license` field. Every dependency
considered is MIT, Apache-2.0, or both. Rust's API guidelines recommend the dual license "MIT OR
Apache-2.0" for compatibility with the Rust ecosystem. More in
[discovery](discovery-01.md#licenses-and-names).

Why it matters: it applies to every file from the first commit of code, and is hard to change once
others contribute.

- **A (recommended). MIT OR Apache-2.0, with both license files at the root.**
  - [pro] the Rust convention, with Apache's patent grant for those who want it.
  - [con] two license files.
  - Why recommended: it is compatible with every dependency found, in both ecosystems.
- **B. MIT only.**
  - [pro] the shortest license, common on npm.
  - [con] no explicit patent grant.
- **C. No license yet: all rights reserved, until you decide.**
  - [pro] nothing is given away early.
  - [con] nobody may legally use or contribute to the code meanwhile.

**Answer:** A

## Q7: Which Rust libraries does the skeleton start from?

Only if you picked A, C, or D in Q1. tokio and axum are the usual async runtime and HTTP framework,
clap the usual command-line parser. `serde_yaml` is deprecated, and `serde-saphyr` is the maintained
YAML crate. comrak builds a tree with positions and GitHub alerts; markdown-rs builds the same tree
as remark. More in [discovery](discovery-01.md#rust-dependencies).

Why it matters: these become the project's first dependencies, and later features build on them.

- **A (recommended). tokio and axum, clap, serde with serde-saphyr, comrak, ts-rs, and rust-embed.**
  - [pro] each is the most used or the only maintained choice, and comrak gives line numbers for
    validation errors.
  - [con] comrak's tree differs from the one remark uses, if the UI ever parses Markdown itself.
  - Why recommended: they were measured together locally, in a 2.7 MB binary.
- **B. The same, with markdown-rs instead of comrak, and specta instead of ts-rs.**
  - [pro] the core's Markdown tree has the same shape as remark's.
  - [con] markdown-rs has had no commit since April 2025, and has no alerts.
- **C. The same as A, with utoipa and openapi-typescript instead of ts-rs.**
  - [pro] an OpenAPI description of the API, usable by other clients.
  - [con] handlers carry annotations, and the types go through one more format.

**Answer:** I trust you with the specific selection of dependencies, knowing we'll use napi-rs.

## Q8: How is the repository laid out?

Vite+ and oxc keep their Rust crates in `crates/` and their TypeScript packages in `packages/`;
TypeScript monorepos often put programs in `apps/`. The skill and the specs stay where they are.
With B in Q1, everything is in `packages/`. More in [discovery](discovery-01.md#layout).

- **A (recommended). `crates/core`, `crates/cli`, and `crates/server` for Rust, and `packages/web`
  for the UI.**
  - [pro] the layout of Vite+, the toolchain this repository uses.
  - [con] the UI sits apart from the binary that embeds it.
  - Why recommended: it follows the closest precedent.
- **B. The same crates, with the UI in `apps/web`.**
  - [pro] familiar to TypeScript developers.
  - [con] `apps/` holds a single package.
- **C. One Rust crate at the root, in `src/`, and the UI in `web/`.**
  - [pro] the fewest folders.
  - [con] the core cannot be shared without splitting the crate later.

**Answer:** A with `crates` and `packages`

## Q9: Which single command runs every check?

Only if you picked A, C, or D in Q1; with B, `vp check` and `vp test` already cover everything.
`vp check` and `vp test` cannot run cargo. Vite+, oxc, Rolldown, and Biome use a `justfile`, but
just is not installed here, and can be pinned through npm. A `package.json` script run with `vp run`
needs no new tool. More in [discovery](discovery-01.md#root-command).

- **A (recommended). A `ready` script in `package.json`, run with `vp run ready`, chaining
  `vp check`, `vp test`, `cargo fmt --check`, `cargo clippy`, and `cargo test`.**
  - [pro] no new tool, and `vp` stays the only entry point in [AGENTS.md](/AGENTS.md).
  - [con] a long one-line script, with no recipe per language.
  - Why recommended: it is the smallest step from today's setup, and a `justfile` can come when the
    recipes grow.
- **B. A `justfile` with a `ready` recipe, with just pinned through the `rust-just` npm package.**
  - [pro] the pattern of Vite+, oxc, Rolldown, and Biome, with readable recipes.
  - [con] a second entry point next to `vp`.
- **C. mise tasks.**
  - [pro] parallel tasks that skip unchanged work, and pinned tools.
  - [con] a new tool that also overlaps with what Vite+ manages.

**Answer:** A

## Q10: How do contributors and agents get the toolchain?

Today only pnpm is pinned, through `devEngines`, and Vite+ manages Node. Vite+ itself ships a
`flake.nix` dev shell with Node, pnpm, and Rust. Nix environments for agents are planned under
**Later**. With B or C in Q5, Windows works without Nix. More in
[discovery](discovery-01.md#development-environment).

- **A (recommended). `rust-toolchain.toml` and Vite+, plus a `flake.nix` dev shell that CI uses to
  run the root command.**
  - [pro] every tool pinned for those who use Nix, a first step toward Nix environments, and CI
    keeps the shell working.
  - [con] slower CI, and two ways to get the tools.
  - Why recommended: it starts the Nix work the priorities plan, at the cost of a little CI time.
- **B. `rust-toolchain.toml` and Vite+ only, with Nix left to the execution environments feature.**
  - [pro] the least setup.
  - [con] the tools beyond Rust and pnpm are not pinned.
- **C. The same flake as A, not used by CI.**
  - [pro] fast CI.
  - [con] the shell can break unnoticed.
- **D. devenv instead of a flake.**
  - [pro] services, processes, and containers built from the environment.
  - [con] one more tool, and no Windows.

**Answer:** A

## Q11: What does the skeleton set up beyond local checks?

The repository is on GitHub, with no CI. `dist` generates release pipelines and installers for Rust;
Bun builds binaries for every platform. With A in Q5, CI runs on Linux and macOS. More in
[discovery](discovery-01.md#ci-and-releases).

- **A (recommended). A GitHub Actions workflow running the root command on every push and pull
  request; the release pipeline comes with the CLI feature.**
  - [pro] every change checked from the start.
  - [con] no installable binary until the CLI feature.
  - Why recommended: releasing belongs with the install experience the CLI feature designs.
- **B. CI, plus a release pipeline building binaries on every tag.**
  - [pro] installable from the skeleton on.
  - [con] installers and signing decided before the CLI exists.
- **C. Nothing yet.**
  - [pro] no setup.
  - [con] the root command is only as reliable as each contributor's habit.

**Answer:** A

## Settled without the human

- **Git integration** stays out of the skeleton, which needs no git. Embedding git, or using the
  system `git`, is decided by the CLI or git listener feature, with these findings: gix cannot push,
  libgit2 brings C and OpenSSL, and jujutsu itself runs the system `git`. See
  [discovery](discovery-01.md#git-in-the-binary).
- **pi-durable's own store**, SQLite or JSON lines, exists under every option. The pi-durable
  runtime feature treats it as temporary state that git can rebuild, as principle III allows, or
  asks you for an exception then. See
  [discovery](discovery-01.md#pi-durable-is-typescript-and-has-its-own-store).
- **Claude Code** is driven by the runner feature. Questions to the human use deferred tool calls
  resumed with `--resume`, which fit an asynchronous workflow in any language; `--bare` runs load
  the Uraeda skill with `--add-dir` or `--plugin-dir`; and Claude login for users is handled there.
  See [discovery](discovery-01.md#claude-codes-two-way-protocol).
- **Markdown rendering in the UI**, Astryx's own `Markdown` component or react-markdown with callout
  plugins, is chosen by the web UI feature. See
  [discovery](discovery-01.md#markdown-rendering-in-the-ui).
- **"Ridiculously fast"** gets its measure, load time or render time of a long spec, in the web UI
  feature. See [discovery](discovery-01.md#ridiculously-fast-has-no-measure).
- **The local backend** binds to 127.0.0.1 only and rejects requests from another origin, as the MCP
  specification requires of local servers, since it will later commit and start agents. The skeleton
  has no authentication. See [discovery](discovery-01.md#local-server-security).
- **Rust checks** are rustfmt, clippy with warnings as errors, and `cargo test`. A `rustfmt.toml`
  sets the edition, so the pre-commit hook formats staged files correctly. cargo-nextest and
  cargo-deny wait for a later need, so no license or advisory check runs yet. See
  [discovery](discovery-01.md#monorepo-tooling).
- **The Rust toolchain** is the latest stable release, pinned in `rust-toolchain.toml`, with the
  2024 edition. See [discovery](discovery-01.md#rust-binaries).
- **Names**: the binary is `ura`, and crates and packages are `uraeda-*`. Nothing is published by
  this feature; both names are free on npm and crates.io today. See
  [discovery](discovery-01.md#licenses-and-names).
- **A desktop app** stays out of the skeleton. With A in Q1, Tauri can wrap the same UI around the
  same core later. See [discovery](discovery-01.md#native-desktop-paths).
- **AGENTS.md and the README** are updated with the new layout and commands, so the checklist names
  the root command. See [discovery](discovery-01.md#likely-changes).
