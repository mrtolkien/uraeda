---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Testing review

## What

Testing review: a review of the Rust, TypeScript, and Neovim tests, for what each one tests, whether
it pulls its weight, and how long it takes, and a `vp run ready` that runs only the tests a change
can break.

## Why

`vp run ready` is the check every change runs, and slow or wasted tests cost time on every change,
for the human and for agents.

The full tests are also flaky on github and often fail. It is important that:

- Each test pulls its weight and is meaningful
- Failing tests means ACTUAL bugs

## Notes

What a first look at the Neovim tests found, on 2026-10-14:

- `editors/nvim/tests/`: 12 files and about 80 cases, run in a headless child Neovim against the
  real `ura lsp`, on temporary git repositories. They are the only tests of the plugin's Lua, and
  the only end-to-end check that the plugin and `ura lsp` agree.
- A run takes about 38 s, and about 28 s of it waits on timeouts the tests expect to run out:
  - `test_client.lua`: 4 cases at 5.1 s each. `command()` waits 5 s for `_G.done`, but the callback
    never runs when the command fails, so the error is only checked once the wait runs out. It
    should stop at the result or at an error notification.
  - `test_inline.lua` "they are hidden when inline comments are off" (2.2 s) and `test_jumps.lua`
    (3.4 s): `inline(0)` and `jump()` wait their whole timeout to show that nothing changed.
  - `test_actions.lua` "a buffer closed while a command runs" (3.4 s): a hook that sleeps 1 s on
    purpose, plus waits.
- They depend on more than `editors/nvim/`: `crates/core`, `crates/lsp`, `crates/cli`, and the
  example's specs (`helpers.example()`) can break them, so a path filter on `editors/nvim/**` alone
  misses real breakage.
- Running them only when needed: move `test:nvim` from a `package.json` script, which Vite Task does
  not cache, to a `vite.config.ts` task, with explicit inputs (`editors/nvim/**`,
  `target/debug/ura`, the example's specs) and `MINI_TEST` in `cache.env`. Automatic tracking would
  record the temporary repositories and never hit. A debug `ura` is not always byte-identical after
  a rebuild, so some misses are spurious. CI starts with an empty cache, unless it restores Vite
  Task's cache, which Vite+ calls experimental.

Still to review the same way: the Rust tests (`crates/core/tests`, `crates/cli/tests`,
`crates/lsp/tests`) and the TypeScript tests (`packages/server`, `packages/web`'s unit and browser
tests, `packages/binding`), and the rest of `ready`'s steps, which run one after the other.

You also need to review:

- How much of the testing we can parallelize, with tools like nextest for Rust
- How robust are the tests and their fixtures (development environment, cleanup, ...)
