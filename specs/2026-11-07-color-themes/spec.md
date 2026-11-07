---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Color themes

> [!IMPORTANT]
>
> Spec to review, about 20 minutes.
>
> - You approve 28 shipped colour themes, picked per device as one for light mode and one for dark
>   mode, and your own themes as TOML files. Each theme maps its own palette onto about 50 roles
>   named by meaning, which every view asks for instead of a hue.
> - A new decision, Colour themes, and changes to UI look (no more "Catppuccin colours"; the floor
>   covers shipped themes) and Settings (a themes folder beside the settings file).
> - Today's look stays: Catppuccin maps one to one onto the roles, checked by a test. Headings are
>   the one change: a colour per level, mauve, blue, then green.
> - Read one way: "the contrast rule only applies to the default themes" reads as the shipped
>   themes, against yours. Their colours under the floor move by the smallest step that reaches it.
> - Not run yet: a palette rule winning over the built theme in every surface, read in Astryx's
>   source. The plan's first task checks it; if it fails, each theme is built as its own stylesheet.
> - Risk tier `medium`: a new file format and about 90 places in the views that change.

Uraeda's web UI gets the classic open source colour themes, split into light and dark, and lets you
write your own, so the tool you read for hours looks the way you like. Views stop asking for hues:
they ask for what a colour means, and each theme decides how that meaning looks. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## Decisions

- **New: [Colour themes](../decisions/colour-themes.md)**. Views ask for a colour by its role, never
  a hue; themes map a private palette onto the roles in one TOML format; shipped themes keep their
  published colours except where the floor moves them; yours apply as written.
- **Changed: [UI look](../decisions/ui-look.md)**. Colours come from the colour theme picked, not
  Catppuccin; the contrast floor covers every shipped theme; the rule on named schemes moves to
  Colour themes.
- **Changed: [Settings](../decisions/settings.md)**. Theme files live one per file in a folder
  beside the settings file, read and checked by the core, never from a repository.

Relied on:

| Decision                                       | What it means for this spec                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| [UI components](../decisions/ui-components.md) | views are styled only through the theme; the palette rule lives in it         |
| [Preview](../decisions/preview.md)             | the mockups are stories; story frames in a spec follow the picked theme       |
| [Keyboard](../decisions/keyboard.md)           | the picker and the mode key join the leader tree under `Space u`              |
| [TUI](../decisions/tui.md)                     | `ura`'s screens keep the terminal's colours: this feature does not touch them |

## User stories

### US1: Pick a theme for each mode (P1)

In the settings' Appearance, you pick a mode, System, Light, or Dark, then a dark theme and a light
theme, each from its own list. Each device keeps its own picks, as it keeps its fonts.

