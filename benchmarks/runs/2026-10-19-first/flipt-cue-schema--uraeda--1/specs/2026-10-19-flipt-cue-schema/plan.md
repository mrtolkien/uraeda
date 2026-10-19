---
status: auto-approved
spec-revision: 1
---

# Plan: Default configuration validates against the CUE schema

**Goal:** A test decodes `DefaultConfig()` and validates it against `#FliptSpec` with concrete
values, and the schema and config package are fixed until it passes.

**Architecture:** Three tasks, built in sequence. The schema comes first, because it is the contract
and holds the one unverified behaviour. The config package then makes the decoded map mirror the
schema. The example file and its load case come last. The owners are those of the
[spec's architecture](spec.md#architecture): `DefaultConfig()` owns the defaults, `DecodeHooks` the
conversions, `fieldKey` the tag-to-name rule, `StorageConfig` the "nil unless selected" rule, the
struct tags what the decoded map leaves out, `#FliptSpec` the contract, and the schema test the
string adaptation.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A `StorageConfig` of type `git` or `local` built by hand with a nil pointer** returns the "must
   be specified" error, never a panic. Task 2.
2. **An environment variable for a field whose tag has `omitempty`**, such as
   `FLIPT_AUDIT_BUFFER_FLUSH_PERIOD`, binds under the name before the comma. Task 2.
3. **`FLIPT_STORAGE_GIT_REF` with `storage.type: git`** still fills the now-pointer `Git`. Task 2.
4. **The shared `DecodeHooks` slice is never grown by `Load`**: two loads in a row give the same
   result. Task 2.
5. **A schema branch error on a database with a missing name** names the database, not just "empty
   disjunction". Task 1, as far as readable.

## Global constraints

- The project sets no size limits: "A feature MUST NOT add function, file, or nesting limits to the
  linters, nor mark existing code as an offender, unless a human asks for it."
  ([code-quality](../decisions/code-quality.md)). `.golangci.yml` is not touched.
- The JSON schema [`config/flipt.schema.json`](/config/flipt.schema.json) stays unchanged.
- Add no exported function beyond `DefaultConfig`, and no new dependency: `cuelang.org/go` is in
  [go.mod](/go.mod).
- `DefaultConfig()` takes no arguments and returns `*Config`. `DecodeHooks` is an exported
  `[]mapstructure.DecodeHookFunc`. `StorageConfig.Local` is `*Local`, `StorageConfig.Git` is `*Git`.
- `Git.Authentication` stays a value. Audit limits stay in Go. Required fields (git `repository` and
  `ref`) keep plain tags; optional fields of the configuration structs get `omitempty`.
- `Load("./testdata/default.yml")` equals `DefaultConfig()`. The runtime treats an empty storage
  type as database ([`grpc.go`](/internal/cmd/grpc.go)).
- Every duration field in the schema takes the duration pattern, with decimals, or an integer.
- Run `go build ./...` and `go test ./internal/config/...` before every commit.

## Code read

- [`internal/config/config.go`](/internal/config/config.go): lowercase `decodeHooks` used once in
  `Load`; `fieldKey` cuts the tag at the comma and returns the name only when there is no option or
  it is `squash`; `Config.Version` has no tag.
- [`internal/config/storage.go`](/internal/config/storage.go): `Local` and `Git` values; `validate`
  reads them without a nil check.
- [`internal/cmd/grpc.go`](/internal/cmd/grpc.go) lines 139-170: reads `Storage.Git.*` and
  `Storage.Local.Path` only inside the matching case, so pointers compile unchanged.
- [`internal/config/config_test.go`](/internal/config/config_test.go): `defaultConfig()` helper at
  line 203, used by every `TestLoad` case and `TestServeHTTP`; `TestLoad` runs each case from YAML
  and from environment variables.
- The other config files (`audit.go`, `authentication.go`, `cache.go`, `database.go`, `log.go`,
  `meta.go`, `server.go`, `tracing.go`, `ui.go`, `experimental.go`): the tags that get `omitempty`.
  `AuthenticationMethod.Method` is `mapstructure:",squash"`.
- [`config/flipt.schema.cue`](/config/flipt.schema.cue): `#FliptSpec` exists; it lacks `storage`,
  `experimental`, Kubernetes, session lifetimes and csrf, and has the `boolean` typo.
- Validation commands: `go build ./...`, `go test ./internal/config/...`, `go vet ./...`.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

| Abstraction or exception                                              | Why it is needed                                                          | Simpler alternative rejected because                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Test helper `validateAgainstSchema(t, map[string]any) error` (Task 1) | Used by the default test and the hand-built US3 cases of Task 1           | Inlining the CUE calls in each test repeats six lines per test |
| Test helper `stringifyForSchema(any) any` (Task 2)                    | Turns durations and enums into strings, as the spec places it in the test | A production exported function is ruled out by the spec        |

## Test map

The tests are Go tests in `internal/config`, with no fake: they call the real CUE library, the real
`Load` on the files in `testdata`, and the real mapstructure decode.

| Spec                                                        | Task | Test                                                            |
| ----------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| US1 1: `flush_period` stays a `time.Duration`               | 2    | `TestDefaultConfigDecodesDurations`                             |
| US1 2, SC-001: default validates                            | 2    | `TestDefaultConfigValidatesAgainstSchema`                       |
| US1 3, SC-002: `Load(default.yml)` equals `DefaultConfig()` | 2    | `TestLoad` "default" case                                       |
| US1 more 1: `1.5s` accepted                                 | 1    | `TestSchema` "decimal duration"                                 |
| US1 more 2, SC-003: 12 sections, `version` absent           | 2    | `TestDefaultConfigValidatesAgainstSchema` key assertions        |
| US1 more 3: `oidc.cleanup`, `db.protocol` absent            | 2    | `TestDefaultConfigValidatesAgainstSchema` absent-key assertions |
| US2 1: default has nil `Local`, `Git`, no keys              | 2    | `TestDefaultConfigValidatesAgainstSchema`                       |
| US2 2, 3: git defaults, local path default                  | 2    | `TestLoad` "git config provided", "local config provided"       |
| US2 more 1, 2: nil pointer validation                       | 2    | `TestStorageValidateNilPointers`                                |
| US2 more 3: env var `FLIPT_STORAGE_GIT_REF`                 | 2    | `TestLoadStorageGitRefFromEnv`                                  |
| US3 1, 2, 3, more 1, 2, 3, 4, 5: db, auth, cors forms       | 1    | `TestSchema` table                                              |
| US4 1, 2, 3, SC-005: advanced values                        | 3    | `TestLoad` "advanced" case                                      |
| US5 1: `fieldKey` with `omitempty`                          | 2    | `TestFieldKey`                                                  |
| US5 2: `version` key                                        | 2    | `TestDefaultConfigDecodesVersion`                               |
| US5 3: `max_open_conn` 0 absent                             | 2    | `TestDefaultConfigValidatesAgainstSchema` absent-key assertions |
| Edge: experimental off, `Type` empty                        | 2    | `TestLoad` "default" case                                       |
| Edge: integer duration                                      | 1    | `TestSchema` "integer duration"                                 |
| Edge: empty `authentication`                                | 1    | `TestSchema` "git empty authentication"                         |
| SC-004: module builds, config tests pass                    | 2, 3 | `go build ./...`, `go test ./internal/config/...`               |
| Review focus 1                                              | 2    | `TestStorageValidateNilPointers`                                |
| Review focus 2                                              | 2    | `TestFieldKey`                                                  |
| Review focus 3                                              | 2    | `TestLoadStorageGitRefFromEnv`                                  |
| Review focus 4                                              | 2    | `TestLoadDoesNotGrowDecodeHooks`                                |
| Review focus 5                                              | 1    | `TestSchemaDatabaseErrorNamesField`                             |

## Waves

1. Task 1: the schema is the contract every later task validates against, and holds the unverified
   behaviour.
2. Task 2: the config package changes, which consume the finished schema.
3. Task 3: `advanced.yml` and its load case need the pointers of Task 2.

---

## Task 1: Schema `#FliptSpec` learns every section

**Files:**

- Modify: `config/flipt.schema.cue`
- Test: `internal/config/config_test.go` (new `TestSchema`, `TestSchemaDatabaseErrorNamesField`)

**Interfaces:**

- Consumes: nothing.
- Produces: `#FliptSpec` accepting `experimental`, `storage`, the Kubernetes method, session `csrf`,
  `token_lifetime`, `state_lifetime`; the test helper
  `validateAgainstSchema(t *testing.T, cfg map[string]any) error`, which compiles
  `../../config/flipt.schema.cue` with `cuecontext.New()`, looks up `#FliptSpec`, unifies the map
  and returns `Validate(cue.Concrete(true))`.

- [x] **Step 1: Write the failing tests, and the helper they use**

`TestSchema` is a table of maps with `wantErr bool`, one row per scenario of US3 (db with protocol,
host, name accepted without port or user; url plus host rejected; url with `max_idle_conn` accepted;
missing name rejected; `conn_max_lifetime: "30m0s"` with `prepared_statements_enabled: false`
accepted; cors list and string accepted; git basic plus token rejected; token only accepted; empty
`authentication` accepted; `cache.ttl` `"1.5s"` and integer `60` accepted).
`TestSchemaDatabaseErrorNamesField` validates a db with host and no name and asserts the error text
mentions `db`.

The break each test catches:

- url plus host: a schema that treats the two database forms as one open struct.
- basic plus token: an `authentication` that does not exclude the mix.
- `1.5s`: the old pattern without decimals.
- `boolean`: the schema failing to compile at all.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config/ -run 'TestSchema'`
- Expected: FAIL, `reference "boolean" not found`.

- [x] **Step 3: Rewrite `#FliptSpec`**

Apply the [data model](data-model.md#schema-fliptspec): fix `boolean`; one duration pattern
`^([0-9]+(\.[0-9]*)?(ns|us|µs|ms|s|m|h))+$ | int` on every duration field (`conn_max_lifetime`,
`bootstrap.expiration` now optional, audit `flush_period`, session lifetimes, git `poll_interval`
default `"30s"`); `cors.allowed_origins` list of strings or one string; `#db` as shared fields plus
an embedded two-branch alternative (url form with `url?`; fields form with required `protocol`,
`host`, `name`, optional `port`, `user`); `#storage` with optional `type`, `local.path`, and `git`
with required `repository`, optional `ref` default `main`, `poll_interval`, and an `authentication`
of `{basic: {username, password}} | {token: {access_token}} | {}`; `experimental`; the Kubernetes
method (`enabled`, `discovery_url`, `ca_path`, `service_account_token_path`, `cleanup`); session
`csrf.key`, `token_lifetime`, `state_lifetime`. If the db error text does not name the field, keep
the schema and record a ruling: the test only needs the error to exist.

- [x] **Step 4: Run the project's validation**

- Run: `go build ./... && go test ./internal/config/...`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add config/flipt.schema.cue internal/config/config_test.go specs/2026-10-19-flipt-cue-schema
git commit -m "feat(flipt-cue-schema): schema accepts every configuration section"
```

## Task 2: The decoded default configuration mirrors the schema

**Risky:** `StorageConfig.Local` and `Git` change shape, and the `fieldKey` rule is shared by every
environment binding.

**Files:**

- Modify: `internal/config/config.go` (`DecodeHooks`, `DefaultConfig`, `fieldKey`, `Config.Version`
  tag, `Load`), `internal/config/storage.go`, the `mapstructure` tags of `audit.go`,
  `authentication.go`, `cache.go`, `cors.go`, `database.go`, `experimental.go`, `log.go`, `meta.go`,
  `server.go`, `tracing.go`, `ui.go`
- Test: `internal/config/config_test.go`

**Interfaces:**

- Consumes: `validateAgainstSchema` from Task 1.
- Produces: `func DefaultConfig() *Config` (the values of the removed test helper `defaultConfig`,
  moved verbatim); `var DecodeHooks []mapstructure.DecodeHookFunc` (the old list, exported; `Load`
  appends the experimental hook to a copy); `fieldKey` returns the name before a comma for any
  option; `Config.Version` has `mapstructure:"version,omitempty"`;
  `StorageConfig{Type, Local *Local, Git *Git}`, nil unless selected, `omitempty` on both.

- [x] **Step 1: Write the failing tests, and the helpers they use**

Replace `defaultConfig()` by `DefaultConfig()` in the tests, and `Local`/`Git` literals by
`&Local{}` and `&Git{}`. Add `stringifyForSchema(any) any`, which walks the decoded map and turns
`time.Duration` into `.String()` and the enums into their string form with the existing `*ToString`
maps. Add:

- `TestDefaultConfigValidatesAgainstSchema`: decode `DefaultConfig()` into `map[string]any` with
  `mapstructure.ComposeDecodeHookFunc(DecodeHooks...)` and `TagName: "mapstructure"`, adapt,
  validate with `validateAgainstSchema`, require no error; assert the 12 top-level keys exist and
  `version` does not; `authentication.methods.oidc.cleanup`, `db.protocol`, `db.max_open_conn`,
  `storage.local`, `storage.git` are absent.
- `TestDefaultConfigDecodesDurations`: the raw decoded `audit.buffer.flush_period` equals
  `2 * time.Minute` as a `time.Duration`.
- `TestDefaultConfigDecodesVersion`: a `Config{Version: "1.0"}` decodes to key `version`.
- `TestFieldKey`: `flush_period,omitempty` gives `flush_period`; `,squash` gives the empty string;
  an untagged field gives its lowercase name.
- `TestStorageValidateNilPointers`: type `git` with nil `Git` returns "git ref must be specified";
  type `local` with nil `Local` returns "local path must be specified".
- `TestLoadStorageGitRefFromEnv`: with `FLIPT_STORAGE_GIT_REF=production` and the git storage test
  file, `Storage.Git.Ref` is `production`.
- `TestLoadDoesNotGrowDecodeHooks`: `len(DecodeHooks)` is unchanged after two `Load` calls.

The break each test catches:

- Default validates: any section, tag, or `null` the schema rejects.
- Durations: a hook chain that stringifies before the schema adapter.
- `fieldKey`: `omitempty` binding the wrong environment key.
- Nil pointers: a panic in `validate`.
- Hooks: `append(DecodeHooks, ...)` writing into the shared backing array.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config/`
- Expected: FAIL to compile, `undefined: DefaultConfig`.

- [x] **Step 3: Implement the config changes**

Move the default values into `DefaultConfig()` in `config.go`; export `DecodeHooks`; make `Load`
build its hook list from a fresh slice. In `fieldKey`, return the tag's name before the comma
whenever it is not empty, and the lowercase field name when the name before the comma is empty and
the option is not `squash`. Tag `version`. Change the two storage fields to pointers with
`omitempty` and guard `validate` with nil checks that return the same two errors. Add `omitempty` to
the tags of optional fields (all but git `repository` and `ref`), so zero scalars, nil pointers and
the empty enum leave the decoded map; keep `json` tags as they are.

- [x] **Step 4: Run the project's validation**

- Run: `go build ./... && go vet ./internal/config/ && go test ./internal/config/...`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add internal/config specs/2026-10-19-flipt-cue-schema/plan.md
git commit -m "feat(flipt-cue-schema): default configuration validates against the schema"
```

## Task 3: The full example covers audit, OTLP and git storage

**Files:**

- Modify: `internal/config/testdata/advanced.yml`
- Test: `internal/config/config_test.go` (`TestLoad` "advanced" case)

**Interfaces:**

- Consumes: `StorageConfig.Git *Git` from Task 2.
- Produces: `advanced.yml` loading into the values of
  [US4](spec.md#us4-see-the-new-sections-in-the-full-example-p2).

- [x] **Step 1: Write the failing tests**

Extend the "advanced" expectation: `Audit.Sinks.LogFile{Enabled: true, File: "/path/to/logs.txt"}`,
`Audit.Buffer{Capacity: 10, FlushPeriod: 3 * time.Minute}`, `Tracing.Exporter` `TracingOTLP` with
`OTLP.Endpoint` `localhost:4318`, and
`Storage{Type: GitStorageType, Git: &Git{Repository: "https://github.com/flipt-io/flipt.git", Ref: "production", PollInterval: 5 * time.Second, Authentication: Authentication{BasicAuth: &BasicAuth{Username: "user", Password: "pass"}}}}`.

The break the test catches: a yml key mistyped so a section loads as defaults.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./internal/config/ -run 'TestLoad/advanced'`
- Expected: FAIL, the expected `Audit` differs from the default.

- [x] **Step 3: Edit `advanced.yml`**

Add the `audit`, `storage` sections; under `tracing`, replace `backend: jaeger` with
`exporter: otlp` and `otlp.endpoint: localhost:4318`.

- [x] **Step 4: Run the project's validation**

- Run: `go build ./... && go test ./internal/config/...`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add internal/config/testdata/advanced.yml internal/config/config_test.go specs/2026-10-19-flipt-cue-schema/plan.md
git commit -m "feat(flipt-cue-schema): the full example covers audit, OTLP and git storage"
```
