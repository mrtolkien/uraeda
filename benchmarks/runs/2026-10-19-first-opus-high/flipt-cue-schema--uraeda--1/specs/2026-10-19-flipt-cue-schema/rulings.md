# Rulings: Default configuration validates against the CUE schema

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The storage configuration clears its unselected pointers in `validate`

- **Decision**: `StorageConfig.validate` first sets to nil the pointer of every storage type not
  selected, then validates the selected one.
- **Rationale**: the spec puts the clearing in the storage configuration, after decoding and before
  validation. `Load` runs each section's `validate` right after decoding, and
  `AuthenticationConfig.validate` already normalizes a value there, the session domain
  ([`authentication.go`](/internal/config/authentication.go)).
- **Alternatives considered**: a new post-decode interface that `Load` calls before the validators:
  more machinery in `Load` for one caller.
- **If wrong**: a caller that builds a `StorageConfig` and never validates it keeps a leftover
  pointer; moving the clearing into its own method, called by `Load`, is a few lines.
- **Where**: task 3 of the plan, `internal/config/storage.go`.

## R2: The inbox notes are committed on the feature branch

- **Decision**: the two notes the spec names go into `specs/INBOX.md` in task 5's commit, on this
  branch, rather than in a separate commit on the default branch.
- **Rationale**: committing to the default branch from this run is a side effect outside the
  feature's branch; on this branch, the notes reach the default branch with the pull request, and
  the reviewer sees them there.
- **Alternatives considered**: a commit on `main`, as the inbox's own instructions describe for a
  checkout of the default branch.
- **If wrong**: the notes wait for the merge; moving them is a cherry-pick.
- **Where**: task 5 of the plan, `specs/INBOX.md`.

## R3: Schema tests live in their own file, with snippets compiled by CUE

- **Decision**: the schema tests are in `internal/config/schema_test.go`, and the US3 cases are
  small configurations written inline and compiled with `ctx.CompileString`, rather than new
  testdata files.
- **Rationale**: each case is a few lines, read next to its expected result; a separate file keeps
  task 5 apart from task 4's changes to `config_test.go`, so both build in the same wave.
- **Alternatives considered**: YAML files under `testdata/`, one per case: a dozen files for one
  table.
- **If wrong**: moving the snippets to files changes no assertion.
- **Where**: task 5 of the plan.

## R4: The storage rule stays in both Go and the schema

- **Decision**: the final review's finding that "only the selected backend's section" is enforced
  both by `StorageConfig.validate` and by the schema's closed storage forms, with the storage
  defaults written in `setDefaults` and in the schema, is not acted on.
- **Rationale**: the schema documents the file; Go enforces it at run time. Every section of the
  configuration already has this pair, by the spec's choice to keep a hand-written schema, and the
  schema test checks they agree on the defaults.
- **Alternatives considered**: generating the schema from the Go types: a new tool, beyond the
  proposal.
- **If wrong**: a storage default changed in one place only goes unnoticed; the inbox's note on
  porting the schema covers the same drift for the JSON schema.
- **Where**: `internal/config/storage.go`, `config/flipt.schema.cue`.
