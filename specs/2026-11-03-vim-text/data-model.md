# Data model: Vim in text edit mode

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## The settings file's `[keyboard]` table

The TOML file of the [Settings](../decisions/settings.md) decision, in the config folder. Both new
keys are optional; a missing key takes its default.

| Field                  | Type             | Meaning                                                                                           | Change |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------- | ------ |
| `single_key_shortcuts` | boolean          | The page's one-letter keys, on by default                                                         |        |
| `vim_mode`             | boolean          | Vim's keys in every text field, off by default                                                    | New    |
| `vim_commands`         | array of strings | Vim commands run in order when Vim starts, one per item, like `"imap jj <Esc>"`; empty by default | New    |

A value of the wrong type is a problem of the file, shown on the settings page as today: "Vim mode
is true or false." and "Vim commands are a list of lines, like [\"imap jj <Esc>\"]." A command the
Vim engine refuses is not a problem of the file: the settings page shows it under the field, with
the engine's message.

Example:

```toml
[keyboard]
single_key_shortcuts = true
vim_mode = true
vim_commands = ["imap jj <Esc>", "nmap Y y$"]
```

## The Commit page's commits

A buffer's save writes the file only. The Commit page commits each branch with changes apart, when
the human commits its pane.

| Field   | Type | Meaning                                                                                                                                                      | Change  |
| ------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| Line    | text | `- Edit specs/INBOX.md`, a file edited whole, among the default branch's other changes                                                                       | New     |
| Message | text | the core's suggestion, like `chore: edit specs/PRIORITIES.md` or `chore(<slug>): edit spec.md`, until the human rewrites it; committed as typed, never empty | Changed |
