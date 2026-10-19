---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Default Flipt configuration validates against the CUE schema

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve a fuller `#FliptSpec` schema, aligned Go tags, and a test that validates
>   `DefaultConfig()` against it.
> - Database schema: the parts form requires protocol, host, port, name, and user, as you chose.
>   Editors flag a file without port or user, though Flipt starts with it.
> - Unverified: that decode hooks run when a struct becomes a map, and that CUE rejects unknown
>   fields. The plan's first task runs both. If hooks do not run, the test converts the values
>   itself.
> - Breaking change: `StorageConfig.Local` and `StorageConfig.Git` become pointers. No construction
>   site exists outside the config tests.
> - No decision is created, changed, or removed. The risk tier is medium, and the plan does not wait
>   for your review.

The default Flipt configuration, decoded to a map, must pass a new `#FliptSpec` CUE schema with
every value concrete. This helps maintainers: the schema, the Go structs, and the defaults can no
longer drift unnoticed. It follows the [proposal](proposal.md), the [discovery](discovery-01.md),
and your answers in the [clarifications](clarifications-01.md).

## Decisions

No decision is created, changed, or removed. No answer passes the tests of a decision: the schema
and the tags are enforced by the new test, and the rest stays inside this feature.

Relied on: no decision is active in `specs/decisions/`.

## User stories

### US1: Validate the default configuration against the schema (P1)

A maintainer runs the config tests. The tests build `DefaultConfig()`, decode it to a map with the
exported `DecodeHooks`, turn durations and enums into strings, and validate the map against
`#FliptSpec`.

Why this priority: it is the proposal's goal. Every other story serves it.

Key scenarios:

1. **Given** `DefaultConfig()`, **When** it is decoded to a `map[string]any` with `DecodeHooks` and
   validated against `#FliptSpec` with `cue.Concrete(true)`, **Then** CUE reports no error.
2. **Given** that decoded map before conversion, **When** the cache TTL is read, **Then** it is a
   `time.Duration` of one minute. After conversion it is the string `1m0s`.
3. **Given** the default configuration, **When** its durations are converted to strings, **Then**
   they read `24h0m0s` (token lifetime), `10m0s` (state lifetime), `1m0s` (cache TTL), `5m0s` (cache
   eviction interval), and `2m0s` (audit flush period).
4. **Given** an empty configuration file and no `FLIPT_` environment variables, **When** `Load`
   reads it, **Then** the result equals `DefaultConfig()`.

More scenarios:

1. **Given** the decoded default map, **When** its top-level keys are listed, **Then** none is named
   `Version`, and every key is among `version`, `log`, `ui`, `cors`, `cache`, `server`, `tracing`,
   `db`, `meta`, `authentication`, `audit`, `experimental`, and `storage`.
2. **Given** the default map with the key `unknown_section` added, **When** it is validated,
   **Then** CUE reports an error.
3. **Given** the default database settings, **When** they are decoded, **Then** the `db` map has
   `url` `file:/var/opt/flipt/flipt.db` and no `protocol` key.

### US2: Storage settings exist only for the selected backend (P1)

An operator selects a storage type. Only that backend's settings exist in the loaded configuration,
and the decoded map omits the other.

Key scenarios:

1. **Given** a file with `storage.type: git` and a `repository`, **When** it is loaded, **Then**
   `Storage.Git` is set with `ref` `main` and `poll_interval` 30s, and `Storage.Local` is nil.
2. **Given** a file with `storage.type: local` and no `path`, **When** it is loaded, **Then**
   `Storage.Local.Path` is `.` and `Storage.Git` is nil.
3. **Given** the default configuration, **When** its `storage` section is decoded to a map, **Then**
   it has neither a `local` key nor a `git` key.
4. **Given** the tag `ttl,omitempty` on the cache TTL, **When** the variable `FLIPT_CACHE_TTL` is
   `2m`, **Then** `Cache.TTL` is two minutes.

More scenarios:

1. **Given** the experimental filesystem storage flag is off and the file has `storage.type: git`,
   **When** it is loaded, **Then** both pointers are nil and no error is returned.
