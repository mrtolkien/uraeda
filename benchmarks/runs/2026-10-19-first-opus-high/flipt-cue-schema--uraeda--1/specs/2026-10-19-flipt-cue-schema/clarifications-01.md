---
status: answered
---

# Clarifications, round 01: Default configuration validates against the CUE schema

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed, since a throwaway prototype of the whole approach validates
>   the default configuration and keeps the existing tests passing.
> - The schema does not compile today: `boolean` is not a CUE type. The fix is settled.
> - Where the default values live lasts beyond this feature: a copied literal, or one home.
> - How strictly the schema reads "either one form or the other" decides whether it rejects configs
>   Flipt runs today.
> - Scope: whether the JSON schema and the fully populated example follow along.
> - Settled points to check: an empty default storage type, and clearing a leftover storage section.

## Context

### Goal

Make the out-of-the-box Flipt configuration validate against the CUE configuration schema, and keep
it so with a test. This is for Flipt's maintainers, who need the schema to match the configuration
contract.

### Today

- [`config/flipt.schema.cue`](/config/flipt.schema.cue) defines `#FliptSpec`, but does not compile:
  `prepared_statements_enabled` uses `boolean`, which is not a CUE type.
- With that fixed, 12 fields of the decoded default configuration fail. Whole sections are missing,
  such as `storage`, `experimental`, and the Kubernetes method. Empty values like `null` cleanups
  and an empty `db.protocol` are rejected. `conn_max_lifetime` accepts only integers.
- The defaults live in viper, in 11 `setDefaults` methods across
  [`internal/config`](/internal/config). A test helper, `defaultConfig()` in
  [`config_test.go`](/internal/config/config_test.go), copies them as a Go literal.
- A JSON schema, [`config/flipt.schema.json`](/config/flipt.schema.json), is what editors use to
  check config files. It has the same gaps, and both schemas have been edited together by hand.
- A prototype, in a throwaway copy, made every change the proposal asks for. The default
  configuration then validates, and every existing test passes.

### Scope

The proposal's requirements, as written: `DefaultConfig()`, `DecodeHooks`, the schema fixes,
`omitempty` tags, the storage pointers, and the extended `advanced.yml`. Two scope edges are asked
below: the JSON schema, and validating more than the default configuration.

### Sources

- The config package, the CUE schema, the JSON schema, the gRPC server's use of storage, and the
  UI's use of the config endpoint.
- The documentation and source of CUE v0.5.0, mapstructure v1.5.0, and Go's `time.Duration`.
- A prototype in a throwaway copy of the repository, never committed.
- The full investigation is in [discovery](discovery-01.md).

## Q1: Where should the default values live?

