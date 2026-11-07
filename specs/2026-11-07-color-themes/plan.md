---
status: auto-approved
spec-revision: 2
---

# Plan: Color themes

**Goal:** the web UI draws every colour from a theme picked per device, one for dark mode and one
for light mode, among 28 shipped themes and the user's own TOML files, and every view asks for a
colour by its role.

**Architecture:** four owners, as the [spec's architecture](spec.md#architecture) lays out. The
core's `themes` module owns the theme file format, the role list, `extends`, every problem a file
can have, and the role-level contrast warnings; it reads the shipped themes, embedded in the binary,
and the user's folder, and returns resolved themes, never failing. The server owns the watch of the
themes folder and serves the result as one fate record, `Themes`, live. The web's `theme/roles.ts`
owns the mapping from a theme's roles to Astryx's tokens and the views' `--role-*` variables, every
derived colour included; `theme/palette.ts` owns the one unlayered rule that applies them, per mode,
over the built theme. `theme.tsx` owns the picks in the browser, their migration, the cache the
first paint reads, and the temporary preview of the picker. Views read `--role-*` variables and
Astryx's semantic tokens only; lint refuses a hue.

The built Astryx theme (`theme/theme.ts`) keeps sizes, fonts, and component rules, and keeps
Catppuccin's colours as its defaults, now computed by the same mapping from two literal role sets
that a test holds equal to the shipped Catppuccin files. So a browser that never picked a theme
paints the same colours before and after the server answers.

A later shipped theme is one TOML file in `crates/core/themes/`, which the contrast test measures at
once. A later view picks a role, or adds one to `ROLES`, the two Catppuccin files, and the mapping.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **Swap and backup files in the themes folder**, `.ember.toml.swp`, `ember.toml~`, or a folder
   called `x.toml`, are not themes: only regular files (symlinks followed) whose name ends in
   `.toml` count, and hidden files are skipped. Task 2.
2. **A file named like a shipped theme in another case**, `Dracula.toml` on a case-insensitive disk,
   is refused like `dracula.toml`: ids compare case-insensitively against shipped ones. Task 2.
3. **A colour with alpha in a text role**, `ink-faint = "#c0c0c080"`, is measured laid over the
   background it is read on, never as if opaque. Task 2's contrast warnings, task 4's mapping.
4. **A corrupt or older cache**, `uraeda.theme.drawn` not JSON, or missing a mode, is ignored: the
   built Catppuccin draws, and the next answer of the server writes it again. Task 6.
5. **The picker closed by Back or a tap outside**, not only Escape, puts back the theme in use: only
   Enter keeps one. Task 8.
6. **A theme file changed while the picker previews it**: the preview redraws with the new colours,
   and Escape still puts back the theme in use. Task 8, by the provider's preview keeping an id, not
   colours.
7. **A theme file that cannot be read as UTF-8, or is huge**, is one problem row, "Could not read:
   …", never a failure of the whole read: `read` never fails. Task 2.

## Global constraints

From [Colour themes](../decisions/colour-themes.md), word for word:

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

From [UI look](../decisions/ui-look.md):

- Every text colour MUST reach 4.5:1 against its background, and borders and controls 3:1, the
  contrast WCAG AA asks for, in every shipped colour theme. Checked by a test of the shipped themes.
- What floats over the page, such as the phone's bottom bars or the leader menu, SHOULD be frosted
  glass: a light tint, what is behind it blurred, and square corners.

From [Settings](../decisions/settings.md):

- Colour themes MUST live one per file in a folder beside the settings file, never read from a
  repository. Checked by the core's tests.
- Finding, reading, validating, and writing the settings and the theme files MUST live in the Rust
  core.

From [UI components](../decisions/ui-components.md):

- Views MUST use Astryx components wherever one fits the job, except text fields, which follow the
  [Text editing](../decisions/text-editing.md) decision. Checked by lint.
- Views MUST be styled only through Astryx's theme, never with a global stylesheet or inline styles.
  Checked by lint.
- A kind of information MUST be drawn by one shared component on every page that shows it.
- A raw element or a plain style MAY stand in where Astryx and StyleX cannot do the job, with its
  reason in a comment, the plan listing it as an Astryx gap. Checked by lint.

From [Stack](../decisions/stack.md):

- Workflow logic, parsing, validation, and states MUST live in the Rust core.
- TypeScript MUST reach the core only through the binding, never reimplementing it.

From [Keyboard](../decisions/keyboard.md):

- A shortcut MUST be declared in the key registry, and listened for nowhere else. Checked by a
  structural test.
- Every action MUST work by keyboard and by tap, never by hover or a single key alone.

From [Testing](../decisions/testing.md):

- A test MUST assert what a caller or a user observes, never how the code does it.
- At the `early` stage, a feature MUST test little beyond stored formats, git, security, contracts
  between the project's parts, pure logic with many cases, and the reproduction of each bug fixed.
- The agent MUST review each changed view in the running app before handing it over, in both themes
  and at a phone's and a desktop's width.

From [Code quality](../decisions/code-quality.md): functions at most 100 lines (clippy and Oxlint),
7 parameters, nesting 4 levels in TypeScript and 5 in clippy's count, files at most 500 lines in
TypeScript, tests exempt. A new marker MUST NOT be added unless a human approves it in the plan:
this plan adds none.

From [Toolchain](../decisions/toolchain.md): after every task, the fast check covers formatting,
lint, types, and the affected focused tests, naming the broader checks it leaves to `ready`; an
agent runs `vp run ready` before pushing.

From [the spec](spec.md), exact values:

- The lists: dark, Catppuccin Mocha, Macchiato, and Frappé; Dracula; GitHub Dark, Dark Dimmed, and
  Dark High Contrast; Gruvbox Dark; Kanagawa Wave and Dragon; Nord; One Dark; Rosé Pine and Rosé
  Pine Moon; Solarized Dark; Tokyo Night, Storm, and Moon. Light, Catppuccin Latte; Alucard; GitHub
  Light and Light High Contrast; Gruvbox Light; Kanagawa Lotus; One Light; Rosé Pine Dawn; Solarized
  Light; Tokyo Night Light (the VS Code theme's "Light"). The user's follow, marked "yours". Each
  list sorts by name, its mode's default first (ruling R3).
- Defaults: `catppuccin-mocha` for dark, `catppuccin-latte` for light. Browser keys `uraeda.theme`
  (`system`, `light`, `dark`; `system` when absent), `uraeda.theme.dark`, `uraeda.theme.light`,
  `uraeda.theme.drawn`. A stored `mocha` reads as the mode `dark`, `latte` as `light`.
- The picker: `Space u t`, a narrow list at the top of the page, dark themes first, the two in use
  marked, no scrim, no preview pane; after 1 second on one row it fades to 10% opacity over 200 ms,
  at once under reduced motion; any key or a pointer move brings it back at once. Enter keeps the
  theme; Escape puts back the one in use. Picking a theme of the other mode switches the mode to it.
- `Space u m` cycles the mode: System, Light, Dark.
- Headings: `heading-1` to `heading-3` by level, deeper levels `heading-3`.
- Theme files name their schema with
  `#:schema https://raw.githubusercontent.com/mrtolkien/uraeda/main/schemas/theme.json`.
- The edge cases' messages, exactly: "Could not read: line 4: …"; "Line 9: needs-you names "embr",
  which is not in the palette."; "extends "x", which no theme is called"; "extends forms a loop: a →
  b → a"; "Give it mode = "dark" or "light"."; "A shipped theme is called dracula: rename the
  file."; "ink-faint is 3.1:1 on page, under 4.5."
- SC-005: a saved theme file redraws the page within 1 second.

## Code read

- [`packages/web/src/theme/theme.ts`](/packages/web/src/theme/theme.ts), 500 lines, at the file
  limit: Latte and Mocha as `[light, dark]` pairs, the hue tokens, the status fills, syntax, and the
  derived tints (`tint`, 12% over base), built by `vp run --filter uraeda-web theme` into
  `theme/built/uraeda.css` and `uraeda.js`, checked unchanged by the `web:theme` task. Its colour
  section moves out (task 4), which also brings it under the limit.
- [`theme/colour.ts`](/packages/web/src/theme/colour.ts) `mix`, and
  [`theme/contrast.ts`](/packages/web/src/theme/contrast.ts) `contrast`, `luminance`: reused.
- [`theme.tsx`](/packages/web/src/theme.tsx): `Scheme`, `storedScheme`, `ThemeModeProvider` (used by
  `App.tsx` line 410), `useScheme` (used by `keys/LeaderKeys.tsx` and `settings/OtherSettings.tsx`).
  Storage errors are swallowed: picks last until reload.
- [`__tests__/theme-tokens.test.ts`](/packages/web/src/__tests__/theme-tokens.test.ts): parses the
  built CSS and measures the pairs `TEXT` (4.5:1) and `CONTROLS` (3:1), plus the scrim and the pane
  border, in two slots. Its pair lists move to a module so the floor script shares them.
- [`__tests__/theme.test.ts`](/packages/web/src/__tests__/theme.test.ts) "the stored value %j reads
  as %s", [`__tests__/categories.test.ts`](/packages/web/src/__tests__/categories.test.ts) rows 20
  to 26, and
  [`__tests__/keys-leader-tree.test.tsx`](/packages/web/src/__tests__/keys-leader-tree.test.tsx)
  line 148: the spec's replaced behaviour.
- [`keys/KeyPicker.tsx`](/packages/web/src/keys/KeyPicker.tsx), 380 lines: one dialog, list and
  preview, a `Dialog` on wide screens with `scrimStyles.unblurred`, a `Sheet` on narrow ones,
  `useBackCloses` for Back, `afterOverlayCloses` before `onPick`. `CursorFooter` reports the cursor.
  [`keys/FontPicker.tsx`](/packages/web/src/keys/FontPicker.tsx) is a picker over it.
- [`keys/LeaderKeys.tsx`](/packages/web/src/keys/LeaderKeys.tsx): `space u t` cycles `NEXT`.
- [`settings/OtherSettings.tsx`](/packages/web/src/settings/OtherSettings.tsx) `AppearanceSettings`,
  and [`settings/categories.ts`](/packages/web/src/settings/categories.ts): the "Colour scheme" row,
  its terms.
- [`ThemeMockups.stories.tsx`](/packages/web/src/ThemeMockups.stories.tsx): the spec's mockups,
  built from real components over fixed data: the start of tasks 6, 7, and 8.
- [`crates/core/src/settings.rs`](/crates/core/src/settings.rs), 444 lines, and `settings/file.rs`:
  `config_dir`, `toml_edit` parsing with line numbers from spans (`line`), the napi objects. Tests
  in [`crates/core/tests/settings.rs`](/crates/core/tests/settings.rs), on a `TempDir`.
- [`crates/core/src/embedded.rs`](/crates/core/src/embedded.rs): `include_dir!`, the pattern for the
  shipped themes.
- [`crates/binding/src/settings.rs`](/crates/binding/src/settings.rs): `job(...)` returning an
  `AsyncTask`, generated into `packages/binding/index.d.ts` by `vp run binding:build`.
- [`packages/server/src/settings.ts`](/packages/server/src/settings.ts) `ServerSettings`,
  [`settings-watch.ts`](/packages/server/src/settings-watch.ts) `FileWatch` (nearest existing
  folder, a symlink's target), [`fate/settings.ts`](/packages/server/src/fate/settings.ts) the
  record, registered in `fate/views.ts` line 480 and `fate/sources.ts` line 450, and
  [`live.ts`](/packages/server/src/live.ts) `announceSettings`, called from `app.ts` line 146. The
  web reads it with `useSettings()` from `data.ts`, as `VimSetting.tsx` does. Tests:
  `packages/server/src/__tests__/settings-watch.test.ts`, `settings-fate.test.ts`.
- [`.storybook/preview.tsx`](/packages/web/.storybook/preview.tsx) `embeddingMode`, and
  [`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx) lines 55 to 87: the mode message
  `{ uraeda: "mode", mode }`.
- [`sandbox/mountSandboxBar.tsx`](/packages/web/src/sandbox/mountSandboxBar.tsx): draws its own
  `data-astryx-theme` wrapper in the page's document, following `data-theme` on `<html>`.
- [`index.html`](/packages/web/index.html): two `theme-color` metas, Latte's and Mocha's page.
- Hues in views, outside `theme/`, tests, and stories: about 90 uses, the most `--color-text-orange`
  (9), `-text-red` (7), `-text-green` (7), `-text-blue` (5), `-icon-red` (5), `-border-orange` (4),
  `-border-green` (4), `-background-gray` (4), `-text-purple` (3), plus `variant="yellow"` and
  `variant="orange"` props; and
  [`fields/editor/markdown.ts`](/packages/web/src/fields/editor/markdown.ts) headings in
  `--color-text-purple`.
- Headings from workflow files: [`Blocks.tsx`](/packages/web/src/Blocks.tsx) line 258,
  [`spec/SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx) line 111,
  [`RoundOpening.tsx`](/packages/web/src/RoundOpening.tsx) line 39, and
  [`Prose.tsx`](/packages/web/src/Prose.tsx)'s markdown (`headingLevelStart={4}`).
- Lint: [`vite.config.ts`](/vite.config.ts) `jsPlugins` and overrides, `tokenLimit`;
  [`packages/web/lint/`](/packages/web/lint/); fixtures in `packages/web/src/__lint__/`, each
  checked by [`__tests__/lint.test.ts`](/packages/web/src/__tests__/lint.test.ts).
- Browser checks: Playwright, used by `packages/web/scripts/shots.ts` (`serveUi` over a
  `FakeAdapter`), runs a real Chromium.
- Validation: `nix develop -c vp check` (format, lint, types), `nix develop -c vp test <file>`,
  `nix develop -c cargo nextest run -p uraeda-core --test <name>`, the binding rebuilt by
  `nix develop -c vp run binding:build`, the theme by
  `nix develop -c vp run --filter uraeda-web theme`, and everything by
  `nix develop -c vp run ready`.

## Constitution check

| I. Humans in control | II. Git and plain text | III. Asynchronous | IV. Review effort | V. Tools optional |
| -------------------- | ---------------------- | ----------------- | ----------------- | ----------------- |
| ✅                   | ✅                     | ✅                | ✅                | ✅                |

## Complexity tracking

| Addition                                                    | Why                                                                                                                                                                          | Simpler alternative rejected                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `uraeda_core::themes`, a module and its submodules          | the format, `extends`, and problems are workflow parsing, which the Stack decision puts in the core                                                                          | parsing in TypeScript: forbidden by the Stack decision                                                                 |
| `theme/roles.ts`, the mapping                               | one home for every derived colour, used by the built theme, the palette rule, the tests, and the floor script                                                                | a mapping per caller: four copies of each tint rule                                                                    |
| `theme/palette.ts`, the rule, and the first paint's script  | the spec's architecture; the script repeats about 15 lines of the rule's text, as it runs before any module loads                                                            | a stylesheet per theme built by Astryx: 28 × 35 KB, and none for the user's themes                                     |
| Catppuccin's roles written twice, `theme.ts` and its TOML   | the theme build runs before the binding is loaded, and cannot read the core; `theme-roles.test.ts` holds the two equal                                                       | building the theme through the binding: a native module in Astryx's build                                              |
| `theme/pairs.ts`, the token pairs shared by test and script | the floor script must measure exactly what the test does                                                                                                                     | the pairs inside the test only: the script would copy them                                                             |
| Two contrast lists, the core's role pairs and the web's     | the core warns a user at the level of roles, which the settings page names; the web measures the derived tokens of shipped themes, as today's test does: different questions | one list in the core: it would have to know every derived token, which the mapping owns                                |
| `KeyPicker`'s in-page mode                                  | the spec keeps one shared picker                                                                                                                                             | a second picker for themes: against the spec                                                                           |
| `FileWatch` gains a folder's entries                        | the themes folder is watched as the settings file is                                                                                                                         | a second watch class: the symlink and nearest-folder logic copied                                                      |
| A lint rule, `colour/roles-not-hues`                        | the decision's "Checked by lint"                                                                                                                                             | `no-restricted-syntax` selectors: they cannot read a hue inside a string like `"var(--color-text-red)"` with a message |

`theme.ts` leaves the file limit (500 lines today) as its colours move to `roles.ts`.
`KeyPicker.tsx` grows to about 450 lines, under the limit.

## Review comments

- **C1** (General: animate the fading out and in from US2): task 8. The list fades out to 10% over
  200 ms after a second, and back in over the same 200 ms on a key or a pointer move, both at once
  under reduced motion. This supersedes the spec's "brings it back at once" for the fade in: the
  list returns over 200 ms, while the key itself acts at once.

## Test map

The core's tests run `uraeda_core::themes::read` on a `TempDir` config folder, with files written by
the test, as `crates/core/tests/settings.rs` does. The web's theme tests run on Node, read the
shipped themes through the real binding (`readThemes` on an empty temporary folder), and map them
with `roles.ts`; no DOM. The UI tests that change render the app with happy-dom through
`__tests__/helpers.tsx`. The real browser checks are Playwright scripts run by hand in tasks 1 and
6, not in `ready`.

| Spec item                                                         | Task | Check                                                                                               |
| ----------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| Unverified: the palette rule wins in every surface                | 1    | `scripts/palette-probe.ts`, in Chromium                                                             |
| US1.1 the system switches to dark at sunset                       | 6    | none: the browser's `prefers-color-scheme`, as today; seen in the running app                       |
| US1.2 the phone keeps its own default                             | 6    | `theme.test.ts`, nothing stored reads as System with both defaults                                  |
| US1.3 Mocha picked before reads as Mocha in Dark                  | 6    | `theme.test.ts`, "the stored value %j reads as %j"                                                  |
| US1 more 1, first frame and sign-in page in Dracula               | 6    | `palette-probe.ts --first-paint`; SC-003                                                            |
| US1 more 2, story frames and the sandbox bar                      | 9, 1 | none: drawn by the same rule, checked by task 1's probe; seen in the running app                    |
| US2.1 the app drawn in Nord, Escape draws Mocha                   | 8    | `theme-picker.test.tsx`, "Escape puts back the theme in use"                                        |
| US2.2 the fade after a second, `j` brings it back                 | 8    | none: a timing seen in use; the testing decision bars elapsed time in unit tests                    |
| US2.3 a light theme picked in dark mode switches the mode         | 8    | `theme-picker.test.tsx`, "a light theme picked in dark mode becomes the light theme, in Light mode" |
| US2 more 1 and 2, pointer and reduced motion                      | 8    | none: seen in use                                                                                   |
| US3.1 `ember.toml` joins the dark list; only `needs-you` changes  | 2    | `themes.rs`, "a theme extending Mocha changes only the roles it sets"                               |
| US3.2 a saved change redraws within a second; SC-005              | 3    | `themes-watch.test.ts`, "a theme file written is served again"                                      |
| US3.3 `dusk.toml` under the floor applies, its row names the pair | 2    | `themes.rs`, "a role under the floor is applied and named"                                          |
| US3 more 1, a role naming a missing palette entry                 | 2    | `themes.rs`, the problems table, row "missing palette entry"                                        |
| US4.1 a spec's headings mauve, blue, green                        | 4    | `theme-roles.test.ts`, SC-001 (Catppuccin's heading roles); drawn by task 7, seen in use            |
| US4.2 a theme of yours sets `heading-2`                           | 2    | covered by US3.1's test: any role a file sets                                                       |
| Edge: not valid TOML                                              | 2    | `themes.rs`, problems table, "Could not read: line …"                                               |
| Edge: bad colour or missing palette entry                         | 2    | `themes.rs`, problems table                                                                         |
| Edge: a picked theme of yours deleted                             | 6    | `theme.test.ts`, "an unknown pick draws its mode's default"                                         |
| Edge: unknown `extends`, loop, other mode, no mode, shipped name  | 2    | `themes.rs`, problems table, a row each                                                             |
| Edge: unknown role key                                            | 2    | `themes.rs`, problems table                                                                         |
| Edge: a shipped colour under the floor                            | 4, 5 | `theme-roles.test.ts`, "every floor step of %s is the smallest"                                     |
| Edge: no themes folder                                            | 2    | `themes.rs`, "no folder: the shipped themes only"; the row's text seen in use                       |
| Edge: storage refused                                             | 6    | none: unchanged code path of today's `store`                                                        |
| Edge: a symlinked config folder                                   | 3    | `themes-watch.test.ts`, "a symlinked themes folder is followed"                                     |
| SC-001 Catppuccin unchanged                                       | 4    | `theme-roles.test.ts`, "Catppuccin draws today's %s"                                                |
| SC-002 the floor in every shipped theme                           | 4, 5 | `theme-tokens.test.ts`, every pair, every shipped theme                                             |
| SC-003 no flash                                                   | 6    | `palette-probe.ts --first-paint`                                                                    |
| SC-004 no hue in views                                            | 7    | `lint.test.ts`, "lint refuses a hue in a string, a member key, and a prop"; and `vp check`          |
| Review focus 1, 2, 7                                              | 2    | `themes.rs`, problems table rows                                                                    |
| Review focus 3, alpha in a text role                              | 2    | `themes.rs`, problems table, row "alpha measured over the page"                                     |
| Review focus 4, a corrupt cache                                   | 6    | `theme.test.ts`, a row of the drawn cache's table                                                   |
| Review focus 5, Back and tap outside                              | 8    | none beyond Escape's test: all three close through `onOpenChange(false)`, one path                  |
| Review focus 6, a file changed during a preview                   | 8    | none: the preview keeps an id; seen in use                                                          |

## Waves

1. Tasks 1 and 2: the probe touches only a script; the core only Rust, the binding, the schema, and
   the docs.
2. Tasks 3 and 4: the server, and the web's theme folder; both consume task 2's binding.
3. Tasks 5, 6, and 7: theme files only; the picks, the provider, Appearance, and the mode key; the
   views, the lint, and the headings. Shared: `ThemeMockups.stories.tsx`, each task editing its own
   story (Appearance in 6, Headings in 7), and `docs/web-ui.md`, each adding its own section.
4. Tasks 8 and 9: the picker and `Space u t`; the story frames. No file in common.

---

## Task 1: Check that a palette rule wins in every surface

**Files:**

- Create: `packages/web/scripts/palette-probe.ts`

**Interfaces:**

- Produces: `node packages/web/scripts/palette-probe.ts`, which task 6 extends with `--first-paint`.

- [x] **Step 1: Write the probe**

A Playwright script in Chromium over `serveUi` (`scripts/shots.ts`) and a `FakeAdapter`, as the
shots scripts do. In each mode it loads Home, adds one unlayered `<style>` at the end of the page's
`<head>`:

```css
[data-astryx-theme="uraeda"][data-theme="dark"] {
  --color-background-body: #ff0000;
  --color-background-surface: #ff00ff;
  --color-border: #0000ff;
  --color-text-primary: #00ff00;
}
```

and the same for `light`, then reads, on each surface, the four tokens as computed there and a
painted colour: the page's background (the element painting beside the panes, which draws
`--color-background-surface`), Astryx's `Theme` wrapper, a pane's background, border, and text, a
dialog opened by `Space u f i` (Astryx portals it) and its option's text, a `Selector`'s popover on
`/settings/fonts` and its option's text, and the sandbox bar, mounted in the page's document as the
sandbox page mounts it (`mountSandboxBar`). It also starts `storybook dev`, loads the `Sandbox/Bar`
story's `iframe.html`, posts it the mode as an embedding page does (`{ uraeda: "mode", mode }`),
adds the same rule to the frame's document, and reads the tokens on its root element and its
wrapper: no element paints a story's background, with the built theme as with the rule (R7). It
prints which elements carry the theme's attributes, one line per surface, `ok` or what it read, and
exits non-zero on any miss.

- [x] **Step 2: Run it**

- Run: `nix develop -c node packages/web/scripts/palette-probe.ts`
- Expected: every surface `ok`. On a miss, stop the build here and go back to the human, as the
  spec's approval block says: each theme would then be its own built stylesheet.

- [x] **Step 3: Commit**

```bash
git add packages/web/scripts/palette-probe.ts specs/2026-11-07-color-themes/plan.md
git commit -m "test(color-themes): a palette rule wins over the built theme in every surface"
```

The body lists each surface and what the probe read.

## Task 2: Theme files in the core

**Risky:** a new file format, read from the user's config folder, which every shipped theme also
uses.

**Files:**

- Create: `crates/core/src/themes.rs`, and submodules under `crates/core/src/themes/` as the code
  needs (parsing, resolving, contrast), each under the limits
- Create: `crates/core/themes/catppuccin-mocha.toml`, `crates/core/themes/catppuccin-latte.toml`
- Create: `schemas/theme.json`
- Create: `crates/binding/src/themes.rs`
- Modify: `crates/core/src/lib.rs`, `crates/core/build.rs` (rebuilds when a shipped theme changes),
  `crates/binding/src/lib.rs`, `packages/binding/index.d.ts`, `index.js` (generated),
  `packages/server/src/binding.ts` (`SOURCES` gains `crates/core/themes`, so a changed theme makes
  the built binding stale)
- Modify: `docs/web-ui.md` (a "Colour themes" section), `vite.config.ts` and `vite.tasks.ts` only if
  the schema needs a format or a `ready` input
- Test: `crates/core/tests/themes.rs`

**Interfaces:**

- Produces, in `uraeda_core::themes`:
  - `pub const ROLES: &[&str]`: the data model's roles, in its order: `page`, `raised`, `sunken`,
    `chip`, `cursor-row`, `marked`, `rule`, `pane-title`, `ink`, `ink-quiet`, `ink-faint`, `action`,
    `on-action`, `needs-you`, `changed`, `added`, `removed`, `caution`, `context`, `yours`, `link`,
    `working`, `live`, `example`, `sub-agent`, `heading-1`, `heading-2`, `heading-3`, `code-inline`,
    `quote`, `mode-normal`, `mode-insert`, `mode-visual`, `mode-replace`, `mode-command`,
    `code-ground`, and `syntax-keyword`, `-string`, `-comment`, `-number`, `-constant`, `-function`,
    `-type`, `-operator`, `-property`, `-punctuation`, `-tag`, `-attribute`, `-variable`.
  - napi objects (camelCase in TypeScript):
    - `Theme { id: String, name: String, mode: String /* "dark" | "light" */, is_shipped: bool, roles: HashMap<String, String> /* every role, "#rrggbb" or "#rrggbbaa", lower case */, palette: HashMap<String, String> /* merged with the extended themes' */, sources: HashMap<String, String> /* role → the palette name it took, for roles that name one */ }`
    - `ThemeProblem { line: Option<u32>, message: String, is_warning: bool }`
    - `ThemeFile { file: String /* "ember.toml" */, id: String, name: String, mode: Option<String>, extends: Option<String>, is_listed: bool, problems: Vec<ThemeProblem> }`
    - `Themes { folder: String /* "~/.config/uraeda/themes/", as settings show their file */, themes: Vec<Theme>, files: Vec<ThemeFile> }`
  - `pub fn read(config_dir: &Path) -> Themes`: never fails. `themes` holds the shipped themes and
    the listed user themes, dark ones first, each mode's default first, then its shipped themes by
    name, then the user's by name (R3, R8); `files` holds every user file, sorted by file name.
  - `pub fn shipped_files() -> Vec<ThemeFile>`: the shipped files' rows, which a test holds free of
    problems.
  - `pub fn themes_dir(config_dir: &Path) -> PathBuf`: `config_dir.join("themes")`.
  - `pub const DEFAULT_DARK: &str = "catppuccin-mocha"`, `DEFAULT_LIGHT: &str = "catppuccin-latte"`.
- Produces, in the binding: `readThemes(dir: string): Promise<Themes>`, and
  `themesFolder(dir: string): string` (the folder's path, for the server's watch).

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/themes.rs`, on a `TempDir` with a `themes/` folder the test fills:

- "no folder: the shipped themes only": `read` on an empty config folder lists `catppuccin-mocha`
  and `catppuccin-latte`, `files` empty, `folder` ending in `themes/`.
- "every shipped theme sets every role, or extends one that does": for each shipped theme, its
  `roles` has every entry of `ROLES`, each a `#` colour. Breaks: a role added to `ROLES` and
  forgotten in a shipped file.
- "a theme extending Mocha changes only the roles it sets": US3.1's `ember.toml` (the data model's
  example with `needs-you = "ember"`, `#ff7a45`): it is listed, dark, named "Ember", its `needs-you`
  is `#ff7a45`, and every other role equals Mocha's except those its `[roles]` sets. Breaks: a
  palette entry overriding a role by name; roles copied from the wrong mode's default.
