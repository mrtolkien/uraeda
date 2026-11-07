---
status: answered
---

# Clarifications, round 01: Color themes

> [!NOTE]
>
> Answered on 2026-11-07.
>
> - Verdict: worth building, with changes: most official palettes fall under the contrast floor
>   somewhere, pi has no named theme, and Monokai's current version is paid.
> - Rewritten since your answers: the theme's roles are named by meaning, not by colour, and themes
>   are their own files. Three questions are new.
> - What views ask for, the file's place, and its format work together: they make the format you and
>   every shipped theme write.
> - Changes to two decisions: UI look names Catppuccin and a floor "in every scheme"; Settings keeps
>   one file, which theme files need a rule beside.
> - Today's look stays: Catppuccin maps one to one onto the new roles, checked by a test.
> - Check the settled points first: a broken theme never breaks anything else, and Tokyo Night's
>   light variant.

## Context

### Goal

A simple pick among the classic open source colour themes, split into light and dark, with pi's new
colours. Themes are typed by clear role names, and you can write your own, each in its own file. It
is for your own comfort, in a tool you read for hours.

### Today

- One theme, Catppuccin: Latte in light mode, Mocha in dark mode, built at build time in
  [`theme.ts`](/packages/web/src/theme/theme.ts). Latte's accents are already darkened, to reach the
  contrast floor.
- The settings' Appearance and `Space u t` pick Mocha, Latte, or System, kept per browser in
  [`theme.tsx`](/packages/web/src/theme.tsx), as fonts are.
- Every view, the diagrams, and the code editor read colours through CSS variables. A palette can
  change at runtime with no rebuild: checked in Astryx's source.
- The [UI look](/specs/decisions/ui-look.md) decision: "Catppuccin colours", and every text colour
  at 4.5:1 and borders at 3:1 "in every scheme", checked by a test.

### Scope

- In: shipped themes, the pick of a light and a dark theme, custom themes in their own files, and
  the roles a theme names. Also everything that draws colours: stories in specs, the sandbox bar,
  diagrams, the editor, and the browser's bar colour.
- Out: the `ura` TUI, which follows the terminal's theme by the [TUI](/specs/decisions/tui.md)
  decision. Also out: fonts, already picked per role; a theme per repository; and editing a custom
  theme in the web UI.

### Sources

- The code: the theme, its build, and its contrast test. Also the settings file in the core, the
  server's watch of it, the picker of fonts, Storybook's preview, and the sandbox bar.
- The products: Zed, VS Code, Ghostty, Helix, pi, opencode, Warp, GitHub, Obsidian, Claude Code, and
  Codex. Also Base16, Material 3, Radix, and Primer for role names.
- The palettes' official sources and licences: Catppuccin, Dracula, Tokyo Night, Monokai, Primer,
  pi, and seven other classics.
- The full investigation is in [discovery](discovery-01.md).

The prototype (`mockups/themes.html`, deleted) draws one small Uraeda view in 27 candidate themes,
in their official colours. Under each, it lists the colours under 4.5:1 on the page. Several
questions link it.

## Check these

