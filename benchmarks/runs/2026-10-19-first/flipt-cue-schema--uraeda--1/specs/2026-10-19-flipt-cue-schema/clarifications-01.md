---
status: answered
---

# Clarifications, round 01: Default configuration validates against the CUE schema

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed. An experiment found small gaps, all fixable in the config
>   package and the schema.
> - Database and git authentication: whether the schema rejects mixed settings that Go accepts.
> - Scope cut: the JSON schema is left alone, because the proposal names only CUE.
> - Storage type: the default keeps an empty type, as the loading path does today.
> - Existing `advanced.yml`: its `tracing.backend: jaeger` line is replaced, because the struct has
>   no such key.

## Context

### Goal

Make the out-of-the-box Flipt configuration provably valid against the CUE schema. A test decodes
`DefaultConfig()` to a map and validates it against `#FliptSpec`. It fails when defaults and schema
drift apart. The audience is Flipt maintainers.

### Today

A copy of the repository, run outside git, decoded the loaded default configuration and validated
it. Eight kinds of failure came out:

| Failure                                                                                         | Cause                                    |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `Version` key not allowed                                                                       | the field has no `mapstructure` tag      |
| durations are integers                                                                          | the schema takes duration strings        |
| `kubernetes`, `csrf`, `state_lifetime`, `token_lifetime`, `experimental`, `storage` not allowed | the schema lacks them                    |
| `cleanup: null`                                                                                 | nil pointers are emitted                 |
| `db.protocol: ""`                                                                               | the zero enum value stringifies to empty |
| `boolean` not found                                                                             | typo in the schema for `bool`            |

Also, `fieldKey` in [`config.go`](/internal/config/config.go) ignores a tag's name when it has
`omitempty`, so the environment key would be wrong. `Local` and `Git` in
[`storage.go`](/internal/config/storage.go) are values, and become pointers.

### Scope

In: `DefaultConfig()`, `DecodeHooks`, pointer `Local` and `Git`, the schema additions and fixes, the
`omitempty` and `version` tags, an extended `advanced.yml`, and tests. Out: the JSON schema, new
exported helpers, any runtime use of the schema.

### Sources

- [`internal/config`](/internal/config/config.go),
  [`config/flipt.schema.cue`](/config/flipt.schema.cue),
  [`internal/cmd/grpc.go`](/internal/cmd/grpc.go).