- "an inherited role resolves against the child's palette": a file extending Mocha whose `[palette]`
  redefines the name Mocha's `ink` uses: its `ink` is the new colour. Breaks: inherited roles copied
  as colours instead of names (R2).
- "a role under the floor is applied and named": `dusk.toml`, light, `ink-faint` at 3.1:1 on its
  `page`: its `ink-faint` is the written colour, and one warning reads exactly
  `ink-faint is 3.1:1 on page, under 4.5.` Breaks: a theme refused or a colour raised.
- A table, "%s: %s", one row per problem, each asserting the file's `is_listed`, and one problem's
  `message` and `line` (the message alone, not the whole list):

  | Row                          | File                                                     | Listed | Message                                                                          |
  | ---------------------------- | -------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
  | not TOML                     | `mode = "dark"` then a line 4 `roles = [`                | no     | starts with `Could not read: line 4: `                                           |
  | missing palette entry        | line 9 `needs-you = "embr"`                              | yes    | `Line 9: needs-you names "embr", which is not in the palette.`                   |
  | bad colour                   | `ink = "#12345"`                                         | yes    | `Line N: ink is "#12345", which is not a colour: write #rrggbb or #rrggbbaa.`    |
  | unknown extends              | `extends = "x"`, `mode = "dark"`                         | yes    | `extends "x", which no theme is called.`                                         |
  | loop                         | `a.toml` extends `b`, `b.toml` extends `a`               | no     | `extends forms a loop: a → b → a.` (in `a`'s row)                                |
  | other mode                   | `mode = "light"`, `extends = "catppuccin-mocha"`         | no     | `extends "catppuccin-mocha", a dark theme, while this one is light.`             |
  | no mode                      | only `[roles]`                                           | no     | `Give it mode = "dark" or "light".`                                              |
  | shipped name                 | `dracula.toml`, and `Catppuccin-Mocha.toml`              | no     | `A shipped theme is called catppuccin-mocha: rename the file.`                   |
  | unknown role                 | `[roles]` `inkk = "#ffffff"`                             | yes    | `Line N: inkk is not a role, and is ignored.` (a warning)                        |
  | bad mode                     | `mode = "dim"`                                           | no     | `Line N: mode is "dim": write "dark" or "light".`                                |
  | not a theme file             | `.ember.toml.swp`, `ember.toml~`, a folder `x.toml`      | -      | no row at all (review focus 1)                                                   |
  | not UTF-8                    | bytes `0xff 0xfe`                                        | no     | starts with `Could not read: `                                                   |
  | alpha measured over the page | light theme, `ink-faint = "#00000040"` on a white `page` | yes    | `ink-faint is 1.8:1 on page, under 4.5.`, the ratio of the colour laid over page |

  Use the spec's `dracula.toml` example once the Dracula file ships; until then, the row uses
  `catppuccin-mocha` as above. Breaks: a problem that drops every theme (each row also asserts the
  shipped themes still listed); a case-sensitive name check (review focus 2).

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test themes`
- Expected: FAIL to compile, `unresolved import uraeda_core::themes`.

- [x] **Step 3: Write the two Catppuccin files and the schema**

`catppuccin-mocha.toml` and `catppuccin-latte.toml` start with the `#:schema` line, a comment naming
the source (Catppuccin's `palette.json` v1.8.0, MIT, its URL), and hold Catppuccin's published
palette under its own names (`base`, `mantle`, `crust`, `surface0`, …), then every role. Each role's
value is today's Mocha or Latte value from [`theme.ts`](/packages/web/src/theme/theme.ts), through
the data model's Mocha column and the matching Latte token: `ink-quiet` is Latte's `subtext1`,
`sunken` Latte's `mantle`, `chip` Latte's `crust`, `on-action` Latte's white, `sub-agent` Latte's
own teal `#179299`, `cursor-row` the hex of today's mix (14% mauve over Mocha's base, 10% over
Latte's). A colour today's theme darkens or lightens past the published one (Latte's accents,
Mocha's `dim`) is a palette entry named `<published>-floor`, with today's value for now: task 4 sets
it by the floor rule (R4). Colours Catppuccin does not publish, such as white, are palette entries
with a comment saying so.

`schemas/theme.json`: a JSON Schema (draft 2020-12) of the format, `additionalProperties: false` at
the top, `mode` an enum, `[palette]` values matching `^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`, `[roles]`
with one property per role, each a string, and a `description` on each, from the data model's "Where
it draws" column, so an editor shows it.

- [x] **Step 4: Implement `uraeda_core::themes` and the binding**

- Shipped themes: every file of `crates/core/themes/`, embedded with `include_dir!`, as
  `embedded.rs` does; their parse problems panic in a test, never at run time (a test reads them
  all).
- The user's files: `themes_dir(config_dir)`, its entries filtered as review focus 1 says, read as
  UTF-8, parsed with `toml_edit` (already a dependency) so problems carry lines, as
  `settings/file.rs`'s `line` does.
- Resolution (R2): a file's palette is its parent's merged with its own; each role takes its own
  value, else its parent's expression (a palette name or a colour), resolved against the merged
  palette; a name missing from it is the problem above, and the role takes the parent's resolved
  colour. No `extends` means its mode's default. Cycles are found by walking `extends`, as Helix's
  loader does. A theme whose file has an error that unlists it is in `files` only.
- Contrast warnings (user files only), at the level of roles, with `contrast.rs` mirroring
  `theme/contrast.ts` (WCAG 2.x, a colour with alpha laid over its background first): at 4.5:1 the
  roles `ink`, `ink-quiet`, `ink-faint`, `pane-title`, `action`, `needs-you`, `changed`, `added`,
  `removed`, `caution`, `context`, `yours`, `link`, `working`, `live`, `example`, `heading-1` to
  `-3`, `code-inline`, `quote` on `page` and on `raised`, and every `syntax-*` on `code-ground`; at
  3:1, `rule`, `sub-agent`, and `marked` on `page` and on `raised`. The ratio is printed truncated
  to one decimal, so 4.46 prints 4.4, never "4.5:1, under 4.5".
- The binding's `readThemes` runs `read` in a `job`, as `readSettings` does.

- [x] **Step 5: Document the format**

`docs/web-ui.md`, a "Colour themes" section after "Settings": where the files go, the format with
the data model's example, the roles table (role, what it draws, Mocha's value), `extends` and the
palette, what a problem does, and "copy a shipped theme from `crates/core/themes/` to start". It
links `schemas/theme.json` for completion in editors through Taplo.

- [x] **Step 6: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test themes`, then
  `nix develop -c vp run binding:build`, then `nix develop -c vp check`
- Expected: PASS. Deferred to `ready`: the full Rust suite, clippy, and the TypeScript tests.

- [x] **Step 7: Commit**

```bash
git add crates/core crates/binding packages/binding/index.d.ts packages/binding/index.js packages/server/src/binding.ts schemas docs/web-ui.md specs/2026-11-07-color-themes/plan.md specs/2026-11-07-color-themes/rulings.md
git commit -m "feat(color-themes): theme files in the core, with their problems"
```

The body names each break the tests caught, as made and reverted.

## Task 3: The themes' watch and their record

**Files:**

- Create: `packages/server/src/themes.ts`, `packages/server/src/fate/themes.ts`
- Modify: `packages/server/src/settings-watch.ts` (`FileWatch` watches a folder's entries too),
  `packages/server/src/fate/views.ts`, `fate/sources.ts`, `fate/context.ts` if the context needs it,
  `packages/server/src/live.ts` (`announceThemes`), `app.ts`, `server.ts` (open and close it beside
  the settings), `packages/server/src/testing.ts` if tests build the context there
- Create: `packages/web/src/useThemes.ts` (`useThemes`, `ThemesRecord`): `data.ts` is at the
  500-line limit (ruling R10)
- Modify: `packages/server/src/__tests__/helpers.ts` and `packages/web/src/__tests__/helpers.tsx`,
  whose apps take the themes beside the settings (`testThemes` in `testing.ts`)
- Test: `packages/server/src/__tests__/themes-watch.test.ts`

**Interfaces:**

- Consumes: `readThemes(dir)`, `themesFolder(dir)`, the `Themes` type (task 2).
- Produces:
  - `class ServerThemes { static open(options: { binding: Binding; dir: string }): Promise<ServerThemes>; current(): Themes; onChange(listener: () => void): () => void; close(): void }`,
    reading again after `LIST_QUIET_MS` of quiet, as `ServerSettings` does.
  - The fate record `Themes`, id `themes`:
    `{ id: string; folder: string; themes: Array<Theme>; files: Array<ThemeFile> }`, readable on
    every endpoint as `Settings` is, and sent live on each change by
    `announceThemes(themes, hosts)`.
  - `startServer` opens the themes on the settings' config folder and closes them as it stops;
    `createApp` and fate's `Context` take them as `themes: ServerThemes`.
  - In the web, `useThemes(): ThemesRecord | null` from `useThemes.ts`, null until signed in or
    loaded, as `useSettings()` is.

- [x] **Step 1: Write the failing tests**

`themes-watch.test.ts`, on a temporary config folder, with the real binding and real file events,
waiting on `onChange` (no sleeps):

- "a theme file written is served again": open, write `themes/ember.toml` (made after opening, the
  folder too), await the change, and `current().themes` has `ember`. Then change its colour and
  await again: its `needs-you` is the new one. SC-005: the change arrives under 1 second, by a
  timeout of 1000 ms on the wait.
- "a symlinked themes folder is followed": `themes` a symlink to another folder; a file written in
  the target is served.

The break each catches: a watch on the config folder only, which misses edits inside `themes/`; a
watch on the link's own folder, which misses the target's edits.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/server/src/__tests__/themes-watch.test.ts`
- Expected: FAIL, `Failed to resolve import "../themes.ts"`.

- [x] **Step 3: Implement the watch, the record, and `useThemes`**

`FileWatch` takes an option to report every entry of a folder, so the themes folder's entries, its
creation from the nearest folder above, and a symlinked folder's target are watched with the code
that already follows the settings file. The record, its registration, and its live update follow
`Settings`' at each place the code read lists. A failed read keeps the last value and prints once,
as the settings do.

- [x] **Step 4: Run the task's validation**

- Run:
  `nix develop -c vp test packages/server/src/__tests__/themes-watch.test.ts packages/server/src/__tests__/settings-watch.test.ts packages/server/src/__tests__/settings-fate.test.ts`,
  then `nix develop -c vp check`
- Expected: PASS. Deferred to `ready`: the other server tests.

- [x] **Step 5: Commit**

```bash
git add packages/server packages/web/src/useThemes.ts packages/web/src/__tests__/helpers.tsx specs/2026-11-07-color-themes/plan.md specs/2026-11-07-color-themes/rulings.md
git commit -m "feat(color-themes): the themes folder watched and served live"
```

## Task 4: The role mapping, the palette rule, and the contrast tests

**Risky:** the rule every view's colour goes through, and the contrast floor of every shipped theme.

**Files:**

- Create: `packages/web/src/theme/roles.ts`, `packages/web/src/theme/palette.ts`,
  `packages/web/src/theme/pairs.ts`, `packages/web/src/theme/floor.ts`,
  `packages/web/scripts/theme-floor.ts`
- Modify: `packages/web/src/theme/theme.ts` (its colours from `roles.ts`),
  `packages/web/package.json` (`#theme-roles` import), `packages/web/src/theme/built/*` (rebuilt),
  `crates/core/themes/catppuccin-latte.toml`, `catppuccin-mocha.toml` (the `-floor` entries)
- Test: `packages/web/src/__tests__/theme-roles.test.ts` (new),
  `packages/web/src/__tests__/theme-tokens.test.ts` (rewritten),
  `packages/web/src/__tests__/fixtures/catppuccin-today.json` (made in step 1)

**Interfaces:**

- Consumes: `readThemes`, `Theme` (task 2).
- Produces:
  - `roles.ts`: `export type Roles = Readonly<Record<string, string>>`,
    `export type Tokens = Readonly<Record<string, string>>`, and
    `export function tokensOf(roles: Roles, mode: "dark" | "light"): Tokens`, every colour token of
    the built theme that the mapping sets plus `--role-<role>` for every role and
    `--role-<role>-tint` for `action`, `needs-you`, `changed`, `added`, `removed`, `caution`,
    `context`, `yours`, `link`, `working`, `live`, `example`, `sub-agent` (12% over `page`); and
    `MEDIA`, the constants `--color-on-dark` and `--color-on-light` (R5), `TINTED`, and `Mode`.
  - `palette.ts`:
    `export function applyPalette(tokens: { dark?: Tokens; light?: Tokens }, doc?: Document): void`,
    which writes one `<style id="uraeda-palette">` in `doc.head` (the page's by default) with a
    block per given mode, selector `[data-astryx-theme="uraeda"][data-theme="<mode>"]`, unlayered;
    and `export function paletteCss(tokens: { dark?: Tokens; light?: Tokens }): string`, its text.
  - `pairs.ts`: `TEXT_PAIRS`, `CONTROL_PAIRS` (the scrim over white and the pane border on a card
    and the muted background included), `export function ratio(tokens, front, back): number`, and
    `export function failures(tokens: Tokens): Array<{ back: string; front: string; ratio: number; floor: number }>`.
  - `floor.ts`:
    `export function floorStep(colour: string, passes: (colour: string) => boolean, away: "lighter" | "darker"): string`;
    `hslOf(colour)` and `fromHsl(hue, saturation, lightness)`; and
    `export function entryPasses(theme: { mode; roles; sources }, entry: string, colour: string): boolean`,
    whether every pair a role naming the palette entry feeds passes with the entry in `colour`.

The mapping, which the plan pins as SC-001's test checks it (`tint(x)` is `mix(x, 0.12, page)`; "a"
appends an alpha in hex):

| Tokens                                                                                                                                   | From                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--color-background-body`, `-card`                                                                                                       | `page`                                                                                                 |
| `--color-background-surface`, `-popover`                                                                                                 | `raised`                                                                                               |
| `--color-background-muted`                                                                                                               | `sunken`                                                                                               |
| `--color-background-gray`, `--color-skeleton`                                                                                            | `chip`                                                                                                 |
| `--color-accent-muted`                                                                                                                   | `cursor-row`                                                                                           |
| `--color-selection`, `--color-selection-edge`                                                                                            | `tint(marked)`, `marked`                                                                               |
| `--color-border`, `-emphasized`, `-gray`, `--color-icon-disabled`                                                                        | `rule`                                                                                                 |
| `--color-text-lavender`                                                                                                                  | `pane-title`                                                                                           |
| `--color-text-primary`, `--color-icon-primary`, `--color-text-gray`                                                                      | `ink`                                                                                                  |
| `--color-text-secondary`, `--color-icon-secondary`                                                                                       | `ink-quiet`                                                                                            |
| `--color-text-disabled`, `--color-icon-gray`                                                                                             | `ink-faint`                                                                                            |
| `--color-accent`, `--color-text-accent`, `--color-icon-accent`, status fill accent                                                       | `action`                                                                                               |
| `--color-on-accent`, `-on-error`, `-on-success`, `-on-warning`                                                                           | `on-action`                                                                                            |
| hue `orange`, `purple`, `green`, `red`, `yellow`, `blue`, `teal`, `cyan`, `pink`: `text`, `border`, `icon`, and `background` as the tint | `needs-you`, `changed`, `added`, `removed`, `caution`, `link`, `example`, `syntax-operator`, `changed` |
| `--color-success`, `-error`, `-warning`, their status fills, and `-muted` as the tint                                                    | `added`, `removed`, `caution`                                                                          |
| status muted accent                                                                                                                      | `tint(context)`                                                                                        |
| `--color-fill-teal`; `--color-border-sapphire`, `--color-text-sapphire`                                                                  | `sub-agent`; `live`                                                                                    |
| the syntax theme's tokens; its background                                                                                                | `syntax-*`; `code-ground`                                                                              |
| `--color-syntax-added`, `-removed`; their markers                                                                                        | `added` at 18% light, 16% dark, `removed` at 16%, over `code-ground`; the role                         |
| `--color-neutral`, `--color-overlay-hover`, `-pressed`                                                                                   | `ink` at `0f` light, `1a` dark; `ink` `0d`; `ink` `1a`                                                 |
| `--color-overlay`, `--color-shadow`                                                                                                      | light `ink` `b3`, dark `sunken` `cc`; light `ink` `1a`, dark `sunken` `4d`                             |
| `--color-on-dark`, `--color-on-light`                                                                                                    | not mapped: the built theme's constants, drawn over media (R5)                                         |

- [x] **Step 1: Freeze today's Catppuccin, then write the failing tests**

Before any change, write `__tests__/fixtures/catppuccin-today.json`: every colour token of today's
built CSS resolved in each slot, `{ "light": { token: "#…" }, "dark": { … } }`, with a one-off
script or the old test's `resolve`. Then:

`theme-roles.test.ts`:

- "Catppuccin draws today's %s", one row per token and mode:
  `tokensOf(catppuccin-<mode>'s roles, mode)[token]` equals the fixture, except the tokens of R5's
  list and the `-floor` changes of R4, each named in an `EXCEPT` map with its ruling. Breaks: a
  mapping row wrong, the fixture's value differing.
- "the built theme draws the shipped Catppuccin": the built CSS's colours equal `tokensOf` of the
  binding's two Catppuccin themes, every token. Breaks: `theme.ts`'s literal roles drifting from the
  TOML files.
- "every floor step of %s is the smallest", one row per shipped theme: each palette entry named
  `<x>-floor` has an entry `<x>`; it is `floorStep(<x>, …)` for the pairs its roles are in, which
  means: it is `fromHsl` of `<x>`'s hue and saturation at a whole percent of lightness, every pair
  its roles are in passes with it (`entryPasses`), and one step back toward `<x>` makes a pair fail.
  Breaks: a floor colour picked by hand, or two steps past the floor.
- "with the hand-picked floors, Catppuccin draws today's %s", one row per R4 exception: the roles
  with the entries R4 recomputed put back at their hand-picked colours draw the fixture, so the
  light rows the floors moved are still checked. The neutral theme's own colours are exceptions too
  (R11).

`theme-tokens.test.ts`, rewritten: the same pairs, from `pairs.ts`, measured on `tokensOf(theme)`
for every shipped theme the binding returns, its mode only: "in %s, %s reads at 4.5:1 on %s" and "in
%s, %s stands 3:1 from %s", the scrim and the pane border rows kept. Today's tests become its
Catppuccin rows.

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/theme-roles.test.ts`
- Expected: FAIL, `Failed to resolve import "../theme/roles.ts"`.

- [x] **Step 3: Implement the mapping, the rule, the pairs, and the floor step**

- `roles.ts` as the table above, with `mix` from `colour.ts`.
- `theme.ts`: its `LATTE` and `MOCHA` hue objects become two literal role sets, `LATTE_ROLES` and
  `MOCHA_ROLES`, whose colour tokens and syntax come from `tokensOf`, paired `[light, dark]`; the
  rest of the file is unchanged. Rebuild `built/`.
- `floor.ts`: from the colour's HSL lightness rounded to a whole percent, step 1% at a time in the
  direction `away`, hue and saturation kept, until `passes`; return `#rrggbb` (R4).
- `scripts/theme-floor.ts`: for each shipped theme, maps it, lists the failing pairs, and prints for
  each failing role the palette entry it names and its `floorStep`, as TOML lines to paste.
- The Catppuccin files' `-floor` entries: run the script, and set each to its output (R4). Then
  `theme.ts`'s literals to match, and rebuild.

- [x] **Step 4: Run the task's validation**

- Run:
  `nix develop -c vp test packages/web/src/__tests__/theme-roles.test.ts packages/web/src/__tests__/theme-tokens.test.ts`,
  `nix develop -c vp run --filter uraeda-web theme`, then `nix develop -c vp check`
- Expected: PASS, the theme build unchanged after the rebuild. Deferred to `ready`: the UI tests,
  Storybook's build.

- [x] **Step 5: Commit**

```bash
git add packages/web crates/core/themes specs/2026-11-07-color-themes
git commit -m "feat(color-themes): roles mapped to the theme's tokens, measured in every shipped theme"
```

The body lists each Catppuccin token that changed, old and new, and the break each test caught.

## Task 5: The shipped themes

**Files:**

- Create: in `crates/core/themes/`, `catppuccin-macchiato.toml`, `catppuccin-frappe.toml`,
  `dracula.toml`, `alucard.toml`, `github-dark.toml`, `github-dark-dimmed.toml`,
  `github-dark-high-contrast.toml`, `github-light.toml`, `github-light-high-contrast.toml`,
  `gruvbox-dark.toml`, `gruvbox-light.toml`, `kanagawa-wave.toml`, `kanagawa-dragon.toml`,
  `kanagawa-lotus.toml`, `nord.toml`, `one-dark.toml`, `one-light.toml`, `rose-pine.toml`,
  `rose-pine-moon.toml`, `rose-pine-dawn.toml`, `solarized-dark.toml`, `solarized-light.toml`,
  `tokyo-night.toml`, `tokyo-night-storm.toml`, `tokyo-night-moon.toml`, `tokyo-night-light.toml`
- Modify: `crates/core/tests/themes.rs` (the shipped-name row uses `dracula.toml`, as the spec's;
  the order test leaves out the other shipped themes, R12), `__tests__/theme-roles.test.ts` (the
  floors a theme's roles name, R12)

**Interfaces:**

- Consumes: the format (task 2), `scripts/theme-floor.ts` and the tests (task 4).
- Produces: the 26 files, each read by every test that iterates the shipped themes.

- [x] **Step 1: Write each theme from its published source**

Each file: the `#:schema` line, a comment naming the source, its version or commit, its licence, and
its URL, then the published palette under the source's own names, then `[roles]`. The source of each
family: Catppuccin's `palette.json` v1.8.0; Dracula's spec (draculatheme.com/spec, Dracula and
Alucard); `@primer/primitives` v11.10.0's functional tokens; Gruvbox (morhetz/gruvbox, its contrast
"medium"); Kanagawa (rebelot/kanagawa.nvim, Wave, Dragon, Lotus); Nord (nordtheme); One Dark and One
Light (Atom's `one-dark-syntax`, `one-light-syntax`); Rosé Pine (rose-pine/palette); Solarized
(Ethan Schoonover's); Tokyo Night (folke/tokyonight.nvim for Night, Storm, Moon; the VS Code theme
for Light). A variant of a family may extend its first file and swap the palette (R2).

Map roles by meaning, as the family's own editor ports do, each theme's character its own: its
background ramp onto `page`, `raised`, `sunken`, `chip`; its selection onto `cursor-row`; its
comment colour onto `ink-faint` and `syntax-comment`; its accent onto `action`; its warm colour onto
`needs-you`; its diff colours onto `added` and `removed`. Every role the file leaves out comes from
what it extends; a family's first file sets every role.

- [x] **Step 2: Run the floor script, and adjust**

- Run: `nix develop -c node packages/web/scripts/theme-floor.ts`
- Expected: a list of failing roles per theme. Add each printed `-floor` entry to its file and point
  the roles at it; run again until it prints nothing.

- [x] **Step 3: Run the task's validation**

- Run: `nix develop -c vp run binding:build`, then
  `nix develop -c vp test packages/web/src/__tests__/theme-tokens.test.ts packages/web/src/__tests__/theme-roles.test.ts`,
  then `nix develop -c cargo nextest run -p uraeda-core --test themes`
- Expected: PASS, 28 shipped themes measured. Deferred to `ready`: the rest.

- [x] **Step 4: Commit**

```bash
git add crates/core/themes crates/core/tests/themes.rs specs/2026-11-07-color-themes/plan.md
git commit -m "feat(color-themes): 26 more shipped themes, at the contrast floor"
```

The body lists each theme's colours moved to the floor, published and shipped.

## Task 6: The picks, the provider, the first paint, Appearance, and the mode key

**Risky:** the format of the picks stored in every browser, and their migration.

**Files:**

- Start from: `ThemeMockups.stories.tsx#AppearanceSection` and `#NoThemesYet`
- Create: `packages/web/src/settings/AppearanceSettings.tsx` (`AppearanceSettings` and the rows it
  draws, `AppearanceRows`, moved out of `OtherSettings.tsx`), `settings/sampleThemes.ts` (the
  stories' fixed themes and files)
- Modify: `packages/web/src/theme.tsx` (rewritten), `packages/web/src/App.tsx` (the provider, and
  `ThemesFeed` where the app is signed in), `packages/web/index.html` (the first paint's script, the
  `theme-color` metas), `theme/palette.ts` (the rule paints `<html>`, R14), `.storybook/preview.tsx`
  (its mode's type is `Mode`), `settings/SettingsPage.tsx` and `SettingsView.tsx` (the themes passed
  in, as the server's values are), `SettingsView.stories.tsx`, `settings/OtherSettings.tsx`
  (`AppearanceSettings` leaves), `settings/categories.ts`, `keys/LeaderKeys.tsx` (`space u m` in
  place of `space u t`), `ThemeMockups.stories.tsx` (its Appearance stories draw
  `AppearanceSettings`' rows over fixed data), `docs/web-ui.md` (Settings, Appearance),
  `packages/web/scripts/palette-probe.ts` (`--first-paint`)
- Test: `packages/web/src/__tests__/theme.test.ts` (rewritten), `__tests__/categories.test.ts` (rows
  20 to 26), `__tests__/keys-leader-tree.test.tsx` (line 148), `__tests__/theme-roles.test.ts` (the
  palette rule's text, with `<html>`'s block)

**Interfaces:**

- Consumes: `useThemes()` from `useThemes.ts` (task 3); `tokensOf`, `applyPalette`, `Tokens` (task
  4); `DEFAULT_DARK`, `DEFAULT_LIGHT` values (task 2, repeated as constants in `theme.tsx`).
- Produces, from `theme.tsx`:
  - `export type Mode = "system" | "light" | "dark"`,
    `export type Picks = { dark: string; light: string; mode: Mode }`.
  - `export function storedPicks(read: (key: string) => string | null): Picks`.
  - `export function storedDrawn(text: string | null): { dark?: Tokens; light?: Tokens }`: the
    cache, empty when absent or unreadable.
  - `export function drawnTokens(themes, picks, preview?): { dark?: Tokens; light?: Tokens }`: what
    each mode draws, a pick the lists lack drawn as its mode's default (R15).
  - `export function ThemeProvider({ children }: { children: (mode: "light" | "dark") => ReactNode })`,
    in place of `ThemeModeProvider`, and `export function ThemesFeed()`, drawn where the app is
    signed in, which gives it the server's themes (R15).
  - `export function usePicks(): [Picks, (next: Partial<Picks>) => void]`.
  - `export function useThemeList(): ReadonlyArray<Theme>`: the server's themes, or the two
    Catppuccin defaults when signed out.
  - `export function useThemePreview(): (id: string | undefined) => void`: draws the app in that
    theme, its mode included, until called with `undefined`.
  - `export function useDrawnTokens(): { dark?: Tokens; light?: Tokens }`: what the page draws now,
    for the story frames (task 9).

- [x] **Step 1: Write the failing tests**

`theme.test.ts`:

- "the stored value %j reads as %j", rows over the three keys: nothing stored →
  `{ mode: "system", dark: "catppuccin-mocha", light: "catppuccin-latte" }`; `uraeda.theme` `mocha`
  → mode `dark`, `latte` → `light`, `dark`, `light`, `system` as themselves, `solarized` → `system`;
  `uraeda.theme.dark` `dracula` → `dark: "dracula"`. Breaks: Mocha picked before reading as System
  (US1.3).
- "an unknown pick draws its mode's default": `drawnTokens` given the themes the binding reads,
  without `ember`, and picks `dark: "ember"` draws `tokensOf(catppuccin-mocha)`. Breaks: a deleted
  theme drawing nothing. A second test draws a known pick, Dracula, and a preview, Alucard, in its
  mode's place.
- "the drawn cache %j reads as %j": `null`, `"{"`, `"[]"`, `{"dark":{"--x":"#000000"}}` → `{}`,
  `{}`, `{}`, `{ dark: {…} }`. Breaks: a corrupt cache throwing at load (review focus 4).

`categories.test.ts` rows 20 to 26: "colour", "scheme", "mocha", "Latte", "THEME", "dark", "light"
find the Appearance rows ("Mode", "Dark theme", "Light theme", or "Your themes" as the terms say),
and "toml" finds "Your themes". `keys-leader-tree.test.tsx` line 148 becomes "Space u m cycles the
mode: System, Light, then Dark".

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/theme.test.ts`
- Expected: FAIL, `storedPicks is not exported` or the import's error.

- [x] **Step 3: Implement the picks and the provider**

- `theme.tsx`: the picks per the data model, written as `store` writes today (removed when equal to
  the default; storage errors swallowed). The provider resolves the mode as today, the pick of each
  mode against `useThemeList()` (default when unknown), maps both with `tokensOf`, calls
  `applyPalette` with both (the preview's theme replacing its mode's), writes `uraeda.theme.drawn`
  when the drawn tokens change, and sets each `theme-color` meta to its mode's
  `--color-background-body`. Signed out, it draws the cache.
- `index.html`: a classic inline script in `<head>`, before any stylesheet's paint: reads
  `uraeda.theme` and `uraeda.theme.drawn`, resolves the mode with `matchMedia`, sets
  `data-astryx-theme="uraeda"` and `data-theme` on `<html>`, and writes the same rule text as
  `paletteCss` into `<style id="uraeda-palette">`, inside `try`, doing nothing on any error. The
  rule paints `<html>` in `--color-background-body`, as nothing else paints it before the app mounts
  (R14), and sets each `theme-color` meta to the cached `--color-background-body` of the mode it
  shows, as the provider does after mount. `__tests__/first-paint.test.ts` runs the script in
  happy-dom and holds what it draws equal to `storedPicks` and `storedDrawn`.
- Appearance: from the mockup story, three rows, Mode (System, Light, Dark), Dark theme and Light
  theme (Astryx `Selector`, the user's themes after the shipped ones, labelled `<Name> · yours`),
  and Your themes: each file of `useThemes().files` with its summary line (name, mode, the theme it
  extends, and its counts of problems and warnings) and its problems in an `AnnouncedBanner` per
  kind, the core's messages as they are, as the mockup shows; the row's help names `folder`, where
  to put one. The help texts are the mockup's. `SettingsPage` reads `useThemes()` and passes it to
  `SettingsView`, as it passes the server's settings, so the stories pass fixed themes.
- `space u m` in `LeaderKeys.tsx`, label "Mode", cycling System → Light → Dark → System. `space u t`
  goes until task 8.
- The mockup stories `AppearanceSection` and `NoThemesYet` draw the real rows over fixed themes.

- [x] **Step 4: Check the first paint in a browser**

- Run: `nix develop -c node packages/web/scripts/palette-probe.ts --first-paint`, which stores
  `uraeda.theme.dark` and a drawn cache for a theme whose page is `#282a36`, reloads, and reads
  `<html>`'s background in the first frame (`page.evaluate` in a `requestAnimationFrame` before
  React mounts, or a `load` listener added by `addInitScript`), then once the page shows, on Home
  and on the sign-in page.
- Expected: `ok` for both.

- [x] **Step 5: Run the task's validation, and look**

- Run:
  `nix develop -c vp test packages/web/src/__tests__/theme.test.ts packages/web/src/__tests__/categories.test.ts packages/web/src/__tests__/keys-leader-tree.test.tsx`,
  then `nix develop -c vp check`
- Expected: PASS. Then `vp run sandbox`: Appearance at a phone's and a desktop's width, in a dark
  and a light theme. Deferred to `ready`: the other UI tests, Storybook's build.

- [x] **Step 6: Commit**

```bash
git add packages/web docs/web-ui.md specs/2026-11-07-color-themes/plan.md
git commit -m "feat(color-themes): a mode and a theme per mode, kept per browser, from the first paint"
```

## Task 7: Views ask for roles, and headings take their level's colour

**Files:**

- Create: `packages/web/lint/colour.js`, `packages/web/src/__lint__/hue-token.tsx`,
  `packages/web/src/layout/headings.ts` (the heading colours by level, one home),
  `packages/web/src/layout/RoleBadge.tsx` (a badge in a role's colour, for the hue variants)
- Modify: every view the code read lists with a hue, `fields/editor/markdown.ts`, `Blocks.tsx`,
  `spec/SpecPage.tsx`, `RoundOpening.tsx`, `theme/theme.ts` (the markdown component's headings),
  `ThemeMockups.stories.tsx` (`HeadingsByLevel` draws the real headings; the TEMPORARY note goes),
  `marks.stylex.ts` (a ledger row's tints), `vite.config.ts` (the plugin and its rule),
  `specs/ui/look-and-feel.md` and `specs/ui/surfaces.md` where they name a hue for a meaning
- Test: `packages/web/src/__tests__/lint.test.ts` (a row)

**Interfaces:**

- Consumes: the `--role-*` and `--role-*-tint` variables (task 4).
- Produces: `colour/roles-not-hues`, an Oxlint JS rule for `packages/web/src/**` outside
  `src/theme/**`, tests, and `__lint__`, with the message "Ask for a colour by its role,
  var(--role-…), never a hue (Colour themes decision)."; `headingStyle(level)` from
  `layout/headings.ts`; `RoleBadge` from `layout/RoleBadge.tsx`, Astryx's neutral `Badge` in the
  role `added` or `caution`.

- [x] **Step 1: Write the failing test**

`lint.test.ts`, a test "lint refuses a hue in a string, a member key, and a prop (SC-004)", which
counts four `roles-not-hues` reports on `hue-token.tsx` (R16), the fixture holding
`"var(--color-text-orange)"` in a `stylex.create`, `colorVars["--color-border-red"]`, a
`<Badge variant="yellow" />`, and a hue picked by a condition, `variant={active ? "green" : …}`.
Breaks: a hue in a string, in a member key, or in a prop slipping by.

- [x] **Step 2: Run it to check it fails**

- Run: `nix develop -c vp test packages/web/src/__tests__/lint.test.ts`
- Expected: FAIL, no `roles-not-hues` report in the output.

- [x] **Step 3: Implement the rule, then move every view**

The rule reports a string or template piece matching
`--color-(text|border|background|icon|fill)-(red|orange|yellow|green|teal|cyan|blue|purple|pink|gray|lavender|sapphire)\b`,
and a JSX `variant` or `color` attribute whose literal value, or a condition's, is one of those
hues. Then each view takes the role of what it means, from the discovery's
[table](discovery-01.md#what-each-colour-means-today) and the data model: `-orange` → `needs-you`,
`-purple` → `changed` (a pane's "changed") or `action` where it is what can be pressed, `-green` →
`added`, `-red` → `removed`, `-yellow` → `caution`, `-blue` → `context`, `yours`, `link`, or
`working` by what it marks, `-teal` → `example`, `--color-fill-teal` → `sub-agent`, `-sapphire` →
`live`, `-lavender` → `pane-title`, `-background-gray` → `chip`, a hue's background → its role's
`-tint`, the status line's modes → `mode-*`. A hue variant of an Astryx component becomes its
neutral variant styled with the role through `xstyle`, drawn by `RoleBadge`. A list section's `Tone`
and a pane's `PaneTint` name meanings, not hues (R16). Semantic tokens (`--color-accent`,
`--color-success`, `--color-text-secondary`, …) stay.

- [x] **Step 4: Colour headings by level**

`layout/headings.ts` gives `heading-1`, `-2`, `-3` by level, deeper levels `-3`. Blocks' heading,
the spec page's section headings, and a round's title take it; the theme's `markdown` component rule
colours a message's headings by the level written (with `headingLevelStart={4}`, `h4` is `#`); the
editor's markdown takes `heading1` → `heading-1`, `heading2` → `-2`, the rest `-3`. A page title or
a pane title that is a document's heading takes its level's role too, by `PageTitle`'s
`isDocumentHeading` and `Pane`'s `tint="heading"` (R17): the `#` titles of the spec, document, plan,
and data model pages, a user story's pane (`###`), and a document's `##` section pane, a plan's
task's included. Page, pane, and group titles that are not a document's headings keep theirs.

- [x] **Step 5: Run the task's validation, and look**

- Run: `nix develop -c vp test packages/web/src/__tests__/lint.test.ts`, then
  `nix develop -c vp check`
- Expected: PASS, no `roles-not-hues` report in the views. Then `vp run sandbox`: Home, a spec, a
  round, a session, the Git page, at both widths, in Mocha and Latte: the same colours as before,
  headings excepted. Deferred to `ready`: the UI tests, Storybook's build.

- [x] **Step 6: Commit**

```bash
git add packages/web vite.config.ts specs/ui specs/2026-11-07-color-themes/plan.md \
  specs/2026-11-07-color-themes/rulings.md
git commit -m "feat(color-themes): views ask for roles, and headings take their level's colour"
```

## Task 8: The theme picker

**Files:**

- Start from: `ThemeMockups.stories.tsx#ThemePicker` and `#ThemePickerFaded`
- Create: `packages/web/src/keys/ThemePicker.tsx`
- Modify: `packages/web/src/keys/KeyPicker.tsx` (its in-page mode), `keys/pickerSources.ts`
  (`PickerItem.aside`), `keys/LeaderKeys.tsx` (`space u t`), `ThemeMockups.stories.tsx` (the two
  picker stories draw `ThemePicker`)
- Test: `packages/web/src/__tests__/theme-picker.test.tsx`

**Interfaces:**

- Consumes: `usePicks`, `useThemeList`, `useThemePreview` (task 6).
- Produces: `KeyPicker` gains
  `inPage?: { footer: ReactNode; onCursor: (item: PickerItem | undefined) => void }`; `PickerItem`
  gains `aside?: string`, drawn at the row's end in the supporting style;
  `ThemePicker({ isOpen, onClose })`.

- [ ] **Step 1: Write the failing tests**

`theme-picker.test.tsx`, rendering the shell with the helpers, on a fake theme list:

- "Escape puts back the theme in use": open `Space u t`, move to Nord (`j` until its row), the
  palette's dark block holds Nord's `--color-background-body`; Escape, and it holds Mocha's again.
  Breaks: the preview kept after closing.
- "a light theme picked in dark mode becomes the light theme, in Light mode": mode dark, pick Rosé
  Pine Dawn with Enter: `uraeda.theme.light` is `rose-pine-dawn` and `uraeda.theme` is `light`.
  Breaks: the dark pick overwritten.

- [ ] **Step 2: Run them to check they fail**

- Run: `nix develop -c vp test packages/web/src/__tests__/theme-picker.test.tsx`
- Expected: FAIL, the leader's `space u t` not found.

- [ ] **Step 3: Implement the in-page mode and the picker**

In page mode `KeyPicker` draws its list alone, `--size-palette-list` wide (the window's width less
its margins on a phone), at `--spacing-10` from the top, centred, in frosted glass
(`glassStyles.surface`, `floating`), with no scrim: a non-modal layer that keeps Back, Escape, and
the focus return of today, on every width (R6). It reports the cursor's item to `onCursor`. After
1000 ms with no key and no pointer move it fades to opacity 0.1, and back to 1 on either, both over
200 ms, at once under `prefers-reduced-motion` (C1). The footer is `inPage.footer`.

`ThemePicker`: every theme, dark ones first, each row its name, its `aside` "dark" or "light", "· in
use" for the two in use, "· yours" for the user's. The cursor calls `useThemePreview()(id)`; closing
without a pick calls it with `undefined`. Enter sets that mode's theme, and the mode to it when it
is not the one drawn. The footer reads `Enter keeps <name> · Esc puts <name in use> back`.
`space u t`, label "Theme…", opens it.

- [ ] **Step 4: Run the task's validation, and look**

- Run:
  `nix develop -c vp test packages/web/src/__tests__/theme-picker.test.tsx packages/web/src/__tests__/keys-leader-tree.test.tsx`,
  then `nix develop -c vp check`
- Expected: PASS. Then `vp run sandbox`: the picker at a phone's and a desktop's width, the fade, a
  pick of each mode. Deferred to `ready`: the other UI tests, Storybook's build.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-11-07-color-themes/plan.md
git commit -m "feat(color-themes): Space u t previews each theme in the page"
```

## Task 9: Story frames draw the picked theme

**Files:**

- Modify: `packages/web/src/StoryFrames.tsx` (the mode message carries the palette),
  `packages/web/.storybook/preview.tsx` (`embeddingMode` keeps it and applies it),
  `packages/web/src/sandbox/mountSandboxBar.tsx` only if task 1's probe found the bar outside the
  page's rule

**Interfaces:**

- Consumes: `useDrawnTokens` (task 6), `applyPalette` (task 4).
- Produces: the message `{ uraeda: "mode", mode, palette?: { dark?: Tokens; light?: Tokens } }`; a
  frame given none keeps the built theme.

- [ ] **Step 1: Implement the message and its use**

`StoryFrames` sends the drawn tokens with the mode, at ready and on every change; the preview checks
the message's shape as it does the mode's (each token name `--…`, each value a `#` colour), and
calls `applyPalette(palette, document)`. Storybook's own pages, with no parent, keep the built
Catppuccin.

- [ ] **Step 2: Run the task's validation, and look**

- Run: `nix develop -c vp check`, then `nix develop -c vp run storybook:build`
- Expected: PASS. Then in the sandbox, a spec with stories, its frames in Dracula and in Alucard. No
  test: a look seen in use, at the early stage (testing decision). Deferred to `ready`: the rest.

- [ ] **Step 3: Commit**

```bash
git add packages/web specs/2026-11-07-color-themes/plan.md
git commit -m "feat(color-themes): story frames draw the picked theme"
```
