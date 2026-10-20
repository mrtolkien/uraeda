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
