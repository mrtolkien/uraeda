# Data model: Default configuration validates against the CUE schema

The file formats that [the spec](spec.md) changes: the CUE schema of the configuration file, the map
the configuration decodes into, and the HTTP config endpoint's output. The configuration file Flipt
accepts does not change. Internal types are the plan's.

## The schema's `#FliptSpec`

A field marked optional may be left out. A duration is a string matching
`^([0-9]+(\.[0-9]+)?(ns|us|µs|ms|s|m|h))+$`, or an integer of nanoseconds: one definition, shared by
every duration field.

| Field                                               | Type                                                                                         | Meaning                               | Change  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------- | ------- |
| `version`                                           | `"1.0"`, optional                                                                            | the file format's version             |         |
| `experimental.filesystem_storage.enabled`           | bool, optional                                                                               | turns on the storage section          | New     |
| `storage`                                           | one of the three forms below, optional, `database` default                                   | where Flipt reads flag state          | New     |
| `db`                                                | the URL form or the host form, below                                                         | the database                          | Changed |
| `db.prepared_statements_enabled`                    | bool, optional                                                                               | was `boolean`, which does not compile | Changed |
| `db.conn_max_lifetime`                              | duration, optional                                                                           | was an integer only                   | Changed |
| `cors.allowed_origins`                              | list of strings, or a string, optional                                                       | a string is split on spaces           | Changed |
| `authentication.session.token_lifetime`             | duration, optional                                                                           | how long a session token lasts        | New     |
| `authentication.session.state_lifetime`             | duration, optional                                                                           | how long an OIDC login state lasts    | New     |
| `authentication.session.csrf.key`                   | string, optional                                                                             | the CSRF key                          | New     |
| `authentication.methods.token.bootstrap.expiration` | duration, optional                                                                           | was required                          | Changed |
| `authentication.methods.oidc.providers.*.scopes`    | list of strings, optional                                                                    | the scopes asked of the provider      | New     |
| `authentication.methods.kubernetes`                 | `enabled`, `discovery_url`, `ca_path`, `service_account_token_path`, `cleanup`, all optional | the Kubernetes method                 | New     |
| `audit.buffer.flush_period`                         | duration, optional                                                                           | was any string                        | Changed |
| every other duration field                          | duration                                                                                     | now accepts fractions, such as `1.5s` | Changed |

### `db` forms

| Form      | Required                   | Optional                               | Forbidden                                  |
| --------- | -------------------------- | -------------------------------------- | ------------------------------------------ |
| URL form  | `url`                      | the shared options                     | `protocol`, `host`, `port`, `name`, `user` |
| Host form | `protocol`, `host`, `name` | `port`, `user`, and the shared options | `url`                                      |

The shared options are `password`, `max_idle_conn`, `max_open_conn`, `conn_max_lifetime`, and
`prepared_statements_enabled`. A `db` section with neither `url` nor `host` reads as the URL form,
whose `url` has the default `file:/var/opt/flipt/flipt.db`.

### `storage` forms

| `type`              | Fields                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `database`, or none | none                                                                                      |
| `local`             | `local.path`, string                                                                      |
| `git`               | `git.repository`, `git.ref`, `git.poll_interval` duration, `git.authentication`, optional |

`git.authentication` is either `basic`, with `username` and `password`, or `token`, with
`access_token`: one or the other, not both.

## The decoded configuration map

What `DefaultConfig()` decodes into with `DecodeHooks`, and what the schema test validates.

| Field                          | Type            | Meaning                                            | Change  |
| ------------------------------ | --------------- | -------------------------------------------------- | ------- |
| `version`                      | string          | was keyed `Version`; left out when empty           | Changed |
| any empty value                | none            | a zero value or nil pointer is left out            | Changed |
| `storage.local`, `storage.git` | map             | present only for the selected type                 | Changed |
| durations                      | `time.Duration` | unchanged by decoding; the test makes them strings |         |

## The HTTP config endpoint

`Config.ServeHTTP` marshals the configuration to JSON.

| Field                          | Type   | Meaning                            | Change  |
| ------------------------------ | ------ | ---------------------------------- | ------- |
| `storage.local`, `storage.git` | object | present only for the selected type | Changed |
