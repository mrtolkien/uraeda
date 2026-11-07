# Data model: Color themes

The file formats and stored data that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## Theme file

A TOML file per theme, in the shape of Helix's themes. Shipped themes are written in it, in the
core; a user's are in `themes/` in Uraeda's config folder, beside `config.toml`. The file's name,
without `.toml`, is the theme's id: `catppuccin-mocha.toml` is `catppuccin-mocha`.

```toml
#:schema https://raw.githubusercontent.com/mrtolkien/uraeda/main/schemas/theme.json
name = "Ember"
mode = "dark"
extends = "catppuccin-mocha"

[palette]
coal = "#1a1210"
ash = "#c9b8a8"
ember = "#ff7a45"

[roles]
page = "coal"
ink = "ash"
needs-you = "ember"
pane-title = "#e0a070"
```

| Field       | Type                                         | Meaning                                                                                         | Change |
| ----------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| `name`      | string                                       | the name in the lists; the id when absent                                                       | New    |
| `mode`      | `"dark"` or `"light"`                        | the list the theme shows in; taken from `extends` when absent                                   | New    |
| `extends`   | a theme's id                                 | the theme every role left out comes from, of the same mode; the default of its mode when absent | New    |
| `[palette]` | table of names to `#rrggbb` or `#rrggbbaa`   | the theme's own colours, named freely, private to the file                                      | New    |
| `[roles]`   | table of roles to a palette name or a colour | the meaning each colour takes; every role is optional                                           | New    |

A role names a palette entry of the same file, or of a theme it extends, or gives a colour. The core
checks what a JSON Schema cannot: that each name exists, and that `extends` has no cycle.

## Roles

Each role is named for where it draws or what it means. "Mocha" is Catppuccin Mocha's colour, its
value today. Everything else the UI draws is derived from them, as today: tints over the page, hover
and pressed overlays, icons in their text's colour, diff lines, and text on filled marks.

| Role                                                                                                                                                               | Where it draws, what it says                                         | Mocha                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `page`                                                                                                                                                             | the ground behind everything                                         | base                                                                                  |
| `raised`                                                                                                                                                           | popovers, code blocks, a pane's surface                              | mantle                                                                                |
| `sunken`                                                                                                                                                           | a well below the page                                                | crust                                                                                 |
| `chip`                                                                                                                                                             | a neutral filled mark: a grey badge, a skeleton                      | surface0                                                                              |
| `cursor-row`                                                                                                                                                       | the row under the cursor, or picked                                  | mauve at 14% over base                                                                |
| `marked`                                                                                                                                                           | the block selected in a review, and its edge                         | yellow                                                                                |
| `rule`                                                                                                                                                             | panes' borders, dividers, fields                                     | overlay0                                                                              |
| `pane-title`                                                                                                                                                       | a pane's title in its border                                         | lavender                                                                              |
| `ink`                                                                                                                                                              | body text                                                            | text                                                                                  |
| `ink-quiet`                                                                                                                                                        | what reads second: counts, help, labels                              | subtext0                                                                              |
| `ink-faint`                                                                                                                                                        | disabled and faint text                                              | dim                                                                                   |
| `action`                                                                                                                                                           | what can be pressed: a button, focus, the active pane, the next step | mauve                                                                                 |
| `on-action`                                                                                                                                                        | text on a filled action or status                                    | crust                                                                                 |
| `needs-you`                                                                                                                                                        | the Needs-you pane, Home's count, since-marks, key caps              | peach                                                                                 |
| `changed`                                                                                                                                                          | changed since you read it                                            | mauve                                                                                 |
| `added`                                                                                                                                                            | new, added, done, success, the repository's mark                     | green                                                                                 |
| `removed`                                                                                                                                                          | wrong, removed, failed                                               | red                                                                                   |
| `caution`                                                                                                                                                          | warning, waiting                                                     | yellow                                                                                |
| `context`                                                                                                                                                          | context notes                                                        | blue                                                                                  |
| `yours`                                                                                                                                                            | your own messages in a session                                       | blue                                                                                  |
| `link`                                                                                                                                                             | links                                                                | blue                                                                                  |
| `working`                                                                                                                                                          | a running session's mark                                             | blue                                                                                  |
| `live`                                                                                                                                                             | a live window's double border and title                              | sapphire                                                                              |
| `example`                                                                                                                                                          | an example pane                                                      | teal                                                                                  |
| `sub-agent`                                                                                                                                                        | a sub-agent's mark                                                   | teal                                                                                  |
| `heading-1`, `heading-2`, `heading-3`                                                                                                                              | headings by level; deeper levels take `heading-3`                    | mauve, blue, green                                                                    |
| `code-inline`                                                                                                                                                      | inline code in markdown                                              | peach                                                                                 |
| `quote`                                                                                                                                                            | a markdown quote                                                     | subtext0                                                                              |
| `mode-normal`, `mode-insert`, `mode-visual`, `mode-replace`, `mode-command`                                                                                        | the status line's Vim mode                                           | blue, green, mauve, red, peach                                                        |
| `code-ground`                                                                                                                                                      | code's background                                                    | mantle                                                                                |
| `syntax-keyword`, `-string`, `-comment`, `-number`, `-constant`, `-function`, `-type`, `-operator`, `-property`, `-punctuation`, `-tag`, `-attribute`, `-variable` | code's tokens                                                        | mauve, green, dim, peach, peach, blue, yellow, cyan, lavender, dim, red, yellow, text |

Headings are the one change to Catppuccin's look: today they take `ink`.

## Picks in the browser

Kept in `localStorage`, as the colour scheme and the fonts are today.

| Key                  | Value                                         | Meaning                                                                   | Change                  |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------------- | ----------------------- |
| `uraeda.theme`       | `system`, `light`, or `dark`                  | the mode; `system` when absent                                            | Changed: was the scheme |
| `uraeda.theme.dark`  | a theme's id                                  | the dark theme; `catppuccin-mocha` when absent or unknown                 | New                     |
| `uraeda.theme.light` | a theme's id                                  | the light theme; `catppuccin-latte` when absent or unknown                | New                     |
| `uraeda.theme.drawn` | the resolved colours of the two picked themes | what the first paint and the sign-in page draw, before the server answers | New                     |

An earlier `uraeda.theme` of `mocha` reads as the mode `dark`, and `latte` as `light`, with the
default themes picked: the look does not change. A pick of `dark` or `light` already reads that way.
