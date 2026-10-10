---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
---

# Spec: Technical stack decision

> [!IMPORTANT]
>
> Spec to review, about 25 minutes.
>
> - Two new decisions: the [stack](../decisions/stack.md), with the logic in a Rust core that the
>   `ura` CLI uses directly and the TypeScript server uses through napi-rs; and the
>   [toolchain](../decisions/toolchain.md), with `vp run ready` as the one command that CI runs in
>   the Nix shell.
> - Your answers on platforms and on Nix in CI clash on macOS x64: Nixpkgs drops Intel Macs at the
>   end of 2026. CI runs that platform outside Nix, with the same pinned Rust and Node. Also, the
>   repository is private: GitHub bills macOS minutes at ten times Linux's, on four runners.
> - The riskiest assumption: fate's server side ships sources for Prisma and Drizzle only. The
>   server writes its own source, which reads spec folders through the core, on types fate exports
>   but does not document. If that needs anything fate does not export, or a patch to fate, the
>   implementation stops and comes back to you, as your answer on the skeleton allows.
> - Your answer on the Rust libraries let me choose: napi-rs replaces ts-rs, and tokio, axum,
>   comrak, and rust-embed wait for a feature that needs them. The skeleton's Rust needs only clap,
>   serde, serde-saphyr, and thiserror.
> - Your answer on packaging, read as: the server runs with Node from its TypeScript sources, and
>   this feature adds no container image.
> - The layout adds a binding, split as you asked: its crate in `crates/binding`, its npm package in
>   `packages/binding`. A root `fixtures/specs/` folder is shared by the Rust and TypeScript tests.
> - The binary is `ura`, as your note asked.
> - Risk tier `high`, so you review the plan: a new local server with its own security checks, a new
>   interface between two languages, and an undocumented fate API.

This feature sets up the repository for Uraeda's tools, for the people and agents who will build
them: a Rust core with the workflow logic, the `ura` CLI on it, a TypeScript server that calls the
core through a napi-rs binding, and a React web UI with Astryx and fate. A thin slice, reading the
`status` field of workflow files, runs through every component, so the seams between Rust and
TypeScript, and between the server and the UI, are proven on real code before the CLI and web UI
features build on them. One command runs every check, and CI runs it. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Read a feature's status from the terminal (P1)

A human or an agent runs `ura status <folder>` on a feature folder, and sees each workflow file that
has a status, with its status, or what is wrong with it. The command exits with an error code when a
file is invalid, so an agent or a script can rely on it.

Why this priority: it proves the CLI and the core, which every later command builds on.

Acceptance scenarios:

1. **Given** a folder holding `clarifications-01.md` with `status: answered`, `spec.md` with
   `status: awaiting-human`, and `proposal.md`, **When** the user runs `ura status <folder>`,
   **Then** it prints `clarifications-01.md  answered` then `spec.md               awaiting-human`,
   and exits with code 0.
2. **Given** a folder holding `clarifications-01.md` with `status: answered` and
   `clarifications-02.md` with `status: awaiting-human`, **When** the user runs
   `ura status <folder>`, **Then** round 01 is printed before round 02.
3. **Given** a folder holding `plan.md` with `status: done`, **When** the user runs
   `ura status <folder>`, **Then** it prints `plan.md  invalid: unknown status "done"`, and exits
   with code 1.
4. **Given** a path that does not exist, **When** the user runs `ura status missing/`, **Then** it
   prints `ura: missing/: no such folder` on standard error, and exits with code 1.

### US2: See every feature's status in the browser (P1)

A human starts the server on a repository, opens the web UI, and sees every feature folder, the
newest first, each with its workflow files and their statuses, as the CLI shows them.

Why this priority: it proves the server, the binding, fate, and Astryx together, the seams the
proposal's stack depends on.

Acceptance scenarios:

1. **Given** `specs/` holding `2026-10-06-recurring-tasks/` and `2026-10-10-stack-decision/`,
   **When** the user opens the page, **Then** `2026-10-10-stack-decision` is listed first, each
   folder with its files and statuses in the order `ura status` prints them.
