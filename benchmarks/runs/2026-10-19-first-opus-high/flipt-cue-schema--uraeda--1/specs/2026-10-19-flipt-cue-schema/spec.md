---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Default configuration validates against the CUE schema

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve a CUE schema that compiles and accepts Flipt's default configuration, kept so by a
>   test. With it come a public `DefaultConfig()` and `DecodeHooks`, and storage settings held by
>   pointer.
> - No decision is proposed. Where the defaults live stays a copy: `setDefaults` on viper, and
>   `DefaultConfig()` as a Go literal, kept in step by `TestLoad`.
> - The schema is stricter than Flipt. It rejects a database URL mixed with a host, and both git
>   authentications at once, though Flipt runs both.
> - Loading drops a leftover storage section of a type not selected, such as `local:` under
>   `type: database`. Flipt reads neither today, so nothing users run changes.
> - The HTTP config endpoint loses its empty `local` and `git` objects; the UI reads only the
>   storage type.
> - Each answer read "Your call" followed by a letter: this spec takes that letter, the recommended
>   option, every time.
> - Risk tier `medium`: the shape of `StorageConfig` and of the config endpoint's output change.

Flipt's maintainers keep a hand-written CUE schema of the configuration file,
[`config/flipt.schema.cue`](/config/flipt.schema.cue), that nothing checks against the Go
configuration. It no longer compiles, and it rejects 12 fields of the default configuration. This
feature fixes the schema, and adds a test that decodes the default configuration and validates it,
so the two cannot drift again. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

This spec creates, changes, and removes no decision. The ledger has no active decision yet, so none
is relied on.

## User stories

### US1: The default configuration validates (P1)

A maintainer runs the `internal/config` tests. A test decodes `DefaultConfig()` into a map with the
loading path's hooks, turns its durations into Go's string form, and validates it against
`#FliptSpec`, with every value required to be concrete. It passes.

Key scenarios:

1. **Given** the schema in `config/flipt.schema.cue`, **When** CUE v0.5.0 compiles it, **Then** it
   compiles, and exposes `#FliptSpec`.
2. **Given** `DefaultConfig()`, **When** it is decoded with
   `mapstructure.ComposeDecodeHookFunc(DecodeHooks...)` into a `map[string]any`, **Then**
   `cache.ttl` is the `time.Duration` 1 minute, and the map has the keys `log`, `ui`, `cors`,
   `cache`, `server`, `tracing`, `db`, `meta`, `authentication`, `audit`, `experimental`, and
   `storage`.
3. **Given** that map with each duration replaced by its string, **When** it is validated against
   `#FliptSpec` with `cue.Concrete(true)`, **Then** there is no error, and the durations read
   `1m0s`, `5m0s`, `24h0m0s`, `10m0s`, and `2m0s`.

More scenarios:

1. **Given** an empty configuration file, **When** `Load` reads it, **Then** the result equals
   `DefaultConfig()`, from YAML and from environment variables alike.
2. **Given** `DefaultConfig()` decoded, **When** the map is read, **Then** it holds no `null`, no
   empty `db.protocol`, and no key named `Version`: the version reads `version`, and only when set.

### US2: Storage settings exist only for the selected backend (P1)

`StorageConfig.Local` and `StorageConfig.Git` become `*Local` and `*Git`. Each is nil unless its
storage type is selected, so the decoded configuration leaves out `local` and `git` rather than
emitting empty objects. Each scenario below has the filesystem storage experiment on, without which
`Load` ignores the storage section.

Key scenarios:

1. **Given** a file with `storage: {type: database}`, **When** it loads, **Then** `Local` and `Git`
   are nil, and the decoded map's `storage` holds only `type: database`.
2. **Given** `storage: {type: git, git: {repository: "https://github.com/flipt-io/flipt.git"}}`,
   **When** it loads, **Then** `Git` has `ref` `main` and `poll_interval` 30 seconds, and `Local` is
   nil.
3. **Given** `storage: {type: database, local: {path: "/tmp/flags"}}`, **When** it loads, **Then**
   `Local` is nil: the leftover section is dropped.

More scenarios:

1. **Given** `storage: {type: local}`, **When** it loads, **Then** `Local.Path` is `.`, and `Git` is
   nil.
