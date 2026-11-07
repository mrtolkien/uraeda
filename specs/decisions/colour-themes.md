---
status: active
approved-by: mrtolkien
icon: swatch-book
---

# Colour themes

The web UI's colours come from a colour theme, picked per device, one for light mode and one for
dark mode. Views ask for a colour by what it means, never by its hue, so each theme gives every
meaning a look of its own. Catppuccin stays the default, with the look it has today.

## Rules

- A view MUST ask for a colour by its role, named for where it draws or what it means, never by a
  hue. Checked by lint.
- A theme MUST map its own private palette onto the roles, inheriting every role it leaves out from
  the theme it extends.
- Shipped themes and the user's themes MUST share one format, a TOML file per theme. Checked by the
  core's tests.
- A shipped theme MUST keep its published colours, except the smallest change in lightness that
  brings a colour to the contrast floor. Checked by a test of the shipped themes.
- A theme of the user's MUST apply as written, the settings page naming each colour under the
  contrast floor.
- A broken theme MUST NOT stop any other theme or setting from applying.
- Headings SHOULD take a colour per level, from their own roles.
- The picked themes SHOULD be kept per device, as the fonts are.

## Why

A view asking for "orange" ties every meaning that shares the hue: no theme could draw what needs
the human apart from a key cap. Themes in Neovim and VS Code get their character from mapping their
palette onto named places, and a shared format makes a shipped theme a file to copy. Shipped themes
read at the floor; a user's own colours are their choice. History:
[Color themes](../2026-11-07-color-themes/spec.md).

## Alternatives considered

- Roles named by hue, `red` or `blue`: each theme looks like a recoloured Catppuccin.
- The design-token standard, DTCG: a colour is an object, and light and dark need a second file.
- Importing Base16 and Base24 schemes: 600 schemes under one mapping, which look alike.

## Consequences

- A new view picks a role, or adds one to every shipped theme at once.
- Some shipped themes differ from their published colours where those fall under the floor.
- A theme of the user's may be hard to read: the settings page says where.

## Applies to

- [`packages/web/`](/packages/web/): its theme, its views, and every feature that draws a colour
- [`crates/core/`](/crates/core/): reading and checking theme files
