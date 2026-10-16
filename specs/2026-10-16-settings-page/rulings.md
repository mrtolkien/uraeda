# Rulings: Settings page

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: `vp dev`'s own host check keeps reading the variable only

- **Decision**: Vite's `server.allowedHosts`, which guards `vp dev`'s own pages, stays
  `URAEDA_ALLOWED_HOSTS` and the checkout's `.env`; the server's routes inside `vp dev` follow the
  settings like the packaged server.
- **Rationale**: Vite reads its config before the binding loads, and the binding's reads are
  asynchronous; `vp dev` is a contributor's tool, and the packaged server, which users run, follows
  the file.
- **Alternatives considered**: `allowedHosts: true` in Vite, which drops Vite's DNS-rebinding check;
  a synchronous read of the file in the binding, a second shape for one caller.
- **If wrong**: a host name added on the page reaches `vp dev`'s pages only once it is in `.env`;
  undoing it means a synchronous core read for Vite's config.
- **Where**: task 3, `packages/server/src/dev.ts`

## R2: `vp dev` takes its port from the variable, not the file

- **Decision**: under `vp dev`, the port stays Vite's, from `URAEDA_PORT` or 4310; the Server
  category still shows the file's value and its source as the precedence computes them.
- **Rationale**: same as R1: Vite's port is fixed when its config is read.
- **Alternatives considered**: the file's port read synchronously for Vite.
- **If wrong**: a contributor sees a port on the page that `vp dev` does not use.
- **Where**: task 2, `packages/server/src/dev.ts`

## R3: The settings API lives in its own core module, not in `api.rs`

- **Decision**: `uraeda_core::settings` returns `ApiError` itself, and the binding calls it from its
  own `settings` submodule.
- **Rationale**: `api.rs` is over the 500-line limit, so touching it would need a structural split
  first; the settings API needs nothing else from it.
- **Alternatives considered**: `api/settings.rs` re-exported from `api.rs`, two lines in a file over
  its limit.
- **If wrong**: a later move into `api/`, with no change to callers but the binding.
- **Where**: task 1

## R4: One-time sign-in link pages move to `run/` too

- **Decision**: `sign-in-links/<port>/` becomes `run/sign-in-links/<port>/`, with the Storybook
  records and the host token.
- **Rationale**: the settings decision puts every file that only lives while a server runs in
  `run/`; these pages are removed when their server stops.
- **Alternatives considered**: leaving them in the root, against the decision's rule.
- **If wrong**: nothing reads them after their server stops.
- **Where**: task 4

## R5: Editing or removing a name that is not listed is refused

- **Decision**: "<name> is not an allowed host name." for an edit or a removal of a name the file
  does not list, as when a hand edit removed it meanwhile.
- **Rationale**: the spec names no text for this case; a silent success would hide a change made
  elsewhere.
- **Alternatives considered**: removing nothing and answering the record.
- **If wrong**: one more message to change.
- **Where**: task 1

## R6: The file's other problems, and their messages

- **Decision**: the problems the spec names no text for read, after "Cannot read <file>: ":
  `line N: <the parser's message>.` for a file that does not parse, like "line 1: unclosed table,
  expected `]`."; "line N, server: [server] is a table of settings."; "line N, allowed_hosts: The
  allowed host names are a list, like ["mac.tail1234.ts.net"]."; "line N, open_browser: Opening a
  browser at start is true or false."; and the I/O error's kind, "permission denied.", for a file
  that exists but cannot be read. A host name in the file is read trimmed and in lower case, as one
  typed on the page is saved. The file is read with `toml_edit::Document`, which keeps spans, rather
  than through `toml_edit::de`, so each problem has its line.
- **Rationale**: the spec gives the shape, "line 3, port: …", and the texts for host names and ports
  only; every problem keeps that shape.
- **Alternatives considered**: the parser's full report, several lines with a caret, in a one-line
  banner; serde's messages, which name Rust types.
- **If wrong**: a few messages to change, in `crates/core/src/settings/file.rs`.
- **Where**: task 1

## R7: An empty variable is unset; an empty flag is given

- **Decision**: `URAEDA_ALLOWED_HOSTS=` and `URAEDA_PORT=`, set but empty, count as unset, so the
  next source applies: an empty variable in the environment leaves `.env`'s value, and an empty one
  there the file's. `--allowed-hosts ""` is given, and allows no host name for the run.
- **Rationale**: `URAEDA_REPO`, `URAEDA_DATA_DIR`, and `URAEDA_CONFIG_DIR` already read an empty
  value as unset, and a `.env` line left empty means "not set"; a flag typed on the command line is
  a deliberate choice for the run.
