---
kind: change
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/68
---

# Record: Run the server on a release build of the core

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/68). Its full files are
> in git: `git log -- specs/changes/2026-10-30-release-binding/`.

## What and why

The performance pass found the server, started with `vp run start` from a checkout, loading a debug
build of the Rust core's binding, about 4 times slower on every read. The human asked for the
release build to ship at once, as its own pull request, ahead of the performance pass's spec.

## Behaviour

- `vp run start` builds the binding in release, then the web UI, then starts the server. A workspace
  read of this repository takes about 225 ms with it, against about 3.3 s with the debug build.
- `vp run dev`, the sandbox, the tests, and Vite Task's `binding:build` keep the debug build, which
  rebuilds in seconds after a change to the core.

## Design

A `build:release` script on [the binding's package](/packages/binding/package.json), the same
`napi build` with `--release`, which the root [`package.json`](/package.json)'s `start` runs instead
of `build`. Both write the same `.node` file: the stale-binding check of
[`binding.ts`](/packages/server/src/binding.ts) compares times only, so either build counts as
fresh, and the last one built is the one loaded.

[`toolchain.test.ts`](/packages/server/src/__tests__/toolchain.test.ts) checks that `start` runs
`build:release`, and that `build:release` is `build` plus `--release`, flag for flag: both write the
committed `index.js` and `index.d.ts`, which a flag dropped from one script would rewrite on every
`vp run start`.

## Gotchas

- Switching between `vp run start` and `vp run dev` relinks the binding: cargo keeps both profiles
  in `target/`, so only the copy changes when the core did not.
- A release build after a change to the core takes about a minute.
- The release build uses the workspace's `release` profile as it is, tuned for the `ura` binary's
  size (`opt-level = "z"`, `lto`, one codegen unit). A profile tuned for speed, `opt-level = 3`, is
  likely faster, not measured: the performance pass's choice.

## Follow-ups

- The rest of the performance pass, a cache of the server's reads among it, is the feature
  `2026-10-29-performance-pass`.
