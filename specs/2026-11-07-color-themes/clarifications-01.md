---
status: awaiting-human
---

# Clarifications, round 01: Color themes

> [!IMPORTANT]
>
> 8 questions, about 20 minutes.
>
> - Verdict: worth building, with changes: most official palettes fall under the contrast floor
>   somewhere, pi has no named theme, and Monokai's current version is paid.
> - Changes to the UI look decision: its intent names Catppuccin. Its contrast rule says "in every
>   scheme", which custom themes and several official palettes cannot meet as written.
> - Where the pick is kept and how light and dark are picked work together: both shape the
>   settings page and the leader key.
> - Heading colours: the proposal's "heading levels" would change every document's look; a
>   prototype shows it.
> - Monokai's name and pi's theme: two gaps in the proposal, one with a small legal question.
> - Check the settled points first: custom themes in `config.toml`, a broken theme that never
>   breaks the file, and Tokyo Night's light variant.

## Context

### Goal

A simple pick among the classic open source colour themes, split into light and dark, with pi's
new colours. Themes are typed by clear role names, and you can write your own in the settings
file. It is for your own comfort, in a tool you read for hours.

### Today

- One theme, Catppuccin: Latte in light mode, Mocha in dark mode, built at build time in
  [`theme.ts`](/packages/web/src/theme/theme.ts). Latte's accents are already darkened, to reach
  the contrast floor.
- The settings' Appearance and `Space u t` pick Mocha, Latte, or System, kept per browser in
  [`theme.tsx`](/packages/web/src/theme.tsx), as fonts are.
- Every view, the diagrams, and the code editor read colours through CSS variables. A palette can
  change at runtime with no rebuild: checked in Astryx's source.
- The [UI look](/specs/decisions/ui-look.md) decision: "Catppuccin colours", and every text colour
  at 4.5:1 and borders at 3:1 "in every scheme", checked by a test.

### Scope

- In: shipped themes, the pick of a light and a dark theme, custom themes in the settings file, and
  the roles a theme names. Also everything that draws colours: stories in specs, the sandbox bar,
  diagrams, the editor, and the browser's bar colour.
- Out: the `ura` TUI, which follows the terminal's theme by the [TUI](/specs/decisions/tui.md)
  decision. Also out: fonts, already picked per role; a theme per repository; and editing a custom
  theme in the web UI.

### Sources

- The code: the theme, its build, and its contrast test. Also the settings file in the core, the
  server's watch of it, the picker of fonts, Storybook's preview, and the sandbox bar.
- The products: Zed, VS Code, Ghostty, Helix, pi, opencode, Warp, GitHub, Obsidian, Claude Code,
  and Codex. Also Base16, Material 3, Radix, and Primer for role names.
- The palettes' official sources and licences: Catppuccin, Dracula, Tokyo Night, Monokai, Primer,
  pi, and seven other classics.
- The full investigation is in [discovery](discovery-01.md).

The [prototype](mockups/themes.html) draws one small Uraeda view in 27 candidate themes, in their
official colours. Under each, it lists the colours under 4.5:1 on the page. Several questions link
it.

## Check these

