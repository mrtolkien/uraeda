---
kind: feature
finished: 2026-10-19
---

# Record: Default Flipt configuration validates against the CUE schema

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, in its pull request on branch `2026-10-19-flipt-cue-schema`. Its full files are in
> git: `git log -- specs/2026-10-19-flipt-cue-schema/`.

## What and why

The default Flipt configuration, decoded to a map, must pass a `#FliptSpec` CUE schema with every
value concrete. Maintainers get a test that fails when the schema, the Go structs, and the defaults
drift apart.

## Behaviour

- `DefaultConfig()` returns the canonical default `*Config`; loading an empty file equals it.
- `DecodeHooks` is the exported list of decode conversions, shared by `Load` and the schema test.
- `#FliptSpec` accepts every top-level section of the decoded default, including `storage` and
  `experimental`, and rejects unknown fields.
- Durations are Go duration strings (fractions included) or integers.
- The database is either `url`, or `protocol`, `host`, `port`, `name`, and `user` together.
- `cors.allowed_origins` is a list or one string.
- `StorageConfig.Local` and `.Git` are pointers, nil unless selected, and omitted from the decoded
  map and from JSON; a selected type with nil settings fails `validate`, and `grpc.go` returns an
  error instead of panicking.
- `fieldKey` returns the tag's name for `omitempty` tags, so environment variables still bind.
- `advanced.yml` also sets audit, OTLP tracing, and git storage with basic authentication.

## Design

The defaults keep two homes: `setDefaults` for loading, and
[`DefaultConfig()`](/internal/config/config.go); the empty-file test fails when they drift. The
[schema](/config/flipt.schema.cue) is the CUE file only, and the JSON schema is unchanged. The
[schema test](/internal/config/schema_test.go) owns the conversion of durations and enums to
strings. Fields whose default is empty carry `omitempty`: the database parts, `storage.type`,
`version`, and the authentication `cleanup` pointers.

## Questions

### Round 01

#### Q1: Should `DefaultConfig()` only mirror the loading path, or replace how it builds defaults?

**Answer:** Your call: A. It mirrors the loading path.

#### Q2: Should the JSON schema change too?

**Answer:** Your call: A. The JSON schema stays as it is.

#### Q3: Which database fields does the schema require in the parts form?

**Answer:** B: protocol, host, port, name, and user.

## Changes after approval

- The schema's undefined `boolean` type for `prepared_statements_enabled` became `bool`, since CUE
  could not compile the file otherwise.
- `storage.type` and `cache.ttl` also carry `omitempty`: the default's storage has no type when the
  experiment is off.

## Follow-ups

- The final review was done by the author, without a fresh reviewer.
