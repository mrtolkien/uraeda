---
status: auto-approved
spec-revision: 1
---

# Plan: Multi-repo server

**Goal:** One Uraeda server serves every repository listed in `repositories.json`, with a repository
menu at the web UI's top left, an add form completing paths, and `ura add` in the CLI.

**Architecture:** The Rust core owns the list (`crates/core/src/repositories.rs`): the data folder,
reading, adding, removing, and touching entries, with one atomic write. The CLI and, through the
binding, the server are its only callers. In the server, a `Hosts` registry
(`packages/server/src/repositories.ts`) owns one host per listed repository: its fate server, its
live bus, and its watch, started and stopped as the list changes; it is the only code that creates
or closes them. The session manager stays one per process, and its changes reach the host whose path
is the session's main checkout. Routes under `/r/:name/` take their context from the host; the
global `/fate` serves the list, folder suggestions, and the list's mutations. The web UI keeps one
fate client per repository, built from the URL's name, so fate IDs stay as they are. See the
[spec's design](spec.md#design).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A repository removed while its page is open in another tab**: that tab's next request gets the
   unknown-name 404, and the page shows "No repository named …", not a crash or another repository's
   data. Tasks 4 and 7.
2. **The list changing under a running server, from the CLI or a hand edit**: the hosts follow the
   file (a host started for an added entry, closed for a removed one, its watch closed), and a file
   that becomes invalid leaves the hosts as they were. Task 5.
3. **A session's live update in a repository whose host is gone**, after it was removed with no turn
   running: the update is dropped, not sent to another repository's bus. Task 4.
4. **Two repositories whose folders share a name in the same tick**: the second add sees the first's
   entry, since every write reads the file again under the core's write lock. Task 1.
5. **A missing folder at server start**: its host has no watch and no fate requests; the watch
   failing must not stop the server. Task 4.
6. **The global `/fate` called for a repository's record** after Task 7: it refuses with
   `refused: no repository`, so a stale client never reads the wrong repository. Task 7.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these:

- From the [repositories](../decisions/repositories.md) decision, word for word:
  - The list of repositories MUST be stored in `repositories.json`, in Uraeda's data folder for the
    user, the folder the [agents](../decisions/agents.md) decision names. It MUST be JSON with a
    top-level `"version"`, readable and editable by hand. It MUST NOT be stored in a repository, or
    in `runner.sqlite`.
  - Reading and writing the list, and finding the data folder, MUST live in the Rust core,
    `crates/core`. The CLI and the server, through the binding, MUST NOT read or write
    `repositories.json` any other way.
  - A write MUST replace the file whole, through a temporary file renamed over it, so a reader never
    sees half a file.
  - Each entry MUST be the main checkout of a git repository, by absolute path, listed once, with a
    name unique in the list, made of letters, digits, `.`, `_`, and `-`.
  - A folder outside git MUST be refused. Removing a repository from the list MUST NOT change its
    files, or its sessions in the cache.
  - One server process MUST serve every listed repository. Every UI page and server route that reads
    or writes a repository's data MUST start with `/r/<name>/`, its name in the list.
  - Each repository MUST have its own fate endpoint and its own live updates: a change in one
    repository MUST NOT send an update to the views of another.
- From the [stack](../decisions/stack.md) decision: "TypeScript code MUST reach the core only
  through the binding, and MUST NOT reimplement its parsing, validation, or states." "The TypeScript
  types of core data MUST come from the declarations napi-rs generates for the binding." "The server
  MUST listen on 127.0.0.1 only." The guard ([`guard.ts`](/packages/server/src/guard.ts)) is
  unchanged.
- From the [CLI](../decisions/cli.md) decision: "Commands MUST print data to stdout and messages to
  stderr, exit 0 on success and 1 on any error". "A change to a command's behaviour MUST update the
  skill in the same change."
- From the [UI layout](../decisions/ui-layout.md) decision: "On wide screens, menus MUST be popovers
  and short forms dialogs. On narrow screens, both MUST be bottom sheets." "An open detail, tab, or
  sheet that can be returned to MUST be in the URL". "Components MUST NOT write their own media
  queries with sizes."
- From the [UI behaviour](../decisions/ui-behaviour.md) decision: "Every sheet and dialog MUST have
  a visible close button, and Back MUST close it." "Errors MUST stay on screen until the human deals
  with them, or the action is retried."
- From the [agents](../decisions/agents.md) decision: the data folder is "`URAEDA_DATA_DIR` when it
  is set, or else the operating system's default, `$XDG_DATA_HOME/uraeda/` on Linux
  (`~/.local/share/uraeda/` when `XDG_DATA_HOME` is unset), `~/Library/Application Support/uraeda/`
  on macOS, and `%APPDATA%\uraeda\` on Windows." Sessions stay keyed by the main checkout.
- The spec's exact texts, as written in its scenarios, edge cases, and error handling: "Not a git
  repository: <path>. Run git init there first.", "No such folder: <path>.", "Type an absolute path,
  starting with / or ~.", "An agent is working in <name>: stop it first.", "repositories.json could
  not be read: <problem>", "No repository named “<name>”", "Folder not found", "Add your first
  repository", "Add a repository…", "Remove from Uraeda", "Folder not found: <home path>", and the
  server's and CLI's messages of US3 and US4.
- Existing guarantee: the core's writes run one at a time, whatever the repository
  ([`api.rs`](/crates/core/src/api.rs), `WRITES`); list writes take the same lock.
- Existing guarantee: `vp run ready` passes after every task.

## Code read

- [`crates/core/src/api.rs`](/crates/core/src/api.rs): every operation takes the repository's path
  and opens git again (`open`); `ApiError { code, message, output }` and `refused(...)` are how
  refusals reach the binding; `WRITES` is the process-wide write lock.
- [`crates/core/src/git.rs`](/crates/core/src/git.rs): `Git::discover` searches parent folders and
  fails with `GitError::NotARepository`; `main_root()` is the main checkout, canonicalized.
- [`crates/core/src/today.rs`](/crates/core/src/today.rs): `rfc3339(SystemTime)` gives the timestamp
  format `openedAt` uses.
- [`crates/core/Cargo.toml`](/crates/core/Cargo.toml): `serde_json` and `tempfile` (dev) are already
  dependencies; no new crate is needed.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): exports wrap core calls in `job(...)`,
  rejecting with `<code>: <message>`; types come from the core's `napi(object)` structs
  ([`view.rs`](/crates/core/src/view.rs)). `vp run --filter uraeda-binding build` regenerates
  [`packages/binding/index.d.ts`](/packages/binding/index.d.ts), which is committed.
- [`crates/cli/src/main.rs`](/crates/cli/src/main.rs): clap's `Command` enum, one module per
  command, errors through `output::fail`, which prints `ura: <message>` and exits 1. CLI tests in
  [`crates/cli/tests/`](/crates/cli/tests/) run the built binary with `ura_in(dir, args, env)` from
  [`common/mod.rs`](/crates/cli/tests/common/mod.rs), on `TestRepo` fixtures.
- [`packages/server/src/runner/cache.ts`](/packages/server/src/runner/cache.ts):
  `dataDir(env, platform, home)`, the only TypeScript copy of the data folder's rules, used by
  [`env.ts`](/packages/server/src/env.ts) `loadDataDir`, and by its tests in
  `__tests__/env.test.ts`.
- [`packages/server/src/fate.ts`](/packages/server/src/fate.ts): one module-level live bus and
  `fateServer`, whose export fate's Vite plugin needs to generate the UI's client.
- [`packages/server/src/fate/context.ts`](/packages/server/src/fate/context.ts),
  [`sources.ts`](/packages/server/src/fate/sources.ts),
  [`mutations.ts`](/packages/server/src/fate/mutations.ts),
  [`sessions.ts`](/packages/server/src/fate/sessions.ts): every read and write uses `ctx.repo`.
- [`packages/server/src/live.ts`](/packages/server/src/live.ts): `publish` and `sessionPublisher`
  send on the global `live`; `watches` keeps one watch per repository; `startSessions` opens the
  cache and starts the session manager.
- [`packages/server/src/app.ts`](/packages/server/src/app.ts): binds `options.repo` into every
  request's context; serves `/fate`, `/fate/live`, the file routes, and the built UI.
- [`packages/server/src/files.ts`](/packages/server/src/files.ts): `/raw/*` and `/mockups/*`.
- [`packages/server/src/main.ts`](/packages/server/src/main.ts) and
  [`dev.ts`](/packages/server/src/dev.ts): wire the binding, the sessions, the watch, and the app
  twice; `dev.ts` keeps apps by `"<port> <repo>"` and reads `URAEDA_REPO` per request.
- [`packages/server/src/runner/sessions.ts`](/packages/server/src/runner/sessions.ts):
  `mainRoot(repo)`, and `working(repo)`, the folders whose session has a turn running or queued.
- Server tests: [`__tests__/helpers.ts`](/packages/server/src/__tests__/helpers.ts) builds
  `createApp({ repo, ... })` with `fakeSessions`, and `fate(app, operations)` posts to `/fate`;
  `fixtureRepo()` comes from [`packages/binding/test-utils.ts`](/packages/binding/test-utils.ts).
- Web: [`routes.tsx`](/packages/web/src/routes.tsx) (`parseRoute`, `navigate`, `pathLink`),
  [`App.tsx`](/packages/web/src/App.tsx) (one `FateClient`),
  [`main.tsx`](/packages/web/src/main.tsx), [`data.ts`](/packages/web/src/data.ts),
  [`Shell.tsx`](/packages/web/src/Shell.tsx) (`Heading`),
  [`useRoundPosition.ts`](/packages/web/src/useRoundPosition.ts), and the files building paths:
  `App.tsx`, `Crumbs.tsx`, `DocumentPage.tsx`, `EditorPage.tsx`, `FeaturePage.tsx`, `FilePage.tsx`,
  `Home.tsx`, `MockupPage.tsx`, `SessionNav.tsx`, `SessionPage.tsx`, `Shell.tsx`, `TaskView.tsx`,
  `labels.ts`, `sessions.ts`.
- Web tests: [`__tests__/helpers.tsx`](/packages/web/src/__tests__/helpers.tsx)
  `renderPage(path, repo, options)` and `serverFetch(repo)`; browser tests:
  [`vite.browser.config.ts`](/packages/web/vite.browser.config.ts) (`takeRepo`, `releaseRepo`, one
  shared `FakeAdapter`) and [`__browser__/setup.ts`](/packages/web/src/__browser__/setup.ts).
- Validation: `vp run ready` at the root (formatting, lints, type checks, cargo and Vitest tests,
  the browser project, `ura check specs`). Single files: `cargo test -p uraeda-core <filter>`,
  `cargo test -p uraeda-cli --test <file>`, `vp test <path>`.

## Constitution check

| Principle                            | Complies | Notes                                                                       |
| ------------------------------------ | -------- | --------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | The list changes only on the human's add, remove, or hand edit              |
| II. Git and plain text first         | yes      | No workflow state moves; the list is plain JSON outside repositories        |
| III. Asynchronous by default         | yes      | No workflow step changes                                                    |
| IV. Review effort matches impact     | yes      | No question left; rulings in [rulings.md](rulings.md)                       |
| V. Tools are optional                | yes      | The skill gains `ura add`'s row; the workflow needs neither the list nor it |
| VI. Code is checked against the spec | yes      | Every scenario has a test; new abstractions are below                       |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Repositories](../decisions/repositories.md): the list in the core (task 1), the CLI (task 2) and
  the server (tasks 3 to 6) through it, `/r/<name>/` routes (tasks 4, 7), a live bus per repository
  (task 4).
- [Stack](../decisions/stack.md): the binding's generated types (task 3), fate for every read (tasks
  5, 7), 127.0.0.1 and the guard unchanged (task 6).
- [Agents](../decisions/agents.md): the data folder's rules move to the core unchanged (tasks 1, 3);
  sessions untouched beyond their live updates' routing (task 4).
- [CLI](../decisions/cli.md): `ura add`, its messages, and the skill's row (task 2).
- [UI layout](../decisions/ui-layout.md), [UI behaviour](../decisions/ui-behaviour.md),
  [UI components](../decisions/ui-components.md): the menu, the form, and the pages (task 8),
  checked at both widths (task 9).
- [Toolchain](../decisions/toolchain.md): every task ends on `vp run ready`.

## Complexity tracking

| Abstraction or exception                        | Why it is needed                                                                                                    | Simpler alternative rejected because                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `Hosts` registry and `Host` (`repositories.ts`) | One owner for each repository's fate server, live bus, and watch, used by the routes, live updates, and mutations   | Maps spread over `app.ts`, `live.ts`, and `dev.ts` would each start and close watches |
| `createFate()` factory in `fate.ts`             | The decision requires a live bus per repository; fate's bus has no context, so each repository needs its own server | Repository-qualified IDs: every source, mutation, view, and hook reworked             |
| `startServer()` (`server.ts`)                   | `main.ts` and `dev.ts` wire the same parts; the start repository's rules would be written twice                     | Keeping both wirings: the spec's start behaviour in two places                        |
| A fate client per repository in the UI          | The cache is keyed by type and ID; two repositories' `workspace` records would collide                              | Qualified IDs, rejected with the factory above                                        |
| `repoPath()` helper in `routes.tsx`             | About 55 path literals in 14 files must gain `/r/<name>`; SC-003 needs one place that builds them                   | Prefixing each literal by hand: a missed one breaks SC-003 silently                   |
| Test helpers registering fixture repositories   | Every server and web test now reaches a repository through the list                                                 | Per-test wiring: boilerplate in every test file                                       |

---

## Task 1: The repository list in the core

**Files:**

- Create: `crates/core/src/repositories.rs`
- Modify: `crates/core/src/lib.rs` (`pub mod repositories;`)
- Test: `crates/core/tests/repositories.rs`

**Interfaces:**

- Consumes: `Git::discover`, `Git::main_root` ([`git.rs`](/crates/core/src/git.rs)),
  `today::rfc3339`, the write lock of `api.rs` (make `write_lock` `pub(crate)`).
- Produces:
  - `pub struct Repository { pub name: String, pub path: PathBuf, pub opened_at: String, pub missing: bool }`
  - `pub struct Added { pub repository: Repository, pub existed: bool }`
  - `pub enum ListError` (thiserror), with these `Display` texts: `Read(String)` →
    `repositories.json could not be read: {0}`; `NoSuchFolder(PathBuf)` → `No such folder: {path}.`;
    `NotARepository(PathBuf)` → `Not a git repository: {path}. Run git init there first.`;
    `Unknown(String)` → `No repository named “{name}”`; `Write(String)` →
    `repositories.json could not be written: {0}`
  - `pub fn data_dir(var: impl Fn(&str) -> Option<String>, os: &str, home: &Path) -> PathBuf` (`os`
    as `std::env::consts::OS` gives it), and `pub fn default_data_dir() -> PathBuf` from the
    process's environment
  - `pub fn read(data_dir: &Path) -> Result<Vec<Repository>, ListError>`, sorted by `opened_at`
    descending, then by name
  - `pub fn add(data_dir: &Path, folder: &Path, now: SystemTime) -> Result<Added, ListError>`,
    `folder` absolute; an existing entry is touched and returned with `existed: true`
  - `pub fn remove(data_dir: &Path, name: &str) -> Result<(), ListError>`
  - `pub fn touch(data_dir: &Path, name: &str, now: SystemTime) -> Result<Repository, ListError>`

- [x] **Step 1: Write the failing tests, and the helpers they use**

```rust
// crates/core/tests/repositories.rs
#[test]
fn a_missing_file_is_an_empty_list() {
    let data = tempdir();
    assert_eq!(repositories::read(data.path()).unwrap(), vec![]);
}

#[test]
fn adding_a_subfolder_adds_the_main_checkout() {
    let (data, repo) = (tempdir(), TestRepo::named("todo-app"));
    let added = repositories::add(data.path(), &repo.path().join("src"), at("2026-10-14T09:00:00Z")).unwrap();
    assert_eq!((added.repository.name.as_str(), added.repository.path.as_path(), added.existed),
               ("todo-app", repo.path(), false));
}

#[test]
fn adding_a_worktree_adds_its_main_checkout() { /* .worktrees/<branch> of a TestRepo → its main path */ }

