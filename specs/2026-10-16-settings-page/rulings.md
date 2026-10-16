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
