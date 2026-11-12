# The earlier server's session store

`old.sqlite` is a `runner.sqlite` as the Node server's own store wrote one, at its last schema, 12.
`ura import-sessions` is tested on it: `crates/server/tests/runner_store.rs` and
`crates/cli/tests/import_sessions.rs` each import a copy of it, in a temporary folder.

**It is frozen.** A script drove the Node server's store, `SessionCache`, with a fixed clock and
fixed IDs, and wrote no row by hand. That store went with the Node server, and the script with it,
so the file cannot be written again: keep it as it is. The tests assert its sessions' IDs, their
times, and their texts. It goes with the importer, once the import has run.

What it holds, so that the import is tested on each:

- a feature's session with a model, an effort, a step, and an account; a sub-session of it; a chat
  without a folder, archived and seen; a session another server's process holds;
- turns of each kind (workflow, chat, allow) and each state (done, failed, stopped, queued,
  running), with tokens, a dismissal, a catch-up's commit, a continue that waits, one past the cap,
  and a run the server's stop cut;
- items of each kind: messages of the human and the workflow, pending, read, and taken back, with
  an opening, with images, and without a time; texts, whole and cut mid-stream; tool calls
  completed, failed, and left in progress, a sub-agent's and its own calls; thoughts with and
  without a text; system lines; blocked actions, one waiting to be allowed, one allowed, one no
  rule can allow;
- the scheduled jobs' runs: started with its offer refused, skipped for an open change, failed to
  start, and run by hand;
- text outside ASCII.