#[test]
fn adding_twice_keeps_one_entry_and_touches_it() {
    // add at 09:00, add again at 11:00 → one entry, existed: true, opened_at "2026-10-14T11:00:00Z"
}

#[test]
fn names_are_unique() {
    // table: (existing paths, new path) → name
    //   []                                        "/…/dev/todo-app"   → "todo-app"
    //   ["/…/dev/todo-app"]                       "/…/work/todo-app"  → "work-todo-app"
    //   ["/…/dev/todo-app", "/…/work/todo-app"]   "/…/x/work/todo-app"→ "work-todo-app-2"
    //   []                                        "/…/dev/my app"     → "my-app"
}

#[test]
fn a_folder_outside_git_is_refused() {
    // add(tempdir) → Err, Display "Not a git repository: <path>. Run git init there first.", file absent
}

#[test]
fn a_folder_that_does_not_exist_is_refused() { /* "No such folder: <path>." */ }

#[test]
fn the_list_is_most_recent_first() { /* uraeda 10:00, todo-app 09:00 → [uraeda, todo-app] */ }

#[test]
fn removing_leaves_the_folder() { /* remove("todo-app") → list empty, folder and its files unchanged */ }

#[test]
fn a_deleted_folder_is_missing() { /* add, delete the folder → read() gives missing: true */ }

