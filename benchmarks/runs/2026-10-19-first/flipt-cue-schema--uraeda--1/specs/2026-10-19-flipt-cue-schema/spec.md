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
> - You approve a test-backed guarantee: the decoded default Flipt configuration validates against
>   the CUE definition `#FliptSpec`, with `StorageConfig.Local` and `StorageConfig.Git` becoming
>   pointers.
> - New decision, code quality: the project sets no size limits, and discovery does not ask again
>   before 2027-01-19. It comes from your "no" in the first round.
> - Your four answers read "your call, A". I read them as choosing the recommended option each time,
>   since the readings differ little.
> - The schema is stricter than the Go loader on two mixes: a database with a URL and host fields,
>   and git authentication with both basic and token. Configurations that run today fail the schema.
>   Nothing reads the schema at runtime.
> - The JSON schema stays unchanged, and `advanced.yml` loses its `tracing.backend: jaeger` line,
>   which the struct never had.
> - Not verified yet: that the database schema, a two-branch alternative, gives readable errors. The
>   plan's first task checks it. If it does not, the test still passes or fails, and only the
>   messages stay rough.
> - Risk tier `medium`, because an exported Go struct changes shape. The plan does not wait for your
>   review.

The default Flipt configuration can drift from the CUE schema that documents it. This feature adds a
test that decodes `DefaultConfig()` and validates it against `#FliptSpec`, and fixes the schema and
the config package until it passes. Flipt maintainers get a failure when defaults and schema
disagree. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

- **New: [Code quality](../decisions/code-quality.md)**. The project sets no size limits, and a
  feature does not add them unasked.

Relied on: none. The ledger has no active decision.

## User stories

### US1: Validate the default configuration (P1)

A maintainer runs the config tests. The test decodes `DefaultConfig()` into a map with the exported
`DecodeHooks`, turns durations and enums into strings, and validates the map against `#FliptSpec`
with every value concrete. Any drift between defaults and schema fails it.

Key scenarios:

1. **Given** `DefaultConfig()`, **When** it is decoded into a `map[string]any` with
   `mapstructure.ComposeDecodeHookFunc(DecodeHooks...)`, **Then** `audit.buffer.flush_period` is
   still a `time.Duration` of 2 minutes.
2. **Given** that map with durations as strings (`"2m0s"`, `"24h0m0s"`, `"10m0s"`, `"1m0s"`,
   `"5m0s"`), **When** it is validated against `#FliptSpec` with concrete values required, **Then**
   there are no errors.
3. **Given** `Load("./testdata/default.yml")`, **When** its result is compared with
   `DefaultConfig()`, **Then** they are equal.

More scenarios:

1. **Given** a duration `1.5s`, **When** its string form is validated at `cache.ttl`, **Then** the
   schema accepts it.
2. **Given** the decoded default, **When** its top-level keys are listed, **Then** each of `log`,
   `ui`, `cors`, `cache`, `server`, `tracing`, `db`, `meta`, `authentication`, `audit`,
   `experimental`, and `storage` is accepted, and `version` is absent.
3. **Given** the decoded default, **When** `authentication.methods.oidc.cleanup` and `db.protocol`
   are looked up, **Then** both keys are absent, not `null` or `""`.

### US2: Choose a storage backend (P1)

An operator picks database, local, or git storage. Only the selected backend's settings exist:
`Storage.Local` and `Storage.Git` are nil otherwise, and the decoded configuration omits them.

Key scenarios:

1. **Given** the default configuration, whose storage type is empty, **When** it is decoded,
   **Then** `Storage.Local` and `Storage.Git` are nil, and `storage` has no `local` or `git` key.
2. **Given** a file with `storage.type: git`, repository `https://github.com/flipt-io/flipt.git`,
   and nothing else, **When** it is loaded, **Then** `Storage.Git` has ref `main` and poll interval
   30s, and `Storage.Local` is nil.
3. **Given** a file with `storage.type: local` and no path, **When** it is loaded, **Then**
   `Storage.Local.Path` is `.`, and `Storage.Git` is nil.

