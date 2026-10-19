# Discovery, round 01: Default configuration validates against the CUE schema

## Summary

The proposal asks that the default Flipt configuration, decoded into a map, validates against a CUE
definition `#FliptSpec` with every value concrete. Validating a Go config against a CUE schema has
three parts: a map that mirrors the schema's field names, values in the schema's forms (durations as
strings, enums as strings), and a schema that knows every section. Today none of the three holds.
The experiment below (a copy of the repository in `/tmp`, never committed) found 8 kinds of failure.
The fixes are inside `internal/config` and `config/flipt.schema.cue`. Nothing outside reads
`Storage.Local` or `Storage.Git` except one function, which compiles unchanged with pointers.

## How other products do it

### CUE (the schema language)

- [Closed structs](https://cuelang.org/docs/tour/types/closed/): structs are open unless closed, and
  a closed struct rejects fields it does not list. The page says definitions yield closed structs.
  It defers the exact rule to its next page, which I did not read. The experiment confirms it:
  `#FliptSpec.storage: field not allowed`.

### What they have in common

Schemas for configuration written as closed definitions list every key, mark optional keys with `?`,
and give defaults with `*`. Judgement: this is the pattern `config/flipt.schema.cue` already
follows.

## Standards and libraries

### mapstructure v1.5.0

- [Package docs](https://pkg.go.dev/github.com/mitchellh/mapstructure@v1.5.0): `,omitempty` leaves
  out a field equal to its type's zero value when decoding a struct into a map.
- Experiment (`/tmp/exp`, `TestExp2`): with `omitempty`, a zero string, int, bool, or duration is
  left out, and so is a nil pointer. A zero struct, or a non-nil pointer to a zero struct, still
  appears as an empty map `{}`.
- The same docs describe `StringToTimeDurationHookFunc` as converting strings to `time.Duration`.

### CUE Go API, cuelang.org/go v0.5.0

- Already a dependency in [go.mod](/go.mod), and cached locally. `ctx.CompileBytes`,
  `LookupPath("#FliptSpec")`, `Unify` and `Validate(cue.Concrete(true))` ran in the experiment. The
  result lists each error by path.

## The code

### Important reads

- [`internal/config/config.go`](/internal/config/config.go): the lowercase `decodeHooks` slice is
  used once, in `Load`. The requirement asks for it exported as `DecodeHooks`. `fieldKey` cuts the
  `mapstructure` tag at the comma and returns the lowercase Go field name unless the option is
  `squash`. A tag like `name,omitempty` would therefore bind the wrong environment key. No tag has
  `omitempty` today, so this is a latent bug that the requirement on `omitempty` will trigger.
  `Config.Version` has no `mapstructure` tag, so it decodes as `Version`, not `version`.
- [`internal/config/config_test.go`](/internal/config/config_test.go) line 203: `defaultConfig()` is
  the canonical default, today a test helper. The requirement moves it to `DefaultConfig()` in
  `config.go`. Every `TestLoad` case builds on it.
- [`internal/config/storage.go`](/internal/config/storage.go): `Local` and `Git` are values.
  `validate()` reads `c.Git.Ref` and `c.Local.Path` without a nil check.
- [`internal/cmd/grpc.go`](/internal/cmd/grpc.go) lines 139-170: reads `cfg.Storage.Git.*` and
  `cfg.Storage.Local.Path` only inside the matching storage-type case. It also treats an empty
  storage type as database (`case "", config.DatabaseStorageType`).
- [`config/flipt.schema.cue`](/config/flipt.schema.cue): package `flipt`, definition `#FliptSpec`
  already exists at top level. It lacks `storage` and `experimental`, the kubernetes method, session
  `csrf`, `token_lifetime` and `state_lifetime`. `prepared_statements_enabled` uses `boolean`, which
  CUE rejects: `reference "boolean" not found`. Nothing in Go code reads this file; only the JSON
  twin is compiled by `TestJSONSchema`.
- [`config/flipt.schema.json`](/config/flipt.schema.json): the JSON schema twin. It has no `storage`
  section either. The proposal names only CUE.
- [`internal/cue`](/internal/cue/validate.go): validates feature-flag files against another schema,
  `flipt.cue`. Unrelated.
- [`internal/config/testdata/advanced.yml`](/internal/config/testdata/advanced.yml): sets
  `tracing.backend: jaeger`, a key the struct does not have (`exporter` is the real one). It has no
  `audit` or `storage`. Its experimental flag is already enabled, which is what lets `storage` load.
- Recent commits on these files (`git log`): the git backend and its poll interval, experimental
  flags, prepared statements. None touched the schema's shape since the audit keys.

### The proposal's path and existing actions

Experiment: `Load("default.yml")`, decode the `*Config` to a map, turn durations into strings,
validate. Failures, in order of kind:

1. `Version`: key not allowed (missing tag).
2. `audit.buffer.flush_period`: a duration as an integer of nanoseconds. As a string it passes the
   schema.
3. `authentication.methods.kubernetes`: not in schema.
4. `authentication.methods.{oidc,token}.cleanup`: a nil pointer emitted as `null`.
5. `authentication.session.{csrf,state_lifetime,token_lifetime}`: not in schema.
6. `db.protocol`: the zero enum value stringifies to `""`, which the schema rejects.
7. `experimental` and `storage`: not in schema.
8. `prepared_statements_enabled`: the `boolean` typo, which stops validation before anything else.

Other existing behaviours that meet the feature:

- With the experimental flag off, `experimentalFieldSkipHookFunc` replaces `Storage` by an empty
  struct, so a loaded default has `storage.type` empty, and `local`/`git` as empty objects. The
  existing `TestLoad` default case expects this. The runtime treats empty as database.
- `server.protocol` and `cache.backend` are enums; they validate once stringified.
- `cors.allowed_origins` is `[]string` in Go and accepted from a space-separated string in YAML. The
  schema takes a list only.
- Environment variables bind through `fieldKey` and `bindEnvVars`; a pointer field is already
  followed (`typ.Elem()`), so `Local` and `Git` as pointers keep their variables.

### Rules and their owners

- Database validity (URL, or protocol, host, name): owned by `DatabaseConfig.validate` in
  [`database.go`](/internal/config/database.go). Copied, in looser form, in the schema's `#db`.
- Audit limits (capacity 2 to 10, flush period 2m to 5m): owned by `AuditConfig.validate`. The
  schema does not copy them.
- Git storage auth (both basic fields or neither; token priority over basic): owned by
  `Authentication.validate` in `storage.go`.
- Duration forms: owned by `time.ParseDuration`. The schema copies them as the regex
  `^([0-9]+(ns|us|µs|ms|s|m|h))+$`. `Duration.String()` can print decimals, such as `1.5s`, which
  that regex rejects (judgement from the Go format; not run).

### Likely changes

- [`internal/config/config.go`](/internal/config/config.go): export `DecodeHooks`; add
  `DefaultConfig()`; add the `version` tag; make `fieldKey` honour `omitempty`.
- [`internal/config/storage.go`](/internal/config/storage.go): `*Local`, `*Git`; nil-safe
  `validate`.
- `internal/config/*.go`: `omitempty` on tags so empties leave the decoded map.
- [`config/flipt.schema.cue`](/config/flipt.schema.cue): the additions and fixes above.
- [`internal/config/config_test.go`](/internal/config/config_test.go): drop the helper, use
  `DefaultConfig()`, pointer literals, a new schema test, extended advanced expectations.
- [`internal/config/testdata/advanced.yml`](/internal/config/testdata/advanced.yml): `audit`,
  `tracing.exporter: otlp`, git `storage`.
- Construction sites of the two fields outside `internal/config`: none found
  (`grep "StorageConfig{\|config.Local{\|config.Git{"` over all Go files). The module's other
  workspaces were part of that search.

## The proposal

### Duplicated requirements

Three requirements are stated twice (`DefaultConfig()`, the `advanced.yml` values, concrete
validation). They agree, so each is kept once.

### Which fields the non-URL database form requires

"A protocol, host, port, name, and user based configuration" does not say whether all five are
required. The Go validation requires protocol, host and name only. See
[database forms](#database-forms).

### Whether the alternatives exclude each other

"Either" appears for the two database forms and the two git authentications. Go accepts a mix: the
URL wins silently, and token wins over basic. See [mixing alternatives](#mixing-alternatives).

### "The source this change covers"

The pointer requirement exempts construction sites outside "the source this change covers" from
building. None exist outside the config package (above), so nothing is exempted in practice.

### Fixed field name for empty storage type

The default has an empty storage type. See [storage type default](#storage-type-default).

## Worth it and feasibility

Small and cheap: the experiment shows the whole gap, and each fix is local. The gain is a test that
fails when the defaults and the schema drift. Outside behaviour relied on, all checked by
experiment: mapstructure `omitempty` semantics, CUE closedness, and concrete validation with v0.5.0.
Not verified: that `#db` as a two-branch disjunction still gives readable errors on failure. No
security guard is relaxed: the schema is not used at runtime.

## Approaches

Criteria: the proposal's requirements, the constitution (requirements kept as written, no extra
feature), and no active decisions (none exist).

### Database forms

Link: [the code](#rules-and-their-owners).

| Option                                                   | Matches Go validation          | Matches the proposal's words |
| -------------------------------------------------------- | ------------------------------ | ---------------------------- |
| A. protocol, host, name required; port and user optional | yes                            | partly                       |
| B. all five required                                     | no: rejects configs Go accepts | literally                    |

### Mixing alternatives

| Option                                               | Matches Go runtime | Catches silent mistakes |
| ---------------------------------------------------- | ------------------ | ----------------------- |
| A. reject url with host fields, and basic with token | no                 | yes                     |
| B. accept both mixes                                 | yes                | no                      |
| C. reject only the database mix                      | partly             | partly                  |

### Storage type default

| Option                                                         | Matches loading path           | Schema work      |
| -------------------------------------------------------------- | ------------------------------ | ---------------- |
| A. `DefaultConfig()` keeps an empty type, omitted from the map | yes                            | type is optional |
| B. `DefaultConfig()` sets `database`                           | no: changes the loaded default | none             |

### Code-quality limits

Only because the project has no `specs/decisions/code-quality.md`. It has `.golangci.yml` (bugs and
unused presets, no size limits).

### Needs no choice

- Durations as strings: the schema's regex already takes them; only decimals need widening.
- `cors.allowed_origins` as list or string: stated by the proposal.
- Accessibility, locale, scale, removal: not applicable to a validation schema.

## Not checked

- CUE's page on definitions (the next page of the tour): not read, closedness shown by experiment.
- Other products' schema validation (Kubernetes, Prometheus): not researched; the feature is an
  internal test of one schema.