#[test]
fn an_invalid_file_is_refused_and_kept() {
    // write "{not json" → read() Err starting "repositories.json could not be read: ";
    // add() refuses the same way; the file's bytes are unchanged
}

#[test]
fn an_unknown_version_is_refused() { /* {"version": 2, "repositories": []} → Read error */ }

#[test]
fn the_file_is_the_documented_json() {
    // after add: {"version":1,"repositories":[{"name":"todo-app","path":"…","openedAt":"2026-10-14T09:00:00Z"}]}
    // and no repositories.json.tmp left
}

#[test]
fn the_data_folder_follows_the_platform() {
    // table: (URAEDA_DATA_DIR, XDG_DATA_HOME, APPDATA, os, home) → path, the rows of
    // packages/server/src/__tests__/env.test.ts's data folder cases
}
```

`TestRepo::named` is added to
[`crates/core/tests/common/repo.rs`](/crates/core/tests/common/repo.rs) if it cannot name its
folder; `at(text)` parses an RFC 3339 instant for the tests.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test repositories`
- Expected: FAIL to compile, `unresolved import uraeda_core::repositories`.

- [x] **Step 3: Implement `crates/core/src/repositories.rs`**

The file format and naming rule are the spec's [Data](spec.md#data). `data_dir` ports `dataDir` from
[`runner/cache.ts`](/packages/server/src/runner/cache.ts) with the same results. Every write takes
the core's write lock, reads the file again, changes it, writes `repositories.json.tmp`, and renames
it over `repositories.json`, creating the data folder if needed; an unreadable file is never
written. `missing` is true when `Git::open(path)` fails or its `main_root()` differs from `path`.