2. **Given** a `StorageConfig` of type `git` whose `Git` is nil, **When** it is validated, **Then**
   the error is `git ref must be specified`.
3. **Given** a default configuration, **When** `ServeHTTP` marshals it, **Then** the JSON has no
   `local` and no `git` key under `storage`.

### US3: The schema accepts the shapes Flipt accepts (P2)

A user edits a configuration file with schema validation in their editor. Valid files are not
flagged.

Key scenarios:

1. **Given** `db.url` `postgres://postgres@localhost:5432/flipt?sslmode=disable` and
   `conn_max_lifetime` `30m0s`, **When** the map is validated, **Then** CUE reports no error.
2. **Given** `db` with `protocol` `postgres`, `host` `localhost`, `port` 5432, `name` `flipt`, and
   `user` `flipt`, **When** it is validated, **Then** CUE reports no error.
3. **Given** `db` with `protocol`, `host`, and `name`, but no `port` and no `user`, **When** it is
   validated, **Then** CUE reports an error.
4. **Given** `cors.allowed_origins` is the string `foo.com`, then the list `["foo.com", "bar.com"]`,
   **When** each is validated, **Then** both pass.

More scenarios:

1. **Given** `storage.type` `git` with `repository`, `ref` `production`, `poll_interval` `5s`, and
   `authentication.basic` of `user` and `pass`, **When** validated, **Then** it passes.
2. **Given** the same storage with `authentication.token.access_token` `abc`, **When** validated,
   **Then** it passes.
3. **Given** `audit.buffer.flush_period` `1.5s`, then the integer 120, **When** each is validated,
   **Then** both pass.
4. **Given** `authentication.methods.token.bootstrap` with no `expiration`, **When** validated,
   **Then** it passes.
5. **Given** `authentication.methods.kubernetes` with `enabled` `true` and a `discovery_url`,
   **When** validated, **Then** it passes.

### US4: The advanced example covers the reshaped sections (P2)

A maintainer reads `advanced.yml` as the fully populated example. It now also sets audit, OTLP
tracing, and git storage.

Key scenarios:

1. **Given** `advanced.yml`, **When** it is loaded, **Then** `Audit.Sinks.LogFile` is enabled with
   `File` `/path/to/logs.txt`, and `Audit.Buffer` has `Capacity` 10 and `FlushPeriod` 3m.
2. **Given** `advanced.yml`, **When** it is loaded, **Then** `Tracing.Exporter` is `otlp` and
   `Tracing.OTLP.Endpoint` is `localhost:4318`.
3. **Given** `advanced.yml`, **When** it is loaded, **Then** `Storage.Type` is `git` and
   `Storage.Local` is nil. `Storage.Git` has `Repository` `https://github.com/flipt-io/flipt.git`,
   `Ref` `production`, `PollInterval` 5s, and basic authentication of `user` and `pass`.

## Architecture