`DefaultConfig()` must return "the same canonical default values used by the configuration loading
path". Today the loading path sets them on viper, in 11 `setDefaults` methods. Some are conditional:
the database URL default applies only when no host or name is set. A test helper already copies the
result as a Go literal. `TestLoad` compares that literal with what loading an empty file gives, both
from YAML and from environment variables. So a drift between the two already fails the tests. More
in [discovery](discovery-01.md#defaults-home).

Why it matters: a copy is quick but must be edited twice for every new default. One home costs a
refactor of `Load` now.

- **A (recommended). Move the test helper's literal into `config.go` as `DefaultConfig()`, and keep
  the `setDefaults` methods as they are; `TestLoad` keeps both in step.**
  - [pro] the smallest change, and the values read at a glance in one function.
  - [con] each new default is written twice, in `setDefaults` and in `DefaultConfig()`.
  - Why recommended: the existing default cases of `TestLoad` already catch any drift, so the copy
    is safe, and the change stays small.
- **B. Build `DefaultConfig()` by running the loading path on an empty configuration, with no file
  and no environment variables.**
  - [pro] one home for the defaults, so they cannot drift.
  - [con] `Load` must be split so the defaults run without a file or the environment, a refactor the
    proposal does not ask for.
- **C. Rewrite every `setDefaults` to take its values from `DefaultConfig()`.**
  - [pro] one home, in a plain Go literal.
  - [con] the largest change, and the conditional defaults still need their own logic.

**Answer:** Your call: A

## Q2: Should the schema reject configs that mix the two database forms, or both git authentications?

The proposal says the database accepts "either a URL-based configuration or a protocol, host, port,
name, and user based configuration". It says git accepts "either basic or token authentication".
Flipt itself is laxer:

- With both a URL and a host, Flipt runs, and the URL wins.
- Only `protocol`, `host`, and `name` are required without a URL: `port` and `user` are optional.
- With both git authentications, "token auth will take priority over basic auth", says the code's
  comment in [`storage.go`](/internal/config/storage.go).

Nothing in Flipt validates a config against the CUE schema when it runs. So a stricter schema only
affects tests and people reading the schema. The prototype checked that each option below can be
written in CUE. More in [discovery](discovery-01.md#schema-strictness).

Why it matters: it decides whether the schema documents the configuration Flipt should get, or every
configuration Flipt tolerates.

- **A (recommended). Accept one database form or the other, and one git authentication or the other.
  The host-based form requires only `protocol`, `host`, and `name`, as Flipt does.**
  - [pro] follows the proposal's "either", without rejecting a database config Flipt needs nothing
    more for.
  - [con] a config mixing a URL with a host, or both authentications, fails the schema though Flipt
    runs it.
  - Why recommended: it keeps the proposal's two forms, and never requires more than Flipt does.
- **B. Accept mixed configs, as Flipt does: a URL with host fields, and both authentications.**
  - [pro] the schema never rejects a config Flipt runs.
  - [con] departs from the proposal's "either", and documents combinations that are likely mistakes.
- **C. Accept one form or the other, and also require `port` and `user` in the host-based form, as
  the proposal lists them.**
  - [pro] the proposal's words, read literally.
  - [con] rejects host-based configs without a port or a user, which Flipt runs with its defaults.

**Answer:** Your call: A, one form or the other

## Q3: Should the JSON schema be updated too?

[`config/flipt.schema.json`](/config/flipt.schema.json) is the schema editors use: the first line of
[`config/default.yml`](/config/default.yml) points to it. It lacks the same sections as the CUE
schema: `storage`, `experimental`, the Kubernetes method, and the session lifetimes. Its recent
commits always changed both schemas together, by hand. The proposal names only the CUE schema, and
the project's principles forbid adding what the proposal does not ask for. More in
[discovery](discovery-01.md#the-json-schema-topic).

Why it matters: leaving it means the two schemas disagree from now on, until someone ports the
changes.

- **A (recommended). Leave the JSON schema as it is, and add a note to the inbox to bring it in step
  later.**
  - [pro] stays within what the proposal asks.
  - [con] editors keep warning on valid `storage` and Kubernetes settings until it is done.
  - Why recommended: the proposal is explicit about the CUE schema, and the gap is recorded rather
    than lost.
- **B. Port the same changes to the JSON schema in this feature.**
  - [pro] both schemas stay in step, as their history shows they usually are.
  - [con] about as much schema work again, with no test to check it.

**Answer:** Your call: A

## Q4: Should the schema also validate a fully populated configuration?

The proposal asks that the default configuration validate. A fully populated one, like the extended
`advanced.yml`, fails in the prototype on one point. OIDC providers are kept in a Go map of structs,
which the decoding copies as is. The schema then sees their JSON names, such as `clientID`, instead
of `client_id`. Fixing it means renaming those JSON names, which also renames the keys of Flipt's
HTTP config endpoint, or decoding nested maps another way. More in
[discovery](discovery-01.md#the-validation-scope-topic).

Why it matters: validating only the defaults leaves sections the defaults leave empty, like OIDC
providers, unchecked by any test.

- **A (recommended). Validate only the default configuration, as the proposal asks, and note the
  OIDC provider names in the inbox.**
  - [pro] stays within the proposal, with no change to the config endpoint.
  - [con] a schema error in a section the defaults leave empty goes unnoticed.
  - Why recommended: the proposal's test covers the defaults, and the fix for providers has side
    effects beyond the schema.
- **B. Also validate `advanced.yml` against the schema, and make the OIDC providers decode with
  their configuration names.**
  - [pro] the schema is checked against every section, not only the defaults.
  - [con] beyond the proposal, and changes either the config endpoint's keys or the decoding.

**Answer:** Your call: A, defaults only

## Settled without the human

### Check these

- **The default storage type** stays empty in `DefaultConfig()`, as loading gives it with the
  filesystem storage experiment off. The schema treats a missing type as `database`. The proposal
  asks for the loading path's values, and `TestLoad` expects them. See
  [discovery](discovery-01.md#the-default-storage-section).
- **A leftover storage section**, such as `local:` under `type: database`, is cleared after loading.
  So `Local` and `Git` are nil whenever their type is not selected, as the proposal says. See
  [discovery](discovery-01.md#leftover-storage-section).
- **Negative durations** stay rejected by the schema; fractions such as `1.5s`, and integers of
  nanoseconds, are accepted. Go's string form of every value Flipt accepts then passes. See
  [discovery](discovery-01.md#duration-pattern).

### Behaviour

- **Environment variables** keep their names: the lookup of a key's name is fixed to read the tag's
  name when it has `omitempty`. Without the fix, the prototype broke variables such as the database
  ones. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The HTTP config endpoint** no longer shows empty `local` and `git` objects; the UI reads only
  the storage type. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The example's tracing section** loses `backend: jaeger`, a key Flipt ignores, for the
  `exporter: otlp` the proposal lists. See [discovery](discovery-01.md#important-reads).

### Under the hood

- **The `boolean` typo** becomes `bool`, so the schema compiles. See
  [discovery](discovery-01.md#important-reads).
- **`omitempty` goes on every mapstructure tag** except the squashed one, rather than a chosen few:
  it has no effect on loading, and one rule is simpler. See
  [discovery](discovery-01.md#needs-no-choice).
- **The storage schema** is a choice on `type`, with `database` as its default, so an empty storage
  section validates. See [discovery](discovery-01.md#cue-v050).
- **The new test** lives in `internal/config`, decodes `DefaultConfig()` with `DecodeHooks`, turns
  durations into strings, and validates against `#FliptSpec` with concrete values required. See
  [discovery](discovery-01.md#prototype).

**Notes:**
