---
icon: swatch-book
---

# Colour themes

> "Create clearly named tokens, with a logical sense (explaining where it’s used and what it
> conveys) and not a color name"

A colour theme gives the UI its colours: the human picks one for light mode and one for dark mode. A
role is the name a view asks a colour by, such as `needs-you` or `heading-1`, and each theme maps
its own palette onto the roles. [Look and feel](../ui/look-and-feel.md#colours) says what the main
roles mean, and [the app's reference](/docs/app.md) how a theme's file is written.

## Rules

- A view asks for a colour by its role, named for where it draws or what it means, never by a hue.
  _So:_ what needs the human is drawn in `needs-you`, which Catppuccin makes orange and another
  theme pink, and a colour no role names adds a role to every shipped theme.
- Every shipped theme, one that comes with the app, reads at the contrast floor: text at 4.5:1
  against its background, borders and controls at 3:1. _So:_ Dracula's dim text, 3.0:1 as published,
  ships a little lighter, by the smallest change in lightness that reaches the floor.
- A theme the user writes applies as written, in the same file format as the shipped themes. _So:_ a
  custom theme whose dim text is 3:1 is drawn as it is, and the settings page names the colours
  under the floor.

## Why

A view that asks for "orange" ties together every meaning that shares the hue: no theme can then
draw what needs the human apart from a key. Roles named for a place or a meaning let each theme look
like itself, as themes do in Neovim and VS Code. The UI is read for hours, so what ships reads at
the floor, and a user's own colours are their choice. History:
[Color themes](../done/2026-11-07-color-themes.md).

## Alternatives considered

- Roles named by hue, `red` or `blue`: every theme looks like a recoloured Catppuccin.

## Applies to

- [`app/`](/app/): its tokens, and every feature that draws a colour
- [`crates/core/`](/crates/core/): reading and checking theme files