Two things must agree: what Go emits, and what the schema accepts. The approach moves the canonical
defaults into `DefaultConfig()`, leaves `Load` alone, and adds one test that checks the schema
against the default. It follows your answer on the default values, and the schema is the CUE file
only. See [who owns the default values](discovery-01.md#who-owns-the-default-values).

- **`DefaultConfig()`** in [`config.go`](/internal/config/config.go) returns the canonical default
  `*Config`, moved from the test helper. It owns the default values that tests and the schema check
  compare against.
- **`DecodeHooks`**, exported from the same file, is the one list of string-to-value conversions.
  `Load` and the schema test both use it. It owns the loading conversions.
- **The tags and `fieldKey`** name each mapstructure field as the schema does. `fieldKey` returns
  the tag's name when the attribute is `omitempty`. Optional fields whose default is empty carry
  `omitempty`, so they are absent from the map. `Version` gets its tag.
- **`StorageConfig`** in [`storage.go`](/internal/config/storage.go) holds `Local *Local` and
  `Git *Git`, nil unless selected. Its `validate` owns the rule that a selected type has its
  settings. [`grpc.go`](/internal/cmd/grpc.go) reads the pointers only for the selected type, and
  returns an error on a nil one.
- **`#FliptSpec`** in [`flipt.schema.cue`](/config/flipt.schema.cue) is the schema. It gains
  `storage`, `experimental`, the database alternatives, the session fields, and the duration
  pattern. It owns the shape of a valid file, never a cross-field rule.
- **The schema test** in the config package decodes `DefaultConfig()`, converts durations and enums
  to strings, compiles the schema file, and validates concretely. It owns the conversion: no library
  helper is added. See [Adaptation](discovery-01.md#adaptation-is-not-defined).
- **`advanced.yml`** and its expected values in the config tests follow the four values the proposal
  gives.

Tradeoffs:

- The defaults keep two homes: `setDefaults` for loading, and `DefaultConfig()`. The empty-file test
  fails when they drift.
- The JSON schema keeps lacking `storage` and `experimental`, as you chose.
- The conversion lives in the test, so another consumer would copy it.
- Every reader of the two storage pointers must now check for nil.

## Edge cases

| Importance | Situation                                                         | What happens                                                                                    |
| ---------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| High       | `omitempty` is added to a tag that binds an environment variable  | `fieldKey` returns the tag's name, so `FLIPT_CACHE_TTL` still binds                             |
| High       | A selected storage type reaches code with a nil pointer           | `validate` returns the existing error, and `grpc.go` returns an error, never panics             |
| High       | The database uses `url`, so the `protocol` enum is its zero value | `protocol` is omitted from the map, so the schema does not see an empty string                  |
| Normal     | A duration has a fraction, such as `1.5s`                         | The pattern accepts it, since `time.Duration` produces such strings                             |
| Normal     | `storage.git.authentication` is omitted or empty                  | The schema accepts both, and no empty `basic` or `token` object is emitted                      |
| Normal     | The experimental flag is off while `storage` is in the file       | Both pointers are nil, and `validate` returns early as today                                    |
| Normal     | `cors.allowed_origins` is a YAML string                           | `stringToSliceHookFunc` splits it on whitespace when loading, and the schema accepts both forms |
| Niche      | The schema is edited without the Go side                          | The schema test fails on the unknown or missing field                                           |

## Success criteria

- **SC-001** (no CUE errors): `DefaultConfig()`, decoded and converted, validates against
  `#FliptSpec` with `cue.Concrete(true)` and no error.
- **SC-002** (12 sections): `#FliptSpec` accepts `log`, `ui`, `cors`, `cache`, `server`, `tracing`,
  `db`, `meta`, `authentication`, `audit`, `experimental`, and `storage`.
- **SC-003** (equality): loading an empty file with no `FLIPT_` variables equals `DefaultConfig()`.
- **SC-004** (5 durations): `24h0m0s`, `10m0s`, `1m0s`, `5m0s`, and `2m0s` pass the duration
  pattern.
- **SC-005** (build and tests): `go build ./...` and the config tests pass, with the existing
  environment-variable cases unchanged.
- **SC-006** (no empty objects): the decoded default has no `local` and no `git` key under
  `storage`.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Two answers shape the spec: the empty-file test guards the defaults, as you chose,
and the database parts form requires all five fields, which your answer on the database question
chose. Settled while writing this spec:

- **The schema test reads the file from disk.** It compiles
  [`flipt.schema.cue`](/config/flipt.schema.cue) with CUE v0.5.0, already in `go.mod`, and looks up
  `#FliptSpec`.
- **The URL form needs only `url`.** The parts form needs all five fields. Either form accepts the
  shared options: password, connection limits, connection lifetime, and prepared statements.
- **`experimental` is typed as Go has it.** The schema describes
  `experimental.filesystem_storage.enabled` as a boolean.
- **Existing schema fields stay.** `cache.memory.enabled`, `cache.memory.expiration`, and
  `tracing.jaeger.enabled` stay in the schema, though Go has no such field. Removing them is outside
  the proposal.
- **Which tags get `omitempty` is the plan's.** The rule: a field whose default is empty and which
  the schema rejects when empty.
- **The schema keeps `version` as `"1.0"`.** An unset `Version` is omitted from the map.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: `StorageConfig` changes shape, and a nil pointer could panic a reader. No user data or
file format changes.
