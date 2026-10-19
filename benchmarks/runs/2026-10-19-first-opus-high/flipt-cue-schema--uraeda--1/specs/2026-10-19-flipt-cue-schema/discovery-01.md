# Discovery, round 01: Default configuration validates against the CUE schema

## Summary

Flipt keeps a hand-written CUE schema of its configuration file,
[`config/flipt.schema.cue`](/config/flipt.schema.cue), next to a JSON schema,
[`config/flipt.schema.json`](/config/flipt.schema.json), that editors use. Nothing checks either one
against the Go configuration in [`internal/config`](/internal/config), and both have drifted. The
proposal asks for a public `DefaultConfig()` and an exported `DecodeHooks`. It also asks for a
schema that accepts the decoded default configuration under concrete validation, and for Go types
that do not emit empty values the schema rejects.

Today the CUE schema does not even compile: `prepared_statements_enabled` uses `boolean`, which is
not a CUE type. Once that is fixed, 12 fields of the decoded default configuration fail. A
prototype, made in a throwaway copy of the repository, validates the default configuration with no
errors. It adds `omitempty` to the mapstructure tags, fixes the env-key lookup, turns `Local` and
`Git` into pointers, and extends the schema. The existing test suite still passes on it. See
[the prototype](#prototype).

## How other products do it

This is a consistency fix inside Flipt, not a user-facing capability that other products offer. The
proposal also forbids consulting existing solutions or external pull requests. So no product
comparison was made: the sources below are the dependencies' documentation and the code.

### What they have in common

Not applicable: see above.

## Standards and libraries

### CUE v0.5.0

- A definition such as `#FliptSpec` is closed. A field the definition does not list fails with
  "field not allowed" ([CUE tour, closed structs](https://cuelang.org/docs/tour/types/closed/)).
  This is why `experimental`, `storage`, `Version`, and `authentication.methods.kubernetes` fail
  today.
- A default, marked `*`, is used "when a value is required but none has been explicitly specified"
  ([CUE tour, defaults](https://cuelang.org/docs/tour/types/defaults/)). A disjunction of structs
  with no default stays ambiguous for an empty object: the prototype first got
  `#FliptSpec.storage: incomplete value` for `storage: {}`, and a `*` on the database branch fixed
  it.
- `cue.Context.Encode` turns Go values into CUE through `convert.GoValueToValue`, which honours
  `json.Marshaler` and `encoding.TextMarshaler` (`internal/core/convert/go.go`, lines 293–304, in
  the module cache). Flipt's enums, such as [`LogEncoding`](/internal/config/log.go) and
  [`DatabaseProtocol`](/internal/config/database.go), have `MarshalJSON`, so they reach CUE as their
  strings. `DatabaseProtocol(0)` reaches CUE as `""`. `time.Duration` has no marshaler, so it
  reaches CUE as an integer of nanoseconds unless it is turned into a string first.
- Pitfall, seen in the prototype: a failed disjunction reports "N errors in empty disjunction",
  which is hard to read. The more disjunctions the schema has, the worse its error messages.

### mapstructure v1.5.0

- From [the docs](https://pkg.go.dev/github.com/mitchellh/mapstructure@v1.5.0): the `,omitempty`
  suffix omits a value "if it equates to the zero value" when decoding from a struct.
- In the source (`mapstructure.go`, `decodeMapFromStruct`, line 908 on), the key is the tag's name,
  or the Go field name when the tag is missing. `isEmptyValue` (line 1484) treats strings, slices,
  maps, numbers, booleans, and nil pointers as empty, but never a struct. So `omitempty` drops a nil
  `*Git`, never a `Git` value: this is why the proposal asks for pointers.
- Struct-to-map decoding recurses into struct fields only. A `map[string]SomeStruct` is copied as
  is, and its struct values then reach CUE through their `json` tags.

### Go `time.Duration`

- From [the docs](https://pkg.go.dev/time#Duration.String): `String` gives "the form 72h3m0.5s".
  "Leading zero units are omitted", sub-second values use `ms`, `µs`, or `ns`, and zero is `0s`.
- `ParseDuration` accepts "a possibly signed sequence of decimal numbers, each with optional
  fraction and a unit suffix". Units are `ns`, `us` or `µs`, `ms`, `s`, `m`, `h`.
- The schema's duration pattern today is `^([0-9]+(ns|us|µs|ms|s|m|h))+$`. It accepts `1m0s`,
  `24h0m0s`, and `0s`, but rejects fractions such as `1.5s` or `0.5s`, which `String` emits.

## The code

### Important reads

- [`config/flipt.schema.cue`](/config/flipt.schema.cue): `#FliptSpec` is already a top-level
  definition, in package `flipt`. It does not compile (`boolean`, line 104). It has no
  `experimental`, `storage`, or `version` in Go's naming, no `kubernetes` method, no session
  `token_lifetime`, `state_lifetime`, or `csrf`, and no OIDC `scopes`. `bootstrap.expiration` is a
  required field. `conn_max_lifetime` is typed `int` only, and `audit.buffer.flush_period` is a
  plain `string`.
- [`config/flipt.schema.json`](/config/flipt.schema.json): the editors' schema, referenced from the
  first line of [`config/default.yml`](/config/default.yml). It lacks the same sections. Its recent
  history, `dcd7f966` and `081fe685`, shows both schemas edited together by hand.
- [`internal/config/config.go`](/internal/config/config.go): `decodeHooks` is unexported. `Config`
  has no `DefaultConfig`. `Config.Version` has no mapstructure tag, so it decodes to the key
  `Version`. `fieldKey` returns the tag's name only when the tag has no option or has `squash`; with
  `omitempty`, it falls back to the lowercased Go name, `pollinterval` for `poll_interval`.
- [`internal/config/config_test.go`](/internal/config/config_test.go): `defaultConfig()`, line 203,
  is a test helper holding the defaults as a literal. `TestLoad` compares it to `Load` of
  [`testdata/default.yml`](/internal/config/testdata/default.yml), both from YAML and from
  environment variables. It uses `jaeger.DefaultUDPSpanServerHost` and `Port`, from a test-only
  import.
- [`internal/config/storage.go`](/internal/config/storage.go): `Local` and `Git` are values.
  `setDefaults` sets `storage.local.path` or `storage.git.ref` and `poll_interval` only for the
  selected type. `validate` reads `c.Git` and `c.Local` only for the selected type.
- Each section's defaults live in its own `setDefaults`, set on viper:
  [`log.go`](/internal/config/log.go), [`cache.go`](/internal/config/cache.go),
  [`database.go`](/internal/config/database.go), [`tracing.go`](/internal/config/tracing.go),
  [`authentication.go`](/internal/config/authentication.go),
  [`audit.go`](/internal/config/audit.go), and others. Some are conditional: the database URL
  default applies only when no host, name, or protocol is set, and a method's cleanup default only
  when the method is enabled.
- [`testdata/advanced.yml`](/internal/config/testdata/advanced.yml): its tracing section has
  `backend: jaeger`, a key Flipt ignores. It has no `audit` or `storage` section.

### The proposal's path and existing actions

- **Decoding the default configuration** with `DecodeHooks` gives a map in which `time.Duration`
  values stay durations, as the proposal requires. The test then turns them into strings.
- **Validation errors today**, with `boolean` fixed, from an experiment against the current code:
  `Version` and `experimental` and `storage` not allowed; `kubernetes`, `session.csrf`,
  `session.token_lifetime`, and `session.state_lifetime` not allowed; `token.cleanup` and
  `oidc.cleanup` are `null`; `db.conn_max_lifetime` is `"0s"` against `int`; `db.protocol` is `""`.
  Empty strings and nil maps elsewhere would fail next.
- **Loading from environment variables**: `bindEnvVars` uses `fieldKey`. In the prototype,
  `omitempty` without the `fieldKey` fix broke 4 `TestLoad` cases from environment variables, such
  as `database key/value (ENV)`. With the fix, all pass.
- **Storage with pointers**, checked in the prototype: with `type: database`, both pointers are nil.
  With `type: git` or `local`, only the selected one is set, defaults included. Environment
  variables reach a nested pointer, `storage.git.authentication.basic.username` included. A config
  with `type: database` and a leftover `local:` section, or `FLIPT_STORAGE_LOCAL_PATH` set, gets a
  non-nil `Local`.
- **The HTTP config endpoint**, `Config.ServeHTTP`, marshals the config to JSON. With nil pointers,
  `local` and `git` disappear from its output. The UI reads only `storage.type`
  ([`metaSlice.ts`](/ui/src/app/meta/metaSlice.ts), lines 43–44).
- **The gRPC server** reads `cfg.Storage.Git.Ref` and `cfg.Storage.Local.Path` in
  [`internal/cmd/grpc.go`](/internal/cmd/grpc.go), lines 141–168, only in the selected type's
  branch. Field access through a pointer compiles unchanged.
- **Other features in flight**: none. The only branches are `main` and this one.

### Rules and their owners

- **The default values**: owned by each section's `setDefaults`, copied as a literal in the test
  helper `defaultConfig()`. `DefaultConfig()` becomes a third place, or replaces the copy. See
  [where the defaults live](#where-the-defaults-live).
- **What a valid configuration is**: owned by each section's `validate` in Go, copied in the CUE
  schema and in the JSON schema, by hand.
- **Configuration key names**: owned by the mapstructure tags, read by viper, by `fieldKey` for
  environment variables, and by mapstructure's struct-to-map decoding.

### Likely changes

- [`internal/config/config.go`](/internal/config/config.go): export `DecodeHooks`, add
  `DefaultConfig()`, tag `Version`, fix `fieldKey`. Under every option.
- Every file of [`internal/config`](/internal/config) with a mapstructure tag: add `omitempty`.
- [`internal/config/storage.go`](/internal/config/storage.go): pointers, and nil-safe `validate`.
- [`internal/config/config_test.go`](/internal/config/config_test.go): use `DefaultConfig()`,
  construct `&Local{}` and `&Git{}`, the new `advanced` expectations, and a CUE validation test.
- [`internal/config/testdata/advanced.yml`](/internal/config/testdata/advanced.yml): the audit,
  tracing, and storage values the proposal lists.
- [`config/flipt.schema.cue`](/config/flipt.schema.cue): the fixes listed under
  [important reads](#important-reads).
- [`config/flipt.schema.json`](/config/flipt.schema.json): only with option B of
  [the JSON schema](#the-json-schema).
- [`internal/config/authentication.go`](/internal/config/authentication.go): only with option B of
  [the validation scope](#the-validation-scope).

## The proposal

### Where the defaults live

The proposal asks that `DefaultConfig()` return "the same canonical default values used by the
configuration loading path". The loading path holds them in viper defaults, spread over 11
`setDefaults` methods, some conditional. A Go literal returns the same values only as long as both
are kept in step.

### The default storage section

With the filesystem storage experiment off, as in the default configuration, `Load` replaces the
whole `storage` section by its zero value: `experimentalFieldSkipHookFunc` in
[`config.go`](/internal/config/config.go). So the loading path's default storage has an empty
`type`, not `database`, and `TestLoad` expects exactly that. The proposal still lists `storage`
among the sections the decoded default emits.

### Either one form or the other

The proposal says the database accepts "either a URL-based configuration or a protocol, host, port,
name, and user based configuration", and git "either basic or token authentication". Flipt itself is
laxer:

- `DatabaseConfig.validate` requires `protocol`, `host`, and `name` only when `url` is empty. A
  config with both a URL and a host runs, and the URL wins.
- `port` and `user` are never required.
- The comment on `Authentication` in [`storage.go`](/internal/config/storage.go) says "Token auth
  will take priority over Basic auth if both are provided".

A schema that reads "either" strictly rejects configs Flipt runs. Nothing in Flipt validates a
configuration against the CUE schema at run time, so this affects only the schema's readers and the
tests.

### A leftover section of another storage type

The proposal says each pointer "is nil when its storage backend is not selected and carries the
supplied settings when that backend is selected". A config with `type: database` and a leftover
`local:` section gets a non-nil `Local` from decoding, as
[the path](#the-proposals-path-and-existing-actions) shows.

### Durations in Go's form

The proposal asks that "every duration setting" accept Go's string form. Go's form includes
fractions, such as `1.5s`, which today's pattern rejects. It also includes a leading `-` for
negative values, which no Flipt setting accepts at run time.

### The JSON schema

The proposal names only the CUE schema. The JSON schema has the same gaps, and editors use it.

### The validation scope

The proposal asks that the default configuration validate. A fully populated configuration does not
in the prototype: OIDC providers sit in a `map[string]AuthenticationMethodOIDCProvider`, which
mapstructure copies as is. CUE then reads the providers' `json` tags, `clientID` and `clientSecret`,
which the schema rejects. Fixing it means changing those `json` tags, which also renames the keys of
the HTTP config endpoint, or decoding nested maps recursively.

## Worth it and feasibility

- **Worth it**: the work is small, within one package and one schema file, and the gain is a schema
  that compiles and a test that keeps it in step with the defaults. The `fieldKey` fix also removes
  a latent bug: any future `omitempty` tag would have broken its environment variable.
- **Checked**: the whole approach, in [the prototype](#prototype).
- **Not relied on**: no network, browser, or undocumented behaviour. No guard is relaxed.

### Prototype

Made in `/tmp`, from a copy of the repository, never committed. It:

1. replaced `boolean` by `bool`;
2. added `omitempty` to every mapstructure tag but `,squash`, and tagged `Version`;
3. fixed `fieldKey` to return a tag's name whenever it has one;
4. made `Local` and `Git` pointers, and moved `defaultConfig()` into `config.go` as
   `DefaultConfig()`;
5. extended the schema: the missing sections and fields, a shared duration pattern accepting
   fractions, the two database forms, CORS as a list or a string, and storage as a disjunction on
   `type` with `database` as default.

Results: the existing `internal/config` tests pass, and the decoded default validates under
`cue.Concrete(true)`. So do [`database.yml`](/internal/config/testdata/database.yml) and
[`local_provided.yml`](/internal/config/testdata/storage/local_provided.yml). The extended
`advanced.yml` fails only on the OIDC provider names, as
[the validation scope](#the-validation-scope) says. Edge inputs: `1.5s` and an integer pass;
`-1m0s`, `url` with `host`, both git authentications, and `type: database` with a `local:` section
fail.

## Approaches

Criteria come from the proposal, the constitution's "requirements come from the task" and "code
stays explicit and simple, and follows the repository's own patterns". Also one home per rule: a
rule written in one place cannot drift from a copy.

### Defaults home

How `DefaultConfig()` gets its values. Relies on
[where the defaults live](#where-the-defaults-live).

| Option                                                | One home | Size of change          | Drift caught by          |
| ----------------------------------------------------- | -------- | ----------------------- | ------------------------ |
| A. A Go literal in `config.go`, the test helper moved | No       | Small                   | `TestLoad` default cases |
| B. Run the loading path on an empty source, no env    | Yes      | Medium: split `Load`    | By construction          |
| C. Rewrite each `setDefaults` from `DefaultConfig()`  | Yes      | Large, conditional ones | By construction          |

### Schema strictness

How the schema treats configs that mix the two database forms or the two git authentications. Relies
on [either one form or the other](#either-one-form-or-the-other).

| Option                                                     | Matches the proposal's words    | Matches Flipt at run time |
| ---------------------------------------------------------- | ------------------------------- | ------------------------- |
| A. One form or the other; only Flipt's own required fields | Yes, but port and user optional | Rejects mixed configs     |
| B. Accept mixes, as Flipt does                             | No                              | Yes                       |
| C. One form or the other; port and user required too       | Literally                       | Rejects more              |

### Leftover storage section

Relies on [a leftover section](#a-leftover-section-of-another-storage-type).

| Option                                        | Matches the proposal's words   | Cost        |
| --------------------------------------------- | ------------------------------ | ----------- |
| A. Clear the unselected pointers after decode | Yes                            | A few lines |
| B. Keep what was supplied                     | Only when nothing is left over | None        |

### Duration pattern

Relies on [durations in Go's form](#durations-in-gos-form).

| Option                        | Accepts all `String` output | Accepts values Flipt rejects |
| ----------------------------- | --------------------------- | ---------------------------- |
| A. Fractions, no sign, or int | All non-negative values     | No                           |
| B. Fractions and sign, or int | All                         | Negatives                    |
| C. Today's pattern            | No fractions                | No                           |

### The JSON schema topic

Relies on [the JSON schema](#the-json-schema).

| Option                          | Scope               | Editors' validation |
| ------------------------------- | ------------------- | ------------------- |
| A. Leave it, note it in inbox   | As proposed         | Stays out of date   |
| B. Update it in the same change | Beyond the proposal | In step             |

### The validation scope topic

Relies on [the validation scope](#the-validation-scope).

| Option                                        | Scope               | Side effect                         |
| --------------------------------------------- | ------------------- | ----------------------------------- |
| A. The default configuration only             | As proposed         | None                                |
| B. Also `advanced.yml`, fixing provider names | Beyond the proposal | Renames keys of the config endpoint |

### Needs no choice

- **`DecodeHooks` exported**: a rename, used by `Load` and the test.
- **`Version` tag and `fieldKey`**: required by the proposal's mapstructure names; checked in the
  prototype.
- **`omitempty` on every tag, not only the empty ones**: no effect on loading, since viper decodes
  maps into structs, where `omitempty` is ignored. One rule is simpler than a list.
- **CORS as a list or a string**: the proposal says so, and `stringToSliceHookFunc` already splits a
  string.
- **The `advanced.yml` values**: the proposal lists them exactly.

## Not checked

- Flipt's online configuration documentation, and the upstream repository's later versions of these
  files: the proposal forbids consulting existing solutions, and they may hold this very change.
- Whether any tool outside this repository reads `config/flipt.schema.cue`: nothing in the
  repository does, apart from the test this change adds.
