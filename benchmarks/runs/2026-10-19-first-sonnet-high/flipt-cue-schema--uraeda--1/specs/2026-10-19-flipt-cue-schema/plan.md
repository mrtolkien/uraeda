---
status: auto-approved
spec-revision: 1
---

# Plan: Default Flipt configuration validates against the CUE schema

**Goal:** Make `DefaultConfig()`, decoded to a map, validate concretely against a fuller
`#FliptSpec` CUE schema, with a test that keeps the two from drifting.

**Architecture:** As in the [spec's architecture](spec.md#architecture). `DefaultConfig()` and
`DecodeHooks` live in `internal/config/config.go`, and `Load` keeps its own `setDefaults` path.
`StorageConfig` in `storage.go` owns "a selected type has its settings" in `validate`;
`internal/cmd/grpc.go` only reads the pointers inside the matching `case`, after `validate` has run.
`config/flipt.schema.cue` owns the shape of a valid file. One new test file,
`internal/config/schema_test.go`, owns the map-to-schema conversion.

**Spec:** [spec.md](spec.md): read it with this plan. The stored shapes are in
[data-model.md](data-model.md).

## Review focus

- **`omitempty` on a tag that binds an environment variable**: `fieldKey` must return the tag's
  name, or `FLIPT_CACHE_TTL` stops binding. Covered by Task 3 (`TestLoad` ENV case with
  `FLIPT_CACHE_TTL=2m`, and a `fieldKey` unit test).
- **A selected storage type with a nil pointer**: `validate` must return the existing error and
  never panic, and `grpc.go` must return an error. Covered by Task 2.
- **The experimental flag is off while `storage.type` is `git`**: both pointers nil, no error.
  Covered by Task 2.
- **An empty `authentication` under git storage**: no empty `basic` or `token` object is emitted.
  Covered by Task 4.

## Global constraints

- "`StorageConfig.Local` and `StorageConfig.Git` must become nil-able pointer fields, typed `*Local`
  and `*Git`" ([proposal](proposal.md)). Do not keep them as values to avoid build errors.
- The existing environment-variable cases of `TestLoad` stay unchanged and pass (SC-005).
- Default values for loading stay in each `setDefaults`; `DefaultConfig()` is the canonical copy the
  tests compare against, and `Load` of an empty file must equal it (SC-003).
- Duration strings use Go's form: `24h0m0s`, `10m0s`, `1m0s`, `5m0s`, `2m0s`. The pattern is
  `^([0-9]+(\.[0-9]+)?(ns|us|µs|ms|s|m|h))+$`, or an int.
- The database parts form requires `protocol`, `host`, `port`, `name`, `user`; the URL form requires
  `url`; both accept `password`, `max_idle_conn`, `max_open_conn`, `conn_max_lifetime`,
  `prepared_statements_enabled`.
- The schema describes shapes only, never a cross-field rule. Existing schema fields
  (`cache.memory.enabled`, `cache.memory.expiration`, `tracing.jaeger.enabled`) stay. `version`
  stays `"1.0"`.
- Which tags get `omitempty` (the plan's choice): a field whose default is empty, and which the
  schema rejects when empty. The expected set is `Version`, the database `protocol`, `host`, `port`,
  `name`, `user`, `password`, `max_open_conn`, `conn_max_lifetime`, the two storage pointers,
  `Authentication.BasicAuth` and `TokenAuth` (already), `meta.state_directory`, and the
  `cache.redis.password`; Task 4 settles the exact set by what the schema test reports.
- No new dependency: CUE v0.5.0 (`cuelang.org/go`) and mapstructure v1.5.0 are in `go.mod`.
- Constitution: tests cover the spec's scenarios; follow the repository's patterns.

## Code read

- [`internal/config/config.go`](/internal/config/config.go): `decodeHooks` (unexported, used in
  `Load`), `fieldKey` (returns the tag when there is no attribute, or `squash`), `Load`. `fieldKey`
  is also used by `bindEnvVars`, so it decides env var names.
- [`internal/config/storage.go`](/internal/config/storage.go): `StorageConfig` with value fields
  `Local`, `Git`; `validate` reads `c.Git.*` and `c.Local.Path`; `setDefaults` sets `storage.git.*`
  or `storage.local.path` only for the selected type.
- [`internal/cmd/grpc.go`](/internal/cmd/grpc.go) lines 138-175: the only readers of `Storage.Git`
  and `Storage.Local`. `internal/cmd/auth.go:38` reads only `Storage.Type`. No other construction
  site exists outside `config_test.go` (grep of `Storage.Local`, `Storage.Git`, `config.Local`,
  `config.Git`).
- [`internal/config/config_test.go`](/internal/config/config_test.go): `defaultConfig()` helper
  (line 203) used by `TestLoad`, `TestServeHTTP`; table-driven `TestLoad` runs each case from YAML
  and from env vars on top of `testdata/default.yml`. Storage cases at lines ~684-720; the
  `advanced.yml` case at ~575-660.
- [`internal/config/testdata/advanced.yml`](/internal/config/testdata/advanced.yml): has no `audit`
  or `storage`, and `tracing` uses `backend: jaeger`.
- [`config/flipt.schema.cue`](/config/flipt.schema.cue): the schema to extend. `TestJSONSchema`
  compiles the JSON schema only; the JSON schema is not changed.
- Validation commands: `go build ./...`, `go vet ./internal/config/... ./internal/cmd/...`,
  `go test ./internal/config/... ./internal/cmd/...`.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

| Addition                                                         | Why                                                                                                                  | Simpler alternative rejected                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `schema_test.go` helper `toSchemaMap(t, *Config) map[string]any` | The one place that decodes with `DecodeHooks` and converts durations and enums to strings; used by every schema test | Inlining it in each test; a library helper (the spec chose the test) |

No function or file grows past a limit.

## Test map

The integration tests run `Load` on the testdata files and decode `DefaultConfig()` with the real
mapstructure and CUE libraries, with no mocks and no clock.

| Spec item                                                                 | Task | Test                                                                                               |
| ------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| Outside behaviour: hooks run on struct to map; CUE rejects unknown fields | 1    | `TestSchemaToolingAssumptions`                                                                     |
| US1.1, SC-001, SC-002                                                     | 4    | `TestDefaultConfigValidatesAgainstSchema`                                                          |
| US1.2, US1.3, SC-004                                                      | 4    | `TestDefaultConfigDurations`                                                                       |
| US1.4, SC-003                                                             | 2    | `TestLoadEmptyFileEqualsDefaultConfig`                                                             |
| US1 more.1 (top-level keys, no `Version`)                                 | 3    | `TestDefaultConfigTopLevelKeys`                                                                    |
| US1 more.2 (unknown section)                                              | 4    | `TestSchemaRejectsUnknownSection`                                                                  |
| US1 more.3 (`db` has `url`, no `protocol`)                                | 3    | `TestDefaultConfigTopLevelKeys`                                                                    |
| US2.1, US2.2, US2 more.1                                                  | 2    | `TestLoad` cases "git config provided", "local config provided", "git storage with experiment off" |
| US2.3, SC-006                                                             | 3    | `TestDefaultConfigStorageOmitted`                                                                  |
| US2.4                                                                     | 3    | `TestLoad` env case `FLIPT_CACHE_TTL=2m`; `Test_fieldKey`                                          |
| US2 more.2 (nil Git error)                                                | 2    | `TestStorageConfigValidateNilSettings`                                                             |
| US2 more.3 (`ServeHTTP` JSON)                                             | 2    | `TestServeHTTP` extended                                                                           |
| US3.1, US3.2, US3.3, US3.4                                                | 4    | `TestSchemaAcceptsShapes` (table of maps)                                                          |
| US3 more.1-5                                                              | 4    | `TestSchemaAcceptsShapes`                                                                          |
| US4.1, US4.2, US4.3                                                       | 5    | `TestLoad` case "advanced"                                                                         |
| Review focus: empty authentication                                        | 4    | `TestSchemaAcceptsShapes` row "git without authentication"                                         |

## Waves

1. Task 1 alone: it may stop the build.
2. Task 2 alone: it changes `config_test.go` and storage.
3. Task 3 alone: it consumes Task 2's `DefaultConfig`.
4. Task 4 alone: it consumes Task 3's tags.
5. Task 5 alone: it edits `config_test.go` and `advanced.yml`, after Task 2.

Every task touches `config_test.go` or builds on the previous one, so the build is in sequence.

---

## Task 1: Check the outside behaviour

**Files:**

- Create: `internal/config/schema_test.go`

**Interfaces:**

- Produces: a `schema_test.go` in package `config` that later tasks extend.

- [x] **Step 1: Write `TestSchemaToolingAssumptions`**

Using a small local struct (not the config) with a `time.Duration`, a nested struct, and an
`omitempty` field, decode it to `map[string]any` with `mapstructure.NewDecoder` and
`DecoderConfig{DecodeHook: mapstructure.ComposeDecodeHookFunc(decodeHooks...), Result: &m}`. Assert
the duration is still a `time.Duration` (not converted), the nested struct became a map, and the
`omitempty` field is absent. Then compile `../../config/flipt.schema.cue` with
`cuecontext.New().CompileBytes`, look up `#FliptSpec`, unify with `{unknown_section: 1}` and assert
`Validate(cue.Concrete(true))` returns an error.

The break it catches: hooks that do not run on struct-to-map, or a schema open to unknown fields,
would make every later schema test pass vacuously.

- [x] **Step 2: Run it**

- Run: `go test ./internal/config -run TestSchemaToolingAssumptions`
- Expected: PASS. If the hook assertion fails, the schema test converts values itself (spec
  Unverified note); if CUE accepts the unknown key, make `#FliptSpec` closed in Task 4 and stop for
  the human only if that cannot be done.

- [x] **Step 3: Commit**

```bash
git add internal/config/schema_test.go
git commit -m "test(flipt-cue-schema): check decode hooks and CUE closedness"
```

## Task 2: `DefaultConfig`, `DecodeHooks`, and pointer storage

**Risky:** `StorageConfig` changes shape, and a nil pointer could panic a reader.

**Files:**

- Modify: `internal/config/config.go` (rename `decodeHooks`, add `DefaultConfig`),
  `internal/config/storage.go` (`StorageConfig`, `validate`), `internal/cmd/grpc.go` (lines
  138-175), `internal/config/schema_test.go` (use `DecodeHooks`)
- Modify: `internal/config/config_test.go` (remove `defaultConfig`, use `DefaultConfig`, storage
  expectations, new tests)

**Interfaces:**

- Produces: `var DecodeHooks []mapstructure.DecodeHookFunc` (same content as `decodeHooks`);
  `func DefaultConfig() *Config` returning exactly what `defaultConfig()` returns today;
  `StorageConfig{Type StorageType; Local *Local; Git *Git}` with tags
  `json:"local,omitempty" mapstructure:"local,omitempty"` and the same for `git`.

- [x] **Step 1: Write the failing tests**

In `config_test.go`: replace `defaultConfig` calls by `DefaultConfig()` (a mechanical edit; it fails
to compile first). Change the storage expectations to `Local: &Local{Path: "."}` and
`Git: &Git{...}`. Add:

- `TestLoadEmptyFileEqualsDefaultConfig`: `Load("./testdata/default.yml")` equals `DefaultConfig()`.
- `TestStorageConfigValidateNilSettings`: `StorageConfig{Type: GitStorageType}` returns
  `git ref must be specified`; `StorageConfig{Type: LocalStorageType}` returns
  `local path must be specified`. Catches a nil dereference.
- A `TestLoad` case "git storage with experiment off": a testdata file
  `testdata/storage/git_experiment_off.yml` with `storage.type: git` and a repository, no
  experimental flag; expects `DefaultConfig()` with `Storage.Type` set to `git` and both pointers
  nil. First check what `Load` does today with it and keep that behaviour.
- In `TestServeHTTP`: the JSON of `DefaultConfig()` has no `local` and no `git` under `storage`
  (extend the golden JSON in the test, or assert on the decoded map).

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config`
- Expected: FAIL to build, `undefined: DefaultConfig`.

- [x] **Step 3: Implement**

Move the `defaultConfig` body into `DefaultConfig()` in `config.go`; export `DecodeHooks` and update
`Load` and `schema_test.go`. Change the two `StorageConfig` fields to pointers with the tags above.
In `validate`, treat a nil pointer as the empty value so the existing messages come out (check
`Git == nil` before `Ref`; nil `Git` returns `git ref must be specified`, nil `Local` returns
`local path must be specified`). In `grpc.go`, inside each case, return `errors.New`/`fmt.Errorf`
when the pointer is nil before reading it.

- [x] **Step 4: Run the project's validation**

- Run: `go build ./... && go vet ./internal/... && go test ./internal/config/... ./internal/cmd/...`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add internal/config internal/cmd/grpc.go
git commit -m "feat(flipt-cue-schema): export DefaultConfig and DecodeHooks, make storage settings pointers"
```

## Task 3: Align tags and `fieldKey`

**Files:**

- Modify: `internal/config/config.go` (`fieldKey`, `Version` tag), and the config structs in
  `internal/config/*.go` that need `omitempty`
- Test: `internal/config/config_test.go`, `internal/config/schema_test.go`

**Interfaces:**

- Consumes: `DefaultConfig()`, `DecodeHooks`, `toSchemaMap` is not yet needed.
- Produces: `fieldKey(field reflect.StructField) string` now returns the tag's name also when the
  attribute is `omitempty` (still the empty string for `squash`); `Version` has
  `mapstructure:"version,omitempty"`. A test helper `decodeDefault(t) map[string]any` in
  `schema_test.go`: decodes `DefaultConfig()` with `DecodeHooks`.

- [x] **Step 1: Write the failing tests**

- `Test_fieldKey`: `mapstructure:"ttl,omitempty"` returns `ttl`; `mapstructure:"x,squash"` returns
  `""`; no tag returns the lowercased name.
- `TestLoad` env case: a case "cache ttl from env" setting `FLIPT_CACHE_TTL=2m` after Task 3's tag
  change; since the table's ENV runner reads YAML, instead add a standalone
  `TestLoadEnvOmitemptyTag` that sets the variable, loads `testdata/default.yml`, and expects
  `Cache.TTL == 2*time.Minute`. Catches `omitempty` leaking into the env key.
- `TestDefaultConfigTopLevelKeys`: the decoded map has no `Version` key, its keys are a subset of
  the 13 listed in US1 more.1, and `db` has `url` equal to `file:/var/opt/flipt/flipt.db` and no
  `protocol`.
- `TestDefaultConfigStorageOmitted`: `decoded["storage"]` has no `local` and no `git` key.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config -run 'Test_fieldKey|TestLoadEnvOmitemptyTag|TestDefaultConfig'`
- Expected: FAIL, `Test_fieldKey` returns `""` for the `omitempty` case.

- [x] **Step 3: Implement**

Make `fieldKey` return the name before the comma unless the attribute is `squash`. Add `omitempty`
to `Version` and to the fields chosen by the rule in Global constraints; apply only those the schema
needs (Task 4 reports the remainder). `Version` and the storage pointers must be there for these
tests.

- [x] **Step 4: Run the project's validation**

- Run: `go test ./internal/config/... ./internal/cmd/...`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add internal/config
git commit -m "feat(flipt-cue-schema): keep mapstructure field names when omitempty is set"
```

## Task 4: The schema and its test

**Risky:** the schema is the contract editors validate against; it is also the shape of the test
oracle.

**Files:**

- Modify: `config/flipt.schema.cue`, `internal/config/schema_test.go`, and the config structs for
  any `omitempty` the test shows missing

**Interfaces:**

- Consumes: `DefaultConfig()`, `DecodeHooks`, `decodeDefault`.
- Produces: `toSchemaMap(t *testing.T, cfg *Config) map[string]any` (decode with `DecodeHooks`, then
  walk the map converting `time.Duration` with `.String()` and enum values via their `String()`);
  `validateSchema(t, m map[string]any) error` (compile the file, look up `#FliptSpec`,
  `Unify(ctx.Encode(m))`, `Validate(cue.Concrete(true))`).

- [x] **Step 1: Write the failing tests**

- `TestDefaultConfigValidatesAgainstSchema`: `validateSchema(toSchemaMap(DefaultConfig()))` returns
  no error.
- `TestDefaultConfigDurations`: before conversion `Cache.TTL` is a `time.Duration` of one minute in
  `decodeDefault`; after, the five strings of US1.3 appear at
  `authentication.session.token_lifetime`, `state_lifetime`, `cache.ttl`,
  `cache.memory.eviction_interval`, `audit.buffer.flush_period`.
- `TestSchemaRejectsUnknownSection`: the default map plus `unknown_section` fails.
- `TestSchemaAcceptsShapes`: a table of `name, mutate func(map[string]any), wantErr bool` over the
  default map: the postgres URL with `conn_max_lifetime` `30m0s`; the parts form (valid), and
  without `port` and `user` (error); `allowed_origins` as `"foo.com"` and as a list; git storage
  with `ref` `production`, `poll_interval` `5s`, with basic auth, with token auth, and with no
  `authentication`; `flush_period` `1.5s` and `120`; token `bootstrap` without `expiration`;
  kubernetes with `enabled` and `discovery_url`. Each catches one schema mistake named in its row.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config -run 'Schema|DefaultConfigValidates|DefaultConfigDurations'`
- Expected: FAIL, a CUE error naming a field the schema lacks, such as `storage: field not allowed`.

- [x] **Step 3: Extend the schema**

Edit `#FliptSpec` per [data-model.md](data-model.md): add `experimental`, `storage` (`type`,
`local.path`, `git` with `repository`, `ref`, `poll_interval`,
`authentication.basic{username,password}`, `authentication.token{access_token}`), the `db`
alternatives (URL form or parts form, with shared options), `cors.allowed_origins` as list or
string, `audit.buffer.flush_period` as a duration, `authentication.session` `token_lifetime`,
`state_lifetime`, `csrf.key`, `methods.kubernetes` (with `enabled`, `discovery_url`, `ca_path`,
`service_account_token_path`, `cleanup`), optional `bootstrap.expiration`, and a shared duration
definition with the pattern from Global constraints replacing the repeated ones. Then run the test,
and for each remaining error decide by the rule whether the Go tag gets `omitempty` or the schema is
loosened; do not weaken the unknown-field check. Keep the schema's `@jsonschema` attribute and
existing fields.

- [x] **Step 4: Run the project's validation**

- Run:
  `go build ./... && go vet ./internal/config/... && go test ./internal/config/... ./internal/cmd/...`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add config/flipt.schema.cue internal/config
git commit -m "feat(flipt-cue-schema): validate the default configuration against #FliptSpec"
```

## Task 5: Extend `advanced.yml`

**Files:**

- Modify: `internal/config/testdata/advanced.yml`, `internal/config/config_test.go` (the "advanced"
  case)

**Interfaces:**

- Consumes: `StorageConfig` pointers from Task 2.

- [x] **Step 1: Write the failing expectations**

In the "advanced" case set `Audit` to `LogFile{Enabled: true, File: "/path/to/logs.txt"}` and
`Buffer{Capacity: 10, FlushPeriod: 3 * time.Minute}`; `Tracing.Exporter` to `TracingOTLP` with
`OTLP.Endpoint` `localhost:4318` (keep the other tracing defaults); `Storage` to
`StorageConfig{Type: GitStorageType, Git: &Git{Repository: "https://github.com/flipt-io/flipt.git", Ref: "production", PollInterval: 5 * time.Second, Authentication: Authentication{BasicAuth: &BasicAuth{Username: "user", Password: "pass"}}}}`
with `Local` nil. Remove the old `Storage{Type: database}` line and the jaeger tracing block. The
break it catches: a `storage` section left at its defaults, or a mistyped key silently ignored.

- [x] **Step 2: Run to check it fails**

- Run: `go test ./internal/config -run 'TestLoad/advanced'`
- Expected: FAIL, a diff on `Audit` (and `Tracing`).

- [x] **Step 3: Edit `advanced.yml`**

Add `audit` (`sinks.log.enabled: true`, `file: "/path/to/logs.txt"`, `buffer.capacity: 10`,
`flush_period: 3m`), set `tracing` to `enabled: true`, `exporter: otlp`,
`otlp.endpoint: "localhost:4318"`, and add `storage` with `type: git` and the `git` entry of the
spec (US4.3), with `authentication.basic` `username: user`, `password: pass`. The experimental flag
is already on.

- [x] **Step 4: Run the project's validation**

- Run: `go build ./... && go vet ./internal/... && go test ./internal/...`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add internal/config
git commit -m "test(flipt-cue-schema): cover audit, otlp and git storage in advanced.yml"
```