2. **Given** a folder whose `plan.md` has `status: done`, **When** the user opens the page, **Then**
   that row shows `Invalid: unknown status "done"`, marked as an error.
3. **Given** a feature folder holding only `proposal.md`, **When** the user opens the page, **Then**
   the folder is listed with the text `No workflow files yet`.
4. **Given** `specs/` holding no feature folder, **When** the user opens the page, **Then** it shows
   `No feature folders in specs/`.
5. **Given** a file whose status changed since the page loaded, **When** the user reloads the page,
   **Then** it shows the new status.

### US3: Check everything with one command (P1)

A contributor, human or agent, runs `vp run ready` at the root after any change, and gets every
format check, lint, type check, test, and build, in Rust and TypeScript, with the same tools as CI.

Why this priority: the proposal asks for it, and every later feature's agent relies on it to check
its own work.

Acceptance scenarios:

1. **Given** a fresh clone, inside the Nix dev shell, after `vp install`, **When** the contributor
   runs `vp run ready`, **Then** it builds the binding, runs every check of both languages, and
   succeeds.
2. **Given** a pull request, **When** CI runs, **Then** it runs `vp run ready` on the four
   platforms, and fails if the generated binding files differ from the committed ones.

## Edge cases

- A file without frontmatter shows `invalid: no frontmatter`. Frontmatter is the text between a
  first line `---` and the next line `---`.
- Frontmatter delimiters with Windows line endings, `---` followed by `\r\n`, are read like `---`.
- Frontmatter that is not valid YAML shows
  `invalid: frontmatter is not valid YAML: <parser message>`, where the parser's message holds the
  line.
- Frontmatter without a `status` field shows `invalid: no status field`, and a `status` that is not
  a string shows `invalid: status is not a string`.
- A status allowed for another kind of file, like `approved` in a clarifications file, shows
  `invalid: unknown status "approved"`.
- A file that is not UTF-8 shows `invalid: not UTF-8`.
- Only `clarifications-NN.md` with two digits, `spec.md`, and `plan.md` are read: `proposal.md`,
  discovery rounds, `clarifications-1.md`, and subfolders are ignored.
- A folder with none of those files: `ura status` prints `No workflow files in <folder>` and exits
  with code 0.
- A path given to `ura status` that is a file: `ura: <path>: not a folder`, exit code 1.
- In `specs/`, only folders named `YYYY-MM-DD-<slug>` are feature folders: `drafts/`, `backlog/`,
  `bugs/`, and `decisions/` are not listed.
- The server is started on a folder that does not exist: it prints
  `uraeda-server: <path>: no such folder` and exits with code 1.
- The UI cannot reach the server: the page shows `Could not reach the Uraeda server.`
- A request reaches the server with another `Host`, as in a DNS rebinding attack, or from a page of
  another origin: the server answers 403, and reads nothing.
- The binding was not built when the server starts: it exits with
  `uraeda-server: the native binding is not built; run vp run ready`.

## Success criteria

- **SC-001**: The release build of `ura` for Linux x64 is under 3 MB.
- **SC-002**: `vp run ready` succeeds in CI on Linux x64, Linux arm64, macOS x64, and macOS arm64.
- **SC-003**: No type describing core data is declared by hand in TypeScript: the server and the UI
  import them from the binding's generated declarations, or from fate's types derived from them.
