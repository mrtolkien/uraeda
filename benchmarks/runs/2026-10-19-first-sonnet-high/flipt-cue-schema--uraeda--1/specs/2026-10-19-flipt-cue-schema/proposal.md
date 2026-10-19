A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

# Title

Default Flipt configuration does not validate against the CUE schema

## Description

The canonical default Flipt configuration can fall out of sync with the CUE schema used for
configuration validation. When the default configuration is decoded and checked against the CUE
configuration schema, mismatches around optional sections, duration values, storage configuration,
and mapstructure field names can cause validation failures even though the defaults represent valid
runtime configuration. This prevents reliable validation of the out-of-the-box configuration and
makes it harder to guarantee that default settings remain compatible with the documented
configuration contract.

## Requirements

- The default Flipt configuration must be available through a function `DefaultConfig()` in the
  config package that takes no arguments and returns a `*Config`, and it must return the same
  canonical default values used by the configuration loading path.

- The configuration decode hook chain must be reusable through the exported `DecodeHooks` value in
  the config package, so decoding the default configuration into a `map[string]any` uses the same
  conversions as normal configuration loading.

- Every duration setting of the configuration must be accepted by the CUE schema when written in
  Go's duration string form, the form a `time.Duration` value takes when converted to a string.

- The CUE configuration schema must expose a top-level `#FliptSpec` definition that can be used to
  validate decoded Flipt configuration maps.

- `#FliptSpec` must accept every top-level section emitted by the decoded default configuration,
  including `log`, `ui`, `cors`, `cache`, `server`, `tracing`, `db`, `meta`, `authentication`,
  `audit`, `experimental`, and `storage`.

- Mapstructure field names must align with the schema field names used for validation, and
  `omitempty` options in mapstructure tags must not prevent the correct field name from being used.

- Optional fields that are empty in the default configuration must not cause CUE validation
  failures, including optional nested fields in authentication, database, storage, tracing, audit,
  and other configuration sections.

- Storage configuration must support omitted `local`, `git`, and authentication subsections without
  emitting invalid empty objects during default configuration validation.

- `StorageConfig.Local` and `StorageConfig.Git` must become nil-able pointer fields, typed `*Local`
  and `*Git`, so that each one is nil when its storage backend is not selected and carries the
  supplied settings when that backend is selected, and so that `local` and `git` are omitted
  entirely from the decoded configuration rather than emitted as empty objects. This is a deliberate
  breaking change to the shape of `StorageConfig` and it takes precedence over source compatibility
  within the repository. Within the source this change covers, storage settings are therefore
  supplied by reference and that source must continue to build. A construction site that still
  supplies one of these two fields by value and that lies outside the source this change covers is
  reconciled outside the scope of this change, so a build error at such a place while this change is
  in progress is expected and must not be avoided by keeping the two fields as plain values.

- The CUE schema must accept storage configurations for database, git, and local storage, including
  git repository settings, refs, poll intervals, and either basic or token authentication when
  provided.

- Database configuration validation must accept either a URL-based configuration or a protocol,
  host, port, name, and user based configuration, while still allowing shared database options such
  as password, connection limits, connection lifetime, and prepared statement settings.

- CORS configuration must accept `allowed_origins` as either a list of origins or a single string.

- The config package's fully populated example configuration document `advanced.yml` must be
  extended to also cover the sections this change introduces or reshapes, and it must load into
  exactly these values: an `audit` section whose `sinks.log` is enabled with `file` set to
  `/path/to/logs.txt` and whose `buffer` has `capacity` 10 and `flush_period` 3m; a `tracing`
  section that selects the OTLP exporter through `exporter: otlp` and sets `otlp.endpoint` to
  `localhost:4318`; and a `storage` section of type `git` whose `git` entry has `repository`
  `https://github.com/flipt-io/flipt.git`, `ref` `production`, `poll_interval` 5s, and basic
  authentication with username `user` and password `pass`.

- The configuration returned by `DefaultConfig()`, with its durations in string form, must validate
  against `#FliptSpec` without errors when every value is required to be concrete.

- The default Flipt configuration must be available through `DefaultConfig()` in the config package,
  and it must return the same canonical default values used by the configuration loading path.

- Decoding `DefaultConfig()` with `mapstructure.ComposeDecodeHookFunc(DecodeHooks...)` must preserve
  duration fields as `time.Duration` values before schema validation adaptation.

- Duration values emitted from the default configuration must be valid after conversion to their
  string form, including values such as `1m0s`, `24h0m0s`, `10m0s`, `5m0s`, and `2m0s`.

- The example configuration document named `advanced.yml` that ships with the config package's
  example data, which is the fully populated example exercised through the configuration loading
  path, must be extended so that it also exercises the sections this change introduces or reshapes,
  and it must load into exactly these values: an `audit` section whose `sinks.log` is enabled with
  `file` set to `/path/to/logs.txt` and whose `buffer` has `capacity` 10 and `flush_period` 3m; a
  `tracing` section that selects the OTLP exporter through `exporter: otlp` and sets `otlp.endpoint`
  to `localhost:4318`; and a `storage` section of type `git` whose `git` entry has `repository`
  `https://github.com/flipt-io/flipt.git`, `ref` `production`, `poll_interval` 5s, and basic
  authentication with username `user` and password `pass`.

- Validating the decoded and adapted `DefaultConfig()` map against `#FliptSpec` with concrete CUE
  validation must complete without errors.

## New Interfaces

No new interfaces are introduced.

- Path: `internal/config/config.go`

- Name: `DefaultConfig`

- Type: function

- Input: `NA`

- Output: `*Config`

- Description: Returns the canonical default Flipt configuration used by the configuration package,
  including default values for logging, UI, CORS, cache, server, tracing, database, metadata,
  authentication, and audit settings. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