- [x] **Step 4: Run all tests**

- Run: `cargo test -p uraeda-core`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates/core/src/repositories.rs crates/core/src/lib.rs crates/core/src/api.rs crates/core/tests/
git commit -m "feat(multi-repo-server): the repository list in the core"
```

## Task 2: `ura add`

**Files:**

- Create: `crates/cli/src/add.rs`, `crates/cli/tests/add.rs`
- Modify: `crates/cli/src/main.rs` (`Command::Add`), `skills/uraeda/SKILL.md` (the `ura` table)

**Interfaces:**

- Consumes: `repositories::{add, default_data_dir, ListError}` (task 1).
- Produces: `ura add [FOLDER]`, the current folder by default; a relative folder joins the current
  one.

- [x] **Step 1: Write the failing tests**

```rust
// crates/cli/tests/add.rs, each with URAEDA_DATA_DIR set to a temporary folder
#[test]
fn adds_the_repository_holding_the_current_folder() {
    // ura add in <todo-app>/src → code 0, stderr "added todo-app: <todo-app path>\n",
    // repositories.json lists todo-app
}

#[test]
fn adding_again_says_so() {
    // ura add <todo-app> twice → code 0, stderr "todo-app is already added: <todo-app path>\n"
}

#[test]
fn a_folder_outside_git_exits_1() {
    // ura add in a plain temporary folder → code 1,
    // stderr "ura: <path>: not in a git repository: run git init first\n"
}

#[test]
fn an_invalid_list_exits_1_and_is_kept() {
    // "{not json" in repositories.json → code 1, stderr starts
    // "ura: repositories.json could not be read: ", file unchanged
}
```

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-cli --test add`
- Expected: FAIL, `error: unrecognized subcommand 'add'`.

- [x] **Step 3: Implement `ura add`**

`add.rs` resolves the folder, calls `repositories::add` with `SystemTime::now()`, and prints the
spec's messages on stderr. `ListError::NotARepository(path)` prints
`<path>: not in a git repository: run git init first`, the CLI's wording for that error elsewhere;
other errors print their `Display`. Add the row to the skill's `ura` table:
`| ura add [folder] | Adds the repository holding a folder to the web UI's list |`.

- [x] **Step 4: Run all tests**

- Run: `cargo test -p uraeda-cli && cargo run -q -p uraeda-cli -- check specs`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add crates/cli/src/add.rs crates/cli/src/main.rs crates/cli/tests/add.rs skills/uraeda/SKILL.md
git commit -m "feat(multi-repo-server): ura add"
```

## Task 3: The list in the binding, and the data folder from the core

**Files:**

- Modify: `crates/core/src/view.rs` (`RepositoryView` and `AddedView`, `Repository` and `Added` in
  JavaScript, see
  [R4](rulings.md#r4-the-lists-javascript-types-are-views-and-the-data-folders-platform-cases-are-tested-in-rust)),
  `crates/core/src/api.rs` (the list's operations, `ListError` refused),
  `crates/binding/src/lib.rs`, `packages/binding/index.d.ts` and `index.js` (generated),
  `packages/server/src/env.ts` (`loadDataDir`), `packages/server/src/runner/cache.ts` (remove
  `dataDir`)
- Test: `packages/binding/repositories.test.ts`, next to the binding's `index.test.ts`,
  `packages/server/src/__tests__/env.test.ts`, `packages/server/src/runner/__tests__/cache.test.ts`
  (its data folder table goes: the core's `data_dir` test holds its cases)

**Interfaces:**

- Consumes: task 1's functions.
- Produces, in the binding:
  - `dataDir(override?: string | null): string`, synchronous: the override when set, else
    `default_data_dir()`
  - `readRepositories(dataDir: string): Promise<Array<Repository>>`, `Repository` being
    `{ name: string; path: string; openedAt: string; missing: boolean }`
  - `addRepository(dataDir: string, folder: string): Promise<Added>`, `Added` being
    `{ repository: Repository; existed: boolean }`
  - `removeRepository(dataDir: string, name: string): Promise<void>`
  - `openRepository(dataDir: string, name: string): Promise<Repository>`
  - Errors reject with `refused: <ListError's Display>`.
- `loadDataDir(root, environment)` keeps its signature and results, through `binding.dataDir`.

- [x] **Step 1: Write the failing tests**

