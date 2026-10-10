# Discovery, round 01: Technical stack decision

## Summary

Uraeda will have three components: a CLI that sets up and maintains the `specs/` folder, an
orchestrator that listens to git and runs coding agents, and a web UI that shows the workflow files
and, later, edits them. The [proposal](proposal.md) asks to compare an all-TypeScript stack, an
all-Rust stack, and a mix of the two. It sets the goals each stack is judged on:

- logic shared between the CLI and the backend;
- a CLI that installs without a package manager, ideally as a small native binary;
- React with Astryx, for a coherent UI built fast, "ridiculously fast", maybe native later;
- a backend that drives Codex, pi-durable, and Claude Code, and later Docker and Nix;
- git, or jujutsu, embedded if possible;
- the human's preference for Rust in the CLI and backend.

The deliverable is a skeleton repository for the three components that builds, with one root command
for every test and check.

Tools of this kind split along the same line. Codex, Vite+, oxc, Rolldown, Biome, and Turborepo
chose Rust and ship small native binaries. Claude Code, Gemini CLI, opencode, and pi chose
TypeScript and either require a JavaScript runtime or ship one inside a binary of 60 to 260 MB.
Projects that pair a Rust core with a TypeScript UI, among them Vite+ itself, use one root command
and generate the TypeScript types from Rust.

Six findings shape every option:

- A TypeScript binary is never small: 62 to 86 MB with Bun, 28 to 37 MB compressed, and at least 126
  MB with Node. A Rust binary with the CLI, an HTTP server, and an embedded UI is 2.7 MB.
- Codex and pi are driven as subprocesses that write JSON lines, the same way from any language.
  Claude Code too, but its approvals, hooks, and interrupts go through a two-way protocol that only
  its TypeScript and Python SDKs implement.
- pi-durable is a TypeScript library, with no process interface.
- fate, the data client in the "React + Astryx + Fate" line of the
  [priorities](/specs/PRIORITIES.md), assumes a TypeScript server, unless the backend serves GraphQL
  or a custom transport is written.
- In Rust and JavaScript, only libgit2 and isomorphic-git push in-process; jujutsu itself runs the
  system `git` to push.
- Rust UI frameworks have no design system comparable to Astryx.

The repository has no application code today: a Markdown skill, its specs, and a Vite+ setup that
formats and lints on commit.

## How other products do it

### Codex CLI