- **Alternatives considered**: an empty `URAEDA_ALLOWED_HOSTS` overriding the file with no host
  names, as it gave none before this feature.
- **If wrong**: one condition in `loadEnv`, and one in `settings` for `.env`.
- **Where**: task 2, `packages/server/src/env.ts`

## R8: A name listed twice is edited and removed in every place

- **Decision**: when the file lists a name more than once, in any case, as a hand edit can, removing
  it removes every copy, and editing it replaces the first and removes the others.
- **Rationale**: the page shows each name once, read in lower case; acting on one copy would leave
  the name allowed after the page said it was removed.
- **Alternatives considered**: acting on the first copy only; refusing the change until the file is
  fixed.
- **If wrong**: one loop in `crates/core/src/settings.rs`.
- **Where**: task 1

## R9: A name's comments are the lines above it and the one ending its line

- **Decision**: in a list of one name per line, a name added goes on a line of its own, indented
  like the last name; a name removed takes with it the comment lines above it and the comment ending
  its line, and every other name keeps its own. A file with any `\r\n` line end is written with
  `\r\n` line ends throughout, and a leading byte order mark stays.
- **Rationale**: SC-002 keeps every other byte; a comment is read as the human wrote it, about the
  name it sits above or beside.
- **Alternatives considered**: `toml_edit`'s own layout, which moves a removed name's comment onto
  the next one and puts a name added after the last one's line end.
- **If wrong**: a file mixing line ends gets `\r\n` everywhere; a comment above a name meant for the
  one before goes with the wrong one.
- **Where**: task 1, `crates/core/src/settings/list.rs` and `crates/core/src/settings/file.rs`

## R10: The live host-name tests have their own file

- **Decision**: the started server's tests of host names changing while it runs, US1.1, US1.3,
  SC-001, and review focus 1, are in `packages/server/src/__tests__/allowed-hosts.test.ts`, not
  `server.test.ts`.
- **Rationale**: a test file about one concern, host names applied live, read apart from the
  server's other tests; tests are exempt from the 500-line limit, so the limit is not the reason.
- **Alternatives considered**: the tests in `server.test.ts`, already at 497 lines of other
  concerns.
- **If wrong**: the tests move, unchanged.
- **Where**: task 3

## R11: A port given by a flag or a variable that is not one refuses the start

- **Decision**: `--port` and `URAEDA_PORT` are checked with the core's port rule, the file's, as the
  start reads the settings; one that is not a port, `--port ""` included, stops the start with
  `uraeda: The port is a number from 1 to 65535.`, exit 1, before the port is taken.
- **Rationale**: a value typed for the run is a deliberate choice (R7): falling back to the file or
  the default would start on a port the user did not ask for; the rule has one home, the core.
- **Alternatives considered**: ignoring the invalid value, as a broken file is; Node's own errors,
  which listened on a random port for `0`.
- **If wrong**: one call in `checked`, `packages/server/src/settings.ts`.
- **Where**: task 2, `packages/server/src/settings.ts`

## R12: A symlinked `config.toml` is watched at its target, the folder from the nearest one there

- **Decision**: each read resolves the file's real path; when a symlink leads to another folder or
  name, that folder is watched too, for that name, and follows the link when it changes. A config
  folder that does not exist is never made by a start: the nearest folder above it is watched until
  it appears. A symlink to nothing is not followed: the file it would point to, made by hand, is
  seen at the next change in the config folder or restart; a write from the page replaces the link.
- **Rationale**: dotfiles managers like GNU Stow link the file; `fs.watch` reports only the watched
  folder's own entries.
- **Alternatives considered**: polling the file with `fs.watchFile`, slower to answer and a timer
  per server; making the folder at start, which the spec's edge case leaves to the first write.
- **If wrong**: `packages/server/src/settings-watch.ts` alone.
- **Where**: task 2, `packages/server/src/settings-watch.ts`

## R13: The old running files are three names in the data folder's root

- **Decision**: the first start removes exactly `storybooks/`, `sign-in-links/`, and the files named
  `server-<digits>.token` in the data folder's root, after killing the groups the old `storybooks/`
  lists; every other entry stays, a file the human put there included. `run-folder.ts` names the old
  record's folder, `oldGroupsFolder(dataDir)`, for both that kill and the removal.
- **Rationale**: the spec removes the old process files, not the data folder's other content; a
  wider match, like every `server-*` name, would remove files Uraeda never wrote.
- **Alternatives considered**: removing every root entry that is not Uraeda's data, which deletes
  what a human keeps there; the old folder's name written again in `server.ts`.
- **If wrong**: one pattern in `packages/server/src/run-folder.ts`.
- **Where**: task 4, `packages/server/src/run-folder.ts`