```ts
// packages/binding/repositories.test.ts
test("a repository added through the binding is read back", async () => {
  const data = tempDir();
  const repo = fixtureRepo();
  await binding.addRepository(data, repo);
  expect(await binding.readRepositories(data)).toEqual([
    {
      name: basename(repo),
      path: realpathSync(repo),
      openedAt: expect.any(String),
      missing: false,
    },
  ]);
});

test("a folder outside git is refused", async () => {
  const folder = tempDir();
  await expect(binding.addRepository(tempDir(), folder)).rejects.toThrow(
    `refused: Not a git repository: ${folder}. Run git init there first.`,
  );
});
```

The data folder cases of `env.test.ts` stay, now through the binding: `.env` and the environment as
overrides, and no override giving `binding.dataDir()`; the platforms' defaults are the core's
`data_dir` table test (R4).

- [x] **Step 2: Run them to check they fail**

- Run: `vp run --filter uraeda-binding build && vp test packages/binding`
- Expected: FAIL, `binding.addRepository is not a function`.

- [x] **Step 3: Implement the exports and switch `loadDataDir` to `binding.dataDir`**

`loadDataDir` reads `URAEDA_DATA_DIR` from the environment, then `<root>/.env`, as today, and passes
it as the override. Remove `dataDir` from `runner/cache.ts`. Add to
[`.env.example`](/.env.example)'s `URAEDA_DATA_DIR` comment: "`ura add` reads the environment only:
set it there too, or the CLI and the server use two lists."

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS, and `git status` shows the regenerated `index.d.ts` staged with this task.

- [x] **Step 5: Commit**

```bash
git add crates/ packages/binding/ packages/server/src/env.ts packages/server/src/runner/cache.ts packages/server/src/__tests__/env.test.ts .env.example
git commit -m "feat(multi-repo-server): the repository list in the binding"
```

## Task 4: A host per repository, and the `/r/:name/` routes

**Files:**

