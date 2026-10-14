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
- **Ended**: in task 7, the global `/fate` has no repository, and `/raw/*` and `/mockups/*` answer
  307 to the most recently opened repository's.

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

## R6: `repositories.add` answers the list, with the added name

- **Decision**: the `Repositories` record has an `added` field, null in every answer but
  `repositories.add`'s, where it is the name of the repository added or found listed. The three list
  mutations answer with the `Repositories` record.
- **Rationale**: a fate mutation answers with one record type, and the add form needs the name to
  open the repository's page (US2.2, US2.5); the list's record already updates the client's cache,
  and the order cannot say which row was added, since `openedAt` is to the second.
- **Alternatives considered**: a `Repository` record type for `repositories.add`'s answer, a second
  view for one field, while the list would then wait for its live update.
- **If wrong**: a client caching `added` from the answer keeps it until the record is read again;
  the form reads it from the answer only.
- **Where**: tasks 5 and 8

## R7: The browser tests keep `URAEDA_REPO` until task 9

- **Decision**: `dev.ts` starts one server per port with `startServer`, and keeps, marked
  `TEMPORARY`, the browser tests' way in until task 9: a request made while `URAEDA_REPO` names
  another repository than the starting one is served by an app on that repository, built on the
  port's hosts and sessions after adding it to the list, and `forgetRepo` removes it again.
  `main.ts` starts the server before it listens, and a busy port stops it again, then exits 1.
- **Rationale**: the browser tests take a fresh fixture per test, through `URAEDA_REPO`, and read it
  on the global endpoint, which serves one repository from task 6 on; moving them to `/r/<name>/` is
  task 9's work, once the UI has those URLs (task 7). Checking the folder before listening keeps
  `--repo` outside git exiting with its own message whatever holds the port, and the cache only
  marks stopped the turns of processes that are gone, so a second server leaves the first one's
  turns as they are.
- **Alternatives considered**: moving the browser tests now, to URLs the UI does not have yet;
  listening before the start, through a hook in `startServer`, which only saves the second server
  one check of the agent.
- **If wrong**: task 9 removes the `TEMPORARY` parts either way; listening first is a change to
  `main.ts` alone.
- **Where**: tasks 6 and 9

## R8: The UI checks the repository through the global client, before its own

- **Decision**: `App` reads `Repositories` through the global client, `/fate`, and draws a
  repository's pages, on its own client, only when the URL's name is listed and its folder is there;
  otherwise the unknown-name or missing-folder page, or, without a name, a redirect to the most
  recent repository or the first run. Inside, the name comes from `RepositoryContext`
  (`useRepository`, `useRepoPath`); calls made outside a component, like `handOver`, use
  `navigateHere`, which reads it from the location. A history entry's `from` holds the path within
  the repository, as the pages compare it with `/` and `/priorities`. The clients are made by
  `fateClients` (`clients.ts`), shared by `main.tsx` and the tests. `createApp` no longer takes
  `repo`.
- **Rationale**: an unknown name's endpoint answers 404, which would show "Could not reach the
  Uraeda server." through the error boundary; asking the global endpoint first never sends a request
  to a repository that is not served (the spec's "its fate requests are not sent").
- **Alternatives considered**: reading the list through the repository's own client, which fails for
  the very names it must explain; a prefix on every `navigate` call, which would hide the repository
  from the paths the pages build, against SC-003's one place.
- **If wrong**: the gate is one component in `App.tsx`.
- **Where**: tasks 7 and 8

## R9: The menu is a popover or a sheet by width, and the Folder field a text field with a list

- **Decision**: the repository menu is Astryx's `Popover` on wide screens and the project's
  `Overlay`, a `BottomSheet` with Close, on narrow ones, chosen by `useWidthClass`; its rows are a
  `List` of `ListItem`s, each with a `MoreMenu` whose presentation is chosen the same way. The add
  form's Folder field is a `TextInput`, its suggestions a `List` under it, each row a button that
  fills the field, with a `Badge` "git". The pages without a repository's navigation, "No repository
  named …" and "Folder not found", show the heading's menu in a `BareShell`, a side navigation
  holding the heading alone. The UI's happy-dom tests get the browsers' rule hiding a popover never
  shown, `[popover] { display: none }`, since happy-dom has no Popover API.
- **Rationale**: `DropdownMenu`'s `presentation="adaptive"` takes a bottom sheet only under a coarse
  pointer, and its compound mode, needed for a filter and rows with their own ⋯ menu, is popover
  only, while the UI layout decision chooses by width alone. `Typeahead` keeps its query to itself,
  clears it when a result is picked, and shows the pick as a token: the field could neither start at
  `~/` nor take a picked folder as text to type on from, as the mockup and US3.3 show.
- **Alternatives considered**: `DropdownMenu` with data items, which has no room for the filter, the
  path under each name, or the refusal; `BaseTypeahead` with field chrome of the app's own, against
  the rule of Astryx components first, for the same uncontrolled query.
- **If wrong**: the menu and the field are each one component, `RepositoryMenu.tsx` and
  `AddRepository.tsx`, behind the same tests.
- **Where**: task 8
