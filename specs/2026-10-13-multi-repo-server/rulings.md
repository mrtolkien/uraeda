# Rulings: Multi-repo server

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Typed paths are read in the server, the core takes absolute ones

- **Decision**: the server expands `~` and refuses a path that is not absolute, in
  `packages/server/src/folders.ts`; the CLI joins a relative folder to the current one; the core's
  `add` takes an absolute path only.
- **Rationale**: the two tools read input differently (`ura add src` is relative on purpose), and
  folder suggestions need the same expansion as the add form, in TypeScript, where they list
  folders.
- **Alternatives considered**: expansion in the core, used by both: the CLI would need to opt out of
  it, and suggestions would still expand `~` in TypeScript.
- **If wrong**: moving `typedFolder` into the core later is a small change behind the same mutation.
- **Where**: tasks 1, 2, and 5

## R2: Browser tests keep their turn, for the shared agent

- **Decision**: each browser test gets its own repository, under its own name and URL, but the tests
  still take their turn.
- **Rationale**: the test server has one fake agent (`vite.browser.config.ts`), whose sent messages
  and exits each test resets; two tests at once would read each other's. The spec's "no longer take
  the repository in turn" holds: the repository is no longer what they wait for.
- **Alternatives considered**: one fake agent per repository, which the server's single session
  manager does not support without a change to the agents' wiring.
- **If wrong**: the browser tests stay as slow as today; nothing else depends on it.
- **Where**: task 9

## R3: The global endpoint keeps the starting repository until the UI moves

- **Decision**: from task 4 to task 7, `/fate`, `/raw/*`, and `/mockups/*` stay bound to the
  repository the server started in, next to the new `/r/:name/` routes. Task 7 moves the UI to the
  new routes and takes the repository away from the global endpoint.
- **Rationale**: every task must leave the project working; the UI and its tests move to the new
  routes in one task.
- **Alternatives considered**: one task for the server's routes and the UI's URLs: too large to
  review as one.
- **If wrong**: nothing lasts beyond task 7.
- **Where**: tasks 4 and 7
