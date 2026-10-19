# Data model: Default configuration validates against the CUE schema

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's. The configuration file's format does not change for users: the schema and the decoded map
do.

## Schema `#FliptSpec`

[`config/flipt.schema.cue`](/config/flipt.schema.cue), the contract that decoded configuration maps
are validated against.

| Field                                     | Type                                       | Meaning                                 | Change  |
| ----------------------------------------- | ------------------------------------------ | --------------------------------------- | ------- |
| `storage`                                 | struct                                     | which backend serves flag state         | New     |
| `storage.type`                            | `database`, `local`, or `git`              | the backend, optional                   | New     |
| `storage.local.path`                      | string                                     | the folder for the local backend        | New     |
| `storage.git.repository`                  | string                                     | the repository, required in a git entry | New     |
| `storage.git.ref`                         | string, default `main`                     | the branch or tag                       | New     |
| `storage.git.poll_interval`               | duration, default `30s`                    | how often the repository is polled      | New     |
| `storage.git.authentication`              | struct with `basic` or `token`, never both | credentials for a private repository    | New     |
| `experimental.filesystem_storage.enabled` | bool                                       | the flag that allows `storage`          | New     |
| `authentication.methods.kubernetes`       | struct                                     | the Kubernetes method and its cleanup   | New     |
| `authentication.session.csrf.key`         | string                                     | the CSRF key                            | New     |
| `authentication.session.token_lifetime`   | duration                                   | how long a session token lives          | New     |
| `authentication.session.state_lifetime`   | duration                                   | how long the login state lives          | New     |
| `db`                                      | URL form or protocol, host, name form      | the two forms exclude each other        | Changed |
| `db.prepared_statements_enabled`          | bool                                       | the type was written `boolean`          | Changed |
| `db.conn_max_lifetime`                    | duration or integer                        | was an integer only                     | Changed |
| `cors.allowed_origins`                    | list of strings, or one string             | was a list only                         | Changed |
| every duration field                      | duration pattern with decimals, or integer | accepts `1m0s`, `24h0m0s`, and `1.5s`   | Changed |

## Decoded default configuration

The map that `DefaultConfig()` decodes into, with the exported `DecodeHooks`.

| Field                 | Type          | Meaning                                       | Change                    |
| --------------------- | ------------- | --------------------------------------------- | ------------------------- |
| `version`             | string        | the configuration version, key was `Version`  | Changed                   |
| `storage.local`       | map or absent | present only when the local backend is chosen | Changed, was always a map |
| `storage.git`         | map or absent | present only when the git backend is chosen   | Changed, was always a map |
| optional empty fields | absent        | nil pointers and zero scalars are left out    | Changed, were `null` or 0 |