- Codex was rewritten from TypeScript to Rust in 2025. The announcement gives four reasons: an
  install with no Node.js requirement, "frustrating or a blocker for some users"; native Linux
  sandboxing bindings; no garbage collection, so less memory; and a wire protocol so that other
  languages can drive the agent
  ([Codex CLI is Going Native](https://github.com/openai/codex/discussions/1174)). At launch the
  Rust version had fewer features than the TypeScript one
  ([InfoQ](https://www.infoq.com/news/2025/06/codex-cli-rust-native-rewrite)) **(snippet only)**.
- Today the repository is almost entirely Rust, with about 130 crates under `codex-rs/`, and the
  latest release is `rust-v0.162.1`, from 2026-10-09
  ([languages](https://api.github.com/repos/openai/codex/languages),
  [releases](https://api.github.com/repos/openai/codex/releases/latest)).
- It is still installed with `npm i -g @openai/codex`: the npm package wraps the native binary
  ([devclass](https://devclass.com/2025/06/02/node-js-frustrating-and-inefficient-openai-rewrites-ai-coding-tool-in-rust/))
  **(snippet only)**.
- Its protocol crate derives `serde`, `schemars`, and `ts-rs`, so the TypeScript types are generated
  from the Rust ones
  ([app-server-protocol/Cargo.toml](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/Cargo.toml)).

### Claude Code

- Claude Code is TypeScript and React (with Ink), run by Bun. Its team chose a stack "the model is
  very capable with", so that "Claude Code could build itself", and about 90% of its code is written
  with Claude Code
  ([Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)).
- It ships as a Bun-compiled binary: the installed version 2.1.296 is 257 MB, and contains the
  string "Bun v1.4.3 (Linux x64)" (checked locally).
- Anthropic acquired Bun in December 2025, and Bun stays MIT-licensed
  ([Anthropic](https://www.anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone)).

### pi and pi-durable

- pi, formerly `badlogic/pi-mono`, is now `earendil-works/pi`: a TypeScript toolkit with a coding
  agent CLI, an LLM API, a TUI, and the `durable`, `server`, and `env` packages
  ([GitHub API](https://api.github.com/repos/earendil-works/pi)). Pi 1.0 shipped around 2026-10-01,
  under the MIT license ([eesel](https://www.eesel.ai/blog/pi-coding-agent)) **(snippet only)**.
- `pi --mode rpc` runs the coding agent as a long-lived subprocess speaking JSON lines, for "other
  languages, isolated processes, IDEs, or custom clients"
  ([rpc.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)).
  Records are split on line feeds only: Node's `readline` also splits on U+2028 and U+2029, which
  breaks records, and Rust's `BufRead::lines` does not.
- `@earendil-works/pi-durable` 1.1.0, published 2026-10-07, is "a durable agent harness":
  conversations, model turns, tool calls, and state are written to storage (memory, SQLite, or JSON
  lines) before anything is shown, so a process that dies mid-turn resumes where it stopped. The
  README warns: "Experimental. The API changes without notice between releases." It is a library,
  with no command line or process protocol of its own
  ([README](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md),
  [npm](https://registry.npmjs.org/@earendil-works/pi-durable)).
- `@earendil-works/pi-server` is an "experimental local server that routes clients to
  application-hosted durable Sessions", over a Unix socket
  ([README](https://github.com/earendil-works/pi/blob/main/packages/server/README.md)).

### Gemini CLI and opencode

- Gemini CLI is TypeScript ([GitHub API](https://api.github.com/repos/google-gemini/gemini-cli)).
- opencode is TypeScript, with no Go left in its code
  ([languages](https://api.github.com/repos/anomalyco/opencode/languages)). Its terminal UI moved
  from Go to OpenTUI, which has a Zig core and runs on Bun
  ([Better Stack](https://betterstack.com/community/guides/scaling-nodejs/opentui-react/))
  **(snippet only)**.

### Developer tools in Rust

- Turborepo finished its move from Go to Rust for performance, stability, and to end a Go and Rust
  "sandwich", two languages in one tool. Rust enums let them replace magic strings with a type whose
  every case the compiler makes them handle
  ([Vercel](https://vercel.com/blog/finishing-turborepos-migration-from-go-to-rust)).
- Microsoft ported the Copilot runtime, the engine behind the Copilot CLI, SDK, and cloud agent,
  from about 430,000 lines of TypeScript to about 800,000 lines of Rust in 14.5 weeks, written by
  agents, for about $120,000 of tokens. On one workload, throughput went up 15.9 times and memory
  went from 1,383 MB to 126 MB. Stephen Toub calls it "not a general argument for rewriting large
  TypeScript programs", and the port had dozens of regressions: "Rust stops the agent writing memory
  unsafe code; it does not stop the agent writing the wrong program correctly"
  ([DevClass](https://www.devclass.com/devops/2026/09/19/microsoft-agentically-ports-copilot-runtime-to-rust-for-120k/5297592)).
- The other direction exists too: Prisma moved its query engine back from Rust to TypeScript over
  "skill-set gaps, deployment complexity, and runtime issues", and JetBrains warns that "every
  rewrite introduces new bugs"
  ([JetBrains](https://blog.jetbrains.com/rust/2026/08/10/rewriting-in-rust/)).
- Codex, oxc, Biome, and Rolldown are compute-heavy tools. Uraeda's backend mostly waits on
  subprocesses and files (judgement).
- The Vite+ command line, `vp`, is an 11.8 MB native binary (checked locally).

### Mixed Rust and TypeScript repositories

- **Vite+** has `Cargo.toml`, `rust-toolchain.toml`, `crates/`, `package.json`,
  `pnpm-workspace.yaml`, `packages/`, a `justfile`, and a `flake.nix` at its root
  ([repo](https://github.com/voidzero-dev/vite-plus)). Its `just ready` checks for a clean working
  tree, then runs typos, formatting, `cargo check`, the tests, clippy with `-D warnings`, and the
  docs ([justfile](https://raw.githubusercontent.com/voidzero-dev/vite-plus/main/justfile)). Its
  `package.json` scripts call into just: `"test": "vp test && just snapshot-test"`
  ([package.json](https://raw.githubusercontent.com/voidzero-dev/vite-plus/main/package.json)).
- **oxc** has the same root files, without a flake. Its `just ready` runs `pnpm install`, typos,
  code generation, formatting, checks, tests, lints, and docs
  ([justfile](https://raw.githubusercontent.com/oxc-project/oxc/main/justfile)).
- **Rolldown** splits its recipes by language: `lint-rust` (clippy, `cargo fmt --check`,
  `cargo check --locked`) and `lint-node` (`vp check` and other `vp run` tasks)
  ([justfile](https://raw.githubusercontent.com/rolldown/rolldown/main/justfile)).
- **Biome**'s `ready` recipe is "the same commands in the CI". Its `gen-types` runs
  `cargo run -p xtask_codegen --features schema -- bindings` to generate TypeScript types from Rust,
  and `ready` then checks that the working tree is clean
  ([justfile](https://raw.githubusercontent.com/biomejs/biome/main/justfile)).
- **Tauri** apps keep the frontend's `package.json` at the root and the Rust app in `src-tauri/`, "a
  normal Cargo project" ([project structure](https://v2.tauri.app/start/project-structure/)).

### What they have in common

What a stack for a tool like Uraeda is expected to provide, whether or not the proposal mentions it:

- An install that needs no language runtime: a native binary, or an npm package that wraps one.
- One way to run the product: Codex, Claude Code, and `vp` are each a single binary.
- A typed protocol between processes, with the types of the other language generated from one source
  of truth.
- One root command that runs the same checks as the CI, including a check that generated files are
  up to date.
- A pinned toolchain: `rust-toolchain.toml`, a package manager version, sometimes a Nix flake.
- A release pipeline that builds a binary per platform.
- A license, and agents driven as subprocesses, not as libraries.

## Standards and libraries

### TypeScript binaries

Measured locally, on Linux x86-64, with Bun 1.4.2 and Node 24.21:

| Build                                                       | On disk    | Compressed               | Startup |
| ----------------------------------------------------------- | ---------- | ------------------------ | ------- |
| `bun build --compile --minify`, hello world, linux-x64      | 81.3 MB    | 36.6 MB gzip, 27.6 MB xz | ~4 ms   |
| Same, darwin-arm64 / windows-x64                            | 62 / 86 MB |                          |         |
| Bun, a CLI with commander, yaml, remark, and isomorphic-git | 81.9 MB    |                          | ~52 ms  |
| Node 24 binary, the floor of any Node single executable     | 126.6 MB   |                          |         |

- In the Bun CLI, the application code adds only about 0.6 MB: that is roughly the size of the same
  CLI as a JavaScript bundle on npm, for users who already have Node (measured locally).
- Bun cross-compiles to Linux x64 and arm64 (glibc and musl), Windows, and macOS from one machine,
  and `--bytecode` speeds up startup. Its documentation says "Bun's binary is still way too big and
  we need to make it smaller". macOS binaries need code signing
  ([Bun executables](https://bun.com/docs/bundler/executables)).
- A Bun binary compiled on Nix for the host links its interpreter to a `/nix/store` path, so it does
  not run elsewhere. Releases need an explicit `--target`, which downloads the official runtime, or
  a CI build (checked locally with `ldd`).
- Vite+ runs the tooling and Vitest on Node. A Bun-compiled CLI runs on Bun, so tests would run on a
  different runtime than the shipped binary (judgement, not tried).
- `deno compile` cross-compiles to the same platforms, with musl not listed
  ([Deno docs](https://docs.deno.com/runtime/reference/cli/compile/)). Reported sizes are 58 to 70
  MB, and about 36 MB with the experimental QuickJS engine
  ([Deno example](https://docs.deno.com/examples/deno_compile/)) **(snippet only)**.
- Node single executable applications are still "Stability 1.1, Active development", and
  cross-platform builds must turn off the code cache and the snapshot
  ([Node docs](https://nodejs.org/api/single-executable-applications.html)).
- Vite+ can build an executable with `vp pack` and tsdown's `exe` option, which uses Node single
  executables, needs Node 25.7 or later, is experimental, and takes a single entry point
  ([`guide/pack.md`](/node_modules/vite-plus/docs/guide/pack.md),
  [tsdown](https://tsdown.dev/options/exe)).

### Rust binaries

Measured locally, with Rust 1.96, stripped, with link-time optimization, `opt-level = "s"`, and
`panic = "abort"`:

| Build                                                                                            | On disk | Compressed  | Startup |
| ------------------------------------------------------------------------------------------------ | ------- | ----------- | ------- |
| Hello world                                                                                      | 0.29 MB |             |         |
| The same CLI as the Bun one: clap, serde, serde_yaml_ng, comrak, and gix reading the branch      | 1.9 MB  | 0.8 MB gzip | ~1 ms   |
| The same, plus `serve`: tokio, axum, serde_json, serde-saphyr, and a UI embedded with rust-embed | 2.7 MB  | 1.2 MB gzip |         |

- The embedded UI adds its own size: a React app's built files (judgement: hundreds of kilobytes to
  a few megabytes, not measured with Astryx).
- Build times for the first CLI: 13.5 s for a clean debug build, **0.3 s** for an incremental debug
  rebuild, and 8 s for an incremental release build with link-time optimization. A clean release
  build of the second one takes 42 s, and its `target/` folder grows to hundreds of megabytes
  (measured locally).
- `dist`, formerly cargo-dist, generates the release CI and installers: a shell script, PowerShell,
  an npm wrapper, a Homebrew formula, and an MSI. Its latest release, 0.33.0, is from 2026-09-10
  ([installers](https://axodotdev.github.io/cargo-dist/book/installers/index.html),
  [releases](https://github.com/axodotdev/cargo-dist/releases)).
- `cargo-binstall` installs prebuilt binaries; 1.25.2 is from 2026-10-06 (GitHub API).
- For comparison, a Go hello world is 1.5 MB (measured locally).

### Rust building blocks

Versions from crates.io, read on 2026-10-10:

- **tokio** 1.53.2, the async runtime most Rust servers use, and **axum** 0.8.9, the Tokio project's
  HTTP framework ([tokio](https://crates.io/api/v1/crates/tokio),
  [axum](https://crates.io/api/v1/crates/axum)).
- **clap** 4.6.7, the usual command-line parser, with derive macros
  ([crates.io](https://crates.io/api/v1/crates/clap)).
- **YAML**: `serde_yaml` is deprecated (0.9.34+deprecated), `serde_yml` is "unmaintained", and
  `serde_yaml_ng` and `serde_norway` have had no release since 2024. `serde-saphyr` 1.3.0, from
  2026-09-16, is maintained, with about 7 million recent downloads, and built on the YAML 1.2 parser
  saphyr ([serde-saphyr](https://crates.io/api/v1/crates/serde-saphyr),
  [serde_yaml](https://crates.io/api/v1/crates/serde_yaml),
  [serde_yml](https://crates.io/api/v1/crates/serde_yml)). It parsed the frontmatter in the local
  test.
- **rust-embed** 8.13.0 embeds a folder, like a built UI, in the binary at compile time
  ([crates.io](https://crates.io/api/v1/crates/rust-embed)).
- **utoipa** 6.0.0 generates an OpenAPI description from Rust handlers, which **openapi-typescript**
  7.13.0 turns into TypeScript types: a typed-HTTP alternative to generating types with ts-rs
  ([utoipa](https://crates.io/api/v1/crates/utoipa),
  [openapi-typescript](https://registry.npmjs.org/openapi-typescript)).

### Coding agent interfaces

- **Claude Code**, headless ([headless](https://code.claude.com/docs/en/headless)):
  - `claude -p --output-format stream-json` streams JSON lines and ends with a `result` message. It
    supports `--resume <session_id>`, `--json-schema` for structured output, and
    `--permission-prompts none` for unattended runs.
  - The first event, `system/init`, lists capability flags like `interrupt_receipt_v1`, "to
    feature-detect instead of comparing version strings". The page describes behaviour changes
    across dozens of versions, from v2.1.205 to v2.1.295.
  - `--bare`, "the recommended mode for scripted and SDK calls", which "will become the default for
    `-p`", skips hooks, skills, plugins, MCP servers, and CLAUDE.md, and needs an API key. Skills
    still load from a folder passed with `--add-dir`, and a plugin with `--plugin-dir`. A Uraeda
    runner needs the Uraeda skill, so it would pass one of them.
  - For "structured outputs, tool approval callbacks, and native message objects", the page sends
    readers to the SDK packages.
- **Claude Agent SDK** ([overview](https://code.claude.com/docs/en/agent-sdk/overview)): official in
  TypeScript and Python only. It "runs the Claude Code binary", and other languages should "run the
  CLI as a subprocess with the `-p` flag". Tool approvals (`canUseTool`), hook callbacks, answers to
  `AskUserQuestion`, and `interrupt()` travel over a two-way protocol on stdin, documented only
  through the SDK types. Third-party products may not offer claude.ai login without approval, and
  should use API keys (same page).
- **Deferred tool calls** work from any language: a `PreToolUse` hook returns
  `permissionDecision: "defer"`, the `-p` run exits with `stop_reason: "tool_deferred"` and the
  pending call in `deferred_tool_use`, the caller collects the answer through its own interface, and
  resumes with `claude -p --resume <session-id>`. It needs a permission host, an MCP tool passed
  with `--permission-prompt-tool`, and works only with `-p`
  ([hooks](https://code.claude.com/docs/en/hooks#defer-a-tool-call-for-later)).
- Several unofficial Rust crates wrap the Claude Code CLI
  ([claude-agent-sdk](https://docs.rs/claude-agent-sdk), [rusty_claw](https://docs.rs/rusty_claw))
  **(snippet only)**, with colliding names and unchecked maintenance.
- **Codex**: the TypeScript SDK `@openai/codex-sdk` only spawns `codex exec --experimental-json` and
  reads its JSON lines
  ([exec.ts](https://github.com/openai/codex/blob/main/sdk/typescript/src/exec.ts)). The Python SDK
  drives `codex app-server`, a JSON-RPC server over stdio, WebSocket, or a Unix socket, which
  generates its own TypeScript types and JSON Schema, and is labelled experimental, "not supported
  for production workloads" ([Codex SDK](https://learn.chatgpt.com/docs/codex-sdk),
  [app-server](https://learn.chatgpt.com/docs/app-server)). `codex mcp-server` was removed. The
  Codex crates are not published (the workspace version is 0.0.0), and the `codex-*` crates on
  crates.io belong to a third-party fork
  ([crates.io](https://crates.io/api/v1/crates/codex-app-server-protocol)).
- **pi**: the RPC mode and pi-durable are described in [pi and pi-durable](#pi-and-pi-durable).

### Markdown parsers

Uraeda's files use GitHub Flavored Markdown, YAML frontmatter, Obsidian callouts, typed bullets, and
fixed heading patterns, as defined in [the skill](/skills/uraeda/SKILL.md#markdown).

- **comrak** 0.56.0 (Rust, 2026-10-06) builds a full tree with line and column positions, with front
  matter, GFM tables and task lists, GitHub alerts, and wikilinks
  ([options](https://docs.rs/comrak/latest/comrak/options/struct.Extension.html)). Its alert types
  are a fixed list of five: Note, Tip, Important, Warning, Caution. Obsidian's other types, like
  `> [!QUESTION]`, stay plain blockquotes that the code must recognize itself. It parsed this
  feature's proposal in the local test.
- **pulldown-cmark** 0.13.4 (Rust) is a stream of events, not a tree, with GFM blockquote kinds,
  YAML metadata blocks, and wikilinks
  ([options](https://docs.rs/pulldown-cmark/latest/pulldown_cmark/struct.Options.html)).
- **markdown-rs** 1.0.0 (Rust) outputs **mdast**, the same tree as remark, with positions, GFM,
  frontmatter, and MDX. Its last commit is from 2025-04
  ([repo](https://github.com/wooorm/markdown-rs)).
- **unified and remark** (TypeScript) give positions on every node. Obsidian callouts come from
  community plugins, like [rehype-callouts](https://github.com/lin-stephanie/rehype-callouts) 2.2.0
  (MIT; custom types, titles, folding, nesting); some others are GPL-3.0
  ([remark-obsidian-callout](https://www.npmjs.org/package/remark-obsidian-callout)) **(snippet
  only)**. react-markdown 10.1.0 renders this tree in React
  ([npm](https://registry.npmjs.org/react-markdown)).
- **Astryx's `Markdown` component** has its own parser, which "owns an explicit supported dialect
  rather than claiming full CommonMark or GFM conformance", with extension containers where "a
  callout holds real Markdown", a frontmatter plugin limited to unique `key: value` lines, and a
  limited adapter for synchronous Remark plugins (read in the 0.6.7 package's
  `src/Markdown/Markdown.spec.md`).
- A third-party build of comrak runs in WebAssembly: `comrak-wasm` 0.0.11, about 2.5 MB unpacked
  ([npm](https://registry.npmjs.org/comrak-wasm)).

Typed bullets (`- [pro]`) and question patterns (`## Q1:`) need custom code with every parser.

### Git and jujutsu libraries

- **gix** (gitoxide, pure Rust, 0.89) supports clone, fetch, status, commit, and revision parsing,
  but not push, checkout orchestration, merge, rebase, stash, signed commits, or hooks
  ([crate status](https://raw.githubusercontent.com/GitoxideLabs/gitoxide/main/crate-status.md)).
- **git2** 0.21.0 binds libgit2, a C library, and supports push. Its SSH and HTTPS features pull in
  libssh2 and OpenSSL ([features](https://docs.rs/crate/git2/latest/features)). libgit2 is GPLv2
  with a linking exception.
- **jujutsu** (jj 0.46.0) made running the system `git` the default for fetch and push in 0.27, "to
  fix SSH bugs … due to libgit2's limitations", and removed the libgit2 path in 0.30
  ([v0.26](https://newreleases.io/project/github/jj-vcs/jj/release/v0.26.0),
  [v0.30](https://newreleases.io/project/github/jj-vcs/jj/release/v0.30.0)) **(snippet only)**.
  `jj-lib` is on crates.io, described as a "Library for Jujutsu - an experimental version control
  system", with no stability promise ([docs.rs](https://docs.rs/jj-lib/latest/jj_lib/)).
- **isomorphic-git** 1.43.3 (JavaScript) supports commit, fetch, push, status, merge, and stash, but
  not rebase or worktrees ([commands](https://isomorphic-git.org/docs/en/alphabetic)).
  **simple-git** 4.0.2 wraps the `git` command. nodegit's last release is from 2020.
- **go-git** (Go) pushes over SSH, smart HTTP, and `file://`
  ([compatibility](https://github.com/go-git/go-git/blob/main/COMPATIBILITY.md)).

### Docker and Nix

- **Docker**: bollard 0.21.1 (Rust) and dockerode 5.0.1 (JavaScript) both talk to the Docker Engine
  API over its socket, and both have a testcontainers library
  ([bollard](https://crates.io/api/v1/crates/bollard),
  [dockerode](https://registry.npmjs.org/dockerode)). The reference devcontainer CLI is TypeScript
  ([devcontainers/cli](https://api.github.com/repos/devcontainers/cli)).
- **Dagger** has official SDKs in Go, TypeScript, and Python. Its Rust SDK is "experimental. Please
  do not use it for anything mission-critical"
  ([SDKs](https://docs.dagger.io/getting-started/api/sdk),
  [Rust README](https://github.com/dagger/dagger/blob/main/sdk/rust/README.md)).
- **Nix** has no production library in either language. snix, a Rust reimplementation, is in active
  development ([snix](https://git.snix.dev/snix/snix)) **(snippet only)**. Tools run `nix build`,
  `nix develop`, and `nix eval --json`.
- **Agent sandboxes**: Claude Code uses Seatbelt on macOS and bubblewrap on Linux, through a
  TypeScript runtime ([sandboxing](https://code.claude.com/docs/en/sandboxing),
  [sandbox-runtime](https://api.github.com/repos/anthropic-experimental/sandbox-runtime)). Codex has
  Rust crates for Linux and Windows sandboxes, with landlock and seccomp
  ([Cargo.toml](https://github.com/openai/codex/blob/main/codex-rs/Cargo.toml)). Each agent brings
  its own sandbox.

### Modeling workflow states

- In Rust, `match` on an enum must handle every case, enum variants carry their own data, and serde
  maps `#[serde(tag = "type")]` enums to JSON tagged unions. Typestate, where calls in the wrong
  state do not compile, suits states held in memory, not states read from files.
- In TypeScript, a switch over a discriminated union is exhaustive only when a rule enforces it.
  oxlint's `typescript/switch-exhaustiveness-check` does, in type-aware mode
  ([oxc](https://oxc.rs/docs/guide/usage/linter/rules/typescript/switch-exhaustiveness-check)),
  which this repository already turns on in [vite.config.ts](/vite.config.ts). Effect's
  `Match.exhaustive` makes it a type error
  ([Effect](https://effect.website/docs/code-style/pattern-matching/)).
- Workflow files are written by humans and agents, so both languages must parse and validate them at
  runtime: serde in Rust, zod 4.6.5 in TypeScript.

### Durable execution

- Temporal's Rust SDK reached 1.0 in October 2026, and its Rust core runs under the TypeScript,
  Python, .NET, and Ruby SDKs
  ([Temporal](https://temporal.io/blog/i-put-temporals-rust-sdk-1-0-on-a-conference-badge),
  [crates.io](https://crates.io/api/v1/crates/temporalio-sdk)). Restate's server is Rust, with SDKs
  in TypeScript and Rust, the Rust one "in active development"
  ([sdk-rust](https://github.com/restatedev/sdk-rust)). Inngest self-hosts as a single binary with
  SQLite ([docs](https://www.inngest.com/docs/self-hosting)).
- The constitution requires durable workflow state to be recoverable from the repository alone, and
  allows only "temporary chat state and caches" elsewhere
  ([principle III](/specs/CONSTITUTION.md#iii-asynchronous-by-default)). An engine with its own
  store, or pi-durable's SQLite and JSON lines, would be a second store, under every option.

### Git listening

- Git hooks: `post-receive` runs on the server after a push, `reference-transaction` on every ref
  update, `post-commit` locally ([githooks](https://git-scm.com/docs/githooks)).
- GitHub webhooks must be answered within 10 seconds, can be missed and redelivered, and can arrive
  twice
  ([best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)).
- Polling with `git fetch` works with any remote, without inbound network access.

### Local server security

- A local HTTP server can be reached from any website the user opens, through DNS rebinding. The MCP
  specification requires local servers to validate the `Origin` header "to prevent DNS rebinding
  attacks", and to bind to 127.0.0.1 rather than every interface
  ([MCP transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)).
- Uraeda's backend will later commit to git and start agents, so a request it accepts can change the
  repository.

### Sharing code between Rust and TypeScript

- **Types**: ts-rs 12.0.1 generates TypeScript declarations from Rust types when `cargo test` runs,
  and honours serde attributes ([repo](https://github.com/Aleph-Alpha/ts-rs)). specta's TypeScript
  export is stable and powers tauri-specta ([repo](https://github.com/specta-rs/specta)). typeshare
  (1Password) is a CLI that reads `#[typeshare]` attributes
  ([repo](https://github.com/1Password/typeshare)). schemars 1.2 generates JSON Schema
  ([crates.io](https://crates.io/api/v1/crates/schemars)). Codex uses ts-rs and schemars.
- **Code**: napi-rs builds native Node addons, with prebuilt binaries per platform, used by SWC,
  Rspack, Prisma, and Turborepo ([napi.rs](https://napi.rs/)). wasm-bindgen 0.2.129 compiles Rust
  for the browser.
- **Through the CLI**: a TypeScript process can also call the Rust CLI with a `--json` flag and
  parse its output, the way Uraeda will drive agents (judgement: no library needed, one process per
  call).
- **Drift**: projects regenerate the types in CI and fail when `git diff --exit-code` is not empty,
  as Biome's `ready` does.

### Astryx

- Meta's open-source React design system, public beta since 2026-06-28 after about 8 years of
  internal use. It is built on React 19 and StyleX, MIT-licensed, with 150+ components described as
  accessible, and templates, including an IDE-style shell and an issue tracker
  ([InfoQ](https://infoq.com/news/2026/09/meta-astryx-design-system),
  [repo](https://github.com/facebook/astryx)). The accessibility claim was not tested.
- `@astryxdesign/core` is at 0.6.7, published 2026-10-09, and has had about 1,900 versions since
  2026-06-24 ([npm](https://registry.npmjs.org/@astryxdesign/core)). Its README says "Currently in
  Beta", and InfoQ reports doubts about the long-term governance of a Meta-sponsored design system.
- It ships pre-built CSS, overrides through `className` or a typed StyleX prop, a CLI with a compact
  mode for LLM context, an MCP server, and per-component JSON manifests
  ([Better Stack](https://betterstack.com/community/guides/ai/astryx-meta-design-system.md)).
- It is DOM-only: no React Native support was found
  ([OpenReplay](https://blog.openreplay.com/first-look-astryx-meta-design-system/)) **(snippet
  only)**.

### fate

- fate, by Christoph Nakazawa, is "a modern data client for the web inspired by Relay and GraphQL":
  views co-located with components, a normalized cache, optimistic updates, live views over
  server-sent events, and React's async features. `react-fate` 1.7.7 needs React 19.2, and its
  templates use Vite+ ([README](https://raw.githubusercontent.com/nkzw-tech/fate/main/README.md),
  [fate.technology](https://fate.technology/), [npm](https://registry.npmjs.org/react-fate)).
- Its transports (same README):
  - the native protocol, served by `createFateServer` in TypeScript, as `POST /fate` with batching,
    and live views over one server-sent events connection, with no specification found for other
    languages;
  - a tRPC adapter, in TypeScript;
  - a GraphQL transport for an existing GraphQL server, which "does not require `createFateServer`",
    and expects "a schema with Relay-style object identity and pagination";
  - custom transports, mentioned in the README ("Native HTTP, tRPC, and custom transports") with a
    `supportsAliases` option, without a guide to writing one.
- Its Vite plugin reads the server's TypeScript exports to type the client.
- A Rust server could serve GraphQL with async-graphql 7.2.1
  ([crates.io](https://crates.io/api/v1/crates/async-graphql)). Whether async-graphql serves the
  protocol fate uses for live views over GraphQL was not checked.
- Without fate, the usual React data layer is TanStack Query, at 5.104.1
  ([npm](https://registry.npmjs.org/@tanstack/react-query)).

### Rust web UI frameworks

Versions from crates.io, read on 2026-10-10.

- **Dioxus** 0.7.10, with 0.8.0-alpha.1: web through WebAssembly, desktop through a webview, mobile,
  and an experimental native renderer, Blitz, that its release post calls "still very young". It has
  hot-patching of Rust code, and a shadcn-style component set added with `dx components add`, whose
  primitives crate is still 0.0.0 on crates.io
  ([release 0.7](https://dioxuslabs.com/blog/release-070),
  [components](https://github.com/DioxusLabs/components)). On 2026-09-10 its team joined Cognition,
  and said they "will naturally have less time to devote entirely to Dioxus"
  ([blog](https://dioxuslabs.com/blog/joining-cognition/)).
- **Leptos** 0.8.22, with 0.9.0-beta: fine-grained signals, server rendering, islands, server
  functions, and breaking changes at each minor version
  ([releases](https://github.com/leptos-rs/leptos/releases)). Its component libraries are small:
  thaw 0.4.8, about 600 stars; leptos-shadcn-ui 0.9.0, about 6,000 downloads
  ([thaw](https://api.github.com/repos/thaw-ui/thaw),
  [leptos-shadcn-ui](https://crates.io/api/v1/crates/leptos-shadcn-ui)).
- **Topcoat** 0.10.0, by the Tokio project, announced 2026-07-22: HTML rendered on the server, with
  reactive instructions, like HTMX, and Rust closures compiled to JavaScript for client-only
  interactions, with no WebAssembly. It copies a Tailwind component library into the project, and
  says it is early, with breaking changes expected
  ([announcement](https://tokio.rs/blog/2026-07-22-announcing-topcoat),
  [crates.io](https://crates.io/api/v1/crates/topcoat)).
- Native Rust UIs without a DOM: GPUI with gpui-component, 75+ components and Markdown rendering
  ([repo](https://github.com/longbridge/gpui-component)); Iced; Slint, GPLv3 or commercial.
  Renderers without a DOM, Blitz included, do not get the browser's accessibility tree for free
  (judgement).
- Hacker News threads point to the component gap: "Dioxus drastically lacks in ecosystem"
  ([HN](https://news.ycombinator.com/item?id=42389679)) **(snippet only)**.

### Frontend speed

Medians from js-framework-benchmark, release `chrome154`, 2026-10-04
([results](https://raw.githubusercontent.com/krausest/js-framework-benchmark/master/webdriver-ts-results/src/results.ts)):

| Framework  | Create 1,000 rows (ms) | Swap rows (ms) | Compressed size (kB) | First paint (ms) |
| ---------- | ---------------------- | -------------- | -------------------- | ---------------- |
| Solid 1.9  | 21.7                   | 12.5           | 4.5                  | 52               |
| React 19.2 | 23.6                   | 89.7           | 51.4                 | 227              |
| Leptos 0.7 | 25.1                   | 12.2           | 48.8                 | 240              |
| Dioxus 0.7 | 24.1                   | 14.6           | 114.9                | 541              |

- React's swap-rows time is a known worst case. Leptos is about React's size, Dioxus about twice.
  For a Markdown viewer, parsing, rendering, and the component library weigh more than this
  benchmark (judgement).
- React 19.3.0 is current, and the React Compiler 1.0 is stable
  ([React blog](https://react.dev/blog/2025/10/07/react-compiler-1)). Vite 8 bundles with Rolldown
  ([Vite 8](https://vite.dev/blog/announcing-vite8)), and the React Compiler now runs through Oxc,
  about 12 to 15 times faster than Babel
  ([VoidZero](https://voidzero.dev/posts/whats-new-aug-2026)).

### Native desktop paths

- **Tauri 2** (2.12.2) wraps a web frontend in the system webview, with a Rust core reached over
  IPC; a minimal app is under 600 KB ([Tauri](https://v2.tauri.app/start/),
  [architecture](https://v2.tauri.app/concept/architecture/)). On Linux it uses WebKitGTK, with
  known rendering issues on NVIDIA
  ([Linux graphics](https://v2.tauri.app/develop/debug/linux-graphics/)) **(snippet only)**.
- **Electron** 44.7.0 bundles Chromium ([npm](https://registry.npmjs.org/electron)).
- React Native for desktop lags behind core React Native, and Lynx does not run DOM libraries like
  Astryx ([lynxjs.org](https://lynxjs.org/)). Since Astryx is DOM-only, a native Astryx app would be
  a webview shell (judgement).

### Monorepo tooling

- **Vite+** (local docs, `node_modules/vite-plus/docs`):
  - `vp run` runs shell commands as tasks, with dependencies between tasks, and inlines nested
    `vp run` calls ([`config/run.md`](/node_modules/vite-plus/docs/config/run.md),
    [`guide/run.md`](/node_modules/vite-plus/docs/guide/run.md)). Tasks defined in `vite.config.ts`
    are cached by recording every file they read and write, and archiving their outputs;
    `package.json` scripts are not cached by default, and a task can set `cache: false`.
  - `vp check` (format, lint, types) and `vp test` (Vitest) are built-in commands that cannot be
    extended with other steps ([`config/check.md`](/node_modules/vite-plus/docs/config/check.md),
    [`guide/test.md`](/node_modules/vite-plus/docs/guide/test.md)).
  - `vp staged` runs a command per glob on the staged files, with their paths as arguments, as
    [vite.config.ts](/vite.config.ts) does today.
  - CI: `voidzero-dev/setup-vp`, then `vp install`, `vp check`, `vp test`, `vp build`
    ([`guide/ci.md`](/node_modules/vite-plus/docs/guide/ci.md)).
  - Node is needed under every option: Vite+, Oxfmt, and Oxlint format and lint the Markdown.
- **just** has no cache, and is the root command of Vite+, oxc, Rolldown, and Biome (see
  [mixed repositories](#mixed-rust-and-typescript-repositories)). It is not installed on this
  machine; the npm package `rust-just` 1.57.0 ships it, so `vp install` could pin it
  ([npm](https://registry.npmjs.org/rust-just)).
- **mise** tasks run dependencies in parallel, skip unchanged work, and install pinned tools first
  ([mise](https://mise.jdx.dev/tasks/)). **moon** supports Cargo and pnpm with hash-based caching
  ([moon](https://moonrepo.dev/docs)). **Nx** with a community Rust plugin needs a `project.json`
  per crate and explicit cache inputs
  ([Nx blog](https://nx.dev/blog/polyglot-nx-monorepo-rust-tanstack)). **Turborepo**'s native Cargo
  support is an experimental canary, and still requires the Rust toolchain for JavaScript-only
  commands ([RFC](https://github.com/vercel/turborepo/discussions/13415)).
- **Rust checks**: `cargo fmt` formats the workspace and takes no file paths; plain `rustfmt <file>`
  defaults to the 2015 edition unless a `rustfmt.toml` sets one (checked locally with rustfmt
  1.9.0). cargo-nextest runs tests up to three times faster but not doctests
  ([nexte.st](https://nexte.st/)); cargo-deny checks advisories, licenses, and sources
  ([docs](https://embarkstudios.github.io/cargo-deny/)); `Swatinem/rust-cache` caches dependencies
  in CI ([repo](https://github.com/Swatinem/rust-cache)).
- **Nix**: Vite+'s `flake.nix` provides Node, pnpm, just, and a Rust toolchain read from
  `rust-toolchain.toml`
  ([flake.nix](https://raw.githubusercontent.com/voidzero-dev/vite-plus/main/flake.nix)). devenv 2.4
  adds services, processes, git hooks, and OCI containers built from the environment, and recommends
  its own CLI over flakes ([devenv](https://devenv.sh/),
  [flakes guide](https://devenv.sh/guides/using-with-flakes/)). Nix runs on Linux and macOS, not
  natively on Windows.
- This repository pins only pnpm 12.9.1, through `devEngines` in [package.json](/package.json). pnpm
  12 is the Rust rewrite, stable since 2026-08-26
  ([xenospectrum](https://xenospectrum.com/en/pnpm-12-rust-rewrite-stable-release/)) **(snippet
  only)**.

### Licenses and names

- The repository has no license file, and [package.json](/package.json) has no `license` field.
- The dependencies found are MIT, Apache-2.0, or both, apart from libgit2 (GPLv2 with a linking
  exception), Slint (GPLv3 or commercial), and some remark callout plugins (GPL-3.0). The Rust
  ecosystem's convention is the dual license "MIT OR Apache-2.0"
  ([Rust API guidelines](https://rust-lang.github.io/api-guidelines/necessities.html#crate-and-its-dependencies-have-a-permissive-license-c-permissive)),
  which recommends it to "crates that simply need the maximum compatibility with the Rust
  ecosystem", with `LICENSE-MIT` and `LICENSE-APACHE` files at the root.
- The name `uraeda` is free on npm and on crates.io today: both registries return 404
  ([npm](https://registry.npmjs.org/uraeda), [crates.io](https://crates.io/api/v1/crates/uraeda)).

### Agents writing Rust and TypeScript

- SWE-bench Multilingual, about 43 tasks per language, resolves 58.14% of Rust tasks and 34.88% of
  JavaScript and TypeScript tasks, with different repositories per language, so it is not a
  controlled comparison ([SWE-bench](https://www.swebench.com/multilingual.html)).
- An analysis of Multi-SWE-bench finds low rates for TypeScript, Go, and Rust alike, and argues that
  training data and a fast feedback loop matter more than the language
  ([yage.ai](https://yage.ai/share/ai-language-choice-en-20260528.html)) **(snippet only)**.
- Generation-only studies find that most Rust failures are compile errors
  ([arXiv 2411.13990](https://arxiv.org/pdf/2411.13990)) **(snippet only)**. In an agent loop, a
  compile error is fast feedback, not a shipped bug (judgement).
- Claude Code's team chose TypeScript because the model writes it well
  ([Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)). The
  Dioxus team writes that "LLM code generation got really, really good at writing Rust"
  ([blog](https://dioxuslabs.com/blog/joining-cognition/)). Fast-moving libraries, like Leptos and
  Astryx, are where agents fall back to outdated APIs (judgement).

## The code

### Important reads

- [`package.json`](/package.json): a private package with `vite-plus` as its only dependency, pnpm
  12.9.1 pinned through `devEngines`, and `vp config` on install.
- [`pnpm-workspace.yaml`](/pnpm-workspace.yaml): a catalog and overrides, with no `packages:` yet.
- [`vite.config.ts`](/vite.config.ts): `vp check --fix` on staged files, Oxlint with type-aware
  rules and type checking, and Oxfmt with `proseWrap: "always"` for the Markdown.
- [`.vite-hooks/pre-commit`](/.vite-hooks/pre-commit): runs `vp staged`.
- [`AGENTS.md`](/AGENTS.md): the Vite+ instructions, `vp check` and `vp test` before every change,
  and the authorship rule.
- [`skills/uraeda/`](/skills/uraeda/SKILL.md): the workflow, with its templates and example. The CLI
  and the web UI will read and validate the files it defines, and tools must validate artifacts
  whatever produced them ([principle V](/specs/CONSTITUTION.md#v-tools-are-optional)).
- [`specs/PRIORITIES.md`](/specs/PRIORITIES.md): next come a CLI for setup and upkeep, a web UI to
  view workflow files ("React + Astryx + Fate"), a Claude Code runner, a git listener, user pings,
  then Nix and Docker environments and a pi-durable runtime.
- [`specs/drafts/web-ui.md`](/specs/drafts/web-ui.md): the web UI renders the skill's Markdown
  flavour with structured items, and later sets `status` fields and commits.
- The git remote is `github.com/mrtolkien/uraeda`, and recent commits are all workflow and skill
  changes (`git log`): no code has existed yet.

### The proposal's path and existing actions

- **Installing**: today there is nothing to install besides the skill. With Rust, the CLI and the
  backend can be one binary of a few megabytes; with Bun, one binary of about 80 MB; a TypeScript
  backend next to a Rust CLI needs Node or Bun at runtime.
- **Committing**: the pre-commit hook runs `vp check --fix` on every staged file. Rust files need a
  formatter in the same hook.
- **Checking**: `vp check` and `vp test` are the commands named in [AGENTS.md](/AGENTS.md). With
  Rust in the repository, they no longer cover everything, and AGENTS.md changes with the root
  command.
- **Changing a type the UI uses**: in one language, a renamed field is one type error. Across Rust
  and TypeScript, it is a Rust change, a type regeneration, and a drift check, then the UI.
- **Formatting the specs**: Oxfmt formats the Markdown under every option.

### Likely changes

- [`package.json`](/package.json) and [`pnpm-workspace.yaml`](/pnpm-workspace.yaml): a workspace
  package for the web UI under every option, and for the core, the CLI, and the backend with
  [all TypeScript](#language-split).
- `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `rustfmt.toml`, `crates/`: with every option
  that has Rust.
- [`vite.config.ts`](/vite.config.ts): tasks, and a Rust formatter in `staged`.
- A root command: a `ready` script, a `justfile`, or `mise.toml`, see
  [the root command](#root-command).
- `.github/workflows/`: CI, and a release pipeline, see [CI and releases](#ci-and-releases).
- `flake.nix` or `devenv.nix`, see [the development environment](#development-environment).
- `LICENSE`, and a `license` field in every manifest.
- [`AGENTS.md`](/AGENTS.md) and [`README.md`](/README.md): the layout, the commands, and the
  toolchain.
- `specs/decisions/`: the first decisions of the project.

## The proposal

### The smallest TypeScript binary is 62 MB

The proposal wants a CLI that installs without a package manager, "ideally" a small native binary,
and finds TypeScript "the obvious pick". A realistic Bun binary is 80 MB on disk, 30 to 37 MB to
download, about 30 times the Rust equivalent (see [TypeScript binaries](#typescript-binaries)). A
TypeScript CLI meets "without a package manager", not "small". For users who already have Node, it
can also ship as a JavaScript package of under 1 MB.

### Packaging the backend and the UI

"Simple to install even without a package manager" is written about the CLI, and the proposal does
not say how the backend and the UI reach users: inside the CLI binary, as a second binary, or as a
service. The answer depends on the languages: one Rust binary can hold all three, a TypeScript
backend needs a JavaScript runtime (see
[the proposal's path](#the-proposals-path-and-existing-actions)).

### fate assumes a TypeScript server

[PRIORITIES.md](/specs/PRIORITIES.md) names a "React + Astryx + Fate" stack for the web UI. fate's
native protocol and its type wiring need a TypeScript server; a Rust backend would serve a
Relay-style GraphQL schema, or the UI would use a custom transport, or another data layer (see
[fate](#fate)).

### pi-durable is TypeScript, and has its own store

The proposal says the backend "will need to interface with" pi-durable. pi-durable is a TypeScript
library, with no process interface, and experimental: a Rust backend would run it in a TypeScript
sidecar process. Under every option, its storage, SQLite or JSON lines, is a second store, which the
constitution allows only as temporary state or a cache
([principle III](/specs/CONSTITUTION.md#iii-asynchronous-by-default)). The runtime itself is listed
under **Later** in the priorities.

### Claude Code's two-way protocol

The backend will drive Claude Code. One-shot runs work from any language, and so do deferred tool
calls with `--resume`. Live approvals, hooks, and interrupts need the two-way protocol that only the
official SDKs implement (see [coding agent interfaces](#coding-agent-interfaces)). "Ping user when
input is needed" is under **Next** in the priorities.

### Git in the binary

The proposal would like git, or jujutsu, in the binary, "not vital". Pure-Rust gix cannot push,
libgit2 can but brings C and OpenSSL, isomorphic-git can in TypeScript, and jujutsu itself runs the
system `git` to fetch and push (see [Git and jujutsu libraries](#git-and-jujutsu-libraries)). The
skeleton does not use git, and the git listener and CLI features will know which operations they
need.

### "Compile to native" has two meanings

A desktop app around the web UI, with Tauri or Electron, works with React and Astryx. Native
rendering, without a webview, rules out Astryx, which is DOM-only (see
[native desktop paths](#native-desktop-paths)).

### The skeleton's contents are open

The deliverable is a skeleton that builds, with "a single command at root to run all tests and
checks, ...". The proposal does not say what the CLI, backend, and UI skeletons do, whether they are
wired together, or whether the skeleton includes CI, a release pipeline, a Nix environment, or a
license. The next two items of the priorities, the CLI and the web UI, start right after it.

### Supported platforms

The proposal does not say which platforms Uraeda supports. Linux, macOS, and Windows, on x64 and
arm64, decide the CI matrix, the release targets, macOS signing, and whether Nix and just fit every
contributor (see [monorepo tooling](#monorepo-tooling)).

### "Ridiculously fast" has no measure

The proposal wants the frontend "ridiculously fast". Nothing says what to measure: load time, bundle
size, or the time to render a long spec.

### Claude login for third-party products

The Agent SDK's terms forbid offering claude.ai login in third-party products without approval (see
[coding agent interfaces](#coding-agent-interfaces)). This concerns how Uraeda will run Claude Code
for its users, later, whatever the language.

## Approaches

Criteria come from the [proposal](proposal.md): shared logic between the CLI and the backend, a
small native CLI, React and Astryx, the agent and environment integrations, and the human's
preference for Rust; from the constitution: plain text in git as the durable store
([II](/specs/CONSTITUTION.md#ii-git-and-plain-text-first),
[III](/specs/CONSTITUTION.md#iii-asynchronous-by-default)), tools that validate artifacts whatever
produced them ([V](/specs/CONSTITUTION.md#v-tools-are-optional)), and explicit, simple code
([VI](/specs/CONSTITUTION.md#vi-code-is-checked-against-the-spec)); and from the existing toolchain,
Vite+.

### Language split

Which language each component is written in. Relies on [TypeScript binaries](#typescript-binaries),
[Rust binaries](#rust-binaries), [coding agent interfaces](#coding-agent-interfaces),
[Rust web UI frameworks](#rust-web-ui-frameworks), [fate](#fate), and
[sharing code](#sharing-code-between-rust-and-typescript).

| Option                                                                           | Binary                                                    | Shared logic                           | React and Astryx                              | Claude Code                                            | pi-durable         | Git push in-process | Languages                       | Human's preference |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------- | --------------------------------------------- | ------------------------------------------------------ | ------------------ | ------------------- | ------------------------------- | ------------------ |
| A. Rust core, CLI, and backend; React UI                                         | 2.7 MB for all, plus the UI                               | Core crate; types generated for the UI | Yes; fate needs GraphQL or a custom transport | Own client for the two-way protocol, or deferred calls | TypeScript sidecar | Only with git2      | Rust and TypeScript             | Yes                |
| B. All TypeScript: core, CLI and backend (Bun), React UI                         | ~80 MB, 30–37 MB compressed; or a <1 MB npm package       | Core package, also usable by the UI    | Yes, with native fate                         | Official SDK                                           | In process         | isomorphic-git      | TypeScript                      | No                 |
| C. Rust core and CLI; TypeScript backend calling the CLI's JSON output; React UI | 2 MB CLI, plus a backend needing Node or Bun              | Through the CLI's output               | Yes, with native fate                         | Official SDK                                           | In process         | Only with git2      | Rust and TypeScript             | Partly             |
| D. All Rust, UI included                                                         | Small                                                     | Core crate, UI included                | No                                            | Own client, or deferred calls                          | TypeScript sidecar | Only with git2      | Rust, plus Node for the tooling | Yes                |
| E. Rust core and CLI; TypeScript backend calling the core through napi-rs        | 2 MB CLI, plus a backend needing Node, with native addons | Core crate, through bindings           | Yes, with native fate                         | Official SDK                                           | In process         | Only with git2      | Rust and TypeScript             | Partly             |
| F. Go core, CLI, and backend; React UI                                           | Small                                                     | Go package                             | Yes; fate needs GraphQL                       | Own client                                             | TypeScript sidecar | go-git              | Go and TypeScript               | No                 |

Docker and Nix weigh the same under every option (see [Docker and Nix](#docker-and-nix)). Go has no
sum types like Rust's enums, and was not researched further.

### Rust web UI

Only with option D of [language split](#language-split). Relies on
[Rust web UI frameworks](#rust-web-ui-frameworks) and [frontend speed](#frontend-speed).

| Option     | Components                    | Rendering                     | Native path            | Stability                   |
| ---------- | ----------------------------- | ----------------------------- | ---------------------- | --------------------------- |
| A. Dioxus  | First-party shadcn-style set  | WebAssembly, webview, Blitz   | Desktop, mobile, Blitz | Team now at Cognition       |
| B. Leptos  | thaw, leptos-shadcn-ui: small | WebAssembly, server rendering | Tauri                  | Breaking changes each minor |
| C. Topcoat | Tailwind set copied in        | Server HTML, no WebAssembly   | None announced         | Early, 0.10                 |

### TypeScript binary

Only with option B of [language split](#language-split). Relies on
[TypeScript binaries](#typescript-binaries).

| Option                                                      | Install                   | Size             | Runtime in tests vs shipped |
| ----------------------------------------------------------- | ------------------------- | ---------------- | --------------------------- |
| A. `bun build --compile` per platform                       | One binary                | ~80 MB           | Node vs Bun                 |
| B. An npm package, plus Bun binaries for users without Node | `npm i -g`, or one binary | <1 MB, or ~80 MB | Node, or Bun                |
| C. `vp pack` with `exe`, Node single executables            | One binary                | 126 MB+          | Node, experimental          |

### Web UI data layer

Only with options A, D, or F of [language split](#language-split). How the React UI gets its data
from a backend that is not TypeScript. Relies on [fate](#fate),
[Rust building blocks](#rust-building-blocks), and
[sharing code](#sharing-code-between-rust-and-typescript).

| Option                                                                       | Backend work       | Typed client    | Live updates                                             | fate | Documented             |
| ---------------------------------------------------------------------------- | ------------------ | --------------- | -------------------------------------------------------- | ---- | ---------------------- |
| A. JSON API with types generated by ts-rs, TanStack Query                    | Plain handlers     | ts-rs           | Server-sent events, by hand                              | No   | Yes                    |
| B. JSON API described by utoipa, types by openapi-typescript, TanStack Query | Annotated handlers | OpenAPI         | By hand                                                  | No   | Yes                    |
| C. Relay-style GraphQL with async-graphql, fate's GraphQL transport          | A GraphQL schema   | GraphQL to fate | fate live views, if async-graphql speaks fate's protocol | Yes  | Yes, except live views |
| D. fate with a custom transport over a plain JSON API                        | Plain handlers     | Written by hand | By hand                                                  | Yes  | No guide               |

### Packaging

How the backend and the UI reach users. Relies on [Rust binaries](#rust-binaries),
[Rust building blocks](#rust-building-blocks), and
[packaging the backend and the UI](#packaging-the-backend-and-the-ui).

| Option                                                                                                       | Rust               | TypeScript             |
| ------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------- |
| A. One `uraeda` binary: the CLI commands, plus `uraeda serve` running the backend with the built UI embedded | 2.7 MB plus the UI | ~80 MB with Bun        |
| B. Two binaries: `uraeda` and `uraeda-server`, the server holding the UI                                     | Two small binaries | Two binaries of ~80 MB |
| C. The backend as a container image                                                                          | Small image        | Node image             |

With option C or E of [language split](#language-split), the backend is a TypeScript program next to
a Rust CLI, so only B or C apply.

### Where workflow files are parsed

Which component turns Markdown files into questions, options, statuses, and validation errors.
Relies on [Markdown parsers](#markdown-parsers), [Astryx](#astryx), and
[principle V](/specs/CONSTITUTION.md#v-tools-are-optional), which asks tools to validate artifacts.

| Option                                                                                                                                   | Parsers                                                            | Validation                                     | UI work                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- | -------------------------- |
| A. The core parses and validates files into a typed model, which the backend serves; the UI renders the model and its Markdown fragments | One                                                                | In the core, shared by the CLI and the backend | Rendering only             |
| B. The UI parses the raw files itself                                                                                                    | Two with Rust; one with all TypeScript, if the UI imports the core | In two places with Rust                        | Parsing and rendering      |
| C. The Rust core compiled to WebAssembly, run in the UI                                                                                  | One                                                                | In the core                                    | Bindings and serialization |

### Markdown rendering in the UI

Only with a React UI. Relies on [Markdown parsers](#markdown-parsers) and [Astryx](#astryx).

| Option                                                                                 | Callouts and typed bullets             | Look                    | Dialect      |
| -------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------- | ------------ |
| A. Astryx `Markdown` with custom extension plugins                                     | Custom plugins                         | Astryx, by construction | Astryx's own |
| B. react-markdown with remark-gfm and rehype-callouts, rendered with Astryx components | Callouts from a plugin, bullets custom | Astryx, by mapping      | Full GFM     |

### Rust dependencies

Only with an option that has Rust. The libraries the skeleton starts from. Relies on
[Rust building blocks](#rust-building-blocks), [Markdown parsers](#markdown-parsers), and
[sharing code](#sharing-code-between-rust-and-typescript).

| Need                   | Options                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Async runtime and HTTP | tokio and axum; no real alternative found with the same reach                                              |
| Command line           | clap                                                                                                       |
| YAML                   | serde-saphyr (maintained), serde_yaml_ng (no release since 2024), serde_yaml (deprecated)                  |
| Markdown               | comrak (tree, positions, GitHub alerts); markdown-rs (mdast, same tree as remark); pulldown-cmark (events) |
| Types for the UI       | ts-rs; specta; utoipa with openapi-typescript                                                              |
| Embedding the UI       | rust-embed                                                                                                 |

### Layout

Where each component lives in the repository. Relies on
[mixed repositories](#mixed-rust-and-typescript-repositories).

| Option                                | Rust                                         | TypeScript     | Precedent            |
| ------------------------------------- | -------------------------------------------- | -------------- | -------------------- |
| A. `crates/` and `packages/`          | `crates/core`, `crates/cli`, `crates/server` | `packages/web` | Vite+, oxc           |
| B. `crates/` and `apps/`              | Same                                         | `apps/web`     | TypeScript monorepos |
| C. Rust at the root, `web/` beside it | `src/`, one crate                            | `web/`         | Small Rust projects  |

With all TypeScript, `packages/core`, `packages/cli`, `packages/server`, and `packages/web`, or
`apps/` for the programs.

### Root command

The single command that runs every check and test. Relies on [monorepo tooling](#monorepo-tooling).

| Option                                                                                                               | New tool | Caching                        | Precedent                   |
| -------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------ | --------------------------- |
| A. A `ready` script in `package.json`, run with `vp run ready`, chaining `vp check`, `vp test`, and the cargo checks | None     | None for scripts; cargo caches | None found for cargo        |
| B. A `justfile` with a `ready` recipe, just pinned through the `rust-just` npm package                               | just     | None; cargo caches             | Vite+, oxc, Rolldown, Biome |
| C. mise tasks                                                                                                        | mise     | Skips unchanged work           | Not checked                 |

With all TypeScript, `vp check`, `vp test`, and `vp run -r build` already cover everything.

### Development environment

How contributors and agents get the toolchain. Relies on [monorepo tooling](#monorepo-tooling).

| Option                                                       | Pins                              | Windows     | Later use                             |
| ------------------------------------------------------------ | --------------------------------- | ----------- | ------------------------------------- |
| A. `rust-toolchain.toml` and Vite+ only                      | Rust, pnpm; Node through `vp env` | Yes         | None                                  |
| B. A, plus a `flake.nix` dev shell, like Vite+'s, used by CI | Every tool                        | Without Nix | A start for Nix environments          |
| C. A, plus a `flake.nix` dev shell, not used by CI           | Every tool                        | Without Nix | Same, but can break unnoticed         |
| D. devenv                                                    | Every tool, and services          | No          | Containers built from the environment |

### CI and releases

What the skeleton sets up beyond local checks. Relies on [Rust binaries](#rust-binaries) and
[monorepo tooling](#monorepo-tooling).

| Option                                                | Work now | Covers                              |
| ----------------------------------------------------- | -------- | ----------------------------------- |
| A. A GitHub Actions workflow running the root command | Small    | Every push and pull request checked |
| B. A, plus a release pipeline (dist, or Bun targets)  | Medium   | Installable binaries                |
| C. Nothing yet                                        | None     | Local checks only                   |

### Git integration

How the CLI and backend will read and write git, in later features. Relies on
[Git and jujutsu libraries](#git-and-jujutsu-libraries).

| Option                                        | In the binary         | Push and auth         |
| --------------------------------------------- | --------------------- | --------------------- |
| A. Run the system `git` for everything        | No                    | The user's setup      |
| B. gix for reads, the system `git` for writes | Reads                 | The user's setup      |
| C. git2 (libgit2) for everything              | Everything            | Reimplemented, with C |
| D. isomorphic-git, with all TypeScript        | Everything but rebase | Reimplemented         |

### Needs no choice

- **Docker**: bollard and dockerode are equivalent, and devcontainers and Nix run as commands in
  both languages (see [Docker and Nix](#docker-and-nix)).
- **State modeling** follows the language: enums in Rust, discriminated unions with the oxlint rule
  this repository already enables in TypeScript (see
  [modeling workflow states](#modeling-workflow-states)).
- **Durable execution**: the constitution makes git the durable store, so no engine is needed to
  hold workflow state (see [durable execution](#durable-execution)).
- **Git listening** works the same in every language: polling is correct with any remote, webhooks
  and hooks make it faster (see [git listening](#git-listening)).
- **Agent adapters**: every agent is reached as a subprocess under every option; only Claude Code's
  live approvals differ, in the [language split](#language-split).
- **Local server security**: a localhost bind and an `Origin` check are the same in every language
  (see [local server security](#local-server-security)).
- **Removal**: the skeleton adds files and tooling only, and touches no user data.
- **Locales and time zones**: the skeleton shows no dates and no text beyond its demo.
- **Offline**: every component runs locally, next to the repository.

## Not checked

- Deno binaries and Node single executables were not measured locally; their sizes come from
  documentation and snippets.
- The bundle size of an Astryx app, its accessibility in practice, and whether its extension
  containers can render Obsidian callouts and typed bullets.
- The size of comrak or markdown-rs compiled to WebAssembly.
- A specification of fate's native protocol for non-TypeScript servers, and a guide to custom
  transports: none was found. Whether async-graphql serves fate's live views.
- Whether a Bun-compiled CLI behaves the same as under Node in Vitest: not tried.
- Whether Vite Task's tracking behaves with cargo's `target/` folder: not tried.
- An end-to-end Bun `--compile` build from a pnpm and Vite+ workspace.
- The maintenance of the unofficial Rust crates for Claude Code, and a formal specification of
  Claude Code's two-way protocol.
- The pi-server protocol and pi's `env` package.
- Hacker News and Reddit threads directly: only their snippets and secondary coverage were read.
- mise tasks and moon in a real Rust and TypeScript repository.
- Go beyond a hello world and go-git's push support.
