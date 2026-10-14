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

## R4: The list's JavaScript types are views, and the data folder's platform cases are tested in Rust

- **Decision**: the binding returns `RepositoryView` and `AddedView` from the core's `view.rs`,
  named `Repository` and `Added` in JavaScript, with `path` a string. `binding.dataDir(custom?)`
  reads this process's environment for its default, so `loadDataDir(root, environment)` drops its
  `platform` and `home` parameters, and its tests check the overrides and that no override gives the
  binding's default; the platforms' defaults are the core's `data_dir` table test.
- **Rationale**: napi cannot return a `PathBuf`, and the core's other JavaScript types are views in
  `view.rs`. The default reads the real environment, as `ura add` does, so the CLI and the server
  find the same folder; passing a fake environment through the binding would only serve tests.
- **Alternatives considered**: a `path: String` in the core's `Repository`, which the CLI and the
  core's checks use as a path; a binding `dataDir` taking an environment, a platform, and a home.
- **If wrong**: a test of the server's default on another platform needs the core's table test
  instead, which it has.
- **Where**: task 3

## R5: The session manager reaches the hosts once they open, and the global endpoint is the starting repository's host

- **Decision**: `sessionPublisher(cache, hosts)`, `createSessions`, `startSessions`, and the tests'
  `fakeSessions` take `hosts: HostsOf`, a function giving the hosts once they are open, since the
  session manager starts first and `Hosts.open` takes it. `Hosts` gains `all()`, the buses the
  `Agent` update goes to. Until task 7, the global `/fate` is served by the fate server of the
  starting repository's host when it is listed, else by the module's own; `main.ts` adds the
  starting repository to the list, and `dev.ts` adds each repository on its first request, which
  `forgetRepo` removes again.
- **Rationale**: the hosts need the session manager to send a feature's sessions, and the session
  manager needs the hosts to send its changes: one of them has to find the other later. Watches
  moved to the hosts, so the UI on the global endpoint gets its live updates only through the
  starting repository's host; adding it is what task 6 does at the start anyway (US3.1).
- **Alternatives considered**: a setter on `Sessions` for its change handler, which changes the
  runner for a wiring concern; sending every update on the global bus as well, which task 7 would
  have to find and remove.
- **If wrong**: the getter is one parameter in the wiring; task 6's `startServer` is its only caller
  besides the tests.
- **Where**: tasks 4 and 6