- Create: `packages/server/src/repositories.ts`
- Modify: `packages/server/src/fate.ts` (`createFate`), `fate/context.ts`, `live.ts` (`publish`,
  `sessionPublisher`, the watches move to hosts), `app.ts`, `files.ts`, `testing.ts`, `main.ts` and
  `dev.ts` (the hosts, R5), `packages/server/src/__tests__/helpers.ts`,
  `packages/web/src/__tests__/helpers.tsx` (`createApp`'s new options),
  `packages/web/vite.browser.config.ts` (`forgetRepo` awaited)
- Test: `packages/server/src/__tests__/repositories.test.ts`, `live.test.ts`

**Interfaces:**

- Consumes: task 3's binding functions.
- Produces:
  - `fate.ts`: `createFate(): { fateServer: FateServer; live: LiveBus }`, each server with its own
    live bus; the module still exports `fateServer` and `live`, the global ones.
  - `repositories.ts`:
    `type Host = { name: string; path: string; missing: boolean; fate: FateServer; live: LiveBus }`
    and `class Hosts` with
    `static async open(options: { binding: Binding; dataDir: string; sessions: Sessions }): Promise<Hosts>`,
    `get(name: string): Host | undefined`, `byPath(path: string): Host | undefined`,
    `rows(): Array<Repository>` (the binding's order), `problem: string | null`,
    `mostRecent(): Host | undefined`, `all(): Array<Host>`, `reload(): Promise<void>`, and
    `close(): void`, which closes every watch. A missing repository's host has no watch.
  - `Context` becomes
    `{ binding: Binding; sessions: Sessions; hosts: Hosts; dataDir: string; repo: string }`.
  - `publish(changes, host: Host, sessions?: Sessions)` sends on `host.live`;
    `sessionPublisher(cache, hosts: HostsOf)` sends each change on
    `hosts()?.byPath(change.repo)?.live`, dropping it when there is none; the `Agent` update goes on
    every bus, the global one too. `HostsOf` is `() => Pick<Hosts, "byPath" | "all"> | undefined`,
    the hosts once open; `createSessions`, `startSessions`, and `fakeSessions` take it as `hosts`
    ([R5](rulings.md#r5-the-session-manager-reaches-the-hosts-once-they-open-and-the-global-endpoint-is-the-starting-repositorys-host)).
  - `createApp(options: Options & { binding; sessions; hosts: Hosts; dataDir: string; repo: string })`:
    `/r/:name/fate`, `/r/:name/fate/live`, `/r/:name/raw/*`, `/r/:name/mockups/*` with the host's
    context and server; unknown name: 404, text `No repository named “<name>”`. `/fate`, `/raw/*`,
    and `/mockups/*` stay bound to `options.repo` until task 7, `/fate` on the fate server of its
    host when it is listed (R5).
  - Test helpers: `testApp(repo?)` and `testServer(repo?)` build a temporary data folder with the
    repository added, and return the app with `name`; `fate(app, operations)` posts to
    `/r/<name>/fate`, so existing tests keep their calls.
    `testHosts(repos, { installed?, binding? })` gives hosts on a new list of `repos`, and `fateAt`
    and `byIdAt` take the name.

- [x] **Step 1: Write the failing tests**

```ts
// packages/server/src/__tests__/repositories.test.ts
test("each repository's feature is read from its own endpoint", async () => {
  const { app, names } = await twoRepositories("2026-10-14-dark-mode"); // both have the folder, different titles
  const [a] = await byIdAt(app, names[0], "Feature", ["2026-10-14-dark-mode"], ["title"]);
  const [b] = await byIdAt(app, names[1], "Feature", ["2026-10-14-dark-mode"], ["title"]);
  expect([a.title, b.title]).toEqual(["Dark mode in uraeda", "Dark mode in todo-app"]);
});

test("an unknown name is a 404", async () => {
  const { app } = await testApp();
  const response = await app.request("http://127.0.0.1:4310/r/old-site/fate", { method: "POST" });
  expect([response.status, await response.text()]).toEqual([404, "No repository named “old-site”"]);
});

test("a repository's raw file is served under its name", async () => {
  const { app, name } = await testApp();
  const response = await app.request(`http://127.0.0.1:4310/r/${name}/raw/specs/PRIORITIES.md`);
  expect(response.status).toBe(200);
});

test("a missing repository's host starts without a watch", async () => {
  /* delete the folder before open; Hosts.open resolves; get(name).missing */
});

// packages/server/src/__tests__/live.test.ts
test("a change in one repository sends no update to another", async () => {
  const { hosts, names } = await twoHosts();
  const heard = listen(hosts.get(names[0])!.live, "Workspace", "workspace");
  writeSpec(hosts.get(names[1])!.path, "specs/PRIORITIES.md", "# Priorities\n");
  await settle(); // past the watcher's 200 ms quiet time
  expect(heard()).toEqual([]);
});

test("a session's change goes to its repository's bus", async () => {
  /* sessionPublisher → only that host hears Session <id> */
});

test("a session's change in a removed repository is dropped", async () => {
  /* byPath undefined → no bus hears it */
});
```

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/repositories.test.ts`
- Expected: FAIL, `Cannot find module '../repositories.ts'`.

- [x] **Step 3: Implement the hosts, the factory, and the routes**

`Hosts.open` reads the list, and creates one host per entry with `createFate()`, starting its watch
through `binding.watch` unless missing; a watch that fails to start is logged, as `main.ts` does
today, and the host serves without live updates. `reload` diffs the list by name: new hosts start,
removed hosts close their watch and leave. Contexts are built per request from the host.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/server/src/ packages/web/src/__tests__/helpers.tsx packages/web/vite.browser.config.ts specs/2026-10-13-multi-repo-server/
git commit -m "feat(multi-repo-server): a fate endpoint and live updates per repository"
```

## Task 5: The list through fate: suggestions, add, remove, open

**Files:**

- Create: `packages/server/src/folders.ts`
- Modify: `fate/views.ts` (`Repositories`, `FolderSuggestions`, `REPOSITORIES_ID = "repositories"`),
  `fate/sources.ts`, `fate/mutations.ts`, `fate.ts` (exports), `repositories.ts` (watching
  `repositories.json`)
- Test: `packages/server/src/__tests__/repositories.test.ts`, `folders.test.ts`

**Interfaces:**

- Consumes: `Hosts` (task 4), the binding's list functions (task 3).
- Produces:
  - Views:
    `Repositories { id, rows: Array<{ name; path; home; missing }>, problem: string | null }`,
    `home` the path with the home folder written `~`;
    `FolderSuggestions { id, rows: Array<{ path; git }> }`, id the typed text.
  - `folders.ts`:
    `suggest(text: string, home: string): Promise<Array<{ path: string; git: boolean }>>` and
    `typedFolder(text: string, home: string): string`, which expands `~` and throws
    `Type an absolute path, starting with / or ~.` for any other start.
  - Mutations: `repositories.add({ folder }) → Repository record` (the typed text, expanded by
    `typedFolder`), `repositories.remove({ name })`, `repositories.open({ name })`; each answers
    with the list's new `Repositories` record, and a change sends a `Repositories` update on every
    host's bus and the global one.
  - `Hosts` watches the data folder with `node:fs` `watch`, filtered on `repositories.json`,
    debounced 100 ms, and calls `reload`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/server/src/__tests__/folders.test.ts
test("suggestions list matching folders, git ones marked, hidden ones left out", async () => {
  const home = tree({
    "dev/todo-app/.git/": "",
    "dev/tools/": "",
    "dev/.cache/": "",
    "dev/todo.txt": "x",
  });
  expect(await suggest("~/dev/to", home)).toEqual([
    { path: "~/dev/todo-app/", git: true },
    { path: "~/dev/tools/", git: false },
  ]);
});
test("a dot shows hidden folders", async () => {
  /* "~/dev/.c" → ["~/dev/.cache/"] */
});
test("at most 20, sorted by name", async () => {
  /* 25 folders a00..a24 → a00..a19 */
});
test("a relative path gets no suggestions", async () => {
  /* "dev/to" → [] */
});
test("an unreadable folder gets no suggestions", async () => {
  /* chmod 000 → [] */
});

// packages/server/src/__tests__/repositories.test.ts
test("adding a git folder adds its main checkout", async () => {
  /* US2.2, US2.4 */
});
test("adding a folder outside git is refused", async () => {
  // result.error.message === "refused: Not a git repository: <path>. Run git init there first."
});
test("adding a relative path is refused", async () => {
  /* "Type an absolute path, starting with / or ~." */
});
test("removing leaves the folder and its sessions", async () => {
  /* US5.1: cache.sessions(root) unchanged */
});
test("removing while an agent works is refused", async () => {
  // a fake session with a running turn → "refused: An agent is working in <name>: stop it first."
});
test("ura add reaches a running server within a second", async () => {
  // SC-004: binding.addRepository(dataDir, other) from outside the server; a listener on the global
  // bus hears Repositories within 1000 ms, and hosts.get(name) exists
});
test("an invalid list keeps the hosts and reports the problem", async () => {
  // write "{not json" → Repositories.problem starts "repositories.json could not be read: ",
  // hosts unchanged, add refused with the same message
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/folders.test.ts`
- Expected: FAIL, `Cannot find module '../folders.ts'`.

- [ ] **Step 3: Implement the views, sources, mutations, and the file watch**

`suggest` splits the text at its last `/`: the folder before it is read with `readdir`
(`withFileTypes`), folders only, whose names start with the rest, case-insensitively; names starting
with `.` only when the rest does; `git` when the folder holds a `.git` entry. Paths keep the prefix
as typed. `repositories.remove` refuses when `sessions.working(host.path)` is not empty.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/
git commit -m "feat(multi-repo-server): add, remove, and complete repositories through fate"
```

## Task 6: One server wiring, and starting anywhere

**Files:**

- Create: `packages/server/src/server.ts`
- Modify: `main.ts`, `dev.ts`, `live.ts` (`startSessions` moves to `server.ts`), `options.ts`
  (whether the repository was given), `packages/web/vite.config.ts` if `devHandler`'s options change
- Test: `packages/server/src/__tests__/server.test.ts`, `main.test.ts`, `dev.test.ts`

**Interfaces:**

- Consumes: `Hosts` (tasks 4, 5), `startSessions`, which takes the hosts as `hosts: HostsOf` (R5).
- Produces:
  - `startServer(options: Options & { binding: Binding; dataDir: string; adapter: Adapter; given: boolean }): Promise<{ app: Hono; hosts: Hosts; sessions: Sessions; stop(): Promise<void> }>`:
    when `options.repo` is in git, adds it (which touches it); otherwise throws
    `<repo> is not a git repository` when `given`, else logs
    `uraeda-server: <repo> is not in a git repository: add one from the web UI`.
  - `Options.given: boolean`, true when `--repo` or `URAEDA_REPO` named the repository.
  - `devHandler(root, { adapter? })` keeps one app per port, built by `startServer`; `forgetRepo`,
    which since task 4 removes the repository from the list, is removed, replaced in tests by
    removing it from the list.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/server/src/__tests__/server.test.ts
test("starting in a repository adds it, opened first", async () => {
  // US3.1: empty data folder, repo = fixtureRepo() → hosts.mostRecent().path === realpath(repo)
});
test("starting outside git keeps the list's most recent", async () => {
  // US3.2: list holds todo-app; repo = plain temp folder, given false → resolves, mostRecent todo-app,
  // console.error called with "uraeda-server: <dir> is not in a git repository: add one from the web UI"
});
test("a given folder outside git stops the start", async () => {
  // US3.4: given true → rejects "<dir> is not a git repository"
});

// packages/server/src/__tests__/main.test.ts (process tests, as today)
test("a busy port exits 1 and names the first server", async () => {
  // a listener on the port, then main.ts --port <it> → code 1, stderr
  // "uraeda-server: port <port> is in use: another Uraeda server may run at http://127.0.0.1:<port>/\n"
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/server.test.ts`
- Expected: FAIL, `Cannot find module '../server.ts'`.

- [ ] **Step 3: Implement `server.ts`, and rewrite `main.ts` and `dev.ts` on it**

`main.ts` keeps its printed URL and signal handling, and maps `EADDRINUSE` from `serve` to the busy
port's message. `dev.ts` builds the server on the first request for a port.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/ packages/web/vite.config.ts
git commit -m "feat(multi-repo-server): one server wiring, started anywhere"
```

## Task 7: Repository URLs and clients in the UI

**Files:**

- Modify: `packages/web/src/routes.tsx`, `App.tsx`, `main.tsx`, `data.ts` (`useRepositories`),
  `useRoundPosition.ts`, and the path builders: `Crumbs.tsx`, `DocumentPage.tsx`, `EditorPage.tsx`,
  `FeaturePage.tsx`, `FilePage.tsx`, `Home.tsx`, `MockupPage.tsx`, `SessionNav.tsx`,
  `SessionPage.tsx`, `Shell.tsx`, `TaskView.tsx`, `labels.ts`, `sessions.ts`;
  `packages/server/src/app.ts`, `files.ts`, `fate/context.ts` (the global endpoint loses its
  repository); `packages/web/src/__tests__/helpers.tsx`
- Create: `packages/web/src/RepositoryPages.tsx` (missing folder, unknown name)
- Test: `packages/web/src/__tests__/routes.test.ts`, `repositories.test.tsx`, `links.test.ts`

**Interfaces:**

- Consumes: the `/r/:name/` routes (task 4), `Repositories` (task 5).
- Produces:
  - `parseLocation(pathname: string): { repo: string | null; route: Route }`; `Route` gains
    `{ page: "first-run" }`; a page path without `/r/<name>` parses with `repo: null`.
  - `repoPath(repo: string, path: string): string` → `/r/${encodeURIComponent(repo)}${path}`, and
    `useRepoPath(): (path: string) => string` for the current repository; `pathLink` takes the
    repository.
  - `App({ clientFor }: { clientFor: (repo: string | null) => FateClient })`: the page tree under
    `<FateClient key={repo}>`; `main.tsx` caches one client per name, `/r/<name>/fate`, and the
    global one, `/fate`.
  - `useRepositories(): RepositoriesRecord`, id `repositories`.
  - Server: `Context.repo: string | null`; on the global endpoint, a repository's record or mutation
    refuses with `refused: no repository`; `/raw/*` and `/mockups/*` answer 307 to the most recent
    repository's, and 404 without one.
  - `renderPage(path, repo, options)` registers `repo`, and takes the path without the prefix, which
    it adds; `serverFetch(repo)` serves the whole app.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/web/src/__tests__/routes.test.ts (table-driven)
test.each([
  ["/r/uraeda/", { repo: "uraeda", route: { page: "home" } }],
  [
    "/r/uraeda/f/2026-10-14-dark-mode",
    { repo: "uraeda", route: { page: "feature", folder: "2026-10-14-dark-mode" } },
  ],
  [
    "/f/2026-10-14-dark-mode",
    { repo: null, route: { page: "feature", folder: "2026-10-14-dark-mode" } },
  ],
  ["/", { repo: null, route: { page: "home" } }],
])("parses %s", (path, expected) => expect(parseLocation(path)).toEqual(expected));

// packages/web/src/__tests__/repositories.test.tsx
test("a path without a repository opens it in the most recent", async () => {
  // US6.3: list [uraeda 10:00, todo-app 09:00]; renderPage at raw "/f/<folder>" → location
  // "/r/uraeda/f/<folder>"
});
test("an unknown name says so, with a link to the most recent", async () => {
  // US6.4: "/r/old-site/" → heading "No repository named “old-site”", link "Open uraeda" → "/r/uraeda/"
});
test("a missing folder shows where it was", async () => {
  // US5.5: delete the folder → "Folder not found", its path, button "Remove from Uraeda"
});
test("a removed repository's open page says it is unknown", async () => {
  /* review focus 1 */
});
test("a code link opens the repository's raw file", async () => {
  /* US6.5: href "/r/<name>/raw/packages/server/src/app.ts" */
});

