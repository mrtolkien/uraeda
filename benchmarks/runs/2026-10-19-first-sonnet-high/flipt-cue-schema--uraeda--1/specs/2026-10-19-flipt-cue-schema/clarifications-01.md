---
status: answered
---

# Clarifications, round 01: Default Flipt configuration validates against the CUE schema

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed, with no new dependency. The schema, the Go tags, and the
>   default drifted apart, and a test can keep them aligned.
> - Default values: whether `DefaultConfig()` only mirrors the loading path or replaces it.
> - JSON schema: the repository holds a second schema file the proposal does not mention.
> - Database schema: the proposal's wording is stricter than what Flipt accepts at runtime.
> - Contradiction in the proposal: it says no new interfaces, then adds two exports. Both are kept.
> - Settled points to check: where the duration and enum conversion lives, and the extra schema
>   fields.

## Context

### Goal

You want the default Flipt configuration, decoded to a map, to pass the CUE schema with every value
concrete. That needs a reusable `DefaultConfig()`, exported `DecodeHooks`, a fuller `#FliptSpec`,
and `StorageConfig` with nil-able `Local` and `Git`.

### Today

- The default configuration exists only as `defaultConfig()` in
  [the config tests](/internal/config/config_test.go). `Load` builds the same values through viper
  `setDefaults` methods.
- The hook list `decodeHooks` is private, in [`config.go`](/internal/config/config.go).
- [`flipt.schema.cue`](/config/flipt.schema.cue) already names its definition `#FliptSpec`. It lacks
  `storage`, `experimental`, the session lifetimes, the `kubernetes` method, and duration patterns
  on `db.conn_max_lifetime` and `audit.buffer.flush_period`.
- `Config.Version` has no `mapstructure` tag, so a decoded map names it `Version`, not `version`.
- `fieldKey`, which binds env vars, ignores the tag name when the tag has `omitempty`. Adding
  `omitempty` today would break the env var of that field.
- Nothing in the repository compiles the configuration schema; only its JSON twin is tested.

### Scope

This change covers the Go configuration package, the one reader in
[`grpc.go`](/internal/cmd/grpc.go) that must stay nil-safe, the CUE schema, `advanced.yml`, and
tests. It leaves out the feature-flag CUE schema in `internal/cue`, and any change to how users
write configuration files.

### Sources

- [`config.go`](/internal/config/config.go), [`storage.go`](/internal/config/storage.go),
  [`database.go`](/internal/config/database.go), [`audit.go`](/internal/config/audit.go),
  [`authentication.go`](/internal/config/authentication.go), and
  [`flipt.schema.cue`](/config/flipt.schema.cue).
- The mapstructure v1.5.0 source, for how a struct becomes a map.
- The full investigation is in [discovery](discovery-01.md).

## Q1: Should `DefaultConfig()` only mirror the loading path, or replace how it builds defaults?