- **A broken theme file never breaks anything else**: a typo drops that theme only. The settings
  page shows its problem, and every other theme and setting keeps applying. Claude Code ignores bad
  tokens the same way. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Shipped themes are written in the same format as yours**, so one is a starting point to copy.
  See [discovery](discovery-01.md#themes-as-their-own-files).
- **Tokyo Night's light theme is "Tokyo Night Light"**, from the original VS Code theme, not
  tokyonight.nvim's "Day". Day's accents sit at 3.0 to 4.3 and its text at 4.5; Light fails only on
  its comment. See [discovery](discovery-01.md#the-palettes).
- **pi's theme is its built-in dark and light**, revised in September 2026. Its new default,
  `system`, takes the terminal's own colours, so there is nothing to copy. pi sets no page colour,
  so its HTML export's page colour stands in. See
  [discovery](discovery-01.md#pi-has-no-named-default-theme).
- **The pickers**: the settings' Appearance holds the mode and a list per mode. `Space u t` opens a
  picker that previews each theme live as the cursor moves, and Escape restores the theme in use, as
  the font picker does. See [discovery](discovery-01.md#important-reads).
- **Catppuccin stays the default**: Mocha in dark mode, Latte in light mode. A stored `mocha`,
  `latte`, `dark`, or `light` keeps reading as today.

## Q1: Which themes ship?

The proposal names five families and pi, "…" leaving room for more. Several families have three or
four variants. Monokai has no free light variant. GitHub also has high-contrast themes for low
vision, at 7:1. Each theme is about 25 colours of data, plus the adjustment of those under the floor
(Q2). Compare them in the prototype (`mockups/themes.html`, deleted). More in
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
- **C. A, plus Gruvbox, Nord, Rosé Pine, Kanagawa, One Dark and One Light, and Solarized: about 30
  themes.**
  - [pro] most classics are there from the start.
  - [con] Solarized, Rosé Pine Dawn, and One Light fail the floor nearly everywhere, by design.

**Answer:** C: The contrast rule only applies to the default themes

## Q2: What happens to an official colour under the contrast floor?

Example: Dracula's comment colour, `#6272A4`, is 3.0:1 on its page. Uraeda draws dimmed text, like a
date or a disabled row, in that role.

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

**Answer:** A

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

**Answer:** A

## Q4: Where is the pick of a theme kept?

Example: you use Uraeda on your laptop and your phone.

Today the scheme and the fonts are kept per browser: "each device picks its own". Custom themes live
in the settings file. The web reads that file only once signed in. A pick kept there needs a copy in
the browser, for the sign-in page and the first paint. More in
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

**Answer:** A

## Q5: What does a theme name, and what do views ask for?

Example: Dracula wants what needs you in pink and pane titles in purple. Today a view asks for
"orange" to draw what needs you, so Dracula can make it pink only by making everything orange pink.

Every tool compared works in two layers. A theme defines its own palette, private and freely named.
It then maps it onto public tokens, named by where they draw or what they mean. Neovim names its
groups `FloatBorder`, `Visual`, `StatusLine`, `@markup.heading.1`. VS Code has `focusBorder`,
`button.background`, `list.activeSelectionBackground`. Catppuccin's Neovim port sets `Title` to its
blue and `Visual` to its surface1; another theme fills the same groups otherwise. None asks a view
for a hue. Uraeda's views do today, in about 90 places. More in
[discovery](discovery-01.md#how-themes-name-their-tokens) and
[what each colour means today](discovery-01.md#what-each-colour-means-today).

The roles below come from what the views already mean. "Today" is Mocha's value: Catppuccin maps one
to one, and today's look stays.

| Role                                                        | Where it draws, what it says                                    | Today                          |
| ----------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| `page`                                                      | the ground behind everything                                    | base                           |
| `raised`                                                    | popovers, code blocks, a pane's surface                         | mantle                         |
| `sunken`                                                    | a well below the page                                           | crust                          |
| `chip`                                                      | a neutral filled mark: a grey badge, a skeleton                 | surface0                       |
| `cursor-row`                                                | the row under the cursor, or picked                             | mauve tint                     |
| `marked`                                                    | the block selected in a review                                  | yellow tint                    |
| `rule`                                                      | panes' borders, dividers, fields                                | overlay0                       |
| `pane-title`                                                | a pane's title in its border                                    | lavender                       |
| `ink`, `ink-quiet`, `ink-faint`                             | body text; what reads second; disabled and faint text           | text, subtext0, dim            |
| `action`, `on-action`                                       | what can be pressed: a button, focus, the active pane; its text | mauve, crust                   |
| `needs-you`                                                 | the Needs-you pane, Home's count, since-marks, key caps         | peach                          |
| `changed`                                                   | changed since you read it                                       | mauve                          |
| `added`, `removed`, `caution`                               | new or done; wrong or removed; warning or waiting               | green, red, yellow             |
| `context`, `yours`, `link`                                  | context notes; your messages in a session; links                | blue                           |
| `working`, `live`                                           | a running session's mark; a live window's double border         | blue, sapphire                 |
| `example`, `sub-agent`                                      | an example pane; a sub-agent's mark                             | teal                           |
| `heading-1` to `heading-3`                                  | heading levels, coloured as Q7's answer asks                    | new                            |
| `code-inline`, `quote`                                      | markdown's inline code and quotes                               | peach, subtext0                |
| `mode-normal`, `-insert`, `-visual`, `-replace`, `-command` | the status line's Vim mode                                      | blue, green, mauve, red, peach |
| `code-ground` and 13 `syntax-*`                             | code: keyword, string, comment, function, type, and so on       | as today                       |

Everything else is derived, as today: tints, hover, icons, diff lines, and text on filled marks.
Every role is optional, filled from the theme a file extends.

Why it matters: the views move from hues to meanings once, in about 90 places. After that, a theme's
character is its own mapping, and a new view picks a meaning, not a colour.

C can come on top of A.

- **A (recommended). Views ask for about 50 roles named by meaning, as in the table. A theme maps
  its own palette onto them. Catppuccin's mapping gives today's values exactly.**
  - Example: Dracula sets `needs-you = "pink"`, and only what needs you turns pink.
  - [pro] each theme decides what every meaning looks like; a test checks Catppuccin against today's
    values.
  - [con] about 90 places in the views change, and 50 roles to know.
  - Why recommended: it is how Neovim and VS Code themes get their character, and it keeps today's
    look.
- **B. About 20 coarser roles: `needs-you` and `caution` merge, `changed` is `action`, `context`,
  `working`, `live`, and `example` merge into one `notice`.**
  - Example: Dracula's pink for what needs you also colours warnings.
  - [pro] a shorter list to write.
  - [con] fewer distinctions a theme can draw; today's look shifts where meanings merge.
- **C. On top of A, optional tokens per component, as Primer's third tier: `pane.border.needs-you`,
  `status-line.mode-insert.fill`.**
  - Example: Dracula draws the Needs-you pane's border pink, but its count in Home in red.
  - [pro] the finest control.
  - [con] a second vocabulary to keep stable as components change.

**Answer:** A

## Q6: What happens to a custom theme under the contrast floor?

Example: your custom theme's dim text is 3:1 on its page.

No product checks a custom theme's contrast on load. Ghostty and VS Code's terminal raise colours at
draw time instead. The UI look decision's floor, "in every scheme", is checked by a test, which
cannot see a theme you write. More in [discovery](discovery-01.md#a-custom-theme-under-the-floor).

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

**Answer:** A

## Q7: Should headings take a colour per level?

Example: a spec's `# Title` in purple, its `## Stories` in blue, and `### US1` in green, as in the
prototype (`mockups/themes.html`, deleted). Its checkbox turns heading colours off.

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

**Answer:** A: See comment below, I want color per heading level but not naming colors

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

**Answer:** C

## Q9: Where do theme files live, and how does the Settings decision change?

Example: you write `ember.toml` and copy `dracula.toml` to tweak it.

You asked for a theme per file, as Zed, Helix, Ghostty, pi, and Claude Code do. The
[Settings](/specs/decisions/settings.md) decision says "Settings MUST live in one TOML file in the
config folder", and applies to any feature that adds a file there. A theme is not a setting you
pick, so a rule of its own fits. pi loads a repository's themes only once you trust it. More in
[discovery](discovery-01.md#where-theme-files-live).

Why it matters: it changes an active decision, and decides whether anything but you can restyle your
UI.

- **A (recommended). One file per theme in `themes/`, in Uraeda's config folder beside
  `config.toml`. The Settings decision gains a rule: themes live there, read and validated by the
  core, never from a repository.**
  - Example: `~/.config/uraeda/themes/ember.toml` shows in the dark list as soon as it is saved.
  - [pro] your dotfiles hold your themes; nothing else can restyle the UI.
  - [con] a theme cannot travel with a repository.
  - Why recommended: it is what you asked, with the one guard the decision exists for kept.
- **B. A, plus a `themes/` folder in each repository, offered in the lists while it is open.**
  - Example: a team's `ember.toml` shows for everyone who opens the repository.
  - [pro] a team shares its theme.
  - [con] any repository you open could offer a theme that hides a warning in the page's colour.
- **C. Themes as tables in `config.toml`, the decision unchanged.**
  - [pro] one file, no decision change.
  - [con] a long settings file, against what you asked.

**Answer:** A

## Q10: In which format is a theme file written?

Example: a theme that keeps Mocha and turns what needs you to an ember orange.

No shared format fits a private palette, roles, and `extends`. Helix's TOML comes closest:
`inherits`, a `[palette]` of free names, and keys pointing to them. DTCG 2025.10 is the design-token
standard, but a colour is an object, and light and dark need a second file. No app was found whose
users write it by hand. pi uses JSON with `vars`. A JSON Schema gives completion and checks in TOML,
through Taplo's `#:schema` line. More in [discovery](discovery-01.md#theme-file-formats).

Why it matters: it is the format you, and every shipped theme, write from now on.

- **A (recommended). TOML in Helix's shape, with a published JSON Schema for completion.**

  ```toml
  #:schema https://uraeda.dev/schemas/theme.json
  name = "Ember"
  mode = "dark"
  extends = "catppuccin-mocha"

  [palette]
  ember = "#ff7a45"

  [roles]
  needs-you = "ember"
  ```

  - [pro] the settings' language; comments; short to write.
  - [con] one more format of its own, as every tool has.
  - Why recommended: it is Helix's proven shape, in the language of your settings file.

- **B. DTCG 2025.10 JSON, the design-token standard.**

  ```json
  {
    "palette": {
      "ember": {
        "$type": "color",
        "$value": { "colorSpace": "srgb", "components": [1, 0.48, 0.27], "hex": "#ff7a45" }
      }
    },
    "roles": { "needs-you": { "$value": "{palette.ember}" } }
  }
  ```

  - [pro] a standard, with tools that convert it.
  - [con] long to write by hand, and its modes need a resolver file.

- **C. JSON in pi's shape, `vars` and `colors`, with `extends` added.**
  - [pro] a pi theme's palette pastes in.
  - [con] no comments, unlike the settings file.

**Answer:** A

## Q11: Should a theme read an existing Base16 or Base24 scheme?

Example: you like Ayu Dark, one of 600 schemes in the tinted-theming collection.

Base16 and Base24 schemes are YAML files of 16 or 24 numbered colours, `base00` to `base17`, with a
light or dark `variant`. Terminals and editors import them by the hundred. They have no roles: an
app maps `base08`, red, to its own meanings. More in [discovery](discovery-01.md#existing-schemes).

Why it matters: it trades a dependency and a shared mapping for 600 themes at once.

- **A (recommended). No import: a scheme's colours are pasted into `[palette]`, under any names, and
  mapped to roles by hand.**
  - Example: Ayu Dark's 16 lines become the palette; its roles say what each colour means.
  - [pro] no dependency; each theme keeps a mapping of its own.
  - [con] one scheme at a time, by hand.
  - Why recommended: you asked for each look to be its own, which a shared mapping works against.
- **B. A theme may name a Base16 or Base24 file as its palette, mapped by a default mapping it can
  override.**
  - Example: `palette-from = "ayu-dark.yaml"`, and Ayu Dark is in the dark list.
  - [pro] 600 schemes in reach, through the `tinted-builder` crate.
  - [con] a dependency, and schemes that look alike under one mapping.

**Answer:** A

## Settled without the human

### Behaviour

- **Following the system** keeps reading `prefers-color-scheme`, switching at once. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **A picked theme that no longer exists**, a custom one whose file is gone, falls back to the
  default of its mode.
- **Syntax colours** come from the theme's hues, as today's do from Catppuccin's; a custom theme may
  override them. pi and opencode both keep 9 syntax roles.
- **The frosted glass** keeps its own amber tint over the page's colour, so it follows any theme, as
  the UI guides ask.
- **Stories in a spec, the sandbox bar, diagrams, and the code editor** follow the theme picked.
- **The browser's bar colour**, `theme-color`, follows the page colour of the theme in use.
- **A hand edit of a custom theme** applies at once: its folder is watched, as the settings file
  already is.

### Under the hood

- **Colours split from structure**: the built Astryx theme keeps sizes, fonts, and component rules.
  Each theme is a palette of roles, mapped to Astryx's tokens in one module. It is applied as one
  rule over the built theme. Checked in Astryx's source; the plan's first task checks it in the app.
  See [discovery](discovery-01.md#astryx).
- **Custom themes are parsed and validated in the Rust core**, as settings are, and reach the web
  through the server.
- **The first paint** applies the stored theme from a blocking script in `index.html`. A custom
  theme's colours are kept in the browser too, for the sign-in page.
- **The contrast test** measures every shipped theme's palette, at 4.5:1 for text and 3:1 for
  borders and controls.

**Notes:** Remove the “pi theme” it indeed doesn’t exist, they generate it on the fly from terminal
colors.