2. **Given** `type: git` and `FLIPT_STORAGE_GIT_AUTHENTICATION_BASIC_USERNAME=user` with its
   password variable, **When** it loads, **Then** `Git.Authentication.BasicAuth.Username` is `user`.

### US3: The schema accepts every documented form (P2)

The schema covers each section Flipt reads, in every form the proposal names. Where the proposal
says "either", the schema accepts one form or the other, never both, and never requires more than
Flipt does.

Key scenarios:

1. **Given** `db` with `url` and `max_idle_conn: 10`, or with `protocol: postgres`,
   `host: localhost`, and `name: flipt` and no port or user, **When** each is validated, **Then**
   both pass.
2. **Given** `db` with both `url` and `host`, **When** it is validated, **Then** it fails.
3. **Given** `storage` of type `git` with `ref`, `poll_interval: 5s`, and basic authentication,
   **When** it is validated, **Then** it passes; with both basic and token authentication, it fails.

More scenarios:

1. **Given** `cors.allowed_origins` as `["foo.com"]`, or as `"foo.com bar.com"`, **When** each is
   validated, **Then** both pass.
2. **Given** a duration of `1.5s`, of `0s`, or of the integer `60000000000`, **When** it is
   validated, **Then** each passes; `-1m0s` fails.
3. **Given** `storage: {}`, **When** it is validated, **Then** it passes, read as a database
   storage.
4. **Given** `storage` of type `local` with `path: /tmp/flags`, **When** it is validated, **Then**
   it passes.
5. **Given** `authentication.methods.kubernetes` with `discovery_url`, `ca_path`, and
   `service_account_token_path`, **When** it is validated, **Then** it passes.

### US4: The fully populated example covers the new sections (P2)

[`testdata/advanced.yml`](/internal/config/testdata/advanced.yml), the example the `advanced` case
of `TestLoad` loads, gains the audit, tracing, and storage values the proposal lists.

Key scenarios:

1. **Given** the extended `advanced.yml`, **When** it loads, **Then** `audit.sinks.log` is enabled
   with `file` `/path/to/logs.txt`, and `audit.buffer` has `capacity` 10 and `flush_period` 3
   minutes.
2. **Given** the same file, **When** it loads, **Then** tracing uses the OTLP exporter, through
   `exporter: otlp`, with `otlp.endpoint` `localhost:4318`.
3. **Given** the same file, **When** it loads, **Then** storage is of type `git`, with `repository`
   `https://github.com/flipt-io/flipt.git`, `ref` `production`, `poll_interval` 5 seconds, and basic
   authentication with username `user` and password `pass`.

## Architecture

