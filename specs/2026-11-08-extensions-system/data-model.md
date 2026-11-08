# Data model: Extensions system

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

```mermaid
erDiagram
    CONFIG_FOLDER ||--|| SETTINGS_FILE : holds
    CONFIG_FOLDER ||--o{ EXTENSION_FOLDER : "holds, in extensions/"
    EXTENSION_FOLDER ||--|| MANIFEST : "extension.toml"
    EXTENSION_FOLDER ||--o| SOURCE : ".ura-source"
    SETTINGS_FILE ||--o{ EXTENSION_TABLE : "[extensions.<name>]"
    MANIFEST ||--o{ EXTENSION_TABLE : "its settings' schema"
```

## Extension folder

One folder per extension in `<config>/extensions/`, beside the settings file and the themes folder.
Its name is the extension's name. A linked extension is a symbolic link to the folder you write in.

| Path               | Type    | Meaning                                                       | Change |
| ------------------ | ------- | ------------------------------------------------------------- | ------ |
| `extension.toml`   | TOML    | The manifest, below                                           | New    |
| `server.ts`        | TS      | The server entry, when the manifest names one                 | New    |
| `page.tsx`         | TSX     | The page entry, when the manifest names one                   | New    |
| other `.ts`/`.tsx` | TS, TSX | Files the entries import by relative path                     | New    |
| `skills/<name>/`   | Folder  | Agent skills, in the Agent Skills format, passed to the agent | New    |
| `themes/*.toml`    | TOML    | Colour themes, in the existing theme format                   | New    |
| `.ura-source`      | TOML    | Where `ura` installed it from, absent for a linked folder     | New    |

## Manifest, `extension.toml`

| Field          | Type           | Meaning                                                                        | Change |
| -------------- | -------------- | ------------------------------------------------------------------------------ | ------ |
| `name`         | string         | Kebab-case, unique, the folder's name; built-ins' names are reserved           | New    |
| `title`        | string         | Shown on the settings page                                                     | New    |
| `description`  | string         | One line, shown under the title                                                | New    |
| `version`      | string         | The extension's own version, shown on the settings page                        | New    |
| `api`          | integer        | The extension API version it is built for                                      | New    |
| `icon`         | string         | An icon name of the app's set                                                  | New    |
| `server`       | path, optional | Its server entry                                                               | New    |
| `page`         | path, optional | Its page entry                                                                 | New    |
| `[settings.*]` | tables         | Each setting: `type` (bool, integer, string, list), `default`, `label`, `help` | New    |

## Source, `.ura-source`

Written by `ura extension add` and `ura extension update`, read by the settings page.

| Field    | Type   | Meaning                            | Change |
| -------- | ------ | ---------------------------------- | ------ |
| `url`    | string | The git URL it was cloned from     | New    |
| `commit` | string | The commit it is pinned to         | New    |
| `ref`    | string | The branch or tag `update` follows | New    |

## Settings file, `config.toml`

| Field                 | Type          | Meaning                                                          | Change |
| --------------------- | ------------- | ---------------------------------------------------------------- | ------ |
| `[extensions] off`    | list of names | Extensions turned off, built-ins included; absent means all on   | New    |
| `[extensions.<name>]` | table         | That extension's settings, checked against its manifest's schema | New    |

## Session cache

| Field   | Type   | Meaning                                                          | Change  |
| ------- | ------ | ---------------------------------------------------------------- | ------- |
| `agent` | string | The runtime's extension name; `claude` stays the built-in's name | Changed |