// packages/web/src/__tests__/links.test.ts
test("every link of a repository's pages starts with its prefix", async () => {
  // SC-003: render home, a feature, a file, the session, priorities, a task, the editor, a mockup;
  // every <a href> starting with "/" starts with "/r/<name>/"
});
```

```ts
// packages/server/src/__tests__/repositories.test.ts
test("the global endpoint refuses a repository's record", async () => {
  // review focus 6: byId on "/fate", Workspace → error "refused: no repository"
});
test("an old raw link redirects to the most recent repository", async () => {
  // GET /raw/specs/PRIORITIES.md → 307, location "/r/<name>/raw/specs/PRIORITIES.md"
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/routes.test.ts`
- Expected: FAIL, `parseLocation is not exported`.

- [ ] **Step 3: Implement the router, the clients, the pages, and the global endpoint's change**

Every path literal goes through `repoPath` or `useRepoPath`. On a page without a repository, the app
reads `Repositories` through the global client, then redirects to `repoPath(rows[0].name, path)`, or
shows "Add your first repository" (a placeholder heading until task 8) when the list is empty. A
repository's page first checks its row: missing shows "Folder not found", absent shows "No
repository named …". The round position's key becomes `uraeda.round.<repo>/<folder>/<file>`.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/ packages/server/src/
git commit -m "feat(multi-repo-server): every page and link under its repository"
```

## Task 8: The repository menu, the add form, and the first run

**Files:**

- Create: `packages/web/src/RepositoryMenu.tsx`, `packages/web/src/AddRepository.tsx`
- Modify: `Shell.tsx` (`Heading`), `RepositoryPages.tsx` (first run), `data.ts`
  (`useFolderSuggestions`)
- Test: `packages/web/src/__tests__/repository-menu.test.tsx`, `add-repository.test.tsx`

**Interfaces:**

- Consumes: `useRepositories`, `useRepoPath`, `navigate` (task 7); the mutations of task 5.
- Produces: `RepositoryMenu` in the heading, wide and folded; `AddRepository({ inline?: boolean })`,
  in an overlay from the menu and inline on the first run; `useFolderSuggestions(text: string)`.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__tests__/repository-menu.test.tsx
test("the menu lists repositories, most recent first, the current one checked", async () => {
  // US1.1: [uraeda 10:00, todo-app 09:00] on "/r/uraeda/" → open "uraeda" heading → rows
  // ["uraeda ~/dev/uraeda" checked, "todo-app ~/dev/todo-app"], then "Add a repository…"
});
test("picking a repository opens its home in two clicks", async () => {
  // US1.2, SC-001: click heading, click "todo-app" → location "/r/todo-app/", heading "todo-app";
  // two user clicks counted
});
test("the filter keeps names and paths that match", async () => {
  /* US1.3: "todo" */
});
test("opening a repository moves it first", async () => {
  /* US1.4: repositories.open sent, row order */
});
test("removing from the menu leaves the list", async () => {
  /* US5.1 */
});
test("removing the current repository opens the next one", async () => {
  // US5.2: on "/r/todo-app/f/2026-10-14-dark-mode", remove todo-app → "/r/uraeda/"; the last one →
  // "Add your first repository"
});
test("removing while an agent works shows the refusal in the menu", async () => {
  /* US5.3 */
});
test("a missing folder is marked in its row", async () => {
  /* US5.4: "Folder not found: ~/work/client-site" */
});
test("an unreadable list shows its problem in the menu", async () => {
  /* edge case */
});

// packages/web/src/__tests__/add-repository.test.tsx
test("typing completes folders, git ones marked", async () => {
  /* US2.1 */
});
test("adding a folder opens it", async () => {
  /* US2.2: form closes, "/r/todo-app/" */
});
test("a folder outside git keeps the form open with the error", async () => {
  /* US2.3 */
});
test("adding a known repository opens it", async () => {
  /* US2.5 */
});
test("the error goes once the text changes", async () => {
  /* ui-behaviour */
});
test("an empty list shows the first run, with the field set to ~/", async () => {
  // US3.3: no navigation, heading "Add your first repository", field value "~/"
});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/repository-menu.test.tsx`
- Expected: FAIL, no button named "uraeda" in the heading (it is a link today).

- [ ] **Step 3: Implement the menu, the form, and the first run**

Follow the [mockups](mockups/repositories.html): Astryx's menu components with adaptive
presentation, the form in the project's `Overlay` (dialog or sheet), its field an Astryx `Typeahead`
fed by `useFolderSuggestions`, at most one request in flight per text. The menu calls
`repositories.open` the first time a repository's page shows in the tab. Paths show with the home
folder as `~`, as `Repositories.rows[].home` gives them.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/
git commit -m "feat(multi-repo-server): the repository menu, the add form, and the first run"
```

## Task 9: Both widths, browser tests on their own repositories, and the README

**Files:**

- Modify: `packages/web/vite.browser.config.ts` (`takeRepo`, `releaseRepo`),
  `packages/web/src/__browser__/setup.ts`, `helpers.tsx`, `README.md` (the web UI's section)
- Create: `packages/web/src/__browser__/repositories.test.tsx`

**Interfaces:**

- Consumes: everything above.
- Produces: `takeRepo()` returns `{ token, name }`, the fixture added to the test server's list
  under a unique name; browser tests open `/r/<name>/...`. The turn stays, for the one shared fake
  agent ([R2](rulings.md#r2-browser-tests-keep-their-turn-for-the-shared-agent)).

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/src/__browser__/repositories.test.tsx, at both sizes
test("the menu is a popover on wide screens and a sheet on narrow ones", async () => {
  /* layout checks of the mockup */
});
test("the add form is a dialog on wide screens and a sheet on narrow ones, with Close", async () => {});
test("the first run fits both widths without horizontal scroll", async () => {});
```

- [ ] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/vite.browser.config.ts`
- Expected: FAIL, `takeRepo` returns a number, not `{ token, name }`.

- [ ] **Step 3: Move the browser tests to their own repositories, and update the README**

The README's web UI section: the server serves several repositories, the top left switches them,
`ura add` adds the current folder, and `URAEDA_REPO` names the repository opened first.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/web/ README.md
git commit -m "test(multi-repo-server): the repository menu and form at both widths"
```
