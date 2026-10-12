---
kind: feature
finished: 2026-10-10
pull-request: https://github.com/mrtolkien/uraeda/pull/1
---

# Record: Technical stack decision

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-10, finished on
> 2026-10-10, in [its pull request](https://github.com/mrtolkien/uraeda/pull/1). Its full files are
> in git: `git log -- specs/2026-10-10-stack-decision/`.

## What and why

Uraeda needed its languages and repository layout decided before building the CLI and the web UI.
The human wanted logic shared between the CLI and the backend, a CLI that installs without a package
manager as a small native binary, a React UI with Astryx, and a backend able to drive Codex,
pi-durable, and Claude Code; they preferred Rust for its enums and cargo workspaces. The deliverable
was a skeleton of every component that builds, with one root command for every test and check.

## Behaviour

- `ura status <folder>` printed each workflow file with a status (clarifications rounds in order,
  then `spec.md`, then `plan.md`), padded to the longest name plus two spaces, or
  `invalid: <problem>`; it exited 1 on an invalid file, a missing folder
  (`ura: <folder>: no such folder`), or a file path (`not a folder`), and 2 on a wrong command.
  Temporary: the CLI feature replaced it.
- The server's status page listed every `YYYY-MM-DD-<slug>` folder of `specs/`, newest first, with
  its files and statuses as `ura status` shows them, `No workflow files yet`,
  `No feature folders in specs/`, or `Could not reach the Uraeda server.`, reading the files again
  on every load. Temporary: the web UI feature replaced it.
- `vp run ready` runs every format check, lint, type check, test, and build of both languages, the
  binding's build included, and CI runs it in the Nix dev shell on Linux x64, failing when generated
  files were not committed or when the release `ura` is over 3 MB (it was 1.2 MB).
- The rules that stay: the server binds 127.0.0.1 only and answers 403 `Forbidden host` to a `Host`
  other than `127.0.0.1` or `localhost` on its port, and 403 `Forbidden origin` to an `Origin` that
  is neither those nor one passed with `--allow-origin`; it exits 1 with
  `uraeda-server: <path>: no such folder` or
  `uraeda-server: the native binding is not built; run vp run ready` at startup.

## Design

The workflow logic lives once, in a Rust core. The `ura` CLI links it directly; the TypeScript
server loads it as a native Node addon built by napi-rs, whose generated declarations are the only
TypeScript types of core data; the React UI gets them from the server through fate. This is the
human's own option, a TypeScript server with napi-rs, rather than any of the four offered. The core
holds no state: every call reads the files again. The status slice that proved the seams was named
`temporary_*` or `Temporary*`, each item opening with a `TEMPORARY:` comment naming the feature that
replaces it, so `grep -r TEMPORARY` found it all; the later features removed it.

- Core, [`crates/core/`](/crates/core/) (`uraeda-core`): `Status`, `FileStatus`, `FolderStatus`,
  `temporary_read_folder`, and `temporary_read_specs`, with serde-saphyr for frontmatter. Its `napi`
  feature adds the napi-rs attributes, so each type is declared once and `ura` never builds napi-rs;
  `ready` checks that.
- CLI, [`crates/cli/`](/crates/cli/) (`uraeda-cli`, binary `ura`): clap's entry point, which stays.
- Binding: the napi-rs v3 crate [`crates/binding/`](/crates/binding/) and its npm package
  [`packages/binding/`](/packages/binding/), whose generated `index.js` and `index.d.ts` are
  committed; built with `--no-const-enum`, so `Status` is a string union Node's type stripping runs.
- Server, [`packages/server/`](/packages/server/): Hono on Node 24, run from its TypeScript sources
  without a build step; fate's native protocol at `/fate` with a custom source over the binding, one
  module-level `fateServer` in [`fate.ts`](/packages/server/src/fate.ts) with a per-request context,
  the host and origin guard in [`guard.ts`](/packages/server/src/guard.ts), and the built UI served
  on the same port, 4310 by default.
- Web UI, [`packages/web/`](/packages/web/): a Vite+ React app with Astryx and `react-fate`, whose
  dev server proxies `/fate` to the server with `changeOrigin`.
- Fixtures, [`fixtures/`](/fixtures/): spec folders shared by the Rust and TypeScript tests, broken
  on purpose, left out of formatting and linting.
- Root: the cargo workspace, [`rust-toolchain.toml`](/rust-toolchain.toml) (Rust 1.96.0, 2024
  edition), the pnpm workspace, Node 24 in `devEngines`, the `ready`, `dev`, and `start` scripts in
  [`package.json`](/package.json), `rustfmt` on staged `.rs` files, the dev shell in
  [`flake.nix`](/flake.nix), CI in [`.github/workflows/ci.yml`](/.github/workflows/ci.yml), and
  `MIT OR Apache-2.0` with [`LICENSE-MIT`](/LICENSE-MIT) and [`LICENSE-APACHE`](/LICENSE-APACHE).

## Questions

### Round 01

#### Q1: Which language for each component?

**Answer:** None as offered: "C but with napi-rs to integrate the Rust code instead", a Rust core
and CLI, and a TypeScript server reaching the core through a napi-rs binding, after oxc and Vite+.

#### Q2: How do the backend and the UI reach users?

**Answer:** B/C: the CLI is a small Rust binary for humans and agents, the server a TypeScript
program for autonomous workflows, run with Node locally and easy to make a container image later.

#### Q3: Where are workflow files parsed and validated?

**Answer:** A: the core parses and validates files into a typed model, the backend serves it, and
the UI only renders it.

#### Q4: What does the skeleton do?

**Answer:** A: a thin status slice wired end to end, with "a particular focus to how seamless the
types and languages frontiers are"; a painful implementation could change the approach.

#### Q5: Which platforms are supported?

**Answer:** A: Linux and macOS, on x64 and arm64; Windows later.

#### Q6: Under which license is Uraeda published?

**Answer:** A: MIT OR Apache-2.0, with both license files at the root.

#### Q7: Which Rust libraries does the skeleton start from?

**Answer:** Left to the implementer, "knowing we'll use napi-rs": napi-rs replaced ts-rs, and only
clap, serde, serde-saphyr, and thiserror were added, the rest waiting for a feature that needs them.

#### Q8: How is the repository laid out?

**Answer:** A, with Rust in `crates/` and TypeScript in `packages/`.

#### Q9: Which single command runs every check?

**Answer:** A: a `ready` script in `package.json`, run with `vp run ready`.

#### Q10: How do contributors and agents get the toolchain?

**Answer:** A: `rust-toolchain.toml` and Vite+, plus a `flake.nix` dev shell that CI uses.

#### Q11: What does the skeleton set up beyond local checks?

**Answer:** A: GitHub Actions running the root command on every push and pull request; releases come
with the CLI feature.

## Decisions

- [Stack](../decisions/stack.md), new: the logic in the Rust core, the Rust `ura` CLI, a TypeScript
  server on Node that reaches the core only through the napi-rs binding with generated types, a
  React and Astryx UI fed through fate (Hono's typed client and TanStack Query as the fallback this
  feature did not need), and a server limited to local hosts and allowed origins.
- [Toolchain](../decisions/toolchain.md), new: `vp run ready` runs every check, CI runs it in the
  Nix dev shell on Linux x64 only, every tool is pinned, and napi-rs's generated files are
  committed.

## Changes after approval

- fate read spec folders through a custom source built from its exported types, with two casts and a
  mapped type, so the fallback to Hono's typed client was not used (ruling R2).
- The guard reads the host from the request's URL, which `@hono/node-server` builds from `Host`,
  since happy-dom drops a hand-set `Host` header in the UI's tests (ruling R3).
- The status page asked fate for 1,000 folders, since fate pages lists by 20 and the final review
  found every folder past the 20th dropped (ruling R5).
- YAML errors print on one line in `ura status`, from the final review.
- CI installs with `pnpm install --frozen-lockfile --ignore-scripts`, since the root `prepare`
  script, `vp config`, rewrote AGENTS.md unwrapped and failed the format check (ruling R7).

## Follow-ups

- Deferred by the final review (ruling R6): a UTF-8 byte order mark before `---` reads as "no
  frontmatter" and `status: ~` as "no status field"; symbolic links are skipped; one unreadable
  folder failed the whole list; backward pagination was ignored; `loadBinding` reports any load
  failure, an ABI mismatch included, as "not built"; `--port 80` rejects every request; `vp run dev`
  allows only `http://localhost:5173`; CI runs twice on a pull request's pushes, pins actions by
  tag, and caches Rust outside the Nix shell; some tests assert less than they could.
- Raised on the pull request and not applied: the 1,000-folder cap has no further pages, and
  [`flake.nix`](/flake.nix) has no `x86_64-darwin` shell though macOS x64 is supported.
- No release pipeline or build matrix for the other platforms: left to the CLI feature.
- Left to later features: git embedding, Claude Code's driving and login, pi-durable's own store,
  markdown rendering in the UI, a measure for "ridiculously fast", and a desktop app.
