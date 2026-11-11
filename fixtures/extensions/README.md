# Extension fixtures

Extensions the server's tests copy into a temporary config folder, each one a case of the
[extensions](/specs/decisions/extensions.md) decision's rules. They are written against the server
API of [`server.d.ts`](/crates/server/src/extensions/api/server.d.ts).

- `echo/`: a record, actions, a route, a setting, and a file it imports.
- `busy/`: a child process, a timer that writes a file, an action that never returns, and an action
  that reaches files, a command, and the web.
- `throws/`, `endless/`, `deep/`, `greedy/`, `later/`: broken on purpose, each its own way.
- `listener/`: the events of a repository.
- `agent/`: an agent runtime.
- `counter/`, `crashes/`, `loops/`: pages, which the app's tests of
  [`extensions.rs`](/crates/app/tests/extensions.rs) build, sign, and run in `uraeda.extension`: a
  place that reads a record and calls actions, a page that throws as it loads, and one whose place
  never stops drawing.
