# Rulings: Web UI for the workflow files

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The watcher waits for quiet itself, without notify-debouncer-full

- **Decision**: the core's watcher uses `notify` alone, and waits for 200 ms without a file event
  before it reads the workspace again, in its own thread.
- **Rationale**: the watcher reads the whole workspace again after each burst, so pairing an
  editor's rename-on-save events, which `notify-debouncer-full` does, changes nothing: the file is
  read as it is once the burst ends. One dependency less, and the quiet time is exactly the spec's
  200 ms ([`watch.rs`](/crates/core/src/watch.rs)).
- **Alternatives considered**: `notify-debouncer-full` 0.7, as the spec's design named it, whose
  batches can split a burst in two and would need the same quiet loop on top.
- **If wrong**: a burst of renames could report a file twice; adding the debouncer in front of the
  loop is a local change in `watch.rs`.
- **Where**: task 7 of the plan.
