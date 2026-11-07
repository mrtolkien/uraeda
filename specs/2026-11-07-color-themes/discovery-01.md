# Discovery, round 01: Color themes

## Summary

Colour themes in developer tools have the same parts nearly everywhere. Each theme is declared light
or dark. The user picks one theme for light mode and one for dark mode, and a mode follows the
system or forces one side. A picker previews each theme live and reverts on Escape. Custom themes
are files, usually a small palette mapped to semantic roles, which inherit from a shipped theme for
whatever they leave out. Products differ on where the pick is kept, how many tokens a custom theme
writes, and whether anything checks its contrast.

The proposal asks for the classic open source themes, split into light and dark, pi's new default,
typed roles with clear names, and custom themes in the settings file. Uraeda today has one theme,
Catppuccin, with Latte in Astryx's light slot and Mocha in its dark one, built at build time. The
pick is Mocha, Latte, or System, kept per browser. Every view reads colours through CSS variables,
so a palette can change at runtime without a rebuild.

What is in the way: most official palettes fail the [UI look](../decisions/ui-look.md) decision's
contrast floor somewhere, pi has no named theme, Monokai's current version is paid, and the theme
pick is per browser while custom themes would live in the settings file.

## How other products do it

### Zed

- The theme setting is a name, or `{ "mode": "system" | "light" | "dark", "light": ..., "dark": ... }`
  ([all settings](https://zed.dev/docs/reference/all-settings)). A key toggles the mode
  ([themes](https://zed.dev/docs/themes)).
- The picker previews live, saves on Enter, and restores on Escape. Picking fills only the slot of
  the theme's appearance, keeping the other
  ([theme_selector.rs](https://github.com/zed-industries/zed/blob/main/crates/theme_selector/src/theme_selector.rs)).
- Custom themes are JSON files in `~/.config/zed/themes/`, about 138 flat, optional keys with a
  declared `appearance` ([schema v0.2.0](https://zed.dev/schema/themes/v0.2.0.json)). A missing key
  falls back to Zed's default for that appearance, and an unknown theme name falls back to the
  default theme (`refine_theme`, `configured_theme` in Zed's source).
- `theme_overrides`, keyed by theme name, changes single keys of a shipped theme
  ([themes](https://zed.dev/docs/themes)). The themes folder is watched and reloaded; a file that
  fails to parse is logged and skipped (`watch_themes` in Zed's source).
- No contrast check was found.

### VS Code

- One theme setting, plus a preferred dark theme and a preferred light theme switched by
  `window.autoDetectColorScheme`, and the same pair for high contrast
  ([themes](https://code.visualstudio.com/docs/configure/themes)). The setting names were seen only
  in a search snippet of [issue 106389](https://github.com/microsoft/vscode/issues/106389).
- The picker previews each theme as the cursor moves.
- `workbench.colorCustomizations` overrides colours, scoped per theme with `"[Theme Name]"`.
- Several hundred colour IDs, each with a default per theme type, so a theme that omits one, or one
  written before it existed, still works
  ([contribution points](https://code.visualstudio.com/api/references/contribution-points)).
- The terminal raises text to 4.5:1 by default with `terminal.integrated.minimumContrastRatio`
  ([terminal appearance](https://code.visualstudio.com/docs/terminal/appearance)).

### Ghostty

- `theme = light:A,dark:B` follows the desktop's appearance
  ([theme](https://ghostty.org/docs/features/theme)).
- Theme files use the config's syntax, in its `themes/` folder, and can set any option, so the docs
  warn against untrusted themes.
- `minimum-contrast` takes a WCAG ratio from 1 to 21
  ([config reference](https://ghostty.org/docs/config/reference)).

### Helix

- Themes are TOML files with a `[palette]` table of named colours and `inherits = "theme"` for
  partial themes ([themes](https://docs.helix-editor.com/themes.html)).
- The master docs add `[theme] dark, light, fallback`
  ([themes.md on master](https://raw.githubusercontent.com/helix-editor/helix/master/book/src/themes.md)).

### pi

- The repository moved to [earendil-works/pi](https://github.com/earendil-works/pi), under MIT.
- Its [changelog](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/CHANGELOG.md),
  v0.99.0 of 2026-09-29, says two things. It "added the `system` theme, now the default, which
  derives pi's colors from the terminal's reported foreground, background, and ANSI palette". It also
  "changed the built-in `dark` and `light` themes to the revised pi colors, written in OKHSL". No
  theme with a name of its own exists.
- The `system` theme keeps body text at 4.5:1 on its background
  ([themes.md](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/themes.md)).
- The setting takes `"light/dark"` to switch with the terminal.
- Custom themes are JSON files with `name`, `appearance`, `vars`, and 56 `colors`, 51 of them
  required, validated strictly against a [schema](https://pi.dev/schemas/theme.schema.json). The
  active theme reloads when its file changes.
- Its roles group into base (`accent`, `border`, `text`, `muted`, `dim`, statuses), messages, tool
  rows, markdown (`mdHeading`, `mdLink`, `mdCode`, ...), diffs, 9 syntax roles, and thinking levels.
- The built-in themes set no main background, leaving the terminal's. Only the HTML export has one
  (`export.pageBg`).
- The light theme's accents sit at about 4.3:1 on its export background and pass on white. It looks
  tuned for white terminals (computed, see [pi](#pi-1)).

### opencode

- `theme: { name, mode: system | dark | light }`, 33 shipped themes
  ([themes](https://opencode.ai/docs/themes/)).
- Its V2 format separates a palette of 8 hues in steps from 100 to 900 from the role tree that
  references them. A state not given falls back to its base value.

### Warp

- "Sync with OS" picks one theme for light mode and one for dark mode. The picker previews live and
  reverts on cancel ([themes](https://docs.warp.dev/terminal/appearance/themes)).
- A custom theme is about 20 keys of YAML: accent, background, foreground, a light or dark hint, and
  16 terminal colours. Warp derives the rest
  ([custom themes](https://docs.warp.dev/terminal/appearance/custom-themes)).

### GitHub

- "Theme mode" is a single theme, or follows the system with a day theme and a night theme picked
  separately. It includes high-contrast themes and colourblind themes
  ([theme settings](https://docs.github.com/en/get-started/accessibility/managing-your-theme-settings)).
- Primer's high-contrast themes aim at 7:1 ([Primer colour](https://primer.style/foundations/color/overview)).

### Obsidian

- Adapt to system, Light, or Dark, plus an accent colour ([settings](https://obsidian.md/help/settings)).
- A community theme serves both modes, with colours under `.theme-light` and `.theme-dark`
  ([build a theme](https://docs.obsidian.md/Themes/App+themes/Build+a+theme)).

### Claude Code and Codex

- Claude Code's `/theme` has an "auto" option that follows the terminal. Custom themes are
  `~/.claude/themes/<slug>.json`, `{ base, overrides }`: tokens not given fall through to the base
  preset, and unknown tokens and invalid colours are ignored, "so a typo cannot break rendering"
  ([terminal config](https://code.claude.com/docs/en/terminal-config)).
- Codex's theme covers syntax highlighting only, stored in `config.toml`
  ([CLI customization](https://learn.chatgpt.com/docs/cli-customization.md)).

### What they have in common

1. **Each theme is light or dark**, and the user picks one of each, with a mode that follows the
   system or forces a side: Zed, VS Code, Ghostty, Helix, Warp, GitHub, pi.
2. **A picker that previews live**, and reverts on Escape: Zed, VS Code, Warp, Codex.
3. **Custom themes inherit**: a base theme or per-appearance defaults fill what they leave out
   (Claude Code, Helix, Zed, VS Code). pi's strict, all-required schema is the exception.
4. **A palette apart from roles**: Helix, pi, opencode, Primer.
5. **Syntax colours belong to the theme**, as a small set: pi and opencode have 9.
6. **Custom themes reload** when their file changes: Claude Code, pi, Zed, Warp.
7. **High-contrast themes** for low vision: VS Code, GitHub, Claude Code's daltonized ones.
8. **No product checks a custom theme's contrast** on load. Ghostty and VS Code's terminal clamp
   contrast at draw time instead.

## Standards and libraries

### The palettes

Contrast is computed with WCAG 2.x's formula against each variant's page background, by the
research and by the [prototype](mockups/themes.html), whose `render.js` prints the failures.

| Family      | Dark variants              | Light variants               | Licence                           | Under 4.5:1 as text                                              |
| ----------- | -------------------------- | ---------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| Catppuccin  | Mocha, Macchiato, Frappé   | Latte                        | MIT                               | Latte: most accents, 2.3 to 4.3                                  |
| Dracula     | Dracula                    | Alucard                      | MIT                               | Dracula: comment, 3.0                                            |
| Tokyo Night | Night, Storm, Moon         | Day (folke), Light (VS Code) | Apache-2.0 (folke), MIT (VS Code) | comment in every variant, 2.4 to 3.1; Day: nearly every accent   |
| Monokai     | Classic                    | Pro Light only, paid         | Classic: MIT port; Pro: paid      | comment 3.0, red 3.9                                             |
| GitHub      | Dark, Dark Dimmed, Dark HC | Light, Light HC              | MIT                               | Dark Dimmed: 6 accents near 4.0                                  |
| pi          | dark                       | light                        | MIT                               | dark: dim 4.2; light: most accents 4.2 to 4.4 on its page colour |

- **Catppuccin**: [palette.json v1.8.0](https://raw.githubusercontent.com/catppuccin/palette/main/palette.json)
  and its [style guide](https://github.com/catppuccin/catppuccin/blob/main/docs/style-guide.md),
  which maps roles: Base for panes, Mantle and Crust for secondary panes, Surface for elements,
  Overlay 2 for comments, Subtext for labels. It says "text colors are guidelines, certain cases
  require deviations". Uraeda already darkens Latte's accents for text
  ([`theme.ts`](/packages/web/src/theme/theme.ts)).
- **Dracula**: the [spec](https://draculatheme.com/spec) now holds Alucard, its official light
  variant, a role table, and the line "maintain 4.5:1 minimum contrast ratio (WCAG 2.1 Level AA)".
  Its own comment colour, `#6272A4`, is 3.0:1.
- **Tokyo Night**: [folke/tokyonight.nvim](https://github.com/folke/tokyonight.nvim) generates Day
  by inverting Night. Day's text is 4.5:1 and its accents 3.0 to 4.3. The original
  [VS Code theme](https://github.com/tokyo-night/tokyo-night-vscode-theme)'s "Tokyo Night Light" has
  different colours, and fails only on its comment, 4.1.
- **Monokai**: [monokai.com](https://monokai.com/) says Wimer Hazenberg made it in 2006 and that
  its "most recent version is called Monokai Pro". Its [licence](https://monokai.pro/license) says
  "Monokai Pro is copyrighted by Monokai" and "may not be sub-licensed, resold, or redistributed".
  Its [history](https://monokai.pro/history) calls others' remixes "Monokai-inspired". VS Code's
  built-in [Monokai](https://github.com/microsoft/vscode/tree/main/extensions/theme-monokai) is
  MIT, "based on the original Monokai". No licence of the original 2006 theme, and no trademark
  registration, was found.
- **GitHub**: [@primer/primitives](https://github.com/primer/primitives) v11.10.0, MIT, holds the
  functional tokens of each theme. Its decorative border, `borderColor-default`, is 1.4:1 on white:
  a control's border needs a stronger step. Use of the name "GitHub" in a picker was not checked.
- **pi**: [`dark.json` and `light.json`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/modes/interactive/theme),
  in OKHSL. The research converted them to hex with a port of the reference `okhsl_to_srgb`, so a
  channel may differ by 1. Every dark accent sits at OKHSL lightness 67%, every light one at 46%
  to 47%.
- **Other classics**, if the scope grows: Gruvbox (MIT/X11), Nord (MIT, dark only), Solarized (MIT,
  low contrast by design: its light body text is 4.1), One Dark and One Light (MIT, archived), Rosé
  Pine (MIT), Everforest (MIT, light accents 2.1 to 3.1), Kanagawa (MIT).

### pi

The pi palette's figures, computed: on its export page colour `#efeeee`, the light theme's muted
text is 4.32, blue 4.25, green 4.25, yellow 4.37, and dim 2.81; on white, muted is 5.00. The dark
theme on `#21252c` has every accent from 5.7 to 6.4, and its dim text at 4.25.

### Design-token vocabularies

- [Base16](https://github.com/tinted-theming/home/blob/main/styling.md): 16 slots, 8 a grey ramp
  and 8 accents. [Base24](https://github.com/tinted-theming/base24/blob/main/styling.md) adds two
  darker backgrounds and six bright accents, each falling back to a Base16 slot. Schemes declare
  `variant: light | dark` ([builder](https://github.com/tinted-theming/home/blob/main/builder.md)).
  It is how terminals import hundreds of schemes at once.
- [Material 3](https://github.com/material-components/material-web/blob/main/docs/theming/color.md):
  surfaces in containers from lowest to highest, `on-` colours for content, `outline` for borders.
- [Radix](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale): 12
  steps per hue, from app background to high-contrast text.
- [Primer](https://primer.style/foundations/color/overview): base colours, never used directly,
  then functional tokens `fgColor-*`, `bgColor-*`, `borderColor-*`, each status muted or emphasis.
- Shared vocabulary: two to five surfaces, two or three text levels, two or three border levels,
  one accent, the statuses, and an "on" colour for text on a filled colour.

### Astryx

Read in Astryx 0.7.3's source, under `node_modules/@astryxdesign/core/src`:

- `Theme` injects a theme's CSS at runtime when it is not built (`theme/Theme.tsx`, lines 106 to
  178), with `generateThemeCSS`, the same generator the build uses. `defineTheme` can extend the
  built `uraedaTheme`. Each runtime theme is the whole stylesheet again, about 35 KB, 5 KB gzipped.
- Every rule is scoped to `[data-astryx-theme="<name>"]`, so several themes can be loaded and
  switched by the `theme` prop (`theme/generateThemeRules.ts`). The CLI's `--family` mode shares
  their common rules, for themes known at build time only.
- A `[light, dark]` pair becomes `light-dark(a, b)`. A plain value is used in both modes, so a
  theme of one mode only is plain values with its `mode` forced.
- Uraeda's colours are literals: Astryx derives nothing from a base colour in this theme. Its
  components mix colours at the point of use (`color-mix(... var(--color-accent) ...)`), so those
  follow an override.
- An unlayered rule on `[data-astryx-theme="uraeda"]` wins over the theme's layered tokens, on the
  same elements: `<html>`, the `Theme` wrapper, and the sandbox bar. Aliases such as
  `--color-selection: var(--color-background-yellow)` then resolve against the new values. A
  wrapper inside `Theme`, as [`PickedFonts`](/packages/web/src/theme/PickedFonts.tsx) does for
  fonts, would have to declare those aliases again.

### Flash of the wrong theme

- A web page paints its default theme before a script reads the pick. The fix is a blocking inline
  script that reads the stored pick and sets the theme before the first paint
  ([Josh Comeau](https://www.joshwcomeau.com/react/dark-mode/),
  [next-themes](https://github.com/pacocoursey/next-themes)), with `color-scheme` set so scrollbars
  and controls match ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)).

## The code

### Important reads

- [`theme/theme.ts`](/packages/web/src/theme/theme.ts), 500 lines: the one theme, Latte and Mocha
  as `[light, dark]` pairs, about 104 colour tokens, plus sizes, fonts, and component rules. Built by
  `vp run --filter uraeda-web theme` into [`theme/built/`](/packages/web/src/theme/built/). Colour
  and structure live in one file: a palette per theme means splitting colours out of it first.
- [`theme.tsx`](/packages/web/src/theme.tsx): the scheme, `system | mocha | latte`, in
  `localStorage` under `uraeda.theme`, resolved to Astryx's `light` or `dark` mode.
- [`settings/OtherSettings.tsx`](/packages/web/src/settings/OtherSettings.tsx): Appearance's
  segmented control, Mocha, Latte, System. Its help, in
  [`categories.ts`](/packages/web/src/settings/categories.ts), says "Kept on this browser only:
  each device picks its own."
- [`keys/LeaderKeys.tsx`](/packages/web/src/keys/LeaderKeys.tsx): `Space u t` cycles Mocha,
  Latte, System. `Space u f` opens [`FontPicker`](/packages/web/src/keys/FontPicker.tsx), a key
  picker with a live preview of each font: the pattern for a theme picker.
- [`theme/fonts.ts`](/packages/web/src/theme/fonts.ts): fonts are also kept per browser, written
  over the theme's tokens on the app's root.
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs): the settings file, `config.toml`,
  read, checked, and written by the core with `toml_edit`. Tables `[server]`, `[runs]`,
  `[keyboard]`. An invalid value makes the whole file unreadable.
- [`packages/server/src/settings.ts`](/packages/server/src/settings.ts) and
  [`settings-watch.ts`](/packages/server/src/settings-watch.ts): the server resolves each setting
  and watches the file, symlinks included, so a hand edit shows at once. The web reads settings
  only once signed in, as [`VimSetting.tsx`](/packages/web/src/fields/editor/vim/VimSetting.tsx)
  does.
- [`__tests__/theme-tokens.test.ts`](/packages/web/src/__tests__/theme-tokens.test.ts): parses
  the built CSS and measures about 40 kinds of pairs, text at 4.5:1 and borders at 3:1, for two
  slots, Latte and Mocha. It is wired to one file and two slots.
- [`layout/glass.stylex.ts`](/packages/web/src/layout/glass.stylex.ts) and
  [`glass.ts`](/packages/web/src/layout/glass.ts): the frosted glass's warm amber tint is "a warm
  amber of its own, not the theme's", over the page's own colour.
- [`Diagram.tsx`](/packages/web/src/Diagram.tsx) and
  [`fields/editor/theme.ts`](/packages/web/src/fields/editor/theme.ts): diagrams and the code
  editor read the theme's variables, so they follow any palette.
- [`.storybook/preview.tsx`](/packages/web/.storybook/preview.tsx): a story embedded in a spec gets
  only `light` or `dark` from the page, by a message. With themes, it needs the theme too.
- [`sandbox/mountSandboxBar.tsx`](/packages/web/src/sandbox/mountSandboxBar.tsx): the sandbox bar
  draws its own theme wrapper and follows `data-theme` on `<html>`.
- `index.html` and `public/manifest.webmanifest`: the browser's `theme-color` is Latte's and
  Mocha's page colour, hard-coded.
- Headings are drawn in the text's colour today; pane titles in Catppuccin's lavender
  ([`Pane.tsx`](/packages/web/src/layout/Pane.tsx)), a live window in sapphire, sub-agents in teal.

### The proposal's path and existing actions

- **Picking a theme**: today the settings' Appearance or `Space u t`. With the feature, the same
  places, with a list per mode instead of three choices.
- **A stored `mocha`, `latte`, `dark`, or `light`**: read today by `storedScheme`. With the
  feature, each must still read as a pick: Mocha as the dark theme, Latte as the light one.
- **Following the system**: `prefers-color-scheme`, kept.
- **Editing the settings file by hand**: watched and shown at once. A custom theme added or changed
  shows the same way.
- **A broken settings file**: the page shows its problem today and refuses writes. A custom theme
  with a typo should not make the whole file unreadable, or every other setting stops applying.
- **Removing a custom theme a browser picked**: the browser's pick names a theme that no longer
  exists, and falls back to the default of its mode.
- **Sign-in page and first paint**: drawn before any setting is readable, from the browser's pick.
- **Stories in a spec, the sandbox bar, diagrams, the editor, the glass**: each must follow the
  palette, as listed above.
- **The `ura` TUI** follows the terminal's theme, by the [TUI](../decisions/tui.md) decision: not
  touched.

### Rules and their owners

- **The contrast floor**: the [UI look](../decisions/ui-look.md) decision, checked by
  `theme-tokens.test.ts` on the built CSS. With palettes, the test reads palette data.
- **Settings**: the [Settings](../decisions/settings.md) decision puts finding, reading,
  validating, and writing the file in the Rust core. A custom theme's parsing and validation belong
  there.
- **Colours only through the theme**: the [UI components](../decisions/ui-components.md) decision
  and its lint (`stylex/valid-styles`, `stylex/custom-property-tokens`), relaxed in `src/theme/`.
  The CSS import allowlist in [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts) names only
  `uraeda.css`.

### Likely changes

Under every option:

- [`theme/theme.ts`](/packages/web/src/theme/theme.ts): colours move out into palettes of roles,
  and a mapping from roles to Astryx's tokens. Structure stays built.
- A new palette module, applying a palette's tokens at runtime as one rule over the built theme.
- [`theme.tsx`](/packages/web/src/theme.tsx), [`OtherSettings.tsx`](/packages/web/src/settings/OtherSettings.tsx),
  [`LeaderKeys.tsx`](/packages/web/src/keys/LeaderKeys.tsx), a new theme picker beside
  [`FontPicker.tsx`](/packages/web/src/keys/FontPicker.tsx).
- `index.html`: a blocking script that applies the stored pick before the first paint.
- [`.storybook/preview.tsx`](/packages/web/.storybook/preview.tsx), `StoryFrames.tsx`, and
  [`mountSandboxBar.tsx`](/packages/web/src/sandbox/mountSandboxBar.tsx): follow the palette.
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs) and a `settings/themes.rs`: custom
  themes in the file, validated; the binding and
  [`packages/server/src/settings.ts`](/packages/server/src/settings.ts) carry them to the web.
- [`docs/web-ui.md`](/docs/web-ui.md): the settings file's new tables.
- The [UI look](../decisions/ui-look.md) decision: its intent names Catppuccin colours.

Tests that guard behaviour the feature changes:

- [`__tests__/theme-tokens.test.ts`](/packages/web/src/__tests__/theme-tokens.test.ts): every
  test, rewritten to measure each palette.
- [`__tests__/theme.test.ts`](/packages/web/src/__tests__/theme.test.ts): "the stored value %j
  reads as %s", whose values change.
- [`__tests__/lint.test.ts`](/packages/web/src/__tests__/lint.test.ts): the CSS import allowlist.
- The core's settings tests, for the new tables.

### Other features in flight

`2026-11-07-keyboard-nav` and `2026-11-07-global-undo` have only their proposals. Keyboard nav may
add keys to the leader tree, where `Space u t` lives: a merge to watch, not a conflict.

## The proposal

### pi has no named default theme

The proposal asks for "the pi agent default color theme that they just released". pi's new default
is `system`, which takes the terminal's own colours, so it has no palette to copy. The same release
revised pi's built-in `dark` and `light`. They set no page background, leaving the terminal's; the
HTML export's page colour stands in. See [pi](#pi).

### Monokai is paid today, and its name is not free

Monokai Pro, the current Monokai, is paid and may not be redistributed. The classic colours are in
VS Code's MIT port, and the name belongs to its author's studio. Monokai has no free light variant.
See [the palettes](#the-palettes).

### Official colours fail the contrast floor

The UI look decision asks every text colour to reach 4.5:1 "in every scheme". Dracula's comment,
Tokyo Night's comment, Monokai's red, GitHub Dark Dimmed's accents, and most light variants' accents
fall under it. Shipping them as published conflicts with the decision; meeting it changes some of
their colours, as Latte's already are.

### Custom themes and the contrast floor

The same rule cannot be checked by a test for a theme the user writes. The decision must say what
happens with a custom theme under the floor.

### Where the pick is kept

The proposal puts custom themes in "the conf file", the settings file. The pick of a theme is kept
per browser today, as fonts are. The proposal does not say which should hold the pick.

### "Heading levels/hierarchy" as colour names

The proposal names heading levels among the theme's roles. Headings are drawn in the text's colour
today, so coloured headings would change every document's look.

### Which variants ship

"Catppuccin, Dracula, Tokyo night, Monokai, GitHub, …" names families. Several have three or four
variants, and the "…" leaves room for more.

## Worth it and feasibility

- **Worth it**: the gain is personal comfort, which the proposal names, for a tool read for hours.
  The cost is moderate: splitting colours from the theme, a palette module, a picker, custom themes
  in the core, and a contrast test per palette. The split also cleans the theme file. Each shipped
  palette is about 25 colours of data, plus the adjustment of those under the floor.
- **Runtime palettes**: checked in Astryx's source, as [Astryx](#astryx) says. An unlayered rule
  over the built theme's tokens wins, and every view reads variables. Not yet run in the app: the
  plan's first task checks that the rule wins in every surface, the sandbox bar and story frames
  included.
- **Before the first paint**: a blocking script in `index.html` can apply a stored palette. A custom
  palette's colours must then be stored in the browser too, since the file is read only after
  sign-in.
- **No guard is relaxed.** A custom theme is colours only, validated as colours: a theme file
  cannot carry code or other settings, unlike Ghostty's.

## Approaches

Criteria: the proposal (light and dark split, typed roles, custom themes in the file), the
[UI look](../decisions/ui-look.md) decision (one theme, schemes named, contrast floor), the
[Settings](../decisions/settings.md) decision (one TOML file, core owns it), the
[UI components](../decisions/ui-components.md) decision (colours only through the theme), and the
constitution's "review effort matches impact".

### Which themes ship

| Option                                                                | Themes | Contrast work                                               | Covers the proposal |
| --------------------------------------------------------------------- | ------ | ----------------------------------------------------------- | ------------------- |
| A. The proposal's families and pi, all their free variants, GitHub HC | 18     | adjust Dracula, Tokyo Night, Monokai, Dimmed, pi light      | yes                 |
| B. One dark and one light per family                                  | 10     | fewer to adjust                                             | partly              |
| C. A, plus Gruvbox, Nord, Rosé Pine, Kanagawa, One, Solarized         | ~30    | Solarized, Rosé Pine Dawn, and One Light need heavy changes | beyond              |

### Official or adjusted colours

| Option                                                      | Decision | Faithful to the palette | Readable |
| ----------------------------------------------------------- | -------- | ----------------------- | -------- |
| A. Adjust only colours under the floor, the smallest step   | kept     | nearly                  | yes      |
| B. Ship the official colours, the floor a SHOULD for themes | softened | exactly                 | partly   |
| C. Ship only themes that pass as published                  | kept     | exactly                 | yes      |

### Picking light and dark

| Option                                       | Products                       | Follows the system |
| -------------------------------------------- | ------------------------------ | ------------------ |
| A. A mode, a dark theme, and a light theme   | Zed, GitHub, VS Code, Warp, pi | yes                |
| B. One theme from one list, its mode its own | VS Code without auto-detect    | no                 |

### Where the pick is kept

| Option                                      | Per device | In dotfiles | First paint and sign-in page |
| ------------------------------------------- | ---------- | ----------- | ---------------------------- |
| A. Per browser, as today and as fonts       | yes        | no          | right                        |
| B. In the settings file                     | no         | yes         | needs a copy in the browser  |
| C. The file's default, a browser's override | both       | yes         | needs a copy; two places     |

### A custom theme's format

| Option                                                   | Keys to write | Imports existing schemes | Typed roles      |
| -------------------------------------------------------- | ------------- | ------------------------ | ---------------- |
| A. About 20 named roles, inheriting from a shipped theme | 1 to 20       | by hand                  | yes              |
| B. Base16 or Base24 slots                                | 16 or 24      | hundreds, as written     | slots, not roles |
| C. Every token, about 100                                | up to 100     | no                       | yes, many        |

Where the themes are written: tables in `config.toml`, as the proposal and the Settings decision's
one file say, or a `themes/` folder beside it, as Zed, Helix, and pi do. The decision's "one TOML
file" settles it within the active decisions.

### A custom theme under the floor

| Option                                                   | Decision change                      | User's control |
| -------------------------------------------------------- | ------------------------------------ | -------------- |
| A. Applied, the settings page listing each pair under it | the floor covers shipped themes only | full           |
| B. Refused, falling back to the default                  | none                                 | none           |
| C. Applied, colours raised to the floor at runtime       | none                                 | partial        |

### Heading colours

| Option                                                  | Look today changes | Hierarchy by colour |
| ------------------------------------------------------- | ------------------ | ------------------- |
| A. Each level its own hue, from the theme               | yes                | yes                 |
| B. Heading roles exist, in the text's colour by default | no                 | only custom themes  |
| C. No heading roles                                     | no                 | no                  |

### Monokai's name

| Option                                                  | Legal risk       | Recognised |
| ------------------------------------------------------- | ---------------- | ---------- |
| A. "Monokai Classic", from VS Code's MIT port, credited | low, not cleared | yes        |
| B. A neutral name, "Classic 2006"                       | lowest           | less       |
| C. No Monokai                                           | none             | -          |

### Needs no choice

- **Live preview in the picker, reverted on Escape**: the font picker already works this way.
- **Inheritance of custom themes**: with roles, inheriting from a shipped theme is how a partial
  theme stays valid when a later version adds roles.
- **Syntax colours**: derived from the theme's hues, overridable by a custom theme.
- **Reload on change**: the settings file is already watched.
- **High-contrast themes**: GitHub's, inside the themes question.
- **The glass's amber tint**: it is "not the theme's" by the guides, and lies over the page's own
  colour, so it follows any palette.
- **Removing the feature**: picks fall back to Catppuccin, as a stored unknown value does today.

## Not checked

- Trademark registration of "Monokai", and GitHub's policy on its name in a theme picker.
- A licence for the original 2006 Monokai theme: none found.
- pi's palettes in hex as pi publishes them: pi publishes OKHSL, converted here.
- The full values of Primer's colourblind themes, and of Kanagawa's Dragon and Lotus.
- VS Code's exact setting names for preferred themes: seen only in a search snippet.
- Whether an unlayered palette rule wins in the running app's every surface: read in the source,
  not run.
