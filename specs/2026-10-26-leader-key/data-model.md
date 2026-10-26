# Data model: Leader key/shortcut map

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## Settings file

Uraeda's `config.toml` gains a `[keyboard]` table. A missing table or key means the shortcuts are
on, and a hand edit that keeps other keys, comments, and order is kept as the settings decision
asks.

| Field                             | Type    | Meaning                                                                   | Change |
| --------------------------------- | ------- | ------------------------------------------------------------------------- | ------ |
| `[keyboard]`                      | table   | the keyboard's settings                                                   | New    |
| `[keyboard] single_key_shortcuts` | boolean | whether the leader, `g` sequences, and letter keys act; `true` when unset | New    |