More scenarios:

1. **Given** a hand-built `StorageConfig` of type `git` with a nil `Git`, **When** it is validated,
   **Then** it returns "git ref must be specified" and does not panic.
2. **Given** a hand-built `StorageConfig` of type `local` with a nil `Local`, **When** it is
   validated, **Then** it returns "local path must be specified".
3. **Given** `FLIPT_STORAGE_GIT_REF=production` and `storage.type: git`, **When** the file is
   loaded, **Then** `Storage.Git.Ref` is `production`.

### US3: Write the configuration in any accepted form (P2)

A user writes a database, git authentication, or CORS setting in any form Flipt accepts, and the
schema agrees. Where the proposal says "either", the schema rejects mixing the two forms.

Key scenarios:

1. **Given** `db` with protocol `postgres`, host `localhost`, and name `flipt`, **When** it is
   validated, **Then** it is accepted without a port or a user.
2. **Given** `db` with url `postgres://postgres@localhost:5432/flipt` and also host `localhost`,
   **When** it is validated, **Then** it is rejected.
3. **Given** git storage with basic authentication (username `user`, password `pass`) and also a
   token `abc`, **When** it is validated, **Then** it is rejected.

More scenarios:

1. **Given** `db` with protocol `postgres` and host `localhost` but no name, **When** it is
   validated, **Then** it is rejected.
2. **Given** `db` with `conn_max_lifetime: "30m0s"` and `prepared_statements_enabled: false`,
   **When** it is validated, **Then** it is accepted.
3. **Given** `cors.allowed_origins` as `["foo.com", "bar.com"]`, and then as `"foo.com"`, **When**
   each is validated, **Then** both are accepted.
4. **Given** git storage with only a token `abc`, **When** it is validated, **Then** it is accepted.
5. **Given** `db` with url `postgres://postgres@localhost:5432/flipt` and `max_idle_conn: 10`,
   **When** it is validated, **Then** it is accepted.

### US4: See the new sections in the full example (P2)

The example `advanced.yml`, the fully populated file the load test reads, also exercises audit, an
OTLP tracing exporter, and git storage.

Key scenarios:

1. **Given** `advanced.yml`, **When** it is loaded, **Then** `audit.sinks.log` is enabled with file
   `/path/to/logs.txt`, and `audit.buffer` has capacity 10 and flush period 3m.
2. **Given** `advanced.yml`, **When** it is loaded, **Then** tracing has exporter `otlp` and
   `otlp.endpoint` `localhost:4318`.
3. **Given** `advanced.yml`, **When** it is loaded, **Then** storage has type `git`, and `git` has
   repository `https://github.com/flipt-io/flipt.git`, ref `production`, poll interval 5s, and basic
   authentication with username `user` and password `pass`. `Storage.Local` is nil.

### US5: Keep field names and environment keys aligned (P3)

The name of a configuration field is the same in the decoded map, the schema, and the environment
variable, even when its tag has `omitempty`.

Key scenarios:

1. **Given** the field tag `mapstructure:"flush_period,omitempty"`, **When** `fieldKey` reads it,
   **Then** it returns `flush_period`, so `FLIPT_AUDIT_BUFFER_FLUSH_PERIOD` binds.
2. **Given** a `Config` with `Version` `1.0`, **When** it is decoded into a map, **Then** the key is
   `version`.
3. **Given** the default `db.max_open_conn` of 0, **When** the default is decoded, **Then** the key
   is absent.

## Architecture

