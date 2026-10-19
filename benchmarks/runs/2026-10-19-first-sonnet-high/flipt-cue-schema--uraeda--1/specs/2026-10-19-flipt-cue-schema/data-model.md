# Data model: Default Flipt configuration validates against the CUE schema

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's. The configuration file users write does not change: the schema only describes more of it.

## `#FliptSpec` in `config/flipt.schema.cue`

| Field                                               | Type                                              | Meaning                                                     | Change  |
| --------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | ------- |
| `storage`                                           | struct                                            | Where Flipt serves flag state from                          | New     |
| `storage.type`                                      | `"database"`, `"git"`, or `"local"`               | The selected backend                                        | New     |
| `storage.local.path`                                | string                                            | Folder of the local backend                                 | New     |
| `storage.git.repository`, `ref`                     | string                                            | Repository and ref of the git backend                       | New     |
| `storage.git.poll_interval`                         | duration string or int                            | How often the repository is polled                          | New     |
| `storage.git.authentication.basic`                  | `username` and `password`, strings                | Basic authentication, when given                            | New     |
| `storage.git.authentication.token`                  | `access_token`, string                            | Token authentication, when given                            | New     |
| `experimental.filesystem_storage.enabled`           | bool                                              | Flag that turns on filesystem storage                       | New     |
| `db`                                                | URL form or parts form                            | Either `url`, or `protocol`, `host`, `port`, `name`, `user` | Changed |
| `db.conn_max_lifetime`                              | duration string or int                            | Connection lifetime, was int only                           | Changed |
| `cors.allowed_origins`                              | list of strings, or one string                    | Allowed origins, was list only                              | Changed |
| `audit.buffer.flush_period`                         | duration string or int                            | Flush period, was any string                                | Changed |
| `authentication.session.token_lifetime`             | duration string or int                            | Lifetime of a session token                                 | New     |
| `authentication.session.state_lifetime`             | duration string or int                            | Lifetime of an authentication state                         | New     |
| `authentication.session.csrf.key`                   | string                                            | Key that signs CSRF tokens                                  | New     |
| `authentication.methods.kubernetes`                 | struct                                            | The Kubernetes method, with its `cleanup`                   | New     |
| `authentication.methods.token.bootstrap.expiration` | duration string or int                            | Was required, now optional                                  | Changed |
| duration pattern                                    | `^([0-9]+(\.[0-9]+)?(ns\|us\|µs\|ms\|s\|m\|h))+$` | Accepts every `time.Duration` string, fractions included    | Changed |

## Decoded `StorageConfig`

| Field   | Type                | Meaning                                      | Change  |
| ------- | ------------------- | -------------------------------------------- | ------- |
| `local` | `*Local`, omitempty | Present only when the local type is selected | Changed |
| `git`   | `*Git`, omitempty   | Present only when the git type is selected   | Changed |
