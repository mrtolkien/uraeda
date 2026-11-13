---
kind: feature
finished: 2026-11-08
pull-request: https://github.com/mrtolkien/uraeda/pull/109
supersedes:
  - 2026-10-20-layout-look
  - 2026-10-26-leader-key
---

# Record: Color themes

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-07, finished on
> 2026-11-08, in [its pull request](https://github.com/mrtolkien/uraeda/pull/109). Its full files
> are in git: `git log -- specs/2026-11-07-color-themes/`.

## What and why

The web UI had one colour scheme, Catppuccin, Mocha or Latte. The human asked for a simple pick
among the classic open source colour themes, split into light and dark, "a bit of customization" in
a tool read for hours. Two demands came with it: a clean architecture, where every theme is typed
with clear colour names (surfaces, heading levels), and room to grow, a user writing a theme of
their own in a config file.

## Behaviour

- **A theme per mode, per device (US1)**: the settings' Appearance picks a mode, System, Light, or
  Dark, then a dark theme and a light theme from two lists, kept in the browser (`uraeda.theme`,
  `uraeda.theme.dark`, `uraeda.theme.light`), as the fonts are. System follows
  `prefers-color-scheme` at once. 28 themes ship. Dark: Catppuccin Mocha, Macchiato, and Frappé;
  Dracula; GitHub Dark, Dark Dimmed, and Dark High Contrast; Gruvbox Dark; Kanagawa Wave and Dragon;
  Nord; One Dark; Rosé Pine and Rosé Pine Moon; Solarized Dark; Tokyo Night, Storm, and Moon. Light:
  Catppuccin Latte; Alucard; GitHub Light and Light High Contrast; Gruvbox Light; Kanagawa Lotus;
  One Light; Rosé Pine Dawn; Solarized Light; Tokyo Night Light (the VS Code theme's "Light", not
  "Day"). A list is its mode's default first, then the other shipped themes by name, then the user's
  by name, marked "yours". A new device, or a pick the lists no longer hold, draws Catppuccin Mocha
  or Latte. A stored `mocha` or `dark` reads as the mode Dark with the defaults, `latte` or `light`
  as Light: nothing changes on screen. Another tab's change of the picks, or a cleared storage,
  redraws this tab and its cache.
- **No flash, everywhere**: the browser caches the drawn colours of the two picked themes
  (`uraeda.theme.drawn`), which a blocking script in `index.html` applies before React starts, the
  sign-in page and the browser's bar colour included; `<html>` is painted in the theme's page
  colour. A corrupt cache, or one missing a mode, is ignored. A spec's story frames and the sandbox
  bar draw the picked theme; Storybook's own pages keep the built Catppuccin. The frosted glass, the
  favicon, and the app's icon keep their own colours.
- **The theme picker (US2)**: `Space u t` opens the shared key picker in page mode, a narrow list at
  the top of the page at every width (a phone included, never a bottom sheet), with no scrim and no
  preview pane: the app redraws in the theme under the cursor, its mode included. The cursor starts
  on the theme in use in the mode shown, the two in use marked, dark themes first. After a second
  with no key, the list fades to 10% over 200 ms, and back over 200 ms on any key, a pointer move,
  or a press in it; both at once under reduced motion. Letters search, `j` included; the arrows,
  Ctrl+J and Ctrl+K, and Vim's `j` and `k` in normal mode with Vim on, move the cursor. Enter keeps
  the theme as its mode's, and picking a theme of the other mode switches the mode to it. Escape,
  Back, a click outside, or the focus leaving the list (Tab) put back the theme in use. A click
  outside is swallowed, so it opens nothing; a press or a scroll outside keeps the list open. While
  any layer is open, a pointer moving over the page moves no selection. `Space u m` cycles the mode:
  System, Light, Dark.
- **Themes of your own (US3)**: a TOML file per theme in `themes/` beside `config.toml`
  (`~/.config/uraeda/themes/`), never from a repository, names its `mode`, the theme it `extends`, a
  private `[palette]`, and the `[roles]` it changes; its id is the file's name. It shows in its
  mode's list once saved, and the page redraws within a second. A role left out inherits the
  parent's expression, resolved against the file's palette merged over the parent's. Appearance
  lists each file with its problems, as the core words them, each with its line: it counts "N
  colours under the contrast floor" apart from "N problems". A broken role keeps the extended
  theme's colour, its banner ending "That role keeps its colour from <theme>."; the rest of the
  theme applies. Your colours apply as written, under the floor or not ("ink-faint is 3.1:1 on page,
  under 4.5."). A file that is not valid TOML, a dangling symlink ("Could not read: entity not
  found."), a loop of `extends`, a parent of the other mode, no `mode` and no `extends`, or a
  shipped theme's name in any case, leaves the lists; an unknown `extends`, or a parent that has
  problems of its own, extends its mode's default. `extends` matches a theme's id in any case, an
  exact match first. Swap, backup, and hidden files are not themes. A symlinked config folder,
  themes folder, or theme file is followed and watched at its target.
- **Headings by level (US4)**: headings take `heading-1`, `heading-2`, then `heading-3` for every
  deeper level, in documents, rounds, specs, messages, and the editor's markdown; Catppuccin draws
  them mauve, blue, green. A page or pane title that is a document's heading takes its level's
  colour: the `#` titles of the spec, document, plan, and data model pages, a document's `##`
  section panes, a user story's `###` pane. Other titles keep their colours.
- **Views ask for meanings**: about 50 roles named by where they draw or what they mean (`page`,
  `raised`, `cursor-row`, `ink-quiet`, `action`, `needs-you`, `caution`, `live`, `mode-insert`,
  `syntax-keyword`, …); every derived colour, tints, hover, icons, diff lines, text on fills, comes
  from them. Lint refuses a hue in a view.
- **The floor**: every shipped theme's text reaches 4.5:1 and its borders and controls 3:1 on every
  pair measured. A published colour under it ships as its smallest floor step, 1% of HSL lightness
  at a time, hue and saturation kept, as `<name>-floor` beside the published one. Every shipped
  theme's cursor row stands apart from `page`, `raised`, and `chip`, and its text levels read in
  order, `ink` at least as strong as `ink-quiet`, and `ink-quiet` as `ink-faint`.

## Design

A theme is resolved to roles in the core, roles to Astryx's tokens in the web, and the tokens are
applied as one unlayered rule per mode over the built Astryx theme, which keeps sizes, fonts,
component rules, and Catppuccin's colours as its defaults. Views read roles only. The format, its
problems, and the role list live in the core, as the stack decision asks; the web owns every derived
colour.

- **Theme files**, [`crates/core/src/themes.rs`](/crates/core/src/themes.rs) and its modules
  [`parse.rs`](/crates/core/src/themes/parse.rs), [`resolve.rs`](/crates/core/src/themes/resolve.rs)
  (`extends`, palettes, the lists' order), and [`contrast.rs`](/crates/core/src/themes/contrast.rs)
  (the warnings on role pairs): `ROLES`, the shipped themes embedded in the binary from
  [`crates/core/themes/`](/crates/core/themes/), each file's header naming its source and license,
  and a read that never fails. Each `ThemeProblem` carries its line, `is_under_floor`, and its
  `role`. The JSON Schema, [`schemas/theme.json`](/schemas/theme.json), named by a `#:schema` line
  for completion in editors.
- **The themes' watch**, [`packages/server/src/themes.ts`](/packages/server/src/themes.ts): reads
  the themes through the binding, watches the folder with `FileWatch` of
  [`settings-watch.ts`](/packages/server/src/settings-watch.ts), now able to watch a folder's
  entries, and serves the result as one live fate record, `Themes`. A failed first read is tried
  again each second.
- **The role mapping**, [`packages/web/src/theme/roles.ts`](/packages/web/src/theme/roles.ts):
  `tokensOf` turns a theme's roles into Astryx's tokens and the views' `--role-<role>` variables,
  with a `--role-<role>-tint`, 12% over `page`, for each accent role. The token pairs the contrast
  test measures are in [`theme/pairs.ts`](/packages/web/src/theme/pairs.ts), shared with the floor
  script, [`packages/web/scripts/theme-floor.ts`](/packages/web/scripts/theme-floor.ts), which
  prints each `-floor` step from [`theme/floor.ts`](/packages/web/src/theme/floor.ts). HSL lightness
  keeps every step in gamut, where OKLCH would need a clamp the test repeats.
- **The palette rule**, [`packages/web/src/theme/palette.ts`](/packages/web/src/theme/palette.ts):
  `[data-astryx-theme="uraeda"][data-theme="<mode>"]`, unlayered, which wins over the built theme on
  the page, panes, portalled dialogs, popovers, the sandbox bar, and a story's document, as
  [`scripts/palette-probe.ts`](/packages/web/scripts/palette-probe.ts) measured in Chromium. The
  first paint's script in [`index.html`](/packages/web/index.html) applies the cache with the same
  rule.
- **Theme picks**, [`packages/web/src/theme.tsx`](/packages/web/src/theme.tsx): `storedPicks`,
  `storedDrawn`, and `drawnTokens`, the rule that a pick the lists lack draws its mode's default;
  the provider, the cache, the picker's preview, and `ThemesFeed`, which feeds the provider the
  server's themes once signed in, since the provider sits above the sign-in page.
  [`useThemes.ts`](/packages/web/src/useThemes.ts) reads the record.
- **The views**: `var(--role-…)` and Astryx's semantic tokens only, with
  [`layout/RoleBadge.tsx`](/packages/web/src/layout/RoleBadge.tsx) for a badge in a role. The lint
  rule `colour/roles-not-hues`, [`packages/web/lint/colour.js`](/packages/web/lint/colour.js),
  refuses a hue token, built or written, a hue `variant` or `color`, picked by a condition or not,
  and a hue's name alone. The heading rule lives in
  [`layout/headings.ts`](/packages/web/src/layout/headings.ts), used by `PageTitle`'s
  `isDocumentHeading`, `Pane`'s `tint="heading"`, and the editor's
  [`fields/editor/markdown.ts`](/packages/web/src/fields/editor/markdown.ts).
- **The picker**: [`keys/ThemePicker.tsx`](/packages/web/src/keys/ThemePicker.tsx) over the key
  picker's page mode, drawn by [`keys/InPage.tsx`](/packages/web/src/keys/InPage.tsx): a raw
  `role="dialog"` box with its fade, its click outside, and its focus return.
  [`keys/layers.ts`](/packages/web/src/keys/layers.ts) answers whether a layer is open, cached for
  the frame, which `pointerMoved.ts` reads.
- **Appearance**,
  [`settings/AppearanceSettings.tsx`](/packages/web/src/settings/AppearanceSettings.tsx): the mode,
  the two lists, and the user's files with their problems. Story frames receive the palette with the
  mode ([`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx),
  [`.storybook/preview.tsx`](/packages/web/.storybook/preview.tsx)).
- The format, with a shipped theme to copy, is documented in
  [the web UI's page](/docs/app.md#colour-themes); the themes' licenses in
  [CONTRIBUTING](/CONTRIBUTING.md).

## Replaced behaviour

- **The colour scheme is Mocha, Latte, or System, in one control**: now a mode and a theme per mode.
  `__tests__/categories.test.ts`, its "Colour scheme" rows, now finds "Dark theme", "Light theme",
  and "Your themes" by the scheme's old names; `__tests__/theme.test.ts`, "the stored value %j reads
  as %s", now reads stored picks as a mode and two themes, with tests of the drawn cache and of a
  pick the lists lack.
- **`Space u t` cycles Mocha, Latte, then System**: it opens the theme picker, and `Space u m`
  cycles the mode. `__tests__/keys-leader-tree.test.tsx`, "Space u t cycles the theme: Mocha, Latte,
  then System (ruling R61)", was replaced by "Space u m cycles the mode: System, Light, then Dark";
  the picker is tested in `__tests__/theme-picker.test.tsx`.
- **The contrast test reads the built stylesheet's two slots, Latte and Mocha**: every test of
  `__tests__/theme-tokens.test.ts` was rewritten to measure each shipped theme through the app's
  mapping, its pairs moved to `theme/pairs.ts`, the scrim pair of `--color-on-dark` among them.
- **Headings are drawn in the text's colour, and the editor's in mauve**: guarded by no test; no
  test was removed.
- By ruling, the core's test of the lists' order leaves out the shipped themes other than the two
  defaults, and a shipped theme's floor test checks only the `-floor` entries its roles name: a
  family's first file extends its mode's default, and so carries Catppuccin's floors, which no role
  of its own names.

## Gotchas

- **A theme's maps are `BTreeMap`s, not `HashMap`s**: a `HashMap`'s order changes between reads, and
  the server tells a change by comparing two reads as JSON, so an editor's swap file re-sent the
  whole catalogue and redrew every client
  ([`crates/core/src/themes.rs`](/crates/core/src/themes.rs)).
- **A symlinked theme file is watched at its target's folder**: `fs.watch` on the themes folder
  never sees an edit at a symlink's target, as GNU Stow makes them. A dangling link is followed with
  `readlinkSync`, and the nearest existing folder toward its target is watched, so the target is
  seen once made. On Linux `fs.watch` follows a symlinked folder, so the test also re-points the
  link ([`settings-watch.ts`](/packages/server/src/settings-watch.ts)).
- **The first paint's script repeats the stored picks' reading and the palette rule's text**: it
  runs before any module loads. `__tests__/first-paint.test.ts` runs the script from
  [`index.html`](/packages/web/index.html) in happy-dom and holds its rule equal to
  `paletteCss(storedDrawn(cache))` and its mode to `storedPicks`.
- **Catppuccin's roles are written twice**, literal in the built theme's `theme/theme.ts` and in its
  TOML files: the theme build runs before the binding loads, and cannot read the core.
  `__tests__/theme-roles.test.ts` holds the two equal, and Catppuccin's drawn tokens equal to a
  frozen copy of `main`'s, `__tests__/fixtures/catppuccin-today.json`.
- **The palette rule is unlayered**: Astryx declares its tokens in `@layer astryx-theme`, under
  `@scope`; the same rule in a layer missed every surface
  ([`theme/palette.ts`](/packages/web/src/theme/palette.ts)).
- **The palette rule paints `<html>`**: nothing else does, so the first frame showed the browser's
  own canvas whatever the cache held.
- **The in-page list is a raw `role="dialog"`**: Astryx's `Dialog` is always modal, which would
  block the page that is the preview ([`keys/InPage.tsx`](/packages/web/src/keys/InPage.tsx)).
- **A press in the list wakes it**: a phone's tap may send no pointer move first, so a faded list
  stayed at 10% and the tap picked a row barely seen.
- **A cleared storage sends a `storage` event with a null key**, which a filter on the picks' keys
  left out: the provider reads the picks again on it too
  ([`theme.tsx`](/packages/web/src/theme.tsx)).
- **The server's request fixture needs a data view for every root**: the new `Themes` root threw on
  import until it had one
  ([`request-fixture.ts`](/packages/server/src/__tests__/request-fixture.ts)).

## Questions

### Round 01

#### Q1: Which themes ship?

**Answer:** C, the proposal's families plus Gruvbox, Nord, Rosé Pine, Kanagawa, One Dark and One
Light, and Solarized, about 30: "The contrast rule only applies to the default themes", read as the
shipped themes, against the user's.

#### Q2: What happens to an official colour under the contrast floor?

**Answer:** A, only the colours under the floor move, by the smallest step in lightness that reaches
it, keeping the theme's name.

#### Q3: How are the light and the dark theme picked?

**Answer:** A, a mode, System, Light, or Dark, then a dark theme and a light theme, each from its
own list.

#### Q4: Where is the pick of a theme kept?

**Answer:** A, per browser, as the fonts are; the user's themes appear in every browser's lists.

#### Q5: What does a theme name, and what do views ask for?

**Answer:** A, views ask for about 50 roles named by meaning, and a theme maps its private palette
onto them, Catppuccin's mapping giving today's values.

#### Q6: What happens to a custom theme under the contrast floor?

**Answer:** A, it applies as written, the settings page listing each pair under the floor; the floor
covers shipped themes only.

#### Q7: Should headings take a colour per level?

**Answer:** A, a colour per heading level, "but not naming colors": heading roles by level, which
each theme fills, never named for a hue.

#### Q8: Under which name does Monokai ship?

**Answer:** C, no Monokai.

#### Q9: Where do theme files live, and how does the Settings decision change?

**Answer:** A, one file per theme in `themes/` beside `config.toml`, read and checked by the core,
never from a repository, as a new rule of the Settings decision.

#### Q10: In which format is a theme file written?

**Answer:** A, TOML in Helix's shape, with a published JSON Schema for completion.

#### Q11: Should a theme read an existing Base16 or Base24 scheme?

**Answer:** A, no import: a scheme's colours are pasted into the palette and mapped to roles by
hand.

#### Notes

Remove pi's theme: it does not exist, pi generates its colours on the fly from the terminal's.

## Decisions

- [Colour themes](../decisions/colour-themes.md), new: views ask for a colour by its role, never a
  hue; themes map a private palette onto the roles in one TOML format; shipped themes keep their
  published colours except the smallest step to the floor; the user's apply as written.
- [UI look](../ui/look-and-feel.md), changed: colours come from the colour theme picked, not
  Catppuccin; the contrast floor covers every shipped theme; the rule on named schemes moved to
  Colour themes.
- [Settings](../decisions/settings.md), changed: theme files live one per file in a folder beside
  the settings file, read and checked by the core, never from a repository.

## Changes after approval

- From the approval's comment, the faded picker comes back with the same 200 ms animation as it
  fades, where the spec brought it back at once.
- Catppuccin Latte's accents, hand-picked before this feature, and Mocha's faint text are recomputed
  by the floor rule, which wins over the spec's "look unchanged" criterion. Latte's lavender moves
  most, `#4254c8` to `#3654fc`, and sapphire `#04699a` to `#177282`, its hue 200° to 189°. Blue
  (`#1957d5` to `#0a54e5`), mauve (`#7b2fe0` to `#7d26ed`), sky (`#0a688e` to `#036991`), and yellow
  (`#875800` to `#875612`) move noticeably. Peach, red, green, teal, and `overlay2` move by about a
  step, and Latte's cursor row follows its mauve, `#e3def3` to `#e4ddf4`. Mocha moves only its faint
  text, `#969db8` to `#979db5`.
- Four of Catppuccin's grey steps with no role of their own draw the nearest role, a step off
  before: gray text takes `ink`, secondary and gray icons `ink-quiet` and `ink-faint`, skeletons
  `chip`. The pink hue takes `changed`. Five constants Astryx's neutral theme sets stay unmapped.
- In the theme picker, letters search, `j` among them, and the arrows, Ctrl+J and Ctrl+K, and Vim's
  `j` and `k` in Vim mode move the cursor, where the spec's scenario said `j` moves it: the picker
  stays the shared key picker. Any key wakes the faded list, a letter too, and so does a press in
  it.
- The picker closes on a click outside that opens nothing, not on a press, so a scroll on a phone
  keeps it; it closes too when the focus leaves it, as Tab moves it. Its cursor starts on the theme
  in use, so opening it changes nothing, and it floats as the narrow list on a phone too.
- A pointer moving over the page while any layer is open moves no selection, so a card under the
  pointer no longer takes the focus from the picker's field.
- Headings drawn as page or pane titles take their level's colour, as the spec's `# Spec` in mauve
  and `### US1` in green asked, where the plan had kept titles in their own colours.
- Where a view's hue and its meaning differ, the meaning wins: the sandbox badge, orange, takes
  `caution`, yellow, since it warns and asks nothing. With no role for the meaning, the nearest role
  keeps today's colour in Catppuccin but follows that role in other themes. A ledger's changed part
  takes `caution`; an `[!IMPORTANT]` callout's bar the accent; the priorities' Ongoing title `added`
  and Now's `working`; a rule's MUST and SHOULD `added`, SHOULD NOT and MUST NOT `removed`; a list
  row's marks `pane-title`; a worktree pane's border `working`.
- A shipped theme without a published secondary text colour, Dracula and Alucard, draws quiet text
  in its comment colour's floor step, not the foreground mixed over the page; Dracula's moves to
  `#a5aecb`.
- Where a family draws its cursor line in a chip's or a raised pane's tone, the cursor row is
  Uraeda's own mix, commented as such in the file: Solarized's blue at 14% over `base03` and 10%
  over `base3`, Gruvbox's blue at 14% over `dark0` and 10% over `light0`. Rosé Pine takes its Neovim
  port's `highlightLow`. Solarized Dark's text takes Solarized's three tones, and Kanagawa Lotus'
  quiet and faint text its `lotusViolet1`, whose published dim text is darker than its text.
- A theme whose parent has problems of its own says
  `extends "a", which has problems of its own: see its row.` and extends its mode's default; every
  problem ends with a period.

## Follow-ups

- [A syntax role sharing a palette entry with ink-faint takes its stricter floor](../notes/color-themes-a-syntax-role-sharing.md):
  syntax roles need their own floor entries; Nord's comment is lightened 29 points where 18 would
  do.