- **SC-004**: Renaming a field of a core type in Rust, like `FileStatus.problem` to `error`, makes
  `vp run ready` fail in the TypeScript type check of the server and the UI where the field is read,
  with no type to edit by hand. Tried during the implementation, as the human asked for care on the
  seams between the languages ([Q4](clarifications-01.md#q4-what-does-the-skeleton-do)).
- **SC-005**: The pull request lists every manual step, workaround, and pain point met at the seams
  between Rust and TypeScript, and between the server and the UI, with the result of SC-004, so the
  human can judge whether to keep the approach.

## Design

### Approach

The [stack](../decisions/stack.md) decision puts the logic in one Rust crate. The CLI links it
directly; the server loads it as a native Node addon built by napi-rs, whose generated declarations
give TypeScript the core's types. The server exposes them to the UI through fate's native protocol
on Hono, the setup fate documents, with a source that reads spec folders through the binding instead
of a database. This is option E of the [language split](discovery-01.md#language-split), the human's
answer to [Q1](clarifications-01.md#q1-which-language-for-each-component), with Rust in `crates/`
and TypeScript in `packages/`, as [Q8](clarifications-01.md#q8-how-is-the-repository-laid-out)
answers.

The [toolchain](../decisions/toolchain.md) decision chains every check into `vp run ready`, run by
CI inside the Nix dev shell, except on macOS x64, which Nixpkgs no longer supports after 2026.

The core holds no state: every call reads the files again. Nothing is cached, so the files in git
stay the only state ([principle III](/specs/CONSTITUTION.md#iii-asynchronous-by-default)).

### Data

The core's types, in [`crates/core`](/crates/core/). Each one carries napi-rs attributes behind the
core's `napi` feature, so the binding exports them unchanged and the CLI does not build napi-rs.
`Status` is a napi-rs string enum, with each value set by `#[napi(value = "...")]`, and the binding
is built with `--no-const-enum`, so TypeScript sees the union `"awaiting-human" | "answered" | ...`,
which Node's type stripping and Vite can run, rather than a `const enum`:

```rust
/// A workflow file's status, as written in its frontmatter.
enum Status { AwaitingHuman, Answered, Approved, ChangesRequested, AutoApproved }
// napi string enum: "awaiting-human", "answered", "approved", "changes-requested", "auto-approved"

struct FileStatus {
    file: String,            // "clarifications-01.md"
    status: Option<Status>,  // None when the file is invalid
    problem: Option<String>, // "unknown status \"done\"", None when valid
}

struct FolderStatus {
    name: String,            // the folder's name: "2026-10-10-stack-decision"
    files: Vec<FileStatus>,  // clarifications rounds in order, then spec.md, then plan.md
}
```

Exactly one of `status` and `problem` is set. The statuses allowed per kind of file are those of
[the skill's workflow status table](/skills/uraeda/SKILL.md#workflow-status):

| File                   | Allowed statuses                                                   |
| ---------------------- | ------------------------------------------------------------------ |
| `clarifications-NN.md` | `awaiting-human`, `answered`                                       |
| `spec.md`              | `awaiting-human`, `approved`, `changes-requested`                  |
| `plan.md`              | `awaiting-human`, `auto-approved`, `approved`, `changes-requested` |

The core's functions:

- `read_folder(path) -> Result<FolderStatus, CoreError>`: one feature folder.
- `read_specs(path) -> Result<Vec<FolderStatus>, CoreError>`: every feature folder of a `specs/`
  folder, newest first, by name.

`CoreError` is `NoSuchFolder(path)` or `Io(path, message)`: failing to read the folder itself.
Problems with a file are not errors: they are in its `problem`.

How the data flows:

- **CLI**: `read_folder`, printed as one line per file: the file name, padded to the longest name
  plus two spaces, then the status, or `invalid: ` and the problem.
- **Server**: the binding's `readSpecs(path)` returns `FolderStatus[]`, typed by the generated
  declarations. The server adds `id`, the folder's name, which fate needs to identify objects, and
  serves the result as `SpecFolder` objects, with `files` as a plain field: an array of plain
  objects, not fate entities, so they need no `id`.
- **UI**: a fate view selects `name` and `files`; fate's Vite plugin types it from the server's
  module.

### Components

- **Core** ([`crates/core`](/crates/core/), crate `uraeda-core`): the types above, frontmatter
  reading with serde-saphyr, and `read_folder` and `read_specs`. Depends on serde, serde-saphyr, and
  thiserror. Its `napi` feature adds `napi` and `napi-derive`, and its `build.rs` calls
  `napi_build::setup()` when that feature is on, which napi-rs needs to regenerate the declarations
  of types defined outside the binding's crate.
- **CLI** ([`crates/cli`](/crates/cli/), crate `uraeda-cli`, binary `ura`): `ura status <folder>`,
  with clap. Depends on the core only.
- **Binding**: a napi-rs v3 crate, [`crates/binding`](/crates/binding/), `uraeda-binding`, that
  exports `readFolder` and `readSpecs`, and the core's types with the `napi` feature on; and its npm
  package, [`packages/binding`](/packages/binding/), `uraeda-binding`, whose build runs napi-rs on
  the crate and writes the addon, `index.js`, and `index.d.ts` there. The two generated files are
  committed, and left out of formatting and linting. Private: nothing is published.
- **Server** ([`packages/server`](/packages/server/), package `uraeda-server`): a Hono app on Node
  24, run from its TypeScript sources with Node's type stripping, without a build step: its imports
  name their `.ts` extensions, and its `tsconfig.json` sets `erasableSyntaxOnly`. It serves fate's
  native protocol at `/fate`, with a source for `SpecFolder` that calls `readSpecs` on every
  request, and the built UI as static files. Its options: `--specs <path>`, default `specs`;
  `--port <port>`, default `4310`; `--allow-origin <origin>`, repeatable. It binds 127.0.0.1, and a
  middleware rejects any request whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`, or
  whose `Origin`, when present, is neither of those nor an allowed origin. The app is exported apart
  from the code that listens, so tests call it in process.
- **Web UI** ([`packages/web`](/packages/web/), package `uraeda-web`): a Vite+ React app with Astryx
  and `react-fate`, and one page, the status page. In development, Vite's server proxies `/fate` to
  the server with `changeOrigin` on, so the `Host` is the server's, and the server is started with
  Vite's origin allowed.
- **Fixtures** ([`fixtures/specs`](/fixtures/specs/)): a `specs/` folder with a folder per scenario
  and edge case, shared by the Rust and the TypeScript tests. They are left out of formatting and
  linting, which would repair the broken files on purpose.
- **Root**: a cargo workspace (`Cargo.toml`) of the three crates, `rust-toolchain.toml` with the
  latest stable Rust, `rustfmt.toml` with the 2024 edition, `pnpm-workspace.yaml` listing
  `packages/*`, Node 24 pinned in `devEngines`, `LICENSE-MIT` and `LICENSE-APACHE`, and
  `license = "MIT OR Apache-2.0"` in every manifest.
- **Scripts** ([`package.json`](/package.json)), in the order they run:
  - `ready`: `cargo fmt --check`; `cargo clippy` with `-D warnings`; `cargo test` on the workspace
    except the binding, whose cdylib does not link outside Node, and without its features, so `ura`
    is tested as it ships; a check that `ura` does not depend on napi-rs; the binding's build;
    `vp check`; `vp test`; and `vp build` of the UI.
  - `dev`: the server, restarted on change, and the UI's dev server.
  - `start`: builds the UI, then starts the server serving it, on one port.
- **Pre-commit hook** ([`vite.config.ts`](/vite.config.ts)): staged `.rs` files go through
  `rustfmt`, which reads the edition from `rustfmt.toml`.
- **Nix dev shell** (`flake.nix`, `flake.lock`): Node 24, pnpm, and the Rust toolchain read from
  `rust-toolchain.toml`, as Vite+'s flake does. `vp` comes from the `vite-plus` package that
  `pnpm install` adds. `flake.lock` pins the exact versions; `devEngines` and `rust-toolchain.toml`
  pin the same Node major and Rust release for those outside Nix.
- **CI** (`.github/workflows/ci.yml`): on every push and pull request, on `ubuntu-latest`,
  `ubuntu-24.04-arm`, and `macos-latest`, it installs Nix, then runs `pnpm install` and
  `vp run ready` in the dev shell. On `macos-15-intel`, it runs the same commands with Rust from
  `rust-toolchain.toml` and Node from `voidzero-dev/setup-vp`. Then each runner checks that
  `git status --porcelain` is empty, so the generated files were committed. The Linux x64 runner
  also builds `ura` in release mode, and fails above 3 MB.
- **Documentation**: [AGENTS.md](/AGENTS.md) gets the layout, the stack, and `vp run ready` in its
  checklist; the [README](/README.md) says how to build and run the tools.

### Mockups

- [Status page](mockups/status-page.html): the page with two feature folders, an invalid file, and a
  folder without workflow files; the empty state; and the state when the server cannot be reached.
  The exact Astryx components are chosen by the plan; the layout and texts are the reference.

### Error handling

- A file is invalid: the CLI prints `invalid: <problem>` on its line and exits with code 1 once
  every file is printed; the UI shows `Invalid: <problem>`, marked as an error. The exact problems
  are listed in the [edge cases](#edge-cases).
- The folder given to `ura status` does not exist or cannot be read: `ura: <folder>: no such folder`
  or `ura: <folder>: <system message>`, on standard error, exit code 1.
- A wrong command or option: clap's usage message, exit code 2.
- The server's `specs/` folder does not exist at startup: `uraeda-server: <path>: no such folder`,
  exit code 1. If it disappears later, fate answers the request with an error, and the page shows
  `Could not reach the Uraeda server.`
- A forbidden `Host` or `Origin`: status 403, with the body `Forbidden host` or `Forbidden origin`.
- The binding is not built: the server exits with the message in the [edge cases](#edge-cases).

### Testing

The Rust tests run with `cargo test` on the fixtures folder: the CLI's tests run the built `ura`
binary on it and read its output and exit code. The TypeScript tests run with `vp test`: the
binding's test calls the built addon on the fixtures; the server's tests call the Hono app in
process, with fate requests, and the `Host` and `Origin` headers set by the test; the UI's tests
render the page with Testing Library, with its requests sent to the server app in process, on the
same fixtures.

| What                                           | Test                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| US1 scenarios, and the CLI edge cases          | CLI integration tests, one per scenario                           |
| Frontmatter, status, and file name edge cases  | Table-driven test of `read_folder`, one row per fixture folder    |
| Feature folders only, newest first             | Core test of `read_specs` on the fixtures                         |
| The binding returns the core's data            | Binding test calling `readSpecs` on the fixtures                  |
| US2 scenarios 1 to 4, and "Could not reach"    | UI integration tests, one per scenario                            |
| US2 scenario 5                                 | Server test: change a fixture copy between two requests           |
| Forbidden `Host` and `Origin`, allowed origins | Table-driven server test, one row per header pair                 |
| Server startup errors                          | Server tests starting it on a missing folder, and without binding |
| US3 scenarios, SC-002                          | The CI workflow itself, on the pull request                       |
| SC-003, SC-004, SC-005                         | Checked during the implementation, reported in the PR             |
| SC-001                                         | Measured in CI, which fails above 3 MB                            |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- Embedding git, or using the system `git`, is decided by the CLI or git listener feature.
- pi-durable's own store is handled by its runtime feature, under principle III.
- Claude Code is driven by the runner feature, with deferred tool calls and `--resume`.
- Markdown rendering in the UI is chosen by the web UI feature.
- "Ridiculously fast" gets its measure in the web UI feature.
- The server binds to 127.0.0.1 and rejects other origins; it has no authentication.
- Rust checks are rustfmt, clippy with warnings as errors, and `cargo test`, without cargo-nextest
  or cargo-deny.
- The Rust toolchain is the latest stable release, pinned, with the 2024 edition.
- The binary is `ura`; crates and packages are `uraeda-*`; nothing is published.
- A desktop app stays out of the skeleton.
- AGENTS.md and the README are updated with the layout and commands.

Settled while writing this spec:

- The data layer is fate, as [PRIORITIES.md](/specs/PRIORITIES.md) says, now that the server is
  TypeScript, over its native protocol on Hono, the setup its documentation shows
  ([fate](discovery-01.md#fate)). fate has no source for files: the server's source implements
  fate's exported `SourceExecutor` and `SourceRegistry` types, which are not documented. The
  implementation stops and asks the human if it needs anything `@nkzw/fate` does not export, a patch
  to fate, or if fate's Vite plugin cannot type the client from the server's module.
- napi-rs generates the TypeScript types, so ts-rs is not needed. The Rust dependencies are only
  those the slice uses; tokio, axum, comrak, and rust-embed come with the features that need them
  ([Q7](clarifications-01.md#q7-which-rust-libraries-does-the-skeleton-start-from)).
- The core's types carry napi-rs attributes behind a feature, rather than being copied into the
  binding, so each type is declared once.
- The binding's crate is in `crates/binding` and its npm package in `packages/binding`, following
  the Q8 answer, where Vite+ and oxc keep both in one folder
  ([mixed repositories](discovery-01.md#mixed-rust-and-typescript-repositories)).
- The server runs from TypeScript sources with Node 24's type stripping, so it has no build step; no
  container image is built yet, but the server takes its paths and port as options, so one is a
  `Dockerfile` away ([Q2](clarifications-01.md#q2-how-do-the-backend-and-the-ui-reach-users)).
- The server serves the built UI itself, so one process and one port run the tools.
- Port `4310` by default, an unassigned port.
- Generated binding files are committed, as Vite+ does, so editors and reviewers see the types
  without a build. `vp run ready` regenerates them; CI checks they were committed.
- `ura status` exits with code 1 when a file is invalid, so scripts and agents can rely on it.
- `ura status` has no `--json` output yet: the CLI feature designs its output formats.
- The page shows the files as they were when it loaded, without live updates: those come with the
  web UI feature.
- CI runs macOS x64 outside Nix, on `macos-15-intel`, which GitHub keeps until about August 2027:
  Nixpkgs drops x86_64-darwin after its 26.05 release
  ([NixOS 26.05](https://nixos.org/blog/announcements/2026/nixos-2605/)). The other three runners
  use the Nix shell, as
  [Q10](clarifications-01.md#q10-how-do-contributors-and-agents-get-the-toolchain) answers.
- The repository is private, so CI minutes are billed: macOS minutes count ten times Linux's, and
  Linux arm64 runners may need a paid plan. CI still runs on every push and pull request, as
  [Q11](clarifications-01.md#q11-what-does-the-skeleton-set-up-beyond-local-checks) answers.
- The SC-001 limit is 3 MB, above the 1.9 MB measured for a clap binary
  ([Rust binaries](discovery-01.md#rust-binaries)), leaving room for YAML parsing.

## Decisions

New, applied when this spec is approved:

- [Stack](../decisions/stack.md): the workflow logic lives in the Rust core; the CLI is Rust; the
  server is TypeScript on Node and reaches the core only through the napi-rs binding, with generated
  types; the UI is React with Astryx and fate; the server accepts only local hosts and allowed
  origins.
- [Toolchain](../decisions/toolchain.md): `vp run ready` runs every check, CI runs it in the Nix dev
  shell on Linux and macOS, and every tool is pinned.

## Constitution check

| Principle                            | Complies | Notes                                                                                                              |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------ |
| I. Humans stay in control            | yes      | Follows the answers; the new decisions wait for approval                                                           |
| II. Git and plain text first         | yes      | The tools read the workflow files; they store nothing                                                              |
| III. Asynchronous by default         | yes      | No state outside git: every request reads the files again                                                          |
| IV. Review effort matches impact     | yes      | High tier, the plan is reviewed; the PR reports the seams, so the human judges the approach without reading it all |
| V. Tools are optional                | yes      | The CLI and the UI only read files; `ura status` validates statuses whatever wrote them                            |
| VI. Code is checked against the spec | yes      | Every scenario has a test; the binding and the custom fate source are justified in the plan                        |

## Risk tier

**High**: a new local server with security checks, a new interface between Rust and TypeScript, and
an undocumented fate API, though nothing writes to files.