The test is the safeguard: it ties the schema to the Go defaults, and runs with the existing
`internal/config` suite. Go types stop emitting empty values the schema rejects, through `omitempty`
tags and nil pointers, rather than the schema accepting empty values. The schema follows the
proposal's "either" forms, with only the fields Flipt itself requires
([schema strictness](discovery-01.md#schema-strictness)). A throwaway prototype of this approach
passed the existing tests, and validated the default configuration
([prototype](discovery-01.md#prototype)).

- **`DefaultConfig()`**, in [`config.go`](/internal/config/config.go), returns the default values as
  a Go literal: the test helper `defaultConfig()` moved and exported. Each section's `setDefaults`
  keeps setting the same values on viper, and `TestLoad`'s default cases check that the two agree
  ([defaults home](discovery-01.md#defaults-home)).
- **`DecodeHooks`**, in `config.go`, is the exported hook chain. `Load` and the test both use it. It
  owns how strings become durations, lists, and enums.
- **Configuration key names** come from the mapstructure tags. Every tag gets `omitempty`, except
  the squashed one, and `Version` gets the tag `version`. `fieldKey` returns a tag's name whatever
  its options, so environment variables keep their names.
- **The storage configuration**, in [`storage.go`](/internal/config/storage.go), holds `Local` and
  `Git` by pointer. After decoding, it clears the pointer of every type not selected. It owns the
  rule "a backend's settings exist only when it is selected". Its validation reads a pointer only
  for its own type.
- **The CUE schema**, [`config/flipt.schema.cue`](/config/flipt.schema.cue), owns what a valid
  configuration file is. It gets one shared duration pattern, the missing sections and fields, the
  two database forms, CORS as a list or a string, and storage as a choice on `type`. Its full shape
  is in the [data model](data-model.md).
- **The schema test**, in `internal/config`, decodes `DefaultConfig()`, turns durations into
  strings, and validates with concrete values required. It owns the guarantee of US1.

Tradeoffs:

- Each new default is written twice, in `setDefaults` and in `DefaultConfig()`. `TestLoad` fails
  until both agree.
- The JSON schema, [`config/flipt.schema.json`](/config/flipt.schema.json), stays as it is, so the
  two schemas disagree until someone ports these changes. Editors keep flagging valid `storage` and
  Kubernetes settings until then.
- Only the default configuration is validated. A schema error in a section the defaults leave empty,
  such as OIDC providers, stays unnoticed by tests.
- A failed CUE disjunction reports "N errors in empty disjunction", which is hard to read. The
  "either" forms add three such choices.

## Edge cases

| Importance | Situation                                                                        | What happens                                                                                   |
| ---------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| High       | An environment variable for a key whose tag now has `omitempty`                  | It keeps its name, such as `FLIPT_DB_URL` and `FLIPT_STORAGE_GIT_POLL_INTERVAL`                |
| High       | A git or local storage config, with every setting supplied                       | It loads with the same values as today, read through the pointer                               |
| Normal     | The default configuration, with the filesystem storage experiment off            | `storage.type` stays empty, as `Load` gives it; the schema reads a missing type as `database`  |
| Normal     | `local:` under `type: git`, or `FLIPT_STORAGE_LOCAL_PATH` under `type: database` | `Local` is nil after loading                                                                   |
| Normal     | The HTTP config endpoint, `Config.ServeHTTP`, with a database storage            | Its JSON has no `local` or `git` key under `storage`; the UI reads only `storage.type`         |
| Normal     | Token and OIDC methods disabled, as by default                                   | Their `cleanup` is omitted, not `null`, and the schema accepts it                              |
| Normal     | A token method with no bootstrap expiration                                      | The schema accepts it: `bootstrap.expiration` becomes optional                                 |
| Niche      | A host-based database config without `port` or `user`                            | The schema accepts it, as Flipt does                                                           |
| Niche      | A negative duration, such as `-1m0s`                                             | The schema rejects it; no Flipt setting accepts one at run time                                |
| Niche      | `advanced.yml` validated against the schema                                      | Not tested: OIDC providers reach CUE with their JSON names, such as `clientID`, and would fail |

## Success criteria

- **SC-001** (schema compiles): `config/flipt.schema.cue` compiles with CUE v0.5.0.
- **SC-002** (defaults validate): the schema test validates the decoded `DefaultConfig()` under
  `cue.Concrete(true)` with zero errors.
- **SC-003** (no regression): every existing test of the repository passes, with the expectations of
  `TestLoad` updated only for the storage pointers and the extended `advanced.yml`.
- **SC-004** (build): `go build ./...` and `go vet ./...` succeed, `internal/cmd` included.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- **The tracing defaults** in `DefaultConfig()` are the literals `localhost` and `6831`, which
  [`tracing.go`](/internal/config/tracing.go) sets, rather than the Jaeger exporter's constants the
  test helper imports. The config package then gains no new import.
- **The leftover storage section** is cleared by the storage configuration after decoding and before
  validation, not by a decode hook, so the rule sits next to the type's other rules.
- **The schema test turns durations into strings** by walking the decoded map, in the test itself:
  the conversion serves the schema only, and loading never needs it.
- **The schema adds what the Go configuration reads**: `experimental.filesystem_storage`,
  `authentication.session.token_lifetime`, `state_lifetime`, and `csrf.key`, the Kubernetes method,
  and OIDC `scopes`. It adds nothing the Go configuration lacks.
- **Two notes go to [the inbox](/specs/INBOX.md)**, written during the implementation: porting these
  changes to the JSON schema, and the OIDC provider names a fully populated configuration fails on.
- **`advanced.yml` loses `backend: jaeger`** from its tracing section, a key Flipt ignores, for
  `exporter: otlp`. Its other sections stay as they are.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: the shape of `StorageConfig` and the config endpoint's output change, with no stored
data to convert and no new service.