[Appearance](/packages/web/src/ThemeMockups.stories.tsx#AppearanceSection)

The dark list holds Catppuccin Mocha, Macchiato, and Frappé; Dracula; GitHub Dark, Dark Dimmed, and
Dark High Contrast; Gruvbox Dark; Kanagawa Wave and Dragon; Nord; One Dark; Rosé Pine and Rosé Pine
Moon; Solarized Dark; Tokyo Night, Storm, and Moon. The light list holds Catppuccin Latte; Alucard,
Dracula's light variant; GitHub Light and Light High Contrast; Gruvbox Light; Kanagawa Lotus; One
Light; Rosé Pine Dawn; Solarized Light; Tokyo Night Light. Your themes follow, marked "yours".

Key scenarios:

1. **Given** the mode System, the dark theme Tokyo Night, and the light theme GitHub Light, **When**
   the system switches to dark at sunset, **Then** the page redraws in Tokyo Night at once.
2. **Given** a laptop on Dracula, **When** you open Uraeda on your phone for the first time,
   **Then** the phone shows Catppuccin, its own default, and the laptop keeps Dracula.
3. **Given** a browser where Mocha was picked before this feature, **When** it loads the new
   version, **Then** it shows Catppuccin Mocha in the mode Dark: nothing changes on screen.

More scenarios:

1. **Given** Dracula picked, **When** the page reloads, **Then** its first frame is Dracula's, the
   sign-in page included.
2. **Given** Dracula picked, **When** a spec's story frame or the sandbox bar draws, **Then** it is
   in Dracula too.

### US2: Try themes from the keyboard (P2)

`Space u t` opens a picker of every theme, dark ones first, the two in use marked. Moving the cursor
redraws the whole app in the theme under it; Enter keeps it, Escape puts back the one in use.
`Space u m` cycles the mode: System, Light, Dark.

[Theme picker](/packages/web/src/ThemeMockups.stories.tsx#ThemePicker)

Key scenarios:

1. **Given** Catppuccin Mocha in use in dark mode, **When** you open `Space u t` and move to Nord,
   **Then** the app is drawn in Nord; Escape draws it in Mocha again.
2. **Given** dark mode, **When** you pick Rosé Pine Dawn, a light theme, **Then** it becomes the
   light theme, and the mode becomes Light so you see it.

### US3: Write a theme of your own (P2)

A TOML file in `~/.config/uraeda/themes/` names its mode, the theme it extends, its own palette, and
the roles it changes. It shows in its mode's list as soon as it is saved. The Appearance section
lists your files, with each one's problems.

[Appearance, with your themes](/packages/web/src/ThemeMockups.stories.tsx#AppearanceSection)

[No theme of yours yet](/packages/web/src/ThemeMockups.stories.tsx#NoThemesYet)

The format and the roles are in the [data model](data-model.md#theme-file). An existing scheme, such
as a Base16 one, is pasted into the palette and mapped to roles by hand: no importer.

Key scenarios:

1. **Given** `ember.toml` extending Catppuccin Mocha with `needs-you = "ember"`, `#ff7a45`, **When**
   it is saved, **Then** "Ember · yours" joins the dark list, and in Ember only what needs you turns
   ember: key caps and since-marks included, nothing else.
2. **Given** Ember in use, **When** you change `ember` to `#ff5500` and save, **Then** the page
   redraws within a second.
3. **Given** `dusk.toml` whose `ink-faint` is 3.1:1 on its page, **When** it is picked, **Then** it
   applies as written, and its row says "ink-faint is 3.1:1 on page, under 4.5."

More scenarios:

1. **Given** `broken.toml` whose `needs-you` names `embr`, missing from its palette, **When** it is
   saved, **Then** that role keeps the colour of the theme it extends, and its row says "Line 9:
   needs-you names "embr", which is not in the palette."

### US4: Headings take a colour per level (P3)

Headings of documents, rounds, specs, and messages take a colour per level, from the roles
`heading-1` to `heading-3`; deeper levels take `heading-3`. Catppuccin draws them mauve, blue, then
green. The editor's markdown follows the same roles.

[Headings by level](/packages/web/src/ThemeMockups.stories.tsx#HeadingsByLevel)

Key scenarios:

1. **Given** a spec open in Catppuccin Mocha, **When** it draws, **Then** `# Spec` is mauve,
   `## User stories` blue, and `### US1` green.
2. **Given** a theme of yours setting `heading-2` to its palette's `gold`, **When** a spec draws,
   **Then** its `##` headings are gold, and the others keep the extended theme's colours.

## Replaced behaviour

- **The colour scheme is Mocha, Latte, or System, in one control.** Guarded by
  `__tests__/categories.test.ts`, its "Colour scheme" rows, and `__tests__/theme.test.ts`, "the
  stored value %j reads as %s".
- **`Space u t` cycles Mocha, Latte, then System.** Guarded by
  `__tests__/keys-leader-tree.test.tsx`, "Space u t cycles the theme: Mocha, Latte, then System
  (ruling R61)".
- **The contrast test reads the built stylesheet's two slots, Latte and Mocha.** Guarded by every
  test of `__tests__/theme-tokens.test.ts`, which measure each shipped theme instead.
- **Headings are drawn in the text's colour, and the editor's in mauve.** Guarded by no test.

## Architecture

The built Astryx theme keeps everything but colour, and keeps Catppuccin's values as its defaults. A
theme is resolved to roles, roles to tokens, and the tokens are applied as one rule over the built
theme, which wins in every surface that reads the theme. Views read roles only. See
[Astryx](discovery-01.md#astryx) and
[how themes name their tokens](discovery-01.md#how-themes-name-their-tokens).

- **Theme files**, in the core, read the shipped themes and yours, resolve `extends` and palette
  names into a full set of roles, and report each problem with its line. They own the format, the
  role list, and the contrast check of role pairs.
- **The themes' watch**, in the server, watches the themes folder as the settings file is watched,
  and serves the resolved themes and their problems.
- **The role mapping**, in the web's theme, turns a theme's roles into Astryx's tokens and the
  views' role variables. It owns every derived colour: tints, hover, icons, diff lines, text on
  fills.
- **The palette rule** applies the mapped tokens over the built theme, and the first paint's script
  applies the browser's cached copy before React starts.
- **Theme picks**, in the web, keep the mode and the two themes per browser, read old picks, and
  cache the drawn colours.
- **The views** ask for roles, and lint refuses a hue token outside the theme.
- **Appearance, the picker, and the mode key** show and change the picks. Story frames and the
  sandbox bar receive the theme's colours with the mode.

Tradeoffs:

- About 90 places in the views move from hues to roles, once.
- The first visit on a device paints Catppuccin until the server answers, when another theme was
  never picked there.
- Adjusted shipped themes differ slightly from their published colours.

## Edge cases

| Importance | Situation                                                         | What happens                                                                                            |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| High       | A theme file is not valid TOML                                    | it leaves the lists; its row says "Could not read: line 4: …"; a browser on it shows its mode's default |
| High       | A role names a palette entry that does not exist, or a bad colour | that role keeps the extended theme's colour; the row names the line and the role                        |
| High       | A picked theme of yours is deleted                                | the browser shows the default of that mode, and its list too                                            |
| Normal     | `extends` names an unknown theme                                  | the theme extends its mode's default; the row says "extends "x", which no theme is called"              |
| Normal     | `extends` loops, `a` → `b` → `a`                                  | both leave the lists; each row says "extends forms a loop: a → b → a"                                   |
| Normal     | `extends` names a theme of the other mode                         | the theme leaves the lists; the row says the two modes differ                                           |
| Normal     | No `mode` and no `extends`                                        | the theme leaves the lists; the row says "Give it mode = "dark" or "light"."                            |
| Normal     | A file of yours has a shipped theme's name, `dracula.toml`        | it leaves the lists; the row says "A shipped theme is called dracula: rename the file."                 |
| Normal     | An unknown key in `[roles]`                                       | it is ignored; the row names it                                                                         |
| Normal     | A shipped theme's colour falls under the floor                    | it ships the smallest lighter or darker step that reaches the floor                                     |
| Niche      | The themes folder does not exist                                  | no theme of yours; the row says where to put one                                                        |
| Niche      | The browser refuses storage, in a private window                  | the picks last until the page reloads, as today                                                         |
| Niche      | The config folder is a symlink, from a dotfiles manager           | the themes folder is followed and watched, as the settings file is                                      |

## Success criteria

- **SC-001** (look unchanged): With Catppuccin picked, every colour token the app draws equals
  today's, in Mocha and Latte, headings excepted.
- **SC-002** (floor): Every shipped theme's text reaches 4.5:1 and its borders and controls 3:1, on
  every pair today's test measures.
- **SC-003** (no flash): A reload with Dracula picked paints Dracula in its first frame.
- **SC-004** (no hue in views): Lint finds no view outside the theme asking for a hue.
- **SC-005** (live): A saved theme file redraws the page within 1 second.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Your
note removed pi's theme: pi draws from the terminal's colours. Monokai is not shipped, as you chose.
Settled while writing this spec:

- Kanagawa ships its three variants, Wave, Dragon, and Lotus, and Rosé Pine its three, Main, Moon,
  and Dawn. Tokyo Night's light theme is the VS Code theme's "Light", not "Day".
- Picking a theme of the other mode in the picker switches the mode, as Zed does, so you see it.
- A theme of yours cannot take a shipped theme's name: it is refused, never a silent override.
- A theme without `extends` extends its mode's default, Catppuccin Mocha or Latte, as Zed falls back
  per appearance.
- Theme files name their JSON Schema with a `#:schema` line, from the repository's `schemas/`
  folder, for completion in editors. `docs/web-ui.md` documents the format, with a shipped theme to
  copy.
- The frosted glass, the favicon, and the app's icon keep their own colours. The browser's bar
  colour follows the page.

## Constitution check

| I. Humans in control | II. Git and plain text | III. Asynchronous | IV. Review effort | V. Tools optional |
| -------------------- | ---------------------- | ----------------- | ----------------- | ----------------- |
| ✅                   | ✅                     | ✅                | ✅                | ✅                |

## Risk tier

**Medium**: a new file format read from the config folder, and about 90 places in the views that
change, with no stored data converted beyond the browser's pick.
