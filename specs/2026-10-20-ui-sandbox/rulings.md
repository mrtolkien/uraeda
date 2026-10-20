# Rulings: Stable dev environment for UI review

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The sandbox's page loads the skill's pick script

- **Decision**: the sandbox loads `uraeda-pick.js` at the top of its page, and talks to it with
  messages to the page itself, whose parent it is.
- **Rationale**: the script already owns which element a click means, and its role and name; a
  second copy would drift ([one home per rule](/skills/uraeda/references/code-quality.md)).
- **Alternatives considered**: a picker written for the sandbox: a second copy of the same rules.
- **If wrong**: the bar's module swaps the script for its own, in task 6 alone.
- **Where**: tasks 4 and 6.

## R2: Sessions are seeded through the session manager

- **Decision**: the sample sessions are made by sending scripted turns through `createSessions` on
  the sandbox's `runner.sqlite`, not by writing rows.
- **Rationale**: the stored shape stays the runner's alone, as the agents decision asks.
- **Alternatives considered**: rows written with the cache's API, as `recordRun` does: a copy of the
  item formats.
- **If wrong**: a slower seed, by the time the turns take on an injected zero wait.
- **Where**: task 7.

## R3: The sandbox restarts with `vp run dev`'s script

- **Decision**: `packages/server/scripts/dev.ts` takes an optional Vite config, which the sandbox
  gives.
- **Rationale**: one restart logic for the native binding and the server's code.
- **Alternatives considered**: Vite's own restart: it cannot unload the native binding.
- **If wrong**: the sandbox gets its own script, in task 8.
- **Where**: task 8.

## R4: The sample builders live in `packages/web/samples/`

- **Decision**: one folder of the web package, beside `.storybook/` and `scripts/`, all three of
  whose users are in the web package.
- **Rationale**: `uraeda-binding/test-utils` stays the tests' generic helpers; the samples are the
  web UI's content.
- **Alternatives considered**: `test-utils.ts`, which fix testing is reshaping as templates.
- **If wrong**: a move of one folder.
- **Where**: task 2.

## R5: Built on fix testing's local branch, before it merges

- **Decision**: fix testing's local branch is merged into this one, and the tasks are built on it,
  instead of waiting for it to merge into `main`.
- **Rationale**: the human asked for it: "Don't wait for the merge, start working from the branch
  that's here locally DIRECTLY". The two features are mostly orthogonal.
- **Alternatives considered**: waiting for the merge, as the spec's block said.
- **If wrong**: fix testing's later commits conflict with this branch's; its branch is merged in
  again before the final review, and the conflicts resolved there.
- **Where**: before task 1.

## R6: Source locations from code-inspector's core transform, in a plugin of our own

- **Decision**: `sourceLocations()` is a small Vite plugin of ours that calls `transformCode` from
  `@code-inspector/core`, pinned at 2.0.9, instead of code-inspector's Vite plugin,
  `code-inspector-plugin`.
- **Rationale**: the Vite plugin always injects its client, about 595 KB holding its overlay and its
  chat, into the first module it transforms: `skipSnippets`, `hotKeys: false`, and `server: "close"`
  only blank its settings. The spec's "without its own overlay or server" holds only without the
  wrapper. The wrapper also writes a record file into its own `dist/` in `node_modules`
  (`resetFileRecord`); the core's transform does not. Relative paths come from
  `git rev-parse --show-toplevel`, run when the core is imported: the root of the checkout the
  sandbox runs in. The core's optional `node-pty`, for its terminal, is never used: its build script
  is refused with `node-pty: false` in `pnpm-workspace.yaml`'s `allowBuilds`.
- **Alternatives considered**: the Vite plugin with its client in the sandbox's page, against the
  spec; stripping the client from its output, which depends on its internals; no source locations,
  which drops the pick's "Source" line.
- **If wrong**: a newer code-inspector plugin that can leave its client out replaces the module's
  body, in `packages/web/sandbox/sourceLocations.ts` alone.
- **Where**: task 1.

## R7: The source locations' plugin goes before the UI's transforms

- **Decision**: the sandbox's config lists `sourceLocations()` first, before `uiTransforms()`.
- **Rationale**: both run as `pre` plugins, in their listed order; after StyleX, which adds lines to
  a file, every location is off (`SandboxBar.tsx:180:10` in a file of 90 lines). First, it marks the
  file as written, and the compiler and StyleX still compile it.
- **Alternatives considered**: after the transforms, as the plan first wrote: wrong lines.
- **If wrong**: the source-locations test's exact line and column fail.
- **Where**: tasks 1 and 8.

## R8: The browser tests run the pick script with the test's window as its parent

- **Decision**: `pickScriptOnPage()` runs `uraeda-pick.js` with `globalThis` a proxy of the test's
  window, whose `parent` is that window, methods bound to it.
- **Rationale**: Vitest runs each test in a frame of its own page, so the test's `window.parent` is
  Vitest's: the script posted its picks there and ignored the test's messages. The proxy makes the
  test's window what the sandbox's page is, the top, without changing the script.
- **Alternatives considered**: a parameter of the script for its parent: a test-only change to a
  file every Storybook loads.
- **If wrong**: a test of the sandbox's own page, at the top, replaces the helper, in task 6.
- **Where**: tasks 1, 4, and 6.
