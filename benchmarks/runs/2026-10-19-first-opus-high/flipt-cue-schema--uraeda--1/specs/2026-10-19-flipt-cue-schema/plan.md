---
status: auto-approved
spec-revision: 1
---

# Plan: Default configuration validates against the CUE schema

**Goal:** the CUE schema compiles and accepts Flipt's default configuration, and a test in
`internal/config` keeps it so.

**Architecture:** five tasks, in the order the data flows. `config.go` exports the defaults,
`DefaultConfig()`, and the decode hook chain, `DecodeHooks`, that `Load` already uses. The
mapstructure tags then own the configuration's key names everywhere: viper reads them, `fieldKey`
derives environment variables from them, and struct-to-map decoding writes them, leaving out empty
values through `omitempty`. `StorageConfig` owns the rule "a backend's settings exist only when it
is selected": it holds `Local` and `Git` by pointer, and clears the unselected ones itself, before
it validates. The CUE schema owns what a valid file is, and the schema test, a new file in
`internal/config`, ties it to `DefaultConfig()`. See the
[spec's architecture](spec.md#architecture).

A test helper, `decodeConfig`, decodes a `*Config` into a map with `DecodeHooks`, exactly as the
spec's scenarios say; the key-name, storage, and schema tests all use it. Only the schema test turns
durations into strings.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A squashed field keeps its environment variables.** `AuthenticationMethod.Method` is tagged
   `mapstructure:",squash"`: once `fieldKey` reads tag names whatever their options, it must still
   return no name for it, so `FLIPT_AUTHENTICATION_METHODS_KUBERNETES_DISCOVERY_URL` keeps working.
   Task 2, through `Test_mustBindEnv` and the Kubernetes cases of `TestLoad` from environment
   variables.
2. **A selected backend whose pointer is nil** fails validation with the error its empty section
   gives today, "git ref must be specified" or "local path must be specified", never a nil pointer
   panic. Task 3.
3. **A configured version** decodes to the key `version` with its value, `1.0`, not to `Version`,
   and not dropped. Task 2.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these.

From [the proposal](proposal.md), word for word:

- "The default Flipt configuration must be available through a function `DefaultConfig()` in the
  config package that takes no arguments and returns a `*Config`, and it must return the same
  canonical default values used by the configuration loading path."
- "The configuration decode hook chain must be reusable through the exported `DecodeHooks` value in
  the config package, so decoding the default configuration into a `map[string]any` uses the same
  conversions as normal configuration loading."
- "Mapstructure field names must align with the schema field names used for validation, and
  `omitempty` options in mapstructure tags must not prevent the correct field name from being used."
- "`StorageConfig.Local` and `StorageConfig.Git` must become nil-able pointer fields, typed `*Local`
  and `*Git`, so that each one is nil when its storage backend is not selected and carries the
  supplied settings when that backend is selected, and so that `local` and `git` are omitted
  entirely from the decoded configuration rather than emitted as empty objects."
- "Within the source this change covers, storage settings are therefore supplied by reference and
  that source must continue to build."
- "Decoding `DefaultConfig()` with `mapstructure.ComposeDecodeHookFunc(DecodeHooks...)` must
  preserve duration fields as `time.Duration` values before schema validation adaptation."
- "The CUE configuration schema must expose a top-level `#FliptSpec` definition that can be used to
  validate decoded Flipt configuration maps."
- The `advanced.yml` values: "an `audit` section whose `sinks.log` is enabled with `file` set to
  `/path/to/logs.txt` and whose `buffer` has `capacity` 10 and `flush_period` 3m; a `tracing`
  section that selects the OTLP exporter through `exporter: otlp` and sets `otlp.endpoint` to
  `localhost:4318`; and a `storage` section of type `git` whose `git` entry has `repository`
  `https://github.com/flipt-io/flipt.git`, `ref` `production`, `poll_interval` 5s, and basic
  authentication with username `user` and password `pass`."

From [the spec](spec.md) and its [data model](data-model.md):

- "Every tag gets `omitempty`, except the squashed one, and `Version` gets the tag `version`.
  `fieldKey` returns a tag's name whatever its options, so environment variables keep their names."
- "A duration is a string matching `^([0-9]+(\.[0-9]+)?(ns|us|µs|ms|s|m|h))+$`, or an integer of
  nanoseconds: one definition, shared by every duration field."
- The `db` forms: the URL form requires `url` and forbids `protocol`, `host`, `port`, `name`,
  `user`; the host form requires `protocol`, `host`, `name`, allows `port` and `user`, and forbids
  `url`. Both allow `password`, `max_idle_conn`, `max_open_conn`, `conn_max_lifetime`, and
  `prepared_statements_enabled`. "A `db` section with neither `url` nor `host` reads as the URL
  form, whose `url` has the default `file:/var/opt/flipt/flipt.db`."
- The `storage` forms: `database`, or no `type`, with no other field; `local` with `local.path`;
  `git` with `git.repository`, `git.ref`, `git.poll_interval`, and an optional `git.authentication`
  that is "either `basic`, with `username` and `password`, or `token`, with `access_token`: one or
  the other, not both."
- "The tracing defaults in `DefaultConfig()` are the literals `localhost` and `6831`."
- "The schema adds what the Go configuration reads [...]. It adds nothing the Go configuration
  lacks."
- [`config/flipt.schema.json`](/config/flipt.schema.json) stays as it is (Q3, answer A).
- Only the default configuration is validated against the schema (Q4, answer A).
- `advanced.yml` "loses `backend: jaeger`" for `exporter: otlp`; "its other sections stay as they
  are."

Existing guarantees:

- Every `TestLoad` case loads the same `Config` from its YAML file and from the equivalent `FLIPT_*`
  environment variables ([`config_test.go`](/internal/config/config_test.go), the `(ENV)` subtests).
  Every case keeps passing both ways.
- `Load` replaces the storage section by its zero value when `experimental.filesystem_storage` is
  off (`experimentalFieldSkipHookFunc` in [`config.go`](/internal/config/config.go)): the default
  storage type stays empty.
- [`internal/cmd/grpc.go`](/internal/cmd/grpc.go), lines 141–168, reads `cfg.Storage.Git` and
  `cfg.Storage.Local` only in its selected type's branch; it must keep building, unchanged.

## Code read

- [`internal/config/config.go`](/internal/config/config.go): `decodeHooks`, unexported, is the chain
  `Load` passes to `v.Unmarshal`, with `experimentalFieldSkipHookFunc` appended. `Config.Version`
  has no mapstructure tag. `fieldKey` returns the tag's name only when it has no option or `squash`;
  `bindEnvVars` calls it for every struct field, descending through pointers.
- [`internal/config/config_test.go`](/internal/config/config_test.go): the package's only test file,
  testify `assert` and `require`. `defaultConfig()` (line 203) holds the defaults; `TestLoad` is a
  table of cases, each loaded from YAML and from environment variables built by `readYAMLIntoEnv`;
  `TestServeHTTP` only checks the status; `Test_mustBindEnv` checks the keys `bindEnvVars` binds. It
  imports `github.com/uber/jaeger-client-go` only for the tracing defaults.
- [`internal/config/storage.go`](/internal/config/storage.go): `Local` and `Git` are values;
  `setDefaults` sets `storage.local.path` or `storage.git.ref` and `poll_interval` only for the
  selected type, so a selected backend always gets a section; `validate` reads them only for the
  selected type.
- [`internal/config/authentication.go`](/internal/config/authentication.go):
  `AuthenticationMethod.Method` is the only `,squash` tag; `Cleanup` is a pointer, nil unless the
  method is enabled; `validate` already normalizes a value (the session domain), a precedent for
  `StorageConfig` clearing its pointers in `validate`.
- The other files with mapstructure tags: [`audit.go`](/internal/config/audit.go),
  [`cache.go`](/internal/config/cache.go), [`cors.go`](/internal/config/cors.go),
  [`database.go`](/internal/config/database.go),
  [`experimental.go`](/internal/config/experimental.go), [`log.go`](/internal/config/log.go),
  [`meta.go`](/internal/config/meta.go), [`server.go`](/internal/config/server.go),
  [`tracing.go`](/internal/config/tracing.go), [`ui.go`](/internal/config/ui.go): 114 tags in all.
- mapstructure v1.5.0, `decodeMapFromStruct`: a nil pointer with `omitempty` is left out, a non-nil
  pointer to a struct is decoded as the struct, and a struct is never empty, so it always gives a
  map.
- [`config/flipt.schema.cue`](/config/flipt.schema.cue): package `flipt`, with `#FliptSpec` and its
  section definitions nested inside it; `boolean` on line 104 stops it compiling.
- [`internal/cue/validate.go`](/internal/cue/validate.go): the repository already uses CUE v0.5.0,
  `cuecontext.New()` and `CompileBytes`; no new dependency is needed.
- [`internal/cmd/grpc.go`](/internal/cmd/grpc.go): the only reader of the storage pointers outside
  the package; field access compiles unchanged through a pointer.
- Validation: `go build ./...`, `go vet ./...`, `gofmt -l internal/config`, and `go test ./...` (the
  CI's `go test -count=1 -v ./...`, in [`test.yml`](/.github/workflows/test.yml)). `golangci-lint`
  runs in CI only; it is not installed here. Before any change, the build, vet, and
  `internal/config` tests pass.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

The project has no code-quality decision, so no size limit applies.

| Abstraction or exception                                  | Why it is needed                                                                                                        | Simpler alternative rejected because                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `DefaultConfig()` and `DecodeHooks`, exported             | Named by the proposal; `Load` and the tests use them                                                                    | None: required interfaces                                                                           |
| `decodeConfig(t, cfg)`, a test helper in `config_test.go` | Tasks 2, 3, and 5 decode a `*Config` into a map with `DecodeHooks`; one helper keeps the decoder's options in one place | A decoder set up in each test repeats the options, and lets one test decode differently             |
| `#duration` in the schema                                 | One duration pattern, shared by every duration field, as the data model says                                            | A pattern copied into each field is how today's schema rejects `1.5s` in some fields and not others |

## Test map

The tests are Go tests of `internal/config`, run with `go test ./internal/config/`. `TestLoad` reads
real YAML files from `testdata/` and the same values from environment variables; the decoding tests
call `decodeConfig` on a `*Config`; the schema tests compile `config/flipt.schema.cue` with a fresh
`cuecontext.New()` and validate CUE values with `cue.Concrete(true)`. Nothing depends on the clock
or the network.

| Spec                                                                          | Task | Test                                                                                                      |
| ----------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| US1 key 1, SC-001: the schema compiles and exposes `#FliptSpec`               | 5    | `schema_test.go`, `TestCUESchema`, the compile check                                                      |
| US1 key 2: decoded keys, `cache.ttl` a `time.Duration`                        | 2    | `config_test.go`, `TestDefaultConfigDecode`                                                               |
| US1 key 3, SC-002: the decoded defaults validate, durations as strings        | 5    | `schema_test.go`, `TestCUESchemaDefaultConfig`                                                            |
| US1 more 1: an empty file loads `DefaultConfig()`, YAML and ENV               | 1    | `TestLoad`, `defaults`, both subtests                                                                     |
| US1 more 2: no `null`, no empty `db.protocol`, no `Version`                   | 2    | `TestDefaultConfigDecode`                                                                                 |
| US2 key 1: `type: database`, nil pointers, map holds only `type`              | 3    | `TestLoad`, `database config provided`; `TestStorageConfigDecode`                                         |
| US2 key 2: `type: git`, `ref` `main`, 30 s, `Local` nil                       | 3    | `TestLoad`, `git config provided`                                                                         |
| US2 key 3: `local:` under `type: database` is dropped                         | 3    | `TestLoad`, `database config with leftover local`                                                         |
| US2 more 1: `type: local`, `Path` `.`, `Git` nil                              | 3    | `TestLoad`, `local config provided`                                                                       |
| US2 more 2: git basic authentication from environment variables               | 4    | `TestLoad`, `advanced (ENV)`                                                                              |
| US3 key 1, 2: the two `db` forms, and a mix rejected                          | 5    | `TestCUESchema`, the `db` cases                                                                           |
| US3 key 3: git storage with basic auth; both authentications rejected         | 5    | `TestCUESchema`, the `storage` cases                                                                      |
| US3 more 1: CORS as a list or a string                                        | 5    | `TestCUESchema`, the `cors` cases                                                                         |
| US3 more 2: `1.5s`, `0s`, an integer pass; `-1m0s` fails                      | 5    | `TestCUESchema`, the duration cases                                                                       |
| US3 more 3, 4: `storage: {}`, local storage                                   | 5    | `TestCUESchema`, the `storage` cases                                                                      |
| US3 more 5: the Kubernetes method                                             | 5    | `TestCUESchema`, the `kubernetes` case                                                                    |
| US4 key 1, 2, 3: the extended `advanced.yml`                                  | 4    | `TestLoad`, `advanced`, both subtests                                                                     |
| Edge: environment variables keep their names under `omitempty`                | 2    | `Test_mustBindEnv`, `omitempty tags`; `TestLoad` `(ENV)` subtests                                         |
| Edge: git or local storage with every setting loads the same values           | 3, 4 | `TestLoad`, `git config provided`, `local config provided`, `advanced`                                    |
| Edge: experiment off, `storage.type` empty, read as `database`                | 1, 5 | `TestLoad` `defaults`; `TestCUESchemaDefaultConfig`                                                       |
| Edge: `local:` under `type: git`, `FLIPT_STORAGE_LOCAL_PATH` under `database` | 3    | `TestLoad`, `git config with leftover local`, and the leftover cases' `(ENV)` subtests                    |
| Edge: the HTTP config endpoint has no `local` or `git`                        | 3    | `TestServeHTTP`                                                                                           |
| Edge: disabled methods' `cleanup` omitted, accepted                           | 2, 5 | `TestDefaultConfigDecode`; `TestCUESchemaDefaultConfig`                                                   |
| Edge: token method without bootstrap expiration accepted                      | 5    | `TestCUESchemaDefaultConfig`                                                                              |
| Edge: host-based `db` without `port` or `user` accepted                       | 5    | `TestCUESchema`, the `db` host case                                                                       |
| Edge: a negative duration rejected                                            | 5    | `TestCUESchema`, the duration cases                                                                       |
| Edge: `advanced.yml` against the schema                                       | none | Not tested, by the spec's choice (Q4)                                                                     |
| SC-003: every existing test passes                                            | all  | `go test ./...` in each task's validation                                                                 |
| SC-004: build and vet                                                         | all  | `go build ./...` and `go vet ./...` in each task's validation                                             |
| Review focus: a squashed field keeps its environment variables                | 2    | `Test_mustBindEnv`, `omitempty tags`; `TestLoad`, `authentication kubernetes defaults when enabled (ENV)` |
| Review focus: a selected backend with a nil pointer                           | 3    | `TestStorageConfigValidateNilBackend`                                                                     |
| Review focus: a configured version                                            | 2    | `TestDefaultConfigDecode`, the version case                                                               |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Task 1: every later test builds on `DefaultConfig()`.
2. Task 2: the tags it changes include the storage fields task 3 retypes, and its `decodeConfig`
   helper is used by tasks 3 and 5.
3. Task 3: the storage pointers, which tasks 4 and 5 expect.
4. Tasks 4 and 5: task 4 changes `testdata/advanced.yml` and the `advanced` case of `TestLoad`; task
   5 changes `config/flipt.schema.cue`, adds `schema_test.go`, and adds to `specs/INBOX.md`. No file
   in common.

---

## Task 1: `DefaultConfig()` and `DecodeHooks`

**Files:**

- Modify: `internal/config/config.go` (`decodeHooks`, `Load`, a new `DefaultConfig`)
- Test: `internal/config/config_test.go` (`defaultConfig` removed, its callers)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `func DefaultConfig() *Config`: a new value on each call, equal to what `Load` gives for
    [`testdata/default.yml`](/internal/config/testdata/default.yml), with no environment variable.
  - `var DecodeHooks = []mapstructure.DecodeHookFunc{...}`: the same hooks, in the same order, as
    `decodeHooks` today. `Load` appends `experimentalFieldSkipHookFunc` to a copy, never to
    `DecodeHooks` itself.

- [x] **Step 1: Point the tests at `DefaultConfig()`**

In `config_test.go`, replace every call of `defaultConfig` by `DefaultConfig`, including the
`expected: defaultConfig` entries and `TestServeHTTP`. Delete `defaultConfig()` and the
`jaeger-client-go` import.

The break each test catches:

- `TestLoad`, `defaults` (YAML and ENV): a default in `DefaultConfig()` that differs from its
  `setDefaults`, such as the Jaeger port typed `6832`.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config/`
- Expected: FAIL to build, `undefined: DefaultConfig`.

- [x] **Step 3: Implement**

Move the deleted helper's literal into `config.go` as `DefaultConfig()`, with a doc comment, and the
tracing values as the literals `"localhost"` and `6831`. Rename `decodeHooks` to `DecodeHooks`, with
a doc comment saying `Load` uses it. In `Load`, build the hook list without appending to
`DecodeHooks`' backing array: `append(DecodeHooks[:len(DecodeHooks):len(DecodeHooks)], ...)` or a
copy.

- [x] **Step 4: Run the project's validation**

- Run:
  `gofmt -l internal/config && go build ./... && go vet ./internal/... && go test ./internal/config/`
- Expected: no file listed, and PASS.

- [x] **Step 5: Commit**

```bash
git add internal/config/config.go internal/config/config_test.go specs/2026-10-19-flipt-cue-schema/plan.md
git commit -m "feat(flipt-cue-schema): export DefaultConfig and DecodeHooks"
```

## Task 2: Key names come from the mapstructure tags

**Risky:** `fieldKey` is shared by every environment variable of the configuration; a wrong key
silently ignores a variable.

**Files:**

- Modify: `internal/config/config.go` (`Config.Version` tag, `fieldKey`)
- Modify: every mapstructure tag in `internal/config/*.go` but the `,squash` one
- Test: `internal/config/config_test.go` (`Test_mustBindEnv`, a new `TestDefaultConfigDecode`, a new
  helper `decodeConfig`)

**Interfaces:**

- Consumes: `DefaultConfig()` and `DecodeHooks`, from task 1.
- Produces:
  - `func decodeConfig(t *testing.T, cfg *Config) map[string]any`, in `config_test.go`: decodes
    `cfg` into a new map with `mapstructure.NewDecoder` and
    `DecodeHook: mapstructure.ComposeDecodeHookFunc(DecodeHooks...)`, failing the test on error.
  - Every struct field of the configuration decodes to its tag's name, and an empty value is left
    out of the decoded map.

- [x] **Step 1: Write the failing tests, and the helper they use**

```go
// internal/config/config_test.go
func TestDefaultConfigDecode(t *testing.T) {
	m := decodeConfig(t, DefaultConfig())

	// the sections the schema validates
	// assert.ElementsMatch on the map's keys: log, ui, cors, cache, server, tracing, db,
	// meta, authentication, audit, experimental, storage
	// cache.ttl is the time.Duration 1 minute
	// no value anywhere in the map is nil (walk it); db has no "protocol" key; no "Version" key
	// and no "version" key

	cfg := DefaultConfig()
	cfg.Version = "1.0"
	// decodeConfig(t, cfg)["version"] == "1.0"
}
```

And a `Test_mustBindEnv` case, `omitempty tags`: a struct with `A string mapstructure:"a,omitempty"`
and a nested struct `B` tagged `mapstructure:"b_c,omitempty"` holding
`D int mapstructure:"d,omitempty"`, and an embedded-style field tagged `mapstructure:",squash"`
holding `E string mapstructure:"e"`, bound as `a`, `b_c.d`, `e`.

The break each test catches:

- The section keys: a top-level tag left with a typo, or `omitempty` on a struct expected to drop
  it.
- No `nil`: the disabled methods' `cleanup` pointer decoded without `omitempty`.
- No `protocol`: `omitempty` missed on `DatabaseConfig.Protocol`.
- The version: `Version` left untagged, giving the key `Version`.
- `omitempty tags`: `fieldKey` unchanged, giving `bc.d` and `a` from the field names; or the fix
  returning `squash`'s empty name wrongly, giving `e` under a bogus prefix.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config/ -run 'TestDefaultConfigDecode|Test_mustBindEnv'`
- Expected: FAIL: `TestDefaultConfigDecode` finds `Version` and a nil `cleanup`;
  `Test_mustBindEnv/omitempty_tags` gets `bc.d`.

- [x] **Step 3: Implement**

Tag `Config.Version` with `mapstructure:"version,omitempty"`. Add `,omitempty` to every other
mapstructure tag in the package except `AuthenticationMethod.Method`'s `,squash`. Change `fieldKey`
so a tag's name, the part before the first comma, is returned whenever the tag is present: an empty
name for `,squash`, as today; the lowercased field name only without a tag. Update its doc comment.

- [x] **Step 4: Run the project's validation**

- Run:
  `gofmt -l internal/config && go build ./... && go vet ./internal/... && go test ./internal/config/`
- Expected: no file listed, and PASS, every `(ENV)` subtest of `TestLoad` included.

- [x] **Step 5: Commit**

```bash
git add internal/config specs/2026-10-19-flipt-cue-schema/plan.md
git commit -m "feat(flipt-cue-schema): name configuration keys from their mapstructure tags"
```

## Task 3: Storage settings exist only for the selected backend

**Risky:** it changes the shape of `StorageConfig`, read by the gRPC server, and the output of the
HTTP config endpoint.

**Files:**

- Modify: `internal/config/storage.go` (`StorageConfig`, `validate`)
- Create: `internal/config/testdata/storage/database_provided.yml`,
  `internal/config/testdata/storage/database_leftover_local.yml`,
  `internal/config/testdata/storage/git_leftover_local.yml`
- Test: `internal/config/config_test.go` (`TestLoad` storage cases, `TestServeHTTP`, new
  `TestStorageConfigDecode` and `TestStorageConfigValidateNilBackend`)

**Interfaces:**

- Consumes: `DefaultConfig()` from task 1; `decodeConfig` and the `omitempty` tags from task 2.
- Produces: `StorageConfig.Local *Local` and `StorageConfig.Git *Git`, tags unchanged. After `Load`,
  the pointer of each type not selected is nil.

- [x] **Step 1: Write the failing tests**

Each new testdata file turns `experimental.filesystem_storage.enabled` on, like the existing storage
files:

- `database_provided.yml`: `storage: {type: database}`.
- `database_leftover_local.yml`: `storage: {type: database, local: {path: /tmp/flags}}`.
- `git_leftover_local.yml`: `type: git`, `git.repository: "git@github.com:foo/bar.git"`, and
  `local: {path: /tmp/flags}`.

In `TestLoad`: change `local config provided` to expect `Local: &Local{Path: "."}`, and
`git config provided` to expect `Git: &Git{...}`, the same values. Add `database config provided`
and `database config with leftover local`, both expecting `StorageConfig{Type: DatabaseStorageType}`
with the experiment on; and `git config with leftover local`, expecting the `git config provided`
storage.

```go
func TestStorageConfigDecode(t *testing.T) {
	res, err := Load("./testdata/storage/database_provided.yml")
	require.NoError(t, err)

	m := decodeConfig(t, res.Config)
	assert.Equal(t, map[string]any{"type": DatabaseStorageType}, m["storage"])
}

func TestStorageConfigValidateNilBackend(t *testing.T) {
	// (&StorageConfig{Type: GitStorageType}).validate() is "git ref must be specified"
	// (&StorageConfig{Type: LocalStorageType}).validate() is "local path must be specified"
}
```

`TestServeHTTP`: set `cfg.Storage.Type = DatabaseStorageType`, decode the body as JSON, and assert
that `storage` is `{"type": "database"}`, with no `local` or `git` key.

The break each test catches:

- The leftover cases: no clearing after decoding, so `Local` is `&Local{Path: "/tmp/flags"}`; from
  environment variables, `FLIPT_STORAGE_LOCAL_PATH` does the same.
- `TestStorageConfigDecode` and `TestServeHTTP`: `Local` and `Git` left as values, emitting `local`
  and `git`.
- `TestStorageConfigValidateNilBackend`: `validate` reading `c.Git.Ref` without a nil check panics.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config/`
- Expected: FAIL to build: `cannot use &Local{…} (value of type *Local) as Local value`.

- [x] **Step 3: Implement**

Make `Local` and `Git` pointers. At the start of `StorageConfig.validate`, set to nil the pointer of
every type that is not `c.Type`; a comment says why: a backend's settings exist only when it is
selected. Then validate the selected type's pointer, a nil pointer failing with the error its empty
values give today. `internal/cmd/grpc.go` builds unchanged; check it, do not edit it.

- [x] **Step 4: Run the project's validation**

- Run:
  `gofmt -l internal/config && go build ./... && go vet ./... && go test ./internal/... ./cmd/...`
- Expected: no file listed, and PASS.

- [x] **Step 5: Commit**

```bash
git add internal/config specs/2026-10-19-flipt-cue-schema/plan.md
git commit -m "feat(flipt-cue-schema): keep storage settings only for the selected backend"
```

## Task 4: The fully populated example covers audit, tracing, and storage

**Files:**

- Modify: `internal/config/testdata/advanced.yml`
- Test: `internal/config/config_test.go` (the `advanced` case of `TestLoad`)

**Interfaces:**

- Consumes: `StorageConfig.Git *Git`, from task 3.
- Produces: nothing new.

- [x] **Step 1: Write the failing test**

Change the `advanced` case's expectations to the proposal's values, the others untouched:

- `cfg.Audit`: `Sinks.LogFile` `{Enabled: true, File: "/path/to/logs.txt"}`, `Buffer`
  `{Capacity: 10, FlushPeriod: 3 * time.Minute}`.
- `cfg.Tracing`: `Enabled: true`, `Exporter: TracingOTLP`, the default Jaeger and Zipkin values,
  `OTLP.Endpoint` `"localhost:4318"`.
- `cfg.Storage`: `Type: GitStorageType`,
  `Git: &Git{Repository: "https://github.com/flipt-io/flipt.git", Ref: "production", PollInterval: 5 * time.Second, Authentication: Authentication{BasicAuth: &BasicAuth{Username: "user", Password: "pass"}}}`.

The break each test catches:

- `advanced (YAML)` and `(ENV)`: a value of the file mistyped, or the git authentication not
  reaching the nested pointer from `FLIPT_STORAGE_GIT_AUTHENTICATION_BASIC_USERNAME`.

- [x] **Step 2: Run it to check it fails**

- Run: `go test ./internal/config/ -run 'TestLoad/advanced'`
- Expected: FAIL: the loaded `Audit`, `Tracing`, and `Storage` differ.

- [x] **Step 3: Implement**

In `advanced.yml`, replace the tracing section's `backend: jaeger` by `exporter: otlp` and
`otlp: {endpoint: "localhost:4318"}`. Add an `audit` section and a `storage` section with the values
above. Leave the other sections as they are.

- [x] **Step 4: Run the project's validation**

- Run: `gofmt -l internal/config && go vet ./internal/config/ && go test ./internal/config/`
- Expected: no file listed, and PASS.

- [x] **Step 5: Commit**

```bash
git add internal/config specs/2026-10-19-flipt-cue-schema/plan.md
git commit -m "test(flipt-cue-schema): cover audit, tracing, and storage in advanced.yml"
```

## Task 5: The CUE schema accepts the default configuration

**Files:**

- Modify: `config/flipt.schema.cue`
- Create: `internal/config/schema_test.go`
- Modify: `specs/INBOX.md` (two notes)

**Interfaces:**

- Consumes: `DefaultConfig()` and `DecodeHooks` from task 1, `decodeConfig` and the tags from task
  2, the storage pointers from task 3.
- Produces: `#FliptSpec` in `config/flipt.schema.cue`, with the shape of the
  [data model](data-model.md#the-schemas-fliptspec).

- [x] **Step 1: Write the failing tests**

In `schema_test.go`, a helper compiles `../../config/flipt.schema.cue` with `cuecontext.New()`,
requires no error, and returns `LookupPath(cue.ParsePath("#FliptSpec"))`, required to exist. A
second helper validates a value against it:
`spec.Unify(ctx.Encode(v)).Validate(cue.Concrete(true))`, or a CUE or JSON snippet compiled with
`ctx.CompileString`.

```go
func TestCUESchemaDefaultConfig(t *testing.T) {
	m := decodeConfig(t, DefaultConfig())
	// a walk replaces each time.Duration in the map, nested maps included, by its String()
	// assert the strings: cache.ttl "1m0s", cache.memory.eviction_interval "5m0s",
	// authentication.session.token_lifetime "24h0m0s", state_lifetime "10m0s",
	// audit.buffer.flush_period "2m0s"
	// require no error validating m against #FliptSpec
}

func TestCUESchema(t *testing.T) {
	// a table of {name, snippet, valid}, each snippet a whole configuration:
	// db: url with max_idle_conn 10 (valid); protocol postgres, host localhost, name flipt (valid);
	//     url and host (invalid)
	// storage: {} (valid); local with path /tmp/flags (valid); git with ref, poll_interval 5s,
	//     basic auth (valid); git with basic and token auth (invalid); database with local (invalid)
	// cors.allowed_origins ["foo.com"] (valid), "foo.com bar.com" (valid)
	// cache.ttl "1.5s", "0s", 60000000000 (valid); "-1m0s" (invalid)
	// authentication.methods.kubernetes with discovery_url, ca_path, service_account_token_path (valid)
}
```

The break each test catches:

- The compile check: `boolean` left in the schema.
- `TestCUESchemaDefaultConfig`: any section or field of the data model missing, such as `storage` or
  `session.csrf`; `bootstrap.expiration` left required; `conn_max_lifetime` left `int` only.
- The `db` and `storage` invalid cases: the forms written as open structs, accepting a mix.
- The duration cases: the old pattern, rejecting `1.5s`; a pattern allowing a sign.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config/ -run 'TestCUESchema'`
- Expected: FAIL: the schema does not compile, on `boolean`.

- [x] **Step 3: Implement**

Rewrite the schema to the [data model](data-model.md#the-schemas-fliptspec): `bool` for
`prepared_statements_enabled`; a `#duration` definition, the pattern or an integer, used by every
duration field; `experimental`, `storage`, the Kubernetes method, the session lifetimes and
`csrf.key`, and OIDC `scopes`; `bootstrap.expiration` optional; `db` as the URL form, the default,
or the host form, each closed; `cors.allowed_origins` as a list of strings or a string; `storage` as
a choice on `type`, `database` the default. Keep the existing defaults and comments where the data
model does not change them.

Add the two notes the spec names to `specs/INBOX.md`, under a `## Configuration` category, each
marked `[agent] [flipt-cue-schema]`: porting these schema changes to `config/flipt.schema.json`, and
OIDC providers reaching CUE with their JSON names, such as `clientID`, so a fully populated
configuration fails the schema.

- [x] **Step 4: Run the project's validation**

- Run: `gofmt -l internal/config && go build ./... && go vet ./... && go test ./...`
- Expected: no file listed, and PASS.

- [x] **Step 5: Commit**

```bash
git add config/flipt.schema.cue internal/config/schema_test.go specs/INBOX.md specs/2026-10-19-flipt-cue-schema/plan.md
git commit -m "feat(flipt-cue-schema): validate the default configuration against the CUE schema"
```
