---
kind: feature
finished: 2026-10-19
---

# Record: Default configuration validates against the CUE schema

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19; no pull request could be opened from the agent's environment, so the branch
> `2026-10-19-flipt-cue-schema` was pushed for review. Its full files are in git:
> `git log -- specs/2026-10-19-flipt-cue-schema/`.

## What and why

Flipt keeps a hand-written CUE schema of its configuration file,
[`config/flipt.schema.cue`](/config/flipt.schema.cue), that nothing checked against the Go
configuration: it no longer compiled (`boolean` is not a CUE type), and it rejected 12 fields of the
default configuration. The proposal asked for a public `DefaultConfig()`, an exported `DecodeHooks`,
a schema that accepts the decoded default configuration under concrete validation, and Go types that
do not emit empty values the schema rejects, so the default configuration and the documented
contract cannot drift apart again.

## Behaviour

- `DefaultConfig()` returns the configuration `Load` gives for an empty file and no environment
  variables. It is a Go literal, a copy of the defaults each section's `setDefaults` sets on viper;
  the default cases of `TestLoad` fail until both agree.
- `DecodeHooks` is the hook chain `Load` uses; decoding `DefaultConfig()` with
  `mapstructure.ComposeDecodeHookFunc(DecodeHooks...)` keeps durations as `time.Duration`.
- Configuration keys come from the mapstructure tags. Every tag has `omitempty`, except the squashed
  `AuthenticationMethod.Method`, so a decoded configuration leaves out empty values and nil
  pointers; `Version` decodes to `version`, and only when set. Environment variables keep their
  names: `fieldKey` reads a tag's name whatever its options.
- `StorageConfig.Local` and `StorageConfig.Git` are `*Local` and `*Git`: each is nil unless its
  storage type is selected. A leftover section of another type, such as `local:` under
  `type: database`, or `FLIPT_STORAGE_LOCAL_PATH`, is dropped when the configuration loads. The HTTP
  config endpoint no longer shows empty `local` and `git` objects.
- The schema's `#FliptSpec` accepts the decoded default configuration under `cue.Concrete(true)`,
  checked by a test. It has one duration definition, Go's string form with fractions, such as
  `1.5s`, or a non-negative integer of nanoseconds; negative durations are rejected.
- The schema reads "either" strictly: a database is a URL, or a protocol, host, and name, with port
  and user optional, never both; git authentication is basic or token, never both, and an empty
  authentication reads as none. `storage` is a choice on `type`, `database` when it is missing.
  `cors.allowed_origins` is a list or a string. It gains the sections and fields the Go
  configuration reads: `experimental`, `storage`, the Kubernetes method, the session lifetimes and
  CSRF key, OIDC scopes, and an optional bootstrap expiration.
- [`testdata/advanced.yml`](/internal/config/testdata/advanced.yml) covers audit (a log sink to
  `/path/to/logs.txt`, a buffer of 10 flushed every 3 minutes), OTLP tracing to `localhost:4318`,
  and git storage with basic authentication.

## Design

The test is the safeguard: it ties the schema to the Go defaults and runs with the `internal/config`
suite. Go types stop emitting empty values through `omitempty` tags and nil pointers, rather than
the schema accepting empty values.

- [`config.go`](/internal/config/config.go): `DefaultConfig()`, `DecodeHooks`, which `Load` extends
  with its experimental-section hook without writing to it, and `fieldKey`.
- [`storage.go`](/internal/config/storage.go): the storage pointers; `StorageConfig.validate` first
  clears the pointer of every type not selected, then validates the selected one, a nil pointer
  failing like an empty section. `Load` runs it right after decoding, as authentication's `validate`
  already normalizes the session domain.
- [`config/flipt.schema.cue`](/config/flipt.schema.cue): `#duration`, `#db` as `#db_url` or
  `#db_host` sharing `#db_options`, and `#storage` as `#storage_database`, `#storage_local`, or
  `#storage_git`, all closed.
- [`schema_test.go`](/internal/config/schema_test.go): decodes `DefaultConfig()`, turns durations
  into strings, and validates it; a table of small configurations covers each form the schema
  accepts or rejects.
- [`config/flipt.schema.json`](/config/flipt.schema.json) is unchanged, so the two schemas disagree
  until it is ported.

## Questions

### Round 01

#### Q1: Where should the default values live?

**Answer:** "Your call: A": the test helper's literal moved into `config.go` as `DefaultConfig()`,
`setDefaults` kept, and `TestLoad` keeping both in step.

#### Q2: Should the schema reject configs that mix the two database forms, or both git authentications?

**Answer:** "Your call: A, one form or the other": either form, never both, with the host form
requiring only protocol, host, and name, as Flipt does.

#### Q3: Should the JSON schema be updated too?

**Answer:** "Your call: A": left as it is, with a note in the inbox to port the changes later.

#### Q4: Should the schema also validate a fully populated configuration?

**Answer:** "Your call: A, defaults only": only the default configuration, with the OIDC provider
names noted in the inbox.

## Changes after approval

- A git storage section without authentication decodes with an empty `authentication` object, since
  mapstructure never omits a struct; the final review found the schema rejected it, and the schema
  now reads an empty authentication as none.
- The inbox notes the spec planned for the default branch were committed on the feature branch, so
  they arrive with the merge.

## Follow-ups

- Port the CUE schema's changes to `config/flipt.schema.json` (in the inbox).
- OIDC providers reach CUE with their JSON names, such as `clientID`, so a fully populated
  configuration fails the schema (in the inbox).
- Deferred fixes, in the inbox: the "db url and host" schema case would still pass if the host form
  allowed `url`; `advanced.yml` has a double blank line.
