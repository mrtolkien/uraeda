---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Run the web UI with npx

## What

We need to find the best and simplest way to package uraeda _today_.

Test out solutions that would let it compile to a single binary (best case scenario, test all
promising solutions), or package it as a desktop application (Tauri? Electron?), or otherwise set up
everything so it can be as simple as `npx uraeda` or similar.

## Why

Today the UI only runs from a checkout of Uraeda, with `pnpm start` or `vp dev`, which needs Rust,
Node, and a build. A packaged Uraeda needs one command anyone can run.

## Notes

What the multi-repo server's discovery found, to start from:

- An npm package, `uraeda`, with the binding in one package per platform, in `optionalDependencies`,
  like Biome, Rolldown, Backlog.md, and opencode. The binding's generated loader,
  `packages/binding/index.js`, already looks for `uraeda-binding-<platform>` packages. The name
  `uraeda` was free on npm on 2026-10-13; `ura` is taken.
- Node refuses TypeScript files under `node_modules`, so the server must be bundled to JavaScript:
  `vp pack` (tsdown) is Vite+'s tool for it. Paths relative to the checkout must go:
  `packages/server/src/binding.ts`'s freshness check, the skill reached through the
  `packages/server/plugin/skills/uraeda` symlink, and the built UI passed as `--web-root`.
- The release job builds the binding per target: macOS on macOS runners, Linux glibc with napi-rs's
  cross toolchain. Linux and macOS, x64 and arm64, as the toolchain decision says. npm releases are
  not atomic and cannot be replaced: a missing platform package means a broken release.
- `ura ui` starting the npm package would need a change to the stack decision, since the CLI must
  not need Node. A single executable (Node SEA) is still experimental in Node 24, and Bun or Deno
  would leave Node. A container image needs `claude` and the repositories inside it.
- To settle: opening the browser at start (`--no-open`, like Backlog.md), what a busy port does, and
  how `npx` picks up new versions.
