# Discovery, round 01: Default Flipt configuration validates against the CUE schema

## Summary

The proposal asks that the out-of-the-box Flipt configuration, decoded to a map, validates against a
new top-level `#FliptSpec` definition of the CUE schema, with every value concrete. Today the
schema's definition is already named `#FliptSpec`, but it is a closed definition missing `storage`
and `experimental`, and several fields the default emits. The default config exists only as a test
helper, `defaultConfig()`, and the hook list is private. The proposal also reshapes `StorageConfig`
(`Local` and `Git` become pointers) and extends `advanced.yml`.

This is a mostly mechanical alignment between three things: the Go structs and their tags, the
decode path that turns them into a map, and the CUE schema. No outside product comparison applies:
the feature is internal consistency of one project's configuration contract.

## How other products do it

Not applicable: this feature has no user-facing behaviour that products compare on. See
[Not checked](#not-checked) for what was deliberately not researched online.

### What they have in common

Nothing to compare. The capabilities users expect from a configuration schema (a documented file
that editors can validate) already exist here as `config/flipt.schema.cue` and
`config/flipt.schema.json`.

## Standards and libraries

### mapstructure v1.5.0, struct to map

Read from the module source, `github.com/mitchellh/mapstructure@v1.5.0/mapstructure.go`, lines
925-1010 (`decodeMapFromStruct`).

- A field with no `mapstructure` tag is keyed by its Go field name. `Config.Version` has only a
  `json` tag, so it becomes `"Version"` in the map, not `"version"`.
- A tag `name,omitempty` uses `name` as the key and omits the field when its value is empty.
- A nil pointer to a struct is not skipped without `omitempty`: it is still written to the map as a
  key. This is why `local` and `git` as plain values emit empty objects, and as nil pointers need
  `omitempty` to disappear.
- Nested structs become nested `map[string]interface{}`. `time.Duration` and the enum types
  (`Scheme`, `TracingExporter`, `DatabaseProtocol`, `CacheBackend`, `LogEncoding`) stay as their Go
  types in the map unless a hook changes them.

### mapstructure hooks, `ComposeDecodeHookFunc`

The existing list in [`config.go`](/internal/config/config.go) holds `StringToTimeDurationHookFunc`
and string-to-enum hooks. All convert string to typed value, the loading direction. None converts a
`time.Duration` or an enum back to a string. Whether hooks run in the struct-to-map direction for
nested values was not verified: see [Not checked](#not-checked).

### CUE v0.5.0

- [`go.mod`](/go.mod) pins `cuelang.org/go v0.5.0`. It is used by
  [`internal/cue/validate.go`](/internal/cue/validate.go), which validates feature YAML against
  `internal/cue/flipt.cue`, a different schema from the configuration one.
- The configuration schema, [`config/flipt.schema.cue`](/config/flipt.schema.cue), is not loaded by
  any Go code today. Nothing in the repository, build files included, compiles it. The only test is
  `TestJSONSchema`, which compiles the JSON twin
  [`config/flipt.schema.json`](/config/flipt.schema.json).
- A CUE definition (`#Name`) is closed: a field it does not list is an error. This was read from the
  schema's use of `#` definitions, not from CUE documentation: see [Not checked](#not-checked).

## The code

### Important reads

- [`internal/config/config.go`](/internal/config/config.go): `decodeHooks` is private. `Load` builds
  defaults through viper (`setDefaults` on each section), then `v.Unmarshal` with the hooks.
  `fieldKey` (used to bind env vars) cuts the tag at the comma: for `name,omitempty` it returns the
  lowercased Go field name instead of `name`, because it only returns the tag when there is no
  attribute or the attribute is `squash`. So adding `omitempty` to a tag today would break env var
  binding for that field.
- [`internal/config/config_test.go`](/internal/config/config_test.go) lines 203-295:
  `defaultConfig()` is the canonical default, written by hand, used by `TestLoad` and
  `TestServeHTTP`. It imports `jaeger-client-go` only for the Jaeger host and port, in test code. No
  non-test file imports it.
- [`internal/config/storage.go`](/internal/config/storage.go): `Local` and `Git` are values.
  `setDefaults` sets `storage.local.path` or `storage.git.ref` and `poll_interval` only for the
  selected type. `validate` dereferences `c.Git` and `c.Local` fields directly.
- [`internal/config/authentication.go`](/internal/config/authentication.go): the session carries
  `token_lifetime` and `state_lifetime` (durations) and `csrf.key`; methods include `kubernetes`.
  `AuthenticationMethod` squashes its method struct. Cleanup is a pointer.
- [`internal/config/audit.go`](/internal/config/audit.go): `flush_period` is a duration; the schema
  types it `string | *"2m"`. Validation accepts capacity 2 to 10 and flush 2m to 5m.
- [`internal/config/database.go`](/internal/config/database.go): `conn_max_lifetime` is a duration;
  the schema types it `int`. `validate` requires `protocol`, `host`, `name` when `url` is empty, and
  does not require `port` or `user`.
- [`internal/config/cors.go`](/internal/config/cors.go): `allowed_origins` is `[]string`, and
  `stringToSliceHookFunc` splits a YAML string on whitespace. The schema types it `[...]`.
- [`internal/cmd/grpc.go`](/internal/cmd/grpc.go) lines 139-170: reads `cfg.Storage.Git.Ref`,
  `.PollInterval`, `.Authentication`, `.Repository` and `cfg.Storage.Local.Path`. These compile
  unchanged with pointers but would panic on a nil pointer.
- [`internal/telemetry/telemetry.go`](/internal/telemetry/telemetry.go) reads `Storage.Type` only.

### The proposal's path and existing actions

Tracing the schema against the default config, section by section, gap between what the Go side
emits and what the schema accepts:

| Section          | Gap found                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| top level        | `Version` has no mapstructure tag, emitted as `Version`. `storage` and `experimental` are not in the schema.                                        |
| `log`            | `level` is typed with `#log_level` and the default is `"INFO"`, accepted.                                                                           |
| `cors`           | `allowed_origins` must also accept a single string (proposal).                                                                                      |
| `cache`          | `ttl`, `memory.eviction_interval` accept duration strings or ints. `memory.expiration` and `memory.enabled` exist in the schema but not in Go.      |
| `db`             | `conn_max_lifetime` is an int, not a duration string. No URL-or-parts alternative. `protocol` in Go is the enum, zero when `url` is used.           |
| `tracing`        | `jaeger.enabled` exists in the schema, deprecated, not in Go. `exporter` is an enum in Go.                                                          |
| `authentication` | Schema lacks `session.token_lifetime`, `state_lifetime`, `csrf`, and the `kubernetes` method. `bootstrap.expiration` has no `?`, so it is required. |
| `audit`          | `flush_period` is `string`, not a duration pattern.                                                                                                 |
| `meta`           | `state_directory` default in Go is empty; schema default is `"$HOME/.config/flipt"`.                                                                |
| `storage`        | Absent from the schema. Git needs `repository`, `ref`, `poll_interval`, `authentication` with `basic` or `token`.                                   |

Existing actions that meet the change:

- **Loading a file with the pointer fields.** With `Local` and `Git` as pointers, mapstructure
  allocates them only when the file or the defaults carry keys under them. `setDefaults` sets keys
  only for the selected type, so a selected type always gets its pointer.
- **Experimental flag off.** `experimentalFieldSkipHookFunc` replaces the whole `storage` struct
  with an empty one. Then `Type` is empty and both pointers are nil. `validate` returns early
  because the type matches neither case.
- **`ServeHTTP`.** Marshals the config with the `json` tags. `Local` and `Git` as `omitempty`
  pointers disappear from the JSON when nil; as values with `omitempty` they would not, since
  `encoding/json` does not omit empty structs.
- **Env vars.** `bindEnvVars` already descends through pointers. `fieldKey` ignores `omitempty`
  tags, as described above.
- **Durations in `advanced.yml`.** Valid today: `5m`, `30m`, `2h`, `48h`. Not a hook problem: the
  hook only runs string to duration.

### Rules and their owners

- **The default values.** Owned today by two places: the `setDefaults` methods, which Load uses, and
  `defaultConfig()` in the test file. The test passes only while the two agree. Defaults also live a
  third time in the schema's `*value` markers, and the YAML comments of
  [`config/default.yml`](/config/default.yml).
- **The set of valid config fields.** Owned by the Go structs. Copied in `flipt.schema.cue` and
  `flipt.schema.json`, by hand.
- **Database connection rule (URL or parts).** Owned by `DatabaseConfig.validate`. The CUE schema
  has no copy yet.

### Likely changes

- [`internal/config/config.go`](/internal/config/config.go): export `DecodeHooks`; add
  `DefaultConfig()`; give `Version` a mapstructure tag; fix `fieldKey` for `omitempty`.
- [`internal/config/storage.go`](/internal/config/storage.go): `Local *Local`, `Git *Git`; nil-safe
  `validate`.
- The section files (`audit.go`, `authentication.go`, `cache.go`, `database.go`, `tracing.go`,
  `log.go`, `meta.go`, `server.go`, `cors.go`): `omitempty` on mapstructure tags of optional fields,
  so empty defaults are not emitted. Which fields is settled during planning.
- [`internal/cmd/grpc.go`](/internal/cmd/grpc.go): nil-safe reads of the two pointers.
- [`config/flipt.schema.cue`](/config/flipt.schema.cue): add `storage`, `experimental`; extend
  `authentication`, `db`, `cors`, duration patterns; keep the `#FliptSpec` name. With option B of
  [the JSON schema](#the-json-schema), also `flipt.schema.json`.
- [`internal/config/testdata/advanced.yml`](/internal/config/testdata/advanced.yml): add `audit`,
  `tracing` (OTLP), `storage` (git); its `tracing.backend: jaeger` key is not a field Go knows.
- [`internal/config/config_test.go`](/internal/config/config_test.go): `defaultConfig()` replaced by
  `DefaultConfig()`; `Storage` expectations use pointers; the advanced case grows; a new test
  decodes `DefaultConfig()` and validates it against `#FliptSpec`.

## The proposal

### Two contradictory statements on interfaces

The proposal says "No new interfaces are introduced", then lists `DefaultConfig` under **New
Interfaces**, and its requirements export `DecodeHooks` as well. The requirements are specific, so
both exports are taken as wanted.

### Repeated requirements

The `DefaultConfig()` requirement, the `advanced.yml` requirement, and the concrete-validation
requirement each appear twice in the proposal, in the same words. No conflict, nothing to decide.

### "Adaptation" is not defined

Requirements speak of "schema validation adaptation": durations must be strings, and the decoded map
must be validatable. The proposal does not say where this conversion lives. It also lists only
durations. The enums (`Scheme`, `TracingExporter`, `DatabaseProtocol`, `CacheBackend`,
`LogEncoding`) are typed integers in the map, and the schema expects strings. Whether the conversion
covers them too is not stated.

### Duration strings

`time.Duration.String()` gives `1m0s`, `24h0m0s`, but also `1.5s` and `0s`. The current pattern
`^([0-9]+(ns|us|µs|ms|s|m|h))+$` accepts the first two lists, and `0s`, but rejects `1.5s`. The
default config has no fractional duration.

### Break of `StorageConfig`

The proposal states the pointer change is a deliberate break and may leave outside construction
sites failing to build. Searched all Go files: `config.Local{}` and `config.Git{}` literals appear
only in `internal/config/config_test.go`, in package. Other readers (`grpc.go`) compile unchanged.
No outside construction site exists today.

### Database alternatives

The proposal says the schema accepts a URL form "or a protocol, host, port, name, and user based"
form. Runtime validation requires only protocol, host and name in the parts form.

## Worth it and feasibility

- **Gain.** The default configuration and the documented schema stay in step, checked by a test.
  Cost: about a dozen Go files with small edits, one schema file, one test fixture. No new
  dependency: CUE v0.5.0 is already in `go.mod`.
- **Outside behaviour relied on, unverified.** Two behaviours were reasoned from the code, not run:
  that hooks apply while decoding struct to map, and that CUE reports unknown fields of a closed
  definition as errors under concrete validation. The plan's first task should run both.
- **Guards relaxed.** None. A schema that accepts more shapes only affects editor validation and
  tests; the runtime still validates in Go.

## Approaches

Criteria come from [the proposal](proposal.md), the [constitution](/specs/CONSTITUTION.md)
(requirements stay as written, no added feature, tests cover scenarios, simple code that follows the
repository), and the repository's one-home-per-rule habit. There are no active decisions.

### Who owns the default values

How `DefaultConfig()` relates to `Load`. See [Rules and their owners](#rules-and-their-owners).

| Option                                                                                               | Matches "same values as the loading path" | Risk to loading                                                                  | Size   |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| A. `DefaultConfig()` is the old test helper, moved; a test loads an empty file and requires equality | Enforced by a test                        | None                                                                             | Small  |
| B. `Load` starts from `DefaultConfig()` and the file overrides it; viper `setDefaults` go away       | By construction                           | Defaults that depend on the selected type (storage, auth methods) must be redone | Large  |
| C. `DefaultConfig()` runs `Load` on an empty file                                                    | By construction                           | Needs a file and the env, and could not run without them                         | Medium |

### The JSON schema

The repository holds `flipt.schema.json` next to the CUE file, with the same shape. See
[Rules and their owners](#rules-and-their-owners).

| Option                                 | Matches the proposal             | Drift                                                   | Size   |
| -------------------------------------- | -------------------------------- | ------------------------------------------------------- | ------ |
| A. Change the CUE schema only          | Yes, the proposal names only CUE | The JSON schema stays without `storage`, `experimental` | Small  |
| B. Also update the JSON schema by hand | Beyond the proposal              | None                                                    | Medium |

### The database alternatives in CUE

How much of the parts form the schema requires. See [Database alternatives](#database-alternatives).

| Option                                                              | Matches runtime validation        | Matches the proposal's words |
| ------------------------------------------------------------------- | --------------------------------- | ---------------------------- |
| A. Parts form requires protocol, host, name; port and user optional | Yes                               | Partly                       |
| B. Parts form requires all five                                     | No: rejects configs Flipt accepts | Yes                          |

### Needs no choice

- **Closing the gaps the default exposes.** Every schema gap in the table above that the default
  config emits has to close for the validation to pass: nothing to choose.
- **Optional empties.** `omitempty` on the mapstructure tags of optional fields, with `fieldKey`
  fixed, is what the proposal's requirement on `omitempty` describes.
- **Adaptation lives in the test.** Exporting a conversion helper would be a new interface the
  proposal does not list.
- **`advanced.yml` contents.** Dictated value by value by the proposal.
- **Cors string or list.** Dictated by the proposal.

## Not checked

- **Online research.** The task forbids looking up existing solutions, pull requests, and
  workarounds, so no product, standard, or community source was read. The CUE and mapstructure facts
  come from the local module source and the repository.
- **CUE documentation.** The closed-definition behaviour and `cue.Concrete(true)` semantics were not
  read in CUE's documentation. The plan's first task should run a small test.
- **Hooks in the struct-to-map direction.** Not run.
