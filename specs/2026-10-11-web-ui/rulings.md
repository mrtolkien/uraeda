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

## R2: Problems from `ura check` show for features read from disk

- **Decision**: a feature's page lists the problems `ura check` finds when the feature is read from
  a working tree, its checkout or its worktree; a feature read from its branch's tip lists the
  problems of its frontmatter only.
- **Rationale**: `ura check` reads files from disk, with the folder's other files and the links
  around them ([`check/mod.rs`](/crates/core/src/check/mod.rs)); a feature the UI wrote to always
  has its worktree, so the files the human edits are checked.
- **Alternatives considered**: checking texts read from git, which means a second entry point into
  every rule of `ura check`, links included.
- **If wrong**: a broken file on a branch checked out nowhere shows its problem once it is opened
  for writing, or with `ura check` on that branch.
- **Where**: `api::read_workspace`, task 8.

## R3: Refusals reach the UI as `BAD_REQUEST`, their kind in the message

- **Decision**: the server sends every refusal of the core as fate's `BAD_REQUEST`, its message
  starting with the core's code, `refused: `, `conflict: `, or `hook: `, the hook's output after a
  blank line; the UI reads the code from the message.
- **Rationale**: fate's client hands an error to the code that called the mutation only for the HTTP
  statuses of known codes, 400 among them; an unknown code such as `CONFLICT` goes to the nearest
  error boundary instead, which would replace the page
  ([`store-o9zgwPsF.mjs`](/node_modules/@nkzw/fate/lib/store-o9zgwPsF.mjs),
  `categorizeHTTPErrorStatus`).
- **Alternatives considered**: fate's `issues` field, made for validation issues with a message and
  a path each, which the hook's output does not fit.
- **If wrong**: a refusal whose message starts with another word shows as `refused`; the codes live
  in `crates/binding/src/lib.rs` and the UI's error helper only.
- **Where**: task 9.