- **Custom themes are tables in `config.toml`**, `[themes.<name>]`, not files in a folder. The
  proposal says "in the conf file", and the [Settings](/specs/decisions/settings.md) decision keeps
  one file. Zed, Helix, and pi use a folder instead. See
  [discovery](discovery-01.md#a-custom-themes-format).
- **A broken custom theme never breaks the file**: a typo drops that theme only. The settings page
  shows its problem, and every other setting keeps applying. Claude Code ignores bad tokens the same
  way. Today an invalid value makes the whole file unreadable. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Tokyo Night's light theme is "Tokyo Night Light"**, from the original VS Code theme, not
  tokyonight.nvim's "Day". Day's accents sit at 3.0 to 4.3 and its text at 4.5; Light fails only
  on its comment. See [discovery](discovery-01.md#the-palettes).
- **pi's theme is its built-in dark and light**, revised in September 2026. Its new default,
  `system`, takes the terminal's own colours, so there is nothing to copy. pi sets no page colour,
  so its HTML export's page colour stands in. See
  [discovery](discovery-01.md#pi-has-no-named-default-theme).
- **The pickers**: the settings' Appearance holds the mode and a list per mode. `Space u t` opens a
  picker that previews each theme live as the cursor moves, and Escape restores the theme in use,
  as the font picker does. See [discovery](discovery-01.md#important-reads).
- **Catppuccin stays the default**: Mocha in dark mode, Latte in light mode. A stored `mocha`,
  `latte`, `dark`, or `light` keeps reading as today.

## Q1: Which themes ship?

The proposal names five families and pi, "…" leaving room for more. Several families have three or
four variants. Monokai has no free light variant. GitHub also has high-contrast themes for low
vision, at 7:1. Each theme is about 25 colours of data, plus the adjustment of those under the
floor (Q2). Compare them in the [prototype](mockups/themes.html). More in
[discovery](discovery-01.md#which-themes-ship).

Why it matters: each shipped theme is kept readable with every later view, and checked by the
contrast test.

- **A (recommended). The proposal's families and pi, with every free variant: 18 themes.**
  - Dark: Catppuccin Mocha, Macchiato, and Frappé; Dracula; Tokyo Night, Storm, and Moon; Monokai
    Classic; GitHub Dark, Dark Dimmed, and Dark High Contrast; pi dark.
  - Light: Catppuccin Latte; Alucard, Dracula's light variant; Tokyo Night Light; GitHub Light and
    Light High Contrast; pi light.
  - [pro] everything the proposal names, with a high-contrast pair for tired eyes.
  - [con] 6 dark themes for 1 light in each of Catppuccin and Tokyo Night.
  - Why recommended: it is the proposal as written, at a small cost per theme.
- **B. One dark and one light theme per family: 10 themes.**
  - Mocha and Latte, Dracula and Alucard, Tokyo Night and Tokyo Night Light, Monokai Classic, GitHub
    Dark and Light, pi dark and light.
  - [pro] a short list, each family's best-known pair.
  - [con] Catppuccin's and Tokyo Night's other variants, and high contrast, are gone.
- **C. A, plus Gruvbox, Nord, Rosé Pine, Kanagawa, One Dark and One Light, and Solarized: about
  30 themes.**
  - [pro] most classics are there from the start.
  - [con] Solarized, Rosé Pine Dawn, and One Light fail the floor nearly everywhere, by design.

**Answer:**

## Q2: What happens to an official colour under the contrast floor?

Example: Dracula's comment colour, `#6272A4`, is 3.0:1 on its page. Uraeda draws dimmed text, like
a date or a disabled row, in that role.

The UI look decision asks every text colour to reach 4.5:1 "in every scheme", checked by a test.
Today's Latte already breaks from the official one for this reason. Dracula's own spec asks for
4.5:1, and its comment fails it. Tokyo Night's comment fails in every variant, Monokai's red is 3.9,
and GitHub Dark Dimmed has six accents near 4.0. More in
[discovery](discovery-01.md#official-or-adjusted-colours).

Why it matters: a theme either looks exactly as its authors made it, or reads at the floor of the
rest of Uraeda.

- **A (recommended). Adjust only the colours under the floor, by the smallest step in lightness that
  reaches it, keeping the theme's name.**
  - Example: Dracula's dim text becomes a lighter blue-grey, about `#8090c0`, at 4.5:1.
  - [pro] the decision holds, and every theme reads alike.
  - [con] a purist sees a few colours off the published ones.
  - Why recommended: it is what Latte already does, and readability comes first in the UI guides.
- **B. Ship the official colours, the floor becoming a SHOULD for shipped themes.**
  - Example: Dracula's dim text stays `#6272A4`, at 3.0:1.
  - [pro] each theme looks exactly as published.
  - [con] dim text and some statuses get hard to read in several themes.
- **C. Ship only the themes that pass as published.**
  - Example: Dracula, Tokyo Night, Monokai, and Dark Dimmed are dropped.
  - [pro] faithful and readable.
  - [con] most of the proposal's list goes.

**Answer:**

## Q3: How are the light and the dark theme picked?

Example: you like Tokyo Night at night and GitHub Light by day, and your system switches at sunset.

Zed, GitHub, VS Code, Warp, Ghostty, and pi pick one theme per mode, with a mode that follows the
system or forces a side. Where the pick is kept is Q4. More in
[discovery](discovery-01.md#picking-light-and-dark).

Why it matters: it shapes the settings page, the leader key, and what a custom theme declares.

- **A (recommended). A mode, System, Light, or Dark, then a dark theme and a light theme, each from
  its own list.**
  - Example: Tokyo Night at night and GitHub Light by day, switching with the system.
  - [pro] the split the proposal asks for; most products do it.
  - [con] three controls where today has one.
  - Why recommended: it is the proposal's "split them in light vs dark", as products do it.
- **B. One theme from one list, its mode its own; System picks Mocha or Latte.**
  - Example: Tokyo Night all day, or Mocha and Latte with the system.
  - [pro] one control.
  - [con] following the system works only with Catppuccin.

**Answer:**

## Q4: Where is the pick of a theme kept?

Example: you use Uraeda on your laptop and your phone.

Today the scheme and the fonts are kept per browser: "each device picks its own". Custom themes
live in the settings file. The web reads that file only once signed in. A pick kept there needs a
copy in the browser, for the sign-in page and the first paint. More in
[discovery](discovery-01.md#where-the-pick-is-kept).

Why it matters: it decides whether a theme follows you across devices and dotfiles, or each device
keeps its own.

- **A (recommended). Per browser, as today and as fonts; custom themes are defined in the file and
  appear in every browser's lists.**
  - Example: the phone keeps GitHub Light while the laptop uses Dracula.
  - [pro] matches the fonts; the right theme from the first paint.
  - [con] a new device starts on Catppuccin.
  - Why recommended: appearance stays one model, per device, as the fonts already are.
- **B. In the settings file, `[appearance]`, the same on every device; the browser keeps a copy for
  the first paint.**
  - Example: the phone and the laptop both show Dracula, and so do your dotfiles.
  - [pro] one place, kept in dotfiles.
  - [con] fonts stay per browser, so appearance has two models.
- **C. The file holds the default, and a browser may override it.**
  - [pro] both.
  - [con] two places to look when a theme is not the one expected.

**Answer:**

## Q5: How much does a custom theme write?

Example: you want Mocha with a green accent, or a theme of your own from scratch.

Products range from about 20 keys (Warp) to over 400 (VS Code). Claude Code and Helix let a theme
inherit from another and write only what changes. Base16 is a 16-slot format that terminals use to
import hundreds of existing schemes. More in [discovery](discovery-01.md#a-custom-themes-format).

Why it matters: the format is a promise kept as Uraeda grows: a new role must not break old themes.

- **A (recommended). About 20 named roles, each optional, inheriting from a shipped theme of the
  same mode.**
  - The roles: `page`, `panel`, `sunken`, `raised`, `border`, `text`, `subtext`, `dim`, `accent`,
    `title`, the hues `red`, `orange`, `yellow`, `green`, `teal`, `cyan`, `blue`, `purple`, `pink`,
    and the heading and syntax roles if Q7 adds them. Everything else, tints and text on filled
    colours, is derived.
  - Example: `[themes.my-mocha]`, `mode = "dark"`, `extends = "catppuccin-mocha"`,
    `accent = "#a6e3a1"`.
  - [pro] one line for a tweak; typed names, as the proposal asks.
  - [con] an existing scheme is copied by hand.
  - Why recommended: it is the proposal's typed roles, and inheritance keeps old themes valid.
- **B. Base16 or Base24 slots, `base00` to `base0F`.**
  - Example: paste a scheme from the tinted-theming collection.
  - [pro] hundreds of schemes, as written.
  - [con] slot numbers, not role names; no partial theme.
- **C. Every token Uraeda uses, about 100.**
  - [pro] full control.
  - [con] long to write, and a theme breaks when a token is added.

**Answer:**

## Q6: What happens to a custom theme under the contrast floor?

Example: your custom theme's dim text is 3:1 on its page.

No product checks a custom theme's contrast on load. Ghostty and VS Code's terminal raise colours
at draw time instead. The UI look decision's floor, "in every scheme", is checked by a test, which
cannot see a theme you write. More in
[discovery](discovery-01.md#a-custom-theme-under-the-floor).

Why it matters: it changes the UI look decision, and decides who has the last word on your colours.

- **A (recommended). Apply it, and list each pair under the floor on the settings page; the floor
  covers shipped themes only.**
  - Example: the theme applies; the page says "dim text is 3.0:1 on page, under 4.5".
  - [pro] your colours, as written, and you know what reads poorly.
  - [con] a custom theme may be hard to read.
  - Why recommended: it is your own choice, and the page says what it costs.
- **B. Refuse it, falling back to the default of its mode.**
  - [pro] the floor holds everywhere.
  - [con] a theme you wrote does not apply.
- **C. Apply it, raising each colour under the floor at runtime.**
  - [pro] always readable.
  - [con] the colours drawn are not the ones written.

**Answer:**

## Q7: Should headings take a colour per level?

Example: a spec's `# Title` in purple, its `## Stories` in blue, and `### US1` in green, as in
the [prototype](mockups/themes.html). Its checkbox turns heading colours off.

The proposal names "heading levels/hierarchy" among the theme's colours. Headings are drawn in the
text's colour today, set apart by size and weight. Terminal editors' markdown views often colour
each level, and pi's themes have an `mdHeading` role. More in
[discovery](discovery-01.md#heading-colours).

Why it matters: it changes the look of every document, question, and spec.

- **A (recommended). Each level takes its own hue from the theme, the same three in every theme:
  purple, blue, green.**
  - [pro] the hierarchy reads at a glance, as the proposal suggests.
  - [con] documents look busier.
  - Why recommended: the proposal names it, and the prototype shows the hierarchy reading at a
    glance. A heading under the floor follows Q2's answer.
- **B. Heading roles exist, in the text's colour by default; a custom theme may colour them.**
  - [pro] today's look stays.
  - [con] shipped themes never show a hierarchy by colour.
- **C. No heading roles: headings stay the text's colour.**
  - [pro] fewest roles.
  - [con] leaves out what the proposal names.

**Answer:**

## Q8: Under which name does Monokai ship?

Monokai Pro, the current Monokai, is paid and "may not be sub-licensed, resold, or redistributed".
The classic colours of 2006 are in VS Code's built-in Monokai, under MIT. Monokai's site calls
others' versions "Monokai-inspired". Whether the name is a registered trademark was not checked.
More in [discovery](discovery-01.md#monokai-is-paid-today-and-its-name-is-not-free).

Why it matters: it is the one theme whose name carries a legal question, if Uraeda ships publicly.

- **A (recommended). "Monokai Classic", from VS Code's MIT port, crediting Wimer Hazenberg.**
  - [pro] recognised at once; the colours' source is MIT.
  - [con] the name is not cleared.
  - Why recommended: VS Code ships it under the same name, and the risk is small for a free tool.
- **B. A neutral name, such as "Classic 2006", with the same colours.**
  - [pro] no name to clear.
  - [con] harder to recognise in the list.
- **C. No Monokai.**
  - [pro] no question at all.
  - [con] one of the proposal's families goes.

**Answer:**

## Settled without the human

### Behaviour

- **Following the system** keeps reading `prefers-color-scheme`, switching at once. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **A picked theme that no longer exists**, a custom one removed from the file, falls back to the
  default of its mode.
- **Syntax colours** come from the theme's hues, as today's do from Catppuccin's; a custom theme
  may override them. pi and opencode both keep 9 syntax roles.
- **The frosted glass** keeps its own amber tint over the page's colour, so it follows any theme,
  as the UI guides ask.
- **Stories in a spec, the sandbox bar, diagrams, and the code editor** follow the theme picked.
- **The browser's bar colour**, `theme-color`, follows the page colour of the theme in use.
- **A hand edit of a custom theme** applies at once, as the settings file is already watched.

### Under the hood

- **Colours split from structure**: the built Astryx theme keeps sizes, fonts, and component rules.
  Each theme is a palette of roles, mapped to Astryx's tokens in one module. It is applied as one
  rule over the built theme. Checked in Astryx's source; the plan's first task checks it in the app. See
  [discovery](discovery-01.md#astryx).
- **Custom themes are parsed and validated in the Rust core**, as the Settings decision asks, and
  reach the web through the server's settings.
- **The first paint** applies the stored theme from a blocking script in `index.html`. A custom
  theme's colours are kept in the browser too, for the sign-in page.
- **The contrast test** measures every shipped theme's palette, at 4.5:1 for text and 3:1 for
  borders and controls.

**Notes:**