- [CUE closed structs](https://cuelang.org/docs/tour/types/closed/) and
  [mapstructure v1.5.0](https://pkg.go.dev/github.com/mitchellh/mapstructure@v1.5.0).
- The full investigation is in [discovery](discovery-01.md).

## Q1: Which fields must the schema require when the database is not given as a URL?

The proposal accepts "a protocol, host, port, name, and user based configuration". The Go loader
([`DatabaseConfig.validate`](/internal/config/database.go)) requires only protocol, host and name
when no URL is set. Port and user may be left out, for example a local Postgres on its default port.
More in [discovery](discovery-01.md#database-forms).

Why it matters: it decides whether the schema agrees with what Flipt really accepts, or is stricter.

- **A (recommended). Require protocol, host and name; allow port and user as optional fields.**
  - [pro] every configuration Flipt accepts at runtime also passes the schema.
  - [con] the schema reads less literally than the proposal's sentence.
  - Why recommended: a schema stricter than the loader would flag valid configurations.
- **B. Require all five: protocol, host, port, name and user.**
  - [pro] follows the sentence literally.
  - [con] flags configurations that Flipt starts with.

**Answer:** your call, A

## Q2: Should the schema reject settings that mix the two alternatives?

Go accepts a database with both a URL and host fields (the URL wins, silently). It accepts git
authentication with both basic and token (token wins). The proposal says "either" for both, so the
schema could reject the mixes, which catches mistakes. Or it could accept them, like the loader.
More in [discovery](discovery-01.md#mixing-alternatives).

Why it matters: a rejecting schema turns a silent runtime surprise into a visible error, but also
flags configurations that work today.

- **A (recommended). Reject both mixes: a URL with protocol, host, name, port or user, and basic
  with token authentication.**
  - [pro] the schema documents which settings really apply.
  - [con] flags configurations that work today.
  - Why recommended: it follows the proposal's "either ... or" wording.
- **B. Accept both mixes, like the Go loader.**
  - [pro] the schema never contradicts the runtime.
  - [con] a mixed configuration passes, though part of it is ignored.
- **C. Reject only the database mix, and accept basic with token.**
  - [pro] the git documentation already says token takes priority.
  - [con] the two cases are treated differently.

**Answer:** your call, A

## Q3: Should `DefaultConfig()` keep an empty storage type, as the loaded default has?

When the filesystem-storage experimental flag is off, loading the default configuration leaves
`storage.type` empty. The runtime in [`grpc.go`](/internal/cmd/grpc.go) reads empty as database, and
the existing default test expects it. The schema would then make `type` optional, and the empty
value is omitted from the decoded map. More in [discovery](discovery-01.md#storage-type-default).

Why it matters: the proposal wants `DefaultConfig()` to equal the loaded default, and also to
validate.

- **A (recommended). Keep the type empty in `DefaultConfig()` and omit it from the decoded map.**
  - [pro] `DefaultConfig()` equals what loading gives; no behaviour change.
  - [con] the default does not say "database" explicitly.
  - Why recommended: it keeps the proposal's "same canonical defaults" true.
- **B. Set the type to `database` in `DefaultConfig()` and in the loading path.**
  - [pro] explicit default.
  - [con] changes the loaded default and the existing default test's expectation.

**Answer:** your call, A

## Q4: Should this feature adopt code-quality limits as a project decision?

The project has no `specs/decisions/code-quality.md`. A decision would set limits (function length,
file length, nesting) in the linters, and mark today's offenders. The project's
[`.golangci.yml`](/.golangci.yml) has no size limits today. This task changes only configuration and
its schema.

Why it matters: adopting limits means editing lint configuration and marking existing code, which
this task does not ask for. A "no" is recorded and not asked again until the date.

- **A (recommended). No limits now; record that, to revisit on 2027-01-19.**
  - [pro] the feature stays within what the proposal asks.
  - [con] no automatic limit on function or file size.
  - Why recommended: it keeps the change inside the proposal's scope.
- **B. Adopt limits for golangci-lint (function length 100, file length 1000, nesting 5) and mark
  offenders.**
  - [pro] size limits are checked from now on.
  - [con] touches lint configuration and unrelated code.

**Answer:** your call, A

## Settled without the human

### Check these

- **The JSON schema** is left unchanged. The proposal names only the CUE schema, and the JSON one
  has no `storage` either. See [discovery](discovery-01.md#important-reads).
- **Existing `advanced.yml` tracing** drops the line `backend: jaeger` and uses `exporter: otlp`, as
  the proposal says. The struct has no `backend` key. Its test expectation changes with it. See
  [discovery](discovery-01.md#important-reads).
- **No new exported adapter.** Durations and enums are turned into strings inside the test, before
  validation, since the proposal lists no new interface. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Decimal durations** such as `1.5s` are accepted by the schema's duration pattern, because
  `Duration.String()` can print them. See [discovery](discovery-01.md#rules-and-their-owners).

### Behaviour

- **Schema additions** cover `storage`, `experimental`, the kubernetes method, session `csrf`,
  `token_lifetime` and `state_lifetime`, because the default emits them. Git `poll_interval` and
  `ref` follow the loader. Types are the same as in Go.
- **CORS `allowed_origins`** takes a list of strings or one string, as the proposal says.
- **The `boolean` typo** becomes `bool`.
- **Empty optional values** (nil pointers, zero scalars) are left out of the decoded map by
  `omitempty`, so they cannot fail validation. Zero values the schema defaults anyway lose nothing.

### Under the hood

- **`fieldKey`** returns the tag's name when its option is `omitempty`, and `Config.Version` gets
  `mapstructure:"version"`. See [discovery](discovery-01.md#important-reads).
- **Storage validation** checks `Git` and `Local` for nil before reading them. The only reader
  outside, `grpc.go`, stays inside the matching type case and compiles unchanged.
- **`decodeHooks` becomes `DecodeHooks`**, still used by `Load`. The test helper `defaultConfig()`
  is replaced by `DefaultConfig()` in `config.go`.
- **Repeated requirements** in the proposal are treated as one. See
  [discovery](discovery-01.md#duplicated-requirements).

**Notes:**