Today two places hold the defaults: viper `setDefaults` methods, which `Load` uses, and the test
helper `defaultConfig()`. The proposal wants `DefaultConfig()` in the package, returning "the same
canonical default values used by the configuration loading path". Defaults of storage and
authentication methods depend on what the file selects, which makes a rewrite of `Load` the costly
route. More in [discovery](discovery-01.md#who-owns-the-default-values).

Why it matters: it decides whether defaults keep two homes, guarded by a test, or one, at the price
of reworking `Load`.

- **A (recommended). Move the test helper into `DefaultConfig()`, leave `Load` as is, and add a test
  that loads an empty configuration file and requires it to equal `DefaultConfig()`.**
  - [pro] no change to how users' files load, so no regression risk.
  - [pro] the test fails whenever the two drift apart.
  - [con] defaults still live in two places.
  - Why recommended: it meets the proposal's wording with the smallest, safest change.
- **B. Make `Load` start from `DefaultConfig()` and let the file override it, and remove the viper
  `setDefaults` methods.**
  - [pro] one home for the defaults.
  - [con] the type-dependent defaults of storage and authentication methods must be rebuilt, and env
    var binding must be rechecked.
- **C. Make `DefaultConfig()` call `Load` on an empty file.**
  - [pro] equal to the loading path by construction.
  - [con] it needs a file on disk and reads `FLIPT_` environment variables, so it is not canonical.

**Answer:** Your call: A

## Q2: Should the JSON schema change too?

The repository holds [`flipt.schema.json`](/config/flipt.schema.json) beside the CUE file, with the
same sections. The editor hint in [`default.yml`](/config/default.yml) points at it. It also lacks
`storage` and `experimental`. The proposal names only the CUE schema. A Go test already compiles the
JSON file but checks no configuration against it. More in
[discovery](discovery-01.md#the-json-schema).

Why it matters: it decides whether the two schemas stay in step after this change, or one more
section of drift is accepted.

- **A (recommended). Change the CUE schema only, as the proposal says.**
  - [pro] stays inside the proposal's scope.
  - [con] the JSON schema keeps lacking `storage`, `experimental`, and the new fields.
  - Why recommended: the constitution says not to add what the proposal does not ask for.
- **B. Also update `flipt.schema.json` by hand to match the CUE changes.**
  - [pro] both schemas describe the same contract.
  - [con] more work, with no test that checks the two agree.

**Answer:** Your call: A

## Q3: Which database fields does the schema require in the parts form?

The proposal says the schema accepts a URL, or a "protocol, host, port, name, and user" form. At
runtime, [`DatabaseConfig.validate`](/internal/config/database.go) requires only protocol, host, and
name when the URL is empty. Port and user may be left out, for example for a local Postgres. More in
[discovery](discovery-01.md#the-database-alternatives-in-cue).

Why it matters: a schema stricter than the runtime marks working configurations as errors in
editors.

- **A (recommended). Require protocol, host, and name in the parts form, and leave port and user
  optional, as runtime validation does.**
  - [pro] the schema agrees with the code, so no valid file is flagged.
  - [con] differs from the proposal's literal list.
  - Why recommended: a schema that rejects configurations Flipt accepts misleads users.
- **B. Require all five fields in the parts form, as the proposal is worded.**
  - [pro] follows the wording exactly.
  - [con] flags configurations without port or user that Flipt starts with.

**Answer:** B: 'protocol, host, port, name, and user based configuration'

## Settled without the human

### Check these

- **Interfaces.** The proposal says "No new interfaces" yet lists `DefaultConfig`, and its
  requirements export `DecodeHooks`. Both are exported, as the requirements say. See
  [discovery](discovery-01.md#two-contradictory-statements-on-interfaces).
- **Duration and enum conversion lives in the test.** The proposal calls it "adaptation" without
  saying where. A test helper turns durations into Go duration strings, and enums into their string
  names, because a library helper would be a new interface. See
  [discovery](discovery-01.md#adaptation-is-not-defined).
- **Fractional durations.** The duration pattern also accepts decimals such as `1.5s`, since every
  `time.Duration` string must be accepted. Integer values stay accepted. See
  [discovery](discovery-01.md#duration-strings).
- **No code-quality decision is asked.** The repository has its own `.golangci.yml`, and a decision
  would go beyond the proposal.

### Behaviour

- **`advanced.yml`.** Its `tracing.backend: jaeger` key, which no field reads, is replaced by
  `exporter: otlp` and the OTLP endpoint. `audit` and git `storage` are added with the values the
  proposal gives. The existing advanced test expectation follows.
- **Storage with pointers.** `Local` and `Git` are nil unless their type is selected, and the
  decoded map omits them. `validate` and `grpc.go` check for nil before reading them.
- **Extra schema fields.** The schema also gains the session lifetimes, `csrf`, the `kubernetes`
  method, and the cache and tracing fields Go emits, because the default configuration emits them.
- **Cross-field rules.** The schema checks shapes only. It does not require `storage.git` when
  `type` is `git`: Go validation owns that rule. See
  [discovery](discovery-01.md#rules-and-their-owners).

### Under the hood

- **Config tests.** Test literals of `Storage` in the config tests switch to pointers. No other
  construction site of `Local` or `Git` exists, so no build error is left outside. See
  [discovery](discovery-01.md#break-of-storageconfig).
- **Empty optional fields.** Optional fields get `omitempty` on their mapstructure tags, and
  `fieldKey` is fixed to return the tag's name when the attribute is `omitempty`. `Version` gets its
  tag.
- **Jaeger defaults.** `DefaultConfig()` uses the literals `localhost` and `6831`, not the
  `jaeger-client-go` constants, which only test code imports today.
- **First task.** The plan starts by running two unverified behaviours: hooks while decoding a
  struct to a map, and unknown fields under CUE concrete validation. See
  [discovery](discovery-01.md#worth-it-and-feasibility).

**Notes:**