The fix is in two places: the Go config package makes the decoded map mirror the schema, and the
schema learns every section. There is no new dependency: `cuelang.org/go` is already in
[go.mod](/go.mod). See [discovery](discovery-01.md#the-proposals-path-and-existing-actions) for the
eight failures this closes, found by running the test's steps on a copy of the repository.

- **The default configuration**, `DefaultConfig()` in `config.go`, owns the canonical default
  values. The loading test and the schema test both use it, replacing the test helper.
- **The decode hooks**, the exported `DecodeHooks`, own the conversions applied when decoding.
  `Load` adds its experimental-field hook to a copy, never to the shared list.
- **The field keys**, `fieldKey`, own the rule that turns a `mapstructure` tag into a name. It reads
  the name before a comma, whatever the option.
- **The storage configuration** owns the rule "nil unless selected". Its validation reads `Git` and
  `Local` only after a nil check.
- **The tags** own what the decoded map leaves out: `omitempty` on optional fields removes empty
  values, so nil pointers and zero scalars never reach validation.
- **The schema**, `#FliptSpec` in [`config/flipt.schema.cue`](/config/flipt.schema.cue), owns the
  contract: its sections, the duration pattern, and the database and git alternatives.
- **The schema test**, in `config_test.go`, owns the adaptation of durations and enums to strings.
  It adds no exported function.
- **The example file**, `advanced.yml`, owns the fully populated load case.

Tradeoffs:

- The schema rejects two mixes that Go accepts, so it documents what applies and not what is
  silently ignored.
- The adaptation lives in the test: a new type needing a string form fails the test until its
  adapter is added there.
- The JSON schema twin stays without `storage`, and drifts further from the CUE schema.

## Edge cases

| Importance | Situation                                                       | What happens                                                    |
| ---------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| High       | Storage type is `git` or `local` and its pointer is nil         | validation returns the "must be specified" error, no panic      |
| High       | Experimental storage flag off, so loading blanks `Storage`      | `Type` is empty, both pointers are nil, behaviour is unchanged  |
| Normal     | `omitempty` on a tag and an environment variable for that field | the variable binds under the name before the comma              |
| Normal     | Duration string with decimals, such as `1.5s`                   | the schema accepts it                                           |
| Normal     | Duration given as an integer in a configuration file            | the schema still accepts it, as before                          |
| Normal     | Zero-valued optional field, such as `max_open_conn` 0           | it is left out of the decoded map, and the schema default stays |
| Niche      | `Git.Authentication` has neither basic nor token                | an empty `authentication` object is accepted                    |
| Niche      | A construction site outside `internal/config` builds `Local{}`  | none exists today; a build error there is expected, not avoided |

## Success criteria

- **SC-001** (zero errors): Validating the decoded and adapted `DefaultConfig()` against
  `#FliptSpec` with concrete values returns no errors.
- **SC-002** (equal): `Load("./testdata/default.yml")` equals `DefaultConfig()` in the existing
  default case.
- **SC-003** (12 sections): `#FliptSpec` accepts all 12 top-level sections the decoded default
  emits.
- **SC-004** (builds): The whole module builds, and every existing config test passes with its
  changed expectations.
- **SC-005** (exact values): `advanced.yml` loads into exactly the values of the fourth story.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- **Answers**: each answer reads "your call, A", taken as option A of its question.
- **Git authentication stays a value**: `Git.Authentication` is not made a pointer, since the
  proposal names only `Local` and `Git`. The schema accepts an empty `authentication`.
- **Schema durations**: every duration field takes the duration pattern, with decimals, or an
  integer. This includes `conn_max_lifetime`, `bootstrap.expiration`, and the audit `flush_period`.
- **Schema git entry**: `repository` is required, as the loader requires it. `ref` and
  `poll_interval` are optional, with the loader's defaults `main` and `30s`.
- **Schema additions**: `experimental.filesystem_storage.enabled`, and the Kubernetes method with
  its four settings and cleanup, mirror the Go types.
- **Audit limits** (capacity 2 to 10, flush period 2m to 5m) stay in Go and are not copied.
- **Which tags get `omitempty`**: the optional fields of the configuration structs. Required fields,
  such as the git `repository` and `ref`, keep their plain tags.
- **Test-side adaptation**: enums such as the database protocol become their string form with the
  same maps the Go code already uses.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: no stored data changes, but an exported struct changes shape, and the decoded map
changes with it.
